// Sync shared code rules from the local source of truth (~/.claude/rules)
// into the repo (.claude/rules) so every executor — local, CI, cloud —
// reads the same rulebook. Run `bun run rules:sync` after editing a rule,
// then commit the diff.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RULES = [
  'metaskills-js-conventions.md',
  'metaskills-error-handling.md',
  'metaskills-js-gof.md',
  'metaskills-js-data-structures.md',
  'feedback_no_dto_in_js.md',
  'feedback_refactor_imports.md',
];

const source = join(homedir(), '.claude', 'rules');
const target = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '.claude',
  'rules',
);

if (!existsSync(source)) {
  console.error(
    `source not found: ${source} (run this on the machine that owns the rules)`,
  );
  process.exit(1);
}

mkdirSync(target, { recursive: true });

let copied = 0;
for (const name of RULES) {
  const from = join(source, name);
  if (!existsSync(from)) {
    console.warn(`missing in source, skipped: ${name}`);
    continue;
  }
  copyFileSync(from, join(target, name));
  copied++;
  console.log(`synced ${name}`);
}

console.log(`done: ${copied}/${RULES.length} rules synced`);
