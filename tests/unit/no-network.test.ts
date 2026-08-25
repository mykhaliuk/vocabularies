import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';

// The guard's value is entirely in what it refuses, so each case runs the real
// preload in a real node process. A guard trusted rather than tested is how a
// "no network" claim quietly becomes a "no fetch" claim.
const PRELOAD = fileURLToPath(
  new URL('../../scripts/no-network.mjs', import.meta.url),
);

const run = (source: string) => {
  const result = Bun.spawnSync(['node', '--import', PRELOAD, '-e', source], {
    cwd: tmpdir(),
    env: { PATH: process.env.PATH ?? '' },
  });
  return `${result.stdout.toString()}${result.stderr.toString()}`;
};

const REFUSED = /\[no-network\] this process reached out to/;

describe('no-network preload', () => {
  test('refuses fetch to a third party', () => {
    const out = run(
      `fetch('https://fonts.gstatic.com/x.woff2').catch(e => console.log(e.message))`,
    );
    expect(out).toMatch(REFUSED);
  });

  test('refuses https.get, which fetch-only guards miss', () => {
    const out = run(
      `import('node:https').then(({default: https}) => { try { https.get('https://fonts.gstatic.com/x.woff2') } catch (e) { console.log(e.message) } })`,
    );
    expect(out).toMatch(REFUSED);
  });

  test('refuses http.request given an options object', () => {
    const out = run(
      `import('node:http').then(({default: http}) => { try { http.request({ hostname: 'example.com', path: '/' }) } catch (e) { console.log(e.message) } })`,
    );
    expect(out).toMatch(REFUSED);
  });

  test('leaves loopback alone — blocking it would prove nothing', () => {
    const out = run(
      `import('node:http').then(({default: http}) => { const r = http.request({ hostname: '127.0.0.1', port: 1, path: '/' }); r.on('error', () => console.log('LOCAL-ALLOWED')); r.end() })`,
    );
    expect(out).toContain('LOCAL-ALLOWED');
    expect(out).not.toMatch(REFUSED);
  });
});
