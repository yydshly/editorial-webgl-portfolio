import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

const baseUrl = process.env.RC02_BASE_URL ?? "http://127.0.0.1:3000";
const outputDirectory = path.resolve(
  process.env.RC02_EVIDENCE_DIR ?? "artifacts/release-candidate/rc02",
);
const browserExecutablePath = process.env.RC02_BROWSER_EXECUTABLE ??
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const viewports = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "compact-desktop", width: 1024, height: 900 },
  { name: "narrow-desktop", width: 800, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];

const modes = [
  "slow-forward",
  "slow-reverse",
  "fast-down",
  "fast-reverse",
  "continuous-up-down",
  "reduced-motion",
  "webgl-unavailable",
  "context-restore",
];

const sectionIds = [
  "hero",
  "media",
  "manifesto",
  "about",
  "news",
  "quote",
  "books",
];

const ensureDirectory = (directory) => mkdir(directory, { recursive: true });

async function waitForFrames(page, count = 4) {
  await page.evaluate((frameCount) => new Promise((resolve) => {
    let remaining = frameCount;
    const next = () => {
      remaining -= 1;
      if (remaining <= 0) {
        resolve();
        return;
      }
      window.requestAnimationFrame(next);
    };
    window.requestAnimationFrame(next);
  }), count);
}

async function readSnapshot(page) {
  return page.evaluate((ids) => {
    const probe = window.__editorialWebGLProbe;
    const snapshot = typeof probe?.snapshot === "function" ? probe.snapshot() : null;
    const fallbackImages = Array.from(document.querySelectorAll("img[data-media-fallback], img[data-about-fallback], img[data-books-fallback]"));

    return {
      scrollY: Math.round(window.scrollY),
      currentSection: ids.find((id) => {
        const section = document.getElementById(id);
        if (!section) return false;
        const rect = section.getBoundingClientRect();
        return rect.top <= window.innerHeight * 0.4 && rect.bottom >= window.innerHeight * 0.2;
      }) ?? null,
      canvasCount: document.querySelectorAll("canvas.webgl-canvas").length,
      canvasAriaHidden: document.querySelector("canvas.webgl-canvas")?.getAttribute("aria-hidden") ?? null,
      horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
      fallback: fallbackImages.map((image) => ({
        alt: image.getAttribute("alt"),
        state: image.getAttribute("data-media-fallback-state") ?? image.getAttribute("data-about-fallback-state") ?? image.getAttribute("data-books-fallback-state"),
        opacity: getComputedStyle(image).opacity,
      })),
      runtime: snapshot ? {
        dominantSceneId: snapshot.scenes?.dominant ?? null,
        cameraIntentSource: snapshot.transition?.cameraIntentSceneId ?? null,
        cameraBlendWeight: snapshot.transition?.cameraBlendWeight ?? null,
        transitionPhase: snapshot.transition?.transitionPhase ?? null,
        assetOwnerCounts: snapshot.diagnostics?.assetOwnerCounts ?? {},
        gpuOwners: Object.fromEntries(
          Object.entries(snapshot.diagnostics?.gpuResources ?? {}).map(([sceneId, resources]) => [
            sceneId,
            resources?.ownerCounts ?? {},
          ]),
        ),
      } : null,
    };
  }, sectionIds);
}

async function scrollJourney(page, mode) {
  const targets = await page.evaluate((ids) => ids.map((id) => {
    const section = document.getElementById(id);
    if (!section) return 0;
    return Math.max(0, Math.round(section.getBoundingClientRect().top + window.scrollY - 56));
  }), sectionIds);

  let sequence = targets;
  if (mode === "slow-reverse" || mode === "fast-reverse") {
    sequence = [...targets].reverse();
  }
  if (mode === "continuous-up-down") {
    sequence = [...targets, ...targets.slice(0, -1).reverse()];
  }

  const samples = [];
  for (const target of sequence) {
    await page.evaluate((scrollTarget) => window.scrollTo({ top: scrollTarget, behavior: "auto" }), target);
    await waitForFrames(page, mode.startsWith("slow") ? 12 : 3);
    samples.push(await readSnapshot(page));
  }
  return samples;
}

async function scrollToMediaHold(page) {
  const target = await page.evaluate(() => {
    const media = document.getElementById("media");
    if (!media) return 0;
    const rect = media.getBoundingClientRect();
    const documentTop = rect.top + window.scrollY;
    const centerExitTop = rect.height * 0.5;
    const centerEnterBottom = Math.max(0, centerExitTop - window.innerHeight);
    const span = Math.max(1, centerExitTop - centerEnterBottom);
    return Math.max(0, Math.round(documentTop + centerEnterBottom + span * 0.44));
  });
  await page.evaluate((scrollTarget) => window.scrollTo({ top: scrollTarget, behavior: "auto" }), target);
}

async function disableWebGL(context) {
  await context.addInitScript(() => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function getContextWithoutWebGL(contextId, ...args) {
      if (String(contextId).toLowerCase().includes("webgl")) {
        return null;
      }
      return originalGetContext.call(this, contextId, ...args);
    };
  });
}

async function captureContextLoss(page) {
  const result = await page.evaluate(() => {
    const canvas = document.querySelector("canvas.webgl-canvas");
    const context = canvas?.getContext("webgl2") ?? canvas?.getContext("webgl");
    const extension = context?.getExtension?.("WEBGL_lose_context");
    if (!extension) return { supported: false };
    window.__rc02ContextRestoreExtension = extension;
    extension.loseContext();
    return { supported: true };
  });

  await waitForFrames(page, 8);
  const afterLoss = await readSnapshot(page);
  const restored = await page.evaluate(() => {
    const extension = window.__rc02ContextRestoreExtension;
    if (!extension) return false;
    extension.restoreContext();
    delete window.__rc02ContextRestoreExtension;
    return true;
  });
  await waitForFrames(page, 24);
  return { ...result, restored, afterLoss, afterRestore: await readSnapshot(page) };
}

async function copyVideo(page, destination) {
  const video = page.video();
  if (!video) return null;
  const source = await video.path();
  await copyFile(source, destination);
  return path.relative(outputDirectory, destination).replaceAll("\\", "/");
}

async function main() {
  const screenshotDirectory = path.join(outputDirectory, "screenshots");
  const recordingDirectory = path.join(outputDirectory, "recordings");
  await Promise.all([ensureDirectory(screenshotDirectory), ensureDirectory(recordingDirectory)]);

  const browser = await chromium.launch({
    headless: true,
    executablePath: browserExecutablePath,
  });
  const consoleEntries = [];
  const matrix = [];
  const recordings = [];
  let metadataAudit = null;

  try {
    for (const viewport of viewports) {
      for (const mode of modes) {
        const recordVideo = (viewport.name === "desktop" || viewport.name === "mobile") &&
          (mode === "slow-forward" || mode === "slow-reverse");
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          reducedMotion: mode === "reduced-motion" ? "reduce" : "no-preference",
          ...(recordVideo ? { recordVideo: { dir: recordingDirectory, size: { width: viewport.width, height: viewport.height } } } : {}),
        });
        if (mode === "webgl-unavailable") await disableWebGL(context);

        const page = await context.newPage();
        page.on("console", (message) => {
          if (["error", "warning"].includes(message.type())) {
            consoleEntries.push({ viewport: viewport.name, mode, type: message.type(), text: message.text() });
          }
        });
        page.on("pageerror", (error) => {
          consoleEntries.push({ viewport: viewport.name, mode, type: "pageerror", text: error.message });
        });

        await page.goto(baseUrl, { waitUntil: "networkidle" });
        await waitForFrames(page, 12);

        if (!metadataAudit && viewport.name === "desktop" && mode === "slow-forward") {
          metadataAudit = await page.evaluate(() => ({
            title: document.title,
            description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? null,
            canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
            robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? null,
            openGraphTitle: document.querySelector('meta[property="og:title"]')?.getAttribute("content") ?? null,
            openGraphDescription: document.querySelector('meta[property="og:description"]')?.getAttribute("content") ?? null,
            openGraphImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content") ?? null,
            twitterCard: document.querySelector('meta[name="twitter:card"]')?.getAttribute("content") ?? null,
            language: document.documentElement.lang,
            headings: Array.from(document.querySelectorAll("h1, h2, h3")).map((heading) => ({ level: Number(heading.tagName.slice(1)), text: heading.textContent?.trim() ?? "" })),
            sections: Array.from(document.querySelectorAll("main > section")).map((section) => ({ id: section.id, labelledBy: section.getAttribute("aria-labelledby") })),
            imagesWithoutAlt: Array.from(document.images).filter((image) => !image.hasAttribute("alt")).map((image) => image.currentSrc),
          }));
        }

        const samples = mode === "context-restore"
          ? [await readSnapshot(page)]
          : await scrollJourney(page, mode);
        const contextRestore = mode === "context-restore" ? await captureContextLoss(page) : null;

        if (mode === "slow-forward") {
          for (const sectionId of sectionIds) {
            if (sectionId === "media") {
              await scrollToMediaHold(page);
            } else {
              await page.locator(`#${sectionId}`).scrollIntoViewIfNeeded();
            }
            await waitForFrames(page, 30);
            await page.screenshot({
              path: path.join(screenshotDirectory, `${viewport.name}-${sectionId}-normal.png`),
              animations: "disabled",
            });
          }
        }
        if (mode === "webgl-unavailable" || mode === "context-restore") {
          await page.screenshot({
            path: path.join(screenshotDirectory, `${viewport.name}-${mode}.png`),
            animations: "disabled",
          });
        }

        matrix.push({ viewport, mode, samples, contextRestore });
        await page.close();
        if (recordVideo) {
          const destination = path.join(recordingDirectory, `${viewport.name}-${mode}.webm`);
          const recording = await copyVideo(page, destination);
          if (recording) recordings.push(recording);
        }
        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  const accessibilityAudit = {
    rules: [
      "One h1, ordered heading hierarchy, labelled sections, image alternatives, canvas aria-hidden, keyboard-visible focus, and DOM-first fallback are checked by RC-02 E2E.",
      "No axe dependency is introduced; the existing Playwright/browser contract suite remains the audit mechanism.",
    ],
    automatedContract: "tests/e2e/rc02-site-audit.spec.ts",
  };
  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    viewports,
    modes,
    recordings,
    screenshots: "screenshots/",
    audits: ["metadata-audit.json", "accessibility-audit.json", "console-audit.json", "full-site-matrix.json"],
    matrixCells: matrix.length,
  };

  await Promise.all([
    writeFile(path.join(outputDirectory, "artifact-manifest.json"), JSON.stringify(manifest, null, 2)),
    writeFile(path.join(outputDirectory, "metadata-audit.json"), JSON.stringify(metadataAudit, null, 2)),
    writeFile(path.join(outputDirectory, "accessibility-audit.json"), JSON.stringify(accessibilityAudit, null, 2)),
    writeFile(path.join(outputDirectory, "console-audit.json"), JSON.stringify(consoleEntries, null, 2)),
    writeFile(path.join(outputDirectory, "full-site-matrix.json"), JSON.stringify(matrix, null, 2)),
  ]);

  console.log(JSON.stringify({ outputDirectory, matrixCells: matrix.length, recordings, consoleEntries: consoleEntries.length }, null, 2));
}

await main();
