#!/usr/bin/env node
/* layering-check — enforce the server layering contract (ADR-0010).

   Transport (every request-facing Nitro surface: server/api, server/routes,
   server/middleware, server/plugins) never touches the db: no useDb()
   calls, no db/schema imports, no drizzle-orm imports — static or dynamic,
   whatever the alias (~/, ~~/, @/, relative). Every db access lives in a
   domain operation (server/domain) instead. Unconditional since VKB-90:
   the pre-ADR allowlist shrank to zero and its machinery is gone.

   Known limit: the guard is lexical. Transitive access through an infra
   helper is invisible here; since VKB-87 server/utils carries no db
   access, so that gap is closed by construction, and review keeps it so.
*/

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const TRANSPORT_ROOTS = [
  'server/api',
  'server/routes',
  'server/middleware',
  'server/plugins',
];
// Mirrors Nitro's handler glob (js, mjs, cjs, ts, mts, cts, tsx, jsx).
const CODE_EXTENSION_RE = /\.(?:m|c)?(?:j|t)sx?$/;

// Any of these in a transport file is a db touch. Specifiers are matched
// as quoted substrings so every alias spelling and dynamic import() is
// caught; useDb is also matched as a bare call because Nitro auto-imports
// it, and an import line from the db util catches aliased bindings
// (import { useDb as getDb }).
const DB_PATTERNS = [
  { label: 'useDb() call', re: /\buseDb\s*\(/ },
  { label: 'db schema import', re: /['"][^'"]*\bdb\/schema/ },
  { label: 'drizzle-orm import', re: /['"]drizzle-orm/ },
  { label: 'db util import', re: /['"][^'"]*\butils\/db['"]/ },
];

const walk = (relDir, acc) => {
  let entries;
  try {
    entries = readdirSync(join(ROOT, relDir), { withFileTypes: true });
  } catch {
    return acc; // Root absent (e.g. server/routes does not exist yet).
  }
  for (const dirent of entries) {
    const child = `${relDir}/${dirent.name}`;
    if (dirent.isDirectory()) {
      walk(child, acc);
    } else if (CODE_EXTENSION_RE.test(dirent.name)) {
      acc.push(child);
    }
  }
  return acc;
};

// Line comments are stripped before matching so prose like
// "never call useDb() here" cannot fail the check. The `\s` guard keeps
// protocol separators ("https://…") intact.
const stripLineComment = (line) => line.replace(/(^|\s)\/\/.*$/, '$1');

const findHits = (relFile) => {
  const lines = readFileSync(join(ROOT, relFile), 'utf8').split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const code = stripLineComment(lines[i]);
    for (const pattern of DB_PATTERNS) {
      if (pattern.re.test(code)) {
        hits.push({ line: i + 1, label: pattern.label });
      }
    }
  }
  return hits;
};

const main = () => {
  const files = [];
  for (const root of TRANSPORT_ROOTS) walk(root, files);
  files.sort();

  const failures = [];
  for (const relFile of files) {
    for (const hit of findHits(relFile)) {
      failures.push(
        `VIOLATION  ${relFile}:${hit.line} — ${hit.label}; ` +
          'move the db access into a domain operation (ADR-0010)',
      );
    }
  }

  if (failures.length > 0) {
    console.error(`\nlayering-check: ${failures.length} failure(s):`);
    for (const line of failures.sort()) console.error('  ' + line);
    process.exit(1);
  }

  console.log(`layering-check: ${files.length} transport file(s) clean ✓`);
};

main();
