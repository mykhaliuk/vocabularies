## 1. Commit the installed tooling

- [x] 1.1 Add `openspec/config.yaml` and the `specs/` and `changes/archive/` trees
- [x] 1.2 Add the `.claude/commands/opsx/` slash commands
- [x] 1.3 Confirm nothing in `.gitignore` excludes either path
- [x] 1.4 Pin `@fission-ai/openspec@1.9.0` as a devDependency, so the gate does not
      depend on a global install that CI does not have
- [x] 1.5 Exclude `.claude/commands/opsx` from oxfmt — generated files, same
      category as `.claude/rules` and `docs/capability-graph.md`

## 2. State the contract

- [x] 2.1 Add the OpenSpec section to `CLAUDE.md`: artifact locations, when a change
      folder is required, how it relates to Linear, ADRs and the capability graph
- [x] 2.2 Point the agent execution contract at it, next to the check list
- [x] 2.3 Record ADR-0020 with the boundary against the existing artifacts

## 3. Make it checkable

- [x] 3.1 Add `spec:check` and `spec:status` to `package.json`
- [x] 3.2 Watch it fail before trusting it: dropping `skip_specs` turns this change
      red and exits 1; restoring it exits 0. The first reading was a false green —
      `$?` after a pipe returns `tail`'s code, not the validator's
- [x] 3.3 Write the CI step the owner has to push (VKB-175)

## 4. Follow-ups, filed not done

- [x] 4.1 CI wiring — VKB-175
- [x] 4.2 No specs-backfill ticket, on purpose: ADR-0020 rejects bulk backfill
      outright, and deferring it to a follow-up would be the same decision in
      disguise

## 5. Ship

- [x] 5.1 Full CI-mirroring check set green: lint, fmt:check, typecheck,
      typecheck:e2e, test:unit (234 pass), ds:check, proto:check, i18n:check,
      layering:check, graph:check, spec:check
- [x] 5.2 Archive this change inside the PR
- [x] 5.3 Open the PR as ready, assign the owner, `Closes VKB-174`
