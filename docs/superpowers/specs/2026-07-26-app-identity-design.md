# App Identity: Header and About — Design

**Date:** 2026-07-26
**Status:** Approved
**Base branch:** `worktree-interface-redesign`

## Problem

The app has no visible identity. After the interface redesign the UI is map-first: a floating
`EntryCard`, a `LanguageToggle` in the top-left corner, and — once a location is chosen — a
workspace panel and map overlays. Nothing tells a visitor what the product is, who made it,
where the data comes from, or what its limits are.

The name existed only outside the UI, and inconsistently: `README.md` said `AguaRiesgo 🌊`,
`index.html`'s `<title>` said `Water Risk Explorer`. The redesign spec
(`2026-07-24-water-risk-interface-design.md`) never defined app chrome at all.

## Decisions

**Name.** `Water Risk Explorer`, canonical and **never translated**. The `README.md` H1 is
updated to match. No emoji anywhere, including the favicon.

**Tagline.** Translated, shown beside the wordmark:

- EN — `Check water risks for a place in Spain`
- ES — `Consulta los riesgos hídricos de un lugar de España`

These are character-identical to the existing `entry.heading` values in `en.json` / `es.json`.
The header therefore *takes over* that copy rather than introducing new copy, and `EntryCard`
drops its now-duplicated `<h1>`.

## Components

### `AppHeader`

Slim full-width bar: `h-14`, `bg-canvas/95`, bottom border, `z-30`. Persistent in **both** the
`entry` and `searched` views, so identity never disappears.

- Left: wordmark as the page `<h1>`, tagline beside it.
- Right: `About` button, then the existing `LanguageToggle`.

The tagline stays visible at every width. Hiding it below `sm` would leave the mobile entry
view with no framing at all, since `EntryCard`'s heading is being removed.

`LanguageToggle` moves out of `App.tsx`'s `absolute left-4 top-4` corner and into the bar. The
component itself is unchanged.

### `AboutDialog`

No dialog pattern exists in this codebase, so it is hand-rolled rather than adding a dependency:

- `role="dialog"`, `aria-modal="true"`, labelled by its title element.
- Closes on Esc and on backdrop click.
- Focus moves into the dialog on open and returns to the trigger button on close.
- `z-40`, above the header.

Open/closed state is local `useState` in `AppHeader` — not the global store, and not
route-synced. Nothing else needs to read it.

Content, in order:

1. What this is — one short paragraph.
2. Coverage limits — detailed results for Andalucía; other regions partial.
3. Data sources — **derived from `DATASETS` in `src/registry/datasets.ts`**, which already
   carries `source: { name, url }` per dataset. Hand-copying source names into i18n would
   drift the first time a dataset changes.
4. AI caveat — summaries are model-generated and can be wrong.
5. Not advice — informational only, not financial, legal, or professional advice.

Items 1, 2, 4, 5 are static i18n strings under `about.*`. Item 3 is derived at render time;
only its section heading is translated.

## Knock-on layout changes

A full-width bar collides with several existing top-anchored overlays. Each needs its offset
moved below the bar:

| Element | Current | Reason |
|---|---|---|
| `WorkspacePanel` | `top-6` | Full-height desktop panel starts at the top |
| `LayerTray` | `top-4 right-14` | Sits left of the maplibre nav control |
| maplibre nav control | `top-right` via `MapView.tsx` | Added as `NavigationControl`; offset via `.maplibregl-ctrl-top-right` in `index.css` |
| `MobileSheet` `full` | `h-[92dvh]`, `z-20` | At `full` the sheet's top edge would be clipped by the `z-30` header |

`EntryCard` is vertically centred (`top-1/2`) and `Legend` / `CoverageKey` are bottom-anchored,
so they are unaffected.

## Out of scope, but in this change

- `index.html` favicon is an inline `💧` emoji glyph. Replaced with a plain SVG mark, since
  "never use emojis" applies to app identity. The `<title>` is already correct.
- `README.md` H1 renamed from `AguaRiesgo 🌊`. That one line only — no further README edits.

## Testing

- **i18n parity test** — asserts `en.json` and `es.json` have identical key sets, recursively.
  No such test exists today, so adding `about.*` keys could silently land in one file only.
- **`AppHeader`** — renders the untranslated wordmark; renders the tagline for the active
  language; About button has an accessible name.
- **`AboutDialog`** — closed by default; opens on trigger; closes on Esc and backdrop; has
  `role="dialog"` and an accessible name; lists one entry per dataset source from `DATASETS`.
- Existing `render-smoke.test.tsx` must still pass with the header mounted.

## Explicitly not doing

- No footer or persistent attribution line — the maplibre `AttributionControl` already covers
  basemap credit.
- No nav, no routing, no menu. One About dialog is the whole surface.
- No changes to the entry/searched view state machine.
