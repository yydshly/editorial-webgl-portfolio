# Interface Contracts

本文件基于当前仓库真实实现，记录核心运行时交接约束。用于下一阶段继续扩展前的状态恢复与防护。

## 1. Motion Contract

### 1.1 事件/通知层：MotionBus

- 职责：仅承接高频事件分发，不保存历史、不持久化业务状态。
- 主要事件：
  - `tick`（来自 `FrameCoordinator.STATE`）
  - `viewport`
  - `pointer:move`
  - `scroll`
- 能力：`subscribe` 返回可取消函数，`clear` 可清空订阅。
- 不与 Scene/DOM 直接共享状态对象，供**离散行为**或**事件触发**使用。

### 1.2 当前状态层：MotionSnapshotStore

- 职责：持久记录“当前可读状态”快照（高频写入，不进入 React State）。
- 覆盖状态：
  - `frame: { frame, timestamp, delta, elapsed }`
  - `scroll: { scrollX, scrollY, velocity, direction, source, timestamp }`
  - `viewport: { width, height, scrollX, scrollY, devicePixelRatio, isPortrait }`
  - `pointer: { id, x, y, prevX, prevY, dx, dy, velocityX, velocityY, isDown }`
  - `reducedMotion: boolean`
- 提供：
  - `getSnapshot()`（安全副本）
  - 读者方法（`frame`, `scroll`, `viewport`, `pointer`, `reducedMotion`）
- 更新入口由运行时输入服务/事件桥接后推入，避免业务直接改写。

### 1.3 统一时钟层：FrameCoordinator

- 职责：唯一全局时间源与阶段调度器。
- 相位顺序：
  - `INPUT -> STATE -> MEASURE -> ANIMATE -> RENDER -> POST`
- 时间单位：
  - `timestamp`（ms）
  - `delta`（s，clamp）
  - `elapsed`（s，累计）
- 输出：
  - `STATE` 相位后发 `tick`
  - `RENDER` 相位触发 `RenderScheduler`
- 订阅任务可清理，可设优先级，可做异常隔离处理。

### 1.4 明确边界

- **MotionBus = 事件通知层**
- **MotionSnapshotStore = 当前状态读取层**
- **FrameCoordinator = 唯一时间调度层**
- 不允许高频状态进入 React State；DOM/WebGL 只读快照或事件回调。
- 业务代码不得引入独立 `requestAnimationFrame` 长生命周期循环。

---

## 2. Render Contract

### 2.1 渲染链路

```
FrameCoordinator
  -> 注册 RENDER 阶段任务
  -> RenderScheduler
  -> Scene 更新任务
  -> Renderer/bridge（全局 Canvas 上下文）
```

当前实现里：

- `GlobalWebGLStage` 持有 Canvas 与 WebGL context；
- `RenderScheduler` 接入 `FrameCoordinator.RENDER`；
- `HeroWebGLRenderer` 通过 `externalRenderer` 被桥接到 Stage 的渲染循环。

### 2.2 约束

- `Renderer` 不创建独立 RAF。
- `Scene` 不创建或拥有 Canvas。
- `Scene` 不绕过 `RenderScheduler` 提交更新。
- `FrameCoordinator` 与 `RenderScheduler` 仍是单一驱动链路。
- 降级路径下 DOM 内容继续可用，Canvas 不是语义依赖。

---

## 3. Scene Contract

Scene 模块应实现可被运行时驱动的生命周期，不直接管理帧循环：

- `preload()`（可选）：准备资源与可见前处理。
- `activate()`：标记激活并开始参与更新/渲染。
- `update()`：在统一调度器周期读取 Motion/Snapshot/DOM 信息并更新 scene state（由 scheduler 触发任务实现）。
- `deactivate()`：停止更新，保留可恢复状态（通常进入 cached）。
- `dispose()`：关闭监听、释放其持有资源，标记不可再用。

`SceneRegistry` 负责管理 Scene 的状态查询与转换，当前状态枚举为：

`dormant -> preloading -> ready -> active -> cached -> disposed`

运行时约束：

- 状态转移统一由 `SceneRegistry` 跟踪。
- Scene 的 `update` 逻辑必须从 `RenderScheduler` 任务回调入口执行。
- 生命周期边界要可观测（注册、激活、缓存、销毁）。

