import type { Unsubscribe } from "@/lib/motion/types";

type LockListener = (locked: boolean) => void;

export default class ScrollLockService {
  private lockCount = 0;
  private readonly listeners = new Set<LockListener>();

  acquire(): Unsubscribe {
    this.lockCount += 1;
    this.emit();

    let released = false;
    return () => {
      if (released) {
        return;
      }

      released = true;
      this.release(1);
    };
  }

  private release(count = 1): void {
    this.lockCount = Math.max(0, this.lockCount - count);
    this.emit();
  }

  subscribe(listener: LockListener): Unsubscribe {
    this.listeners.add(listener);
    listener(this.isLocked);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get isLocked(): boolean {
    return this.lockCount > 0;
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.isLocked);
    }
  }
}
