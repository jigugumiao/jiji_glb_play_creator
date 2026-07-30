// js/viewer.js — 3D 查看器组件
// 基于 3d-viewer-fixed.html 封装，支持动态加载多个模型

// Three.js 由 index.html 的 module script 从 CDN 加载后挂到 window
// 此处直接使用全局 THREE / THREE.OrbitControls / THREE.GLTFLoader（UMD 版已挂到 THREE 命名空间，运行时已就绪）

// ============ 内置简易动画（无需在建模软件里做动画，直接给部位绑定） ============
// 每个预设：dur=时长(秒)；amp(最大尺寸)->幅度；apply(obj, t∈[0,1], base, amp) 设定变换；t=1 时回到 base
const PRESET_ANIMS = {
  'jump':  { label: '（内置）向上跳一下', dur: 0.55, amp: (d) => d * 0.4,     apply: (o, t, b, a) => { o.position.y = b.y + a * Math.sin(Math.PI * t); } },
  'shake': { label: '（内置）原地摇晃',   dur: 0.60, amp: () => 0.13,         apply: (o, t, b, a) => { o.rotation.z = b.rz + a * Math.sin(4 * Math.PI * t); } },
  'spin':  { label: '（内置）旋转一圈',   dur: 1.00, amp: () => Math.PI * 2,  apply: (o, t, b, a) => { o.rotation.y = b.ry + a * t; } },
  'nod':   { label: '（内置）点头',       dur: 0.60, amp: () => 0.28,         apply: (o, t, b, a) => { o.rotation.x = b.rx + a * Math.sin(Math.PI * t); } },
};

class GLBViewer {
  constructor(container) {
    this.container = container;
    this.currentBlobUrl = null;
    this.currentModel = null;

    this._initScene();
    this._initLights();
    this._initControls();
    this._initHelpers();
    this._bindResize();

    // 动画相关
    this.mixer = null;
    this.animActions = [];
    this._prevTime = 0;

    // 时间轴预览控制（作用域 A：嵌入 GLB 片段查看器）
    // 独立于交互点击播放：手动推进 action.time（timeScale=0 防止 mixer 自动推进）
    this._timeline = { action: null, playing: false, loop: false, speed: 1, inTime: 0, outTime: null, clipName: null, onUpdate: null };
    // 交互点击播放某片段时使用的起止区间（uuid -> { in, out }），让点击播放尊重 in/out
    this._actionRange = {};

    // 点击交互相关
    this._raycaster = new THREE.Raycaster();
    this._pointer = new THREE.Vector2();
    this._interactions = {};        // meshName -> { clip, sound, respond, pingpong, autoReturn }
    this._soundsData = {};          // soundId -> dataUrl（音效库）
    this._soundCache = {};          // soundId -> Audio（懒加载）
    this._actionByName = {};        // clipName -> action
    this._actionByUuid = {};        // action.uuid -> action
    this._actionState = {};         // action.uuid -> 'idle'|'forward'|'auto-fwd'|'auto-bwd'|'ping-forward'|'ping-reverse'
    this._onInteract = null;
    this._downX = 0;
    this._downY = 0;
    // 点击反馈：放大 1% 仅维持一帧，下一帧还原（与物体动画互不干扰）
    this._popObj = null;
    this._popBase = null;
    this._popActive = false;
    // 动画结束后删除：action.uuid -> 是否删除 / 触发该 action 的 mesh 对象
    this._deleteFlag = {};
    this._triggerObj = {};
    // 内置简易动画：正在播放的预设列表
    this._activePresets = [];

    this._initInteraction();
    this._animate();
  }

  _initScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0c12);

    const { clientWidth: w, clientHeight: h } = this.container;
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.01, 5000);
    this.camera.position.set(3, 2, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    // 软阴影：让模型在地面投下接触阴影，增强「落地」质感（premium 感来源）
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
  }

  _initLights() {
    // 主光（投射阴影）
    this.keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
    this.keyLight.position.set(5, 8, 6);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.set(1024, 1024);
    this.keyLight.shadow.camera.near = 0.01;
    this.keyLight.shadow.camera.far = 200;
    this.keyLight.shadow.camera.left = -20;
    this.keyLight.shadow.camera.right = 20;
    this.keyLight.shadow.camera.top = 20;
    this.keyLight.shadow.camera.bottom = -20;
    this.keyLight.shadow.bias = -0.0005;
    this.scene.add(this.keyLight);
    this.scene.add(this.keyLight.target);  // 目标默认在原点，随模型加载更新

    // 补光
    this.fillLight = new THREE.DirectionalLight(0x88aaff, 0.5);
    this.fillLight.position.set(-6, 3, -4);
    this.scene.add(this.fillLight);

    // 环境光
    this.ambLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(this.ambLight);

    // 半球光
    this.hemiLight = new THREE.HemisphereLight(0xffffff, 0x223344, 0.5);
    this.scene.add(this.hemiLight);
  }

  _initControls() {
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.1;
    this.controls.maxDistance = 1000;
    // 鼠标按键映射：左键旋转、右键平移、中键平移（新增中键拖拽平移）
    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.PAN,
    };
  }

  _initHelpers() {
    // 地面网格（半透明），帮助观察尺度
    const grid = new THREE.GridHelper(20, 20, 0x2a3142, 0x1d2230);
    grid.material.opacity = 0.4;
    grid.material.transparent = true;
    grid.position.y = -0.001;
    this.scene.add(grid);
    this.grid = grid;

    // 阴影承接面：透明平面，只显示模型投下的阴影，让模型"落地"
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.ShadowMaterial({ opacity: 0.28 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y = -0.001;
    this.scene.add(ground);
    this.shadowGround = ground;

    // 坐标轴
    const axes = new THREE.AxesHelper(0.5);
    this.scene.add(axes);
    this.axes = axes;
  }

  _bindResize() {
    const ro = new ResizeObserver(() => this._onResize());
    ro.observe(this.container);
    this._ro = ro;
  }

  _onResize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  _animate(time) {
    this._raf = requestAnimationFrame((t) => this._animate(t));

    const delta = this._prevTime ? (time - this._prevTime) / 1000 : 0.016;
    this._prevTime = time;

    // 点击反馈：放大 1% 仅维持一帧（让玩家看到反馈），下一帧在 mixer 更新前还原，
    // 这样即便动画本身也在驱动该物体的 scale，也不会残留偏移、互不干扰。
    if (this._popObj) {
      if (this._popActive) {
        this._popActive = false;   // 已显示一帧，下一帧还原
      } else {
        this._popObj.scale.copy(this._popBase);
        this._popObj = null;
        this._popBase = null;
      }
    }

    // 驱动动画
    if (this.mixer) {
      this.mixer.update(delta);
      // 逐 action 状态推进（点击交互触发）
      for (const uuid in this._actionState) {
        const a = this._actionByUuid[uuid];
        if (!a) continue;
        const st = this._actionState[uuid];
        // 起止区间：若交互配置了 clipIn/clipOut，则播放尊重该区间（否则整段）
        const range = this._actionRange[uuid];
        const endT = (range && range.out != null) ? range.out : a.getClip().duration;
        if (st === 'auto-fwd') {
          // 连续来回：正向播完 → 自动切到倒放，回到开头
          if (a.time >= endT - 0.03) {
            a.stop();
            a.time = endT;
            a.timeScale = -1;
            a.play();
            this._actionState[uuid] = 'auto-bwd';
          }
        } else if (st === 'auto-bwd') {
          // 倒放回开头 → 归位
          if (a.time <= (range ? range.in : 0) + 0.03) { a.stop(); this._actionState[uuid] = 'idle'; this._maybeDeleteAfter(uuid); }
        } else if (st === 'ping-forward') {
          // 离散正向：播完保持停在末尾，等待下次点击才倒放（不自动归位）
        } else if (st === 'ping-reverse') {
          // 离散倒放：回到开头后归位，下次点击重新正向
          if (a.time <= (range ? range.in : 0) + 0.03) { a.stop(); this._actionState[uuid] = 'idle'; this._maybeDeleteAfter(uuid); }
        } else if (st === 'forward') {
          // 普通：播完停在末尾（clampWhenFinished 已固定末帧），状态归 idle 以便下次重播
          if (a.time >= endT - 0.03) {
            this._actionState[uuid] = 'idle';
            this._maybeDeleteAfter(uuid);
          }
        }
      }

      // 时间轴预览：独立于交互点击播放，手动推进 action.time
      // （timeScale=0 禁止 mixer 自动推进，时间完全由下方控制；mixer.update 仍按当前 time 应用姿态）
      if (this._timeline.action) {
        const a = this._timeline.action;
        const dur = a.getClip().duration || 0;
        const out = (this._timeline.outTime != null) ? Math.min(Math.max(this._timeline.outTime, 0), dur) : dur;
        const inn = Math.min(Math.max(this._timeline.inTime, 0), out);
        a.timeScale = 0;
        if (this._timeline.playing) {
          let t = a.time + delta * this._timeline.speed;
          const span = out - inn;
          if (span > 1e-4) {
            if (t > out) t = this._timeline.loop ? inn + (((t - inn) % span) + span) % span : out;
            if (t < inn) t = inn;
          } else { t = inn; }
          if (!this._timeline.loop && t >= out - 1e-4) { t = out; this._timeline.playing = false; }
          a.time = t;
        }
        if (this._timeline.onUpdate) this._timeline.onUpdate(a.time, dur, this._timeline.playing, inn, out);
      }
    }

    // 内置简易动画推进（不依赖 mixer，即使模型无自带动画也能播放）
    for (let i = this._activePresets.length - 1; i >= 0; i--) {
      const p = this._activePresets[i];
      p.t += delta / p.dur;
      const t = Math.min(p.t, 1);
      PRESET_ANIMS[p.name].apply(p.obj, t, p.base, p.amp);
      if (p.t >= 1) {
        // 精确归位到基准变换
        p.obj.position.y = p.base.y;
        p.obj.rotation.x = p.base.rx;
        p.obj.rotation.y = p.base.ry;
        p.obj.rotation.z = p.base.rz;
        this._activePresets.splice(i, 1);
        if (p.del && p.obj.parent) p.obj.parent.remove(p.obj);
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    this._ro?.disconnect();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    if (this.currentBlobUrl) URL.revokeObjectURL(this.currentBlobUrl);
  }

  // 清除当前模型
  clear() {
    if (this.mixer) {
      this.animActions.forEach(a => a.stop());
      this.mixer = null;
      this.animActions = [];
      this._prevTime = 0;
      this._actionByName = {};
      this._actionByUuid = {};
      this._actionState = {};
      this._timeline.action = null;
      this._timeline.playing = false;
      this._actionRange = {};
      this._popObj = null;
      this._popBase = null;
      this._popActive = false;
      this._deleteFlag = {};
      this._triggerObj = {};
    }
    if (this.currentModel) {
      this.scene.remove(this.currentModel);
      this._disposeModel(this.currentModel);
      this.currentModel = null;
    }
    this._defaultView = null;
    // 复位承接面 / 网格地面到原点参考高度，避免切换模型后悬在旧模型底部
    if (this.shadowGround) this.shadowGround.position.y = -0.001;
    if (this.grid) this.grid.position.y = -0.001;
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }

  _disposeModel(model) {
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

  // 读取当前相机视角，用于保存为默认视角
  captureDefaultView() {
    return {
      pos: this.camera.position.toArray(),
      target: this.controls.target.toArray()
    };
  }

  // 实时设置默认视角（设为默认视角按钮调用）：同步到内存，使「重置视角」立即生效，无需重新加载
  setDefaultView(view) {
    this._defaultView = (view && view.pos && view.target) ? view : null;
  }

  // 从原生 Blob 加载（内部存储已为 Blob：省去 base64 解码，内存峰值更低）
  async loadFromBlob(blob, defaultView, onProgress) {
    this.clear();
    const url = URL.createObjectURL(blob);
    this.currentBlobUrl = url;
    return this._loadGLB(url, onProgress, defaultView);
  }

  // 从 base64 dataURL 加载（兼容外部传入；内部已优先用 loadFromBlob）
  async loadFromDataUrl(dataUrl, defaultView, onProgress) {
    this.clear();
    // 转 Blob URL
    const byteString = atob(dataUrl.split(',')[1]);
    const bytes = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      bytes[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'model/gltf-binary' });
    const url = URL.createObjectURL(blob);
    this.currentBlobUrl = url;

    return this._loadGLB(url, onProgress, defaultView);
  }

  _loadGLB(url, onProgress, defaultView) {
    // 记下该模型保存的默认视角：点击「重置视角」时优先回到这里，无则自动取景
    this._defaultView = (defaultView && defaultView.pos && defaultView.target) ? defaultView : null;
    return new Promise((resolve, reject) => {
      const loader = new THREE.GLTFLoader();
      loader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          this.scene.add(model);
          this.currentModel = model;

          // 提取动画
          if (gltf.animations && gltf.animations.length > 0) {
            this.mixer = new THREE.AnimationMixer(model);
            this.animActions = gltf.animations.map(clip => {
              const action = this.mixer.clipAction(clip);
              action.setLoop(THREE.LoopOnce, 1);
              action.clampWhenFinished = true;
              return action;
            });
          } else {
            this.mixer = null;
            this.animActions = [];
          }
          this._buildActionIndex();

          // 包围盒 → 自适应相机
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z) || 1;

          // 把模型中心移到原点
          model.position.sub(center);

          // 相机位置
          const fov = this.camera.fov * (Math.PI / 180);
          let dist = Math.abs(maxDim / 2 / Math.tan(fov / 2));
          dist *= 1.8;

          this.camera.position.set(maxDim * 0.7, maxDim * 0.5, dist);
          this.camera.lookAt(0, 0, 0);
          this.controls.target.set(0, 0, 0);
          this.controls.minDistance = maxDim * 0.05;
          this.controls.maxDistance = maxDim * 20;
          this.controls.update();

          // 应用保存的默认视角（若有则覆盖自动取景）
          if (defaultView && defaultView.pos && defaultView.target) {
            this.camera.position.fromArray(defaultView.pos);
            this.controls.target.fromArray(defaultView.target);
            this.camera.lookAt(this.controls.target);
            this.controls.update();
          }

          // 隐藏辅助（如果模型很小，坐标轴显得太大）
          this.axes.visible = maxDim > 0.3;
          this.grid.visible = maxDim < 50;

          // 阴影与辅助对齐模型底面：网格地面 + 承接面落在模型底部，"落地"更稳
          const box2 = new THREE.Box3().setFromObject(model);
          const minY = box2.min.y;
          this.grid.position.y = minY;
          this.shadowGround.position.y = minY;
          // 主光与阴影相机按模型尺度自适应，保证任意大小模型都有清晰阴影
          this.keyLight.position.set(maxDim * 1.5, maxDim * 2.2, maxDim * 1.8);
          this.keyLight.target.position.set(0, 0, 0);
          this.keyLight.target.updateMatrixWorld();
          const sc = this.keyLight.shadow.camera;
          sc.left = -maxDim * 2; sc.right = maxDim * 2;
          sc.top = maxDim * 2; sc.bottom = -maxDim * 2;
          sc.near = 0.01; sc.far = maxDim * 10;
          sc.updateProjectionMatrix();
          // 模型网格投射阴影
          model.traverse(o => { if (o.isMesh) o.castShadow = true; });

          // 统计信息
          const stats = this._collectStats(model);
          this._lastStats = { size, maxDim, ...stats };
          resolve({ size, maxDim, ...stats });
        },
        (xhr) => {
          if (xhr.lengthComputable && onProgress) {
            onProgress(xhr.loaded / xhr.total);
          }
        },
        (err) => reject(err)
      );
    });
  }

  _collectStats(model) {
    let vertices = 0, triangles = 0, meshes = 0, materials = 0;
    const matSet = new Set();
    model.traverse((obj) => {
      if (obj.isMesh) {
        meshes++;
        const geo = obj.geometry;
        if (geo) {
          const pos = geo.attributes.position;
          if (pos) vertices += pos.count;
          if (geo.index) {
            triangles += geo.index.count / 3;
          } else if (pos) {
            triangles += pos.count / 3;
          }
        }
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          for (const m of mats) {
            const key = m.uuid;
            if (!matSet.has(key)) {
              matSet.add(key);
              materials++;
            }
          }
        }
      }
    });
    return { vertices, triangles, meshes, materials };
  }

  getLastStats() { return this._lastStats; }

  // 高亮某个 mesh（在视口内闪一下青色自发光），用于「点面板部位 → 提示正在配置的是哪个 mesh」
  // 自动还原：保存原始 emissive / emissiveIntensity，约 0.9s 后恢复，避免污染模型外观
  highlightMesh(name) {
    if (!this.currentModel || !name) return;
    const objs = [];
    this.currentModel.traverse(o => { if (o.isMesh && o.name === name) objs.push(o); });
    if (objs.length === 0) return;
    const HL = new THREE.Color(0x39d0ff);
    const saved = [];
    objs.forEach(o => {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(m => {
        if (!m || !m.emissive) return;   // MeshBasicMaterial 等无 emissive 的跳过
        saved.push({ m, e: m.emissive.clone(), i: m.emissiveIntensity });
        m.emissive.copy(HL);
        m.emissiveIntensity = 0.9;
      });
    });
    if (saved.length === 0) return;
    clearTimeout(this._hlTimer);
    this._hlTimer = setTimeout(() => {
      saved.forEach(s => { s.m.emissive.copy(s.e); s.m.emissiveIntensity = s.i; });
    }, 900);
  }

  // ============ 动画控制 ============

  hasAnimations() {
    return this.mixer !== null && this.animActions.length > 0;
  }

  // 是否有交互点击触发的动画正在播放（用于避免时间轴预览抢占同一 action）
  isInteracting() {
    if (!this.mixer) return false;
    for (const uuid in this._actionState) {
      if (this._actionState[uuid] && this._actionState[uuid] !== 'idle') return true;
    }
    return false;
  }

  setOnInteract(callback) {
    this._onInteract = callback;
  }

  // 建立 clipName -> action / uuid -> action 索引
  _buildActionIndex() {
    this._actionByName = {};
    this._actionByUuid = {};
    this._actionState = {};
    if (this.mixer) {
      this.animActions.forEach(a => {
        const name = a.getClip().name;
        if (name) this._actionByName[name] = a;
        this._actionByUuid[a.uuid] = a;
        this._actionState[a.uuid] = 'idle';
      });
    }
  }

  // 设置「部位 mesh 名 -> { clip, sound }」映射
  // 兼容旧数据：值为字符串时视为 clip 名，sound 留空
  setInteractions(map) {
    const norm = {};
    if (map) {
      for (const k in map) {
        const v = map[k];
        if (typeof v === 'string') {
          norm[k] = { clip: v, sound: '', respond: true, pingpong: false, autoReturn: false, deleteAfter: false };
        } else if (v && typeof v === 'object') {
          norm[k] = {
            clip: v.clip || '',
            sound: v.sound || '',
            respond: v.respond !== false,   // 默认勾选（响应点击）
            pingpong: !!v.pingpong,         // 默认不离散来回
            autoReturn: !!v.autoReturn,     // 默认不连续自动归位
            deleteAfter: !!v.deleteAfter    // 默认不删除
          };
        }
      }
    }
    this._interactions = norm;
  }

  // 设置音效库映射：{ soundId: dataUrl }
  setSounds(soundsMap) {
    this._soundsData = soundsMap || {};
    this._soundCache = {}; // 重新绑定后清空缓存
  }

  // 播放某个音效（按 id），每次点击都触发
  _playSound(soundId) {
    if (!soundId || !this._soundsData[soundId]) return false;
    try {
      let audio = this._soundCache[soundId];
      if (!audio) {
        audio = new Audio(this._soundsData[soundId]);
        this._soundCache[soundId] = audio;
      }
      audio.currentTime = 0;
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
      return true;
    } catch (e) {
      return false;
    }
  }

  // 列出模型所有 mesh（供配置面板）
  getMeshList() {
    const list = [];
    if (this.currentModel) {
      let i = 0;
      this.currentModel.traverse(o => {
        if (o.isMesh) {
          list.push({ name: o.name || ('Mesh#' + i), uuid: o.uuid });
        }
        i++;
      });
    }
    return list;
  }

  // 列出所有动画 clip 名（供配置面板下拉）
  getClipList() {
    return this.animActions.map(a => a.getClip().name);
  }

  // 内置简易动画选项（供配置面板下拉），value 形如 'preset:jump'
  getPresetClips() {
    return Object.keys(PRESET_ANIMS).map(k => ({ value: 'preset:' + k, label: PRESET_ANIMS[k].label }));
  }

  // 列出所有动画片段及其时长（供时间轴轨道），返回 [{ name, duration }]
  getClipInfo() {
    return this.animActions.map(a => ({ name: a.getClip().name, duration: a.getClip().duration }));
  }

  // ============ 时间轴预览控制（作用域 A：嵌入 GLB 片段查看器） ============
  // 设计：时间轴只负责「预览」某个片段并设定起止区间；起止最终写入交互配置，
  // 使得在 3D 界面里点击该部位时播放的是指定段落。与交互点击播放相互独立。

  // 注册播放头/时间更新回调（main.js 用来驱动 UI 播放头与数字）
  timelineOnUpdate(cb) { this._timeline.onUpdate = cb; }

  // 选择要在时间轴预览的片段；name 为空则清空预览控制
  timelineSetClip(name) {
    if (!this.mixer) return false;
    // 复位旧 action 的 timeScale，避免残留 0 影响后续交互播放
    if (this._timeline.action && this._timeline.action !== this._actionByName[name]) {
      this._timeline.action.timeScale = 1;
    }
    if (!name) { this._timeline.action = null; this._timeline.clipName = null; return false; }
    const a = this._actionByName[name];
    if (!a) return false;
    a.reset();
    a.setLoop(THREE.LoopRepeat, Infinity);
    a.clampWhenFinished = false;
    a.enabled = true;
    a.paused = false;
    a.play();
    this._timeline.action = a;
    this._timeline.clipName = name;
    const dur = a.getClip().duration;
    if (this._timeline.outTime == null || this._timeline.outTime > dur) this._timeline.outTime = dur;
    if (this._timeline.inTime > this._timeline.outTime) this._timeline.inTime = 0;
    a.timeScale = 0;                 // 关键：禁止 mixer 自动推进，时间由下方手动控制
    a.time = this._timeline.inTime;
    if (this._timeline.onUpdate) this._timeline.onUpdate(a.time, dur, this._timeline.playing, this._timeline.inTime, this._timeline.outTime);
    return true;
  }

  timelinePlay() {
    if (!this._timeline.action) {
      if (!this.timelineSetClip(this._timeline.clipName || this.getClipList()[0])) return false;
    }
    this._timeline.playing = true;
    return true;
  }
  timelinePause() { this._timeline.playing = false; }
  timelineSeek(t) {
    if (!this._timeline.action) return;
    const dur = this._timeline.action.getClip().duration;
    const out = (this._timeline.outTime != null) ? Math.min(this._timeline.outTime, dur) : dur;
    const inn = Math.min(this._timeline.inTime, out);
    this._timeline.action.time = Math.min(Math.max(t, inn), out);
    if (this._timeline.onUpdate) this._timeline.onUpdate(this._timeline.action.time, dur, this._timeline.playing, inn, out);
  }
  timelineSetLoop(b) { this._timeline.loop = !!b; }
  timelineSetSpeed(x) { this._timeline.speed = x; }
  timelineSetIn(t) {
    this._timeline.inTime = Math.max(0, t);
    if (this._timeline.outTime != null && this._timeline.inTime > this._timeline.outTime) {
      this._timeline.inTime = this._timeline.outTime;
    }
    if (this._timeline.action && !this._timeline.playing) this._timeline.action.time = this._timeline.inTime;
  }
  timelineSetOut(t) {
    if (!this._timeline.action) return;
    const dur = this._timeline.action.getClip().duration;
    this._timeline.outTime = Math.min(Math.max(t, this._timeline.inTime), dur);
  }
  timelineGetState() {
    const a = this._timeline.action;
    return {
      clipName: this._timeline.clipName,
      playing: this._timeline.playing,
      loop: this._timeline.loop,
      speed: this._timeline.speed,
      inTime: this._timeline.inTime,
      outTime: this._timeline.outTime,
      duration: a ? a.getClip().duration : 0,
      time: a ? a.time : 0,
    };
  }
  // 交互点击播放某片段时调用：暂停时间轴预览控制，避免与手动时间控制打架
  timelineSuspend() { this._timeline.action = null; this._timeline.playing = false; }

  // 播放一个内置简易动画（不依赖 mixer，即使模型无自带动画也能用）
  _playPreset(name, obj, del) {
    if (!obj || !PRESET_ANIMS[name]) return;
    // 正在播放内置动画的部位禁止再次触发：否则 base 会取自位移中的姿态，造成位置错位累积
    if (this._activePresets.some(p => p.obj === obj)) return;
    const def = PRESET_ANIMS[name];
    const box = new THREE.Box3().setFromObject(obj);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    this._activePresets.push({
      name,
      obj,
      t: 0,
      dur: def.dur,
      del: !!del,
      base: { y: obj.position.y, rx: obj.rotation.x, ry: obj.rotation.y, rz: obj.rotation.z },
      amp: def.amp(maxDim),
    });
  }

  // 命中某部位时：放大反馈 + 触发绑定动画（受 pingpong 控制）+ 播放绑定音效
  triggerMeshInteraction(meshName, hitObj) {
    const entry = this._interactions[meshName];
    if (!entry) return false;
    if (entry.respond === false) return false; // 未勾选「响应点击」则完全不反应

    // 点击反馈：放大 1%，下一帧还原（见 _animate 里的还原逻辑），与物体动画互不干扰
    this._doPop(hitObj);

    let did = false;
    // 动画：内置预设动画（无需 mixer）或 GLB 自带 clip
    if (entry.clip) {
      if (entry.clip.indexOf('preset:') === 0) {
        this._playPreset(entry.clip.slice(7), hitObj, entry.deleteAfter);
        did = true;
      } else if (this.mixer) {
        const action = this._actionByName[entry.clip];
        if (action) {
          // 记录触发该 action 的 mesh，便于「动画结束后删除该物体」时定位
          this._triggerObj[action.uuid] = hitObj;
          this._deleteFlag[action.uuid] = !!entry.deleteAfter;
          // 起止区间：交互配置的 clipIn/clipOut（秒）；缺省为整段
          const dur = action.getClip().duration;
          const range = { in: entry.clipIn || 0, out: (entry.clipOut != null ? entry.clipOut : dur) };
          this._actionRange[action.uuid] = range;
          // 点击播放时暂停时间轴预览控制，避免与手动时间控制打架
          this.timelineSuspend();
          this._toggleAction(action, entry.pingpong, entry.autoReturn, range);
          did = true;
        }
      }
    }
    // 音效：每次点击都播放
    if (entry.sound) {
      if (this._playSound(entry.sound)) did = true;
    }
    return true; // 已响应点击
  }

  // 点击反馈：瞬放 2%，在 _animate 下一帧还原
  _doPop(obj) {
    if (!obj) return;
    // 若上一帧的放大反馈仍在进行，先还原，避免与本次点击叠加
    if (this._popObj) this._popObj.scale.copy(this._popBase);
    this._popBase = obj.scale.clone();
    obj.scale.multiplyScalar(1.02);
    this._popObj = obj;
    this._popActive = true;
  }

  // 三种模式（UI 上 pingpong 与 autoReturn 已互斥，仅其一可勾；这里保留优先级作防御性兜底）
  //   autoReturn=true ：点一下正向播放，播完自动倒放回开头（连续一个来回，无需再次点击）
  //   pingpong=true   ：离散来回——点一下正向，再点一下倒放回开头（需两次点击）
  //   都不勾          ：每次点击从头播放一次；播放中再次点击会被忽略（避免位置错位），播完停在末尾，可再次点击重播
  _toggleAction(action, pingpong, autoReturn, range) {
    const st = this._actionState[action.uuid] || 'idle';
    // 关键：AnimationAction.reset() 会把 clampWhenFinished 一并重置为 false，
    // 导致 LoopOnce 正向播完后 action 被停用、网格弹回 bind（初始）姿态，
    // 看起来像「播完跳回开始」。每次播放前显式设回 true，让播完停在结尾帧。
    const armForward = () => {
      action.reset();
      action.clampWhenFinished = true;
      action.time = range ? range.in : 0;
      action.setLoop(THREE.LoopOnce, 1);
      action.timeScale = 1;
      action.enabled = true;
      action.paused = false;
      action.play();
    };
    if (autoReturn) {
      // 连续来回：仅在 idle（不在播放中）时响应，播放中忽略
      if (st === 'idle') {
        armForward();
        this._actionState[action.uuid] = 'auto-fwd';
      }
      return;
    }
    if (pingpong) {
      // 离散来回：正向 ↔ 倒放 交替，需两次点击完成一个来回
      if (st === 'idle' || st === 'ping-reverse') {
        armForward();
        this._actionState[action.uuid] = 'ping-forward';
      } else if (st === 'ping-forward') {
        // 反向起点尊重 clipOut 区间（缺省为整段结尾）
        const endT = (range && range.out != null) ? range.out : action.getClip().duration;
        action.stop();
        action.clampWhenFinished = true;
        action.time = endT;
        action.timeScale = -1;
        action.enabled = true;
        action.paused = false;
        action.play();
        this._actionState[action.uuid] = 'ping-reverse';
      }
      return;
    }
    // 普通：每次点击从头播放一次；播放中（st==='forward'）忽略再次点击，避免位置错位
    if (st === 'idle') {
      armForward();
      this._actionState[action.uuid] = 'forward';
    }
  }

  // 动画结束后删除该物体：把触发该 action 的 mesh 从场景图中移除（不再渲染、不再可点击）
  _maybeDeleteAfter(uuid) {
    if (this._deleteFlag[uuid]) {
      const obj = this._triggerObj[uuid];
      if (obj && obj.parent) obj.parent.remove(obj);
      this._deleteFlag[uuid] = false;
      this._triggerObj[uuid] = null;
    }
  }

  _initInteraction() {
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      this._downX = e.clientX;
      this._downY = e.clientY;
    });
    el.addEventListener('pointerup', (e) => {
      if (!this.currentModel) return;
      const dx = e.clientX - this._downX;
      const dy = e.clientY - this._downY;
      if (Math.hypot(dx, dy) > 5) return; // 视为拖拽旋转，忽略
      const rect = el.getBoundingClientRect();
      this._pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this._pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this._raycaster.setFromCamera(this._pointer, this.camera);
      const hits = this._raycaster.intersectObject(this.currentModel, true);
      if (hits.length === 0) return;
      const hit = hits[0].object;
      const meshName = hit.name;
      const ok = this.triggerMeshInteraction(meshName, hit);
      if (this._onInteract) this._onInteract(meshName, ok);
    });
  }

  // 重置相机：优先回到该模型「设置好的默认视角」，若未设置则退回到自动取景（默认的默认视角）
  resetCamera() {
    if (!this._lastStats) return;
    const dv = this._defaultView;
    if (dv && dv.pos && dv.target) {
      this.camera.position.fromArray(dv.pos);
      this.controls.target.fromArray(dv.target);
      this.camera.lookAt(this.controls.target);
      this.controls.update();
      return;
    }
    // 兜底：按包围盒自动取景
    const { maxDim } = this._lastStats;
    const fov = this.camera.fov * (Math.PI / 180);
    const dist = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.8;
    this.camera.position.set(maxDim * 0.7, maxDim * 0.5, dist);
    this.camera.lookAt(0, 0, 0);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  // 自动旋转
  setAutoRotate(enabled) {
    this.controls.autoRotate = enabled;
    this.controls.autoRotateSpeed = 1.5;
  }

  // 设置背景：solid(纯色) 或 gradient(渐变)
  setBackground(type, color1, color2, direction) {
    // 释放旧纹理
    if (this._bgTexture) {
      this._bgTexture.dispose();
      this._bgTexture = null;
    }
    if (type === 'solid') {
      this.scene.background = new THREE.Color(color1);
    } else if (type === 'gradient') {
      var canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      var ctx = canvas.getContext('2d');
      var grad;
      if (direction === 'horizontal') {
        grad = ctx.createLinearGradient(0, 0, 1024, 0);
      } else if (direction === 'diagonal') {
        grad = ctx.createLinearGradient(0, 0, 1024, 1024);
      } else if (direction === 'radial') {
        grad = ctx.createRadialGradient(512, 512, 0, 512, 512, 720);
      } else {
        grad = ctx.createLinearGradient(0, 0, 0, 1024);
      }
      grad.addColorStop(0, color1);
      grad.addColorStop(1, color2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1024, 1024);
      this._bgTexture = new THREE.CanvasTexture(canvas);
      this.scene.background = this._bgTexture;
    }
  }
}

window.GLBViewer = GLBViewer;
