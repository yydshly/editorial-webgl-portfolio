import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import MotionSnapshotStore from "@/lib/motion/MotionSnapshotStore";
import AssetRegistry from "@/lib/webgl/AssetRegistry";
import GPUResourceManager from "@/lib/webgl/GPUResourceManager";
import type { AboutSceneState } from "@/lib/webgl/about/AboutScene";
import AboutWebGLRenderer from "@/lib/webgl/about/AboutWebGLRenderer";
import {
  ABOUT_PORTRAIT_TEXTURE_OWNER_ID,
  ABOUT_SCENE_ID,
  aboutSceneConfig,
} from "@/lib/webgl/about/aboutSceneConfig";

type TestContext = WebGLRenderingContext & {
  readonly createTexture: ReturnType<typeof vi.fn>;
  readonly deleteTexture: ReturnType<typeof vi.fn>;
  readonly bindTexture: ReturnType<typeof vi.fn>;
  readonly texParameteri: ReturnType<typeof vi.fn>;
  readonly texImage2D: ReturnType<typeof vi.fn>;
  readonly pixelStorei: ReturnType<typeof vi.fn>;
  readonly viewport: ReturnType<typeof vi.fn>;
};

function createContext(): TestContext {
  return {
    createTexture: vi.fn(() => ({ id: "about-texture" }) as unknown as WebGLTexture),
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
    LINEAR: 9729,
    UNSIGNED_BYTE: 5121,
    RGBA: 6408,
    UNPACK_PREMULTIPLY_ALPHA_WEBGL: 37440,
  } as unknown as TestContext;
}

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

function createState(
  source = aboutSceneConfig.portrait.assetSources.desktop,
): AboutSceneState {
  const isMobile = source === aboutSceneConfig.portrait.assetSources.mobile;
  return {
    isActive: true,
    isCached: false,
    isDisposed: false,
    isAnchored: true,
    reducedMotion: false,
    chapterProgress: 0,
    activeStageIndex: 0,
    activeStageId: "origin",
    stageProgress: 0,
    relativeScroll: 0,
    anchorWidth: isMobile ? 320 : 520,
    anchorHeight: isMobile ? 400 : 650,
    anchorViewport: {
      x: isMobile ? 156 : 300,
      y: isMobile ? 360 : 450,
    },
    anchorWorld: { x: 0, y: 0, z: 0 },
    portrait: {
      assetId: isMobile
        ? aboutSceneConfig.portrait.assets.mobile.id
        : aboutSceneConfig.portrait.assets.desktop.id,
      assetSource: source,
      assetStatus: "development",
      isAssetReady: true,
    },
  };
}

function registerReadyPortrait(
  assetRegistry: AssetRegistry<HTMLImageElement>,
  state: AboutSceneState,
  browserImageSource = state.portrait.assetSource,
): HTMLImageElement {
  const isMobile =
    state.portrait.assetSource ===
    aboutSceneConfig.portrait.assetSources.mobile;
  const image = {
    src: browserImageSource,
    naturalWidth: isMobile ? 900 : 1024,
    naturalHeight: isMobile ? 1125 : 1280,
  } as HTMLImageElement;
  assetRegistry.register(
    {
      id: state.portrait.assetId,
      src: state.portrait.assetSource,
      kind: "image",
    },
    image,
  );
  assetRegistry.setState(state.portrait.assetId, "ready");
  return image;
}

function createHarness(width = 1440, height = 900) {
  const context = createContext();
  const snapshot = createSnapshot(width, height);
  const state = createState(
    width <= aboutSceneConfig.mobileBreakpoint
      ? aboutSceneConfig.portrait.assetSources.mobile
      : aboutSceneConfig.portrait.assetSources.desktop,
  );
  const assetRegistry = new AssetRegistry<HTMLImageElement>();
  registerReadyPortrait(assetRegistry, state);
  const gpuResourceManager = new GPUResourceManager();
  const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const renderer = {
    render: vi.fn(),
    clear: vi.fn(),
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    dispose: vi.fn(),
    info: {
      reset: vi.fn(),
      render: { calls: 7 },
      memory: { geometries: 0, textures: 0 },
    },
  } as unknown as THREE.WebGLRenderer;
  const aboutRenderer = new AboutWebGLRenderer({
    context,
    renderer,
    snapshot,
    assetRegistry,
    gpuResourceManager,
    camera,
    getAboutState: () => state,
  });

  return {
    aboutRenderer,
    assetRegistry,
    camera,
    context,
    gpuResourceManager,
    renderer,
    snapshot,
    state,
  };
}

describe("AboutWebGLRenderer", () => {
  it("owns exactly one portrait mesh bundle while preserving the injected global renderer", () => {
    const harness = createHarness();

    harness.aboutRenderer.render();

    expect(harness.renderer.render).toHaveBeenCalledTimes(1);
    expect(harness.renderer.clear).not.toHaveBeenCalled();
    expect(harness.renderer.setSize).not.toHaveBeenCalled();
    expect(harness.renderer.setPixelRatio).not.toHaveBeenCalled();
    expect(harness.renderer.info.reset).not.toHaveBeenCalled();
    expect(harness.renderer.info.render.calls).toBe(7);
    expect(harness.aboutRenderer.resourceSnapshot.byKind).toEqual({
      texture: 1,
      geometry: 1,
      material: 1,
    });
    expect(
      harness.aboutRenderer.resourceSnapshot.ownerCounts[
        `texture:${harness.state.portrait.assetSource}`
      ],
    ).toBe(1);
    expect(
      harness.aboutRenderer.resourceSnapshot.ownerCounts[
        `geometry:${ABOUT_SCENE_ID}:portrait-geometry`
      ],
    ).toBe(1);
    expect(
      harness.aboutRenderer.resourceSnapshot.ownerCounts[
        `material:${ABOUT_SCENE_ID}:portrait-material`
      ],
    ).toBe(1);
    expect(harness.aboutRenderer.compositionSnapshot.meshCount).toBe(1);
    expect(harness.aboutRenderer.compositionSnapshot.materialSide).toBe(
      THREE.FrontSide,
    );
  });

  it("lets Three upload one manager-owned texture without mutating raw GL state", () => {
    const harness = createHarness();

    harness.aboutRenderer.render();
    harness.aboutRenderer.render();

    expect(harness.context.createTexture).not.toHaveBeenCalled();
    expect(harness.context.bindTexture).not.toHaveBeenCalled();
    expect(harness.context.pixelStorei).not.toHaveBeenCalled();
    expect(harness.context.texParameteri).not.toHaveBeenCalled();
    expect(harness.context.texImage2D).not.toHaveBeenCalled();
    expect(
      harness.aboutRenderer.compositionSnapshot.managerOwnsMaterialTexture,
    ).toBe(true);
    expect(harness.aboutRenderer.textureSamplingSnapshot).toMatchObject({
      source: aboutSceneConfig.portrait.assetSources.desktop,
      decodedWidth: 1024,
      decodedHeight: 1280,
      colorSpace: THREE.SRGBColorSpace,
      flipY: true,
    });
  });

  it("accepts the browser-normalized absolute image URL for a manifest-relative asset", () => {
    const context = createContext();
    const snapshot = createSnapshot();
    const state = createState();
    const assetRegistry = new AssetRegistry<HTMLImageElement>();
    registerReadyPortrait(
      assetRegistry,
      state,
      `http://127.0.0.1:3112${state.portrait.assetSource}`,
    );
    const gpuResourceManager = new GPUResourceManager();
    const camera = new THREE.PerspectiveCamera(48, 1440 / 900, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const renderer = {
      render: vi.fn(),
      info: {
        reset: vi.fn(),
        render: { calls: 0 },
        memory: { geometries: 0, textures: 0 },
      },
    } as unknown as THREE.WebGLRenderer;
    const aboutRenderer = new AboutWebGLRenderer({
      context,
      renderer,
      snapshot,
      assetRegistry,
      gpuResourceManager,
      camera,
      getAboutState: () => state,
    });

    aboutRenderer.render();

    expect(renderer.render).toHaveBeenCalledTimes(1);
    expect(aboutRenderer.compositionSnapshot.portrait.rendered).toBe(true);
    expect(aboutRenderer.compositionSnapshot.managerOwnsMaterialTexture).toBe(
      true,
    );
  });

  it("uses manifest aspect and projects the visible plane into the About portrait anchor", () => {
    const harness = createHarness();

    harness.aboutRenderer.render();

    const composition = harness.aboutRenderer.compositionSnapshot;
    expect(composition.portrait.rendered).toBe(true);
    expect(composition.portrait.visible).toBe(true);
    expect(composition.portrait.frustumVisible).toBe(true);
    const screen = composition.portrait.screen?.bounds;
    expect(screen).toBeDefined();
    const projectedAspect =
      ((screen?.right ?? 0) - (screen?.left ?? 0)) /
      ((screen?.bottom ?? 1) - (screen?.top ?? 0));
    expect(projectedAspect).toBeCloseTo(
      (1024 * composition.manifest.crop.width) /
        (1280 * composition.manifest.crop.height),
      2,
    );
    expect(composition.projection.deltaPx?.x).toBeCloseTo(0, 3);
    expect(composition.projection.deltaPx?.y).toBeCloseTo(0, 3);
    expect(composition.manifest.projectedFocalPoint.x).toBeCloseTo(
      harness.state.anchorViewport?.x ?? 0,
      3,
    );
    expect(composition.manifest.projectedFocalPoint.y).toBeCloseTo(
      harness.state.anchorViewport?.y ?? 0,
      3,
    );
  });

  it("applies the active About stage motion without moving into the timeline core", () => {
    const harness = createHarness();
    Object.assign(harness.state, {
      activeStageIndex: 1,
      activeStageId: "industry",
      stageProgress: 0.5,
    });

    harness.aboutRenderer.render();

    const composition = harness.aboutRenderer.compositionSnapshot;
    expect(composition.motion).toMatchObject({
      translateX: 8,
      translateY: -4,
      scale: 1.01,
      opacity: 0.98,
      colorMultiplier: 0.98,
    });
    expect(composition.portrait.opacity).toBeCloseTo(0.98);
    expect(composition.materialColorMultiplier).toBeCloseTo(0.98);
    const portraitRegionRight =
      (harness.state.anchorViewport?.x ?? 0) + harness.state.anchorWidth / 2;
    // Mirrors `.about-archive`'s `clamp(2rem, 5vw, 5rem)` grid gap:
    // the right reading column cannot begin before this anchor-derived edge.
    const archiveGridGap = Math.max(
      32,
      Math.min(harness.snapshot.viewport.width * 0.05, 80),
    );
    const timelineCoreLeft = portraitRegionRight + archiveGridGap;
    expect(composition.portrait.screen?.bounds.right).toBeLessThan(
      timelineCoreLeft,
    );
    const projectedBounds = composition.portrait.screen?.bounds;
    expect(
      (projectedBounds?.right ?? 0) - (projectedBounds?.left ?? 0),
    ).toBeGreaterThan(0);
    expect(
      (projectedBounds?.bottom ?? 0) - (projectedBounds?.top ?? 0),
    ).toBeGreaterThan(0);
  });

  it("holds the origin pose when reduced motion is enabled", () => {
    const harness = createHarness(390, 844);
    Object.assign(harness.state, {
      activeStageIndex: 3,
      activeStageId: "crossCultural",
      stageProgress: 1,
      reducedMotion: true,
    });

    harness.aboutRenderer.render();

    expect(harness.aboutRenderer.compositionSnapshot.motion).toEqual(
      aboutSceneConfig.motion.stagePoses[0],
    );
  });

  it("applies desktop and mobile manifest crops to UVs with image-space V inversion", () => {
    const harness = createHarness();
    harness.aboutRenderer.render();

    expect(harness.aboutRenderer.compositionSnapshot.manifest.uv).toEqual([
      0, 1,
      1, 1,
      0, 0,
      1, 0,
    ]);

    const mobileState = createState(
      aboutSceneConfig.portrait.assetSources.mobile,
    );
    registerReadyPortrait(harness.assetRegistry, mobileState);
    Object.assign(harness.state, mobileState);
    harness.snapshot.updateViewport({
      width: 390,
      height: 844,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 2,
      isPortrait: true,
    });
    harness.aboutRenderer.render();

    const mobileUv = harness.aboutRenderer.compositionSnapshot.manifest.uv;
    const expectedMobileUv = [
      0, 0.95,
      0.9, 0.95,
      0, 0.05,
      0.9, 0.05,
    ];
    expect(mobileUv).toHaveLength(expectedMobileUv.length);
    expectedMobileUv.forEach((value, index) => {
      expect(mobileUv[index]).toBeCloseTo(value, 6);
    });
  });

  it("releases the old responsive texture owner before acquiring the mobile source", () => {
    const harness = createHarness();
    harness.aboutRenderer.render();

    harness.gpuResourceManager.releaseOwner(
      ABOUT_PORTRAIT_TEXTURE_OWNER_ID,
    );
    const mobileState = createState(
      aboutSceneConfig.portrait.assetSources.mobile,
    );
    registerReadyPortrait(harness.assetRegistry, mobileState);
    Object.assign(harness.state, mobileState);
    harness.snapshot.updateViewport({
      width: 390,
      height: 844,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 2,
      isPortrait: true,
    });

    harness.aboutRenderer.render();

    expect(
      harness.aboutRenderer.resourceSnapshot.ownerCounts[
        `texture:${aboutSceneConfig.portrait.assetSources.desktop}`
      ],
    ).toBe(0);
    expect(
      harness.aboutRenderer.resourceSnapshot.ownerCounts[
        `texture:${aboutSceneConfig.portrait.assetSources.mobile}`
      ],
    ).toBe(1);
    expect(harness.context.createTexture).not.toHaveBeenCalled();
    expect(harness.context.deleteTexture).not.toHaveBeenCalled();
  });

  it("disposes only its own leases and leaves the shared renderer alive", () => {
    const harness = createHarness();
    harness.aboutRenderer.render();

    harness.aboutRenderer.dispose();
    harness.aboutRenderer.dispose();

    expect(harness.context.deleteTexture).not.toHaveBeenCalled();
    expect(harness.aboutRenderer.resourceSnapshot.ownerCounts).toMatchObject({
      [`texture:${harness.state.portrait.assetSource}`]: 0,
      [`geometry:${ABOUT_SCENE_ID}:portrait-geometry`]: 0,
      [`material:${ABOUT_SCENE_ID}:portrait-material`]: 0,
    });
    expect(harness.renderer.dispose).not.toHaveBeenCalled();
    expect(harness.renderer.info.reset).not.toHaveBeenCalled();
  });
});
