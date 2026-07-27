import { expect, test } from "@playwright/test";

const sectionIds = [
  "hero",
  "media",
  "manifesto",
  "about",
  "news",
  "quote",
  "books",
] as const;

test.describe("RC-02 site navigation, SEO, and accessibility contracts", () => {
  test("publishes development-safe metadata without a real-person identity", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("DEV-HOST-01 | Editorial Archive");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /fictional development editorial archive/i,
    );
    expect(
      await page.locator('link[rel="canonical"]').evaluate((link) => {
        const canonical = new URL(link.getAttribute("href") ?? "", window.location.href);
        return `${canonical.origin}${canonical.pathname}`;
      }),
    ).toBe("https://dev-host-01.example/");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute(
      "content",
      "DEV-HOST-01",
    );
    await expect(page.locator("body")).not.toContainText(/Trevor Noah/i);
  });

  test("keeps all primary navigation targets ordered, present, and keyboard reachable", async ({
    page,
  }) => {
    await page.goto("/");

    const primaryNavigation = page.getByRole("navigation", { name: "Primary" });
    await expect(primaryNavigation.getByRole("link")).toHaveText([
      "Hero",
      "Media",
      "Manifesto",
      "About",
      "News",
      "Quote",
      "Books",
    ]);

    for (const sectionId of sectionIds) {
      await expect(page.locator(`#${sectionId}`)).toHaveCount(1);
      await expect(
        primaryNavigation.getByRole("link", { name: new RegExp(`^${sectionId}$`, "i") }),
      ).toHaveAttribute("href", `#${sectionId}`);
    }

    await page.getByRole("link", { name: "Books", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => page.evaluate(() => window.location.hash)).toBe("#books");
    await expect(page.locator("#books")).toBeInViewport();
  });

  test("does not expose dead local CTA or footer routes", async ({ page }) => {
    await page.goto("/");

    const localRoutes = await page.locator('a[href^="/"]').evaluateAll((links) =>
      links.map((link) => link.getAttribute("href")),
    );

    expect(localRoutes).toEqual(["/"]);
  });

  test("moves keyboard focus to main through the skip link and keeps development CTAs inert", async ({
    page,
  }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();

    const developmentCtas = page.getByRole("button", {
      name: "Publication details in development",
    });
    await expect(developmentCtas).toHaveCount(3);
    for (const button of await developmentCtas.all()) {
      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute("aria-disabled", "true");
    }
  });

  test("gives each content section an accessible heading relationship", async ({ page }) => {
    await page.goto("/");

    for (const sectionId of sectionIds) {
      const section = page.locator(`section#${sectionId}`);
      const labelledBy = await section.getAttribute("aria-labelledby");
      expect(labelledBy, `${sectionId} needs an accessible section name`).toBeTruthy();
      await expect(page.locator(`#${labelledBy}`)).toHaveCount(1);
    }
  });

  test("keeps the complete DOM route readable without WebGL across the release viewports", async ({
    browser,
  }) => {
    const viewports = [
      { width: 1440, height: 900 },
      { width: 1024, height: 900 },
      { width: 800, height: 900 },
      { width: 390, height: 844 },
    ] as const;

    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript(() => {
        const originalGetContext = HTMLCanvasElement.prototype.getContext as (
          contextId: string,
          ...args: unknown[]
        ) => RenderingContext | null;
        const getContextWithoutWebGL = function getContextWithoutWebGL(
          this: HTMLCanvasElement,
          contextId: string,
          ...args: unknown[]
        ) {
          if (contextId.toLowerCase().includes("webgl")) {
            return null;
          }
          return originalGetContext.call(this, contextId, ...args);
        };
        HTMLCanvasElement.prototype.getContext =
          getContextWithoutWebGL as typeof HTMLCanvasElement.prototype.getContext;
      });

      const page = await context.newPage();
      await page.goto("/");

      await expect(page.locator("canvas.webgl-canvas")).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator("img:not([alt])")).toHaveCount(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
      ).toBeLessThanOrEqual(1);

      for (const sectionId of sectionIds) {
        const section = page.locator(`#${sectionId}`);
        await section.scrollIntoViewIfNeeded();
        await expect(section).toBeVisible();
      }

      await page.close();
      await context.close();
    }
  });

  test("publishes a declared browser icon without a failed same-origin request", async ({ page }) => {
    await page.goto("/");
    const iconHref = await page.locator('link[rel="icon"]').getAttribute("href");

    expect(iconHref).toBeTruthy();
    const response = await page.request.get(iconHref ?? "/icon.svg");
    expect(response.status()).toBe(200);
  });
});
