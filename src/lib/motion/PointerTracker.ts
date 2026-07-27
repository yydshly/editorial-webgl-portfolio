import MotionBus from "./MotionBus";
import type { MotionPointerPayload } from "./types";

type PointerData = {
  readonly id: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  lastUpdatedAt: number;
  isDown: boolean;
};

type PointerEventLike = {
  readonly clientX: number;
  readonly clientY: number;
  readonly pointerId?: number;
  readonly type?: string;
};

export default class PointerTracker {
  private connected = false;
  private pointer: PointerData = {
    id: -1,
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    lastUpdatedAt: 0,
    isDown: false,
  };
  private readonly unsubscribeFns: Array<() => void> = [];

  constructor(private readonly bus: MotionBus) {}

  connect(): void {
    if (this.connected || typeof window === "undefined") {
      return;
    }

    this.connected = true;

    window.addEventListener("pointermove", this.handleMove);
    window.addEventListener("pointerdown", this.handleDown);
    window.addEventListener("pointerup", this.handleUp);
    window.addEventListener("pointerleave", this.handleUp);
    window.addEventListener("mouseout", this.handleMouseOut);

    this.unsubscribeFns.push(() =>
      window.removeEventListener("pointermove", this.handleMove),
    );
    this.unsubscribeFns.push(() =>
      window.removeEventListener("pointerdown", this.handleDown),
    );
    this.unsubscribeFns.push(() =>
      window.removeEventListener("pointerup", this.handleUp),
    );
    this.unsubscribeFns.push(() =>
      window.removeEventListener("pointerleave", this.handleUp),
    );
    this.unsubscribeFns.push(() =>
      window.removeEventListener("mouseout", this.handleMouseOut),
    );
  }

  disconnect(): void {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    this.unsubscribeFns.splice(0).forEach((unsubscribe) => unsubscribe());
    this.unsubscribeFns.length = 0;
  }

  dispose(): void {
    this.disconnect();
  }

  getState(): Readonly<MotionPointerPayload> {
    return {
      id: this.pointer.id,
      x: this.pointer.x,
      y: this.pointer.y,
      prevX: this.pointer.prevX,
      prevY: this.pointer.prevY,
      dx: this.pointer.x - this.pointer.prevX,
      dy: this.pointer.y - this.pointer.prevY,
      velocityX: 0,
      velocityY: 0,
      isDown: this.pointer.isDown,
    };
  }

  private handleMove = (event: PointerEvent): void => {
    const payload = this.normalizePointerEvent(event);
    const now = performance.now();
    const dt = Math.max(1, now - this.pointer.lastUpdatedAt);

    this.pointer = {
      id: payload.id,
      x: payload.x,
      y: payload.y,
      prevX: this.pointer.x,
      prevY: this.pointer.y,
      isDown: this.pointer.isDown,
      lastUpdatedAt: now,
    };

    const dx = this.pointer.x - this.pointer.prevX;
    const dy = this.pointer.y - this.pointer.prevY;

    this.bus.emit("pointer:move", {
      id: this.pointer.id,
      x: this.pointer.x,
      y: this.pointer.y,
      prevX: this.pointer.prevX,
      prevY: this.pointer.prevY,
      dx,
      dy,
      velocityX: dx / dt,
      velocityY: dy / dt,
      isDown: this.pointer.isDown,
    });
  };

  private handleDown = (event: PointerEvent): void => {
    this.pointer.isDown = true;
    this.handleMove(event);
  };

  private handleUp = (): void => {
    this.pointer.isDown = false;
  };

  private handleMouseOut = (): void => {
    this.pointer.isDown = false;
  };

  private normalizePointerEvent(event: PointerEventLike): {
    readonly id: number;
    readonly x: number;
    readonly y: number;
  } {
    return {
      id: event.pointerId ?? -1,
      x: event.clientX,
      y: event.clientY,
    };
  }
}
