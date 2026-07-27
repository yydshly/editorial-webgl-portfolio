# Scene System

## Current phase status

- P4-03 About Scene is implemented, verified, human-signed, and closed.
- P4-04 Books Scene product design is approved and documented.
- P4-04 Batch 1 is implemented: typed content/DOM, strict asset manifest, nine development cover files, and pure progress/motion.
- P4-04 Batch 2 runtime work has not started.
- P4-04 authority:
  - `docs/superpowers/specs/2026-07-27-p4-04-books-scene-design.md`
  - `docs/superpowers/plans/2026-07-27-p4-04-books-scene-implementation-plan.md`

Formal About portrait replacement still requires an About-only art review. That review does not reopen P4-03 and does not block P4-04.

## Current implemented Scene contract

Scene modules use the repository's composition interface:

```ts
interface SceneModule<TSnapshot> {
  readonly identity: SceneIdentity;
  preload(): Promise<void> | void;
  activate(): boolean;
  update(payload: MotionFramePayload): void;
  deactivate(): boolean;
  dispose(): void;
  getSnapshot(): Readonly<TSnapshot>;
  getCameraIntent?(): Readonly<CameraIntent> | null;
}
```

`SceneDirector` is the only lifecycle and CameraIntent aggregation entry point:

- `register`
- `preload`
- `activate`
- `deactivate`
- `cache`
- `dispose`
- `disposeAll`

`SceneRegistry` records the implemented flags:

- `resident`
- `visible`
- `updating`
- `dominant`
- `cached`
- `disposed`

`activate("replace")` demotes the previous dominant Scene. `activate("overlap")` permits two visible/updating Scenes while retaining at most one dominant Scene. Lifecycle operations retain rollback behavior.

## Implemented Scene instances

### HeroScene

- Implemented and active as the first Scene baseline.
- Uses the shared Motion Runtime, DOM anchor, global camera, renderer boundary, and resource systems.

### MediaScene

- Implemented and closed through P4-02.
- Uses the existing `media` anchor and scene-level Three.js renderer adapter.
- Hero/Media overlap, visual-ready camera handoff, reverse, fast-scroll, reduced-motion, fallback, and owner behavior are retained as regression gates.

### AboutScene

- Implemented and closed through P4-03.
- Registered as `SceneModule<AboutSceneState>` with one portrait plane.
- Supplies a stable CameraIntent with FOV `48`; `CameraRig` remains the only camera owner.
- Uses one development portrait source at a time, one portrait Texture, one PlaneGeometry, one MeshBasicMaterial, and one Mesh.
- Uses `AboutChapterProgress`, `AboutSceneMotion`, and the measured `about-portrait` anchor. The sticky anchor is refreshed only in the existing `MEASURE` phase.
- Fallback hides only in `ready-active`. Unavailable, loading, inactive/cached, context-lost, invalidated, and restoring states show the DOM image.
- Context restore reuses registered CPU data and reacquires GPU leases before fallback pixels hide.
- Desktop/Mobile, forward/reverse/fast-scroll, reduced-motion, fallback/context restore, and final human visual review have passed.

## Current implemented orchestration

The implemented Director path is:

```text
Hero dominant
  → Media preload/overlap/replace
  → Media cache
  → Manifesto DOM-only + global-idle
  → About preload
  → About replace/dominant
  → About cache after exit
```

Manifesto does not register a `SceneModule`. Media and About cannot overlap or hand off directly across Manifesto. Reverse and large scroll deltas resolve one coherent lifecycle state before camera arbitration and render submission.

After About exits, the current Director continues to expose the global-idle posture. P4-04 will formalize that DOM-only interval across News and Quote before Books.

## Resource ownership

- `AssetRegistry<HTMLImageElement>` owns CPU descriptors, load state, data, and CPU owner ids.
- `GPUResourceManager` owns Texture, Geometry, and Material leases and owner counts.
- Scene cache retains recoverable resources.
- Scene/renderer disposal releases only that Scene's owners.
- Context loss disposes GPU resources while retaining reusable CPU assets for restore.

P4-04 must preserve Hero, Media, and About owner counts.

## P4-04 approved BooksScene design

The approved design adds exactly:

- one `BooksScene`;
- one scene-level `BooksWebGLRenderer` adapter using the existing global `THREE.WebGLRenderer`;
- one dedicated measured `books-cover-stage` anchor in `BooksSection`;
- one `THREE.Scene`;
- three Cover Plane Meshes;
- three cover Textures;
- three independent `MeshBasicMaterial` instances;
- one shared PlaneGeometry unless implementation evidence proves that sharing cannot satisfy the approved composition.

The three publications are:

1. 《在场的人》 / `People in the Room` — primary.
2. 《城市之间》 / `Between the Cities` — secondary-left.
3. 《彼此听见》 / `Hearing One Another` — secondary-right.

The fictional author is `DEV-HOST-01`; the development series identity is `FIELD NOTES / 在场档案`.

All publication titles, subtitles, year, type, description, topic tags, key facts, CTA, fallback images, SEO, and accessibility meaning remain in DOM.

## P4-04 approved lifecycle

```text
About exits and caches
  → News DOM-only + global-idle
  → Quote DOM-only + global-idle
  → Books enters preload distance
  → Books CPU assets load and GPU covers prime without drawing
  → Books core requests activation
  → visual-ready gate passes
  → existing activate("replace") commits Books dominant
  → Books renders three covers
```

The activation request waits in the resident state while the three-cover renderer is not ready. DOM fallback remains visible and the existing `GLOBAL_IDLE_CAMERA_INTENT` remains authoritative. This avoids adding a partially dominant registry state.

Reverse and fast-scroll must use the same final-state policy. There is no About-to-Books Scene overlap, camera blend, or direct handoff.

## P4-04 interface status

Batch 1 implemented:

- `BookPublication`
- `BooksAssetManifest`
- `BooksChapterProgress`
- `BooksSceneMotion`

The remaining approved plan outputs do not exist yet:

- `BooksSceneState`
- `BooksScene`
- `BooksWebGLRenderer`
- `BooksCompositionSnapshot`
- `BooksFallbackVisibility`
- `QuoteBooksPolicy`
- `booksVisualReadyResolver`

The implementation plan must introduce the remaining names through focused RED → GREEN → Refactor tasks before any architecture document calls them implemented.

## Invariants

- DOM-first.
- One global Canvas.
- One global `THREE.WebGLRenderer`.
- One `CameraRig`.
- One `FrameCoordinator` RAF.
- Three.js runtime; no R3F runtime path.
- Scene update and renderer submission remain under the existing `FrameCoordinator → RenderScheduler → SceneDirector → GlobalWebGLStage` chain.
- News and Quote remain DOM-only.
- WebGL never owns necessary publication text or interaction.
