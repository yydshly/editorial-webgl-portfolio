import { describe, expect, it } from "vitest";

import { CHAPTER_PROGRESS_CONFIG } from "@/lib/webgl/hero/heroSceneConfig";
import { resolveHeroChapterProgress } from "@/lib/webgl/hero/HeroChapterProgress";

describe("HeroChapterProgress", () => {
  it("normalizes progress from relative scroll and viewport anchor size", () => {
    const state = resolveHeroChapterProgress({
      reducedMotion: false,
      relativeScroll: 350,
      viewportHeight: 900,
      anchorHeight: 100,
    });

    expect(state.progress).toBeCloseTo(0.35);
    expect(state.phase).toBe("hold");
  });

  it("maps progress into enter / hold / depart phases", () => {
    const boundaries = {
      enter: resolveHeroChapterProgress({
        reducedMotion: false,
        relativeScroll: 100,
        viewportHeight: 900,
        anchorHeight: 100,
      }).phase,
      hold: resolveHeroChapterProgress({
        reducedMotion: false,
        relativeScroll: 400,
        viewportHeight: 900,
        anchorHeight: 100,
      }).phase,
      depart: resolveHeroChapterProgress({
        reducedMotion: false,
        relativeScroll: 700,
        viewportHeight: 900,
        anchorHeight: 100,
      }).phase,
    };

    expect(boundaries.enter).toBe("enter");
    expect(boundaries.hold).toBe("hold");
    expect(boundaries.depart).toBe("depart");
  });

  it("respects reduced motion fallback", () => {
    const state = resolveHeroChapterProgress({
      reducedMotion: true,
      relativeScroll: 900,
      viewportHeight: 900,
      anchorHeight: 100,
    });

    expect(state.phase).toBe("hold");
    expect(state.progress).toBe(CHAPTER_PROGRESS_CONFIG.reducedMotionProgress);
  });
});
