# Rendering Contract

> 本文是 DOM、Motion、Scene 与 WebGL 之间的强制接口。新功能应遵守本契约；与当前代码不一致的目标必须先形成 ADR。

## 1. 核心不变量

1. `FrameCoordinator` 是唯一业务时间源。
2. `GlobalWebGLStage` 是唯一稳定显示 Canvas 的创建者。
3. 高频状态不进入 React state。
4. MotionBus 负责事件，MotionSnapshotStore 负责当前值。
5. `MEASURE` 读 DOM，`ANIMATE` 写 DOM visual state，`RENDER` 更新 Scene 并提交 GPU。
6. DOM 内容永远是可访问与无 WebGL 环境下的 fallback。

## 2. Frame Contract

```ts
MotionFramePayload {
  frame: number
  timestamp: number // ms
  delta: number     // seconds, 0...0.1
  elapsed: number   // seconds, accumulated clamped delta
}
```

Phase 顺序固定：

```text
INPUT -> STATE -> MEASURE -> ANIMATE -> RENDER -> POST
```

同一 phase：

- priority 数字越大越先执行。
- priority 相同按注册顺序执行。
- 每个 callback 必须可单独取消。
- callback 不得假定固定 FPS。

## 3. Motion Contract

### 事件

| Event | Payload | 用途 |
| --- | --- | --- |
| `tick` | frame | 离散帧通知 |
| `viewport` | width/height/scroll/DPR/orientation | 布局视口变化 |
| `pointer:move` | position/delta/velocity/down | 指针输入 |
| `scroll` | position/velocity/direction/source/time | Lenis/native 统一滚动 |

### Snapshot

Scene 每帧读取：

- `frame`
- `scroll`
- `viewport`
- `pointer`
- `reducedMotion`

消费者只读，不保存并修改返回对象。需要跨帧插值时，Scene 自己持有派生状态。

### 单位

| 值 | 单位 |
| --- | --- |
| frame timestamp | ms |
| delta / elapsed | s |
| pointer x/y/dx/dy | CSS px |
| pointer velocity | px/ms |
| native fallback scroll velocity | px/ms |
| scroll position | CSS px |

Lenis velocity 的语义由库提供，当前尚未在适配层转换为显式统一单位；业务逻辑应优先使用方向和归一化后的视觉参数，不直接跨 source 比较绝对 velocity。

## 4. DOM Measurement Contract

- section 必须有稳定且唯一的 HTML `id`。
- `SceneAnchor` 只注册现有 DOM element，不创建 visual wrapper。
- `getBoundingClientRect()` 只允许在 `MEASURE` 或明确的初始化/刷新路径执行。
- 每帧消费者只能读取 `DOMTracker` 缓存。
- layout anchor 不施加会污染测量的视觉 transform。
- reveal/parallax transform 应作用于内部 visual wrapper。

`DOMTracker.getSnapshot()` 返回：

- 缓存 rect
- viewport
- screen/world edge and center points
- relative scroll

它不保证通用 camera transform，只保证当前固定 perspective baseline。

## 5. Scene Contract

Scene 负责：

- 注册 descriptor 与 lifecycle。
- 注册自身 CPU assets。
- 在 scheduler task 中读取 snapshot/anchor 并更新派生状态。
- 暴露 renderer 可读取的只读 scene snapshot。
- 销毁时取消所有注册。

Scene 禁止：

- 创建 RAF。
- 创建第二 Canvas。
- 直接控制全局 context。
- 在逐帧路径写 React state。
- 把核心文字或交互只放在 WebGL。

当前 Registry lifecycle 为单向推进，缓存再激活尚不可用；调用方必须检查 transition 返回值。

## 6. Asset Contract

AssetRegistry 当前只管理 CPU 资源：

- descriptor
- load Promise 去重
- ready/error/disposed 状态
- data 引用

GPU 资源必须由 renderer owner 管理：

- 创建
- 上传
- context restore 重建
- dispose
- 计数

不得把 AssetRegistry 的 `disposed` 误解为 GPU 已释放。

## 7. Render Contract

```text
FrameCoordinator.RENDER
  -> RenderScheduler
     -> Scene update tasks (higher priority)
     -> Stage render task (lower priority)
        -> Renderer.render()
```

- `RenderScheduler` 不创建 RAF。
- pause 时不执行 tasks。
- performance tier 与 low-update mode 共同决定 frame divisor。
- task 异常由 scheduler 隔离并记录。
- renderer 只能使用 Stage 提供的 Canvas/context。

当前 Hero 的优先级契约：

- Hero Scene update：`1`
- Stage renderer：`0`

## 8. Context 与退化 Contract

不支持 WebGL或初始化失败：

- 不阻塞 DOM。
- 不执行 Scene GPU 提交。
- 展示非交互 fallback 状态。

Context lost：

- 阻止默认行为以允许 restore。
- 暂停 ready render path。
- dispose 当前 renderer GPU resources。
- 保留可复用 CPU assets。

Context restored：

- 重取 context。
- 重建 renderer。
- 重新上传所需 GPU resources。
- 恢复 scheduler task。

## 9. R3F 接入 Contract

若后续采用 R3F：

- 仍只能有一个全局 Canvas。
- 禁用 R3F 自有连续 RAF。
- 由 `FrameCoordinator.RENDER` 驱动 R3F `advance` 或受控 invalidation。
- 现有 SceneRegistry、AssetRegistry、MotionSnapshot、DOMTracker 契约保留或提供明确 adapter。
- 不允许 `<Canvas>` 出现在 section 组件中。

在该适配完成前，文档不得将当前系统称为“R3F runtime”。

## 10. 验证清单

- DOM 内容在 WebGL 禁用时完整可用。
- 稳定运行时 `.webgl-canvas` 数量为 1。
- 业务源码中 RAF 只存在于 `FrameCoordinator`。
- Lenis 配置 `autoRaf: false`。
- Scene update 先于 renderer。
- 页面隐藏时 scheduler 暂停，恢复后继续。
- Context restore 后 renderer 与 GPU 资源被重建。
- reduced-motion 下无强制运动且 DOM fallback 可见。
