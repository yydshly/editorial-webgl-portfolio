"use client";

import { useEffect } from "react";

import type { MotionAnimationMode, MotionParallaxConfig } from "@/lib/animation";
import { useRuntimeOptional } from "@/lib/motion/RuntimeProvider";

const REVEAL_MODE: MotionAnimationMode = "reveal";
const PARALLAX_MODE: MotionAnimationMode = "parallax";

type MotionDirection = MotionParallaxConfig["axis"];

function parseModes(input: string | undefined): Set<MotionAnimationMode> {
  const modes = new Set<MotionAnimationMode>();
  if (!input) {
    return modes;
  }

  for (const token of input.split(",").map((item) => item.trim().toLowerCase())) {
    if (token === REVEAL_MODE || token === PARALLAX_MODE) {
      modes.add(token);
    }
  }
  return modes;
}

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseNullableNumber(
  value: string | undefined,
): number | null | undefined {
  if (value === null) {
    return undefined;
  }
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export default function SectionMotionController(): null {
  const runtime = useRuntimeOptional();

  useEffect(() => {
    if (!runtime) {
      return;
    }
    const { animation } = runtime;

    const root = document.getElementById("site-content");
    if (!root) {
      return;
    }

    const unregisters: Array<() => void> = [];
    const sections = Array.from(
      root.querySelectorAll<HTMLElement>("[data-motion]"),
    );

    for (const section of sections) {
      const modes = parseModes(section.dataset.motion);
      const dataset = section.dataset;

      if (modes.has(REVEAL_MODE)) {
        const rawOnce = dataset.motionRevealOnce?.toLowerCase();
        const once = rawOnce !== "0" && rawOnce !== "false";
        const unregister = animation.registerReveal(section, {
          enabled: true,
          distance: dataset.motionRevealDistance ?? "24px",
          threshold: parseNumber(dataset.motionRevealThreshold),
          rootMargin: dataset.motionRevealRootMargin,
          once,
        });
        unregisters.push(unregister);
      }

      if (modes.has(PARALLAX_MODE)) {
        const unregister = animation.registerParallax(section, {
          enabled: true,
          speed: parseNumber(dataset.motionParallaxSpeed) ?? 0.1,
          axis: (dataset.motionParallaxAxis as MotionDirection | undefined) ?? "y",
          clampMin: parseNullableNumber(dataset.motionParallaxClampMin),
          clampMax: parseNullableNumber(dataset.motionParallaxClampMax),
        });
        unregisters.push(unregister);
      }
    }

    return () => {
      unregisters.forEach((unregister) => unregister());
    };
  }, [runtime]);

  return null;
}
