# Architecture Decisions

## ADR-001 DOM-First 体验架构

- 状态：Accepted
- 决策：DOM 负责内容、SEO、可访问性与可回退主链路；WebGL 仅为增强视觉。
- 依据：保证页面在无 WebGL/动效降级时仍可用。

## ADR-002 渐进式单源时序

- 状态：Accepted
- 决策：`FrameCoordinator` 作为唯一动画与渲染调度时钟，所有高频状态更新通过 Runtime 订阅模型。
- 依据：避免多个 RAF 引起状态抖动与重复计算。

## ADR-003 Motion 通道拆分

- 状态：Accepted
- 决策：
  - `MotionBus` 只做事件通知；
  - `MotionSnapshotStore` 仅做当前状态读取；
  - Scene/WebGL/DOM 消费统一从 SnapshotStore 拉数或订阅 bus 事件。
- 依据：可降低组件重渲染并统一数据流。

## ADR-004 Single Global Canvas

- 状态：Accepted
- 决策：全站仅维护一个 WebGL Canvas（挂载于 `RootLayout`），并通过全局 stage + fallback 保证稳定。
- 依据：避免上下文切换、重复分配及资源泄漏。

## ADR-005 Scene 运行时对象化

- 状态：Accepted
- 决策：Scene 由 Runtime 对象管理，不与 React 生命周期绑定，不由独立业务 RAF 驱动。
- 依据：更容易统一生命周期、调度和回退。

## ADR-006 Asset 管理分工

- 状态：Accepted（当前版本）
- 决策：
  - `AssetRegistry` 管理资源清单与加载状态；
  - Renderer 通过统一任务更新消费资源快照；
  - 资源回收与 context restore 行为需持续收口。
- 依据：支持后续多 Scene 与缓存策略。

## ADR-007 Three.js 渲染路径

- 状态：Accepted
- 决策：运行路径维持 Three.js，暂不进入 R3F 声明式 Canvas 循环。
- 依据：当前架构已具备 `SceneRegistry / RenderScheduler / CameraRig / DOMTracker`，优先收口原生 Three.js 运行时 ownership。

## ADR-008 暂不引入 R3F（评估保留）

- 状态：Accepted（暂缓）
- 决策：当前不引入 `@react-three/fiber` 到运行路径。
- 原因：
  1. Scene 生命周期与调度已由自研 Runtime 接管；
  2. R3F 可作为渲染层 DSL，但会带来额外 reconciler 以及调度协同成本；
  3. 目前 Phase 2/3 目标是稳定 runtime ownership 与多 Scene 基础设施，因此先不改变主运行路径。
- 代路：在 runtime 边界稳定后，再进行 R3F 评估验证，不影响当前主线。

## ADR-009 运行路径优先级（Phase 3 前）

- 状态：Accepted
- 决策：进入 Phase 3 之前优先补齐：
  - Scene Contract 与生命周期转移
  - Scene/Asset 缓存与恢复策略
  - Renderer 与 GPU resource ownership
  - Context lost/restore 与性能退化路径

## ADR-010 P4 内容顺序与 Manifesto DOM Interlude

- 状态：Accepted
- 决策：首页顺序固定为 `Hero → Media → Manifesto → About → News → Quote → Books`。`Manifesto` 是纯 DOM 章节：不注册 WebGL `SceneModule`，不承载人物 Plane，不参与跨 Scene camera handoff。
- 编排：Media 在进入 Manifesto 前完成退出并进入缓存；仅当接近 About 时才预加载 About。About 不能跨过 Manifesto 与 Media 直接 handoff。
- 依据：Manifesto 承担平台观点表达，About 承担人物档案与成长路径；二者的内容和空间职责必须分离。

## ADR-011 P4 About 单 Scene 单 Portrait Plane

- 状态：Accepted
- 决策：About 只新增一个 `AboutScene` 与一个 Portrait Plane。四个成长阶段是同一 Scene 内的 DOM 语义阶段和轻量视觉状态，不拆成四个 Scene。
- 约束：继续使用 Single Global Canvas、单 Three.js renderer、单 `CameraRig`、单 `FrameCoordinator` RAF；不引入 R3F、Shader、VideoTexture、GLB、粒子或后处理。
- 依据：成长叙事的主信息已在 DOM 时间线中，WebGL 只需提供克制的视觉锚点，不需要额外运行时所有权。

## ADR-012 P4 About 稳定 CameraIntent 与全局空闲姿态

- 状态：Accepted
- 决策：About 通过现有 `CameraIntent` 输出基本恒定 FOV 的小幅 target/positionOffset 差异；`CameraRig` 仍为唯一 Camera owner，`SceneDirector` 仍为唯一聚合入口。Manifesto 区间使用显式的全局空闲 CameraIntent，不延续旧 Media 或 About intent。
- 降级：reduced-motion 使用固定 About hold intent；fast-scroll 直接收敛到最终 coherent intent，不逐阶段播放。
- 依据：相机不应跨 DOM interlude 泄漏或制造无内容旅行，About 的阅读重点必须停留在人物档案时间线。
- 实施状态：P4-03 已完成 Desktop/Mobile、forward/reverse/fast-scroll、reduced-motion、fallback/context restore 与最终人工视觉签署，现已关闭。正式人物资产替换后的艺术复审不重新打开 P4-03，也不阻塞 P4-04。

## ADR-013 P4 Books 出版档案与单 Scene 三 Cover Plane

- 状态：Accepted（设计已批准，等待实施）
- 决策：Books 是虚构 `DEV-HOST-01` 的代表作品与出版物档案，是个人品牌叙事的成果章节；它不是推荐书单、单本销售页、电商书架、About 重复或语义宽泛的 Works 页面。
- 内容：展示一本核心作品《在场的人 / People in the Room》和两本延伸作品《城市之间 / Between the Cities》《彼此听见 / Hearing One Another》，统一归入 `FIELD NOTES / 在场档案` development 系列。
- WebGL：只新增一个 `BooksScene`、一个场景级 `BooksWebGLRenderer` 适配对象和三个 Cover Plane。三个 Mesh 共享一个 `THREE.Scene`，使用三张 Texture、三份独立 Material，并优先共享一个 PlaneGeometry。
- 约束：继续使用单一 `GlobalWebGLStage` Canvas、单一全局 `THREE.WebGLRenderer`、单一 `CameraRig`、单一 `FrameCoordinator` RAF 与 Three.js 原生运行路径；不引入 R3F、Shader、VideoTexture、GLB、后处理、真实 3D 书模、复杂翻页、拖拽、轮播或点击切换主书。
- 依据：出版信息与可访问语义由 DOM 完整承载；WebGL 只强化三本封面的空间层级和章节记忆点。

## ADR-014 News / Quote DOM-only 与 Quote → Books global-idle 编排

- 状态：Accepted（设计已批准，等待实施）
- 决策：News 与 Quote 保持 DOM-only，只注册现有 DOM anchor，不注册 `SceneModule`。About 离开后进入缓存；News/Quote 区间复用现有 `GLOBAL_IDLE_CAMERA_INTENT`；接近 Books 时才 preload，进入 Books 核心区后请求激活，三本封面 visual-ready 后才提交 Books dominant/CameraIntent。
- 禁止：不得跨越 News/Quote 创建 About → Books overlap、blend 或直接 camera handoff，也不得让旧 About intent 泄漏到 DOM-only 区间。
- 快速与降级路径：fast-scroll 在同一 Director update 内解析最终生命周期；reduced-motion 使用最终三书收拢 hold 和即时相机应用；等待资源期间 DOM fallback 保持可见。
- 依据：News/Quote 是内容节奏与视觉停顿，不应成为人物/出版物 Scene 的透明过场。

## ADR-015 Books development 资产与资源预算

- 状态：Accepted（设计已批准，等待实施）
- 决策：Books development 包含一个 manifest 和三张完整 2:3 sRGB WebP 封面；作者固定为 `DEV-HOST-01`，系列固定为 `FIELD NOTES / 在场档案`，manifest 状态必须为 `development`。
- 预算：额外 Texture 最多 3、Cover Mesh 3、Cover Material 3、Geometry 优先 1 个共享对象；不逐帧设置 `texture.needsUpdate`，不新增透明全屏 Plane。
- Fallback：三张 DOM 封面采用 all-or-nothing 可见性；只有 live context、Books active/dominant、全部资源 ready 且三 Mesh 均已渲染时才隐藏 fallback pixels。
- 所有权：Books CPU/GPU owners 独立计数，不得释放、重传或改变 Hero、Media、About owner 数。
