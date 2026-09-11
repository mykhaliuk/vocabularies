VKB-141 — https://linear.app/myka/issue/VKB-141

## Why

The rule for leaving a word screen, "return to wherever the person came from
when there is history to return to, otherwise land on `/feed` with `replace`",
is implemented twice: `TopBar.goBack` (the back arrow) and
`leaveTheDeletedWord` in `pages/entries/[id].vue` (the exit after a delete).
Two copies of a history-semantics rule diverge quietly: a fix applied to one
and not the other gives a back button that behaves differently depending on
which affordance was used, and nothing fails.

## What Changes

- One function, `leaveToFeed`, in `utils/leave-to-feed.ts`, owns the rule. It
  takes the router and the navigate function as arguments, so the rule itself
  is a pure function that a unit test can drive.
- `TopBar.goBack` and `leaveTheDeletedWord` both call it. The back arrow keeps
  firing it without awaiting; the delete exit keeps awaiting it, so its caller
  still catches a rejected navigation.
- A unit test pins both branches: history present → `router.back()`, no
  history → `navigate('/feed', { replace: true })`.

Behaviour-neutral by construction: the same inputs choose the same branch and
make the same call, from both affordances. No spec-level behaviour changes, so
the change sets `skip_specs: true`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None.

## Non-goals

- Changing when history counts as "ours" (the `history.state.back` string
  test), or the accepted pre-hydration limitation `leaveToFeed` documents.
- Any other back affordance (`/me`'s "back to the feed" link is a plain link,
  not this rule).

## Impact

- New `utils/leave-to-feed.ts` and `tests/unit/leave-to-feed.test.ts`.
- `components/app/TopBar.vue`, `pages/entries/[id].vue`: the inline rule is
  replaced by a call.
- The existing e2e already pins both callers in both branches
  (`entry-detail.spec.ts`: "back returns to the feed", "a word opened cold
  leaves nothing behind the OS back button"; `entry-delete.spec.ts`: "the feed
  drops the word even when its own reload is stale", "a cold-opened word
  leaves nothing behind the OS back button"). They must stay green unchanged.
