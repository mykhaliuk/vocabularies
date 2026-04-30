# Vocabu — DX & Tooling

## Local Development Modes

All modes run the Nuxt dev server locally. The difference is which backends they connect to.

| Script | DB | Storage | Auth | Rate Limiting | Purpose |
|---|---|---|---|---|---|
| `start:local` | Docker Postgres | Docker MinIO | bypassed | disabled | API testing, offline |
| `start:dev` | Neon dev | R2 dev | Resend dev | Upstash dev | Test against dev infra |
| `start:preprod` | Neon preprod | R2 preprod | Resend preprod | Upstash preprod | Final validation |

### Local infrastructure (Docker)

`start:local` brings up Docker containers before starting Nuxt:

- **Postgres 16** — port 5432
- **MinIO** — port 9000 (S3 API), port 9001 (console UI)

### Environment files

```
.env.example     ← committed template, all variables documented
.env.local       ← gitignored, Docker-compatible values
.env.dev         ← gitignored, dev cloud credentials
.env.preprod     ← gitignored, preprod cloud credentials
```

Scripts use `nuxt dev --dotenv .env.<stage>`.

---

## Code Quality Tooling

| Concern | Tool |
|---|---|
| Linting | **OxLint** |
| Formatting | **Oxfmt** |
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

| Tool | Scope |
|---|---|
| **Vitest** | Unit / integration |
| **Playwright** | E2E (auth, upload, feed, offline) |

---

## CI/CD

- **On PR:** lint + fmt:check + typecheck + vitest + playwright
- **On merge to main:** Vercel auto-deploys production
- **Preview deploys:** Vercel per-PR preview URLs
