import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const artifactDirectory = path.resolve(
  "artifacts",
  "p4-04-books-batch1",
);

async function waitForBooksImages(page: Page) {
  await expect(page.locator("#books-cover-stage img")).toHaveCount(3);
  await page.waitForFunction(() => {
    const images = Array.from(
      document.querySelectorAll<HTMLImageElement>("#books-cover-stage img"),
    );
    return (
      images.length === 3 &&
      images.every((image) => image.complete && image.naturalWidth > 0)
    );
  });
}

async function openBooks(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("#books")).toBeVisible();
  await page.locator("#books").scrollIntoViewIfNeeded();
  await waitForBooksImages(page);
}

async function captureBooksViewport(
  page: Page,
  fileName: string,
  focus: "section" | "stage",
) {
  await page.evaluate((target) => {
    const element = document.querySelector(
      target === "section" ? "#books" : "#books-cover-stage",
    );
    if (!(element instanceof HTMLElement)) {
      throw new Error(`Missing Books ${target}`);
    }

    const top = element.getBoundingClientRect().top + window.scrollY;
    const offset = target === "section" ? 72 : 150;
    window.scrollTo({ top: Math.max(0, top - offset), behavior: "instant" });
  }, focus);
  await page.waitForTimeout(250);
  await page.screenshot({
    path: path.join(artifactDirectory, fileName),
    animations: "disabled",
  });
}

async function expectBooksContract(page: Page) {
  const books = page.locator("#books");
  const articles = books.getByRole("article");
  const fallbackImages = books.locator(
    'img[data-books-fallback="true"]',
  );

  await expect(articles).toHaveCount(3);
  await expect(fallbackImages).toHaveCount(3);
  await expect(
    articles.getByRole("heading", { level: 3 }),
  ).toHaveText(["在场的人", "城市之间", "彼此听见"]);
  await expect(
    books.getByRole("button", {
      name: "Publication details in development",
    }),
  ).toHaveCount(3);
  await expect(books.getByRole("link")).toHaveCount(0);
  await expect(books).not.toContainText("Born a Crime");
  await expect(books).not.toContainText("The Daily Show");
  await expect(books).not.toContainText("Television");
  await expect(books).not.toContainText("Broadcast");

  const layout = await page.evaluate(() => {
    const quote = document.querySelector("#quote");
    const books = document.querySelector("#books");
    if (!(quote instanceof HTMLElement) || !(books instanceof HTMLElement)) {
      throw new Error("Missing Quote or Books");
    }

    const quoteBottom =
      quote.getBoundingClientRect().bottom + window.scrollY;
    const booksTop = books.getBoundingClientRect().top + window.scrollY;
    return {
      pageOverflow:
        document.documentElement.scrollWidth - window.innerWidth,
      booksOverflow: books.scrollWidth - books.clientWidth,
      quoteBottom,
      booksTop,
    };
  });

  expect(layout.pageOverflow).toBeLessThanOrEqual(1);
  expect(layout.booksOverflow).toBeLessThanOrEqual(1);
  expect(layout.booksTop).toBeGreaterThanOrEqual(layout.quoteBottom);
}

test("renders the Books DOM archive at 1440x900", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openBooks(page);
  await expectBooksContract(page);

  for (const image of await page.locator("#books-cover-stage img").all()) {
    await expect(image).toBeVisible();
  }

  await captureBooksViewport(page, "books-dom-desktop.png", "section");
});

test("keeps the cover stage first and normal-flow at 390x844", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openBooks(page);
  await expectBooksContract(page);

  const mobileLayout = await page.evaluate(() => {
    const stage = document.querySelector("#books-cover-stage");
    const list = document.querySelector("#books .books-list");
    if (!(stage instanceof HTMLElement) || !(list instanceof HTMLElement)) {
      throw new Error("Missing Books mobile layout");
    }

    return {
      stageBeforeList:
        Boolean(
          stage.compareDocumentPosition(list) &
            Node.DOCUMENT_POSITION_FOLLOWING,
        ),
      position: getComputedStyle(stage).position,
      currentSources: Array.from(
        stage.querySelectorAll<HTMLImageElement>("img"),
      ).map((image) => image.currentSrc),
    };
  });

  expect(mobileLayout.stageBeforeList).toBe(true);
  expect(mobileLayout.position).toBe("relative");
  expect(
    mobileLayout.currentSources.every((source) =>
      source.endsWith("-mobile.webp"),
    ),
  ).toBe(true);

  await captureBooksViewport(page, "books-dom-mobile.png", "stage");
});

test("keeps all semantic content and cover fallbacks with WebGL disabled", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
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
      if (contextId.toLowerCase().includes("webgl")) {
        return null;
      }
      return originalGetContext.apply(this, [contextId, ...args]);
    };
    HTMLCanvasElement.prototype.getContext =
      getContextWithoutWebGL as typeof HTMLCanvasElement.prototype.getContext;
  });
  await openBooks(page);
  await expectBooksContract(page);

  const fallbackState = await page
    .locator("#books-cover-stage")
    .evaluate((stage) => ({
      state: stage.getAttribute("data-books-fallback-state"),
      images: Array.from(stage.querySelectorAll("img")).map((image) => ({
        opacity: getComputedStyle(image).opacity,
        naturalWidth: image.naturalWidth,
      })),
    }));

  expect(fallbackState.state).toBe("unavailable");
  expect(
    fallbackState.images.every(
      (image) => image.opacity === "1" && image.naturalWidth > 0,
    ),
  ).toBe(true);

  await captureBooksViewport(
    page,
    "books-dom-webgl-disabled.png",
    "section",
  );
});
