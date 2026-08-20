# Glossary

The project's settled vocabulary. Pure lexicon — what things are called and
what the word means, never how they are implemented. Use these terms in UI
copy, code identifiers, commits, issues, and design discussion; if a new term
crystallizes during planning, add it here in the same PR.

## Product

- **word** (also **headword**) — the memorable word or phrase being kept;
  the thing a dictionary entry is about. Rendered in the handwritten face.
- **gloss** — the short explanation attached to a word: what it means, in
  plain warm language. Not a formal definition.
- **speaker** — the person the word belongs to; whose way of talking is
  being remembered.
- **loved** — the heart-marked state of an entry. The term is _loved_ — not
  "liked", "starred", or "favorited" — and only the heart ever fills.
- **collection** — a named group of words curated by a user.
- **magic link** — the emailed one-time sign-in link; the only way in, there
  are no passwords.
- **poll/claim** — the sign-in handoff that lets an installed PWA finish a
  magic-link sign-in whose link opened in a different browser (Safari, a
  separate jar). The PWA waits for the click, then, once the confirmation code
  is entered, takes the session over.
- **poll key** — the high-entropy, single-use secret an installed PWA mints
  and keeps in its own storage to name the sign-in it is waiting on. A bearer
  secret: never shown, never emailed, kept only as a hash on the server.
- **claim** — the pending cross-jar sign-in a poll key names. **Armed** when
  the magic link is opened, then **claimed** exactly once by the initiating
  device after the confirmation code is entered, which receives its own
  session.
- **confirmation code** — the short code shown only on the page the magic link
  opens; the device that started the sign-in must enter it to finish a
  cross-jar sign-in. It binds who clicked to who receives the session, so a
  stray poll key alone cannot collect someone else's session.
- **moment** — the captured piece of the speaker actually saying it: a video
  clip of up to 20 seconds or an audio clip of up to 3 minutes attached to
  an entry.
- **media** — the umbrella term for a moment's file, audio or video alike.
  The entity is called _media_, never "audio" — video is a first-class kind.
- **original** — the media file exactly as the user uploaded it, kept forever
  as the source of truth; never served to the app directly.
- **derivative** — the normalized rendition produced from an original (720p
  video or canonical audio); the only thing the app plays.
- **poster** — the still frame that stands in for a video in the feed until
  it is tapped to play.
- **peaks** — the amplitude array extracted from audio, used to draw the
  waveform.
- **plan** — the user's billing tier (`free`, `essentials`, `premium`);
  written only by billing. States what that tier includes; never read by
  consumers, only resolved into entitlements.
- **grant** — a hand-issued role (`vip`, `admin`) independent of the plan; a
  user may hold several. Overrides the plan's entitlements.
- **role** — a plan or a grant: the two kinds of thing a user _is_ for access
  purposes.
- **entitlements** — the resolved set of a user's rights, and the only form in
  which rights leave the entitlements module: **capabilities** as booleans
  (a feature you have or do not, e.g. video upload) and **limits** as numbers
  (a cap, e.g. maximum upload bytes). Distinct from a _feature flag_, which is
  an ops rollout tool — Vocabu has no feature-flags table until a real cohort
  need exists.

## Platform

- **stage** — one of the runtime environments a command can target: `local`,
  `dev`, and `production`. A stage is selected per command, not per checkout.
  There is no staging tier: `preprod` was retired in VKB-169 because it named
  a deployment that never existed, and VKB-172 holds the question of where a
  real one would come from.
- **transport** — the request-facing skin of the server (`server/api`,
  `server/routes`, `server/middleware`, `server/plugins`): guards,
  validation, calling the domain, shaping responses. Never touches the
  database.
- **domain operation** — the unit of business logic: a function in the
  domain layer named by business intent that owns any db access it needs;
  the only sanctioned way the app reads or writes the database (legacy
  pre-ADR-0010 call sites are grandfathered and shrinking).
- **canon** — the exported design-system manifest; the single source of
  truth every design artifact is checked against.
- **the triad** — the three consumers of canon kept in sync by checks:
  production CSS, the prototype, and the Vue UI.
- **bridge** — the prototype's patch layer covering tokens its embedded
  design-system copy lacks; temporary by definition.
- **drift** — a real disagreement between an artifact and canon; the only
  design-check verdict that fails CI.
- **prototype** — the browser-authored clickable mock of the app; reference
  for behaviour and layout, never production code.
- **kit** — the design-system UI primitives (JSX) mirrored into Vue; loses
  to canon and the brand rules when they disagree.
- **primary worktree** — the main repo checkout; owns the real env files.
- **agent worktree** — a disposable checkout an agent works in; borrows its
  runtime config from the primary.
- **milestone tag** — the `m<N>` git tag marking a verified ROADMAP
  milestone.
