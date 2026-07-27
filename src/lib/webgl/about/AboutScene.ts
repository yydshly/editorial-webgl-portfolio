import type MotionSnapshotStore from "@/lib/motion/MotionSnapshotStore";
import type { MotionFramePayload } from "@/lib/motion/types";
import type AssetRegistry from "@/lib/webgl/AssetRegistry";
import type { CameraIntent } from "@/lib/webgl/CameraIntent";
import type DOMTracker from "@/lib/webgl/DOMTracker";
import type GPUResourceManager from "@/lib/webgl/GPUResourceManager";
import type { SceneIdentity, SceneModule } from "@/lib/webgl/SceneModule";
import {
  resolveAboutChapterProgress,
  type AboutStageId,
  type AboutStageIndex,
} from "@/lib/webgl/about/AboutChapterProgress";
import {
  ABOUT_PORTRAIT_TEXTURE_OWNER_ID,
  ABOUT_PORTRAIT_ANCHOR_ID,
  ABOUT_SCENE_ANCHOR_ID,
  aboutSceneConfig,
  type AboutPortraitResponsiveAsset,
  type AboutSceneConfig,
} from "@/lib/webgl/about/aboutSceneConfig";

type AboutPortraitState = {
  readonly assetId: string;
  readonly assetSource: string;
  readonly assetStatus: "development" | "production";
  readonly isAssetReady: boolean;
};

type AboutAnchorPoint = {
  readonly x: number;
  readonly y: number;
  readonly z: number;
};

type AboutAnchorViewportPoint = {
  readonly x: number;
  readonly y: number;
};

export type AboutSceneState = {
  readonly isActive: boolean;
  readonly isCached: boolean;
  readonly isDisposed: boolean;
  readonly isAnchored: boolean;
  readonly reducedMotion: boolean;
  readonly chapterProgress: number;
  readonly activeStageIndex: AboutStageIndex;
  readonly activeStageId: AboutStageId;
  readonly stageProgress: number;
  readonly relativeScroll: number;
  readonly anchorWidth: number;
  readonly anchorHeight: number;
  readonly anchorViewport: AboutAnchorViewportPoint | null;
  readonly anchorWorld: AboutAnchorPoint | null;
  readonly portrait: AboutPortraitState;
};

type AboutSceneOptions = {
  readonly anchorId?: string;
  readonly config?: AboutSceneConfig;
  readonly assetRegistry: AssetRegistry<HTMLImageElement>;
  readonly domTracker: DOMTracker;
  readonly gpuResourceManager: GPUResourceManager;
  readonly snapshot: MotionSnapshotStore;
  readonly loadAsset?: (src: string) => Promise<HTMLImageElement>;
};

const ORIGIN_STAGE = {
  activeStageIndex: 0,
  activeStageId: "origin",
  stageProgress: 0,
} as const;

export default class AboutScene implements SceneModule<AboutSceneState> {
  readonly identity: SceneIdentity;

  private readonly anchorId: string;
  private readonly portraitAnchorId: string;
  private readonly config: AboutSceneConfig;
  private readonly assetRegistry: AssetRegistry<HTMLImageElement>;
  private readonly domTracker: DOMTracker;
  private readonly gpuResourceManager: GPUResourceManager;
  private readonly snapshot: MotionSnapshotStore;
  private readonly loadAsset: (src: string) => Promise<HTMLImageElement>;
  private active = false;
  private cached = true;
  private disposed = false;
  private portraitAsset: AboutPortraitResponsiveAsset;
  private portraitReady = false;
  private preloadTask: Promise<void> | null = null;
  private state: AboutSceneState;

  constructor({
    anchorId = ABOUT_SCENE_ANCHOR_ID,
    config = aboutSceneConfig,
    assetRegistry,
    domTracker,
    gpuResourceManager,
    snapshot,
    loadAsset,
  }: AboutSceneOptions) {
    this.anchorId = anchorId;
    this.portraitAnchorId =
      config.portraitAnchorId ?? ABOUT_PORTRAIT_ANCHOR_ID;
    this.config = {
      ...config,
      anchorId,
    };
    this.assetRegistry = assetRegistry;
    this.domTracker = domTracker;
    this.gpuResourceManager = gpuResourceManager;
    this.snapshot = snapshot;
    this.loadAsset = loadAsset ?? loadImageAsset;
    this.portraitAsset = this.resolvePortraitAsset();
    this.identity = {
      id: this.config.id,
      anchorId: this.anchorId,
      sceneType: "about",
      metadata: {
        assetStatus: this.config.portrait.status,
        identity: this.config.portrait.identity,
        kind: "about",
      },
    };
    this.state = {
      isActive: false,
      isCached: true,
      isDisposed: false,
      isAnchored: false,
      reducedMotion: false,
      chapterProgress: 0,
      ...ORIGIN_STAGE,
      relativeScroll: 0,
      anchorWidth: 0,
      anchorHeight: 0,
      anchorViewport: null,
      anchorWorld: null,
      portrait: this.createPortraitState(),
    };

    this.registerPortrait();
  }

  preload(): Promise<void> | void {
    if (this.disposed) {
      return;
    }

    this.selectResponsivePortrait();
    return this.ensurePortraitReady();
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
    };
    return true;
  }

  update(payload: MotionFramePayload): void {
    void payload;
    if (this.disposed || !this.active) {
      return;
    }

    this.selectResponsivePortrait();
    if (!this.portraitReady) {
      void this.ensurePortraitReady();
    }

    const sectionAnchor = this.domTracker.getSnapshot(this.anchorId);
    const portraitAnchor = this.domTracker.getSnapshot(this.portraitAnchorId);
    const motion = this.snapshot.getSnapshot();
    const relativeScroll = sectionAnchor
      ? Math.max(
          0,
          motion.viewport.height - sectionAnchor.worldTop.screen.y,
        )
      : 0;
    const progress = resolveAboutChapterProgress({
      reducedMotion: motion.reducedMotion,
      relativeScroll,
      viewportHeight: motion.viewport.height,
      anchorHeight: sectionAnchor?.height,
      direction: motion.scroll.direction,
    });

    this.state = {
      ...this.state,
      isActive: true,
      isCached: false,
      isDisposed: false,
      isAnchored:
        progress.isAnchored && Boolean(sectionAnchor) && Boolean(portraitAnchor),
      reducedMotion: motion.reducedMotion,
      chapterProgress: progress.chapterProgress,
      activeStageIndex: progress.activeStageIndex,
      activeStageId: progress.activeStageId,
      stageProgress: progress.stageProgress,
      relativeScroll,
      anchorWidth: portraitAnchor?.width ?? 0,
      anchorHeight: portraitAnchor?.height ?? 0,
      anchorViewport: portraitAnchor
        ? {
            x: portraitAnchor.worldCenter.screen.x,
            y: portraitAnchor.worldCenter.screen.y,
          }
        : null,
      anchorWorld: portraitAnchor
        ? {
            x: portraitAnchor.worldCenter.point.x,
            y: portraitAnchor.worldCenter.point.y,
            z: portraitAnchor.worldCenter.point.z,
          }
        : null,
      portrait: this.createPortraitState(),
    };
  }

  deactivate(): boolean {
    if (this.disposed) {
      return true;
    }

    this.active = false;
    this.cached = true;
    this.state = {
      ...this.state,
      isActive: false,
      isCached: true,
      isDisposed: false,
    };
    return true;
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.active = false;
    this.cached = false;
    this.disposed = true;
    this.assetRegistry.release(this.identity.id, this.portraitAsset.id);
    this.gpuResourceManager.releaseOwner(ABOUT_PORTRAIT_TEXTURE_OWNER_ID);
    this.gpuResourceManager.releaseOwner(this.identity.id);
    this.portraitReady = false;
    this.preloadTask = null;
    this.state = {
      ...this.state,
      isActive: false,
      isCached: false,
      isDisposed: true,
      portrait: this.createPortraitState(),
    };
  }

  getSnapshot(): Readonly<AboutSceneState> {
    return {
      ...this.state,
      anchorViewport: this.state.anchorViewport
        ? { ...this.state.anchorViewport }
        : null,
      anchorWorld: this.state.anchorWorld ? { ...this.state.anchorWorld } : null,
      portrait: { ...this.state.portrait },
    };
  }

  getCameraIntent(): Readonly<CameraIntent> | null {
    if (
      !this.active ||
      this.cached ||
      this.disposed ||
      !this.state.anchorWorld
    ) {
      return null;
    }

    const stageIndex = this.state.reducedMotion
      ? ORIGIN_STAGE.activeStageIndex
      : this.state.activeStageIndex;
    return createAboutCameraIntent(
      this.state.anchorWorld,
      this.config.cameraIntent.stagePoses[stageIndex],
      this.config.cameraIntent,
    );
  }

  private createPortraitState(): AboutPortraitState {
    return {
      assetId: this.portraitAsset.id,
      assetSource: this.portraitAsset.src,
      assetStatus: this.config.portrait.status,
      isAssetReady: this.portraitReady,
    };
  }

  private resolvePortraitAsset(): AboutPortraitResponsiveAsset {
    return this.config.portrait.selectAsset(this.snapshot.viewport.width);
  }

  private selectResponsivePortrait(): void {
    const selectedAsset = this.resolvePortraitAsset();
    if (selectedAsset.id === this.portraitAsset.id) {
      return;
    }

    this.assetRegistry.release(this.identity.id, this.portraitAsset.id);
    this.gpuResourceManager.releaseOwner(ABOUT_PORTRAIT_TEXTURE_OWNER_ID);
    this.portraitAsset = selectedAsset;
    this.portraitReady = false;
    this.preloadTask = null;
    this.registerPortrait();
    this.state = {
      ...this.state,
      portrait: this.createPortraitState(),
    };
  }

  private registerPortrait(): void {
    const current = this.assetRegistry.get(this.portraitAsset.id);
    if (current?.src === this.portraitAsset.src) {
      this.portraitReady =
        this.assetRegistry.getState(this.portraitAsset.id) === "ready" &&
        Boolean(this.assetRegistry.getData(this.portraitAsset.id));
      return;
    }

    if (current) {
      throw new Error(
        `About portrait asset "${this.portraitAsset.id}" is already registered with a different source.`,
      );
    }
    this.assetRegistry.register({
      id: this.portraitAsset.id,
      src: this.portraitAsset.src,
      kind: "image",
      metadata: {
        assetStatus: this.config.portrait.status,
        identity: this.config.portrait.identity,
        scene: this.identity.id,
      },
    });
  }

  private ensurePortraitReady(): Promise<void> {
    if (this.disposed) {
      return Promise.resolve();
    }
    if (
      this.portraitReady &&
      this.assetRegistry.getState(this.portraitAsset.id) === "ready"
    ) {
      this.assetRegistry.acquire(this.identity.id, this.portraitAsset.id);
      return Promise.resolve();
    }
    if (this.preloadTask) {
      return this.preloadTask;
    }

    const assetAtStart = this.portraitAsset;
    const task = (async () => {
      const existingState = this.assetRegistry.getState(assetAtStart.id);
      if (
        existingState !== "ready" ||
        !this.assetRegistry.getData(assetAtStart.id)
      ) {
        await this.assetRegistry.preload(
          assetAtStart.id,
          () => this.loadAsset(assetAtStart.src),
        );
      }

      if (
        !this.disposed &&
        assetAtStart.id === this.portraitAsset.id &&
        this.assetRegistry.get(assetAtStart.id)?.src === assetAtStart.src
      ) {
        this.assetRegistry.acquire(this.identity.id, assetAtStart.id);
        this.portraitReady = true;
        this.state = {
          ...this.state,
          portrait: this.createPortraitState(),
        };
      }
    })().finally(() => {
      if (this.preloadTask === task) {
        this.preloadTask = null;
      }
    });
    this.preloadTask = task;
    return task;
  }
}

function createAboutCameraIntent(
  anchorWorld: AboutAnchorPoint,
  stagePose: AboutSceneConfig["cameraIntent"]["stagePoses"][AboutStageIndex],
  config: AboutSceneConfig["cameraIntent"],
): CameraIntent {
  return {
    target: {
      x: anchorWorld.x + stagePose.targetOffset.x,
      y: anchorWorld.y + stagePose.targetOffset.y,
      z: anchorWorld.z + stagePose.targetOffset.z,
    },
    positionOffset: {
      x: stagePose.positionOffset.x,
      y: stagePose.positionOffset.y,
      z: stagePose.positionOffset.z,
    },
    fovIntent: config.fovIntent,
    depthBias: config.depthBias,
    weight: config.weight,
  };
}

function loadImageAsset(src: string): Promise<HTMLImageElement> {
  if (typeof window === "undefined" || typeof Image === "undefined") {
    return Promise.reject(new Error(`Failed to load About portrait "${src}".`));
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error(`Failed to load About portrait "${src}".`));
    image.src = src;
  });
}
