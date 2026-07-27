import { expect, test, type Page } from "@playwright/test";

type BooksTransitionProbe = {
  readonly canvasCount: number;
  readonly scenes: {
    readonly dominant: string | null;
  };
  readonly transition: {
    readonly cameraIntentSceneId: string | null;
  } | null;
  readonly diagnostics: {
    readonly sceneStates: Readonly<
      Record<
        string,
        {
          readonly resident: boolean;
          readonly visible: boolean;
          readonly updating: boolean;
          readonly dominant: boolean;
          readonly cached: boolean;
          readonly disposed: boolean;
        }
      >
    >;
    readonly sceneSnapshots: Readonly<
      Record<
        string,
        {
          readonly isActive: boolean;
          readonly isCached: boolean;
          readonly visualReady?: boolean;
        }
      >
    >;
  };
};

const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1_440, height: 900 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

test.describe("P4-04 Books Scene Batch 3 transition", () => {
  for (const viewport of VIEWPORTS) {
    test(`keeps Quote on global-idle, gates Books dominance, and restores Quote atomically on reverse at ${viewport.name}`, async ({
      page,
    }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });

    await page.setViewportSize({
      width: viewport.width,
      height: viewport.height,
    });
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("#news")).toHaveCount(1);
    await expect(page.locator("#quote")).toHaveCount(1);
    await expect(page.locator("#books")).toHaveCount(1);
    await waitForProbe(page, consoleErrors);

    await seekAnchorToViewport(page, "about-portrait", 0.5);
    await expect
      .poll(
        async () =>
          (await readProbe(page)).diagnostics.sceneStates[
            "about-scene"
          ]?.dominant,
      )
      .toBe(true);

    await seekAnchorToViewport(page, "news", 0);
    await expect
      .poll(async () => {
        const snapshot = await readProbe(page);
        return {
          camera: snapshot.transition?.cameraIntentSceneId,
          about:
            snapshot.diagnostics.sceneStates["about-scene"],
        };
      })
      .toMatchObject({
        camera: "global-idle",
        about: {
          visible: false,
          updating: false,
          dominant: false,
          cached: true,
        },
      });

    await seekAnchorToViewport(page, "quote", 0.5);
    await settleFrames(page, 4);
    const quoteSnapshot = await readProbe(page);
    expect(quoteSnapshot.canvasCount).toBe(1);
    expect(quoteSnapshot.transition?.cameraIntentSceneId).toBe(
      "global-idle",
    );
    expect(quoteSnapshot.diagnostics.sceneStates.news).toBeUndefined();
    expect(quoteSnapshot.diagnostics.sceneStates.quote).toBeUndefined();
    expect(
      quoteSnapshot.diagnostics.sceneStates["books-scene"]?.dominant,
    ).toBe(false);

    await seekAnchorToViewport(page, "books-cover-stage", 0.5);
    await expect
      .poll(async () => {
        const snapshot = await readProbe(page);
        return {
          dominant: snapshot.scenes.dominant,
          camera: snapshot.transition?.cameraIntentSceneId,
          fallback: await readFallbackState(page),
        };
      })
      .toEqual({
        dominant: "books-scene",
        camera: "books-scene",
        fallback: {
          states: ["ready-active", "ready-active", "ready-active"],
          opacities: ["0", "0", "0"],
        },
      });

    await seekAnchorToViewport(page, "quote", 0.5);
    await expect
      .poll(async () => {
        const snapshot = await readProbe(page);
        return {
          cached:
            snapshot.diagnostics.sceneStates["books-scene"]?.cached,
          camera: snapshot.transition?.cameraIntentSceneId,
          fallback: await readFallbackState(page),
        };
      })
      .toEqual({
        cached: true,
        camera: "global-idle",
        fallback: {
          states: ["ready-inactive", "ready-inactive", "ready-inactive"],
          opacities: ["1", "1", "1"],
        },
      });

    await seekAnchorToViewport(page, "books-cover-stage", 0.5);
    await expect
      .poll(async () => {
        const snapshot = await readProbe(page);
        return {
          dominant: snapshot.scenes.dominant,
          camera: snapshot.transition?.cameraIntentSceneId,
        };
      })
      .toEqual({
        dominant: "books-scene",
        camera: "books-scene",
    });
    expect(consoleErrors).toEqual([]);
    });

    test(`preserves the same atomic lifecycle with reduced motion at ${viewport.name}`, async ({
      page,
    }) => {
      const consoleErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });
      page.on("pageerror", (error) => {
        consoleErrors.push(error.message);
      });

      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await waitForProbe(page, consoleErrors);

      await seekAnchorToViewport(page, "quote", 0.5);
      await expect
        .poll(
          async () =>
            (await readProbe(page)).transition?.cameraIntentSceneId,
        )
        .toBe("global-idle");

      await seekAnchorToViewport(page, "books-cover-stage", 0.5);
      await expect
        .poll(async () => {
          const snapshot = await readProbe(page);
          return {
            dominant: snapshot.scenes.dominant,
            camera: snapshot.transition?.cameraIntentSceneId,
            fallback: await readFallbackState(page),
          };
        })
        .toEqual({
          dominant: "books-scene",
          camera: "books-scene",
          fallback: {
            states: ["ready-active", "ready-active", "ready-active"],
            opacities: ["0", "0", "0"],
          },
        });

      await seekAnchorToViewport(page, "quote", 0.5);
      await expect
        .poll(async () => {
          const snapshot = await readProbe(page);
          return {
            cached:
              snapshot.diagnostics.sceneStates["books-scene"]?.cached,
            camera: snapshot.transition?.cameraIntentSceneId,
            fallback: await readFallbackState(page),
          };
        })
        .toEqual({
          cached: true,
          camera: "global-idle",
          fallback: {
            states: ["ready-inactive", "ready-inactive", "ready-inactive"],
            opacities: ["1", "1", "1"],
          },
        });
      expect(consoleErrors).toEqual([]);
    });
  }
});

async function waitForProbe(
  page: Page,
  consoleErrors: readonly string[],
): Promise<void> {
  try {
    await expect
      .poll(
        async () =>
          page.evaluate(
            () =>
              typeof (window as unknown as {
                __editorialWebGLProbe?: { snapshot(): unknown };
              }).__editorialWebGLProbe?.snapshot === "function",
          ),
        { timeout: 10_000 },
      )
      .toBe(true);
  } catch {
    const diagnostics = await page.evaluate(() => ({
      canvasCount: document.querySelectorAll("canvas.webgl-canvas").length,
      fallbackReason:
        document.querySelector("[role='status']")?.textContent ?? null,
      readyState: document.readyState,
      url: location.href,
    }));
    throw new Error(
      `WebGL probe unavailable:\n${JSON.stringify(
        { diagnostics, consoleErrors },
        null,
        2,
      )}`,
    );
  }
}

async function readProbe(page: Page): Promise<BooksTransitionProbe> {
  return page.evaluate(() => {
    const probe = (window as unknown as {
      __editorialWebGLProbe?: { snapshot(): BooksTransitionProbe };
    }).__editorialWebGLProbe;
    if (!probe) {
      throw new Error("WebGL probe is unavailable.");
    }
    return probe.snapshot();
  });
}

async function seekAnchorToViewport(
  page: Page,
  anchorId: string,
  viewportRatio: number,
): Promise<void> {
  const scrollY = await page.evaluate(
    ({ id, ratio }) => {
      const anchor = document.getElementById(id);
      if (!anchor) {
        throw new Error(`Missing anchor "${id}".`);
      }
      const documentTop =
        anchor.getBoundingClientRect().top + window.scrollY;
      return Math.max(
        0,
        Math.min(
          documentTop - window.innerHeight * ratio,
          document.documentElement.scrollHeight - window.innerHeight,
        ),
      );
    },
    { id: anchorId, ratio: viewportRatio },
  );
  await page.evaluate((top) => {
    window.scrollTo({ top, behavior: "instant" });
  }, scrollY);
}

async function readFallbackState(page: Page): Promise<{
  readonly states: string[];
  readonly opacities: string[];
}> {
  return page
    .locator("img[data-books-fallback='true']")
    .evaluateAll((images) => ({
      states: images.map(
        (image) =>
          (image as HTMLImageElement).dataset.booksFallbackState ?? "",
      ),
      opacities: images.map(
        (image) => getComputedStyle(image).opacity,
      ),
    }));
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
