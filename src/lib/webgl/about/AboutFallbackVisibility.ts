import type { SceneLifecycleState } from "@/lib/webgl/SceneRegistry";
import type { AboutSceneState } from "@/lib/webgl/about/AboutScene";
import type { WebGLLayerCompositionSnapshot } from "@/lib/webgl/WebGLCompositionSnapshot";

export const ABOUT_FALLBACK_IMAGE_SELECTOR = "img[data-about-fallback='true']";

export type AboutFallbackWebGLState = {
  readonly available: boolean;
  readonly contextLost: boolean;
};

export type AboutFallbackSceneState = {
  readonly snapshot: Readonly<AboutSceneState>;
  readonly registryState: SceneLifecycleState | null;
  readonly portrait: Readonly<WebGLLayerCompositionSnapshot> | null;
};

export type AboutFallbackContractState =
  | "unavailable"
  | "loading"
  | "ready-inactive"
  | "ready-active"
  | "context-lost";

export type AboutFallbackComposedState = {
  readonly contract: AboutFallbackContractState;
  readonly imageOpacity: 0 | 1;
  readonly imageVisible: boolean;
};

const isSceneActive = (state: AboutFallbackSceneState): boolean =>
  Boolean(
    state.snapshot.isActive &&
      state.registryState?.visible &&
      state.registryState.updating &&
      state.portrait?.rendered &&
      state.portrait.visible &&
      state.portrait.frustumVisible,
  );

export const resolveAboutFallbackState = (
  webglState: AboutFallbackWebGLState,
  sceneState: AboutFallbackSceneState,
): AboutFallbackComposedState => {
  if (webglState.contextLost) {
    return { contract: "context-lost", imageOpacity: 1, imageVisible: true };
  }

  if (!webglState.available) {
    return { contract: "unavailable", imageOpacity: 1, imageVisible: true };
  }

  if (!sceneState.snapshot.portrait.isAssetReady) {
    return { contract: "loading", imageOpacity: 1, imageVisible: true };
  }

  if (isSceneActive(sceneState)) {
    return { contract: "ready-active", imageOpacity: 0, imageVisible: false };
  }

  return { contract: "ready-inactive", imageOpacity: 1, imageVisible: true };
};

export const setAboutFallbackImageVisibility = (
  state: AboutFallbackComposedState,
): void => {
  if (typeof document === "undefined") {
    return;
  }

  const images = document.querySelectorAll<HTMLImageElement>(ABOUT_FALLBACK_IMAGE_SELECTOR);
  for (const image of images) {
    image.style.opacity = String(state.imageOpacity);
    image.style.pointerEvents = state.imageVisible ? "auto" : "none";
    image.dataset.aboutFallbackState = state.contract;
  }
};
