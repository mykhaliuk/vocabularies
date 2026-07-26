---
name: No DTO layer in JavaScript
description: Don't introduce DTO classes / mapper-per-entity layers in JS/TS. Use plain objects, zod at boundaries, and a single projection function when shaping output. Applies when designing backend/domain architecture.
type: feedback
---

# No DTO layer in JavaScript

Do **not** introduce DTO classes or a mapper-per-entity layer in JS/TS. This is
Java cargo-culting — JavaScript already has the tools the DTO pattern exists to
provide elsewhere.

**Why:** A DTO (Data Transfer Object) class plus its hand-written mapper exists
in Java/C# to give a typed, decoupled shape at a boundary because those
languages lack cheap structural objects. JavaScript has object literals,
structural typing, spread/destructuring, zod schemas for boundary validation,
and ORM row types (e.g. Drizzle inferred types). Wrapping every entity in a
`FooDTO` + `toFooDTO()` mapper just copies fields around — it smears logic
across an extra layer for zero benefit. The user explicitly rejects this:
"DTO в JavaScript избыточен. Мы же не в Java. Зачем нам DTO?"

**How to apply:**

- At input boundaries, validate with a **zod schema**, not a DTO class. The
  parsed object IS the typed input.
- At output boundaries, a **single plain projection function** (e.g.
  `toPublicUser(user) => ({ email, displayName, hasAvatar })`) is fine and
  encouraged — that is serialization, NOT a DTO layer. The line: one small
  projection function per exposed shape = good; a `UserDTO` class + `UserMapper`
  + `toEntity`/`toDTO` round-trips = banned.
- In the **domain layer**, pass and return plain objects / ORM row types
  directly. Inject resources (db, mailer, storage) as a context object (the
  Context pattern), but do not wrap tables in Repository interfaces or rows in
  DTOs — the ORM is already the data-access abstraction.
- Composes with [[metaskills-js-gof]] ("do not over-engineer for the sake of
  the pattern name") and [[metaskills-js-conventions]] (plain objects, stable
  shapes).
