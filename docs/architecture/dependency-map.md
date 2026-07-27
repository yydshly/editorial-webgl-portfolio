# Dependency Map (Real Runtime, Current State)

本图仅基于当前真实代码，不包含未落地的 R3F 未来路径。

## Runtime Root

```text
app/layout.tsx
  └── RuntimeProvider
      ├── MotionBus
      ├── FrameCoordinator
      ├── MotionSnapshotStore
      ├── ViewportService
      ├── PointerTracker
      └── MotionAnimationRuntime
      └── LenisProvider
          └── ScrollRuntime
              ├── ScrollLockService
              ├── Lenis autoRaf=false (if enabled)
              └── native fallback scroll (if no Lenis / reduced-motion / import fail)
```

## Motion Runtime Details

- `MotionBus`
  - 事件：`tick`, `viewport`, `scroll`, `pointer:*`
  - 只做通知，不持久化状态。
- `FrameCoordinator`
  - 全局帧相位循环（`INPUT/STATE/MEASURE/ANIMATE/RENDER/POST`）
  - 每帧执行注册任务，`STATE` 触发 `tick`。
- `MotionSnapshotStore`
  - 事件->状态更新
  - 为 Scene/DOM/WebGL 提供 `getSnapshot()` 与只读 getter。
- `ViewportService`
  - resize/scroll 等 viewport 事件接入 `MotionBus`。
- `PointerTracker`
  - pointer/mouse/move/down/up 采样接入 `MotionBus`。
- `MotionAnimationRuntime`
  - DOM side 的 reveal/parallax 更新任务挂在 Motion / FrameCoordinator 上。

## WebGL Runtime Boundary

```text
ExperienceRoot
  ├── WebGLRuntimeContext.Provider
  │   ├── DOMTracker
  │   └── CameraRig
  ├── SceneRegistry
  ├── AssetRegistry<HTMLImageElement>
  ├── RenderScheduler
  ├── HeroScene
  │   ├── HeroObjectLayer
  │   ├── HeroPortrait
  │   ├── SceneRegistry
  │   ├── AssetRegistry
  │   ├── DOMTracker
  │   └── RenderScheduler
  ├── CanvasErrorBoundary
  ├── GlobalWebGLStage
  │   ├── FrameCoordinator
  │   ├── RenderScheduler
  │   ├── WebGLCapability
  │   ├── WebGL context
  │   └── externalRenderer callback
  └── HeroWebGLRenderer (created in ExperienceRoot on WebGL ready)
      ├── MotionSnapshotStore
      ├── AssetRegistry
      ├── THREE.Scene / PerspectiveCamera / PlaneGeometry / MeshBasicMaterial / Mesh
      └── raw WebGL program/buffer/state（混合渲染器）
```

## DOM / Anchor Map

- `SceneAnchor`（DOM component）
  - 在 `WebGLRuntimeContext` 中拿到 `domTracker`
  - 以 `id` 注册到 `DOMTracker`，用于 Scene 查询 anchor world/viewport 数据

- `DOMTracker`
  - 监听 `ResizeObserver` 与 `FrameCoordinator.MEASURE`
  - 缓存 DOMRect，构建 `getSnapshot(id)` 返回 world/top/bottom/left/right 映射
- `CameraRig`
  - 提供 camera perspective 与断点（mobile/tablet/desktop）映射。
- `domToWorld`
  - 将 DOM 像素坐标映射到 world 坐标（含 breakpoint 解析）。

## 外部能力（与当前能力面交叉）

- `WebGLFallback`：Context 不可用/异常时兜底 DOM。
- `WebGLPerformanceProbe`：依赖 `RenderScheduler + SceneRegistry + AssetRegistry`。
- `LenisProvider` 下的 scroll 能力：`MotionBus` 为中枢，不为 WebGL 自建时序。

## 当前可执行依赖链（聚焦依赖方向）

```text
app/layout.tsx
  └─ RuntimeProvider
     ├─ FrameCoordinator (唯一时钟)
     ├─ MotionBus (事件总线)
     ├─ MotionSnapshotStore (快照读取)
     ├─ ViewportService / PointerTracker
     ├─ MotionAnimationRuntime
     └─ LenisProvider
        └─ ScrollRuntime
           └─ ScrollLockService

ExperienceRoot（内嵌于 RuntimeProvider/LenisProvider 下）
  ├─ GlobalWebGLStage（Canvas 挂载点）
  │  └─ RenderScheduler（RENDER 事件消费）
  ├─ SceneRegistry
  ├─ AssetRegistry
  ├─ DOMTracker
  ├─ CameraRig
  ├─ HeroScene
  │  ├─ HeroObjectLayer / HeroPortrait
  │  └─ 注册到 RenderScheduler 的 update 任务
  └─ HeroWebGLRenderer
     └─ externalRenderer 回调（由 GlobalWebGLStage 触发）
```

## 模块关系说明

- `MotionBus` 是事件路由，不持久化高频状态。
- `MotionSnapshotStore` 通过 `RuntimeProvider` 的连接 effect 接收 `tick/scroll/viewport/pointer`，供 WebGL 与 DOM motion 读。
- `FrameCoordinator` 同时驱动 `MotionAnimationRuntime` 与 `RenderScheduler`。
- `GlobalWebGLStage` 通过 `FrameCoordinator -> RenderScheduler` 接入唯一渲染时钟；`HeroWebGLRenderer` 不创建 RAF。
- `SceneAnchor` 只注册 DOM 节点 id 到 `DOMTracker`；`DOMTracker` 在 `MEASURE` 阶段刷新几何缓存后提供 world 投影。

