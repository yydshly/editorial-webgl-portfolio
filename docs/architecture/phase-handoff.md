# Project Handoff

## Current phase: Release Candidate / Phase 4 Closure

P4-03 About Scene and P4-04 Books Scene are closed. P4-04 Batches 1-4 are
implemented and verified, and the final Desktop and Mobile browser evidence
has received explicit human visual sign-off. Chapter development is complete;
the project is now in site-wide Release Candidate / Phase 4 Closure. RC-00
Baseline & Debt Triage is complete; RC-01 Hero / Media E2E debt repair is the
next implementation gate.

Authority:

- Design: `docs/superpowers/specs/2026-07-27-p4-04-books-scene-design.md`
- Plan: `docs/superpowers/plans/2026-07-27-p4-04-books-scene-implementation-plan.md`
- RC authority: `docs/superpowers/specs/2026-07-27-release-candidate-phase4-closure.md`
- RC plan: `docs/superpowers/plans/2026-07-27-release-candidate-phase4-closure-plan.md`
- Architecture decisions: `docs/architecture/architecture-decisions.md`
- Scene contract: `docs/architecture/scene-system.md`
- Rendering contract: `docs/architecture/rendering-contract.md`

## Phase history

- Phase 0: MVP-01 through MVP-06.
- Phase 1: P1-01 through P1-06.
- Phase 1-Hardening: P1H-01 through P1H-06.
- Phase 2: P2-01 through P2-05.
- Phase 3: P3-00 through P3-05 Runtime Hardening.
- P4-01: Hero Visual Upgrade complete.
- P4-02: Media Composition Tuning complete and closed.
- P4-03: About Scene complete and closed.
- P4-04-00: Books Scene product design and implementation plan complete.
- P4-04 Batch 1: content, DOM, assets, manifest, progress, and motion complete.
- P4-04 Batch 2: Books Scene, renderer, CPU/GPU ownership, and base Desktop/Mobile composition complete.
- P4-04 Batch 3: CameraIntent, formal orchestration, grouped fallback, context restore, evidence, and frozen differential complete.
- P4-04 Batch 4: Desktop/Mobile composition tuning, final evidence, and human visual sign-off complete.
- P4-04 Books Scene: closed.
- RC-00: complete; 11 frozen Hero/Media failures adjudicated as two Category A
  product blockers and nine Category B test-semantics repairs.

## P4-03 About Scene closure

P4-03 is closed with:

- complete development implementation;
- Desktop and Mobile composition;
- forward and reverse behavior;
- fast-scroll convergence;
- reduced-motion hold;
- unavailable/loading/inactive fallback behavior;
- context lost/restore behavior;
- final human visual sign-off.

The retained Batch 4 evidence is in `artifacts/p4-03-about-batch4/`. The known Desktop Media secondary focal/exposure baseline remains registered as unrelated to About. It does not block P4-03 closure and must not be changed or bypassed as part of P4-04.

The About portrait package remains a development asset. A formal portrait replacement requires an About-only art review, but does not reopen P4-03 and does not block P4-04.

## Locked page and runtime boundaries

The page order remains:

```text
Hero → Media → Manifesto → About → News → Quote → Books
```

The runtime boundaries remain:

- DOM-first content, SEO, accessibility, CTA, and fallback.
- One `GlobalWebGLStage` Canvas.
- One global `THREE.WebGLRenderer`.
- One `CameraRig`.
- One `FrameCoordinator` RAF.
- `SceneDirector` as the only lifecycle and CameraIntent aggregator.
- Three.js runtime.
- No R3F runtime path.

## P4-04 approved product design

Books is the fictional `DEV-HOST-01` publication archive and personal-brand outcome chapter. It is not a recommendation list, ecommerce shelf, single-book sales page, About repetition, or generic Works section.

The development series is:

```text
FIELD NOTES
在场档案
Author: DEV-HOST-01
Status: development
```

The three publications are:

1. Core: 《在场的人》 / `People in the Room`.
2. Supporting-left: 《城市之间》 / `Between the Cities`.
3. Supporting-right: 《彼此听见》 / `Hearing One Another`.

The thematic sequence is:

```text
人物 → 城市 → 跨文化表达
```

## P4-04 approved Scene budget

The first implementation is limited to:

- one `BooksScene`;
- one scene-level three-cover renderer adapter using the existing global renderer;
- one shared `THREE.Scene`;
- three Cover Plane Meshes;
- three Textures;
- three Materials;
- one shared PlaneGeometry unless implementation evidence rejects sharing.

It does not include Shader, VideoTexture, GLB, R3F, post-processing, a true 3D book model, page turning, drag, carousel, or click-to-promote behavior.

All Chinese titles, English subtitles, year, type, description, topic tags, key facts, CTA, fallback images, SEO, and accessibility semantics remain in DOM.

## News / Quote / Books orchestration

News and Quote remain DOM-only. They do not register `SceneModule` instances.

The approved lifecycle is:

```text
About exits and caches
  → News / Quote use GLOBAL_IDLE_CAMERA_INTENT
  → Books approaches and preloads
  → Books core requests activation
  → three-cover visual-ready gate passes
  → existing activate("replace") commits Books dominant
```

There is no About-to-Books overlap, blend, or direct camera handoff across News/Quote. DOM fallback remains visible while Books assets or GPU resources are not fully ready.

## Next phase entry

The next phase is:

```text
Release Candidate / Phase 4 Closure
```

It is not a P4-05 Scene and must not introduce another spatial chapter.
RC-00 is complete. The RC-01 entry scope is:

1. fix the two confirmed Media composition product defects;
2. rewrite the nine outdated tests against composed DOM/WebGL product
   semantics without weakening visual-continuity or fallback gates;
3. decide whether to clean the proven-safe preload-only cold-resident state;
4. finish with a zero-omission full E2E run.

## P4-04 Batch 3 verified result

`BooksScene` emits its stable intent only while active, anchored,
resource-ready, and not cached/disposed. `SceneDirector` formally resolves:

```text
About dominant/cache
  -> News / Quote DOM-only global-idle
  -> Books preload
  -> activation request
  -> all-cover resource gate
  -> Books dominant
  -> forward/reverse cache and global-idle
  -> cached re-entry
```

The old Batch 2 `ExperienceRoot` lifecycle bridge is removed. The five-state
fallback is atomic across all three DOM covers, and context restore returns to
exactly three CPU owners and seven GPU leases (`3 / 1 / 3`) before fallback
pixels hide.

Desktop and Mobile screenshots cover Quote hold, first active, visual-ready,
dominant, hold, reverse Quote, fast final, reduced-motion hold, unavailable,
and restored states. Six recordings cover the full journey, fast scroll, and
reduced motion on both viewports.

Engineering result:

- lint zero errors;
- typecheck, unit, and production build pass;
- Books focused E2E `10/10`;
- About E2E `12/12`;
- complete E2E `64 discovered / 52 passed / 11 frozen failed / 1 existing
  skip`, with no new failure and unchanged failure topology.

The authoritative differential and browser artifacts are in
`artifacts/p4-04-books-batch3/`.

## P4-04 Books Scene closure

P4-04 Books Scene is closed with explicit final human visual sign-off.

Accepted behavior:

- Desktop and Mobile composition;
- one-primary/two-supporting cover hierarchy;
- normal DOM/WebGL compositing;
- forward, reverse, and fast-scroll convergence;
- reduced-motion hold behavior;
- grouped fallback behavior;
- context lost and restore behavior;
- verified CPU/GPU ownership and performance budget.

The locked runtime architecture remains unchanged:

- DOM-first content and fallback;
- one global Canvas;
- one global `THREE.WebGLRenderer`;
- one Camera owned by `CameraRig`;
- one RAF owned by `FrameCoordinator`;
- Three.js native runtime with no R3F path.

The current development covers contain minor compression detail that does not
block closure. Replacing them with production covers requires a Books-only art
review and does not otherwise reopen P4-04.

The following remain independent Release Candidate technical debt and do not
block P4-04 closure:

- the frozen 11 Hero/Media E2E failures;
- the preload-only reverse lifecycle Minor.

## RC-00 baseline and debt triage

RC-00 is complete on `feat/release-candidate-phase4` from stable commit
`9f2f103`.

Engineering baseline:

- lint started at zero errors / five warnings; the five warnings are removed
  without Runtime behavior changes;
- typecheck, unit, and production build pass;
- exhaustive E2E:
  `76 discovered / 58 passed / 11 failed / 7 skipped / 0 omitted`;
- an automated isolated-server entry now reruns declarations omitted by serial
  failure and reports a combined aggregate.

The earlier P4-04 `64 passed / 11 failed / 1 skipped` count treated six opt-in
evidence declarations as passes. RC-00 corrects them to conditional skips.
This does not change the 11-failure topology and does not reopen P4-04.

Failure adjudication:

- Category A, release-blocking product defects: two Media Desktop composition
  failures (secondary exposure/focal and hold area/exposure);
- Category B, outdated test semantics: nine failures covering internal
  dominance proxies, WebGL-only vacuum proxies, and fixed-progress fallback
  prerequisites;
- Category C: none in the canonical isolated development run;
- Category D: none among the 11.

The preload-only reverse Minor is a low-risk cold-resident state. Deterministic
tests prove no duplicate preload/owner growth, no stale CameraIntent, and
successful reactivation. It is not a current release blocker.

Authority:

- `docs/superpowers/specs/2026-07-27-release-candidate-phase4-closure.md`
- `docs/superpowers/plans/2026-07-27-release-candidate-phase4-closure-plan.md`

## RC-01 closure and RC-02 entry

RC-01 is closed. The two confirmed Media composition defects were fixed in
centralized Media motion configuration, and the nine old Hero/Media E2E checks
now assert the current composed runtime contract. Final isolated E2E is
`76 discovered / 69 passed / 0 failed / 7 explicit opt-in skips / 0 omitted`.

At Desktop `1440x900`, Main is `74168.36` px² (maximum `74200`), Secondary
exposure is `0.20777` (contract `0.18-0.24`), and its exposed asset region
contains focal x `0.28`. The Single Canvas / Renderer / Camera / RAF invariant
remains intact.

The next phase is **RC-02 Full-site visual, navigation, SEO, and accessibility
validation**. It must not create a new scene, merge `main`, or deploy.

## Superseded P4-04 Batch 1 entry (historical)

The following Batch 1 instructions are retained only as phase history and are
not the current implementation entry.

P4-04 Batch 1 starts at Task 1 of the implementation plan:

1. replace the legacy real-person/television Books records with the approved typed publication archive;
2. render the complete semantic DOM and three fallback covers;
3. validate the real page at Desktop and Mobile before moving to manifest/assets;
4. continue in strict RED → GREEN → Refactor order.

Do not start `BooksScene`, renderer, CameraIntent, or `SceneDirector` work before Tasks 1–4 have produced DOM content, a validated manifest, real development covers, and pure progress/motion functions.
