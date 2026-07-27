import { describe, expect, it } from "vitest";

import CameraRig from "@/lib/webgl/CameraRig";
import DOMTracker from "@/lib/webgl/DOMTracker";
import FrameCoordinator from "@/lib/motion/FrameCoordinator";
import MotionBus from "@/lib/motion/MotionBus";
import MotionSnapshotStore from "@/lib/motion/MotionSnapshotStore";
import AssetRegistry from "@/lib/webgl/AssetRegistry";
import HeroScene from "@/lib/webgl/hero/HeroScene";
import {
  CHAPTER_PROGRESS_CONFIG,
  HERO_SCENE_ANCHOR_ID,
  HERO_MOTION_CONFIG,
  heroSceneConfig,
} from "@/lib/webgl/hero/heroSceneConfig";

const CHAPTER_SCROLL_RANGE = 980;

const mountHeroAnchor = (domTracker: DOMTracker): void => {
  const anchor = document.createElement("div");
  anchor.id = HERO_SCENE_ANCHOR_ID;
  anchor.style.width = "320px";
  anchor.style.height = "180px";
  document.body.appendChild(anchor);
  domTracker.register({
    id: HERO_SCENE_ANCHOR_ID,
    element: anchor,
    sceneType: "hero",
  });
  domTracker.connect();
  domTracker.refreshFromDirty();
};

const createScene = (): {
  scene: HeroScene;
  frame: FrameCoordinator;
  domTracker: DOMTracker;
  snapshot: MotionSnapshotStore;
  assetRegistry: AssetRegistry<HTMLImageElement>;
} => {
  const bus = new MotionBus();
  const frame = new FrameCoordinator(bus);
  const assetRegistry = new AssetRegistry<HTMLImageElement>();
  const cameraRig = new CameraRig();
  const domTracker = new DOMTracker(frame, bus, cameraRig);
  const snapshot = new MotionSnapshotStore();

  return {
    scene: new HeroScene({
      assetRegistry,
      domTracker,
      snapshot,
    }),
    frame,
    domTracker,
    snapshot,
    assetRegistry,
  };
};

const updateViewportPair = (
  snapshot: MotionSnapshotStore,
  domTracker: DOMTracker,
  update: {
    readonly width: number;
    readonly height: number;
    readonly scrollY: number;
    readonly isPortrait?: boolean;
  },
): void => {
  snapshot.updateViewport({
    width: update.width,
    height: update.height,
    scrollX: 0,
    scrollY: update.scrollY,
    devicePixelRatio: 1,
    isPortrait: update.isPortrait ?? false,
  });
  domTracker.updateViewport(update.width, update.height);
  domTracker.updateViewport({
    width: update.width,
    height: update.height,
    scrollX: 0,
    scrollY: update.scrollY,
    devicePixelRatio: 1,
    isPortrait: update.isPortrait ?? false,
  });
};

const tick = (snapshot: MotionSnapshotStore, frame: number): void => {
  snapshot.updateFrame({
    frame,
    timestamp: frame * 16,
    delta: 0.016,
    elapsed: frame * 0.016,
  });
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const mix = (from: number, to: number, t: number): number => from + (to - from) * t;

const easeOutCubic = (value: number): number => 1 - Math.pow(1 - clamp(value, 0, 1), 3);

const resolveChapterPose = (progress: number, reducedMotion = false) => {
  if (reducedMotion) {
    return {
      translateX: 0,
      translateY: 0,
      opacity: HERO_MOTION_CONFIG.opacity.base,
      scale: HERO_MOTION_CONFIG.scale.base,
    };
  }

  const clampedProgress = clamp(progress, 0, 1);
  if (clampedProgress <= CHAPTER_PROGRESS_CONFIG.phaseBoundaries.enterMax) {
    const ratio = easeOutCubic(clamp(progress / CHAPTER_PROGRESS_CONFIG.phaseBoundaries.enterMax, 0, 1));
    return {
      translateX: mix(HERO_MOTION_CONFIG.translation.enter.x, HERO_MOTION_CONFIG.translation.hold.x, ratio),
      translateY: mix(HERO_MOTION_CONFIG.translation.enter.y, HERO_MOTION_CONFIG.translation.hold.y, ratio),
      opacity: mix(HERO_MOTION_CONFIG.opacity.enterStart, HERO_MOTION_CONFIG.opacity.base, ratio),
      scale: mix(HERO_MOTION_CONFIG.scale.enterStart, HERO_MOTION_CONFIG.scale.base, ratio),
    };
  }

  if (clampedProgress <= CHAPTER_PROGRESS_CONFIG.phaseBoundaries.holdMax) {
    return {
      translateX: HERO_MOTION_CONFIG.translation.hold.x,
      translateY: HERO_MOTION_CONFIG.translation.hold.y,
      opacity: HERO_MOTION_CONFIG.opacity.hold,
      scale: HERO_MOTION_CONFIG.scale.hold,
    };
  }

  const keyframes = [
    {
      progress: CHAPTER_PROGRESS_CONFIG.phaseBoundaries.holdMax,
      translateX: HERO_MOTION_CONFIG.translation.hold.x,
      translateY: HERO_MOTION_CONFIG.translation.hold.y,
      opacity: HERO_MOTION_CONFIG.opacity.hold,
      scale: HERO_MOTION_CONFIG.scale.hold,
    },
    ...HERO_MOTION_CONFIG.depart.keyframes.map((pose) => ({
      progress: pose.progress,
      translateX: pose.translation.x,
      translateY: pose.translation.y,
      opacity: pose.opacity,
      scale: pose.scale,
    })),
  ];

  const clampDepartProgress = clamp(
    clampedProgress,
    CHAPTER_PROGRESS_CONFIG.phaseBoundaries.holdMax,
    1,
  );
  const last = keyframes.at(-1);
  if (!last) {
    return {
      translateX: HERO_MOTION_CONFIG.translation.hold.x,
      translateY: HERO_MOTION_CONFIG.translation.hold.y,
      opacity: HERO_MOTION_CONFIG.opacity.hold,
      scale: HERO_MOTION_CONFIG.scale.hold,
    };
  }

  if (clampDepartProgress >= last.progress) {
    return {
      translateX: last.translateX,
      translateY: last.translateY,
      opacity: last.opacity,
      scale: last.scale,
    };
  }

  for (let index = 0; index < keyframes.length - 1; index += 1) {
    const from = keyframes[index];
    const to = keyframes[index + 1];
    if (!from || !to) {
      continue;
    }

    if (clampDepartProgress <= to.progress) {
      const ratio = easeInOutCubic(
        (clampDepartProgress - from.progress) / Math.max(0.0001, to.progress - from.progress),
      );
      return {
        translateX: mix(from.translateX, to.translateX, ratio),
        translateY: mix(from.translateY, to.translateY, ratio),
        opacity: mix(from.opacity, to.opacity, ratio),
        scale: mix(from.scale, to.scale, ratio),
      };
    }
  }

  return {
    translateX: last.translateX,
    translateY: last.translateY,
    opacity: last.opacity,
    scale: last.scale,
  };
};

const easeInOutCubic = (value: number): number =>
  (value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2);

const resolveHeroRelativeScroll = (progress: number): number =>
  Math.round(progress * CHAPTER_SCROLL_RANGE);

describe("HeroScene", () => {
  it("uses mobile portrait asset for mobile viewport", () => {
    const { scene, frame, domTracker, snapshot, assetRegistry } = createScene();

    snapshot.updateViewport({
      width: 375,
      height: 812,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      isPortrait: true,
    });
    updateViewportPair(snapshot, domTracker, {
      width: 375,
      height: 812,
      scrollY: 0,
      isPortrait: true,
    });
    mountHeroAnchor(domTracker);

    scene.activate();
    tick(snapshot, 1);
    scene.update({
      frame: 1,
      timestamp: 16,
      delta: 0.016,
      elapsed: 0.016,
    });

    expect(assetRegistry.get(heroSceneConfig.portraitAssetId)?.src).toBe(
      heroSceneConfig.portraitAssetSources.mobile,
    );

    frame.stop();
    scene.deactivate();
    scene.dispose();
    domTracker.disconnect();
    frame.stop();
    document.body.innerHTML = "";
  });

  it("switches portrait source desktop to mobile when viewport shrinks", () => {
    const { scene, frame, domTracker, snapshot, assetRegistry } = createScene();

    snapshot.updateViewport({
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      isPortrait: false,
    });
    updateViewportPair(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollY: 0,
    });
    mountHeroAnchor(domTracker);

    scene.activate();
    tick(snapshot, 1);
    scene.update({
      frame: 1,
      timestamp: 16,
      delta: 0.016,
      elapsed: 0.016,
    });

    expect(assetRegistry.get(heroSceneConfig.portraitAssetId)?.src).toBe(
      heroSceneConfig.portraitAssetSources.desktop,
    );

    snapshot.updateViewport({
      width: 480,
      height: 812,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      isPortrait: true,
    });
    domTracker.updateViewport({
      width: 480,
      height: 812,
      scrollY: 0,
      scrollX: 0,
      devicePixelRatio: 1,
      isPortrait: true,
    });
    tick(snapshot, 2);

    scene.update({
      frame: 2,
      timestamp: 32,
      delta: 0.016,
      elapsed: 0.032,
    });

    expect(assetRegistry.get(heroSceneConfig.portraitAssetId)?.src).toBe(
      heroSceneConfig.portraitAssetSources.mobile,
    );
    expect(assetRegistry.count).toBe(1);

    frame.stop();
    scene.deactivate();
    scene.dispose();
    domTracker.disconnect();
    frame.stop();
    document.body.innerHTML = "";
  });

  it("switches a ready desktop portrait to mobile after the initial viewport arrives", async () => {
    const { scene, frame, domTracker, snapshot, assetRegistry } = createScene();
    const desktopSource = heroSceneConfig.portraitAssetSources.desktop;

    assetRegistry.unregister(heroSceneConfig.portraitAssetId);
    assetRegistry.register(
      {
        id: heroSceneConfig.portraitAssetId,
        src: desktopSource,
        kind: "image",
      },
      {
        src: desktopSource,
        naturalWidth: 1024,
        naturalHeight: 1536,
      } as HTMLImageElement,
    );
    assetRegistry.setState(heroSceneConfig.portraitAssetId, "ready");
    await scene.preload();

    updateViewportPair(snapshot, domTracker, {
      width: 390,
      height: 844,
      scrollY: 0,
      isPortrait: true,
    });
    mountHeroAnchor(domTracker);
    scene.activate();
    tick(snapshot, 1);
    scene.update({
      frame: 1,
      timestamp: 16,
      delta: 0.016,
      elapsed: 0.016,
    });

    expect(assetRegistry.get(heroSceneConfig.portraitAssetId)?.src).toBe(
      heroSceneConfig.portraitAssetSources.mobile,
    );
    expect(assetRegistry.count).toBe(1);

    frame.stop();
    scene.deactivate();
    scene.dispose();
    domTracker.disconnect();
    document.body.innerHTML = "";
  });

  it("tracks runtime state and reacts to frame ticks", () => {
    const { scene, frame, domTracker, snapshot, assetRegistry } = createScene();

    updateViewportPair(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollY: 0,
    });
    mountHeroAnchor(domTracker);

    snapshot.updatePointer({
      id: 1,
      x: 600,
      y: 500,
      prevX: 590,
      prevY: 490,
      dx: 10,
      dy: 10,
      velocityX: 0,
      velocityY: 0,
      isDown: false,
    });
    snapshot.updateScroll({
      scrollX: 0,
      scrollY: 0,
      velocity: 0,
      direction: 0,
      source: "native",
      timestamp: 0,
    });

    scene.activate();
    tick(snapshot, 1);
    scene.update({
      frame: 1,
      timestamp: 16,
      delta: 0.016,
      elapsed: 0.016,
    });

    expect(scene.sceneSnapshot.isActive).toBe(true);
    expect(scene.sceneSnapshot.isAnchored).toBe(true);
    expect(scene.sceneSnapshot.transform.opacity).toBeGreaterThan(0);
    expect(scene.sceneSnapshot.relativeScroll).toBe(0);
    expect(assetRegistry.get(heroSceneConfig.portraitAssetId)).not.toBeNull();
    expect(assetRegistry.get(heroSceneConfig.portraitAssetId)?.src).toBe(
      heroSceneConfig.portraitAssetSources.desktop,
    );

    frame.stop();
    scene.deactivate();
    scene.dispose();
    domTracker.disconnect();
    frame.stop();
    document.body.innerHTML = "";
  });

  it("outputs camera intent when active", () => {
    const { scene, frame, domTracker, snapshot } = createScene();

    updateViewportPair(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollY: 0,
    });
    mountHeroAnchor(domTracker);

    snapshot.setReducedMotion(true);
    scene.activate();
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
      x: 600,
      y: 400,
      prevX: 600,
      prevY: 400,
      dx: 0,
      dy: 0,
      velocityX: 0,
      velocityY: 0,
      isDown: false,
    });
    tick(snapshot, 1);

    scene.update({
      frame: 1,
      timestamp: 16,
      delta: 0.016,
      elapsed: 0.016,
    });

    const intent = scene.getCameraIntent();
    expect(intent).not.toBeNull();
    expect(intent?.fovIntent).toBe(heroSceneConfig.cameraIntent.fovIntent);
    expect(intent?.weight).toBe(heroSceneConfig.cameraIntent.weight);
    expect(intent?.depthBias).toBe(heroSceneConfig.cameraIntent.depthBias);
    expect(intent?.positionOffset).toEqual({
      x: heroSceneConfig.cameraIntent.positionOffset.x,
      y: heroSceneConfig.cameraIntent.positionOffset.y,
      z: heroSceneConfig.cameraIntent.positionOffset.z + heroSceneConfig.cameraIntent.depthBias,
    });

    frame.stop();
    scene.deactivate();
    scene.dispose();
    domTracker.disconnect();
    frame.stop();
    document.body.innerHTML = "";
  });

  it("computes chapter progress and phase from scroll/runtime inputs", () => {
    const { scene, frame, domTracker, snapshot } = createScene();

    updateViewportPair(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollY: 0,
    });
    domTracker.updateViewport({
      width: 1200,
      height: 800,
      scrollY: 0,
      scrollX: 0,
      devicePixelRatio: 1,
      isPortrait: false,
    });
    mountHeroAnchor(domTracker);

    scene.activate();
    tick(snapshot, 1);
    scene.update({
      frame: 1,
      timestamp: 16,
      delta: 0.016,
      elapsed: 0.016,
    });
    expect(scene.sceneSnapshot.chapterProgress).toBe(0);
    expect(scene.sceneSnapshot.phase).toBe("enter");

    snapshot.updateScroll({
      scrollX: 0,
      scrollY: 350,
      velocity: 0,
      direction: 0,
      source: "native",
      timestamp: 16,
    });
    updateViewportPair(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollY: 350,
    });
    tick(snapshot, 2);
    scene.update({
      frame: 2,
      timestamp: 32,
      delta: 0.016,
      elapsed: 0.032,
    });

    expect(scene.sceneSnapshot.phase).toBe("hold");
    expect(scene.sceneSnapshot.chapterProgress).toBeGreaterThan(CHAPTER_PROGRESS_CONFIG.phaseBoundaries.enterMax);
    expect(scene.sceneSnapshot.chapterProgress).toBeLessThan(CHAPTER_PROGRESS_CONFIG.phaseBoundaries.holdMax);

    snapshot.updateScroll({
      scrollX: 0,
      scrollY: 900,
      velocity: 0,
      direction: 0,
      source: "native",
      timestamp: 32,
    });
    updateViewportPair(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollY: 900,
    });
    tick(snapshot, 3);
    scene.update({
      frame: 3,
      timestamp: 48,
      delta: 0.016,
      elapsed: 0.048,
    });

    expect(scene.sceneSnapshot.phase).toBe("depart");

    frame.stop();
    scene.deactivate();
    scene.dispose();
    domTracker.disconnect();
    frame.stop();
    document.body.innerHTML = "";
  });

  it("uses reduced-motion fallback for chapter progress", () => {
    const { scene, frame, domTracker, snapshot } = createScene();

    snapshot.setReducedMotion(true);
    snapshot.updateViewport({
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      isPortrait: false,
    });
    domTracker.updateViewport({
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 1800,
      devicePixelRatio: 1,
      isPortrait: false,
    });
    domTracker.connect();
    mountHeroAnchor(domTracker);

    scene.activate();
    tick(snapshot, 1);
    scene.update({
      frame: 1,
      timestamp: 16,
      delta: 0.016,
      elapsed: 0.016,
    });

    expect(scene.sceneSnapshot.phase).toBe("hold");
    expect(scene.sceneSnapshot.chapterProgress).toBe(
      CHAPTER_PROGRESS_CONFIG.reducedMotionProgress,
    );

    frame.stop();
    scene.deactivate();
    scene.dispose();
    domTracker.disconnect();
    frame.stop();
    document.body.innerHTML = "";
  });

  it("maps hero layer motion for enter, hold, and depart", () => {
    const { scene, frame, domTracker, snapshot } = createScene();

    updateViewportPair(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollY: 0,
    });
    mountHeroAnchor(domTracker);

    snapshot.updatePointer({
      id: 1,
      x: 600,
      y: 400,
      prevX: 600,
      prevY: 400,
      dx: 0,
      dy: 0,
      velocityX: 0,
      velocityY: 0,
      isDown: false,
    });

    scene.activate();
    tick(snapshot, 1);
    snapshot.updateScroll({
      scrollX: 0,
      scrollY: 0,
      velocity: 0,
      direction: 0,
      source: "native",
      timestamp: 16,
    });
    scene.update({
      frame: 1,
      timestamp: 16,
      delta: 0.016,
      elapsed: 0.016,
    });

    const updateProgress = (progress: number): void => {
      snapshot.updateScroll({
        scrollX: 0,
        scrollY: resolveHeroRelativeScroll(progress),
        velocity: 0,
        direction: 0,
        source: "native",
        timestamp: Math.round(progress * 1000),
      });
      updateViewportPair(snapshot, domTracker, {
        width: 1200,
        height: 800,
        scrollY: resolveHeroRelativeScroll(progress),
      });
      const nextFrame = Math.round(progress * 1000);
      tick(snapshot, Math.max(1, nextFrame));
      scene.update({
        frame: Math.max(1, nextFrame),
        timestamp: Math.max(16, nextFrame),
        delta: 0.016,
        elapsed: Math.max(0.016, (nextFrame * 0.016) / 60),
      });
    };

    const expectPose = (progress: number): void => {
      updateProgress(progress);
      const target = resolveChapterPose(scene.sceneSnapshot.chapterProgress);
      expect(scene.sceneSnapshot.chapterProgress).toBeGreaterThanOrEqual(0);
      expect(scene.sceneSnapshot.transform.translateX).toBeCloseTo(target.translateX, 0);
      expect(scene.sceneSnapshot.transform.translateY).toBeCloseTo(target.translateY, 0);
      expect(scene.sceneSnapshot.transform.opacity).toBeCloseTo(target.opacity, 0);
      expect(scene.sceneSnapshot.transform.scale).toBeCloseTo(target.scale);
      expect(scene.sceneSnapshot.foregroundTransform.translateX).toBeCloseTo(
        target.translateX * HERO_MOTION_CONFIG.foreground.translateMultiplier,
        0,
      );
      expect(scene.sceneSnapshot.foregroundTransform.translateY).toBeCloseTo(
        target.translateY * HERO_MOTION_CONFIG.foreground.translateMultiplier,
        0,
      );
      expect(scene.sceneSnapshot.foregroundTransform.opacity).toBeCloseTo(target.opacity, 0);
    };

    expectPose(0.0);
    expectPose(CHAPTER_PROGRESS_CONFIG.phaseBoundaries.enterMax);
    expectPose(0.7);
    expectPose(CHAPTER_PROGRESS_CONFIG.phaseBoundaries.holdMax);

    frame.stop();
    scene.deactivate();
    scene.dispose();
    domTracker.disconnect();
    frame.stop();
    document.body.innerHTML = "";
  });

  it("maps hero depart key poses and hide by 0.90 as cache-safe opacity", () => {
    const { scene, frame, domTracker, snapshot } = createScene();

    updateViewportPair(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollY: 0,
    });
    mountHeroAnchor(domTracker);
    snapshot.updatePointer({
      id: 1,
      x: 600,
      y: 400,
      prevX: 600,
      prevY: 400,
      dx: 0,
      dy: 0,
      velocityX: 0,
      velocityY: 0,
      isDown: false,
    });

    scene.activate();
    scene.update({
      frame: 1,
      timestamp: 16,
      delta: 0.016,
      elapsed: 0.016,
    });

    const departKeyposes = [0.55, 0.65, 0.75, 0.85, 0.9, 1];

    for (const progress of departKeyposes) {
      snapshot.updateScroll({
        scrollX: 0,
        scrollY: resolveHeroRelativeScroll(progress),
        velocity: 0,
        direction: 0,
        source: "native",
        timestamp: Math.round(progress * 1000) + 1,
      });
      updateViewportPair(snapshot, domTracker, {
        width: 1200,
        height: 800,
        scrollY: resolveHeroRelativeScroll(progress),
      });
      tick(snapshot, Math.max(2, Math.round(progress * 1000) + 1));
      scene.update({
        frame: Math.max(2, Math.round(progress * 1000) + 1),
        timestamp: Math.max(17, Math.round(progress * 1000) + 16),
        delta: 0.016,
        elapsed: Math.max(0.032, Math.round(progress * 1000) * 0.016),
      });

      const target = resolveChapterPose(scene.sceneSnapshot.chapterProgress);
      expect(scene.sceneSnapshot.phase).toBe(
        scene.sceneSnapshot.chapterProgress <= CHAPTER_PROGRESS_CONFIG.phaseBoundaries.holdMax
          ? "hold"
          : "depart",
      );
      expect(Math.abs(scene.sceneSnapshot.transform.translateX - target.translateX)).toBeLessThanOrEqual(2);
      expect(Math.abs(scene.sceneSnapshot.transform.translateY - target.translateY)).toBeLessThanOrEqual(2);
      expect(scene.sceneSnapshot.transform.opacity).toBeCloseTo(target.opacity, 0);
      expect(scene.sceneSnapshot.transform.scale).toBeCloseTo(target.scale);
      expect(scene.sceneSnapshot.foregroundTransform.opacity).toBeCloseTo(target.opacity, 0);
    }

    expect(scene.sceneSnapshot.chapterProgress).toBe(1);
    expect(scene.sceneSnapshot.transform.opacity).toBeCloseTo(0, 6);
    expect(scene.sceneSnapshot.transform.scale).toBe(HERO_MOTION_CONFIG.scale.departEnd);
    expect(Math.abs(scene.sceneSnapshot.transform.translateX - HERO_MOTION_CONFIG.translation.depart.x)).toBeLessThanOrEqual(2);
    expect(scene.sceneSnapshot.transform.opacity).toBeLessThan(0.02);

    frame.stop();
    scene.deactivate();
    scene.dispose();
    domTracker.disconnect();
    frame.stop();
    document.body.innerHTML = "";
  });

  it("disables chapter motion when reduced motion is enabled", () => {
    const { scene, frame, domTracker, snapshot } = createScene();

    snapshot.setReducedMotion(true);
    updateViewportPair(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollY: 0,
    });
    mountHeroAnchor(domTracker);

    scene.activate();
    tick(snapshot, 1);
    scene.update({
      frame: 1,
      timestamp: 16,
      delta: 0.016,
      elapsed: 0.016,
    });

    expect(scene.sceneSnapshot.phase).toBe("hold");
    expect(scene.sceneSnapshot.chapterProgress).toBe(CHAPTER_PROGRESS_CONFIG.reducedMotionProgress);
    expect(scene.sceneSnapshot.transform.translateX).toBe(0);
    expect(scene.sceneSnapshot.transform.translateY).toBe(0);
    expect(scene.sceneSnapshot.transform.scale).toBe(1);
    expect(scene.sceneSnapshot.foregroundTransform.translateX).toBe(0);
    expect(scene.sceneSnapshot.foregroundTransform.translateY).toBe(0);
    expect(scene.sceneSnapshot.foregroundTransform.scale).toBe(1);

    frame.stop();
    scene.deactivate();
    scene.dispose();
    domTracker.disconnect();
    frame.stop();
    document.body.innerHTML = "";
  });
});
