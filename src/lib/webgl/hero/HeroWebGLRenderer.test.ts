import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import MotionSnapshotStore from "@/lib/motion/MotionSnapshotStore";
import FrameCoordinator from "@/lib/motion/FrameCoordinator";
import MotionBus from "@/lib/motion/MotionBus";
import AssetRegistry from "@/lib/webgl/AssetRegistry";
import RenderScheduler from "@/lib/webgl/RenderScheduler";
import HeroWebGLRenderer from "@/lib/webgl/hero/HeroWebGLRenderer";
import type { HeroSceneState } from "@/lib/webgl/hero/HeroScene";
import { heroSceneConfig } from "@/lib/webgl/hero/heroSceneConfig";
import CameraRig from "@/lib/webgl/CameraRig";

vi.mock("@/lib/webgl/hero/HeroForegroundRegistration", () => ({
  resolveHeroForegroundRegistrationLayout: (input: {
    portraitMesh: {
      position: { x: number; y: number; z: number };
      scale: { x: number; y: number; z: number };
    };
    crop: { uMin: number; uMax: number; vMin: number; vMax: number };
    relativeTranslateXpx: number;
    relativeTranslateYpx: number;
    relativeScale: number;
  }) => ({
    position: {
      x: input.portraitMesh.position.x + input.relativeTranslateXpx * 0.001,
      y: input.portraitMesh.position.y - input.relativeTranslateYpx * 0.001,
      z: input.portraitMesh.position.z + 0.01,
    },
    scale: {
      x:
        input.portraitMesh.scale.x *
        (input.crop.uMax - input.crop.uMin) *
        input.relativeScale,
      y:
        input.portraitMesh.scale.y *
        (input.crop.vMax - input.crop.vMin) *
        input.relativeScale,
      z: 1,
    },
    expectedScreenRect: {
      left: 0,
      right: 1,
      top: 0,
      bottom: 1,
      center: { x: 0.5, y: 0.5 },
      width: 1,
      height: 1,
    },
    cropWorldCenter: { x: 0, y: 0, z: 0 },
    depthScale: 1,
  }),
  projectMeshLocalRect: () => ({
    left: 0,
    right: 1,
    top: 0,
    bottom: 1,
    center: { x: 0.5, y: 0.5 },
    width: 1,
    height: 1,
  }),
}));

vi.mock("three", () => {
  const globalScope = globalThis as {
    __mockPerspectiveCameraCalls?: number;
    __mockWebGLRendererCalls?: number;
  };

  globalScope.__mockPerspectiveCameraCalls = 0;
  globalScope.__mockWebGLRendererCalls = 0;

  class MockWebGLRenderer {
    info: {
      memory: { textures: number; geometries: number };
      render: { calls: number };
      reset: ReturnType<typeof vi.fn>;
    };

    autoClear = false;
    setClearColor = vi.fn();
    setPixelRatio = vi.fn();
    setClearAlpha = vi.fn();
    setSize = vi.fn();
    render = vi.fn();
    clear = vi.fn();
    dispose = vi.fn();

    constructor() {
      const rendererCalls = globalScope.__mockWebGLRendererCalls;
      globalScope.__mockWebGLRendererCalls =
        typeof rendererCalls === "number" ? rendererCalls + 1 : 1;
      this.info = {
        memory: {
          textures: 0,
          geometries: 0,
        },
        render: {
          calls: 0,
        },
        reset: vi.fn(),
      };
    }
  }

  class MockScene {
    add = vi.fn();
  }

  class MockPerspectiveCamera {
    fov = 48;
    position: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
    lookAt: ReturnType<typeof vi.fn>;
    updateProjectionMatrix: ReturnType<typeof vi.fn>;
    updateMatrixWorld: ReturnType<typeof vi.fn>;

    constructor() {
      const globalCalls = globalScope.__mockPerspectiveCameraCalls;
      globalScope.__mockPerspectiveCameraCalls = typeof globalCalls === "number" ? globalCalls + 1 : 1;
      this.position = {
        x: 0,
        y: 0,
        z: 0,
        set: (x: number, y: number, z: number): void => {
          this.position.x = x;
          this.position.y = y;
          this.position.z = z;
        },
      };
      this.lookAt = vi.fn();
      this.updateProjectionMatrix = vi.fn();
      this.updateMatrixWorld = vi.fn();
    }
  }

  class MockVector3 {
    x: number;
    y: number;
    z: number;

    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }

    set(x: number, y: number, z: number): this {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }

    copy(source: MockVector3): this {
      this.x = source.x;
      this.y = source.y;
      this.z = source.z;
      return this;
    }

    lerp(target: MockVector3, alpha: number): this {
      this.x += (target.x - this.x) * alpha;
      this.y += (target.y - this.y) * alpha;
      this.z += (target.z - this.z) * alpha;
      return this;
    }

    distanceTo(target: MockVector3): number {
      const dx = this.x - target.x;
      const dy = this.y - target.y;
      const dz = this.z - target.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    project(): this {
      return this;
    }

    unproject(): this {
      return this;
    }
  }

  class MockPlaneGeometry {
    attributes = {
      uv: {
        array: new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]),
        needsUpdate: false,
      },
    };
    dispose = vi.fn();
  }

  class MockMeshBasicMaterial {
    map: unknown = null;
    needsUpdate = false;
    transparent = true;
    opacity = 1;

    constructor(_options?: unknown) {
      void _options;
    }

    dispose = vi.fn();
  }

  class MockMesh {
    geometry: unknown;
    material: unknown;
    position = {
      x: 0,
      y: 0,
      z: 0,
      set: vi.fn((x: number, y: number, z: number) => {
        this.position.x = x;
        this.position.y = y;
        this.position.z = z;
      }),
    };
    scale = {
      x: 1,
      y: 1,
      z: 1,
      set: vi.fn((x: number, y: number, z: number) => {
        this.scale.x = x;
        this.scale.y = y;
        this.scale.z = z;
      }),
    };
    rotation = {
      x: 0,
      y: 0,
      z: 0,
    };

    constructor(geometry: unknown, material: unknown) {
      this.geometry = geometry;
      this.material = material;
    }
  }

  class MockTexture {
    image = null;
    needsUpdate = false;
    colorSpace = null;
    minFilter = null;
    magFilter = null;
    premultiplyAlpha = false;
    wrapS = null;
    wrapT = null;
    dispose = vi.fn();
  }

  return {
    WebGLRenderer: MockWebGLRenderer,
    Scene: MockScene,
    PerspectiveCamera: MockPerspectiveCamera,
    PlaneGeometry: MockPlaneGeometry,
    MeshBasicMaterial: MockMeshBasicMaterial,
    Mesh: MockMesh,
    Texture: MockTexture,
    Vector3: MockVector3,
    MathUtils: {
      degToRad: (value: number): number => (value * Math.PI) / 180,
    },
    LinearFilter: 1,
    ClampToEdgeWrapping: 2,
    DoubleSide: 2,
    SRGBColorSpace: 3000,
  };
});

type MockContext = {
  readonly canvas: HTMLCanvasElement;
  createTexture: ReturnType<typeof vi.fn>;
  deleteTexture: ReturnType<typeof vi.fn>;
  bindTexture: ReturnType<typeof vi.fn>;
  texParameteri: ReturnType<typeof vi.fn>;
  texImage2D: ReturnType<typeof vi.fn>;
  pixelStorei: ReturnType<typeof vi.fn>;
  viewport: ReturnType<typeof vi.fn>;
  TEXTURE_2D: number;
  TEXTURE_WRAP_S: number;
  TEXTURE_WRAP_T: number;
  TEXTURE_MIN_FILTER: number;
  TEXTURE_MAG_FILTER: number;
  CLAMP_TO_EDGE: number;
  UNSIGNED_BYTE: number;
  RGBA: number;
  UNPACK_PREMULTIPLY_ALPHA_WEBGL: number;
};

describe("HeroWebGLRenderer", () => {
  const bus = new MotionBus();
  const frame = new FrameCoordinator(bus);
  const scheduler = new RenderScheduler(frame);

  const getPerspectiveCameraCalls = (): number =>
    (globalThis as { __mockPerspectiveCameraCalls?: number }).__mockPerspectiveCameraCalls ?? 0;

  const getWebGLRendererCalls = (): number =>
    (globalThis as { __mockWebGLRendererCalls?: number }).__mockWebGLRendererCalls ?? 0;

  const createContext = (): MockContext => {
    const canvas = document.createElement("canvas");
    return {
      canvas,
      createTexture: vi.fn(() => ({} as unknown as WebGLTexture)),
      deleteTexture: vi.fn(),
      bindTexture: vi.fn(),
      texParameteri: vi.fn(),
      texImage2D: vi.fn(),
      pixelStorei: vi.fn(),
      viewport: vi.fn(),
      TEXTURE_2D: 3553,
      TEXTURE_WRAP_S: 10242,
      TEXTURE_WRAP_T: 10243,
      TEXTURE_MIN_FILTER: 10241,
      TEXTURE_MAG_FILTER: 10240,
      CLAMP_TO_EDGE: 33071,
      UNSIGNED_BYTE: 5121,
      RGBA: 6408,
      UNPACK_PREMULTIPLY_ALPHA_WEBGL: 37440,
    };
  };

  const createHeroState = (): HeroSceneState => ({
    isActive: true,
    isAnchored: true,
    isCached: false,
    isDisposed: false,
    anchorWorld: {
      x: 0,
      y: 0,
      z: -8,
    },
    anchorViewport: {
      x: 420,
      y: 540,
    },
    relativeScroll: 0,
    chapterProgress: 0.4,
    phase: "hold",
    transform: {
      translateX: 0,
      translateY: 0,
      rotateX: 0,
      rotateY: 0,
      opacity: 1,
      scale: 1,
    },
    foregroundTransform: {
      translateX: 0,
      translateY: 0,
      rotateX: 0,
      rotateY: 0,
      opacity: 1,
      scale: 1,
    },
  });

  const createRegistryReadyAsset = (src: string): AssetRegistry<HTMLImageElement> => {
    const registry = new AssetRegistry<HTMLImageElement>();
    registry.register({
      id: heroSceneConfig.portraitAssetId,
      src,
      kind: "image",
    }, {
      src,
      naturalWidth: 960,
      naturalHeight: 1280,
    } as HTMLImageElement);
    registry.setState(heroSceneConfig.portraitAssetId, "ready");

    return registry;
  };

  beforeEach(() => {
    (globalThis as { __mockPerspectiveCameraCalls?: number }).__mockPerspectiveCameraCalls = 0;
    (globalThis as { __mockWebGLRendererCalls?: number }).__mockWebGLRendererCalls = 0;
    vi.clearAllMocks();
  });

  it("uses the injected global renderer without clearing, resizing, or disposing it", () => {
    const assetRegistry = new AssetRegistry<HTMLImageElement>();
    const snapshot = new MotionSnapshotStore();
    snapshot.updateViewport({
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      isPortrait: false,
    });

    const image = {
      src: heroSceneConfig.portraitAssetSources.desktop,
      naturalWidth: 1024,
      naturalHeight: 1536,
    } as HTMLImageElement;
    assetRegistry.register(
      {
        id: heroSceneConfig.portraitAssetId,
        src: heroSceneConfig.portraitAssetSources.desktop,
        kind: "image",
      },
      image,
    );
    assetRegistry.setState(heroSceneConfig.portraitAssetId, "ready");

    const context = createContext();
    const sharedRenderer = new THREE.WebGLRenderer({
      canvas: context.canvas,
      context: context as unknown as WebGLRenderingContext,
    });
    const cameraRig = new CameraRig();
    const renderer = new HeroWebGLRenderer({
      canvas: context.canvas,
      context: context as unknown as WebGLRenderingContext,
      renderer: sharedRenderer,
      snapshot,
      assetRegistry,
      config: heroSceneConfig,
      scheduler,
      getHeroState: createHeroState,
      camera: cameraRig.camera,
    });

    renderer.render();
    renderer.dispose();

    expect(getWebGLRendererCalls()).toBe(1);
    expect(sharedRenderer.render).toHaveBeenCalledTimes(1);
    expect(sharedRenderer.clear).not.toHaveBeenCalled();
    expect(sharedRenderer.setSize).not.toHaveBeenCalled();
    expect(sharedRenderer.setPixelRatio).not.toHaveBeenCalled();
    expect(context.viewport).not.toHaveBeenCalled();
    expect(sharedRenderer.dispose).not.toHaveBeenCalled();
  });

  it("uses shared CameraRig camera without creating an additional local camera", () => {
    const snapshot = new MotionSnapshotStore();
    snapshot.updateViewport({
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      isPortrait: false,
    });

    const registry = createRegistryReadyAsset(heroSceneConfig.portraitAssetSources.desktop);
    const context = createContext();
    const cameraRig = new CameraRig();
    expect(getPerspectiveCameraCalls()).toBe(1);

    const renderer = new HeroWebGLRenderer({
      canvas: context.canvas,
      context: context as unknown as WebGLRenderingContext,
      renderer: new THREE.WebGLRenderer({
        canvas: context.canvas,
        context: context as unknown as WebGLRenderingContext,
      }),
      snapshot,
      assetRegistry: registry,
      config: heroSceneConfig,
      camera: cameraRig.camera,
      scheduler: scheduler,
      getHeroState: createHeroState,
    });

    expect(getPerspectiveCameraCalls()).toBe(1);
    expect(renderer).toBeTruthy();
    renderer.dispose();
  });

  it("creates portrait texture once when asset is ready", () => {
    const snapshot = new MotionSnapshotStore();
    snapshot.updateViewport({
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      isPortrait: false,
    });

    const registry = createRegistryReadyAsset(heroSceneConfig.portraitAssetSources.desktop);
    const context = createContext();
    const cameraRig = new CameraRig();
    const renderer = new HeroWebGLRenderer({
      canvas: context.canvas,
      context: context as unknown as WebGLRenderingContext,
      renderer: new THREE.WebGLRenderer({
        canvas: context.canvas,
        context: context as unknown as WebGLRenderingContext,
      }),
      snapshot,
      assetRegistry: registry,
      config: heroSceneConfig,
      camera: cameraRig.camera,
      scheduler: scheduler,
      getHeroState: createHeroState,
    });

    const createTexture = vi.mocked(context.createTexture);
    renderer.render();
    renderer.render();

    expect(createTexture).toHaveBeenCalledTimes(1);
    expect(renderer.resourceSnapshot.byKind.texture).toBe(1);
    expect(
      renderer.resourceSnapshot.ownerCounts[`texture:${heroSceneConfig.portraitAssetSources.desktop}`],
    ).toBe(1);
    renderer.dispose();
  });

  it("does not re-upload a stable portrait texture on every frame", () => {
    const snapshot = new MotionSnapshotStore();
    snapshot.updateViewport({
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      isPortrait: false,
    });
    const registry = createRegistryReadyAsset(heroSceneConfig.portraitAssetSources.desktop);
    const context = createContext();
    const renderer = new HeroWebGLRenderer({
      canvas: context.canvas,
      context: context as unknown as WebGLRenderingContext,
      renderer: new THREE.WebGLRenderer({
        canvas: context.canvas,
        context: context as unknown as WebGLRenderingContext,
      }),
      snapshot,
      assetRegistry: registry,
      config: heroSceneConfig,
      camera: new CameraRig().camera,
      scheduler,
      getHeroState: createHeroState,
    });

    renderer.render();
    const rendererInternal = renderer as unknown as {
      textureCache: { needsUpdate: boolean };
    };
    rendererInternal.textureCache.needsUpdate = false;

    renderer.render();

    expect(rendererInternal.textureCache.needsUpdate).toBe(false);
    renderer.dispose();
  });

  it("creates foreground mesh and keeps portrait/foreground sharing the same texture owner", () => {
    const snapshot = new MotionSnapshotStore();
    snapshot.updateViewport({
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      isPortrait: false,
    });

    const registry = createRegistryReadyAsset(heroSceneConfig.portraitAssetSources.desktop);
    const context = createContext();
    const cameraRig = new CameraRig();
    const renderer = new HeroWebGLRenderer({
      canvas: context.canvas,
      context: context as unknown as WebGLRenderingContext,
      renderer: new THREE.WebGLRenderer({
        canvas: context.canvas,
        context: context as unknown as WebGLRenderingContext,
      }),
      snapshot,
      assetRegistry: registry,
      config: heroSceneConfig,
      camera: cameraRig.camera,
      scheduler: scheduler,
      getHeroState: createHeroState,
    });

    const rendererInternal = renderer as unknown as {
      scene: { add: ReturnType<typeof vi.fn> };
      portraitMaterial: { map: unknown };
      foregroundMaterial: { map: unknown };
    };
    expect(rendererInternal.scene.add).toHaveBeenCalledTimes(2);

    renderer.render();

    expect(renderer.resourceSnapshot.byKind.texture).toBe(1);
    expect(
      renderer.resourceSnapshot.ownerCounts[`texture:${heroSceneConfig.portraitAssetSources.desktop}`],
    ).toBe(1);
    expect(rendererInternal.portraitMaterial.map).toBe(rendererInternal.foregroundMaterial.map);

    expect(
      renderer.resourceSnapshot.ownerCounts[`geometry:${heroSceneConfig.id}:foreground:geometry`],
    ).toBe(1);
    expect(
      renderer.resourceSnapshot.ownerCounts[`material:${heroSceneConfig.id}:foreground:material`],
    ).toBe(1);

    renderer.dispose();
  });

  it("releases portrait resources on dispose", () => {
    const snapshot = new MotionSnapshotStore();
    snapshot.updateViewport({
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      isPortrait: false,
    });

    const registry = createRegistryReadyAsset(heroSceneConfig.portraitAssetSources.desktop);
    const context = createContext();
    const cameraRig = new CameraRig();
    const renderer = new HeroWebGLRenderer({
      canvas: context.canvas,
      context: context as unknown as WebGLRenderingContext,
      renderer: new THREE.WebGLRenderer({
        canvas: context.canvas,
        context: context as unknown as WebGLRenderingContext,
      }),
      snapshot,
      assetRegistry: registry,
      config: heroSceneConfig,
      camera: cameraRig.camera,
      scheduler: scheduler,
      getHeroState: () => ({
        isActive: true,
        isAnchored: true,
        isCached: false,
        isDisposed: false,
        anchorWorld: null,
        anchorViewport: {
          x: 420,
          y: 540,
        },
        relativeScroll: 0,
        chapterProgress: 0.4,
        phase: "hold",
        transform: {
          translateX: 0,
          translateY: 0,
          rotateX: 0,
          rotateY: 0,
          opacity: 1,
          scale: 1,
        },
        foregroundTransform: {
          translateX: 0,
          translateY: 0,
          rotateX: 0,
          rotateY: 0,
          opacity: 1,
          scale: 1,
        },
      }),
    });

    renderer.render();

    const deleteTexture = vi.mocked(context.deleteTexture);
    renderer.dispose();

    expect(deleteTexture).toHaveBeenCalledTimes(1);
    expect(
      renderer.resourceSnapshot.ownerCounts[`texture:${heroSceneConfig.portraitAssetSources.desktop}`],
    ).toBe(0);
    expect(renderer.resourceSnapshot.ownerCounts[`geometry:${heroSceneConfig.id}:geometry`]).toBe(0);
    expect(renderer.resourceSnapshot.ownerCounts[`material:${heroSceneConfig.id}:material`]).toBe(0);
  });

  it("releases foreground resources together with shared texture on dispose", () => {
    const snapshot = new MotionSnapshotStore();
    snapshot.updateViewport({
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      isPortrait: false,
    });

    const registry = createRegistryReadyAsset(heroSceneConfig.portraitAssetSources.desktop);
    const context = createContext();
    const cameraRig = new CameraRig();
    const deleteTexture = vi.mocked(context.deleteTexture);
    const renderer = new HeroWebGLRenderer({
      canvas: context.canvas,
      context: context as unknown as WebGLRenderingContext,
      renderer: new THREE.WebGLRenderer({
        canvas: context.canvas,
        context: context as unknown as WebGLRenderingContext,
      }),
      snapshot,
      assetRegistry: registry,
      config: heroSceneConfig,
      camera: cameraRig.camera,
      scheduler: scheduler,
      getHeroState: createHeroState,
    });

    renderer.render();
    renderer.dispose();

    expect(deleteTexture).toHaveBeenCalledTimes(1);
    expect(renderer.resourceSnapshot.ownerCounts[`texture:${heroSceneConfig.portraitAssetSources.desktop}`]).toBe(
      0,
    );
    expect(renderer.resourceSnapshot.ownerCounts[`geometry:${heroSceneConfig.id}:geometry`]).toBe(0);
    expect(renderer.resourceSnapshot.ownerCounts[`geometry:${heroSceneConfig.id}:foreground:geometry`]).toBe(0);
    expect(renderer.resourceSnapshot.ownerCounts[`material:${heroSceneConfig.id}:material`]).toBe(0);
    expect(renderer.resourceSnapshot.ownerCounts[`material:${heroSceneConfig.id}:foreground:material`]).toBe(0);
  });

  it("applies distinct portrait and foreground layer transforms", () => {
    const snapshot = new MotionSnapshotStore();
    snapshot.updateViewport({
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      isPortrait: false,
    });

    const registry = createRegistryReadyAsset(heroSceneConfig.portraitAssetSources.desktop);
    const context = createContext();
    const cameraRig = new CameraRig();
    const baseState = createHeroState();
    const state: HeroSceneState = {
      ...baseState,
      transform: {
        ...baseState.transform,
        translateX: 10,
        translateY: -5,
        scale: 0.9,
      },
      foregroundTransform: {
        ...baseState.transform,
        translateX: 22,
        translateY: -8,
        scale: 1.15,
      },
    };

    const renderer = new HeroWebGLRenderer({
      canvas: context.canvas,
      context: context as unknown as WebGLRenderingContext,
      renderer: new THREE.WebGLRenderer({
        canvas: context.canvas,
        context: context as unknown as WebGLRenderingContext,
      }),
      snapshot,
      assetRegistry: registry,
      config: heroSceneConfig,
      camera: cameraRig.camera,
      scheduler: scheduler,
      getHeroState: () => state,
    });

    const rendererInternal = renderer as unknown as {
      portraitMesh: { position: { set: ReturnType<typeof vi.fn> }; scale: { set: ReturnType<typeof vi.fn> } };
      foregroundMesh: { position: { set: ReturnType<typeof vi.fn> }; scale: { set: ReturnType<typeof vi.fn> } };
    };

    renderer.render();

    const portraitPositionCall = rendererInternal.portraitMesh.position.set.mock.calls.at(-1);
    const foregroundPositionCall = rendererInternal.foregroundMesh.position.set.mock.calls.at(-1);
    const portraitScaleCall = rendererInternal.portraitMesh.scale.set.mock.calls.at(-1);
    const foregroundScaleCall = rendererInternal.foregroundMesh.scale.set.mock.calls.at(-1);

    expect(portraitPositionCall?.[0]).not.toBeUndefined();
    expect(foregroundPositionCall?.[0]).not.toBeUndefined();
    expect(foregroundPositionCall?.[0]).not.toBe(portraitPositionCall?.[0]);
    expect(portraitPositionCall?.[2]).toBeCloseTo(-8);
    expect(foregroundPositionCall?.[2]).toBeGreaterThan(portraitPositionCall?.[2] ?? 0);
    expect(portraitScaleCall?.[0]).toBeLessThan(20);
    expect(portraitScaleCall?.[1]).toBeLessThan(20);
    expect(foregroundScaleCall?.[0]).toBeGreaterThan(0);
    expect(foregroundScaleCall?.[0]).toBeLessThan(portraitScaleCall?.[0] ?? 0);
    expect(foregroundScaleCall?.[1]).toBeGreaterThan(0);
    expect(foregroundScaleCall?.[1]).toBeLessThan(portraitScaleCall?.[1] ?? 0);
    renderer.dispose();
  });

  it("maps a top-left manifest crop upright and sizes it to the source subregion", () => {
    const snapshot = new MotionSnapshotStore();
    snapshot.updateViewport({
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      isPortrait: false,
    });

    const registry = new AssetRegistry<HTMLImageElement>();
    const image = {
      src: heroSceneConfig.portraitAssetSources.desktop,
      naturalWidth: 1024,
      naturalHeight: 1536,
    } as HTMLImageElement;
    registry.register({
      id: heroSceneConfig.portraitAssetId,
      src: heroSceneConfig.portraitAssetSources.desktop,
      kind: "image",
    }, image);
    registry.setState(heroSceneConfig.portraitAssetId, "ready");

    const context = createContext();
    const cameraRig = new CameraRig();
    const renderer = new HeroWebGLRenderer({
      canvas: context.canvas,
      context: context as unknown as WebGLRenderingContext,
      renderer: new THREE.WebGLRenderer({
        canvas: context.canvas,
        context: context as unknown as WebGLRenderingContext,
      }),
      snapshot,
      assetRegistry: registry,
      config: heroSceneConfig,
      camera: cameraRig.camera,
      scheduler,
      getHeroState: createHeroState,
    });
    const rendererInternal = renderer as unknown as {
      portraitMesh: { scale: { set: ReturnType<typeof vi.fn> } };
      foregroundMesh: { scale: { set: ReturnType<typeof vi.fn> } };
      foregroundGeometry: {
        attributes: { uv: { array: Float32Array; needsUpdate: boolean } };
      };
    };

    renderer.render();

    const crop = heroSceneConfig.foreground.selectUvRect(1200);
    const expectedUv = [
      crop.uMin,
      1 - crop.vMin,
      crop.uMax,
      1 - crop.vMin,
      crop.uMin,
      1 - crop.vMax,
      crop.uMax,
      1 - crop.vMax,
    ];
    Array.from(rendererInternal.foregroundGeometry.attributes.uv.array).forEach((value, index) => {
      expect(value).toBeCloseTo(expectedUv[index] ?? Number.NaN);
    });
    expect(rendererInternal.foregroundGeometry.attributes.uv.needsUpdate).toBe(true);

    const portraitScale = rendererInternal.portraitMesh.scale.set.mock.calls.at(-1);
    const foregroundScale = rendererInternal.foregroundMesh.scale.set.mock.calls.at(-1);
    const cropWidth = crop.uMax - crop.uMin;
    const cropHeight = crop.vMax - crop.vMin;
    expect(foregroundScale?.[0]).toBeCloseTo(
      (portraitScale?.[0] ?? 0) * cropWidth * heroSceneConfig.foreground.scaleMultiplier,
    );
    expect(foregroundScale?.[1]).toBeCloseTo(
      (portraitScale?.[1] ?? 0) * cropHeight * heroSceneConfig.foreground.scaleMultiplier,
    );

    renderer.dispose();
  });

  it("switches texture source without duplicate GPU ownership or texture rebuild", () => {
    const snapshot = new MotionSnapshotStore();
    snapshot.updateViewport({
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      isPortrait: false,
    });

    const registry = new AssetRegistry<HTMLImageElement>();
    const desktopImage = {
      src: heroSceneConfig.portraitAssetSources.desktop,
      naturalWidth: 960,
      naturalHeight: 1280,
    } as HTMLImageElement;
    const mobileImage = {
      src: heroSceneConfig.portraitAssetSources.mobile,
      naturalWidth: 960,
      naturalHeight: 1280,
    } as HTMLImageElement;

    registry.register({
      id: heroSceneConfig.portraitAssetId,
      src: heroSceneConfig.portraitAssetSources.desktop,
      kind: "image",
    }, desktopImage);
    registry.setState(heroSceneConfig.portraitAssetId, "ready");

    const context = createContext();
    const cameraRig = new CameraRig();
    const state = createHeroState();

    const renderer = new HeroWebGLRenderer({
      canvas: context.canvas,
      context: context as unknown as WebGLRenderingContext,
      renderer: new THREE.WebGLRenderer({
        canvas: context.canvas,
        context: context as unknown as WebGLRenderingContext,
      }),
      snapshot,
      assetRegistry: registry,
      config: heroSceneConfig,
      camera: cameraRig.camera,
      scheduler: scheduler,
      getHeroState: () => state,
    });

    const createTexture = vi.mocked(context.createTexture);
    const deleteTexture = vi.mocked(context.deleteTexture);

    renderer.render();
    renderer.render();

    expect(createTexture).toHaveBeenCalledTimes(1);
    expect(renderer.resourceSnapshot.byKind.texture).toBe(1);
    expect(
      renderer.resourceSnapshot.ownerCounts[`texture:${heroSceneConfig.portraitAssetSources.desktop}`],
    ).toBe(1);

    registry.unregister(heroSceneConfig.portraitAssetId);
    registry.register({
      id: heroSceneConfig.portraitAssetId,
      src: heroSceneConfig.portraitAssetSources.mobile,
      kind: "image",
    }, mobileImage);
    registry.setState(heroSceneConfig.portraitAssetId, "ready");

    renderer.render();

    expect(createTexture).toHaveBeenCalledTimes(2);
    expect(deleteTexture).toHaveBeenCalledTimes(1);
    expect(renderer.resourceSnapshot.ownerCounts[`texture:${heroSceneConfig.portraitAssetSources.desktop}`]).toBe(
      0,
    );
    expect(renderer.resourceSnapshot.ownerCounts[`texture:${heroSceneConfig.portraitAssetSources.mobile}`]).toBe(1);

    renderer.render();
    expect(createTexture).toHaveBeenCalledTimes(2);

    renderer.dispose();
  });
});
