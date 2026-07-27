import { describe, expect, it } from "vitest";

import type { SceneLifecycleState } from "@/lib/webgl/SceneRegistry";
import type { MediaSceneState } from "@/lib/webgl/media/MediaScene";
import type { WebGLLayerCompositionSnapshot } from "@/lib/webgl/WebGLCompositionSnapshot";
import {
  resolveMediaVisualReady,
  resolveMediaFallbackState,
  type MediaFallbackComposedState,
  type MediaFallbackMediaSceneState,
  type MediaFallbackWebGLState,
} from "@/lib/webgl/MediaFallbackVisibility";

const baseSceneState: MediaSceneState = {
  isActive: true,
  isAnchored: true,
  isCached: false,
  isDisposed: false,
  visualReady: true,
  mediaProgress: 0,
  phase: "enter",
  mainTransform: { translateX: 0, translateY: 0, opacity: 1, scale: 1 },
  secondaryTransform: { translateX: 0, translateY: 0, opacity: 1, scale: 1 },
  relativeScroll: 0,
  width: 0,
  height: 0,
  anchorViewport: null,
  anchorWorld: null,
  main: {
    assetId: "media-stage",
    assetSource: "/assets/media/media-stage-desktop.webp",
    isAssetReady: true,
  },
  secondary: {
    assetId: "media-studio",
    assetSource: "/assets/media/media-studio-desktop.webp",
    isAssetReady: true,
  },
};

const readyRegistryState: SceneLifecycleState = {
  resident: true,
  visible: true,
  updating: true,
  dominant: false,
  cached: false,
  disposed: false,
};

const inactiveRegistryState: SceneLifecycleState = {
  resident: true,
  visible: false,
  updating: false,
  dominant: false,
  cached: false,
  disposed: false,
};

type MediaSceneStateOverride = Omit<Partial<MediaSceneState>, "main" | "secondary"> & {
  main?: Partial<MediaSceneState["main"]>;
  secondary?: Partial<MediaSceneState["secondary"]>;
};

const createContract = (
  webgl: MediaFallbackWebGLState,
  registryState: SceneLifecycleState,
  sceneOverrides: MediaSceneStateOverride = {},
): MediaFallbackComposedState => {
  return resolveMediaFallbackState(webgl, {
    snapshot: {
      ...baseSceneState,
      ...sceneOverrides,
      main: {
        ...baseSceneState.main,
        ...sceneOverrides.main,
      },
      secondary: {
        ...baseSceneState.secondary,
        ...sceneOverrides.secondary,
      },
    },
    registryState,
  } as MediaFallbackMediaSceneState);
};

const mediaMainLayer: Readonly<WebGLLayerCompositionSnapshot> = {
  rendered: true,
  visible: true,
  frustumVisible: true,
  opacity: 1,
  position: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  ndc: { x: 0, y: 0, z: 0 },
  ndcBounds: {
    minX: 0,
    maxX: 0.1,
    minY: 0,
    maxY: 0.1,
    minZ: 0,
    maxZ: 0,
  },
  screen: {
    center: { x: 50, y: 50 },
    bounds: { left: 20, right: 80, top: 20, bottom: 80 },
  },
};

describe("MediaFallbackVisibility", () => {
  it("returns false visualReady when mediaMainLayer is missing", () => {
    const ready = resolveMediaVisualReady(baseSceneState);

    expect(ready).toBe(false);
  });

  it("returns false visualReady when media layer is out of viewport", () => {
    const ready = resolveMediaVisualReady(
      {
        ...baseSceneState,
        main: { ...baseSceneState.main, isAssetReady: true },
        secondary: { ...baseSceneState.secondary, isAssetReady: true },
      },
      {
        mediaMainLayer: {
          ...mediaMainLayer,
          screen: {
            center: { x: 1500, y: 1500 },
            bounds: { left: 1490, right: 1520, top: 1490, bottom: 1520 },
          },
        },
        viewportWidth: 1440,
        viewportHeight: 900,
      },
    );

    expect(ready).toBe(false);
  });

  it("returns false visualReady when opacity is below threshold", () => {
    const ready = resolveMediaVisualReady(
      {
        ...baseSceneState,
        main: { ...baseSceneState.main, isAssetReady: true },
        secondary: { ...baseSceneState.secondary, isAssetReady: true },
      },
      {
        mediaMainLayer: {
          ...mediaMainLayer,
          opacity: 0.02,
        },
        minMainOpacity: 0.04,
      },
    );

    expect(ready).toBe(false);
  });

  it("returns false visualReady when projected intersection area is too small", () => {
    const ready = resolveMediaVisualReady(
      {
        ...baseSceneState,
        main: { ...baseSceneState.main, isAssetReady: true },
        secondary: { ...baseSceneState.secondary, isAssetReady: true },
      },
      {
        mediaMainLayer: {
          ...mediaMainLayer,
          screen: {
            center: { x: 15, y: 15 },
            bounds: { left: 12, right: 13, top: 12, bottom: 13 },
          },
        },
        viewportWidth: 1440,
        viewportHeight: 900,
        minViewportIntersectionPx: 4,
      },
    );

    expect(ready).toBe(false);
  });

  it("returns true visualReady when layer meets projected and intersection constraints", () => {
    const ready = resolveMediaVisualReady(
      {
        ...baseSceneState,
        main: { ...baseSceneState.main, isAssetReady: true },
        secondary: { ...baseSceneState.secondary, isAssetReady: true },
      },
      {
        mediaMainLayer,
        viewportWidth: 1440,
        viewportHeight: 900,
        minMainOpacity: 0.04,
        minMainAreaPx: 4,
        minViewportIntersectionPx: 4,
        minViewportIntersectionRatio: 0.001,
      },
    );

    expect(ready).toBe(true);
  });

  it("returns unavailable when WebGL unavailable", () => {
    const state = createContract(
      { available: false, contextLost: false },
      readyRegistryState,
    );

    expect(state.contract).toBe("unavailable");
    expect(state.imageOpacity).toBe(1);
    expect(state.imageVisible).toBe(true);
  });

  it("returns loading when media assets are not all ready", () => {
    const state = createContract(
      { available: true, contextLost: false },
      readyRegistryState,
      {
        main: { isAssetReady: false },
      },
    );

    expect(state.contract).toBe("loading");
    expect(state.imageOpacity).toBe(1);
    expect(state.imageVisible).toBe(true);
  });

  it("returns ready-active when scene is active and all assets are ready", () => {
    const state = createContract(
      { available: true, contextLost: false },
      readyRegistryState,
    );

    expect(state.contract).toBe("ready-active");
    expect(state.imageOpacity).toBe(0);
    expect(state.imageVisible).toBe(false);
  });

  it("returns ready-inactive when scene is ready but inactive", () => {
    const state = createContract(
      { available: true, contextLost: false },
      inactiveRegistryState,
      { isActive: false },
    );

    expect(state.contract).toBe("ready-inactive");
    expect(state.imageOpacity).toBe(1);
    expect(state.imageVisible).toBe(true);
  });

  it("returns context-lost when context is lost regardless asset readiness", () => {
    const state = createContract(
      { available: true, contextLost: true },
      readyRegistryState,
    );

    expect(state.contract).toBe("context-lost");
    expect(state.imageOpacity).toBe(1);
    expect(state.imageVisible).toBe(true);
  });

  it("never returns zero opacity when WebGL layer is invisible", () => {
    const state = createContract(
      { available: true, contextLost: false },
      inactiveRegistryState,
      {
        main: { isAssetReady: true },
        secondary: { isAssetReady: true },
      },
    );

    expect(state.contract).toBe("ready-inactive");
    expect(state.imageOpacity).toBe(1);
  });
});
