#!/usr/bin/env node
// Symlink gitignored runtime-config files from the primary git worktree into
// the current one. Agent worktrees live under .claude/worktrees/* and are fresh
// checkouts, but the env files (.env.local/.env.dev) are gitignored
// and therefore absent — so `bun run start:*` fails there. This links them back.
//
// Idempotent and safe to run anywhere: a no-op in the primary worktree, skips
// files that already resolve, never clobbers a real (non-symlink) file, and
// swallows operational errors so a SessionStart hook can never break a session.
//
// Usage:
//   node scripts/link-worktree-env.js         link into the current worktree
//   node scripts/link-worktree-env.js --all    link into every linked worktree

import { execFileSync } from 'node:child_process';
import {
  existsSync,
  lstatSync,
  readlinkSync,
  symlinkSync,
  unlinkSync,
} from 'node:fs';
import { relative, resolve, join, dirname } from 'node:path';

// Gitignored files that a worktree needs to actually run the app. Tracked
// files (.env.example) are already present in every checkout, so they are not
// listed here. node_modules/.nuxt/.output are intentionally excluded — they are
// per-worktree build state, not shared config.
const RUNTIME_FILES = ['.env', '.env.local', '.env.dev'];

const git = (args, cwd) =>
  execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();

const listWorktrees = (cwd) => {
  // `--porcelain` lists the primary worktree first, then linked ones.
  const out = git(['worktree', 'list', '--porcelain'], cwd);
  const paths = [];
  const lines = out.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && line.startsWith('worktree ')) {
      paths.push(line.slice('worktree '.length).trim());
    }
  }
  return paths;
};

const linkFile = (primaryDir, targetDir, name) => {
  const source = join(primaryDir, name);
  if (!existsSync(source)) return 'absent';

  const dest = join(targetDir, name);
  const relTarget = relative(dirname(dest), source);

  if (existsSync(dest) || isSymlink(dest)) {
    if (isSymlink(dest) && readlinkSync(dest) === relTarget) return 'ok';
    // A real file is a deliberate local override — leave it untouched.
    if (isSymlink(dest)) unlinkSync(dest);
    else return 'kept-file';
  }

  symlinkSync(relTarget, dest);
  return 'linked';
};

const isSymlink = (path) => {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
};

const linkInto = (primaryDir, targetDir) => {
  const linked = [];
  for (let i = 0; i < RUNTIME_FILES.length; i++) {
    const name = RUNTIME_FILES[i];
    const result = linkFile(primaryDir, targetDir, name);
    if (result === 'linked') linked.push(name);
  }
  return linked;
};

const main = () => {
  const all = process.argv.includes('--all');
  const cwd = process.cwd();

  const worktrees = listWorktrees(cwd);
  if (worktrees.length < 2) return; // only the primary exists; nothing to link

  const [primaryDir] = worktrees;
  const current = git(['rev-parse', '--show-toplevel'], cwd);
  const targets = all
    ? worktrees.slice(1)
    : current === primaryDir
      ? []
      : [current];

  for (let i = 0; i < targets.length; i++) {
    const target = resolve(targets[i]);
    if (target === primaryDir) continue;
    const linked = linkInto(primaryDir, target);
    if (linked.length > 0) {
      const where = relative(primaryDir, target) || target;
      console.log(`[link-worktree-env] ${where}: linked ${linked.join(', ')}`);
    }
  }
};

try {
  main();
} catch (error) {
  // Operational only (not a git repo, git missing, races): never fail the
  // caller — running the app without the symlinks just surfaces its own error.
  console.error(`[link-worktree-env] skipped: ${error.message}`);
}
