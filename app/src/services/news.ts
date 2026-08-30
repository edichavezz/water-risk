import type { PlaceContext } from '../types/place'
import type { NewsAnswer, NewsItem } from '../types/news'
import { allKeywords, classifyTitle, fold, sourceCountryFor } from '../data/newsKeywords'

/**
 * Recent headlines mentioning this area, from GDELT DOC 2.0.
 *
 * Three constraints shaped everything here, and none of them are negotiable
 * with a keyless source:
 *
 * 1. **There is no radius.** GDELT's `near20:` is *word* proximity, not
 *    distance, and its GEO API resolves no finer than a province. So this
 *    matches toponyms in article text — "news mentioning this area", never
 *    "news within 20 km". The copy has to say so, and the ranking below is what
 *    keeps the municipality above the province rather than pretending to a
 *    precision we do not have.
 *
 * 2. **One request per place.** The documented limit is one request every five
 *    seconds; in practice we were throttled on nearly every attempt over twenty
 *    minutes, from two networks. So we fetch a *month* once and split it by
 *    date on the client, rather than asking for a week and asking again for a
 *    month. Same answer, half the requests.
 *
 * 3. **A throttled response is not JSON and not a clean 4xx.** It is a
 *    plain-text notice, and a real 429 carries no CORS header at all. Both come
 *    back as `unreachable`, which callers must keep distinct from "no coverage
 *    found" — see `types/news.ts`.
 *
 * Called straight from the browser on purpose. Routing it through our
 * serverless proxy would funnel every reader onto one IP, which is the fastest
 * possible way to be blocked for good.
 */
const DOC_API = 'https://api.gdeltproject.org/api/v2/doc/doc'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

/** Enough to rank meaningfully, small enough not to look like a scrape. */
const MAX_RECORDS = 75

interface RawArticle {
  url?: string
  title?: string
  seendate?: string
  domain?: string
  language?: string
}

/**
 * The toponyms to search: the municipality, and its province alongside.
 *
 * Both go in one query rather than two, and `rank` separates them afterwards.
 * There is deliberately no second, wider ring. One was built and removed: its
 * toponyms were the province plus the full display name, and since a
 * province-titled article already matches here *and* survives `relevantHere`,
 * the only thing the wider ring added was `"Ronda, Málaga"` quoted whole,
 * which no headline writes. It spent a second request — the scarcest thing we
 * have against this API — to find nothing the first had not.
 *
 * A genuine widening step needs a region *name*, and `PlaceContext.region` is
 * an ISO code (`ES-AN`). Adding one is geocoder work, not a query change.
 */
export function toponymsFor(place: PlaceContext): string[] {
  const names = [place.municipality, place.provinceName].filter((n): n is string => !!n)
  // A place with neither — a bare map pin over open country — still has its
  // display name, which is better than an unbounded query.
  return names.length > 0 ? names : [place.displayName]
}

export function newsQueryUrl(place: PlaceContext): string {
  const places = toponymsFor(place).map(n => `"${n}"`).join(' OR ')
  const words = allKeywords(place.countryCode).join(' OR ')
  const country = sourceCountryFor(place.countryCode)

  const query = [
    `(${places})`,
    `(${words})`,
    // No `sourcelang`: it would drop Catalan, Basque, Galician, Occitan and
    // Corsican outlets — exactly the local coverage this feature is for.
    // `sourcecountry` alone is what keeps the feed off the US wires.
    ...(country ? [`sourcecountry:${country}`] : []),
  ].join(' AND ')

  const params = new URLSearchParams({
    query,
    mode: 'ArtList',
    format: 'json',
    // A month, always. The week is carved out of it client-side.
    timespan: '1m',
    sort: 'datedesc',
    maxrecords: String(MAX_RECORDS),
  })
  return `${DOC_API}?${params}`
}

/**
 * GDELT stamps articles `20260731T161500Z` — no separators in the date part,
 * which `new Date()` rejects outright as `Invalid Date`. Parsed by hand so a
 * format change fails loudly here instead of silently collapsing every article
 * into one time bucket.
 */
export function parseSeenDate(raw: string | undefined): number | null {
  const m = raw?.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/)
  if (m) {
    const [, y, mo, d, h, mi, s] = m
    return Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)
  }
  // Tolerate a plain ISO stamp too, in case the API is ever tidied up.
  const iso = raw ? Date.parse(raw) : NaN
  return Number.isNaN(iso) ? null : iso
}

/**
 * GDELT normalises headlines before storing them, which leaves punctuation
 * floating: `Sud - Ouest`, `folie  : à Marseille`, `voitures abîmées , et`.
 *
 * Only the spacing is repaired. The same normalisation also drops apostrophes
 * outright — `C'est` arrives as `Cest`, `l'odeur` as `lodeur` — and those are
 * deliberately left alone: restoring them means guessing where an apostrophe
 * belonged, and a headline is the one thing here quoted verbatim from someone
 * else. French spacing before `:` `;` `?` `!` is correct and stays.
 */
export function tidyTitle(title: string): string {
  return title
    .replace(/\s+([,.])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

export function shapeArticles(raw: RawArticle[], place: PlaceContext): NewsItem[] {
  const municipality = place.municipality ? fold(place.municipality) : null
  const province = place.provinceName ? fold(place.provinceName) : null
  const items: NewsItem[] = []

  for (const a of raw) {
    const seenAt = parseSeenDate(a.seendate)
    if (!a.url || !a.title || seenAt === null) continue
    const title = tidyTitle(a.title)
    const folded = fold(title)
    items.push({
      title,
      url: a.url,
      domain: a.domain ?? '',
      seenAt,
      language: a.language ?? '',
      hazard: classifyTitle(title, place.countryCode),
      namesMunicipality: municipality ? folded.includes(municipality) : false,
      namesProvince: province ? folded.includes(province) : false,
    })
  }
  return items
}

/**
 * Keep only headlines that name the place *and* say what they are about.
 *
 * GDELT matches the article *body*, and both halves of that failed visibly in
 * testing. Ronda's feed arrived carrying the 2027 solar eclipse, a Cerro del
 * Villar dig and Cordoban firefighters working a blaze in Ávila 500 km away —
 * each held the word "Ronda" somewhere and a hazard word somewhere else.
 * Filtering to titles that name the place fixed the geography and left the
 * topic: Málaga's municipal budget, the 2026 feria, and a Tom Jones listings
 * agenda, all matching a hazard keyword four paragraphs down.
 *
 * Ranking that below the real stories is not enough — it still sits under the
 * place's name, beside hazard data, borrowing its authority. So both tests are
 * required, and the honest cost is a feed that is often empty. `news.empty`
 * says so plainly rather than filling the space.
 *
 * The side effect is worth naming: every rendered item now carries a Fire or
 * Water pill, because an item with no hazard in its title no longer survives.
 *
 * The filter is not free, and the cost is invisible from here. `maxrecords=75`
 * with `sort=datedesc` truncates *server-side*, before any of this runs: GDELT
 * returns the 75 most recent articles of the month and we then keep the handful
 * whose titles qualify. In a busy province those 75 can be filled by recent
 * body-only matches while a genuinely local story from three weeks ago never
 * reaches us at all.
 */
export function relevantHere(items: NewsItem[]): NewsItem[] {
  return items.filter(i => (i.namesMunicipality || i.namesProvince) && i.hazard !== null)
}

/**
 * Municipality mentions first, then recency.
 *
 * The toponym test is the primary key, not a tiebreaker, because ambiguous
 * place names are the rule rather than the exception: *Ronda* is an ordinary
 * Spanish noun, and Nice, Tours, Prato, León and Toro all collide with common
 * words in their own languages. Requiring a hazard keyword alongside the
 * toponym suppresses most of that; lifting the titles that name the place
 * itself handles the rest.
 */
export function rank(items: NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => {
    if (a.namesMunicipality !== b.namesMunicipality) return a.namesMunicipality ? -1 : 1
    return b.seenAt - a.seenAt
  })
}

/**
 * The last week if it has anything, otherwise the whole month.
 *
 * The window travels with the items so the UI can say which one the reader is
 * looking at — a month of headlines presented as "this week" would misdate
 * every one of them.
 */
export function partitionByWindow(items: NewsItem[], now = Date.now()): NewsAnswer['window'] {
  // Nothing at all stays 'week'. Widening on an empty set would announce
  // "nothing in the last week, showing the last month" above an empty list,
  // implying we found something older when we found nothing whatsoever — the
  // empty copy says "in the last month" and means it.
  if (items.length === 0) return 'week'
  const cutoff = now - WEEK_MS
  return items.some(i => i.seenAt >= cutoff) ? 'week' : 'month'
}

export function withinWindow(items: NewsItem[], window: NewsAnswer['window'], now = Date.now()): NewsItem[] {
  if (window === 'month') return items
  const cutoff = now - WEEK_MS
  return items.filter(i => i.seenAt >= cutoff)
}

/**
 * GDELT's documented limit: one request every five seconds, per IP.
 *
 * Six, not five, because the clock that matters is theirs and we cannot see it.
 */
const MIN_INTERVAL_MS = 6000

let nextAllowedAt = 0

/**
 * Claim the next slot in which a request may be sent, and say how long to wait.
 *
 * This exists because of a real incident: an hour of development testing put a
 * residential IP into GDELT's penalty box, and it stayed there long after the
 * bursts stopped — the 429 carries no `Retry-After`, and no CORS header either,
 * so from a browser a block is indistinguishable from being offline. There is
 * no way to detect the block, which means the only defence is not earning it.
 *
 * A reader can trip the limit as easily as I did. Panning between places with
 * the news tab open queues one request per place, and the retry button spends a
 * call per tap. Without this, ordinary browsing is a burst.
 *
 * The slot is claimed on call rather than on send, so simultaneous callers
 * queue behind each other instead of both reading a stale clock. A caller that
 * changes its mind after claiming should simply not send: the slot is then
 * spent on nothing, which errs in the safe direction.
 */
export function reserveNewsSlot(now = Date.now()): number {
  const at = Math.max(now, nextAllowedAt)
  nextAllowedAt = at + MIN_INTERVAL_MS
  return at - now
}

/** Test seam. The gate is module state, which would otherwise leak between specs. */
export function resetNewsRateGate(): void {
  nextAllowedAt = 0
}

/** Thrown for a throttle or a network failure — never for an empty result. */
export class NewsUnreachable extends Error {}

async function fetchNews(place: PlaceContext): Promise<NewsItem[]> {
  let res: Response
  try {
    res = await fetch(newsQueryUrl(place))
  } catch {
    // A 429 from GDELT carries no CORS header, so the browser reports it as a
    // network error. Indistinguishable from being offline, and treated as such.
    throw new NewsUnreachable('network')
  }
  if (!res.ok) throw new NewsUnreachable(`GDELT ${res.status}`)

  const body = await res.text()
  // The throttle notice comes back as prose with a 200, and so do query
  // errors — a malformed query answers "Parentheses may only be used around
  // OR'd statements", also with a 200. Anything that is not an object is a
  // refusal, not an empty answer. A query error is our bug rather than the
  // network's, but `unreachable` is still the right thing to tell the reader:
  // we did not learn what is happening there.
  if (!body.trimStart().startsWith('{')) throw new NewsUnreachable('refused')

  let parsed: { articles?: RawArticle[] }
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new NewsUnreachable('unparseable')
  }
  return relevantHere(shapeArticles(parsed.articles ?? [], place))
}

/**
 * Exactly one request per place. See `toponymsFor` for why there is no second.
 *
 * An empty answer here is a real finding — nothing local was published, or
 * nothing that our sources index. A throttle is not, and comes back as
 * `NewsUnreachable` so the caller can say something different.
 */
export async function getNewsForLocation(place: PlaceContext, now = Date.now()): Promise<NewsAnswer> {
  const items = await fetchNews(place)
  const window = partitionByWindow(items, now)
  return { items: rank(withinWindow(items, window, now)), window }
}
