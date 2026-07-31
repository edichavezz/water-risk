# Handoff — data coverage audit

Branch `worktree-data-coverage-audit`. Findings and evidence live in
`DATA-COVERAGE-AUDIT.md`; this file is only what to do next.

State: 242 tests pass, `tsc --noEmit` clean, `npm run build` clean. The work is
committed. One commit amendment is outstanding (see item 0).

## How to re-run the audit

    cd app
    AUDIT_PORT=5231 node scripts/audit-coverage.mjs --json out.json

It boots a Vite dev server and runs the app's own service modules against the
live upstreams, so the readings are the app's, not a reimplementation. Port is
movable because parallel worktrees run their own dev servers — 5199 was already
taken by the `coverage-countries` worktree.

Each row records all four axes per dataset: `mapRole`/`mapUnavailable` (map
layer), `panel` + `data` (the reading), `coverageClaimed` (the info box), and
`aiEvidence` (the string handed to the model). Mismatches between those four
are the thing to look for — that is how the groundwater fabrication surfaced.

Takes a few minutes; Nominatim is rate-limited to 1 req/s deliberately.

## 0. Finish the last loop (small, do first)

`QUERY_DELTA` was raised 0.05 → 0.1 after the last full harness run, on direct
probe evidence. Two loose ends:

- Re-run the audit and refresh the table in `DATA-COVERAGE-AUDIT.md`. Lepe's
  `coastalFlood` cell is currently marked `ok*` — verified by probe, not by the
  harness. Expect it to come back `available`; if it does, drop the footnote.
- The commit message describes the coastal fix without naming the final width.
  Amend it, or leave it — the NOTE in `coastalZoning.ts` is the authority.

## 1. Query coastal zoning at the nearest coastline point (recommended next)

The one open defect. Níjar is told coastal zoning does not apply to it, when it
contains the entire Cabo de Gata coast and ZSP publishes profiles along it —
`MUNICIPIO = NIJAR` comes back when San José, Las Negras or Agua Amarga are
queried directly. Its centroid is ~25 km inland and the server's search
tolerance does not grow enough with the box to bridge that.

Do **not** try to fix this by widening `QUERY_DELTA` further:

- reach barely improves — Níjar still misses at 0.2 and 0.3;
- 0.2 is where an inland guard town (Jerez) starts returning features, and
  `parseFeatureInfo` takes the first feature with no distance ordering, so
  wider boxes start producing confident answers about the wrong municipality.

The fix is to move the query point to the nearest coastline vertex before
querying, and only then decide `available` / `unavailable` / `not_applicable`.
That also gives a real coastality test, which is what distinguishes "no
coastline, nothing owed" (Aracena) from "coastal, we failed to resolve it"
(Níjar). Note `not_applicable` also drops the dataset from the AI evidence
entirely — pinned in `ai.test.ts` — so getting this classification right matters
for the summary as well as the card.

## 2. Extend the hand-compiled data (explicitly in scope, not done)

The original brief asked for researching and completing the extra data. This arm
was documented honestly but not extended:

- **Reservoir supply systems** — 22 systems covering 132 of ~785 Andalusian
  municipalities (`app/src/data/supplySystems.ts`, keyed by
  `servesMunicipalities` with `reservoirCodEsts`). Níjar, Aracena and Órgiva
  show gaps for this reason. Sources are public; this is compilation work, not
  a connection problem.
- **SINAC drinking water** — 13 municipalities (`app/src/data/sinac.json`).
  7 of the 12 audited locations show gaps.

If either count changes, update the numbers in `entry.coverageNote` /
`about.coverageBody` in **both** `src/i18n/en.json` and `es.json` — they state
"132 of roughly 785" and "a 13-municipality sample" as facts to the user.

## 3. Groundwater — leave closed unless a real source appears

Removed because its data was four hand-drawn rectangles, three outside
Andalucía, producing a cited false negative for every point in Spain. Before
re-adding anything, note that all three obvious replacements were checked and
none works: MITECO's gateway faults, the REDIAM layer is gone from capabilities,
IDEE is surface water only.

The trap: the WFD "mal estado cuantitativo" classification is published and
looks like a substitute. It is not the same thing as a legally declared
overexploited unit. Using it would rebuild the same defect with a better
citation. The unreachable branch in `ai.ts` says this too.

## Ground rules that shaped this work

- Nothing added without a citable source and a `// NOTE (verified …)` comment.
- A sourced-looking wrong answer is the defect being audited for — never add
  one. When a probe and the app disagree, assume the probe is wrong until
  proven otherwise; that happened twice here (a PNG decoder that rejected bit
  depth 1/2, and a hit test matching the literal word "Feature" in the response
  header) and both times the probe was the broken one.
- Check hit *attribution*, not just hit/miss, whenever a query box is widened.
- `unavailable` and `error` must never be styled or worded as safe.

## Scratch probes

The one-off scripts used for the coastal, drought and legend evidence are in
this job's tmp dir (`coastal*.mjs`, `nijar.mjs`, `legend.mjs`, `drought.mjs`)
and are not committed — the durable ones are `app/scripts/audit-coverage.mjs`,
`fetch-andalucia-boundary.mjs` and `pngPixel.mjs`.
