# Editorial WebGL Portfolio

A DOM-first editorial portfolio built with Next.js, TypeScript, and a
single-canvas Three.js runtime for responsive, scroll-driven storytelling.

The project keeps semantic content and accessible fallbacks in the DOM while
Hero, Media, About, and Books scenes share one Canvas, one WebGL renderer, one
camera, and one animation loop.

## Architecture

- DOM-first content, SEO, accessibility, and fallback layers
- one global Canvas and `THREE.WebGLRenderer`
- one camera owned by `CameraRig`
- one RAF owned by `FrameCoordinator`
- scene lifecycle and camera-intent arbitration through `SceneDirector`
- native Three.js runtime; no R3F runtime path
- responsive desktop/mobile assets and reduced-motion behavior

The current milestone is P4-04 Books Scene Batch 2. It includes the
`BooksScene` lifecycle, a three-cover renderer, responsive CPU/GPU resource
ownership, and browser evidence. Books CameraIntent, formal Quote-to-Books
orchestration, and grouped fallback/context restoration remain the next phase.

## Requirements

- Node.js 22 or later
- pnpm 11

## Commands

- `pnpm install` — install dependencies
- `pnpm dev` — start the local development server
- `pnpm lint` — run ESLint
- `pnpm typecheck` — check TypeScript
- `pnpm test` — run unit tests
- `pnpm test:e2e` — run Playwright browser tests
- `pnpm build` — create a production build

## Project notes

Architecture decisions, rendering contracts, implementation plans, and the
current phase handoff are stored under `docs/`. Packaged portrait and cover
assets are development placeholders and are not production identity assets.
