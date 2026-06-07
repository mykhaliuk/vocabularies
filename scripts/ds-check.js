#!/usr/bin/env node
/* ds-check — keep the production CSS in sync with the browser-authored
   design system.

   Source of truth: docs/design/design-system/project/_ds_manifest.json
   (a snapshot exported from the browser DS — Vocabu design system).

   Two guarantees:
   1. Token parity — every token the manifest defines must exist in the
      production CSS with the same value. Light-scope tokens live in
      assets/css/{tokens,theme-light}.css; dark-scope tokens live in
      theme-dark.css as private --_dk-* values. Production MAY add its own
      tokens (e.g. --font-hand: Caveat) — extensions are allowed, only
      contradictions fail.
   2. Token adherence — application code (.vue) and non-token CSS must not
      hard-code hex colors; they reference design-system tokens via var().
      Annotate a deliberate exception with a `ds-allow-hex` comment.
*/

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MANIFEST = join(
  ROOT,
  'docs/design/design-system/project/_ds_manifest.json',
);
const CSS_DIR = join(ROOT, 'assets/css');

const DARK_SCOPE = '[data-theme="dark"]';
const DARK_PREFIX = '--_dk-';

// Files that DEFINE tokens — literals are expected and allowed here.
const TOKEN_FILES = ['tokens.css', 'theme-light.css', 'theme-dark.css'];

// Non-token CSS that must use var() instead of raw hex.
const APP_CSS = ['animations.css', 'base.css', 'typography.css'];

// Roots scanned for raw hex in application markup.
const VUE_ROOTS = ['app.vue', 'error.vue', 'components', 'pages', 'layouts'];

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/;

const normalize = (value) =>
  value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/(\.\d*?)0+(?=\D|$)/g, '$1')
    .replace(/\.(?=\D|$)/g, '');

const parseDeclarations = (css) => {
  const map = new Map();
  // Strip comments first so prose mentioning `--token:` is never parsed
  // as a declaration.
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = re.exec(stripped)) !== null) {
    const name = match[1];
    const value = match[2].trim();
    // Last write wins — mirrors the CSS cascade within a file set.
    map.set(name, value);
  }
  return map;
};

const readCss = (name) => readFileSync(join(CSS_DIR, name), 'utf8');

const collectProdTokens = () => {
  const light = new Map();
  for (const file of ['tokens.css', 'theme-light.css']) {
    for (const [name, value] of parseDeclarations(readCss(file))) {
      if (!name.startsWith(DARK_PREFIX)) light.set(name, value);
    }
  }
  const dark = new Map();
  for (const [name, value] of parseDeclarations(readCss('theme-dark.css'))) {
    if (name.startsWith(DARK_PREFIX)) {
      dark.set('--' + name.slice(DARK_PREFIX.length), value);
    }
  }
  return { light, dark };
};

const checkParity = () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const { light: prodLight, dark: prodDark } = collectProdTokens();

  const failures = [];
  const seenManifest = new Set();

  for (const token of manifest.tokens) {
    const isDark = token.scope === DARK_SCOPE;
    const prod = isDark ? prodDark : prodLight;
    const label = isDark ? `${token.name} (dark)` : token.name;
    if (!isDark) seenManifest.add(token.name);

    if (!prod.has(token.name)) {
      failures.push(`MISSING  ${label} — not defined in production CSS`);
      continue;
    }
    const expected = normalize(token.value);
    const actual = normalize(prod.get(token.name));
    if (expected !== actual) {
      failures.push(
        `MISMATCH ${label} — manifest ${token.value} ` +
          `≠ prod ${prod.get(token.name)}`,
      );
    }
  }

  const extensions = [];
  for (const name of prodLight.keys()) {
    if (!seenManifest.has(name)) extensions.push(name);
  }

  return { failures, extensions };
};

const walkVue = (entry, acc) => {
  const abs = join(ROOT, entry);
  let stat;
  try {
    stat = statSync(abs);
  } catch {
    return acc;
  }
  if (stat.isDirectory()) {
    for (const child of readdirSync(abs)) {
      walkVue(join(entry, child), acc);
    }
  } else if (entry.endsWith('.vue')) {
    acc.push(entry);
  }
  return acc;
};

const checkAdherence = () => {
  const files = [];
  for (const root of VUE_ROOTS) walkVue(root, files);
  for (const css of APP_CSS) files.push(join('assets/css', css));

  const violations = [];
  for (const rel of files) {
    if (TOKEN_FILES.includes(basename(rel))) continue;
    let content;
    try {
      content = readFileSync(join(ROOT, rel), 'utf8');
    } catch {
      continue;
    }
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('ds-allow-hex')) continue;
      if (HEX_RE.test(line)) {
        violations.push(`${rel}:${i + 1}  ${line.trim()}`);
      }
    }
  }
  return violations;
};

const main = () => {
  const { failures, extensions } = checkParity();
  const violations = checkAdherence();

  if (extensions.length > 0) {
    console.log(
      `ds-check: ${extensions.length} production-only token(s) (allowed): ` +
        extensions.join(', '),
    );
  }

  let failed = false;

  if (failures.length > 0) {
    failed = true;
    console.error(`\nds-check: ${failures.length} token parity failure(s):`);
    for (const line of failures) console.error('  ' + line);
  }

  if (violations.length > 0) {
    failed = true;
    console.error(
      `\nds-check: ${violations.length} raw-hex adherence violation(s) ` +
        '(use a var() token, or annotate with `ds-allow-hex`):',
    );
    for (const line of violations) console.error('  ' + line);
  }

  if (failed) process.exit(1);

  console.log('ds-check: production CSS is in sync with the design system ✓');
};

main();
