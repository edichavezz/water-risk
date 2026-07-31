# Data coverage audit

Run 2026-07-30/31 against the live services, 12 locations × 7 datasets, checking
the four axes separately: **map layer**, **panel reading**, **coverage claim**,
**AI evidence**. Harness: `app/scripts/audit-coverage.mjs` (runs the real app
modules under Node against a Vite dev server, so the readings are the app's own,
not a reimplementation).

    AUDIT_PORT=5231 node scripts/audit-coverage.mjs --json out.json

## Where it stands after the fixes

| Location | flood | drought | reservoirs | waterQuality | coastalFlood | groundwater | bathingWater |
|---|---|---|---|---|---|---|---|
| Sevilla | ok | ok | ok | ok | n/a | GAP | n/a |
| Marbella | ok | ok | ok | ok | ok | GAP | ok |
| Níjar | ok | ok | GAP | ok | n/a | GAP | n/a |
| Úbeda | ok | ok | ok | GAP | n/a | GAP | n/a |
| Aracena | ok | ok | GAP | GAP | n/a | GAP | n/a |
| Tarifa | ok | ok | ok | GAP | ok | GAP | ok |
| Guadix | ok | ok | ok | GAP | n/a | GAP | n/a |
| Zuheros | ok | ok | ok | GAP | n/a | GAP | n/a |
| Lepe | ok | ok | ok | GAP | n/a | GAP | n/a |
| Órgiva | ok | ok | GAP | GAP | n/a | GAP | n/a |
| Cartagena | ok | ok | GAP | GAP | n/a | GAP | ok |
| Valencia | ok | ok | GAP | ok | n/a | GAP | ok |

`n/a` = the dataset does not apply at this point (inland, so no coastal zoning
and no bathing site) and the card is retired rather than shown empty.
`GAP` = we have no reading. Cartagena and Valencia are outside the covered
region and are there as controls.

Before this work, four of the seven columns were wrong in ways that did not look
wrong. Every fix below was verified by a before/after audit run; 242 tests pass.

## What was broken, and which of the three causes it was

### 1. Groundwater — a sourced-looking false negative (not a service problem)

The worst finding. `groundwater-units.json` was four hand-drawn rectangles,
three of them outside Andalucía. Every point in Spain fell outside all four, so
the dataset answered `available` + `inOverexploitedUnit: false` everywhere, the
panel rendered it as a result, and `ai.ts` handed the model *"Not inside a
declared overexploited hydrogeological unit (source IGME)"* — a clean bill of
health, with a citation, for a question nobody had asked any service.

All four axes agreed with each other and all four were wrong. This is exactly
the failure the harness was built to catch: a dead answer wearing a source.

**Cause: (c) that turned out to be (a).** No replacement exists to connect:

- MITECO's hydrogeological-units gateway returns a server-side
  `NullReferenceException` on every request.
- The REDIAM layer that used to publish the units is gone from its capabilities.
- IDEE's equivalent service covers surface water only.

There is a further trap worth recording: the WFD "mal estado cuantitativo"
classification is published and *looks* like a substitute, but it is not the
same thing as a legally declared overexploited unit. Wiring it up would have
produced a second sourced-looking wrong answer.

Removed the data, the map layer and the map role. The dataset now reports
`unavailable` and the coverage box no longer promises it. The evidence branch in
`ai.ts` is now unreachable and says so.

### 2. Drought — a live reading discarded as "no data"

**Cause: (b), our side of the connection.** The Copernicus EDO `cdiad` layer
paints *only* Watch, Warning and Alert — confirmed two ways: `GetLegendGraphic`
returns exactly three swatches, and tiles pulled over Spain and central Europe
contain no fourth colour anywhere. So an unpainted land pixel means "below the
Watch threshold", which is a real answer. We were reading it as unknown, which
is why most of Andalucía showed no drought data on a perfectly healthy feed.

Recovered readings at 7 of 12 locations.

The obvious risk in that fix is that a blank raster from a broken service is
indistinguishable, at one pixel, from a correct "nothing here" — and "no
drought" is the reading a user would most want to trust. So `'none'` is only
returned after a once-per-session sentinel proves the layer is rendering
somewhere over Iberia. If the sentinel fails, the answer stays unknown.

Also trimmed the palette from 8 entries to the 3 the service actually uses; the
extra 5 were nearest-colour attractors that could only mislabel a reading.

### 3. Coverage boundary — Tarifa was told it was outside Andalucía

**Cause: (c), researchable — and now researched.** The boundary was a 24-point
sketch that ran north of Tarifa. Replaced with real OSM geometry (relation
349044) via `app/scripts/fetch-andalucia-boundary.mjs`, which is reproducible
and self-verifying: it checks six towns that must be inside and four that must
be outside, and exits without writing if any check fails. 35,458 points
simplified to 1,487 (35 KB).

### 4. Coastal zoning — query box too narrow to reach the geometry

**Cause: (b).** The zoning is lines and transects, not filled polygons, so the
query box width is what determines reach. At the original 0.003, *every* coastal
town probed missed on both layers against a healthy service — Tarifa, Marbella,
Nerja, Roquetas all got "Search returned no results" at unambiguously coastal
addresses.

Widened to 0.05 in two steps, with the attribution checked rather than just the
hit count — `parseFeatureInfo` takes the first feature and the service does not
order by distance, so a wide box could return a neighbour's transect and look
authoritative:

| Point | 0.003 | 0.03 | 0.05 | feature returned at 0.05 |
|---|---|---|---|---|
| Tarifa | miss | HIT | HIT | `MUNICIPIO = TARIFA`, Tarifa_10 "Tarifa Urbano" |
| Nerja | miss | HIT | HIT | `MUNICIPIO = NERJA`, Nerja_06 "Playa el Carabeo" |
| Marbella | miss | miss | HIT | `MUNICIPIO = MARBELLA`, Marbella_14 "Urbanización Pino Mar" |
| Roquetas | miss | miss | HIT | `MUNICIPIO = ROQUETAS DE MAR`, Roquetas_09 |

Every feature named the town queried — no leakage. The guard against the wider
box producing false positives is inland towns in coastal provinces: Aracena,
Guadix, Órgiva, Ronda, Jerez and Córdoba all return nothing at both widths.
`coastalZoning.test.ts` pins the box width at both ends.

### 5. Flood — an all-clear derived from a third of the evidence

**Cause: (b).** `getFloodZoneStatus` samples T10, T100 and T500. If T10 came
back unpainted and the two wider zones — the ones most likely to contain the
point — both errored, it returned `inZone: false`. A partial outage read as
"outside the flood zone". It now throws unless every period answered, so the
card shows an error. A hit on T10 still short-circuits, since that finding needs
no other layer.

### 6. Inland towns showed empty coastal and bathing cards

**Cause: (b), a matching bug.** Bathing sites were matched by province
substring, so Aracena, Guadix and Órgiva — 60–100 km inland — got cards that
then reported no data. A miss on either dataset is now `not_applicable`, which
retires the card rather than showing a gap that was never a gap.

### 7. The coverage box over-promised

It claimed groundwater everywhere and did not distinguish the region-wide
datasets from the hand-compiled ones. The copy (EN and ES) now says plainly that
flood, drought and coastal zoning are region-wide services, while supply systems
cover 132 of roughly 785 municipalities and drinking-water records are a
13-municipality sample — and that a blank card means we have not sourced that
municipality yet, not that the water there is unrecorded.

## Axis 4: does the evidence actually reach the AI summary?

Checked as unit tests rather than a live call (no API key needed to prove the
wiring). `ai.test.ts` now pins that:

- `not_applicable` datasets are dropped from the prompt entirely, so the model
  is not told "no usable value" about something nobody expected to exist;
- `unavailable` reaches the model as a non-answer carrying no source claim;
- drought `'none'` reaches it as *"below the Watch threshold"* with its date,
  not as the bare word "none" that reads as missing data;
- what `buildEvidence` produces is byte-for-byte what `/api/interpret` receives.

## Known limitations, stated rather than fixed

**Centroid-based querying misses coastal towns whose centre is inland.** Lepe
misses coastal zoning at every width tested; its geocoded centroid is ~5 km from
its own coastline at La Antilla. Níjar (Cabo de Gata) is the same shape of
problem. This is not a service failure and widening the box further would start
returning neighbouring municipalities' transects. The honest fix is to query the
nearest coastline point rather than the centroid — not attempted here.

**The audit harness bypasses the coverage gate.** It calls each dataset's fetch
directly, which is why Valencia shows a water-quality reading in the table. The
app itself gates on `coverage.supported` first, so no such card is shown.

## Left undone

The user's brief included researching and extending the hand-compiled data —
"extra data, such as the reservoir supply system, that we can go out and
research and complete". That arm is **documented, not extended**: supply systems
still cover 132 of ~785 municipalities (22 systems) and SINAC drinking-water
records still cover 13. Níjar, Aracena and Órgiva show reservoir gaps for this
reason, and 7 of 12 locations show water-quality gaps.

Both are researchable — the sources exist and are public, it is compilation
work rather than a connection problem. The coverage copy now tells users this
honestly, which stops the gap being mistaken for "no risk here", but it does not
close it.
