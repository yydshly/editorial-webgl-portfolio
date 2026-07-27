# Trevor Noah Style Website — 项目上下文

> 文档基线：Phase 0、Phase 1、Phase 1-Hardening、Phase 2（截至 P2-05）  
> 事实来源：当前仓库代码与测试。本文描述“已经存在的系统”，并明确区分已验证能力与后续目标。

## 1. 项目目标

项目是一套 DOM-first 的叙事型官网原型。可读内容、导航、SEO 与无障碍能力由 HTML/React 承担；Motion Runtime 统一滚动、指针、视口和帧信号；WebGL 作为渐进增强层提供空间化视觉，不阻塞首屏，也不替代核心内容。

核心原则：

- DOM 是内容、语义、交互与 fallback 的事实层。
- WebGL 是视觉增强层；初始化失败、上下文丢失或设备不支持时，页面仍可使用。
- 高频数据不写入 React state。
- 全站只有一个业务帧时钟和一个持久化 WebGL Canvas。
- Scene、Asset、DOM 测量与渲染调度具有明确所有权。

## 2. 当前技术基线

| 层 | 当前实现 |
| --- | --- |
| 应用 | Next.js App Router、React、TypeScript |
| 内容 | `src/content/*` 本地类型化仓库 |
| 样式 | CSS design tokens、响应式 DOM sections |
| 滚动 | `lenis` 单实例；reduced-motion 或初始化失败时回退原生滚动 |
| Motion | `MotionBus`、`FrameCoordinator`、`MotionSnapshotStore`、Viewport/Pointer services |
| DOM 动画 | `MotionAnimationRuntime` + `SectionMotionController` |
| WebGL | 单 Canvas、真实 `three`、原生 WebGL 混合适配层 |
| R3F | `@react-three/fiber` 已安装，但当前运行路径未使用 R3F Canvas 或 R3F render loop |
| 质量门槛 | ESLint、TypeScript、Vitest、Playwright、Next production build |

## 3. 阶段沉淀

### Phase 0：DOM 与产品基础

- Next.js App Router、TypeScript、测试框架。
- Design tokens 与全局视觉基础。
- CMS 解耦的类型化内容层。
- Header、菜单、Footer、静态首页 sections。
- Metadata、Open Graph、robots、sitemap、Skip Link、响应式和 reduced-motion 基线。

### Phase 1：统一滚动与 DOM Motion

- `MotionBus` 负责事件通知。
- `FrameCoordinator` 负责帧调度。
- `ViewportService`、`PointerTracker` 负责浏览器输入采集。
- `ScrollRuntime` 负责 Lenis/原生滚动归一化。
- `MotionAnimationRuntime` 负责 DOM reveal/parallax。

### Phase 1-Hardening：运行时契约收口

- 帧阶段固定为 `INPUT → STATE → MEASURE → ANIMATE → RENDER → POST`。
- 时间单位固定为 `timestamp(ms)`、`delta(s)`、`elapsed(s)`。
- `delta` 最大值为 `0.1s`。
- `MotionSnapshotStore` 提供当前状态读取面。
- DOM 测量与视觉 transform 分离。
- 除 `FrameCoordinator` 外，不新增业务 RAF。

### Phase 2：单 Canvas WebGL Runtime

- `GlobalWebGLStage` 在 `RootLayout` 下持久挂载。
- `ExperienceRoot` 组合 Scene、Asset、Scheduler、Camera、DOMTracker。
- `RenderScheduler` 接入 `FrameCoordinator.RENDER`。
- `SceneAnchor + DOMTracker + domToWorld` 建立 DOM 到世界坐标映射。
- `HeroScene` 打通首个 Scene/Asset/Motion/Anchor 生命周期。
- Context lost、恢复、后台暂停、性能快照建立了基础路径。

## 4. 运行时拓扑

```text
RootLayout
└─ RuntimeProvider
   ├─ MotionBus
   ├─ FrameCoordinator
   ├─ MotionSnapshotStore
   ├─ ViewportService
   ├─ PointerTracker
   └─ MotionAnimationRuntime
      └─ LenisProvider
         ├─ ScrollRuntime
         └─ ScrollLockService
            └─ ExperienceRoot
               ├─ GlobalWebGLStage ── one canvas
               ├─ RenderScheduler
               ├─ SceneRegistry
               ├─ AssetRegistry
               ├─ CameraRig
               ├─ DOMTracker
               ├─ HeroScene
               └─ DOM application
                  ├─ SiteChrome
                  └─ HomePage
                     ├─ SectionMotionController
                     ├─ SceneAnchor(s)
                     └─ semantic sections
```

`ExperienceRoot` 由 `RootLayout` 渲染，因此 Canvas 不属于某个业务页面。当前项目只有首页，但该挂载位置为未来 App Router 页面切换保留了 Canvas 持久化边界。

## 5. 数据流

```text
Browser input
  ├─ Lenis/native scroll ─┐
  ├─ pointer events ──────┼─> MotionBus ─> MotionSnapshotStore
  └─ viewport events ─────┘                    │
                                              ├─> DOM motion
FrameCoordinator                              ├─> HeroScene transform
  INPUT   Lenis.raf(timestamp)                 └─> WebGL renderer
  STATE   frame event/snapshot
  MEASURE DOM geometry
  ANIMATE DOM visual writes
  RENDER  scene update + canvas render
  POST    reserved
```

## 6. 当前能力边界

### 已实现并由代码支撑

- DOM 首屏不依赖 WebGL。
- 单一业务 RAF：只有 `FrameCoordinator` 调用 `requestAnimationFrame`。
- 单一运行时 Canvas。
- 正式 Lenis 类型与原生滚动 fallback。
- Motion event/snapshot 分工。
- DOM rect 缓存与按 dirty 测量。
- Scene/Asset 注册、渲染任务调度、Context 事件处理。
- Hero 场景的状态计算和真实 Three.js 依赖接入。

### 仍属于验证或过渡状态

- `HeroWebGLRenderer` 是 Three.js 与原生 WebGL 的混合适配层，不是纯 Three.js scene graph，也不是 R3F 实现。
- `@react-three/fiber` 仅为依赖准备，尚未进入运行路径。
- CPU 图片资源由 `AssetRegistry` 管理；GPU texture 由 renderer 自己创建与释放，尚未形成统一 GPU 资源契约。
- 性能 Tier 有配置与快照，但没有自动设备分级或实时自适应。
- Context restore 会重建 renderer；完整 GPU 资源恢复仍依赖各 renderer 自行实现。
- 只有 Hero 是实际场景；其他 section 只有 Anchor 注册。

## 7. 目录职责

| 路径 | 职责 |
| --- | --- |
| `src/app/*` | App Router、布局、SEO、页面组合 |
| `src/content/*` | 类型化内容模型与本地仓库 |
| `src/components/layout/*` | Header、菜单、Footer、站点骨架 |
| `src/components/sections/*` | DOM-first 业务 sections |
| `src/components/animation/*` | DOM 动画声明扫描与注册 |
| `src/lib/motion/*` | 帧、事件、快照、指针、视口 |
| `src/lib/scroll/*` | Lenis、原生滚动 fallback、scroll lock |
| `src/components/webgl/*` | Stage、fallback、error boundary、anchor |
| `src/lib/webgl/*` | Scene/Asset/Scheduler/Camera/DOM mapping/performance |
| `src/lib/webgl/hero/*` | Hero 场景状态、资产与渲染适配 |

## 8. 非目标

当前架构不承诺：

- 自动把任意 DOM 页面转换为高质量 3D 网站。
- 已具备复杂 Shader、后处理、粒子、GLB 或多场景编排。
- 安装 R3F 即代表已经采用 R3F。
- 单元测试可以替代真实浏览器的视觉、GPU、Context restore 与性能验证。
