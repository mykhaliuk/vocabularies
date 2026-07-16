# Architecture Decision Records

One-page records of decisions that are **hard to reverse, surprising, or the
result of a real trade-off**. Not every choice needs one — routine picks live
in code comments and PR descriptions. The test: would a cold agent session
(worktree, CI `@claude`) plausibly re-litigate this? If yes, record it.

Rules:

- Before proposing to change or reverse an architectural decision, read the
  ADRs. Disagreeing is fine — but the argument must engage the recorded
  reasoning, not rediscover the question.
- A new hard-to-reverse decision lands as an ADR **in the same PR** that
  implements it.
- Superseding: never edit a decision retroactively. Add a new ADR, mark the
  old one `Superseded by ADR-NNNN`.
- Keep it one page. Context → Decision → Consequences → Alternatives rejected.

Format: `NNNN-short-slug.md`, template in [0000-template.md](0000-template.md).

## Index

- [ADR-0001](0001-ds-manifest-triad.md) — design system authored in the
  browser; the exported manifest is the contract, CI checks are the coupling
- [ADR-0002](0002-lazy-token-cleanup.md) — expired magic-link tokens swept
  lazily on write, not by cron
- [ADR-0003](0003-offline-sw-injectmanifest.md) — PWA offline via
  `injectManifest` custom service worker, not `generateSW`
- [ADR-0004](0004-i18n-no-prefix-cookie-locale.md) — i18n `no_prefix`
  strategy: locale is cookie/header state, not part of the URL
- [ADR-0006](0006-per-locale-static-landing.md) — per-locale prerendered
  landings (/, /fr, /uk) with baked copy and an Accept-Language entry
  redirect
