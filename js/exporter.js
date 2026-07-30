// js/exporter.js — 导出功能
// 把工具里的某个 GLB 模型导出为独立、双击可用的 3D 查看器 HTML
// 输出文件 ≈ 3d-viewer-fixed.html（增强版：ACES色调、地面网格、自适应相机、Reset、统计）

// escapeHtml, downloadText 由 utils.js 提供为全局函数

const EXPORTER_VIEWER_SOURCE = String.raw`import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 内嵌查看器（基于 js/viewer.js 的 GLBViewer 类，精简为自包含版本）

const MODEL_NAME = __MODEL_NAME__;
let MODEL_SRC = __MODEL_BLOB__; // 用 let 以便加载完成后释放，降低内存占用
const DEFAULT_VIEW = __DEFAULT_VIEW__;
const LOCK_ROTATION = __LOCK_ROTATION__; // 关闭手动旋转：true 时禁止轨道旋转，固定在默认视角

// 剧情联动：内嵌模式（被剧情编辑器 iframe 召唤时为真）
// EMBED=true 时，点中 EXIT_MESHES 中任一部位会向父页面 postMessage 通知「结束场景」
const EMBED = __EMBED__;
const EXIT_MESHES = __EXIT_MESHES__;
const MODEL_ID = __MODEL_ID__;

// ============ 场景 ============
const scene = new THREE.Scene();
scene.background = __SCENE_BG__;

const container = document.getElementById('viewer');
const camera = new THREE.PerspectiveCamera(50, container.clientWidth / container.clientHeight, 0.01, 5000);
camera.position.set(3, 2, 5);

// ============ 像素滤镜 ============
// 思路：渲染到低分辨率 drawing buffer，再用 CSS 放大（image-rendering: pixelated）
// 得到硬边像素块。关闭 antialias 避免边缘被平滑掉，否则就没有像素感。
const PIXEL_SIZE = 2;            // 像素块大小：1=高清，2=轻度像素，越大越复古
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
renderer.setPixelRatio(1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

// 让 canvas 占满容器，由 CSS 放大产生像素感
renderer.domElement.style.width = '100%';
renderer.domElement.style.height = '100%';
renderer.domElement.style.imageRendering = 'pixelated';

// 按当前模式调整内部渲染分辨率（updateStyle=false 不改动 CSS 尺寸）
function resizeView() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w === 0 || h === 0) return;
  renderer.setSize(Math.max(1, Math.floor(w / PIXEL_SIZE)), Math.max(1, Math.floor(h / PIXEL_SIZE)), false);
}
resizeView();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.1;
controls.maxDistance = 1000;
// 关闭手动旋转：锁定后禁用轨道旋转，但保留缩放/平移（仅限制旋转），并固定在默认视角
if (LOCK_ROTATION) controls.enableRotate = false;

// ============ 灯光 ============
const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
keyLight.position.set(5, 8, 6);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0x88aaff, 0.5);
fillLight.position.set(-6, 3, -4);
scene.add(fillLight);

const ambLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambLight);

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x223344, 0.5);
scene.add(hemiLight);

// ============ 辅助 ============
const grid = new THREE.GridHelper(20, 20, 0x2a3142, 0x1d2230);
grid.material.opacity = 0.4;
grid.material.transparent = true;
grid.position.y = -0.001;
scene.add(grid);

const axes = new THREE.AxesHelper(0.5);
scene.add(axes);

// ============ 加载模型 ============
let currentModel = null;
let blobUrl = null;
let lastStats = null;

// 动画相关
let mixer = null;
let animActions = [];
let animPrevTime = 0;

// 点击交互相关
let raycaster = null;
let pointer = new THREE.Vector2();
let interactions = __INTERACTIONS__;
let SOUNDS = __SOUNDS__;            // soundId -> dataUrl
let soundCache = {};               // soundId -> Audio
let actionByName = {};
let actionByUuid = {};
let actionState = {};
let downX = 0, downY = 0;
// 点击反馈：放大 1% 仅一帧
let popObj = null, popBase = null, popActive = false;
// 动画结束后删除该物体：action.uuid -> 是否删除 / 触发该 action 的 mesh
let deleteFlag = {};
let triggerObj = {};
// 交互链 + 仅响应一次（成品运行时门禁）
let chains = __CHAINS__;             // [{ id, name, order:[meshName] }]
let _triggered = {};                 // meshName -> true：已被触发过（链推进与 once 限制）
function chainToast(msg) {
  if (typeof window.toast === 'function') { window.toast(msg, 'warn'); return; }
  var t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);background:rgba(20,24,33,.92);color:#ffd479;padding:8px 14px;border-radius:8px;font:13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;z-index:9999;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.4)';
  document.body.appendChild(t);
  setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(function(){ t.remove(); }, 400); }, 1400);
}
// 链门禁：不在任何链上→允许；在链上且非链首→需前一个已触发
function _chainUnlocked(meshName) {
  if (!chains || !chains.length) return true;
  for (var ci = 0; ci < chains.length; ci++) {
    var ch = chains[ci]; if (!ch || !ch.order) continue;
    var idx = ch.order.indexOf(meshName);
    if (idx > 0 && !_triggered[ch.order[idx - 1]]) return false;
  }
  return true;
}

const infoEl = document.getElementById('info');
const statsEl = document.getElementById('stats');
const errorEl = document.getElementById('error');

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.style.display = 'block';
}

// 剧情联动：点击「结束物体」时通知父页面（剧情编辑器）关闭 3D 界面、继续剧情
function notifyExit(meshName) {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'glb-scene-exit', id: MODEL_ID, mesh: meshName }, '*');
    }
  } catch (e) { /* 忽略跨域等异常 */ }
}

function dataUrlToBlobUrl(dataUrl) {
  const byteString = atob(dataUrl.split(',')[1]);
  const bytes = new Uint8Array(byteString.length);
  for (let i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
  const blob = new Blob([bytes], { type: 'model/gltf-binary' });
  return URL.createObjectURL(blob);
}

function disposeModel(model) {
  model.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const m of mats) {
        for (const k in m) {
          const v = m[k];
          if (v && typeof v === 'object' && 'minFilter' in v) v.dispose?.();
        }
        m.dispose();
      }
    }
  });
}

function loadModel() {
  _triggered = {};   // 重新加载模型时清空触发进度（单模型场景通常不重入，留作保险）
  blobUrl = dataUrlToBlobUrl(MODEL_SRC);
  const loader = new GLTFLoader();
  loader.load(
    blobUrl,
    (gltf) => {
      currentModel = gltf.scene;
      scene.add(currentModel);

      // 提取动画
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(currentModel);
        animActions = gltf.animations.map(clip => {
          var action = mixer.clipAction(clip);
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
          return action;
        });
      } else {
        mixer = null;
        animActions = [];
      }

      buildActionIndex();
      // 自动播放：未配置任何点击交互(增效)时，打开即播放首个动画一次并停在末帧
      if (mixer && animActions.length && Object.keys(interactions).length === 0) {
        animActions[0].reset();
        animActions[0].play();
      }
      initInteraction();

      // 包围盒 → 自适应相机
      const box = new THREE.Box3().setFromObject(currentModel);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z) || 1;

      currentModel.position.sub(center);

      const fov = camera.fov * (Math.PI / 180);
      let dist = Math.abs(maxDim / 2 / Math.tan(fov / 2));
      dist *= 1.8;

      camera.position.set(maxDim * 0.7, maxDim * 0.5, dist);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.minDistance = maxDim * 0.05;
      controls.maxDistance = maxDim * 20;
      controls.update();

      // 应用保存的默认视角（若有则覆盖自动取景）
      if (DEFAULT_VIEW && DEFAULT_VIEW.pos && DEFAULT_VIEW.target) {
        camera.position.fromArray(DEFAULT_VIEW.pos);
        controls.target.fromArray(DEFAULT_VIEW.target);
        camera.lookAt(controls.target);
        controls.update();
      }

      // 关闭手动旋转：锁定后确保旋转被禁用（默认视角即固定视角）
      if (LOCK_ROTATION) controls.enableRotate = false;

      axes.visible = maxDim > 0.3;
      grid.visible = maxDim < 50;

      // 统计
      let vertices = 0, triangles = 0, meshes = 0, materials = 0;
      const matSet = new Set();
      currentModel.traverse((obj) => {
        if (obj.isMesh) {
          meshes++;
          const geo = obj.geometry;
          if (geo) {
            const pos = geo.attributes.position;
            if (pos) vertices += pos.count;
            if (geo.index) triangles += geo.index.count / 3;
            else if (pos) triangles += pos.count / 3;
          }
          if (obj.material) {
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            for (const m of mats) {
              if (!matSet.has(m.uuid)) { matSet.add(m.uuid); materials++; }
            }
          }
        }
      });

      lastStats = { size, maxDim, vertices, triangles, meshes, materials };
      const fmt = (n) => n.toLocaleString();
      statsEl.textContent = '尺寸: ' + size.x.toFixed(2) + ' × ' + size.y.toFixed(2) + ' × ' + size.z.toFixed(2)
        + '  |  顶点: ' + fmt(vertices)
        + '  |  三角面: ' + fmt(Math.round(triangles))
        + '  |  网格: ' + meshes
        + '  |  材质: ' + materials;
      infoEl.textContent = '已加载: ' + MODEL_NAME + '  |  拖拽旋转 | 滚轮缩放 | 右键/中键平移';

      // 加载完成：释放 base64 源与临时 Blob URL，降低内存占用
      try { if (blobUrl) URL.revokeObjectURL(blobUrl); } catch (e) {}
      blobUrl = null;
      MODEL_SRC = null;
    },
    undefined,
    (err) => {
      console.error(err);
      showError('加载模型失败: ' + (err.message || err));
    }
  );
}

// ============ 工具栏 ============

function buildActionIndex() {
  actionByName = {};
  actionByUuid = {};
  actionState = {};
  if (mixer) {
    animActions.forEach(function(a) {
      var n = a.getClip().name;
      if (n) actionByName[n] = a;
      actionByUuid[a.uuid] = a;
      actionState[a.uuid] = 'idle';
    });
  }
}

function playSound(id) {
  if (!id || !SOUNDS[id]) return false;
  try {
    var audio = soundCache[id];
    if (!audio) { audio = new Audio(SOUNDS[id]); soundCache[id] = audio; }
    audio.currentTime = 0;
    var p = audio.play();
    if (p && p.catch) p.catch(function() {});
    return true;
  } catch (e) { return false; }
}

function triggerMeshInteraction(meshName, hitObj) {
  var entry = interactions[meshName];
  if (!entry) return false;
  var clipName = (typeof entry === 'string') ? entry : (entry.clip || '');
  var soundId = (typeof entry === 'string') ? '' : (entry.sound || '');
  var respond = (typeof entry === 'string') ? true : (entry.respond !== false);
  if (respond === false) return false; // 未勾选「响应点击」
  // 交互链门禁：同链上后一个部位需前一个已触发（成品运行时生效，便于做顺序解谜）
  if (!_chainUnlocked(meshName)) { return false; } // 链未解锁：静默拦截，不出戏（不再弹提示）
  // 仅响应一次：默认只响应一次点击；勾选「允许多次点击」(once===false) 才允许重复
  var once = (typeof entry === 'string') ? true : (entry.once !== false);
  if (once && _triggered[meshName]) { return false; } // 已触发过且 once：静默拦截，不出戏
  doPop(hitObj); // 放大 1% 一帧反馈
  _triggered[meshName] = true; // 标记已触发（推进链 / 限制 once）
  var did = false;
  var ping = (typeof entry === 'object') && (!!entry.pingpong);
  var auto = (typeof entry === 'object') && (!!entry.autoReturn);
  var del = (typeof entry === 'object') && (!!entry.deleteAfter);
  if (clipName) {
    if (clipName.indexOf('preset:') === 0) {
      playPreset(clipName.slice(7), hitObj, del); did = true;
    } else if (mixer) {
      var action = actionByName[clipName];
      if (action) {
        triggerObj[action.uuid] = hitObj;
        deleteFlag[action.uuid] = del;
        toggleAction(action, ping, auto); did = true;
      }
    }
  }
  if (soundId) {
    if (playSound(soundId)) did = true;
  }
  return true;
}

function doPop(obj) {
  if (!obj) return;
  if (popObj) popObj.scale.copy(popBase);   // 若上一帧反馈仍在进行，先还原，避免叠加
  popBase = obj.scale.clone();
  obj.scale.multiplyScalar(1.02);
  popObj = obj;
  popActive = true;
}

function toggleAction(action, pingpong, autoReturn) {
  var st = actionState[action.uuid] || 'idle';
  if (autoReturn) {
    // 连续自动归位：仅在 idle 时响应，播放中忽略
    if (st === 'idle') {
      action.reset(); action.setLoop(THREE.LoopOnce, 1); action.timeScale = 1; action.play();
      actionState[action.uuid] = 'auto-fwd';
    }
    return;
  }
  if (pingpong) {
    // 离散来回：正向 ↔ 倒放 交替，需两次点击
    if (st === 'idle' || st === 'ping-reverse') {
      action.reset(); action.setLoop(THREE.LoopOnce, 1); action.timeScale = 1; action.play();
      actionState[action.uuid] = 'ping-forward';
    } else if (st === 'ping-forward') {
      action.stop(); action.time = action.getClip().duration; action.timeScale = -1; action.play();
      actionState[action.uuid] = 'ping-reverse';
    }
    return;
  }
  // 普通：每次点击从头播放一次；播放中（st==='forward'）忽略再次点击，避免位置错位
  if (st === 'idle') {
    action.reset(); action.setLoop(THREE.LoopOnce, 1); action.timeScale = 1; action.play();
    actionState[action.uuid] = 'forward';
  }
}

// 动画结束后删除该物体：把触发该 action 的 mesh 从场景图中移除（不再渲染、不再可点击）
function maybeDeleteAfter(uid) {
  if (deleteFlag[uid]) {
    var obj = triggerObj[uid];
    if (obj && obj.parent) obj.parent.remove(obj);
    deleteFlag[uid] = false;
    triggerObj[uid] = null;
  }
}

function initInteraction() {
  raycaster = new THREE.Raycaster();
  var el = renderer.domElement;
  el.addEventListener('pointerdown', function(e) { downX = e.clientX; downY = e.clientY; });
  el.addEventListener('pointerup', function(e) {
    if (!currentModel) return;
    var dx = e.clientX - downX, dy = e.clientY - downY;
    if (Math.hypot(dx, dy) > 5) return;
    var rect = el.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    var hits = raycaster.intersectObject(currentModel, true);
    if (hits.length === 0) return;
    var hit = hits[0].object;
    var meshName = hit.name;
    // 剧情联动：命中「结束物体」→ 通知父页面结束场景（独立于该部位是否配置了其它交互）
    if (EMBED && meshName && EXIT_MESHES.indexOf(meshName) >= 0) notifyExit(meshName);
    triggerMeshInteraction(meshName, hit);
  });
}

// ============ 自适应 ============
window.addEventListener('resize', () => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w === 0 || h === 0) return;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  resizeView();
});

// ============ 内置简易动画（无需建模，直接绑定到部位） ============
var PRESET_ANIMS = {
  'jump':  { label: '（内置）向上跳一下', dur: 0.55, amp: function(d){ return d * 0.4; },          apply: function(o,t,b,a){ o.position.y = b.y + a * Math.sin(Math.PI * t); } },
  'shake': { label: '（内置）原地摇晃',   dur: 0.60, amp: function(){ return 0.13; },               apply: function(o,t,b,a){ o.rotation.z = b.rz + a * Math.sin(4 * Math.PI * t); } },
  'spin':  { label: '（内置）旋转一圈',   dur: 1.00, amp: function(){ return Math.PI * 2; },        apply: function(o,t,b,a){ o.rotation.y = b.ry + a * t; } },
  'nod':   { label: '（内置）点头',       dur: 0.60, amp: function(){ return 0.28; },               apply: function(o,t,b,a){ o.rotation.x = b.rx + a * Math.sin(Math.PI * t); } },
};
var activePresets = [];

function animate(time) {
  requestAnimationFrame(animate);

  var now = time || performance.now();
  var delta = animPrevTime ? (now - animPrevTime) / 1000 : 0.016;
  animPrevTime = now;

  // 点击反馈：放大 1% 仅维持一帧（让玩家看到反馈），下一帧在 mixer 更新前还原（避免与动画冲突）
  if (popObj) {
    if (popActive) {
      popActive = false;          // 已显示一帧，下一帧还原
    } else {
      popObj.scale.copy(popBase);
      popObj = null; popBase = null;
    }
  }

  if (mixer) {
    mixer.update(delta);
    for (var uid in actionState) {
      var act = actionByUuid[uid];
      if (!act) continue;
      var st = actionState[uid];
      if (st === 'auto-fwd') {
        if (act.time >= act.getClip().duration - 0.03) {
          act.stop(); act.time = act.getClip().duration; act.timeScale = -1; act.play();
          actionState[uid] = 'auto-bwd';
        }
      } else if (st === 'auto-bwd') {
        if (act.time <= 0.03) { act.stop(); actionState[uid] = 'idle'; maybeDeleteAfter(uid); }
      } else if (st === 'ping-forward') {
        // 离散正向：播完保持，等待下次点击才倒放（不自动归位）
      } else if (st === 'ping-reverse') {
        if (act.time <= 0.03) { act.stop(); actionState[uid] = 'idle'; maybeDeleteAfter(uid); }
      } else if (st === 'forward') {
        if (act.time >= act.getClip().duration - 0.03) { actionState[uid] = 'idle'; maybeDeleteAfter(uid); }
      }
    }
  }

  // 内置简易动画推进（不依赖 mixer）
  for (var i = activePresets.length - 1; i >= 0; i--) {
    var p = activePresets[i];
    p.t += delta / p.dur;
    var t = Math.min(p.t, 1);
    PRESET_ANIMS[p.name].apply(p.obj, t, p.base, p.amp);
    if (p.t >= 1) {
      p.obj.position.y = p.base.y; p.obj.rotation.x = p.base.rx; p.obj.rotation.y = p.base.ry; p.obj.rotation.z = p.base.rz;
      activePresets.splice(i, 1);
      if (p.del && p.obj.parent) p.obj.parent.remove(p.obj);
    }
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();

function playPreset(name, obj, del) {
  if (!obj || !PRESET_ANIMS[name]) return;
  // 正在播放内置动画的部位禁止再次触发，避免位置错位累积
  for (var i = 0; i < activePresets.length; i++) {
    if (activePresets[i].obj === obj) return;
  }
  var def = PRESET_ANIMS[name];
  var box = new THREE.Box3().setFromObject(obj);
  var s = new THREE.Vector3(); box.getSize(s);
  var maxDim = Math.max(s.x, s.y, s.z) || 1;
  activePresets.push({ name: name, obj: obj, t: 0, dur: def.dur, del: !!del,
    base: { y: obj.position.y, rx: obj.rotation.x, ry: obj.rotation.y, rz: obj.rotation.z }, amp: def.amp(maxDim) });
}

// 剧情联动：内嵌模式下隐藏工具栏，给剧情一个干净的 3D 全屏界面
if (EMBED) {
  var _tb = document.getElementById('toolbar');
  if (_tb) _tb.style.display = 'none';
}

loadModel();
`;

// 从交互配置里收集所有「结束物体」（mesh 名数组）
function collectExitMeshes(interactions) {
  const arr = [];
  const map = interactions || {};
  for (const k in map) {
    const v = map[k];
    const exit = (typeof v === 'string') ? false : !!v.exit;
    if (exit) arr.push(k);
  }
  return arr;
}

// 模板：把 viewer 源码和模型元数据塞进去
// embed/exitMeshes/modelId 用于剧情联动：embed=true 时该 HTML 被剧情编辑器 iframe 召唤，
// 点中 exitMeshes 中任一部位会向父页面 postMessage({type:'glb-scene-exit', id, mesh}) 通知结束场景
function buildStandaloneHTML(modelName, base64DataUrl, bgSettings, interactions, sounds, defaultView, embed, exitMeshes, modelId, lockRotation, chains) {
  // 转义 modelName：放到 JS 字符串里需要转义反引号、反斜杠、${}
  const safeName = modelName.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\${/g, '\\${');
  const safeBlob = base64DataUrl; // base64 本身不含特殊字符

  // 生成 scene.background 设置代码
  var bgCode;
  if (!bgSettings || bgSettings.type === 'solid') {
    var c = bgSettings?.color1 || '#000000';
    bgCode = 'new THREE.Color(0x' + c.replace('#', '') + ')';
  } else {
    bgCode = '(function(){var c=document.createElement("canvas");c.width=1024;c.height=1024;var ctx=c.getContext("2d");';
    var dir = bgSettings.direction || 'vertical';
    if (dir === 'horizontal') bgCode += 'var g=ctx.createLinearGradient(0,0,1024,0);';
    else if (dir === 'diagonal') bgCode += 'var g=ctx.createLinearGradient(0,0,1024,1024);';
    else if (dir === 'radial') bgCode += 'var g=ctx.createRadialGradient(512,512,0,512,512,720);';
    else bgCode += 'var g=ctx.createLinearGradient(0,0,0,1024);';
    bgCode += 'g.addColorStop(0,"' + bgSettings.color1 + '");g.addColorStop(1,"' + bgSettings.color2 + '");';
    bgCode += 'ctx.fillStyle=g;ctx.fillRect(0,0,1024,1024);return new THREE.CanvasTexture(c);})()';
  }

  // CSS body background for the page while loading
  var bodyBg;
  if (!bgSettings || bgSettings.type === 'solid') {
    bodyBg = bgSettings?.color1 || '#000000';
  } else {
    var dir2 = bgSettings.direction || 'vertical';
    if (dir2 === 'horizontal') bodyBg = 'linear-gradient(to right, ' + bgSettings.color1 + ', ' + bgSettings.color2 + ')';
    else if (dir2 === 'diagonal') bodyBg = 'linear-gradient(to bottom right, ' + bgSettings.color1 + ', ' + bgSettings.color2 + ')';
    else if (dir2 === 'radial') bodyBg = 'radial-gradient(circle, ' + bgSettings.color1 + ', ' + bgSettings.color2 + ')';
    else bodyBg = 'linear-gradient(to bottom, ' + bgSettings.color1 + ', ' + bgSettings.color2 + ')';
  }

  const viewerScript = EXPORTER_VIEWER_SOURCE
    .replace('__MODEL_NAME__', '`' + safeName + '`')
    .replace('__MODEL_BLOB__', '`' + safeBlob + '`')
    .replace('__SCENE_BG__', bgCode)
    .replace('__INTERACTIONS__', JSON.stringify(interactions || {}).replace(/</g, '\\u003c'))
    .replace('__CHAINS__', JSON.stringify(chains || []).replace(/</g, '\\u003c'))
    .replace('__SOUNDS__', JSON.stringify(sounds || {}).replace(/</g, '\\u003c'))
    .replace('__DEFAULT_VIEW__', JSON.stringify(defaultView || null))
    .replace('__LOCK_ROTATION__', lockRotation ? 'true' : 'false')
    .replace('__EMBED__', embed ? 'true' : 'false')
    .replace('__EXIT_MESHES__', JSON.stringify(exitMeshes || []))
    .replace('__MODEL_ID__', JSON.stringify(modelId || ''));

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>3D 查看器 - ${escapeHtml(modelName)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; overflow: hidden; background: ${bodyBg}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #e6e9ef; }
  #toolbar {
    position: absolute; top: 12px; right: 12px; z-index: 10;
    display: flex; gap: 8px;
  }
  #toolbar button {
    padding: 8px 14px;
    background: rgba(20, 24, 33, 0.85);
    color: #e6e9ef;
    border: 1px solid #2a3142;
    border-radius: 8px;
    cursor: pointer;
    font-size: 13px;
    backdrop-filter: blur(8px);
    transition: all 0.15s;
  }
  #toolbar button:hover {
    background: rgba(58, 134, 255, 0.25);
    border-color: #3a86ff;
  }
  #viewer { position: absolute; inset: 0; }
  canvas { width: 100% !important; height: 100% !important; display: block; image-rendering: pixelated; }
  #info {
    position: absolute; top: 12px; left: 12px;
    color: #00ff88; font-family: monospace; font-size: 13px;
    background: rgba(0, 0, 0, 0.6); padding: 8px 12px; border-radius: 6px;
    pointer-events: none; user-select: none; max-width: 60%;
  }
  #stats {
    position: absolute; bottom: 12px; left: 12px; right: 12px;
    color: #9aa3b2; font-family: monospace; font-size: 12px;
    background: rgba(0, 0, 0, 0.6); padding: 8px 12px; border-radius: 6px;
    pointer-events: none; user-select: none;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  #error {
    position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
    color: #ff5566; font-family: monospace; font-size: 15px;
    background: rgba(0, 0, 0, 0.85); padding: 20px 30px; border-radius: 8px;
    display: none; max-width: 80%; text-align: center;
  }
</style>
</head>
<body>
<div id="toolbar"></div>
<div id="viewer"></div>
<div id="info">⏳ 加载中: ${escapeHtml(modelName)}</div>
<div id="stats"></div>
<div id="error"></div>

<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
  }
}
${"<" + "/script>"}

<script type="module">
${viewerScript}
${"<" + "/script>"}
</body>
</html>
`;
}

// 主入口：导出单个 GLB 为独立 HTML 并下载
// DB 由调用方传入（多文件版用 import 的 DB；单文件版用 window.DB）
async function exportModelAsStandaloneHTML(modelId, DB, bgSettings) {
  if (!DB) throw new Error('DB 未传入');
  const node = DB.getNode(modelId);
  if (!node || node.type !== 'model') throw new Error('节点不是模型');
  const blob = await DB.blobGet(node.blobId);
  if (!blob) throw new Error('模型数据丢失');
  const dataUrl = await blobToDataUrl(blob); // 导出 HTML 需自包含 base64
  const interactions = DB.getInteractions(modelId) || {};
  const chains = DB.getChains(modelId) || []; // 交互链（解谜顺序）
  // 收集交互里引用的音效，内联进 HTML（保持自包含）
  const sounds = {};
  for (const k in interactions) {
    const v = interactions[k];
    const sid = (typeof v === 'string') ? '' : (v.sound || '');
    if (sid && !sounds[sid]) {
      const d = await DB.getSoundDataUrl(sid);
      if (d) sounds[sid] = d;
    }
  }
  const html = buildStandaloneHTML(node.name, dataUrl, bgSettings, interactions, sounds, node.defaultView || null, false, collectExitMeshes(interactions), '', !!node.lockRotation, chains);
  const safeName = (node.name || 'model').replace(/[\\/:*?"<>|]/g, '_');
  const filename = safeName.replace(/\.glb$/i, '') + '.html';
  downloadText(html, filename, 'text/html;charset=utf-8');
  return { size: html.length, filename };
}

// ============ 目录模型库导出 ============

// === Directory gallery export (sci-fi vertical list + 3D viewer) ===

// Gallery script: regular <script> (not module) so navigation renders immediately.
// Three.js is loaded via dynamic import() only when user enters 3D view.
// This ensures the file/folder list works even if CDN is unreachable.
const GALLERY_VIEWER_SOURCE = String.raw`
var DATA = JSON.parse(document.getElementById('models-data').textContent);
var _lastFolder = 'root';
var _3dReady = false;
var _3dLoading = false;
var _3dPromise = null;
var THREE, OrbitControls, GLTFLoader;
var currentModel = null;
var blobUrl = null;
var scene, camera, renderer, controls, viewEl;
var mixer = null;
var animActions = [];
var animPrevTime = 0;
var PIXEL_SIZE = 2;

// 点击交互相关（THREE 动态加载，raycaster/pointer 在 initInteraction 里创建）
var raycaster = null;
var pointer = null;
var interactions = {};
var SOUNDS = {};                 // soundId -> dataUrl（随模型切换）
var soundCache = {};            // soundId -> Audio
var actionByName = {};
var actionByUuid = {};
var actionState = {};
var downX = 0, downY = 0;
// 点击反馈：放大 1% 仅一帧
var popObj = null, popBase = null, popActive = false;
// 动画结束后删除该物体：action.uuid -> 是否删除 / 触发该 action 的 mesh
var deleteFlag = {};
var triggerObj = {};
// 交互链 + 仅响应一次（成品运行时门禁）
var chains = [];
var _triggered = {};
function chainToast(msg) {
  if (typeof window.toast === 'function') { window.toast(msg, 'warn'); return; }
  var t = document.createElement('div');
  t.textContent = msg;
  t.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);background:rgba(20,24,33,.92);color:#ffd479;padding:8px 14px;border-radius:8px;font:13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;z-index:9999;pointer-events:none;box-shadow:0 4px 16px rgba(0,0,0,.4)';
  document.body.appendChild(t);
  setTimeout(function(){ t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(function(){ t.remove(); }, 400); }, 1400);
}
// 链门禁：不在任何链上→允许；在链上且非链首→需前一个已触发
function _chainUnlocked(meshName) {
  if (!chains || !chains.length) return true;
  for (var ci = 0; ci < chains.length; ci++) {
    var ch = chains[ci]; if (!ch || !ch.order) continue;
    var idx = ch.order.indexOf(meshName);
    if (idx > 0 && !_triggered[ch.order[idx - 1]]) return false;
  }
  return true;
}

function escHtml(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function showError(msg) {
  var el = document.getElementById('error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function hideError() {
  var el = document.getElementById('error');
  if (el) el.style.display = 'none';
}

function dataUrlToBlobUrl(dataUrl) {
  var byteString = atob(dataUrl.split(',')[1]);
  var bytes = new Uint8Array(byteString.length);
  for (var i = 0; i < byteString.length; i++) bytes[i] = byteString.charCodeAt(i);
  var blob = new Blob([bytes], { type: 'model/gltf-binary' });
  return URL.createObjectURL(blob);
}

function disposeModel(model) {
  if (!model) return;
  model.traverse(function(obj) {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (var mi = 0; mi < mats.length; mi++) mats[mi].dispose();
    }
  });
}

function countModels(fid) {
  var folder = DATA.folders[fid];
  if (!folder) return 0;
  var count = 0;
  folder.entries.forEach(function(e) {
    if (e.kind === 'model') count++;
    else if (e.kind === 'folder') count += countModels(e.id);
  });
  return count;
}

function renderList(fid) {
  fid = fid || 'root';
  var folder = DATA.folders[fid];
  if (!folder) { fid = 'root'; folder = DATA.folders.root; }

  document.getElementById('title').textContent = folder.name;

  // Apply folder background
  if (folder.bg) {
    document.body.style.background = folder.bg;
    document.body.style.backgroundAttachment = 'fixed';
  }

  var descEl = document.getElementById('desc');
  if (folder.desc) {
    descEl.textContent = folder.desc;
    descEl.style.display = 'block';
  } else {
    descEl.textContent = '';
    descEl.style.display = 'none';
  }

  var bc = [];
  var cur = fid;
  while (cur && DATA.folders[cur]) {
    bc.unshift({ id: cur, name: DATA.folders[cur].name });
    cur = DATA.folders[cur].parent;
  }
  var bcHtml = '';
  for (var i = 0; i < bc.length; i++) {
    if (i < bc.length - 1) {
      bcHtml += '<a href="#/f/' + bc[i].id + '" class="bc-link">' + escHtml(bc[i].name) + '</a><span class="bc-sep">/</span>';
    } else {
      bcHtml += '<span class="bc-current">' + escHtml(bc[i].name) + '</span>';
    }
  }
  document.getElementById('breadcrumb').innerHTML = bcHtml;

  // Show back button when not at root
  var backBtn = document.getElementById('back-view');
  if (backBtn) {
    if (fid !== 'root') {
      backBtn.textContent = '\u2190 BACK';
      backBtn.style.display = 'block';
      document.body.classList.add('has-back');
    } else {
      backBtn.style.display = 'none';
      document.body.classList.remove('has-back');
    }
  }

  var gridEl = document.getElementById('grid');
  var html = '';
  if (folder.entries.length === 0) {
    html = '<div class="empty">空目录</div>';
  } else {
    folder.entries.forEach(function(e) {
      if (e.kind === 'folder') {
        html += '<div class="tile folder" onclick="navigateFolder(\'' + e.id + '\')">'
          + '<div class="tile-name">' + escHtml(e.name) + '</div>'
          + '</div>';
      } else {
        html += '<div class="tile model" onclick="openModel(' + e.idx + ')">'
          + '<div class="tile-name">' + escHtml(e.name) + '</div>'
          + '</div>';
      }
    });
  }
  gridEl.innerHTML = html;
}

function navigateFolder(fid) { location.hash = '#/f/' + fid; }
function openModel(index) { location.hash = '#/m/' + index; }

function goBack() {
  var hash = location.hash || '#/';
  if (hash.match(/^#\/m\/(\d+)$/)) {
    location.hash = '#/f/' + _lastFolder;
    return;
  }
  var f = hash.match(/^#\/f\/(.+)$/);
  if (f) {
    var folder = DATA.folders[f[1]];
    if (folder && folder.parent) location.hash = '#/f/' + folder.parent;
    else location.hash = '#/';
  } else {
    location.hash = '#/';
  }
}


function buildActionIndex() {
  actionByName = {};
  actionByUuid = {};
  actionState = {};
  if (mixer) {
    animActions.forEach(function(a) {
      var n = a.getClip().name;
      if (n) actionByName[n] = a;
      actionByUuid[a.uuid] = a;
      actionState[a.uuid] = 'idle';
    });
  }
}

function playSound(id) {
  if (!id || !SOUNDS[id]) return false;
  try {
    var audio = soundCache[id];
    if (!audio) { audio = new Audio(SOUNDS[id]); soundCache[id] = audio; }
    audio.currentTime = 0;
    var p = audio.play();
    if (p && p.catch) p.catch(function() {});
    return true;
  } catch (e) { return false; }
}

function triggerMeshInteraction(meshName, hitObj) {
  var entry = interactions[meshName];
  if (!entry) return false;
  var clipName = (typeof entry === 'string') ? entry : (entry.clip || '');
  var soundId = (typeof entry === 'string') ? '' : (entry.sound || '');
  var respond = (typeof entry === 'string') ? true : (entry.respond !== false);
  if (respond === false) return false; // 未勾选「响应点击」
  // 交互链门禁：同链上后一个部位需前一个已触发（成品运行时生效，便于做顺序解谜）
  if (!_chainUnlocked(meshName)) { return false; } // 链未解锁：静默拦截，不出戏（不再弹提示）
  // 仅响应一次：默认只响应一次点击；勾选「允许多次点击」(once===false) 才允许重复
  var once = (typeof entry === 'string') ? true : (entry.once !== false);
  if (once && _triggered[meshName]) { return false; } // 已触发过且 once：静默拦截，不出戏
  doPop(hitObj); // 放大 1% 一帧反馈
  _triggered[meshName] = true; // 标记已触发（推进链 / 限制 once）
  var did = false;
  var ping = (typeof entry === 'object') && (!!entry.pingpong);
  var auto = (typeof entry === 'object') && (!!entry.autoReturn);
  var del = (typeof entry === 'object') && (!!entry.deleteAfter);
  if (clipName) {
    if (clipName.indexOf('preset:') === 0) {
      playPreset(clipName.slice(7), hitObj, del); did = true;
    } else if (mixer) {
      var action = actionByName[clipName];
      if (action) {
        triggerObj[action.uuid] = hitObj;
        deleteFlag[action.uuid] = del;
        toggleAction(action, ping, auto); did = true;
      }
    }
  }
  if (soundId) {
    if (playSound(soundId)) did = true;
  }
  return true;
}

function doPop(obj) {
  if (!obj) return;
  if (popObj) popObj.scale.copy(popBase);   // 若上一帧反馈仍在进行，先还原，避免叠加
  popBase = obj.scale.clone();
  obj.scale.multiplyScalar(1.02);
  popObj = obj;
  popActive = true;
}

function toggleAction(action, pingpong, autoReturn) {
  var st = actionState[action.uuid] || 'idle';
  if (autoReturn) {
    // 连续自动归位：仅在 idle 时响应，播放中忽略
    if (st === 'idle') {
      action.reset(); action.setLoop(THREE.LoopOnce, 1); action.timeScale = 1; action.play();
      actionState[action.uuid] = 'auto-fwd';
    }
    return;
  }
  if (pingpong) {
    // 离散来回：正向 ↔ 倒放 交替，需两次点击
    if (st === 'idle' || st === 'ping-reverse') {
      action.reset(); action.setLoop(THREE.LoopOnce, 1); action.timeScale = 1; action.play();
      actionState[action.uuid] = 'ping-forward';
    } else if (st === 'ping-forward') {
      action.stop(); action.time = action.getClip().duration; action.timeScale = -1; action.play();
      actionState[action.uuid] = 'ping-reverse';
    }
    return;
  }
  // 普通：每次点击从头播放一次；播放中（st==='forward'）忽略再次点击，避免位置错位
  if (st === 'idle') {
    action.reset(); action.setLoop(THREE.LoopOnce, 1); action.timeScale = 1; action.play();
    actionState[action.uuid] = 'forward';
  }
}

// 动画结束后删除该物体：把触发该 action 的 mesh 从场景图中移除（不再渲染、不再可点击）
function maybeDeleteAfter(uid) {
  if (deleteFlag[uid]) {
    var obj = triggerObj[uid];
    if (obj && obj.parent) obj.parent.remove(obj);
    deleteFlag[uid] = false;
    triggerObj[uid] = null;
  }
}

function initInteraction() {
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  var el = renderer.domElement;
  el.addEventListener('pointerdown', function(e) { downX = e.clientX; downY = e.clientY; });
  el.addEventListener('pointerup', function(e) {
    if (!currentModel) return;
    var dx = e.clientX - downX, dy = e.clientY - downY;
    if (Math.hypot(dx, dy) > 5) return;
    var rect = el.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    var hits = raycaster.intersectObject(currentModel, true);
    if (hits.length === 0) return;
    var hit = hits[0].object;
    var meshName = hit.name;
    triggerMeshInteraction(meshName, hit);
  });
}

// ============ 像素滤镜 ============
// 渲染到低分辨率 drawing buffer，再用 CSS（image-rendering: pixelated）放大成硬边像素块
function resizeView() {
  var rw = viewEl.clientWidth || window.innerWidth;
  var rh = viewEl.clientHeight || window.innerHeight;
  if (rw === 0 || rh === 0) return;
  renderer.setSize(Math.max(1, Math.floor(rw / PIXEL_SIZE)), Math.max(1, Math.floor(rh / PIXEL_SIZE)), false);
}

// --- Dynamic Three.js loader (only loads when user enters 3D view) ---
async function init3D() {
  if (_3dReady) return true;
  if (_3dLoading) { await _3dPromise; return _3dReady; }
  _3dLoading = true;
  try {
    _3dPromise = Promise.all([
      import('three'),
      import('three/addons/controls/OrbitControls.js'),
      import('three/addons/loaders/GLTFLoader.js')
    ]);
    var mods = await _3dPromise;
    THREE = mods[0];
    OrbitControls = mods[1].OrbitControls;
    GLTFLoader = mods[2].GLTFLoader;
    _3dReady = true;
    return true;
  } catch (err) {
    console.error('Three.js load failed:', err);
    showError('3D engine load failed — check network');
    _3dLoading = false;
    return false;
  }
}

function setupScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x080b14);
  viewEl = document.getElementById('view');
  var w = viewEl.clientWidth || window.innerWidth;
  var h = viewEl.clientHeight || window.innerHeight;
  camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 5000);
  camera.position.set(3, 2, 5);
  renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  renderer.setPixelRatio(1);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.imageRendering = 'pixelated';
  viewEl.appendChild(renderer.domElement);
  resizeView();
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  var key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(5, 8, 6);
  scene.add(key);
  var fill = new THREE.DirectionalLight(0x6688cc, 0.4);
  fill.position.set(-6, 3, -4);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(0x8899bb, 0.5));
  window.addEventListener('resize', function() {
    var rw = viewEl.clientWidth || window.innerWidth;
    var rh = viewEl.clientHeight || window.innerHeight;
    if (rw === 0 || rh === 0) return;
    camera.aspect = rw / rh;
    camera.updateProjectionMatrix();
    resizeView();
  });
  initInteraction();
  animate();
}

function animate(time) {
  requestAnimationFrame(animate);
  var now = time || performance.now();
  var delta = animPrevTime ? (now - animPrevTime) / 1000 : 0.016;
  animPrevTime = now;
  // 点击反馈：放大 1% 仅维持一帧（让玩家看到反馈），下一帧在 mixer 更新前还原（避免与动画冲突）
  if (popObj) {
    if (popActive) {
      popActive = false;          // 已显示一帧，下一帧还原
    } else {
      popObj.scale.copy(popBase);
      popObj = null; popBase = null;
    }
  }

  if (mixer) {
    mixer.update(delta);
    for (var uid in actionState) {
      var act = actionByUuid[uid];
      if (!act) continue;
      var st = actionState[uid];
      if (st === 'auto-fwd') {
        if (act.time >= act.getClip().duration - 0.03) {
          act.stop(); act.time = act.getClip().duration; act.timeScale = -1; act.play();
          actionState[uid] = 'auto-bwd';
        }
      } else if (st === 'auto-bwd') {
        if (act.time <= 0.03) { act.stop(); actionState[uid] = 'idle'; maybeDeleteAfter(uid); }
      } else if (st === 'ping-forward') {
        // 离散正向：播完保持，等待下次点击才倒放（不自动归位）
      } else if (st === 'ping-reverse') {
        if (act.time <= 0.03) { act.stop(); actionState[uid] = 'idle'; maybeDeleteAfter(uid); }
      } else if (st === 'forward') {
        if (act.time >= act.getClip().duration - 0.03) { actionState[uid] = 'idle'; maybeDeleteAfter(uid); }
      }
    }
  }
  // 内置简易动画推进（不依赖 mixer）
  for (var i = activePresets.length - 1; i >= 0; i--) {
    var p = activePresets[i];
    p.t += delta / p.dur;
    var t = Math.min(p.t, 1);
    PRESET_ANIMS[p.name].apply(p.obj, t, p.base, p.amp);
    if (p.t >= 1) {
      p.obj.position.y = p.base.y; p.obj.rotation.x = p.base.rx; p.obj.rotation.y = p.base.ry; p.obj.rotation.z = p.base.rz;
      activePresets.splice(i, 1);
      if (p.del && p.obj.parent) p.obj.parent.remove(p.obj);
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

// ============ 内置简易动画（无需建模，直接绑定到部位） ============
var PRESET_ANIMS = {
  'jump':  { label: '（内置）向上跳一下', dur: 0.55, amp: function(d){ return d * 0.4; },          apply: function(o,t,b,a){ o.position.y = b.y + a * Math.sin(Math.PI * t); } },
  'shake': { label: '（内置）原地摇晃',   dur: 0.60, amp: function(){ return 0.13; },               apply: function(o,t,b,a){ o.rotation.z = b.rz + a * Math.sin(4 * Math.PI * t); } },
  'spin':  { label: '（内置）旋转一圈',   dur: 1.00, amp: function(){ return Math.PI * 2; },        apply: function(o,t,b,a){ o.rotation.y = b.ry + a * t; } },
  'nod':   { label: '（内置）点头',       dur: 0.60, amp: function(){ return 0.28; },               apply: function(o,t,b,a){ o.rotation.x = b.rx + a * Math.sin(Math.PI * t); } },
};
var activePresets = [];
function playPreset(name, obj, del) {
  if (!obj || !PRESET_ANIMS[name]) return;
  // 正在播放内置动画的部位禁止再次触发，避免位置错位累积
  for (var i = 0; i < activePresets.length; i++) {
    if (activePresets[i].obj === obj) return;
  }
  var def = PRESET_ANIMS[name];
  var box = new THREE.Box3().setFromObject(obj);
  var s = new THREE.Vector3(); box.getSize(s);
  var maxDim = Math.max(s.x, s.y, s.z) || 1;
  activePresets.push({ name: name, obj: obj, t: 0, dur: def.dur, del: !!del,
    base: { y: obj.position.y, rx: obj.rotation.x, ry: obj.rotation.y, rz: obj.rotation.z }, amp: def.amp(maxDim) });
}

function setViewBg(cssBg) {
  var viewEl2 = document.getElementById('view');
  if (!cssBg) {
    scene.background = new THREE.Color(0x080b14);
    if (viewEl2) viewEl2.style.background = '#080b14';
    return;
  }
  if (viewEl2) viewEl2.style.background = cssBg;
  if (cssBg[0] === '#') {
    scene.background = new THREE.Color(cssBg);
    return;
  }
  var colors = cssBg.match(/#[0-9a-fA-F]{6}/g);
  if (!colors || colors.length < 2) return;
  var c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  var ctx = c.getContext('2d');
  var grad;
  if (cssBg.indexOf('radial') >= 0) {
    grad = ctx.createRadialGradient(512, 512, 0, 512, 512, 720);
  } else if (cssBg.indexOf('to right') >= 0) {
    grad = ctx.createLinearGradient(0, 0, 1024, 0);
  } else if (cssBg.indexOf('to bottom right') >= 0) {
    grad = ctx.createLinearGradient(0, 0, 1024, 1024);
  } else {
    grad = ctx.createLinearGradient(0, 0, 0, 1024);
  }
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(1, colors[1]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 1024);
  scene.background = new THREE.CanvasTexture(c);
}

function loadModel(index) {
  if (index < 0 || index >= DATA.models.length) return;
  // 清理旧动画
  if (mixer) { animActions.forEach(function(a) { a.stop(); }); mixer = null; animActions = []; }
  if (currentModel) { scene.remove(currentModel); disposeModel(currentModel); currentModel = null; }
  if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
  hideError();
  var model = DATA.models[index];
  document.getElementById('name').textContent = model.name;
  var loader = new GLTFLoader();
  blobUrl = dataUrlToBlobUrl(model.data);
  loader.load(blobUrl, function(gltf) {
    currentModel = gltf.scene;
    scene.add(currentModel);

    // 提取动画
    if (gltf.animations && gltf.animations.length > 0) {
      mixer = new THREE.AnimationMixer(currentModel);
      animActions = gltf.animations.map(function(clip) {
        var action = mixer.clipAction(clip);
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
        return action;
      });
    } else {
      mixer = null;
      animActions = [];
    }

    buildActionIndex();
    interactions = model.interactions || {};
    chains = model.chains || [];     // 交互链顺序（解谜）
    _triggered = {};                 // 切换模型时清空触发进度
    // 自动播放：未配置点击交互(增效)时，打开即播放首个动画一次并停在末帧
    if (mixer && animActions.length && Object.keys(interactions).length === 0) {
      animActions[0].reset();
      animActions[0].play();
    }
    SOUNDS = model.sounds || {};
    soundCache = {};

    var box = new THREE.Box3().setFromObject(currentModel);
    var size = box.getSize(new THREE.Vector3());
    var center = box.getCenter(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z) || 1;
    currentModel.position.sub(center);
    var fov = camera.fov * (Math.PI / 180);
    var dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.8;
    camera.position.set(maxDim * 0.7, maxDim * 0.5, dist);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.minDistance = maxDim * 0.05;
    controls.maxDistance = maxDim * 20;
    controls.update();
    // 应用保存的默认视角（若有则覆盖自动取景）
    if (model.defaultView && model.defaultView.pos && model.defaultView.target) {
      camera.position.fromArray(model.defaultView.pos);
      controls.target.fromArray(model.defaultView.target);
      camera.lookAt(controls.target);
      controls.update();
    }
    // 关闭手动旋转：锁定后禁用轨道旋转，固定在默认视角
    if (model.lockRotation) controls.enableRotate = false;
  }, undefined, function(err) {
    console.error(err);
    showError('Load failed: ' + model.name);
  });
}

async function handleHashChange() {
  var hash = location.hash || '#/';
  var mMatch = hash.match(/^#\/m\/(\d+)$/);
  var fMatch = hash.match(/^#\/f\/(.+)$/);
  if (mMatch) {
    document.body.classList.remove('mode-list');
    document.body.classList.add('mode-view');
    var backBtn = document.getElementById('back-view');
    if (backBtn) { backBtn.textContent = '\u2190 BACK'; backBtn.style.display = 'block'; }
    // Apply model bg (with folder fallback) to 3D view
    var mIdx = parseInt(mMatch[1], 10);
    var mBg = DATA.models[mIdx] && DATA.models[mIdx].bg;
    var fBg = !mBg && DATA.folders[_lastFolder] && DATA.folders[_lastFolder].bg;
    if (mBg) document.body.style.background = mBg;
    else if (fBg) document.body.style.background = fBg;
    var ok = await init3D();
    if (!ok) return;
    if (!scene) setupScene();
    setViewBg(mBg || fBg);
    loadModel(mIdx);
  } else {
    var fid = fMatch ? fMatch[1] : 'root';
    // ...(handleHashChange list mode follows)
    _lastFolder = fid;
    document.body.classList.remove('mode-view');
    document.body.classList.add('mode-list');
    if (currentModel) { scene.remove(currentModel); disposeModel(currentModel); currentModel = null; }
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
    hideError();
    document.getElementById('name').textContent = '';
    renderList(fid);
  }
}

window.addEventListener('hashchange', handleHashChange);
window.navigateFolder = navigateFolder;
window.openModel = openModel;
window.goBack = goBack;

// Init immediately — as a classic <script> in <body>, preceding DOM elements are available
(function initGallery() {
  var hash = location.hash || '#/';
  var mMatch = hash.match(/^#\/m\/(\d+)$/);
  var fMatch = hash.match(/^#\/f\/(.+)$/);
  if (mMatch) {
    _lastFolder = 'root';
    document.body.classList.add('mode-view');
    var backBtn = document.getElementById('back-view');
    if (backBtn) { backBtn.textContent = '\u2190 BACK'; backBtn.style.display = 'block'; }
    var mIdx = parseInt(mMatch[1], 10);
    var mBg = DATA.models[mIdx] && DATA.models[mIdx].bg;
    var fBg = !mBg && DATA.folders['root'] && DATA.folders['root'].bg;
    if (mBg) document.body.style.background = mBg;
    else if (fBg) document.body.style.background = fBg;
    init3D().then(function(ok) {
      if (!ok) return;
      if (!scene) setupScene();
      setViewBg(mBg || fBg);
      loadModel(mIdx);
    });
  } else {
    var fid = fMatch ? fMatch[1] : 'root';
    _lastFolder = fid;
    document.body.classList.add('mode-list');
    renderList(fid);
  }
})();
`;

// Returns the flat list of model base64 data (names + data URLs).
function _collectModelsFromEntries(entries, modelsByNodeId) {
  var out = [];
  function walk(list) {
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e.kind === 'model') {
        var m = modelsByNodeId[e.id];
        if (m) out.push(m);
      } else if (e.kind === 'folder') {
        walk(e.children);
      }
    }
  }
  walk(entries);
  return out;
}

// Build folder data structure for the viewer (recursive).
// Returns { "root": { name, desc, bg, parent, entries }, "f1": { ... }, ... }
function _buildFolderData(entries, modelsByNodeId, models, folderName, folderDesc, folderBg, parentId, folderId) {
  var folderEntries = [];
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (e.kind === 'folder') {
      folderEntries.push({ kind: 'folder', id: String(e.id), name: e.name });
    } else {
      var m = modelsByNodeId[e.id];
      if (!m) continue;
      var idx = models.indexOf(m);
      folderEntries.push({ kind: 'model', idx: idx, name: m.name });
    }
  }
  var folders = {};
  folders[folderId] = { name: folderName, desc: folderDesc || '', bg: folderBg || null, parent: parentId, entries: folderEntries };
  // Recursively build subfolders
  for (var i = 0; i < entries.length; i++) {
    var e = entries[i];
    if (e.kind === 'folder' && e.children && e.children.length > 0) {
      var subFolders = _buildFolderData(e.children, modelsByNodeId, models, e.name, e.desc || '', e.bg || null, folderId, String(e.id));
      for (var k in subFolders) folders[k] = subFolders[k];
    }
  }
  return folders;
}

function buildGalleryHTML(folderName, entries, modelsByNodeId, rootDesc, rootBg) {
  var models = _collectModelsFromEntries(entries, modelsByNodeId);
  var folders = _buildFolderData(entries, modelsByNodeId, models, folderName, rootDesc || '', rootBg || null, null, 'root');
  var dataJson = JSON.stringify({ models: models, folders: folders }).replace(/</g, '\\u003c');
  var escapedName = escapeHtml(folderName);

  // CSS body background
  var bodyBg = rootBg || '#080b14';

  return '<!DOCTYPE html>\n'
+ '<html lang="zh-CN">\n'
+ '<head>\n'
+ '<meta charset="UTF-8">\n'
+ '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n'
+ '<title>' + escapedName + '</title>\n'
+ '<style>\n'
+ '* { box-sizing: border-box; margin: 0; padding: 0; }\n'
+ 'html, body { min-height: 100%; background: ' + bodyBg + '; color: #d0dae8; font-family: "SF Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace; }\n'
+ 'body { display: flex; flex-direction: column; min-height: 100vh; }\n'
+ 'header { padding: 48px 24px 32px; flex-shrink: 0; }\n'
+ 'h1 { font-size: 22px; font-weight: 400; letter-spacing: 4px; color: #00d4ff; text-transform: uppercase; line-height: 1; }\n'
+ '#desc { font-size: 13px; color: rgba(0,212,255,0.45); margin-top: 12px; line-height: 1.6; max-width: 480px; display: none; }\n'
+ 'main { flex: 1; padding: 0 24px 48px; }\n'
+ '.grid { display: flex; flex-direction: column; gap: 10px; max-width: 560px; }\n'
+ '.tile { background: rgba(10,14,28,0.7); border: 1px solid rgba(255,255,255,0.18); border-radius: 32px; padding: 18px 24px; cursor: pointer; transition: border-color 0.25s, box-shadow 0.25s, transform 0.15s; user-select: none; }\n'
+ '.tile:hover { border-color: rgba(255,255,255,0.55); box-shadow: 0 0 24px rgba(0,212,255,0.08), inset 0 0 24px rgba(0,212,255,0.04); transform: translateX(4px); }\n'
+ '.tile:active { transform: translateX(2px); }\n'
+ '.tile.folder { border-color: rgba(0,212,255,0.28); }\n'
+ '.tile.folder:hover { border-color: rgba(255,255,255,0.55); box-shadow: 0 0 28px rgba(0,212,255,0.12); }\n'
+ '.tile-name { font-size: 15px; line-height: 1.4; color: #e0e8f0; letter-spacing: 1px; }\n'
+ '.tile.folder .tile-name { color: #00d4ff; }\n'
+ '.tile-meta { font-size: 10px; color: rgba(255,255,255,0.2); margin-top: 4px; letter-spacing: 1.5px; text-transform: uppercase; }\n'
+ '.empty { text-align: center; color: rgba(255,255,255,0.2); padding: 80px 0; font-size: 13px; letter-spacing: 2px; text-transform: uppercase; }\n'
+ '.breadcrumb { position: fixed; bottom: 16px; right: 20px; font-size: 11px; color: rgba(255,255,255,0.18); z-index: 5; letter-spacing: 0.5px; }\n'
+ '.bc-link { color: rgba(0,212,255,0.25); text-decoration: none; cursor: pointer; }\n'
+ '.bc-link:hover { color: rgba(0,212,255,0.5); }\n'
+ '.bc-sep { margin: 0 4px; }\n'
+ '.bc-current { color: rgba(255,255,255,0.18); }\n'
+ '#view { position: fixed; inset: 0; background: ' + bodyBg + '; display: none; }\n'
+ 'body.mode-view #view { display: block; }\n'
+ 'body.mode-view header, body.mode-view main, body.mode-view .breadcrumb { display: none; }\n'
+ 'body.mode-list #name, body.mode-list #error { display: none; }\n'
+ '#view canvas { display: block; width: 100% !important; height: 100% !important; image-rendering: pixelated; }\n'
+ '#back-view { position: fixed; top: 20px; left: 20px; z-index: 10; padding: 10px 18px; background: rgba(8,11,20,0.8); color: rgba(0,212,255,0.7); border: 1px solid rgba(0,212,255,0.2); border-radius: 24px; cursor: pointer; font-size: 13px; letter-spacing: 1px; backdrop-filter: blur(6px); display: none; }\n'
+ '#back-view:hover { border-color: rgba(0,212,255,0.5); color: #00d4ff; }\n'
+ 'body.mode-list.has-back header { padding-top: 76px; }\n'
+ '#name { position: fixed; top: 20px; right: 20px; z-index: 10; padding: 10px 18px; background: rgba(8,11,20,0.8); color: rgba(255,255,255,0.5); border-radius: 24px; font-size: 13px; letter-spacing: 1px; max-width: 50%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }\n'
+ '#error { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); color: #ff4466; background: rgba(8,11,20,0.9); border: 1px solid rgba(255,68,102,0.3); padding: 20px 28px; border-radius: 24px; display: none; z-index: 20; font-size: 13px; letter-spacing: 1px; }\n'
+ '</style>\n'
+ '</head>\n'
+ '<body>\n'
+ '<header>\n'
+ '  <h1 id="title">' + escapedName + '</h1>\n'
+ '  <div id="desc"></div>\n'
+ '</header>\n'
+ '<main>\n'
+ '  <div id="grid" class="grid"></div>\n'
+ '</main>\n'
+ '<div id="breadcrumb" class="breadcrumb"></div>\n'
+ '<div id="view"></div>\n'
+ '<button id="back-view" onclick="goBack()">\u2190 BACK</button>\n'
+ '<div id="name"></div>\n'
+ '<div id="error"></div>\n'
+ '<script type="application/json" id="models-data">\n'
+ dataJson + '\n'
+ '<' + '/script>\n'
+ '\n'
+ '<script type="importmap">\n'
+ '{\n'
+ '  "imports": {\n'
+ '    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",\n'
+ '    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"\n'
+ '  }\n'
+ '}\n'
+ '<' + '/script>\n'
+ '\n'
+ '<script>\n'
+ GALLERY_VIEWER_SOURCE + '\n'
+ '<' + '/script>\n'
+ '</body>\n'
+ '</html>';
}

async function exportFolderAsGalleryHTML(folderId, DB, bgSettings) {
  if (!DB) throw new Error('DB 未传入');

  function buildEntries(rootId) {
    var tree = DB.loadTree();
    var childIds;
    if (rootId === 'root' || rootId == null) {
      childIds = tree.rootIds || [];
    } else {
      childIds = Object.keys(tree.nodes).filter(function(id) {
        var n = tree.nodes[id];
        return n && n.parentId === rootId;
      });
    }
    var entries = [];
    for (var i = 0; i < childIds.length; i++) {
      var n = tree.nodes[childIds[i]];
      if (!n) continue;
      if (n.type === 'folder') {
        var resolved = DB.resolveBgSettings(n.id);
        entries.push({ kind: 'folder', id: n.id, name: n.name, desc: n.description || '', bg: bgToCSS(resolved), children: buildEntries(n.id) });
      } else if (n.type === 'model') {
        var resolved = DB.resolveBgSettings(n.id);
        entries.push({ kind: 'model', id: n.id, name: n.name, bg: bgToCSS(resolved) });
      }
    }
    return entries;
  }

  function collectModelIds(entries) {
    var out = [];
    (function walk(list) {
      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (e.kind === 'model') out.push(e.id);
        else if (e.kind === 'folder') walk(e.children);
      }
    })(entries);
    return out;
  }

  var rootId = folderId === null ? 'root' : folderId;
  var entries = buildEntries(rootId);
  var modelIds = collectModelIds(entries);
  if (modelIds.length === 0) throw new Error('该目录下没有模型');

  var modelsByNodeId = {};
  for (var i = 0; i < modelIds.length; i++) {
    var nid = modelIds[i];
    var node = DB.getNode(nid);
    if (!node) continue;
    var dataUrl = await blobToDataUrl(await DB.blobGet(node.blobId));
    if (dataUrl) {
      var mBg = bgToCSS(DB.resolveBgSettings(nid));
      var interactions = DB.getInteractions(nid) || {};
      // 收集交互里引用的音效，内联进 HTML（保持自包含）
      var sounds = {};
      for (var k in interactions) {
        var v = interactions[k];
        var sid = (typeof v === 'string') ? '' : (v.sound || '');
        if (sid && !sounds[sid]) {
          var d = await DB.getSoundDataUrl(sid);
          if (d) sounds[sid] = d;
        }
      }
      modelsByNodeId[nid] = { name: node.name, data: dataUrl, bg: mBg, interactions: interactions, sounds: sounds, defaultView: node.defaultView || null, lockRotation: !!node.lockRotation, chains: DB.getChains(nid) || [] };
    }
  }

  // 单模型目录：直接导出为 3D 查看页（无目录页），打开即看模型
  if (modelIds.length === 1) {
    var singleId = modelIds[0];
    var singleNode = DB.getNode(singleId);
    var singleEntry = modelsByNodeId[singleId];
    if (!singleEntry) throw new Error('该模型数据丢失');
    var singleBg = DB.resolveBgSettings(singleId);
    var html = buildStandaloneHTML(singleNode.name, singleEntry.data, singleBg, singleEntry.interactions, singleEntry.sounds, singleNode.defaultView, false, collectExitMeshes(singleEntry.interactions), '', singleEntry.lockRotation, singleEntry.chains);
    var safeName = (singleNode.name || 'model').replace(/[\\/:*?"<>|]/g, '_');
    var filename = safeName.replace(/\.glb$/i, '') + '.html';
    downloadText(html, filename, 'text/html;charset=utf-8');
    return { size: html.length, filename: filename, modelCount: 1, mode: 'standalone' };
  }

  // Get root description and background
  var rootDesc;
  var rootBg;
  if (folderId === null) {
    rootDesc = DB.getRootDescription();
    rootBg = bgSettings || DB.resolveBgSettings(null);
  } else {
    var rootNode = DB.getNode(folderId);
    rootDesc = rootNode ? (rootNode.description || '') : '';
    rootBg = bgSettings || DB.resolveBgSettings(folderId);
  }

  var folderName = folderId
    ? (DB.getNode(folderId) && DB.getNode(folderId).name || '目录')
    : '根目录';
  var rootBgCSS = bgToCSS(rootBg);
  var html = buildGalleryHTML(folderName, entries, modelsByNodeId, rootDesc, rootBgCSS);
  var safeName = folderName.replace(/[\\/:*?"<>|]/g, '_');
  var filename = safeName + '-模型库.html';
  downloadText(html, filename, 'text/html;charset=utf-8');
  return { size: html.length, filename: filename, modelCount: modelIds.length };
}

// 辅助：base64 → Uint8Array（用于把音效 dataUrl 还原为裸二进制）
function b64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// 导出为 .jgl 工程包：GLB / 音效以裸二进制外挂，scene.json 只挂功能引用（不内联 base64，体积更小）
async function exportSceneBundleZip(DB) {
  if (!DB) throw new Error('DB 未传入');
  const tree = DB.loadTree();
  const modelNodes = Object.values(tree.nodes).filter(n => n && n.type === 'model');
  const modelFiles = [];
  const soundFiles = {};
  const models = [];
  for (const n of modelNodes) {
    const blob = await DB.blobGet(n.blobId);
    if (!blob) continue;
    const glbBytes = new Uint8Array(await blob.arrayBuffer());
    const glbName = 'models/' + n.id + '.glb';
    modelFiles.push({ name: glbName, data: glbBytes });

    const interactions = DB.getInteractions(n.id) || {};
    const soundRefs = {};
    for (const k in interactions) {
      const v = interactions[k];
      const sid = (typeof v === 'string') ? '' : (v.sound || '');
      if (sid && !soundRefs[sid]) {
        const d = await DB.getSoundDataUrl(sid);
        if (d) {
          const mm = /^data:([^;]+);base64,(.*)$/.exec(d);
          const mime = mm ? mm[1] : 'audio/mpeg';
          const b64 = mm ? mm[2] : '';
          soundFiles[sid] = { name: 'sounds/' + sid + '.bin', data: b64ToBytes(b64), mime };
          soundRefs[sid] = { file: 'sounds/' + sid + '.bin', mime };
        }
      }
    }
    models.push({
      id: n.id,
      name: n.name,
      glbFile: glbName,
      defaultView: n.defaultView || null,
      lockRotation: !!n.lockRotation,
      chains: DB.getChains(n.id) || [],
      bg: bgToCSS(DB.resolveBgSettings(n.id)),
      exitMeshes: collectExitMeshes(interactions),
      exitMesh: collectExitMeshes(interactions)[0] || null, // 兼容旧版单结束物体字段
      interactions,
      soundRefs,
    });
  }
  const bundle = {
    schema: 'glb-scene-bundle',
    version: 2,
    packaging: 'zip',
    exportedAt: new Date().toISOString(),
    count: models.length,
    models,
  };
  const files = [
    { name: 'scene.json', data: new TextEncoder().encode(JSON.stringify(bundle, null, 2)) },
    ...modelFiles,
    ...Object.values(soundFiles),
  ];
  const zipBlob = buildZipBlob(files);
  const fname = 'glb-scene-bundle-' + new Date().toISOString().slice(0, 10) + '.jgl';
  downloadBlob(zipBlob, fname);
  return { size: zipBlob.size, count: models.length };
}

// 导出单个模型为 .jgl 工程包（资源树右键菜单「导出」用）
async function exportSingleModelJgl(modelId, DB) {
  const node = DB.getNode(modelId);
  if (!node || node.type !== 'model') throw new Error('不是模型节点');
  const blob = await DB.blobGet(node.blobId);
  if (!blob) throw new Error('模型文件缺失');
  const glbBytes = (blob instanceof Blob)
    ? new Uint8Array(await blob.arrayBuffer())
    : new Uint8Array(await (await fetch(blob)).arrayBuffer());
  const glbName = 'models/' + node.id + '.glb';
  const soundFiles = {};
  const soundRefs = {};
  const interactions = DB.getInteractions(node.id) || {};
  for (const k in interactions) {
    const v = interactions[k];
    const sid = (typeof v === 'string') ? '' : (v.sound || '');
    if (sid && !soundRefs[sid]) {
      const d = await DB.getSoundDataUrl(sid);
      if (d) {
        const mm = /^data:([^;]+);base64,(.*)$/.exec(d);
        const mime = mm ? mm[1] : 'audio/mpeg';
        const b64 = mm ? mm[2] : '';
        soundFiles[sid] = { name: 'sounds/' + sid + '.bin', data: b64ToBytes(b64), mime };
        soundRefs[sid] = { file: 'sounds/' + sid + '.bin', mime };
      }
    }
  }
  const models = [{
    id: node.id,
    name: node.name,
    glbFile: glbName,
    defaultView: node.defaultView || null,
    lockRotation: !!node.lockRotation,
    chains: DB.getChains(node.id) || [],
    bg: bgToCSS(DB.resolveBgSettings(node.id)),
    exitMeshes: collectExitMeshes(interactions),
    exitMesh: collectExitMeshes(interactions)[0] || null,
    interactions,
    soundRefs,
  }];
  const bundle = {
    schema: 'glb-scene-bundle',
    version: 2,
    packaging: 'zip',
    exportedAt: new Date().toISOString(),
    count: models.length,
    models,
  };
  const files = [
    { name: 'scene.json', data: new TextEncoder().encode(JSON.stringify(bundle, null, 2)) },
    { name: glbName, data: glbBytes },
    ...Object.values(soundFiles),
  ];
  const zipBlob = buildZipBlob(files);
  const fname = (node.name || 'model') + '.jgl';
  downloadBlob(zipBlob, fname);
  return { size: zipBlob.size };
}

// 所有函数声明在传统 script 中自动成为全局变量，无需 export

// 将 bgSettings 转为 CSS 背景值
function bgToCSS(settings) {
  if (!settings || settings.type === 'solid') return settings?.color1 || '#080b14';
  var dir = settings.direction || 'vertical';
  if (dir === 'horizontal') return 'linear-gradient(to right, ' + settings.color1 + ', ' + settings.color2 + ')';
  if (dir === 'diagonal') return 'linear-gradient(to bottom right, ' + settings.color1 + ', ' + settings.color2 + ')';
  if (dir === 'radial') return 'radial-gradient(circle, ' + settings.color1 + ', ' + settings.color2 + ')';
  return 'linear-gradient(to bottom, ' + settings.color1 + ', ' + settings.color2 + ')';
}
