# Project Handoff

## Current phase: P4-04 Books Scene design and implementation planning

P4-03 About Scene is closed. P4-04 Books product design is approved, and its design specification and implementation plan are now the next-phase authority. No P4-04 business code, tests, CSS, runtime, renderer, or assets have been implemented in the P4-04-00 documentation task.

Authority:

- Design: `docs/superpowers/specs/2026-07-27-p4-04-books-scene-design.md`
- Plan: `docs/superpowers/plans/2026-07-27-p4-04-books-scene-implementation-plan.md`
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

## Next implementation entry

P4-04 Batch 1 starts at Task 1 of the implementation plan:

1. replace the legacy real-person/television Books records with the approved typed publication archive;
2. render the complete semantic DOM and three fallback covers;
3. validate the real page at Desktop and Mobile before moving to manifest/assets;
4. continue in strict RED → GREEN → Refactor order.

Do not start `BooksScene`, renderer, CameraIntent, or `SceneDirector` work before Tasks 1–4 have produced DOM content, a validated manifest, real development covers, and pure progress/motion functions.
