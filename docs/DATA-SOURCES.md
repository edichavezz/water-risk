# AguaRiesgo — Data Sources Reference

**Last updated:** July 2026  
**Purpose:** Master catalogue of all data sources used or planned. For raw research and source evaluation, see `water-spain-research.md`.

---

## v1 — Built ✅

### 1. Geocoding — Nominatim (OSM)

| Field | Value |
|-------|-------|
| What | Address, postcode, and municipality geocoding for Spain |
| Endpoint | `https://nominatim.openstreetmap.org/search?q={query}&format=json&countrycodes=es` |
| Auth | None |
| Licence | ODbL (OpenStreetMap) |
| Update frequency | Continuously (OSM community edits) |
| Spatial granularity | Address-level |
| Implementation | `services/geocoding.ts` → `geocodeAddress()` |
| Limitations | Rural Andalucía postcodes occasionally incomplete; falls back to municipality name gracefully. Supply zone boundaries not included — deferred to v2. |

---

### 2. Riverine Flood Zones — MITERD SNCZI

| Field | Value |
|-------|-------|
| What | Flood zone polygons for Spain — T10 (10-year), T100 (100-year), T500 (500-year) return periods |
| Endpoint | `https://wms.mapama.gob.es/sig/Agua/ZonasInundables/wms.aspx` |
| Auth | None |
| Licence | Open — Ministerio para la Transición Ecológica y el Reto Demográfico |
| Update frequency | Periodic (major revision post-DANA 2024 still in progress) |
| Spatial granularity | River-catchment polygon |
| Implementation | `services/floodZone.ts` — WMS GetFeatureInfo point query + tile URL for overlay |
| Layers used | `ZONA_INUNDABLE_T10`, `ZONA_INUNDABLE_T100`, `ZONA_INUNDABLE_T500` (confirm exact names from GetCapabilities) |
| Freshness label shown | "MITERD SNCZI — periodically updated. Post-DANA 2024 revisions may be pending." |
| Limitations | Does not cover coastal flooding (separate service). DANA 2024 event showed some gaps in SE Spain coverage. |

---

### 3. Drought Status — Copernicus EDO (CDI)

| Field | Value |
|-------|-------|
| What | Combined Drought Indicator (CDI) — pan-European grid, updated weekly |
| Endpoint | `https://edo.jrc.ec.europa.eu/geoserver/edo/wms` layer `cdi_current` |
| Auth | None |
| Licence | Copernicus open data |
| Update frequency | Weekly |
| Spatial granularity | ~5 km grid |
| CDI scale | 1 = Alert, 2 = Warning, 3 = Watch, 4 = Partial recovery, 5 = Recovery/None |
| Implementation | `services/drought.ts` — WMS GetFeatureInfo point query. Parses CDI numeric value, maps to level. |
| Freshness label shown | "Copernicus EDO — updated weekly" |
| Limitations | Objective indicator only — does not map to declared supply restrictions, which have no structured national API. Restriction data is v2 (scraper). |

---

### 4. Reservoir Levels — Static seed (v1) / SAIH live (v2)

| Field | Value |
|-------|-------|
| What | Current fill % for nearby reservoirs with historical mean |
| v1 source | 17 Andalucía reservoirs — static JSON seed in `services/reservoirs.ts` |
| v2 source | SAIH Guadalquivir API (datos.gob.es); REDIAM Andalucía Reservoir Viewer near-daily data |
| Auth | None |
| Spatial granularity | Individual reservoir (lat/lng point) |
| Implementation | `services/reservoirs.ts` — `getAllReservoirsGeoJSON()` for map layer; `getNearbyReservoirs()` for panel (haversine, 80 km radius, top 3) |
| Colour coding | < 25% → red, < 40% → orange, < 60% → amber, ≥ 60% → blue |
| Freshness label shown | "Static seed in v1 — live API in v2" |
| Limitations | v1 seed covers Andalucía only; historical mean is manually entered; data is not live. |

---

## v1 — To Build 🔨

### 5. Drinking Water Quality — SINAC (Ministry of Health)

| Field | Value |
|-------|-------|
| What | Tap water compliance status, supply zone type, key parameters (nitrates, turbidity, microbiological) |
| Source | SINAC — Sistema de Información Nacional de Agua de Consumo, Ministry of Health |
| Access | Annual CSV/XML download from datos.gob.es (search: "calidad agua consumo humano SINAC") |
| Auth | None |
| Licence | Open data — Gobierno de España |
| Update frequency | Annual |
| Spatial granularity | Municipality (INE code) |
| Implementation plan | Download dataset → parse offline → bundle as `src/data/sinac.json` keyed by INE code → `services/waterQuality.ts` → `WaterQualityCard.tsx` |
| Spatial match | Nominatim result municipality name → normalise accents → look up INE code → query sinac.json |
| Freshness label to show | "SINAC (Ministry of Health) — {year} annual data" |
| Limitations | Rural areas and small municipalities may not have their own supply zone entry. Bundled data requires annual manual update. |

---

### 6. Coastal Flood Zone — MITERD DPH Marítimo-Terrestre

| Field | Value |
|-------|-------|
| What | Coastal Dominio Público Hidráulico zones — zona de servidumbre de tránsito (20 m) and zona de policía (100 m) from shoreline |
| Source | MITERD — Ministerio para la Transición Ecológica y el Reto Demográfico |
| Endpoint | `https://wms.mapama.gob.es/sig/Costas/ServDPHC/wms.aspx` |
| GetCapabilities | Append `?SERVICE=WMS&REQUEST=GetCapabilities` to discover exact layer names |
| Expected layers | `DPMT_Servidumbre` (20 m), `DPMT_ZonaPolicia` (100 m) — verify from capabilities |
| Auth | None |
| Licence | Open — MITERD |
| Update frequency | Periodic |
| Spatial granularity | Coastal polygon (national coverage) |
| Implementation plan | `services/coastalFlood.ts` — WMS GetFeatureInfo point query (same pattern as floodZone.ts). Card only shown for coastal provinces. Map layer added to MapView.tsx. |
| Coastal province heuristic | Skip query for inland provinces. Coastal list: Huelva, Cádiz, Málaga, Granada, Almería, Murcia, Alicante, Valencia, Castellón, Tarragona, Barcelona, Girona, Islas Baleares, Las Palmas, Santa Cruz de Tenerife, A Coruña, Lugo, Asturias, Cantabria, Bizkaia, Gipuzkoa |
| Freshness label to show | "MITERD — updated periodically" |
| Key distinction | This is about legal building and land-use restrictions, not flood risk per se. Material for property buyers. |

---

### 7. Groundwater Overexploitation — IGME

| Field | Value |
|-------|-------|
| What | Whether the location is within an officially declared overexploited hydrogeological unit |
| Source | IGME — Instituto Geológico y Minero de España |
| Download | `https://info.igme.es/hydrogeologicalunits/` — shapefile or WFS |
| Alternative | datos.gob.es — search "masas de agua subterránea IGME" or "unidades hidrogeológicas" |
| Auth | None |
| Licence | Open — IGME |
| Update frequency | Annual classification |
| Spatial granularity | Hydrogeological unit polygon (~200 units Spain-wide; ~18 declared overexploited) |
| Implementation plan | Download shapefile → filter to overexploited units only → `ogr2ogr` to GeoJSON → bundle as `src/data/groundwater-units.geojson` → `services/groundwater.ts` uses Turf.js `booleanPointInPolygon` (sync, no network call at query time) |
| Dependencies | `@turf/boolean-point-in-polygon`, `@turf/helpers` |
| Freshness label to show | "IGME — annual classification" |
| Geographic concentration | Most overexploited units in SE Spain: Almería, Murcia, Alicante, parts of Granada. Highly relevant for the Farmer persona. |

---

### 8. Bathing Water Quality — EEA

| Field | Value |
|-------|-------|
| What | EU Bathing Water Directive classification for designated bathing sites — Excellent / Good / Sufficient / Poor |
| Source | European Environment Agency |
| Endpoint | `https://bathing-water-quality.eea.europa.eu/api/sites/?country=ES&format=json` |
| Auth | None |
| Licence | Open — EEA |
| Update frequency | Annual (season: April–October) |
| Spatial granularity | Individual bathing site (beach or inland) — ~1,500 Spanish sites |
| Implementation plan | Fetch all ES sites at app startup → cache in module scope → `getNearestBathingSite(coords)` uses haversine → returns nearest within 5 km → `BathingWaterCard.tsx` (suppressed if >5 km or clearly inland) |
| Rating mapping | E = Excellent, G = Good, S = Sufficient, P = Poor |
| Freshness label to show | "EEA Bathing Water Directive — {year} season (Apr–Oct)" |
| API note | Check actual response shape before implementing — wrapper may use `results`, `data`, or array root. Field names for rating and coordinates may differ from documentation. |

---

## v2 — Deferred ❌

| # | Source | What | Blocker |
|---|--------|------|---------|
| 9 | CHGuadalquivir / BOJA scraper | Active drought restriction levels (declared, not CDI) | No structured API; requires scraper + editorial curation |
| 10 | GloFAS (Copernicus) | River flood forecasting — 3–30 day ahead | Too technical/operational for core personas; defer until active-event use case is prioritised |
| 11 | SAIH (per Confederación Hidrográfica) | Real-time river gauge levels | Useful for Farmer persona river abstraction; API testing per-basin needed |
| 12 | Puertos del Estado | Tidal predictions | Too niche / operational; coastal DPH covers structural coastal risk |
| 13 | MITERD / BOJA | Sewage / wastewater alerts | No real-time structured data exists in Spain — annual aggregate only |
| 14 | BOE / BOJA (PDF scraper) | Planned developments with EIA (solar, data centres, golf courses) | PDF quality varies; requires Claude Sonnet extraction + PostGIS; curated Málaga/Almería pilot first |
| 15 | SAIH historical + REDIAM | Reservoir levels — live and time-series | Needs API testing for structure + update cadence |
| 16 | FEGA SIGPAC | Irrigation zones and coefficients (Farmer persona) | WFS performance at address level needs testing |

---

## Research Reference

`water-spain-research.md` in this folder contains the original source evaluation including: full list of Spanish data portals surveyed, tool landscape review (existing products), EU data sources evaluated, AI integration opportunities. That doc is raw research material. This DATA-SOURCES.md is the structured product reference derived from it.
