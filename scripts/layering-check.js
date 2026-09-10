#!/usr/bin/env node
// @ts-nocheck — JS CLI script run by node; it only enters vue-tsc's checked
// graph via the tests/unit/layering-check.test.ts import, and runtime
// behavior there is pinned by that spec, not by static types.
/* layering-check — enforce the module boundary, in both directions.

   Inwards (ADR-0010): transport (every request-facing Nitro surface —
   server/api, server/routes, server/middleware, server/plugins) never
   touches the db: no useDb() calls, no db/schema imports, no drizzle-orm
   imports — static or dynamic, whatever the alias (~/, ~~/, @/, relative).
   Every db access lives in a domain operation (server/domain) instead.
   Unconditional since VKB-90: the pre-ADR allowlist shrank to zero and its
   machinery is gone.

   Outwards (VKB-181): client code never imports a server or db module for
   anything but types. Those modules pull the AWS SDK transitively, and the
   `type` keyword is the only thing keeping it out of the browser bundle —
   drop it on one line and the S3 client ships to _nuxt. That half is
   statement-aware rather than line-based, because an import here already
   spans four lines with `from` on the last one.

   Known limit: the guard is lexical, in both directions. Transitive access
   through a helper is invisible here; since VKB-87 server/utils carries no
   db access, so that gap is closed by construction, and review keeps it so.
*/

import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const TRANSPORT_ROOTS = [
  'server/api',
  'server/routes',
  'server/middleware',
  'server/plugins',
];
// Directories are a denylist for the same reason root files are: an
// allowlist is a list someone forgets to extend, and the miss is silent. A
// new bundled top-level directory is scanned by default; the ones below are
// the halves of this boundary itself plus everything that runs in node or
// never ships.
const DIRS_NOT_BUNDLED = new Set([
  'node_modules',
  '.nuxt',
  '.output',
  '.git',
  '.claude',
  '.github',
  'server',
  'db',
  'scripts',
  'providers',
  'tests',
  'e2e',
  'docs',
  'openspec',
  'dist',
  'coverage',
  'test-results',
  'playwright-report',
  'tmp',
]);
// Root-level files are scanned by DEFAULT and excluded by name, not the
// other way round. A hand-kept list of client entry points is a list someone
// forgets to extend, and the miss is silent — which is how
// sentry.client.config.js sat here value-importing from server/utils while
// this very check reported the tree clean. Excluded below are the files that
// run in node and never reach a browser.
const ROOT_FILES_NOT_BUNDLED = new Set([
  'nuxt.config.js',
  'drizzle.config.js',
  'fonts.config.js',
  'playwright.config.ts',
  'playwright.authed.config.ts',
  'sentry.server.config.js',
]);
// Mirrors Nitro's handler glob (js, mjs, cjs, ts, mts, cts, tsx, jsx).
const CODE_EXTENSION_RE = /\.(?:m|c)?(?:j|t)sx?$/;
// Client files are mostly .vue, where the imports sit in <script setup>.
const CLIENT_EXTENSION_RE = /\.vue$|\.(?:m|c)?(?:j|t)sx?$/;

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

// A specifier reaches the server tree only if it RESOLVES there. Matching a
// `server/` or `db/` segment anywhere is too loose: `~/utils/db/local`, an
// IndexedDB store this PWA could plausibly grow, has nothing to do with the
// schema, and making its author write an allow-annotation would hollow the
// annotation out.
//
// Aliases are repo-root-relative, so the segment has to come first. Relative
// specifiers are resolved against the importing file, which is why that path
// is passed in; without one the check falls back to the loose test, since a
// classifier called with no context should over-report rather than under.
const ALIAS_PREFIX_RE = /^(?:~{1,2}|@{1,2})\//;
const SERVER_ALIAS_RE = /^#server(?:\/|$)/;
const RELATIVE_PREFIX_RE = /^\.{1,2}\//;
// `(?:/|$)` because `~/db` and `~/server` are barrel imports of the same
// trees; demanding a slash let them through.
const SERVER_ROOT_RE = /^(?:server|db)(?:\/|$)/;
const SERVER_SEGMENT_RE = /(?:^|\/)(?:server|db)\//;

const normalizePath = (path) => {
  const out = [];
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
};

const isServerSpecifier = (specifier, relFile) => {
  // `#server/…` names the tree in the alias itself; the root test below looks
  // for a leading `server/`, which that spelling never has.
  if (SERVER_ALIAS_RE.test(specifier)) return true;
  if (ALIAS_PREFIX_RE.test(specifier)) {
    return SERVER_ROOT_RE.test(specifier.replace(ALIAS_PREFIX_RE, ''));
  }
  if (!RELATIVE_PREFIX_RE.test(specifier)) return false;
  if (!relFile) return SERVER_SEGMENT_RE.test(specifier);
  const dir = relFile.includes('/')
    ? relFile.slice(0, relFile.lastIndexOf('/'))
    : '';
  return SERVER_ROOT_RE.test(normalizePath(`${dir}/${specifier}`));
};

const walk = (relDir, acc, extensionRe) => {
  let entries;
  try {
    entries = readdirSync(join(ROOT, relDir), { withFileTypes: true });
  } catch {
    return acc; // Root absent (e.g. server/routes does not exist yet).
  }
  for (const dirent of entries) {
    const child = `${relDir}/${dirent.name}`;
    if (dirent.isDirectory()) {
      walk(child, acc, extensionRe);
    } else if (extensionRe.test(dirent.name)) {
      acc.push(child);
    }
  }
  return acc;
};

// Line comments are stripped before matching so prose like
// "never call useDb() here" cannot fail the check. The `\s` guard keeps
// protocol separators ("https://…") intact.
const stripLineComment = (line) => line.replace(/(^|\s)\/\/.*$/, '$1');

const findDbHits = (source) => {
  const lines = source.split('\n');
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

// Block comments go too for the statement scan: a commented-out import is
// still an import statement to a regex. Only ones that OPEN a line are
// stripped — `'**/*.ts'` mid-line in a string opens nothing, and treating it
// as a comment would blank everything up to the next `*/` and hide real
// imports there. Newlines are kept so reported line numbers stay true.
//
// The remaining hole is deliberate, and it is the cheaper of two: a template
// literal whose own content has a line starting with `/*` pairs with a later
// `*/`, and an import between them is missed. Requiring every line of the
// block to look like a comment would close it and break the ordinary case —
// a commented-out block of imports, whose inner lines are plain code — with
// a false CI failure on compliant work. A regex cannot tell a comment from
// text shaped like one; this is the lexical limit the header states, not an
// oversight.
const stripComments = (source) =>
  source
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, (block) =>
      block.replace(/[^\n]/g, ''),
    )
    .split('\n')
    .map(stripLineComment)
    .join('\n');

// Statements are sliced apart before anything is matched inside them, which
// is the only reliable way to keep one from swallowing the next. A single
// lazy regex cannot: `export type { A }` with no semicolon runs on to the
// following import's `from`, and the merged clause still reads as type-only,
// so a real value import passes AND is consumed before it can be matched on
// its own. A statement starts at a line start or just after a semicolon —
// the second because `import a from 'x'; import b from '~/server/y';` on one
// line would otherwise hide the half that matters.
const STATEMENT_START_RE = /(?:^|;|\*\/)[ \t]*(?=(?:import|export)\b)/gm;

const sliceStatements = (code) => {
  const starts = [...code.matchAll(STATEMENT_START_RE)].map(
    (m) => m.index + m[0].length,
  );
  return starts.map((start, i) => ({
    start,
    text: code.slice(start, starts[i + 1] ?? code.length),
  }));
};

// Within one statement the lazy match is safe; `[^;=]` still bounds it so a
// `from` inside a value expression cannot be mistaken for a specifier.
// The clause excludes quotes as well as `;` and `=`: an import clause
// contains neither, and without them a bare `export { x }` could reach a
// `from '…'` sitting inside a string on a later line.
const FROM_RE =
  /^[ \t]*(?:import|export)\b([^;='"`]*?)\bfrom\s*['"]([^'"]+)['"]/;
const SIDE_EFFECT_RE = /^[ \t]*import\s*['"]([^'"]+)['"]/;
// Backticks included: a template-literal specifier resolves the same, and
// would otherwise slip past a check whose header promises dynamic imports
// fail.
// No closing paren required: `import('~/db/x', { with: … })` is the same
// escape, and demanding `)` right after the specifier silently missed it.
const COMMENT_OR_SPACE = '(?:\\s|/\\*[\\s\\S]*?\\*/)*';
const DYNAMIC_RE = new RegExp(
  `\\bimport\\s*\\(${COMMENT_OR_SPACE}['"\`]([^'"\`]+)['"\`]`,
  'g',
);
// Vite's glob import pulls every match into the bundle, so a pattern reaching
// into server/ is the same escape by another spelling.
const GLOB_RE = new RegExp(
  `\\bimport\\.meta\\.glob\\s*\\(${COMMENT_OR_SPACE}['"\`]([^'"\`]+)['"\`]`,
  'g',
);
// The escape hatch, spelled like the capability graph's annotations. It must
// carry a reason, and it goes stale on its own: left on a line that no longer
// violates, it is noise the next reader deletes.
const ALLOW_RE = /(?:\/\/|\/\*)[^\n]*\blayering-allow:\s*\S/;

// Does this clause bring anything across that survives compilation?
// `import type …` and `export type …` erase wholesale. Inline modifiers
// erase per binding, so a braces-only clause passes when EVERY binding
// carries one — `{ type A, b }` still ships `b`. Anything outside the
// braces (a default or a namespace) is a value by definition.
const isTypeOnlyClause = (clause) => {
  const text = clause.trim();
  // `type` must QUALIFY something. Bare `import type from '…'` is a default
  // import of a value that happens to be called type, and it erases nothing.
  if (/^type\s+\S/.test(text)) return true;
  const braces = /^\{([\s\S]*)\}$/.exec(text);
  if (!braces) return false;
  // `import {} from 'x'` evaluates the module exactly like a side-effect
  // import, so an empty clause is not type-only however vacuously `every`
  // would agree.
  if (braces[1].trim() === '') return false;
  return (
    braces[1]
      .split(',')
      .map((binding) => binding.trim())
      .filter((binding) => binding.length > 0)
      // Same trap one level down: `{ type as kind }` renames a value called
      // type; `{ type A }` and `{ type A as B }` are the erasable ones.
      .every((binding) => /^type\s+(?!as\b)\S/.test(binding))
  );
};

const lineOf = (code, index) => code.slice(0, index).split('\n').length;

// Exported for tests/unit/layering-check.test.ts: a guard whose own logic is
// untested is the thing VKB-181 was filed about.
export const findServerImportHits = (source, relFile = '') => {
  const code = stripComments(source);
  // The annotation lives in a comment, so it is read off the ORIGINAL lines,
  // which stripComments has just blanked.
  const original = source.split('\n');
  // On any line of the statement, or on a line of its own above it. The
  // "line above" must be a STAND-ALONE comment: a trailing annotation
  // belongs to the import it sits on, and letting it reach downwards meant
  // one allowed import silently excused the next.
  const isOwnLine = (raw) =>
    raw !== undefined &&
    stripLineComment(raw).trim() === '' &&
    ALLOW_RE.test(raw);
  const allowed = (line, endLine) => {
    if (isOwnLine(original[line - 2])) return true;
    for (let i = line; i <= endLine; i++) {
      if (ALLOW_RE.test(original[i - 1] ?? '')) return true;
    }
    return false;
  };
  const hits = [];

  const add = (line, specifier, kind, endLine = line) => {
    if (!isServerSpecifier(specifier, relFile) || allowed(line, endLine)) {
      return;
    }
    hits.push({ line, specifier, kind });
  };

  for (const statement of sliceStatements(code)) {
    const line = lineOf(code, statement.start);
    const from = FROM_RE.exec(statement.text);
    if (from) {
      const endLine = line + from[0].split('\n').length - 1;
      if (!isTypeOnlyClause(from[1])) {
        add(line, from[2], 'value import', endLine);
      }
      continue;
    }
    const sideEffect = SIDE_EFFECT_RE.exec(statement.text);
    if (sideEffect) add(line, sideEffect[1], 'side-effect import');
  }

  // Dynamic and glob imports are expressions, not statements, so they are
  // found over the whole file rather than inside a slice.
  for (const match of code.matchAll(DYNAMIC_RE)) {
    add(lineOf(code, match.index), match[1], 'dynamic import');
  }
  for (const match of code.matchAll(GLOB_RE)) {
    add(lineOf(code, match.index), match[1], 'glob import');
  }

  return hits.sort((a, b) => a.line - b.line);
};

const main = () => {
  const failures = [];

  const transportFiles = [];
  for (const root of TRANSPORT_ROOTS) {
    walk(root, transportFiles, CODE_EXTENSION_RE);
  }
  transportFiles.sort();
  for (const relFile of transportFiles) {
    const source = readFileSync(join(ROOT, relFile), 'utf8');
    for (const hit of findDbHits(source)) {
      failures.push(
        `VIOLATION  ${relFile}:${hit.line} — ${hit.label}; ` +
          'move the db access into a domain operation (ADR-0010)',
      );
    }
  }

  const clientFiles = [];
  for (const dirent of readdirSync(ROOT, { withFileTypes: true })) {
    if (dirent.isDirectory()) {
      if (DIRS_NOT_BUNDLED.has(dirent.name)) continue;
      walk(dirent.name, clientFiles, CLIENT_EXTENSION_RE);
    } else if (
      CLIENT_EXTENSION_RE.test(dirent.name) &&
      !ROOT_FILES_NOT_BUNDLED.has(dirent.name)
    ) {
      clientFiles.push(dirent.name);
    }
  }
  clientFiles.sort();
  for (const relFile of clientFiles) {
    const source = readFileSync(join(ROOT, relFile), 'utf8');
    for (const hit of findServerImportHits(source, relFile)) {
      failures.push(
        `VIOLATION  ${relFile}:${hit.line} — ${hit.kind} of '${hit.specifier}'; ` +
          'client code may take TYPES from server/ and db/ and nothing else, ' +
          'or the AWS SDK ships in the browser bundle (VKB-181)',
      );
    }
  }

  if (failures.length > 0) {
    console.error(`\nlayering-check: ${failures.length} failure(s):`);
    for (const line of failures.sort()) console.error('  ' + line);
    process.exit(1);
  }

  console.log(
    `layering-check: ${transportFiles.length} transport + ` +
      `${clientFiles.length} client file(s) clean ✓`,
  );
};

// Importing this module for the classifier must not run the walk.
// realpath on both sides: import.meta.filename is already resolved by the
// ESM loader, so comparing it to a symlinked argv[1] silently skipped main()
// and printed nothing at all — a green check that scanned zero files.
if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(import.meta.filename)
) {
  main();
}
