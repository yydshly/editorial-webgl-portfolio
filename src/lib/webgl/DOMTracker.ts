import type { MotionViewportPayload } from "@/lib/motion/types";
import type { Unsubscribe } from "@/lib/motion/types";
import type FrameCoordinator from "@/lib/motion/FrameCoordinator";
import MotionBus from "@/lib/motion/MotionBus";
import { domToWorld } from "@/lib/webgl/domToWorld";
import type {
  CameraRigBreakpoint,
  CameraRigWorldPoint,
} from "@/lib/webgl/CameraRig";
import CameraRig from "@/lib/webgl/CameraRig";

export type SceneAnchorRegistration = {
  readonly id: string;
  readonly element: HTMLElement;
  readonly sceneType?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type CachedSceneAnchor = SceneAnchorRegistration & {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly width: number;
  readonly height: number;
  readonly scrollY: number;
  readonly updatedAt: number;
  readonly capturedAtBreakpoint: CameraRigBreakpoint;
};

export type DOMTrackerSnapshot = {
  readonly anchors: ReadonlyMap<string, CachedSceneAnchor>;
  readonly count: number;
};

export type DOMTrackedWorldPoint = {
  readonly point: CameraRigWorldPoint;
  readonly screen: {
    readonly x: number;
    readonly y: number;
  };
};

export type DOMTrackerWorldSnapshot = CachedSceneAnchor & {
  readonly viewport: {
    readonly width: number;
    readonly height: number;
    readonly devicePixelRatio: number;
  };
  readonly worldTop: DOMTrackedWorldPoint;
  readonly worldCenter: DOMTrackedWorldPoint;
  readonly worldBottom: DOMTrackedWorldPoint;
  readonly worldLeft: DOMTrackedWorldPoint;
  readonly worldRight: DOMTrackedWorldPoint;
  readonly relativeScroll: number;
};

export type DOMTrackerMode = "active" | "suspended";

export default class DOMTracker {
  private readonly trackerEntries = new Map<string, SceneAnchorRegistration>();
  private readonly cachedRects = new Map<string, CachedSceneAnchor>();
  private readonly listeners = new Set<() => void>();
  private resizeObserver: ResizeObserver | null = null;
  private readonly viewportUnsubscribe: Unsubscribe;
  private readonly refreshUnsubscribe: Unsubscribe;
  private refreshMode: DOMTrackerMode = "active";
  private pendingRefresh = false;
  private isConnected = false;
  private previousViewport: MotionViewportPayload | null = null;
  private viewportWidth = 0;
  private viewportHeight = 0;
  private viewportDevicePixelRatio = 1;

  constructor(
    private readonly frame: FrameCoordinator,
    private readonly bus: MotionBus,
    private readonly cameraRig: CameraRig,
  ) {
    this.viewportUnsubscribe = this.bus.subscribe(
      "viewport",
      (payload: MotionViewportPayload) => {
        this.updateViewport(payload);
      },
    );

    this.refreshUnsubscribe = this.frame.register("MEASURE", () => {
      this.refreshFromDirty();
    });
  }

  connect(): void {
    if (this.isConnected) {
      return;
    }
    this.isConnected = true;

    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => {
      this.pendingRefresh = true;
      this.notify();
    });

    if (resizeObserver) {
      for (const { element } of this.trackerEntries.values()) {
        resizeObserver.observe(element);
      }
    }

    this.resizeObserver = resizeObserver;
    this.pendingRefresh = true;
    this.notify();
  }

  disconnect(): void {
    const resizeObserver = this.resizeObserver;
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    this.isConnected = false;
    this.pendingRefresh = false;
    this.trackerEntries.clear();
    this.cachedRects.clear();
    this.listeners.clear();
  }

  register(registration: SceneAnchorRegistration): Unsubscribe {
    this.trackerEntries.set(registration.id, registration);

    if (this.resizeObserver) {
      this.resizeObserver.observe(registration.element);
    }

    this.pendingRefresh = true;
    this.notify();

    return () => {
      const entry = this.trackerEntries.get(registration.id);
      if (!entry) {
        return;
      }

      this.trackerEntries.delete(registration.id);
      this.cachedRects.delete(registration.id);
      if (this.resizeObserver) {
        this.resizeObserver.unobserve(registration.element);
      }
      this.notify();
    };
  }

  getSnapshot(id: string): DOMTrackerWorldSnapshot | null {
    const cached = this.cachedRects.get(id);
    if (!cached) {
      return null;
    }

    const viewport = this.getViewport();
    const dynamic = this.buildWorldProjection(cached, viewport.scrollY);
    if (!dynamic) {
      return null;
    }

    return {
      ...cached,
      viewport,
      worldTop: dynamic.top,
      worldCenter: dynamic.center,
      worldBottom: dynamic.bottom,
      worldLeft: dynamic.left,
      worldRight: dynamic.right,
      relativeScroll: Math.max(0, viewport.scrollY - (cached.top + cached.scrollY)),
    };
  }

  has(id: string): boolean {
    return this.trackerEntries.has(id);
  }

  get count(): number {
    return this.trackerEntries.size;
  }

  get snapshot(): DOMTrackerSnapshot {
    return {
      anchors: new Map(this.cachedRects),
      count: this.cachedRects.size,
    };
  }

  list(): readonly string[] {
    return Array.from(this.trackerEntries.keys());
  }

  onChange(listener: () => void): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  updateViewport(widthOrPayload: number | MotionViewportPayload, height?: number): void {
    if (typeof widthOrPayload === "number") {
      const w = widthOrPayload;
      if (!Number.isFinite(w) || !Number.isFinite(height ?? 0)) {
        return;
      }
      this.viewportWidth = Math.max(1, w);
      this.viewportHeight = Math.max(1, height!);
      this.viewportDevicePixelRatio = 1;
      this.cameraRig.setViewport(this.viewportWidth, this.viewportHeight, this.viewportDevicePixelRatio);
      return;
    }

    const payload = widthOrPayload;
    this.previousViewport = payload;
    const hasSizeChange =
      this.viewportWidth !== payload.width ||
      this.viewportHeight !== payload.height ||
      this.viewportDevicePixelRatio !== payload.devicePixelRatio;
    this.viewportWidth = Math.max(1, payload.width);
    this.viewportHeight = Math.max(1, payload.height);
    this.viewportDevicePixelRatio = payload.devicePixelRatio;
    if (hasSizeChange) {
      this.pendingRefresh = true;
      this.notify();
    }
    this.cameraRig.setViewport(this.viewportWidth, this.viewportHeight, payload.devicePixelRatio);
  }

  refreshFromDirty(): void {
    if (this.refreshMode === "suspended" || this.trackerEntries.size === 0) {
      return;
    }

    if (!this.pendingRefresh) {
      return;
    }

    const viewport = this.getViewport();
    this.pendingRefresh = false;

    for (const entry of this.trackerEntries.values()) {
      this.captureAnchor(entry, viewport);
    }
  }

  /**
   * Re-measures one explicitly dynamic anchor during the caller's MEASURE
   * phase. Stable anchors retain the normal dirty-only refresh behaviour.
   */
  refreshAnchor(id: string): boolean {
    const entry = this.trackerEntries.get(id);
    if (!entry) {
      return false;
    }

    return this.captureAnchor(entry, this.getViewport());
  }

  clear(): void {
    this.trackerEntries.clear();
    this.cachedRects.clear();
    this.pendingRefresh = false;
    this.notify();
  }

  private getViewport(): {
    readonly width: number;
    readonly height: number;
    readonly devicePixelRatio: number;
    readonly scrollY: number;
  } {
    const viewportScrollY = this.getScrollY();
    return {
      width: this.viewportWidth,
      height: this.viewportHeight,
      devicePixelRatio: this.viewportDevicePixelRatio,
      scrollY: viewportScrollY,
    };
  }

  private captureAnchor(
    entry: SceneAnchorRegistration,
    viewport: {
      readonly width: number;
      readonly height: number;
      readonly devicePixelRatio: number;
      readonly scrollY: number;
    },
  ): boolean {
    if (!entry.element.isConnected) {
      return false;
    }

    const rect = entry.element.getBoundingClientRect();
    this.cachedRects.set(entry.id, {
      ...entry,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      scrollY: viewport.scrollY,
      updatedAt: Date.now(),
      capturedAtBreakpoint: this.cameraRig.currentBreakpoint,
    });
    return true;
  }

  private buildWorldProjection(cached: CachedSceneAnchor, scrollY: number): {
    readonly top: DOMTrackedWorldPoint;
    readonly center: DOMTrackedWorldPoint;
    readonly bottom: DOMTrackedWorldPoint;
    readonly left: DOMTrackedWorldPoint;
    readonly right: DOMTrackedWorldPoint;
  } | null {
    if (this.viewportWidth <= 0 || this.viewportHeight <= 0) {
      return null;
    }

    const top = cached.top - (scrollY - cached.scrollY);
    const left = cached.left;
    const right = cached.right;
    const height = cached.height;
    const width = cached.width;
    const projectionBaseline = this.cameraRig.getProjectionBaseline();
    const worldTop = domToWorld({
      x: left + width / 2,
      y: top,
      viewport: {
        width: this.viewportWidth,
        height: this.viewportHeight,
      },
      camera: projectionBaseline,
      depth: projectionBaseline.distance,
    });
    const worldCenter = domToWorld({
      x: left + width / 2,
      y: top + height / 2,
      viewport: {
        width: this.viewportWidth,
        height: this.viewportHeight,
      },
      camera: projectionBaseline,
      depth: projectionBaseline.distance,
    });
    const worldBottom = domToWorld({
      x: left + width / 2,
      y: top + height,
      viewport: {
        width: this.viewportWidth,
        height: this.viewportHeight,
      },
      camera: projectionBaseline,
      depth: projectionBaseline.distance,
    });
    const worldLeft = domToWorld({
      x: left,
      y: top + height / 2,
      viewport: {
        width: this.viewportWidth,
        height: this.viewportHeight,
      },
      camera: projectionBaseline,
      depth: projectionBaseline.distance,
    });
    const worldRight = domToWorld({
      x: right,
      y: top + height / 2,
      viewport: {
        width: this.viewportWidth,
        height: this.viewportHeight,
      },
      camera: projectionBaseline,
      depth: projectionBaseline.distance,
    });

    return {
      top: {
        point: worldTop.world,
        screen: { x: left + width / 2, y: top },
      },
      center: {
        point: worldCenter.world,
        screen: { x: left + width / 2, y: top + height / 2 },
      },
      bottom: {
        point: worldBottom.world,
        screen: { x: left + width / 2, y: top + height },
      },
      left: {
        point: worldLeft.world,
        screen: { x: left, y: top + height / 2 },
      },
      right: {
        point: worldRight.world,
        screen: { x: right, y: top + height / 2 },
      },
    };
  }

  private getScrollY(): number {
    return this.previousViewport?.scrollY ?? (typeof window !== "undefined" ? window.scrollY : 0);
  }

  private notify(): void {
    for (const listener of Array.from(this.listeners)) {
      listener();
    }
  }

  dispose(): void {
    this.disconnect();
    this.viewportUnsubscribe();
    this.refreshUnsubscribe();
  }
}
