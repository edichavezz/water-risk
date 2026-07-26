# Search by clicking the map — design

**Date:** 2026-07-26
**Status:** Approved

## Problem

Location can only be chosen through the search box. The entry card already
invites map interaction ("or just explore the map" — `entry.exploreHint`), but
clicking the map does nothing. Users who know *where* they mean but not what
it's called — a plot between towns, a stretch of coast — have no way in.

## Goal

Clicking anywhere on the map offers to run the same profile a typed search
would, in both the `entry` and `searched` views.

## Non-goals

- Keyboard-driven map picking. The map is `role="application"` and not
  keyboard-navigable today; the search box remains the accessible path.
- Drawing areas, radius selection, or multi-point comparison.
- Changing the search box, coverage model, or dataset orchestration.

## Design

### Data path

No new service layer. The feature bridges two functions that already exist:

```
map click → Coordinates → reverseGeocode() → SearchResult → submitLocation()
```

`reverseGeocode` (`src/services/geocoding.ts:71`) already returns a
`SearchResult`; `submitLocation` (`src/components/Entry/submitLocation.ts`)
already runs `beginSearch` → coverage lookup → `runProfile`. Click-originated
searches therefore inherit URL sync (`subscribeStoreToRoute`), coverage
handling, and dataset fetching with no extra work.

### Interaction: pin, then confirm

A click does **not** search immediately. It drops a provisional pin and opens a
popup offering to search. Rationale: `beginSearch` resets `results`,
`interpretation`, `panelDepth`, and `selectedDataset`. In the `searched` view a
stray click would destroy in-progress analysis with no undo. The confirm step
also gives a place to report "outside coverage" or "no place here" *before*
committing.

Sequence:

1. **Hit-test first.** The handler calls
   `map.queryRenderedFeatures(e.point, { layers: [...interactive] })` and
   returns early on a hit. Without this, a click on a reservoir circle fires
   both the existing `map.on('click', 'reservoirs-circle', …)` handler
   (`src/map/dataLayers.ts:135`) and the new map-wide handler — MapLibre does
   not suppress the latter. The interactive-layer list lives next to the layer
   definitions so it stays in sync as clickable layers are added.
2. **Provisional pin + loading popup.** The pin is visually distinct from the
   confirmed-result marker in `MapView` (hollow with a dashed border, rather
   than the filled teal teardrop) so the two states are never confused.
3. **Reverse geocode, guarded.**
   - Nominatim answers unresolvable coordinates with HTTP 200 and a body of
     `{"error": "Unable to geocode"}` — no `address` key. `reverseGeocode`
     currently only guards `!res.ok` and would throw on `r.address.city`. It
     gains a guard returning `null` for that shape.
   - A monotonically increasing sequence token is captured per click; a
     response whose token is no longer current is discarded. Protects against
     a slow first response landing after a second click.
4. **Popup resolves to one of three states.**

   | State | Content |
   |---|---|
   | Place found, in coverage | `Écija · Sevilla` + **Search here** button |
   | Place found, outside coverage | name + "outside coverage" note; button still active — `submitLocation` already shows the location and skips dataset fetches (§15.2) |
   | Nothing resolvable (sea, unmapped) | "No place found here"; no button |

5. **Confirm.** **Search here** calls `submitLocation(result)`. The provisional
   pin and popup clear; `MapView`'s confirmed marker takes over.

Dismissal: a second click elsewhere replaces the provisional pin; Escape or the
popup's close control dismisses it.

Availability: both `entry` and `searched` views. Nothing about the handler is
view-conditional — the store transition is identical in either case.

### Camera

`beginSearch` gains a second parameter `origin: 'query' | 'map'`, defaulting to
`'query'` so existing callers are unchanged. The store records it as
`searchOrigin`.

`MapView`'s camera effect (`src/components/Map/MapView.tsx:72-92`) branches on
it:

- `'query'` — unchanged: fly to the result at zoom 11.
- `'map'` — ease to the point at the **current** zoom. The user clicked
  somewhere they were already looking at; re-zooming to 11 reads as the map
  fighting them.

`prefers-reduced-motion` continues to short-circuit to `jumpTo` in both
branches.

### Module layout

New module `src/map/pickLocation.ts`, bound from `bindMapInteractions` so map
event wiring stays in one place. Keeping the logic out of `MapView.tsx` avoids
a re-binding `useEffect` and the stale-closure risk that comes with it; the
handler reads `useAppStore.getState()` at click time, matching the pattern the
reservoir handler already uses.

The module exports:

- `bindLocationPicker(map)` — attaches the handler.
- `resolvePick(coords, seq)` — the async geocode + state derivation, exported
  for tests.

Popup rendering uses a MapLibre `Popup` with `setDOMContent` and a real
`<button>` element, following the existing hover-popup pattern in
`dataLayers.ts`. Strings come from `i18n.t`, as that module already does.

### i18n

New keys in both `src/i18n/en.json` and `src/i18n/es.json` under `map`:

- `pickLoading` — "Finding this place…"
- `pickSearchHere` — "Search here"
- `pickNoPlace` — "No place found here"
- `pickOutsideCoverage` — "Outside coverage — location only"

`entry.exploreHint` is reworded from "or just explore the map" to name the
affordance explicitly ("or click anywhere on the map").

### Accessibility

- The popup's action is a real focusable `<button>`, reachable by Tab once
  open. Focus is not stolen automatically.
- Map picking is additive; the search box remains the complete keyboard path.
- The provisional pin is decorative; the popup text carries the meaning.

## Testing

`src/map/pickLocation.test.ts`:

- a click on an interactive feature returns early and starts no geocode
- an unresolvable geocode yields the `no-place` state, not a throw
- a stale sequence token's response is discarded
- in-coverage and out-of-coverage results map to the right states

`src/services/geocoding.test.ts` (or extended): `reverseGeocode` returns `null`
for a 200-with-`error` body.

`src/store/useAppStore.test.ts`: `beginSearch` defaults `searchOrigin` to
`'query'` and records `'map'` when passed.

## Risks

- **Nominatim rate limits.** Picking is one request per *click*, not per
  keystroke, so it adds less load than the existing typeahead. No throttling
  beyond the stale-response guard.
- **Touch.** MapLibre does not emit `click` after a drag, so pan gestures will
  not spuriously drop pins. Worth a manual check on a narrow viewport.
