# Data coverage audit — plan

Goal: for random Spanish/Andalucían locations, check every dataset on four axes
and classify each gap as **impossible / connection broken / researchable**.

The four axes (one row per location × dataset):

| axis | what is checked |
|---|---|
| map layer | `mapRole`, `mapUnavailable`, and whether the tile actually paints |
| panel value | `DatasetDef.fetch()` status + data |
| coverage claim | does `lookupCoverage().datasets` include this id |
| AI evidence | the string `buildEvidence()` hands the model |

## Steps

1. **Verify the groundwater false negative.** `groundwater-units.json` holds 4
   units, 3 of them in Murcia/Alicante. Outside them `getGroundwaterStatus`
   returns `available` + `inOverexploitedUnit: false`, which `ai.ts` renders as
   a sourced "Not inside a declared overexploited unit (source IGME)". If that
   holds, it is a wrong-answer bug, not a missing-data gap, and must be fixed
   here.
2. **Build the audit harness** (`scripts/audit-coverage.mjs`): Node script
   against a running `vite dev`, importing the real service modules.
   - shim `fetch` so bare `/api/...` paths resolve to the dev server
   - pure-JS PNG centre-pixel decode to stand in for
     `createImageBitmap`/`OffscreenCanvas` (no new deps, real code path intact)
   - serialise Nominatim at ≥1 req/s with a real User-Agent
3. **Instrument the two other false-negative shapes** so the harness can tell
   an outage from a real absence:
   - `getDroughtStatus` catches every error → `unknown`; probe the proxy status
   - `getFloodZoneStatus` returns `inZone:false` if only some layers fail; log
     per-layer results
4. **Check the coverage claim.** `coverage.ts` asserts `ALL_DATASET_IDS` for all
   of Andalucía, while `sinac.json` has 13 municipalities and `SUPPLY_SYSTEMS`
   covers 133 of ~785. Make the claim match reality.
5. **Research the researchable gaps**, prioritised:
   - groundwater — look for REDIAM WFS/WMS *masas de agua subterránea* with
     estado cuantitativo/químico (a REDIAM proxy upstream already exists)
   - supplySystems — hand-curatable from operator service areas; expand by
     population, state the remainder
   - waterQuality (SINAC) — likely no bulk download; fix the claim, don't
     manufacture data
6. **Write the report** with evidence inline (status codes, capabilities
   excerpts) and state plainly what is left and why.

## Rules

- Nothing added without a citable source and a `// NOTE (verified …)` comment,
  matching the provenance style already in this codebase.
- A sourced-looking wrong answer is the defect being audited for; never add one.
