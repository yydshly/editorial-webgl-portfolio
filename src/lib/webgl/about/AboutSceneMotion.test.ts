import { describe, expect, it } from "vitest";

import {
  ABOUT_STAGE_IDS,
  type AboutStageIndex,
} from "@/lib/webgl/about/AboutChapterProgress";
import {
  resolveAboutPortraitMotion,
  type AboutPortraitMotion,
} from "@/lib/webgl/about/AboutSceneMotion";
import { aboutSceneConfig } from "@/lib/webgl/about/aboutSceneConfig";

function resolveCenter(
  activeStageIndex: AboutStageIndex,
  viewportWidth = 1440,
): AboutPortraitMotion {
  return resolveAboutPortraitMotion({
    activeStageIndex,
    stageProgress: 0.5,
    reducedMotion: false,
    viewportWidth,
  });
}

describe("AboutSceneMotion", () => {
  it("maps each stage center to its restrained configured portrait pose", () => {
    ABOUT_STAGE_IDS.forEach((_, index) => {
      const stageIndex = index as AboutStageIndex;
      expect(resolveCenter(stageIndex)).toEqual(
        aboutSceneConfig.motion.stagePoses[stageIndex],
      );
    });

    expect(resolveCenter(0)).toMatchObject({
      translateX: 0,
      translateY: 0,
      scale: 1,
      opacity: 1,
      colorMultiplier: 0.94,
    });
    expect(resolveCenter(1)).toMatchObject({
      translateX: 8,
      translateY: -4,
      scale: 1.01,
    });
    expect(resolveCenter(2)).toMatchObject({
      translateX: 14,
      translateY: -8,
      scale: 1.02,
    });
    expect(resolveCenter(3)).toMatchObject({
      translateX: 20,
      translateY: -10,
      scale: 1.02,
    });
  });

  it("shares the same pose on adjacent stage boundaries without an opacity gap", () => {
    for (let stage = 0; stage < ABOUT_STAGE_IDS.length - 1; stage += 1) {
      const before = resolveAboutPortraitMotion({
        activeStageIndex: stage as AboutStageIndex,
        stageProgress: 1,
        reducedMotion: false,
        viewportWidth: 1440,
      });
      const after = resolveAboutPortraitMotion({
        activeStageIndex: (stage + 1) as AboutStageIndex,
        stageProgress: 0,
        reducedMotion: false,
        viewportWidth: 1440,
      });

      expect(after).toEqual(before);
      expect(after.opacity).toBeGreaterThanOrEqual(
        aboutSceneConfig.motion.minimumRecognizableOpacity,
      );
    }
  });

  it("is deterministic for forward, reverse, and direct fast jumps", () => {
    const target = {
      activeStageIndex: 3 as const,
      stageProgress: 0.72,
      reducedMotion: false,
      viewportWidth: 1440,
    };

    const fromForward = resolveAboutPortraitMotion(target);
    resolveAboutPortraitMotion({
      activeStageIndex: 0,
      stageProgress: 0.1,
      reducedMotion: false,
      viewportWidth: 1440,
    });
    const fromReverse = resolveAboutPortraitMotion(target);

    expect(fromReverse).toEqual(fromForward);
    expect(fromForward).toEqual(aboutSceneConfig.motion.stagePoses[3]);
  });

  it("uses the stable origin hold pose for reduced motion", () => {
    expect(
      resolveAboutPortraitMotion({
        activeStageIndex: 3,
        stageProgress: 1,
        reducedMotion: true,
        viewportWidth: 390,
      }),
    ).toEqual(aboutSceneConfig.motion.stagePoses[0]);
  });

  it("safely resolves non-finite input without zero-area or invisible output", () => {
    const invalid = resolveAboutPortraitMotion({
      activeStageIndex: Number.NaN,
      stageProgress: Number.POSITIVE_INFINITY,
      reducedMotion: false,
      viewportWidth: Number.NaN,
    });

    expect(invalid).toEqual(aboutSceneConfig.motion.stagePoses[0]);
    expect(invalid.opacity).toBeGreaterThanOrEqual(
      aboutSceneConfig.motion.minimumRecognizableOpacity,
    );
    expect(invalid.scale).toBeGreaterThan(0);
    expect("rotation" in invalid).toBe(false);
  });

  it("keeps the same stage semantics on mobile with only restrained translation amplitude", () => {
    const desktop = resolveCenter(2, 1440);
    const mobile = resolveCenter(2, 390);

    expect(mobile.translateX).toBeCloseTo(
      desktop.translateX *
        aboutSceneConfig.motion.responsive.mobileTranslateXMultiplier,
    );
    expect(mobile.translateY).toBeCloseTo(
      desktop.translateY *
        aboutSceneConfig.motion.responsive.mobileTranslateYMultiplier,
    );
    expect(mobile.scale).toBe(desktop.scale);
    expect(mobile.opacity).toBe(desktop.opacity);
    expect(mobile.colorMultiplier).toBe(desktop.colorMultiplier);
  });
});
