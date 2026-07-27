"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

import FrameCoordinator from "@/lib/motion/FrameCoordinator";
import type { MotionFramePayload, Unsubscribe } from "@/lib/motion/types";
import RenderScheduler from "@/lib/webgl/RenderScheduler";
import { resolveDevicePixelRatio } from "@/lib/webgl/PerformanceTier";
import type { WebGLTick } from "@/lib/webgl/types";
import WebGLCapability from "@/lib/webgl/WebGLCapability";
import type { WebGLCapabilityResult } from "@/lib/webgl/WebGLCapability";
import WebGLFallback from "@/components/webgl/WebGLFallback";

type GlobalWebGLStageProps = {
  readonly frame: FrameCoordinator;
  readonly externalRenderer?: WebGLTick;
  readonly onRuntimeStateChange?: (state: {
    readonly isReady: boolean;
    readonly isUnavailable: boolean;
    readonly isContextLost: boolean;
    readonly reason: string | null;
  }) => void;
  readonly onReady?: (
    context: WebGLRenderingContext,
    canvas: HTMLCanvasElement,
    renderer: THREE.WebGLRenderer,
  ) => void;
  readonly onContextLost?: () => void;
  readonly onContextRestored?: () => void;
  readonly renderScheduler?: RenderScheduler;
};

type GlobalRendererViewport = {
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
};

const CANVAS_ATTRIBUTES = {
  "aria-hidden": "true",
  className: "webgl-canvas",
  "data-webgl-stage": "root",
} as const;

export default function GlobalWebGLStage({
  frame,
  externalRenderer,
  onRuntimeStateChange,
  onReady,
  onContextLost,
  onContextRestored,
  renderScheduler,
}: GlobalWebGLStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rendererViewportRef = useRef<GlobalRendererViewport | null>(null);
  const frameUnsubscribe = useRef<Unsubscribe | null>(null);
  const internalScheduler = useMemo(() => new RenderScheduler(frame), [frame]);
  const scheduler = renderScheduler ?? internalScheduler;
  const initializationInProgress = useRef(false);
  const isMountedRef = useRef(false);
  const isReadyRef = useRef(false);
  const hasMountedContext = useRef(false);
  const onRuntimeStateChangeRef = useRef(onRuntimeStateChange);
  const capabilityRef = useRef<WebGLCapabilityResult | null>(null);
  const fallbackReasonRef = useRef<string | null>(null);
  const readyRef = useRef(false);

  const [capability, setCapability] = useState<WebGLCapabilityResult | null>(null);
  const [ready, setReady] = useState(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);

  useEffect(() => {
    onRuntimeStateChangeRef.current = onRuntimeStateChange;
  }, [onRuntimeStateChange]);

  const publishRuntimeState = useCallback((): void => {
    const capabilityState = capabilityRef.current;
    const reason = fallbackReasonRef.current;
    const readyState = readyRef.current;
    const onStateChange = onRuntimeStateChangeRef.current;

    if (!onStateChange) {
      return;
    }

    const isContextRestorePending =
      capabilityState?.supported === true &&
      !readyState &&
      reason === "WebGL context lost.";

    if (!capabilityState) {
      onStateChange({
        isReady: false,
        isUnavailable: true,
        isContextLost: false,
        reason: null,
      });
      return;
    }

    if (!capabilityState.supported) {
      onStateChange({
        isReady: false,
        isUnavailable: true,
        isContextLost: false,
        reason: capabilityState.reason ?? "WebGL unsupported",
      });
      return;
    }

    if (isContextRestorePending) {
      onStateChange({
        isReady: false,
        isUnavailable: false,
        isContextLost: true,
        reason: reason ?? "WebGL context lost.",
      });
      return;
    }

    onStateChange({
      isReady: readyState,
      isUnavailable: !readyState,
      isContextLost: false,
      reason: readyState ? null : (reason ?? null),
    });
  }, []);

  const resizeRenderer = useCallback((renderer: THREE.WebGLRenderer): void => {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    const dpr = resolveDevicePixelRatio(window.devicePixelRatio || 1, scheduler.tier);
    const current = rendererViewportRef.current;
    if (
      current?.width === width &&
      current.height === height &&
      current.dpr === dpr
    ) {
      return;
    }

    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    rendererViewportRef.current = {
      width,
      height,
      dpr,
    };
  }, [scheduler]);

  const releaseContext = useCallback((preserveContext = false) => {
    const context = glRef.current;
    if (!context) {
      return;
    }

    rendererRef.current?.dispose();
    rendererRef.current = null;
    rendererViewportRef.current = null;

    if (!preserveContext) {
      const loseContextExtension = context.getExtension?.("WEBGL_lose_context");
      const hasLoseContext =
        typeof loseContextExtension === "object" &&
        loseContextExtension !== null &&
        "loseContext" in loseContextExtension &&
        typeof (loseContextExtension as { loseContext: () => void }).loseContext === "function";

      if (hasLoseContext) {
        loseContextExtension.loseContext();
      }
    }

    glRef.current = null;
    isReadyRef.current = false;
    readyRef.current = false;
    fallbackReasonRef.current = null;
    setFallbackReason(null);
    setReady(false);
  }, []);

  const initializeContext = useCallback(() => {
    if (!capabilityRef.current?.supported || initializationInProgress.current || !isMountedRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || glRef.current) {
      return;
    }

    initializationInProgress.current = true;

    try {
      const runtimeContext = WebGLCapability.getContextFromCanvas(canvas);
      if (!runtimeContext || !runtimeContext.context) {
        if (!isMountedRef.current) {
          return;
        }
        fallbackReasonRef.current = "WebGL context is not available.";
        setFallbackReason("WebGL context is not available.");
        readyRef.current = false;
        isReadyRef.current = false;
        setReady(false);
        publishRuntimeState();
        return;
      }

      const { context } = runtimeContext;
      glRef.current = context;
      const renderer = new THREE.WebGLRenderer({
        canvas,
        context,
        alpha: true,
      });
      renderer.autoClear = false;
      renderer.info.autoReset = false;
      renderer.setClearColor(0x0e0f15, 1);
      renderer.setClearAlpha(1);
      rendererRef.current = renderer;
      resizeRenderer(renderer);
      onReady?.(context, canvas, renderer);
      if (hasMountedContext.current) {
        onContextRestored?.();
      } else {
        hasMountedContext.current = true;
      }

      fallbackReasonRef.current = null;
      setFallbackReason(null);
      readyRef.current = true;
      isReadyRef.current = true;
      setReady(true);
      publishRuntimeState();
    } catch (error) {
      if (isMountedRef.current) {
        fallbackReasonRef.current = "Failed to initialize WebGL runtime.";
        setFallbackReason("Failed to initialize WebGL runtime.");
        readyRef.current = false;
        isReadyRef.current = false;
        setReady(false);
        onContextLost?.();
        publishRuntimeState();
      }
      releaseContext(true);

      if (typeof console !== "undefined") {
        console.error("[GlobalWebGLStage] initializeContext failed:", error);
      }
    } finally {
      initializationInProgress.current = false;
    }
  }, [
    onReady,
    onContextRestored,
    onContextLost,
    releaseContext,
    resizeRenderer,
    publishRuntimeState,
  ]);

  const handleContextLost = useCallback((event: Event): void => {
    event.preventDefault?.();

    if (!isMountedRef.current || !isReadyRef.current) {
      return;
    }

    releaseContext(false);
    fallbackReasonRef.current = "WebGL context lost.";
    setFallbackReason("WebGL context lost.");
    readyRef.current = false;
    isReadyRef.current = false;
    onContextLost?.();
    publishRuntimeState();
  }, [onContextLost, publishRuntimeState, releaseContext]);

  const handleContextRestored = useCallback(() => {
    initializeContext();
  }, [initializeContext]);

  const onRender = useCallback(
    (payload: MotionFramePayload): void => {
      const renderer = rendererRef.current;
      if (!renderer) {
        return;
      }

      resizeRenderer(renderer);
      renderer.info.reset();
      renderer.clear(true, true, true);
      externalRenderer?.(payload);
    },
    [externalRenderer, resizeRenderer],
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    publishRuntimeState();
  }, [publishRuntimeState]);

  useEffect(() => {
    const result = WebGLCapability.probe();
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) {
        return;
      }
      capabilityRef.current = result;
      setCapability(result);
      fallbackReasonRef.current = result.reason;
      setFallbackReason(result.reason);
      readyRef.current = false;
      isReadyRef.current = false;
      publishRuntimeState();
    });

    return () => {
      cancelled = true;
    };
  }, [publishRuntimeState]);

  useEffect(() => {
    if (!capability?.supported) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    initializeContext();

    return () => {
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      releaseContext(true);
      frameUnsubscribe.current?.();
      frameUnsubscribe.current = null;
    };
  }, [
    capability?.supported,
    handleContextLost,
    handleContextRestored,
    initializeContext,
    releaseContext,
  ]);

  useEffect(() => {
    if (!ready || !glRef.current) {
      frameUnsubscribe.current?.();
      frameUnsubscribe.current = null;
      return;
    }

    scheduler.start();
    frameUnsubscribe.current = scheduler.register(onRender, { priority: 0 });
    return () => {
      frameUnsubscribe.current?.();
      frameUnsubscribe.current = null;
    };
  }, [ready, scheduler, onRender]);

  useEffect(() => {
    if (renderScheduler) {
      return;
    }

    return () => {
      internalScheduler.dispose();
    };
  }, [internalScheduler, renderScheduler]);

  useEffect(() => {
    if (!ready) {
      return;
    }

    const handleResize = (): void => {
      const renderer = rendererRef.current;
      if (!renderer) {
        return;
      }
      resizeRenderer(renderer);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [ready, resizeRenderer]);

  useEffect(() => {
    if (typeof document === "undefined" || !ready) {
      return;
    }

    const handleVisibilityChange = (): void => {
      if (document.visibilityState === "hidden") {
        scheduler.setLowUpdateMode(true, 8);
        scheduler.pause();
      } else {
        scheduler.resume();
        scheduler.setLowUpdateMode(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [ready, scheduler]);

  const isContextRestorePending =
    capability?.supported === true &&
    !ready &&
    fallbackReason === "WebGL context lost.";

  if (capability && !ready && fallbackReason && !isContextRestorePending) {
    return <WebGLFallback reason={fallbackReason} />;
  }

  return (
    <>
      <div className="webgl-root" aria-hidden="true">
        <canvas ref={canvasRef} {...CANVAS_ATTRIBUTES} />
      </div>
      {capability && !ready && fallbackReason ? (
        <WebGLFallback reason={fallbackReason} />
      ) : null}
    </>
  );
}
