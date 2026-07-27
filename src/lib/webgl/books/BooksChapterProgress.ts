import {
  BOOKS_PHASE_BOUNDARIES,
  BOOKS_REDUCED_MOTION_PROGRESS,
} from "./booksSceneConfig";

export {
  BOOKS_PHASE_BOUNDARIES,
  BOOKS_REDUCED_MOTION_PROGRESS,
} from "./booksSceneConfig";

export type BooksChapterPhase = "enter" | "hold" | "depart";

export type BooksChapterProgressInput = {
  readonly reducedMotion: boolean;
  readonly relativeScroll?: number;
  readonly viewportHeight?: number;
  readonly anchorHeight?: number;
};

export type BooksChapterProgressState = {
  readonly chapterProgress: number;
  readonly phase: BooksChapterPhase;
  readonly phaseProgress: number;
  readonly isAnchored: boolean;
};

type BooksPhaseState = Pick<
  BooksChapterProgressState,
  "phase" | "phaseProgress"
>;

export function resolveBooksPhase(chapterProgress: number): BooksPhaseState {
  const progress = clamp(
    Number.isFinite(chapterProgress) ? chapterProgress : 0,
    0,
    1,
  );

  if (progress < BOOKS_PHASE_BOUNDARIES.enterMax) {
    return {
      phase: "enter",
      phaseProgress: normalizePhaseProgress(
        progress / BOOKS_PHASE_BOUNDARIES.enterMax,
      ),
    };
  }

  if (progress < BOOKS_PHASE_BOUNDARIES.holdMax) {
    return {
      phase: "hold",
      phaseProgress: normalizePhaseProgress(
        (progress - BOOKS_PHASE_BOUNDARIES.enterMax) /
        (BOOKS_PHASE_BOUNDARIES.holdMax -
          BOOKS_PHASE_BOUNDARIES.enterMax),
      ),
    };
  }

  return {
    phase: "depart",
    phaseProgress: normalizePhaseProgress(
      (progress - BOOKS_PHASE_BOUNDARIES.holdMax) /
      (1 - BOOKS_PHASE_BOUNDARIES.holdMax),
    ),
  };
}

export function resolveBooksChapterProgress(
  input: BooksChapterProgressInput,
): BooksChapterProgressState {
  const hasGeometry =
    Number.isFinite(input.viewportHeight) &&
    (input.viewportHeight ?? 0) > 0 &&
    Number.isFinite(input.anchorHeight) &&
    (input.anchorHeight ?? 0) > 0;
  const hasRelativeScroll = Number.isFinite(input.relativeScroll);
  const isAnchored = hasGeometry && hasRelativeScroll;

  if (input.reducedMotion) {
    return {
      chapterProgress: BOOKS_REDUCED_MOTION_PROGRESS,
      phase: "hold",
      phaseProgress: 0.5,
      isAnchored,
    };
  }

  if (!isAnchored) {
    return {
      chapterProgress: 0,
      phase: "enter",
      phaseProgress: 0,
      isAnchored: false,
    };
  }

  const travel =
    (input.viewportHeight as number) + (input.anchorHeight as number);
  const chapterProgress = clamp(
    Math.max(0, input.relativeScroll as number) / travel,
    0,
    1,
  );

  return {
    chapterProgress,
    ...resolveBooksPhase(chapterProgress),
    isAnchored: true,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function normalizePhaseProgress(value: number): number {
  return Math.round(clamp(value, 0, 1) * 1_000_000_000_000) /
    1_000_000_000_000;
}
