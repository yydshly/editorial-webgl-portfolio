import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

type ViewportCase = {
  readonly name: "desktop-1440x900" | "mobile-390x844";
  readonly width: number;
  readonly height: number;
  readonly expectedPortraitPosition: "sticky" | "static";
};

const ARTIFACT_ROOT = path.resolve("artifacts/p4-03-about-dom");

const VIEWPORTS: readonly ViewportCase[] = [
  {
    name: "desktop-1440x900",
    width: 1440,
    height: 900,
    expectedPortraitPosition: "sticky",
  },
  {
    name: "mobile-390x844",
    width: 390,
    height: 844,
    expectedPortraitPosition: "static",
  },
];

const EXPECTED_STAGES = [
  {
    title: "Observation becomes expression",
    keyFact: "Completes her first character interview and campus feature.",
  },
  {
    title: "Learning the work behind the story",
    keyFact: "Joins a content team and takes responsibility for topics and drafting.",
  },
  {
    title: "Bringing research in front of the camera",
    keyFact: "Hosts her first formal interview programme.",
  },
  {
    title: "Cross-cultural public expression",
    keyFact: "Launches and independently produces a cross-cultural content project.",
  },
] as const;

test.describe("P4-03 About DOM browser validation", () => {
  for (const viewport of VIEWPORTS) {
    test(`keeps the About archive readable and responsive on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await disableWebGL(page);
      await page.goto("/");
      await page.addStyleTag({
        content: "*, *::before, *::after { animation: none !important; transition: none !important; }",
      });

      const about = page.locator("#about");
      const timeline = about.locator("ol[aria-label='DEV-HOST-01 archive timeline']");
      const portrait = about.locator("img[data-about-fallback='true']");

      await expect.poll(() => page.evaluate(() =>
        document.createElement("canvas").getContext("webgl") === null,
      )).toBe(true);
      await expect(about).toBeAttached();
      await expect(portrait).toBeVisible();
      await expect(timeline).toBeVisible();

      expect(await timeline.evaluate((element) => element.tagName)).toBe("OL");
      await expect(timeline.locator(":scope > li")).toHaveCount(4);
      await expect(about.locator(".about-stage__fact-label")).toHaveText([
        "Key fact",
        "Key fact",
        "Key fact",
        "Key fact",
      ]);

      for (const [index, stage] of EXPECTED_STAGES.entries()) {
        const stageItem = timeline.locator(":scope > li").nth(index);
        await expect(stageItem.getByRole("heading", { level: 3, name: stage.title })).toBeVisible();
        await expect(stageItem.locator(".about-stage__fact")).toContainText(stage.keyFact);
      }

      const documentOrder = await page.evaluate(() => {
        const ids = ["manifesto", "about", "news"];
        const elements = ids.map((id) => document.getElementById(id));
        if (elements.some((element) => element === null)) {
          throw new Error("Manifesto, About, and News must all be present.");
        }

        return elements.slice(0, -1).every((element, index) => {
          const next = elements[index + 1];
          return Boolean(
            element && next &&
              element.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING,
          );
        });
      });
      expect(documentOrder).toBe(true);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(viewport.width);
      expect(await about.locator(".about-portrait-region").evaluate(
        (element) => window.getComputedStyle(element).position,
      )).toBe(viewport.expectedPortraitPosition);

      await scrollToLateAboutStage(page);
      const stages = about.locator("[data-about-stage-index]");
      await expect.poll(async () => stages.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-about-stage-state")),
      )).toEqual(["rest", "rest", "previous", "current"]);

      await mkdir(ARTIFACT_ROOT, { recursive: true });
      await about.screenshot({
        path: path.join(ARTIFACT_ROOT, `${viewport.name}-webgl-disabled-about.png`),
      });
    });
  }
});

async function disableWebGL(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext as (
      contextId: string,
      ...args: unknown[]
    ) => RenderingContext | null;
    const getContextWithoutWebGL = function getContextWithoutWebGL(
      this: HTMLCanvasElement,
      contextId: string,
      ...args: unknown[]
    ): RenderingContext | null {
      if (contextId === "webgl" || contextId === "webgl2" || contextId === "experimental-webgl") {
        return null;
      }
      return originalGetContext.apply(this, [contextId, ...args]);
    };
    HTMLCanvasElement.prototype.getContext = getContextWithoutWebGL as typeof HTMLCanvasElement.prototype.getContext;
  });
}

async function scrollToLateAboutStage(page: Page): Promise<void> {
  await page.evaluate(() => {
    const about = document.getElementById("about");
    if (!about) {
      throw new Error("About section is unavailable.");
    }

    const bounds = about.getBoundingClientRect();
    const documentTop = bounds.top + window.scrollY;
    const target = documentTop + bounds.height * 0.8;
    const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    window.scrollTo({ top: Math.min(target, maxScrollY), behavior: "auto" });
  });

  await page.evaluate(() => new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  }));
}
