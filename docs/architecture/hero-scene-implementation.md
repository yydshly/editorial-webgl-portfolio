# HeroScene 实现归档（P4-01）

## 1. HeroScene 当前架构

### Asset Pipeline

- 统一读取 `public/assets/hero/hero-manifest.json` 作为入口资产清单。  
- `hero-manifest` 当前提供：
  - `master` 入口资源（placeholder）
  - `desktop`、`mobile` 变体
  - `foreground` 裁切配置占位
- 运行时不在 `HeroScene` 内直接 `load` 资源；通过 `AssetRegistry` 进行注册、预加载、就绪、销毁流程管理。

### Manifest

- `HeroSceneConfig` 从 manifest 派生路径与裁切定义。  
- `portrait` / `foreground` 在配置中通过路径与区域配置解耦，支持后续替换真实资产不改 Scene 逻辑。

### Portrait Layer

- 当前由 `HeroPortrait` + `HeroWebGLRenderer` 渲染单平面（plane）实现基础人物展示。  
- portrait 平面使用透明纹理（透明通道）与基础 `MeshBasicMaterial`，保持 `DOM-first` 回退可用。
- 通过 `state.transform` 控制 `position/scale/opacity`，并与章节进度联动。

### Foreground UV Crop

- `HeroScene` 仍复用同一张 portrait texture（单 texture owner），不新增人物大图资源。  
- `HeroWebGLRenderer` 通过 foreground mesh 的 UV 重映射裁切前景区域（例如右手/麦克风区域），并与 portrait 独立几何/材质资源管理。  
- `z = 0.35` 提供前景层前移叠加效果。

### Camera Intent

- `HeroScene` 不直接改动 Camera。  
- 在 `update` 中生成 `CameraIntent`：
  - `target`（基于锚点世界坐标 + 偏移）
  - `positionOffset`（基于章节点位 + 配置偏移）
  - `fovIntent` / `depthBias` / `weight`
- `SceneDirector` 聚合 Scene 的 intent 并交由 `CameraRig` 生效。

### Chapter Progress

- 来源：`HeroChapterProgress` 基于锚点相对滚动与 viewport/锚点高度计算。  
- 阶段划分：
  - `enter`
  - `hold`
  - `depart`
- 复用现有 Motion runtime 的滚动/帧快照，未新增独立 RAF。

### Motion Config

- 已集中到 `HERO_MOTION_CONFIG`：
  - 阈值：`enter` / `hold` / `reducedMotionProgress`
  - `opacity` 区间：enter 起始 / 基线 / depart 结束
  - `scale` 区间：enter 起始 / 基线 / depart 结束
  - `translation` 区间：enter / hold / depart 的 `x/y` 位移
  - `foreground` 放大/位移倍率
  - `easing` 曲线（`easeOutCubic`）
- 不使用 GSAP，完全复用现有 `update/frame` 调度。

## 2. Runtime 接入链路

```text
HeroScene
  → SceneDirector（register/preload/activate/deactivate/update/snapshot）
    → CameraRig（统一应用 CameraIntent：position/target/fov）
      → HeroWebGLRenderer（读取 HeroScene 快照，更新 texture/mesh transform）
        → Three.js Renderer（单 Global Canvas）
```

附加链路：  
- `AssetRegistry` 提供 CPU 资源管理（图片注册/预加载/ready/状态变更）  
- `GPUResourceManager` 提供纹理/几何/材质生命周期与引用计数  
- `DOMTracker` 与 `MotionSnapshotStore` 提供锚点与滚动快照

## 3. 可复用模式（给 Media / About / Books）

可复用为下一个 Scene 的模板：

- **Scene Module 结构**：`identity / preload / activate / deactivate / dispose / update / getSnapshot / getCameraIntent`
- **资源注入方式**：每个场景都只通过 `AssetRegistry` 注册资源，不在 Scene 内直接请求网络加载。  
- **WebGL 渲染方式**：
  - `Single Global Canvas`
  - 每个 Scene 持有独立 renderer 或 mesh bundle
  - 通过 `SceneDirector` 提供统一更新节奏
- **多层叠加策略**：
  - 主层（如 portrait/图片/视频占位）与前景/装饰层独立 transform 与 material，复用 texture 时可共享纹理并通过 UV/scale 区分。
- **章节驱动**：
  - 引入 `scene-specific` progress mapping
  - 输出统一 `chapter/progress + layer transform` 给 render 层
- **相机协作**：
  - 场景仅输出 intent；由 `SceneDirector + CameraRig` 统一仲裁与应用，避免多 Camera owner。

## 4. 当前限制

- 当前资产为 placeholder 人物照，占位资产完成阶段。
- 未引入 Shader。  
- 未引入 GLB。  
- 未接入高级后处理（post-process）。
- Camera motion 仍为基础章节映射 + position/offset 意图，不含复杂相机路径。

## 5. HeroScene 验收状态

- **HeroScene 审核结论：P4-01 Hero Visual Upgrade COMPLETE**
- 可进入下一步：  
  - P4-01.4B-4（若按计划继续细化）
  - 或直接进入 `Spatial Experience Expansion` 多场景扩展阶段
