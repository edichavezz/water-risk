# Ground Truth Document: Mediterranean data coverage

**Source material:** Fire and Rain design, PR #19 data-coverage audit, the current application registry, and the official services linked below  
**Created:** 2026-07-31  
**Last updated:** 2026-07-31  
**Maintained by:** Fire and Rain project

---

## How to use this document

This is the source gate for claims about where a Fire and Rain dataset works.
Coverage copy, audit conclusions, map promises, and AI evidence must use claims
from the verified table. A service returning no feature is not enough to prove
that it covers the country, and an available look-alike indicator is not a
substitute for the named dataset.

Two rules keep the document trustworthy:

1. A coverage claim is verified only from an official service, catalogue, or
   the application code that implements the claim.
2. Unresolved source and integration questions stay visible as open items. They
   are never converted into reassuring negative readings.

The project scope for this audit is the 22 sovereign or ISO-coded littoral
countries and territories used by the application: `es`, `fr`, `mc`, `it`,
`mt`, `si`, `hr`, `ba`, `me`, `al`, `gr`, `tr`, `cy`, `sy`, `lb`, `il`, `ps`,
`eg`, `ly`, `tn`, `dz`, and `ma`. Portugal remains a supported adjacent search
country but is not counted as one of the 22 Mediterranean audit countries.

---

## Verified Claims

| # | Claim (exact wording) | Source | Publication / Date | Verified On | Status |
|---|---|---|---|---|---|
| 1 | Nominatim's `countrycodes` search parameter is a hard filter, not a ranking bias. A country omitted from that parameter cannot appear in forward-geocoding results. | [Nominatim Search API](https://nominatim.org/release-docs/latest/api/Search/) | Current API manual | 2026-07-31 | ✅ Verified |
| 2 | The app currently sends only `es,pt,fr,it,gr,hr,si,mt,cy` to Nominatim, so 14 of the 22 Mediterranean audit countries are unreachable through forward search. | `app/src/services/geocoding.ts` at base commit `1d9b73f` | Local application code | 2026-07-31 | ✅ Verified |
| 3 | Copernicus EDO Combined Drought Indicator v4.1.1 has a bounding box of longitude -25 to 51 and latitude 22 to 72, about 5 km resolution, and a ten-day publishing interval. That domain contains all 22 Mediterranean audit countries. | [Copernicus EDO CDI v4.1.1 factsheet](https://drought.emergency.copernicus.eu/data/factsheets/factsheet_combinedDroughtIndicator_v4.pdf) | July 2026 | 2026-07-31 | ✅ Verified |
| 4 | The EDO WMS publishes the current CDI layer and states that omitting `TIME` selects the latest available date. | [Copernicus drought WMS service](https://drought.emergency.copernicus.eu/data/wms-service) | Current service documentation | 2026-07-31 | ✅ Verified |
| 5 | EFFIS fire-danger classes provide a harmonized forecast across Europe, the Middle East, and North Africa. The official `ecmwf007.fwi` WMS layer advertises a world bounding box, and the EFFIS documentation identifies the same six danger classes used by the app. | [EFFIS fire-danger forecast](https://forest-fire.emergency.copernicus.eu/about-effis/technical-background/fire-danger-forecast) and live EFFIS WMS `GetCapabilities` | Current service documentation | 2026-07-31 | ✅ Verified |
| 6 | EFFIS provides near-real-time and historical fire information for European, Middle Eastern, and North African regions, including mapped burned areas. | [EFFIS About](https://forest-fire.emergency.copernicus.eu/about-effis) | Current service documentation | 2026-07-31 | ✅ Verified |
| 7 | EEA's bathing-water assessment covers the EU-27 plus Albania and Switzerland. For the Mediterranean audit this supports Albania, Croatia, Cyprus, France, Greece, Italy, Malta, Slovenia, and Spain; it does not support the other 13 countries. | [EEA bathing-water country factsheets](https://www.eea.europa.eu/en/topics/in-depth/bathing-water/state-of-bathing-water) | 2025 bathing season | 2026-07-31 | ✅ Verified |
| 8 | EEA publishes a 2025 ArcGIS bathing-water service whose point layer is `MapServer/3`; its `qualityStatus` field is explicitly the 2025 season. | [EEA BathingWater_Dyna_WM_2025](https://water.discomap.eea.europa.eu/arcgis/rest/services/BathingWater/BathingWater_Dyna_WM_2025/MapServer) and [point layer](https://water.discomap.eea.europa.eu/arcgis/rest/services/BathingWater/BathingWater_Dyna_WM_2025/MapServer/3) | 2025 service | 2026-07-31 | ✅ Verified |
| 9 | The app currently queries EEA's unsuffixed 2022 bathing-water layer and labels its result as 2022, so a newer official linkage is available. | `app/src/services/bathingWater.ts` at base commit `1d9b73f` | Local application code | 2026-07-31 | ✅ Verified |
| 10 | The app currently marks bathing water `covered` at every coastal point regardless of country, which overstates the EEA source in non-reporting Mediterranean countries. | `app/src/registry/datasets.ts` at base commit `1d9b73f` | Local application code | 2026-07-31 | ✅ Verified |
| 11 | REDIAM coastal zoning is an Andalucía source, but the app currently marks it `covered` on every Spanish coast. Valencia, Cartagena, and other non-Andalusian coasts are therefore promised a source that cannot answer there. | `app/src/registry/datasets.ts` and `app/src/services/coastalZoning.ts` at base commit `1d9b73f` | Local application code | 2026-07-31 | ✅ Verified |
| 12 | The hand-compiled Spanish supply and SINAC datasets are partial seeds, but their applicability predicates currently mark all Spain as covered. This makes the coverage count claim checks that the app already knows have no local record. | `app/src/registry/datasets.ts`, `app/src/data/supplySystems.ts`, and `app/src/data/sinac.json` at base commit `1d9b73f` | Local application code | 2026-07-31 | ✅ Verified |
| 13 | The merged coverage audit cannot run against the current branch: it calls removed `lookupCoverage` and `DatasetDef.appliesTo` APIs that were replaced by `coverageProfile` and `applicability`. | `app/scripts/audit-coverage.mjs` compared with `app/src/services/coverage.ts` and `app/src/registry/datasets.ts` at base commit `1d9b73f` | Local application code | 2026-07-31 | ✅ Verified |
| 14 | The About copy still says Spain has a groundwater source even though PR #19 removed the fabricated geometry and the registry now reports groundwater unsupported everywhere. | `app/src/i18n/*.json`, `app/src/services/groundwater.ts`, and `app/src/registry/datasets.ts` at base commit `1d9b73f` | Local application code | 2026-07-31 | ✅ Verified |
| 15 | JRC publishes version 3.1.1 river-flood hazard rasters for Europe and all basins draining to the Mediterranean, Middle East, and North Africa, at about 90 m for nine return periods from 10 to 500 years. JRC explicitly says these are modeled research products, not official flood-hazard maps. | [JRC dataset catalogue](https://data.jrc.ec.europa.eu/dataset/1d128b6c-a4ee-4858-9e34-6210707f3c81), [README](https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/CEMS-EFAS/flood_hazard/README.txt), and [change log](https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/CEMS-EFAS/flood_hazard/CHANGELOG.txt) | Version 3.1.1, 2026-03-05 | 2026-07-31 | ✅ Verified |

---

## Unverified / Open Placeholders

| # | Claim as referenced in source | Why it's unverified | Next step to verify |
|---|---|---|---|
| 1 | The JRC Mediterranean flood TIFFs can be sampled efficiently by the current browser/serverless architecture. | The files are 260–334 MB each and the catalogue does not state that they are cloud-optimized GeoTIFFs. A full download per query is unacceptable. | Inspect TIFF tiling and HTTP range behavior; build a bounded range-read spike before proposing a production integration. |
| 2 | A single public point-level reservoir or drinking-water source can cover every Mediterranean country. | The verified sources are country or region specific, and reservoir proximity is not a supply relationship. | Continue country-by-country source research, but add a source only when its semantics match the dataset and it has a stable public interface. |
| 3 | A live service publishes legally declared overexploited groundwater units across the Mediterranean. | The prior Spain sources were unavailable or non-equivalent, and WFD quantitative status is not the same legal concept. | Keep groundwater unsupported until a source with matching definitions and real geometry is verified. |
| 4 | Every Mediterranean country exposes a stable official wildfire-prevention-plan URL that can be joined from Nominatim country or region codes. | Existing coverage is a curated ES/FR/IT regional table; the other governments have not yet been verified one by one. | Verify official authority pages and their geographic level before extending `firePrevention`. |

---

## Contested / Disputed Claims

| # | Claim | Nuance / disagreement | Sources on each side |
|---|---|---|---|
| 1 | "A modeled Mediterranean flood raster is equivalent to an official national flood-zone determination." | The JRC raster is useful harmonized context, but JRC explicitly says it is not an official flood-hazard map. It must not silently replace SNCZI or use SNCZI's legal-sounding copy. | [JRC catalogue limitation](https://data.jrc.ec.europa.eu/dataset/1d128b6c-a4ee-4858-9e34-6210707f3c81); current SNCZI implementation in `app/src/services/floodZone.ts` |
| 2 | "An unpainted EDO CDI pixel means no data." | The displayed `cdiad` layer contains Watch, Warning, and Alert; the app separately checks that the layer is rendering before reading an unpainted pixel as below Watch. The all-classes EDO product is a different layer. | [EDO WMS layer list](https://drought.emergency.copernicus.eu/data/wms-service); `app/src/services/drought.ts` |

---

## Change Log

| Date | Change | Reason |
|---|---|---|
| 2026-07-31 | Document created with 15 verified claims and four open source questions. | Establish a durable source gate for the Mediterranean-wide audit. |

---

## Notes for downstream use

- `covered` means a matching source is expected to answer for this place; it
  does not mean the source returned a low-risk result.
- `unsupported` is a visible, AI-visible gap. `not_applicable` is reserved for
  a question that genuinely does not arise at the location.
- Empty feature sets can be real negative findings only after the service and
  geographic footprint are independently verified.
- A source with different semantics must become a separately named dataset or
  remain an open integration; it must not inherit another dataset's label.
