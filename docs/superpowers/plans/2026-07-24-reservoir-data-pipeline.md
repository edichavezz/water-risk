# Reservoir Data Pipeline & Supply-System Matching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two related problems in one pipeline: (1) reservoir levels are a hand-typed, months-stale snapshot with no freshness signal, and (2) the reservoir list is incomplete for most locations (e.g. postcode 41500 / Alcalá de Guadaíra shows 2 reservoirs when 7 actually supply it) because matching is pure straight-line distance. Both are fixed by switching to REDIAM's live JSON feed as the single source of truth, refreshed on a schedule, plus a hand-maintained "which utility serves which town" overlay for matching.

**Architecture:** A build-time/CI script fetches Junta de Andalucía's REDIAM reservoir feed (undocumented but real JSON API, confirmed working — see "Data Source" below), converts its UTM coordinates to lat/lng, and writes a committed `reservoirs.generated.json`. A small hand-maintained file maps REDIAM station codes to "supply systems" (utility name + municipalities served), based on province-by-province research already completed. The app's matching function tries system-match first, falls back to proximity — this stays additive so no location ever regresses to zero reservoirs. A GitHub Actions cron job re-runs the fetch daily and commits the refreshed data, which redeploys through the existing static-hosting pipeline. This is still "static bundled data" per the app's no-backend architecture — nothing fetches over the network at request time.

**Tech Stack:** TypeScript, Vite, React, Zustand, Node.js script (`proj4` for coordinate conversion). Adds `vitest` (no test framework exists in the repo today) and `proj4` as devDependencies. No new runtime dependencies — the generated JSON is a static import like the existing SINAC/IGME pattern in `DATA-SOURCES.md`.

## Global Constraints

- No backend — bundled/generated static data only, refreshed by CI, not fetched from the browser at request time (per `ARCHITECTURE.md` "Why no backend?").
- Municipality matching must be diacritic/case-insensitive (`Cádiz` must match `cadiz`, `cádiz`, `CÁDIZ`).
- If the REDIAM fetch fails, keep the last committed `reservoirs.generated.json` unchanged rather than failing the build or writing partial data.
- If a `cod_est` referenced in the hand-maintained supply-system mapping disappears from the live feed, this must be caught by a test, not fail silently.
- Do not fabricate `historicalMeanPercent` — REDIAM's feed doesn't provide it, so it stays absent from the new pipeline (existing UI already renders fine without it: `mean !== undefined` check in `ReservoirCard.tsx`).
- Every reservoir carries a single `fetchedAt` freshness date from the feed's own `fecha` field — no per-reservoir date guessing.

---

## Data Source (verified 2026-07-24)

Junta de Andalucía's REDIAM "Embalses al día" viewer (`https://portalrediam.cica.es/embalses/`) is a small Leaflet app that calls its own JSON API — not documented publicly as an API, but stable, same-origin, no auth, no CORS restriction observed from a plain `curl`:

- `GET https://portalrediam.cica.es/embalses/api/json/embalses` — station metadata (73 Andalucía reservoirs): `cod_est`, `nombre`, `provincia`, `sistema` (hydrological regulation system name — official, but coarser/different grouping than "which town this feeds"), `dist_dem` (basin: `GUADALQUIVIR` / `MEDITERRÁNEO` / `GUADALETE - BARBATE` / `TINTO - ODIEL - PIEDRAS`), `nombre_rio`, `geom` (`POINT (x y)` in EPSG:25830 / ETRS89 UTM zone 30N).
- `GET https://portalrediam.cica.es/embalses/api/json/andalucia` — today's reading for every station in one response: `{"fecha":"2026-07-24","E01_res":422.68,"E01_cap":505.7,"E01_por":83.6, ...}` (`_res` = stored hm³, `_cap` = capacity hm³, `_por` = fill %).

**CRS verified:** converted 5 sample points (EPSG:25830 → EPSG:4326 via `proj4`) and cross-checked against independently-sourced Wikipedia coordinates for the same reservoirs — Aracena and Gergal matched within ~500 m, the rest within a few km (expected for large, elongated reservoirs where "the point" and "the dam" aren't identical). Confirms EPSG:25830 is correct; no zone/CRS bug.

**Why REDIAM over embalses.net or SAIH Guadalquivir's own portal:** SAIH Guadalquivir (`chguadalquivir.es/saih`) is ASP.NET WebForms with server-side postbacks — no clean data endpoint, would require fragile scraping (the project's own `DATA-SOURCES.md` already flags this as untested/deferred). embalses.net is a third-party aggregator with no documented API or scraping terms. REDIAM is the official Junta de Andalucía government source, covers all of Andalucía (not just the Guadalquivir basin), and has a real JSON endpoint.

---

## Supply-System Research (re-keyed to REDIAM `cod_est` codes)

Same province-by-province research as before (utility names, municipalities served), now mapped to REDIAM station codes instead of hand-typed reservoir records. REDIAM's own `sistema` field independently corroborates several of these groupings — e.g. `E57/E58/E61/E62/E63/E64/E65` all carry `sistema` values of `VIAR` or `ABASTECIMIENTO DE SEVILLA`, matching EMASESA's 7 reservoirs exactly; `E17/E31` are both tagged `ABASTECIMIENTO DE JAÉN` (this also surfaced a reservoir the manual research missed: **Embalse de Víboras**, `E31`). Reservoirs not listed in any system below (e.g. the 16 `SISTEMA DE REGULACIÓN GENERAL` headwater/irrigation reservoirs in Jaén/Córdoba) are intentionally left unmapped — they still appear in the base dataset and surface via the proximity fallback, they just aren't tied to a specific municipal utility.

**Correction found during Task 2 implementation (2026-07-24):** `S19` (Embalse de Casasola, Málaga) is a real REDIAM station but has no current fill reading — the live feed returns `null` for it, so Task 1's fetch script correctly omits it from `reservoirs.generated.json` (72 of 73 stations were written; `S19` was the one skipped, logged by the script's "no fill reading" warning). The table below and the `malaga-emasa` entry in Task 2's code already exclude `S19` for this reason — this is the live feed's current state on the date this data was fetched, not a research error, and it's exactly the scenario the plan's Task 2 data-integrity test exists to catch. If Casasola starts reporting again in a future refresh, it can be added back.

| System id | Name | Province | Serves (known examples) | `cod_est`s |
|---|---|---|---|---|
| sevilla-emasesa | EMASESA | Sevilla | Sevilla, Alcalá de Guadaíra, Camas, Castilleja de la Cuesta, Coria del Río, Gelves, Mairena del Aljarafe, San Juan de Aznalfarache, Santiponce, Tomares, La Rinconada | E57, E58, E61, E62, E63, E64, E65 |
| malaga-emasa | EMASA | Málaga | Málaga, Torremolinos, Alhaurín de la Torre | S29, S30, S31, S20 (S19/Casasola excluded — not in the live feed, see below) |
| malaga-acosol | Acosol | Málaga | Marbella, Benahavís, Benalmádena, Estepona, Fuengirola, Istán, Manilva, Mijas, Ojén, Casares | S16 |
| malaga-axaragua | Axaragua | Málaga | Vélez-Málaga, Torrox, Nerja, Rincón de la Victoria, Alcaucín | S37 |
| granada-emasagra | EMASAGRA | Granada | Granada, Cúllar Vega, Las Gabias | E41, E42, E44, E45 |
| granada-costatropical | Sistema Béznar-Rules (Costa Tropical) | Granada | Almuñécar, Motril, Salobreña | S51, S64 |
| granada-gemalsa-loja | Gemalsa | Granada | Loja | E46 |
| granada-baza-guadix | Sistema Negratín (Baza/Guadix) | Granada | Freila, Guadix, Zújar, Baza, Benamaurel, Cortes de Baza, Cuevas del Campo | E06 |
| cordoba-emacsa | EMACSA | Córdoba | Córdoba | E29, E30 |
| cordoba-emproacsa-sur | EMPROACSA — Zona Sur | Córdoba | Lucena, Puente Genil, Baena, Montilla, Aguilar de la Frontera, Montalbán de Córdoba, Castro del Río, La Rambla, Fernán-Núñez, Nueva Carteya, Doña Mencía, Luque, Zuheros | E48 |
| cordoba-emproacsa-norte | EMPROACSA — Zona Norte (Guadiato) | Córdoba | Peñarroya-Pueblonuevo, Belmez, Fuente Obejuna, Espiel, Villaviciosa de Córdoba, Los Blázquez | E33, E34 |
| cordoba-emproacsa-oriental | EMPROACSA — Zona Oriental | Córdoba | Montoro, Cardeña | E27 |
| cadiz-cazg | Consorcio de Aguas de la Zona Gaditana | Cádiz | Cádiz, San Fernando, Puerto Real, Chiclana de la Frontera, El Puerto de Santa María, Rota, Sanlúcar de Barrameda, Chipiona, Conil de la Frontera, Vejer de la Frontera, Barbate, Medina Sidonia, Arcos de la Frontera, Jerez de la Frontera, Paterna de Rivera, Trebujena, Benalup-Casas Viejas, San José del Valle, Algar | E73, E72, E75 |
| cadiz-arcgisa | ARCGISA (Campo de Gibraltar) | Cádiz | San Roque, Castellar de la Frontera, Jimena de la Frontera, Los Barrios, La Línea de la Concepción, San Martín del Tesorillo, Tarifa | S08, S03, E77 |
| huelva-giahsa | Giahsa | Huelva | Huelva, Punta Umbría, Isla Cristina, Ayamonte, Lepe, Cartaya, La Palma del Condado, Palos de la Frontera | T07, T01, T03, T04 |
| huelva-jarrama | Sistema Jarrama (Cuenca Minera) | Huelva | Berrocal, El Campillo, Campofrío, La Granada de Riotinto, Minas de Riotinto, Nerva, Valverde del Camino, Zalamea la Real | T06 |
| huelva-corumbel | Corumbel Bajo (Condado) | Huelva | La Palma del Condado | T05 |
| almeria-capital | Almería capital / Bajo Andarax | Almería | Almería, El Ejido, La Mojonera, Roquetas de Mar, Vícar | S58 |
| almeria-galasa | GALASA (Levante Almeriense) | Almería | Cuevas del Almanzora, Pulpí, Vera, Mojácar, Garrucha, Huércal-Overa | S84 |
| jaen-capital | Sistema Quiebrajano (Jaén capital) | Jaén | Jaén | E17, E31 |
| jaen-rumblar | Sistema Rumblar | Jaén | Andújar, Bailén, Mengíbar, Villatorres, Marmolejo, Guarromán, Carboneros, Espeluy, Cazalilla, Jabalquinto, Villanueva de la Reina | E19 |
| jaen-laloma | Consorcio de La Loma | Jaén | Úbeda, Baeza | E02 |

**Caveat to preserve in code comments:** `servesMunicipalities` lists are the municipalities each utility's own public info explicitly confirms — not exhaustive. This is why proximity fallback stays in place permanently, not as a transition shim.

---

## File Structure

- Create: `app/scripts/fetch-reservoirs.mjs` — Node script, fetches REDIAM feed, converts coordinates, writes the generated data file. Run manually (`npm run fetch:reservoirs`) and by CI.
- Create: `app/src/data/reservoirs.generated.json` — committed output of the script. This is the "bundled dataset" the app actually reads (same pattern as `DATA-SOURCES.md`'s SINAC/IGME bundled files), refreshed daily by CI, not fetched by the browser.
- Create: `app/src/data/supplySystems.ts` — hand-maintained `SupplySystem[]`, the table above as code.
- Modify: `app/src/services/reservoirs.ts` — replace the static `ANDALUCIA_RESERVOIRS` array with logic that reads `reservoirs.generated.json` + `supplySystems.ts`; add `normalizeMunicipio()` and `getReservoirsForLocation()`.
- Modify: `app/src/types/index.ts` — extend `Reservoir` with `fillPercentAsOf: string` and `systemName?: string`.
- Modify: `app/src/components/Search/SearchBar.tsx` — call `getReservoirsForLocation(result)`.
- Modify: `app/src/components/RiskPanel/ReservoirCard.tsx` — show system name and freshness date.
- Create: `.github/workflows/refresh-reservoir-data.yml` — daily cron.
- Test: `app/scripts/fetch-reservoirs.test.mjs`, `app/src/data/supplySystems.test.ts`, `app/src/services/reservoirs.test.ts`.
- Modify: `app/package.json` — add `vitest`, `proj4`, `test` script, `fetch:reservoirs` script.
- Modify: `app/vite.config.ts` — add `test` config block.
- Modify: `app/tsconfig.json` — add `resolveJsonModule: true` so `services/reservoirs.ts` can import the generated JSON.

**Interfaces produced (for later tasks in this plan to consume):**
```ts
// app/src/data/reservoirs.generated.json shape
interface GeneratedReservoirData {
  fetchedAt: string // ISO date, from REDIAM's `fecha`
  reservoirs: Array<{
    codEst: string
    name: string
    province: string
    river: string
    system: string   // REDIAM's own hydrological grouping, informational only
    basin: string
    lat: number
    lng: number
    fillPercent: number
    storedHm3: number
    capacityHm3: number
  }>
}

// app/src/data/supplySystems.ts
export interface SupplySystem {
  id: string
  name: string
  province: string
  servesMunicipalities: string[] // lowercase, no diacritics
  reservoirCodEsts: string[]
}
export const SUPPLY_SYSTEMS: SupplySystem[]

// app/src/services/reservoirs.ts
export function normalizeMunicipio(s: string): string
export function getReservoirsForLocation(location: SearchResult): Reservoir[]
export function getNearbyReservoirs(coords: Coordinates, radiusKm?: number, limit?: number): Reservoir[]
export function getAllReservoirsGeoJSON(): GeoJSON.FeatureCollection
export function fillColour(pct: number): string
```

---

### Task 1: Fetch script — REDIAM feed to generated JSON

**Files:**
- Modify: `app/package.json`
- Modify: `app/vite.config.ts`
- Modify: `app/tsconfig.json`
- Create: `app/scripts/fetch-reservoirs.mjs`
- Create: `app/src/data/reservoirs.generated.json` (initial run output)
- Test: `app/scripts/fetch-reservoirs.test.mjs`

**Interfaces:**
- Produces: `reservoirs.generated.json` in the shape defined above (Task 2/3 consume it).

- [ ] **Step 1: Add dependencies and scripts**

```bash
cd app && npm install -D vitest proj4
```

Edit `app/package.json` `scripts` block — add:
```json
"test": "vitest run",
"fetch:reservoirs": "node scripts/fetch-reservoirs.mjs"
```

Edit `app/vite.config.ts` — current content is:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
```
Replace with:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
  },
})
```

Edit `app/tsconfig.json` — Task 2 and Task 3 both import `reservoirs.generated.json` directly (`import generated from '../data/reservoirs.generated.json'`), which needs `resolveJsonModule`. Current `compilerOptions` block is:
```json
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
```
Replace with:
```json
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
```

- [ ] **Step 2: Write the failing test for the pure conversion/shaping logic**

The script does I/O (network + filesystem), so we test its pure parsing helpers in isolation rather than the `main()` entrypoint. Create `app/scripts/fetch-reservoirs.test.mjs`:
```js
import { describe, it, expect } from 'vitest'
import { parseGeom, shapeReservoir } from './fetch-reservoirs.mjs'

describe('parseGeom', () => {
  it('converts EPSG:25830 POINT geometry to lat/lng within known tolerance', () => {
    // E61 Aracena — verified 2026-07-24 against Wikipedia (37.90917, -6.45)
    const { lat, lng } = parseGeom('POINT (196526.95376674 4201216.1089422)')
    expect(lat).toBeGreaterThan(37.85)
    expect(lat).toBeLessThan(37.95)
    expect(lng).toBeGreaterThan(-6.5)
    expect(lng).toBeLessThan(-6.4)
  })

  it('throws on unparseable geometry', () => {
    expect(() => parseGeom('not a point')).toThrow()
  })
})

describe('shapeReservoir', () => {
  it('combines station metadata and today reading into one record', () => {
    const station = { cod_est: 'E61', nombre: 'ARACENA', provincia: 'Huelva ', sistema: 'ABASTECIMIENTO DE SEVILLA', dist_dem: 'GUADALQUIVIR', nombre_rio: 'Rivera de Huelva', geom: 'POINT (196526.95376674 4201216.1089422)' }
    const today = { fecha: '2026-07-24', E61_res: 102.75, E61_cap: 128.65, E61_por: 79.9 }
    const result = shapeReservoir(station, today)
    expect(result).toMatchObject({
      codEst: 'E61',
      name: 'ARACENA',
      province: 'Huelva',
      river: 'Rivera de Huelva',
      basin: 'GUADALQUIVIR',
      fillPercent: 79.9,
      storedHm3: 102.75,
      capacityHm3: 128.65,
    })
    expect(result.lat).toBeCloseTo(37.9, 1)
    expect(result.lng).toBeCloseTo(-6.45, 1)
  })

  it('returns null when there is no fill reading for the station', () => {
    const station = { cod_est: 'X99', nombre: 'GHOST', provincia: 'Test', sistema: 'X', dist_dem: 'X', nombre_rio: 'X', geom: 'POINT (196526.95376674 4201216.1089422)' }
    const today = { fecha: '2026-07-24' }
    expect(shapeReservoir(station, today)).toBeNull()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npx vitest run scripts/fetch-reservoirs.test.mjs`
Expected: FAIL — `./fetch-reservoirs.mjs` module not found.

- [ ] **Step 4: Implement the script**

Create `app/scripts/fetch-reservoirs.mjs`:
```js
#!/usr/bin/env node
import { writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import proj4 from 'proj4'

proj4.defs('EPSG:25830', '+proj=utm +zone=30 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs')

const STATIONS_URL = 'https://portalrediam.cica.es/embalses/api/json/embalses'
const TODAY_URL = 'https://portalrediam.cica.es/embalses/api/json/andalucia'
const OUTPUT_PATH = fileURLToPath(new URL('../src/data/reservoirs.generated.json', import.meta.url))

export function parseGeom(geom) {
  const match = geom.match(/POINT \(([-\d.]+) ([-\d.]+)\)/)
  if (!match) throw new Error(`Unparseable geom: ${geom}`)
  const x = parseFloat(match[1])
  const y = parseFloat(match[2])
  const [lng, lat] = proj4('EPSG:25830', 'EPSG:4326', [x, y])
  return { lat: Math.round(lat * 10000) / 10000, lng: Math.round(lng * 10000) / 10000 }
}

export function shapeReservoir(station, today) {
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
  }
}

async function main() {
  let stations, today
  try {
    const [stationsRes, todayRes] = await Promise.all([fetch(STATIONS_URL), fetch(TODAY_URL)])
    if (!stationsRes.ok || !todayRes.ok) {
      throw new Error(`REDIAM responded stations=${stationsRes.status} today=${todayRes.status}`)
    }
    stations = await stationsRes.json()
    today = await todayRes.json()
  } catch (err) {
    if (existsSync(OUTPUT_PATH)) {
      console.warn(`REDIAM fetch failed (${err.message}). Keeping existing reservoirs.generated.json unchanged.`)
      process.exit(0)
    }
    throw err
  }

  const reservoirs = stations
    .map(s => shapeReservoir(s, today))
    .filter(Boolean)

  const skipped = stations.length - reservoirs.length
  if (skipped > 0) {
    console.warn(`${skipped} station(s) had no fill reading for ${today.fecha} and were skipped.`)
  }

  writeFileSync(OUTPUT_PATH, JSON.stringify({ fetchedAt: today.fecha, reservoirs }, null, 2) + '\n')
  console.log(`Wrote ${reservoirs.length} reservoirs (data as of ${today.fecha}) to ${OUTPUT_PATH}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error(err)
    process.exit(1)
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run scripts/fetch-reservoirs.test.mjs`
Expected: PASS (4 tests)

- [ ] **Step 6: Run the script for real to generate the initial data file**

Run: `cd app && npm run fetch:reservoirs`
Expected output: `Wrote 7X reservoirs (data as of 2026-MM-DD) to .../reservoirs.generated.json`. Confirm the file was created and spot-check 2-3 entries (e.g. `codEst: "E61"` should have `name: "ARACENA"`, `lat` around `37.9`).

- [ ] **Step 7: Commit**

```bash
git add app/package.json app/package-lock.json app/vite.config.ts app/tsconfig.json app/scripts/fetch-reservoirs.mjs app/scripts/fetch-reservoirs.test.mjs app/src/data/reservoirs.generated.json
git commit -m "feat: fetch live Andalucía reservoir data from REDIAM"
```

---

### Task 2: Supply-system mapping and matching logic

**Files:**
- Create: `app/src/data/supplySystems.ts`
- Test: `app/src/data/supplySystems.test.ts`
- Modify: `app/src/types/index.ts`
- Modify: `app/src/services/reservoirs.ts`
- Test: `app/src/services/reservoirs.test.ts`

**Interfaces:**
- Consumes: `reservoirs.generated.json` (Task 1).
- Produces: `SUPPLY_SYSTEMS`, `normalizeMunicipio()`, `getReservoirsForLocation()` (Task 3 imports these).

- [ ] **Step 1: Write the failing data-integrity test**

Create `app/src/data/supplySystems.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { SUPPLY_SYSTEMS } from './supplySystems'
import generated from './reservoirs.generated.json'

describe('supply system data integrity', () => {
  it('every reservoirCodEst referenced by a supply system exists in the live feed', () => {
    const knownCodEsts = new Set(generated.reservoirs.map(r => r.codEst))
    for (const system of SUPPLY_SYSTEMS) {
      for (const codEst of system.reservoirCodEsts) {
        expect(knownCodEsts.has(codEst), `${system.id} references unknown cod_est ${codEst}`).toBe(true)
      }
    }
  })

  it('every supply system id is unique', () => {
    const ids = SUPPLY_SYSTEMS.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has at least 20 systems covering all 8 Andalucía provinces', () => {
    expect(SUPPLY_SYSTEMS.length).toBeGreaterThanOrEqual(20)
    const provinces = new Set(SUPPLY_SYSTEMS.map(s => s.province))
    expect(provinces).toEqual(new Set(['Sevilla', 'Málaga', 'Granada', 'Córdoba', 'Cádiz', 'Huelva', 'Almería', 'Jaén']))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run src/data/supplySystems.test.ts`
Expected: FAIL — `./supplySystems` module not found.

- [ ] **Step 3: Create the mapping file**

Create `app/src/data/supplySystems.ts` (data transcribed from the research table above):
```ts
export interface SupplySystem {
  id: string
  name: string
  province: string
  servesMunicipalities: string[] // lowercase, no diacritics; best-effort, not exhaustive — see reservoirs.ts fallback
  reservoirCodEsts: string[]
}

export const SUPPLY_SYSTEMS: SupplySystem[] = [
  { id: 'sevilla-emasesa', name: 'EMASESA', province: 'Sevilla',
    servesMunicipalities: ['sevilla', 'alcala de guadaira', 'camas', 'castilleja de la cuesta', 'coria del rio', 'gelves', 'mairena del aljarafe', 'san juan de aznalfarache', 'santiponce', 'tomares', 'la rinconada'],
    reservoirCodEsts: ['E57', 'E58', 'E61', 'E62', 'E63', 'E64', 'E65'] },
  { id: 'malaga-emasa', name: 'EMASA', province: 'Málaga',
    servesMunicipalities: ['malaga', 'torremolinos', 'alhaurin de la torre'],
    // S19 (Casasola) excluded: not currently in the live REDIAM feed (no fill reading) — see plan's "Correction found during Task 2 implementation" note
    reservoirCodEsts: ['S29', 'S30', 'S31', 'S20'] },
  { id: 'malaga-acosol', name: 'Acosol', province: 'Málaga',
    servesMunicipalities: ['marbella', 'benahavis', 'benalmadena', 'estepona', 'fuengirola', 'istan', 'manilva', 'mijas', 'ojen', 'casares'],
    reservoirCodEsts: ['S16'] },
  { id: 'malaga-axaragua', name: 'Axaragua', province: 'Málaga',
    servesMunicipalities: ['velez-malaga', 'torrox', 'nerja', 'rincon de la victoria', 'alcaucin'],
    reservoirCodEsts: ['S37'] },
  { id: 'granada-emasagra', name: 'EMASAGRA', province: 'Granada',
    servesMunicipalities: ['granada', 'cullar vega', 'las gabias'],
    reservoirCodEsts: ['E41', 'E42', 'E44', 'E45'] },
  { id: 'granada-costatropical', name: 'Sistema Béznar-Rules (Costa Tropical)', province: 'Granada',
    servesMunicipalities: ['almunecar', 'motril', 'salobrena'],
    reservoirCodEsts: ['S51', 'S64'] },
  { id: 'granada-gemalsa-loja', name: 'Gemalsa', province: 'Granada',
    servesMunicipalities: ['loja'],
    reservoirCodEsts: ['E46'] },
  { id: 'granada-baza-guadix', name: 'Sistema Negratín (Baza/Guadix)', province: 'Granada',
    servesMunicipalities: ['freila', 'guadix', 'zujar', 'baza', 'benamaurel', 'cortes de baza', 'cuevas del campo'],
    reservoirCodEsts: ['E06'] },
  { id: 'cordoba-emacsa', name: 'EMACSA', province: 'Córdoba',
    servesMunicipalities: ['cordoba'],
    reservoirCodEsts: ['E29', 'E30'] },
  { id: 'cordoba-emproacsa-sur', name: 'EMPROACSA — Zona Sur', province: 'Córdoba',
    servesMunicipalities: ['lucena', 'puente genil', 'baena', 'montilla', 'aguilar de la frontera', 'montalban de cordoba', 'castro del rio', 'la rambla', 'fernan-nunez', 'nueva carteya', 'dona mencia', 'luque', 'zuheros'],
    reservoirCodEsts: ['E48'] },
  { id: 'cordoba-emproacsa-norte', name: 'EMPROACSA — Zona Norte (Guadiato)', province: 'Córdoba',
    servesMunicipalities: ['penarroya-pueblonuevo', 'belmez', 'fuente obejuna', 'espiel', 'villaviciosa de cordoba', 'los blazquez'],
    reservoirCodEsts: ['E33', 'E34'] },
  { id: 'cordoba-emproacsa-oriental', name: 'EMPROACSA — Zona Oriental', province: 'Córdoba',
    servesMunicipalities: ['montoro', 'cardena'],
    reservoirCodEsts: ['E27'] },
  { id: 'cadiz-cazg', name: 'Consorcio de Aguas de la Zona Gaditana', province: 'Cádiz',
    servesMunicipalities: ['cadiz', 'san fernando', 'puerto real', 'chiclana de la frontera', 'el puerto de santa maria', 'rota', 'sanlucar de barrameda', 'chipiona', 'conil de la frontera', 'vejer de la frontera', 'barbate', 'medina sidonia', 'arcos de la frontera', 'jerez de la frontera', 'paterna de rivera', 'trebujena', 'benalup-casas viejas', 'san jose del valle', 'algar'],
    reservoirCodEsts: ['E73', 'E72', 'E75'] },
  { id: 'cadiz-arcgisa', name: 'ARCGISA (Campo de Gibraltar)', province: 'Cádiz',
    servesMunicipalities: ['san roque', 'castellar de la frontera', 'jimena de la frontera', 'los barrios', 'la linea de la concepcion', 'san martin del tesorillo', 'tarifa'],
    reservoirCodEsts: ['S08', 'S03', 'E77'] },
  { id: 'huelva-giahsa', name: 'Giahsa', province: 'Huelva',
    servesMunicipalities: ['huelva', 'punta umbria', 'isla cristina', 'ayamonte', 'lepe', 'cartaya', 'la palma del condado', 'palos de la frontera'],
    reservoirCodEsts: ['T07', 'T01', 'T03', 'T04'] },
  { id: 'huelva-jarrama', name: 'Sistema Jarrama (Cuenca Minera)', province: 'Huelva',
    servesMunicipalities: ['berrocal', 'el campillo', 'campofrio', 'la granada de riotinto', 'minas de riotinto', 'nerva', 'valverde del camino', 'zalamea la real'],
    reservoirCodEsts: ['T06'] },
  { id: 'huelva-corumbel', name: 'Corumbel Bajo (Condado)', province: 'Huelva',
    servesMunicipalities: ['la palma del condado'],
    reservoirCodEsts: ['T05'] },
  { id: 'almeria-capital', name: 'Almería capital / Bajo Andarax', province: 'Almería',
    servesMunicipalities: ['almeria', 'el ejido', 'la mojonera', 'roquetas de mar', 'vicar'],
    reservoirCodEsts: ['S58'] },
  { id: 'almeria-galasa', name: 'GALASA (Levante Almeriense)', province: 'Almería',
    servesMunicipalities: ['cuevas del almanzora', 'pulpi', 'vera', 'mojacar', 'garrucha', 'huercal-overa'],
    reservoirCodEsts: ['S84'] },
  { id: 'jaen-capital', name: 'Sistema Quiebrajano (Jaén capital)', province: 'Jaén',
    servesMunicipalities: ['jaen'],
    reservoirCodEsts: ['E17', 'E31'] },
  { id: 'jaen-rumblar', name: 'Sistema Rumblar', province: 'Jaén',
    servesMunicipalities: ['andujar', 'bailen', 'mengibar', 'villatorres', 'marmolejo', 'guarroman', 'carboneros', 'espeluy', 'cazalilla', 'jabalquinto', 'villanueva de la reina'],
    reservoirCodEsts: ['E19'] },
  { id: 'jaen-laloma', name: 'Consorcio de La Loma', province: 'Jaén',
    servesMunicipalities: ['ubeda', 'baeza'],
    reservoirCodEsts: ['E02'] },
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run src/data/supplySystems.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Extend the `Reservoir` type**

In `app/src/types/index.ts`, replace:
```ts
export interface Reservoir {
  name: string
  fillPercent: number
  historicalMeanPercent?: number
  distanceKm: number
  basin: string
}
```
with:
```ts
export interface Reservoir {
  name: string
  fillPercent: number
  fillPercentAsOf: string
  historicalMeanPercent?: number
  distanceKm: number
  basin: string
  systemName?: string
}
```

- [ ] **Step 6: Write the failing matching-logic tests**

Create `app/src/services/reservoirs.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { normalizeMunicipio, getReservoirsForLocation } from './reservoirs'
import type { SearchResult } from '../types'

describe('normalizeMunicipio', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalizeMunicipio('Cádiz')).toBe('cadiz')
    expect(normalizeMunicipio('Alcalá de Guadaíra')).toBe('alcala de guadaira')
    expect(normalizeMunicipio('JAÉN')).toBe('jaen')
  })
})

describe('getReservoirsForLocation', () => {
  it('returns all 7 EMASESA reservoirs for Alcalá de Guadaíra (postcode 41500 area)', () => {
    const location: SearchResult = {
      displayName: 'Alcalá de Guadaíra, Sevilla, Spain',
      coordinates: { lat: 37.338, lng: -5.847 },
      municipio: 'Alcalá de Guadaíra',
      provincia: 'Sevilla',
    }
    const result = getReservoirsForLocation(location)
    expect(result.length).toBe(7)
    expect(result.every(r => r.systemName === 'EMASESA')).toBe(true)
    const names = result.map(r => r.name.toUpperCase())
    for (const expected of ['ARACENA', 'ZUFRE', 'LA MINILLA', 'GERGAL', 'MELONARES', 'CALA', 'EL PINTADO']) {
      expect(names.some(n => n.includes(expected))).toBe(true)
    }
  })

  it('falls back to proximity when no municipality match exists', () => {
    const location: SearchResult = {
      displayName: 'Somewhere unmapped, Spain',
      coordinates: { lat: 37.338, lng: -5.847 },
      municipio: 'Not A Real Mapped Town',
      provincia: 'Sevilla',
    }
    const result = getReservoirsForLocation(location)
    expect(result.length).toBeGreaterThan(0)
    expect(result.every(r => r.systemName === undefined)).toBe(true)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].distanceKm).toBeGreaterThanOrEqual(result[i - 1].distanceKm)
    }
  })

  it('falls back to proximity when municipio is missing entirely', () => {
    const location: SearchResult = { displayName: 'Unknown', coordinates: { lat: 37.338, lng: -5.847 } }
    expect(getReservoirsForLocation(location).length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `cd app && npx vitest run src/services/reservoirs.test.ts`
Expected: FAIL — `getReservoirsForLocation` is not exported (or old implementation doesn't match).

- [ ] **Step 8: Implement**

Replace the full contents of `app/src/services/reservoirs.ts` with:
```ts
import type { Coordinates, Reservoir, SearchResult } from '../types'
import { SUPPLY_SYSTEMS } from '../data/supplySystems'
import generated from '../data/reservoirs.generated.json'

interface GeneratedReservoir {
  codEst: string
  name: string
  province: string
  river: string
  system: string
  basin: string
  lat: number
  lng: number
  fillPercent: number
  storedHm3: number
  capacityHm3: number
}

const RESERVOIRS = generated.reservoirs as GeneratedReservoir[]
const FETCHED_AT = generated.fetchedAt as string

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

export function normalizeMunicipio(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function toReservoir(r: GeneratedReservoir, coords: Coordinates, systemName?: string): Reservoir {
  return {
    name: titleCase(r.name),
    fillPercent: r.fillPercent,
    fillPercentAsOf: FETCHED_AT,
    basin: r.basin,
    distanceKm: Math.round(haversineKm(coords, r)),
    systemName,
  }
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i === 0 || w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
}

// Fill % → colour used by both the map circles and the panel bars
export function fillColour(pct: number): string {
  if (pct < 25) return '#ef4444'  // red
  if (pct < 40) return '#f97316'  // orange
  if (pct < 60) return '#eab308'  // yellow
  return '#3b82f6'                // blue
}

// GeoJSON for all reservoirs — used by MapView to render the layer
export function getAllReservoirsGeoJSON(): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: RESERVOIRS.map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        name: titleCase(r.name),
        fillPercent: r.fillPercent,
        historicalMeanPercent: null, // REDIAM's feed has no historical-mean field; kept for MapView.tsx's existing property shape
        basin: r.basin,
        colour: fillColour(r.fillPercent),
      },
    })),
  }
}

/**
 * First tries to match the location's municipality against a known supply
 * system (returns every reservoir feeding that system). Falls back to
 * nearest-3-within-80km when no system match is found — most Andalucía
 * municipalities aren't in the researched supply-system lists yet.
 */
export function getReservoirsForLocation(location: SearchResult): Reservoir[] {
  const coords = location.coordinates
  const municipio = location.municipio ? normalizeMunicipio(location.municipio) : ''

  if (municipio) {
    const matchedSystems = SUPPLY_SYSTEMS.filter(s => s.servesMunicipalities.includes(municipio))
    if (matchedSystems.length > 0) {
      const codEstToSystemName = new Map<string, string>()
      for (const s of matchedSystems) {
        for (const codEst of s.reservoirCodEsts) codEstToSystemName.set(codEst, s.name)
      }
      return RESERVOIRS
        .filter(r => codEstToSystemName.has(r.codEst))
        .map(r => toReservoir(r, coords, codEstToSystemName.get(r.codEst)))
        .sort((a, b) => a.distanceKm - b.distanceKm)
    }
  }

  return getNearbyReservoirs(coords)
}

export function getNearbyReservoirs(coords: Coordinates, radiusKm = 80, limit = 3): Reservoir[] {
  return RESERVOIRS.map(r => toReservoir(r, coords))
    .filter(r => r.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `cd app && npx vitest run src/services/reservoirs.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 10: Run full test suite and typecheck**

Run: `cd app && npx vitest run && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 11: Commit**

```bash
git add app/src/data/supplySystems.ts app/src/data/supplySystems.test.ts app/src/types/index.ts app/src/services/reservoirs.ts app/src/services/reservoirs.test.ts
git commit -m "feat: match reservoirs by supply system with proximity fallback"
```

---

### Task 3: Wire into search flow and UI

**Files:**
- Modify: `app/src/components/Search/SearchBar.tsx:7,68`
- Modify: `app/src/components/RiskPanel/ReservoirCard.tsx`
- Modify: `app/src/services/ai.ts:69`
- Modify: `app/src/i18n/en.json`, `app/src/i18n/es.json`

**Interfaces:**
- Consumes: `getReservoirsForLocation(location: SearchResult): Reservoir[]`, `Reservoir.systemName?: string`, `Reservoir.fillPercentAsOf: string` (Task 2).

- [ ] **Step 1: Update the call site**

In `app/src/components/Search/SearchBar.tsx`, change:
```ts
import { getNearbyReservoirs } from '../../services/reservoirs'
```
to:
```ts
import { getReservoirsForLocation } from '../../services/reservoirs'
```
And change line 68 from:
```ts
const reservoirs = getNearbyReservoirs(result.coordinates)
```
to:
```ts
const reservoirs = getReservoirsForLocation(result)
```

- [ ] **Step 2: Show system name and freshness in the card**

In `app/src/components/RiskPanel/ReservoirCard.tsx`, replace:
```tsx
              <FillBar percent={r.fillPercent} mean={r.historicalMeanPercent} />
              <div className="flex justify-between mt-0.5">
                <span className="text-xs text-gray-400">{r.distanceKm} km away</span>
                {r.historicalMeanPercent && (
                  <span className="text-xs text-gray-400">
                    {t('risk.reservoirs.historical', { mean: r.historicalMeanPercent })}
                  </span>
                )}
              </div>
```
with:
```tsx
              <FillBar percent={r.fillPercent} mean={r.historicalMeanPercent} />
              <div className="flex justify-between mt-0.5">
                <span className="text-xs text-gray-400">
                  {r.systemName ? r.systemName : `${r.distanceKm} km away`}
                </span>
                {r.historicalMeanPercent && (
                  <span className="text-xs text-gray-400">
                    {t('risk.reservoirs.historical', { mean: r.historicalMeanPercent })}
                  </span>
                )}
              </div>
```

Replace the footer line:
```tsx
      <p className="text-xs text-gray-400">Source: REDIAM / MITERD (static seed — live API in v2)</p>
```
with:
```tsx
      {reservoirs.length > 0 && (
        <p className="text-xs text-gray-400">{t('risk.reservoirs.asOf', { date: reservoirs[0].fillPercentAsOf })}</p>
      )}
```

- [ ] **Step 3: Fix the AI context builder's dead fallback text**

REDIAM's feed has no historical-mean field, so `Reservoir.historicalMeanPercent` will now be `undefined` for every reservoir (it was previously populated for all 17 hand-typed entries, so this fallback was never actually hit before). Left as-is, every AI-generated summary would now read "historical mean ~?%" for every reservoir. In `app/src/services/ai.ts`, replace:
```ts
      r => `${r.name}: ${r.fillPercent}% full (historical mean ~${r.historicalMeanPercent ?? '?'}%, ${r.distanceKm}km away)`
```
with:
```ts
      r => {
        const mean = r.historicalMeanPercent != null ? `, historical mean ~${r.historicalMeanPercent}%` : ''
        const source = r.systemName ? `via ${r.systemName}` : `${r.distanceKm}km away`
        return `${r.name}: ${r.fillPercent}% full${mean} (${source}, data as of ${r.fillPercentAsOf})`
      }
```

- [ ] **Step 4: Add the new i18n key**

In `app/src/i18n/en.json`, replace:
```json
    "reservoirs": {
      "title": "Nearby Reservoirs",
      "fill": "{{percent}}% full",
      "historical": "historical mean: {{mean}}%",
      "noData": "No reservoir data available nearby"
    },
```
with:
```json
    "reservoirs": {
      "title": "Nearby Reservoirs",
      "fill": "{{percent}}% full",
      "historical": "historical mean: {{mean}}%",
      "noData": "No reservoir data available nearby",
      "asOf": "REDIAM (Junta de Andalucía) — data as of {{date}}"
    },
```

In `app/src/i18n/es.json`, replace:
```json
    "reservoirs": {
      "title": "Embalses cercanos",
      "fill": "{{percent}}% de capacidad",
      "historical": "media histórica: {{mean}}%",
      "noData": "No hay datos de embalses disponibles en esta zona"
    },
```
with:
```json
    "reservoirs": {
      "title": "Embalses cercanos",
      "fill": "{{percent}}% de capacidad",
      "historical": "media histórica: {{mean}}%",
      "noData": "No hay datos de embalses disponibles en esta zona",
      "asOf": "REDIAM (Junta de Andalucía) — datos del {{date}}"
    },
```

- [ ] **Step 5: Manual verification**

Run: `cd app && npm run dev`
In the browser: search "41500" (or "Alcalá de Guadaíra"), confirm all 7 EMASESA reservoirs appear labelled "EMASESA" instead of "N km away", with a footer showing "REDIAM (Junta de Andalucía) — data as of {today's date}". Then search a rural town not in any `servesMunicipalities` list and confirm it still falls back to nearest-3 with "N km away" labels.

- [ ] **Step 6: Run full test suite**

Run: `cd app && npx vitest run && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add app/src/components/Search/SearchBar.tsx app/src/components/RiskPanel/ReservoirCard.tsx app/src/services/ai.ts app/src/i18n/en.json app/src/i18n/es.json
git commit -m "feat: show supply system and live data freshness in reservoir panel"
```

---

### Task 4: Daily scheduled refresh via GitHub Actions

**Files:**
- Create: `.github/workflows/refresh-reservoir-data.yml`

**Interfaces:**
- Consumes: `npm run fetch:reservoirs` (Task 1), `npm test` (Task 1/2).

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/refresh-reservoir-data.yml`:
```yaml
name: Refresh reservoir data

on:
  schedule:
    # 06:00 UTC daily — REDIAM's feed itself updates once/day from 8am readings,
    # so anything more frequent than daily would just re-fetch the same numbers.
    - cron: '0 6 * * *'
  workflow_dispatch: {}

permissions:
  contents: write

jobs:
  refresh:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: app/package-lock.json
      - run: npm ci
      - run: npm run fetch:reservoirs
      - run: npm test
      - name: Commit updated data if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          if git diff --quiet -- src/data/reservoirs.generated.json; then
            echo "No change in reservoir data — nothing to commit."
            exit 0
          fi
          git add src/data/reservoirs.generated.json
          git commit -m "chore: refresh reservoir data from REDIAM ($(date -u +%Y-%m-%d))"
          git push
```

**Why daily, not twice-daily or weekly:** REDIAM's own feed is sourced from readings taken once per day (per the REDIAM viewer's documentation, "8:00 a.m. data"); fetching more often would just re-request the same `fecha` value. Weekly would let the app drift up to 6 days stale relative to a source that itself updates daily — no reason to accept that gap when matching the source's own cadence costs nothing extra.

- [ ] **Step 2: Verify the workflow is syntactically valid**

Run: `cd app && npx --yes action-validator ../.github/workflows/refresh-reservoir-data.yml 2>/dev/null || echo "action-validator not available — visually confirm YAML indentation/structure against the block above instead"`

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/refresh-reservoir-data.yml
git commit -m "ci: refresh reservoir data from REDIAM daily"
```

- [ ] **Step 4: Note for the human operator (not an automatable step)**

This workflow needs to exist on the repo's default branch to run on schedule (GitHub only triggers `schedule` events from the default branch), and the redeploy step is whatever the hosting provider already does on push to that branch (Vercel/Netlify auto-deploy, per `ARCHITECTURE.md`'s Deployment section) — no additional deploy step needed here.

---

## Self-Review Notes

- **Spec coverage:** live data source (Task 1) ✓, "as of" freshness shown in UI (Task 3) ✓, daily scheduled refresh (Task 4) ✓, supply-system matching so postcode 41500 shows all 7 EMASESA reservoirs (Task 2/3) ✓, coverage across all of Andalucía, not just Sevilla (22 systems / 8 provinces, Task 2) ✓.
- **No placeholder data:** every `SupplySystem.reservoirCodEsts` entry is checked against the live feed by an automated test (Task 2 Step 1); the UTM conversion was verified against independently-sourced coordinates before being written into the plan, not assumed.
- **Failure modes handled:** REDIAM fetch failure keeps last-known-good data (Task 1); a `cod_est` disappearing from the feed fails the Task 2 integrity test, which the CI workflow runs before committing (Task 4), so a broken mapping blocks the auto-commit instead of silently shipping.
- **Backward compatibility:** `getNearbyReservoirs()` keeps its original signature; nothing outside `SearchBar.tsx` calls it, so no other code path breaks when Task 3 rewires that one call site.
