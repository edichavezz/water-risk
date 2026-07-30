# Coastal availability and reservoir history — design

**Date:** 2026-07-29
**Status:** partly superseded — see "Correction" below

## Correction (2026-07-29, after implementation began)

The coastal half of this spec was written against a **stale worktree**
(`worktree-interface-redesign`) and its diagnosis of `main` was wrong. On `main`:

- **The coastal map layer already works.** `24783a8` restored it through
  `/api/wms-proxy` using REDIAM's Andalucía zoning of the same protection zone
  (`ZSP`, `Tramos_homogeneos`). Re-verified live: valid GetCapabilities, and
  non-blank tiles over Marbella, Cádiz and Almería.
- **The false clean bill of health was already fixed.** `53ac5ac` made
  `queryLayer` return `null` on failure, and `getCoastalFloodStatus` throws when
  every query fails, so the card shows `error` rather than "outside the zones".
- **Only the national in-servitude verdict is genuinely unavailable** — MITECO's
  `wms.aspx` gateway is still dead, as originally described.

Consequences for this spec:

- The **health probe and dynamic hide (§Coastal, Tasks 4–5) are cancelled.**
  Hiding the dataset would have deleted a working map layer. The user's
  "hide it entirely" decision was made on the false premise that nothing
  worked, so it was not applied — see the follow-up question instead.
- The **`appliesTo` bug is real and was the one live coastal defect.** Fixed.
- `CoastalFloodResult.degraded` was added and then reverted; the existing throw
  already covers it.

The reservoir half of this spec was unaffected and was implemented as written.

## Problem

Two data gaps, both diagnosed live on 2026-07-29.

### 1. Coastal flood shows nothing

The coastal layers are fully wired — `coastal-servidumbre` and `coastal-policia`
are registered in `dataLayers.ts`, mapped in `layerPlan.ts`, and offered in the
layer tray. They draw nothing because MITERD's entire `wms.mapama.gob.es/.../wms.aspx`
gateway is failing:

```
ServiceException: System.NullReferenceException
  at _Default.ConstruirServiceArcGISBaseUrl()
  ... wms\wms.aspx.cs:línea 606
```

Verified characteristics:

- Fails for both `GetCapabilities` and `GetMap`.
- Returns **HTTP 200 with an XML error body** — so status-code checks miss it.
- Not our request construction: IGN's WMS returns valid capabilities using the
  same parameter shape.
- The ArcGIS server the proxy fronts (`wms.mapama.gob.es/arcgis/rest/services`)
  is alive but hosts only three unrelated services — no DPMT layers. No live or
  downloadable DPMT replacement was found within the timebox.

Three consequences in our code:

- `queryLayer` does `catch { return false }`, so an outage yields
  `{inServidumbre: false, inPolicia: false}` — rendered as *"not in a
  restricted zone."* A false clean bill of health, contradicting the README's
  promise that an unavailable source is never shown as a clean result.
- `COASTAL_LAYERS` names were never confirmed against a live `GetCapabilities`;
  they may still be wrong once MITERD recovers.
- `datasets.ts` passes only `loc.provincia` to `isCoastalProvincia`, though the
  function accepts `displayName` as a documented second signal. Nominatim
  returns comarca names (Marbella → "Costa del Sol Occidental"), so genuinely
  coastal addresses miss. `bathingWater` has the identical bug.

### 2. No historical reservoir levels

`getAllReservoirsGeoJSON` hardcodes `historicalMeanPercent: null`, noting
*"REDIAM's feed has no historical-mean field."* That is narrowly true and its
conclusion is wrong: REDIAM's API is **date-indexed** on the endpoint the
pipeline already uses.

```
/embalses/api/json/andalucia/2026-06-01  → {"fecha":"2026-06-01","E01_por":92,...}
/embalses/api/json/andalucia/2015-07-29  → {"fecha":"2015-07-29","E01_por":76.6,...}
```

Confirmed genuine rather than echoing the path segment:

- `2035-01-01` returns a real **404** — future dates don't exist.
- `1970-01-01` returns `null` for `E02` — stations not yet built.
- `E01_cap` varies across eras (500 → 498.2 → 505.7), tracking capacity revisions.

`fetch-reservoirs.mjs` only ever requests the undated `/andalucia`, so nothing
downstream can show history.

## Decisions

| Question | Decision |
|---|---|
| What does "5 and 10 year" mean? | **Multi-year average for the snapshot's calendar date** — mean fill % on that date across the last 5 and last 10 years. Answers "is this normal for late July?" |
| Coastal behaviour while MITERD is down | **Hide the dataset entirely** — no card, no layer toggle. |

Hiding is implemented as a *dynamic* hide driven by a runtime health probe, not
a build-time constant, so the dataset returns automatically when MITERD
recovers — no code change or redeploy.

Recorded concern, raised and overruled by the user: a hidden dataset can read as
"no such risk here." Mitigated by the hide being automatic and self-reversing.

## Design

### Coastal

**`services/coastalFlood.ts`**

- Add `probeCoastalService(): Promise<'ok' | 'down'>` — one `GetCapabilities`
  request. Classifies as `down` when the response body contains
  `ServiceExceptionReport` or the content type is XML, **regardless of HTTP
  status**, since the gateway always returns 200.
- `queryLayer` returns `boolean | 'error'` instead of swallowing failures.
- `getCoastalFloodStatus` returns a discriminated result so an outage can never
  be rendered as a negative finding. This fix stands independently of the
  hide/show decision.

**Store** — `coastalHealth: 'unknown' | 'ok' | 'down'`, probed once on app init.

**`registry/datasets.ts`**

- `coastalFlood.appliesTo` becomes
  `loc => isCoastalProvincia(loc.provincia, loc.displayName) && coastalHealth !== 'down'`.
  A down service drops the card through the existing `orderedDatasets` filter —
  no new rendering path.
- `bathingWater.appliesTo` gains the same `displayName` argument.

**`components/Map/LayerTray.tsx`** — filter out datasets whose health is `down`,
removing the toggle.

Out of scope, flagged: the SNCZI flood raster is dead on the same gateway, so
the map's headline hazard is also silently blank. Left untouched; needs its own
decision.

### Reservoir history

**`scripts/fetch-reservoirs.mjs`**

- After fetching today's bulletin, loop the same calendar date across the
  previous 10 years — 10 extra requests total, since the 5-year window is a
  subset of the 10-year one. Sequential with a small delay; this is a
  build-time script against a public service.
- Per reservoir compute `mean5yr` and `mean10yr`, averaging **only years where
  that station reported a value** (stations built later return `null`).
  Fewer than 3 contributing years yields `null` rather than a thin average.
- Non-fatal failure: if history fetches fail, keep today's snapshot and write
  `null` means, matching the script's existing "keep the existing file"
  resilience. Current data never regresses because history is unavailable.

**Types** — replace the unused `historicalMeanPercent` on `Reservoir` with
`mean5yr` and `mean10yr` (both `number | null`).

**UI** — surface both in the reservoir rows and the map popup as deltas against
today's level, e.g. "▼ 18 pts below 5-yr avg". Null means render as absent, not
as zero.

## Testing

- `fetch-reservoirs.test.mjs`: averaging with null years, sparse years, and the
  <3-year guard.
- New `coastalFlood` test: probe classification (200-with-XML → `down`), and
  error-vs-absence in `queryLayer`.
- `datasets` test: `appliesTo` with a Marbella-style `displayName` whose
  `provincia` is a comarca.

**Limitation:** the coastal healthy path cannot be verified end-to-end while
MITERD is down. The `'ok'` branch is covered by unit tests with mocked
responses only.
