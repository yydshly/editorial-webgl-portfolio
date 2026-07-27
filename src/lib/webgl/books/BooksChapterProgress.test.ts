import { describe, expect, it } from "vitest";

import {
  BOOKS_PHASE_BOUNDARIES,
  BOOKS_REDUCED_MOTION_PROGRESS,
  resolveBooksChapterProgress,
} from "./BooksChapterProgress";

const geometry = {
  viewportHeight: 800,
  anchorHeight: 1000,
};

function relativeScrollFor(progress: number): number {
  return progress * (geometry.viewportHeight + geometry.anchorHeight);
}

describe("BooksChapterProgress", () => {
  it("maps enter, hold, and depart centres to normalized phase progress", () => {
    expect(
      resolveBooksChapterProgress({
        ...geometry,
        relativeScroll: relativeScrollFor(0.15),
        reducedMotion: false,
      }),
    ).toMatchObject({
      chapterProgress: 0.15,
      phase: "enter",
      phaseProgress: 0.5,
      isAnchored: true,
    });
    expect(
      resolveBooksChapterProgress({
        ...geometry,
        relativeScroll: relativeScrollFor(0.51),
        reducedMotion: false,
      }),
    ).toMatchObject({
      chapterProgress: 0.51,
      phase: "hold",
      phaseProgress: 0.5,
      isAnchored: true,
    });
    expect(
      resolveBooksChapterProgress({
        ...geometry,
        relativeScroll: relativeScrollFor(0.86),
        reducedMotion: false,
      }),
    ).toMatchObject({
      chapterProgress: 0.86,
      phase: "depart",
      phaseProgress: 0.5,
      isAnchored: true,
    });
  });

  it("assigns exact phase boundaries to the phase that begins there", () => {
    const holdBoundary = resolveBooksChapterProgress({
      ...geometry,
      relativeScroll: relativeScrollFor(BOOKS_PHASE_BOUNDARIES.enterMax),
      reducedMotion: false,
    });
    const departBoundary = resolveBooksChapterProgress({
      ...geometry,
      relativeScroll: relativeScrollFor(BOOKS_PHASE_BOUNDARIES.holdMax),
      reducedMotion: false,
    });

    expect(holdBoundary).toMatchObject({
      phase: "hold",
      phaseProgress: 0,
    });
    expect(departBoundary).toMatchObject({
      phase: "depart",
      phaseProgress: 0,
    });
  });

  it("clamps negative, oversized, NaN, and infinite input safely", () => {
    expect(
      resolveBooksChapterProgress({
        ...geometry,
        relativeScroll: -100,
        reducedMotion: false,
      }).chapterProgress,
    ).toBe(0);
    expect(
      resolveBooksChapterProgress({
        ...geometry,
        relativeScroll: 9000,
        reducedMotion: false,
      }).chapterProgress,
    ).toBe(1);

    for (const relativeScroll of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ]) {
      expect(
        resolveBooksChapterProgress({
          ...geometry,
          relativeScroll,
          reducedMotion: false,
        }),
      ).toEqual({
        chapterProgress: 0,
        phase: "enter",
        phaseProgress: 0,
        isAnchored: false,
      });
    }
  });

  it("reports missing or invalid geometry without inventing an anchor", () => {
    expect(
      resolveBooksChapterProgress({
        relativeScroll: 100,
        reducedMotion: false,
      }),
    ).toEqual({
      chapterProgress: 0,
      phase: "enter",
      phaseProgress: 0,
      isAnchored: false,
    });
    expect(
      resolveBooksChapterProgress({
        relativeScroll: 100,
        viewportHeight: 0,
        anchorHeight: Number.NaN,
        reducedMotion: false,
      }).isAnchored,
    ).toBe(false);
  });

  it("uses one stable hold state for reduced motion", () => {
    expect(
      resolveBooksChapterProgress({
        ...geometry,
        relativeScroll: 9000,
        reducedMotion: true,
      }),
    ).toEqual({
      chapterProgress: BOOKS_REDUCED_MOTION_PROGRESS,
      phase: "hold",
      phaseProgress: 0.5,
      isAnchored: true,
    });
  });
});
