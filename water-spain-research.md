# Water Spain Tool: Research Report
## Existing Tools, Data Sources, and Opportunities for a Bilingual AI/Geospatial Water Scarcity Tool for Spain

**Prepared:** June 2026  
**Scope:** Spain, with priority on Andalucía and southern Spain  
**Design priority:** Local residents, communities, renters, homeowners, and people making location decisions in Spain

---

## A. Existing Tools and Platforms

### A1. Spanish National and Regional Tools

**SAIH (Sistema Automático de Información Hidrológica)**
- **What it does:** Real-time hydrological monitoring network operated by each river basin authority (Confederación Hidrográfica). Captures rainfall, reservoir levels, river flows, and flood alerts at sensor points across Spain.
- **Who it is for:** Water managers, emergency services, and technically capable public users.
- **Data:** Real-time and historical hydrometeorological data; downloadable shapefiles of sensor point locations.
- **Access:** Dashboard viewers per basin (e.g., CHGuadalquivir, CHSegura, CHGuadiana); some data via datos.gob.es. No unified national API for time-series data.
- **Free/Open:** Yes. Data is public. Cartography downloadable from MITERD.
- **Language:** Spanish only.
- **Gap:** Highly technical; no plain-language interpretation; no address-level lookup; no user-facing alerts.
- **URL:** https://www.miteco.gob.es/en/agua/temas/evaluacion-de-los-recursos-hidricos/saih.html

**MITERD Hydrological Bulletin (Boletín Hidrológico)**
- **What it does:** Weekly report summarising reservoir levels, rainfall anomalies, drought indicators, and river flows across all Spanish basins. Integrates SAIH data, AEMET climate data, and river basin authority reporting.
- **Who it is for:** Government, press, researchers, technically aware public.
- **Data:** Aggregated weekly; available as PDF and structured tables; some machine-readable outputs.
- **Access:** PDF download from MITERD website; datos.gob.es catalogue entry.
- **Free/Open:** Yes.
- **Language:** Spanish.
- **Gap:** Not georeferenced to address or municipality; no API; no household relevance layer; not updated in real time.
- **URL:** https://www.miteco.gob.es/en/agua/servicios.html

**SNCZI (Sistema Nacional de Cartografía de Zonas Inundables)**
- **What it does:** Spain's official national flood zone mapping system. Provides flood extent cartography for return periods of 5, 10, 25, 50, 100, and 500 years, plus Hydraulic Public Domain (DPH) boundaries.
- **Who it is for:** Planners, insurers, property buyers, public.
- **Data:** Vector GIS layers (shapefile, WMS/WFS); viewable in a cartographic viewer. Approximately 3 million Spaniards live in high flood-risk zones per this dataset.
- **Access:** Interactive viewer on MITERD geoportal; WMS/WFS download available.
- **Free/Open:** Yes. INSPIRE compliant.
- **Language:** Spanish.
- **Gap:** No address lookup UX; no plain-language explanation of what a flood zone means for a resident; does not incorporate post-DANA 2024 revised flood data in all areas yet.
- **URL:** https://www.miteco.gob.es/en/agua/temas/gestion-de-los-riesgos-de-inundacion/snczi.html

**REDIAM (Red de Información Ambiental de Andalucía)**
- **What it does:** Andalucía's regional environmental information network, managed by the Agencia de Medio Ambiente y Agua. Described as Europe's most comprehensive regional environmental portal, with over 4,500 datasets and 2,000 interoperable geographic data services.
- **Who it is for:** Government, researchers, environmental practitioners, increasingly the public.
- **Data:** Biodiversity, land use, water quality, protected areas, climate variables, wildfire history, soil, coastal data. Includes the CLIMA MAP geoportal for temperature, precipitation, and water balance projections; an Andalusia Reservoir Viewer; and a Climate Scenario Viewer.
- **Access:** WMS/WFS services; downloadable layers; IDEAndalucía geoportal integration.
- **Free/Open:** Yes. Open access.
- **Language:** Spanish.
- **Gap:** No single address lookup tool; data is fragmented across many portals; no user-facing plain-language interface; international users face a language barrier.
- **URL:** https://www.juntadeandalucia.es/medioambiente/portal/acceso-rediam

**Junta de Andalucía Open Data Portal (datos.juntadeandalucia.es)**
- **What it does:** Hosts hundreds of Andalusian public datasets including environmental, agricultural, and water-related data.
- **Access:** API (CKAN-based), CSV, JSON, WMS/WFS.
- **Free/Open:** Yes. Open licence for most datasets.
- **Language:** Spanish.
- **URL:** https://www.juntadeandalucia.es/datosabiertos/portal/

**IDEAndalucía (Infraestructura de Datos Espaciales de Andalucía)**
- **What it does:** Geospatial data infrastructure for Andalucía. Provides OGC-compliant WMS and WFS services for layers including land use, hydrology, protected areas, coastal zones, and planning.
- **Access:** WMS/WFS/ATOM services; downloadable layers.
- **Free/Open:** Yes.
- **Language:** Spanish.
- **URL:** https://www.ideandalucia.es/portal/

**Andalusia Reservoir Viewer**
- **What it does:** Near-daily reservoir level data for Andalucía's reservoirs, drawing from REDIAM.
- **Access:** Web viewer; data also on datos.gob.es.
- **Free/Open:** Yes.
- **Language:** Spanish.
- **URL:** https://datos.gob.es/en/applications/andalusia-reservoir-viewer

**SINAC (Sistema de Información Nacional de Agua de Consumo)**
- **What it does:** Spain's national drinking water quality database. Provides information on water supply zones, treatment, quality monitoring, and population served, at municipality level.
- **Who it is for:** Public health monitoring, citizens.
- **Data:** Municipality-level water supply data including quality parameters.
- **Access:** Web portal via Ministry of Health; some structured data available.
- **Free/Open:** Yes.
- **Language:** Spanish.
- **Gap:** Does not cover drought risk, groundwater stress, or supply disruption risk; limited geospatial functionality.
- **URL:** https://www.sanidad.gob.es/areas/sanidadAmbiental/calidadAguas/aguasConsumoHumano/informacionSinac.htm

**Embalses.net / Embalses.info**
- **What it does:** Citizen-built applications showing current reservoir levels across all of Spain, drawing on MITERD/SAIH open data. Weekly updates for 400+ reservoirs organised by river basin.
- **Who it is for:** General public; journalists; citizens monitoring water supply.
- **Access:** Web app.
- **Free/Open:** Yes.
- **Language:** Spanish.
- **Gap:** Shows reservoir data only; no household-level insight; no drought interpretation; no future risk layer.
- **URL:** https://datos.gob.es/en/applications/embalsesnet

**AEMET OpenData**
- **What it does:** Spanish State Meteorological Agency's open data platform. Provides historical and forecast climate data, extreme weather alerts, precipitation, temperature, and drought indicators.
- **Access:** REST API with API key (free registration); JSON/CSV output.
- **Free/Open:** Yes, with registration.
- **Language:** Spanish; partial English.
- **URL:** https://opendata.aemet.es/

---

### A2. European Tools

**European Drought Observatory (EDO) / Copernicus Emergency Management Service**
- **What it does:** EU-level drought monitoring via the Joint Research Centre (JRC). Produces maps and time-series of drought indicators including the Combined Drought Indicator (CDI), Standardized Precipitation Index (SPI), Soil Moisture Anomaly, and fAPAR (vegetation stress). In November 2025, large areas of south-western Spain were under alert conditions.
- **Who it is for:** Policymakers, researchers, emergency managers; technically capable public.
- **Data:** Raster maps at ~5 km resolution; time-series; downloadable via EDO portal and Copernicus Data Space.
- **Access:** Web map viewer; OGC services; free download.
- **Free/Open:** Yes. Open access.
- **Language:** English; some content in EU languages.
- **Gap:** Not municipality or address specific; not in Spanish; no household relevance layer.
- **URL:** https://drought.emergency.copernicus.eu/

**Climate-ADAPT (EEA)**
- **What it does:** European portal for climate change adaptation knowledge, tools, and case studies. Includes indicators for drought impact on ecosystems, flood risk, heat, and coastal risk across Europe; links to national adaptation strategies including Spain's PNACC.
- **Access:** Web viewer; linked datasets downloadable from EEA Datahub.
- **Free/Open:** Yes.
- **Language:** English.
- **Gap:** Primarily policy-facing; not address-level; not in Spanish.
- **URL:** https://climate-adapt.eea.europa.eu/

**EEA Flood Risk Areas Viewer**
- **What it does:** EU-wide map viewer of flood risk areas under the EU Floods Directive (2007/60/EC). Covers Spain's nationally reported flood hazard and risk zones.
- **Access:** Web viewer; downloadable data via EEA Datahub and Discomap.
- **Free/Open:** Yes.
- **Language:** English.
- **URL:** https://discomap.eea.europa.eu/floodsviewer/

**Copernicus Land Monitoring Service (CLMS)**
- **What it does:** Provides Europe-wide and global land monitoring products including soil moisture (daily, 1 km), land cover (CORINE Land Cover), vegetation status (NDVI, fAPAR), soil water index, and imperviousness. All freely downloadable.
- **Access:** Copernicus Data Space Ecosystem; OData API; Sentinel Hub.
- **Free/Open:** Yes. Open access.
- **Language:** English.
- **URL:** https://land.copernicus.eu/en

---

### A3. Global Commercial / Non-Profit Tools

**WRI Aqueduct Water Risk Atlas (v4.0)**
- **What it does:** Global water risk mapping tool from the World Resources Institute. Covers 13 indicators including baseline water stress, water depletion, drought risk, flood risk, groundwater table decline, and interannual variability. Version 4.0 is the most current as of 2026.
- **Who it is for:** Businesses, investors, researchers, policy makers; general public via web tool.
- **Data:** Catchment-level (~15 arcminute resolution); annual and monthly baselines; future projections to 2030, 2040, 2050 under multiple SSP scenarios.
- **Access:** Interactive web tool; full dataset download (GeoJSON, CSV, GDB); also on Google Earth Engine and Esri Living Atlas.
- **Free/Open:** Yes. Open licence (CC BY 4.0).
- **Language:** English.
- **Gap:** Catchment-level resolution only — not municipal or address-level; not in Spanish; does not incorporate local infrastructure context (desalination, restrictions); primarily corporate/investor facing UX.
- **URL:** https://www.wri.org/applications/aqueduct/water-risk-atlas/

**ClimateCheck**
- **What it does:** US-based property-level climate risk platform. Rates five hazards (heat, flood, drought, fire, storm) on a 1–100 scale for individual addresses, through 2050. Drought is based on water supply stress modelling.
- **Who it is for:** Property buyers, mortgage lenders, real estate agents — primarily US market.
- **Data:** Proprietary models drawing on public climate and hydrological data.
- **Access:** Paid API and reports; limited free lookups.
- **Free/Open:** No. Commercial.
- **Language:** English.
- **Gap:** US-centric; not calibrated to Spanish water management system; not in Spanish; does not incorporate Spanish institutional data (basin authorities, desalination, supply networks).
- **URL:** https://climatecheck.com/

**Climate X (Spectra)**
- **What it does:** Physical climate risk analytics platform targeting institutional asset owners and lenders. Covers flood, drought, heat, wildfire, and coastal risk at property/portfolio level. Has produced analysis of Spain's water crisis and climate risk outlook.
- **Who it is for:** Financial institutions, insurers, real estate portfolios.
- **Data:** Proprietary; draws on global climate models.
- **Access:** Paid subscription.
- **Free/Open:** No. Commercial.
- **Language:** English.
- **Gap:** Institutional product; not citizen-facing; not in Spanish; no Spanish open data integration.
- **URL:** https://www.climate-x.com/

**Mitiga Solutions**
- **What it does:** Barcelona-based climate risk analytics firm. Has published detailed analysis of Spain's water crisis and climate risks using proprietary physical risk models. Offers enterprise-level solutions.
- **Who it is for:** Corporations, investors, governments.
- **Access:** Paid.
- **Free/Open:** No.
- **Language:** English; some Spanish content.
- **Gap:** Not citizen-facing; no free tool for residents or homebuyers.
- **URL:** https://www.mitigasolutions.com/

**WATERSensing (Spain)**
- **What it does:** Academic/research early-warning system for natural disasters (floods) in Spain using social media monitoring alongside sensor data.
- **Who it is for:** Emergency managers, researchers.
- **Gap:** Research prototype; not a citizen tool; not address-level; limited to flood alerts.

---

## B. Open / Free Datasets and Data Portals

### B1. Spanish National

| Source | What it covers | Granularity | Access | Licence |
|--------|---------------|-------------|--------|---------|
| **datos.gob.es** | Spanish national open data catalogue — water, environment, climate, planning | Varies | CKAN API, download | Open (varies by dataset) |
| **MITERD Open Data (datosabiertos.miteco.gob.es)** | Environment, water, climate, biodiversity | Varies | API, download | Open |
| **SAIH datasets (datos.gob.es)** | Real-time hydrological sensor data (Guadalquivir, Segura, etc.) | Point sensors; basin | Download, some dashboards | Open |
| **AEMET OpenData** | Meteorology, climate, drought indicators | Station, municipality, grid | REST API (free key) | Open (with attribution) |
| **Hispagua / CEDEX** | National water information system — reservoirs, aquifers, quality, infrastructure | Basin, municipality | Web portal, some downloads | Open |
| **IGME-CSIC (eWater portal)** | Hydrogeology, aquifer maps, permeability, groundwater data | 1:1,000,000; aquifer unit | Download (shapefiles) | Open |
| **SINAC (Ministry of Health)** | Drinking water quality by supply zone | Municipality / supply zone | Web portal | Open |
| **Catastro (DGC)** | Property parcels, buildings, addresses — INSPIRE compliant | Address / parcel | WMS/WFS/ATOM API; free | Open |
| **SIGPAC (FEGA / Junta Andalucía)** | Agricultural parcels, irrigation coefficients, land use | Parcel | WFS/ATOM download; QGIS plugin | Open |
| **IGN (Centro Nacional de Información Geográfica)** | Base cartography, topography, aerial imagery, municipal boundaries | Address to national | WMS/WFS/ATOM; CNIG download centre | Open |
| **SIU (Sistema de Información Urbana, MIVAU)** | Urban planning information by municipality | Municipality | Web viewer, some downloads | Open |
| **Junta Andalucía Urban Planning Portal** | Digitised PGOU/POU plans by municipality | Municipality | PDF/viewer | Open |

### B2. Regional (Andalucía)

| Source | What it covers | Access |
|--------|---------------|--------|
| **REDIAM** | Comprehensive environmental data: land use, hydrology, protected areas, wildfire, climate scenarios, soil, coastal | WMS/WFS/download via IDEAndalucía |
| **IDEAndalucía** | Geospatial infrastructure: OGC services for all REDIAM layers | WMS/WFS/ATOM |
| **Junta Andalucía Open Data Portal** | Hundreds of Andalusian datasets including water, agriculture, environment | CKAN API |
| **Andalusia Reservoir Viewer** | Near-daily reservoir levels | Web/datos.gob.es |
| **SAIH Guadalquivir** | Real-time hydrology for Guadalquivir basin (covers most of Andalucía) | Dashboard + datos.gob.es |
| **ACUAMED project data** | Desalination and water reuse infrastructure (Mediterranean basins) | Project documents; partial open data |

### B3. European / Global

| Source | What it covers | Granularity | Access |
|--------|---------------|-------------|--------|
| **Copernicus EDO** | Drought indicators (CDI, SPI, SMA, fAPAR) | ~5 km raster | Free download; OGC services |
| **Copernicus CLMS** | Soil moisture, land cover, vegetation, imperviousness | 1 km–100 m | Free download; Sentinel Hub API |
| **Copernicus Emergency Management Service** | Flood mapping (on-demand and historical); wildfire monitoring (EFFIS) | Event / ~30 m | Free |
| **EEA Datahub** | Climate indicators, flood risk zones, drought impact, coastal flooding | EU-wide | Free download |
| **JRC (Joint Research Centre)** | Flood hazard maps (Global Flood Awareness System, GloFAS); drought impact database | EU-wide; ~100 m | Free |
| **WRI Aqueduct 4.0** | Water stress, depletion, drought, flood risk, groundwater | Catchment | Free download (CC BY 4.0) |
| **INSPIRE Geoportal** | EU-wide harmonised spatial data (cadastre, flood zones, addresses, nature) | Varies | Free; OGC services |
| **Global Flood Risk (FATHOM / JRC)** | High-resolution global flood hazard maps | ~90 m | Free for research |
| **FAO AQUASTAT** | Country-level water resources, irrigation, agriculture | National/regional | Free |
| **OpenStreetMap** | Roads, addresses, POIs, municipal boundaries | Address | Free; Overpass API |

---

## C. Relevant Spanish Institutions and Authorities

### National Government

**MITERD / MITECO (Ministerio para la Transición Ecológica y el Reto Demográfico)**
- Lead national water and climate authority.
- Publishes SAIH data, hydrological bulletins, drought plans, SNCZI flood maps.
- Operates or oversees: CHs (river basin authorities), AEMET, CEDEX, IGME, ACUAMED.
- **Key portal:** https://www.miteco.gob.es/en/agua/

**Confederaciones Hidrográficas (River Basin Authorities)**
Spain's river basins most relevant to Andalucía and the south:
- **CHGuadalquivir** (Seville) — covers most of Andalucía; main basin for Córdoba, Jaén, Sevilla, Granada, Huelva, and parts of Almería/Cádiz/Málaga. Has a SAIH with real-time dashboard; drought management plan (Plan Especial de Sequía) published. Website: https://www.chguadalquivir.es/
- **CHSur** (Málaga) — coastal rivers of Málaga, Granada, and Almería flowing to the Mediterranean. Has dedicated drought plan and reservoir monitoring. Website: https://www.chsur.es/
- **CHGuadiana** (Badajoz/Ciudad Real) — northern Huelva; source of significant groundwater stress (Doñana). Website: https://www.chguadiana.es/
- **CHSegura** (Murcia) — covers Almería's eastern fringe; one of Europe's most water-stressed basins. Website: https://www.chsegura.es/
- **CHEbro** — not relevant to Andalucía but relevant if tool expands.

Each CH publishes:
- Drought Management Plans (Planes Especiales de Sequía, PES) with drought indicator systems (Unidades Territoriales de Sequía / UTS)
- Hydrological Plans 2022–2027 with allocation data
- SAIH real-time data
- Flood zone cartography

**AEMET (Agencia Estatal de Meteorología)**
- National weather and climate service.
- Publishes climate normals, extreme weather alerts, seasonal forecasts, drought indices.
- **OpenData API:** https://opendata.aemet.es/
- Key datasets: Standardised Precipitation Index (SPI), Palmer Drought Index, temperature and precipitation anomalies.

**CEDEX (Centro de Estudios y Experimentación de Obras Públicas)**
- Technical arm of MITERD for water engineering and research.
- Runs **Hispagua**, the national water information system portal: historical reservoir data, aquifer data, water quality, hydrological statistics.
- **URL:** https://hispagua.cedex.es/

**IGME-CSIC (Instituto Geológico y Minero de España)**
- National geological survey. Manages the **eWater portal** with hydrogeological maps, aquifer boundaries, groundwater data, and overexploitation declarations.
- Spain has 18 officially declared overexploited hydrogeological units, primarily in SE Spain (Segura basin, Almería, Murcia).
- **URL:** https://www.igme.es/

**IGN (Instituto Geográfico Nacional)**
- National cartographic authority. Provides base maps, orthophotos, municipal boundaries, addresses.
- **CNIG Download Centre:** https://centrodedescargas.cnig.es/

**DGC (Dirección General del Catastro)**
- Cadastral authority. Provides parcel, building, and address data via INSPIRE-compliant WMS/WFS/ATOM APIs.
- **URL:** https://www.catastro.hacienda.gob.es/

**ACUAMED (Aguas de las Cuencas Mediterráneas)**
- Public company managing water infrastructure in Mediterranean river basins including much of SE Spain/Andalucía.
- Responsible for major desalination and water reuse projects in Almería and Málaga.
- **URL:** https://www.acuamed.es/

**MIVAU (Ministerio de Vivienda y Agenda Urbana)**
- Manages the SIU urban planning information system; relevant for understanding planned urban development and its water implications.

### Regional Government (Junta de Andalucía)

**Consejería de Sostenibilidad, Medio Ambiente y Economía Azul**
- Regional environment ministry; runs REDIAM.

**Agencia de Medio Ambiente y Agua (AMAYA)**
- Technical body within Junta de Andalucía; manages REDIAM's 50-person data team, water quality monitoring, reservoir tracking.

**Consejería de Fomento, Articulación del Territorio y Vivienda**
- Manages urban and territorial planning; houses the Junta's urban planning viewer (PGOU/POU).

---

## D. Potential Data Layers for the Map

Organised by category and household-level usefulness:

### Immediate Household Relevance

| Layer | Source | Granularity | Update Freq. | Access |
|-------|--------|-------------|--------------|--------|
| Current drought status (CDI indicator) | Copernicus EDO | ~5 km raster | Weekly | Free WMS |
| Reservoir levels (current %) | MITERD/SAIH + REDIAM | Per reservoir | Weekly/daily | datos.gob.es API |
| Active drought restrictions (supply cuts, limits) | CHs / municipal press releases | Municipality | Ad hoc | No structured open data — scraping/manual |
| Flood zone (SNCZI) | MITERD | Address-level vector | Infrequent updates | WMS/WFS |
| Drinking water quality (SINAC) | Ministry of Health | Supply zone | Annual/quarterly | Web portal |
| Heat risk index | AEMET / Copernicus | Municipality/grid | Seasonal | API |
| Wildfire risk (EFFIS / MITERD) | Copernicus/MITERD | Municipality/grid | Annual + real-time | WMS/download |

### Local Water System Context

| Layer | Source | Granularity | Access |
|-------|--------|-------------|--------|
| Aquifer boundaries and overexploitation status | IGME eWater | Hydrogeological unit | WMS/shapefile |
| Groundwater level trends | IGME/CHs | Well points | Partial open data |
| Desalination plant locations + capacity | ACUAMED; press/ministerial data | Point | No single API — manual |
| Water reuse scheme locations | ACUAMED; CHs | Point | Partial open data |
| River basin boundaries | MITERD/IGN | Vector | WFS/download |
| Irrigation zone boundaries (SIGPAC) | FEGA / Junta Andalucía | Parcel | WFS/ATOM |

### Future Pressures and Development

| Layer | Source | Granularity | Access |
|-------|--------|-------------|--------|
| Urban development plans (PGOU/POU) | Junta Andalucía planning portal; SIU | Municipality | PDFs/viewer; no API |
| Environmental Impact Assessments (EIAs) | MITERD environmental assessment portal; BOE | Project | PDFs; no structured API |
| Planned renewable energy (solar farms) | MITERD; regional governments; press | Point/polygon | No unified open dataset |
| Planned data centres | Ministry of Digital Transformation; press; EIA announcements | Point | No structured data |
| Golf courses (existing + planned) | SIGPAC; municipal plans; press | Point/polygon | SIGPAC open; planning data fragmented |
| Tourism developments | Municipal plans; press | Polygon | No structured open dataset |

### Climate and Environmental Risk

| Layer | Source | Granularity | Access |
|-------|--------|-------------|--------|
| Long-term drought risk (WRI Aqueduct) | WRI | Catchment | Free download |
| Water stress projections 2030–2050 | WRI Aqueduct 4.0 | Catchment | Free download |
| Desertification risk | Atlas de la Desertificación (UA) | Sub-basin | Research data |
| Soil erosion risk | Copernicus / EEA | ~100 m raster | Free |
| Coastal flood/erosion risk | Copernicus / MITERD | Coastal strip | WMS |
| Protected areas (Natura 2000, Doñana, etc.) | MITERD / IDEAndalucía | Vector | WFS/download |
| Land cover change (CORINE) | Copernicus CLMS | 100 m raster | Free download |

---

## E. Future Development and Planning Data Sources

This is the hardest data category to systematise because Spain's planning system is fragmented across 17 autonomous communities and 8,000+ municipalities.

**What exists (open/structured):**

- **EIA declarations (Declaraciones de Impacto Ambiental):** Published in the BOE (Official State Gazette) and autonomous community official gazettes. MITERD holds a register of EIAs for nationally significant projects. These are PDFs — not a structured database. URL: https://www.miteco.gob.es/en/calidad-y-evaluacion-ambiental/temas/Evaluacion_Ambiental/
- **PGOU/POU (Municipal Plans) — Andalucía:** The Junta de Andalucía hosts a portal with digitised urban planning instruments. This covers approved plans; in-progress modifications are harder to access. URL: https://ws132.juntadeandalucia.es/situadifusion/pages/search.jsf
- **SIU (National Urban Planning Information System):** MIVAU's national system aggregates municipal classification zones. URL: https://www.mivau.gob.es/urbanismo-y-suelo/sistema-de-informacion-urbana/
- **BOE and BOJA (Official Gazettes):** EIAs, concessions, planning approvals, and water rights grants are published here but require text parsing to extract and structure.
- **Spain's Draft Royal Decree on Data Centres (2025):** Requires water consumption reporting from data centre operators — this data may become a future open data source once implemented.

**What does not exist as structured data:**
- A centralised, geocoded, machine-readable database of approved or pending EIAs filtered by location.
- A unified map of planned solar farms, wind farms, data centres, agri-industrial developments with water demand estimates.
- A live register of planned golf course or tourism development applications in Andalucía.

**Practical approach for the MVP:** Monitor BOE, BOJA (Boletín Oficial de la Junta de Andalucía), and press sources. Use AI/NLP to parse EIA announcements and extract location, project type, and water implications. Cross-reference with municipal planning zones from SIU/PGOU data.

---

## F. Gaps, Limitations, and Risks

**Data gaps:**

1. **No unified address-level water risk lookup exists in Spain.** The closest thing is the SNCZI flood viewer, but it lacks drought, supply, or groundwater dimensions. No tool combines flood + drought + supply + groundwater + heat into a single location query.

2. **Drought restriction data is not centralised or structured.** When municipalities or river basin authorities impose supply cuts or usage restrictions, these are published via local press releases, official websites, and social media — not through a machine-readable API. This is a critical gap for a user who wants to know "is my area currently under restrictions?"

3. **Groundwater data is incomplete and fragmented.** IGME provides aquifer boundaries and overexploitation status, but monitoring well data and real-time groundwater levels are distributed across river basin authorities with inconsistent open data publication.

4. **Desalination and water reuse infrastructure is not georeferenced in a unified open dataset.** ACUAMED, the CHs, and the Junta all manage infrastructure separately. No single API returns "which desalination plants serve this municipality."

5. **Future development data (EIAs, solar, data centres, golf) is only available as PDFs in official gazettes.** Structuring this requires AI-assisted text extraction and geocoding.

6. **Granularity vs. coverage trade-off.** The best Spanish data (SAIH, SNCZI) is high quality but basin- or sensor-level, not municipality or address level. European data (EDO, Aqueduct) is coarser resolution (5 km–catchment) but covers all indicators.

**Data risks:**

- **Update lag:** Reservoir and drought data may lag behind real-world conditions by days to weeks.
- **Administrative boundary mismatches:** Spanish supply zones (SINAC), catchments (SAIH), flood zones (SNCZI), and municipal boundaries (IGN) use different geographic units that require careful spatial joining.
- **Legal caution with EIAs and planning data:** Projects shown as "planned" in EIAs may be withdrawn, modified, or delayed. Clear temporal labelling and caveats are essential.
- **Data sovereignty and licences:** While most Spanish open data is CC-BY or equivalent, some AEMET data requires attribution and may restrict commercial use. Always verify per dataset.
- **Political sensitivity:** Water governance in Spain is intensely contested (Tajo-Segura transfer, Doñana agricultural abstraction, desalination priorities). The tool should present data factually without taking sides.

---

## G. Recommended MVP Data Sources

For a minimum viable product focused on Andalucía, these are the highest-priority, most accessible data sources:

| Priority | Layer | Source | Why |
|----------|-------|--------|-----|
| 1 | Flood zone (SNCZI) | MITERD WMS/WFS | Authoritative, address-level, INSPIRE compliant, free |
| 2 | Reservoir levels | REDIAM / datos.gob.es | Near-daily; municipality/basin linkable; free API |
| 3 | Drought status (CDI) | Copernicus EDO | Weekly updates; standardised EU indicator; free WMS |
| 4 | Water stress projections | WRI Aqueduct 4.0 | Global standard; downloadable; free; future scenarios |
| 5 | Municipal boundaries + addresses | IGN / Catastro DGC | Address lookup backbone; INSPIRE; free |
| 6 | Aquifer overexploitation zones | IGME eWater | Critical for SE Spain; shapefile download |
| 7 | Desertification/wildfire risk | Copernicus EFFIS + REDIAM | Key for Andalucía; free layers |
| 8 | Drinking water quality | SINAC (Ministry of Health) | Municipally granular; public |
| 9 | Urban planning zones | SIU + Junta Andalucía PGOU viewer | Development pressure context |
| 10 | AEMET climate data | AEMET OpenData API | Precipitation anomalies, drought indices, heat alerts |

**Near-term additions (post-MVP):**
- SIGPAC irrigation zones (agricultural water demand context)
- EIA text parsing for planned developments (AI-assisted)
- SAIH real-time river flow and reservoir data per basin authority
- Copernicus soil moisture time-series for groundwater proxy

---

## H. Opportunities Where AI Adds Genuine Value

The data exists; what is missing is interpretation, translation, and human relevance. This is where AI can make a substantial difference:

**1. Plain-language translation of technical indicators**
Convert drought index values (CDI: "Warning"; SPI-3: -1.4; reservoir capacity: 23%) into plain-language statements: *"Los embalses que abastecen tu zona están al 23% de su capacidad, por debajo de la media histórica del 48% para esta época del año. Esto indica una situación de sequía moderada."*

**2. Household-level implications by user type**
Given the same flood or drought risk layer, AI can generate tailored explanations:
- For a renter: what to check in a tenancy agreement; whether landlords are required to disclose flood risk
- For a homeowner: insurance implications; what a flood zone means for resale value; whether a mortgage lender will require flood insurance
- For a farmer or smallholder: irrigation restrictions; groundwater abstraction rights; crop risk
- For a small business: supply disruption risk; regulatory exposure

**3. Bilingual (Spanish/English) explanations**
All UI text, risk summaries, and data explanations generated in both languages. AI handles nuanced translation of regulatory terms (e.g., "zona inundable T100" → "area at risk of flooding in a 1-in-100-year event").

**4. Summarising municipal plans and EIAs**
Upload or scrape a PGOU or EIA PDF; AI extracts: What is being proposed? Where exactly? What is the estimated water demand? What mitigation measures are proposed? What is the status?

**5. Contextualising planned developments near a location**
*"Within 10 km of your selected location, there are two proposed solar farms and one proposed data centre currently in environmental assessment. Collectively, these projects have estimated water requirements of X m³/year."*

**6. Generating questions to ask**
Prompted by a location's risk profile, AI generates tailored questions:
- *Questions to ask your estate agent:* "Is this property in a flood zone? Has it ever flooded? Is there a nota simple entry for hydraulic public domain proximity?"
- *Questions for your community president (presidente de comunidad):* "What is the source of the community's water supply? Has the supply ever been restricted?"
- *Questions for the municipality:* "Are there any planned developments in this area that have been granted water concessions? Is the municipal water supply system connected to desalination?"

**7. Uncertainty and data gap flagging**
AI proactively communicates where data is incomplete or dated: *"Groundwater level data for this aquifer was last updated 18 months ago. The aquifer is classified as overexploited, but current conditions may differ."*

**8. Trend narratives**
Rather than showing a time-series chart alone, AI generates a narrative: *"Reservoir levels in the Guadalquivir basin have been below 30% capacity for the past four consecutive winters — a pattern not seen since the 1994–1995 drought."*

**9. Generating "what does this mean for me" summaries**
After loading a location, AI synthesises all risk layers into a single-page summary per user type — resident, buyer, tenant, business — in plain Spanish and English.

**10. Identifying and surfacing relevant news and reports**
Using retrieval-augmented generation (RAG), the tool can surface recent news items, municipal announcements, or NGO reports relevant to a specific location's water situation.

---

## I. Open Questions for Product Discovery

**Data and technical:**
1. Can real-time drought restriction information (municipal/basin authority-imposed supply cuts) be accessed programmatically, or does this require manual monitoring and a human editorial layer?
2. Which river basin authorities (CHs) have the most machine-readable and up-to-date open data APIs, and which require manual data extraction?
3. Is there a geocoded database of Spain's water supply zones (from SINAC) that can be spatially joined to addresses? SINAC has municipality-level data, but supply zones don't always align with municipal boundaries.
4. What is the most reliable method for an address-level user query to return the correct river basin authority, reservoir supply chain, and drought indicator unit (UTS)?
5. Are ACUAMED's desalination and reuse infrastructure datasets available in a structured, geocoded format, or only in project documentation PDFs?

**Product and user:**
6. What is the primary moment of need for this tool? Buying a property, during an active drought, planning a move, deciding where to farm? The answer changes what data is essential for the MVP.
7. How do Spanish users expect to search for their location — municipality name, postcode, or address? Postcode coverage in rural Andalucía is patchy; municipality name may be more reliable.
8. Should the tool provide a simple risk score (like Aqueduct or ClimateCheck) or a richer, more contextual explanation? The latter serves residents better; the former is easier to build and compare.
9. What level of liability and caveating is appropriate for a tool that informs property and location decisions? Consultation with a Spanish legal expert on disclaimer requirements is advisable.
10. How should the tool handle fast-moving situations like active drought emergencies or flood events? Does it need a real-time alert layer, or is a weekly-updated baseline sufficient for the MVP?
11. Are there local NGOs, water advocacy groups, or community platforms in Andalucía (e.g., around Doñana, the Cabo de Gata, the Guadalhorce valley) who could be early partners for validation and user testing?
12. How does the tool handle the political sensitivity of water in Spain, particularly around the Tajo-Segura transfer, Doñana agricultural abstraction, and proposed desalination vs. conservation debates?

---

## Source Directory

### Official Spanish Sources
- [MITERD Water Portal](https://www.miteco.gob.es/en/agua/) — national water authority
- [AEMET OpenData API](https://opendata.aemet.es/) — meteorological open data
- [MITERD SAIH (hydrological monitoring)](https://www.miteco.gob.es/en/agua/temas/evaluacion-de-los-recursos-hidricos/saih.html)
- [SNCZI Flood Zone System](https://www.miteco.gob.es/en/agua/temas/gestion-de-los-riesgos-de-inundacion/snczi.html)
- [CEDEX Hispagua](https://hispagua.cedex.es/) — national water information
- [IGME eWater / hydrogeology](https://www.igme.es/)
- [SINAC drinking water quality](https://www.sanidad.gob.es/areas/sanidadAmbiental/calidadAguas/aguasConsumoHumano/informacionSinac.htm)
- [DGC Catastro INSPIRE services](https://www.catastro.hacienda.gob.es/webinspire/index_eng.html)
- [IGN CNIG Download Centre](https://centrodedescargas.cnig.es/)
- [SIGPAC (FEGA)](https://www.fega.gob.es/en/pepac-2023-2027/sistemas-gestion-y-control/sigpac)
- [ACUAMED](https://www.acuamed.es/en/)
- [CHGuadalquivir](https://www.chguadalquivir.es/)
- [CHSur (Málaga)](https://www.chsur.es/)
- [CHSegura](https://www.chsegura.es/)
- [CHGuadiana](https://www.chguadiana.es/)
- [datos.gob.es national open data portal](https://datos.gob.es/en/)
- [SAIH Guadalquivir on datos.gob.es](https://datos.gob.es/en/catalogo/ea0043519-sistema-automatico-de-informacion-hidrologica-saih-de-la-demarcacion-hidrografica-del-guadalquivir)

### Andalucía Regional
- [REDIAM](https://www.juntadeandalucia.es/medioambiente/portal/acceso-rediam)
- [IDEAndalucía](https://www.ideandalucia.es/portal/)
- [Junta Andalucía Open Data Portal](https://www.juntadeandalucia.es/datosabiertos/portal/)
- [Junta Andalucía Urban Planning Portal](https://ws132.juntadeandalucia.es/situadifusion/pages/search.jsf)
- [Andalusia Reservoir Viewer](https://datos.gob.es/en/applications/andalusia-reservoir-viewer)

### European / Global Official
- [Copernicus EDO (European Drought Observatory)](https://drought.emergency.copernicus.eu/)
- [Copernicus Land Monitoring Service](https://land.copernicus.eu/en)
- [EEA Climate-ADAPT](https://climate-adapt.eea.europa.eu/en)
- [EEA Flood Risk Areas Viewer](https://discomap.eea.europa.eu/floodsviewer/EEA)
- [JRC European and Global Drought Observatories](https://joint-research-centre.ec.europa.eu/european-and-global-drought-observatories_en)
- [WRI Aqueduct Water Risk Atlas](https://www.wri.org/applications/aqueduct/water-risk-atlas/)
- [WRI Aqueduct 4.0 on Google Earth Engine](https://developers.google.com/earth-engine/datasets/catalog/WRI_Aqueduct_Water_Risk_V4_baseline_annual)
- [INSPIRE Geoportal](https://inspire-geoportal.ec.europa.eu/)

### Academic / Non-Profit
- [Atlas de la Desertificación de España (UA)](https://atlas-desertificacion.ua.es/en/)
- [Mitiga Solutions — Spain water crisis analysis](https://www.mitigasolutions.com/blog/spain-struggle-water)
- [PNAS — Severe water crisis in southern Spain](https://www.pnas.org/doi/10.1073/pnas.2508055122)
- [AQUACROSS — REDIAM profile](https://aquacross.eu/content/environmental-information-network-andalusia-red-de-informaci%C3%B3n-ambiental-de-andaluc%C3%ADarediam.html)

### Commercial
- [ClimateCheck](https://climatecheck.com/)
- [Climate X / Spectra](https://www.climate-x.com/)

### Media
- [Mitiga Solutions — Spain Water Crisis (2025)](https://www.mitigasolutions.com/blog/spain-struggle-water)
- [CNBC — AI mega projects raise alarm in Europe's driest regions (Oct 2025)](https://www.cnbc.com/2025/10/16/water-ai-mega-projects-raise-alarm-in-some-of-europes-driest-regions.html)
- [Spain proposes strict sustainability requirements for data centres (Sept 2025)](https://www.insideenergyandenvironment.com/2025/09/spain-proposes-strict-sustainability-requirements-for-data-centers/)
- [New maps double flood risks of Spanish homes](https://www.waternewseurope.com/new-maps-double-flood-risks-of-spanish-homes/)
- [Banco de España — desertification and wildfires blog](https://www.bde.es/wbe/en/noticias-eventos/blog/desertificacion-e-incendios-en-espana-el-impacto-del-cambio-climatico-sobre-el-credito-bancario.html)

---

*This document is intended as a living research base for product development. All URLs should be verified before integration; data licences should be confirmed per dataset before any commercial or public deployment.*
