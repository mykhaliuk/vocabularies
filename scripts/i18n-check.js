#!/usr/bin/env node
/* i18n-check — keep the locale message catalogs and their usages in sync.

   Canon: i18n/locales/en.json (the default locale). Every other locale
   file must define exactly the same key set.

   Three guarantees:
   1. Key parity — a key present in en but missing in another locale (or
      present there but absent from en) fails with the exact key list.
   2. No empty messages — an empty string value in any locale is a
      forgotten translation and fails.
   3. Usage integrity — every literal t('…') / $t('…') key in app code
      must exist in en. Keys defined in en but never used are reported
      as a warning (allowed, like ds-check extensions).
*/

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const LOCALES_DIR = join(ROOT, 'i18n/locales');
const CANON = 'en.json';

// Roots scanned for t('…') / $t('…') usages in application code.
const CODE_ROOTS = [
  'app.vue',
  'error.vue',
  'components',
  'composables',
  'layouts',
  'middleware',
  'pages',
  'plugins',
  'utils',
  'shared',
];
const CODE_EXTENSIONS = ['.vue', '.ts', '.js'];

// A t( or $t( call not preceded by an identifier character, with a
// single-quoted literal first argument.
const USAGE_RE = /(?:^|[^\w$.])\$?t\(\s*'([^']+)'/g;

const flatten = (node, prefix, acc, invalid) => {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    if (typeof value === 'string') {
      acc.set(path, value);
    } else if (value !== null && typeof value === 'object') {
      flatten(value, path, acc, invalid);
    } else {
      invalid.push(path);
    }
  }
  return acc;
};

const readLocale = (file) => {
  const raw = readFileSync(join(LOCALES_DIR, file), 'utf8');
  const invalid = [];
  const keys = flatten(JSON.parse(raw), '', new Map(), invalid);
  return { keys, invalid };
};

const checkParity = () => {
  const files = readdirSync(LOCALES_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort();
  if (!files.includes(CANON)) {
    console.error(`i18n-check: canon locale ${CANON} not found`);
    process.exit(1);
  }

  const failures = [];
  const canon = readLocale(CANON);
  for (const path of canon.invalid) {
    failures.push(`INVALID  ${CANON}: ${path} — non-string leaf value`);
  }
  for (const [path, value] of canon.keys) {
    if (value.trim() === '') failures.push(`EMPTY    ${CANON}: ${path}`);
  }

  for (const file of files) {
    if (file === CANON) continue;
    const locale = readLocale(file);
    for (const path of locale.invalid) {
      failures.push(`INVALID  ${file}: ${path} — non-string leaf value`);
    }
    for (const path of canon.keys.keys()) {
      if (!locale.keys.has(path)) {
        failures.push(`MISSING  ${file}: ${path} — defined in ${CANON}`);
      }
    }
    for (const [path, value] of locale.keys) {
      if (!canon.keys.has(path)) {
        failures.push(`EXTRA    ${file}: ${path} — not defined in ${CANON}`);
      } else if (value.trim() === '') {
        failures.push(`EMPTY    ${file}: ${path}`);
      }
    }
  }

  return { failures, canonKeys: canon.keys };
};

const walkCode = (entry, acc) => {
  const abs = join(ROOT, entry);
  let entries;
  try {
    entries = readdirSync(abs, { withFileTypes: true });
  } catch {
    // Not a directory (a root like app.vue) or absent — treat as a file.
    if (CODE_EXTENSIONS.includes(extname(entry))) acc.push(entry);
    return acc;
  }
  for (const dirent of entries) {
    const child = join(entry, dirent.name);
    if (dirent.isDirectory()) {
      walkCode(child, acc);
    } else if (CODE_EXTENSIONS.includes(extname(dirent.name))) {
      acc.push(child);
    }
  }
  return acc;
};

// Line numbers are derived lazily: matches are rare next to total lines,
// so count newlines only up to each match instead of scanning per line.
const lineOf = (content, index) => {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (content.charCodeAt(i) === 10) line++;
  }
  return line;
};

const collectUsages = () => {
  const files = [];
  for (const root of CODE_ROOTS) walkCode(root, files);

  const usages = new Map();
  for (const rel of files) {
    const content = readFileSync(join(ROOT, rel), 'utf8');
    let match;
    USAGE_RE.lastIndex = 0;
    while ((match = USAGE_RE.exec(content)) !== null) {
      const key = match[1];
      let sites = usages.get(key);
      if (!sites) {
        sites = [];
        usages.set(key, sites);
      }
      sites.push(`${rel}:${lineOf(content, match.index)}`);
    }
  }
  return usages;
};

const main = () => {
  const { failures, canonKeys } = checkParity();
  const usages = collectUsages();

  for (const [key, sites] of usages) {
    if (!canonKeys.has(key)) {
      for (const site of sites) {
        failures.push(`UNKNOWN  ${site}  t('${key}') — key not in ${CANON}`);
      }
    }
  }

  const unused = [];
  for (const key of canonKeys.keys()) {
    if (!usages.has(key)) unused.push(key);
  }
  if (unused.length > 0) {
    console.log(
      `i18n-check: ${unused.length} defined-but-unused key(s) (allowed): ` +
        unused.join(', '),
    );
  }

  if (failures.length > 0) {
    console.error(`\ni18n-check: ${failures.length} failure(s):`);
    for (const line of failures.sort()) console.error('  ' + line);
    process.exit(1);
  }

  console.log(
    `i18n-check: ${canonKeys.size} key(s) consistent across locales, ` +
      `${usages.size} used in code ✓`,
  );
};

main();
