# JS + .d.ts Convention

## Principle

All implementation code is written in plain JavaScript. Type contracts (interfaces, types, generics) live in co-located `.d.ts` declaration files — separate from logic, like C++ header/implementation pairs.

## File layout

```
module.js       ← implementation (logic, exports)
module.d.ts     ← type declarations (interfaces, types, function signatures)
```

Example:

```
server/
  utils/
    services/
      db.js
      db.d.ts
      storage.js
      storage.d.ts
      email.js
      email.d.ts
components/
  AudioPlayer.vue
  AudioPlayer.d.ts
composables/
  useAudioRecorder.js
  useAudioRecorder.d.ts
```

## Rules

1. **No `.ts` implementation files.** All logic lives in `.js` (or `.mjs`, `.vue`).
2. **Every module that exports public API gets a sibling `.d.ts`** with its type declarations.
3. **JSDoc `@type` / `@typedef` / `@param`** in `.js` files may reference types from `.d.ts` for editor intellisense:
   ```js
   /** @type {import('./db.d.ts').CreateMomentParams} */
   const params = { ... };
   ```
4. **Vue SFC types** — component props, emits, and slots are declared in a sibling `.d.ts`. The `<script>` block uses JSDoc to reference them.
5. **Nuxt config** uses `nuxt.config.js` (not `.ts`). Drizzle schema, server routes, middleware — all `.js`.
6. **`jsconfig.json`** (not `tsconfig.json`) configures path aliases and editor support. `checkJs: true` enables type checking via `.d.ts` files without TypeScript compilation.

## Rationale

- Keeps type contracts explicit and reviewable as standalone artifacts
- No build-time TypeScript compilation — faster dev loop
- Full editor intellisense via `.d.ts` + JSDoc
- Clear separation of concerns: what a module does (`.js`) vs what it promises (`.d.ts`)
