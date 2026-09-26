## ADDED Requirements

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
