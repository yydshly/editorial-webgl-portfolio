import type { AboutStageIndex } from "@/lib/webgl/about/AboutChapterProgress";
import {
  aboutSceneConfig,
  type AboutPortraitStagePose,
} from "@/lib/webgl/about/aboutSceneConfig";

export type AboutPortraitMotion = AboutPortraitStagePose;

export type AboutPortraitMotionInput = {
  readonly activeStageIndex: AboutStageIndex | number;
  readonly stageProgress: number;
  readonly reducedMotion: boolean;
  readonly viewportWidth: number;
};

const LAST_STAGE_INDEX = aboutSceneConfig.motion.stagePoses.length - 1;

/**
 * Resolves one final portrait pose from the current About state.
 *
 * Stage centres are the authored poses. Adjacent stages share a midpoint pose
 * at their boundary so forward and reverse traversal remain continuous. The
 * resolver has no history and therefore lands directly on a fast-jump target.
 */
export function resolveAboutPortraitMotion(
  input: AboutPortraitMotionInput,
): AboutPortraitMotion {
  if (input.reducedMotion) {
    return aboutSceneConfig.motion.stagePoses[0];
  }

  const stageIndex = sanitizeStageIndex(input.activeStageIndex);
  const stageProgress = clamp(finiteOrZero(input.stageProgress), 0, 1);
  const current = aboutSceneConfig.motion.stagePoses[stageIndex];
  const previous =
    aboutSceneConfig.motion.stagePoses[Math.max(0, stageIndex - 1)];
  const next =
    aboutSceneConfig.motion.stagePoses[
      Math.min(LAST_STAGE_INDEX, stageIndex + 1)
    ];
  const start =
    stageIndex === 0 ? current : mixPose(previous, current, 0.5);
  const end =
    stageIndex === LAST_STAGE_INDEX
      ? current
      : mixPose(current, next, 0.5);
  const authoredPose =
    stageProgress <= 0.5
      ? mixPose(start, current, easeInOutCubic(stageProgress * 2))
      : mixPose(current, end, easeInOutCubic((stageProgress - 0.5) * 2));
  const isMobile =
    Number.isFinite(input.viewportWidth) &&
    input.viewportWidth <= aboutSceneConfig.mobileBreakpoint;

  if (!isMobile) {
    return authoredPose;
  }

  return {
    ...authoredPose,
    translateX:
      authoredPose.translateX *
      aboutSceneConfig.motion.responsive.mobileTranslateXMultiplier,
    translateY:
      authoredPose.translateY *
      aboutSceneConfig.motion.responsive.mobileTranslateYMultiplier,
  };
}

function mixPose(
  from: AboutPortraitStagePose,
  to: AboutPortraitStagePose,
  ratio: number,
): AboutPortraitMotion {
  return {
    translateX: mix(from.translateX, to.translateX, ratio),
    translateY: mix(from.translateY, to.translateY, ratio),
    scale: Math.max(0.0001, mix(from.scale, to.scale, ratio)),
    opacity: Math.max(
      aboutSceneConfig.motion.minimumRecognizableOpacity,
      mix(from.opacity, to.opacity, ratio),
    ),
    colorMultiplier: clamp(
      mix(from.colorMultiplier, to.colorMultiplier, ratio),
      0,
      1,
    ),
  };
}

function sanitizeStageIndex(value: number): AboutStageIndex {
  return clamp(
    Math.trunc(finiteOrZero(value)),
    0,
    LAST_STAGE_INDEX,
  ) as AboutStageIndex;
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

function finiteOrZero(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
