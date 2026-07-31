# Live news — implementation plan

**Date:** 2026-07-31
**Status:** Plan, awaiting approval
**Supersedes:** the EMM option in `2026-07-30-live-news-research.md`. EMM is dropped — decommissioned, and its replacement serves only pan-European highlights with no keyword or place query.
**Source:** GDELT DOC 2.0 `ArtList`, keyless, called directly from the browser.

## What this delivers, and one thing it does not

The brief: search by specific location, as close as possible to the pin, for water- and fire-related keywords; render on the Live news tab; last week, widening to last month if nothing is found; most recent first; Europe-centric; local languages fine.

All of that is deliverable except one thing, which this plan **changes on purpose and asks you to confirm**:

> The design handoff's **"news within 20 km" is dropped.** No free source can do a radius. GDELT's `near20:` is *word* proximity, not distance, and its GEO API's finest unit is the province. What ships is **"news mentioning this area"** — the toponym in the article text — which is a weaker claim and has to be labelled as one.

## The query

One request per place. Literal shape:

```
https://api.gdeltproject.org/api/v2/doc/doc
  ?query=("Marseille" OR "Bouches-du-Rhône") AND (incendie OR "feu de forêt" OR sécheresse OR barrage OR inondation) AND sourcecountry:france
  &mode=ArtList
  &format=json
  &timespan=1m
  &sort=datedesc
  &maxrecords=75
```

Four decisions inside that string:

- **`timespan=1m`, not `1w`.** The month is fetched once and split client-side by each article's own date. Last week's items render; only if that bucket is empty do we fall back to the month's, with the widened window labelled in the UI. This satisfies "last week, or last month if nothing found" in **one** request instead of two — decisive, given the throttling below.
- **`sort=datedesc`** is GDELT's documented "most recent first". We do not re-sort by relevance on top of it.
- **`sourcecountry:<pin's country>`** — Europe-centrism by construction: the US press cannot appear. **No `sourcelang`**, deliberately: it would drop Catalan, Basque, Galician, Occitan and Corsican outlets, which are exactly the local coverage we want.
- **Toponym ring.** Municipality first (closest to the pin). Province is OR'd in as a second term rather than a second request, so one call covers both and ranking separates them.

### Widening ladder, in order

1. Tight ring (municipality OR province), `1m` → partition to last week.
2. Week bucket empty → render the month bucket, labelled *"nothing in the last week; showing the last month."*
3. Whole response empty → **one** second request dropping the municipality, province + region only, still `1m`.
4. Still empty → "no coverage found", which is a real, honest answer.

Never widen past the region, and never drop `sourcecountry`.

## Keywords

`app/src/data/newsKeywords.ts` — per language, tagged by hazard family so the pill and the query come from one table.

| | fire | water |
|---|---|---|
| **es** | incendio, "incendio forestal", fuego, quema | sequía, embalse, pantano, restricciones de agua, inundación, "nivel del agua" |
| **fr** | incendie, "feu de forêt", brûlé | sécheresse, barrage, retenue, "restrictions d'eau", inondation |
| **it** | incendio, "incendio boschivo", rogo | siccità, invaso, diga, "razionamento idrico", alluvione |
| **en** | wildfire, forest fire | drought, reservoir, water restrictions, flood |
| **pt** | incêndio, "incêndio florestal" | seca, albufeira, barragem, cheia |

English is always OR'd in alongside the local set — it is how a Spanish-language outlet's English edition, and pan-European wires published in-country, still surface.

## Hazard tagging is not free

The memo claimed the Fire/Water pill "comes free from whichever keyword set matched". **It does not.** GDELT matches against the article *body*; `ArtList` returns only the *title*. If `sequía` matched in paragraph four, the title cannot tell us.

So: classify from the title where a keyword appears, and leave the rest **explicitly unclassified** — no pill, rather than a guessed one. Splitting into one query per hazard would make the tag authoritative and double the request count; not worth it at this quota.

## Ranking

`sort=datedesc` sets the base order. On top of it, exactly one reordering rule:

**Articles whose *title* contains the municipality name rank above those that only match the province.** Within each group, most recent first.

This is the primary rank key, not a tiebreaker, because the ambiguous-toponym problem is the general case rather than the exception: *Ronda* is a common Spanish noun, and Nice, Tours, Prato, León and Toro all collide with ordinary words in their own languages. Requiring a hazard keyword alongside the toponym suppresses most of it; the rest is why the honesty caption stays.

## Access — the actual constraint

Verified again today, on two networks minutes apart: throttled on every attempt.

Two properties of a throttled response that the code must handle:

1. **It is plain text, not JSON, and does not arrive as a clean 4xx.** The body is `Please limit requests to one every 5 seconds...`. `JSON.parse` on it throws. Detect a non-JSON body and treat it as *unknown*, never as *no news*.
2. **A 429 carries no `Access-Control-Allow-Origin` header**, so from the browser it is indistinguishable from being offline.

### Decisions this forces — stated, not deferred

- **Direct browser fetch. No serverless proxy.** A proxy funnels every reader onto one Vercel IP, which is the fastest possible route to being permanently blocked. Readers' own IPs spread the load.
- **The opaque failure is handled by copy, not architecture:** *"Couldn't reach the news source just now."* Distinct from *"No coverage found"*, which is a real result.
- **This does not violate "missing data never looks safe."** That rule governs hazard datasets, where absence could read as all-clear. News is context, not a hazard signal — an unreachable feed says nothing about risk, and the copy says exactly that. Worth stating because a reviewer will otherwise ask.
- **Lazy fetch on tab open — a hard requirement, not an optimisation.** Fetching on every place change would trip the limit within seconds of normal use. Plus an in-session cache keyed by `countryCode + municipality` so tab-switching and back-navigation never refetch.

## Files

| File | Change |
|---|---|
| `app/src/services/news.ts` | **new** — `newsQueryUrl(place, ring)`, `fetchNews(place)`, `shapeArticles`, `parseSeenDate`, `classify`, `rank`, `partitionByWindow` |
| `app/src/services/news.test.ts` | **new** — see below |
| `app/src/data/newsKeywords.ts` | **new** — the table above |
| `app/src/types/news.ts` | **new** — `NewsItem`, `NewsAnswer` (`{ items, window: 'week' \| 'month', ring, status }`) |
| `app/src/components/Panel/NewsFeed.tsx` | real rendering; keep the honesty caption |
| `app/src/store/useAppStore.ts` | news slice — lazy load on tab open, in-session cache |
| `app/src/i18n/en.json`, `es.json` | new `news.*` keys; **remove** the now-dead `pendingTitle` / `pendingBody` |

No routing work: `?mode=news` already parses and syncs.

### i18n keys

`news.heading`, `news.windowWeek`, `news.windowMonth` ("Nothing in the last week — showing the last month."), `news.ringWidened`, `news.empty`, `news.unreachable`, `news.tagFire`, `news.tagWater`, `news.disclaimer` (kept verbatim), `news.sourceNote`.

`parity.test.ts` fails the moment `en.json` gains a key `es.json` lacks — both files land in the same commit.

## Tests

- `newsQueryUrl` — municipality and province quoted; local **and** English keywords present; `sourcecountry` matches the pin's country; **no** `sourcelang`; `format=json`, `mode=ArtList`, `sort=datedesc`, `timespan=1m`.
- `parseSeenDate` — against a **real captured payload**. GDELT's `seendate` is the compact `YYYYMMDDTHHMMSSZ` form, which `new Date()` rejects as `Invalid Date`; the parser is written against the observed string, and the first implementation step is capturing one to confirm. If this is wrong, every article silently lands in one bucket.
- `partitionByWindow` — **with the clock frozen** (`vi.setSystemTime`). A fixture with fixed dates plus a relative 7-day window passes today and rots silently in a month.
- `rank` — a province-only title dated today ranks *below* a municipality title dated three days ago.
- `classify` — a title with no keyword returns unclassified, not a default pill.
- The throttle body — plain text in, status `unreachable` out, and specifically **not** an empty result set.
- Copy guardrail, in the style of `supply.test.ts`: no `news.*` string may contain `/\d+\s*km/` or `/near(by)?/i`. The radius must not creep back in through wording.

## Built — what changed against the plan

Implemented 2026-07-31 and verified live in the browser against Marseille and Ronda. Three things the plan did not anticipate:

- **`seendate` is confirmed** as the compact `YYYYMMDDTHHMMSSZ` form. No longer an assumption — the live Marseille render dated items "3 days ago" / "today" correctly.
- **A hazard keyword in the title is required, not just the toponym.** The plan expected untagged items to render without a pill. In practice Ronda's feed filled with Málaga's municipal budget, the 2026 feria and a Tom Jones listings agenda — each naming the place and matching a hazard word deep in the body. Both tests are now required, so every rendered item carries a pill and the feed is emptier and true.
- **Titles need a spacing repair.** GDELT normalises headlines, leaving `Sud - Ouest` and `folie  : à`. Spacing is fixed; the apostrophes it also strips (`C'est` → `Cest`) are left alone rather than guessed at.

## First implementation step

Capture one live `ArtList` response (patiently, respecting the 5-second spacing) and commit it as the test fixture. Everything downstream is written against that file rather than against an assumed shape.
