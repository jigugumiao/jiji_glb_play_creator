# 交接说明：3D 交互制作器「交互链（解谜顺序）+ once 门禁」功能

> 接收方：剧情编辑器 AI
> 发送方：3D 交互制作器（BILITOY GLB 预览文件生成）开发
> 日期：2026-07-26
> 目的：说明制作器新增的「交互链 + once 门禁」功能，以及剧情编辑器侧需要/已经完成的数据与运行时适配。

---

## 0. 结论先行

**剧情编辑器侧的核心适配已经由制作器开发直接改好并验证通过。** 数据链路（`chains` 字段透传）和运行时门禁（链顺序 + once）在剧情编辑器的代码里都已落地，**不需要剧情编辑器 AI 再做额外的数据对接代码改动**。

下面分三部分：① 制作器导出了什么；② 剧情编辑器侧改了什么（已验证）；③ 剧情编辑器 AI 后续可选项。

---

## 1. 制作器（发送方）新增并导出的内容

### 1.1 数据模型：交互链 `chains`

每个模型（mesh / 部位）现在除了原有的点击交互配置（`interactions`、`sounds` 等），还携带一个 **交互链数组** `chains`：

```
chains: [
  { id: "chain_xxx", name: "解谜链A", order: ["box_lid", "gear_1", "door"] },
  ...
]
```

- `order` 是一个 meshName 列表，表示触发顺序。
- 一个 mesh 可以出现在多条链中；多条链并存时，任一链要求的前置未触发都会锁住该 mesh。
- 不在任何 `order` 中的 mesh：**不受门禁限制，随时可点**（保持原有自由交互行为）。

### 1.2 运行时门禁逻辑（制作器 viewer 内已实现）

在触发某个 mesh 的交互前，执行两段判断：

1. **链顺序门禁 `_chainUnlocked(meshName)`**
   - 若 mesh 在某条链中且 `order` 索引 > 0，则要求「同链前一个 mesh 已被触发（`_triggered[prev]`）」。
   - 未满足 → 拦截并弹提示：`请先触发前一个部位（见交互链顺序）`，返回 `false`，本次不触发。

2. **once 门禁（默认开启）**
   - 每个部位默认 `once: true`（只响应一次，防止解谜动画被反复反向播放，例如箱子打开后保持打开）。
   - 若 `once && _triggered[meshName]` → 拦截并弹提示：`该部位只能触发一次`，返回 `false`。
   - 作者可在制作器里勾选「允许多次点击」把 `once` 设为 `false`（注意：pingpong 来回动画的部位必须开「允许多次点击」，否则第二次点击被门禁挡掉，无法反向）。

### 1.3 导出时 `chains` 字段的携带位置（制作器已改写）

- **`.jgl` 场景包**（`scene.json`）：每个模型对象新增 `chains: DB.getChains(id) || []`（见 exporter.js 约 line 1610 / 1670）。
- **画廊（gallery）单模型 / 多模型**：`modelsByNodeId[nid]` 新增 `chains` 字段（约 line 1524）。
- **独立 standalone HTML**：`buildStandaloneHTML(...)` 新增 `chains` 形参，并用占位符 `__CHAINS__` 注入；导出时 `.replace('__CHAINS__', JSON.stringify(chains).replace(/</g,'\\u003c'))`（约 line 573）。

也就是说：**无论哪种导出形态，`chains` 都会跟着模型一起走。**

---

## 2. 剧情编辑器（接收方）已完成的适配（已 grep 验证）

### 2.1 数据读取：`importSceneBundle` 已读 `chains`

- `js/editor.js` 约 line 4135：`chains: m.chains || []`
- `js/storage.js` 约 line 366：`chains: m.chains || []`

导入 `.jgl` / 制作器导出的模型时，会把 `chains` 一并存进 item 对象（`assets.item[a.id]` 含 `chains: a.chains || []`，见 exporter.js 约 line 2157）。

### 2.2 运行时门禁：`ITEM_VIEWER_SOURCE` 已内置

剧情编辑器的物品查看器模板（`js/exporter.js` 内 `ITEM_VIEWER_SOURCE`）已同步制作器的实现：

- 占位符：模板注释与注入点已含 `__CHAINS__`（line 7、line 771 注入 `model.chains || []`）。
- `let chains = __CHAINS__;`（line 80）
- `chainToast()` 提示函数（line 82）
- `_chainUnlocked(meshName)` 链顺序判断（line 91）
- `triggerMeshInteraction` 内已加两段门禁（line 187 链顺序、line 190 once），并维护 `_triggered` 状态。

→ 在剧情编辑器里嵌入/预览物品时，链顺序门禁和 once 门禁**同样生效**。

### 2.3 已修复的关键行为：结束物体 + 锁链

之前有个 bug：嵌入模式下，结束物体（exit mesh）在 `triggerMeshInteraction` 之前就调用了 `notifyExit`，导致**被锁住的结束物体仍能提前结束场景**。

修复后（`ITEM_VIEWER_SOURCE` 的 `initInteraction`）：

```
const meshName = hit.name;
const triggered = triggerMeshInteraction(meshName, hit);   // 先走门禁
if (EMBED && meshName && EXIT_MESHES.indexOf(meshName) >= 0 && triggered) notifyExit(meshName);
```

→ 现在：**结束物体若位于某条链中且前置未触发，会被门禁拦下，不会提前结束场景**，必须按链顺序先点完前置部位。

---

## 3. 给剧情编辑器 AI 的后续建议（非必须，按需）

1. **当前 `chains` 是「只读导入」**：链在制作器里编辑，导入剧情编辑器后直接使用。如果你们希望作者也能在剧情编辑器内查看/编辑链，需要给 item 编辑器补一个 UI（目前没有）。这取决于产品需求，**不影响现有功能**。

2. **验证项（可选自检）**：
   - 导入一个带 `chains` 的制作器产物，确认物品预览时链顺序门禁、once 门禁、结束物体门禁都按预期工作。
   - 确认 `chains` 字段在 `assets.item` → `ITEM_VIEWER_SOURCE` 注入链路中未被截断（导出 HTML 里搜 `__CHAINS__` 应被替换为合法 JSON）。

3. **无需改的代码**：数据透传（`editor.js` / `storage.js` 的 `importSceneBundle`）、运行时门禁（`ITEM_VIEWER_SOURCE`）均已就绪，无需重复实现。

---

## 附：关键文件 / 行号速查

| 位置 | 内容 | 行号（参考） |
|---|---|---|
| 制作器 `js/exporter.js` | `let chains = __CHAINS__` | 115 |
| 制作器 `js/exporter.js` | `.replace('__CHAINS__', ...)` | 573 |
| 制作器 `js/exporter.js` | `modelsByNodeId[].chains` | 1524 |
| 制作器 `js/exporter.js` | `.jgl` 构建 `chains` | 1610 / 1670 |
| 剧情编辑器 `js/exporter.js` | `let chains = __CHAINS__` / `chainToast` / `_chainUnlocked` | 80 / 82 / 91 |
| 剧情编辑器 `js/exporter.js` | `triggerMeshInteraction` 门禁 | 187 / 190 |
| 剧情编辑器 `js/exporter.js` | `__CHAINS__` 注入 | 771 |
| 剧情编辑器 `js/exporter.js` | `assets.item[].chains` | 2157 |
| 剧情编辑器 `js/editor.js` | `importSceneBundle` 读 `chains` | 4135 |
| 剧情编辑器 `js/storage.js` | `importSceneBundle` 读 `chains` | 366 |
