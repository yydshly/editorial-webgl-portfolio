import { describe, expect, it } from "vitest";

import { MEDIA_PROGRESS_CONFIG } from "@/lib/webgl/media/MediaSceneProgress";
import { resolveMediaChapterProgress } from "@/lib/webgl/media/MediaSceneProgress";

describe("MediaScene progress", () => {
  it("uses the anchor center travel window as the normalized media progress span", () => {
    const anchorHeight = 200;

    const midpoint = resolveMediaChapterProgress({
      reducedMotion: false,
      relativeScroll: anchorHeight * 0.25,
      viewportHeight: 800,
      anchorHeight,
    });
    const exitTop = resolveMediaChapterProgress({
      reducedMotion: false,
      relativeScroll: anchorHeight * 0.5,
      viewportHeight: 800,
      anchorHeight,
    });

    expect(midpoint.progress).toBeCloseTo(0.5);
    expect(exitTop.progress).toBeCloseTo(1);
  });

  it("calculates normalized progress from anchor-center relative scroll", () => {
    const state = resolveMediaChapterProgress({
      reducedMotion: false,
      relativeScroll: 90,
      viewportHeight: 800,
      anchorHeight: 600,
    });

    expect(state.progress).toBeCloseTo(0.3);
    expect(state.phase).toBe("hold");
  });

  it("maps to enter, hold, depart phases", () => {
    const enter = resolveMediaChapterProgress({
      reducedMotion: false,
      relativeScroll: 20,
      viewportHeight: 800,
      anchorHeight: 600,
    }).phase;
    const hold = resolveMediaChapterProgress({
      reducedMotion: false,
      relativeScroll: 120,
      viewportHeight: 800,
      anchorHeight: 600,
    }).phase;
    const depart = resolveMediaChapterProgress({
      reducedMotion: false,
      relativeScroll: 260,
      viewportHeight: 800,
      anchorHeight: 600,
    }).phase;

    expect(enter).toBe("enter");
    expect(hold).toBe("hold");
    expect(depart).toBe("depart");
  });

  it("falls back to hold when reduced motion is enabled", () => {
    const state = resolveMediaChapterProgress({
      reducedMotion: true,
      relativeScroll: 900,
      viewportHeight: 800,
      anchorHeight: 200,
    });

    expect(state.phase).toBe("hold");
    expect(state.progress).toBe(MEDIA_PROGRESS_CONFIG.reducedMotionProgress);
  });
});
