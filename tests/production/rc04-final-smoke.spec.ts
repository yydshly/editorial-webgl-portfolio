import { expect, test } from "@playwright/test";

const sections = ["hero", "media", "manifesto", "about", "news", "quote", "books"];

test("production preserves direct hash navigation, route order, and single runtime ownership", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto("/#books");
  await expect(page.locator("#books")).toBeInViewport();
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("#books");

  for (const section of sections) {
    await page.locator(`#${section}`).scrollIntoViewIfNeeded();
    await expect(page.locator(`#${section}`)).toBeInViewport();
  }

  await page.mouse.wheel(0, 12000);
  await page.locator("#books").scrollIntoViewIfNeeded();
  await page.mouse.wheel(0, -12000);
  await page.locator("#hero").scrollIntoViewIfNeeded();

  expect(await page.locator("canvas.webgl-canvas").count()).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => ({
    probe: "__editorialWebGLProbe" in window,
    blendDebug: "__r3bBlendDebug" in window,
  }))).toEqual({ probe: false, blendDebug: false });
  expect(consoleErrors).toEqual([]);
});

test("production returns a real 404 for an unknown route", async ({ request }) => {
  const response = await request.get("/rc04-missing-route");
  expect(response.status()).toBe(404);
});
