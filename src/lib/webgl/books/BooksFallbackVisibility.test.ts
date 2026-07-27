import { describe, expect, it } from "vitest";

import type { SceneLifecycleState } from "@/lib/webgl/SceneRegistry";
import type { WebGLLayerCompositionSnapshot } from "@/lib/webgl/WebGLCompositionSnapshot";
import type { BooksCompositionSnapshot } from "@/lib/webgl/books/BooksCompositionSnapshot";
import type { BooksSceneState } from "@/lib/webgl/books/BooksScene";
import { resolveBooksCoverMotion } from "@/lib/webgl/books/BooksSceneMotion";
import {
  resolveBooksFallbackState,
  setBooksFallbackImageVisibility,
  type BooksFallbackWebGLState,
} from "@/lib/webgl/books/BooksFallbackVisibility";

const readyRegistryState: SceneLifecycleState = {
  resident: true,
  visible: true,
  updating: true,
  dominant: true,
  cached: false,
  disposed: false,
};

const cachedRegistryState: SceneLifecycleState = {
  resident: true,
  visible: false,
  updating: false,
  dominant: false,
  cached: true,
  disposed: false,
};

const visibleLayer = (
  x: number,
): WebGLLayerCompositionSnapshot => ({
  rendered: true,
  visible: true,
  frustumVisible: true,
  opacity: 1,
  position: { x, y: 0, z: -8 },
  scale: { x: 1, y: 1.5, z: 1 },
  ndc: { x: 0, y: 0, z: 0 },
  ndcBounds: {
    minX: -0.2,
    maxX: 0.2,
    minY: -0.3,
    maxY: 0.3,
    minZ: 0,
    maxZ: 0,
  },
  screen: {
    center: { x, y: 450 },
    bounds: {
      left: x - 100,
      right: x + 100,
      top: 300,
      bottom: 600,
    },
  },
});

const readyScene: BooksSceneState = {
  isActive: true,
  isCached: false,
  isDisposed: false,
  isAnchored: true,
  reducedMotion: false,
  progress: 0.5,
  visualReady: true,
  anchorWidth: 620,
  anchorHeight: 610,
  anchorViewport: { x: 1_040, y: 450 },
  anchorWorld: { x: 2.4, y: 0, z: -8 },
  covers: [
    {
      id: "people-in-the-room",
      role: "primary",
      assetId: "people-in-the-room:desktop",
      assetSource: "/assets/books/people-in-the-room-desktop.webp",
      assetStatus: "development",
      isAssetReady: true,
    },
    {
      id: "between-the-cities",
      role: "secondary-left",
      assetId: "between-the-cities:desktop",
      assetSource: "/assets/books/between-the-cities-desktop.webp",
      assetStatus: "development",
      isAssetReady: true,
    },
    {
      id: "hearing-one-another",
      role: "secondary-right",
      assetId: "hearing-one-another:desktop",
      assetSource: "/assets/books/hearing-one-another-desktop.webp",
      assetStatus: "development",
      isAssetReady: true,
    },
  ],
  motion: resolveBooksCoverMotion({
    progress: 0.5,
    reducedMotion: false,
    viewportWidth: 1_440,
  }),
};

const readyComposition: BooksCompositionSnapshot = {
  covers: [visibleLayer(1_040), visibleLayer(890), visibleLayer(1_190)],
  projections: [
    {
      anchorRectCenter: { x: 1_040, y: 450 },
      expectedScreenCenter: { x: 1_040, y: 450 },
      projectedScreenCenter: { x: 1_040, y: 450 },
      deltaPx: { x: 0, y: 0 },
      viewport: { width: 1_440, height: 900, devicePixelRatio: 1 },
    },
    {
      anchorRectCenter: { x: 1_040, y: 450 },
      expectedScreenCenter: { x: 890, y: 478 },
      projectedScreenCenter: { x: 890, y: 478 },
      deltaPx: { x: 0, y: 0 },
      viewport: { width: 1_440, height: 900, devicePixelRatio: 1 },
    },
    {
      anchorRectCenter: { x: 1_040, y: 450 },
      expectedScreenCenter: { x: 1_190, y: 484 },
      projectedScreenCenter: { x: 1_190, y: 484 },
      deltaPx: { x: 0, y: 0 },
      viewport: { width: 1_440, height: 900, devicePixelRatio: 1 },
    },
  ],
  roleOrder: ["primary", "secondary-left", "secondary-right"],
  textureSources: [
    "/assets/books/people-in-the-room-desktop.webp",
    "/assets/books/between-the-cities-desktop.webp",
    "/assets/books/hearing-one-another-desktop.webp",
  ],
  meshCount: 3,
  geometryCount: 1,
  materialCount: 3,
  textureCount: 3,
  expectedDrawCalls: 3,
  allTexturesReady: true,
  allCoversRendered: true,
  materialSides: [0, 0, 0],
  depthWrites: [false, false, false],
  motion: readyScene.motion,
  supportingVisibility: {
    leftExposedFraction: 0.4,
    rightExposedFraction: 0.4,
  },
};

const available: BooksFallbackWebGLState = {
  available: true,
  contextLost: false,
};

describe("BooksFallbackVisibility", () => {
  it.each([
    [
      "unavailable",
      { available: false, contextLost: false },
      readyScene,
      readyRegistryState,
      readyComposition,
    ],
    [
      "loading",
      available,
      {
        ...readyScene,
        covers: [
          readyScene.covers[0],
          { ...readyScene.covers[1], isAssetReady: false },
          readyScene.covers[2],
        ],
      },
      readyRegistryState,
      readyComposition,
    ],
    [
      "ready-inactive",
      available,
      { ...readyScene, isActive: false, isCached: true },
      cachedRegistryState,
      readyComposition,
    ],
    [
      "context-lost",
      { available: true, contextLost: true },
      readyScene,
      readyRegistryState,
      readyComposition,
    ],
  ] as const)(
    "keeps all three fallback covers visible for %s",
    (contract, webgl, scene, registry, composition) => {
      expect(
        resolveBooksFallbackState(webgl, {
          snapshot: scene,
          registryState: registry,
          composition,
        }),
      ).toEqual({
        contract,
        imageOpacity: 1,
        imageVisible: true,
      });
    },
  );

  it("hides all fallback pixels only when all three covers are active, dominant, textured, and rendered", () => {
    expect(
      resolveBooksFallbackState(available, {
        snapshot: readyScene,
        registryState: readyRegistryState,
        composition: readyComposition,
      }),
    ).toEqual({
      contract: "ready-active",
      imageOpacity: 0,
      imageVisible: false,
    });
  });

  it.each([
    [
      "partial GPU readiness",
      "loading",
      { ...readyComposition, allTexturesReady: false, textureCount: 2 },
    ],
    [
      "two rendered covers",
      "ready-inactive",
      {
        ...readyComposition,
        allCoversRendered: false,
        covers: [
          readyComposition.covers[0],
          readyComposition.covers[1],
          {
            ...readyComposition.covers[2],
            rendered: false,
            visible: false,
          },
        ],
      },
    ],
    [
      "zero projected area",
      "ready-inactive",
      {
        ...readyComposition,
        allCoversRendered: true,
        covers: [
          readyComposition.covers[0],
          {
            ...readyComposition.covers[1],
            screen: {
              center: { x: 0, y: 0 },
              bounds: { left: 10, right: 10, top: 10, bottom: 10 },
            },
          },
          readyComposition.covers[2],
        ],
      },
    ],
  ] as const)("never exposes a partial mixed state for %s", (_, contract, composition) => {
    expect(
      resolveBooksFallbackState(available, {
        snapshot: readyScene,
        registryState: readyRegistryState,
        composition,
      }),
    ).toMatchObject({
      contract,
      imageOpacity: 1,
      imageVisible: true,
    });
  });

  it("writes one atomic state to all three images without removing DOM content or layout", () => {
    document.body.innerHTML = `
      <figure id="books-cover-stage" data-books-fallback-state="unavailable">
        <img data-books-fallback="true" data-book-id="people-in-the-room" />
        <img data-books-fallback="true" data-book-id="between-the-cities" />
        <img data-books-fallback="true" data-book-id="hearing-one-another" />
        <figcaption>Development cover studies</figcaption>
      </figure>
    `;

    setBooksFallbackImageVisibility({
      contract: "ready-active",
      imageOpacity: 0,
      imageVisible: false,
    });

    const stage = document.getElementById("books-cover-stage");
    const images = Array.from(
      document.querySelectorAll<HTMLImageElement>(
        "img[data-books-fallback='true']",
      ),
    );
    expect(images).toHaveLength(3);
    expect(
      images.map((image) => ({
        opacity: image.style.opacity,
        display: image.style.display,
        state: image.dataset.booksFallbackState,
        pointerEvents: image.style.pointerEvents,
      })),
    ).toEqual([
      {
        opacity: "0",
        display: "",
        state: "ready-active",
        pointerEvents: "none",
      },
      {
        opacity: "0",
        display: "",
        state: "ready-active",
        pointerEvents: "none",
      },
      {
        opacity: "0",
        display: "",
        state: "ready-active",
        pointerEvents: "none",
      },
    ]);
    expect(stage?.dataset.booksFallbackState).toBe("ready-active");
    expect(stage?.querySelector("figcaption")).toHaveTextContent(
      "Development cover studies",
    );
  });
});
