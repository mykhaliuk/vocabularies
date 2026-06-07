#!/usr/bin/env node
/* proto-check — bind the prototype to the design system.

   The prototype (docs/design/prototype) is a separate Claude Design export
   that embeds its OWN copy of the design system under _ds/<id>/. That copy
   can lag behind the canonical design-system bundle, and the prototype may
   carry temporary `ds-bridge.css` shims for tokens the DS hadn't shipped yet.

   This checks the prototype leg of the triad against the single contract
   (design-system/project/_ds_manifest.json):

   - CONTRADICTION: a token the prototype defines with a different value than
     canon → real drift → exit 1.
   - STALE: a canon token missing from the prototype's embedded DS → the
     prototype is behind; re-sync its DS dependency in Claude Design and
     re-export. Reported, non-fatal.
   - OBSOLETE BRIDGE: a token defined in ds-bridge.css that canon now ships
     with the same value → delete the bridge (and its <link>s). Reported.
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

const key = (token) => (token.scope === DARK_SCOPE ? 'dark:' : '') + token.name;

const tokenMap = (manifestPath) => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const map = new Map();
  for (const token of manifest.tokens) map.set(key(token), token.value);
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
  while ((match = re.exec(css)) !== null) {
    map.set(match[1], match[2].trim());
  }
  return map;
};

const main = () => {
  const protoManifest = findProtoManifest();
  if (!protoManifest) {
    console.log('proto-check: no embedded DS in the prototype — skipping.');
    return;
  }

  const canon = tokenMap(CANON);
  const proto = tokenMap(protoManifest);

  const contradictions = [];
  const stale = [];

  for (const [name, value] of canon) {
    if (!proto.has(name)) {
      stale.push(name);
    } else if (normalize(proto.get(name)) !== normalize(value)) {
      contradictions.push(
        `${name} — canon ${value} ≠ prototype ${proto.get(name)}`,
      );
    }
  }

  const protoOnly = [...proto.keys()].filter((name) => !canon.has(name));

  const obsoleteBridge = [];
  for (const [name, value] of bridgeTokens()) {
    if (canon.has(name) && normalize(canon.get(name)) === normalize(value)) {
      obsoleteBridge.push(name);
    }
  }

  if (stale.length > 0) {
    console.log(
      `proto-check: ${stale.length} canon token(s) missing from the ` +
        'prototype (re-sync its DS in Claude Design and re-export):',
    );
    for (const name of stale) console.log('  STALE  ' + name);
  }

  if (protoOnly.length > 0) {
    console.log(`proto-check: ${protoOnly.length} prototype-only token(s):`);
    for (const name of protoOnly) console.log('  EXTRA  ' + name);
  }

  if (obsoleteBridge.length > 0) {
    console.log(
      `\nproto-check: ds-bridge.css is obsolete — canon now ships these; ` +
        'delete the bridge and its <link>s on next export:',
    );
    for (const name of obsoleteBridge) console.log('  BRIDGE ' + name);
  }

  if (contradictions.length > 0) {
    console.error(
      `\nproto-check: ${contradictions.length} value contradiction(s) ` +
        '(real drift between prototype and the design system):',
    );
    for (const line of contradictions) console.error('  DRIFT  ' + line);
    process.exit(1);
  }

  if (stale.length === 0 && obsoleteBridge.length === 0) {
    console.log('proto-check: prototype is in sync with the design system ✓');
  }
};

main();
