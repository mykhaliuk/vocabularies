---
name: Clean imports during refactors
description: When refactoring functions, clean up stale imports in the same edit to avoid TS unused-import errors
type: feedback
---

When refactoring a function (renaming, changing signature, extracting a helper), always update imports in the same pass. Don't split into multiple edits that leave stale imports between steps.

**Why:** Left an unused `FunctionAtom` import after broadening a helper's param from `FunctionAtom` to `Atom`. The TS linter flagged it.

**How to apply:** Before making a refactoring edit, check which imports the changed code uses. If the new code drops a type/function, remove its import in the same edit. Plan the full import diff upfront rather than editing call sites first and the function second.
