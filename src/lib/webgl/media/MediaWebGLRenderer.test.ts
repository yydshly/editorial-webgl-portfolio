import { beforeEach, describe, expect, it, vi } from "vitest";
import * as THREE from "three";

import FrameCoordinator from "@/lib/motion/FrameCoordinator";
import MotionBus from "@/lib/motion/MotionBus";
import MotionSnapshotStore from "@/lib/motion/MotionSnapshotStore";
import AssetRegistry from "@/lib/webgl/AssetRegistry";
import RenderScheduler from "@/lib/webgl/RenderScheduler";
import MediaWebGLRenderer from "@/lib/webgl/media/MediaWebGLRenderer";
import { mediaSceneConfig } from "@/lib/webgl/media/mediaSceneConfig";
import { MEDIA_MOTION_CONFIG, resolveMediaMotion } from "@/lib/webgl/media/MediaSceneMotion";
import CameraRig from "@/lib/webgl/CameraRig";

vi.mock("three", () => {
  const globalScope = globalThis as {
    __mockPerspectiveCameraCalls?: number;
    __mockWebGLRendererCalls?: number;
    __mediaRendererCreatedScenes?: Array<{
      add: ReturnType<typeof vi.fn>;
    }>;
  };
  const createdScenes: Array<{ add: ReturnType<typeof vi.fn> }> = [];

  globalScope.__mockPerspectiveCameraCalls = 0;
  globalScope.__mockWebGLRendererCalls = 0;
  globalScope.__mediaRendererCreatedScenes = createdScenes;

  class MockWebGLRenderer {
    info: {
      memory: { textures: number; geometries: number };
      render: { calls: number };
      reset: ReturnType<typeof vi.fn>;
    };

    autoClear = false;
    setClearColor = vi.fn();
    setPixelRatio = vi.fn();
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

    constructor() {
      createdScenes.push(this);
    }
  }

  class MockOrthographicCamera {
    left = 0;
    right = 1;
    top = 1;
    bottom = 0;
    position = { z: 0 };
    updateProjectionMatrix = vi.fn();
  }

  class MockPerspectiveCamera {
    fov = 48;
    aspect = 1;
    position: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
    lookAt: ReturnType<typeof vi.fn>;
    updateProjectionMatrix: ReturnType<typeof vi.fn>;
    updateMatrixWorld: ReturnType<typeof vi.fn>;

    constructor() {
      const current = globalScope.__mockPerspectiveCameraCalls;
      globalScope.__mockPerspectiveCameraCalls = typeof current === "number" ? current + 1 : 1;
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

  class MockPlaneGeometry {
    dispose = vi.fn();
  }

  class MockMeshBasicMaterial {
    map = null;
    dispose = vi.fn();
    transparent = true;
    opacity = 1;
    private valueNeedsUpdate = false;
    needsUpdateAssignments = 0;

    get needsUpdate(): boolean {
      return this.valueNeedsUpdate;
    }

    set needsUpdate(value: boolean) {
      this.valueNeedsUpdate = value;
      if (value) {
        this.needsUpdateAssignments += 1;
      }
    }
  }

  class MockMesh {
    geometry: unknown;
    material: unknown;
    position = {
      set: vi.fn(),
    };
    scale = {
      set: vi.fn(),
    };
    rotation = {
      x: 0,
      y: 0,
      z: 0,
    };
    visible = true;
    userData = {};

    constructor(geometry: unknown, material: unknown) {
      this.geometry = geometry;
      this.material = material;
    }
  }

  class MockTexture {
    dispose = vi.fn();
    needsUpdate = false;
    image: HTMLImageElement;
    minFilter = 9729;
    magFilter = 9729;
    generateMipmaps = true;
    anisotropy = 1;
    colorSpace = "";
    premultiplyAlpha = false;
    flipY = true;

    constructor(image: HTMLImageElement) {
      this.image = image;
    }
  }

  return {
    WebGLRenderer: MockWebGLRenderer,
    Scene: MockScene,
    OrthographicCamera: MockOrthographicCamera,
    PerspectiveCamera: MockPerspectiveCamera,
    PlaneGeometry: MockPlaneGeometry,
    MeshBasicMaterial: MockMeshBasicMaterial,
    Mesh: MockMesh,
    Texture: MockTexture,
    Vector3: class MockVector3 {
      x: number;
      y: number;
      z: number;

      constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
      }

      project(): this {
        return this;
      }

      unproject(): this {
        return this;
      }
    },
    DoubleSide: 2,
    ClampToEdgeWrapping: 33071,
    LinearFilter: 9729,
    SRGBColorSpace: "srgb",
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
  activeTexture: ReturnType<typeof vi.fn>;
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

describe("MediaWebGLRenderer", () => {
  const bus = new MotionBus();
  const frame = new FrameCoordinator(bus);
  const scheduler = new RenderScheduler(frame);

  const getPerspectiveCameraCalls = (): number =>
    (globalThis as { __mockPerspectiveCameraCalls?: number }).__mockPerspectiveCameraCalls ?? 0;

  const getWebGLRendererCalls = (): number =>
    (globalThis as { __mockWebGLRendererCalls?: number }).__mockWebGLRendererCalls ?? 0;

  const getCreatedScenes = (): Array<{ add: ReturnType<typeof vi.fn> }> =>
    (globalThis as { __mediaRendererCreatedScenes?: Array<{ add: ReturnType<typeof vi.fn> }> })
      .__mediaRendererCreatedScenes ?? [];

  const createContext = (): MockContext => {
    const canvas = document.createElement("canvas");
    let textureIndex = 0;

    return {
      canvas,
      createTexture: vi.fn(() => ({ id: `texture-${++textureIndex}` } as unknown as WebGLTexture)),
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
      activeTexture: vi.fn(),
    };
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

    const mainImage = {
      src: mediaSceneConfig.main.assetSources.desktop,
    } as HTMLImageElement;
    const secondaryImage = {
      src: mediaSceneConfig.secondary.assetSources.desktop,
    } as HTMLImageElement;
    assetRegistry.register(
      {
        id: mediaSceneConfig.main.assetId,
        src: mediaSceneConfig.main.assetSources.desktop,
        kind: "image",
      },
      mainImage,
    );
    assetRegistry.register(
      {
        id: mediaSceneConfig.secondary.assetId,
        src: mediaSceneConfig.secondary.assetSources.desktop,
        kind: "image",
      },
      secondaryImage,
    );
    assetRegistry.setState(mediaSceneConfig.main.assetId, "ready");
    assetRegistry.setState(mediaSceneConfig.secondary.assetId, "ready");

    const context = createContext();
    const sharedRenderer = new THREE.WebGLRenderer({
      canvas: context.canvas,
      context: context as unknown as WebGLRenderingContext,
    });
    const cameraRig = new CameraRig();
    const mediaState = createMediaState({
      isActive: true,
      phase: "hold",
      mainTransform: MEDIA_MOTION_CONFIG.main.holdPose,
      secondaryTransform: MEDIA_MOTION_CONFIG.secondary.holdPose,
    });
    const renderer = new MediaWebGLRenderer({
      canvas: context.canvas,
      context: context as unknown as WebGLRenderingContext,
      renderer: sharedRenderer,
      snapshot,
      assetRegistry,
      scheduler,
      getMediaState: () => mediaState,
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

  const createMediaState = (input: {
    isActive: boolean;
    phase: "enter" | "hold" | "depart";
    mainTransform: {
      translateX: number;
      translateY: number;
      scale: number;
      opacity: number;
    };
    secondaryTransform: {
      translateX: number;
      translateY: number;
      scale: number;
      opacity: number;
    };
    mainAssetReady?: boolean;
    secondaryAssetReady?: boolean;
  }) => {
    const mainReady = input.mainAssetReady ?? true;
    const secondaryReady = input.secondaryAssetReady ?? true;

    return {
      isActive: input.isActive,
      isAnchored: true,
      isCached: !input.isActive,
      visualReady: true,
      isDisposed: false,
      mediaProgress: 0,
      phase: input.phase,
      relativeScroll: 0,
      width: mediaSceneConfig.main.plane.width,
      height: mediaSceneConfig.main.plane.height,
      anchorViewport: {
        x: 280,
        y: 500,
      },
      anchorWorld: {
        x: 0,
        y: 0,
        z: -8,
      },
      mainTransform: input.mainTransform,
      secondaryTransform: input.secondaryTransform,
      main: {
        assetId: mediaSceneConfig.main.assetId,
        assetSource: mediaSceneConfig.main.assetSources.desktop,
        isAssetReady: mainReady,
      },
      secondary: {
        assetId: mediaSceneConfig.secondary.assetId,
        assetSource: mediaSceneConfig.secondary.assetSources.desktop,
        isAssetReady: secondaryReady,
      },
    };
  };

  it("creates two media meshes and two texture owners", () => {
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

    const mainImage = {
      src: mediaSceneConfig.main.assetSources.desktop,
    } as HTMLImageElement;
    const secondaryImage = {
      src: mediaSceneConfig.secondary.assetSources.desktop,
    } as HTMLImageElement;
    assetRegistry.register(
      {
        id: mediaSceneConfig.main.assetId,
        src: mediaSceneConfig.main.assetSources.desktop,
        kind: "image",
      },
      mainImage,
    );
    assetRegistry.register(
      {
        id: mediaSceneConfig.secondary.assetId,
        src: mediaSceneConfig.secondary.assetSources.desktop,
        kind: "image",
      },
      secondaryImage,
    );
    assetRegistry.setState(mediaSceneConfig.main.assetId, "ready");
    assetRegistry.setState(mediaSceneConfig.secondary.assetId, "ready");

    const context = createContext();
    const mediaState = createMediaState({
      isActive: true,
      phase: "hold",
      mainTransform: MEDIA_MOTION_CONFIG.main.holdPose,
      secondaryTransform: MEDIA_MOTION_CONFIG.secondary.holdPose,
    });

    const cameraRig = new CameraRig();
    expect(getPerspectiveCameraCalls()).toBe(1);
    const renderer = new MediaWebGLRenderer({
      canvas: context.canvas,
      context: context as unknown as WebGLRenderingContext,
      renderer: new THREE.WebGLRenderer({
        canvas: context.canvas,
        context: context as unknown as WebGLRenderingContext,
      }),
      snapshot,
      assetRegistry,
      scheduler,
      getMediaState: () => mediaState,
      camera: cameraRig.camera,
    });
    expect(getPerspectiveCameraCalls()).toBe(1);
    expect(getCreatedScenes().at(-1)?.add).toBeDefined();
    expect(getCreatedScenes().at(-1)?.add).toHaveBeenCalledTimes(2);

    const createTexture = vi.mocked(context.createTexture);
    const deleteTexture = vi.mocked(context.deleteTexture);

    renderer.render();
    renderer.render();

    expect(createTexture).toHaveBeenCalledTimes(2);
    expect(renderer.resourceSnapshot.byKind.geometry).toBe(1);
    expect(renderer.resourceSnapshot.byKind.texture).toBe(2);
    expect(renderer.resourceSnapshot.byKind.material).toBe(2);
    expect(renderer.resourceSnapshot.ownerCounts[`texture:${mediaSceneConfig.main.assetSources.desktop}`]).toBe(1);
    expect(renderer.resourceSnapshot.ownerCounts[`texture:${mediaSceneConfig.secondary.assetSources.desktop}`]).toBe(1);

    renderer.dispose();
    expect(deleteTexture).toHaveBeenCalledTimes(2);
    expect(renderer.resourceSnapshot.ownerCounts[`geometry:${mediaSceneConfig.id}:geometry`]).toBe(0);
    expect(renderer.resourceSnapshot.ownerCounts[`texture:${mediaSceneConfig.main.assetSources.desktop}`]).toBe(0);
    expect(renderer.resourceSnapshot.ownerCounts[`texture:${mediaSceneConfig.secondary.assetSources.desktop}`]).toBe(0);
    expect(renderer.resourceSnapshot.ownerCounts[`material:${mediaSceneConfig.id}:main:material`]).toBe(0);
    expect(renderer.resourceSnapshot.ownerCounts[`material:${mediaSceneConfig.id}:secondary:material`]).toBe(0);
  });

  it("reports the decoded texture dimensions and effective sampling used by each media layer", () => {
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

    const mainImage = {
      src: mediaSceneConfig.main.assetSources.desktop,
      naturalWidth: 1280,
      naturalHeight: 800,
    } as HTMLImageElement;
    const secondaryImage = {
      src: mediaSceneConfig.secondary.assetSources.desktop,
      naturalWidth: 1280,
      naturalHeight: 800,
    } as HTMLImageElement;
    assetRegistry.register(
      { id: mediaSceneConfig.main.assetId, src: mainImage.src, kind: "image" },
      mainImage,
    );
    assetRegistry.register(
      { id: mediaSceneConfig.secondary.assetId, src: secondaryImage.src, kind: "image" },
      secondaryImage,
    );
    assetRegistry.setState(mediaSceneConfig.main.assetId, "ready");
    assetRegistry.setState(mediaSceneConfig.secondary.assetId, "ready");

    const context = createContext();
    const cameraRig = new CameraRig();
    const renderer = new MediaWebGLRenderer({
      canvas: context.canvas,
      context: context as unknown as WebGLRenderingContext,
      renderer: new THREE.WebGLRenderer({
        canvas: context.canvas,
        context: context as unknown as WebGLRenderingContext,
      }),
      snapshot,
      assetRegistry,
      scheduler,
      getMediaState: () => createMediaState({
        isActive: true,
        phase: "hold",
        mainTransform: MEDIA_MOTION_CONFIG.main.holdPose,
        secondaryTransform: MEDIA_MOTION_CONFIG.secondary.holdPose,
      }),
      camera: cameraRig.camera,
    });

    renderer.render();
    const diagnostics = (renderer as unknown as {
      readonly textureSamplingSnapshot: {
        readonly main: unknown;
      };
    }).textureSamplingSnapshot.main;

    expect(diagnostics).toEqual({
      source: mediaSceneConfig.main.assetSources.desktop,
      decodedWidth: 1280,
      decodedHeight: 800,
      minFilter: "LinearFilter",
      magFilter: "LinearFilter",
      generateMipmaps: true,
      anisotropy: 1,
      colorSpace: "srgb",
      premultiplyAlpha: true,
      flipY: true,
    });

    renderer.dispose();
  });

  it("does not invalidate a stable material again after its texture is already bound", () => {
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
    const mainImage = { src: mediaSceneConfig.main.assetSources.desktop } as HTMLImageElement;
    const secondaryImage = { src: mediaSceneConfig.secondary.assetSources.desktop } as HTMLImageElement;
    for (const [assetId, image] of [
      [mediaSceneConfig.main.assetId, mainImage],
      [mediaSceneConfig.secondary.assetId, secondaryImage],
    ] as const) {
      assetRegistry.register({ id: assetId, src: image.src, kind: "image" }, image);
      assetRegistry.setState(assetId, "ready");
    }
    const context = createContext();
    const renderer = new MediaWebGLRenderer({
      canvas: context.canvas,
      context: context as unknown as WebGLRenderingContext,
      renderer: new THREE.WebGLRenderer({
        canvas: context.canvas,
        context: context as unknown as WebGLRenderingContext,
      }),
      snapshot,
      assetRegistry,
      scheduler,
      getMediaState: () => createMediaState({
        isActive: true,
        phase: "hold",
        mainTransform: MEDIA_MOTION_CONFIG.main.holdPose,
        secondaryTransform: MEDIA_MOTION_CONFIG.secondary.holdPose,
      }),
      camera: new CameraRig().camera,
    });

    renderer.render();
    const layers = getCreatedScenes().at(-1)?.add.mock.calls.map((call) => call[0]) ?? [];
    const materials = layers.map((mesh) => (mesh as {
      material: { needsUpdateAssignments: number };
    }).material);
    for (const material of materials) {
      material.needsUpdateAssignments = 0;
    }

    renderer.render();

    expect(materials.map((material) => material.needsUpdateAssignments)).toEqual([0, 0]);
    renderer.dispose();
  });

  it("applies main and secondary transforms from media motion", () => {
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

    const mainImage = {
      src: mediaSceneConfig.main.assetSources.desktop,
    } as HTMLImageElement;
    const secondaryImage = {
      src: mediaSceneConfig.secondary.assetSources.desktop,
    } as HTMLImageElement;
    assetRegistry.register(
      {
        id: mediaSceneConfig.main.assetId,
        src: mediaSceneConfig.main.assetSources.desktop,
        kind: "image",
      },
      mainImage,
    );
    assetRegistry.register(
      {
        id: mediaSceneConfig.secondary.assetId,
        src: mediaSceneConfig.secondary.assetSources.desktop,
        kind: "image",
      },
      secondaryImage,
    );
    assetRegistry.setState(mediaSceneConfig.main.assetId, "ready");
    assetRegistry.setState(mediaSceneConfig.secondary.assetId, "ready");

    const enterMotion = resolveMediaMotion({
      reducedMotion: false,
      progress: 0.1,
      phase: "enter",
    });
    const context = createContext();
    const mediaState = createMediaState({
      isActive: true,
      phase: "enter",
      mainTransform: enterMotion.main,
      secondaryTransform: enterMotion.secondary,
    });

    const cameraRig = new CameraRig();
    const renderer = new MediaWebGLRenderer({
      canvas: context.canvas,
      context: context as unknown as WebGLRenderingContext,
      renderer: new THREE.WebGLRenderer({
        canvas: context.canvas,
        context: context as unknown as WebGLRenderingContext,
      }),
      snapshot,
      assetRegistry,
      scheduler,
      getMediaState: () => mediaState,
      camera: cameraRig.camera,
    });

    renderer.render();

    const createdScenes = getCreatedScenes();
    const latestScene = createdScenes.at(-1);
    const calls = latestScene?.add.mock.calls ?? [];
    expect(calls).toHaveLength(2);

    const mainMesh = calls[0][0] as {
      position: { set: ReturnType<typeof vi.fn> };
      scale: { set: ReturnType<typeof vi.fn> };
      material: { opacity: number; needsUpdate: boolean };
    };
    const secondaryMesh = calls[1][0] as {
      position: { set: ReturnType<typeof vi.fn> };
      scale: { set: ReturnType<typeof vi.fn> };
      material: { opacity: number; needsUpdate: boolean };
    };

    const mainPosition = mainMesh.position.set.mock.calls.at(-1);
    const secondaryPosition = secondaryMesh.position.set.mock.calls.at(-1);
    expect(mainPosition?.[2]).toBeCloseTo(-8);
    expect(secondaryPosition?.[2]).toBeLessThan(-8);
    const mainScale = mainMesh.scale.set.mock.calls.at(-1);
    const secondaryScale = secondaryMesh.scale.set.mock.calls.at(-1);
    expect(mainScale?.[0]).toBeGreaterThan(0);
    expect(mainScale?.[0]).toBeLessThan(20);
    expect(mainScale?.[1]).toBeGreaterThan(0);
    expect(mainScale?.[1]).toBeLessThan(20);
    expect(secondaryScale?.[0]).toBeGreaterThan(0);
    expect(secondaryScale?.[0]).toBeLessThan(mainScale?.[0] ?? 0);
    expect(secondaryScale?.[1]).toBeGreaterThan(0);
    expect(secondaryScale?.[1]).toBeLessThan(mainScale?.[1] ?? 0);

    expect(mainMesh.material.opacity).toBeCloseTo(
      mediaSceneConfig.main.plane.opacity * enterMotion.main.opacity,
    );
    expect(secondaryMesh.material.opacity).toBeCloseTo(
      mediaSceneConfig.secondary.plane.opacity * enterMotion.secondary.opacity,
    );
    expect(mainMesh.material.opacity).not.toBe(secondaryMesh.material.opacity);

    renderer.dispose();
  });
});
