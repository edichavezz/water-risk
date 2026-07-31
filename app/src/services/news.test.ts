import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import {
  newsQueryUrl, toponymsFor, parseSeenDate, shapeArticles,
  rank, partitionByWindow, withinWindow, getNewsForLocation, NewsUnreachable,
} from './news'
import { classifyTitle } from '../data/newsKeywords'
import type { PlaceContext } from '../types/place'
import type { NewsItem } from '../types/news'
import en from '../i18n/en.json'
import es from '../i18n/es.json'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

const marseille: PlaceContext = {
  displayName: 'Marseille, France',
  coordinates: { lat: 43.3, lng: 5.4 },
  countryCode: 'fr',
  province: 'FR-13',
  provinceName: 'Bouches-du-Rhône',
  municipality: 'Marseille',
}

const NOW = Date.UTC(2026, 6, 31, 12, 0, 0)
const daysAgo = (n: number) => NOW - n * 86_400_000

describe('newsQueryUrl', () => {
  const url = newsQueryUrl(marseille, 'municipality')
  const query = new URL(url).searchParams.get('query') ?? ''

  it('searches the municipality and its province', () => {
    expect(query).toContain('"Marseille"')
    expect(query).toContain('"Bouches-du-Rhône"')
  })

  it('carries both the local and the English vocabulary', () => {
    expect(query).toContain('sécheresse')
    expect(query).toContain('incendie')
    // English is not a fallback — it is how a national outlet's English
    // edition and republished wire copy still surface.
    expect(query).toContain('drought')
  })

  it('restricts the publisher country but never the language', () => {
    expect(query).toContain('sourcecountry:france')
    // sourcelang would drop Catalan, Basque, Galician, Occitan and Corsican
    // outlets — exactly the local coverage this feature exists for.
    expect(query).not.toContain('sourcelang')
  })

  it('asks for a month of JSON, most recent first', () => {
    const p = new URL(url).searchParams
    expect(p.get('mode')).toBe('ArtList')
    expect(p.get('format')).toBe('json')
    // A month, always: the week is carved out client-side so one request
    // answers both windows. GDELT throttles far too hard to spend two.
    expect(p.get('timespan')).toBe('1m')
    expect(p.get('sort')).toBe('datedesc')
  })

  it('omits sourcecountry rather than guessing one', () => {
    const elsewhere = { ...marseille, countryCode: 'ma' }
    expect(newsQueryUrl(elsewhere, 'municipality')).not.toContain('sourcecountry')
  })
})

describe('toponymsFor', () => {
  it('leads with the municipality on the tight ring', () => {
    expect(toponymsFor(marseille, 'municipality')[0]).toBe('Marseille')
  })

  it('drops the municipality when widening', () => {
    expect(toponymsFor(marseille, 'region')).not.toContain('Marseille')
  })

  it('falls back to the display name for a bare map pin', () => {
    const pin: PlaceContext = { displayName: 'Sierra de Grazalema', coordinates: { lat: 36.7, lng: -5.4 } }
    expect(toponymsFor(pin, 'municipality')).toEqual(['Sierra de Grazalema'])
  })
})

describe('parseSeenDate', () => {
  // The whole week/month split rests on this. GDELT's compact stamp is
  // rejected by `new Date()` as Invalid Date, which would silently collapse
  // every article into one bucket rather than failing visibly.
  it('reads GDELT’s compact stamp, which new Date() cannot', () => {
    expect(new Date('20260731T161500Z').getTime()).toBeNaN()
    expect(parseSeenDate('20260731T161500Z')).toBe(Date.UTC(2026, 6, 31, 16, 15, 0))
  })

  it('tolerates a plain ISO stamp', () => {
    expect(parseSeenDate('2026-07-31T16:15:00Z')).toBe(Date.UTC(2026, 6, 31, 16, 15, 0))
  })

  it('returns null rather than a wrong date', () => {
    expect(parseSeenDate(undefined)).toBeNull()
    expect(parseSeenDate('sometime last week')).toBeNull()
  })
})

describe('shapeArticles', () => {
  it('drops articles with no usable date instead of dating them now', () => {
    const items = shapeArticles(
      [
        { url: 'https://a.fr/1', title: 'Incendie à Marseille', seendate: '20260730T080000Z', domain: 'a.fr' },
        { url: 'https://a.fr/2', title: 'Sécheresse', seendate: 'nonsense', domain: 'a.fr' },
      ],
      marseille,
    )
    expect(items).toHaveLength(1)
  })

  it('marks titles that name the municipality itself', () => {
    const [named, provinceOnly] = shapeArticles(
      [
        { url: 'https://a.fr/1', title: 'Incendie à MARSEILLE', seendate: '20260730T080000Z' },
        { url: 'https://a.fr/2', title: 'Sécheresse dans les Bouches-du-Rhône', seendate: '20260730T080000Z' },
      ],
      marseille,
    )
    expect(named.namesMunicipality).toBe(true)
    expect(provinceOnly.namesMunicipality).toBe(false)
  })
})

describe('classifyTitle', () => {
  it('tags from the local vocabulary, accents and case ignored', () => {
    expect(classifyTitle('SECHERESSE historique', 'fr')).toBe('water')
    expect(classifyTitle('Feu de forêt maîtrisé', 'fr')).toBe('fire')
    expect(classifyTitle('Sequía en el embalse', 'es')).toBe('water')
  })

  // GDELT matches the article body but returns only the title, so a piece can
  // genuinely be about drought with nothing in its headline to prove it. A
  // guessed pill beside hazard data is worse than no pill.
  it('returns null rather than defaulting to a hazard', () => {
    expect(classifyTitle('Le conseil municipal se réunit mardi', 'fr')).toBeNull()
  })
})

describe('rank', () => {
  const item = (over: Partial<NewsItem>): NewsItem => ({
    title: '', url: Math.random().toString(), domain: '', seenAt: NOW,
    language: '', hazard: null, namesMunicipality: false, ...over,
  })

  // Primary key, not a tiebreaker: ambiguous toponyms are the rule, not the
  // exception — "Ronda" is an ordinary Spanish noun, and Nice, Tours, Prato,
  // León and Toro all collide with common words in their own languages.
  it('puts a municipality mention above a fresher province-only one', () => {
    const ranked = rank([
      item({ title: 'province, today', seenAt: NOW }),
      item({ title: 'municipality, three days ago', seenAt: daysAgo(3), namesMunicipality: true }),
    ])
    expect(ranked[0].title).toBe('municipality, three days ago')
  })

  it('orders within a group by recency', () => {
    const ranked = rank([
      item({ title: 'older', seenAt: daysAgo(5), namesMunicipality: true }),
      item({ title: 'newer', seenAt: daysAgo(1), namesMunicipality: true }),
    ])
    expect(ranked.map(i => i.title)).toEqual(['newer', 'older'])
  })
})

describe('the week/month window', () => {
  const item = (seenAt: number): NewsItem => ({
    title: '', url: String(seenAt), domain: '', seenAt,
    language: '', hazard: null, namesMunicipality: false,
  })

  // The clock is frozen deliberately. A fixture of fixed dates measured
  // against a relative seven-day window passes today and rots silently later.
  it('keeps the week when the week has anything', () => {
    const items = [item(daysAgo(2)), item(daysAgo(20))]
    expect(partitionByWindow(items, NOW)).toBe('week')
    expect(withinWindow(items, 'week', NOW)).toHaveLength(1)
  })

  it('falls back to the month only when the week is empty', () => {
    const items = [item(daysAgo(12)), item(daysAgo(20))]
    expect(partitionByWindow(items, NOW)).toBe('month')
    expect(withinWindow(items, 'month', NOW)).toHaveLength(2)
  })

  it('calls an empty month a week, so the reader is told the tighter truth', () => {
    expect(partitionByWindow([], NOW)).toBe('week')
  })
})

describe('getNewsForLocation', () => {
  const ok = (articles: unknown[]) => ({
    ok: true,
    text: async () => JSON.stringify({ articles }),
  })

  beforeEach(() => vi.useFakeTimers().setSystemTime(NOW))

  it('widens to the region only when the tight ring found nothing', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok([
        { url: 'https://a.fr/1', title: 'Sécheresse dans les Bouches-du-Rhône', seendate: '20260730T080000Z' },
      ]))
    vi.stubGlobal('fetch', fetchMock)

    const answer = await getNewsForLocation(marseille, NOW)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(answer.ring).toBe('region')
    expect(answer.items).toHaveLength(1)
  })

  it('spends exactly one request when the tight ring answers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok([
      { url: 'https://a.fr/1', title: 'Incendie à Marseille', seendate: '20260730T080000Z' },
    ]))
    vi.stubGlobal('fetch', fetchMock)

    const answer = await getNewsForLocation(marseille, NOW)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(answer.ring).toBe('municipality')
  })

  // The throttle notice arrives as prose with a 200, so a naive JSON.parse
  // would throw and a naive `?? []` would report our own silence as "no news
  // here". Both are the same bug wearing different clothes.
  it('treats the plain-text throttle notice as unreachable, not as empty', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      text: async () => 'Please limit requests to one every 5 seconds or contact...',
    })))
    await expect(getNewsForLocation(marseille, NOW)).rejects.toBeInstanceOf(NewsUnreachable)
  })

  // A 429 from GDELT carries no CORS header, so the browser surfaces it as a
  // TypeError rather than a status — indistinguishable from being offline.
  it('treats a CORS-blocked rejection as unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    await expect(getNewsForLocation(marseille, NOW)).rejects.toBeInstanceOf(NewsUnreachable)
  })
})

/**
 * The radius guardrail.
 *
 * The design handoff promised "news within 20 km" and no free source can
 * deliver it — GDELT's `near20:` is word proximity, not distance. The promise
 * was removed from the copy, and this is what stops it drifting back in.
 */
describe('news copy never claims a radius', () => {
  const FORBIDDEN = [/\d+\s*km/i, /within .* of/i, /\bradius\b/i, /\bradio de\b/i, /\ba \d+\s*km\b/i]

  for (const [lang, bundle] of Object.entries({ en, es })) {
    it(`${lang} says "mentions this place", never a distance`, () => {
      const copy = Object.values((bundle as { news: Record<string, string> }).news)
      expect(copy.length).toBeGreaterThan(0)
      for (const line of copy) {
        for (const pattern of FORBIDDEN) {
          expect(line, `"${line}" must not promise a distance`).not.toMatch(pattern)
        }
      }
    })
  }

  it('tells the reader an empty result is not an all-clear', () => {
    expect(en.news.empty).toMatch(/not the same as/i)
    expect(en.news.unreachableBody).toMatch(/says nothing about/i)
  })
})
