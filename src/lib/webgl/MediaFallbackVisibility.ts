import type { SceneLifecycleState } from "@/lib/webgl/SceneRegistry";
import type { MediaSceneState } from "@/lib/webgl/media/MediaScene";
import type { WebGLLayerCompositionSnapshot } from "@/lib/webgl/WebGLCompositionSnapshot";

export type MediaFallbackWebGLState = {
  readonly available: boolean;
  readonly contextLost: boolean;
};

export type MediaFallbackMediaSceneState = {
  readonly snapshot: Readonly<MediaSceneState>;
  readonly registryState: SceneLifecycleState | null;
};

export type MediaFallbackContractState =
  | "unavailable"
  | "loading"
  | "ready-inactive"
  | "ready-active"
  | "context-lost";

export type MediaFallbackComposedState = {
  readonly contract: MediaFallbackContractState;
  readonly imageOpacity: 0 | 1;
  readonly imageVisible: boolean;
};

export type MediaVisualReadyContext = {
  readonly mediaMainLayer: Readonly<WebGLLayerCompositionSnapshot> | null;
  readonly minMainOpacity?: number;
  readonly minMainAreaPx?: number;
  readonly viewportWidth?: number;
  readonly viewportHeight?: number;
  readonly minViewportIntersectionPx?: number;
  readonly minViewportIntersectionRatio?: number;
  readonly sceneState?: SceneLifecycleState | null;
};

const isSceneReady = (registryState: SceneLifecycleState | null): boolean =>
  Boolean(registryState?.visible || registryState?.updating || registryState?.dominant);

const areLayerAssetsReady = (snapshot: Readonly<MediaSceneState>): boolean =>
  snapshot.main.isAssetReady && snapshot.secondary.isAssetReady;

const getLayerAreaPx = (bounds?: {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
} | null): number => {
  if (!bounds) {
    return 0;
  }

  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return 0;
  }

  return Math.max(0, width * height);
};

const getLayerIntersectionAreaPx = (
  bounds?: {
    readonly left: number;
    readonly right: number;
    readonly top: number;
    readonly bottom: number;
  } | null,
  viewportWidth?: number,
  viewportHeight?: number,
): number => {
  if (!bounds || !Number.isFinite(viewportWidth) || !Number.isFinite(viewportHeight)) {
    return 0;
  }

  const width = Math.max(0, viewportWidth as number);
  const height = Math.max(0, viewportHeight as number);
  if (width <= 0 || height <= 0) {
    return 0;
  }

  const left = Math.max(0, bounds.left);
  const right = Math.min(viewportWidth as number, bounds.right);
  const top = Math.max(0, bounds.top);
  const bottom = Math.min(viewportHeight as number, bounds.bottom);

  const intersectWidth = right - left;
  const intersectHeight = bottom - top;
  if (!Number.isFinite(intersectWidth) || !Number.isFinite(intersectHeight)) {
    return 0;
  }

  return Math.max(0, intersectWidth) * Math.max(0, intersectHeight);
};

export const resolveMediaVisualReady = (
  scene: Readonly<MediaSceneState>,
  visualContext?: MediaVisualReadyContext | null,
): boolean => {
  if (!areLayerAssetsReady(scene)) {
    return false;
  }

  const layer = visualContext?.mediaMainLayer;
  if (!layer) {
    return false;
  }

  const state = visualContext?.sceneState;
  if (state && !(state.visible || state.updating || state.dominant)) {
    return false;
  }

  if (!layer.rendered || !layer.visible || !layer.frustumVisible) {
    return false;
  }

  const mainOpacity = Number(layer.opacity);
  if (!Number.isFinite(mainOpacity)) {
    return false;
  }

  const minMainOpacity = visualContext?.minMainOpacity ?? 0.04;
  if (mainOpacity < minMainOpacity) {
    return false;
  }

  const projectedArea = getLayerAreaPx(layer.screen?.bounds);
  const minMainAreaPx = visualContext?.minMainAreaPx ?? 4;
  if (Number.isFinite(projectedArea) && projectedArea < minMainAreaPx) {
    return false;
  }

  const minMainViewportIntersectionPx = visualContext?.minViewportIntersectionPx ?? 4;
  const minMainViewportIntersectionRatio = visualContext?.minViewportIntersectionRatio ?? 0.001;
  const intersectionArea = getLayerIntersectionAreaPx(
    layer.screen?.bounds,
    visualContext?.viewportWidth,
    visualContext?.viewportHeight,
  );
  if (Number.isFinite(intersectionArea)) {
    if (intersectionArea < minMainViewportIntersectionPx) {
      return false;
    }

    if (projectedArea > 0) {
      const intersectionRatio = intersectionArea / projectedArea;
      if (Number.isFinite(intersectionRatio) && intersectionRatio < minMainViewportIntersectionRatio) {
        return false;
      }
    }
  }

  return true;
};

const shouldHideFallbackImage = (
  webglState: MediaFallbackWebGLState,
  sceneState: MediaFallbackMediaSceneState,
  mediaVisualReady?: boolean,
): boolean => {
  if (webglState.contextLost || !webglState.available) {
    return false;
  }

  if (!areLayerAssetsReady(sceneState.snapshot)) {
    return false;
  }

  if (!isSceneReady(sceneState.registryState)) {
    return false;
  }

  const effectiveVisualReady = typeof mediaVisualReady === "boolean"
    ? mediaVisualReady
    : sceneState.snapshot.visualReady;

  if (!effectiveVisualReady) {
    return false;
  }

  return true;
};

export const resolveMediaFallbackState = (
  webglState: MediaFallbackWebGLState,
  sceneState: MediaFallbackMediaSceneState,
  mediaVisualReady?: boolean,
): MediaFallbackComposedState => {
  if (webglState.contextLost) {
    return {
      contract: "context-lost",
      imageOpacity: 1,
      imageVisible: true,
    };
  }

  if (!webglState.available) {
    return {
      contract: "unavailable",
      imageOpacity: 1,
      imageVisible: true,
    };
  }

  if (!areLayerAssetsReady(sceneState.snapshot)) {
    return {
      contract: "loading",
      imageOpacity: 1,
      imageVisible: true,
    };
  }

  const shouldHide = shouldHideFallbackImage(webglState, sceneState, mediaVisualReady);
  if (shouldHide) {
    return {
      contract: "ready-active",
      imageOpacity: 0,
      imageVisible: false,
    };
  }

  if (!sceneState.snapshot.isActive) {
    return {
      contract: "ready-inactive",
      imageOpacity: 1,
      imageVisible: true,
    };
  }

  return {
    contract: "ready-inactive",
    imageOpacity: 1,
    imageVisible: true,
  };
};

export const setMediaFallbackImageVisibility = (
  selector: string,
  state: MediaFallbackComposedState,
): void => {
  if (typeof document === "undefined") {
    return;
  }

  const images = document.querySelectorAll<HTMLImageElement>(selector);
  for (const image of images) {
    image.style.opacity = String(state.imageOpacity);
    image.dataset.mediaFallbackState = state.contract;
    image.style.pointerEvents = state.imageVisible ? "auto" : "none";
  }
};
