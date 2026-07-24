# AguaRiesgo — User Personas

**Last updated:** July 2026 — pivoted following a persona-mapping session (Miro boards + real Spain/Andalucía research)
**Purpose:** Source of truth for how the product serves each user type. Informs AI prompt design, card display priority, and future feature prioritisation.

---

## ⚠️ Pivot note (July 2026) — read this first

The persona model below **replaces** the previous flat four-persona model (Buyer/Homeowner, Renter, Farmer, Business — all equal-weight, all shipped in v1). That replacement happened in a working session that mapped personas against cited, real Spain/Andalucía water-governance research (drought restrictions, Doñana, Guadalquivir irrigation allocation, foreign-buyer due diligence practice) rather than against the product's own assumptions. Two Miro boards hold the full backing work:

- **Persona research + likely questions:** https://miro.com/app/board/uXjVH4jzeig=/ (same board also has the journey diagram and the questions↔data-sources map)

**What changed and why:**
- Renter and Buyer/Homeowner are merged into **Resident/Owner** — someone already living somewhere or operating a business there, regardless of ownership. Their underlying data need (drought status, tap water quality, restrictions) is the same; the only place tenure matters is that a renter has no property-value stake, which is now a framing note inside one persona rather than a reason for a separate one.
- **Business is no longer a separate persona.** It splits cleanly into the two personas above: an operating business uses the Resident/Owner lens, a business considering investing/building uses the Buyer/Investor lens. Flagged below as a values decision, not just a technical one.
- **Policymaker** is added as a candidate persona — real governance content exists (basin planning cycles, Doñana), but it's unvalidated: nothing confirms a policymaker would use a resident-facing tool over their institutional channels, and it doesn't exist anywhere in the current app.
- **Farmer is downgraded from "shipped v1 persona" to "beyond, partially implemented, real gap remaining."** The current code already ships a real, public, useful signal for farmers (IGME groundwater-overexploitation zones — see `groundwater.ts`). But the single sharpest farmer need surfaced in research — irrigation **allocation/concession status** (e.g. the Guadalquivir basin's campaign-by-campaign m³/hectare allocation, or Doñana's illegal-well/concession-legality dispute) — is not covered by the groundwater card and is likely not public at the per-grantee level. Farmer isn't "done" just because a Farmer card exists; the differentiating need is still an open, possibly-blocked data problem.

**⚠️ Code/docs mismatch this creates:** the app's `UserType` type (`'buyer' | 'renter' | 'farmer' | 'business'`), `UserTypeSelector.tsx`, and `ai.ts → buildContext()` still implement the **old** four-flat-persona model as of this doc update. This is a docs-first update — the code has not been changed to match. See `ARCHITECTURE.md` for the explicit follow-up flag. Do not assume the running app reflects this document until that work is done.

**Also unresolved, flagged not silently decided:** the app deliberately chose **post-overview** persona selection (§8.2 in `PLAN.md`) — you see the risk profile before picking a persona, specifically to avoid the persona question feeling like a gate. The Miro journey diagram puts persona selection right after location entry, before any data — i.e. a gate. These are opposite UX philosophies. This document does not resolve that; see `PLAN.md` §8.2 for the explicit open decision.

---

## Persona Tiers

| Persona | Tier | Status |
|---|---|---|
| Resident / Owner | **MVP** | Confirmed |
| Buyer / Investor | **MVP** | Confirmed |
| Policymaker | Beyond | Unvalidated — no confirmed user need yet |
| Farmer | Beyond | Partially implemented (groundwater proxy); core need (allocation data) likely blocked |
| ~~Business~~ | — | Not a separate persona — see note below |

---

## Persona 1 — Resident / Owner (MVP)

**Who they are:** Someone already living in or operating a business from a Spanish home or premises — owner or renter, personal residence or small operating business. Tenure (own vs. rent) doesn't change their core data need; it only changes whether property-value framing is relevant.

**Primary concern:** Day-to-day habitability, ongoing exposure, and (for owners/operators only) property-value implications — not a purchase decision.

**What we found (cited, Spain/Andalucía specific):**
- March 2024: Andalucía's Drought Management Commission capped household use at 180 L/person/day in parts of the region, banning garden watering and pool-filling. [Olive Press](https://www.theolivepress.es/spain-news/2024/03/04/tourists-face-water-restrictions-in-spains-andalucia-this-year-due-to-ongoing-drought-these-are-some-of-the-measures/)
- By May 2025, after winter rains, nearly all Costa del Sol restrictions were lifted; limits raised to 250 L/inhabitant/day (western Costa del Sol) and 225 L (Málaga city). [Andalucia.com](https://www.andalucia.com/living/water-restrictions-on-costa-del-sol)
- Scarcity isn't only drought-driven: some Spanish towns went **10 months without clean tap water** — a supply/quality failure distinct from reservoir levels. [Euronews](https://www.euronews.com/green/2024/02/15/i-feel-abandoned-these-spanish-towns-havent-had-clean-tap-water-for-10-months)
- Regional government response leans on new supply (desalination, non-conventional resources), not just demand restriction. [SAGESA](https://sagesa.net/en/drought/)

**Key questions they bring:**
- Are there active restrictions on my daily water use right now, and what's the actual limit?
- How full are the reservoirs supplying my town vs. last year and the 10-year average?
- Has my town had tap-water quality/safety problems recently (separate from drought)?
- Is new supply infrastructure (desalination, pipeline) planned here, and when?
- What triggers restrictions being imposed or lifted in my area?
- *(Owner/operator sub-case only)* What are the insurance and resale implications of my flood zone or coastal DPH status?

**Data that matters most:** drought/CDI status, active restrictions, drinking water quality (SINAC), reservoir levels, flood zone (owner sub-case), groundwater (if own well).

**How AI should frame content:**
- Practical first: what to check, what to ask, who to contact (ayuntamiento, comunidad de propietarios, water utility).
- For the no-property-stake case (renter, or a resident not making a property decision): **do not** introduce resale value, nota simple, or legal-disclosure language — this was a deliberate carry-over from the old Renter persona and still holds.
- For the owner/operator sub-case: legal and insurance framing (nota simple, Consorcio de Compensación de Seguros, business-interruption cover) is relevant — but only surface it when the profile signals an owner/operator, not by default.

---

## Persona 2 — Buyer / Investor (MVP)

**Confirmed label:** "Antes de firmar" / "Before you decide"

**Who they are:** Someone deciding whether to purchase or invest — a residential buyer (Spanish, EU, or international) or a commercial investor/developer (e.g. a hospitality or golf-resort development), at any scale. The decision in question — proceed or not — is the same shape regardless of scale; the due-diligence depth differs.

**Primary concern:** Risk to the decision to proceed — legal, insurance, and long-term viability of the water supply for what they're about to acquire or build.

**What we found (cited):**
- Standard due-diligence guidance for foreign buyers covers registry, planning, tax and technical checks — water/borehole legality is flagged as a distinct, often under-checked risk, especially for rural property. [Harris Sliwoski](https://harris-sliwoski.com/blog/buying-property-in-spain-what-foreign-buyers-need-to-know-before-they-sign/), [Yepes Legal](https://yepeslegal.com/property-due-diligence-in-spain/)
- Rural-property checklists explicitly add wells, water rights and land classification alongside boundaries and illegal construction. [Ábaco Advisers](https://blog.abacoadvisers.com/property-due-diligence-spain/)
- No evidence found of a formal building moratorium tied to water scarcity on the Costa del Sol in this search; reservoirs there were reported near a 10-year high (~83% capacity) in early 2026 — flagged as an open question, not a confirmed absence. [Plexo Properties](https://plexoproperties.com/costa-del-sol-water-reservoirs-2026/)
- New desalination capacity is being built in Fuengirola and Estepona. [Marbella Daily](https://marbelladaily.com/town-planning/costa-del-sol-saved-from-thirst-extended-marbella-desalination-plant-ensures-water-supply-until-september/)

**Key questions they bring:**
- Does this property have a legal, registered water source (mains or registered well), or an unregistered borehole?
- Is this property or area under any current/historical building restriction linked to water capacity?
- How have reservoir levels here trended over the last decade — recovering or structurally declining?
- Is new water infrastructure planned for this municipality, and on what timeline?
- (Rural/rustic land, or commercial development) What documented water rights/concession are attached, and are they transferable? What's the estimated water demand for a new development, and is that allocation available?

**Data that matters most:** flood zone (T100 especially — insurer-relevant), coastal DPH zone, groundwater overexploitation, reservoir levels/trend, drinking water quality.

**How AI should frame content:**
- Lead with legal and insurance implications: nota simple, SNCZI flood zone, zona de servidumbre, Consorcio de Compensación de Seguros.
- For coastal properties: explain the 20 m and 100 m DPH zone restrictions clearly.
- Suggest consulting a gestor or abogado for cadastral/legal detail; for commercial-scale development, flag environmental impact assessment requirements.

---

## Persona 3 — Policymaker (Beyond, unvalidated)

**Status:** Real, cited content exists below, but this persona doesn't exist in the app, and nothing confirms a policymaker would use a resident-facing tool over their existing institutional channels (CH bulletins, ministry reporting). Treat as a research candidate, not a build commitment.

**What we found (cited):**
- Basin governance runs on 6-year planning cycles under the EU Water Framework Directive; the Guadalquivir basin is in its 3rd cycle, 2022–2027, run by the Confederación Hidrográfica del Guadalquivir (CHG). [CHG](https://www.chguadalquivir.es/tercer-ciclo-guadalquivir), [MITECO plan](https://www.miteco.gob.es/content/dam/miteco/es/agua/temas/planificacion-hidrologica/PH%20Guadalquivir-%20Digital.pdf)
- The prior plan was approved by Royal Decree 355/2013 following review by the Watershed Council and National Water Council — a formal, multi-body approval chain. [BOE](https://www.boe.es/buscar/act.php?id=BOE-A-2013-5319)
- Live governance flashpoint: Andalucía's regional government proposed legalising ~1,460 ha of illegally-irrigated land near Doñana; UNESCO and the European Commission opposed it, warning of World Heritage status risk. [WWF](https://wwf.panda.org/wwf_news/?4921941/WWF-responds-to-plans-that-threaten-the-Donana-wetlands), [Euronews](https://www.euronews.com/2023/06/23/spanish-strawberry-growers-deny-using-illegal-irrigation-sparks-controversy)

**Key questions they bring:** what the current Plan Hidrológico says about structural vs. temporary deficit; enforcement status on illegal abstraction; EU-level exposure (WFD infringement, World Heritage risk); how competing demands are reconciled; the evidence/consultation record behind restriction decrees.

---

## Persona 4 — Farmer / Smallholder (Beyond, unvalidated core need)

**Status:** Partially implemented. The groundwater-overexploitation card (`groundwater.ts`, IGME data) already serves this persona with real, public, useful data. But the most differentiating farmer need — irrigation allocation/concession status — remains unimplemented and is likely not solvable with public per-grantee data. Don't treat the existing Farmer card as "the farmer persona done"; it's one real signal among several needed.

**Who they are:** Someone farming irrigation-dependent land, concentrated in Andalucía (Guadalquivir basin especially).

**Primary concern:** Water availability for irrigation — current-campaign allocation and long-term abstraction legality — not the same axis as domestic supply restrictions.

**What we found (cited):**
- Guadalquivir irrigators endured roughly 8 years of cuts; the 2026 campaign is the first real chance to recover a 6,000 m³/hectare allocation, a level not seen since 2017. [Tridge](https://www.tridge.com/news/the-irrigators-hope-to-end-eight-years-of-re-xdhvmguc)
- The swing is dramatic: basin reservoirs went from 59.56% (April 2025) to 85.9% capacity / 6,900 hm³ (2026) per Ministry for Ecological Transition data. [Tridge](https://www.tridge.com/news/the-irrigators-hope-to-end-eight-years-of-re-xdhvmguc)
- Water-rights reductions are described as "widely contested" between authorities and agricultural stakeholders in the academic literature on Spanish irrigation governance. [Sustainability Science / Springer](https://link.springer.com/article/10.1007/s11625-025-01689-5)
- Doñana: WWF has documented 1,000+ illegal wells over 20 years overexploiting the aquifer; industry group Interfresa disputes the illegal-sourcing claims; a proposed amnesty for ~1,460 ha was opposed by UNESCO/EU. [WWF](https://wwf.panda.org/wwf_news/?4921941/WWF-responds-to-plans-that-threaten-the-Donana-wetlands)

**Key questions they bring:**
- What's my irrigation allocation (m³/hectare) for this campaign vs. last year and the pre-2017 baseline? *(not currently answerable by the app)*
- Is my abstraction (well/concession) legally registered, and am I exposed under any amnesty/enforcement process? *(not currently answerable)*
- Is my land in an overexploited aquifer zone? *(answerable today — IGME card)*
- Which Confederación Hidrográfica governs this land, and is there a comunidad de regantes? *(partially answerable — basin inference exists)*

**Data-access flag (unchanged from research):** individual irrigation concession/allocation data is likely not public at the per-grantee level — a real access gap to validate, not assume solvable, before promising this persona more than the groundwater signal.

---

## Note: Business is not a separate persona

Old Persona 4 ("Small Business") is retired as a standalone entry. It splits between the two MVP personas:
- An **operating** business (hotel, restaurant, small manufacturer) uses the **Resident/Owner** lens — same "how does this affect my ongoing operations" framing as a resident, just applied to a commercial premises.
- A business **deciding to invest or build** (e.g. a hotel or golf-resort developer) uses the **Buyer/Investor** lens, at commercial scale.

**Named explicitly, not swept under the rug:** the original research question set names golf courses and tourism complexes as the economic activities *competing* with domestic supply. Building out "protect my business operations from restrictions" content serves the entity on the other side of that tension from a resident. Some grounding, in case this gets built out further:
- Golf courses have been required to irrigate with reclaimed water in Andalucía since 2010 (Decree 43/2008); still, ~25% use non-potable well or desalinated water instead. [Andalucia Golf](https://andaluciagolf.com/en/59-of-spanish-golf-courses-use-reclaimed-water-for-irrigation-compared-to-21-in-the-u-s/)
- Golf-course irrigation demand is ~30 hm³/year in Andalucía's Mediterranean basin, vs. 356.8 hm³/year for urban domestic supply (~3.2M inhabitants). [Andalucia.com](https://www.andalucia.com/living/utilities-water.htm)
- During restrictions, tourism/hotel activity has in practice been prioritised over some resident-facing uses (car washing, pool filling) to keep tourism operating. [Euro Weekly](https://euroweeklynews.com/2024/02/26/the-costa-del-sols-hotels-and-golf-courses-are-preparing-for-a-summer-of-drought/)

This is a values choice to make on purpose if the product ever leans into serving large commercial water users more explicitly — not something to let in by default via the old Business persona's momentum.

---

## Persona Comparison Table

| Dimension | Resident / Owner (MVP) | Buyer / Investor (MVP) | Policymaker (beyond) | Farmer (beyond) |
|-----------|------------------------|-------------------------|------------------------|-------------------|
| Time horizon | Ongoing / current | Pre-decision, one-time | Planning-cycle (6 yr) | Campaign + long-term |
| Top data concern | Restrictions + tap water | Flood + coastal + legal water source | Structural deficit + compliance | Groundwater zone (allocation data missing) |
| Legal vocabulary | Ayuntamiento, comunidad de propietarios | Nota simple, DPH, SNCZI | Plan Hidrológico, WFD | CH, concesión, regantes |
| AI tone | Practical, reassuring where risk is low | Cautious, legal-aware | Institutional, evidence-based | Technical, agricultural — but incomplete data |
| Entry mechanism | Postcode / town (shared) | Postcode / town (shared) | Jurisdiction (basin/municipality) | Postcode today; parcel/comunidad de regantes needed for full coverage |

---

## Notes for AI Prompt Design

**⚠️ Not yet implemented in code — see the pivot note at the top of this file and `ARCHITECTURE.md`.** The notes below describe the target state; `ai.ts → buildContext()` and `UserTypeSelector.tsx` still use the old `'buyer' | 'renter' | 'farmer' | 'business'` type as of this update.

- Target persona keys: `resident_owner`, `buyer_investor`, `policymaker` (beyond), `farmer` (beyond).
- If `resident_owner` and the profile has no property-value signal (renter-like case), avoid resale value or legal-disclosure language — carried over unchanged from the old Renter persona's guidance.
- If `resident_owner` and the profile does have an ownership/operator signal, insurance and legal framing (nota simple, Consorcio de Compensación de Seguros) becomes relevant.
- If `buyer_investor` and `floodZone.inZone === true` with `returnPeriod === '100'`, the AI must mention T100 insurance implications prominently — unchanged from old Buyer guidance.
- If `farmer`, the AI must not imply confidence about irrigation allocation/concession status the app doesn't have — lead only with the groundwater-overexploitation signal where available, and explicitly flag the allocation-data gap rather than staying silent about it.
- All output respects the `language` store value (EN/ES). Spanish output preserves technical terms; English output translates them with a parenthetical.
