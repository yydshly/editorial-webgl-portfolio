# Release Candidate / Phase 4 Closure Specification

**Date:** 2026-07-27  
**Status:** Approved RC baseline  
**Baseline commit:** `9f2f103 feat: complete P4-04 books scene`  
**Working branch:** `feat/release-candidate-phase4`

## 1. Purpose

Phase 4 scene development is complete:

- P4-01 Hero: closed.
- P4-02 Media: closed.
- P4-03 About: closed.
- P4-04 Books: closed.

Release Candidate work converts the accepted site into a mergeable,
deployable, and auditable release. It does not add a P4-05 Scene, reopen an
accepted scene for unrelated art tuning, merge `main`, deploy, or replace
development assets without their independent review gates.

## 2. Locked product and runtime boundaries

The semantic page order remains:

```text
Hero -> Media -> Manifesto -> About -> News -> Quote -> Books
```

The following architecture is release-critical:

- DOM-first content, navigation, accessibility, SEO, and fallback.
- One global Canvas.
- One global `THREE.WebGLRenderer`.
- One Camera owned by `CameraRig`.
- One RAF owned by `FrameCoordinator`.
- `SceneDirector` is the only lifecycle and CameraIntent aggregator.
- Scene renderer adapters use the existing Three.js runtime.
- No R3F runtime path.
- News and Quote remain DOM-only global-idle intervals.

## 3. RC-00 engineering baseline

The baseline was run on an isolated port and isolated Next development output
directory. The user's existing preview server was neither reused nor stopped.

| Gate | Result |
| --- | --- |
| `pnpm lint` before cleanup | 0 errors / 5 warnings |
| `pnpm typecheck` | pass |
| `pnpm test` | 49 files / 299 tests |
| `pnpm build` | pass |
| Full E2E | 76 discovered / 58 passed / 11 failed / 7 skipped / 0 omitted |

The six additional skipped declarations are opt-in screenshot/video evidence
captures. Earlier P4-04 documentation counted them as passed, producing
`64 / 11 / 1`. The corrected exhaustive result is `58 / 11 / 7 / 0 omitted`.
The failure topology remains the same 11 Hero/Media declarations; this is a
measurement correction, not a scene regression.

The repeatable entry point is:

```bash
pnpm test:e2e:rc
```

It runs the entire suite with one worker, detects declarations skipped because
an enclosing serial suite stopped after a failure, reruns every affected
`file:line` declaration against the same isolated server, and emits a combined
`discovered / passed / failed / skipped / omitted` report. Runtime opt-in skips
remain skips; a missing follow-up remains an omission and fails the command.

Authoritative local evidence:

- `artifacts/release-candidate/rc00/full-e2e-baseline.json`
- `artifacts/release-candidate/rc00/execution-summary.json`
- `artifacts/release-candidate/rc00/evidence/`

These paths are ignored release evidence and must not be committed.

## 4. Frozen Hero/Media failure adjudication

Every failure is classified independently. “Frozen baseline” is not itself a
classification.

| ID | Category | Decision and evidence | RC action |
| --- | --- | --- | --- |
| Media secondary projected exposure/focal | A | Normal Desktop composition reproduces at exposure `0.170207`, below `0.18`; focal x `0.28` lies outside exposed fraction `0.246638`. The screenshot shows a semantically weak sliver. | Product fix required in RC-01. |
| Media hold area/exposure | A | Normal Desktop hold has main area `80124.65` versus `71200-74200` and secondary exposure `0.170182` versus `0.18-0.24`. | Product fix required in RC-01. |
| Reduced-motion dominance | B | Fixed progress `0.72` leaves internal dominance on Hero, but Media DOM/images are composed and camera travel remains effectively zero. Internal scene id is an outdated product proxy. | Rewrite the assertion around composed visibility and stable camera. |
| Mobile reduced-motion vacuum | B | WebGL-only helper reports `15` frames, but retained evidence shows visible DOM/fallback pixels. | Measure the composed result; retain the no-blank gate. |
| Desktop reduced-motion vacuum | B | WebGL-only helper reports `10` frames, but retained evidence shows visible DOM/fallback pixels. | Measure the composed result; retain the no-blank gate. |
| Mobile normal forward/reverse vacuum | B | WebGL-only helper reports `15` frames and excludes the required fallback. | Measure the composed result in both directions. |
| Desktop normal forward/reverse vacuum | B | WebGL-only helper reports `10` frames while the DOM portrait/fallback is visibly present. | Measure the composed result in both directions. |
| Fast-jump one-frame coherence | B | At frame 1 the internal dominant is null/global-idle, but the composed DOM Media/fallback remains visible. | Assert final composed-frame coherence. |
| Media fallback active-ready | B | Fixed lifecycle progress `0.72` does not prove active + dominant + current-frame visual-ready. Safe fallback remains visible. | Locate a real ready-active frame before asserting grouped hide. |
| Media fallback after delayed load | B | Loading fallback is correct; the post-load fixed-progress setup never proves ready-active. | Wait for actual Director and visual-ready preconditions. |
| Media context-loss fallback | B | The old opacity-zero setup fails before context loss is triggered. This is not evidence that restore is broken. | Establish a real hidden-ready frame, then trigger loss/restore. |

Category totals:

- A — real product defects: 2.
- B — outdated test semantics: 9.
- C — browser/measurement issue: 0 in the canonical isolated development run.
- D — approved non-blocking debt: 0 among these 11.

The two Category A findings are confirmed release blockers. The nine Category
B tests must be repaired in RC-01; their replacement assertions may not weaken
the real product gates for visual continuity, fallback safety, reduced motion,
or context recovery.

## 5. Preload-only reverse lifecycle Minor

### Deterministic sequence

1. Books crosses the preload boundary.
2. Books becomes resident but never visible, updating, or dominant.
3. Reverse moves Books outside the preload boundary.
4. Books remains a cold resident with `cached: false`.
5. Re-entry reaches the activation core and activates Books without another
   preload.

The regression test
`SceneDirector.test.ts` — “keeps a preload-only Books reverse safe and
reactivates without duplicate acquisition” verifies:

- `resident: true`;
- `visible: false`;
- `updating: false`;
- `dominant: false`;
- `cached: false`;
- one preload before and after re-entry;
- `GLOBAL_IDLE_CAMERA_INTENT` while cold;
- successful activation and Books CameraIntent on re-entry.

`BooksScene.test.ts` independently proves that repeated/concurrent preload
acquires exactly one CPU owner per cover and that dispose releases all Books
CPU/GPU owners.

### Root cause and risk

`SceneDirector.advanceQuoteBooksTransition()` only caches a resident Books
scene outside the core when activation was requested or the scene became
active. A scene that merely preloaded does not enter that branch.

This is retained residency, not an accumulating resource leak:

- preload is deduplicated;
- owner counts do not grow on reverse/re-entry;
- inactive resident state cannot contribute a stale CameraIntent;
- re-entry can activate normally;
- global runtime disposal still releases the owners.

Risk is **Minor / low / user-imperceptible**. It is not a current release
blocker. The smallest optional cleanup is to define an explicit cold-resident
policy in `SceneDirector`: cache the preload-only scene when reversing out, or
introduce a reversible resource-release state. The latter changes ownership
semantics and must not be implemented without a dedicated lifecycle decision.

## 6. Lint cleanup

RC-00 removes the five warnings without changing runtime behavior:

- replace an unused map entry id with direct `values()` iteration;
- remove one obsolete `eslint-disable`;
- remove one unused probe snapshot;
- remove one unused E2E helper;
- remove one unused geometry lookup.

The release gate is `0 errors / 0 warnings`.

## 7. Full-site RC acceptance matrix

Every matrix cell covers the full semantic route:

```text
Hero -> Media -> Manifesto -> About -> News -> Quote -> Books
```

Legend: **A** = automated evidence, **M** = human visual review, **A+M** = both.

| Viewport | Slow forward | Slow reverse | Fast down | Fast reverse | Continuous fast up/down | Reduced motion | WebGL unavailable | Context lost/restore |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Desktop `1440x900` | A+M | A+M | A+M | A+M | A+M | A+M | A+M | A+M |
| Compact Desktop `1024x900` | A+M | A+M | A+M | A+M | A+M | A+M | A+M | A+M |
| Tablet/Narrow `800x900` | A+M | A+M | A+M | A+M | A+M | A+M | A+M | A+M |
| Mobile `390x844` | A+M | A+M | A+M | A+M | A+M | A+M | A+M | A+M |

Each cell checks:

- DOM order, section ids, and anchor targets;
- lifecycle dominant/cache state and legal global-idle intervals;
- CameraIntent source;
- no composed visual vacuum;
- grouped fallback;
- no horizontal overflow;
- stable CPU texture owners and GPU leases;
- one Canvas, renderer, camera, and RAF.

RC-00 establishes this matrix and the isolated no-omission automation entry.
Final browser capture and human sign-off belong to RC-02.

## 8. SEO, navigation, accessibility, and performance audit plan

| Area | Required checks | Evidence owner | Evidence |
| --- | --- | --- | --- |
| SEO | title, description, canonical, Open Graph, structured data, heading hierarchy, image alt, complete no-WebGL content | RC automation owner | DOM snapshot, metadata report, production route output |
| Navigation | anchor order, section ids, keyboard access, focus states, CTA states, URL/section behavior, skip link | RC automation + human reviewer | keyboard trace, focus screenshots, route assertions |
| Accessibility | reduced motion, contrast, semantic sections, ARIA labels, disabled development CTA, unavailable/context-lost states, screen-reader order | RC automation + accessibility reviewer | automated report plus manual reading-order checklist |
| Performance | production build, bundle and asset sizes, initial load, texture memory, draw calls, frame submit, stable texture uploads | runtime owner | build output, bundle/asset manifest, runtime probe snapshots |

An audit finding is a release blocker when it prevents navigation, content
access, keyboard/screen-reader use, fallback access, stable runtime operation,
or compliance with an already locked performance budget. Cosmetic findings
may be deferred only with an owner, evidence, risk, and explicit release-owner
approval.

## 9. Production asset and art gates

Development portraits and Books covers may remain during engineering RC work.
Before final release, the replacement manifest must name every development
asset, target dimensions, compression budget, ownership/license status, and
review owner.

- Replacing the About portrait triggers an About-only art review.
- Replacing Books covers triggers a Books-only art review.
- The current light Books cover compression does not reopen P4-04.

## 10. Release sequence and exit gates

### RC-01 — Hero / Media E2E debt repair

- Fix the two Category A Media composition defects.
- Rewrite the nine Category B tests against composed product semantics.
- Preserve fallback and no-vacuum safety gates.
- Decide whether to clean the preload-only cold-resident state.
- Exit with zero unexplained E2E failures and zero omitted declarations.

### RC-02 — Full-site visual, navigation, SEO, and accessibility validation

- Execute all 32 viewport/mode matrix cells.
- Complete automated and human evidence.
- Resolve or explicitly adjudicate audit findings.

### RC-03 — Performance, production assets, and deployment readiness

- Verify production build and runtime budgets.
- Replace or explicitly list all development assets.
- Complete About-only and Books-only art reviews when replacements occur.
- Produce the deployment-readiness checklist without deploying.

### RC-04 — Final regression, integration, and release candidate build

- Run lint, typecheck, unit, build, and no-omission E2E.
- Complete final browser and human sign-off.
- Merge only with explicit integration authority.
- Produce the deployable Release Candidate build; deployment remains a
  separate authorized action.

## 11. Current release decision

RC-00 confirms **two current product release blockers among the 11 frozen
Hero/Media failures**. The nine remaining failures require test-debt repair but
do not currently demonstrate user-visible defects. SEO, navigation,
accessibility, performance, and production-asset audits are still pending and
may identify additional blockers.

RC-01 is closed. The project is ready to enter RC-02; it is not yet ready to
merge or deploy.

## 12. RC-01 closure (supersedes the RC-01 entry above)

RC-01 calibrated the central Media Desktop hold scale to `0.95`; no Camera,
Renderer, handoff, viewport-renderer special case, or opacity-only workaround
was used. Mobile retains its separately calibrated responsive composition.

Final `1440x900` evidence: Main `74168.36` px² (maximum `74200`), Secondary
exposure `0.20777` (range `0.18-0.24`), exposed asset fraction `0.28652`
containing focal x `0.28`, and no overflow. The nine former failures now test
composed DOM/WebGL recognition, `global-idle`, reduced motion, fast jumps, and
grouped fallback lifecycle semantics.

The isolated no-omission result is `76 discovered / 69 passed / 0 failed / 7
explicit opt-in skips / 0 omitted`. The preload-only reverse lifecycle remains
an independent Minor debt. Next: **RC-02 Full-site visual, navigation, SEO,
and accessibility validation**; merge and deployment remain unauthorized.

## 13. RC-02 engineering/audit result

RC-02 resolves the discovered navigation, SEO, and accessibility audit
findings while preserving every locked runtime boundary. The 32-cell matrix is
captured at `1440x900`, `1024x900`, `800x900`, and `390x844` for slow/fast
forward and reverse, continuous scroll, reduced motion, WebGL unavailable,
and context loss/restore.

The canonical ignored evidence index is
`artifacts/release-candidate/rc02/artifact-manifest.json`. Context recovery is
fallback-first and returns to one Canvas at every viewport; the recordings are
verified as `1440x900` Desktop and `390x844` Mobile without letterboxing.

The fictional development identity is now consistently `DEV-HOST-01`, with
noindex/nofollow metadata, a canonical development origin, DOM-complete
fallback, anchor-only live actions, a focusable skip target, labelled sections,
disabled development CTAs, image alternatives, and an accessible-hidden Canvas.
No real-person, ISBN, publisher, sales, contact, or ticketing metadata is
published.

The only responsive geometry change is a 2px Mobile Books clearance below the
sticky header. The Mobile Media hard-exposure test keeps its former product
range and instead waits for the damped CameraIntent projection to settle.

Fresh final engineering result:

```text
lint: 0 errors / 0 warnings
typecheck: pass
unit: 50 files / 303 tests passed
build: pass
RC E2E: 83 discovered / 76 passed / 0 failed / 7 explicit opt-in skipped / 0 omitted
```

There are zero confirmed functional or non-evidence E2E blockers. RC-02
received explicit temporary release-owner human visual sign-off on 2026-07-27.
Later visual refinement is deferred and may be reopened as needed, without
reopening RC-02. RC-03 is now authorized for performance budgets and formal
production asset/licensing replacement. RC-03 does not authorize a merge or
deployment; the shared development portrait and development Books covers remain
asset-review work, not Scene regressions.
