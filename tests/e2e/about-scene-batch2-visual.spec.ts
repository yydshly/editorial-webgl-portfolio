import { expect, test, type Page } from "@playwright/test";
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
  readonly composition: {
    readonly about: {
      readonly portrait: {
        readonly rendered: boolean;
        readonly visible: boolean;
        readonly frustumVisible: boolean;
        readonly opacity?: number;
        readonly screen?: {
          readonly center: { readonly x: number; readonly y: number };
          readonly bounds: Bounds;
        };
      };
      readonly motion: {
        readonly translateX: number;
        readonly translateY: number;
        readonly scale: number;
        readonly opacity: number;
        readonly colorMultiplier: number;
      };
    } | null;
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
        readonly stageProgress: number;
        readonly portrait: {
          readonly isAssetReady: boolean;
          readonly assetSource: string;
        };
      };
    };
  };
};

type StageEvidence = {
  readonly requestedProgress: number;
  readonly actualProgress: number;
  readonly sceneStageIndex: number;
  readonly sceneActive: boolean;
  readonly sceneAnchored: boolean;
  readonly portraitReady: boolean;
  readonly domStageIndex: number;
  readonly readingBounds: Bounds;
  readonly domPortraitBounds: Bounds;
  readonly portraitBounds: Bounds;
  readonly frustumVisible: boolean;
  readonly rendered: boolean;
  readonly canvasCount: number;
  readonly horizontalOverflow: number;
  readonly fallbackOpacity: string;
  readonly motion: NonNullable<
    NonNullable<AboutProbeSnapshot["composition"]>["about"]
  >["motion"];
};

const ARTIFACT_ROOT = path.resolve("artifacts/p4-03-about-batch2");
const STAGE_CENTERS = [0.12, 0.365, 0.615, 0.87] as const;
const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;
const READING_COLLISION_TOLERANCE_PX = 2;

test.describe("P4-03 Batch 2 About portrait composition evidence", () => {
  for (const viewport of VIEWPORTS) {
    test(`keeps portrait and DOM timeline coherent on ${viewport.name}`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await mkdir(ARTIFACT_ROOT, { recursive: true });
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/");
      await approachAboutRuntime(page);
      await waitForAboutRuntime(page);

      const forward: StageEvidence[] = [];
      for (const [stageIndex, requestedProgress] of STAGE_CENTERS.entries()) {
        const evidence = await seekAndReadEvidence(page, requestedProgress);
        await page.screenshot({
          path: path.join(
            ARTIFACT_ROOT,
            `${viewport.name}-stage-${stageIndex}-composited.png`,
          ),
          fullPage: false,
        });
        assertStageEvidence(
          evidence,
          stageIndex,
          viewport.width,
          viewport.height,
        );
        forward.push(evidence);
      }

      const holdProgress =
        viewport.width <= 768 ? 0.2 : STAGE_CENTERS[2];
      const hold = await seekAndReadEvidence(page, holdProgress);
      await page.screenshot({
        path: path.join(
          ARTIFACT_ROOT,
          `${viewport.name}-about-composited.png`,
        ),
        fullPage: false,
      });
      const canvasOnlyStyle = await page.addStyleTag({
        content:
          "img[data-about-fallback='true'] { opacity: 0 !important; visibility: hidden !important; } " +
          ".about-portrait-region { background: transparent !important; }",
      });
      await page.screenshot({
        path: path.join(
          ARTIFACT_ROOT,
          `${viewport.name}-about-canvas-only.png`,
        ),
        fullPage: false,
      });
      await canvasOnlyStyle.evaluate((element) => {
        element.parentNode?.removeChild(element);
      });

      const reverse: StageEvidence[] = [];
      for (const [stageIndex, requestedProgress] of [...STAGE_CENTERS]
        .reverse()
        .entries()) {
        const evidence = await seekAndReadEvidence(page, requestedProgress);
        reverse.push(evidence);
        const expected = forward[STAGE_CENTERS.length - 1 - stageIndex];
        // Batch 2 owns the portrait-local pose only. Projected pixels also
        // include the shared CameraRig pose and are intentionally recorded
        // for Batch 3 CameraIntent/orchestration without being rewritten here.
        expect(evidence.motion).toEqual(expected.motion);
        expect
          .soft(evidence.portraitBounds.left)
          .toBeCloseTo(expected.portraitBounds.left, 0);
        expect
          .soft(evidence.portraitBounds.right)
          .toBeCloseTo(expected.portraitBounds.right, 0);
      }

      await seekAndReadEvidence(page, STAGE_CENTERS[0]);
      const fastJump = await seekAndReadEvidence(page, STAGE_CENTERS[3], true);
      expect(fastJump.sceneStageIndex).toBe(3);
      expect(fastJump.domStageIndex).toBe(3);

      await writeFile(
        path.join(ARTIFACT_ROOT, `${viewport.name}-stage-evidence.json`),
        `${JSON.stringify({ viewport, forward, reverse, fastJump, hold }, null, 2)}\n`,
        "utf8",
      );
    });

    test(`uses the origin hold pose for reduced motion on ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await approachAboutRuntime(page);
      await waitForAboutRuntime(page);

      const evidence = await seekAndReadEvidence(
        page,
        STAGE_CENTERS[3],
        false,
        true,
      );
      expect(evidence.sceneStageIndex).toBe(0);
      expect(evidence.domStageIndex).toBe(0);
      expect(evidence.motion).toEqual({
        translateX: 0,
        translateY: 0,
        scale: 1,
        opacity: 1,
        colorMultiplier: 0.94,
      });
      await page.screenshot({
        path: path.join(
          ARTIFACT_ROOT,
          `${viewport.name}-about-reduced-motion.png`,
        ),
        fullPage: false,
      });
    });
  }
});

function assertStageEvidence(
  evidence: StageEvidence,
  expectedStageIndex: number,
  viewportWidth: number,
  viewportHeight: number,
): void {
  expect(evidence.sceneStageIndex).toBe(expectedStageIndex);
  expect(evidence.domStageIndex).toBe(expectedStageIndex);
  expect(evidence.canvasCount).toBe(1);
  expect(evidence.horizontalOverflow).toBeLessThanOrEqual(0);
  expect(evidence.rendered, JSON.stringify(evidence, null, 2)).toBe(true);
  expect(evidence.portraitBounds.right - evidence.portraitBounds.left).toBeGreaterThan(1);
  expect(evidence.portraitBounds.bottom - evidence.portraitBounds.top).toBeGreaterThan(1);

  if (viewportWidth > 768) {
    expect(
      evidence.frustumVisible,
      JSON.stringify(evidence, null, 2),
    ).toBe(true);
    expect(evidence.portraitBounds.right).toBeLessThanOrEqual(
      evidence.readingBounds.left + READING_COLLISION_TOLERANCE_PX,
    );
  } else {
    const domPortraitIntersectsViewport =
      evidence.domPortraitBounds.bottom > 0 &&
      evidence.domPortraitBounds.top < viewportHeight;
    if (domPortraitIntersectsViewport) {
      expect(
        evidence.frustumVisible,
        JSON.stringify(evidence, null, 2),
      ).toBe(true);
    }
    // Mobile is intentionally portrait-first/read-next, not sticky. Whether
    // on-screen or already above the viewport, the WebGL plane must not cover
    // the actual reading column.
    expect(
      intersectionAreaInViewport(
        evidence.portraitBounds,
        evidence.readingBounds,
        viewportWidth,
        viewportHeight,
      ),
      JSON.stringify(evidence, null, 2),
    ).toBeLessThanOrEqual(READING_COLLISION_TOLERANCE_PX);
  }
}

async function waitForAboutRuntime(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const probe = (window as unknown as {
      __trevorNoahWebGLProbe?: { snapshot: () => AboutProbeSnapshot };
    }).__trevorNoahWebGLProbe;
    const snapshot = probe?.snapshot();
    const scene = snapshot?.diagnostics.sceneSnapshots["about-scene"];
    // Director preloading intentionally leaves About dormant until the later
    // progress seek enters its activation zone. This gate asserts only the
    // preload contract; seekAndReadEvidence retains the active/anchored checks.
    return Boolean(scene?.portrait.isAssetReady);
  });
}

async function approachAboutRuntime(page: Page): Promise<void> {
  const targetScrollY = await page.evaluate(() => {
    const about = document.getElementById("about");
    if (!about) {
      throw new Error("About section is unavailable.");
    }

    const documentTop = about.getBoundingClientRect().top + window.scrollY;
    return Math.max(
      0,
      Math.min(
        documentTop - window.innerHeight * 1.25,
        document.documentElement.scrollHeight - window.innerHeight,
      ),
    );
  });

  await page.evaluate((scrollY) => {
    window.scrollTo({ top: scrollY, behavior: "auto" });
  }, targetScrollY);
  await settleFrames(page, 2);
}

async function seekAndReadEvidence(
  page: Page,
  requestedProgress: number,
  immediate = false,
  skipProgressWait = false,
): Promise<StageEvidence> {
  const targetScrollY = await page.evaluate((target) => {
    const about = document.getElementById("about");
    if (!about) throw new Error("About section is unavailable.");
    const bounds = about.getBoundingClientRect();
    const documentTop = bounds.top + window.scrollY;
    const scrollY =
      documentTop -
      window.innerHeight +
      target * (window.innerHeight + Math.max(1, bounds.height));
    return Math.max(
      0,
      Math.min(
        scrollY,
        document.documentElement.scrollHeight - window.innerHeight,
      ),
    );
  }, requestedProgress);

  await page.evaluate((scrollY) => {
    window.scrollTo({ top: scrollY, behavior: "auto" });
  }, targetScrollY);

  if (!immediate && !skipProgressWait) {
    await expect
      .poll(async () => {
        const snapshot = await getProbeSnapshot(page);
        return snapshot.diagnostics.sceneSnapshots["about-scene"]
          ?.chapterProgress;
      })
      .toBeCloseTo(requestedProgress, 2);
  }
  // Batch 3's Director/camera composition settles over multiple frames. Use
  // its evidence cadence before comparing the unchanged reverse projections.
  await settleFrames(page, immediate ? 1 : 48);

  return page.evaluate((requested) => {
    const probe = (window as unknown as {
      __trevorNoahWebGLProbe?: { snapshot: () => AboutProbeSnapshot };
    }).__trevorNoahWebGLProbe;
    const snapshot = probe?.snapshot();
    const scene = snapshot?.diagnostics.sceneSnapshots["about-scene"];
    const composition = snapshot?.composition?.about;
    const reading = document.querySelector<HTMLElement>(
      "#about .about-reading",
    );
    const domPortrait = document.querySelector<HTMLElement>(
      "#about .about-portrait-region",
    );
    const fallback = document.querySelector<HTMLElement>(
      "#about img[data-about-fallback='true']",
    );
    const currentStage = document.querySelector<HTMLElement>(
      "#about [data-about-stage-state='current']",
    );
    const portraitBounds = composition?.portrait.screen?.bounds;
    if (
      !snapshot ||
      !scene ||
      !composition ||
      !reading ||
      !domPortrait ||
      !fallback ||
      !portraitBounds
    ) {
      throw new Error("About evidence is incomplete.");
    }
    const readingBounds = reading.getBoundingClientRect();
    const domPortraitBounds = domPortrait.getBoundingClientRect();

    return {
      requestedProgress: requested,
      actualProgress: scene.chapterProgress,
      sceneStageIndex: scene.activeStageIndex,
      sceneActive: scene.isActive,
      sceneAnchored: scene.isAnchored,
      portraitReady: scene.portrait.isAssetReady,
      domStageIndex: Number(currentStage?.dataset.aboutStageIndex ?? -1),
      readingBounds: {
        left: readingBounds.left,
        right: readingBounds.right,
        top: readingBounds.top,
        bottom: readingBounds.bottom,
      },
      domPortraitBounds: {
        left: domPortraitBounds.left,
        right: domPortraitBounds.right,
        top: domPortraitBounds.top,
        bottom: domPortraitBounds.bottom,
      },
      portraitBounds,
      frustumVisible: composition.portrait.frustumVisible,
      rendered: composition.portrait.rendered,
      canvasCount: snapshot.canvasCount,
      horizontalOverflow: Math.max(
        0,
        document.documentElement.scrollWidth - window.innerWidth,
      ),
      fallbackOpacity: window.getComputedStyle(fallback).opacity,
      motion: composition.motion,
    };
  }, requestedProgress);
}

function intersectionAreaInViewport(
  left: Bounds,
  right: Bounds,
  viewportWidth: number,
  viewportHeight: number,
): number {
  const clip = (bounds: Bounds): Bounds => ({
    left: Math.max(0, Math.min(viewportWidth, bounds.left)),
    right: Math.max(0, Math.min(viewportWidth, bounds.right)),
    top: Math.max(0, Math.min(viewportHeight, bounds.top)),
    bottom: Math.max(0, Math.min(viewportHeight, bounds.bottom)),
  });
  const clippedLeft = clip(left);
  const clippedRight = clip(right);
  return (
    Math.max(
      0,
      Math.min(clippedLeft.right, clippedRight.right) -
        Math.max(clippedLeft.left, clippedRight.left),
    ) *
    Math.max(
      0,
      Math.min(clippedLeft.bottom, clippedRight.bottom) -
        Math.max(clippedLeft.top, clippedRight.top),
    )
  );
}

async function getProbeSnapshot(page: Page): Promise<AboutProbeSnapshot> {
  return page.evaluate(() => {
    const probe = (window as unknown as {
      __trevorNoahWebGLProbe?: { snapshot: () => AboutProbeSnapshot };
    }).__trevorNoahWebGLProbe;
    if (!probe) throw new Error("WebGL probe is unavailable.");
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
          window.requestAnimationFrame(tick);
        };
        window.requestAnimationFrame(tick);
      }),
    count,
  );
}
