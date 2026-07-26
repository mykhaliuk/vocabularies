# No TypeScript enums

Never use `enum` or `const enum` in TypeScript. Express a closed set of values
as an `as const` tuple plus a derived literal union, or as a POJO / `Map`
lookup.

**Why:** The user asked for this explicitly (2026-07-25, Vocabu VKB-91):
"Never use TS enums. Use POJO or other JS structures instead". A TS `enum` is
the one TypeScript construct that emits runtime code — a reverse-mapped
object — so it is not type-erasable: it breaks `isolatedModules` /
`erasableSyntaxOnly`, it cannot be erased by type-stripping runtimes (Node's
`--experimental-strip-types`, bun's transpiler, esbuild in some modes), and it
cannot be reduced to an `import type`. Numeric enums are also unsound — any
`number` is assignable to one. A literal union gives the same exhaustiveness
with zero runtime footprint, and it is the shape the rest of the JS ecosystem
already speaks.

**How to apply:**

- Closed set of values:
  ```ts
  export const PLAN_TIERS = ['free', 'essentials', 'premium'] as const;
  export type PlanTier = (typeof PLAN_TIERS)[number];
  ```
- Value→value mapping: a frozen plain object typed `Record<Key, Value>`, which
  additionally makes a missing key a typecheck error.
- Library builders that PRODUCE a literal union are fine and preferred —
  Drizzle's `pgEnum(...)` with `(typeof planTier.enumValues)[number]`, zod's
  `z.enum([...])`. These are not TS enums; do not "fix" them.
- Applies to `.ts` and `.vue` alike. When touching existing code that uses a TS
  enum, convert it in the same pass rather than leaving a mixed codebase.
- Composes with [[metaskills-js-conventions]] (plain objects, stable shapes,
  string literals for status codes) and [[feedback_no_dto_in_js]] — both push
  the same way: do not import Java/C#-shaped constructs into JavaScript when
  the language already has a cheaper structural answer.
