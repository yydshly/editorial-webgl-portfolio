import { describe, expect, it, vi } from "vitest";

import MotionSnapshotStore from "@/lib/motion/MotionSnapshotStore";
import AssetRegistry from "@/lib/webgl/AssetRegistry";
import type DOMTracker from "@/lib/webgl/DOMTracker";
import GPUResourceManager from "@/lib/webgl/GPUResourceManager";
import type { SceneModule } from "@/lib/webgl/SceneModule";
import AboutScene from "@/lib/webgl/about/AboutScene";
import {
  ABOUT_PORTRAIT_ANCHOR_ID,
  ABOUT_PORTRAIT_TEXTURE_OWNER_ID,
  ABOUT_SCENE_ANCHOR_ID,
  ABOUT_SCENE_ID,
  aboutSceneConfig,
} from "@/lib/webgl/about/aboutSceneConfig";

const FRAME = {
  frame: 1,
  timestamp: 16,
  delta: 0.016,
  elapsed: 0.016,
} as const;

function createSnapshot(width = 1440, height = 900): MotionSnapshotStore {
  const snapshot = new MotionSnapshotStore();
  snapshot.updateViewport({
    width,
    height,
    scrollX: 0,
    scrollY: 0,
    devicePixelRatio: 1,
    isPortrait: width <= height,
  });
  return snapshot;
}

function createAnchor(
  relativeScroll = 0,
  height = 900,
  screenTop = 900 - relativeScroll,
) {
  return {
    width: 520,
    height,
    relativeScroll,
    worldCenter: {
      screen: { x: 300, y: 450 },
      point: { x: -0.8, y: 0, z: 0 },
    },
    worldTop: {
      screen: { x: 300, y: screenTop },
      point: { x: -0.8, y: 1, z: 0 },
    },
  };
}

function createAnchorAtProgress(progress: number) {
  const viewportHeight = 900;
  const anchorHeight = 900;
  return createAnchor(
    progress * (viewportHeight + anchorHeight),
    anchorHeight,
    viewportHeight - progress * (viewportHeight + anchorHeight),
  );
}

function getCameraIntent(scene: SceneModule<unknown>) {
  return scene.getCameraIntent?.() ?? null;
}

function createHarness(options?: {
  readonly width?: number;
  readonly height?: number;
  readonly anchor?: ReturnType<typeof createAnchor> | null;
  readonly reducedMotion?: boolean;
}) {
  let anchor = options?.anchor === undefined ? createAnchor() : options.anchor;
  const snapshot = createSnapshot(options?.width, options?.height);
  snapshot.setReducedMotion(options?.reducedMotion ?? false);
  const assetRegistry = new AssetRegistry<HTMLImageElement>();
  const gpuResourceManager = new GPUResourceManager();
  const loadAsset = vi.fn(async (src: string) => ({ src }) as HTMLImageElement);
  const domTracker = {
    getSnapshot: vi.fn(() => anchor),
  } as unknown as DOMTracker;
  const scene = new AboutScene({
    assetRegistry,
    domTracker,
    gpuResourceManager,
    snapshot,
    loadAsset,
  });

  return {
    assetRegistry,
    domTracker,
    gpuResourceManager,
    loadAsset,
    scene,
    snapshot,
    setAnchor(next: ReturnType<typeof createAnchor> | null) {
      anchor = next;
    },
  };
}

describe("AboutScene foundation", () => {
  it("implements the About SceneModule identity and preloads one development portrait lease", async () => {
    const { assetRegistry, gpuResourceManager, loadAsset, scene } = createHarness();
    const selectedAsset = aboutSceneConfig.portrait.assets.desktop;

    expect(scene.identity).toEqual({
      id: ABOUT_SCENE_ID,
      anchorId: ABOUT_SCENE_ANCHOR_ID,
      sceneType: "about",
      metadata: {
        assetStatus: "development",
        identity: "DEV-HOST-01",
        kind: "about",
      },
    });
    expect(assetRegistry.get(selectedAsset.id)?.src).toBe(selectedAsset.src);

    await scene.preload();
    await scene.preload();

    expect(loadAsset).toHaveBeenCalledTimes(1);
    expect(assetRegistry.getState(selectedAsset.id)).toBe("ready");
    expect(assetRegistry.getOwnerIds(selectedAsset.id)).toEqual([
      ABOUT_SCENE_ID,
    ]);
    expect(scene.getSnapshot().portrait.isAssetReady).toBe(true);
    expect(gpuResourceManager.snapshot.total).toBe(0);
  });

  it("switches responsive portrait without disturbing external CPU or non-texture GPU owners", async () => {
    const harness = createHarness({ width: 1440, height: 900 });
    const desktopAsset = aboutSceneConfig.portrait.assets.desktop;
    const mobileAsset = aboutSceneConfig.portrait.assets.mobile;
    await harness.scene.preload();
    harness.assetRegistry.acquire("external-preview", desktopAsset.id);
    harness.gpuResourceManager.acquireTexture(
      "about:texture:desktop",
      ABOUT_PORTRAIT_TEXTURE_OWNER_ID,
      () => ({}) as WebGLTexture,
    );
    harness.gpuResourceManager.acquireGeometry(
      "about:geometry",
      ABOUT_SCENE_ID,
      () => ({ dispose: vi.fn() }) as never,
    );
    harness.gpuResourceManager.acquireMaterial(
      "about:material",
      ABOUT_SCENE_ID,
      () => ({ dispose: vi.fn() }) as never,
    );

    harness.snapshot.updateViewport({
      width: 390,
      height: 844,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 2,
      isPortrait: true,
    });
    harness.scene.activate();
    harness.scene.update(FRAME);
    await harness.scene.preload();

    expect(harness.scene.getSnapshot().portrait.assetSource).toBe(
      aboutSceneConfig.portrait.assetSources.mobile,
    );
    expect(harness.scene.getSnapshot().portrait.assetId).toBe(mobileAsset.id);
    expect(harness.assetRegistry.get(desktopAsset.id)?.src).toBe(desktopAsset.src);
    expect(harness.assetRegistry.getData(desktopAsset.id)).not.toBeNull();
    expect(harness.assetRegistry.getOwnerIds(desktopAsset.id)).toEqual([
      "external-preview",
    ]);
    expect(harness.assetRegistry.get(mobileAsset.id)?.src).toBe(mobileAsset.src);
    expect(harness.assetRegistry.getOwnerIds(mobileAsset.id)).toEqual([
      ABOUT_SCENE_ID,
    ]);
    expect(harness.gpuResourceManager.snapshot.ownerCounts[
      "texture:about:texture:desktop"
    ]).toBe(0);
    expect(
      harness.gpuResourceManager.snapshot.ownerCounts["geometry:about:geometry"],
    ).toBe(1);
    expect(
      harness.gpuResourceManager.snapshot.ownerCounts["material:about:material"],
    ).toBe(1);
  });

  it("updates anchored progress and active stage only while active", async () => {
    const harness = createHarness({
      // The scene progress source is the section's current viewport top, not
      // DOMTracker.relativeScroll (which starts only after document-top exit).
      anchor: createAnchor(0, 900, -180),
    });
    await harness.scene.preload();
    expect(harness.scene.activate()).toBe(true);

    harness.scene.update(FRAME);

    const active = harness.scene.getSnapshot();
    expect(harness.scene.identity.anchorId).toBe(ABOUT_SCENE_ANCHOR_ID);
    expect(harness.domTracker.getSnapshot).toHaveBeenCalledWith(
      ABOUT_PORTRAIT_ANCHOR_ID,
    );
    expect(active.isActive).toBe(true);
    expect(active.isCached).toBe(false);
    expect(active.isAnchored).toBe(true);
    expect(active.chapterProgress).toBeCloseTo(0.6);
    expect(active.activeStageIndex).toBe(2);
    expect(active.activeStageId).toBe("onCamera");
    expect(active.anchorWorld).toEqual({ x: -0.8, y: 0, z: 0 });

    expect(harness.scene.deactivate()).toBe(true);
    harness.setAnchor(createAnchor(0.9 * (900 + 900), 900));
    harness.scene.update({ ...FRAME, frame: 2 });

    const cached = harness.scene.getSnapshot();
    expect(cached.isActive).toBe(false);
    expect(cached.isCached).toBe(true);
    expect(cached.chapterProgress).toBeCloseTo(0.6);
    expect(cached.activeStageId).toBe("onCamera");
  });

  it("safely degrades missing anchors and reduced motion to the stable origin stage", async () => {
    const missing = createHarness({ anchor: null });
    missing.scene.activate();
    missing.scene.update(FRAME);

    expect(missing.scene.getSnapshot()).toMatchObject({
      isAnchored: false,
      chapterProgress: 0,
      activeStageIndex: 0,
      activeStageId: "origin",
      stageProgress: 0,
      anchorViewport: null,
      anchorWorld: null,
    });

    const reduced = createHarness({
      anchor: createAnchor(1.7 * (900 + 900), 900),
      reducedMotion: true,
    });
    reduced.scene.activate();
    reduced.scene.update(FRAME);

    expect(reduced.scene.getSnapshot()).toMatchObject({
      isAnchored: true,
      chapterProgress: 0,
      activeStageIndex: 0,
      activeStageId: "origin",
      stageProgress: 0,
      reducedMotion: true,
    });
  });

  it("returns no camera intent while inactive, cached, or disposed", () => {
    const harness = createHarness();

    expect(getCameraIntent(harness.scene)).toBeNull();

    harness.scene.activate();
    harness.scene.update(FRAME);
    expect(getCameraIntent(harness.scene)).not.toBeNull();

    harness.scene.deactivate();
    expect(getCameraIntent(harness.scene)).toBeNull();

    harness.scene.dispose();
    expect(getCameraIntent(harness.scene)).toBeNull();
  });

  it.each([
    {
      stage: "origin",
      progress: 0.1,
      target: { x: -0.8, y: 0, z: 0 },
      positionOffset: { x: 0, y: 0, z: 0.35 },
    },
    {
      stage: "industry",
      progress: 0.3,
      target: { x: -0.79, y: -0.01, z: 0 },
      positionOffset: { x: -0.01, y: 0, z: 0.35 },
    },
    {
      stage: "onCamera",
      progress: 0.6,
      target: { x: -0.78, y: -0.01, z: 0 },
      positionOffset: { x: -0.02, y: 0.01, z: 0.35 },
    },
    {
      stage: "crossCultural",
      progress: 0.9,
      target: { x: -0.77, y: -0.02, z: 0 },
      positionOffset: { x: -0.03, y: 0.01, z: 0.35 },
    },
  ])(
    "derives the $stage camera intent from the portrait anchor with bounded offsets",
    ({ progress, target, positionOffset }) => {
      const harness = createHarness({
        anchor: createAnchorAtProgress(progress),
      });
      harness.scene.activate();
      harness.scene.update(FRAME);

      expect(getCameraIntent(harness.scene)).toEqual({
        target,
        positionOffset,
        fovIntent: 48,
        depthBias: -0.15,
        weight: 1,
      });
    },
  );

  it("resolves the same camera intent for equal forward and reverse progress", () => {
    const harness = createHarness({
      anchor: createAnchorAtProgress(0.6),
    });
    harness.scene.activate();
    harness.snapshot.updateScroll({
      scrollX: 0,
      scrollY: 100,
      velocity: 1,
      direction: 1,
      source: "native",
      timestamp: 16,
    });
    harness.scene.update(FRAME);
    const forward = getCameraIntent(harness.scene);

    harness.snapshot.updateScroll({
      scrollX: 0,
      scrollY: 90,
      velocity: -1,
      direction: -1,
      source: "native",
      timestamp: 32,
    });
    harness.scene.update({ ...FRAME, frame: 2, timestamp: 32 });

    expect(getCameraIntent(harness.scene)).toEqual(forward);
  });

  it("lands on the final coherent camera intent in one fast jump", () => {
    const harness = createHarness({
      anchor: createAnchorAtProgress(0.1),
    });
    harness.scene.activate();
    harness.scene.update(FRAME);
    expect(harness.scene.getSnapshot().activeStageId).toBe("origin");

    harness.setAnchor(createAnchorAtProgress(0.9));
    harness.scene.update({ ...FRAME, frame: 2, timestamp: 32 });

    expect(harness.scene.getSnapshot().activeStageId).toBe("crossCultural");
    expect(getCameraIntent(harness.scene)).toEqual({
      target: { x: -0.77, y: -0.02, z: 0 },
      positionOffset: { x: -0.03, y: 0.01, z: 0.35 },
      fovIntent: 48,
      depthBias: -0.15,
      weight: 1,
    });
  });

  it("holds the origin camera intent under reduced motion", () => {
    const harness = createHarness({
      anchor: createAnchorAtProgress(0.9),
      reducedMotion: true,
    });
    harness.scene.activate();
    harness.scene.update(FRAME);

    expect(getCameraIntent(harness.scene)).toEqual({
      target: { x: -0.8, y: 0, z: 0 },
      positionOffset: { x: 0, y: 0, z: 0.35 },
      fovIntent: 48,
      depthBias: -0.15,
      weight: 1,
    });
  });

  it("disposes CPU and future GPU owners idempotently", async () => {
    const harness = createHarness();
    const selectedAsset = aboutSceneConfig.portrait.assets.desktop;
    await harness.scene.preload();
    harness.gpuResourceManager.acquireGeometry(
      "about:geometry",
      ABOUT_SCENE_ID,
      () => ({ dispose: vi.fn() }) as never,
    );

    harness.scene.dispose();
    harness.scene.dispose();

    expect(harness.scene.getSnapshot()).toMatchObject({
      isActive: false,
      isCached: false,
      isDisposed: true,
    });
    expect(harness.assetRegistry.getOwnerIds(selectedAsset.id)).toEqual([]);
    expect(
      harness.gpuResourceManager.snapshot.ownerCounts["geometry:about:geometry"],
    ).toBe(0);
    expect(harness.scene.activate()).toBe(false);
  });
});
