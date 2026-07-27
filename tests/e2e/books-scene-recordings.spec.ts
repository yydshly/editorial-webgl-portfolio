import { expect, test, type Page, type Video } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

type RecordingProbeSnapshot = {
  readonly scenes: { readonly dominant: string | null };
  readonly transition: {
    readonly cameraIntentSceneId: string | null;
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
      Record<string, { readonly reducedMotion?: boolean }>
    >;
  };
};

const ARTIFACT_ROOT = path.resolve("artifacts/p4-04-books-batch3");
const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1_440, height: 900 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

test.use({ video: "on" });

test.describe("P4-04 Books Batch 3 recordings", () => {
  for (const viewport of VIEWPORTS) {
    test(`records the full About to Books and reverse journey at ${viewport.name}`, async ({
      page,
    }) => {
      await preparePage(page, viewport);
      const video = requireVideo(page);

      await animateAnchorToViewport(page, "about-portrait", 0.5, 650);
      await expect
        .poll(
          async () =>
            (await readProbe(page)).diagnostics.sceneStates[
              "about-scene"
            ]?.dominant,
        )
        .toBe(true);
      await page.waitForTimeout(250);

      await animateAnchorToViewport(page, "news", 0, 750);
      await expect
        .poll(
          async () =>
            (await readProbe(page)).transition?.cameraIntentSceneId,
        )
        .toBe("global-idle");
      await page.waitForTimeout(250);

      await animateAnchorToViewport(page, "quote", 0.5, 550);
      await page.waitForTimeout(350);

      await animateAnchorToViewport(
        page,
        "books-cover-stage",
        0.5,
        750,
      );
      await waitForBooks(page);
      await page.waitForTimeout(500);

      await animateAnchorToViewport(page, "quote", 0.5, 750);
      await waitForQuote(page);
      await page.waitForTimeout(400);

      await saveVideo(
        page,
        video,
        `${viewport.name}-about-news-quote-books-quote.webm`,
      );
    });

    test(`records fast down and reverse convergence at ${viewport.name}`, async ({
      page,
    }) => {
      await preparePage(page, viewport);
      const video = requireVideo(page);

      await seekAnchorToViewport(page, "books-cover-stage", 0.5);
      await waitForBooks(page);
      await page.waitForTimeout(350);
      await seekAnchorToViewport(page, "quote", 0.5);
      await waitForQuote(page);
      await page.waitForTimeout(350);
      await seekAnchorToViewport(page, "books-cover-stage", 0.5);
      await waitForBooks(page);
      await page.waitForTimeout(350);

      await saveVideo(
        page,
        video,
        `${viewport.name}-fast-scroll.webm`,
      );
    });

    test(`records reduced-motion hold convergence at ${viewport.name}`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await preparePage(page, viewport);
      const video = requireVideo(page);

      await animateAnchorToViewport(page, "quote", 0.5, 500);
      await expect
        .poll(
          async () =>
            (await readProbe(page)).transition?.cameraIntentSceneId,
        )
        .toBe("global-idle");
      await page.waitForTimeout(300);
      await animateAnchorToViewport(
        page,
        "books-cover-stage",
        0.5,
        600,
      );
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
      await page.waitForTimeout(450);

      await saveVideo(
        page,
        video,
        `${viewport.name}-reduced-motion.webm`,
      );
    });
  }
});

async function preparePage(
  page: Page,
  viewport: { readonly width: number; readonly height: number },
): Promise<void> {
  await mkdir(ARTIFACT_ROOT, { recursive: true });
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height,
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
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

function requireVideo(page: Page): Video {
  const video = page.video();
  if (!video) {
    throw new Error("Playwright video recording is unavailable.");
  }
  return video;
}

async function saveVideo(
  page: Page,
  video: Video,
  fileName: string,
): Promise<void> {
  await page.close();
  await video.saveAs(path.join(ARTIFACT_ROOT, fileName));
}

async function readProbe(
  page: Page,
): Promise<RecordingProbeSnapshot> {
  return page.evaluate(() => {
    const probe = (
      window as unknown as {
        __editorialWebGLProbe?: {
          snapshot(): RecordingProbeSnapshot;
        };
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
      const opacities = await page
        .locator("img[data-books-fallback='true']")
        .evaluateAll((images) =>
          images.map((image) => getComputedStyle(image).opacity),
        );
      return {
        dominant: snapshot.scenes.dominant,
        camera: snapshot.transition?.cameraIntentSceneId,
        opacities,
      };
    })
    .toEqual({
      dominant: "books-scene",
      camera: "books-scene",
      opacities: ["0", "0", "0"],
    });
}

async function waitForQuote(page: Page): Promise<void> {
  await expect
    .poll(async () => {
      const snapshot = await readProbe(page);
      return {
        camera: snapshot.transition?.cameraIntentSceneId,
        cached:
          snapshot.diagnostics.sceneStates["books-scene"]?.cached ??
          false,
      };
    })
    .toEqual({
      camera: "global-idle",
      cached: true,
    });
}

async function seekAnchorToViewport(
  page: Page,
  anchorId: string,
  ratio: number,
): Promise<void> {
  const top = await resolveAnchorScrollTop(page, anchorId, ratio);
  await page.evaluate((target) => {
    window.scrollTo({ top: target, behavior: "instant" });
  }, top);
}

async function animateAnchorToViewport(
  page: Page,
  anchorId: string,
  ratio: number,
  durationMs: number,
): Promise<void> {
  const top = await resolveAnchorScrollTop(page, anchorId, ratio);
  await page.evaluate(
    async ({ target, duration }) => {
      const start = window.scrollY;
      const delta = target - start;
      const startedAt = performance.now();
      await new Promise<void>((resolve) => {
        const tick = (now: number): void => {
          const progress = Math.min(1, (now - startedAt) / duration);
          const eased =
            progress < 0.5
              ? 2 * progress * progress
              : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          window.scrollTo({
            top: start + delta * eased,
            behavior: "instant",
          });
          if (progress >= 1) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    },
    { target: top, duration: durationMs },
  );
}

async function resolveAnchorScrollTop(
  page: Page,
  anchorId: string,
  ratio: number,
): Promise<number> {
  return page.evaluate(
    ({ id, viewportRatio }) => {
      const anchor = document.getElementById(id);
      if (!anchor) {
        throw new Error(`Missing anchor "${id}".`);
      }
      const documentTop =
        anchor.getBoundingClientRect().top + window.scrollY;
      return Math.max(
        0,
        Math.min(
          documentTop - window.innerHeight * viewportRatio,
          document.documentElement.scrollHeight -
            window.innerHeight,
        ),
      );
    },
    { id: anchorId, viewportRatio: ratio },
  );
}
