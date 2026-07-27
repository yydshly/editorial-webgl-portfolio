import { describe, expect, it, vi } from "vitest";

import FrameCoordinator from "@/lib/motion/FrameCoordinator";
import MotionBus from "@/lib/motion/MotionBus";
import RenderScheduler from "@/lib/webgl/RenderScheduler";

describe("RenderScheduler", () => {
  it("registers render tasks to Motion frame and respects pause state", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const scheduler = new RenderScheduler(frame);
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

    const task = vi.fn();
    scheduler.start();
    scheduler.register(task);
    frame.start();

    callbacks.shift()?.(16);
    expect(task).toHaveBeenCalledTimes(1);

    scheduler.pause();
    callbacks.shift()?.(32);
    expect(task).toHaveBeenCalledTimes(1);

    scheduler.resume();
    callbacks.shift()?.(48);
    expect(task).toHaveBeenCalledTimes(2);

    scheduler.stop();
    callbacks.shift()?.(64);
    expect(task).toHaveBeenCalledTimes(2);

    scheduler.dispose();
    frame.stop();

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it("supports low update mode and priority ordering", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const scheduler = new RenderScheduler(frame);
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

    const calls: string[] = [];
    scheduler.setLowUpdateMode(true, 2);
    scheduler.start();

    scheduler.register(() => calls.push("low-1"), { priority: 1 });
    scheduler.register(() => calls.push("low-2"), { priority: 0 });

    frame.start();
    callbacks.shift()?.(1000);
    expect(calls).toHaveLength(0);

    callbacks.shift()?.(1016);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toBe("low-1");
    expect(calls[1]).toBe("low-2");

    callbacks.shift()?.(1032);
    expect(calls).toHaveLength(2);

    scheduler.dispose();
    frame.stop();

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });
});
