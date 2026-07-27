import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import FrameCoordinator from "@/lib/motion/FrameCoordinator";
import MotionBus from "@/lib/motion/MotionBus";
import WebGLCapability from "@/lib/webgl/WebGLCapability";
import GlobalWebGLStage from "@/components/webgl/GlobalWebGLStage";
import RenderScheduler from "@/lib/webgl/RenderScheduler";
import HeroSection from "@/components/sections/HeroSection";

const threeRendererMock = vi.hoisted(() => ({
  instances: [] as Array<{
    autoClear: boolean;
    info: {
      autoReset: boolean;
      reset: ReturnType<typeof vi.fn>;
    };
    clear: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
    setClearColor: ReturnType<typeof vi.fn>;
    setClearAlpha: ReturnType<typeof vi.fn>;
    setPixelRatio: ReturnType<typeof vi.fn>;
    setSize: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock("three", () => {
  class MockWebGLRenderer {
    autoClear = true;
    info = {
      autoReset: true,
      reset: vi.fn(),
    };
    clear = vi.fn();
    dispose = vi.fn();
    setClearColor = vi.fn();
    setClearAlpha = vi.fn();
    setPixelRatio = vi.fn();
    setSize = vi.fn();

    constructor() {
      threeRendererMock.instances.push(this);
    }
  }

  return {
    WebGLRenderer: MockWebGLRenderer,
  };
});

type WebGLContextMock = {
  getExtension: (name: string) => unknown;
  clearColor: () => void;
  clear: () => void;
  viewport: () => void;
  COLOR_BUFFER_BIT: number;
  createTexture?: () => unknown;
  deleteTexture?: () => void;
  bindTexture?: () => void;
  pixelStorei?: () => void;
  texParameteri?: () => void;
  texImage2D?: () => void;
  getUniformLocation?: () => unknown;
  getAttribLocation?: () => number;
};

function createMockWebGLContext(): WebGLContextMock {
  return {
    getExtension: (name: string): unknown => {
      if (name === "WEBGL_lose_context") {
        return {
          loseContext: vi.fn(),
        };
      }
      return null;
    },
    clearColor: vi.fn(),
    clear: vi.fn(),
    viewport: vi.fn(),
    COLOR_BUFFER_BIT: 16384,
  };
}

describe("GlobalWebGLStage", () => {
  it("owns one Three renderer and clears the global framebuffer once before scene passes", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const scheduler = new RenderScheduler(frame);
    const callbacks: FrameRequestCallback[] = [];
    const probeSpy = vi.spyOn(WebGLCapability, "probe").mockReturnValue({
      supported: true,
      isWebGL2: false,
      reason: null,
    });
    const mockContext = createMockWebGLContext();
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(mockContext as unknown as WebGLRenderingContext);
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callbacks.push(callback);
        return callbacks.length;
      });
    const cancelAnimationFrameSpy = vi
      .spyOn(window, "cancelAnimationFrame")
      .mockImplementation(() => undefined);
    const externalRenderer = vi.fn();

    threeRendererMock.instances.length = 0;
    render(
      <GlobalWebGLStage
        frame={frame}
        externalRenderer={externalRenderer}
        renderScheduler={scheduler}
      />,
    );

    await waitFor(() => {
      expect(threeRendererMock.instances).toHaveLength(1);
      expect(scheduler.isRunning).toBe(true);
    });
    frame.start();
    callbacks.shift()?.(16);

    const renderer = threeRendererMock.instances[0];
    expect(renderer.autoClear).toBe(false);
    expect(renderer.info.autoReset).toBe(false);
    expect(renderer.info.reset).toHaveBeenCalledTimes(1);
    expect(renderer.clear).toHaveBeenCalledTimes(1);
    expect(externalRenderer).toHaveBeenCalledTimes(1);
    expect(renderer.clear.mock.invocationCallOrder[0]).toBeLessThan(
      externalRenderer.mock.invocationCallOrder[0],
    );

    scheduler.dispose();
    frame.stop();
    cancelAnimationFrameSpy.mockRestore();
    requestAnimationFrameSpy.mockRestore();
    getContextSpy.mockRestore();
    probeSpy.mockRestore();
  });

  it("falls back when capability probe fails", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const probeSpy = vi.spyOn(WebGLCapability, "probe").mockReturnValue({
      supported: false,
      isWebGL2: false,
      reason: "forced-fail",
    });

    const { getByText } = render(
      <GlobalWebGLStage frame={frame} />,
    );

    expect(probeSpy).toHaveBeenCalled();
    await waitFor(() => {
      expect(getByText(/WebGL stage disabled/)).toBeTruthy();
    });
    expect(getByText(/forced-fail/)).toBeTruthy();
    probeSpy.mockRestore();
  });

  it("rebuilds renderer after context lost and restored", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const probeSpy = vi.spyOn(WebGLCapability, "probe").mockReturnValue({
      supported: true,
      isWebGL2: false,
      reason: null,
    });
    const mockContext = createMockWebGLContext();
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(mockContext as unknown as WebGLRenderingContext);
    const onContextLost = vi.fn();
    const onContextRestored = vi.fn();
    const onReady = vi.fn();
    const { container } = render(
      <GlobalWebGLStage
        frame={frame}
        onReady={onReady}
        onContextLost={onContextLost}
        onContextRestored={onContextRestored}
      />,
    );

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeTruthy();
    await waitFor(() => {
      expect(onReady).toHaveBeenCalledTimes(1);
    });
    expect(onContextRestored).toHaveBeenCalledTimes(0);

    canvas?.dispatchEvent(new Event("webglcontextlost"));
    await waitFor(() => {
      expect(onContextLost).toHaveBeenCalledTimes(1);
    });
    expect(canvas?.tagName).toBe("CANVAS");
    expect(container.querySelector("canvas")).toBe(canvas);

    canvas?.dispatchEvent(new Event("webglcontextrestored"));
    await waitFor(() => {
      expect(onContextRestored).toHaveBeenCalledTimes(1);
      expect(onReady).toHaveBeenCalledTimes(2);
    });

    getContextSpy.mockRestore();
    probeSpy.mockRestore();
    frame.stop();
  });

  it("keeps hero DOM content when WebGL is not supported", async () => {
    const bus = new MotionBus();
    const fallbackFrame = new FrameCoordinator(bus);
    const probeSpy = vi.spyOn(WebGLCapability, "probe").mockReturnValue({
      supported: false,
      isWebGL2: false,
      reason: "forced-fallback",
    });

    const { getByText } = render(
      <>
        <GlobalWebGLStage frame={fallbackFrame} />
        <HeroSection
          section={{
            id: "hero",
            kind: "hero",
            title: "Hero Scene",
            tone: "default",
            intro: "Fallback safety check",
            order: 1,
            ctas: [],
          }}
        />
      </>,
    );

    await waitFor(() => {
      expect(getByText(/forced-fallback/)).toBeTruthy();
    });
    expect(getByText("Hero Scene")).toBeTruthy();

    probeSpy.mockRestore();
    fallbackFrame.stop();
  });

  it("pauses and resumes scheduler on page visibility changes", async () => {
    const bus = new MotionBus();
    const frame = new FrameCoordinator(bus);
    const probeSpy = vi.spyOn(WebGLCapability, "probe").mockReturnValue({
      supported: true,
      isWebGL2: false,
      reason: null,
    });
    const mockContext = createMockWebGLContext();
    const getContextSpy = vi
      .spyOn(HTMLCanvasElement.prototype, "getContext")
      .mockReturnValue(mockContext as unknown as WebGLRenderingContext);
    const startSpy = vi.spyOn(RenderScheduler.prototype, "start").mockReturnValue(undefined);
    const pauseSpy = vi.spyOn(RenderScheduler.prototype, "pause").mockImplementation(() => {
      return;
    });
    const resumeSpy = vi.spyOn(RenderScheduler.prototype, "resume").mockImplementation(() => {
      return;
    });

    const originalDescriptor = Object.getOwnPropertyDescriptor(document, "visibilityState");

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get() {
        return "visible";
      },
    });

    const { container } = render(<GlobalWebGLStage frame={frame} />);
    const canvas = container.querySelector("canvas");
    expect(canvas).toBeTruthy();
    await waitFor(() => {
      expect(startSpy).toHaveBeenCalled();
    });

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get() {
        return "hidden";
      },
    });
    document.dispatchEvent(new Event("visibilitychange"));

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get() {
        return "visible";
      },
    });
    document.dispatchEvent(new Event("visibilitychange"));

    expect(pauseSpy).toHaveBeenCalled();
    expect(resumeSpy).toHaveBeenCalled();

    startSpy.mockRestore();
    pauseSpy.mockRestore();
    resumeSpy.mockRestore();
    getContextSpy.mockRestore();
    probeSpy.mockRestore();
    if (originalDescriptor) {
      Object.defineProperty(document, "visibilityState", originalDescriptor);
    }
    frame.stop();
  });
});
