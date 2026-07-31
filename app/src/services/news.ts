import type { PlaceContext } from '../types/place'
import type { NewsAnswer, NewsItem, NewsRing } from '../types/news'
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
 * The toponyms to search, closest to the pin first.
 *
 * `municipality` is the tight ring and is what the reader actually asked
 * about; the province rides along in the same query so one request covers both
 * and `rank` separates them afterwards. `region` is the widening step, used
 * only when the tight ring came back with nothing at all.
 */
export function toponymsFor(place: PlaceContext, ring: NewsRing): string[] {
  const province = place.provinceName
  if (ring === 'municipality') {
    const names = [place.municipality, province].filter((n): n is string => !!n)
    // A place with neither — a bare map pin over open country — still has its
    // display name, which is better than an unbounded query.
    return names.length > 0 ? names : [place.displayName]
  }
  return [province, place.displayName].filter((n): n is string => !!n)
}

export function newsQueryUrl(place: PlaceContext, ring: NewsRing): string {
  const places = toponymsFor(place, ring).map(n => `"${n}"`).join(' OR ')
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
 * Keep only the headlines that actually name the place.
 *
 * GDELT matches the article *body*, and the difference is not academic: a
 * search for Ronda returned a piece on the 2027 solar eclipse, a Cerro del
 * Villar dig and firefighters from Córdoba working a blaze in Ávila, 500 km
 * away. Every one contained the word somewhere and a hazard keyword somewhere
 * else.
 *
 * Ranking those below the local items is not enough — they still sit under the
 * place's name, beside hazard data, borrowing its authority. The reader asked
 * what is happening *here*, and a title that never names the place is not an
 * answer to that question. The honest cost is a feed that is often empty, and
 * `news.empty` says so plainly.
 */
export function namesThePlace(items: NewsItem[]): NewsItem[] {
  return items.filter(i => i.namesMunicipality || i.namesProvince)
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

/** Thrown for a throttle or a network failure — never for an empty result. */
export class NewsUnreachable extends Error {}

async function fetchRing(place: PlaceContext, ring: NewsRing): Promise<NewsItem[]> {
  let res: Response
  try {
    res = await fetch(newsQueryUrl(place, ring))
  } catch {
    // A 429 from GDELT carries no CORS header, so the browser reports it as a
    // network error. Indistinguishable from being offline, and treated as such.
    throw new NewsUnreachable('network')
  }
  if (!res.ok) throw new NewsUnreachable(`GDELT ${res.status}`)

  const body = await res.text()
  // The throttle notice comes back as prose with a 200. Anything that is not
  // an object is a refusal, not an empty answer.
  if (!body.trimStart().startsWith('{')) throw new NewsUnreachable('throttled')

  let parsed: { articles?: RawArticle[] }
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new NewsUnreachable('unparseable')
  }
  return namesThePlace(shapeArticles(parsed.articles ?? [], place))
}

/**
 * One request, widened at most once.
 *
 * The second call happens when the tight ring kept nothing — measured *after*
 * `namesThePlace`, not before, since a ring that returns five body-only
 * matches has found nothing local and should still widen. If that second call
 * is itself throttled the result is `unreachable`, not "no coverage", because
 * we never learned the answer.
 */
export async function getNewsForLocation(place: PlaceContext, now = Date.now()): Promise<NewsAnswer> {
  let ring: NewsRing = 'municipality'
  let items = await fetchRing(place, ring)

  if (items.length === 0 && place.provinceName) {
    ring = 'region'
    items = await fetchRing(place, ring)
  }

  const window = partitionByWindow(items, now)
  return { items: rank(withinWindow(items, window, now)), window, ring }
}
