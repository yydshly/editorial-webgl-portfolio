"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import FrameCoordinator from "./FrameCoordinator";
import MotionBus from "./MotionBus";
import MotionSnapshotStore from "./MotionSnapshotStore";
import PointerTracker from "./PointerTracker";
import ViewportService from "./ViewportService";
import type { MotionEventName, MotionListener } from "./types";
import { MotionAnimationRuntime } from "@/lib/animation";

export type RuntimeContextValue = {
  readonly bus: MotionBus;
  readonly frame: FrameCoordinator;
  readonly viewport: ViewportService;
  readonly pointer: PointerTracker;
  readonly snapshot: MotionSnapshotStore;
  readonly animation: MotionAnimationRuntime;
};

const RuntimeContext = createContext<RuntimeContextValue | null>(null);

export default function RuntimeProvider({
  children,
}: Readonly<{
  readonly children: React.ReactNode;
}>) {
  const [runtime] = useState<RuntimeContextValue>(() => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    return {
      bus,
      frame,
      snapshot: new MotionSnapshotStore(),
      viewport: new ViewportService(bus),
      pointer: new PointerTracker(bus),
      animation: new MotionAnimationRuntime(bus, frame),
    };
  });

  useEffect(() => {
    const active = runtime;
    const reducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    active.snapshot.setReducedMotion(!!reducedMotion);

    const frameUnsubscribe = active.bus.subscribe("tick", (payload) => {
      active.snapshot.updateFrame(payload);
    });
    const scrollUnsubscribe = active.bus.subscribe("scroll", (payload) => {
      active.snapshot.updateScroll(payload);
    });
    const viewportUnsubscribe = active.bus.subscribe("viewport", (payload) => {
      active.snapshot.updateViewport(payload);
    });
    const pointerUnsubscribe = active.bus.subscribe("pointer:move", (payload) => {
      active.snapshot.updatePointer(payload);
    });

    active.frame.start();
    active.viewport.connect();
    active.pointer.connect();
    active.animation.connect();

    return () => {
      frameUnsubscribe();
      scrollUnsubscribe();
      viewportUnsubscribe();
      pointerUnsubscribe();
      active.pointer.disconnect();
      active.viewport.disconnect();
      active.frame.dispose();
      active.animation.dispose();
      active.bus.clear();
    };
  }, [runtime]);

  return <RuntimeContext.Provider value={runtime}>{children}</RuntimeContext.Provider>;
}

export function useRuntime(): RuntimeContextValue {
  const runtime = useContext(RuntimeContext);
  if (runtime === null) {
    throw new Error("useRuntime must be used within RuntimeProvider");
  }
  return runtime;
}

export function useRuntimeOptional(): RuntimeContextValue | null {
  return useContext(RuntimeContext);
}

export function useRuntimeSubscribe<T extends MotionEventName>(
  event: T,
  listener: MotionListener<T>,
): void {
  const runtime = useRuntime();
  useEffect(() => {
    return runtime.bus.subscribe(event, listener);
  }, [runtime, event, listener]);
}
