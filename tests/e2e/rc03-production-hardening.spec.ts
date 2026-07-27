import { expect, test } from "@playwright/test";

test("does not publish legacy identity in the Open Graph image", async ({ page }) => {
  const response = await page.request.get("/assets/placeholders/og-image.svg");
  expect(response.status()).toBe(200);
  const image = await response.text();
  expect(image).toContain("DEV-HOST-01");
  expect(image).not.toMatch(/Trevor Noah/i);

  const heroPlaceholder = await page.request.get("/assets/placeholders/hero.svg");
  expect(await heroPlaceholder.text()).not.toMatch(/Trevor Noah/i);
});

test("does not publicly serve generation-only master assets", async ({ page }) => {
  const runtimeAsset = await page.request.get("/assets/hero/hero-placeholder-desktop.webp");
  expect(runtimeAsset.status()).toBe(200);

  const masterAsset = await page.request.get("/assets/hero/hero-placeholder-master.png");
  expect(masterAsset.status()).toBe(404);
});
