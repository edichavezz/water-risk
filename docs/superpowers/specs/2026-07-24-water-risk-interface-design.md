# Water Risk Explorer — Interface Redesign Specification

**Date:** 24 July 2026

**Status:** Design approved in wireframes; written specification pending final review

**Scope:** Landing page, map workspace, information hierarchy, map-layer system, optional AI interpretation, responsive behaviour, visual system, and implementation architecture

**Out of scope:** Implementing the redesign, adding new data sources, authentication, saved searches, location comparison, and expanding detailed coverage beyond Andalucía

## 1. Purpose

Redesign the existing water-risk app into a calmer, clearer, map-first product that:

- lets someone check a Spanish postcode with minimal friction;
- makes current data coverage explicit without presenting the product as Andalucía-only;
- separates published data from optional AI interpretation;
- supports a growing number of datasets without becoming a generic GIS interface;
- reveals detail progressively as the person searches, selects data, and asks for explanation;
- works as a coherent map workspace on desktop and mobile.

The redesign changes the experience and front-end structure around the existing data services. It does not alter the meaning of their results.

## 2. Existing Product Context

The current application is a React, TypeScript, Vite and MapLibre single-page app. It uses OpenFreeMap for the basemap, Nominatim for search, WMS services for flood and drought data, bundled reservoir data, Zustand for state, and react-i18next for English and Spanish.

The current experience has several problems this design addresses:

- it opens directly into a utilitarian map rather than orienting a new visitor;
- a fixed-width panel mixes public data, user type, AI summaries and suggested questions in one long stack;
- map layers are presented as a flat set of toggles and are all able to compete visually;
- areas outside detailed coverage are not clearly distinguished from areas with low risk;
- the shipped Buyer/Renter/Farmer/Business selector no longer matches the documented target personas;
- AI appears too close to source data and is generated too readily;
- the mobile layout becomes a vertical page rather than preserving the map workspace.

The existing data-source work and any uncommitted changes remain separate from this redesign.

## 3. Product Principles

### 3.1 The postcode is the only gate

A person can search without identifying their audience. Audience selection is optional and sits immediately below the postcode field so it is likely to be noticed without becoming a prerequisite.

### 3.2 Public data is the default

Published data appears first. AI content is neither generated nor shown until the person explicitly requests interpretation.

### 3.3 The map communicates geography; the panel carries depth

The map shows coverage, the active thematic layer, selected geography, a concise legend and short hover values. Sources, caveats, longer explanations and AI interpretation belong in the panel.

### 3.4 Complexity is progressive

The initial map is calm. The data list starts narrow. Selecting a dataset widens the panel and reveals evidence. Choosing interpretation widens it again only if needed.

### 3.5 Missing data never looks safe

Unsupported coverage, an unavailable value, a failed source request and a genuinely low value are four different states and must never share the same presentation.

### 3.6 Audience changes emphasis, not evidence

The selected audience can reorder datasets and change explanatory framing. It cannot alter the underlying public-data result.

## 4. Audience Model

The MVP uses the two confirmed audience lenses in `PERSONAS.md`:

1. **Resident or owner** — someone living in or operating from the location and trying to understand ongoing exposure, daily implications, insurance or ownership concerns.
2. **Buyer or investor** — someone considering a purchase or investment and assessing the location before deciding.

The landing-page labels are written as actions rather than internal persona names:

- **I live or own here**
- **I’m considering buying or investing**

No audience is selected by default. The person can change or remove the lens from the workspace.

Policymaker and Farmer are not included in this redesign's MVP controls. The architecture may accept additional audience definitions later, but no dormant UI is created for them.

## 5. Information Architecture

The experience has two primary surfaces:

1. **Landing**
2. **Map workspace**

The workspace has two persistent information modes:

- **Public data**
- **AI interpretation · optional**

Within Public data, the panel has two depths:

- **Dataset list**
- **Dataset detail**

AI interpretation is the third depth and preserves the dataset or location context that opened it.

```text
Landing
  ├─ Search postcode → Map workspace / Public data / Dataset list
  └─ Explore map     → Map workspace / Regional coverage

Map workspace
  ├─ Public data
  │   ├─ Dataset list
  │   └─ Dataset detail
  └─ AI interpretation
      ├─ Location interpretation
      └─ Selected-dataset interpretation
```

The Public data / AI interpretation control appears as soon as a search produces a supported result and remains in the same position at every panel depth.

## 6. Landing Page

### 6.1 Content

Use literal, descriptive language:

- Heading: **Check water risks for a postcode**
- Supporting text: **See available public data on flooding, drought, reservoirs and water quality for a specific area.**
- Location label: **Postcode, town or address**
- Audience prompt: **What brings you here?**
- Audience status: **Optional**
- Primary action: **Check this area**
- Secondary route: **Explore the map without searching**

Avoid slogans, broad promises and ambiguous headings such as “Understand risk and why it matters.”

### 6.2 Layout

On desktop, use a two-part composition:

- a focused search area on the left;
- a quiet coverage map on the right.

The search unit contains, in this order:

1. location input;
2. optional audience choices;
3. “You can change this later” reassurance;
4. primary submit action.

The audience controls belong inside the same visual group as the location input. They must not be placed in a distant secondary section.

The coverage map states:

> Detailed results are available for Andalucía. Other regions will be added over time.

It includes a simple key for “Detailed data available” and “Not yet available.”

### 6.3 Behaviour

- Valid search suggestions may be postcodes, towns or addresses, matching the current geocoder capability.
- Submission navigates to the workspace and zooms to the selected result.
- Audience is passed as optional context.
- “Explore the map” opens a regional view centred on Andalucía without inventing a risk result.
- If a search resolves outside supported coverage, the workspace still shows the location and explains that detailed data is not available there.

## 7. Desktop Map Workspace

### 7.1 Persistent frame

The workspace contains:

- a slim top bar with product name, location search and language control;
- a full-bleed map;
- a floating left panel;
- a compact “Map layers” control;
- native map navigation controls;
- a dynamic legend when a thematic layer is active.

The map remains visible at every panel depth.

### 7.2 Progressive left panel

The panel changes width and content rather than sending the person to separate result pages:

| State | Indicative width | Purpose |
|---|---:|---|
| Dataset list | 320–360 px | Scan available public data |
| Dataset detail | 420–480 px | Read one result, source, freshness and limitations |
| AI interpretation | 480–560 px | Read an optional explanation and ask a follow-up |

These are target ranges, not hard breakpoints. The panel must leave enough visible map to preserve spatial context.

Panel transitions use a restrained 240 ms ease. They do not bounce. Reduced-motion preferences remove the width animation.

### 7.3 Dataset list

Each row contains:

- dataset name;
- a concise current result or state;
- freshness or update cadence;
- a non-colour status cue;
- selection state;
- map availability where relevant.

Selecting a row:

1. activates that dataset's primary map layer if it has one;
2. synchronizes the relevant feature or location on the map;
3. opens dataset detail.

Datasets without a map representation remain valid panel entries and do not force an artificial map layer.

### 7.4 Dataset detail

Dataset detail contains:

- back control to all public data;
- dataset title;
- direct result statement;
- short explanation of what the source measured;
- source organisation;
- update date or cadence;
- geography or spatial resolution;
- explicit limitations under **Does not show**;
- link to the original source where available;
- optional **Explain this result** action.

The result statement must distinguish a source finding from a complete property-level conclusion. For example:

> Outside the mapped T10, T100 and T500 zones

followed by:

> No official river-flood polygon intersects the selected point.

The limitation then explains that this does not cover surface-water flooding, property drainage or historical incidents.

### 7.5 Persistent Public data / AI control

The two modes remain visible in the same position in the list, detail and interpretation states.

There are two routes into AI interpretation:

1. select the **AI interpretation · optional** tab for a location-level explanation;
2. choose **Explain this result** from a dataset detail for a dataset-specific explanation.

Returning to Public data restores the exact prior list or dataset-detail context.

## 8. Quiet Focus Map System

### 8.1 Map direction

The approved direction is **Quiet Focus**:

- calm geographic basemap;
- one primary thematic risk layer at a time;
- at most one contextual overlay by default;
- dynamic legend;
- progressive detail by zoom;
- stronger emphasis only for the selected geometry.

A second contextual overlay may be enabled, but the control warns that the map can become harder to read. A multi-layer analyst studio is deferred.

### 8.2 Basemap

Create a custom OpenFreeMap style derived from Positron or Liberty and edited through a MapLibre-compatible style workflow.

The style should:

- use pale neutral land and light blue water;
- reduce saturation and prominence of roads and points of interest;
- retain place names and essential roads at local zoom;
- reduce label density at regional zoom;
- keep labels above analytical fills;
- fade slightly when a visually dense raster layer is active;
- stay two-dimensional with no pitch or decorative 3D terrain.

The basemap is not pure greyscale. It should provide enough geographic structure to orient someone while allowing data layers to supply most colour.

### 8.3 Coverage layer

Coverage is a separate layer from risk.

At the regional view:

- Andalucía is outlined and lightly filled with the coverage green;
- the rest of Spain and neighbouring areas remain visible but muted;
- the key says **Detailed data available** and **Detailed data not yet available**;
- the map never labels an unsupported region as low risk.

Coverage is registry-driven so additional regions can become available without redesigning the interface. Each region entry contains:

- region identifier;
- geometry;
- availability status;
- supported datasets;
- effective date;
- optional coverage note.

### 8.4 Layer hierarchy

Render map information in this conceptual order:

1. basemap;
2. coverage;
3. one primary thematic layer;
4. up to two contextual overlays;
5. selected location or feature;
6. boundaries and labels;
7. HTML controls, hover preview and legend.

Primary thematic layers are mutually exclusive. Examples include flooding, drought, coastal risk and groundwater status.

Contextual overlays do not replace the primary legend. Examples include reservoirs, river-basin boundaries and administrative boundaries.

Some datasets, including municipal drinking-water records, may be panel-only.

### 8.5 Progressive disclosure by zoom

| Zoom context | Visible information |
|---|---|
| Regional, approximately z5–7 | Coverage regions, major place names and regional boundaries |
| Area, approximately z8–11 | Municipalities, basins and clustered point features |
| Local, approximately z12+ | Detailed hazard geometry, individual reservoirs, roads and local labels |

Exact thresholds may vary by source geometry, but no layer should expose detail that is unreadable at the current scale.

Reservoir points cluster at lower zoom and become individual points only when useful. Dense vector or raster detail appears only at an appropriate zoom.

### 8.6 Map-layer tray

The closed control reads **Map layers · n**, where `n` is the number of visible data layers.

The open tray has three groups:

1. **Primary risk layer** — radio selection; exactly zero or one active.
2. **Context** — checkbox selection; one active by default, two maximum without a readability warning.
3. **Background map** — a quiet default with labels and roads adjusted automatically by zoom.

Do not use an ever-growing row of header pills or expose opacity sliders in the default experience.

Future analyst controls can be introduced as a separate advanced mode rather than expanding the default tray indefinitely.

### 8.7 Legend

The legend is visible only when needed and reflects only what is currently drawn.

For each active layer, show:

- human-readable layer title;
- units or categories;
- visual ramp or symbols;
- source;
- update date or cadence.

When a primary layer changes, the legend changes with it. Coverage retains a small separate key at the regional view.

### 8.8 Hover and selection

Hover shows only:

- feature name;
- one primary value or classification;
- time period where material;
- instruction to select for detail.

Click or keyboard selection:

- locks the geometry;
- applies a stronger outline and non-colour selected state;
- opens the matching public-data detail in the panel;
- preserves the selected postcode marker.

Long popups are not used. The panel and map synchronize in both directions.

### 8.9 Layer opacity and emphasis

Starting ranges:

- custom vector fill: 20–35% opacity;
- raster WMS: 35–55% opacity;
- selected outline: 2–3 px with a clearly higher-contrast stroke;
- coverage fill: light enough to keep the basemap readable.

These are calibration ranges, not universal constants. Final values must be tested against the real source imagery and the custom basemap.

### 8.10 Information that never floats over the map

Do not place these in map popups:

- AI prose;
- long source descriptions;
- full limitation notes;
- legal or insurance guidance;
- generated overall risk scores;
- several competing risk summaries.

## 9. Data and Presentation Model

### 9.1 Dataset registry

Build the UI from a dataset registry rather than hard-coded card and toggle lists. Each dataset definition should provide:

- stable identifier;
- English and Spanish labels;
- category;
- source name and source URL;
- update cadence;
- geographic resolution;
- limitation copy;
- audience emphasis rules;
- coverage rules;
- map representation type: primary, context or none;
- layer styling and zoom rules where applicable;
- whether dataset-specific AI interpretation is allowed.

This registry controls ordering, list rows, detail metadata, layer-tray membership and legend content.

### 9.2 Normalized result states

Every dataset resolves to one explicit UI state:

| State | Meaning | Presentation |
|---|---|---|
| `loading` | Request or local lookup is in progress | Skeleton or progress copy |
| `available` | A usable result exists | Value, source and freshness |
| `unavailable` | Dataset applies, but no usable current result exists | Neutral “No current result available” |
| `not_applicable` | Dataset does not apply to this place | Omit from default list or label clearly |
| `unsupported` | The location is outside this dataset's coverage | Coverage explanation, never a risk value |
| `error` | Source or parsing failed | “Source could not be reached,” with retry where useful |

`unavailable`, `unsupported` and `error` must never render as “none,” “safe,” “outside risk,” or a green state.

### 9.3 Application state

Represent the main interaction state explicitly:

- surface: landing or workspace;
- selected location;
- selected audience or none;
- coverage result;
- panel mode: public data or AI;
- panel depth: list, detail or interpretation;
- selected dataset;
- selected map feature;
- primary layer;
- contextual overlays;
- language;
- per-dataset result states.

The UI should derive from this state rather than distributing navigation decisions across individual card components.

### 9.4 Shareable state

The implementation should support direct links to a searched location and, where appropriate, the selected dataset. Postcode, audience, mode and dataset may be represented in the route or query string as long as:

- public data remains the default;
- AI output itself is not embedded in the URL;
- unsupported or stale parameters fail safely;
- changing map-only context does not produce excessive browser-history entries.

## 10. AI Interpretation

### 10.1 Opt-in boundary

No AI request is made merely because a search completed. Generation starts only after the person:

- selects the AI interpretation tab; or
- chooses **Explain this result**.

### 10.2 Interpretation screen

The screen contains:

- label: **AI-assisted interpretation**;
- literal title, such as **What this flood result may mean**;
- basis statement identifying the public dataset and selected audience;
- concise interpretation;
- useful suggested questions;
- optional follow-up input.

The follow-up input is not shown as a default chat product. It appears after interpretation has been requested and remains scoped to the evidence already shown.

### 10.3 Safety and evidence rules

AI must:

- cite or name the public data used in the response;
- distinguish direct findings from inference;
- retain source limitations;
- use the selected audience only for emphasis and practical framing;
- avoid legal, financial or safety certainty;
- state when the available data cannot answer the question;
- avoid inventing an aggregate “overall risk” score.

AI must not produce a risk interpretation for a location outside detailed coverage. It may explain that coverage is unavailable and suggest authoritative sources to check, but it cannot infer the missing risk result.

### 10.4 Service boundary

Move AI requests behind a serverless proxy before production. The client must not ship an API key. The proxy should accept structured, minimal source data and audience context rather than arbitrary client-authored system prompts.

## 11. Responsive Behaviour

### 11.1 Desktop

Use the floating progressive left panel described above. The map continues under and beside the panel, with controls positioned to avoid collision at every panel width.

### 11.2 Tablet

The panel may occupy a larger fraction of the viewport. Dataset detail can become a side sheet while preserving a meaningful visible map area.

### 11.3 Mobile

The panel becomes a bottom sheet with three stable positions:

1. **Peek** — default after search; place name and up to three concise signals.
2. **Half** — scan the dataset list while the map remains visible.
3. **Full** — dataset detail or AI interpretation.

The sheet must have explicit controls in addition to dragging so it is not gesture-only.

Mobile interaction rules:

- tapping a map feature raises the sheet to half height with that feature selected;
- tapping a data row activates its map layer;
- full dataset detail opens only when requested;
- dragging or using the explicit map control returns to map emphasis;
- the Public data / AI interpretation control remains persistent;
- the layer tray opens as a dedicated sheet above the results sheet and returns to the previous sheet position when closed.

The mobile experience is not “map followed by all cards.”

## 12. Visual Design System

### 12.1 Typography

Use **Atkinson Hyperlegible** throughout:

- weight 400 for body and supporting content;
- weight 700 for headings, labels and controls;
- avoid excessive weight changes, all-caps headings and display typography that feels promotional.

The content hierarchy should come from scale, spacing and grouping more than decorative styling.

### 12.2 Core colours

| Token | Value | Use |
|---|---|---|
| Canvas | `#FFFFFF` | Primary background |
| Ink | `#20312A` | Main text |
| Muted text | `#68766F` | Secondary text |
| Primary blue | `#285F77` | Primary action and selected controls |
| Primary hover | `#204E62` | Hover and pressed action state |
| Primary soft | `#E4EFF3` | Selected surfaces and quiet AI context |
| Focus | `#78A9BD` | Focus ring |
| Subtle cool | `#F5F8F9` | Secondary grouping |
| Subtle warm | `#F7F7F3` | Data rows and neutral groups |
| Coverage green | `#7FA38C` | Detailed-data coverage |
| Water blue | `#4B91AD` | Water and flood data |
| Positive green | `#397353` | Positive data state |
| Warning amber | `#B87535` | Warning marks, not small text |
| Danger red | `#AD4942` | High-risk or error data state |

The interface accent remains mineral blue. Data layers may introduce additional tested colours as required, but UI controls do not change colour to match the current dataset.

### 12.3 Spacing, shape and depth

- spacing scale: 4, 8, 12, 16, 24, 32 and 48 px;
- control radius: 8 px;
- group radius: 12 px;
- major panel radius: 16 px;
- minimum target size: 44 by 44 px;
- borders reserved for inputs, focus, true boundaries and separators;
- tonal surfaces used for grouping;
- shadows used only for actual elevation such as floating panels and map controls.

Avoid square controls, excessive outlines, pill-shaped containers, glass effects, gradients used as decoration, and generic AI sparkle imagery.

### 12.4 Icons

Use a simple 1.5 px line-icon family. Do not use emojis as interface icons. Every unfamiliar icon includes a visible label or accessible name.

### 12.5 Motion

- control feedback: approximately 150 ms;
- panel and sheet transitions: approximately 240 ms;
- map easing: no more than 450 ms;
- no bounce or decorative motion;
- honour `prefers-reduced-motion`.

## 13. Content Style

Use calm, literal and evidence-led language.

Prefer:

- “Detailed data is available in Andalucía.”
- “Source could not be reached.”
- “Outside the mapped river-flood zones.”
- “Explain this result.”

Avoid:

- “Discover your water-risk story.”
- “Unlock powerful insights.”
- “Smart risk analysis.”
- “Safe” when the data only says a mapped zone does not intersect the point.

English and Spanish strings should be designed together. Controls must allow for Spanish expansion without truncation.

## 14. Accessibility

The implementation must:

- meet WCAG 2.2 AA colour contrast;
- never use colour as the only carrier of risk, availability or selection;
- give every map value an equivalent panel representation;
- provide keyboard access to search, tabs, data rows, layer controls and selectable map features;
- expose map controls and legends with accessible names;
- retain visible focus using the focus token;
- announce loading, source failure and coverage changes without moving focus unexpectedly;
- provide text descriptions for selected map features;
- support 200% text zoom without losing core actions;
- respect reduced motion;
- keep touch targets at least 44 by 44 px.

The map is an enhancement to, not the sole source of, the risk result.

## 15. Error and Edge Cases

### 15.1 Invalid or unresolved location

Keep the landing or workspace search active, explain that the location could not be found, and offer nearby suggestions. Do not clear a previously valid workspace result until a new valid location is selected.

### 15.2 Search outside detailed coverage

Show the resolved place on the wider map. The panel states:

> Detailed water-risk data is not yet available for this area.

Offer another search and preserve the wider coverage map. Do not activate AI interpretation.

### 15.3 Partial source failure

Render successful datasets immediately. The failed dataset receives its own error state and retry if the source is suitable for retry. One failed source does not replace the entire workspace with an error page.

### 15.4 Slow sources

Use per-dataset loading states. Do not wait for every source before showing the panel. The map and already-resolved public data remain usable.

### 15.5 No result from an applicable source

Use `unavailable`, not a low-risk colour. Explain whether the absence reflects freshness, geography, resolution or source limitations where known.

### 15.6 Language change

Translate interface and source explanation immediately. Existing AI interpretation is marked stale and regenerated only if the person explicitly asks for the translated interpretation.

## 16. Recommended Front-End Architecture

The redesign should be implemented as bounded units:

### 16.1 Navigation shell

Owns landing/workspace navigation, route state, top bar and language control.

### 16.2 Search unit

Owns location input, suggestion selection, optional audience and submission. It returns structured search intent and does not fetch risk datasets itself.

### 16.3 Coverage service and registry

Determines whether the selected point is supported and which datasets apply. It is independent from risk classification.

### 16.4 Profile orchestrator

Starts applicable dataset requests in parallel, normalizes their states and exposes incremental results.

### 16.5 Dataset registry

Defines labels, metadata, detail views, layer type, coverage, legend and audience emphasis.

### 16.6 Workspace panel

Owns mode and depth navigation. Dataset-specific displays receive normalized result data and registry metadata.

### 16.7 Map layer manager

Maps dataset state to MapLibre sources and layers, enforces one primary layer, manages context overlays, applies zoom rules, and synchronizes hover and selection with the panel.

### 16.8 AI interpretation service

Lives behind a serverless endpoint, accepts structured evidence and returns a typed interpretation with suggested questions and evidence references.

This structure replaces the current model in which search, fetching, cards, layer toggles and AI generation are tightly coupled.

## 17. Testing Strategy

### 17.1 Unit tests

Test:

- coverage lookup;
- normalized dataset-state mapping;
- layer exclusivity and contextual-layer limit;
- registry ordering and audience emphasis;
- panel navigation state;
- AI request gating;
- route-state parsing;
- English and Spanish label presence.

### 17.2 Component tests

Test:

- landing search with and without audience;
- dataset list loading, available, unavailable, unsupported and error states;
- dataset-detail source and limitation display;
- persistent Public data / AI tabs;
- “Explain this result” preserving dataset context;
- layer tray behaviour;
- mobile sheet controls.

### 17.3 Map integration tests

Test:

- coverage mask and key;
- zoom-dependent visibility;
- exactly one primary layer active;
- contextual overlays limited as designed;
- dynamic legend;
- hover preview;
- click selection and panel synchronization;
- unsupported locations never receiving a risk style.

### 17.4 End-to-end journeys

Cover:

1. postcode search with no audience;
2. postcode search as Resident/Owner;
3. postcode search as Buyer/Investor;
4. direct map entry;
5. location inside Andalucía;
6. location outside supported coverage;
7. one source failing while others resolve;
8. opening and leaving AI interpretation;
9. language change;
10. mobile peek, half and full sheet flow.

### 17.5 Visual and accessibility checks

Use representative flood rasters, drought rasters, dense point data and long Spanish strings. Verify contrast, focus order, 200% zoom, reduced motion and screen-reader access to equivalent data.

## 18. Acceptance Criteria

The redesign is complete when:

- the landing page makes postcode search the clear primary action;
- optional audience selection is directly beneath the location input;
- a person can enter the map without searching;
- Andalucía coverage is clear and other regions are labelled unavailable rather than low risk;
- the map defaults to Quiet Focus;
- only one primary risk layer can be active;
- the layer tray distinguishes primary and contextual layers;
- the legend reflects visible data and includes source freshness;
- dataset rows and map features synchronize;
- public data and AI interpretation remain visibly separate;
- no AI request occurs before explicit opt-in;
- dataset detail contains source, freshness, geography and limitations;
- unsupported, unavailable and error states are distinct;
- the desktop panel progressively widens;
- mobile uses the three-position bottom sheet;
- the visual system uses Atkinson Hyperlegible, white canvas and mineral-blue accent;
- both English and Spanish experiences meet accessibility requirements;
- AI credentials are no longer exposed in the browser in production.

## 19. Deferred Work

The following are intentionally deferred:

- full GIS-style layer studio with opacity controls;
- side-by-side location comparison;
- saved locations or accounts;
- policymaker and farmer audience modes;
- parcel-level or building-level claims;
- generated aggregate risk scoring;
- proactive chat or a default conversational interface;
- automated expansion to new regions;
- implementation of new public-data sources already described elsewhere.

## 20. Research References

The map design was informed by:

- [WRI Aqueduct Water Risk Atlas](https://www.wri.org/aqueduct/help-center/how-use-analysis-features-water-risk-atlas) — location-led analysis across a larger indicator system;
- [Google Flood Hub](https://sites.research.google/gr/floodforecasting/) — focused hazard presentation;
- [Felt interface](https://help.felt.com/getting-started/tour-the-interface) and [layer list](https://help.felt.com/layers/list) — selection-led detail, grouped layers and map-linked legends;
- [EPA EnviroAtlas](https://www.epa.gov/enviroatlas/enviroatlas-interactive-map) — curated layer collections and scale-dependent presentation;
- [MapLibre style specification](https://maplibre.org/maplibre-style-spec/layers/) — zoom-dependent layers and data-driven styling;
- [OpenFreeMap styles](https://openfreemap.org/quick_start/) and [Maputnik](https://maputnik.github.io/) — custom MapLibre-compatible basemap styling.

## 21. Approved Visual References

The exploratory mockups are stored locally under:

- `.superpowers/brainstorm/32743-1784895022/content/landing-postcode-first-v3.html`
- `.superpowers/brainstorm/32743-1784895022/content/map-workspace-structure.html`
- `.superpowers/brainstorm/32743-1784895022/content/map-workspace-transition-v2.html`
- `.superpowers/brainstorm/32743-1784895022/content/map-coverage-behavior.html`
- `.superpowers/brainstorm/32743-1784895022/content/mobile-workspace.html`
- `.superpowers/brainstorm/32743-1784895022/content/design-system-component-sheet.html`
- `.superpowers/brainstorm/39947-1784900202/content/quiet-focus-map-system.html`

These mockups are design references, not production code.
