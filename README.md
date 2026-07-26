# Water Risk Explorer

A bilingual (ES/EN) water risk tool for Spain. Enter any Spanish address, postcode, or municipality and get a plain-language water risk profile: flood zones, drought status, reservoir levels, drinking water quality, coastal zones, groundwater status, and AI-generated implications — all tailored to whether you're a buyer, renter, farmer, or business.

> **Persona model pivoted July 2026** — the code above still ships the original four-persona model. `PERSONAS.md` now defines a different target model (Resident/Owner + Buyer/Investor as MVP; Policymaker + Farmer as unvalidated beyond-MVP candidates), backed by cited research on [this Miro board](https://miro.com/app/board/uXjVH4jzeig=/). Code has not yet been updated to match — see `ARCHITECTURE.md` and `PLAN.md` §8.2.

---

## Quick Start

### Prerequisites

- Node.js 18+
- A [Claude API key](https://console.anthropic.com/) (for AI summaries and questions)

### Install and run

```bash
cd app
npm install
cp .env.example .env          # then add your API key
npm run dev
```

App runs at `http://localhost:5173`.

### Environment variables

```
VITE_ANTHROPIC_API_KEY=your_key_here    # required — Claude Haiku for AI summaries
VITE_AEMET_API_KEY=                     # optional — AEMET climate data (v2)
```

> **Security note:** In production, proxy the Claude API through a serverless function to keep the key server-side. See ARCHITECTURE.md for details.

### Build

```bash
cd app
npm run build          # outputs to app/dist/
npx tsc --noEmit       # type-check only
```

---

## What It Does

Search any Spanish address → get a risk profile with:

- **Flood zone** — SNCZI T10/T100/T500 riverine flood zone status (MITERD)
- **Drought** — Copernicus CDI level (alert/warning/watch/none), updated weekly
- **Reservoirs** — Nearest 3 reservoirs with fill % and historical mean
- **Drinking water** (to build) — SINAC tap water compliance and source type
- **Coastal zone** (to build) — MITERD DPH building-restriction zones (coastal locations only)
- **Groundwater** (to build) — IGME overexploited aquifer status
- **Bathing water** (to build) — EEA beach/river quality rating within 5 km

All data is attributed and freshness-labelled. AI output adapts to the selected user type (buyer / renter / farmer / business) and respects the ES/EN language toggle.

---

## Project Structure

```
water-risk/
├── app/                        # React SPA (Vite + TypeScript)
│   └── src/
│       ├── components/         # Map, Search, RiskPanel, toggles
│       ├── services/           # Data fetch and transform per source
│       ├── store/              # Zustand global state
│       ├── i18n/               # EN and ES string files
│       ├── types/              # Shared TypeScript types
│       └── data/               # Bundled static assets (SINAC JSON, IGME GeoJSON)
├── PLAN.md                     # Product plan — tech stack, data sources, DoD
├── FLOWS.md                    # All user flows + outstanding interfaces
├── ARCHITECTURE.md             # System design, data flow, technical decisions
├── PERSONAS.md                 # Four user personas with AI prompt guidance
├── DATA-SOURCES.md             # Master catalogue of all data sources (v1 + v2)
├── AGENT-BRIEF-NEW-DATA-SOURCES.md  # Implementation brief for the 4 new v1 data sources
└── water-spain-research.md     # Original research — data portals, tools, opportunities
```

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 18 + TypeScript + Vite |
| Map | MapLibre GL JS + OpenFreeMap (Liberty style) |
| Geocoding | Nominatim (OSM) |
| Styling | Tailwind CSS v4 |
| i18n | react-i18next |
| State | Zustand |
| AI | Claude Haiku 4.5 (claude-haiku-4-5) |

All map tiles and data services are free and open — no billing account needed except for Claude.

---

## Data Sources

| Source | What | Status |
|--------|------|--------|
| MITERD SNCZI WMS | Riverine flood zones | ✅ Live |
| Copernicus EDO WMS | Drought CDI indicator | ✅ Live |
| OpenFreeMap | Map tiles | ✅ Live |
| Nominatim | Geocoding | ✅ Live |
| Static seed | 17 Andalucía reservoirs | ✅ v1 static |
| SINAC (datos.gob.es) | Drinking water quality | 🔨 To build |
| MITERD DPH WMS | Coastal flood zones | 🔨 To build |
| IGME GeoJSON | Groundwater overexploitation | 🔨 To build |
| EEA Bathing Water API | Bathing site quality | 🔨 To build |

Full source catalogue with endpoints, licences, and update frequency: see `DATA-SOURCES.md`.

---

## Product Docs

- **[PLAN.md](PLAN.md)** — product north star, tech stack, v1 build scope, v2 roadmap, API reference, definition of done
- **[FLOWS.md](FLOWS.md)** — all 12 user flows with edge cases, outstanding interfaces, freshness policy
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — system overview, data flow, technical decisions, deployment
- **[PERSONAS.md](PERSONAS.md)** — four user personas with AI prompt guidance
- **[DATA-SOURCES.md](DATA-SOURCES.md)** — master data source catalogue
- **[AGENT-BRIEF-NEW-DATA-SOURCES.md](AGENT-BRIEF-NEW-DATA-SOURCES.md)** — step-by-step implementation guide for the 4 to-build data sources
- **[water-spain-research.md](water-spain-research.md)** — original research (data portals, tool landscape, opportunities)
- **Miro — Personas, Journey & Data Map:** https://miro.com/app/board/uXjVH4jzeig=/ — persona research with citations, the user journey diagram (location → persona → shared risk core → persona lens), and the questions↔data-sources map, all on one linked board
