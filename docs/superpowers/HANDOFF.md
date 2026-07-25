# Interface Redesign — Work Handoff

**Last updated:** 2026-07-25
**Worktree:** `/Users/editachavez/Projects/water-risk/.claude/worktrees/interface-redesign`
**Branch:** `worktree-interface-redesign`

## Where this stands

Design and planning are **done and committed**. Implementation is **not yet started** — we are at the very beginning of Task 1.

- Spec: `docs/superpowers/specs/2026-07-24-water-risk-interface-design.md` (approved, amended: map-first entry, "What does this mean?" AI framing, calm-but-distinctive §12.0, serverless AI proxy in scope, concurrent-worktree integration).
- Plan: `docs/superpowers/plans/2026-07-24-interface-redesign.md` — **17 tasks, TDD, the source of truth for execution.** Follow it step-by-step.

## Git state

Working tree clean. `git log --oneline -6`:

```
42e3878 Merge branch 'worktree-reservoir-data-audit' into worktree-interface-redesign
afcb611 Merge branch 'worktree-new-water-data-sources' into worktree-interface-redesign
8263503 (from new-water-data-sources) wire 4 new data sources
d00629b docs: add interface redesign implementation plan
62d6913 (from new-water-data-sources) bathing water card
0276683 (from reservoir-data-audit) match reservoirs by supply system
```

Both concurrent agent branches (`worktree-new-water-data-sources`, `worktree-reservoir-data-audit`) have been merged in. **At the start of every task, re-run the Global Constraints sync** (see plan) — those agents may push more.

## What changed vs. the plan's assumptions (READ before Task 1)

The merge from `worktree-reservoir-data-audit` **already added test tooling**, so Task 1 is largely pre-done:

- `vitest` (^4.1.10) is in devDependencies; `"test": "vitest run"` script exists.
- Existing test files already in the repo: `app/src/services/reservoirs.test.ts`, `app/src/data/supplySystems.test.ts`, `app/scripts/fetch-reservoirs.test.mjs`.
- `app/vite.config.ts` was modified by that branch (it configures vitest there). **I was about to read it when interrupted — read `app/vite.config.ts` first.**

**Task 1 remaining work:** only add the component-test pieces the plan lists that aren't present yet — `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `@types/node`, plus a jsdom `environment` + `setupFiles` for jest-dom matchers. Decide whether to keep vitest config in `vite.config.ts` (where the reservoir branch put it) or split into `vitest.config.ts` as the plan wrote — **prefer extending the existing `vite.config.ts` setup** to avoid fighting the other branch's config. Confirm the existing `.test.ts` files still pass after adding jsdom.

Other merge-in facts that affect later tasks:
- `getNearbyReservoirs` signature/behavior changed on the reservoir branch (now supply-system matching with proximity fallback, live data in `app/src/data/reservoirs.generated.json`). **Task 5 registry adapter for `reservoirs` must call the CURRENT signature** — verify in `app/src/services/reservoirs.ts` before writing the adapter.
- `proj4` is now a dependency (reservoir branch).
- New data sources (SINAC water quality, coastal DPH, groundwater, bathing water) are all present with services + types; the plan's registry (Task 5) already accounts for all seven datasets.

## How to resume

1. Re-read the plan's **Global Constraints** block and run the branch-sync check.
2. `cat app/vite.config.ts` to see the current vitest setup.
3. Finish Task 1 (add jsdom + Testing Library only; don't duplicate vitest).
4. Proceed Task 2 → 17 exactly as written, committing after each with the `Co-Authored-By: Claude Fable 5` trailer.
5. All app commands run from `app/`. Verify each task with `npx tsc --noEmit && npx vitest run && npm run build`.
6. After Task 17, invoke `superpowers:finishing-a-development-branch`.

## Task tracker

Tasks 1–17 map 1:1 to the plan. Task 1 in progress; 2–17 pending. Nothing implemented yet — no redesign source files exist beyond the merged data-source work.
