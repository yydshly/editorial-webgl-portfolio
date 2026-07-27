export type MediaChapterPhase = "enter" | "hold" | "depart";

export const MEDIA_PROGRESS_CONFIG = {
  phaseBoundaries: {
    enterMax: 0.18,
    holdMax: 0.72,
  },
  reducedMotionProgress: 0.5,
} as const;

export const MEDIA_PROGRESS_PHASE_BOUNDARIES = {
  enter: {
    min: 0,
    max: MEDIA_PROGRESS_CONFIG.phaseBoundaries.enterMax,
  },
  hold: {
    min: MEDIA_PROGRESS_CONFIG.phaseBoundaries.enterMax,
    max: MEDIA_PROGRESS_CONFIG.phaseBoundaries.holdMax,
  },
  depart: {
    min: MEDIA_PROGRESS_CONFIG.phaseBoundaries.holdMax,
    max: 1,
  },
} as const;

export type MediaChapterProgressInput = {
  readonly reducedMotion: boolean;
  readonly relativeScroll: number;
  readonly viewportHeight: number;
  readonly anchorHeight: number;
};

export type MediaChapterProgressState = {
  readonly progress: number;
  readonly phase: MediaChapterPhase;
};

export function resolveMediaChapterProgress(
  input: MediaChapterProgressInput,
): MediaChapterProgressState {
  if (input.reducedMotion) {
    return {
      progress: MEDIA_PROGRESS_CONFIG.reducedMotionProgress,
      phase: "hold",
    };
  }

  const viewportHeight = Number.isFinite(input.viewportHeight) ? Math.max(1, input.viewportHeight) : 1;
  const anchorHeight = Number.isFinite(input.anchorHeight) ? Math.max(1, input.anchorHeight) : 1;
  const relativeScroll = Number.isFinite(input.relativeScroll) ? Math.max(0, input.relativeScroll) : 0;

  const anchorCenterExitTop = anchorHeight * 0.5;
  const anchorCenterEnterBottom = Math.max(0, anchorCenterExitTop - viewportHeight);
  const visibleWindow = Math.max(1, anchorCenterExitTop - anchorCenterEnterBottom);
  const normalized = clamp(
    (relativeScroll - anchorCenterEnterBottom) / visibleWindow,
    0,
    1,
  );

  return {
    progress: normalized,
    phase:
      normalized <= MEDIA_PROGRESS_CONFIG.phaseBoundaries.enterMax
        ? "enter"
        : normalized <= MEDIA_PROGRESS_CONFIG.phaseBoundaries.holdMax
          ? "hold"
          : "depart",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
