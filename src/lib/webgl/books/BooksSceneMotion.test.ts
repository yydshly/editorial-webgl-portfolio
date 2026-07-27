import { describe, expect, it } from "vitest";

import { resolveBooksCoverMotion } from "./BooksSceneMotion";
import { booksSceneMotionConfig } from "./booksSceneConfig";

describe("BooksSceneMotion", () => {
  it("resolves the exact desktop and mobile hold poses at the hold centre", () => {
    expect(
      resolveBooksCoverMotion({
        progress: 0.51,
        reducedMotion: false,
        viewportWidth: 1440,
      }),
    ).toEqual(booksSceneMotionConfig.desktop.hold);
    expect(
      resolveBooksCoverMotion({
        progress: 0.51,
        reducedMotion: false,
        viewportWidth: 390,
      }),
    ).toEqual(booksSceneMotionConfig.mobile.hold);
  });

  it("establishes the primary first at the enter centre", () => {
    const motion = resolveBooksCoverMotion({
      progress: 0.15,
      reducedMotion: false,
      viewportWidth: 1440,
    });

    expect(motion.primary).toMatchObject({
      visualRole: "primary",
      translateX: 0,
      translateY: 1.75,
      scale: 0.9975,
      opacity: 1,
      depthOffsetPx: 0,
    });
    expect(motion["secondary-left"].opacity).toBeCloseTo(0.8965, 3);
    expect(motion["secondary-right"].opacity).toBeCloseTo(0.8528, 3);
    expect(motion["secondary-left"].opacity).toBeGreaterThan(
      motion["secondary-right"].opacity,
    );
  });

  it("moves the trio away as one restrained group at the depart centre", () => {
    const motion = resolveBooksCoverMotion({
      progress: 0.86,
      reducedMotion: false,
      viewportWidth: 1440,
    });
    const hold = booksSceneMotionConfig.desktop.hold;

    expect(motion.primary).toMatchObject({
      translateX: hold.primary.translateX,
      translateY: -16,
      scale: 0.98,
      opacity: 0.96,
    });
    expect(motion["secondary-left"].translateX).toBe(
      hold["secondary-left"].translateX,
    );
    expect(motion["secondary-right"].translateX).toBe(
      hold["secondary-right"].translateX,
    );
    expect(
      motion.primary.translateY - hold.primary.translateY,
    ).toBe(
      motion["secondary-left"].translateY -
        hold["secondary-left"].translateY,
    );
    expect(
      motion.primary.translateY - hold.primary.translateY,
    ).toBe(
      motion["secondary-right"].translateY -
        hold["secondary-right"].translateY,
    );
  });

  it("is deterministic for forward, reverse, and direct fast jumps", () => {
    const target = {
      progress: 0.91,
      reducedMotion: false,
      viewportWidth: 1440,
    };
    const direct = resolveBooksCoverMotion(target);

    resolveBooksCoverMotion({
      ...target,
      progress: 0.1,
    });
    const fromForward = resolveBooksCoverMotion(target);
    resolveBooksCoverMotion({
      ...target,
      progress: 1,
    });
    const fromReverse = resolveBooksCoverMotion(target);

    expect(fromForward).toEqual(direct);
    expect(fromReverse).toEqual(direct);
  });

  it("always keeps the primary larger and more opaque than both secondaries", () => {
    for (const viewportWidth of [1440, 390]) {
      for (const progress of [
        0,
        0.05,
        0.15,
        0.3,
        0.51,
        0.72,
        0.86,
        1,
      ]) {
        const motion = resolveBooksCoverMotion({
          progress,
          reducedMotion: false,
          viewportWidth,
        });
        const primaryArea = motion.primary.scale ** 2;

        for (const role of [
          "secondary-left",
          "secondary-right",
        ] as const) {
          expect(primaryArea).toBeGreaterThan(motion[role].scale ** 2);
          expect(motion.primary.opacity).toBeGreaterThan(motion[role].opacity);
          expect(motion[role].scale).toBeGreaterThan(0);
          expect(motion[role].opacity).toBeGreaterThan(0);
          expect("rotation" in motion[role]).toBe(false);
        }

        expect(motion["secondary-left"].translateX).not.toBe(
          motion["secondary-right"].translateX,
        );
      }
    }
  });

  it("uses the stable hold composition for reduced motion", () => {
    expect(
      resolveBooksCoverMotion({
        progress: 1,
        reducedMotion: true,
        viewportWidth: 390,
      }),
    ).toEqual(booksSceneMotionConfig.mobile.hold);
  });

  it("preserves the same roles on mobile with smaller translation amplitude", () => {
    const desktop = resolveBooksCoverMotion({
      progress: 0.15,
      reducedMotion: false,
      viewportWidth: 1440,
    });
    const mobile = resolveBooksCoverMotion({
      progress: 0.15,
      reducedMotion: false,
      viewportWidth: 390,
    });

    expect(Object.keys(mobile)).toEqual(Object.keys(desktop));
    expect(Math.abs(mobile["secondary-left"].translateX)).toBeLessThan(
      Math.abs(desktop["secondary-left"].translateX),
    );
    expect(Math.abs(mobile["secondary-right"].translateX)).toBeLessThan(
      Math.abs(desktop["secondary-right"].translateX),
    );
    expect(mobile["secondary-left"].scale).toBeGreaterThan(0);
    expect(mobile["secondary-right"].scale).toBeGreaterThan(0);
  });

  it("clamps non-finite and out-of-range progress without zero-area output", () => {
    const invalid = resolveBooksCoverMotion({
      progress: Number.POSITIVE_INFINITY,
      reducedMotion: false,
      viewportWidth: Number.NaN,
    });
    const before = resolveBooksCoverMotion({
      progress: -10,
      reducedMotion: false,
      viewportWidth: 1440,
    });
    const after = resolveBooksCoverMotion({
      progress: 10,
      reducedMotion: false,
      viewportWidth: 1440,
    });

    expect(invalid).toEqual(booksSceneMotionConfig.desktop.enter);
    expect(before).toEqual(booksSceneMotionConfig.desktop.enter);
    expect(after).toEqual(booksSceneMotionConfig.desktop.depart);
  });
});
