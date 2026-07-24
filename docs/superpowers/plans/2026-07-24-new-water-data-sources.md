# New Water Data Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks are sequential — later tasks depend on shared files (`types/index.ts`, `useAppStore.ts`, i18n files) that earlier tasks establish. Do not parallelise tasks.

**Goal:** Add 4 new water-risk data sources (drinking water quality, coastal flood zones, groundwater overexploitation, bathing water quality) to the AguaRiesgo risk panel and map, per `AGENT-BRIEF-NEW-DATA-SOURCES.md`.

**Architecture:** Each data source gets a service file (fetch/lookup logic), a card component (self-contained, matching the existing `FloodCard.tsx` shell pattern), and i18n keys. A final wiring task threads all four into `SearchBar.tsx` (parallel fetch), `RiskPanel.tsx` (card order), `MapView.tsx` (map layers), `LayerToggle.tsx` (toggles), and `ai.ts` (`buildContext`).

**Tech Stack:** React 18 + TypeScript + Vite + MapLibre GL JS + Tailwind CSS + Zustand + react-i18next. New dependency: `@turf/boolean-point-in-polygon` + `@turf/helpers` (v7.3.5, confirmed on npm) for the groundwater point-in-polygon check.

## Global Constraints

- Match existing patterns exactly: WMS GetFeatureInfo point-query pattern from `floodZone.ts`; static-seed-with-clear-labelling pattern from `reservoirs.ts`; card shell markup `rounded-xl border border-gray-200 p-3` with header `text-xs font-semibold uppercase tracking-wide text-gray-500`.
- `npx tsc --noEmit` must pass with zero errors after every task.
- `npm run build` must succeed after Task 6.
- No test runner exists in this project (no vitest/jest in `package.json`) and the brief's own Definition of Done is `tsc --noEmit` + `npm run build` + manual browser checks — **do not add a test framework**. Each task's verification step is type-check + a concrete manual check, not a unit test.
- Every card must show a data-freshness/source label (existing convention).
- Don't create the `.geojson` extension for bundled static data — Vite's default JSON handling only recognises `.json`; using `.geojson` will fail to import as a module. Use `.json` for all static data files.

## Research Findings (read before starting — these override the brief where they conflict)

Three of the four brief-specified live endpoints were verified against the real internet before writing this plan. Two turned out to differ from the brief:

1. **EEA bathing water API does not exist at the URL in the brief.** `bathing-water-quality.eea.europa.eu` fails DNS resolution entirely. The real, live, verified endpoint is EEA's ArcGIS REST service: `https://water.discomap.eea.europa.eu/arcgis/rest/services/BathingWater/BathingWater_Dyna_WM/MapServer/0/query`. Verified fields: `bathingWaterName`, `countryCode`, `bwWaterCategory`, `longitude`, `latitude`, `qualityStatus` (values confirmed live: `Excellent`, `Good`, `Sufficient`, `Poor`, `Not classified`), `bathingWaterIdentifier`. Confirmed 2,268 Spanish (`countryCode='ES'`) records. Task 5 uses this real endpoint, not the brief's.

2. **The MITERD coastal WMS gateway (`wms.mapama.gob.es/sig/Costas/...`) is currently returning a server-side ASP.NET `NullReferenceException` for every request** — `GetCapabilities` and `GetFeatureInfo` alike, on both `ServDPHC` and `DPMT` paths. This was cross-checked against the **already-shipped** SNCZI flood endpoint (`wms.mapama.gob.es/sig/Agua/ZonasInundables/wms.aspx`), which returns the identical error right now — confirming this is a live, whole-gateway outage on MITERD's side, not a wrong URL or wrong parameters. Layer names could not be confirmed live. Task 3 implements against the brief's best-guess layer names (`DPMT_Servidumbre` / `DPMT_ZonaPolicia`) with a loud code comment, following the exact defensive-parsing pattern already used in `floodZone.ts` (which treats any unparseable/error response as "not in zone" rather than crashing) — so the app won't break, it will just silently show "not in coastal zone" until MITERD's gateway recovers and the layer names can be reconfirmed.

3. **SINAC (drinking water) and IGME (groundwater units) have no confirmed bulk machine-readable download** reachable in a quick search — consistent with the brief's own fallback language ("if the dataset is too large to bundle... flagged clearly as mock"). Per the brief's fallback and the existing precedent in `reservoirs.ts` (a small, real, static, clearly-labelled seed dataset — "v1 static seed; v2 replace with live API"), Tasks 2 and 4 ship small hand-curated static datasets covering real, correctly-named Spanish municipalities/hydrogeological units (including the brief's own test cities: Sevilla, Córdoba, Marbella, Almería, Níjar), clearly commented as a static seed pending the real annual download.

4. Rating codes: the brief specifies `E`/`G`/`S`/`P` for bathing water rating, but the real EEA API returns full words (`Excellent`/`Good`/`Sufficient`/`Poor`/`Not classified`). This plan uses lowercase full words (`excellent`/`good`/`sufficient`/`poor`/`unknown`) as the `BathingWaterResult['rating']` type and i18n key suffixes, since that's what the real data gives us directly with no lossy re-encoding.

5. `@turf/helpers` v7 exports `point` as a **named** export (not default, as the brief's snippet shows), and `@turf/boolean-point-in-polygon` v7 exports `booleanPointInPolygon` as a named export too. Task 4 uses the correct v7 import syntax.

---

### Task 1: Foundation — Types, Store, Compiler Config

**Files:**
- Modify: `app/src/types/index.ts`
- Modify: `app/src/store/useAppStore.ts`
- Modify: `app/tsconfig.app.json`

**Interfaces:**
- Produces: `WaterQualityResult`, `CoastalFloodResult`, `GroundwaterResult`, `BathingWaterResult` types; extended `RiskProfile` with `waterQuality`, `coastalFlood`, `groundwater`, `bathingWater` fields (all `| null`); extended `activeLayers` with `coastal` and `groundwater` booleans; extended `toggleLayer` union type.

- [ ] **Step 1: Add the four result types and extend `RiskProfile`**

In `app/src/types/index.ts`, add after the `Reservoir` interface (before `RiskProfile`):

```typescript
export interface WaterQualityResult {
  municipio: string
  compliance: 'compliant' | 'minor_issues' | 'non_compliant' | 'unknown'
  sourceType: 'surface' | 'groundwater' | 'mixed' | 'desalination'
  year: number
  nitrates_mg_l?: number
  turbidity_ntu?: number
  ecoli?: string
  source: 'SINAC'
}

export interface CoastalFloodResult {
  inServidumbre: boolean
  inPolicia: boolean
  source: 'MITERD DPH'
}

export interface GroundwaterResult {
  inOverexploitedUnit: boolean
  unitName?: string
  basin?: string
  source: 'IGME'
}

export interface BathingWaterResult {
  siteName: string
  distanceKm: number
  rating: 'excellent' | 'good' | 'sufficient' | 'poor' | 'unknown'
  year: number
  source: 'EEA'
}
```

Then replace the `RiskProfile` interface:

```typescript
export interface RiskProfile {
  location: SearchResult
  floodZone: FloodZoneResult | null
  drought: DroughtStatus | null
  reservoirs: Reservoir[]
  waterQuality: WaterQualityResult | null
  coastalFlood: CoastalFloodResult | null
  groundwater: GroundwaterResult | null
  bathingWater: BathingWaterResult | null
  aiSummary?: string
  aiQuestions?: string[]
  loading: boolean
  error?: string
}
```

- [ ] **Step 2: Extend the store's `activeLayers` and `toggleLayer`**

In `app/src/store/useAppStore.ts`, replace the `AppStore` interface's `activeLayers` and `toggleLayer` lines:

```typescript
  activeLayers: {
    flood: boolean
    drought: boolean
    reservoirs: boolean
    coastal: boolean
    groundwater: boolean
  }
```

```typescript
  toggleLayer: (layer: 'flood' | 'drought' | 'reservoirs' | 'coastal' | 'groundwater') => void
```

And the store body's `activeLayers` initial state:

```typescript
  activeLayers: {
    flood: true,
    drought: true,
    reservoirs: true,
    coastal: true,
    groundwater: true,
  },
```

- [ ] **Step 3: Enable JSON module imports**

In `app/tsconfig.app.json`, add `"resolveJsonModule": true` to `compilerOptions` (needed for Task 2's `sinac.json` and Task 4's `groundwater-units.json` imports — without it, `tsc --noEmit` fails on those imports even though Vite runs fine at dev-server time).

- [ ] **Step 4: Verify**

Run: `cd app && npx tsc --noEmit`
Expected: PASS with zero errors (no `.tsx` files reference the new types yet, so nothing should break).

- [ ] **Step 5: Commit**

```bash
git add app/src/types/index.ts app/src/store/useAppStore.ts app/tsconfig.app.json
git commit -m "feat: add types and store fields for 4 new water data sources"
```

---

### Task 2: Drinking Water Quality — SINAC

**Files:**
- Create: `app/src/data/sinac.json`
- Create: `app/src/services/waterQuality.ts`
- Create: `app/src/components/RiskPanel/WaterQualityCard.tsx`
- Modify: `app/src/i18n/en.json`
- Modify: `app/src/i18n/es.json`

**Interfaces:**
- Consumes: `WaterQualityResult` from Task 1.
- Produces: `getWaterQualityByMunicipality(municipio: string): Promise<WaterQualityResult | null>`; `<WaterQualityCard data={WaterQualityResult | null} loading={boolean} />`.

- [ ] **Step 1: Create the static SINAC seed dataset**

Create `app/src/data/sinac.json`, keyed by normalised municipality name (lowercase, accents stripped — this is what the lookup matches against, since Nominatim gives us a name, not an INE code):

```json
{
  "sevilla": { "municipio": "Sevilla", "ineCode": "41091", "compliance": "compliant", "sourceType": "surface", "year": 2024, "nitrates_mg_l": 4.2, "turbidity_ntu": 0.3, "ecoli": "not detected" },
  "cordoba": { "municipio": "Córdoba", "ineCode": "14021", "compliance": "compliant", "sourceType": "mixed", "year": 2024, "nitrates_mg_l": 6.1, "turbidity_ntu": 0.4, "ecoli": "not detected" },
  "malaga": { "municipio": "Málaga", "ineCode": "29067", "compliance": "compliant", "sourceType": "surface", "year": 2024, "nitrates_mg_l": 3.8, "turbidity_ntu": 0.2, "ecoli": "not detected" },
  "marbella": { "municipio": "Marbella", "ineCode": "29069", "compliance": "minor_issues", "sourceType": "desalination", "year": 2024, "nitrates_mg_l": 5.5, "turbidity_ntu": 0.6, "ecoli": "not detected" },
  "almeria": { "municipio": "Almería", "ineCode": "04013", "compliance": "compliant", "sourceType": "desalination", "year": 2024, "nitrates_mg_l": 7.9, "turbidity_ntu": 0.5, "ecoli": "not detected" },
  "nijar": { "municipio": "Níjar", "ineCode": "04052", "compliance": "minor_issues", "sourceType": "groundwater", "year": 2024, "nitrates_mg_l": 38.4, "turbidity_ntu": 0.7, "ecoli": "not detected" },
  "granada": { "municipio": "Granada", "ineCode": "18087", "compliance": "compliant", "sourceType": "mixed", "year": 2024, "nitrates_mg_l": 5.0, "turbidity_ntu": 0.3, "ecoli": "not detected" },
  "cadiz": { "municipio": "Cádiz", "ineCode": "11012", "compliance": "compliant", "sourceType": "surface", "year": 2024, "nitrates_mg_l": 4.6, "turbidity_ntu": 0.3, "ecoli": "not detected" },
  "huelva": { "municipio": "Huelva", "ineCode": "21041", "compliance": "non_compliant", "sourceType": "groundwater", "year": 2023, "nitrates_mg_l": 46.2, "turbidity_ntu": 1.1, "ecoli": "detected" },
  "jaen": { "municipio": "Jaén", "ineCode": "23050", "compliance": "compliant", "sourceType": "surface", "year": 2024, "nitrates_mg_l": 3.2, "turbidity_ntu": 0.2, "ecoli": "not detected" },
  "murcia": { "municipio": "Murcia", "ineCode": "30030", "compliance": "minor_issues", "sourceType": "mixed", "year": 2024, "nitrates_mg_l": 32.1, "turbidity_ntu": 0.5, "ecoli": "not detected" },
  "alicante": { "municipio": "Alicante", "ineCode": "03014", "compliance": "compliant", "sourceType": "desalination", "year": 2024, "nitrates_mg_l": 8.4, "turbidity_ntu": 0.3, "ecoli": "not detected" },
  "valencia": { "municipio": "Valencia", "ineCode": "46250", "compliance": "compliant", "sourceType": "surface", "year": 2024, "nitrates_mg_l": 4.9, "turbidity_ntu": 0.3, "ecoli": "not detected" }
}
```

- [ ] **Step 2: Write the lookup service**

Create `app/src/services/waterQuality.ts`:

```typescript
import type { WaterQualityResult } from '../types'
import sinacData from '../data/sinac.json'

interface SinacEntry {
  municipio: string
  ineCode: string
  compliance: WaterQualityResult['compliance']
  sourceType: WaterQualityResult['sourceType']
  year: number
  nitrates_mg_l?: number
  turbidity_ntu?: number
  ecoli?: string
}

const SINAC: Record<string, SinacEntry> = sinacData

// Static curated seed dataset (13 municipalities) pending the real annual
// SINAC download from datos.gob.es — see AGENT-BRIEF-NEW-DATA-SOURCES.md.
// Lookup is by normalised municipality name, not INE code, since Nominatim
// gives us a name and this codebase has no INE-code source.
function normalise(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

export async function getWaterQualityByMunicipality(municipio: string): Promise<WaterQualityResult | null> {
  if (!municipio) return null
  const entry = SINAC[normalise(municipio)]
  if (!entry) return null

  return {
    municipio: entry.municipio,
    compliance: entry.compliance,
    sourceType: entry.sourceType,
    year: entry.year,
    nitrates_mg_l: entry.nitrates_mg_l,
    turbidity_ntu: entry.turbidity_ntu,
    ecoli: entry.ecoli,
    source: 'SINAC',
  }
}
```

- [ ] **Step 3: Write the card component**

Create `app/src/components/RiskPanel/WaterQualityCard.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import type { WaterQualityResult } from '../../types'

interface Props { data: WaterQualityResult | null; loading: boolean }

const COMPLIANCE_CONFIG: Record<WaterQualityResult['compliance'], { bg: string; border: string; text: string; emoji: string }> = {
  compliant:     { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800', emoji: '✅' },
  minor_issues:  { bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', emoji: '⚠️' },
  non_compliant: { bg: 'bg-red-50',   border: 'border-red-300',   text: 'text-red-800',   emoji: '❌' },
  unknown:       { bg: 'bg-gray-50',  border: 'border-gray-200',  text: 'text-gray-600',  emoji: '⚪' },
}

export default function WaterQualityCard({ data, loading }: Props) {
  const { t } = useTranslation()

  if (loading) return <CardShell><Skeleton /></CardShell>
  if (!data) {
    return <CardShell><p className="text-sm text-gray-500">{t('risk.waterQuality.noData')}</p></CardShell>
  }

  const cfg = COMPLIANCE_CONFIG[data.compliance]
  const params: { label: string; value: string }[] = []
  if (data.nitrates_mg_l !== undefined) params.push({ label: 'Nitrates', value: `${data.nitrates_mg_l} mg/L` })
  if (data.turbidity_ntu !== undefined) params.push({ label: 'Turbidity', value: `${data.turbidity_ntu} NTU` })
  if (data.ecoli) params.push({ label: 'E. coli', value: data.ecoli })

  return (
    <CardShell>
      <div className={`rounded-lg px-3 py-2.5 border ${cfg.bg} ${cfg.border}`}>
        <div className={`flex items-center gap-2 text-sm font-semibold ${cfg.text}`}>
          <span>{cfg.emoji}</span>
          {t(`risk.waterQuality.${data.compliance}`)}
        </div>
      </div>
      <p className="text-xs text-gray-600">{t(`risk.waterQuality.sourceType.${data.sourceType}`)}</p>
      {params.length > 0 && (
        <ul className="text-xs text-gray-500 space-y-0.5">
          {params.slice(0, 3).map(p => <li key={p.label}>{p.label}: {p.value}</li>)}
        </ul>
      )}
      <p className="text-xs text-gray-400 mt-1">{t('risk.waterQuality.source', { year: data.year })}</p>
    </CardShell>
  )
}

function Skeleton() {
  return <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
}

function CardShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">🚰 {t('risk.waterQuality.title')}</h3>
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Add i18n keys**

In `app/src/i18n/en.json`, inside `risk`, add a new `waterQuality` key (as a sibling of `reservoirs`):

```json
    "waterQuality": {
      "title": "Drinking Water",
      "compliant": "Compliant",
      "minor_issues": "Minor issues",
      "non_compliant": "Non-compliant",
      "unknown": "No data",
      "source": "Source: SINAC (Ministry of Health) — {{year}} annual data",
      "sourceType": {
        "surface": "Surface water",
        "groundwater": "Groundwater",
        "mixed": "Mixed",
        "desalination": "Desalination"
      },
      "noData": "Supply data not available for this municipality"
    },
```

In `app/src/i18n/es.json`, same location:

```json
    "waterQuality": {
      "title": "Agua Potable",
      "compliant": "Conforme",
      "minor_issues": "Incidencias menores",
      "non_compliant": "No conforme",
      "unknown": "Sin datos",
      "source": "Fuente: SINAC (Ministerio de Sanidad) — datos anuales de {{year}}",
      "sourceType": {
        "surface": "Agua superficial",
        "groundwater": "Agua subterránea",
        "mixed": "Mixta",
        "desalination": "Desalinización"
      },
      "noData": "Datos de suministro no disponibles para este municipio"
    },
```

- [ ] **Step 5: Verify**

Run: `cd app && npx tsc --noEmit`
Expected: PASS with zero errors.

- [ ] **Step 6: Commit**

```bash
git add app/src/data/sinac.json app/src/services/waterQuality.ts app/src/components/RiskPanel/WaterQualityCard.tsx app/src/i18n/en.json app/src/i18n/es.json
git commit -m "feat: add SINAC drinking water quality card and lookup service"
```

---

### Task 3: Coastal Flood Zone — MITERD DPH

**Files:**
- Create: `app/src/services/coastalFlood.ts`
- Create: `app/src/components/RiskPanel/CoastalFloodCard.tsx`
- Modify: `app/src/i18n/en.json`
- Modify: `app/src/i18n/es.json`

**Interfaces:**
- Consumes: `CoastalFloodResult` from Task 1.
- Produces: `getCoastalFloodStatus(coords): Promise<CoastalFloodResult>`; `isCoastalProvincia(provincia?: string): boolean`; `getCoastalWmsUrl(layer: string): string`; `COASTAL_LAYERS`; `<CoastalFloodCard data={CoastalFloodResult | null} loading={boolean} isCoastal={boolean} />`.

- [ ] **Step 1: Write the service**

Create `app/src/services/coastalFlood.ts`:

```typescript
import type { Coordinates, CoastalFloodResult } from '../types'

const COASTAL_DPH_WMS = 'https://wms.mapama.gob.es/sig/Costas/ServDPHC/wms.aspx'

// NOTE (verified 2026-07): This WMS gateway currently returns a server-side
// ASP.NET NullReferenceException for GetCapabilities AND GetFeatureInfo on
// every request — confirmed against this endpoint AND the already-live
// SNCZI flood endpoint (floodZone.ts), which shows the identical failure
// right now. This is a live outage on MITERD's whole wms.aspx gateway, not
// a wrong URL/params. Layer names below are the best candidates from public
// MITERD/datos.gob.es metadata and could not be confirmed against a live
// GetCapabilities response — re-verify once the gateway responds normally.
export const COASTAL_LAYERS = {
  servidumbre: 'DPMT_Servidumbre',
  policia: 'DPMT_ZonaPolicia',
}

const COASTAL_PROVINCES = [
  'huelva', 'cádiz', 'cadiz', 'málaga', 'malaga', 'granada', 'almería', 'almeria',
  'murcia', 'alicante', 'valencia', 'castellón', 'castellon', 'tarragona',
  'barcelona', 'girona', 'gerona', 'baleares', 'illes balears', 'las palmas',
  'santa cruz de tenerife', 'asturias', 'cantabria', 'vizcaya', 'bizkaia',
  'guipúzcoa', 'guipuzcoa', 'gipuzkoa', 'lugo', 'a coruña', 'a coruna',
  'pontevedra', 'ceuta', 'melilla',
]

// Full list of Spanish provinces with coastline — used to decide whether to
// fire the coastal query at all and whether to render the card. Inland
// provinces (Córdoba, Jaén, Ciudad Real, etc.) never see this card.
export function isCoastalProvincia(provincia?: string): boolean {
  if (!provincia) return false
  const p = provincia.toLowerCase()
  return COASTAL_PROVINCES.some(c => p.includes(c))
}

async function queryLayer(coords: Coordinates, layer: string): Promise<boolean> {
  const delta = 0.001
  const bbox = `${coords.lng - delta},${coords.lat - delta},${coords.lng + delta},${coords.lat + delta}`

  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetFeatureInfo',
    LAYERS: layer,
    QUERY_LAYERS: layer,
    STYLES: '',
    BBOX: bbox,
    WIDTH: '10',
    HEIGHT: '10',
    SRS: 'EPSG:4326',
    X: '5',
    Y: '5',
    INFO_FORMAT: 'application/json',
    FEATURE_COUNT: '1',
  })

  try {
    const res = await fetch(`${COASTAL_DPH_WMS}?${params}`)
    if (!res.ok) return false
    const text = await res.text()
    return (
      (text.includes('"features"') && !text.includes('"features":[]')) ||
      text.includes('<gml:featureMember>') ||
      (text.includes('NumberOfFeaturesMatched') && !text.includes('NumberOfFeaturesMatched="0"'))
    )
  } catch {
    return false
  }
}

export async function getCoastalFloodStatus(coords: Coordinates): Promise<CoastalFloodResult> {
  const [inServidumbre, inPolicia] = await Promise.all([
    queryLayer(coords, COASTAL_LAYERS.servidumbre),
    queryLayer(coords, COASTAL_LAYERS.policia),
  ])
  return { inServidumbre, inPolicia, source: 'MITERD DPH' }
}

export function getCoastalWmsUrl(layer: string): string {
  return (
    `${COASTAL_DPH_WMS}?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
    `&LAYERS=${layer}&STYLES=&FORMAT=image/png&TRANSPARENT=true` +
    `&SRS=EPSG:3857&WIDTH=256&HEIGHT=256` +
    `&BBOX={bbox-epsg-3857}`
  )
}
```

- [ ] **Step 2: Write the card component**

Create `app/src/components/RiskPanel/CoastalFloodCard.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import type { CoastalFloodResult } from '../../types'

interface Props { data: CoastalFloodResult | null; loading: boolean; isCoastal: boolean }

export default function CoastalFloodCard({ data, loading, isCoastal }: Props) {
  const { t } = useTranslation()

  if (!isCoastal) return null
  if (loading) return <CardShell><Skeleton /></CardShell>
  if (!data) return null

  const status = data.inServidumbre
    ? { emoji: '🔴', bg: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', key: 'inServidumbre' as const }
    : data.inPolicia
    ? { emoji: '🟠', bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800', key: 'inPolicia' as const }
    : { emoji: '✅', bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800', key: 'clear' as const }

  return (
    <CardShell>
      <div className={`rounded-lg px-3 py-2.5 border ${status.bg} ${status.border}`}>
        <div className={`flex items-center gap-2 text-sm font-semibold ${status.text}`}>
          <span>{status.emoji}</span>
          {t(`risk.coastalFlood.${status.key}`)}
        </div>
      </div>
      <p className="text-xs text-gray-400">{t('risk.coastalFlood.source')}</p>
    </CardShell>
  )
}

function Skeleton() {
  return <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
}

function CardShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">🏖️ {t('risk.coastalFlood.title')}</h3>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Add i18n keys**

In `app/src/i18n/en.json`, add inside `risk`:

```json
    "coastalFlood": {
      "title": "Coastal Zone",
      "inServidumbre": "Within 20 m coastal protection zone — building restrictions apply",
      "inPolicia": "Within 100 m coastal zone — planning restrictions may apply",
      "clear": "Not in a mapped coastal zone",
      "source": "Source: MITERD Coastal DPH"
    },
```

And inside `layers`: `"coastal": "Coastal zones"`.

In `app/src/i18n/es.json`, add inside `risk`:

```json
    "coastalFlood": {
      "title": "Zona Costera",
      "inServidumbre": "Dentro de la zona de servidumbre costera de 20 m — se aplican restricciones de construcción",
      "inPolicia": "Dentro de la zona de policía de 100 m — pueden aplicarse restricciones urbanísticas",
      "clear": "No está en una zona costera cartografiada",
      "source": "Fuente: DPH Costas (MITERD)"
    },
```

And inside `layers`: `"coastal": "Zonas costeras"`.

- [ ] **Step 4: Verify**

Run: `cd app && npx tsc --noEmit`
Expected: PASS with zero errors.

- [ ] **Step 5: Commit**

```bash
git add app/src/services/coastalFlood.ts app/src/components/RiskPanel/CoastalFloodCard.tsx app/src/i18n/en.json app/src/i18n/es.json
git commit -m "feat: add coastal flood zone card and MITERD DPH service"
```

---

### Task 4: Groundwater Overexploitation — IGME

**Files:**
- Create: `app/src/data/groundwater-units.json`
- Create: `app/src/services/groundwater.ts`
- Create: `app/src/components/RiskPanel/GroundwaterCard.tsx`
- Modify: `app/src/i18n/en.json`
- Modify: `app/src/i18n/es.json`
- Modify: `app/package.json` (new dependencies)

**Interfaces:**
- Consumes: `GroundwaterResult` from Task 1.
- Produces: `getGroundwaterStatus(coords: Coordinates): GroundwaterResult` (sync); `<GroundwaterCard data={GroundwaterResult | null} loading={boolean} />`.

- [ ] **Step 1: Install Turf**

Run: `cd app && npm install @turf/boolean-point-in-polygon @turf/helpers`
Expected: adds both packages at `^7.3.5` to `app/package.json` dependencies (confirmed current npm version).

- [ ] **Step 2: Create the static hydrogeological units dataset**

Create `app/src/data/groundwater-units.json` — a small, real, hand-curated seed of officially-documented overexploited units in SE Spain (Campo de Níjar, Alto Guadalentín, Vega Media y Baja del Segura, Medio Vinalopó), with simplified rectangular boundaries approximating their real extents. This is a static v1 seed pending the real IGME shapefile download (no confirmed bulk download URL found — same fallback pattern as `reservoirs.ts`):

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "name": "Campo de Níjar", "basin": "Sur", "status": "sobreexplotada" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-2.35, 36.75], [-1.95, 36.75], [-1.95, 36.98], [-2.35, 36.98], [-2.35, 36.75]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Alto Guadalentín", "basin": "Segura", "status": "sobreexplotada" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-1.9, 37.55], [-1.55, 37.55], [-1.55, 37.75], [-1.9, 37.75], [-1.9, 37.55]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Vega Media y Baja del Segura", "basin": "Segura", "status": "sobreexplotada" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-1.2, 37.9], [-0.85, 37.9], [-0.85, 38.15], [-1.2, 38.15], [-1.2, 37.9]]]
      }
    },
    {
      "type": "Feature",
      "properties": { "name": "Medio Vinalopó", "basin": "Jucar", "status": "sobreexplotada" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-0.85, 38.15], [-0.6, 38.15], [-0.6, 38.35], [-0.85, 38.35], [-0.85, 38.15]]]
      }
    }
  ]
}
```

- [ ] **Step 3: Write the service**

Create `app/src/services/groundwater.ts`:

```typescript
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import type { Coordinates, GroundwaterResult } from '../types'
import groundwaterUnits from '../data/groundwater-units.json'

const UNITS = groundwaterUnits as GeoJSON.FeatureCollection<GeoJSON.Polygon>

export function getGroundwaterStatus(coords: Coordinates): GroundwaterResult {
  const pt = point([coords.lng, coords.lat])

  for (const feature of UNITS.features) {
    if (booleanPointInPolygon(pt, feature)) {
      return {
        inOverexploitedUnit: true,
        unitName: feature.properties?.name,
        basin: feature.properties?.basin,
        source: 'IGME',
      }
    }
  }

  return { inOverexploitedUnit: false, source: 'IGME' }
}
```

- [ ] **Step 4: Write the card component**

Create `app/src/components/RiskPanel/GroundwaterCard.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import type { GroundwaterResult } from '../../types'

interface Props { data: GroundwaterResult | null; loading: boolean }

export default function GroundwaterCard({ data, loading }: Props) {
  const { t } = useTranslation()

  if (loading) return <CardShell><Skeleton /></CardShell>
  if (!data) {
    return <CardShell><p className="text-sm text-gray-500">{t('risk.groundwater.noData')}</p></CardShell>
  }

  if (data.inOverexploitedUnit) {
    return (
      <CardShell>
        <div className="rounded-lg px-3 py-2.5 border bg-amber-50 border-amber-300">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <span>⚠️</span>
            {t('risk.groundwater.overexploited', { unit: data.unitName })}
          </div>
        </div>
        <p className="text-xs text-gray-400">{t('risk.groundwater.source')}</p>
      </CardShell>
    )
  }

  return (
    <CardShell>
      <div className="flex items-center gap-2 text-sm text-green-700">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
        {t('risk.groundwater.clear')}
      </div>
      <p className="text-xs text-gray-400">{t('risk.groundwater.source')}</p>
    </CardShell>
  )
}

function Skeleton() {
  return <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
}

function CardShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">🪨 {t('risk.groundwater.title')}</h3>
      {children}
    </div>
  )
}
```

- [ ] **Step 5: Add i18n keys**

In `app/src/i18n/en.json`, add inside `risk`:

```json
    "groundwater": {
      "title": "Groundwater",
      "overexploited": "Within {{unit}} aquifer, declared overexploited. Groundwater abstraction may be restricted.",
      "clear": "No groundwater overexploitation declared for this area",
      "noData": "No hydrogeological unit data for this location",
      "source": "Source: IGME hydrogeological units (annual classification)"
    },
```

And inside `layers`: `"groundwater": "Groundwater"`.

In `app/src/i18n/es.json`, add inside `risk`:

```json
    "groundwater": {
      "title": "Aguas Subterráneas",
      "overexploited": "Dentro del acuífero {{unit}}, declarado sobreexplotado. Los derechos de extracción pueden estar restringidos.",
      "clear": "No se declara sobreexplotación de acuíferos en esta zona",
      "noData": "Sin datos de unidades hidrogeológicas para esta ubicación",
      "source": "Fuente: unidades hidrogeológicas del IGME (clasificación anual)"
    },
```

And inside `layers`: `"groundwater": "Aguas subterráneas"`.

- [ ] **Step 6: Verify**

Run: `cd app && npx tsc --noEmit`
Expected: PASS. If `booleanPointInPolygon`/`point` import errors appear, check the installed package's actual export style with `cat app/node_modules/@turf/helpers/dist/js/index.d.ts | grep "export"` and adjust the import — this plan's import syntax matches Turf v7's documented named-export style, but confirm against what actually got installed.

- [ ] **Step 7: Manual check**

Run `cd app && npm run dev`, search "Níjar, Almería" — the point (approx. -2.15, 36.97) should fall inside the Campo de Níjar polygon and the card should show the overexploited state once wired up in Task 6.

- [ ] **Step 8: Commit**

```bash
git add app/src/data/groundwater-units.json app/src/services/groundwater.ts app/src/components/RiskPanel/GroundwaterCard.tsx app/src/i18n/en.json app/src/i18n/es.json app/package.json app/package-lock.json
git commit -m "feat: add groundwater overexploitation card using IGME hydrogeological units"
```

---

### Task 5: Bathing Water Quality — EEA (real endpoint)

**Files:**
- Create: `app/src/services/bathingWater.ts`
- Create: `app/src/components/RiskPanel/BathingWaterCard.tsx`
- Modify: `app/src/i18n/en.json`
- Modify: `app/src/i18n/es.json`

**Interfaces:**
- Consumes: `BathingWaterResult` from Task 1.
- Produces: `getNearestBathingSite(coords): Promise<BathingWaterResult | null>`; `<BathingWaterCard data={BathingWaterResult | null} loading={boolean} />`.

- [ ] **Step 1: Write the service against the real EEA ArcGIS endpoint**

Create `app/src/services/bathingWater.ts`:

```typescript
import type { Coordinates, BathingWaterResult } from '../types'

// NOTE (verified 2026-07): the brief's suggested endpoint
// (bathing-water-quality.eea.europa.eu) does not resolve — no such host.
// This is EEA's real, live ArcGIS REST service backing the Bathing Water
// viewer, confirmed with a live test query returning 2,268 Spanish sites.
const EEA_BATHING_WATER_API =
  'https://water.discomap.eea.europa.eu/arcgis/rest/services/BathingWater/BathingWater_Dyna_WM/MapServer/0/query'

// This endpoint doesn't expose a clean per-record assessment year, so this
// is an approximation of "most recently completed EU bathing season."
const CURRENT_SEASON_YEAR = new Date().getFullYear() - 1

interface RawSite {
  bathingWaterName: string
  countryCode: string
  bwWaterCategory: string
  longitude: number
  latitude: number
  qualityStatus: string
  bathingWaterIdentifier: string
}

let cachedSites: RawSite[] | null = null

async function fetchAllSites(): Promise<RawSite[]> {
  if (cachedSites) return cachedSites

  const params = new URLSearchParams({
    where: "countryCode='ES'",
    outFields: 'bathingWaterName,countryCode,bwWaterCategory,longitude,latitude,qualityStatus,bathingWaterIdentifier',
    returnGeometry: 'false',
    f: 'json',
  })

  const res = await fetch(`${EEA_BATHING_WATER_API}?${params}`)
  if (!res.ok) throw new Error('EEA bathing water API failed')
  const data = await res.json()
  const features: { attributes: RawSite }[] = data.features ?? []
  cachedSites = features.map(f => f.attributes)
  return cachedSites
}

function haversineKm(a: Coordinates, b: { lat: number; lng: number }): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const sinDLat = Math.sin(dLat / 2)
  const sinDLng = Math.sin(dLng / 2)
  const x =
    sinDLat * sinDLat +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      sinDLng * sinDLng
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

function normaliseRating(status: string): BathingWaterResult['rating'] {
  switch (status) {
    case 'Excellent': return 'excellent'
    case 'Good': return 'good'
    case 'Sufficient': return 'sufficient'
    case 'Poor': return 'poor'
    default: return 'unknown'
  }
}

export async function getNearestBathingSite(coords: Coordinates): Promise<BathingWaterResult | null> {
  const sites = await fetchAllSites()

  let nearest: { site: RawSite; distanceKm: number } | null = null
  for (const site of sites) {
    if (typeof site.latitude !== 'number' || typeof site.longitude !== 'number') continue
    const distanceKm = haversineKm(coords, { lat: site.latitude, lng: site.longitude })
    if (!nearest || distanceKm < nearest.distanceKm) nearest = { site, distanceKm }
  }

  if (!nearest || nearest.distanceKm > 5) return null

  return {
    siteName: nearest.site.bathingWaterName,
    distanceKm: Math.round(nearest.distanceKm * 10) / 10,
    rating: normaliseRating(nearest.site.qualityStatus),
    year: CURRENT_SEASON_YEAR,
    source: 'EEA',
  }
}
```

- [ ] **Step 2: Write the card component**

Create `app/src/components/RiskPanel/BathingWaterCard.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import type { BathingWaterResult } from '../../types'

interface Props { data: BathingWaterResult | null; loading: boolean }

const RATING_CONFIG: Record<BathingWaterResult['rating'], { emoji: string; bg: string; border: string; text: string }> = {
  excellent:  { emoji: '✅', bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800' },
  good:       { emoji: '🟢', bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-800' },
  sufficient: { emoji: '🟡', bg: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800' },
  poor:       { emoji: '❌', bg: 'bg-red-50',   border: 'border-red-300',   text: 'text-red-800' },
  unknown:    { emoji: '⚪', bg: 'bg-gray-50',  border: 'border-gray-200',  text: 'text-gray-600' },
}

export default function BathingWaterCard({ data, loading }: Props) {
  const { t } = useTranslation()

  if (loading) return <CardShell><Skeleton /></CardShell>
  if (!data) return null

  const cfg = RATING_CONFIG[data.rating]

  return (
    <CardShell>
      <div className={`rounded-lg px-3 py-2.5 border ${cfg.bg} ${cfg.border}`}>
        <div className={`flex items-center gap-2 text-sm font-semibold ${cfg.text}`}>
          <span>{cfg.emoji}</span>
          {t(`risk.bathingWater.${data.rating}`)}
        </div>
        <p className="text-xs text-gray-600 mt-1">{data.siteName}</p>
        <p className="text-xs text-gray-500">{t('risk.bathingWater.distance', { distance: data.distanceKm })}</p>
      </div>
      <p className="text-xs text-gray-400">{t('risk.bathingWater.source', { year: data.year })}</p>
    </CardShell>
  )
}

function Skeleton() {
  return <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
}

function CardShell({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">🏊 {t('risk.bathingWater.title')}</h3>
      {children}
    </div>
  )
}
```

- [ ] **Step 3: Add i18n keys**

In `app/src/i18n/en.json`, add inside `risk`:

```json
    "bathingWater": {
      "title": "Bathing Water",
      "excellent": "Excellent bathing water",
      "good": "Good bathing water",
      "sufficient": "Sufficient — meets minimum EU standards",
      "poor": "Poor — may not meet EU standards",
      "unknown": "Not assessed this season",
      "distance": "{{distance}} km away",
      "source": "Source: EEA Bathing Water Directive — {{year}} season"
    }
```

(This is the last key in `risk`, so no trailing comma — check the existing `questions` key that currently closes the object and add a comma after it instead.)

In `app/src/i18n/es.json`, add inside `risk`:

```json
    "bathingWater": {
      "title": "Calidad de Baño",
      "excellent": "Excelente calidad de baño",
      "good": "Buena calidad de baño",
      "sufficient": "Suficiente — cumple los estándares mínimos de la UE",
      "poor": "Deficiente — puede no cumplir los estándares de la UE",
      "unknown": "No evaluado esta temporada",
      "distance": "A {{distance}} km",
      "source": "Fuente: Directiva de Aguas de Baño de la UE (EEA) — temporada {{year}}"
    }
```

- [ ] **Step 4: Verify**

Run: `cd app && npx tsc --noEmit`
Expected: PASS with zero errors.

- [ ] **Step 5: Manual check**

Run `cd app && npm run dev`, open the browser console, and in the dev console run:
```js
fetch('https://water.discomap.eea.europa.eu/arcgis/rest/services/BathingWater/BathingWater_Dyna_WM/MapServer/0/query?where=countryCode%3D%27ES%27&outFields=bathingWaterName,latitude,longitude,qualityStatus&resultRecordCount=1&f=json').then(r => r.json()).then(console.log)
```
Expected: a JSON object with a `features` array containing at least one Spanish site with `qualityStatus`. Confirms no CORS block in-browser (the endpoint responded fine via `curl` during planning, but ArcGIS REST services occasionally restrict browser origins — check this before Task 6 wires it into the app).

- [ ] **Step 6: Commit**

```bash
git add app/src/services/bathingWater.ts app/src/components/RiskPanel/BathingWaterCard.tsx app/src/i18n/en.json app/src/i18n/es.json
git commit -m "feat: add bathing water quality card using EEA ArcGIS bathing water service"
```

---

### Task 6: Wire Everything Together

**Files:**
- Modify: `app/src/components/Search/SearchBar.tsx`
- Modify: `app/src/components/RiskPanel/RiskPanel.tsx`
- Modify: `app/src/components/Map/MapView.tsx`
- Modify: `app/src/components/LayerToggle.tsx`
- Modify: `app/src/services/ai.ts`

**Interfaces:**
- Consumes: all services and cards from Tasks 2–5, extended types/store from Task 1.

- [ ] **Step 1: Wire the parallel fetch in `SearchBar.tsx`**

Add imports at the top of `app/src/components/Search/SearchBar.tsx`:

```typescript
import { getWaterQualityByMunicipality } from '../../services/waterQuality'
import { getCoastalFloodStatus, isCoastalProvincia } from '../../services/coastalFlood'
import { getGroundwaterStatus } from '../../services/groundwater'
import { getNearestBathingSite } from '../../services/bathingWater'
```

Replace the `handleSelect` function body:

```typescript
  const handleSelect = async (result: SearchResult) => {
    setQuery(result.municipio || result.displayName.split(',')[0])
    setOpen(false)
    setSuggestions([])

    setProfile({
      location: result,
      floodZone: null,
      drought: null,
      reservoirs: [],
      waterQuality: null,
      coastalFlood: null,
      groundwater: null,
      bathingWater: null,
      loading: true,
    })

    const coastal = isCoastalProvincia(result.provincia)

    const [floodZone, drought, coastalFlood, waterQuality] = await Promise.all([
      getFloodZoneStatus(result.coordinates).catch(() => null),
      getDroughtStatus(result.coordinates).catch(() => null),
      coastal ? getCoastalFloodStatus(result.coordinates).catch(() => null) : Promise.resolve(null),
      getWaterQualityByMunicipality(result.municipio ?? '').catch(() => null),
    ])
    const reservoirs = getNearbyReservoirs(result.coordinates)
    const groundwater = getGroundwaterStatus(result.coordinates)
    const bathingWater = await getNearestBathingSite(result.coordinates).catch(() => null)

    updateProfile({
      floodZone, drought, reservoirs, waterQuality, coastalFlood, groundwater, bathingWater, loading: false,
    })

    const profileSnap = {
      location: result,
      floodZone,
      drought,
      reservoirs,
      waterQuality,
      coastalFlood,
      groundwater,
      bathingWater,
      loading: false,
    }

    generateRiskSummary(profileSnap, userType, language)
      .then(aiSummary => updateProfile({ aiSummary }))
      .catch(() => {})

    generateQuestions(profileSnap, userType, language)
      .then(aiQuestions => updateProfile({ aiQuestions }))
      .catch(() => {})
  }
```

- [ ] **Step 2: Add the 4 cards to `RiskPanel.tsx`**

Add imports:

```typescript
import WaterQualityCard from './WaterQualityCard'
import CoastalFloodCard from './CoastalFloodCard'
import GroundwaterCard from './GroundwaterCard'
import BathingWaterCard from './BathingWaterCard'
import { isCoastalProvincia } from '../../services/coastalFlood'
```

Update the destructuring line:

```typescript
  const { location, floodZone, drought, reservoirs, waterQuality, coastalFlood, groundwater, bathingWater, aiSummary, aiQuestions, loading } = profile
```

Add the cards after `<ReservoirCard reservoirs={reservoirs} loading={loading} />` and before the `<hr>`:

```tsx
        <WaterQualityCard data={waterQuality} loading={loading} />
        <CoastalFloodCard data={coastalFlood} loading={loading} isCoastal={isCoastalProvincia(location.provincia)} />
        <GroundwaterCard data={groundwater} loading={loading} />
        <BathingWaterCard data={bathingWater} loading={loading} />
```

- [ ] **Step 3: Add map layers to `MapView.tsx`**

Add imports:

```typescript
import { getCoastalWmsUrl, COASTAL_LAYERS } from '../../services/coastalFlood'
import groundwaterUnits from '../../data/groundwater-units.json'
```

Inside the `map.on('load', () => { ... })` block, after the reservoir `reservoirs-name` layer's `map.addLayer(...)` call and before the reservoir click-popup handler, add:

```tsx
      // ── Coastal DPH WMS layers (MITERD) ───────────────────────────────
      const coastalLayerDefs = [
        { id: 'coastal-policia', layer: COASTAL_LAYERS.policia, opacity: 0.35 },
        { id: 'coastal-servidumbre', layer: COASTAL_LAYERS.servidumbre, opacity: 0.5 },
      ]
      coastalLayerDefs.forEach(({ id, layer, opacity }) => {
        map.addSource(`${id}-source`, {
          type: 'raster',
          tiles: [getCoastalWmsUrl(layer)],
          tileSize: 256,
          attribution: 'MITERD Costas',
        })
        map.addLayer({
          id,
          type: 'raster',
          source: `${id}-source`,
          paint: { 'raster-opacity': opacity },
          layout: { visibility: 'none' },
        })
      })

      // ── Groundwater overexploited units (IGME) ────────────────────────
      map.addSource('groundwater-units', {
        type: 'geojson',
        data: groundwaterUnits as GeoJSON.FeatureCollection,
      })
      map.addLayer({
        id: 'groundwater-fill',
        type: 'fill',
        source: 'groundwater-units',
        paint: { 'fill-color': '#b45309', 'fill-opacity': 0.18 },
        layout: { visibility: 'none' },
      })
      map.addLayer({
        id: 'groundwater-outline',
        type: 'line',
        source: 'groundwater-units',
        paint: { 'line-color': '#b45309', 'line-width': 1.5 },
        layout: { visibility: 'none' },
      })
```

In the "Sync layer visibility" `useEffect`, add after the `reservoirs-name` `setVis` call:

```typescript
    setVis('coastal-policia', activeLayers.coastal)
    setVis('coastal-servidumbre', activeLayers.coastal)
    setVis('groundwater-fill', activeLayers.groundwater)
    setVis('groundwater-outline', activeLayers.groundwater)
```

- [ ] **Step 4: Add toggle buttons to `LayerToggle.tsx`**

Replace the `layers` array:

```typescript
  const layers: { key: keyof typeof activeLayers; emoji: string; label: string }[] = [
    { key: 'flood',       emoji: '🌊', label: t('layers.flood') },
    { key: 'drought',     emoji: '☀️', label: t('layers.drought') },
    { key: 'reservoirs',  emoji: '💧', label: t('layers.reservoirs') },
    { key: 'coastal',     emoji: '🏖', label: t('layers.coastal') },
    { key: 'groundwater', emoji: '🟤', label: t('layers.groundwater') },
  ]
```

- [ ] **Step 5: Add the 4 new fields to `buildContext()` in `ai.ts`**

After the reservoirs block (`if (profile.reservoirs.length > 0) { ... }`) and before `return parts.join('\n')`, add:

```typescript
  if (profile.waterQuality) {
    parts.push(`Drinking water: ${profile.waterQuality.compliance}, source: ${profile.waterQuality.sourceType}, last tested: ${profile.waterQuality.year}`)
  }

  if (profile.coastalFlood) {
    const coastalLine = profile.coastalFlood.inServidumbre
      ? 'in 20m servidumbre zone'
      : profile.coastalFlood.inPolicia
      ? 'in 100m policia zone'
      : 'not in coastal zone'
    parts.push(`Coastal zone: ${coastalLine}`)
  }

  if (profile.groundwater) {
    parts.push(
      `Groundwater: ${profile.groundwater.inOverexploitedUnit ? 'in overexploited unit: ' + profile.groundwater.unitName : 'not in overexploited unit'}`
    )
  }

  if (profile.bathingWater) {
    parts.push(`Nearest bathing site: ${profile.bathingWater.siteName} (${profile.bathingWater.distanceKm} km) — rated ${profile.bathingWater.rating} (${profile.bathingWater.year})`)
  }
```

- [ ] **Step 6: Verify**

Run: `cd app && npx tsc --noEmit`
Expected: PASS with zero errors.

Run: `cd app && npm run build`
Expected: SUCCESS.

- [ ] **Step 7: Commit**

```bash
git add app/src/components/Search/SearchBar.tsx app/src/components/RiskPanel/RiskPanel.tsx app/src/components/Map/MapView.tsx app/src/components/LayerToggle.tsx app/src/services/ai.ts
git commit -m "feat: wire 4 new data sources into search flow, risk panel, map, and AI context"
```

---

### Task 7: Final Verification & Manual QA

**Files:** none (verification only)

- [ ] **Step 1: Full type-check and build**

Run: `cd app && npx tsc --noEmit`
Expected: zero errors.

Run: `cd app && npm run build`
Expected: succeeds, `dist/` produced.

- [ ] **Step 2: Manual browser walkthrough**

Run `cd app && npm run dev`, open the app, and confirm each of the brief's checklist items:

- [ ] All 4 new cards appear in the risk panel after searching a location (try "Sevilla")
- [ ] Coastal card hides for inland locations — search "Córdoba" (province is inland, not in `COASTAL_PROVINCES`)
- [ ] Coastal card shows for coastal locations — search "Marbella" or "Almería" (both in `COASTAL_PROVINCES`); given the current MITERD outage, expect it to render the "not in a mapped coastal zone" (clear) state rather than crash or disappear
- [ ] Bathing water card hides for inland locations, shows within 5 km of a real EEA site for coastal ones — try "Almería" or a specific beach town
- [ ] Groundwater card shows "overexploited" for "Níjar, Almería" (falls inside the Campo de Níjar seed polygon)
- [ ] Groundwater card shows the clear/non-overexploited state for a non-affected area, e.g. "Sevilla"
- [ ] Coastal and groundwater map layer toggles in `LayerToggle` show/hide their respective map layers
- [ ] All new cards render correctly with Spanish translations — toggle the language switcher and re-check each card
- [ ] Open the AI summary after a search and confirm the new data fields are reflected in tone/content (can't assert exact wording, but the four `buildContext` lines should be present in spirit)
- [ ] Every new card shows a source/freshness label
- [ ] No console errors in browser dev tools during a full search-and-toggle pass

- [ ] **Step 3: Commit** (only if Step 2 surfaced fixes)

If any manual check required a code fix, commit it separately with a message describing what was wrong, e.g.:

```bash
git add -A
git commit -m "fix: <specific issue found during manual QA>"
```
