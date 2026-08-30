# Mediterranean Data Coverage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Fire and Rain's search, coverage claims, panel results, map roles,
and AI evidence truthful and as complete as verified sources allow across all
22 Mediterranean countries.

**Architecture:** Keep the registry as the source of truth for applicability,
use one canonical country catalogue everywhere, and rebuild the audit on the
same orchestrator and evidence builder used by the UI. Correct verified source
footprints before running the live matrix; classify real gaps instead of
manufacturing negative findings.

**Tech stack:** TypeScript, React/Vite, Vitest, Node ESM audit scripts, official
Nominatim/EEA/Copernicus/EFFIS/REDIAM services.

**Source gate:** `docs/MEDITERRANEAN-DATA-GROUND-TRUTH.md`

---

## Task 1: Canonical Mediterranean geography and search

**Files:**
- Create: `app/src/data/mediterraneanCountries.ts`
- Create: `app/src/data/mediterraneanCountries.test.ts`
- Modify: `app/src/services/geocoding.ts`
- Modify: `app/src/services/geocoding.test.ts`
- Modify: `app/src/services/newsKeywords.ts`
- Modify: `app/src/services/news.test.ts`

- [ ] Add a failing catalogue test with the exact 22 audit codes and retained
  Portugal control.
- [ ] Add a failing geocoder test proving `countrycodes` contains the complete
  catalogue and reverse geocoding remains ungated.
- [ ] Implement the typed catalogue and derive the Nominatim filter from it.
- [ ] Add a failing news-query test proving every searchable country has an
  explicit GDELT source-country restriction.
- [ ] Extend source-country mappings and verified local-language keyword sets;
  keep English fallback.
- [ ] Run the focused catalogue, geocoding, and news tests.

## Task 2: Upgrade bathing water and constrain its footprint

**Files:**
- Create: `app/src/services/bathingWater.test.ts`
- Modify: `app/src/services/bathingWater.ts`
- Modify: `app/src/registry/datasets.ts`
- Modify: `app/src/registry/datasets.test.ts`

- [ ] Add failing tests for the official 2025 `MapServer/3` endpoint, season,
  `EL` to `gr` normalization, and requested-country rejection.
- [ ] Add a failing registry test: reporting-country coast is covered,
  non-reporting coast unsupported, inland not applicable.
- [ ] Implement the EEA reporting-country set and response attribution check.
- [ ] Use that set in dataset applicability.
- [ ] Run focused bathing-water and registry tests.

## Task 3: Make curated Spanish coverage exact

**Files:**
- Modify: `app/src/services/reservoirs.ts`
- Modify: `app/src/services/reservoirs.test.ts`
- Modify: `app/src/services/waterQuality.ts`
- Modify: `app/src/services/waterQuality.test.ts`
- Modify: `app/src/registry/datasets.ts`
- Modify: `app/src/registry/datasets.test.ts`
- Modify: `app/src/services/coverage.test.ts`

- [ ] Add failing predicate tests for known and unknown Spanish municipalities.
- [ ] Export small record-presence predicates backed by the real curated data.
- [ ] Add failing applicability tests showing Spanish reservoirs and water
  quality are covered only where a local record exists; retain French national
  reservoir coverage.
- [ ] Implement predicates in the registry and verify derived coverage counts.
- [ ] Run focused service, registry, and coverage tests.

## Task 4: Recover Níjar without widening REDIAM semantics

**Files:**
- Create: `app/src/services/andalucia.ts`
- Create: `app/src/services/andalucia.test.ts`
- Modify: `app/src/services/coastline.ts`
- Modify: `app/src/services/coastline.test.ts`
- Modify: `app/src/services/coastalZoning.ts`
- Modify: `app/src/services/coastalZoning.test.ts`
- Modify: `app/src/registry/datasets.ts`
- Modify: `app/src/registry/datasets.test.ts`

- [ ] Add failing tests for a real Andalucía boundary predicate and nearest
  coastline coordinate.
- [ ] Add a failing coastal-zoning test: direct miss retries at the nearest
  coast, accepts normalized Níjar attribution, and rejects another municipality.
- [ ] Implement direct-then-nearest lookup with explicit municipality matching.
- [ ] Restrict coastal-zoning applicability to Andalucía coasts; other Spanish
  and Mediterranean coasts remain unsupported.
- [ ] Run focused spatial, service, and registry tests.

## Task 5: Align coverage maps and user-facing claims

**Files:**
- Modify: `app/src/data/countryOutlines.ts`
- Modify: `app/src/data/countryOutlines.generated.json`
- Modify: `app/scripts/generate-country-outlines.mjs`
- Modify: `app/src/services/coverage.test.ts`
- Modify: `app/src/i18n/en.json`
- Modify: `app/src/i18n/es.json`
- Modify: `app/src/i18n/fr.json`
- Modify: `app/src/i18n/it.json`
- Modify: `app/src/i18n/el.json`
- Modify: `app/src/i18n/pt.json`

- [ ] Add failing coverage-map tests for all EEA Mediterranean reporting
  countries plus Portugal.
- [ ] Regenerate the country-outline asset from verified public geometry.
- [ ] Update all six locale coverage descriptions to state the Mediterranean
  harmonized sources, EEA bathing footprint, extra ES/FR depth, and missing
  groundwater source without overclaiming.
- [ ] Run coverage and locale-loading tests.

## Task 6: Rebuild the current-architecture audit

**Files:**
- Create: `app/scripts/mediterranean-locations.mjs`
- Create: `app/scripts/mediterranean-locations.test.mjs`
- Create: `app/scripts/audit-map.mjs`
- Create: `app/scripts/audit-map.test.mjs`
- Create: `app/scripts/audit-report.mjs`
- Create: `app/scripts/audit-report.test.mjs`
- Rewrite: `app/scripts/audit-coverage.mjs`
- Modify: `app/package.json`

- [ ] Add failing fixture tests for all 22 country codes, with a coastal sample
  and an inland sample where geography permits.
- [ ] Add failing pure-classification tests for consistent results,
  integration bugs, upstream failures, and source gaps.
- [ ] Implement deterministic map-role and finding classifiers.
- [ ] Add report tests from a fixed JSON fixture; implement deterministic
  country/dataset summaries and inconsistency lists.
- [ ] Rebuild the live runner with Vite loading so it calls `coverageProfile`,
  `runProfile`, and `buildEvidence`; geocode serially, verify country identity,
  throttle requests, and write partial JSON atomically after each location.
- [ ] Support `--country`, `--json`, and `--markdown`, and wire
  `npm run audit:coverage`.
- [ ] Run all deterministic audit tests, then one-country Albania smoke audit.

## Task 7: Run and resolve the Mediterranean matrix

**Files:**
- Create: `MEDITERRANEAN-DATA-COVERAGE.json`
- Create: `MEDITERRANEAN-DATA-COVERAGE.md`
- Modify: `docs/MEDITERRANEAN-DATA-GROUND-TRUTH.md`
- Modify: `HANDOFF.md`
- Modify: production/test files only for reproduced integration bugs

- [ ] Run the complete audit for every fixed location in all 22 countries.
- [ ] Inspect each non-consistent cell at the map, registry, fetch, and evidence
  boundaries; document the root cause.
- [ ] For each integration bug, add a failing reproduction test, apply one
  minimal fix, rerun the focused test, then rerun the affected country.
- [ ] Keep unavailable official services as `upstream_failure` and missing
  sources as `source_gap`; do not convert either to a safe finding.
- [ ] Regenerate the full reports until no `integration_bug` remains.
- [ ] Update the Ground Truth Document and handoff with verified outcomes and
  explicit next research items.

## Task 8: Final verification

**Files:** all changed files

- [ ] Run all focused tests from Tasks 1–7.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Review generated JSON and Markdown for all 22 country codes and confirm no
  `integration_bug` cell remains.
- [ ] Review `git diff`, `git status`, and the recent commit history; commit only
  the isolated worktree changes.
