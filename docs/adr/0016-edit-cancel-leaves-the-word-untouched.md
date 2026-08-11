# ADR-0016: an abandoned edit leaves the word untouched — the save commits last, and cancel closes only for that window

- Status: Accepted
- Date: 2026-08-11
- Refs: VKB-110, VKB-154, VKB-107, ADR-0009, `components/compose/Sheet.vue`

## Context

Compose and edit are the same sheet (entry-actions-spec §Q2), but dismissing
means opposite things in the two modes. VKB-154 made dismissing compose a
**discard**: the sheet closes and `useMediaUpload` deletes the entry the
session created behind it. Pointed at a word the user already owns, that
same gesture would delete it.

The mechanism was already safe — `useMediaUpload` only deletes when the
target it was handed is `undefined` — but "safe" was not the whole
requirement. The sheet also has to be able to tell the user what cancelling
does, and the honest sentence depends on what has already reached the
server. Two things can be in flight during a save: a media upload, which
under ADR-0009 does not touch the word until the confirmed clip finishes
processing, and the `PATCH`/`DELETE` pair that changes the row immediately.

## Decision

Cancelling an edit leaves the word as you found it, and **the sheet only
ever promises what is still true**.

A save does its **upload** first and its row writes last, in one short
committing step. Cancel is then closed for exactly one window — while
those row writes are in flight (`isCommitting`, edit mode only): the header
button disables, and the scrim and Escape do nothing. Both writes carry a
timeout, so that window cannot become permanent.

Cancel stays **open** for the whole upload, which is the long part. That
costs nothing: aborted bytes are never confirmed, and a clip that is never
confirmed never becomes the word's. Blocking it would only strand an edit
behind a stalled connection.

The commit is two requests — `PATCH` then `DELETE …/media` — with no
transaction behind them, so one can land without the other. **The fields go
first**, and untouched fields are not sent at all. The two failures are not
equally recoverable: a `PATCH` refused outright has written nothing, while a
refused `DELETE` leaves text the user can still see and change. The other
order can only fail by destroying a recording they cannot get back. A retry
re-runs both safely: `removeEntryMedia` deletes nothing once the row is gone
(`server/domain/entries.ts`), and re-sending the same field values changes
nothing but `updatedAt`.

What no cancel can undo is anything that already reached the word: a clip
past the confirm (ADR-0009 binds it when processing finishes) or a `PATCH`
that landed. So the sheet does not claim otherwise. `isPartlySaved` covers
**all** of it — `hasSavedMedia`, `phase === 'finalizing'`, and
`hasWrittenFields` — and switches the discard body to `editBodyPartial`
("Some of your changes are already saved and will stay"). Only a cancel with
nothing behind it gets the unqualified `editBody` ("The word stays exactly
as it was").

Two things make that flag honest rather than merely present. It is set only
when the fields actually differed, so a removal-only save whose `DELETE`
fails does not claim the user's text was saved — nothing of theirs was. And
whatever landed is announced to the screens behind the sheet even when the
save as a whole failed, so the detail underneath is never left rendering a
word the row no longer has.

The remaining hole is a `PATCH` that times out client-side (15s) after the
server committed it: the row changed and `hasWrittenFields` is false, so
that one cancel gets the unqualified promise. Chasing it would need the
write to be idempotent by key rather than by value; it is recorded here
rather than papered over.

Compose keeps its existing mid-flight cancel unchanged: there, cancelling
has a coherent meaning, because the entry being thrown away is the one the
session just made.

## Consequences

- No sentence in the sheet needs an asterisk, which is the point — but that
  is bought by branching the copy, not by pretending the confirm is
  reversible.
- The window with no way out is a timeout-bounded pair of small requests.
  Everything slow — the upload — stays cancellable.
- A refused row write after a successful upload leaves the clip replaced and
  the text not. Retrying does not re-upload the same bytes; the sheet
  remembers the media step landed, and forgets it the moment the file
  changes, so a replacement picked after a partial failure is really sent.
- That replacement is also where this ADR's retry path meets a hazard it
  does not own (**VKB-159**). Forgetting the slot is all a client can do:
  the superseded row keeps its `pending_entry_id`, minting detaches
  nothing, and the claim on `ready` deletes only rows already _bound_ — so
  two clips can sit pending against one entry and the **last to finish
  transcoding wins**, not the last picked. Swap a long video for a short
  clip and the clip lands first, then the video overwrites it. The
  mechanism is ADR-0009's and predates this ticket; what this ticket adds
  is an ordinary way to reach it.
- The save is still **not atomic**, and this decision does not make it so —
  it makes the residue harmless and honest. The one partial state left is
  "text saved, removal not applied": visible on the screen, fixed by
  retrying, and named by the copy. Making it truly atomic means teaching
  `PATCH` to drop media in one transaction, which reverses VKB-100's
  deliberate exclusion of media from that route and VKB-107's entry-bound
  media routes. That trade is available, but it is a server contract change
  and it is not this ticket's to make.
- Leaving the screen mid-edit (the back gesture) is not a cancel and does
  not try to be one: the sheet's draft dies with its component, so it closes
  itself on unmount rather than surfacing blank over the next page. A save
  already in flight when that happens still lands, unreported.
- The compose sheet is now mounted in `layouts/app-detail.vue` as well,
  without the FAB — the spec has edit rise **over** the detail, and that
  layout previously carried no sheet at all.
- `saidAt` is deliberately absent from the sheet (the ticket settles this;
  VKB-111 owns the date in place on the detail screen). That absence is also
  what makes the two writers of this row benign: the date editor sends only
  `saidAt`, the sheet never does, `updateOwnEntry` sets only the columns it
  is given, and Postgres serialises the two `UPDATE`s on the row — so
  whichever lands second overwrites only its own columns and neither loses a
  field. Adding a date field here would turn that into a real lost update.

## Alternatives rejected

- **Keep cancel live and let the question decide, as compose does** — the
  answer can arrive after the upload confirmed, and no client-side answer
  can un-confirm it. The sheet would be asking a question it cannot honour.
- **Close cancel for the whole save, upload included** — the first cut of
  this decision. It bought nothing the confirm boundary does not already
  buy, and it traded a real hazard for a theoretical one: a phone losing
  signal mid-upload left the sheet undismissable, since a stalled `XHR` has
  no timeout and nothing else could end the phase.
- **Write the row before the upload** — makes the retry after a failed
  upload trivially idempotent, but any cancel during the upload would then
  come after the text had already changed. Cleaner code, dishonest copy.
  (This is about the _upload_; within the commit the row write does go
  first, for the reason given above — the two orderings are not in
  conflict.)
- **Extend `PATCH` with a `media: null` instruction and one transaction** —
  genuinely atomic, and the right shape if the partial state ever bites.
  Rejected here because it reverses two recorded decisions (VKB-100 keeping
  media out of `PATCH`, VKB-107 giving media its own routes) to remove a
  residue that is already visible, retryable and truthfully described.
- **Reuse the compose discard wording** — mechanically harmless and the
  worst option for the user: "Nothing you put here will be kept" over a word
  they already own reads as a threat to delete it.
- **Roll the media back on cancel** — `DELETE /api/entries/:id/media` removes
  the row currently bound to the entry, which is the clip we are trying to
  protect, not the pending one.
