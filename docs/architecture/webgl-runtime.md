# WebGL Runtime

## P4-03 Batch 3 runtime status

This section supersedes any earlier Batch 2 temporary-integration description below.

- `AboutScene` participates in the existing single global WebGL runtime with one portrait plane. It contributes a stable CameraIntent with FOV `48`; it creates no Canvas, renderer, camera, or RAF.
- `SceneDirector` performs the Media -> DOM-only Manifesto -> About lifecycle as an atomic policy: Media is cached, Manifesto selects `global-idle`, About preloads at `1.5 x viewportHeight`, activates in its core range, and caches on exit/reverse. Camera arbitration occurs only after the final lifecycle state is selected, so no stale Media/About intent leaks through Manifesto.
- About's DOM fallback remains visible for unavailable, loading, inactive/cached, context-lost, and invalidated states. Only a live, texture-ready, active-visible About scene receives `ready-active` fallback transparency. On restore, registered asset data is used to reacquire GPU leases before hiding fallback pixels.
- Batch 3 evidence is stored in `artifacts/p4-03-about-batch3/`. Known results: unit `41 files / 232 tests` passed; focused About E2E `6 passed`. This is not phase closure: legacy Hero/Media browser gates remain failing and final full E2E is unverified.

## 当前 Three.js Runtime 状态（Phase 3 完成后）

- 运行时仍为 **Three.js 原生路径**，未引入 React Three Fiber 主渲染路径。
- 单一 `GlobalWebGLStage` 提供单 canvas，上层统一共享 context（单 RAF 约束不变）。
- `ExperienceRoot` 在同一 canvas/context 中创建两个 renderer：
  - `HeroWebGLRenderer`（Hero scene）
  - `MediaWebGLRenderer`（Media scene）
- 渲染顺序由 `FrameCoordinator` → `RenderScheduler` → `SceneDirector`（更新）→ Stage 外部渲染器桥接（提交）统一编排，保持 single frame coordinator RAF。

## 资源与性能管理

- CPU 资源：`AssetRegistry`
  - 管理 image asset 的注册、加载、state（dormant/loading/ready/error）
- GPU 资源：`GPUResourceManager`
  - 管理 Texture / Geometry / Material 的 lease 与 owner 计数
- `MediaScene` 与 `HeroScene` 渲染器分别共享同一 GPU manager policy：
  - Geometry/Material 常驻复用
  - Texture 以 asset source 做 owner 维度复用

## 生命周期与上下文恢复

- 仍保持 `webglcontextlost / webglcontextrestored` 处理链
- context 丢失后：
  - 当前 renderer 与任务清理
  - 进入 fallback 或等待恢复
- context 恢复后：
  - 重建 renderer
  - 通过 AssetRegistry + GPUResourceManager 恢复资源

## 当前约束确认

- DOM-first
- Single Global Canvas
- Single FrameCoordinator RAF
- Three.js Runtime
- 不引入 R3F
- 保留 DOM fallback

## 当前可交付

- 已支持多 Scene（Hero + Media）在同 canvas 的运行与验证
- Multi Scene Runtime 的生命周期与资源归属可观测
- 性能基线可通过现有 WebGL probe 与 scheduler 阶段数据获取
