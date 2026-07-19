import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';

// Local-only integration test for the poll/claim + confirmation-code server
// flow (VKB-70). Drives the real handlers over HTTP against a running dev
// server + local Postgres. NOT part of the CI e2e suite (no DB in CI) — see
// e2e/local/README. Invoked by e2e/local/run.mjs with { base, findLink }.

const mintKey = () => randomBytes(32).toString('base64url');
const sha256hex = (raw) => createHash('sha256').update(raw).digest('hex');
const wrongCodeFor = (code) =>
  String((Number(code) + 1) % 10000).padStart(4, '0');

const sessionCookieFrom = (res) => {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = /vocabu_session=([^;]+)/.exec(setCookie);
  return match && match[1] !== '' ? `vocabu_session=${match[1]}` : null;
};

// The confirmation code is rendered in the click page's status element.
const extractCode = (html) => {
  const match = /role="status"[^>]*>\s*(\d{4})\s*</.exec(html);
  return match ? match[1] : null;
};

export const run = async ({ base, findLink }) => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  let passed = 0;
  let failed = 0;
  const check = (name, cond, extra = '') => {
    if (cond) passed++;
    else failed++;
    console.log(
      `  ${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`,
    );
  };

  const post = (path, body, cookie) =>
    fetch(base + path, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    });

  const requestLink = async (email, pollKey) => {
    const res = await post('/api/auth/magic-link', { email, pollKey });
    if (res.status !== 200) throw new Error(`magic-link ${res.status}`);
    return findLink(email);
  };

  const sessionsFor = async (email) => {
    const rows = await pool.query(
      `select count(*)::int as n from sessions s
         join users u on u.id = s.user_id
        where lower(u.email) = $1`,
      [email],
    );
    return rows.rows[0].n;
  };

  try {
    console.log('\n== Happy path: PWA poll/claim + confirmation code ==');
    const email = `pwa-${Date.now()}@example.com`;
    const pollKey = mintKey();
    const link = await requestLink(email, pollKey);
    check('magic-link accepted pollKey and printed link', Boolean(link));

    const early = await post('/api/auth/poll', { pollKey });
    const earlyBody = await early.json();
    check(
      'poll before click -> pending',
      early.status === 200 && earlyBody.status === 'pending',
    );

    // Click in a SEPARATE jar (Safari): renders the code page + its own session.
    const cb = await fetch(link, { redirect: 'manual' });
    const cbHtml = await cb.text();
    const safariCookie = sessionCookieFrom(cb);
    const code = extractCode(cbHtml);
    check(
      'click (Safari jar) -> 200 code page with a session + a 4-digit code',
      cb.status === 200 &&
        (cb.headers.get('content-type') ?? '').includes('text/html') &&
        Boolean(safariCookie) &&
        /^\d{4}$/.test(code ?? ''),
      code ? `code=${code}` : 'no code',
    );

    const afterClick = await post('/api/auth/poll', { pollKey });
    const afterText = await afterClick.text();
    check(
      'poll after click -> confirm, and the code is NOT in the poll response',
      afterClick.status === 200 &&
        JSON.parse(afterText).status === 'confirm' &&
        !new RegExp(`\\b${code}\\b`).test(afterText),
    );

    const confirmed = await post('/api/auth/confirm', { pollKey, code });
    const confirmedBody = await confirmed.json();
    const pwaCookie = sessionCookieFrom(confirmed);
    check(
      'confirm with correct code -> ready + session cookie in PWA jar',
      confirmed.status === 200 &&
        confirmedBody.status === 'ready' &&
        confirmedBody.user?.email === email &&
        Boolean(pwaCookie),
    );
    check(
      'PWA session cookie is distinct from the Safari one',
      Boolean(pwaCookie) && pwaCookie !== safariCookie,
    );

    const meRes = await fetch(base + '/api/me', {
      headers: { cookie: pwaCookie },
    });
    const meBody = await meRes.json();
    check(
      'PWA cookie authenticates GET /api/me',
      meRes.status === 200 && meBody.email === email,
    );
    check(
      'exactly two sessions (Safari click + PWA confirm)',
      (await sessionsFor(email)) === 2,
    );

    const reconfirm = await post('/api/auth/confirm', { pollKey, code });
    const reconfirmBody = await reconfirm.json();
    check(
      'confirm again (already claimed) -> expired, no new cookie',
      reconfirmBody.status === 'expired' &&
        sessionCookieFrom(reconfirm) === null,
    );

    console.log('\n== REGRESSION: attacker holds pollKey but NOT the code ==');
    const victimEmail = `victim-${Date.now()}@example.com`;
    const stolenKey = mintKey();
    const victimLink = await requestLink(victimEmail, stolenKey);
    // Victim clicks (arms the claim + reveals the code on THEIR Safari page).
    const victimCb = await fetch(victimLink, { redirect: 'manual' });
    const realCode = extractCode(await victimCb.text());
    const wrong = wrongCodeFor(realCode);

    // Attacker (holds stolenKey, never saw the code page) probes:
    const atkPoll = await post('/api/auth/poll', { pollKey: stolenKey });
    check(
      'attacker poll -> confirm (armed) but no code is ever revealed',
      (await atkPoll.json()).status === 'confirm',
    );

    const a1 = await post('/api/auth/confirm', {
      pollKey: stolenKey,
      code: wrong,
    });
    const a2 = await post('/api/auth/confirm', {
      pollKey: stolenKey,
      code: wrong,
    });
    const a3 = await post('/api/auth/confirm', {
      pollKey: stolenKey,
      code: wrong,
    });
    const s1 = (await a1.json()).status;
    const s2 = (await a2.json()).status;
    const s3 = (await a3.json()).status;
    check(
      'wrong code x3 -> invalid, invalid, expired (locked); no cookie any time',
      s1 === 'invalid' &&
        s2 === 'invalid' &&
        s3 === 'expired' &&
        sessionCookieFrom(a1) === null &&
        sessionCookieFrom(a2) === null &&
        sessionCookieFrom(a3) === null,
      `${s1},${s2},${s3}`,
    );

    // Even the CORRECT code no longer works once locked.
    const postLock = await post('/api/auth/confirm', {
      pollKey: stolenKey,
      code: realCode,
    });
    check(
      'correct code AFTER lock -> expired, still no cookie',
      (await postLock.json()).status === 'expired' &&
        sessionCookieFrom(postLock) === null,
    );
    check(
      'attacker minted NO session — only the victim Safari session exists',
      (await sessionsFor(victimEmail)) === 1,
      `sessions=${await sessionsFor(victimEmail)}`,
    );

    console.log('\n== More security invariants ==');
    const unknown = await post('/api/auth/confirm', {
      pollKey: mintKey(),
      code: '1234',
    });
    check(
      'confirm with unknown pollKey -> expired (no enumeration)',
      unknown.status === 200 && (await unknown.json()).status === 'expired',
    );
    check(
      'malformed code -> 400',
      (await post('/api/auth/confirm', { pollKey: mintKey(), code: 'no' }))
        .status === 400,
    );

    // Confirm-window expiry: arm a claim directly with a past confirm window.
    const expiredKey = mintKey();
    const expiredCode = '4242';
    const expUser = await pool.query(
      'select id from users where lower(email) = $1',
      [email],
    );
    await pool.query(
      `insert into signin_claims
         (poll_key_hash, user_id, confirm_code_hash, confirm_attempts,
          confirm_expires_at, expires_at)
       values (decode($1,'hex'), $2, decode($3,'hex'), 0,
               now() - interval '1 minute', now() + interval '10 minute')`,
      [sha256hex(expiredKey), expUser.rows[0].id, sha256hex(expiredCode)],
    );
    const expPoll = await post('/api/auth/poll', { pollKey: expiredKey });
    const expConfirm = await post('/api/auth/confirm', {
      pollKey: expiredKey,
      code: expiredCode,
    });
    check(
      'expired confirm window -> poll pending, confirm expired (right code)',
      (await expPoll.json()).status === 'pending' &&
        (await expConfirm.json()).status === 'expired' &&
        sessionCookieFrom(expConfirm) === null,
    );

    console.log(
      '\n== REGRESSION (BUG 1): parallel guesses cannot exceed cap ==',
    );
    // The attempt cap must be an atomic gate, not a stale read: N concurrent
    // confirms with distinct WRONG codes must test at most 3 codes. On the
    // pre-fix (read-then-compare-then-increment) all N tested a code and
    // confirm_attempts reached N (~12); on the fix the atomic consume caps it
    // at exactly 3. This assertion fails pre-fix and passes post-fix.
    const parEmail = `parallel-${Date.now()}@example.com`;
    const parKey = mintKey();
    const parLink = await requestLink(parEmail, parKey);
    const parCb = await fetch(parLink, { redirect: 'manual' });
    const parRealCode = extractCode(await parCb.text());
    const wrongGuesses = [];
    for (let i = 1; i <= 12; i++) {
      wrongGuesses.push(
        String((Number(parRealCode) + i) % 10000).padStart(4, '0'),
      );
    }
    const parResults = await Promise.all(
      wrongGuesses.map((guess) =>
        post('/api/auth/confirm', { pollKey: parKey, code: guess }),
      ),
    );
    const parBodies = await Promise.all(parResults.map((r) => r.json()));
    const parReady = parBodies.filter((b) => b.status === 'ready').length;
    const parCookies = parResults.filter(
      (r) => sessionCookieFrom(r) !== null,
    ).length;
    const parAttemptsRow = await pool.query(
      `select confirm_attempts from signin_claims
         where poll_key_hash = decode($1,'hex')`,
      [sha256hex(parKey)],
    );
    check(
      '12 parallel wrong guesses -> confirm_attempts capped at 3, no session',
      parAttemptsRow.rows[0].confirm_attempts === 3 &&
        parReady === 0 &&
        parCookies === 0 &&
        (await sessionsFor(parEmail)) === 1,
      `attempts=${parAttemptsRow.rows[0].confirm_attempts} ready=${parReady} cookies=${parCookies}`,
    );
    const parAfter = await post('/api/auth/confirm', {
      pollKey: parKey,
      code: parRealCode,
    });
    check(
      'correct code after the parallel lock -> expired, still no session',
      (await parAfter.json()).status === 'expired' &&
        (await sessionsFor(parEmail)) === 1,
    );

    console.log(
      '\n== REGRESSION (BUG 2): late-click window survives the sweep ==',
    );
    // A late click makes confirm_expires_at (click+5min) outlive expires_at
    // (send+15min). The arm must extend expires_at so the GLOBAL claim sweep
    // cannot delete a still-confirmable claim. Fast-forward the outer window to
    // the past (token untouched, so the click stays valid) to simulate it.
    const lateEmail = `late-${Date.now()}@example.com`;
    const lateKey = mintKey();
    const lateLink = await requestLink(lateEmail, lateKey);
    await pool.query(
      `update signin_claims set expires_at = now() - interval '1 minute'
         where poll_key_hash = decode($1,'hex')`,
      [sha256hex(lateKey)],
    );
    const lateCb = await fetch(lateLink, { redirect: 'manual' });
    const lateCode = extractCode(await lateCb.text());
    const lateRow = await pool.query(
      `select expires_at, confirm_expires_at from signin_claims
         where poll_key_hash = decode($1,'hex')`,
      [sha256hex(lateKey)],
    );
    const outerMs = new Date(lateRow.rows[0].expires_at).getTime();
    const confirmMs = new Date(lateRow.rows[0].confirm_expires_at).getTime();
    check(
      'arm extends expires_at to cover the confirm window',
      outerMs >= confirmMs,
      `expires_at ${outerMs >= confirmMs ? '>=' : '<'} confirm_expires_at`,
    );
    await pool.query(`delete from signin_claims where expires_at < now()`);
    const survived = await pool.query(
      `select 1 from signin_claims where poll_key_hash = decode($1,'hex')`,
      [sha256hex(lateKey)],
    );
    check(
      'claim survives the global sweep after a late click',
      survived.rowCount === 1,
    );
    const lateConfirm = await post('/api/auth/confirm', {
      pollKey: lateKey,
      code: lateCode,
    });
    check(
      'confirm still succeeds inside the shown window (not stranded)',
      (await lateConfirm.json()).status === 'ready' &&
        sessionCookieFrom(lateConfirm) !== null,
    );

    console.log('\n== Regression: desktop path (no pollKey) unchanged ==');
    const deskEmail = `desk-${Date.now()}@example.com`;
    const deskLink = await requestLink(deskEmail, undefined);
    const deskTok = await pool.query(
      `select count(*)::int as n from magic_link_tokens
         where lower(email) = $1 and poll_key_hash is null`,
      [deskEmail],
    );
    check(
      'desktop send stores token with poll_key_hash null',
      deskTok.rows[0].n >= 1,
    );
    const deskCb = await fetch(deskLink, { redirect: 'manual' });
    check(
      'desktop callback still 302 -> /me with session (no code page)',
      deskCb.status === 302 &&
        deskCb.headers.get('location') === '/me' &&
        Boolean(sessionCookieFrom(deskCb)),
    );
  } finally {
    await pool.end();
  }

  console.log(`\n  http: ${passed} passed, ${failed} failed`);
  return { passed, failed };
};
