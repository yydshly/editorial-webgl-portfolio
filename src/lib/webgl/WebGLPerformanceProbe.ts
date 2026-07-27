import RenderScheduler from "@/lib/webgl/RenderScheduler";
import AssetRegistry from "@/lib/webgl/AssetRegistry";
import SceneRegistry from "@/lib/webgl/SceneRegistry";
import { PERFORMANCE_TIER, type PerformanceTier } from "@/lib/webgl/PerformanceTier";
import type { SceneTransitionSnapshot } from "@/lib/webgl/SceneDirector";
import type { WebGLCompositionSnapshot } from "@/lib/webgl/WebGLCompositionSnapshot";
import type { GPUResourceSnapshot } from "@/lib/webgl/GPUResourceManager";
import type { SceneLifecycleState } from "@/lib/webgl/SceneRegistry";

export type WebGLRendererProbe = {
  readonly textureCount: number;
  readonly geometryCount: number;
  readonly drawCalls: number;
  readonly dpr: number;
};

export type WebGLPerformanceSnapshot = {
  readonly canvasCount: number;
  readonly render: {
    readonly isRunning: boolean;
    readonly isPaused: boolean;
    readonly isLowUpdateMode: boolean;
    readonly tier: PerformanceTier;
    readonly tierProfile: (typeof PERFORMANCE_TIER)[PerformanceTier];
    readonly dpr: number;
    readonly drawCalls: number;
    readonly geometryCount: number;
    readonly textureCount: number;
    readonly updateCostMs: number;
    readonly updateCount: number;
    readonly renderSubmitCostMs: number;
    readonly frameIntervalMs: number;
    readonly frameTimeMs: number;
  };
  readonly textures: {
    readonly ready: number;
    readonly disposed: number;
    readonly total: number;
    readonly activeInRenderer: number;
  };
  readonly drawCalls: number;
  readonly geometries: number;
  readonly scenes: {
    readonly total: number;
    readonly active: string | null;
    readonly dominant: string | null;
  };
  readonly transition: SceneTransitionSnapshot | null;
  readonly composition: WebGLCompositionSnapshot | null;
  readonly diagnostics: {
    readonly sceneStates: Readonly<Record<string, SceneLifecycleState | null>>;
    readonly sceneSnapshots: Readonly<Record<string, unknown>>;
    readonly assetOwnerCounts: Readonly<Record<string, number>>;
    readonly gpuResources: Readonly<Record<string, GPUResourceSnapshot | null>>;
  };
};

type WebGLPerformanceProbeInput = {
  readonly scheduler: RenderScheduler;
  readonly assetRegistry: AssetRegistry<unknown>;
  readonly sceneRegistry: SceneRegistry;
  readonly getCanvasCount?: () => number;
  readonly getRendererProbe?: () => WebGLRendererProbe | null;
  readonly getDirectorUpdateStats?: () => {
    readonly updateCostMs: number;
    readonly updateCount: number;
  } | null | undefined;
  readonly getDirectorTiming?: () => {
    readonly updateCostMs: number;
    readonly updateCount: number;
    readonly frameIntervalMs: number;
    readonly renderSubmitCostMs: number;
    readonly frameTimeMs: number;
  } | null | undefined;
  readonly getDirectorTransitionSnapshot?: () => SceneTransitionSnapshot | null | undefined;
  readonly getCompositionSnapshot?: () => WebGLCompositionSnapshot | null | undefined;
  readonly getSceneSnapshots?: () => Readonly<Record<string, unknown>>;
  readonly getGPUResourceSnapshots?: () => Readonly<Record<string, GPUResourceSnapshot | null>>;
};

export default class WebGLPerformanceProbe {
  constructor(private readonly input: WebGLPerformanceProbeInput) {}

  snapshot(): WebGLPerformanceSnapshot {
    const schedulerSnapshot = this.input.scheduler;
    const assetSnapshot = this.input.assetRegistry.snapshot;
    const sceneSnapshot = this.input.sceneRegistry.snapshot;
    const rendererSnapshot = this.input.getRendererProbe?.();
    const directorSnapshot = this.input.getDirectorUpdateStats?.();
    const timingSnapshot = this.input.getDirectorTiming?.();
    const transitionSnapshot = this.input.getDirectorTransitionSnapshot?.();
    const compositionSnapshot = this.input.getCompositionSnapshot?.();

    const tier = schedulerSnapshot.tier;
    const dpr = rendererSnapshot?.dpr ?? 0;
    const updateCostMs = timingSnapshot?.updateCostMs ?? directorSnapshot?.updateCostMs ?? 0;
    const updateCount = timingSnapshot?.updateCount ?? directorSnapshot?.updateCount ?? 0;
    const renderSubmitCostMs = timingSnapshot?.renderSubmitCostMs ?? 0;
    const frameIntervalMs = timingSnapshot?.frameIntervalMs ?? 0;
    const frameTimeMs = timingSnapshot?.frameTimeMs ?? 0;

    return {
      canvasCount: this.input.getCanvasCount?.() ?? 0,
      render: {
        isRunning: schedulerSnapshot.isRunning,
        isPaused: schedulerSnapshot.isPaused,
        isLowUpdateMode: schedulerSnapshot.isLowUpdateMode,
        tier,
        tierProfile: PERFORMANCE_TIER[tier],
        dpr,
        drawCalls: rendererSnapshot?.drawCalls ?? 0,
        geometryCount: rendererSnapshot?.geometryCount ?? 0,
        textureCount: rendererSnapshot?.textureCount ?? 0,
        updateCostMs,
        updateCount,
        renderSubmitCostMs,
        frameIntervalMs,
        frameTimeMs,
      },
      textures: {
        ready: assetSnapshot.byState.ready,
        disposed: assetSnapshot.byState.disposed,
        total: assetSnapshot.total,
        activeInRenderer: rendererSnapshot?.textureCount ?? 0,
      },
      drawCalls: rendererSnapshot?.drawCalls ?? 0,
      geometries: rendererSnapshot?.geometryCount ?? 0,
      scenes: {
        total: sceneSnapshot.total,
        active: sceneSnapshot.active,
        dominant: sceneSnapshot.dominant,
      },
      transition: transitionSnapshot ?? null,
      composition: compositionSnapshot ?? null,
      diagnostics: {
        sceneStates: Object.fromEntries(
          sceneSnapshot.scenes.map((scene) => [
            scene.id,
            this.input.sceneRegistry.getState(scene.id),
          ]),
        ),
        sceneSnapshots: this.input.getSceneSnapshots?.() ?? {},
        assetOwnerCounts: assetSnapshot.ownerCounts,
        gpuResources: this.input.getGPUResourceSnapshots?.() ?? {},
      },
    };
  }
}
