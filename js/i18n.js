// js/i18n.js — 轻量 i18n 引擎（中文为 key，英文为翻译）
// 用法：
//   t('中文')              -> 当前语言下对应的英文；未翻译时回退中文（不崩）
//   t('已移动到 {x}', {x}) -> 带变量插值
// 静态文本：在元素上加 data-i18n="中文" / data-i18n-ph="中文" / data-i18n-title="中文"
//          调用 applyStatic(root) 即可整树翻译
// 语言持久化：localStorage['glb-manager:lang'] = 'zh' | 'en'
// 切换语言：toggleLang() / setLang('en')，会派发 'langchange' 事件

(function () {
  'use strict';

  // ============ 英文字典（key = 中文原文） ============
  window.I18N = {
    en: {
      // 顶栏
      '项目': 'Projects',
      '文件': 'File',
      '打开本地工程': 'Open Local Project',
      '打开 / 导入项目文件（整个项目）': 'Open / import project file (whole project)',
      '保存工程到本地': 'Save Project Locally',
      '含模型·音效·交互': 'Includes models · sounds · interactions',
      '保存整个项目为本地项目文件（含模型·音效·交互）': 'Save the whole project as a local project file (includes models · sounds · interactions)',
      '分享发布': 'Share & Publish',
      '导出为查看器': 'Export as Viewer',
      '当前目录 → 独立 HTML 查看器': 'Current folder → standalone HTML viewer',
      '3D物体包(与剧情编辑器互通)': '3D Object Pack (interop with Story Editor)',
      '.jgl，GLB 裸文件外挂，体积更小': '.jgl — GLB binary external, smaller size',
      '导出': 'Export',
      '切换语言 / Switch language': 'Switch language',
      '返回项目列表，切换或管理项目': 'Back to project list, switch or manage projects',

      // 侧边栏
      '资源': 'Assets',
      '场景列表': 'Scene List',
      '过滤模型 / 文件夹…': 'Filter models / folders…',
      '新建文件夹': 'New Folder',
      '上传 GLB': 'Upload GLB',

      // 视口
      '3D 查看器就绪': '3D Viewer Ready',
      '从左侧选择 GLB 模型，或上传新文件': 'Select a GLB model from the left, or upload a new file',
      '显示 / 隐藏属性面板（窄屏为抽屉）': 'Show / hide properties panel (drawer on narrow screens)',
      '隐藏面板': 'Hide Panel',
      '打开属性': 'Open Panel',
      '收起属性': 'Collapse Panel',
      '显示面板': 'Show Panel',
      '重置视角': 'Reset View',
      '设为默认': 'Set as Default',
      '切换自动旋转': 'Toggle Auto-Rotate',
      '停止旋转': 'Stop Rotation',
      '重置视角：回到该模型设置好的默认视角；未设置则自动取景': 'Reset view: return to this model’s default view; auto-frame if unset',
      '将当前视角保存为该模型的默认视角': 'Save current view as this model’s default',
      '已开始自动旋转': 'Auto-rotate started',
      '已停止自动旋转': 'Auto-rotate stopped',

      // 面板标签
      '属性': 'Properties',
      '音效库': 'Sound Library',

      // 模型信息
      '选择一个模型查看详情': 'Select a model to view details',
      '基本信息': 'Basic Info',
      '几何信息': 'Geometry',
      '点击展开 / 收起基本信息': 'Click to expand / collapse basic info',
      '点击展开 / 收起几何信息': 'Click to expand / collapse geometry',
      '点击展开 / 收起点击交互配置': 'Click to expand / collapse Click Interaction',
      '点击展开 / 收起环境设置': 'Click to expand / collapse Environment Settings',
      '点击展开 / 收起游戏中旋转设置': 'Click to expand / collapse In-Game Rotation Settings',
      '名称': 'Name',
      '类型': 'Type',
      'GLB 模型': 'GLB Model',
      '大小': 'Size',
      '路径': 'Path',
      '创建时间': 'Created',
      '包围盒': 'Bounding Box',
      '最大尺寸': 'Max Dimension',
      '网格数': 'Meshes',
      '顶点数': 'Vertices',
      '三角形': 'Triangles',
      '材质数': 'Materials',
      '点击交互配置': 'Click Interaction',
      '视图设置': 'View Settings',
      '游戏中旋转设置': 'In-Game Rotation Settings',
      '关闭手动旋转': 'Disable Manual Rotation',
      '勾选后，导出的成品（独立查看器 / 剧情编辑器中的 3D 界面）将禁止手动旋转，固定在默认视角上。': 'When enabled, the exported viewer (standalone / 3D in Story Editor) locks manual rotation, fixing it to the default view.',
      '该模型没有可识别的物体网格。': 'This model has no recognizable object meshes.',

      // 交互配置
      '内置简易动画': 'Built-in Simple Animations',
      '物体': 'Object',
      '点击该物体时触发以下效果': 'Trigger the following effects when this object is clicked',
      '触发后播放': 'Play After Trigger',
      '动画': 'Animation',
      '音效': 'Sound',
      '增效': 'Enhancement',
      '无': 'None',
      '选择动画': 'Select Animation',
      '选择音效': 'Select Sound',
      '— 选择动画 —': '— Select Animation —',
      '— 选择音效 —': '— Select Sound —',
      '动画来回播放': 'Ping-pong Animation',
      '动画自动返回': 'Auto-Return Animation',
      '触发后效果': 'Effect After Trigger',
      '动画结束后删除该物体': 'Remove this object after animation ends',
      '点击该物体结束 3D 界面、继续剧情': 'Click this object to end the 3D scene and continue the story',
      '动画增效：无 / 动画来回播放（点一下正向，再点一下倒放回开头）/ 动画自动返回（点一下自动完整来回一次，正向播完自动倒放回开头）': 'Enhancement: None / Ping-pong (click forward, click again to reverse) / Auto-Return (click plays a full round trip)',
      '动画结束后删除该物体：动画（来回）播放完毕后，该物体从场景中消失，不可再点击': 'Remove this object after animation: once (ping-pong) playback finishes, the object vanishes from the scene and can no longer be clicked',
      '在联动剧情工具里召唤该 3D 界面后，点击此物体即结束 3D 界面、继续剧情（可设置多个结束物体）': 'Once this 3D scene is summoned by the linked Story tool, clicking this object ends the scene and continues the story (multiple end objects allowed)',
      '交互链与触发限制': 'Chain & Trigger Limits',
      '所属交互链': 'Belongs to Chain',
      '— 不属于任何链（可任意触发）—': '— Belongs to no chain (free trigger) —',
      '允许多次点击': 'Allow Multiple Clicks',
      '默认每个部位只响应一次点击（防止解谜动画被反向播放，如盒子打开后别关上）。勾选后允许重复点击。': 'By default each part responds once (prevents puzzle animation from reversing). Check to allow repeats.',
      '取消勾选后，点击该物体不会有任何反应（不放大、不播放动画、不播放音效）': 'Uncheck to make clicking this object do nothing (no zoom, animation, or sound)',

      // 文件夹信息
      '未选择文件夹': 'No folder selected',
      '根目录': 'Root',
      '文件夹': 'Folder',
      '子项数量': 'Child Count',
      '文件夹描述': 'Folder Description',
      '导出该目录时，描述会显示在目录顶部（可选，留空则不显示）。输入后焦点移开即自动保存。': 'When exporting this folder, the description shows at the top (optional). Auto-saves when focus leaves.',
      '可选，留空则不显示': 'Optional; leave blank to hide',
      '背景色': 'Background Color',
      '设置该文件夹（及子级）的 3D 查看器背景色。改动即时生效并自动保存。': 'Set the 3D viewer background for this folder (and children). Changes apply instantly and auto-save.',

      // 背景色控件（内联 + 弹窗）
      '纯色': 'Solid',
      '渐变': 'Gradient',
      '颜色': 'Color',
      '起始色': 'Start Color',
      '结束色': 'End Color',
      '方向': 'Direction',
      '上下': 'Vertical',
      '左右': 'Horizontal',
      '对角': 'Diagonal',
      '径向': 'Radial',
      '预设': 'Presets',
      '恢复继承颜色': 'Revert to Inherited Color',
      '背景色设置': 'Background Color Settings',
      '为 {name} 设置背景色': 'Set background color for {name}',

      // 音效库
      '导入音效': 'Import Sounds',
      '暂无音效。点上方「导入音效」，或顶栏「导入音效」添加音频文件。': 'No sounds yet. Click “Import Sounds” above, or use the top bar to add audio files.',
      '试听': 'Preview',
      '删除音效': 'Delete Sound',

      // 交互链停靠条
      '交互链（解谜顺序）': 'Interaction Chain (Puzzle Order)',
      '+ 新建交互链': '+ New Chain',
      '拖动部位块调整先后顺序；未加入任何链的部位可任意触发': 'Drag part blocks to reorder; parts in no chain can be triggered freely',
      '还没有交互链。点击「+ 新建交互链」，再把右侧各部位的「所属交互链」下拉选到这条链，即可排成解谜顺序。': 'No chains yet. Click “+ New Chain”, then set each part’s “Belongs to Chain” dropdown to this chain to arrange the puzzle order.',
      '把右侧部位的下拉选到这条链即可加入': 'Set a part’s dropdown to this chain to add it',
      '{count} 个部位': '{count} parts',
      '删除该链': 'Delete Chain',
      '按住拖动调整顺序': 'Drag to reorder',
      '移出该链': 'Remove from chain',
      '点击重命名该交互链': 'Click to rename this chain',

      // 状态栏
      '模型': 'Models',
      '文件夹': 'Folders',
      '存储': 'Storage',
      '选中': 'Selected',
      '就绪': 'Ready',
      '原始': 'Raw',
      '已保存于': 'Saved at',
      '读取中': 'Reading',
      '上传': 'Uploading',
      '完成': 'Done',
      '导出中': 'Exporting',
      '导出中…': 'Exporting…',

      // 面包屑
      '项目': 'Projects',

      // 命令面板
      '关闭命令面板': 'Close command palette',
      '输入命令，如：上传、导出、重置视角…': 'Type a command, e.g.: upload, export, reset view…',
      '↑↓ 选择': '↑↓ Select',
      '↵ 执行': '↵ Run',
      'Esc 关闭': 'Esc Close',
      '无匹配命令': 'No matching commands',
      '导出 3D 物体包 (.jgl)': 'Export 3D Object Pack (.jgl)',
      '切换属性面板': 'Toggle Properties Panel',
      '返回项目列表': 'Back to Projects',
      '新建项目': 'New Project',
      '打开': 'Open',
      '重命名': 'Rename',

      // 模态框
      '文件夹名称': 'Folder name',
      '项目名称': 'Project name',
      '重命名项目': 'Rename Project',
      '例如：角色模型': 'e.g. Character Model',
      '新名称': 'New name',
      '重命名音效': 'Rename Sound',
      '例如：点击音效.mp3': 'e.g. click-sound.mp3',
      '编辑描述': 'Edit Description',
      '名称不能包含 / \\ 或空字符': 'Name cannot contain / \\ or be empty',
      '已存在同名文件夹': 'A folder with this name already exists',
      '取消': 'Cancel',
      '确定': 'OK',
      '保存': 'Save',
      '确认删除': 'Confirm Delete',
      '确定要删除 "{name}" 吗？': 'Delete “{name}”?',
      '此文件夹包含 {n} 个子项，将一并删除（无法撤销）': 'This folder contains {n} items, which will be deleted too (cannot be undone)',

      // 项目页
      '3D交互制作器': '3D Interaction Maker',
      '选择一个项目开始，或新建一个项目。各项目完全独立，互不影响。': 'Choose a project to start, or create a new one. Projects are fully independent.',
      '将项目文件（.json）拖入此处，会新建项目并自动打开': 'Drop a project file (.json) here to create and open a new project',
      '松开以导入': 'Drop to import',
      '复制': 'Duplicate',
      '导出 .jgl': 'Export .jgl',
      '删除': 'Delete',

      // Toast / 提示
      '已重命名': 'Renamed',
      '已移动到 {x}': 'Moved to {x}',
      '不能移动到自己的子文件夹': 'Can’t move into its own subfolder',
      '已保存点击交互配置': 'Interaction config saved',
      '已恢复为继承颜色': 'Reverted to inherited color',
      '描述已自动保存': 'Description auto-saved',
      '描述已更新': 'Description updated',
      '已删除': 'Deleted',
      '已取消': 'Cancelled',
      '数据丢失，无法下载': 'Data lost, cannot download',
      '已开始下载': 'Download started',
      '正在生成 HTML...': 'Generating HTML…',
      '已导出: {f} ({kb} KB)': 'Exported: {f} ({kb} KB)',
      '导出失败：{e}': 'Export failed: {e}',
      '正在生成模型库 HTML...': 'Generating model library HTML…',
      '已导出单模型查看器: {f} ({s}) — 打开即 3D 查看页，无目录': 'Exported single-model viewer: {f} ({s}) — opens directly to 3D view, no folder',
      '已导出: {f} ({n} 个模型, {s})': 'Exported: {f} ({n} models, {s})',
      '音效导入失败：{f}': 'Sound import failed: {f}',
      '已导入 {n} 个音效': 'Imported {n} sounds',
      '跳过不支持的文件：{f}': 'Skipped unsupported file: {f}',
      '失败：{f} - {e}': 'Failed: {f} - {e}',
      '已导出 {n} 个模型': 'Exported {n} models',
      '已导出 3D物体包：{f} 个模型（{s} KB）': 'Exported 3D object pack: {f} models ({s} KB)',
      '导入 {a} 模型 / {b} 文件夹{c}': 'Imported {a} models / {b} folders{c}',
      '只支持导入项目文件（.json）': 'Only project files (.json) are supported',
      '已新建项目「{name}」：{a} 模型 / {b} 文件夹{c}': 'Created project “{name}”: {a} models / {b} folders{c}',
      '加载失败：{e}': 'Load failed: {e}',
      '模型数据丢失': 'Model data lost',
      '请先选中一个模型': 'Select a model first',
      '已保存该模型的默认视角，点「重置视角」或下次打开都会回到这里': 'Saved this model’s default view; “Reset View” or reopening returns here',
      '目前仅支持复制模型节点': 'Only model nodes can be duplicated yet',
      '模型文件缺失，无法复制': 'Model file missing, cannot duplicate',
      '已复制：{name}': 'Duplicated: {name}',
      '已移动到': 'Moved to',
      '已删除音效': 'Sound deleted',
      '音效已重命名': 'Sound renamed',
      '重命名失败：': 'Rename failed: ',
      '下载失败：': 'Download failed: ',
      '导出失败：': 'Export failed: ',
      '导入失败：': 'Import failed: ',
      '加载失败：': 'Load failed: ',
      '背景色已设置 → ': 'Background color set → ',
      '已导出 .jgl': 'Exported .jgl',
      '已复制：': 'Duplicated: ',
      '设为默认视角': 'Set as default view',
      '已复制项目：': 'Project duplicated: ',
      '复制失败：': 'Duplicate failed: ',
      '已删除项目：': 'Project deleted: ',
      '选中的单个模型 → 独立 3D 查看器': 'Selected single model → standalone 3D viewer',
      'Three.js 加载失败，请检查网络连接': 'Failed to load Three.js. Please check your network connection',

      // db.js 抛错 / 默认名
      '缺少项目 id': 'Missing project id',
      '未选择项目': 'No project selected',
      '数据格式错误': 'Invalid data format',
      '该模型数据丢失': 'Model data lost',
      '模型文件缺失': 'Model file missing',
      '不是模型节点': 'Not a model node',
      '该目录下没有模型': 'No models in this folder',
      '源项目不存在': 'Source project does not exist',
      '默认项目': 'Default Project',
      '未命名项目': 'Untitled Project',
      '节点不是模型': 'Node is not a model',

      // viewer.js（编辑器预览）提示
      '请先触发前一个部位（见底部交互链顺序）': 'Please trigger the previous part first (see bottom chain order)',

      // 导出运行时（独立查看器 / 模型库）
      '3D 查看器': '3D Viewer',
      '加载中': 'Loading',
      '已加载': 'Loaded',
      '拖拽旋转': 'Drag to rotate',
      '滚轮缩放': 'Scroll to zoom',
      '右键/中键平移': 'Right/Middle drag to pan',
      '尺寸': 'Size',
      '顶点': 'Vertices',
      '三角面': 'Triangles',
      '网格': 'Meshes',
      '材质': 'Materials',
      '加载模型失败': 'Failed to load model',
      '空目录': 'Empty folder',
      '（内置）向上跳一下': '(Built-in) Jump up',
      '（内置）原地摇晃': '(Built-in) Shake',
      '（内置）旋转一圈': '(Built-in) Spin',
      '（内置）点头': '(Built-in) Nod',

      // 环境（HDRI）面板
      '环境': 'Environment',
      '环境设置': 'Environment Settings',
      '全局信息': 'Global Info',
      '场视角（垂直）': 'Field of View (vertical)',
      '焦距（35mm 等效）': 'Focal Length (35mm eq.)',
      '调整焦距 / 场视角会改变预览镜头：广角更扁、长焦更压缩画面。': 'Adjusting focal length / FOV changes the preview lens: wide-angle flattens, telephoto compresses.',
      '点击展开 / 收起全局信息': 'Click to expand / collapse Global Info',
      '环境贴图': 'Environment Map',
      '曝光': 'Exposure',
      '用 HDRI 环境贴图替代默认灯光做照明；拖动曝光调整明暗。': 'Use an HDRI environment map instead of default lights for illumination; drag Exposure to adjust brightness.',
      '环境已更新': 'Environment updated',
      '曝光已更新': 'Exposure updated'
    }
  };

  // ============ 语言状态 ============
  var LS_KEY = 'glb-manager:lang';

  window.getLang = function () {
    var l = localStorage.getItem(LS_KEY);
    return (l === 'en' || l === 'zh') ? l : 'zh';
  };

  window.setLang = function (l) {
    if (l !== 'en' && l !== 'zh') l = 'zh';
    localStorage.setItem(LS_KEY, l);
    if (document.documentElement) document.documentElement.lang = (l === 'en') ? 'en' : 'zh-CN';
    window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: l } }));
  };

  window.toggleLang = function () {
    window.setLang(window.getLang() === 'en' ? 'zh' : 'en');
  };

  // ============ 翻译函数 ============
  // t(zh, vars?) -> 当前语言字符串；未翻译回退 zh；支持 {var} 插值
  window.t = function (zh, vars) {
    if (zh == null) return zh;
    var out = zh;
    if (window.getLang() === 'en') {
      var dict = (window.I18N && window.I18N.en) || {};
      if (Object.prototype.hasOwnProperty.call(dict, zh)) out = dict[zh];
    }
    if (vars && typeof vars === 'object') {
      out = String(out).replace(/\{(\w+)\}/g, function (m, k) {
        return (vars[k] != null) ? vars[k] : m;
      });
    }
    return out;
  };

  // ============ 静态文本翻译 ============
  // 扫描 [data-i18n] (textContent) / [data-i18n-ph] (placeholder) /
  //       [data-i18n-title] (title) / [data-i18n-aria] (aria-label)
  window.applyStatic = function (root) {
    root = root || document;
    var lists = [
      ['data-i18n', 'textContent'],
      ['data-i18n-ph', 'placeholder'],
      ['data-i18n-title', 'title'],
      ['data-i18n-aria', 'aria-label']
    ];
    lists.forEach(function (spec) {
      var attr = spec[0], prop = spec[1];
      var els = root.querySelectorAll('[' + attr + ']');
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        var key = el.getAttribute(attr);
        if (key == null) continue;
        el[prop] = window.t(key);
      }
    });
  };

  // ============ 全局 toast / showError 自动翻译 ============
  // 这样所有 toast('中文') 调用在英文模式下自动翻译，无需逐个包裹 t()
  function wrap(fnName) {
    if (window[fnName] && !window[fnName].__i18n) {
      var orig = window[fnName];
      var wrapped = function (msg) {
        var args = Array.prototype.slice.call(arguments);
        args[0] = window.t(msg);
        return orig.apply(this, args);
      };
      wrapped.__i18n = true;
      window[fnName] = wrapped;
    }
  }
  // utils.js 已定义 toast / showError，i18n.js 在它之后加载，可直接包裹
  wrap('toast');
  wrap('showError');

  // 初始：根据持久化语言设置 <html lang>
  if (document.documentElement) {
    document.documentElement.lang = (window.getLang() === 'en') ? 'en' : 'zh-CN';
  }
})();
