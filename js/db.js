// js/db.js — IndexedDB 封装 + localStorage 树管理（支持多项目隔离）
// 树形结构存储在 localStorage（结构小，频繁读取）
// GLB Base64 大文件存储在 IndexedDB（容量大，不阻塞主线程）
// 多项目：每个项目一棵独立的树；blob / sound 在 IndexedDB 中以「项目id::」前缀做物理隔离

const DB_NAME = 'glb-manager-db';
const DB_VERSION = 2;
const STORE_BLOBS = 'blobs';
const STORE_SOUNDS = 'sounds';
const LS_TREE = 'glb-manager:tree';               // 旧版全局树（迁移前）
const LS_TREE_PREFIX = 'glb-manager:tree:';       // 每项目独立的树 key
const LS_SETTINGS = 'glb-manager:settings';
const LS_SOUNDS = 'glb-manager:sounds';           // 旧版全局音效元数据（迁移前）
const LS_SOUNDS_PREFIX = 'glb-manager:sounds:';   // 每项目独立的音效元数据 key
const LS_PROJECTS = 'glb-manager:projects';       // 项目注册表
const LS_LAST_PROJECT = 'glb-manager:last-project';
const PROJECT_NS_SEP = '::';                       // blob/sound 物理键的项目命名空间分隔符

// 当前激活项目 id；所有 tree/blob/sound 读写都按它隔离
let _projectId = null;

// 给物理存储键加项目命名空间前缀（_projectId 为 null 时退化为原 id，仅用于迁移期）
function _ns(id) {
  return _projectId ? (_projectId + PROJECT_NS_SEP + id) : id;
}

// ============ IndexedDB ============
let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_SOUNDS)) {
        db.createObjectStore(STORE_SOUNDS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

// ============ 原始读写（操作实际 store key，不做项目命名空间） ============
async function blobGetRaw(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readonly');
    const req = tx.objectStore(STORE_BLOBS).get(id);
    req.onsuccess = async () => {
      const rec = req.result;
      if (!rec) return resolve(null);
      // 新格式存 blob 字段；旧格式存 dataUrl 字符串（首次读取时迁移为原生 Blob）
      let val = rec.blob !== undefined ? rec.blob : rec.dataUrl;
      if (typeof val === 'string') {
        const blob = dataUrlToBlob(val);
        try {
          const db2 = await openDB();
          const tx2 = db2.transaction(STORE_BLOBS, 'readwrite');
          tx2.objectStore(STORE_BLOBS).put({ id, blob, createdAt: rec.createdAt || Date.now() });
        } catch (e) { /* 迁移失败不影响本次读取 */ }
        return resolve(blob);
      }
      resolve(val);
    };
    tx.onerror = () => reject(tx.error);
  });
}
async function blobDeleteRaw(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readwrite');
    tx.objectStore(STORE_BLOBS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function getSoundRaw(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SOUNDS, 'readonly');
    const req = tx.objectStore(STORE_SOUNDS).get(id);
    req.onsuccess = () => resolve(req.result || null);
    tx.onerror = () => reject(tx.error);
  });
}
async function putSoundRaw(rec) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SOUNDS, 'readwrite');
    tx.objectStore(STORE_SOUNDS).put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
async function deleteSoundRaw(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SOUNDS, 'readwrite');
    tx.objectStore(STORE_SOUNDS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function blobPutRaw(id, data) {
  // 接受原生 Blob/File，或遗留的 base64 字符串：统一以原生 Blob 存入 IndexedDB，
  // 省去 ~33% 的体积膨胀，且读取时可直接 URL.createObjectURL 喂给 Three.js，无需 atob 解码。
  let blob = data;
  if (typeof data === 'string') blob = dataUrlToBlob(data);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readwrite');
    tx.objectStore(STORE_BLOBS).put({ id, blob, createdAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============ Blob 公开接口（按当前项目命名空间隔离） ============
async function blobPut(id, dataUrl) { return blobPutRaw(_ns(id), dataUrl); }
async function blobGet(id) { return blobGetRaw(_ns(id)); }
async function blobDelete(id) { return blobDeleteRaw(_ns(id)); }

async function blobList() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readonly');
    const req = tx.objectStore(STORE_BLOBS).getAllKeys();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(tx.error);
  });
}

async function blobStats() {
  const db = await openDB();
  const prefix = _projectId ? (_projectId + PROJECT_NS_SEP) : '';
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readonly');
    const store = tx.objectStore(STORE_BLOBS);
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result || []).filter(it => prefix && it.id && it.id.startsWith(prefix));
      const total = items.reduce((s, it) => s + (it.blob?.size || it.dataUrl?.length || 0), 0);
      resolve({ count: items.length, totalBytes: total });
    };
    req.onerror = () => reject(tx.error);
  });
}

// ============ 音效库（项目级） ============
// 二进制数据放 IndexedDB（sounds store，物理键带项目前缀），元数据（id/name/type）放 localStorage（按项目分文件）
// 这样 localStorage 不会因为大音频膨胀，同时保持与 GLB blob 一致的分层策略

function _soundsMetaKey() {
  return _projectId ? (LS_SOUNDS_PREFIX + _projectId) : (LS_SOUNDS_PREFIX + '__none__');
}

function _loadSoundsMeta() {
  try {
    const raw = localStorage.getItem(_soundsMetaKey());
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function _saveSoundsMeta(list) {
  localStorage.setItem(_soundsMetaKey(), JSON.stringify(list));
}

async function addSound(record) {
  // record: { id, name, type, dataUrl }
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SOUNDS, 'readwrite');
    tx.objectStore(STORE_SOUNDS).put({
      id: _ns(record.id),
      name: record.name,
      type: record.type,
      dataUrl: record.dataUrl,
      createdAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  const meta = _loadSoundsMeta();
  const existing = meta.findIndex(s => s.id === record.id);
  const entry = { id: record.id, name: record.name, type: record.type };
  if (existing >= 0) meta[existing] = entry;
  else meta.push(entry);
  _saveSoundsMeta(meta);
  return entry;
}

async function getSound(id) {
  return getSoundRaw(_ns(id));
}

async function getSoundDataUrl(id) {
  const rec = await getSound(id);
  return rec?.dataUrl || null;
}

async function getSounds() {
  return _loadSoundsMeta();
}

// 返回 { id: dataUrl } 全量映射，仅包含当前项目命名空间内的音效
async function getAllSoundData() {
  const db = await openDB();
  const prefix = _projectId ? (_projectId + PROJECT_NS_SEP) : '';
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SOUNDS, 'readonly');
    const req = tx.objectStore(STORE_SOUNDS).getAll();
    req.onsuccess = () => {
      const map = {};
      (req.result || []).forEach(it => {
        if (it.id && it.id.startsWith(prefix) && it.dataUrl) {
          map[it.id.slice(prefix.length)] = it.dataUrl;
        }
      });
      resolve(map);
    };
    req.onerror = () => reject(tx.error);
  });
}

async function deleteSound(id) {
  await deleteSoundRaw(_ns(id));
  const meta = _loadSoundsMeta().filter(s => s.id !== id);
  _saveSoundsMeta(meta);
}

// 重命名音效：元数据（localStorage）+ IndexedDB 记录同步更新
async function renameSound(id, newName) {
  if (!id || !newName) return;
  // 更新 localStorage 元数据
  const meta = _loadSoundsMeta();
  const entry = meta.find(s => s.id === id);
  if (entry) {
    entry.name = newName;
    _saveSoundsMeta(meta);
  }
  // 更新 IndexedDB 记录（保留 dataUrl / type）
  const db = await openDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SOUNDS, 'readwrite');
    const store = tx.objectStore(STORE_SOUNDS);
    const req = store.get(_ns(id));
    req.onsuccess = () => {
      const rec = req.result;
      if (rec) {
        rec.name = newName;
        store.put(rec);
      }
      resolve();
    };
    req.onerror = () => reject(tx.error);
    tx.onerror = () => reject(tx.error);
  });
}

// ============ 项目（多项目顶层） ============
function listProjects() {
  try { return JSON.parse(localStorage.getItem(LS_PROJECTS) || '[]'); } catch { return []; }
}

// 生成一个不与其他项目重名的名称：若 name 已存在，追加（数字），如「默认项目 (1)」「默认项目 (2)」
function uniqueProjectName(name) {
  const base = (name && String(name).trim()) || '未命名项目';
  const existing = new Set(listProjects().map(p => p.name));
  if (!existing.has(base)) return base;
  let n = 1;
  while (existing.has(`${base} (${n})`)) n++;
  return `${base} (${n})`;
}

function createProject(name) {
  const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const reg = listProjects();
  reg.push({ id, name: uniqueProjectName(name), createdAt: Date.now() });
  localStorage.setItem(LS_PROJECTS, JSON.stringify(reg));
  // 初始化空树
  _projectId = id;
  _tree = defaultTree();
  saveTree();
  localStorage.setItem(LS_LAST_PROJECT, id);
  return id;
}

function renameProject(id, name) {
  const reg = listProjects();
  const p = reg.find(x => x.id === id);
  if (p) {
    p.name = name || p.name;
    localStorage.setItem(LS_PROJECTS, JSON.stringify(reg));
  }
}

function deleteProject(id) {
  // 删除树与音效元数据
  localStorage.removeItem(LS_TREE_PREFIX + id);
  localStorage.removeItem(LS_SOUNDS_PREFIX + id);
  if (localStorage.getItem(LS_LAST_PROJECT) === id) localStorage.removeItem(LS_LAST_PROJECT);
  // 从注册表移除
  const reg = listProjects().filter(p => p.id !== id);
  localStorage.setItem(LS_PROJECTS, JSON.stringify(reg));
  if (_projectId === id) _projectId = null;
  // 异步清理该项目命名空间下的 blob / sound（不阻塞 UI）
  const prefix = id + PROJECT_NS_SEP;
  (async () => {
    try {
      const db = await openDB();
      for (const store of [STORE_BLOBS, STORE_SOUNDS]) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(store, 'readwrite');
          const os = tx.objectStore(store);
          const req = os.getAllKeys();
          req.onsuccess = () => {
            (req.result || []).forEach(k => {
              if (typeof k === 'string' && k.startsWith(prefix)) os.delete(k);
            });
            resolve();
          };
          req.onerror = () => reject(req.error);
        });
      }
    } catch (e) {
      console.error('deleteProject 清理失败', e);
    }
  })();
}

// 复制项目：生成全新注册表条目，深拷贝树、音效元数据、IndexedDB 命名空间前缀下的 blob/sound。
// 复制后副本与原件完全独立——物理键带新项目前缀，后续任一方增删改都不影响另一方。
async function cloneProject(srcId, newName) {
  if (!srcId) throw new Error(window.t('源项目不存在'));
  const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  const srcName = getProjectName(srcId) || '未命名项目';
  const name = uniqueProjectName(newName || (srcName + ' 副本'));
  // 1) 注册表新增条目
  const reg = listProjects();
  reg.push({ id, name, createdAt: Date.now() });
  localStorage.setItem(LS_PROJECTS, JSON.stringify(reg));

  // 2) 复制树（localStorage，纯 JSON 直接整块复制即可）
  const treeRaw = localStorage.getItem(LS_TREE_PREFIX + srcId);
  if (treeRaw) localStorage.setItem(LS_TREE_PREFIX + id, treeRaw);

  // 3) 复制音效元数据（localStorage）
  const sndRaw = localStorage.getItem(LS_SOUNDS_PREFIX + srcId);
  if (sndRaw) localStorage.setItem(LS_SOUNDS_PREFIX + id, sndRaw);

  // 4) 复制 IndexedDB：blob / sound，按命名空间前缀整条复制（数据不变，仅改物理键前缀）
  const srcPrefix = srcId + PROJECT_NS_SEP;
  const dstPrefix = id + PROJECT_NS_SEP;
  const db = await openDB();
  for (const store of [STORE_BLOBS, STORE_SOUNDS]) {
    const items = await new Promise((res, rej) => {
      const tx = db.transaction(store, 'readonly');
      const r = tx.objectStore(store).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
    const toPut = items
      .filter(it => typeof it.id === 'string' && it.id.startsWith(srcPrefix))
      .map(it => Object.assign({}, it, { id: dstPrefix + it.id.slice(srcPrefix.length) }));
    if (toPut.length === 0) continue;
    await new Promise((res, rej) => {
      const tx = db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      toPut.forEach(rec => os.put(rec));
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
  }
  return id;
}

function getProjectName(id) {
  return listProjects().find(p => p.id === id)?.name || '';
}

function getCurrentProjectId() {
  return _projectId;
}

// 读取某项目的统计（不切换当前项目）
function getProjectStats(id) {
  const key = LS_TREE_PREFIX + id;
  let tree = null;
  try { const raw = localStorage.getItem(key); if (raw) tree = JSON.parse(raw); } catch {}
  if (!tree || !tree.nodes) return { models: 0, folders: 0, createdAt: null };
  const nodes = tree.nodes;
  return {
    models: Object.values(nodes).filter(n => n.type === 'model').length,
    folders: Object.values(nodes).filter(n => n.type === 'folder').length,
    createdAt: tree.createdAt || null,
  };
}

// 切换当前激活项目（会重置树缓存，下次 loadTree 重新加载）
function setCurrentProject(id) {
  if (id === _projectId) { _tree = null; return; }
  _projectId = id;
  _tree = null;
  localStorage.setItem(LS_LAST_PROJECT, id);
}

// 确保存在一个「默认项目」（用于承接迁移前的旧数据），返回其 id
function ensureDefaultProject() {
  const projects = listProjects();
  let p = projects.find(x => x.name === '默认项目');
  if (p) {
    if (!_projectId) _projectId = p.id;
    return p.id;
  }
  const id = 'p_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
  projects.push({ id, name: '默认项目', createdAt: Date.now() });
  localStorage.setItem(LS_PROJECTS, JSON.stringify(projects));
  localStorage.setItem(LS_LAST_PROJECT, id);
  _projectId = id;
  _tree = defaultTree();
  saveTree();
  return id;
}

// 首次启动：把旧版全局数据（单项目时代，存于无项目前缀的键）迁移到一个「默认项目」
// 判据是「旧数据是否仍存在」，而非「LS_PROJECTS 是否已存在」——
// 否则开发过程中若某次提前创建了 LS_PROJECTS 但默认项目树为空，旧数据会被永久跳过。
async function migrateLegacyIfNeeded() {
  const legacyTreeRaw = localStorage.getItem(LS_TREE);
  let legacyTree = null;
  if (legacyTreeRaw) { try { legacyTree = JSON.parse(legacyTreeRaw); } catch {} }
  const legacyHasNodes = !!(legacyTree && legacyTree.nodes && Object.keys(legacyTree.nodes).length > 0);

  let legacySounds = [];
  try { legacySounds = JSON.parse(localStorage.getItem(LS_SOUNDS) || '[]'); } catch {}
  const legacyHasSounds = Array.isArray(legacySounds) && legacySounds.length > 0;

  // 没有任何旧数据需要迁移：仅确保默认项目存在即可
  if (!legacyHasNodes && !legacyHasSounds) {
    ensureDefaultProject();
    return;
  }

  // 存在旧数据：找到 / 创建默认项目，把旧数据「合并」进去（不覆盖用户已上传的内容）
  const defaultId = ensureDefaultProject();
  _projectId = defaultId;

  // 合并旧树节点（已存在的节点保留现有，避免覆盖用户新上传）
  if (legacyHasNodes) {
    const tree = loadTree();
    for (const [oldId, node] of Object.entries(legacyTree.nodes)) {
      if (tree.nodes[oldId]) continue;
      tree.nodes[oldId] = node;
      if (node.parentId && tree.nodes[node.parentId]) {
        const p = tree.nodes[node.parentId];
        p.children = p.children || [];
        if (!p.children.includes(oldId)) p.children.push(oldId);
      } else if (!tree.rootIds.includes(oldId)) {
        tree.rootIds.push(oldId);
      }
    }
    saveTree();
  }

  // 合并旧音效元数据
  if (legacyHasSounds) {
    const meta = _loadSoundsMeta();
    const existingIds = new Set(meta.map(s => s.id));
    for (const s of legacySounds) {
      if (s && s.id && !existingIds.has(s.id)) meta.push(s);
    }
    _saveSoundsMeta(meta);
  }

  // 迁移 blob（旧全局键 -> 默认项目命名空间），仅处理旧树引用的 blobId，避免误伤已命名空间化的记录
  try {
    const blobIds = legacyHasNodes
      ? Object.values(legacyTree.nodes)
          .filter(n => n.type === 'model' && n.blobId)
          .map(n => n.blobId)
      : [];
    for (const k of blobIds) {
      const nk = _ns(k);
      if (!(await blobGetRaw(nk))) {
        const url = await blobGetRaw(k);
        if (url) await blobPutRaw(nk, url);
      }
      await blobDeleteRaw(k); // 删除旧全局键（无论是否迁移成功都清，避免重复迁移）
    }
  } catch (e) { console.error('blob 迁移失败', e); }

  // 迁移 sound 二进制（旧键 -> 命名空间），仅处理无命名空间前缀的旧记录
  try {
    const db = await openDB();
    const all = await new Promise((res, rej) => {
      const tx = db.transaction(STORE_SOUNDS, 'readonly');
      const r = tx.objectStore(STORE_SOUNDS).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
    for (const rec of all) {
      if (!rec || !rec.id || rec.id.includes(PROJECT_NS_SEP)) continue; // 跳过已命名空间化的
      const nk = _ns(rec.id);
      if (!(await getSoundRaw(nk))) await putSoundRaw(Object.assign({}, rec, { id: nk }));
      await deleteSoundRaw(rec.id);
    }
  } catch (e) { console.error('sound 迁移失败', e); }

  // 清理旧全局键
  localStorage.removeItem(LS_TREE);
  localStorage.removeItem(LS_SOUNDS);
}

// ============ 树形结构 ============
// 节点结构：
// {
//   id: string,
//   name: string,
//   type: 'folder' | 'model',
//   parentId: string | null,    // null = 根
//   children: string[],         // 文件夹时存子节点 id
//   createdAt: number,
//   // model 字段
//   size: number,               // 字节
//   blobId: string,             // 指向 IndexedDB
//   info: { vertices, materials, ... }
// }
//
// 维护两个索引：
//   nodes: { [id]: node }
//   rootIds: string[]

const defaultTree = () => ({
  nodes: {},
  rootIds: [],
  rootDescription: '',
  rootBg: { type: 'solid', color1: '#000000' },
  version: 1,
});

let _tree = null;

function _treeKey() {
  return _projectId ? (LS_TREE_PREFIX + _projectId) : LS_TREE;
}

function loadTree() {
  if (_tree) return _tree;
  try {
    const raw = localStorage.getItem(_treeKey());
    if (raw) {
      _tree = JSON.parse(raw);
      if (!_tree.nodes) _tree.nodes = {};
      if (!_tree.rootIds) _tree.rootIds = [];
    } else {
      _tree = defaultTree();
    }
  } catch (e) {
    console.error('Tree parse failed, resetting', e);
    _tree = defaultTree();
  }
  return _tree;
}

function saveTree() {
  localStorage.setItem(_treeKey(), JSON.stringify(_tree));
}

function genId(prefix = 'n') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// 递归收集某节点下的所有 model id（用于删除时连带删 blob）
function collectDescendantIds(nodeId) {
  const ids = [nodeId];
  const walk = (id) => {
    const n = _tree.nodes[id];
    if (!n) return;
    for (const cid of n.children || []) walk(cid);
  };
  walk(nodeId);
  return ids;
}

function getNode(id) {
  return _tree.nodes[id] || null;
}

function getPath(id) {
  // 返回从根到该节点的 id 路径（含自身）
  const path = [];
  let cur = id;
  while (cur) {
    path.unshift(cur);
    const n = _tree.nodes[cur];
    if (!n) break;
    cur = n.parentId;
  }
  return path;
}

function getPathNames(id) {
  return getPath(id).map(nid => _tree.nodes[nid]?.name).filter(Boolean);
}

function getChildren(parentId) {
  const pid = parentId || null;
  if (pid === null) return _tree.rootIds.map(id => _tree.nodes[id]).filter(Boolean);
  const parent = _tree.nodes[pid];
  if (!parent) return [];
  return (parent.children || []).map(id => _tree.nodes[id]).filter(Boolean);
}

function addNode(node) {
  _tree.nodes[node.id] = node;
  if (node.parentId) {
    const p = _tree.nodes[node.parentId];
    if (p) {
      p.children = p.children || [];
      p.children.push(node.id);
    }
  } else {
    _tree.rootIds.push(node.id);
  }
  saveTree();
}

function removeNode(id) {
  const n = _tree.nodes[id];
  if (!n) return;
  // 从父级 children 中移除
  if (n.parentId) {
    const p = _tree.nodes[n.parentId];
    if (p?.children) {
      p.children = p.children.filter(cid => cid !== id);
    }
  } else {
    _tree.rootIds = _tree.rootIds.filter(cid => cid !== id);
  }
  // 递归删除子节点
  const allIds = collectDescendantIds(id);
  for (const aid of allIds) {
    delete _tree.nodes[aid];
  }
  saveTree();
  return allIds; // 返回被删的 id 列表（用于清理 blob）
}

function renameNode(id, newName) {
  const n = _tree.nodes[id];
  if (!n) return;
  n.name = newName;
  saveTree();
}

function updateDescription(id, desc) {
  const n = _tree.nodes[id];
  if (!n) return;
  n.description = desc || '';
  saveTree();
}

// 设置/清除模型的默认视角（{ pos:[x,y,z], target:[x,y,z] } 或 null）
function setDefaultView(id, view) {
  const n = _tree.nodes[id];
  if (!n) return;
  n.defaultView = view || null;
  saveTree();
}

// 设置/清除「关闭手动旋转」开关：勾选后导出的成品禁止手动旋转，固定在默认视角
function setLockRotation(id, val) {
  const n = _tree.nodes[id];
  if (!n) return;
  n.lockRotation = !!val;
  saveTree();
}

// 设置模型的环境贴图（HDRI key）
function setEnvMap(id, key) {
  const n = _tree.nodes[id];
  if (!n) return;
  n.envMap = key || window.HDRI_DEFAULT;
  saveTree();
}

// 设置模型的 HDRI 曝光值
function setEnvExposure(id, val) {
  const n = _tree.nodes[id];
  if (!n) return;
  n.envExposure = (typeof val === 'number' && isFinite(val)) ? val : 1.0;
  saveTree();
}
function setEnvRotation(id, val) {
  const n = _tree.nodes[id];
  if (!n) return;
  n.envRotation = (typeof val === 'number' && isFinite(val)) ? val : 0;
  saveTree();
}
// 景深（Bokeh）设置：node.dof = { enabled, focusObject, aperture, maxblur }
//   focusObject: 对焦物体名称（字符串）或 null；null 时运行时对焦画面中心，对焦距离随镜头位置自动跟随
function getDof(id) {
  const n = _tree.nodes[id];
  return (n && n.dof) ? n.dof : null;
}
function setDof(id, dof) {
  const n = _tree.nodes[id];
  if (!n) return;
  n.dof = dof;
  saveTree();
}

function getRootDescription() {
  return _tree.rootDescription || '';
}

function setRootDescription(desc) {
  _tree.rootDescription = desc || '';
  saveTree();
}

// 全局镜头设置（场景级，随项目保存）：目前主要存场视角 fov
function getCameraSettings() {
  return (_tree && _tree.camera) ? Object.assign({ fov: 50 }, _tree.camera) : { fov: 50 };
}
function setCameraSettings(partial) {
  if (!_tree) return;
  _tree.camera = Object.assign({}, _tree.camera, partial);
  saveTree();
}

function moveNode(id, newParentId) {
  const n = _tree.nodes[id];
  if (!n) return;
  if (id === newParentId) return;
  // 不能移动到自己的后代
  const descendants = new Set(collectDescendantIds(id));
  if (newParentId && descendants.has(newParentId)) return;

  // 从原父级移除
  if (n.parentId) {
    const p = _tree.nodes[n.parentId];
    if (p?.children) p.children = p.children.filter(c => c !== id);
  } else {
    _tree.rootIds = _tree.rootIds.filter(c => c !== id);
  }
  // 加入新父级
  n.parentId = newParentId;
  if (newParentId) {
    const p = _tree.nodes[newParentId];
    if (p) {
      p.children = p.children || [];
      p.children.push(id);
    }
  } else {
    _tree.rootIds.push(id);
  }
  saveTree();
}

function countModels() {
  return Object.values(_tree.nodes).filter(n => n.type === 'model').length;
}

function countFolders() {
  return Object.values(_tree.nodes).filter(n => n.type === 'folder').length;
}

// 导出当前项目（树 + 仅本项目引用的 blob + 仅本项目音效）为 JSON
// 按项目 id 导出整个项目为自包含 JSON（不依赖 / 不修改全局当前项目上下文）。
// 与 importProject 完全对应：blobs 键为裸 id，导入时由 blobPut 重新命名空间化。
// 返回 { version, schema, projectName, exportedAt, tree, blobs, sounds }
async function exportProjectById(id) {
  if (!id) throw new Error(window.t('缺少项目 id'));
  // 1) 该项目的树（直接从 localStorage 读取，不依赖全局 _tree / _projectId）
  let tree = null;
  try {
    const raw = localStorage.getItem(LS_TREE_PREFIX + id);
    if (raw) tree = JSON.parse(raw);
  } catch (e) { /* ignore */ }
  if (!tree || !tree.nodes) tree = { nodes: {}, root: null, rootBg: null, createdAt: Date.now() };

  // 2) 该项目的 blob（物理键前缀 = 项目id::blobId，使用原始读写避免命名空间依赖）
  const blobs = {};
  const blobIds = Object.values(tree.nodes)
    .filter(n => n.type === 'model' && n.blobId)
    .map(n => n.blobId);
  for (const bid of blobIds) {
    const d = await blobGetRaw(id + PROJECT_NS_SEP + bid);
    if (d) blobs[bid] = await blobToDataUrl(d); // 导出为 JSON 需要 base64 文本
  }

  // 3) 该项目命名空间下的音效
  const sounds = {};
  const prefix = id + PROJECT_NS_SEP;
  try {
    const db = await openDB();
    const all = await new Promise((res, rej) => {
      const tx = db.transaction(STORE_SOUNDS, 'readonly');
      const r = tx.objectStore(STORE_SOUNDS).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    });
    for (const rec of all) {
      if (rec.id && rec.id.startsWith(prefix)) {
        sounds[rec.id.slice(prefix.length)] = { name: rec.name, type: rec.type, dataUrl: rec.dataUrl };
      }
    }
  } catch (e) { /* ignore */ }

  return {
    version: 2,
    schema: 'glb-manager-project',
    projectName: getProjectName(id) || '',
    exportedAt: new Date().toISOString(),
    tree,
    blobs,
    sounds,
  };
}

// 导出当前项目（编辑器内「导出」按钮调用）
async function exportProject() {
  if (!_projectId) throw new Error(window.t('未选择项目'));
  return exportProjectById(_projectId);
}

// 导入项目（合并模式：保留现有，添加新条目，id 冲突则跳过）
async function importProject(data) {
  if (!data?.tree) throw new Error(window.t('数据格式错误'));
  let addedModels = 0, addedFolders = 0, skipped = 0;
  // 合并树（避免 id 冲突，重命名后插入）
  const idMap = {};
  for (const [oldId, node] of Object.entries(data.tree.nodes || {})) {
    let newId = oldId;
    if (_tree.nodes[oldId]) {
      // 冲突，生成新 id
      newId = genId(node.type === 'folder' ? 'f' : 'm');
      idMap[oldId] = newId;
    } else {
      idMap[oldId] = oldId;
    }
    const newNode = JSON.parse(JSON.stringify(node));
    newNode.id = newId;
    // 修复 parentId
    if (newNode.parentId && idMap[newNode.parentId]) {
      newNode.parentId = idMap[newNode.parentId];
    }
    // 修复 children
    newNode.children = (newNode.children || []).map(c => idMap[c] || c).filter(c => _tree.nodes[c] || data.tree.nodes[c]);
    if (_tree.nodes[newId]) {
      skipped++;
      continue;
    }
    addNode(newNode);
    if (node.type === 'folder') addedFolders++; else addedModels++;
  }
  // 导入 blobs（命名空间由 blobPut 自动处理）
  for (const [oldId, dataUrl] of Object.entries(data.blobs || {})) {
    const newId = idMap[oldId] || oldId;
    if (newId) await blobPut(newId, dataUrl);
  }
  // 导入音效（命名空间由 addSound 自动处理）
  for (const [oldId, snd] of Object.entries(data.sounds || {})) {
    const newId = idMap[oldId] || oldId;
    if (newId && snd && snd.dataUrl) {
      await addSound({ id: newId, name: snd.name || oldId, type: snd.type || 'audio/wav', dataUrl: snd.dataUrl });
    }
  }
  return { addedModels, addedFolders, skipped };
}

// ============ 背景色（节点属性 + 继承） ============
function setBgSettings(nodeId, settings) {
  if (nodeId === null || nodeId === undefined) {
    _tree.rootBg = settings || { type: 'solid', color1: '#000000' };
  } else {
    const n = _tree.nodes[nodeId];
    if (!n) return;
    if (settings) {
      n.bgSettings = settings;
    } else {
      delete n.bgSettings;
    }
  }
  saveTree();
}

function getBgSettings(nodeId) {
  if (nodeId === null || nodeId === undefined) {
    return _tree.rootBg || { type: 'solid', color1: '#000000' };
  }
  const n = _tree.nodes[nodeId];
  return n?.bgSettings || null;
}

function setInteractions(nodeId, map) {
  const n = _tree.nodes[nodeId];
  if (!n) return;
  if (map && Object.keys(map).length > 0) {
    n.interactions = map;
  } else {
    delete n.interactions;
  }
  saveTree();
}

function getInteractions(nodeId) {
  const n = _tree.nodes[nodeId];
  if (!n) return null;
  const map = n.interactions || null;
  // 迁移：旧版把单个「结束物体」存在 n.exitMesh（字符串），新版改为每个 mesh 交互里的 exit 布尔标记，支持多个结束物体
  if (n.exitMesh && (!map || !map[n.exitMesh] || !(map[n.exitMesh].exit))) {
    const m = map ? JSON.parse(JSON.stringify(map)) : {};
    const cur = m[n.exitMesh];
    const e = (cur && typeof cur !== 'string')
      ? cur
      : { clip: (typeof cur === 'string' ? cur : ''), sound: '', respond: true, pingpong: false, autoReturn: false, deleteAfter: false };
    e.exit = true;
    m[n.exitMesh] = e;
    n.interactions = m;
    delete n.exitMesh;
    saveTree();
    return m;
  }
  return map;
}

// 向上回溯找第一个设置了背景色的节点，最终兜底为根目录颜色
function resolveBgSettings(nodeId) {
  var cur = nodeId;
  while (true) {
    var s = getBgSettings(cur);
    if (s) return s;
    if (cur === null || cur === undefined) break;
    var n = _tree.nodes[cur];
    if (!n) break;
    cur = n.parentId;
  }
  return { type: 'solid', color1: '#000000' };
}

// 交互链（解谜顺序）：每个模型可有多条链，每条链是有序的 mesh 名数组 [{ id, name, order:[meshName] }]
function getChains(nodeId) {
  const n = _tree.nodes[nodeId];
  if (!n) return [];
  return n.chains || [];
}
function setChains(nodeId, chains) {
  const n = _tree.nodes[nodeId];
  if (!n) return;
  if (Array.isArray(chains) && chains.length > 0) n.chains = chains;
  else delete n.chains;
  saveTree();
}

// 清空当前项目（树 + 本项目 blob + 本项目音效）
async function resetAll() {
  const tree = loadTree();
  const blobIds = Object.values(tree.nodes)
    .filter(n => n.type === 'model' && n.blobId)
    .map(n => n.blobId);
  await Promise.all(blobIds.map(id => blobDelete(id)));
  const prefix = _projectId ? (_projectId + PROJECT_NS_SEP) : '';
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_SOUNDS, 'readwrite');
      const os = tx.objectStore(STORE_SOUNDS);
      const req = os.getAllKeys();
      req.onsuccess = () => {
        (req.result || []).forEach(k => {
          if (typeof k === 'string' && k.startsWith(prefix)) os.delete(k);
        });
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (e) { /* ignore */ }
  _tree = defaultTree();
  saveTree();
  _saveSoundsMeta([]);
}

// 挂到 window 上供其他脚本使用
window.DB = {
  openDB, blobPut, blobGet, blobDelete, blobList, blobStats,
  loadTree, saveTree, genId,
  getNode, getPath, getPathNames, getChildren,
  addNode, removeNode, renameNode, moveNode,
  updateDescription, getRootDescription, setRootDescription,
  getCameraSettings, setCameraSettings,
  setDefaultView,
  setLockRotation,
  setEnvMap, setEnvExposure, setEnvRotation, setDof, getDof,
  countModels, countFolders, collectDescendantIds,
  exportProject, exportProjectById, importProject, resetAll,
  setBgSettings, getBgSettings, resolveBgSettings,
  setInteractions, getInteractions,
  setChains, getChains,
  addSound, getSound, getSoundDataUrl, getSounds, getAllSoundData, deleteSound, renameSound,
  // 多项目
  listProjects, createProject, renameProject, deleteProject, cloneProject,
  getProjectName, getCurrentProjectId, getProjectStats,
  setCurrentProject, migrateLegacyIfNeeded,
};
