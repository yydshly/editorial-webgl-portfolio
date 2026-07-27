import { describe, expect, it } from "vitest";

import MotionSnapshotStore, {
  type MotionSnapshotState,
} from "@/lib/motion/MotionSnapshotStore";
import HeroObjectLayer from "@/lib/webgl/hero/HeroObjectLayer";
import { heroSceneConfig } from "@/lib/webgl/hero/heroSceneConfig";

const createSnapshot = (): MotionSnapshotState => {
  const snapshot = new MotionSnapshotStore();
  snapshot.updateViewport({
    width: 1200,
    height: 800,
    scrollX: 0,
    scrollY: 0,
    devicePixelRatio: 1,
    isPortrait: false,
  });
  snapshot.updatePointer({
    id: 1,
    x: 950,
    y: 620,
    prevX: 940,
    prevY: 610,
    dx: 10,
    dy: 10,
    velocityX: 0,
    velocityY: 0,
    isDown: false,
  });
  snapshot.updateScroll({
    scrollX: 0,
    scrollY: 120,
    velocity: 0,
    direction: 1,
    source: "native",
    timestamp: 16,
  });
  snapshot.updateFrame({
    frame: 1,
    timestamp: 16,
    delta: 0.016,
    elapsed: 0.016,
  });

  return snapshot.getSnapshot();
};

describe("HeroObjectLayer", () => {
  it("clamps target parallax values within configured bounds", () => {
    const layer = new HeroObjectLayer(heroSceneConfig.parallax);
    layer.updateFromSnapshot(createSnapshot(), null);

    const snapshot = layer.snapshot.current;
    expect(snapshot.rotateX).toBeLessThanOrEqual(heroSceneConfig.parallax.maxRotateX);
    expect(snapshot.rotateX).toBeGreaterThanOrEqual(-heroSceneConfig.parallax.maxRotateX);
    expect(snapshot.translateY).toBeLessThanOrEqual(heroSceneConfig.parallax.maxTranslateY + 0.0001);
    expect(snapshot.translateY).toBeGreaterThanOrEqual(-heroSceneConfig.parallax.maxTranslateY - 0.0001);
    expect(snapshot.opacity).toBeGreaterThanOrEqual(0.65);
    expect(snapshot.opacity).toBeLessThanOrEqual(1);
  });

  it("returns to neutral transform when reduced motion is enabled", () => {
    const layer = new HeroObjectLayer(heroSceneConfig.parallax);
    const reducedMotion = new MotionSnapshotStore();
    reducedMotion.setReducedMotion(true);
    reducedMotion.updateViewport({
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      isPortrait: false,
    });
    reducedMotion.updatePointer({
      id: 1,
      x: 950,
      y: 620,
      prevX: 940,
      prevY: 610,
      dx: 10,
      dy: 10,
      velocityX: 0,
      velocityY: 0,
      isDown: false,
    });
    reducedMotion.updateScroll({
      scrollX: 0,
      scrollY: 120,
      velocity: 0,
      direction: 1,
      source: "native",
      timestamp: 16,
    });
    reducedMotion.updateFrame({
      frame: 2,
      timestamp: 32,
      delta: 0.016,
      elapsed: 0.032,
    });

    layer.updateFromSnapshot(reducedMotion.getSnapshot(), null);
    const after = layer.snapshot.current;

    expect(after.rotateX).toBeCloseTo(0, 4);
    expect(after.translateX).toBeCloseTo(0, 2);
    expect(after.opacity).toBeLessThanOrEqual(1);
  });
});
