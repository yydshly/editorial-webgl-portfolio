import FrameCoordinator from "@/lib/motion/FrameCoordinator";
import MotionBus from "@/lib/motion/MotionBus";
import type { MotionScrollPayload, MotionViewportPayload } from "@/lib/motion/types";
import type {
  MotionMotionDistance,
  MotionParallaxConfig,
  MotionRevealConfig,
  MotionRuntimeOptions,
  MotionRuntimeUnregister,
} from "@/lib/animation/types";

type RegisteredRevealTarget = {
  readonly id: number;
  readonly element: HTMLElement;
  readonly config: MotionRevealConfig;
  revealed: boolean;
  readonly className: string;
  observerKey: string;
  observedByIntersection: boolean;
};

type RegisteredParallaxTarget = {
  readonly id: number;
  readonly element: HTMLElement;
  readonly config: MotionParallaxConfig;
  anchorTop: number;
};

type ObserverMapValue = {
  observer: IntersectionObserver;
  targets: Set<number>;
};

type MotionOffset = {
  readonly x: number;
  readonly y: number;
};

const DEFAULT_REVEAL_DISTANCE: MotionMotionDistance = "24px";
const DEFAULT_REVEAL_THRESHOLD = 0.15;
const DEFAULT_REVEAL_ROOT_MARGIN = "0px 0px -8% 0px";
const REVEAL_CLASS = "motion-reveal";
const PARALLAX_CLASS = "motion-parallax";
const REVEAL_STATE_ATTRIBUTE = "data-motion-state";
const REVEAL_STATE_VISIBLE = "visible";
const REVEAL_STATE_HIDDEN = "hidden";

function parseMotionDistance(distance: MotionMotionDistance): string {
  return typeof distance === "number" ? `${distance}px` : distance;
}

function isNumber(value: number): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export default class MotionAnimationRuntime {
  private active = false;
  private reducedMotion = false;

  private readonly revealTargets = new Map<number, RegisteredRevealTarget>();
  private readonly parallaxTargets = new Map<number, RegisteredParallaxTarget>();
  private readonly revealByElement = new WeakMap<Element, number>();
  private readonly observeGroups = new Map<string, ObserverMapValue>();
  private readonly nextId = { value: 0 };
  private readonly activeTargets = new Set<number>();

  private readonly desiredRevealState = new Map<number, boolean>();
  private readonly desiredParallaxOffset = new Map<number, MotionOffset>();
  private readonly appliedRevealState = new Map<number, boolean>();
  private readonly appliedParallaxOffset = new Map<number, MotionOffset>();

  private latestScroll: MotionScrollPayload = {
    scrollX: 0,
    scrollY: 0,
    velocity: 0,
    direction: 0,
    source: "native",
    timestamp: 0,
  };
  private latestViewport: MotionViewportPayload = {
    width: 0,
    height: 0,
    scrollX: 0,
    scrollY: 0,
    devicePixelRatio: 1,
    isPortrait: false,
  };

  private scrollUnsubscribe: (() => void) | null = null;
  private viewportUnsubscribe: (() => void) | null = null;
  private measureUnsubscribe: (() => void) | null = null;
  private animateUnsubscribe: (() => void) | null = null;

  constructor(
    private readonly bus: MotionBus,
    private readonly frame: FrameCoordinator,
    options: MotionRuntimeOptions = {},
  ) {
    this.reducedMotion = options.reducedMotion ?? this.detectReducedMotion();
  }

  get isRunning(): boolean {
    return this.active;
  }

  connect(): void {
    if (this.active || typeof window === "undefined") {
      return;
    }

    this.active = true;
    this.latestScroll = {
      scrollX: window.scrollX || 0,
      scrollY: window.scrollY || 0,
      velocity: 0,
      direction: 0,
      source: "native",
      timestamp: performance.now(),
    };
    this.latestViewport = {
      width: window.innerWidth,
      height: window.innerHeight,
      scrollX: window.scrollX || 0,
      scrollY: window.scrollY || 0,
      devicePixelRatio: window.devicePixelRatio || 1,
      isPortrait: window.innerWidth < window.innerHeight,
    };

    this.scrollUnsubscribe = this.bus.subscribe("scroll", this.onScroll);
    this.viewportUnsubscribe = this.bus.subscribe("viewport", this.onViewport);
    this.measureUnsubscribe = this.frame.register("MEASURE", this.onMeasure);
    this.animateUnsubscribe = this.frame.register("ANIMATE", this.onAnimate);

    this.applyBaseline();
  }

  disconnect(): void {
    if (!this.active) {
      return;
    }
    this.active = false;

    this.scrollUnsubscribe?.();
    this.viewportUnsubscribe?.();
    this.measureUnsubscribe?.();
    this.animateUnsubscribe?.();
    this.scrollUnsubscribe = null;
    this.viewportUnsubscribe = null;
    this.measureUnsubscribe = null;
    this.animateUnsubscribe = null;

    this.activeTargets.clear();
    this.desiredRevealState.clear();
    this.desiredParallaxOffset.clear();
    this.appliedRevealState.clear();
    this.appliedParallaxOffset.clear();
  }

  dispose(): void {
    this.disconnect();
    this.unregisterAll();
  }

  registerReveal(
    target: Element,
    config?: Partial<MotionRevealConfig>,
  ): MotionRuntimeUnregister {
    const element = target instanceof HTMLElement ? target : null;
    if (!element || !this.active) {
      return () => {};
    }

    const merged: MotionRevealConfig = {
      enabled: config?.enabled ?? true,
      threshold:
        typeof config?.threshold === "number" && isNumber(config.threshold) && Number.isFinite(config.threshold)
          ? config.threshold
          : DEFAULT_REVEAL_THRESHOLD,
      rootMargin: config?.rootMargin ?? DEFAULT_REVEAL_ROOT_MARGIN,
      once: config?.once ?? true,
      distance: config?.distance ?? DEFAULT_REVEAL_DISTANCE,
    };

    if (!merged.enabled) {
      return () => {};
    }

    const existing = this.revealByElement.get(target);
    if (existing !== undefined) {
      this.unregisterRevealById(existing);
    }

    const id = ++this.nextId.value;
    const className = REVEAL_CLASS;
    element.classList.add(className);
    element.style.setProperty("--motion-reveal-distance", parseMotionDistance(merged.distance));
    element.dataset.motionState = REVEAL_STATE_HIDDEN;

    const registration: RegisteredRevealTarget = {
      id,
      element,
      config: {
        enabled: merged.enabled,
        threshold: merged.threshold,
        rootMargin: merged.rootMargin,
        once: merged.once,
        distance: merged.distance,
      },
      revealed: false,
      className,
      observerKey: this.getRevealObserverKey(merged),
      observedByIntersection: false,
    };

    this.revealTargets.set(id, registration);
    this.revealByElement.set(target, id);

    if (this.reducedMotion) {
      this.showReveal(registration);
      return () => this.unregisterRevealById(id);
    }

    if (typeof IntersectionObserver !== "undefined") {
      const { observer, targets } = this.getRevealObserver(merged);
      targets.add(id);
      registration.observedByIntersection = true;
      observer.observe(target);
    } else {
      this.activeTargets.add(id);
      this.measureRevealVisibility(registration);
    }

    return () => this.unregisterRevealById(id);
  }

  registerParallax(
    target: Element,
    config?: Partial<MotionParallaxConfig>,
  ): MotionRuntimeUnregister {
    const element = target instanceof HTMLElement ? target : null;
    if (!element || !this.active) {
      return () => {};
    }

    const merged = {
      enabled: config?.enabled ?? true,
      speed:
        config?.speed === undefined || Number.isNaN(config.speed) ? 0.08 : config.speed,
      axis: config?.axis ?? "y",
      clampMin: config?.clampMin ?? null,
      clampMax: config?.clampMax ?? null,
    };

    if (!merged.enabled) {
      return () => {};
    }

    const id = ++this.nextId.value;
    element.classList.add(PARALLAX_CLASS);
    const registration: RegisteredParallaxTarget = {
      id,
      element,
      config: merged,
      anchorTop: this.getElementAbsoluteTop(element),
    };
    this.parallaxTargets.set(id, registration);
    this.activeTargets.add(id);
    this.measureParallax(registration);

    if (this.reducedMotion) {
      this.applyParallax(registration, 0, 0);
    }

    return () => this.unregisterParallaxById(id);
  }

  private onScroll = (payload: MotionScrollPayload): void => {
    if (!this.active) {
      return;
    }
    this.latestScroll = payload;
  };

  private onViewport = (payload: MotionViewportPayload): void => {
    if (!this.active) {
      return;
    }
    this.latestViewport = payload;
    this.refreshParallaxAnchors();
  };

  private onMeasure = (): void => {
    if (!this.active || this.reducedMotion) {
      return;
    }

    for (const id of this.activeTargets) {
      const reveal = this.revealTargets.get(id);
      if (reveal && !reveal.observedByIntersection) {
        this.measureRevealVisibility(reveal);
      }

      const parallax = this.parallaxTargets.get(id);
      if (parallax) {
        this.measureParallax(parallax);
      }
    }
  };

  private onAnimate = (): void => {
    if (!this.active || this.reducedMotion) {
      return;
    }

    for (const id of this.activeTargets) {
      const reveal = this.revealTargets.get(id);
      if (reveal) {
        const next = this.desiredRevealState.get(id);
        if (next !== undefined && this.appliedRevealState.get(id) !== next) {
          this.applyReveal(reveal, next);
          this.appliedRevealState.set(id, next);
        }
      }

      const parallax = this.parallaxTargets.get(id);
      if (!parallax) {
        continue;
      }

      const nextOffset = this.desiredParallaxOffset.get(id);
      if (!nextOffset) {
        continue;
      }

      const previous = this.appliedParallaxOffset.get(id);
      if (previous?.x === nextOffset.x && previous?.y === nextOffset.y) {
        continue;
      }

      this.applyParallax(parallax, nextOffset.x, nextOffset.y);
      this.appliedParallaxOffset.set(id, nextOffset);
    }
  };

  private measureRevealVisibility(registration: RegisteredRevealTarget): void {
    if (typeof IntersectionObserver !== "undefined") {
      return;
    }

    if (!this.latestViewport.height || !this.latestViewport.width) {
      return;
    }

    const rect = registration.element.getBoundingClientRect();
    const threshold = registration.config.threshold;
    const visible =
      rect.bottom >= -this.latestViewport.height * threshold &&
      rect.top <= this.latestViewport.height * (1 + threshold);
    this.desiredRevealState.set(registration.id, visible);
  }

  private measureRevealIntersection = (
    entries: IntersectionObserverEntry[],
  ): void => {
    for (const entry of entries) {
      const id = this.revealByElement.get(entry.target);
      if (id === undefined) {
        continue;
      }

      const registration = this.revealTargets.get(id);
      if (!registration) {
        continue;
      }

      this.desiredRevealState.set(id, entry.isIntersecting || false);
      this.activeTargets.add(id);
    }
  };

  private measureParallax(registration: RegisteredParallaxTarget): void {
    const delta = this.latestScroll.scrollY - registration.anchorTop;
    const speed = registration.config.speed;
    const axisX = registration.config.axis === "x";
    const raw = axisX ? delta * speed : 0;
    const rawY = axisX ? 0 : -delta * speed;
    const clampedX = this.clampValue(raw, registration.config.clampMin, registration.config.clampMax);
    const clampedY = this.clampValue(rawY, registration.config.clampMin, registration.config.clampMax);
    this.desiredParallaxOffset.set(registration.id, { x: clampedX, y: clampedY });
  }

  private refreshParallaxAnchors(): void {
    if (this.reducedMotion) {
      return;
    }

    for (const registration of this.parallaxTargets.values()) {
      registration.anchorTop = this.getElementAbsoluteTop(registration.element);
      this.measureParallax(registration);
    }
  }

  private applyBaseline(): void {
    if (this.reducedMotion) {
      this.showAllTargetsImmediately();
      return;
    }

    for (const registration of this.revealTargets.values()) {
      if (registration.observedByIntersection) {
        this.desiredRevealState.set(registration.id, false);
      } else {
        this.measureRevealVisibility(registration);
      }

      this.activeTargets.add(registration.id);
    }

    for (const registration of this.parallaxTargets.values()) {
      this.activeTargets.add(registration.id);
      this.measureParallax(registration);
    }

    this.onAnimate();
  };

  private showAllTargetsImmediately(): void {
    for (const registration of this.revealTargets.values()) {
      this.showReveal(registration);
      this.appliedRevealState.set(registration.id, true);
    }
    for (const registration of this.parallaxTargets.values()) {
      this.applyParallax(registration, 0, 0);
      this.appliedParallaxOffset.set(registration.id, { x: 0, y: 0 });
    }
  }

  private applyReveal(registration: RegisteredRevealTarget, visible: boolean): void {
    if (visible) {
      this.showReveal(registration);
      return;
    }

    this.hideReveal(registration);
  }

  private showReveal(registration: RegisteredRevealTarget): void {
    registration.revealed = true;
    registration.element.dataset.motionState = REVEAL_STATE_VISIBLE;
  }

  private hideReveal(registration: RegisteredRevealTarget): void {
    if (registration.config.once) {
      return;
    }

    registration.revealed = false;
    registration.element.dataset.motionState = REVEAL_STATE_HIDDEN;
  }

  private applyParallax(registration: RegisteredParallaxTarget, x: number, y: number): void {
    if (registration.config.axis === "x") {
      registration.element.style.setProperty("--motion-parallax-x", `${x}px`);
      registration.element.style.setProperty("--motion-parallax-y", "0px");
      return;
    }

    registration.element.style.setProperty("--motion-parallax-y", `${y}px`);
    registration.element.style.removeProperty("--motion-parallax-x");
  }

  private clampValue(value: number, min: number | null, max: number | null): number {
    if (min !== null) {
      value = Math.max(min, value);
    }

    if (max !== null) {
      value = Math.min(max, value);
    }

    return value;
  }

  private getElementAbsoluteTop(element: HTMLElement): number {
    const rect = element.getBoundingClientRect();
    return this.latestScroll.scrollY + rect.top;
  }

  private getRevealObserver(config: MotionRevealConfig): ObserverMapValue {
    const key = this.getRevealObserverKey(config);
    const existing = this.observeGroups.get(key);
    if (existing) {
      return existing;
    }

    const observer = new IntersectionObserver((entries) => {
      this.measureRevealIntersection(entries);
    }, { threshold: config.threshold, rootMargin: config.rootMargin });

    const bucket: ObserverMapValue = {
      observer,
      targets: new Set<number>(),
    };

    this.observeGroups.set(key, bucket);
    return bucket;
  }

  private getRevealObserverKey(config: MotionRevealConfig): string {
    return `t:${config.threshold}:m:${config.rootMargin}`;
  }

  private unregisterRevealById(id: number): void {
    const registration = this.revealTargets.get(id);
    if (!registration) {
      return;
    }

    const observerEntry = this.observeGroups.get(registration.observerKey);
    observerEntry?.observer.unobserve(registration.element);
    observerEntry?.targets.delete(id);

    if (observerEntry && observerEntry.targets.size === 0) {
      observerEntry.observer.disconnect();
      this.observeGroups.delete(registration.observerKey);
    }

    registration.element.classList.remove(registration.className);
    registration.element.removeAttribute(REVEAL_STATE_ATTRIBUTE);
    registration.element.style.removeProperty("--motion-reveal-distance");
    this.revealTargets.delete(id);
    this.revealByElement.delete(registration.element);
    this.activeTargets.delete(id);
    this.desiredRevealState.delete(id);
    this.appliedRevealState.delete(id);
  }

  private unregisterParallaxById(id: number): void {
    const registration = this.parallaxTargets.get(id);
    if (!registration) {
      return;
    }

    registration.element.classList.remove(PARALLAX_CLASS);
    registration.element.style.removeProperty("--motion-parallax-y");
    registration.element.style.removeProperty("--motion-parallax-x");
    this.parallaxTargets.delete(id);
    this.activeTargets.delete(id);
    this.desiredParallaxOffset.delete(id);
    this.appliedParallaxOffset.delete(id);
  }

  private unregisterAll(): void {
    for (const id of Array.from(this.revealTargets.keys())) {
      this.unregisterRevealById(id);
    }
    for (const id of Array.from(this.parallaxTargets.keys())) {
      this.unregisterParallaxById(id);
    }
    for (const { observer } of this.observeGroups.values()) {
      observer.disconnect();
    }
    this.observeGroups.clear();
  }

  private detectReducedMotion(): boolean {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }

    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
}
