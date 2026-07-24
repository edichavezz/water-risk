# AguaRiesgo — v1 Implementation Plan

**Last updated:** July 2026  
**Status:** Active development — core v1 built, new data sources next; persona model pivoted, code not yet updated to match (see §8.2 and PERSONAS.md)

---

## ⚠️ Persona pivot note (July 2026)

The persona model referenced throughout this doc (Buyer / Renter / Farmer / Business, post-overview selection) is the **model the current code implements**, not the current source of truth. A persona-mapping session against real Spain/Andalucía research replaced it with a tiered model: **Resident/Owner** and **Buyer/Investor** confirmed for MVP (merging old Renter+Buyer and folding Business in as a lens, not a persona), **Policymaker** and **Farmer** flagged beyond/unvalidated. Full detail and citations: `PERSONAS.md`. Backing research and diagrams: Miro board https://miro.com/app/board/uXjVH4jzeig=/.

This document has not been fully rewritten to match — sections below that reference the old four-persona list are left as-is where they describe **what's actually built**, with pivot flags added where the two models conflict. Treat PERSONAS.md as the current persona truth and this doc as the current code truth until they're reconciled.

---

## 1. Product North Star

A bilingual (ES/EN) geospatial tool that lets anyone in Spain — resident, buyer, renter, farmer, business — enter an address and get a plain-language water risk profile: flood zones, drought status, reservoir levels, and AI-generated implications and questions to ask.

*(Persona list above reflects the shipped code's `UserType` union. Per the pivot note, the target persona model is Resident/Owner + Buyer/Investor as MVP, Policymaker + Farmer as unvalidated candidates — see PERSONAS.md.)*

**The gap this fills:** No tool combines flood + drought + supply + groundwater + water quality into a single address-level lookup in Spain, in plain language, for residents.

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Framework | React 18 + TypeScript + Vite | Fast dev, strong typing, good ecosystem |
| Map | **MapLibre GL JS** | Open-source, Mapbox-compatible, supports WMS overlays |
| Map tiles | **OpenFreeMap (Liberty style)** | Completely free, no API key, beautiful, OSM-based. Style URL: `https://tiles.openfreemap.org/styles/liberty` |
| Geocoding | **Nominatim** (OSM) | Free, no key, good Spanish coverage. Fallback: IGN Geocoder |
| Styling | Tailwind CSS | Utility-first, fast to build with |
| i18n | react-i18next | Standard, supports lazy-loading per language |
| AI summaries | Claude API (claude-haiku-4-5) | Fast + cheap for generating plain-language risk profiles |
| State | Zustand | Lightweight, no boilerplate |

---

## 3. Map Choice Rationale

**OpenFreeMap + MapLibre GL JS** is the clear winner for "nicest free map":
- No API key, no billing, no usage caps
- Liberty style is clean and readable, great for data overlays
- MapLibre supports WMS/WFS layers natively (critical for SNCZI flood zones, Copernicus drought)
- Fully open-source MIT licence

Rejected alternatives:
- **Mapbox GL JS**: Requires paid key above 50k loads/month
- **Google Maps**: Paid, ugly default styling, poor WMS support
- **Leaflet**: Fine but renders raster tiles; less crisp for data-dense layers

---

## 4. v1 Data Sources

### 4.1 Built ✅

| # | Layer | Source | Endpoint | Status |
|---|-------|--------|----------|--------|
| 1 | Geocoding | Nominatim (OSM) | `https://nominatim.openstreetmap.org/search` | Live |
| 2 | Riverine flood zones (T10/T100/T500) | MITERD SNCZI | `https://wms.mapama.gob.es/sig/Agua/ZonasInundables/wms.aspx` | Live WMS |
| 3 | Drought status (CDI) | Copernicus EDO | `https://edo.jrc.ec.europa.eu/geoserver/edo/wms` layer `cdi_current` | Live WMS |
| 4 | Reservoir levels (nearest 3) | Static seed → live v2 | 17 Andalucía reservoirs bundled as GeoJSON | Static |

### 4.2 To Build — New v1 Data Sources 🔨

#### 4.2.1 Drinking Water Quality (SINAC)
- **What:** Tap water compliance status, supply zone, source type, key parameters (nitrates, turbidity, pH, microbiological), last test date
- **Source:** Ministry of Health — SINAC (Sistema de Información Nacional de Agua de Consumo)
- **Access:** Annual dataset on datos.gob.es — download CSV/XML, parse offline, bundle as static JSON keyed by municipality code (INE code). Update annually.
- **datos.gob.es search:** `calidad agua consumo humano SINAC`
- **Spatial match:** INE municipality code from Nominatim result → look up in SINAC table
- **Card:** compliance badge (✅ Compliant / ⚠️ Minor issues / ❌ Non-compliant), source type, last test year, 2–3 key parameters in plain language
- **Freshness label:** "SINAC — annual data, {year}"

#### 4.2.2 Coastal Flood Zone (MITERD DPH)
- **What:** Whether the location falls within the coastal Dominio Público Hidráulico Marítimo-Terrestre — the zona de servidumbre de tránsito (20 m from shoreline) or zona de policía (100 m). Distinct from SNCZI riverine zones. Has legal building/use restrictions.
- **Source:** MITERD coastal WMS
- **WMS endpoint:** `https://wms.mapama.gob.es/sig/Costas/ServDPHC/wms.aspx`
- **GetCapabilities:** append `?SERVICE=WMS&REQUEST=GetCapabilities` to discover exact layer names
- **Likely layers:** `DPMT_Servidumbre`, `DPMT_ZonaPolicia` — confirm from capabilities
- **Card:** only show for coastal municipalities (hide/collapse for inland). Show which zone(s) apply and brief legal implication.
- **Map:** separate toggle from SNCZI flood toggle. Blue-tinted overlay.
- **Freshness label:** "MITERD — updated periodically"

#### 4.2.3 Groundwater Overexploitation (IGME)
- **What:** Whether the location is within an officially declared overexploited hydrogeological unit (unidad hidrogeológica sobreexplotada). Spain has 18 such units, mostly SE Spain (Segura, Almería, Murcia) plus some in eastern Andalucía.
- **Source:** IGME eWater portal
- **Data access:** Download shapefile from `https://info.igme.es/hydrogeologicalunits/` → convert to GeoJSON → bundle as static asset (small file, ~200 units total)
- **Spatial test:** Turf.js `booleanPointInPolygon` at query time — no network call needed
- **Card:** unit name, overexploitation status, what it means for abstraction rights and property
- **Map overlay:** optional polygon layer toggled with the reservoir layer or as its own toggle
- **Freshness label:** "IGME — annual classification"

#### 4.2.4 Bathing Water Quality (EEA)
- **What:** Quality rating of nearest designated bathing site(s) — beaches and inland — rated Excellent/Good/Sufficient/Poor under EU Bathing Water Directive
- **Source:** EEA Bathing Water Quality API
- **Endpoint:** `https://bathing-water-quality.eea.europa.eu/api/sites/?country=ES&format=json`
  - Returns all Spanish bathing sites with coordinates, latest rating, and assessment year
  - No API key required
- **Strategy:** Fetch all ES sites at app startup (or cache in a static JSON), compute haversine distance to queried coordinates, show nearest 1–2 sites within 5 km
- **Card:** only show if a site is within 5 km (don't show for inland locations). Site name, distance, rating badge, year.
- **Freshness label:** "EEA Bathing Water Directive — assessed annually, {year} season"

---

## 5. v1 App Structure

Actual built structure (reflects the codebase as of July 2026):

```
app/src/
  components/
    Map/
      MapView.tsx           # MapLibre container — all WMS + GeoJSON layers live here
                            # Layers: SNCZI flood (T10/T100/T500), Copernicus CDI drought,
                            #         reservoirs GeoJSON (halo/circle/label/name),
                            #         coastal DPH WMS (to-build), groundwater GeoJSON (to-build)
    Search/
      SearchBar.tsx         # Address/postcode/municipality input + Nominatim result list
    RiskPanel/
      RiskPanel.tsx         # Right/bottom panel: assembles all cards
      UserTypeSelector.tsx  # Buyer / Renter / Farmer / Business — triggers AI re-generation
      FloodCard.tsx         # Riverine flood zone result (SNCZI)
      DroughtCard.tsx       # Drought status + CDI level (Copernicus EDO)
      ReservoirCard.tsx     # Nearest 1–3 reservoirs with fill %
      AIProfile.tsx         # AI-generated plain-language risk summary
      QuestionsCard.tsx     # AI-generated questions to ask (5–8, per user type)
      WaterQualityCard.tsx  # Drinking water compliance (SINAC) — to-build
      CoastalFloodCard.tsx  # Coastal DPH zones (MITERD) — to-build
      GroundwaterCard.tsx   # Aquifer overexploitation status (IGME) — to-build
      BathingWaterCard.tsx  # Nearest bathing site rating (EEA) — to-build
    LanguageToggle.tsx      # ES / EN switcher
    LayerToggle.tsx         # Map overlay toggle controls (flood/drought/reservoirs/coastal/groundwater)
  services/
    geocoding.ts            # Nominatim search + inferBasin() by province
    floodZone.ts            # SNCZI WMS GetFeatureInfo point query + tile URL helper
    drought.ts              # Copernicus EDO WMS GetFeatureInfo + CDI level mapping
    reservoirs.ts           # Static GeoJSON seed (17 Andalucía reservoirs) + haversine proximity
    ai.ts                   # Claude Haiku: buildContext(), generateRiskSummary(), generateQuestions()
    waterQuality.ts         # SINAC static JSON lookup by INE municipality code — to-build
    coastalFlood.ts         # MITERD coastal DPH WMS GetFeatureInfo — to-build
    groundwater.ts          # IGME GeoJSON + Turf.js booleanPointInPolygon — to-build
    bathingWater.ts         # EEA API fetch + haversine proximity filter — to-build
  data/
    sinac.json              # SINAC annual dataset, keyed by INE code — to-build
    groundwater-units.geojson  # IGME overexploited hydrogeological units — to-build
  store/
    useAppStore.ts          # Zustand: activeLayers, profile, language, userType
  i18n/
    en.json                 # All UI strings in English
    es.json                 # All UI strings in Spanish
  types/
    index.ts                # RiskProfile, UserType, Language, Coordinates, SearchResult,
                            # FloodZoneResult, DroughtStatus, Reservoir, GroundwaterResult,
                            # BathingWaterResult, WaterQualityResult, CoastalFloodResult
  vite-env.d.ts             # ImportMetaEnv declaration (VITE_ANTHROPIC_API_KEY, VITE_AEMET_API_KEY)
```

---

## 6. UI Layout

```
┌────────────────────────────────────────────────────────────────┐
│  🌊 AguaRiesgo  ES | EN    [Flood] [Drought] [Reservoirs]      │
│                            [Coastal] [Groundwater]             │
├────────────────────┬───────────────────────────────────────────┤
│ Search bar         │                                           │
│ ┌────────────────┐ │            MapLibre GL                    │
│ │ Address...     │ │           (OpenFreeMap Liberty)           │
│ └────────────────┘ │                                           │
│                    │  [SNCZI riverine flood overlay — orange]  │
│ User type:         │  [Copernicus CDI drought overlay — red]   │
│ ○ Buyer            │  [Reservoir dots — blue/green/amber/red]  │
│ ○ Renter           │  [Coastal DPH overlay — blue tint]        │
│ ○ Farmer           │  [Groundwater polygon — amber tint]       │
│ ○ Business         │                                           │
│                    │                                           │
│ ── Risk Profile ── │                                           │
│ [Flood card]       │                                           │
│ [Drought card]     │                                           │
│ [Reservoir card]   │                                           │
│ [Water quality]    │                                           │
│ [Coastal flood]    │  (coastal locations only)                 │
│ [Groundwater]      │                                           │
│ [Bathing water]    │  (within 5 km of bathing site only)       │
│ [AI summary]       │                                           │
│ [Questions]        │                                           │
└────────────────────┴───────────────────────────────────────────┘
```

Mobile: stack vertically (search → map → panel).

---

## 7. v1 Build Scope (What's In)

| Flow | v1 Status | Notes |
|------|-----------|-------|
| Location Lookup | ✅ Built | Nominatim geocoding, map fly-to, basin identification |
| Risk Profile by User Type | ✅ Built (old model) | Buyer/Renter/Farmer/Business selector; AI tailors output. **Pivoted in docs to Resident/Owner + Buyer/Investor (MVP) / Policymaker + Farmer (beyond) — code not yet updated, see §8.2 and PERSONAS.md** |
| Active Drought Alert | 🔶 Partial | CDI overlay from Copernicus; manual restriction data deferred to v2 |
| Drinking Water Quality (SINAC) | 🔨 To build | Static JSON from datos.gob.es; lookup by INE code |
| Coastal Flood Zone (MITERD DPH) | 🔨 To build | WMS GetFeatureInfo; coastal locations only |
| Groundwater Overexploitation (IGME) | 🔨 To build | Static GeoJSON + Turf.js point-in-polygon |
| Bathing Water Quality (EEA) | 🔨 To build | Live API; nearest site within 5 km |
| Compare Locations | ❌ v2 | Side-by-side comparison; build time only |
| Planned Developments | ❌ v2 | EIA PDF parsing; deferred post-MVP |
| Generate Questions to Ask | ✅ Built | Claude API generates tailored questions per user type + location |
| Trend / Historical Context | 🔶 Partial | Reservoir fill % + historical mean in v1; time-series chart in v2 |
| Language Switching | ✅ Built | ES/EN toggle via react-i18next; AI output in selected language |

---

## 8. Key Design Decisions

### 8.1 Rural Andalucía postcode gaps
Nominatim handles municipality names well even where postcodes are patchy. Search input auto-suggests municipality names as the user types. If a postcode returns no result, we fall back to municipality name via IGN's geocoder. Edge case: properties spanning multiple supply zones show a "zone boundary" warning.

### 8.2 User type: upfront or post-overview?
Decision (as shipped): **Post-overview**. Show the overview risk profile first (flood zone, drought status, reservoir levels) — this is useful to everyone. User type selector is prominent in the panel and changing it re-renders the AI summary + questions in real-time. This reduces friction at entry and avoids the persona question feeling like a gate.

**⚠️ OPEN CONFLICT — not resolved, do not silently pick a side:** the Miro journey diagram built during the July 2026 persona-mapping session puts persona selection as the *second step*, immediately after location entry and before any data is shown — i.e. it's designed as a gate, the opposite of the reasoning above. Two real considerations pull in different directions: the post-overview approach here was a deliberate, reasoned UX call to reduce friction; the persona-first approach lets the shared risk-assessment core (see PERSONAS.md) determine what's emphasized before the user ever sees data, which matters more now that personas diverge more (Buyer/Investor vs. Resident/Owner want different leading facts, not just different tone). This needs an explicit decision from the product owner, not an implementation default. Until decided, the app should keep shipping post-overview as-is.

### 8.3 Drought restrictions (the hardest data problem)
No structured API exists. v1 shows the Copernicus CDI (objective indicator) with a clear freshness label ("Updated weekly by EU Copernicus"). A "Restrictions" card is present but shows: "No structured alert data available for this municipality. Check [CHGuadalquivir link] for current restrictions." Post-MVP: build a scraper + manual curation layer.

### 8.4 Map tile style
**Liberty** (OpenFreeMap) — it's the most balanced: clear labels, good contrast for overlays, warm tones that work well with the water/risk colour palette. Positron is too light for dense data; Dark is too heavy for a public tool.

### 8.5 AI model
Claude Haiku 4.5 for speed and cost on risk summaries + question generation. Claude Sonnet for more complex EIA summarisation (v2). Output language matches the UI language toggle.

---

## 9. APIs and Endpoints Reference

| Service | Endpoint | Auth | Status |
|---------|----------|------|--------|
| Nominatim geocoding | `https://nominatim.openstreetmap.org/search?q={query}&format=json&countrycodes=es` | None | ✅ Live |
| SNCZI riverine flood WMS | `https://wms.mapama.gob.es/sig/Agua/ZonasInundables/wms.aspx` | None | ✅ Live |
| Copernicus EDO drought WMS | `https://edo.jrc.ec.europa.eu/geoserver/edo/wms` layer `cdi_current` | None | ✅ Live |
| OpenFreeMap tiles | `https://tiles.openfreemap.org/styles/liberty` | None | ✅ Live |
| Claude API | `https://api.anthropic.com/v1/messages` model `claude-haiku-4-5` | API key | ✅ Live |
| MITERD coastal DPH WMS | `https://wms.mapama.gob.es/sig/Costas/ServDPHC/wms.aspx` | None | 🔨 To build |
| EEA bathing water API | `https://bathing-water-quality.eea.europa.eu/api/sites/?country=ES&format=json` | None | 🔨 To build |
| SINAC drinking water | `datos.gob.es` download → static JSON bundled in `src/data/sinac.json` | None | 🔨 To build |
| IGME groundwater units | `https://info.igme.es/hydrogeologicalunits/` download → `src/data/groundwater-units.geojson` | None | 🔨 To build |
| IGN admin boundaries WMS | `https://www.ign.es/wms-inspire/unidades-administrativas` | None | v2 |
| AEMET OpenData | `https://opendata.aemet.es/opendata/api/...` | Free key | v2 |
| Reservoir levels (live) | SAIH / datos.gob.es per-basin API | None | v2 |

---

## 10. v2 Roadmap

### 10.1 Active Drought / Restriction Alerts
- **Data:** Scrapers for CHGuadalquivir, CHSur, CHSegura restriction pages + BOJA gazette parsing. Manually curated alert DB (municipality, restriction type, severity, date).
- **UI:** `RestrictionsCard` with freshness timestamp and source link. Card exists as placeholder in v1 linking to CH website.
- **Blocker:** Ongoing editorial/scraping work — not a one-time build

### 10.2 River Flow / Flood Forecasting (GloFAS + SAIH)
- **Data:** GloFAS (Copernicus) 3–30 day ahead river flood forecasts. SAIH real-time river gauge data per CH.
- **Use case:** High value during active flood events; Farmer persona river abstraction context
- **Blocker:** Too technical for core personas; defer until active-event use case is prioritised

### 10.3 Tidal Predictions (Puertos del Estado)
- **Data:** `https://www.puertos.es/` tidal harmonic predictions
- **Use case:** Marina operators, very coastal infrastructure
- **Blocker:** Too operational/niche; the coastal DPH overlay covers the structural risk

### 10.4 Sewage / Wastewater Alerts
- **Note:** No real-time structured data exists in Spain. MITERD publishes annual aggregate compliance data only — not actionable for residents.
- **Blocker:** Data does not exist in usable form

### 10.5 Compare Locations
- **UI:** "Compare" toggle reveals second search, map shows two pins, panel shows two columns with delta indicators. AI generates comparative narrative.
- **Blocker:** Build time only — no new data sources needed

### 10.6 Planned Developments Near Me (EIA)
- **Data:** BOE/BOJA PDF scraper + Claude Sonnet extraction of project name, location, water demand, status → geocoded DB
- **UI:** Map pins for nearby projects + AI summary of collective water impact
- **Blocker:** PDF structure varies significantly; significant prompt engineering + QA

### 10.7 Trend / Historical Context
- **Data:** SAIH Guadalquivir historical time-series (datos.gob.es) — weekly reservoir levels 10+ years
- **UI:** Sparkline per reservoir, AI trend narrative
- **Blocker:** Per-basin API integration + data cleaning

### 10.8 Reservoir Levels — Live API
- **Replace** static 17-reservoir seed with live datos.gob.es / REDIAM API
- **Endpoint:** SAIH Guadalquivir dataset on datos.gob.es; REDIAM Andalusia Reservoir Viewer
- **Blocker:** API testing for structure + update cadence

### 10.9 SIGPAC Irrigation Zones (Farmer persona)
- **Data:** FEGA SIGPAC WFS — irrigation coefficients, land use
- **Blocker:** WFS performance at address level needs testing

### 10.10 Language Expansion
- Auto-detect `navigator.language` on first load
- Add German / Dutch (significant buyer segment in Málaga / Alicante)

---

## 11. Environment Variables Needed

```
VITE_ANTHROPIC_API_KEY=        # Claude API for AI summaries
VITE_AEMET_API_KEY=            # Optional for v1; AEMET climate data
```

---

## 12. Definition of Done for v1

**Core (built)**
- [x] User can enter any Spanish address/postcode/municipality and see a map pin
- [x] Map shows riverine flood zone overlay (SNCZI T10/T100/T500) — togglable
- [x] Map shows drought status overlay (Copernicus CDI) — togglable
- [x] Map shows reservoir dots coloured by fill level — togglable
- [x] Risk panel shows flood zone status (T10/T100/T500 or clear) for the point
- [x] Risk panel shows drought CDI status with level for the point
- [x] Risk panel shows 1–3 nearest reservoirs with fill % and historical mean
- [x] User type selector (Buyer/Renter/Farmer/Business) triggers AI re-generation
- [x] AI generates plain-language risk summary in selected language
- [x] AI generates 5–8 tailored questions to ask per user type
- [x] Language toggle switches all UI text and AI output between ES and EN
- [x] Mobile-responsive layout
- [x] Proper data attribution (OpenFreeMap, OSM, MITERD, Copernicus)

**New data sources (to build)**
- [ ] Risk panel shows drinking water quality (SINAC) — compliance badge, source type, last test year
- [ ] Risk panel shows coastal flood zone card (MITERD DPH) — coastal locations only
- [ ] Map shows coastal DPH overlay (zona servidumbre + zona policía) — togglable
- [ ] Risk panel shows groundwater overexploitation status (IGME) — overexploited unit name or clear
- [ ] Map shows groundwater overexploited units polygon overlay — togglable
- [ ] Risk panel shows nearest bathing site quality (EEA) — coastal/near-water locations within 5 km only
- [ ] All 4 new cards have ES + EN translations
- [ ] All 4 new data sources included in AI summary context
- [ ] All 4 new cards show data freshness label
- [ ] `npx tsc --noEmit` passes with zero errors after new code is added
- [ ] `npm run build` succeeds
