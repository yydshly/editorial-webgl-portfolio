import * as THREE from "three";

import type { HeroSceneState } from "@/lib/webgl/hero/HeroScene";
import type { HeroSceneConfig } from "@/lib/webgl/hero/heroSceneConfig";
import type AssetRegistry from "@/lib/webgl/AssetRegistry";
import type MotionSnapshotStore from "@/lib/motion/MotionSnapshotStore";
import GPUResourceManager, { type GPUResourceSnapshot } from "@/lib/webgl/GPUResourceManager";
import RenderScheduler from "@/lib/webgl/RenderScheduler";
import { resolveScenePlaneWorldLayout } from "@/lib/webgl/SceneWorldLayout";
import type {
  WebGLHeroForegroundCropSnapshot,
  WebGLLayerCompositionSnapshot,
} from "@/lib/webgl/WebGLCompositionSnapshot";
import { snapshotWebGLLayerComposition } from "@/lib/webgl/WebGLCompositionProjection";
import {
  projectMeshLocalRect,
  resolveHeroForegroundRegistrationLayout,
  type HeroForegroundRegistrationLayout,
  type HeroForegroundScreenRect,
} from "@/lib/webgl/hero/HeroForegroundRegistration";

const MAX_PARALLAX_ANGLE_RADIANS = 0.18;
const DEFAULT_VIEWPORT_SIZE = 1;
const DESIGN_DEPTH_UNIT_PX = 100;
const HERO_FOREGROUND_DEPTH = 0.35;

type HeroWebGLRendererInput = {
  readonly canvas: HTMLCanvasElement;
  readonly context: WebGLRenderingContext;
  readonly renderer: THREE.WebGLRenderer;
  readonly snapshot: MotionSnapshotStore;
  readonly assetRegistry: AssetRegistry<HTMLImageElement>;
  readonly config: HeroSceneConfig;
  readonly camera: THREE.PerspectiveCamera;
  readonly scheduler: RenderScheduler;
  readonly getHeroState: () => HeroSceneState;
  readonly onReady?: () => void;
};

type UVRectConfig = {
  readonly uMin: number;
  readonly uMax: number;
  readonly vMin: number;
  readonly vMax: number;
};

export default class HeroWebGLRenderer {
  private readonly gl: WebGLRenderingContext;
  private readonly snapshot: MotionSnapshotStore;
  private readonly config: HeroSceneConfig;
  private readonly getHeroState: () => HeroSceneState;
  private readonly assetRegistry: AssetRegistry<HTMLImageElement>;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly gpuResourceManager = new GPUResourceManager();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly portraitGeometry: THREE.PlaneGeometry;
  private readonly portraitMaterial: THREE.MeshBasicMaterial;
  private readonly portraitMesh: THREE.Mesh;
  private readonly foregroundGeometry: THREE.PlaneGeometry | null;
  private readonly foregroundMaterial: THREE.MeshBasicMaterial | null;
  private readonly foregroundMesh: THREE.Mesh | null;
  private readonly hasForeground: boolean;
  private readonly foregroundScaleMultiplier: number;
  private foregroundUvRect: UVRectConfig;
  private disposed = false;
  private textureCache: THREE.Texture | null = null;
  private textureAssetId: string | null = null;
  private textureAspect: number;
  private textureWidth = 0;
  private textureHeight = 0;
  private readonly textureOwnerId: string;
  private renderedThisFrame = false;
  private foregroundRegistrationLayout: HeroForegroundRegistrationLayout | null = null;

  constructor({
    context,
    renderer,
    snapshot,
    assetRegistry,
    config,
    camera,
    scheduler,
    getHeroState,
    onReady,
  }: HeroWebGLRendererInput) {
    this.gl = context;
    this.snapshot = snapshot;
    this.config = config;
    this.getHeroState = getHeroState;
    this.assetRegistry = assetRegistry;
    void scheduler;
    this.camera = camera;
    this.textureAssetId = null;
    this.textureAspect = config.portrait.width / config.portrait.height;
    this.textureOwnerId = `${this.config.id}:texture`;
    this.hasForeground = this.config.foreground.enabled && this.config.foreground.sourceTexture === "portrait";
    this.foregroundScaleMultiplier = this.config.foreground.scaleMultiplier;
    this.foregroundUvRect = this.config.foreground.selectUvRect(this.snapshot.viewport.width);
    this.gpuResourceManager.setContext(context);

    this.renderer = renderer;

    this.scene = new THREE.Scene();

    const portraitGeometry = this.gpuResourceManager.acquireGeometry(
      `${this.config.id}:geometry`,
      "hero-renderer",
      () => new THREE.PlaneGeometry(1, 1),
    );
    const portraitMaterial = this.gpuResourceManager.acquireMaterial(
      `${this.config.id}:material`,
      "hero-renderer",
      () =>
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: 1,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
    );

    if (!portraitGeometry || !portraitMaterial) {
      throw new Error("Failed to initialize hero renderer resources.");
    }

    this.portraitGeometry = portraitGeometry;
    this.portraitMaterial = portraitMaterial;
    this.portraitMesh = new THREE.Mesh(this.portraitGeometry, this.portraitMaterial);
    this.scene.add(this.portraitMesh);

    if (this.hasForeground) {
      const foregroundGeometry = this.gpuResourceManager.acquireGeometry(
        `${this.config.id}:foreground:geometry`,
        "hero-renderer",
        () => new THREE.PlaneGeometry(1, 1),
      );
      const foregroundMaterial = this.gpuResourceManager.acquireMaterial(
        `${this.config.id}:foreground:material`,
        "hero-renderer",
        () =>
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 1,
            side: THREE.DoubleSide,
            depthWrite: false,
          }),
      );

      if (!foregroundGeometry || !foregroundMaterial) {
        throw new Error("Failed to initialize hero foreground renderer resources.");
      }

      this.applyForegroundUvRect(foregroundGeometry, this.foregroundUvRect);
      this.foregroundGeometry = foregroundGeometry;
      this.foregroundMaterial = foregroundMaterial;
      this.foregroundMesh = new THREE.Mesh(this.foregroundGeometry, this.foregroundMaterial);
      this.scene.add(this.foregroundMesh);
    } else {
      this.foregroundGeometry = null;
      this.foregroundMaterial = null;
      this.foregroundMesh = null;
    }

    onReady?.();
  }

  render(): void {
    if (this.disposed) {
      return;
    }

    this.renderedThisFrame = false;
    const state = this.getHeroState();
    if (!state.isActive) {
      this.setLayerVisibility(false);
      return;
    }

    const viewport = this.snapshot.viewport;
    const viewportWidth = Math.max(DEFAULT_VIEWPORT_SIZE, viewport.width);
    const viewportHeight = Math.max(DEFAULT_VIEWPORT_SIZE, viewport.height);
    this.updateForegroundUvRect(viewportWidth);

    this.updateTextureFromRegistry();
    if (!this.textureCache || !state.anchorWorld) {
      this.setLayerVisibility(false);
      return;
    }

    const planeWidth = this.resolvePlaneWidth(viewportWidth);
    const planeHeight = this.resolvePlaneHeight(planeWidth);
    const portraitLayout = resolveScenePlaneWorldLayout({
      camera: this.camera,
      anchor: state.anchorWorld,
      anchorScreen: state.anchorViewport ?? undefined,
      viewportWidth,
      viewportHeight,
      widthPx: planeWidth,
      heightPx: planeHeight,
      translateXpx: state.transform.translateX,
      translateYpx: state.transform.translateY,
      scale: state.transform.scale,
    });
    const rotation = this.resolveRotation(state);

    this.portraitMaterial.opacity = state.transform.opacity;
    this.portraitMesh.visible = true;
    this.portraitMesh.position.set(
      portraitLayout.position.x,
      portraitLayout.position.y,
      portraitLayout.position.z,
    );
    this.portraitMesh.rotation.x = rotation;
    this.portraitMesh.rotation.y = 0;
    this.portraitMesh.rotation.z = rotation;
    this.portraitMesh.scale.set(
      portraitLayout.scale.x,
      portraitLayout.scale.y,
      portraitLayout.scale.z,
    );

    if (this.foregroundMesh && this.foregroundMaterial) {
      const foregroundLayout = resolveHeroForegroundRegistrationLayout({
        portraitMesh: this.portraitMesh,
        camera: this.camera,
        crop: this.foregroundUvRect,
        viewport: {
          width: viewportWidth,
          height: viewportHeight,
        },
        depthOffsetPx: HERO_FOREGROUND_DEPTH * DESIGN_DEPTH_UNIT_PX,
        relativeTranslateXpx:
          state.foregroundTransform.translateX - state.transform.translateX,
        relativeTranslateYpx:
          state.foregroundTransform.translateY - state.transform.translateY,
        relativeScale:
          (state.foregroundTransform.scale / Math.max(0.0001, state.transform.scale)) *
          this.foregroundScaleMultiplier,
      });
      this.foregroundRegistrationLayout = foregroundLayout;
      this.foregroundMesh.visible = true;
      this.foregroundMaterial.opacity = state.foregroundTransform.opacity;
      this.foregroundMesh.position.set(
        foregroundLayout.position.x,
        foregroundLayout.position.y,
        foregroundLayout.position.z,
      );
      this.foregroundMesh.rotation.x = rotation;
      this.foregroundMesh.rotation.y = 0;
      this.foregroundMesh.rotation.z = rotation;
      this.foregroundMesh.scale.set(
        foregroundLayout.scale.x,
        foregroundLayout.scale.y,
        foregroundLayout.scale.z,
      );
    } else {
      this.foregroundRegistrationLayout = null;
    }

    this.renderer.render(this.scene, this.camera);
    this.renderedThisFrame = true;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.renderedThisFrame = false;
    this.setLayerVisibility(false);
    this.releaseTexture();
    this.gpuResourceManager.releaseOwner("hero-renderer");
    this.portraitGeometry.dispose();
    this.portraitMaterial.dispose();

    if (this.foregroundGeometry) {
      this.foregroundGeometry.dispose();
    }

    if (this.foregroundMaterial) {
      this.foregroundMaterial.dispose();
    }
  }

  private updateTextureFromRegistry(): void {
    const assetState = this.assetRegistry.getState(this.config.portraitAssetId);
    if (assetState === "disposed") {
      this.releaseTexture();
      return;
    }

    const image = this.assetRegistry.getData(this.config.portraitAssetId);
    if (!image) {
      return;
    }

    if (this.textureAssetId !== image.src && this.textureAssetId) {
      this.releaseTexture();
    }

    if (this.textureAssetId === image.src && this.textureCache) {
      return;
    }

    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    if (naturalWidth > 0 && naturalHeight > 0) {
      this.textureAspect = naturalWidth / naturalHeight;
      this.textureWidth = naturalWidth;
      this.textureHeight = naturalHeight;
    }

    const texture = this.gpuResourceManager.acquireTexture(
      image.src,
      this.textureOwnerId,
      () => {
        const webGLTexture = this.gl.createTexture();
        if (!webGLTexture) {
          throw new Error("Failed to create texture.");
        }
        return webGLTexture;
      },
      (createdTexture) => {
        this.gl.deleteTexture(createdTexture as WebGLTexture);
      },
    );

    if (!texture) {
      return;
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      image,
    );

    const portraitTexture = new THREE.Texture(image);
    portraitTexture.flipY = true;
    portraitTexture.colorSpace = THREE.SRGBColorSpace;
    portraitTexture.minFilter = THREE.LinearFilter;
    portraitTexture.magFilter = THREE.LinearFilter;
    portraitTexture.premultiplyAlpha = true;
    portraitTexture.wrapS = THREE.ClampToEdgeWrapping;
    portraitTexture.wrapT = THREE.ClampToEdgeWrapping;

    portraitTexture.needsUpdate = true;
    this.textureCache = portraitTexture;
    this.textureAssetId = image.src;
    this.portraitMaterial.map = portraitTexture;
    this.portraitMaterial.needsUpdate = true;
    if (this.foregroundMaterial) {
      this.foregroundMaterial.map = portraitTexture;
      this.foregroundMaterial.needsUpdate = true;
    }
  }

  private releaseTexture(): void {
    if (!this.textureAssetId) {
      return;
    }

    this.gpuResourceManager.releaseTexture(this.textureAssetId, this.textureOwnerId);
    this.textureAssetId = null;
    this.textureCache = null;
    this.portraitMaterial.map = null;
    this.portraitMaterial.needsUpdate = true;

    if (this.foregroundMaterial) {
      this.foregroundMaterial.map = null;
      this.foregroundMaterial.needsUpdate = true;
    }
  }

  get resourceSnapshot(): GPUResourceSnapshot {
    return this.gpuResourceManager.snapshot;
  }

  get compositionSnapshot(): {
    readonly portrait: WebGLLayerCompositionSnapshot;
    readonly foreground: WebGLLayerCompositionSnapshot | null;
    readonly foregroundCrop: WebGLHeroForegroundCropSnapshot | null;
  } {
    const crop = this.foregroundUvRect;
    const portrait = this.snapshotLayer(this.portraitMesh, this.renderedThisFrame);
    const foreground = this.foregroundMesh
      ? this.snapshotLayer(this.foregroundMesh, this.renderedThisFrame)
      : null;
    const cropWidth = this.textureWidth * (crop.uMax - crop.uMin);
    const cropHeight = this.textureHeight * (crop.vMax - crop.vMin);
    const state = this.getHeroState();
    const registration =
      this.foregroundMesh && this.foregroundRegistrationLayout
        ? this.snapshotForegroundRegistration()
        : null;

    return {
      portrait,
      foreground,
      foregroundCrop: this.hasForeground
        ? {
          sourceTextureSize: {
            width: this.textureWidth,
            height: this.textureHeight,
          },
          cropPixels: {
            x: this.textureWidth * crop.uMin,
            y: this.textureHeight * crop.vMin,
            width: cropWidth,
            height: cropHeight,
          },
          uvRect: { ...crop },
          uvOriginConvention: this.config.foreground.uvOrigin,
          textureFlipY: this.textureCache?.flipY ?? true,
          geometryAspect: cropHeight > 0 ? cropWidth / cropHeight : 0,
          responsiveAssetSource: this.textureAssetId,
          cropNormalizedCenter: {
            x: (crop.uMin + crop.uMax) * 0.5,
            y: (crop.vMin + crop.vMax) * 0.5,
          },
          cropPixelAspect: cropHeight > 0 ? cropWidth / cropHeight : 0,
          portraitMotionTransform: { ...state.transform },
          foregroundMotionTransform: { ...state.foregroundTransform },
          foregroundZ: HERO_FOREGROUND_DEPTH,
          registration,
        }
        : null,
    };
  }

  private setLayerVisibility(visible: boolean): void {
    this.portraitMesh.visible = visible;
    if (this.foregroundMesh) {
      this.foregroundMesh.visible = visible;
    }
  }

  private snapshotLayer(
    mesh: THREE.Mesh,
    rendered: boolean,
  ): WebGLLayerCompositionSnapshot {
    return snapshotWebGLLayerComposition(mesh, this.camera, rendered, this.snapshot.viewport);
  }

  private resolvePlaneWidth(viewportWidth: number): number {
    const isPortrait = this.snapshot.viewport.isPortrait;
    const minWidth = isPortrait ? 160 : 190;
    const maxWidth = isPortrait ? Math.min(320, viewportWidth * 0.65) : Math.min(420, viewportWidth * 0.34);
    const idealWidth = isPortrait ? viewportWidth * 0.58 : viewportWidth * 0.34;

    return clamp(Math.max(minWidth, Math.min(maxWidth, idealWidth)), minWidth, maxWidth);
  }

  private resolvePlaneHeight(width: number): number {
    return width / this.textureAspect;
  }

  private resolveRotation(state: HeroSceneState): number {
    const rotateX = Math.max(
      -MAX_PARALLAX_ANGLE_RADIANS,
      Math.min(MAX_PARALLAX_ANGLE_RADIANS, THREE.MathUtils.degToRad(state.transform.rotateX)),
    );
    const rotateY = Math.max(
      -MAX_PARALLAX_ANGLE_RADIANS,
      Math.min(MAX_PARALLAX_ANGLE_RADIANS, THREE.MathUtils.degToRad(state.transform.rotateY)),
    );
    return (rotateX + rotateY) * 0.5;
  }

  private applyForegroundUvRect(geometry: THREE.PlaneGeometry, uvRect: UVRectConfig): void {
    const uv = (geometry.attributes as { uv?: { array: Float32Array; needsUpdate?: boolean } } | undefined)?.uv;
    if (!uv || !(uv.array instanceof Float32Array) || uv.array.length < 8) {
      return;
    }

    const uMin = clamp(uvRect.uMin, 0, 1);
    const uMax = clamp(uvRect.uMax, uMin, 1);
    const vMin = clamp(uvRect.vMin, 0, 1);
    const vMax = clamp(uvRect.vMax, vMin, 1);

    // PlaneGeometry UV vertices are top-left, top-right, bottom-left, bottom-right.
    // The manifest uses image-space coordinates with a top-left origin, while
    // Three.js UV v=0 starts at the bottom of the texture.
    uv.array[0] = uMin;
    uv.array[1] = 1 - vMin;
    uv.array[2] = uMax;
    uv.array[3] = 1 - vMin;
    uv.array[4] = uMin;
    uv.array[5] = 1 - vMax;
    uv.array[6] = uMax;
    uv.array[7] = 1 - vMax;
    uv.needsUpdate = true;
  }

  private updateForegroundUvRect(viewportWidth: number): void {
    if (!this.foregroundGeometry) {
      return;
    }

    const next = this.config.foreground.selectUvRect(viewportWidth);
    if (
      next.uMin === this.foregroundUvRect.uMin &&
      next.uMax === this.foregroundUvRect.uMax &&
      next.vMin === this.foregroundUvRect.vMin &&
      next.vMax === this.foregroundUvRect.vMax
    ) {
      return;
    }

    this.foregroundUvRect = next;
    this.applyForegroundUvRect(this.foregroundGeometry, next);
  }

  private snapshotForegroundRegistration(): {
    readonly portraitWorldMatrix: readonly number[];
    readonly foregroundWorldMatrix: readonly number[];
    readonly portraitParentWorldMatrix: readonly number[] | null;
    readonly foregroundParentWorldMatrix: readonly number[] | null;
    readonly expectedScreenRect: HeroForegroundScreenRect;
    readonly actualScreenRect: HeroForegroundScreenRect;
    readonly centerResidual: {
      readonly x: number;
      readonly y: number;
    };
    readonly sizeResidualPercent: {
      readonly width: number;
      readonly height: number;
    };
    readonly depthScale: number;
    readonly foregroundLocalPosition: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
    readonly foregroundLocalScale: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    };
    readonly camera: {
      readonly position: {
        readonly x: number;
        readonly y: number;
        readonly z: number;
      };
      readonly forward: {
        readonly x: number;
        readonly y: number;
        readonly z: number;
      };
      readonly fov: number;
    };
  } {
    const layout = this.foregroundRegistrationLayout;
    const mesh = this.foregroundMesh;
    if (!layout || !mesh) {
      throw new Error("Hero foreground registration is unavailable.");
    }

    this.portraitMesh.updateMatrixWorld(true);
    mesh.updateMatrixWorld(true);
    const actualScreenRect = projectMeshLocalRect(
      mesh,
      this.camera,
      this.snapshot.viewport,
      {
        minX: -0.5,
        maxX: 0.5,
        minY: -0.5,
        maxY: 0.5,
      },
    );
    const expected = layout.expectedScreenRect;
    const cameraPosition = this.camera.getWorldPosition(new THREE.Vector3());
    const cameraForward = this.camera.getWorldDirection(new THREE.Vector3());

    return {
      portraitWorldMatrix: [...this.portraitMesh.matrixWorld.elements],
      foregroundWorldMatrix: [...mesh.matrixWorld.elements],
      portraitParentWorldMatrix: this.portraitMesh.parent
        ? [...this.portraitMesh.parent.matrixWorld.elements]
        : null,
      foregroundParentWorldMatrix: mesh.parent
        ? [...mesh.parent.matrixWorld.elements]
        : null,
      expectedScreenRect: expected,
      actualScreenRect,
      centerResidual: {
        x: actualScreenRect.center.x - expected.center.x,
        y: actualScreenRect.center.y - expected.center.y,
      },
      sizeResidualPercent: {
        width:
          expected.width > 0
            ? ((actualScreenRect.width - expected.width) / expected.width) * 100
            : 0,
        height:
          expected.height > 0
            ? ((actualScreenRect.height - expected.height) / expected.height) * 100
            : 0,
      },
      depthScale: layout.depthScale,
      foregroundLocalPosition: {
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z,
      },
      foregroundLocalScale: {
        x: mesh.scale.x,
        y: mesh.scale.y,
        z: mesh.scale.z,
      },
      camera: {
        position: {
          x: cameraPosition.x,
          y: cameraPosition.y,
          z: cameraPosition.z,
        },
        forward: {
          x: cameraForward.x,
          y: cameraForward.y,
          z: cameraForward.z,
        },
        fov: this.camera.fov,
      },
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
