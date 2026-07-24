# Water Risk Interface Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the water-risk app's interface per `docs/superpowers/specs/2026-07-24-water-risk-interface-design.md`: a map-first entry state with a floating search card, a registry-driven progressive panel, a Quiet Focus map system, opt-in AI interpretation behind a serverless proxy, and a mobile bottom sheet.

**Architecture:** A dataset registry + normalized result states drive everything (panel rows, detail views, map layers, legend, AI evidence). A single Zustand store holds explicit workspace state (§9.3 of the spec). The map is one persistent MapLibre instance; entry vs searched are states of the same surface. AI calls go through `/api/interpret` (Vercel function locally emulated by a Vite dev middleware) — no API key in the browser.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind 4 (`@theme` tokens), MapLibre GL 5, Zustand 5, react-i18next, @turf (already installed), Vitest + Testing Library (new), `@anthropic-ai/sdk` + `zod` (server-side only), `@fontsource/atkinson-hyperlegible`.

## Global Constraints

Copied from the spec — every task's requirements implicitly include these:

- **Sync concurrent work at the START of every task:** run `git fetch . main worktree-new-water-data-sources worktree-reservoir-data-audit 2>/dev/null; git log --oneline HEAD..main; git log --oneline HEAD..worktree-new-water-data-sources; git log --oneline HEAD..worktree-reservoir-data-audit` from the worktree. If any branch has new commits, `git merge <branch> --no-edit`, resolve conflicts union-style (their datasets become registry entries — never new hard-coded cards), verify `npx tsc --noEmit && npm run build` in `app/`, and commit the merge before starting the task.
- All work happens in worktree `/Users/editachavez/Projects/water-risk/.claude/worktrees/interface-redesign` on branch `worktree-interface-redesign`. App commands run from its `app/` subdirectory.
- Every string appears in BOTH `app/src/i18n/en.json` and `app/src/i18n/es.json`. No hard-coded UI copy in components.
- Content style (§13): literal, calm. AI mode label is exactly "What does this mean?" / "¿Qué significa esto?". Never render `unavailable`/`unsupported`/`error` states as green/safe/"none".
- Color tokens (§12.2, exact values): canvas `#FFFFFF`, ink `#20312A`, muted `#68766F`, primary `#285F77`, primary-hover `#204E62`, primary-soft `#E4EFF3`, focus `#78A9BD`, subtle-cool `#F5F8F9`, subtle-warm `#F7F7F3`, coverage `#7FA38C`, water `#4B91AD`, positive `#397353`, warning `#B87535`, danger `#AD4942`.
- Motion (§12.5): controls ~150 ms, panel ~240 ms, map moves ≤450 ms, entry fly-in ≤1200 ms, honour `prefers-reduced-motion` (fly-in/morph become instant).
- Radii: controls 8 px, groups 12 px, panels 16 px. Touch targets ≥44 px. Typography: Atkinson Hyperlegible 400/700 only. No emojis as icons.
- Exactly 0 or 1 primary map layer; max 2 context overlays (warning at the 2nd).
- No AI request before explicit opt-in; no AI interpretation outside coverage; no aggregate risk scores.
- The model for AI interpretation is `claude-haiku-4-5` (the project's existing choice), read from `ANTHROPIC_MODEL` env with that default. `VITE_ANTHROPIC_API_KEY` must NOT be referenced by any shipped client code when this plan completes; the server reads `ANTHROPIC_API_KEY`.
- After each task: `npx tsc --noEmit && npx vitest run && npm run build` all pass, then commit with the given message + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Test infrastructure

**Files:**
- Modify: `app/package.json` (devDeps + `test` script)
- Create: `app/vitest.config.ts`
- Create: `app/src/test/setup.ts`
- Create: `app/src/test/smoke.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` (alias `npx vitest run`) works; jsdom + jest-dom matchers available to all later test files.

- [ ] **Step 1: Install test dependencies**

```bash
cd app && npm install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @types/node
```

- [ ] **Step 2: Create vitest config and setup**

`app/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
})
```

`app/src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest'
```

Add to `app/package.json` scripts: `"test": "vitest run"`.

- [ ] **Step 3: Write a smoke test**

`app/src/test/smoke.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('test infrastructure', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 4: Run and verify**

Run: `npx vitest run` — Expected: 1 passed. Run `npx tsc --noEmit && npm run build` — Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "test: add Vitest + Testing Library infrastructure"
```

---

### Task 2: Design tokens and typography

**Files:**
- Modify: `app/src/index.css` (keep the tailwind import; add `@theme` tokens + base styles)
- Modify: `app/src/main.tsx` (font imports)
- Delete: `app/src/main.ts`, `app/src/counter.ts`, `app/src/style.css` (Vite scaffold leftovers — verify `app/index.html` references `/src/main.tsx`, then delete)

**Interfaces:**
- Consumes: nothing.
- Produces: Tailwind utility classes `bg-canvas text-ink text-muted bg-primary bg-primary-hover bg-primary-soft ring-focus bg-subtle-cool bg-subtle-warm text-coverage text-water text-positive text-warning text-danger` (and their bg-/text-/border- variants); CSS vars `--dur-control: 150ms; --dur-panel: 240ms`; Atkinson Hyperlegible as the app font.

- [ ] **Step 1: Install the font**

```bash
npm install @fontsource/atkinson-hyperlegible
```

- [ ] **Step 2: Add tokens to `app/src/index.css`**

Keep the existing `@import "tailwindcss";` first line, then append:

```css
@theme {
  --color-canvas: #FFFFFF;
  --color-ink: #20312A;
  --color-muted: #68766F;
  --color-primary: #285F77;
  --color-primary-hover: #204E62;
  --color-primary-soft: #E4EFF3;
  --color-focus: #78A9BD;
  --color-subtle-cool: #F5F8F9;
  --color-subtle-warm: #F7F7F3;
  --color-coverage: #7FA38C;
  --color-water: #4B91AD;
  --color-positive: #397353;
  --color-warning: #B87535;
  --color-danger: #AD4942;
  --font-sans: "Atkinson Hyperlegible", system-ui, sans-serif;
}

:root {
  --dur-control: 150ms;
  --dur-panel: 240ms;
}

@media (prefers-reduced-motion: reduce) {
  :root { --dur-control: 0ms; --dur-panel: 0ms; }
}

body { @apply font-sans text-ink bg-canvas; }

:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
```

- [ ] **Step 3: Import fonts in `app/src/main.tsx`** (top of file):

```typescript
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/700.css'
```

- [ ] **Step 4: Delete scaffold files**

Confirm `grep -n "main" app/index.html` shows `/src/main.tsx` only, then `rm app/src/main.ts app/src/counter.ts app/src/style.css`. If anything imports `style.css`, remove that import.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit && npx vitest run && npm run build` — Expected: pass.

```bash
git add -A && git commit -m "feat: add design tokens, Atkinson Hyperlegible, remove scaffold files"
```

---

### Task 3: Core workspace types and normalized result states

**Files:**
- Create: `app/src/types/workspace.ts`
- Modify: `app/src/types/index.ts` (re-export workspace types; add `Audience`; keep every existing dataset type unchanged)
- Test: `app/src/types/workspace.test.ts`

**Interfaces:**
- Consumes: existing types (`FloodZoneResult`, `DroughtStatus`, `Reservoir`, `WaterQualityResult`, `CoastalFloodResult`, `GroundwaterResult`, `BathingWaterResult`, `SearchResult`, `Language`).
- Produces (used by every later task):

`app/src/types/workspace.ts`:

```typescript
export type Audience = 'resident_owner' | 'buyer_investor'

export type DatasetId =
  | 'flood'
  | 'drought'
  | 'reservoirs'
  | 'waterQuality'
  | 'coastalFlood'
  | 'groundwater'
  | 'bathingWater'

export const ALL_DATASET_IDS: DatasetId[] = [
  'flood', 'drought', 'reservoirs', 'waterQuality',
  'coastalFlood', 'groundwater', 'bathingWater',
]

export type DatasetStatus =
  | 'loading'
  | 'available'
  | 'unavailable'
  | 'not_applicable'
  | 'unsupported'
  | 'error'

export interface DatasetResult<T = unknown> {
  status: DatasetStatus
  data?: T
  error?: string
}

// Statuses that must NEVER be styled as safe/low-risk (spec §9.2).
export const NON_SAFE_STATUSES: DatasetStatus[] = ['unavailable', 'unsupported', 'error']

export function isRenderableValue(r: DatasetResult | undefined): boolean {
  return r?.status === 'available'
}

export type WorkspaceView = 'entry' | 'searched'
export type PanelMode = 'data' | 'ai'
export type PanelDepth = 'list' | 'detail' | 'interpretation'

export type InterpretationScope =
  | { type: 'location' }
  | { type: 'dataset'; id: DatasetId }

export interface InterpretationState {
  status: 'idle' | 'loading' | 'ready' | 'error' | 'stale'
  scope: InterpretationScope | null
  text?: string
  questions?: string[]
  basis?: DatasetId[]
  language?: 'en' | 'es'
}
```

`app/src/types/index.ts` gains at the end: `export * from './workspace'` (do not remove or rename `UserType` yet — legacy components still reference it until Task 16).

- [ ] **Step 1: Write the failing test** — `app/src/types/workspace.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { isRenderableValue, NON_SAFE_STATUSES, ALL_DATASET_IDS } from './workspace'

describe('normalized dataset states', () => {
  it('only available is a renderable value', () => {
    expect(isRenderableValue({ status: 'available', data: 1 })).toBe(true)
    for (const status of ['loading', 'unavailable', 'not_applicable', 'unsupported', 'error'] as const) {
      expect(isRenderableValue({ status })).toBe(false)
    }
    expect(isRenderableValue(undefined)).toBe(false)
  })

  it('unavailable, unsupported and error are non-safe states', () => {
    expect(NON_SAFE_STATUSES).toEqual(['unavailable', 'unsupported', 'error'])
  })

  it('registers all seven datasets', () => {
    expect(ALL_DATASET_IDS).toHaveLength(7)
  })
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/types` — Expected: FAIL (module not found).
- [ ] **Step 3: Create `workspace.ts` exactly as above; add the re-export to `types/index.ts`.**
- [ ] **Step 4: Run** — `npx vitest run src/types` — Expected: PASS. `npx tsc --noEmit` — Expected: pass.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add workspace types and normalized dataset result states"`

---

### Task 4: Coverage service and region registry

**Files:**
- Create: `app/src/services/coverage.ts`
- Create: `app/src/data/andalucia-boundary.json`
- Test: `app/src/services/coverage.test.ts`

**Interfaces:**
- Consumes: `Coordinates`, `DatasetId` from types; `@turf/boolean-point-in-polygon`, `@turf/helpers` (installed).
- Produces:

```typescript
export interface CoverageRegion {
  id: string
  status: 'available'
  datasets: DatasetId[]
  effectiveDate: string
  geometry: GeoJSON.Feature<GeoJSON.Polygon>
}
export interface CoverageResult {
  supported: boolean
  regionId?: string
  datasets: DatasetId[]   // empty when unsupported
}
export function lookupCoverage(coords: Coordinates): CoverageResult
export function getCoverageGeoJSON(): GeoJSON.FeatureCollection  // for the map layer
```

- [ ] **Step 1: Create the boundary data** — `app/src/data/andalucia-boundary.json`, a coarse (registry-replaceable) Andalucía polygon, `[lng, lat]` order:

```json
{
  "type": "Feature",
  "properties": { "regionId": "andalucia" },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[
      [-7.52, 37.55], [-7.44, 37.75], [-7.25, 38.02], [-6.93, 38.21],
      [-6.35, 38.05], [-5.95, 38.43], [-5.05, 38.73], [-4.25, 38.60],
      [-3.37, 38.48], [-2.55, 38.51], [-2.00, 38.30], [-1.99, 37.87],
      [-1.63, 37.37], [-2.11, 36.78], [-2.60, 36.68], [-3.50, 36.68],
      [-4.42, 36.60], [-5.18, 36.30], [-5.36, 36.05], [-5.94, 35.99],
      [-6.29, 36.48], [-6.93, 37.10], [-7.40, 37.18], [-7.52, 37.55]
    ]]
  }
}
```

- [ ] **Step 2: Write the failing test** — `app/src/services/coverage.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { lookupCoverage, getCoverageGeoJSON } from './coverage'

describe('coverage lookup', () => {
  it('supports a point in Sevilla', () => {
    const r = lookupCoverage({ lat: 37.39, lng: -5.98 })
    expect(r.supported).toBe(true)
    expect(r.regionId).toBe('andalucia')
    expect(r.datasets.length).toBeGreaterThan(0)
  })
  it('supports Málaga and Granada', () => {
    expect(lookupCoverage({ lat: 36.72, lng: -4.42 }).supported).toBe(true)
    expect(lookupCoverage({ lat: 37.18, lng: -3.60 }).supported).toBe(true)
  })
  it('does not support Madrid or Lisbon', () => {
    expect(lookupCoverage({ lat: 40.42, lng: -3.70 })).toEqual({ supported: false, datasets: [] })
    expect(lookupCoverage({ lat: 38.72, lng: -9.14 }).supported).toBe(false)
  })
  it('exposes coverage geometry for the map', () => {
    const fc = getCoverageGeoJSON()
    expect(fc.type).toBe('FeatureCollection')
    expect(fc.features[0].properties?.regionId).toBe('andalucia')
  })
})
```

- [ ] **Step 3: Run to verify failure** — `npx vitest run src/services/coverage` — Expected: FAIL.
- [ ] **Step 4: Implement** — `app/src/services/coverage.ts`:

```typescript
import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon'
import { point } from '@turf/helpers'
import type { Coordinates } from '../types'
import type { DatasetId } from '../types/workspace'
import { ALL_DATASET_IDS } from '../types/workspace'
import andaluciaBoundary from '../data/andalucia-boundary.json'

export interface CoverageRegion {
  id: string
  status: 'available'
  datasets: DatasetId[]
  effectiveDate: string
  geometry: GeoJSON.Feature<GeoJSON.Polygon>
}

export interface CoverageResult {
  supported: boolean
  regionId?: string
  datasets: DatasetId[]
}

const REGIONS: CoverageRegion[] = [
  {
    id: 'andalucia',
    status: 'available',
    datasets: ALL_DATASET_IDS,
    effectiveDate: '2026-07-24',
    geometry: andaluciaBoundary as GeoJSON.Feature<GeoJSON.Polygon>,
  },
]

export function lookupCoverage(coords: Coordinates): CoverageResult {
  const pt = point([coords.lng, coords.lat])
  for (const region of REGIONS) {
    if (booleanPointInPolygon(pt, region.geometry)) {
      return { supported: true, regionId: region.id, datasets: region.datasets }
    }
  }
  return { supported: false, datasets: [] }
}

export function getCoverageGeoJSON(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: REGIONS.map(r => r.geometry) }
}
```

- [ ] **Step 5: Run** — `npx vitest run src/services/coverage` — Expected: PASS. (If a boundary point test fails, adjust the offending polygon vertex, not the test cities.)
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: add registry-driven coverage service with Andalucía boundary"`

---

### Task 5: Dataset registry and fetch adapters

**Files:**
- Create: `app/src/registry/datasets.ts`
- Modify: `app/src/i18n/en.json`, `app/src/i18n/es.json` (add `registry.*` block)
- Test: `app/src/registry/datasets.test.ts`

**Interfaces:**
- Consumes: all seven service modules (signatures verified in the codebase): `getFloodZoneStatus(coords)`, `getDroughtStatus(coords)`, `getNearbyReservoirs(coords)`, `getWaterQualityByMunicipality(municipio)`, `getCoastalFloodStatus(coords)` + `isCoastalProvincia(provincia)`, `getGroundwaterStatus(coords)` (sync), `getNearestBathingSite(coords)`; `DatasetResult`, `DatasetId`, `Audience`, `SearchResult`.
- Produces:

```typescript
export interface DatasetDef {
  id: DatasetId
  category: 'hazard' | 'supply' | 'quality'
  source: { name: string; url?: string }
  mapRole: 'primary' | 'context' | 'none'
  aiAllowed: boolean
  audienceWeight: Record<Audience, number>  // lower = earlier
  defaultOrder: number
  appliesTo: (location: SearchResult) => boolean
  fetch: (location: SearchResult) => Promise<DatasetResult>
}
export const DATASETS: DatasetDef[]
export function getDataset(id: DatasetId): DatasetDef
export function orderedDatasets(location: SearchResult, audience: Audience | null): DatasetDef[]
```

i18n contract: for every id, keys `registry.<id>.name`, `registry.<id>.cadence`, `registry.<id>.resolution`, and `registry.<id>.limitations` (array of strings) exist in both languages. Detail bodies also reuse the existing `flood.*`, `drought.*`, `reservoir.*`, `waterQuality.*`, `coastalFlood.*`, `groundwater.*`, `bathingWater.*` blocks.

- [ ] **Step 1: Write the failing test** — `app/src/registry/datasets.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { DATASETS, orderedDatasets, getDataset } from './datasets'
import { ALL_DATASET_IDS } from '../types/workspace'
import en from '../i18n/en.json'
import es from '../i18n/es.json'
import type { SearchResult } from '../types'

const sevilla: SearchResult = {
  displayName: 'Sevilla, Andalucía, España',
  coordinates: { lat: 37.39, lng: -5.98 },
  municipio: 'Sevilla', provincia: 'Sevilla', basin: 'guadalquivir',
}
const cordoba: SearchResult = { ...sevilla, municipio: 'Córdoba', provincia: 'Córdoba' }

describe('dataset registry', () => {
  it('registers every dataset id exactly once', () => {
    expect(DATASETS.map(d => d.id).sort()).toEqual([...ALL_DATASET_IDS].sort())
  })

  it('has EN and ES labels, cadence, resolution and limitations for every dataset', () => {
    for (const d of DATASETS) {
      for (const dict of [en, es] as any[]) {
        expect(dict.registry[d.id].name, `${d.id} name`).toBeTruthy()
        expect(dict.registry[d.id].cadence).toBeTruthy()
        expect(dict.registry[d.id].resolution).toBeTruthy()
        expect(Array.isArray(dict.registry[d.id].limitations)).toBe(true)
        expect(dict.registry[d.id].limitations.length).toBeGreaterThan(0)
      }
    }
  })

  it('coastal datasets do not apply inland', () => {
    expect(getDataset('coastalFlood').appliesTo(cordoba)).toBe(false)
    expect(getDataset('bathingWater').appliesTo(cordoba)).toBe(false)
    expect(getDataset('flood').appliesTo(cordoba)).toBe(true)
  })

  it('audience reorders emphasis without changing membership', () => {
    const neutral = orderedDatasets(sevilla, null).map(d => d.id)
    const buyer = orderedDatasets(sevilla, 'buyer_investor').map(d => d.id)
    const resident = orderedDatasets(sevilla, 'resident_owner').map(d => d.id)
    expect([...buyer].sort()).toEqual([...neutral].sort())
    // Buyer/Investor leads with flood (T100 insurance relevance, PERSONAS.md)
    expect(buyer[0]).toBe('flood')
    // Resident/Owner leads with drought & restrictions exposure
    expect(resident[0]).toBe('drought')
  })

  it('map roles: four primaries, reservoirs is context, waterQuality and bathingWater are panel-only', () => {
    expect(DATASETS.filter(d => d.mapRole === 'primary').map(d => d.id).sort())
      .toEqual(['coastalFlood', 'drought', 'flood', 'groundwater'])
    expect(getDataset('reservoirs').mapRole).toBe('context')
    expect(getDataset('waterQuality').mapRole).toBe('none')
    expect(getDataset('bathingWater').mapRole).toBe('none')
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/registry` — Expected: FAIL.
- [ ] **Step 3: Implement** — `app/src/registry/datasets.ts`:

```typescript
import type { SearchResult } from '../types'
import type { Audience, DatasetId, DatasetResult } from '../types/workspace'
import { getFloodZoneStatus } from '../services/floodZone'
import { getDroughtStatus } from '../services/drought'
import { getNearbyReservoirs } from '../services/reservoirs'
import { getWaterQualityByMunicipality } from '../services/waterQuality'
import { getCoastalFloodStatus, isCoastalProvincia } from '../services/coastalFlood'
import { getGroundwaterStatus } from '../services/groundwater'
import { getNearestBathingSite } from '../services/bathingWater'

export interface DatasetDef {
  id: DatasetId
  category: 'hazard' | 'supply' | 'quality'
  source: { name: string; url?: string }
  mapRole: 'primary' | 'context' | 'none'
  aiAllowed: boolean
  audienceWeight: Record<Audience, number>
  defaultOrder: number
  appliesTo: (location: SearchResult) => boolean
  fetch: (location: SearchResult) => Promise<DatasetResult>
}

function ok<T>(data: T): DatasetResult<T> {
  return { status: 'available', data }
}
function err(e: unknown): DatasetResult {
  return { status: 'error', error: e instanceof Error ? e.message : String(e) }
}

export const DATASETS: DatasetDef[] = [
  {
    id: 'flood',
    category: 'hazard',
    source: { name: 'SNCZI — MITERD', url: 'https://sig.mapama.gob.es/snczi/' },
    mapRole: 'primary',
    aiAllowed: true,
    audienceWeight: { resident_owner: 3, buyer_investor: 1 },
    defaultOrder: 1,
    appliesTo: () => true,
    fetch: async loc => {
      try { return ok(await getFloodZoneStatus(loc.coordinates)) } catch (e) { return err(e) }
    },
  },
  {
    id: 'drought',
    category: 'hazard',
    source: { name: 'Copernicus EDO', url: 'https://edo.jrc.ec.europa.eu/' },
    mapRole: 'primary',
    aiAllowed: true,
    audienceWeight: { resident_owner: 1, buyer_investor: 4 },
    defaultOrder: 2,
    appliesTo: () => true,
    fetch: async loc => {
      try {
        const d = await getDroughtStatus(loc.coordinates)
        return d.level === 'unknown' ? { status: 'unavailable' } : ok(d)
      } catch (e) { return err(e) }
    },
  },
  {
    id: 'reservoirs',
    category: 'supply',
    source: { name: 'REDIAM / MITERD' },
    mapRole: 'context',
    aiAllowed: true,
    audienceWeight: { resident_owner: 2, buyer_investor: 5 },
    defaultOrder: 3,
    appliesTo: () => true,
    fetch: async loc => {
      try {
        const rs = getNearbyReservoirs(loc.coordinates)
        return rs.length === 0 ? { status: 'unavailable' } : ok(rs)
      } catch (e) { return err(e) }
    },
  },
  {
    id: 'waterQuality',
    category: 'quality',
    source: { name: 'SINAC — Ministerio de Sanidad', url: 'https://sinac.sanidad.gob.es/' },
    mapRole: 'none',
    aiAllowed: true,
    audienceWeight: { resident_owner: 4, buyer_investor: 6 },
    defaultOrder: 4,
    appliesTo: loc => Boolean(loc.municipio),
    fetch: async loc => {
      try {
        const q = await getWaterQualityByMunicipality(loc.municipio ?? '')
        return q === null ? { status: 'unavailable' } : ok(q)
      } catch (e) { return err(e) }
    },
  },
  {
    id: 'coastalFlood',
    category: 'hazard',
    source: { name: 'MITERD Coastal DPH' },
    mapRole: 'primary',
    aiAllowed: true,
    audienceWeight: { resident_owner: 6, buyer_investor: 2 },
    defaultOrder: 5,
    appliesTo: loc => isCoastalProvincia(loc.provincia),
    fetch: async loc => {
      try { return ok(await getCoastalFloodStatus(loc.coordinates)) } catch (e) { return err(e) }
    },
  },
  {
    id: 'groundwater',
    category: 'hazard',
    source: { name: 'IGME' },
    mapRole: 'primary',
    aiAllowed: true,
    audienceWeight: { resident_owner: 5, buyer_investor: 3 },
    defaultOrder: 6,
    appliesTo: () => true,
    fetch: async loc => {
      try { return ok(getGroundwaterStatus(loc.coordinates)) } catch (e) { return err(e) }
    },
  },
  {
    id: 'bathingWater',
    category: 'quality',
    source: { name: 'EEA Bathing Water' },
    mapRole: 'none',
    aiAllowed: true,
    audienceWeight: { resident_owner: 7, buyer_investor: 7 },
    defaultOrder: 7,
    appliesTo: loc => isCoastalProvincia(loc.provincia),
    fetch: async loc => {
      try {
        const s = await getNearestBathingSite(loc.coordinates)
        return s === null ? { status: 'unavailable' } : ok(s)
      } catch (e) { return err(e) }
    },
  },
]

export function getDataset(id: DatasetId): DatasetDef {
  const d = DATASETS.find(x => x.id === id)
  if (!d) throw new Error(`Unknown dataset: ${id}`)
  return d
}

export function orderedDatasets(location: SearchResult, audience: Audience | null): DatasetDef[] {
  return DATASETS
    .filter(d => d.appliesTo(location))
    .sort((a, b) =>
      audience
        ? a.audienceWeight[audience] - b.audienceWeight[audience]
        : a.defaultOrder - b.defaultOrder
    )
}
```

- [ ] **Step 4: Add `registry` i18n blocks.** In `app/src/i18n/en.json` add:

```json
"registry": {
  "flood": {
    "name": "River flood zones",
    "cadence": "Updated with SNCZI cartography cycles",
    "resolution": "Mapped flood polygons (T10 / T100 / T500)",
    "limitations": [
      "Does not show surface-water or flash flooding",
      "Does not show property-level drainage problems",
      "Does not show historical flood incidents"
    ]
  },
  "drought": {
    "name": "Drought status",
    "cadence": "Updated every 10 days (Combined Drought Indicator)",
    "resolution": "~5 km grid",
    "limitations": [
      "Does not show local supply restrictions in force",
      "Does not show reservoir or aquifer levels directly"
    ]
  },
  "reservoirs": {
    "name": "Nearby reservoirs",
    "cadence": "Static seed data (live feed planned)",
    "resolution": "Individual reservoirs within ~80 km",
    "limitations": [
      "Does not show which reservoir supplies your tap",
      "Does not show weekly variation — values are a snapshot"
    ]
  },
  "waterQuality": {
    "name": "Drinking water quality",
    "cadence": "Annual SINAC reporting",
    "resolution": "Municipality level",
    "limitations": [
      "Does not show your building's plumbing quality",
      "Does not cover private wells",
      "Sample covers a limited set of municipalities"
    ]
  },
  "coastalFlood": {
    "name": "Coastal zone (DPH)",
    "cadence": "Updated with coastal domain cartography",
    "resolution": "Mapped 20 m / 100 m coastal strips",
    "limitations": [
      "Does not show storm-surge or sea-level-rise projections",
      "Does not confirm legal status of an individual property"
    ]
  },
  "groundwater": {
    "name": "Groundwater status",
    "cadence": "Annual IGME classification",
    "resolution": "Hydrogeological unit polygons",
    "limitations": [
      "Does not show individual well legality or allocation",
      "Does not show current aquifer levels"
    ]
  },
  "bathingWater": {
    "name": "Bathing water",
    "cadence": "Annual EU bathing season assessment",
    "resolution": "Individual monitored sites",
    "limitations": [
      "Does not reflect conditions on a given day",
      "Assessment year is approximate for this source"
    ]
  }
}
```

And the Spanish equivalents in `app/src/i18n/es.json`:

```json
"registry": {
  "flood": {
    "name": "Zonas inundables fluviales",
    "cadence": "Actualizado con los ciclos cartográficos del SNCZI",
    "resolution": "Polígonos de inundación (T10 / T100 / T500)",
    "limitations": [
      "No muestra inundaciones pluviales ni repentinas",
      "No muestra problemas de drenaje a nivel de propiedad",
      "No muestra incidentes históricos de inundación"
    ]
  },
  "drought": {
    "name": "Estado de sequía",
    "cadence": "Actualizado cada 10 días (Indicador Combinado de Sequía)",
    "resolution": "Malla de ~5 km",
    "limitations": [
      "No muestra restricciones locales de suministro vigentes",
      "No muestra directamente niveles de embalses o acuíferos"
    ]
  },
  "reservoirs": {
    "name": "Embalses cercanos",
    "cadence": "Datos estáticos iniciales (fuente en vivo prevista)",
    "resolution": "Embalses individuales en ~80 km",
    "limitations": [
      "No indica qué embalse abastece su grifo",
      "No muestra variación semanal — los valores son una instantánea"
    ]
  },
  "waterQuality": {
    "name": "Calidad del agua potable",
    "cadence": "Informe anual SINAC",
    "resolution": "Nivel municipal",
    "limitations": [
      "No muestra la calidad de la fontanería de su edificio",
      "No cubre pozos privados",
      "La muestra cubre un conjunto limitado de municipios"
    ]
  },
  "coastalFlood": {
    "name": "Zona costera (DPH)",
    "cadence": "Actualizado con la cartografía del dominio costero",
    "resolution": "Franjas costeras de 20 m / 100 m",
    "limitations": [
      "No muestra proyecciones de marejadas ni subida del nivel del mar",
      "No confirma la situación legal de una propiedad concreta"
    ]
  },
  "groundwater": {
    "name": "Estado de las aguas subterráneas",
    "cadence": "Clasificación anual del IGME",
    "resolution": "Polígonos de unidades hidrogeológicas",
    "limitations": [
      "No muestra la legalidad ni la concesión de pozos individuales",
      "No muestra niveles actuales del acuífero"
    ]
  },
  "bathingWater": {
    "name": "Aguas de baño",
    "cadence": "Evaluación anual de la temporada de baño de la UE",
    "resolution": "Puntos de muestreo individuales",
    "limitations": [
      "No refleja las condiciones de un día concreto",
      "El año de evaluación es aproximado para esta fuente"
    ]
  }
}
```

- [ ] **Step 5: Run** — `npx vitest run src/registry` — Expected: PASS. `npx tsc --noEmit` — pass.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: add dataset registry with fetch adapters and bilingual metadata"`

---

### Task 6: Workspace store rewrite

**Files:**
- Rewrite: `app/src/store/useAppStore.ts`
- Test: `app/src/store/useAppStore.test.ts`

**Interfaces:**
- Consumes: workspace types (Task 3), `getDataset` (Task 5), `lookupCoverage` (Task 4).
- Produces (every UI/map task consumes this — exact shape):

```typescript
interface AppStore {
  language: Language
  view: WorkspaceView                       // 'entry' | 'searched'
  location: SearchResult | null
  audience: Audience | null
  coverage: CoverageResult | null
  panelMode: PanelMode                      // 'data' | 'ai'
  panelDepth: PanelDepth                    // 'list' | 'detail' | 'interpretation'
  selectedDataset: DatasetId | null
  primaryLayer: DatasetId | null
  contextLayers: DatasetId[]
  results: Partial<Record<DatasetId, DatasetResult>>
  interpretation: InterpretationState

  setLanguage(lang: Language): void         // marks a ready interpretation stale
  setAudience(a: Audience | null): void
  beginSearch(location: SearchResult): void // -> searched view, coverage computed, results/interpretation reset
  goHome(): void                            // -> entry view, keeps language + audience
  setResult(id: DatasetId, result: DatasetResult): void
  selectDataset(id: DatasetId): void        // detail depth; activates primary layer when mapRole==='primary'
  backToList(): void
  openDataMode(): void                      // panelMode 'data', restores prior depth context
  openAiMode(): void                        // panelMode 'ai', depth 'interpretation' — does NOT fetch
  setPrimaryLayer(id: DatasetId | null): void      // enforces mapRole==='primary'
  toggleContextLayer(id: DatasetId): void          // enforces mapRole==='context', max 2
  setInterpretation(partial: Partial<InterpretationState>): void
}
```

Key rules encoded in the store (unit-tested): primary layer exclusivity, context-layer cap of 2, `openAiMode` never mutates `interpretation` (fetching is a separate explicit action in Task 9's client), `beginSearch` resets `results` and `interpretation`, returning to data mode restores the previous list/detail depth.

- [ ] **Step 1: Write the failing test** — `app/src/store/useAppStore.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from './useAppStore'
import type { SearchResult } from '../types'

const sevilla: SearchResult = {
  displayName: 'Sevilla', coordinates: { lat: 37.39, lng: -5.98 },
  municipio: 'Sevilla', provincia: 'Sevilla', basin: 'guadalquivir',
}
const madrid: SearchResult = {
  displayName: 'Madrid', coordinates: { lat: 40.42, lng: -3.70 },
  municipio: 'Madrid', provincia: 'Madrid',
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState())
})

describe('workspace store', () => {
  it('starts at the entry view with no audience', () => {
    const s = useAppStore.getState()
    expect(s.view).toBe('entry')
    expect(s.audience).toBeNull()
    expect(s.panelMode).toBe('data')
  })

  it('beginSearch moves to searched, computes coverage, resets results', () => {
    useAppStore.getState().setResult('flood', { status: 'available', data: {} })
    useAppStore.getState().beginSearch(sevilla)
    const s = useAppStore.getState()
    expect(s.view).toBe('searched')
    expect(s.coverage?.supported).toBe(true)
    expect(s.results).toEqual({})
    expect(s.interpretation.status).toBe('idle')
  })

  it('beginSearch outside coverage marks unsupported', () => {
    useAppStore.getState().beginSearch(madrid)
    expect(useAppStore.getState().coverage?.supported).toBe(false)
  })

  it('selecting a primary-mapped dataset opens detail and activates its layer', () => {
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().selectDataset('flood')
    const s = useAppStore.getState()
    expect(s.panelDepth).toBe('detail')
    expect(s.selectedDataset).toBe('flood')
    expect(s.primaryLayer).toBe('flood')
  })

  it('primary layers are mutually exclusive', () => {
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().setPrimaryLayer('flood')
    useAppStore.getState().setPrimaryLayer('drought')
    expect(useAppStore.getState().primaryLayer).toBe('drought')
    useAppStore.getState().setPrimaryLayer(null)
    expect(useAppStore.getState().primaryLayer).toBeNull()
  })

  it('rejects a context dataset as primary and vice versa', () => {
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().setPrimaryLayer('reservoirs')
    expect(useAppStore.getState().primaryLayer).toBeNull()
    useAppStore.getState().toggleContextLayer('flood')
    expect(useAppStore.getState().contextLayers).toEqual(['reservoirs'])
  })

  it('caps context overlays at 2', () => {
    // Default context: reservoirs on. Only one context dataset exists today,
    // so simulate the cap with repeated toggles.
    useAppStore.getState().beginSearch(sevilla)
    expect(useAppStore.getState().contextLayers).toEqual(['reservoirs'])
    useAppStore.getState().toggleContextLayer('reservoirs')
    expect(useAppStore.getState().contextLayers).toEqual([])
  })

  it('openAiMode switches mode without touching interpretation state', () => {
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().openAiMode()
    const s = useAppStore.getState()
    expect(s.panelMode).toBe('ai')
    expect(s.interpretation.status).toBe('idle')
  })

  it('returning to data mode restores the prior depth', () => {
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().selectDataset('flood')
    useAppStore.getState().openAiMode()
    useAppStore.getState().openDataMode()
    const s = useAppStore.getState()
    expect(s.panelDepth).toBe('detail')
    expect(s.selectedDataset).toBe('flood')
  })

  it('language change marks a ready interpretation stale', () => {
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().setInterpretation({ status: 'ready', text: 'x', scope: { type: 'location' } })
    useAppStore.getState().setLanguage('es')
    expect(useAppStore.getState().interpretation.status).toBe('stale')
  })

  it('goHome returns to entry keeping audience', () => {
    useAppStore.getState().setAudience('buyer_investor')
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().goHome()
    const s = useAppStore.getState()
    expect(s.view).toBe('entry')
    expect(s.audience).toBe('buyer_investor')
    expect(s.location).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/store` — Expected: FAIL.
- [ ] **Step 3: Implement** — rewrite `app/src/store/useAppStore.ts`:

```typescript
import { create } from 'zustand'
import type { Language, SearchResult } from '../types'
import type {
  Audience, DatasetId, DatasetResult, InterpretationState,
  PanelDepth, PanelMode, WorkspaceView,
} from '../types/workspace'
import { lookupCoverage, type CoverageResult } from '../services/coverage'
import { getDataset } from '../registry/datasets'

const MAX_CONTEXT_LAYERS = 2

interface AppStore {
  language: Language
  view: WorkspaceView
  location: SearchResult | null
  audience: Audience | null
  coverage: CoverageResult | null
  panelMode: PanelMode
  panelDepth: PanelDepth
  selectedDataset: DatasetId | null
  primaryLayer: DatasetId | null
  contextLayers: DatasetId[]
  results: Partial<Record<DatasetId, DatasetResult>>
  interpretation: InterpretationState

  setLanguage: (lang: Language) => void
  setAudience: (a: Audience | null) => void
  beginSearch: (location: SearchResult) => void
  goHome: () => void
  setResult: (id: DatasetId, result: DatasetResult) => void
  selectDataset: (id: DatasetId) => void
  backToList: () => void
  openDataMode: () => void
  openAiMode: () => void
  setPrimaryLayer: (id: DatasetId | null) => void
  toggleContextLayer: (id: DatasetId) => void
  setInterpretation: (partial: Partial<InterpretationState>) => void
}

const idleInterpretation: InterpretationState = { status: 'idle', scope: null }

export const useAppStore = create<AppStore>((set, get) => ({
  language: 'en',
  view: 'entry',
  location: null,
  audience: null,
  coverage: null,
  panelMode: 'data',
  panelDepth: 'list',
  selectedDataset: null,
  primaryLayer: null,
  contextLayers: ['reservoirs'],
  results: {},
  interpretation: idleInterpretation,

  setLanguage: language =>
    set(state => ({
      language,
      interpretation:
        state.interpretation.status === 'ready'
          ? { ...state.interpretation, status: 'stale' }
          : state.interpretation,
    })),

  setAudience: audience => set({ audience }),

  beginSearch: location =>
    set({
      view: 'searched',
      location,
      coverage: lookupCoverage(location.coordinates),
      panelMode: 'data',
      panelDepth: 'list',
      selectedDataset: null,
      results: {},
      interpretation: idleInterpretation,
    }),

  goHome: () =>
    set({
      view: 'entry',
      location: null,
      coverage: null,
      panelMode: 'data',
      panelDepth: 'list',
      selectedDataset: null,
      primaryLayer: null,
      results: {},
      interpretation: idleInterpretation,
    }),

  setResult: (id, result) =>
    set(state => ({ results: { ...state.results, [id]: result } })),

  selectDataset: id => {
    const def = getDataset(id)
    set({
      selectedDataset: id,
      panelDepth: 'detail',
      panelMode: 'data',
      ...(def.mapRole === 'primary' ? { primaryLayer: id } : {}),
    })
  },

  backToList: () => set({ panelDepth: 'list', selectedDataset: null }),

  openDataMode: () => {
    const { selectedDataset } = get()
    set({ panelMode: 'data', panelDepth: selectedDataset ? 'detail' : 'list' })
  },

  openAiMode: () => set({ panelMode: 'ai', panelDepth: 'interpretation' }),

  setPrimaryLayer: id => {
    if (id !== null && getDataset(id).mapRole !== 'primary') return
    set({ primaryLayer: id })
  },

  toggleContextLayer: id => {
    if (getDataset(id).mapRole !== 'context') return
    set(state => {
      if (state.contextLayers.includes(id)) {
        return { contextLayers: state.contextLayers.filter(x => x !== id) }
      }
      if (state.contextLayers.length >= MAX_CONTEXT_LAYERS) return state
      return { contextLayers: [...state.contextLayers, id] }
    })
  },

  setInterpretation: partial =>
    set(state => ({ interpretation: { ...state.interpretation, ...partial } })),
}))
```

- [ ] **Step 4: Run** — `npx vitest run src/store` — Expected: PASS.
- [ ] **Step 5: Fix legacy references.** `SearchBar.tsx`, `RiskPanel.tsx`, `MapView.tsx`, `LayerToggle.tsx`, `UserTypeSelector.tsx`, and the card components still destructure the old store fields (`profile`, `userType`, `activeLayers`, `toggleLayer`, `setProfile`, `updateProfile`); `App.tsx` composes them. They are all replaced in Tasks 10–16 — for now, to keep the build green, replace `App.tsx`'s body with a minimal placeholder so the legacy tree is unmounted and unimported:

```typescript
export default function App() {
  return <div className="h-screen w-screen bg-canvas" />
}
```

Do NOT delete the legacy component files yet (Task 16 does), but nothing may import them. If `npx tsc --noEmit` reports errors inside the unimported legacy files, exclude nothing — instead update those files' store usage minimally (they compile against the new store by replacing their store destructuring with `useAppStore()` no-ops) OR (preferred, simpler) delete `LayerToggle.tsx`, `RiskPanel/` card components' store imports by deleting the files early if they block compilation. Prefer early deletion of: `RiskPanel/UserTypeSelector.tsx`, `RiskPanel/AIProfile.tsx`, `RiskPanel/QuestionsCard.tsx`, `RiskPanel/RiskPanel.tsx`, `LayerToggle.tsx`, `Search/SearchBar.tsx` — their replacements are complete rewrites anyway. Keep `FloodCard/DroughtCard/ReservoirCard/WaterQualityCard/CoastalFloodCard/GroundwaterCard/BathingWaterCard` ONLY if they compile standalone; otherwise delete them too (Task 13's detail view does not reuse them).
- [ ] **Step 6: Verify all** — `npx tsc --noEmit && npx vitest run && npm run build` — Expected: pass.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: rewrite store as explicit workspace state machine"`

---

### Task 7: Profile orchestrator

**Files:**
- Create: `app/src/services/orchestrator.ts`
- Test: `app/src/services/orchestrator.test.ts`

**Interfaces:**
- Consumes: `orderedDatasets` shape (`DatasetDef[]`), `DatasetResult`.
- Produces:

```typescript
export interface OrchestratorCallbacks {
  onResult: (id: DatasetId, result: DatasetResult) => void
}
// Marks every applicable dataset loading, runs all fetches in parallel,
// reports each result the moment it settles. Never throws.
export async function runProfile(
  location: SearchResult,
  datasets: DatasetDef[],
  cb: OrchestratorCallbacks,
): Promise<void>
```

- [ ] **Step 1: Write the failing test** — `app/src/services/orchestrator.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { runProfile } from './orchestrator'
import type { DatasetDef } from '../registry/datasets'
import type { SearchResult } from '../types'

const loc: SearchResult = {
  displayName: 'X', coordinates: { lat: 37, lng: -5 }, municipio: 'X',
}

function def(id: string, fetch: DatasetDef['fetch']): DatasetDef {
  return {
    id: id as DatasetDef['id'], category: 'hazard',
    source: { name: 's' }, mapRole: 'none', aiAllowed: true,
    audienceWeight: { resident_owner: 1, buyer_investor: 1 },
    defaultOrder: 1, appliesTo: () => true, fetch,
  }
}

describe('profile orchestrator', () => {
  it('marks loading immediately, then reports settled results', async () => {
    const events: Array<[string, string]> = []
    const cb = { onResult: (id: string, r: { status: string }) => events.push([id, r.status]) }
    await runProfile(loc, [
      def('flood', async () => ({ status: 'available', data: 1 })),
      def('drought', async () => ({ status: 'unavailable' })),
    ], cb)
    expect(events.slice(0, 2)).toEqual([['flood', 'loading'], ['drought', 'loading']])
    expect(events).toContainEqual(['flood', 'available'])
    expect(events).toContainEqual(['drought', 'unavailable'])
  })

  it('one failing fetch never blocks or breaks the others', async () => {
    const results: Record<string, string> = {}
    await runProfile(loc, [
      def('flood', async () => { throw new Error('boom') }),
      def('drought', async () => ({ status: 'available', data: 2 })),
    ], { onResult: (id, r) => { results[id] = r.status } })
    expect(results.flood).toBe('error')
    expect(results.drought).toBe('available')
  })

  it('does not wait for slow sources to report fast ones', async () => {
    vi.useFakeTimers()
    const seen: string[] = []
    const p = runProfile(loc, [
      def('flood', () => new Promise(res => setTimeout(() => res({ status: 'available' }), 5000))),
      def('drought', async () => ({ status: 'available' })),
    ], { onResult: (id, r) => { if (r.status !== 'loading') seen.push(id) } })
    await vi.advanceTimersByTimeAsync(0)
    expect(seen).toEqual(['drought'])
    await vi.advanceTimersByTimeAsync(5000)
    await p
    expect(seen).toEqual(['drought', 'flood'])
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/services/orchestrator` — Expected: FAIL.
- [ ] **Step 3: Implement** — `app/src/services/orchestrator.ts`:

```typescript
import type { SearchResult } from '../types'
import type { DatasetId, DatasetResult } from '../types/workspace'
import type { DatasetDef } from '../registry/datasets'

export interface OrchestratorCallbacks {
  onResult: (id: DatasetId, result: DatasetResult) => void
}

export async function runProfile(
  location: SearchResult,
  datasets: DatasetDef[],
  cb: OrchestratorCallbacks,
): Promise<void> {
  for (const d of datasets) cb.onResult(d.id, { status: 'loading' })
  await Promise.all(
    datasets.map(async d => {
      try {
        cb.onResult(d.id, await d.fetch(location))
      } catch (e) {
        cb.onResult(d.id, { status: 'error', error: e instanceof Error ? e.message : String(e) })
      }
    }),
  )
}
```

- [ ] **Step 4: Run** — `npx vitest run src/services/orchestrator` — Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add incremental profile orchestrator"`

---

### Task 8: Shareable route state

**Files:**
- Create: `app/src/services/route.ts`
- Test: `app/src/services/route.test.ts`

**Interfaces:**
- Consumes: `Audience`, `DatasetId`, `PanelMode` types; `ALL_DATASET_IDS`.
- Produces:

```typescript
export interface RouteState {
  q?: string          // display name of the searched place
  lat?: number
  lng?: number
  aud?: Audience
  ds?: DatasetId
  mode?: PanelMode    // AI text itself is never in the URL — only the mode
}
export function parseRoute(search: string): RouteState        // invalid params dropped, never throws
export function serializeRoute(state: RouteState): string     // '' when empty, else '?...'
```

Task 16 wires these to `history.replaceState` on store changes and reads them on boot.

- [ ] **Step 1: Write the failing test** — `app/src/services/route.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseRoute, serializeRoute } from './route'

describe('route state', () => {
  it('round-trips a full state', () => {
    const s = serializeRoute({ q: 'Sevilla', lat: 37.39, lng: -5.98, aud: 'buyer_investor', ds: 'flood', mode: 'ai' })
    expect(parseRoute(s)).toEqual({ q: 'Sevilla', lat: 37.39, lng: -5.98, aud: 'buyer_investor', ds: 'flood', mode: 'ai' })
  })
  it('drops unknown or malformed params safely', () => {
    expect(parseRoute('?aud=farmer&ds=nonsense&lat=abc&mode=chat&x=1')).toEqual({})
  })
  it('drops lat without lng and vice versa', () => {
    expect(parseRoute('?lat=37.1')).toEqual({})
  })
  it('serializes empty state to empty string', () => {
    expect(serializeRoute({})).toBe('')
  })
})
```

- [ ] **Step 2: Run to verify failure** — Expected: FAIL.
- [ ] **Step 3: Implement** — `app/src/services/route.ts`:

```typescript
import type { Audience, DatasetId, PanelMode } from '../types/workspace'
import { ALL_DATASET_IDS } from '../types/workspace'

export interface RouteState {
  q?: string
  lat?: number
  lng?: number
  aud?: Audience
  ds?: DatasetId
  mode?: PanelMode
}

const AUDIENCES: Audience[] = ['resident_owner', 'buyer_investor']

export function parseRoute(search: string): RouteState {
  const p = new URLSearchParams(search)
  const out: RouteState = {}
  const lat = Number(p.get('lat'))
  const lng = Number(p.get('lng'))
  if (p.has('lat') && p.has('lng') && Number.isFinite(lat) && Number.isFinite(lng)) {
    out.lat = lat
    out.lng = lng
    const q = p.get('q')
    if (q) out.q = q
  }
  const aud = p.get('aud')
  if (aud && AUDIENCES.includes(aud as Audience)) out.aud = aud as Audience
  const ds = p.get('ds')
  if (ds && ALL_DATASET_IDS.includes(ds as DatasetId)) out.ds = ds as DatasetId
  const mode = p.get('mode')
  if (mode === 'data' || mode === 'ai') out.mode = mode
  return out
}

export function serializeRoute(state: RouteState): string {
  const p = new URLSearchParams()
  if (state.lat !== undefined && state.lng !== undefined) {
    if (state.q) p.set('q', state.q)
    p.set('lat', String(state.lat))
    p.set('lng', String(state.lng))
  }
  if (state.aud) p.set('aud', state.aud)
  if (state.ds) p.set('ds', state.ds)
  if (state.mode) p.set('mode', state.mode)
  const s = p.toString()
  return s ? `?${s}` : ''
}
```

- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: add fail-safe shareable route state"`

---

### Task 9: AI interpretation service — serverless proxy + client

**Files:**
- Create: `app/server/interpretCore.ts` (shared logic — SDK call, system prompt, schema)
- Create: `app/api/interpret.ts` (Vercel serverless handler)
- Modify: `app/vite.config.ts` (dev middleware serving `/api/interpret` from `interpretCore`)
- Create: `app/vercel.json`
- Rewrite: `app/src/services/ai.ts` (client: builds evidence, POSTs to `/api/interpret`; no API key)
- Modify: `app/.env.example` (replace `VITE_ANTHROPIC_API_KEY` with `ANTHROPIC_API_KEY`; note `ANTHROPIC_MODEL` optional). Ask the user to move their key in `.env.local` from `VITE_ANTHROPIC_API_KEY` to `ANTHROPIC_API_KEY` (Vite loads both; only non-`VITE_` vars stay server-side).
- Test: `app/server/interpretCore.test.ts`, `app/src/services/ai.test.ts`

**Interfaces:**
- Consumes: `Audience`, `DatasetId`, `DatasetStatus`, `Language`, store (`setInterpretation`, gating rules).
- Produces (wire contract both sides share — define in `interpretCore.ts`, client imports the types only):

```typescript
export interface EvidenceItem { id: DatasetId; status: DatasetStatus; summary: string }
export interface InterpretRequest {
  language: 'en' | 'es'
  audience: Audience | null
  scope: 'location' | DatasetId
  location: { name: string; municipio?: string; provincia?: string; basin?: string }
  evidence: EvidenceItem[]           // client-built plain-text summaries of public data
}
export interface InterpretResponse { interpretation: string; questions: string[] }
export function buildSystemPrompt(req: InterpretRequest): string   // pure, tested
export async function interpret(req: InterpretRequest, apiKey: string): Promise<InterpretResponse>
```

Client side (`app/src/services/ai.ts`):

```typescript
export function buildEvidence(results: Partial<Record<DatasetId, DatasetResult>>, language: Language): EvidenceItem[]  // pure, tested
export async function requestInterpretation(scope: InterpretationScope): Promise<void>
// requestInterpretation reads the store, refuses (sets error state with i18n key 'ai.unsupported')
// when coverage is unsupported, sets status 'loading', POSTs /api/interpret, sets 'ready' | 'error'.
```

- [ ] **Step 1: Install server deps**

```bash
npm install @anthropic-ai/sdk zod && npm install -D @vercel/node
```

- [ ] **Step 2: Write the failing server test** — `app/server/interpretCore.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildSystemPrompt } from './interpretCore'
import type { InterpretRequest } from './interpretCore'

const base: InterpretRequest = {
  language: 'en', audience: 'buyer_investor', scope: 'flood',
  location: { name: 'Sevilla', municipio: 'Sevilla', basin: 'guadalquivir' },
  evidence: [{ id: 'flood', status: 'available', summary: 'Outside mapped T10/T100/T500 zones' }],
}

describe('interpretation system prompt', () => {
  it('embeds the safety rules', () => {
    const p = buildSystemPrompt(base)
    expect(p).toMatch(/cite|name the public data/i)
    expect(p).toMatch(/never.*overall risk score/i)
    expect(p).toMatch(/not.*legal, financial or safety certainty/i)
  })
  it('uses audience only for emphasis and includes it when present', () => {
    expect(buildSystemPrompt(base)).toContain('buyer or investor')
    expect(buildSystemPrompt({ ...base, audience: null })).not.toContain('buyer or investor')
  })
  it('instructs Spanish output when language is es', () => {
    expect(buildSystemPrompt({ ...base, language: 'es' })).toMatch(/in Spanish/)
  })
})
```

- [ ] **Step 3: Run to verify failure**, then implement `app/server/interpretCore.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'

export interface EvidenceItem {
  id: string
  status: string
  summary: string
}

export interface InterpretRequest {
  language: 'en' | 'es'
  audience: 'resident_owner' | 'buyer_investor' | null
  scope: string // 'location' or a dataset id
  location: { name: string; municipio?: string; provincia?: string; basin?: string }
  evidence: EvidenceItem[]
}

export interface InterpretResponse {
  interpretation: string
  questions: string[]
}

const AUDIENCE_FRAMING: Record<'resident_owner' | 'buyer_investor', string> = {
  resident_owner:
    'The reader lives in or operates from this location (resident or owner). Frame practically: what to check, what to ask, who to contact (ayuntamiento, water utility). Do not raise resale value or legal-disclosure framing unless the evidence makes it clearly relevant.',
  buyer_investor:
    'The reader is a buyer or investor assessing this location before deciding. Lead with legal and insurance implications where the evidence supports them (nota simple, SNCZI flood zone, Consorcio de Compensación de Seguros); suggest consulting a gestor or abogado for cadastral detail.',
}

export function buildSystemPrompt(req: InterpretRequest): string {
  const lines = [
    'You interpret Spanish public water-risk data for one location. Follow these rules strictly:',
    '- Always cite or name the public data used (the sources are in the evidence list).',
    '- Distinguish direct findings from inference.',
    '- Keep every stated source limitation intact; do not soften it.',
    '- Do not offer legal, financial or safety certainty. Suggest verification paths instead.',
    '- If the evidence cannot answer something, say so plainly.',
    '- Never invent an aggregate "overall risk score" or a combined rating.',
    '- Interpret only the evidence provided. Do not infer values for datasets that are unavailable, unsupported or errored.',
    req.audience ? AUDIENCE_FRAMING[req.audience].replace('resident or owner', 'resident or owner').replace('buyer or investor', 'buyer or investor') : '',
    req.audience === 'buyer_investor' ? 'Audience: buyer or investor.' : '',
    req.audience === 'resident_owner' ? 'Audience: resident or owner.' : '',
    req.language === 'es'
      ? 'Respond in Spanish. Keep Spanish technical/institutional terms as-is.'
      : 'Respond in English. Translate Spanish technical terms with the original in parentheses.',
    'Write a concise interpretation (120-200 words) followed by 3 useful follow-up questions the reader could ask.',
  ]
  return lines.filter(Boolean).join('\n')
}

const ResponseSchema = z.object({
  interpretation: z.string(),
  questions: z.array(z.string()),
})

export async function interpret(req: InterpretRequest, apiKey: string): Promise<InterpretResponse> {
  const client = new Anthropic({ apiKey })
  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'
  const scopeLine =
    req.scope === 'location'
      ? 'Interpret the overall picture for this location.'
      : `Focus on the "${req.scope}" dataset result; mention others only where directly relevant.`
  const response = await client.messages.parse({
    model,
    max_tokens: 1000,
    system: buildSystemPrompt(req),
    messages: [
      {
        role: 'user',
        content: [
          `Location: ${req.location.name}`,
          req.location.municipio ? `Municipality: ${req.location.municipio}` : '',
          req.location.provincia ? `Province: ${req.location.provincia}` : '',
          req.location.basin ? `River basin: ${req.location.basin}` : '',
          scopeLine,
          'Public data evidence:',
          ...req.evidence.map(e => `- [${e.id}] (${e.status}) ${e.summary}`),
        ].filter(Boolean).join('\n'),
      },
    ],
    output_config: { format: zodOutputFormat(ResponseSchema) },
  })
  if (!response.parsed_output) throw new Error('Model returned unparseable output')
  return response.parsed_output
}
```

Run the server test — Expected: PASS. (If the exact prompt-regex assertions mismatch, adjust the prompt wording — not the safety rules — until they pass.)

- [ ] **Step 4: Create the Vercel handler** — `app/api/interpret.ts`:

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { interpret, type InterpretRequest } from '../server/interpretCore'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  const body = req.body as InterpretRequest
  if (!body?.language || !body?.scope || !Array.isArray(body?.evidence) || body.evidence.length === 0) {
    return res.status(400).json({ error: 'Invalid request' })
  }
  try {
    res.status(200).json(await interpret(body, apiKey))
  } catch (e) {
    console.error('interpret failed:', e)
    res.status(502).json({ error: 'Interpretation service unavailable' })
  }
}
```

`app/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

- [ ] **Step 5: Add the Vite dev middleware.** In `app/vite.config.ts`, add a plugin so `npm run dev` serves the same endpoint:

```typescript
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

function interpretDevEndpoint(env: Record<string, string>): Plugin {
  return {
    name: 'interpret-dev-endpoint',
    configureServer(server) {
      server.middlewares.use('/api/interpret', async (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        try {
          const { interpret } = await server.ssrLoadModule('/server/interpretCore.ts')
          const apiKey = env.ANTHROPIC_API_KEY
          if (!apiKey) { res.statusCode = 500; return res.end(JSON.stringify({ error: 'ANTHROPIC_API_KEY not set' })) }
          const body = JSON.parse(Buffer.concat(chunks).toString())
          const out = await interpret(body, apiKey)
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(out))
        } catch (e) {
          res.statusCode = 502
          res.end(JSON.stringify({ error: String(e) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), tailwindcss(), interpretDevEndpoint(env)] }
})
```

(Preserve whatever plugins the existing `vite.config.ts` already registers — merge, don't drop.)

- [ ] **Step 6: Write the failing client test** — `app/src/services/ai.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildEvidence, requestInterpretation } from './ai'
import { useAppStore } from '../store/useAppStore'
import type { SearchResult } from '../types'

const sevilla: SearchResult = {
  displayName: 'Sevilla', coordinates: { lat: 37.39, lng: -5.98 },
  municipio: 'Sevilla', provincia: 'Sevilla', basin: 'guadalquivir',
}
const madrid: SearchResult = {
  displayName: 'Madrid', coordinates: { lat: 40.42, lng: -3.70 },
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState())
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(() => vi.unstubAllGlobals())

describe('buildEvidence', () => {
  it('summarizes available results and passes through non-safe statuses without values', () => {
    const ev = buildEvidence({
      flood: { status: 'available', data: { inZone: false, source: 'SNCZI' } },
      drought: { status: 'error', error: 'timeout' },
    }, 'en')
    const flood = ev.find(e => e.id === 'flood')!
    const drought = ev.find(e => e.id === 'drought')!
    expect(flood.status).toBe('available')
    expect(flood.summary.length).toBeGreaterThan(0)
    expect(drought.status).toBe('error')
    expect(drought.summary).not.toMatch(/low|none|safe/i)
  })
})

describe('requestInterpretation gating', () => {
  it('never issues a request for an unsupported location', async () => {
    useAppStore.getState().beginSearch(madrid)
    await requestInterpretation({ type: 'location' })
    expect(fetch).not.toHaveBeenCalled()
    expect(useAppStore.getState().interpretation.status).toBe('error')
  })

  it('posts structured evidence and stores the result', async () => {
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().setResult('flood', { status: 'available', data: { inZone: false, source: 'SNCZI' } })
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ interpretation: 'Calm words.', questions: ['q1', 'q2'] }),
    })
    await requestInterpretation({ type: 'dataset', id: 'flood' })
    expect(fetch).toHaveBeenCalledWith('/api/interpret', expect.objectContaining({ method: 'POST' }))
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.scope).toBe('flood')
    expect(body.evidence.length).toBeGreaterThan(0)
    const s = useAppStore.getState().interpretation
    expect(s.status).toBe('ready')
    expect(s.text).toBe('Calm words.')
    expect(s.questions).toEqual(['q1', 'q2'])
  })

  it('sets error state on a failed proxy response', async () => {
    useAppStore.getState().beginSearch(sevilla)
    useAppStore.getState().setResult('flood', { status: 'available', data: { inZone: false, source: 'SNCZI' } })
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 502 })
    await requestInterpretation({ type: 'location' })
    expect(useAppStore.getState().interpretation.status).toBe('error')
  })
})
```

- [ ] **Step 7: Rewrite the client** — `app/src/services/ai.ts` (full replacement; the old direct-API code and `VITE_ANTHROPIC_API_KEY` go away):

```typescript
import type { Language } from '../types'
import type { DatasetId, DatasetResult, InterpretationScope } from '../types/workspace'
import { useAppStore } from '../store/useAppStore'
import type {
  FloodZoneResult, DroughtStatus, Reservoir, WaterQualityResult,
  CoastalFloodResult, GroundwaterResult, BathingWaterResult,
} from '../types'

export interface EvidenceItem { id: DatasetId; status: string; summary: string }

function summarize(id: DatasetId, r: DatasetResult, _lang: Language): string {
  if (r.status !== 'available') {
    // Evidence for non-values carries the state, never an implied value.
    return `No usable value (${r.status}).`
  }
  switch (id) {
    case 'flood': {
      const d = r.data as FloodZoneResult
      return d.inZone
        ? `Inside mapped flood zone, return period T${d.returnPeriod} (source SNCZI).`
        : 'Outside the mapped T10, T100 and T500 river-flood zones (source SNCZI).'
    }
    case 'drought': {
      const d = r.data as DroughtStatus
      return `Combined Drought Indicator level: ${d.level} (source Copernicus EDO, ${d.updatedAt}).`
    }
    case 'reservoirs': {
      const rs = r.data as Reservoir[]
      return `Nearby reservoirs: ${rs.map(x => `${x.name} ${x.fillPercent}% full (mean ${x.historicalMeanPercent ?? '?'}%)`).join('; ')} (source REDIAM).`
    }
    case 'waterQuality': {
      const d = r.data as WaterQualityResult
      return `SINAC ${d.year} drinking-water compliance: ${d.compliance}; source type ${d.sourceType}.`
    }
    case 'coastalFlood': {
      const d = r.data as CoastalFloodResult
      return `Coastal DPH: ${d.inServidumbre ? 'inside 20 m servidumbre strip' : 'outside 20 m strip'}; ${d.inPolicia ? 'inside 100 m zone' : 'outside 100 m zone'} (source MITERD).`
    }
    case 'groundwater': {
      const d = r.data as GroundwaterResult
      return d.inOverexploitedUnit
        ? `Inside overexploited hydrogeological unit ${d.unitName ?? ''} (source IGME).`
        : 'Not inside a declared overexploited hydrogeological unit (source IGME).'
    }
    case 'bathingWater': {
      const d = r.data as BathingWaterResult
      return `Nearest bathing site ${d.siteName} at ${d.distanceKm} km, quality ${d.quality} (source EEA).`
    }
  }
}

export function buildEvidence(
  results: Partial<Record<DatasetId, DatasetResult>>,
  language: Language,
): EvidenceItem[] {
  return (Object.entries(results) as Array<[DatasetId, DatasetResult]>)
    .filter(([, r]) => r.status !== 'loading' && r.status !== 'not_applicable')
    .map(([id, r]) => ({ id, status: r.status, summary: summarize(id, r, language) }))
}

export async function requestInterpretation(scope: InterpretationScope): Promise<void> {
  const s = useAppStore.getState()
  if (!s.location || !s.coverage?.supported) {
    s.setInterpretation({ status: 'error', scope, text: undefined, questions: undefined })
    return
  }
  const evidence = buildEvidence(s.results, s.language)
  if (evidence.length === 0) {
    s.setInterpretation({ status: 'error', scope })
    return
  }
  s.setInterpretation({ status: 'loading', scope, language: s.language })
  try {
    const res = await fetch('/api/interpret', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        language: s.language,
        audience: s.audience,
        scope: scope.type === 'dataset' ? scope.id : 'location',
        location: {
          name: s.location.municipio || s.location.displayName,
          municipio: s.location.municipio,
          provincia: s.location.provincia,
          basin: s.location.basin,
        },
        evidence,
      }),
    })
    if (!res.ok) throw new Error(`Proxy error ${res.status}`)
    const out = (await res.json()) as { interpretation: string; questions: string[] }
    useAppStore.getState().setInterpretation({
      status: 'ready', scope, text: out.interpretation, questions: out.questions,
      basis: evidence.map(e => e.id), language: s.language,
    })
  } catch {
    useAppStore.getState().setInterpretation({ status: 'error', scope })
  }
}
```

Note: `bathingWater` quality field — check `app/src/types/index.ts` `BathingWaterResult` for the exact property name (`quality` vs `qualityStatus`) and use the real one.

- [ ] **Step 8: Update `.env.example`** to:

```
# Server-side only — used by /api/interpret (Vercel function or Vite dev middleware)
ANTHROPIC_API_KEY=sk-ant-...
# Optional override; defaults to claude-haiku-4-5
# ANTHROPIC_MODEL=claude-haiku-4-5
```

- [ ] **Step 9: Verify** — `npx vitest run && npx tsc --noEmit && npm run build` — Expected: pass. `grep -rn "VITE_ANTHROPIC" src/` — Expected: no matches.
- [ ] **Step 10: Commit** — `git add -A && git commit -m "feat: move AI interpretation behind serverless proxy with structured evidence"`

---

### Task 10: Basemap, coverage layer, and map bootstrap

**Files:**
- Create: `app/src/map/basemapStyle.ts` (pure transform + fetch)
- Create: `app/src/map/coverageLayers.ts`
- Rewrite: `app/src/components/Map/MapView.tsx` (bootstrap only in this task; data layers arrive in Task 11)
- Test: `app/src/map/basemapStyle.test.ts`

**Interfaces:**
- Consumes: `getCoverageGeoJSON()` (Task 4); store (`view`, `location`).
- Produces:

```typescript
// basemapStyle.ts
export const BASEMAP_URL = 'https://tiles.openfreemap.org/styles/positron'
export function quietFocusTransform(style: maplibregl.StyleSpecification): maplibregl.StyleSpecification
// - removes layers whose id includes 'poi'
// - halves icon/text opacity of transportation label layers where present
// - never touches water, boundary or place-label layers
export async function loadQuietFocusStyle(): Promise<maplibregl.StyleSpecification> // fetch + transform

// coverageLayers.ts
export function addCoverageLayers(map: maplibregl.Map): void
// adds source 'coverage' + layers: 'coverage-fill' (coverage green, fill-opacity 0.15),
// 'coverage-glow' (line, color coverage green, width 8, blur 6, opacity 0.35),
// 'coverage-line' (line, width 1.5, opacity 0.8)
export const ENTRY_CENTER: [number, number] = [-4.6, 37.4]
export const ENTRY_ZOOM = 6.3
```

MapView responsibilities this task: create the map once with the quiet style, add nav/scale/attribution controls, add coverage layers on load, expose the map instance via a module-level ref other components can import (`app/src/map/mapRef.ts` exporting `export const mapRef: { current: maplibregl.Map | null }`), and fly/jump (reduced-motion aware, ≤1200 ms) to `location` when `view` becomes `searched`, back to the entry frame on `goHome`.

- [ ] **Step 1: Write the failing transform test** — `app/src/map/basemapStyle.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { quietFocusTransform } from './basemapStyle'

const style = {
  version: 8 as const, sources: {}, layers: [
    { id: 'water', type: 'fill' as const },
    { id: 'poi_label', type: 'symbol' as const },
    { id: 'poi-level-1', type: 'symbol' as const },
    { id: 'place_city', type: 'symbol' as const },
    { id: 'boundary_state', type: 'line' as const },
  ],
}

describe('quiet focus basemap transform', () => {
  it('removes POI layers', () => {
    const out = quietFocusTransform(style as never)
    expect(out.layers.map(l => l.id)).toEqual(['water', 'place_city', 'boundary_state'])
  })
  it('keeps water, places and boundaries untouched', () => {
    const out = quietFocusTransform(style as never)
    expect(out.layers.find(l => l.id === 'water')).toEqual({ id: 'water', type: 'fill' })
  })
})
```

- [ ] **Step 2: Run to verify failure**, then implement `basemapStyle.ts`:

```typescript
import type maplibregl from 'maplibre-gl'

export const BASEMAP_URL = 'https://tiles.openfreemap.org/styles/positron'

export function quietFocusTransform(
  style: maplibregl.StyleSpecification,
): maplibregl.StyleSpecification {
  return {
    ...style,
    layers: style.layers.filter(l => !l.id.toLowerCase().includes('poi')),
  }
}

export async function loadQuietFocusStyle(): Promise<maplibregl.StyleSpecification> {
  const res = await fetch(BASEMAP_URL)
  if (!res.ok) throw new Error(`Basemap style fetch failed: ${res.status}`)
  return quietFocusTransform(await res.json())
}
```

- [ ] **Step 3: Implement `coverageLayers.ts` and `mapRef.ts`:**

```typescript
// app/src/map/mapRef.ts
import type maplibregl from 'maplibre-gl'
export const mapRef: { current: maplibregl.Map | null } = { current: null }
```

```typescript
// app/src/map/coverageLayers.ts
import type maplibregl from 'maplibre-gl'
import { getCoverageGeoJSON } from '../services/coverage'

export const ENTRY_CENTER: [number, number] = [-4.6, 37.4]
export const ENTRY_ZOOM = 6.3
const COVERAGE_GREEN = '#7FA38C'

export function addCoverageLayers(map: maplibregl.Map): void {
  if (map.getSource('coverage')) return
  map.addSource('coverage', { type: 'geojson', data: getCoverageGeoJSON() })
  map.addLayer({
    id: 'coverage-fill', type: 'fill', source: 'coverage',
    paint: { 'fill-color': COVERAGE_GREEN, 'fill-opacity': 0.15 },
  })
  map.addLayer({
    id: 'coverage-glow', type: 'line', source: 'coverage',
    paint: { 'line-color': COVERAGE_GREEN, 'line-width': 8, 'line-blur': 6, 'line-opacity': 0.35 },
  })
  map.addLayer({
    id: 'coverage-line', type: 'line', source: 'coverage',
    paint: { 'line-color': COVERAGE_GREEN, 'line-width': 1.5, 'line-opacity': 0.8 },
  })
}
```

- [ ] **Step 4: Rewrite `MapView.tsx`:**

```typescript
import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useAppStore } from '../../store/useAppStore'
import { loadQuietFocusStyle, BASEMAP_URL } from '../../map/basemapStyle'
import { addCoverageLayers, ENTRY_CENTER, ENTRY_ZOOM } from '../../map/coverageLayers'
import { mapRef } from '../../map/mapRef'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const view = useAppStore(s => s.view)
  const location = useAppStore(s => s.location)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false
    ;(async () => {
      let style: maplibregl.StyleSpecification | string
      try { style = await loadQuietFocusStyle() } catch { style = BASEMAP_URL }
      if (cancelled || !containerRef.current) return
      const map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: ENTRY_CENTER,
        zoom: ENTRY_ZOOM,
        attributionControl: false,
        pitchWithRotate: false,
        maxPitch: 0,
      })
      map.addControl(new maplibregl.AttributionControl({
        compact: true,
        customAttribution:
          '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> · ' +
          '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap</a>',
      }), 'bottom-right')
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      map.addControl(new maplibregl.ScaleControl(), 'bottom-left')
      map.on('load', () => addCoverageLayers(map))
      mapRef.current = map
    })()
    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Camera follows workspace state
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (view === 'searched' && location) {
      const { lat, lng } = location.coordinates
      markerRef.current?.remove()
      const el = document.createElement('div')
      el.style.cssText =
        'width:20px;height:20px;border-radius:50% 50% 50% 0;background:#285F77;' +
        'border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(32,49,42,.35)'
      markerRef.current = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([lng, lat]).addTo(map)
      if (prefersReducedMotion()) map.jumpTo({ center: [lng, lat], zoom: 11 })
      else map.flyTo({ center: [lng, lat], zoom: 11, duration: 1200, essential: true })
    } else if (view === 'entry') {
      markerRef.current?.remove()
      markerRef.current = null
      if (prefersReducedMotion()) map.jumpTo({ center: ENTRY_CENTER, zoom: ENTRY_ZOOM })
      else map.flyTo({ center: ENTRY_CENTER, zoom: ENTRY_ZOOM, duration: 900 })
    }
  }, [view, location])

  return <div ref={containerRef} className="absolute inset-0" aria-label="Map" role="application" />
}
```

- [ ] **Step 5: Mount it.** Update `App.tsx` placeholder to render the map full-bleed:

```typescript
import MapView from './components/Map/MapView'

export default function App() {
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <MapView />
    </div>
  )
}
```

- [ ] **Step 6: Verify** — `npx vitest run && npx tsc --noEmit && npm run build` — pass. Then `npm run dev`, open the app: Expected — pale Positron basemap without POI clutter, Andalucía filled/outlined in coverage green with a soft glow.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: quiet-focus basemap, coverage layer and map bootstrap"`

---

### Task 11: Map layer manager (data layers, hover, selection)

**Files:**
- Create: `app/src/map/layerPlan.ts` (pure — tested)
- Create: `app/src/map/dataLayers.ts` (imperative: add sources/layers once, apply plan, hover + click)
- Modify: `app/src/components/Map/MapView.tsx` (call `ensureDataLayers` on load; apply plan on store changes)
- Test: `app/src/map/layerPlan.test.ts`

**Interfaces:**
- Consumes: store (`primaryLayer`, `contextLayers`, `selectDataset`), services (`getSNCZIWmsUrl`, `SNCZI_LAYERS`, `getDroughtWmsUrl`, `getAllReservoirsGeoJSON`, `getCoastalWmsUrl`, `COASTAL_LAYERS`), `app/src/data/groundwater-units.json`.
- Produces:

```typescript
// layerPlan.ts
export const DATASET_MAP_LAYERS: Record<DatasetId, string[]> = {
  flood: ['flood-t500', 'flood-t100', 'flood-t10'],
  drought: ['drought-layer'],
  coastalFlood: ['coastal-servidumbre', 'coastal-policia'],
  groundwater: ['groundwater-fill', 'groundwater-line'],
  reservoirs: ['reservoirs-halo', 'reservoirs-circle', 'reservoirs-label', 'reservoirs-name'],
  waterQuality: [],
  bathingWater: [],
}
export function visibleLayerIds(primary: DatasetId | null, context: DatasetId[]): Set<string>

// dataLayers.ts
export function ensureDataLayers(map: maplibregl.Map): void   // idempotent; adds all sources+layers hidden
export function applyLayerPlan(map: maplibregl.Map, primary: DatasetId | null, context: DatasetId[]): void
export function bindMapInteractions(map: maplibregl.Map): void
```

Layer specs in `ensureDataLayers` (all `layout.visibility: 'none'` initially):
- Flood: 3 raster sources from `getSNCZIWmsUrl(SNCZI_LAYERS.T500|T100|T10)`, opacities 0.35/0.40/0.45 (spec §8.9 raster range).
- Drought: raster from `getDroughtWmsUrl()`, opacity 0.45.
- Coastal: 2 rasters from `getCoastalWmsUrl(COASTAL_LAYERS.servidumbre|policia)`, opacity 0.40.
- Groundwater: geojson source from `groundwater-units.json`; fill layer color warning `#B87535` opacity 0.25 + line 1.5 px same color.
- Reservoirs: port the four layers verbatim from the pre-rewrite `MapView.tsx` (git history at `2fcce18:app/src/components/Map/MapView.tsx` — halo/circle/label/name with `fillColour` data-driven color), PLUS `minzoom: 8` on all four (progressive disclosure §8.5), and replace the old HTML popup with hover behavior below.

`bindMapInteractions`: on `mouseenter reservoirs-circle` show a small `maplibregl.Popup({ closeButton: false, maxWidth: '200px' })` with ONLY name + fill % + i18n hint `map.hoverHint` ("Select for detail"); remove on `mouseleave`. On `click reservoirs-circle` call `useAppStore.getState().selectDataset('reservoirs')` and set a 3px `circle-stroke-width` on the clicked feature via `setFeatureState`/`'case'` on `feature-state selected` (selection emphasis, non-colour cue = thicker stroke). Long popups: none anywhere.

- [ ] **Step 1: Write the failing test** — `app/src/map/layerPlan.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { visibleLayerIds, DATASET_MAP_LAYERS } from './layerPlan'

describe('layer plan', () => {
  it('no primary layer -> only context layers visible', () => {
    const v = visibleLayerIds(null, ['reservoirs'])
    expect(v).toEqual(new Set(DATASET_MAP_LAYERS.reservoirs))
  })
  it('exactly one primary at a time', () => {
    const v = visibleLayerIds('flood', [])
    expect(v).toEqual(new Set(DATASET_MAP_LAYERS.flood))
    const w = visibleLayerIds('drought', [])
    expect([...w].some(id => id.startsWith('flood'))).toBe(false)
  })
  it('panel-only datasets contribute no layers', () => {
    expect(visibleLayerIds('flood', []).size + DATASET_MAP_LAYERS.waterQuality.length)
      .toBe(visibleLayerIds('flood', []).size)
  })
  it('primary plus contexts combine', () => {
    const v = visibleLayerIds('groundwater', ['reservoirs'])
    expect(v.has('groundwater-fill')).toBe(true)
    expect(v.has('reservoirs-circle')).toBe(true)
  })
})
```

- [ ] **Step 2: Run to verify failure**, then implement `layerPlan.ts`:

```typescript
import type { DatasetId } from '../types/workspace'

export const DATASET_MAP_LAYERS: Record<DatasetId, string[]> = {
  flood: ['flood-t500', 'flood-t100', 'flood-t10'],
  drought: ['drought-layer'],
  coastalFlood: ['coastal-servidumbre', 'coastal-policia'],
  groundwater: ['groundwater-fill', 'groundwater-line'],
  reservoirs: ['reservoirs-halo', 'reservoirs-circle', 'reservoirs-label', 'reservoirs-name'],
  waterQuality: [],
  bathingWater: [],
}

export function visibleLayerIds(primary: DatasetId | null, context: DatasetId[]): Set<string> {
  const ids = new Set<string>()
  if (primary) for (const id of DATASET_MAP_LAYERS[primary]) ids.add(id)
  for (const c of context) for (const id of DATASET_MAP_LAYERS[c]) ids.add(id)
  return ids
}
```

- [ ] **Step 3: Implement `dataLayers.ts`** per the layer specs above. `applyLayerPlan` iterates every id in `DATASET_MAP_LAYERS`, calling `map.setLayoutProperty(id, 'visibility', plan.has(id) ? 'visible' : 'none')` guarded by `map.getLayer(id)`.
- [ ] **Step 4: Wire into `MapView.tsx`** — inside `map.on('load')` call `ensureDataLayers(map); bindMapInteractions(map)`, and add an effect:

```typescript
const primaryLayer = useAppStore(s => s.primaryLayer)
const contextLayers = useAppStore(s => s.contextLayers)
useEffect(() => {
  const map = mapRef.current
  if (!map || !map.isStyleLoaded()) return
  applyLayerPlan(map, primaryLayer, contextLayers)
}, [primaryLayer, contextLayers])
```

Also handle the race where the style isn't loaded yet: in `map.on('load')`, apply the current store plan once.
- [ ] **Step 5: Verify** — tests + typecheck + build pass; `npm run dev`: selecting nothing shows reservoir points only past zoom 8; no flood/drought rasters until a primary layer is set (Task 12's tray will drive this — for a manual check run `useAppStore.getState().setPrimaryLayer('flood')` in the browser console).
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: registry-driven map layer manager with hover and selection"`

---

### Task 12: Layer tray and legend

**Files:**
- Create: `app/src/components/Map/LayerTray.tsx`
- Create: `app/src/components/Map/Legend.tsx`
- Modify: `app/src/App.tsx` (mount both over the map)
- Modify: i18n files (add `layers.*`, `legend.*` blocks)
- Test: `app/src/components/Map/LayerTray.test.tsx`

**Interfaces:**
- Consumes: store (`primaryLayer`, `setPrimaryLayer`, `contextLayers`, `toggleContextLayer`, `view`), `DATASETS` (mapRole, i18n names), registry i18n (`registry.<id>.name`, `.cadence`), sources.
- Produces: a closed control reading `t('layers.button', { n })` ("Map layers · {n}") where `n = (primaryLayer ? 1 : 0) + contextLayers.length`; an open tray with a radiogroup ("None" + the four primary datasets) and checkboxes for context datasets, showing `t('layers.readabilityWarning')` when 2 context overlays are active. Legend renders only when a primary layer is active: dataset name, category ramp/symbols, source name, cadence.

i18n additions (both languages — ES values in parentheses here, write real JSON):

```json
"layers": {
  "button": "Map layers · {{n}}",
  "primaryHeading": "Primary risk layer",
  "contextHeading": "Context",
  "none": "None",
  "readabilityWarning": "Two overlays can make the map harder to read.",
  "close": "Close"
},
"legend": {
  "source": "Source: {{source}}",
  "flood": { "t10": "10-year zone", "t100": "100-year zone", "t500": "500-year zone" },
  "drought": { "title": "Combined Drought Indicator", "watch": "Watch", "warning": "Warning", "alert": "Alert" },
  "coastalFlood": { "servidumbre": "20 m servidumbre", "policia": "100 m zone" },
  "groundwater": { "over": "Declared overexploited unit" },
  "reservoirs": { "title": "Reservoir fill", "low": "<25%", "mid": "25–60%", "high": ">60%" }
},
"map": { "hoverHint": "Select for detail" }
```

(ES: "Capas del mapa · {{n}}", "Capa de riesgo principal", "Contexto", "Ninguna", "Dos capas superpuestas pueden dificultar la lectura del mapa.", "Cerrar", "Fuente: {{source}}", "Zona T10 (10 años)", etc. — translate each key faithfully.)

- [ ] **Step 1: Write the failing component test** — `app/src/components/Map/LayerTray.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import LayerTray from './LayerTray'
import { useAppStore } from '../../store/useAppStore'
import '../../i18n'

beforeEach(() => useAppStore.setState(useAppStore.getInitialState()))

describe('layer tray', () => {
  it('shows count of visible data layers', () => {
    render(<LayerTray />)
    // reservoirs context is on by default
    expect(screen.getByRole('button', { name: /map layers · 1/i })).toBeInTheDocument()
  })

  it('primary selection is a radio group — one active at most', async () => {
    const user = userEvent.setup()
    render(<LayerTray />)
    await user.click(screen.getByRole('button', { name: /map layers/i }))
    await user.click(screen.getByRole('radio', { name: /river flood zones/i }))
    expect(useAppStore.getState().primaryLayer).toBe('flood')
    await user.click(screen.getByRole('radio', { name: /drought status/i }))
    expect(useAppStore.getState().primaryLayer).toBe('drought')
    await user.click(screen.getByRole('radio', { name: /none/i }))
    expect(useAppStore.getState().primaryLayer).toBeNull()
  })

  it('context checkboxes toggle overlays', async () => {
    const user = userEvent.setup()
    render(<LayerTray />)
    await user.click(screen.getByRole('button', { name: /map layers/i }))
    await user.click(screen.getByRole('checkbox', { name: /nearby reservoirs/i }))
    expect(useAppStore.getState().contextLayers).toEqual([])
  })
})
```

- [ ] **Step 2: Run to verify failure**, then implement `LayerTray.tsx`:

```typescript
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '../../store/useAppStore'
import { DATASETS } from '../../registry/datasets'
import type { DatasetId } from '../../types/workspace'

export default function LayerTray() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const primaryLayer = useAppStore(s => s.primaryLayer)
  const contextLayers = useAppStore(s => s.contextLayers)
  const setPrimaryLayer = useAppStore(s => s.setPrimaryLayer)
  const toggleContextLayer = useAppStore(s => s.toggleContextLayer)

  const primaries = DATASETS.filter(d => d.mapRole === 'primary')
  const contexts = DATASETS.filter(d => d.mapRole === 'context')
  const n = (primaryLayer ? 1 : 0) + contextLayers.length

  return (
    <div className="absolute top-4 right-14 z-10">
      <button
        onClick={() => setOpen(o => !o)}
        className="min-h-11 rounded-lg bg-canvas px-3 py-2 text-sm font-bold text-ink shadow-md"
      >
        {t('layers.button', { n })}
      </button>
      {open && (
        <div className="mt-2 w-64 rounded-xl bg-canvas p-4 shadow-lg">
          <p className="mb-2 text-xs font-bold text-muted">{t('layers.primaryHeading')}</p>
          <div role="radiogroup" aria-label={t('layers.primaryHeading')}>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="radio" name="primary" checked={primaryLayer === null}
                onChange={() => setPrimaryLayer(null)} />
              {t('layers.none')}
            </label>
            {primaries.map(d => (
              <label key={d.id} className="flex min-h-11 items-center gap-2 text-sm">
                <input type="radio" name="primary" checked={primaryLayer === d.id}
                  onChange={() => setPrimaryLayer(d.id as DatasetId)} />
                {t(`registry.${d.id}.name`)}
              </label>
            ))}
          </div>
          <p className="mb-2 mt-3 text-xs font-bold text-muted">{t('layers.contextHeading')}</p>
          {contexts.map(d => (
            <label key={d.id} className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={contextLayers.includes(d.id)}
                onChange={() => toggleContextLayer(d.id)} />
              {t(`registry.${d.id}.name`)}
            </label>
          ))}
          {contextLayers.length >= 2 && (
            <p className="mt-2 text-xs text-warning">{t('layers.readabilityWarning')}</p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Implement `Legend.tsx`** — renders `null` when `primaryLayer === null`; otherwise a bottom-left card (`absolute bottom-8 left-4 rounded-xl bg-canvas/95 p-3 shadow-md text-xs`) with the dataset name (bold), the per-dataset rows (color swatch `<span className="inline-block h-3 w-3 rounded-sm" style={{background}} />` + label from `legend.*` keys; flood swatches `#4B91AD` at 3 opacities, drought watch/warning/alert `#EAB308/#B87535/#AD4942`, coastal `#4B91AD`, groundwater `#B87535`), then `t('legend.source', { source })` + `t('registry.<id>.cadence')` in muted text. Coverage keeps its own small key at entry (Task 13 renders it).
- [ ] **Step 4: Mount in `App.tsx`** (inside the relative container, after `<MapView />`): `<LayerTray />` and `<Legend />` render only when `view === 'searched'`.
- [ ] **Step 5: Add all `layers.*`, `legend.*`, `map.*` keys to BOTH i18n files** (Spanish translated properly).
- [ ] **Step 6: Verify** — `npx vitest run && npx tsc --noEmit && npm run build` — pass.
- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: add layer tray with primary/context discipline and dynamic legend"`

---

### Task 13: Entry state — floating search card, wash, fly-in

**Files:**
- Create: `app/src/components/Entry/EntryCard.tsx`
- Create: `app/src/components/Entry/useLocationSearch.ts` (debounced suggestion hook, extracted from old SearchBar logic — suggestions only, no fetching of datasets)
- Create: `app/src/components/Entry/CoverageKey.tsx`
- Modify: `app/src/App.tsx`
- Modify: i18n (add `entry.*` block)
- Test: `app/src/components/Entry/EntryCard.test.tsx`

**Interfaces:**
- Consumes: `geocodeAddress` (existing), store (`audience`, `setAudience`, `beginSearch`, `view`), orchestrator + registry (search submit starts the profile), Task 7 `runProfile`, Task 5 `orderedDatasets`.
- Produces: `submitLocation(result: SearchResult)` helper in `app/src/components/Entry/submitLocation.ts`:

```typescript
import type { SearchResult } from '../../types'
import { useAppStore } from '../../store/useAppStore'
import { orderedDatasets } from '../../registry/datasets'
import { runProfile } from '../../services/orchestrator'

export async function submitLocation(location: SearchResult): Promise<void> {
  const store = useAppStore.getState()
  store.beginSearch(location)
  const coverage = useAppStore.getState().coverage
  if (!coverage?.supported) return   // unsupported: no dataset fetches, no risk styling (§15.2)
  const datasets = orderedDatasets(location, useAppStore.getState().audience)
    .filter(d => coverage.datasets.includes(d.id))
  await runProfile(location, datasets, {
    onResult: (id, result) => useAppStore.getState().setResult(id, result),
  })
}
```

i18n `entry` block (EN; translate all for ES):

```json
"entry": {
  "heading": "Check water risks for a place in Spain",
  "supporting": "Public data on flooding, drought, reservoirs and water quality.",
  "locationLabel": "Postcode, town or address",
  "audiencePrompt": "What brings you here?",
  "optional": "Optional",
  "changeLater": "You can change this later",
  "resident": "I live or own here",
  "buyer": "I'm considering buying or investing",
  "submit": "Check this area",
  "exploreHint": "or just explore the map",
  "coverageNote": "Detailed results are available for Andalucía. Other regions will be added over time.",
  "keyAvailable": "Detailed data available",
  "keyUnavailable": "Not yet available",
  "noResults": "Location could not be found. Try a nearby town or a postcode."
}
```

(ES: "Consulta los riesgos hídricos de un lugar de España", "Datos públicos sobre inundaciones, sequía, embalses y calidad del agua.", "Código postal, municipio o dirección", "¿Qué te trae por aquí?", "Opcional", "Podrás cambiarlo más tarde", "Vivo aquí o soy propietario/a", "Estoy pensando en comprar o invertir", "Consultar esta zona", "o simplemente explora el mapa", "Hay resultados detallados para Andalucía. Otras regiones se añadirán con el tiempo.", "Datos detallados disponibles", "Aún no disponible", "No se ha encontrado la ubicación. Prueba con un municipio cercano o un código postal.")

- [ ] **Step 1: Write the failing test** — `app/src/components/Entry/EntryCard.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EntryCard from './EntryCard'
import { useAppStore } from '../../store/useAppStore'
import * as geocoding from '../../services/geocoding'
import '../../i18n'

vi.mock('../../services/geocoding')
vi.mock('../../services/orchestrator', () => ({ runProfile: vi.fn(async () => {}) }))

const sevilla = {
  displayName: 'Sevilla, Andalucía', coordinates: { lat: 37.39, lng: -5.98 },
  municipio: 'Sevilla', provincia: 'Sevilla', basin: 'guadalquivir' as const,
}

beforeEach(() => useAppStore.setState(useAppStore.getInitialState()))

describe('entry card', () => {
  it('renders literal copy with optional audience below the input', () => {
    render(<EntryCard />)
    expect(screen.getByRole('heading', { name: /check water risks/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/postcode, town or address/i)).toBeInTheDocument()
    expect(screen.getByText(/optional/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /i live or own here/i })).toBeInTheDocument()
  })

  it('search works without an audience', async () => {
    const user = userEvent.setup()
    vi.mocked(geocoding.geocodeAddress).mockResolvedValue([sevilla])
    render(<EntryCard />)
    await user.type(screen.getByLabelText(/postcode/i), 'Sevilla')
    await user.click(await screen.findByRole('option', { name: /sevilla/i }))
    expect(useAppStore.getState().view).toBe('searched')
    expect(useAppStore.getState().audience).toBeNull()
  })

  it('audience chips toggle and pass through as optional context', async () => {
    const user = userEvent.setup()
    render(<EntryCard />)
    await user.click(screen.getByRole('button', { name: /buying or investing/i }))
    expect(useAppStore.getState().audience).toBe('buyer_investor')
    await user.click(screen.getByRole('button', { name: /buying or investing/i }))
    expect(useAppStore.getState().audience).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**, then implement.

`useLocationSearch.ts` (port the debounce/suggestion logic from the deleted `SearchBar.tsx`, dropping all profile fetching):

```typescript
import { useRef, useState } from 'react'
import { geocodeAddress } from '../../services/geocoding'
import type { SearchResult } from '../../types'

export function useLocationSearch() {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [failed, setFailed] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onInput = (value: string) => {
    setQuery(value)
    setFailed(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (value.trim().length < 3) { setSuggestions([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await geocodeAddress(value)
        setSuggestions(results)
        setFailed(results.length === 0)
      } catch {
        setSuggestions([])
        setFailed(true)
      } finally {
        setSearching(false)
      }
    }, 350)
  }

  return { query, suggestions, searching, failed, onInput, clear: () => setSuggestions([]) }
}
```

`EntryCard.tsx` — a floating card (`absolute left-6 top-1/2 -translate-y-1/2 z-10 w-[380px] max-w-[calc(100vw-3rem)] rounded-2xl bg-canvas p-6 shadow-xl`) containing: `<h1 className="text-xl font-bold">` heading, supporting text (muted, sm), labelled input (id + `<label htmlFor>`), suggestion `<ul role="listbox">` with `<li role="option">` buttons calling `submitLocation(s)` + `clear()`, audience prompt row (`text-sm font-bold` + `text-xs text-muted` Optional badge), two toggle chip buttons (`aria-pressed`, selected style `bg-primary-soft border-primary`, unselected `border-gray-300`; clicking the active one clears to null), `t('entry.changeLater')` microcopy, a full-width primary button (`bg-primary hover:bg-primary-hover text-white rounded-lg min-h-11 font-bold`) that submits `suggestions[0]` when present, failure copy (`entry.noResults`) when `failed`, and the muted `entry.exploreHint` line under the card. Also render `CoverageKey.tsx` (bottom-right, above attribution: two rows with coverage-green / gray swatches + `entry.keyAvailable` / `entry.keyUnavailable` + `entry.coverageNote` in a small card) — the key shows only at entry view.

Entry wash: in `App.tsx`, when `view === 'entry'` render over the map (below the card): `<div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-subtle-cool/60 to-transparent transition-opacity duration-[var(--dur-panel)]" />`.

`App.tsx` becomes:

```typescript
import { useTranslation } from 'react-i18next'
import MapView from './components/Map/MapView'
import LayerTray from './components/Map/LayerTray'
import Legend from './components/Map/Legend'
import EntryCard from './components/Entry/EntryCard'
import CoverageKey from './components/Entry/CoverageKey'
import LanguageToggle from './components/LanguageToggle'
import { useAppStore } from './store/useAppStore'

export default function App() {
  const view = useAppStore(s => s.view)
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <MapView />
      {view === 'entry' && (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-subtle-cool/60 to-transparent" />
          <EntryCard />
          <CoverageKey />
        </>
      )}
      {view === 'searched' && (
        <>
          <LayerTray />
          <Legend />
        </>
      )}
      <div className="absolute right-4 top-4 z-10">
        <LanguageToggle />
      </div>
    </div>
  )
}
```

(Adjust `LanguageToggle` styling minimally if it assumed the old header; keep it functional. If LayerTray also sits top-right, offset one of them.)
- [ ] **Step 3: Add the `entry.*` i18n block to both files.**
- [ ] **Step 4: Run tests + typecheck + build** — Expected: pass. `npm run dev`: entry shows the floating card over the glowing coverage map; selecting a suggestion flies the camera to the place (card disappears — the panel replacing it arrives in Task 14).
- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: map-first entry state with floating search card and coverage key"`

---

### Task 14: Workspace panel — dataset list and detail

**Files:**
- Create: `app/src/components/Panel/WorkspacePanel.tsx` (frame: tabs, depth switch, width transition)
- Create: `app/src/components/Panel/DatasetList.tsx`, `app/src/components/Panel/DatasetRow.tsx`
- Create: `app/src/components/Panel/DatasetDetail.tsx`
- Create: `app/src/components/Panel/resultSummary.ts` (pure per-dataset row/detail statement builder — tested)
- Modify: `app/src/App.tsx` (render panel in searched view; home control)
- Modify: i18n (add `panel.*`, `states.*` blocks)
- Test: `app/src/components/Panel/resultSummary.test.ts`, `app/src/components/Panel/DatasetList.test.tsx`

**Interfaces:**
- Consumes: store, registry, `isRenderableValue`.
- Produces:

```typescript
// resultSummary.ts — the concise row statement per spec §7.3/§7.4.
// Returns an i18n-ready plain string; for non-available statuses returns the
// state copy (never a value, never "safe").
export function resultSummary(id: DatasetId, r: DatasetResult | undefined, t: TFunction): string
```

i18n additions (EN shown; add faithful ES):

```json
"panel": {
  "publicData": "Public data",
  "aiTab": "What does this mean?",
  "back": "All public data",
  "explain": "Explain this result",
  "sourceLink": "View original source",
  "doesNotShow": "Does not show",
  "geography": "Geography",
  "cadence": "Updated",
  "unsupportedTitle": "Detailed water-risk data is not yet available for this area.",
  "unsupportedBody": "You can search another place, or explore the coverage map.",
  "home": "New search"
},
"states": {
  "loading": "Checking source…",
  "unavailable": "No current result available",
  "not_applicable": "Not applicable to this place",
  "unsupported": "Outside detailed coverage",
  "error": "Source could not be reached",
  "retry": "Retry"
}
```

Row content statements (available status) built in `resultSummary` from existing i18n card keys where they exist (`flood.inZone`/`flood.outZone` etc. — reuse the existing `flood.*`, `drought.*`, `waterQuality.*`, `coastalFlood.*`, `groundwater.*`, `bathingWater.*` blocks already present in the i18n files; reservoirs row: nearest reservoir name + fill %).

- [ ] **Step 1: Write the failing tests.**

`resultSummary.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { resultSummary } from './resultSummary'
import i18n from '../../i18n'

const t = i18n.getFixedT('en')

describe('resultSummary', () => {
  it('states are rendered as explicit state copy, never values', () => {
    expect(resultSummary('flood', { status: 'error' }, t)).toMatch(/could not be reached/i)
    expect(resultSummary('flood', { status: 'unavailable' }, t)).toMatch(/no current result/i)
    expect(resultSummary('flood', { status: 'loading' }, t)).toMatch(/checking/i)
    expect(resultSummary('flood', undefined, t)).toMatch(/checking/i)
  })
  it('available flood result distinguishes finding from conclusion', () => {
    const s = resultSummary('flood', { status: 'available', data: { inZone: false, source: 'SNCZI' } }, t)
    expect(s).toMatch(/outside the mapped/i)
    expect(s).not.toMatch(/\bsafe\b/i)
  })
})
```

`DatasetList.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DatasetList from './DatasetList'
import { useAppStore } from '../../store/useAppStore'
import '../../i18n'

const sevilla = {
  displayName: 'Sevilla', coordinates: { lat: 37.39, lng: -5.98 },
  municipio: 'Sevilla', provincia: 'Sevilla', basin: 'guadalquivir' as const,
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState())
  useAppStore.getState().beginSearch(sevilla)
})

describe('dataset list', () => {
  it('renders a row per applicable dataset with per-state presentation', () => {
    useAppStore.getState().setResult('flood', { status: 'available', data: { inZone: false, source: 'SNCZI' } })
    useAppStore.getState().setResult('drought', { status: 'error', error: 'x' })
    render(<DatasetList />)
    expect(screen.getByText(/outside the mapped/i)).toBeInTheDocument()
    expect(screen.getByText(/source could not be reached/i)).toBeInTheDocument()
  })

  it('error rows carry a non-colour cue and a retry affordance', () => {
    useAppStore.getState().setResult('drought', { status: 'error', error: 'x' })
    render(<DatasetList />)
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('selecting a row opens detail and activates its primary layer', async () => {
    const user = userEvent.setup()
    useAppStore.getState().setResult('flood', { status: 'available', data: { inZone: false, source: 'SNCZI' } })
    render(<DatasetList />)
    await user.click(screen.getByRole('button', { name: /river flood zones/i }))
    expect(useAppStore.getState().panelDepth).toBe('detail')
    expect(useAppStore.getState().primaryLayer).toBe('flood')
  })
})
```

- [ ] **Step 2: Run to verify failure**, then implement.

`resultSummary.ts`: switch on `r?.status ?? 'loading'`; non-available → `t('states.<status>')`; available → per-dataset formatting reusing the existing i18n card keys (e.g. flood: `t('flood.outZone')` which reads "Outside the mapped river-flood zones" — verify the existing key text and reuse; if the current key text differs, add `panel`-scoped equivalents rather than editing card keys other agents may touch).

`DatasetRow.tsx`: a full-width `<button>` (min-h-11, `bg-subtle-warm rounded-xl` hover `bg-subtle-cool`, left-aligned) with: name (`font-bold text-sm`), summary line (`text-sm`), cadence (`text-xs text-muted`), and a non-colour status cue — a small icon glyph per status rendered as text symbols with `aria-hidden` plus visually-hidden status text: available `●`, loading `◌`, error `⚠` + retry button (`stopPropagation`, calls the dataset's fetch again via `submitLocation`-style single-dataset retry helper: `retryDataset(id)` added to `submitLocation.ts` — runs `runProfile(location, [getDataset(id)], …)`), unavailable/unsupported `○`, not_applicable rows are omitted from the list. Map-availability hint: tiny `text-xs text-muted` "Map layer" chip when `mapRole !== 'none'`.

`DatasetDetail.tsx`: back button (`t('panel.back')` with ← glyph), `<h2>` name, result statement (`text-base`), the secondary factual line (e.g. flood: `t('flood.detailNote')` — add key: "No official river-flood polygon intersects the selected point." / "Ningún polígono oficial de inundación fluvial intersecta el punto seleccionado." shown only when available && !inZone), metadata rows (source org, `panel.cadence` + registry cadence, `panel.geography` + registry resolution), `panel.doesNotShow` heading + `registry.<id>.limitations` list, source link (`<a target="_blank" rel="noreferrer">` when `source.url`), and an **Explain this result** primary-soft button that calls `openAiMode()` then `requestInterpretation({ type: 'dataset', id })`.

`WorkspacePanel.tsx`: floating left panel (`absolute left-6 top-6 bottom-6 z-10 flex flex-col rounded-2xl bg-canvas shadow-xl transition-[width] duration-[var(--dur-panel)]`), width by depth: list `w-[340px]`, detail `w-[440px]`, interpretation `w-[500px]` (each `max-w-[calc(100vw-3rem)]`). Header: location name + provincia (+ home button calling `goHome()`, labelled `t('panel.home')`), then the two-mode tab bar (`role="tablist"`; tabs `panel.publicData` / `panel.aiTab`; AI tab click → `openAiMode()` + `requestInterpretation({type:'location'})` ONLY if `interpretation.status` is `'idle' | 'stale' | 'error'` — a `ready` interpretation just shows). Body: unsupported coverage → `panel.unsupportedTitle`/`unsupportedBody` (no dataset rows, no AI tab — hide the tablist entirely when unsupported, §15.2); else by mode/depth: DatasetList | DatasetDetail | InterpretationView (Task 15 — render a placeholder `<div />` until then).
- [ ] **Step 3: Mount** — in `App.tsx` searched view render `<WorkspacePanel />`. Move `LayerTray` if it collides with the top-right controls.
- [ ] **Step 4: Add i18n blocks (both languages).** ES for `panel.*`: "Datos públicos", "¿Qué significa esto?", "Todos los datos públicos", "Explicar este resultado", "Ver fuente original", "No muestra", "Geografía", "Actualizado", "Aún no hay datos detallados de riesgo hídrico para esta zona.", "Puedes buscar otro lugar o explorar el mapa de cobertura.", "Nueva búsqueda". ES for `states.*`: "Consultando la fuente…", "No hay resultado actual disponible", "No aplicable a este lugar", "Fuera de la cobertura detallada", "No se pudo acceder a la fuente", "Reintentar".
- [ ] **Step 5: Run all tests + typecheck + build** — Expected: pass.
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: progressive workspace panel with dataset list and detail"`

---

### Task 15: AI interpretation view

**Files:**
- Create: `app/src/components/Panel/InterpretationView.tsx`
- Modify: `app/src/components/Panel/WorkspacePanel.tsx` (replace placeholder)
- Modify: i18n (add `ai.*` block)
- Test: `app/src/components/Panel/InterpretationView.test.tsx`

**Interfaces:**
- Consumes: store `interpretation`, `requestInterpretation` (Task 9), `openDataMode`.
- Produces i18n block:

```json
"ai": {
  "assistedLabel": "AI-assisted",
  "titleLocation": "What this location's data may mean",
  "titleDataset": "What this result may mean",
  "basis": "Based on: {{sources}}",
  "loading": "Generating interpretation…",
  "error": "Interpretation could not be generated.",
  "unsupported": "Detailed data is not available here, so no interpretation can be made. Check authoritative regional sources instead.",
  "stale": "The language changed. Regenerate the interpretation?",
  "regenerate": "Regenerate",
  "followUpLabel": "Ask a follow-up about this data",
  "followUpSend": "Ask",
  "suggested": "Questions you could ask"
}
```

(ES: "Asistido por IA", "Qué pueden significar los datos de esta ubicación", "Qué puede significar este resultado", "Basado en: {{sources}}", "Generando interpretación…", "No se pudo generar la interpretación.", "Aquí no hay datos detallados, así que no se puede hacer una interpretación. Consulta fuentes regionales oficiales.", "Ha cambiado el idioma. ¿Regenerar la interpretación?", "Regenerar", "Haz una pregunta sobre estos datos", "Preguntar", "Preguntas que podrías hacer")

Behavior: shows the `ai.assistedLabel` chip ON the generated content (spec amendment — a small `bg-primary-soft text-primary text-xs font-bold rounded-lg px-2 py-1` badge above the text), literal title by scope, basis statement listing dataset names from `basis`, the interpretation text, suggested questions as buttons, and a follow-up input that only renders when `status === 'ready'`. Follow-up submit and suggested-question click both re-call `requestInterpretation` with the same scope — extend `InterpretRequest`/client with an optional `question?: string` field passed through to the proxy (add `Question: ...` line to the user message in `interpretCore.ts` when present; scoped to the evidence already shown). Stale state renders previous text dimmed + `ai.stale` + regenerate button (explicit re-request on language change, §15.6).

- [ ] **Step 1: Write the failing test** — `app/src/components/Panel/InterpretationView.test.tsx`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import InterpretationView from './InterpretationView'
import { useAppStore } from '../../store/useAppStore'
import '../../i18n'

vi.mock('../../services/ai', () => ({ requestInterpretation: vi.fn() }))

const sevilla = {
  displayName: 'Sevilla', coordinates: { lat: 37.39, lng: -5.98 },
  municipio: 'Sevilla', provincia: 'Sevilla', basin: 'guadalquivir' as const,
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState())
  useAppStore.getState().beginSearch(sevilla)
})

describe('interpretation view', () => {
  it('ready state shows AI-assisted label on the content, basis and questions', () => {
    useAppStore.getState().setInterpretation({
      status: 'ready', scope: { type: 'location' },
      text: 'Calm interpretation.', questions: ['Q one?'], basis: ['flood'],
    })
    render(<InterpretationView />)
    expect(screen.getByText(/ai-assisted/i)).toBeInTheDocument()
    expect(screen.getByText('Calm interpretation.')).toBeInTheDocument()
    expect(screen.getByText(/based on/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /q one\?/i })).toBeInTheDocument()
  })

  it('stale state offers regeneration instead of auto-regenerating', () => {
    useAppStore.getState().setInterpretation({
      status: 'stale', scope: { type: 'location' }, text: 'Old text.',
    })
    render(<InterpretationView />)
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument()
  })

  it('follow-up input only appears once an interpretation is ready', () => {
    useAppStore.getState().setInterpretation({ status: 'loading', scope: { type: 'location' } })
    const { rerender } = render(<InterpretationView />)
    expect(screen.queryByLabelText(/follow-up/i)).not.toBeInTheDocument()
    useAppStore.getState().setInterpretation({ status: 'ready', text: 'T', questions: [], basis: [] })
    rerender(<InterpretationView />)
    expect(screen.getByLabelText(/follow-up/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**, then implement `InterpretationView.tsx` per the behavior above (switch on `interpretation.status`: idle → nothing / loading → `ai.loading` skeleton text / error → `ai.error` + regenerate / stale → dimmed text + `ai.stale` + regenerate / ready → full content). Basis names via `t('registry.<id>.name')` joined with ', '.
- [ ] **Step 3: Add the optional `question` field** to `interpretCore.ts` (`question?: string` on `InterpretRequest`; append `Question from the reader: ${req.question}` to the user message when set) and to `requestInterpretation(scope, question?)` in `ai.ts`.
- [ ] **Step 4: Replace the WorkspacePanel placeholder; add i18n blocks (both languages); run all tests + build** — Expected: pass.
- [ ] **Step 5: Manual check** — `npm run dev` with `ANTHROPIC_API_KEY` in `.env.local`: search Sevilla → "What does this mean?" tab generates one interpretation; no network call to `api.anthropic.com` appears in the browser network tab (only `/api/interpret`).
- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: opt-in AI interpretation view with follow-up and stale handling"`

---

### Task 16: Mobile bottom sheet, route sync, cleanup, acceptance pass

**Files:**
- Create: `app/src/components/Panel/MobileSheet.tsx`
- Modify: `app/src/App.tsx` (breakpoint switch: `<md`: panel content inside MobileSheet; `md+`: WorkspacePanel)
- Create: `app/src/services/routeSync.ts` (store⇄URL wiring)
- Delete: any remaining legacy files (`RiskPanel/` directory, old cards if still present, `assets/hero.png` if unused)
- Modify: `app/src/types/index.ts` (remove `UserType` once nothing references it; keep `RiskProfile` only if a merged branch still uses it — otherwise delete)
- Modify: i18n (add `sheet.*`; remove dead keys `userType.*`, `aiSummary.*`, `questions.*`, `noLocation`, `tagline` IF unreferenced — verify with grep before deleting; keep anything a data-source branch references)
- Test: `app/src/components/Panel/MobileSheet.test.tsx`, `app/src/services/routeSync.test.ts`

**Interfaces:**
- Consumes: everything prior.
- Produces:

```typescript
// routeSync.ts
export function applyRouteToStore(route: RouteState): Promise<void>
// lat+lng present -> reverseGeocode -> submitLocation, then aud/ds/mode applied; bad params ignored
export function subscribeStoreToRoute(): () => void
// subscribes to the store; history.replaceState(serializeRoute(...)) on view/audience/dataset/mode changes
```

MobileSheet: rendered below `md` breakpoint in searched view. Three positions `peek | half | full` in local state; container `fixed inset-x-0 bottom-0 z-20 rounded-t-2xl bg-canvas shadow-2xl transition-[height] duration-[var(--dur-panel)]` with heights `h-28 | h-[50dvh] | h-[92dvh]`. Explicit controls (not gesture-only): a drag-handle `<button aria-label={t('sheet.expand')}>` cycling positions, and up/down chevron buttons. Peek shows place name + up to three concise signals (first three list rows' name+summary, compressed). Half shows DatasetList. Full shows detail/interpretation. Selecting a row raises to full; `sheet.mapButton` returns to peek. i18n `sheet`: `{ "expand": "Expand results", "collapse": "Show map", "signals": "Key results" }` (ES: "Ampliar resultados", "Ver mapa", "Resultados clave").

- [ ] **Step 1: Write failing tests.**

`routeSync.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { applyRouteToStore } from './routeSync'
import { useAppStore } from '../store/useAppStore'
import * as geocoding from './geocoding'

vi.mock('./geocoding')
vi.mock('./orchestrator', () => ({ runProfile: vi.fn(async () => {}) }))

beforeEach(() => useAppStore.setState(useAppStore.getInitialState()))

describe('route -> store', () => {
  it('restores a searched location with audience and dataset', async () => {
    vi.mocked(geocoding.reverseGeocode).mockResolvedValue({
      displayName: 'Sevilla', coordinates: { lat: 37.39, lng: -5.98 },
      municipio: 'Sevilla', provincia: 'Sevilla', basin: 'guadalquivir',
    })
    await applyRouteToStore({ lat: 37.39, lng: -5.98, aud: 'buyer_investor', ds: 'flood', mode: 'data' })
    const s = useAppStore.getState()
    expect(s.view).toBe('searched')
    expect(s.audience).toBe('buyer_investor')
    expect(s.selectedDataset).toBe('flood')
  })

  it('ignores an empty route', async () => {
    await applyRouteToStore({})
    expect(useAppStore.getState().view).toBe('entry')
  })

  it('never lands in AI mode with an auto-generated interpretation', async () => {
    vi.mocked(geocoding.reverseGeocode).mockResolvedValue({
      displayName: 'Sevilla', coordinates: { lat: 37.39, lng: -5.98 }, municipio: 'Sevilla',
    })
    await applyRouteToStore({ lat: 37.39, lng: -5.98, mode: 'ai' })
    const s = useAppStore.getState()
    expect(s.panelMode).toBe('ai')
    expect(s.interpretation.status).toBe('idle') // opt-in still required
  })
})
```

`MobileSheet.test.tsx`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MobileSheet from './MobileSheet'
import { useAppStore } from '../../store/useAppStore'
import '../../i18n'

const sevilla = {
  displayName: 'Sevilla', coordinates: { lat: 37.39, lng: -5.98 },
  municipio: 'Sevilla', provincia: 'Sevilla', basin: 'guadalquivir' as const,
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState())
  useAppStore.getState().beginSearch(sevilla)
})

describe('mobile sheet', () => {
  it('starts at peek with the place name and explicit expand control', () => {
    render(<MobileSheet />)
    expect(screen.getByText(/sevilla/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /expand results/i })).toBeInTheDocument()
  })
  it('expands to half showing the dataset list', async () => {
    const user = userEvent.setup()
    render(<MobileSheet />)
    await user.click(screen.getByRole('button', { name: /expand results/i }))
    expect(screen.getByRole('button', { name: /river flood zones/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**, then implement `MobileSheet.tsx` and `routeSync.ts`:

```typescript
// app/src/services/routeSync.ts
import { reverseGeocode } from './geocoding'
import { parseRoute, serializeRoute, type RouteState } from './route'
import { submitLocation } from '../components/Entry/submitLocation'
import { useAppStore } from '../store/useAppStore'

export async function applyRouteToStore(route: RouteState): Promise<void> {
  const store = useAppStore.getState()
  if (route.aud) store.setAudience(route.aud)
  if (route.lat === undefined || route.lng === undefined) return
  const loc = await reverseGeocode({ lat: route.lat, lng: route.lng }).catch(() => null)
  if (!loc) return
  await submitLocation(loc)
  const after = useAppStore.getState()
  if (route.ds && after.coverage?.supported) after.selectDataset(route.ds)
  if (route.mode === 'ai' && after.coverage?.supported) after.openAiMode() // no fetch — opt-in stays manual
}

export function subscribeStoreToRoute(): () => void {
  return useAppStore.subscribe(s => {
    const route: RouteState = s.view === 'searched' && s.location
      ? {
          q: s.location.municipio || s.location.displayName,
          lat: s.location.coordinates.lat,
          lng: s.location.coordinates.lng,
          aud: s.audience ?? undefined,
          ds: s.selectedDataset ?? undefined,
          mode: s.panelMode,
        }
      : { aud: s.audience ?? undefined }
    const target = serializeRoute(route) || window.location.pathname
    if (window.location.search !== serializeRoute(route)) {
      history.replaceState(null, '', target)
    }
  })
}

export function initRouteSync(): void {
  void applyRouteToStore(parseRoute(window.location.search))
  subscribeStoreToRoute()
}
```

Call `initRouteSync()` once from `main.tsx` after render setup (guard with `typeof window !== 'undefined'`).
- [ ] **Step 3: Responsive switch in App.tsx** — render `<WorkspacePanel />` wrapped in `hidden md:flex` and `<MobileSheet />` in `md:hidden` (searched view only). WorkspacePanel's internals (tabs/list/detail/interpretation) must be shared — extract its body into `PanelBody.tsx` used by both shells if needed.
- [ ] **Step 4: Cleanup.** `grep -rn "RiskPanel\|UserTypeSelector\|LayerToggle\|SearchBar" app/src` — delete every unreferenced legacy file and dead i18n key (KEEP the dataset card i18n blocks `flood.*` etc. — the detail views use them; keep types other branches' merges rely on: check `git log --oneline HEAD..worktree-new-water-data-sources` first per Global Constraints). Delete `RiskProfile` from types only if `grep -rn "RiskProfile" app/src` returns nothing.
- [ ] **Step 5: Full verification.**

Run: `npx tsc --noEmit && npx vitest run && npm run build` — Expected: all pass, no skipped tests.

Manual acceptance sweep (`npm run dev`, desktop + a narrowed window; check against spec §18):
1. Entry: floating search card over live map; Andalucía glowing; audience optional beneath input; explore-by-panning works.
2. Search "Sevilla" → fly-in ≤1.2 s, card → panel morph, list populates incrementally.
3. Search "Madrid" → location shown, unsupported copy, NO risk styling, NO AI tab.
4. Select flood row → detail (source, updated, geography, Does-not-show, source link) + flood raster active + legend updates.
5. Layer tray: radio primaries, checkbox context, count updates.
6. "What does this mean?" → single `/api/interpret` POST (browser devtools), AI-assisted label on content, suggested questions, follow-up.
7. Language toggle → UI flips instantly; interpretation marked stale with regenerate offer.
8. Narrow window → bottom sheet peek/half/full with explicit buttons.
9. Copy the URL mid-session, open in a new tab → same location/dataset restored, AI not auto-generated.
10. `prefers-reduced-motion` (emulate in devtools) → no fly animation.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: mobile bottom sheet, shareable routes, legacy cleanup"`

---

### Task 17: Deployment wiring and finishing

**Files:**
- Modify: `README.md` (new run/deploy instructions: `ANTHROPIC_API_KEY` env on Vercel, project root = `app/`)
- Verify: `app/vercel.json`, `.env.example`

- [ ] **Step 1:** Update README: local dev (`cd app && npm install && npm run dev` with `.env.local` containing `ANTHROPIC_API_KEY`), test (`npm test`), deploy (Vercel project rooted at `app/`; set `ANTHROPIC_API_KEY` in Vercel env; `api/interpret.ts` deploys automatically as a serverless function).
- [ ] **Step 2:** Final full run: `npx tsc --noEmit && npx vitest run && npm run build`. Re-run the Global Constraints sync (merge any new commits from the two agent branches; re-verify).
- [ ] **Step 3:** Commit — `git add -A && git commit -m "docs: update README for redesigned app and Vercel deployment"`. Then invoke **superpowers:finishing-a-development-branch** to decide merge/PR with the user.

---

## Self-Review Notes (completed at plan-writing time)

- **Spec coverage:** §5–§7 → Tasks 6, 13, 14; §8 → Tasks 10–12; §9 → Tasks 3–8; §10 → Tasks 9, 15; §11 → Task 16; §12 → Task 2 (+ per-component classes); §13 → i18n blocks in Tasks 5, 12–16; §14 → labelled controls, roles, reduced-motion, 44 px targets throughout; §15 → Tasks 7 (partial failure), 13 (no-results), 14 (unsupported), 15 (stale language); §16 → module boundaries mirror the spec's units; §17 → tests in every task; §18 → Task 16 Step 5 sweep. Deferred (§19) items are absent by design.
- **Known simplifications (intentional):** bathing water is panel-only (no map points); only one context dataset exists today so the 2-overlay cap is exercised by unit test rather than UI; basemap "custom style" is a runtime transform of Positron rather than a Maputnik-authored style (upgrade path preserved — swap `loadQuietFocusStyle`).
- **Type consistency check:** `DatasetId`/`DatasetResult`/`Audience` defined once (Task 3) and imported everywhere; store API names used by Tasks 12–16 match Task 6's interface block; `submitLocation` defined in Task 13 and reused by Task 16's route sync.
