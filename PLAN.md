# Water Spain — v1 Implementation Plan

**Last updated:** June 2026  
**Status:** Active development

---

## 1. Product North Star

A bilingual (ES/EN) geospatial tool that lets anyone in Spain — resident, buyer, renter, farmer, business — enter an address and get a plain-language water risk profile: flood zones, drought status, reservoir levels, and AI-generated implications and questions to ask.

**The gap this fills:** No tool combines flood + drought + supply + groundwater into a single address-level lookup in Spain, in plain language, for residents.

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

Priority ordered per research doc Section G:

### 4.1 Geocoding / Address Lookup
- **Primary:** Nominatim (`https://nominatim.openstreetmap.org/search`)
  - Free, no key, JSON output
  - Handles Spanish municipalities, postcodes, and addresses
  - Edge case: rural Andalucía postcodes are patchy — fall back to municipality name search
- **Spatial join:** IGN municipal boundary WMS to identify which basin authority covers a point

### 4.2 Flood Zones (v1 — live WMS overlay)
- **Source:** SNCZI via MITERD WMS
  - Endpoint: `https://wms.mapama.gob.es/sig/Agua/ZonasInundables/wms.aspx`
  - Layers: `SNCZI_T10`, `SNCZI_T100`, `SNCZI_T500` (10/100/500-year return periods)
  - Free, INSPIRE compliant, vector-accurate, address-level
  - Rendered as a toggle-able semi-transparent overlay on the map

### 4.3 Drought Status (v1 — live WMS overlay)
- **Source:** Copernicus European Drought Observatory (EDO)
  - WMS endpoint: `https://edo.jrc.ec.europa.eu/geoserver/edo/wms`
  - Layer: `cdi_current` (Combined Drought Indicator, weekly updated)
  - ~5 km raster; covers all of Spain
  - Rendered as colour-coded overlay with legend

### 4.4 Reservoir Levels (v1 — API)
- **Source:** datos.gob.es / REDIAM Andalucía reservoir viewer
  - MITERD weekly bulletin data: `https://www.embalses.net` data (or scrape MITERD)
  - datos.gob.es SAIH Guadalquivir dataset
  - Display: nearest reservoirs to the queried location, current fill %, historical mean

### 4.5 River Basin Boundaries (v1 — static GeoJSON)
- **Source:** IGN / MITERD shapefiles (downloaded and bundled)
  - Determines which Confederación Hidrográfica covers the queried point
  - Critical for routing correct drought plan and restriction data

### 4.6 Municipal Boundaries (v1 — WMS)
- **Source:** IGN municipal boundaries WMS
  - `https://www.ign.es/wms-inspire/unidades-administrativas`
  - Used to label the queried location and enable municipality-name search fallback

---

## 5. v1 App Structure

```
src/
  components/
    Map/
      MapView.tsx           # MapLibre container, overlay management
      FloodZoneLayer.tsx    # SNCZI WMS layer
      DroughtLayer.tsx      # Copernicus EDO WMS layer
      MarkerLayer.tsx       # Search result pin + nearby reservoirs
    Search/
      SearchBar.tsx         # Address/postcode/municipality input
      SearchResults.tsx     # Nominatim result list
    RiskPanel/
      RiskPanel.tsx         # Right/bottom panel: risk summary
      UserTypeSelector.tsx  # Buyer / Renter / Farmer / Business
      FloodCard.tsx         # Flood zone result
      DroughtCard.tsx       # Drought status result
      ReservoirCard.tsx     # Nearest reservoir levels
      QuestionsCard.tsx     # AI-generated questions to ask
      AIProfile.tsx         # AI-generated plain-language summary
    LanguageToggle.tsx      # ES / EN switcher
    LayerToggle.tsx         # Map overlay controls
  services/
    geocoding.ts            # Nominatim + IGN geocoder
    snczi.ts                # SNCZI WMS queries
    reservoirs.ts           # datos.gob.es reservoir API
    drought.ts              # Copernicus EDO WMS + point query
    ai.ts                   # Claude API: risk summary, questions
  store/
    useAppStore.ts          # Zustand: location, user type, language, results
  i18n/
    en.json
    es.json
  types/
    index.ts                # RiskProfile, UserType, Location types
```

---

## 6. UI Layout

```
┌─────────────────────────────────────────────────────┐
│  🌊 Water Risk Explorer ES | EN  [Layer toggles]     │
├──────────────────┬──────────────────────────────────┤
│ Search bar       │                                   │
│ ┌──────────────┐ │          MapLibre GL              │
│ │ Address...   │ │         (OpenFreeMap)              │
│ └──────────────┘ │                                   │
│                  │   [Flood zone overlay]            │
│ User type:       │   [Drought overlay]               │
│ ○ Buyer          │   [Reservoir pins]                │
│ ○ Renter         │                                   │
│ ○ Farmer         │                                   │
│ ○ Business       │                                   │
│                  │                                   │
│ ── Risk Profile ─│─                                  │
│ [Flood card]     │                                   │
│ [Drought card]   │                                   │
│ [Reservoir card] │                                   │
│ [AI summary]     │                                   │
│ [Questions]      │                                   │
└──────────────────┴──────────────────────────────────┘
```

Mobile: stack vertically (search → map → panel).

---

## 7. v1 Build Scope (What's In)

| Flow | v1 Status | Notes |
|------|-----------|-------|
| Location Lookup | ✅ In v1 | Nominatim geocoding, map fly-to, basin identification |
| Risk Profile by User Type | ✅ In v1 | Buyer/Renter/Farmer/Business selector; AI tailors output |
| Active Drought Alert | 🔶 Partial | CDI overlay from Copernicus; manual restriction data deferred |
| Compare Locations | ❌ v2 | Side-by-side comparison requires significant UI work |
| Planned Developments | ❌ v2 | EIA PDF parsing is AI-assisted; deferred post-MVP |
| Generate Questions to Ask | ✅ In v1 | Claude API generates tailored questions per user type + location |
| Trend / Historical Context | 🔶 Partial | Reservoir time-series chart if REDIAM API supports it; full history deferred |
| Language Switching | ✅ In v1 | ES/EN toggle via react-i18next; AI output in selected language |

---

## 8. Key Design Decisions

### 8.1 Rural Andalucía postcode gaps
Nominatim handles municipality names well even where postcodes are patchy. Search input auto-suggests municipality names as the user types. If a postcode returns no result, we fall back to municipality name via IGN's geocoder. Edge case: properties spanning multiple supply zones show a "zone boundary" warning.

### 8.2 User type: upfront or post-overview?
Decision: **Post-overview**. Show the overview risk profile first (flood zone, drought status, reservoir levels) — this is useful to everyone. User type selector is prominent in the panel and changing it re-renders the AI summary + questions in real-time. This reduces friction at entry and avoids the persona question feeling like a gate.

### 8.3 Drought restrictions (the hardest data problem)
No structured API exists. v1 shows the Copernicus CDI (objective indicator) with a clear freshness label ("Updated weekly by EU Copernicus"). A "Restrictions" card is present but shows: "No structured alert data available for this municipality. Check [CHGuadalquivir link] for current restrictions." Post-MVP: build a scraper + manual curation layer.

### 8.4 Map tile style
**Liberty** (OpenFreeMap) — it's the most balanced: clear labels, good contrast for overlays, warm tones that work well with the water/risk colour palette. Positron is too light for dense data; Dark is too heavy for a public tool.

### 8.5 AI model
Claude Haiku 4.5 for speed and cost on risk summaries + question generation. Claude Sonnet for more complex EIA summarisation (v2). Output language matches the UI language toggle.

---

## 9. APIs and Endpoints Reference

| Service | Endpoint | Auth |
|---------|----------|------|
| Nominatim geocoding | `https://nominatim.openstreetmap.org/search?q={query}&format=json&countrycodes=es` | None |
| SNCZI flood WMS | `https://wms.mapama.gob.es/sig/Agua/ZonasInundables/wms.aspx` | None |
| Copernicus EDO drought WMS | `https://edo.jrc.ec.europa.eu/geoserver/edo/wms` | None |
| IGN admin boundaries WMS | `https://www.ign.es/wms-inspire/unidades-administrativas` | None |
| MITERD reservoir data | `https://www.miteco.gob.es/...` (bulletin) | None |
| AEMET OpenData | `https://opendata.aemet.es/opendata/api/...` | Free API key |
| OpenFreeMap tiles | `https://tiles.openfreemap.org/styles/liberty` | None |
| Claude API | `https://api.anthropic.com/v1/messages` | API key (env var) |

---

## 10. Outstanding Interfaces to Build (v2+)

### 10.1 Compare Locations
- UI: split map view or tabbed comparison panel
- Input: two search bars, side-by-side risk cards
- Data: same stack, run for both coordinates
- Blocker: none technical, just UX design + build time

### 10.2 Active Drought / Restriction Alerts
- Data: scrapers for CHGuadalquivir, CHSur, CHSegura restriction pages + BOJA gazette parsing
- Storage: a small database of scraped alerts with municipality + date + severity
- UI: "Restrictions" card with freshness indicator and source link
- Blocker: scraper maintenance is ongoing editorial work

### 10.3 Planned Developments Near Me
- Data: BOE/BOJA EIA scraper + Claude Sonnet to extract project name, location, water demand
- Storage: geocoded project DB with status + date
- UI: map pins for nearby projects + AI-generated summary of collective water impact
- Blocker: EIA PDFs are inconsistently structured; needs significant prompt engineering

### 10.4 Trend / Historical Context
- Data: SAIH historical time-series from CHGuadalquivir (REDIAM/datos.gob.es)
- UI: sparkline or chart showing reservoir level over 5–10 years + AI trend narrative
- Blocker: multi-year SAIH time-series API access needs verification

### 10.5 SINAC Drinking Water Quality
- Data: Ministry of Health SINAC portal (municipality-level quality parameters)
- UI: "Water quality" card showing supply zone, last test date, key parameters
- Blocker: SINAC web portal scraping or finding structured download

### 10.6 Aquifer Overexploitation Overlay
- Data: IGME eWater shapefile (downloadable, bundle as GeoJSON)
- UI: map overlay + card showing if point is in overexploited hydrogeological unit
- Blocker: none, just build time

### 10.7 SIGPAC Irrigation Zones (for Farmer persona)
- Data: FEGA SIGPAC WFS — irrigation coefficients, land use classification
- UI: "Irrigation zone" card for farmer persona
- Blocker: WFS query needs testing for performance at address level

---

## 11. Environment Variables Needed

```
VITE_ANTHROPIC_API_KEY=        # Claude API for AI summaries
VITE_AEMET_API_KEY=            # Optional for v1; AEMET climate data
```

---

## 12. Definition of Done for v1

- [ ] User can enter any Spanish address/postcode/municipality and see a map pin
- [ ] Map shows flood zone overlay (SNCZI) togglable
- [ ] Map shows drought status overlay (Copernicus CDI) togglable
- [ ] Risk panel shows flood zone status for the point
- [ ] Risk panel shows drought CDI status for the point
- [ ] Risk panel shows 1–3 nearest reservoirs with fill %
- [ ] User type selector (Buyer/Renter/Farmer/Business) changes AI output
- [ ] AI generates plain-language risk summary in selected language
- [ ] AI generates 5–8 tailored questions to ask per user type
- [ ] Language toggle switches all UI text and AI output between ES and EN
- [ ] Mobile-responsive layout
- [ ] Proper data attribution (OpenFreeMap, OSM, MITERD, Copernicus)
