# Interface Contracts

本文件记录当前仓库“Motion + WebGL Runtime”交接时的核心接口契约。目标是为 Phase 3 交接提供稳定约束，不改变运行时语义。

约束前提：

- 高频状态不得进入 React State（例如每帧的 frame、scroll、pointer、viewport 不应直接 `useState` 驱动）。
- 业务代码不得创建自己的长期 RAF（`requestAnimationFrame`）主循环；仅允许在统一调度层内消费帧事件。

---

## 1. Motion Contract

### 1.1 职责边界

#### MotionBus（事件通知层）
- 仅负责事件总线（事件发布/订阅）。
- 当前实现支持：
  - `tick`（来自 FrameCoordinator.STATE）
  - `scroll`
  - `viewport`
  - `pointer:move`
  - `pointer:down`
  - `pointer:up`
  - `pointer:leave`
  - `resize`
- 提供 `subscribe` 返回可取消订阅函数（`Unsubscribe`）。
- 不持有业务状态、不做跨帧累计、仅转发。

#### MotionSnapshotStore（当前状态读取层）
- 负责汇总当前帧期可直接读取的快照状态。
- 存储字段：
  - `frame: { frame, timestamp, delta, elapsed }`
  - `scroll: { scrollX, scrollY, velocity, direction, source, timestamp }`
  - `viewport: { width, height, scrollX, scrollY, devicePixelRatio, isPortrait }`
  - `pointer: { id, x, y, prevX, prevY, dx, dy, velocityX, velocityY, isDown }`
  - `reducedMotion`
- 更新入口通过 `updateFrame/updateScroll/updateViewport/updatePointer`。
- 提供 `getSnapshot()` 与只读 getter（用于“拉取当前状态”）。

#### FrameCoordinator（统一时钟与调度层）
- 唯一负责全局帧时钟入口。
- 当前阶段序列：
  - `INPUT -> STATE -> MEASURE -> ANIMATE -> RENDER -> POST`
- 当前规范：
  - `timestamp/ms`：原始浏览器 `requestAnimationFrame` 时间戳
  - `delta/s`：`(timestamp - prev)/1000`，上限 `0.1s`
  - `elapsed/s`：累计时间（使用 clamp 后的 delta 累加）
  - `frame`：递增帧序号
- `STATE` 阶段统一触发 `tick`。
- 管理任务注册与执行顺序、优先级、异常隔离。

### 1.2 数据流方向

当前标准流为：

```
ScrollRuntime / PointerTracker / ViewportService
   -> MotionBus.emit(event, payload)
      -> MotionSnapshotStore.update*(payload)
         -> SceneRegistry / DOM motion / WebGL Scene / 页面组件 读取快照
```

其中 `FrameCoordinator` 同时提供：

```
frame tick -> motion consumers (STATE, MEASURE, ANIMATE) -> RenderScheduler (RENDER)
```

### 1.3 强制性限制

- 任何 DOM motion、场景渲染、WebGL 更新不得直接 `emit` 自定义高频事件替代正式总线；必须接入统一快照读取。
- 快照字段变化频繁时通过任务周期消费，不在 React state 中逐帧镜像。

---

## 2. Render Contract

### 2.1 渲染链路

```text
FrameCoordinator (RENDER phase)
   -> RenderScheduler.tick
      -> Scene update tasks (HeroScene update)
      -> GlobalWebGLStage externalRenderer (HeroWebGLRenderer.render)
         -> Scene-specific draw/update
```

### 2.2 约束

- Renderer/Scene 不创建自己的 RAF。
- Renderer/Scene 不创建/拥有 Canvas（Canvas 由 `GlobalWebGLStage` 统一托管）。
- Scene 不直接调用 `FrameCoordinator` 渲染循环；必须注册到 `RenderScheduler`。
- `GlobalWebGLStage` 负责：
  - 透传 `MotionFramePayload` 到 `externalRenderer`
  - 统一暂停/恢复策略（可见性/低优先）
  - WebGL 上下文恢复重建
  - 进入 fallback 时回退 DOM 内容

### 2.3 当前阶段限制

- `@react-three/fiber` 已引入依赖，但当前渲染路径未进入运行时（保持可切换性，需新增适配层）。
- `HeroWebGLRenderer` 为当前最小可见场景的主入口，依赖 Three.js scene/camera 及 raw WebGL program/buffers（混合结构）。

---

## 3. Scene Contract

### 3.1 标准 Scene 生命周期

- `preload()`：读取资源/准备资源元信息，不做高频渲染更新。
- `activate()`：进入激活状态并开始参与可见或即将可见的渲染链。
- `update()`：每帧在 `RenderScheduler` 中按优先级执行的更新函数。
- `deactivate()`：停止更新并保留可恢复状态（典型转入 `cached`）。
- `dispose()`：释放监听、纹理/GL 资源（若自行持有）并从 registry 移除。

### 3.2 真实实现映射（当前）

- 生命周期状态由 `SceneRegistry` 管理：`dormant -> preloading -> ready -> active -> cached -> disposed`
- 常用方法：
  - `register({ id, sceneType, metadata })`
  - `setReady / activate / cache / dispose`
  - `list(state?)`、`snapshot`、`active`
- Scene 通常持有：
  - `assetRegistry`
  - `renderScheduler`
  - `domTracker`
  - `snapshot`
- 更新必须通过 `renderScheduler.register(...)` 注入，不允许 Scene 内部重复创建循环。

### 3.3 Scene 契约验收（用于 Phase 3）

- Scene 生命周期必须可预期查询（状态与 ID 可枚举）。
- Scene 更新必须在统一 `RENDER` 管道中可见且可暂停。
- 生命周期转换不应丢失资源引用，也不应重复创建 RAF。

