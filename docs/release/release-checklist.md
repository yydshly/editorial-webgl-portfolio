# RC-03B release checklist

## Demo RC gate

- [x] Identity is explicitly fictional: DEV-HOST-01 development archive.
- [x] Timeline is fictional; Books are concept publications.
- [x] No real purchase, ticketing, publishing, award, ISBN, or person-service flow exists.
- [x] `noindex, nofollow` remains active.
- [x] RC-03A technical build, E2E, production smoke, headers, and diagnostics gates pass.
- [ ] Release owner chooses local, private-preview, or password-protected preview channel.

Allowed before public production approval: local development, private preview,
and password-protected review links with the development disclaimer. A public
noindex portfolio URL is not approved by default because development assets are
still visitor-accessible.

## Public Production gate

- [ ] Real canonical domain and `NEXT_PUBLIC_SITE_URL` supplied and approved.
- [ ] Formal Hero, Media, About, and Books assets have source and commercial-use evidence.
- [ ] Model/property releases and AI provenance records are complete where applicable.
- [ ] Production OG/social art and public brand identity are approved.
- [ ] Production art review is signed after asset replacement.
- [ ] Privacy, copyright, and fictional-development disclosures are approved.
- [ ] Host, monitoring, cache invalidation, rollback, release and emergency-offline owners are named.
- [ ] robots/index policy is re-approved for the real domain.
- [ ] RC-04 final regression and explicit merge/deployment decision are complete.

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
