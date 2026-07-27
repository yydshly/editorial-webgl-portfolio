import { mkdir } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const baseUrl = process.env.DEMO_BASE_URL ?? "http://127.0.0.1:3020";
const outputDirectory = path.resolve(process.env.DEMO_OUTPUT_DIR ?? "docs/demo");
const browserExecutablePath = process.env.DEMO_BROWSER_EXECUTABLE ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const viewport = { width: 1440, height: 900 };

async function settle(page, milliseconds = 800) {
  await page.waitForTimeout(milliseconds);
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function scrollToSection(page, id) {
  const target = await page.locator(`#${id}`).evaluate((section) =>
    Math.max(0, Math.round(section.getBoundingClientRect().top + window.scrollY - 56)),
  );

  await page.evaluate(async (top) => {
    const start = window.scrollY;
    const distance = top - start;
    const duration = 1100;
    const startedAt = performance.now();
    await new Promise((resolve) => {
      const frame = (now) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - (1 - progress) ** 3;
        window.scrollTo(0, start + distance * eased);
        if (progress < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }, target);
  await settle(page);
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: browserExecutablePath,
  });
  const context = await browser.newContext({
    viewport,
    recordVideo: { dir: outputDirectory, size: viewport },
  });
  const page = await context.newPage();
  const video = page.video();

  try {
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await settle(page, 1400);
    await page.screenshot({ path: path.join(outputDirectory, "editorial-webgl-demo-poster.webp"), type: "webp" });

    for (const id of ["media", "manifesto", "about", "news", "quote", "books"]) {
      await scrollToSection(page, id);
    }

    await settle(page, 1000);
  } finally {
    await page.close();
  }

  if (!video) throw new Error("Playwright video recording was not created.");
  await video.saveAs(path.join(outputDirectory, "editorial-webgl-demo.webm"));
  await context.close();
  await browser.close();
  console.log(`Demo recorded from ${baseUrl} to ${outputDirectory}`);
}

await main();
