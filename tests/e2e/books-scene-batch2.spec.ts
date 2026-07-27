import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type Bounds = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

type BooksProbeSnapshot = {
  readonly canvasCount: number;
  readonly render: {
    readonly drawCalls: number;
    readonly geometryCount: number;
    readonly textureCount: number;
  };
  readonly scenes: {
    readonly dominant: string | null;
  };
  readonly composition: {
    readonly rendererOwner: string;
    readonly books: {
      readonly covers: readonly [
        {
          readonly rendered: boolean;
          readonly visible: boolean;
          readonly frustumVisible: boolean;
          readonly screen?: { readonly bounds: Bounds };
        },
        {
          readonly rendered: boolean;
          readonly visible: boolean;
          readonly frustumVisible: boolean;
          readonly screen?: { readonly bounds: Bounds };
        },
        {
          readonly rendered: boolean;
          readonly visible: boolean;
          readonly frustumVisible: boolean;
          readonly screen?: { readonly bounds: Bounds };
        },
      ];
      readonly roleOrder: readonly [
        "primary",
        "secondary-left",
        "secondary-right",
      ];
      readonly textureSources: readonly [string, string, string];
      readonly meshCount: 3;
      readonly geometryCount: 1;
      readonly materialCount: 3;
      readonly textureCount: number;
      readonly expectedDrawCalls: 3;
      readonly allTexturesReady: boolean;
      readonly allCoversRendered: boolean;
      readonly supportingVisibility: {
        readonly leftExposedFraction: number;
        readonly rightExposedFraction: number;
      };
      readonly projections: readonly [
        { readonly deltaPx: { readonly x: number; readonly y: number } | null },
        { readonly deltaPx: { readonly x: number; readonly y: number } | null },
        { readonly deltaPx: { readonly x: number; readonly y: number } | null },
      ];
    } | null;
  } | null;
  readonly diagnostics: {
    readonly sceneStates: {
      readonly "books-scene"?: {
        readonly resident: boolean;
        readonly visible: boolean;
        readonly updating: boolean;
        readonly dominant: boolean;
        readonly cached: boolean;
      };
    };
    readonly sceneSnapshots: {
      readonly "books-scene"?: {
        readonly isActive: boolean;
        readonly isAnchored: boolean;
        readonly isCached: boolean;
        readonly progress: number;
        readonly visualReady: boolean;
        readonly covers: ReadonlyArray<{
          readonly id: string;
          readonly role: string;
          readonly assetSource: string;
          readonly isAssetReady: boolean;
        }>;
      };
    };
    readonly assetOwnerCounts: Readonly<Record<string, number>>;
    readonly gpuResources: {
      readonly "books-scene"?: {
        readonly byKind: {
          readonly texture: number;
          readonly geometry: number;
          readonly material: number;
        };
        readonly ownerCounts: Readonly<Record<string, number>>;
      };
    };
  };
};

const ARTIFACT_ROOT = path.resolve("artifacts/p4-04-books-batch2");
const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

test.describe("P4-04 Books Scene Batch 2 evidence", () => {
  for (const viewport of VIEWPORTS) {
    test(`renders the three-cover archive on ${viewport.name}`, async ({
      page,
    }) => {
      test.setTimeout(45_000);
      await mkdir(ARTIFACT_ROOT, { recursive: true });
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/", {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      });
      await seekBooksCoverStage(page);
      await waitForBooksImages(page);
      await waitForBooksRuntime(page);
      await settleFrames(page, 12);

      const evidence = await readEvidence(page);
      assertEvidence(evidence, viewport.width, viewport.height);

      await page.screenshot({
        path: path.join(
          ARTIFACT_ROOT,
          `${viewport.name}-books-composited.png`,
        ),
        animations: "disabled",
      });

      const canvasOnlyStyle = await page.addStyleTag({
        content:
          "#books-cover-stage img[data-books-fallback='true'] { " +
          "opacity: 0 !important; visibility: hidden !important; } " +
          "#books.books-section { background: transparent !important; " +
          "backdrop-filter: none !important; }",
      });
      await settleFrames(page, 2);
      await page.screenshot({
        path: path.join(
          ARTIFACT_ROOT,
          `${viewport.name}-books-canvas-only.png`,
        ),
        animations: "disabled",
      });
      await canvasOnlyStyle.evaluate((element) => {
        element.parentNode?.removeChild(element);
      });

      await writeFile(
        path.join(
          ARTIFACT_ROOT,
          `${viewport.name}-books-evidence.json`,
        ),
        `${JSON.stringify({ viewport, evidence }, null, 2)}\n`,
        "utf8",
      );
    });
  }
});

async function waitForBooksImages(page: Page): Promise<void> {
  await expect(
    page.locator("#books-cover-stage img[data-books-fallback='true']"),
  ).toHaveCount(3);
  await page.waitForFunction(
    () => {
      const images = Array.from(
        document.querySelectorAll<HTMLImageElement>(
          "#books-cover-stage img[data-books-fallback='true']",
        ),
      );
      return (
        images.length === 3 &&
        images.every((image) => image.complete && image.naturalWidth > 0)
      );
    },
    undefined,
    { timeout: 10_000 },
  );
}

async function seekBooksCoverStage(page: Page): Promise<void> {
  const targetScrollY = await page.evaluate(() => {
    const stage = document.getElementById("books-cover-stage");
    if (!stage) {
      throw new Error("Books cover stage is unavailable.");
    }
    const bounds = stage.getBoundingClientRect();
    const documentTop = bounds.top + window.scrollY;
    const books = document.getElementById("books");
    if (!books) {
      throw new Error("Books section is unavailable.");
    }
    const booksDocumentTop =
      books.getBoundingClientRect().top + window.scrollY;
    return Math.max(
      0,
      Math.min(
        Math.max(
          documentTop - (window.innerHeight - bounds.height) / 2,
          booksDocumentTop + 2,
        ),
        document.documentElement.scrollHeight - window.innerHeight,
      ),
    );
  });

  await page.evaluate((scrollY) => {
    window.scrollTo({ top: scrollY, behavior: "instant" });
  }, targetScrollY);
}

async function waitForBooksRuntime(page: Page): Promise<void> {
  try {
    await page.waitForFunction(
      () => {
        const probe = (window as unknown as {
          __trevorNoahWebGLProbe?: { snapshot: () => BooksProbeSnapshot };
        }).__trevorNoahWebGLProbe;
        const snapshot = probe?.snapshot();
        const scene = snapshot?.diagnostics.sceneSnapshots["books-scene"];
        const composition = snapshot?.composition?.books;
        return Boolean(
          snapshot?.canvasCount === 1 &&
            snapshot.scenes.dominant === "books-scene" &&
            scene?.isActive &&
            scene.isAnchored &&
            scene.covers.every((cover) => cover.isAssetReady) &&
            composition?.allTexturesReady &&
            composition.allCoversRendered,
        );
      },
      undefined,
      { timeout: 15_000 },
    );
  } catch {
    const snapshot = await page.evaluate(() => {
      const probe = (window as unknown as {
        __trevorNoahWebGLProbe?: { snapshot: () => BooksProbeSnapshot };
      }).__trevorNoahWebGLProbe;
      return probe?.snapshot() ?? null;
    });
    throw new Error(
      `Books runtime did not become ready:\n${JSON.stringify(snapshot, null, 2)}`,
    );
  }
}

async function readEvidence(page: Page) {
  return page.evaluate(() => {
    const probe = (window as unknown as {
      __trevorNoahWebGLProbe?: { snapshot: () => BooksProbeSnapshot };
    }).__trevorNoahWebGLProbe;
    const snapshot = probe?.snapshot();
    const books = document.getElementById("books");
    const stage = document.getElementById("books-cover-stage");
    const quote = document.getElementById("quote");
    if (!snapshot || !books || !stage || !quote) {
      throw new Error("Books evidence is incomplete.");
    }

    const fallbackImages = Array.from(
      stage.querySelectorAll<HTMLImageElement>(
        "img[data-books-fallback='true']",
      ),
    );
    return {
      snapshot,
      dom: {
        articleCount: books.querySelectorAll("article[data-book-id]").length,
        headingCount: books.querySelectorAll("article h3").length,
        fallbackCount: fallbackImages.length,
        loadedFallbackCount: fallbackImages.filter(
          (image) => image.complete && image.naturalWidth > 0,
        ).length,
        currentSources: fallbackImages.map((image) => image.currentSrc),
        pageOverflow: Math.max(
          0,
          document.documentElement.scrollWidth - window.innerWidth,
        ),
        booksOverflow: Math.max(0, books.scrollWidth - books.clientWidth),
        quoteBottom: quote.getBoundingClientRect().bottom,
        stageBounds: stage.getBoundingClientRect().toJSON(),
      },
    };
  });
}

function assertEvidence(
  evidence: Awaited<ReturnType<typeof readEvidence>>,
  viewportWidth: number,
  viewportHeight: number,
): void {
  const { snapshot, dom } = evidence;
  const scene = snapshot.diagnostics.sceneSnapshots["books-scene"];
  const registry = snapshot.diagnostics.sceneStates["books-scene"];
  const composition = snapshot.composition?.books;
  const gpu = snapshot.diagnostics.gpuResources["books-scene"];
  const message = JSON.stringify(evidence, null, 2);

  expect(snapshot.canvasCount, message).toBe(1);
  expect(snapshot.composition?.rendererOwner, message).toBe(
    "global-webgl-stage",
  );
  expect(snapshot.scenes.dominant, message).toBe("books-scene");
  expect(registry, message).toMatchObject({
    resident: true,
    visible: true,
    updating: true,
    dominant: true,
    cached: false,
  });
  expect(scene, message).toMatchObject({
    isActive: true,
    isAnchored: true,
    isCached: false,
    visualReady: true,
  });
  expect(scene?.covers.map((cover) => cover.role), message).toEqual([
    "primary",
    "secondary-left",
    "secondary-right",
  ]);
  expect(
    scene?.covers.every((cover) => cover.isAssetReady),
    message,
  ).toBe(true);
  expect(composition, message).toMatchObject({
    roleOrder: ["primary", "secondary-left", "secondary-right"],
    meshCount: 3,
    geometryCount: 1,
    materialCount: 3,
    textureCount: 3,
    expectedDrawCalls: 3,
    allTexturesReady: true,
    allCoversRendered: true,
  });
  expect(gpu?.byKind, message).toEqual({
    texture: 3,
    geometry: 1,
    material: 3,
  });
  expect(
    Object.values(gpu?.ownerCounts ?? {}).filter(
      (ownerCount) => ownerCount === 1,
    ),
    message,
  ).toHaveLength(7);
  expect(
    scene?.covers.every(
      (cover) =>
        snapshot.diagnostics.assetOwnerCounts[
          `${cover.id}:${viewportWidth <= 768 ? "mobile" : "desktop"}`
        ] === 1,
    ),
    message,
  ).toBe(true);

  const primary = composition?.covers[0].screen?.bounds;
  const left = composition?.covers[1].screen?.bounds;
  const right = composition?.covers[2].screen?.bounds;
  expect(primary, message).toBeDefined();
  expect(left, message).toBeDefined();
  expect(right, message).toBeDefined();
  expect(layerArea(primary!), message).toBeGreaterThan(layerArea(left!));
  expect(layerArea(primary!), message).toBeGreaterThan(layerArea(right!));
  expect(primary!.left, message).toBeGreaterThanOrEqual(0);
  expect(primary!.right, message).toBeLessThanOrEqual(viewportWidth);
  expect(primary!.top, message).toBeGreaterThanOrEqual(0);
  expect(primary!.bottom, message).toBeLessThanOrEqual(viewportHeight);
  expect(
    composition?.supportingVisibility.leftExposedFraction,
    message,
  ).toBeGreaterThan(0.2);
  expect(
    composition?.supportingVisibility.rightExposedFraction,
    message,
  ).toBeGreaterThan(0.2);
  composition?.projections.forEach((projection) => {
    expect(Math.abs(projection.deltaPx?.x ?? 999), message).toBeLessThan(0.01);
    expect(Math.abs(projection.deltaPx?.y ?? 999), message).toBeLessThan(0.01);
  });

  expect(dom.articleCount, message).toBe(3);
  expect(dom.headingCount, message).toBe(3);
  expect(dom.fallbackCount, message).toBe(3);
  expect(dom.loadedFallbackCount, message).toBe(3);
  expect(dom.pageOverflow, message).toBeLessThanOrEqual(1);
  expect(dom.booksOverflow, message).toBeLessThanOrEqual(1);
  expect(dom.quoteBottom, message).toBeLessThanOrEqual(1);
  expect(
    dom.currentSources.every((source) =>
      source.endsWith(
        viewportWidth <= 768 ? "-mobile.webp" : "-desktop.webp",
      ),
    ),
    message,
  ).toBe(true);
}

function layerArea(bounds: Bounds): number {
  return Math.max(0, bounds.right - bounds.left) *
    Math.max(0, bounds.bottom - bounds.top);
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
