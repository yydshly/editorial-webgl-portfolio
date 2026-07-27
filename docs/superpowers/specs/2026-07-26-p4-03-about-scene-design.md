# P4-03 About Scene Design Specification

## Product goal

P4-03 turns About into the fictional archive of `DEV-HOST-01`: who she is, the work that formed her, and how she reaches her current cross-cultural practice. It is a DOM-first editorial timeline with one restrained WebGL portrait enhancement. It must not restate Manifesto's point of view, become an awards wall, or rely on WebGL for readable content.

The locked page order is:

```text
Hero → Media → Manifesto → About → News → Quote → Books
```

`Manifesto` is a DOM-only interlude. Media must be cached before it; About must only preload as the reader approaches About. There is no Media-to-About direct scene or camera handoff across Manifesto.

## Content model and editorial voice

All biography below belongs to the fictional `DEV-HOST-01`, a host, content creator, and public speaker. No copy may imply that it is the life story of a real public figure. The writing is restrained documentary/archive language: factual, clear, and human; it excludes heroic vocabulary such as “逆袭”, “传奇”, and “梦想成真”.

| Order | Year · place | Stage title | Narrative | Key fact |
| --- | --- | --- | --- | --- |
| 1 | `2010 · Xi'an` | Observation becomes expression | She grows up in Xi'an and becomes attentive to character stories, interviews, and public expression. School writing and small interviews teach her to observe people together with their environment. | Completes her first character interview and campus feature. |
| 2 | `2015 · Shanghai` | Learning the work behind the story | She joins a content team and begins with topic selection, research organisation, and scripting. The work gives her a working understanding of interview structure and person-led narrative. | Joins a content team and takes responsibility for topics and drafting. |
| 3 | `2020 · Beijing` | Bringing research in front of the camera | A formal hosting opportunity turns backstage experience into an on-camera practice. Her style becomes measured, clear, and centred on the person being interviewed. | Hosts her first formal interview programme. |
| 4 | `2026 · New York` | Cross-cultural public expression | She makes interview and content projects for people with different cultural backgrounds. Her working identity now spans host, content creator, and public speaker. | Launches and independently produces a cross-cultural content project. |

Each rendered stage contains its year/place, title, two or three sentences, and key fact in real DOM text. The timeline is the source of meaning; the portrait never replaces this information.

## DOM experience

### Desktop

- `AboutSection` is an editorial archive rather than a card gallery: a left portrait region, a right vertical timeline, and one thin rule through all four stages.
- The portrait region is sticky only within the About section's desktop layout bounds. It never overlaps the following News section.
- The desktop WebGL plane must use the sticky portrait region's current measured rect, refreshed through the existing `MEASURE` phase; it must not approximate sticky position with scroll subtraction or CSS-specific offsets.
- The active stage is fully weighted; its immediate previous stage remains readable at lower weight; earlier stages are quieter; a later stage stays low weight until it becomes active.
- The timeline uses semantic ordered-list structure. Each item has an accessible heading, year/place, paragraphs, and a labelled key fact. The visual rule is decorative and not the only ordering signal.
- Text stays in the right reading column. The portrait does not cover stage copy, and the layout has no horizontal overflow.

### Mobile

- The same portrait comes first, then the four-stage timeline in normal document order.
- The portrait is not sticky. It must not monopolise the small viewport or trap the reader before the timeline.
- The active/previous weighting keeps the same meaning as desktop, but only the active stage has high visual weight at one time. The remaining three keep normal readable DOM text rather than being hidden.
- The layout preserves a single vertical reading path without horizontal overflow.

## WebGL enhancement

P4-03 adds exactly one `AboutScene` and exactly one portrait plane. It follows the existing `SceneModule<TSnapshot>` contract:

```ts
identity: SceneIdentity
preload(): Promise<void> | void
activate(): boolean
update(payload: MotionFramePayload): void
deactivate(): boolean
dispose(): void
getSnapshot(): Readonly<AboutSceneState>
getCameraIntent?(): Readonly<CameraIntent> | null
```

`AboutScene` never creates a Canvas, renderer, camera, or RAF. It receives `AssetRegistry<HTMLImageElement>`, `DOMTracker`, and `MotionSnapshotStore`, registers the portrait through `AssetRegistry`, and leases its Three.js texture/geometry/material through the existing `GPUResourceManager` in `AboutWebGLRenderer`.

The plane is anchored from `DOMTracker.getSnapshot("about")` and positioned with `resolveScenePlaneWorldLayout`. It has one texture, one geometry, one material, and one mesh. It changes only by subtle `translateX`, `translateY`, scale, crop/focal-point offset, opacity, and bounded brightness. It does not rotate; it does not create depth stacks, filters, shader effects, video textures, GLB models, particles, or post-processing.

### Stage semantics

`AboutChapterProgress` is a pure value in `[0, 1]`, computed from the existing motion snapshot and About anchor geometry. Suggested stage intervals are:

| Stage | Nominal interval | Forward entry | Reverse re-entry | Visual pose |
| --- | --- | --- | --- | --- |
| `origin` | `[0.00, 0.24)` | `>= 0.26` from no active stage | `< 0.22` from `industry` | baseline crop; opacity `1.00`; scale `1.00` |
| `industry` | `[0.24, 0.49)` | `>= 0.51` | `< 0.47` from `onCamera` | `+8px x`, `-4px y`; scale `1.01`; opacity `0.98` |
| `onCamera` | `[0.49, 0.74)` | `>= 0.76` | `< 0.72` from `crossCultural` | `+14px x`, `-8px y`; scale `1.02`; opacity `1.00` |
| `crossCultural` | `[0.74, 1.00]` | `>= 0.76` | `<= 0.72` | `+20px x`, `-10px y`; scale `1.03`; opacity `0.98` |

The `0.02` symmetric hysteresis band prevents threshold chatter while retaining the same semantic order in both directions. Initial selection uses the nominal interval. A fast-scroll discontinuity chooses the final nominal stage directly and applies its final pose in the same update; it does not play skipped stages.

Reduced motion uses the `origin` hold pose for the plane and the corresponding DOM timeline remains readable. It does not animate between stage poses.

## Camera intent

`AboutScene.getCameraIntent()` supplies a stable `CameraIntent` derived from the About anchor's `worldCenter`:

| Stage | target offset | position offset | FOV | depth bias |
| --- | --- | --- | --- | --- |
| origin | `(0, 0, 0)` | `(0, 0, 0.35)` | `48` | `-0.15` |
| industry | `(0.01, -0.01, 0)` | `(-0.01, 0, 0.35)` | `48` | `-0.15` |
| onCamera | `(0.02, -0.01, 0)` | `(-0.02, 0.01, 0.35)` | `48` | `-0.15` |
| crossCultural | `(0.03, -0.02, 0)` | `(-0.03, 0.01, 0.35)` | `48` | `-0.15` |

`CameraRig` remains the only camera owner and applies the final intent. `SceneDirector` remains the only aggregator and lifecycle entry point. The small stage changes should be primarily plane-driven; they must not read as camera travel or FOV breathing. Reduced motion uses the origin hold intent with immediate application. Fast-scroll snaps to the final coherent About intent under the existing discontinuity policy.

## Asset specification

The production-ready asset package is:

```text
public/assets/about/about-portrait-master.png
public/assets/about/about-portrait-desktop.webp
public/assets/about/about-portrait-mobile.webp
public/assets/about/about-manifest.json
```

The source is a fictional `DEV-HOST-01` editorial archive portrait: chest-up or half-body, neutral high-end studio/interview environment, soft directional light, neutral grey or warm-grey background, no microphone, no stage-colour lighting, and a calm, reflective, confident expression. The subject sits left or left-centre and looks naturally right, with clear breathing room on the right for the desktop timeline. Desktop and mobile crops derive from the same master semantic; the mobile crop preserves face and identity.

`about-manifest.json` must contain a stable asset id, master source dimensions, desktop and mobile paths, their crop/focal points, `sRGB` colour space, expected subject bounds in normalised coordinates, and explicit `development` or `production` asset status.

The current Hero/Media development portrait is an identity/wardrobe/lighting reference only. Its composition is not asserted to satisfy About's left-side portrait requirement and it is not a production About asset.

## Lifecycle and interlude orchestration

1. The existing Media flow completes exit and `SceneDirector.cache("media-scene")` before the reader enters Manifesto.
2. Manifesto registers only a `SceneAnchor`; it does not register a `SceneModule` or render a WebGL person.
3. When the About anchor's dynamic screen top is within `1.5 × viewportHeight` below the viewport, `SceneDirector.preload("about-scene")` starts once. This is a preload condition, not visual activation.
4. About activates with `replace` only when its core region intersects `[0.20 × viewportHeight, 0.80 × viewportHeight]`. There is no overlapping Media/Manifesto transition.
5. While active, About is the dominant Scene and may provide its stable camera intent.
6. Leaving About beyond the section's cache boundary caches the scene under the existing registry semantics; it does not dispose the asset merely because it left view.
7. Reverse scrolling restores About from cached to active through `SceneDirector.activate`, then returns to Manifesto with About cached and no About intent selected.
8. Manifesto uses an explicit global idle camera intent, not a stale Media or About intent. The idle intent keeps the shared camera stable and does not perform a handoff blend.
9. Fast-scroll resolves the final Media/Manifesto/About lifecycle state in one scheduler update before camera arbitration and render submission.
10. With reduced motion, the same lifecycle conditions apply, but the portrait and camera use fixed hold poses and no blend/travel.

## Fallback, context, and accessibility

The DOM portrait image remains in `AboutSection` as a semantic fallback. Its image pixels may be set transparent only when all are true: WebGL is available, the context is live, the About texture is ready, and the About Scene is active/visible. The timeline text, heading, layout space, and accessibility tree remain present in every state.

For unavailable WebGL, loading, inactive/cached About, context loss, or resource invalidation, fallback image opacity returns to `1` before any WebGL layer is absent. Context restore reuses `AssetRegistry` data and reacquires GPU leases; it must never create an image-free gap.

## Responsive, performance, and test requirements

- Desktop has an explicit portrait/timeline two-column relationship; mobile is portrait-first then timeline.
- One About texture, one plane, one material, and one geometry are the P4-03 budget. Asset source selection loads only the desktop or mobile variant required by the viewport, not both textures simultaneously.
- Existing Hero/Media resource owners must not be released, re-uploaded, or duplicated by About activity.
- Unit coverage must test content ordering, progress/stage boundaries/hysteresis, lifecycle transitions, asset selection/leases, one-mesh renderer ownership, camera intent, fallback/context behaviour, reverse, fast-scroll, and reduced-motion.
- Browser coverage must test desktop `1440×900` and mobile `390×844`: semantic timeline, DOM fallback, one canvas, portrait anchor projection, stage progress forward/reverse, fast discontinuity, reduced-motion, and context/unavailable fallback.

## Acceptance criteria

1. All four timeline stages and their key facts are meaningful DOM content; the narrative is internally consistent and remains clearly fictional.
2. Desktop makes the left portrait and right archive timeline legible; mobile has non-sticky portrait-first reading and no overflow.
3. The active/previous-stage visual weighting is clear without hiding content needed for reading.
4. About adds one Scene, one plane, and one texture; no second Canvas, camera, renderer, RAF, or R3F path appears.
5. Media cannot hand off directly to About over Manifesto; no Media/ About person or camera intent leaks through the DOM-only interlude.
6. Forward, reverse, fast-scroll, reduced-motion, WebGL-unavailable, context-lost, and restored paths all have an identifiable DOM or WebGL portrait without a blank interval.
7. About's resource owners return to the expected cached/disposed state without changing Hero/Media resource counts.

## Non-goals

- Real-person biography or production talent assets.
- Multiple About portraits, four WebGL scenes, awards database, achievement wall, click timeline navigation, stage deep links, or audio.
- Shader, particle, video texture, GLB, post-processing, complex camera travel, or camera redesign.
- A runtime redesign of `SceneDirector`, `CameraRig`, `FrameCoordinator`, `GlobalWebGLStage`, or the fallback contract.

## Risks and open items

| Item | Gate before implementation |
| --- | --- |
| About production portrait may not exist yet | Approve the four-file asset package and assert its manifest subject bounds before renderer integration. |
| Existing `SceneDirector` only contains Hero-to-Media automatic orchestration | Add the explicit Media → Manifesto → About policy through focused tests, preserving existing Hero/Media behaviour. |
| Current idle camera behaviour retains the last pose when no intent exists | Add and test the explicit global idle intent for DOM interludes before activating About. |
| Desktop sticky portrait can obscure following content | Browser test the sticky containment and News entry at desktop; use normal flow on mobile. |
| Placeholder asset quality differs from production photography | Treat development evidence as composition verification only; repeat art review after production portrait replacement. |
