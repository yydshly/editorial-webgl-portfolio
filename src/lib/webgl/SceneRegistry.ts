import type { Unsubscribe } from "@/lib/motion/types";

export type SceneLifecycleStateFlag =
  | "resident"
  | "visible"
  | "updating"
  | "dominant"
  | "cached"
  | "disposed";

export type SceneLifecycleState = Readonly<{
  readonly resident: boolean;
  readonly visible: boolean;
  readonly updating: boolean;
  readonly dominant: boolean;
  readonly cached: boolean;
  readonly disposed: boolean;
}>;

export type SceneLifecycleTransitionReason =
  | "register"
  | "preload"
  | "activate"
  | "deactivate"
  | "cache"
  | "dispose"
  | "unregister";

export type SceneLifecycleTransition = {
  readonly id: string;
  readonly reason: SceneLifecycleTransitionReason;
  readonly previous: SceneLifecycleState;
  readonly next: SceneLifecycleState;
  readonly timestamp: number;
};

export type SceneDescriptor = {
  readonly id: string;
  readonly sceneType?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type SceneRegistrySnapshot = {
  readonly scenes: readonly SceneDescriptor[];
  readonly total: number;
  readonly byState: Readonly<Record<SceneLifecycleStateFlag, number>>;
  readonly dominant: string | null;
  readonly active: string | null;
};

type SceneStateListener = (transition: SceneLifecycleTransition) => void;

type SceneEntry<TData = unknown> = {
  readonly descriptor: SceneDescriptor;
  readonly data?: TData;
  readonly createdAt: number;
  state: SceneLifecycleState;
  lastUpdatedAt: number;
  lastActivatedAt: number | null;
};

const EMPTY_STATE: SceneLifecycleState = {
  resident: false,
  visible: false,
  updating: false,
  dominant: false,
  cached: false,
  disposed: false,
};

const DISPOSED_STATE: SceneLifecycleState = {
  resident: false,
  visible: false,
  updating: false,
  dominant: false,
  cached: false,
  disposed: true,
};

const STATE_KEYS: SceneLifecycleStateFlag[] = [
  "resident",
  "visible",
  "updating",
  "dominant",
  "cached",
  "disposed",
];

type SetStateOptions = {
  readonly exclusiveDominant?: boolean;
};

export default class SceneRegistry<TData = unknown> {
  private readonly entries = new Map<string, SceneEntry<TData>>();
  private readonly listeners = new Map<string, Set<SceneStateListener>>();

  register(descriptor: SceneDescriptor, data?: TData): SceneDescriptor {
    const existing = this.entries.get(descriptor.id);
    if (existing) {
      return existing.descriptor;
    }

    const now = Date.now();
    const entry: SceneEntry<TData> = {
      descriptor,
      data,
      state: EMPTY_STATE,
      createdAt: now,
      lastUpdatedAt: now,
      lastActivatedAt: null,
    };

    this.entries.set(descriptor.id, entry);
    this.notify(descriptor.id, DISPOSED_STATE, EMPTY_STATE, "register");
    return entry.descriptor;
  }

  unregister(id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry) {
      return false;
    }

    this.entries.delete(id);
    this.notify(id, entry.state, DISPOSED_STATE, "unregister");
    this.listeners.delete(id);
    return true;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  getDescriptor(id: string): SceneDescriptor | null {
    return this.entries.get(id)?.descriptor ?? null;
  }

  get(id: string): SceneDescriptor | null {
    return this.getDescriptor(id);
  }

  getState(id: string): SceneLifecycleState | null {
    const entry = this.entries.get(id);
    return entry ? this.cloneState(entry.state) : null;
  }

  preload(id: string): boolean {
    return this.setState(
      id,
      {
        resident: true,
      },
      "preload",
    );
  }

  activate(id: string, strategy: "replace" | "overlap" = "replace"): boolean {
    const hasDominant = this.list("dominant").length > 0;
    return this.setState(
      id,
      {
        resident: true,
        visible: true,
        cached: false,
        dominant: strategy === "replace" || !hasDominant,
      },
      "activate",
      { exclusiveDominant: strategy === "replace" },
    );
  }

  deactivate(id: string): boolean {
    return this.setState(
      id,
      {
        visible: false,
        updating: false,
        dominant: false,
        cached: true,
      },
      "deactivate",
    );
  }

  cache(id: string): boolean {
    return this.setState(
      id,
      {
        resident: true,
        visible: false,
        updating: false,
        dominant: false,
        cached: true,
      },
      "cache",
    );
  }

  dispose(id: string): boolean {
    return this.setState(
      id,
      DISPOSED_STATE,
      "dispose",
    );
  }

  get dominantScene(): string | null {
    return this.list("dominant")[0]?.id ?? null;
  }

  get active(): string | null {
    return this.dominantScene;
  }

  list(state?: SceneLifecycleStateFlag): readonly SceneDescriptor[] {
    if (!state) {
      return this.listByFilter();
    }
    return this.listByFilter(state);
  }

  registerStateListener(id: string, listener: SceneStateListener): Unsubscribe {
    const current = this.listeners.get(id);
    const next: Set<SceneStateListener> = current ? new Set(current) : new Set<SceneStateListener>();
    next.add(listener);
    this.listeners.set(id, next);

    return () => {
      const handlers = this.listeners.get(id);
      if (!handlers) {
        return;
      }
      handlers.delete(listener);
      if (handlers.size === 0) {
        this.listeners.delete(id);
      }
    };
  }

  get snapshot(): SceneRegistrySnapshot {
    const byState = this.getStateCount();
    for (const entry of this.entries.values()) {
      if (entry.state.resident) {
        byState.resident += 1;
      }
      if (entry.state.visible) {
        byState.visible += 1;
      }
      if (entry.state.updating) {
        byState.updating += 1;
      }
      if (entry.state.dominant) {
        byState.dominant += 1;
      }
      if (entry.state.cached) {
        byState.cached += 1;
      }
      if (entry.state.disposed) {
        byState.disposed += 1;
      }
    }

    return {
      scenes: this.listByFilter(),
      total: this.entries.size,
      byState,
      dominant: this.dominantScene,
      active: this.dominantScene,
    };
  }

  get count(): number {
    return this.entries.size;
  }

  clear(): void {
    const entries = Array.from(this.entries.values());
    this.entries.clear();
    this.listeners.clear();

    for (const entry of entries) {
      this.notify(entry.descriptor.id, entry.state, DISPOSED_STATE, "unregister");
    }
  }

  private setState(
    id: string,
    patch: Partial<SceneLifecycleState>,
    reason: SceneLifecycleTransitionReason,
    options: SetStateOptions = {},
  ): boolean {
    const entry = this.entries.get(id);
    if (!entry) {
      return false;
    }

    const previous = this.cloneState(entry.state);
    const next = this.normalizeState({ ...previous, ...patch });

    if (!this.isTransitionAllowed(previous, next)) {
      return false;
    }

    if (
      previous.resident === next.resident &&
      previous.visible === next.visible &&
      previous.updating === next.updating &&
      previous.dominant === next.dominant &&
      previous.cached === next.cached &&
      previous.disposed === next.disposed
    ) {
      return true;
    }

    if (options.exclusiveDominant && next.dominant) {
      this.demoteDominantScenes(id);
    }

    this.entries.set(id, {
      ...entry,
      state: next,
      lastUpdatedAt: Date.now(),
      lastActivatedAt: next.dominant ? Date.now() : entry.lastActivatedAt,
    });

    this.notify(id, previous, next, reason);
    return true;
  }

  private demoteDominantScenes(nextDominantId: string): void {
    for (const [id, entry] of this.entries.entries()) {
      if (id === nextDominantId || !entry.state.dominant) {
        continue;
      }

      const previous = this.cloneState(entry.state);
      const next = this.normalizeState({ ...entry.state, dominant: false });
      this.entries.set(id, {
        ...entry,
        state: next,
        lastUpdatedAt: Date.now(),
      });
      this.notify(id, previous, next, "deactivate");
    }
  }

  private normalizeState(candidate: SceneLifecycleState): SceneLifecycleState {
    if (candidate.disposed) {
      return DISPOSED_STATE;
    }

    if (!candidate.resident) {
      return EMPTY_STATE;
    }

    if (candidate.cached) {
      return {
        resident: true,
        visible: false,
        updating: false,
        dominant: false,
        cached: true,
        disposed: false,
      };
    }

    if (!candidate.visible) {
      return {
        resident: true,
        visible: false,
        updating: false,
        dominant: false,
        cached: false,
        disposed: false,
      };
    }

    return {
      resident: true,
      visible: true,
      updating: true,
      dominant: candidate.dominant,
      cached: false,
      disposed: false,
    };
  }

  private isTransitionAllowed(
    previous: SceneLifecycleState,
    next: SceneLifecycleState,
  ): boolean {
    if (previous.disposed) {
      return false;
    }

    if (!next.resident && (next.visible || next.updating || next.dominant || next.cached)) {
      return false;
    }

    if (next.visible === false && next.updating) {
      return false;
    }

    if (next.dominant && (!next.visible || !next.updating)) {
      return false;
    }

    return true;
  }

  private listByFilter(state?: SceneLifecycleStateFlag): SceneDescriptor[] {
    const sorted = Array.from(this.entries.values()).sort((left, right) => left.createdAt - right.createdAt);

    if (!state) {
      return sorted.map((entry) => entry.descriptor);
    }

    return sorted
      .filter((entry) => entry.state[state])
      .map((entry) => entry.descriptor);
  }

  private notify(
    id: string,
    previous: SceneLifecycleState,
    next: SceneLifecycleState,
    reason: SceneLifecycleTransitionReason,
  ): void {
    const handlers = this.listeners.get(id);
    if (!handlers || handlers.size === 0) {
      return;
    }

    const payload: SceneLifecycleTransition = {
      id,
      reason,
      previous: this.cloneState(previous),
      next: this.cloneState(next),
      timestamp: Date.now(),
    };

    for (const handler of [...handlers]) {
      try {
        handler(payload);
      } catch (error) {
        if (typeof console !== "undefined") {
          console.error("[SceneRegistry] state listener error", error);
        }
      }
    }
  }

  private getStateCount(): Record<SceneLifecycleStateFlag, number> {
    return STATE_KEYS.reduce(
      (acc, state) => {
        acc[state] = 0;
        return acc;
      },
      {} as Record<SceneLifecycleStateFlag, number>,
    );
  }

  private cloneState(state: SceneLifecycleState): SceneLifecycleState {
    return {
      resident: state.resident,
      visible: state.visible,
      updating: state.updating,
      dominant: state.dominant,
      cached: state.cached,
      disposed: state.disposed,
    };
  }
}
