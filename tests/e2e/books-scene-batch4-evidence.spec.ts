import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { writeBooksBatch4ArtifactManifest } from "./books-scene-batch4-artifacts";

type ContextLossExtension = {
  loseContext(): void;
  restoreContext(): void;
};

type Probe = {
  readonly canvasCount: number;
  readonly drawCalls: number;
  readonly scenes: {
    readonly dominant: string | null;
  };
  readonly transition: {
    readonly cameraIntentSceneId: string | null;
  } | null;
  readonly composition: {
    readonly books: {
      readonly covers: readonly {
        readonly rendered: boolean;
        readonly visible: boolean;
        readonly frustumVisible: boolean;
        readonly opacity: number;
        readonly screen: {
          readonly bounds: {
            readonly left: number;
            readonly right: number;
            readonly top: number;
            readonly bottom: number;
          };
        } | null;
      }[];
      readonly roleOrder: readonly string[];
      readonly supportingVisibility: {
        readonly leftExposedFraction: number;
        readonly rightExposedFraction: number;
      };
      readonly motion: Readonly<Record<string, unknown>>;
      readonly allTexturesReady: boolean;
      readonly allCoversRendered: boolean;
    } | null;
  } | null;
  readonly diagnostics: {
    readonly sceneStates: Readonly<Record<string, unknown>>;
    readonly sceneSnapshots: Readonly<Record<string, unknown>>;
    readonly assetOwnerCounts: Readonly<Record<string, number>>;
    readonly gpuResources: Readonly<Record<string, unknown>>;
  };
};

const ARTIFACT_ROOT = path.resolve(
  "artifacts/p4-04-books-batch4/final",
);
const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1_440, height: 900 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

test.describe("P4-04 Books Batch 4 final evidence", () => {
  test.beforeAll(async () => {
    await mkdir(ARTIFACT_ROOT, { recursive: true });
  });

  for (const viewport of VIEWPORTS) {
    test(`captures the final state matrix at ${viewport.name}`, async ({
      page,
    }) => {
      test.setTimeout(90_000);
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await waitForProbe(page);

      await seekElementTop(page, "quote", viewport.height * 0.5);
      await expect
        .poll(async () => (await readProbe(page)).transition?.cameraIntentSceneId)
        .toBe("global-idle");
      await capture(page, viewport.name, "quote-hold");

      await seekElementTop(page, "books", viewport.height * 0.55);
      await expect
        .poll(
          async () =>
            Boolean(
              (await readProbe(page)).diagnostics.sceneSnapshots[
                "books-scene"
              ],
            ),
        )
        .toBe(true);
      await capture(page, viewport.name, "books-first-active");

      await waitForBooks(page);
      await capture(page, viewport.name, "books-visual-ready");
      await capture(page, viewport.name, "books-dominant");

      await seekBooksProgress(page, 0.15);
      await waitForBooks(page);
      await capture(page, viewport.name, "books-enter-midpoint");

      await seekElementTop(page, "books", -1);
      await waitForBooks(page);
      await waitForStableCoverBounds(page);
      await capture(page, viewport.name, "books-hold");
      await capture(page, viewport.name, "normal-composited");
      const holdMetrics = await readMetrics(page);

      const canvasOnlyStyle = await page.addStyleTag({
        content:
          ".experience-main{opacity:0!important}.section-surface,.books-cover-stage{backdrop-filter:none!important;background:transparent!important;box-shadow:none!important;border-color:transparent!important}",
      });
      await settleFrames(page, 2);
      await capture(page, viewport.name, "canvas-only");
      await canvasOnlyStyle.evaluate((node) => node.parentNode?.removeChild(node));

      await seekBooksProgress(page, 0.72);
      await settleFrames(page, 4);
      await capture(page, viewport.name, "books-depart");

      await seekElementTop(page, "quote", viewport.height * 0.5);
      await expect
        .poll(async () => (await readProbe(page)).transition?.cameraIntentSceneId)
        .toBe("global-idle");
      await seekElementTop(page, "books", -1);
      await waitForBooks(page);
      await waitForStableCoverBounds(page);
      await capture(page, viewport.name, "reverse-hold");
      const reverseMetrics = await readMetrics(page);
      expectBoundsEquivalent(
        reverseMetrics.projectedBounds,
        holdMetrics.projectedBounds,
      );

      await page.evaluate(() => window.scrollTo(0, 0));
      await settleFrames(page, 1);
      await seekElementTop(page, "books", -1);
      await waitForBooks(page);
      await capture(page, viewport.name, "fast-final");

      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForProbe(page);
      await seekElementTop(page, "books", -1);
      await waitForBooks(page);
      await expect
        .poll(async () => {
          const snapshot = await readProbe(page);
          return (
            snapshot.diagnostics.sceneSnapshots["books-scene"] as {
              readonly reducedMotion?: boolean;
            }
          )?.reducedMotion;
        })
        .toBe(true);
      await capture(page, viewport.name, "reduced-motion-hold");

      const extensionAvailable = await loseContext(page);
      expect(extensionAvailable).toBe(true);
      await expect
        .poll(() => readFallbackOpacity(page))
        .toEqual(["1", "1", "1"]);
      await capture(page, viewport.name, "context-lost");
      await restoreContext(page);
      await expect
        .poll(() => readFallbackOpacity(page), { timeout: 20_000 })
        .toEqual(["0", "0", "0"]);
      await waitForBooks(page);
      await capture(page, viewport.name, "context-restored");

      const restoredMetrics = await readMetrics(page);
      expect(restoredMetrics.resources.booksGPU).toMatchObject({
        total: 7,
        byKind: { texture: 3, geometry: 1, material: 3 },
      });
      expect(restoredMetrics.horizontalOverflow).toBe(0);

      await writeFile(
        path.join(ARTIFACT_ROOT, `${viewport.name}-metrics.json`),
        JSON.stringify(
          {
            environment: {
              url: "http://127.0.0.1:3100/",
              viewport,
              timestamp: new Date().toISOString(),
            },
            hold: holdMetrics,
            reverse: reverseMetrics,
            restored: restoredMetrics,
          },
          null,
          2,
        ),
      );
    });

    test(`captures unavailable grouped fallback at ${viewport.name}`, async ({
      page,
    }) => {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          contextId,
          ...args
        ) {
          if (String(contextId).includes("webgl")) {
            return null;
          }
          return Reflect.apply(original, this, [contextId, ...args]);
        } as typeof HTMLCanvasElement.prototype.getContext;
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await seekElementTop(page, "books", -1);
      await expect
        .poll(() => readFallbackOpacity(page))
        .toEqual(["1", "1", "1"]);
      await expect
        .poll(() =>
          page
            .locator("img[data-books-fallback='true']")
            .evaluateAll((images) =>
              images.map(
                (image) =>
                  (image as HTMLImageElement).dataset
                    .booksFallbackState ?? "",
              ),
            ),
        )
        .toEqual(["unavailable", "unavailable", "unavailable"]);
      await capture(page, viewport.name, "unavailable-fallback");
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - innerWidth,
        ),
      ).toBeLessThanOrEqual(0);
    });
  }

  test.afterAll(async () => {
    await writeBooksBatch4ArtifactManifest();
  });
});

async function waitForProbe(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          typeof (
            window as unknown as {
              __editorialWebGLProbe?: { snapshot(): unknown };
            }
          ).__editorialWebGLProbe?.snapshot === "function",
      ),
    )
    .toBe(true);
}

async function readProbe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const probe = (
      window as unknown as {
        __editorialWebGLProbe?: { snapshot(): Probe };
      }
    ).__editorialWebGLProbe;
    if (!probe) {
      throw new Error("WebGL probe is unavailable.");
    }
    return probe.snapshot();
  });
}

async function waitForBooks(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const snapshot = await readProbe(page);
      return {
        dominant: snapshot.scenes.dominant,
        camera: snapshot.transition?.cameraIntentSceneId,
        rendered:
          snapshot.composition?.books?.allCoversRendered ?? false,
        fallback: await readFallbackOpacity(page),
      };
    })
    .toEqual({
      dominant: "books-scene",
      camera: "books-scene",
      rendered: true,
      fallback: ["0", "0", "0"],
    });
}

async function seekElementTop(
  page: Page,
  id: string,
  targetTop: number,
): Promise<void> {
  const scrollTop = await page.evaluate(
    ({ elementId, top }) => {
      const element = document.getElementById(elementId);
      if (!element) {
        throw new Error(`Missing element "${elementId}".`);
      }
      return Math.max(
        0,
        Math.min(
          element.getBoundingClientRect().top + scrollY - top,
          document.documentElement.scrollHeight - innerHeight,
        ),
      );
    },
    { elementId: id, top: targetTop },
  );
  await page.evaluate((top) => window.scrollTo(0, top), scrollTop);
  await settleFrames(page, 4);
}

async function seekBooksProgress(
  page: Page,
  progress: number,
): Promise<void> {
  const scrollTop = await page.evaluate((targetProgress) => {
    const section = document.getElementById("books");
    if (!section) {
      throw new Error("Missing Books section.");
    }
    const rect = section.getBoundingClientRect();
    const documentTop = rect.top + scrollY;
    const targetTop =
      innerHeight - targetProgress * (innerHeight + rect.height);
    return Math.max(
      0,
      Math.min(
        documentTop - targetTop,
        document.documentElement.scrollHeight - innerHeight,
      ),
    );
  }, progress);
  await page.evaluate((top) => window.scrollTo(0, top), scrollTop);
  await settleFrames(page, 4);
}

async function readMetrics(page: Page) {
  return page.evaluate(() => {
    const probe = (
      window as unknown as {
        __editorialWebGLProbe?: { snapshot(): Probe };
      }
    ).__editorialWebGLProbe;
    if (!probe) {
      throw new Error("WebGL probe is unavailable.");
    }
    const snapshot = probe.snapshot();
    const books = snapshot.composition?.books;
    const bounds = (selector: string) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        return null;
      }
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    };
    const area = (rect: ReturnType<typeof bounds>) =>
      rect ? Math.max(0, rect.width) * Math.max(0, rect.height) : 0;
    const visibleArea = (rect: ReturnType<typeof bounds>) =>
      rect
        ? Math.max(
            0,
            Math.min(innerWidth, rect.right) - Math.max(0, rect.left),
          ) *
          Math.max(
            0,
            Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top),
          )
        : 0;
    const projectedBounds =
      books?.covers.map((cover) => cover.screen?.bounds ?? null) ?? [];

    return {
      viewport: {
        width: innerWidth,
        height: innerHeight,
        dpr: devicePixelRatio,
      },
      scrollY,
      projectedBounds,
      projectedAreas: projectedBounds.map((rect) =>
        rect
          ? (rect.right - rect.left) * (rect.bottom - rect.top)
          : 0,
      ),
      projectedVisibleAreas: projectedBounds.map((rect) =>
        rect
          ? Math.max(
              0,
              Math.min(innerWidth, rect.right) - Math.max(0, rect.left),
            ) *
            Math.max(
              0,
              Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top),
            )
          : 0,
      ),
      materialOpacities:
        books?.covers.map((cover) => cover.opacity) ?? [],
      supportingVisibility: books?.supportingVisibility ?? null,
      motion: books?.motion ?? null,
      dom: {
        stage: bounds("#books-cover-stage"),
        reading: bounds("#books .books-reading"),
        heading: bounds("#books h2"),
        description: bounds("#books .books-intro"),
        primaryArticle: bounds("#books article"),
        primaryCTA: bounds("#books article button"),
        quote: bounds("#quote"),
        quoteVisibleArea: visibleArea(bounds("#quote")),
        primaryCTAVisibleArea: visibleArea(
          bounds("#books article button"),
        ),
        primaryArticleArea: area(bounds("#books article")),
      },
      horizontalOverflow: Math.max(
        0,
        document.documentElement.scrollWidth - innerWidth,
      ),
      dominantSceneId: snapshot.scenes.dominant,
      cameraIntentSource: snapshot.transition?.cameraIntentSceneId ?? null,
      fallback: Array.from(
        document.querySelectorAll<HTMLImageElement>(
          "img[data-books-fallback='true']",
        ),
      ).map((image) => ({
        id: image.dataset.bookId,
        state: image.dataset.booksFallbackState,
        opacity: getComputedStyle(image).opacity,
      })),
      resources: {
        canvasCount: snapshot.canvasCount,
        drawCalls: snapshot.drawCalls,
        cpuOwners: snapshot.diagnostics.assetOwnerCounts,
        booksGPU: snapshot.diagnostics.gpuResources["books-scene"],
      },
    };
  });
}

async function loseContext(page: Page): Promise<boolean> {
  return page.locator("canvas.webgl-canvas").evaluate((canvas) => {
    const context =
      (canvas as HTMLCanvasElement).getContext("webgl2") ??
      (canvas as HTMLCanvasElement).getContext("webgl");
    const extension = context?.getExtension("WEBGL_lose_context");
    if (!extension) {
      return false;
    }
    (
      window as Window & {
        __booksBatch4ContextLoss?: ContextLossExtension;
      }
    ).__booksBatch4ContextLoss = extension;
    extension.loseContext();
    return true;
  });
}

async function restoreContext(page: Page): Promise<void> {
  await page.evaluate(() => {
    const extension = (
      window as Window & {
        __booksBatch4ContextLoss?: ContextLossExtension;
      }
    ).__booksBatch4ContextLoss;
    if (!extension) {
      throw new Error("Context-loss extension is unavailable.");
    }
    extension.restoreContext();
  });
}

async function readFallbackOpacity(page: Page): Promise<string[]> {
  return page
    .locator("img[data-books-fallback='true']")
    .evaluateAll((images) =>
      images.map((image) => getComputedStyle(image).opacity),
    );
}

async function waitForStableCoverBounds(page: Page): Promise<void> {
  let previous: readonly ({
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  } | null)[] | null = null;

  await expect
    .poll(
      async () => {
        const snapshot = await readProbe(page);
        const current =
          snapshot.composition?.books?.covers.map(
            (cover) => cover.screen?.bounds ?? null,
          ) ?? [];
        if (!previous || current.length !== previous.length) {
          previous = current;
          return Number.POSITIVE_INFINITY;
        }
        let maximumDelta = 0;
        for (let index = 0; index < current.length; index += 1) {
          const currentBounds = current[index];
          const previousBounds = previous[index];
          if (!currentBounds || !previousBounds) {
            maximumDelta = Number.POSITIVE_INFINITY;
            break;
          }
          for (const edge of ["left", "right", "top", "bottom"] as const) {
            maximumDelta = Math.max(
              maximumDelta,
              Math.abs(currentBounds[edge] - previousBounds[edge]),
            );
          }
        }
        previous = current;
        return maximumDelta;
      },
      { timeout: 20_000, intervals: [50, 100, 150, 250] },
    )
    .toBeLessThanOrEqual(0.25);
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

async function capture(
  page: Page,
  viewportName: string,
  stateName: string,
): Promise<void> {
  await page.screenshot({
    path: path.join(
      ARTIFACT_ROOT,
      `${viewportName}-${stateName}.png`,
    ),
    animations: "disabled",
  });
}

function expectBoundsEquivalent(
  actual: readonly ({
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  } | null)[],
  expected: readonly ({
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  } | null)[],
): void {
  expect(actual).toHaveLength(expected.length);
  for (let index = 0; index < expected.length; index += 1) {
    const actualBounds = actual[index];
    const expectedBounds = expected[index];
    expect(actualBounds).not.toBeNull();
    expect(expectedBounds).not.toBeNull();
    if (!actualBounds || !expectedBounds) {
      continue;
    }
    for (const edge of ["left", "right", "top", "bottom"] as const) {
      expect(Math.abs(actualBounds[edge] - expectedBounds[edge])).toBeLessThanOrEqual(
        0.5,
      );
    }
  }
}
