# media-status Specification

## Purpose
A word's media is processed after it is uploaded. A screen that shows the word
during that time follows the media until it is playable or has failed, so the
person never has to reload to see the result.

## Requirements

### Requirement: The word detail screen follows media that is still being processed

While the word's media is processing, the word detail screen SHALL check the
word again at a fixed interval and SHALL show the media in its settled form, a
playable player when it is ready or the failure line when it has failed, no
later than one interval after the media settles, without a reload or a
navigation.

A word whose media is already ready or failed, or that has no media, MUST NOT
be checked again.

#### Scenario: The media becomes ready while the word is open

- **WHEN** the person is on a word whose media shows as processing, and the
  media becomes ready
- **THEN** within one interval the processing line is replaced by the player,
  with no reload

#### Scenario: The media fails while the word is open

- **WHEN** the person is on a word whose media shows as processing, and the
  processing fails
- **THEN** within one interval the processing line is replaced by the failure
  line

#### Scenario: Settled media is not checked again

- **WHEN** the person opens a word whose media is already ready
- **THEN** the screen makes no further requests for the word beyond the one
  that loaded it

### Requirement: Following processing media is bounded

The screen SHALL stop checking as soon as the media is ready or failed, when
the person leaves the screen, and after a fixed budget of checks (about five
minutes). A new clip on the same word, identified by a different media id,
SHALL start a fresh budget.

A check that fails MUST NOT change what the screen shows: the word stays on
screen and the next check proceeds within the budget. A check answered with
401 SHALL hand the person to sign-in.

#### Scenario: Checking stops once the media settles

- **WHEN** the media has become ready and the screen has shown the player
- **THEN** no further requests for the word are made while the screen stays
  open

#### Scenario: Checking stops when the person leaves

- **WHEN** the person navigates away while the media is still processing
- **THEN** no further requests for the word are made

#### Scenario: A failed check keeps the word on screen

- **WHEN** one check fails with a server error while the media is processing
- **THEN** the word stays on screen with its processing line, no error state
  replaces it, and a later check still switches it to the player once the
  media is ready

#### Scenario: The session ends while the media is processing

- **WHEN** a check is answered with 401
- **THEN** the person lands on sign-in
