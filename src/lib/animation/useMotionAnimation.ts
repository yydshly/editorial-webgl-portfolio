import { useEffect } from "react";

import type {
  MotionParallaxConfig,
  MotionRevealConfig,
} from "@/lib/animation/types";
import { useRuntime } from "@/lib/motion/RuntimeProvider";

export type MotionRevealHookConfig = {
  readonly threshold?: number;
  readonly distance?: MotionRevealConfig["distance"];
  readonly rootMargin?: string;
  readonly once?: boolean;
};

export type MotionParallaxHookConfig = {
  readonly speed?: number;
  readonly axis?: MotionParallaxConfig["axis"];
  readonly clampMin?: number | null;
  readonly clampMax?: number | null;
  readonly enabled?: boolean;
};

export function useMotionReveal(
  target: HTMLElement | null,
  config?: MotionRevealHookConfig,
): void {
  const { animation } = useRuntime();

  useEffect(() => {
    if (!target) {
      return;
    }

    const unregister = animation.registerReveal(target, {
      enabled: true,
      threshold: config?.threshold,
      distance: config?.distance,
      rootMargin: config?.rootMargin,
      once: config?.once,
    });

    return unregister;
  }, [animation, config?.threshold, config?.distance, config?.rootMargin, config?.once, target]);
}

export function useMotionParallax(
  target: HTMLElement | null,
  config?: MotionParallaxHookConfig,
): void {
  const { animation } = useRuntime();

  useEffect(() => {
    if (!target) {
      return;
    }

    const unregister = animation.registerParallax(target, {
      enabled: config?.enabled ?? true,
      speed: config?.speed,
      axis: config?.axis ?? "y",
      clampMin: config?.clampMin ?? null,
      clampMax: config?.clampMax ?? null,
    });

    return unregister;
  }, [
    animation,
    target,
    config?.speed,
    config?.axis,
    config?.clampMin,
    config?.clampMax,
    config?.enabled,
  ]);
}
