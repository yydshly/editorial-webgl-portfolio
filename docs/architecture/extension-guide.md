# Scene 扩展指南（Phase 3 前置）

本文档定义新增 Scene 的标准接入流程，避免重复架构实现和单 Canvas 约束破坏。

## 新 Scene 接入原则

- 禁止新增页面级 Canvas，所有视觉渲染仍经由 `GlobalWebGLStage` 单一上下文。
- 禁止业务代码创建自己的 RAF 或独立渲染循环。
- 不复制 `HeroScene` 具体实现逻辑；复用 Runtime 组件与通用服务。
- 新 Scene 只在 `RenderScheduler` 的 RENDER 通道执行更新；每一项高频状态都从 `MotionSnapshotStore` 读取。

## 推荐接入步骤

### 1. 创建 Scene Module

建议路径：`src/lib/webgl/<SceneName>/`.

至少包含：

- Scene class（例如 `XxxScene.ts`）
- scene 相关配置文件（`xxxSceneConfig.ts`）
- 可选的 state/update helpers（如 `XxxObjectLayer.ts`）
- 可选的资源加载器逻辑（`XxxAssetLoader.ts`）

职责边界：

- Scene 仅管理自身状态、资源依赖和更新算法。
- 不直接触及 Canvas/context。

### 2. 定义 Scene Config

在配置文件中定义：

- sceneId、anchorId（与 DOM 对应）
- 资源 id / 路径
- 变换参数（位移/旋转/衰减）
- 性能等级兼容参数（更新频率、最大更新值）

### 3. 注册 SceneRegistry

- 在 `ExperienceRoot` 中实例化并持有（按 `useState` 创建一次）。
- Scene 初始化时调用 `sceneRegistry.register()` 并初始状态设为 `ready`。
- 激活时调用 `sceneRegistry.activate()`；停用时 `cache()` 或 `deactivate()`。
- 销毁时 `dispose()` 并清理生命周期监听。

### 4. 定义 Asset Manifest

- 在 `AssetRegistry` 注册场景必需资源描述（id/src/kind/metadata）。
- 采用 `preload`/`load` 机制避免重复加载。
- 资源状态由 `AssetRegistry` 管理；渲染态资源释放由 Scene/Renderer 的资源 owner 统一处理。

### 5. 创建 SceneAnchor

- 在对应的 DOM section 中添加：

```tsx
<SceneAnchor anchorId="section-id" sceneType="xxx" />
```

- `anchorId` 必须稳定且可预先检索（与 CSS/SEO id 策略一致）。
- 避免把锚点用于布局 transform（保持 anchor 只用于映射与读取）。

### 6. 接入 RenderScheduler

- Scene 更新逻辑通过 `renderScheduler.register(() => {...}, { priority })` 注册。
- Scene 的 `update` 仅做状态计算（`MotionSnapshotStore`, `DOMTracker` 读取）；
- 渲染提交由专用 renderer 处理，不在 `render` 中创建循环。
- 在 Scene 不活跃/销毁时取消注册任务和监听。

### 7. 添加测试

每个新增 Scene 至少覆盖：

- Registry 生命周期（register/activate/deactivate/dispose）
- Snapshot 驱动计算（scroll/pointer/viewport 变化）
- 锚点映射读取（`DOMTracker.getSnapshot`）
- 渲染接入 smoke 测试（Renderer 初始化与关闭）
- fallback 情况（WebGL 不可用时 DOM 页面仍完整）

## 接入检查清单

- [ ] 无新增 Canvas
- [ ] 无新增 `requestAnimationFrame` 入口
- [ ] 优先级和生命周期在 `RenderScheduler` 可观察
- [ ] Scene 使用 `MotionSnapshotStore` 读取状态
- [ ] Anchor ID 稳定且与 `SceneRegistry` 关联
- [ ] 资源通过 `AssetRegistry` 注册
- [ ] 具备 dispose 和回收测试

