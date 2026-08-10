import { describe, expect, test } from 'bun:test';
import {
  checkFamily,
  describeDeadDuplicate,
  findDeadDuplicate,
  readBoolean,
} from '../../scripts/fonts-check.js';

const family = (name: string | null, isGlobal: boolean | null = false) => ({
  name,
  provider: 'google',
  isGlobal,
  weights: [400],
  styles: ['normal'],
  subsets: ['latin'],
});

describe('findDeadDuplicate', () => {
  test('a repeated name is dead config', () => {
    expect(findDeadDuplicate([family('Rubik'), family('Rubik')])).toEqual({
      name: 'Rubik',
      isUnreadable: false,
    });
  });

  test('distinct names are all live', () => {
    expect(findDeadDuplicate([family('Rubik'), family('Caveat')])).toBeNull();
  });

  test('a global entry after a plain one is live', () => {
    const families = [family('Rubik'), family('Rubik', true)];
    expect(findDeadDuplicate(families)).toBeNull();
  });

  test('a plain entry after a global one is dead', () => {
    const families = [family('Rubik', true), family('Rubik')];
    expect(findDeadDuplicate(families)?.name).toBe('Rubik');
  });

  test('two globals are both live', () => {
    const families = [family('Rubik', true), family('Rubik', true)];
    expect(findDeadDuplicate(families)).toBeNull();
  });

  test('an unreadable global on a repeat is undecided, not clean', () => {
    const families = [family('Rubik'), family('Rubik', null)];
    expect(findDeadDuplicate(families)).toEqual({
      name: 'Rubik',
      isUnreadable: true,
    });
  });

  test('an unreadable global on a unique name decides nothing', () => {
    const families = [family('Rubik', null), family('Caveat')];
    expect(findDeadDuplicate(families)).toBeNull();
  });
});

describe('an unnamed entry', () => {
  test('never masks a duplicate that follows it', () => {
    const families = [
      family(null),
      family(null),
      family('Rubik'),
      family('Rubik'),
    ];
    expect(findDeadDuplicate(families)?.name).toBe('Rubik');
  });

  test('is a hard failure in the coverage pass', () => {
    const failures: string[] = [];
    checkFamily(family(null), new Map(), failures);
    expect(failures).toEqual(['UNNAMED  a `families` entry has no `name`']);
  });
});

describe('readBoolean', () => {
  test('reads a literal in every position the formatter produces', () => {
    expect(readBoolean('{ global: true }', 'global')).toBe(true);
    expect(readBoolean('{ global: false }', 'global')).toBe(false);
    expect(readBoolean('{ global: true, name: 1 }', 'global')).toBe(true);
    expect(readBoolean('{\n  global: true,\n}', 'global')).toBe(true);
    expect(readBoolean('{\n  global: true\n}', 'global')).toBe(true);
  });

  test('an absent key is false, not undecided', () => {
    expect(readBoolean('{ name: 1 }', 'global')).toBe(false);
  });

  test('a value that merely starts with a literal is undecided', () => {
    expect(readBoolean('{ global: trueInProduction }', 'global')).toBeNull();
    expect(readBoolean('{ global: true && isProd }', 'global')).toBeNull();
    expect(readBoolean('{ global: trueish.value }', 'global')).toBeNull();
    expect(readBoolean('{ global: falsey }', 'global')).toBeNull();
  });

  test('a non-literal value is undecided', () => {
    expect(readBoolean('{ global: isProd }', 'global')).toBeNull();
    expect(readBoolean('{ global: !isProd }', 'global')).toBeNull();
  });
});

describe('describeDeadDuplicate', () => {
  test('a decided duplicate is reported as dead config', () => {
    const message = describeDeadDuplicate({
      name: 'Rubik',
      isUnreadable: false,
    });
    expect(message).toContain('lists `Rubik` more than once');
    expect(message).not.toContain('cannot tell');
  });

  test('an undecided one says so rather than asserting it is dead', () => {
    const message = describeDeadDuplicate({
      name: 'Rubik',
      isUnreadable: true,
    });
    expect(message).toContain('cannot tell');
    expect(message).not.toContain('more than once');
  });
});
