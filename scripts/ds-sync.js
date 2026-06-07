#!/usr/bin/env node
/* ds-sync — apply design-system token values into the production CSS.

   Reads the manifest (source of truth) and rewrites ONLY the value of each
   token that already exists in assets/css, preserving file structure, inline
   comments, and the dark-mode indirection (dark tokens are stored as private
   --_dk-* values in theme-dark.css).

   - Light-scope tokens are patched in tokens.css, else theme-light.css.
   - Dark-scope tokens are patched as --_dk-<name> in theme-dark.css.
   - Tokens that don't yet exist in production are reported, never invented —
     adding a new token is a deliberate human decision (where, what role).

   Run after `ds:pull`. Validate with `ds:check`. Format with `fmt` afterwards.
*/

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MANIFEST = join(
  ROOT,
  'docs/design/design-system/project/_ds_manifest.json',
);
const CSS_DIR = join(ROOT, 'assets/css');
const DARK_SCOPE = '[data-theme="dark"]';

const normalize = (value) =>
  value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/(\.\d*?)0+(?=\D|$)/g, '$1')
    .replace(/\.(?=\D|$)/g, '');

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

// Replace the value of `name` in `css` if present; returns {css, old} or null.
const patch = (css, name, value) => {
  const re = new RegExp(`(${name}\\s*:\\s*)([^;]+)(;)`);
  const match = css.match(re);
  if (!match) return null;
  const old = match[2].trim();
  if (normalize(old) === normalize(value)) return { css, old, changed: false };
  return { css: css.replace(re, `$1${value}$3`), old, changed: true };
};

const main = () => {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));

  const files = {
    'tokens.css': readFileSync(join(CSS_DIR, 'tokens.css'), 'utf8'),
    'theme-light.css': readFileSync(join(CSS_DIR, 'theme-light.css'), 'utf8'),
    'theme-dark.css': readFileSync(join(CSS_DIR, 'theme-dark.css'), 'utf8'),
  };
  // Comment-stripped views are only used for presence checks.
  const has = (file, name) =>
    new RegExp(`${name}\\s*:`).test(stripComments(files[file]));

  const changes = [];
  const missing = [];

  for (const token of manifest.tokens) {
    const isDark = token.scope === DARK_SCOPE;
    const target = isDark ? '--_dk-' + token.name.slice(2) : token.name;

    let file;
    if (isDark) {
      file = 'theme-dark.css';
    } else if (has('tokens.css', target)) {
      file = 'tokens.css';
    } else {
      file = 'theme-light.css';
    }

    if (!has(file, target)) {
      missing.push(isDark ? `${token.name} (dark)` : token.name);
      continue;
    }

    const result = patch(files[file], target, token.value);
    if (result && result.changed) {
      files[file] = result.css;
      changes.push(`${file}  ${target}: ${result.old} → ${token.value}`);
    }
  }

  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(CSS_DIR, name), content);
  }

  if (changes.length === 0) {
    console.log('ds-sync: production CSS already matches the manifest ✓');
  } else {
    console.log(`ds-sync: applied ${changes.length} token value change(s):`);
    for (const line of changes) console.log('  ' + line);
    console.log('ds-sync: run `bun run fmt` then `bun run ds:check`.');
  }

  if (missing.length > 0) {
    console.log(
      `\nds-sync: ${missing.length} manifest token(s) not yet in production ` +
        '(add them deliberately — choose file & role):',
    );
    for (const name of missing) console.log('  ' + name);
  }
};

main();
