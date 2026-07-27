import { describe, expect, it } from "vitest";

import type { SceneLifecycleState } from "@/lib/webgl/SceneRegistry";
import type { AboutSceneState } from "@/lib/webgl/about/AboutScene";
import type { WebGLLayerCompositionSnapshot } from "@/lib/webgl/WebGLCompositionSnapshot";
import {
  resolveAboutFallbackState,
  setAboutFallbackImageVisibility,
  type AboutFallbackWebGLState,
} from "@/lib/webgl/about/AboutFallbackVisibility";

const activeRegistryState: SceneLifecycleState = {
  resident: true,
  visible: true,
  updating: true,
  dominant: true,
  cached: false,
  disposed: false,
};

const inactiveRegistryState: SceneLifecycleState = {
  ...activeRegistryState,
  visible: false,
  updating: false,
  dominant: false,
  cached: true,
};

const readyScene: AboutSceneState = {
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
  anchorWidth: 320,
  anchorHeight: 480,
  anchorViewport: { x: 160, y: 240 },
  anchorWorld: { x: 0, y: 0, z: 0 },
  portrait: {
    assetId: "about-portrait-desktop",
    assetSource: "/assets/about/about-portrait-desktop.webp",
    assetStatus: "development",
    isAssetReady: true,
  },
};

const visiblePortrait: WebGLLayerCompositionSnapshot = {
  rendered: true,
  visible: true,
  frustumVisible: true,
  opacity: 1,
  position: { x: 0, y: 0, z: 0 },
  scale: { x: 1, y: 1, z: 1 },
  ndc: { x: 0, y: 0, z: 0 },
  ndcBounds: { minX: -0.2, maxX: 0.2, minY: -0.2, maxY: 0.2, minZ: 0, maxZ: 0 },
};

const available: AboutFallbackWebGLState = { available: true, contextLost: false };

describe("AboutFallbackVisibility", () => {
  it.each([
    ["unavailable", { available: false, contextLost: false }, readyScene, activeRegistryState, visiblePortrait],
    ["loading", available, { ...readyScene, portrait: { ...readyScene.portrait, isAssetReady: false } }, activeRegistryState, visiblePortrait],
    ["ready-inactive", available, { ...readyScene, isActive: false }, inactiveRegistryState, visiblePortrait],
    ["context-lost", { available: true, contextLost: true }, readyScene, activeRegistryState, visiblePortrait],
    ["ready-inactive", available, readyScene, activeRegistryState, null],
  ] as const)("keeps the DOM portrait opaque for %s", (contract, webgl, scene, registryState, portrait) => {
    const state = resolveAboutFallbackState(webgl, {
      snapshot: scene,
      registryState,
      portrait,
    });

    expect(state).toMatchObject({ contract, imageOpacity: 1, imageVisible: true });
  });

  it("hides only after the active scene has rendered its ready texture", () => {
    const state = resolveAboutFallbackState(available, {
      snapshot: readyScene,
      registryState: activeRegistryState,
      portrait: visiblePortrait,
    });

    expect(state).toEqual({ contract: "ready-active", imageOpacity: 0, imageVisible: false });
  });

  it("writes opacity only to About fallback portraits without removing them from layout", () => {
    document.body.innerHTML = [
      '<img data-about-fallback="true" />',
      '<img data-media-fallback="true" />',
    ].join("");

    setAboutFallbackImageVisibility({
      contract: "ready-active",
      imageOpacity: 0,
      imageVisible: false,
    });

    const [aboutImage, mediaImage] = Array.from(document.querySelectorAll("img"));
    expect(aboutImage.style.opacity).toBe("0");
    expect(aboutImage.style.display).toBe("");
    expect(aboutImage.dataset.aboutFallbackState).toBe("ready-active");
    expect(mediaImage.style.opacity).toBe("");
  });
});
