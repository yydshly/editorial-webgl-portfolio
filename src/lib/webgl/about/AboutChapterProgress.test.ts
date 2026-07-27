import { describe, expect, it } from "vitest";

import {
  ABOUT_STAGE_BOUNDARIES,
  resolveAboutChapterProgress,
  resolveAboutStage,
  resolveAboutStageWithHysteresis,
  resolveAboutTimelineStagePresentation,
} from "@/lib/webgl/about/AboutChapterProgress";

describe("AboutChapterProgress", () => {
  it("uses the stable nominal intervals at every stage boundary", () => {
    expect(ABOUT_STAGE_BOUNDARIES).toEqual([0, 0.24, 0.49, 0.74, 1]);

    const resolve = (chapterProgress: number) =>
      resolveAboutChapterProgress({
        reducedMotion: false,
        relativeScroll: chapterProgress * 1000,
        viewportHeight: 900,
        anchorHeight: 100,
      });

    expect(resolve(0)).toMatchObject({
      chapterProgress: 0,
      activeStageIndex: 0,
      activeStageId: "origin",
      stageProgress: 0,
    });
    expect(resolve(0.24)).toMatchObject({
      activeStageIndex: 1,
      activeStageId: "industry",
      stageProgress: 0,
    });
    expect(resolve(0.49)).toMatchObject({
      activeStageIndex: 2,
      activeStageId: "onCamera",
      stageProgress: 0,
    });
    expect(resolve(0.74)).toMatchObject({
      activeStageIndex: 3,
      activeStageId: "crossCultural",
      stageProgress: 0,
    });
    expect(resolve(1)).toMatchObject({
      chapterProgress: 1,
      activeStageIndex: 3,
      activeStageId: "crossCultural",
      stageProgress: 1,
    });
  });

  it("exposes the direct nominal stage-id resolver", () => {
    expect(resolveAboutStage(0)).toBe("origin");
    expect(resolveAboutStage(0.24)).toBe("industry");
    expect(resolveAboutStage(0.49)).toBe("onCamera");
    expect(resolveAboutStage(0.74)).toBe("crossCultural");
  });

  it("clamps finite input and safely falls back when viewport or anchor geometry is absent", () => {
    expect(
      resolveAboutChapterProgress({
        reducedMotion: false,
        relativeScroll: -10,
        viewportHeight: 900,
        anchorHeight: 100,
      }),
    ).toMatchObject({ chapterProgress: 0, isAnchored: true });

    expect(
      resolveAboutChapterProgress({
        reducedMotion: false,
        relativeScroll: Number.POSITIVE_INFINITY,
        viewportHeight: 900,
        anchorHeight: 100,
      }),
    ).toMatchObject({ chapterProgress: 0, activeStageId: "origin" });

    expect(
      resolveAboutChapterProgress({ reducedMotion: false }),
    ).toMatchObject({
      chapterProgress: 0,
      activeStageIndex: 0,
      activeStageId: "origin",
      stageProgress: 0,
      isAnchored: false,
    });
  });

  it("selects the same nominal stage for the same progress in either scroll direction", () => {
    const input = {
      reducedMotion: false,
      relativeScroll: 500,
      viewportHeight: 900,
      anchorHeight: 100,
    };

    expect(resolveAboutChapterProgress({ ...input, direction: 1 })).toMatchObject({
      activeStageIndex: 2,
      activeStageId: "onCamera",
    });
    expect(resolveAboutChapterProgress({ ...input, direction: -1 })).toMatchObject({
      activeStageIndex: 2,
      activeStageId: "onCamera",
    });
  });

  it("uses a fixed origin hold for reduced motion", () => {
    expect(
      resolveAboutChapterProgress({
        reducedMotion: true,
        relativeScroll: 1000,
        viewportHeight: 900,
        anchorHeight: 100,
      }),
    ).toEqual({
      chapterProgress: 0,
      progress: 0,
      activeStageIndex: 0,
      activeStageId: "origin",
      stage: "origin",
      stageProgress: 0,
      isAnchored: true,
    });
  });

  it("resolves a large jump directly to its final nominal stage", () => {
    const state = resolveAboutChapterProgress({
      reducedMotion: false,
      relativeScroll: 900,
      viewportHeight: 900,
      anchorHeight: 100,
    });

    expect(state).toMatchObject({
      activeStageIndex: 3,
      activeStageId: "crossCultural",
    });
  });

  it("exposes bounded hysteresis for stateful consumers without changing nominal resolution", () => {
    expect(resolveAboutStageWithHysteresis(0, 0.25)).toBe(0);
    expect(resolveAboutStageWithHysteresis(0, 0.26)).toBe(1);
    expect(resolveAboutStageWithHysteresis(1, 0.22)).toBe(1);
    expect(resolveAboutStageWithHysteresis(1, 0.21)).toBe(0);
    expect(resolveAboutStageWithHysteresis(1, 0.5)).toBe(1);
    expect(resolveAboutStageWithHysteresis(1, 0.51)).toBe(2);
    expect(resolveAboutStageWithHysteresis(2, 0.47)).toBe(2);
    expect(resolveAboutStageWithHysteresis(2, 0.46)).toBe(1);
    expect(resolveAboutStageWithHysteresis(2, 0.76)).toBe(3);
    expect(resolveAboutStageWithHysteresis(3, 0.72)).toBe(2);
    expect(resolveAboutStageWithHysteresis(0, 0.9)).toBe(3);
  });

  it("returns current, immediate previous, and rest DOM presentation roles", () => {
    expect(resolveAboutTimelineStagePresentation(2)).toEqual([
      "rest",
      "previous",
      "current",
      "rest",
    ]);
    expect(resolveAboutTimelineStagePresentation(0)).toEqual([
      "current",
      "rest",
      "rest",
      "rest",
    ]);
    expect(resolveAboutTimelineStagePresentation(99)).toEqual([
      "rest",
      "rest",
      "previous",
      "current",
    ]);
  });
});
