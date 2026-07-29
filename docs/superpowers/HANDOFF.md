# Fire and Rain — Work Handoff

**Last updated:** 2026-07-29
**Worktree:** `/Users/editachavez/Projects/water-risk/.claude/worktrees/fire-and-rain`
**Branch:** `worktree-fire-and-rain` (branched from `main` at `ca294b0`)

## Where this stands

The interface redesign that the previous version of this file described as "not yet started" **is shipped**. That entry was stale for four merges; it is replaced below. See "What the previous handoff got wrong" if you are resuming from an older branch.

Current work is the **Fire and Rain** program: water risk and fire risk side by side, expanding from Andalucía to best-effort Mediterranean coverage.

- Spec: `docs/superpowers/specs/2026-07-29-fire-and-rain-design.md` (approved).
- Design handoff: `plans/design_handoff_fire_and_rain/` — read its `CHANGELOG.md` first. It is a **patch** on the shipped design, not a rebuild; anything not listed there is unchanged.
- Build order: **P0 → P1 → P2 → P4 → P5**. P3 (Live news) is deferred; only the `news` tab shell lands, in P1.

## Git state

```
7e5f407 fix: implement the missing setPage and goToSearch store actions
ca294b0 Merge pull request #7 from edichavezz/worktree-ai-explanations
a511890 Merge branch 'main' into worktree-ai-explanations
6adccf6 Merge pull request #11 from edichavezz/worktree-data-layers-fix
8dc1381 Merge pull request #10 from edichavezz/worktree-about-page
0a482cc chore: refresh reservoir data from REDIAM (2026-07-29)
```

Baseline verified green in this worktree: `npx tsc --noEmit` clean, 31 test files / 145 tests passing.

## What the previous handoff got wrong (READ before starting)

The prior file said "nothing implemented yet — no redesign source files exist". That was true of `worktree-interface-redesign`; it has not been true of `main` since PR #10. **Do not branch from `worktree-interface-redesign`** — it is behind `main` by four merges and lacks everything below.

Already on `main`, and all of it is load-bearing for this program:

- **`api/wms-proxy.ts` + `server/wmsProxyCore.ts`** — an allow-listed WMS relay with edge caching and an `UPSTREAMS` table. Each new fire overlay is ~6 lines in that table. Keep the allow-list-by-layer-name discipline; it is what stops the proxy being an SSRF hole.
- **`src/services/wmsSample.ts`** — `sampleUrl`/`samplePixel` read the centre pixel of a tiny WMS `GetMap`. **This is the single most reusable thing in the repo for this program**: both EFFIS and Copernicus EDO have broken `GetFeatureInfo`, and this is how we get point values out of them anyway.
- **`src/components/About/AboutPage.tsx`** — About is a real page, not a dialog. The conflict between the identity spec and the design handoffs is resolved in favour of the page.
- **`src/registry/ordering.ts`** (`rankByAvailability`), `AudienceSwitcher`, and a flood service rewritten onto pixel sampling — the old "error renders as safe" bug is fixed.

One fix was needed before any work could start: `setPage` and `goToSearch` were declared on `AppStore` and consumed by `AppHeader`, `AboutPage` and `routeSync`, but never implemented, so `tsc --noEmit` failed on `main`. Fixed in `7e5f407`.

## How to resume

1. `cd app && npm install` if this is a fresh checkout of the worktree.
2. Read the spec, then `plans/design_handoff_fire_and_rain/CHANGELOG.md`.
3. Work the phases in order. Each phase gets its own plan in `docs/superpowers/plans/`, and P0 has an internal 8-step migration order that must be followed — each step compiles and passes tests before the next.
4. Verify every step with `npx tsc --noEmit && npx vitest run && npm run build`, run from `app/`.
5. Commit with the `Co-Authored-By: Claude Opus 5` trailer.

## Phase tracker

| Phase | State |
|---|---|
| P0 — dismantle the coverage gate | In progress |
| P1 — visual patch + hazard families | Pending |
| P2 — fire datasets | Pending |
| P3 — live news | **Deferred** (tab shell only, in P1) |
| P4 — water widening + supply graph | Pending |
| P5 — About page redo | Pending, **needs real copy from the user** |

## Open unknowns

- **SINAC detail page** (`informacionAbastecimientoActionDetalleRed.do`) timed out three times at 120s during research. Whether it names source reservoirs decides whether Spain's registry tier carries a reservoir edge or only a system name. Spike before P4's Spain leg.
- **The MITECO `.mdb` schema** is unverified. Budget a spike before building that pipeline.
- **River-basin-district boundaries** — EEA WISE assumed, HydroBASINS level 5 is the public-domain fallback. Nothing downstream depends on which wins.
