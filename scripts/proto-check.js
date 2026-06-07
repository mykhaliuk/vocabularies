#!/usr/bin/env node
/* proto-check — bind the prototype to the design system.

   The prototype (docs/design/prototype) is a separate Claude Design export
   that embeds its OWN copy of the design system under _ds/<id>/. That copy
   can lag behind the canonical design-system bundle. The prototype patches
   any gap with `ds-bridge.css` — so the prototype's EFFECTIVE token set is
   (embedded DS) + (bridge).

   Checked against the single contract (design-system/project/_ds_manifest.json):

   - DRIFT: the embedded DS defines a token with a different value than canon
     → real disagreement in the bound DS → exit 1.
   - COVERED: a canon token the embedded DS lacks but ds-bridge.css supplies
     at the canon value → the prototype renders correctly; re-bind its DS in
     Claude Design to make it native, then drop the bridge. Reported.
   - BRIDGE-MISMATCH: a canon token the bridge supplies at a DIFFERENT value
     → reported (e.g. a fallback-only difference).
   - GAP: a canon token neither the embedded DS nor the bridge provides.
   - REDUNDANT BRIDGE: a bridge line the embedded DS now also defines → dead.
   - ORPHAN BRIDGE: a bridge token canon doesn't know about.

   Only DRIFT fails the build; the rest is actionable reporting, because the
   prototype's embedded DS is re-bound in Claude Design, not here.
*/

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DESIGN = join(ROOT, 'docs/design');
const CANON = join(DESIGN, 'design-system/project/_ds_manifest.json');
const PROTO_DS_DIR = join(DESIGN, 'prototype/project/_ds');
const BRIDGE = join(DESIGN, 'prototype/project/Vocabu/ds-bridge.css');

const DARK_SCOPE = '[data-theme="dark"]';

const normalize = (value) =>
  value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/(\.\d*?)0+(?=\D|$)/g, '$1')
    .replace(/\.(?=\D|$)/g, '');

const eq = (a, b) => normalize(a) === normalize(b);

const protoTokenMap = (manifestPath) => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const map = new Map();
  for (const token of manifest.tokens) {
    const k = (token.scope === DARK_SCOPE ? 'dark:' : '') + token.name;
    map.set(k, token.value);
  }
  return map;
};

const findProtoManifest = () => {
  if (!existsSync(PROTO_DS_DIR)) return null;
  for (const entry of readdirSync(PROTO_DS_DIR)) {
    const candidate = join(PROTO_DS_DIR, entry, '_ds_manifest.json');
    if (existsSync(candidate)) return candidate;
  }
  return null;
};

const bridgeTokens = () => {
  if (!existsSync(BRIDGE)) return new Map();
  const css = readFileSync(BRIDGE, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const map = new Map();
  const re = /(--[\w-]+)\s*:\s*([^;]+);/g;
  let match;
  while ((match = re.exec(css)) !== null) map.set(match[1], match[2].trim());
  return map;
};

const report = (head, items, mark) => {
  if (items.length === 0) return;
  console.log(`\nproto-check: ${head}`);
  for (const line of items) console.log(`  ${mark} ${line}`);
};

const main = () => {
  const protoManifest = findProtoManifest();
  if (!protoManifest) {
    console.log('proto-check: no embedded DS in the prototype — skipping.');
    return;
  }

  const canonTokens = JSON.parse(readFileSync(CANON, 'utf8')).tokens;
  const proto = protoTokenMap(protoManifest);
  const bridge = bridgeTokens();

  const drift = [];
  const covered = [];
  const bridgeMismatch = [];
  const gap = [];

  for (const token of canonTokens) {
    const isDark = token.scope === DARK_SCOPE;
    const k = (isDark ? 'dark:' : '') + token.name;
    const label = isDark ? `${token.name} (dark)` : token.name;

    if (proto.has(k)) {
      if (!eq(proto.get(k), token.value)) {
        drift.push(
          `${label} — canon ${token.value} ≠ prototype ${proto.get(k)}`,
        );
      }
      continue;
    }
    // Missing from the embedded DS — is the gap patched by the bridge?
    if (!isDark && bridge.has(token.name)) {
      if (eq(bridge.get(token.name), token.value)) {
        covered.push(token.name);
      } else {
        bridgeMismatch.push(
          `${token.name} — canon ${token.value} ≠ bridge ${bridge.get(token.name)}`,
        );
      }
    } else {
      gap.push(label);
    }
  }

  const canonNames = new Set(canonTokens.map((t) => t.name));
  const redundant = [];
  const orphan = [];
  for (const name of bridge.keys()) {
    if (proto.has(name)) redundant.push(name);
    else if (!canonNames.has(name)) orphan.push(name);
  }

  report(
    `${covered.length} canon token(s) the embedded DS lacks but ds-bridge.css ` +
      'covers (re-bind the prototype DS in Claude Design, then delete the ' +
      'bridge):',
    covered,
    'COVERED',
  );
  report(
    `${bridgeMismatch.length} token(s) the bridge supplies at a different ` +
      'value than canon:',
    bridgeMismatch,
    'BRIDGE≠',
  );
  report(
    `${gap.length} canon token(s) absent from both the embedded DS and the ` +
      'bridge:',
    gap,
    'GAP',
  );
  report(
    `${redundant.length} dead ds-bridge.css line(s) (embedded DS now defines ` +
      'these — remove them):',
    redundant,
    'REDUNDANT',
  );
  report(
    `${orphan.length} ds-bridge.css token(s) unknown to canon:`,
    orphan,
    'ORPHAN',
  );

  if (drift.length > 0) {
    console.error(
      `\nproto-check: ${drift.length} value drift(s) in the prototype's bound ` +
        'DS (real disagreement with the contract):',
    );
    for (const line of drift) console.error('  DRIFT  ' + line);
    process.exit(1);
  }

  const clean =
    covered.length === 0 &&
    bridgeMismatch.length === 0 &&
    gap.length === 0 &&
    redundant.length === 0 &&
    orphan.length === 0;

  console.log(
    clean
      ? 'proto-check: prototype is in sync with the design system ✓'
      : '\nproto-check: no value drift — prototype renders the contract ✓',
  );
};

main();
