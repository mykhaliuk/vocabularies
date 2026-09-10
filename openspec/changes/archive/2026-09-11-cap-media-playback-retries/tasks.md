## 1. Pin the rule where CI can see it

- [x] 1.1 Add `utils/playback-retry.ts`: the refresh allowance per D4/D5 — a
      factory holding one refresh, an operation that spends it and reports
      whether it was available, and one that restores it. No DOM, no reactive
      state, no imports.
- [x] 1.2 Add `tests/unit/playback-retry.test.ts` covering the rule directly:
      the first spend succeeds, the second is refused, a restore makes the next
      spend succeed again, and a restore without a preceding spend does not
      bank a second allowance.
- [x] 1.3 Run `bun run test:unit` and see 1.2 pass.

## 2. Bound the audio player

- [x] 2.1 In `components/feed/AudioPlayer.vue`, keep `retrying` as the
      in-flight guard it also is — a second `error` arriving while a refresh is
      still in the air must not start a second refresh — and add the allowance
      from 1.1 as the cap: `onError` spends it, and when it is gone stops
      resolving and lands in the existing `failed` state.
- [x] 2.2 Superseded in group 7: a `playing` listener restored the allowance
      here, which left media that plays and then fails looping unbounded. The
      listener is gone; only a tap restores (D2).
- [x] 2.3 Restore the allowance when `startPlayback` begins a user-initiated
      attempt (D3), so `failed` is retryable by tapping play.
- [x] 2.4 Replace the stale comment above `onError` — it currently describes
      the unbounded behaviour as intentional. State the bound, or delete the
      comment if the code says it.

## 3. Bound the video player

- [x] 3.1 Apply 2.1 to `components/feed/VideoPlayer.vue`, whose `onError` has
      the same shape and the same stale comment on its `retrying` flag.
- [x] 3.2 Superseded in group 7, as 2.2: the `@playing` binding is gone.
- [x] 3.3 Restore the allowance in `expand` and in the play branch of
      `toggle` — both are user-initiated attempts (D3). The `toggle` half was
      dropped during group 7 and this tick was left standing; the second
      review caught the false record, and it is wired again (7.9).
- [x] 3.4 Replace or delete the stale `retrying` comment, as in 2.4.
- [x] 3.5 Both players carry a comment claiming "nothing in CI ever looks at
      this component". Check it per player rather than fixing both: `grep`
      shows `e2e/authed/` drives the audio player twice (`media-ready`,
      `playback-cache`) and never touches the video one. So the claim is
      false in `AudioPlayer.vue` — correct it — and still true in
      `VideoPlayer.vue`, where it must be left alone. Replacing a true
      comment to match a task description would be the same defect this task
      exists to fix.

## 4. Prove the bound

- [x] 4.1 Add `e2e/authed/playback-retry.spec.ts` per D6, modelled on
      `playback-cache.spec.ts`: same `NO_STORAGE` skip, same
      `serviceWorkers: 'block'`, entry driven to `ready` through the real
      path, run on the feed (the detail page primes the cache from SSR and
      would simply play).
- [x] 4.2 Inject the failure by rewriting the API's own answer, replacing the
      playback URL with one that cannot load. Intercepting the bucket GET was
      tried first and rejected: it depends on how the engine fetches media,
      which is the very thing under test.
- [x] 4.3 Press play and assert the exact number of `/api/entries/:id`
      resolves, plus that the player settles failed and is not showing as
      playing.
- [x] 4.4 Confirm the spec fails against the unfixed players — and find out
      why it did not. On Chromium it PASSES pre-fix: 2 resolves either way,
      because Chromium delivers the next `error` while `retrying` is still
      set. The loop is engine-dependent. Measured with an isolated repro of
      the same handler, 5s against an unreachable source: Chromium 1
      re-entry, WebKit 61. Through the real player: Chromium 2 resolves,
      **WebKit 172 unfixed vs 2 fixed** — red before, green after.
- [x] 4.5 Add a `webkit-media` project to `playwright.authed.config.ts`,
      scoped to this one spec and gated behind `E2E_WEBKIT=1` (D7). CI
      installs Chromium only, and adding WebKit there is a workflow edit the
      agent PAT cannot push.
- [x] 4.6 File the follow-up: the authed suite has no real WebKit engine, and
      the project named `phone` is Chromium emulating an iPhone. Carry the
      measurement above as the evidence, since it is a defect class CI cannot
      currently see. Filed as VKB-183; the silent expanded video frame from 5.6 is VKB-184.
- [x] 4.7 Run `bun run test:e2e:authed` green with the fix in place — 223
      passed across the final run (see 8.1 for the flake seen twice en route).

## 5. Verify by hand, in the owner's browser

All counts below are Chromium against the local stack, with the fix in place.
Chromium already bounded the loop before the fix (group 4), so this half
verifies the wiring and the visible outcome, not the bound.

- [x] 5.1 No object had to be removed: the owner's three audio rows are
      already `ready` with no object in the bucket — uploaded while
      `S3_ENDPOINT` pointed at R2. That is the ticket's production scenario,
      live, so `.env.local` was left untouched.
- [x] 5.2 Feed, broken audio ("Папилёс"): **2 `/api/entries/:id` + 2 bucket
      GETs (503)**, then the player settles showing "impossible de lire
      celui-ci pour l'instant." and stops.
- [x] 5.3 A second broken audio ("Питана") while the first sits failed: **2
      requests**, the same bound, independent — they do not compound.
- [x] 5.4 Tapping a failed player again cost **0 further requests** — which
      this task first recorded as better than expected, and which was in fact
      the defect the review named as 7.1: the player was dead, not thrifty.
      Re-measured after the fix: **2 further requests**, the same bound again,
      so the second tap is a real second attempt.
- [x] 5.4a Trap worth naming: the first re-measurement was taken against a
      dev server that had gone stale through the revert/restore churn — it
      was still serving the ORIGINAL component. Confirmed by fetching the
      transformed module and grepping it for a symbol only the new code has,
      then restarting the server. It happened AGAIN after round 3, so treat
      it as the rule and not the exception: a hand-check is worth nothing
      until the server is proven to be serving the code under test. The e2e
      suites never had this problem — they run `nuxt build` from source.
      Re-confirmed after round 3 on a server started from a cleared cache:
      2 requests per tap, two taps, and the row reads "impossible de lire
      celui-ci pour l'instant." with the play glyph, not pause.
- [x] 5.5 Detail page (the `big` variant): **1 request** — the first play is
      served from the SSR-primed cache, leaving only the single refresh.
- [x] 5.6 Video: parked one object in MinIO, tapped it — **2 requests**,
      bounded, matching audio. Restored the object and confirmed it plays
      normally. One finding, pre-existing and NOT fixed here: once expanded,
      the video frame shows no failure copy at all, because
      `playbackUnavailable` lives only in the collapsed row's duration slot.
      Bounded but silent. Filed as VKB-184 — and then fixed here after all,
      because the review's 7.1 fix for video IS collapsing back to the row
      (7.3). Re-verified: the player collapses and the row reads "impossible
      de lire celui-ci pour l'instant.".

## 6. Ship

- [x] 6.1 Run the full check set from AGENTS.md, not a subset: `ds:check`,
      `proto:check`, `i18n:check`, `layering:check`, `graph:check`,
      `spec:check`, `commits:check`, `lint`, `fmt:check`, `typecheck`,
      `typecheck:e2e`, `test:unit`, `fonts:check`, `test:e2e`,
      `test:e2e:authed`. Record any that infra prevents running.
- [x] 6.2 Run `docs/PR-CHECKLIST.md`, including the adversarial
      `/code-review` pass; fix confirmed findings before opening the PR.
- [x] 6.3 Commit as `fix(...)` with the `Change: cap-media-playback-retries`
      trailer and `Closes VKB-182` on the PR; open it ready against `dev`,
      assigned to the owner. State in the body what the e2e spec covers, that
      the video path is hand-verified, and the measured before/after counts.
- [x] 6.4 Archive the change (`openspec archive`) in this PR so
      `openspec/specs/media-playback/spec.md` lands with the fix.

## 7. Review round

The adversarial `/code-review` pass found six, all confirmed. Two were defects
in the design, not the typing of it, and both are fixed here rather than
filed.

- [x] 7.1 **Restoring on a tap produced no new attempt** (high). `play()` on
      an element whose `error` is set rejects without re-running resource
      selection and without firing another `error`, so `onError` never ran and
      the restored allowance was never spent — the player stayed dead for the
      whole mount. Worse, the hand-verification in 5.4 had *measured* this (0
      requests on a repeat tap) and recorded it as better-than-expected
      instead of noticing it contradicted the change's own spec. Audio now
      discards and rebuilds its element; video collapses and re-expands (D3).
- [x] 7.2 **Restoring on `playing` left an unbounded loop** (medium). Media
      that produces output and then fails refilled the allowance every cycle:
      `playing` → restore → `error` → refresh → `playing` → … A corrupt
      transcode or a mid-stream drop reaches it. The listener is removed; only
      a tap restores (D2).
- [x] 7.3 **A video giving up while expanded said nothing** (medium). `failed`
      renders only in the collapsed row. Collapsing on give-up (7.1) fixes it
      with no new copy, so VKB-184 is now narrower than filed — updated there.
- [x] 7.4 **The request-count assertion raced the refresh** (medium). `failed`
      is set by the `play()` rejection, which can land before the refresh it
      triggered is issued, so the visible state settles ahead of the count.
      Now `expect.poll`, with the settle check kept after it.
- [x] 7.5 **The spec's CORS comment described a mechanism that does not
      exist** (low). Neither player sets `crossOrigin`, so the media request is
      no-cors and a cross-origin host fails no differently from a same-origin
      404. The claim is gone and the URL is same-origin again — a comment that
      is wrong is worse than none, which is twice this change has been caught
      by that.
- [x] 7.6 **`webkit-media` inherited its engine from the device preset**
      (low). Every other project pins `browserName` away from webkit, so the
      one that must be webkit now says so explicitly.
- [x] 7.7 Re-run the full set against the new diff, and re-review the delta —
      a fix round gets its own review, it does not inherit the last one.
- [x] 7.8 **A tap could pull the element out from under an in-flight retry**
      (medium, introduced by 7.1). `onError` re-read `audioEl` after its
      await, and 7.1 newly let a tap discard and rebuild it in exactly that
      window: the refreshed URL would land in the *newer* attempt's element,
      restarting its load and spending a resolve the bound is supposed to
      save. `starting` and `retrying` each guard their own function and
      neither guards the other. Both players now capture the element before
      the await and bail if it has been replaced — video reaches the same
      window through a manual collapse and re-expand.
- [x] 7.9 **Restored the allowance in the video's `toggle`**, which 3.3 claims
      and group 7 had silently dropped. Resuming an expanded player is a
      request from the person exactly as expanding it is (D2).

## 8. Checks

- [x] 8.1 Full set from AGENTS.md, all green: `ds:check`, `proto:check`,
      `i18n:check`, `layering:check`, `graph:check`, `spec:check`,
      `commits:check`, `lint`, `fmt:check`, `typecheck`, `typecheck:e2e`,
      `test:unit` (255), `fonts:check`, `test:e2e` (24), `test:e2e:authed`
      (223). Nothing was skipped for infra: Postgres and MinIO were up.
      One caveat, not swept under the rug: across five full authed runs,
      `compose-edit.spec.ts` "the question is about the changes, never about
      the word" failed once on chromium. Re-run 3x it passed 54/54, it shares
      no code path with this diff, and CI retries twice — a pre-existing
      flake, filed separately rather than counted as green here.
- [x] 8.2 `test:e2e:authed` needs `COMPOSE_PROJECT_NAME=vocabu` from a
      worktree, or `infra:up` derives a project name from the directory and
      collides with the running containers.
- [x] 8.3 Red/green on the engine that matters: WebKit 173 resolves unfixed
      against 2 fixed; the spec passes on chromium, phone and webkit-media
      with the fix.
- [x] 8.4 Re-run the set against 7.8/7.9 and re-review that delta.

## 9. Third review round

Reviewing the fix round found a defect the fix round had introduced — which
is the whole argument for reviewing each one rather than inheriting the last
verdict.

- [x] 9.1 **The retry guard outlived the element it belonged to** (medium).
      7.8 scoped the *element* to the attempt but left `retrying` a shared
      boolean, so while a discarded attempt was still in flight the
      replacement element's `error` took the early return: allowance restored
      but never spent, no `failed`, a player showing nothing at all. Video
      reached the same state through collapse and re-expand, and there it is
      worse — `giveUp` is what collapses, so the player stayed expanded,
      blank and silent, the exact symptom 7.3 claimed to have closed.
      Fixed structurally rather than by remembering to reset a flag in four
      places: the guard now holds the element a refresh is in flight FOR
      (`retryingFor`), so a new element is never gagged by an old attempt and
      an old attempt cannot clear a newer one's guard.
- [x] 9.2 **`onUnmounted` never paused the video** (medium, pre-existing).
      Vue nulls template refs while unmounting the subtree, so the hook ran
      with `videoRef.value === null` and a detached, playing element survived
      leaving the feed — audio with no visible source. Now
      `onBeforeUnmount`, matching the audio player. Adjacent enough to fold
      in: this change is what consolidated the audio side's teardown.
- [x] 9.3 **`giveUp` unmounted the element without pausing it** (low). An
      `error` does not require the element to be paused, so the same detached
      -but-playing case was reachable on a mid-stream failure.
- [x] 9.4 **The setup before `try` could strand `starting`** (low,
      introduced by 7.1). `discardElement()` and `restore()` sat between
      `starting = true` and the `try`, so a throw there would leave the flag
      set and every later tap returning at the guard — a permanently dead
      player with nothing on screen to say so. Both moved inside.
- [x] 9.5 **The two players disagreed on what "recovering" means** (low).
      Audio read the element's own `error`, video read `failed`. They diverge
      when a failure leaves no element at all — a refresh whose resolve fails
      — and audio would then spend its attempt on the cached URL already
      known not to load. Audio now reads `failed` too.
- [x] 9.6 Re-ran static checks and the spec on all three projects. Red is not
      re-measured: the spec has not changed since the 173-vs-2 run, and the
      red check reverts the players wholesale.
- [x] 9.7 Fourth review of this delta, then commit.

## 10. Fourth review round

The first round in which nothing structural was wrong: the reviewer traced
the bound through both engines' event orderings, the tap-during-refresh race
and the `retryingFor` handoff, and confirmed the core. Five polish findings,
all taken.

- [x] 10.1 **`src = ''` made the element fetch this page** (low/medium). The
      empty string resolves against the document base URL, so discarding an
      element asked the server for `/feed` as media. Harmless once per
      unmount; this change calls it on every tap of a failed player, in a
      diff whose whole point is that failure costs a small bounded number of
      requests. Now `removeAttribute('src')` + `load()`.
- [x] 10.2 **The video's `toggle` restored an allowance it could never
      spend** (low). Wiring it was 7.9, taken from the second review — and
      the fourth review showed the wiring was theatre: `toggle` does not
      rebuild the element, and D3 is precisely that `play()` on an errored
      one starts nothing. Every badge tap on such a player was a silent
      no-op. It now admits the failure through `giveUp()`, which collapses
      and lets the NEXT tap expand onto a new element. `expand` stays the
      only gesture that restores.
- [x] 10.3 **`restore()` sat outside `expand`'s `try`** (low) — the exact
      asymmetry 9.4 claims to have fixed, left standing in the other player.
      Moved inside.
- [x] 10.4 **Neither teardown reset `playedFraction`** (low), so a clip that
      played partway and then failed rendered its next attempt with the
      waveform overlay or progress bar pre-filled at the old position — and
      that is D2's own motivating scenario.
- [x] 10.5 A comment still named `retrying` after the rename to
      `retryingFor` in the same hunk.
- [x] 10.6 Fifth review; ship if it finds nothing structural.

## 11. Fifth review round

- [x] 11.1 **The video's successful refresh always ended in `giveUp()`**
      (high, PRE-EXISTING — `origin/dev` lines 123-125). `onError` wrote the
      fresh URL to the reactive `sourceUrl` AND to `element.src`, then
      awaited `play()`. The reactive write queues Vue's patch; `patchDOMProp`
      guards on equality only for `value`, so `src` is re-assigned
      unconditionally, and setting a media element's `src` re-runs the load
      algorithm and rejects the pending play. Measured on a real `<video>` in
      the browser rather than argued from the spec: src set once ->
      `NotSupportedError` (the true load failure); src set twice with the
      SAME value -> `AbortError`. So a refresh that would have recovered an
      expired signature was converted into a failure, making this change's
      own accepted requirement — "A stale signature recovers on the one
      refresh" — false for video. The binding now owns `src` alone and the
      flush is awaited, as `expand` always did.
      Not introduced here, but not left either: this change is what makes
      that path end in a collapse the person can see.
- [x] 11.2 **`toggle` restoring the allowance was right after all, for the
      other half of the state space** (medium). 7.9 wired it, 10.2 unwired it
      because an errored element cannot spend it — both were right about
      different elements. A HEALTHY element being resumed can spend it later,
      and refusing there means a signature expiring after a pause collapses
      the player without the refresh it is owed. Now: errored -> `giveUp`,
      healthy -> restore. Tasks 3.3/7.9/10.2 read as the record of that
      argument rather than as three contradictory ticks.
- [x] 11.3 **`recovering` and the discard condition disagreed** (low). A
      second error arriving during an in-flight refresh takes the
      `retryingFor` early return, which leaves the element errored but
      `failed` false; the next tap would then rebuild from the cached URL
      that just died. Reads both signals now.
- [x] 11.4 **The exhausted-allowance branch left the waveform tinted** (low).
      Every audio give-up goes through one `admitFailure()` that resets the
      played fraction, so no branch can forget it.
- [x] 11.5 Widened VKB-183: `grep` finds no `.video` selector anywhere in
      `e2e/`, so the video player is never rendered by any test. 11.1 is what
      that costs — nothing in the repo could have caught it.
- [x] 11.6 Sixth review, then commit.

## 12. Sixth review round, and where the loop stops

The first round to find nothing structural. The reviewer traced the bound
through both engines' orderings, the `retryingFor` handoff, the
tap-during-refresh race and the `starting` guard, confirmed no unbounded path
survives, and cleared by name a list of things that could have been wrong
(the `utils/` auto-import, WebKit hermeticity, `route.fulfill` headers, the
video comment 3.5 deliberately left alone). Two findings, both one line, both
"the sibling already does this":

- [x] 12.1 **`admitFailure()` did not pause the element** (medium). `giveUp()`
      pauses and says why; audio never got the same treatment. An `error` does
      not pause a media element, so a connection lost mid-stream keeps playing
      out of the buffer under a "playback unavailable" row — and since
      `playing` is false by then, the button routes to `startPlayback` rather
      than to pause, so nothing on screen can stop the sound.
- [x] 12.2 **`collapse()` did not reset `playedFraction`** (low) — the third
      teardown path, missed when 10.4 fixed the other two.

- [x] 12.3 **Stopping here, deliberately.** Six rounds found 6, 2, 6, 5, 4, 2.
      Rounds two and three found defects the previous round's fix introduced,
      which is why each round got its own review rather than inheriting the
      last verdict. This round introduced nothing: both fixes are single lines
      copied from a sibling that has already been reviewed four times. A
      seventh round would be reviewing that copy.
