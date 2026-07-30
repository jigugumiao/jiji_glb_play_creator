> 中文 · [English 🌐](README.md)

# 3D交互制作器 / 3D Interactive Asset Maker

## ▶ Use online
**Want to start right away? Open the web app here (pure front-end, no install; your data is saved in your browser's local storage):**
👉 **https://jigugumiao.github.io/jiji_glb_play_creator/**

> ⚠️ This project is a companion asset tool for **[jigugumiao/jiji_text_game_editor (Story Editor)](https://github.com/jigugumiao/jiji_text_game_editor)**. Its **`.jgl` bundle export** is specifically designed to be imported by the Story Editor as a 3D item. The other two exports — **standalone viewer HTML / directory gallery HTML** — are self-contained web pages you can share on their own and do **not** depend on the Story Editor.

A **pure front-end** (vanilla HTML + JavaScript + three.js, zero dependencies, zero build step) **interactive 3D asset maker**. Import a GLB model, bind click behaviors to specific parts of the model (play an animation, play a sound, disappear after click), set a default camera view and trim animation clips, then export it as an interactive web page — or as a `.jgl` bundle to feed into the Story Editor for interactive fiction.

> Project name 「3D交互制作器」. This repo uses the `jiji_` prefix and is paired with the Story Editor `jiji_text_game_editor`.

## Features

- **Multi-model / folder management**: organize multiple GLB models and folders in a tree, with rename and add/remove.
- **Per-part interaction editing**: select a model, then bind click behaviors to specific meshes —
  - play an animation clip (with **clip trimming** `clipIn`/`clipOut`, loop / ping-pong / reset-after-play);
  - play a sound effect;
  - disappear after click (as an "exit object", useful for branching the story).
- **Interaction chains (puzzle order)**: the bottom dock lets you create multiple chains and drag trigger parts into them in sequence; on the same chain, a later part can only be clicked after the previous one has been clicked — perfect for ordered puzzles. Parts not in any chain are unrestricted. All parts **respond to a single click by default** (to avoid puzzle animations being reversed / replayed, e.g. a box opens and stays open), with an "allow multiple clicks" checkbox to lift the limit.
- **Default view**: save the current camera as the model's default view; "reset view" returns to it; applied automatically on next open.
- **Lock manual rotation**: when enabled, the exported result is pinned to the default view and the user cannot rotate (zoom / pan still allowed).
- **Three export forms**:
  1. **Standalone viewer HTML** (single model, GLB/sounds inlined, double-click to open and share);
  2. **Directory gallery HTML** (model list + 3D viewer, good for showcasing models);
  3. **`.jgl` bundle** (scene.json + GLB + sounds), imported by the Story Editor as a 3D item.

## Working with the Story Editor

This tool's **`.jgl` bundle** is for the **[jiji_text_game_editor (Story Editor)](https://github.com/jigugumiao/jiji_text_game_editor)**: import the `.jgl` there to use the 3D model as a summonable 3D item inside interactive fiction. The standalone / gallery exports do not depend on the Story Editor.

## Directory structure

```
index.html              entry (3D Interactive Asset Maker UI)
css/style.css           styles
js/main.js              main logic (project tree / interaction editing / export UI / interaction chains)
js/viewer.js            3D viewer (OrbitControls / GLTFLoader / AnimationMixer)
js/exporter.js          exports: standalone viewer / directory gallery / .jgl bundle
js/db.js                local project data (IndexedDB for binaries + localStorage for structure)
js/utils.js             utilities
js/zip.js               compression (.jgl packaging)
vendor/three/           three.js bundled locally (three.min.js / OrbitControls.js / GLTFLoader.js)
assets/audio/           sample sounds
_validate_exports.js    export validation script (dev use)
```

## Local usage

Just open `index.html` in a browser (no server, no dependencies). three.js is bundled with the repo (`vendor/three/`), so **the main app runs fully offline**; all project data is saved in the browser's local storage (IndexedDB + localStorage).

> The exported "standalone viewer HTML" is a self-contained single file (GLB/sounds inlined), but it loads three.js from the jsdelivr CDN, so **opening it requires internet**.

## Tech stack

- Vanilla JavaScript (classic script, no framework, no bundler)
- three.js (bundled locally, not CDN)
- HTML5 + CSS3
- Local storage: IndexedDB (binaries) + localStorage (structure)

## Open-source license

[MIT License](LICENSE) © 2026 jigugumiao
