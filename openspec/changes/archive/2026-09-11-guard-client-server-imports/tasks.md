## 1. The rule

- [x] 1.1 In `scripts/layering-check.js`, add the client roots (`pages`,
      `components`, `composables`, `layouts`, `middleware`, `plugins`,
      `utils`, `shared`) and teach the walker `.vue`, since that is where most
      of these imports live.
- [x] 1.2 Add a statement-aware classifier per D3/D4 and export it: a
      statement touching a `server/` or `db/` specifier passes only when
      everything it brings across is type-only. Side-effect imports, dynamic
      imports and value re-exports fail.
- [x] 1.3 Report `file:line — specifier` with a message that says what to do,
      matching the existing half's phrasing.
- [x] 1.4 Update the script's header comment: it currently describes one
      direction, and this is exactly the kind of comment that goes stale into
      a lie.

## 2. Pin it

- [x] 2.1 `tests/unit/layering-check.test.ts` covering every case in D4,
      including the multi-line import that motivated D3 and a specifier
      spelled `~~/`, `@/` and relatively.
- [x] 2.2 Include the negative direction: an import from a NON-server module
      must not be flagged, or the check would fail the whole client tree.
- [x] 2.3 `bun run test:unit` green.

## 3. Prove it can fail

- [x] 3.1 Seen red twice, on the two shapes that matter. Dropping `type` from
      `components/feed/EntryCard.vue` (single line) failed at `:2`; dropping it
      from `composables/useEntryPlayback.ts` (four lines, `from` on the last)
      failed at `:8`. The second is the one a line-based check would have
      missed, which is why D3 exists.
- [x] 3.2 Restore it and confirm the check passes on the tree as it stands.

## 4. Docs

- [x] 4.1 `AGENTS.md` described `layering:check` as "zero db references in
      transport, no exceptions". Now both directions, with the client roots
      named and the lexical limit stated. ADR-0010 left alone: it is dated and
      stands as the record of its own decision time.
- [x] 4.2 `// @ts-nocheck` on the script, following `check-commits.js` — a
      unit test importing it drags a plain-JS CLI into vue-tsc's graph, and
      the repo already answers that exactly this way rather than by typing the
      script.

## 5. Ship

- [x] 5.1 Full check set from AGENTS.md, not a subset — all green, with
      329 unit tests, smoke 24 and authed 221.
- [x] 5.2 `docs/PR-CHECKLIST.md`, including the adversarial `/code-review`;
      fix confirmed findings before opening.
- [x] 5.3 Commit as `chore(...)` — tooling, so no `Change:` trailer is
      required by `commits:check`; `Closes VKB-181` on the PR, opened ready
      against `dev`.
- [x] 5.4 Archive the change in this PR. `skip_specs: true`: a check is not
      behaviour, and no requirement here is one a person could observe.

## 6. Review round

Six findings, five of them silent false negatives — the guard reporting a
clean tree while a real value import sat in it. That is the one failure mode
a guard must not have, so each one now has a test.

- [x] 6.1 **A statement swallowed the one after it** (medium/high). The lazy
      clause was bounded by `[^;=]`, which stops at an assignment but not at a
      statement that simply ends: `export type { Helper }` with no semicolon
      ran on to the NEXT import's `from`, and the merged clause still read as
      type-only — so a real value import from `~/server/**` passed, and
      `matchAll` had already consumed it, so it could never match on its own.
      Bounding a regex by what it may not contain is a race that cannot be
      won; the parser now slices the source at statement starts and matches
      inside one slice at a time, which makes the swallow impossible by
      construction and gives exact line numbers for free.
- [x] 6.2 **Template-literal dynamic imports slipped past** (medium) —
      ``import(`~/server/x`)`` resolves like any other, while the header and
      AGENTS.md both promised dynamic imports fail.
- [x] 6.3 **`app.vue`, `error.vue` and `service-worker/` were never scanned**
      (medium). The roots list held directories only, so the two client entry
      points and a whole `srcDir` were outside the guard. 61 -> 65 files.
- [x] 6.4 **Block comments shifted every line number after them** (low), the
      stripper having deleted their newlines. They are blanked in place now.
- [x] 6.5 **A glob in a string opened a comment** (low). `'**/*.ts'` made the
      stripper erase everything to the next `*/`, taking real imports with it
      — a false negative dressed as a formatting detail. Only block comments
      that OPEN a line are stripped now.
- [x] 6.6 **A package path containing `db/` or `server/` was flagged** (low,
      the only false positive): `idb/build/db/index.js` failed the check. The
      specifier must now be project-internal (`~/`, `~~/`, `@/`, relative)
      before the segment match applies.
- [x] 6.7 Re-ran the set: 286 unit tests, all gates green, 65 client files
      clean.
- [x] 6.8 Second review of this delta, then commit.

## 7. Second review round

The round that justified the whole ticket: the guard was found reporting a
clean tree while a live violation of its own rule sat in the repo.

- [x] 7.1 **`sentry.client.config.js` value-imports from `server/`** (HIGH).
      Root-level files were not scanned, so this shipped past the check —
      which also made proposal.md's "every import already complies" false.
      The module is imported by BOTH Sentry configs, so it is shared by
      construction and now lives in `shared/sentry-scrub.ts`; the rule is not
      weakened to fit it. `docs/capability-graph.md` regenerated for the move,
      and both e2e suites re-run green (24 + 221) because it touches the
      Sentry wiring.
- [x] 7.2 **Root files are now a denylist, not an allowlist.** The fix for
      7.1 could have been "add one more filename", which is the same trap one
      name later. Every root-level code file is scanned unless it is named in
      `ROOT_FILES_NOT_BUNDLED` (the node-side configs), so the failure mode
      flips from a silent miss to a loud false positive.
- [x] 7.3 **Two statements on one line hid the second** (low/medium). Cutting
      only at line starts meant `import a from 'x'; import b from
      '~/server/y';` reported nothing. Statements now also start after a
      semicolon.
- [x] 7.4 **`import.meta.glob` was not covered** (low). Vite's glob import
      pulls every match into the bundle — the same escape the header promised
      dynamic imports could not take.
- [x] 7.5 **False positives had no escape hatch** (low). A line-start import
      inside a template literal, a mid-line block comment, an `import()`
      inside a string — all lexical limits this guard accepts by design, but
      accepting them without an out means a compliant file can fail CI with
      nothing to do about it. `// layering-allow: <reason>` on the statement
      or the line above now suppresses one, and a reason is required so it
      reads as a decision rather than a mute button.
- [x] 7.6 **AGENTS.md listed roots that no longer matched the script** (low)
      — and since 7.1 was exactly a missed root, that list is what the next
      person extends from.
- [x] 7.7 43 unit tests, every finding from both rounds among them; full
      check set green including the regenerated graph.
- [x] 7.8 Third review, then commit.

## 8. Third review round

Both findings said the same thing from different angles: the guard was
narrower than the project it guards.

- [x] 8.1 **Two live aliases were outside the guard** (medium, proved
      end-to-end). `.nuxt/tsconfig.app.json` — the CLIENT project — maps
      `@@/*` and `#server/*` as well as `~/`, `~~/` and `@/`. Dropping a probe
      file with `import { useStorage } from '@@/server/utils/storage';` into
      `utils/` made the check print `clean ✓` and exit 0: a value import of
      the S3-bearing module, passing with no signal, which is the exact
      failure this change exists to end. `#server/` needed its own branch
      besides — the segment test looks for `/server/`, which that spelling
      never contains. Nuxt's own import protection covers `#server/…` but not
      `@@/server/utils/…`, so one was defence in depth and the other was
      nothing at all.
- [x] 8.2 **The annotation could not reach the `from` line** (low). It was
      read off the statement's first line and the one above, while imports
      here routinely span four with `from` on the last — which is where
      someone would write it. An annotation that looks correct and silently
      does nothing is worse than no annotation. It now spans the statement.
- [x] 8.3 303 unit tests; full check set green.
- [x] 8.4 Fourth review; ship if it finds nothing structural.

## 9. Fourth review round

Three more silent escapes and one accidental mute button.

- [x] 9.1 **A dynamic import with a second argument was invisible** (medium).
      `DYNAMIC_RE` demanded the closing paren right after the specifier, so
      `import('~/db/schema/media', { with: { type: 'json' } })` — and even a
      trailing comma — reported nothing. The paren bought nothing: the
      specifier is already delimited by its quote.
- [x] 9.2 **`db/` matched anywhere in a path** (low/medium), so
      `~/utils/db/local` — an IndexedDB store this PWA could plausibly grow —
      was a violation of a rule about the schema. Aliases are repo-root
      relative, so the segment must come FIRST; relative specifiers are now
      resolved against the importing file, which is why the classifier takes
      one. Making an offline store's author write an allow-annotation would
      have hollowed the annotation out, which is the deeper cost of a
      false positive in a guard.
- [x] 9.3 **`import {} from '…'` passed as type-only** (low). The `every`
      over an empty binding list is vacuously true, while at runtime an empty
      clause evaluates the module exactly like a side-effect import — so the
      SDK ships and the guard says nothing.
- [x] 9.4 **The annotation was matched against the raw line** (low), so
      `const s = 'layering-allow: nope';` above an import muted a real
      violation. It must sit in a comment now.
- [x] 9.5 311 unit tests, 61 of them on this classifier; full check set green.
- [x] 9.6 Fifth review, then commit.

## 10. Fifth review round

- [x] 10.1 **The annotation excused the NEXT statement** (the worst kind
      again). `allowed()` scanned from the line above, so a TRAILING
      annotation — one that belongs to the import it sits on — reached
      downwards and muted the import after it. `import { a } from
      '~/server/a'; // layering-allow: pure` followed by a real
      `~/server/utils/storage` value import reported nothing. The line above
      must now be a stand-alone comment; a trailing one only covers its own
      statement.
- [x] 10.2 **A symlinked path turned the whole guard off** (medium).
      `import.meta.filename` is realpath'd by the ESM loader while
      `process.argv[1]` is not, so running the script through a symlink made
      the entry guard fail, print NOTHING and exit 0 — a green check that
      scanned zero files. Both sides are realpath'd now. Verified by running
      it through a symlinked directory: before, silence; after, the usual
      summary.
- [x] 10.3 **`/* @vite-ignore */` before a specifier hid a dynamic import**
      (medium). That comment and `webpackChunkName` are idiomatic in Nuxt, so
      this was a reachable bypass rather than a theoretical one. Both dynamic
      and glob patterns now tolerate a comment before the quote.
- [x] 10.4 **A statement beginning after a mid-line `*/` was invisible**
      (low) — another member of the same family, closed by letting a
      statement start there too.
- [x] 10.5 **Barrel imports escaped** (low): `~/db`, `~/server` and `#server`
      have no trailing slash, and the root test demanded one. Latent today —
      there is no `db/index.ts` — and adding one would silently have opened
      the door.
- [x] 10.6 **Directories were still an allowlist** while root files had become
      a denylist — the asymmetry the header had just finished arguing
      against. Both are denylists now, so a new bundled top-level directory
      is scanned by default. Same 67 files either way today, which is the
      point: the change is in what happens to the file nobody remembers.
- [x] 10.7 322 unit tests, 72 on this classifier; full check set green.
- [x] 10.8 Sixth review.

## 11. Sixth review round, and where the loop stops

The first round with no medium or high finding, and the reviewer independently
established the guard is not vacuously green: stripping `type` from all
fifteen real `~/server/**` imports makes it fire on every one, the multi-line
shape included.

- [x] 11.1 **`type` had to qualify something** (low). `import type from '…'`
      is a default import of a runtime export called `type`, and
      `{ type as kind }` renames one — both read as type-only to a predicate
      that only checked the first word. Both are values now; `type A`,
      `type A as B` and `import type X` still pass.
- [x] 11.2 **A bare re-export could reach a `from` in a later string** (low,
      and loud rather than silent). `export { useFoo }` followed by
      `console.log('from "~/server/a"')` reported a violation that did not
      exist. An import clause contains no quotes, so the clause now excludes
      them.
- [x] 11.3 **AGENTS.md still read as an allowlist** (low) while the code had
      become a denylist in both halves — the exact inference that would lead
      the next person to register a new directory instead of trusting the
      guard.
- [x] 11.4 **One finding was NOT taken, deliberately.** A template literal
      whose content has a line starting with `/*` pairs with a later `*/`,
      and an import between them is missed. The fix — requiring every line of
      a block to look like a comment — was written, and the existing spec
      caught it breaking the ordinary case: a commented-out block of imports,
      whose inner lines are plain code, would fail CI on compliant work. A
      regex cannot tell a comment from text shaped like one. The narrower
      miss is the cheaper of the two errors, and it is now stated in the
      script header rather than left for the next reviewer to rediscover.
- [x] 11.5 **Stopping here.** Six rounds found 6, 6, 2, 4, 6, 4. Every round
      but the last turned up a silent false negative, which is why each got
      its own review instead of inheriting the previous verdict. This one
      found nothing structural, its fixes are three narrow predicates with
      tests, and what remains is the lexical limit the change has claimed
      from the first draft. 329 unit tests, 79 on this classifier.
