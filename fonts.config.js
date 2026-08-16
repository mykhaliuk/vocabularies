// @ts-nocheck — plain JS read by node at build time (nuxt.config, the
// provider, two scripts). It enters vue-tsc's graph only through those
// imports, and its behaviour is pinned by tests/unit/fonts-check.test.ts
// rather than by static types.
// The webfont request, and the parser that reads what a fontsource package
// actually ships. One source of truth for three consumers: the build-time
// provider (providers/fontsource.js), the vendoring script that copies the
// woff2 into public/ (scripts/fonts-vendor.js) and the coverage check
// (scripts/fonts-check.js). See docs/adr/0019-fonts-from-node-modules.md.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// `latin` carries the en/fr accents and typographic punctuation, `cyrillic`
// every Ukrainian letter — needed in all three locales, because unicode-range
// picks a face per character, not per locale. Declared here rather than in
// nuxt.config so the provider, the vendoring step and the check read one list
// instead of three; nuxt.config imports it.
export const FONT_SUBSETS = ['latin', 'cyrillic'];

// nuxt.config derives its `families` from this list, so a family cannot be
// declared twice — the module resolves an override with
// `families.find(f => f.name === …)` and silently ignores every later entry
// with the same name. That used to be a rule a check enforced; now the shape
// makes it unsayable.
export const FONT_FAMILIES = [
  {
    name: 'Rubik',
    package: '@fontsource-variable/rubik',
    // Two stylesheets because fontsource never puts both styles in one — the
    // reason no stock provider can express this request (ADR-0019).
    sources: ['index.css', 'wght-italic.css'],
    subsets: FONT_SUBSETS,
    styles: ['normal', 'italic'],
    // Italic spans the full range even though only the gloss and `em` use it,
    // and it costs nothing: Rubik is variable, so one file per subset per
    // style serves every weight.
    weights: [400, 500, 600, 700, 800],
  },
  {
    name: 'Caveat',
    package: '@fontsource-variable/caveat',
    sources: ['index.css'],
    subsets: FONT_SUBSETS,
    // Caveat has never had an italic; asking for one loads nothing, silently.
    styles: ['normal'],
    weights: [500, 600],
  },
];

export const PUBLIC_FONT_DIR = 'public/fonts';
export const PUBLIC_FONT_BASE = '/fonts';

/**
 * @typedef {{ name: string, package: string, sources: string[],
 *   subsets: string[], styles: string[], weights: number[] }} FontFamily
 * @typedef {{ file: string, subset: string, style: string, weight: string,
 *   display: string, unicodeRange: string | null }} FontFace
 */

const FACE_RE = /@font-face\s*\{([^}]*)\}/g;

/**
 * @param {string} block
 * @param {string} property
 * @returns {string | null}
 */
const declaration = (block, property) => {
  const match = block.match(new RegExp(`${property}:\\s*([^;]+);`));
  return match === null ? null : match[1].trim();
};

// `rubik-cyrillic-ext-wght-italic.woff2` → subset `cyrillic-ext`, style
// `italic`. The shape is fontsource's own naming, so a package that stops
// following it produces no faces rather than wrong ones — and the check
// turns that into a failure.
const FILE_RE = /^[^-]+-(.+)-wght-(normal|italic)$/;

/**
 * @param {string} css
 * @returns {FontFace[]}
 */
export const parseFontFaces = (css) => {
  const faces = [];
  for (const [, block] of css.matchAll(FACE_RE)) {
    const src = declaration(block, 'src');
    const file = src?.match(/url\(\.\/files\/([^)]+)\.woff2\)/)?.[1];
    if (file === undefined) continue;
    const parts = file.match(FILE_RE);
    if (parts === null) continue;
    faces.push({
      file: `${file}.woff2`,
      subset: parts[1],
      style: parts[2],
      weight: declaration(block, 'font-weight') ?? '400',
      display: declaration(block, 'font-display') ?? 'swap',
      unicodeRange: declaration(block, 'unicode-range'),
    });
  }
  return faces;
};

// Every face the request asks for, read from the installed packages. Throws
// rather than returning a short list: a silently missing subset is the exact
// failure this whole arrangement exists to prevent.
/**
 * @param {FontFamily} family
 * @param {string} root
 * @returns {FontFace[]}
 */
export const resolveFamilyFaces = (family, root) => {
  /** @type {FontFace[]} */
  const faces = [];
  for (const source of family.sources) {
    const path = join(root, 'node_modules', family.package, source);
    faces.push(...parseFontFaces(readFileSync(path, 'utf8')));
  }
  const wanted = faces.filter(
    (face) =>
      family.subsets.includes(face.subset) &&
      family.styles.includes(face.style),
  );
  for (const style of family.styles) {
    for (const subset of family.subsets) {
      const has = wanted.some(
        (face) => face.style === style && face.subset === subset,
      );
      if (!has) {
        throw new Error(
          `[fonts] ${family.package} ships no ${style} ${subset} face for ` +
            `${family.name}; the request cannot be served from node_modules`,
        );
      }
    }
  }
  return wanted;
};
