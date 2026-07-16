# ADR-0005: expired sessions are swept lazily on sign-in, mirroring ADR-0002

- Status: Accepted
- Date: 2026-07-16
- Refs: VKB-62, VKB-61, ADR-0002, `server/api/auth/callback.get.ts`

## Context

Expired `sessions` rows were never deleted: the only `delete(sessions)` was
logout-by-id, so the table grew monotonically. Expiry is enforced in app
code only (`requireUser` rejects stale rows), so this is hygiene, not an
auth hole — the same shape as the magic-link tokens problem ADR-0002
solved. But the asymmetry was undocumented, and it kept being re-discovered
as a possible oversight. The volume argument from ADR-0002 does not
transfer unexamined: tokens live 15 minutes and a row is created per login
_request_; sessions live 30 days and a row is created only per _successful_
sign-in — far fewer rows. What does transfer, and tips the decision, is
that session rows carry `ip` and `user_agent`: keeping expired rows forever
means retaining personal data that no longer serves any purpose.

## Decision

Delete expired session rows in the auth callback right before inserting the
new session — the only moment the table grows — exactly mirroring the
ADR-0002 sweep for magic-link tokens. One `DELETE WHERE expires_at <
now()`, no cron, no endpoint, no secret.

## Consequences

- Cleanup work is proportional to sign-in traffic, which is exactly the
  traffic that creates the rows.
- Expired rows (and the IP/user-agent they carry) linger at most until the
  next sign-in anywhere in the system; during a quiet period they persist,
  which is acceptable because they are inert.
- The two auth tables now age out the same way; nobody has to re-derive
  why one is swept and the other is not.
- **Same recorded exit as ADR-0002:** when auth state moves to a store with
  native TTL (Redis), both lazy sweeps are deleted outright.

## Alternatives rejected

- **Do nothing, record why** — defensible on volume alone, but it
  permanently retains `ip`/`user_agent` for dead sessions to save one cheap
  `DELETE`; bad trade.
- **Vercel cron / pg_cron** — rejected in ADR-0002 for a bigger table; the
  reasoning (endpoint + secret overhead; pg_cron never fires on Neon
  scale-to-zero) applies with more force here.
- **Defer to the Redis migration** — leaves PII accumulating for an
  unscheduled migration; the sweep is one line and gets deleted with the
  migration anyway.
