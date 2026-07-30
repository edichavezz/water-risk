/**
 * Which time slice the drought layer is actually serving.
 *
 * The panel used to stamp `new Date()` on the drought reading, which asserted
 * that the data was current no matter how old it was. The CDI is published on a
 * 10-day cycle, so a real date is available — and when it is not available, the
 * honest answer is "unknown", never today.
 */

/**
 * How old a slice may be before the card says so. Comfortably beyond the 10-day
 * publishing cycle plus normal lag, so a routine late publication is not
 * reported as stale, while a genuinely abandoned feed is.
 */
export const STALE_AFTER_DAYS = 45

/**
 * Reads the newest date a layer's WMS time dimension offers.
 *
 * Handles both forms the spec allows: an enumerated list of values, and a
 * `start/end/period` interval, where only the end matters here. Returns null
 * rather than a guess whenever the dimension is missing or unreadable.
 */
export function parseLatestSlice(capabilities: string, layer: string): string | null {
  if (!capabilities || capabilities.includes('ServiceException')) return null

  // Find the <Layer> block whose <Name> is this layer, then its time Dimension.
  const layerBlocks = capabilities.match(/<Layer\b[\s\S]*?<\/Layer>/g) ?? []
  const block = layerBlocks.find(b =>
    new RegExp(`<Name>\\s*${layer}\\s*</Name>`).test(b),
  )
  if (!block) return null

  const dim = /<Dimension\b[^>]*name="time"[^>]*>([\s\S]*?)<\/Dimension>/i.exec(block)
    ?? /<Extent\b[^>]*name="time"[^>]*>([\s\S]*?)<\/Extent>/i.exec(block)
  const raw = dim?.[1]?.trim()
  if (!raw) return null

  // Last comma-separated entry, then the interval's end if it is one.
  const lastEntry = raw.split(',').map(s => s.trim()).filter(Boolean).pop()
  if (!lastEntry) return null
  const parts = lastEntry.split('/')
  const candidate = parts.length >= 2 ? parts[1] : parts[0]

  const date = /^(\d{4}-\d{2}-\d{2})/.exec(candidate.trim())?.[1]
  if (!date) return null
  return Number.isNaN(Date.parse(date)) ? null : date
}

/**
 * Finds the newest slice the service will actually serve, by asking for slices
 * back from today until one is accepted.
 *
 * Needed because the advertised dimension understates: cdiad publishes
 * `2012-01-01/2026-02-21/P10D` while happily serving 2026-06-01. Trusting the
 * metadata would date a current reading five months stale. Off-grid dates are
 * accepted by this service, so plain 10-day steps are enough.
 *
 * Capped so an abandoned feed does not turn into an unbounded scan — cdinx has
 * been dead since 2024, and 90 probes to discover that is not a trade worth
 * making. On reaching the cap the caller falls back to the advertised end,
 * which correctly identifies such a feed as very old.
 */
export const PROBE_STEP_DAYS = 10
export const MAX_PROBES = 12

export async function findServedSlice(
  probe: (date: string) => Promise<boolean>,
  now: Date = new Date(),
): Promise<string | null> {
  for (let i = 0; i < MAX_PROBES; i++) {
    const d = new Date(now.getTime() - i * PROBE_STEP_DAYS * 86_400_000)
    const iso = d.toISOString().slice(0, 10)
    if (await probe(iso)) return iso
  }
  return null
}

export interface Staleness {
  /** null when the slice date is unknown — distinct from "not stale". */
  stale: boolean | null
  ageDays: number | null
}

export function stalenessOf(slice: string | null, now: Date = new Date()): Staleness {
  if (!slice) return { stale: null, ageDays: null }
  const then = Date.parse(slice)
  if (Number.isNaN(then)) return { stale: null, ageDays: null }
  const ageDays = Math.floor((now.getTime() - then) / 86_400_000)
  return { stale: ageDays > STALE_AFTER_DAYS, ageDays }
}
