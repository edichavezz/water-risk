# Water Risk Explorer — User Flows & Outstanding Interfaces

**Last updated:** June 2026  
**Scope:** v1 built / v2 deferred

---

## Flow 1 — Location Lookup ✅ Built in v1

**Entry point:** Search bar in the top nav.

**Steps:**
1. User types an address, postcode, or municipality name (min. 3 chars).
2. Nominatim returns up to 5 suggestions with municipality + province labels.
3. User selects a result → map flies to the point, a pin is placed.
4. All data services fire in parallel: flood zone (SNCZI), drought status (Copernicus EDO), nearby reservoirs.
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

## Outstanding Interfaces Summary

| Interface | Priority | Effort | Blocker |
|-----------|----------|--------|---------|
| Restrictions card (live scraper) | High | Large | No structured data API |
| Compare locations | High | Medium | Build time only |
| Developments near me (EIA) | Medium | Large | PDF extraction quality |
| Reservoir time-series chart | Medium | Small | SAIH API integration |
| SINAC supply zone matching | Medium | Medium | Spatial join complexity |
| Aquifer overexploitation overlay | Medium | Small | IGME shapefile download |
| SIGPAC irrigation zones (farmer) | Low | Small | WFS performance testing |
| Save / share risk profile | Low | Medium | Auth or anonymous links |
| Export questions to PDF | Low | Small | pdf skill |

---

## Data Freshness & Caveats Policy

Every data card must display its source and update frequency. The rule:

| Data | Source | Freshness shown |
|------|--------|-----------------|
| Flood zones | MITERD SNCZI | "Periodically updated — post-DANA 2024 revisions may be pending" |
| Drought CDI | Copernicus EDO | "Updated weekly" |
| Reservoirs | REDIAM / MITERD | "Static seed in v1 — live API in v2" |
| Active restrictions | Manual curation | "Last verified: [date] — verify with [CH link]" |
| Planned developments | BOE/BOJA scraper | "Extracted [date] — status may have changed" |

The AI summary must not claim higher certainty than the underlying data. Prompts include explicit instructions to flag data gaps and use hedged language where appropriate.
