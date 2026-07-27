import { describe, expect, it, vi } from "vitest";

import FrameCoordinator from "@/lib/motion/FrameCoordinator";
import MotionBus from "@/lib/motion/MotionBus";
import MotionSnapshotStore from "@/lib/motion/MotionSnapshotStore";
import RenderScheduler from "@/lib/webgl/RenderScheduler";
import SceneDirector, {
  DEFAULT_CAMERA_HANDOFF_POLICY,
  DEFAULT_MANIFESTO_ABOUT_POLICY,
  GLOBAL_IDLE_CAMERA_INTENT,
  type SceneTransitionSnapshot,
} from "@/lib/webgl/SceneDirector";
import SceneRegistry from "@/lib/webgl/SceneRegistry";
import type { SceneModule } from "@/lib/webgl/SceneModule";
import HeroScene from "@/lib/webgl/hero/HeroScene";
import {
  HERO_SCENE_ID,
  HERO_SCENE_ANCHOR_ID,
  HERO_PORTRAIT_ASSET_ID,
  heroSceneConfig,
} from "@/lib/webgl/hero/heroSceneConfig";
import AssetRegistry from "@/lib/webgl/AssetRegistry";
import DOMTracker from "@/lib/webgl/DOMTracker";
import MediaScene from "@/lib/webgl/media/MediaScene";
import { mediaSceneConfig, MEDIA_SCENE_ANCHOR_ID, MEDIA_SCENE_ID } from "@/lib/webgl/media/mediaSceneConfig";
import CameraRig from "@/lib/webgl/CameraRig";
import type { CameraIntent } from "@/lib/webgl/CameraIntent";
import {
  ABOUT_SCENE_ANCHOR_ID,
  ABOUT_SCENE_ID,
} from "@/lib/webgl/about/aboutSceneConfig";
import type { DOMTrackerWorldSnapshot } from "@/lib/webgl/DOMTracker";

type MockSceneState = {
  isActive: boolean;
  isCached: boolean;
  isDisposed: boolean;
};

type MockScene = SceneModule<MockSceneState>;

type MockSceneStateWithMediaProgress = MockSceneState & {
  mediaProgress: number;
  visualReady: boolean;
};

type MockSceneStateWithProgress = MockSceneState & {
  chapterProgress: number;
  mediaProgress: number;
  visualReady: boolean;
};

function createMockScene(
  id: string,
  options?: {
    readonly cameraIntent?: CameraIntent | null;
  },
): {
  readonly scene: MockScene;
  readonly state: MockSceneState;
  readonly lifecycle: {
    readonly preload: ReturnType<typeof vi.fn>;
    readonly activate: ReturnType<typeof vi.fn>;
    readonly deactivate: ReturnType<typeof vi.fn>;
    readonly dispose: ReturnType<typeof vi.fn>;
    readonly update: ReturnType<typeof vi.fn>;
  };
} {
  const lifecycle = {
    preload: vi.fn(),
    activate: vi.fn(() => true),
    deactivate: vi.fn(() => true),
    dispose: vi.fn(),
    update: vi.fn(),
  };

  const state: MockSceneState = {
    isActive: false,
    isCached: false,
    isDisposed: false,
  };

  const scene: MockScene = {
    identity: {
      id,
      sceneType: "test",
    },
    preload: lifecycle.preload,
    activate: () => {
      state.isActive = true;
      state.isCached = false;
      return lifecycle.activate() as boolean;
    },
    update: lifecycle.update,
    deactivate: () => {
      state.isActive = false;
      state.isCached = true;
      return lifecycle.deactivate() as boolean;
    },
    dispose: () => {
      state.isDisposed = true;
      state.isActive = false;
      state.isCached = false;
      lifecycle.dispose();
    },
    getSnapshot: () => ({ ...state }),
  };

  if (options?.cameraIntent !== undefined) {
    scene.getCameraIntent = () => options.cameraIntent ?? null;
  }

  return { scene, state, lifecycle };
}

function createMockSceneWithMediaProgress(
  id: string,
  options?: {
    readonly cameraIntent?: CameraIntent | null;
    readonly sceneType?: string;
    readonly mediaProgress?: number;
    readonly visualReady?: boolean;
  },
): {
  readonly scene: SceneModule<MockSceneStateWithMediaProgress>;
  readonly state: MockSceneStateWithMediaProgress;
  readonly lifecycle: {
    readonly preload: ReturnType<typeof vi.fn>;
    readonly activate: ReturnType<typeof vi.fn>;
    readonly deactivate: ReturnType<typeof vi.fn>;
    readonly dispose: ReturnType<typeof vi.fn>;
    readonly update: ReturnType<typeof vi.fn>;
  };
  readonly setMediaProgress: (value: number) => void;
  readonly setVisualReady: (value: boolean) => void;
} {
  const lifecycle = {
    preload: vi.fn(),
    activate: vi.fn(() => true),
    deactivate: vi.fn(() => true),
    dispose: vi.fn(),
    update: vi.fn(),
  };

  const state: MockSceneStateWithMediaProgress = {
    isActive: false,
    isCached: false,
    isDisposed: false,
    mediaProgress: options?.mediaProgress ?? 0,
    visualReady: options?.visualReady ?? true,
  };

  const scene: SceneModule<MockSceneStateWithMediaProgress> = {
    identity: {
      id,
      sceneType: options?.sceneType ?? "test",
    },
    preload: lifecycle.preload,
    activate: () => {
      state.isActive = true;
      state.isCached = false;
      return lifecycle.activate() as boolean;
    },
    update: lifecycle.update,
    deactivate: () => {
      state.isActive = false;
      state.isCached = true;
      return lifecycle.deactivate() as boolean;
    },
    dispose: () => {
      state.isDisposed = true;
      state.isActive = false;
      state.isCached = false;
      lifecycle.dispose();
    },
    getSnapshot: () => ({
      ...state,
      mediaProgress: state.mediaProgress,
      visualReady: state.visualReady,
    }),
  };

  if (options?.cameraIntent !== undefined) {
    scene.getCameraIntent = () => options.cameraIntent ?? null;
  }

  return {
    scene,
    state,
    lifecycle,
    setMediaProgress: (value: number): void => {
      state.mediaProgress = value;
    },
    setVisualReady: (value: boolean): void => {
      state.visualReady = value;
    },
  };
}

function createMockSceneWithProgress(
  id: string,
  options?: {
    readonly cameraIntent?: CameraIntent | null;
    readonly sceneType?: string;
    readonly chapterProgress?: number;
    readonly mediaProgress?: number;
    readonly preloadResult?: "ok" | "fail";
    readonly preloadGate?: Promise<void>;
    readonly visualReady?: boolean;
    readonly anchorId?: string;
  },
): {
  readonly scene: SceneModule<MockSceneStateWithProgress>;
  readonly state: MockSceneStateWithProgress;
  readonly lifecycle: {
    readonly preload: ReturnType<typeof vi.fn>;
    readonly activate: ReturnType<typeof vi.fn>;
    readonly deactivate: ReturnType<typeof vi.fn>;
    readonly dispose: ReturnType<typeof vi.fn>;
    readonly update: ReturnType<typeof vi.fn>;
  };
  readonly setChapterProgress: (value: number) => void;
  readonly setMediaProgress: (value: number) => void;
  readonly setVisualReady: (value: boolean) => void;
} {
  const lifecycle = {
    preload: vi.fn(async () => {
      if (options?.preloadGate) {
        await options.preloadGate;
      }
      if (options?.preloadResult === "fail") {
        throw new Error("mock preload failed");
      }
    }),
    activate: vi.fn(() => true),
    deactivate: vi.fn(() => true),
    dispose: vi.fn(),
    update: vi.fn(),
  };

  const state: MockSceneStateWithProgress = {
    isActive: false,
    isCached: false,
    isDisposed: false,
    chapterProgress: options?.chapterProgress ?? 0,
    mediaProgress: options?.mediaProgress ?? 0,
    visualReady: options?.visualReady ?? true,
  };

  const scene: SceneModule<MockSceneStateWithProgress> = {
    identity: {
      id,
      anchorId: options?.anchorId,
      sceneType: options?.sceneType ?? "test",
    },
    preload: lifecycle.preload,
    activate: () => {
      state.isActive = true;
      state.isCached = false;
      return lifecycle.activate() as boolean;
    },
    update: lifecycle.update,
    deactivate: () => {
      state.isActive = false;
      state.isCached = true;
      return lifecycle.deactivate() as boolean;
    },
    dispose: () => {
      state.isDisposed = true;
      state.isActive = false;
      state.isCached = false;
      lifecycle.dispose();
    },
    getSnapshot: () => ({
      ...state,
      chapterProgress: state.chapterProgress,
      mediaProgress: state.mediaProgress,
      visualReady: state.visualReady,
    }),
  };

  if (options?.cameraIntent !== undefined) {
    scene.getCameraIntent = () => options.cameraIntent ?? null;
  }

  return {
    scene,
    state,
    lifecycle,
    setChapterProgress: (value: number): void => {
      state.chapterProgress = value;
    },
    setMediaProgress: (value: number): void => {
      state.mediaProgress = value;
    },
    setVisualReady: (value: boolean): void => {
      state.visualReady = value;
    },
  };
}

describe("SceneDirector", () => {
  const createMotionFrame = (frame: number) => ({
    frame,
    timestamp: frame * 16,
    delta: 0.016,
    elapsed: frame * 0.016,
  });

  const mountAnchors = (domTracker: DOMTracker): void => {
    const heroAnchor = document.createElement("div");
    heroAnchor.id = HERO_SCENE_ANCHOR_ID;
    heroAnchor.style.width = "320px";
    heroAnchor.style.height = "180px";
    heroAnchor.getBoundingClientRect = () =>
      ({
        x: 0,
        y: -window.scrollY,
        top: -window.scrollY,
        left: 0,
        width: 320,
        height: 180,
        right: 320,
        bottom: 180 - window.scrollY,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(heroAnchor);

    const mediaAnchor = document.createElement("div");
    mediaAnchor.id = MEDIA_SCENE_ANCHOR_ID;
    mediaAnchor.style.width = "360px";
    mediaAnchor.style.height = "220px";
    mediaAnchor.getBoundingClientRect = () =>
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
    document.body.appendChild(mediaAnchor);

    domTracker.register({
      id: HERO_SCENE_ANCHOR_ID,
      element: heroAnchor,
      sceneType: "hero",
    });
    domTracker.register({
      id: MEDIA_SCENE_ANCHOR_ID,
      element: mediaAnchor,
      sceneType: "media",
    });
    domTracker.connect();
    domTracker.refreshFromDirty();
  };

  const seedHeroAndMediaAssets = (
    assetRegistry: AssetRegistry<HTMLImageElement>,
    viewportWidth: number,
  ): void => {
    const heroSrc = heroSceneConfig.portraitAssetSources.desktop;
    const mediaMainSrc = mediaSceneConfig.main.selectAssetSource(viewportWidth);
    const mediaSecondarySrc = mediaSceneConfig.secondary.selectAssetSource(viewportWidth);

    assetRegistry.register(
      {
        id: HERO_PORTRAIT_ASSET_ID,
        src: heroSrc,
        kind: "image",
      },
      { src: heroSrc } as HTMLImageElement,
    );
    assetRegistry.setState(HERO_PORTRAIT_ASSET_ID, "ready");

    assetRegistry.register(
      {
        id: mediaSceneConfig.main.assetId,
        src: mediaMainSrc,
        kind: "image",
      },
      { src: mediaMainSrc } as HTMLImageElement,
    );
    assetRegistry.setState(mediaSceneConfig.main.assetId, "ready");

    assetRegistry.register(
      {
        id: mediaSceneConfig.secondary.assetId,
        src: mediaSecondarySrc,
        kind: "image",
      },
      { src: mediaSecondarySrc } as HTMLImageElement,
    );
    assetRegistry.setState(mediaSceneConfig.secondary.assetId, "ready");
  };

  const syncViewport = (
    snapshot: MotionSnapshotStore,
    domTracker: DOMTracker,
    update: {
      readonly width: number;
      readonly height: number;
      readonly scrollX: number;
      readonly scrollY: number;
      readonly devicePixelRatio?: number;
      readonly isPortrait?: boolean;
    },
  ): void => {
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      writable: true,
      value: update.scrollY,
    });
    Object.defineProperty(window, "pageYOffset", {
      configurable: true,
      writable: true,
      value: update.scrollY,
    });
    snapshot.updateViewport({
      width: update.width,
      height: update.height,
      scrollX: update.scrollX,
      scrollY: update.scrollY,
      devicePixelRatio: update.devicePixelRatio ?? 1,
      isPortrait: update.isPortrait ?? false,
    });
    domTracker.updateViewport({
      width: update.width,
      height: update.height,
      scrollX: update.scrollX,
      scrollY: update.scrollY,
      devicePixelRatio: update.devicePixelRatio ?? 1,
      isPortrait: update.isPortrait ?? false,
    });
    domTracker.refreshFromDirty();
  };

  const buildDirector = (): {
    director: SceneDirector;
    registry: SceneRegistry;
  } => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const snapshot = new MotionSnapshotStore();

    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
    });

    return { director, registry };
  };

  const runFrameCycles = (frameCallbacks: FrameRequestCallback[], timestamps: number[]): void => {
    for (const timestamp of timestamps) {
      const callback = frameCallbacks.shift();
      callback?.(timestamp);
    }
  };

  const makeRafMocks = (): {
    readonly callbacks: FrameRequestCallback[];
    readonly requestAnimationFrame: ReturnType<typeof vi.spyOn>;
    readonly cancelAnimationFrame: ReturnType<typeof vi.spyOn>;
  } => {
    const callbacks: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callbacks.push(callback as FrameRequestCallback);
        return callbacks.length;
      });
    const cancelAnimationFrame = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);

    return {
      callbacks,
      requestAnimationFrame,
      cancelAnimationFrame,
    };
  };

  it("registers and runs preload/activate lifecycle", async () => {
    const { director, registry } = buildDirector();
    const scene = createMockScene(HERO_SCENE_ID);

    director.register(scene.scene);
    await director.preload(HERO_SCENE_ID);

    const activated = director.activate(HERO_SCENE_ID);
    expect(activated).toBe(true);
    expect(scene.lifecycle.preload).toHaveBeenCalledTimes(1);
    expect(scene.lifecycle.activate).toHaveBeenCalledTimes(1);
    expect(registry.getState(HERO_SCENE_ID)?.dominant).toBe(true);
  });

  it("supports replace strategy and transitions previous dominant to cached", async () => {
    const { director, registry } = buildDirector();
    const first = createMockScene("hero-1");
    const second = createMockScene("hero-2");

    director.register(first.scene);
    director.register(second.scene);
    await director.preload("hero-1");
    await director.preload("hero-2");

    director.activate("hero-1");
    director.activate("hero-2", "replace");

    expect(registry.getState("hero-1")?.cached).toBe(true);
    expect(registry.getState("hero-1")?.dominant).toBe(false);
    expect(registry.getState("hero-2")?.dominant).toBe(true);
    expect(first.lifecycle.deactivate).toHaveBeenCalledTimes(1);
  });

  it("supports overlap strategy and keeps existing dominant scene active", async () => {
    const { director, registry } = buildDirector();
    const first = createMockScene("hero-1");
    const second = createMockScene("hero-2");

    director.register(first.scene);
    director.register(second.scene);
    await director.preload("hero-1");
    await director.preload("hero-2");

    director.activate("hero-1");
    director.activate("hero-2", "overlap");

    expect(registry.getState("hero-1")?.dominant).toBe(true);
    expect(registry.getState("hero-2")?.dominant).toBe(false);
  });

  it("resolves dominant camera intent from active scenes", async () => {
    const { director } = buildDirector();
    const dominantIntent: CameraIntent = {
      target: { x: 0, y: 0, z: -2 },
      positionOffset: { x: 0, y: 0, z: 0 },
      fovIntent: 52,
      depthBias: -0.1,
      weight: 1,
    };
    const overlapIntent: CameraIntent = {
      target: { x: 1, y: 1, z: -4 },
      positionOffset: { x: 0.1, y: 0.1, z: 0 },
      fovIntent: 50,
      depthBias: -0.2,
      weight: 0,
    };

    const dominantScene = createMockScene("hero", { cameraIntent: dominantIntent });
    const overlapScene = createMockScene("media", { cameraIntent: overlapIntent });

    director.register(dominantScene.scene);
    director.register(overlapScene.scene);
    await director.preload("hero");
    await director.preload("media");

    director.activate("hero");
    director.activate("media", "overlap");

    expect(director.getCameraIntent()).toEqual({
      sceneId: "hero",
      intent: dominantIntent,
    });
  });

  it("selects About camera intent only while About is dominant", async () => {
    const { director } = buildDirector();
    const heroIntent: CameraIntent = {
      target: { x: 0, y: 0, z: -2 },
      positionOffset: { x: 0, y: 0, z: 0.35 },
      fovIntent: 48,
      depthBias: -0.2,
      weight: 1,
    };
    const aboutIntent: CameraIntent = {
      target: { x: -0.77, y: -0.02, z: 0 },
      positionOffset: { x: -0.03, y: 0.01, z: 0.35 },
      fovIntent: 48,
      depthBias: -0.15,
      weight: 1,
    };
    const hero = createMockScene("hero", { cameraIntent: heroIntent });
    const about = createMockScene(ABOUT_SCENE_ID, {
      cameraIntent: aboutIntent,
    });

    director.register(hero.scene);
    director.register(about.scene);
    await director.preload("hero");
    await director.preload(ABOUT_SCENE_ID);
    director.activate("hero");
    director.activate(ABOUT_SCENE_ID, "overlap");

    expect(director.getCameraIntent()?.sceneId).toBe("hero");

    director.activate(ABOUT_SCENE_ID, "replace");
    expect(director.getCameraIntent()).toEqual({
      sceneId: ABOUT_SCENE_ID,
      intent: aboutIntent,
    });

    director.cache(ABOUT_SCENE_ID);
    expect(director.getCameraIntent()).toBeNull();
  });

  it("blends dominant and secondary intents during overlap transition", async () => {
    const { director } = buildDirector();
    const dominantIntent: CameraIntent = {
      target: { x: 0, y: 0, z: -2 },
      positionOffset: { x: 0, y: 0, z: 0 },
      fovIntent: 52,
      depthBias: -0.1,
      weight: 4,
    };
    const secondaryIntent: CameraIntent = {
      target: { x: 10, y: 2, z: -4 },
      positionOffset: { x: 0.2, y: 0.2, z: 0 },
      fovIntent: 50,
      depthBias: -0.2,
      weight: 1,
    };

    const dominantScene = createMockScene("hero", { cameraIntent: dominantIntent });
    const mediaScene = createMockScene("media", { cameraIntent: secondaryIntent });

    director.register(dominantScene.scene);
    director.register(mediaScene.scene);
    await director.preload("hero");
    await director.preload("media");

    director.activate("hero");
    director.activate("media", "overlap");

    const resolved = director.getCameraIntent();
    expect(resolved?.sceneId).toBe("hero");
    expect(resolved?.intent.target.x).toBeCloseTo(2);
    expect(resolved?.intent.target.y).toBeCloseTo(0.4);
    expect(resolved?.intent.target.z).toBeCloseTo(-2.4);
    expect(resolved?.intent.positionOffset.x).toBeCloseTo(0.04);
    expect(resolved?.intent.positionOffset.y).toBeCloseTo(0.04);
    expect(resolved?.intent.positionOffset.z).toBe(0);
    expect(resolved?.intent.fovIntent).toBeCloseTo(51.6);
    expect(resolved?.intent.depthBias).toBeCloseTo(-0.12);
  });

  it("falls back to weighted intent when dominant scene has none", async () => {
    const { director } = buildDirector();
    const weightedIntent: CameraIntent = {
      target: { x: 0, y: 0, z: -6 },
      positionOffset: { x: -0.05, y: 0.05, z: 0 },
      fovIntent: 49,
      depthBias: -0.2,
      weight: 0.8,
    };

    const hero = createMockScene("hero");
    const media = createMockScene("media", { cameraIntent: weightedIntent });

    director.register(hero.scene);
    director.register(media.scene);
    await director.preload("hero");
    await director.preload("media");

    director.activate("hero");
    director.activate("media", "replace");

    expect(director.getCameraIntent()).toEqual({
      sceneId: "media",
      intent: weightedIntent,
    });
  });

  it("rolls back replace activation if dominant deactivation fails", async () => {
    const { director, registry } = buildDirector();
    const dominant = createMockScene("hero-1");
    const incoming = createMockScene("hero-2");
    dominant.lifecycle.deactivate.mockReturnValue(false);

    director.register(dominant.scene);
    director.register(incoming.scene);
    await director.preload("hero-1");
    await director.preload("hero-2");

    expect(director.activate("hero-1")).toBe(true);
    expect(director.activate("hero-2", "replace")).toBe(false);
    expect(registry.getState("hero-1")?.dominant).toBe(true);
    expect(registry.getState("hero-2")?.dominant).toBe(false);
  });

  it("disposes through director and marks registry disposed", async () => {
    const { director, registry } = buildDirector();
    const scene = createMockScene("hero-3");

    director.register(scene.scene);
    await director.preload("hero-3");
    director.activate("hero-3");

    expect(director.dispose("hero-3")).toBe(true);
    expect(scene.lifecycle.dispose).toHaveBeenCalledTimes(1);
    expect(registry.getState("hero-3")?.disposed).toBe(true);
  });

  it("supports replace to cache existing dominant scene and make next one dominant", async () => {
    const { director, registry } = buildDirector();
    const first = createMockScene("hero");
    const second = createMockScene("media");

    director.register(first.scene);
    director.register(second.scene);
    await director.preload("hero");
    await director.preload("media");

    expect(director.activate("hero", "replace")).toBe(true);
    expect(registry.getState("hero")?.dominant).toBe(true);

    expect(director.activate("media", "replace")).toBe(true);
    expect(registry.getState("hero")?.cached).toBe(true);
    expect(registry.getState("hero")?.dominant).toBe(false);
    expect(registry.getState("media")?.dominant).toBe(true);
  });

  it("supports overlap visibility and single dominant scene", async () => {
    const { director, registry } = buildDirector();
    const hero = createMockScene("hero");
    const media = createMockScene("media");

    director.register(hero.scene);
    director.register(media.scene);
    await director.preload("hero");
    await director.preload("media");

    expect(director.activate("hero", "replace")).toBe(true);
    expect(director.activate("media", "overlap")).toBe(true);

    expect(registry.getState("hero")?.visible).toBe(true);
    expect(registry.getState("media")?.visible).toBe(true);
    expect(registry.getState("hero")?.updating).toBe(true);
    expect(registry.getState("media")?.updating).toBe(true);
    expect(registry.getState("hero")?.dominant !== registry.getState("media")?.dominant).toBe(true);
  });

  it("prioritizes dominant scene intent over non-dominant intent", async () => {
    const { director } = buildDirector();
    const dominantIntent: CameraIntent = {
      target: { x: 0, y: 0, z: -2 },
      positionOffset: { x: 0, y: 0, z: 0 },
      fovIntent: 52,
      depthBias: -0.1,
      weight: 1,
    };
    const nonDominantIntent: CameraIntent = {
      target: { x: 10, y: 10, z: -2 },
      positionOffset: { x: 0.2, y: 0.2, z: 0 },
      fovIntent: 50,
      depthBias: -0.2,
      weight: 5,
    };

    const dominantScene = createMockScene("hero-dominant", { cameraIntent: dominantIntent });
    const nonDominantScene = createMockScene("media-foreground", { cameraIntent: nonDominantIntent });

    director.register(dominantScene.scene);
    director.register(nonDominantScene.scene);
    await director.preload("hero-dominant");
    await director.preload("media-foreground");

    director.activate("hero-dominant");
    director.activate("media-foreground", "overlap");

    const resolved = director.getCameraIntent();
    expect(resolved?.sceneId).toBe("hero-dominant");
    expect(resolved?.intent.target.x).toBeGreaterThan(0);
    expect(resolved?.intent.target.x).toBeLessThan(10);
    expect(resolved?.intent.target).not.toEqual(nonDominantIntent.target);
    expect(resolved?.intent.positionOffset.x).toBeGreaterThan(0);
    expect(resolved?.intent.positionOffset.x).toBeLessThan(nonDominantIntent.positionOffset.x);
  });

  it("keeps dominant intent source during overlap while blend strength varies with secondary weight", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const scheduler = new RenderScheduler(frame);
    const snapshot = new MotionSnapshotStore();
    const updatingSceneState = {
      resident: true,
      visible: true,
      updating: true,
      dominant: false,
      cached: false,
      disposed: false,
    };

    const mockRegistry = {
      register: vi.fn((descriptor) => descriptor),
      preload: vi.fn(() => true),
      activate: vi.fn(() => true),
      deactivate: vi.fn(() => true),
      cache: vi.fn(() => true),
      dispose: vi.fn(() => true),
      clear: vi.fn(),
      list: vi.fn((state?: string) => {
        if (state === "updating") {
          return [
            { id: "hero-dominant" },
            { id: "media-foreground" },
          ];
        }
        return [];
      }),
      getState: vi.fn((id: string) =>
        id === "hero-dominant" || id === "media-foreground"
          ? { ...updatingSceneState, dominant: id === "hero-dominant" }
          : null,
      ),
      getDescriptor: vi.fn((id: string) =>
        id === "hero-dominant" || id === "media-foreground"
          ? ({ id } as const)
          : null,
      ),
      has: vi.fn(() => true),
      unregister: vi.fn(),
      getSnapshot: vi.fn(),
      get: vi.fn(),
    } as unknown as SceneRegistry;

    const director = new SceneDirector({
      registry: mockRegistry,
      scheduler,
      snapshot,
    });

    let secondaryWeight = 0.1;
    const dominantIntent: CameraIntent = {
      target: { x: 0, y: 0, z: -2 },
      positionOffset: { x: 0, y: 0, z: 0 },
      fovIntent: 52,
      depthBias: -0.1,
      weight: 1,
    };

    const dominantScene = createMockScene("hero-dominant", { cameraIntent: dominantIntent });
    const mediaScene = createMockScene("media-foreground");
    mediaScene.scene.getCameraIntent = () => ({
      target: { x: 10, y: 10, z: -2 },
      positionOffset: { x: 0.2, y: 0.2, z: 0 },
      fovIntent: 50,
      depthBias: -0.2,
      weight: secondaryWeight,
    });

    director.register(dominantScene.scene);
    director.register(mediaScene.scene);

    const resolveBlend = (dominant: number, secondary: number): number =>
      Math.min(Math.max(secondary / (dominant + secondary), 0), 0.4);

    const resolveTargetX = (weight: number): number =>
      dominantIntent.target.x * (1 - weight) + 10 * weight;

    const resolveBlendX = (): number => resolveTargetX(resolveBlend(dominantIntent.weight, secondaryWeight));

    const before = director.getCameraIntent();
    expect(before?.sceneId).toBe("hero-dominant");
    expect(before?.intent.target.x).toBeCloseTo(resolveBlendX(), 5);

    secondaryWeight = 1;
    const after = director.getCameraIntent();
    expect(after?.sceneId).toBe("hero-dominant");
    expect(after?.intent.target.x).toBeCloseTo(resolveBlendX(), 5);
    expect(after?.intent.target.x).toBeGreaterThan(before?.intent.target.x ?? 0);
  });

  it("selects higher weighted intent when competing non-dominant scenes update", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const scheduler = new RenderScheduler(frame);
    const snapshot = new MotionSnapshotStore();
    const updatingSceneState = {
      resident: true,
      visible: true,
      updating: true,
      dominant: false,
      cached: false,
      disposed: false,
    };

    const mockRegistry = {
      register: vi.fn((descriptor) => descriptor),
      preload: vi.fn(() => true),
      activate: vi.fn(() => true),
      deactivate: vi.fn(() => true),
      cache: vi.fn(() => true),
      dispose: vi.fn(() => true),
      clear: vi.fn(),
      list: vi.fn((state?: string) => {
        if (state === "updating") {
          return [
            { id: "scene-low" },
            { id: "scene-high" },
          ];
        }
        return [];
      }),
      getState: vi.fn((id: string) =>
        id === "scene-low" || id === "scene-high"
          ? updatingSceneState
          : null,
      ),
      getDescriptor: vi.fn((id: string) =>
        id === "scene-low" || id === "scene-high" ? ({ id } as const) : null,
      ),
      has: vi.fn(() => true),
      unregister: vi.fn(),
      getSnapshot: vi.fn(),
      get: vi.fn(),
    } as unknown as SceneRegistry;

    const director = new SceneDirector({
      registry: mockRegistry,
      scheduler,
      snapshot,
    });

    const lowIntentScene = createMockScene("scene-low", {
      cameraIntent: {
        target: { x: 0, y: 0, z: 0 },
        positionOffset: { x: 0, y: 0, z: 0 },
        fovIntent: 54,
        depthBias: 0,
        weight: 0.25,
      },
    });
    const highIntentScene = createMockScene("scene-high", {
      cameraIntent: {
        target: { x: 1, y: 1, z: 0 },
        positionOffset: { x: 0, y: 0, z: 0 },
        fovIntent: 58,
        depthBias: 0,
        weight: 1.9,
      },
    });

    director.register(lowIntentScene.scene);
    director.register(highIntentScene.scene);

    expect(director.getCameraIntent()).toEqual({
      sceneId: "scene-high",
      intent: {
        target: { x: 1, y: 1, z: 0 },
        positionOffset: { x: 0, y: 0, z: 0 },
        fovIntent: 58,
        depthBias: 0,
        weight: 1.9,
      },
    });
  });

  it("validates Hero to Media transition contract with overlap then replace", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
    });
    const assetRegistry = new AssetRegistry<HTMLImageElement>();
    const domTracker = new DOMTracker(frame, bus, new CameraRig());

    syncViewport(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
    });
    mountAnchors(domTracker);

    seedHeroAndMediaAssets(assetRegistry, snapshot.viewport.width);

    const hero = new HeroScene({
      assetRegistry,
      domTracker,
      snapshot,
    });
    const media = new MediaScene({
      assetRegistry,
      domTracker,
      snapshot,
    });

    director.register(hero);
    director.register(media);

    await director.preload(HERO_SCENE_ID);
    await director.preload(MEDIA_SCENE_ID);

    expect(assetRegistry.getOwnerIds(HERO_PORTRAIT_ASSET_ID).length).toBe(1);
    expect(assetRegistry.getOwnerIds(mediaSceneConfig.main.assetId).length).toBe(1);
    expect(assetRegistry.getOwnerIds(mediaSceneConfig.secondary.assetId).length).toBe(1);

    expect(director.activate(HERO_SCENE_ID)).toBe(true);

    const heroState = registry.getState(HERO_SCENE_ID);
    expect(heroState?.dominant).toBe(true);
    expect(heroState?.visible).toBe(true);
    expect(heroState?.updating).toBe(true);

    expect(director.activate(MEDIA_SCENE_ID, "overlap")).toBe(true);

    const heroOverlapState = registry.getState(HERO_SCENE_ID);
    const mediaOverlapState = registry.getState(MEDIA_SCENE_ID);
    expect(heroOverlapState?.dominant).toBe(true);
    expect(heroOverlapState?.visible).toBe(true);
    expect(heroOverlapState?.updating).toBe(true);
    expect(mediaOverlapState?.dominant).toBe(false);
    expect(mediaOverlapState?.visible).toBe(true);
    expect(mediaOverlapState?.updating).toBe(true);

    expect(director.activate(MEDIA_SCENE_ID, "replace")).toBe(true);

    const heroReplaceState = registry.getState(HERO_SCENE_ID);
    const mediaReplaceState = registry.getState(MEDIA_SCENE_ID);
    expect(mediaReplaceState?.dominant).toBe(true);
    expect(mediaReplaceState?.visible).toBe(true);
    expect(mediaReplaceState?.updating).toBe(true);
    expect(heroReplaceState?.dominant).toBe(false);
    expect(heroReplaceState?.cached).toBe(true);

    expect(assetRegistry.getOwnerIds(HERO_PORTRAIT_ASSET_ID).length).toBe(1);
    expect(assetRegistry.getState(mediaSceneConfig.main.assetId)).toBe("ready");
    expect(assetRegistry.getState(mediaSceneConfig.secondary.assetId)).toBe("ready");
    expect(assetRegistry.getOwnerIds(mediaSceneConfig.main.assetId).length).toBe(1);
    expect(assetRegistry.getOwnerIds(mediaSceneConfig.secondary.assetId).length).toBe(1);

    frame.stop();
    domTracker.disconnect();
    document.body.innerHTML = "";
  });

  it("orchestrates Hero→Media transition lifecycle from motion progress", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const transitionPolicy = {
      heroProgressToPreload: 0.15,
      heroProgressToOverlap: 0.15,
      mediaProgressToReplace: 0.72,
      heroProgressToCache: 0.9,
      reduceMotionSkipsTransition: true,
    };
    const { callbacks, requestAnimationFrame, cancelAnimationFrame } = makeRafMocks();

    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      sceneTransitionPolicy: transitionPolicy,
    });
    const hero = createMockSceneWithProgress(HERO_SCENE_ID, {
      sceneType: "hero",
      chapterProgress: 0,
    });
    const media = createMockSceneWithProgress(MEDIA_SCENE_ID, {
      sceneType: "media",
      mediaProgress: 0,
    });

    director.register(hero.scene);
    director.register(media.scene);

    await director.preload(HERO_SCENE_ID);

    expect(director.activate(HERO_SCENE_ID)).toBe(true);
    expect(registry.getState(HERO_SCENE_ID)?.dominant).toBe(true);
    expect(registry.getState(MEDIA_SCENE_ID)?.cached).toBe(false);
    expect(registry.getState(MEDIA_SCENE_ID)?.visible).toBe(false);
    expect(media.lifecycle.activate).toHaveBeenCalledTimes(0);

    scheduler.start();
    frame.start();

    runFrameCycles(callbacks, [16]);
    await Promise.resolve();
    expect(media.lifecycle.preload).toHaveBeenCalledTimes(0);
    expect(registry.getState(MEDIA_SCENE_ID)?.resident).toBe(false);

    hero.setChapterProgress(0.2);

    runFrameCycles(callbacks, [32]);
    await Promise.resolve();
    expect(media.lifecycle.preload).toHaveBeenCalledTimes(1);
    expect(registry.getState(MEDIA_SCENE_ID)?.resident).toBe(true);
    expect(registry.getState(MEDIA_SCENE_ID)?.dominant).toBe(false);

    runFrameCycles(callbacks, [48]);
    await Promise.resolve();
    expect(media.lifecycle.activate).toHaveBeenCalledTimes(1);
    expect(registry.getState(MEDIA_SCENE_ID)?.visible).toBe(true);
    expect(registry.getState(MEDIA_SCENE_ID)?.dominant).toBe(false);

    media.setMediaProgress(0.8);
    runFrameCycles(callbacks, [64]);
    await Promise.resolve();
    expect(media.lifecycle.activate).toHaveBeenCalledTimes(2);
    expect(registry.getState(MEDIA_SCENE_ID)?.dominant).toBe(true);
    expect(registry.getState(HERO_SCENE_ID)?.cached).toBe(true);
    expect(registry.getState(HERO_SCENE_ID)?.dominant).toBe(false);

    hero.setChapterProgress(1);
    runFrameCycles(callbacks, [80]);
    await Promise.resolve();
    expect(registry.getState(HERO_SCENE_ID)?.cached).toBe(true);

    frame.stop();
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
    director.disposeAll();
    director.destroy();
  });

  it("returns Media to cached state when hero returns before media chapter window", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const { callbacks, requestAnimationFrame, cancelAnimationFrame } = makeRafMocks();
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
    });
    const hero = createMockSceneWithProgress(HERO_SCENE_ID, {
      sceneType: "hero",
      chapterProgress: 0.4,
    });
    const media = createMockSceneWithProgress(MEDIA_SCENE_ID, {
      sceneType: "media",
      mediaProgress: 0,
    });

    director.register(hero.scene);
    director.register(media.scene);
    await director.preload(HERO_SCENE_ID);
    await director.preload(MEDIA_SCENE_ID);
    expect(director.activate(HERO_SCENE_ID)).toBe(true);

    scheduler.start();
    frame.start();

    runFrameCycles(callbacks, [16]);
    await Promise.resolve();
    expect(registry.getState(HERO_SCENE_ID)?.dominant).toBe(true);
    expect(registry.getState(MEDIA_SCENE_ID)?.visible).toBe(true);

    media.setMediaProgress(0.8);
    runFrameCycles(callbacks, [32]);
    await Promise.resolve();
    expect(registry.getState(MEDIA_SCENE_ID)?.dominant).toBe(true);
    expect(registry.getState(HERO_SCENE_ID)?.cached).toBe(true);
    const heroUpdatesBeforeReverse = hero.lifecycle.update.mock.calls.length;

    hero.setChapterProgress(0.1);
    media.setMediaProgress(0.5);
    runFrameCycles(callbacks, [48]);
    await Promise.resolve();

    const restoredHero = registry.getState(HERO_SCENE_ID);
    const cachedMedia = registry.getState(MEDIA_SCENE_ID);
    expect(restoredHero?.dominant).toBe(true);
    expect(restoredHero?.visible).toBe(true);
    expect(restoredHero?.updating).toBe(true);
    expect(restoredHero?.cached).toBe(false);
    expect(cachedMedia?.dominant).toBe(false);
    expect(cachedMedia?.visible).toBe(false);
    expect(cachedMedia?.updating).toBe(false);
    expect(cachedMedia?.cached).toBe(true);
    expect(hero.lifecycle.activate).toHaveBeenCalledTimes(2);
    expect(hero.lifecycle.update.mock.calls.length).toBe(heroUpdatesBeforeReverse + 1);

    frame.stop();
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
    director.disposeAll();
    director.destroy();
  });

  it("keeps reduced-motion transitions active while forcing zero camera blend", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const { callbacks, requestAnimationFrame, cancelAnimationFrame } = makeRafMocks();
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
    });
    const hero = createMockSceneWithProgress(HERO_SCENE_ID, {
      sceneType: "hero",
      chapterProgress: 0.6,
      cameraIntent: {
        target: { x: 0, y: 0, z: -2 },
        positionOffset: { x: 0, y: 0, z: 0 },
        fovIntent: 52,
        depthBias: -0.12,
        weight: 1,
      },
    });
    const media = createMockSceneWithProgress(MEDIA_SCENE_ID, {
      sceneType: "media",
      mediaProgress: 0.8,
      cameraIntent: {
        target: { x: 2, y: 0, z: -2 },
        positionOffset: { x: 0.2, y: 0, z: 0 },
        fovIntent: 50,
        depthBias: -0.15,
        weight: 1,
      },
    });

    director.register(hero.scene);
    director.register(media.scene);
    await director.preload(HERO_SCENE_ID);
    await director.preload(MEDIA_SCENE_ID);
    director.activate(HERO_SCENE_ID);

    snapshot.setReducedMotion(true);
    scheduler.start();
    frame.start();

    runFrameCycles(callbacks, [16]);
    await Promise.resolve();

    expect(media.lifecycle.preload).toHaveBeenCalledTimes(1);
    expect(media.lifecycle.activate.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(registry.getState(MEDIA_SCENE_ID)?.resident).toBe(true);
    expect(registry.getState(MEDIA_SCENE_ID)?.dominant).toBe(true);
    expect(director.transitionSnapshot.cameraBlendWeight).toBe(0);
    expect(director.getCameraIntent()?.sceneId).toBe(MEDIA_SCENE_ID);

    frame.stop();
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
    director.disposeAll();
    director.destroy();
  });

  it("keeps dominant scene intent across Hero to Media overlap/replace", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
    });
    const assetRegistry = new AssetRegistry<HTMLImageElement>();
    const domTracker = new DOMTracker(frame, bus, new CameraRig());

    syncViewport(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
    });
    mountAnchors(domTracker);

    seedHeroAndMediaAssets(assetRegistry, snapshot.viewport.width);

    const hero = new HeroScene({
      assetRegistry,
      domTracker,
      snapshot,
    });
    const media = new MediaScene({
      assetRegistry,
      domTracker,
      snapshot,
    });
    director.register(hero);
    director.register(media);

    await director.preload(HERO_SCENE_ID);
    await director.preload(MEDIA_SCENE_ID);

    expect(director.activate(HERO_SCENE_ID)).toBe(true);
    hero.update(createMotionFrame(1));
    media.update(createMotionFrame(1));

    expect(director.getCameraIntent()?.sceneId).toBe(HERO_SCENE_ID);

    expect(director.activate(MEDIA_SCENE_ID, "overlap")).toBe(true);
    hero.update(createMotionFrame(2));
    media.update(createMotionFrame(2));
    expect(director.getCameraIntent()?.sceneId).toBe(HERO_SCENE_ID);

    expect(director.activate(MEDIA_SCENE_ID, "replace")).toBe(true);
    hero.update(createMotionFrame(3));
    media.update(createMotionFrame(3));
    expect(director.getCameraIntent()?.sceneId).toBe(MEDIA_SCENE_ID);

    frame.stop();
    domTracker.disconnect();
    document.body.innerHTML = "";
  });

  it("keeps Hero scene intent before handoff threshold during Hero/Media overlap", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
    });

    const assetRegistry = new AssetRegistry<HTMLImageElement>();
    const domTracker = new DOMTracker(frame, bus, new CameraRig());

    syncViewport(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
    });
    mountAnchors(domTracker);

    seedHeroAndMediaAssets(assetRegistry, snapshot.viewport.width);

    const hero = new HeroScene({
      assetRegistry,
      domTracker,
      snapshot,
    });
    const media = new MediaScene({
      assetRegistry,
      domTracker,
      snapshot,
    });
    director.register(hero);
    director.register(media);

    await director.preload(HERO_SCENE_ID);
    await director.preload(MEDIA_SCENE_ID);

    expect(director.activate(HERO_SCENE_ID)).toBe(true);
    expect(director.activate(MEDIA_SCENE_ID, "overlap")).toBe(true);

    hero.update(createMotionFrame(1));
    media.update(createMotionFrame(1));
    const intentBefore = director.getCameraIntent();
    const heroIntent = hero.getCameraIntent();
    expect(intentBefore).not.toBeNull();
    expect(heroIntent).not.toBeNull();
    expect(intentBefore?.sceneId).toBe(HERO_SCENE_ID);
    expect(intentBefore?.intent).toEqual(heroIntent);

    syncViewport(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
    });
    hero.update(createMotionFrame(2));
    media.update(createMotionFrame(2));

    const intentDuringPre = director.getCameraIntent();
    expect(intentDuringPre?.sceneId).toBe(HERO_SCENE_ID);
    expect(intentDuringPre?.intent).toEqual(hero.getCameraIntent());

    frame.stop();
    domTracker.disconnect();
    document.body.innerHTML = "";
  });

  it("blends Hero/Media camera intent during handoff interval", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
    });

    const assetRegistry = new AssetRegistry<HTMLImageElement>();
    const domTracker = new DOMTracker(frame, bus, new CameraRig());

    syncViewport(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
    });
    mountAnchors(domTracker);

    seedHeroAndMediaAssets(assetRegistry, snapshot.viewport.width);

    const hero = new HeroScene({
      assetRegistry,
      domTracker,
      snapshot,
    });
    const media = new MediaScene({
      assetRegistry,
      domTracker,
      snapshot,
    });
    director.register(hero);
    director.register(media);

    await director.preload(HERO_SCENE_ID);
    await director.preload(MEDIA_SCENE_ID);

    expect(director.activate(HERO_SCENE_ID)).toBe(true);
    expect(director.activate(MEDIA_SCENE_ID, "overlap")).toBe(true);
    media.setVisualReady(false);

    const progress = (DEFAULT_CAMERA_HANDOFF_POLICY.startProgress + DEFAULT_CAMERA_HANDOFF_POLICY.endProgress) / 2;
    const mediaAnchor = domTracker.getSnapshot(MEDIA_SCENE_ANCHOR_ID);
    const anchorScrollBase =
      (mediaAnchor?.top ?? 0) + (mediaAnchor?.scrollY ?? 0);
    const mediaProgressSpan = Math.max(1, (mediaAnchor?.height ?? 220) * 0.5);
    const scrollY = Math.round(anchorScrollBase + mediaProgressSpan * progress);

    syncViewport(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY,
    });
    media.setVisualReady(true);
    hero.update(createMotionFrame(2));
    media.update(createMotionFrame(2));

    const blendIntent = director.getCameraIntent();
    const heroIntent = hero.getCameraIntent();
    const mediaIntent = media.getCameraIntent();
    expect(blendIntent).not.toBeNull();
    expect(heroIntent).not.toBeNull();
    expect(mediaIntent).not.toBeNull();
    expect(blendIntent?.sceneId).toBe(HERO_SCENE_ID);
    expect(blendIntent?.intent.positionOffset.x).not.toEqual(heroIntent?.positionOffset.x);
    expect(blendIntent?.intent.positionOffset.x).not.toEqual(mediaIntent?.positionOffset.x);

    frame.stop();
    domTracker.disconnect();
    document.body.innerHTML = "";
  });

  it("switches dominant camera intent to Media after handoff end progress", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
    });

    const assetRegistry = new AssetRegistry<HTMLImageElement>();
    const domTracker = new DOMTracker(frame, bus, new CameraRig());

    syncViewport(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
    });
    mountAnchors(domTracker);

    seedHeroAndMediaAssets(assetRegistry, snapshot.viewport.width);

    const hero = new HeroScene({
      assetRegistry,
      domTracker,
      snapshot,
    });
    const media = new MediaScene({
      assetRegistry,
      domTracker,
      snapshot,
    });
    director.register(hero);
    director.register(media);

    await director.preload(HERO_SCENE_ID);
    await director.preload(MEDIA_SCENE_ID);

    expect(director.activate(HERO_SCENE_ID)).toBe(true);
    expect(director.activate(MEDIA_SCENE_ID, "overlap")).toBe(true);
    media.setVisualReady(false);

    const anchorHeight = 220;
    const viewportHeightPlusAnchor = 800 + anchorHeight;
    const scrollY = Math.round(viewportHeightPlusAnchor * (DEFAULT_CAMERA_HANDOFF_POLICY.endProgress + 0.2));

    syncViewport(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY,
    });
    media.setVisualReady(true);
    hero.update(createMotionFrame(2));
    media.update(createMotionFrame(2));

    const mediaIntent = director.getCameraIntent();
    expect(mediaIntent).not.toBeNull();
    expect(mediaIntent?.sceneId).toBe(MEDIA_SCENE_ID);
    expect(mediaIntent?.intent).toEqual(media.getCameraIntent());

    frame.stop();
    domTracker.disconnect();
    document.body.innerHTML = "";
  });

  it("disables camera handoff while reduced motion is enabled", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
    });

    const assetRegistry = new AssetRegistry<HTMLImageElement>();
    const domTracker = new DOMTracker(frame, bus, new CameraRig());

    syncViewport(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
    });
    mountAnchors(domTracker);

    seedHeroAndMediaAssets(assetRegistry, snapshot.viewport.width);

    const hero = new HeroScene({
      assetRegistry,
      domTracker,
      snapshot,
    });
    const media = new MediaScene({
      assetRegistry,
      domTracker,
      snapshot,
    });
    director.register(hero);
    director.register(media);

    await director.preload(HERO_SCENE_ID);
    await director.preload(MEDIA_SCENE_ID);

    expect(director.activate(HERO_SCENE_ID)).toBe(true);
    expect(director.activate(MEDIA_SCENE_ID, "overlap")).toBe(true);

    syncViewport(snapshot, domTracker, {
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 1000,
    });
    snapshot.setReducedMotion(true);
    hero.update(createMotionFrame(2));
    media.update(createMotionFrame(2));

    const reducedIntent = director.getCameraIntent();
    const heroIntent = hero.getCameraIntent();
    expect(reducedIntent).not.toBeNull();
    expect(heroIntent).not.toBeNull();
    expect(reducedIntent?.sceneId).toBe(HERO_SCENE_ID);
    expect(reducedIntent?.intent).toEqual(heroIntent);

    frame.stop();
    domTracker.disconnect();
    document.body.innerHTML = "";
  });

  it("uses default policy window (0.22~0.66) and max secondary blend for Hero->Media handoff", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
    });

    const hero = createMockSceneWithMediaProgress("hero-default-handoff", {
      sceneType: "hero",
      mediaProgress: 0,
      cameraIntent: {
        target: { x: 0, y: 0, z: -2 },
        positionOffset: { x: 0, y: 0, z: 0 },
        fovIntent: 52,
        depthBias: -0.12,
        weight: 1,
      },
    });
    const media = createMockSceneWithMediaProgress("media-default-handoff", {
      sceneType: "media",
      mediaProgress: 0,
      cameraIntent: {
        target: { x: 2, y: 0, z: -2 },
        positionOffset: { x: 0.8, y: 0, z: 0 },
        fovIntent: 50,
        depthBias: -0.2,
        weight: 1,
      },
    });

    director.register(hero.scene);
    director.register(media.scene);
    director.activate("hero-default-handoff");
    director.activate("media-default-handoff", "overlap");

    const setMediaProgressAndResolve = (value: number): {
      readonly intent: ReturnType<typeof director.getCameraIntent>;
      readonly transitionSnapshot: SceneTransitionSnapshot;
    } => {
      media.setMediaProgress(value);
      const intent = director.getCameraIntent();
      const transitionSnapshot = director.transitionSnapshot;
      return { intent, transitionSnapshot };
    };

    const belowStart = setMediaProgressAndResolve(DEFAULT_CAMERA_HANDOFF_POLICY.startProgress - 0.01);
    expect(belowStart.intent?.sceneId).toBe("hero-default-handoff");
    expect(belowStart.transitionSnapshot.handoffProgress).toBeCloseTo(
      DEFAULT_CAMERA_HANDOFF_POLICY.startProgress - 0.01,
    );
    expect(belowStart.transitionSnapshot.cameraBlendWeight).toBeCloseTo(0);

    const mid = setMediaProgressAndResolve((DEFAULT_CAMERA_HANDOFF_POLICY.startProgress + DEFAULT_CAMERA_HANDOFF_POLICY.endProgress) / 2);
    expect(mid.intent?.sceneId).toBe("hero-default-handoff");
    expect(mid.transitionSnapshot.handoffProgress).toBeCloseTo(
      (DEFAULT_CAMERA_HANDOFF_POLICY.startProgress + DEFAULT_CAMERA_HANDOFF_POLICY.endProgress) / 2,
    );
    expect(mid.transitionSnapshot.cameraBlendWeight).toBeGreaterThan(0);
    expect(mid.transitionSnapshot.cameraBlendWeight).toBeLessThanOrEqual(DEFAULT_CAMERA_HANDOFF_POLICY.maxSecondaryBlend);

    const settle = setMediaProgressAndResolve(DEFAULT_CAMERA_HANDOFF_POLICY.startProgress);
    expect(settle.transitionSnapshot.handoffProgress).toBeCloseTo(DEFAULT_CAMERA_HANDOFF_POLICY.startProgress);
    expect(settle.transitionSnapshot.cameraBlendWeight).toBeCloseTo(0);

    const aboveEnd = setMediaProgressAndResolve(DEFAULT_CAMERA_HANDOFF_POLICY.endProgress);
    expect(aboveEnd.intent?.sceneId).toBe("media-default-handoff");
    expect(aboveEnd.transitionSnapshot.handoffProgress).toBeCloseTo(DEFAULT_CAMERA_HANDOFF_POLICY.endProgress);
    expect(aboveEnd.transitionSnapshot.cameraBlendWeight).toBeLessThanOrEqual(DEFAULT_CAMERA_HANDOFF_POLICY.maxSecondaryBlend + 0.0001);

    frame.stop();
  });

  it("keeps overlap + zero blend when hero->media mediaReady is false", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
    });

    const hero = createMockSceneWithMediaProgress("hero-visual-ready", {
      sceneType: "hero",
      mediaProgress: 0,
      cameraIntent: {
        target: { x: 0, y: 0, z: -2 },
        positionOffset: { x: 0, y: 0, z: 0 },
        fovIntent: 52,
        depthBias: -0.12,
        weight: 1,
      },
    });
    const media = createMockSceneWithMediaProgress("media-visual-ready", {
      sceneType: "media",
      mediaProgress: 0.5,
      visualReady: false,
      cameraIntent: {
        target: { x: 2, y: 0, z: -2 },
        positionOffset: { x: 0.8, y: 0, z: 0 },
        fovIntent: 50,
        depthBias: -0.2,
        weight: 1,
      },
    });

    director.register(hero.scene);
    director.register(media.scene);
    director.activate("hero-visual-ready");
    director.activate("media-visual-ready", "overlap");

    const intent = director.getCameraIntent();
    const transitionSnapshot = director.transitionSnapshot;
    expect(intent?.sceneId).toBe("hero-visual-ready");
    expect(transitionSnapshot.transitionPhase).toBe("overlap");
    expect(transitionSnapshot.cameraBlendWeight).toBe(0);

    media.setMediaProgress(0.5);
    const afterSet = director.getCameraIntent();
    expect(afterSet?.sceneId).toBe("hero-visual-ready");

    media.setVisualReady(true);
    const readyIntent = director.getCameraIntent();
    expect(readyIntent).not.toBeNull();
    expect(readyIntent?.sceneId).toBe("hero-visual-ready");
    expect(director.transitionSnapshot.cameraBlendWeight).toBeGreaterThan(0);

    frame.stop();
  });

  it("does not enter media replace before media visualReady", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const { callbacks, requestAnimationFrame, cancelAnimationFrame } = makeRafMocks();
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
    });
    const hero = createMockSceneWithProgress(HERO_SCENE_ID, {
      sceneType: "hero",
      chapterProgress: 0,
      visualReady: true,
    });
    const media = createMockSceneWithProgress(MEDIA_SCENE_ID, {
      sceneType: "media",
      mediaProgress: 0,
      visualReady: false,
    });

    director.register(hero.scene);
    director.register(media.scene);

    await director.preload(HERO_SCENE_ID);
    await director.preload(MEDIA_SCENE_ID);
    expect(director.activate(HERO_SCENE_ID)).toBe(true);
    expect(registry.getState(HERO_SCENE_ID)?.dominant).toBe(true);
    expect(registry.getState(MEDIA_SCENE_ID)?.cached).toBe(false);

    scheduler.start();
    frame.start();

    hero.setChapterProgress(0.2);
    runFrameCycles(callbacks, [16]);
    await Promise.resolve();
    expect(media.lifecycle.preload).toHaveBeenCalledTimes(1);
    expect(registry.getState(MEDIA_SCENE_ID)?.resident).toBe(true);

    runFrameCycles(callbacks, [32]);
    await Promise.resolve();
    expect(registry.getState(MEDIA_SCENE_ID)?.visible).toBe(true);
    expect(registry.getState(MEDIA_SCENE_ID)?.dominant).toBe(false);

    media.setMediaProgress(0.8);
    runFrameCycles(callbacks, [48]);
    await Promise.resolve();
    expect(registry.getState(MEDIA_SCENE_ID)?.dominant).toBe(false);

    media.setVisualReady(true);
    runFrameCycles(callbacks, [64]);
    await Promise.resolve();
    expect(registry.getState(MEDIA_SCENE_ID)?.dominant).toBe(true);

    frame.stop();
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
    director.disposeAll();
    director.destroy();
  });

  it("requires current-frame media visualReady before handoff can continue", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const snapshot = new MotionSnapshotStore();
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
    });

    const heroIntent = {
      target: { x: 0, y: 0, z: -2 },
      positionOffset: { x: 0, y: 0, z: 0 },
      fovIntent: 52,
      depthBias: -0.12,
      weight: 1,
    };
    const mediaIntent = {
      target: { x: 2, y: 0, z: -2 },
      positionOffset: { x: 1, y: 0, z: 0 },
      fovIntent: 50,
      depthBias: -0.2,
      weight: 1,
    };
    const hero = createMockSceneWithMediaProgress("hero-visual-ready-current-frame", {
      sceneType: "hero",
      cameraIntent: heroIntent,
    });
    const media = createMockSceneWithMediaProgress("media-visual-ready-current-frame", {
      sceneType: "media",
      cameraIntent: mediaIntent,
      mediaProgress: DEFAULT_CAMERA_HANDOFF_POLICY.startProgress,
      visualReady: true,
    });

    director.register(hero.scene);
    director.register(media.scene);
    director.activate("hero-visual-ready-current-frame");
    director.activate("media-visual-ready-current-frame", "overlap");

    const settleIntent = director.getCameraIntent();
    expect(settleIntent?.sceneId).toBe("hero-visual-ready-current-frame");
    expect(director.transitionSnapshot.cameraBlendWeight).toBeCloseTo(0, 6);

    media.setMediaProgress(0.44);
    media.setVisualReady(false);

    const currentFrameIntent = director.getCameraIntent();
    expect(currentFrameIntent?.sceneId).toBe("hero-visual-ready-current-frame");
    expect(director.transitionSnapshot.transitionPhase).toBe("overlap");
    expect(director.transitionSnapshot.cameraBlendWeight).toBe(0);

    frame.stop();
  });

  it("keeps Hero intent when mediaProgress equals start boundary", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const snapshot = new MotionSnapshotStore();
    const policy = {
      ...DEFAULT_CAMERA_HANDOFF_POLICY,
      startProgress: 0.25,
      endProgress: 0.75,
      easing: (value: number) => value,
      maxSecondaryBlend: 0.4,
    };
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      cameraHandoffPolicy: policy,
    });

    const heroIntent = {
      target: { x: 0, y: 0, z: -2 },
      positionOffset: { x: 0, y: 0, z: 0 },
      fovIntent: 52,
      depthBias: -0.12,
      weight: 1,
    };
    const mediaIntent = {
      target: { x: 2, y: 0, z: -2 },
      positionOffset: { x: 1, y: 0, z: 0 },
      fovIntent: 50,
      depthBias: -0.2,
      weight: 1,
    };
    const hero = createMockSceneWithMediaProgress("hero-boundary-start", {
      sceneType: "hero",
      cameraIntent: heroIntent,
    });
    const media = createMockSceneWithMediaProgress("media-boundary-start", {
      sceneType: "media",
      cameraIntent: mediaIntent,
    });

    director.register(hero.scene);
    director.register(media.scene);
    director.activate("hero-boundary-start");
    director.activate("media-boundary-start", "overlap");
    media.setMediaProgress(policy.startProgress);

    const intent = director.getCameraIntent();
    expect(intent).not.toBeNull();
    expect(intent?.sceneId).toBe("hero-boundary-start");
    expect(intent?.intent).toEqual(heroIntent);

    frame.stop();
  });

  it("switches to secondary intent when mediaProgress equals end boundary", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const snapshot = new MotionSnapshotStore();
    const policy = {
      ...DEFAULT_CAMERA_HANDOFF_POLICY,
      startProgress: 0.25,
      endProgress: 0.75,
      easing: (value: number) => value,
      maxSecondaryBlend: 0.4,
    };
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      cameraHandoffPolicy: policy,
    });

    const heroIntent = {
      target: { x: 0, y: 0, z: -2 },
      positionOffset: { x: 0, y: 0, z: 0 },
      fovIntent: 52,
      depthBias: -0.12,
      weight: 1,
    };
    const mediaIntent = {
      target: { x: 2, y: 0, z: -2 },
      positionOffset: { x: 1, y: 0, z: 0 },
      fovIntent: 50,
      depthBias: -0.2,
      weight: 1,
    };
    const hero = createMockSceneWithMediaProgress("hero-boundary-end", {
      sceneType: "hero",
      cameraIntent: heroIntent,
    });
    const media = createMockSceneWithMediaProgress("media-boundary-end", {
      sceneType: "media",
      cameraIntent: mediaIntent,
    });

    director.register(hero.scene);
    director.register(media.scene);
    director.activate("hero-boundary-end");
    director.activate("media-boundary-end", "overlap");
    media.setMediaProgress(policy.endProgress);

    const intent = director.getCameraIntent();
    expect(intent).not.toBeNull();
    expect(intent?.sceneId).toBe("media-boundary-end");
    expect(intent?.intent).toEqual(mediaIntent);

    frame.stop();
  });

  it("keeps dominant intent when mediaProgress is below start boundary", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const snapshot = new MotionSnapshotStore();
    const policy = {
      ...DEFAULT_CAMERA_HANDOFF_POLICY,
      startProgress: 0.25,
      endProgress: 0.75,
      easing: (value: number) => value,
      maxSecondaryBlend: 0.4,
    };
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      cameraHandoffPolicy: policy,
    });

    const heroIntent = {
      target: { x: 0, y: 0, z: -2 },
      positionOffset: { x: 0, y: 0, z: 0 },
      fovIntent: 52,
      depthBias: -0.12,
      weight: 1,
    };
    const mediaIntent = {
      target: { x: 2, y: 0, z: -2 },
      positionOffset: { x: 1, y: 0, z: 0 },
      fovIntent: 50,
      depthBias: -0.2,
      weight: 1,
    };
    const hero = createMockSceneWithMediaProgress("hero-boundary-below", {
      sceneType: "hero",
      cameraIntent: heroIntent,
    });
    const media = createMockSceneWithMediaProgress("media-boundary-below", {
      sceneType: "media",
      cameraIntent: mediaIntent,
    });

    director.register(hero.scene);
    director.register(media.scene);
    director.activate("hero-boundary-below");
    director.activate("media-boundary-below", "overlap");
    media.setMediaProgress(0.1);

    const intent = director.getCameraIntent();
    expect(intent).not.toBeNull();
    expect(intent?.sceneId).toBe("hero-boundary-below");
    expect(intent?.intent.positionOffset.x).toBe(0);

    frame.stop();
  });

  it("switches to secondary intent when mediaProgress is above end boundary", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const snapshot = new MotionSnapshotStore();
    const policy = {
      ...DEFAULT_CAMERA_HANDOFF_POLICY,
      startProgress: 0.25,
      endProgress: 0.75,
      easing: (value: number) => value,
      maxSecondaryBlend: 0.4,
    };
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      cameraHandoffPolicy: policy,
    });

    const heroIntent = {
      target: { x: 0, y: 0, z: -2 },
      positionOffset: { x: 0, y: 0, z: 0 },
      fovIntent: 52,
      depthBias: -0.12,
      weight: 1,
    };
    const mediaIntent = {
      target: { x: 2, y: 0, z: -2 },
      positionOffset: { x: 1, y: 0, z: 0 },
      fovIntent: 50,
      depthBias: -0.2,
      weight: 1,
    };
    const hero = createMockSceneWithMediaProgress("hero-boundary-above", {
      sceneType: "hero",
      cameraIntent: heroIntent,
    });
    const media = createMockSceneWithMediaProgress("media-boundary-above", {
      sceneType: "media",
      cameraIntent: mediaIntent,
    });

    director.register(hero.scene);
    director.register(media.scene);
    director.activate("hero-boundary-above");
    director.activate("media-boundary-above", "overlap");
    media.setMediaProgress(0.95);

    const intent = director.getCameraIntent();
    expect(intent).not.toBeNull();
    expect(intent?.sceneId).toBe("media-boundary-above");
    expect(intent?.intent).toEqual(mediaIntent);

    frame.stop();
  });

  it("falls back safely with startProgress >= endProgress", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const snapshot = new MotionSnapshotStore();
    const policy = {
      startProgress: 0.9,
      endProgress: 0.6,
      easing: (value: number) => value,
      maxSecondaryBlend: 0.4,
    };
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      cameraHandoffPolicy: policy,
    });

    const heroIntent = {
      target: { x: 0, y: 0, z: -2 },
      positionOffset: { x: 0, y: 0, z: 0 },
      fovIntent: 52,
      depthBias: -0.12,
      weight: 1,
    };
    const mediaIntent = {
      target: { x: 2, y: 0, z: -2 },
      positionOffset: { x: 1, y: 0, z: 0 },
      fovIntent: 50,
      depthBias: -0.2,
      weight: 1,
    };
    const hero = createMockSceneWithMediaProgress("hero-invalid-order", {
      sceneType: "hero",
      cameraIntent: heroIntent,
    });
    const media = createMockSceneWithMediaProgress("media-invalid-order", {
      sceneType: "media",
      cameraIntent: mediaIntent,
    });

    director.register(hero.scene);
    director.register(media.scene);
    director.activate("hero-invalid-order");
    director.activate("media-invalid-order", "overlap");
    media.setMediaProgress(0.75);

    const intent = director.getCameraIntent();
    expect(intent).not.toBeNull();
    expect(intent?.sceneId).toBe("hero-invalid-order");

    frame.stop();
  });

  it("falls back safely with NaN policy configuration", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const snapshot = new MotionSnapshotStore();
    const policy = {
      startProgress: Number.NaN,
      endProgress: 0.72,
      easing: (value: number) => value,
      maxSecondaryBlend: 0.4,
    };
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      cameraHandoffPolicy: policy,
    });

    const heroIntent = {
      target: { x: 0, y: 0, z: -2 },
      positionOffset: { x: 0, y: 0, z: 0 },
      fovIntent: 52,
      depthBias: -0.12,
      weight: 1,
    };
    const mediaIntent = {
      target: { x: 2, y: 0, z: -2 },
      positionOffset: { x: 1, y: 0, z: 0 },
      fovIntent: 50,
      depthBias: -0.2,
      weight: 1,
    };
    const hero = createMockSceneWithMediaProgress("hero-invalid-nan", {
      sceneType: "hero",
      cameraIntent: heroIntent,
    });
    const media = createMockSceneWithMediaProgress("media-invalid-nan", {
      sceneType: "media",
      cameraIntent: mediaIntent,
    });

    director.register(hero.scene);
    director.register(media.scene);
    director.activate("hero-invalid-nan");
    director.activate("media-invalid-nan", "overlap");
    media.setMediaProgress(0.5);

    const intent = director.getCameraIntent();
    expect(intent).not.toBeNull();
    expect(intent?.sceneId).toBe("hero-invalid-nan");

    frame.stop();
  });

  it("handles out-of-range policy boundaries safely", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const snapshot = new MotionSnapshotStore();
    const policy = {
      startProgress: -0.2,
      endProgress: 1.2,
      easing: (value: number) => value,
      maxSecondaryBlend: 0.4,
    };
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      cameraHandoffPolicy: policy,
    });

    const hero = createMockSceneWithMediaProgress("hero-invalid-range", {
      sceneType: "hero",
      cameraIntent: {
        target: { x: 0, y: 0, z: -2 },
        positionOffset: { x: 0, y: 0, z: 0 },
        fovIntent: 52,
        depthBias: -0.12,
        weight: 1,
      },
    });
    const media = createMockSceneWithMediaProgress("media-invalid-range", {
      sceneType: "media",
      cameraIntent: {
        target: { x: 2, y: 0, z: -2 },
        positionOffset: { x: 1, y: 0, z: 0 },
        fovIntent: 50,
        depthBias: -0.2,
        weight: 1,
      },
    });

    director.register(hero.scene);
    director.register(media.scene);
    director.activate("hero-invalid-range");
    director.activate("media-invalid-range", "overlap");
    media.setMediaProgress(1.8);
    const intent = director.getCameraIntent();

    expect(intent).not.toBeNull();
    expect(intent?.sceneId).toBe("hero-invalid-range");
    expect(intent?.intent.positionOffset.x).toBeLessThan(1);
    expect(intent?.intent.positionOffset.x).toBeGreaterThan(0);
    expect(intent?.intent.positionOffset.x).toBeLessThanOrEqual(0.4);

    frame.stop();
  });

  it("caps blend weight by maxSecondaryBlend", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const snapshot = new MotionSnapshotStore();
    const policy = {
      startProgress: 0.2,
      endProgress: 0.8,
      easing: (value: number) => value,
      maxSecondaryBlend: 0.05,
    };
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      cameraHandoffPolicy: policy,
    });

    const hero = createMockSceneWithMediaProgress("hero-blend-limit", {
      sceneType: "hero",
      cameraIntent: {
        target: { x: 0, y: 0, z: -2 },
        positionOffset: { x: 0, y: 0, z: 0 },
        fovIntent: 52,
        depthBias: -0.12,
        weight: 4,
      },
    });
    const media = createMockSceneWithMediaProgress("media-blend-limit", {
      sceneType: "media",
      cameraIntent: {
        target: { x: 2, y: 0, z: -2 },
        positionOffset: { x: 1, y: 0, z: 0 },
        fovIntent: 50,
        depthBias: -0.2,
        weight: 1,
      },
    });

    director.register(hero.scene);
    director.register(media.scene);
    director.activate("hero-blend-limit");
    director.activate("media-blend-limit", "overlap");
    media.setMediaProgress(0.5);

    const intent = director.getCameraIntent();
    expect(intent).not.toBeNull();
    expect(intent?.sceneId).toBe("hero-blend-limit");
    expect(intent?.intent.positionOffset.x).toBeCloseTo(0.05, 5);
    expect(intent?.intent.positionOffset.x).toBeLessThanOrEqual(policy.maxSecondaryBlend + 0.0001);

    frame.stop();
  });

  it("keeps reduced motion dominant during handoff policy window", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const snapshot = new MotionSnapshotStore();
    const policy = {
      startProgress: 0.2,
      endProgress: 0.8,
      easing: (value: number) => value,
      maxSecondaryBlend: 1,
    };
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      cameraHandoffPolicy: policy,
    });

    const heroIntent = {
      target: { x: 0, y: 0, z: -2 },
      positionOffset: { x: 0, y: 0, z: 0 },
      fovIntent: 52,
      depthBias: -0.12,
      weight: 1,
    };
    const mediaIntent = {
      target: { x: 2, y: 0, z: -2 },
      positionOffset: { x: 1, y: 0, z: 0 },
      fovIntent: 50,
      depthBias: -0.2,
      weight: 1,
    };
    const hero = createMockSceneWithMediaProgress("hero-reduced-motion", {
      sceneType: "hero",
      cameraIntent: heroIntent,
    });
    const media = createMockSceneWithMediaProgress("media-reduced-motion", {
      sceneType: "media",
      cameraIntent: mediaIntent,
    });

    director.register(hero.scene);
    director.register(media.scene);
    director.activate("hero-reduced-motion");
    director.activate("media-reduced-motion", "overlap");
    snapshot.setReducedMotion(true);
    media.setMediaProgress(0.6);

    const intent = director.getCameraIntent();
    expect(intent).not.toBeNull();
    expect(intent?.sceneId).toBe("hero-reduced-motion");
    expect(intent?.intent).toEqual(heroIntent);

    frame.stop();
  });

  it("emits transition snapshot for Hero -> Media preload/overlap/handoff/replace states", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
    });
    const { callbacks, requestAnimationFrame, cancelAnimationFrame } = makeRafMocks();

    const hero = createMockSceneWithProgress(HERO_SCENE_ID, {
      sceneType: "hero",
      chapterProgress: 0,
      cameraIntent: {
        target: { x: 0, y: 0, z: -2 },
        positionOffset: { x: 0, y: 0, z: 0 },
        fovIntent: 52,
        depthBias: -0.12,
        weight: 1,
      },
    });
    const media = createMockSceneWithProgress(MEDIA_SCENE_ID, {
      sceneType: "media",
      mediaProgress: 0,
      cameraIntent: {
        target: { x: 2, y: 0, z: -2 },
        positionOffset: { x: 0.2, y: 0, z: 0 },
        fovIntent: 50,
        depthBias: -0.15,
        weight: 1,
      },
    });

    director.register(hero.scene);
    director.register(media.scene);

    await director.preload(HERO_SCENE_ID);
    director.activate(HERO_SCENE_ID);

    scheduler.start();
    frame.start();

    hero.setChapterProgress(0.2);
    runFrameCycles(callbacks, [16]);
    expect(director.transitionSnapshot.transitionPhase).toBe("preload");
    expect(director.transitionSnapshot.fromSceneId).toBe(HERO_SCENE_ID);
    expect(director.transitionSnapshot.toSceneId).toBe(MEDIA_SCENE_ID);
    expect(director.transitionSnapshot.handoffProgress).toBe(0);
    expect(director.transitionSnapshot.cameraBlendWeight).toBe(0);
    expect(director.transitionSnapshot.dominantSceneId).toBe(HERO_SCENE_ID);
    expect(media.lifecycle.preload).toHaveBeenCalledTimes(1);

    await Promise.resolve();

    runFrameCycles(callbacks, [32]);
    const overlapSnapshot = director.transitionSnapshot;
    expect(overlapSnapshot.transitionPhase).toBe("overlap");
    expect(overlapSnapshot.dominantSceneId).toBe(HERO_SCENE_ID);
    expect(overlapSnapshot.cameraBlendWeight).toBe(0);

    media.setMediaProgress(0.5);
    runFrameCycles(callbacks, [48]);
    const handoffSnapshot = director.transitionSnapshot;
    expect(handoffSnapshot.transitionPhase).toBe("handoff");
    expect(handoffSnapshot.handoffProgress).toBeCloseTo(0.5);
    expect(handoffSnapshot.cameraBlendWeight).toBeGreaterThan(0);

    media.setMediaProgress(0.8);
    runFrameCycles(callbacks, [64]);
    const replaceSnapshot = director.transitionSnapshot;
    expect(replaceSnapshot.transitionPhase).toBe("replace");
    expect(registry.getState(MEDIA_SCENE_ID)?.dominant).toBe(true);
    expect(replaceSnapshot.dominantSceneId).toBe(MEDIA_SCENE_ID);

    frame.stop();
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
    director.disposeAll();
    director.destroy();
  });

  it("collapses a resident Hero -> Media jump from overlap directly into replace within one frame", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
    });
    const { callbacks, requestAnimationFrame, cancelAnimationFrame } = makeRafMocks();

    const hero = createMockSceneWithProgress(HERO_SCENE_ID, {
      sceneType: "hero",
      chapterProgress: 0.1,
      cameraIntent: {
        target: { x: 0, y: 0, z: -2 },
        positionOffset: { x: 0, y: 0, z: 0 },
        fovIntent: 52,
        depthBias: -0.12,
        weight: 1,
      },
    });
    const media = createMockSceneWithProgress(MEDIA_SCENE_ID, {
      sceneType: "media",
      mediaProgress: 0,
      visualReady: true,
      cameraIntent: {
        target: { x: 2, y: 0, z: -2 },
        positionOffset: { x: 0.2, y: 0, z: 0 },
        fovIntent: 50,
        depthBias: -0.15,
        weight: 1,
      },
    });

    director.register(hero.scene);
    director.register(media.scene);

    await director.preload(HERO_SCENE_ID);
    await director.preload(MEDIA_SCENE_ID);
    director.activate(HERO_SCENE_ID);

    scheduler.start();
    frame.start();

    hero.setChapterProgress(0.95);
    media.setMediaProgress(0.8);
    media.setVisualReady(true);

    runFrameCycles(callbacks, [16]);

    expect(director.transitionSnapshot.transitionPhase).toBe("replace");
    expect(registry.getState(MEDIA_SCENE_ID)?.dominant).toBe(true);
    expect(registry.getState(HERO_SCENE_ID)?.cached).toBe(true);

    frame.stop();
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
    director.disposeAll();
    director.destroy();
  });

  it("forces replace when Hero has already exited and Media skips past visual-ready handoff", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
    });
    const { callbacks, requestAnimationFrame, cancelAnimationFrame } = makeRafMocks();

    const hero = createMockSceneWithProgress(HERO_SCENE_ID, {
      sceneType: "hero",
      chapterProgress: 0.95,
      cameraIntent: {
        target: { x: 0, y: 0, z: -2 },
        positionOffset: { x: 0, y: 0, z: 0 },
        fovIntent: 52,
        depthBias: -0.12,
        weight: 1,
      },
    });
    const media = createMockSceneWithProgress(MEDIA_SCENE_ID, {
      sceneType: "media",
      mediaProgress: 0.8,
      visualReady: false,
      cameraIntent: {
        target: { x: 2, y: 0, z: -2 },
        positionOffset: { x: 0.2, y: 0, z: 0 },
        fovIntent: 50,
        depthBias: -0.15,
        weight: 1,
      },
    });

    director.register(hero.scene);
    director.register(media.scene);
    await director.preload(HERO_SCENE_ID);
    await director.preload(MEDIA_SCENE_ID);
    director.activate(HERO_SCENE_ID);
    director.activate(MEDIA_SCENE_ID, "overlap");

    scheduler.start();
    frame.start();
    runFrameCycles(callbacks, [16]);

    expect(registry.getState(MEDIA_SCENE_ID)?.dominant).toBe(true);
    expect(director.transitionSnapshot.transitionPhase).toBe("replace");
    expect(director.getCameraIntent()?.sceneId).toBe(MEDIA_SCENE_ID);

    frame.stop();
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
    director.disposeAll();
    director.destroy();
  });

  it("caches Media at Manifesto entry, keeps Manifesto DOM-only, and exposes global idle camera intent", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const anchors = createInterludeAnchorTracker(1_000);
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      domTracker: anchors.tracker,
    });
    const { callbacks, requestAnimationFrame, cancelAnimationFrame } = makeRafMocks();
    const mediaIntent: CameraIntent = {
      target: { x: 2, y: 0, z: -8 },
      positionOffset: { x: 0.2, y: 0, z: 0.35 },
      fovIntent: 50,
      depthBias: -0.15,
      weight: 1,
    };
    const media = createMockSceneWithProgress(MEDIA_SCENE_ID, {
      sceneType: "media",
      mediaProgress: 1,
      cameraIntent: mediaIntent,
    });
    const about = createMockSceneWithProgress(ABOUT_SCENE_ID, {
      sceneType: "about",
      anchorId: ABOUT_SCENE_ANCHOR_ID,
      cameraIntent: {
        target: { x: -1, y: 0, z: -8 },
        positionOffset: { x: 0, y: 0, z: 0.35 },
        fovIntent: 48,
        depthBias: -0.15,
        weight: 1,
      },
    });

    director.register(media.scene);
    director.register(about.scene);
    await director.preload(MEDIA_SCENE_ID);
    director.activate(MEDIA_SCENE_ID, "replace");
    scheduler.start();
    frame.start();

    anchors.set("manifesto", { top: 1_001, bottom: 2_001 });
    anchors.set(ABOUT_SCENE_ANCHOR_ID, { top: 1_501, bottom: 5_501 });
    runFrameCycles(callbacks, [16]);
    expect(registry.getState(MEDIA_SCENE_ID)?.dominant).toBe(true);
    expect(registry.getState(ABOUT_SCENE_ID)?.resident).toBe(false);
    expect(about.lifecycle.preload).toHaveBeenCalledTimes(0);

    anchors.set("manifesto", { top: 1_000, bottom: 2_000 });
    anchors.set(ABOUT_SCENE_ANCHOR_ID, { top: 1_500, bottom: 5_500 });
    runFrameCycles(callbacks, [32]);
    await Promise.resolve();

    expect(registry.getDescriptor("manifesto")).toBeNull();
    expect(registry.getState(MEDIA_SCENE_ID)?.cached).toBe(true);
    expect(registry.getState(ABOUT_SCENE_ID)?.resident).toBe(true);
    expect(about.lifecycle.preload).toHaveBeenCalledTimes(1);
    expect(director.getCameraIntent()).toEqual(GLOBAL_IDLE_CAMERA_INTENT);
    expect(director.transitionSnapshot.cameraIntentSceneId).toBe("global-idle");

    frame.stop();
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
    director.disposeAll();
    director.destroy();
  });

  it("activates ready About only in its core and restores global idle on reverse Manifesto entry", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const anchors = createInterludeAnchorTracker(1_000);
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      domTracker: anchors.tracker,
    });
    const { callbacks, requestAnimationFrame, cancelAnimationFrame } = makeRafMocks();
    const aboutIntent: CameraIntent = {
      target: { x: -1, y: 0, z: -8 },
      positionOffset: { x: 0, y: 0, z: 0.35 },
      fovIntent: 48,
      depthBias: -0.15,
      weight: 1,
    };
    const about = createMockSceneWithProgress(ABOUT_SCENE_ID, {
      sceneType: "about",
      anchorId: ABOUT_SCENE_ANCHOR_ID,
      cameraIntent: aboutIntent,
      visualReady: true,
    });

    director.register(about.scene);
    anchors.set("manifesto", { top: -1_200, bottom: 900 });
    anchors.set(ABOUT_SCENE_ANCHOR_ID, { top: 1_200, bottom: 5_200 });
    scheduler.start();
    frame.start();

    runFrameCycles(callbacks, [16]);
    await Promise.resolve();
    expect(registry.getState(ABOUT_SCENE_ID)).toMatchObject({
      resident: true,
      visible: false,
      dominant: false,
      cached: false,
    });
    expect(director.getCameraIntent()?.sceneId).toBe("global-idle");

    anchors.set(ABOUT_SCENE_ANCHOR_ID, { top: 800, bottom: 4_800 });
    runFrameCycles(callbacks, [32]);
    expect(registry.getState(ABOUT_SCENE_ID)).toMatchObject({
      resident: true,
      visible: true,
      dominant: true,
      cached: false,
    });
    expect(director.getCameraIntent()).toEqual({
      sceneId: ABOUT_SCENE_ID,
      intent: aboutIntent,
    });

    anchors.set(ABOUT_SCENE_ANCHOR_ID, { top: 801, bottom: 4_801 });
    runFrameCycles(callbacks, [48]);
    expect(registry.getState(ABOUT_SCENE_ID)).toMatchObject({
      resident: true,
      visible: false,
      dominant: false,
      cached: true,
    });
    expect(director.getCameraIntent()?.sceneId).toBe("global-idle");

    anchors.set(ABOUT_SCENE_ANCHOR_ID, { top: 800, bottom: 4_800 });
    runFrameCycles(callbacks, [64]);
    expect(registry.getState(ABOUT_SCENE_ID)?.dominant).toBe(true);
    expect(about.lifecycle.preload).toHaveBeenCalledTimes(1);
    expect(about.lifecycle.activate).toHaveBeenCalledTimes(2);

    frame.stop();
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
    director.disposeAll();
    director.destroy();
  });

  it("never uses non-dominant About as a secondary blend or sole fallback camera source", async () => {
    const { director } = buildDirector();
    const mediaIntent: CameraIntent = {
      target: { x: 2, y: 0, z: -8 },
      positionOffset: { x: 0.2, y: 0, z: 0.35 },
      fovIntent: 50,
      depthBias: -0.15,
      weight: 1,
    };
    const aboutIntent: CameraIntent = {
      target: { x: -2, y: 0, z: -8 },
      positionOffset: { x: -0.03, y: 0.01, z: 0.35 },
      fovIntent: 48,
      depthBias: -0.15,
      weight: 1,
    };
    const media = createMockSceneWithProgress(MEDIA_SCENE_ID, {
      sceneType: "media",
      cameraIntent: mediaIntent,
    });
    const about = createMockSceneWithProgress(ABOUT_SCENE_ID, {
      sceneType: "about",
      anchorId: ABOUT_SCENE_ANCHOR_ID,
      cameraIntent: aboutIntent,
    });

    director.register(media.scene);
    director.register(about.scene);
    await director.preload(MEDIA_SCENE_ID);
    await director.preload(ABOUT_SCENE_ID);
    director.activate(MEDIA_SCENE_ID, "replace");
    director.activate(ABOUT_SCENE_ID, "overlap");

    expect(director.getCameraIntent()).toEqual({
      sceneId: MEDIA_SCENE_ID,
      intent: mediaIntent,
    });

    const noIntentDominant = createMockScene("dom-only");
    director.register(noIntentDominant.scene);
    await director.preload("dom-only");
    director.activate("dom-only", "replace");
    director.activate(ABOUT_SCENE_ID, "overlap");

    expect(director.getCameraIntent()).toBeNull();
  });

  it("resolves a preloaded large Media-to-About jump to one dominant About intent before render", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const anchors = createInterludeAnchorTracker(1_000);
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      domTracker: anchors.tracker,
      manifestoAboutPolicy: DEFAULT_MANIFESTO_ABOUT_POLICY,
    });
    const { callbacks, requestAnimationFrame, cancelAnimationFrame } = makeRafMocks();
    const media = createMockSceneWithProgress(MEDIA_SCENE_ID, {
      sceneType: "media",
      mediaProgress: 1,
      cameraIntent: {
        target: { x: 2, y: 0, z: -8 },
        positionOffset: { x: 0.2, y: 0, z: 0.35 },
        fovIntent: 50,
        depthBias: -0.15,
        weight: 1,
      },
    });
    const aboutIntent: CameraIntent = {
      target: { x: -1, y: 0, z: -8 },
      positionOffset: { x: 0, y: 0, z: 0.35 },
      fovIntent: 48,
      depthBias: -0.15,
      weight: 1,
    };
    const about = createMockSceneWithProgress(ABOUT_SCENE_ID, {
      sceneType: "about",
      anchorId: ABOUT_SCENE_ANCHOR_ID,
      cameraIntent: aboutIntent,
    });

    director.register(media.scene);
    director.register(about.scene);
    await director.preload(MEDIA_SCENE_ID);
    await director.preload(ABOUT_SCENE_ID);
    director.activate(MEDIA_SCENE_ID, "replace");
    scheduler.start();
    frame.start();

    anchors.set("manifesto", { top: -3_000, bottom: -1_000 });
    anchors.set(ABOUT_SCENE_ANCHOR_ID, { top: 800, bottom: 4_800 });
    runFrameCycles(callbacks, [16]);

    expect(registry.getState(MEDIA_SCENE_ID)?.cached).toBe(true);
    expect(registry.getState(ABOUT_SCENE_ID)?.dominant).toBe(true);
    expect(director.getCameraIntent()).toEqual({
      sceneId: ABOUT_SCENE_ID,
      intent: aboutIntent,
    });
    expect(director.transitionSnapshot.cameraBlendWeight).toBe(0);

    frame.stop();
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
    director.disposeAll();
    director.destroy();
  });

  it("holds global idle through a cold core jump and atomically selects About on the first ready frame", async () => {
    let releasePreload = (): void => undefined;
    const preloadGate = new Promise<void>((resolve) => {
      releasePreload = resolve;
    });
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const anchors = createInterludeAnchorTracker(1_000);
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      domTracker: anchors.tracker,
    });
    const { callbacks, requestAnimationFrame, cancelAnimationFrame } = makeRafMocks();
    const media = createMockSceneWithProgress(MEDIA_SCENE_ID, {
      sceneType: "media",
      mediaProgress: 1,
      cameraIntent: {
        target: { x: 2, y: 0, z: -8 },
        positionOffset: { x: 0.2, y: 0, z: 0.35 },
        fovIntent: 50,
        depthBias: -0.15,
        weight: 1,
      },
    });
    const aboutIntent: CameraIntent = {
      target: { x: -1, y: 0, z: -8 },
      positionOffset: { x: 0, y: 0, z: 0.35 },
      fovIntent: 48,
      depthBias: -0.15,
      weight: 1,
    };
    const about = createMockSceneWithProgress(ABOUT_SCENE_ID, {
      sceneType: "about",
      anchorId: ABOUT_SCENE_ANCHOR_ID,
      cameraIntent: aboutIntent,
      preloadGate,
      visualReady: false,
    });

    director.register(media.scene);
    director.register(about.scene);
    await director.preload(MEDIA_SCENE_ID);
    director.activate(MEDIA_SCENE_ID, "replace");
    anchors.set("manifesto", { top: -2_000, bottom: -1_000 });
    anchors.set(ABOUT_SCENE_ANCHOR_ID, { top: 800, bottom: 4_800 });
    scheduler.start();
    frame.start();

    runFrameCycles(callbacks, [16]);
    expect(registry.getState(MEDIA_SCENE_ID)?.cached).toBe(true);
    expect(registry.getState(ABOUT_SCENE_ID)?.resident).toBe(false);
    const coldCoreIntent = director.getCameraIntent();

    about.setVisualReady(true);
    releasePreload();
    await preloadGate;
    await Promise.resolve();
    expect(coldCoreIntent).toEqual(GLOBAL_IDLE_CAMERA_INTENT);
    expect(registry.getState(ABOUT_SCENE_ID)?.resident).toBe(true);
    expect(registry.getState(ABOUT_SCENE_ID)?.dominant).toBe(false);
    expect(director.getCameraIntent()).toEqual(GLOBAL_IDLE_CAMERA_INTENT);

    runFrameCycles(callbacks, [32]);
    expect(registry.getState(ABOUT_SCENE_ID)?.dominant).toBe(true);
    expect(director.getCameraIntent()).toEqual({
      sceneId: ABOUT_SCENE_ID,
      intent: aboutIntent,
    });

    frame.stop();
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
    director.disposeAll();
    director.destroy();
  });

  it("converges a direct reverse About-to-Hero jump in the first Director update", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const anchors = createInterludeAnchorTracker(1_000);
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      domTracker: anchors.tracker,
    });
    const { callbacks, requestAnimationFrame, cancelAnimationFrame } = makeRafMocks();
    const heroIntent: CameraIntent = {
      target: { x: 0, y: 0, z: -8 },
      positionOffset: { x: 0, y: 0, z: 0.35 },
      fovIntent: 48,
      depthBias: -0.12,
      weight: 1,
    };
    const hero = createMockSceneWithProgress(HERO_SCENE_ID, {
      sceneType: "hero",
      chapterProgress: 0,
      cameraIntent: heroIntent,
    });
    const media = createMockSceneWithProgress(MEDIA_SCENE_ID, {
      sceneType: "media",
      mediaProgress: 0,
      cameraIntent: {
        target: { x: 2, y: 0, z: -8 },
        positionOffset: { x: 0.2, y: 0, z: 0.35 },
        fovIntent: 50,
        depthBias: -0.15,
        weight: 1,
      },
    });
    const about = createMockSceneWithProgress(ABOUT_SCENE_ID, {
      sceneType: "about",
      anchorId: ABOUT_SCENE_ANCHOR_ID,
      cameraIntent: {
        target: { x: -1, y: 0, z: -8 },
        positionOffset: { x: 0, y: 0, z: 0.35 },
        fovIntent: 48,
        depthBias: -0.15,
        weight: 1,
      },
    });

    director.register(hero.scene);
    director.register(media.scene);
    director.register(about.scene);
    await director.preload(HERO_SCENE_ID);
    await director.preload(MEDIA_SCENE_ID);
    await director.preload(ABOUT_SCENE_ID);
    director.activate(HERO_SCENE_ID, "replace");
    director.activate(MEDIA_SCENE_ID, "replace");
    director.activate(ABOUT_SCENE_ID, "replace");
    anchors.set("manifesto", { top: 1_001, bottom: 2_001 });
    anchors.set(ABOUT_SCENE_ANCHOR_ID, { top: 3_000, bottom: 7_000 });
    scheduler.start();
    frame.start();

    runFrameCycles(callbacks, [16]);
    expect(registry.getState(ABOUT_SCENE_ID)?.cached).toBe(true);
    expect(registry.getState(HERO_SCENE_ID)?.dominant).toBe(true);
    expect(director.getCameraIntent()).toEqual({
      sceneId: HERO_SCENE_ID,
      intent: heroIntent,
    });

    frame.stop();
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
    director.disposeAll();
    director.destroy();
  });

  it("caches About after its bottom boundary and selects global idle in that same frame", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const anchors = createInterludeAnchorTracker(1_000);
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      domTracker: anchors.tracker,
    });
    const { callbacks, requestAnimationFrame, cancelAnimationFrame } = makeRafMocks();
    const about = createMockSceneWithProgress(ABOUT_SCENE_ID, {
      sceneType: "about",
      anchorId: ABOUT_SCENE_ANCHOR_ID,
      cameraIntent: {
        target: { x: -1, y: 0, z: -8 },
        positionOffset: { x: 0, y: 0, z: 0.35 },
        fovIntent: 48,
        depthBias: -0.15,
        weight: 1,
      },
    });

    director.register(about.scene);
    await director.preload(ABOUT_SCENE_ID);
    director.activate(ABOUT_SCENE_ID, "replace");
    anchors.set("manifesto", { top: -6_000, bottom: -5_000 });
    anchors.set(ABOUT_SCENE_ANCHOR_ID, { top: -3_801, bottom: 199 });
    scheduler.start();
    frame.start();

    runFrameCycles(callbacks, [16]);
    expect(registry.getState(ABOUT_SCENE_ID)?.cached).toBe(true);
    expect(director.getCameraIntent()).toEqual(GLOBAL_IDLE_CAMERA_INTENT);
    expect(director.transitionSnapshot.cameraIntentSceneId).toBe("global-idle");

    frame.stop();
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
    director.disposeAll();
    director.destroy();
  });

  it("keeps a dominant About intent while Books enters only its preload range", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const anchors = createInterludeAnchorTracker(1_000);
    const aboutIntent: CameraIntent = {
      target: { x: -1, y: 0, z: -8 },
      positionOffset: { x: 0, y: 0, z: 0.35 },
      fovIntent: 48,
      depthBias: -0.15,
      weight: 1,
    };
    const about = createMockSceneWithProgress(ABOUT_SCENE_ID, {
      sceneType: "about",
      anchorId: ABOUT_SCENE_ANCHOR_ID,
      cameraIntent: aboutIntent,
    });
    const books = createMockSceneWithProgress("books-scene", {
      sceneType: "books",
      anchorId: "books",
      cameraIntent: {
        target: { x: 2.4, y: 0, z: -8 },
        positionOffset: { x: 0, y: 0, z: 0.35 },
        fovIntent: 48,
        depthBias: -0.15,
        weight: 1,
      },
      visualReady: false,
    });
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      domTracker: anchors.tracker,
      booksVisualReadyResolver: () => books.state.visualReady,
    });
    const { callbacks, requestAnimationFrame, cancelAnimationFrame } =
      makeRafMocks();

    director.register(about.scene);
    director.register(books.scene);
    await director.preload(ABOUT_SCENE_ID);
    director.activate(ABOUT_SCENE_ID, "replace");
    anchors.set("manifesto", { top: -1_500, bottom: -500 });
    anchors.set(ABOUT_SCENE_ANCHOR_ID, {
      top: -500,
      bottom: 2_500,
    });
    anchors.set("quote", { top: 1_100, bottom: 1_500 });
    anchors.set("books", { top: 1_500, bottom: 5_500 });
    scheduler.start();
    frame.start();

    runFrameCycles(callbacks, [16]);
    expect(registry.getState(ABOUT_SCENE_ID)?.dominant).toBe(true);
    expect(director.getCameraIntent()).toEqual({
      sceneId: ABOUT_SCENE_ID,
      intent: aboutIntent,
    });

    frame.stop();
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
    director.disposeAll();
    director.destroy();
  });

  it("keeps News and Quote DOM-only on global-idle while preloading Books at the policy boundary", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const anchors = createInterludeAnchorTracker(1_000);
    const books = createMockSceneWithProgress("books-scene", {
      sceneType: "books",
      anchorId: "books",
      cameraIntent: {
        target: { x: 2.4, y: 0, z: -8 },
        positionOffset: { x: 0, y: 0, z: 0.35 },
        fovIntent: 48,
        depthBias: -0.15,
        weight: 1,
      },
      visualReady: false,
    });
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      domTracker: anchors.tracker,
      quoteBooksPolicy: {
        quoteAnchorId: "quote",
        booksAnchorId: "books",
        preloadViewportDistance: 1.5,
        activationCoreTop: 0.2,
        activationCoreBottom: 0.8,
        cacheBeforeTop: 0.8,
        cacheAfterBottom: 0.2,
      },
      booksVisualReadyResolver: () => books.state.visualReady,
    });
    const { callbacks, requestAnimationFrame, cancelAnimationFrame } =
      makeRafMocks();
    director.register(books.scene);
    anchors.set("manifesto", { top: -6_000, bottom: -5_000 });
    anchors.set("about", { top: -4_000, bottom: -1 });
    anchors.set("news", { top: 100, bottom: 900 });
    anchors.set("quote", { top: 900, bottom: 1_500 });
    anchors.set("books", { top: 1_501, bottom: 5_501 });
    scheduler.start();
    frame.start();

    runFrameCycles(callbacks, [16]);
    await Promise.resolve();
    expect(registry.getDescriptor("news")).toBeNull();
    expect(registry.getDescriptor("quote")).toBeNull();
    expect(registry.getState("books-scene")?.resident).toBe(false);
    expect(director.getCameraIntent()).toEqual(GLOBAL_IDLE_CAMERA_INTENT);

    anchors.set("books", { top: 1_500, bottom: 5_500 });
    runFrameCycles(callbacks, [32]);
    await Promise.resolve();

    expect(books.lifecycle.preload).toHaveBeenCalledTimes(1);
    expect(registry.getState("books-scene")).toMatchObject({
      resident: true,
      visible: false,
      dominant: false,
      cached: false,
    });
    expect(director.getCameraIntent()).toEqual(GLOBAL_IDLE_CAMERA_INTENT);

    frame.stop();
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
    director.disposeAll();
    director.destroy();
  });

  it("keeps a preload-only Books reverse safe and reactivates without duplicate acquisition", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const anchors = createInterludeAnchorTracker(1_000);
    const booksIntent: CameraIntent = {
      target: { x: 2.4, y: 0, z: -8 },
      positionOffset: { x: 0, y: 0, z: 0.35 },
      fovIntent: 48,
      depthBias: -0.15,
      weight: 1,
    };
    const books = createMockSceneWithProgress("books-scene", {
      sceneType: "books",
      anchorId: "books",
      cameraIntent: booksIntent,
      visualReady: false,
    });
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      domTracker: anchors.tracker,
      booksVisualReadyResolver: () => books.state.visualReady,
    });
    const { callbacks, requestAnimationFrame, cancelAnimationFrame } =
      makeRafMocks();

    director.register(books.scene);
    anchors.set("manifesto", { top: -6_000, bottom: -5_000 });
    anchors.set("about", { top: -4_000, bottom: -1 });
    anchors.set("quote", { top: 900, bottom: 1_500 });
    anchors.set("books", { top: 1_500, bottom: 5_500 });
    scheduler.start();
    frame.start();

    runFrameCycles(callbacks, [16]);
    await Promise.resolve();
    expect(books.lifecycle.preload).toHaveBeenCalledTimes(1);
    expect(registry.getState("books-scene")).toMatchObject({
      resident: true,
      visible: false,
      updating: false,
      dominant: false,
      cached: false,
    });

    anchors.set("books", { top: 1_501, bottom: 5_501 });
    runFrameCycles(callbacks, [32]);
    expect(registry.getState("books-scene")).toMatchObject({
      resident: true,
      visible: false,
      updating: false,
      dominant: false,
      cached: false,
    });
    expect(books.lifecycle.preload).toHaveBeenCalledTimes(1);
    expect(director.getCameraIntent()).toEqual(GLOBAL_IDLE_CAMERA_INTENT);

    books.setVisualReady(true);
    anchors.set("books", { top: 800, bottom: 4_800 });
    runFrameCycles(callbacks, [48]);
    expect(registry.getState("books-scene")).toMatchObject({
      resident: true,
      visible: true,
      updating: true,
      dominant: true,
      cached: false,
    });
    expect(books.lifecycle.preload).toHaveBeenCalledTimes(1);
    expect(books.lifecycle.activate).toHaveBeenCalledTimes(1);
    expect(director.getCameraIntent()).toEqual({
      sceneId: "books-scene",
      intent: booksIntent,
    });

    frame.stop();
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
    director.disposeAll();
    director.destroy();
  });

  it("gates Books dominance on all-cover readiness and restores global-idle on reverse in the same frame", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const anchors = createInterludeAnchorTracker(1_000);
    const booksIntent: CameraIntent = {
      target: { x: 2.4, y: 0, z: -8 },
      positionOffset: { x: 0, y: 0, z: 0.35 },
      fovIntent: 48,
      depthBias: -0.15,
      weight: 1,
    };
    const books = createMockSceneWithProgress("books-scene", {
      sceneType: "books",
      anchorId: "books",
      cameraIntent: booksIntent,
      visualReady: false,
    });
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      domTracker: anchors.tracker,
      booksVisualReadyResolver: () => books.state.visualReady,
    });
    const { callbacks, requestAnimationFrame, cancelAnimationFrame } =
      makeRafMocks();
    director.register(books.scene);
    await director.preload("books-scene");
    anchors.set("manifesto", { top: -6_000, bottom: -5_000 });
    anchors.set("about", { top: -4_000, bottom: -1 });
    anchors.set("quote", { top: -100, bottom: 500 });
    anchors.set("books", { top: 800, bottom: 4_800 });
    scheduler.start();
    frame.start();

    runFrameCycles(callbacks, [16]);
    expect(registry.getState("books-scene")).toMatchObject({
      resident: true,
      visible: false,
      dominant: false,
      cached: false,
    });
    expect(director.getCameraIntent()).toEqual(GLOBAL_IDLE_CAMERA_INTENT);

    books.setVisualReady(true);
    runFrameCycles(callbacks, [32]);
    expect(registry.getState("books-scene")).toMatchObject({
      resident: true,
      visible: true,
      updating: true,
      dominant: true,
      cached: false,
    });
    expect(books.lifecycle.update).toHaveBeenCalled();
    expect(director.getCameraIntent()).toEqual({
      sceneId: "books-scene",
      intent: booksIntent,
    });

    anchors.set("books", { top: 801, bottom: 4_801 });
    runFrameCycles(callbacks, [48]);
    expect(registry.getState("books-scene")?.cached).toBe(true);
    expect(director.getCameraIntent()).toEqual(GLOBAL_IDLE_CAMERA_INTENT);

    anchors.set("books", { top: 800, bottom: 4_800 });
    runFrameCycles(callbacks, [64]);
    expect(registry.getState("books-scene")?.dominant).toBe(true);
    expect(books.lifecycle.preload).toHaveBeenCalledTimes(1);
    expect(books.lifecycle.activate).toHaveBeenCalledTimes(2);
    expect(director.getCameraIntent()?.sceneId).toBe("books-scene");

    frame.stop();
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
    director.disposeAll();
    director.destroy();
  });

  it("resolves cached fast Books jumps and reduced-motion selection without replaying intermediate lifecycle states", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const snapshot = new MotionSnapshotStore();
    snapshot.setReducedMotion(true);
    const scheduler = new RenderScheduler(frame);
    const registry = new SceneRegistry();
    const anchors = createInterludeAnchorTracker(1_000);
    const books = createMockSceneWithProgress("books-scene", {
      sceneType: "books",
      anchorId: "books",
      cameraIntent: {
        target: { x: 2.4, y: 0, z: -8 },
        positionOffset: { x: 0, y: 0, z: 0.35 },
        fovIntent: 48,
        depthBias: -0.15,
        weight: 1,
      },
      visualReady: true,
    });
    const director = new SceneDirector({
      registry,
      scheduler,
      snapshot,
      domTracker: anchors.tracker,
      booksVisualReadyResolver: () => books.state.visualReady,
    });
    const { callbacks, requestAnimationFrame, cancelAnimationFrame } =
      makeRafMocks();
    director.register(books.scene);
    await director.preload("books-scene");
    director.cache("books-scene");
    anchors.set("manifesto", { top: -6_000, bottom: -5_000 });
    anchors.set("about", { top: -4_000, bottom: -1 });
    anchors.set("quote", { top: -100, bottom: 500 });
    anchors.set("books", { top: 500, bottom: 4_500 });
    scheduler.start();
    frame.start();

    runFrameCycles(callbacks, [16]);
    expect(registry.getState("books-scene")?.dominant).toBe(true);
    expect(director.getCameraIntent()?.sceneId).toBe("books-scene");

    anchors.set("books", { top: 1_200, bottom: 5_200 });
    runFrameCycles(callbacks, [32]);
    expect(registry.getState("books-scene")?.cached).toBe(true);
    expect(director.getCameraIntent()).toEqual(GLOBAL_IDLE_CAMERA_INTENT);

    frame.stop();
    requestAnimationFrame.mockRestore();
    cancelAnimationFrame.mockRestore();
    director.disposeAll();
    director.destroy();
  });
});

function createInterludeAnchorTracker(viewportHeight: number): {
  readonly tracker: {
    getSnapshot(id: string): DOMTrackerWorldSnapshot | null;
  };
  readonly set: (
    id: string,
    bounds: { readonly top: number; readonly bottom: number },
  ) => void;
} {
  const bounds = new Map<string, { readonly top: number; readonly bottom: number }>();
  return {
    tracker: {
      getSnapshot(id: string): DOMTrackerWorldSnapshot | null {
        const current = bounds.get(id);
        if (!current) {
          return null;
        }

        return {
          id,
          element: document.createElement("section"),
          left: 0,
          top: current.top,
          right: 1_000,
          bottom: current.bottom,
          width: 1_000,
          height: current.bottom - current.top,
          scrollY: 0,
          updatedAt: 0,
          capturedAtBreakpoint: "desktop",
          viewport: {
            width: 1_440,
            height: viewportHeight,
            devicePixelRatio: 1,
          },
          worldTop: {
            point: { x: 0, y: 0, z: -8 },
            screen: { x: 500, y: current.top },
          },
          worldCenter: {
            point: { x: 0, y: 0, z: -8 },
            screen: { x: 500, y: (current.top + current.bottom) / 2 },
          },
          worldBottom: {
            point: { x: 0, y: 0, z: -8 },
            screen: { x: 500, y: current.bottom },
          },
          worldLeft: {
            point: { x: 0, y: 0, z: -8 },
            screen: { x: 0, y: (current.top + current.bottom) / 2 },
          },
          worldRight: {
            point: { x: 0, y: 0, z: -8 },
            screen: { x: 1_000, y: (current.top + current.bottom) / 2 },
          },
          relativeScroll: 0,
        };
      },
    },
    set(id, nextBounds): void {
      bounds.set(id, nextBounds);
    },
  };
}

