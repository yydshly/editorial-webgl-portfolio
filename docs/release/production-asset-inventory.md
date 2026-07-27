# Production asset and licensing inventory

Status: 2026-07-27. This is the authority for RC-03B asset decisions. Missing
evidence is **unknown / not approved**; no commercial-use right is inferred.

| Asset / path | Current status and source | AI / rights / release / trademark / attribution | Demo RC | Public production | Replacement / owner / evidence |
| --- | --- | --- | --- | --- | --- |
| Hero portrait: `public/assets/hero/hero-placeholder-{desktop,mobile}.webp`; private master `assets-source/hero/` | Development placeholder; provenance unknown | AI, commercial use, model release, trademark risk, attribution: unknown / not approved | Yes, controlled only | No | Licensed portrait; release owner + art reviewer; pending license/model-release record |
| Hero foreground crop: manifest `foregroundCrop` | Development crop from Hero placeholder | Source/master rights, likeness release, attribution: unknown / not approved | Yes | No | Revalidate with approved Hero master; art reviewer; pending crop approval |
| Media stage: `public/assets/media/media-stage-{desktop,mobile}.webp` | Development placeholder; source unknown | AI, commercial use, performer/location release, trademark, attribution: unknown / not approved | Yes, controlled only | No | Licensed stage source; Media art owner; pending license/release |
| Media studio: `public/assets/media/media-studio-{desktop,mobile}.webp` | Development placeholder; source unknown | AI, commercial use, portrait/location release, trademark, attribution: unknown / not approved | Yes, controlled only | No | Licensed studio source; Media art owner; pending license/release |
| About portrait: `public/assets/about/about-portrait-{desktop,mobile}.webp`; private master `assets-source/about/` | Development portrait for fictional DEV-HOST-01 | AI/likeness, commercial use, model release, trademark, attribution: unknown / not approved | Yes, controlled only | No | Replace or clear portrait; art/legal reviewer; pending model release |
| Books cover 1: `public/assets/books/people-in-the-room-{desktop,mobile}.webp`; private master | Development concept publication | AI/source, commercial cover rights, likeness, trademark, ISBN/publisher, attribution: unknown / not approved | Yes, controlled only | No | Replace or clear concept art; Books art/legal reviewer; pending cover rights |
| Books cover 2: `public/assets/books/between-the-cities-{desktop,mobile}.webp`; private master | Development concept publication | AI/source, commercial cover rights, trademark, attribution: unknown / not approved | Yes, controlled only | No | Replace or clear concept art; Books art/legal reviewer; pending cover rights |
| Books cover 3: `public/assets/books/hearing-one-another-{desktop,mobile}.webp`; private master | Development concept publication | AI/source, commercial cover rights, trademark, attribution: unknown / not approved | Yes, controlled only | No | Replace or clear concept art; Books art/legal reviewer; pending cover rights |
| OG: `public/assets/placeholders/og-image.svg` | Code-owned development social placeholder | AI: no; public campaign approval and domain association: unknown / not approved | Yes, noindex/private preview | No | Approved production OG; brand/release owner; pending social-art approval |
| Icon: `src/app/icon.svg` | Code-owned SVG | AI: no; third-party rights none identified; attribution not required based on source | Yes | Conditional after identity/domain approval | No replacement currently; release owner; source/review record |
| Logo | No standalone logo; text brand only | Fictional text mark; trademark clearance and public brand approval: unknown / not approved | Yes | No | Decide brand and review trademark; brand/legal owner; pending identity approval |
| Fonts | No bundled font files; system/CSS stack | Font license not applicable to current fallback; final brand-font decision unknown | Yes | Conditional | Record font/license decision; release owner; pending typography record |
| News / Quote / Manifesto visuals | No separate image asset; DOM/text only | Asset rights not applicable; copy approval and attribution review pending | Yes | Conditional after copy/legal review | No asset replacement; content reviewer; pending release-copy sign-off |

## Counts

- Approved for public production now: **0 visual assets**; the icon is code-owned
  but conditional on final identity/domain approval.
- Unknown / not approved: **12 rows** covering development imagery, OG, logo,
  fonts, and content-copy review.
- Replacement required before public production: **10 rows** covering all
  development imagery, crop, OG, and undecided logo/brand treatment.
- Demo RC allowed: all rows only in controlled noindex contexts described in
  `release-positioning.md`.

The five tracked master PNGs total 12,633,223 B under `assets-source/`; runtime
public assets are approximately 1,005,795 B.

## Approved asset replacement procedure

Replacing an approved asset is a controlled **file plus configuration** change;
it is not a Three.js Runtime, Camera, SceneDirector, Renderer, or lifecycle
change.

1. Keep the approved master, source record, licence, release, and provenance
   evidence outside `public/` (and do not commit private source material).
   `public/` contains only browser-runtime derivatives such as WebP, SVG, and
   their manifests.
2. Generate and replace the required responsive runtime files in the relevant
   `public/assets/<chapter>/` directory. Do not retain the old filename merely
   to avoid updating the manifest: paths should describe the approved asset.
3. Update the related manifest whenever the path, pixel dimensions, responsive
   crop, focal point, subject bounds, or asset status changed. If an image
   changes only in compression with identical framing, only its file path and
   dimensions may need updating; a new framing always requires crop/focal
   review.
4. Update `src/content/repository.ts`, `src/app/layout.tsx`, the site identity
   disclosure, alt text, and OG metadata if the replacement also changes the
   published person, brand, title, copy, or social-share identity.
5. Record the final source, commercial-use evidence, release status, trademark
   risk, attribution, owner, and approval-evidence path in the row above.
   `unknown / not approved` remains the required status when evidence is
   missing.

### Chapter-specific configuration

| Chapter | Replace runtime files | Update configuration | Required follow-up |
| --- | --- | --- | --- |
| Hero | `public/assets/hero/*-{desktop,mobile}.webp` | `hero-manifest.json`, including `foregroundCrop` when the subject moves | Hero Desktop/Mobile art review; confirm the foreground crop retains the intended hand/microphone/subject framing. |
| Media | `public/assets/media/media-stage-*` and `media-studio-*` | `media-manifest.json` responsive crop/focal data | Media Desktop/compact/mobile review; retain Main/Secondary hierarchy and no DOM overlap. |
| About | `public/assets/about/about-portrait-{desktop,mobile}.webp` | `about-manifest.json` crop, focal point, and subject bounds | About-only Desktop/Mobile art review. |
| Books | `public/assets/books/*-{desktop,mobile}.webp` | `books-manifest.json`; retain the ordered `primary`, `secondary-left`, `secondary-right` tuple and 2:3 ratio | Books-only Desktop/Mobile art review. |
| OG / identity | `public/assets/placeholders/og-image.svg` or approved replacement | `src/app/layout.tsx` metadata and any affected content/disclosure | Verify title, description, social preview, noindex policy, and no misleading real-person/commercial claims. |

After each chapter replacement, run focused manifest tests first, then:

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e:rc
```

Do not weaken visual tests or alter Camera/Runtime parameters just to fit a new
image. Correct the approved image derivative and its manifest configuration
first, then reopen only the affected chapter's art review.
