// js/main.js — 主应用入口

// 所有依赖由 index.html 按顺序通过传统 <script> 标签加载，均为全局变量：
//   GLBViewer (viewer.js), DB (db.js), exportModelAsStandaloneHTML / exportFolderAsGalleryHTML (exporter.js),
//   escapeHtml / formatSize / formatNumber / downloadBlob / downloadJson (utils.js)

// ============ 状态 ============
const state = {
  currentFolderId: null,       // null = 根（仅作上下文，如面包屑/背景/导出）
  selectedFolderId: null,      // 当前被「选中」的文件夹（用于树高亮与属性栏文件夹信息）
  selectedModelId: null,       // 当前查看的模型
  expandedFolders: new Set(),  // 树中展开的文件夹
  activeTab: 'props',          // 'props'（模型/文件夹属性，互斥） | 'sounds'
  currentProjectId: null,
  treeFilter: '',               // 资源树过滤关键词（空 = 不过滤）      // 当前打开的项目 id（用于面包屑根节点）
};

// ============ DOM ============
const $ = (id) => document.getElementById(id);
const dom = {
  tree: $('tree'),
  treeStats: $('tree-stats'),
  crumbs: $('crumbs'),
  infoContent: $('info-content'),
  viewerContainer: $('viewer-canvas'),
  viewerEmpty: $('viewer-empty'),
  ovInfo: $('ov-info'),
  ovStats: $('ov-stats'),
  modal: $('modal'),
  modalTitle: $('modal-title'),
  modalLabel: $('modal-label'),
  modalInput: $('modal-input'),
  modalExtra: $('modal-extra'),
  fileInput: $('file-input'),
  toasts: $('toasts'),
  statModels: $('stat-models'),
  statFolders: $('stat-folders'),
  statStorage: $('stat-storage'),
  statStatus: $('stat-status'),
  tabProps: $('tab-props'),
  tabSounds: $('tab-sounds'),
  soundsContent: $('sounds-content'),
  infoContent: $('info-content'),
  folderContent: $('folder-content'),
  statSelected: $('stat-selected'),
  statSaved: $('stat-saved'),
  objectChip: $('viewer-object-chip'),
  panelSplitter: $('panel-splitter'),
  mainEl: document.querySelector('.main'),
  btnTogglePanel: $('btn-toggle-panel'),
  togglePanelLabel: $('toggle-panel-label'),
  btnLang: $('btn-lang'),
  langLabel: $('lang-label'),
  versionBadge: $('version-badge'),
};

// ============ 图标（内联 SVG，无 emoji） ============
// 统一描边风格：stroke=currentColor，尺寸由 CSS 控制
const ICONS = {
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a1 1 0 0 1 1-1h3.6l1.8 2H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/></svg>',
  cube:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.5 21 7v10l-9 4.5L3 17V7z"/><path d="M3 7l9 4.5L21 7M12 11.5V21.5"/></svg>',
  home:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-6.5L20 11M6.5 9.5V20h11V9.5"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L18.5 9.5a2 2 0 0 0-3-3L5 17z"/><path d="M13.5 6.5l3 3"/></svg>',
  doc:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  plus:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  swatch: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/></svg>',
  trash:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  play:   '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M8 5v14l11-7z"/></svg>',
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>',
  rotate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.3"/><path d="M21 4v4h-4"/></svg>',
  export: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>',
  check:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l4 4L19 7"/></svg>',
  warn:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19z"/><path d="M12 9v5M12 17h.01"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21V9M8 13l4-4 4 4"/><path d="M4 5v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V5"/></svg>',
  download:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 11l4 4 4-4"/><path d="M4 19h16"/></svg>',
  box:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l9-4 9 4-9 4z"/><path d="M3 8v8l9 4 9-4V8M12 12v8"/></svg>',
  grid:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/></svg>',
  panel:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="9" y1="4" x2="9" y2="20"/></svg>',
};

// ============ 工具函数 ============
function toast(msg, type = 'info', duration = 3000) {
  const t = document.createElement('div');
  t.className = 'toast' + (type !== 'info' ? ' ' + type : '');
  t.textContent = msg;
  dom.toasts.appendChild(t);
  setTimeout(() => {
    t.style.animation = 'slideIn 0.2s reverse';
    setTimeout(() => t.remove(), 200);
  }, duration);
}

// 把文件读成 base64 data URL（音效库导入用：音效以字符串形式存于 sounds store）
function base64FromFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = ((e.loaded / e.total) * 100).toFixed(0);
        dom.statStatus.textContent = `● 读取中 ${pct}%`;
        dom.statStatus.className = 'item warn';
      }
    };
    reader.readAsDataURL(file);
  });
}

// ============ 模态对话框 ============
function showModal({ title, label, placeholder, value = '', extra = '' }) {
  title = t(title); label = t(label); placeholder = t(placeholder);
  return new Promise((resolve) => {
    dom.modalTitle.textContent = title;
    dom.modalLabel.textContent = label;
    dom.modalInput.placeholder = placeholder || '';
    dom.modalInput.value = value;
    dom.modalExtra.innerHTML = extra || '';
    dom.modal.classList.add('open');
    setTimeout(() => dom.modalInput.focus(), 50);

    const cleanup = (result) => {
      dom.modal.classList.remove('open');
      $('modal-ok').onclick = null;
      $('modal-cancel').onclick = null;
      dom.modalInput.onkeydown = null;
      resolve(result);
    };

    $('modal-ok').onclick = () => cleanup(dom.modalInput.value.trim());
    $('modal-cancel').onclick = () => cleanup(null);
    dom.modalInput.onkeydown = (e) => {
      if (e.key === 'Enter') cleanup(dom.modalInput.value.trim());
      if (e.key === 'Escape') cleanup(null);
    };
  });
}

// 确认对话框（无输入框，仅 OK/Cancel）
function showConfirm(title, message, extra = '') {
  title = t(title); message = t(message);
  return new Promise((resolve) => {
    dom.modalTitle.textContent = title;
    dom.modalLabel.textContent = '';
    dom.modalInput.style.display = 'none';
    dom.modalExtra.innerHTML = `<div style="font-size:14px;margin-bottom:8px;color:var(--txt)">${escapeHtml(message)}</div>${extra}`;
    dom.modal.classList.add('open');

    const cleanup = (result) => {
      dom.modal.classList.remove('open');
      dom.modalInput.style.display = '';
      dom.modalExtra.innerHTML = '';
      $('modal-ok').onclick = null;
      $('modal-cancel').onclick = null;
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };

    const onKey = (e) => {
      if (e.key === 'Enter') cleanup(true);
      if (e.key === 'Escape') cleanup(false);
    };

    $('modal-ok').onclick = () => cleanup(true);
    $('modal-cancel').onclick = () => cleanup(false);
    document.addEventListener('keydown', onKey);
    setTimeout(() => $('modal-ok').focus(), 50);
  });
}

// ============ 文件树渲染 ============
function renderTree() {
  const tree = DB.loadTree();
  const allNodes = Object.values(tree.nodes);
  const folderCount = allNodes.filter(n => n.type === 'folder').length;
  const modelCount = allNodes.filter(n => n.type === 'model').length;
  dom.treeStats.textContent = `${t('文件夹')} ${folderCount} · ${t('模型')} ${modelCount}`;

  // 资源树过滤：命中节点 + 其所有祖先 + 路径上的文件夹全部显示；过滤时强制展开
  const visible = computeTreeVisible();
  const html = renderNodeChildren(null, 0, visible);
  dom.tree.innerHTML = html;
  bindTreeEvents();
}

// 返回需要显示的节点 id 集合；无过滤时返回 null（显示全部）
function computeTreeVisible() {
  const kw = (state.treeFilter || '').trim().toLowerCase();
  if (!kw) return null;
  const visible = new Set();
  function visit(parentId) {
    let any = false;
    for (const node of DB.getChildren(parentId)) {
      const self = node.name.toLowerCase().includes(kw);
      const child = visit(node.id);
      if (self || child) { visible.add(node.id); any = true; }
    }
    return any;
  }
  visit(null);
  return visible;
}

function renderNodeChildren(parentId, depth, visible) {
  const children = DB.getChildren(parentId);
  if (children.length === 0) return '';
  let html = '';
  for (const node of children) {
    if (visible && !visible.has(node.id)) continue;
    html += renderTreeNode(node, depth, visible);
  }
  return html;
}

function renderTreeNode(node, depth, visible) {
  const isFolder = node.type === 'folder';
  // 文件夹高亮：仅当它就是被「选中」的文件夹
  // 模型高亮：仅当它就是当前选中的模型
  const isActive = isFolder
    ? (state.selectedFolderId === node.id)
    : (state.selectedModelId === node.id);
  // 过滤时强制展开，确保命中项与其路径可见
  const forceOpen = !!visible;
  const isExpanded = forceOpen || state.expandedFolders.has(node.id);

  // 子项统计
  let badge = '';
  if (isFolder) {
    const subs = DB.getChildren(node.id);
    if (subs.length > 0) badge = `<span class="badge">${subs.length}</span>`;
  } else {
    badge = `<span class="badge">${formatSize(node.size || 0)}</span>`;
  }

  const padLeft = 8 + depth * 14;
  const caret = isFolder
    ? `<span class="caret ${isExpanded ? 'open' : ''}">${isExpanded ? '▾' : '▸'}</span>`
    : `<span class="caret"></span>`;
  const icon = isFolder ? ICONS.folder : ICONS.cube;

  let html = `<div class="tree-node" data-id="${node.id}" data-type="${node.type}">
    <div class="tree-row ${isActive ? 'active' : ''}" style="padding-left:${padLeft}px" draggable="true">
      ${caret}
      <span class="icon">${icon}</span>
      <span class="name" title="${escapeHtml(node.name)}">${escapeHtml(node.name)}</span>
      ${badge}
      <span class="row-actions">
        <button data-act="rename" title="重命名">${ICONS.pencil}</button>
        ${isFolder ? `<button data-act="desc" title="编辑描述（导出目录时显示在顶部）">${ICONS.doc}</button>` : ''}
        ${isFolder ? `<button data-act="newsub" title="新建子文件夹">${ICONS.plus}</button>` : ''}
        <button data-act="bg" title="设置背景色（影响该项及子级）">${ICONS.swatch}</button>
        <button data-act="delete" title="删除">${ICONS.trash}</button>
      </span>
    </div>`;

  if (isFolder) {
    const childHtml = isExpanded ? renderNodeChildren(node.id, depth + 1, visible) : '';
    html += `<div class="tree-children ${isExpanded ? 'open' : ''}">${childHtml}</div>`;
  }

  html += '</div>';
  return html;
}

function bindTreeEvents() {
  dom.tree.querySelectorAll('.tree-row').forEach(row => {
    const nodeEl = row.closest('.tree-node');
    const id = nodeEl.dataset.id;
    const type = nodeEl.dataset.type;

    row.addEventListener('click', (e) => {
      // 如果点击的是操作按钮，由按钮自己处理
      if (e.target.closest('.row-actions')) return;
      if (type === 'folder') {
        if (state.selectedFolderId === id) {
          // 已选中该文件夹 → 切换展开 / 收起
          if (state.expandedFolders.has(id)) {
            state.expandedFolders.delete(id);
          } else {
            state.expandedFolders.add(id);
          }
        } else {
          // 选中该文件夹（设为当前目录、展开、清空模型选中、显示文件夹信息）
          state.selectedFolderId = id;
          state.currentFolderId = id;
          state.expandedFolders.add(id);
          state.selectedModelId = null;
          viewer.clear();
          dom.viewerEmpty.classList.remove('hidden');
          applyNodeBg(id);
          switchTab('props');
        }
      } else {
        // 模型
        state.selectedModelId = id;
        state.currentFolderId = DB.getNode(id)?.parentId;
        state.selectedFolderId = null;   // 取消文件夹选中高亮（folder 只是上下文）
        loadModelIntoViewer(id);
        switchTab('props');
      }
      renderAll();
    });

    // 拖拽
    row.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
      row.style.opacity = '0.4';
    });
    row.addEventListener('dragend', () => {
      row.style.opacity = '';
      dom.tree.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    // 文件夹作为放置目标
    if (type === 'folder') {
      row.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        row.classList.add('drag-over');
      });
      row.addEventListener('dragleave', (e) => {
        // 只在真正离开时移除（避免子元素触发）
        if (e.relatedTarget && row.contains(e.relatedTarget)) return;
        row.classList.remove('drag-over');
      });
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        row.classList.remove('drag-over');
        const draggedId = e.dataTransfer.getData('text/plain');
        if (!draggedId || draggedId === id) return;
        // 不能拖到自己的后代
        const descendants = new Set(DB.collectDescendantIds(draggedId));
        if (descendants.has(id)) {
          toast('不能移动到自己的子文件夹', 'error');
          return;
        }
        DB.moveNode(draggedId, id);
        toast(t('已移动到') + ' ' + (DB.getNode(id)?.name || t('文件夹')));
        renderAll();
      });
    }
  });

  // 操作按钮
  dom.tree.querySelectorAll('.row-actions button').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const nodeEl = btn.closest('.tree-node');
      const id = nodeEl.dataset.id;
      const act = btn.dataset.act;
      if (act === 'rename') await handleRename(id);
      else if (act === 'desc') await handleEditDescription(id);
      else if (act === 'delete') await handleDelete(id);
      else if (act === 'newsub') await handleNewFolder(id);
      else if (act === 'bg') showBgModal(id);
    });
  });
}

// ============ 面包屑 ============
function renderCrumbs() {
  const projName = (state.currentProjectId && DB.getProjectName(state.currentProjectId)) || '项目';
  let html = `<span class="crumb crumb-root" data-id="">${escapeHtml(projName)}</span><span class="crumb-sep">/</span>`;
  if (state.currentFolderId === null) {
    html += `<span class="crumb" data-id="">${ICONS.home} ${t('根目录')}</span>`;
  } else {
    const pathIds = DB.getPath(state.currentFolderId);
    html += `<span class="crumb" data-id="">${ICONS.home} ${t('根目录')}</span>`;
    for (const id of pathIds) {
      const n = DB.getNode(id);
      if (!n) continue;
      html += `<span class="crumb-sep">/</span><span class="crumb" data-id="${id}">${escapeHtml(n.name)}</span>`;
    }
  }
  dom.crumbs.innerHTML = html;
  dom.crumbs.querySelectorAll('.crumb').forEach(c => {
    c.addEventListener('click', () => {
      const id = c.dataset.id || null;
      state.currentFolderId = id;
      state.selectedFolderId = id;   // 面包屑导航即选中该文件夹
      if (id) state.expandedFolders.add(id);
      state.selectedModelId = null;
      viewer.clear();
      dom.viewerEmpty.classList.remove('hidden');
      applyNodeBg(id);
      renderAll();
    });
  });
}

// ============ 模型信息面板 ============
// 「基本信息」「几何信息」默认收起（对制作帮助不大），点击标题展开/收回
let basicInfoExpanded = false;
let geoInfoExpanded = false;
let interactExpanded = false;
let envExpanded = false;
let rotationExpanded = false;
async function renderModelInfo() {
  const id = state.selectedModelId;
  if (!id) {
    dom.infoContent.innerHTML = `
      <div class="empty-grid" style="height:auto;padding:20px 0">
        <div class="icon">${ICONS.cube}</div>
        <div class="hint">${t('选择一个模型查看详情')}</div>
      </div>`;
    return;
  }
  const n = DB.getNode(id);
  if (!n) return;
  const sounds = await DB.getSounds();
  const stats = viewer.getLastStats() || {};
  const path = DB.getPathNames(id).join(' / ');

  let html = `
    <div class="panel-section">
      <h4 class="collapse-toggle" data-body="basic-info-body" style="cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none;margin-bottom:${basicInfoExpanded ? '8px' : '0'}" title="点击展开 / 收起基本信息">
        <span class="collapse-arrow" style="display:inline-block;font-size:10px;line-height:1;color:var(--txt-2)">${basicInfoExpanded ? '▾' : '▸'}</span>
        ${t('基本信息')}
      </h4>
      <div class="collapse-body" id="basic-info-body" ${basicInfoExpanded ? '' : 'hidden'}>
        <div class="kv-row"><span class="k">${t('名称')}</span><input class="info-name-input" id="info-name-input" value="${escapeHtml(n.name)}" title="点击修改名称，回车或失焦生效" spellcheck="false"></div>
        <div class="kv-row"><span class="k">${t('类型')}</span><span class="v">${t('GLB 模型')}</span></div>
        <div class="kv-row"><span class="k">${t('大小')}</span><span class="v">${formatSize(n.size || 0)}</span></div>
        <div class="kv-row"><span class="k">${t('路径')}</span><span class="v" style="font-size:11px">${escapeHtml(path)}</span></div>
        <div class="kv-row"><span class="k">${t('创建时间')}</span><span class="v" style="font-size:11px">${new Date(n.createdAt).toLocaleString('zh-CN')}</span></div>
      </div>
    </div>`;

  if (stats.maxDim !== undefined) {
    html += `
    <div class="panel-section">
      <h4 class="collapse-toggle" data-body="geo-info-body" style="cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none;margin-bottom:${geoInfoExpanded ? '8px' : '0'}" title="点击展开 / 收起几何信息">
        <span class="collapse-arrow" style="display:inline-block;font-size:10px;line-height:1;color:var(--txt-2)">${geoInfoExpanded ? '▾' : '▸'}</span>
        ${t('几何信息')}
      </h4>
      <div class="collapse-body" id="geo-info-body" ${geoInfoExpanded ? '' : 'hidden'}>
        <div class="kv-row"><span class="k">${t('包围盒')}</span><span class="v">${stats.size.x.toFixed(2)} × ${stats.size.y.toFixed(2)} × ${stats.size.z.toFixed(2)}</span></div>
        <div class="kv-row"><span class="k">${t('最大尺寸')}</span><span class="v">${stats.maxDim.toFixed(2)}</span></div>
        <div class="kv-row"><span class="k">${t('网格数')}</span><span class="v">${stats.meshes || 0}</span></div>
        <div class="kv-row"><span class="k">${t('顶点数')}</span><span class="v">${formatNumber(stats.vertices || 0)}</span></div>
        <div class="kv-row"><span class="k">${t('三角形')}</span><span class="v">${formatNumber(Math.round(stats.triangles || 0))}</span></div>
        <div class="kv-row"><span class="k">${t('材质数')}</span><span class="v">${stats.materials || 0}</span></div>
      </div>
    </div>`;

    if (viewer.getMeshList().length > 0) {
      html += `
    <div class="panel-section">
      <h4 class="collapse-toggle" data-body="interact-body" style="cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none;margin-bottom:${interactExpanded ? '8px' : '0'}" title="${t('点击展开 / 收起点击交互配置')}">
        <span class="collapse-arrow" style="display:inline-block;font-size:10px;line-height:1;color:var(--txt-2)">${interactExpanded ? '▾' : '▸'}</span>
        ${t('点击交互配置')}
      </h4>
      <div class="collapse-body" id="interact-body" ${interactExpanded ? '' : 'hidden'}>
        <div class="hint" style="font-size:11px;margin-bottom:8px;color:#8b93a3">点击模型上的部位，触发此处绑定的动画与音效（音效每次点击都会播放）。下面每个选项含义：<br>· <b>点击时响应</b>：取消后点击该物体无任何反应；<br>· <b>来回播放</b>：点一下正向播放，再点一下倒放回开头（需要两次点击）；<br>· <b>动画自动归位</b>：点一下即自动完整来回一次（正向播完自动倒放回开头，连续无需再次点击）；<br>· <b>动画结束后删除该物体</b>：动画（来回）播放完毕后，该物体从场景中消失，不可再点击；<br>· <b>设为结束物体</b>：在联动剧情工具里召唤该 3D 界面后，点击此物体即结束 3D 界面、继续剧情（可设置多个）。<br>音效在左侧「音效库」标签里导入与管理。</div>
        <div id="interact-list"></div>
      </div>
    </div>`;
    }
  }

  // 环境照明：HDRI 下拉 + 曝光（替代默认灯光）
  const envKey = n.envMap || window.HDRI_DEFAULT;
  const envExp = (typeof n.envExposure === 'number') ? n.envExposure : 1.0;
  const envLang = (window.getLang && window.getLang() === 'en') ? 'en' : 'zh';
  const envOptions = window.HDRI_OPTIONS.map(o => {
    const label = envLang === 'en' ? (o.en || o.label) : o.label;
    return `<option value="${o.key}" ${o.key === envKey ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
  html += `
    <div class="panel-section">
      <h4 class="collapse-toggle" data-body="env-body" style="cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none;margin-bottom:${envExpanded ? '8px' : '0'}" title="${t('点击展开 / 收起环境设置')}">
        <span class="collapse-arrow" style="display:inline-block;font-size:10px;line-height:1;color:var(--txt-2)">${envExpanded ? '▾' : '▸'}</span>
        ${t('环境设置')}
      </h4>
      <div class="collapse-body" id="env-body" ${envExpanded ? '' : 'hidden'}>
        <div class="kv-row"><span class="k">${t('环境贴图')}</span>
          <select id="env-select" class="info-select" title="${t('选 HDRI 作为该模型的照明环境')}">
            ${envOptions}
          </select>
        </div>
        <div class="kv-row" style="align-items:center;gap:10px">
          <span class="k" style="white-space:nowrap">${t('曝光')}</span>
          <input type="range" id="env-exposure" min="0.1" max="3" step="0.05" value="${envExp}" style="flex:1">
          <span class="v" id="env-exposure-val" style="min-width:36px;text-align:right">${envExp.toFixed(2)}</span>
        </div>
        <div class="hint" style="font-size:11px;margin-top:6px;color:#8b93a3">${t('用 HDRI 环境贴图替代默认灯光做照明；拖动曝光调整明暗。')}</div>
      </div>
    </div>`;

  // 游戏中旋转设置：关闭手动旋转（仅影响导出成品，不影响编辑器内编辑）
  html += `
    <div class="panel-section">
      <h4 class="collapse-toggle" data-body="rotation-body" style="cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none;margin-bottom:${rotationExpanded ? '8px' : '0'}" title="${t('点击展开 / 收起游戏中旋转设置')}">
        <span class="collapse-arrow" style="display:inline-block;font-size:10px;line-height:1;color:var(--txt-2)">${rotationExpanded ? '▾' : '▸'}</span>
        ${t('游戏中旋转设置')}
      </h4>
      <div class="collapse-body" id="rotation-body" ${rotationExpanded ? '' : 'hidden'}>
        <label class="switch-row" style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;color:var(--txt-1);margin-top:6px">
          <input type="checkbox" id="ch-lock-rotation" ${n.lockRotation ? 'checked' : ''}>
          <span>${t('关闭手动旋转')}</span>
        </label>
        <div class="hint" style="font-size:11px;margin-top:6px;color:#8b93a3">${t('勾选后，导出的成品（独立查看器 / 剧情编辑器中的 3D 界面）将禁止手动旋转，固定在默认视角上。')}</div>
      </div>
    </div>`;

  dom.infoContent.innerHTML = html;

  // 折叠区块：点击标题展开 / 收起（基本信息 / 几何信息 / 点击交互配置 / 环境设置 / 游戏中旋转设置）
  const bindToggle = (bodyId, flagRef) => {
    const toggle = dom.infoContent.querySelector('.collapse-toggle[data-body="' + bodyId + '"]');
    const body = document.getElementById(bodyId);
    if (toggle && body) {
      toggle.addEventListener('click', () => {
        flagRef.v = !flagRef.v;
        body.hidden = !flagRef.v;
        const arrow = toggle.querySelector('.collapse-arrow');
        if (arrow) arrow.textContent = flagRef.v ? '▾' : '▸';
        toggle.style.marginBottom = flagRef.v ? '8px' : '0';
      });
    }
  };
  bindToggle('basic-info-body', { get v() { return basicInfoExpanded; }, set v(x) { basicInfoExpanded = x; } });
  bindToggle('geo-info-body', { get v() { return geoInfoExpanded; }, set v(x) { geoInfoExpanded = x; } });
  bindToggle('interact-body', { get v() { return interactExpanded; }, set v(x) { interactExpanded = x; } });
  bindToggle('env-body', { get v() { return envExpanded; }, set v(x) { envExpanded = x; } });
  bindToggle('rotation-body', { get v() { return rotationExpanded; }, set v(x) { rotationExpanded = x; } });

  // 基本信息「名称」就地编辑：回车 / 失焦生效
  const nameInput = $('info-name-input');
  if (nameInput) {
    const commitName = () => {
      const val = (nameInput.value || '').trim();
      if (!val) { nameInput.value = n.name; return; }
      if (val === n.name) return;
      if (val.includes('/') || val.includes('\\') || val.includes('\0')) {
        toast('名称不能包含 / \\ 或空字符', 'error');
        nameInput.value = n.name;
        return;
      }
      DB.renameNode(n.id, val);
      toast('已重命名');
      markSaved();
      renderAll();
    };
    nameInput.addEventListener('blur', commitName);
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); nameInput.blur(); }
      else if (e.key === 'Escape') { e.preventDefault(); nameInput.value = n.name; nameInput.blur(); }
    });
  }

  // 游戏中旋转设置：「关闭手动旋转」开关（写入节点，导出成品时生效）
  const lockCh = $('ch-lock-rotation');
  if (lockCh) {
    lockCh.addEventListener('change', () => {
      DB.setLockRotation(id, lockCh.checked);
      markSaved();
      toast(lockCh.checked ? '已开启「关闭手动旋转」：导出成品将固定在默认视角' : '已关闭「关闭手动旋转」');
    });
  }

  // 环境：HDRI 下拉切换（写入节点并即时应用）
  const envSel = $('env-select');
  if (envSel) {
    envSel.addEventListener('change', () => {
      DB.setEnvMap(id, envSel.value);
      markSaved();
      viewer.applyEnvironment(n);   // n 为当前节点引用，已就地更新 envMap
      toast(t('环境已更新'));
    });
  }
  // 环境：曝光滑块（实时调整亮度，写入节点）
  const expSlider = $('env-exposure');
  const expVal = $('env-exposure-val');
  if (expSlider) {
    const onExp = () => {
      const v = parseFloat(expSlider.value);
      if (expVal) expVal.textContent = v.toFixed(2);
      DB.setEnvExposure(id, v);
      viewer.setExposure(v);
      markSaved();
    };
    expSlider.addEventListener('input', onExp);
    expSlider.addEventListener('change', () => toast(t('曝光已更新')));
  }

  // 点击交互配置：列出部位，下拉绑定动画 + 音效
  const listEl = $('interact-list');
  if (listEl) {
    const meshes = viewer.getMeshList();
    const clips = viewer.getClipList();
    const presetClips = viewer.getPresetClips();
    const cur = DB.getInteractions(id) || {};
    // 归一化旧数据（字符串 clip 名 / 缺字段补默认）
    const norm = {};
    for (const k in cur) {
      const v = cur[k];
      if (typeof v === 'string') {
        norm[k] = { clip: v, sound: '', respond: true, pingpong: false, autoReturn: false, deleteAfter: false, exit: false, clipIn: 0, clipOut: null, once: true };
      } else {
        norm[k] = {
          clip: v.clip || '',
          sound: v.sound || '',
          respond: v.respond !== false,   // 默认勾选
          pingpong: !!v.pingpong,           // 默认不离散来回
          autoReturn: !!v.autoReturn,       // 默认不连续自动归位
          deleteAfter: !!v.deleteAfter,     // 默认动画后不删除
          exit: !!v.exit,                    // 默认不是结束物体
          clipIn: v.clipIn != null ? v.clipIn : 0,       // 动画起（秒）
          clipOut: v.clipOut != null ? v.clipOut : null,  // 动画止（秒，null=整段）
          once: v.once !== false            // 默认只响应一次点击（防解谜动画被反向播放）
        };
      }
    }
    if (meshes.length === 0) {
      listEl.innerHTML = '<div class="hint" style="font-size:11px;color:#8b93a3">' + t('该模型没有可识别的部位网格。') + '</div>';
    } else {
      listEl.innerHTML = meshes.map(m => {
        const e = norm[m.name] || { clip: '', sound: '', respond: true, pingpong: false, autoReturn: false, deleteAfter: false, exit: false, clipIn: 0, clipOut: null, once: true };
        const clipOpts = clips.map(c =>
          `<option value="${escapeHtml(c)}" ${e.clip === c ? 'selected' : ''}>${escapeHtml(c)}</option>`
        ).join('')
          + (presetClips.length ? `<optgroup label="${t('内置简易动画')}">${presetClips.map(p => `<option value="${escapeHtml(p.value)}" ${e.clip === p.value ? 'selected' : ''}>${escapeHtml(t(p.label))}</option>`).join('')}</optgroup>` : '');
        const soundOpts = sounds.map(s =>
          `<option value="${escapeHtml(s.id)}" ${e.sound === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`
        ).join('');
        const respondChk = e.respond !== false ? 'checked' : '';
        // 动画增效：下拉三态 无 / 动画来回播放(pingpong) / 动画自动返回(autoreturn)
        const loopVal = e.autoReturn ? 'autoreturn' : (e.pingpong ? 'pingpong' : 'none');
        const delChk = e.deleteAfter ? 'checked' : '';
        const exitChk = e.exit ? 'checked' : '';
        // 所属交互链下拉（与底部交互链面板共享同一份链数据）
        const curChain = chainIdOfMesh(m.name);
        const chainOpts = ['<option value="">' + t('— 不属于任何链（可任意触发）—') + '</option>']
          .concat(getModelChains().map(ch => `<option value="${escapeHtml(ch.id)}" ${ch.id === curChain ? 'selected' : ''}>${escapeHtml(ch.name)}</option>`))
          .join('');
        const multiChk = (e.once === false) ? 'checked' : '';
        return `
        <div class="interact-block collapsed${respondChk ? '' : ' respond-off'}" data-mesh="${escapeHtml(m.name)}">
          <div class="interact-trigger-head">
            <span class="interact-collapse-caret">▸</span>
            <span class="interact-trigger-label">${t('触发部位')}</span>
            <span class="interact-mesh" title="${escapeHtml(m.name)}">${escapeHtml(m.name)}</span>
          </div>
          <label class="interact-flag interact-master" title="${t('取消勾选后，点击该部位不会有任何反应（不放大、不播放动画、不播放音效）')}">
            <input type="checkbox" class="interact-respond" data-mesh="${escapeHtml(m.name)}" ${respondChk}><span>${t('点击该部位时触发以下效果')}</span>
          </label>
          <div class="interact-section">
            <div class="interact-section-title">${t('触发后播放')}</div>
            <div class="interact-row">
              <span class="interact-row-label">${t('动画')}</span>
              <select class="interact-clip" data-mesh="${escapeHtml(m.name)}">
                <option value="">${t('— 选择动画 —')}</option>${clipOpts}
              </select>
            </div>
            <div class="interact-row">
              <span class="interact-row-label">${t('音效')}</span>
              <select class="interact-sound" data-mesh="${escapeHtml(m.name)}">
                <option value="">${t('— 选择音效 —')}</option>${soundOpts}
              </select>
            </div>
            <div class="interact-row">
              <span class="interact-row-label">${t('增效')}</span>
              <select class="interact-loop" data-mesh="${escapeHtml(m.name)}" title="${t('动画增效：无 / 动画来回播放（点一下正向，再点一下倒放回开头）/ 动画自动返回（点一下自动完整来回一次，正向播完自动倒放回开头）')}">
                <option value="none" ${loopVal === 'none' ? 'selected' : ''}>${t('无')}</option>
                <option value="pingpong" ${loopVal === 'pingpong' ? 'selected' : ''}>${t('动画来回播放')}</option>
                <option value="autoreturn" ${loopVal === 'autoreturn' ? 'selected' : ''}>${t('动画自动返回')}</option>
              </select>
            </div>
          </div>
          <div class="interact-section kind-exit">
            <div class="interact-section-title">${t('触发后效果')}</div>
            <label class="interact-flag" title="${t('动画结束后删除该触发部位：动画（来回）播放完毕后，该部位从场景中消失，不可再点击')}">
              <input type="checkbox" class="interact-deleteafter" data-mesh="${escapeHtml(m.name)}" ${delChk}><span>${t('动画结束后删除该触发部位')}</span>
            </label>
            <label class="interact-flag" title="${t('在联动剧情工具里召唤该 3D 界面后，点击此部位即结束 3D 界面、继续剧情（可设置多个结束部位）')}">
              <input type="checkbox" class="interact-exit" data-mesh="${escapeHtml(m.name)}" ${exitChk}><span class="exit-label">${t('点击该触发部位结束 3D 界面、继续剧情')}</span>
            </label>
          </div>
          <div class="interact-section kind-chain">
            <div class="interact-section-title">${t('交互链与触发限制')}</div>
            <div class="interact-row">
              <span class="interact-row-label">${t('所属交互链')}</span>
              <select class="interact-chain" data-mesh="${escapeHtml(m.name)}">${chainOpts}</select>
            </div>
            <label class="interact-flag" title="${t('默认每个部位只响应一次点击（防止解谜动画被反向播放，如盒子打开后别关上）。勾选后允许重复点击。')}">
              <input type="checkbox" class="interact-multi" data-mesh="${escapeHtml(m.name)}" ${multiChk}><span>${t('允许多次点击')}</span>
            </label>
          </div>
        </div>`;
      }).join('');

      const saveInteraction = () => {
        const map = {};
        meshes.forEach(m => {
          const clipSel = listEl.querySelector('.interact-clip[data-mesh="' + CSS.escape(m.name) + '"]');
          const soundSel = listEl.querySelector('.interact-sound[data-mesh="' + CSS.escape(m.name) + '"]');
          const respondSel = listEl.querySelector('.interact-respond[data-mesh="' + CSS.escape(m.name) + '"]');
          const loopSel = listEl.querySelector('.interact-loop[data-mesh="' + CSS.escape(m.name) + '"]');
          const delSel = listEl.querySelector('.interact-deleteafter[data-mesh="' + CSS.escape(m.name) + '"]');
          const exitSel = listEl.querySelector('.interact-exit[data-mesh="' + CSS.escape(m.name) + '"]');
          const multiSel = listEl.querySelector('.interact-multi[data-mesh="' + CSS.escape(m.name) + '"]');
          const clip = clipSel ? clipSel.value : '';
          const sound = soundSel ? soundSel.value : '';
          const respond = respondSel ? respondSel.checked : true;
          const loop = loopSel ? loopSel.value : 'none';
          const pingpong = loop === 'pingpong';
          const autoReturn = loop === 'autoreturn';
          const deleteAfter = delSel ? delSel.checked : false;
          const exit = exitSel ? exitSel.checked : false;
          const once = multiSel ? !multiSel.checked : true;  // 勾选「允许多次点击」→ once=false
          // 起止区间：来自时间轴（写入 DB 后由 norm 反映），保证拖时间轴设的段落不被覆盖
          const cur = norm[m.name] || {};
          const clipIn = cur.clipIn || 0;
          const clipOut = (cur.clipOut != null) ? cur.clipOut : null;
          map[m.name] = { clip, sound, respond, pingpong, autoReturn, deleteAfter, exit, clipIn, clipOut, once };
        });
        DB.setInteractions(id, map);
        viewer.setInteractions(map);
        markSaved();
        toast('已保存点击交互配置');
      };
      listEl.querySelectorAll('.interact-clip, .interact-sound, .interact-loop, .interact-deleteafter, .interact-exit, .interact-multi').forEach(sel => {
        sel.addEventListener('change', saveInteraction);
      });
      // 所属交互链下拉：切换到某条链 / 选「不属于任何链」→ 更新链成员关系（不影响交互落库）
      listEl.querySelectorAll('.interact-chain').forEach(sel => {
        sel.addEventListener('change', () => assignMeshToChain(sel.dataset.mesh, sel.value || null));
      });
      // 主开关「点击该部位时触发以下效果」：关闭时把下方「触发后播放 / 触发后效果」分组变暗，提示这些效果当前不触发
      listEl.querySelectorAll('.interact-respond').forEach(sel => {
        sel.addEventListener('change', () => {
          const block = sel.closest('.interact-block');
          if (block) block.classList.toggle('respond-off', !sel.checked);
          saveInteraction();
        });
      });
      // 触发器头部点击：折叠 / 展开 该部位配置（默认折叠，降低信息密度）
      // 折叠 / 展开该部位配置（默认折叠，降低信息密度）；点击头部同时在 3D 视口里高亮该部位
      listEl.querySelectorAll('.interact-trigger-head').forEach(h => {
        h.addEventListener('click', () => {
          const block = h.closest('.interact-block');
          if (block) {
            block.classList.toggle('collapsed');
            const meshName = block.dataset.mesh;
            if (meshName && viewer && viewer.highlightMesh) viewer.highlightMesh(meshName);
          }
        });
      });
    }
    // 交互链面板（解谜顺序）：随交互面板一起渲染
    renderChains();
  }
}

// ============ 点击 3D 物体 → 右侧物体列表高亮 ============
// 在 3D 视图里点中某个部位时，自动切到「属性」标签并高亮对应物体行，方便定位属性
// ============ 文件夹信息面板 ============
async function renderFolderInfo() {
  const folderId = state.currentFolderId; // null = 根目录
  const isRoot = !folderId;
  const node = isRoot ? null : DB.getNode(folderId);
  if (!isRoot && !node) {
    dom.folderContent.innerHTML = `
      <div class="empty-grid" style="height:auto;padding:20px 0">
        <div class="icon">${ICONS.folder}</div>
        <div class="hint">${t('未选择文件夹')}</div>
      </div>`;
    return;
  }

  const name = isRoot ? '根目录' : node.name;
  const path = isRoot ? '' : DB.getPathNames(folderId).join(' / ');
  const createdAt = isRoot ? '' : new Date(node.createdAt).toLocaleString('zh-CN');
  const desc = isRoot ? DB.getRootDescription() : (node.description || '');
  const childCount = isRoot ? DB.getChildren(null).length : (node.children?.length || 0);

  let html = `
    <div class="panel-section">
      <h4>${t('基本信息')}</h4>
      <div class="kv-row"><span class="k">${t('名称')}</span><span class="v">${escapeHtml(name)}</span></div>
      <div class="kv-row"><span class="k">${t('类型')}</span><span class="v">${t('文件夹')}</span></div>
      ${path ? `<div class="kv-row"><span class="k">${t('路径')}</span><span class="v" style="font-size:11px">${escapeHtml(path)}</span></div>` : ''}
      ${createdAt ? `<div class="kv-row"><span class="k">${t('创建时间')}</span><span class="v" style="font-size:11px">${escapeHtml(createdAt)}</span></div>` : ''}
      <div class="kv-row"><span class="k">${t('子项数量')}</span><span class="v">${childCount}</span></div>
    </div>

    <div class="panel-section">
      <h4>${t('文件夹描述')}</h4>
      <div class="hint" style="font-size:11px;margin-bottom:6px;color:#8b93a3">${t('导出该目录时，描述会显示在目录顶部（可选，留空则不显示）。输入后焦点移开即自动保存。')}</div>
      <textarea id="folder-desc" class="folder-desc" placeholder="可选，留空则不显示">${escapeHtml(desc)}</textarea>
    </div>

    <div class="panel-section">
      <h4>${t('背景色')}</h4>
      <div class="hint" style="font-size:11px;margin-bottom:6px;color:#8b93a3">${t('设置该文件夹（及子级）的 3D 查看器背景色。改动即时生效并自动保存。')}</div>
      <div id="folder-bg-inline"></div>
    </div>`;

  dom.folderContent.innerHTML = html;

  // 描述：焦点移开即自动保存（仅内容变化时才写库，避免无谓提示）
  const ta = $('folder-desc');
  if (ta) {
    const originalDesc = desc;
    ta.addEventListener('blur', () => {
      const val = ta.value;
      if (val === originalDesc) return;
      if (isRoot) DB.setRootDescription(val);
      else DB.updateDescription(folderId, val);
      toast('描述已自动保存');
      markSaved();
    });
  }

  // 背景色：UI 直接内联进属性面板，不再弹窗，改动实时自动保存
  const ibg = $('folder-bg-inline');
  if (ibg) mountInlineBg(ibg, folderId);
}

// 在指定容器内渲染背景色内联控件（实时自动保存）
function mountInlineBg(container, nodeId) {
  const node = nodeId ? DB.getNode(nodeId) : null;
  const nodeName = nodeId ? (node?.name || '选中项') : '根目录';
  const currentSettings = DB.resolveBgSettings(nodeId);
  const isSolid = !currentSettings || currentSettings.type === 'solid';
  const c1 = currentSettings?.color1 || '#000000';
  const c2 = currentSettings?.color2 || '#1a1a2e';
  const dir = currentSettings?.direction || 'vertical';

  const presets = [
    { type: 'solid', color1: '#000000', name: '纯黑' },
    { type: 'solid', color1: '#0a0c12', name: '深蓝黑' },
    { type: 'solid', color1: '#1a1a2e', name: '深紫蓝' },
    { type: 'solid', color1: '#2c3e50', name: '深灰蓝' },
    { type: 'solid', color1: '#1b3a4b', name: '深青' },
    { type: 'solid', color1: '#ffffff', name: '纯白' },
    { type: 'gradient', color1: '#1a1a2e', color2: '#0a0c12', direction: 'vertical', name: '夜空' },
    { type: 'gradient', color1: '#2c3e50', color2: '#0d0d0d', direction: 'diagonal', name: '暮色' },
    { type: 'gradient', color1: '#0f2027', color2: '#203a43', direction: 'vertical', name: '深海' },
    { type: 'gradient', color1: '#41295a', color2: '#2F0743', direction: 'diagonal', name: '紫霞' },
    { type: 'gradient', color1: '#1a2a6c', color2: '#b21f1f', direction: 'diagonal', name: '落日' },
    { type: 'gradient', color1: '#093028', color2: '#237a57', direction: 'radial', name: '森林' },
  ];

  let presetHtml = '';
  presets.forEach((p) => {
    let bg;
    if (p.type === 'solid') bg = p.color1;
    else if (p.direction === 'radial') bg = 'radial-gradient(circle, ' + p.color1 + ', ' + p.color2 + ')';
    else if (p.direction === 'horizontal') bg = 'linear-gradient(to right, ' + p.color1 + ', ' + p.color2 + ')';
    else if (p.direction === 'diagonal') bg = 'linear-gradient(to bottom right, ' + p.color1 + ', ' + p.color2 + ')';
    else bg = 'linear-gradient(to bottom, ' + p.color1 + ', ' + p.color2 + ')';
    presetHtml += '<div class="bg-preset" style="background:' + bg + '" title="' + p.name + '" data-preset=\'' + JSON.stringify(p).replace(/'/g, "\\'") + '\'></div>';
  });

  const solidChecked = isSolid ? 'checked' : '';
  const gradChecked = isSolid ? '' : 'checked';
  const solidDisplay = isSolid ? '' : 'display:none; ';
  const gradDisplay = isSolid ? 'display:none; ' : '';

  container.innerHTML = '<div class="bg-modal-body">'
    + '<div class="bg-mode-toggle">'
    + '<label class="bg-mode-label"><input type="radio" name="ibg-mode" value="solid" ' + solidChecked + '> ' + t('纯色') + '</label>'
    + '<label class="bg-mode-label"><input type="radio" name="ibg-mode" value="gradient" ' + gradChecked + '> ' + t('渐变') + '</label>'
    + '</div>'
    + '<div class="bg-row" id="ibg-solid" style="' + solidDisplay + '"><label>' + t('颜色') + '</label><input type="color" id="ibg-c1" value="' + c1 + '"></div>'
    + '<div class="bg-row" id="ibg-gradient" style="' + gradDisplay + 'flex-direction:column;align-items:stretch;gap:6px">'
    + '<div><label>' + t('起始色') + '</label><input type="color" id="ibg-gc1" value="' + c1 + '"></div>'
    + '<div><label>' + t('结束色') + '</label><input type="color" id="ibg-gc2" value="' + c2 + '"></div>'
    + '<div><label>' + t('方向') + '</label><select id="ibg-gdir"><option value="vertical"' + (dir === 'vertical' ? ' selected' : '') + '>' + t('上下') + '</option><option value="horizontal"' + (dir === 'horizontal' ? ' selected' : '') + '>' + t('左右') + '</option><option value="diagonal"' + (dir === 'diagonal' ? ' selected' : '') + '>' + t('对角') + '</option><option value="radial"' + (dir === 'radial' ? ' selected' : '') + '>' + t('径向') + '</option></select></div>'
    + '</div>'
    + '<div class="bg-presets"><span class="bg-presets-label">' + t('预设') + '</span><div class="bg-preset-list">' + presetHtml + '</div></div>'
    + '<div style="display:flex;gap:8px;margin-top:4px">'
    + '<button class="btn" id="ibg-reset" style="flex:1">' + t('恢复继承颜色') + '</button>'
    + '</div>'
    + '</div>';

  const applyPreview = (s) => viewer.setBackground(s.type, s.color1, s.color2, s.direction);
  const collectSettings = () => {
    const mode = container.querySelector('input[name="ibg-mode"]:checked');
    if (!mode || mode.value === 'solid') {
      return { type: 'solid', color1: container.querySelector('#ibg-c1').value };
    }
    return {
      type: 'gradient',
      color1: container.querySelector('#ibg-gc1').value,
      color2: container.querySelector('#ibg-gc2').value,
      direction: container.querySelector('#ibg-gdir').value,
    };
  };
  const save = () => {
    const s = collectSettings();
    DB.setBgSettings(nodeId, s);
    applyNodeBg(nodeId);
    markSaved();
  };

  // 模式切换
  container.querySelectorAll('input[name="ibg-mode"]').forEach((r) => {
    r.addEventListener('change', function () {
      if (this.value === 'solid') { container.querySelector('#ibg-solid').style.display = ''; container.querySelector('#ibg-gradient').style.display = 'none'; }
      else { container.querySelector('#ibg-solid').style.display = 'none'; container.querySelector('#ibg-gradient').style.display = ''; }
      save();
    });
  });

  // 颜色：拖动时实时预览，松手（change）才落库，避免高频写 IndexedDB
  container.querySelectorAll('input[type="color"]').forEach((el) => {
    el.addEventListener('input', () => applyPreview(collectSettings()));
    el.addEventListener('change', () => save());
  });
  // 方向选择
  container.querySelectorAll('select').forEach((el) => {
    el.addEventListener('change', () => save());
  });

  // 预设：点击即应用并落库
  container.querySelectorAll('.bg-preset').forEach((el) => {
    el.addEventListener('click', () => {
      const p = JSON.parse(el.dataset.preset);
      applyPreview(p);
      const solidP = p.type === 'solid';
      container.querySelectorAll('input[name="ibg-mode"]').forEach((r) => { r.checked = r.value === (solidP ? 'solid' : 'gradient'); });
      container.querySelector('#ibg-solid').style.display = solidP ? '' : 'none';
      container.querySelector('#ibg-gradient').style.display = solidP ? 'none' : '';
      if (solidP) container.querySelector('#ibg-c1').value = p.color1;
      else {
        container.querySelector('#ibg-gc1').value = p.color1;
        container.querySelector('#ibg-gc2').value = p.color2;
        container.querySelector('#ibg-gdir').value = p.direction || 'vertical';
      }
      save();
    });
  });

  // 恢复继承颜色
  container.querySelector('#ibg-reset').addEventListener('click', () => {
    DB.setBgSettings(nodeId, null);
    applyNodeBg(nodeId);
    toast('已恢复为继承颜色');
  });
}

function highlightMeshInList(meshName) {
  if (!meshName) return;
  const listEl = $('interact-list');
  if (!listEl) {
    // 列表还没渲染（属性标签未打开等）→ 先切过去，下次点击即可命中
    if (state.activeTab !== 'props') switchTab('props');
    return;
  }
  if (state.activeTab !== 'props') switchTab('props');
  // 清除上一次高亮
  listEl.querySelectorAll('.interact-block.active').forEach(r => r.classList.remove('active'));
  const row = listEl.querySelector('.interact-block[data-mesh="' + CSS.escape(meshName) + '"]');
  if (row) {
    row.classList.add('active');
    row.scrollIntoView({ block: 'nearest' });
  }
}

// ============ 时间轴（嵌入 GLB 片段查看器，作用域 A） ============
// 时间轴与「当前正在编辑的 mesh 交互」绑定：拖动起止 = 写进该 mesh 交互的 clipIn/clipOut；
// 在 3D 界面里点击该部位即播放指定段落。时间轴本身只做预览（手动推进 action.time）。

// ============ 交互链（解谜顺序） ============
// 交互链 = 交互物品的前后顺序；同一条链上，只有「前一个部位被点击过」，后一个部位才允许触发。
// 未加入任何链的部位可任意触发。导出成品（独立查看器 / 画廊 / 剧情编辑器）也按此门禁执行。

// 读取当前模型的链
function getModelChains() {
  const id = state.selectedModelId;
  if (!id) return [];
  return DB.getChains(id) || [];
}

// 给定 mesh 当前所在链 id（不在任何链则返回 null）
function chainIdOfMesh(meshName) {
  const chains = getModelChains();
  for (const ch of chains) if (ch.order.indexOf(meshName) >= 0) return ch.id;
  return null;
}

// 把某 mesh 分配到某条链（chainId 为 null 表示移出所有链）
function assignMeshToChain(meshName, chainId) {
  const id = state.selectedModelId;
  if (!id) return;
  const chains = DB.getChains(id) || [];
  chains.forEach(ch => {
    const i = ch.order.indexOf(meshName);
    if (i >= 0) ch.order.splice(i, 1);
  });
  if (chainId) {
    const target = chains.find(ch => ch.id === chainId);
    if (target) target.order.push(meshName);
  }
  DB.setChains(id, chains);
  pushChainsToViewer();
  renderChains();
  refreshChainDropdowns();
}

// 重排某链内成员顺序（from -> to）
function reorderChainMember(chainId, fromIdx, toIdx) {
  const id = state.selectedModelId;
  if (!id) return;
  const chains = DB.getChains(id) || [];
  const ch = chains.find(c => c.id === chainId);
  if (!ch) return;
  if (fromIdx < 0 || fromIdx >= ch.order.length) return;
  const [m] = ch.order.splice(fromIdx, 1);
  if (toIdx < 0) toIdx = 0;
  if (toIdx > ch.order.length) toIdx = ch.order.length;
  ch.order.splice(toIdx, 0, m);
  DB.setChains(id, chains);
  pushChainsToViewer();
  renderChains();
}

// 删除整条链（其成员回到「无链」状态）
function deleteChain(chainId) {
  const id = state.selectedModelId;
  if (!id) return;
  let chains = DB.getChains(id) || [];
  chains = chains.filter(c => c.id !== chainId);
  DB.setChains(id, chains);
  pushChainsToViewer();
  renderChains();
  refreshChainDropdowns();
}

// 同步链到 3D 查看器（门禁用）
function pushChainsToViewer() {
  if (viewer && viewer.setChains) viewer.setChains(getModelChains());
}

// 新建一条交互链
function addChain() {
  const id = state.selectedModelId;
  if (!id) return;
  const chains = DB.getChains(id) || [];
  const n = chains.length + 1;
  chains.push({ id: 'chain-' + Date.now() + '-' + n, name: '交互链 ' + n, order: [] });
  DB.setChains(id, chains);
  pushChainsToViewer();
  renderChains();
}

// 计算拖放落点索引（行优先：y 在上半或同行 x 在左半则插在前）
function computeDropIndex(box, x, y) {
  const members = Array.from(box.querySelectorAll('.chain-member'));
  for (let i = 0; i < members.length; i++) {
    const r = members[i].getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (y < cy || (Math.abs(y - cy) <= r.height / 2 && x < cx)) return i;
  }
  return members.length;
}

// 渲染底部交互链面板
function renderChains() {
  const dock = $('chain-dock');
  if (!dock) return;
  const meshes = viewer.getMeshList();
  if (!meshes || meshes.length === 0) { dock.setAttribute('hidden', ''); return; }
  dock.removeAttribute('hidden');
  const chains = getModelChains();
  const body = $('chain-body');
  if (!body) return;
  if (chains.length === 0) {
    body.innerHTML = '<div class="chain-empty">' + t('还没有交互链。点击「+ 新建交互链」，再把右侧各部位的「所属交互链」下拉选到这条链，即可排成解谜顺序。') + '</div>';
    bindChainPanel();   // 空链状态也要绑定「+ 新建交互链」按钮，否则首次点击无反应
    return;
  }
  body.innerHTML = chains.map(ch => {
    const members = ch.order.map((name, idx) => `
      <div class="chain-member" draggable="true" data-chain="${escapeHtml(ch.id)}" data-idx="${idx}" data-mesh="${escapeHtml(name)}" title="${t('按住拖动调整顺序')}">
        <span class="m-order">${idx + 1}</span>
        <span class="m-name">${escapeHtml(name)}</span>
        <button class="m-remove" data-chain="${escapeHtml(ch.id)}" data-mesh="${escapeHtml(name)}" title="${t('移出该链')}">×</button>
      </div>`).join('');
    return `
      <div class="chain-card" data-chain="${escapeHtml(ch.id)}">
        <div class="chain-card-head">
          <input class="chain-name-input" data-chain="${escapeHtml(ch.id)}" value="${escapeHtml(ch.name)}" title="${t('点击重命名该交互链')}">
          <span class="chain-count">${t('{count} 个部位', { count: ch.order.length })}</span>
          <button class="chain-del" data-chain="${escapeHtml(ch.id)}">${t('删除该链')}</button>
        </div>
        <div class="chain-members" data-chain="${escapeHtml(ch.id)}">
          ${members || '<span class="chain-drop-hint">' + t('把右侧部位的下拉选到这条链即可加入') + '</span>'}
        </div>
      </div>`;
  }).join('');
  bindChainPanel();
}

// 绑定交互链面板交互（每次渲染后重绑）
function bindChainPanel() {
  const body = $('chain-body');
  if (!body) return;
  const addBtn = $('chain-add');
  if (addBtn && !addBtn._chainBound) {
    addBtn._chainBound = true;
    addBtn.addEventListener('click', addChain);
  }
  body.querySelectorAll('.chain-name-input').forEach(inp => {
    inp.addEventListener('change', () => {
      const id = state.selectedModelId; if (!id) return;
      const chains = DB.getChains(id) || [];
      const ch = chains.find(c => c.id === inp.dataset.chain);
      if (ch) { ch.name = (inp.value || '').trim() || ch.name; DB.setChains(id, chains); pushChainsToViewer(); renderChains(); }
    });
  });
  body.querySelectorAll('.chain-del').forEach(btn => {
    btn.addEventListener('click', () => deleteChain(btn.dataset.chain));
  });
  body.querySelectorAll('.chain-member .m-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      assignMeshToChain(btn.dataset.mesh, null);
    });
  });
  body.querySelectorAll('.chain-member').forEach(m => {
    m.addEventListener('click', () => {
      if (viewer && viewer.highlightMesh) viewer.highlightMesh(m.dataset.mesh);
    });
  });
  // 拖动排序 / 跨链移动
  let dragInfo = null;
  body.querySelectorAll('.chain-member').forEach(m => {
    m.addEventListener('dragstart', (e) => {
      dragInfo = { chain: m.dataset.chain, idx: parseInt(m.dataset.idx, 10), mesh: m.dataset.mesh };
      m.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    m.addEventListener('dragend', () => { m.classList.remove('dragging'); dragInfo = null; });
  });
  body.querySelectorAll('.chain-members').forEach(box => {
    box.addEventListener('dragover', (e) => { e.preventDefault(); box.classList.add('drag-over'); });
    box.addEventListener('dragleave', () => box.classList.remove('drag-over'));
    box.addEventListener('drop', (e) => {
      e.preventDefault();
      box.classList.remove('drag-over');
      if (!dragInfo) return;
      const id = state.selectedModelId; if (!id) return;
      const chains = DB.getChains(id) || [];
      const src = chains.find(c => c.id === dragInfo.chain);
      const dst = chains.find(c => c.id === box.dataset.chain);
      if (!src || !dst) return;
      const si = src.order.indexOf(dragInfo.mesh);
      if (si < 0) return;
      const [mm] = src.order.splice(si, 1);
      let to = computeDropIndex(box, e.clientX, e.clientY);
      if (src === dst && si < to) to -= 1;   // 同源删除后索引前移
      if (to < 0) to = 0;
      if (to > dst.order.length) to = dst.order.length;
      dst.order.splice(to, 0, mm);
      DB.setChains(id, chains);
      pushChainsToViewer();
      renderChains();
      refreshChainDropdowns();
    });
  });
}

// 刷新右侧交互块的「所属交互链」下拉，使其反映最新成员关系
function refreshChainDropdowns() {
  const id = state.selectedModelId; if (!id) return;
  const chains = DB.getChains(id) || [];
  document.querySelectorAll('.interact-chain').forEach(sel => {
    const mesh = sel.dataset.mesh;
    const cur = chainIdOfMesh(mesh);
    sel.innerHTML = ['<option value="">— 不属于任何链（可任意触发）—</option>']
      .concat(chains.map(ch => `<option value="${escapeHtml(ch.id)}" ${ch.id === cur ? 'selected' : ''}>${escapeHtml(ch.name)}</option>`))
      .join('');
  });
}

// ============ 音效库（独立标签页） ============
// 所有音效的导入与管理放在这里，不再占用一级页面 / 模型信息面板
async function renderSoundsLibrary() {
  if (!dom.soundsContent) return;
  const sounds = await DB.getSounds();
  const dataMap = await DB.getAllSoundData();   // { id: dataUrl }
  const approxSize = (url) => {
    if (!url) return 0;
    const comma = url.indexOf(',');
    const b64 = comma >= 0 ? url.slice(comma + 1) : url;
    return Math.round(b64.length * 3 / 4);
  };

  let html = `
    <div class="panel-section" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <h4 style="margin:0">${t('音效库')} (${sounds.length})</h4>
      <button class="btn" id="btn-import-sound-lib" style="padding:4px 10px;font-size:12px">${t('导入音效')}</button>
    </div>`;

  if (sounds.length === 0) {
    html += `<div class="hint" style="font-size:12px;color:var(--txt-2)">${t('暂无音效。点上方「导入音效」，或顶栏「导入音效」添加音频文件。')}</div>`;
  } else {
    html += `<div class="sound-list">` + sounds.map(s => `
      <div class="sound-item" data-sid="${escapeHtml(s.id)}">
        <button class="sound-play" data-url="${escapeHtml(dataMap[s.id] || '')}" title="${t('试听')}">${ICONS.play}</button>
        <span class="sound-name" title="${escapeHtml(s.name)}">${escapeHtml(s.name)}</span>
        <span class="sound-size">${formatSize(approxSize(dataMap[s.id]))}</span>
        <button class="sound-rename" data-sid="${escapeHtml(s.id)}" title="${t('重命名音效')}">${ICONS.pencil}</button>
        <button class="sound-del" data-sid="${escapeHtml(s.id)}" title="${t('删除音效')}">${ICONS.trash}</button>
      </div>`).join('') + `</div>`;
  }
  dom.soundsContent.innerHTML = html;

  $('btn-import-sound-lib')?.addEventListener('click', () => $('sound-input').click());

  dom.soundsContent.querySelectorAll('.sound-play').forEach(b => {
    b.addEventListener('click', () => {
      const url = b.dataset.url;
      if (!url) return;
      try {
        const a = new Audio(url);
        a.play().catch(() => {});
      } catch (e) { /* ignore */ }
    });
  });

  dom.soundsContent.querySelectorAll('.sound-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sid = btn.dataset.sid;
      await DB.deleteSound(sid);
      // 清理所有模型的绑定引用
      const tree = DB.loadTree();
      for (const nid in tree.nodes) {
        const node = tree.nodes[nid];
        if (node.type === 'model' && node.interactions) {
          let changed = false;
          for (const mk in node.interactions) {
            const v = node.interactions[mk];
            const snd = (typeof v === 'string') ? '' : (v.sound || '');
            if (snd === sid) {
              if (typeof v === 'string') delete node.interactions[mk];
              else {
                v.sound = '';
                // 清掉音效后，若既无动画也未勾选响应，则该条目无意义，删除
                if (!v.clip && v.respond === false) delete node.interactions[mk];
              }
              changed = true;
            }
          }
          if (changed) DB.setInteractions(nid, node.interactions);
        }
      }
      toast('已删除音效', 'success');
      await renderSoundsLibrary();
      if (state.selectedModelId) await renderModelInfo();
      viewer.setSounds(await DB.getAllSoundData());
    });
  });

  dom.soundsContent.querySelectorAll('.sound-rename').forEach(btn => {
    btn.addEventListener('click', async () => {
      const sid = btn.dataset.sid;
      const s = sounds.find(x => x.id === sid);
      if (!s) return;
      await handleRenameSound(sid, s.name);
    });
  });
}

// ============ 状态栏 ============
async function updateStatusBar() {
  const tree = DB.loadTree();
  const models = Object.values(tree.nodes).filter(n => n.type === 'model');
  const folders = Object.values(tree.nodes).filter(n => n.type === 'folder');
  const total = models.reduce((s, n) => s + (n.size || 0), 0);
  dom.statModels.textContent = t('模型') + ': ' + models.length;
  dom.statFolders.textContent = t('文件夹') + ': ' + folders.length;
  dom.statStorage.textContent = t('原始') + ': ' + formatSize(total);
  try {
    const { totalBytes } = await DB.blobStats();
    dom.statStorage.textContent += ` (Base64: ${formatSize(totalBytes)})`;
  } catch (e) { /* ignore */ }
  dom.statStatus.textContent = '● ' + t('就绪');
  dom.statStatus.className = 'item ok';
}

// 状态栏：自动保存时间 + 当前选中对象反馈
function markSaved() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  if (dom.statSaved) dom.statSaved.textContent = t('已保存于') + ' ' + hh + ':' + mm;
}
function updateSelectionStatus() {
  if (dom.statSelected) {
    let label = '—';
    if (state.selectedModelId) { const n = DB.getNode(state.selectedModelId); label = n ? n.name : '—'; }
    else if (state.selectedFolderId) { const n = DB.getNode(state.selectedFolderId); label = n ? n.name : t('根目录'); }
    dom.statSelected.textContent = t('选中') + ': ' + label;
  }
  if (dom.objectChip && !state.selectedModelId) dom.objectChip.classList.add('hidden');
}

// ============ 渲染整合 ============
// 根据当前选中内容，更新下拉菜单里「导出为查看器」项的文案，避免「选中模型却导出目录」的困惑
function updateExportButtonLabel() {
  const label = $('dd-html-label');
  const sub = $('dd-html-sub');
  if (!label) return;
  if (state.selectedModelId) {
    label.textContent = t('导出为查看器');
    if (sub) sub.textContent = t('选中的单个模型 → 独立 3D 查看器');
  } else {
    label.textContent = t('导出为查看器');
    if (sub) sub.textContent = t('当前目录 → 独立 HTML 查看器');
  }
}

function renderAll() {
  renderTree();
  renderCrumbs();
  renderProps();
  renderSoundsLibrary();
  updateStatusBar();
  updateSelectionStatus();
  updateExportButtonLabel();
}

// ============ 属性面板（模型信息 / 文件夹信息 互斥，共用同一栏） ============
// 选中模型 → 显示模型信息；否则 → 显示当前文件夹（含根目录）信息。二者永不同时出现。
async function renderProps() {
  const dock = $('chain-dock');
  if (dock && !state.selectedModelId) dock.setAttribute('hidden', '');
  if (state.selectedModelId) {
    dom.infoContent.classList.remove('hidden');
    dom.folderContent.classList.add('hidden');
    await renderModelInfo();
  } else if (state.selectedFolderId) {
    dom.infoContent.classList.add('hidden');
    dom.folderContent.classList.remove('hidden');
    await renderFolderInfo();
  } else {
    // 未选中任何对象：显示默认空状态，避免刚进项目就露出背景色设置
    dom.folderContent.classList.add('hidden');
    dom.infoContent.classList.remove('hidden');
    dom.infoContent.innerHTML = `
      <div class="empty-grid" style="height:auto;padding:20px 0">
        <div class="icon">${ICONS.cube}</div>
        <div class="hint">${t('选择一个模型查看详情')}</div>
      </div>`;
  }
}

function switchTab(name) {
  state.activeTab = name;
  document.querySelectorAll('.panel-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === name);
  });
  dom.tabProps.classList.toggle('hidden', name !== 'props');
  dom.tabSounds.classList.toggle('hidden', name !== 'sounds');
  if (name === 'sounds') renderSoundsLibrary();
  else renderProps();
}

// ============ 操作：CRUD ============
async function handleNewFolder(parentId = null) {
  const target = parentId !== null ? parentId : state.currentFolderId;
  const name = await showModal({
    title: '新建文件夹',
    label: '文件夹名称',
    placeholder: '例如：角色模型',
  });
  if (!name) return;
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) {
    toast('名称不能包含 / \\ 或空字符', 'error');
    return;
  }
  // 检查重名
  const siblings = DB.getChildren(target);
  if (siblings.some(n => n.name === name && n.type === 'folder')) {
    toast('已存在同名文件夹', 'error');
    return;
  }
  const id = DB.genId('f');
  DB.addNode({
    id, name, type: 'folder',
    parentId: target, children: [],
    createdAt: Date.now(),
  });
  if (target) state.expandedFolders.add(target);
  if (target === null || target === state.currentFolderId) {
    // 切到新文件夹（如果在根）
  }
  toast(`已创建文件夹：${name}`);
  renderAll();
}

async function handleRename(id) {
  const node = DB.getNode(id);
  if (!node) return;
  const newName = await showModal({
    title: '重命名',
    label: '新名称',
    value: node.name,
  });
  if (!newName || newName === node.name) return;
  if (newName.includes('/') || newName.includes('\\') || newName.includes('\0')) {
    toast('名称不能包含 / \\ 或空字符', 'error');
    return;
  }
  DB.renameNode(id, newName);
  toast('已重命名');
  renderAll();
}

// 重命名音效（localStorage 元数据 + IndexedDB 记录同步）
async function handleRenameSound(sid, currentName) {
  const newName = await showModal({
    title: '重命名音效',
    label: '新名称',
    value: currentName || '',
    placeholder: '例如：点击音效.mp3',
  });
  if (!newName) return;
  if (newName === currentName) return;
  if (newName.includes('/') || newName.includes('\\') || newName.includes('\0')) {
    toast('名称不能包含 / \\ 或空字符', 'error');
    return;
  }
  try {
    await DB.renameSound(sid, newName);
    toast('音效已重命名', 'success');
    // 刷新音效库；若正在查看某模型，下拉同步更新
    await renderSoundsLibrary();
    if (state.selectedModelId) await renderModelInfo();
  } catch (e) {
    console.error(e);
    toast('重命名失败：' + e.message, 'error');
  }
}

async function handleEditDescription(id) {
  // id can be null for root
  const currentDesc = id ? (DB.getNode(id)?.description || '') : DB.getRootDescription();
  const label = id ? '文件夹描述（导出目录时显示在该目录顶部）' : '根目录描述（导出目录时显示在根目录顶部）';
  const newDesc = await showModal({
    title: '编辑描述',
    label: label,
    value: currentDesc,
    placeholder: '可选，留空则不显示',
  });
  if (newDesc === null) return; // cancelled
  if (id) {
    DB.updateDescription(id, newDesc);
  } else {
    DB.setRootDescription(newDesc);
  }
  toast('描述已更新');
  renderAll();
}

async function handleDelete(id) {
  const node = DB.getNode(id);
  if (!node) return;
  const isFolder = node.type === 'folder';
  const childCount = isFolder ? (node.children?.length || 0) : 0;
  let extra = '';
  if (isFolder && childCount > 0) {
    extra = `<div style="margin-top:10px;padding:10px;background:rgba(255,85,102,0.1);border:1px solid var(--danger);border-radius:6px;font-size:12px;color:var(--danger)">
       ${t('此文件夹包含 {n} 个子项，将一并删除（无法撤销）', { n: childCount })}
    </div>`;
  }
  const confirmed = await showConfirm(
    '确认删除',
    `确定要删除 "${node.name}" 吗？`,
    extra
  );
  if (!confirmed) {
    toast('已取消', 'info', 1500);
    return;
  }
  // 收集要删的 blob id
  const ids = DB.collectDescendantIds(id);
  for (const aid of ids) {
    const n = DB.getNode(aid);
    if (n?.type === 'model' && n.blobId) {
      try { await DB.blobDelete(n.blobId); } catch (e) { /* ignore */ }
    }
  }
  DB.removeNode(id);
  if (state.selectedModelId === id || ids.includes(state.selectedModelId)) {
    state.selectedModelId = null;
    viewer.clear();
    dom.viewerEmpty.classList.remove('hidden');
  }
  if (state.currentFolderId === id || ids.includes(state.currentFolderId)) {
    state.currentFolderId = null;
  }
  if (state.selectedFolderId === id || ids.includes(state.selectedFolderId)) {
    state.selectedFolderId = null;
  }
  toast('已删除');
  renderAll();
}

async function handleDownload(id) {
  const node = DB.getNode(id);
  if (!node || node.type !== 'model') return;
  try {
    const blob = await DB.blobGet(node.blobId);
    if (!blob) {
      toast('数据丢失，无法下载', 'error');
      return;
    }
    downloadBlob(blob, node.name.endsWith('.glb') ? node.name : node.name + '.glb');
    toast('已开始下载');
  } catch (e) {
    toast('下载失败：' + e.message, 'error');
  }
}

// 导出为独立 HTML（双击即可查看的 3D 查看器）
async function handleExportHTML(id) {
  const node = DB.getNode(id);
  if (!node || node.type !== 'model') return;
  toast('正在生成 HTML...', 'info', 1500);
  try {
    var bgSettings = DB.resolveBgSettings(id);
    const { size, filename } = await exportModelAsStandaloneHTML(id, DB, bgSettings);
    const kb = (size / 1024).toFixed(1);
    toast(`已导出: ${filename} (${kb} KB)`, 'success', 4000);
  } catch (e) {
    console.error(e);
    toast('导出失败：' + e.message, 'error');
  }
}

// 导出（上下文感知）：
// - 若当前选中了单个模型 → 导出该模型为独立 3D 查看器（打开即看，无目录页）
// - 否则 → 导出当前目录（或根目录）为模型库 HTML（含所有模型的独立浏览页面）
async function handleExportFolderHTML() {
  // 优先导出一个被选中的模型：选中物体时 currentFolderId 也会被设为父目录，
  // 但用户明确选择的是单个物体，应按物体导出，而不是整个目录
  if (state.selectedModelId) {
    const node = DB.getNode(state.selectedModelId);
    if (node && node.type === 'model') {
      return handleExportHTML(state.selectedModelId);
    }
  }
  const folderId = state.currentFolderId;
  const folderName = folderId ? (DB.getNode(folderId)?.name || '目录') : '根目录';
  toast('正在生成模型库 HTML...', 'info', 2000);
  try {
    var bgSettings = DB.resolveBgSettings(folderId);
    const { size, filename, modelCount, mode } = await exportFolderAsGalleryHTML(folderId, DB, bgSettings);
    const sizeStr = size > 1024 * 1024
      ? (size / 1024 / 1024).toFixed(2) + ' MB'
      : (size / 1024).toFixed(1) + ' KB';
    if (mode === 'standalone') {
      toast(`已导出单模型查看器: ${filename} (${sizeStr}) — 打开即 3D 查看页，无目录`, 'success', 5000);
    } else {
      toast(`已导出: ${filename} (${modelCount} 个模型, ${sizeStr})`, 'success', 5000);
    }
  } catch (e) {
    toast('导出失败：' + e.message, 'error');
  }
}

// ============ 上传 ============
// 判断是否为音频文件（用于拖入时自动归入音效库）
function isAudioFile(file) {
  const lower = file.name.toLowerCase();
  if (file.type && file.type.startsWith('audio/')) return true;
  return ['.wav', '.mp3', '.ogg', '.m4a', '.flac', '.aac', '.webm', '.oga', '.opus', '.mid', '.midi']
    .some(ext => lower.endsWith(ext));
}

// 导入音频文件到音效库（拖拽 / 「导入音效」按钮共用）
async function importAudioFiles(files) {
  let imported = 0;
  for (const file of files) {
    try {
      const dataUrl = await base64FromFile(file);
      const id = 'snd_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
      await DB.addSound({ id, name: file.name, type: file.type || 'audio/wav', dataUrl });
      imported++;
    } catch (err) {
      console.error('音效导入失败', err);
      toast(`音效导入失败：${file.name}`, 'error');
    }
  }
  if (imported > 0) {
    toast(`已导入 ${imported} 个音效`, 'success');
    if (state.selectedModelId) await renderModelInfo();            // 刷新音效下拉
    if (state.activeTab === 'sounds') await renderSoundsLibrary(); // 刷新音效库列表
    viewer.setSounds(await DB.getAllSoundData());                  // 编辑器预览立即可用新音效
  }
  return imported;
}

async function handleUpload(files) {
  if (!files || files.length === 0) return;
  // 按类型分流：模型 / 音频 / 其它（不支持）
  const modelFiles = [], audioFiles = [], otherFiles = [];
  for (const file of files) {
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.glb') || lower.endsWith('.gltf')) modelFiles.push(file);
    else if (isAudioFile(file)) audioFiles.push(file);
    else otherFiles.push(file);
  }

  // 音频文件：自动归入音效库（而非被跳过）
  const soundsAdded = audioFiles.length > 0 ? await importAudioFiles(audioFiles) : 0;

  // 其它不支持的文件：给出跳过提示
  for (const file of otherFiles) toast(`跳过不支持的文件：${file.name}`, 'warning');

  // 模型入库（GLB / GLTF）
  let success = 0, fail = 0;
  for (const file of modelFiles) {
    dom.statStatus.textContent = `● 上传 ${file.name}`;
    dom.statStatus.className = 'item warn';
    try {
      // 直接以原生 Blob（File 是 Blob 子类）入库，跳过 base64 编解码与 ~33% 体积膨胀
      const blobId = DB.genId('b');
      await DB.blobPut(blobId, file);

      // 检查重名，自动加后缀
      let name = file.name;
      const siblings = DB.getChildren(state.currentFolderId);
      let suffix = 1;
      while (siblings.some(n => n.name === name)) {
        const dotIdx = file.name.lastIndexOf('.');
        const stem = dotIdx > 0 ? file.name.slice(0, dotIdx) : file.name;
        const ext = dotIdx > 0 ? file.name.slice(dotIdx) : '';
        name = `${stem}_${suffix}${ext}`;
        suffix++;
      }

      const id = DB.genId('m');
      DB.addNode({
        id, name, type: 'model',
        parentId: state.currentFolderId, children: [],
        size: file.size, blobId,
        envMap: window.HDRI_DEFAULT, envExposure: 1.0,
        createdAt: Date.now(),
      });
      success++;
      toast(`${file.name}`, 'info', 2000);
    } catch (e) {
      console.error(e);
      toast(`失败：${file.name} - ${e.message}`, 'error');
      fail++;
    }
  }
  // 汇总状态：模型数 / 音效数 / 跳过数
  const parts = [];
  if (success > 0) parts.push(`${success} 个模型`);
  if (soundsAdded > 0) parts.push(`${soundsAdded} 个音效`);
  if (otherFiles.length > 0) parts.push(`跳过 ${otherFiles.length} 个`);
  dom.statStatus.textContent = '● 完成' + (parts.length ? ` (${parts.join(' / ')})` : '');
  dom.statStatus.className = (fail > 0 || otherFiles.length > 0) ? 'item warn' : 'item ok';
  setTimeout(() => { dom.statStatus.textContent = '● 就绪'; dom.statStatus.className = 'item ok'; }, 3000);
  renderAll();
}

// ============ 导出/导入 ============
async function handleExport() {
  dom.statStatus.textContent = '● 导出中...';
  dom.statStatus.className = 'item warn';
  try {
    const data = await DB.exportProject();
    const filename = `glb-project-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.json`;
    downloadJson(data, filename);
    toast(`已导出 ${DB.countModels()} 个模型`);
  } catch (e) {
    toast('导出失败：' + e.message, 'error');
  } finally {
    dom.statStatus.textContent = '● ' + t('就绪');
    dom.statStatus.className = 'item ok';
  }
}

async function handleExportBundleZip() {
  dom.statStatus.textContent = '● 导出 3D物体包...';
  dom.statStatus.className = 'item warn';
  try {
    const r = await exportSceneBundleZip(DB);
    toast(`已导出 3D物体包：${r.count} 个模型（${(r.size / 1024).toFixed(1)} KB）`, 'success');
  } catch (e) {
    console.error(e);
    toast('导出失败：' + e.message, 'error');
  } finally {
    dom.statStatus.textContent = '● ' + t('就绪');
    dom.statStatus.className = 'item ok';
  }
}

// ============ 顶栏「导出」下拉菜单 ============
const EXPORT_ACTIONS = {
  'html': handleExportFolderHTML,
  'bundle-zip': handleExportBundleZip,
};
function positionExportMenu() {
  const btn = $('btn-export');
  const menu = $('export-menu');
  if (!btn || !menu) return;
  const rect = btn.getBoundingClientRect();
  menu.style.top = (rect.bottom + 8) + 'px';
  menu.style.left = 'auto';
  menu.style.right = (window.innerWidth - rect.right) + 'px';
}
function closeExportMenu() {
  const btn = $('btn-export');
  const menu = $('export-menu');
  if (!menu) return;
  menu.setAttribute('hidden', '');
  btn?.setAttribute('aria-expanded', 'false');
  btn?.classList.remove('open');
}
function bindExportMenu() {
  const btn = $('btn-export');
  const menu = $('export-menu');
  if (!btn || !menu) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = menu.hasAttribute('hidden');
    closeExportMenu();
    if (willOpen) {
      positionExportMenu();
      menu.removeAttribute('hidden');
      btn.setAttribute('aria-expanded', 'true');
      btn.classList.add('open');
    }
  });
  menu.querySelectorAll('.dd-item').forEach((item) => {
    item.addEventListener('click', async () => {
      const fn = EXPORT_ACTIONS[item.dataset.act];
      closeExportMenu();
      if (fn) { try { await fn(); } catch (err) { console.error(err); } }
    });
  });
  document.addEventListener('click', (e) => {
    if (!menu.contains(e.target) && !btn.contains(e.target)) closeExportMenu();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeExportMenu(); });
  window.addEventListener('resize', () => { if (!menu.hasAttribute('hidden')) positionExportMenu(); });
  window.addEventListener('scroll', () => { if (!menu.hasAttribute('hidden')) positionExportMenu(); }, true);
}

async function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    dom.statStatus.textContent = '● 导入中...';
    dom.statStatus.className = 'item warn';
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const result = await DB.importProject(data);
      toast(`导入 ${result.addedModels} 模型 / ${result.addedFolders} 文件夹${result.skipped ? ' (跳过 ' + result.skipped + ')' : ''}`);
      renderAll();
    } catch (err) {
      toast('导入失败：' + err.message, 'error');
    } finally {
      dom.statStatus.textContent = '● ' + t('就绪');
      dom.statStatus.className = 'item ok';
    }
  };
  input.click();
}

// ============ 项目页拖入项目文件 → 新建项目并打开 ============
// 与 handleImport（导入到当前项目）不同：这里先建一个同名新项目，再把数据导入进去，直接打开
async function importAsNewProject(file) {
  if (!file) return;
  const isJson = /\.json$/i.test(file.name) || file.type === 'application/json';
  if (!isJson) {
    toast('只支持导入项目文件（.json）', 'error');
    return;
  }
  dom.statStatus.textContent = '● 导入中...';
  dom.statStatus.className = 'item warn';
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data || !data.tree) throw new Error('不是有效的项目文件（缺少 tree）');
    const name = (data.projectName && String(data.projectName).trim())
      || file.name.replace(/\.json$/i, '').trim()
      || '导入的项目';
    const newId = DB.createProject(name);
    const result = await DB.importProject(data);
    toast(`已新建项目「${name}」：${result.addedModels} 模型 / ${result.addedFolders} 文件夹${result.skipped ? ' (跳过 ' + result.skipped + ')' : ''}`);
    await openProject(newId);
  } catch (err) {
    console.error(err);
    toast('导入失败：' + (err?.message || err), 'error');
  } finally {
    dom.statStatus.textContent = '● ' + t('就绪');
    dom.statStatus.className = 'item ok';
  }
}

// ============ 查看器加载 ============
let viewer = null;
async function loadModelIntoViewer(id) {
  const node = DB.getNode(id);
  if (!node || node.type !== 'model') return;
  dom.viewerEmpty.classList.add('hidden');
  dom.ovInfo.textContent = t('加载中') + ': ' + node.name;
  applyNodeBg(id);
  try {
    const blob = await DB.blobGet(node.blobId);
    if (!blob) {
      toast('模型数据丢失', 'error');
      dom.viewerEmpty.classList.remove('hidden');
      return;
    }
    const stats = await viewer.loadFromBlob(blob, node.defaultView || null);
    // 应用该模型的 HDRI 环境照明（异步加载，不阻塞模型显示）
    viewer.applyEnvironment(node);
    viewer.setInteractions(DB.getInteractions(id) || {});
    viewer.setChains(DB.getChains(id) || []);   // 把交互链推给 3D 预览，链门禁才能在编辑器内生效（方便预览解谜顺序）
    viewer.setSounds(await DB.getAllSoundData());
    const nodeName = node.name;
    dom.ovInfo.textContent = nodeName + ' · ' + t('拖拽旋转') + ' · ' + t('滚轮缩放') + ' · ' + t('右键/中键平移');
    if (dom.objectChip) {
      dom.objectChip.innerHTML = '<span class="dot"></span>' + escapeHtml(nodeName);
      dom.objectChip.classList.remove('hidden');
    }
    dom.ovStats.textContent = t('尺寸') + ': ' + stats.size.x.toFixed(2) + ' × ' + stats.size.y.toFixed(2) + ' × ' + stats.size.z.toFixed(2) + ' | ' + t('顶点') + ': ' + formatNumber(stats.vertices) + ' | ' + t('三角面') + ': ' + formatNumber(Math.round(stats.triangles));

    renderProps();
  } catch (e) {
    console.error(e);
    toast('加载失败：' + e.message, 'error');
    dom.viewerEmpty.classList.remove('hidden');
  }
}

// ============ 背景色（节点属性） ============
// 将 bgSettings 转为 CSS 背景值
function bgToCSS(settings) {
  if (!settings) return '#000000';
  if (settings.type === 'solid') return settings.color1;
  var dir = settings.direction || 'vertical';
  if (dir === 'horizontal') return 'linear-gradient(to right, ' + settings.color1 + ', ' + settings.color2 + ')';
  if (dir === 'diagonal') return 'linear-gradient(to bottom right, ' + settings.color1 + ', ' + settings.color2 + ')';
  if (dir === 'radial') return 'radial-gradient(circle, ' + settings.color1 + ', ' + settings.color2 + ')';
  return 'linear-gradient(to bottom, ' + settings.color1 + ', ' + settings.color2 + ')';
}

function applyNodeBg(nodeId) {
  var settings = DB.resolveBgSettings(nodeId);
  viewer.setBackground(settings.type, settings.color1, settings.color2, settings.direction);
}

async function showBgModal(nodeId) {
  var node = nodeId ? DB.getNode(nodeId) : null;
  var nodeName = nodeId ? (node?.name || '选中项') : '根目录';
  var currentSettings = DB.resolveBgSettings(nodeId);
  var isSolid = !currentSettings || currentSettings.type === 'solid';
  var c1 = currentSettings?.color1 || '#000000';
  var c2 = currentSettings?.color2 || '#1a1a2e';
  var dir = currentSettings?.direction || 'vertical';

  var presets = [
    { type: 'solid', color1: '#000000', name: '纯黑' },
    { type: 'solid', color1: '#0a0c12', name: '深蓝黑' },
    { type: 'solid', color1: '#1a1a2e', name: '深紫蓝' },
    { type: 'solid', color1: '#2c3e50', name: '深灰蓝' },
    { type: 'solid', color1: '#1b3a4b', name: '深青' },
    { type: 'solid', color1: '#ffffff', name: '纯白' },
    { type: 'gradient', color1: '#1a1a2e', color2: '#0a0c12', direction: 'vertical', name: '夜空' },
    { type: 'gradient', color1: '#2c3e50', color2: '#0d0d0d', direction: 'diagonal', name: '暮色' },
    { type: 'gradient', color1: '#0f2027', color2: '#203a43', direction: 'vertical', name: '深海' },
    { type: 'gradient', color1: '#41295a', color2: '#2F0743', direction: 'diagonal', name: '紫霞' },
    { type: 'gradient', color1: '#1a2a6c', color2: '#b21f1f', direction: 'diagonal', name: '落日' },
    { type: 'gradient', color1: '#093028', color2: '#237a57', direction: 'radial', name: '森林' },
  ];

  var presetHtml = '';
  presets.forEach(function(p) {
    var bg;
    if (p.type === 'solid') { bg = p.color1; }
    else if (p.direction === 'radial') { bg = 'radial-gradient(circle, ' + p.color1 + ', ' + p.color2 + ')'; }
    else if (p.direction === 'horizontal') { bg = 'linear-gradient(to right, ' + p.color1 + ', ' + p.color2 + ')'; }
    else if (p.direction === 'diagonal') { bg = 'linear-gradient(to bottom right, ' + p.color1 + ', ' + p.color2 + ')'; }
    else { bg = 'linear-gradient(to bottom, ' + p.color1 + ', ' + p.color2 + ')'; }
    presetHtml += '<div class="bg-preset" style="background:' + bg + '" title="' + p.name + '" data-preset=\'' + JSON.stringify(p).replace(/'/g, "\\'") + '\'></div>';
  });

  var solidChecked = isSolid ? 'checked' : '';
  var gradChecked = isSolid ? '' : 'checked';
  var solidDisplay = isSolid ? '' : 'display:none; ';
  var gradDisplay = isSolid ? 'display:none; ' : '';

  var html = '<div class="bg-modal-body">'
    + '<div class="bg-modal-hint">' + t('为 {name} 设置背景色', { name: '<b>' + escapeHtml(nodeName) + '</b>' }) + '</div>'
    + '<div class="bg-mode-toggle">'
    + '<label class="bg-mode-label"><input type="radio" name="bg-mode" value="solid" ' + solidChecked + '> ' + t('纯色') + '</label>'
    + '<label class="bg-mode-label"><input type="radio" name="bg-mode" value="gradient" ' + gradChecked + '> ' + t('渐变') + '</label>'
    + '</div>'
    + '<div class="bg-row" id="bgm-solid" style="' + solidDisplay + '"><label>' + t('颜色') + '</label><input type="color" id="bgm-c1" value="' + c1 + '"></div>'
    + '<div class="bg-row" id="bgm-gradient" style="' + gradDisplay + 'flex-direction:column;align-items:stretch;gap:6px">'
    + '<div><label>' + t('起始色') + '</label><input type="color" id="bgm-gc1" value="' + c1 + '"></div>'
    + '<div><label>' + t('结束色') + '</label><input type="color" id="bgm-gc2" value="' + c2 + '"></div>'
    + '<div><label>' + t('方向') + '</label><select id="bgm-gdir"><option value="vertical"' + (dir === 'vertical' ? ' selected' : '') + '>' + t('上下') + '</option><option value="horizontal"' + (dir === 'horizontal' ? ' selected' : '') + '>' + t('左右') + '</option><option value="diagonal"' + (dir === 'diagonal' ? ' selected' : '') + '>' + t('对角') + '</option><option value="radial"' + (dir === 'radial' ? ' selected' : '') + '>' + t('径向') + '</option></select></div>'
    + '</div>'
    + '<div class="bg-presets"><span class="bg-presets-label">' + t('预设') + '</span><div class="bg-preset-list" id="bgm-presets">' + presetHtml + '</div></div>'
    + '<div style="display:flex;gap:8px;margin-top:10px">'
    + '<button class="btn" id="bgm-reset" style="flex:1">' + t('恢复继承颜色') + '</button>'
    + '</div>'
    + '</div>';

  dom.modal.classList.add('open');
  dom.modalTitle.textContent = t('背景色设置');
  dom.modalLabel.textContent = '';
  dom.modalInput.style.display = 'none';
  dom.modalExtra.innerHTML = html;
  $('modal-ok').textContent = t('保存');
  $('modal-cancel').textContent = t('取消');

  var applyPreview = function(settings) {
    viewer.setBackground(settings.type, settings.color1, settings.color2, settings.direction);
  };

  var collectSettings = function() {
    var mode = document.querySelector('input[name="bg-mode"]:checked');
    if (!mode || mode.value === 'solid') {
      return { type: 'solid', color1: $('bgm-c1').value };
    }
    return {
      type: 'gradient',
      color1: $('bgm-gc1').value,
      color2: $('bgm-gc2').value,
      direction: $('bgm-gdir').value,
    };
  };

  // Mode toggle
  dom.modalExtra.querySelectorAll('input[name="bg-mode"]').forEach(function(r) {
    r.addEventListener('change', function() {
      if (this.value === 'solid') {
        $('bgm-solid').style.display = '';
        $('bgm-gradient').style.display = 'none';
      } else {
        $('bgm-solid').style.display = 'none';
        $('bgm-gradient').style.display = '';
      }
      applyPreview(collectSettings());
    });
  });

  // Color inputs
  var colorInputs = dom.modalExtra.querySelectorAll('input[type="color"], select');
  colorInputs.forEach(function(el) {
    el.addEventListener('input', function() { applyPreview(collectSettings()); });
  });

  // Presets
  dom.modalExtra.querySelectorAll('.bg-preset').forEach(function(el) {
    el.addEventListener('click', function() {
      var p = JSON.parse(el.dataset.preset);
      applyPreview(p);
      // Sync UI
      var isSolid = p.type === 'solid';
      document.querySelectorAll('input[name="bg-mode"]').forEach(function(r) {
        r.checked = r.value === (isSolid ? 'solid' : 'gradient');
      });
      $('bgm-solid').style.display = isSolid ? '' : 'none';
      $('bgm-gradient').style.display = isSolid ? 'none' : '';
      if (isSolid) { $('bgm-c1').value = p.color1; }
      else {
        $('bgm-gc1').value = p.color1;
        $('bgm-gc2').value = p.color2;
        $('bgm-gdir').value = p.direction || 'vertical';
      }
    });
  });

  // Reset button
  $('bgm-reset').addEventListener('click', function() {
    DB.setBgSettings(nodeId, null);
    applyNodeBg(nodeId || state.currentFolderId || state.selectedModelId);
    dom.modal.classList.remove('open');
    toast('已恢复为继承颜色');
    renderAll();
  });

  // Save
  var saved = false;
  $('modal-ok').onclick = function() {
    saved = true;
    var s = collectSettings();
    DB.setBgSettings(nodeId, s);
    applyNodeBg(nodeId || state.currentFolderId || state.selectedModelId);
    dom.modal.classList.remove('open');
    dom.modalInput.style.display = '';
    dom.modalExtra.innerHTML = '';
    $('modal-ok').textContent = '确定';
    $('modal-cancel').textContent = '取消';
    toast('背景色已设置 → ' + (nodeName));
    renderAll();
  };

  $('modal-cancel').onclick = function() {
    dom.modal.classList.remove('open');
    dom.modalInput.style.display = '';
    dom.modalExtra.innerHTML = '';
    $('modal-ok').textContent = '确定';
    $('modal-cancel').textContent = '取消';
    // Revert preview
    if (!saved) applyNodeBg(nodeId || state.currentFolderId || state.selectedModelId);
  };
}

// ============ 拖拽上传 ============
function bindDragDrop() {
  const target = document.body;
  let dragCounter = 0;

  target.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (e.dataTransfer.types.includes('Files')) {
      document.body.style.outline = '2px dashed var(--accent)';
      document.body.style.outlineOffset = '-8px';
    }
  });
  target.addEventListener('dragover', (e) => {
    e.preventDefault();
  });
  target.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      document.body.style.outline = '';
    }
  });
  target.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    document.body.style.outline = '';
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) await handleUpload(files);
  });
}

// ============ 语言切换（🌏 按钮） ============
// 同步按钮文案（中文 / EN），并随 langchange 重渲染整树
function updateLangLabel() {
  const en = window.getLang() === 'en';
  if (dom.langLabel) dom.langLabel.textContent = en ? 'EN' : '中文';
}

// langchange 事件：翻译静态文本 + 重渲染所有动态内容
function onLangChange() {
  updateLangLabel();
  window.applyStatic(document);
  renderAll();
  renderChains();
  renderProjectsScreen();
}

// ============ 事件绑定 ============
let ctxTarget = null;  // 右键菜单当前选中的树节点 {id, type}

function bindEvents() {
  $('btn-new-folder').addEventListener('click', () => handleNewFolder());
  $('btn-upload').addEventListener('click', () => dom.fileInput.click());
  dom.fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    await handleUpload(files);
    e.target.value = '';
  });

  // 音效库：导入音频到项目库（入口在「音效库」标签页的「导入音效」按钮）
  $('sound-input').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    await importAudioFiles(files);
    e.target.value = '';
  });
  $('btn-import').addEventListener('click', handleImport);
  $('btn-save-project')?.addEventListener('click', () => {
    try { handleExport(); } catch (err) { console.error(err); }
  });
  bindExportMenu();
  bindFileMenu();

  // 资源树过滤输入框
  const treeSearch = $('tree-search');
  if (treeSearch) {
    treeSearch.addEventListener('input', (e) => { state.treeFilter = e.target.value; renderTree(); });
    treeSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { state.treeFilter = ''; treeSearch.value = ''; renderTree(); treeSearch.blur(); }
    });
  }

  // 资源树右键上下文菜单
  const ctxMenu = $('tree-ctx-menu');
  if (ctxMenu && dom.tree) {
    dom.tree.addEventListener('contextmenu', (e) => {
      const row = e.target.closest('.tree-row');
      if (!row) return;          // 仅在节点上右键才弹菜单，空白区交给浏览器默认
      e.preventDefault();
      const nodeEl = row.closest('.tree-node');
      ctxTarget = { id: nodeEl.dataset.id, type: nodeEl.dataset.type };
      showTreeCtxMenu(e.clientX, e.clientY);
    });
    ctxMenu.addEventListener('click', async (e) => {
      const item = e.target.closest('.ctx-item');
      if (!item) return;
      const act = item.dataset.act;
      const t = ctxTarget;
      hideTreeCtxMenu();
      if (!t) return;
      if (act === 'rename') await handleRename(t.id);
      else if (act === 'delete') await handleDelete(t.id);
      else if (act === 'duplicate') await duplicateNode(t.id);
      else if (act === 'export') {
        try {
          dom.statStatus.textContent = '● 导出中…'; dom.statStatus.className = 'item warn';
          await exportSingleModelJgl(t.id, DB);
          toast('已导出 .jgl', 'success');
        } catch (err) {
          console.error(err);
          toast('导出失败：' + (err.message || err), 'error');
        } finally {
          dom.statStatus.textContent = '● ' + t('就绪'); dom.statStatus.className = 'item ok';
        }
      }
    });
  }

  // 项目：返回项目列表 / 新建项目
  $('btn-projects')?.addEventListener('click', returnToProjects);
  $('btn-new-project')?.addEventListener('click', handleNewProject);

  // 语言切换（🌏）：点击在中文 / English 间切换
  if (dom.btnLang) dom.btnLang.addEventListener('click', () => window.toggleLang());

  // 项目页：拖入项目文件（.json）→ 新建项目并打开
  const pScreen = document.getElementById('projects-screen');
  const pOverlay = document.getElementById('projects-drop-overlay');
  if (pScreen) {
    let dragDepth = 0;
    const showOverlay = () => pOverlay?.removeAttribute('hidden');
    const hideOverlay = () => { dragDepth = 0; pOverlay?.setAttribute('hidden', ''); };
    pScreen.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; showOverlay(); });
    pScreen.addEventListener('dragover', (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
    pScreen.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) hideOverlay();
    });
    pScreen.addEventListener('drop', (e) => {
      e.preventDefault();
      hideOverlay();
      const file = e.dataTransfer?.files && e.dataTransfer.files[0];
      if (file) importAsNewProject(file);
    });
  }

  // 命令面板输入框绑定
  const cmdInput = $('cmd-input');
  const cmdPalette = $('cmd-palette');
  if (cmdInput && cmdPalette) {
    cmdInput.addEventListener('input', (e) => { cmdSel = 0; renderCmdResults(e.target.value); });
    cmdInput.addEventListener('keydown', (e) => {
      const list = $('cmd-results');
      const n = list && list._items ? list._items.length : 0;
      if (e.key === 'ArrowDown') { e.preventDefault(); cmdSel = Math.min(n - 1, cmdSel + 1); updateCmdSel(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); cmdSel = Math.max(0, cmdSel - 1); updateCmdSel(); }
      else if (e.key === 'Enter') { e.preventDefault(); runCmd(); }
      else if (e.key === 'Escape') { e.preventDefault(); closeCmdPalette(); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); closeCmdPalette(); }
    });
    cmdPalette.addEventListener('click', (e) => { if (e.target === cmdPalette) closeCmdPalette(); });
    const cmdClose = $('cmd-close');
    if (cmdClose) cmdClose.addEventListener('click', () => closeCmdPalette());
  }

  // 标签切换
  document.querySelectorAll('.panel-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // 键盘快捷键
  document.addEventListener('keydown', (e) => {
    // 避免在输入框中触发
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      handleNewFolder();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
      e.preventDefault();
      dom.fileInput.click();
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && (state.selectedModelId || state.selectedFolderId)) {
      e.preventDefault();
      handleDelete(state.selectedModelId || state.selectedFolderId);
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      const sel = state.selectedModelId || state.selectedFolderId;
      if (sel) duplicateNode(sel);   // 复制选中的节点（模型/文件夹）
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'e' || e.key === 'E')) {
      e.preventDefault();
      $('btn-export')?.click();      // 打开导出下拉
    } else if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
      e.preventDefault();
      dom.btnTogglePanel?.click();   // 切换属性面板（抽屉）
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      openCmdPalette();              // 命令面板
    } else if (e.key === 'Escape') {
      const p = $('cmd-palette');
      if (p && !p.hasAttribute('hidden')) {
        e.preventDefault();
        closeCmdPalette();
        return;
      }
      if (state.selectedModelId) {
        state.selectedModelId = null;
        viewer.clear();
        dom.viewerEmpty.classList.remove('hidden');
        renderAll();
      }
    }
  });

  bindDragDrop();
}

// ============ 资源树右键菜单：定位与关闭 ============
function showTreeCtxMenu(x, y) {
  const m = $('tree-ctx-menu');
  if (!m) return;
  m.removeAttribute('hidden');
  const r = m.getBoundingClientRect();
  let left = x, top = y;
  if (left + r.width > window.innerWidth) left = window.innerWidth - r.width - 8;
  if (top + r.height > window.innerHeight) top = window.innerHeight - r.height - 8;
  m.style.left = Math.max(8, left) + 'px';
  m.style.top = Math.max(8, top) + 'px';
  // 延迟一帧注册外部关闭监听，避免本次右键事件立即把它关掉
  setTimeout(() => {
    document.addEventListener('click', onDocClickCloseCtx, true);
    document.addEventListener('keydown', onEscCloseCtx);
    window.addEventListener('resize', hideTreeCtxMenu);
    dom.tree?.addEventListener('scroll', hideTreeCtxMenu, true);
  }, 0);
}
function onDocClickCloseCtx(e) {
  const m = $('tree-ctx-menu');
  if (m && !m.contains(e.target)) hideTreeCtxMenu();
}
function onEscCloseCtx(e) {
  if (e.key === 'Escape') hideTreeCtxMenu();
}
function hideTreeCtxMenu() {
  const m = $('tree-ctx-menu');
  if (m) m.setAttribute('hidden', '');
  document.removeEventListener('click', onDocClickCloseCtx, true);
  document.removeEventListener('keydown', onEscCloseCtx);
  window.removeEventListener('resize', hideTreeCtxMenu);
  dom.tree?.removeEventListener('scroll', hideTreeCtxMenu, true);
}

// ============ 复制模型节点（右键菜单「复制」） ============
async function duplicateNode(id) {
  const node = DB.getNode(id);
  if (!node) return;
  if (node.type !== 'model') { toast('目前仅支持复制模型节点', 'warning'); return; }
  const data = await DB.blobGet(node.blobId);
  if (!data) { toast('模型文件缺失，无法复制', 'error'); return; }
  const newId = DB.genId('m');
  const newBlobId = DB.genId('b');
  await DB.blobPut(newBlobId, data);

  // 重名处理
  let name = node.name + ' 副本';
  const siblings = DB.getChildren(node.parentId);
  let suffix = 1;
  while (siblings.some(n => n.name === name)) { name = `${node.name} 副本 ${suffix}`; suffix++; }

  DB.addNode({
    id: newId, name, type: 'model',
    parentId: node.parentId, children: [],
    size: node.size, blobId: newBlobId,
    createdAt: Date.now(),
    defaultView: node.defaultView || null,
    envMap: node.envMap || window.HDRI_DEFAULT,
    envExposure: (typeof node.envExposure === 'number') ? node.envExposure : 1.0,
  });
  // 复制交互配置
  const interactions = DB.getInteractions(id) || {};
  if (Object.keys(interactions).length) DB.setInteractions(newId, interactions);

  // 复制后展开父级，方便立即看到副本
  if (node.parentId) state.expandedFolders.add(node.parentId);
  toast('已复制：' + name, 'success');
  renderAll();
}

// ============ 命令面板 (Ctrl/Cmd+K) ============
const CMD_COMMANDS = [
  { label: t('新建文件夹'), hint: 'Ctrl+N', run: () => handleNewFolder() },
  { label: t('上传 GLB'), hint: 'Ctrl+U', run: () => dom.fileInput.click() },
  { label: t('导出为查看器'), hint: '', run: () => $('btn-export')?.click() },
  { label: t('导出 3D 物体包 (.jgl)'), hint: '', run: () => handleExportBundleZip() },
  { label: t('重置视角'), hint: '', run: () => viewer && viewer.resetCamera() },
  { label: t('切换自动旋转'), hint: '', run: () => $('btn-rotate')?.click() },
  { label: t('设为默认视角'), hint: '', run: () => $('btn-set-default-view')?.click() },
  { label: t('切换属性面板'), hint: 'Ctrl+\\', run: () => dom.btnTogglePanel?.click() },
  { label: t('返回项目列表'), hint: '', run: () => returnToProjects() },
  { label: t('新建项目'), hint: '', run: () => handleNewProject() },
];
let cmdSel = 0;
function openCmdPalette() {
  const p = $('cmd-palette'); if (!p) return;
  p.removeAttribute('hidden');
  const input = $('cmd-input');
  if (input) { input.value = ''; cmdSel = 0; renderCmdResults(''); setTimeout(() => input.focus(), 0); }
}
function closeCmdPalette() { const p = $('cmd-palette'); if (p) p.setAttribute('hidden', ''); }
function renderCmdResults(q) {
  const list = $('cmd-results'); if (!list) return;
  q = (q || '').trim().toLowerCase();
  const items = CMD_COMMANDS.filter(c => !q || c.label.toLowerCase().includes(q) || (c.hint || '').toLowerCase().includes(q));
  if (items.length === 0) { list.innerHTML = '<div class="cmd-empty">' + t('无匹配命令') + '</div>'; list._items = []; return; }
  if (cmdSel >= items.length) cmdSel = items.length - 1;
  if (cmdSel < 0) cmdSel = 0;
  list.innerHTML = items.map((c, i) =>
    `<div class="cmd-item${i === cmdSel ? ' active' : ''}" data-i="${i}"><span class="cmd-label">${escapeHtml(c.label)}</span>${c.hint ? `<span class="cmd-hint">${escapeHtml(c.hint)}</span>` : ''}</div>`
  ).join('');
  list._items = items;
  list.querySelectorAll('.cmd-item').forEach(el => {
    el.addEventListener('click', () => { cmdSel = +el.dataset.i; runCmd(); });
    el.addEventListener('mousemove', () => { if (cmdSel !== +el.dataset.i) { cmdSel = +el.dataset.i; updateCmdSel(); } });
  });
}
function updateCmdSel() {
  const list = $('cmd-results'); if (!list) return;
  list.querySelectorAll('.cmd-item').forEach((el, i) => el.classList.toggle('active', i === cmdSel));
}
function runCmd() {
  const list = $('cmd-results');
  const items = list && list._items;
  if (!items || !items[cmdSel]) return;
  closeCmdPalette();
  try { items[cmdSel].run(); } catch (e) { console.error(e); }
}

// ============ 顶栏「文件」下拉菜单 ============
function positionFileMenu() {
  const btn = $('btn-file'), menu = $('file-menu');
  if (!btn || !menu) return;
  const rect = btn.getBoundingClientRect();
  menu.style.top = (rect.bottom + 8) + 'px';
  menu.style.left = 'auto';
  menu.style.right = (window.innerWidth - rect.right) + 'px';
}
function closeFileMenu() {
  const btn = $('btn-file'), menu = $('file-menu');
  if (!menu) return;
  menu.setAttribute('hidden', '');
  btn?.setAttribute('aria-expanded', 'false');
  btn?.classList.remove('open');
}
function bindFileMenu() {
  const btn = $('btn-file'), menu = $('file-menu');
  if (!btn || !menu) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = menu.hasAttribute('hidden');
    closeFileMenu();
    if (willOpen) {
      positionFileMenu();
      menu.removeAttribute('hidden');
      btn.setAttribute('aria-expanded', 'true');
      btn.classList.add('open');
    }
  });
  menu.querySelectorAll('.dd-item').forEach((it) => it.addEventListener('click', () => closeFileMenu()));
  document.addEventListener('click', (e) => { if (!menu.contains(e.target) && !btn.contains(e.target)) closeFileMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFileMenu(); });
  window.addEventListener('resize', () => { if (!menu.hasAttribute('hidden')) positionFileMenu(); });
}

// ============ 主区分栏：可拖拽分隔条 + 窄屏抽屉 ============
(function initPanelResizer() {
  const main = dom.mainEl;
  const splitter = dom.panelSplitter;
  const MIN = 320, MAX = 760;
  function applyWidth(px) {
    px = Math.max(MIN, Math.min(MAX, Math.round(px)));
    document.documentElement.style.setProperty('--side-panel-w', px + 'px');
    try { localStorage.setItem('glb-panel-w', String(px)); } catch (e) {}
  }
  let saved = 480;
  try { saved = parseInt(localStorage.getItem('glb-panel-w') || '480', 10) || 480; } catch (e) {}
  applyWidth(saved);
  let dragging = false;
  if (splitter) {
    splitter.addEventListener('mousedown', (e) => {
      dragging = true;
      document.body.style.cursor = 'col-resize';
      main.classList.add('resizing');
      e.preventDefault();
    });
  }
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const r = main.getBoundingClientRect();
    applyWidth(r.right - e.clientX);
  });
  window.addEventListener('mouseup', () => {
    if (dragging) { dragging = false; document.body.style.cursor = ''; main.classList.remove('resizing'); }
  });
  function isNarrow() { return window.innerWidth <= 860; }
  function refresh() {
    const narrow = isNarrow();
    main.classList.toggle('is-narrow', narrow);
    if (narrow) {
      main.classList.remove('panel-hidden');
      if (dom.togglePanelLabel) dom.togglePanelLabel.textContent = t('打开属性');
    } else {
      main.classList.remove('panel-open');
      if (dom.togglePanelLabel) dom.togglePanelLabel.textContent = t('隐藏面板');
    }
  }
  window.addEventListener('resize', refresh);
  refresh();
  const toggle = dom.btnTogglePanel;
  if (toggle) {
    toggle.addEventListener('click', () => {
      if (isNarrow()) {
        const willOpen = !main.classList.contains('panel-open');
        main.classList.toggle('panel-open', willOpen);
        if (dom.togglePanelLabel) dom.togglePanelLabel.textContent = willOpen ? t('收起属性') : t('打开属性');
      } else {
        const willHide = !main.classList.contains('panel-hidden');
        main.classList.toggle('panel-hidden', willHide);
        if (dom.togglePanelLabel) dom.togglePanelLabel.textContent = willHide ? t('显示面板') : t('隐藏面板');
      }
    });
  }
})();

// ============ 启动 ============
// Three.js 由 module script 异步从 CDN 加载，需等其就绪后再进入应用

// 等待 Three.js 就绪的 Promise
let _threeReadyResolve = null;
const _threeReadyPromise = new Promise((res) => { _threeReadyResolve = res; });
if (window._threeReady) _threeReadyResolve();
else window._onThreeReady = () => { window._threeReady = true; _threeReadyResolve(); };

// 懒初始化查看器（仅创建一次），需等待 Three.js
async function ensureViewer() {
  if (viewer) return;
  await _threeReadyPromise;
  viewer = new GLBViewer(dom.viewerContainer);
  viewer.setOnInteract((meshName) => { highlightMeshInList(meshName); });
  // 3D 视图角落按钮（常驻，与「设为默认视角」同级）：
  // 重置视角 / 切换自动旋转 / 设为默认视角
  $('btn-reset-cam')?.addEventListener('click', () => viewer.resetCamera());
  $('btn-rotate')?.addEventListener('click', (e) => {
    const newState = !viewer.controls.autoRotate;
    viewer.setAutoRotate(newState);
    const label = e.currentTarget.querySelector('.label');
    if (label) label.textContent = newState ? t('停止旋转') : t('切换自动旋转');
    toast(newState ? '已开始自动旋转' : '已停止自动旋转');
  });
  $('btn-set-default-view')?.addEventListener('click', () => {
    if (!state.selectedModelId) { toast('请先选中一个模型', 'error'); return; }
    const view = viewer.captureDefaultView();
    DB.setDefaultView(state.selectedModelId, view);
    viewer.setDefaultView(view); // 同步到内存，使重置视角立即生效（无需刷新重载）
    toast('已保存该模型的默认视角，点「重置视角」或下次打开都会回到这里');
  });
}

// 打开某个项目，进入主界面
async function openProject(id) {
  await ensureViewer();
  DB.setCurrentProject(id);
  state.currentProjectId = id;
  // 诊断：输出当前项目树概况
  const tree = DB.loadTree();
  console.log('[openProject] 项目id=' + id + ' 节点数=' + Object.keys(tree.nodes).length
    + ' 根节点数=' + (tree.rootIds ? tree.rootIds.length : 0)
    + ' 节点列表:', Object.keys(tree.nodes));
  // 重置选择状态
  state.selectedModelId = null;
  state.selectedFolderId = null;
  state.currentFolderId = null;
  state.expandedFolders = new Set();
  if (viewer.clear) viewer.clear();
  dom.viewerEmpty.classList.remove('hidden');
  const app = document.querySelector('.app');
  const screen = document.getElementById('projects-screen');
  if (screen) screen.classList.add('hidden');
  if (app) app.classList.remove('hidden');
  applyNodeBg(null);  // root bg
  renderAll();
  updateProjectHeader(id);
}

// 返回项目列表页
function returnToProjects() {
  const app = document.querySelector('.app');
  if (app) app.classList.add('hidden');
  const screen = document.getElementById('projects-screen');
  if (screen) screen.classList.remove('hidden');
  renderProjectsScreen();
}

// 顶栏显示当前项目名
function updateProjectHeader(id) {
  const el = $('current-project-name');
  if (el) el.textContent = DB.getProjectName(id) || '';
}

// 渲染项目列表页
async function renderProjectsScreen() {
  const screen = document.getElementById('projects-screen');
  const list = document.getElementById('project-list');
  if (!screen || !list) return;
  const projects = DB.listProjects();
  if (projects.length === 0) {
    // 理论上迁移会创建默认项目；极端情况下兜底建一个并直接打开
    const id = DB.createProject('默认项目');
    return openProject(id);
  }
  list.innerHTML = projects.map(p => {
    const st = DB.getProjectStats(p.id);
    const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString() : '';
    return `<div class="project-card" data-pid="${escapeHtml(p.id)}">
      <div class="project-card-name">${escapeHtml(p.name)}</div>
      <div class="project-card-meta">${t('模型')} ${st.models} · ${t('文件夹')} ${st.folders}${date ? ' · ' + date : ''}</div>
      <div class="project-card-actions">
        <button class="btn primary btn-open" data-pid="${escapeHtml(p.id)}">${t('打开')}</button>
        <button class="btn btn-clone" data-pid="${escapeHtml(p.id)}">${t('复制')}</button>
        <button class="btn btn-rename" data-pid="${escapeHtml(p.id)}">${t('重命名')}</button>
        <button class="btn btn-del" data-pid="${escapeHtml(p.id)}">${t('删除')}</button>
      </div>
    </div>`;
  }).join('');
  // 事件委托处理卡片按钮
  list.onclick = async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const pid = btn.dataset.pid;
    if (btn.classList.contains('btn-open')) {
      await openProject(pid);
    } else if (btn.classList.contains('btn-rename')) {
      const cur = DB.getProjectName(pid);
      const name = await showModal({ title: '重命名项目', label: '项目名称', value: cur });
      if (name && name.trim() && name.trim() !== cur) {
        DB.renameProject(pid, name.trim());
        renderProjectsScreen();
      }
    } else if (btn.classList.contains('btn-clone')) {
      const cur = DB.getProjectName(pid);
      try {
        await DB.cloneProject(pid);
        toast('已复制项目：' + cur);
        renderProjectsScreen();
      } catch (err) {
        console.error('复制项目失败', err);
        toast('复制失败：' + (err?.message || err));
      }
    } else if (btn.classList.contains('btn-del')) {
      const cur = DB.getProjectName(pid);
      const ok = await showConfirm('删除项目', `确定删除项目「${cur}」？\n该项目的所有模型、音效与导出数据都会被永久删除，且不可恢复。`);
      if (ok) {
        DB.deleteProject(pid);
        toast('已删除项目：' + cur);
        renderProjectsScreen();
      }
    }
  };
}

// 新建项目
async function handleNewProject() {
  const name = await showModal({ title: '新建项目', label: '项目名称', value: '', placeholder: '例如：第一章剧情' });
  if (!name || !name.trim()) return;
  const id = DB.createProject(name.trim());
  await openProject(id);
}

// 启动流程：迁移旧数据 → 渲染项目列表（先选项目，再进编辑器）
DB.migrateLegacyIfNeeded()
  .then(() => {
    // 启动诊断：输出所有 localStorage glb-manager 键
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('glb-manager')) keys.push(k);
    }
    console.log('[启动诊断] localStorage glb-manager 键:', keys);
    for (const k of keys) {
      const v = localStorage.getItem(k);
      const preview = v ? v.substring(0, 100) : '(null)';
      console.log('  ', k, '=', preview, '...');
    }
    // 语言：按持久化设置同步初始文案，并注册切换监听
    updateLangLabel();
    window.applyStatic(document);
    window.addEventListener('langchange', onLangChange);
    if (dom.versionBadge) dom.versionBadge.textContent = 'v' + window.APP_VERSION;
    bindEvents();
    renderProjectsScreen();
  })
  .catch((err) => {
    console.error('启动失败', err);
    updateLangLabel();
    window.applyStatic(document);
    window.addEventListener('langchange', onLangChange);
    if (dom.versionBadge) dom.versionBadge.textContent = 'v' + window.APP_VERSION;
    bindEvents();
    renderProjectsScreen();
  });

// Three.js 加载超时保护
setTimeout(function() {
  if (!window._threeReady) {
    var el = document.getElementById('viewer-overlay');
    if (el) el.innerHTML = '<div class="overlay-card" style="color:#ff5d6c">' + t('Three.js 加载失败，请检查网络连接') + '</div>';
  }
}, 10000);
