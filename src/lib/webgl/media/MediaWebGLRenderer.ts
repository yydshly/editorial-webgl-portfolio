import * as THREE from "three";

import type { MediaSceneState } from "@/lib/webgl/media/MediaScene";
import type AssetRegistry from "@/lib/webgl/AssetRegistry";
import type MotionSnapshotStore from "@/lib/motion/MotionSnapshotStore";
import GPUResourceManager from "@/lib/webgl/GPUResourceManager";
import RenderScheduler from "@/lib/webgl/RenderScheduler";
import { mediaSceneConfig } from "@/lib/webgl/media/mediaSceneConfig";
import type { MediaLayerTransform } from "@/lib/webgl/media/MediaSceneMotion";
import type { GPUResourceSnapshot } from "@/lib/webgl/GPUResourceManager";
import { resolveScenePlaneWorldLayout } from "@/lib/webgl/SceneWorldLayout";
import type { WebGLLayerCompositionSnapshot } from "@/lib/webgl/WebGLCompositionSnapshot";
import type { WebGLAnchorProjectionSnapshot } from "@/lib/webgl/WebGLCompositionSnapshot";
import type { WebGLTextureSamplingSnapshot } from "@/lib/webgl/WebGLCompositionSnapshot";
import { snapshotWebGLLayerComposition } from "@/lib/webgl/WebGLCompositionProjection";

type MediaWebGLRendererInput = {
  readonly canvas: HTMLCanvasElement;
  readonly context: WebGLRenderingContext;
  readonly renderer: THREE.WebGLRenderer;
  readonly snapshot: MotionSnapshotStore;
  readonly assetRegistry: AssetRegistry<HTMLImageElement>;
  readonly camera: THREE.PerspectiveCamera;
  readonly scheduler: RenderScheduler;
  readonly getMediaState: () => MediaSceneState;
  readonly onReady?: () => void;
};

type MeshLayerDescriptor = {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  readonly material: THREE.MeshBasicMaterial;
  readonly textureOwnerId: string;
  readonly planeConfig: typeof mediaSceneConfig.main;
  textureAssetId: string | null;
  textureCache: THREE.Texture | null;
};

export type MediaTextureSamplingSnapshot = WebGLTextureSamplingSnapshot;

const DEFAULT_VIEWPORT_SIZE = 1;
const DESIGN_DEPTH_UNIT_PX = 100;

export default class MediaWebGLRenderer {
  private readonly gl: WebGLRenderingContext;
  private readonly snapshot: MotionSnapshotStore;
  private readonly assetRegistry: AssetRegistry<HTMLImageElement>;
  private readonly getMediaState: () => MediaSceneState;
  private readonly gpuResourceManager = new GPUResourceManager();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly geometry: THREE.PlaneGeometry;
  private readonly mainLayer: MeshLayerDescriptor;
  private readonly secondaryLayer: MeshLayerDescriptor;
  private disposed = false;
  private renderedThisFrame = false;

  constructor({
    context,
    renderer,
    snapshot,
    assetRegistry,
    scheduler,
    getMediaState,
    onReady,
    camera,
  }: MediaWebGLRendererInput) {
    this.gl = context;
    this.snapshot = snapshot;
    this.assetRegistry = assetRegistry;
    void scheduler;
    this.getMediaState = getMediaState;
    this.camera = camera;

    this.gpuResourceManager.setContext(context);
    this.renderer = renderer;
    this.scene = new THREE.Scene();

    const geometry = this.gpuResourceManager.acquireGeometry(
      `${mediaSceneConfig.id}:geometry`,
      "media-scene",
      () => new THREE.PlaneGeometry(1, 1),
    );
    const mainMaterial = this.gpuResourceManager.acquireMaterial(
      `${mediaSceneConfig.id}:main:material`,
      "media-scene",
      () =>
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: mediaSceneConfig.main.plane.opacity,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
    );
    const secondaryMaterial = this.gpuResourceManager.acquireMaterial(
      `${mediaSceneConfig.id}:secondary:material`,
      "media-scene",
      () =>
        new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: mediaSceneConfig.secondary.plane.opacity,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
    );

    if (!geometry || !mainMaterial || !secondaryMaterial) {
      throw new Error("Failed to initialize media renderer resources.");
    }

    this.geometry = geometry;
    this.mainLayer = {
      mesh: new THREE.Mesh(this.geometry, mainMaterial),
      material: mainMaterial,
      textureOwnerId: `${mediaSceneConfig.id}:main:texture`,
      planeConfig: mediaSceneConfig.main,
      textureAssetId: null,
      textureCache: null,
    };
    this.secondaryLayer = {
      mesh: new THREE.Mesh(this.geometry, secondaryMaterial),
      material: secondaryMaterial,
      textureOwnerId: `${mediaSceneConfig.id}:secondary:texture`,
      planeConfig: mediaSceneConfig.secondary,
      textureAssetId: null,
      textureCache: null,
    };

    this.mainLayer.mesh.position.z = mediaSceneConfig.main.plane.z;
    this.secondaryLayer.mesh.position.z = mediaSceneConfig.secondary.plane.z;

    this.scene.add(this.mainLayer.mesh);
    this.scene.add(this.secondaryLayer.mesh);

    this.mainLayer.mesh.visible = false;
    this.secondaryLayer.mesh.visible = false;

    onReady?.();
  }

  render(): void {
    if (this.disposed) {
      return;
    }

    this.renderedThisFrame = false;
    const state = this.getMediaState();

    if (!state.isActive || !state.anchorWorld) {
      this.mainLayer.mesh.visible = false;
      this.secondaryLayer.mesh.visible = false;
      return;
    }

    const viewport = this.snapshot.viewport;
    const viewportWidth = Math.max(DEFAULT_VIEWPORT_SIZE, viewport.width);
    const viewportHeight = Math.max(DEFAULT_VIEWPORT_SIZE, viewport.height);
    const isMainTextureReady = this.updateLayerTexture(this.mainLayer, state.main);
    const isSecondaryTextureReady = this.updateLayerTexture(this.secondaryLayer, state.secondary);
    if (!isMainTextureReady && !isSecondaryTextureReady) {
      this.mainLayer.mesh.visible = false;
      this.secondaryLayer.mesh.visible = false;
      return;
    }

    const mainWidth = this.resolvePlaneWidth(mediaSceneConfig.main.plane, viewportWidth);
    const mainHeight = this.resolvePlaneHeight(mainWidth, mediaSceneConfig.main.plane);
    const secondaryWidth = this.resolvePlaneWidth(mediaSceneConfig.secondary.plane, viewportWidth);
    const secondaryHeight = this.resolvePlaneHeight(
      secondaryWidth,
      mediaSceneConfig.secondary.plane,
    );

    this.applyAnchorTransform(
      this.mainLayer,
      state.anchorWorld,
      state.anchorViewport,
      viewportWidth,
      viewportHeight,
      mainWidth,
      mainHeight,
      state.mainTransform,
    );
    this.applyAnchorTransform(
      this.secondaryLayer,
      state.anchorWorld,
      state.anchorViewport,
      viewportWidth,
      viewportHeight,
      secondaryWidth,
      secondaryHeight,
      state.secondaryTransform,
    );

    this.mainLayer.mesh.visible = isMainTextureReady;
    this.secondaryLayer.mesh.visible = isSecondaryTextureReady;

    if (!isMainTextureReady && !isSecondaryTextureReady) {
      return;
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
    this.releaseLayerTexture(this.mainLayer);
    this.releaseLayerTexture(this.secondaryLayer);
    this.gpuResourceManager.releaseOwner("media-scene");
    this.geometry.dispose();
    this.mainLayer.material.dispose();
    this.secondaryLayer.material.dispose();
  }

  get resourceSnapshot(): GPUResourceSnapshot {
    return this.gpuResourceManager.snapshot;
  }

  get textureSamplingSnapshot(): {
    readonly main: MediaTextureSamplingSnapshot;
    readonly secondary: MediaTextureSamplingSnapshot;
  } {
    return {
      main: this.snapshotTextureSampling(this.mainLayer),
      secondary: this.snapshotTextureSampling(this.secondaryLayer),
    };
  }

  get compositionSnapshot(): {
    readonly main: WebGLLayerCompositionSnapshot;
    readonly secondary: WebGLLayerCompositionSnapshot;
    readonly projection: {
      readonly main: WebGLAnchorProjectionSnapshot;
      readonly secondary: WebGLAnchorProjectionSnapshot;
    };
    readonly textureSampling: {
      readonly main: MediaTextureSamplingSnapshot;
      readonly secondary: MediaTextureSamplingSnapshot;
    };
  } {
    const state = this.getMediaState();
    const main = this.snapshotLayer(this.mainLayer);
    const secondary = this.snapshotLayer(this.secondaryLayer);

    return {
      main,
      secondary,
      projection: {
        main: this.snapshotAnchorProjection(
          state.anchorViewport,
          state.mainTransform,
          main,
        ),
        secondary: this.snapshotAnchorProjection(
          state.anchorViewport,
          state.secondaryTransform,
          secondary,
        ),
      },
      textureSampling: this.textureSamplingSnapshot,
    };
  }

  private snapshotLayer(layer: MeshLayerDescriptor): WebGLLayerCompositionSnapshot {
    return snapshotWebGLLayerComposition(
      layer.mesh,
      this.camera,
      this.renderedThisFrame,
      this.snapshot.viewport,
    );
  }

  private snapshotTextureSampling(layer: MeshLayerDescriptor): MediaTextureSamplingSnapshot {
    const texture = layer.textureCache;
    const image = texture?.image as HTMLImageElement | undefined;

    return {
      source: layer.textureAssetId,
      decodedWidth: image?.naturalWidth ?? image?.width ?? 0,
      decodedHeight: image?.naturalHeight ?? image?.height ?? 0,
      minFilter: texture ? this.describeTextureFilter(texture.minFilter) : null,
      magFilter: texture ? this.describeTextureFilter(texture.magFilter) : null,
      generateMipmaps: texture?.generateMipmaps ?? null,
      anisotropy: texture?.anisotropy ?? null,
      colorSpace: texture?.colorSpace ?? null,
      premultiplyAlpha: texture?.premultiplyAlpha ?? null,
      flipY: texture?.flipY ?? null,
    };
  }

  private describeTextureFilter(filter: number): string {
    if (filter === THREE.LinearFilter) {
      return "LinearFilter";
    }
    if (filter === THREE.NearestFilter) {
      return "NearestFilter";
    }
    if (filter === THREE.LinearMipmapLinearFilter) {
      return "LinearMipmapLinearFilter";
    }
    if (filter === THREE.LinearMipmapNearestFilter) {
      return "LinearMipmapNearestFilter";
    }
    if (filter === THREE.NearestMipmapLinearFilter) {
      return "NearestMipmapLinearFilter";
    }
    if (filter === THREE.NearestMipmapNearestFilter) {
      return "NearestMipmapNearestFilter";
    }
    return `unknown:${filter}`;
  }

  private snapshotAnchorProjection(
    anchorViewport: MediaSceneState["anchorViewport"],
    transform: MediaLayerTransform,
    layer: WebGLLayerCompositionSnapshot,
  ): WebGLAnchorProjectionSnapshot {
    const expectedScreenCenter = anchorViewport
      ? {
        x: anchorViewport.x + transform.translateX,
        y: anchorViewport.y + transform.translateY,
      }
      : null;
    const projectedScreenCenter = layer.screen?.center ?? null;

    return {
      anchorRectCenter: anchorViewport ? { ...anchorViewport } : null,
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
    };
  }

  private updateLayerTexture(
    layer: MeshLayerDescriptor,
    layerState: MediaSceneState["main"] | MediaSceneState["secondary"],
  ): boolean {
    if (!layerState.isAssetReady || layerState.assetSource !== layer.planeConfig.selectAssetSource(this.snapshot.viewport.width)) {
      this.releaseLayerTexture(layer);
      return false;
    }

    const data = this.assetRegistry.getData(layer.planeConfig.assetId);
    if (!data) {
      this.releaseLayerTexture(layer);
      return false;
    }

    if (layer.textureAssetId === data.src && layer.textureCache) {
      return true;
    }

    this.releaseLayerTexture(layer);

    const texture = this.gpuResourceManager.acquireTexture(
      data.src,
      layer.textureOwnerId,
      (renderContext) => {
        const createdTexture = renderContext.createTexture();
        if (!createdTexture) {
          throw new Error("Failed to create media texture.");
        }

        return createdTexture;
      },
    );

    if (!texture) {
      return false;
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
      data,
    );

    layer.textureCache?.dispose();
    const nextTexture = new THREE.Texture(data);
    nextTexture.colorSpace = THREE.SRGBColorSpace;
    nextTexture.minFilter = THREE.LinearFilter;
    nextTexture.magFilter = THREE.LinearFilter;
    nextTexture.premultiplyAlpha = true;
    nextTexture.wrapS = THREE.ClampToEdgeWrapping;
    nextTexture.wrapT = THREE.ClampToEdgeWrapping;
    nextTexture.needsUpdate = true;

    layer.textureCache = nextTexture;
    layer.textureAssetId = data.src;
    layer.material.map = layer.textureCache;
    layer.material.needsUpdate = true;
    return true;
  }

  private releaseLayerTexture(layer: MeshLayerDescriptor): void {
    if (!layer.textureAssetId) {
      return;
    }

    this.gpuResourceManager.releaseTexture(layer.textureAssetId, layer.textureOwnerId);
    layer.textureCache?.dispose();
    layer.textureCache = null;
    layer.textureAssetId = null;
    layer.material.map = null;
    layer.material.needsUpdate = true;
  }

  private applyAnchorTransform(
    layer: MeshLayerDescriptor,
    anchorWorld: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    },
    anchorViewport: {
      readonly x: number;
      readonly y: number;
    } | null,
    viewportWidth: number,
    viewportHeight: number,
    planeWidth: number,
    planeHeight: number,
    transform: MediaLayerTransform,
  ): void {
    const layout = resolveScenePlaneWorldLayout({
      camera: this.camera,
      anchor: anchorWorld,
      anchorScreen: anchorViewport ?? undefined,
      viewportWidth,
      viewportHeight,
      widthPx: planeWidth,
      heightPx: planeHeight,
      translateXpx: transform.translateX,
      translateYpx: transform.translateY,
      depthOffsetPx: layer.planeConfig.plane.z * DESIGN_DEPTH_UNIT_PX,
      scale: layer.planeConfig.plane.scale * transform.scale,
    });
    layer.mesh.position.set(
      layout.position.x,
      layout.position.y,
      layout.position.z,
    );
    layer.mesh.scale.set(
      layout.scale.x,
      layout.scale.y,
      layout.scale.z,
    );
    layer.material.opacity = layer.planeConfig.plane.opacity * transform.opacity;
  }

  private resolvePlaneWidth(
    plane: typeof mediaSceneConfig.main.plane,
    viewportWidth: number,
  ): number {
    return Math.min(plane.width, Math.max(plane.minimumResponsiveWidth, viewportWidth * 0.32));
  }

  private resolvePlaneHeight(width: number, plane: typeof mediaSceneConfig.main.plane): number {
    return width * (plane.height / plane.width);
  }

}
