# Changelog — since the design you already implemented

You said you'd already implemented "design 4" (turn 4 in `Redesign Options.dc.html`: the results → detail → AI flow, under the **Water Risk Explorer** name, teal-only palette, Atkinson Hyperlegible for everything including titles/tabs). Everything below is what changed since then. Anything not listed is unchanged — no need to touch it.

## 1. Rebrand: Water Risk Explorer → Fire and Rain
- **New name, new scope.** The product is no longer water-only — it now covers **water risk (drought, reservoirs) and fire risk (wildfire zones, fire history, prevention measures, vulnerable areas)** for one place, side by side.
- **Geography widens** from Andalucía/Spain to the wider **Mediterranean** (mocks now use Chania, Crete as the example location, not Ronda, Spain). Language list grows to include French and Italian alongside Spanish/Greek.
- **New header mark**: a small two-circle glyph (teal droplet + terracotta flame, overlapping) replaces the plain wordmark-only header. See `5a` for the exact shapes/positioning.
- Tagline changes from *"Public water data for Spain"* to **"Water and fire risk across the Mediterranean"**.

If you're not ready for the full rename yet, `5c` shows a lower-risk alternative: keep "Water Risk Explorer" as the primary name and add "Fire and Rain" as a subordinate tagline. Everything else in this changelog still applies either way.

## 2. Unified dataset list (was water-only)
The dataset list in the results panel now mixes both hazard families in one list (see `5a`), instead of only flood/drought/reservoirs/water-quality:
- **New fire datasets**: Wildfire risk zone, Recent fire history, Prevention measures, (Vulnerable areas / WUI — implied by your answer, not yet mocked as its own row — add it as a fifth row alongside the others, same treatment).
- Existing water datasets (drought, reservoirs, etc.) are unchanged in content/behavior.
- **Status dot color now also signals hazard family**: terracotta (`#C1663D`) dot = fire dataset, teal (`#2B6E86`) dot = water dataset. This is in addition to, not instead of, the existing available/loading/error glyph logic — don't drop the non-color status cues from the original spec.

## 3. Fire/Water tags on every dataset row (new, this round)
Each row in the unified list, and in the Live news feed, now carries a small pill tag — `Fire` (`background:#F1DDCB; color:#8A5A34`) or `Water` (`background:#DCEAEE; color:#1F4F63`) — next to the dataset/headline name. Purely a labeling addition; no layout change beyond fitting the extra chip inline.

## 4. Map layers card: now two groups, not one
The "Map layers" card (right side, collapsible — chevron toggle, see `3c` for the collapsed state) now has two labeled groups instead of one flat list: a **Fire** group (wildfire risk zone, recent fire perimeters) and a **Water** group (flood zones, reservoirs), each with its own small uppercase label in the matching hazard color. The legend section beneath still merges both, matching whatever's currently active.

## 5. New "Live news" tab (new feature, not in design 4)
A third tab, alongside "Public data" and "What does this mean?": **Live news**. Per-place feed of recent headlines, each tagged Fire/Water, with a relative timestamp and source, and an honesty caption ("Pulled automatically from public news sources — not verified"). See `5b` for full layout. This is the one piece flagged as concept-only — the actual live pull is a separate engineering task; today it's just the front-end shell.

## 6. Typography: titles get a distinct serif (was all Atkinson Hyperlegible)
In design 4, **everything** — wordmark, tabs, dataset titles, section headings — used Atkinson Hyperlegible. That's changed:
- **Titles now use `Petrona`** (Google Font, weights 400/600/700) — the app wordmark, tab labels ("Public data" / "What does this mean?" / "Live news"), dataset row names, dataset detail headings, About-page section headings, and news headline text.
- **Atkinson Hyperlegible stays** for everything else: body copy, captions, source/cadence lines, form labels, buttons — this hasn't changed and shouldn't.
- We tried two other title treatments first (Fredoka — too rounded/playful; Instrument Serif — too thin/low-contrast to read at small sizes) before landing on Petrona for its balance of warmth and legibility down to ~12.5px. Turn `6` in the file shows the four candidates side by side if you want the reasoning trail.

## Unchanged
- The About page direction (`1e` — sticky mini-nav, two-column, topographic divider) is unchanged and still **pending final copy** from you (tool / data / AI / me sections).
- Panel depth/tab state model, dataset detail layout, AI-interpretation layout, collapsible layers card — all unchanged from design 4 aside from the tag/typography updates above.
