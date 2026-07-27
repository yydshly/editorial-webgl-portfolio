import type {
  MotionEventMap,
  MotionEventName,
  MotionListener,
  Unsubscribe,
} from "./types";

type MotionListenerSet<T extends MotionEventName> = Set<MotionListener<T>>;

export default class MotionBus {
  private readonly listeners = new Map<
    MotionEventName,
    Set<(payload: unknown) => void>
  >();

  subscribe<T extends MotionEventName>(
    event: T,
    listener: MotionListener<T>,
  ): Unsubscribe {
    const typedSet = this.listeners.get(event) as
      | MotionListenerSet<T>
      | undefined;

    if (typedSet) {
      typedSet.add(listener);
    } else {
      this.listeners.set(event, new Set([listener as (payload: unknown) => void]));
    }

    return () => {
      const current = this.listeners.get(event) as
        | MotionListenerSet<T>
        | undefined;
      if (!current) return;
      current.delete(listener);

      if (current.size === 0) {
        this.listeners.delete(event);
      }
    };
  }

  emit<T extends MotionEventName>(event: T, payload: MotionEventMap[T]): void {
    const handlers = this.listeners.get(event) as
      | MotionListenerSet<T>
      | undefined;

    if (!handlers) {
      return;
    }

    for (const handler of [...handlers]) {
      (handler as MotionListener<T>)(payload);
    }
  }

  clear(): void {
    this.listeners.clear();
  }

  get listenerCount(): number {
    let total = 0;

    for (const handlers of this.listeners.values()) {
      total += handlers.size;
    }

    return total;
  }
}
