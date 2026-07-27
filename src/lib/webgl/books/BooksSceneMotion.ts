import { resolveBooksPhase } from "./BooksChapterProgress";
import {
  BOOKS_ENTER_DELAYS,
  BOOKS_MOBILE_BREAKPOINT,
  booksSceneMotionConfig,
  type BookCoverPose,
  type BooksCoverMotion,
} from "./booksSceneConfig";

export type { BookCoverPose, BooksCoverMotion } from "./booksSceneConfig";

export type BooksCoverMotionInput = {
  readonly progress: number;
  readonly reducedMotion: boolean;
  readonly viewportWidth: number;
};

export function resolveBooksCoverMotion(
  input: BooksCoverMotionInput,
): BooksCoverMotion {
  const viewportConfig = isMobile(input.viewportWidth)
    ? booksSceneMotionConfig.mobile
    : booksSceneMotionConfig.desktop;

  if (input.reducedMotion) {
    return cloneMotion(viewportConfig.hold);
  }

  const progress = clamp(
    Number.isFinite(input.progress) ? input.progress : 0,
    0,
    1,
  );
  const { phase, phaseProgress } = resolveBooksPhase(progress);

  if (phase === "hold") {
    return cloneMotion(viewportConfig.hold);
  }

  if (phase === "depart") {
    return mixMotion(
      viewportConfig.hold,
      viewportConfig.depart,
      easeInOutCubic(phaseProgress),
    );
  }

  return {
    primary: mixPose(
      viewportConfig.enter.primary,
      viewportConfig.hold.primary,
      easeOutCubic(delayedProgress(phaseProgress, BOOKS_ENTER_DELAYS.primary)),
    ),
    "secondary-left": mixPose(
      viewportConfig.enter["secondary-left"],
      viewportConfig.hold["secondary-left"],
      easeOutCubic(
        delayedProgress(
          phaseProgress,
          BOOKS_ENTER_DELAYS["secondary-left"],
        ),
      ),
    ),
    "secondary-right": mixPose(
      viewportConfig.enter["secondary-right"],
      viewportConfig.hold["secondary-right"],
      easeOutCubic(
        delayedProgress(
          phaseProgress,
          BOOKS_ENTER_DELAYS["secondary-right"],
        ),
      ),
    ),
  };
}

function mixMotion(
  from: BooksCoverMotion,
  to: BooksCoverMotion,
  ratio: number,
): BooksCoverMotion {
  return {
    primary: mixPose(from.primary, to.primary, ratio),
    "secondary-left": mixPose(
      from["secondary-left"],
      to["secondary-left"],
      ratio,
    ),
    "secondary-right": mixPose(
      from["secondary-right"],
      to["secondary-right"],
      ratio,
    ),
  };
}

function mixPose(
  from: BookCoverPose,
  to: BookCoverPose,
  ratio: number,
): BookCoverPose {
  return {
    visualRole: from.visualRole,
    translateX: mix(from.translateX, to.translateX, ratio),
    translateY: mix(from.translateY, to.translateY, ratio),
    scale: Math.max(0.0001, mix(from.scale, to.scale, ratio)),
    opacity: clamp(mix(from.opacity, to.opacity, ratio), 0.0001, 1),
    depthOffsetPx: mix(from.depthOffsetPx, to.depthOffsetPx, ratio),
  };
}

function cloneMotion(motion: BooksCoverMotion): BooksCoverMotion {
  return {
    primary: { ...motion.primary },
    "secondary-left": { ...motion["secondary-left"] },
    "secondary-right": { ...motion["secondary-right"] },
  };
}

function delayedProgress(progress: number, delay: number): number {
  if (delay <= 0) {
    return clamp(progress, 0, 1);
  }

  return clamp((progress - delay) / (1 - delay), 0, 1);
}

function easeOutCubic(value: number): number {
  const normalized = clamp(value, 0, 1);
  return 1 - Math.pow(1 - normalized, 3);
}

function easeInOutCubic(value: number): number {
  const normalized = clamp(value, 0, 1);
  return normalized < 0.5
    ? 4 * normalized * normalized * normalized
    : 1 - Math.pow(-2 * normalized + 2, 3) / 2;
}

function mix(from: number, to: number, ratio: number): number {
  return from + (to - from) * ratio;
}

function isMobile(viewportWidth: number): boolean {
  return (
    Number.isFinite(viewportWidth) &&
    viewportWidth > 0 &&
    viewportWidth <= BOOKS_MOBILE_BREAKPOINT
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
