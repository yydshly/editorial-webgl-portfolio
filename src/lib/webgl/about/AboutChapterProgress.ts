export const ABOUT_STAGE_IDS = [
  "origin",
  "industry",
  "onCamera",
  "crossCultural",
] as const;

export type AboutStageId = (typeof ABOUT_STAGE_IDS)[number];
export type AboutStageIndex = 0 | 1 | 2 | 3;
export type AboutTimelineStagePresentation = "current" | "previous" | "rest";

/** Stable nominal starts followed by the inclusive final endpoint. */
export const ABOUT_STAGE_BOUNDARIES = [0, 0.24, 0.49, 0.74, 1] as const;

const HYSTERESIS = 0.02;
const FORWARD_ENTRY_THRESHOLDS = [
  0,
  offsetBoundary(1, HYSTERESIS),
  offsetBoundary(2, HYSTERESIS),
  offsetBoundary(3, HYSTERESIS),
] as const;
const REVERSE_REENTRY_THRESHOLDS = [
  0,
  offsetBoundary(1, -HYSTERESIS),
  offsetBoundary(2, -HYSTERESIS),
  offsetBoundary(3, -HYSTERESIS),
] as const;

export type AboutChapterProgressInput = {
  readonly reducedMotion: boolean;
  readonly relativeScroll?: number;
  readonly viewportHeight?: number;
  readonly anchorHeight?: number;
  /** Accepted for callers that carry scroll direction; nominal resolution ignores it. */
  readonly direction?: -1 | 0 | 1;
};

export type AboutChapterProgressState = {
  readonly chapterProgress: number;
  /** Compatibility alias for consumers that name the normalized value `progress`. */
  readonly progress: number;
  readonly activeStageIndex: AboutStageIndex;
  readonly activeStageId: AboutStageId;
  /** Compatibility alias for consumers that name the active stage `stage`. */
  readonly stage: AboutStageId;
  readonly stageProgress: number;
  readonly isAnchored: boolean;
};

/**
 * Resolves the About chapter directly from geometry. It deliberately has no
 * direction or prior-stage dependency, so a given progress always maps to the
 * same stage and a discontinuity lands on its final stage in one calculation.
 */
export function resolveAboutChapterProgress(
  input: AboutChapterProgressInput,
): AboutChapterProgressState {
  const hasAnchorGeometry =
    isPositiveFinite(input.viewportHeight) && isPositiveFinite(input.anchorHeight);
  const chapterProgress = input.reducedMotion
    ? 0
    : hasAnchorGeometry
      ? clamp(
          finiteOrZero(input.relativeScroll) /
            (input.viewportHeight! + input.anchorHeight!),
          0,
          1,
        )
      : 0;
  const activeStageIndex = resolveAboutStageIndex(chapterProgress);
  const activeStageId = ABOUT_STAGE_IDS[activeStageIndex];

  return {
    chapterProgress,
    progress: chapterProgress,
    activeStageIndex,
    activeStageId,
    stage: activeStageId,
    stageProgress: resolveStageProgress(chapterProgress, activeStageIndex),
    isAnchored: hasAnchorGeometry,
  };
}

/** Resolves nominal stage selection without hysteresis or scroll-direction state. */
export function resolveAboutStageIndex(progress: number): AboutStageIndex {
  const normalized = clamp(finiteOrZero(progress), 0, 1);

  if (normalized < ABOUT_STAGE_BOUNDARIES[1]) return 0;
  if (normalized < ABOUT_STAGE_BOUNDARIES[2]) return 1;
  if (normalized < ABOUT_STAGE_BOUNDARIES[3]) return 2;
  return 3;
}

/** Returns the nominal active stage identifier for a normalized chapter progress. */
export function resolveAboutStage(progress: number): AboutStageId {
  return ABOUT_STAGE_IDS[resolveAboutStageIndex(progress)];
}

/**
 * Optional stateful hysteresis for future consumers. Adjacent threshold
 * crossings use the documented 0.02 band; multi-stage jumps resolve to their
 * nominal destination immediately instead of replaying intermediate stages.
 */
export function resolveAboutStageWithHysteresis(
  previousStageIndex: number,
  progress: number,
): AboutStageIndex {
  const previous = clampStageIndex(previousStageIndex);
  const normalized = clamp(finiteOrZero(progress), 0, 1);
  const nominal = resolveAboutStageIndex(normalized);

  if (nominal === previous || Math.abs(nominal - previous) > 1) {
    return nominal;
  }

  if (nominal > previous) {
    const forwardEntry = FORWARD_ENTRY_THRESHOLDS[nominal];
    return normalized >= forwardEntry ? nominal : previous;
  }

  const reverseReentry = REVERSE_REENTRY_THRESHOLDS[previous];
  const hasReenteredPreviousStage =
    previous === 3
      ? normalized <= reverseReentry
      : normalized < reverseReentry;
  return hasReenteredPreviousStage ? nominal : previous;
}

/** Returns DOM presentation roles in timeline order for the active stage. */
export function resolveAboutTimelineStagePresentation(
  activeStageIndex: number,
): readonly AboutTimelineStagePresentation[] {
  const current = clampStageIndex(activeStageIndex);
  return ABOUT_STAGE_IDS.map((_, index) => {
    if (index === current) return "current";
    if (index === current - 1) return "previous";
    return "rest";
  });
}

function resolveStageProgress(
  chapterProgress: number,
  activeStageIndex: AboutStageIndex,
): number {
  const start = ABOUT_STAGE_BOUNDARIES[activeStageIndex];
  const end = ABOUT_STAGE_BOUNDARIES[activeStageIndex + 1];
  return clamp((chapterProgress - start) / (end - start), 0, 1);
}

function clampStageIndex(value: number): AboutStageIndex {
  return clamp(Math.trunc(finiteOrZero(value)), 0, ABOUT_STAGE_IDS.length - 1) as AboutStageIndex;
}

function isPositiveFinite(value: number | undefined): value is number {
  return Number.isFinite(value) && value! > 0;
}

function finiteOrZero(value: number | undefined): number {
  return Number.isFinite(value) ? value! : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function offsetBoundary(stageIndex: number, offset: number): number {
  return Number((ABOUT_STAGE_BOUNDARIES[stageIndex] + offset).toFixed(2));
}
