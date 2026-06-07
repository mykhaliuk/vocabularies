#!/usr/bin/env node
/* ds-pull — ingest a design-system bundle downloaded from Claude Design.

   Claude Design exports the DS as a downloadable skill bundle (a .zip or a
   folder); there is no API/URL to fetch. This script removes the manual
   unpack/copy step:

     bun run ds:pull [path]

   - With a path: that .zip or directory is used.
   - Without: the newest .zip in ~/Downloads that CONTAINS _ds_manifest.json
     is picked (robust to the exact file name).

   The bundle is treated as a vendored snapshot: docs/design/design-system/
   project/ is fully replaced with the bundle's contents. Do not hand-edit
   that folder — edit the design system in Claude Design and re-pull.
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
const DEST = join(ROOT, 'docs/design/design-system/project');
const DOWNLOADS = join(homedir(), 'Downloads');
const MANIFEST = '_ds_manifest.json';

const fail = (message) => {
  console.error(`ds-pull: ${message}`);
  process.exit(1);
};

const zipHasManifest = (zip) => {
  try {
    const listing = execFileSync('unzip', ['-l', zip], { encoding: 'utf8' });
    return listing.includes(MANIFEST);
  } catch {
    return false;
  }
};

const newestDownloadZip = () => {
  if (!existsSync(DOWNLOADS)) return null;
  const zips = readdirSync(DOWNLOADS)
    .filter((name) => name.toLowerCase().endsWith('.zip'))
    .map((name) => join(DOWNLOADS, name))
    .filter((path) => zipHasManifest(path))
    .map((path) => ({ path, mtime: statSync(path).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return zips.length > 0 ? zips[0].path : null;
};

// Find the directory that directly contains _ds_manifest.json.
const findBundleDir = (root) => {
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    const entries = readdirSync(dir, { withFileTypes: true });
    if (entries.some((e) => e.isFile() && e.name === MANIFEST)) return dir;
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
  const zip = newestDownloadZip();
  if (!zip) {
    fail(
      'no bundle given and none found in ~/Downloads.\n' +
        '  Download the design system from Claude Design, then run:\n' +
        '    bun run ds:pull <path-to-bundle.zip>\n' +
        '  or drop the .zip into ~/Downloads and re-run.',
    );
  }
  console.log(`ds-pull: using ${basename(zip)}`);
  return zip;
};

const main = () => {
  const source = resolveSource();
  const work = mkdtempSync(join(tmpdir(), 'ds-pull-'));

  let searchRoot;
  if (statSync(source).isDirectory()) {
    searchRoot = source;
  } else {
    execFileSync('unzip', ['-oq', source, '-d', work]);
    searchRoot = work;
  }

  const bundleDir = findBundleDir(searchRoot);
  if (!bundleDir) {
    rmSync(work, { recursive: true, force: true });
    fail(`${MANIFEST} not found inside the bundle`);
  }

  rmSync(DEST, { recursive: true, force: true });
  cpSync(bundleDir, DEST, { recursive: true });
  rmSync(work, { recursive: true, force: true });

  console.log(`ds-pull: snapshot updated → ${DEST.replace(ROOT + '/', '')}`);
  console.log('ds-pull: next, run `bun run ds:sync` then `bun run ds:check`.');
};

main();
