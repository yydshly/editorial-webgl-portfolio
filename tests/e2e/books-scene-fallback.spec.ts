import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

type ContextLossExtension = {
  loseContext(): void;
  restoreContext(): void;
};

type BooksGPUResourceSnapshot = {
  readonly total: number;
  readonly byKind: {
    readonly texture: number;
    readonly geometry: number;
    readonly material: number;
  };
  readonly ownerCounts: Readonly<Record<string, number>>;
};

type BooksProbeSnapshot = {
  readonly canvasCount: number;
  readonly scenes: { readonly dominant: string | null };
  readonly composition: {
    readonly books: {
      readonly allTexturesReady: boolean;
      readonly allCoversRendered: boolean;
      readonly covers: ReadonlyArray<{
        readonly rendered: boolean;
        readonly visible: boolean;
        readonly frustumVisible: boolean;
      }>;
    } | null;
  } | null;
  readonly diagnostics: {
    readonly assetOwnerCounts: Readonly<Record<string, number>>;
    readonly gpuResources: Readonly<
      Record<string, BooksGPUResourceSnapshot | null>
    >;
  };
};

type RestorationSample = {
  readonly states: readonly string[];
  readonly opacities: readonly string[];
  readonly pointerEvents: readonly string[];
  readonly stageState: string | null;
  readonly fallbackCount: number;
  readonly articleCount: number;
  readonly allFallbackImagesConnected: boolean;
  readonly booksDominant: boolean;
  readonly allTexturesReady: boolean;
  readonly allCoversRendered: boolean;
  readonly booksAssetOwnerCounts: Readonly<Record<string, number>>;
  readonly booksResources: BooksGPUResourceSnapshot | null;
};

const ARTIFACT_ROOT = path.resolve("artifacts/p4-04-books-batch3");
const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1_440, height: 900 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

test.describe("P4-04 Books grouped fallback and context restoration", () => {
  for (const viewport of VIEWPORTS) {
    test(`keeps all three fallback covers atomic through context loss on ${viewport.name}`, async ({
      page,
    }) => {
      test.setTimeout(45_000);
      await mkdir(ARTIFACT_ROOT, { recursive: true });
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await waitForProbe(page);

      const initialFallback = await readFallback(page);
      expect(initialFallback.states).toHaveLength(3);
      expect(new Set(initialFallback.states).size).toBe(1);
      expect(new Set(initialFallback.opacities)).toEqual(new Set(["1"]));

      await seekBooksCoverStage(page);
      await expect
        .poll(async () => {
          const fallback = await readFallback(page);
          return {
            states: fallback.states,
            opacities: fallback.opacities,
            display: fallback.display,
          };
        })
        .toEqual({
          states: ["ready-active", "ready-active", "ready-active"],
          opacities: ["0", "0", "0"],
          display: ["block", "block", "block"],
        });

      const contextLost = await page
        .locator("canvas.webgl-canvas")
        .evaluate((canvas) => {
          const webglCanvas = canvas as HTMLCanvasElement;
          const context =
            webglCanvas.getContext("webgl2") ??
            webglCanvas.getContext("webgl");
          const extension = context?.getExtension("WEBGL_lose_context");
          if (!extension) {
            return false;
          }
          (
            window as Window & {
              __booksContextLoss?: ContextLossExtension;
            }
          ).__booksContextLoss = extension;
          extension.loseContext();
          return true;
        });
      expect(contextLost).toBe(true);

      await expect
        .poll(async () => readFallback(page))
        .toMatchObject({
          states: ["context-lost", "context-lost", "context-lost"],
          opacities: ["1", "1", "1"],
          display: ["block", "block", "block"],
        });
      await page.screenshot({
        path: path.join(
          ARTIFACT_ROOT,
          `${viewport.name}-context-lost-fallback.png`,
        ),
        animations: "disabled",
      });

      const restorationFrames = await collectRestorationFrames(page);
      expect(restorationFrames.length).toBeGreaterThan(1);
      for (const frame of restorationFrames) {
        expect(frame.fallbackCount).toBe(3);
        expect(frame.articleCount).toBe(3);
        expect(frame.allFallbackImagesConnected).toBe(true);
        expect(new Set(frame.states).size).toBe(1);
        expect(new Set(frame.opacities).size).toBe(1);
        expect(new Set(frame.pointerEvents).size).toBe(1);

        const fallbackHidden = frame.opacities[0] === "0";
        if (fallbackHidden) {
          expect(frame.states).toEqual([
            "ready-active",
            "ready-active",
            "ready-active",
          ]);
          expect(frame.booksDominant).toBe(true);
          expect(frame.allTexturesReady).toBe(true);
          expect(frame.allCoversRendered).toBe(true);
        } else {
          expect(frame.opacities).toEqual(["1", "1", "1"]);
        }
      }

      const restored = restorationFrames.at(-1);
      expect(restored).toMatchObject({
        states: ["ready-active", "ready-active", "ready-active"],
        opacities: ["0", "0", "0"],
        pointerEvents: ["none", "none", "none"],
        stageState: "ready-active",
        fallbackCount: 3,
        articleCount: 3,
        allFallbackImagesConnected: true,
        booksDominant: true,
        allTexturesReady: true,
        allCoversRendered: true,
        booksResources: {
          total: 7,
          byKind: { texture: 3, geometry: 1, material: 3 },
        },
      });
      const assetOwnerCounts = Object.values(
        restored?.booksAssetOwnerCounts ?? {},
      );
      expect(assetOwnerCounts.filter((count) => count === 1)).toHaveLength(3);
      expect(assetOwnerCounts.every((count) => count <= 1)).toBe(true);
      expect(
        Object.values(restored?.booksResources?.ownerCounts ?? {}),
      ).toEqual([1, 1, 1, 1, 1, 1, 1]);

      await page.screenshot({
        path: path.join(
          ARTIFACT_ROOT,
          `${viewport.name}-context-restored.png`,
        ),
        animations: "disabled",
      });
    });
  }
});

async function waitForProbe(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          typeof (
            window as unknown as {
              __trevorNoahWebGLProbe?: { snapshot(): unknown };
            }
          ).__trevorNoahWebGLProbe?.snapshot === "function",
      ),
    )
    .toBe(true);
}

async function seekBooksCoverStage(page: Page): Promise<void> {
  const target = await page.evaluate(() => {
    const stage = document.getElementById("books-cover-stage");
    if (!stage) {
      throw new Error("Books cover stage is unavailable.");
    }
    const documentTop = stage.getBoundingClientRect().top + window.scrollY;
    return Math.max(
      0,
      Math.min(
        documentTop - window.innerHeight * 0.5,
        document.documentElement.scrollHeight - window.innerHeight,
      ),
    );
  });
  await page.evaluate((top) => {
    window.scrollTo({ top, behavior: "instant" });
  }, target);
}

async function readFallback(page: Page): Promise<{
  readonly states: string[];
  readonly opacities: string[];
  readonly display: string[];
}> {
  return page
    .locator("img[data-books-fallback='true']")
    .evaluateAll((images) => ({
      states: images.map(
        (image) =>
          (image as HTMLImageElement).dataset.booksFallbackState ?? "",
      ),
      opacities: images.map((image) => getComputedStyle(image).opacity),
      display: images.map((image) => getComputedStyle(image).display),
    }));
}

async function collectRestorationFrames(
  page: Page,
): Promise<RestorationSample[]> {
  return page.evaluate(async () => {
    const runtimeWindow = window as Window & {
      __booksContextLoss?: ContextLossExtension;
      __trevorNoahWebGLProbe?: {
        snapshot(): BooksProbeSnapshot;
      };
    };
    const extension = runtimeWindow.__booksContextLoss;
    const probe = runtimeWindow.__trevorNoahWebGLProbe;
    if (!extension || !probe) {
      throw new Error("Books restoration evidence dependencies are unavailable.");
    }

    const sample = (): RestorationSample => {
      const images = Array.from(
        document.querySelectorAll<HTMLImageElement>(
          "img[data-books-fallback='true']",
        ),
      );
      const snapshot = probe.snapshot();
      const composition = snapshot.composition?.books;
      return {
        states: images.map(
          (image) => image.dataset.booksFallbackState ?? "",
        ),
        opacities: images.map(
          (image) => getComputedStyle(image).opacity,
        ),
        pointerEvents: images.map(
          (image) => getComputedStyle(image).pointerEvents,
        ),
        stageState:
          document.getElementById("books-cover-stage")?.dataset
            .booksFallbackState ?? null,
        fallbackCount: images.length,
        articleCount: document.querySelectorAll(
          "#books article[data-book-id]",
        ).length,
        allFallbackImagesConnected: images.every(
          (image) => image.isConnected,
        ),
        booksDominant: snapshot.scenes.dominant === "books-scene",
        allTexturesReady: composition?.allTexturesReady ?? false,
        allCoversRendered: composition?.allCoversRendered ?? false,
        booksAssetOwnerCounts: Object.fromEntries(
          Object.entries(snapshot.diagnostics.assetOwnerCounts).filter(
            ([assetId]) =>
              assetId.startsWith("people-in-the-room:") ||
              assetId.startsWith("between-the-cities:") ||
              assetId.startsWith("hearing-one-another:"),
          ),
        ),
        booksResources:
          snapshot.diagnostics.gpuResources["books-scene"] ?? null,
      };
    };

    const samples: RestorationSample[] = [sample()];
    extension.restoreContext();
    for (let frame = 0; frame < 180; frame += 1) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      const current = sample();
      samples.push(current);
      if (
        current.states.every((state) => state === "ready-active") &&
        current.opacities.every((opacity) => opacity === "0") &&
        current.booksResources?.total === 7
      ) {
        break;
      }
    }
    return samples;
  });
}
