# ADR-0001: browser-authored design system; the exported manifest is the contract

- Status: Accepted
- Date: 2026-06-07
- Refs: `50a3912`, `6f6a35e`, CLAUDE.md "Design system", `scripts/ds-check.js`, `scripts/proto-check.js`

## Context

The design system and the prototype are authored in Claude Design (in the
browser) and cannot run locally. The repo needs production CSS tokens and a
Vue UI that match the design — but nothing at authoring time can stop the
browser artifacts and the repo from drifting apart, because they are edited
in different tools by different processes.

## Decision

The exported snapshot `docs/design/design-system/project/_ds_manifest.json`
is the single source of truth. Three consumers are checked against it at
integration time: production CSS (`ds:check`, strict CI gate), the prototype
(`proto:check`, only DRIFT fails), and — via review — the Vue components.
Drift is not prevented; it is caught. **The coupling is the check, not a
convention.**

## Consequences

- Any CSS/token change must keep `ds:check` green; deliberate raw-hex
  exceptions are annotated `ds-allow-hex`.
- Production may extend the manifest (e.g. `--font-hand`) but never
  contradict it.
- When the browser DS changes, someone must re-export the manifest and
  reconcile — the checks tell them exactly where.
- The prototype's embedded DS copy lags by design; `ds-bridge.css` patches
  gaps until the prototype is re-bound in Claude Design.

## Alternatives rejected

- **Tokens hand-maintained in the repo as truth** — the design keeps being
  authored in the browser; the repo would silently diverge from what the
  designer sees.
- **Convention only ("keep them in sync")** — unverifiable; drift was
  already observed between kit JSX and brand rules (chip radius).
