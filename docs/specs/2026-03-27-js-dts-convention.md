# JS + .d.ts Convention

> **Status: RETIRED (2026-07-07).** The convention rested on an assumption
> that turned out to be false: a sibling `.d.ts` does NOT exempt the `.js`
> implementation from type-checking. Under the app realm's `checkJs: true` +
> `noImplicitAny` (`.nuxt/tsconfig.app.json`), any module-level function
> parameter in a `.js` file is an error that plain JS cannot fix without
> JSDoc — which rule 3 below forbids. The convention only ever "worked" in
> the server realm, where Nuxt does not propagate `checkJs`, i.e. where
> `.js` implementations are not checked at all. Verdict: the framework is
> built for TypeScript; fighting it costs more than it buys.
>
> Going forward: new app code (composables, utils, db, shared) is written
> in `.ts`. Existing `server/**` `.js`+`.d.ts` pairs keep working (their
> realm never checked implementations) and migrate opportunistically when
> touched. Standalone `scripts/*.js` (excluded from typecheck, run with
> plain node) stay JS.

## Principle

Server-side and shared code is written in plain JavaScript. Type contracts (interfaces, types, generics) live in co-located `.d.ts` declaration files — separate from logic, like C++ header/implementation pairs. Vue Single File Components are the only exception: their `<script>` blocks use TypeScript so refs, props, emits, and DOM event handlers can be typed without leaking ceremony into runtime files.

## File layout

```
module.js       ← implementation (logic, exports — no type annotations, no JSDoc)
module.d.ts     ← type declarations (interfaces, types, function signatures)
```

Example:

```
server/
  utils/
    db.js
    db.d.ts
    storage.js
    storage.d.ts
components/
  AudioPlayer.vue              ← <script setup lang="ts">
composables/
  useAudioRecorder.js
  useAudioRecorder.d.ts
```

## Rules

1. **No `.ts` implementation files.** Logic lives in `.js` (or `.mjs`). The exception is Vue SFCs: `<script setup lang="ts">` is allowed (and encouraged) so refs, props, emits, and DOM event types stay in the SFC where they belong. Compiled by Vite to JS at build time; runtime is unchanged.
2. **Every module that exports public API gets a sibling `.d.ts`** with full type declarations for every export. The `.d.ts` is the contract; consumers get full IDE intellisense from it.
3. **No JSDoc in `.js` files.** Runtime code stays clean of contract noise. Types come from:
   - the sibling `.d.ts` for module-level exports,
   - inferred context (typed parameters of the function the `.js` is passed into, e.g. `defineEventHandler`'s `event`),
   - runtime narrowing (`error instanceof Error`, `if (!value) return …`, `typeof x === 'string'`).
4. **API routes contain only business logic.** Anything that isn't business logic — helpers, system code, infrastructure — is extracted into `server/utils/*.{js,d.ts}` (or `db/schema/*.{js,d.ts}`, etc.). This is what makes rule 3 affordable: typing local helpers without JSDoc requires them to be exports of a real module.
5. **Vue SFC props / emits / slots** are declared with TS in the SFC's `<script setup lang="ts">` using `defineProps<T>()` / `defineEmits<T>()`. Heavier component types — composable inputs/outputs, store shapes — go in sibling `.d.ts` files alongside the composable's `.js`.
6. **Drizzle schema, server routes, middleware, nitro config, drizzle config, scripts** — all `.js` with `.d.ts` siblings where they export public API.
7. **`tsconfig.json`** uses Nuxt 4's project-references over the generated `.nuxt/tsconfig.{app,server,shared,node}.json`. `checkJs: true` and `noUncheckedIndexedAccess: true` are enforced via `nuxt.config.js`'s `typescript.tsConfig` so the strict checks apply uniformly across realms.
8. **No `any`. No abusive casts.** Strict TypeScript passes across the entire codebase with no escape hatches. If a third-party generic is hard to type in JS, wrap it in a tiny `.{js,d.ts}` pair (see `db/schema/bytea.*` for the pattern).

## Rationale

- **Runtime files read like the runtime.** No comments larger than the code; no `/** @param */` noise above every function.
- **Contracts are auditable as standalone artifacts.** A reviewer can read `auth.d.ts` and know what `auth.js` promises without reading either implementation or comments.
- **No build-time TypeScript compilation for runtime code** (Vue SFCs already compile through Vite either way; `lang="ts"` adds nothing to the runtime cost).
- **Strict TS coverage is non-negotiable.** Every file is checked, every parameter is typed, no `any` hides anywhere — but the typing pressure pushes towards the right architectural shape (extract helpers; thin routes) rather than scattering JSDoc.
