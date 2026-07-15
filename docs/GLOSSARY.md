# Glossary

The project's settled vocabulary. Pure lexicon — what things are called and
what the word means, never how they are implemented. Use these terms in UI
copy, code identifiers, commits, issues, and design discussion; if a new term
crystallizes during planning, add it here in the same PR.

## Product

- **word** (also **headword**) — the memorable word or phrase being kept;
  the thing a dictionary entry is about. Rendered in the handwritten face.
- **gloss** — the short explanation attached to a word: what it means, in
  plain warm language. Not a formal definition.
- **speaker** — the person the word belongs to; whose way of talking is
  being remembered.
- **loved** — the heart-marked state of an entry. The term is _loved_ — not
  "liked", "starred", or "favorited" — and only the heart ever fills.
- **collection** — a named group of words curated by a user.
- **magic link** — the emailed one-time sign-in link; the only way in, there
  are no passwords.

## Platform

- **stage** — one of the three runtime environments: `local`, `dev`,
  `preprod`. A stage is selected per command, not per checkout.
- **canon** — the exported design-system manifest; the single source of
  truth every design artifact is checked against.
- **the triad** — the three consumers of canon kept in sync by checks:
  production CSS, the prototype, and the Vue UI.
- **bridge** — the prototype's patch layer covering tokens its embedded
  design-system copy lacks; temporary by definition.
- **drift** — a real disagreement between an artifact and canon; the only
  design-check verdict that fails CI.
- **prototype** — the browser-authored clickable mock of the app; reference
  for behaviour and layout, never production code.
- **kit** — the design-system UI primitives (JSX) mirrored into Vue; loses
  to canon and the brand rules when they disagree.
- **primary worktree** — the main repo checkout; owns the real env files.
- **agent worktree** — a disposable checkout an agent works in; borrows its
  runtime config from the primary.
- **milestone tag** — the `m<N>` git tag marking a verified ROADMAP
  milestone.
