import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

type ContextLossExtension = {
  loseContext(): void;
  restoreContext(): void;
};

type AboutGPUResourceSnapshot = {
  readonly total: number;
  readonly byKind: {
    readonly texture: number;
    readonly geometry: number;
    readonly material: number;
  };
  readonly ownerCounts: Readonly<Record<string, number>>;
};

type RestorationFrameSample = {
  readonly fallbackState: string | null;
  readonly fallbackOpacity: string;
  readonly timelineItemCount: number;
  readonly timelineConnected: boolean;
  readonly aboutAssetOwnerCounts: Readonly<Record<string, number>>;
  readonly aboutResources: AboutGPUResourceSnapshot | null;
};

const EXPECTED_ABOUT_RESOURCE_OWNERS = {
  "texture:/assets/about/about-portrait-desktop.webp": 1,
  "geometry:about-scene:portrait-geometry": 1,
  "material:about-scene:portrait-material": 1,
} as const;
const ARTIFACT_ROOT = path.resolve("artifacts/p4-03-about-batch4");

test.describe("P4-03 About fallback contract", () => {
  test("keeps the portrait and timeline in DOM until the active About plane renders, then restores it on context loss", async ({ page }) => {
    await mkdir(ARTIFACT_ROOT, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await waitForProbe(page);

    const fallback = page.locator("img[data-about-fallback='true']");
    const timeline = page.locator(".about-timeline");
    await expect(fallback).toHaveCount(1);
    await expect(timeline.locator("li")).toHaveCount(4);
    await expect(fallback).toHaveCSS("opacity", "1");

    const geometry = await fallback.evaluate((image) => {
      const rect = image.getBoundingClientRect();
      return {
        top: rect.top + window.scrollY,
        viewportHeight: window.innerHeight,
      };
    });
    await page.evaluate(({ top, viewportHeight }) => {
      window.scrollTo({ top: Math.max(0, top - viewportHeight * 0.5), behavior: "instant" });
    }, geometry);

    await expect.poll(async () => fallback.getAttribute("data-about-fallback-state")).toBe("ready-active");
    await expect(fallback).toHaveCSS("opacity", "0");
    await expect(fallback).toHaveCSS("display", "block");
    await expect(timeline).toBeVisible();

    const contextLost = await page.locator("canvas.webgl-canvas").evaluate((canvas) => {
      const webglCanvas = canvas as HTMLCanvasElement;
      const context = webglCanvas.getContext("webgl2") ?? webglCanvas.getContext("webgl");
      const extension = context?.getExtension("WEBGL_lose_context");
      if (!extension) {
        return false;
      }
      (window as Window & { __aboutFallbackContextLoss?: ContextLossExtension }).__aboutFallbackContextLoss = extension;
      extension.loseContext();
      return true;
    });
    expect(contextLost).toBe(true);

    await expect.poll(async () => fallback.getAttribute("data-about-fallback-state")).toBe("context-lost");
    await expect(fallback).toHaveCSS("opacity", "1");
    await expect(timeline).toBeVisible();
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "desktop-1440x900-context-lost-fallback.png"),
    });

    const restorationFrames = await page.evaluate(async () => {
      const runtimeWindow = window as Window & {
        __aboutFallbackContextLoss?: ContextLossExtension;
        __editorialWebGLProbe?: {
          snapshot(): {
            diagnostics: {
              assetOwnerCounts: Readonly<Record<string, number>>;
              gpuResources?: Readonly<
                Record<string, AboutGPUResourceSnapshot | null>
              >;
            };
          };
        };
      };
      const image = document.querySelector<HTMLElement>(
        "img[data-about-fallback='true']",
      );
      const timeline = document.querySelector<HTMLElement>(".about-timeline");
      if (
        !runtimeWindow.__aboutFallbackContextLoss ||
        !runtimeWindow.__editorialWebGLProbe ||
        !image ||
        !timeline
      ) {
        throw new Error("About restoration evidence dependencies are unavailable.");
      }

      const samples: RestorationFrameSample[] = [];
      const sample = (): RestorationFrameSample => {
        const diagnostics =
          runtimeWindow.__editorialWebGLProbe!.snapshot().diagnostics;
        return {
          fallbackState: image.dataset.aboutFallbackState ?? null,
          fallbackOpacity: getComputedStyle(image).opacity,
          timelineItemCount: timeline.querySelectorAll("li").length,
          timelineConnected: timeline.isConnected,
          aboutAssetOwnerCounts: Object.fromEntries(
            Object.entries(diagnostics.assetOwnerCounts).filter(([assetId]) =>
              assetId.startsWith("about-portrait-dev-host-01"),
            ),
          ),
          aboutResources:
            diagnostics.gpuResources?.["about-scene"] ?? null,
        };
      };

      samples.push(sample());
      runtimeWindow.__aboutFallbackContextLoss.restoreContext();
      for (let frame = 0; frame < 120; frame += 1) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const current = sample();
        samples.push(current);
        if (
          current.fallbackState === "ready-active" &&
          current.fallbackOpacity === "0" &&
          current.aboutResources?.total === 3
        ) {
          break;
        }
      }
      return samples;
    });

    expect(restorationFrames.length).toBeGreaterThan(1);
    for (const frame of restorationFrames) {
      expect(frame.timelineConnected).toBe(true);
      expect(frame.timelineItemCount).toBe(4);
      if (frame.fallbackState === "ready-active") {
        expect(frame.fallbackOpacity).toBe("0");
      } else {
        expect(frame.fallbackOpacity).toBe("1");
      }
    }

    const restored = restorationFrames.at(-1);
    expect(restored?.fallbackState).toBe("ready-active");
    expect(restored?.fallbackOpacity).toBe("0");
    expect(restored?.aboutAssetOwnerCounts).toEqual({
      "about-portrait-dev-host-01:desktop": 1,
    });
    expect(restored?.aboutResources).toEqual({
      total: 3,
      byKind: { texture: 1, geometry: 1, material: 1 },
      ownerCounts: EXPECTED_ABOUT_RESOURCE_OWNERS,
    });
    await page.screenshot({
      path: path.join(ARTIFACT_ROOT, "desktop-1440x900-context-restored.png"),
    });
    await captureMobileContextEvidence(page);
  });
});

async function captureMobileContextEvidence(page: Page): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await waitForProbe(page);

  const fallback = page.locator("img[data-about-fallback='true']");
  const geometry = await fallback.evaluate((image) => {
    const rect = image.getBoundingClientRect();
    return { top: rect.top + window.scrollY, viewportHeight: window.innerHeight };
  });
  await page.evaluate(({ top, viewportHeight }) => {
    window.scrollTo({ top: Math.max(0, top - viewportHeight * 0.5), behavior: "instant" });
  }, geometry);
  await expect.poll(async () => fallback.getAttribute("data-about-fallback-state")).toBe("ready-active");

  const contextLost = await page.locator("canvas.webgl-canvas").evaluate((canvas) => {
    const context = (canvas as HTMLCanvasElement).getContext("webgl2") ??
      (canvas as HTMLCanvasElement).getContext("webgl");
    const extension = context?.getExtension("WEBGL_lose_context");
    if (!extension) return false;
    (window as Window & { __aboutFallbackContextLoss?: ContextLossExtension }).__aboutFallbackContextLoss = extension;
    extension.loseContext();
    return true;
  });
  expect(contextLost).toBe(true);
  await expect.poll(async () => fallback.getAttribute("data-about-fallback-state")).toBe("context-lost");
  await page.screenshot({
    path: path.join(ARTIFACT_ROOT, "mobile-390x844-context-lost-fallback.png"),
  });

  await page.evaluate(() => {
    (window as Window & { __aboutFallbackContextLoss?: ContextLossExtension })
      .__aboutFallbackContextLoss?.restoreContext();
  });
  await expect.poll(async () => fallback.getAttribute("data-about-fallback-state")).toBe("ready-active");
  await page.screenshot({
    path: path.join(ARTIFACT_ROOT, "mobile-390x844-context-restored.png"),
  });
}

async function waitForProbe(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() =>
    typeof (window as unknown as {
      __editorialWebGLProbe?: { snapshot(): unknown };
    }).__editorialWebGLProbe?.snapshot === "function",
  )).toBe(true);
}
