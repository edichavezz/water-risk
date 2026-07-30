# Live news — what open data can realistically do

**Date:** 2026-07-30
**Status:** Research, not yet a design
**Requirements set by the user:** last 7 days · most recent first · relevant to an area · Europe-centric, not US-centric · local languages welcome

## The short answer

Three of the five requirements are easy and one is impossible as stated.

| Requirement | Verdict |
|---|---|
| Last 7 days | **Easy.** Native on every candidate. |
| Most recent first | **Easy.** A documented sort parameter, not something we compute. |
| Europe-centric, local languages | **Easy, and it is a filter we control.** US-centrism is avoidable by construction — see below. |
| Relevant to an area | **Approximate only.** Municipality-name matching, or province-level geography. Not a radius. |
| Reliable | **The actual constraint.** Not capability — quota. |

The feature is worth building. It just has to be named for what it does: *news mentioning this area*, not *news within 20 km*.

## What was verified

Every claim below was tested live on 2026-07-30, from both a server IP and a real browser.

### GDELT DOC 2.0 — the only keyless option

Capability is a good fit:

- `timespan=1w` is documented and supports minutes through months (15-minute minimum).
- `sort=datedesc` is documented and means exactly "most recent first".
- `sourcecountry:` and `sourcelang:` restrict to publishers in a country and articles in a language. **This is the answer to "not US-centric"** — restrict to `spain`/`france`/`italy` and the US press cannot appear at all. GDELT machine-translates 65 languages, so local-language sources are first-class rather than an afterthought.
- `near20:` is **word** proximity, not geographic. It does not do what its name suggests.

The problem is access, and it is severe:

- The documented limit is one request per five seconds. In practice I was rate-limited on essentially every attempt over ~20 minutes, including at 20–25 second spacing, from two different networks.
- **A 429 response carries no `Access-Control-Allow-Origin` header.** Verified with an explicit `Origin`, and confirmed from an in-page `fetch` on gdeltproject.org itself, which failed with `TypeError: Failed to fetch`. From a browser, a throttled GDELT is indistinguishable from being offline — we cannot even tell the reader "try again shortly".

### GDELT GEO 2.0 — right idea, wrong resolution, and currently unreachable

- Natively covers **the last 7 days**, refreshed every 15 minutes — the requested window, exactly.
- Genuinely geographic rather than keyword-guessing, but its finest resolution is **ADM1** (province / région / regione). That is a useful unit for this app, but it is not a radius.
- `https://api.gdeltproject.org/api/v2/geo/geo` returned **404** on every form tried — with and without parameters, via curl and via browser. Treat the endpoint as unverified until someone gets a 200 out of it.

### EMM NewsBrief (JRC) — the ideal source on paper, closed in practice

The European Commission's own media monitor: EU-operated, multilingual, strong on regional European press. Exactly the Europe-centric backbone this feature wants.

Its RSS endpoints return **403 Forbidden** to every programmatic request tried — plain, browser user-agent, and with a referer. The HTML alert pages return 200, but scraping them would be fragile and is CORS-blocked from a browser anyway.

### Keyed providers — less elegant, actually reliable

| | Free tier | Notes |
|---|---|---|
| **NewsData.io** | 200 credits/day, some endpoints burn 2+, so ~60–80 real calls | 206 countries, 89 languages, **commercial use allowed** |
| **GNews** | 100 requests/day, 10 articles each, 1 req/s | 22 languages; some docs describe the free tier as non-commercial |

Both filter by country and language, both sort by publication date, both take a from-date. Both therefore satisfy last-week, most-recent-first and Europe-centric directly. Neither is keyless, so both need the key kept server-side.

### Ruled out

- **Google News RSS** — no CORS header at all, and terms hostile to this use.
- **Official regional feeds** (AEMET, Junta de Andalucía, Protezione Civile, French ministries). Every URL guessed returned 404; the only one that resolved was Copernicus' own org-level feed, which is pan-European press-release news, not local. These may well exist — they would need finding one region at a time, which is a curation project like `firePrevention`, not an API integration.

## What this means for the design

**Do not put GDELT behind our serverless proxy.** A proxy funnels every user onto one IP, which is the fastest possible way to be permanently throttled. And calling it directly from the browser is not much better, because the throttled response is invisible to us.

Two workable shapes:

**A. Serverless `/api/news`, keyed provider primary.** NewsData.io as primary (commercial-use-safe), GDELT as an opportunistic bonus when it answers. Cache at the edge for 30 minutes **keyed by municipality**, reusing the caching discipline already in `wmsProxyCore`. Do the arithmetic openly: ~60–80 credits a day means roughly 60–80 *distinct municipalities* per day before the quota is gone. Fine for a small tool, and it will not scale without paying.

**B. Precomputed per-region digest.** A scheduled job fetches once or twice a day per region and commits a small JSON, exactly like `fetch-reservoirs.mjs` does. Sidesteps quotas entirely, is Europe-centric by construction, and makes "last week, most recent first" trivial. The cost is that "Live news" would be up to a day stale — at which point it should not be called live.

**Recommendation: A**, with the honest caption already written into the tab shell, and B as the fallback if quota becomes a problem.

### The query that gets closest to "this area"

```
("<municipality>" OR "<province>")
AND (incendio OR fuego OR sequía OR embalse OR inundación)   ← localised per country
AND sourcecountry:<es|fr|it>
AND sourcelang:<spanish|french|italian>
timespan=1w  sort=datedesc
```

Then rank by recency, and optionally lift items whose text names the municipality itself above ones that only match the province. Tag each item Fire or Water from which keyword set matched — that is what the design's Fire/Water pills need, and it comes free.

## Honesty requirements, carried over

- Label it **"news mentioning this area"**. The 20 km radius in the original design cannot be delivered by any free source and must not be implied.
- Keep the caption already in `NewsFeed.tsx`: matched by place name, not verified.
- A headline sitting beside hazard data borrows that data's authority. The tagging and the caption are what stop it.
