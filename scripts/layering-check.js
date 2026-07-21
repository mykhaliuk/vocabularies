#!/usr/bin/env node
/* layering-check — enforce the server layering contract (ADR-0010).

   Transport (server/api, server/middleware) never touches the db: no
   useDb() calls, no ~/db/schema imports, no drizzle-orm imports. Every
   db access lives in a domain operation (server/domain) instead.

   Routes written before the decision are grandfathered in
   LEGACY_ALLOWLIST. The list only shrinks: an entry that is clean or
   deleted fails the check until the line is removed, and new files are
   never added.
*/

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const TRANSPORT_ROOTS = ['server/api', 'server/middleware'];
const CODE_EXTENSIONS = new Set(['.ts', '.js']);

// Grandfathered pre-ADR-0010 routes. Shrink-only: remove a line when the
// file's db access moves into a domain operation. Never add to this list.
const LEGACY_ALLOWLIST = new Set([
  'server/api/auth/callback.get.ts',
  'server/api/auth/confirm.post.ts',
  'server/api/auth/logout.post.ts',
  'server/api/auth/magic-link.post.ts',
  'server/api/auth/poll.post.ts',
  'server/api/health.get.ts',
  'server/api/me/avatar/confirm.post.ts',
  'server/api/me/index.patch.ts',
]);

// Any of these in a transport file is a db touch. useDb is matched as a
// call because Nitro auto-imports it — an import line is not required.
const DB_PATTERNS = [
  { label: 'useDb() call', re: /\buseDb\s*\(/ },
  { label: 'db schema import', re: /from\s+['"]~\/db\/schema/ },
  { label: 'drizzle-orm import', re: /from\s+['"]drizzle-orm/ },
  { label: 'db util import', re: /from\s+['"][^'"]*server\/utils\/db['"]/ },
];

const walk = (relDir, acc) => {
  let entries;
  try {
    entries = readdirSync(join(ROOT, relDir), { withFileTypes: true });
  } catch {
    return acc; // Root absent (server/middleware does not exist yet).
  }
  for (const dirent of entries) {
    const child = join(relDir, dirent.name);
    if (dirent.isDirectory()) {
      walk(child, acc);
    } else if (CODE_EXTENSIONS.has(extname(dirent.name))) {
      acc.push(child);
    }
  }
  return acc;
};

const findHits = (relFile) => {
  const lines = readFileSync(join(ROOT, relFile), 'utf8').split('\n');
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of DB_PATTERNS) {
      if (pattern.re.test(lines[i])) {
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
  const seen = new Set();
  let grandfathered = 0;

  for (const relFile of files) {
    seen.add(relFile);
    const hits = findHits(relFile);
    const allowlisted = LEGACY_ALLOWLIST.has(relFile);
    if (hits.length > 0 && !allowlisted) {
      for (const hit of hits) {
        failures.push(
          `VIOLATION  ${relFile}:${hit.line} — ${hit.label}; ` +
            'move the db access into a domain operation (ADR-0010)',
        );
      }
    } else if (hits.length === 0 && allowlisted) {
      failures.push(
        `REDUNDANT  allowlist entry ${relFile} — now clean, remove the line`,
      );
    } else if (allowlisted) {
      grandfathered++;
    }
  }

  for (const relFile of LEGACY_ALLOWLIST) {
    if (!seen.has(relFile)) {
      failures.push(
        `STALE      allowlist entry ${relFile} — file gone, remove the line`,
      );
    }
  }

  if (failures.length > 0) {
    console.error(`\nlayering-check: ${failures.length} failure(s):`);
    for (const line of failures.sort()) console.error('  ' + line);
    process.exit(1);
  }

  console.log(
    `layering-check: ${files.length} transport file(s) clean, ` +
      `${grandfathered} grandfathered ✓`,
  );
};

main();
