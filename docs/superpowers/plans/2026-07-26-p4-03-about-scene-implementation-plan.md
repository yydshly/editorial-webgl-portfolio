# P4-03 About Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the fictional DEV-HOST-01 About archive timeline and its single-plane, DOM-first WebGL enhancement without changing the single-canvas runtime contract.

**Architecture:** The existing typed content repository renders all biography and fallback imagery in `AboutSection`. A new `AboutScene` implements the existing `SceneModule` interface and a single `AboutWebGLRenderer` consumes its state. `SceneDirector` is extended only to orchestrate the DOM-only Manifesto interlude and the About lifecycle; `CameraRig` continues to consume one final `CameraIntent`.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Playwright, Three.js, existing Motion Runtime and WebGL Runtime.

## Global Constraints

- Preserve DOM-first content, one `GlobalWebGLStage` canvas, one Three.js renderer, one `CameraRig`, and one `FrameCoordinator` RAF.
- Do not add R3F, ShaderMaterial, VideoTexture, GLB, particles, post-processing, React per-frame state, a second camera, or a second renderer.
- Preserve the locked section order: Hero → Media → Manifesto → About → News → Quote → Books.
- Keep Manifesto DOM-only. Do not create a Manifesto Scene or direct Media-to-About handoff.
- Use `AssetRegistry<HTMLImageElement>` for CPU images and `GPUResourceManager` leases for texture/geometry/material ownership.
- All biography is fictional DEV-HOST-01 content. Do not add claims about a real public person.
- Keep existing Hero/Media lifecycle, fallback, visual-ready, camera handoff, fast-scroll, and reduced-motion behaviour green.

---

## File map

| Path | Responsibility after P4-03 |
| --- | --- |
| `src/content/types.ts` | Adds the typed four-stage About timeline and About portrait metadata. |
| `src/content/repository.ts` | Supplies the fictional four-stage archive content and the DOM fallback portrait. |
| `src/components/sections/AboutSection.tsx` | Renders the complete semantic timeline and fallback portrait. |
| `src/app/globals.css` | Defines desktop archive layout and mobile portrait-first normal flow. |
| `public/assets/about/about-manifest.json` | Declares the approved About desktop/mobile asset variants and subject bounds. |
| `src/lib/webgl/about/AboutChapterProgress.ts` | Computes pure `[0,1]` chapter progress and stable stage selection. |
| `src/components/sections/AboutTimelineStageController.tsx` | Applies the pure stage presentation to existing DOM data attributes through the existing `MEASURE → ANIMATE` frame phases, without React frame state. |
| `src/lib/webgl/about/AboutScene.ts` | Implements `SceneModule<AboutSceneState>`. |
| `src/lib/webgl/about/aboutSceneConfig.ts` | Derives sources and plane/camera/motion configuration from the manifest. |
| `src/lib/webgl/about/AboutWebGLRenderer.ts` | Owns the one-mesh Three.js bundle and GPU leases. |
| `src/lib/webgl/about/AboutFallbackVisibility.ts` | Resolves low-frequency About fallback image state. |
| `src/lib/webgl/DOMTracker.ts` | Supports targeted MEASURE-phase refresh for sticky DOM anchors; Batch 2 uses it only for the About portrait anchor. |
| `src/lib/webgl/SceneDirector.ts` | Adds the focused Media → Manifesto → About policy and global idle camera intent. |
| `src/components/webgl/ExperienceRoot.tsx` | Instantiates/registers AboutScene and renderer, bridges fallback and probes. |
| `tests/e2e/*` or existing `src/**/*.test.ts` | Covers each unit and browser contract at the existing project test locations. |

## Task 1: Type and render the complete DOM archive

**Files:**
- Modify: `src/content/types.ts`
- Modify: `src/content/repository.ts`
- Modify: `src/components/sections/AboutSection.tsx`
- Modify: `src/app/globals.css`
- Test: `src/content/repository.test.ts`
- Test: `src/components/sections/AboutSection.test.tsx`

**Consumes:** existing `AboutSection` and `ImageAsset` types; ordered `SiteSection` rendering in `src/app/page.tsx`.

**Produces:** `AboutTimelineStage` with `id`, `year`, `place`, `title`, `body`, and `keyFact`; `AboutSection.timeline`; `AboutSection.portrait`; a semantic `<ol>` timeline and DOM `<img>` fallback carrying `data-about-fallback="true"`.

- [ ] **Step 1: Write failing content and render tests.** Assert `getAllSections()` sorts `hero, media, manifesto, about, news, quote, books`; assert the four exact fictional year/place/title/key-fact records exist; render About and assert all four article headings, `<ol>`, key-fact labels, and fallback image alt text are present.
- [ ] **Step 2: Run the two focused tests and verify RED.** Run `pnpm vitest run src/content/repository.test.ts src/components/sections/AboutSection.test.tsx`. Expected: failures because `AboutSection` has only paragraphs/highlights and `AboutSection` data has no timeline or portrait.
- [ ] **Step 3: Implement the smallest typed content and DOM change.** Replace the generic About paragraphs/highlights with the approved fictional four-stage data; render portrait, accessible section heading, ordered stages, and key facts. Keep all meaning in DOM text.
- [ ] **Step 4: Implement responsive archive layout.** Add desktop left portrait/right timeline styling with the thin rule, stage weights, and bounded sticky portrait; add mobile normal-flow portrait-first styling without sticky positioning or horizontal overflow.
- [ ] **Step 5: Run focused tests and browser layout check.** Re-run the two tests. Use Playwright at `1440×900` and `390×844` to assert four readable timeline items, one About fallback image, normal mobile DOM order, and zero horizontal overflow.
- [ ] **Step 6: Refactor only duplicated timeline presentation helpers.** Keep one data-to-DOM mapping; do not introduce presentation state for scroll progress.

## Task 2: Prepare the About asset package and manifest contract

**Files:**
- Create: `public/assets/about/about-portrait-master.png`
- Create: `public/assets/about/about-portrait-desktop.webp`
- Create: `public/assets/about/about-portrait-mobile.webp`
- Create: `public/assets/about/about-manifest.json`
- Create: `src/lib/webgl/about/aboutAssetManifest.ts`
- Test: `src/lib/webgl/about/aboutAssetManifest.test.ts`

**Consumes:** approved DEV-HOST-01 archive portrait source and existing responsive asset selection pattern in `src/lib/webgl/media/mediaSceneConfig.ts`.

**Produces:** `aboutAssetManifest` with `assetId`, `master`, `desktop`, `mobile`, `mobileBreakpoint`, `colorSpace`, `focalPoint`, `subjectBounds`, and `status`; `selectAboutPortraitSource(viewportWidth): string`.

- [ ] **Step 1: Write failing manifest tests.** Import the typed manifest and assert required four file paths, `sRGB`, a non-empty status, valid normalised focal point/subject bounds, and desktop/mobile selection at the manifest breakpoint.
- [ ] **Step 2: Run the focused test and verify RED.** Run `pnpm vitest run src/lib/webgl/about/aboutAssetManifest.test.ts`. Expected: module and manifest do not exist.
- [ ] **Step 3: Produce the asset package.** Derive desktop/mobile WebP files from one approved master; retain the same fictional identity. Encode the manifest with actual source dimensions, paths, normalised crop/focal points, expected subject bounds, and `development` status until production photography is supplied.
- [ ] **Step 4: Implement typed manifest parsing and selection.** Reject missing required asset records before rendering; select one source by the existing mobile breakpoint convention.
- [ ] **Step 5: Run focused manifest tests and inspect decoded dimensions.** Re-run the test and use the repository image inspection tooling to prove both WebP files decode and match manifest dimensions.
- [ ] **Step 6: Refactor manifest lookup into one source of truth.** Do not duplicate paths in `AboutScene`, `AboutWebGLRenderer`, or JSX.

## Task 3: Define pure About progress, stage, and hysteresis functions

**Files:**
- Create: `src/lib/webgl/about/AboutChapterProgress.ts`
- Create: `src/lib/webgl/about/AboutChapterProgress.test.ts`
- Create: `src/lib/webgl/about/AboutSceneMotion.ts`
- Create: `src/lib/webgl/about/AboutSceneMotion.test.ts`
- Create: `src/lib/webgl/about/aboutSceneConfig.ts`

**Consumes:** `DOMTrackerWorldSnapshot.relativeScroll`, `MotionSnapshotState.reducedMotion`, and Hero/Media pure progress test conventions.

**Produces:** `AboutChapterProgress { progress, stage, isAnchored }`; `AboutStage = "origin" | "industry" | "onCamera" | "crossCultural"`; `resolveAboutChapterProgress`; `resolveAboutStage`; `resolveAboutMotion`; `AboutTimelineStageController` that writes `data-about-stage-state` as `current`, `previous`, or `rest`.

- [ ] **Step 1: Write failing pure-function tests.** Assert `[0,.24,.49,.74,1]` nominal boundaries; forward/reverse hysteresis around `.24`, `.49`, `.74`; reduced motion always selects `origin`; a large progress jump resolves `crossCultural` immediately; motion has no rotation and all opacity/scale values stay within specification.
- [ ] **Step 2: Run tests and verify RED.** Run `pnpm vitest run src/lib/webgl/about/AboutChapterProgress.test.ts src/lib/webgl/about/AboutSceneMotion.test.ts`. Expected: files do not exist.
- [ ] **Step 3: Implement pure calculation and config.** Compute `[0,1]` from existing DOM anchor geometry; represent thresholds and `0.02` hysteresis in `aboutSceneConfig`; return one final stage for discontinuities.
- [ ] **Step 4: Implement DOM stage presentation without React frame state.** In `AboutTimelineStageController`, read the About section rect only in `MEASURE`, call the pure resolver, then write only `data-about-stage-state` in `ANIMATE`. Use the fixed reduced-motion origin presentation.
- [ ] **Step 5: Run focused tests and verify boundary determinism.** Re-run pure and component tests, including exact forward/reverse threshold values, an artificial large progress delta, and a late-scroll DOM state of `rest / rest / previous / current`.
- [ ] **Step 6: Refactor constants into `aboutSceneConfig.ts`.** Do not leave numerical stage values in `AboutScene`.

## Task 4: Add AboutScene as a lifecycle-only SceneModule

**Files:**
- Create: `src/lib/webgl/about/AboutScene.ts`
- Create: `src/lib/webgl/about/AboutScene.test.ts`
- Modify: `src/components/webgl/ExperienceRoot.tsx`

**Consumes:** `SceneModule`, `SceneIdentity`, `AssetRegistry<HTMLImageElement>`, `DOMTracker`, `MotionSnapshotStore`, and Task 2/3 outputs.

**Produces:** `ABOUT_SCENE_ID = "about-scene"`, `ABOUT_SCENE_ANCHOR_ID = "about"`, `AboutSceneState`, and a registered Scene without a renderer dependency.

- [ ] **Step 1: Write failing Scene tests.** Assert identity has id `about-scene`, anchor `about`, type `about`; preload registers/acquires one CPU image asset; activate/update produces anchor/progress/stage state; deactivate caches; dispose releases the owner; no method allocates a Canvas, camera, renderer, or RAF.
- [ ] **Step 2: Run the test and verify RED.** Run `pnpm vitest run src/lib/webgl/about/AboutScene.test.ts`. Expected: AboutScene is unavailable.
- [ ] **Step 3: Implement SceneModule lifecycle.** Mirror the existing Hero/Media dependency injection and lifecycle return values. The scene is responsible for state and asset ownership only, never registry transitions.
- [ ] **Step 4: Register the scene through SceneDirector.** In `ExperienceRoot`, create one `AboutScene`, call only `SceneDirector.register`, and dispose it through the existing cleanup path. Do not activate it from React state.
- [ ] **Step 5: Run focused Scene tests.** Assert scene/registry state remains consistent through preload, activate, deactivate, cache, and dispose.
- [ ] **Step 6: Refactor snapshot cloning.** Return immutable copies from `getSnapshot()` without per-frame React state.

## Task 5: Add the one-plane About renderer and GPU leases

**Files:**
- Create: `src/lib/webgl/about/AboutWebGLRenderer.ts`
- Create: `src/lib/webgl/about/AboutWebGLRenderer.test.ts`
- Modify: `src/components/webgl/ExperienceRoot.tsx`

**Consumes:** `AboutSceneState`, global `THREE.WebGLRenderer`, existing `CameraRig.camera`, `RenderScheduler`, and `GPUResourceManager`.

**Produces:** one About texture, one `THREE.PlaneGeometry`, one `THREE.MeshBasicMaterial`, one `THREE.Mesh`, and a resource snapshot keyed by `about-scene`.

- [ ] **Step 1: Write failing renderer tests.** Assert ready asset creates exactly one mesh; renderer uses the selected source once; texture/geometry/material leases have one About owner; update uses `resolveScenePlaneWorldLayout`; dispose releases all three lease kinds.
- [ ] **Step 2: Run the renderer test and verify RED.** Run `pnpm vitest run src/lib/webgl/about/AboutWebGLRenderer.test.ts`. Expected: renderer is absent.
- [ ] **Step 3: Implement resource acquisition.** Build the Three.js mesh through the global renderer context and use `GPUResourceManager.acquireTexture`, `acquireGeometry`, and `acquireMaterial` with stable About resource ids. Do not construct a renderer or camera.
- [ ] **Step 4: Implement projection and material updates.** Read About snapshot; anchor the one plane with `resolveScenePlaneWorldLayout`; apply stage position/scale/opacity/focal-point mapping only.
- [ ] **Step 5: Bridge renderer creation and disposal in ExperienceRoot.** Create/clear it beside existing Hero/Media renderers on WebGL ready/context loss/unmount; call `render()` only from the existing `externalRenderer` bridge.
- [ ] **Step 6: Run focused tests and resource owner regression.** Verify no duplicate asset source/texture after mobile source selection and resource counts return after dispose.

## Task 6: Add About CameraIntent without a second camera

**Files:**
- Modify: `src/lib/webgl/about/AboutScene.ts`
- Modify: `src/lib/webgl/about/aboutSceneConfig.ts`
- Modify: `src/lib/webgl/SceneDirector.test.ts`
- Test: `src/lib/webgl/about/AboutScene.test.ts`
- Test: `src/lib/webgl/CameraRig.test.ts`

**Consumes:** existing `CameraIntent`, `SceneDirector.getCameraIntent()`, and `CameraRig.setCameraIntent()`.

**Produces:** `AboutScene.getCameraIntent(): Readonly<CameraIntent> | null` with a constant FOV of `48`, bounded stage offsets, and fixed reduced-motion origin intent.

- [ ] **Step 1: Write failing intent tests.** Assert every About stage returns target/position offset/FOV/depthBias/weight; FOV remains `48`; SceneDirector selects About when dominant; CameraRig applies it without creating a second camera; reduced motion returns origin intent and uses immediate application.
- [ ] **Step 2: Run focused tests and verify RED.** Run `pnpm vitest run src/lib/webgl/about/AboutScene.test.ts src/lib/webgl/SceneDirector.test.ts src/lib/webgl/CameraRig.test.ts`. Expected: no About intent exists.
- [ ] **Step 3: Implement the intent output.** Derive target from About anchor `worldCenter`; use only the approved small offsets from config.
- [ ] **Step 4: Run focused tests and inspect a composition snapshot.** Confirm the selected scene id is `about-scene` only when the About registry state is dominant.
- [ ] **Step 5: Refactor intent creation into a pure local helper.** Keep Scene state calculation independent from CameraRig internals.

## Task 7: Orchestrate Media → Manifesto → About and global idle camera

**Files:**
- Modify: `src/lib/webgl/SceneDirector.ts`
- Modify: `src/lib/webgl/SceneDirector.test.ts`
- Modify: `src/components/webgl/ExperienceRoot.tsx`
- Test: `tests/e2e/about-scene-transition.spec.ts`

**Consumes:** current Hero/Media transition policy, `AboutSceneState`, `DOMTracker` anchor snapshots, and `SceneDirector` lifecycle methods.

**Produces:** an About-specific policy with preload distance, activation core range, cache bounds, and an explicit `global-idle` `SceneCameraIntent` for Manifesto; it does not create a Manifesto Scene.

- [ ] **Step 1: Write failing transition tests.** Assert Media caches before Manifesto; Manifesto has no registered SceneModule; About preloads only when the About dynamic screen top is within `1.5 × viewportHeight`; About activates only in its core range; Media is not an intent candidate in Manifesto or About; no direct Media/About blend; reverse restores About from cache.
- [ ] **Step 2: Run unit and browser transition tests and verify RED.** Run `pnpm vitest run src/lib/webgl/SceneDirector.test.ts` and `pnpm playwright test tests/e2e/about-scene-transition.spec.ts`. Expected: director has no About policy and browser assertions cannot find About runtime state.
- [ ] **Step 3: Implement the focused policy.** Keep the existing Hero-to-Media rules intact; add a Media/Manifesto/About resolver that uses dynamic About anchor screen coordinates, invokes Director lifecycle APIs, and resolves a stable global idle intent during Manifesto.
- [ ] **Step 4: Ensure lifecycle resolution precedes arbitration/render.** On a large scroll delta, choose the final coherent state before `getCameraIntent()` and renderer submission. Never iterate through intermediate About stages.
- [ ] **Step 5: Run focused tests and prove no intent leakage.** Assert transition snapshots show no Media dominant/selected intent after cache and no About selection after reverse returns to Manifesto.
- [ ] **Step 6: Refactor policy thresholds into an explicit config object.** Keep all About interlude numbers co-located and covered by boundary tests.

## Task 8: Implement About fallback and context-restoration contract

**Files:**
- Create: `src/lib/webgl/about/AboutFallbackVisibility.ts`
- Create: `src/lib/webgl/about/AboutFallbackVisibility.test.ts`
- Modify: `src/components/webgl/ExperienceRoot.tsx`
- Modify: `src/components/sections/AboutSection.tsx`
- Test: `tests/e2e/about-scene-fallback.spec.ts`

**Consumes:** low-frequency global WebGL availability/context state, About Scene snapshot, registry state, and DOM fallback image selector.

**Produces:** About fallback states `unavailable`, `loading`, `ready-inactive`, `ready-active`, and `context-lost`; the image pixel opacity is `0` only in `ready-active`.

- [ ] **Step 1: Write failing state and browser tests.** Assert unavailable/loading/inactive/context-lost keep fallback opacity `1`; ready-active makes only `img[data-about-fallback="true"]` transparent; timeline text and layout remain; no frame has fallback opacity `0` while About WebGL is absent.
- [ ] **Step 2: Run focused tests and verify RED.** Run `pnpm vitest run src/lib/webgl/about/AboutFallbackVisibility.test.ts` and the fallback E2E spec. Expected: About fallback state helper and selector do not exist.
- [ ] **Step 3: Implement the resolver and low-frequency DOM write.** Follow the existing media pattern without React per-frame state; update only image-pixel attributes/styles in POST/state listeners.
- [ ] **Step 4: Connect context loss/restore.** On context loss or invalidated About resource, restore fallback first; on restore, recreate leases from the existing registered asset before hiding the fallback.
- [ ] **Step 5: Run focused tests and context simulation.** Verify title, timeline, and layout survive each state and no blank portrait interval occurs.
- [ ] **Step 6: Refactor selectors into named constants.** Keep Media and About fallback selectors isolated to prevent cross-section writes.

## Task 9: Validate reverse, fast-scroll, reduced motion, and responsive composition

**Files:**
- Modify: `src/lib/webgl/about/AboutChapterProgress.test.ts`
- Modify: `src/lib/webgl/about/AboutScene.test.ts`
- Modify: `src/lib/webgl/SceneDirector.test.ts`
- Test: `tests/e2e/about-scene-visual.spec.ts`

**Consumes:** all previous tasks, existing FrameCoordinator/SceneDirector fast-scroll convergence and reduced-motion contracts.

**Produces:** desktop/mobile browser evidence and regression assertions for About-only behaviour plus Hero/Media non-regression.

- [ ] **Step 1: Write failing browser assertions.** At `1440×900` and `390×844`, assert one canvas; the About plane projects to the portrait region; active/previous stage weights match DOM data attributes; mobile has no sticky portrait/no overflow; fast forward/reverse selects final stage in at most one frame; reduced motion keeps origin pose and camera blend `0`.
- [ ] **Step 2: Run the E2E spec and verify RED.** Run `pnpm playwright test tests/e2e/about-scene-visual.spec.ts`. Expected: no About runtime probe/snapshot and no timeline stage markers.
- [ ] **Step 3: Add non-visual data attributes and probe fields required by the test.** Keep them low-frequency and declarative; do not add frame state to React.
- [ ] **Step 4: Run desktop/mobile forward, reverse, fast, and reduced-motion evidence.** Capture normal composited and canvas-only screenshots plus recordings; inspect plane bounds, active stage, selected camera intent, fallback state, and resource owners.
- [ ] **Step 5: Run Hero/Media regression tests.** Confirm the existing Media fallback, visual-ready, fast-scroll, and reduced-motion suites remain green.
- [ ] **Step 6: Refactor test helpers.** Leave one deterministic seek helper shared by About E2E tests and keep it test-only.

## Task 10: Perform final verification and phase documentation closure

**Files:**
- Modify: `docs/architecture/phase-handoff.md`
- Modify: `docs/architecture/session-handoff.md`
- Modify: `docs/architecture/scene-system.md`
- Modify: `docs/architecture/webgl-runtime.md`
- Modify: `docs/superpowers/specs/2026-07-26-p4-03-about-scene-design.md`

**Consumes:** executed implementation evidence and test outputs from Tasks 1–9.

**Produces:** accurate P4-03 implementation handoff and a recorded completion decision.

- [ ] **Step 1: Run the full automated suite.** Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm test:e2e`. Record exact pass/fail/skipped counts and existing unrelated warnings separately.
- [ ] **Step 2: Perform browser art acceptance.** Review desktop/mobile composited evidence: portrait/timeline readability, stage progression, no Manifesto leakage, reverse/fast/reduced stability, and fallback/context recovery.
- [ ] **Step 3: Update handoff only with verified facts.** Mark P4-03 complete only if every acceptance criterion in the design specification is evidenced; otherwise document the failing gate and its artifact path.
- [ ] **Step 4: Re-run documentation self-check.** Verify no plan/spec conflicts, no unimplemented feature is marked complete, and no architecture boundary changed without an ADR.

## Plan self-review

- **Spec coverage:** Tasks 1–2 cover content and assets; Tasks 3–6 cover Scene state, renderer, ownership, and CameraIntent; Tasks 7–9 cover the Manifesto interlude, fallback, context, reverse, fast-scroll, reduced-motion, desktop/mobile, and browser evidence; Task 10 performs closure.
- **Independent verification:** Every task has a focused failing test, a focused green check, and concrete output interfaces before later tasks consume it.
- **Type consistency:** `AboutScene` implements the repository's existing `SceneModule<AboutSceneState>` and returns existing `CameraIntent`; it does not invent a parallel Scene or camera interface.
- **Boundary check:** The plan retains one Canvas, one renderer, one CameraRig, and one FrameCoordinator RAF; Manifesto remains DOM-only and sits between Media and About.
