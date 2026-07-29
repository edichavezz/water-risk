# Water Risk Explorer

A bilingual (ES/EN) water risk tool for Spain. Search a Spanish address, postcode, or municipality — or click a point on the map — and read a plain-language water risk profile: river flood zones, drought status, reservoir levels, drinking water quality, coastal building-restriction zones, groundwater status, and bathing water quality.

The interface is map-first: the map is the canvas, and a panel over it holds the data. Every dataset carries its own status, so an unavailable or errored source is never rendered as a clean bill of health. AI interpretation is opt-in, never auto-generated, and always labelled as AI-assisted.

Two audiences are offered at entry (Resident/Owner, Buyer/Investor); the choice adjusts emphasis only — never the underlying numbers. See `PERSONAS.md`.

---

## Quick Start

### Prerequisites

- Node.js 18+
- A [Claude API key](https://console.anthropic.com/) (for AI summaries and questions)

### Install and run

```bash
cd app
npm install
cp .env.example .env.local    # then add your API key
npm run dev
```

App runs at `http://localhost:5173`.

### Environment variables

Put these in `app/.env.local` (git-ignored):

```
ANTHROPIC_API_KEY=sk-ant-...            # server-side only — powers /api/interpret
ANTHROPIC_MODEL=claude-haiku-4-5        # optional override
VITE_AEMET_API_KEY=                     # optional — AEMET climate data (v2)
```

> **Security:** `ANTHROPIC_API_KEY` deliberately has no `VITE_` prefix, so Vite never bundles it into client code. The browser only ever calls `/api/interpret` — served by a Vercel function in production and by Vite dev middleware locally. Never reintroduce a `VITE_ANTHROPIC_*` variable.

Without the key the app runs fine; only the "What does this mean?" AI mode returns an error state.

### Test and build

```bash
cd app
npm test               # vitest (node by default; component tests opt into jsdom per file)
npx tsc --noEmit       # type-check only
npm run build          # outputs to app/dist/
```

### Deploy (Vercel)

Root the Vercel project at `app/` — not the repo root. With that set:

- `app/api/interpret.ts` deploys automatically as a serverless function at `/api/interpret`.
- Set `ANTHROPIC_API_KEY` (and optionally `ANTHROPIC_MODEL`) in the Vercel project's environment variables. Do **not** prefix them with `VITE_`.
- Build command and output directory come from `app/vercel.json` (`npm run build` → `dist`).

---

## What It Does

Search any Spanish address → get a risk profile with:

- **Flood zone** — SNCZI T10/T100/T500 riverine flood zone status (MITERD)
- **Drought** — Copernicus CDI level (alert/warning/watch/none), updated weekly
- **Reservoirs** — The reservoirs supplying this area, with fill % against 5- and 10-year averages for the same date
- **Drinking water** — SINAC tap water compliance and source type
- **Coastal zone** — MITERD DPH building-restriction zones (coastal locations only)
- **Groundwater** — IGME overexploited aquifer status
- **Bathing water** — EEA beach/river quality rating within 5 km

All data is attributed and freshness-labelled. Detailed results currently cover Andalucía; elsewhere the app says so rather than guessing. AI output respects the ES/EN language toggle and never invents an aggregate risk score.

---

## Project Structure

```
water-risk/
├── app/                        # React SPA (Vite + TypeScript)
│   ├── api/                    # Vercel serverless functions (AI proxy)
│   ├── server/                 # Shared server-side logic for the proxy
│   └── src/
│       ├── components/         # Entry (search card), Map (layers, tray, legend), Panel
│       ├── map/                # Basemap style, layer plan, data layers, interactions
│       ├── registry/           # Dataset registry — drives panel, layers, legend, AI evidence
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
| Framework | React 19 + TypeScript + Vite 8 |
| Map | MapLibre GL JS 5 + OpenFreeMap (Positron, POI layers stripped) |
| Geocoding | Nominatim (OSM) |
| Styling | Tailwind CSS v4 |
| i18n | react-i18next |
| State | Zustand |
| AI | Claude Haiku 4.5 via a serverless proxy (`/api/interpret`) |
| Tests | Vitest + Testing Library |

All map tiles and data services are free and open — no billing account needed except for Claude.

---

## Data Sources

| Source | What | Status |
|--------|------|--------|
| MITERD SNCZI WMS | Riverine flood zones | ✅ Live |
| Copernicus EDO WMS | Drought CDI indicator | ✅ Live |
| OpenFreeMap | Map tiles | ✅ Live |
| Nominatim | Geocoding | ✅ Live |
| REDIAM | Andalucía reservoir levels | ✅ Live |
| SINAC (datos.gob.es) | Drinking water quality | ✅ Live |
| MITERD DPH WMS | Coastal flood zones | ✅ Live |
| IGME GeoJSON | Groundwater overexploitation | ✅ Live |
| EEA Bathing Water API | Bathing site quality | ✅ Live |

Full source catalogue with endpoints, licences, and update frequency: see `DATA-SOURCES.md`.

---

## Product Docs

- **[PLAN.md](PLAN.md)** — product north star, tech stack, v1 build scope, v2 roadmap, API reference, definition of done
- **[FLOWS.md](FLOWS.md)** — all 12 user flows with edge cases, outstanding interfaces, freshness policy
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — system overview, data flow, technical decisions, deployment
- **[PERSONAS.md](PERSONAS.md)** — audience model with AI prompt guidance
- **[DATA-SOURCES.md](DATA-SOURCES.md)** — master data source catalogue
- **[Interface design spec](docs/superpowers/specs/2026-07-24-water-risk-interface-design.md)** — the map-first redesign: states, dataset registry, Quiet Focus map system, AI disclosure rules
- **[AGENT-BRIEF-NEW-DATA-SOURCES.md](AGENT-BRIEF-NEW-DATA-SOURCES.md)** — step-by-step implementation guide for the 4 to-build data sources
- **[water-spain-research.md](water-spain-research.md)** — original research (data portals, tool landscape, opportunities)
- **Miro — Personas, Journey & Data Map:** https://miro.com/app/board/uXjVH4jzeig=/ — persona research with citations, the user journey diagram (location → persona → shared risk core → persona lens), and the questions↔data-sources map, all on one linked board
