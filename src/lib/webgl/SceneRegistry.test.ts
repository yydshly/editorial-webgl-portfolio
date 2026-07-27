import { describe, expect, it, vi } from "vitest";

import SceneRegistry from "@/lib/webgl/SceneRegistry";

describe("SceneRegistry", () => {
  it("stores scenes, supports preload/activate/deactivate/cache transitions and dominant handling", () => {
    const registry = new SceneRegistry();
    registry.register({ id: "hero", sceneType: "hero" });
    registry.register({ id: "about", sceneType: "about" });

    registry.preload("hero");
    expect(registry.getState("hero")?.resident).toBe(true);
    expect(registry.getState("hero")?.cached).toBe(false);

    registry.activate("hero");
    expect(registry.getState("hero")?.visible).toBe(true);
    expect(registry.getState("hero")?.updating).toBe(true);
    expect(registry.getState("hero")?.dominant).toBe(true);
    expect(registry.active).toBe("hero");

    registry.deactivate("hero");
    expect(registry.getState("hero")?.visible).toBe(false);
    expect(registry.getState("hero")?.cached).toBe(true);

    registry.cache("hero");
    expect(registry.getState("hero")?.cached).toBe(true);
    expect(registry.getState("hero")?.visible).toBe(false);
  });

  it("supports cached-to-active transition deterministically", () => {
    const registry = new SceneRegistry();
    registry.register({ id: "hero", sceneType: "hero" });
    registry.cache("hero");

    expect(registry.getState("hero")?.cached).toBe(true);
    expect(registry.getState("hero")?.visible).toBe(false);

    const activated = registry.activate("hero");
    expect(activated).toBe(true);
    expect(registry.getState("hero")?.cached).toBe(false);
    expect(registry.getState("hero")?.visible).toBe(true);
    expect(registry.getState("hero")?.updating).toBe(true);
  });

  it("keeps transition notifications complete and handles unsubscribe safety", () => {
    const registry = new SceneRegistry();
    registry.register({ id: "hero" });

    const listener = vi.fn();
    const unsub = registry.registerStateListener("hero", listener);

    registry.preload("hero");
    registry.activate("hero");
    registry.deactivate("hero");
    expect(listener).toHaveBeenCalledTimes(3);

    const transitions = listener.mock.calls.map((entry) => entry[0]);
    expect(transitions[1]).toMatchObject({
      id: "hero",
      reason: "activate",
    });
    expect(transitions[1].previous.visible).toBe(false);
    expect(transitions[1].next.visible).toBe(true);

    unsub();
    registry.cache("hero");
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("notifies dispose on unregister even after removal from map", () => {
    const registry = new SceneRegistry();
    registry.register({ id: "hero" });
    const listener = vi.fn();
    registry.registerStateListener("hero", listener);

    registry.unregister("hero");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "hero",
        reason: "unregister",
      }),
    );
    expect(registry.has("hero")).toBe(false);
  });
});
