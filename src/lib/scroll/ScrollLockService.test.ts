import { describe, expect, it } from "vitest";

import ScrollLockService from "@/lib/scroll/ScrollLockService";

describe("ScrollLockService", () => {
  it("supports nested acquire/release and notifies subscribers", () => {
    const service = new ScrollLockService();
    const states: boolean[] = [];

    const unsubscribe = service.subscribe((locked) => {
      states.push(locked);
    });

    const releaseFirst = service.acquire();
    const releaseSecond = service.acquire();

    expect(service.isLocked).toBe(true);
    expect(states).toEqual([false, true, true]);

    releaseFirst();
    expect(service.isLocked).toBe(true);
    expect(states).toEqual([false, true, true, true]);

    releaseSecond();
    expect(service.isLocked).toBe(false);
    expect(states).toEqual([false, true, true, true, false]);

    unsubscribe();
    service.acquire();
    expect(states).toEqual([false, true, true, true, false]);
  });
});
