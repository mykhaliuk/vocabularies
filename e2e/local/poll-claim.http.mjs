import { createHash, randomBytes } from 'node:crypto';
import pg from 'pg';

// Local-only integration test for the poll/claim server invariants (VKB-70).
// Drives the real handlers over HTTP against a running dev server + local
// Postgres. NOT part of the CI e2e suite (no DB in CI) — see e2e/local/README.
// Invoked by e2e/local/run.mjs with { base, findLink }; findLink resolves the
// magic-link URL from the dev server's console-email stdout.

const mintKey = () => randomBytes(32).toString('base64url');
const sha256hex = (raw) => createHash('sha256').update(raw).digest('hex');

const sessionCookieFrom = (res) => {
  const setCookie = res.headers.get('set-cookie');
  if (!setCookie) return null;
  const match = /vocabu_session=([^;]+)/.exec(setCookie);
  return match && match[1] !== '' ? `vocabu_session=${match[1]}` : null;
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

  try {
    const email = `pwa-${Date.now()}@example.com`;
    const pollKey = mintKey();

    console.log('\n== Happy path: PWA poll/claim end to end ==');
    const link = await requestLink(email, pollKey);
    check('magic-link accepted pollKey and printed link', Boolean(link));

    const boundRow = await pool.query(
      'select user_id from signin_claims where poll_key_hash = decode($1, $2)',
      [sha256hex(pollKey), 'hex'],
    );
    check(
      'claim row created, unarmed (user_id null)',
      boundRow.rowCount === 1 && boundRow.rows[0].user_id === null,
    );

    const early = await post('/api/auth/poll', { pollKey });
    const earlyBody = await early.json();
    check(
      'poll before armed -> pending, no cookie',
      early.status === 200 &&
        earlyBody.status === 'pending' &&
        sessionCookieFrom(early) === null,
    );

    const cb = await fetch(link, { redirect: 'manual' });
    const safariCookie = sessionCookieFrom(cb);
    check(
      'callback (Safari jar) 302 -> /me with its own session cookie',
      cb.status === 302 &&
        cb.headers.get('location') === '/me' &&
        Boolean(safariCookie),
    );

    const ready = await post('/api/auth/poll', { pollKey });
    const readyBody = await ready.json();
    const pwaCookie = sessionCookieFrom(ready);
    check(
      'poll after arm -> ready + session cookie in PWA jar',
      ready.status === 200 &&
        readyBody.status === 'ready' &&
        readyBody.user?.email === email &&
        Boolean(pwaCookie),
    );
    check(
      'PWA session cookie is distinct from the Safari one (fresh session)',
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

    console.log('\n== Security invariants ==');
    const second = await post('/api/auth/poll', { pollKey });
    const secondBody = await second.json();
    check(
      'double claim -> second poll pending, no new cookie',
      second.status === 200 &&
        secondBody.status === 'pending' &&
        sessionCookieFrom(second) === null,
    );

    const userRow = await pool.query(
      'select id from users where lower(email) = $1',
      [email],
    );
    const userId = userRow.rows[0].id;
    const sessCount = await pool.query(
      'select count(*)::int as n from sessions where user_id = $1',
      [userId],
    );
    check(
      'exactly two sessions for user (Safari + PWA), no double-issue',
      sessCount.rows[0].n === 2,
      `sessions=${sessCount.rows[0].n}`,
    );

    const unknown = await post('/api/auth/poll', { pollKey: mintKey() });
    const unknownBody = await unknown.json();
    check(
      'unknown pollKey -> pending (no enumeration)',
      unknown.status === 200 && unknownBody.status === 'pending',
    );
    check(
      'malformed pollKey -> 400',
      (await post('/api/auth/poll', { pollKey: 'too-short' })).status === 400,
    );
    check(
      'missing pollKey -> 400',
      (await post('/api/auth/poll', {})).status === 400,
    );

    const expiredKey = mintKey();
    await pool.query(
      `insert into signin_claims (poll_key_hash, user_id, claimed_at, expires_at)
       values (decode($1,'hex'), $2, null, now() - interval '1 minute')`,
      [sha256hex(expiredKey), userId],
    );
    const expired = await post('/api/auth/poll', { pollKey: expiredKey });
    const expiredBody = await expired.json();
    check(
      'expired armed claim -> pending, no cookie',
      expired.status === 200 &&
        expiredBody.status === 'pending' &&
        sessionCookieFrom(expired) === null,
    );

    console.log(
      '\n== Concurrency: claim exactly once under a double-poll race ==',
    );
    const raceEmail = `race-${Date.now()}@example.com`;
    const raceKey = mintKey();
    const raceLink = await requestLink(raceEmail, raceKey);
    await fetch(raceLink, { redirect: 'manual' });
    const [a, b] = await Promise.all([
      post('/api/auth/poll', { pollKey: raceKey }),
      post('/api/auth/poll', { pollKey: raceKey }),
    ]);
    const [ba, bb] = await Promise.all([a.json(), b.json()]);
    const readies = [ba, bb].filter((x) => x.status === 'ready').length;
    const cookies = [sessionCookieFrom(a), sessionCookieFrom(b)].filter(
      Boolean,
    ).length;
    check(
      'concurrent polls -> exactly one ready + one cookie',
      readies === 1 && cookies === 1,
      `readies=${readies} cookies=${cookies}`,
    );
    const raceUser = await pool.query(
      'select id from users where lower(email) = $1',
      [raceEmail],
    );
    const raceSess = await pool.query(
      'select count(*)::int as n from sessions where user_id = $1',
      [raceUser.rows[0].id],
    );
    check(
      'race total sessions == 2 (Safari + one PWA), no double-issue',
      raceSess.rows[0].n === 2,
      `sessions=${raceSess.rows[0].n}`,
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
      'desktop callback still 302 -> /me with session',
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
