import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FrameCoordinator from "@/lib/motion/FrameCoordinator";
import MotionBus from "@/lib/motion/MotionBus";
import MotionAnimationRuntime from "@/lib/animation/MotionAnimationRuntime";

const createRect = (options: {
  top: number;
  height: number;
  width: number;
}): DOMRectReadOnly =>
  ({
    top: options.top,
    height: options.height,
    width: options.width,
    bottom: options.top + options.height,
    left: 0,
    right: options.width,
    x: 0,
    y: options.top,
    toJSON: () => ({}),
  }) as DOMRectReadOnly;

describe("MotionAnimationRuntime", () => {
  it("reveals elements immediately when reduced motion is enabled", () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const runtime = new MotionAnimationRuntime(bus, frame, { reducedMotion: true });
    const section = document.createElement("section");

    runtime.connect();
    const unregister = runtime.registerReveal(section, {});

    expect(section.classList.contains("motion-reveal")).toBe(true);
    expect(section.dataset.motionState).toBe("visible");

    unregister();
    expect(section.classList.contains("motion-reveal")).toBe(false);
    runtime.dispose();
    frame.dispose();
  });

  it("updates parallax transform variable using frame phases", () => {
    const bus = new MotionBus();
    const callbacks: FrameRequestCallback[] = [];
    const frame = new FrameCoordinator(bus);
    const runtime = new MotionAnimationRuntime(bus, frame);
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callbacks.push(callback as FrameRequestCallback);
        return callbacks.length;
      });

    runtime.connect();
    frame.start();

    const section = document.createElement("section");
    section.getBoundingClientRect = () => createRect({ top: 100, height: 100, width: 100 });

    runtime.registerParallax(section, { speed: 0.2 });
    bus.emit("scroll", {
      scrollX: 0,
      scrollY: 200,
      velocity: 1,
      direction: 1,
      source: "native",
      timestamp: 16,
    });
    act(() => {
      callbacks.shift()?.(16);
    });

    expect(section.style.getPropertyValue("--motion-parallax-y")).toBe("-20px");

    runtime.dispose();
    frame.dispose();
    requestAnimationFrameSpy.mockRestore();
  });

  it("keeps all registrations removable and stops updates after dispose", () => {
    const bus = new MotionBus();
    const callbacks: FrameRequestCallback[] = [];
    const frame = new FrameCoordinator(bus);
    const runtime = new MotionAnimationRuntime(bus, frame);
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callbacks.push(callback as FrameRequestCallback);
        return callbacks.length;
      });

    runtime.connect();
    frame.start();
    callbacks.shift()?.(16);

    const section = document.createElement("section");
    section.getBoundingClientRect = () => createRect({ top: 50, height: 80, width: 100 });
    runtime.registerParallax(section);
    runtime.dispose();
    frame.dispose();

    section.style.setProperty("--motion-parallax-y", "0px");
    bus.emit("scroll", {
      scrollX: 0,
      scrollY: 100,
      velocity: 1,
      direction: 1,
      source: "native",
      timestamp: 16,
    });
    act(() => {
      callbacks.shift()?.(32);
    });

    expect(section.className).not.toContain("motion-parallax");

    requestAnimationFrameSpy.mockRestore();
  });
});
