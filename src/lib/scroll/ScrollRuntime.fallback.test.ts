import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MotionBus from "@/lib/motion/MotionBus";
import ScrollLockService from "@/lib/scroll/ScrollLockService";
import ScrollRuntime from "@/lib/scroll/ScrollRuntime";
import FrameCoordinator from "@/lib/motion/FrameCoordinator";

describe("ScrollRuntime", () => {
  it("falls back to native scroll when Lenis is unavailable", async () => {
    const bus = new MotionBus();
    const lockService = new ScrollLockService();
    const frame = new FrameCoordinator(bus);
    const runtime = new ScrollRuntime(bus, lockService, frame);
    const onScroll = vi.fn();

    bus.subscribe("scroll", onScroll);
    Object.defineProperty(window, "scrollX", {
      configurable: true,
      value: 0,
      writable: true,
    });
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 0,
      writable: true,
    });

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });

    let now = 0;
    const nowSpy = vi.spyOn(performance, "now").mockImplementation(() => {
      now += 16;
      return now;
    });

    await runtime.connect();

    expect(runtime.isFallback).toBe(true);
    expect(runtime.isUsingLenis).toBe(false);

    act(() => {
      Object.defineProperty(window, "scrollY", {
        configurable: true,
        value: 120,
        writable: true,
      });
      window.dispatchEvent(new Event("scroll"));
    });

    expect(onScroll).toHaveBeenCalled();
    const latest = onScroll.mock.calls.at(-1)?.[0];
    expect(latest).toMatchObject({
      source: "native",
      scrollX: 0,
      scrollY: 120,
      direction: 1,
      velocity: expect.any(Number),
    });
    expect(latest.velocity).toBeGreaterThan(0);

    nowSpy.mockRestore();
    runtime.dispose();
  });

  it("blocks native scroll events while locked and resumes after release", async () => {
    const bus = new MotionBus();
    const lockService = new ScrollLockService();
    const frame = new FrameCoordinator(bus);
    const runtime = new ScrollRuntime(bus, lockService, frame);
    const onScroll = vi.fn();
    bus.subscribe("scroll", onScroll);
    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 0,
      writable: true,
    });
    Object.defineProperty(window, "scrollX", {
      configurable: true,
      value: 0,
      writable: true,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });

    const nowSpy = vi.spyOn(performance, "now").mockReturnValue(0);

    const release = lockService.acquire();
    await runtime.connect();
    nowSpy.mockReturnValue(16);

    act(() => {
      Object.defineProperty(window, "scrollY", {
        configurable: true,
        value: 200,
        writable: true,
      });
      window.dispatchEvent(new Event("scroll"));
    });

    expect(onScroll).toHaveBeenCalledTimes(0);

    onScroll.mockClear();
    release();

    act(() => {
      Object.defineProperty(window, "scrollY", {
        configurable: true,
        value: 200,
        writable: true,
      });
      window.dispatchEvent(new Event("scroll"));
    });

    expect(onScroll).toHaveBeenCalledTimes(1);
    expect(onScroll).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "native",
        scrollY: 200,
      }),
    );

    nowSpy.mockRestore();
    runtime.dispose();
  });

  it("keeps listeners cleaned after dispose", async () => {
    const bus = new MotionBus();
    const lockService = new ScrollLockService();
    const frame = new FrameCoordinator(bus);
    const runtime = new ScrollRuntime(bus, lockService, frame);
    const onScroll = vi.fn();
    bus.subscribe("scroll", onScroll);
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: true })),
    });

    Object.defineProperty(window, "scrollY", {
      configurable: true,
      value: 10,
      writable: true,
    });
    Object.defineProperty(window, "scrollX", {
      configurable: true,
      value: 0,
      writable: true,
    });

    await runtime.connect();
    onScroll.mockClear();

    runtime.dispose();
    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    expect(onScroll).not.toHaveBeenCalled();
  });
});
