import type { Unsubscribe } from "@/lib/motion/types";
import type FrameCoordinator from "@/lib/motion/FrameCoordinator";
import type { MotionFramePayload } from "@/lib/motion/types";
import {
  DEFAULT_PERFORMANCE_TIER,
  PERFORMANCE_TIER,
  resolveFrameDivisor,
  type PerformanceTier,
} from "@/lib/webgl/PerformanceTier";

export type RenderTask = (payload: MotionFramePayload) => void;

export type RenderTaskOptions = {
  readonly priority?: number;
};

export type RenderSchedulerHandle = {
  readonly id: number;
  readonly task: RenderTask;
  readonly priority: number;
};

export default class RenderScheduler {
  private readonly tasks = new Map<number, RenderTask>();
  private readonly priorities = new Map<number, number>();
  private nextTaskId = 0;
  private registered = false;
  private paused = false;
  private frameRuntimeUnsubscribe: Unsubscribe | null = null;
  private frameDivisor = 1;
  private performanceTier: PerformanceTier = DEFAULT_PERFORMANCE_TIER;
  private lowUpdateMode = false;
  private lowUpdateMultiplier = 2;

  constructor(private readonly frame: FrameCoordinator) {
    this.setPerformanceTier(DEFAULT_PERFORMANCE_TIER);
  }

  start(): void {
    if (this.registered) {
      return;
    }

    this.registered = true;
    this.frameRuntimeUnsubscribe = this.frame.register(
      "RENDER",
      (payload) => {
        this.tick(payload);
      },
    );
  }

  stop(): void {
    if (!this.registered) {
      return;
    }

    this.registered = false;
    this.frameRuntimeUnsubscribe?.();
    this.frameRuntimeUnsubscribe = null;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
  }

  setLowUpdateMode(enabled: boolean, divisor = 2): void {
    this.lowUpdateMode = enabled;
    this.lowUpdateMultiplier = Math.max(1, Math.floor(divisor));
  }

  setPerformanceTier(tier: PerformanceTier): void {
    this.performanceTier = tier;
    this.frameDivisor = resolveFrameDivisor(tier);
  }

  register(task: RenderTask, options: RenderTaskOptions = {}): Unsubscribe {
    const id = ++this.nextTaskId;
    this.tasks.set(id, task);
    this.priorities.set(id, Number.isFinite(options.priority) ? options.priority ?? 0 : 0);

    return () => {
      this.tasks.delete(id);
      this.priorities.delete(id);
    };
  }

  get isRunning(): boolean {
    return this.registered;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get isLowUpdateMode(): boolean {
    return this.lowUpdateMode;
  }

  get tier(): PerformanceTier {
    return this.performanceTier;
  }

  get profile() {
    return PERFORMANCE_TIER[this.performanceTier];
  }

  dispose(): void {
    this.stop();
    this.tasks.clear();
    this.priorities.clear();
    this.nextTaskId = 0;
    this.paused = false;
  }

  private tick(payload: MotionFramePayload): void {
    if (this.paused) {
      return;
    }

    const divisor = this.effectiveDivisor();
    if (divisor > 1 && payload.frame % divisor !== 0) {
      return;
    }

    const handles = this.orderedTasks();
    for (const handle of handles) {
      try {
        handle.task(payload);
      } catch (error) {
        if (typeof console !== "undefined") {
          console.error("[RenderScheduler] task error", error);
        }
      }
    }
  }

  private orderedTasks(): RenderSchedulerHandle[] {
    const result: RenderSchedulerHandle[] = [];
    for (const id of this.tasks.keys()) {
      const task = this.tasks.get(id);
      const priority = this.priorities.get(id) ?? 0;
      if (task) {
        result.push({ id, task, priority });
      }
    }

    return result.sort((left, right) => {
      if (left.priority !== right.priority) {
        return right.priority - left.priority;
      }
      return left.id - right.id;
    });
  }

  private effectiveDivisor(): number {
    const baseDivisor = this.frameDivisor || 1;
    if (!this.lowUpdateMode) {
      return baseDivisor;
    }
    return Math.max(baseDivisor, this.lowUpdateMultiplier);
  }
}
