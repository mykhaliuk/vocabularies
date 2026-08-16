# ADR-0019: fonts resolve from node_modules, through a provider we own

- Status: Accepted
- Date: 2026-08-16
- Refs: VKB-124, VKB-171 (duplicate), VKB-157, VKB-18, VKB-123,
  `fonts.config.js`, `providers/fontsource.js`, `scripts/fonts-vendor.js`,
  `scripts/no-network.mjs`

## Context

`@nuxt/fonts` self-hosts the families at build and serves them same-origin,
which is right for the runtime. It made **the build** depend on the public
internet: on 2026-08-15 and twice on 2026-08-16 a versioned
`fonts.gstatic.com` URL 404'd and reddened CI on changes that had nothing to do
with fonts. The third time it blocked a merge.

Two things were established by measurement rather than argument, and both
refute the fix this ticket originally recorded (use unifont's `npm` provider):

- **fontsource never puts both styles in one stylesheet.** Rubik's italic lives
  in `wght-italic.css`; `index.css` contains zero italic faces. The `npm`
  provider resolves exactly one file per family, so it cannot express
  "Rubik, normal and italic". The static `@fontsource/rubik` is no better —
  its `index.css` is weight 400 normal alone.
- **`npm` with `remote: false` still points at a CDN.** Its local branch reads
  the CSS from disk and then rewrites every font URL to jsdelivr
  (`resolveUrlsToAbsolute(fontFaces, cdn)`), so the build keeps fetching; only
  the hostname changes.

The stock `local` provider is not an option either: it reports no
`unicode-range`, so every subset collapses onto one face and Ukrainian silently
stops resolving — the exact failure VKB-18 and VKB-157 exist to prevent.

## Decision

**Own the provider; keep the module.**

`providers/fontsource.js` is a ~40-line unifont provider that reads the
installed `@fontsource-variable/*` packages, across as many stylesheets as a
family needs, and returns complete face data — `unicode-range` included —
pointing at files vendored into `public/fonts` on postinstall. A leading-slash
path is not a URL to `hasProtocol`, so the module passes it through instead of
downloading it.

Keeping `@nuxt/fonts` in the loop is the point of the shape: preload hints,
asset handling and **fallback metrics stay byte-identical**. Verified rather
than assumed — the generated `Rubik Fallback: Arial` face carries the same
`size-adjust: 104.9796%` and overrides before and after.

**Every built-in provider is disabled by name.** unifont initialises each one
at build, and `googleicons`, `bunny` and `fontshare` each open with a catalogue
request to a third party we have never asked for anything. This is the
"stop probing providers we do not use" half of the ticket, and it is invisible
until the network is blocked.

**The request lives in `fonts.config.js`** — families, styles, weights,
subsets — and `nuxt.config.js` derives its `families` from it. A family can no
longer be declared twice, so the dead-duplicate rule `fonts-check` used to
enforce is now unsayable rather than checked.

**`fonts-check` reads the package, not Google.** The guarantee is unchanged —
a requested subset the source cannot serve is a failure, not a silent fallback
— but the authority is now the file on disk, so the check itself no longer
needs the network.

## Consequences

`bun run build:offline` builds with outbound HTTP blocked
(`scripts/no-network.mjs` refuses external requests on both paths — `fetch` and
`node:http`/`node:https`, since undici's fetch does not go through the latter
and a fetch-only guard would miss a dependency using it). That is the
acceptance criterion demonstrated instead of inferred, and it is reusable
beyond fonts — it is a concrete step toward VKB-123's "no public internet is a
checked property, not a convention".

The blocked run also shows why "it built fine" was never evidence: with the
Google provider and a cold cache, an offline build **still completes** and
simply emits no faces at all. Green build, different type, no signal. Any
future claim about build hermeticity has to clear the font cache
(`node_modules/.cache/nuxt/fonts`) first — the first offline run of this work
passed only because that cache was warm.

The woff2 are generated into `public/fonts`, not committed: the lockfile
already pins the packages, and a second copy in git is a second record that can
drift from it.

**Not closed:** the check verifies the packages ship the request and that the
files were vendored. It does not compare rendered output, so a package that
ships a _different_ Rubik under the same version would pass. That is what the
lockfile is for.
