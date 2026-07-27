import type { MotionFramePayload } from "@/lib/motion/types";
import type DOMTracker from "@/lib/webgl/DOMTracker";
import type AssetRegistry from "@/lib/webgl/AssetRegistry";
import type MotionSnapshotStore from "@/lib/motion/MotionSnapshotStore";
import type { SceneModule, SceneIdentity } from "@/lib/webgl/SceneModule";
import type { CameraIntent } from "@/lib/webgl/CameraIntent";
import {
  mediaSceneConfig,
  MEDIA_SCENE_ANCHOR_ID,
  type MediaLayerConfig,
  type MediaSceneConfig,
} from "@/lib/webgl/media/mediaSceneConfig";
import { resolveMediaChapterProgress, type MediaChapterPhase } from "@/lib/webgl/media/MediaSceneProgress";
import {
  MEDIA_MOTION_CONFIG,
  resolveMediaMotion,
  type MediaLayerTransform,
} from "@/lib/webgl/media/MediaSceneMotion";

type MediaLayerState = {
  readonly assetId: string;
  readonly assetSource: string;
  readonly isAssetReady: boolean;
};

export type MediaSceneState = {
  readonly isActive: boolean;
  readonly isAnchored: boolean;
  readonly isCached: boolean;
  readonly isDisposed: boolean;
  readonly visualReady: boolean;
  readonly mediaProgress: number;
  readonly lifecycleMediaProgress?: number;
  readonly phase: MediaChapterPhase;
  readonly mainTransform: MediaLayerTransform;
  readonly secondaryTransform: MediaLayerTransform;
  readonly relativeScroll: number;
  readonly width: number;
  readonly height: number;
  readonly anchorViewport: {
    readonly x: number;
    readonly y: number;
  } | null;
  readonly anchorWorld: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
  readonly main: MediaLayerState;
  readonly secondary: MediaLayerState;
};

type LayerReadyState = {
  assetId: string;
  src: string;
  isReady: boolean;
};

type MediaSceneOptions = {
  readonly anchorId?: string;
  readonly config?: MediaSceneConfig;
  readonly assetRegistry: AssetRegistry<HTMLImageElement>;
  readonly domTracker: DOMTracker;
  readonly snapshot: MotionSnapshotStore;
};

export default class MediaScene implements SceneModule<MediaSceneState> {
  readonly identity: SceneIdentity;
  private readonly anchorId: string;
  private readonly config: MediaSceneConfig;
  private readonly assetRegistry: AssetRegistry<HTMLImageElement>;
  private readonly domTracker: DOMTracker;
  private readonly snapshot: MotionSnapshotStore;
  private readonly layers: {
    main: LayerReadyState;
    secondary: LayerReadyState;
  };
  private active = false;
  private cached = true;
  private disposed = false;
  private cameraIntent: CameraIntent | null = null;
  private state: MediaSceneState;
  private get isMobileViewport(): boolean {
    const width = this.snapshot.viewport.width;
    return Number.isFinite(width) && width > 0 && width <= this.config.mobileBreakpoint;
  }

  private applyMobileProjection(
    transform: MediaLayerTransform,
    layer: "main" | "secondary",
  ): MediaLayerTransform {
    if (!this.isMobileViewport) {
      return transform;
    }

    return {
      ...transform,
      scale: transform.scale * (layer === "main"
        ? MEDIA_MOTION_CONFIG.responsiveProjection.mobile.mainScaleMultiplier
        : 1),
      translateX:
        transform.translateX * (layer === "secondary"
          ? MEDIA_MOTION_CONFIG.responsiveProjection.mobile.secondaryTranslateXMultiplier
          : MEDIA_MOTION_CONFIG.responsiveProjection.mobile.translateXMultiplier),
      translateY:
        transform.translateY * MEDIA_MOTION_CONFIG.responsiveProjection.mobile.translateYMultiplier,
    };
  }

  private resolveProgressFromDOM(): {
    readonly mediaProgress: number;
    readonly phase: MediaChapterPhase;
    readonly relativeScroll: number;
    readonly isAnchored: boolean;
    readonly anchorViewport: {
      readonly x: number;
      readonly y: number;
    } | null;
    readonly anchorWorld: {
      readonly x: number;
      readonly y: number;
      readonly z: number;
    } | null;
  } {
    const anchorSnapshot = this.domTracker.getSnapshot(this.anchorId);
    const motionSnapshot = this.snapshot.getSnapshot();

    if (!anchorSnapshot || !Number.isFinite(anchorSnapshot.relativeScroll)) {
      return {
        mediaProgress: this.state.mediaProgress,
        phase: this.state.phase,
        relativeScroll: this.state.relativeScroll,
        isAnchored: this.state.isAnchored,
        anchorViewport: this.state.anchorViewport,
        anchorWorld: this.state.anchorWorld,
      };
    }

    const chapterProgress = resolveMediaChapterProgress({
      reducedMotion: motionSnapshot.reducedMotion,
      relativeScroll: anchorSnapshot.relativeScroll,
      viewportHeight: motionSnapshot.viewport.height,
      anchorHeight: anchorSnapshot.height,
    });

    return {
      mediaProgress: chapterProgress.progress,
      phase: chapterProgress.phase,
      relativeScroll: anchorSnapshot.relativeScroll,
      isAnchored: true,
      anchorViewport: {
        x: anchorSnapshot.worldCenter.screen.x,
        y: anchorSnapshot.worldCenter.screen.y,
      },
      anchorWorld: {
        x: anchorSnapshot.worldCenter.point.x,
        y: anchorSnapshot.worldCenter.point.y,
        z: anchorSnapshot.worldCenter.point.z,
      },
    };
  }

  constructor({
    anchorId = MEDIA_SCENE_ANCHOR_ID,
    config = mediaSceneConfig,
    assetRegistry,
    domTracker,
    snapshot,
  }: MediaSceneOptions) {
    this.config = {
      ...config,
      anchorId,
    };
    this.identity = {
      id: this.config.id,
      anchorId: this.config.anchorId,
      sceneType: "media",
      metadata: {
        kind: "media",
      },
    };
    this.anchorId = this.config.anchorId;
    this.assetRegistry = assetRegistry;
    this.domTracker = domTracker;
    this.snapshot = snapshot;

    this.layers = {
      main: {
        assetId: this.config.main.assetId,
        src: this.resolveLayerSource(this.config.main),
        isReady: false,
      },
      secondary: {
        assetId: this.config.secondary.assetId,
        src: this.resolveLayerSource(this.config.secondary),
        isReady: false,
      },
    };

    this.state = {
      isActive: false,
      isAnchored: false,
      isCached: true,
      isDisposed: false,
      visualReady: false,
      mediaProgress: 0,
      lifecycleMediaProgress: 0,
      phase: "enter",
      mainTransform: {
        translateX: MEDIA_MOTION_CONFIG.main.holdPose.translateX,
        translateY: MEDIA_MOTION_CONFIG.main.holdPose.translateY,
        scale: MEDIA_MOTION_CONFIG.main.holdPose.scale,
        opacity: MEDIA_MOTION_CONFIG.main.holdPose.opacity,
      },
      secondaryTransform: {
        translateX: MEDIA_MOTION_CONFIG.secondary.holdPose.translateX,
        translateY: MEDIA_MOTION_CONFIG.secondary.holdPose.translateY,
        scale: MEDIA_MOTION_CONFIG.secondary.holdPose.scale,
        opacity: MEDIA_MOTION_CONFIG.secondary.holdPose.opacity,
      },
      relativeScroll: 0,
      width: this.config.main.plane.width,
      height: this.config.main.plane.height,
      anchorViewport: null,
      anchorWorld: null,
      main: {
        assetId: this.layers.main.assetId,
        assetSource: this.layers.main.src,
        isAssetReady: false,
      },
      secondary: {
        assetId: this.layers.secondary.assetId,
        assetSource: this.layers.secondary.src,
        isAssetReady: false,
      },
    };

    this.registerLayer(this.config.main, this.layers.main);
    this.registerLayer(this.config.secondary, this.layers.secondary);
  }

  preload(): Promise<void> | void {
    if (this.disposed) {
      return;
    }

    return Promise.all([
      this.ensureLayerReady(this.config.main, this.layers.main),
      this.ensureLayerReady(this.config.secondary, this.layers.secondary),
    ]).then(() => {
      this.state = {
        ...this.state,
        main: {
          ...this.state.main,
          isAssetReady: this.layers.main.isReady,
        },
        secondary: {
          ...this.state.secondary,
          isAssetReady: this.layers.secondary.isReady,
        },
      };
    });
  }

  activate(): boolean {
    if (this.disposed) {
      return false;
    }

    this.active = true;
    this.cached = false;
    this.state = {
      ...this.state,
      isActive: true,
      isCached: false,
      isDisposed: false,
      visualReady: false,
    };
    return true;
  }

  update(payload: MotionFramePayload): void {
    void payload;
    if (this.disposed || !this.active) {
      return;
    }

    const anchorSnapshot = this.domTracker.getSnapshot(this.anchorId);
    const worldCenter = anchorSnapshot?.worldCenter;
    const nextRelativeScroll = anchorSnapshot?.relativeScroll ?? 0;
    const currentSnapshot = this.snapshot.getSnapshot();
    const chapterProgress = resolveMediaChapterProgress({
      reducedMotion: currentSnapshot.reducedMotion,
      relativeScroll: nextRelativeScroll,
      viewportHeight: currentSnapshot.viewport.height,
      anchorHeight: anchorSnapshot?.height ?? 0,
    });
    const lifecycleProgress = resolveMediaChapterProgress({
      reducedMotion: false,
      relativeScroll: nextRelativeScroll,
      viewportHeight: currentSnapshot.viewport.height,
      anchorHeight: anchorSnapshot?.height ?? 0,
    });
    const mediaMotion = resolveMediaMotion({
      reducedMotion: currentSnapshot.reducedMotion,
      progress: chapterProgress.progress,
      phase: chapterProgress.phase,
    });
    const mobileAdjustedMain = this.applyMobileProjection(mediaMotion.main, "main");
    const mobileAdjustedSecondary = this.applyMobileProjection(mediaMotion.secondary, "secondary");
    const shouldLoadAssets = !this.state.main.isAssetReady || !this.state.secondary.isAssetReady;

    if (shouldLoadAssets) {
      void this.ensureLayerReady(this.config.main, this.layers.main).then(() => {
        this.state = {
          ...this.state,
          main: {
            ...this.state.main,
            isAssetReady: this.layers.main.isReady,
          },
        };
      });
      void this.ensureLayerReady(this.config.secondary, this.layers.secondary).then(() => {
        this.state = {
          ...this.state,
          secondary: {
            ...this.state.secondary,
            isAssetReady: this.layers.secondary.isReady,
          },
        };
      });
    }

    this.state = {
      ...this.state,
      isActive: true,
      isCached: false,
      isDisposed: false,
      mediaProgress: chapterProgress.progress,
      lifecycleMediaProgress: lifecycleProgress.progress,
      phase: chapterProgress.phase,
      visualReady: this.state.visualReady,
      mainTransform: mobileAdjustedMain,
      secondaryTransform: mobileAdjustedSecondary,
      isAnchored: Boolean(anchorSnapshot),
      relativeScroll: nextRelativeScroll,
      anchorViewport: worldCenter?.screen
        ? {
          x: worldCenter.screen.x,
          y: worldCenter.screen.y,
        }
        : null,
      anchorWorld: worldCenter?.point
        ? {
          x: worldCenter.point.x,
          y: worldCenter.point.y,
          z: worldCenter.point.z,
        }
        : null,
      main: {
        ...this.state.main,
        isAssetReady: this.layers.main.isReady,
      },
      secondary: {
        ...this.state.secondary,
        isAssetReady: this.layers.secondary.isReady,
      },
    };

    this.cameraIntent = this.resolveCameraIntent(worldCenter?.point ?? null, chapterProgress.phase);
  }

  deactivate(): boolean {
    if (this.disposed) {
      return true;
    }

    this.active = false;
    this.cached = true;
    this.cameraIntent = null;
    this.state = {
      ...this.state,
      isActive: false,
      isCached: true,
      isDisposed: false,
      visualReady: false,
      mediaProgress: 0,
      lifecycleMediaProgress: 0,
      phase: "enter",
      mainTransform: {
        translateX: MEDIA_MOTION_CONFIG.main.holdPose.translateX,
        translateY: MEDIA_MOTION_CONFIG.main.holdPose.translateY,
        scale: MEDIA_MOTION_CONFIG.main.holdPose.scale,
        opacity: MEDIA_MOTION_CONFIG.main.holdPose.opacity,
      },
      secondaryTransform: {
        translateX: MEDIA_MOTION_CONFIG.secondary.holdPose.translateX,
        translateY: MEDIA_MOTION_CONFIG.secondary.holdPose.translateY,
        scale: MEDIA_MOTION_CONFIG.secondary.holdPose.scale,
        opacity: MEDIA_MOTION_CONFIG.secondary.holdPose.opacity,
      },
    };
    return true;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.deactivate();
    this.cameraIntent = null;
    this.state = {
      ...this.state,
      isDisposed: true,
      isCached: false,
      isActive: false,
      visualReady: false,
      mediaProgress: 0,
      lifecycleMediaProgress: 0,
      phase: "enter",
      mainTransform: {
        translateX: MEDIA_MOTION_CONFIG.main.holdPose.translateX,
        translateY: MEDIA_MOTION_CONFIG.main.holdPose.translateY,
        scale: MEDIA_MOTION_CONFIG.main.holdPose.scale,
        opacity: MEDIA_MOTION_CONFIG.main.holdPose.opacity,
      },
      secondaryTransform: {
        translateX: MEDIA_MOTION_CONFIG.secondary.holdPose.translateX,
        translateY: MEDIA_MOTION_CONFIG.secondary.holdPose.translateY,
        scale: MEDIA_MOTION_CONFIG.secondary.holdPose.scale,
        opacity: MEDIA_MOTION_CONFIG.secondary.holdPose.opacity,
      },
    };
    this.assetRegistry.release(this.identity.id, this.config.main.assetId);
    this.assetRegistry.release(this.identity.id, this.config.secondary.assetId);
    this.layers.main.isReady = false;
    this.layers.secondary.isReady = false;
  }

  getSnapshot(): Readonly<MediaSceneState> {
    const progressState = this.resolveProgressFromDOM();

    return {
      ...this.state,
      main: {
        ...this.state.main,
      },
      secondary: {
        ...this.state.secondary,
      },
      mainTransform: { ...this.state.mainTransform },
      secondaryTransform: { ...this.state.secondaryTransform },
      isAnchored: progressState.isAnchored,
      mediaProgress: progressState.mediaProgress,
      lifecycleMediaProgress: resolveMediaChapterProgress({
        reducedMotion: false,
        relativeScroll: progressState.relativeScroll,
        viewportHeight: this.snapshot.getSnapshot().viewport.height,
        anchorHeight: this.domTracker.getSnapshot(this.anchorId)?.height ?? 0,
      }).progress,
      phase: progressState.phase,
      relativeScroll: progressState.relativeScroll,
      anchorViewport: progressState.anchorViewport,
      anchorWorld: progressState.anchorWorld,
    };
  }

  getCameraIntent(): Readonly<CameraIntent> | null {
    return this.cameraIntent;
  }

  setVisualReady(ready: boolean): void {
    this.state = {
      ...this.state,
      visualReady: ready,
    };
  }

  private resolveLayerSource(layerConfig: MediaLayerConfig): string {
    return layerConfig.selectAssetSource(this.snapshot.viewport.width);
  }

  private registerLayer(layerConfig: MediaLayerConfig, layer: LayerReadyState): void {
    const current = this.assetRegistry.get(layerConfig.assetId);
    if (current?.src === layer.src) {
      return;
    }

    this.assetRegistry.unregister(layerConfig.assetId);
    this.assetRegistry.register({
      id: layerConfig.assetId,
      src: layer.src,
      kind: "image",
      metadata: {
        semanticSlot: layerConfig.semanticSlot,
        scene: this.identity.id,
      },
    });
  }

  private async ensureLayerReady(
    layerConfig: MediaLayerConfig,
    layer: LayerReadyState,
  ): Promise<void> {
    const selectedSource = this.resolveLayerSource(layerConfig);
    layer.src = selectedSource;

    this.registerLayer(layerConfig, layer);
    this.state = this.updateLayerSourceState(layerConfig, layer);

    if (layer.isReady) {
      return;
    }

    const state = this.assetRegistry.getState(layerConfig.assetId);
    if (state === "ready" && this.assetRegistry.getData(layerConfig.assetId)) {
      this.assetRegistry.acquire(this.identity.id, layerConfig.assetId);
      layer.isReady = true;
      return;
    }

    try {
      await this.assetRegistry.preload(layerConfig.assetId, () =>
        this.loadAsset(layerConfig.assetId, selectedSource),
      );
      this.assetRegistry.acquire(this.identity.id, layerConfig.assetId);
      layer.isReady = true;
    } catch {
      layer.isReady = false;
    }
  }

  private loadAsset(assetId: string, src: string): Promise<HTMLImageElement> {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return Promise.reject(new Error(`Failed to load media asset "${assetId}".`));
    }

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.loading = "eager";
      image.src = src;

      image.onload = () => {
        resolve(image);
      };
      image.onerror = () => {
        reject(new Error(`Failed to load media asset "${src}".`));
      };
    });
  }

  private updateLayerSourceState(
    layerConfig: MediaLayerConfig,
    layer: LayerReadyState,
  ): MediaSceneState {
    return {
      ...this.state,
      main:
        layerConfig.assetId === this.config.main.assetId
          ? {
            ...this.state.main,
            assetId: layer.assetId,
            assetSource: layer.src,
          }
          : this.state.main,
      secondary:
        layerConfig.assetId === this.config.secondary.assetId
          ? {
            ...this.state.secondary,
            assetId: layer.assetId,
            assetSource: layer.src,
          }
      : this.state.secondary,
    };
  }

  private resolveCameraIntent(
    worldCenter: { x: number; y: number; z: number } | null,
    phase: MediaChapterPhase,
  ): CameraIntent | null {
    const pose = mediaSceneConfig.cameraIntent[phase];
    const target = worldCenter
      ? {
          x: worldCenter.x + pose.targetOffset.x,
          y: worldCenter.y + pose.targetOffset.y,
          z: worldCenter.z + pose.targetOffset.z,
        }
      : {
          x: pose.targetOffset.x,
          y: pose.targetOffset.y,
          z: pose.targetOffset.z,
        };

    return {
      target,
      positionOffset: {
        x: pose.positionOffset.x,
        y: pose.positionOffset.y,
        z: pose.positionOffset.z,
      },
      fovIntent: pose.fovIntent,
      depthBias: mediaSceneConfig.cameraIntent.depthBias,
      weight: mediaSceneConfig.cameraIntent.weight,
    };
  }
}
