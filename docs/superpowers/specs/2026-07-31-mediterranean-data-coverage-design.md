# Mediterranean Data Coverage Audit and Completion Design

**Date:** 2026-07-31  
**Status:** Approved by the user's instruction to proceed independently  
**Extends:** `docs/superpowers/specs/2026-07-29-fire-and-rain-design.md`  
**Source gate:** `docs/MEDITERRANEAN-DATA-GROUND-TRUTH.md`

## Problem

Fire and Rain says it works across the Mediterranean, but the statement is not
yet testable and is false in several concrete ways:

- forward geocoding hard-filters to nine countries even though the product
  promise covers 22;
- the audit merged in PR #19 still targets the pre-expansion registry APIs and
  cannot run on the current Fire and Rain branch;
- some applicability predicates describe the source's country rather than the
  records actually available at the place;
- EEA bathing water is both stale (2022 when an official 2025 service exists)
  and over-claimed on coasts outside the EEA reporting footprint;
- REDIAM coastal zoning is claimed on every Spanish coast although it covers
  Andalucía, and the known Níjar centroid defect still hides real zoning;
- coverage copy in six locales includes claims, such as Spanish groundwater,
  that no longer match the registry;
- no durable matrix shows whether the map layer, panel result, coverage claim,
  and AI evidence agree in every Mediterranean country.

The purpose of this work is not to make every matrix cell green. It is to make
every cell truthful, recover every reading supported by a verified source, and
leave the remaining gaps explicit and actionable.

## Scope

The audit covers the 22 Mediterranean littoral country codes defined in the
Ground Truth Document: Spain, France, Monaco, Italy, Malta, Slovenia, Croatia,
Bosnia and Herzegovina, Montenegro, Albania, Greece, Turkey, Cyprus, Syria,
Lebanon, Israel, Palestine, Egypt, Libya, Tunisia, Algeria, and Morocco.

Portugal remains in forward search as an adjacent country already supported by
the app, but it is a control rather than one of the 22 audit countries. Reverse
map search remains ungated, as required by the Fire and Rain design.

The data scope is every registered dataset at the start of the work:

1. river flood zones;
2. drought;
3. reservoirs and drinking-water networks;
4. drinking-water quality;
5. coastal protection zoning;
6. groundwater overexploitation;
7. bathing-water quality;
8. drought restrictions;
9. fire danger;
10. burned-area history;
11. wildfire prevention plans.

Recent news is audited separately as a contextual feed because it is not a
`DatasetDef` and does not enter the AI evidence builder.

## Chosen approach

Use harmonized Mediterranean-wide sources first, add national and regional
detail only where a stable official source already exists, and keep every
semantic gap visible.

This rejects two alternatives:

- **Audit only:** it would identify defects without upgrading the stale EEA
  source or correcting false promises.
- **Twenty-two bespoke national stacks:** it would maximize the number of
  integrations but mix legal definitions, output shapes, and fragile scrapers.
  That is incompatible with the project's rule that a sourced-looking wrong
  answer is worse than an honest gap.

The selected approach provides three consistent readings everywhere in the
Mediterranean domain—Copernicus drought, EFFIS fire danger, and EFFIS burned
areas—then adds verified country or region sources without pretending they are
continental.

## Architecture

### 1. One canonical geography definition

Create a typed Mediterranean country catalogue used by forward geocoding,
coverage tests, source-country restrictions for news, and the audit's fixture
integrity check. It contains ISO alpha-2 code, display name, and whether the
country is part of the 22-country audit or an adjacent retained search country.

Forward geocoding sends the full catalogue to Nominatim. Tests explicitly call
`countrycodes` a filter and assert that all 22 audit countries are present.
Reverse geocoding remains unrestricted.

The audit uses fixed representative locations rather than drawing a new random
sample on each run. Each country has a coastal location and, where geography
makes it meaningful, an inland location. The sample was chosen from a candidate
pool once and is then pinned so before/after runs are comparable. Tiny coastal
states such as Monaco and Malta need only one location.

### 2. Rebuild the audit around current application interfaces

`app/scripts/audit-coverage.mjs` will use:

- `DatasetDef.applicability(place)` for the coverage claim;
- `coverageProfile(place)` for the info-box count and tier;
- `runProfile(place, DATASETS, callbacks)` for the same fetch/short-circuit
  behavior the UI uses;
- `buildEvidence(results, 'en')` for the exact AI input;
- `DATASET_MAP_LAYERS` and source-specific probes for the map axis.

The harness will no longer bypass applicability and call every source. A
separate diagnostic probe may test an unsupported source, but it must be marked
as a diagnostic and must never be confused with the user-visible panel result.

Each location/dataset cell records:

```ts
interface AuditCell {
  applicability: 'covered' | 'unsupported' | 'not_applicable'
  panel: DatasetStatus
  map: { role: 'primary' | 'context' | 'none'; state: string; detail?: string }
  coverageClaimed: boolean
  aiEvidence?: string
  sourceClass: 'continental' | 'national' | 'regional' | 'curated' | 'none'
  finding?: 'consistent' | 'integration_bug' | 'upstream_failure' | 'source_gap'
}
```

The JSON report is the machine-readable evidence. A generated Markdown report
contains the country summary, per-dataset totals, detected inconsistencies, and
links to the Ground Truth Document. Report generation is deterministic from
JSON and does not make new network calls.

### 3. Make coverage predicates mean what the app can actually fetch

The registry keeps the three-valued applicability contract:

- `covered`: a matching source is expected to answer here;
- `unsupported`: the question is real but no matching source is connected;
- `not_applicable`: the question does not arise here.

Specific corrections:

- Spanish reservoir/supply coverage is `covered` only when the curated local
  lookup has a record; France remains covered by its national Hub'Eau lookup.
- Spanish drinking-water quality is `covered` only when the bundled SINAC seed
  has the municipality; other Spanish municipalities become `unsupported`.
- Coastal protection zoning is `covered` only on the Andalucía coast. Other
  coasts remain visible as `unsupported`.
- Bathing water is `covered` only for coastal points in the EEA reporting
  countries; inland points are `not_applicable`, and non-reporting coasts are
  `unsupported`.
- Groundwater remains `unsupported` everywhere until a source with the same
  legal meaning is verified.

Coverage profiles and map shading remain derived from registry truth. EEA
reporting countries can join the weaker national/additional-register map tier;
the legend and About copy must describe it as extra official coverage, not as
the same detail available in Andalucía.

### 4. Upgrade and recover verified sources

#### Bathing water

Switch from the unsuffixed 2022 ArcGIS layer to EEA's official 2025
`BathingWater_Dyna_WM_2025/MapServer/3` layer. Keep the same bounded spatial
query and nearest-site calculation, update the year to 2025, and validate the
country code returned by the feature against the searched country before using
it.

#### Andalucía coastal zoning

Expose the nearest coastline coordinate from the generated coastline service.
For a coastal Andalucía municipality:

1. query the searched coordinate;
2. if it misses, query the nearest coastline coordinate;
3. normalize and compare the returned `MUNICIPIO` with the searched
   municipality;
4. accept the fallback only when attribution matches.

This recovers Níjar without widening the WMS tolerance beyond the last value
proven not to leak into inland towns. A mismatched municipality is
`unavailable`, never a result about the neighboring coast.

#### Mediterranean flood research

The 2026 JRC Mediterranean flood rasters are recorded as a verified future
source, not wired directly in this pass. Their files are hundreds of megabytes
and are not documented as cloud-optimized. A production link requires a
bounded HTTP-range sampling spike and separate modeled-hazard wording. They
must not silently replace official SNCZI results.

### 5. Coverage copy and news context

Update all six locale bundles so coverage copy states only durable facts:

- drought and the two EFFIS fire datasets cover the Mediterranean domain;
- EEA bathing water covers its reporting countries;
- Spain and France have additional national/regional sources, with Andalucía
  holding the deepest curated detail;
- groundwater has no connected source;
- a missing source remains a visible gap.

The news query gains source-country mappings for all 22 audit countries so a
newly searchable country is not silently queried against unrestricted global
publishers. Shared local-language keyword sets may be added where they can be
verified; English remains the fallback. News failure remains separate from an
empty result and never enters AI hazard evidence.

## Consistency rules

The audit fails a cell when any of these conditions is true:

1. applicability says `covered` but the known source footprint excludes the
   country or region;
2. applicability says `unsupported` or `not_applicable` but the UI fetches the
   dataset;
3. a map layer is drawable when the panel has no available source for that
   place, except a documented context layer whose meaning is broader than a
   point result;
4. a panel returns `available` but coverage does not include the dataset;
5. `not_applicable` is used for a real but unsupported question;
6. AI evidence omits an `unsupported`, `unavailable`, or `error` gap, or includes
   a `not_applicable` dataset;
7. an available result's source, date, attribution, or semantics do not match
   the map and panel copy;
8. an upstream error becomes a safe or negative finding.

Exceptions must be data, not comments hidden inside the harness: each exception
records the dataset, condition, reason, and source evidence.

## Error handling

- Geocoding verifies that the resolved `countryCode` matches the fixture. A
  mismatch is an audit failure, not a test of the wrong country.
- Nominatim requests remain serial and at least 1.1 seconds apart.
- Dataset fetches use the orchestrator and may run concurrently within one
  location; the audit limits cross-location concurrency to protect upstreams.
- A non-image WMS response, malformed ArcGIS payload, or service error is an
  upstream/integration failure and cannot be treated as a transparent pixel or
  empty feature set.
- The audit writes a partial JSON report after each location so a late service
  failure does not discard earlier evidence.
- Live-network failures do not make unit tests flaky. Unit tests use captured
  responses and URL/decision seams; the live audit remains an explicit command.

## Testing and verification

Deterministic tests cover:

- all 22 Mediterranean countries plus the retained Portugal control in the
  geocoder filter;
- at least one audit fixture per country and coastal/inland coverage where
  applicable;
- every dataset's applicability across representative countries;
- EEA 2025 endpoint, response parsing, country attribution, and reporting
  country set;
- curated Spanish supply and SINAC predicates matching actual records;
- Andalucía-only coastal zoning and the Níjar nearest-coast fallback, including
  a wrong-municipality rejection;
- coverage profile counts derived from the corrected registry;
- map-layer availability derived from settled results;
- AI evidence preserving visible gaps and excluding only genuine
  `not_applicable` cases;
- parity of all six translation bundles and removal of stale groundwater
  coverage claims;
- deterministic Markdown generation from a captured audit report.

Completion requires:

1. focused tests for every changed service;
2. the full unit suite;
3. `tsc --noEmit`;
4. a production build;
5. a full live Mediterranean audit;
6. manual review of every inconsistency reported by the harness;
7. a final rerun after fixes, with unresolved source gaps documented rather
   than suppressed.

## Deliverables

- corrected application code and tests;
- a reusable 22-country audit fixture catalogue;
- machine-readable live audit JSON;
- a generated Mediterranean coverage report;
- the maintained Ground Truth Document;
- an implementation handoff that lists verified available coverage, live
  upstream failures, researchable future integrations, and sources that are not
  semantically usable.

## Non-goals

- No aggregate risk score.
- No inferred reservoir-to-supply relationship from distance.
- No WFD groundwater-status substitution for legally declared overexploitation.
- No scraping of unstable national portals merely to increase a coverage
  count.
- No presentation of JRC modeled flood rasters as official national zoning.
- No claim that an empty news feed or missing dataset means no event or risk.
