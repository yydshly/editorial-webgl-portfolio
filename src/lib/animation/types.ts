export type MotionAnimationMode = "reveal" | "parallax";

export type MotionMotionDistance = string | number;

export type MotionRevealConfig = {
  readonly enabled: boolean;
  readonly threshold: number;
  readonly rootMargin: string;
  readonly once: boolean;
  readonly distance: MotionMotionDistance;
};

export type MotionParallaxConfig = {
  readonly enabled: boolean;
  readonly speed: number;
  readonly axis: "x" | "y";
  readonly clampMin: number | null;
  readonly clampMax: number | null;
};

export type MotionRuntimeOptions = {
  readonly reducedMotion?: boolean;
};

export type MotionRuntimeUnregister = () => void;

export type MotionRuntimeObserverEntry = {
  readonly target: Element;
  readonly ratio: number;
  readonly isIntersecting: boolean;
};

export type MotionRuntimeViewportSnapshot = {
  readonly width: number;
  readonly height: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly devicePixelRatio: number;
  readonly isPortrait: boolean;
};

export type MotionRuntimeScrollSnapshot = {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly velocity: number;
  readonly direction: -1 | 0 | 1;
  readonly source: "lenis" | "native";
  readonly timestamp: number;
};

export type MotionAnimationSnapshot = {
  readonly viewport: MotionRuntimeViewportSnapshot;
  readonly scroll: MotionRuntimeScrollSnapshot;
};

export type MotionRevealPayload = {
  readonly target: Element;
  readonly visible: boolean;
  readonly progress: number;
};

export type MotionParallaxPayload = {
  readonly target: Element;
  readonly offsetX: number;
  readonly offsetY: number;
};

export type MotionAnimationEventPayload = {
  reveal?: MotionRevealPayload;
  parallax?: MotionParallaxPayload;
};

export type MotionAnimationObserver = (payload: MotionAnimationEventPayload) => void;
