import { describe, expect, test } from 'bun:test';
import {
  findCallEnd,
  importedNames,
  maskComments,
  matchesRoute,
  readAnnotation,
  routeFromFile,
  segmentsMatch,
  skipGeneric,
  skipString,
} from '../../scripts/capability-graph.js';

// ADR-0013: these are the lexical primitives `bun run graph:build` uses to
// derive the capability graph. They were verified only hands-on until now
// (VKB-93) — pinning them here catches a regression before it silently
// reshapes docs/capability-graph.md.

describe('routeFromFile', () => {
  test('index.get.ts derives GET and drops the index segment', () => {
    expect(routeFromFile('server/api/entries/index.get.ts')).toEqual({
      method: 'GET',
      path: '/api/entries',
    });
  });

  test('a bracketed segment becomes a route param', () => {
    expect(routeFromFile('server/api/entries/[id].get.ts')).toEqual({
      method: 'GET',
      path: '/api/entries/:id',
    });
  });

  test('a rest bracket becomes a catch-all param', () => {
    expect(routeFromFile('server/api/upload/[...rest].post.ts')).toEqual({
      method: 'POST',
      path: '/api/upload/**:rest',
    });
  });

  test('every HTTP verb suffix is stripped from the file name', () => {
    const verbs = ['get', 'post', 'put', 'patch', 'delete', 'head'];
    for (const verb of verbs) {
      expect(routeFromFile(`server/api/thing.${verb}.ts`)).toEqual({
        method: verb.toUpperCase(),
        path: '/api/thing',
      });
    }
  });

  test('a file with no verb suffix falls back to ALL', () => {
    expect(routeFromFile('server/api/webhook.ts')).toEqual({
      method: 'ALL',
      path: '/api/webhook',
    });
  });

  test('an index file with no verb still drops the index segment', () => {
    expect(routeFromFile('server/api/health/index.ts')).toEqual({
      method: 'ALL',
      path: '/api/health',
    });
  });
});

describe('segmentsMatch', () => {
  test('a route param segment matches any call segment', () => {
    expect(segmentsMatch('123', ':id')).toBe(true);
    expect(segmentsMatch('anything', ':id')).toBe(true);
  });

  // The call side collapses every template-literal interpolation to `:*`
  // (readPathArgument), so the runtime value is genuinely unknown — it could
  // land on a literal route segment just as easily as a param one. Both
  // "unknown" escape hatches are intentionally symmetric: a route param
  // accepts any call value, and an unresolved call value accepts any route
  // segment, param or literal. This is deliberate leniency, not an oversight.
  test('a wildcarded call segment matches a literal route segment too', () => {
    expect(segmentsMatch(':*', 'entries')).toBe(true);
  });

  test('two literal segments match only when equal', () => {
    expect(segmentsMatch('entries', 'entries')).toBe(true);
    expect(segmentsMatch('entries', 'users')).toBe(false);
  });
});

describe('matchesRoute', () => {
  test('a template-literal :* call segment matches a :id route param', () => {
    const call = { path: '/api/entries/:*', method: 'GET' };
    const route = { path: '/api/entries/:id', method: 'GET' };
    expect(matchesRoute(call, route)).toBe(true);
  });

  test('a segment-count mismatch never matches', () => {
    const call = { path: '/api/entries', method: 'GET' };
    const route = { path: '/api/entries/:id', method: 'GET' };
    expect(matchesRoute(call, route)).toBe(false);
  });

  test('a method mismatch never matches a non-ALL route', () => {
    const call = { path: '/api/entries', method: 'POST' };
    const route = { path: '/api/entries', method: 'GET' };
    expect(matchesRoute(call, route)).toBe(false);
  });

  test('an ALL route matches any call method', () => {
    const call = { path: '/api/entries', method: 'POST' };
    const route = { path: '/api/entries', method: 'ALL' };
    expect(matchesRoute(call, route)).toBe(true);
  });
});

describe('maskComments', () => {
  test('blanks a line comment, keeping length and line numbers stable', () => {
    const source = 'const x = 1; // a trailing comment\nconst y = 2;';
    const masked = maskComments(source);
    expect(masked.length).toBe(source.length);
    expect(masked.split('\n').length).toBe(source.split('\n').length);
    const lines = masked.split('\n');
    expect(lines[0].trimEnd()).toBe('const x = 1;');
    expect(lines[0]).not.toContain('//');
    expect(lines[1]).toBe('const y = 2;');
  });

  test('blanks a block comment across lines, keeping offsets', () => {
    const source = 'const x = 1; /* spans\ntwo lines */ const y = 2;';
    const masked = maskComments(source);
    expect(masked.length).toBe(source.length);
    // The newline inside the block comment must survive — it is not part of
    // the run of spaces `blank()` writes.
    expect(masked.split('\n').length).toBe(2);
    expect(masked.endsWith('const y = 2;')).toBe(true);
  });

  test('a string literal holding // or /* is not mistaken for a comment', () => {
    const source = 'const url = "http://example.com/*x*/"; // real comment';
    const masked = maskComments(source);
    expect(masked.startsWith('const url = "http://example.com/*x*/";')).toBe(
      true,
    );
    // Only the trailing real comment is blanked.
    expect(masked.trimEnd().endsWith(';')).toBe(true);
  });

  test('blanks a <!-- --> HTML comment in a .vue file, spanning lines', () => {
    const source =
      '<template>\n<!-- a comment\nspanning lines -->\n<div>hi</div>\n</template>';
    const masked = maskComments(source);
    expect(masked.length).toBe(source.length);
    expect(masked.split('\n').length).toBe(source.split('\n').length);
    expect(masked).toContain('<div>hi</div>');
    expect(masked).not.toContain('spanning lines');
  });
});

describe('skipString', () => {
  test('returns the index just past a simple quoted string', () => {
    const text = '"hello" rest';
    expect(skipString(text, 0)).toBe('"hello"'.length);
  });

  test('walks through a nested ${} template literal holding further strings', () => {
    const literal = '`outer ${`inner ${x}`} end`';
    const text = `${literal} rest`;
    expect(skipString(text, 0)).toBe(literal.length);
  });

  test('an escaped quote does not end the string early', () => {
    const text = String.raw`"a\"b" rest`;
    expect(skipString(text, 0)).toBe(String.raw`"a\"b"`.length);
  });
});

describe('skipGeneric', () => {
  test('steps over a multi-line generic argument list', () => {
    const text = 'useFetch<{\n  id: string;\n}>(url)';
    const openIndex = text.indexOf('<');
    const parenIndex = text.indexOf('(');
    expect(skipGeneric(text, openIndex)).toBe(parenIndex);
  });

  test('returns the index unchanged when there is no generic', () => {
    const text = '$fetch(url)';
    const openIndex = text.indexOf('(');
    expect(skipGeneric(text, openIndex)).toBe(openIndex);
  });
});

describe('findCallEnd', () => {
  test('finds the matching close paren past parens inside string arguments', () => {
    const text = 'x("a) b", "c(d")';
    const openIndex = text.indexOf('(');
    expect(findCallEnd(text, openIndex)).toBe(text.length - 1);
  });

  test('returns the end of text when the call is never closed', () => {
    const text = 'x("a"';
    const openIndex = text.indexOf('(');
    expect(findCallEnd(text, openIndex)).toBe(text.length);
  });
});

// The actual export is the generic `readAnnotation(source, key)` — both
// `graph-allow-orphan` and `graph-pending` read through it. The ticket names
// it `readAllowOrphan`, describing its main use, not a separate function.
describe('readAnnotation', () => {
  test('a reason wraps across the following comment lines', () => {
    const source =
      '// graph-allow-orphan: this route is called only by\n' +
      '// the nightly cron job, never from a client\n' +
      'export default defineEventHandler(() => {});\n';
    expect(readAnnotation(source, 'allow-orphan')).toBe(
      'this route is called only by the nightly cron job, never from a client',
    );
  });

  test('a blank line terminates the wrapped reason', () => {
    const source =
      '// graph-allow-orphan: reason first line\n' +
      '\n' +
      '// unrelated comment after a blank line\n';
    expect(readAnnotation(source, 'allow-orphan')).toBe('reason first line');
  });

  test('a non-comment line also terminates the wrapped reason', () => {
    const source =
      '// graph-allow-orphan: reason first line\n' +
      'export default defineEventHandler(() => {});\n';
    expect(readAnnotation(source, 'allow-orphan')).toBe('reason first line');
  });

  test('returns null when the annotation is absent', () => {
    const source = 'export default defineEventHandler(() => {});\n';
    expect(readAnnotation(source, 'allow-orphan')).toBeNull();
  });

  test('reads the graph-pending key through the same generic parser', () => {
    const source = '// graph-pending: VKB-42 — the screen is not built yet\n';
    expect(readAnnotation(source, 'pending')).toBe(
      'VKB-42 — the screen is not built yet',
    );
  });
});

describe('importedNames', () => {
  test('a type-only import contributes no names', () => {
    const text = "import type { Foo } from '../../db/schema/x';\n";
    expect(importedNames(text, 'db/schema')).toEqual(new Set());
  });

  test('an inline `type` specifier is excluded, its sibling is kept', () => {
    const text = "import { type Bar, baz } from '../../db/schema/x';\n";
    expect(importedNames(text, 'db/schema')).toEqual(new Set(['baz']));
  });

  test('an `as` alias resolves to the source name, not the alias', () => {
    const text = "import { qux as quux } from '../../db/schema/x';\n";
    expect(importedNames(text, 'db/schema')).toEqual(new Set(['qux']));
  });

  test('only names from a specifier matching the module hint are kept', () => {
    const text =
      "import { users } from '../../db/schema/x';\n" +
      "import { helper } from '../../server/utils/other';\n";
    expect(importedNames(text, 'db/schema')).toEqual(new Set(['users']));
  });
});
