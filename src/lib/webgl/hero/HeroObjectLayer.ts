import type { MotionSnapshotState } from "@/lib/motion/MotionSnapshotStore";
import type { DOMTrackerWorldSnapshot } from "@/lib/webgl/DOMTracker";

export type HeroParallaxVector = {
  readonly translateX: number;
  readonly translateY: number;
  readonly rotateX: number;
  readonly rotateY: number;
  readonly opacity: number;
};

export type HeroObjectLayerConfig = {
  readonly maxTranslateX: number;
  readonly maxTranslateY: number;
  readonly maxRotateX: number;
  readonly maxRotateY: number;
  readonly damp: number;
};

type HeroObjectLayerState = {
  current: HeroParallaxVector;
  target: HeroParallaxVector;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function smoothStep(current: number, target: number, blend: number): number {
  return current + (target - current) * blend;
}

export default class HeroObjectLayer {
  private state: HeroObjectLayerState;
  private readonly reducedMotionTarget: HeroParallaxVector = {
    translateX: 0,
    translateY: 0,
    rotateX: 0,
    rotateY: 0,
    opacity: 1,
  };

  constructor(config: HeroObjectLayerConfig) {
    this.state = {
      current: {
        translateX: 0,
        translateY: 0,
        rotateX: 0,
        rotateY: 0,
        opacity: 1,
      },
      target: {
        translateX: 0,
        translateY: 0,
        rotateX: 0,
        rotateY: 0,
        opacity: 1,
      },
    };

    this.config = config;
  }

  private readonly config: HeroObjectLayerConfig;

  get snapshot(): Readonly<HeroObjectLayerState> {
    return {
      current: { ...this.state.current },
      target: { ...this.state.target },
    };
  }

  updateFromSnapshot(
    snapshot: MotionSnapshotState,
    anchor: DOMTrackerWorldSnapshot | null,
  ): Readonly<HeroParallaxVector> {
    const { maxRotateX, maxRotateY, maxTranslateX, maxTranslateY, damp } =
      this.config;

    if (snapshot.reducedMotion) {
      this.state.target = this.reducedMotionTarget;
      this.state.current = this.blendBackToIdle();
      return this.state.current;
    }

    const pointer = snapshot.pointer;
    const viewport = snapshot.viewport;
    const width = Math.max(1, viewport.width);
    const height = Math.max(1, viewport.height);

    const pointerNormX = ((pointer.x / width) - 0.5) * 2;
    const pointerNormY = ((pointer.y / height) - 0.5) * 2;
    const pointerRotateX = clamp(-pointerNormY * maxRotateX, -maxRotateX, maxRotateX);
    const pointerRotateY = clamp(pointerNormX * maxRotateY, -maxRotateY, maxRotateY);
    const pointerTranslateX = clamp(pointerNormX * maxTranslateX, -maxTranslateX, maxTranslateX);
    const pointerTranslateY = clamp(pointerNormY * maxTranslateY, -maxTranslateY, maxTranslateY);

    const scrollValue = anchor?.relativeScroll ?? 0;
    const scrollProgress = clamp((scrollValue * 0.001), -1, 1);
    const scrollFade = Math.max(0, 1 - Math.abs(scrollProgress));
    const opacity = clamp(scrollFade, 0.65, 1);

    const scrollBoostX = clamp(scrollProgress * 2.4, -6, 6);
    const scrollBoostY = clamp(-scrollProgress * 1.8, -4, 4);

    this.state.target = {
      rotateX: pointerRotateX,
      rotateY: pointerRotateY,
      translateX: pointerTranslateX + scrollBoostX,
      translateY: pointerTranslateY + scrollBoostY,
      opacity,
    };

    this.state.current = this.smoothlyApproachTarget(damp, snapshot.frame);
    return { ...this.state.current };
  }

  private smoothlyApproachTarget(
    damp: number,
    frame: {
      readonly delta: number;
    },
  ): HeroParallaxVector {
    const delta = Math.max(0, Math.min(1, frame.delta * damp));
    return {
      translateX: smoothStep(
        this.state.current.translateX,
        this.state.target.translateX,
        delta,
      ),
      translateY: smoothStep(
        this.state.current.translateY,
        this.state.target.translateY,
        delta,
      ),
      rotateX: smoothStep(
        this.state.current.rotateX,
        this.state.target.rotateX,
        delta,
      ),
      rotateY: smoothStep(
        this.state.current.rotateY,
        this.state.target.rotateY,
        delta,
      ),
      opacity: smoothStep(
        this.state.current.opacity,
        this.state.target.opacity,
        Math.max(0.02, delta),
      ),
    };
  }

  private blendBackToIdle(): HeroParallaxVector {
    const returnRate = 0.18;
    return this.state.current = {
      translateX: smoothStep(this.state.current.translateX, 0, returnRate),
      translateY: smoothStep(this.state.current.translateY, 0, returnRate),
      rotateX: smoothStep(this.state.current.rotateX, 0, returnRate),
      rotateY: smoothStep(this.state.current.rotateY, 0, returnRate),
      opacity: smoothStep(this.state.current.opacity, 1, returnRate),
    };
  }
}
