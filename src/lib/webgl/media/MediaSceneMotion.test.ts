import { describe, expect, it } from "vitest";

import {
  MEDIA_MOTION_CONFIG,
  resolveMediaMotion,
} from "@/lib/webgl/media/MediaSceneMotion";

describe("MediaSceneMotion", () => {
  it("maps media enter poses with configured keyframes at 0, 0.1, 0.18", () => {
    const p0 = resolveMediaMotion({
      reducedMotion: false,
      progress: 0,
      phase: "enter",
    });
    const p01 = resolveMediaMotion({
      reducedMotion: false,
      progress: 0.1,
      phase: "enter",
    });
    const p018 = resolveMediaMotion({
      reducedMotion: false,
      progress: 0.18,
      phase: "enter",
    });

    expect(p0.main.translateX).toBeCloseTo(MEDIA_MOTION_CONFIG.main.enterKeyframes[0].transform.translateX, 6);
    expect(p0.main.translateY).toBeCloseTo(MEDIA_MOTION_CONFIG.main.enterKeyframes[0].transform.translateY, 6);
    expect(p0.main.scale).toBeCloseTo(MEDIA_MOTION_CONFIG.main.enterKeyframes[0].transform.scale, 6);
    expect(p0.main.opacity).toBeCloseTo(MEDIA_MOTION_CONFIG.main.enterKeyframes[0].transform.opacity, 6);

    expect(p01.main.translateX).toBeCloseTo(MEDIA_MOTION_CONFIG.main.enterKeyframes[1].transform.translateX, 6);
    expect(p01.main.translateY).toBeCloseTo(MEDIA_MOTION_CONFIG.main.enterKeyframes[1].transform.translateY, 6);
    expect(p01.main.scale).toBeCloseTo(MEDIA_MOTION_CONFIG.main.enterKeyframes[1].transform.scale, 6);
    expect(p01.main.opacity).toBeCloseTo(MEDIA_MOTION_CONFIG.main.enterKeyframes[1].transform.opacity, 6);

    expect(p018.main.translateX).toBeCloseTo(MEDIA_MOTION_CONFIG.main.enterKeyframes[2].transform.translateX, 6);
    expect(p018.main.translateY).toBeCloseTo(MEDIA_MOTION_CONFIG.main.enterKeyframes[2].transform.translateY, 6);
    expect(p018.main.scale).toBeCloseTo(MEDIA_MOTION_CONFIG.main.enterKeyframes[2].transform.scale, 6);
    expect(p018.main.opacity).toBeCloseTo(MEDIA_MOTION_CONFIG.main.enterKeyframes[2].transform.opacity, 6);

    expect(p0.secondary.translateX).toBeCloseTo(
      MEDIA_MOTION_CONFIG.secondary.enterKeyframes[0].transform.translateX,
      6,
    );
    expect(p0.secondary.translateY).toBeCloseTo(
      MEDIA_MOTION_CONFIG.secondary.enterKeyframes[0].transform.translateY,
      6,
    );
    expect(p01.secondary.translateX).toBeCloseTo(
      MEDIA_MOTION_CONFIG.secondary.enterKeyframes[1].transform.translateX,
      6,
    );
    expect(p01.secondary.translateY).toBeCloseTo(
      MEDIA_MOTION_CONFIG.secondary.enterKeyframes[1].transform.translateY,
      6,
    );
    expect(p018.secondary.translateX).toBeCloseTo(
      MEDIA_MOTION_CONFIG.secondary.enterKeyframes[2].transform.translateX,
      6,
    );
    expect(p018.secondary.translateY).toBeCloseTo(
      MEDIA_MOTION_CONFIG.secondary.enterKeyframes[2].transform.translateY,
      6);

    expect(p0.secondary.scale).toBeCloseTo(MEDIA_MOTION_CONFIG.secondary.enterKeyframes[0].transform.scale, 6);
    expect(p01.secondary.scale).toBeCloseTo(MEDIA_MOTION_CONFIG.secondary.enterKeyframes[1].transform.scale, 6);
    expect(p018.secondary.scale).toBeCloseTo(MEDIA_MOTION_CONFIG.secondary.enterKeyframes[2].transform.scale, 6);
  });

  it("maps enter phase transforms with interpolation", () => {
    const start = resolveMediaMotion({
      reducedMotion: false,
      progress: 0,
      phase: "enter",
    });
    const hold = resolveMediaMotion({
      reducedMotion: false,
      progress: MEDIA_MOTION_CONFIG.phase.enterThreshold,
      phase: "enter",
    });

    expect(start.main.translateX).toBe(MEDIA_MOTION_CONFIG.main.enterPose.translateX);
    expect(start.main.opacity).toBe(MEDIA_MOTION_CONFIG.main.enterPose.opacity);
    expect(start.main.scale).toBe(MEDIA_MOTION_CONFIG.main.enterPose.scale);

    expect(hold.main.translateX).toBe(MEDIA_MOTION_CONFIG.main.holdPose.translateX);
    expect(hold.main.scale).toBe(MEDIA_MOTION_CONFIG.main.holdPose.scale);
    expect(hold.main.opacity).toBe(MEDIA_MOTION_CONFIG.main.holdPose.opacity);
  });

  it("keeps hold pose in hold phase", () => {
    const hold = resolveMediaMotion({
      reducedMotion: false,
      progress: 0.5,
      phase: "hold",
    });

    expect(hold.main).toEqual(MEDIA_MOTION_CONFIG.main.holdPose);
    expect(hold.secondary).toEqual(MEDIA_MOTION_CONFIG.secondary.holdPose);
  });

  it("maps depart phase transforms with interpolation", () => {
    const start = resolveMediaMotion({
      reducedMotion: false,
      progress: 0.72,
      phase: "depart",
    });
    const end = resolveMediaMotion({
      reducedMotion: false,
      progress: 1,
      phase: "depart",
    });

    expect(start.main.opacity).toBe(MEDIA_MOTION_CONFIG.main.holdPose.opacity);
    expect(start.main.translateX).toBe(MEDIA_MOTION_CONFIG.main.holdPose.translateX);
    expect(end.main.opacity).toBeCloseTo(MEDIA_MOTION_CONFIG.main.departPose.opacity);
    expect(end.main.scale).toBeCloseTo(MEDIA_MOTION_CONFIG.main.departPose.scale);
  });

  it("keeps main and secondary transforms distinct", () => {
    const state = resolveMediaMotion({
      reducedMotion: false,
      progress: 0.1,
      phase: "enter",
    });

    expect(state.main.opacity).not.toBe(state.secondary.opacity);
    expect(state.main.translateX).not.toBe(state.secondary.translateX);
    expect(state.main).not.toEqual(state.secondary);
    expect(state.main.scale).not.toBeCloseTo(state.secondary.scale);
    expect(state.main.translateY).not.toBe(state.secondary.translateY);
  });

  it("prevents main and secondary from fully overlapping during enter", () => {
    const state = resolveMediaMotion({
      reducedMotion: false,
      progress: 0.18,
      phase: "enter",
    });

    const deltaX = Math.abs(state.main.translateX - state.secondary.translateX);
    const deltaY = Math.abs(state.main.translateY - state.secondary.translateY);

    expect(deltaX).toBeGreaterThan(1);
    expect(deltaY).toBeGreaterThan(1);
    expect(state.secondary.opacity).toBeLessThan(state.main.opacity);
    expect(state.secondary.opacity).toBeGreaterThan(0);
  });

  it("falls back to hold pose when reduced motion enabled", () => {
    const state = resolveMediaMotion({
      reducedMotion: true,
      progress: 0.9,
      phase: "depart",
    });

    expect(state.main).toEqual(MEDIA_MOTION_CONFIG.main.holdPose);
    expect(state.secondary).toEqual(MEDIA_MOTION_CONFIG.secondary.holdPose);
  });
});
