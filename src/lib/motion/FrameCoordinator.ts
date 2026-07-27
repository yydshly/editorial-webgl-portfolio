import MotionBus from "./MotionBus";
import type { MotionFramePayload } from "./types";
import type { Unsubscribe } from "./types";

export type FramePhase =
  | "INPUT"
  | "STATE"
  | "MEASURE"
  | "ANIMATE"
  | "RENDER"
  | "POST";

type FrameTask = (payload: MotionFramePayload) => void;
type FrameLoop = (timestamp: number) => void;

type FrameTaskEntry = {
  readonly id: number;
  readonly priority: number;
  readonly task: FrameTask;
};

export type FrameRegistrationOptions = {
  priority?: number;
};

type FrameTaskRunner = {
  readonly id: number;
  readonly task: FrameTask;
  readonly priority: number;
};

const FRAME_PHASES: FramePhase[] = [
  "INPUT",
  "STATE",
  "MEASURE",
  "ANIMATE",
  "RENDER",
  "POST",
];

const MAX_DELTA_SECONDS = 0.1;
const MS_TO_SECONDS = 1 / 1000;

export default class FrameCoordinator {
  private frameCount = 0;
  private previousTimestamp = 0;
  private elapsed = 0;
  private rafId: number | null = null;
  private onFrame: FrameLoop | null = null;
  private running = false;
  private nextTaskId = 0;
  private readonly tasks = new Map<
    FramePhase,
    FrameTaskEntry[]
  >();

  constructor(private readonly bus: MotionBus) {}

  register(
    phase: FramePhase,
    task: FrameTask,
    options: FrameRegistrationOptions = {},
  ): Unsubscribe {
    const entry: FrameTaskEntry = {
      id: ++this.nextTaskId,
      task,
      priority: Number.isFinite(options.priority) ? options.priority ?? 0 : 0,
    };
    const current = this.tasks.get(phase);
    const next = current ? [...current, entry] : [entry];

    next.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }
      return a.id - b.id;
    });

    this.tasks.set(phase, next);

    return () => {
      const list = this.tasks.get(phase);
      if (!list) {
        return;
      }

      const index = list.findIndex((item) => item.id === entry.id);
      if (index === -1) {
        return;
      }

      list.splice(index, 1);
      if (list.length === 0) {
        this.tasks.delete(phase);
      }
    };
  }

  start(): void {
    if (this.rafId !== null || this.running) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    this.running = true;
    this.onFrame = (timestamp: number) => {
      if (!this.running || this.rafId === null) {
        return;
      }

      if (this.previousTimestamp === 0) {
        this.previousTimestamp = timestamp;
      }

      const rawDeltaSeconds = Math.max(
        0,
        (timestamp - this.previousTimestamp) * MS_TO_SECONDS,
      );
      const deltaSeconds = Math.min(rawDeltaSeconds, MAX_DELTA_SECONDS);
      const payload: MotionFramePayload = {
        frame: ++this.frameCount,
        timestamp,
        delta: deltaSeconds,
        elapsed: (this.elapsed += deltaSeconds),
      };

      for (const phase of FRAME_PHASES) {
        this.runPhase(phase, payload);
      }

      this.previousTimestamp = timestamp;
      this.rafId = window.requestAnimationFrame(this.onFrame!);
    };

    this.rafId = window.requestAnimationFrame(this.onFrame);
  }

  stop(): void {
    if (!this.running || this.rafId === null || typeof window === "undefined") {
      return;
    }

    this.running = false;
    window.cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.onFrame = null;
    this.previousTimestamp = 0;
  }

  reset(): void {
    this.stop();
    this.frameCount = 0;
    this.elapsed = 0;
    this.previousTimestamp = 0;
  }

  dispose(): void {
    this.stop();
    this.tasks.clear();
    this.nextTaskId = 0;
  }

  get isRunning(): boolean {
    return this.running;
  }

  private runPhase(phase: FramePhase, payload: MotionFramePayload): void {
    const taskEntries = this.tasks.get(phase);
    if (!taskEntries || taskEntries.length === 0) {
      if (phase === "STATE") {
        try {
          this.bus.emit("tick", payload);
        } catch {
          // bus-level errors should not crash scheduler
        }
      }
      if (phase === "STATE") {
        return;
      }
      return;
    }

    const runners: FrameTaskRunner[] = taskEntries.map((entry) => ({
      id: entry.id,
      task: entry.task,
      priority: entry.priority,
    }));

    for (const runner of runners) {
      try {
        runner.task(payload);
      } catch (error) {
        if (typeof console !== "undefined") {
          console.error("[FrameCoordinator] Phase callback error", error);
        }
      }
    }

    if (phase === "STATE") {
      try {
        this.bus.emit("tick", payload);
      } catch {
        // bus-level errors should not crash scheduler
      }
    }
  }
}
