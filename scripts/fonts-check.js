#!/usr/bin/env node
/* fonts-check — every face the request asks for must be one the installed
   package actually ships, and must be vendored into public/.

   A source does not complain about a subset a family has never shipped: it
   serves nothing, and the glyphs fall back to a system face per character, in
   every locale, with no error anywhere (VKB-157). That is still the failure
   being guarded against; since VKB-124 the authority is the package on disk
   rather than Google's metadata index, so this check no longer needs the
   network to answer — see docs/adr/0019-fonts-from-node-modules.md.
*/
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  FONT_FAMILIES,
  PUBLIC_FONT_DIR,
  resolveFamilyFaces,
} from '../fonts.config.js';

const ROOT = resolve(import.meta.dirname, '..');

const failures = [];

// A variable face declares `font-weight: 300 900`; a static one a single
// number. Either way the requested weights have to land inside what the file
// can render, or the browser synthesises the difference.
const coversWeight = (declared, weight) => {
  const bounds = declared.split(/\s+/).map(Number);
  if (bounds.length === 1) return bounds[0] === weight;
  return weight >= bounds[0] && weight <= bounds[1];
};

for (const family of FONT_FAMILIES) {
  let faces;
  try {
    faces = resolveFamilyFaces(family, ROOT);
  } catch (error) {
    failures.push(`COVERAGE ${family.name} — ${error.message}`);
    continue;
  }

  for (const face of faces) {
    if (!existsSync(join(ROOT, PUBLIC_FONT_DIR, face.file))) {
      failures.push(
        `MISSING  ${family.name} — ${face.file} is not in ${PUBLIC_FONT_DIR}; ` +
          'run `bun run fonts:vendor`',
      );
    }
    for (const weight of family.weights) {
      if (!coversWeight(face.weight, weight)) {
        failures.push(
          `WEIGHT   ${family.name} — ${face.file} renders ${face.weight}, ` +
            `which does not cover ${weight}`,
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error(`\nfonts-check: ${failures.length} coverage failure(s):`);
  for (const line of failures) console.error('  ' + line);
  process.exit(1);
}

for (const family of FONT_FAMILIES) {
  console.log(
    `fonts-check: ${family.name} ${family.styles.join('/')} ` +
      `${family.weights.join(',')} · ${family.subsets.join(', ')} ` +
      `· ${family.package} ✓`,
  );
}
console.log('fonts-check: every configured face is one the package ships ✓');
