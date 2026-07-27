export type MediaMotionPhase = "enter" | "hold" | "depart";

export type MediaMotionEasing = "linear" | "easeOutCubic";

export type MediaLayerTransform = {
  readonly translateX: number;
  readonly translateY: number;
  readonly scale: number;
  readonly opacity: number;
};

type MediaLayerKeyframe = {
  readonly progress: number;
  readonly transform: MediaLayerTransform;
};

type MediaMotionInput = {
  readonly progress: number;
  readonly phase: MediaMotionPhase;
  readonly reducedMotion: boolean;
};

export const MEDIA_MOTION_CONFIG = {
  responsiveProjection: {
    mobile: {
      translateXMultiplier: 0.65,
      secondaryTranslateXMultiplier: -0.26,
      translateYMultiplier: 0.8,
    },
  },
  phase: {
    enterThreshold: 0.18,
    holdThreshold: 0.72,
    departThreshold: 1,
  },
  easing: {
    enter: "easeOutCubic" as const satisfies MediaMotionEasing,
    depart: "easeOutCubic" as const satisfies MediaMotionEasing,
  },
  main: {
    holdPose: {
      translateX: 130,
      translateY: 0,
      scale: 1,
      opacity: 1,
    } as const satisfies MediaLayerTransform,
    enterPose: {
      translateX: 160,
      translateY: 18,
      scale: 0.94,
      opacity: 0.08,
    } as const satisfies MediaLayerTransform,
    enterKeyframes: [
      {
        progress: 0,
        transform: {
          translateX: 160,
          translateY: 18,
          scale: 0.94,
          opacity: 0.08,
        },
      },
      {
        progress: 0.1,
        transform: {
          translateX: 138,
          translateY: 5,
          scale: 0.985,
          opacity: 0.82,
        },
      },
      {
        progress: 0.18,
        transform: {
          translateX: 130,
          translateY: 0,
          scale: 1,
          opacity: 1,
        },
      },
    ] as const,
    departPose: {
      translateX: 116,
      translateY: -12,
      scale: 0.88,
      opacity: 0.15,
    } as const satisfies MediaLayerTransform,
  },
  secondary: {
    holdPose: {
      translateX: 17,
      translateY: 34,
      scale: 1,
      opacity: 0.8,
    } as const satisfies MediaLayerTransform,
    enterPose: {
      translateX: 148,
      translateY: 56,
      scale: 0.8974359,
      opacity: 0,
    } as const satisfies MediaLayerTransform,
    enterKeyframes: [
      {
        progress: 0,
        transform: {
          translateX: 148,
          translateY: 56,
          scale: 0.8974359,
          opacity: 0,
        },
      },
      {
        progress: 0.1,
        transform: {
          translateX: 37,
          translateY: 40,
          scale: 0.974359,
          opacity: 0.5882353,
        },
      },
      {
        progress: 0.18,
        transform: {
          translateX: 17,
          translateY: 34,
          scale: 1,
          opacity: 0.8,
        },
      },
    ] as const,
    departPose: {
      translateX: 106,
      translateY: -18,
      scale: 0.9,
      opacity: 0.12,
    } as const satisfies MediaLayerTransform,
  },
  reducedMotionProgress: 0.5,
} as const;

type LayerMotionSource = {
  readonly holdPose: MediaLayerTransform;
  readonly enterPose: MediaLayerTransform;
  readonly departPose: MediaLayerTransform;
  readonly enterKeyframes?: readonly MediaLayerKeyframe[];
};

const EASING: Record<MediaMotionEasing, (value: number) => number> = {
  linear: (value) => value,
  easeOutCubic: (value) => 1 - Math.pow(1 - value, 3),
};

const BLEND_BASE_SCALE = {
  hold: 1,
};

export function resolveMediaLayerTransform(
  input: {
    readonly phase: MediaMotionPhase;
    readonly progress: number;
    readonly source: LayerMotionSource;
    readonly reducedMotion: boolean;
  },
): MediaLayerTransform {
  if (input.reducedMotion) {
    return input.source.holdPose;
  }

  const progress = clamp(input.progress, 0, 1);

  if (input.phase === "hold") {
    return input.source.holdPose;
  }

  if (input.phase === "enter") {
    const keyframes = input.source.enterKeyframes ?? [
      {
        progress: 0,
        transform: input.source.enterPose,
      },
      {
        progress: MEDIA_MOTION_CONFIG.phase.enterThreshold,
        transform: input.source.holdPose,
      },
    ];
    const normalized = keyframes
      .slice()
      .sort((left, right) => left.progress - right.progress);
    const first = normalized[0];
    const last = normalized.at(-1);

    if (!first || !last) {
      return input.source.enterPose;
    }

    if (progress <= first.progress) {
      return first.transform;
    }

    if (progress >= last.progress) {
      return last.transform;
    }

    for (let index = 0; index < normalized.length - 1; index += 1) {
      const from = normalized[index];
      const to = normalized[index + 1];
      if (!from || !to) {
        break;
      }

      if (progress <= to.progress) {
        const ratio = applyEasing(
          (progress - from.progress) / Math.max(0.0001, to.progress - from.progress),
          MEDIA_MOTION_CONFIG.easing.enter,
        );
        return {
          translateX: mix(from.transform.translateX, to.transform.translateX, ratio),
          translateY: mix(from.transform.translateY, to.transform.translateY, ratio),
          scale: mix(from.transform.scale, to.transform.scale, ratio),
          opacity: mix(from.transform.opacity, to.transform.opacity, ratio),
        };
      }
    }

    return last.transform;
  }

  const departRange = Math.max(0.001, 1 - MEDIA_MOTION_CONFIG.phase.holdThreshold);
  const ratio = applyEasing(
    clamp((progress - MEDIA_MOTION_CONFIG.phase.holdThreshold) / departRange, 0, 1),
    MEDIA_MOTION_CONFIG.easing.depart,
  );
  return {
    translateX: mix(input.source.holdPose.translateX, input.source.departPose.translateX, ratio),
    translateY: mix(input.source.holdPose.translateY, input.source.departPose.translateY, ratio),
    scale: mix(input.source.holdPose.scale, input.source.departPose.scale * BLEND_BASE_SCALE.hold, ratio),
    opacity: mix(input.source.holdPose.opacity, input.source.departPose.opacity, ratio),
  };
}

export function resolveMediaMotion(
  input: MediaMotionInput,
): {
  readonly main: MediaLayerTransform;
  readonly secondary: MediaLayerTransform;
} {
  const progress = input.reducedMotion ? MEDIA_MOTION_CONFIG.reducedMotionProgress : input.progress;
  const phase = input.reducedMotion ? "hold" : input.phase;

  return {
    main: resolveMediaLayerTransform({
      phase,
      progress,
      source: MEDIA_MOTION_CONFIG.main,
      reducedMotion: input.reducedMotion,
    }),
    secondary: resolveMediaLayerTransform({
      phase,
      progress,
      source: MEDIA_MOTION_CONFIG.secondary,
      reducedMotion: input.reducedMotion,
    }),
  };
}

function applyEasing(value: number, easing: MediaMotionEasing): number {
  return EASING[easing](value);
}

function mix(from: number, to: number, ratio: number): number {
  return from + (to - from) * ratio;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
