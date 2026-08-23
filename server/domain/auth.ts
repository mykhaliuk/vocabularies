import { and, eq, gt, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import { magicLinkTokens } from '~/db/schema/magic-link-tokens';
import { sessions } from '~/db/schema/sessions';
import { signinClaims } from '~/db/schema/signin-claims';
import { users } from '~/db/schema/users';
import { signSession } from '~/server/utils/auth';
import { useDb } from '~/server/utils/db';
import { CONFIRM_MAX_ATTEMPTS } from '~/shared/magic-link';
import type { InferSelectModel } from 'drizzle-orm';

export type UserRow = InferSelectModel<typeof users>;

export interface SigninTokenInput {
  email: string;
  tokenHash: Buffer;
  pollKeyHash: Buffer | null;
  expiresAt: Date;
}

export interface SessionInput {
  email: string;
  userAgent: string | null;
  ip: string | null;
  expiresAt: Date;
}

export interface ClaimArmInput {
  pollKeyHash: Buffer;
  userId: string;
  confirmCodeHash: Buffer;
  confirmExpiresAt: Date;
}

export interface ClaimConfirmInput {
  pollKeyHash: Buffer;
  codeHash: Buffer;
  now: Date;
  sessionExpiresAt: Date;
  userAgent: string | null;
  ip: string | null;
}

// Mint a sign-in token; when a poll key rides along (installed PWA), bind it
// to a pending claim. Lazy cleanup — an admitted crutch, not a design.
// Postgres has no native row TTL, and every scheduler we could point at it is
// worse on our infra (Vercel cron needs a secret + endpoint; pg_cron never
// fires on Neon's scale-to-zero compute). So expired tokens are swept here, at
// the only moment the table grows. Correctness never depends on this: the
// callback checks expiresAt itself. When tokens move to a store with real TTL
// semantics (Redis SET..EX + GETDEL for single-use), this whole sweep goes
// straight to the bin — see VKB-53 for the trade-off record. Fail-open: this
// hygiene delete must never abort an otherwise-viable send (ADR-0002).
export const mintSigninToken = async (input: SigninTokenInput) => {
  const { email, tokenHash, pollKeyHash, expiresAt } = input;
  const db = useDb();

  try {
    await db
      .delete(magicLinkTokens)
      .where(lt(magicLinkTokens.expiresAt, new Date()));
  } catch (error) {
    console.error('[magic-link] token sweep failure (failing open)', error);
  }

  await db
    .insert(magicLinkTokens)
    .values({ email, tokenHash, expiresAt, pollKeyHash });

  // Upsert (not insert) so resending a link for the same key extends the
  // claim instead of colliding on the unique poll_key_hash. The sweep of
  // expired claims rides here — the only moment the table grows — mirroring
  // the token sweep above (ADR-0002) and the session sweep at session
  // creation (ADR-0005).
  if (pollKeyHash) {
    try {
      await db
        .delete(signinClaims)
        .where(lt(signinClaims.expiresAt, new Date()));
    } catch (error) {
      console.error('[magic-link] claim sweep failure (failing open)', error);
    }
    await db
      .insert(signinClaims)
      .values({ pollKeyHash, expiresAt })
      .onConflictDoUpdate({
        target: signinClaims.pollKeyHash,
        set: { expiresAt },
      });
  }
};

// Delete IS consumption: exactly one caller can ever see the row. Expiry is
// checked by the caller AFTER the delete, so an expired token is still burned.
export const consumeSigninToken = async (tokenHash: Buffer) => {
  const db = useDb();
  const [consumed] = await db
    .delete(magicLinkTokens)
    .where(eq(magicLinkTokens.tokenHash, tokenHash))
    .returning({
      email: magicLinkTokens.email,
      expiresAt: magicLinkTokens.expiresAt,
      pollKeyHash: magicLinkTokens.pollKeyHash,
    });
  return consumed ?? null;
};

// Upsert the user by email and mint a session, atomically. The lazy sweep of
// expired sessions runs first, at the only moment the table grows — expired
// rows are inert (session resolution rejects them) but carry ip/user_agent —
// see ADR-0005. Fail-open: hygiene must never abort the sign-in.
export const createSessionForEmail = async (input: SessionInput) => {
  const { email, userAgent, ip, expiresAt } = input;
  const db = useDb();

  try {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
  } catch (error) {
    console.error(
      '[auth.callback] session sweep failure (failing open)',
      error,
    );
  }

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email}`)
      .limit(1);

    let user = existing;
    if (!user) {
      const [created] = await tx.insert(users).values({ email }).returning();
      user = created;
    }
    if (!user) throw new Error('failed to upsert user');

    const [createdSession] = await tx
      .insert(sessions)
      .values({ userId: user.id, expiresAt, userAgent, ip })
      .returning();

    if (!createdSession) throw new Error('failed to create session');
    return createdSession;
  });
};

// Arm the pending claim with a confirmation code. Re-arm (overwrite) on
// WHERE claimed_at IS NULL so clicking the latest of several resent links
// shows a fresh, usable code (ADR-0008).
export const armClaimConfirmation = async (input: ClaimArmInput) => {
  const { pollKeyHash, userId, confirmCodeHash, confirmExpiresAt } = input;
  const db = useDb();

  const [armed] = await db
    .update(signinClaims)
    .set({
      userId,
      confirmCodeHash,
      confirmExpiresAt,
      confirmAttempts: 0,
      // A late click can push confirm_expires_at (click + 5 min) past the
      // outer expires_at (send + 15 min). Extend the outer bound so the
      // GLOBAL claim sweep in mintSigninToken (delete WHERE expires_at <
      // now, not scoped to one key) can never delete a claim while its
      // confirm window is still open. greatest() never shortens it.
      expiresAt: sql`greatest(${signinClaims.expiresAt}, ${confirmExpiresAt.toISOString()}::timestamptz)`,
    })
    .where(
      and(
        eq(signinClaims.pollKeyHash, pollKeyHash),
        isNull(signinClaims.claimedAt),
      ),
    )
    .returning({ id: signinClaims.id });

  return Boolean(armed);
};

// Atomically CONSUME one attempt and read the armed code hash — but only while
// the claim is unclaimed, armed, within its confirm window, and under the cap.
// The row lock this single UPDATE takes is the brute-force gate: at most
// CONFIRM_MAX_ATTEMPTS requests can ever obtain a hash to compare, no matter
// how many fire in parallel. A read-then-compare-then-increment (three pooled
// statements, no lock held across them) let N concurrent requests all read
// attempts=0 and test a code before any increment committed — the TOCTOU that
// made the 4-digit code brute-forceable.
export const consumeConfirmAttempt = async (pollKeyHash: Buffer, now: Date) => {
  const db = useDb();
  const [attempt] = await db
    .update(signinClaims)
    .set({ confirmAttempts: sql`${signinClaims.confirmAttempts} + 1` })
    .where(
      and(
        eq(signinClaims.pollKeyHash, pollKeyHash),
        isNull(signinClaims.claimedAt),
        isNotNull(signinClaims.userId),
        isNotNull(signinClaims.confirmCodeHash),
        gt(signinClaims.confirmExpiresAt, now),
        lt(signinClaims.confirmAttempts, CONFIRM_MAX_ATTEMPTS),
      ),
    )
    .returning({
      confirmCodeHash: signinClaims.confirmCodeHash,
      attempts: signinClaims.confirmAttempts,
    });
  return attempt ?? null;
};

// Claim exactly once + mint the session, atomically, signing inside the
// transaction so a signing failure rolls the claim back. The guarded UPDATE
// re-checks the code hash so a concurrent re-arm (another link click
// mid-confirm) cannot let a stale code through, and re-checks claimed_at so
// the session issues exactly once. It does NOT re-check the attempt cap: this
// request already legitimately consumed an in-cap attempt and matched, so
// concurrent wrong guesses filling the cap must not retroactively deny it.
// Returns null when the claim was lost (raced or re-armed), otherwise the
// signed jwt and the user. On success the lazy session sweep (ADR-0005) runs,
// fail-open: hygiene must never abort the sign-in it rides on.
export const claimAndMintSession = async (input: ClaimConfirmInput) => {
  const { pollKeyHash, codeHash, now, sessionExpiresAt, userAgent, ip } = input;
  const db = useDb();

  const issued = await db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(signinClaims)
      .set({ claimedAt: now })
      .where(
        and(
          eq(signinClaims.pollKeyHash, pollKeyHash),
          eq(signinClaims.confirmCodeHash, codeHash),
          isNull(signinClaims.claimedAt),
          isNotNull(signinClaims.userId),
          gt(signinClaims.confirmExpiresAt, now),
        ),
      )
      .returning({ userId: signinClaims.userId });

    if (!claimed?.userId) return null;

    const [session] = await tx
      .insert(sessions)
      .values({
        userId: claimed.userId,
        expiresAt: sessionExpiresAt,
        userAgent,
        ip,
      })
      .returning({ id: sessions.id });
    if (!session) throw new Error('failed to mint session');

    const [user] = await tx
      .select()
      .from(users)
      .where(eq(users.id, claimed.userId))
      .limit(1);
    if (!user) throw new Error('claimed user missing');

    const jwt = await signSession(session.id);
    return { jwt, user };
  });

  if (issued) {
    try {
      await db.delete(sessions).where(lt(sessions.expiresAt, now));
    } catch (error) {
      console.error(
        '[auth.confirm] session sweep failure (failing open)',
        error,
      );
    }
  }

  return issued;
};

// Armed-and-confirmable = clicked (user_id + code set), unclaimed, within the
// confirm window, and not locked by the attempt cap.
export const findArmedClaim = async (pollKeyHash: Buffer, now: Date) => {
  const db = useDb();
  const [armed] = await db
    .select({ id: signinClaims.id })
    .from(signinClaims)
    .where(
      and(
        eq(signinClaims.pollKeyHash, pollKeyHash),
        isNotNull(signinClaims.userId),
        isNotNull(signinClaims.confirmCodeHash),
        isNull(signinClaims.claimedAt),
        gt(signinClaims.confirmExpiresAt, now),
        lt(signinClaims.confirmAttempts, CONFIRM_MAX_ATTEMPTS),
      ),
    )
    .limit(1);
  return Boolean(armed);
};
