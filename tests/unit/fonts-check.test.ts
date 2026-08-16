import { resolve } from 'node:path';
import { describe, expect, test } from 'bun:test';
import {
  FONT_FAMILIES,
  FONT_SUBSETS,
  parseFontFaces,
  resolveFamilyFaces,
} from '../../fonts.config';

const ROOT = resolve(import.meta.dirname, '../..');

// Trimmed from @fontsource-variable/rubik's own output, so the parser is
// tested against the shape it will actually meet.
const SAMPLE = `
/* rubik-cyrillic-wght-normal */
@font-face {
  font-family: 'Rubik Variable';
  font-style: normal;
  font-display: swap;
  font-weight: 300 900;
  src: url(./files/rubik-cyrillic-wght-normal.woff2) format('woff2-variations');
  unicode-range: U+0301,U+0400-045F;
}
/* rubik-latin-wght-italic */
@font-face {
  font-family: 'Rubik Variable';
  font-style: italic;
  font-display: swap;
  font-weight: 300 900;
  src: url(./files/rubik-latin-wght-italic.woff2) format('woff2-variations');
  unicode-range: U+0000-00FF;
}
`;

describe('parseFontFaces', () => {
  test('reads subset and style out of the file name', () => {
    const faces = parseFontFaces(SAMPLE);
    expect(faces.map((face) => `${face.subset}/${face.style}`)).toEqual([
      'cyrillic/normal',
      'latin/italic',
    ]);
  });

  test('keeps the unicode-range, which is what makes a subset selectable', () => {
    expect(parseFontFaces(SAMPLE)[0]?.unicodeRange).toBe('U+0301,U+0400-045F');
  });

  test('carries the variable weight range rather than a single weight', () => {
    expect(parseFontFaces(SAMPLE)[0]?.weight).toBe('300 900');
  });

  test('ignores a face whose file name breaks the fontsource convention', () => {
    const odd = SAMPLE.replace(
      'files/rubik-cyrillic-wght-normal.woff2',
      'files/mystery.woff2',
    );
    expect(parseFontFaces(odd)).toHaveLength(1);
  });
});

describe('resolveFamilyFaces', () => {
  test('every declared family resolves from its installed package', () => {
    for (const family of FONT_FAMILIES) {
      const faces = resolveFamilyFaces(family, ROOT);
      expect(faces.length).toBe(family.subsets.length * family.styles.length);
    }
  });

  test('a subset the package does not ship is a throw, not a short list', () => {
    const family = { ...FONT_FAMILIES[0]!, subsets: ['klingon'] };
    expect(() => resolveFamilyFaces(family, ROOT)).toThrow(/ships no/);
  });

  test('an italic Caveat is a throw — it has never existed', () => {
    const caveat = FONT_FAMILIES.find((family) => family.name === 'Caveat')!;
    expect(() =>
      resolveFamilyFaces({ ...caveat, styles: ['italic'] }, ROOT),
    ).toThrow(/ships no italic/);
  });

  test('Ukrainian stays covered: cyrillic is in the request', () => {
    expect(FONT_SUBSETS).toContain('cyrillic');
  });
});

describe('the vendored provider', () => {
  type Face = {
    src: Array<{ url: string; format: string }>;
    unicodeRange?: string[];
  };
  type Factory = (options: { root: string }) => (ctx: unknown) => Promise<{
    resolveFont: (
      family: string,
      options: unknown,
    ) => { fonts: Face[] } | undefined;
  }>;

  const resolve = async (family: string) => {
    const module = await import('../../providers/fontsource.js');
    const factory = module.default as unknown as Factory;
    const provider = await factory({ root: ROOT })(undefined);
    return provider.resolveFont(family, {
      styles: ['normal', 'italic'],
      subsets: [...FONT_SUBSETS],
      weights: ['400'],
    });
  };

  // The format is written into the CSS unquoted, and
  // `format(woff2-variations)` is not a valid font-format keyword: the browser
  // drops the whole @font-face and the page silently renders in a system
  // font. Every gate stayed green when this shipped; only rendering caught it.
  test('declares a font format a browser accepts', async () => {
    const result = await resolve('Rubik');
    for (const face of result!.fonts) {
      expect(face.src[0]).toMatchObject({ format: 'woff2' });
    }
  });

  test('serves from the vendored public path, not a CDN', async () => {
    const result = await resolve('Rubik');
    for (const face of result!.fonts) {
      expect(face.src[0]).toMatchObject({
        url: expect.stringMatching(/^\/fonts\//),
      });
    }
  });

  test('keeps a unicode-range on every face, so subsets stay selectable', async () => {
    const result = await resolve('Rubik');
    for (const face of result!.fonts) {
      expect(face.unicodeRange?.length).toBeGreaterThan(0);
    }
  });

  test('leaves families it does not own to other providers', async () => {
    expect(await resolve('Comic Sans')).toBeUndefined();
  });
});
