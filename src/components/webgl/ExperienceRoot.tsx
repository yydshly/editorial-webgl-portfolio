"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type * as THREE from "three";

import AssetRegistry from "@/lib/webgl/AssetRegistry";
import RenderScheduler from "@/lib/webgl/RenderScheduler";
import SceneRegistry from "@/lib/webgl/SceneRegistry";
import CanvasErrorBoundary from "@/components/webgl/CanvasErrorBoundary";
import CameraRig from "@/lib/webgl/CameraRig";
import DOMTracker from "@/lib/webgl/DOMTracker";
import SceneDirector from "@/lib/webgl/SceneDirector";
import WebGLFallback from "@/components/webgl/WebGLFallback";
import GlobalWebGLStage from "@/components/webgl/GlobalWebGLStage";
import { useRuntime } from "@/lib/motion/RuntimeProvider";
import { shouldExposeRuntimeDiagnostics } from "@/lib/runtime/diagnostics";
import WebGLRuntimeContext from "@/lib/webgl/WebGLRuntimeContext";
import HeroScene from "@/lib/webgl/hero/HeroScene";
import HeroWebGLRenderer from "@/lib/webgl/hero/HeroWebGLRenderer";
import { heroSceneConfig } from "@/lib/webgl/hero/heroSceneConfig";
import MediaScene from "@/lib/webgl/media/MediaScene";
import MediaWebGLRenderer from "@/lib/webgl/media/MediaWebGLRenderer";
import WebGLPerformanceProbe from "@/lib/webgl/WebGLPerformanceProbe";
import {
  resolveMediaFallbackState,
  resolveMediaVisualReady,
  setMediaFallbackImageVisibility,
} from "@/lib/webgl/MediaFallbackVisibility";
import type { MotionFramePayload } from "@/lib/motion/types";
import type { WebGLCompositionSnapshot } from "@/lib/webgl/WebGLCompositionSnapshot";
import GPUResourceManager from "@/lib/webgl/GPUResourceManager";
import AboutScene from "@/lib/webgl/about/AboutScene";
import AboutWebGLRenderer from "@/lib/webgl/about/AboutWebGLRenderer";
import {
  resolveAboutFallbackState,
  setAboutFallbackImageVisibility,
} from "@/lib/webgl/about/AboutFallbackVisibility";
import BooksScene from "@/lib/webgl/books/BooksScene";
import BooksWebGLRenderer from "@/lib/webgl/books/BooksWebGLRenderer";
import {
  resolveBooksFallbackState,
  setBooksFallbackImageVisibility,
} from "@/lib/webgl/books/BooksFallbackVisibility";

type ExperienceRootProps = {
  readonly children: ReactNode;
};

type FramePerformanceSnapshot = {
  updateCostMs: number;
  updateCount: number;
  frameIntervalMs: number;
  renderSubmitCostMs: number;
  frameTimeMs: number;
};

export default function ExperienceRoot({ children }: ExperienceRootProps) {
  const { snapshot, frame, bus } = useRuntime();
  const [sceneRegistry] = useState(() => new SceneRegistry());
  const [assetRegistry] = useState(() => new AssetRegistry<HTMLImageElement>());
  const [renderScheduler] = useState(() => new RenderScheduler(frame));
  const [cameraRig] = useState(() => new CameraRig());
  const [domTracker] = useState(() => new DOMTracker(frame, bus, cameraRig));
  const [aboutGPUResourceManager] = useState(() => new GPUResourceManager());
  const [booksGPUResourceManager] = useState(() => new GPUResourceManager());
  const heroRendererRef = useRef<HeroWebGLRenderer | null>(null);
  const mediaRendererRef = useRef<MediaWebGLRenderer | null>(null);
  const aboutRendererRef = useRef<AboutWebGLRenderer | null>(null);
  const booksRendererRef = useRef<BooksWebGLRenderer | null>(null);
  const globalRendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const performanceProbeRef = useRef<WebGLPerformanceProbe | null>(null);
  const sceneDirectorRef = useRef<SceneDirector | null>(null);
  const previousCameraIntentSceneIdRef = useRef<string | null>(null);
  const mediaWebGLState = useRef({
    available: false,
    contextLost: false,
  });
  const aboutWebGLState = useRef({
    available: false,
    contextLost: false,
  });
  const booksWebGLState = useRef({
    available: false,
    contextLost: false,
  });
  const rendererProbeRef = useRef<{
    readonly textureCount: number;
    readonly geometryCount: number;
    readonly drawCalls: number;
    readonly dpr: number;
  } | null>(null);
  const sceneDirectorMetrics = useRef<FramePerformanceSnapshot>({
    updateCostMs: 0,
    updateCount: 0,
    frameIntervalMs: 0,
    renderSubmitCostMs: 0,
    frameTimeMs: 0,
  });
  const [heroScene] = useState(() =>
    new HeroScene({
      assetRegistry,
      domTracker,
      snapshot,
    }),
  );
  const [mediaScene] = useState(() =>
    new MediaScene({
      assetRegistry,
      domTracker,
      snapshot,
    }),
  );
  const [aboutScene] = useState(
    () =>
      new AboutScene({
        assetRegistry,
        domTracker,
        gpuResourceManager: aboutGPUResourceManager,
        snapshot,
      }),
  );
  const [booksScene] = useState(
    () =>
      new BooksScene({
        assetRegistry,
        domTracker,
        gpuResourceManager: booksGPUResourceManager,
        snapshot,
      }),
  );
  const applyMediaFallbackVisibility = useCallback(() => {
    const currentSnapshot = snapshot.getSnapshot();
    const mediaComposition = mediaRendererRef.current?.compositionSnapshot;
    const mediaRegistryState = sceneRegistry.getState(mediaScene.identity.id);
    const visualReady = resolveMediaVisualReady(mediaScene.getSnapshot(), {
      mediaMainLayer: mediaComposition?.main ?? null,
      minMainAreaPx: 4,
      minMainOpacity: 0.04,
      viewportWidth: currentSnapshot.viewport.width,
      viewportHeight: currentSnapshot.viewport.height,
      minViewportIntersectionPx: 4,
      minViewportIntersectionRatio: 0.01,
      sceneState: mediaRegistryState,
    });
    mediaScene.setVisualReady(visualReady);

    const state = resolveMediaFallbackState(mediaWebGLState.current, {
      snapshot: mediaScene.getSnapshot(),
      registryState: sceneRegistry.getState(mediaScene.identity.id),
      },
      visualReady,
    );
    setMediaFallbackImageVisibility("img[data-media-fallback='true']", state);
  }, [mediaScene, sceneRegistry, snapshot]);

  const applyAboutFallbackVisibility = useCallback(() => {
    const state = resolveAboutFallbackState(aboutWebGLState.current, {
      snapshot: aboutScene.getSnapshot(),
      registryState: sceneRegistry.getState(aboutScene.identity.id),
      portrait: aboutRendererRef.current?.compositionSnapshot.portrait ?? null,
    });
    setAboutFallbackImageVisibility(state);
  }, [aboutScene, sceneRegistry]);

  const applyBooksFallbackVisibility = useCallback(() => {
    const state = resolveBooksFallbackState(booksWebGLState.current, {
      snapshot: booksScene.getSnapshot(),
      registryState: sceneRegistry.getState(booksScene.identity.id),
      composition:
        booksRendererRef.current?.compositionSnapshot ?? null,
    });
    setBooksFallbackImageVisibility(state);
  }, [booksScene, sceneRegistry]);

  const handleWebGLRuntimeStateChange = useCallback(
    (state: {
      readonly isReady: boolean;
      readonly isUnavailable: boolean;
      readonly isContextLost: boolean;
    }): void => {
      mediaWebGLState.current = {
        available: !state.isUnavailable && state.isReady,
        contextLost: state.isContextLost,
      };
      aboutWebGLState.current = {
        available: !state.isUnavailable && state.isReady,
        contextLost: state.isContextLost,
      };
      booksWebGLState.current = {
        available: !state.isUnavailable && state.isReady,
        contextLost: state.isContextLost,
      };
      applyMediaFallbackVisibility();
      applyAboutFallbackVisibility();
      applyBooksFallbackVisibility();
    },
    [
      applyAboutFallbackVisibility,
      applyBooksFallbackVisibility,
      applyMediaFallbackVisibility,
    ],
  );

  useEffect(() => {
    if (!sceneDirectorRef.current) {
      sceneDirectorRef.current = new SceneDirector({
        registry: sceneRegistry,
        scheduler: renderScheduler,
        snapshot,
        domTracker,
        mediaVisualReadyResolver: () => {
          const currentSnapshot = snapshot.getSnapshot();
          const mediaComposition = mediaRendererRef.current?.compositionSnapshot;
          const mediaRegistryState = sceneRegistry.getState(mediaScene.identity.id);
          return resolveMediaVisualReady(mediaScene.getSnapshot(), {
            mediaMainLayer: mediaComposition?.main ?? null,
            minMainAreaPx: 4,
            minMainOpacity: 0.04,
            viewportWidth: currentSnapshot.viewport.width,
            viewportHeight: currentSnapshot.viewport.height,
            minViewportIntersectionPx: 4,
            minViewportIntersectionRatio: 0.01,
            sceneState: mediaRegistryState,
          });
        },
        booksVisualReadyResolver: () =>
          booksRendererRef.current?.isVisualReady ?? false,
        onUpdateProfile: (durationMs, updateCount) => {
          sceneDirectorMetrics.current.updateCostMs = durationMs;
          sceneDirectorMetrics.current.updateCount = updateCount;
        },
        updatePriority: 10,
      });
    }

    const currentDirector = sceneDirectorRef.current;
    return () => {
      currentDirector?.destroy();
    };
  }, [
    domTracker,
    mediaScene,
    renderScheduler,
    sceneRegistry,
    snapshot,
  ]);

  useEffect(() => {
    domTracker.connect();
    return () => domTracker.dispose();
  }, [domTracker]);

  useEffect(() => {
    const getDirectorMetrics = (): FramePerformanceSnapshot => ({
      ...sceneDirectorMetrics.current,
    });
    const getCompositionSnapshot = (): WebGLCompositionSnapshot | null => {
      const hero = heroRendererRef.current?.compositionSnapshot;
      const media = mediaRendererRef.current?.compositionSnapshot;
      if (!hero || !media) {
        return null;
      }

      return {
        rendererOwner: "global-webgl-stage",
        camera: cameraRig.compositionSnapshot,
        hero,
        media,
        about: aboutRendererRef.current?.compositionSnapshot ?? null,
        books: booksRendererRef.current?.compositionSnapshot ?? null,
      };
    };

    const performanceProbe = new WebGLPerformanceProbe({
      scheduler: renderScheduler,
      assetRegistry,
      sceneRegistry,
      getDirectorUpdateStats: () => sceneDirectorRef.current?.updateSnapshot,
      getDirectorTiming: getDirectorMetrics,
      getDirectorTransitionSnapshot: () => sceneDirectorRef.current?.transitionSnapshot ?? null,
      getCanvasCount: () =>
        typeof document === "undefined"
          ? 0
          : document.querySelectorAll("canvas.webgl-canvas").length,
      getRendererProbe: () => rendererProbeRef.current,
      getCompositionSnapshot,
      getSceneSnapshots: () => ({
        [heroScene.identity.id]: heroScene.sceneSnapshot,
        [mediaScene.identity.id]: mediaScene.getSnapshot(),
        [aboutScene.identity.id]: aboutScene.getSnapshot(),
        [booksScene.identity.id]: booksScene.getSnapshot(),
      }),
      getGPUResourceSnapshots: () => ({
        [heroScene.identity.id]: heroRendererRef.current?.resourceSnapshot ?? null,
        [mediaScene.identity.id]: mediaRendererRef.current?.resourceSnapshot ?? null,
        [aboutScene.identity.id]:
          aboutRendererRef.current?.resourceSnapshot ?? null,
        [booksScene.identity.id]:
          booksRendererRef.current?.resourceSnapshot ?? null,
      }),
    });
    performanceProbeRef.current = performanceProbe;
    if (typeof window !== "undefined" && shouldExposeRuntimeDiagnostics()) {
      (
        window as Window & {
          __editorialWebGLProbe?: WebGLPerformanceProbe;
        }
      ).__editorialWebGLProbe = performanceProbe;
    }

    return () => {
      if (typeof window !== "undefined" && shouldExposeRuntimeDiagnostics()) {
        const currentWindow = window as Window & {
          __editorialWebGLProbe?: WebGLPerformanceProbe;
        };
        if (currentWindow.__editorialWebGLProbe === performanceProbe) {
          delete currentWindow.__editorialWebGLProbe;
        }
      }
      performanceProbeRef.current = null;
    };
  }, [
    aboutScene,
    assetRegistry,
    booksScene,
    cameraRig,
    heroScene,
    mediaScene,
    renderScheduler,
    sceneRegistry,
  ]);

  const getRendererProbe = useCallback(() => {
    const renderer = globalRendererRef.current;
    if (!renderer) {
      return null;
    }

    return {
      textureCount: renderer.info.memory.textures,
      geometryCount: renderer.info.memory.geometries,
      drawCalls: renderer.info.render.calls,
      dpr: renderer.getPixelRatio(),
    };
  }, []);

  const initRenderer = useCallback(
    (
      context: WebGLRenderingContext,
      canvas: HTMLCanvasElement,
      renderer: THREE.WebGLRenderer,
    ): void => {
      heroRendererRef.current?.dispose();
      mediaRendererRef.current?.dispose();
      aboutRendererRef.current?.dispose();
      booksRendererRef.current?.dispose();
      globalRendererRef.current = renderer;
      heroRendererRef.current = new HeroWebGLRenderer({
        canvas,
        context,
        renderer,
        snapshot,
        assetRegistry,
        config: heroSceneConfig,
        camera: cameraRig.camera,
        scheduler: renderScheduler,
        getHeroState: () => heroScene.sceneSnapshot,
      });
      mediaRendererRef.current = new MediaWebGLRenderer({
        canvas,
        context,
        renderer,
        snapshot,
        assetRegistry,
        camera: cameraRig.camera,
        scheduler: renderScheduler,
        getMediaState: () => mediaScene.getSnapshot(),
      });
      aboutRendererRef.current = new AboutWebGLRenderer({
        context,
        renderer,
        snapshot,
        assetRegistry,
        gpuResourceManager: aboutGPUResourceManager,
        camera: cameraRig.camera,
        getAboutState: () => aboutScene.getSnapshot(),
      });
      booksRendererRef.current = new BooksWebGLRenderer({
        context,
        renderer,
        snapshot,
        assetRegistry,
        gpuResourceManager: booksGPUResourceManager,
        camera: cameraRig.camera,
        getBooksState: () => booksScene.getSnapshot(),
      });
      rendererProbeRef.current = getRendererProbe();
    },
    [
      aboutGPUResourceManager,
      aboutScene,
      assetRegistry,
      booksGPUResourceManager,
      booksScene,
      heroScene,
      mediaScene,
      renderScheduler,
      snapshot,
      cameraRig,
      getRendererProbe,
    ],
  );

  const handleContextLost = useCallback(() => {
    mediaWebGLState.current = { available: false, contextLost: true };
    aboutWebGLState.current = { available: false, contextLost: true };
    booksWebGLState.current = { available: false, contextLost: true };
    booksScene.setVisualReady(false);
    applyMediaFallbackVisibility();
    applyAboutFallbackVisibility();
    applyBooksFallbackVisibility();
    heroRendererRef.current?.dispose();
    heroRendererRef.current = null;
    mediaRendererRef.current?.dispose();
    mediaRendererRef.current = null;
    aboutRendererRef.current?.dispose();
    aboutRendererRef.current = null;
    booksRendererRef.current?.dispose();
    booksRendererRef.current = null;
    globalRendererRef.current = null;
    rendererProbeRef.current = null;
  }, [
    applyAboutFallbackVisibility,
    applyBooksFallbackVisibility,
    applyMediaFallbackVisibility,
    booksScene,
  ]);

  const bridgeRenderer = useCallback((payload: MotionFramePayload): void => {
    const sceneDirector = sceneDirectorRef.current;
    const resolvedCameraIntent = sceneDirector?.getCameraIntent() ?? null;
    const transitionSnapshot = sceneDirector?.transitionSnapshot ?? null;
    const reducedMotion = snapshot.getSnapshot().reducedMotion;
    const previousSceneId = previousCameraIntentSceneIdRef.current;
    const nextSceneId = resolvedCameraIntent?.sceneId ?? null;
    const shouldSnapCamera =
      reducedMotion ||
      (
        previousSceneId !== null &&
        nextSceneId !== null &&
        previousSceneId !== nextSceneId &&
        (transitionSnapshot?.cameraBlendWeight ?? 0) <= 0.00001
      );

    cameraRig.setCameraIntent(resolvedCameraIntent?.intent ?? null, {
      immediate: shouldSnapCamera,
    });
    previousCameraIntentSceneIdRef.current = nextSceneId;
    cameraRig.update(payload.delta ?? 1 / 60);

    const start = performance.now();
    heroRendererRef.current?.render();
    mediaRendererRef.current?.render();
    aboutRendererRef.current?.render();
    booksRendererRef.current?.render();
    sceneDirectorMetrics.current.renderSubmitCostMs = Math.max(0, performance.now() - start);
    rendererProbeRef.current = getRendererProbe();
  }, [cameraRig, getRendererProbe, snapshot]);

  useEffect(() => {
    const unregister = frame.register("POST", () => {
      applyMediaFallbackVisibility();
      applyAboutFallbackVisibility();
      booksScene.setVisualReady(
        booksRendererRef.current?.isVisualReady ?? false,
      );
      applyBooksFallbackVisibility();
    });

    return () => {
      unregister();
    };
  }, [
    applyAboutFallbackVisibility,
    applyBooksFallbackVisibility,
    applyMediaFallbackVisibility,
    booksScene,
    frame,
  ]);

  useEffect(() => {
    const unregister = sceneRegistry.registerStateListener(
      mediaScene.identity.id,
      () => {
        applyMediaFallbackVisibility();
      },
    );

    return () => {
      unregister();
    };
  }, [applyMediaFallbackVisibility, mediaScene.identity.id, sceneRegistry]);

  useEffect(() => {
    const unregister = sceneRegistry.registerStateListener(
      aboutScene.identity.id,
      () => {
        applyAboutFallbackVisibility();
      },
    );

    return () => {
      unregister();
    };
  }, [aboutScene.identity.id, applyAboutFallbackVisibility, sceneRegistry]);

  useEffect(() => {
    const unregister = sceneRegistry.registerStateListener(
      booksScene.identity.id,
      () => {
        applyBooksFallbackVisibility();
      },
    );

    return () => {
      unregister();
    };
  }, [
    applyBooksFallbackVisibility,
    booksScene.identity.id,
    sceneRegistry,
  ]);

  useEffect(() => {
    return () => {
      heroRendererRef.current?.dispose();
      heroRendererRef.current = null;
      mediaRendererRef.current?.dispose();
      mediaRendererRef.current = null;
      aboutRendererRef.current?.dispose();
      aboutRendererRef.current = null;
      booksRendererRef.current?.dispose();
      booksRendererRef.current = null;
      globalRendererRef.current = null;
      rendererProbeRef.current = null;
    };
  }, []);

  useEffect(() => {
    const sceneId = booksScene.identity.id;
    const sceneDirector = sceneDirectorRef.current;
    if (!sceneDirector) {
      return;
    }

    sceneDirector.register(booksScene);

    return () => {
      sceneDirector.dispose(sceneId);
    };
  }, [booksScene]);

  useEffect(() => {
    const sceneId = aboutScene.identity.id;
    const sceneDirector = sceneDirectorRef.current;
    if (!sceneDirector) {
      return;
    }

    sceneDirector.register(aboutScene);

    return () => {
      sceneDirector.dispose(sceneId);
    };
  }, [aboutScene]);

  useEffect(() => {
    const sceneId = mediaScene.identity.id;
    const sceneDirector = sceneDirectorRef.current;
    if (!sceneDirector) {
      return;
    }

    sceneDirector.register(mediaScene);

    return () => {
      sceneDirector.dispose(sceneId);
    };
  }, [mediaScene]);

  useEffect(() => {
    const sceneId = heroScene.identity.id;
    const sceneDirector = sceneDirectorRef.current;
    if (!sceneDirector) {
      return;
    }

    sceneDirector.register(heroScene);
    void sceneDirector.preload(sceneId);
    sceneDirector.activate(sceneId, "replace");

    return () => {
      sceneDirector.dispose(sceneId);
    };
  }, [heroScene]);

  useEffect(() => {
    let previousTimestamp = NaN;
    const unregister = frame.register("POST", (payload) => {
      if (!Number.isNaN(previousTimestamp)) {
        sceneDirectorMetrics.current.frameIntervalMs = payload.timestamp - previousTimestamp;
      }
      previousTimestamp = payload.timestamp;
      sceneDirectorMetrics.current.frameTimeMs = payload.delta * 1000;
    });

    return () => {
      unregister();
    };
  }, [frame]);

  useEffect(() => {
    return () => {
      sceneDirectorRef.current?.disposeAll();
      sceneDirectorRef.current?.destroy();
      sceneDirectorRef.current = null;
      sceneRegistry.clear();
      assetRegistry.clear();
      aboutGPUResourceManager.clear();
      booksGPUResourceManager.clear();
      renderScheduler.dispose();
    };
  }, [
    aboutGPUResourceManager,
    assetRegistry,
    booksGPUResourceManager,
    renderScheduler,
    sceneRegistry,
  ]);

  return (
    <div className="experience-root">
      <CanvasErrorBoundary fallback={<WebGLFallback reason="WebGL fallback activated due to runtime error." />}>
        <GlobalWebGLStage
          frame={frame}
          onReady={initRenderer}
          onRuntimeStateChange={handleWebGLRuntimeStateChange}
          onContextLost={handleContextLost}
          externalRenderer={bridgeRenderer}
          renderScheduler={renderScheduler}
        />
      </CanvasErrorBoundary>
      <WebGLRuntimeContext.Provider
        value={{
          domTracker,
          cameraRig,
        }}
      >
        <div className="experience-main">{children}</div>
      </WebGLRuntimeContext.Provider>
    </div>
  );
}
