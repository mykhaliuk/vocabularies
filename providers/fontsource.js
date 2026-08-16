// @ts-nocheck — loaded by jiti at build time, not by the app bundle; the
// unifont provider generics do not survive JSDoc cleanly and the behaviour is
// pinned by the offline build and tests/unit/fonts-check.test.ts.
// A unifont provider that answers from the installed fontsource packages.
//
// Why not a stock provider: `local` reports no unicode-range, so every subset
// collapses onto one face and Cyrillic silently stops resolving; `npm` reads
// the CSS locally but rewrites every font URL to a CDN, so the build still
// fetches. This one returns complete face data with the subsets intact, and
// points at files vendored into public/ — a leading-slash path is not a URL
// to `hasProtocol`, so the module leaves it alone instead of downloading it.
//
// Keeping the module in the loop is the point: fallback metrics, preload
// hints and asset handling stay exactly as they were. See ADR-0019.
import { defineFontProvider } from 'unifont';
import {
  FONT_FAMILIES,
  PUBLIC_FONT_BASE,
  resolveFamilyFaces,
} from '../fonts.config.js';

export default defineFontProvider('vendored', (options = {}) => {
  const root = options.root ?? process.cwd();

  return {
    resolveFont(fontFamily, requested) {
      const family = FONT_FAMILIES.find((entry) => entry.name === fontFamily);
      if (family === undefined) return;

      // Honour what the module asks for rather than everything the package
      // ships: the request is the contract, and serving extra subsets would
      // quietly grow the payload nobody asked to grow.
      const styles = new Set(requested.styles);
      const subsets = new Set(requested.subsets);
      const faces = resolveFamilyFaces(family, root)
        .filter((face) => styles.has(face.style) && subsets.has(face.subset))
        .map((face) => ({
          // `woff2`, not fontsource's legacy `woff2-variations`: the module
          // writes the format unquoted, and `format(woff2-variations)` is not
          // a valid CSS font-format keyword — the whole @font-face is dropped,
          // silently, and the page renders in a system font.
          src: [{ url: `${PUBLIC_FONT_BASE}/${face.file}`, format: 'woff2' }],
          weight: face.weight,
          style: face.style,
          display: face.display,
          unicodeRange: face.unicodeRange
            ?.split(',')
            .map((entry) => entry.trim()),
        }));

      return { fonts: faces };
    },
  };
});
