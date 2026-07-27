import { access, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const FINAL_ROOT = path.resolve("artifacts/p4-04-books-batch4/final");
const RUNTIME_URL = "http://127.0.0.1:3100/";

const VIEWPORTS = [
  { name: "desktop-1440x900", width: 1_440, height: 900 },
  { name: "mobile-390x844", width: 390, height: 844 },
] as const;

const SCREENSHOT_STATES = [
  "quote-hold",
  "books-first-active",
  "books-visual-ready",
  "books-dominant",
  "books-enter-midpoint",
  "books-hold",
  "normal-composited",
  "canvas-only",
  "books-depart",
  "reverse-hold",
  "fast-final",
  "reduced-motion-hold",
  "context-lost",
  "context-restored",
  "unavailable-fallback",
] as const;

const RECORDING_JOURNEYS = [
  "quote-to-books",
  "books-enter-hold-depart",
  "books-to-quote-reverse",
  "fast-down",
  "fast-reverse",
  "continuous-fast-up-down",
  "reduced-motion",
  "context-lost-restore",
] as const;

type Viewport = (typeof VIEWPORTS)[number];

type ArtifactEntry = {
  readonly path: string;
  readonly kind:
    | "screenshot"
    | "metrics"
    | "recording"
    | "recording-index"
    | "recording-dimensions"
    | "review";
  readonly viewport: Viewport | null;
  readonly direction: string;
  readonly progress: number | null;
  readonly phase: string;
  readonly reducedMotion: boolean;
  readonly fallbackState: string;
  readonly contextState: string;
};

export async function writeBooksBatch4ArtifactManifest(): Promise<void> {
  const required = createRequiredEntries();
  const artifacts: ArtifactEntry[] = [];
  const missingRequiredArtifacts: string[] = [];

  for (const artifact of required) {
    if (await fileExists(path.join(FINAL_ROOT, artifact.path))) {
      artifacts.push(artifact);
    } else {
      missingRequiredArtifacts.push(artifact.path);
    }
  }

  const dimensionsPath = "recordings/recording-dimensions.json";
  if (await fileExists(path.join(FINAL_ROOT, dimensionsPath))) {
    artifacts.push({
      path: dimensionsPath,
      kind: "recording-dimensions",
      viewport: null,
      direction: "mixed",
      progress: null,
      phase: "validation",
      reducedMotion: false,
      fallbackState: "mixed",
      contextState: "mixed",
    });
  }

  artifacts.push(...(await readReviewEntries()));
  artifacts.sort((left, right) => left.path.localeCompare(right.path));

  await writeFile(
    path.join(FINAL_ROOT, "artifact-manifest.json"),
    JSON.stringify(
      {
        runtime: RUNTIME_URL,
        port: 3_100,
        generatedAt: new Date().toISOString(),
        expectedNamedArtifactCount: required.length,
        complete: missingRequiredArtifacts.length === 0,
        missingRequiredArtifacts,
        excludedTransientPatterns: ["recordings/page@*.webm"],
        artifacts,
      },
      null,
      2,
    ),
  );
}

function createRequiredEntries(): ArtifactEntry[] {
  const entries: ArtifactEntry[] = [];

  for (const viewport of VIEWPORTS) {
    for (const state of SCREENSHOT_STATES) {
      entries.push({
        path: `${viewport.name}-${state}.png`,
        kind: "screenshot",
        viewport,
        ...screenshotMetadata(state),
      });
    }

    entries.push({
      path: `${viewport.name}-metrics.json`,
      kind: "metrics",
      viewport,
      direction: "forward-reverse-restore",
      progress: null,
      phase: "hold",
      reducedMotion: false,
      fallbackState: "ready-active",
      contextState: "restored",
    });

    for (const journey of RECORDING_JOURNEYS) {
      entries.push({
        path: `recordings/${viewport.name}-${journey}.webm`,
        kind: "recording",
        viewport,
        ...recordingMetadata(journey),
      });
    }

    entries.push({
      path: `recordings/${viewport.name}-recordings.json`,
      kind: "recording-index",
      viewport,
      direction: "mixed",
      progress: null,
      phase: "journey-index",
      reducedMotion: false,
      fallbackState: "mixed",
      contextState: "mixed",
    });
  }

  return entries;
}

function screenshotMetadata(state: (typeof SCREENSHOT_STATES)[number]): Omit<
  ArtifactEntry,
  "path" | "kind" | "viewport"
> {
  const progress =
    state === "books-enter-midpoint"
      ? 0.15
      : state === "books-depart"
        ? 0.72
        : null;

  return {
    direction:
      state === "reverse-hold"
        ? "reverse"
        : state === "fast-final"
          ? "fast-forward"
          : state === "quote-hold" || state === "unavailable-fallback"
            ? "not-applicable"
            : "forward",
    progress,
    phase: state,
    reducedMotion: state === "reduced-motion-hold",
    fallbackState:
      state === "unavailable-fallback"
        ? "unavailable"
        : state === "context-lost"
          ? "context-lost"
          : "ready-active",
    contextState:
      state === "context-lost"
        ? "lost"
        : state === "context-restored"
          ? "restored"
          : "available",
  };
}

function recordingMetadata(
  journey: (typeof RECORDING_JOURNEYS)[number],
): Omit<ArtifactEntry, "path" | "kind" | "viewport"> {
  return {
    direction:
      journey === "books-to-quote-reverse" || journey === "fast-reverse"
        ? "reverse"
        : journey === "continuous-fast-up-down"
          ? "bidirectional"
          : "forward",
    progress: null,
    phase: journey,
    reducedMotion: journey === "reduced-motion",
    fallbackState:
      journey === "context-lost-restore" ? "context-lost-restore" : "ready-active",
    contextState:
      journey === "context-lost-restore" ? "lost-restore" : "available",
  };
}

async function readReviewEntries(): Promise<ArtifactEntry[]> {
  const reviewRoot = path.join(FINAL_ROOT, "review");
  let names: string[];
  try {
    names = await readdir(reviewRoot);
  } catch {
    return [];
  }

  return names
    .filter((name) => name.endsWith(".png"))
    .map((name) => ({
      path: `review/${name}`,
      kind: "review" as const,
      viewport: resolveViewport(name),
      direction: "mixed",
      progress: null,
      phase: name.replace(/\.png$/, ""),
      reducedMotion: name.includes("reduced-motion"),
      fallbackState: name.includes("context") ? "mixed" : "ready-active",
      contextState: name.includes("context") ? "mixed" : "available",
    }));
}

function resolveViewport(name: string): Viewport | null {
  if (name.startsWith("desktop-")) {
    return VIEWPORTS[0];
  }
  if (name.startsWith("mobile-")) {
    return VIEWPORTS[1];
  }
  return null;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}
