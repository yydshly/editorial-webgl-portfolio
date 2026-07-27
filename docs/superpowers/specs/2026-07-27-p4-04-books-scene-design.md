# P4-04 Books Scene Design Specification

## 1. Product goal

P4-04 turns Books into the publication archive of the fictional `DEV-HOST-01`. It shows how character interviews, city observation, and public expression become durable authored work. Books is the outcome chapter of the personal-brand narrative: one core publication and two related publications presented as one coherent `FIELD NOTES / 在场档案` series.

Books is not a recommendation list, a single-book sales page, an ecommerce shelf, a replay of the About timeline, or a generic Works section.

The locked page order remains:

```text
Hero → Media → Manifesto → About → News → Quote → Books
```

News and Quote remain DOM-only. About must cache before the News/Quote interval. News and Quote use the explicit `global-idle` CameraIntent; there is no direct About-to-Books Scene overlap, blend, or camera handoff.

## 2. Content model

The typed content layer remains the source of all publication meaning. `BooksSection` is extended with the following exact model:

```ts
export type BookRole = "primary" | "secondary-left" | "secondary-right";

export interface DevelopmentCTA {
  readonly label: string;
  readonly status: "development";
}

export interface BookPublication {
  readonly id: string;
  readonly role: BookRole;
  readonly titleZh: string;
  readonly subtitleEn: string;
  readonly year: string;
  readonly type: string;
  readonly description: string;
  readonly topicTags: readonly string[];
  readonly keyFact: string;
  readonly cover: ImageAsset;
  readonly action: DevelopmentCTA;
}

export interface BooksSection extends BaseSection<"books"> {
  readonly tone: TextTone;
  readonly intro: string;
  readonly author: "DEV-HOST-01";
  readonly series: {
    readonly label: "FIELD NOTES";
    readonly labelZh: "在场档案";
    readonly assetStatus: "development";
  };
  readonly items: readonly [
    BookPublication,
    BookPublication,
    BookPublication,
  ];
}
```

The array order is semantic and fixed: core publication, city publication, cross-cultural publication. `role` controls composition but never changes DOM reading order. All three cover paths in content must match `books-manifest.json`.

## 3. The three publications

All content belongs to fictional author `DEV-HOST-01`.

| Order | Role | Chinese title | English subtitle | Year | Type | Description | Topic tags | Key fact | CTA |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `primary` | `在场的人` | `People in the Room` | `2022` | `Interview essays` | Long-form interviews and field notes about how individual lives take shape inside shared rooms, institutions, and public conversations. | `人物访谈`, `个体故事`, `公共表达` | Built from sustained interview notes rather than retrospective biography. | Disabled `Publication details in development` control |
| 2 | `secondary-left` | `城市之间` | `Between the Cities` | `2024` | `City essays` | Essays on movement, work, belonging, and the public spaces that connect one urban life to another. | `城市观察`, `迁移`, `公共空间` | Organised around transitional spaces instead of a city-by-city travelogue. | Disabled `Publication details in development` control |
| 3 | `secondary-right` | `彼此听见` | `Hearing One Another` | `2026` | `Conversation essays` | Dialogues on listening, translation, and the conditions that make cross-cultural public expression possible. | `倾听`, `跨文化沟通`, `公共表达` | Pairs different cultural contexts without presenting either side as explanatory authority. | Disabled `Publication details in development` control |

The publications form the approved thematic sequence:

```text
人物 → 城市 → 跨文化表达
```

This sequence describes the authored body of work. It does not repeat About's chronological life stages.

## 4. Unified cover system

The three development covers use one editorial documentary-photography system:

- one 2:3 cover grid and one shared safe-area system;
- Chinese title in a stable upper title zone;
- English subtitle immediately below or adjacent within the same title block;
- author `DEV-HOST-01` in a stable lower author zone;
- `FIELD NOTES` and `在场档案` in a shared series zone;
- one consistent spine logic, typography family, baseline grid, margin system, and paper treatment;
- independent photography and palette per publication;
- no production claim while the manifest status is `development`.

Cover-specific direction:

1. `在场的人 / People in the Room`
   - Human-led editorial documentary image.
   - DEV-HOST-01 in a relationship-rich interview or public-expression space.
   - Warm neutral, paper white, charcoal, and a small brick-red accent.
   - No microphone-led publicity shot and no stage-light spectacle.
2. `城市之间 / Between the Cities`
   - Scene-led image of a passage, street, architectural interface, or migration space.
   - Blue-grey, slate, and low-saturation cyan.
   - No cyberpunk neon, futuristic city composite, or travel-poster treatment.
3. `彼此听见 / Hearing One Another`
   - Relationship-led image of two people listening or speaking in a quiet shared environment.
   - Warm grey, off-white, and low-saturation ochre.
   - No corporate meeting stock photography or performative handshake imagery.

All cover typography visible in the bitmap is decorative duplication of the same publication identity already present in DOM. Readability and accessibility do not depend on texture text.

## 5. DOM layout

`BooksSection` remains a semantic `<section id="books">` and keeps the existing page-level `SceneAnchor` registration. It adds one measured visual anchor with the stable id `books-cover-stage`.

The DOM contains:

- section eyebrow, heading, intro, author, series labels, and asset-status disclosure;
- a `<figure id="books-cover-stage">` containing three fallback cover images in the approved main/side composition;
- a semantic ordered list of three `<article>` publication records;
- Chinese title, English subtitle, year, type, description, topic tags, labelled key fact, and CTA for every publication;
- useful `alt` text on every fallback cover;
- `data-books-fallback="true"` and `data-book-id` only for low-frequency fallback control and testing.

The cover figure is a visual preview and is `aria-labelledby` by visible series text. Publication records remain readable even if every cover image fails.

## 6. Desktop behavior

At desktop widths above the existing mobile breakpoint:

- Books is a two-column editorial archive, not a card grid.
- The left column contains the section introduction and three publication records in fixed semantic order.
- The right column contains the `books-cover-stage` composition and may be sticky only within the Books section.
- The main cover stands upright at the visual centre and in front.
- The two supporting covers sit left-rear and right-rear with small scale and position differences.
- All three titles remain recognisable; supporting covers cannot be reduced below `0.84` authored scale.
- The cover stage cannot overlap the site footer or create horizontal overflow.
- Publication metadata is never placed behind the WebGL stage.
- Quote finishes as normal DOM content before Books enters its activation range.

## 7. Mobile behavior

At and below the existing mobile breakpoint:

- The cover stage appears after the Books heading/intro and before the publication list.
- The cover stage is normal flow and never sticky.
- The three covers form a compact main-with-two-supporting stack.
- The main cover remains visually dominant; supporting covers remain identifiable and do not become thin edge slivers.
- Publication records follow in a single vertical reading path.
- No horizontal scrolling, touch dragging, carousel pagination, or click-to-promote interaction is introduced.
- DOM and WebGL use the same semantic order and the same three cover sources.

## 8. Asset specification

The development package is:

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

Each book has one `1200 × 1800` sRGB PNG master, one `1000 × 1500` desktop WebP, and one `800 × 1200` mobile WebP. All variants preserve the same 2:3 cover ratio and master semantic id; desktop and mobile are derived from the same master rather than independently generated. Typography stays inside the shared safe area so neither crop removes identity text. Batch 1 defines and validates this asset contract only; runtime variant selection and GPU integration remain outside this batch.

`books-manifest.json` contains:

```ts
type BooksAssetManifest = {
  readonly seriesId: "field-notes";
  readonly seriesLabel: "FIELD NOTES";
  readonly seriesLabelZh: "在场档案";
  readonly author: "DEV-HOST-01";
  readonly status: "development" | "production";
  readonly assetAvailability: "manifest-only" | "packaged";
  readonly colorSpace: "sRGB";
  readonly covers: readonly [
    {
      readonly id: "people-in-the-room";
      readonly role: "primary";
      readonly title: "在场的人";
      readonly subtitle: "People in the Room";
      readonly visualSubject: "person-led";
      readonly masterSemanticId: "field-notes:people-in-the-room:v1";
      readonly source: {
        readonly path: "/assets/books/people-in-the-room-master.png";
        readonly width: 1200;
        readonly height: 1800;
      };
      readonly desktop: {
        readonly path: "/assets/books/people-in-the-room-desktop.webp";
        readonly width: 1000;
        readonly height: 1500;
        readonly crop: { readonly x: 0; readonly y: 0; readonly width: 1; readonly height: 1 };
      };
      readonly mobile: {
        readonly path: "/assets/books/people-in-the-room-mobile.webp";
        readonly width: 800;
        readonly height: 1200;
        readonly crop: { readonly x: 0; readonly y: 0; readonly width: 1; readonly height: 1 };
      };
      readonly focalPoint: { readonly x: 0.5; readonly y: 0.5 };
      readonly expectedCoverBounds: { readonly x: 0; readonly y: 0; readonly width: 1; readonly height: 1 };
      readonly colorSpace: "sRGB";
    },
    {
      readonly id: "between-the-cities";
      readonly role: "secondary-left";
      readonly title: "城市之间";
      readonly subtitle: "Between the Cities";
      readonly visualSubject: "scene-led";
      readonly masterSemanticId: "field-notes:between-the-cities:v1";
      readonly source: { readonly path: "/assets/books/between-the-cities-master.png"; readonly width: 1200; readonly height: 1800 };
      readonly desktop: { readonly path: "/assets/books/between-the-cities-desktop.webp"; readonly width: 1000; readonly height: 1500; readonly crop: { readonly x: 0; readonly y: 0; readonly width: 1; readonly height: 1 } };
      readonly mobile: { readonly path: "/assets/books/between-the-cities-mobile.webp"; readonly width: 800; readonly height: 1200; readonly crop: { readonly x: 0; readonly y: 0; readonly width: 1; readonly height: 1 } };
      readonly focalPoint: { readonly x: 0.5; readonly y: 0.5 };
      readonly expectedCoverBounds: { readonly x: 0; readonly y: 0; readonly width: 1; readonly height: 1 };
      readonly colorSpace: "sRGB";
    },
    {
      readonly id: "hearing-one-another";
      readonly role: "secondary-right";
      readonly title: "彼此听见";
      readonly subtitle: "Hearing One Another";
      readonly visualSubject: "relationship-led";
      readonly masterSemanticId: "field-notes:hearing-one-another:v1";
      readonly source: { readonly path: "/assets/books/hearing-one-another-master.png"; readonly width: 1200; readonly height: 1800 };
      readonly desktop: { readonly path: "/assets/books/hearing-one-another-desktop.webp"; readonly width: 1000; readonly height: 1500; readonly crop: { readonly x: 0; readonly y: 0; readonly width: 1; readonly height: 1 } };
      readonly mobile: { readonly path: "/assets/books/hearing-one-another-mobile.webp"; readonly width: 800; readonly height: 1200; readonly crop: { readonly x: 0; readonly y: 0; readonly width: 1; readonly height: 1 } };
      readonly focalPoint: { readonly x: 0.5; readonly y: 0.5 };
      readonly expectedCoverBounds: { readonly x: 0; readonly y: 0; readonly width: 1; readonly height: 1 };
      readonly colorSpace: "sRGB";
    },
  ];
};
```

The P4-04 package is recorded as `status: development` and `assetAvailability: packaged`. Replacing any cover with a production asset requires a new manifest dimension check and an independent art review, but does not reopen P4-03.

## 9. BooksScene design

P4-04 adds exactly one `BooksScene` implementing the current repository interface:

```ts
identity: SceneIdentity
preload(): Promise<void> | void
activate(): boolean
update(payload: MotionFramePayload): void
deactivate(): boolean
dispose(): void
getSnapshot(): Readonly<BooksSceneState>
getCameraIntent?(): Readonly<CameraIntent> | null
```

`BooksScene` receives the existing `AssetRegistry<HTMLImageElement>`, `DOMTracker`, `MotionSnapshotStore`, and a Books-owned `GPUResourceManager`. It never creates a Canvas, `THREE.WebGLRenderer`, camera, RAF, React per-frame state, or DOM measurement outside the existing measurement path.

The stable identity is:

```ts
{
  id: "books-scene",
  anchorId: "books",
  sceneType: "books",
  metadata: {
    author: "DEV-HOST-01",
    series: "FIELD NOTES",
    assetStatus: "development"
  }
}
```

`BooksSceneState` records lifecycle flags, anchor geometry, normalized progress, reduced-motion state, three CPU asset states, and one low-frequency `visualReady` flag supplied through `setVisualReady(ready: boolean)`. `visualReady` is not inferred from CPU readiness alone.

## 10. Three-cover renderer

`BooksWebGLRenderer` is a scene-level adapter that reuses the one global `THREE.WebGLRenderer` and `CameraRig.camera`. It owns:

- one `THREE.Scene`;
- one shared `THREE.PlaneGeometry`;
- three `THREE.MeshBasicMaterial` instances;
- three `THREE.Mesh` instances sharing the geometry;
- three `THREE.Texture` leases, one for each cover;
- explicit support-left, support-right, and primary render order.

The two supporting meshes render before the primary mesh. All materials use `THREE.FrontSide`, `transparent: true`, and `depthWrite: false`. There is no full-screen transparent plane. The renderer does not call `clear`, `setViewport`, `setSize`, `setPixelRatio`, or `renderer.info.reset`.

The renderer may prime texture leases from ready `AssetRegistry` data while Books is resident but inactive. Priming never submits visible cover meshes. It exposes `visualReady` only when the shared geometry, all three materials, and all three GPU textures exist. It submits `renderer.render(scene, camera)` only while the Scene is active, anchored, and all three covers can render.

Texture `needsUpdate` is set once when a texture is created and never once per frame. Complete 2:3 cover images use the shared default UVs, so the renderer does not mutate shared geometry UVs for per-cover crop.

## 11. Scene lifecycle

The lifecycle is:

1. Leaving About beyond its existing cache boundary caches About.
2. News and Quote remain DOM-only and select `global-idle`.
3. When the Books anchor top is within `1.5 × viewportHeight` below the viewport, `SceneDirector.preload("books-scene")` starts once.
4. Preload registers and loads all three CPU images. The renderer may prime the three GPU textures without drawing visible meshes.
5. When the Books core intersects `[0.20 × viewportHeight, 0.80 × viewportHeight]`, the Director records an activation request.
6. While the request is waiting for all three GPU covers, Books remains resident, the camera remains `global-idle`, and all DOM fallback covers remain visible.
7. When `visualReady` is true, `SceneDirector.activate("books-scene", "replace")` commits the existing registry transition. Books becomes the registry, camera, and visible dominant scene in one coherent update.
8. Leaving Books before or after its cache boundaries caches the Scene and restores all fallback cover pixels before WebGL disappears.
9. Reverse scrolling restores Books from cached through the same visual-ready gate, then returns to Quote with Books cached and `global-idle` selected.
10. Disposal releases the three CPU owners and all Books GPU owners without changing Hero, Media, or About owner counts.

This design uses existing `preload`, `activate`, `cache`, and `dispose` interfaces. It does not add a partially dominant registry state.

## 12. CameraIntent

`BooksScene.getCameraIntent()` returns an intent only when Books is active, not cached or disposed, anchored, and `visualReady`.

The Books camera is stable:

```ts
{
  target: booksCoverStageWorldCenter,
  positionOffset: { x: 0, y: 0, z: 0.35 },
  fovIntent: 48,
  depthBias: -0.15,
  weight: 1
}
```

Progress does not change FOV, target offset, or position offset. Cover motion carries the composition. `CameraRig` remains the only camera owner and `SceneDirector` remains the only intent selector.

## 13. Motion

`BooksChapterProgress` is a pure `[0, 1]` value computed from the Books section anchor and the current `MotionSnapshotStore`, using the same geometry convention as About:

```text
max(0, viewportHeight - booksTop) / (viewportHeight + booksHeight)
```

`BooksSceneMotion` converts progress into one tuple of three cover poses. It is history-independent so forward and reverse at the same progress resolve the same composition.

The authored final poses are:

| Role | Desktop x/y | Desktop scale | Desktop depth offset | Mobile x/y | Mobile scale | Mobile depth offset | Opacity |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `primary` | `0 / 0 px` | `1.00` | `0 px` | `0 / 0 px` | `1.00` | `0 px` | `1.00` |
| `secondary-left` | `-150 / 28 px` | `0.86` | `-14 px` | `-64 / 20 px` | `0.80` | `-10 px` | `0.96` |
| `secondary-right` | `150 / 34 px` | `0.84` | `-18 px` | `64 / 24 px` | `0.78` | `-12 px` | `0.96` |

At progress `0`, covers begin slightly lower and closer to the centre:

- primary: `y +14 px`, scale `0.98`;
- secondary-left: `x -72 px`, `y +48 px`, scale `0.78`, opacity `0.68`;
- secondary-right: `x +72 px`, `y +54 px`, scale `0.76`, opacity `0.64`.

Progress resolves into three explicit phases:

- `enter`: `[0.00, 0.30)`, with the primary establishing first and the secondary covers following through delayed cubic ease-out;
- `hold`: `[0.30, 0.72)`, using the authored final poses above;
- `depart`: `[0.72, 1.00]`, moving the trio upward as one group while applying only restrained common scale and opacity reduction.

`phaseProgress` is normalized within the active phase. Reduced motion always returns the stable hold pose. A fast jump is history-independent and resolves the requested target pose directly; it never replays skipped frames. At every progress value, the primary has greater area and opacity than either secondary, the two secondaries remain spatially distinct, and no cover reaches zero area. There is no animated rotation, flip, page turn, drag response, pointer parallax, or cover promotion.

## 14. Quote → Books orchestration

`SceneDirector` gains a focused `QuoteBooksPolicy` and `booksVisualReadyResolver`; both are planned interfaces, not current repository facts.

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
```

Default values are:

```ts
{
  quoteAnchorId: "quote",
  booksAnchorId: "books",
  preloadViewportDistance: 1.5,
  activationCoreTop: 0.2,
  activationCoreBottom: 0.8,
  cacheBeforeTop: 0.8,
  cacheAfterBottom: 0.2
}
```

The Director resolves the final About/News/Quote/Books lifecycle before camera arbitration and renderer submission. Quote does not register a `SceneModule`. Books cannot activate by overlapping About, and About cannot remain an intent candidate through News or Quote.

The existing `GLOBAL_IDLE_CAMERA_INTENT` is reused. No second idle-camera implementation is created.

## 15. Reduced motion

Reduced motion keeps the same preload, activation, cache, fallback, and resource lifecycle. It changes only presentation:

- all three covers use the final compact composition immediately;
- camera application is immediate;
- there is no entry interpolation, camera travel, or cover drift;
- DOM content and fallback images remain fully readable;
- Books still becomes visible only after the all-three-cover visual-ready gate.

## 16. Fast scroll

A large forward or reverse scroll delta resolves one final lifecycle state and one final cover pose in the same Director update:

- skipped intermediate progress values are not replayed;
- entering the Books core requests activation directly;
- if GPU covers are not ready, Books remains resident behind DOM fallback and `global-idle`;
- if covers are ready, Books activates and becomes dominant without an About or Quote intent frame;
- jumping out of Books caches it and restores fallback pixels before the WebGL meshes stop rendering.

## 17. Fallback

The DOM contains three cover images at all times. Books uses an all-or-nothing fallback contract:

- `unavailable`: all three fallback covers visible;
- `loading`: all three fallback covers visible;
- `ready-inactive`: all three fallback covers visible;
- `ready-active`: all three fallback cover pixels transparent;
- `context-lost`: all three fallback covers visible.

`ready-active` requires WebGL available, live context, Books active/visible/updating/dominant, all three CPU assets ready, all three GPU textures owned, and all three meshes rendered, visible, and in the frustum. A partially ready WebGL trio never hides one or more fallback images. Headings, metadata, CTA, layout space, and the accessibility tree never disappear.

## 18. Context restore

On context loss:

1. mark Books WebGL unavailable/context-lost;
2. restore all three DOM fallback images before renderer disposal;
3. dispose Books renderer GPU resources;
4. retain registered CPU image data and Scene cache state.

On restore:

1. reuse the new global context and the same global `THREE.WebGLRenderer` boundary;
2. recreate `BooksWebGLRenderer`;
3. reacquire one shared geometry, three materials, and three textures from registered CPU data;
4. re-evaluate the current lifecycle and progress;
5. submit all three cover meshes;
6. hide fallback pixels only after the new composition snapshot proves all three rendered.

No image-free or partial-cover interval is permitted.

## 19. Performance budget

P4-04 Books adds at most:

| Resource | Budget |
| --- | ---: |
| CPU cover assets | 3 |
| GPU textures | 3 |
| Cover meshes | 3 |
| Cover materials | 3 |
| Plane geometries | 1 shared |
| Active Books draw calls | 3 |
| New Canvas | 0 |
| New global `THREE.WebGLRenderer` | 0 |
| New camera | 0 |
| New RAF | 0 |

Additional constraints:

- no per-frame `texture.needsUpdate`;
- no transparent full-screen plane;
- no duplicate desktop/mobile texture set;
- no release, re-upload, or owner-count mutation for Hero, Media, or About resources;
- no React per-frame state;
- no DOM reads outside initialization, explicit refresh, or `FrameCoordinator.MEASURE`.

## 20. Testing

Unit and component coverage must include:

- exact content order, author, series labels, three titles/subtitles, metadata, tags, facts, CTA, and fallback images;
- manifest path safety, unique ids/roles, exact three-cover tuple, 2:3 dimensions, sRGB, and development status;
- progress clamping and deterministic forward/reverse results;
- desktop/mobile motion bounds, final hold, fast jump, and reduced-motion hold;
- Scene preload/acquire/release for all three CPU assets;
- one Scene identity and one cover-stage anchor;
- one shared geometry, three materials, three textures, and three meshes;
- stable CameraIntent and visual-ready gating;
- Quote/Books policy boundaries, About cache, global idle, activation request, dominant transition, reverse, and fast-scroll;
- fallback and context restore all-or-nothing behavior;
- unchanged Hero/Media/About CPU and GPU owner counts.

Browser coverage must run at desktop `1440 × 900` and mobile `390 × 844`:

- semantic DOM and zero horizontal overflow;
- exactly one `.webgl-canvas`;
- Quote and News have no SceneModule;
- global-idle throughout the DOM-only interval;
- three recognisable cover bounds in normal and canvas-only captures;
- main/front and supporting/rear ordering;
- forward, reverse, fast-scroll, and reduced-motion;
- WebGL unavailable and context lost/restore;
- no footer overlap;
- stable texture/GPU owner snapshots.

Evidence is stored under `artifacts/p4-04-books-batch<N>/` with an artifact manifest naming viewport, server port, state, direction, fallback mode, and runtime snapshot.

## 21. Acceptance criteria

1. Books clearly presents the fictional `DEV-HOST-01` publication archive, not a recommendation list, store, or generic Works page.
2. The three exact publications and `FIELD NOTES / 在场档案` identity are complete semantic DOM content.
3. Desktop presents one upright primary cover with two smaller offset rear covers; mobile presents a compact recognisable trio.
4. Books uses exactly one `BooksScene`, three cover meshes, three textures, three materials, and preferably one shared geometry.
5. No second Canvas, global renderer, camera, RAF, R3F path, Shader, VideoTexture, GLB, or post-processing path is added.
6. News and Quote remain DOM-only and use `global-idle`; no direct About-to-Books handoff exists.
7. Books does not become camera/visible dominant until all three covers are visual-ready.
8. Forward and reverse at the same progress produce equivalent cover poses.
9. Fast-scroll reaches one final coherent lifecycle and pose without replaying intermediate motion.
10. Reduced motion uses the final compact hold and immediate camera application.
11. Unavailable, loading, inactive, context-lost, and partially restored states retain all three DOM fallback covers.
12. Context restore recreates all Books GPU leases before fallback pixels hide.
13. Books cache/dispose does not change Hero, Media, or About owner counts.
14. Desktop and mobile have no horizontal overflow, metadata occlusion, Quote overlap, or footer overlap.

## 22. Non-goals

- A real-person bibliography or production author claim.
- Recommended reading, ecommerce, checkout, price, inventory, ratings, reviews, or buy buttons.
- A generic Works taxonomy.
- Three SceneModules, one Scene per book, or click-to-promote cover state.
- Dragging, carousel controls, cover pagination, deep-linked active books, or pointer-driven rearrangement.
- Strong perspective, animated rotation, page turning, a true 3D book model, spine geometry, GLB, or physics.
- Shader, VideoTexture, particles, post-processing, audio, or recording controls.
- A redesign of `GlobalWebGLStage`, `CameraRig`, `FrameCoordinator`, `AssetRegistry`, `GPUResourceManager`, or the Hero/Media/About lifecycle.

## 23. Risks

| Risk | Gate |
| --- | --- |
| Development cover photography may look like unrelated stock imagery | Review the three covers together against the unified grid and documentary-language checklist before renderer integration. |
| Texture typography may be soft on mobile | Validate decoded master/desktop/mobile dimensions and mobile screenshot legibility; DOM remains the authoritative text. |
| Supporting covers may become unrecognisable edge slivers | Enforce the mobile scale/offset bounds and inspect actual projected screen bounds. |
| Existing `SceneDirector` has no Quote/Books policy | Add a focused policy through boundary tests without changing Hero/Media or Manifesto/About results. |
| Current registry activation immediately assigns dominance when using `replace` | Keep Books resident while activation is requested; commit the existing activation only after renderer visual-ready, with DOM fallback visible while waiting. |
| Sequential scene-level renderer submissions can affect draw counts | Assert the global renderer owner remains `global-webgl-stage` and Books adds exactly three active draw calls. |
| Formal asset replacement changes art direction | Repeat Books art review and manifest dimension validation without reopening P4-03. |

## 24. Open items

The following are implementation gates, not unresolved product choices:

1. Generate and package the three approved development covers at the exact manifest paths and dimensions.
2. Implement and validate the `BooksAssetManifest` parser before `BooksScene` consumes any cover.
3. Add `QuoteBooksPolicy` and `booksVisualReadyResolver` to `SceneDirector`; neither interface exists in the current code.
4. Add Books composition and GPU snapshots to the existing performance probe without changing the global renderer owner.
5. Record the existing Media desktop secondary focal/exposure failure separately if it remains present; it is not a Books acceptance bypass and must not be changed within P4-04.
6. Repeat Books-only art acceptance when production cover photography replaces the development package.
