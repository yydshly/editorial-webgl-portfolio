# P4-04 Books Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the fictional `DEV-HOST-01` Books publication archive with complete semantic DOM content and one restrained three-cover WebGL Scene.

**Architecture:** The typed content repository and `BooksSection` own all publication meaning, accessibility, SEO, CTA, and three fallback covers. One `BooksScene` reads existing motion/DOM snapshots and one `BooksWebGLRenderer` reuses the global `THREE.WebGLRenderer`, shared camera, and single frame pipeline to render three cover planes. `SceneDirector` adds a focused News/Quote global-idle to Books policy and commits Books dominance only after the three-cover visual-ready gate.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Vitest, Playwright, Three.js, existing Motion Runtime, `SceneModule`, `SceneDirector`, `AssetRegistry<HTMLImageElement>`, and `GPUResourceManager`.

## Global constraints

- Preserve DOM-first content, one `GlobalWebGLStage` Canvas, one global `THREE.WebGLRenderer`, one `CameraRig`, and one `FrameCoordinator` RAF.
- Preserve the page order `Hero → Media → Manifesto → About → News → Quote → Books`.
- News and Quote remain DOM-only and do not register `SceneModule` instances.
- Do not create an About-to-Books overlap, blend, or camera handoff across News/Quote.
- Add exactly one `BooksScene`, three cover meshes, three textures, three materials, and preferably one shared `PlaneGeometry`.
- Do not add R3F, ShaderMaterial, VideoTexture, GLB, post-processing, page turning, a true 3D book model, drag, carousel, click-to-promote state, a second camera, or a second render loop.
- Keep Chinese title, English subtitle, year, type, description, topic tags, key fact, CTA, author, series labels, fallback images, and accessibility semantics in DOM.
- Keep author `DEV-HOST-01`, series `FIELD NOTES / 在场档案`, and asset status `development`.
- Do not mutate Hero, Media, or About CPU/GPU owner counts.
- Keep high-frequency values out of React state. Read DOM only in initialization, explicit refresh, or `FrameCoordinator.MEASURE`.
- Execute tasks in this order: DOM/content → manifest schema → assets → pure progress/motion → Scene/renderer → Camera/orchestration → fallback/composition → browser visual gate.
- The current directory is not a Git worktree. Verification output, not a commit, is the acceptance record for each task in this copy.

---

## File map

| Path | Responsibility after P4-04 |
| --- | --- |
| `src/content/types.ts` | Defines `BookRole`, `BookPublication`, and the exact three-item `BooksSection`. |
| `src/content/repository.ts` | Supplies the three fictional publications, author, series, cover paths, facts, tags, and CTA. |
| `src/components/sections/BooksSection.tsx` | Renders the semantic archive, three fallback covers, and dedicated cover-stage anchor. |
| `src/components/sections/BooksSection.test.tsx` | Verifies DOM content, order, semantics, fallback images, and CTA. |
| `src/app/globals.css` | Defines desktop reading/cover-stage composition and mobile normal flow. |
| `public/assets/books/books-manifest.json` | Declares the exact development series and three cover assets. |
| `public/assets/books/*-master.png` | Three `1200 × 1800` development masters. |
| `public/assets/books/*-desktop.webp` | Three `1000 × 1500` desktop derivatives. |
| `public/assets/books/*-mobile.webp` | Three `800 × 1200` mobile derivatives. |
| `src/lib/webgl/books/booksAssetManifest.ts` | Parses and validates the three-cover package. |
| `src/lib/webgl/books/booksSceneConfig.ts` | Holds Books ids, assets, cover poses, camera, and responsive constants. |
| `src/lib/webgl/books/BooksChapterProgress.ts` | Computes pure normalized Books progress. |
| `src/lib/webgl/books/BooksSceneMotion.ts` | Resolves one deterministic three-cover pose tuple. |
| `src/lib/webgl/books/BooksScene.ts` | Implements `SceneModule<BooksSceneState>` and three CPU asset leases. |
| `src/lib/webgl/books/BooksWebGLRenderer.ts` | Owns one Three.js Scene, one shared geometry, three materials, three textures, and three meshes. |
| `src/lib/webgl/books/BooksFallbackVisibility.ts` | Implements the all-or-nothing three-cover fallback contract. |
| `src/lib/webgl/SceneDirector.ts` | Adds the Quote/Books policy, activation-request gate, global-idle selection, and Books dominance. |
| `src/lib/webgl/WebGLCompositionSnapshot.ts` | Adds the three-cover Books composition snapshot. |
| `src/components/webgl/ExperienceRoot.tsx` | Registers Books, creates/disposes the renderer, bridges visual-ready/fallback/probes, and submits it through the existing renderer bridge. |
| `tests/e2e/books-dom.spec.ts` | Verifies semantic desktop/mobile DOM behavior. |
| `tests/e2e/books-scene-transition.spec.ts` | Verifies About cache, News/Quote idle, Books preload/activation/dominance, reverse, and fast-scroll. |
| `tests/e2e/books-scene-fallback.spec.ts` | Verifies unavailable/loading/inactive/context-loss/restore fallback. |
| `tests/e2e/books-scene-visual.spec.ts` | Verifies desktop/mobile cover composition and produces visual evidence. |

## Task 1: Replace the legacy Books cards with the typed publication archive

**Files:**

- Modify: `src/content/types.ts`
- Modify: `src/content/repository.ts`
- Modify: `src/content/repository.test.ts`
- Modify: `src/components/sections/BooksSection.tsx`
- Create: `src/components/sections/BooksSection.test.tsx`
- Modify: `src/app/page.test.tsx`

**Interfaces:**

- Consumes: existing `ImageAsset`, `BaseSection<"books">`, `getSectionByKind("books")`, `UIButton`, and page-level `SceneAnchor anchorId="books"`.
- Produces: `BookRole`, `BookPublication`, three-item `BooksSection.items`, `author`, `series`, nested `SceneAnchor anchorId="books-cover-stage"`, `<figure id="books-cover-stage">`, three `img[data-books-fallback="true"]`, and three complete publication articles.

### RED

- [ ] Add a content test that asserts the exact semantic order and locked values:

```ts
const books = getSectionByKind("books");
expect(books?.author).toBe("DEV-HOST-01");
expect(books?.series).toEqual({
  label: "FIELD NOTES",
  labelZh: "在场档案",
  assetStatus: "development",
});
expect(books?.items.map((item) => [item.id, item.titleZh, item.subtitleEn])).toEqual([
  ["people-in-the-room", "在场的人", "People in the Room"],
  ["between-the-cities", "城市之间", "Between the Cities"],
  ["hearing-one-another", "彼此听见", "Hearing One Another"],
]);
```

- [ ] Add a component test that requires one labelled section, one cover-stage figure, three fallback images, three articles, all metadata fields, all topic tags, three labelled key facts, and three disabled development CTA controls with no fabricated purchase routes.
- [ ] Run:

```powershell
pnpm vitest run src/content/repository.test.ts src/components/sections/BooksSection.test.tsx src/app/page.test.tsx
```

Expected RED: the legacy `BooksSection` has `title/year/blurb/type`, no series/author/cover/stable ids, and no Books component test target for the approved archive.

### GREEN

- [ ] Add the exact `BookRole` and `BookPublication` types from the design specification and make `BooksSection.items` a readonly three-item tuple.
- [ ] Replace the three real-person/television records with the exact fictional 2022/2024/2026 publication records, tags, facts, responsive cover paths, and disabled development CTA from the specification.
- [ ] Render visible `FIELD NOTES`, `在场档案`, `DEV-HOST-01`, and `development asset study` text.
- [ ] Register the measured visual target with `<SceneAnchor anchorId="books-cover-stage" sceneType="books-cover-stage" />`; keep the existing page-level `books` SceneAnchor unchanged.
- [ ] Render the cover-stage figure before the publication list, using `next/image` and the exact `data-books-fallback`, `data-books-fallback-state="unavailable"`, and `data-book-id` attributes.
- [ ] Render the three publication records in an `<ol>`; use `<time dateTime>`, headings, a tag `<ul>`, a visible `Key fact` label, and `UIButton`.
- [ ] Re-run the focused command and require all tests to pass.

### REFACTOR

- [ ] Keep one `section.items.map()` for publication records and one `section.items.map()` for fallback covers; do not duplicate book copy in JSX.
- [ ] Keep the outer `section#books` free of visual transforms and retain the existing internal `.section-motion-visual` wrapper.
- [ ] Re-run the same focused command after cleanup.

## Task 2: Define and validate the Books manifest schema

**Files:**

- Create: `src/lib/webgl/books/booksAssetManifest.ts`
- Create: `src/lib/webgl/books/booksAssetManifest.test.ts`

**Interfaces:**

- Consumes: plain unknown JSON values.
- Produces: `BooksAssetStatus`, `BooksAssetAvailability`, `BooksCoverRole`, `BooksCoverAsset`, `BooksAssetManifest`, and `parseBooksAssetManifest(value: unknown): BooksAssetManifest`.

### RED

- [ ] Add tests using an in-memory valid fixture and assert exact author, series labels, titles/subtitles, three roles, visual subjects, unique ids, master semantic ids, `/assets/books/` path confinement, positive source/variant dimensions, legal desktop/mobile crops, focal points within their crops, expected cover bounds, one 2:3 ratio, and sRGB.
- [ ] Add rejection tests for duplicate roles, duplicate ids, a fourth cover, path traversal, zero dimensions, non-2:3 dimensions, invalid crop/focal/bounds data, semantic-id drift, a non-sRGB color space, a non-development status, and author other than `DEV-HOST-01`.
- [ ] Run:

```powershell
pnpm vitest run src/lib/webgl/books/booksAssetManifest.test.ts
```

Expected RED: `booksAssetManifest.ts` does not exist.

### GREEN

- [ ] Implement the exact manifest types from the specification.
- [ ] Implement pure parsing helpers that reject non-object values, invalid strings, unsafe paths, invalid dimensions, invalid status/availability, and any tuple not containing exactly one of each role.
- [ ] Return a new immutable object with covers ordered `primary`, `secondary-left`, `secondary-right` regardless of input JSON order.
- [ ] Run the focused test and require all valid/rejection cases to pass.

### REFACTOR

- [ ] Keep Books-specific error messages prefixed `Books asset manifest`; do not extract or change the current About parser.
- [ ] Keep the parser independent from browser globals and file-system reads.
- [ ] Re-run the focused test.

## Task 3: Package the three development cover assets

**Files:**

- Create: `public/assets/books/books-manifest.json`
- Create: `public/assets/books/people-in-the-room-master.png`
- Create: `public/assets/books/people-in-the-room-desktop.webp`
- Create: `public/assets/books/people-in-the-room-mobile.webp`
- Create: `public/assets/books/between-the-cities-master.png`
- Create: `public/assets/books/between-the-cities-desktop.webp`
- Create: `public/assets/books/between-the-cities-mobile.webp`
- Create: `public/assets/books/hearing-one-another-master.png`
- Create: `public/assets/books/hearing-one-another-desktop.webp`
- Create: `public/assets/books/hearing-one-another-mobile.webp`
- Modify: `src/lib/webgl/books/booksAssetManifest.ts`
- Modify: `src/lib/webgl/books/booksAssetManifest.test.ts`
- Modify: `src/content/repository.test.ts`

**Interfaces:**

- Consumes: the approved cover directions and `parseBooksAssetManifest`.
- Produces: `booksAssetManifest`, `getBooksCoverById(id)`, three decodable `1200 × 1800` development PNG masters, three `1000 × 1500` desktop WebP variants, and three `800 × 1200` mobile WebP variants.

### RED

- [ ] Add a file-backed test that imports `books-manifest.json`, parses it, resolves each public path to disk, and asserts the three files exist.
- [ ] Add a content/manifest cross-contract test:

```ts
const books = getSectionByKind("books");
expect(books?.items.map((item) => item.cover.desktop.src)).toEqual(
  booksAssetManifest.covers.map((cover) => cover.desktop.path),
);
expect(booksAssetManifest.status).toBe("development");
expect(booksAssetManifest.assetAvailability).toBe("packaged");
```

- [ ] Run:

```powershell
pnpm vitest run src/lib/webgl/books/booksAssetManifest.test.ts src/content/repository.test.ts
```

Expected RED: the JSON and cover files do not exist and the module does not export a parsed file-backed manifest.

### GREEN

- [ ] Produce the `在场的人` documentary cover with a human-led interview/public-expression image, warm-neutral paper/charcoal palette, and restrained brick-red accent.
- [ ] Produce the `城市之间` cover with a scene-led urban passage/architectural interface, blue-grey/slate/low-saturation cyan palette, and no neon treatment.
- [ ] Produce the `彼此听见` cover with a relationship-led listening scene, warm-grey/off-white/low-saturation ochre palette, and no corporate pose.
- [ ] Apply one exact cover grid: stable Chinese title, English subtitle, author, `FIELD NOTES`, `在场档案`, shared margins, shared typography, and shared spine logic.
- [ ] Export each master as sRGB PNG at `1200 × 1800`, then derive the desktop `1000 × 1500` and mobile `800 × 1200` sRGB WebP variants from that same master.
- [ ] Create the exact manifest from the design specification with `status: "development"` and `assetAvailability: "packaged"`.
- [ ] Import the JSON, export `booksAssetManifest = parseBooksAssetManifest(manifestJson)`, and implement `getBooksCoverById`.
- [ ] Run the focused tests and inspect all three decoded dimensions using the available image inspection tooling.

### REFACTOR

- [ ] Remove intermediate generation outputs from `public/assets/books`; retain only the manifest and the nine final master/desktop/mobile files.
- [ ] Confirm cover paths occur only in typed content and manifest data, not in Scene or renderer code.
- [ ] Re-run the focused tests.

## Task 4: Implement pure Books progress and three-cover motion

**Files:**

- Create: `src/lib/webgl/books/BooksChapterProgress.ts`
- Create: `src/lib/webgl/books/BooksChapterProgress.test.ts`
- Create: `src/lib/webgl/books/BooksSceneMotion.ts`
- Create: `src/lib/webgl/books/BooksSceneMotion.test.ts`
- Create: `src/lib/webgl/books/booksSceneConfig.ts`
- Create: `src/lib/webgl/books/booksSceneConfig.test.ts`

**Interfaces:**

- Consumes: viewport/anchor geometry, reduced-motion, viewport width, and the parsed cover manifest.
- Produces:

```ts
export type BooksChapterProgressInput = {
  readonly reducedMotion: boolean;
  readonly relativeScroll?: number;
  readonly viewportHeight?: number;
  readonly anchorHeight?: number;
};

export type BooksChapterProgressState = {
  readonly chapterProgress: number;
  readonly phase: "enter" | "hold" | "depart";
  readonly phaseProgress: number;
  readonly isAnchored: boolean;
};

export type BookCoverPose = {
  readonly visualRole: BooksCoverRole;
  readonly translateX: number;
  readonly translateY: number;
  readonly scale: number;
  readonly opacity: number;
  readonly depthOffsetPx: number;
};

export type BooksCoverMotion = Readonly<Record<BooksCoverRole, BookCoverPose>>;

export function resolveBooksChapterProgress(
  input: BooksChapterProgressInput,
): BooksChapterProgressState;

export function resolveBooksCoverMotion(input: {
  readonly progress: number;
  readonly reducedMotion: boolean;
  readonly viewportWidth: number;
}): BooksCoverMotion;
```

### RED

- [ ] Test progress at missing geometry, enter/hold/depart centres, the `0.30` and `0.72` phase boundaries, exit, negative input, values above one, NaN/Infinity, and reduced motion.
- [ ] Test exact desktop/mobile poses at enter/hold/depart centres.
- [ ] Test identical poses for forward and reverse calls at the same progress and direct final-pose resolution for a fast jump.
- [ ] Test no pose contains rotation, primary area and opacity are always greater than each secondary, the two secondaries do not completely overlap, and all scales remain positive.
- [ ] Run:

```powershell
pnpm vitest run src/lib/webgl/books/BooksChapterProgress.test.ts src/lib/webgl/books/BooksSceneMotion.test.ts src/lib/webgl/books/booksSceneConfig.test.ts
```

Expected RED: the Books progress, motion, and config modules do not exist.

### GREEN

- [ ] Export only the Batch 1 pure-motion configuration needed here: mobile breakpoint, enter/hold/depart boundaries (`0.30`, `0.72`), and authored desktop/mobile enter/hold/depart poses. Scene ids, texture owners, and camera values remain Batch 2 work.
- [ ] Implement progress as `max(0, viewportHeight - booksTop) / (viewportHeight + booksHeight)` through the `relativeScroll` input, clamped to `[0, 1]`.
- [ ] Implement history-free enter interpolation, stable hold, and restrained group depart interpolation; return `chapterProgress`, `phase`, and normalized `phaseProgress`.
- [ ] Make reduced motion return the final mobile or desktop pose immediately.
- [ ] Run the focused tests and require all boundary assertions to pass.

### REFACTOR

- [ ] Keep every authored number in `booksSceneConfig.ts`; the pure resolvers contain only validation, interpolation, and selection logic.
- [ ] Return new pose objects so callers cannot mutate config data.
- [ ] Re-run the focused tests.

## Task 5: Add BooksScene and three CPU asset leases

**Files:**

- Create: `src/lib/webgl/books/BooksScene.ts`
- Create: `src/lib/webgl/books/BooksScene.test.ts`
- Modify: `src/components/webgl/ExperienceRoot.tsx`

**Interfaces:**

- Consumes: current `SceneModule`, `SceneIdentity`, `AssetRegistry<HTMLImageElement>`, `DOMTracker`, `MotionSnapshotStore`, `GPUResourceManager`, manifest, progress, and config.
- Produces:

```ts
export type BooksCoverAssetState = {
  readonly id: string;
  readonly role: BooksCoverRole;
  readonly assetId: string;
  readonly assetSource: string;
  readonly assetStatus: "development" | "production";
  readonly isAssetReady: boolean;
};

export type BooksSceneState = {
  readonly isActive: boolean;
  readonly isCached: boolean;
  readonly isDisposed: boolean;
  readonly isAnchored: boolean;
  readonly reducedMotion: boolean;
  readonly progress: number;
  readonly visualReady: boolean;
  readonly anchorWidth: number;
  readonly anchorHeight: number;
  readonly anchorViewport: { readonly x: number; readonly y: number } | null;
  readonly anchorWorld: { readonly x: number; readonly y: number; readonly z: number } | null;
  readonly covers: readonly [
    BooksCoverAssetState,
    BooksCoverAssetState,
    BooksCoverAssetState,
  ];
};
```

`BooksScene` also produces `setVisualReady(ready: boolean): void`.

### RED

- [ ] Test identity `{ id: "books-scene", anchorId: "books", sceneType: "books" }` and exact metadata.
- [ ] Test preload registers, loads, and acquires exactly three CPU images under owner `books-scene`, with one deduplicated preload Promise.
- [ ] Test activate/update reads `books` and `books-cover-stage`, resolves progress, and never calls `getBoundingClientRect`.
- [ ] Test deactivate/cache snapshot semantics, `setVisualReady`, responsive state stability, and dispose releasing all three CPU owners plus Books GPU owners.
- [ ] Run:

```powershell
pnpm vitest run src/lib/webgl/books/BooksScene.test.ts
```

Expected RED: `BooksScene` does not exist.

### GREEN

- [ ] Implement `BooksScene implements SceneModule<BooksSceneState>` with the exact current interface methods.
- [ ] Register all three image descriptors in the constructor and load them in one `Promise.all` during preload.
- [ ] Acquire each ready CPU asset with owner `books-scene`; do not dispose registered data on cache.
- [ ] In update, read the section and cover-stage snapshots from `DOMTracker`, then update progress and immutable anchor/covers state.
- [ ] Instantiate one `booksGPUResourceManager` and one `BooksScene` in `ExperienceRoot`; register it through `SceneDirector` and dispose it through the existing cleanup effects. Do not preload or activate it from React.
- [ ] Run the focused test.

### REFACTOR

- [ ] Keep image loading and state cloning private to `BooksScene`; no renderer import is allowed in the Scene file.
- [ ] Keep the covers tuple in manifest order and reject partial/duplicate asset registration.
- [ ] Re-run the focused test and `pnpm typecheck`.

## Task 6: Add the one-scene three-cover renderer and probe data

**Files:**

- Create: `src/lib/webgl/books/BooksWebGLRenderer.ts`
- Create: `src/lib/webgl/books/BooksWebGLRenderer.test.ts`
- Modify: `src/lib/webgl/WebGLCompositionSnapshot.ts`
- Modify: `src/lib/webgl/WebGLPerformanceProbe.test.ts`
- Modify: `src/components/webgl/ExperienceRoot.tsx`

**Interfaces:**

- Consumes: one global `THREE.WebGLRenderer`, `CameraRig.camera`, `BooksSceneState`, `MotionSnapshotStore`, `AssetRegistry<HTMLImageElement>`, `GPUResourceManager`, `resolveScenePlaneWorldLayout`, and `resolveBooksCoverMotion`.
- Produces:

```ts
export type BooksCompositionSnapshot = {
  readonly covers: readonly [
    WebGLLayerCompositionSnapshot,
    WebGLLayerCompositionSnapshot,
    WebGLLayerCompositionSnapshot,
  ];
  readonly projections: readonly [
    WebGLAnchorProjectionSnapshot,
    WebGLAnchorProjectionSnapshot,
    WebGLAnchorProjectionSnapshot,
  ];
  readonly meshCount: 3;
  readonly geometryCount: 1;
  readonly materialCount: 3;
  readonly allTexturesReady: boolean;
  readonly allCoversRendered: boolean;
};
```

The class exposes `get isVisualReady(): boolean`, `get resourceSnapshot(): GPUResourceSnapshot`, and `get compositionSnapshot(): BooksCompositionSnapshot`.

### RED

- [ ] Test constructor acquisition of one `PlaneGeometry`, three `MeshBasicMaterial` values, and three meshes sharing the same geometry object.
- [ ] Test priming creates exactly three `THREE.Texture` leases from ready CPU data and sets `needsUpdate` only at texture construction.
- [ ] Test inactive priming never calls `renderer.render`.
- [ ] Test active render uses the three resolved poses, support meshes before primary, `FrontSide`, `depthWrite: false`, and exactly one scene submission containing three meshes.
- [ ] Test dispose releases three textures, three materials, one geometry, and leaves unrelated owner counts unchanged.
- [ ] Run:

```powershell
pnpm vitest run src/lib/webgl/books/BooksWebGLRenderer.test.ts src/lib/webgl/WebGLPerformanceProbe.test.ts
```

Expected RED: renderer and Books probe types do not exist.

### GREEN

- [ ] Implement one `THREE.Scene`, one manager-owned shared geometry, three manager-owned materials, and three meshes.
- [ ] Prime all three textures whenever CPU assets are ready, even if the Scene is inactive; keep meshes hidden and skip `renderer.render` until active/anchored.
- [ ] Use full-cover default UVs and one `resolveScenePlaneWorldLayout` call per cover with shared anchor plus role-specific pose.
- [ ] Add Books to `WebGLCompositionSnapshot`, `ExperienceRoot.getCompositionSnapshot`, `getSceneSnapshots`, and `getGPUResourceSnapshots`.
- [ ] Create/dispose `BooksWebGLRenderer` in `initRenderer`, context-loss, unmount, and restore paths; append `booksRendererRef.current?.render()` to the existing `bridgeRenderer`.
- [ ] Feed `booksRendererRef.current?.isVisualReady` into `booksScene.setVisualReady` from the low-frequency POST bridge.
- [ ] Run the focused tests and `pnpm typecheck`.

### REFACTOR

- [ ] Keep resource ids stable and role-specific; keep geometry owner `books-scene` and texture owners `books-scene:<book-id>:cover-texture`.
- [ ] Do not call renderer clear, viewport, size, DPR, or info-reset methods.
- [ ] Re-run the focused tests.

## Task 7: Add the stable Books CameraIntent

**Files:**

- Modify: `src/lib/webgl/books/BooksScene.ts`
- Modify: `src/lib/webgl/books/booksSceneConfig.ts`
- Modify: `src/lib/webgl/books/BooksScene.test.ts`
- Modify: `src/lib/webgl/CameraRig.test.ts`

**Interfaces:**

- Consumes: current `CameraIntent`, Books cover-stage `anchorWorld`, current `CameraRig.setCameraIntent`, and `BooksSceneState.visualReady`.
- Produces: `BooksScene.getCameraIntent(): Readonly<CameraIntent> | null`.

### RED

- [ ] Test null intent while inactive, cached, disposed, unanchored, or not visual-ready.
- [ ] Test the exact ready intent:

```ts
expect(intent).toEqual({
  target: anchorWorld,
  positionOffset: { x: 0, y: 0, z: 0.35 },
  fovIntent: 48,
  depthBias: -0.15,
  weight: 1,
});
```

- [ ] Test progress `0`, `0.5`, and `1` produce the same intent and reduced motion requires immediate CameraRig application without a second camera.
- [ ] Run:

```powershell
pnpm vitest run src/lib/webgl/books/BooksScene.test.ts src/lib/webgl/CameraRig.test.ts
```

Expected RED: Books has no CameraIntent.

### GREEN

- [ ] Implement `getCameraIntent()` with the exact readiness guards and constant config.
- [ ] Copy target and offset objects on every public return to preserve immutability.
- [ ] Keep all visual changes in cover poses, not camera progress.
- [ ] Run the focused tests.

### REFACTOR

- [ ] Move pure intent construction to a local helper that accepts only anchor world and Books camera config.
- [ ] Confirm `CameraRig.ts` needs no production-code modification.
- [ ] Re-run the focused tests and `pnpm typecheck`.

## Task 8: Orchestrate About → News/Quote idle → Books

**Files:**

- Modify: `src/lib/webgl/SceneDirector.ts`
- Modify: `src/lib/webgl/SceneDirector.test.ts`
- Modify: `src/components/webgl/ExperienceRoot.tsx`
- Create: `tests/e2e/books-scene-transition.spec.ts`

**Interfaces:**

- Consumes: current Director `register/preload/activate/cache`, `GLOBAL_IDLE_CAMERA_INTENT`, `DOMTracker.getSnapshot`, Books `visualReady`, and existing Manifesto/About policy.
- Produces:

```ts
export type QuoteBooksPolicy = {
  readonly quoteAnchorId: string;
  readonly booksAnchorId: string;
  readonly preloadViewportDistance: number;
  readonly activationCoreTop: number;
  readonly activationCoreBottom: number;
  readonly cacheBeforeTop: number;
  readonly cacheAfterBottom: number;
};

export const DEFAULT_QUOTE_BOOKS_POLICY: QuoteBooksPolicy;
```

`SceneDirectorInput` gains:

```ts
readonly quoteBooksPolicy?: QuoteBooksPolicy;
readonly booksVisualReadyResolver?: (
  scene: SceneModule<unknown>,
  registryState: SceneLifecycleState | null,
) => boolean;
```

### RED

- [ ] Add unit cases proving About caches after exit, News and Quote have no registered SceneModule, and `global-idle` remains selected across both anchors.
- [ ] Add boundary cases for Books preload at `1.5 × viewportHeight`, activation request at the `[0.20, 0.80]` core, waiting while visual-ready is false, dominance when it becomes true, cache on both exit directions, and cached reverse restoration.
- [ ] Add a large-delta case proving the final lifecycle is resolved before `getCameraIntent()` and no About intent appears between Quote and Books.
- [ ] Add focused browser assertions for the real `quote` and `books` DOM anchors.
- [ ] Run:

```powershell
pnpm vitest run src/lib/webgl/SceneDirector.test.ts
pnpm playwright test tests/e2e/books-scene-transition.spec.ts
```

Expected RED: no Quote/Books policy, Books lookup, readiness resolver, or browser runtime state exists.

### GREEN

- [ ] Add `QuoteBooksPolicy`, default values from the specification, `booksTransitionState.preloadInFlight`, and `booksTransitionState.activationRequested`.
- [ ] Add `getBooksScene()` by exact `sceneType === "books"` and a guarded Books visual-ready resolver.
- [ ] Run `advanceQuoteBooksTransition(payload)` after existing About lifecycle resolution and before camera arbitration.
- [ ] Start one preload when within range. At core entry, set activation requested; keep Books resident, DOM fallback visible, and camera global-idle while readiness is false.
- [ ] When readiness becomes true, call existing `activate(id, "replace")`, update the newly active Scene for the current frame, and select only the Books intent.
- [ ] On forward/reverse exit, restore fallback first through the state listener and then cache Books.
- [ ] Adjust intent arbitration so a ready dominant Books candidate wins, while waiting/inactive Books and the News/Quote interval resolve to the existing `GLOBAL_IDLE_CAMERA_INTENT`.
- [ ] Pass `booksVisualReadyResolver` from `ExperienceRoot` using `booksRendererRef.current?.isVisualReady`; composition rendering remains the stricter fallback-hiding gate after activation.
- [ ] Run the unit and browser commands.

### REFACTOR

- [ ] Keep Hero/Media and Manifesto/About threshold objects unchanged; Books thresholds live only in `DEFAULT_QUOTE_BOOKS_POLICY`.
- [ ] Keep Quote and News as anchors only and prove SceneRegistry total increases by one Books scene, not by News/Quote scenes.
- [ ] Re-run `SceneDirector.test.ts`, existing About transition E2E, and the Books transition E2E.

## Task 9: Implement all-or-nothing fallback and context restore

**Files:**

- Create: `src/lib/webgl/books/BooksFallbackVisibility.ts`
- Create: `src/lib/webgl/books/BooksFallbackVisibility.test.ts`
- Modify: `src/components/webgl/ExperienceRoot.tsx`
- Modify: `src/components/sections/BooksSection.tsx`
- Create: `tests/e2e/books-scene-fallback.spec.ts`

**Interfaces:**

- Consumes: WebGL availability/context state, `BooksSceneState`, Books registry state, and three-cover composition.
- Produces:

```ts
export type BooksFallbackContractState =
  | "unavailable"
  | "loading"
  | "ready-inactive"
  | "ready-active"
  | "context-lost";

export type BooksFallbackComposedState = {
  readonly contract: BooksFallbackContractState;
  readonly imageOpacity: 0 | 1;
  readonly imageVisible: boolean;
};

export function resolveBooksFallbackState(...): BooksFallbackComposedState;
export function setBooksFallbackImageVisibility(
  state: BooksFallbackComposedState,
): void;
```

### RED

- [ ] Unit test all five contract states plus partial CPU readiness, partial GPU readiness, two-of-three rendered, inactive, cached, and restored.
- [ ] Assert only fully active/dominant/all-three-rendered returns opacity `0`; every other input returns opacity `1` for all three images.
- [ ] Browser test context loss restores three fallback images before renderer disposal and restore keeps them visible until all three new meshes render.
- [ ] Run:

```powershell
pnpm vitest run src/lib/webgl/books/BooksFallbackVisibility.test.ts
pnpm playwright test tests/e2e/books-scene-fallback.spec.ts
```

Expected RED: the fallback resolver and Books runtime wiring do not exist.

### GREEN

- [ ] Implement selector `img[data-books-fallback='true']` and one all-or-nothing state resolver.
- [ ] Add Books WebGL state, POST synchronization, SceneRegistry listener, runtime-state handler, and context-loss ordering to `ExperienceRoot`.
- [ ] On context loss, set Books context-lost and write fallback opacity before disposing renderer resources.
- [ ] On restore, recreate the renderer from registered CPU data and hide all three fallback images only after composition proves all three rendered.
- [ ] Write `data-books-fallback-state` and pointer-event state on each image without removing it from layout or accessibility.
- [ ] Run the focused commands.

### REFACTOR

- [ ] Keep Media, About, and Books selectors isolated; do not create a generic resolver that weakens their distinct readiness rules.
- [ ] Ensure the fallback DOM write is low-frequency and not React state.
- [ ] Re-run the focused unit/E2E commands.

## Task 10: Build Desktop and Mobile Books composition

**Files:**

- Modify: `src/app/globals.css`
- Modify: `src/components/sections/BooksSection.tsx`
- Modify: `src/components/sections/BooksSection.test.tsx`
- Create: `tests/e2e/books-dom.spec.ts`
- Create: `tests/e2e/books-scene-visual.spec.ts`

**Interfaces:**

- Consumes: `books-cover-stage`, three role attributes, three publication records, fallback state, and renderer projection.
- Produces: desktop left-reading/right-sticky-stage layout and mobile heading/cover-stage/publication normal flow.

### RED

- [ ] At `1440 × 900`, assert two columns, contained sticky cover stage, visible publication text, all three fallback/projected cover bounds, zero horizontal overflow, and no footer intersection.
- [ ] At `390 × 844`, assert non-sticky cover stage before publication articles, recognisable support-cover widths, one vertical reading path, and zero horizontal overflow.
- [ ] Assert Books does not reuse About timeline attributes or active/previous/rest weighting.
- [ ] Run:

```powershell
pnpm vitest run src/components/sections/BooksSection.test.tsx
pnpm playwright test tests/e2e/books-dom.spec.ts tests/e2e/books-scene-visual.spec.ts
```

Expected RED: the legacy grid CSS and uncomposed section cannot satisfy the archive geometry assertions.

### GREEN

- [ ] Replace `.books-list` card-grid styling with `.books-archive`, `.books-reading`, `.books-cover-stage`, `.books-cover-fallbacks`, `.book-publications`, and role-specific cover layout.
- [ ] At desktop, place reading left and sticky cover stage right; contain sticky behavior within Books and preserve footer clearance.
- [ ] At mobile, reset sticky positioning and transforms, place the stage before the list, and apply the compact role offsets from config-equivalent CSS variables.
- [ ] Remove generic `.book-card` visual treatment from Books without changing Manifesto or News styles.
- [ ] Run component and browser tests at both viewports.

### REFACTOR

- [ ] Keep DOM fallback and WebGL target geometry aligned through shared role attributes and stable cover-stage dimensions, not copied scroll offsets.
- [ ] Consolidate repeated cover sizes into Books CSS custom properties; do not expose runtime progress through React.
- [ ] Re-run the focused commands and inspect screenshots.

## Task 11: Complete browser state coverage and visual evidence

**Files:**

- Modify: `tests/e2e/books-scene-transition.spec.ts`
- Modify: `tests/e2e/books-scene-fallback.spec.ts`
- Modify: `tests/e2e/books-scene-visual.spec.ts`
- Modify: `src/lib/webgl/WebGLPerformanceProbe.test.ts`
- Create during execution: `artifacts/p4-04-books-batch1/artifact-manifest.json`
- Create during execution: `artifacts/p4-04-books-batch1/*` screenshots, recordings, and runtime snapshots

**Interfaces:**

- Consumes: `window.__trevorNoahWebGLProbe`, Books Scene/GPU/composition snapshots, deterministic scroll seeks, and existing Playwright server on `127.0.0.1:3100`.
- Produces: deterministic evidence for Desktop, Mobile, forward, reverse, fast-scroll, reduced-motion, unavailable, context loss/restore, and owner stability.

### RED

- [ ] Add assertions for one Canvas, global renderer owner, three meshes, three materials, one Books geometry, three Books textures, and exactly three active Books draw calls.
- [ ] Add forward/reverse captures at progress `0`, `0.175`, `0.35`, and `1`; compare role order, screen bounds, and pose symmetry.
- [ ] Add fast jumps from Hero/Quote to Books and Books to Quote, then assert one coherent final lifecycle/intent snapshot.
- [ ] Add reduced-motion runs at both viewports and assert final hold plus immediate camera selection.
- [ ] Add CPU/GPU owner snapshots before preload, resident, dominant, cached, context restore, and dispose.
- [ ] Run:

```powershell
pnpm playwright test tests/e2e/books-scene-transition.spec.ts tests/e2e/books-scene-fallback.spec.ts tests/e2e/books-scene-visual.spec.ts
```

Expected RED: at least one evidence field or state matrix assertion is absent before the final probe/test expansion.

### GREEN

- [ ] Add only the missing non-visual probe fields required to observe Books state; do not add React frame state or production-only test branches.
- [ ] Capture normal composited and canvas-only screenshots for Desktop and Mobile at the four progress points.
- [ ] Record forward/reverse and reduced-motion hold videos, fallback/context screenshots, and JSON snapshots.
- [ ] Write `artifact-manifest.json` with viewport, port `3100`, direction, progress, reduced-motion, fallback state, context state, and file path for every artifact.
- [ ] Run the focused E2E command until Books-specific assertions pass.

### REFACTOR

- [ ] Keep deterministic seek and snapshot helpers under test code; remove duplicate per-spec scrolling logic.
- [ ] Confirm no evidence helper ships in the production bundle.
- [ ] Re-run the focused E2E command.

## Task 12: Run regression gates and close P4-04 only with evidence

**Files:**

- Modify after implementation: `docs/architecture/architecture-decisions.md`
- Modify after implementation: `docs/architecture/scene-system.md`
- Modify after implementation: `docs/architecture/webgl-runtime.md`
- Modify after implementation: `docs/architecture/phase-handoff.md`
- Modify after implementation: `docs/architecture/session-handoff.md`
- Modify after implementation: `docs/superpowers/specs/2026-07-27-p4-04-books-scene-design.md`

**Interfaces:**

- Consumes: all Task 1–11 outputs and retained artifacts.
- Produces: exact verification counts, a human visual decision, and either closed P4-04 status or one explicit failing gate.

### RED

- [ ] Before claiming closure, map every acceptance criterion in the specification to one test result or artifact path.
- [ ] Run the full gates:

```powershell
pnpm lint
pnpm typecheck
pnpm vitest run --maxWorkers=1 --no-file-parallelism
pnpm build
pnpm test:e2e
```

- [ ] Record every fail, skip, warning, and did-not-run count. Keep the registered Media desktop secondary focal/exposure baseline separate from Books regressions.

Expected RED when any Books criterion lacks evidence: P4-04 remains open and the missing criterion is named with its failing command/artifact.

### GREEN

- [ ] Fix only Books regressions found by the gates and re-run the smallest failing command before re-running the full relevant gate.
- [ ] Perform human visual review of Desktop/Mobile normal and canvas-only evidence, cover hierarchy, cover recognisability, documentary coherence, Quote separation, reduced motion, and fallback/context restore.
- [ ] Mark P4-04 closed only if every acceptance criterion has automated or retained visual evidence and the human visual review passes.
- [ ] Record formal cover replacement as a future Books-only art review that does not reopen P4-03.

### REFACTOR

- [ ] Update architecture/handoff files only with verified implementation facts and exact counts.
- [ ] Remove superseded “design approved, waiting for implementation” wording when P4-04 is actually closed.
- [ ] Re-run documentation consistency scans and `pnpm typecheck`.

## Plan self-review

- **Spec coverage:** Tasks 1–3 cover content, DOM, manifest, and assets; Task 4 covers pure progress/motion; Tasks 5–7 cover Scene, renderer, GPU ownership, probe, and CameraIntent; Tasks 8–9 cover News/Quote idle, Books lifecycle, fallback, and context restore; Tasks 10–11 cover responsive composition and browser evidence; Task 12 covers regression and closure.
- **Independent acceptance:** Every task has its own RED command, minimal GREEN output, REFACTOR pass, exact files, and explicit produced interfaces.
- **Type consistency:** `BooksScene` implements the existing `SceneModule<BooksSceneState>`; `CameraIntent`, `AssetRegistry<HTMLImageElement>`, `GPUResourceManager`, `DOMTracker`, and `SceneDirector.activate/preload/cache` retain their current signatures. `QuoteBooksPolicy`, `booksVisualReadyResolver`, Books manifest types, Scene state, renderer snapshot, and fallback types are explicitly marked as new outputs.
- **Runtime boundary:** The plan adds one scene-level `BooksWebGLRenderer` adapter but no second global `THREE.WebGLRenderer`, Canvas, camera, or RAF. News and Quote remain anchor-only DOM sections.
- **Sequence check:** The task order cannot reach Scene/renderer work before real DOM content, validated manifest data, and three actual development covers exist.
