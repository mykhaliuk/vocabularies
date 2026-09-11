# screen-loading Specification

## Purpose
Moving between screens responds to the person at once: a screen that needs data
appears immediately and says it is loading, instead of leaving the previous
screen frozen until its request answers.

## Requirements

### Requirement: Navigating to a screen does not wait on that screen's data

A client-side navigation to the word detail screen or to account settings SHALL
complete without waiting for the screen's data request. Until the data arrives,
the screen MUST show a loading state that assistive technology announces as
status. When the data arrives, the screen SHALL replace the loading state with
its content without a further navigation.

A full page load SHALL still deliver the screen with its content already
rendered, with no loading state in the first paint.

#### Scenario: Opening a word from the feed while its request is slow

- **WHEN** the person taps a word in the feed and the request for that word has
  not answered yet
- **THEN** the address changes to the word's page at once, the feed is no longer
  shown, and a loading state is visible
- **AND** once the request answers, the word, its gloss and its media appear in
  place of the loading state

#### Scenario: Opening account settings while the profile request is slow

- **WHEN** the person follows "account settings" from the profile tab and the
  profile request has not answered yet
- **THEN** the address changes to account settings at once and a loading state
  is visible
- **AND** once the request answers, the greeting and the settings appear in
  place of the loading state

#### Scenario: A full page load renders content directly

- **WHEN** the person loads the word's page or account settings directly (a
  reload, a shared link, a cold start)
- **THEN** the first paint already contains the content, with no loading state

### Requirement: A data request that answers after the screen is shown gives the same answers as today

Deferring the request MUST NOT change what a failure means. Whether the request
answers before or after the screen appears:

- a 401 SHALL hand the person to sign-in, without first showing any claim
  about the word or the account;
- on the word detail screen, a word that is gone or was never askable SHALL
  read that the word is not here any more, with no offer to try again;
- on the word detail screen, a transient failure (a 5xx, a network failure, a
  408 or a 429) SHALL offer to try again;
- on account settings, any other failure SHALL end on the application's error
  page.

#### Scenario: The session ends while the word is loading

- **WHEN** the word's request answers 401 after the word detail screen has
  appeared
- **THEN** the person lands on sign-in, and no "not here" or "try again" copy is
  shown on the way

#### Scenario: The word was deleted before it loaded

- **WHEN** the word's request answers 404 after the word detail screen has
  appeared
- **THEN** the screen reads that the word is not here any more and offers no
  retry

#### Scenario: A transient failure while the word loads

- **WHEN** the word's request fails with a 5xx after the word detail screen has
  appeared
- **THEN** the screen says the word could not be loaded and offers to try again

#### Scenario: The session ends while account settings load

- **WHEN** the profile request answers 401 after account settings have appeared
- **THEN** the person lands on sign-in
