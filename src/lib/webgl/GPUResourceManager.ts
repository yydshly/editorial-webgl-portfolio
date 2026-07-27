import * as THREE from "three";

const OWNER_PREFIX = "owner:";

type ResourceFactory = (context: WebGLRenderingContext) => unknown;
type ResourceDisposer = (resource: unknown, context: WebGLRenderingContext | null) => void;

type ResourceRecord = {
  readonly factory: ResourceFactory;
  readonly dispose: ResourceDisposer;
  readonly owners: Set<string>;
  resource: unknown | null;
};

type Geometry = THREE.BufferGeometry;
type Material = THREE.Material;

export type GPUResourceKind = "texture" | "geometry" | "material";

export type GPUResourceSnapshot = {
  readonly total: number;
  readonly byKind: Readonly<Record<GPUResourceKind, number>>;
  readonly ownerCounts: Readonly<Record<string, number>>;
};

export default class GPUResourceManager {
  private readonly textures = new Map<string, ResourceRecord>();
  private readonly geometries = new Map<string, ResourceRecord>();
  private readonly materials = new Map<string, ResourceRecord>();
  private context: WebGLRenderingContext | null = null;

  setContext(context: WebGLRenderingContext | null): void {
    if (this.context === context) {
      return;
    }

    if (this.context && this.context !== context) {
      this.disposeAllResources(this.context);
    }

    this.context = context;

    if (!context) {
      this.disposeAllResources(context);
    }
  }

  handleContextLost(): void {
    this.setContext(null);
  }

  restore(context: WebGLRenderingContext): void {
    this.setContext(context);
  }

  acquireTexture(
    id: string,
    ownerId: string,
    factory: (context: WebGLRenderingContext) => WebGLTexture,
    dispose?: ResourceDisposer,
  ): WebGLTexture | null;
  acquireTexture<T extends THREE.Texture>(
    id: string,
    ownerId: string,
    factory: (context: WebGLRenderingContext) => T,
    dispose: ResourceDisposer,
  ): T | null;
  acquireTexture<T extends WebGLTexture | THREE.Texture>(
    id: string,
    ownerId: string,
    factory: (context: WebGLRenderingContext) => T,
    dispose: ResourceDisposer = (resource, currentContext) => {
      if (currentContext) {
        currentContext.deleteTexture(resource as WebGLTexture);
      }
    },
  ): T | null {
    const resource = this.acquire(this.textures, id, ownerId, factory, dispose);
    return resource as T | null;
  }

  releaseTexture(id: string, ownerId: string): number {
    return this.release(this.textures, "texture", id, ownerId);
  }

  ownsTextureResource(
    id: string,
    resource: WebGLTexture | THREE.Texture | null,
  ): boolean {
    return Boolean(resource) && this.textures.get(id)?.resource === resource;
  }

  acquireGeometry<T extends Geometry>(
    id: string,
    ownerId: string,
    factory: (context: WebGLRenderingContext) => T,
    dispose: ResourceDisposer = (resource) => {
      (resource as Geometry).dispose();
    },
  ): T | null {
    return this.acquire(this.geometries, id, ownerId, factory, dispose) as T | null;
  }

  releaseGeometry(id: string, ownerId: string): number {
    return this.release(this.geometries, "geometry", id, ownerId);
  }

  acquireMaterial<T extends Material>(
    id: string,
    ownerId: string,
    factory: (context: WebGLRenderingContext) => T,
    dispose: ResourceDisposer = (resource) => {
      (resource as Material).dispose();
    },
  ): T | null {
    return this.acquire(this.materials, id, ownerId, factory, dispose) as T | null;
  }

  releaseMaterial(id: string, ownerId: string): number {
    return this.release(this.materials, "material", id, ownerId);
  }

  releaseOwner(ownerId: string): number {
    const owner = this.normalizeOwner(ownerId);
    let totalRemainingOwners = 0;

    const releaseFrom = (records: Map<string, ResourceRecord>, kind: GPUResourceKind): void => {
      for (const [, record] of records.entries()) {
        record.owners.delete(owner);
        totalRemainingOwners += record.owners.size;

        if (record.owners.size === 0 && record.resource) {
          this.disposeResource(kind, this.context, record);
          record.resource = null;
        }
      }
    };

    releaseFrom(this.textures, "texture");
    releaseFrom(this.geometries, "geometry");
    releaseFrom(this.materials, "material");

    return totalRemainingOwners;
  }

  get snapshot(): GPUResourceSnapshot {
    const byKind: Record<GPUResourceKind, number> = {
      texture: 0,
      geometry: 0,
      material: 0,
    };

    const ownerCounts: Record<string, number> = {};

    for (const [id, entry] of this.textures.entries()) {
      byKind.texture += 1;
      ownerCounts[`texture:${id}`] = entry.owners.size;
    }

    for (const [id, entry] of this.geometries.entries()) {
      byKind.geometry += 1;
      ownerCounts[`geometry:${id}`] = entry.owners.size;
    }

    for (const [id, entry] of this.materials.entries()) {
      byKind.material += 1;
      ownerCounts[`material:${id}`] = entry.owners.size;
    }

    return {
      total: byKind.texture + byKind.geometry + byKind.material,
      byKind,
      ownerCounts,
    };
  }

  clear(): void {
    this.disposeAllResources(this.context);
    this.textures.clear();
    this.geometries.clear();
    this.materials.clear();
  }

  private acquire(
    records: Map<string, ResourceRecord>,
    id: string,
    ownerId: string,
    factory: ResourceFactory,
    dispose: ResourceDisposer,
  ): unknown | null {
    const owner = this.normalizeOwner(ownerId);

    let record = records.get(id);
    if (!record) {
      record = {
        factory,
        dispose,
        owners: new Set<string>(),
        resource: null,
      };
      records.set(id, record);
    }

    record.owners.add(owner);

    if (record.resource !== null) {
      return record.resource;
    }

    if (!this.context) {
      return null;
    }

    const created = factory(this.context);
    record.resource = created;

    return created;
  }

  private release(
    records: Map<string, ResourceRecord>,
    kind: GPUResourceKind,
    id: string,
    ownerId: string,
  ): number {
    const owner = this.normalizeOwner(ownerId);
    const record = records.get(id);
    if (!record) {
      return 0;
    }

    record.owners.delete(owner);
    const ownerCount = record.owners.size;

    if (ownerCount === 0 && record.resource) {
      this.disposeResource(kind, this.context, record);
      record.resource = null;
    }

    return ownerCount;
  }

  private disposeResource(kind: GPUResourceKind, context: WebGLRenderingContext | null, record: ResourceRecord): void {
    try {
      if (record.resource) {
        record.dispose(record.resource, context);
      }
    } catch (error) {
      if (typeof console !== "undefined") {
        console.error(`[GPUResourceManager] failed to dispose ${kind} resource`, error);
      }
    }
  }

  private disposeAllResources(context: WebGLRenderingContext | null): void {
    for (const [, record] of this.textures.entries()) {
      if (record.resource) {
        this.disposeResource("texture", context, record);
        record.resource = null;
      }
    }

    for (const [, record] of this.geometries.entries()) {
      if (record.resource) {
        this.disposeResource("geometry", context, record);
        record.resource = null;
      }
    }

    for (const [, record] of this.materials.entries()) {
      if (record.resource) {
        this.disposeResource("material", context, record);
        record.resource = null;
      }
    }
  }

  private normalizeOwner(ownerId: string): string {
    const normalized = ownerId.trim();
    if (normalized.length > 0) {
      return normalized;
    }

    return `${OWNER_PREFIX}${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
