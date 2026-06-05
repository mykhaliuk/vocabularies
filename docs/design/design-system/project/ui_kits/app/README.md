# Vocabu — App UI Kit

A high-fidelity, click-through recreation of the **Vocabu PWA** (mobile-first). It's a cosmetic prototype, not production code — interactions are faked but the look, layout, and feel are accurate to the design system.

Vocabu is a personal **dictionary of how the people you love talk** — a kid's first words, a friend's catchphrase, a grandparent's saying — with a gentle social feed.

Open **`index.html`** to use it inside a phone shell. On a narrow viewport it fills the screen like an installed PWA.

## What you can do
- **Feed** — scroll word entries; **play** the audio sample (waveform fills as it plays); tap **Meaning & story** to unfold the description; ♥ to love, 🔖 to save; tap a card to open it.
- **Compose** — tap the center feather FAB → a bottom sheet rises; enter the word/phrase, who said it, an optional meaning, the story, record their voice, file it in a collection → **Keep** adds it to the top of the feed.
- **Word detail** — opens the full entry (meaning expanded) + replies.
- **Discover / Saved / Profile** — switch via the bottom tab bar (thumb zone). Profile is *“my dictionary.”*

## Files
| File | Role |
|---|---|
| `index.html` | Phone shell + status bar; loads React/Babel/Lucide + all JSX. |
| `primitives.jsx` | `Icon` (Lucide), `Avatar`, `Button`, `IconButton`, `Chip`. |
| `data.jsx` | Sample entries (word, speaker, relation, gloss, story, audio, collection), collections, current user. |
| `WordCard.jsx` | The core feed unit: speaker, the word + gloss, audio sample player, unfoldable meaning, collection tag, like/reply/save. |
| `chrome.jsx` | `TopBar`, `FeedTopBar`, `BottomNav` (thumb-zone tabs + compose FAB). |
| `screens.jsx` | `FeedScreen`, `DiscoverScreen`, `SavedScreen`, `ProfileScreen`. |
| `Compose.jsx` | Bottom-sheet composer for a new word/phrase. |
| `Detail.jsx` | Word detail + replies. |
| `app.jsx` | Shell: tab state, detail overlay, compose, posting. |

## Conventions
- Components are exported onto `window` at the end of each file (Babel scripts don't share scope otherwise).
- Icons render from Lucide icon-node data via `lucideSvg()` → `dangerouslySetInnerHTML`, so React never fights the DOM-scanning `createIcons()`.
- All color/spacing/type comes from `../../colors_and_type.css` tokens.
- The word headline auto-sizes down for longer phrases; `gloss` is optional; `audio` is optional.
- Touch targets ≥ 44px; primary action (compose) sits center/bottom in the thumb zone.

## Not included (by design)
Onboarding/auth, real audio recording/playback, settings, notifications. Add as needed — reuse the primitives.
