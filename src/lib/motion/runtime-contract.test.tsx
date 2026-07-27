import { act, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEffect } from "react";

import MotionBus from "@/lib/motion/MotionBus";
import FrameCoordinator from "@/lib/motion/FrameCoordinator";
import PointerTracker from "@/lib/motion/PointerTracker";
import RuntimeProvider, {
  useRuntime,
  useRuntimeSubscribe,
} from "@/lib/motion/RuntimeProvider";
import ViewportService from "@/lib/motion/ViewportService";
import MotionSnapshotStore from "@/lib/motion/MotionSnapshotStore";

describe("MotionBus contract", () => {
  it("supports cancellable subscriptions", () => {
    const bus = new MotionBus();
    const onTick = vi.fn();

    const unsubscribe = bus.subscribe("tick", onTick);
    bus.emit("tick", { frame: 1, timestamp: 10, delta: 16, elapsed: 16 });
    expect(onTick).toHaveBeenCalledTimes(1);

    unsubscribe();
    bus.emit("tick", { frame: 2, timestamp: 26, delta: 16, elapsed: 16 });
    expect(onTick).toHaveBeenCalledTimes(1);
  });
});

describe("FrameCoordinator contract", () => {
  it("emits frame ticks and supports stop/dispose lifecycle", () => {
    const bus = new MotionBus();
    const onTick = vi.fn();
    const callbacks: FrameRequestCallback[] = [];

    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callbacks.push(callback as FrameRequestCallback);
        return callbacks.length;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    bus.subscribe("tick", onTick);

    const frame = new FrameCoordinator(bus);
    frame.start();
    expect(callbacks).toHaveLength(1);
    expect(requestAnimationFrameSpy).toHaveBeenCalled();

    callbacks.shift()?.(16);
    expect(onTick).toHaveBeenCalledTimes(1);
    expect(callbacks).toHaveLength(1);

    callbacks.shift()?.(32);
    expect(onTick).toHaveBeenCalledTimes(2);

    frame.stop();
    expect(cancelAnimationFrameSpy).toHaveBeenCalled();
    const countAfterStop = onTick.mock.calls.length;
    const callbacksAfterStop = callbacks.length;

    frame.start();
    expect(callbacks.length).toBeGreaterThan(callbacksAfterStop);
    callbacks.shift()?.(48);
    expect(onTick).toHaveBeenCalledTimes(countAfterStop + 1);

    frame.dispose();
    expect(frame.isRunning).toBe(false);
  });

  it("executes callbacks in phase order and respects priority", () => {
    const bus = new MotionBus();
    const order: string[] = [];
    const callbacks: FrameRequestCallback[] = [];

    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callbacks.push(callback as FrameRequestCallback);
        return callbacks.length;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);

    const coordinator = new FrameCoordinator(bus);
    coordinator.register("INPUT", () => order.push("input-low"), { priority: 0 });
    coordinator.register("INPUT", () => order.push("input-high"), { priority: 10 });
    coordinator.register("STATE", () => order.push("state"));
    coordinator.register("MEASURE", () => order.push("measure"));
    coordinator.register("ANIMATE", () => order.push("animate"));
    coordinator.register("RENDER", () => order.push("render"));
    coordinator.register("POST", () => order.push("post"));

    coordinator.start();
    callbacks.shift()?.(1000);

    expect(order).toEqual([
      "input-high",
      "input-low",
      "state",
      "measure",
      "animate",
      "render",
      "post",
    ]);

    coordinator.stop();
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
    coordinator.dispose();
  });

  it("isolates callback errors and continues other phase tasks", () => {
    const bus = new MotionBus();
    const callbacks: FrameRequestCallback[] = [];
    const calls: string[] = [];
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callbacks.push(callback as FrameRequestCallback);
        return callbacks.length;
      });

    const coordinator = new FrameCoordinator(bus);
    coordinator.register("MEASURE", () => {
      calls.push("a");
      throw new Error("boom");
    });
    coordinator.register("MEASURE", () => calls.push("b"));

    coordinator.start();
    callbacks.shift()?.(1000);

    expect(calls).toEqual(["a", "b"]);

    coordinator.dispose();
    requestAnimationFrameSpy.mockRestore();
  });

  it("supports unregistering phase callbacks", () => {
    const bus = new MotionBus();
    const callbacks: FrameRequestCallback[] = [];
    const onPost = vi.fn();

    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callbacks.push(callback as FrameRequestCallback);
        return callbacks.length;
      });

    const coordinator = new FrameCoordinator(bus);
    const unregister = coordinator.register("POST", onPost);
    unregister();

    coordinator.start();
    callbacks.shift()?.(1000);

    expect(onPost).not.toHaveBeenCalled();

    coordinator.dispose();
    requestAnimationFrameSpy.mockRestore();
  });
});

describe("ViewportService contract", () => {
  it("emits viewport snapshots on connect and resize", () => {
    const bus = new MotionBus();
    const onViewport = vi.fn();
    const service = new ViewportService(bus);

    bus.subscribe("viewport", onViewport);

    service.connect();
    expect(onViewport).toHaveBeenCalledTimes(1);

    Object.defineProperty(window, "innerWidth", { value: 1280, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 720, configurable: true });

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });
    expect(onViewport).toHaveBeenCalledTimes(2);

    const snapshot = onViewport.mock.calls[1][0];
    expect(snapshot.width).toBe(1280);
    expect(snapshot.height).toBe(720);

    service.disconnect();
    window.dispatchEvent(new Event("resize"));
    expect(onViewport).toHaveBeenCalledTimes(2);
  });
});

describe("PointerTracker contract", () => {
  const createPointerEvent = (type: string, x: number, y: number, id = 1): PointerEvent => {
    if (typeof PointerEvent === "undefined") {
      const event = new MouseEvent(type, { clientX: x, clientY: y }) as MouseEvent &
        PointerEvent;
      Object.defineProperty(event, "pointerId", { value: id, configurable: true });
      return event as unknown as PointerEvent;
    }

    return new PointerEvent(type, { clientX: x, clientY: y, pointerId: id });
  };

  it("emits normalized pointer move payload and supports cleanup", () => {
    const bus = new MotionBus();
    const onPointer = vi.fn();
    const tracker = new PointerTracker(bus);

    bus.subscribe("pointer:move", onPointer);

    tracker.connect();
    act(() => {
      window.dispatchEvent(createPointerEvent("pointermove", 50, 80, 7));
    });
    expect(onPointer).toHaveBeenCalledTimes(1);
    expect(onPointer).toHaveBeenCalledWith({
      id: 7,
      x: 50,
      y: 80,
      prevX: 0,
      prevY: 0,
      dx: 50,
      dy: 80,
      velocityX: expect.any(Number),
      velocityY: expect.any(Number),
      isDown: false,
    });

    tracker.disconnect();
    window.dispatchEvent(createPointerEvent("pointermove", 60, 90, 7));
    expect(onPointer).toHaveBeenCalledTimes(1);
  });
});

describe("RuntimeProvider contract", () => {
  it("creates runtime and unsubscribes cleanup on unmount", async () => {
    let listenerCount = -1;
    let frameRunning = true;

    function Probe() {
      const runtime = useRuntime();
      const onTick = vi.fn();

      useRuntimeSubscribe("tick", onTick);
      useEffect(() => {
        listenerCount = runtime.bus.listenerCount;

        return () => {
          listenerCount = runtime.bus.listenerCount;
          frameRunning = runtime.frame.isRunning;
        };
      }, [runtime]);

      return null;
    }

    const { unmount } = render(
      <RuntimeProvider>
        <Probe />
      </RuntimeProvider>,
    );

    await waitFor(() => {
      expect(listenerCount).toBeGreaterThan(0);
    });

    unmount();
    expect(listenerCount).toBe(0);
    expect(frameRunning).toBe(false);
  });

  it("seeds MotionSnapshotStore with the initial viewport on connect", async () => {
    Object.defineProperty(window, "innerWidth", { value: 1440, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 900, configurable: true });
    let readViewport: (() => ReturnType<MotionSnapshotStore["getSnapshot"]>["viewport"]) | null = null;

    function Probe() {
      const runtime = useRuntime();
      readViewport = () => runtime.snapshot.viewport;
      return null;
    }

    const { unmount } = render(
      <RuntimeProvider>
        <Probe />
      </RuntimeProvider>,
    );

    await waitFor(() => {
      expect(readViewport?.().width).toBe(1440);
      expect(readViewport?.().height).toBe(900);
    });

    unmount();
  });

});

describe("MotionSnapshotStore", () => {
  it("stores latest motion state snapshots", () => {
    const store = new MotionSnapshotStore();
    store.updateScroll({
      scrollX: 20,
      scrollY: 40,
      velocity: 12,
      direction: 1,
      source: "native",
      timestamp: 100,
    });
    store.updateFrame({
      frame: 3,
      timestamp: 16,
      delta: 0.016,
      elapsed: 0.048,
    });
    store.updateViewport({
      width: 900,
      height: 700,
      scrollX: 20,
      scrollY: 40,
      devicePixelRatio: 2,
      isPortrait: false,
    });
    store.updatePointer({
      id: 1,
      x: 32,
      y: 64,
      prevX: 30,
      prevY: 62,
      dx: 2,
      dy: 2,
      velocityX: 0.1,
      velocityY: 0.2,
      isDown: true,
    });
    store.setReducedMotion(true);

    const snapshot = store.getSnapshot();
    expect(snapshot.frame.frame).toBe(3);
    expect(snapshot.scroll.scrollY).toBe(40);
    expect(snapshot.viewport.width).toBe(900);
    expect(snapshot.pointer.isDown).toBe(true);
    expect(snapshot.reducedMotion).toBe(true);
  });
});
