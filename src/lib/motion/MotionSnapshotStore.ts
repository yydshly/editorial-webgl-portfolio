import type {
  MotionFramePayload,
  MotionPointerPayload,
  MotionScrollPayload,
  MotionViewportPayload,
} from "./types";

export type MotionSnapshotScroll = {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly velocity: number;
  readonly direction: -1 | 0 | 1;
  readonly source: "lenis" | "native";
  readonly timestamp: number;
};

export type MotionSnapshotViewport = MotionViewportPayload;

export type MotionSnapshotPointer = Readonly<MotionPointerPayload>;

export type MotionSnapshotFrame = MotionFramePayload;

export type MotionSnapshotState = {
  readonly frame: MotionSnapshotFrame;
  readonly scroll: MotionSnapshotScroll;
  readonly viewport: MotionSnapshotViewport;
  readonly pointer: MotionSnapshotPointer;
  readonly reducedMotion: boolean;
};

type MotionSnapshotData = {
  frame: MotionSnapshotFrame;
  scroll: MotionSnapshotScroll;
  viewport: MotionSnapshotViewport;
  pointer: MotionSnapshotPointer;
  reducedMotion: boolean;
};

const DEFAULT_FRAME: MotionSnapshotFrame = {
  frame: 0,
  timestamp: 0,
  delta: 0,
  elapsed: 0,
};

const DEFAULT_SCROLL: MotionSnapshotScroll = {
  scrollX: 0,
  scrollY: 0,
  velocity: 0,
  direction: 0,
  source: "native",
  timestamp: 0,
};

const DEFAULT_VIEWPORT: MotionSnapshotViewport = {
  width: 0,
  height: 0,
  scrollX: 0,
  scrollY: 0,
  devicePixelRatio: 1,
  isPortrait: false,
};

const DEFAULT_POINTER: MotionSnapshotPointer = {
  id: -1,
  x: 0,
  y: 0,
  prevX: 0,
  prevY: 0,
  dx: 0,
  dy: 0,
  velocityX: 0,
  velocityY: 0,
  isDown: false,
};

export default class MotionSnapshotStore {
  private data: MotionSnapshotData = {
    frame: { ...DEFAULT_FRAME },
    scroll: { ...DEFAULT_SCROLL },
    viewport: { ...DEFAULT_VIEWPORT },
    pointer: { ...DEFAULT_POINTER },
    reducedMotion: false,
  };

  getSnapshot(): MotionSnapshotState {
    return {
      frame: { ...this.data.frame },
      scroll: { ...this.data.scroll },
      viewport: { ...this.data.viewport },
      pointer: { ...this.data.pointer },
      reducedMotion: this.data.reducedMotion,
    };
  }

  get frame(): MotionSnapshotFrame {
    return this.getSnapshot().frame;
  }

  get scroll(): MotionSnapshotScroll {
    return this.getSnapshot().scroll;
  }

  get viewport(): MotionSnapshotViewport {
    return this.getSnapshot().viewport;
  }

  get pointer(): MotionSnapshotPointer {
    return this.getSnapshot().pointer;
  }

  get reducedMotion(): boolean {
    return this.data.reducedMotion;
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.data.reducedMotion = reducedMotion;
  }

  updateFrame(payload: MotionFramePayload): void {
    this.data.frame = {
      frame: payload.frame,
      timestamp: payload.timestamp,
      delta: payload.delta,
      elapsed: payload.elapsed,
    };
  }

  updateScroll(payload: MotionScrollPayload): void {
    this.data.scroll = {
      scrollX: payload.scrollX,
      scrollY: payload.scrollY,
      velocity: payload.velocity,
      direction: payload.direction,
      source: payload.source,
      timestamp: payload.timestamp,
    };
  }

  updateViewport(payload: MotionViewportPayload): void {
    this.data.viewport = {
      width: payload.width,
      height: payload.height,
      scrollX: payload.scrollX,
      scrollY: payload.scrollY,
      devicePixelRatio: payload.devicePixelRatio,
      isPortrait: payload.isPortrait,
    };
  }

  updatePointer(payload: MotionPointerPayload): void {
    this.data.pointer = {
      id: payload.id,
      x: payload.x,
      y: payload.y,
      prevX: payload.prevX,
      prevY: payload.prevY,
      dx: payload.dx,
      dy: payload.dy,
      velocityX: payload.velocityX,
      velocityY: payload.velocityY,
      isDown: payload.isDown,
    };
  }
}
