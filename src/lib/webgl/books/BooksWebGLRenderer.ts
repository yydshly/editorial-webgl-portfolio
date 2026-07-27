import * as THREE from "three";

import type MotionSnapshotStore from "@/lib/motion/MotionSnapshotStore";
import type AssetRegistry from "@/lib/webgl/AssetRegistry";
import type GPUResourceManager from "@/lib/webgl/GPUResourceManager";
import type { GPUResourceSnapshot } from "@/lib/webgl/GPUResourceManager";
import { snapshotWebGLLayerComposition } from "@/lib/webgl/WebGLCompositionProjection";
import { resolveScenePlaneWorldLayout } from "@/lib/webgl/SceneWorldLayout";
import type {
  WebGLAnchorProjectionSnapshot,
  WebGLLayerCompositionSnapshot,
} from "@/lib/webgl/WebGLCompositionSnapshot";
import type { BooksCompositionSnapshot } from "@/lib/webgl/books/BooksCompositionSnapshot";
import type {
  BooksCoverAssetState,
  BooksSceneState,
} from "@/lib/webgl/books/BooksScene";
import type { BooksCoverMotion } from "@/lib/webgl/books/BooksSceneMotion";
import {
  booksAssetManifest,
  type BooksCoverRole,
} from "@/lib/webgl/books/booksAssetManifest";
import {
  BOOKS_COVER_GEOMETRY_RESOURCE_ID,
  BOOKS_MOBILE_BREAKPOINT,
  BOOKS_SCENE_ID,
  getBooksCoverMaterialResourceId,
  getBooksCoverTextureOwnerId,
} from "@/lib/webgl/books/booksSceneConfig";

type BooksWebGLRendererInput = {
  readonly context: WebGLRenderingContext;
  readonly renderer: THREE.WebGLRenderer;
  readonly snapshot: MotionSnapshotStore;
  readonly assetRegistry: AssetRegistry<HTMLImageElement>;
  readonly gpuResourceManager: GPUResourceManager;
  readonly camera: THREE.PerspectiveCamera;
  readonly getBooksState: () => BooksSceneState;
};

type CoverMesh = THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

type TextureBinding = {
  readonly source: string;
  readonly texture: THREE.Texture;
};

const ROLE_RENDER_ORDER: readonly BooksCoverRole[] = [
  "secondary-left",
  "secondary-right",
  "primary",
];
const MANIFEST_ROLE_ORDER = booksAssetManifest.covers.map(
  (cover) => cover.visualRole,
) as [BooksCoverRole, BooksCoverRole, BooksCoverRole];
const MIN_VIEWPORT_SIZE = 1;

export default class BooksWebGLRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly snapshot: MotionSnapshotStore;
  private readonly assetRegistry: AssetRegistry<HTMLImageElement>;
  private readonly gpuResourceManager: GPUResourceManager;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly getBooksState: () => BooksSceneState;
  private readonly scene = new THREE.Scene();
  private readonly geometry: THREE.PlaneGeometry;
  private readonly materials = new Map<
    string,
    THREE.MeshBasicMaterial
  >();
  private readonly meshes = new Map<string, CoverMesh>();
  private readonly textureBindings = new Map<string, TextureBinding>();
  private readonly renderedThisFrame = new Map<string, boolean>();
  private disposed = false;
  private currentMotion: BooksCoverMotion;

  constructor({
    context,
    renderer,
    snapshot,
    assetRegistry,
    gpuResourceManager,
    camera,
    getBooksState,
  }: BooksWebGLRendererInput) {
    this.renderer = renderer;
    this.snapshot = snapshot;
    this.assetRegistry = assetRegistry;
    this.gpuResourceManager = gpuResourceManager;
    this.camera = camera;
    this.getBooksState = getBooksState;
    this.currentMotion = cloneMotion(getBooksState().motion);

    this.gpuResourceManager.setContext(context);
    const geometry = this.gpuResourceManager.acquireGeometry(
      BOOKS_COVER_GEOMETRY_RESOURCE_ID,
      BOOKS_SCENE_ID,
      () => new THREE.PlaneGeometry(1, 1),
    );
    if (!geometry) {
      throw new Error("Failed to initialize the shared Books cover geometry.");
    }
    this.geometry = geometry;

    for (const cover of booksAssetManifest.covers) {
      const material = this.gpuResourceManager.acquireMaterial(
        getBooksCoverMaterialResourceId(cover.id),
        BOOKS_SCENE_ID,
        () =>
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 1,
            side: THREE.FrontSide,
            depthWrite: false,
          }),
      );
      if (!material) {
        this.dispose();
        throw new Error(
          `Failed to initialize Books material for "${cover.id}".`,
        );
      }

      const mesh = new THREE.Mesh(this.geometry, material);
      mesh.name = `books-cover:${cover.id}`;
      mesh.userData.bookId = cover.id;
      mesh.userData.bookRole = cover.visualRole;
      mesh.renderOrder = ROLE_RENDER_ORDER.indexOf(cover.visualRole);
      mesh.visible = false;
      this.materials.set(cover.id, material);
      this.meshes.set(cover.id, mesh);
      this.renderedThisFrame.set(cover.id, false);
    }

    for (const role of ROLE_RENDER_ORDER) {
      const cover = booksAssetManifest.covers.find(
        (candidate) => candidate.visualRole === role,
      );
      const mesh = cover ? this.meshes.get(cover.id) : null;
      if (mesh) {
        this.scene.add(mesh);
      }
    }
  }

  render(): void {
    if (this.disposed) {
      return;
    }

    this.resetRenderedState();
    const state = this.getBooksState();
    const allTexturesReady = this.updateTextures(state);
    if (
      !state.isActive ||
      state.isCached ||
      state.isDisposed ||
      !state.isAnchored ||
      !state.anchorWorld ||
      !state.anchorViewport ||
      !allTexturesReady
    ) {
      this.hideAllMeshes();
      return;
    }

    const viewport = this.snapshot.viewport;
    const viewportWidth = Math.max(MIN_VIEWPORT_SIZE, viewport.width);
    const viewportHeight = Math.max(MIN_VIEWPORT_SIZE, viewport.height);
    const coverWidth = resolveCoverWidth(
      viewportWidth,
      state.anchorWidth,
    );
    const coverHeight = coverWidth * 1.5;
    this.currentMotion = cloneMotion(state.motion);

    for (const cover of state.covers) {
      const mesh = this.meshes.get(cover.id);
      const material = this.materials.get(cover.id);
      if (!mesh || !material) {
        this.hideAllMeshes();
        return;
      }
      const pose = state.motion[cover.role];
      const layout = resolveScenePlaneWorldLayout({
        camera: this.camera,
        anchor: state.anchorWorld,
        anchorScreen: state.anchorViewport,
        viewportWidth,
        viewportHeight,
        widthPx: coverWidth,
        heightPx: coverHeight,
        translateXpx: pose.translateX,
        translateYpx: pose.translateY,
        depthOffsetPx: pose.depthOffsetPx,
        scale: pose.scale,
      });

      mesh.position.set(
        layout.position.x,
        layout.position.y,
        layout.position.z,
      );
      mesh.scale.set(
        layout.scale.x,
        layout.scale.y,
        layout.scale.z,
      );
      material.opacity = pose.opacity;
      mesh.visible = true;
    }

    this.renderer.render(this.scene, this.camera);
    for (const cover of state.covers) {
      this.renderedThisFrame.set(cover.id, true);
    }
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.hideAllMeshes();
    this.resetRenderedState();
    for (const cover of booksAssetManifest.covers) {
      this.releaseTexture(cover.id);
      this.gpuResourceManager.releaseMaterial(
        getBooksCoverMaterialResourceId(cover.id),
        BOOKS_SCENE_ID,
      );
    }
    this.gpuResourceManager.releaseGeometry(
      BOOKS_COVER_GEOMETRY_RESOURCE_ID,
      BOOKS_SCENE_ID,
    );
  }

  get isVisualReady(): boolean {
    const snapshot = this.compositionSnapshot;
    return (
      snapshot.allTexturesReady &&
      snapshot.meshCount === 3 &&
      snapshot.geometryCount === 1 &&
      snapshot.materialCount === 3
    );
  }

  get resourceSnapshot(): GPUResourceSnapshot {
    return this.gpuResourceManager.snapshot;
  }

  get compositionSnapshot(): BooksCompositionSnapshot {
    const state = this.getBooksState();
    const covers = state.covers.map((cover) =>
      this.snapshotCover(cover),
    ) as [
      WebGLLayerCompositionSnapshot,
      WebGLLayerCompositionSnapshot,
      WebGLLayerCompositionSnapshot,
    ];
    const projections = state.covers.map((cover, index) =>
      createProjectionSnapshot(
        state,
        cover.role,
        covers[index],
        this.snapshot.viewport,
      ),
    ) as [
      WebGLAnchorProjectionSnapshot,
      WebGLAnchorProjectionSnapshot,
      WebGLAnchorProjectionSnapshot,
    ];

    return {
      covers,
      projections,
      roleOrder: [...MANIFEST_ROLE_ORDER],
      textureSources: state.covers.map(
        (cover) => this.textureBindings.get(cover.id)?.source ?? null,
      ) as [string | null, string | null, string | null],
      meshCount: 3,
      geometryCount: 1,
      materialCount: 3,
      textureCount: this.textureBindings.size,
      expectedDrawCalls: 3,
      allTexturesReady: this.areAllTexturesReady(state),
      allCoversRendered: covers.every(isCoverActuallyRendered),
      materialSides: state.covers.map(
        (cover) => this.materials.get(cover.id)?.side ?? -1,
      ) as [number, number, number],
      depthWrites: state.covers.map(
        (cover) => this.materials.get(cover.id)?.depthWrite ?? true,
      ) as [boolean, boolean, boolean],
      motion: cloneMotion(this.currentMotion),
      supportingVisibility: resolveSupportingVisibility(covers),
    };
  }

  private updateTextures(state: BooksSceneState): boolean {
    for (const cover of state.covers) {
      if (!this.updateTexture(cover)) {
        return false;
      }
    }
    return true;
  }

  private updateTexture(cover: BooksCoverAssetState): boolean {
    const material = this.materials.get(cover.id);
    if (!material) {
      return false;
    }
    if (!cover.isAssetReady) {
      this.releaseTexture(cover.id);
      return false;
    }

    const image = this.assetRegistry.getData(cover.assetId);
    const descriptor = this.assetRegistry.get(cover.assetId);
    if (!image || descriptor?.src !== cover.assetSource) {
      this.releaseTexture(cover.id);
      return false;
    }

    const current = this.textureBindings.get(cover.id);
    if (current?.source === cover.assetSource) {
      return material.map === current.texture;
    }

    this.releaseTexture(cover.id);
    const texture = this.gpuResourceManager.acquireTexture<THREE.Texture>(
      cover.assetSource,
      getBooksCoverTextureOwnerId(cover.id),
      () => {
        const created = new THREE.Texture(image);
        created.colorSpace = THREE.SRGBColorSpace;
        created.minFilter = THREE.LinearFilter;
        created.magFilter = THREE.LinearFilter;
        created.wrapS = THREE.ClampToEdgeWrapping;
        created.wrapT = THREE.ClampToEdgeWrapping;
        created.premultiplyAlpha = true;
        created.flipY = true;
        created.generateMipmaps = true;
        created.needsUpdate = true;
        return created;
      },
      (resource) => {
        (resource as THREE.Texture).dispose();
      },
    );
    if (!texture) {
      return false;
    }

    this.textureBindings.set(cover.id, {
      source: cover.assetSource,
      texture,
    });
    material.map = texture;
    material.needsUpdate = true;
    return true;
  }

  private releaseTexture(bookId: string): void {
    const current = this.textureBindings.get(bookId);
    if (!current) {
      return;
    }

    this.gpuResourceManager.releaseTexture(
      current.source,
      getBooksCoverTextureOwnerId(bookId),
    );
    this.textureBindings.delete(bookId);
    const material = this.materials.get(bookId);
    if (material) {
      material.map = null;
      material.needsUpdate = true;
    }
  }

  private areAllTexturesReady(state: BooksSceneState): boolean {
    return state.covers.every((cover) => {
      const binding = this.textureBindings.get(cover.id);
      return (
        cover.isAssetReady &&
        binding?.source === cover.assetSource &&
        this.materials.get(cover.id)?.map === binding.texture
      );
    });
  }

  private snapshotCover(
    cover: BooksCoverAssetState,
  ): WebGLLayerCompositionSnapshot {
    const mesh = this.meshes.get(cover.id);
    if (!mesh) {
      throw new Error(`Missing Books mesh for "${cover.id}".`);
    }
    return snapshotWebGLLayerComposition(
      mesh,
      this.camera,
      this.renderedThisFrame.get(cover.id) === true,
      this.snapshot.viewport,
    );
  }

  private hideAllMeshes(): void {
    for (const mesh of this.meshes.values()) {
      mesh.visible = false;
    }
  }

  private resetRenderedState(): void {
    for (const cover of booksAssetManifest.covers) {
      this.renderedThisFrame.set(cover.id, false);
    }
  }
}

function resolveCoverWidth(
  viewportWidth: number,
  anchorWidth: number,
): number {
  const mobile = viewportWidth <= BOOKS_MOBILE_BREAKPOINT;
  return Math.min(
    anchorWidth * (mobile ? 0.52 : 0.42),
    viewportWidth * (mobile ? 0.54 : 0.22),
    mobile ? 210 : 280,
  );
}

function createProjectionSnapshot(
  state: BooksSceneState,
  role: BooksCoverRole,
  cover: WebGLLayerCompositionSnapshot,
  viewport: {
    readonly width: number;
    readonly height: number;
    readonly devicePixelRatio: number;
  },
): WebGLAnchorProjectionSnapshot {
  const expectedScreenCenter = state.anchorViewport
    ? {
        x: state.anchorViewport.x + state.motion[role].translateX,
        y: state.anchorViewport.y + state.motion[role].translateY,
      }
    : null;
  const projectedScreenCenter = cover.screen?.center ?? null;

  return {
    anchorRectCenter: state.anchorViewport
      ? { ...state.anchorViewport }
      : null,
    expectedScreenCenter,
    projectedScreenCenter,
    deltaPx:
      expectedScreenCenter && projectedScreenCenter
        ? {
            x: projectedScreenCenter.x - expectedScreenCenter.x,
            y: projectedScreenCenter.y - expectedScreenCenter.y,
          }
        : null,
    viewport: {
      width: viewport.width,
      height: viewport.height,
      devicePixelRatio: viewport.devicePixelRatio,
    },
  };
}

function resolveSupportingVisibility(
  covers: readonly [
    WebGLLayerCompositionSnapshot,
    WebGLLayerCompositionSnapshot,
    WebGLLayerCompositionSnapshot,
  ],
): {
  readonly leftExposedFraction: number;
  readonly rightExposedFraction: number;
} {
  const primary = covers[0].screen?.bounds;
  const left = covers[1].screen?.bounds;
  const right = covers[2].screen?.bounds;
  if (!primary || !left || !right) {
    return {
      leftExposedFraction: 0,
      rightExposedFraction: 0,
    };
  }

  const leftWidth = Math.max(1, left.right - left.left);
  const rightWidth = Math.max(1, right.right - right.left);
  return {
    leftExposedFraction: clamp(
      (Math.min(primary.left, left.right) - left.left) / leftWidth,
      0,
      1,
    ),
    rightExposedFraction: clamp(
      (right.right - Math.max(primary.right, right.left)) / rightWidth,
      0,
      1,
    ),
  };
}

function isCoverActuallyRendered(
  cover: WebGLLayerCompositionSnapshot,
): boolean {
  const bounds = cover.screen?.bounds;
  return Boolean(
    cover.rendered &&
      cover.visible &&
      cover.frustumVisible &&
      bounds &&
      bounds.right - bounds.left > 0 &&
      bounds.bottom - bounds.top > 0,
  );
}

function cloneMotion(motion: BooksCoverMotion): BooksCoverMotion {
  return {
    primary: { ...motion.primary },
    "secondary-left": { ...motion["secondary-left"] },
    "secondary-right": { ...motion["secondary-right"] },
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
