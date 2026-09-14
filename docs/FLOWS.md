# Water Risk Explorer — User Flows & Outstanding Interfaces

**Last updated:** July 2026  
**Scope:** v1 built + new data sources / v2 deferred

**⚠️ Persona pivot note:** Flow 2 below describes the four-persona, post-overview model as **currently shipped in code**. A persona-mapping session (July 2026) replaced the persona model with Resident/Owner + Buyer/Investor (MVP) and Policymaker + Farmer (beyond, unvalidated) — see `PERSONAS.md` for the current source of truth and the Miro board (https://miro.com/app/board/uXjVH4jzeig=/) for backing research. Whether persona selection should stay post-overview or move to a persona-first gate (as the Miro journey diagram shows) is an **open, unresolved conflict** — see `PLAN.md` §8.2. Nothing below has been changed to match; it still documents the running app.

---

## Flow 1 — Location Lookup ✅ Built in v1

**Entry point:** Search bar in the top nav.

**Steps:**
1. User types an address, postcode, or municipality name (min. 3 chars).
2. Nominatim returns up to 5 suggestions with municipality + province labels.
3. User selects a result → map flies to the point, a pin is placed.
4. All data services fire in parallel: flood zone (SNCZI), drought status (Copernicus EDO), nearby reservoirs, drinking water quality (SINAC — static lookup), coastal flood zone (MITERD DPH, if coastal province), groundwater status (IGME — sync Turf.js check), bathing water (EEA, nearest within 5 km).
5. Risk panel populates as each response arrives; AI summary and questions render last.

**Edge cases handled:**
- Rural Andalucía postcodes are patchy → search falls back gracefully to municipality name; Nominatim handles village-level names well in Spain.
- Location on a basin boundary → `inferBasin()` assigns the dominant basin by province; the basin label in the panel shows the assigned basin. A "boundary zone" warning is a v2 enhancement.
- Multiple supply zones → v1 shows the nearest 3 reservoirs regardless of supply zone assignment; formal supply zone matching via SINAC is v2.

---

## Flow 2 — Risk Profile by User Type ✅ Built in v1

**Entry:** User type selector in the risk panel (shown immediately after a location is found).

**Design decision: post-overview.** The overview data cards (flood, drought, reservoirs) load for everyone. The user type selector is prominent and changing it triggers a live re-generation of the AI summary and questions — no page reload.

**Four personas:**

| Type | AI focus |
|------|----------|
| Buyer / homeowner | Flood zone insurance implications, resale risk, nota simple advice |
| Renter | Disclosure rights, questions for landlord and community president |
| Farmer / smallholder | Irrigation restrictions, groundwater abstraction rights, comunidad de regantes |
| Small business | Supply disruption risk, regulatory exposure, insurer questions |

**Outstanding (v2):**
- Saved persona preference (localStorage / account).
- Deeper persona data: SINAC supply zone matching for renters; SIGPAC irrigation coefficient for farmers; business-type sub-selector.

---

## Flow 3 — Active Drought / Restriction Alert 🔶 Partial in v1

**What's in v1:**
- Copernicus CDI (Combined Drought Indicator) is queried for the location and displayed with a colour-coded level (alert / warning / watch / none).
- A "Restrictions" section placeholder in the drought card links out to the relevant Confederación Hidrográfica website.
- Clear freshness label: "Updated weekly by Copernicus EDO".

**What's not built:**
- No structured API exists for municipal-level supply restrictions. Data lives in press releases, CH websites, and social media.
- v2 plan: a scraper layer covering CHGuadalquivir, CHSur, CHSegura restriction pages + BOJA gazette parsing; a manually curated alert DB with municipality ID, restriction type, severity, and date; a `RestrictionsCard` component with a "Last verified" timestamp and source link.

**Key design constraint:** Every alert must show its source and freshness timestamp prominently. Users making property or farming decisions need to know whether the data is from today or three weeks ago.

---

## Flow 4 — Compare Locations ❌ Deferred to v2

**What it does:** Side-by-side risk comparison for two addresses — useful for buyers choosing between towns, or anyone planning a move.

**Proposed v2 design:**
- "Compare" toggle in the top bar reveals a second search input.
- Map splits or shows two pins with a connector.
- Risk panel shows two columns, one per location, with delta indicators (worse / better).
- AI generates a comparative narrative: "Location A is in a flood zone that B is not; B has significantly lower reservoir coverage."

**Blocker:** Purely build time — no new data sources needed. The existing services just need to be called twice and the results laid out side-by-side.

---

## Flow 5 — Planned Developments Near Me ❌ Deferred to v2

**What it does:** Shows solar farms, data centres, golf courses, and agri-industrial projects within a configurable radius that have active or recently approved Environmental Impact Assessments (EIAs).

**Why it matters:** A proposed data centre or golf course 8 km away may have been granted a water concession that draws on the same aquifer or reservoir system as the queried location.

**Data source:** BOE (Official State Gazette) and BOJA (Junta de Andalucía gazette) — PDFs only, no structured API.

**v2 plan:**
1. Scraper monitors BOE/BOJA for new EIA submissions and approvals.
2. Claude Sonnet extracts: project name, location (address or cadastral reference), project type, estimated water demand (m³/year), current status (submitted / approved / rejected).
3. Geocode each project and store in a PostGIS database.
4. `DevelopmentsCard` component queries nearby projects within configurable radius (default 15 km).
5. AI generates: "Within 15 km, 2 solar farms and 1 data centre are in active EIA. Combined estimated water demand: ~X m³/year."

**Blocker:** PDF extraction quality varies significantly by document. Requires substantial prompt engineering and QA. Suggest a curated pilot covering Málaga and Almería provinces first.

---

## Flow 6 — Generate Questions to Ask ✅ Built in v1

**Entry:** Automatically generated after a location search, at the bottom of the risk panel.

**What it generates:** 6 tailored questions per user type, specific to the location's actual risk profile (flood zone status, drought level, reservoir fill, basin). Output language follows the ES/EN toggle.

**Examples for a buyer in a T100 flood zone under drought watch:**
- "Is this property registered in the SNCZI flood zone? Does the seller's disclosure mention it?"
- "Has the property ever flooded, and is there a hydraulic public domain proximity entry in the nota simple?"
- "Which insurance providers cover this postcode, and what is the flood excess?"

**Outstanding (v2):**
- "Copy to clipboard" and "Export to PDF" buttons.
- Question sets for additional audiences: community of owners president, water utility, regional environment authority.
- Save/share a set of questions with a unique URL.

---

## Flow 7 — Trend / Historical Context 🔶 Partial in v1

**What's in v1:**
- Reservoir cards show current fill % and the historical mean (static seed data), giving immediate context.
- AI summary references the drought level in terms of severity relative to historical norms when data supports it.

**What's not built:**
- No time-series chart.
- No multi-year reservoir trend data.

**v2 plan:**
- SAIH Guadalquivir historical data from datos.gob.es: weekly reservoir levels for 10+ years per embalse.
- Sparkline chart (recharts) per reservoir showing the last 5 years with the current level highlighted.
- AI trend narrative: "Reservoir levels in this basin have been below 30% for four consecutive winters — a pattern not seen since 1994–1995."
- Copernicus CLMS soil moisture time-series as a groundwater proxy.

**Data access:** SAIH historical datasets are available on datos.gob.es but require per-basin API calls and data cleaning. REDIAM Andalucía reservoir viewer provides near-daily data going back ~10 years.

---

## Flow 8 — Language Switching ✅ Built in v1

**What it does:** EN/ES toggle in the top bar switches all UI strings immediately (via react-i18next) and re-generates the AI summary and questions in the selected language on next search or user type change.

**Design notes:**
- The toggle is top-level, always visible — language is a first-class choice, not buried in settings.
- AI output language is tied directly to the store `language` value; prompts include explicit language instructions.
- Technical Spanish terms (zona inundable T100, confederación hidrográfica, comunidad de regantes) are preserved in the Spanish output and translated with explanatory parentheticals in English.

**Outstanding (v2):**
- Browser `navigator.language` auto-detection on first load.
- Persist language preference to localStorage.
- German / Dutch support for Northern European buyers (a significant segment in Málaga / Alicante).

---

## Flow 9 — Drinking Water Quality 🔨 New v1

**Entry:** Automatically shown in the risk panel after location search, below the drought card.

**Data source:** SINAC (Ministry of Health) — annual CSV dataset bundled as static JSON, keyed by INE municipality code.

**Steps:**
1. Nominatim result includes the municipality name; look up INE code.
2. Query static SINAC JSON for matching municipality.
3. Render `WaterQualityCard` with: compliance status badge, water source type, last test year, 2–3 key parameters (nitrates, turbidity, microbiological).
4. If no match found (rural areas without their own supply zone): show "Supply data not available for this municipality — contact your ayuntamiento."

**Display logic:**
- Compliance: ✅ "Compliant" / ⚠️ "Minor issues reported" / ❌ "Non-compliant — check with municipality"
- Source type: "Surface water", "Groundwater", "Mixed", "Desalination"
- Freshness label: "SINAC — {year} annual data"

**AI integration:** Include compliance status and source type in the AI summary context. For a renter persona: "Your area's tap water was rated compliant as of {year}. Ask your landlord for the latest community water quality report."

---

## Flow 10 — Coastal Flood Zone 🔨 New v1

**Entry:** Shown in the risk panel alongside the riverine flood card, when the location is in a coastal municipality.

**Data source:** MITERD coastal DPH WMS — `https://wms.mapama.gob.es/sig/Costas/ServDPHC/wms.aspx`

**Steps:**
1. After geocoding, fire a WMS `GetFeatureInfo` against the coastal DPH layers at the queried coordinates.
2. Check for `DPMT_Servidumbre` (20 m zone) and `DPMT_ZonaPolicia` (100 m zone).
3. If the location is >10 km from the coast (determined by checking if Nominatim result includes coastal province/municipality keywords, or by a simple coastal-boundary check): suppress the card entirely — don't show "Not in coastal zone" for inland Córdoba.
4. Render `CoastalFloodCard` with: zone type, legal implication summary, link to MITERD coastal viewer.

**Key distinction from riverine flood card:** The coastal DPH is about legal building restrictions and public domain proximity, not just flood risk. A property within the zona de servidumbre has restrictions on building modifications — this is material to a buyer.

**Map:** Separate layer toggle labelled "Coastal zones" — blue-tinted overlay distinct from the orange/red SNCZI flood zones.

---

## Flow 11 — Groundwater Overexploitation 🔨 New v1

**Entry:** Shown in the risk panel, most prominently for SE Spain locations.

**Data source:** IGME hydrogeological units GeoJSON (static asset, downloaded from IGME eWater and bundled).

**Steps:**
1. At query time, run Turf.js `booleanPointInPolygon` against the GeoJSON of Spain's ~200 hydrogeological units.
2. If the point falls within a unit: retrieve unit name, overexploitation status, and basin.
3. Render `GroundwaterCard`.

**Display logic:**
- Overexploited unit: ⚠️ "This location is within the [name] aquifer, officially classified as overexploited. Groundwater abstraction rights may be restricted."
- Non-overexploited: ✅ "No groundwater overexploitation declared for this area."
- Outside known unit: neutral — "No hydrogeological unit data for this location."

**Persona relevance:**
- Farmer: highest — directly affects irrigation abstraction rights
- Buyer: medium — affects long-term water security and property value in rural areas
- Renter/Business: lower — show but de-emphasise in AI summary

**Map:** Optional polygon overlay (filled with a subtle amber tint for overexploited units). Toggle with reservoirs layer or as its own control.

---

## Flow 12 — Bathing Water Quality 🔨 New v1

**Entry:** Shown only for coastal locations where a designated bathing site is within 5 km.

**Data source:** EEA Bathing Water Quality API — `https://bathing-water-quality.eea.europa.eu/api/sites/?country=ES&format=json`

**Steps:**
1. On app load (or first search), fetch all Spanish bathing sites and cache in memory (or ship as a static JSON — ~1,500 Spanish sites, small file).
2. After geocoding, compute haversine distance from query point to all sites.
3. If nearest site is within 5 km: show `BathingWaterCard` with site name, distance, latest rating, assessment year.
4. If nearest site is >5 km or location is clearly inland: suppress card entirely.

**Display logic:**
- Excellent / Good: ✅ green badge
- Sufficient: 🟡 amber badge with note "monitored, meets minimum standards"
- Poor: ❌ red badge with note "may not meet EU standards — check local authority"
- Not assessed this season: grey badge with last known year

**Freshness label:** "EEA Bathing Water Directive — {year} season (Apr–Oct)"

---

## Outstanding Interfaces Summary

### v1 — To Build
| Interface | Priority | Effort | Blocker |
|-----------|----------|--------|---------|
| Drinking water quality (SINAC) | High | Small | Data download + parse |
| Coastal flood zone (MITERD DPH) | High | Small | WMS layer name verification |
| Groundwater overexploitation (IGME) | High | Small | Shapefile download + Turf.js |
| Bathing water quality (EEA API) | Medium | Small | API fetch + proximity filter |

### v2 — Deferred
| Interface | Priority | Effort | Blocker |
|-----------|----------|--------|---------|
| Restrictions card (live scraper) | High | Large | No structured data API |
| Compare locations | High | Medium | Build time only |
| River flow / GloFAS forecasting | Medium | Medium | Too technical for core personas |
| Developments near me (EIA) | Medium | Large | PDF extraction quality |
| Reservoir levels — live API | Medium | Small | API testing |
| Reservoir time-series chart | Medium | Small | SAIH API + charting |
| Tidal predictions | Low | Small | Too niche / operational |
| Sewage/wastewater alerts | — | — | Data does not exist |
| SIGPAC irrigation zones (farmer) | Low | Small | WFS performance testing |
| Save / share risk profile | Low | Medium | Auth or anonymous links |
| Export questions to PDF | Low | Small | pdf skill |
| Language expansion (DE/NL) | Low | Medium | Translation work |

---

## Data Freshness & Caveats Policy

Every data card must display its source and update frequency. The rule:

| Data | Source | Freshness shown |
|------|--------|-----------------|
| Riverine flood zones | MITERD SNCZI | "Periodically updated — post-DANA 2024 revisions may be pending" |
| Drought CDI | Copernicus EDO | "Updated weekly" |
| Reservoirs | Static seed (v1) | "Static seed in v1 — live SAIH/REDIAM API in v2" |
| Drinking water quality | SINAC / Ministry of Health | "Annual data — {year}" |
| Coastal flood zones | MITERD DPH | "Periodically updated" |
| Groundwater status | IGME hydrogeological units | "Annual classification" |
| Bathing water quality | EEA Bathing Water Directive | "{year} season (Apr–Oct)" |
| Active restrictions | Manual curation | "Last verified: [date] — verify with [CH link]" |
| Planned developments | BOE/BOJA scraper | "Extracted [date] — status may have changed" |

The AI summary must not claim higher certainty than the underlying data. Prompts include explicit instructions to flag data gaps and use hedged language where appropriate.
