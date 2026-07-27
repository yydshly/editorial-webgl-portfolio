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
