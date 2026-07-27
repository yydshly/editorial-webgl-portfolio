# Motion Runtime

> 覆盖 Phase 1 与 Phase 1-Hardening。本文定义 Motion 层的当前实现、顺序、单位、所有权与已知风险。

## 1. 设计目标

Motion Runtime 将帧、滚动、指针、视口和 reduced-motion 归一为可被 DOM 动画与 WebGL 同时消费的低开销数据流。

必须保持：

- 高频信号不进入 React state。
- 业务系统不创建独立 RAF。
- 事件通知与当前状态读取分离。
- 所有订阅、观察器与浏览器监听均可清理。
- 帧内读写顺序可预测。

## 2. 核心对象

### MotionBus

`src/lib/motion/MotionBus.ts`

- 事件：`tick`、`viewport`、`pointer:move`、`scroll`。
- `subscribe()` 返回取消函数。
- 不保存历史或当前状态。
- listener 按注册顺序执行。

边界：`MotionBus.emit()` 当前不隔离单个 listener 异常。`FrameCoordinator` 对 `tick` 的整次 emit 做了保护，但其他事件的生产者没有统一异常隔离；消费者不得抛出异常。

### FrameCoordinator

`src/lib/motion/FrameCoordinator.ts`

- 唯一业务 RAF 所有者。
- 按固定 phase 执行任务。
- phase 内按 priority 降序、注册 id 升序执行。
- `register()` 返回取消函数。
- 单个 phase callback 异常被捕获，不阻断后续 callback。
- `start()` 幂等；`stop/reset/dispose` 管理 RAF 与任务生命周期。

时间契约：

| 字段 | 单位 | 规则 |
| --- | --- | --- |
| `timestamp` | ms | 浏览器 RAF timestamp |
| `delta` | s | 非负，最大 `0.1` |
| `elapsed` | s | 累加 clamp 后的 delta |
| `frame` | count | 从 1 开始递增 |

注意：`elapsed` 是运行时模拟时间，不是 `timestamp / 1000`，后台长暂停不会产生超大时间跳跃。

### MotionSnapshotStore

`src/lib/motion/MotionSnapshotStore.ts`

保存：

- `frame`
- `scroll`
- `viewport`
- `pointer`
- `reducedMotion`

每次 `getSnapshot()` 返回字段副本，外部无法直接修改内部状态。该策略保证读取安全，但会产生对象分配；当前 Hero 每个 render tick 会读取完整 snapshot。复杂场景引入前应通过 profile 决定是否增加稳定引用、selector 或 `readInto()` 一类的零分配接口。

### ViewportService

`src/lib/motion/ViewportService.ts`

- 监听 `resize`、原生 `scroll`、`orientationchange`。
- 发布 viewport 尺寸、原生 scroll position、DPR、横竖屏。
- connect/disconnect 幂等清理。

`viewport.scrollY` 表示浏览器布局视口位置；平滑滚动语义应优先读取 `snapshot.scroll`。

### PointerTracker

`src/lib/motion/PointerTracker.ts`

- 监听 pointer move/down/up/leave 与 mouseout。
- 输出 viewport 像素坐标、位移和速度。
- 当前 `velocityX/Y` 单位是 `px/ms`。
- 离开窗口时只更新内部 `isDown`，不会单独发布 pointer 事件。

### RuntimeProvider

`src/lib/motion/RuntimeProvider.tsx`

在一次 React provider 生命周期内创建并持有：

- `MotionBus`
- `FrameCoordinator`
- `MotionSnapshotStore`
- `ViewportService`
- `PointerTracker`
- `MotionAnimationRuntime`

React state 只用于稳定保存服务实例，不承载逐帧数据。Provider effect 负责 connect/start，并在卸载时取消订阅、停止服务、清空总线。

## 3. 帧阶段

| Phase | 当前职责 | 允许操作 |
| --- | --- | --- |
| `INPUT` | `lenis.raf(timestamp)` | 采集/推进外部输入 |
| `STATE` | 执行 state tasks，随后发布 `tick` | 更新纯状态和 snapshot |
| `MEASURE` | DOMTracker、DOM motion 测量 | DOM read，不写 transform |
| `ANIMATE` | DOM reveal/parallax 写入 | 插值、DOM visual write |
| `RENDER` | RenderScheduler tasks、renderer render | Scene 状态更新与 GPU submit |
| `POST` | 当前保留 | 统计、回收、诊断 |

实现细节：`tick` 在 `STATE` phase 的已注册任务执行后发布。`MotionSnapshotStore.frame` 因此在后续 `MEASURE/ANIMATE/RENDER` 可读取当前帧数据。

## 4. 滚动链路

`src/lib/scroll/ScrollRuntime.ts`

```text
FrameCoordinator.INPUT
  -> Lenis.raf(timestamp)
  -> Lenis scroll callback
  -> MotionBus.scroll
  -> MotionSnapshotStore.scroll
  -> DOM motion / WebGL consumers
```

- 正式使用 `lenis` 包类型。
- `autoRaf: false`，Lenis 不拥有 RAF。
- 单实例由 `LenisProvider` 创建。
- Menu scroll lock 通过 `ScrollLockService` 调用 `lenis.stop/start`。
- reduced-motion、动态导入失败或实例化失败时回退原生 `scroll` listener。
- 原生 fallback 的 velocity 当前按 `abs(dy) / dt` 计算，单位为 `px/ms`。
- Lenis velocity 直接采用库提供值；跨 source 使用绝对数值前应先验证单位语义。

## 5. DOM Motion

`MotionAnimationRuntime` 通过 `SectionMotionController` 扫描 `#site-content [data-motion]`，集中注册 reveal/parallax。

- Reveal 优先使用 `IntersectionObserver`。
- 无 IntersectionObserver 时，在 `MEASURE` 读取 rect。
- Parallax 在 `MEASURE` 计算目标，在 `ANIMATE` 写 CSS custom properties。
- reduced-motion 下 reveal 立即可见、parallax 归零。
- Section 只声明数据属性，不创建 timeline 或 RAF。

DOM Anchor 与 Visual Transform 的边界：

- section 的稳定 `id` 是布局/Scene anchor。
- `data-motion` 应放在 section 内部 visual wrapper。
- WebGL 的 `SceneAnchor` 查找稳定 section 元素。
- 不应对 anchor 元素本身施加影响布局测量的 transform。

## 6. 生命周期顺序

启动：

1. `RuntimeProvider` 创建服务。
2. `FrameCoordinator.start()`。
3. Viewport/Pointer/MotionAnimation connect。
4. Snapshot 订阅 Bus。
5. `LenisProvider` connect ScrollRuntime。
6. WebGL/DOM consumers 注册到 phases。

销毁：

1. consumers 取消各自任务/监听。
2. ScrollRuntime 销毁 Lenis 或 native listener。
3. RuntimeProvider 清理 input services、FrameCoordinator、AnimationRuntime、MotionBus。

## 7. 面向 WebGL 的读取规则

- 连续状态读取 `MotionSnapshotStore`，不要为每个 Scene 订阅所有 Bus 事件。
- 离散行为或失效通知使用 `MotionBus`。
- Scene 不读取 React state 获取 frame/scroll/pointer。
- Scene 不自行查询 `window.scrollY`。
- 所有 damping 使用 `frame.delta`，不要假定 60 FPS。
- reduced-motion 是运行时输入，必须影响 Scene motion，而不能只影响 CSS。

## 8. 已知风险

| 风险 | 当前状态 | 后续建议 |
| --- | --- | --- |
| Snapshot 每次读取分配对象 | 已存在 | Scene 数量增加前 profile |
| Bus listener 异常未逐个隔离 | 已存在 | 增加 listener 级隔离与诊断 |
| Lenis/native velocity 单位可能不同 | 未标准化 | 定义并归一为明确单位 |
| reduced-motion 只在初始化读取 | 不响应运行中变更 | 监听 MediaQueryList change |
| Viewport 与 scroll snapshot 各含 scroll 值 | 语义易混淆 | 文档与类型明确布局值/平滑值 |
| RuntimeProvider 启动后才订阅 snapshot | 首帧存在极短窗口 | 必要时调整订阅先后顺序 |
