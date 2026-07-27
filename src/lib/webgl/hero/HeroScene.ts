import type { MotionFramePayload } from "@/lib/motion/types";
import MotionSnapshotStore from "@/lib/motion/MotionSnapshotStore";
import type DOMTracker from "@/lib/webgl/DOMTracker";
import type AssetRegistry from "@/lib/webgl/AssetRegistry";
import type { SceneModule, SceneIdentity } from "@/lib/webgl/SceneModule";
import type { CameraIntent } from "@/lib/webgl/CameraIntent";
import {
  heroSceneConfig,
  CHAPTER_PROGRESS_CONFIG,
  HERO_SCENE_ID,
  HERO_SCENE_ANCHOR_ID,
  HERO_MOTION_CONFIG,
} from "@/lib/webgl/hero/heroSceneConfig";
import HeroObjectLayer from "@/lib/webgl/hero/HeroObjectLayer";
import HeroPortrait from "@/lib/webgl/hero/HeroPortrait";
import { resolveHeroChapterProgress } from "@/lib/webgl/hero/HeroChapterProgress";
import type { HeroChapterPhase } from "@/lib/webgl/hero/HeroChapterProgress";

export type HeroSceneState = {
  readonly isActive: boolean;
  readonly isAnchored: boolean;
  readonly isCached: boolean;
  readonly isDisposed: boolean;
  readonly anchorWorld: {
    readonly x: number;
    readonly y: number;
    readonly z: number;
  } | null;
  readonly anchorViewport: {
    readonly x: number;
    readonly y: number;
  } | null;
  readonly relativeScroll: number;
  readonly transform: HeroSceneLayerTransform;
  readonly foregroundTransform: HeroSceneLayerTransform;
  readonly chapterProgress: number;
  readonly lifecycleChapterProgress?: number;
  readonly phase: HeroChapterPhase;
};

type HeroSceneLayerTransform = {
  readonly translateX: number;
  readonly translateY: number;
  readonly rotateX: number;
  readonly rotateY: number;
  readonly opacity: number;
  readonly scale: number;
};

type HeroSceneMotionTransform = Omit<HeroSceneLayerTransform, "scale"> & {
  readonly scale?: number;
};
type SceneProgressInput = {
  readonly progress: number;
  readonly phase: HeroChapterPhase;
  readonly reducedMotion: boolean;
};
const PORTRAIT_CHAPTER_FACTORS = {
  foregroundScale: HERO_MOTION_CONFIG.foreground.scaleMultiplier,
  foregroundTranslate: HERO_MOTION_CONFIG.foreground.translateMultiplier,
} as const;

const CHAPTER_EASING_CURVES = {
  linear: (value: number) => value,
  easeOutCubic: (value: number) => 1 - Math.pow(1 - value, 3),
  easeInOutCubic: (value: number) =>
    value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2,
} as const;

type HeroChapterEasing = keyof typeof CHAPTER_EASING_CURVES;

const PORTAIT_BASE_CHAPTER: HeroSceneLayerTransform = {
  translateX: 0,
  translateY: 0,
  rotateX: 0,
  rotateY: 0,
  opacity: HERO_MOTION_CONFIG.opacity.base,
  scale: HERO_MOTION_CONFIG.scale.base,
};

type HeroSceneOptions = {
  readonly anchorId?: string;
  readonly assetRegistry: AssetRegistry<HTMLImageElement>;
  readonly domTracker: DOMTracker;
  readonly snapshot: MotionSnapshotStore;
};

export default class HeroScene implements SceneModule<HeroSceneState> {
  readonly identity: SceneIdentity = {
    id: HERO_SCENE_ID,
    anchorId: HERO_SCENE_ANCHOR_ID,
    sceneType: "hero",
    metadata: {
      kind: "portrait",
    },
  };
  private readonly anchorId: string;
  private readonly objectLayer: HeroObjectLayer;
  private readonly portrait: HeroPortrait;
  private readonly assetRegistry: AssetRegistry<HTMLImageElement>;
  private readonly domTracker: DOMTracker;
  private readonly snapshot: MotionSnapshotStore;
  private cameraIntent: CameraIntent | null = null;
  private portraitAssetSource: string | null = null;
  private active = false;
  private disposed = false;
  private state: HeroSceneState = {
    isActive: false,
    isAnchored: false,
    isCached: true,
    isDisposed: false,
    anchorWorld: null,
    anchorViewport: null,
    relativeScroll: 0,
    chapterProgress: 0,
    lifecycleChapterProgress: 0,
    phase: "enter",
    transform: {
      ...PORTAIT_BASE_CHAPTER,
    },
    foregroundTransform: {
      ...PORTAIT_BASE_CHAPTER,
    },
  };

  constructor({
    anchorId = HERO_SCENE_ANCHOR_ID,
    assetRegistry,
    domTracker,
    snapshot,
  }: HeroSceneOptions) {
    this.identity = {
      ...this.identity,
      anchorId,
    };
    this.anchorId = anchorId;
    this.assetRegistry = assetRegistry;
    this.domTracker = domTracker;
    this.snapshot = snapshot;
    this.objectLayer = new HeroObjectLayer(heroSceneConfig.parallax);
    this.portrait = new HeroPortrait(heroSceneConfig.portraitAssetId);

    this.ensurePortraitSource();
    this.ensurePortraitRegistryEntry();
  }

  preload(): Promise<void> | void {
    if (this.disposed) {
      return;
    }

    this.ensurePortraitSource();
    this.ensurePortraitRegistryEntry();
    return this.portrait
      .ensureLoaded(this.assetRegistry)
      .then(() => {
        this.assetRegistry.acquire(this.identity.id, heroSceneConfig.portraitAssetId);
      });
  }

  update(payload: MotionFramePayload): void {
    void payload;
    if (this.disposed || !this.active) {
      return;
    }

    const currentSnapshot = this.snapshot.getSnapshot();
    const anchorSnapshot = this.domTracker.getSnapshot(this.anchorId);
    const chapterProgress = resolveHeroChapterProgress({
      reducedMotion: currentSnapshot.reducedMotion,
      relativeScroll: anchorSnapshot?.relativeScroll ?? 0,
      viewportHeight: currentSnapshot.viewport.height,
      anchorHeight: anchorSnapshot?.height ?? 0,
    });
    const lifecycleProgress = resolveHeroChapterProgress({
      reducedMotion: false,
      relativeScroll: anchorSnapshot?.relativeScroll ?? 0,
      viewportHeight: currentSnapshot.viewport.height,
      anchorHeight: anchorSnapshot?.height ?? 0,
    });
    const motion = this.objectLayer.updateFromSnapshot(currentSnapshot, anchorSnapshot);
    const chapterPose = this.resolveChapterTransform({
      progress: chapterProgress.progress,
      phase: chapterProgress.phase,
      reducedMotion: currentSnapshot.reducedMotion,
    });
    const transform = this.resolveLayerTransform(
      motion,
      chapterPose,
      1,
    );
    const foregroundTransform = this.resolveLayerTransform(
      motion,
      chapterPose,
      PORTRAIT_CHAPTER_FACTORS.foregroundTranslate,
      PORTRAIT_CHAPTER_FACTORS.foregroundScale,
    );
    const worldCenter = anchorSnapshot?.worldCenter;
    const viewportAnchor = anchorSnapshot?.worldCenter.screen;

    this.state = {
      isActive: true,
      isAnchored: Boolean(anchorSnapshot),
      isCached: false,
      isDisposed: false,
      anchorWorld: worldCenter?.point
        ? {
          x: worldCenter.point.x,
          y: worldCenter.point.y,
          z: worldCenter.point.z,
        }
        : null,
      anchorViewport: viewportAnchor
        ? {
          x: viewportAnchor.x,
          y: viewportAnchor.y,
        }
        : null,
      relativeScroll: anchorSnapshot?.relativeScroll ?? 0,
      chapterProgress: chapterProgress.progress,
      lifecycleChapterProgress: lifecycleProgress.progress,
      phase: chapterProgress.phase,
      transform,
      foregroundTransform,
    };

    const portraitSourceChanged = this.ensurePortraitSource();
    if (portraitSourceChanged) {
      this.assetRegistry.release(this.identity.id, heroSceneConfig.portraitAssetId);
      this.ensurePortraitRegistryEntry();
      void this.portrait
        .ensureLoaded(this.assetRegistry)
        .then(() => {
          if (!this.disposed) {
            this.assetRegistry.acquire(this.identity.id, heroSceneConfig.portraitAssetId);
          }
        })
        .catch(() => undefined);
    } else if (!currentSnapshot.reducedMotion && !this.portrait.state.isReady) {
      this.ensurePortraitRegistryEntry();
      void this.portrait.ensureLoaded(this.assetRegistry).catch(() => undefined);
    }

    this.cameraIntent = this.createCameraIntent(this.state, worldCenter?.point ?? null);
  }

  activate(): boolean {
    if (this.disposed) {
      return false;
    }

    this.active = true;
    this.cameraIntent = null;
    this.state = {
      ...this.state,
      isActive: true,
      isCached: false,
      isDisposed: false,
    };
    return true;
  }

  deactivate(): boolean {
    this.active = false;
    this.cameraIntent = null;
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

    this.disposed = true;
    this.cameraIntent = null;
    this.deactivate();
    this.state = {
      ...this.state,
      isDisposed: true,
      isCached: false,
      isActive: false,
    };
    this.assetRegistry.release(this.identity.id, heroSceneConfig.portraitAssetId);
  }

  get sceneSnapshot(): HeroSceneState {
    return {
      ...this.state,
      transform: { ...this.state.transform },
      foregroundTransform: { ...this.state.foregroundTransform },
    };
  }

  getSnapshot(): Readonly<HeroSceneState> {
    return this.sceneSnapshot;
  }

  getCameraIntent(): Readonly<CameraIntent> | null {
    return this.cameraIntent;
  }

  private ensurePortraitSource(): boolean {
    const width = this.snapshot.viewport.width;
    const candidate = heroSceneConfig.selectPortraitAssetSrc(width);
    if (candidate !== this.portraitAssetSource) {
      this.portraitAssetSource = candidate;
      this.portrait.setSource(candidate);
      return true;
    }

    return false;
  }

  private ensurePortraitRegistryEntry(): void {
    const src = this.portraitAssetSource ?? heroSceneConfig.portraitAssetSources.desktop;
    const current = this.assetRegistry.get(heroSceneConfig.portraitAssetId);

    if (current?.src === src) {
      return;
    }

    if (this.assetRegistry.has(heroSceneConfig.portraitAssetId)) {
      this.assetRegistry.unregister(heroSceneConfig.portraitAssetId);
    }

    this.assetRegistry.register({
      id: heroSceneConfig.portraitAssetId,
      src,
      kind: "image",
      metadata: {
        transparent: true,
        scene: this.identity.id,
      },
    });
  }

  private createCameraIntent(
    state: HeroSceneState,
    worldCenter: { x: number; y: number; z: number } | null,
  ): CameraIntent {
    const target = worldCenter
      ? {
        x: worldCenter.x + heroSceneConfig.cameraIntent.targetOffset.x,
        y: worldCenter.y + heroSceneConfig.cameraIntent.targetOffset.y,
        z: worldCenter.z + heroSceneConfig.cameraIntent.targetOffset.z,
      }
      : {
        x: heroSceneConfig.cameraIntent.targetOffset.x,
        y: heroSceneConfig.cameraIntent.targetOffset.y,
        z: heroSceneConfig.cameraIntent.targetOffset.z,
      };

    return {
      target,
      positionOffset: {
        x: state.transform.translateX * 0.003 + heroSceneConfig.cameraIntent.positionOffset.x,
        y: -state.transform.translateY * 0.003 + heroSceneConfig.cameraIntent.positionOffset.y,
        z: heroSceneConfig.cameraIntent.positionOffset.z + heroSceneConfig.cameraIntent.depthBias,
      },
      fovIntent: heroSceneConfig.cameraIntent.fovIntent,
      depthBias: heroSceneConfig.cameraIntent.depthBias,
      weight: heroSceneConfig.cameraIntent.weight,
    };
  }

  private resolveChapterTransform(
    input: SceneProgressInput,
  ): HeroSceneLayerTransform {
    if (input.reducedMotion) {
      return PORTAIT_BASE_CHAPTER;
    }

    const phase = input.phase;
    const progress = input.progress;
    const clampedProgress = clamp(progress, 0, 1);

    if (phase === "enter") {
      const progressRatio = clamp(
        clampedProgress / CHAPTER_PROGRESS_CONFIG.phaseBoundaries.enterMax,
        0,
        1,
      );
      const ratio = this.resolveEasing(progressRatio, HERO_MOTION_CONFIG.easing.enter);
      return {
        translateX: mix(
          HERO_MOTION_CONFIG.translation.enter.x,
          HERO_MOTION_CONFIG.translation.hold.x,
          ratio,
        ),
        translateY: mix(
          HERO_MOTION_CONFIG.translation.enter.y,
          HERO_MOTION_CONFIG.translation.hold.y,
          ratio,
        ),
        rotateX: 0,
        rotateY: 0,
        opacity: mix(
          HERO_MOTION_CONFIG.opacity.enterStart,
          HERO_MOTION_CONFIG.opacity.base,
          ratio,
        ),
        scale: mix(
          HERO_MOTION_CONFIG.scale.enterStart,
          HERO_MOTION_CONFIG.scale.base,
          ratio,
        ),
      };
    }

    if (phase === "hold") {
      return {
        ...PORTAIT_BASE_CHAPTER,
        opacity: HERO_MOTION_CONFIG.opacity.hold,
        scale: HERO_MOTION_CONFIG.scale.hold,
      };
    }

    return this.resolveDepartTransform(clampedProgress);
  }

  private resolveEasing(value: number, easing: HeroChapterEasing): number {
    return CHAPTER_EASING_CURVES[easing](clamp(value, 0, 1));
  }

  private resolveDepartTransform(progress: number): HeroSceneLayerTransform {
    const holdProgress = CHAPTER_PROGRESS_CONFIG.phaseBoundaries.holdMax;
    const keyframes = HERO_MOTION_CONFIG.depart.keyframes;
    const holdPose = {
      progress: holdProgress,
      translateX: HERO_MOTION_CONFIG.translation.hold.x,
      translateY: HERO_MOTION_CONFIG.translation.hold.y,
      opacity: HERO_MOTION_CONFIG.opacity.hold,
      scale: HERO_MOTION_CONFIG.scale.hold,
    };
    const normalizedKeyframes = [
      holdPose,
      ...keyframes.map((keyframe) => ({
        progress: keyframe.progress,
        translateX: keyframe.translation.x,
        translateY: keyframe.translation.y,
        opacity: keyframe.opacity,
        scale: keyframe.scale,
      })),
    ];

    if (progress <= holdPose.progress) {
      return {
        ...PORTAIT_BASE_CHAPTER,
        opacity: holdPose.opacity,
        scale: holdPose.scale,
      };
    }

    const last = normalizedKeyframes.at(-1);
    if (!last) {
      return {
        ...PORTAIT_BASE_CHAPTER,
        opacity: HERO_MOTION_CONFIG.opacity.departEnd,
        scale: HERO_MOTION_CONFIG.scale.departEnd,
      };
    }

    const clampedProgress = clamp(progress, holdPose.progress, 1);
    if (clampedProgress >= last.progress) {
      return {
        ...PORTAIT_BASE_CHAPTER,
        translateX: last.translateX,
        translateY: last.translateY,
        opacity: last.opacity,
        scale: last.scale,
      };
    }

    for (let index = 0; index < normalizedKeyframes.length - 1; index += 1) {
      const from = normalizedKeyframes[index];
      const to = normalizedKeyframes[index + 1];
      if (clampedProgress < to.progress) {
        const ratio = this.resolveEasing(
          (clampedProgress - from.progress) / Math.max(0.0001, to.progress - from.progress),
          HERO_MOTION_CONFIG.easing.depart,
        );
        return {
          translateX: mix(from.translateX, to.translateX, ratio),
          translateY: mix(from.translateY, to.translateY, ratio),
          rotateX: 0,
          rotateY: 0,
          opacity: mix(from.opacity, to.opacity, ratio),
          scale: mix(from.scale, to.scale, ratio),
        };
      }
    }

    return {
      ...PORTAIT_BASE_CHAPTER,
      translateX: last.translateX,
      translateY: last.translateY,
      opacity: last.opacity,
      scale: last.scale,
    };
  }

  private resolveLayerTransform(
    motion: HeroSceneMotionTransform,
    chapterPose: HeroSceneLayerTransform,
    translationFactor: number,
    scaleFactor = 1,
  ): HeroSceneLayerTransform {
    const deltaScale = 1 + (chapterPose.scale - 1) * scaleFactor;
    const baseScale = motion.scale ?? 1;

    return {
      translateX: motion.translateX + chapterPose.translateX * translationFactor,
      translateY: motion.translateY + chapterPose.translateY * translationFactor,
      rotateX: motion.rotateX,
      rotateY: motion.rotateY,
      opacity: clamp(motion.opacity * chapterPose.opacity, 0, 1),
      scale: clamp(baseScale * deltaScale, 0.2, 3),
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function mix(from: number, to: number, ratio: number): number {
  return from + (to - from) * ratio;
}
