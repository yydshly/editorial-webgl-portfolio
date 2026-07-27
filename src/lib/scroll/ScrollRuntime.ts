import type Lenis from "lenis";
import type { LenisOptions, ScrollCallback } from "lenis";
import FrameCoordinator from "@/lib/motion/FrameCoordinator";
import MotionBus from "@/lib/motion/MotionBus";
import type {
  MotionFramePayload,
  MotionScrollPayload,
  Unsubscribe,
} from "@/lib/motion/types";
import ScrollLockService from "@/lib/scroll/ScrollLockService";

type LenisConstructor = new (options: LenisOptions) => Lenis;
type LenisLike = Lenis & {
  on: (event: "scroll", callback: ScrollCallback) => () => void;
};

export default class ScrollRuntime {
  private active = false;
  private lenis: LenisLike | null = null;
  private usingLenis = false;
  private lockUnsubscribe: Unsubscribe | null = null;
  private inputUnsubscribe: Unsubscribe | null = null;
  private scrollUnsubscribe: (() => void) | null = null;
  private onScrollNative?: () => void;
  private fallbackEnabled = false;
  private previousScrollY = 0;
  private previousTimestamp = 0;
  private lastFrameTimestamp = 0;

  constructor(
    private readonly bus: MotionBus,
    private readonly lockService: ScrollLockService,
    private readonly frame: FrameCoordinator,
  ) {}

  async connect(): Promise<void> {
    if (this.active) {
      return;
    }

    this.active = true;

    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    this.previousScrollY = window.scrollY || 0;
    this.previousTimestamp = performance.now();

    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!prefersReducedMotion) {
      const LenisClass = await this.resolveLenisConstructor();

      if (LenisClass) {
        try {
          this.lenis = new LenisClass({
            wrapper: window,
            autoRaf: false,
            smoothWheel: true,
            duration: 1.12,
          });
          this.previousScrollY = this.lenis.scroll;
          this.usingLenis = true;
          this.fallbackEnabled = false;
          this.linkLenisScroll();
          this.linkLenisInput();
        } catch {
          this.lenis = null;
          this.usingLenis = false;
          this.fallbackEnabled = true;
          this.linkNativeScroll();
        }
      } else {
        this.fallbackEnabled = true;
        this.linkNativeScroll();
      }
    } else {
      this.fallbackEnabled = true;
      this.linkNativeScroll();
    }

    this.lockUnsubscribe = this.lockService.subscribe((locked) => {
      if (!this.lenis) {
        return;
      }
      if (locked) {
        this.lenis.stop();
      } else {
        this.lenis.start();
      }
    });
  }

  private async resolveLenisConstructor(): Promise<LenisConstructor | null> {
    try {
      const lenisModule = await import("lenis");
      const ctor = lenisModule?.default ?? lenisModule;
      if (typeof ctor === "function") {
        return ctor as LenisConstructor;
      }
    } catch {
      return null;
    }
    return null;
  }

  private linkLenisInput(): void {
    if (!this.lenis) {
      return;
    }

    this.inputUnsubscribe = this.frame.register("INPUT", (payload: MotionFramePayload) => {
      this.lastFrameTimestamp = payload.timestamp;
      this.lenis?.raf(payload.timestamp);
    });
  }

  private linkLenisScroll(): void {
    if (!this.lenis) {
      return;
    }

    const onLenisScroll = (instance: LenisLike) => {
      const isHorizontal = instance.isHorizontal;
      const scroll = instance.scroll;
      const scrollX = isHorizontal ? scroll : 0;
      const scrollY = isHorizontal ? 0 : scroll;

      this.bus.emit("scroll", {
        scrollX,
        scrollY,
        velocity: Math.abs(instance.velocity),
        direction: instance.direction,
        source: "lenis",
        timestamp: this.lastFrameTimestamp || performance.now(),
      } satisfies MotionScrollPayload);
      this.previousTimestamp = performance.now();
    };

    this.scrollUnsubscribe = this.lenis.on("scroll", onLenisScroll);
  }

  private linkNativeScroll(): void {
    const onScroll = () => {
      if (!this.active) {
        return;
      }
      if (this.lockService.isLocked) {
        return;
      }

      const scrollX = window.scrollX || 0;
      const scrollY = window.scrollY || 0;
      const timestamp = performance.now();
      const deltaTime = Math.max(1, timestamp - this.previousTimestamp);
      const dy = scrollY - this.previousScrollY;
      const velocity = Math.abs(dy) / deltaTime;
      const direction = this.normalizeDirection(dy);

      this.bus.emit("scroll", {
        scrollX,
        scrollY,
        velocity,
        direction,
        source: "native",
        timestamp,
      });

      this.previousScrollY = scrollY;
      this.previousTimestamp = timestamp;
    };

    this.onScrollNative = onScroll;
    window.addEventListener("scroll", onScroll);
    onScroll();
  }

  private normalizeDirection(delta: number): -1 | 0 | 1 {
    return delta > 0 ? 1 : delta < 0 ? -1 : 0;
  }

  disconnect(): void {
    if (!this.active) {
      return;
    }

    this.active = false;
    this.lockUnsubscribe?.();
    this.inputUnsubscribe?.();
    this.scrollUnsubscribe?.();
    this.lockUnsubscribe = null;
    this.inputUnsubscribe = null;
    this.scrollUnsubscribe = null;

    if (this.onScrollNative) {
      window.removeEventListener("scroll", this.onScrollNative);
      this.onScrollNative = undefined;
    }

    if (!this.lenis) {
      this.usingLenis = false;
      return;
    }

    this.lenis.destroy();
    this.lenis = null;
    this.usingLenis = false;
    this.fallbackEnabled = false;
    this.previousTimestamp = 0;
  }

  dispose(): void {
    this.disconnect();
  }

  get isReady(): boolean {
    return this.active;
  }

  get isUsingLenis(): boolean {
    return this.usingLenis && this.lenis !== null && !this.fallbackEnabled;
  }

  get isFallback(): boolean {
    return this.fallbackEnabled;
  }
}
