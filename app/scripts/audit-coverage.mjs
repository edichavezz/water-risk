/**
 * Data coverage audit.
 *
 * For each test location, runs every dataset the app defines and reports the
 * four things that have to agree before a user sees a truthful card:
 *
 *   map      — does the dataset's map layer actually paint here
 *   panel    — what `DatasetDef.fetch()` returns
 *   coverage — whether `lookupCoverage()` claims this dataset is available
 *   ai       — the evidence string `buildEvidence()` hands the model
 *
 * A mismatch between any two of those is a bug the UI cannot show you: a card
 * reading "no data" while the layer paints, or a coverage box promising a
 * dataset that holds nothing for the location.
 *
 * Runs the app's real modules through Vite's SSR loader against a live dev
 * server, so `/api/wms-proxy` behaves exactly as it does in the browser.
 *
 *   node scripts/audit-coverage.mjs [--json out.json]
 */
import { createServer } from 'vite'
import { writeFileSync } from 'node:fs'
import { installCanvasShims } from './pngPixel.mjs'

// A spread of Andalucía — coastal and inland, capital and village, in and out
// of the curated supply/quality datasets — plus two points outside the
// declared coverage region to check the unsupported path.
const LOCATIONS = [
  { q: 'Sevilla, España', note: 'inland capital, in SINAC + supply' },
  { q: 'Marbella, Málaga, España', note: 'coastal, in supply (Acosol)' },
  { q: 'Níjar, Almería, España', note: 'in the one Andalucían groundwater unit' },
  { q: 'Úbeda, Jaén, España', note: 'inland town, in supply (La Loma)' },
  { q: 'Aracena, Huelva, España', note: 'inland village, small system' },
  { q: 'Tarifa, Cádiz, España', note: 'coastal, Campo de Gibraltar' },
  { q: 'Guadix, Granada, España', note: 'inland, Negratín system' },
  { q: 'Zuheros, Córdoba, España', note: 'small inland village' },
  { q: 'Lepe, Huelva, España', note: 'coastal agricultural' },
  { q: 'Órgiva, Granada, España', note: 'Alpujarra, likely uncovered' },
  { q: 'Cartagena, Murcia, España', note: 'OUTSIDE coverage region' },
  { q: 'Valencia, España', note: 'OUTSIDE coverage region' },
]

// Parallel worktrees run their own dev servers, so this has to be movable:
// AUDIT_PORT=5210 node scripts/audit-coverage.mjs
const PORT = Number(process.env.AUDIT_PORT ?? 5199)
const BASE = `http://localhost:${PORT}`

/** Nominatim allows 1 req/s and wants a real User-Agent. */
let lastNominatim = 0
function installFetchShim() {
  const real = globalThis.fetch
  globalThis.fetch = async (input, init = {}) => {
    let url = typeof input === 'string' ? input : input.url
    // The app's browser-relative API paths have to reach the dev server.
    if (url.startsWith('/')) url = BASE + url
    if (url.includes('nominatim')) {
      const wait = 1100 - (Date.now() - lastNominatim)
      if (wait > 0) await new Promise(r => setTimeout(r, wait))
      lastNominatim = Date.now()
      init = {
        ...init,
        headers: { ...(init.headers ?? {}), 'User-Agent': 'aguariesgo-data-audit/1.0 (coverage audit)' },
      }
    }
    return real(url, init)
  }
}

/**
 * Whether a WMS layer paints anything at this point, kept separate from the
 * panel reading so an outage is distinguishable from a genuine empty area.
 * Returns the HTTP status and content type either way.
 */
async function probeWms(url, decodePixel) {
  try {
    const res = await fetch(url)
    const type = res.headers.get('content-type') ?? ''
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` }
    if (!type.startsWith('image/')) {
      const body = (await res.text()).slice(0, 200).replace(/\s+/g, ' ')
      return { ok: false, detail: `non-image (${type}): ${body}` }
    }
    if (!decodePixel) return { ok: true, detail: 'serves tiles' }
    const px = await decodePixel(url)
    return { ok: true, painted: px.a > 0, detail: px.a > 0 ? `painted rgba(${px.r},${px.g},${px.b},${px.a})` : 'transparent here' }
  } catch (e) {
    return { ok: false, detail: `fetch failed: ${e.message}` }
  }
}

async function main() {
  installCanvasShims()
  installFetchShim()

  const server = await createServer({
    server: { port: PORT, strictPort: true },
    logLevel: 'error',
  })
  await server.listen()

  const load = p => server.ssrLoadModule(p)
  const [registry, coverageMod, aiMod, geo, flood, drought, coastal, wmsSample] = await Promise.all([
    load('/src/registry/datasets.ts'),
    load('/src/services/coverage.ts'),
    load('/src/services/ai.ts'),
    load('/src/services/geocoding.ts'),
    load('/src/services/floodZone.ts'),
    load('/src/services/drought.ts'),
    load('/src/services/coastalFlood.ts'),
    load('/src/services/wmsSample.ts'),
  ])

  const decodePixel = url => wmsSample.samplePixel(url)
  const report = []

  for (const spec of LOCATIONS) {
    process.stderr.write(`\n── ${spec.q}\n`)
    let loc
    try {
      const hits = await geo.geocodeAddress(spec.q)
      loc = hits[0]
    } catch (e) {
      report.push({ query: spec.q, note: spec.note, geocodeError: e.message })
      continue
    }
    if (!loc) {
      report.push({ query: spec.q, note: spec.note, geocodeError: 'no results' })
      continue
    }

    const coverage = coverageMod.lookupCoverage(loc.coordinates)
    const entry = {
      query: spec.q,
      note: spec.note,
      resolved: loc.displayName,
      municipio: loc.municipio,
      provincia: loc.provincia,
      coords: loc.coordinates,
      coverageSupported: coverage.supported,
      coverageClaims: coverage.datasets,
      datasets: {},
    }

    // Map-layer probes at this point, per dataset.
    const mapProbes = {}
    for (const [layer, period] of Object.entries(flood.SNCZI_LAYERS)) {
      mapProbes[`flood:${layer}`] = await probeWms(
        flood.getSNCZISampleUrl(period, loc.coordinates), decodePixel)
    }
    mapProbes['drought'] = await probeWms(
      `${BASE}/api/wms-proxy?upstream=copernicus-drought&SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap` +
      `&LAYERS=cdiad&STYLES=&FORMAT=image/png&TRANSPARENT=true&SRS=EPSG:4326&WIDTH=3&HEIGHT=3` +
      `&BBOX=${loc.coordinates.lng - 0.0004},${loc.coordinates.lat - 0.0004},${loc.coordinates.lng + 0.0004},${loc.coordinates.lat + 0.0004}`,
      decodePixel)
    for (const [key, layer] of Object.entries(coastal.COASTAL_MAP_LAYERS)) {
      mapProbes[`coastal:${key}`] = await probeWms(
        `${BASE}${coastal.getCoastalWmsUrl(layer).replace('{bbox-epsg-3857}', '-600000,4400000,-500000,4500000')}`)
    }
    entry.mapProbes = mapProbes

    const results = {}
    for (const d of registry.DATASETS) {
      const applies = d.appliesTo(loc)
      if (!applies) {
        results[d.id] = { status: 'not_applicable' }
        entry.datasets[d.id] = {
          applies: false, panel: 'not_applicable',
          mapRole: d.mapRole, coverageClaimed: coverage.datasets.includes(d.id),
        }
        continue
      }
      const t0 = Date.now()
      const r = await d.fetch(loc)
      results[d.id] = r
      entry.datasets[d.id] = {
        applies: true,
        panel: r.status,
        data: r.status === 'available' ? summarise(d.id, r.data) : undefined,
        error: r.error,
        ms: Date.now() - t0,
        mapRole: d.mapRole,
        mapUnavailable: d.mapUnavailable ?? false,
        coverageClaimed: coverage.datasets.includes(d.id),
      }
      process.stderr.write(`   ${d.id.padEnd(13)} ${r.status}${r.error ? ` — ${r.error}` : ''}\n`)
    }

    // What the model would actually be told.
    for (const ev of aiMod.buildEvidence(results, 'en')) {
      if (entry.datasets[ev.id]) entry.datasets[ev.id].aiEvidence = ev.summary
    }

    report.push(entry)
  }

  await server.close()

  const jsonIdx = process.argv.indexOf('--json')
  const out = JSON.stringify(report, null, 2)
  if (jsonIdx !== -1 && process.argv[jsonIdx + 1]) {
    writeFileSync(process.argv[jsonIdx + 1], out)
    process.stderr.write(`\nwrote ${process.argv[jsonIdx + 1]}\n`)
  } else {
    console.log(out)
  }
}

/** Compact one-line rendering of a dataset payload, for the report. */
function summarise(id, data) {
  switch (id) {
    case 'flood': return data.inZone ? `inZone T${data.returnPeriod}` : 'not in zone'
    case 'drought': return `${data.level} (slice ${data.updatedAt}, stale=${data.stale})`
    case 'reservoirs': return `${data.length} reservoirs: ${data.map(r => `${r.name} ${r.fillPercent}%`).join(', ')}`
    case 'waterQuality': return `${data.compliance} ${data.year} (${data.sourceType})`
    case 'coastalFlood': return `zoning=${data.zoning ?? '—'} sens=${data.sensitivity ?? '—'} loc=${data.location ?? '—'}`
    case 'groundwater': return data.inOverexploitedUnit ? `IN ${data.unitName}` : 'not in an overexploited unit'
    case 'bathingWater': return `${data.siteName} ${data.distanceKm}km ${data.rating}`
    default: return JSON.stringify(data).slice(0, 120)
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
