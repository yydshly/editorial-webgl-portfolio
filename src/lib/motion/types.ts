export type Unsubscribe = () => void;

export type MotionFramePayload = {
  readonly frame: number;
  readonly timestamp: number;
  readonly delta: number;
  readonly elapsed: number;
};

export type MotionViewportPayload = {
  readonly width: number;
  readonly height: number;
  readonly scrollX: number;
  readonly scrollY: number;
  readonly devicePixelRatio: number;
  readonly isPortrait: boolean;
};

export type MotionPointerPayload = {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly prevX: number;
  readonly prevY: number;
  readonly dx: number;
  readonly dy: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly isDown: boolean;
};

export type MotionScrollPayload = {
  readonly scrollX: number;
  readonly scrollY: number;
  readonly velocity: number;
  readonly direction: -1 | 0 | 1;
  readonly source: "lenis" | "native";
  readonly timestamp: number;
};

export type MotionEventMap = {
  tick: MotionFramePayload;
  viewport: MotionViewportPayload;
  "pointer:move": MotionPointerPayload;
  scroll: MotionScrollPayload;
};

export type MotionEventName = keyof MotionEventMap;

export type MotionListener<T extends MotionEventName> = (
  payload: MotionEventMap[T],
) => void;
