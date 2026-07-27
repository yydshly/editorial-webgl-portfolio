import { describe, expect, it, vi } from "vitest";

import WebGLCapability from "@/lib/webgl/WebGLCapability";

describe("WebGLCapability", () => {
  it("returns unsupported when webgl is unavailable", () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const result = WebGLCapability.probe();

    expect(result.supported).toBe(false);
    expect(result.reason).toContain("WebGL");
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it("detects webgl availability when canvas context exists", () => {
    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi
      .fn()
      .mockImplementation((contextId: string) =>
        contextId === "webgl2"
          ? {
              clearColor: vi.fn(),
              clear: vi.fn(),
              viewport: vi.fn(),
              COLOR_BUFFER_BIT: 16640,
            }
          : null,
      ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const result = WebGLCapability.probe();

    expect(result.supported).toBe(true);
    expect(result.reason).toBeNull();
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });
});
