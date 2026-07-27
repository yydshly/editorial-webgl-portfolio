import { describe, expect, it, vi } from "vitest";

import GPUResourceManager from "@/lib/webgl/GPUResourceManager";

describe("GPUResourceManager", () => {
  it("leases resources and tracks ownership references", () => {
    const createTexture = vi.fn(() => ({} as unknown as WebGLTexture));
    const disposeTexture = vi.fn();
    const context = {
      createTexture,
      deleteTexture: disposeTexture,
    } as unknown as WebGLRenderingContext;

    const manager = new GPUResourceManager();
    manager.setContext(context);

    const textureA = manager.acquireTexture(
      "hero-portrait",
      "hero",
      () => context.createTexture(),
    );
    expect(textureA).toBeTruthy();
    const textureB = manager.acquireTexture(
      "hero-portrait",
      "hero:overlay",
      () => context.createTexture(),
    );

    expect(textureB).toBe(textureA);
    expect(createTexture).toHaveBeenCalledTimes(1);
    expect(manager.snapshot.ownerCounts["texture:hero-portrait"]).toBe(2);

    const remainingAfterFirstRelease = manager.releaseTexture("hero-portrait", "hero");
    expect(remainingAfterFirstRelease).toBe(1);
    const remainingAfterSecondRelease = manager.releaseTexture("hero-portrait", "hero:overlay");
    expect(remainingAfterSecondRelease).toBe(0);
    expect(disposeTexture).toHaveBeenCalledTimes(1);
  });

  it("supports context restore by recreating resources on demand", () => {
    const createTexture = vi.fn(() => ({} as unknown as WebGLTexture));
    const contextOne = {
      createTexture,
      deleteTexture: vi.fn(),
    } as unknown as WebGLRenderingContext;
    const contextTwo = {
      createTexture,
      deleteTexture: vi.fn(),
    } as unknown as WebGLRenderingContext;
    const manager = new GPUResourceManager();
    manager.setContext(contextOne);

    const first = manager.acquireTexture("hero-portrait", "hero", () => contextOne.createTexture());
    expect(first).toBeTruthy();
    expect(createTexture).toHaveBeenCalledTimes(1);

    manager.handleContextLost();
    manager.restore(contextTwo);

    const second = manager.acquireTexture("hero-portrait", "hero", () => contextTwo.createTexture());
    expect(second).toBeTruthy();
    expect(createTexture).toHaveBeenCalledTimes(2);
  });
});
