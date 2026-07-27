import MotionBus from "./MotionBus";
import type { MotionViewportPayload } from "./types";

export default class ViewportService {
  private readonly listeners: Array<() => void> = [];
  private state: MotionViewportPayload = {
    width: 0,
    height: 0,
    scrollX: 0,
    scrollY: 0,
    devicePixelRatio: 1,
    isPortrait: false,
  };

  private connected = false;

  constructor(private readonly bus: MotionBus) {}

  connect(): void {
    if (this.connected || typeof window === "undefined") {
      return;
    }

    this.connected = true;
    this.publishState();

    this.listeners.push(() =>
      window.removeEventListener("resize", this.handleViewportUpdate),
    );
    this.listeners.push(() =>
      window.removeEventListener("scroll", this.handleViewportUpdate),
    );
    this.listeners.push(() => {
      window.removeEventListener("orientationchange", this.handleViewportUpdate);
    });

    window.addEventListener("resize", this.handleViewportUpdate);
    window.addEventListener("scroll", this.handleViewportUpdate);
    window.addEventListener("orientationchange", this.handleViewportUpdate);
  }

  disconnect(): void {
    if (!this.connected) {
      return;
    }

    this.connected = false;
    this.listeners.splice(0).forEach((unsubscribe) => unsubscribe());
    this.listeners.length = 0;
  }

  dispose(): void {
    this.disconnect();
  }

  getState(): MotionViewportPayload {
    return this.state;
  }

  private handleViewportUpdate = (): void => {
    this.publishState();
  };

  private publishState(): void {
    if (typeof window === "undefined") {
      return;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const dpr = window.devicePixelRatio || 1;

    this.state = {
      width,
      height,
      scrollX,
      scrollY,
      devicePixelRatio: dpr,
      isPortrait: width < height,
    };

    this.bus.emit("viewport", this.state);
  }
}
