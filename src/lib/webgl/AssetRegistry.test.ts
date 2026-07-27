import { describe, expect, it, vi } from "vitest";

import AssetRegistry from "@/lib/webgl/AssetRegistry";

describe("AssetRegistry", () => {
  it("registers manifest and deduplicates load calls", async () => {
    const registry = new AssetRegistry<string>();
    const loadSpy = vi.fn().mockResolvedValue("payload");

    registry.register({ id: "hero-image", src: "/hero.png", kind: "image" });

    const first = registry.load("hero-image", loadSpy);
    const second = registry.load("hero-image", loadSpy);

    await expect(first).resolves.toBe("payload");
    await expect(second).resolves.toBe("payload");
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(registry.getState("hero-image")).toBe("ready");
    expect(registry.getData("hero-image")).toBe("payload");
    expect(registry.snapshot.byState.ready).toBe(1);
  });

  it("tracks owner leases and supports pending dispose", () => {
    const registry = new AssetRegistry<string>();
    registry.register({ id: "hero-image", src: "/hero.png", kind: "image" });

    const firstAcquire = registry.acquire("hero", "hero-image");
    const secondAcquire = registry.acquire("hero", "hero-image");
    expect(firstAcquire).toBe(true);
    expect(secondAcquire).toBe(true);
    expect(registry.getOwnerIds("hero-image")).toEqual(["hero"]);
    expect(registry.snapshot.ownerCounts["hero-image"]).toBe(1);

    expect(registry.release("hero", "hero-image")).toBe(0);
    expect(registry.getOwnerIds("hero-image")).toEqual([]);
    expect(registry.getState("hero-image")).toBe("dormant");

    expect(registry.release("hero", "hero-image")).toBe(0);
  });

  it("keeps listener notifications for load state transitions", async () => {
    const registry = new AssetRegistry<string>();
    const listener = vi.fn();
    registry.register({ id: "hero-json", src: "/hero.json" });
    registry.registerStateListener("hero-json", listener);

    expect(registry.getState("hero-json")).toBe("dormant");
    registry.setState("hero-json", "loading");
    registry.setState("hero-json", "error");

    expect(listener).toHaveBeenCalledWith({
      id: "hero-json",
      previousState: "loading",
      nextState: "error",
    });
    expect(registry.getState("hero-json")).toBe("error");
  });
});
