# Session Handoff（Trevor Noah Style Website）

## 1. Current status

- Current phase: Release Candidate / Phase 4 Closure.
- Current task completed: RC-01 Media Product Defect Repair & E2E Semantic Alignment.
- Current decision gate: RC-02 full-site visual, navigation, SEO, and accessibility validation.
- P4-03 About Scene: implemented, verified, human-signed, and closed.
- P4-04 product direction: approved.
- P4-04 Batch 1: content/DOM, manifest, development assets, and pure progress/motion implemented.
- P4-04 Batch 2: implemented and verified against the accepted frozen E2E baseline.
- P4-04 Batch 3: implemented and verified against the same frozen E2E failure set.
- P4-04 Batch 4: Desktop/Mobile composition tuning, final browser evidence, and the exhaustive frozen-baseline differential are complete.
- P4-04 Books Scene: explicit Desktop/Mobile human visual acceptance received and phase closed.
- Workspace note: RC work is isolated on `feat/release-candidate-phase4`,
  created from stable commit `9f2f103`; branch merge and deployable release
  creation remain deferred.

P4-04 authority:

- `docs/superpowers/specs/2026-07-27-p4-04-books-scene-design.md`
- `docs/superpowers/plans/2026-07-27-p4-04-books-scene-implementation-plan.md`

Release Candidate authority:

- `docs/superpowers/specs/2026-07-27-release-candidate-phase4-closure.md`
- `docs/superpowers/plans/2026-07-27-release-candidate-phase4-closure-plan.md`

This handoff supersedes earlier statements that P4-03 was waiting for implementation, final E2E verification, or human visual acceptance.

## 2. P4-03 closure record

P4-03 About Scene has completed:

- development implementation;
- Desktop and Mobile;
- forward and reverse;
- fast-scroll;
- reduced-motion;
- fallback and context restore;
- final human visual sign-off.

The current implementation uses:

- one `AboutScene`;
- one portrait Plane;
- stable CameraIntent at FOV `48`;
- one global Canvas;
- one global `THREE.WebGLRenderer`;
- one `CameraRig`;
- one `FrameCoordinator` RAF;
- formal Media → Manifesto global-idle → About orchestration;
- all-state DOM portrait fallback and GPU resource restoration.

Batch 4 evidence remains in `artifacts/p4-03-about-batch4/`. The registered Desktop Media secondary focal/exposure baseline is unrelated to About, did not block final About human acceptance, and must remain separate from Books regression work.

The About asset package is still a development portrait. A production portrait replacement requires an About-only art review, but does not reopen P4-03 and does not block P4-04.

## 3. Locked architecture

The page order is:

```text
Hero → Media → Manifesto → About → News → Quote → Books
```

The runtime contract is:

```text
DOM content/fallback
  → Motion Runtime
  → FrameCoordinator
  → RenderScheduler
  → SceneDirector
  → one GlobalWebGLStage / one global THREE.WebGLRenderer
  → scene-level Three.js renderer adapters
```

Required invariants:

- DOM-first.
- One global Canvas.
- One global `THREE.WebGLRenderer`.
- One Camera owned by `CameraRig`.
- One RAF owned by `FrameCoordinator`.
- `SceneDirector` is the only Scene lifecycle and CameraIntent aggregator.
- Three.js native runtime.
- No R3F runtime path.
- DOM fallback remains available through unavailable, loading, inactive, cached, context-lost, and restoring states.

## 4. P4-04 Batch 1 implemented interfaces

- `src/content/types.ts` defines the exact three-item Books tuple, `primary | secondary-left | secondary-right` roles, visual subjects, responsive cover paths, and a disabled development CTA contract.
- `src/content/repository.ts` contains only the approved fictional `DEV-HOST-01` / `FIELD NOTES` archive. Trevor Noah, Television, and Broadcast records are removed from Books.
- `src/components/sections/BooksSection.tsx` renders the complete semantic archive, three responsive fallback covers, visible series labelling, disabled non-link CTAs, and a measured cover-stage anchor.
- Desktop uses a left reading column and right cover stage. Mobile puts the cover stage first in normal flow, without sticky positioning, carousel behavior, or horizontal overflow.
- `src/lib/webgl/books/booksAssetManifest.ts` parses the packaged JSON into immutable role order, confines paths to `/assets/books/`, validates identity/crop/focal metadata, and enforces exact `1200 × 1800`, `1000 × 1500`, and `800 × 1200` variant dimensions.
- `src/lib/webgl/books/BooksChapterProgress.ts` exposes `resolveBooksChapterProgress(input)`, returning `chapterProgress`, `phase`, normalized `phaseProgress`, and `isAnchored`.
- `src/lib/webgl/books/BooksSceneMotion.ts` exposes `resolveBooksCoverMotion({ progress, reducedMotion, viewportWidth })`, returning one deterministic three-role pose tuple.
- Phase thresholds are enter `[0, 0.30)`, hold `[0.30, 0.72)`, and depart `[0.72, 1]`. Reduced motion resolves directly to the hold composition.
- `BOOKS_ENTER_DELAYS` and all pose endpoints live in `booksSceneConfig.ts`.
- Batch 2 now provides `BooksScene`, `BooksWebGLRenderer`, and Books CPU/GPU resource integration. Books CameraIntent, the formal Books runtime fallback/context-restoration policy, and formal Quote → Books orchestration remain deferred to Batch 3.

## 5. Locked Books product design

Books presents how fictional `DEV-HOST-01` turns interviews, city observation, and public expression into long-term publications.

Books is:

- a representative publication archive;
- the outcome chapter of the personal-brand narrative.

Books is not:

- recommended reading;
- a single-book launch or sales page;
- an ecommerce shelf;
- an About timeline replay;
- a generic Works page.

The development series is:

```text
FIELD NOTES
在场档案
DEV-HOST-01
```

The exact publications are:

1. 《在场的人》 / `People in the Room` — primary, human-led.
2. 《城市之间》 / `Between the Cities` — secondary-left, scene-led.
3. 《彼此听见》 / `Hearing One Another` — secondary-right, relationship-led.

All three use one editorial documentary-photography cover system and retain distinct subject/palette direction.

## 6. Approved Books DOM and WebGL boundary

DOM must carry:

- Chinese title;
- English subtitle;
- year;
- type;
- description;
- topic tags;
- key fact;
- CTA;
- author and series labels;
- three fallback cover images;
- SEO and accessibility semantics.

The approved first WebGL version contains:

- one `BooksScene`;
- one scene-level `BooksWebGLRenderer` adapter;
- one `THREE.Scene`;
- three Cover Plane Meshes;
- three Textures;
- three Materials;
- one shared PlaneGeometry unless measured evidence requires independent geometry.

The approved budget does not include R3F, Shader, VideoTexture, GLB, post-processing, true 3D book models, page turning, drag, carousel, or click-to-promote behavior.

## 7. News / Quote / Books lifecycle

News and Quote remain DOM-only and use the existing `GLOBAL_IDLE_CAMERA_INTENT`.

The approved policy is:

```text
About exits and caches
  → News / Quote global-idle
  → Books preload inside 1.5 × viewportHeight
  → Books core requests activation
  → renderer primes all three covers
  → visual-ready
  → existing activate("replace") commits Books dominant
```

There is no About-to-Books direct overlap, Scene handoff, or camera blend.

Waiting, unavailable, partially ready, inactive, cached, context-lost, and restoring states keep all three DOM fallback covers visible. Fallback cover pixels hide as a group only after all three WebGL covers render in the active/dominant Scene.

## 8. Packaged development assets

Batch 1 created:

```text
public/assets/books/books-manifest.json
public/assets/books/people-in-the-room-master.png
public/assets/books/people-in-the-room-desktop.webp
public/assets/books/people-in-the-room-mobile.webp
public/assets/books/between-the-cities-master.png
public/assets/books/between-the-cities-desktop.webp
public/assets/books/between-the-cities-mobile.webp
public/assets/books/hearing-one-another-master.png
public/assets/books/hearing-one-another-desktop.webp
public/assets/books/hearing-one-another-mobile.webp
```

Each book has one `1200 × 1800` sRGB PNG master, one `1000 × 1500` desktop WebP, and one `800 × 1200` mobile WebP derived from the same master semantic. All assets and the manifest remain explicitly `development`. Batch 2 selects one responsive variant per book and keeps the runtime budget at exactly three additional Books textures.

Visual and browser evidence is indexed in `artifacts/p4-04-books-batch1/README.md`.

## 9. P4-04 Batch 2 implementation and verification

`BooksScene` now:

- implements the existing `SceneModule` lifecycle with `preload`, `activate`, `update`, `cache`, `deactivate`, and `dispose`;
- owns one CPU asset lease per selected responsive cover under stable owner `books-scene`;
- deduplicates concurrent and repeated preloads;
- switches all three desktop/mobile variants while releasing the old CPU and texture owners;
- reads only measured `books` and `books-cover-stage` DOMTracker snapshots;
- resolves deterministic `BooksChapterProgress` and three-role `BooksSceneMotion`;
- keeps reduced motion at the stable hold pose and resolves fast jumps without history;
- does not emit CameraIntent and does not create a Canvas, renderer, camera, or RAF.

`BooksWebGLRenderer` now:

- injects the existing global renderer and shared camera;
- owns one private `THREE.Scene`, three Meshes, three `MeshBasicMaterial`s, three stable Textures, and one shared `PlaneGeometry`;
- submits one Books scene render, with an expected three draw calls;
- never calls global renderer ownership APIs such as `clear`, `setSize`, `setPixelRatio`, or `info.reset`;
- uploads each stable texture once rather than setting `needsUpdate` per frame;
- uses `FrontSide`, transparent materials, and `depthWrite: false`;
- releases only its own seven GPU leases on disposal.

Resource ownership and measured active budget:

- CPU: three selected cover owners, each count `1`;
- GPU: three texture owners + one geometry owner + three material owners = seven leases;
- runtime render: three textures, three meshes, three materials, one geometry, three draw calls;
- cache retains the leases; responsive switching leaves exactly three active texture owners; disposal returns Books owners to zero without changing Hero, Media, or About owners.

The Batch 2 development integration is deliberately temporary. It uses the existing SceneDirector lifecycle entry points and existing frame POST hook when the Books anchors approach the viewport. It does not add CameraIntent, does not cross News/Quote to seize the camera, and leaves the camera on `global-idle`. Batch 3 must remove this bridge when formal Quote → Books orchestration replaces it.

Browser evidence:

- Desktop primary bounds: `left 904.929`, `right 1180.633`, `top 191.683`, `bottom 605.239`.
- Mobile primary bounds: `left 111.589`, `right 278.411`, `top 296.399`, `bottom 546.632`.
- Supporting exposure: Desktop left/right `0.551945 / 0.553389`; Mobile left/right `0.353017 / 0.348934`.
- Projection deltas are effectively zero, all three responsive covers load, DOM article/heading/fallback counts are each three, and horizontal overflow is zero.
- Normal composited and Canvas-only evidence exists for Desktop `1440 × 900` and Mobile `390 × 844` in `artifacts/p4-04-books-batch2/`.

Verification:

- BooksScene RED → GREEN: `10/10`.
- Books renderer/resource tests plus performance probe: `21/21`.
- Complete unit suite: `48 files / 282 tests`.
- Books Batch 2 browser evidence: `2/2`.
- All About E2E checks: `12/12`.
- Lint has zero errors and only the five pre-existing frozen/unrelated warnings; typecheck and production build pass.
- The serial full E2E run was followed by exhaustive per-test continuation because the existing Browser Integration describe is serial and stops after its first failure.
- Aggregate post-Batch-2 E2E result: `36 passed`, `11 failed`, `1 explicitly skipped`.
- All 11 failures are the accepted frozen Hero/Media set. Two have direct pre-Batch proof; nine remain `current-baseline-without-historical-proof`.
- No Books, About, content, manifest, asset, motion, or unrelated check failed. No frozen Hero/Media/About runtime parameter or frozen threshold was changed.
- The observed failure set equals the accepted frozen 11-item set, with no new failures and no material metric regression. The authoritative differential is `artifacts/p4-04-books-batch2/post-batch-e2e-differential.json`.

## 10. P4-04 Batch 3 implementation and verification

Batch 3 is complete.

Implemented:

- `BooksScene.getCameraIntent()` with fixed FOV `48`, fixed `0.35` camera
  offset, `-0.15` depth bias, and the measured Books world anchor as target;
- formal `QuoteBooksPolicy` orchestration in `SceneDirector`;
- About dominance protection while Books is only preloading;
- News and Quote as DOM-only `global-idle` intervals;
- Books preload, activation request, all-cover resource gate, dominant commit,
  cache, reverse, cached re-entry, fast jump, and reduced-motion convergence;
- removal of the Batch 2 manual lifecycle bridge from `ExperienceRoot`;
- five-state all-or-nothing fallback for all three cover images;
- Books context loss and restore with fallback-before-disposal ordering;
- stable browser probe exposure for real E2E inspection;
- Next development-origin configuration for the canonical
  `http://127.0.0.1:3100/` evidence URL.

Readiness is intentionally split as specified by the implementation plan:
renderer resource readiness (`3 textures / 3 materials / 1 geometry`) permits
the existing atomic registry activation, while fallback hiding additionally
requires all three covers to be rendered, visible, frustum-valid, and
positive-area in the active dominant composition.

Verified resource budget after activation and context restore:

- three active CPU asset owners, each count `1`;
- three textures;
- three materials;
- one shared geometry;
- three meshes;
- seven GPU leases;
- approximately three Books draw calls.

Verification:

- lint: zero errors; five pre-existing unrelated warnings;
- typecheck: pass;
- unit: `49 files / 298 tests` after the final Director regression test;
- production build: pass;
- Books Batch 3 focused browser suite: `10/10`;
- Books recordings: `6/6`;
- About E2E: `12/12`;
- full E2E, including exhaustive continuation after the existing serial
  describe stopped at its first frozen failure:
  `64 discovered / 52 passed / 11 failed / 1 existing skip`;
- observed failures equal the exact frozen Hero/Media 11-item set;
- vacuum topology remains the frozen `15 / 10 / 15 / 10` frame counts;
- no assertion, skip rule, Hero/Media parameter, or threshold was changed.

Evidence:

- `artifacts/p4-04-books-batch3/full-e2e-differential.json`;
- 20 required Desktop/Mobile named screenshots plus context-loss evidence;
- six Desktop/Mobile WebM recordings;
- browser logs and normalized complete E2E logs in
  `artifacts/p4-04-books-batch3/`.

## 11. P4-04 Batch 4 implementation and closure

Batch 4 implementation and automated verification are complete. The user has
explicitly approved the final Desktop and Mobile browser evidence, so P4-04
Books Scene is closed.

Composition changes are deliberately limited to Books:

- the ready-active Books section and cover stage stop applying the translucent
  surface and backdrop blur that softened the shared Canvas;
- Mobile visually orders the normal-flow cover stage before the DOM reading
  archive while preserving semantic DOM order;
- Books switches to the same stage-first single-column normal flow at
  `64rem` and below; `800 x 900` and `1024 x 900` evidence proves all three
  projected covers remain inside the stage and outside the reading column;
- Mobile reserves `3rem` above the stage so the right supporting title remains
  below the sticky site header;
- only Books cover `translateX`, `translateY`, `scale`, `opacity`, and existing
  depth values were tuned;
- CameraIntent, SceneDirector, visual-ready, lifecycle, resource ownership,
  renderer, camera, RAF, Hero, Media, and About parameters were not changed by
  Batch 4.

Representative hold metrics:

- Desktop primary / left / right bounds:
  `[904.929, 1180.633, 192.683, 606.239]`,
  `[751.287, 974.275, 260.220, 594.702]`,
  `[1157.556, 1358.007, 159.123, 459.799]`;
- Desktop areas: `114018.843 / 74585.701 / 60270.859`; opacities:
  `1 / 0.92 / 0.86`; supporting exposure: `0.689015 / 0.884873`;
- Mobile primary / left / right bounds:
  `[111.589, 278.411, 112.265, 362.496]`,
  `[46.309, 171.768, 163.296, 351.483]`,
  `[255.892, 367.921, 81.486, 249.527]`;
- Mobile areas: `41743.836 / 23609.863 / 18825.585`; opacities:
  `1 / 0.9198 / 0.8597`; supporting exposure: `0.520328 / 0.798994`;
- Quote visible area and horizontal overflow are both zero on both viewports;
  Desktop CTA visible area is `7854`;
- forward/reverse maximum projected-bound deltas are approximately
  `0.000012px` Desktop and `0.001035px` Mobile.

Resource and compositing evidence remains within the locked architecture:

- one Canvas, one renderer, one camera, and one RAF;
- three Books draw calls;
- three active CPU cover owners, each count `1`;
- seven Books GPU leases: three textures, one geometry, three materials;
- ready-active fallback opacity is atomically `0 / 0 / 0`;
- unavailable and context-lost fallback opacity is atomically `1 / 1 / 1`;
- context restore returns to the same bounds and owner counts;
- normal composited and Canvas-only cover bounds are equal, and visual review
  confirms the normal page no longer darkens or blurs the covers.

Final evidence is stored under `artifacts/p4-04-books-batch4/final/`:

- 30 named Desktop/Mobile PNG state captures plus two metrics JSON files;
- 16 named WebM journeys, eight per viewport;
- a structured artifact manifest records every required named file with
  viewport, direction, progress/phase, reduced-motion, fallback, and context
  metadata, and reports `50 / 50` required named artifacts with zero missing;
- `ffprobe` confirms every Desktop recording is `1440 x 900` and every Mobile
  recording is `390 x 844`, all VP8 `yuv420p`, without letterboxing;
- manual contact-sheet review covers forward, reverse, enter/hold/depart, fast,
  reduced-motion, unavailable, context-loss, and restore paths.

Verification:

- lint: zero errors and the same five pre-existing unrelated warnings;
- typecheck: pass;
- unit: `49 files / 299 tests`;
- production build: pass;
- complete About + Books focused E2E: `45 / 45`;
- complete E2E with per-declaration continuation after the serial stop,
  corrected by RC-00 declaration accounting:
  `76 discovered / 58 passed / 11 failed / 7 conditional skips / 0 omitted`;
- the failure set exactly equals the frozen Hero/Media 11-item set;
- the visual-vacuum topology remains `15 / 10 / 15 / 10` frames;
- no assertion, threshold, skip rule, or frozen Hero/Media parameter changed.

The authoritative differential is:

```text
artifacts/p4-04-books-batch4/full-e2e-differential.json
```

System Chrome was also used for independent visual capture. Its RAF/rendering
cadence exposed three strict legacy About subpixel timing assertions, while
the project-standard Playwright Chromium passed the same About set `8 / 8`.
The final focused and full aggregates use the project-standard Chromium so
they remain comparable to the frozen baseline; no About code or threshold was
changed.

The Codex visual review found none of the ten closure blockers in the Batch 4
brief, and the final human visual review accepted the Desktop and Mobile
composition. Forward, reverse, fast-scroll, reduced-motion, grouped fallback,
and context lost/restore behavior are accepted.

The current development covers contain minor compression detail that does not
block closure. Production cover replacement requires a Books-only art review.
The frozen 11 Hero/Media E2E failures and the preload-only reverse lifecycle
Minor remain independent Release Candidate technical debt.

## 12. RC-01 start

Read in this order:

1. `docs/architecture/architecture-decisions.md`
2. `docs/architecture/rendering-contract.md`
3. `docs/architecture/scene-system.md`
4. `docs/architecture/webgl-runtime.md`
5. `docs/architecture/motion-runtime.md`
6. `docs/architecture/interface-contracts.md`
7. `docs/superpowers/specs/2026-07-27-p4-04-books-scene-design.md`
8. `docs/superpowers/plans/2026-07-27-p4-04-books-scene-implementation-plan.md`
9. `docs/superpowers/specs/2026-07-27-release-candidate-phase4-closure.md`
10. `docs/superpowers/plans/2026-07-27-release-candidate-phase4-closure-plan.md`

The next phase is:

```text
Release Candidate / Phase 4 Closure
```

Do not create or name a P4-05 Scene. Chapter development has ended. RC-00 is
complete. Start RC-01 with:

1. the two confirmed Media Desktop composition blockers;
2. the nine outdated test-semantics repairs;
3. the optional preload-only cold-resident cleanup decision;
4. a zero-omission full E2E exit run.

P4-04 remains closed during this work. A production cover replacement triggers
only a Books-specific art review unless new evidence identifies a separate
runtime regression.

## 13. P4-04 Batch 2, Batch 3, and Batch 4 differential gate

Batch 2 is explicitly authorized against the frozen 11-failure record in:

```text
artifacts/p4-04-books-batch1/frozen-e2e-baseline.json
```

The final repository-wide E2E result is accepted only when all of the following are true:

1. The observed failure set is a subset of those exact 11 accepted failures.
2. There are no new failures outside that accepted set, including Books, About, Hero, Media, shared runtime, content, or unrelated suites.
3. The frozen core metrics are not materially worse than the recorded values.
4. No test is skipped or removed from the final aggregate, no assertion is loosened, and no Hero/Media parameter is changed to manufacture a passing result.

The two failures with direct pre-Batch proof are classified as `confirmed-earlier-baseline`. The other nine are classified as `current-baseline-without-historical-proof`; they are accepted only as a frozen differential baseline for Batch 2, not represented as historically proven regressions.

Batch 2 and Batch 3 satisfy this differential gate. The Batch 3 aggregate is
`64 / 52 / 11 / 1`; its failure set is exactly the frozen 11-item set. All
newly added Books tests and all About tests pass; repeat vacuum measurements
retain the frozen 15-frame mobile / 10-frame desktop topology; and no
assertion, skip policy, or frozen Hero/Media parameter was changed to produce
the result.

Batch 4 also satisfies the failure-topology gate. RC-00 corrected its
declaration accounting to `76 / 58 / 11 / 7 / 0 omitted`: six opt-in evidence
declarations skip when capture flags are absent and were previously counted as
passes. All About and Books focused product checks pass, the failure set
remains exactly the same 11 items, and the deterministic vacuum topology
remains unchanged.

## 14. RC-00 closure record

RC-00 ran from stable commit `9f2f103` on
`feat/release-candidate-phase4`, using isolated Next output and ports without
reusing the user's preview.

Current exhaustive E2E result:

```text
76 discovered / 58 passed / 11 failed / 7 skipped / 0 omitted
```

The automated entry `pnpm test:e2e:rc` runs the entire suite, detects
expected-pass declarations skipped by serial failure, reruns their exact
declarations, and produces one combined no-omission report.

The 11 failures are adjudicated as:

- two Category A product blockers: Desktop Media secondary exposure/focal and
  Desktop Media hold area/exposure;
- nine Category B test-semantics repairs: reduced-motion dominance, four
  DOM-omitting vacuum checks, fast-jump coherence, and three invalid
  fixed-progress fallback prerequisites;
- zero Category C or D findings in the canonical run.

The preload-only reverse Minor is a proven-safe cold-resident state: no owner
growth, stale CameraIntent, or reactivation failure. It is not a current
release blocker.

The five lint warnings are removed without Runtime behavior changes. RC-01 is
authorized to repair the two product defects and nine test semantics; it is not
authorized to merge, deploy, replace production assets, or add a new Scene.

## 15. RC-01 closure record

RC-01 is closed on `feat/release-candidate-phase4`. The single Canvas,
Renderer, Camera, RAF, DOM-first, native Three.js, and no-R3F architecture is
unchanged.

- The shared product root cause was an oversized Desktop Media main hold pose.
  Its centralized hold scale is now `0.95`; the approved Mobile composition
  keeps a separate responsive multiplier.
- Final `1440x900` browser evidence records Main area `74168.36`, Secondary
  exposure `0.20777`, exposed-asset fraction `0.28652` containing focal x
  `0.28`, and no horizontal overflow. Both Category A blockers are closed.
- The nine Category B tests now verify composed DOM/WebGL subjects, legal
  `global-idle`, zero-travel reduced motion, atomic fast-jump convergence, and
  grouped ready/loading/context-loss fallback behavior.
- Final isolated E2E: `76 discovered / 69 passed / 0 failed / 7 explicit
  opt-in skips / 0 omitted`. Local ignored capture evidence is in
  `.tmp/rc01-evidence-final/`.

Next entry: **RC-02 Full-site visual, navigation, SEO, and accessibility
validation**. Do not merge or deploy in RC-02 without separate authority.
