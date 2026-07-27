import { expect, test, type Browser, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeBooksBatch4ArtifactManifest } from "./books-scene-batch4-artifacts";

type ContextLossExtension = {
  loseContext(): void;
  restoreContext(): void;
};

type RecordingProbe = {
  readonly scenes: { readonly dominant: string | null };
  readonly transition: {
    readonly cameraIntentSceneId: string | null;
  } | null;
  readonly diagnostics: {
    readonly sceneStates: Readonly<
      Record<string, { readonly cached?: boolean }>
    >;
    readonly sceneSnapshots: Readonly<
      Record<string, { readonly reducedMotion?: boolean }>
    >;
  };
};

const ARTIFACT_ROOT = path.resolve(
  "artifacts/p4-04-books-batch4/final/recordings",
);
const RAW_VIDEO_ROOT = path.join(
  tmpdir(),
  "codex-p4-04-books-batch4-recordings",
);
const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1_440, height: 900 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

test.describe("P4-04 Books Batch 4 recordings", () => {
  test.beforeAll(async () => {
    await mkdir(ARTIFACT_ROOT, { recursive: true });
    await mkdir(RAW_VIDEO_ROOT, { recursive: true });
  });

  for (const viewport of VIEWPORTS) {
    test(`records all required journeys at ${viewport.name}`, async ({
      browser,
    }) => {
      test.setTimeout(240_000);
      const files: string[] = [];

      files.push(
        await recordJourney(browser, viewport, "quote-to-books", async (page) => {
          await seekElementTop(page, "quote", viewport.height * 0.5);
          await animateElementTop(page, "books", -1, 900);
          await waitForBooks(page);
          await page.waitForTimeout(350);
        }),
      );
      files.push(
        await recordJourney(
          browser,
          viewport,
          "books-enter-hold-depart",
          async (page) => {
            await seekElementTop(page, "quote", viewport.height * 0.5);
            await page.waitForTimeout(250);
            await animateElementTop(page, "books", viewport.height * 0.62, 600);
            await animateElementTop(page, "books", -1, 750);
            await waitForBooks(page);
            await page.waitForTimeout(350);
            await animateBooksProgress(page, 0.86, 950);
            await page.waitForTimeout(350);
          },
        ),
      );
      files.push(
        await recordJourney(browser, viewport, "books-to-quote-reverse", async (page) => {
          await seekElementTop(page, "books", -1);
          await waitForBooks(page);
          await animateElementTop(page, "quote", viewport.height * 0.5, 850);
          await waitForQuote(page);
          await page.waitForTimeout(350);
        }),
      );
      files.push(
        await recordJourney(browser, viewport, "fast-down", async (page) => {
          await page.evaluate(() => window.scrollTo(0, 0));
          await seekElementTop(page, "books", -1);
          await waitForBooks(page);
          await page.waitForTimeout(450);
        }),
      );
      files.push(
        await recordJourney(browser, viewport, "fast-reverse", async (page) => {
          await seekElementTop(page, "books", -1);
          await waitForBooks(page);
          await seekElementTop(page, "quote", viewport.height * 0.5);
          await waitForQuote(page);
          await page.waitForTimeout(450);
        }),
      );
      files.push(
        await recordJourney(
          browser,
          viewport,
          "continuous-fast-up-down",
          async (page) => {
            for (let index = 0; index < 3; index += 1) {
              await seekElementTop(page, "books", -1);
              await waitForBooks(page);
              await page.waitForTimeout(180);
              await seekElementTop(page, "quote", viewport.height * 0.5);
              await waitForQuote(page);
              await page.waitForTimeout(180);
            }
            await seekElementTop(page, "books", -1);
            await waitForBooks(page);
            await page.waitForTimeout(350);
          },
        ),
      );
      files.push(
        await recordJourney(
          browser,
          viewport,
          "reduced-motion",
          async (page) => {
            await page.emulateMedia({ reducedMotion: "reduce" });
            await page.reload({ waitUntil: "domcontentloaded" });
            await waitForProbe(page);
            await animateElementTop(page, "books", -1, 700);
            await waitForBooks(page);
            const snapshot = await readProbe(page);
            expect(
              snapshot.diagnostics.sceneSnapshots["books-scene"]
                ?.reducedMotion,
            ).toBe(true);
            await page.waitForTimeout(450);
          },
        ),
      );
      files.push(
        await recordJourney(
          browser,
          viewport,
          "context-lost-restore",
          async (page) => {
            await seekElementTop(page, "books", -1);
            await waitForBooks(page);
            await page.waitForTimeout(250);
            expect(await loseContext(page)).toBe(true);
            await expect
              .poll(() => readFallbackOpacity(page))
              .toEqual(["1", "1", "1"]);
            await page.waitForTimeout(350);
            await restoreContext(page);
            await expect
              .poll(() => readFallbackOpacity(page), { timeout: 20_000 })
              .toEqual(["0", "0", "0"]);
            await waitForBooks(page);
            await page.waitForTimeout(450);
          },
        ),
      );

      await writeFile(
        path.join(ARTIFACT_ROOT, `${viewport.name}-recordings.json`),
        JSON.stringify(
          {
            viewport,
            generatedAt: new Date().toISOString(),
            files,
          },
          null,
          2,
        ),
      );
    });
  }

  test.afterAll(async () => {
    await writeBooksBatch4ArtifactManifest();
  });
});

async function recordJourney(
  browser: Browser,
  viewport: {
    readonly name: string;
    readonly width: number;
    readonly height: number;
  },
  name: string,
  action: (page: Page) => Promise<void>,
): Promise<string> {
  const context = await browser.newContext({
    viewport: {
      width: viewport.width,
      height: viewport.height,
    },
    recordVideo: {
      dir: RAW_VIDEO_ROOT,
      size: {
        width: viewport.width,
        height: viewport.height,
      },
    },
  });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await waitForProbe(page);
  const video = page.video();
  if (!video) {
    throw new Error("Playwright video recording is unavailable.");
  }
  await action(page);
  const fileName = `${viewport.name}-${name}.webm`;
  await page.close();
  await video.saveAs(path.join(ARTIFACT_ROOT, fileName));
  await context.close();
  return fileName;
}

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

async function readProbe(page: Page): Promise<RecordingProbe> {
  return page.evaluate(() => {
    const probe = (
      window as unknown as {
        __editorialWebGLProbe?: {
          snapshot(): RecordingProbe;
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

async function seekElementTop(
  page: Page,
  id: string,
  targetTop: number,
): Promise<void> {
  const top = await resolveElementScrollTop(page, id, targetTop);
  await page.evaluate((target) => window.scrollTo(0, target), top);
  await settleFrames(page, 3);
}

async function animateElementTop(
  page: Page,
  id: string,
  targetTop: number,
  durationMs: number,
): Promise<void> {
  const top = await resolveElementScrollTop(page, id, targetTop);
  await animateScroll(page, top, durationMs);
}

async function resolveElementScrollTop(
  page: Page,
  id: string,
  targetTop: number,
): Promise<number> {
  return page.evaluate(
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
}

async function animateBooksProgress(
  page: Page,
  progress: number,
  durationMs: number,
): Promise<void> {
  const top = await page.evaluate((targetProgress) => {
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
  await animateScroll(page, top, durationMs);
}

async function animateScroll(
  page: Page,
  target: number,
  durationMs: number,
): Promise<void> {
  await page.evaluate(
    async ({ destination, duration }) => {
      const start = scrollY;
      const delta = destination - start;
      const startedAt = performance.now();
      await new Promise<void>((resolve) => {
        const tick = (now: number): void => {
          const progress = Math.min(1, (now - startedAt) / duration);
          const eased =
            progress < 0.5
              ? 2 * progress * progress
              : 1 - Math.pow(-2 * progress + 2, 2) / 2;
          window.scrollTo(0, start + delta * eased);
          if (progress >= 1) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    },
    { destination: target, duration: durationMs },
  );
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
        __booksBatch4RecordingContext?: ContextLossExtension;
      }
    ).__booksBatch4RecordingContext = extension;
    extension.loseContext();
    return true;
  });
}

async function restoreContext(page: Page): Promise<void> {
  await page.evaluate(() => {
    const extension = (
      window as Window & {
        __booksBatch4RecordingContext?: ContextLossExtension;
      }
    ).__booksBatch4RecordingContext;
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
