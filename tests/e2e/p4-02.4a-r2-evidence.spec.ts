import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type RuntimeLayerSnapshot = {
  readonly rendered: boolean;
  readonly visible: boolean;
  readonly frustumVisible: boolean;
  readonly opacity?: number;
  readonly screen?: {
    readonly center: { readonly x: number; readonly y: number };
    readonly bounds: {
      readonly left: number;
      readonly right: number;
      readonly top: number;
      readonly bottom: number;
    };
  };
};

type RuntimeProbeSnapshot = {
  readonly scenes: {
    readonly dominant: string | null;
  };
  readonly render: {
    readonly drawCalls: number;
    readonly textureCount: number;
    readonly geometryCount: number;
  };
  readonly transition: {
    readonly transitionPhase: string;
    readonly cameraBlendWeight: number;
    readonly dominantSceneId: string | null;
  } | null;
  readonly composition: {
    readonly hero: {
      readonly foregroundCrop?: {
        readonly responsiveAssetSource: string | null;
        readonly registration: {
          readonly expectedScreenRect: {
            readonly center: { readonly x: number; readonly y: number };
            readonly width: number;
            readonly height: number;
          };
          readonly actualScreenRect: {
            readonly center: { readonly x: number; readonly y: number };
            readonly width: number;
            readonly height: number;
          };
          readonly centerResidual: { readonly x: number; readonly y: number };
          readonly sizeResidualPercent: { readonly width: number; readonly height: number };
        } | null;
      } | null;
    };
    readonly media: {
      readonly main: RuntimeLayerSnapshot;
      readonly secondary: RuntimeLayerSnapshot;
      readonly projection?: {
        readonly main: {
          readonly anchorRectCenter: { readonly x: number; readonly y: number } | null;
          readonly projectedScreenCenter: { readonly x: number; readonly y: number } | null;
          readonly deltaPx: { readonly x: number; readonly y: number } | null;
        };
        readonly secondary: {
          readonly anchorRectCenter: { readonly x: number; readonly y: number } | null;
          readonly projectedScreenCenter: { readonly x: number; readonly y: number } | null;
          readonly deltaPx: { readonly x: number; readonly y: number } | null;
        };
      };
    };
  } | null;
  readonly diagnostics: {
    readonly sceneSnapshots: Readonly<Record<string, {
      readonly chapterProgress?: number;
      readonly mediaProgress?: number;
      readonly relativeScroll?: number;
      readonly phase?: string;
    }>>;
  };
};

type EvidenceEntry = {
  readonly viewport: string;
  readonly mode: "composited" | "canvas-only";
  readonly requestedProgress: number;
  readonly actualProgress: number;
  readonly mediaPhase: string | null;
  readonly dominantSceneId: string | null;
  readonly transitionPhase: string | null;
  readonly cameraBlendWeight: number;
  readonly mainProjectedBounds: RuntimeLayerSnapshot["screen"] | null;
  readonly secondaryProjectedBounds: RuntimeLayerSnapshot["screen"] | null;
  readonly mainFrustumVisible: boolean;
  readonly secondaryFrustumVisible: boolean;
  readonly mediaProjection: RuntimeProbeSnapshot["composition"] extends infer Composition
    ? Composition extends { readonly media: infer Media }
      ? Media extends { readonly projection?: infer Projection }
        ? Projection | null
        : null
      : null
    : null;
  readonly sectionRects: Readonly<Record<string, DOMRectRecord | null>>;
  readonly canvasCount: number;
  readonly drawCalls: number;
  readonly textureCount: number;
  readonly geometryCount: number;
  readonly screenshot: string;
};

type DOMRectRecord = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
};

type ViewportCase = {
  readonly name: "desktop-1440x900" | "mobile-390x844";
  readonly width: number;
  readonly height: number;
};

type ProgressScrollWindow = {
  readonly startRelativeScroll: number;
  readonly span: number;
};

const SHOULD_CAPTURE = process.env.P4_R2_EVIDENCE === "1";
const ARTIFACT_ROOT = path.resolve("artifacts/p4-02.4a-r2");
const SCREENSHOT_ROOT = path.join(ARTIFACT_ROOT, "screenshots");
const VIDEO_ROOT = path.join(ARTIFACT_ROOT, "videos");
const RAW_VIDEO_ROOT = path.join(VIDEO_ROOT, ".raw");
const TARGET_PROGRESS = [0.1, 0.22, 0.44, 0.66, 0.72] as const;
const VIEWPORTS: readonly ViewportCase[] = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "mobile-390x844", width: 390, height: 844 },
];

test.skip(!SHOULD_CAPTURE, "Set P4_R2_EVIDENCE=1 to generate the R2 visual evidence package.");

test.describe("P4-02.4A-R2 deterministic visual evidence", () => {
  test.describe.configure({ mode: "serial", timeout: 600_000 });

  test("captures exact progress screenshots and dynamic videos", async ({ browser }) => {
    await mkdir(SCREENSHOT_ROOT, { recursive: true });
    await mkdir(VIDEO_ROOT, { recursive: true });
    await mkdir(RAW_VIDEO_ROOT, { recursive: true });

    const evidenceEntries: EvidenceEntry[] = [];
    const heroRegistration: Record<string, unknown> = {};
    const reducedMotion: Record<string, unknown> = {};

    for (const viewport of VIEWPORTS) {
      for (const canvasOnly of [false, true]) {
        const mode = canvasOnly ? "canvas-only" : "composited";
        const session = await createRecordedSession(browser, viewport, false);
        const { context, page, video } = session;
        await preparePage(page, canvasOnly);

        const heroSnapshot = await seekChapterProgress(page, "hero-scene", "chapterProgress", 0.15);
        heroRegistration[`${viewport.name}-${mode}`] =
          heroSnapshot.composition?.hero.foregroundCrop ?? null;
        await page.screenshot({
          path: path.join(SCREENSHOT_ROOT, `${viewport.name}-${mode}-hero-foreground.png`),
        });

        for (const requestedProgress of TARGET_PROGRESS) {
          const snapshot = await seekMediaProgress(page, requestedProgress);
          const mediaScene = snapshot.diagnostics.sceneSnapshots["media-scene"];
          const actualProgress = mediaScene?.mediaProgress ?? Number.NaN;
          const progressLabel = Math.round(requestedProgress * 100).toString().padStart(3, "0");
          const screenshotPath = path.join(
            SCREENSHOT_ROOT,
            `${viewport.name}-${mode}-media-${progressLabel}.png`,
          );
          await page.screenshot({ path: screenshotPath });

          evidenceEntries.push({
            viewport: viewport.name,
            mode,
            requestedProgress,
            actualProgress,
            mediaPhase: mediaScene?.phase ?? null,
            dominantSceneId: snapshot.scenes.dominant,
            transitionPhase: snapshot.transition?.transitionPhase ?? null,
            cameraBlendWeight: snapshot.transition?.cameraBlendWeight ?? 0,
            mainProjectedBounds: snapshot.composition?.media.main.screen ?? null,
            secondaryProjectedBounds: snapshot.composition?.media.secondary.screen ?? null,
            mainFrustumVisible: snapshot.composition?.media.main.frustumVisible ?? false,
            secondaryFrustumVisible: snapshot.composition?.media.secondary.frustumVisible ?? false,
            mediaProjection: snapshot.composition?.media.projection ?? null,
            sectionRects: await readSectionRects(page),
            canvasCount: await page.locator("canvas.webgl-canvas").count(),
            drawCalls: snapshot.render.drawCalls,
            textureCount: snapshot.render.textureCount,
            geometryCount: snapshot.render.geometryCount,
            screenshot: path.relative(ARTIFACT_ROOT, screenshotPath).replaceAll("\\", "/"),
          });

          expect(Math.abs(actualProgress - requestedProgress)).toBeLessThanOrEqual(0.01);
          expect(snapshot.composition?.media.main.rendered).toBe(true);
          expect(snapshot.composition?.media.secondary.rendered).toBe(true);
          expect(await page.locator("canvas.webgl-canvas").count()).toBe(1);
          await page.waitForTimeout(400);
        }

        for (const reverseProgress of [0.66, 0.44, 0.22, 0.1] as const) {
          await seekMediaProgress(page, reverseProgress);
          await page.waitForTimeout(300);
        }
        await animateScrollTo(page, 0, 700);
        await animateScrollTo(page, await readMaxScrollY(page), 1_300);
        await animateScrollTo(page, 0, 1_300);
        await animateScrollTo(page, await readMaxScrollY(page), 260);
        await animateScrollTo(page, 0, 260);

        await saveSessionVideo(
          context,
          page,
          video,
          path.join(VIDEO_ROOT, `${viewport.name}-${mode}-forward-reverse-fast.webm`),
        );
      }

      for (const canvasOnly of [false, true]) {
        const mode = canvasOnly ? "canvas-only" : "composited";
        const session = await createRecordedSession(browser, viewport, true);
        const { context, page, video } = session;
        await preparePage(page, canvasOnly);
        const before = await getProbeSnapshot(page);
        await animateScrollTo(page, await readMaxScrollY(page), 1_500);
        const forward = await getProbeSnapshot(page);
        await animateScrollTo(page, 0, 1_500);
        const reverse = await getProbeSnapshot(page);
        reducedMotion[`${viewport.name}-${mode}`] = {
          before: summarizeReducedMotion(before),
          forward: summarizeReducedMotion(forward),
          reverse: summarizeReducedMotion(reverse),
        };
        await saveSessionVideo(
          context,
          page,
          video,
          path.join(VIDEO_ROOT, `${viewport.name}-${mode}-reduced-motion.webm`),
        );
      }
    }

    await writeFile(
      path.join(ARTIFACT_ROOT, "verified-validation-snapshots.json"),
      `${JSON.stringify({
        generatedAt: new Date().toISOString(),
        progressTolerance: 0.01,
        evidence: evidenceEntries,
        heroRegistration,
        reducedMotion,
      }, null, 2)}\n`,
      "utf8",
    );
  });
});

async function createRecordedSession(
  browser: Browser,
  viewport: ViewportCase,
  reducedMotion: boolean,
) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    reducedMotion: reducedMotion ? "reduce" : "no-preference",
    recordVideo: {
      dir: RAW_VIDEO_ROOT,
      size: { width: viewport.width, height: viewport.height },
    },
  });
  const page = await context.newPage();
  const video = page.video();
  if (!video) {
    throw new Error("Playwright video recording was not created.");
  }
  return { context, page, video };
}

async function preparePage(page: Page, canvasOnly: boolean): Promise<void> {
  await page.goto("/");
  await waitForProbe(page);
  await expect(page.locator("canvas.webgl-canvas")).toHaveCount(1);
  if (canvasOnly) {
    await page.addStyleTag({
      content: [
        ".experience-main, #site-content, .site-header, .site-footer, .menu-overlay {",
        "  visibility: hidden !important;",
        "}",
        ".webgl-root, .webgl-root * {",
        "  visibility: visible !important;",
        "}",
      ].join("\n"),
    });
  }
  await settleFrames(page, 12);
}

async function waitForProbe(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const probe = (window as unknown as {
      __editorialWebGLProbe?: { snapshot?: () => unknown };
    }).__editorialWebGLProbe;
    return typeof probe?.snapshot === "function";
  });
}

async function getProbeSnapshot(page: Page): Promise<RuntimeProbeSnapshot> {
  return page.evaluate(() => {
    const probe = (window as unknown as {
      __editorialWebGLProbe?: { snapshot: () => RuntimeProbeSnapshot };
    }).__editorialWebGLProbe;
    if (!probe) {
      throw new Error("WebGL probe is not available.");
    }
    return probe.snapshot();
  });
}

async function seekMediaProgress(
  page: Page,
  requestedProgress: number,
): Promise<RuntimeProbeSnapshot> {
  return seekChapterProgress(page, "media-scene", "mediaProgress", requestedProgress);
}

async function seekChapterProgress(
  page: Page,
  sceneId: "hero-scene" | "media-scene",
  progressKey: "chapterProgress" | "mediaProgress",
  requestedProgress: number,
): Promise<RuntimeProbeSnapshot> {
  const target = Math.max(0, Math.min(1, requestedProgress));
  const geometry = await page.evaluate(({ targetSceneId }) => {
    const section = document.getElementById(
      targetSceneId === "hero-scene" ? "hero" : "media",
    );
    if (!section) {
      throw new Error(`${targetSceneId} DOM anchor is unavailable.`);
    }
    const rect = section.getBoundingClientRect();
    return {
      viewportHeight: window.innerHeight,
      sectionHeight: Math.max(1, rect.height),
      anchorDocumentTop: Math.max(0, rect.top + window.scrollY),
    };
  }, { targetSceneId: sceneId });

  const initialWindow = resolveProgressScrollWindow(
    sceneId,
    progressKey,
    geometry.viewportHeight,
    geometry.sectionHeight,
  );

  await scrollToAndWait(
    page,
    geometry.anchorDocumentTop +
      initialWindow.startRelativeScroll +
      initialWindow.span * target,
  );

  let lastSnapshot = await getProbeSnapshot(page);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const scene = lastSnapshot.diagnostics.sceneSnapshots[sceneId];
    const actual = scene?.[progressKey];
    const satisfiesDirectionalBoundary =
      sceneId !== "media-scene" || target !== 0.72 || (actual ?? 0) >= target;
    if (
      Number.isFinite(actual) &&
      Math.abs((actual ?? 0) - target) <= 0.01 &&
      satisfiesDirectionalBoundary
    ) {
      await settleFrames(page, 4);
      return getProbeSnapshot(page);
    }

    if (!Number.isFinite(actual)) {
      await settleFrames(page, 2);
      lastSnapshot = await getProbeSnapshot(page);
      continue;
    }

    const progressWindow = resolveProgressScrollWindow(
      sceneId,
      progressKey,
      geometry.viewportHeight,
      geometry.sectionHeight,
    );
    const rawCorrection =
      (target - (actual ?? 0)) * progressWindow.span;
    const correction =
      sceneId === "media-scene" && target === 0.72 && (actual ?? 0) < target
        ? Math.max(1, rawCorrection)
        : rawCorrection;
    const targetScrollY =
      geometry.anchorDocumentTop +
      progressWindow.startRelativeScroll +
      progressWindow.span * target;
    const currentScrollY = await page.evaluate(() => window.scrollY);
    await scrollToAndWait(
      page,
      Math.abs(correction) >= 0.5 ? targetScrollY + correction : currentScrollY,
    );
    lastSnapshot = await getProbeSnapshot(page);
  }

  const actual =
    lastSnapshot.diagnostics.sceneSnapshots[sceneId]?.[progressKey] ?? Number.NaN;
  throw new Error(
    `Unable to seek ${sceneId}.${progressKey}: requested=${target}, actual=${actual}.`,
  );
}

function resolveProgressScrollWindow(
  sceneId: "hero-scene" | "media-scene",
  progressKey: "chapterProgress" | "mediaProgress",
  viewportHeight: number,
  sectionHeight: number,
): ProgressScrollWindow {
  if (sceneId === "media-scene" && progressKey === "mediaProgress") {
    const anchorCenterExitTop = sectionHeight * 0.5;
    const anchorCenterEnterBottom = Math.max(0, anchorCenterExitTop - viewportHeight);
    return {
      startRelativeScroll: anchorCenterEnterBottom,
      span: Math.max(1, anchorCenterExitTop - anchorCenterEnterBottom),
    };
  }

  return {
    startRelativeScroll: 0,
    span: viewportHeight + sectionHeight,
  };
}

async function scrollToAndWait(page: Page, scrollY: number): Promise<void> {
  await page.evaluate((targetScrollY) => {
    const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({
      top: Math.max(0, Math.min(targetScrollY, maxScrollY)),
      behavior: "auto",
    });
  }, scrollY);
  await settleFrames(page, 3);
}

async function settleFrames(page: Page, count: number): Promise<void> {
  await page.evaluate((frameCount) => new Promise<void>((resolve) => {
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
  }), count);
}

async function animateScrollTo(page: Page, targetScrollY: number, durationMs: number): Promise<void> {
  await page.evaluate(({ target, duration }) => new Promise<void>((resolve) => {
    const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const startScrollY = window.scrollY;
    const endScrollY = Math.max(0, Math.min(target, maxScrollY));
    const startTime = performance.now();
    const tick = (time: number): void => {
      const linear = Math.min(1, (time - startTime) / Math.max(1, duration));
      const eased = linear < 0.5
        ? 4 * linear * linear * linear
        : 1 - Math.pow(-2 * linear + 2, 3) / 2;
      window.scrollTo({ top: startScrollY + (endScrollY - startScrollY) * eased });
      if (linear >= 1) {
        resolve();
        return;
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }), { target: targetScrollY, duration: durationMs });
  await settleFrames(page, 6);
}

async function readMaxScrollY(page: Page): Promise<number> {
  return page.evaluate(() =>
    Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
  );
}

async function readSectionRects(
  page: Page,
): Promise<Readonly<Record<string, DOMRectRecord | null>>> {
  return page.evaluate(() => Object.fromEntries(
    ["media", "about", "news", "quote"].map((id) => {
      const element = document.getElementById(id);
      if (!element) {
        return [id, null];
      }
      const rect = element.getBoundingClientRect();
      return [id, {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      }];
    }),
  ));
}

function summarizeReducedMotion(snapshot: RuntimeProbeSnapshot): unknown {
  return {
    dominantSceneId: snapshot.scenes.dominant,
    transitionPhase: snapshot.transition?.transitionPhase ?? null,
    cameraBlendWeight: snapshot.transition?.cameraBlendWeight ?? 0,
    hero: snapshot.diagnostics.sceneSnapshots["hero-scene"] ?? null,
    media: snapshot.diagnostics.sceneSnapshots["media-scene"] ?? null,
    canvasCountExpected: 1,
  };
}

async function saveSessionVideo(
  context: Awaited<ReturnType<Browser["newContext"]>>,
  page: Page,
  video: NonNullable<ReturnType<Page["video"]>>,
  destination: string,
): Promise<void> {
  await page.close();
  await video.saveAs(destination);
  await context.close();
}
