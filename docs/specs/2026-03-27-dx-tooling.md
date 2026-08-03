# Vocabu — DX & Tooling

## Local Development Modes

All modes run the Nuxt dev server locally. The difference is which backends they connect to.

| Script          | DB              | Storage      | Auth           | Rate Limiting   | Purpose                |
| --------------- | --------------- | ------------ | -------------- | --------------- | ---------------------- |
| `start:local`   | Docker Postgres | Docker MinIO | bypassed       | disabled        | API testing, offline   |
| `start:dev`     | Neon dev        | R2 dev       | Resend dev     | Upstash dev     | Test against dev infra |
| `start:preprod` | Neon preprod    | R2 preprod   | Resend preprod | Upstash preprod | Final validation       |

### Local infrastructure (Docker)

`start:local` brings up Docker containers before starting Nuxt:

- **Postgres 18** — port 5433 (matches Neon's major version; remapped from 5432 to avoid host-port collisions)
- **MinIO** — port 9100 S3 API / 9101 console UI (remapped from 9000/9001 to avoid host-port collisions)

### Environment files

```
.env.example     ← committed template, all variables documented
.env.local       ← gitignored, Docker-compatible values
.env.dev         ← gitignored, dev cloud credentials
.env.preprod     ← gitignored, preprod cloud credentials
```

Scripts use `nuxt dev --dotenv .env.<stage>`.

> **Historical record.** The command above is the original 2026-03-27 decision
> and is kept verbatim. The shipped implementation has since diverged: every
> stage script goes through `node scripts/with-env.js <stage> nuxt dev`, which
> loads `.env.<stage>` into `process.env` before spawning the inner command,
> rather than passing `--dotenv` to Nuxt. The README script table is the source
> of truth for current commands.

---

## Code Quality Tooling

> **Historical record.** The commands below are the original 2026-03-27
> decision and are kept verbatim. The shipped implementation has since
> diverged: `typecheck` is `nuxt typecheck` (which runs `vue-tsc -b --noEmit`
> over Nuxt's generated project references — a bare `tsc --noEmit` would check
> nothing), and `lint` passes an explicit directory list instead of `.`.
> The README script table is the source of truth for current commands.

| Concern       | Tool                            |
| ------------- | ------------------------------- |
| Linting       | **OxLint**                      |
| Formatting    | **Oxfmt**                       |
| Type checking | **TypeScript** (`tsc --noEmit`) |

### Scripts

```json
"lint": "oxlint .",
"fmt": "oxfmt .",
"fmt:check": "oxfmt --check .",
"typecheck": "tsc --noEmit"
```

---

## Testing

> **Historical record.** The table below is the original 2026-03-27 decision
> and is kept verbatim. The shipped implementation has since diverged: the unit
> runner is Bun's built-in test runner — `test:unit` is `bun test tests/unit`,
> and Vitest is a dependency of neither `package.json` section. Playwright is
> unchanged.

| Tool           | Scope                             |
| -------------- | --------------------------------- |
| **Vitest**     | Unit / integration                |
| **Playwright** | E2E (auth, upload, feed, offline) |

---

## CI/CD

> **Historical record.** The list below is the original 2026-03-27 decision and
> is kept verbatim. The shipped `.github/workflows/ci.yml` has since diverged
> into three jobs: `checks` runs `ds:check`, `proto:check`, `i18n:check`,
> `layering:check`, `graph:check`, `lint`, `fmt:check`, `typecheck` and
> `test:unit`; `e2e` runs `test:e2e`; and `e2e-authed` runs the authenticated
> Playwright suite against a seeded Postgres service container. There is no
> Vitest step.

- **On PR:** lint + fmt:check + typecheck + vitest + playwright
- **On merge to main:** Vercel auto-deploys production
- **Preview deploys:** `dev` auto-deploys a preview; other branches are
  skipped by default — opt in by ending the head commit subject with
  `[preview]` (case-insensitive; see `scripts/vercel-ignore.js`). The opt-in
  is per push: a follow-up commit without the marker leaves the previous
  preview stale.
