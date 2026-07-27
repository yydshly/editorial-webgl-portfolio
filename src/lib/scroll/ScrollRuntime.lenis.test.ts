import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FrameCoordinator from "@/lib/motion/FrameCoordinator";
import MotionBus from "@/lib/motion/MotionBus";
import ScrollLockService from "@/lib/scroll/ScrollLockService";
import ScrollRuntime from "@/lib/scroll/ScrollRuntime";

type LenisMockInstance = {
  scroll: number;
  velocity: number;
  direction: -1 | 0 | 1;
  isHorizontal: boolean;
  raf: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  on: (event: "scroll", callback: (instance: LenisMockInstance) => void) => () => void;
  emitScroll: () => void;
};

const lenisInstances: LenisMockInstance[] = [];

vi.mock("lenis", () => {
  return {
    __esModule: true,
    default: class MockLenis {
      public scroll = 0;
      public velocity = 0;
      public direction: -1 | 0 | 1 = 0;
      public isHorizontal = false;
      public raf = vi.fn();
      public stop = vi.fn();
      public start = vi.fn();
      public destroy = vi.fn();
      private readonly scrollCallbacks = new Set<(instance: LenisMockInstance) => void>();

      constructor() {
        lenisInstances.push(this as unknown as LenisMockInstance);
      }

      on(_event: "scroll", callback: (instance: LenisMockInstance) => void): () => void {
        this.scrollCallbacks.add(callback);
        return () => {
          this.scrollCallbacks.delete(callback);
        };
      }

      emitScroll(): void {
        for (const callback of this.scrollCallbacks) {
          callback(this as unknown as LenisMockInstance);
        }
      }
    },
  };
});

describe("ScrollRuntime with real Lenis import", () => {
  it("uses Lenis when import resolves and drives raf from INPUT phase", async () => {
    const requestAnimationFrameCallbacks: FrameRequestCallback[] = [];

    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        requestAnimationFrameCallbacks.push(callback as FrameRequestCallback);
        return requestAnimationFrameCallbacks.length;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);

    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const lockService = new ScrollLockService();
    const runtime = new ScrollRuntime(bus, lockService, frame);
    const onScroll = vi.fn();

    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });

    await runtime.connect();
    bus.subscribe("scroll", onScroll);

    frame.start();
    requestAnimationFrameCallbacks.shift()?.(128);
    const instance = lenisInstances.at(-1);
    expect(instance).toBeDefined();
    expect(runtime.isUsingLenis).toBe(true);
    expect(instance?.raf).toHaveBeenCalledTimes(1);

    act(() => {
      if (!instance) {
        return;
      }
      instance.scroll = 320;
      instance.velocity = 4.5;
      instance.direction = 1;
      instance.emitScroll();
    });

    expect(onScroll).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "lenis",
        scrollX: 0,
        scrollY: 320,
        velocity: 4.5,
        direction: 1,
      }),
    );

    runtime.dispose();
    frame.dispose();

    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });
});
