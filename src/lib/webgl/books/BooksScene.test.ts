import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import MotionSnapshotStore from "@/lib/motion/MotionSnapshotStore";
import AssetRegistry from "@/lib/webgl/AssetRegistry";
import type DOMTracker from "@/lib/webgl/DOMTracker";
import GPUResourceManager from "@/lib/webgl/GPUResourceManager";
import type { SceneModule } from "@/lib/webgl/SceneModule";
import BooksScene from "@/lib/webgl/books/BooksScene";
import { resolveBooksCoverMotion } from "@/lib/webgl/books/BooksSceneMotion";
import { booksAssetManifest } from "@/lib/webgl/books/booksAssetManifest";

const FRAME = {
  frame: 1,
  timestamp: 16,
  delta: 0.016,
  elapsed: 0.016,
} as const;

type AnchorSnapshot = {
  readonly width: number;
  readonly height: number;
  readonly worldCenter: {
    readonly screen: { readonly x: number; readonly y: number };
    readonly point: { readonly x: number; readonly y: number; readonly z: number };
  };
  readonly worldTop: {
    readonly screen: { readonly x: number; readonly y: number };
    readonly point: { readonly x: number; readonly y: number; readonly z: number };
  };
};

function createSnapshot(width = 1440, height = 900): MotionSnapshotStore {
  const snapshot = new MotionSnapshotStore();
  snapshot.updateViewport({
    width,
    height,
    scrollX: 0,
    scrollY: 0,
    devicePixelRatio: width <= 768 ? 2 : 1,
    isPortrait: width <= height,
  });
  return snapshot;
}

function createSectionAnchor(progress = 0.5): AnchorSnapshot {
  const viewportHeight = 900;
  const height = 900;
  const top = viewportHeight - progress * (viewportHeight + height);
  return {
    width: 1440,
    height,
    worldCenter: {
      screen: { x: 720, y: top + height / 2 },
      point: { x: 0, y: 0, z: -8 },
    },
    worldTop: {
      screen: { x: 720, y: top },
      point: { x: 0, y: 1, z: -8 },
    },
  };
}

function createStageAnchor(width = 620, height = 610): AnchorSnapshot {
  return {
    width,
    height,
    worldCenter: {
      screen: { x: 1040, y: 450 },
      point: { x: 2.4, y: 0, z: -8 },
    },
    worldTop: {
      screen: { x: 1040, y: 145 },
      point: { x: 2.4, y: 2.2, z: -8 },
    },
  };
}

function createHarness(options?: {
  readonly width?: number;
  readonly height?: number;
  readonly sectionAnchor?: AnchorSnapshot | null;
  readonly stageAnchor?: AnchorSnapshot | null;
  readonly reducedMotion?: boolean;
}) {
  let sectionAnchor =
    options?.sectionAnchor === undefined
      ? createSectionAnchor()
      : options.sectionAnchor;
  let stageAnchor =
    options?.stageAnchor === undefined ? createStageAnchor() : options.stageAnchor;
  const snapshot = createSnapshot(options?.width, options?.height);
  snapshot.setReducedMotion(options?.reducedMotion ?? false);
  const assetRegistry = new AssetRegistry<HTMLImageElement>();
  const gpuResourceManager = new GPUResourceManager();
  const loadAsset = vi.fn(
    async (src: string) =>
      ({
        src,
        naturalWidth: src.includes("-mobile.") ? 800 : 1000,
        naturalHeight: src.includes("-mobile.") ? 1200 : 1500,
      }) as HTMLImageElement,
  );
  const domTracker = {
    getSnapshot: vi.fn((id: string) => {
      if (id === "books") {
        return sectionAnchor;
      }
      if (id === "books-cover-stage") {
        return stageAnchor;
      }
      return null;
    }),
  } as unknown as DOMTracker;
  const scene = new BooksScene({
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
    setSectionAnchor(next: AnchorSnapshot | null) {
      sectionAnchor = next;
    },
    setStageAnchor(next: AnchorSnapshot | null) {
      stageAnchor = next;
    },
  };
}

function expectedVariant(
  cover: (typeof booksAssetManifest.covers)[number],
  viewport: "desktop" | "mobile",
) {
  return cover[viewport];
}

function getCameraIntent(scene: SceneModule<unknown>) {
  return scene.getCameraIntent?.() ?? null;
}

describe("BooksScene foundation", () => {
  it("implements the exact Books SceneModule identity and maps all three roles to desktop descriptors", () => {
    const { assetRegistry, scene } = createHarness();

    expect(scene.identity).toEqual({
      id: "books-scene",
      anchorId: "books",
      sceneType: "books",
      metadata: {
        author: "DEV-HOST-01",
        series: "FIELD NOTES",
        assetStatus: "development",
      },
    });
    expect(scene.getSnapshot().covers.map((cover) => cover.role)).toEqual([
      "primary",
      "secondary-left",
      "secondary-right",
    ]);
    expect(scene.getSnapshot().covers.map((cover) => cover.assetSource)).toEqual(
      booksAssetManifest.covers.map((cover) => cover.desktop.path),
    );
    expect(assetRegistry.count).toBe(3);
    expect(getCameraIntent(scene)).toBeNull();
  });

  it("deduplicates one preload task and acquires exactly one CPU owner for each cover", async () => {
    const { assetRegistry, loadAsset, scene } = createHarness();

    const first = scene.preload();
    const second = scene.preload();

    expect(first).toBe(second);
    await first;
    await scene.preload();

    expect(loadAsset).toHaveBeenCalledTimes(3);
    expect(assetRegistry.snapshot.ownerCounts).toEqual(
      Object.fromEntries(
        scene.getSnapshot().covers.map((cover) => [cover.assetId, 1]),
      ),
    );
    for (const cover of scene.getSnapshot().covers) {
      expect(assetRegistry.getOwnerIds(cover.assetId)).toEqual(["books-scene"]);
      expect(cover.isAssetReady).toBe(true);
    }
  });

  it("releases desktop CPU owners and loads one mobile variant per book after a responsive switch", async () => {
    const { assetRegistry, loadAsset, scene, snapshot } = createHarness();
    await scene.preload();
    const desktop = scene.getSnapshot().covers;

    snapshot.updateViewport({
      width: 390,
      height: 844,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 2,
      isPortrait: true,
    });
    await scene.preload();

    expect(scene.getSnapshot().covers.map((cover) => cover.assetSource)).toEqual(
      booksAssetManifest.covers.map((cover) => cover.mobile.path),
    );
    expect(loadAsset).toHaveBeenCalledTimes(6);
    desktop.forEach((cover) => {
      expect(assetRegistry.getOwnerIds(cover.assetId)).toEqual([]);
    });
    scene.getSnapshot().covers.forEach((cover, index) => {
      expect(cover.assetSource).toBe(
        expectedVariant(booksAssetManifest.covers[index], "mobile").path,
      );
      expect(assetRegistry.getOwnerIds(cover.assetId)).toEqual(["books-scene"]);
    });
  });

  it("activates and updates progress, anchors, and deterministic three-cover motion from snapshots only", async () => {
    const { domTracker, scene } = createHarness();
    const boundingClientRect = vi.spyOn(
      Element.prototype,
      "getBoundingClientRect",
    );
    await scene.preload();

    expect(scene.activate()).toBe(true);
    scene.update(FRAME);

    const state = scene.getSnapshot();
    expect(state.progress).toBeCloseTo(0.5);
    expect(state.motion).toEqual(
      resolveBooksCoverMotion({
        progress: 0.5,
        reducedMotion: false,
        viewportWidth: 1440,
      }),
    );
    expect(state.isAnchored).toBe(true);
    expect(state.anchorWidth).toBe(620);
    expect(state.anchorHeight).toBe(610);
    expect(state.anchorViewport).toEqual({ x: 1040, y: 450 });
    expect(state.anchorWorld).toEqual({ x: 2.4, y: 0, z: -8 });
    expect(domTracker.getSnapshot).toHaveBeenCalledWith("books");
    expect(domTracker.getSnapshot).toHaveBeenCalledWith("books-cover-stage");
    expect(boundingClientRect).not.toHaveBeenCalled();
    boundingClientRect.mockRestore();
  });

  it("exposes a stable CameraIntent only while Books is active, anchored, and visual-ready", async () => {
    const { scene } = createHarness();
    await scene.preload();

    scene.setVisualReady(true);
    expect(getCameraIntent(scene)).toBeNull();

    scene.activate();
    expect(getCameraIntent(scene)).toBeNull();

    scene.update(FRAME);
    scene.setVisualReady(false);
    expect(getCameraIntent(scene)).toBeNull();

    scene.setVisualReady(true);
    expect(getCameraIntent(scene)).toEqual({
      target: { x: 2.4, y: 0, z: -8 },
      positionOffset: { x: 0, y: 0, z: 0.35 },
      fovIntent: 48,
      depthBias: -0.15,
      weight: 1,
    });

    scene.deactivate();
    expect(getCameraIntent(scene)).toBeNull();

    scene.dispose();
    expect(getCameraIntent(scene)).toBeNull();
  });

  it("keeps CameraIntent history-independent across progress, fast jumps, and reverse updates", async () => {
    const { scene, setSectionAnchor } = createHarness();
    await scene.preload();
    scene.activate();
    scene.setVisualReady(true);

    const intents = [0, 0.5, 1, 0.5].map((progress, index) => {
      setSectionAnchor(createSectionAnchor(progress));
      scene.update({
        ...FRAME,
        frame: index + 1,
        timestamp: (index + 1) * 16,
      });
      return getCameraIntent(scene);
    });

    expect(intents.every((intent) => intent !== null)).toBe(true);
    expect(intents[1]).toEqual(intents[3]);
    expect(intents[0]).toEqual(intents[1]);
    expect(intents[1]).toEqual(intents[2]);
    expect(intents[0]).not.toBe(intents[1]);
    expect(intents[0]?.target).not.toBe(intents[1]?.target);
    expect(intents[0]?.positionOffset).not.toBe(
      intents[1]?.positionOffset,
    );
  });

  it("uses the same fixed hold CameraIntent for reduced motion without owning a Camera", async () => {
    const { scene } = createHarness({
      width: 390,
      height: 844,
      reducedMotion: true,
      stageAnchor: createStageAnchor(300, 420),
    });
    await scene.preload();
    scene.activate();
    scene.update(FRAME);
    scene.setVisualReady(true);

    expect(getCameraIntent(scene)).toEqual({
      target: { x: 2.4, y: 0, z: -8 },
      positionOffset: { x: 0, y: 0, z: 0.35 },
      fovIntent: 48,
      depthBias: -0.15,
      weight: 1,
    });
    expect("camera" in scene).toBe(false);
  });

  it("caches on deactivate, preserves leases, and stops visible updates", async () => {
    const { assetRegistry, scene, setSectionAnchor } = createHarness();
    await scene.preload();
    scene.activate();
    scene.update(FRAME);
    const active = scene.getSnapshot();

    expect(scene.deactivate()).toBe(true);
    setSectionAnchor(createSectionAnchor(0.95));
    scene.update({ ...FRAME, frame: 2, timestamp: 32 });

    const cached = scene.getSnapshot();
    expect(cached).toMatchObject({
      isActive: false,
      isCached: true,
      isDisposed: false,
      progress: active.progress,
    });
    cached.covers.forEach((cover) => {
      expect(assetRegistry.getOwnerIds(cover.assetId)).toEqual(["books-scene"]);
    });
  });

  it("updates visual readiness without mutating the cover tuple", async () => {
    const { scene } = createHarness();
    await scene.preload();
    const covers = scene.getSnapshot().covers;

    scene.setVisualReady(true);

    expect(scene.getSnapshot().visualReady).toBe(true);
    expect(scene.getSnapshot().covers).toEqual(covers);
  });

  it("degrades safely when either Books anchor is missing", async () => {
    const { scene, setSectionAnchor, setStageAnchor } = createHarness();
    await scene.preload();
    scene.activate();

    setStageAnchor(null);
    scene.update(FRAME);
    expect(scene.getSnapshot()).toMatchObject({
      isAnchored: false,
      anchorWidth: 0,
      anchorHeight: 0,
      anchorViewport: null,
      anchorWorld: null,
    });

    setSectionAnchor(null);
    scene.update({ ...FRAME, frame: 2, timestamp: 32 });
    expect(scene.getSnapshot().progress).toBe(0);
    expect(scene.getSnapshot().isAnchored).toBe(false);
  });

  it("uses one stable hold composition under reduced motion", async () => {
    const { scene } = createHarness({ reducedMotion: true });
    await scene.preload();
    scene.activate();
    scene.update(FRAME);

    const state = scene.getSnapshot();
    expect(state.reducedMotion).toBe(true);
    expect(state.progress).toBe(0.51);
    expect(state.motion).toEqual(
      resolveBooksCoverMotion({
        progress: state.progress,
        reducedMotion: true,
        viewportWidth: 1440,
      }),
    );
  });

  it("resolves fast forward and reverse jumps without history-dependent poses", async () => {
    const { scene, setSectionAnchor } = createHarness();
    await scene.preload();
    scene.activate();

    setSectionAnchor(createSectionAnchor(0.1));
    scene.update(FRAME);
    const enter = scene.getSnapshot().motion;

    setSectionAnchor(createSectionAnchor(0.9));
    scene.update({ ...FRAME, frame: 2, timestamp: 32 });
    const depart = scene.getSnapshot().motion;

    setSectionAnchor(createSectionAnchor(0.1));
    scene.update({ ...FRAME, frame: 3, timestamp: 48 });
    const returned = scene.getSnapshot().motion;

    expect(depart).toEqual(
      resolveBooksCoverMotion({
        progress: 0.9,
        reducedMotion: false,
        viewportWidth: 1440,
      }),
    );
    expect(returned).toEqual(enter);
  });

  it("releases all Books CPU and GPU owners while leaving unrelated owners unchanged", async () => {
    const { assetRegistry, gpuResourceManager, scene } = createHarness();
    await scene.preload();
    const context = {} as WebGLRenderingContext;
    gpuResourceManager.setContext(context);
    gpuResourceManager.acquireGeometry(
      "books-scene:cover-geometry",
      "books-scene",
      () => new THREE.PlaneGeometry(1, 1),
    );
    gpuResourceManager.acquireMaterial(
      "books-scene:primary:cover-material",
      "books-scene",
      () => new THREE.MeshBasicMaterial(),
    );
    scene.getSnapshot().covers.forEach((cover) => {
      gpuResourceManager.acquireTexture(
        cover.assetSource,
        `books-scene:${cover.id}:cover-texture`,
        () => ({}) as WebGLTexture,
      );
    });
    gpuResourceManager.acquireGeometry(
      "about-scene:portrait-geometry",
      "about-scene",
      () => new THREE.PlaneGeometry(1, 1),
    );

    scene.dispose();
    scene.dispose();

    scene.getSnapshot().covers.forEach((cover) => {
      expect(assetRegistry.getOwnerIds(cover.assetId)).toEqual([]);
      expect(
        gpuResourceManager.snapshot.ownerCounts[
          `texture:${cover.assetSource}`
        ],
      ).toBe(0);
    });
    expect(
      gpuResourceManager.snapshot.ownerCounts[
        "geometry:books-scene:cover-geometry"
      ],
    ).toBe(0);
    expect(
      gpuResourceManager.snapshot.ownerCounts[
        "material:books-scene:primary:cover-material"
      ],
    ).toBe(0);
    expect(
      gpuResourceManager.snapshot.ownerCounts[
        "geometry:about-scene:portrait-geometry"
      ],
    ).toBe(1);
    expect(scene.getSnapshot()).toMatchObject({
      isActive: false,
      isCached: false,
      isDisposed: true,
      visualReady: false,
    });
    expect(scene.activate()).toBe(false);
  });
});
