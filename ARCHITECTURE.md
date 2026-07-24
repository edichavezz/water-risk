# AguaRiesgo — Architecture

**Last updated:** July 2026  
**Stack:** React 18 + TypeScript + Vite + MapLibre GL JS + Tailwind CSS v4 + Zustand + react-i18next + Claude API

**⚠️ Known docs/code mismatch (July 2026):** `PERSONAS.md` was pivoted to a new persona model (Resident/Owner + Buyer/Investor as MVP; Policymaker + Farmer as beyond/unvalidated) following a research session — see the Miro board at https://miro.com/app/board/uXjVH4jzeig=/. **The code below has not been updated to match.** Specifically: the `UserType` union (`'buyer' | 'renter' | 'farmer' | 'business'`) in the Zustand store, `UserTypeSelector.tsx`, and `ai.ts → buildContext()`'s persona-specific prompt branches all still implement the old four-flat-persona model. This is real follow-up implementation work, not a documentation-only change — treat it as an open task, not something silently fixed by editing markdown.

---

## System Overview

AguaRiesgo is a **client-side single-page application** with no backend. All data either comes from third-party APIs/WMS services (called directly from the browser) or is bundled as static assets at build time. The Claude API is the only service requiring an API key.

```
User browser
│
├── MapLibre GL JS ──────────────────────────────► OpenFreeMap tiles (Liberty style)
│   │                                             ► SNCZI WMS (flood zones)
│   │                                             ► Copernicus EDO WMS (drought)
│   │                                             ► Bundled GeoJSON (reservoirs)
│   │                                             ► MITERD DPH WMS (coastal) [to-build]
│   │                                             ► Bundled GeoJSON (groundwater) [to-build]
│
├── Search → Nominatim ──────────────────────────► OSM geocoding API
│
├── Data services ──────────────────────────────► SNCZI WMS (GetFeatureInfo)
│   (parallel fetch on location select)          ► Copernicus EDO WMS (GetFeatureInfo)
│                                                ► Static GeoJSON (reservoirs, haversine)
│                                                ► Static JSON (SINAC) [to-build]
│                                                ► MITERD DPH WMS (coastal) [to-build]
│                                                ► Static GeoJSON (IGME, Turf.js) [to-build]
│                                                ► EEA API (bathing water) [to-build]
│
└── AI service ─────────────────────────────────► Claude API (claude-haiku-4-5)
    (non-blocking, fires after data resolves)
```

---

## Data Flow

### Step 1 — Address Search

```
User types → SearchBar debounce (300 ms)
           → Nominatim /search?q=...&countrycodes=es
           → Returns up to 5 results with lat/lng, municipality, province
           → geocoding.ts inferBasin(provincia) assigns SpainBasin
           → Store: setProfile({ location: SearchResult })
           → MapView: flyTo(coords), place pin
```

### Step 2 — Parallel Data Fetch

```
SearchBar handleSelect() fires Promise.all([...]) immediately on result selection.

Parallel:
  floodZone.ts  getFloodZoneStatus(coords)
    → WMS GetFeatureInfo at T10 → T100 → T500 (stops at first hit)
    → Returns FloodZoneResult { inZone, returnPeriod, source }

  drought.ts  getDroughtStatus(coords)
    → WMS GetFeatureInfo against Copernicus EDO cdi_current
    → Parses CDI value (1–5), maps to DroughtStatus level
    → Returns DroughtStatus { level, label, updatedAt, source }

  reservoirs.ts  getNearbyReservoirs(coords)
    → Sync: haversine distance to 17 static seed reservoirs
    → Returns nearest 3 within 80 km radius
    → Returns Reservoir[]

  waterQuality.ts  getWaterQualityByMunicipality(municipio)  [to-build]
    → Sync: look up in bundled sinac.json by INE code
    → Returns WaterQualityResult | null

  coastalFlood.ts  getCoastalFloodStatus(coords)  [to-build]
    → Guard: skip if provincia not in coastal list
    → WMS GetFeatureInfo against MITERD DPH
    → Returns CoastalFloodResult | null

  groundwater.ts  getGroundwaterStatus(coords)  [to-build]
    → Sync: Turf.js booleanPointInPolygon against bundled GeoJSON
    → Returns GroundwaterResult

  bathingWater.ts  getNearestBathingSite(coords)  [to-build]
    → Fetch all ES sites from EEA API (cached module-scope after first call)
    → Haversine to all sites, return nearest within 5 km
    → Returns BathingWaterResult | null

Store: updateProfile({ floodZone, drought, reservoirs, waterQuality,
                       coastalFlood, groundwater, bathingWater, loading: false })
```

### Step 3 — AI Generation (non-blocking)

```
Fires after Step 2 completes. Does NOT block the panel from rendering.

ai.ts  buildContext(profile, lang)
  → Assembles all resolved data into a plain-text context string
  → Includes: location, basin, flood zone status, drought level,
              reservoir fills, water quality, coastal zone, groundwater,
              bathing water (if present), user type

ai.ts  generateRiskSummary(profile, userType, language)
  → POST /v1/messages to Claude API (claude-haiku-4-5)
  → System prompt instructs: plain language, persona-specific framing,
    use hedged language where data is uncertain, output in {language}
  → Returns string (200–400 words)

ai.ts  generateQuestions(profile, userType, language)
  → Separate Claude API call
  → Returns 5–8 questions as a string[] (parsed from Claude output)

Store: updateProfile({ aiSummary, aiQuestions })
```

### Step 4 — User Type Change

```
UserTypeSelector onChange
  → Store: setUserType(type)
  → If profile.location exists:
      generateRiskSummary(profile, newType, language) → updateProfile({ aiSummary })
      generateQuestions(profile, newType, language)   → updateProfile({ aiQuestions })
  → AI cards re-render with new output; data cards unchanged
```

### Step 5 — Language Switch

```
LanguageToggle onChange
  → Store: setLanguage(lang)
  → react-i18next: i18n.changeLanguage(lang) — all UI strings update instantly
  → If profile.location exists, AI re-generation fires on next user type change
    (or user can trigger by selecting user type again)
  → Note: data card labels (flood zone, CDI level) are i18n keyed — switch instantly
```

### Step 6 — Map Layer Toggles

```
LayerToggle checkboxes
  → Store: toggleLayer('flood' | 'drought' | 'reservoirs' | 'coastal' | 'groundwater')
  → MapView useEffect watches activeLayers
  → map.setLayoutProperty(layerId, 'visibility', active ? 'visible' : 'none')
  → No data re-fetch — layers are always loaded, just shown/hidden
```

---

## State Architecture (Zustand)

```typescript
// store/useAppStore.ts
interface AppState {
  // Data
  profile: RiskProfile | null        // All resolved risk data for current location
  
  // User preferences
  userType: UserType                  // 'buyer' | 'renter' | 'farmer' | 'business'
  language: Language                  // 'en' | 'es'
  
  // Map
  activeLayers: {
    flood: boolean       // SNCZI WMS overlays (T10/T100/T500)
    drought: boolean     // Copernicus CDI overlay
    reservoirs: boolean  // Reservoir GeoJSON dots
    coastal: boolean     // Coastal DPH WMS overlay [to-build]
    groundwater: boolean // IGME GeoJSON polygon overlay [to-build]
  }
  
  // Actions
  updateProfile: (partial: Partial<RiskProfile>) => void
  setUserType: (type: UserType) => void
  setLanguage: (lang: Language) => void
  toggleLayer: (key: LayerKey) => void
}
```

---

## Map Architecture (MapLibre GL JS)

All map layers are declared in `MapView.tsx` inside the `map.on('load', ...)` callback. Sources and layers are added once at map init; visibility is controlled via `setLayoutProperty`.

**Sources:**
- `reservoirs-source` — GeoJSON FeatureCollection from `getAllReservoirsGeoJSON()`
- `groundwater-source` — GeoJSON polygon FeatureCollection from bundled asset [to-build]
- WMS layers are added directly as raster sources (no separate source object needed)

**Layer stack (bottom to top):**
1. OpenFreeMap Liberty base tiles
2. SNCZI flood WMS raster (T10, T100, T500 — 3 separate layers)
3. Copernicus EDO CDI WMS raster
4. Coastal DPH WMS raster [to-build]
5. Groundwater polygon fill [to-build]
6. Reservoir circle halos (white stroke, larger radius)
7. Reservoir fill circles (coloured by fill %)
8. Reservoir labels (fill % text)
9. Reservoir names (text labels for zoom > 9)
10. Search result pin (HTMLMarker, not a GL layer)

---

## Key Technical Decisions

### Why MapLibre GL JS + OpenFreeMap?
MIT licence, no API key, no usage caps, supports WMS/WFS natively, vector tiles for crisp rendering. Mapbox requires paid key above 50k loads; Leaflet renders raster-only and lacks native WMS GetFeatureInfo support. Full rationale: PLAN.md §3.

### Why static bundled data for SINAC and IGME?
Both datasets update annually, are small enough to bundle (<2 MB combined), and don't benefit from real-time fetch. Bundling eliminates a network dependency and enables point queries with zero latency.

### Why WMS GetFeatureInfo instead of WFS for flood/drought/coastal?
WFS polygon downloads for Spain-wide flood zones would be many MB. GetFeatureInfo fires a single point query against the existing WMS service — fast, low-bandwidth, correct. Tradeoff: depends on MITERD and Copernicus WMS availability.

### Why Claude Haiku and not Sonnet?
Speed and cost. Haiku generates a 300-word risk summary + 6 questions in ~1 second at a fraction of Sonnet's cost. The data context is structured and short, so a larger model adds no quality. Sonnet is earmarked for v2 EIA PDF extraction where reasoning over complex unstructured text matters.

### Why no backend?
v1 does not need one. No auth, no persistent data, no write operations, no rate-limited APIs that need a proxy. The only exception is the Claude API key — it is exposed in the browser via `VITE_ANTHROPIC_API_KEY`. For production, this should be proxied through a lightweight serverless function (e.g. Vercel Edge, Cloudflare Worker) to keep the key server-side.

### Why post-overview user type selection?
Reduces entry friction. Users get useful data before they've committed to identifying themselves. The AI adapts instantly when they select a persona — no second search required. See PLAN.md §8.2.

**⚠️ This is now an open conflict, not a settled decision** — a persona-first journey (persona chosen before any data, right after location entry) was designed in the same July 2026 session referenced above. See PLAN.md §8.2 for the explicit unresolved trade-off.

---

## Deployment

v1 is a static SPA — build output is `dist/` (HTML + JS + CSS + bundled data assets). Can be hosted on:
- **Vercel / Netlify** — recommended; handles env vars cleanly
- **GitHub Pages** — fine but env vars need a build step
- **Cloudflare Pages** — good for edge caching of static assets

**Environment variables required at build time:**
```
VITE_ANTHROPIC_API_KEY   # Claude API key — should be proxied in production
VITE_AEMET_API_KEY       # Optional; AEMET climate data (v2 only)
```

**Production note:** The `VITE_ANTHROPIC_API_KEY` is embedded in the JS bundle by Vite. For production, add a `/api/ai` proxy endpoint that holds the real key server-side and forwards requests to the Claude API. The browser sends prompts to `/api/ai`, not directly to `api.anthropic.com`.

---

## Known Limitations

| Limitation | Impact | v2 Fix |
|------------|--------|--------|
| Reservoir data is static (Andalucía only, 17 reservoirs) | Inaccurate fill % for non-Andalucía locations | Live SAIH/REDIAM API |
| No drought restriction data (only CDI indicator) | Cannot show declared restriction phases | Scraper + manual curation |
| Claude API key exposed in browser bundle | Security risk in production | Serverless proxy |
| Coastal/groundwater WMS depends on MITERD uptime | Service outages return null (handled gracefully) | Fallback + retry |
| SINAC data requires annual manual update | Data may be 1–2 years stale | Automate data pipeline |
| No auth or saved profiles | Users can't save or compare searches | v2 auth + save |
