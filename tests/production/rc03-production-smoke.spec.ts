import { expect, test } from "@playwright/test";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "compact", width: 1024, height: 900 },
  { name: "narrow", width: 800, height: 900 },
  { name: "mobile", width: 390, height: 844 },
] as const;

const sectionIds = ["hero", "media", "manifesto", "about", "news", "quote", "books"] as const;

async function assertNoConsoleErrors(page: import("@playwright/test").Page): Promise<void> {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/");
  await page.waitForTimeout(250);
  expect(errors).toEqual([]);
}

test("production route remains coherent through normal, reverse, fast, and reduced-motion journeys", async ({ browser }) => {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    await assertNoConsoleErrors(page);

    for (const sectionId of sectionIds) {
      await page.locator(`#${sectionId}`).scrollIntoViewIfNeeded();
      await expect(page.locator(`#${sectionId}`)).toBeInViewport();
    }
    await page.locator("#hero").scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 6000);
    await page.locator("#books").scrollIntoViewIfNeeded();
    await expect(page.locator("#books")).toBeInViewport();
    expect(await page.locator("canvas.webgl-canvas").count()).toBeLessThanOrEqual(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.close();

    const reducedContext = await browser.newContext({ viewport, reducedMotion: "reduce" });
    const reducedPage = await reducedContext.newPage();
    await assertNoConsoleErrors(reducedPage);
    await reducedPage.locator("#books").scrollIntoViewIfNeeded();
    await expect(reducedPage.locator("#books")).toBeInViewport();
    await reducedPage.close();
    await reducedContext.close();
    await context.close();
  }
});

test("production keeps DOM fallback readable when WebGL is unavailable", async ({ browser }) => {
  const context = await browser.newContext({ viewport: viewports.at(-1) });
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, ...args: unknown[]) {
      return kind.toLowerCase().includes("webgl") ? null : original.call(this, kind, ...args);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  const page = await context.newPage();
  await assertNoConsoleErrors(page);
  await expect(page.locator("canvas.webgl-canvas")).toHaveCount(0);
  await page.locator("#books").scrollIntoViewIfNeeded();
  await expect(page.getByRole("heading", { name: "Books" })).toBeVisible();
  await context.close();
});

test("production restores the canvas after a WebGL context loss", async ({ page }) => {
  await assertNoConsoleErrors(page);
  const supported = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("canvas.webgl-canvas");
    const extension = canvas?.getContext("webgl2")?.getExtension("WEBGL_lose_context");
    if (!extension) return false;
    extension.loseContext();
    window.setTimeout(() => extension.restoreContext(), 100);
    return true;
  });
  test.skip(!supported, "WEBGL_lose_context is unavailable in this browser");
  await expect.poll(() => page.locator("canvas.webgl-canvas").count()).toBe(1);
  await page.locator("#books").scrollIntoViewIfNeeded();
  await expect(page.locator("#books")).toBeInViewport();
});
