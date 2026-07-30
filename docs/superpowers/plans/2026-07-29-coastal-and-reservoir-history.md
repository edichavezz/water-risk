# Coastal Availability and Reservoir History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the coastal dataset while MITERD's gateway is down (automatically restoring it when the gateway recovers), and show 5- and 10-year average reservoir fill alongside today's level.

**Architecture:** Coastal availability becomes a runtime health probe stored in zustand and consulted by `appliesTo` and `LayerTray`, so the existing `orderedDatasets` filter does the hiding — no new rendering path. Reservoir history is fetched at build time by looping REDIAM's date-indexed endpoint over the previous 10 years and baked into `reservoirs.generated.json` as two means per station.

**Tech Stack:** TypeScript, React, zustand, MapLibre GL, vitest, i18next, Node ESM build scripts.

> **Status after execution (2026-07-29).** Tasks 1–3 and 6 were implemented.
> **Tasks 4 and 5 were cancelled** — they rested on a stale reading of the
> coastal code (see the Correction section of the spec). `main` already had a
> working proxied REDIAM map layer and already surfaced outages as `error`, so
> the health probe and dynamic hide would have removed a working layer. The one
> real defect in those tasks — `appliesTo` not passing `displayName` — was
> fixed, with a Marbella regression test. Task 3 also grew a `ReservoirLevels`
> panel component, because the averages needed to appear in the results panel,
> not only the map popup.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-29-coastal-and-reservoir-history-design.md`.
- All work happens under `app/`. Run commands from `app/`.
- Every user-facing string is added to **both** `src/i18n/en.json` and `src/i18n/es.json` — `src/i18n/parity.test.ts` fails otherwise.
- Statuses `unavailable`, `unsupported`, `error` must never be styled as safe (`NON_SAFE_STATUSES`, spec §9.2).
- Missing history renders as absent, never as `0`.
- MITERD returns **HTTP 200 with an XML fault body**; never classify its health by status code alone.
- Do not modify the SNCZI flood layers — out of scope.
- Verify with `npm test` and `npx tsc --noEmit`.

---

### Task 1: Historical means computation (pure function)

**Files:**
- Modify: `app/scripts/fetch-reservoirs.mjs`
- Test: `app/scripts/fetch-reservoirs.test.mjs`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `historicalMeans(codEst: string, history: object[]): { mean5yr: number|null, mean10yr: number|null }`, where `history` is an array of REDIAM day payloads ordered **most recent first** (index 0 = one year ago). Used by Task 2.

- [ ] **Step 1: Write the failing test**

Append to `app/scripts/fetch-reservoirs.test.mjs`:

```js
import { historicalMeans } from './fetch-reservoirs.mjs'

describe('historicalMeans', () => {
  const yr = pct => ({ E61_por: pct })

  it('averages the first 5 and all 10 years, rounded to one decimal', () => {
    const history = [40, 50, 60, 40, 60, 80, 80, 80, 80, 80].map(yr)
    const { mean5yr, mean10yr } = historicalMeans('E61', history)
    expect(mean5yr).toBe(50)
    expect(mean10yr).toBe(65)
  })

  it('ignores years where the station reported no value', () => {
    const history = [{ E61_por: 60 }, { E61_por: null }, { E61_por: 40 }, {}, { E61_por: 50 }]
    // contributing: 60, 40, 50 -> 50
    expect(historicalMeans('E61', history).mean5yr).toBe(50)
  })

  it('returns null when fewer than 3 years contribute', () => {
    const history = [{ E61_por: 60 }, { E61_por: 40 }, {}, {}, {}]
    expect(historicalMeans('E61', history).mean5yr).toBeNull()
  })

  it('returns null means for an empty history', () => {
    expect(historicalMeans('E61', [])).toEqual({ mean5yr: null, mean10yr: null })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- fetch-reservoirs`
Expected: FAIL — `historicalMeans is not a function`.

- [ ] **Step 3: Write minimal implementation**

Add to `app/scripts/fetch-reservoirs.mjs`, above `main()`:

```js
// A station needs at least this many reporting years before an average is
// worth showing — two wet years would otherwise masquerade as "normal".
const MIN_YEARS = 3

function meanOf(values) {
  if (values.length < MIN_YEARS) return null
  const sum = values.reduce((a, b) => a + b, 0)
  return Math.round((sum / values.length) * 10) / 10
}

/**
 * Mean fill % for one station across the same calendar date in past years.
 * `history` is ordered most-recent-first, so the 5-year window is a prefix of
 * the 10-year one. Years where the station reported nothing (built later, or
 * out of service) are skipped rather than counted as zero.
 */
export function historicalMeans(codEst, history) {
  const valueAt = i => {
    const v = history[i]?.[`${codEst}_por`]
    return typeof v === 'number' ? v : null
  }
  const window = n =>
    Array.from({ length: n }, (_, i) => valueAt(i)).filter(v => v !== null)

  return {
    mean5yr: meanOf(window(5)),
    mean10yr: meanOf(window(10)),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- fetch-reservoirs`
Expected: PASS (all four new cases plus the existing `parseGeom`/`shapeReservoir` suites).

- [ ] **Step 5: Commit**

```bash
git add app/scripts/fetch-reservoirs.mjs app/scripts/fetch-reservoirs.test.mjs
git commit -m "feat: compute 5- and 10-year reservoir fill averages"
```

---

### Task 2: Fetch history in the build script

**Files:**
- Modify: `app/scripts/fetch-reservoirs.mjs` (imports, `shapeReservoir`, `main`)
- Modify: `app/src/data/reservoirs.generated.json` (regenerated output)

**Interfaces:**
- Consumes: `historicalMeans` from Task 1.
- Produces: each record in `reservoirs.generated.json` gains `mean5yr: number|null` and `mean10yr: number|null`. Consumed by Task 3.

- [ ] **Step 1: Write the failing test**

Append to `app/scripts/fetch-reservoirs.test.mjs`:

```js
describe('shapeReservoir with history', () => {
  const station = { cod_est: 'E61', nombre: 'ARACENA', provincia: 'Huelva ', sistema: 'ABASTECIMIENTO DE SEVILLA', dist_dem: 'GUADALQUIVIR', nombre_rio: 'Rivera de Huelva', geom: 'POINT (196526.95376674 4201216.1089422)' }
  const today = { fecha: '2026-07-24', E61_res: 102.75, E61_cap: 128.65, E61_por: 79.9 }

  it('attaches both means when history is supplied', () => {
    const history = Array.from({ length: 10 }, () => ({ E61_por: 60 }))
    expect(shapeReservoir(station, today, history)).toMatchObject({
      fillPercent: 79.9, mean5yr: 60, mean10yr: 60,
    })
  })

  it('writes null means when history is missing entirely', () => {
    expect(shapeReservoir(station, today, [])).toMatchObject({
      mean5yr: null, mean10yr: null,
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- fetch-reservoirs`
Expected: FAIL — `mean5yr` is `undefined`, not `60`.

- [ ] **Step 3: Write minimal implementation**

Change the `shapeReservoir` signature in `app/scripts/fetch-reservoirs.mjs` to accept history and spread the means into the record:

```js
export function shapeReservoir(station, today, history = []) {
  const codEst = station.cod_est
  const fillPercent = today[`${codEst}_por`]
  if (fillPercent == null) return null
  const { lat, lng } = parseGeom(station.geom)
  return {
    codEst,
    name: station.nombre.trim(),
    province: station.provincia.trim(),
    river: station.nombre_rio.trim(),
    system: station.sistema.trim(),
    basin: station.dist_dem.trim(),
    lat,
    lng,
    fillPercent,
    storedHm3: today[`${codEst}_res`],
    capacityHm3: today[`${codEst}_cap`],
    ...historicalMeans(codEst, history),
  }
}
```

Add the history fetcher above `main()`:

```js
const HISTORY_YEARS = 10

// REDIAM is date-indexed on the same endpoint as today's bulletin. Requests are
// sequential with a small gap: this is a build-time script hitting a public
// service, and ten polite requests cost a few seconds once a day.
async function fetchHistory(fecha) {
  const [y, m, d] = fecha.split('-').map(Number)
  const days = []
  for (let back = 1; back <= HISTORY_YEARS; back++) {
    const past = `${y - back}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    try {
      const res = await fetch(`${TODAY_URL}/${past}`)
      if (!res.ok) {
        console.warn(`No bulletin for ${past} (HTTP ${res.status}) — skipping that year.`)
        days.push({})
      } else {
        days.push(await res.json())
      }
    } catch (err) {
      console.warn(`History fetch failed for ${past} (${err.message}) — skipping that year.`)
      days.push({})
    }
    await new Promise(r => setTimeout(r, 250))
  }
  return days
}
```

In `main()`, fetch history after `today` is known and pass it through. Replace the `const reservoirs = ...` block with:

```js
  // History is best-effort: a failure here must never cost us today's levels.
  const history = await fetchHistory(today.fecha)

  const reservoirs = stations
    .map(s => shapeReservoir(s, today, history))
    .filter(Boolean)

  const withHistory = reservoirs.filter(r => r.mean10yr !== null).length
  console.log(`${withHistory}/${reservoirs.length} reservoirs have a 10-year average.`)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- fetch-reservoirs`
Expected: PASS.

- [ ] **Step 5: Regenerate the data file**

Run: `node scripts/fetch-reservoirs.mjs`
Expected: prints the reservoir count, the bulletin date, and an `N/M reservoirs have a 10-year average` line where N is a clear majority. Confirm `src/data/reservoirs.generated.json` now contains `mean5yr`/`mean10yr` keys.

- [ ] **Step 6: Commit**

```bash
git add app/scripts/fetch-reservoirs.mjs app/scripts/fetch-reservoirs.test.mjs app/src/data/reservoirs.generated.json
git commit -m "feat: fetch 10 years of reservoir history from REDIAM"
```

---

### Task 3: Surface the averages in the UI

**Files:**
- Modify: `app/src/types/index.ts` (the `Reservoir` interface)
- Modify: `app/src/services/reservoirs.ts` (`GeneratedReservoir`, `toReservoir`, `getAllReservoirsGeoJSON`)
- Modify: `app/src/map/dataLayers.ts` (`ReservoirProps`, `reservoirDetailContent`)
- Modify: `app/src/i18n/en.json`, `app/src/i18n/es.json`
- Test: `app/src/services/reservoirs.test.ts`

**Interfaces:**
- Consumes: `mean5yr`/`mean10yr` from Task 2's JSON.
- Produces: `Reservoir.mean5yr`, `Reservoir.mean10yr` (`number | null`); i18n keys `map.reservoir.vsAverage`, `map.reservoir.above`, `map.reservoir.below`.

- [ ] **Step 1: Write the failing test**

Append to `app/src/services/reservoirs.test.ts`:

```ts
import { getAllReservoirsGeoJSON } from './reservoirs'

describe('reservoir history', () => {
  it('carries both averages onto every map feature', () => {
    const f = getAllReservoirsGeoJSON().features[0]
    expect(f.properties).toHaveProperty('mean5yr')
    expect(f.properties).toHaveProperty('mean10yr')
    expect(f.properties).not.toHaveProperty('historicalMeanPercent')
  })

  it('never substitutes zero for a missing average', () => {
    for (const f of getAllReservoirsGeoJSON().features) {
      for (const k of ['mean5yr', 'mean10yr'] as const) {
        const v = f.properties![k]
        expect(v === null || typeof v === 'number').toBe(true)
      }
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- reservoirs`
Expected: FAIL — feature still has `historicalMeanPercent`, not `mean5yr`.

- [ ] **Step 3: Write minimal implementation**

In `app/src/types/index.ts`, replace `historicalMeanPercent?: number` on `Reservoir` with:

```ts
  mean5yr: number | null
  mean10yr: number | null
```

In `app/src/services/reservoirs.ts`, add both fields to `GeneratedReservoir`:

```ts
  mean5yr: number | null
  mean10yr: number | null
```

carry them in `toReservoir`:

```ts
    mean5yr: r.mean5yr,
    mean10yr: r.mean10yr,
```

and in `getAllReservoirsGeoJSON` replace the `historicalMeanPercent: null` line with:

```ts
        mean5yr: r.mean5yr,
        mean10yr: r.mean10yr,
```

In `app/src/map/dataLayers.ts` add to `ReservoirProps`:

```ts
  mean5yr: number | null
  mean10yr: number | null
```

and in `reservoirDetailContent`, after the storage line, append the comparison rows:

```ts
  // Today's level only means something next to a normal year. Rendered as a
  // signed gap because "34% full" reads fine until you learn late July usually
  // sits at 61%. Absent averages are omitted, never shown as zero.
  for (const [key, years] of [['mean5yr', 5], ['mean10yr', 10]] as const) {
    const mean = props[key]
    if (mean == null) continue
    const gap = Math.round(props.fillPercent - mean)
    const row = document.createElement('div')
    row.className = 'reservoir-popup__row'
    row.textContent = i18n.t('map.reservoir.vsAverage', {
      years,
      mean,
      direction: i18n.t(gap < 0 ? 'map.reservoir.below' : 'map.reservoir.above'),
      gap: Math.abs(gap),
    })
    el.append(row)
  }
```

Add to `app/src/i18n/en.json` under `map.reservoir`:

```json
      "vsAverage": "{{years}}-yr avg {{mean}}% — {{gap}} pts {{direction}}",
      "above": "above",
      "below": "below"
```

and under the same path in `app/src/i18n/es.json`:

```json
      "vsAverage": "media {{years}} años {{mean}}% — {{gap}} pts {{direction}}",
      "above": "por encima",
      "below": "por debajo"
```

- [ ] **Step 4: Run tests and the type-checker**

Run: `npm test && npx tsc --noEmit`
Expected: PASS, including `src/i18n/parity.test.ts`. If `tsc` flags a remaining `historicalMeanPercent` reference, delete it — the field is being retired.

- [ ] **Step 5: Commit**

```bash
git add app/src app/src/i18n
git commit -m "feat: show 5- and 10-year fill averages on reservoirs"
```

---

### Task 4: Coastal health probe and honest failures

**Files:**
- Modify: `app/src/services/coastalFlood.ts`
- Modify: `app/src/types/index.ts` (`CoastalFloodResult`)
- Test: Create `app/src/services/coastalFlood.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `probeCoastalService(): Promise<'ok' | 'down'>` and `getCoastalFloodStatus(coords): Promise<CoastalFloodResult>` where `CoastalFloodResult` gains `degraded: boolean`. Used by Task 5.

- [ ] **Step 1: Write the failing test**

Create `app/src/services/coastalFlood.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { probeCoastalService, getCoastalFloodStatus, isCoastalProvincia } from './coastalFlood'

const FAULT = '<ServiceExceptionReport version="1.1.1"><ServiceException code="InvalidFormat">System.NullReferenceException</ServiceException></ServiceExceptionReport>'

function mockFetch(body: string, ok = true, contentType = 'text/xml') {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    headers: { get: () => contentType },
    text: async () => body,
  }))
}

afterEach(() => vi.unstubAllGlobals())

describe('probeCoastalService', () => {
  it('reports down for a 200 response carrying a WMS fault', async () => {
    // MITERD's gateway answers 200 with an XML fault, so status alone is a lie.
    mockFetch(FAULT)
    expect(await probeCoastalService()).toBe('down')
  })

  it('reports ok for real capabilities XML', async () => {
    mockFetch('<?xml version="1.0"?><WMS_Capabilities></WMS_Capabilities>')
    expect(await probeCoastalService()).toBe('ok')
  })

  it('reports down when the request throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect(await probeCoastalService()).toBe('down')
  })
})

describe('getCoastalFloodStatus', () => {
  it('marks the result degraded rather than clear when the service faults', async () => {
    mockFetch(FAULT)
    const r = await getCoastalFloodStatus({ lat: 36.5, lng: -4.9 })
    expect(r.degraded).toBe(true)
    // The bug this replaces: an outage previously read as "not in a zone".
    expect(r.inServidumbre).toBe(false)
    expect(r.inPolicia).toBe(false)
  })

  it('reports a genuine clear result as not degraded', async () => {
    mockFetch('{"type":"FeatureCollection","features":[]}', true, 'application/json')
    const r = await getCoastalFloodStatus({ lat: 36.5, lng: -4.9 })
    expect(r.degraded).toBe(false)
    expect(r.inServidumbre).toBe(false)
  })
})

describe('isCoastalProvincia', () => {
  it('matches on displayName when provincia is a comarca', () => {
    // Nominatim returns the tourism region for Marbella, not the province.
    expect(isCoastalProvincia('Costa del Sol Occidental',
      'Marbella, Costa del Sol Occidental, Málaga, Andalucía, España')).toBe(true)
  })

  it('stays false for an inland address', () => {
    expect(isCoastalProvincia('Córdoba', 'Córdoba, Andalucía, España')).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- coastalFlood`
Expected: FAIL — `probeCoastalService` is not exported; `degraded` is undefined.

- [ ] **Step 3: Write minimal implementation**

In `app/src/types/index.ts` add to `CoastalFloodResult`:

```ts
  // True when MITERD's gateway failed. Guarantees an outage is never rendered
  // as "not in a restricted zone" — a false clean bill of health.
  degraded: boolean
```

In `app/src/services/coastalFlood.ts`, add the fault detector and probe:

```ts
// MITERD's wms.aspx answers HTTP 200 with an XML ServiceExceptionReport when
// it is broken, so the status code cannot be trusted — the body is the signal.
function isFault(body: string): boolean {
  return body.includes('ServiceExceptionReport') || body.includes('ServiceException')
}

export async function probeCoastalService(): Promise<'ok' | 'down'> {
  const params = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetCapabilities',
  })
  try {
    const res = await fetch(`${COASTAL_DPH_WMS}?${params}`)
    if (!res.ok) return 'down'
    return isFault(await res.text()) ? 'down' : 'ok'
  } catch {
    return 'down'
  }
}
```

Replace `queryLayer` so failure is distinguishable from absence:

```ts
async function queryLayer(coords: Coordinates, layer: string): Promise<boolean | 'error'> {
  const delta = 0.001
  const bbox = `${coords.lng - delta},${coords.lat - delta},${coords.lng + delta},${coords.lat + delta}`

  const params = new URLSearchParams({
    SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetFeatureInfo',
    LAYERS: layer, QUERY_LAYERS: layer, STYLES: '', BBOX: bbox,
    WIDTH: '10', HEIGHT: '10', SRS: 'EPSG:4326', X: '5', Y: '5',
    INFO_FORMAT: 'application/json', FEATURE_COUNT: '1',
  })

  try {
    const res = await fetch(`${COASTAL_DPH_WMS}?${params}`)
    if (!res.ok) return 'error'
    const text = await res.text()
    if (isFault(text)) return 'error'
    return (
      (text.includes('"features"') && !text.includes('"features":[]')) ||
      text.includes('<gml:featureMember>') ||
      (text.includes('NumberOfFeaturesMatched') && !text.includes('NumberOfFeaturesMatched="0"'))
    )
  } catch {
    return 'error'
  }
}
```

and fold the errors into the result:

```ts
export async function getCoastalFloodStatus(coords: Coordinates): Promise<CoastalFloodResult> {
  const [servidumbre, policia] = await Promise.all([
    queryLayer(coords, COASTAL_LAYERS.servidumbre),
    queryLayer(coords, COASTAL_LAYERS.policia),
  ])
  const degraded = servidumbre === 'error' || policia === 'error'
  return {
    inServidumbre: servidumbre === true,
    inPolicia: policia === true,
    degraded,
    source: 'MITERD DPH',
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- coastalFlood`
Expected: PASS — all seven cases.

- [ ] **Step 5: Commit**

```bash
git add app/src/services/coastalFlood.ts app/src/services/coastalFlood.test.ts app/src/types/index.ts
git commit -m "fix: never render a coastal outage as 'not in a restricted zone'"
```

---

### Task 5: Hide the coastal dataset while the service is down

**Files:**
- Modify: `app/src/store/useAppStore.ts`
- Modify: `app/src/registry/datasets.ts:100` and `:126`
- Modify: `app/src/components/Map/LayerTray.tsx`
- Modify: `app/src/App.tsx` (probe on mount)
- Test: `app/src/registry/datasets.test.ts`, `app/src/components/Map/LayerTray.test.tsx`

**Interfaces:**
- Consumes: `probeCoastalService` from Task 4.
- Produces: store field `coastalHealth: 'unknown' | 'ok' | 'down'` and action `setCoastalHealth(h)`; `orderedDatasets` excludes `coastalFlood` when health is `down`.

- [ ] **Step 1: Write the failing test**

Append to `app/src/registry/datasets.test.ts`:

```ts
import { useAppStore } from '../store/useAppStore'

describe('coastal visibility follows service health', () => {
  const marbella = {
    displayName: 'Marbella, Costa del Sol Occidental, Málaga, Andalucía, España',
    provincia: 'Costa del Sol Occidental',
    municipio: 'Marbella',
    coordinates: { lat: 36.51, lng: -4.88 },
  } as never

  afterEach(() => useAppStore.setState({ coastalHealth: 'unknown' }))

  it('includes coastal for a comarca-named coastal address when healthy', () => {
    useAppStore.setState({ coastalHealth: 'ok' })
    const ids = orderedDatasets(marbella, null).map(d => d.id)
    expect(ids).toContain('coastalFlood')
    expect(ids).toContain('bathingWater')
  })

  it('drops coastal entirely when the service is down', () => {
    useAppStore.setState({ coastalHealth: 'down' })
    expect(orderedDatasets(marbella, null).map(d => d.id)).not.toContain('coastalFlood')
  })
})
```

Append to `app/src/components/Map/LayerTray.test.tsx` (follow the render helper already in that file):

```tsx
it('offers no coastal toggle while the service is down', async () => {
  useAppStore.setState({ coastalHealth: 'down' })
  render(<LayerTray />)
  await userEvent.click(screen.getByRole('button', { name: /layers/i }))
  expect(screen.queryByLabelText(/coastal/i)).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- datasets LayerTray`
Expected: FAIL — `coastalHealth` is not a store field; Marbella currently yields no coastal dataset even when healthy.

- [ ] **Step 3: Write minimal implementation**

In `app/src/store/useAppStore.ts` add to the `AppStore` interface:

```ts
  coastalHealth: CoastalHealth
  setCoastalHealth: (h: CoastalHealth) => void
```

with the type exported near `SearchOrigin`:

```ts
// MITERD's coastal gateway is currently failing. Health is probed at runtime
// rather than baked in, so the dataset reappears on its own when MITERD
// recovers — no redeploy. 'unknown' is treated as visible: we do not hide a
// hazard on the strength of a probe that has not answered yet.
export type CoastalHealth = 'unknown' | 'ok' | 'down'
```

and to the store body: `coastalHealth: 'unknown',` plus

```ts
  setCoastalHealth: h => set({ coastalHealth: h }),
```

In `app/src/registry/datasets.ts` import the store:

```ts
import { useAppStore } from '../store/useAppStore'
```

and replace line 100 with:

```ts
    appliesTo: loc =>
      isCoastalProvincia(loc.provincia, loc.displayName) &&
      useAppStore.getState().coastalHealth !== 'down',
```

and line 126 (`bathingWater`, same `displayName` bug) with:

```ts
    appliesTo: loc => isCoastalProvincia(loc.provincia, loc.displayName),
```

In `app/src/components/Map/LayerTray.tsx`, after the existing selectors:

```ts
  const coastalHealth = useAppStore(s => s.coastalHealth)
  const offered = (d: DatasetDef) => d.id !== 'coastalFlood' || coastalHealth !== 'down'
```

then filter both lists:

```ts
  const primaries = DATASETS.filter(d => d.mapRole === 'primary').filter(offered)
  const contexts = DATASETS.filter(d => d.mapRole === 'context').filter(offered)
```

adding `import type { DatasetDef } from '../../registry/datasets'`.

In `app/src/App.tsx`, probe once on mount:

```tsx
  useEffect(() => {
    void probeCoastalService().then(useAppStore.getState().setCoastalHealth)
  }, [])
```

with `import { probeCoastalService } from './services/coastalFlood'`.

- [ ] **Step 4: Run the full suite and the type-checker**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src
git commit -m "feat: hide coastal dataset while MITERD's gateway is down"
```

---

### Task 6: Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Correct the reservoir and coastal claims**

The README advertises *"Reservoirs — Nearest 3 reservoirs with fill % and historical mean."* Nearest-3 was deliberately removed in `3f77a57`. Replace that bullet with:

```markdown
- **Reservoirs** — The reservoirs supplying this area, with fill % against 5- and 10-year averages for the same date
```

and the coastal bullet with:

```markdown
- **Coastal zone** — MITERD DPH building-restriction zones (coastal locations only; hidden while MITERD's service is unavailable)
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: correct reservoir and coastal descriptions"
```

---

## Self-Review

**Spec coverage:** probe (T4), error-vs-absence (T4), `displayName` fix for both datasets (T5), dynamic hide of card and tray (T5), history fetch (T2), averaging with null/sparse guards (T1), UI surfacing (T3), non-fatal history failure (T2), README (T6). The spec's "out of scope: flood layer" is honoured — no task touches it.

**Placeholders:** none; every code step carries real code.

**Type consistency:** `historicalMeans` (T1) → `shapeReservoir(station, today, history)` (T2) → `mean5yr`/`mean10yr` on `Reservoir` and map properties (T3). `probeCoastalService` and `degraded` (T4) → `coastalHealth`/`setCoastalHealth` (T5). `historicalMeanPercent` is removed in T3 and referenced nowhere after.

**Known limitation:** Task 4's `'ok'` branch is covered only by mocked responses — it cannot be verified end-to-end while MITERD is down.
