# P4-04 Books Batch 2 design contract

- Entry mode: revision-led continuation of the approved P4-04 spec and implementation plan.
- Visual ambition: immersive editorial archive, progressively enhanced by the shared WebGL runtime.
- Experience architecture: editorial flow with a DOM-first Books chapter and one measured cover-stage anchor.
- Primary journey: Quote remains DOM/global-idle, then Books presents a three-cover archive with the primary cover dominant and both supporting covers recognizable.
- Runtime invariants: one Canvas, one `THREE.WebGLRenderer`, one Camera, one RAF, native Three.js, no R3F.
- Batch 2 scope: `BooksScene`, three-cover `BooksWebGLRenderer`, CPU/GPU lease integration, probe exposure, and temporary Director-based development activation sufficient for real screenshots.
- Explicit boundary: no Books CameraIntent, no formal Quote-to-Books orchestration, no formal Books fallback/context-loss integration, and no final composition tuning.
- Required evidence: Desktop 1440x900 and Mobile 390x844, each as normal composited and canvas-only captures.
- Regression rule: Books changes must not repair or tune the frozen Hero/Media runtime baseline.

