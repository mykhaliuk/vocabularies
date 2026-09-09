import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, test } from 'bun:test';
import {
  FIELD,
  RECORD,
  checkCommit,
  commitType,
  listChangeNames,
  parseLog,
} from '../../scripts/check-commits.js';

const known = new Set(['adopt-openspec-workflow', 'media-pipeline']);

describe('commitType', () => {
  test('reads the type before an optional scope', () => {
    expect(commitType('feat(compose): add the media picker')).toBe('feat');
    expect(commitType('chore(deps): bump nuxt')).toBe('chore');
    expect(commitType('fix(feed)!: drop the legacy cursor')).toBe('fix');
  });

  test('is null for a subject outside Conventional Commits', () => {
    expect(commitType('Merge pull request #280')).toBeNull();
  });
});

describe('checkCommit', () => {
  test('accepts a feat commit naming a known change', () => {
    expect(
      checkCommit(
        {
          hash: 'a',
          subject: 'feat(compose): x',
          changes: ['media-pipeline'],
        },
        known,
      ),
    ).toEqual([]);
  });

  test('accepts the archive commit of a change', () => {
    expect(
      checkCommit(
        {
          hash: 'a',
          subject: 'chore(openspec): archive media-pipeline',
          changes: ['media-pipeline'],
        },
        known,
      ),
    ).toEqual([]);
  });

  test('rejects feat and fix commits without a trailer', () => {
    for (const subject of ['feat(compose): x', 'fix(feed): y']) {
      const problems = checkCommit({ hash: 'a', subject, changes: [] }, known);
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('no "Change: <name>" trailer');
    }
  });

  test('lets chore, docs, and refactor commits go without a trailer', () => {
    for (const subject of [
      'chore(deps): bump nuxt',
      'docs(agents): clarify the contract',
      'refactor(domain): rename an operation',
    ]) {
      expect(checkCommit({ hash: 'a', subject, changes: [] }, known)).toEqual(
        [],
      );
    }
  });

  test('rejects a trailer that names no change folder', () => {
    const problems = checkCommit(
      { hash: 'a', subject: 'chore: x', changes: ['no-such-change'] },
      known,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('matches no folder');
  });

  test('rejects a trailer that is not a kebab-case name', () => {
    const problems = checkCommit(
      { hash: 'a', subject: 'feat: x', changes: ['Media Pipeline'] },
      known,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('not a kebab-case');
  });

  test('rejects more than one Change trailer', () => {
    const problems = checkCommit(
      {
        hash: 'a',
        subject: 'feat: x',
        changes: ['media-pipeline', 'adopt-openspec-workflow'],
      },
      known,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('exactly one change');
  });
});

describe('parseLog', () => {
  test('splits records and trailer values', () => {
    const record = (hash: string, subject: string, trailers: string) =>
      `${hash}${FIELD}${subject}${FIELD}${trailers}${RECORD}\n`;
    const log =
      record('aaa', 'feat: one', 'media-pipeline\n') +
      record('bbb', 'chore: two', '') +
      record('ccc', 'fix: three', 'a\nb\n');
    expect(parseLog(log)).toEqual([
      { hash: 'aaa', subject: 'feat: one', changes: ['media-pipeline'] },
      { hash: 'bbb', subject: 'chore: two', changes: [] },
      { hash: 'ccc', subject: 'fix: three', changes: ['a', 'b'] },
    ]);
  });

  test('yields nothing for an empty range', () => {
    expect(parseLog('')).toEqual([]);
  });
});

describe('listChangeNames', () => {
  test('collects active folders and strips the archive date prefix', () => {
    const root = mkdtempSync(join(tmpdir(), 'vocabu-changes-'));
    mkdirSync(join(root, 'openspec/changes/active-one'), { recursive: true });
    mkdirSync(
      join(root, 'openspec/changes/archive/2026-08-20-adopt-openspec-workflow'),
      { recursive: true },
    );
    expect([...listChangeNames(root)].sort()).toEqual([
      'active-one',
      'adopt-openspec-workflow',
    ]);
  });

  test('is empty when the tree has no openspec folder', () => {
    expect(listChangeNames('/nonexistent')).toEqual(new Set());
  });
});
