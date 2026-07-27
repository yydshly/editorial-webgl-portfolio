import { describe, expect, it } from "vitest";

import CameraRig from "@/lib/webgl/CameraRig";
import DOMTracker from "@/lib/webgl/DOMTracker";
import FrameCoordinator from "@/lib/motion/FrameCoordinator";
import MotionBus from "@/lib/motion/MotionBus";
import MotionSnapshotStore from "@/lib/motion/MotionSnapshotStore";
import AssetRegistry from "@/lib/webgl/AssetRegistry";
import MediaScene from "@/lib/webgl/media/MediaScene";
import SceneDirector from "@/lib/webgl/SceneDirector";
import SceneRegistry from "@/lib/webgl/SceneRegistry";
import RenderScheduler from "@/lib/webgl/RenderScheduler";
import { MEDIA_PROGRESS_CONFIG } from "@/lib/webgl/media/MediaSceneProgress";
import {
  mediaSceneConfig,
  MEDIA_SCENE_ANCHOR_ID,
  MEDIA_SCENE_ID,
} from "@/lib/webgl/media/mediaSceneConfig";

const createTestSnapshot = (options: {
  readonly width: number;
  readonly height: number;
  readonly isPortrait: boolean;
}): MotionSnapshotStore => {
  const snapshot = new MotionSnapshotStore();
  snapshot.updateViewport({
    width: options.width,
    height: options.height,
    scrollX: 0,
    scrollY: 0,
    devicePixelRatio: 1,
    isPortrait: options.isPortrait,
  });

  return snapshot;
};

const updateViewport = (
  snapshot: MotionSnapshotStore,
  domTracker: DOMTracker,
  options: {
    readonly width: number;
    readonly height: number;
    readonly scrollY: number;
    readonly isPortrait?: boolean;
  },
): void => {
  Object.defineProperty(window, "scrollY", {
    configurable: true,
    writable: true,
    value: options.scrollY,
  });
  Object.defineProperty(window, "pageYOffset", {
    configurable: true,
    writable: true,
    value: options.scrollY,
  });
  snapshot.updateViewport({
    width: options.width,
    height: options.height,
    scrollX: 0,
    scrollY: options.scrollY,
    devicePixelRatio: 1,
    isPortrait: options.isPortrait ?? false,
  });
  domTracker.updateViewport({
    width: options.width,
    height: options.height,
    scrollY: options.scrollY,
    scrollX: 0,
    devicePixelRatio: 1,
    isPortrait: options.isPortrait ?? false,
  });
  domTracker.refreshFromDirty();
};

const mountMediaAnchor = (domTracker: DOMTracker): void => {
  const anchor = document.createElement("div");
  anchor.id = MEDIA_SCENE_ANCHOR_ID;
  anchor.style.width = "360px";
  anchor.style.height = "220px";
  anchor.getBoundingClientRect = () =>
    ({
      x: 0,
      y: -window.scrollY,
      top: -window.scrollY,
      left: 0,
      width: 360,
      height: 220,
      right: 360,
      bottom: 220 - window.scrollY,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(anchor);
  domTracker.register({
    id: MEDIA_SCENE_ANCHOR_ID,
    element: anchor,
    sceneType: "media",
  });
  domTracker.connect();
  domTracker.refreshFromDirty();
};

const seedAssets = (
  assetRegistry: AssetRegistry<HTMLImageElement>,
  viewportWidth: number,
): void => {
  const mainSrc = mediaSceneConfig.main.selectAssetSource(viewportWidth);
  const secondarySrc = mediaSceneConfig.secondary.selectAssetSource(viewportWidth);

  assetRegistry.register(
    {
      id: mediaSceneConfig.main.assetId,
      src: mainSrc,
      kind: "image",
    },
    { src: mainSrc } as HTMLImageElement,
  );
  assetRegistry.register(
    {
      id: mediaSceneConfig.secondary.assetId,
      src: secondarySrc,
      kind: "image",
    },
    { src: secondarySrc } as HTMLImageElement,
  );
  assetRegistry.setState(mediaSceneConfig.main.assetId, "ready");
  assetRegistry.setState(mediaSceneConfig.secondary.assetId, "ready");
};

describe("MediaScene", () => {
  it("registers both assets and tracks lifecycle states", async () => {
    const snapshot = createTestSnapshot({ width: 1200, height: 800, isPortrait: false });
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const assetRegistry = new AssetRegistry<HTMLImageElement>();
    const domTracker = new DOMTracker(frame, bus, new CameraRig());
    seedAssets(assetRegistry, snapshot.viewport.width);

    mountMediaAnchor(domTracker);

  const scene = new MediaScene({
      assetRegistry,
      domTracker,
      snapshot,
    });

    expect(scene.getSnapshot().isActive).toBe(false);
    expect(scene.getSnapshot().isCached).toBe(true);
    expect(assetRegistry.get(mediaSceneConfig.main.assetId)).not.toBeNull();
    expect(assetRegistry.get(mediaSceneConfig.secondary.assetId)).not.toBeNull();

    scene.activate();
    await scene.preload();
    scene.update({
      frame: 1,
      timestamp: 16,
      delta: 0.016,
      elapsed: 0.016,
    });

    expect(scene.getSnapshot().isActive).toBe(true);
    expect(scene.getSnapshot().isCached).toBe(false);
    expect(scene.getSnapshot().main.isAssetReady).toBe(true);
    expect(scene.getSnapshot().secondary.isAssetReady).toBe(true);
    expect(assetRegistry.getOwnerIds(mediaSceneConfig.main.assetId).length).toBe(1);
    expect(assetRegistry.getOwnerIds(mediaSceneConfig.secondary.assetId).length).toBe(1);

    scene.deactivate();
    expect(scene.getSnapshot().isActive).toBe(false);
    expect(scene.getSnapshot().isCached).toBe(true);

    scene.dispose();
    expect(scene.getSnapshot().isDisposed).toBe(true);
    expect(assetRegistry.getOwnerIds(mediaSceneConfig.main.assetId).length).toBe(0);
    expect(assetRegistry.getOwnerIds(mediaSceneConfig.secondary.assetId).length).toBe(0);

    frame.stop();
    domTracker.disconnect();
    document.body.innerHTML = "";
  });

  it("keeps layer source in snapshot after registration", async () => {
    const snapshot = createTestSnapshot({ width: 390, height: 844, isPortrait: true });
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const assetRegistry = new AssetRegistry<HTMLImageElement>();
    const domTracker = new DOMTracker(frame, bus, new CameraRig());
    seedAssets(assetRegistry, snapshot.viewport.width);

    mountMediaAnchor(domTracker);

    const scene = new MediaScene({
      assetRegistry,
      domTracker,
      snapshot,
    });

    scene.activate();
    await scene.preload();
    scene.update({
      frame: 1,
      timestamp: 16,
      delta: 0.016,
      elapsed: 0.016,
    });

    expect(scene.getSnapshot().main.assetSource).toBe(mediaSceneConfig.main.assetSources.mobile);
    expect(scene.getSnapshot().secondary.assetSource).toBe(mediaSceneConfig.secondary.assetSources.mobile);

    scene.dispose();
    frame.stop();
    domTracker.disconnect();
    document.body.innerHTML = "";
  });

  it("exposes mediaProgress and phase in scene snapshot", async () => {
    const snapshot = createTestSnapshot({ width: 1200, height: 800, isPortrait: false });
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const assetRegistry = new AssetRegistry<HTMLImageElement>();
    const domTracker = new DOMTracker(frame, bus, new CameraRig());
    seedAssets(assetRegistry, snapshot.viewport.width);

    mountMediaAnchor(domTracker);

    const scene = new MediaScene({
      assetRegistry,
      domTracker,
      snapshot,
    });

    scene.activate();
    await scene.preload();
    scene.update({
      frame: 1,
      timestamp: 16,
      delta: 0.016,
      elapsed: 0.016,
    });

    expect(scene.getSnapshot().mediaProgress).toBe(0);
    expect(scene.getSnapshot().phase).toBe("enter");

    scene.dispose();
    frame.stop();
    domTracker.disconnect();
    document.body.innerHTML = "";
  });

  it("derives media progress from DOM while media scene is cached/inactive", async () => {
    const snapshot = createTestSnapshot({ width: 1200, height: 800, isPortrait: false });
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const assetRegistry = new AssetRegistry<HTMLImageElement>();
    const domTracker = new DOMTracker(frame, bus, new CameraRig());
    seedAssets(assetRegistry, snapshot.viewport.width);

    mountMediaAnchor(domTracker);

    const scene = new MediaScene({
      assetRegistry,
      domTracker,
      snapshot,
    });

    updateViewport(snapshot, domTracker, { width: 1200, height: 800, scrollY: 0 });
    scene.activate();
    await scene.preload();
    scene.update({
      frame: 1,
      timestamp: 16,
      delta: 0.016,
      elapsed: 0.016,
    });

    scene.deactivate();
    updateViewport(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollY: 300,
      isPortrait: false,
    });

    const cachedSceneSnapshot = scene.getSnapshot();

    expect(cachedSceneSnapshot.isActive).toBe(false);
    expect(cachedSceneSnapshot.isCached).toBe(true);
    expect(cachedSceneSnapshot.isAnchored).toBe(true);
    expect(cachedSceneSnapshot.mediaProgress).toBeGreaterThan(0.1);
    expect(cachedSceneSnapshot.mediaProgress).toBeLessThanOrEqual(1);

    scene.dispose();
    frame.stop();
    domTracker.disconnect();
    document.body.innerHTML = "";
  });

  it("uses reduced motion hold state for media progress contract", async () => {
    const snapshot = createTestSnapshot({ width: 1200, height: 800, isPortrait: false });
    snapshot.setReducedMotion(true);
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const assetRegistry = new AssetRegistry<HTMLImageElement>();
    const domTracker = new DOMTracker(frame, bus, new CameraRig());
    seedAssets(assetRegistry, snapshot.viewport.width);

    mountMediaAnchor(domTracker);

    const scene = new MediaScene({
      assetRegistry,
      domTracker,
      snapshot,
    });

    scene.activate();
    await scene.preload();
    scene.update({
      frame: 1,
      timestamp: 16,
      delta: 0.016,
      elapsed: 0.016,
    });

    expect(scene.getSnapshot().phase).toBe("hold");
    expect(scene.getSnapshot().mediaProgress).toBe(MEDIA_PROGRESS_CONFIG.reducedMotionProgress);

    scene.dispose();
    frame.stop();
    domTracker.disconnect();
    document.body.innerHTML = "";
  });

  it("exports camera intent for media progress phases", async () => {
    const snapshot = createTestSnapshot({ width: 1200, height: 800, isPortrait: false });
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const assetRegistry = new AssetRegistry<HTMLImageElement>();
    const domTracker = new DOMTracker(frame, bus, new CameraRig());
    seedAssets(assetRegistry, snapshot.viewport.width);

    mountMediaAnchor(domTracker);
    updateViewport(snapshot, domTracker, { width: 1200, height: 800, scrollY: 0, isPortrait: false });

    const scene = new MediaScene({
      assetRegistry,
      domTracker,
      snapshot,
    });

    scene.activate();
    await scene.preload();

    const payload = { frame: 1, timestamp: 16, delta: 0.016, elapsed: 0.016 };
    scene.update(payload);

    const anchorBaseline = domTracker.getSnapshot(MEDIA_SCENE_ANCHOR_ID);
    const anchorScrollBase =
      (anchorBaseline?.top ?? 0) + (anchorBaseline?.scrollY ?? 0);
    const mediaProgressSpan = Math.max(1, (anchorBaseline?.height ?? 220) * 0.5);

    const enterAnchor = domTracker.getSnapshot(MEDIA_SCENE_ANCHOR_ID);
    const enterIntent = scene.getCameraIntent();
    expect(enterIntent).not.toBeNull();
    expect(enterIntent?.fovIntent).toBe(mediaSceneConfig.cameraIntent.enter.fovIntent);
    expect(enterIntent?.weight).toBe(mediaSceneConfig.cameraIntent.weight);
    expect(enterIntent?.depthBias).toBe(mediaSceneConfig.cameraIntent.depthBias);
    expect(enterIntent?.target).toEqual({
      x: (enterAnchor?.worldCenter.point.x ?? 0) + mediaSceneConfig.cameraIntent.enter.targetOffset.x,
      y: (enterAnchor?.worldCenter.point.y ?? 0) + mediaSceneConfig.cameraIntent.enter.targetOffset.y,
      z: (enterAnchor?.worldCenter.point.z ?? 0) + mediaSceneConfig.cameraIntent.enter.targetOffset.z,
    });

    updateViewport(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollY: Math.round(anchorScrollBase + mediaProgressSpan * 0.4),
      isPortrait: false,
    });
    scene.update({
      frame: 2,
      timestamp: 32,
      delta: 0.016,
      elapsed: 0.032,
    });

    const holdAnchor = domTracker.getSnapshot(MEDIA_SCENE_ANCHOR_ID);
    const holdIntent = scene.getCameraIntent();
    expect(holdIntent).not.toBeNull();
    expect(holdIntent?.fovIntent).toBe(mediaSceneConfig.cameraIntent.hold.fovIntent);
    expect(holdIntent?.positionOffset).toEqual(mediaSceneConfig.cameraIntent.hold.positionOffset);
    expect(holdIntent?.target).toEqual({
      x: (holdAnchor?.worldCenter.point.x ?? 0) + mediaSceneConfig.cameraIntent.hold.targetOffset.x,
      y: (holdAnchor?.worldCenter.point.y ?? 0) + mediaSceneConfig.cameraIntent.hold.targetOffset.y,
      z: (holdAnchor?.worldCenter.point.z ?? 0) + mediaSceneConfig.cameraIntent.hold.targetOffset.z,
    });

    updateViewport(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollY: Math.round(anchorScrollBase + mediaProgressSpan * 0.9),
      isPortrait: false,
    });
    scene.update({
      frame: 3,
      timestamp: 48,
      delta: 0.016,
      elapsed: 0.048,
    });

    const departAnchor = domTracker.getSnapshot(MEDIA_SCENE_ANCHOR_ID);
    const departIntent = scene.getCameraIntent();
    expect(departIntent).not.toBeNull();
    expect(departIntent?.fovIntent).toBe(mediaSceneConfig.cameraIntent.depart.fovIntent);
    expect(departIntent?.positionOffset).toEqual(mediaSceneConfig.cameraIntent.depart.positionOffset);
    expect(departIntent?.target).toEqual({
      x: (departAnchor?.worldCenter.point.x ?? 0) + mediaSceneConfig.cameraIntent.depart.targetOffset.x,
      y: (departAnchor?.worldCenter.point.y ?? 0) + mediaSceneConfig.cameraIntent.depart.targetOffset.y,
      z: (departAnchor?.worldCenter.point.z ?? 0) + mediaSceneConfig.cameraIntent.depart.targetOffset.z,
    });

    scene.dispose();
    frame.stop();
    domTracker.disconnect();
    document.body.innerHTML = "";
  });

  it("SceneDirector reads media camera intent from updated media scene", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = createTestSnapshot({ width: 1200, height: 800, isPortrait: false });
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const director = new SceneDirector({ registry, scheduler, snapshot });

    const assetRegistry = new AssetRegistry<HTMLImageElement>();
    const domTracker = new DOMTracker(frame, bus, new CameraRig());
    seedAssets(assetRegistry, snapshot.viewport.width);
    mountMediaAnchor(domTracker);

    updateViewport(snapshot, domTracker, { width: 1200, height: 800, scrollY: 0, isPortrait: false });

    const scene = new MediaScene({ assetRegistry, domTracker, snapshot });
    director.register(scene);
    await director.preload(MEDIA_SCENE_ID);

    expect(director.activate(MEDIA_SCENE_ID)).toBe(true);

    scene.update({
      frame: 1,
      timestamp: 16,
      delta: 0.016,
      elapsed: 0.016,
    });

    const anchor = domTracker.getSnapshot(MEDIA_SCENE_ANCHOR_ID);
    const resolvedIntent = director.getCameraIntent();
    expect(resolvedIntent).not.toBeNull();
    expect(resolvedIntent?.sceneId).toBe(MEDIA_SCENE_ID);
    expect(resolvedIntent?.intent).toEqual({
      target: {
        x: (anchor?.worldCenter.point.x ?? 0) + mediaSceneConfig.cameraIntent.enter.targetOffset.x,
        y: (anchor?.worldCenter.point.y ?? 0) + mediaSceneConfig.cameraIntent.enter.targetOffset.y,
        z: (anchor?.worldCenter.point.z ?? 0) + mediaSceneConfig.cameraIntent.enter.targetOffset.z,
      },
      positionOffset: {
        ...mediaSceneConfig.cameraIntent.enter.positionOffset,
      },
      fovIntent: mediaSceneConfig.cameraIntent.enter.fovIntent,
      depthBias: mediaSceneConfig.cameraIntent.depthBias,
      weight: mediaSceneConfig.cameraIntent.weight,
    });

    director.dispose(MEDIA_SCENE_ID);
    frame.stop();
    domTracker.disconnect();
    document.body.innerHTML = "";
  });
});
