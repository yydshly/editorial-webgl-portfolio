import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type CadenceSample = {
  readonly timestamp: number;
  readonly rawRafDeltaMs: number;
  readonly coordinatorIntervalMs: number;
  readonly renderSubmitCostMs: number;
  readonly frameTimeMs: number;
  readonly drawCalls: number;
  readonly schedulerRunning: boolean;
  readonly schedulerPaused: boolean;
  readonly schedulerLowUpdate: boolean;
  readonly tier: string;
  readonly frameDivisor: number;
};

type RenderQualityAudit = {
  readonly viewport: { readonly width: number; readonly height: number };
  readonly browser: {
    readonly devicePixelRatio: number;
    readonly visibilityState: string;
    readonly hasFocus: boolean;
  };
  readonly canvas: {
    readonly cssWidth: number;
    readonly cssHeight: number;
    readonly drawingBufferWidth: number;
    readonly drawingBufferHeight: number;
    readonly cssTransform: string;
  };
  readonly gl: {
    readonly drawingBufferWidth: number;
    readonly drawingBufferHeight: number;
    readonly maxAnisotropy: number;
    readonly vendor: string;
    readonly renderer: string;
    readonly unmaskedVendor: string | null;
    readonly unmaskedRenderer: string | null;
  };
  readonly media: {
    readonly main: {
      readonly source: string | null;
      readonly decodedWidth: number;
      readonly decodedHeight: number;
      readonly minFilter: string | null;
      readonly magFilter: string | null;
      readonly generateMipmaps: boolean | null;
      readonly anisotropy: number | null;
      readonly colorSpace: string | null;
      readonly premultiplyAlpha: boolean | null;
      readonly flipY: boolean | null;
      readonly projectedWidth: number;
      readonly projectedHeight: number;
      readonly texelsPerScreenPixelX: number;
      readonly texelsPerScreenPixelY: number;
      readonly materialOpacity: number | undefined;
    };
  };
  readonly rendererDpr: number;
  readonly samples: readonly CadenceSample[];
};

function percentile(values: readonly number[], ratio: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
}

async function waitForProbe(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => {
    return Boolean((window as unknown as {
      __editorialWebGLProbe?: { snapshot: () => unknown };
    }).__editorialWebGLProbe);
  })).toBe(true);
}

async function collectAudit(
  page: Page,
  viewport: { readonly width: number; readonly height: number },
): Promise<RenderQualityAudit> {
  await page.setViewportSize(viewport);
  await page.goto("/");
  await waitForProbe(page);
  await page.evaluate(async () => {
    document.querySelector("section#media")?.scrollIntoView({ block: "center" });
    await new Promise<void>((resolve) => {
      let remaining = 20;
      const settle = (): void => {
        remaining -= 1;
        if (remaining <= 0) {
          resolve();
          return;
        }
        window.requestAnimationFrame(settle);
      };
      window.requestAnimationFrame(settle);
    });
  });

  return page.evaluate(async (targetViewport) => {
    type ProbeSnapshot = {
      readonly render: {
        readonly isRunning: boolean;
        readonly isPaused: boolean;
        readonly isLowUpdateMode: boolean;
        readonly tier: string;
        readonly tierProfile: { readonly frameDivisor: number };
        readonly frameIntervalMs: number;
        readonly renderSubmitCostMs: number;
        readonly frameTimeMs: number;
        readonly drawCalls: number;
        readonly dpr: number;
      };
      readonly composition: {
        readonly media: {
          readonly main: {
            readonly opacity?: number;
            readonly screen?: {
              readonly bounds: {
                readonly left: number;
                readonly right: number;
                readonly top: number;
                readonly bottom: number;
              };
            };
          };
          readonly textureSampling?: {
            readonly main: {
              readonly source: string | null;
              readonly decodedWidth: number;
              readonly decodedHeight: number;
              readonly minFilter: string | null;
              readonly magFilter: string | null;
              readonly generateMipmaps: boolean | null;
              readonly anisotropy: number | null;
              readonly colorSpace: string | null;
              readonly premultiplyAlpha: boolean | null;
              readonly flipY: boolean | null;
            };
          };
        };
      } | null;
    };
    const probe = (window as unknown as {
      __editorialWebGLProbe: { snapshot: () => ProbeSnapshot };
    }).__editorialWebGLProbe;
    const canvas = document.querySelector("canvas.webgl-canvas") as HTMLCanvasElement;
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    const ext = gl?.getExtension("EXT_texture_filter_anisotropic")
      ?? gl?.getExtension("WEBKIT_EXT_texture_filter_anisotropic")
      ?? gl?.getExtension("MOZ_EXT_texture_filter_anisotropic");
    const maxAnisotropy = ext && gl
      ? Number(gl.getParameter((ext as { MAX_TEXTURE_MAX_ANISOTROPY_EXT: number }).MAX_TEXTURE_MAX_ANISOTROPY_EXT))
      : 1;
    const debugInfo = gl?.getExtension("WEBGL_debug_renderer_info") as {
      readonly UNMASKED_VENDOR_WEBGL: number;
      readonly UNMASKED_RENDERER_WEBGL: number;
    } | null;
    const samples: CadenceSample[] = [];
    let previousTimestamp = 0;

    await new Promise<void>((resolve) => {
      const collect = (timestamp: number): void => {
        const snapshot = probe.snapshot();
        samples.push({
          timestamp,
          rawRafDeltaMs: previousTimestamp === 0 ? 0 : timestamp - previousTimestamp,
          coordinatorIntervalMs: snapshot.render.frameIntervalMs,
          renderSubmitCostMs: snapshot.render.renderSubmitCostMs,
          frameTimeMs: snapshot.render.frameTimeMs,
          drawCalls: snapshot.render.drawCalls,
          schedulerRunning: snapshot.render.isRunning,
          schedulerPaused: snapshot.render.isPaused,
          schedulerLowUpdate: snapshot.render.isLowUpdateMode,
          tier: snapshot.render.tier,
          frameDivisor: snapshot.render.tierProfile.frameDivisor,
        });
        previousTimestamp = timestamp;
        if (samples.length >= 90) {
          resolve();
          return;
        }
        window.requestAnimationFrame(collect);
      };
      window.requestAnimationFrame(collect);
    });

    const settled = probe.snapshot();
    const mainBounds = settled.composition?.media.main.screen?.bounds;
    const texture = settled.composition?.media.textureSampling?.main;
    const projectedWidth = mainBounds ? mainBounds.right - mainBounds.left : 0;
    const projectedHeight = mainBounds ? mainBounds.bottom - mainBounds.top : 0;
    const computed = window.getComputedStyle(canvas);

    return {
      viewport: targetViewport,
      browser: {
        devicePixelRatio: window.devicePixelRatio,
        visibilityState: document.visibilityState,
        hasFocus: document.hasFocus(),
      },
      canvas: {
        cssWidth: canvas.getBoundingClientRect().width,
        cssHeight: canvas.getBoundingClientRect().height,
        drawingBufferWidth: canvas.width,
        drawingBufferHeight: canvas.height,
        cssTransform: computed.transform,
      },
      gl: {
        drawingBufferWidth: gl?.drawingBufferWidth ?? 0,
        drawingBufferHeight: gl?.drawingBufferHeight ?? 0,
        maxAnisotropy,
        vendor: gl ? String(gl.getParameter(gl.VENDOR)) : "unavailable",
        renderer: gl ? String(gl.getParameter(gl.RENDERER)) : "unavailable",
        unmaskedVendor: debugInfo && gl
          ? String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL))
          : null,
        unmaskedRenderer: debugInfo && gl
          ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL))
          : null,
      },
      media: {
        main: {
          source: texture?.source ?? null,
          decodedWidth: texture?.decodedWidth ?? 0,
          decodedHeight: texture?.decodedHeight ?? 0,
          minFilter: texture?.minFilter ?? null,
          magFilter: texture?.magFilter ?? null,
          generateMipmaps: texture?.generateMipmaps ?? null,
          anisotropy: texture?.anisotropy ?? null,
          colorSpace: texture?.colorSpace ?? null,
          premultiplyAlpha: texture?.premultiplyAlpha ?? null,
          flipY: texture?.flipY ?? null,
          projectedWidth,
          projectedHeight,
          texelsPerScreenPixelX: projectedWidth > 0 ? (texture?.decodedWidth ?? 0) / projectedWidth : 0,
          texelsPerScreenPixelY: projectedHeight > 0 ? (texture?.decodedHeight ?? 0) / projectedHeight : 0,
          materialOpacity: settled.composition?.media.main.opacity,
        },
      },
      rendererDpr: settled.render.dpr,
      samples,
    };
  }, viewport);
}

test.describe("P4-02.4B-R2 render-quality baseline", () => {
  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "mobile", width: 390, height: 844 },
  ] as const) {
    test(`records native RAF, coordinator, renderer, canvas, and texture layers on ${viewport.name}`, async ({ page }, testInfo) => {
      const audit = await collectAudit(page, viewport);
      const rawDeltas = audit.samples.slice(1).map((sample) => sample.rawRafDeltaMs);
      const coordinatorDeltas = audit.samples.slice(1).map((sample) => sample.coordinatorIntervalMs);
      const output = {
        ...audit,
        summary: {
          rawRaf: {
            count: rawDeltas.length,
            min: Math.min(...rawDeltas),
            median: percentile(rawDeltas, 0.5),
            p95: percentile(rawDeltas, 0.95),
            max: Math.max(...rawDeltas),
            over80: rawDeltas.filter((value) => value >= 80).length,
          },
          coordinator: {
            count: coordinatorDeltas.length,
            min: Math.min(...coordinatorDeltas),
            median: percentile(coordinatorDeltas, 0.5),
            p95: percentile(coordinatorDeltas, 0.95),
            max: Math.max(...coordinatorDeltas),
            over80: coordinatorDeltas.filter((value) => value >= 80).length,
          },
        },
      };
      const artifactPath = path.resolve("artifacts/p4-02.4b-r2", `render-quality-${viewport.name}-${testInfo.project.name}.json`);
      await mkdir(path.dirname(artifactPath), { recursive: true });
      await writeFile(artifactPath, `${JSON.stringify(output, null, 2)}\n`);
      await testInfo.attach(`render-quality-${viewport.name}`, {
        body: JSON.stringify(output, null, 2),
        contentType: "application/json",
      });

      expect(audit.canvas.drawingBufferWidth).toBeGreaterThanOrEqual(
        Math.floor(audit.canvas.cssWidth * audit.rendererDpr),
      );
      expect(audit.canvas.drawingBufferHeight).toBeGreaterThanOrEqual(
        Math.floor(audit.canvas.cssHeight * audit.rendererDpr),
      );
      expect(audit.canvas.cssTransform).toBe("none");
      expect(audit.media.main.decodedWidth).toBeGreaterThan(0);
      expect(audit.media.main.decodedHeight).toBeGreaterThan(0);
      expect(audit.media.main.texelsPerScreenPixelX).toBeGreaterThan(1);
      expect(audit.media.main.texelsPerScreenPixelY).toBeGreaterThan(1);
      expect(audit.samples.every((sample) => sample.schedulerRunning && !sample.schedulerPaused)).toBe(true);
      expect(audit.samples.every((sample) => sample.frameDivisor === 1 && !sample.schedulerLowUpdate)).toBe(true);
    });
  }
});
