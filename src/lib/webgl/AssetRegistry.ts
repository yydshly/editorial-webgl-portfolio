import type { Unsubscribe } from "@/lib/motion/types";

export type AssetLifecycleState =
  | "dormant"
  | "loading"
  | "ready"
  | "error"
  | "disposed";

export type AssetDescriptor = {
  readonly id: string;
  readonly src: string;
  readonly kind?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type AssetLifecycleTransition = {
  readonly id: string;
  readonly previousState: AssetLifecycleState;
  readonly nextState: AssetLifecycleState;
};

export type AssetRegistrySnapshot = {
  readonly assets: readonly AssetDescriptor[];
  readonly total: number;
  readonly byState: Readonly<Record<AssetLifecycleState, number>>;
  readonly ownerCounts: Readonly<Record<string, number>>;
};

type AssetEntry<TData = unknown> = {
  readonly descriptor: AssetDescriptor;
  state: AssetLifecycleState;
  data?: TData;
  readonly createdAt: number;
  lastUpdatedAt: number;
  lastLoadedAt: number | null;
  loading?: Promise<unknown>;
  error?: string;
  readonly owners: Set<string>;
  pendingDispose: boolean;
};

type AssetLoader<TData> = (asset: AssetDescriptor) => Promise<TData>;

const stateOrder: ReadonlyArray<AssetLifecycleState> = [
  "dormant",
  "loading",
  "ready",
  "error",
  "disposed",
];

const OWNER_PREFIX = "owner:";

export default class AssetRegistry<TData = unknown> {
  private readonly entries = new Map<string, AssetEntry<TData>>();
  private readonly listeners = new Map<
    string,
    Set<(transition: AssetLifecycleTransition) => void>
  >();

  register(descriptor: AssetDescriptor, data?: TData): AssetDescriptor {
    const existing = this.entries.get(descriptor.id);
    if (existing) {
      return existing.descriptor;
    }

    const now = Date.now();
    this.entries.set(descriptor.id, {
      descriptor,
      state: "dormant",
      data,
      createdAt: now,
      lastUpdatedAt: now,
      lastLoadedAt: null,
      owners: new Set(),
      pendingDispose: false,
    });

    return descriptor;
  }

  unregister(id: string): boolean {
    const removed = this.entries.get(id);
    if (!removed) {
      return false;
    }

    const previousState = removed.state;
    this.entries.delete(id);
    this.listeners.delete(id);
    this.notify(id, previousState, "disposed");
    return true;
  }

  getDescriptor(id: string): AssetDescriptor | null {
    return this.entries.get(id)?.descriptor ?? null;
  }

  get(id: string): AssetDescriptor | null {
    return this.getDescriptor(id);
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  getState(id: string): AssetLifecycleState | null {
    return this.entries.get(id)?.state ?? null;
  }

  getData(id: string): TData | null {
    return this.entries.get(id)?.data ?? null;
  }

  getOwnerIds(id: string): readonly string[] {
    return Array.from(this.entries.get(id)?.owners ?? []);
  }

  acquire(ownerId: string, id: string): boolean {
    const entry = this.entries.get(id);
    if (!entry || entry.state === "disposed") {
      return false;
    }

    entry.owners.add(this.normalizeOwner(ownerId));
    if (entry.pendingDispose) {
      entry.pendingDispose = false;
    }

    return true;
  }

  release(ownerId: string, id: string): number {
    const entry = this.entries.get(id);
    if (!entry) {
      return 0;
    }

    entry.owners.delete(this.normalizeOwner(ownerId));
    const ownerCount = entry.owners.size;
    if (ownerCount === 0 && entry.pendingDispose) {
      this.dispose(id);
    }
    return ownerCount;
  }

  list(state?: AssetLifecycleState): readonly AssetDescriptor[] {
    if (!state) {
      return Array.from(this.entries.values())
        .sort((left, right) => left.createdAt - right.createdAt)
        .map((entry) => entry.descriptor);
    }

    return Array.from(this.entries.values())
      .filter((entry) => entry.state === state)
      .sort((left, right) => left.createdAt - right.createdAt)
      .map((entry) => entry.descriptor);
  }

  registerStateListener(
    id: string,
    listener: (transition: AssetLifecycleTransition) => void,
  ): Unsubscribe {
    const current = this.listeners.get(id);
    const next: Set<(transition: AssetLifecycleTransition) => void> = current
      ? new Set(current)
      : new Set();
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

  setState(id: string, state: AssetLifecycleState): boolean {
    const entry = this.entries.get(id);
    if (!entry) {
      return false;
    }

    const previous = entry.state;
    if (previous === state) {
      return true;
    }

    if (state === "loading" && previous === "disposed") {
      return false;
    }

    if (state === "disposed" && entry.owners.size > 0) {
      entry.pendingDispose = true;
      return false;
    }

    entry.state = state;
    entry.loading = state === "loading" ? entry.loading : undefined;
    entry.error = state === "loading" || state === "ready" ? undefined : entry.error;
    entry.lastUpdatedAt = Date.now();

    if (state === "disposed") {
      entry.data = undefined;
      entry.lastLoadedAt = null;
      entry.owners.clear();
      entry.pendingDispose = false;
    }

    this.notify(id, previous, state);
    return true;
  }

  preload<T>(id: string, loader: AssetLoader<T>): Promise<T> {
    return this.load(id, loader);
  }

  async load<T>(id: string, loader: AssetLoader<T>): Promise<T> {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new Error(`Asset with id "${id}" is not registered.`);
    }

    if (entry.state === "ready" && entry.data !== undefined) {
      return entry.data as T;
    }

    if (entry.state === "loading" && entry.loading) {
      return entry.loading as Promise<T>;
    }

    const task = loader(entry.descriptor)
      .then((loaded) => {
        const current = this.entries.get(id);
        if (!current) {
          return loaded;
        }

        const now = Date.now();
        current.state = "ready";
        current.data = loaded as unknown as TData;
        current.loading = undefined;
        current.error = undefined;
        current.lastLoadedAt = now;
        current.lastUpdatedAt = now;
        this.notify(id, "loading", "ready");
        return loaded;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "unknown";
        const current = this.entries.get(id);
        if (!current) {
          throw error;
        }

        current.state = "error";
        current.loading = undefined;
        current.error = message;
        current.lastUpdatedAt = Date.now();
        this.notify(id, "loading", "error");
        throw error;
      });

    entry.state = "loading";
    entry.loading = task as Promise<unknown>;
    entry.lastUpdatedAt = Date.now();
    this.notify(id, "ready", "loading");
    return task;
  }

  clear(): void {
    this.entries.clear();
    this.listeners.clear();
  }

  dispose(id: string): boolean {
    return this.setState(id, "disposed");
  }

  get snapshot(): AssetRegistrySnapshot {
    const byState = this.getStateCount();
    const ownerCounts: Record<string, number> = {};

    for (const [id, entry] of this.entries.entries()) {
      byState[entry.state] += 1;
      ownerCounts[id] = entry.owners.size;
    }

    return {
      assets: this.list(),
      total: this.entries.size,
      byState,
      ownerCounts,
    };
  }

  get count(): number {
    return this.entries.size;
  }

  private notify(
    id: string,
    previousState: AssetLifecycleState,
    nextState: AssetLifecycleState,
  ): void {
    const handlers = this.listeners.get(id);
    if (!handlers || handlers.size === 0) {
      return;
    }

    const payload: AssetLifecycleTransition = {
      id,
      previousState,
      nextState,
    };

    for (const handler of [...handlers]) {
      try {
        handler(payload);
      } catch (error) {
        if (typeof console !== "undefined") {
          console.error("[AssetRegistry] state listener error", error);
        }
      }
    }
  }

  private getStateCount(): Record<AssetLifecycleState, number> {
    return stateOrder.reduce(
      (acc, state) => {
        acc[state] = 0;
        return acc;
      },
      {} as Record<AssetLifecycleState, number>,
    );
  }

  private normalizeOwner(ownerId: string): string {
    const normalized = ownerId.trim();
    return normalized || `${OWNER_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
