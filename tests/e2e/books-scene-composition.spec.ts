import { expect, test, type Page } from "@playwright/test";

type Bounds = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
};

type BooksCompositionProbe = {
  readonly scenes: { readonly dominant: string | null };
  readonly transition: {
    readonly cameraIntentSceneId: string | null;
  } | null;
  readonly composition: {
    readonly books: {
      readonly covers: readonly {
        readonly opacity: number;
        readonly screen: { readonly bounds: Bounds } | null;
      }[];
      readonly roleOrder: readonly string[];
      readonly supportingVisibility: {
        readonly leftExposedFraction: number;
        readonly rightExposedFraction: number;
      };
      readonly allCoversRendered: boolean;
    } | null;
  } | null;
};

const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1_440, height: 900 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

const INTERMEDIATE_DESKTOP_VIEWPORTS = [
  { name: "compact-desktop-800x900", width: 800, height: 900 },
  { name: "compact-desktop-1024x900", width: 1_024, height: 900 },
] as const;

test.describe("P4-04 Books Batch 4 composition", () => {
  for (const viewport of VIEWPORTS) {
    test(`keeps a sharp, primary-led three-cover hold at ${viewport.name}`, async ({
      page,
    }) => {
      await openRepresentativeHold(page, viewport);

      const initial = await readComposition(page);
      const books = initial.composition?.books;
      expect(books).not.toBeNull();
      if (!books) {
        throw new Error("Books composition is unavailable.");
      }

      const [primary, left, right] = books.covers;
      const primaryBounds = requireBounds(primary.screen?.bounds);
      const leftBounds = requireBounds(left.screen?.bounds);
      const rightBounds = requireBounds(right.screen?.bounds);
      const primaryArea = area(primaryBounds);

      expect(primaryArea).toBeGreaterThan(area(leftBounds));
      expect(primaryArea).toBeGreaterThan(area(rightBounds));
      expect(primary.opacity).toBeGreaterThan(left.opacity);
      expect(primary.opacity).toBeGreaterThan(right.opacity);
      expect(books.supportingVisibility.leftExposedFraction).toBeGreaterThanOrEqual(
        viewport.width > 768 ? 0.64 : 0.48,
      );
      expect(books.supportingVisibility.rightExposedFraction).toBeGreaterThanOrEqual(
        viewport.width > 768 ? 0.84 : 0.78,
      );

      const layout = await readLayout(page);
      expect(layout.horizontalOverflow).toBe(0);
      expect(layout.quoteVisibleArea).toBe(0);
      expect(layout.sectionBackdropFilter).toBe("none");
      expect(layout.sectionBackgroundImage).toBe("none");
      expect(layout.stageBackgroundImage).toBe("none");
      expect(layout.fallbackOpacities).toEqual(["0", "0", "0"]);
      expect(layout.fallbackStates).toEqual([
        "ready-active",
        "ready-active",
        "ready-active",
      ]);
      expect(layout.fallbackRatios.every((ratio) => Math.abs(ratio - 2 / 3) < 0.01)).toBe(
        true,
      );

      if (viewport.width > 768) {
        expect(layout.reading.right).toBeLessThan(primaryBounds.left);
        expect(intersectionArea(layout.reading, primaryBounds)).toBe(0);
        expect(layout.primaryCTAVisibleArea).toBeGreaterThan(0);
      } else {
        expect(layout.stage.top).toBeLessThan(layout.reading.top);
        expect(layout.stage.top).toBeGreaterThanOrEqual(
          layout.header.bottom - 1,
        );
        expect(rightBounds.top).toBeGreaterThanOrEqual(
          layout.header.bottom,
        );
        for (const bounds of [primaryBounds, leftBounds, rightBounds]) {
          expect(bounds.left).toBeGreaterThanOrEqual(0);
          expect(bounds.right).toBeLessThanOrEqual(viewport.width);
        }
      }

      const beforeCanvasOnly = books.covers.map((cover) =>
        requireBounds(cover.screen?.bounds),
      );
      await page.addStyleTag({
        content:
          ".experience-main{opacity:0!important}.section-surface,.books-cover-stage{backdrop-filter:none!important;background:transparent!important}",
      });
      await settleFrames(page, 2);
      const canvasOnly = await readComposition(page);
      expect(
        canvasOnly.composition?.books?.covers.map((cover) =>
          requireBounds(cover.screen?.bounds),
        ),
      ).toEqual(beforeCanvasOnly);
    });

    test(`reconstructs the same hold bounds after reverse at ${viewport.name}`, async ({
      page,
    }) => {
      await openRepresentativeHold(page, viewport);
      const forward = await readCoverBounds(page);

      await seekElementTop(page, "quote", viewport.height * 0.5);
      await expect
        .poll(async () => (await readComposition(page)).transition?.cameraIntentSceneId)
        .toBe("global-idle");

      await seekElementTop(page, "books", -1);
      await waitForBooksHold(page);
      const reverse = await readCoverBounds(page);

      for (let index = 0; index < forward.length; index += 1) {
        expectBoundsClose(reverse[index], forward[index], 0.5);
      }
    });
  }

  for (const viewport of INTERMEDIATE_DESKTOP_VIEWPORTS) {
    test(`contains every cover outside the reading column at ${viewport.name}`, async ({
      page,
    }) => {
      await openRepresentativeHold(page, viewport);

      const layout = await readLayout(page);
      const covers = await readCoverBounds(page);
      expect(covers).toHaveLength(3);
      expect(layout.horizontalOverflow).toBe(0);

      for (const bounds of covers) {
        expect(bounds.left).toBeGreaterThanOrEqual(layout.stage.left);
        expect(bounds.right).toBeLessThanOrEqual(layout.stage.right);
        expect(bounds.left).toBeGreaterThanOrEqual(0);
        expect(bounds.right).toBeLessThanOrEqual(viewport.width);
        expect(intersectionArea(layout.reading, bounds)).toBe(0);
      }
    });
  }
});

async function openRepresentativeHold(
  page: Page,
  viewport: { readonly width: number; readonly height: number },
): Promise<void> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto("/", { waitUntil: "domcontentloaded" });
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
  await seekElementTop(page, "books", -1);
  await waitForBooksHold(page);
}

async function waitForBooksHold(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const snapshot = await readComposition(page);
      return {
        dominant: snapshot.scenes.dominant,
        camera: snapshot.transition?.cameraIntentSceneId,
        rendered:
          snapshot.composition?.books?.allCoversRendered ?? false,
      };
    })
    .toEqual({
      dominant: "books-scene",
      camera: "books-scene",
      rendered: true,
    });
}

async function readComposition(page: Page): Promise<BooksCompositionProbe> {
  return page.evaluate(() => {
    const probe = (
      window as unknown as {
        __trevorNoahWebGLProbe?: {
          snapshot(): BooksCompositionProbe;
        };
      }
    ).__trevorNoahWebGLProbe;
    if (!probe) {
      throw new Error("WebGL probe is unavailable.");
    }
    return probe.snapshot();
  });
}

async function readCoverBounds(page: Page): Promise<Bounds[]> {
  const snapshot = await readComposition(page);
  return (
    snapshot.composition?.books?.covers.map((cover) =>
      requireBounds(cover.screen?.bounds),
    ) ?? []
  );
}

async function readLayout(page: Page): Promise<{
  readonly stage: Bounds;
  readonly reading: Bounds;
  readonly header: Bounds;
  readonly horizontalOverflow: number;
  readonly quoteVisibleArea: number;
  readonly primaryCTAVisibleArea: number;
  readonly sectionBackdropFilter: string;
  readonly sectionBackgroundImage: string;
  readonly stageBackgroundImage: string;
  readonly fallbackOpacities: string[];
  readonly fallbackStates: string[];
  readonly fallbackRatios: number[];
}> {
  return page.evaluate(() => {
    const bounds = (selector: string): Bounds => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) {
        throw new Error(`Missing element "${selector}".`);
      }
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
      };
    };
    const visibleArea = (rect: Bounds): number =>
      Math.max(0, Math.min(innerWidth, rect.right) - Math.max(0, rect.left)) *
      Math.max(0, Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top));
    const section = document.getElementById("books");
    const stage = document.getElementById("books-cover-stage");
    if (!section || !stage) {
      throw new Error("Missing Books section or cover stage.");
    }
    const images = Array.from(
      document.querySelectorAll<HTMLImageElement>(
        "img[data-books-fallback='true']",
      ),
    );

    return {
      stage: bounds("#books-cover-stage"),
      reading: bounds("#books .books-reading"),
      header: bounds(".site-header"),
      horizontalOverflow: Math.max(
        0,
        document.documentElement.scrollWidth - innerWidth,
      ),
      quoteVisibleArea: visibleArea(bounds("#quote")),
      primaryCTAVisibleArea: visibleArea(bounds("#books article button")),
      sectionBackdropFilter: getComputedStyle(section).backdropFilter,
      sectionBackgroundImage: getComputedStyle(section).backgroundImage,
      stageBackgroundImage: getComputedStyle(stage).backgroundImage,
      fallbackOpacities: images.map((image) => getComputedStyle(image).opacity),
      fallbackStates: images.map(
        (image) => image.dataset.booksFallbackState ?? "",
      ),
      fallbackRatios: images.map(
        (image) =>
          image.getBoundingClientRect().width /
          image.getBoundingClientRect().height,
      ),
    };
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

function requireBounds(bounds: Bounds | null | undefined): Bounds {
  if (!bounds) {
    throw new Error("Expected projected cover bounds.");
  }
  return bounds;
}

function area(bounds: Bounds): number {
  return (bounds.right - bounds.left) * (bounds.bottom - bounds.top);
}

function intersectionArea(first: Bounds, second: Bounds): number {
  return (
    Math.max(
      0,
      Math.min(first.right, second.right) - Math.max(first.left, second.left),
    ) *
    Math.max(
      0,
      Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top),
    )
  );
}

function expectBoundsClose(
  actual: Bounds,
  expected: Bounds,
  tolerance: number,
): void {
  for (const edge of ["left", "right", "top", "bottom"] as const) {
    expect(Math.abs(actual[edge] - expected[edge])).toBeLessThanOrEqual(
      tolerance,
    );
  }
}
