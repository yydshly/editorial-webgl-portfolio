import { expect, test } from "@playwright/test";
import type { Browser, Page } from "@playwright/test";
import { DEFAULT_CAMERA_HANDOFF_POLICY } from "@/lib/webgl/SceneDirector";
import { MEDIA_MOTION_CONFIG } from "@/lib/webgl/media/MediaSceneMotion";
import { mediaSceneConfig } from "@/lib/webgl/media/mediaSceneConfig";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

type SceneProgressGeometry = {
  readonly viewportHeight: number;
  readonly heroHeight: number;
  readonly mediaHeight: number;
  readonly heroDocumentTop: number;
  readonly mediaDocumentTop: number;
};

type SceneProgressKey =
  | "chapterProgress"
  | "lifecycleChapterProgress"
  | "mediaProgress"
  | "lifecycleMediaProgress";

type MediaProgressSeekContext = {
  readonly viewportHeight: number;
  readonly sectionHeight: number;
  readonly currentScrollY: number;
  readonly anchorDocumentTop: number;
  readonly relativeScroll: number;
};

type ProgressScrollWindow = {
  readonly startRelativeScroll: number;
  readonly span: number;
};

/**
 * Preferred ranges are composition-tuning targets. Hard acceptance ranges
 * protect legibility against sub-pixel projection variance without changing
 * the approved product composition.
 */
const MEDIA_SECONDARY_EXPOSURE_CONTRACT = {
  desktop: {
    preferredDesignRange: { minimum: 0.18, maximum: 0.24 },
    hardAcceptanceRange: { minimum: 0.18, maximum: 0.24 },
  },
  mobile: {
    preferredDesignRange: { minimum: 0.28, maximum: 0.29 },
    hardAcceptanceRange: { minimum: 0.28, maximum: 0.3 },
  },
} as const;

type SceneTransitionSnapshot = {
  readonly fromSceneId: string | null;
  readonly toSceneId: string | null;
  readonly transitionPhase: "idle" | "preload" | "overlap" | "handoff" | "replace" | "cache";
  readonly handoffProgress: number;
  readonly cameraBlendWeight: number;
  readonly dominantSceneId: string | null;
  readonly cameraIntentSceneId: string | null;
};

type WebGLSnapshot = {
  readonly domSubjectVisible?: boolean;
  readonly scenes: {
    readonly total: number;
    readonly dominant: string | null;
    readonly active: string | null;
  };
  readonly render: {
    readonly drawCalls: number;
    readonly geometryCount: number;
    readonly textureCount: number;
    readonly frameIntervalMs: number;
    readonly frameTimeMs: number;
    readonly renderSubmitCostMs: number;
    readonly isLowUpdateMode: boolean;
    readonly tierProfile: {
      readonly frameDivisor: number;
    };
  };
  readonly transition: SceneTransitionSnapshot | null;
  readonly composition: {
    readonly rendererOwner: "global-webgl-stage";
    readonly camera: {
      readonly position: { readonly x: number; readonly y: number; readonly z: number };
      readonly target: { readonly x: number; readonly y: number; readonly z: number };
      readonly fov: number;
    };
    readonly hero: {
      readonly portrait: LayerCompositionSnapshot;
      readonly foreground: LayerCompositionSnapshot | null;
      readonly foregroundCrop?: {
        readonly sourceTextureSize: { readonly width: number; readonly height: number };
        readonly cropPixels: {
          readonly x: number;
          readonly y: number;
          readonly width: number;
          readonly height: number;
        };
        readonly uvOriginConvention: "top-left";
        readonly textureFlipY: boolean;
        readonly geometryAspect: number;
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
      readonly main: LayerCompositionSnapshot;
      readonly secondary: LayerCompositionSnapshot;
      readonly projection?: {
        readonly main: AnchorProjectionSnapshot;
        readonly secondary: AnchorProjectionSnapshot;
      };
    };
  } | null;
  readonly diagnostics: {
    readonly sceneStates: Readonly<Record<string, {
      readonly resident: boolean;
      readonly visible: boolean;
      readonly updating: boolean;
      readonly dominant: boolean;
      readonly cached: boolean;
      readonly disposed: boolean;
    } | null>>;
    readonly sceneSnapshots: Readonly<Record<string, {
      readonly chapterProgress?: number;
      readonly lifecycleChapterProgress?: number;
      readonly mediaProgress?: number;
      readonly lifecycleMediaProgress?: number;
      readonly relativeScroll?: number;
      readonly phase?: string;
      readonly visualReady?: boolean;
      readonly transform?: {
        readonly opacity: number;
        readonly scale: number;
      };
      readonly mainTransform?: {
        readonly translateX: number;
        readonly translateY: number;
        readonly scale: number;
        readonly opacity: number;
      };
      readonly secondaryTransform?: {
        readonly translateX: number;
        readonly translateY: number;
        readonly scale: number;
        readonly opacity: number;
      };
      readonly foregroundTransform?: {
        readonly opacity: number;
        readonly scale: number;
      };
    }>>;
    readonly assetOwnerCounts: Readonly<Record<string, number>>;
    readonly gpuResources: Readonly<Record<string, {
      readonly total: number;
      readonly byKind: {
        readonly texture: number;
        readonly geometry: number;
        readonly material: number;
      };
      readonly ownerCounts: Readonly<Record<string, number>>;
    } | null>>;
  };
};

type LayerCompositionSnapshot = {
  readonly rendered: boolean;
  readonly visible: boolean;
  readonly frustumVisible: boolean;
  readonly opacity?: number;
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly scale: { readonly x: number; readonly y: number; readonly z: number };
  readonly ndc: { readonly x: number; readonly y: number; readonly z: number };
  readonly ndcBounds: {
    readonly minX: number;
    readonly maxX: number;
    readonly minY: number;
    readonly maxY: number;
    readonly minZ: number;
    readonly maxZ: number;
  };
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

type AnchorProjectionSnapshot = {
  readonly anchorRectCenter: { readonly x: number; readonly y: number } | null;
  readonly expectedScreenCenter: { readonly x: number; readonly y: number } | null;
  readonly projectedScreenCenter: { readonly x: number; readonly y: number } | null;
  readonly deltaPx: { readonly x: number; readonly y: number } | null;
  readonly viewport: {
    readonly width: number;
    readonly height: number;
    readonly devicePixelRatio: number;
  };
};

type RafMonitor = {
  readonly scheduled: number;
  readonly executed: number;
  readonly maxConcurrent: number;
};

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
}

const PRELOAD_PROGRESS = 0.16;
const OVERLAP_PROGRESS = 0.28;
const MEDIA_REPLACE_PROGRESS = 0.72;
const MIN_WEBGL_RENDER_FRAMES = 30;
const FALLBACK_EVIDENCE_DIR = path.resolve("artifacts/p4-02.4a-r3");
const MEDIA_COMPOSITION_EVIDENCE_DIR = path.resolve(
  process.env.P4_02_4B_R3_EVIDENCE === "1"
    ? "artifacts/p4-02.4b-r3"
    : (process.env.P4_02_4B_R2_1_EVIDENCE === "1"
    ? "artifacts/p4-02.4b-r2.1"
    : (process.env.P4_02_4B_R1_EVIDENCE === "1" ? "artifacts/p4-02.4b-r1" : "artifacts/p4-02.4b")),
);
const ALLOWED_TRANSITION_PHASES: SceneTransitionSnapshot["transitionPhase"][] = [
  "idle",
  "preload",
  "overlap",
  "handoff",
  "replace",
  "cache",
];

test.use({
  contextOptions: {
    reducedMotion: "no-preference",
  },
});

function toScrollYForSceneProgress(
  geometry: SceneProgressGeometry,
  anchorDocumentTop: number,
  sectionHeight: number,
  sectionProgress: number,
): number {
  return Math.max(
    0,
    Math.floor(anchorDocumentTop + (geometry.viewportHeight + sectionHeight) * sectionProgress),
  );
}

async function scrollToAndWait(page: Page, scrollY: number): Promise<void> {
  await expect.poll(async () => page.evaluate((targetScrollY) => {
    const maxScrollY = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    const resolvedScrollY = Math.min(targetScrollY, maxScrollY);
    window.scrollTo({ top: resolvedScrollY, behavior: "auto" });
    return Math.abs(window.scrollY - resolvedScrollY);
  }, scrollY)).toBeLessThanOrEqual(1);

  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  }));
}

async function settleFrames(page: Page, count = 24): Promise<void> {
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

async function waitForWebGLProbe(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const probe = (window as unknown as { __trevorNoahWebGLProbe?: { snapshot: () => unknown } })
      .__trevorNoahWebGLProbe;
    return typeof probe?.snapshot === "function";
  });
}

async function waitForHeroRuntimeReady(page: Page): Promise<void> {
  await waitForTransitionState(
    page,
    (snapshot) =>
      snapshot.scenes.dominant === "hero-scene" &&
      snapshot.composition?.hero.portrait.rendered === true,
  );
}

async function getProbeSnapshot(page: Page): Promise<WebGLSnapshot> {
  return page.evaluate(() => {
    const probe = (window as unknown as {
      __trevorNoahWebGLProbe?: { snapshot: () => WebGLSnapshot };
    }).__trevorNoahWebGLProbe;

    if (!probe) {
      throw new Error("WebGL probe not available.");
    }

    return probe.snapshot();
  });
}

async function getSceneGeometry(page: Page): Promise<SceneProgressGeometry> {
  return page.evaluate(() => {
    const hero = document.getElementById("hero");
    const media = document.getElementById("media");

    if (!hero || !media) {
      throw new Error("Hero or media section not mounted.");
    }

    return {
      viewportHeight: window.innerHeight,
      heroHeight: Math.max(1, hero.getBoundingClientRect().height),
      mediaHeight: Math.max(1, media.getBoundingClientRect().height),
      heroDocumentTop: Math.max(0, hero.getBoundingClientRect().top + window.scrollY),
      mediaDocumentTop: Math.max(0, media.getBoundingClientRect().top + window.scrollY),
    };
  });
}

async function readCanvasPixelStats(page: Page): Promise<{
  readonly width: number;
  readonly height: number;
  readonly nonBackgroundPixels: number;
}> {
  return page.locator("canvas.webgl-canvas").evaluate((canvasElement) => new Promise((resolve) => {
    const canvas = canvasElement as HTMLCanvasElement;
    const context =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    if (!context || !("readPixels" in context)) {
      throw new Error("WebGL context is unavailable for pixel validation.");
    }

    window.requestAnimationFrame(() => {
      const gl = context as WebGLRenderingContext;
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      let nonBackgroundPixels = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        const colorDistance =
          Math.abs(pixels[index] - 14) +
          Math.abs(pixels[index + 1] - 15) +
          Math.abs(pixels[index + 2] - 21);
        if (pixels[index + 3] > 0 && colorDistance > 24) {
          nonBackgroundPixels += 1;
        }
      }

      resolve({
        width,
        height,
        nonBackgroundPixels,
      });
    });
  }));
}

async function readMediaFallbackImageState(page: Page): Promise<{
  readonly count: number;
  readonly states: ReadonlyArray<{
    readonly slot: string;
    readonly opacity: string;
    readonly contract: string | null;
  }>;
}> {
  return page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll("img[data-media-fallback='true']"));
    return {
      count: nodes.length,
      states: nodes.map((node) => ({
        slot: node.getAttribute("data-media-fallback-slot") ?? "unknown",
        opacity: window.getComputedStyle(node).opacity,
        contract: (node as HTMLImageElement).dataset.mediaFallbackState ?? null,
      })),
    };
  });
}

async function readMediaCompositionLayout(page: Page): Promise<{
  readonly viewport: { readonly width: number; readonly height: number };
  readonly scrollWidth: number;
  readonly media: { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number } | null;
  readonly manifestoVisibleArea: number;
  readonly reading: { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number } | null;
  readonly readingOpacity: string | null;
  readonly title: { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number } | null;
  readonly body: { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number } | null;
  readonly cta: { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number } | null;
}> {
  return page.evaluate(() => {
    const media = document.getElementById("media");
    const manifesto = document.getElementById("manifesto");
    const reading = document.querySelector<HTMLElement>("#media [data-media-reading='true']");
    const title = document.querySelector<HTMLElement>("#media [data-media-title='true']");
    const body = document.querySelector<HTMLElement>("#media [data-media-body='true']");
    const cta = document.querySelector<HTMLElement>("#media [data-media-cta='true']");
    const rect = (node: HTMLElement | null) => node
      ? (() => {
        const value = node.getBoundingClientRect();
        return { left: value.left, right: value.right, top: value.top, bottom: value.bottom };
      })()
      : null;
    const visibleArea = (node: HTMLElement | null) => {
      if (!node) return 0;
      const value = node.getBoundingClientRect();
      return Math.max(0, Math.min(window.innerWidth, value.right) - Math.max(0, value.left)) *
        Math.max(0, Math.min(window.innerHeight, value.bottom) - Math.max(0, value.top));
    };

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      scrollWidth: document.documentElement.scrollWidth,
      media: rect(media),
      manifestoVisibleArea: visibleArea(manifesto),
      reading: rect(reading),
      readingOpacity: reading ? window.getComputedStyle(reading).opacity : null,
      title: rect(title),
      body: rect(body),
      cta: rect(cta),
    };
  });
}

function allFallbackVisible(states: ReadonlyArray<{ readonly opacity: string }>): boolean {
  return states.every((state) => state.opacity === "1");
}

function isMediaWebGLLayerVisible(snapshot: WebGLSnapshot | null): boolean {
  return Boolean(
    snapshot?.composition?.media?.main?.visible ||
      snapshot?.composition?.media?.secondary?.visible,
  );
}

function isDOMOnlyInterlude(snapshot: WebGLSnapshot | null): boolean {
  return snapshot?.transition?.cameraIntentSceneId === "global-idle";
}

function hasRecognizableSubject(snapshot: WebGLSnapshot | null): boolean {
  return isRecognizableLayer(snapshot?.composition?.hero.portrait) ||
    isRecognizableLayer(snapshot?.composition?.media.main) ||
    isRecognizableLayer(snapshot?.composition?.media.secondary) ||
    snapshot?.domSubjectVisible === true ||
    isDOMOnlyInterlude(snapshot);
}

async function snapshotAfterMediaProgress(
  page: Page,
  geometry: SceneProgressGeometry,
  mediaProgress: number,
): Promise<WebGLSnapshot> {
  return seekMediaProgress(page, geometry, mediaProgress);
}

async function seekMediaProgress(
  page: Page,
  geometry: SceneProgressGeometry,
  requestedProgress: number,
  tolerance = 0.01,
): Promise<WebGLSnapshot> {
  return seekChapterProgress(page, "media-scene", "mediaProgress", requestedProgress, tolerance);
}

async function seekChapterProgress(
  page: Page,
  sceneId: "hero-scene" | "media-scene",
  progressKey: SceneProgressKey,
  requestedProgress: number,
  tolerance = 0.01,
): Promise<WebGLSnapshot> {
  const target = Math.max(0, Math.min(1, requestedProgress));
  const initialContext = await page.evaluate(
    ({ scene }) => {
      const anchor = document.getElementById(scene === "hero-scene" ? "hero" : "media");
      if (!anchor) {
        throw new Error(`${scene} anchor is unavailable.`);
      }
      const rect = anchor.getBoundingClientRect();
      const anchorDocumentTop = rect.top + window.scrollY;
      return {
        viewportHeight: Math.max(1, window.innerHeight),
        sectionHeight: Math.max(1, rect.height),
        currentScrollY: Math.max(0, window.scrollY),
        anchorDocumentTop: Math.max(0, anchorDocumentTop),
      };
    },
    { scene: sceneId },
  );

  const readSeekContext = async (): Promise<MediaProgressSeekContext> => page.evaluate(
    ({ scene }) => {
      const anchor = document.getElementById(scene === "hero-scene" ? "hero" : "media");
      if (!anchor) {
        throw new Error(`${scene} anchor is unavailable.`);
      }
      const rect = anchor.getBoundingClientRect();
      const anchorDocumentTop = rect.top + window.scrollY;
      return {
        viewportHeight: Math.max(1, window.innerHeight),
        sectionHeight: Math.max(1, rect.height),
        currentScrollY: Math.max(0, window.scrollY),
        anchorDocumentTop: Math.max(0, anchorDocumentTop),
        relativeScroll: Math.max(0, window.scrollY - anchorDocumentTop),
      };
    },
    { scene: sceneId },
  );

  const initialWindow = resolveProgressScrollWindow(sceneId, progressKey, initialContext);
  const baselineProgressScrollY =
    initialContext.anchorDocumentTop +
    initialWindow.startRelativeScroll +
    initialWindow.span * target;

  await scrollToAndWait(page, baselineProgressScrollY);

  let lastSnapshot = await getProbeSnapshot(page);
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const mediaScene = lastSnapshot.diagnostics.sceneSnapshots[sceneId];
    const actual = mediaScene?.[progressKey];
    const satisfiesDirectionalBoundary =
      sceneId !== "media-scene" || target !== 0.72 || (actual ?? 0) >= target;
    if (Number.isFinite(actual)) {
      const actualProgress = actual ?? target;
      if (Math.abs(actualProgress - target) <= tolerance && satisfiesDirectionalBoundary) {
        await settleFrames(page, 8);
        return getProbeSnapshot(page);
      }
    } else {
      await settleFrames(page, 3);
      lastSnapshot = await getProbeSnapshot(page);
      continue;
    }

    const context = await readSeekContext();
    const progressWindow = resolveProgressScrollWindow(sceneId, progressKey, context);
    const safeActual = actual ?? target;
    const rawCorrection = (target - safeActual) * progressWindow.span;
    const correction =
      sceneId === "media-scene" && target === 0.72 && safeActual < target
        ? Math.max(1, rawCorrection)
        : rawCorrection;
    const minStep = 0.5;
    const targetScrollY =
      context.anchorDocumentTop +
      progressWindow.startRelativeScroll +
      target * progressWindow.span;
    const nextScrollY = Math.abs(correction) >= minStep
      ? Math.max(0, targetScrollY + correction)
      : context.currentScrollY;

    await scrollToAndWait(page, nextScrollY);
    lastSnapshot = await getProbeSnapshot(page);
  }

  throw new Error(
    `Unable to seek ${sceneId}.${progressKey} ${target} within ${tolerance}. ` +
    `Actual: ${lastSnapshot.diagnostics.sceneSnapshots[sceneId]?.[progressKey] ?? Number.NaN}; ` +
    `snapshot: ${JSON.stringify(lastSnapshot)}`,
  );
}

function resolveProgressScrollWindow(
  sceneId: "hero-scene" | "media-scene",
  progressKey: SceneProgressKey,
  context: Pick<MediaProgressSeekContext, "viewportHeight" | "sectionHeight">,
): ProgressScrollWindow {
  if (
    sceneId === "media-scene" &&
    (progressKey === "mediaProgress" || progressKey === "lifecycleMediaProgress")
  ) {
    const anchorCenterExitTop = context.sectionHeight * 0.5;
    const anchorCenterEnterBottom = Math.max(0, anchorCenterExitTop - context.viewportHeight);
    return {
      startRelativeScroll: anchorCenterEnterBottom,
      span: Math.max(1, anchorCenterExitTop - anchorCenterEnterBottom),
    };
  }

  return {
    startRelativeScroll: 0,
    span: context.sectionHeight + context.viewportHeight,
  };
}

function resolveScrollYForProgress(
  geometry: SceneProgressGeometry,
  sceneId: "hero-scene" | "media-scene",
  progressKey: SceneProgressKey,
  progress: number,
): number {
  const clamped = Math.max(0, Math.min(1, progress));
  if (sceneId === "media-scene" && (progressKey === "mediaProgress" || progressKey === "lifecycleMediaProgress")) {
    const anchorCenterExitTop = geometry.mediaHeight * 0.5;
    const anchorCenterEnterBottom = Math.max(0, anchorCenterExitTop - geometry.viewportHeight);
    const span = Math.max(1, anchorCenterExitTop - anchorCenterEnterBottom);
    return Math.max(0, Math.floor(geometry.mediaDocumentTop + anchorCenterEnterBottom + span * clamped));
  }

  return Math.max(
    0,
    Math.floor(
      geometry.heroDocumentTop +
      (geometry.viewportHeight + geometry.heroHeight) * clamped,
    ),
  );
}

async function captureImmediateScrollFrames(
  page: Page,
  scrollY: number,
  frameCount = 4,
): Promise<ReadonlyArray<WebGLSnapshot>> {
  return page.evaluate(async ({ targetScrollY, captureCount }) => {
    const probe = (window as unknown as {
      __trevorNoahWebGLProbe?: { snapshot: () => WebGLSnapshot };
    }).__trevorNoahWebGLProbe;
    if (!probe) {
      throw new Error("WebGL probe not available.");
    }

    window.scrollTo({ top: targetScrollY, behavior: "auto" });

    const domSubjectVisible = (): boolean => Array.from(
      document.querySelectorAll<HTMLElement>("section h1, section h2, img[data-media-fallback='true']"),
    ).some((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.04 &&
        rect.right > 0 && rect.left < window.innerWidth && rect.bottom > 0 && rect.top < window.innerHeight &&
        rect.width * rect.height >= 64;
    });

    return new Promise<ReadonlyArray<WebGLSnapshot>>((resolve) => {
      const samples: WebGLSnapshot[] = [];
      const capture = (): void => {
        samples.push({ ...probe.snapshot(), domSubjectVisible: domSubjectVisible() });
        if (samples.length >= captureCount) {
          resolve(samples);
          return;
        }
        window.requestAnimationFrame(capture);
      };
      window.requestAnimationFrame(capture);
    });
  }, { targetScrollY: scrollY, captureCount: frameCount });
}

async function captureScrollTimeline(
  page: Page,
  startScrollY: number,
  endScrollY: number,
  frameCount = 96,
): Promise<ReadonlyArray<WebGLSnapshot>> {
  return page.evaluate(async ({ start, end, captureCount }) => {
    const probe = (window as unknown as {
      __trevorNoahWebGLProbe?: { snapshot: () => WebGLSnapshot };
    }).__trevorNoahWebGLProbe;
    if (!probe) {
      throw new Error("WebGL probe not available.");
    }

    const nextFrame = (): Promise<void> => new Promise((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

    window.scrollTo({ top: start, behavior: "auto" });
    await nextFrame();
    await nextFrame();

    const domSubjectVisible = (): boolean => Array.from(
      document.querySelectorAll<HTMLElement>("section h1, section h2, img[data-media-fallback='true']"),
    ).some((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.04 &&
        rect.right > 0 && rect.left < window.innerWidth && rect.bottom > 0 && rect.top < window.innerHeight &&
        rect.width * rect.height >= 64;
    });

    const snapshots: WebGLSnapshot[] = [];
    for (let index = 1; index <= captureCount; index += 1) {
      const progress = index / captureCount;
      window.scrollTo({
        top: start + (end - start) * progress,
        behavior: "auto",
      });
      await nextFrame();
      snapshots.push({ ...probe.snapshot(), domSubjectVisible: domSubjectVisible() });
    }

    return snapshots;
  }, { start: startScrollY, end: endScrollY, captureCount: frameCount });
}

async function captureRecordedScrollTimeline(
  page: Page,
  startScrollY: number,
  endScrollY: number,
  frameCount = 96,
  frameDelayMs = 28,
): Promise<ReadonlyArray<WebGLSnapshot>> {
  await page.evaluate((scrollY) => window.scrollTo({ top: scrollY, behavior: "auto" }), startScrollY);
  await page.waitForTimeout(280);

  const snapshots: WebGLSnapshot[] = [];
  for (let index = 1; index <= frameCount; index += 1) {
    const progress = index / frameCount;
    await page.evaluate(({ start, end, ratio }) => {
      window.scrollTo({ top: start + (end - start) * ratio, behavior: "auto" });
    }, { start: startScrollY, end: endScrollY, ratio: progress });
    await page.waitForTimeout(frameDelayMs);
    if (index % 12 === 0 || index === frameCount) {
      snapshots.push(await getProbeSnapshot(page));
    }
  }

  await page.waitForTimeout(320);
  return snapshots;
}

async function captureCompositionFrameSequence(
  page: Page,
  outputDirectory: string,
  startScrollY: number,
  endScrollY: number,
  frameCount = 24,
): Promise<void> {
  await mkdir(outputDirectory, { recursive: true });
  await page.evaluate((scrollY) => window.scrollTo({ top: scrollY, behavior: "auto" }), startScrollY);
  await page.waitForTimeout(160);

  for (let index = 0; index < frameCount; index += 1) {
    const ratio = frameCount <= 1 ? 1 : index / (frameCount - 1);
    await page.evaluate(({ start, end, progress }) => {
      window.scrollTo({ top: start + (end - start) * progress, behavior: "auto" });
    }, { start: startScrollY, end: endScrollY, progress: ratio });
    await page.waitForTimeout(72);
    await page.screenshot({
      path: path.join(outputDirectory, `frame-${index.toString().padStart(3, "0")}.png`),
      fullPage: false,
    });
  }
}

async function captureNamedScreenshot(page: Page, filename: string): Promise<string> {
  await mkdir(FALLBACK_EVIDENCE_DIR, { recursive: true });
  const snapshotPath = path.join(FALLBACK_EVIDENCE_DIR, filename);
  await page.screenshot({ path: snapshotPath, fullPage: true });
  return snapshotPath;
}

type MediaCompositionCaptureBounds = {
  readonly viewport: { readonly width: number; readonly height: number };
  readonly layers: ReadonlyArray<{
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  }>;
};

async function readCanvasFrame(page: Page): Promise<{
  readonly width: number;
  readonly height: number;
  readonly rgbaBase64: string;
}> {
  return page.locator("canvas.webgl-canvas").evaluate((canvasElement) => new Promise((resolve, reject) => {
    const canvas = canvasElement as HTMLCanvasElement;
    const context =
      canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl");
    if (!context || !("readPixels" in context)) {
      reject(new Error("WebGL context is unavailable for visual evidence."));
      return;
    }

    window.requestAnimationFrame(() => {
      const gl = context as WebGLRenderingContext;
      const width = gl.drawingBufferWidth;
      const height = gl.drawingBufferHeight;
      const pixels = new Uint8Array(width * height * 4);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let binary = "";
      const chunkSize = 0x8000;
      for (let offset = 0; offset < pixels.length; offset += chunkSize) {
        binary += String.fromCharCode(...pixels.subarray(offset, offset + chunkSize));
      }
      resolve({
        width,
        height,
        rgbaBase64: btoa(binary),
      });
    });
  }));
}

async function captureMediaCompositionScreenshot(
  page: Page,
  filename: string,
  compositionBounds?: MediaCompositionCaptureBounds,
): Promise<string> {
  await mkdir(MEDIA_COMPOSITION_EVIDENCE_DIR, { recursive: true });
  const screenshotPath = path.join(MEDIA_COMPOSITION_EVIDENCE_DIR, filename);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  if (!compositionBounds || compositionBounds.layers.length === 0) {
    return screenshotPath;
  }

  const [screenshotMetadata, canvasFrame] = await Promise.all([
    sharp(screenshotPath).metadata(),
    readCanvasFrame(page),
  ]);
  const screenshotWidth = screenshotMetadata.width ?? compositionBounds.viewport.width;
  const screenshotHeight = screenshotMetadata.height ?? compositionBounds.viewport.height;
  const scale = screenshotWidth / compositionBounds.viewport.width;
  const padding = Math.ceil(6 * scale);
  const left = Math.max(0, Math.floor(Math.min(...compositionBounds.layers.map((layer) => layer.left)) * scale) - padding);
  const top = Math.max(0, Math.floor(Math.min(...compositionBounds.layers.map((layer) => layer.top)) * scale) - padding);
  const right = Math.min(screenshotWidth, Math.ceil(Math.max(...compositionBounds.layers.map((layer) => layer.right)) * scale) + padding);
  const bottom = Math.min(screenshotHeight, Math.ceil(Math.max(...compositionBounds.layers.map((layer) => layer.bottom)) * scale) + padding);

  const framePng = await sharp(Buffer.from(canvasFrame.rgbaBase64, "base64"), {
    raw: {
      width: canvasFrame.width,
      height: canvasFrame.height,
      channels: 4,
    },
  })
    .flip()
    .resize(screenshotWidth, screenshotHeight)
    .png()
    .toBuffer();
  const layerPixels = await sharp(framePng)
    .extract({ left, top, width: right - left, height: bottom - top })
    .png()
    .toBuffer();
  const composited = await sharp(screenshotPath)
    .composite([{ input: layerPixels, left, top }])
    .png()
    .toBuffer();
  await writeFile(screenshotPath, composited);
  return screenshotPath;
}

async function countVisibleMediaPixelsInScreenshot(
  screenshotPath: string,
  bounds: { readonly left: number; readonly right: number; readonly top: number; readonly bottom: number },
  viewport: { readonly width: number; readonly height: number },
): Promise<number> {
  const image = sharp(screenshotPath);
  const metadata = await image.metadata();
  const scale = Math.max(1, (metadata.width ?? viewport.width) / viewport.width);
  const width = Math.max(1, Math.round((bounds.right - bounds.left) * scale));
  const height = Math.max(1, Math.round((bounds.bottom - bounds.top) * scale));
  const { data } = await image
    .extract({
      left: Math.max(0, Math.round(bounds.left * scale)),
      top: Math.max(0, Math.round(bounds.top * scale)),
      width,
      height,
    })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let visiblePixels = 0;
  for (let index = 0; index < data.length; index += 3) {
    const red = data[index];
    const green = data[index + 1];
    const blue = data[index + 2];
    const channelPeak = Math.max(red, green, blue);
    const channelSpread = channelPeak - Math.min(red, green, blue);
    if (channelPeak > 60 && channelSpread > 12) {
      visiblePixels += 1;
    }
  }

  return visiblePixels;
}

function expectLayerInClipSpace(name: string, layer: LayerCompositionSnapshot): void {
  const evidence = `${name}: ${JSON.stringify(layer)}`;
  expect(layer.rendered).toBe(true);
  expect(layer.visible).toBe(true);
  expect(layer.frustumVisible, evidence).toBe(true);
  expect(Number.isFinite(layer.position.x)).toBe(true);
  expect(Number.isFinite(layer.position.y)).toBe(true);
  expect(Number.isFinite(layer.position.z)).toBe(true);
  expect(layer.scale.x).toBeGreaterThan(0);
  expect(layer.scale.y).toBeGreaterThan(0);
  expect(layer.ndcBounds.maxX, evidence).toBeGreaterThanOrEqual(-1);
  expect(layer.ndcBounds.minX, evidence).toBeLessThanOrEqual(1);
  expect(layer.ndcBounds.maxY, evidence).toBeGreaterThanOrEqual(-1);
  expect(layer.ndcBounds.minY, evidence).toBeLessThanOrEqual(1);
  expect(layer.ndcBounds.maxZ, evidence).toBeGreaterThanOrEqual(-1);
  expect(layer.ndcBounds.minZ, evidence).toBeLessThanOrEqual(1);
}

function expectLayerSubmitted(name: string, layer: LayerCompositionSnapshot): void {
  const evidence = `${name}: ${JSON.stringify(layer)}`;
  expect(layer.rendered, evidence).toBe(true);
  expect(layer.visible, evidence).toBe(true);
  expect(Number.isFinite(layer.position.x), evidence).toBe(true);
  expect(Number.isFinite(layer.position.y), evidence).toBe(true);
  expect(Number.isFinite(layer.position.z), evidence).toBe(true);
  expect(layer.scale.x, evidence).toBeGreaterThan(0);
  expect(layer.scale.y, evidence).toBeGreaterThan(0);
  expect(layer.screen, evidence).toBeDefined();
}

function expectProjectionAligned(name: string, projection: AnchorProjectionSnapshot): void {
  const evidence = `${name}: ${JSON.stringify(projection)}`;
  expect(projection.anchorRectCenter, evidence).not.toBeNull();
  expect(projection.expectedScreenCenter, evidence).not.toBeNull();
  expect(projection.projectedScreenCenter, evidence).not.toBeNull();
  expect(projection.deltaPx, evidence).not.toBeNull();
  expect(Math.abs(projection.deltaPx?.x ?? Number.POSITIVE_INFINITY), evidence).toBeLessThanOrEqual(1);
  expect(Math.abs(projection.deltaPx?.y ?? Number.POSITIVE_INFINITY), evidence).toBeLessThanOrEqual(1);
}

function computeLayerScreenArea(layer: LayerCompositionSnapshot | null | undefined): number {
  if (!layer?.screen) {
    return 0;
  }

  const width = Math.max(0, layer.screen.bounds.right - layer.screen.bounds.left);
  const height = Math.max(0, layer.screen.bounds.bottom - layer.screen.bounds.top);
  return width * height;
}

function resolveSecondaryExposureRatio(
  main: LayerCompositionSnapshot,
  secondary: LayerCompositionSnapshot,
): number {
  const mainBounds = main.screen?.bounds;
  const secondaryBounds = secondary.screen?.bounds;
  if (!mainBounds || !secondaryBounds) {
    return Number.NaN;
  }

  const mainWidth = Math.max(0, mainBounds.right - mainBounds.left);
  if (mainWidth <= 0) {
    return Number.NaN;
  }

  return Math.max(0, mainBounds.left - secondaryBounds.left) / mainWidth;
}

function isRecognizableLayer(layer: LayerCompositionSnapshot | null | undefined): boolean {
  if (!layer || !layer.rendered || !layer.visible || !layer.frustumVisible) {
    return false;
  }
  if ((layer.opacity ?? 1) <= 0.04) {
    return false;
  }
  return computeLayerScreenArea(layer) >= 64;
}

type VisualVacuumMeasurement = {
  readonly longestRunFrames: number;
  readonly longestRunDurationMs: number;
  readonly firstVacuumFrame: number | null;
  readonly firstVacuumSnapshot: WebGLSnapshot | null;
};

function measureVisualVacuum(
  frames: ReadonlyArray<WebGLSnapshot>,
): VisualVacuumMeasurement {
  let longestRunFrames = 0;
  let longestRunDurationMs = 0;
  let currentRunFrames = 0;
  let currentRunDurationMs = 0;
  let firstVacuumFrame: number | null = null;
  let firstVacuumSnapshot: WebGLSnapshot | null = null;

  for (const [index, snapshot] of frames.entries()) {
    if (!hasRecognizableSubject(snapshot)) {
      if (firstVacuumFrame === null) {
        firstVacuumFrame = index;
        firstVacuumSnapshot = snapshot;
      }
      currentRunFrames += 1;
      currentRunDurationMs += Math.max(0, snapshot.render.frameTimeMs);
      longestRunFrames = Math.max(longestRunFrames, currentRunFrames);
      longestRunDurationMs = Math.max(longestRunDurationMs, currentRunDurationMs);
      continue;
    }
    currentRunFrames = 0;
    currentRunDurationMs = 0;
  }

  return {
    longestRunFrames,
    longestRunDurationMs,
    firstVacuumFrame,
    firstVacuumSnapshot,
  };
}

function expectVisualVacuumWithinOneFrame(
  name: string,
  frames: ReadonlyArray<WebGLSnapshot>,
): void {
  const measurement = measureVisualVacuum(frames);
  const evidence = JSON.stringify({
    name,
    longestRunFrames: measurement.longestRunFrames,
    longestRunDurationMs: measurement.longestRunDurationMs,
    firstVacuumFrame: measurement.firstVacuumFrame,
    firstVacuumSnapshot: measurement.firstVacuumSnapshot,
  });
  if (process.env.P4_R41_VACUUM_REPORT === "1") {
    process.stdout.write(`P4_R41_VACUUM ${evidence}\n`);
  }
  expect(measurement.longestRunDurationMs, evidence).toBeLessThanOrEqual(16.7);
}

async function waitForTransitionState(
  page: Page,
  matcher: (snapshot: WebGLSnapshot) => boolean,
): Promise<WebGLSnapshot> {
  let matched: WebGLSnapshot | null = null;
  let lastSnapshot: WebGLSnapshot | null = null;
  try {
    await expect
      .poll(async () => {
        const snapshot = await getProbeSnapshot(page);
        lastSnapshot = snapshot;
        if (matcher(snapshot)) {
          matched = snapshot;
          return true;
        }

        return false;
      }, { timeout: 30000 })
      .toBeTruthy();
  } catch (error) {
    throw new Error(
      `Transition state did not match. Last snapshot: ${JSON.stringify(lastSnapshot)}`,
      { cause: error },
    );
  }

  return matched ?? (await getProbeSnapshot(page));
}

function readTransitionPhase(snapshot: WebGLSnapshot | null): SceneTransitionSnapshot["transitionPhase"] {
  return snapshot?.transition?.transitionPhase ?? "idle";
}

function installRafMonitorScript(): void {
  const rafMonitor = {
    scheduled: 0,
    executed: 0,
    maxConcurrent: 0,
    concurrent: 0,
  };

  const originalRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  const originalCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  const inflight = new Set<number>();

  window.requestAnimationFrame = (callback): number => {
    let frameId = -1;
    const wrapped: FrameRequestCallback = (timestamp): void => {
      if (frameId !== -1) {
        inflight.delete(frameId);
        rafMonitor.concurrent = Math.max(0, rafMonitor.concurrent - 1);
      }

      rafMonitor.executed += 1;
      callback(timestamp);
    };

    frameId = originalRequestAnimationFrame(wrapped);
    rafMonitor.scheduled += 1;
    inflight.add(frameId);
    rafMonitor.concurrent = inflight.size;
    rafMonitor.maxConcurrent = Math.max(rafMonitor.maxConcurrent, rafMonitor.concurrent);
    return frameId;
  };

  window.cancelAnimationFrame = (handle): void => {
    inflight.delete(handle);
    rafMonitor.concurrent = Math.max(0, inflight.size);
    originalCancelAnimationFrame(handle);
  };

  (window as unknown as { __e2eRafMonitor: RafMonitor }).__e2eRafMonitor = rafMonitor;
}

async function collectRenderSubmitCostSamples(
  page: Page,
  sampleCount = 30,
): Promise<number[]> {
  return page.evaluate(async (count) => {
    type Probe = {
      snapshot: () => {
        render: {
          renderSubmitCostMs: number;
        };
      };
    };
    const probe = (window as unknown as { __trevorNoahWebGLProbe?: Probe })
      .__trevorNoahWebGLProbe;
    if (!probe) {
      return [];
    }

    const samples: number[] = [];
    await new Promise<void>((resolve) => {
      const collect = (): void => {
        samples.push(probe.snapshot().render.renderSubmitCostMs);
        if (samples.length >= count) {
          resolve();
          return;
        }
        window.requestAnimationFrame(collect);
      };
      window.requestAnimationFrame(collect);
    });
    return samples;
  }, sampleCount);
}

test.describe("Browser Integration Validation", () => {
  test.describe.configure({ mode: "serial" });

  test("composites Hero portrait/foreground with Media main/secondary in one framebuffer", async ({ page }) => {
    await page.goto("/");
    await waitForWebGLProbe(page);
    await waitForHeroRuntimeReady(page);
    await expect(page.locator("canvas.webgl-canvas")).toHaveCount(1);

    const geometry = await getSceneGeometry(page);
    const preloadScrollY = toScrollYForSceneProgress(
      geometry,
      geometry.heroDocumentTop,
      geometry.heroHeight,
      PRELOAD_PROGRESS,
    );
    await scrollToAndWait(page, preloadScrollY);
    await waitForTransitionState(
      page,
      (snapshot) =>
        snapshot.scenes.total >= 2 &&
        snapshot.transition?.fromSceneId === "hero-scene" &&
        snapshot.transition?.toSceneId === "media-scene",
    );

    const overlapSnapshot = await snapshotAfterMediaProgress(page, geometry, 0.22);
    const composition = overlapSnapshot.composition;
    expect(composition?.rendererOwner).toBe("global-webgl-stage");
    expect(composition).not.toBeNull();
    expect(overlapSnapshot.scenes.dominant).toBe("hero-scene");
    expectLayerSubmitted("hero portrait", composition!.hero.portrait);
    expectLayerSubmitted("hero foreground", composition!.hero.foreground!);
    expect(composition!.media.main.rendered).toBe(true);
    expect(composition!.media.main.visible).toBe(true);
    expect(composition!.media.secondary.rendered).toBe(true);
    expect(composition!.media.secondary.visible).toBe(true);
    expect(composition!.media.projection).toBeDefined();
    expectProjectionAligned("media main overlap anchor", composition!.media.projection!.main);
    expectProjectionAligned("media secondary overlap anchor", composition!.media.projection!.secondary);
    expect(Number.isFinite(composition!.camera.position.x)).toBe(true);
    expect(Number.isFinite(composition!.camera.position.y)).toBe(true);
    expect(Number.isFinite(composition!.camera.position.z)).toBe(true);
    expect(Number.isFinite(composition!.camera.target.x)).toBe(true);
    expect(Number.isFinite(composition!.camera.target.y)).toBe(true);
    expect(Number.isFinite(composition!.camera.target.z)).toBe(true);
    expect(overlapSnapshot.render.drawCalls).toBeGreaterThanOrEqual(4);

    const pixelStats = await readCanvasPixelStats(page);
    expect(pixelStats.width).toBeGreaterThan(0);
    expect(pixelStats.height).toBeGreaterThan(0);
    expect(pixelStats.nonBackgroundPixels).toBeGreaterThan(100);

    // P4-03 caches Media as soon as the DOM-only Manifesto enters the
    // viewport. Keep this four-layer compositor assertion at the actual
    // Hero/Media overlap checkpoint, before that interlude begins.
    const mediaOverlap = await snapshotAfterMediaProgress(page, geometry, 0.44);
    expect(mediaOverlap.composition).not.toBeNull();
    expectLayerInClipSpace("media main in overlap", mediaOverlap.composition!.media.main);
    expectLayerInClipSpace("media secondary in overlap", mediaOverlap.composition!.media.secondary);
  });

  test("verifies Hero -> Media browser transition and single canvas / single RAF", async ({ page }) => {
    await page.addInitScript(installRafMonitorScript);

    await page.goto("/");

    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trevor Noah Style Experience" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Media" })).toBeVisible();
    await expect(page.locator("section#hero")).toBeVisible();
    await expect(page.locator("section#media")).toBeVisible();

    await waitForWebGLProbe(page);
    await waitForHeroRuntimeReady(page);
    await expect(page.locator("canvas.webgl-canvas")).toHaveCount(1);

    const geometry = await getSceneGeometry(page);
    const preloadScrollY = toScrollYForSceneProgress(
      geometry,
      geometry.heroDocumentTop,
      geometry.heroHeight,
      PRELOAD_PROGRESS,
    );

    await scrollToAndWait(page, preloadScrollY);

    const preloadSnapshot = await waitForTransitionState(
      page,
      (snapshot) =>
        snapshot.scenes.total >= 2 &&
        readTransitionPhase(snapshot) !== "idle" &&
        snapshot.transition?.fromSceneId === "hero-scene" &&
        snapshot.transition?.toSceneId === "media-scene",
    );
    expect(preloadSnapshot.transition?.fromSceneId).toBe("hero-scene");
    expect(preloadSnapshot.transition?.toSceneId).toBe("media-scene");
    expect(preloadSnapshot.scenes.dominant).toBe("hero-scene");
    expect(ALLOWED_TRANSITION_PHASES).toContain(preloadSnapshot.transition?.transitionPhase);

    const overlapScrollY = toScrollYForSceneProgress(
      geometry,
      geometry.heroDocumentTop,
      geometry.heroHeight,
      OVERLAP_PROGRESS,
    );
    await scrollToAndWait(page, overlapScrollY);

    // Overlap window should keep Hero dominant while media is active/visible.
    const overlapSnapshot = await waitForTransitionState(
      page,
      (snapshot) =>
        snapshot.scenes.total >= 2 &&
        snapshot.scenes.dominant === "hero-scene" &&
        (readTransitionPhase(snapshot) === "overlap" ||
          readTransitionPhase(snapshot) === "handoff"),
    );
    expect(overlapSnapshot.scenes.dominant).toBe("hero-scene");
    // P4-03 registers About and P4-04 registers Books at startup, but both
    // remain dormant until their Director preload boundaries. Hero/Media
    // overlap still has exactly the same two active lifecycle participants.
    expect(overlapSnapshot.scenes.total).toBe(4);
    expect(overlapSnapshot.diagnostics.sceneStates["about-scene"]).toMatchObject({
      resident: false,
      visible: false,
      updating: false,
      dominant: false,
    });
    expect(overlapSnapshot.diagnostics.sceneStates["books-scene"]).toMatchObject({
      resident: false,
      visible: false,
      updating: false,
      dominant: false,
    });
    expect(overlapSnapshot.transition?.fromSceneId).toBe("hero-scene");

    // With P4-03's DOM-only Manifesto interlude, this historical Media
    // checkpoint now lands after Manifesto enters the viewport. Media must
    // already be cached and its camera intent replaced by the global idle
    // policy; the overlap above remains the authoritative four-layer gate.
    const manifestoSnapshot = await snapshotAfterMediaProgress(page, geometry, MEDIA_REPLACE_PROGRESS);
    expect(manifestoSnapshot.scenes.total).toBe(4);
    expect(manifestoSnapshot.diagnostics.sceneStates["about-scene"]).toMatchObject({
      resident: false,
      visible: false,
      updating: false,
      dominant: false,
    });
    expect(manifestoSnapshot.diagnostics.sceneStates["books-scene"]).toMatchObject({
      resident: false,
      visible: false,
      updating: false,
      dominant: false,
    });
    expect(manifestoSnapshot.diagnostics.sceneStates["media-scene"]).toMatchObject({
      resident: true,
      visible: false,
      updating: false,
      dominant: false,
      cached: true,
    });
    expect(manifestoSnapshot.transition?.cameraIntentSceneId).toBe("global-idle");
    expect(manifestoSnapshot.composition?.media.main.rendered).toBe(false);
    expect(manifestoSnapshot.composition?.media.secondary.rendered).toBe(false);
    await expect(page.locator("canvas.webgl-canvas")).toHaveCount(1);

    await expect.poll(async () => page.evaluate(() => {
      return (window as unknown as { __e2eRafMonitor?: RafMonitor }).__e2eRafMonitor?.executed ?? 0;
    })).toBeGreaterThan(MIN_WEBGL_RENDER_FRAMES);

    const rafMonitor = await page.evaluate(() => {
      return (window as unknown as { __e2eRafMonitor?: RafMonitor }).__e2eRafMonitor ?? null;
    });
    const settledSnapshot = await getProbeSnapshot(page);

    expect(rafMonitor).not.toBeNull();
    expect(rafMonitor!.executed).toBeGreaterThan(MIN_WEBGL_RENDER_FRAMES);
    expect(rafMonitor!.maxConcurrent).toBeLessThanOrEqual(2);
    expect(settledSnapshot.render.tierProfile.frameDivisor).toBe(1);
    expect(settledSnapshot.render.isLowUpdateMode).toBe(false);
    // Headless Chromium can schedule RAF at ~12fps while SwiftShader is idle.
    // The runtime gate must therefore measure actual renderer submission cost over
    // multiple native RAF callbacks, rather than treating one scheduler timestamp
    // as a performance sample.
    const renderSubmitSamples = await collectRenderSubmitCostSamples(page);
    expect(renderSubmitSamples).toHaveLength(30);
    expect(percentile(renderSubmitSamples, 0.95)).toBeLessThan(80);
  });

  test("registers About dormant and lets SceneDirector preload and activate it from anchor policy", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForWebGLProbe(page);
    await waitForHeroRuntimeReady(page);

    const initialSnapshot = await getProbeSnapshot(page);
    expect(initialSnapshot.scenes.total).toBe(4);
    expect(initialSnapshot.diagnostics.sceneStates["about-scene"]).toMatchObject({
      resident: false,
      visible: false,
      dominant: false,
      cached: false,
      disposed: false,
    });
    expect(initialSnapshot.diagnostics.sceneStates["books-scene"]).toMatchObject({
      resident: false,
      visible: false,
      updating: false,
      dominant: false,
      cached: false,
      disposed: false,
    });

    const geometry = await getSceneGeometry(page);
    const mediaSnapshot = await snapshotAfterMediaProgress(
      page,
      geometry,
      MEDIA_REPLACE_PROGRESS,
    );
    expect(mediaSnapshot.scenes.total).toBe(4);
    expect(mediaSnapshot.diagnostics.sceneStates["about-scene"]?.dominant).toBe(false);
    expect(mediaSnapshot.diagnostics.sceneStates["books-scene"]).toMatchObject({
      resident: false,
      visible: false,
      updating: false,
      dominant: false,
    });

    const aboutApproachScrollY = await page.evaluate(() => {
      const about = document.getElementById("about");
      if (!about) {
        throw new Error("About section not mounted.");
      }

      const aboutDocumentTop = about.getBoundingClientRect().top + window.scrollY;
      return Math.max(0, aboutDocumentTop - window.innerHeight * 1.5);
    });
    await scrollToAndWait(page, aboutApproachScrollY);

    await expect
      .poll(async () => {
        const snapshot = await getProbeSnapshot(page);
        return {
          total: snapshot.scenes.total,
          aboutState: snapshot.diagnostics.sceneStates["about-scene"] ?? null,
        };
      })
      .toMatchObject({
          total: 4,
          aboutState: {
            resident: true,
            visible: false,
            updating: false,
            dominant: false,
            cached: false,
            disposed: false,
          },
        });

    const aboutCoreScrollY = await page.evaluate(() => {
      const about = document.getElementById("about");
      if (!about) {
        throw new Error("About section not mounted.");
      }

      const aboutDocumentTop = about.getBoundingClientRect().top + window.scrollY;
      return Math.max(0, aboutDocumentTop - window.innerHeight * 0.8);
    });
    await scrollToAndWait(page, aboutCoreScrollY);
    await expect
      .poll(async () => {
        const snapshot = await getProbeSnapshot(page);
        return {
          dominant: snapshot.scenes.dominant,
          aboutState: snapshot.diagnostics.sceneStates["about-scene"] ?? null,
        };
      })
      .toMatchObject({
        dominant: "about-scene",
        aboutState: {
          resident: true,
          visible: true,
          updating: true,
          dominant: true,
          cached: false,
        },
      });

    await scrollToAndWait(page, 0);

    await expect
      .poll(async () => {
        const snapshot = await getProbeSnapshot(page);
        return {
          total: snapshot.scenes.total,
          dominant: snapshot.scenes.dominant,
          aboutState: snapshot.diagnostics.sceneStates["about-scene"] ?? null,
        };
      })
      .toMatchObject({
        total: 4,
        dominant: "hero-scene",
        aboutState: {
          resident: true,
          visible: false,
          updating: false,
          dominant: false,
          cached: true,
          disposed: false,
        },
      });
  });

  test("keeps Media screen anchors aligned and restores Hero identically on reverse", async ({ page }) => {
    const viewports = [
      { name: "desktop", width: 1440, height: 900 },
      { name: "mobile", width: 390, height: 844 },
    ] as const;

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await waitForWebGLProbe(page);
      await waitForHeroRuntimeReady(page);
      const initial = await getProbeSnapshot(page);
      const initialPortrait = initial.composition?.hero.portrait;
      expect(initialPortrait?.screen?.center).toBeDefined();
      expect(initialPortrait?.scale.x ?? Number.POSITIVE_INFINITY).toBeLessThan(2);
      expect(initialPortrait?.scale.y ?? Number.POSITIVE_INFINITY).toBeLessThan(2);
      const heroTextureOwners = Object.keys(
        initial.diagnostics.gpuResources["hero-scene"]?.ownerCounts ?? {},
      ).filter((key) => key.startsWith("texture:"));
      expect(heroTextureOwners).toHaveLength(1);
      expect(heroTextureOwners[0]).toContain(
        viewport.width <= 768
          ? "hero-placeholder-mobile.webp"
          : "hero-placeholder-desktop.webp",
      );

      const geometry = await getSceneGeometry(page);
      const forward = await seekChapterProgress(
        page,
        "hero-scene",
        "chapterProgress",
        0.4,
      );
      await settleFrames(page);
      const settledForward = await getProbeSnapshot(page);
      const forwardProjection = settledForward.composition?.media.projection;
      expect(forwardProjection, `${viewport.name} forward projection`).toBeDefined();
      expectProjectionAligned(`${viewport.name} forward main`, forwardProjection!.main);
      expectProjectionAligned(`${viewport.name} forward secondary`, forwardProjection!.secondary);

      await snapshotAfterMediaProgress(page, geometry, 0.8);
      const replaced = await waitForTransitionState(
        page,
        (snapshot) =>
          snapshot.diagnostics.sceneStates["media-scene"]?.cached === true &&
          snapshot.transition?.cameraIntentSceneId === "global-idle",
      );

      await seekChapterProgress(
        page,
        "hero-scene",
        "chapterProgress",
        0.4,
      );
      await waitForTransitionState(
        page,
        (snapshot) =>
          snapshot.scenes.dominant === "hero-scene" &&
          snapshot.diagnostics.sceneStates["hero-scene"]?.visible === true &&
          snapshot.diagnostics.sceneStates["hero-scene"]?.updating === true &&
          snapshot.composition?.hero.portrait.rendered === true &&
          snapshot.composition.hero.foreground?.rendered === true,
      );
      await expect.poll(async () => {
        const snapshot = await getProbeSnapshot(page);
        const registration = snapshot.composition?.hero.foregroundCrop?.registration;
        return {
          centerX: Math.abs(registration?.centerResidual.x ?? Number.POSITIVE_INFINITY),
          centerY: Math.abs(registration?.centerResidual.y ?? Number.POSITIVE_INFINITY),
          width: Math.abs(registration?.sizeResidualPercent.width ?? Number.POSITIVE_INFINITY),
          height: Math.abs(registration?.sizeResidualPercent.height ?? Number.POSITIVE_INFINITY),
        };
      }, { timeout: 8000 }).toMatchObject({
        centerX: expect.any(Number),
        centerY: expect.any(Number),
        width: expect.any(Number),
        height: expect.any(Number),
      });
      const reverse = await getProbeSnapshot(page);
      const reverseProjection = reverse.composition?.media.projection;
      expect(reverseProjection, `${viewport.name} reverse projection`).toBeDefined();
      expectProjectionAligned(`${viewport.name} reverse main`, reverseProjection!.main);
      expectProjectionAligned(`${viewport.name} reverse secondary`, reverseProjection!.secondary);

      const forwardHeroState = settledForward.diagnostics.sceneSnapshots["hero-scene"];
      const reverseHeroState = reverse.diagnostics.sceneSnapshots["hero-scene"];
      expect(reverseHeroState.chapterProgress).toBeCloseTo(forwardHeroState.chapterProgress ?? 0, 3);
      expect(reverseHeroState.phase).toBe(forwardHeroState.phase);
      expect(reverseHeroState.transform?.opacity).toBeCloseTo(
        forwardHeroState.transform?.opacity ?? 0,
        3,
      );
      expect(reverseHeroState.transform?.scale).toBeCloseTo(
        forwardHeroState.transform?.scale ?? 0,
        3,
      );
      expect(reverse.composition?.hero.portrait.opacity).toBeCloseTo(
        settledForward.composition?.hero.portrait.opacity ?? 0,
        3,
      );
      expect(reverse.composition?.hero.foreground?.opacity).toBeCloseTo(
        settledForward.composition?.hero.foreground?.opacity ?? 0,
        3,
      );
      const forwardPortrait = settledForward.composition?.hero.portrait;
      const reversePortrait = reverse.composition?.hero.portrait;
      expect(forwardPortrait?.screen?.center).toBeDefined();
      expect(reversePortrait?.screen?.center).toBeDefined();
      expect(
        Math.abs(
          (reversePortrait?.screen?.center.x ?? Number.POSITIVE_INFINITY) -
          (forwardPortrait?.screen?.center.x ?? 0),
        ),
      ).toBeLessThanOrEqual(6);
      expect(
        Math.abs(
          (reversePortrait?.screen?.center.y ?? Number.POSITIVE_INFINITY) -
          (forwardPortrait?.screen?.center.y ?? 0),
        ),
      ).toBeLessThanOrEqual(6);
      expect(reversePortrait?.scale.x).toBeCloseTo(forwardPortrait?.scale.x ?? 0, 2);
      expect(reversePortrait?.scale.y).toBeCloseTo(forwardPortrait?.scale.y ?? 0, 2);
      const forwardCamera = settledForward.composition?.camera;
      const reverseCamera = reverse.composition?.camera;
      expect(forwardCamera).toBeDefined();
      expect(reverseCamera).toBeDefined();
      expect(
        Math.hypot(
          (reverseCamera?.position.x ?? 0) - (forwardCamera?.position.x ?? 0),
          (reverseCamera?.position.y ?? 0) - (forwardCamera?.position.y ?? 0),
          (reverseCamera?.position.z ?? 0) - (forwardCamera?.position.z ?? 0),
        ),
      ).toBeLessThanOrEqual(0.03);
      expect(
        Math.max(
          Math.abs(reverseCamera?.position.x ?? 0),
          Math.abs(reverseCamera?.position.y ?? 0),
          Math.abs(reverseCamera?.position.z ?? 0),
        ),
      ).toBeLessThan(20);
      for (const journeySnapshot of [settledForward, replaced, reverse]) {
        const aboutState =
          journeySnapshot.diagnostics.sceneStates["about-scene"];
        expect(aboutState).toMatchObject({
          visible: false,
          updating: false,
          dominant: false,
          cached: false,
          disposed: false,
        });
        const aboutOwners =
          Object.entries(journeySnapshot.diagnostics.assetOwnerCounts).filter(
            ([assetId]) => assetId.startsWith("about-portrait-dev-host-01"),
          );
        expect(aboutOwners).toHaveLength(1);
        expect(aboutOwners[0]?.[1]).toBe(aboutState?.resident ? 1 : 0);
      }
      expect(reverse.diagnostics.assetOwnerCounts).toEqual(
        replaced.diagnostics.assetOwnerCounts,
      );
      expect(reverse.diagnostics.gpuResources).toEqual(
        replaced.diagnostics.gpuResources,
      );
      expect(replaced.diagnostics.sceneStates["media-scene"]).toMatchObject({
        resident: true,
        visible: false,
        updating: false,
        dominant: false,
        cached: true,
      });
      expect(reverse.composition?.hero.foregroundCrop?.uvOriginConvention).toBe("top-left");
      expect(reverse.composition?.hero.foregroundCrop?.textureFlipY).toBe(true);
      const cropSnapshot = reverse.composition?.hero.foregroundCrop;
      expect(cropSnapshot).toBeDefined();
      expect(cropSnapshot?.geometryAspect).toBeCloseTo(
        (cropSnapshot?.cropPixels.width ?? 0) /
        Math.max(0.0001, cropSnapshot?.cropPixels.height ?? 0),
        5,
      );
      const registration = cropSnapshot?.registration;
      const forwardRegistration = settledForward.composition?.hero.foregroundCrop?.registration;
      expect(registration, `${viewport.name} foreground registration`).not.toBeNull();
      expect(forwardRegistration, `${viewport.name} forward foreground registration`).not.toBeNull();
      expect(
        Math.abs(
          (registration?.centerResidual.x ?? Number.POSITIVE_INFINITY) -
          (forwardRegistration?.centerResidual.x ?? 0),
        ),
        `${viewport.name} foreground x reverse delta`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(
          (registration?.centerResidual.y ?? Number.POSITIVE_INFINITY) -
          (forwardRegistration?.centerResidual.y ?? 0),
        ),
        `${viewport.name} foreground y reverse delta`,
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(
          (registration?.sizeResidualPercent.width ?? Number.POSITIVE_INFINITY) -
          (forwardRegistration?.sizeResidualPercent.width ?? 0),
        ),
        `${viewport.name} foreground width reverse delta`,
      ).toBeLessThanOrEqual(0.5);
      expect(
        Math.abs(
          (registration?.sizeResidualPercent.height ?? Number.POSITIVE_INFINITY) -
          (forwardRegistration?.sizeResidualPercent.height ?? 0),
        ),
        `${viewport.name} foreground height reverse delta`,
      ).toBeLessThanOrEqual(0.5);
      expect(forward.composition?.rendererOwner).toBe("global-webgl-stage");
      await expect(page.locator("canvas.webgl-canvas")).toHaveCount(1);
    }
  });

  test("validates tuned handoff policy timing and camera blend continuity", async ({ page }) => {
    await page.goto("/");
    await waitForWebGLProbe(page);
    await waitForHeroRuntimeReady(page);
    await expect(page.locator("canvas.webgl-canvas")).toHaveCount(1);

    const geometry = await getSceneGeometry(page);
    await page.waitForTimeout(300);
    const preloadScrollY = toScrollYForSceneProgress(
      geometry,
      geometry.heroDocumentTop,
      geometry.heroHeight,
      PRELOAD_PROGRESS,
    );
    await scrollToAndWait(page, preloadScrollY);
    await waitForTransitionState(
      page,
      (snapshot) =>
        snapshot.scenes.total >= 2 &&
        snapshot.scenes.dominant === "hero-scene" &&
        (snapshot.transition?.transitionPhase === "preload" ||
          snapshot.transition?.transitionPhase === "overlap" ||
          snapshot.transition?.transitionPhase === "handoff"),
    );

    const preHandoff = await snapshotAfterMediaProgress(page, geometry, 0.18);
    const preMediaSnapshot = preHandoff.diagnostics.sceneSnapshots["media-scene"];
    expect(
      (preHandoff.composition?.hero.portrait.opacity ?? 0) > 0 ||
        preMediaSnapshot?.visualReady === true,
    ).toBeTruthy();
    expect(preHandoff.transition?.cameraBlendWeight).toBeLessThan(1e-6);
    expect(preHandoff.transition?.transitionPhase).toBe("overlap");

    const settleStart = await snapshotAfterMediaProgress(page, geometry, 0.22);
    const settleMediaSnapshot = settleStart.diagnostics.sceneSnapshots["media-scene"];
    expect(settleStart.transition).toBeTruthy();
    expect(settleStart.transition?.handoffProgress ?? 0).toBeGreaterThanOrEqual(0);
    if (settleMediaSnapshot?.visualReady === true) {
      expect(
        settleStart.transition?.transitionPhase === "overlap" ||
          settleStart.transition?.transitionPhase === "handoff",
      ).toBeTruthy();
      expect(settleStart.transition?.cameraBlendWeight).toBeGreaterThanOrEqual(0);
      expect(settleStart.transition?.cameraBlendWeight).toBeLessThanOrEqual(0.05);
    } else {
      expect(settleStart.transition?.cameraBlendWeight).toBeLessThanOrEqual(0.05);
      expect(settleStart.transition?.transitionPhase).toBe("overlap");
      expect(settleStart.composition?.hero.portrait.opacity).toBeGreaterThan(0.3);
    }

    const handoffMid = await snapshotAfterMediaProgress(page, geometry, 0.44);
    const handoffMidProgress = handoffMid.transition?.handoffProgress ?? 0;
    const handoffMidMedia = handoffMid.diagnostics.sceneSnapshots["media-scene"];
    const isMidReady = handoffMidMedia?.visualReady === true;
    if (isMidReady) {
      expect(handoffMid.transition?.transitionPhase === "handoff" || handoffMid.transition?.transitionPhase === "replace").toBeTruthy();
    } else {
      expect(handoffMid.transition?.cameraBlendWeight).toBe(0);
    }
    expect(handoffMidProgress).toBeGreaterThanOrEqual(settleStart.transition?.handoffProgress ?? 0);
    expect(handoffMid.transition?.cameraBlendWeight).toBeGreaterThanOrEqual(0);
    expect(handoffMid.transition?.cameraBlendWeight).toBeLessThanOrEqual(DEFAULT_CAMERA_HANDOFF_POLICY.maxSecondaryBlend + 0.0001);

    const cameraAtMid = handoffMid.composition?.camera;
    const handoffStart = await snapshotAfterMediaProgress(page, geometry, 0.66);
    const handoffStartMedia = handoffStart.diagnostics.sceneSnapshots["media-scene"];
    const isHandoffStartReady = handoffStartMedia?.visualReady === true;
    if (isHandoffStartReady) {
      expect(handoffStart.transition?.transitionPhase === "handoff" || handoffStart.transition?.transitionPhase === "replace").toBeTruthy();
      expect(handoffStart.transition?.cameraBlendWeight).toBeGreaterThan(0);
    } else {
      expect(handoffStart.transition?.cameraBlendWeight).toBe(0);
    }
    expect(handoffStart.transition?.handoffProgress ?? 0).toBeGreaterThanOrEqual(handoffMidProgress);
    expect(handoffStart.transition?.cameraBlendWeight).toBeGreaterThanOrEqual(0);
    const cameraAtHandoffEnd = handoffStart.composition?.camera;

    expect(cameraAtMid).toBeDefined();
    expect(cameraAtHandoffEnd).toBeDefined();
    if (cameraAtMid && cameraAtHandoffEnd) {
      const xDelta = Math.abs(cameraAtHandoffEnd.position.x - cameraAtMid.position.x);
      const yDelta = Math.abs(cameraAtHandoffEnd.target.y - cameraAtMid.target.y);
      const width = geometry.viewportHeight;
      expect(xDelta).toBeLessThan(0.22);
      expect(yDelta).toBeLessThan(width * 0.06);
    }

    // At .72 this document layout has entered the Manifesto interlude. Its
    // global-idle policy intentionally ends the Media handoff and caches the
    // scene before the DOM-only chapter renders.
    const manifestoSnapshot = await snapshotAfterMediaProgress(page, geometry, 0.72);
    expect(manifestoSnapshot.transition?.transitionPhase).toBe("cache");
    expect(manifestoSnapshot.transition?.cameraIntentSceneId).toBe("global-idle");
    expect(manifestoSnapshot.diagnostics.sceneStates["media-scene"]).toMatchObject({
      cached: true,
      visible: false,
      updating: false,
    });
  });

  test("aligns camera handoff with media visual-ready state in forward and reverse", async ({ page }) => {
    await page.goto("/");
    await waitForWebGLProbe(page);
    await waitForHeroRuntimeReady(page);
    await page.evaluate(() => {
      (window as unknown as { __r3bBlendDebug: boolean }).__r3bBlendDebug = true;
    });
    page.on("console", (message) => {
      if (message.text().startsWith("R3B_CAMERA_BLEND")) {
        console.log("BROWSER LOG", message.text());
      }
    });

    const geometry = await getSceneGeometry(page);
    const requestedForward = [0.1, 0.22, 0.44, 0.66, 0.72] as const;
    const forwardTimeline: Array<{
      readonly target: number;
      readonly actual: number;
      readonly mediaReady: boolean;
      readonly heroOpacity: number | null;
      readonly blend: number;
      readonly phase: string | null;
      readonly transitionPhase: string | null;
      readonly dominant: string | null;
    }> = [];

    for (const target of requestedForward) {
      const snapshot = await seekMediaProgress(page, geometry, target);
      const mediaScene = snapshot.diagnostics.sceneSnapshots["media-scene"];
      const actual = mediaScene?.mediaProgress ?? Number.NaN;
      const mediaReady = mediaScene?.visualReady === true;
      const heroOpacity = snapshot.composition?.hero.portrait.opacity ?? null;
      forwardTimeline.push({
        target,
        actual,
        mediaReady,
        heroOpacity,
        blend: snapshot.transition?.cameraBlendWeight ?? 0,
        phase: mediaScene?.phase ?? null,
        transitionPhase: snapshot.transition?.transitionPhase ?? null,
        dominant: snapshot.scenes.dominant,
      });
      expect(Math.abs(actual - target)).toBeLessThanOrEqual(0.01);
    }

    console.log("R3-B forward timeline debug", forwardTimeline.map((entry) => ({
      ...entry,
      mediaPhase: entry.phase,
      transitionPhase: entry.transitionPhase,
    })));

    let observedVisualReady = false;
    forwardTimeline.forEach((entry) => {
      observedVisualReady = observedVisualReady || entry.mediaReady;
      const inHandoffWindow =
        entry.actual >= DEFAULT_CAMERA_HANDOFF_POLICY.startProgress &&
        entry.actual <= DEFAULT_CAMERA_HANDOFF_POLICY.endProgress;

      if (!observedVisualReady) {
        expect(entry.blend).toBeCloseTo(0, 6);
      }
      if (entry.actual < DEFAULT_CAMERA_HANDOFF_POLICY.startProgress && entry.mediaReady) {
        expect(entry.blend).toBeCloseTo(0, 6);
      }
      if (inHandoffWindow && observedVisualReady && entry.actual > DEFAULT_CAMERA_HANDOFF_POLICY.startProgress) {
        expect(entry.blend).toBeGreaterThanOrEqual(0);
      }
      if (
        entry.actual > DEFAULT_CAMERA_HANDOFF_POLICY.endProgress &&
        entry.actual < MEDIA_REPLACE_PROGRESS &&
        observedVisualReady
      ) {
        expect(entry.transitionPhase === "handoff" || entry.transitionPhase === "replace").toBeTruthy();
      }
      if (entry.actual >= MEDIA_REPLACE_PROGRESS) {
        expect(entry.blend).toBeCloseTo(0, 6);
        expect(entry.transitionPhase).toBe("cache");
      }
      if (entry.blend > 0) {
        expect(observedVisualReady).toBe(true);
        expect(entry.dominant).toBe("hero-scene");
        expect(entry.phase).toBe("hold");
      }
    });

    const firstBlendIndex = forwardTimeline.findIndex((entry) => entry.blend > 0);
    expect(firstBlendIndex).toBeGreaterThanOrEqual(0);
    expect(forwardTimeline[Math.min(firstBlendIndex, forwardTimeline.length - 1)]).not.toBeNull();
    const beforeBlend = forwardTimeline[Math.max(0, firstBlendIndex - 1)];
    expect(
      forwardTimeline
        .slice(0, firstBlendIndex + 1)
        .some((entry) => entry.mediaReady),
    ).toBe(true);
    expect(beforeBlend.transitionPhase === "overlap" || beforeBlend.transitionPhase === "handoff").toBeTruthy();

    const requestedReverse = [0.72, 0.44, 0.22, 0.1] as const;
    for (const target of requestedReverse) {
      const snapshot = await seekMediaProgress(page, geometry, target);
      const mediaScene = snapshot.diagnostics.sceneSnapshots["media-scene"];
      const mediaReady = mediaScene?.visualReady === true;
      const blend = snapshot.transition?.cameraBlendWeight ?? 0;
      if (!mediaReady && snapshot.transition?.transitionPhase !== "handoff" && snapshot.transition?.transitionPhase !== "replace") {
        expect(blend).toBe(0);
      }
      expect(snapshot.scenes.dominant).toBeDefined();
    }
  });

  test("requires current-frame media visualReady before blend and ready-active fallback hide", async ({ page }) => {
    const viewports = [
      { name: "desktop", width: 1440, height: 900 },
      { name: "mobile", width: 390, height: 844 },
    ] as const;
    const requestedForward = [0.22, 0.44, 0.66, 0.72] as const;

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await waitForWebGLProbe(page);
      await waitForHeroRuntimeReady(page);

      const geometry = await getSceneGeometry(page);

      for (const target of requestedForward) {
        const snapshot = await seekMediaProgress(page, geometry, target);
        const mediaScene = snapshot.diagnostics.sceneSnapshots["media-scene"];
        const mediaVisualReady = mediaScene?.visualReady === true;
        const blend = snapshot.transition?.cameraBlendWeight ?? 0;
        const fallbackState = await readMediaFallbackImageState(page);
        const mediaMain = snapshot.composition?.media.main ?? null;
        const evidence = JSON.stringify({
          viewport,
          target,
          actual: mediaScene?.mediaProgress ?? null,
          mediaVisualReady,
          blend,
          transition: snapshot.transition,
          dominant: snapshot.scenes.dominant,
          fallbackState,
          mediaMain,
        });

        if (blend > 0) {
          expect(mediaVisualReady, evidence).toBe(true);
        }

        const mediaVisibleInFrame =
          mediaMain?.rendered === true &&
          mediaMain.visible === true &&
          mediaMain.frustumVisible === true;

        if (snapshot.scenes.dominant === "media-scene" && mediaVisibleInFrame) {
          expect(
            fallbackState.states.every((state) => state.opacity === "0"),
            evidence,
          ).toBe(true);
          expect(
            fallbackState.states.every((state) => state.contract === "ready-active"),
            evidence,
          ).toBe(true);
        }
      }
    }
  });

  test("seeks the five Media evidence points from actual runtime progress", async ({ page }) => {
    const viewports = [
      { name: "desktop", width: 1440, height: 900 },
      { name: "mobile", width: 390, height: 844 },
    ] as const;
    const requestedProgresses = [0.1, 0.22, 0.44, 0.66, 0.72] as const;

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await waitForWebGLProbe(page);
      await waitForHeroRuntimeReady(page);
      const geometry = await getSceneGeometry(page);

      for (const requestedProgress of requestedProgresses) {
        const snapshot = await seekMediaProgress(page, geometry, requestedProgress);
        const mediaSnapshot = snapshot.diagnostics.sceneSnapshots["media-scene"];
        const actualProgress = mediaSnapshot?.mediaProgress ?? Number.NaN;
        const mediaReady = mediaSnapshot?.visualReady === true;
        const evidence = JSON.stringify({
          viewport,
          requestedProgress,
          actualProgress,
          phase: mediaSnapshot?.phase,
          transition: snapshot.transition,
          composition: snapshot.composition?.media,
        });

        expect(Math.abs(actualProgress - requestedProgress), evidence).toBeLessThanOrEqual(0.01);
        expect(snapshot.composition, evidence).not.toBeNull();

        const mediaMain = snapshot.composition!.media.main;
        const mediaSecondary = snapshot.composition!.media.secondary;
        const expectMediaVisible = mediaReady || mediaMain.frustumVisible || mediaSecondary.frustumVisible;

        if (expectMediaVisible) {
          expect(mediaMain.rendered, evidence).toBe(true);
          expect(mediaMain.visible, evidence).toBe(true);
          expect(mediaMain.frustumVisible, evidence).toBe(true);
          expect(Number.isFinite(mediaMain.ndc.x), evidence).toBe(true);

          expect(mediaSecondary.rendered, evidence).toBe(true);
          expect(mediaSecondary.visible, evidence).toBe(true);
          expect(mediaSecondary.frustumVisible, evidence).toBe(true);
          expect(Number.isFinite(mediaSecondary.ndc.x), evidence).toBe(true);

          expectProjectionAligned(
            `${viewport.name} media main anchor at ${requestedProgress}`,
            snapshot.composition!.media.projection!.main,
          );
          expectProjectionAligned(
            `${viewport.name} media secondary anchor at ${requestedProgress}`,
            snapshot.composition!.media.projection!.secondary,
          );
        } else {
          expect(mediaMain.frustumVisible, evidence).toBe(false);
          expect(mediaSecondary.frustumVisible, evidence).toBe(false);
          expect(snapshot.composition!.media.projection, evidence).toBeDefined();
        }

        if (mediaReady) {
          expect(mediaMain.frustumVisible).toBe(true);
          expect(mediaSecondary.frustumVisible).toBe(true);
        }

        await expect(page.locator("canvas.webgl-canvas")).toHaveCount(1);
      }
    }
  });

  test("keeps the Media secondary card within its hard projected-exposure acceptance range", async ({ page }) => {
    const viewports = [
      { name: "desktop", width: 1440, height: 900, ...MEDIA_SECONDARY_EXPOSURE_CONTRACT.desktop },
      { name: "mobile", width: 390, height: 844, ...MEDIA_SECONDARY_EXPOSURE_CONTRACT.mobile },
    ] as const;
    const exposureViolations: string[] = [];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await waitForWebGLProbe(page);
      await waitForHeroRuntimeReady(page);

      const geometry = await getSceneGeometry(page);
      const snapshot = await seekMediaProgress(page, geometry, 0.44);
      const main = snapshot.composition?.media.main;
      const secondary = snapshot.composition?.media.secondary;
      expect(main).toBeDefined();
      expect(secondary).toBeDefined();

      const exposureRatio = resolveSecondaryExposureRatio(main!, secondary!);
      const mainArea = computeLayerScreenArea(main);
      const secondaryArea = computeLayerScreenArea(secondary);
      const mainBounds = main!.screen?.bounds;
      const secondaryBounds = secondary!.screen?.bounds;
      const viewportLayout = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
      }));
      const secondaryExposedAssetFraction = Math.min(
        1,
        Math.max(0, (mainBounds!.left - secondaryBounds!.left) /
          Math.max(1, secondaryBounds!.right - secondaryBounds!.left)),
      );
      const focalPoint = viewport.name === "mobile"
        ? mediaSceneConfig.secondary.focalPoint.mobile
        : mediaSceneConfig.secondary.focalPoint.desktop;
      const textBounds = await page.evaluate(() => Array.from(
        document.querySelectorAll<HTMLElement>(
          "#media .section-head, #media .section-motion-visual > p, #media .media-card h3, #media .media-card > div > p",
        ),
      ).map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
        };
      }));
      const evidence = JSON.stringify({
        viewport,
        exposureRatio,
        mainArea,
        secondaryArea,
        preferredDesignRange: viewport.preferredDesignRange,
        hardAcceptanceRange: viewport.hardAcceptanceRange,
        secondaryExposedAssetFraction,
        focalPoint,
        scrollWidth: viewportLayout.scrollWidth,
        textBounds,
        main,
        secondary,
      });

      if (process.env.P4_02_4B_R3_GEOMETRY_AUDIT === "1" && viewport.name === "mobile") {
        console.log("P4-02.4B-R3 mobile exposure baseline", JSON.stringify({
          exposureRatio,
          preferredDesignRange: viewport.preferredDesignRange,
          hardAcceptanceRange: viewport.hardAcceptanceRange,
          mainBounds,
          secondaryBounds,
          mainProjectedWidth: mainBounds!.right - mainBounds!.left,
          secondaryExposedWidth: mainBounds!.left - secondaryBounds!.left,
          focalPointWithinExposedRegion: focalPoint.x <= secondaryExposedAssetFraction,
          scrollWidth: viewportLayout.scrollWidth,
          viewport: { width: viewport.width, height: viewport.height },
          mediaProgress: snapshot.diagnostics.sceneSnapshots["media-scene"]?.mediaProgress,
        }));
      }

      if (
        exposureRatio < viewport.hardAcceptanceRange.minimum ||
        exposureRatio > viewport.hardAcceptanceRange.maximum
      ) {
        exposureViolations.push(evidence);
      }
      expect(mainArea, evidence).toBeGreaterThan(secondaryArea);
      expect(main!.opacity, evidence).toBeGreaterThan(secondary!.opacity ?? 0);
      expect(mainBounds, evidence).toBeDefined();
      expect(secondaryBounds, evidence).toBeDefined();

      if (viewport.name === "desktop") {
        const mainCenterX = (mainBounds!.left + mainBounds!.right) / 2;
        expect(mainCenterX, evidence).toBeGreaterThan(viewport.width * 0.55);
      } else {
        expect(mainBounds!.left, evidence).toBeGreaterThanOrEqual(0);
        expect(mainBounds!.right, evidence).toBeLessThanOrEqual(viewport.width);
        expect(secondaryBounds!.left, evidence).toBeGreaterThanOrEqual(0);
      }

      expect(focalPoint.x, evidence).toBeLessThanOrEqual(secondaryExposedAssetFraction);
      expect(viewportLayout.scrollWidth, evidence).toBeLessThanOrEqual(viewport.width);

      for (const text of textBounds) {
        const intersectsText =
          mainBounds!.left < text.right &&
          mainBounds!.right > text.left &&
          mainBounds!.top < text.bottom &&
          mainBounds!.bottom > text.top;
        expect(intersectsText, evidence).toBe(false);
      }
    }

    expect(exposureViolations).toEqual([]);
  });

  test("keeps the Media hold composition legible in its own reading stage", async ({ page }) => {
    const viewports = [
      {
        name: "desktop",
        width: 1440,
        height: 900,
        minimumMainArea: 71_200,
        maximumMainArea: 74_200,
        ...MEDIA_SECONDARY_EXPOSURE_CONTRACT.desktop,
      },
      {
        name: "mobile",
        width: 390,
        height: 844,
        minimumMainArea: 26_000,
        maximumMainArea: Number.POSITIVE_INFINITY,
        ...MEDIA_SECONDARY_EXPOSURE_CONTRACT.mobile,
      },
    ] as const;

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await waitForWebGLProbe(page);
      await waitForHeroRuntimeReady(page);

      const geometry = await getSceneGeometry(page);
      const snapshot = await seekMediaProgress(page, geometry, 0.44);
      const main = snapshot.composition?.media.main;
      const secondary = snapshot.composition?.media.secondary;
      expect(main).toBeDefined();
      expect(secondary).toBeDefined();

      const mainArea = computeLayerScreenArea(main);
      const secondaryExposure = resolveSecondaryExposureRatio(main!, secondary!);
      const readingLayout = await readMediaCompositionLayout(page);
      const evidence = JSON.stringify({
        viewport,
        main,
        secondary,
        mainArea,
        secondaryExposure,
        preferredDesignRange: viewport.preferredDesignRange,
        hardAcceptanceRange: viewport.hardAcceptanceRange,
        readingLayout,
      });

      expect(mainArea, evidence).toBeGreaterThanOrEqual(viewport.minimumMainArea);
      expect(mainArea, evidence).toBeLessThanOrEqual(viewport.maximumMainArea);
      expect(secondaryExposure, evidence).toBeGreaterThanOrEqual(viewport.hardAcceptanceRange.minimum);
      expect(secondaryExposure, evidence).toBeLessThanOrEqual(viewport.hardAcceptanceRange.maximum);
      expect(mainArea, evidence).toBeGreaterThan(computeLayerScreenArea(secondary));
      expect(readingLayout.reading, evidence).not.toBeNull();
      expect(readingLayout.readingOpacity, evidence).toBe("1");
      expect(readingLayout.title, evidence).not.toBeNull();
      expect(readingLayout.body, evidence).not.toBeNull();
      expect(readingLayout.cta, evidence).not.toBeNull();
      expect(readingLayout.cta!.top, evidence).toBeGreaterThanOrEqual(0);
      expect(readingLayout.cta!.bottom, evidence).toBeLessThanOrEqual(viewport.height);
      expect(readingLayout.scrollWidth, evidence).toBeLessThanOrEqual(viewport.width);

      const mainBounds = main!.screen!.bounds;
      for (const readingBounds of [readingLayout.title, readingLayout.body]) {
        const intersectsReadingCore = readingBounds &&
          mainBounds.left < readingBounds.right &&
          mainBounds.right > readingBounds.left &&
          mainBounds.top < readingBounds.bottom &&
          mainBounds.bottom > readingBounds.top;
        expect(intersectsReadingCore, evidence).toBe(false);
      }

      const secondaryBounds = secondary!.screen!.bounds;
      const secondaryExposedAssetFraction = Math.min(
        1,
        Math.max(0, (mainBounds.left - secondaryBounds.left) /
          Math.max(1, secondaryBounds.right - secondaryBounds.left)),
      );
      const focalPoint = viewport.name === "mobile"
        ? mediaSceneConfig.secondary.focalPoint.mobile
        : mediaSceneConfig.secondary.focalPoint.desktop;
      expect(focalPoint.x, evidence).toBeLessThanOrEqual(secondaryExposedAssetFraction);

      if (viewport.name === "desktop") {
        expect(main!.screen!.center.x, evidence).toBeGreaterThan(viewport.width * 0.55);
        expect(readingLayout.manifestoVisibleArea, evidence).toBeLessThan(mainArea);
      }
    }
  });

  test("records P4-02.4B Media composition checkpoints from projected runtime output", async ({ page }, testInfo) => {
    test.skip(
      process.env.P4_02_4B_EVIDENCE !== "1" && process.env.P4_02_4B_R1_EVIDENCE !== "1" && process.env.P4_02_4B_R2_1_EVIDENCE !== "1" && process.env.P4_02_4B_R3_EVIDENCE !== "1",
      "Evidence capture is opt-in outside the P4-02.4B review run.",
    );
    test.setTimeout(90_000);

    const allViewports = [
      { name: "desktop", width: 1440, height: 900 },
      { name: "mobile", width: 390, height: 844 },
    ] as const;
    const viewports = process.env.P4_02_4B_R3_EVIDENCE === "1"
      ? allViewports.filter((viewport) => testInfo.project.name === `p4b-${viewport.name}`)
      : allViewports;
    const progressPoints = [0, 0.07, 0.1, 0.18, 0.44, 0.72] as const;
    const evidence: Array<Record<string, unknown>> = [];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await waitForWebGLProbe(page);
      await waitForHeroRuntimeReady(page);
      const geometry = await getSceneGeometry(page);

      for (const requestedProgress of progressPoints) {
        const snapshot = await seekMediaProgress(page, geometry, requestedProgress);
        const mediaScene = snapshot.diagnostics.sceneSnapshots["media-scene"];
        const main = snapshot.composition?.media.main;
        const secondary = snapshot.composition?.media.secondary;
        const actualProgress = mediaScene?.mediaProgress ?? Number.NaN;
        const framebuffer = requestedProgress === 0.44
          ? await readCanvasPixelStats(page)
          : null;
        const entry = {
          viewport,
          requestedProgress,
          actualProgress,
          mainOpacity: main?.opacity ?? null,
          secondaryOpacity: secondary?.opacity ?? null,
          mainBounds: main?.screen?.bounds ?? null,
          secondaryBounds: secondary?.screen?.bounds ?? null,
          secondaryExposure: main && secondary ? resolveSecondaryExposureRatio(main, secondary) : null,
          mainArea: computeLayerScreenArea(main),
          secondaryArea: computeLayerScreenArea(secondary),
          readingLayout: await readMediaCompositionLayout(page),
          mediaTransform: mediaScene?.mainTransform ?? null,
          secondaryTransform: mediaScene?.secondaryTransform ?? null,
          framebuffer,
          transition: snapshot.transition,
        };
        evidence.push(entry);

        expect(Math.abs(actualProgress - requestedProgress), JSON.stringify(entry)).toBeLessThanOrEqual(0.01);
        if (requestedProgress === 0.07) {
          expect(main?.opacity, JSON.stringify(entry)).toBeGreaterThanOrEqual(0.75);
          expect(main?.opacity, JSON.stringify(entry)).toBeLessThanOrEqual(0.85);
        }
        if (requestedProgress === 0.18) {
          const expectedTranslateX = MEDIA_MOTION_CONFIG.main.holdPose.translateX *
            (viewport.name === "mobile"
              ? MEDIA_MOTION_CONFIG.responsiveProjection.mobile.translateXMultiplier
              : 1);
          expect(main?.opacity, JSON.stringify(entry)).toBeCloseTo(1, 4);
          expect(mediaScene?.mainTransform?.scale, JSON.stringify(entry)).toBeCloseTo(1, 4);
          expect(mediaScene?.mainTransform?.translateX, JSON.stringify(entry)).toBeCloseTo(expectedTranslateX, 4);
          expect(mediaScene?.mainTransform?.translateY, JSON.stringify(entry)).toBeCloseTo(0, 4);
        }
        if (requestedProgress === 0.44 && framebuffer) {
          expect(framebuffer.nonBackgroundPixels, JSON.stringify(entry)).toBeGreaterThan(100);
        }

        const screenshotPath = await captureMediaCompositionScreenshot(
          page,
          `media-composition-${viewport.name}-${requestedProgress.toFixed(2)}-composited.png`,
          main?.screen?.bounds && secondary?.screen?.bounds
            ? {
              viewport,
              layers: [main.screen.bounds, secondary.screen.bounds],
            }
            : undefined,
        );
        if (requestedProgress === 0.44 && main?.screen?.bounds) {
          const visiblePixels = await countVisibleMediaPixelsInScreenshot(
            screenshotPath,
            main.screen.bounds,
            viewport,
          );
          expect(visiblePixels, `Main Media pixels must be present in the composited ${viewport.name} evidence.`)
            .toBeGreaterThan(5_000);
        }
      }

      await page.addStyleTag({
        content: "img[data-media-fallback='true'] { visibility: hidden !important; }",
      });
      const canvasSnapshot = await seekMediaProgress(page, geometry, 0.44);
      const canvasMain = canvasSnapshot.composition?.media.main;
      const canvasSecondary = canvasSnapshot.composition?.media.secondary;
      expect(isRecognizableLayer(canvasMain)).toBe(true);
      expect(isRecognizableLayer(canvasSecondary)).toBe(true);
      await captureMediaCompositionScreenshot(
        page,
        `media-composition-${viewport.name}-0.44-canvas-only.png`,
        canvasMain?.screen?.bounds && canvasSecondary?.screen?.bounds
          ? {
            viewport,
            layers: [canvasMain.screen.bounds, canvasSecondary.screen.bounds],
          }
          : undefined,
      );
    }

    await mkdir(MEDIA_COMPOSITION_EVIDENCE_DIR, { recursive: true });
    await writeFile(
      path.join(
        MEDIA_COMPOSITION_EVIDENCE_DIR,
        process.env.P4_02_4B_R3_EVIDENCE === "1"
          ? `media-composition-checkpoints-${testInfo.project.name.replace("p4b-", "")}.json`
          : "media-composition-checkpoints.json",
      ),
      `${JSON.stringify(evidence, null, 2)}\n`,
      "utf8",
    );
  });

  test("captures P4-02.4B-R1 real composited frame sequences for video evidence", async ({ page }) => {
    test.skip(
      process.env.P4_02_4B_R1_EVIDENCE !== "1",
      "R1 frame-sequence evidence is opt-in outside the visual-closure run.",
    );
    test.setTimeout(300_000);

    for (const viewport of [
      { name: "desktop", width: 1440, height: 900 },
      { name: "mobile", width: 390, height: 844 },
    ] as const) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await waitForWebGLProbe(page);
      await waitForHeroRuntimeReady(page);

      const geometry = await getSceneGeometry(page);
      const heroScrollY = resolveScrollYForProgress(
        geometry,
        "hero-scene",
        "lifecycleChapterProgress",
        0.2,
      );
      const mediaScrollY = resolveScrollYForProgress(
        geometry,
        "media-scene",
        "lifecycleMediaProgress",
        0.75,
      );
      const slowDirectory = path.join(MEDIA_COMPOSITION_EVIDENCE_DIR, "frame-sequences", viewport.name, "slow");
      await captureCompositionFrameSequence(page, slowDirectory, heroScrollY, mediaScrollY);

      const holdSnapshot = await seekMediaProgress(page, geometry, 0.44);
      expect(isRecognizableLayer(holdSnapshot.composition?.media.main)).toBe(true);
      expect(isRecognizableLayer(holdSnapshot.composition?.media.secondary)).toBe(true);
      const holdDirectory = path.join(MEDIA_COMPOSITION_EVIDENCE_DIR, "frame-sequences", viewport.name, "hold");
      const currentScrollY = await page.evaluate(() => window.scrollY);
      await captureCompositionFrameSequence(page, holdDirectory, currentScrollY, currentScrollY, 16);
    }
  });

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ] as const) {
    test(`records P4-02.4B ${viewport.name} slow Hero-to-Media composition`, async ({ page }, testInfo) => {
      test.skip(
      process.env.P4_02_4B_EVIDENCE !== "1" && process.env.P4_02_4B_R1_EVIDENCE !== "1" && process.env.P4_02_4B_R2_1_EVIDENCE !== "1" && process.env.P4_02_4B_R3_EVIDENCE !== "1",
        "Video evidence is opt-in outside the P4-02.4B review run.",
      );
      test.setTimeout(90_000);
      test.skip(
        (process.env.P4_02_4B_R1_EVIDENCE === "1" || process.env.P4_02_4B_R3_EVIDENCE === "1") && testInfo.project.name !== `p4b-${viewport.name}`,
        "R1 video evidence must use its matching context viewport.",
      );

      if (process.env.P4_02_4B_R1_EVIDENCE !== "1" && process.env.P4_02_4B_R3_EVIDENCE !== "1") {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
      }
      await page.goto("/");
      await waitForWebGLProbe(page);
      await waitForHeroRuntimeReady(page);

      const geometry = await getSceneGeometry(page);
      const heroScrollY = resolveScrollYForProgress(
        geometry,
        "hero-scene",
        "lifecycleChapterProgress",
        0.2,
      );
      const mediaScrollY = resolveScrollYForProgress(
        geometry,
        "media-scene",
        "lifecycleMediaProgress",
        0.75,
      );
      const forward = (process.env.P4_02_4B_R1_EVIDENCE === "1" || process.env.P4_02_4B_R3_EVIDENCE === "1")
        ? await captureRecordedScrollTimeline(page, heroScrollY, mediaScrollY, 120, 28)
        : await captureScrollTimeline(page, heroScrollY, mediaScrollY, 120);
      expectVisualVacuumWithinOneFrame(`${viewport.name} P4-02.4B slow forward`, forward);
      expect(forward.some((snapshot) => isRecognizableLayer(snapshot.composition?.media.main))).toBe(true);
      expect(forward.some((snapshot) => isRecognizableLayer(snapshot.composition?.media.secondary))).toBe(true);
    });

    test(`records P4-02.4B ${viewport.name} Media hold composition`, async ({ page }, testInfo) => {
      test.skip(
        process.env.P4_02_4B_R1_EVIDENCE !== "1" && process.env.P4_02_4B_R3_EVIDENCE !== "1",
        "R1 Media hold evidence is opt-in outside the visual-closure run.",
      );
      test.skip(
        testInfo.project.name !== `p4b-${viewport.name}`,
        "R1 video evidence must use its matching context viewport.",
      );

      await page.goto("/");
      await waitForWebGLProbe(page);
      await waitForHeroRuntimeReady(page);
      const geometry = await getSceneGeometry(page);
      const snapshot = await seekMediaProgress(page, geometry, 0.44);
      expect(isRecognizableLayer(snapshot.composition?.media.main)).toBe(true);
      expect(isRecognizableLayer(snapshot.composition?.media.secondary)).toBe(true);
      await settleFrames(page, 180);
    });
  }

  test.describe("Reduced motion runtime behavior", () => {
    test.use({
      contextOptions: {
        reducedMotion: "reduce",
      },
    });

    test("keeps reduced-motion scene switches stable without camera travel", async ({ page }) => {
      await page.goto("/");
      await waitForWebGLProbe(page);
      await waitForHeroRuntimeReady(page);
      await expect(page.locator("canvas.webgl-canvas")).toHaveCount(1);

      const settledSnapshot = await seekChapterProgress(
        page,
        "media-scene",
        "lifecycleMediaProgress",
        0.72,
      );
      expect(settledSnapshot.transition?.cameraBlendWeight).toBeLessThanOrEqual(0.00001);
      expect(hasRecognizableSubject(settledSnapshot)).toBe(true);
      expect(
        ["hero-scene", "media-scene", "global-idle"],
      ).toContain(settledSnapshot.transition?.cameraIntentSceneId);
      expect(await page.locator("#media").count()).toBe(1);

      const poses: Array<{
        readonly position: { readonly x: number; readonly y: number; readonly z: number };
        readonly target: { readonly x: number; readonly y: number; readonly z: number };
        readonly fov: number;
      }> = [];

      for (let index = 0; index < 5; index += 1) {
        await settleFrames(page, 1);
        const snapshot = await getProbeSnapshot(page);
        expect(snapshot.transition?.cameraBlendWeight).toBeLessThanOrEqual(0.00001);
        expect(hasRecognizableSubject(snapshot)).toBe(true);
        expect(
          [snapshot.scenes.dominant, "global-idle"],
        ).toContain(snapshot.transition?.cameraIntentSceneId);
        poses.push(snapshot.composition!.camera);
      }

      for (let index = 1; index < poses.length; index += 1) {
        const previous = poses[index - 1];
        const current = poses[index];
        const delta =
          Math.abs(current.position.x - previous.position.x) +
          Math.abs(current.position.y - previous.position.y) +
          Math.abs(current.position.z - previous.position.z) +
          Math.abs(current.target.x - previous.target.x) +
          Math.abs(current.target.y - previous.target.y) +
          Math.abs(current.target.z - previous.target.z) +
          Math.abs(current.fov - previous.fov);

        expect(delta).toBeLessThanOrEqual(0.0001);
      }
    });

    test("keeps mobile reduced-motion chapter handoff free of a visual vacuum", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto("/");
      await waitForWebGLProbe(page);
      await waitForHeroRuntimeReady(page);

      const geometry = await getSceneGeometry(page);
      const heroScrollY = resolveScrollYForProgress(
        geometry,
        "hero-scene",
        "lifecycleChapterProgress",
        0.2,
      );
      const mediaScrollY = resolveScrollYForProgress(
        geometry,
        "media-scene",
        "lifecycleMediaProgress",
        0.75,
      );

      const forward = await captureScrollTimeline(page, heroScrollY, mediaScrollY);
      const reverse = await captureScrollTimeline(page, mediaScrollY, heroScrollY);

      expectVisualVacuumWithinOneFrame("mobile reduced-motion forward", forward);
      expectVisualVacuumWithinOneFrame("mobile reduced-motion reverse", reverse);
    });

    test("keeps desktop reduced-motion chapter handoff free of a visual vacuum", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/");
      await waitForWebGLProbe(page);
      await waitForHeroRuntimeReady(page);

      const geometry = await getSceneGeometry(page);
      const heroScrollY = resolveScrollYForProgress(
        geometry,
        "hero-scene",
        "lifecycleChapterProgress",
        0.2,
      );
      const mediaScrollY = resolveScrollYForProgress(
        geometry,
        "media-scene",
        "lifecycleMediaProgress",
        0.75,
      );

      const forward = await captureScrollTimeline(page, heroScrollY, mediaScrollY);
      const reverse = await captureScrollTimeline(page, mediaScrollY, heroScrollY);

      expectVisualVacuumWithinOneFrame("desktop reduced-motion forward", forward);
      expectVisualVacuumWithinOneFrame("desktop reduced-motion reverse", reverse);
    });
  });

  test("keeps mobile forward and reverse chapter handoffs free of a visual vacuum", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForWebGLProbe(page);
    await waitForHeroRuntimeReady(page);

    const geometry = await getSceneGeometry(page);
    const heroScrollY = resolveScrollYForProgress(
      geometry,
      "hero-scene",
      "lifecycleChapterProgress",
      0.2,
    );
    const mediaScrollY = resolveScrollYForProgress(
      geometry,
      "media-scene",
      "lifecycleMediaProgress",
      0.75,
    );

    const forward = await captureScrollTimeline(page, heroScrollY, mediaScrollY);
    const reverse = await captureScrollTimeline(page, mediaScrollY, heroScrollY);

    expectVisualVacuumWithinOneFrame("mobile forward", forward);
    expectVisualVacuumWithinOneFrame("mobile reverse", reverse);
  });

  test("keeps desktop forward and reverse chapter handoffs free of a visual vacuum", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await waitForWebGLProbe(page);
    await waitForHeroRuntimeReady(page);

    const geometry = await getSceneGeometry(page);
    const heroScrollY = resolveScrollYForProgress(
      geometry,
      "hero-scene",
      "lifecycleChapterProgress",
      0.2,
    );
    const mediaScrollY = resolveScrollYForProgress(
      geometry,
      "media-scene",
      "lifecycleMediaProgress",
      0.75,
    );

    const forward = await captureScrollTimeline(page, heroScrollY, mediaScrollY);
    const reverse = await captureScrollTimeline(page, mediaScrollY, heroScrollY);

    expectVisualVacuumWithinOneFrame("desktop forward", forward);
    expectVisualVacuumWithinOneFrame("desktop reverse", reverse);
  });

  test("keeps fast forward and reverse jumps visually coherent within one frame of convergence", async ({ page }) => {
    const viewports = [
      { name: "desktop", width: 1440, height: 900 },
      { name: "mobile", width: 390, height: 844 },
    ] as const;

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await waitForWebGLProbe(page);
      await waitForHeroRuntimeReady(page);

      const geometry = await getSceneGeometry(page);
      await seekChapterProgress(page, "media-scene", "lifecycleMediaProgress", 0.22);
      const forwardFrames = await captureImmediateScrollFrames(
        page,
        resolveScrollYForProgress(geometry, "media-scene", "lifecycleMediaProgress", 0.74),
        4,
      );

      for (const [index, snapshot] of forwardFrames.entries()) {
        const evidence = JSON.stringify({
          viewport,
          direction: "forward",
          frame: index,
          transition: snapshot.transition,
          dominant: snapshot.scenes.dominant,
          camera: snapshot.composition?.camera,
          hero: snapshot.composition?.hero,
          media: snapshot.composition?.media,
        });

        if (index >= 1) {
          expect(hasRecognizableSubject(snapshot), evidence).toBe(true);
          expect(snapshot.scenes.dominant, evidence).toBe(snapshot.transition?.dominantSceneId ?? null);
          expect(
            [snapshot.scenes.dominant, "global-idle"],
            evidence,
          ).toContain(snapshot.transition?.cameraIntentSceneId);
        }
      }

      await settleFrames(page, 2);
      const forwardSettled = await getProbeSnapshot(page);
      expect(hasRecognizableSubject(forwardSettled)).toBe(true);
      expect(forwardSettled.scenes.dominant).toBe(forwardSettled.transition?.dominantSceneId ?? null);
      expect(
        [forwardSettled.scenes.dominant, "global-idle"],
      ).toContain(forwardSettled.transition?.cameraIntentSceneId);

      const reverseFrames = await captureImmediateScrollFrames(
        page,
        resolveScrollYForProgress(geometry, "hero-scene", "lifecycleChapterProgress", 0.1),
        4,
      );
      for (const [index, snapshot] of reverseFrames.entries()) {
        const evidence = JSON.stringify({
          viewport,
          direction: "reverse",
          frame: index,
          transition: snapshot.transition,
          dominant: snapshot.scenes.dominant,
          camera: snapshot.composition?.camera,
          hero: snapshot.composition?.hero,
          media: snapshot.composition?.media,
        });

        if (index >= 1) {
          expect(hasRecognizableSubject(snapshot), evidence).toBe(true);
          expect(snapshot.scenes.dominant, evidence).toBe(snapshot.transition?.dominantSceneId ?? null);
          expect(
            [snapshot.scenes.dominant, "global-idle"],
            evidence,
          ).toContain(snapshot.transition?.cameraIntentSceneId);
        }
      }

      await settleFrames(page, 2);
      const reverseSettled = await getProbeSnapshot(page);
      expect(hasRecognizableSubject(reverseSettled)).toBe(true);
      expect(reverseSettled.scenes.dominant).toBe(reverseSettled.transition?.dominantSceneId ?? null);
      expect(
        [reverseSettled.scenes.dominant, "global-idle"],
      ).toContain(reverseSettled.transition?.cameraIntentSceneId);
    }
  });

  test("keeps hero/media DOM when WebGL is unavailable", async ({ browser }: { browser: Browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      const canvasProto = HTMLCanvasElement.prototype as unknown as {
        getContext: (contextId: string, options?: Record<string, unknown>) => unknown;
      };
      const originalGetContext = canvasProto.getContext;

      canvasProto.getContext = function (
        contextId: string,
        options?: Record<string, unknown>,
      ): unknown {
        if (
          contextId === "webgl2" ||
          contextId === "webgl" ||
          contextId === "experimental-webgl"
        ) {
          return null;
        }

        return originalGetContext.call(this, contextId, options);
      };
    });

    const page = await context.newPage();
    await page.goto("/");

    await expect(page.getByText(/WebGL stage disabled/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Trevor Noah Style Experience" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Media" })).toBeVisible();
    await expect(page.locator("section#hero")).toBeVisible();
    await expect(page.locator("section#media")).toBeVisible();
    await expect(page.locator("canvas.webgl-canvas")).toHaveCount(0);
    await captureNamedScreenshot(page, "media-webgl-unavailable-desktop.png");
    const unavailableFallbackState = await readMediaFallbackImageState(page);
    expect(unavailableFallbackState.count).toBeGreaterThanOrEqual(2);
    expect(allFallbackVisible(unavailableFallbackState.states)).toBeTruthy();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("heading", { level: 2, name: "Media" })).toBeVisible();
    await expect(page.locator("section#media")).toBeVisible();
    await expect(page.locator("canvas.webgl-canvas")).toHaveCount(0);
    await captureNamedScreenshot(page, "media-webgl-unavailable-mobile.png");
    const unavailableMobileFallback = await readMediaFallbackImageState(page);
    expect(allFallbackVisible(unavailableMobileFallback.states)).toBeTruthy();

    await page.close();
    await context.close();
  });

  test("validates media fallback visibility contract", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await waitForWebGLProbe(page);
    await waitForHeroRuntimeReady(page);
    await expect(page.locator("canvas.webgl-canvas")).toHaveCount(1);

    const geometry = await getSceneGeometry(page);

    const initialState = await readMediaFallbackImageState(page);
    expect(initialState.count).toBe(2);
    expect(allFallbackVisible(initialState.states)).toBeTruthy();
    await expect(page.getByRole("heading", { level: 2, name: "Media" })).toBeVisible();

    const activeReadySnapshot = await snapshotAfterMediaProgress(page, geometry, 0.44);
    expect(activeReadySnapshot.scenes.dominant).toBe("hero-scene");
    expect(activeReadySnapshot.diagnostics.sceneSnapshots["media-scene"]?.visualReady).toBe(true);
    expect(isMediaWebGLLayerVisible(activeReadySnapshot)).toBe(true);
    await expect.poll(async () => {
      const state = await readMediaFallbackImageState(page);
      return state.states.every((image) => image.opacity === "0");
    }).toBeTruthy();

    const activeReadyState = await readMediaFallbackImageState(page);
    expect(activeReadyState.states.every((state) => state.opacity === "0")).toBeTruthy();
    await captureNamedScreenshot(page, "media-fallback-ready-active-desktop.png");

    await scrollToAndWait(page, 0);
    await waitForTransitionState(
      page,
      (snapshot) => snapshot.scenes.dominant === "hero-scene",
    );
    await expect.poll(async () => {
      const inactiveState = await readMediaFallbackImageState(page);
      return allFallbackVisible(inactiveState.states);
    }, { timeout: 8000 }).toBeTruthy();
    const inactiveState = await readMediaFallbackImageState(page);
    expect(allFallbackVisible(inactiveState.states)).toBeTruthy();
    await captureNamedScreenshot(page, "media-fallback-inactive-desktop.png");
  });

  test("keeps fallback visible while media textures are loading", async ({ page }) => {
    const mediaImageRoute = /\/assets\/media\/media-(?:stage|studio)-(?:desktop|mobile)\.webp$/;
    const delayedMediaHandler = async (route: Parameters<Page["route"]>[1] extends (
      route: infer Route,
      ...args: never[]
    ) => unknown ? Route : never) => {
      await new Promise((resolve) => {
        setTimeout(resolve, 800);
      });
      try {
        await route.continue();
      } catch (error) {
        if (!String(error).includes("already handled")) {
          throw error;
        }
      }
    };
    await page.route(mediaImageRoute, delayedMediaHandler);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await waitForWebGLProbe(page);
    await waitForHeroRuntimeReady(page);
    await expect(page.locator("canvas.webgl-canvas")).toHaveCount(1);

    const geometry = await getSceneGeometry(page);
    await scrollToAndWait(
      page,
      toScrollYForSceneProgress(
        geometry,
        geometry.heroDocumentTop,
        geometry.heroHeight,
        PRELOAD_PROGRESS,
      ),
    );

    await expect.poll(async () => {
      const state = await readMediaFallbackImageState(page);
      return allFallbackVisible(state.states);
    }, { timeout: 5000 }).toBeTruthy();
    await captureNamedScreenshot(page, "media-fallback-loading-mobile.png");

    await page.unroute(mediaImageRoute, delayedMediaHandler);
    const activeReadySnapshot = await snapshotAfterMediaProgress(page, geometry, 0.44);
    expect(activeReadySnapshot.diagnostics.sceneSnapshots["media-scene"]?.visualReady).toBe(true);
    expect(isMediaWebGLLayerVisible(activeReadySnapshot)).toBe(true);
    await expect.poll(async () => {
      const state = await readMediaFallbackImageState(page);
      return state.states.every((image) => image.opacity === "0");
    }, { timeout: 5000 }).toBeTruthy();
    await captureNamedScreenshot(page, "media-fallback-ready-after-load-mobile.png");
  });

  test("restores fallback visibility after WebGL context lost", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await waitForWebGLProbe(page);
    await waitForHeroRuntimeReady(page);
    await expect(page.locator("canvas.webgl-canvas")).toHaveCount(1);

    const geometry = await getSceneGeometry(page);
    const activeReadySnapshot = await snapshotAfterMediaProgress(page, geometry, 0.44);
    expect(activeReadySnapshot.diagnostics.sceneSnapshots["media-scene"]?.visualReady).toBe(true);
    expect(isMediaWebGLLayerVisible(activeReadySnapshot)).toBe(true);
    await expect.poll(async () => {
      const state = await readMediaFallbackImageState(page);
      return state.states.every((image) => image.opacity === "0");
    }).toBeTruthy();

    const contextLost = await page.evaluate(() => {
      const canvas = document.querySelector("canvas.webgl-canvas") as HTMLCanvasElement | null;
      if (!canvas) {
        return false;
      }

      const context = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      if (!context || typeof context.getExtension !== "function") {
        return false;
      }

      const extension = context.getExtension("WEBGL_lose_context");
      if (!extension || typeof (extension as { loseContext: () => void }).loseContext !== "function") {
        return false;
      }

      (extension as { loseContext: () => void }).loseContext();
      return true;
    });
    expect(contextLost).toBe(true);

    await expect.poll(async () => {
      const state = await readMediaFallbackImageState(page);
      return allFallbackVisible(state.states);
    }, { timeout: 8000 }).toBeTruthy();

    const postLossState = await readMediaFallbackImageState(page);
    expect(postLossState.states.every((state) => state.opacity === "1")).toBeTruthy();
    expect(postLossState.states.some((state) => state.contract === "context-lost")).toBeTruthy();
    await captureNamedScreenshot(page, "media-fallback-context-lost-desktop.png");
  });

  test("no fallback-hidden frame while media progress samples", async ({ page }) => {
    const viewports = [
      { name: "desktop", width: 1440, height: 900 },
      { name: "mobile", width: 390, height: 844 },
    ] as const;
    const progressSamples: ReadonlyArray<number> = [0.1, 0.22, 0.44, 0.66, 0.72];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await waitForWebGLProbe(page);
      await waitForHeroRuntimeReady(page);
      const geometry = await getSceneGeometry(page);

      for (const progress of progressSamples) {
        const snapshot = await snapshotAfterMediaProgress(page, geometry, progress);
        const fallbackState = await readMediaFallbackImageState(page);
        const webglMediaVisible = isMediaWebGLLayerVisible(snapshot);

        expect(fallbackState.count).toBe(2);
        if (fallbackState.states.some((state) => state.opacity === "0")) {
          expect(webglMediaVisible).toBeTruthy();
        }
      }

      await captureNamedScreenshot(page, `media-visibility-sample-${viewport.name}.png`);
    }
  });
});
