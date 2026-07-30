> 🌐 语言 / Language：[English](README_EN.md) · 中文

# 3D交互制作器 / 3D Interactive Asset Maker

## ▶ 在线使用 / Use online
**想直接上手？点这里打开网页版（纯前端，无需安装，数据存在你的浏览器本地）：**
👉 **https://jigugumiao.github.io/jiji_glb_play_creator/**

> ⚠️ 本项目是 **[jigugumiao/jiji_text_game_editor（剧情编辑器）](https://github.com/jigugumiao/jiji_text_game_editor)** 的配套素材工具。它的 **`.jgl` 工程包导出**专门供剧情编辑器导入为 3D 物品使用；而「独立查看器 HTML / 目录画廊 HTML」两种导出是自包含网页，可单独分享、**不依赖**剧情编辑器。

一个**纯前端**（原生 HTML + JavaScript + three.js，零依赖、零构建步骤）的 **3D 交互素材制作器**。导入 GLB 模型，给模型的具体部位绑定点击行为（播放动画、播放音效、点击后消失），设置默认视角与动画片段截取，再导出成可在浏览器里交互查看的网页，或导出 `.jgl` 工程包交给剧情编辑器做互动剧情。

> 项目名「3D交互制作器」。本仓库使用 `jiji_` 前缀，与剧情编辑器 `jiji_text_game_editor` 成对。

## 功能特性

- **多模型 / 文件夹管理**：项目内用树形结构组织多个 GLB 模型与文件夹，支持重命名、增删。
- **部位交互编辑**：选中模型后，给具体 mesh（网格）绑定点击行为 ——
  - 播放动画片段（支持 **片段截取** `clipIn`/`clipOut`、循环 / 往返 / 播完复位）；
  - 播放音效；
  - 点击后消失（作为「结束物体」，可用于剧情分支跳转）。
- **交互链（解谜顺序）**：底部停靠栏可新建多条交互链，把触发部位拖入并按顺序排列；同链上「后一个部位」需先点击过「前一个部位」才允许触发，可据此做有顺序的解谜。未加入任何链的部位不受顺序限制。所有部位**默认只响应一次点击**（防止解谜动画被反向 / 重播破坏，如盒子打开就别关上），可勾选「允许多次点击」解除限制。
- **默认视角**：可把当前相机视角存为模型默认视角，「重置视角」一键回到；下次打开自动应用。
- **关闭手动旋转**：勾选后导出的成品固定在默认视角、禁止用户旋转（仍保留缩放 / 平移）。
- **三种导出形态**：
  1. **独立查看器 HTML**（单模型，GLB/音效内联，双击即可打开分享）；
  2. **目录画廊 HTML**（多模型列表 + 3D 查看器，适合做模型陈列）；
  3. **`.jgl` 工程包**（scene.json + GLB + 音效），被剧情编辑器导入为 3D 物品。

## 与剧情编辑器配合

本工具的 **`.jgl` 工程包**是给 **[jiji_text_game_editor（剧情编辑器）](https://github.com/jigugumiao/jiji_text_game_editor)** 用的：在剧情编辑器里导入 `.jgl`，即可把该 3D 模型作为可召唤的 3D 物品放入互动剧情。独立查看器 / 目录画廊两种导出不依赖剧情编辑器。

## 目录结构

```
index.html              入口（3D交互制作器主界面）
css/style.css           样式
js/main.js              主逻辑（项目树 / 交互编辑 / 导出 UI / 交互链）
js/viewer.js            3D 查看器（OrbitControls / GLTFLoader / AnimationMixer）
js/exporter.js          导出：独立查看器 / 目录画廊 / .jgl 工程包
js/db.js                本地项目数据（IndexedDB 存二进制 + localStorage 存结构）
js/utils.js             工具函数
js/zip.js               压缩（.jgl 打包）
vendor/three/           three.js 本地内置（three.min.js / OrbitControls.js / GLTFLoader.js）
assets/audio/           示例音效
_validate_exports.js    导出产物校验脚本（开发用）
```

## 本地使用

直接用浏览器打开 `index.html` 即可（无需服务器、无需安装依赖）。three.js 已随仓库内置（`vendor/three/`），**主程序可完全离线运行**，所有项目数据保存在浏览器本地存储（IndexedDB + localStorage）。

> 导出的「独立查看器 HTML」为自包含单文件（GLB/音效内联），但 three.js 走 jsdelivr CDN，**打开需联网**。

## 技术栈

- 原生 JavaScript（classic script，无框架、无打包器）
- three.js（本地内置，非 CDN）
- HTML5 + CSS3
- 本地存储：IndexedDB（二进制）+ localStorage（结构）

## 开源协议

[MIT License](LICENSE) © 2026 jigugumiao
