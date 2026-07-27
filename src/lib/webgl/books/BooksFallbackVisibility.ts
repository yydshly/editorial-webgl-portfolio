import type { SceneLifecycleState } from "@/lib/webgl/SceneRegistry";
import type { BooksCompositionSnapshot } from "@/lib/webgl/books/BooksCompositionSnapshot";
import type { BooksSceneState } from "@/lib/webgl/books/BooksScene";

export const BOOKS_FALLBACK_IMAGE_SELECTOR =
  "img[data-books-fallback='true']";
export const BOOKS_COVER_STAGE_SELECTOR = "#books-cover-stage";

export type BooksFallbackWebGLState = {
  readonly available: boolean;
  readonly contextLost: boolean;
};

export type BooksFallbackSceneState = {
  readonly snapshot: Readonly<BooksSceneState>;
  readonly registryState: SceneLifecycleState | null;
  readonly composition: Readonly<BooksCompositionSnapshot> | null;
};

export type BooksFallbackContractState =
  | "unavailable"
  | "loading"
  | "ready-inactive"
  | "ready-active"
  | "context-lost";

export type BooksFallbackComposedState = {
  readonly contract: BooksFallbackContractState;
  readonly imageOpacity: 0 | 1;
  readonly imageVisible: boolean;
};

const visibleState = (
  contract: Exclude<BooksFallbackContractState, "ready-active">,
): BooksFallbackComposedState => ({
  contract,
  imageOpacity: 1,
  imageVisible: true,
});

const allCPUAssetsReady = (
  snapshot: Readonly<BooksSceneState>,
): boolean =>
  snapshot.covers.length === 3 &&
  snapshot.covers.every((cover) => cover.isAssetReady);

const allTexturesReady = (
  composition: Readonly<BooksCompositionSnapshot> | null,
): boolean =>
  Boolean(
    composition?.allTexturesReady &&
      composition.textureCount === 3,
  );

const hasPositiveProjectedArea = (
  cover: Readonly<BooksCompositionSnapshot["covers"][number]>,
): boolean => {
  const bounds = cover.screen?.bounds;
  if (!bounds) {
    return false;
  }

  const width = bounds.right - bounds.left;
  const height = bounds.bottom - bounds.top;
  return (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  );
};

const allCoversRendered = (
  composition: Readonly<BooksCompositionSnapshot> | null,
): boolean =>
  Boolean(
    composition?.allCoversRendered &&
      composition.meshCount === 3 &&
      composition.geometryCount === 1 &&
      composition.materialCount === 3 &&
      composition.covers.length === 3 &&
      composition.covers.every(
        (cover) =>
          cover.rendered &&
          cover.visible &&
          cover.frustumVisible &&
          hasPositiveProjectedArea(cover),
      ),
  );

const isActiveDominant = (
  sceneState: BooksFallbackSceneState,
): boolean =>
  Boolean(
    sceneState.snapshot.isActive &&
      !sceneState.snapshot.isCached &&
      !sceneState.snapshot.isDisposed &&
      sceneState.snapshot.isAnchored &&
      sceneState.registryState?.resident &&
      sceneState.registryState.visible &&
      sceneState.registryState.updating &&
      sceneState.registryState.dominant &&
      !sceneState.registryState.cached &&
      !sceneState.registryState.disposed,
  );

export const resolveBooksFallbackState = (
  webglState: BooksFallbackWebGLState,
  sceneState: BooksFallbackSceneState,
): BooksFallbackComposedState => {
  if (webglState.contextLost) {
    return visibleState("context-lost");
  }

  if (!webglState.available) {
    return visibleState("unavailable");
  }

  if (
    !allCPUAssetsReady(sceneState.snapshot) ||
    !allTexturesReady(sceneState.composition)
  ) {
    return visibleState("loading");
  }

  if (
    isActiveDominant(sceneState) &&
    allCoversRendered(sceneState.composition)
  ) {
    return {
      contract: "ready-active",
      imageOpacity: 0,
      imageVisible: false,
    };
  }

  return visibleState("ready-inactive");
};

export const setBooksFallbackImageVisibility = (
  state: BooksFallbackComposedState,
): void => {
  if (typeof document === "undefined") {
    return;
  }

  const images = document.querySelectorAll<HTMLImageElement>(
    BOOKS_FALLBACK_IMAGE_SELECTOR,
  );
  for (const image of images) {
    image.style.opacity = String(state.imageOpacity);
    image.style.pointerEvents = state.imageVisible ? "auto" : "none";
    image.dataset.booksFallbackState = state.contract;
  }

  const stage = document.querySelector<HTMLElement>(
    BOOKS_COVER_STAGE_SELECTOR,
  );
  if (stage) {
    stage.dataset.booksFallbackState = state.contract;
  }
};
