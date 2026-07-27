# Release Candidate / Phase 4 Closure Implementation Plan

> Execute this plan on `feat/release-candidate-phase4`. Preserve the accepted
> P4-01 through P4-04 closures and the locked single-runtime architecture.

**Goal:** Produce a fully adjudicated, verified, mergeable Release Candidate
without adding another spatial chapter.

**Authority:**  
`docs/superpowers/specs/2026-07-27-release-candidate-phase4-closure.md`

## Global constraints

- Do not create or name P4-05.
- Do not add Canvas, renderer, camera, RAF, or R3F runtime paths.
- Do not use product code to hide test-environment or measurement defects.
- Do not loosen visual continuity, fallback, reduced-motion, or resource gates.
- Do not commit ignored evidence, logs, `test-results`, or Playwright reports.
- Do not merge `main`, replace production assets, or deploy without explicit
  authority for that batch.

## RC-00 — Baseline and debt triage

### Task 1: Establish the branch and engineering baseline

- [x] Create and push `feat/release-candidate-phase4` from `9f2f103`.
- [x] Confirm the starting worktree is clean.
- [x] Run lint, typecheck, unit, build, and full E2E on an isolated server.
- [x] Preserve raw failure evidence outside tracked Git scope.

### Task 2: Guarantee no-omission E2E accounting

Files:

- `playwright.rc.config.ts`
- `scripts/run-rc-e2e-baseline.mjs`
- `scripts/run-rc-e2e-baseline.test.js`
- `package.json`

Steps:

1. Run the entire E2E suite with one worker.
2. Detect expected-pass declarations reported skipped after a serial failure.
3. Rerun every affected `file:line` declaration.
4. Count runtime opt-in skips as skipped.
5. Count missing follow-ups as omitted and fail the command.
6. Save raw JSON under ignored release evidence.

Verification:

```bash
pnpm exec vitest run scripts/run-rc-e2e-baseline.test.js
node scripts/run-rc-e2e-baseline.mjs --summarize-existing artifacts/release-candidate/rc00
```

Expected RC-00 aggregate:

```text
76 discovered / 58 passed / 11 failed / 7 skipped / 0 omitted
```

### Task 3: Adjudicate the 11 failures

- [x] Retain screenshot, error context, trace, and raw report for each failure.
- [x] Inspect the final composed page, not only internal WebGL probes.
- [x] Classify each item A/B/C/D with an evidence sentence.
- [x] Record expected, actual, progress, lifecycle, CameraIntent, fallback,
  evidence path, and earliest known occurrence.

Decision:

- two Category A Media composition blockers;
- nine Category B test-semantics repairs;
- zero Category C or D findings in the canonical run.

### Task 4: Bound the preload-only reverse Minor

Files:

- `src/lib/webgl/SceneDirector.test.ts`
- `src/lib/webgl/SceneDirector.ts` (read-only diagnosis in RC-00)
- `src/lib/webgl/books/BooksScene.test.ts` (existing ownership evidence)

Steps:

1. Preload Books without entering visible/dominant state.
2. Reverse outside the preload range.
3. Verify cold resident state, no updating, global-idle CameraIntent, and one
   preload.
4. Re-enter and verify successful activation without duplicate preload.
5. Correlate with exact-one-owner and disposal tests in `BooksScene.test.ts`.

Decision: Minor retained-residency debt; no current leak growth, stale intent,
or activation failure; not a release blocker.

### Task 5: Remove lint warnings

Files:

- `src/lib/webgl/SceneDirector.ts`
- `tests/e2e/browser-integration.spec.ts`

Steps:

1. Remove truly unused values and helper code.
2. Remove the obsolete `eslint-disable`.
3. Do not add suppression directives.
4. Verify zero errors and zero warnings.

### Task 6: Publish RC authority and handoff

Files:

- `docs/superpowers/specs/2026-07-27-release-candidate-phase4-closure.md`
- `docs/superpowers/plans/2026-07-27-release-candidate-phase4-closure-plan.md`
- `docs/architecture/phase-handoff.md`
- `docs/architecture/session-handoff.md`

Record the corrected E2E accounting, two confirmed blockers, nine semantics
repairs, preload Minor decision, full-site matrix, audit plan, and RC-01 entry.

RC-00 final verification:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
git status --short
```

## RC-01 — Hero / Media E2E debt repair

### Task 1: Fix Category A Media composition defects

Primary files:

- `src/lib/webgl/media/mediaSceneConfig.ts`
- Media motion/projection tests
- `tests/e2e/browser-integration.spec.ts`

Method:

1. Add or retain failing unit/projection tests for:
   - Desktop secondary exposure `0.18-0.24`;
   - focal x inside the exposed asset fraction;
   - Desktop main area `71200-74200`.
2. Make the smallest Media-only composition adjustment.
3. Verify Mobile remains inside its accepted contract.
4. Capture Desktop/Mobile normal and Canvas-only evidence.
5. Do not touch About or Books composition.

Exit gate: both Category A failures pass with visual evidence and no new scene
regression.

### Task 2: Replace outdated composed-visibility semantics

Primary file:

- `tests/e2e/browser-integration.spec.ts`

Method:

1. Replace WebGL-only vacuum detection with a composed visibility probe that
   recognizes either a valid WebGL layer or visible DOM fallback.
2. Preserve the one-frame no-blank product requirement.
3. Assert reduced-motion camera stability independently from internal
   dominance timing.
4. Make fast-jump coherence evaluate the final composed frame.
5. Seek actual active + dominant + current-frame visual-ready before checking
   grouped fallback hiding.
6. Trigger context loss only after the hidden-ready precondition is proven.

Exit gate: all nine Category B declarations express current product contracts,
pass deterministically, and still fail if both WebGL and fallback are absent.

### Task 3: Decide the preload-only cleanup

Options:

- keep the proven safe cold-resident state and record it as accepted internal
  behavior; or
- cache preload-only Books on reverse exit, with a state-transition test; or
- design a reversible release state if resource release is required.

Do not use terminal dispose as a shortcut unless re-registration/reactivation
semantics are explicitly redesigned.

### Task 4: Run the no-omission regression

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e:rc
```

Exit gate:

- zero lint warnings;
- zero unexplained E2E failures;
- zero omitted declarations;
- architecture invariants unchanged.

## RC-02 — Full-site visual, navigation, SEO, and accessibility validation

### Task 1: Execute the 32-cell browser matrix

Viewports:

- `1440x900`
- `1024x900`
- `800x900`
- `390x844`

Modes:

- slow forward;
- slow reverse;
- fast down;
- fast reverse;
- continuous fast up/down;
- reduced motion;
- WebGL unavailable;
- context lost/restore.

For every cell, capture machine-readable lifecycle/CameraIntent/resource
metrics and named visual evidence. A human reviewer signs the complete route.

### Task 2: Audit SEO and no-WebGL content

- inspect title, description, canonical, Open Graph, and structured data;
- validate one logical heading hierarchy;
- validate image alt text;
- prove complete semantic content without WebGL.

### Task 3: Audit navigation and accessibility

- validate anchor/section order and URL behavior;
- validate keyboard navigation, skip link, and visible focus;
- validate CTA enabled/disabled semantics;
- validate ARIA labels, semantic sections, reading order, reduced motion,
  contrast, and fallback/context states.

Exit gate: all blocking audit findings are fixed; any deferred cosmetic item
has owner, evidence, risk, and release-owner approval.

## RC-03 — Performance, production assets, and deployment readiness

### Task 1: Verify production runtime budgets

- production build succeeds;
- bundle and asset sizes are recorded;
- initial load and stable upload behavior are measured;
- texture memory, draw calls, frame submit, and owner counts remain bounded;
- one Canvas/renderer/camera/RAF is re-proven.

### Task 2: Close the production asset manifest

- identify every development asset;
- record replacement path, dimensions, compression budget, and license owner;
- run About-only art review after portrait replacement;
- run Books-only art review after cover replacement.

### Task 3: Prepare deployment readiness

Produce environment, build, rollback, and smoke-test checklists. Do not deploy
in RC-03 unless the user separately authorizes deployment.

## RC-04 — Final regression, integration, and RC build

### Task 1: Final automated verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e:rc
```

### Task 2: Final human sign-off

- inspect the complete 32-cell evidence index;
- sign Desktop, compact, narrow, and Mobile presentation;
- sign normal, reduced-motion, unavailable, and context recovery behavior;
- confirm production assets and art reviews.

### Task 3: Integrate only with explicit authority

1. Review tracked scope and ignored evidence exclusions.
2. Commit the RC branch intentionally.
3. Merge through the approved repository workflow.
4. Produce a deployable RC build.
5. Deploy only under a separate explicit instruction.

## Completion definition

Phase 4 Closure is complete only when:

- all confirmed product blockers are closed;
- tests express current product semantics without weakening safety gates;
- full E2E has zero omitted declarations;
- the 32-cell matrix and audit plans are signed;
- production assets and performance budgets are accepted;
- final integration and release build are explicitly authorized and verified.

## RC-01 completion record

- [x] Calibrate the real Desktop Media composition defect without changing
  Camera, handoff, Renderer, or global architecture.
- [x] Keep Mobile within its independent exposure contract.
- [x] Replace all nine obsolete Hero/Media assertions with current product
  semantics while retaining meaningful failure conditions.
- [x] Fix the Windows isolated-runner temporary-tsconfig path normalization.
- [x] Verify `76 discovered / 69 passed / 0 failed / 7 explicit opt-in skips /
  0 omitted`.

**Next executable plan section: RC-02.** Do not begin performance, SEO,
accessibility, deployment, or another spatial chapter as part of RC-01.
