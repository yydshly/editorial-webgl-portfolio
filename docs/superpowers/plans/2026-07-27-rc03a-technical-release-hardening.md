# RC-03A Technical Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the current noindex demonstration build safe to serve from a production Node runtime without changing approved visual scenes.

**Architecture:** Keep runtime imagery in `public/assets` and move generation-only masters/source copies outside public deployment. Centralize public domain and diagnostic policy in small server-safe modules; use those modules from metadata, robots, sitemap and Next headers. Browser probes remain available only in test/development or an explicit opt-in.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Playwright, Three.js.

## Global Constraints

- Do not modify Hero, Media, About, or Books composition, Motion, Camera, or lifecycle.
- Keep Single Canvas / Renderer / Camera / RAF and DOM-first Three.js runtime.
- Keep `noindex, nofollow`; do not merge `main`, deploy, or claim asset rights.
- No wildcard CSP source; no production debug global by default.
- Do not commit `artifacts/`, `test-results/`, `playwright-report/`, `.tmp/`, or logs.

---

### Task 1: Public identity and runtime asset boundary

**Files:**
- Modify: `src/content/repository.ts`, `src/app/layout.tsx`, `public/assets/placeholders/og-image.svg`
- Move: non-runtime PNG masters and ignored source copies from `public/assets` to `assets-source/`
- Test: `tests/e2e/rc03-production-hardening.spec.ts`

- [ ] Write a failing browser test that fetches the public OG image, asserts the DEV-HOST-01 title/description semantics and asserts no public response contains `Trevor Noah`.
- [ ] Run the test and verify the existing placeholder fails.
- [ ] Replace the public OG SVG with a 1200×630 DEV-HOST-01 fictional-development image; update public metadata/alt only if needed; move only files with no source/manifest/test runtime reference.
- [ ] Run the new test and existing asset-manifest tests; record public bytes before/after.

### Task 2: Production diagnostic isolation

**Files:**
- Create: `src/lib/runtime/diagnostics.ts`, `src/lib/runtime/diagnostics.test.ts`
- Modify: `src/components/webgl/ExperienceRoot.tsx`, `src/lib/webgl/SceneDirector.ts`
- Test: `tests/e2e/rc03-production-hardening.spec.ts`

- [ ] Write failing unit tests for `shouldExposeRuntimeDiagnostics({ nodeEnv, explicitFlag })` and a browser test that production has no probe globals.
- [ ] Run those tests and verify the current production browser exposes the probe.
- [ ] Implement the smallest shared policy: development/test expose diagnostics; production only exposes them with an explicit `NEXT_PUBLIC_ENABLE_RUNTIME_DIAGNOSTICS=true` flag. Gate both global probe assignment and transition logging.
- [ ] Run unit and E2E coverage with production default and test/development behavior.

### Task 3: Domain, source-map, and security response policy

**Files:**
- Create: `src/lib/site/siteUrl.ts`, `src/lib/site/siteUrl.test.ts`
- Modify: `next.config.ts`, `src/app/layout.tsx`, `src/app/robots.ts`, `src/app/sitemap.ts`
- Test: `tests/e2e/rc03-production-hardening.spec.ts`

- [ ] Write failing tests for safe development-domain fallback, normalized `NEXT_PUBLIC_SITE_URL`, disabled browser production source maps, and required headers on `/`.
- [ ] Run the tests and verify the current hard-coded URL/header absence fails.
- [ ] Implement safe URL resolution and reuse it in metadata/robots/sitemap. Configure CSP compatible with self-hosted Next, local assets and WebGL; add nosniff, Referrer-Policy, Permissions-Policy and frame protection. Keep browser source maps disabled.
- [ ] Build, serve production, and rerun header/metadata tests.

### Task 4: Production browser smoke and RC-03A records

**Files:**
- Create: `scripts/run-rc03-production-smoke.mjs`, `tests/e2e/rc03-production-hardening.spec.ts`
- Modify: `docs/release/*.md`, handoff/spec/closure-plan documents

- [ ] Write the production smoke assertions first: four viewports; normal/reverse/fast/reduced-motion/WebGL unavailable/context restore; one Canvas; no product console error; no debug global; headers present; hash navigation works.
- [ ] Verify the smoke is red before the earlier fixes, then green after them using `next start` on an isolated port.
- [ ] Run lint, typecheck, unit, build, RC E2E and production smoke. Save evidence only under ignored `artifacts/release-candidate/rc03/`.
- [ ] Update release documents with measured bundle/public sizes, completed gates, remaining asset/legal blockers and RC-03B entry. Do not commit.
