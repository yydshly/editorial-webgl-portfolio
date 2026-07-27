# Session Handoff（Trevor Noah Style Website）

## 1. Current status

- Current phase: P4-04 Books Scene.
- Current task completed: P4-04 Batch 2 (`BooksScene`, three-cover renderer, and CPU/GPU integration).
- P4-03 About Scene: implemented, verified, human-signed, and closed.
- P4-04 product direction: approved.
- P4-04 Batch 1: content/DOM, manifest, development assets, and pure progress/motion implemented.
- P4-04 Batch 2: implemented and verified against the accepted frozen E2E baseline.
- Workspace note: this copied directory is not a Git repository, so no commit was created or claimed.

P4-04 authority:

- `docs/superpowers/specs/2026-07-27-p4-04-books-scene-design.md`
- `docs/superpowers/plans/2026-07-27-p4-04-books-scene-implementation-plan.md`

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

## 10. Next session start

Read in this order:

1. `docs/architecture/architecture-decisions.md`
2. `docs/architecture/rendering-contract.md`
3. `docs/architecture/scene-system.md`
4. `docs/architecture/webgl-runtime.md`
5. `docs/architecture/motion-runtime.md`
6. `docs/architecture/interface-contracts.md`
7. `docs/superpowers/specs/2026-07-27-p4-04-books-scene-design.md`
8. `docs/superpowers/plans/2026-07-27-p4-04-books-scene-implementation-plan.md`

Begin Batch 3 with Books CameraIntent and formal Quote → Books orchestration. Then integrate the formal grouped DOM fallback and context-restoration policy. Remove the clearly marked Batch 2 development lifecycle bridge when the formal orchestration replaces it.

Do not recreate the Batch 1/2 manifest, progress, motion, scene, renderer, or resource-owner interfaces. Do not modify Hero, Media, or About thresholds/resources to make Books tests pass, and keep frozen-runtime baselines separate from Books regressions.

## 11. P4-04 Batch 2 differential gate

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

Batch 2 satisfies this differential gate. The failure set is exactly the frozen 11-item set; all newly added Books tests and all About tests pass; repeat vacuum measurements retain the frozen 15-frame mobile / 10-frame desktop topology; and no assertion, skip policy, or frozen Hero/Media parameter was changed to produce the result.
