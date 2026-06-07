#!/usr/bin/env node
/* proto-pull — ingest a prototype bundle downloaded from Claude Design.

   Mirror of ds-pull for the prototype leg. The prototype exports as a bundle
   whose root holds a `Vocabu/` app directory plus an embedded `_ds/` copy of
   the design system; there is no API to fetch.

     bun run proto:pull [path]

   - With a path: that .zip or directory is used.
   - Without: the newest .zip in the repo root or ~/Downloads whose listing
     contains a `Vocabu/` directory is picked (this is what distinguishes a
     prototype bundle from a design-system bundle).

   The bundle is a vendored snapshot: docs/design/prototype/project/ is fully
   replaced. Re-syncing the prototype's embedded DS happens in Claude Design,
   not here — run `proto:check` afterwards to see remaining drift.
*/

import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { resolve, join, basename } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DEST = join(ROOT, 'docs/design/prototype/project');
const ANCHOR = 'Vocabu';

const fail = (message) => {
  console.error(`proto-pull: ${message}`);
  process.exit(1);
};

const zipHasAnchor = (zip) => {
  try {
    const listing = execFileSync('unzip', ['-l', zip], { encoding: 'utf8' });
    return new RegExp(`(^|/)${ANCHOR}/`, 'm').test(listing);
  } catch {
    return false;
  }
};

const newestZip = () => {
  const dirs = [ROOT, join(homedir(), 'Downloads')];
  const found = [];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (!name.toLowerCase().endsWith('.zip')) continue;
      const path = join(dir, name);
      if (zipHasAnchor(path))
        found.push({ path, mtime: statSync(path).mtimeMs });
    }
  }
  found.sort((a, b) => b.mtime - a.mtime);
  return found.length > 0 ? found[0].path : null;
};

// Find the directory that directly contains the `Vocabu/` app dir.
const findBundleRoot = (root) => {
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    const entries = readdirSync(dir, { withFileTypes: true });
    if (entries.some((e) => e.isDirectory() && e.name === ANCHOR)) return dir;
    for (const entry of entries) {
      if (entry.isDirectory()) stack.push(join(dir, entry.name));
    }
  }
  return null;
};

const resolveSource = () => {
  const arg = process.argv[2];
  if (arg) {
    const path = resolve(arg);
    if (!existsSync(path)) fail(`path not found: ${path}`);
    return path;
  }
  const zip = newestZip();
  if (!zip) {
    fail(
      'no bundle given and none found in repo root or ~/Downloads.\n' +
        '  Download the prototype from Claude Design, then run:\n' +
        '    bun run proto:pull <path-to-bundle.zip>',
    );
  }
  console.log(`proto-pull: using ${basename(zip)}`);
  return zip;
};

const main = () => {
  const source = resolveSource();
  const work = mkdtempSync(join(tmpdir(), 'proto-pull-'));

  let searchRoot;
  if (statSync(source).isDirectory()) {
    searchRoot = source;
  } else {
    execFileSync('unzip', ['-oq', source, '-d', work]);
    searchRoot = work;
  }

  const bundleRoot = findBundleRoot(searchRoot);
  if (!bundleRoot) {
    rmSync(work, { recursive: true, force: true });
    fail(`no ${ANCHOR}/ directory found inside the bundle`);
  }

  rmSync(DEST, { recursive: true, force: true });
  cpSync(bundleRoot, DEST, { recursive: true });
  rmSync(work, { recursive: true, force: true });

  console.log(`proto-pull: snapshot updated → ${DEST.replace(ROOT + '/', '')}`);
  console.log('proto-pull: next, run `bun run proto:check`.');
};

main();
