# media-playback Specification

## Purpose
Playing back the audio or video attached to an entry, from the signed URLs the
API hands out on demand, and behaving predictably when one of those URLs does
not load.

## Requirements

### Requirement: A playback attempt refreshes its URL at most once

Playback URLs are signed and expire, so the first failure of an attempt MAY be
a stale signature and the client SHALL resolve a fresh URL and retry once. A
second failure within the same attempt SHALL NOT trigger another resolve: the
client MUST stop and report the media as unavailable.

An attempt begins when the person asks for playback, and only that restores
the allowance. Playback starting MUST NOT restore it — otherwise media that
plays and then fails would refill the allowance on every cycle and retry
without bound.

#### Scenario: A stale signature recovers on the one refresh

- **WHEN** playback fails once because the signed URL has expired
- **THEN** the client resolves a fresh URL, resumes playback, and reports no
  failure to the person

#### Scenario: A permanently unplayable object stops after one refresh

- **WHEN** the object behind the URL cannot be played for a reason a fresh
  signature does not fix — it is missing, forbidden, or blocked by the bucket
- **THEN** the client resolves a fresh URL exactly once, and on the second
  failure stops requesting and shows the media as unavailable
- **AND** it issues no further playback or entry requests until the person
  asks again

#### Scenario: Media that plays and then fails is bounded too

- **WHEN** the media starts producing output and then fails, repeatedly — a
  truncated or corrupt clip, or a connection lost mid-stream
- **THEN** the refreshes stay bounded exactly as they are for media that never
  played at all, because having played earns no further allowance

#### Scenario: Several players on screen do not multiply requests

- **WHEN** more than one entry with unplayable media is asked to play
- **THEN** each player independently stops after its own single refresh, so the
  total number of requests stays proportional to the number of times the person
  asked

### Requirement: Asking again really tries again

When the person asks for playback after the media was reported unavailable,
the client SHALL make a genuine further attempt — obtaining a freshly signed
URL and loading it — rather than replaying the source that already failed. The
new attempt is bounded by the same single refresh.

This is a requirement and not an implementation detail because a media element
that has already failed will not reload on its own: handed back to it, a
request to play is refused without any new attempt being made, and the player
stays dead for as long as it is on screen.

#### Scenario: A second request recovers media that has become reachable

- **WHEN** the media was reported unavailable, the underlying cause is then
  resolved, and the person asks for playback again
- **THEN** playback succeeds

#### Scenario: A second request against still-broken media stays bounded

- **WHEN** the person asks again and the media is still unplayable
- **THEN** the client makes one further attempt with one refresh, and reports
  it unavailable again

### Requirement: Unavailable media is reported, never silently retried

When an attempt has spent its refresh and still cannot play, the client SHALL
leave the player in a non-playing state and tell the person the media is
unavailable, rather than continuing to retry in the background.

The message MUST be visible in whatever state the player is in when it gives
up. A player that fails while expanded, and whose only failure copy belongs to
its collapsed form, does not satisfy this.

#### Scenario: The player settles in a visible failed state

- **WHEN** an attempt ends without playable media
- **THEN** the player shows its playback-unavailable message and does not
  present itself as playing

#### Scenario: A video that fails after expanding still says so

- **WHEN** a video player has expanded into its frame and then gives up
- **THEN** the person is told the media is unavailable, rather than being left
  with a blank frame

### Requirement: The audio waveform represents the whole clip

The waveform of an audio player SHALL represent every moment of the clip,
from its start to its end, within the player's visible width in every player
variant and at every width the player can be given. No part of the waveform
MAY be cut off by the player's bounds.

The bars SHALL be scaled so that the clip's loudest moment renders at full
height, and a single short transient MUST NOT reduce the rest of the clip to
a near-flat line.

The played portion of the waveform SHALL advance in step with playback, so a
bar is shown as played when playback has reached the moment it represents.

#### Scenario: A loud moment late in the clip is visible

- **WHEN** a clip's loudest moment falls in its second half
- **THEN** the waveform shows that moment as a full-height bar, in both the
  feed and the word detail player

#### Scenario: A narrow screen thins the bars instead of cutting them

- **WHEN** the player is rendered narrower than its maximum width
- **THEN** every bar is still inside the player's visible width

#### Scenario: One transient does not flatten the speech

- **WHEN** a clip contains one short spike far louder than the rest of the
  recording
- **THEN** the rest of the recording still renders with visible variation in
  height rather than as a near-flat line
