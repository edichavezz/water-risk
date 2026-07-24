# Agent Brief: Add 4 New Data Sources to AguaRiesgo

**Project:** AguaRiesgo — a bilingual (ES/EN) water risk tool for Spain  
**Working directory:** `/Users/editachavez/Projects/water-risk/app/`  
**Stack:** React 18 + TypeScript + Vite + MapLibre GL JS + Tailwind CSS + Zustand + react-i18next

Read `PLAN.md` and `FLOWS.md` in the parent directory before starting — they have the full architecture and design decisions.

---

## What's Already Built

The app is a working React SPA. Existing source files to understand before touching anything:

```
app/src/
  types/index.ts              # RiskProfile, UserType, Language, etc.
  store/useAppStore.ts        # Zustand store — activeLayers, profile, language, userType
  services/floodZone.ts       # Pattern to follow: WMS GetFeatureInfo point query
  services/drought.ts         # Pattern to follow: WMS GetFeatureInfo point query
  services/reservoirs.ts      # Pattern to follow: static GeoJSON + haversine distance
  services/ai.ts              # Claude API — buildContext() assembles the data for AI prompts
  components/Map/MapView.tsx  # All map layers live here; follow existing layer/source pattern
  components/RiskPanel/RiskPanel.tsx  # Assembles all cards; add new ones here
  components/RiskPanel/FloodCard.tsx  # Card component pattern to follow
  components/LayerToggle.tsx  # Layer toggles — add new toggles here
  i18n/en.json                # All UI strings — add keys for new cards
  i18n/es.json                # Spanish translations — add same keys
```

Read each of these files before writing new code. Match the existing patterns exactly.

---

## Your Task: Implement 4 New Data Sources

Implement all four. For each: (1) service file, (2) card component, (3) map layer if applicable, (4) i18n strings, (5) wire into RiskPanel and MapView, (6) update the AI context in `ai.ts`.

---

### 1. Drinking Water Quality — SINAC (Ministry of Health)

**What to build:** A `WaterQualityCard` component showing tap water compliance, source type, and key parameters for the queried municipality.

**Data approach — static JSON (preferred for v1):**
1. Download the SINAC annual dataset from datos.gob.es. Search: `calidad agua consumo humano SINAC municipios`. It comes as CSV or XML.
2. Parse it and produce a JSON file keyed by INE municipality code: `{ "41091": { "municipio": "Sevilla", "compliance": "compliant", "sourceType": "surface", "year": 2024, "nitrates_mg_l": 4.2, "turbidity_ntu": 0.3, "ecoli": "not detected" }, ... }`
3. Save as `app/src/data/sinac.json`.
4. Write `app/src/services/waterQuality.ts` — import the JSON and look up by INE code.

**Getting the INE code:** Nominatim's reverse geocode response includes `address.municipality` name. Match this against the SINAC dataset by name (case-insensitive, normalise accents). If no match, return null.

**Alternatively (if the dataset is too large to bundle):** The SINAC web portal has a municipality lookup at `https://www.sanidad.gob.es/areas/sanidadAmbiental/calidadAguas/aguasConsumoHumano/home.htm`. If no structured download is found, write a note in the service file and return mock data for now, flagged clearly as mock.

**Card UI:**
```tsx
// Compliance badge colours:
// compliant → green ✅
// minor_issues → amber ⚠️
// non_compliant → red ❌
// unknown → grey
```
Show: compliance badge, source type (surface/groundwater/mixed/desalination), last test year, up to 3 parameters if available.

**i18n keys to add:**
```json
"risk.waterQuality.title": "Drinking Water",
"risk.waterQuality.compliant": "Compliant",
"risk.waterQuality.minor_issues": "Minor issues",
"risk.waterQuality.non_compliant": "Non-compliant",
"risk.waterQuality.unknown": "No data",
"risk.waterQuality.source": "Source: SINAC (Ministry of Health) — {year} annual data",
"risk.waterQuality.sourceType.surface": "Surface water",
"risk.waterQuality.sourceType.groundwater": "Groundwater",
"risk.waterQuality.sourceType.mixed": "Mixed",
"risk.waterQuality.sourceType.desalination": "Desalination",
"risk.waterQuality.noData": "Supply data not available for this municipality"
```

**AI context:** Add to `buildContext()` in `ai.ts`:
```
Drinking water: {compliance status}, source: {sourceType}, last tested: {year}
```

**No map layer needed** for this one.

---

### 2. Coastal Flood Zone — MITERD DPH WMS

**What to build:** A `CoastalFloodCard` and a map overlay layer for the coastal Dominio Público Hidráulico Marítimo-Terrestre zones.

**WMS endpoint:** `https://wms.mapama.gob.es/sig/Costas/ServDPHC/wms.aspx`

**First step — discover layer names:**
Fetch the GetCapabilities document and find the correct layer names:
```
https://wms.mapama.gob.es/sig/Costas/ServDPHC/wms.aspx?SERVICE=WMS&REQUEST=GetCapabilities
```
You're looking for layers covering:
- Zona de servidumbre de tránsito (20 m from shoreline)
- Zona de policía (100 m from shoreline)

**Service file:** `app/src/services/coastalFlood.ts`

Follow the exact same pattern as `floodZone.ts`:
- `getCoastalFloodStatus(coords)` → fires WMS GetFeatureInfo, returns `{ inServidumbre: boolean, inPolicia: boolean, source: 'MITERD DPH' }` 
- `getCoastalWmsUrl(layer)` → returns tile URL string for use in MapView

**Coastal detection:** Only fire the coastal WMS query and show the card if the location is plausibly coastal. Simple heuristic: check if `provincia` from Nominatim is one of: Huelva, Cádiz, Málaga, Almería, Granada (Atlantic/Mediterranean coast), Murcia, Valencia, Alicante, etc. Full list: any province with coastline. If inland province (Córdoba, Jaén, Sevilla interior, etc.) → skip the query entirely, don't render the card.

**Card UI:** 
- Not coastal location → don't render card at all
- In zona de servidumbre: 🔴 "Within 20 m coastal zone — building restrictions apply"
- In zona de policía only: 🟠 "Within 100 m coastal zone — planning restrictions may apply"  
- Neither: ✅ "Not in a mapped coastal zone"

**Map layer:** Add two WMS raster layers to MapView — one for each zone. Blue-tinted, toggleable. Add to `activeLayers` in the store with key `coastal`. Add toggle button to `LayerToggle.tsx` with a 🏖 emoji label.

**i18n keys:**
```json
"risk.coastalFlood.title": "Coastal Zone",
"risk.coastalFlood.inServidumbre": "Within 20 m coastal protection zone — building restrictions apply",
"risk.coastalFlood.inPolicia": "Within 100 m coastal zone — planning restrictions may apply",
"risk.coastalFlood.clear": "Not in a mapped coastal zone",
"risk.coastalFlood.source": "Source: MITERD Coastal DPH",
"layers.coastal": "Coastal zones"
```

**AI context:** Add to `buildContext()`:
```
Coastal zone: {inServidumbre ? 'in 20m servidumbre zone' : inPolicia ? 'in 100m policia zone' : 'not in coastal zone'}
```

---

### 3. Groundwater Overexploitation — IGME

**What to build:** A `GroundwaterCard` and optional map overlay showing whether the location sits in an officially overexploited hydrogeological unit.

**Data — static GeoJSON:**
1. Download the Spanish hydrogeological units shapefile from IGME:
   - URL: `https://info.igme.es/hydrogeologicalunits/` — look for a download link
   - Alternative: `https://datos.gob.es` — search `masas de agua subterránea IGME` or `unidades hidrogeológicas`
   - Alternative: `https://www.igme.es/actividadesIGME/lineas/hidrogeologia.htm`
2. Convert to GeoJSON using QGIS or `ogr2ogr -f GeoJSON output.geojson input.shp`
3. Filter to just the overexploited units (those with status = "sobreexplotada" or similar attribute) to keep file size small
4. Save as `app/src/data/groundwater-units.geojson`

**Service file:** `app/src/services/groundwater.ts`
```typescript
import turfBooleanPointInPolygon from '@turf/boolean-point-in-polygon'
import turfPoint from '@turf/helpers'
import units from '../data/groundwater-units.geojson'

export function getGroundwaterStatus(coords: Coordinates): GroundwaterResult {
  const pt = turfPoint([coords.lng, coords.lat])
  for (const feature of units.features) {
    if (turfBooleanPointInPolygon(pt, feature)) {
      return {
        inOverexploitedUnit: true,
        unitName: feature.properties.name,
        basin: feature.properties.basin,
        source: 'IGME'
      }
    }
  }
  return { inOverexploitedUnit: false, source: 'IGME' }
}
```

Install Turf: `npm install @turf/boolean-point-in-polygon @turf/helpers`

Add `GroundwaterResult` to `types/index.ts`.

**Card UI:**
- Overexploited: ⚠️ amber card — "Within [unit name] aquifer, declared overexploited. Groundwater abstraction may be restricted."
- Not overexploited: ✅ "No groundwater overexploitation declared for this area."
- No data: neutral grey

**Map layer:** Add a GeoJSON polygon layer to MapView showing all overexploited units in a subtle amber/brown fill with a stroke. Toggle key: `groundwater`. Add to `LayerToggle.tsx`.

**Type additions** (`types/index.ts`):
```typescript
export interface GroundwaterResult {
  inOverexploitedUnit: boolean
  unitName?: string
  basin?: string
  source: 'IGME'
}
```

**Store:** Add `groundwater: boolean` to `activeLayers` in `useAppStore.ts`. Add `GroundwaterResult | null` to `RiskProfile`.

**i18n keys:**
```json
"risk.groundwater.title": "Groundwater",
"risk.groundwater.overexploited": "Declared overexploited aquifer — abstraction rights restricted",
"risk.groundwater.clear": "No aquifer overexploitation declared",
"risk.groundwater.source": "Source: IGME hydrogeological units (annual)",
"layers.groundwater": "Groundwater"
```

**AI context:**
```
Groundwater: {inOverexploitedUnit ? 'in overexploited unit: ' + unitName : 'not in overexploited unit'}
```

---

### 4. Bathing Water Quality — EEA API

**What to build:** A `BathingWaterCard` showing the quality rating of the nearest designated bathing site (beach or inland) within 5 km.

**API:** 
```
GET https://bathing-water-quality.eea.europa.eu/api/sites/?country=ES&format=json
```
Returns an array of bathing sites with `latitude`, `longitude`, `name`, `rating` (E/G/S/P = Excellent/Good/Sufficient/Poor), `year`.

**Strategy — fetch on demand, cache in module scope:**
```typescript
// app/src/services/bathingWater.ts
let cachedSites: BathingSite[] | null = null

async function fetchAllSites(): Promise<BathingSite[]> {
  if (cachedSites) return cachedSites
  const res = await fetch('https://bathing-water-quality.eea.europa.eu/api/sites/?country=ES&format=json')
  const data = await res.json()
  cachedSites = data.results ?? data  // check actual response shape
  return cachedSites
}

export async function getNearestBathingSite(coords: Coordinates): Promise<BathingWaterResult | null> {
  const sites = await fetchAllSites()
  // compute haversine for each, find nearest within 5 km
  // return null if none within 5 km
}
```

**Important:** Before writing the service, make a test fetch to check the actual response shape — the API may use `results`, `data`, or a different wrapper. The field names for rating and coordinates may also differ. Adjust accordingly.

**Card UI:**
- No site within 5 km → don't render card
- Excellent: ✅ "Excellent bathing water — [site name], [distance] km"
- Good: 🟢 "Good bathing water"
- Sufficient: 🟡 "Sufficient — meets minimum EU standards"
- Poor: ❌ "Poor — may not meet EU standards"
- Unknown/not assessed: ⚪ "Not assessed this season"

Show site name, distance, year of assessment.

**Type additions:**
```typescript
export interface BathingWaterResult {
  siteName: string
  distanceKm: number
  rating: 'E' | 'G' | 'S' | 'P' | 'unknown'
  year: number
  source: 'EEA'
}
```

**No map layer needed** for v1 — the card is sufficient.

**i18n keys:**
```json
"risk.bathingWater.title": "Bathing Water",
"risk.bathingWater.E": "Excellent",
"risk.bathingWater.G": "Good",
"risk.bathingWater.S": "Sufficient",
"risk.bathingWater.P": "Poor — may not meet EU standards",
"risk.bathingWater.unknown": "Not assessed this season",
"risk.bathingWater.distance": "{distance} km away",
"risk.bathingWater.source": "Source: EEA Bathing Water Directive — {year} season"
```

**AI context:** Only include if a site exists within 5 km:
```
Nearest bathing site: {siteName} ({distanceKm} km) — rated {rating} ({year})
```

---

## Wiring Everything Together

### SearchBar.tsx
In `handleSelect`, the current parallel fetch block is:
```typescript
const [floodZone, drought] = await Promise.all([...])
const reservoirs = getNearbyReservoirs(...)
```

Extend it to include the new sources:
```typescript
const [floodZone, drought, coastalFlood, groundwater, waterQuality] = await Promise.all([
  getFloodZoneStatus(result.coordinates).catch(() => null),
  getDroughtStatus(result.coordinates).catch(() => null),
  getCoastalFloodStatus(result.coordinates).catch(() => null),
  // groundwater is sync (point-in-polygon on static data):
  Promise.resolve(getGroundwaterStatus(result.coordinates)),
  getWaterQualityByMunicipality(result.municipio ?? '').catch(() => null),
])
const reservoirs = getNearbyReservoirs(result.coordinates)
const bathingWater = await getNearestBathingSite(result.coordinates).catch(() => null)
```

### RiskPanel.tsx
Add the new cards in this order below `ReservoirCard`:
1. `<WaterQualityCard />`
2. `<CoastalFloodCard />` (only renders if coastal)
3. `<GroundwaterCard />`
4. `<BathingWaterCard />` (only renders if site within 5 km)

### useAppStore.ts
Add to `RiskProfile` type (in `types/index.ts`):
```typescript
coastalFlood: CoastalFloodResult | null
groundwater: GroundwaterResult | null
waterQuality: WaterQualityResult | null
bathingWater: BathingWaterResult | null
```

Add to `activeLayers`:
```typescript
coastal: boolean
groundwater: boolean
```
(Both default to `true`.)

### MapView.tsx
Add coastal WMS layers and groundwater GeoJSON polygon layer following the exact patterns already used for flood and drought layers. Use `activeLayers.coastal` and `activeLayers.groundwater` for visibility toggling.

---

## Checklist Before Finishing

- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npm run build` succeeds
- [ ] All 4 new cards appear in the risk panel after searching a location
- [ ] Coastal card correctly hides for inland locations (e.g. search "Córdoba")
- [ ] Coastal card correctly shows for coastal locations (e.g. search "Marbella" or "Almería")
- [ ] Bathing water card hides for inland locations, shows for coastal
- [ ] Groundwater card shows correct status for SE Spain (e.g. search "Níjar, Almería" — should be overexploited)
- [ ] Groundwater card shows clear status for non-affected areas
- [ ] Coastal and groundwater map layer toggles work
- [ ] All new cards have ES translations in `es.json`
- [ ] AI summary context includes all 4 new data fields
- [ ] All cards show data freshness label
- [ ] No console errors in browser dev tools

## Notes

- Match the visual style of existing cards exactly — same `rounded-xl border border-gray-200 p-3` wrapper, same `text-xs font-semibold uppercase tracking-wide text-gray-500` header style
- Each card handles its own loading and null states — don't render the card if data is null and it's a conditional card (coastal, bathing water)
- The SINAC dataset may need preprocessing — if so, write a one-time Node script to parse and output the JSON, don't do it at runtime
- If the EEA API response shape differs from expected, log the raw response and adjust accordingly — don't guess the shape
