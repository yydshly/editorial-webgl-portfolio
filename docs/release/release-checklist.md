# RC-03B release checklist

## Demo RC gate

- [x] Identity is explicitly fictional: DEV-HOST-01 development archive.
- [x] Timeline is fictional; Books are concept publications.
- [x] No real purchase, ticketing, publishing, award, ISBN, or person-service flow exists.
- [x] `noindex, nofollow` remains active.
- [x] RC-03A technical build, E2E, production smoke, headers, and diagnostics gates pass.
- [x] Release owner approved the temporary public noindex Demo RC at
  `https://editorial-webgl-portfolio.vercel.app/` on 2026-07-28.

Allowed before public production approval: local development, private preview,
password-protected review links, and the explicitly approved public noindex
Vercel Demo RC above, all with the development disclaimer. Other public URLs
are not approved by default because development assets are visitor-accessible.

## Public Production gate

- [ ] Real canonical domain and `NEXT_PUBLIC_SITE_URL` supplied and approved.
- [ ] Formal Hero, Media, About, and Books assets have source and commercial-use evidence.
- [ ] Model/property releases and AI provenance records are complete where applicable.
- [ ] Production OG/social art and public brand identity are approved.
- [ ] Production art review is signed after asset replacement.
- [ ] Privacy, copyright, and fictional-development disclosures are approved.
- [ ] Host, monitoring, cache invalidation, rollback, release and emergency-offline owners are named.
- [ ] robots/index policy is re-approved for the real domain.
- [x] RC-04 final regression, merge, and temporary Demo RC deployment decision are complete.
- [ ] Each replacement visual asset has completed the documented file and
  manifest update procedure in `production-asset-inventory.md`, followed by
  the affected chapter's focused art review.

| Class | Current result |
| --- | --- |
| A - Demo RC blocker | None confirmed. |
| B - Public Production blocker | Asset rights/provenance, formal identity/OG, real domain, host operations, monitoring and rollback ownership remain unresolved. |
| C - Deferred | Optional visual polish after approved assets; does not reopen signed Scene composition. |

The Demo RC is not the Public Production release.

## RC-03B verification record

- [x] `pnpm lint`: 0 errors / 0 warnings.
- [x] `pnpm typecheck`: pass.
- [x] `pnpm test`: 52 files / 307 tests passed.
- [x] `pnpm build`: pass; static routes `/`, `/_not-found`, `/icon.svg`,
  `/robots.txt`, and `/sitemap.xml` generated.
- [x] `pnpm test:e2e:rc`: 85 discovered / 78 passed / 0 failed / 7 explicit
  opt-in skipped / 0 omitted.
- [x] Isolated production smoke: headers/diagnostics, four viewports and
  normal/reverse/fast/reduced journeys, unavailable-WebGL fallback, and
  context restore passed; browser source maps remain disabled.
- [x] Public runtime assets measure approximately 1,005,795 B; generation
  masters remain outside `public` under `assets-source/`.

The latest complete RC run is green. A separate targeted Media mobile sample
once measured `0.2790` against the existing `0.28` boundary; the complete
run passed without any composition change, so this is retained as an
observability note rather than a new RC-03B defect.

## RC-04 Demo RC decision

- [x] Demo RC technical gate passed on `feat/rc04-final-regression`.
- [x] Demo RC remains explicitly fictional, noindex/nofollow, and limited to
  local, private-preview, or password-protected distribution.
- [x] Reproducible build command: `NEXT_DIST_DIR=.tmp/rc04-build pnpm build`.
- [x] Production smoke command: `PLAYWRIGHT_PORT=3338 pnpm exec playwright
  test -c playwright.production.config.ts` against `next start`.
- [x] Rollback for the temporary public Demo RC is Vercel promotion of the
  last known-good deployment or a Git revert followed by automatic redeploy.
- [x] Demo RC metadata and checksums are generated under the ignored RC-04
  evidence directory; they contain no private source assets or logs.

### Dependency audit decision

`pnpm audit --prod --json` reports 0 critical, 3 high, and 1 moderate
transitive findings: PostCSS through Next (`GHSA-6g55-p6wh-862q`,
`GHSA-r28c-9q8g-f849`, `GHSA-qx2v-qp2m-jg93`) and optional Sharp/libvips
(`GHSA-f88m-g3jw-g9cj`). The current app has no upload or attacker-controlled
image/CSS pipeline; PostCSS is build-time and browser source maps are off,
while Sharp processes only repository-controlled local images. No automatic
major upgrade was performed. This is a Public Production hardening item and
must be re-audited before launch; it does not block the controlled Demo RC.
