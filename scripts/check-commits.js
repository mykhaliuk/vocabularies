#!/usr/bin/env node
// @ts-nocheck — JS CLI script run by node; it only enters vue-tsc's checked
// graph via the tests/unit/check-commits.test.ts import, and runtime
// behavior there is pinned by that spec, not by static types.
/* check-commits — every commit that belongs to an OpenSpec change must name
   it, so the change folder and the diff that implements it stay linked.

   Two guarantees over a git range:
   1. Coverage — a `feat` or `fix` commit carries a `Change: <change-name>`
      trailer. The changeless commits the workflow allows (dependency bumps,
      formatting, docs, mechanical refactors) are exempt by type.
   2. Resolution — a Change trailer names exactly one change, spelled in
      kebab-case, that exists under openspec/changes/ (active) or
      openspec/changes/archive/ (archived, date prefix stripped).

   Merge commits are skipped. Trailers are read with git's own parser, so what
   passes here is exactly what
   `git log --format='%(trailers:key=Change,valueonly)'` reports.

     bun run commits:check              # origin/dev..HEAD
     bun run commits:check dev..HEAD    # any git range
*/

import { readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const DEFAULT_RANGE = 'origin/dev..HEAD';

export const TYPES_REQUIRING_CHANGE = ['feat', 'fix'];

export const CHANGE_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const SUBJECT_PATTERN = /^(?<type>[a-z]+)(\([^)]*\))?!?: /;

export const commitType = (subject) =>
  SUBJECT_PATTERN.exec(subject)?.groups?.type ?? null;

const directoryNames = (path) => {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch {
    return [];
  }
};

// The bare change names the tree knows about: active folders as-is, archived
// folders with their YYYY-MM-DD- prefix stripped.
export const listChangeNames = (root) => {
  const names = new Set();
  for (const name of directoryNames(`${root}/openspec/changes`)) {
    if (name !== 'archive') names.add(name);
  }
  for (const name of directoryNames(`${root}/openspec/changes/archive`)) {
    names.add(name.replace(/^\d{4}-\d{2}-\d{2}-/, ''));
  }
  return names;
};

export const checkCommit = (commit, knownChanges) => {
  const problems = [];
  const type = commitType(commit.subject);
  if (commit.changes.length === 0) {
    if (type !== null && TYPES_REQUIRING_CHANGE.includes(type)) {
      problems.push(
        `${type} commit has no "Change: <name>" trailer (feat and fix ` +
          'commits must name their OpenSpec change)',
      );
    }
    return problems;
  }
  if (commit.changes.length > 1) {
    problems.push(
      `has ${commit.changes.length} Change trailers; a commit belongs to ` +
        'exactly one change',
    );
  }
  for (const change of commit.changes) {
    if (!CHANGE_NAME_PATTERN.test(change)) {
      problems.push(`Change "${change}" is not a kebab-case change name`);
    } else if (!knownChanges.has(change)) {
      problems.push(
        `Change "${change}" matches no folder under openspec/changes/ or ` +
          'openspec/changes/archive/',
      );
    }
  }
  return problems;
};

// Field separator inside a commit record and record separator between
// commits: the ASCII unit and record separators, which git never emits in a
// message. `git log --format` spells them as %x1f and %x1e.
export const FIELD = '\x1f';
export const RECORD = '\x1e';

export const parseLog = (log) =>
  log
    .split(RECORD)
    .map((record) => record.replace(/^\n/, ''))
    .filter((record) => record.length > 0)
    .map((record) => {
      const [hash = '', subject = '', trailers = ''] = record.split(FIELD);
      const changes = trailers
        .split('\n')
        .map((value) => value.trim())
        .filter((value) => value.length > 0);
      return { hash, subject, changes };
    });

const main = () => {
  const range = process.argv[2] ?? DEFAULT_RANGE;
  const format = '%H%x1f%s%x1f%(trailers:key=Change,valueonly)%x1e';
  const log = execFileSync(
    'git',
    ['log', '--no-merges', `--format=${format}`, range],
    { cwd: ROOT, encoding: 'utf8' },
  );
  const commits = parseLog(log);
  const knownChanges = listChangeNames(ROOT);

  let failed = false;
  for (const commit of commits) {
    for (const problem of checkCommit(commit, knownChanges)) {
      failed = true;
      console.error(
        `${commit.hash.slice(0, 7)} ${commit.subject}\n  ${problem}`,
      );
    }
  }
  if (failed) {
    console.error(
      '\nAdd a "Change: <change-name>" trailer in the footer block of the ' +
        'commit message (see AGENTS.md, "Per-change planning — OpenSpec").',
    );
    process.exit(1);
  }
  console.log(`${commits.length} commit(s) in ${range} checked.`);
};

if (process.argv[1] === import.meta.filename) main();
