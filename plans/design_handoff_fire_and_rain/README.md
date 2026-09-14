# Handoff: Fire and Rain (formerly Water Risk Explorer)

## Overview
A rebrand and scope expansion of the Water Risk Explorer app: it now covers **both water risk (drought, reservoirs) and fire risk (wildfire zones, history, prevention, vulnerable areas)** for a searched place, across the wider Mediterranean rather than just Andalucía/Spain. **If you've already implemented the previous handoff (design 4, the Water Risk Explorer results/detail/AI flow), read `CHANGELOG.md` first — it lists exactly what changed since then so you don't have to diff the whole file.**

## About the Design Files
`Redesign Options.dc.html` is a **design reference built in HTML** — an exploration/decision doc showing several directions at reduced scale, not production code. Recreate the chosen design in the app's existing React/Tailwind codebase (`src/components/Map`, `src/components/Panel`, `src/components/Entry`, `src/components/Header`, `src/index.css` theme tokens, `src/i18n/*.json`) — do not copy the file's markup/inline styles directly.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and layout below are final for the chosen directions. About-page copy is still pending from the user.

## Chosen Directions (current)
- **Landing / map:** `1b` (topographic map texture) → `3a`/`4a`/`4b` (results, detail, AI states, tabs always visible) → **turn 5**: rebrand to Fire and Rain, unified water+fire dataset list (`5a`), Live news tab (`5b`), naming alternative (`5c`).
- **Title typography:** `Petrona` (see turn 6 for the rejected alternatives and why).
- **About page:** `1e` layout, copy pending.

## Design Tokens

### Colors
| Token | Value | Use |
|---|---|---|
| `--color-canvas` | `#FBF8F2` | Cards, panels |
| page background | `#F7F1E7` | Map view / page body |
| `--color-ink` | `#1E2A38` | Primary text |
| `--color-muted` | `#5C6B72` | Secondary text |
| `--color-primary` (water) | `#2B6E86` | Water hazard color: buttons, links, water dot/tag/layers |
| `--color-primary-hover` | `#1F4F63` | Hover on primary |
| `--color-primary-soft` | `#DCEAEE` | Water accent wash, "Water" tag background |
| `--color-accent` (fire) | `#C1663D` | Fire hazard color: fire dot/tag/layers, AI-tab active underline |
| `--color-accent-soft` | `#F1DDCB` | Fire accent wash, "Fire" tag background, AI-assisted badge, tab rail bg |
| `--color-hairline` | `#E4DAC8` / `#E9E1CF` | Dividers, row borders |
| coverage/warning/danger | unchanged | No change |

### Typography
- **Titles** (wordmark, tab labels, dataset row/detail names, section headings, news headlines): **Petrona**, weights 400/600/700.
- **Body/UI** (everything else — inputs, buttons, captions, source lines, form labels): **Atkinson Hyperlegible** — unchanged, keeps the accessibility credential.
- Scale (at 1440px design width, scale proportionally): wordmark 27–30px/600–700; panel location name 16–17px/600; section headings 17–26px/600–700; tab labels 12.5–13px/700; dataset row titles 12.5px/700; body 13–15.5px/400, line-height 1.5–1.7; captions/cadence 10–11.5px.

### Spacing / Radius / Shadow
- Card radius 14–20px; pill/chip radius 6–20px depending on size.
- Floating panel shadow: `0 10px 28px rgba(30,42,56,.16)`; small cards: `0 4px 16px rgba(30,42,56,.12–.14)`.
- Dataset rows: hairline-divided (`1px solid #E9E1CF`), no per-row fill, ~10–11px vertical padding.

## Screens / Views

### Header (all screens)
64px tall, `#FBF8F2` background, no flat border — a **3px teal→terracotta gradient line** underneath (`linear-gradient(90deg, #2B6E86, #C1663D)`). Left: two-circle mark (20px teal droplet-shaped circle + 12px terracotta flame-shaped blob, overlapping bottom-right) + wordmark "Fire and Rain" (Petrona 700, ~27–30px scaled) + 1px hairline divider + tagline "Water and fire risk across the Mediterranean" (Atkinson 12.5px, muted). Right: "About" pill, language toggle ("EN · ES · EL", extend with FR/IT).

### Landing — entry state
Unchanged in structure from the previous handoff: map fills the background (topographic contour-ring texture in teal/terracotta), entry card docked left, sized to content, not full height.

### Landing — searched/results state (`5a`)
Workspace panel (left, content-sized, not stretched):
- Header row: location + region, "New search" link.
- **Three tabs**, underline style: "Public data" / "What does this mean?" / **"Live news"** (new). Active tab gets a 2px underline in teal (data tabs) or terracotta (AI tab). Tabs persist across list/detail/AI views — this is a mode switch, not a view replacement.
- **Unified dataset list**, hairline-divided rows, each with: status dot (teal = water, terracotta = fire; opacity reduced when unavailable) + bold name (Petrona) + a **Fire/Water tag pill** (new) + optional outline "Map layer" chip → summary line → cadence caption.
  - Rows in the mock: Wildfire risk zone (fire, map layer), Recent fire history (fire), Prevention measures (fire), Drought status (water), Nearby reservoirs (water, map layer). Add a **Vulnerable areas** row (fire) alongside these — same treatment, not yet drawn in the mock.

Map layers + legend card (right, floating, collapsible — chevron toggle, collapsed state shown in `3c`):
- **Two labeled groups**: "Fire" (wildfire risk zone, recent fire perimeters — terracotta swatches) and "Water" (flood zones, reservoirs — teal swatches), each its own radio/checkbox group.
- Legend section beneath, swatches for whatever's currently active, works across both families.

### Landing — dataset detail (`4a`, unchanged this round)
Same panel, tabs stay visible ("Public data" active). Back link → dataset title (Petrona) → summary → Updated/Source key-value block → outline "Does not show" box → source link → "Explain this result →" button (solid teal).

### Landing — AI interpretation (`4b`, unchanged this round)
Same panel, "What does this mean?" tab active (terracotta underline). "AI-assisted" badge, dataset-scoped heading, explanation paragraph, "Based on" caption, suggested follow-up chips, input + send button.

### Landing — Live news (`5b`, new)
Same panel, "Live news" tab active. A vertical feed: each item has a Fire/Water tag pill + relative time + source, then a bold Petrona headline. Ends with an attribution/honesty caption ("Pulled automatically from public news sources — not verified"). **This is concept-only for now** — build the UI shell; the actual live news pull is a separate task (see Assets/Sources note below).

### About page (`1e`, unchanged, copy pending)
Layout unchanged from the prior handoff: title block → topographic-pattern divider band → two-column (sticky mini-nav + content), four sections (tool / data / AI / me). **Copy has not been finalized** — implement the layout to flow with real copy of similar length; treat current placeholder text as structure only.

## Interactions & Behavior
- `panelMode` (`data | ai | news`— news is a new third mode) and `panelDepth` (`list | detail | interpretation`) — tabs select mode, independent of depth, exactly as in the previous handoff, now with a third mode added.
- Map layers card: local collapsed/expanded boolean, standard height/opacity transition (`--dur-panel` token).
- Fire/Water tag pills are presentational only — no new interaction, just a visual hazard-family cue alongside the existing status glyph.

## Assets
No photos/illustrations — all texture is CSS gradients (header mark, topographic contour rings). Google Fonts: `Petrona` (titles, new) and `Atkinson Hyperlegible` (existing, body/UI). No new asset files needed.

**Live news** needs a real data source before it can go beyond a static mock — flag this for a follow-up scoping conversation (a news/RSS API, a curated feed, or similar) rather than building against a specific vendor without confirming it with the team first.

## Files
- `Redesign Options.dc.html` — full exploration file. Turn 5 (`5a`, `5b`, `5c`) and turn 6 (font comparison, resolved to Petrona) hold the current direction; turns 1–4 are the prior Water Risk Explorer direction, kept for context.
- `CHANGELOG.md` — exactly what changed since the design you already implemented (design 4), so you can patch rather than rebuild.
