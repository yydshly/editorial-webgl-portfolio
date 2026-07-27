import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

type VisualProbeSnapshot = {
  readonly canvasCount: number;
  readonly scenes: { readonly dominant: string | null };
  readonly transition: {
    readonly cameraIntentSceneId: string | null;
  } | null;
  readonly composition: {
    readonly books: {
      readonly allTexturesReady: boolean;
      readonly allCoversRendered: boolean;
    } | null;
  } | null;
  readonly diagnostics: {
    readonly sceneStates: Readonly<
      Record<
        string,
        {
          readonly dominant: boolean;
          readonly cached: boolean;
        }
      >
    >;
    readonly sceneSnapshots: Readonly<
      Record<
        string,
        {
          readonly isActive: boolean;
          readonly visualReady?: boolean;
          readonly reducedMotion?: boolean;
        }
      >
    >;
  };
};

const ARTIFACT_ROOT = path.resolve("artifacts/p4-04-books-batch3");
const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1_440, height: 900 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

test.describe("P4-04 Books Batch 3 visual evidence", () => {
  for (const viewport of VIEWPORTS) {
    test(`captures the transition state matrix at ${viewport.name}`, async ({
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

      await seekAnchorToViewport(page, "quote", 0.5);
      await expect
        .poll(
          async () =>
            (await readProbe(page)).transition?.cameraIntentSceneId,
        )
        .toBe("global-idle");
      await capture(page, viewport.name, "quote-hold");

      await seekAnchorToViewport(page, "books-cover-stage", 0.5);
      await expect
        .poll(
          async () =>
            (await readProbe(page)).diagnostics.sceneSnapshots[
              "books-scene"
            ]?.isActive,
        )
        .toBe(true);
      await capture(page, viewport.name, "books-first-active");

      await expect
        .poll(async () => {
          const snapshot = await readProbe(page);
          return {
            visualReady:
              snapshot.diagnostics.sceneSnapshots["books-scene"]
                ?.visualReady,
            textures:
              snapshot.composition?.books?.allTexturesReady,
            covers:
              snapshot.composition?.books?.allCoversRendered,
          };
        })
        .toEqual({
          visualReady: true,
          textures: true,
          covers: true,
        });
      await capture(page, viewport.name, "books-visual-ready");

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
      await capture(page, viewport.name, "books-dominant");

      await settleFrames(page, 12);
      await capture(page, viewport.name, "books-hold");

      await seekAnchorToViewport(page, "quote", 0.5);
      await expect
        .poll(async () => {
          const snapshot = await readProbe(page);
          return {
            camera: snapshot.transition?.cameraIntentSceneId,
            cached:
              snapshot.diagnostics.sceneStates["books-scene"]?.cached,
            fallback: await readFallbackOpacity(page),
          };
        })
        .toEqual({
          camera: "global-idle",
          cached: true,
          fallback: ["1", "1", "1"],
        });
      await capture(page, viewport.name, "reverse-quote");

      await page.evaluate(() => {
        window.scrollTo({ top: 0, behavior: "instant" });
      });
      await settleFrames(page, 1);
      await seekAnchorToViewport(page, "books-cover-stage", 0.5);
      await waitForBooksDominance(page);
      await capture(page, viewport.name, "fast-final");

      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.reload({ waitUntil: "domcontentloaded" });
      await waitForProbe(page);
      await seekAnchorToViewport(page, "books-cover-stage", 0.5);
      await expect
        .poll(async () => {
          const snapshot = await readProbe(page);
          return {
            dominant: snapshot.scenes.dominant,
            camera: snapshot.transition?.cameraIntentSceneId,
            reducedMotion:
              snapshot.diagnostics.sceneSnapshots["books-scene"]
                ?.reducedMotion,
          };
        })
        .toEqual({
          dominant: "books-scene",
          camera: "books-scene",
          reducedMotion: true,
        });
      await capture(page, viewport.name, "reduced-motion-hold");

      expect(await readHorizontalOverflow(page)).toBe(0);
    });

    test(`captures the WebGL unavailable fallback at ${viewport.name}`, async ({
      page,
    }) => {
      await mkdir(ARTIFACT_ROOT, { recursive: true });
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page.addInitScript(() => {
        const originalGetContext =
          HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (
          this: HTMLCanvasElement,
          contextId,
          ...args
        ) {
          if (
            contextId === "webgl" ||
            contextId === "webgl2" ||
            contextId === "experimental-webgl"
          ) {
            return null;
          }
          return Reflect.apply(originalGetContext, this, [
            contextId,
            ...args,
          ]);
        } as typeof HTMLCanvasElement.prototype.getContext;
      });
      await page.goto("/", { waitUntil: "domcontentloaded" });
      await seekAnchorToViewport(page, "books-cover-stage", 0.5);

      await expect
        .poll(async () => {
          const images = page.locator(
            "img[data-books-fallback='true']",
          );
          return {
            count: await images.count(),
            states: await images.evaluateAll((entries) =>
              entries.map(
                (entry) =>
                  (entry as HTMLImageElement).dataset
                    .booksFallbackState ?? "",
              ),
            ),
            opacities: await images.evaluateAll((entries) =>
              entries.map(
                (entry) => getComputedStyle(entry).opacity,
              ),
            ),
          };
        })
        .toEqual({
          count: 3,
          states: ["unavailable", "unavailable", "unavailable"],
          opacities: ["1", "1", "1"],
        });
      await capture(page, viewport.name, "unavailable-fallback");
      expect(await readHorizontalOverflow(page)).toBe(0);
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
              __editorialWebGLProbe?: { snapshot(): unknown };
            }
          ).__editorialWebGLProbe?.snapshot === "function",
      ),
    )
    .toBe(true);
}

async function readProbe(page: Page): Promise<VisualProbeSnapshot> {
  return page.evaluate(() => {
    const probe = (
      window as unknown as {
        __editorialWebGLProbe?: {
          snapshot(): VisualProbeSnapshot;
        };
      }
    ).__editorialWebGLProbe;
    if (!probe) {
      throw new Error("WebGL probe is unavailable.");
    }
    return probe.snapshot();
  });
}

async function waitForBooksDominance(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const snapshot = await readProbe(page);
      return {
        dominant: snapshot.scenes.dominant,
        camera: snapshot.transition?.cameraIntentSceneId,
        fallback: await readFallbackOpacity(page),
      };
    })
    .toEqual({
      dominant: "books-scene",
      camera: "books-scene",
      fallback: ["0", "0", "0"],
    });
}

async function seekAnchorToViewport(
  page: Page,
  anchorId: string,
  viewportRatio: number,
): Promise<void> {
  const top = await page.evaluate(
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
          document.documentElement.scrollHeight -
            window.innerHeight,
        ),
      );
    },
    { id: anchorId, ratio: viewportRatio },
  );
  await page.evaluate((target) => {
    window.scrollTo({ top: target, behavior: "instant" });
  }, top);
}

async function readFallbackOpacity(page: Page): Promise<string[]> {
  return page
    .locator("img[data-books-fallback='true']")
    .evaluateAll((images) =>
      images.map((image) => getComputedStyle(image).opacity),
    );
}

async function readHorizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() =>
    Math.max(
      0,
      document.documentElement.scrollWidth - window.innerWidth,
    ),
  );
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
