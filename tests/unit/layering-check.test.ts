import { describe, expect, test } from 'bun:test';
import { findServerImportHits } from '../../scripts/layering-check.js';

// The outward half of the module boundary (VKB-181): client code may take
// types out of server/ and db/ and nothing else, because those modules pull
// the AWS SDK and only the `type` keyword keeps it out of the bundle.
// layering:check enforces it across the tree; this pins the classifier the
// enforcement rests on.

const kinds = (source: string, relFile = '') =>
  findServerImportHits(source, relFile).map((h) => h.kind);

describe('type-only imports pass', () => {
  test('import type', () => {
    expect(
      findServerImportHits(`import type { A } from '~/server/utils/x';`),
    ).toEqual([]);
  });

  test('import type spanning several lines, from on the last', () => {
    // The shape that made a line-based check impossible: composables/
    // useEntryPlayback.ts is written exactly like this.
    const source = `import type {\n  A,\n  B,\n} from '~/server/utils/x';`;
    expect(findServerImportHits(source)).toEqual([]);
  });

  test('inline type modifiers on every binding', () => {
    expect(
      findServerImportHits(
        `import { type A, type B } from '~/server/utils/x';`,
      ),
    ).toEqual([]);
  });

  test('export type', () => {
    expect(
      findServerImportHits(`export type { A } from '~/server/utils/x';`),
    ).toEqual([]);
  });
});

describe('anything that survives compilation fails', () => {
  test('a plain named import', () => {
    expect(kinds(`import { A } from '~/server/utils/x';`)).toEqual([
      'value import',
    ]);
  });

  test('one value binding among type ones', () => {
    // `b` still ships, so the statement still pulls the module in.
    expect(kinds(`import { type A, b } from '~/server/utils/x';`)).toEqual([
      'value import',
    ]);
  });

  test('a default import', () => {
    expect(kinds(`import X from '~/server/utils/x';`)).toEqual([
      'value import',
    ]);
  });

  test('a namespace import', () => {
    expect(kinds(`import * as X from '~/server/utils/x';`)).toEqual([
      'value import',
    ]);
  });

  test('a default alongside type bindings', () => {
    expect(kinds(`import X, { type A } from '~/server/utils/x';`)).toEqual([
      'value import',
    ]);
  });

  test('a side-effect import', () => {
    expect(kinds(`import '~/server/utils/x';`)).toEqual(['side-effect import']);
  });

  test('a dynamic import', () => {
    expect(kinds(`const m = await import('~/server/utils/x');`)).toEqual([
      'dynamic import',
    ]);
  });

  test('a value re-export', () => {
    expect(kinds(`export { a } from '~/server/utils/x';`)).toEqual([
      'value import',
    ]);
  });
});

describe('the specifier is matched by path, not by alias', () => {
  test.each([
    ['~/server/utils/x'],
    ['~~/server/utils/x'],
    ['@/server/utils/x'],
    ['../../server/utils/x'],
    ['~/db/schema/media'],
  ])('%s is in scope', (specifier) => {
    expect(kinds(`import { A } from '${specifier}';`)).toEqual([
      'value import',
    ]);
  });
});

describe('everything else is left alone', () => {
  test.each([
    ['~/utils/media-metrics'],
    ['~/composables/useEntryPlayback'],
    ['lucide-vue-next'],
    ['node:path'],
    // The trap the segment match exists to avoid: a module whose name merely
    // ends in "server" or contains "db" is not the server tree.
    ['~/utils/dbg'],
    ['~/lib/observer'],
  ])('%s is not flagged', (specifier) => {
    expect(findServerImportHits(`import { A } from '${specifier}';`)).toEqual(
      [],
    );
  });

  test('a commented-out value import', () => {
    expect(
      findServerImportHits(`// import { A } from '~/server/utils/x';`),
    ).toEqual([]);
  });

  test('a value import inside a block comment', () => {
    expect(
      findServerImportHits(`/*\nimport { A } from '~/server/utils/x';\n*/`),
    ).toEqual([]);
  });
});

describe('statement boundaries', () => {
  test('an assignment above a type import does not drag it in', () => {
    // Without the `[^;=]` guard the lazy match starts at `export const` and
    // runs to the next `from`, condemning an import that is perfectly fine.
    const source = [
      `export const LIMIT = 1;`,
      `import type { A } from '~/server/utils/x';`,
    ].join('\n');
    expect(findServerImportHits(source)).toEqual([]);
  });

  test('the reported line is the start of the statement', () => {
    const source = [
      `const a = 1;`,
      ``,
      `import { A } from '~/server/utils/x';`,
    ].join('\n');
    expect(findServerImportHits(source)[0]?.line).toBe(3);
  });

  test('several violations in one file are all reported, in order', () => {
    const source = [
      `import { A } from '~/server/utils/a';`,
      `import type { B } from '~/server/utils/b';`,
      `import { C } from '~/db/schema/c';`,
    ].join('\n');
    expect(findServerImportHits(source).map((h) => h.line)).toEqual([1, 3]);
  });
});

// Every case below is a finding from the adversarial review of this check.
// Five were silent false negatives — the guard reporting nothing while a real
// value import from server/ sat in the file — which is the one failure mode a
// guard must not have.
describe('a statement cannot swallow the one after it', () => {
  test('an unterminated export type block does not hide the next import', () => {
    // The first shape found: the merged clause still read as type-only, so
    // the value import passed AND was consumed before it could match alone.
    const source = [
      `export type {`,
      `  Helper`,
      `}`,
      `import { B } from '~/server/b';`,
    ].join('\n');
    expect(findServerImportHits(source)).toEqual([
      { line: 4, specifier: '~/server/b', kind: 'value import' },
    ]);
  });

  test('an inline type re-export does not hide the next import', () => {
    const source = [
      `export { type Helper }`,
      `import { B } from '~/server/b';`,
    ].join('\n');
    expect(findServerImportHits(source).map((h) => h.line)).toEqual([2]);
  });

  test('two server imports in a row are both reported', () => {
    const source = [
      `import { a } from '~/server/utils/a';`,
      `import { b } from '~/server/utils/b';`,
    ].join('\n');
    expect(findServerImportHits(source).map((h) => h.line)).toEqual([1, 2]);
  });
});

describe('specifiers that only look like ours', () => {
  test('a package whose path contains db/ is not the schema', () => {
    expect(
      findServerImportHits(`import { openDB } from 'idb/build/db/index.js';`),
    ).toEqual([]);
  });

  test('a package whose path contains server/ is not our server', () => {
    expect(
      findServerImportHits(`import { x } from 'some-pkg/server/index.js';`),
    ).toEqual([]);
  });
});

describe('the shapes a narrower reader would miss', () => {
  test('a dynamic import written with a template literal', () => {
    expect(kinds('const m = await import(`~/server/utils/db`);')).toEqual([
      'dynamic import',
    ]);
  });

  test('a block comment does not shift the reported line', () => {
    const source = [
      '/*',
      '1',
      '2',
      '3',
      '*/',
      `import { A } from '~/server/a';`,
    ].join('\n');
    expect(findServerImportHits(source)[0]?.line).toBe(6);
  });

  test('a glob in a string does not open a comment', () => {
    // '**/*.ts' looks like a comment opener to a naive stripper, which would
    // erase everything up to the next */ and take real imports with it.
    const source = [
      `const glob = '**/*.ts';`,
      `import { A } from '~/server/a';`,
    ].join('\n');
    expect(findServerImportHits(source).map((h) => h.line)).toEqual([2]);
  });
});

// The second review round. Four more silent false negatives and the escape
// hatch they argued for.
describe('escapes a narrower reader would still miss', () => {
  test('two statements sharing a line', () => {
    // A statement also starts after a semicolon; cutting only at line starts
    // let the first import consume the second.
    const source = `import { A } from 'vue'; import { B } from '~/server/b';`;
    expect(findServerImportHits(source).map((h) => h.specifier)).toEqual([
      '~/server/b',
    ]);
  });

  test("Vite's glob import", () => {
    // It pulls every match into the bundle, which is the same escape as a
    // dynamic import wearing a different name.
    expect(kinds(`const mods = import.meta.glob('~/server/**/*.ts');`)).toEqual(
      ['glob import'],
    );
  });
});

describe('the escape hatch', () => {
  test('an annotation on the line above suppresses the hit', () => {
    const source = [
      `// layering-allow: pure module, measured, no runtime deps`,
      `import { beforeSend } from '~/server/utils/scrub';`,
    ].join('\n');
    expect(findServerImportHits(source)).toEqual([]);
  });

  test('an annotation on the statement itself suppresses it', () => {
    const source = `import { a } from '~/server/a'; // layering-allow: reason`;
    expect(findServerImportHits(source)).toEqual([]);
  });

  test('an annotation with no reason suppresses nothing', () => {
    // Otherwise it is a mute button rather than a record of a decision.
    const source = [
      `// layering-allow:`,
      `import { b } from '~/server/b';`,
    ].join('\n');
    expect(findServerImportHits(source).map((h) => h.line)).toEqual([2]);
  });

  test('an annotation two lines up does not reach', () => {
    const source = [
      `// layering-allow: reason`,
      ``,
      `import { b } from '~/server/b';`,
    ].join('\n');
    expect(findServerImportHits(source).map((h) => h.line)).toEqual([3]);
  });
});

describe('the violation this check found in the tree', () => {
  test('sentry.client.config.js as it was written', () => {
    // Root-level files were not scanned, so this sat in the repo while the
    // check reported it clean. The module moved to shared/; the case stays
    // as the record of what a missed root costs.
    const source = [
      `import * as Sentry from '@sentry/nuxt';`,
      `import { beforeSend } from '~/server/utils/sentry-scrub';`,
    ].join('\n');
    expect(findServerImportHits(source)).toEqual([
      {
        line: 2,
        specifier: '~/server/utils/sentry-scrub',
        kind: 'value import',
      },
    ]);
  });
});

// The third review round. Both findings were about the guard being narrower
// than the project it guards.
describe('every alias Nuxt maps into this project', () => {
  // .nuxt/tsconfig.app.json — the CLIENT project — maps all of these, so a
  // client file can reach the server tree through any of them.
  test.each([
    ['~/server/utils/storage'],
    ['~~/server/utils/storage'],
    ['@/server/utils/storage'],
    ['@@/server/utils/storage'],
    ['#server/utils/storage'],
    ['../../server/utils/storage'],
  ])('%s is in scope', (specifier) => {
    expect(kinds(`import { useStorage } from '${specifier}';`)).toEqual([
      'value import',
    ]);
  });

  test('a scoped package is not the @@ alias', () => {
    expect(
      findServerImportHits(`import { x } from '@scope/pkg/server/x.js';`),
    ).toEqual([]);
  });

  test('an alias still passes when the import is type-only', () => {
    expect(
      findServerImportHits(`import type { A } from '@@/server/utils/x';`),
    ).toEqual([]);
  });
});

describe('the annotation reaches the whole statement', () => {
  test('on the from line of a multi-line import', () => {
    // Imports here routinely span four lines with `from` on the last, which
    // is where someone annotating one would naturally write it.
    const source = [
      `import {`,
      `  beforeSend,`,
      `} from '~/server/utils/scrub'; // layering-allow: pure, measured`,
    ].join('\n');
    expect(findServerImportHits(source)).toEqual([]);
  });

  test('a multi-line import with no annotation is still caught', () => {
    const source = [`import {`, `  a,`, `} from '~/server/a';`].join('\n');
    expect(findServerImportHits(source).map((h) => h.line)).toEqual([1]);
  });
});

// The fourth review round: three more silent escapes and one way to mute the
// guard by accident.
describe('a dynamic import is caught however it is written', () => {
  test('with an import-attributes argument', () => {
    expect(
      kinds(`await import('~/db/schema/media', { with: { type: 'json' } });`),
    ).toEqual(['dynamic import']);
  });

  test('with a trailing comma', () => {
    expect(kinds(`await import('~/server/a',);`)).toEqual(['dynamic import']);
  });
});

describe('an empty named clause is not type-only', () => {
  test('import {} evaluates the module like a side-effect import', () => {
    expect(kinds(`import {} from '~/server/utils/storage';`)).toEqual([
      'value import',
    ]);
  });
});

describe('only a comment can carry the annotation', () => {
  test('the token inside a string mutes nothing', () => {
    const source = [
      `const s = 'layering-allow: nope';`,
      `import { a } from '~/server/a';`,
    ].join('\n');
    expect(findServerImportHits(source).map((h) => h.line)).toEqual([2]);
  });
});

describe('only the repo-root server/ and db/ are the server tree', () => {
  test('a client db directory is not the schema', () => {
    // This is a PWA; an IndexedDB store under utils/db/ is a plausible
    // addition, and making its author annotate it would hollow out the
    // annotation.
    expect(
      findServerImportHits(`import { openDb } from '~/utils/db/local';`),
    ).toEqual([]);
  });

  test('a relative client db directory is not the schema either', () => {
    expect(
      findServerImportHits(
        `import { openDb } from './db/local';`,
        'composables/useX.ts',
      ),
    ).toEqual([]);
  });

  test('a relative path that really lands in server/ is caught', () => {
    expect(
      kinds(
        `import { x } from '../server/utils/storage';`,
        'composables/useX.ts',
      ),
    ).toEqual(['value import']);
  });

  test('the real schema is still caught', () => {
    expect(kinds(`import { media } from '~/db/schema/media';`)).toEqual([
      'value import',
    ]);
  });
});

// The fifth review round. The annotation one is the worst kind: an allowed
// import silently excusing the one after it.
describe('the annotation belongs to one statement', () => {
  test('a trailing annotation does not excuse the next import', () => {
    const source = [
      `import { a } from '~/server/a'; // layering-allow: pure`,
      `import { useStorage } from '~/server/utils/storage';`,
    ].join('\n');
    expect(findServerImportHits(source).map((h) => h.line)).toEqual([2]);
  });

  test('an unrelated trailing annotation above excuses nothing', () => {
    const source = [
      `import { z } from 'vue'; // layering-allow: x`,
      `import { s } from '~/server/utils/storage';`,
    ].join('\n');
    expect(findServerImportHits(source).map((h) => h.line)).toEqual([2]);
  });

  test('a stand-alone annotation above still suppresses', () => {
    const source = [
      `// layering-allow: reason`,
      `import { a } from '~/server/a';`,
    ].join('\n');
    expect(findServerImportHits(source)).toEqual([]);
  });

  test('a trailing annotation suppresses its own statement', () => {
    expect(
      findServerImportHits(
        `import { a } from '~/server/a'; // layering-allow: reason`,
      ),
    ).toEqual([]);
  });
});

describe('the idiomatic comments inside a dynamic import', () => {
  test('a vite magic comment before the specifier', () => {
    // /* @vite-ignore */ and /* webpackChunkName */ are ordinary here.
    expect(
      kinds(`await import(/* @vite-ignore */ '~/server/utils/storage');`),
    ).toEqual(['dynamic import']);
  });

  test('a comment before a glob pattern', () => {
    expect(kinds(`import.meta.glob(/* eager */ '~/server/**/*.ts');`)).toEqual([
      'glob import',
    ]);
  });
});

describe('a statement can begin where a block comment ends', () => {
  test('mid-line */ followed by an import', () => {
    const source = [
      `const a = 1; /* x`,
      `*/ import { b } from '~/server/b';`,
    ].join('\n');
    expect(findServerImportHits(source).map((h) => h.line)).toEqual([2]);
  });
});

describe('barrel imports of the two trees', () => {
  test.each([['~/db'], ['~/server'], ['#server'], ['~~/db']])(
    '%s has no trailing slash and is still the tree',
    (specifier) => {
      expect(kinds(`import { x } from '${specifier}';`)).toEqual([
        'value import',
      ]);
    },
  );
});

// The sixth review round, all low and all about the predicate the guard
// rests on being slightly too generous.
describe('`type` has to qualify something', () => {
  test('a default import named type is a value', () => {
    // `import type from '…'` binds a runtime export called `type`; it erases
    // nothing, however much it reads like a type import.
    expect(kinds(`import type from '~/server/a';`)).toEqual(['value import']);
  });

  test('a binding renamed from type is a value', () => {
    expect(kinds(`import { type as kind } from '~/server/a';`)).toEqual([
      'value import',
    ]);
  });

  test.each([
    [`import type { A } from '~/server/a';`],
    [`import type A from '~/server/a';`],
    [`import { type A as B } from '~/server/a';`],
  ])('%s still passes', (source) => {
    expect(findServerImportHits(source)).toEqual([]);
  });
});

describe('a bare re-export cannot reach a later string', () => {
  test('a from inside a string is not a specifier', () => {
    const source = [
      `export { useFoo }`,
      `console.log('from "~/server/a"')`,
    ].join('\n');
    expect(findServerImportHits(source)).toEqual([]);
  });

  test('but a real import after one is still caught', () => {
    const source = [
      `export { useFoo }`,
      `import { a } from '~/server/a';`,
    ].join('\n');
    expect(findServerImportHits(source).map((h) => h.line)).toEqual([2]);
  });
});
