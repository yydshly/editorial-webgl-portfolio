import * as THREE from "three";

import type MotionSnapshotStore from "@/lib/motion/MotionSnapshotStore";
import type AssetRegistry from "@/lib/webgl/AssetRegistry";
import type GPUResourceManager from "@/lib/webgl/GPUResourceManager";
import type { GPUResourceSnapshot } from "@/lib/webgl/GPUResourceManager";
import { resolveScenePlaneWorldLayout } from "@/lib/webgl/SceneWorldLayout";
import type {
  WebGLAnchorProjectionSnapshot,
  WebGLLayerCompositionSnapshot,
  WebGLTextureSamplingSnapshot,
} from "@/lib/webgl/WebGLCompositionSnapshot";
import { snapshotWebGLLayerComposition } from "@/lib/webgl/WebGLCompositionProjection";
import type { AboutSceneState } from "@/lib/webgl/about/AboutScene";
import {
  resolveAboutPortraitMotion,
  type AboutPortraitMotion,
} from "@/lib/webgl/about/AboutSceneMotion";
import {
  ABOUT_PORTRAIT_TEXTURE_OWNER_ID,
  ABOUT_SCENE_ID,
  aboutSceneConfig,
} from "@/lib/webgl/about/aboutSceneConfig";

const GEOMETRY_RESOURCE_ID = `${ABOUT_SCENE_ID}:portrait-geometry`;
const MATERIAL_RESOURCE_ID = `${ABOUT_SCENE_ID}:portrait-material`;
const MIN_VIEWPORT_SIZE = 1;

type AboutWebGLRendererInput = {
  readonly context: WebGLRenderingContext;
  readonly renderer: THREE.WebGLRenderer;
  readonly snapshot: MotionSnapshotStore;
  readonly assetRegistry: AssetRegistry<HTMLImageElement>;
  readonly gpuResourceManager: GPUResourceManager;
  readonly camera: THREE.PerspectiveCamera;
  readonly getAboutState: () => AboutSceneState;
};

export type AboutCompositionSnapshot = {
  readonly portrait: WebGLLayerCompositionSnapshot;
  readonly projection: WebGLAnchorProjectionSnapshot;
  readonly meshCount: 1;
  readonly materialSide: number;
  readonly materialColorMultiplier: number;
  readonly managerOwnsMaterialTexture: boolean;
  readonly motion: AboutPortraitMotion;
  readonly manifest: {
    readonly crop: {
      readonly x: number;
      readonly y: number;
      readonly width: number;
      readonly height: number;
    };
    readonly focalPoint: {
      readonly x: number;
      readonly y: number;
    };
    readonly uv: readonly number[];
    readonly croppedAspect: number;
    readonly projectedFocalPoint: {
      readonly x: number;
      readonly y: number;
    };
  };
};

export default class AboutWebGLRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly snapshot: MotionSnapshotStore;
  private readonly assetRegistry: AssetRegistry<HTMLImageElement>;
  private readonly gpuResourceManager: GPUResourceManager;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly getAboutState: () => AboutSceneState;
  private readonly scene = new THREE.Scene();
  private readonly geometry: THREE.PlaneGeometry;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private textureSource: string | null = null;
  private textureCache: THREE.Texture | null = null;
  private renderedThisFrame = false;
  private disposed = false;
  private appliedCropKey = "";
  private currentMotion: AboutPortraitMotion =
    aboutSceneConfig.motion.stagePoses[0];

  constructor({
    context,
    renderer,
    snapshot,
    assetRegistry,
    gpuResourceManager,
    camera,
    getAboutState,
  }: AboutWebGLRendererInput) {
    this.renderer = renderer;
    this.snapshot = snapshot;
    this.assetRegistry = assetRegistry;
    this.gpuResourceManager = gpuResourceManager;
    this.camera = camera;
    this.getAboutState = getAboutState;

    this.gpuResourceManager.setContext(context);
    const geometry = this.gpuResourceManager.acquireGeometry(
      GEOMETRY_RESOURCE_ID,
      ABOUT_SCENE_ID,
      () => new THREE.PlaneGeometry(1, 1),
    );
    const material = this.gpuResourceManager.acquireMaterial(
      MATERIAL_RESOURCE_ID,
      ABOUT_SCENE_ID,
      () =>
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: aboutSceneConfig.portrait.plane.opacity,
          side: THREE.FrontSide,
          depthWrite: false,
        }),
    );
    if (!geometry || !material) {
      throw new Error("Failed to initialize About portrait renderer resources.");
    }

    this.geometry = geometry;
    this.material = material;
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  render(): void {
    if (this.disposed) {
      return;
    }

    this.renderedThisFrame = false;
    const state = this.getAboutState();
    if (
      !state.isActive ||
      !state.isAnchored ||
      !state.anchorWorld ||
      !state.anchorViewport ||
      !this.updateTexture(state)
    ) {
      this.mesh.visible = false;
      return;
    }

    const viewport = this.snapshot.viewport;
    const viewportWidth = Math.max(MIN_VIEWPORT_SIZE, viewport.width);
    const viewportHeight = Math.max(MIN_VIEWPORT_SIZE, viewport.height);
    const variant = aboutSceneConfig.portrait.selectVariant(viewportWidth);
    this.applyManifestCrop(variant.crop);
    const widthPx = this.resolvePlaneWidth(state.anchorWidth);
    const croppedAspect =
      (variant.width * variant.crop.width) /
      (variant.height * variant.crop.height);
    const heightPx = widthPx / croppedAspect;
    const focalWithinCrop = {
      x: (variant.focalPoint.x - variant.crop.x) / variant.crop.width,
      y: (variant.focalPoint.y - variant.crop.y) / variant.crop.height,
    };
    const focalTranslation = {
      x: (0.5 - focalWithinCrop.x) * widthPx,
      y: (0.5 - focalWithinCrop.y) * heightPx,
    };
    const motion = resolveAboutPortraitMotion({
      activeStageIndex: state.activeStageIndex,
      stageProgress: state.stageProgress,
      reducedMotion: state.reducedMotion,
      viewportWidth,
    });
    this.currentMotion = motion;
    const layout = resolveScenePlaneWorldLayout({
      camera: this.camera,
      anchor: state.anchorWorld,
      anchorScreen: state.anchorViewport,
      viewportWidth,
      viewportHeight,
      widthPx,
      heightPx,
      translateXpx: focalTranslation.x + motion.translateX,
      translateYpx: focalTranslation.y + motion.translateY,
      depthOffsetPx: aboutSceneConfig.portrait.plane.z,
      scale: motion.scale,
    });

    this.mesh.position.set(
      layout.position.x,
      layout.position.y,
      layout.position.z,
    );
    this.mesh.scale.set(layout.scale.x, layout.scale.y, layout.scale.z);
    this.material.opacity =
      aboutSceneConfig.portrait.plane.opacity * motion.opacity;
    this.material.color.setScalar(motion.colorMultiplier);
    this.mesh.visible = true;

    this.renderer.render(this.scene, this.camera);
    this.renderedThisFrame = true;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.renderedThisFrame = false;
    this.mesh.visible = false;
    this.releaseTexture();
    this.gpuResourceManager.releaseGeometry(
      GEOMETRY_RESOURCE_ID,
      ABOUT_SCENE_ID,
    );
    this.gpuResourceManager.releaseMaterial(
      MATERIAL_RESOURCE_ID,
      ABOUT_SCENE_ID,
    );
  }

  get resourceSnapshot(): GPUResourceSnapshot {
    return this.gpuResourceManager.snapshot;
  }

  get textureSamplingSnapshot(): WebGLTextureSamplingSnapshot {
    const image = this.textureCache?.image as HTMLImageElement | undefined;
    return {
      source: this.textureSource,
      decodedWidth: image?.naturalWidth ?? image?.width ?? 0,
      decodedHeight: image?.naturalHeight ?? image?.height ?? 0,
      minFilter: this.textureCache ? "LinearFilter" : null,
      magFilter: this.textureCache ? "LinearFilter" : null,
      generateMipmaps: this.textureCache?.generateMipmaps ?? null,
      anisotropy: this.textureCache?.anisotropy ?? null,
      colorSpace: this.textureCache?.colorSpace ?? null,
      premultiplyAlpha: this.textureCache?.premultiplyAlpha ?? null,
      flipY: this.textureCache?.flipY ?? null,
    };
  }

  get compositionSnapshot(): AboutCompositionSnapshot {
    const state = this.getAboutState();
    const portrait = snapshotWebGLLayerComposition(
      this.mesh,
      this.camera,
      this.renderedThisFrame,
      this.snapshot.viewport,
    );
    const variant = aboutSceneConfig.portrait.selectVariant(
      this.snapshot.viewport.width,
    );
    const expectedScreenCenter = state.anchorViewport
      ? {
          x:
            state.anchorViewport.x +
            (0.5 -
              (variant.focalPoint.x - variant.crop.x) / variant.crop.width) *
              this.resolvePlaneWidth(state.anchorWidth) +
            this.currentMotion.translateX,
          y:
            state.anchorViewport.y +
            (0.5 -
              (variant.focalPoint.y - variant.crop.y) / variant.crop.height) *
              (this.resolvePlaneWidth(state.anchorWidth) /
                ((variant.width * variant.crop.width) /
                  (variant.height * variant.crop.height))) +
            this.currentMotion.translateY,
        }
      : null;
    const projectedScreenCenter = portrait.screen?.center ?? null;
    const screenBounds = portrait.screen?.bounds;
    const focalWithinCrop = {
      x: (variant.focalPoint.x - variant.crop.x) / variant.crop.width,
      y: (variant.focalPoint.y - variant.crop.y) / variant.crop.height,
    };
    const projectedFocalPoint = screenBounds
      ? {
          x:
            screenBounds.left +
            (screenBounds.right - screenBounds.left) * focalWithinCrop.x,
          y:
            screenBounds.top +
            (screenBounds.bottom - screenBounds.top) * focalWithinCrop.y,
        }
      : { x: 0, y: 0 };
    const uv = this.geometry.getAttribute("uv");

    return {
      portrait,
      projection: {
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
          width: this.snapshot.viewport.width,
          height: this.snapshot.viewport.height,
          devicePixelRatio: this.snapshot.viewport.devicePixelRatio,
        },
      },
      meshCount: 1,
      materialSide: this.material.side,
      materialColorMultiplier: this.material.color.r,
      motion: { ...this.currentMotion },
      managerOwnsMaterialTexture:
        this.textureSource !== null &&
        this.gpuResourceManager.ownsTextureResource(
          this.textureSource,
          this.material.map,
        ),
      manifest: {
        crop: { ...variant.crop },
        focalPoint: { ...variant.focalPoint },
        uv: Array.from(uv.array),
        croppedAspect:
          (variant.width * variant.crop.width) /
          (variant.height * variant.crop.height),
        projectedFocalPoint,
      },
    };
  }

  private updateTexture(state: AboutSceneState): boolean {
    if (!state.portrait.isAssetReady) {
      this.releaseTexture();
      return false;
    }
    const data = this.assetRegistry.getData(state.portrait.assetId);
    const registeredAsset = this.assetRegistry.get(state.portrait.assetId);
    if (!data || registeredAsset?.src !== state.portrait.assetSource) {
      this.releaseTexture();
      return false;
    }
    if (this.textureSource === state.portrait.assetSource && this.textureCache) {
      return true;
    }

    this.releaseTexture();
    const texture = this.gpuResourceManager.acquireTexture<THREE.Texture>(
      state.portrait.assetSource,
      ABOUT_PORTRAIT_TEXTURE_OWNER_ID,
      () => {
        const texture = new THREE.Texture(data);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        texture.premultiplyAlpha = true;
        texture.flipY = true;
        texture.needsUpdate = true;
        return texture;
      },
      (resource) => {
        (resource as THREE.Texture).dispose();
      },
    );
    if (!texture) {
      return false;
    }

    this.textureSource = state.portrait.assetSource;
    this.textureCache = texture;
    this.material.map = texture;
    this.material.needsUpdate = true;
    return true;
  }

  private releaseTexture(): void {
    if (!this.textureSource) {
      return;
    }

    this.gpuResourceManager.releaseTexture(
      this.textureSource,
      ABOUT_PORTRAIT_TEXTURE_OWNER_ID,
    );
    this.textureCache = null;
    this.textureSource = null;
    this.material.map = null;
    this.material.needsUpdate = true;
  }

  private applyManifestCrop(crop: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }): void {
    const cropKey = `${crop.x}:${crop.y}:${crop.width}:${crop.height}`;
    if (cropKey === this.appliedCropKey) {
      return;
    }

    const uv = this.geometry.getAttribute("uv") as THREE.BufferAttribute;
    const uMin = crop.x;
    const uMax = crop.x + crop.width;
    const vTop = 1 - crop.y;
    const vBottom = 1 - (crop.y + crop.height);
    uv.setXY(0, uMin, vTop);
    uv.setXY(1, uMax, vTop);
    uv.setXY(2, uMin, vBottom);
    uv.setXY(3, uMax, vBottom);
    uv.needsUpdate = true;
    this.appliedCropKey = cropKey;
  }

  private resolvePlaneWidth(anchorWidth: number): number {
    const viewportWidth = Math.max(
      MIN_VIEWPORT_SIZE,
      this.snapshot.viewport.width,
    );
    return Math.min(
      anchorWidth || Number.POSITIVE_INFINITY,
      viewportWidth * aboutSceneConfig.portrait.plane.maxViewportWidthRatio,
      viewportWidth <= aboutSceneConfig.mobileBreakpoint
        ? aboutSceneConfig.portrait.plane.mobileWidth
        : aboutSceneConfig.portrait.plane.desktopWidth,
    );
  }
}
