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

A save does its media work **first** and its row writes **last**, in one
short committing step. Cancel is then closed for exactly one window — while
those row writes are in flight (`isCommitting`, edit mode only): the header
button disables, and the scrim and Escape do nothing. Both writes carry a
timeout, so that window cannot become permanent.

Cancel stays **open** for the whole upload, which is the long part. That
costs nothing: aborted bytes are never confirmed, and a clip that is never
confirmed never becomes the word's. Blocking it would only strand an edit
behind a stalled connection.

The one thing a cancel cannot undo is a clip that already reached the
server — past the confirm, ADR-0009's pipeline binds it to the entry when
processing finishes, and no answer to a dialog can recall it. So the sheet
does not claim otherwise: from `finalizing` onward the discard body switches
to `editBodySent` ("the new clip is already saved"), while every earlier
cancel gets the unqualified `editBody` ("The word stays exactly as it was").

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
- **Write the row first, then the media** — makes the retry after a failed
  upload trivially idempotent, but any cancel during the upload would then
  come after the text had already changed. Cleaner code, dishonest copy.
- **Reuse the compose discard wording** — mechanically harmless and the
  worst option for the user: "Nothing you put here will be kept" over a word
  they already own reads as a threat to delete it.
- **Roll the media back on cancel** — `DELETE /api/entries/:id/media` removes
  the row currently bound to the entry, which is the clip we are trying to
  protect, not the pending one.
