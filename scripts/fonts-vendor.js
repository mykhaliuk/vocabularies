#!/usr/bin/env node
// Copy the woff2 the request needs out of the installed fontsource packages
// and into public/fonts, so the build reads fonts from disk instead of the
// network. Runs on postinstall; the output is generated, not committed.
import { copyFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  FONT_FAMILIES,
  PUBLIC_FONT_DIR,
  resolveFamilyFaces,
} from '../fonts.config.js';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, PUBLIC_FONT_DIR);

mkdirSync(OUT, { recursive: true });

// Wanted first, then prune: a file that leaves the request must leave the
// directory too, or a stale subset keeps being served after nobody asks
// for it.
const wanted = new Set();
let copied = 0;

for (const family of FONT_FAMILIES) {
  for (const face of resolveFamilyFaces(family, ROOT)) {
    wanted.add(face.file);
    copyFileSync(
      join(ROOT, 'node_modules', family.package, 'files', face.file),
      join(OUT, face.file),
    );
    copied++;
  }
}

let pruned = 0;
for (const entry of readdirSync(OUT)) {
  if (wanted.has(entry)) continue;
  rmSync(join(OUT, entry), { force: true });
  pruned++;
}

console.log(
  `fonts-vendor: ${copied} file(s) in ${PUBLIC_FONT_DIR}` +
    (pruned > 0 ? `, ${pruned} stale removed` : ''),
);
