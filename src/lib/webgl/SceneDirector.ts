import type { MotionFramePayload, Unsubscribe } from "@/lib/motion/types";
import MotionSnapshotStore, { type MotionSnapshotState } from "@/lib/motion/MotionSnapshotStore";
import type SceneRegistry from "@/lib/webgl/SceneRegistry";
import type { SceneLifecycleState } from "@/lib/webgl/SceneRegistry";
import type { SceneIdentity, SceneModule } from "@/lib/webgl/SceneModule";
import type { CameraIntent, SceneCameraIntent } from "@/lib/webgl/CameraIntent";
import type DOMTracker from "@/lib/webgl/DOMTracker";
import RenderScheduler from "@/lib/webgl/RenderScheduler";
import { CHAPTER_PROGRESS_CONFIG } from "@/lib/webgl/hero/heroSceneConfig";
import { MEDIA_PROGRESS_CONFIG } from "@/lib/webgl/media/MediaSceneProgress";

export type SceneActivationStrategy = "replace" | "overlap";

export type SceneTransitionPhase =
  | "idle"
  | "preload"
  | "overlap"
  | "handoff"
  | "replace"
  | "cache";

export type SceneTransitionSnapshot = {
  readonly fromSceneId: string | null;
  readonly toSceneId: string | null;
  readonly transitionPhase: SceneTransitionPhase;
  readonly handoffProgress: number;
  readonly cameraBlendWeight: number;
  readonly dominantSceneId: string | null;
  readonly cameraIntentSceneId: string | null;
};

export type SceneDirectorInput = {
  readonly registry: SceneRegistry;
  readonly scheduler: RenderScheduler;
  readonly snapshot: MotionSnapshotStore;
  readonly updatePriority?: number;
  readonly cameraHandoffPolicy?: SceneCameraHandoffPolicy;
  readonly sceneTransitionPolicy?: SceneTransitionPolicy;
  readonly domTracker?: Pick<DOMTracker, "getSnapshot">;
  readonly manifestoAboutPolicy?: ManifestoAboutPolicy;
  readonly quoteBooksPolicy?: QuoteBooksPolicy;
  readonly mediaVisualReadyResolver?: (
    scene: SceneModule<unknown>,
    registryState: SceneLifecycleState | null,
  ) => boolean;
  readonly booksVisualReadyResolver?: (
    scene: SceneModule<unknown>,
    registryState: SceneLifecycleState | null,
  ) => boolean;
  readonly onUpdateProfile?: (
    durationMs: number,
    updatedCount: number,
    snapshot: MotionSnapshotState,
    frame: MotionFramePayload,
  ) => void;
};

export type CameraHandoffEasing = (value: number) => number;

export type SceneCameraHandoffPolicy = {
  readonly startProgress: number;
  readonly endProgress: number;
  readonly easing: CameraHandoffEasing;
  readonly maxSecondaryBlend: number;
};

export type SceneTransitionPolicy = {
  readonly heroProgressToPreload: number;
  readonly heroProgressToOverlap: number;
  readonly mediaProgressToReplace: number;
  readonly heroProgressToCache: number;
  readonly reduceMotionSkipsTransition: boolean;
};

export type ManifestoAboutPolicy = {
  readonly manifestoAnchorId: string;
  readonly aboutAnchorId: string;
  readonly preloadViewportDistance: number;
  readonly activationCoreTop: number;
  readonly activationCoreBottom: number;
  readonly cacheBeforeTop: number;
  readonly cacheAfterBottom: number;
};

export type QuoteBooksPolicy = {
  readonly quoteAnchorId: string;
  readonly booksAnchorId: string;
  readonly preloadViewportDistance: number;
  readonly activationCoreTop: number;
  readonly activationCoreBottom: number;
  readonly cacheBeforeTop: number;
  readonly cacheAfterBottom: number;
};

const CAMERA_HANDOFF_EASING: Record<string, CameraHandoffEasing> = {
  linear: (value: number) => value,
  easeOutCubic: (value: number) => 1 - Math.pow(1 - value, 3),
  easeInOutCubic: (value: number) =>
    value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2,
} as const;

export const DEFAULT_CAMERA_HANDOFF_POLICY: SceneCameraHandoffPolicy = {
  startProgress: 0.22,
  endProgress: 0.66,
  easing: CAMERA_HANDOFF_EASING.easeInOutCubic,
  maxSecondaryBlend: 0.45,
};

export const DEFAULT_SCENE_TRANSITION_POLICY: SceneTransitionPolicy = {
  heroProgressToPreload: CHAPTER_PROGRESS_CONFIG.phaseBoundaries.enterMax,
  heroProgressToOverlap: CHAPTER_PROGRESS_CONFIG.phaseBoundaries.enterMax,
  mediaProgressToReplace: MEDIA_PROGRESS_CONFIG.phaseBoundaries.holdMax,
  heroProgressToCache: 0.9,
  reduceMotionSkipsTransition: false,
};

export const DEFAULT_MANIFESTO_ABOUT_POLICY: ManifestoAboutPolicy = {
  manifestoAnchorId: "manifesto",
  aboutAnchorId: "about",
  preloadViewportDistance: 1.5,
  activationCoreTop: 0.2,
  activationCoreBottom: 0.8,
  cacheBeforeTop: 0.8,
  cacheAfterBottom: 0.2,
};

export const DEFAULT_QUOTE_BOOKS_POLICY: QuoteBooksPolicy = {
  quoteAnchorId: "quote",
  booksAnchorId: "books",
  preloadViewportDistance: 1.5,
  activationCoreTop: 0.2,
  activationCoreBottom: 0.8,
  cacheBeforeTop: 0.8,
  cacheAfterBottom: 0.2,
};

export const GLOBAL_IDLE_CAMERA_INTENT: SceneCameraIntent = {
  sceneId: "global-idle",
  intent: {
    target: { x: 0, y: 0, z: -8 },
    positionOffset: { x: 0, y: 0, z: 0.35 },
    fovIntent: 48,
    depthBias: 0,
    weight: 1,
  },
};

type SceneDirectorEntry = {
  readonly id: string;
  readonly scene: SceneModule<unknown>;
};

type SceneIntentCandidate = {
  readonly sceneId: string;
  readonly scene: SceneModule<unknown>;
  readonly intent: Readonly<CameraIntent>;
  readonly isDominant: boolean;
  readonly weight: number;
};

type CameraBlendState = {
  readonly handoffProgress: number;
  readonly blendWeight: number;
};

const MAX_TRANSITION_BLEND = 0.4;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function resolveBlendWeight(dominantWeight: number, secondaryWeight: number): number {
  if (!Number.isFinite(dominantWeight) || dominantWeight <= 0) {
    dominantWeight = 1;
  }
  if (!Number.isFinite(secondaryWeight) || secondaryWeight <= 0) {
    return 0;
  }

  const ratio = secondaryWeight / (dominantWeight + secondaryWeight);
  return clamp(ratio, 0, MAX_TRANSITION_BLEND);
}

function blendCameraIntent(
  dominant: CameraIntent,
  secondary: CameraIntent,
  blendWeight: number,
): CameraIntent {
  const t = clamp(Number.isFinite(blendWeight) ? blendWeight : 0, 0, 1);
  const oneMinus = 1 - t;

  return {
    target: {
      x: dominant.target.x * oneMinus + secondary.target.x * t,
      y: dominant.target.y * oneMinus + secondary.target.y * t,
      z: dominant.target.z * oneMinus + secondary.target.z * t,
    },
    positionOffset: {
      x: dominant.positionOffset.x * oneMinus + secondary.positionOffset.x * t,
      y: dominant.positionOffset.y * oneMinus + secondary.positionOffset.y * t,
      z: dominant.positionOffset.z * oneMinus + secondary.positionOffset.z * t,
    },
    fovIntent: dominant.fovIntent * oneMinus + secondary.fovIntent * t,
    depthBias: dominant.depthBias * oneMinus + secondary.depthBias * t,
    weight: dominant.weight,
  };
}

const DEFAULT_UPDATE_PRIORITY = 10;

function createEmptyTransitionSnapshot(
  dominantSceneId: string | null = null,
  cameraIntentSceneId: string | null = null,
): SceneTransitionSnapshot {
  return {
    fromSceneId: null,
    toSceneId: null,
    transitionPhase: "idle",
    handoffProgress: 0,
    cameraBlendWeight: 0,
    dominantSceneId,
    cameraIntentSceneId,
  };
}

export default class SceneDirector {
  private readonly registry: SceneRegistry;
  private readonly snapshot: MotionSnapshotStore;
  private readonly onUpdateProfile?: (
    durationMs: number,
    updatedCount: number,
    snapshot: MotionSnapshotState,
    frame: MotionFramePayload,
  ) => void;
  private readonly cameraHandoffPolicy: SceneCameraHandoffPolicy;
  private readonly transitionPolicy: SceneTransitionPolicy;
  private readonly domTracker?: Pick<DOMTracker, "getSnapshot">;
  private readonly manifestoAboutPolicy: ManifestoAboutPolicy;
  private readonly quoteBooksPolicy: QuoteBooksPolicy;
  private readonly resolveMediaVisualReady: (
    scene: SceneModule<unknown>,
    registryState: SceneLifecycleState | null,
  ) => boolean;
  private readonly resolveBooksVisualReady: (
    scene: SceneModule<unknown>,
    registryState: SceneLifecycleState | null,
  ) => boolean;
  private readonly mediaTransitionState = {
    preloadInFlight: false,
  };
  private readonly aboutTransitionState = {
    preloadInFlight: false,
    isManifestoInterlude: false,
  };
  private readonly booksTransitionState = {
    preloadInFlight: false,
    activationRequested: false,
    isDomOnlyInterval: false,
  };
  private readonly scenes = new Map<string, SceneModule<unknown>>();
  private readonly unsubscribe: Unsubscribe;
  private readonly updateStats = {
    updateCostMs: 0,
    updateCount: 0,
  };
  private currentCameraIntent: SceneCameraIntent | null = null;
  private currentTransitionSnapshot: SceneTransitionSnapshot = createEmptyTransitionSnapshot();

  constructor({
    registry,
    scheduler,
    snapshot,
    onUpdateProfile,
    cameraHandoffPolicy,
    sceneTransitionPolicy,
    domTracker,
    manifestoAboutPolicy,
    quoteBooksPolicy,
    mediaVisualReadyResolver,
    booksVisualReadyResolver,
    updatePriority = DEFAULT_UPDATE_PRIORITY,
  }: SceneDirectorInput) {
    this.registry = registry;
    this.snapshot = snapshot;
    this.onUpdateProfile = onUpdateProfile;
    this.cameraHandoffPolicy = cameraHandoffPolicy ?? DEFAULT_CAMERA_HANDOFF_POLICY;
    this.transitionPolicy = sceneTransitionPolicy ?? DEFAULT_SCENE_TRANSITION_POLICY;
    this.domTracker = domTracker;
    this.manifestoAboutPolicy =
      manifestoAboutPolicy ?? DEFAULT_MANIFESTO_ABOUT_POLICY;
    this.quoteBooksPolicy =
      quoteBooksPolicy ?? DEFAULT_QUOTE_BOOKS_POLICY;
    this.resolveMediaVisualReady = (scene, registryState) => {
      if (mediaVisualReadyResolver) {
        return Boolean(mediaVisualReadyResolver(scene, registryState));
      }

      return this.isMediaVisualReadyFallback(scene, false);
    };
    this.resolveBooksVisualReady = (scene, registryState) => {
      if (booksVisualReadyResolver) {
        return Boolean(booksVisualReadyResolver(scene, registryState));
      }

      return this.isBooksVisualReadyFallback(scene, false);
    };

    this.unsubscribe = scheduler.register((payload: MotionFramePayload): void => {
      const start = performance.now();
      const scenes = this.getUpdatingScenes();

      this.updateStats.updateCount = 0;

      for (const entry of scenes) {
        try {
          entry.scene.update(payload);
          this.updateStats.updateCount += 1;
        } catch (error) {
          if (typeof console !== "undefined") {
            console.error("[SceneDirector] scene update failed", entry.id, error);
          }
        }
      }

      this.advanceHeroToMediaTransition(payload);
      this.advanceManifestoAboutTransition(payload);
      this.advanceQuoteBooksTransition(payload);
      this.syncMediaVisualReady();
      this.currentCameraIntent = this.resolveCameraIntent();
      this.currentTransitionSnapshot = this.resolveTransitionSnapshot();
      this.updateStats.updateCostMs = Math.max(0, performance.now() - start);
      this.onUpdateProfile?.(
        this.updateStats.updateCostMs,
        this.updateStats.updateCount,
        this.snapshot.getSnapshot(),
        payload,
      );
    }, { priority: updatePriority });
  }

  register(scene: SceneModule<unknown>): SceneIdentity {
    const existing = this.scenes.get(scene.identity.id);
    if (existing) {
      return existing.identity;
    }

    this.scenes.set(scene.identity.id, scene);
    this.registry.register(scene.identity);
    return scene.identity;
  }

  async preload(id: string): Promise<boolean> {
    const scene = this.scenes.get(id);
    const previous = this.getState(id);

    if (!scene || !previous || previous.disposed) {
      return false;
    }

    const rollback: Array<() => void> = [];
    rollback.push(() => this.restoreState(id, previous));

    try {
      await scene.preload();
      if (!this.registry.preload(id)) {
        throw new Error("registry preload failed");
      }

      rollback.length = 0;
      return true;
    } catch {
      this.rollback(rollback);
      return false;
    }
  }

  activate(id: string, strategy: SceneActivationStrategy = "replace"): boolean {
    const scene = this.scenes.get(id);
    const targetPreviousState = this.getState(id);

    if (!scene || !targetPreviousState || targetPreviousState.disposed) {
      return false;
    }

    const rollback: Array<() => void> = [];
    try {
      if (strategy === "replace") {
        for (const entry of this.registry.list("dominant")) {
          if (entry.id === id) {
            continue;
          }

          const dominantScene = this.scenes.get(entry.id);
          const dominantPreviousState = this.getState(entry.id);
          if (!dominantPreviousState || dominantPreviousState.disposed) {
            continue;
          }

          if (dominantScene && !dominantScene.deactivate()) {
            throw new Error(`dominant scene deactivation failed: ${entry.id}`);
          }

          if (!this.registry.deactivate(entry.id)) {
            throw new Error(`dominant scene registry transition failed: ${entry.id}`);
          }

          rollback.push(() => {
            this.restoreState(entry.id, dominantPreviousState);
          });
        }
      }

      rollback.push(() => {
        this.restoreState(id, targetPreviousState);
      });

      if (!scene.activate()) {
        throw new Error(`scene activation failed: ${id}`);
      }

      if (!this.registry.activate(id, strategy)) {
        throw new Error(`registry activation failed: ${id}`);
      }

      rollback.length = 0;
      return true;
    } catch {
      this.rollback(rollback);
      return false;
    }
  }

  private syncMediaVisualReady(): void {
    for (const [id, scene] of this.scenes.entries()) {
      if (scene.identity.sceneType !== "media") {
        continue;
      }

      const mediaReady = this.isMediaVisualReady(scene, true);
      const withVisualReady = scene as {
        setVisualReady?: (ready: boolean) => void;
      };
      if (typeof withVisualReady.setVisualReady === "function") {
        withVisualReady.setVisualReady(mediaReady);
      }
    }
  }

  deactivate(id: string): boolean {
    const scene = this.scenes.get(id);
    const previousState = this.getState(id);

    if (!scene || !previousState) {
      return false;
    }

    if (!isActiveState(previousState)) {
      return true;
    }

    const rollback: Array<() => void> = [
      () => {
        this.restoreState(id, previousState);
      },
    ];

    try {
      if (!scene.deactivate()) {
        throw new Error(`scene deactivation failed: ${id}`);
      }

      if (!this.registry.deactivate(id)) {
        throw new Error(`registry deactivation failed: ${id}`);
      }

      rollback.length = 0;
      return true;
    } catch {
      this.rollback(rollback);
      return false;
    }
  }

  cache(id: string): boolean {
    const scene = this.scenes.get(id);
    const previousState = this.getState(id);

    if (!scene || !previousState) {
      return false;
    }

    if (previousState.cached) {
      return true;
    }

    const rollback: Array<() => void> = [
      () => {
        this.restoreState(id, previousState);
      },
    ];

    try {
      if (isActiveState(previousState)) {
        if (!scene.deactivate()) {
          throw new Error(`scene deactivation failed: ${id}`);
        }
      }

      if (!this.registry.cache(id)) {
        throw new Error(`cache transition failed: ${id}`);
      }

      rollback.length = 0;
      return true;
    } catch {
      this.rollback(rollback);
      return false;
    }
  }

  dispose(id: string): boolean {
    const scene = this.scenes.get(id);
    const previous = this.getState(id);

    if (!scene || !previous) {
      return false;
    }

    if (previous.disposed) {
      return true;
    }

    const rollback: Array<() => void> = [
      () => {
        this.restoreState(id, previous);
      },
    ];

    try {
      if (!this.registry.dispose(id)) {
        throw new Error(`registry dispose failed: ${id}`);
      }

      scene.dispose();
      rollback.length = 0;
      return true;
    } catch {
      this.rollback(rollback);
      return false;
    }
  }

  disposeAll(): void {
    for (const id of this.scenes.keys()) {
      this.dispose(id);
    }
  }

  destroy(): void {
    this.unsubscribe();
    this.scenes.clear();
  }

  get updateSnapshot(): {
    readonly updateCount: number;
    readonly updateCostMs: number;
  } {
    return {
      updateCount: this.updateStats.updateCount,
      updateCostMs: this.updateStats.updateCostMs,
    };
  }

  getCameraIntent(): Readonly<SceneCameraIntent> | null {
    const resolved = this.resolveCameraIntent();
    this.currentCameraIntent = resolved;
    this.currentTransitionSnapshot = this.resolveTransitionSnapshot();

    if (!resolved) {
      return null;
    }

    return {
      sceneId: resolved.sceneId,
      intent: {
        target: { ...resolved.intent.target },
        positionOffset: { ...resolved.intent.positionOffset },
        fovIntent: resolved.intent.fovIntent,
        depthBias: resolved.intent.depthBias,
        weight: resolved.intent.weight,
      },
    };
  }

  get transitionSnapshot(): SceneTransitionSnapshot {
    return {
      fromSceneId: this.currentTransitionSnapshot.fromSceneId,
      toSceneId: this.currentTransitionSnapshot.toSceneId,
      transitionPhase: this.currentTransitionSnapshot.transitionPhase,
      handoffProgress: this.currentTransitionSnapshot.handoffProgress,
      cameraBlendWeight: this.currentTransitionSnapshot.cameraBlendWeight,
      dominantSceneId: this.currentTransitionSnapshot.dominantSceneId,
      cameraIntentSceneId: this.currentTransitionSnapshot.cameraIntentSceneId,
    };
  }

  private restoreState(id: string, previous: SceneLifecycleState | null): void {
    const scene = this.scenes.get(id);
    if (!scene || !previous) {
      return;
    }

    if (previous.disposed) {
      this.registry.dispose(id);
      return;
    }

    if (!previous.resident) {
      return;
    }

    if (isActiveState(previous)) {
      scene.activate();
      this.registry.activate(id, "overlap");
      return;
    }

    if (previous.cached) {
      scene.deactivate();
      this.registry.cache(id);
      return;
    }

    scene.deactivate();
    this.registry.preload(id);
  }

  private rollback(actions: Array<() => void>): void {
    for (let index = actions.length - 1; index >= 0; index -= 1) {
      try {
        actions[index]();
      } catch {
        // ignore rollback failure
      }
    }
  }

  private getState(id: string): SceneLifecycleState | null {
    return this.registry.getState(id);
  }

  private getUpdatingScenes(): SceneDirectorEntry[] {
    const descriptors = this.registry.list("updating");
    return descriptors
      .map((descriptor) => {
        const scene = this.scenes.get(descriptor.id);
        if (!scene) {
          return null;
        }

        return {
          id: descriptor.id,
          scene,
        };
      })
      .filter((entry): entry is SceneDirectorEntry => entry !== null);
  }

  private getCameraIntentCandidates(): SceneIntentCandidate[] {
    const entries = this.getUpdatingScenes();
    const candidates = entries
      .map((entry) => {
        const state = this.getState(entry.id);
        const getIntent = entry.scene.getCameraIntent;
        if (!getIntent) {
          return null;
        }

        const intent = getIntent.call(entry.scene);
        if (!intent) {
          return null;
        }

        return {
          sceneId: entry.id,
          scene: entry.scene,
          intent,
          isDominant: Boolean(state?.dominant),
          weight: intent.weight,
        } as SceneIntentCandidate;
      })
      .filter((entry): entry is SceneIntentCandidate => entry !== null)
      .sort((left, right) => {
        if (left.isDominant && !right.isDominant) return -1;
        if (!left.isDominant && right.isDominant) return 1;
        return right.weight - left.weight;
      });

    const dominantAbout = candidates.find(
      (entry) =>
        entry.isDominant && entry.scene.identity.sceneType === "about",
    );
    if (dominantAbout) {
      return [dominantAbout];
    }

    return candidates.filter(
      (entry) => entry.scene.identity.sceneType !== "about",
    );
  }

  private resolveCameraIntent(): SceneCameraIntent | null {
    const candidates = this.getCameraIntentCandidates();
    const dominantBooks = candidates.find(
      (entry) =>
        entry.isDominant &&
        entry.scene.identity.sceneType === "books",
    );
    if (dominantBooks) {
      return {
        sceneId: dominantBooks.sceneId,
        intent: {
          target: { ...dominantBooks.intent.target },
          positionOffset: { ...dominantBooks.intent.positionOffset },
          fovIntent: dominantBooks.intent.fovIntent,
          depthBias: dominantBooks.intent.depthBias,
          weight: dominantBooks.intent.weight,
        },
      };
    }

    const dominantAbout = candidates.find(
      (entry) =>
        entry.isDominant &&
        entry.scene.identity.sceneType === "about",
    );
    if (
      dominantAbout &&
      !this.aboutTransitionState.isManifestoInterlude
    ) {
      return {
        sceneId: dominantAbout.sceneId,
        intent: {
          target: { ...dominantAbout.intent.target },
          positionOffset: {
            ...dominantAbout.intent.positionOffset,
          },
          fovIntent: dominantAbout.intent.fovIntent,
          depthBias: dominantAbout.intent.depthBias,
          weight: dominantAbout.intent.weight,
        },
      };
    }

    if (
      this.aboutTransitionState.isManifestoInterlude ||
      this.booksTransitionState.isDomOnlyInterval
    ) {
      return cloneSceneCameraIntent(GLOBAL_IDLE_CAMERA_INTENT);
    }

    if (candidates.length === 0) {
      return null;
    }

    const dominant = candidates.find((entry) => entry.isDominant) ?? null;
    if (!dominant) {
      const winner = candidates[0];
      if (!winner) {
        return null;
      }

      return {
        sceneId: winner.sceneId,
        intent: {
          target: { ...winner.intent.target },
          positionOffset: { ...winner.intent.positionOffset },
          fovIntent: winner.intent.fovIntent,
          depthBias: winner.intent.depthBias,
          weight: winner.intent.weight,
        },
      };
    }

    const secondary = candidates.find((entry) => !entry.isDominant) ?? null;
    if (!secondary) {
      return {
        sceneId: dominant.sceneId,
        intent: {
          target: { ...dominant.intent.target },
          positionOffset: { ...dominant.intent.positionOffset },
          fovIntent: dominant.intent.fovIntent,
          depthBias: dominant.intent.depthBias,
          weight: dominant.intent.weight,
        },
      };
    }

    const reducedMotion = this.snapshot.getSnapshot().reducedMotion;
    const dominantIsHero = dominant.scene.identity.sceneType === "hero";
    const dominantIsMedia = dominant.scene.identity.sceneType === "media";
    const secondaryIsHero = secondary.scene.identity.sceneType === "hero";
    const secondaryIsMedia = secondary.scene.identity.sceneType === "media";
    const heroToMedia = dominantIsHero && secondaryIsMedia;
    const mediaToHero = dominantIsMedia && secondaryIsHero;
    const mediaReady = this.isMediaSceneReadyForHandoff(dominant.scene, secondary.scene);
    const { handoffProgress, blendWeight } = resolveCameraBlend({
      dominant,
      secondary,
      isHeroToMedia: heroToMedia,
      isMediaToHero: mediaToHero,
      mediaReady,
      reducedMotion,
      policy: this.cameraHandoffPolicy,
    });
    if (blendWeight <= 0) {
      return {
        sceneId: dominant.sceneId,
        intent: {
          target: { ...dominant.intent.target },
          positionOffset: { ...dominant.intent.positionOffset },
          fovIntent: dominant.intent.fovIntent,
          depthBias: dominant.intent.depthBias,
          weight: dominant.intent.weight,
        },
      };
    }

    if (handoffProgress >= this.cameraHandoffPolicy.endProgress && heroToMedia) {
      return {
        sceneId: secondary.sceneId,
        intent: {
          target: { ...secondary.intent.target },
          positionOffset: { ...secondary.intent.positionOffset },
          fovIntent: secondary.intent.fovIntent,
          depthBias: secondary.intent.depthBias,
          weight: secondary.intent.weight,
        },
      };
    }

    if (handoffProgress >= this.cameraHandoffPolicy.endProgress && mediaToHero) {
      return {
        sceneId: dominant.sceneId,
        intent: {
          target: { ...dominant.intent.target },
          positionOffset: { ...dominant.intent.positionOffset },
          fovIntent: dominant.intent.fovIntent,
          depthBias: dominant.intent.depthBias,
          weight: dominant.intent.weight,
        },
      };
    }

    const blendedIntent = blendCameraIntent(dominant.intent, secondary.intent, blendWeight);
    return {
      sceneId: dominant.sceneId,
      intent: {
        target: { ...blendedIntent.target },
        positionOffset: { ...blendedIntent.positionOffset },
        fovIntent: blendedIntent.fovIntent,
        depthBias: blendedIntent.depthBias,
        weight: blendedIntent.weight,
      },
    };
  }

  private resolveTransitionSnapshot(): SceneTransitionSnapshot {
    const heroScene = this.getHeroScene();
    const mediaScene = this.getMediaScene();
    if (!heroScene || !mediaScene) {
      return createEmptyTransitionSnapshot(
        this.registry.dominantScene,
        this.currentCameraIntent?.sceneId ?? null,
      );
    }

    const heroProgress = getSceneHeroProgress(heroScene.scene);
    const mediaProgress = getSceneMediaProgress(mediaScene.scene);
    const transitionPhase = this.resolveTransitionPhase(heroScene, mediaScene, heroProgress, mediaProgress);
    const blend = this.resolveCameraBlendWeight();
    const handoffProgress = mediaProgress === null ? 0 : clamp(mediaProgress, 0, 1);

    return {
      fromSceneId: heroScene.id,
      toSceneId: mediaScene.id,
      transitionPhase,
      handoffProgress,
      cameraBlendWeight: blend,
      dominantSceneId: this.registry.dominantScene,
      cameraIntentSceneId: this.currentCameraIntent?.sceneId ?? null,
    };
  }

  private resolveTransitionPhase(
    hero: {
      readonly state: SceneLifecycleState;
    },
    media: {
      readonly state: SceneLifecycleState;
    },
    heroProgress: number | null,
    mediaProgress: number | null,
  ): SceneTransitionPhase {
    if (media.state.dominant) {
      return "replace";
    }

    if (hero.state.cached) {
      return "cache";
    }

    if (
      hero.state.dominant &&
      !media.state.resident &&
      heroProgress !== null &&
      heroProgress >= this.transitionPolicy.heroProgressToPreload
    ) {
      return "preload";
    }

    if (
      hero.state.dominant &&
      media.state.resident &&
      !media.state.visible &&
      heroProgress !== null &&
      heroProgress >= this.transitionPolicy.heroProgressToOverlap
    ) {
      return "overlap";
    }

    if (
      hero.state.dominant &&
      media.state.visible &&
      !media.state.dominant &&
      mediaProgress !== null &&
      mediaProgress < this.cameraHandoffPolicy.startProgress
    ) {
      return "overlap";
    }

    if (
      hero.state.dominant &&
      media.state.visible &&
      !media.state.dominant &&
      mediaProgress !== null &&
      Number.isFinite(this.cameraHandoffPolicy.startProgress) &&
      Number.isFinite(this.cameraHandoffPolicy.endProgress) &&
      this.cameraHandoffPolicy.startProgress < this.cameraHandoffPolicy.endProgress &&
      mediaProgress >= this.cameraHandoffPolicy.startProgress &&
      mediaProgress <= this.cameraHandoffPolicy.endProgress
    ) {
      const mediaScene = this.getMediaScene();
      if (mediaScene?.scene && this.isMediaTransitionReady(mediaScene.scene, mediaScene.state)) {
        return "handoff";
      }

      return "overlap";
    }

    if (
      hero.state.dominant &&
      media.state.visible &&
      !media.state.dominant &&
      mediaProgress !== null &&
      Number.isFinite(this.cameraHandoffPolicy.endProgress) &&
      mediaProgress > this.cameraHandoffPolicy.endProgress &&
      (hero.state.visible || hero.state.updating || hero.state.dominant)
    ) {
      const mediaScene = this.getMediaScene();
      if (mediaScene?.scene && this.isMediaTransitionReady(mediaScene.scene, mediaScene.state)) {
        return "handoff";
      }
    }

    return "idle";
  }

  private resolveCameraBlendWeight(): number {
    const candidates = this.getCameraIntentCandidates();
    const dominant = candidates.find((entry) => entry.isDominant) ?? null;
    const secondary = candidates.find((entry) => !entry.isDominant) ?? null;
    if (!dominant || !secondary) {
      return 0;
    }

    const heroToMedia = dominant.scene.identity.sceneType === "hero" && secondary.scene.identity.sceneType === "media";
    const mediaToHero = dominant.scene.identity.sceneType === "media" && secondary.scene.identity.sceneType === "hero";
    const mediaReady = this.isMediaSceneReadyForHandoff(dominant.scene, secondary.scene);

    const { blendWeight } = resolveCameraBlend({
      dominant,
      secondary,
      isHeroToMedia: heroToMedia,
      isMediaToHero: mediaToHero,
      mediaReady,
      reducedMotion: this.snapshot.getSnapshot().reducedMotion,
      policy: this.cameraHandoffPolicy,
    });

    return blendWeight;
  }

  private advanceManifestoAboutTransition(payload: MotionFramePayload): void {
    const about = this.getAboutScene();
    const tracker = this.domTracker;
    if (!about || !tracker) {
      this.aboutTransitionState.isManifestoInterlude = false;
      return;
    }

    const policy = this.manifestoAboutPolicy;
    const aboutAnchor = tracker.getSnapshot(
      about.scene.identity.anchorId ?? policy.aboutAnchorId,
    );
    if (!aboutAnchor) {
      this.aboutTransitionState.isManifestoInterlude = false;
      return;
    }

    const viewportHeight = Math.max(1, aboutAnchor.viewport.height);
    const aboutTop = aboutAnchor.worldTop.screen.y;
    const aboutBottom = aboutAnchor.worldBottom.screen.y;
    const coreTop = policy.activationCoreTop * viewportHeight;
    const coreBottom = policy.activationCoreBottom * viewportHeight;
    const isAboutCoreActive =
      aboutTop <= coreBottom && aboutBottom >= coreTop;
    const isBeforeAboutCore =
      aboutTop > policy.cacheBeforeTop * viewportHeight;
    const isAfterAboutCore =
      aboutBottom < policy.cacheAfterBottom * viewportHeight;
    const manifestoAnchor = tracker.getSnapshot(policy.manifestoAnchorId);
    const hasEnteredManifesto =
      Boolean(manifestoAnchor) &&
      manifestoAnchor!.worldTop.screen.y <= viewportHeight;
    const isBeforeManifesto =
      Boolean(manifestoAnchor) &&
      manifestoAnchor!.worldTop.screen.y > viewportHeight;

    this.aboutTransitionState.isManifestoInterlude =
      hasEnteredManifesto && isBeforeAboutCore && !isAboutCoreActive;

    const media = this.getMediaScene();
    if (hasEnteredManifesto && media?.state.resident && !media.state.cached) {
      if (!this.cache(media.id)) {
        return;
      }
    }

    let currentAbout = this.getAboutScene();
    if (!currentAbout) {
      return;
    }

    const shouldPreload =
      aboutTop <= viewportHeight * policy.preloadViewportDistance &&
      aboutBottom >= policy.cacheAfterBottom * viewportHeight;
    if (
      shouldPreload &&
      !currentAbout.state.resident &&
      !this.aboutTransitionState.preloadInFlight
    ) {
      this.aboutTransitionState.preloadInFlight = true;
      void this.preload(currentAbout.id).finally(() => {
        this.aboutTransitionState.preloadInFlight = false;
      });
      if (isAboutCoreActive) {
        this.aboutTransitionState.isManifestoInterlude = true;
      }
      return;
    }

    if (isAboutCoreActive) {
      if (
        !currentAbout.state.resident ||
        !this.isAboutVisualReady(currentAbout.scene)
      ) {
        this.aboutTransitionState.isManifestoInterlude = true;
        return;
      }

      if (!currentAbout.state.dominant) {
        const wasActive = isActiveState(currentAbout.state);
        if (!this.activate(currentAbout.id, "replace")) {
          return;
        }
        if (!wasActive) {
          this.updateSceneForCurrentFrame(
            currentAbout.id,
            payload,
            "activated",
          );
        }
      }
      this.aboutTransitionState.isManifestoInterlude = false;
      return;
    }

    if (
      (isBeforeAboutCore || isAfterAboutCore) &&
      isActiveState(currentAbout.state)
    ) {
      if (!this.cache(currentAbout.id)) {
        return;
      }
      currentAbout = this.getAboutScene();
      if (!currentAbout) {
        return;
      }
    }

    const currentMedia = this.getMediaScene();
    if (
      isBeforeManifesto &&
      currentMedia?.state.cached &&
      !isActiveState(currentAbout.state)
    ) {
      if (!this.activate(currentMedia.id, "replace")) {
        return;
      }
      this.updateSceneForCurrentFrame(currentMedia.id, payload, "restored");
      this.aboutTransitionState.isManifestoInterlude = false;
      this.advanceHeroToMediaTransition(payload);
      return;
    }

    if (isAfterAboutCore) {
      this.aboutTransitionState.isManifestoInterlude = true;
    }
  }

  private advanceQuoteBooksTransition(payload: MotionFramePayload): void {
    const books = this.getBooksScene();
    const tracker = this.domTracker;
    if (!books || !tracker) {
      this.booksTransitionState.isDomOnlyInterval = false;
      return;
    }

    const policy = this.quoteBooksPolicy;
    const booksAnchor = tracker.getSnapshot(
      books.scene.identity.anchorId ?? policy.booksAnchorId,
    );
    if (!booksAnchor) {
      this.booksTransitionState.isDomOnlyInterval = false;
      return;
    }

    const viewportHeight = Math.max(1, booksAnchor.viewport.height);
    const booksTop = booksAnchor.worldTop.screen.y;
    const booksBottom = booksAnchor.worldBottom.screen.y;
    const coreTop = policy.activationCoreTop * viewportHeight;
    const coreBottom = policy.activationCoreBottom * viewportHeight;
    const isBooksCoreActive =
      booksTop <= coreBottom && booksBottom >= coreTop;
    const isBeforeBooksCore =
      booksTop > policy.cacheBeforeTop * viewportHeight;
    const isAfterBooksCore =
      booksBottom < policy.cacheAfterBottom * viewportHeight;
    const shouldPreload =
      booksTop <= viewportHeight * policy.preloadViewportDistance &&
      booksBottom >= policy.cacheAfterBottom * viewportHeight;
    const quoteAnchor = tracker.getSnapshot(policy.quoteAnchorId);
    const quoteHasEntered =
      Boolean(quoteAnchor) &&
      quoteAnchor!.worldTop.screen.y <= viewportHeight;

    let currentBooks = books;
    this.booksTransitionState.isDomOnlyInterval =
      !currentBooks.state.dominant &&
      (quoteHasEntered || shouldPreload || isBooksCoreActive);

    if (
      shouldPreload &&
      !currentBooks.state.resident &&
      !this.booksTransitionState.preloadInFlight
    ) {
      this.booksTransitionState.preloadInFlight = true;
      void this.preload(currentBooks.id).finally(() => {
        this.booksTransitionState.preloadInFlight = false;
      });
      if (isBooksCoreActive) {
        this.booksTransitionState.activationRequested = true;
      }
      return;
    }

    if (isBooksCoreActive) {
      this.booksTransitionState.activationRequested = true;
      currentBooks = this.getBooksScene() ?? currentBooks;
      if (
        !currentBooks.state.resident ||
        !this.isBooksVisualReady(
          currentBooks.scene,
          currentBooks.state,
          false,
        )
      ) {
        this.booksTransitionState.isDomOnlyInterval = true;
        return;
      }

      if (!currentBooks.state.dominant) {
        const wasActive = isActiveState(currentBooks.state);
        if (!this.activate(currentBooks.id, "replace")) {
          return;
        }
        if (!wasActive) {
          this.updateSceneForCurrentFrame(
            currentBooks.id,
            payload,
            "activated",
          );
        }
      }
      this.booksTransitionState.isDomOnlyInterval = false;
      return;
    }

    const shouldCache =
      (isBeforeBooksCore || isAfterBooksCore) &&
      (
        this.booksTransitionState.activationRequested ||
        isActiveState(currentBooks.state)
      );
    if (
      shouldCache &&
      currentBooks.state.resident &&
      !currentBooks.state.cached
    ) {
      if (!this.cache(currentBooks.id)) {
        return;
      }
    }
    if (shouldCache) {
      this.booksTransitionState.activationRequested = false;
      this.booksTransitionState.isDomOnlyInterval =
        quoteHasEntered || isBeforeBooksCore;
    }
  }

  private advanceHeroToMediaTransition(payload: MotionFramePayload): void {
    const policy = this.transitionPolicy;
    for (let step = 0; step < 8; step += 1) {
      const heroState = this.getHeroScene();
      const mediaState = this.getMediaScene();
      if (!heroState || !mediaState) {
        return;
      }

      const heroProgress = getSceneHeroProgress(heroState.scene);
      const mediaProgress = getSceneMediaProgress(mediaState.scene);
      const reducedMotion = this.snapshot.getSnapshot().reducedMotion;
      const shouldDriveTransition = !reducedMotion || !policy.reduceMotionSkipsTransition;

      if (heroProgress === null || heroState.state === null || mediaState.state === null) {
        return;
      }

      if (
        shouldDriveTransition &&
        mediaState.state.dominant &&
        heroState.state.resident &&
        heroState.state.cached &&
        mediaProgress !== null &&
        mediaProgress < policy.mediaProgressToReplace
      ) {
        const restoredHero = this.activate(heroState.id, "replace");
        if (!restoredHero) {
          return;
        }

        this.updateSceneForCurrentFrame(heroState.id, payload, "restored");

        if (
          heroProgress >= policy.heroProgressToOverlap &&
          mediaState.state.resident
        ) {
          const mediaWasActive = isActiveState(mediaState.state);
          if (!this.activate(mediaState.id, "overlap")) {
            return;
          }
          if (!mediaWasActive) {
            this.updateSceneForCurrentFrame(mediaState.id, payload, "reactivated");
          }
        } else if (mediaState.state.visible && !this.cache(mediaState.id)) {
          return;
        }

        continue;
      }

      const isHeroActive = heroState.state.dominant || heroState.state.visible || heroState.state.updating;
      if (!isHeroActive) {
        return;
      }

      if (
        shouldDriveTransition &&
        heroState.state.dominant &&
        mediaState.state.visible &&
        !mediaState.state.dominant &&
        heroProgress !== null &&
        heroProgress <= policy.heroProgressToPreload &&
        mediaProgress !== null &&
        mediaProgress < policy.mediaProgressToReplace &&
        mediaState.state.resident &&
        !mediaState.state.cached
      ) {
        if (!this.cache(mediaState.id)) {
          return;
        }
        continue;
      }

      if (
        shouldDriveTransition &&
        isHeroActive &&
        heroProgress >= policy.heroProgressToPreload &&
        !mediaState.state.resident &&
        !this.mediaTransitionState.preloadInFlight
      ) {
        this.mediaTransitionState.preloadInFlight = true;
        void this.preload(mediaState.id).finally(() => {
          this.mediaTransitionState.preloadInFlight = false;
        });
        return;
      }

      if (shouldDriveTransition) {
        if (
          heroState.state.dominant &&
          mediaState.state.resident &&
          !mediaState.state.visible &&
          heroProgress >= policy.heroProgressToOverlap
        ) {
          const mediaWasActive = isActiveState(mediaState.state);
          if (!this.activate(mediaState.id, "overlap")) {
            return;
          }
          if (!mediaWasActive) {
            this.updateSceneForCurrentFrame(mediaState.id, payload, "activated");
          }
          continue;
        }

        if (
          heroState.state.dominant &&
          mediaState.state.visible &&
          !mediaState.state.dominant &&
          mediaProgress !== null &&
          mediaProgress >= policy.mediaProgressToReplace &&
          (
            this.isMediaTransitionReady(mediaState.scene, mediaState.state) ||
            heroProgress >= policy.heroProgressToCache
          )
        ) {
          if (!this.activate(mediaState.id, "replace")) {
            return;
          }
          continue;
        }
      }

      if (
        mediaState.state.dominant &&
        heroState.state.resident &&
        !heroState.state.cached &&
        heroProgress >= policy.heroProgressToCache
      ) {
        if (!this.cache(heroState.id)) {
          return;
        }
        continue;
      }

      return;
    }
  }

  private updateSceneForCurrentFrame(
    id: string,
    payload: MotionFramePayload,
    operation: "activated" | "reactivated" | "restored",
  ): void {
    const scene = this.scenes.get(id);
    if (!scene) {
      return;
    }

    try {
      scene.update(payload);
      this.updateStats.updateCount += 1;
    } catch (error) {
      if (typeof console !== "undefined") {
        console.error(`[SceneDirector] ${operation} scene update failed`, id, error);
      }
    }
  }

  private getHeroScene():
  | {
    readonly id: string;
    readonly scene: SceneModule<unknown>;
    readonly state: SceneLifecycleState;
  }
  | null {
    for (const [id, scene] of this.scenes) {
      if (scene.identity.sceneType === "hero") {
        const state = this.getState(id);
        if (!state) {
          return null;
        }
        return { id, scene, state };
      }
    }

    return null;
  }

  private getMediaScene():
  | {
    readonly id: string;
    readonly scene: SceneModule<unknown>;
    readonly state: SceneLifecycleState;
  }
  | null {
    for (const [id, scene] of this.scenes) {
      if (scene.identity.sceneType === "media") {
        const state = this.getState(id);
        if (!state) {
          return null;
        }
        return { id, scene, state };
      }
    }

    return null;
  }

  private getAboutScene():
  | {
    readonly id: string;
    readonly scene: SceneModule<unknown>;
    readonly state: SceneLifecycleState;
  }
  | null {
    for (const [id, scene] of this.scenes) {
      if (scene.identity.sceneType === "about") {
        const state = this.getState(id);
        if (!state) {
          return null;
        }
        return { id, scene, state };
      }
    }

    return null;
  }

  private getBooksScene():
  | {
    readonly id: string;
    readonly scene: SceneModule<unknown>;
    readonly state: SceneLifecycleState;
  }
  | null {
    for (const [id, scene] of this.scenes) {
      if (scene.identity.sceneType === "books") {
        const state = this.getState(id);
        if (!state) {
          return null;
        }
        return { id, scene, state };
      }
    }

    return null;
  }

  private isAboutVisualReady(scene: SceneModule<unknown>): boolean {
    const sceneSnapshot = scene.getSnapshot();
    if (!sceneSnapshot || typeof sceneSnapshot !== "object") {
      return false;
    }

    const candidate = sceneSnapshot as {
      readonly visualReady?: unknown;
      readonly portrait?: {
        readonly isAssetReady?: unknown;
      };
    };
    if (candidate.portrait?.isAssetReady !== undefined) {
      return Boolean(candidate.portrait.isAssetReady);
    }

    return Boolean(candidate.visualReady);
  }

  private isMediaSceneReadyForHandoff(
    dominant: SceneModule<unknown>,
    secondary: SceneModule<unknown>,
  ): boolean {
    if (dominant.identity.sceneType === "media") {
      return this.isMediaTransitionReady(dominant, this.getState(dominant.identity.id));
    }

    if (secondary.identity.sceneType === "media") {
      return this.isMediaTransitionReady(secondary, this.getState(secondary.identity.id));
    }

    return true;
  }

  private isMediaTransitionReady(
    scene: SceneModule<unknown>,
    registryState: SceneLifecycleState | null,
  ): boolean {
    if (!registryState || registryState.disposed || registryState.cached || !registryState.resident) {
      return false;
    }

    if (!(registryState.visible || registryState.updating || registryState.dominant)) {
      return false;
    }

    return this.isMediaVisualReady(scene, false);
  }

  private isMediaVisualReady(scene: SceneModule<unknown>, defaultReady: boolean): boolean {
    try {
      return this.resolveMediaVisualReady(scene, this.getState(scene.identity.id));
    } catch {
      return defaultReady;
    }
  }

  private isMediaVisualReadyFallback(scene: SceneModule<unknown>, defaultReady: boolean): boolean {
    const snapshot = scene.getSnapshot();
    if (!snapshot || typeof snapshot !== "object") {
      return defaultReady;
    }

    const candidate = snapshot as { readonly visualReady?: unknown };
    if (candidate.visualReady === undefined) {
      return defaultReady;
    }

    return Boolean(candidate.visualReady);
  }

  private isBooksVisualReady(
    scene: SceneModule<unknown>,
    registryState: SceneLifecycleState | null,
    defaultReady: boolean,
  ): boolean {
    if (
      !registryState ||
      registryState.disposed ||
      !registryState.resident
    ) {
      return false;
    }

    try {
      return this.resolveBooksVisualReady(scene, registryState);
    } catch {
      return defaultReady;
    }
  }

  private isBooksVisualReadyFallback(
    scene: SceneModule<unknown>,
    defaultReady: boolean,
  ): boolean {
    const snapshot = scene.getSnapshot();
    if (!snapshot || typeof snapshot !== "object") {
      return defaultReady;
    }

    const candidate = snapshot as { readonly visualReady?: unknown };
    if (candidate.visualReady === undefined) {
      return defaultReady;
    }

    return Boolean(candidate.visualReady);
  }
}

function isActiveState(state: SceneLifecycleState | null): boolean {
  return state?.dominant || state?.visible || state?.updating || false;
}

function cloneSceneCameraIntent(
  value: Readonly<SceneCameraIntent>,
): SceneCameraIntent {
  return {
    sceneId: value.sceneId,
    intent: {
      target: { ...value.intent.target },
      positionOffset: { ...value.intent.positionOffset },
      fovIntent: value.intent.fovIntent,
      depthBias: value.intent.depthBias,
      weight: value.intent.weight,
    },
  };
}

function resolveCameraBlend({
  dominant,
  secondary,
  isHeroToMedia,
  isMediaToHero,
  mediaReady,
  reducedMotion,
  policy,
}: {
  dominant: SceneIntentCandidate;
  secondary: SceneIntentCandidate;
  isHeroToMedia: boolean;
  isMediaToHero: boolean;
  mediaReady: boolean;
  reducedMotion: boolean;
  policy: SceneCameraHandoffPolicy;
}): CameraBlendState {
  let handoffProgress = 0;
  let handoffBlendWeight = 1;

  if (typeof window !== "undefined") {
    const runtimeDebug = (window as { __r3bBlendDebug?: unknown }).__r3bBlendDebug;
    if (runtimeDebug) {
      // eslint-disable-next-line no-console
      console.log("R3B_CAMERA_BLEND", {
        isHeroToMedia,
        isMediaToHero,
        mediaReady,
        dominant: dominant.sceneId,
        dominantType: dominant.scene.identity.sceneType,
        secondary: secondary.sceneId,
        secondaryType: secondary.scene.identity.sceneType,
        reducedMotion,
        dominantWeight: dominant.weight,
        secondaryWeight: secondary.weight,
        dominantVisible: dominant.sceneId,
      });
    }
  }

  if (isHeroToMedia && !reducedMotion && mediaReady) {
    const mediaProgress = getSceneMediaProgress(secondary.scene);
    handoffBlendWeight = mediaProgress === null ? 0 : resolveCameraHandoffBlend(mediaProgress, policy);
    handoffProgress = mediaProgress ?? 0;
  } else if (isMediaToHero && !reducedMotion && mediaReady) {
    const mediaProgress = getSceneMediaProgress(dominant.scene);
    handoffBlendWeight = mediaProgress === null ? 0 : resolveCameraHandoffBlend(mediaProgress, policy);
    handoffProgress = mediaProgress ?? 0;
  } else if ((isHeroToMedia || isMediaToHero) && reducedMotion) {
    handoffBlendWeight = 0;
    handoffProgress = 0;
  } else if ((isHeroToMedia || isMediaToHero) && !mediaReady) {
    handoffBlendWeight = 0;
    handoffProgress = 0;
  }

  const baseBlendWeight = resolveBlendWeight(dominant.weight, secondary.weight);
  const blendWeight = Math.max(
    0,
    Math.min(baseBlendWeight * handoffBlendWeight, policy.maxSecondaryBlend),
  );

  return {
    handoffProgress,
    blendWeight,
  };
}

function getSceneMediaProgress(scene: SceneModule<unknown>): number | null {
  const snapshot = scene.getSnapshot();
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  const candidate = snapshot as {
    readonly lifecycleMediaProgress?: unknown;
    readonly mediaProgress?: unknown;
  };
  const resolved =
    typeof candidate.lifecycleMediaProgress === "number" && Number.isFinite(candidate.lifecycleMediaProgress)
      ? candidate.lifecycleMediaProgress
      : candidate.mediaProgress;
  if (typeof resolved !== "number" || !Number.isFinite(resolved)) {
    return null;
  }

  return clamp(resolved, 0, 1);
}

function getSceneHeroProgress(scene: SceneModule<unknown>): number | null {
  const snapshot = scene.getSnapshot();
  if (!snapshot || typeof snapshot !== "object") {
    return null;
  }

  const candidate = snapshot as {
    readonly lifecycleChapterProgress?: unknown;
    readonly chapterProgress?: unknown;
  };
  const resolved =
    typeof candidate.lifecycleChapterProgress === "number" && Number.isFinite(candidate.lifecycleChapterProgress)
      ? candidate.lifecycleChapterProgress
      : candidate.chapterProgress;
  if (typeof resolved !== "number" || !Number.isFinite(resolved)) {
    return null;
  }

  return clamp(resolved, 0, 1);
}

function resolveCameraHandoffBlend(progress: number, policy: SceneCameraHandoffPolicy): number {
  const start = policy.startProgress;
  const end = policy.endProgress;
  const currentProgress = clamp(progress, 0, 1);

  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    return 0;
  }

  if (currentProgress <= start) {
    return 0;
  }

  if (currentProgress >= end) {
    return 1;
  }

  return clamp(
    policy.easing(clamp((currentProgress - start) / (end - start), 0, 1)),
    0,
    1,
  );
}
