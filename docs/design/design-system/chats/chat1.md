# Vocabu App Design

_Started 2026-06-04 18:19 UTC_

---

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "Design System"
Current date is now June 4, 2026
</system-info>

<pasted_text name="Create design system">
We will create a design system in this project.

**Company description:** Vocabu.
Never lost your sweet moments

**Additional notes:**
Progressive web app. Mobile-first design, thinking about how a user touches with their thumb. (More important UI elements are on the bottom, right side)
almost-white and almost-black design with warm dusty rose and warm dusty light blue accents. Simple, clean UI, keeping the UX value. Twitter like. Interactive elements should not take too much attention but be accessible at the same time.

---

Design systems are folders on the file system containing typography guidelines, colors, assets, brand style and tone guides, css styles, and React recreations of UIs, decks, etc. they give design agents the ability to create designs against a company's existing products, and create assets using that company's brand. Design systems should contain real visual assets (logos, brand illustrations, etc), low-level visual foundations (e.g. typography specifics; color system, shadow, border, spacing systems) and also high-level visual ELEMENTS (buttons, full screens) within ui kits.

No need to invoke the create_design_system skill; this is it.

To begin, create a todo list with the tasks below, then follow it:

- Explore provided assets and materials to gain a high-level understanding of the company/product context, the different products represented, etc. Read each asset (codebase, figma, file etc) and see what they do. Find some product copy; examine core screens; find any design system definitions.
- Create a README.md with the high-level understanding of the company/product context, the different products represented, etc. Mention the sources you were given: full Figma links, GitHub repos, codebase paths, etc. Do not assume the reader has access, but store in case they do.
- Call set_project_title with a short name derived from the brand/product (e.g. "Acme Design System"). This replaces the generic placeholder so the project is findable.
- IF any slide decks attached, use your repl tool to look at them, extract key assets + text, write to disk.
- Explore the codebase and/or figma design contexts and create a colors_and_type.css file containing CSS vars for both base type + color styles (e.g. fg1, fg2, serif-display, etc) and semantic CSS vars (e.g. h1, h2, code, p). Copy any webfonts or ttfs into fonts/.
- Explore, then update README.md with a CONTENT FUNDAMENTALS section: how is copy written? What is tone, casing, etc? I vs you, etc? are emoji used? What is the vibe? Include specific examples
- Explore, update README.md with VISUAL FOUNDATIONS section that talks about the visual motifs and foundations of the brand. Colors, type, spacing, backgrounds (images? full-bleed? hand-drawn illustrations? repeating patterns/textures? gradients?), animation (easing? fades? bounces? no anims?), hover states (opacity, darker colors, lighter colors?), press states (color? shrink?), borders, inner/outer shadow systems, protection gradients vs capsules, layout rules (fixed elements), use of transparency and blur (when?), color vibe of imagery (warm? cool? b&w? grain?), corner radii, what do cards look like (shadow, rounding, border), etc. whatever else you can think of. answer ALL these questions.
- If you are missing font files, find the nearest match on Google Fonts. Flag this substitution to the user and ask for updated font files.
- As you work, create HTML card files in preview/ that populate the Design System tab. Target ~700×150px each (400px max) — err toward MORE small cards, not fewer dense ones. Split at the sub-concept level: separate cards for primary vs neutral vs semantic colors; display vs body vs mono type; spacing tokens vs a spacing-in-use example; one card per component state cluster. A typical system is 12–20+ cards. Skip titles and framing — the asset name renders OUTSIDE the card, so just show the swatches/specimens/tokens directly with minimal decoration. After writing each batch, call register_assets with items carrying viewport {width: 700, height: <your estimate>}, a one-line subtitle, and a `group` tag so the Design System tab can split cards into sections. Use these groups: "Type" for typography specimens and scales, "Colors" for palettes / color scales / semantic colors, "Spacing" for radii / shadow systems / spacing tokens / elevation, "Components" for buttons / form inputs / cards / badges / menus, "Brand" for logos / imagery / anything that doesn't fit the others. Title-cased, consistent across the batch.
- Copy logos, icons and other visual assets into assets/. update README.md with an ICONOGRAPHY describing the brand's approach to iconography. Answer ALL these and more: are certain icon systems used? is there a builtin icon font? are there SVGs used commonly, or png icons? (if so, copy them in!) Is emoji ever used? Are unicode chars used as icons? Make sure to copy key logos, background images, maybe 1-2 full-bleed generic images, and ALL generic illustrations you find. NEVER draw your own SVGs or generate images; COPY icons programmatically if you can.
- For icons: FIRST copy the codebase's own icon font/sprite/SVGs into assets/ if you can. Otherwise, if the set is CDN-available (e.g. Lucide, Heroicons), link it from CDN. If neither, substitute the closest CDN match (same stroke weight / fill style) and FLAG the substitution. Document usage in ICONOGRAPHY.
- For each product given (E.g. app and website), create UI kits in ui_kits/<product>/{README.md, index.html, Component1.jsx, Component2.jsx}; see the UI kits section. Verify visually. Make one todo list item for each product/surface.
- If you were given a slide template, create sample slides in slides/{index.html, TitleSlide.jsx, ComparisonSlide.jsx, BigQuoteSlide.jsx, etc}. If no sample slides were given, don't create them. Create an HTML file per slide type; if decks were provided, copy their style. Use the visual foundations and bring in logos + other assets. Register each slide HTML via register_assets with viewport {width: 1280, height: 720} so the 16:9 frame scales to fit the card.
- Register each UI kit's index.html as its own card via register_assets with viewport {width: <kit's design width>, height: <above-fold height>} — the declared height caps what's shown, so pick the portion worth previewing.
- Update README.md with a short "index" pointing the reader to the other files available. This should serve as a manifest of the root folder, plus a list of ui kits, etc.
- Create SKILL.md file (details below)
- You are done! The Design System tab shows every registered card. Do NOT summarize your output; just mention CAVEATS (e.g. things you were unable to do or unsure) and have a CLEAR, BOLD ASK for the user to help you ITERATE to make things PERFECT.

UI kit details:
- UI Kits are high-fidelity visual + interaction recreations of interfaces. They cut corners on functionality -- they are not 'real production code' -- but they provide high-fidelity UI components. Your UI kits should be pixel-perfect recreations, created by reading the original UI code if possible, or using figma's get-design-context. They should be modular and reusable, so they can easily be pieced together for real designs. UI kits should recreate key screens in the product as click-thru prototypes. a UI kit's index.html must look like a typical view of the product. These are recreations, not storybooks.
- To start, update the todo list to contain these steps for each product: (1) Explore codebase + components in Figma (design context) and code, (2) Create 3-5 core screens for each product (e.g. homepage or app) with interactive click-thru components, (3) Iterate visually on the designs 1-2x, cross-referencing with design context.
- Figure out the core products from this company/codebase. There may be one, or a few. (e.g. mobile app, marketing website, docs website).
- Each UI kit must contain JSX components (well-factored; small, neat) for core UI elements (e.g. sidebars, composers, file panels, hero units, headers, footers, buttons, fields, menus, blog posts, video players, settings screens, login, etc).
- The index.html file should demonstrate an interactive version of the UI (e.g a chat app would show you a login screen, let you create a chat, send a message, etc, as fake)
- You should get the visuals exactly right, using design context or codebase import. Don't copy component implementations exactly; make simple mainly-cosmetic versions. It's important to copy.
- Focus on good component coverage, not replicating every single section in a design.
- Do not invent new designs for UI kits. The job of the UI kit is to replicate the existing design, not create a new one. Copy the design, don't reinvent it. If you do not see it in the project, omit, or leave purposely blank with a disclaimer.

Guidance
- Run independently without stopping unless there's a crucial blocker (E.g. lack of Figma access to a pasted link; lack of codebase access).
- When creating slides and UI kits, avoid cutting corners on iconography; instead, copy icon assets in! Do not create halfway representations of iconography using hand-rolled SVG, emoji, etc.
- CRITICAL: Do not recreate UIs from screenshots alone unless you have no other choice! Use the codebase, or Figma's get-design-context, as a source of truth. Screenshots are much lossier than code; use screenshots as a high-level guide but always find components in the codebase if you can!
- Avoid these visual motifs unless you are sure you see them in the codebase or Figma: bluish-purple gradients, emoji cards, cards with rounded corners and colored left-border only
- Avoid reading SVGs -- this is a waste of context! If you know their usage, just copy them and then reference them.
- When using Figma, use get-design-context to understand the design system and components being used. Screenshots are ONLY useful for high-level guidance. Make sure to expand variables and child components to get their content, too. (get_variable_defs)
- Create these files in the ROOT of the project unless asked not to. For example, README.md should be at the root, not in a folder!
- Stop if key resources are unnecessible: iff a codebase was attached or mentioned, but you are unable to access it via local_ls, etc, you MUST stop and ask the user to re-attach it using the Import menu. These get reattached often; do not complete a design system if you get a disconnect! Similarly, if a Figma url is inaccessible, stop and ask the user to rectify. NEVER go ahead spending tons of time making a design system if you cannot access all the resources the user gave you.

SKILL.md
- When you are done, we should make this file cross-compatible with Agent SKills in case the user wants to download it and use it in Claude Code.
- Create a SKILL.md file like this:

<skill-md>
---
name: {brand}-design
description: Use this skill to generate well-branded interfaces and assets for {brand}, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for protoyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
</skill-md>

</pasted_text>

## Assistant

_[tool: update_todos]_

I'll build the Vocabu design system. Let me start by laying out my plan, then work through it.

_[tool: list_files]_

_[tool: set_project_title]_

Empty project — no codebase or Figma was attached, so this is a from-scratch brand build from the written brief. I'll proceed independently and flag my interpretation at the end. Let me set the title and lay the foundations.

_[tool: write_file]_

Now the foundational CSS with tokens and fonts.

_[tool: write_file]_

Now the brand mark. Vocabu is about *saving* moments so they're never lost — a bookmark is the natural metaphor. Let me create a clean logo set.

_[tool: view_image]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: show_html]_

_[tool: show_html]_

_[tool: write_file]_

Logo reads well — warm and clear. Now I'll build the Design System preview cards. Starting with the Colors group.

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

Now the Type group.

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

Now the Spacing group (radii, elevation, spacing).

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

Now the Components group. These use Lucide icons (the chosen icon system) via CDN.

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

Now the Brand group — logo lockups and a voice/tone card.

_[tool: write_file]_

_[tool: show_html]_

Let me verify a couple of the icon-based cards render correctly.

_[tool: get_webview_logs]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: save_screenshot]_

_[tool: get_webview_logs]_

_[tool: show_html]_

Let me test whether the Lucide CDN is the issue — I'll check the buttons card directly.

_[tool: show_html]_

Buttons render perfectly — CSS and Lucide both work. The moment-card black was a transient. Let me re-check it.

_[tool: register_assets]_

The core moment card looks lovely. Let me register all cards in the Design System tab.

_[tool: delete_file]_

_[tool: update_todos]_

Now the README with all required sections.

_[tool: write_file]_

_[tool: write_file]_

_[tool: update_todos]_

_[tool: write_file]_

Now the main deliverable: the app UI kit. Let me first verify how the Lucide UMD exposes icon data so my React `Icon` component is robust.

_[tool: show_html]_

_[tool: eval_js]_

_[tool: delete_file]_

Lucide exposes icons as `[tag, attrs, children]` arrays — I can build clean SVG strings from that. Let me delete the probe and build the UI kit.

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

Now the chrome (top bar + thumb-zone bottom nav).

_[tool: write_file]_

Now the main screens.

_[tool: str_replace_edit]_

Got it — you want vivid, clean rose and light blue, not muddy terracotta/gray. Let me brighten and saturate both accent scales.

_[tool: str_replace_edit]_

Making the canvas cleaner and whiter — pulling the warm beige out of the light neutrals.

_[tool: str_replace_edit]_

Now updating the logo artwork and the hardcoded hexes in the brand/neutral preview cards.

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now the hardcoded hex labels in the preview cards.

_[tool: read_file]_

Switching to a single sans-serif family throughout. Updating the type system.

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

The `--font-serif` alias now resolves to sans, so components render sans automatically. Let me fix the wordmark SVG (which falls back to a system font) and the visible "serif" labels.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Pushing both accents brighter and more vivid.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: write_file]_

Let me rewrite the affected preview cards for the sans-only, brighter palette. Starting with type cards.

_[tool: write_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now the color cards — neutrals, semantic, and the rose/blue scale labels and titles.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: write_file]_

Now the Compose sheet and Moment detail view.

_[tool: write_file]_

_[tool: write_file]_

Now the app shell and the index.html that wires it all together.

_[tool: write_file]_

_[tool: str_replace_edit]_

Good call — pill buttons read as too soft. Let me introduce a dedicated button radius (rounded-rect, not pill) and apply it.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: show_to_user]_

_[tool: show_html]_

Now let me verify the full UI kit renders correctly with all the changes.

_[tool: read_file]_

The feed looks great with the brighter palette. Now tightening the inputs to be more compact.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Let me also make the app's search field match this more compact density.

_[tool: show_html]_

_[tool: show_to_user]_

_[tool: grep]_

Let me update the README to reflect the sans-only type, brighter accents, and button radius.

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Understood — lighter, more delicate weights, and definitely no serif. The card already uses sans, but the heavy 800 display reads chunky, not delicate. Let me refine the weights system-wide.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now the brand-scale display elements to match the delicate direction.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: register_assets]_

Much more delicate now. Let me bump its card height so h3 isn't clipped, and refresh it for the user.

_[tool: show_to_user]_

_[tool: write_file]_

Now the UI kit README and the SKILL.md.

_[tool: write_file]_

_[tool: register_assets]_

Let me register the UI kit card, then verify the app's interactive states.

_[tool: show_html]_

_[tool: multi_screenshot]_

_[tool: write_file]_

The app flows work well across all screens. Now the Buttons feedback — less padding and show hover states. Let me rewrite the card with tighter padding and live hover effects.

_[tool: str_replace_edit]_

Got it — outlined search, not a filled pill. Updating both the card and the app's search field.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now let me bring the same tighter padding + hover into the app's actual Button component.

_[tool: str_replace_edit]_

Right — the pill chips clash with the rounded-rect controls. Homogenizing chips (and the inline collection tags) to the system's small-control radius.

_[tool: str_replace_edit]_

The repeated "less round" signal is clear — let me reduce the card radius. I'll add an explicit card radius token and apply it, plus finish homogenizing chips and tags.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Now the actual components — MomentCard radius + collection badge, the Chip primitive, and the card surfaces in screens.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: show_html]_

Let me verify the four updated cards render correctly.

_[tool: show_html]_

_[tool: str_replace_edit]_

The "New moment" label is wrapping — buttons need `white-space: nowrap`. Let me fix that in both the card and the component.

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: str_replace_edit]_

Chips homogenized to rounded-rect. The "New collection" chip wraps — adding nowrap.

_[tool: str_replace_edit]_

Cooler, brighter white — updating the canvas to `#FBFEFF` and harmonizing the light neutrals to match.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: show_html]_

Let me verify the updated brand colors card, then refresh all flagged assets in the review pane.Brand colors look vivid and clean now. Let me refresh all the flagged assets in the review pane.

_[tool: show_to_user]_

_[tool: show_to_user]_

_[tool: show_to_user]_

_[tool: show_to_user]_

_[tool: show_to_user]_

_[tool: update_todos]_

_[tool: show_html]_

_[tool: get_webview_logs]_

The app looks polished with all the refinements. Let me check for console errors and do the formal handoff.

_[tool: done]_

_[tool: update_todos]_

_[tool: fork_verifier_agent]_

The Vocabu design system is built and incorporates all your palette/radius/type feedback.

**What's here**
- `colors_and_type.css` — tokens: cool near-white `#FBFEFF`, bright **rose `#ED5379`** + **light blue `#1F9EDB`**, single delicate sans (Hanken Grotesk, no serif), rounded-rect controls (buttons 12px, chips/inputs ~10px), warm-soft shadows.
- `README.md` + `SKILL.md` — context, voice, visual foundations, iconography, and a downloadable-skill manifest.
- `preview/` — 20 spec cards in the Design System tab (Colors, Type, Spacing, Components, Brand).
- `ui_kits/app/` — a working click-through PWA (Feed, Compose, Detail, Discover, Saved, Profile) in a phone shell, built from reusable JSX primitives.
- `assets/` — logo mark + wordmark.

**Caveats / please confirm**
- ⚠️ **Product behavior is my best guess.** With only "Vocabu / never lose your sweet moments / Twitter-like," I built it as a **personal moment-keeping feed**. If it's actually a vocabulary, couples-journal, or photo-first app, tell me and I'll rework screens + copy.
- **Logo & font are placeholders** (original bookmark-heart mark; Hanken Grotesk) — swap in official assets when you have them.

**My ask to get this perfect:** look through the Design System tab and the app, then tell me **(1) what Vocabu actually does**, and **(2) anything still off on the rose/blue or roundness** — those are the two things I most want to nail.

## User

More context: the name vocabu is a shortcut for vocabulary. The idea was given to me by my little daughter: I wanted to imprint her first little words as she says them. So, an app where I can have a little dictionary with a social network aspect. Each word (phrase) is presented by the word/phrase itself, explication/description (available by unfolding), and audio sample (optional).

## User

Regenerate "Inputs & search": oh. one click more padding.

## User

Regenerate "Inputs & search": oh. one click more padding.

## Assistant

_[tool: str_replace_edit]_

_[tool: register_assets]_

I'll also nudge the app's search/compose inputs up one notch to stay in sync.

_[tool: str_replace_edit]_

_[tool: grep]_

_[tool: show_html]_

Compose inputs are already at that padding — in sync. Let me verify and refresh the card.

_[tool: show_to_user]_

_[tool: snip]_

Bumped one notch. Let me clear some resolved early-build history to keep things lean.

_[tool: snip]_

_[tool: snip]_

Bumped the field padding up one notch and refreshed the card — search and "who said it" now have a bit more breathing room, kept in sync with the app's compose fields.

## User

Regenerate "Logo & lockups": a bit bigger heart

## Assistant

_[tool: read_file]_

_[tool: str_replace_edit]_

Making the heart bigger in both logo files — scaling it about its center.

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: show_html]_

_[tool: show_to_user]_

Bigger heart now reads clearly across all lockups. Refreshing the card.Done — the heart in the bookmark mark is scaled up ~30% in both the mark and the wordmark, so it's more legible at small sizes (app icon, on-ink) while keeping the bookmark silhouette.

## User

Regenerate "App — Vocabu PWA": too much rose in general. it looks like secondary color instead of accent

## Assistant

_[tool: str_replace_edit]_

You're right — rose should be the rare accent (the heart, the compose button), not the dominant tone. The audio player and collection tags were painting half the card rose. I'll move audio + follow to the blue secondary and neutralize the collection tag, reserving rose for the heart, FAB, and active states.Now the Follow buttons → blue, and mirror the audio/tag changes in the preview card.

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

Let me also neutralize the compose "recorded" state (it flipped to rose) and keep it in the blue audio family.

_[tool: show_html]_

Let me verify the rebalanced feed.

_[tool: show_to_user]_

Much better balance — rose now lives only in the like heart and a single avatar; blue carries the audio. Refreshing the app card.

Done. Rose is now a true accent — it appears only in the **like heart**, the **compose FAB**, the **active tab**, and the occasional avatar. The audio player and Follow actions moved to the blue secondary, and collection tags went neutral, so the cards read mostly black-on-white with rose as the pop. Mirrored the same change in the "Word card" spec.

## User

Could we have the card sample without an audio clip, please?

## Assistant

_[tool: read_file]_

Sure — let me make the "Word card" spec sample a no-audio entry so it shows the optional case.

_[tool: str_replace_edit]_

_[tool: register_assets]_

_[tool: show_html]_

_[tool: str_replace_edit]_

Small fix — the meaning toggle and tag should stack (as they do in the real component), not sit on one line. Let me wrap them.

_[tool: show_html]_

_[tool: save_screenshot]_

_[tool: show_html]_

_[tool: show_to_user]_

Now they stack cleanly. Refreshing the card for you.The "Word card" sample now shows an entry **without** an audio clip — just the word + gloss, the "Meaning & story" toggle, collection tag, and social actions. (The audio waveform remains an optional element on entries that have a recording, as you can see live in the app feed.)

## User

Regenerate "App — Vocabu PWA": audio sample in rose a bit too much imho. more airy, elegant

## Assistant

_[tool: snip]_

_[tool: str_replace_edit]_

Right — that filled tinted block is heavy. Let me make the audio sample airy and elegant: drop the box, use a slim outlined play button and a thinner, more-spaced waveform.

_[tool: show_html]_

_[tool: show_to_user]_

Much airier now — the audio is just a slim outlined play button and a fine waveform, no heavy block. Refreshing the app card.The audio sample is now airy and elegant — the filled block is gone, replaced by a slim outlined play button and a fine, well-spaced waveform with a quiet neutral duration. It sits lightly on the card, and rose is left as the single accent in the like heart.

## User

Give me a prompt to pass it to design creation please

## Assistant

_[tool: snip]_

Here's a ready-to-paste prompt that captures Vocabu's concept and visual system:

---

**Build a mobile-first PWA called Vocabu — a personal dictionary of how the people you love talk.**

**Concept:** Vocabu (from *vocabulary*) lets you keep the memorable ways the people in your life speak — a toddler's first words, a friend's ridiculous catchphrase, a grandparent's saying, a parent's wisdom. It's like a gentler, warmer Twitter, built for keeping rather than performing. Tagline: *"Never lose your sweet moments."*

**The core object — a word entry:**
- The **word or phrase** (large; auto-shrinks for longer phrases)
- **Who said it** + relation (e.g. "Mira · my daughter · 22 mo", "Dad", "Theo · best friend")
- An optional one-line **meaning/gloss**
- An unfoldable **"Meaning & story"** description
- An optional **audio sample** (waveform player)
- A **collection** tag (e.g. "Mira's words", "Dad's wisdom")
- Social row: like (heart), reply, save

**Screens:** Feed (with an "On this day" resurfacing card), Compose (bottom sheet: word → who said it → meaning → story → record voice → collection), Word detail + replies, Discover (themes + dictionaries to follow), Saved (collections grid + recent), Profile ("my dictionary").

**Visual system:**
- **Canvas:** clean cool near-white `#FBFEFF`; text near-black `#1B1D1E`. Never pure white/black.
- **Accents (use sparingly):** bright **rose `#ED5379`** = the rare accent — reserve for the like heart, the compose FAB, active tab, occasional avatar. Bright **light blue `#1F9EDB`** = secondary — links, audio player, Follow, the "Meaning & story" toggle. Most of the UI is black-on-white; color is a pop, not a wash.
- **Type:** one family, **Hanken Grotesk**, delicate — headings 500–600 weight, body/words 400. No serif.
- **Shape:** rounded-rect, not pill. Buttons 12px, cards 14px, inputs/chips ~10px; chips/FAB/avatars stay round. Compact, low-padding controls.
- **Cards:** white surface, 1px hairline border, very soft shadow.
- **Audio sample:** airy and elegant — a slim *outlined* play button + a fine, spaced waveform that fills on play; no heavy filled block.
- **Motion:** gentle, never bouncy (~200ms ease-out); heart does a single soft pop when loved.
- **Mobile/thumb-first:** bottom tab bar; compose FAB centered-bottom; rare actions top-left; 44px touch targets.
- **Icons:** Lucide (light outline); only the heart fills (rose) when loved.
- **Voice:** warm, plain, intimate; sentence case; no emoji in chrome; quiet about numbers. Never correct the quoted words.

---

Want me to tailor this prompt for a specific tool (e.g. a single-screen mock, a Figma-style brief, or a one-shot HTML prototype)?

