import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import MotionSnapshotStore from "@/lib/motion/MotionSnapshotStore";
import AssetRegistry from "@/lib/webgl/AssetRegistry";
import GPUResourceManager from "@/lib/webgl/GPUResourceManager";
import type { BooksSceneState } from "@/lib/webgl/books/BooksScene";
import BooksWebGLRenderer from "@/lib/webgl/books/BooksWebGLRenderer";
import { resolveBooksCoverMotion } from "@/lib/webgl/books/BooksSceneMotion";
import { booksAssetManifest } from "@/lib/webgl/books/booksAssetManifest";
import {
  BOOKS_COVER_GEOMETRY_RESOURCE_ID,
  BOOKS_SCENE_ID,
  getBooksCoverAssetId,
  getBooksCoverMaterialResourceId,
  getBooksCoverTextureOwnerId,
} from "@/lib/webgl/books/booksSceneConfig";

type TestContext = WebGLRenderingContext & {
  readonly createTexture: ReturnType<typeof vi.fn>;
  readonly deleteTexture: ReturnType<typeof vi.fn>;
  readonly bindTexture: ReturnType<typeof vi.fn>;
  readonly texParameteri: ReturnType<typeof vi.fn>;
  readonly texImage2D: ReturnType<typeof vi.fn>;
  readonly pixelStorei: ReturnType<typeof vi.fn>;
};

function createContext(): TestContext {
  return {
    createTexture: vi.fn(),
    deleteTexture: vi.fn(),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    texImage2D: vi.fn(),
    pixelStorei: vi.fn(),
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
  width = 1440,
  options?: {
    readonly active?: boolean;
    readonly anchored?: boolean;
    readonly progress?: number;
    readonly reducedMotion?: boolean;
  },
): BooksSceneState {
  const mobile = width <= 768;
  const progress = options?.progress ?? 0.51;
  const reducedMotion = options?.reducedMotion ?? false;
  const active = options?.active ?? true;
  return {
    isActive: active,
    isCached: !active,
    isDisposed: false,
    isAnchored: options?.anchored ?? true,
    reducedMotion,
    progress,
    visualReady: false,
    anchorWidth: mobile ? 360 : 620,
    anchorHeight: mobile ? 430 : 610,
    anchorViewport: {
      x: mobile ? 195 : 1040,
      y: mobile ? 420 : 450,
    },
    anchorWorld: { x: mobile ? 0 : 2.4, y: 0, z: -8 },
    covers: booksAssetManifest.covers.map((cover) => {
      const viewport = mobile ? "mobile" : "desktop";
      return {
        id: cover.id,
        role: cover.visualRole,
        assetId: getBooksCoverAssetId(cover.id, viewport),
        assetSource: cover[viewport].path,
        assetStatus: cover.status,
        isAssetReady: true,
      };
    }) as unknown as BooksSceneState["covers"],
    motion: resolveBooksCoverMotion({
      progress,
      reducedMotion,
      viewportWidth: width,
    }),
  };
}

function registerReadyCovers(
  assetRegistry: AssetRegistry<HTMLImageElement>,
  state: BooksSceneState,
) {
  state.covers.forEach((cover) => {
    assetRegistry.register(
      {
        id: cover.assetId,
        src: cover.assetSource,
        kind: "image",
      },
      {
        src: cover.assetSource,
        naturalWidth: cover.assetSource.includes("-mobile.") ? 800 : 1000,
        naturalHeight: cover.assetSource.includes("-mobile.") ? 1200 : 1500,
      } as HTMLImageElement,
    );
    assetRegistry.setState(cover.assetId, "ready");
  });
}

function createHarness(
  width = 1440,
  height = 900,
  state = createState(width),
) {
  const context = createContext();
  const snapshot = createSnapshot(width, height);
  const assetRegistry = new AssetRegistry<HTMLImageElement>();
  registerReadyCovers(assetRegistry, state);
  const gpuResourceManager = new GPUResourceManager();
  const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 100);
  camera.position.set(0, 0, -7.65);
  camera.lookAt(0, 0, -8);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const renderer = {
    render: vi.fn(),
    clear: vi.fn(),
    setViewport: vi.fn(),
    setSize: vi.fn(),
    setPixelRatio: vi.fn(),
    dispose: vi.fn(),
    info: {
      reset: vi.fn(),
      render: { calls: 9 },
      memory: { geometries: 0, textures: 0 },
    },
  } as unknown as THREE.WebGLRenderer;
  const booksRenderer = new BooksWebGLRenderer({
    context,
    renderer,
    snapshot,
    assetRegistry,
    gpuResourceManager,
    camera,
    getBooksState: () => state,
  });

  return {
    assetRegistry,
    booksRenderer,
    camera,
    context,
    gpuResourceManager,
    renderer,
    snapshot,
    state,
  };
}

function getSubmittedMeshes(renderer: THREE.WebGLRenderer) {
  const submittedScene = vi.mocked(renderer.render).mock.calls.at(-1)?.[0];
  expect(submittedScene).toBeInstanceOf(THREE.Scene);
  return (submittedScene as THREE.Scene).children as Array<
    THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  >;
}

describe("BooksWebGLRenderer", () => {
  it("acquires one shared geometry, three materials, and three meshes without taking global renderer ownership", () => {
    const harness = createHarness();

    harness.booksRenderer.render();

    const meshes = getSubmittedMeshes(harness.renderer);
    expect(meshes).toHaveLength(3);
    expect(new Set(meshes.map((mesh) => mesh.geometry)).size).toBe(1);
    expect(new Set(meshes.map((mesh) => mesh.material)).size).toBe(3);
    expect(harness.booksRenderer.compositionSnapshot).toMatchObject({
      meshCount: 3,
      geometryCount: 1,
      materialCount: 3,
      textureCount: 3,
      expectedDrawCalls: 3,
      allTexturesReady: true,
      allCoversRendered: true,
    });
    expect(harness.booksRenderer.resourceSnapshot.byKind).toEqual({
      texture: 3,
      geometry: 1,
      material: 3,
    });
    expect(harness.renderer.clear).not.toHaveBeenCalled();
    expect(harness.renderer.setViewport).not.toHaveBeenCalled();
    expect(harness.renderer.setSize).not.toHaveBeenCalled();
    expect(harness.renderer.setPixelRatio).not.toHaveBeenCalled();
    expect(harness.renderer.info.reset).not.toHaveBeenCalled();
    expect(harness.renderer.info.render.calls).toBe(9);
  });

  it("reports activation readiness after inactive priming without claiming that covers rendered", () => {
    const state = createState(1440, { active: false });
    const harness = createHarness(1440, 900, state);

    harness.booksRenderer.render();

    expect(harness.renderer.render).not.toHaveBeenCalled();
    expect(harness.booksRenderer.resourceSnapshot.byKind).toEqual({
      texture: 3,
      geometry: 1,
      material: 3,
    });
    expect(harness.booksRenderer.compositionSnapshot.allTexturesReady).toBe(
      true,
    );
    expect(harness.booksRenderer.compositionSnapshot.allCoversRendered).toBe(
      false,
    );
    expect(harness.booksRenderer.isVisualReady).toBe(true);
  });

  it("keeps activation readiness separate from zero-area composition readiness", () => {
    const state = createState(1440);
    Object.assign(state, {
      anchorWidth: 0,
    });
    const harness = createHarness(1440, 900, state);

    harness.booksRenderer.render();

    expect(harness.renderer.render).toHaveBeenCalledTimes(1);
    expect(harness.booksRenderer.compositionSnapshot.allTexturesReady).toBe(
      true,
    );
    expect(harness.booksRenderer.compositionSnapshot.allCoversRendered).toBe(
      false,
    );
    expect(harness.booksRenderer.isVisualReady).toBe(true);
  });

  it("maps each material to its own cover texture and uploads stable textures only once", () => {
    const harness = createHarness();

    harness.booksRenderer.render();
    const meshes = getSubmittedMeshes(harness.renderer);
    const versions = meshes.map((mesh) => mesh.material.map?.version);
    const mappedSources = Object.fromEntries(
      meshes.map((mesh) => [
        mesh.userData.bookRole,
        (mesh.material.map?.image as HTMLImageElement).src,
      ]),
    );

    harness.booksRenderer.render();

    expect(
      getSubmittedMeshes(harness.renderer).map(
        (mesh) => mesh.material.map?.version,
      ),
    ).toEqual(versions);
    expect(mappedSources).toEqual(
      Object.fromEntries(
        harness.state.covers.map((cover) => [
          cover.role,
          cover.assetSource,
        ]),
      ),
    );
    expect(harness.context.createTexture).not.toHaveBeenCalled();
    expect(harness.context.bindTexture).not.toHaveBeenCalled();
    expect(harness.context.pixelStorei).not.toHaveBeenCalled();
    expect(harness.context.texParameteri).not.toHaveBeenCalled();
    expect(harness.context.texImage2D).not.toHaveBeenCalled();
  });

  it("renders supporting covers before the dominant primary with FrontSide and depthWrite disabled", () => {
    const harness = createHarness();

    harness.booksRenderer.render();

    const meshes = getSubmittedMeshes(harness.renderer);
    expect(meshes.map((mesh) => mesh.userData.bookRole)).toEqual([
      "secondary-left",
      "secondary-right",
      "primary",
    ]);
    meshes.forEach((mesh) => {
      expect(mesh.material.side).toBe(THREE.FrontSide);
      expect(mesh.material.depthWrite).toBe(false);
      expect(mesh.material.transparent).toBe(true);
    });
    const primary = meshes.find(
      (mesh) => mesh.userData.bookRole === "primary",
    )!;
    const left = meshes.find(
      (mesh) => mesh.userData.bookRole === "secondary-left",
    )!;
    const right = meshes.find(
      (mesh) => mesh.userData.bookRole === "secondary-right",
    )!;
    expect(primary.scale.x).toBeGreaterThan(left.scale.x);
    expect(primary.scale.x).toBeGreaterThan(right.scale.x);
    expect(primary.material.opacity).toBeGreaterThan(left.material.opacity);
    expect(primary.material.opacity).toBeGreaterThan(right.material.opacity);
  });

  it("applies deterministic motion and valid projected bounds on desktop", () => {
    const harness = createHarness();

    harness.booksRenderer.render();

    const composition = harness.booksRenderer.compositionSnapshot;
    expect(composition.motion).toEqual(harness.state.motion);
    composition.covers.forEach((cover, index) => {
      expect(cover.rendered).toBe(true);
      expect(cover.visible).toBe(true);
      expect(cover.frustumVisible).toBe(true);
      expect(cover.screen).toBeDefined();
      expect(
        (cover.screen?.bounds.right ?? 0) -
          (cover.screen?.bounds.left ?? 0),
      ).toBeGreaterThan(0);
      expect(
        (cover.screen?.bounds.bottom ?? 0) -
          (cover.screen?.bounds.top ?? 0),
      ).toBeGreaterThan(0);
      expect(composition.projections[index].deltaPx?.x).toBeCloseTo(0, 3);
      expect(composition.projections[index].deltaPx?.y).toBeCloseTo(0, 3);
    });
    expect(composition.supportingVisibility.leftExposedFraction).toBeGreaterThan(
      0.2,
    );
    expect(
      composition.supportingVisibility.rightExposedFraction,
    ).toBeGreaterThan(0.2);
  });

  it("keeps a compact one-primary/two-support composition recognizable on mobile", () => {
    const state = createState(390);
    const harness = createHarness(390, 844, state);

    harness.booksRenderer.render();

    const composition = harness.booksRenderer.compositionSnapshot;
    expect(composition.allCoversRendered).toBe(true);
    expect(composition.covers[0].screen?.bounds.left).toBeGreaterThanOrEqual(0);
    expect(composition.covers[0].screen?.bounds.right).toBeLessThanOrEqual(390);
    expect(composition.supportingVisibility.leftExposedFraction).toBeGreaterThan(
      0.2,
    );
    expect(
      composition.supportingVisibility.rightExposedFraction,
    ).toBeGreaterThan(0.2);
    expect(harness.booksRenderer.isVisualReady).toBe(true);
  });

  it("releases old responsive texture owners before mapping the mobile cover sources", () => {
    const harness = createHarness();
    harness.booksRenderer.render();
    const desktopSources = harness.state.covers.map(
      (cover) => cover.assetSource,
    );
    const mobileState = createState(390);
    registerReadyCovers(harness.assetRegistry, mobileState);
    Object.assign(harness.state, mobileState);
    harness.snapshot.updateViewport({
      width: 390,
      height: 844,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 2,
      isPortrait: true,
    });

    harness.booksRenderer.render();

    desktopSources.forEach((source) => {
      expect(
        harness.booksRenderer.resourceSnapshot.ownerCounts[
          `texture:${source}`
        ],
      ).toBe(0);
    });
    harness.state.covers.forEach((cover) => {
      expect(
        harness.booksRenderer.resourceSnapshot.ownerCounts[
          `texture:${cover.assetSource}`
        ],
      ).toBe(1);
    });
  });

  it("retains the seven Books GPU leases when the active scene is cached", () => {
    const harness = createHarness();
    harness.booksRenderer.render();
    const ownerCounts = {
      ...harness.booksRenderer.resourceSnapshot.ownerCounts,
    };
    Object.assign(harness.state, {
      isActive: false,
      isCached: true,
    });

    harness.booksRenderer.render();

    expect(harness.renderer.render).toHaveBeenCalledTimes(1);
    expect(harness.booksRenderer.resourceSnapshot.ownerCounts).toEqual(
      ownerCounts,
    );
    expect(
      Object.values(ownerCounts).filter((ownerCount) => ownerCount === 1),
    ).toHaveLength(7);
    expect(harness.booksRenderer.compositionSnapshot.allCoversRendered).toBe(
      false,
    );
  });

  it("disposes only its seven Books leases and preserves unrelated resources and the shared renderer", () => {
    const harness = createHarness();
    harness.gpuResourceManager.acquireGeometry(
      "about-scene:portrait-geometry",
      "about-scene",
      () => new THREE.PlaneGeometry(1, 1),
    );
    harness.booksRenderer.render();

    harness.booksRenderer.dispose();
    harness.booksRenderer.dispose();

    expect(
      harness.booksRenderer.resourceSnapshot.ownerCounts[
        `geometry:${BOOKS_COVER_GEOMETRY_RESOURCE_ID}`
      ],
    ).toBe(0);
    harness.state.covers.forEach((cover) => {
      expect(
        harness.booksRenderer.resourceSnapshot.ownerCounts[
          `texture:${cover.assetSource}`
        ],
      ).toBe(0);
      expect(
        harness.booksRenderer.resourceSnapshot.ownerCounts[
          `material:${getBooksCoverMaterialResourceId(cover.id)}`
        ],
      ).toBe(0);
      expect(getBooksCoverTextureOwnerId(cover.id)).toContain(BOOKS_SCENE_ID);
    });
    expect(
      harness.booksRenderer.resourceSnapshot.ownerCounts[
        "geometry:about-scene:portrait-geometry"
      ],
    ).toBe(1);
    expect(harness.renderer.dispose).not.toHaveBeenCalled();
    expect(harness.renderer.info.reset).not.toHaveBeenCalled();
  });
});
