# Handoff: Water Risk Explorer — Visual Redesign

## Overview
A visual redesign of the existing Water Risk Explorer app (React + Vite + Tailwind + MapLibre, `andalucia`/Spain water-risk lookup tool). Scope: the landing/map screen (search entry, results panel, layer controls, legend) and the About screen (currently a modal, becoming its own page). This is a **look-and-feel, layout, and typography redesign** — no functional/data changes. All existing behavior, data sources, and copy (aside from noted additions) should be preserved.

## About the Design Files
The bundled file, `Redesign Options.dc.html`, is a **design reference built in HTML** — an exploration/decision doc showing several directions at reduced scale, not production code. Do not copy its markup or inline styles directly into the app. Instead, **recreate the chosen design in the app's existing React/Tailwind codebase**, using its established component structure (`src/components/Map`, `src/components/Panel`, `src/components/Entry`, `src/components/Header`), its Tailwind `@theme` token setup in `src/index.css`, and its i18n system (`src/i18n/en.json` / `es.json`).

Open the file in a browser to view all explored directions full-size; the chosen ones are called out below by their id (e.g. `3a`, `4b`).

## Fidelity
**High-fidelity.** Colors, typography, spacing, and component layout below are final. Where a value isn't specified, follow the nearest analogous decision already in the file (the design keeps a consistent visual language throughout).

## Chosen Directions
- **Landing / map screen:** direction `1b` (topographic-texture map, efficient docked panel), matured in `3a` (results/list state), `3c` (layers card collapsed), `4a` (dataset detail — tabs stay visible), `4b` (AI interpretation scoped to one dataset).
- **About screen:** direction `1e` (no photo hero; thin topographic-pattern divider under the title; sticky mini-nav + two-column compact layout). **Copy is not final** — the user will supply updated content for the four sections (About the tool / About the data / About the AI / About me); implement the layout so it flows naturally with real copy of similar length, and treat the current placeholder text as structure only, not final wording.

## Design Tokens

### Colors
Replace the existing Tailwind `@theme` block in `src/index.css` with these (keeps the same token names so no component classes need to change):

| Token | Old | New | Use |
|---|---|---|---|
| `--color-canvas` | `#FFFFFF` | `#FBF8F2` | App background, cards |
| `--color-canvas` (page bg, About) | — | `#F7F1E7` | Warmer page-level background (map view, About body) |
| `--color-ink` | `#20312A` | `#1E2A38` | Primary text (deep blue-slate, warm-tinted) |
| `--color-muted` | `#68766F` | `#5C6B72` | Secondary text |
| `--color-primary` | `#285F77` | `#2B6E86` | Buttons, active states, links, primary map layer |
| `--color-primary-hover` | `#204E62` | `#1F4F63` | Hover on primary |
| `--color-primary-soft` | `#E4EFF3` | `#DCEAEE` | Selected/active soft backgrounds |
| `--color-subtle-cool` | `#F5F8F9` | `#DCEAEE` (10–15% use) | Cool hover wash |
| `--color-subtle-warm` | `#F7F7F3` | `#F1DDCB` | Warm accent-tinted surfaces (tab rail bg, disclaimer boxes) |
| new: `--color-accent` | — | `#C1663D` | Terracotta accent — sparing use: audience-selected state, "AI-assisted" badge, dividers, illustration/pattern accents |
| new: `--color-accent-soft` | — | `#F1DDCB` | Accent wash background |
| new: `--color-hairline` | — | `#E4DAC8` / `#E9E1CF` | Warm hairline borders/dividers (replaces `border-gray-200/300`) |
| `--color-coverage`, `--color-water`, `--color-warning`, `--color-danger` | unchanged | unchanged | Keep as-is; they already sit comfortably in this palette |

### Typography
- **Titles/headlines/wordmark:** `Fredoka` (Google Font, weights 400/500/600/700) — a rounded, soft display font (droplet-like), used for the app wordmark, panel location name, section headings, dataset titles, About headings.
- **UI/body/data:** keep the existing `Atkinson Hyperlegible` for everything else (inputs, buttons, list rows, captions, legal/disclaimer text) — preserves the app's accessibility credential and its dense-data legibility.
- Add to the font stack/import: `Fredoka` alongside the existing Atkinson Hyperlegible Google Fonts `<link>`.
- Scale used in the mocks (at 1440px design width — scale proportionally for actual viewport):
  - Wordmark: 19–21px, 700 weight, Fredoka
  - Panel location name / card heading: 16–24px, 600 weight, Fredoka
  - Section heading (About): 17–26px, 600–700 weight
  - Body copy: 13–15.5px, 400 weight, Atkinson Hyperlegible, line-height 1.5–1.7
  - Micro/caption (cadence, source lines): 10–11.5px, muted color

### Spacing / Radius / Shadow
- Card radius: 14–20px (16px is the common case)
- Chip/pill radius: 6–20px depending on size (small tag chips 6px, pill buttons 20px)
- Card shadow: `0 10px 28px rgba(30,42,56,.16)` for floating panels; lighter `0 4px 16px rgba(30,42,56,.12–.14)` for small legend/coverage cards
- Panel padding: 20–24px
- Dataset list rows: hairline-divided (no per-row fill), `1px solid #E9E1CF` between rows, ~11px vertical padding — replaces the old solid warm-fill row background

## Screens / Views

### 1. Header (all screens)
- Height 64px, background `#FBF8F2`, no flat border — instead a **3px gradient accent line** directly beneath it: `linear-gradient(90deg, #2B6E86, #C1663D)`.
- Left: a small two-circle mark (20px teal circle `#2B6E86` + 12px terracotta circle `#C1663D`, overlapping bottom-right) + wordmark "Water Risk Explorer" (Fredoka 700, 19–21px, `#1E2A38`) + a 1px vertical hairline divider + tagline (Atkinson Hyperlegible 12.5px, `#5C6B72`) — "Public water data for Spain".
- Right: "About" pill (border `#E4DAC8`, radius 20px, 13px 700 weight) + language toggle pill "EN · ES".
- MapLibre's built-in top-right/top-left control offsets must still clear this header (existing `.maplibregl-ctrl-top-right/top-left { top: 3.5rem }` logic stays, adjust to new 67px total header height if needed).

### 2. Landing — entry state (not searched yet)
Reuse existing `EntryCard` structure/copy, restyled:
- Map fills the screen behind everything: background `#DCEAEE` with a **topographic contour-ring texture** — layered `radial-gradient` "rings" at a couple of off-center points, in translucent teal (`rgba(43,110,134,.08–.18)`) and translucent terracotta (`rgba(193,102,61,.1–.14)`) tones, replacing any flat/plain map placeholder look. (Actual MapLibre style should be restyled toward these warm-blue tones as closely as the vector style / available layers allow — see "Map styling" note below.)
- Entry card: white/canvas background, 16px radius, docked left with generous side margin, NOT full-height — sized to its content.
- Card content order (unchanged from current `EntryCard.tsx` logic): supporting copy → location input → audience toggle (two options, selected state now `border:1.5px #2B6E86; background:#DCEAEE`) → submit button (`background:#2B6E86`, white text, 700 weight) → hint text.
- Coverage key (bottom-right small card) and any legend stay as existing small floating cards, restyled to the new palette (see Design Tokens).

### 3. Landing — searched/results state (`3a`)
Replaces current `WorkspacePanel` + `PanelBody` + `DatasetList` + `LayerTray` + `Legend`:
- **Workspace panel** (left, docked, ~340px wide): sized to its content (no forced full-height stretch — do not set both `top` and `bottom` anchors; let height come from content + padding).
  - Header row: location name (Fredoka 600, 16–17px) + province (muted, 11.5px) + "New search" link (700, `#2B6E86`, right-aligned).
  - **Tabs**: underline style, not filled pills — "Public data" / "What does this mean?" side by side, 13px 700 weight, active tab gets a 2px bottom border in `#2B6E86` (or `#C1663D` when the AI tab is active), inactive tab text `#9C8A6E`. This is a persistent **mode switch**, independent of list vs. detail depth (see Flow section below) — it must stay visible in every panel depth, including dataset detail.
  - **Dataset rows**: hairline-divided list (see Spacing note), each row: status dot (● available `#2B6E86` / ● issue `#C1663D` / ○ unavailable `#8A9AA1`, 55–70% opacity when unavailable) + bold name + optional outline "Map layer" chip → summary line → muted cadence line. No per-row background fill.
- **Map layers + legend card** (right, floating, ~236px wide): **the legend has been merged into the layer tray** since they describe the same thing (what's currently drawn on the map). Structure: header "Map layers" + a **collapse chevron** (small circular button, ⌄ expanded / ⌃ collapsed) → "Primary risk layer" radio group → "Context" checkbox(es) → hairline divider → "Legend" section with color-swatch rows for the active layer(s) → source line.
  - **Collapsed state** (`3c`): the whole card folds to a small pill — "Map layers" label + chevron — floating top-right, freeing the map for unobstructed exploration. Implement as a simple expand/collapse toggle (no need for animation choreography beyond a standard height/opacity transition consistent with the app's existing `--dur-panel` token).

### 4. Landing — dataset detail state (`4a`)
Replaces current `DatasetDetail`:
- Same panel container, same tabs row at top (still "Public data" active) — the tabs are **not** replaced by the detail view, they persist above it.
- Below the tabs: "← All public data" back link (700, `#2B6E86`) → dataset title (Fredoka 600, 20px) → one-line result summary (14px, ink) → a compact `Updated` / `Source` key-value block (11.5px) → a **"Does not show" box** using an outline (not filled) treatment: `border: 1px solid #E9D9C2`, heading in a warm brown (`#8A5A34`), bullet list of limitations → "View original source" link → **"Explain this result →" button**, solid `#2B6E86` background, white text.

### 5. Landing — AI interpretation state (`4b`)
New/restyled `InterpretationView`, reached either by tapping the "What does this mean?" tab directly, or via "Explain this result" from `4a` (both land in the same place, scoped to the same dataset):
- Same panel, same tabs row — now "What does this mean?" is active (underline color `#C1663D` here, to visually flag "this is the AI-assisted tab" — reuses the accent color for exactly this kind of one-off state signal).
- Small "AI-assisted" pill badge (`background:#F1DDCB; color:#8A5A34`).
- Heading scoped to the dataset ("What '{dataset name}' may mean").
- Generated explanation paragraph (13px, line-height 1.6).
- "Based on: {source}" muted caption.
- "Questions you could ask" — a short list of suggested follow-up chips (outline pills).
- A follow-up text input + circular send button (`background:#2B6E86`) at the bottom, matching existing `ai.followUpLabel` / `ai.followUpSend` behavior.

### 6. About page (`1e`, layout only — copy pending)
Becomes a real page/route (not a modal). Structure:
- Header: same global header, with "About" replaced by a "← Back to map" link when on this page.
- Title block: page heading (bold, 32–34px) + one-line subhead, left-aligned, generous top padding (48px).
- A **60px-tall topographic-pattern divider band** directly under the subhead — 3 small clusters of concentric contour rings, alternating teal/terracotta, on the page background — purely decorative, replaces a photo hero.
- Below: a two-column grid, `200px` sticky mini-nav column + flexible content column (40px gap):
  - Mini-nav: "ON THIS PAGE" label (11px, uppercase, muted) + 4 items — "The tool", "The data", "The AI", "Me" — active item gets a small terracotta dot.
  - Content column, four sections in order, each a heading (17px, 700) + body copy (14px, line-height 1.6):
    1. **The tool** — what the tool does.
    2. **The data** — coverage note + a wrapped row of small outline chips, one per data source (e.g. "SNCZI — flood", "Copernicus — drought", "REDIAM — reservoirs", "SINAC — quality") linking out where a source URL exists (reuse `DATASETS` registry).
    3. **The AI** — how AI summaries are generated and their limits.
    4. **Me** — a small inline row: square/rounded avatar placeholder (40px) + name + one-line bio (this section's content and photo will be supplied separately).
  - A small legal/disclaimer line (11.5px, muted) at the very bottom of the content column — understated, not boxed.

## Interactions & Behavior
- **Panel depth/mode model** (from existing `useAppStore`): `panelMode` (`data` | `ai`) is the tab selection; `panelDepth` (`list` | `detail` | `interpretation`) determines what's shown under whichever tab is active. The redesign keeps this exact model — only the visual tab treatment changes (underline vs. filled pill).
- Layer tray/legend card: add a collapsed/expanded boolean (local UI state is fine — doesn't need to be global store state) with a simple height/opacity transition using the app's existing `--dur-panel` timing token.
- Everything else (search, suggestions, audience toggle, retry states, mobile sheet, language toggle) keeps its current logic — only restyle to the new tokens above.
- Responsive/mobile: the existing `MobileSheet` component should receive the same token/typography/tab-style updates; it wasn't separately mocked here, so mirror the desktop panel's new tab and list styling within its existing sheet mechanics.

## Map Styling Note
The map background in the mocks is a simplified CSS stand-in (radial-gradient "contour rings"), not a real MapLibre style. For the actual basemap, restyle the existing MapLibre style (`src/map/basemapStyle.ts`) toward these same warm-but-blue tones as far as the current vector tile source's paint properties allow (water fills toward `#DCEAEE`/`#9FC3CC`, land toward warm neutrals near `#F7F1E7`, muted labels) — treat full-parity with the CSS mock as aspirational, not a hard requirement, since it's bounded by what the tile source exposes.

## Assets
No photographic or illustration assets are used in the chosen directions — all texture is generated with CSS gradients (the two-circle header mark and the topographic contour patterns). No new asset files are needed for `1b`/`3a`/`3c`/`4a`/`4b`/`1e`. Google Fonts: `Fredoka` (new) and `Atkinson Hyperlegible` (existing).

## Files
- `Redesign Options.dc.html` — the full design-exploration file. Turn 4 (`4a`, `4b`) and turn 3 (`3a`, `3b`, `3c`) hold the chosen landing-page directions; turn 1 (`1e`) holds the chosen About-page layout. Earlier/unused directions (`1a`, `1c`, `1d`, `2a`, `2b`) are left in the file for context but are not part of the final direction.
