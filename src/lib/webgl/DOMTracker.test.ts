import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import FrameCoordinator from "@/lib/motion/FrameCoordinator";
import MotionBus from "@/lib/motion/MotionBus";
import CameraRig from "@/lib/webgl/CameraRig";
import DOMTracker from "@/lib/webgl/DOMTracker";

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};
let resizeObserverBackup: typeof ResizeObserver | undefined;

function createRect(rect: Rect): DOMRectReadOnly {
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    x: rect.left,
    y: rect.top,
    toJSON: () => ({}),
  } as DOMRectReadOnly;
}

describe("DOMTracker", () => {
  beforeEach(() => {
    resizeObserverBackup = globalThis.ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = resizeObserverBackup as typeof ResizeObserver;
  });

  it("registers anchors, caches layout and maps viewport/scroll state", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const rig = new CameraRig();
    rig.setViewport(1200, 800, 1);
    const tracker = new DOMTracker(frame, bus, rig);

    const anchor = document.createElement("section");
    anchor.id = "hero";

    const getRect = vi.fn(() => createRect({ top: 300, left: 50, width: 200, height: 120 }));
    anchor.getBoundingClientRect = getRect;
    document.body.appendChild(anchor);
    tracker.connect();
    tracker.updateViewport({
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 80,
      devicePixelRatio: 1,
      isPortrait: false,
    });

    const unregister = tracker.register({
      id: "hero",
      element: anchor,
    });

    tracker.refreshFromDirty();

    const snapshot = tracker.getSnapshot("hero");
    expect(snapshot).not.toBeNull();
    expect(snapshot?.id).toBe("hero");
    expect(snapshot?.scrollY).toBe(80);
    expect(snapshot?.worldTop.point.z).toBeLessThan(0);
    expect(getRect).toHaveBeenCalledTimes(1);

    tracker.refreshFromDirty();
    expect(getRect).toHaveBeenCalledTimes(1);

    bus.emit("viewport", {
      scrollX: 0,
      scrollY: 120,
      width: 1200,
      height: 800,
      devicePixelRatio: 1,
      isPortrait: false,
    });
    expect(tracker.getSnapshot("hero")?.relativeScroll).toBe(0);
    expect(getRect).toHaveBeenCalledTimes(1);

    bus.emit("viewport", {
      scrollX: 0,
      scrollY: 130,
      width: 1210,
      height: 800,
      devicePixelRatio: 1,
      isPortrait: false,
    });

    tracker.refreshFromDirty();
    expect(getRect).toHaveBeenCalledTimes(2);
    expect(tracker.getSnapshot("hero")?.relativeScroll).toBe(0);

    tracker.refreshFromDirty();
    expect(getRect).toHaveBeenCalledTimes(2);
    expect(tracker.list()).toContain("hero");

    unregister();
    expect(tracker.has("hero")).toBe(false);
  });

  it("keeps DOM world projection stable when CameraRig applies an intent", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const rig = new CameraRig();
    rig.setViewport(390, 844, 1);
    const tracker = new DOMTracker(frame, bus, rig);
    const anchor = document.createElement("section");
    anchor.getBoundingClientRect = vi.fn(() =>
      createRect({ top: 180, left: 40, width: 310, height: 240 }));
    document.body.appendChild(anchor);
    tracker.connect();
    tracker.updateViewport({
      width: 390,
      height: 844,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      isPortrait: true,
    });
    tracker.register({
      id: "media",
      element: anchor,
    });
    tracker.refreshFromDirty();

    const before = tracker.getSnapshot("media");
    expect(before).not.toBeNull();

    rig.setCameraIntent({
      target: before!.worldCenter.point,
      positionOffset: {
        x: -0.05,
        y: 0,
        z: 0.75,
      },
      fovIntent: 48,
      depthBias: -0.1,
      weight: 1,
    });
    rig.update(1 / 60);

    const after = tracker.getSnapshot("media");
    expect(after).not.toBeNull();
    expect(after!.worldCenter.point.x).toBeCloseTo(before!.worldCenter.point.x, 8);
    expect(after!.worldCenter.point.y).toBeCloseTo(before!.worldCenter.point.y, 8);
    expect(after!.worldCenter.point.z).toBeCloseTo(before!.worldCenter.point.z, 8);

    tracker.dispose();
    frame.stop();
    document.body.innerHTML = "";
  });

  it("derives section-relative scroll from anchor document top", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const rig = new CameraRig();
    rig.setViewport(1200, 800, 1);
    const tracker = new DOMTracker(frame, bus, rig);

    const anchor = document.createElement("section");
    anchor.id = "media";
    anchor.getBoundingClientRect = vi.fn(() =>
      createRect({ top: 960, left: 40, width: 320, height: 220 }));
    document.body.appendChild(anchor);

    tracker.connect();
    tracker.updateViewport({
      width: 1200,
      height: 800,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      isPortrait: false,
    });
    tracker.register({
      id: "media",
      element: anchor,
      sceneType: "media",
    });
    tracker.refreshFromDirty();

    bus.emit("viewport", {
      scrollX: 0,
      scrollY: 600,
      width: 1200,
      height: 800,
      devicePixelRatio: 1,
      isPortrait: false,
    });
    expect(tracker.getSnapshot("media")?.relativeScroll).toBe(0);

    bus.emit("viewport", {
      scrollX: 0,
      scrollY: 1040,
      width: 1200,
      height: 800,
      devicePixelRatio: 1,
      isPortrait: false,
    });
    expect(tracker.getSnapshot("media")?.relativeScroll).toBe(80);

    tracker.dispose();
    frame.stop();
    document.body.innerHTML = "";
  });

  it("refreshes one dynamic anchor without remeasuring stable anchors", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const rig = new CameraRig();
    rig.setViewport(1440, 900, 1);
    const tracker = new DOMTracker(frame, bus, rig);
    let portraitTop = 320;
    const portrait = document.createElement("figure");
    const stable = document.createElement("section");
    const portraitRect = vi.fn(() =>
      createRect({
        top: portraitTop,
        left: 48,
        width: 520,
        height: 700,
      }),
    );
    const stableRect = vi.fn(() =>
      createRect({ top: 1200, left: 640, width: 720, height: 1400 }),
    );
    portrait.getBoundingClientRect = portraitRect;
    stable.getBoundingClientRect = stableRect;
    document.body.append(portrait, stable);
    tracker.connect();
    tracker.updateViewport({
      width: 1440,
      height: 900,
      scrollX: 0,
      scrollY: 0,
      devicePixelRatio: 1,
      isPortrait: false,
    });
    tracker.register({ id: "about-portrait", element: portrait });
    tracker.register({ id: "about", element: stable });
    tracker.refreshFromDirty();

    portraitTop = 16;
    expect(tracker.refreshAnchor("about-portrait")).toBe(true);

    expect(portraitRect).toHaveBeenCalledTimes(2);
    expect(stableRect).toHaveBeenCalledTimes(1);
    expect(tracker.getSnapshot("about-portrait")?.top).toBe(16);
    expect(tracker.refreshAnchor("missing")).toBe(false);

    tracker.dispose();
    frame.stop();
    document.body.innerHTML = "";
  });

  it("suspends refresh work when not connected to DOM and cleans up on dispose", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const rig = new CameraRig();
    const tracker = new DOMTracker(frame, bus, rig);

    const observe = vi.fn();
    const unobserve = vi.fn();
    const disconnect = vi.fn();
    class TestResizeObserver {
      observe = observe;
      unobserve = unobserve;
      disconnect = disconnect;
      constructor() {
        // no-op
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).ResizeObserver = TestResizeObserver as never;

    tracker.connect();
    const element = document.createElement("section");
    const unregister = tracker.register({ id: "about", element });
    unregister();
    tracker.dispose();

    expect(observe).toHaveBeenCalledTimes(1);
    expect(unobserve).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(tracker.has("about")).toBe(false);
  });
});
