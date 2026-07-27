import { CHAPTER_PROGRESS_CONFIG } from "@/lib/webgl/hero/heroSceneConfig";

export type HeroChapterPhase = "enter" | "hold" | "depart";

export type HeroChapterProgressInput = {
  readonly reducedMotion: boolean;
  readonly relativeScroll: number;
  readonly viewportHeight: number;
  readonly anchorHeight: number;
};

export type HeroChapterProgressState = {
  readonly progress: number;
  readonly phase: HeroChapterPhase;
};

export const HERO_CHAPTER_PHASE_BOUNDARIES = {
  enter: {
    min: 0,
    max: CHAPTER_PROGRESS_CONFIG.phaseBoundaries.enterMax,
  },
  hold: {
    min: CHAPTER_PROGRESS_CONFIG.phaseBoundaries.enterMax,
    max: CHAPTER_PROGRESS_CONFIG.phaseBoundaries.holdMax,
  },
  depart: {
    min: CHAPTER_PROGRESS_CONFIG.phaseBoundaries.holdMax,
    max: 1,
  },
} as const;

export function resolveHeroChapterProgress(
  input: HeroChapterProgressInput,
): HeroChapterProgressState {
  if (input.reducedMotion) {
    return {
      progress: CHAPTER_PROGRESS_CONFIG.reducedMotionProgress,
      phase: "hold",
    };
  }

  const viewportHeight = Number.isFinite(input.viewportHeight)
    ? Math.max(1, input.viewportHeight)
    : 1;
  const anchorHeight = Number.isFinite(input.anchorHeight)
    ? Math.max(1, input.anchorHeight)
    : 1;
  const relativeScroll = Number.isFinite(input.relativeScroll)
    ? Math.max(0, input.relativeScroll)
    : 0;

  const denominator = viewportHeight + anchorHeight;
  const normalized = clamp(relativeScroll / denominator, 0, 1);

  return {
    progress: normalized,
    phase:
      normalized <= CHAPTER_PROGRESS_CONFIG.phaseBoundaries.enterMax
        ? "enter"
        : normalized <= CHAPTER_PROGRESS_CONFIG.phaseBoundaries.holdMax
          ? "hold"
          : "depart",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
