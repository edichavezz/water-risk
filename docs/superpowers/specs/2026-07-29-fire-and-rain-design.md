# Fire and Rain — water and fire risk across the Mediterranean

**Date:** 2026-07-29
**Status:** Approved
**Supersedes:** the geographic scope of `2026-07-24-water-risk-interface-design.md` (Andalucía-only) and the app name in `2026-07-26-app-identity-design.md`

## Problem

Water Risk Explorer answers "what are the water risks at this address?" for Andalucía. Three things are wrong with stopping there.

**Fire and water are the same question.** A reader worried about a dry summer in the Mediterranean is worried about reservoirs *and* wildfire. Splitting them across two tools makes the reader assemble the context themselves, which is precisely the work this app exists to do for them.

**The coverage gate blocks expansion structurally, not incidentally.** `services/coverage.ts` holds one region and acts as a global on/off switch: outside Andalucía `submitLocation` fetches nothing and AI interpretation is refused. Fire data is pan-European and keyless — it would be unreachable the day it landed. Copernicus EDO drought is *already* pan-European and *already* proxied and pixel-sampled, and it is refused outside Andalucía today for no reason but the gate.

**Fire data was never scoped.** No fire source is named anywhere in the repo. `plans/water-spain-research.md` lists "Desertification/wildfire risk — Copernicus EFFIS + REDIAM" as MVP priority #7 and it never reached `DATA-SOURCES.md` in any status.

## Decisions

| | |
|---|---|
| **Name** | **Fire and Rain**, canonical and never translated. Tagline (translated): "Water and fire risk across the Mediterranean". |
| **Geography** | Whole Mediterranean, best-effort. **No country gate.** Every location returns whatever genuinely exists; the detail level varies and is stated plainly. |
| **Commercial posture** | Non-commercial, no ads. This is a licence constraint, not a preference — Open-Meteo's free tier is explicitly non-commercial and it is the source the fire-weather work depends on most. Revisit before any paid tier or advertising. |
| **Reservoirs outside Andalucía** | Basin-scoped at first, behind four guardrails, with a designed road to real supply relationships (§5). |
| **About** | A page. `AboutPage.tsx` already exists; the dialog-vs-page conflict between the identity spec and the design handoffs is resolved in favour of the page. |
| **Locales** | EN + ES today; FR + IT added with the geography. **Greek deferred** — Greece is served by the pan-European layers without a fifth locale. |

## Design

### 1. Coverage becomes a descriptor, not a gate

`CoverageResult.supported` is deleted. In its place:

```ts
export type DetailTier = 'detailed' | 'partial' | 'minimal'

export interface CoverageProfile {
  tier: DetailTier
  regionId?: string
  covered: DatasetId[]
  unsupported: DatasetId[]
  coveredCount: number
  totalCount: number
}
```

**Derived from the registry, not from a hand-maintained region table**, so coverage copy can never claim a check the app does not run. Andalucía remains the single `detailed` region because that is where the hand-curated supply systems and the daily REDIAM levels live — an honest statement about our data, not a boundary on the product.

Copy phrases the tier as *what you get*, never *whether it works*: "Partial here: 4 of 9 checks. Local supply and drinking-water records are missing."

### 2. Per-dataset applicability, three-valued

`DatasetDef.appliesTo(location): boolean` becomes `applicability(place): Applicability`:

```ts
export type Applicability =
  | 'covered'         // a source exists here; fetch is worth calling
  | 'unsupported'     // the question is real here, we have no source — row STAYS VISIBLE
  | 'not_applicable'  // the question does not arise here — row hidden
```

**The rename is load-bearing.** If the field kept its name and only changed return type, `DATASETS.filter(d => d.appliesTo(loc))` would still compile and every `'unsupported'` string would be truthy — silently restoring boolean behaviour with the wrong semantics. Renaming makes the compiler enumerate every call site.

**`unsupported` is the expansion default, and this is the honesty rule (§3.5, "missing data never looks safe").** The two statuses already differ in exactly the way that matters: `not_applicable` is filtered out of the list *and* out of AI evidence and is deliberately absent from `NON_SAFE_STATUSES`; `unsupported` stays visible, is in `NON_SAFE_STATUSES`, and reaches the model as an explicit gap. Flood risk is real in Calabria — we simply have no SNCZI there. Classifying "no source here" as `not_applicable` would make the row vanish, hide the gap from the AI, and let absence read as absence of risk.

Guarded by `registry/applicability.test.ts`: across a fixture set of places in ES/FR/IT, no dataset may return `not_applicable` except the coastal ones when the point is genuinely inland. Any future dataset that quietly hides itself outside its home country fails this test.

The orchestrator short-circuits rather than skipping: `unsupported` datasets never hit the network, and never render a Retry button that cannot succeed.

### 3. AI is gated on evidence, not geography

Interpretation is allowed wherever **at least one dataset returned an actual value**. Geography was never what made interpretation safe — evidence was. `buildEvidence` already emits an explicit "No usable value" line per non-available dataset, so the model is shown its gaps rather than shielded from them. The old rule refused a location in Extremadura that had a live flood verdict *and* a live drought reading, because a polygon said "not Andalucía". The new rule refuses only the case that was actually dangerous: nothing to interpret.

The interpret system prompt drops its Spain assumption and gains an evidence-count line, so a one-dataset interpretation is framed as thin.

### 4. Hazard families

`hazard: 'water' | 'fire'` on `DatasetDef`, orthogonal to the existing `category` (which describes *what kind of fact*, not *which threat*). Consumers: status-dot colour, a Fire/Water pill per row, the two-group layers card, the About page's data section.

**Hazard colour is added to the status glyph, never substituted for it.** The `available` state alone takes family colour; a terracotta hollow ring would read as a fire *finding* rather than a missing fire *reading*. The non-colour status cues stay exactly as they are.

**The map layer budget stays global** — 0-or-1 primary, max 2 context, across both families. The constraint is about pixel readability, not taxonomy: two stacked translucent choropleths are mud regardless of which hazard they describe, and the legend can no longer say which colour came from where. If a fire layer renders as outlines rather than fill (burn scars, WUI boundaries), the answer is to classify it `context`, which the existing budget already accommodates with no store change.

### 5. Reservoirs: provenance, not proximity

Research settles what is obtainable: the *municipality → supply system* edge is broadly available (SINAC nationally in Spain, Hub'Eau nationally in France, both keyless); the *system → reservoir* edge is not, outside hand curation. So provenance travels with every link and the UI labels each tier differently:

```ts
type SupplyProvenance =
  | 'curated'            // hand-researched from operator publications; names real reservoirs
  | 'official-registry'  // SINAC / Hub'Eau; names a system, maybe not its reservoirs
  | 'basin'              // no supply relationship known; reservoirs in the same basin district
  | 'none'
```

The 22 curated systems become the `curated` tier — **Andalucía does not regress**.

The `basin` tier partially reverses commit `3f77a57`, which removed the nearest-reservoir fallback because "a reservoir 10 km away may be pure irrigation storage and supply nobody". That reasoning still holds for *proximity*; basin scoping is a different and weaker claim, and it ships only with four guardrails:

1. **Distance is never rendered.** Distance is what made proximity read as relevance.
2. **Sorted by capacity, capped at 5** — this answers "what is the water situation in this basin", not "what supplies you".
3. **The AI never counts it as a supply answer**; the evidence line says "basin-level context only, no confirmed supply relationship".
4. The comment block explaining `3f77a57` is **rewritten, not deleted**, recording that the no-proximity rule survives.

Enforced by `supplyCopy.test.ts`: each tier's rendered string must contain its required hedge and must not contain "nearby", "your reservoirs", or any km figure.

### 6. Displaying ~13 datasets

Seven water datasets plus roughly six fire ones, and `unsupported` rows now stay visible where the gate used to delete them. The pressure is not foreign geography but the bundled seeds — `sinac.json` holds 13 municipalities and `groundwater-units.json` holds 4 polygons, so those read `unsupported` across most of Spain including most of Andalucía.

- Group by hazard family first, rank within family — so the two-family structure reads identically in the list, the layers card and the About page.
- Collapse the unsupported tail behind a count once it exceeds three rows; expanded at 1–3.
- The collapsed summary is a `NON_SAFE` presentation: muted, never green, and it names the reason. A collapsed row the reader never opens must still not read as "fine".

## Data sources

Verified against live endpoints, with CORS measured using an `Origin` header.

**Browser-direct, keyless:** Copernicus EDO drought WMS (pan-European, already proxied and pixel-sampled); EFFIS/GWIS on both `maps.effis.emergency.copernicus.eu` (hotspots, burnt areas, fuel map) and `ies-ows.jrc.ec.europa.eu` (the ECMWF FWI forecast layers live only on this second server); Open-Meteo; Hub'Eau; VigiEau; EEA Bathing Water; GDELT DOC 2.0.

**Proxy or build-time:** NASA FIRMS area CSV (MAP_KEY is secret; its WMS is fine direct); MITECO Boletín Hidrológico (11.3 MB weekly ZIP containing an Access `.mdb`); AEMET.

Three findings that shape the design:

- **EFFIS and EDO both refuse point queries.** `GetFeatureInfo` answers "Search returned no results" / "Invalid request type". They are overlays. Every point number comes from `wmsSample.ts` pixel-reading or from computation.
- **Open-Meteo has no FWI variable** — probed, explicitly rejected by the API. It has every *input*, and the Canadian FWI is a published deterministic algorithm, so we compute it. Labelled "estimated, computed from Open-Meteo", never presented as the official EFFIS or Météo-France value.
- **NASA FIRMS latency in Europe is ~1–3 hours**, not the sub-minute figure quoted for US/Canada direct-readout. The UI says so.

**Google**, which was asked about specifically: the wildfire boundary product (1 km, refreshed every 10–15 minutes, 37+ countries) ships only as a consumer feature in Search and Maps, with no documented developer endpoint — so it is a **link-out**, and a good one. Earth Engine carries FIRMS under a compliant noncommercial tier but is an authenticated async compute platform, the same architectural mismatch as Copernicus CDS, serving data we already fetch directly.

## Testing

Per phase: `npx tsc --noEmit && npx vitest run && npm run build`, then drive the app.

- **Andalucía does not regress.** Ronda and Seville return the same datasets, the same supply answer, the same summaries.
- **Expansion works.** Marseille, Palermo and Bilbao each return a list, a stated tier, and visible `unsupported` rows — never an empty panel, never a silently shortened list.
- **Missing never looks safe.** No `unsupported` row is styled as a low-risk finding, and the interpretation names the gaps.
- **The honesty tests pass** — `applicability.test.ts` and `supplyCopy.test.ts` encode rules that code review forgets.

New: `applicability.test.ts`, `coverage.test.ts` (rewritten), `orchestrator.test.ts` (unsupported never fetches), `geocoding.test.ts` (real ES/FR/IT fixtures including the Seville regression below), `coastline.test.ts`, `supplyCopy.test.ts`, and a `wmsProxyCore.test.ts` case per new upstream asserting unlisted layers are rejected — that allow-list is what keeps the proxy from being an SSRF hole.

## Two live bugs fixed on the way

- `geocoding.ts` reads `address.county ?? address.state`, but Nominatim returns `province` and no `county` for Seville, so `provincia` becomes "Andalucía". `isCoastalProvincia("Andalucía")` is false, so coastal and bathing-water datasets never appear for Seville today. Reordered to `province ?? county ?? state`.
- `isCoastalProvincia`'s hardcoded Spanish province list is replaced by a geometric `isCoastal(coords, withinKm)` against a generated coastline. This alone makes EEA Bathing Water work in France and Italy.

## Non-goals

- **Live news is deferred.** The `panelMode` union gains `news` so the tab shell exists, but no news fetching is built. When it returns: GDELT DOC 2.0, toponym + keyword, cached by municipality. Note that **"news within 20 km" is not achievable** on free sources — GDELT's `near20:` is *word* proximity, not geographic — so the feature must be labelled "news mentioning this area".
- **No national reservoir data for Italy.** It does not exist. Italy is served by pan-European drought, Open-Meteo, and regional link-outs, stated plainly rather than papered over with a few cherry-picked reservoirs implying national coverage.
- **No aggregate risk score**, across hazards or within one. Unchanged from the original spec, and more important now that two hazard families sit side by side.
- **No SAIH scraping** (nine bespoke ASPX scrapers) until the MITECO weekly pipeline ships and proves insufficient.
- Persona-first vs post-overview (`PLAN.md` §8.2) and the stale `UserType` model remain open. Neither blocks this program; both surface in the About copy.
