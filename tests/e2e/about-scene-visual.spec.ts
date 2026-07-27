import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
  type TestInfo,
  type Video,
} from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type Bounds = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

type AboutProbeSnapshot = {
  readonly canvasCount: number;
  readonly scenes: {
    readonly dominant: string | null;
  };
  readonly transition: {
    readonly cameraIntentSceneId: string | null;
    readonly cameraBlendWeight: number;
  } | null;
  readonly composition: {
    readonly about: {
      readonly portrait: {
        readonly rendered: boolean;
        readonly visible: boolean;
        readonly frustumVisible: boolean;
        readonly screen?: { readonly bounds: Bounds };
      };
      readonly projection: {
        readonly deltaPx: { readonly x: number; readonly y: number } | null;
      };
      readonly motion: {
        readonly translateX: number;
        readonly translateY: number;
        readonly scale: number;
        readonly opacity: number;
        readonly colorMultiplier: number;
      };
    } | null;
    readonly media: {
      readonly main: { readonly rendered: boolean; readonly visible: boolean };
      readonly secondary: {
        readonly rendered: boolean;
        readonly visible: boolean;
      };
    };
  } | null;
  readonly diagnostics: {
    readonly sceneSnapshots: {
      readonly "about-scene"?: {
        readonly isActive: boolean;
        readonly isAnchored: boolean;
        readonly reducedMotion: boolean;
        readonly chapterProgress: number;
        readonly activeStageIndex: number;
        readonly activeStageId: string;
        readonly portrait: { readonly isAssetReady: boolean };
      };
    };
  };
};

type StageEvidence = {
  readonly requestedProgress: number;
  readonly actualProgress: number;
  readonly activeStageIndex: number;
  readonly activeStageId: string;
  readonly stageStates: readonly string[];
  readonly planeBounds: Bounds;
  readonly portraitRegionBounds: Bounds;
  readonly projectionDeltaPx: { readonly x: number; readonly y: number };
  readonly planeRendered: boolean;
  readonly planeVisible: boolean;
  readonly planeFrustumVisible: boolean;
  readonly fallbackState: string | null;
  readonly fallbackOpacity: string;
  readonly canvasCount: number;
  readonly horizontalOverflow: number;
  readonly portraitPosition: string;
  readonly portraitBackgroundColor: string;
  readonly sectionBackdropFilter: string;
  readonly timelineBounds: Bounds;
  readonly headingBounds: Bounds;
  readonly stageBounds: readonly Bounds[];
  readonly stageOpacities: readonly number[];
  readonly cameraIntentSceneId: string | null;
  readonly cameraBlendWeight: number;
  readonly motion: NonNullable<
    NonNullable<AboutProbeSnapshot["composition"]>["about"]
  >["motion"];
};

const ARTIFACT_ROOT = path.resolve("artifacts/p4-03-about-batch4");
const STAGE_CENTERS = [0.12, 0.365, 0.615, 0.87] as const;
const STAGE_IDS = ["origin", "industry", "onCamera", "crossCultural"] as const;
const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;
const PROJECTED_BOUND_TOLERANCE_PX = 3;

test.describe("P4-03 Batch 4 About scene composition evidence", () => {
  for (const viewport of VIEWPORTS) {
    test(`proves forward/reverse composition, one-frame jumps, and Manifesto isolation on ${viewport.name}`, async ({
      browser,
    }, testInfo) => {
      test.setTimeout(120_000);
      await mkdir(ARTIFACT_ROOT, { recursive: true });
      const recording = await createRecordedSession(browser, viewport, testInfo);
      const { context, page, video } = recording;
      const videoPath = path.join(
        ARTIFACT_ROOT,
        `${viewport.name}-forward-reverse.webm`,
      );

      try {
        await page.goto("/");
        await waitForProbe(page);
        await expect(page.locator("canvas.webgl-canvas")).toHaveCount(1);

        const manifesto = await readManifestoIsolation(page);
        expect(manifesto.dominantSceneId).toBeNull();
        expect(manifesto.cameraIntentSceneId).toBe("global-idle");
        expect(manifesto.cameraBlendWeight).toBe(0);
        expect(manifesto.aboutRendered).toBe(false);
        expect(manifesto.aboutVisible).toBe(false);
        expect(manifesto.mediaMainRendered).toBe(false);
        expect(manifesto.mediaMainVisible).toBe(false);
        expect(manifesto.mediaSecondaryRendered).toBe(false);
        expect(manifesto.mediaSecondaryVisible).toBe(false);

        const forward: StageEvidence[] = [];
        for (const [stageIndex, progress] of STAGE_CENTERS.entries()) {
          const evidence = await seekAboutProgress(page, progress, {
            settleFrameCount: 48,
          });
          forward.push(evidence);
          await page.screenshot({
            path: path.join(
              ARTIFACT_ROOT,
              `${viewport.name}-stage-${stageIndex}-composited-baseline.png`,
            ),
          });
          const canvasOnlyStyle = await page.addStyleTag({
            content: ".experience-main { visibility: hidden !important; }",
          });
          await settleFrames(page, 4);
          await page.screenshot({
            path: path.join(
              ARTIFACT_ROOT,
              `${viewport.name}-stage-${stageIndex}-canvas-only-baseline.png`,
            ),
          });
          await canvasOnlyStyle.evaluate((element) => {
            element.parentNode?.removeChild(element);
          });
          await settleFrames(page, 4);
        }

        for (const [stageIndex, evidence] of forward.entries()) {
          assertStageEvidence(evidence, stageIndex, viewport.width);
        }

        const reverse: StageEvidence[] = [];
        for (const [reverseIndex, progress] of [...STAGE_CENTERS]
          .reverse()
          .entries()) {
          const evidence = await seekAboutProgress(page, progress, {
            settleFrameCount: 48,
          });
          const stageIndex = STAGE_CENTERS.length - 1 - reverseIndex;
          assertStageEvidence(evidence, stageIndex, viewport.width);
          assertBoundsClose(
            evidence.planeBounds,
            forward[stageIndex].planeBounds,
            PROJECTED_BOUND_TOLERANCE_PX,
          );
          reverse.push(evidence);
        }

        await seekAboutProgress(page, STAGE_CENTERS[0], {
          settleFrameCount: 8,
        });
        const fastJump = await seekAboutProgress(page, STAGE_CENTERS[3], {
          settleFrameCount: 1,
          waitForProgress: false,
        });
        expect(fastJump.activeStageIndex).toBe(3);
        expect(fastJump.activeStageId).toBe("crossCultural");
        expect(fastJump.stageStates).toEqual([
          "rest",
          "rest",
          "previous",
          "current",
        ]);

        const captureProgress = viewport.width <= 768 ? 0.2 : 0.365;
        const capture = await seekAboutProgress(page, captureProgress, {
          settleFrameCount: 48,
        });
        await page.screenshot({
          path: path.join(
            ARTIFACT_ROOT,
            `${viewport.name}-about-composited.png`,
          ),
        });
        expect(capture.fallbackState).toBe("ready-active");
        expect(capture.fallbackOpacity).toBe("0");

        const canvasOnlyStyle = await page.addStyleTag({
          content: ".experience-main { visibility: hidden !important; }",
        });
        await settleFrames(page, 8);
        await page.screenshot({
          path: path.join(
            ARTIFACT_ROOT,
            `${viewport.name}-about-canvas-only.png`,
          ),
        });
        await canvasOnlyStyle.evaluate((element) => {
          element.parentNode?.removeChild(element);
        });
        await settleFrames(page, 4);

        await writeFile(
          path.join(ARTIFACT_ROOT, `${viewport.name}-evidence.json`),
          `${JSON.stringify(
            { viewport, manifesto, forward, reverse, fastJump, capture },
            null,
            2,
          )}\n`,
          "utf8",
        );
      } finally {
        await context.close();
        await video.saveAs(videoPath);
      }
    });

    test(`keeps the origin pose and zero camera blend under reduced motion on ${viewport.name}`, async ({
      browser,
    }, testInfo) => {
      await mkdir(ARTIFACT_ROOT, { recursive: true });
      const context = await browser.newContext({
        baseURL: testInfo.project.use.baseURL,
        viewport: { width: viewport.width, height: viewport.height },
        reducedMotion: "reduce",
        recordVideo: {
          dir: path.join(ARTIFACT_ROOT, ".playwright-video"),
          size: { width: viewport.width, height: viewport.height },
        },
      });
      const page = await context.newPage();
      const video = page.video();
      if (!video) {
        await context.close();
        throw new Error("Reduced-motion video recording was not created.");
      }
      try {
        await page.goto("/");
        await waitForProbe(page);

        const evidence = await seekAboutProgress(page, STAGE_CENTERS[3], {
          settleFrameCount: 8,
          waitForProgress: false,
        });
        await page.screenshot({
          path: path.join(
            ARTIFACT_ROOT,
            `${viewport.name}-reduced-motion-hold.png`,
          ),
        });
        expect(evidence.canvasCount).toBe(1);
        expect(evidence.activeStageIndex).toBe(0);
        expect(evidence.activeStageId).toBe("origin");
        expect(evidence.stageStates).toEqual([
          "current",
          "rest",
          "rest",
          "rest",
        ]);
        expect(evidence.motion).toEqual({
          translateX: 0,
          translateY: 0,
          scale: 1,
          opacity: 1,
          colorMultiplier: 0.94,
        });
        expect(evidence.cameraIntentSceneId).toBe("about-scene");
        expect(evidence.cameraBlendWeight).toBe(0);
        expect(evidence.horizontalOverflow).toBe(0);
        expect(evidence.portraitPosition).toBe(
          viewport.width <= 768 ? "static" : "sticky",
        );
      } finally {
        await context.close();
        await video.saveAs(
          path.join(ARTIFACT_ROOT, `${viewport.name}-reduced-motion.webm`),
        );
      }
    });
  }
});

function assertStageEvidence(
  evidence: StageEvidence,
  expectedStageIndex: number,
  viewportWidth: number,
): void {
  expect(evidence.activeStageIndex).toBe(expectedStageIndex);
  expect(evidence.activeStageId).toBe(STAGE_IDS[expectedStageIndex]);
  expect(evidence.stageStates).toEqual(
    STAGE_IDS.map((_, index) => {
      if (index === expectedStageIndex) return "current";
      if (index === expectedStageIndex - 1) return "previous";
      return "rest";
    }),
  );
  expect(evidence.canvasCount).toBe(1);
  expect(evidence.horizontalOverflow).toBe(0);
  expect(evidence.planeRendered).toBe(true);
  expect(evidence.planeVisible).toBe(true);
  expect(
    boundsOverlapRatio(evidence.planeBounds, evidence.portraitRegionBounds),
  ).toBeGreaterThanOrEqual(0.7);
  expect(Math.abs(evidence.projectionDeltaPx.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(evidence.projectionDeltaPx.y)).toBeLessThanOrEqual(1);
  expect(evidence.cameraIntentSceneId).toBe("about-scene");
  expect(evidence.cameraBlendWeight).toBe(0);
  expect(evidence.portraitPosition).toBe(
    viewportWidth <= 768 ? "static" : "sticky",
  );
  assertTimelineVisualWeights(evidence, expectedStageIndex);
  if (viewportWidth > 768) {
    expect(evidence.planeBounds.right).toBeLessThanOrEqual(
      evidence.timelineBounds.left,
    );
    expect(evidence.headingBounds.left).toBeGreaterThanOrEqual(
      evidence.planeBounds.right,
    );
  } else {
    expect(evidence.portraitRegionBounds.bottom).toBeLessThanOrEqual(
      evidence.timelineBounds.top,
    );
  }
  if (evidence.fallbackState === "ready-active") {
    expect(evidence.sectionBackdropFilter).toBe("none");
    expect(evidence.portraitBackgroundColor).toBe("rgba(0, 0, 0, 0)");
  }
}

function assertTimelineVisualWeights(
  evidence: StageEvidence,
  currentIndex: number,
): void {
  for (const [index, opacity] of evidence.stageOpacities.entries()) {
    if (index === currentIndex) {
      expect(opacity).toBeCloseTo(1, 2);
      continue;
    }
    if (index === currentIndex - 1) {
      expect(opacity).toBeGreaterThanOrEqual(0.45);
      expect(opacity).toBeLessThanOrEqual(0.65);
      continue;
    }
    if (index < currentIndex - 1) {
      expect(opacity).toBeGreaterThanOrEqual(0.18);
      expect(opacity).toBeLessThanOrEqual(0.35);
      continue;
    }
    expect(opacity).toBeGreaterThanOrEqual(0.2);
    expect(opacity).toBeLessThanOrEqual(0.4);
  }
}

async function readManifestoIsolation(page: Page): Promise<{
  readonly dominantSceneId: string | null;
  readonly cameraIntentSceneId: string | null;
  readonly cameraBlendWeight: number;
  readonly aboutRendered: boolean;
  readonly aboutVisible: boolean;
  readonly mediaMainRendered: boolean;
  readonly mediaMainVisible: boolean;
  readonly mediaSecondaryRendered: boolean;
  readonly mediaSecondaryVisible: boolean;
}> {
  await page.locator("#manifesto").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    window.scrollTo({
      top: Math.max(
        0,
        rect.top +
          window.scrollY +
          rect.height / 2 -
          window.innerHeight / 2,
      ),
      behavior: "instant",
    });
  });
  await settleFrames(page, 8);
  await expect
    .poll(async () => {
      const snapshot = await getProbeSnapshot(page);
      return snapshot.transition?.cameraIntentSceneId ?? null;
    })
    .toBe("global-idle");

  const snapshot = await getProbeSnapshot(page);
  return {
    dominantSceneId: snapshot.scenes.dominant,
    cameraIntentSceneId:
      snapshot.transition?.cameraIntentSceneId ?? null,
    cameraBlendWeight: snapshot.transition?.cameraBlendWeight ?? -1,
    aboutRendered:
      snapshot.composition?.about?.portrait.rendered ?? false,
    aboutVisible: snapshot.composition?.about?.portrait.visible ?? false,
    mediaMainRendered:
      snapshot.composition?.media.main.rendered ?? false,
    mediaMainVisible:
      snapshot.composition?.media.main.visible ?? false,
    mediaSecondaryRendered:
      snapshot.composition?.media.secondary.rendered ?? false,
    mediaSecondaryVisible:
      snapshot.composition?.media.secondary.visible ?? false,
  };
}

async function seekAboutProgress(
  page: Page,
  requestedProgress: number,
  options: {
    readonly settleFrameCount?: number;
    readonly waitForProgress?: boolean;
  } = {},
): Promise<StageEvidence> {
  const targetScrollY = await page.evaluate((progress) => {
    const about = document.getElementById("about");
    if (!about) {
      throw new Error("About section is unavailable.");
    }
    const bounds = about.getBoundingClientRect();
    const documentTop = bounds.top + window.scrollY;
    const target =
      documentTop -
      window.innerHeight +
      progress * (window.innerHeight + Math.max(1, bounds.height));
    return Math.max(
      0,
      Math.min(
        target,
        document.documentElement.scrollHeight - window.innerHeight,
      ),
    );
  }, requestedProgress);

  await page.evaluate((scrollY) => {
    window.scrollTo({ top: scrollY, behavior: "instant" });
  }, targetScrollY);

  await expect
    .poll(async () => {
      const scene = (await getProbeSnapshot(page)).diagnostics
        .sceneSnapshots["about-scene"];
      return Boolean(
        scene?.isActive &&
          scene.isAnchored &&
          scene.portrait.isAssetReady,
      );
    })
    .toBe(true);

  if (options.waitForProgress !== false) {
    await expect
      .poll(async () => {
        const scene = (await getProbeSnapshot(page)).diagnostics
          .sceneSnapshots["about-scene"];
        return scene?.chapterProgress;
      })
      .toBeCloseTo(requestedProgress, 2);
  }
  await settleFrames(page, options.settleFrameCount ?? 8);

  return page.evaluate((requested) => {
    const probe = (
      window as Window & {
        __trevorNoahWebGLProbe?: { snapshot(): AboutProbeSnapshot };
      }
    ).__trevorNoahWebGLProbe;
    const snapshot = probe?.snapshot();
    const scene = snapshot?.diagnostics.sceneSnapshots["about-scene"];
    const about = snapshot?.composition?.about;
    const planeBounds = about?.portrait.screen?.bounds;
    const projectionDeltaPx = about?.projection.deltaPx;
    const portrait = document.querySelector<HTMLElement>(
      "#about .about-portrait-region",
    );
    const aboutSection = document.querySelector<HTMLElement>("#about");
    const timeline = document.querySelector<HTMLElement>("#about .about-timeline");
    const heading = document.querySelector<HTMLElement>("#about h2");
    const fallback = document.querySelector<HTMLElement>(
      "#about img[data-about-fallback='true']",
    );
    const stages = Array.from(
      document.querySelectorAll<HTMLElement>(
        "#about [data-about-stage-index]",
      ),
    );
    if (
      !snapshot ||
      !scene ||
      !about ||
      !planeBounds ||
      !projectionDeltaPx ||
      !portrait ||
      !aboutSection ||
      !timeline ||
      !heading ||
      !fallback ||
      stages.length !== 4
    ) {
      throw new Error("About browser evidence is incomplete.");
    }
    const portraitBounds = portrait.getBoundingClientRect();
    const timelineBounds = timeline.getBoundingClientRect();
    const headingBounds = heading.getBoundingClientRect();

    return {
      requestedProgress: requested,
      actualProgress: scene.chapterProgress,
      activeStageIndex: scene.activeStageIndex,
      activeStageId: scene.activeStageId,
      stageStates: stages.map(
        (stage) => stage.dataset.aboutStageState ?? "",
      ),
      planeBounds,
      portraitRegionBounds: {
        left: portraitBounds.left,
        right: portraitBounds.right,
        top: portraitBounds.top,
        bottom: portraitBounds.bottom,
      },
      projectionDeltaPx,
      planeRendered: about.portrait.rendered,
      planeVisible: about.portrait.visible,
      planeFrustumVisible: about.portrait.frustumVisible,
      fallbackState: fallback.dataset.aboutFallbackState ?? null,
      fallbackOpacity: getComputedStyle(fallback).opacity,
      canvasCount: snapshot.canvasCount,
      horizontalOverflow: Math.max(
        0,
        document.documentElement.scrollWidth - window.innerWidth,
      ),
      portraitPosition: getComputedStyle(portrait).position,
      portraitBackgroundColor:
        getComputedStyle(portrait).backgroundColor,
      sectionBackdropFilter: getComputedStyle(aboutSection).backdropFilter,
      timelineBounds: {
        left: timelineBounds.left,
        right: timelineBounds.right,
        top: timelineBounds.top,
        bottom: timelineBounds.bottom,
      },
      headingBounds: {
        left: headingBounds.left,
        right: headingBounds.right,
        top: headingBounds.top,
        bottom: headingBounds.bottom,
      },
      stageBounds: stages.map((stage) => {
        const bounds = stage.getBoundingClientRect();
        return {
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          bottom: bounds.bottom,
        };
      }),
      stageOpacities: stages.map((stage) =>
        Number.parseFloat(getComputedStyle(stage).opacity),
      ),
      cameraIntentSceneId:
        snapshot.transition?.cameraIntentSceneId ?? null,
      cameraBlendWeight:
        snapshot.transition?.cameraBlendWeight ?? -1,
      motion: about.motion,
    };
  }, requestedProgress);
}

function boundsOverlapRatio(subject: Bounds, container: Bounds): number {
  const width = Math.max(
    0,
    Math.min(subject.right, container.right) -
      Math.max(subject.left, container.left),
  );
  const height = Math.max(
    0,
    Math.min(subject.bottom, container.bottom) -
      Math.max(subject.top, container.top),
  );
  const subjectArea =
    Math.max(1, subject.right - subject.left) *
    Math.max(1, subject.bottom - subject.top);
  return (width * height) / subjectArea;
}

function assertBoundsClose(
  actual: Bounds,
  expected: Bounds,
  tolerance: number,
): void {
  for (const edge of ["left", "right", "top", "bottom"] as const) {
    expect(
      Math.abs(actual[edge] - expected[edge]),
      `${edge}: actual=${actual[edge]}, expected=${expected[edge]}`,
    ).toBeLessThanOrEqual(tolerance);
  }
}

async function waitForProbe(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          typeof (
            window as Window & {
              __trevorNoahWebGLProbe?: { snapshot(): unknown };
            }
          ).__trevorNoahWebGLProbe?.snapshot === "function",
      ),
    )
    .toBe(true);
}

async function getProbeSnapshot(page: Page): Promise<AboutProbeSnapshot> {
  return page.evaluate(() => {
    const probe = (
      window as Window & {
        __trevorNoahWebGLProbe?: { snapshot(): AboutProbeSnapshot };
      }
    ).__trevorNoahWebGLProbe;
    if (!probe) {
      throw new Error("WebGL probe is unavailable.");
    }
    return probe.snapshot();
  });
}

async function settleFrames(page: Page, count: number): Promise<void> {
  await page.evaluate(
    (frameCount) =>
      new Promise<void>((resolve) => {
        let remaining = frameCount;
        const tick = (): void => {
          remaining -= 1;
          if (remaining <= 0) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    count,
  );
}

async function createRecordedSession(
  browser: Browser,
  viewport: (typeof VIEWPORTS)[number],
  testInfo: TestInfo,
): Promise<{
  readonly context: BrowserContext;
  readonly page: Page;
  readonly video: Video;
}> {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    viewport: { width: viewport.width, height: viewport.height },
    recordVideo: {
      dir: path.join(ARTIFACT_ROOT, ".playwright-video"),
      size: { width: viewport.width, height: viewport.height },
    },
  });
  const page = await context.newPage();
  const video = page.video();
  if (!video) {
    await context.close();
    throw new Error("Playwright video recording was not created.");
  }
  return { context, page, video };
}
