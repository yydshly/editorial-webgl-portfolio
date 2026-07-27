import { expect, test } from "@playwright/test";

test("loads the MVP application shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "DEV-HOST-01 Editorial Archive",
    }),
  ).toBeVisible();
});
