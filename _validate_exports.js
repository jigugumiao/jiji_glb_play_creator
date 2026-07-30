const fs = require('fs');
const vm = require('vm');
const src = fs.readFileSync('js/exporter.js', 'utf8');

// 提取内嵌模板字符串（String.raw`...`；模板内不能出现未转义的反引号，
// 所以从首个反引号扫到下一个未转义反引号即为模板体）
function extract(name) {
  const i = src.indexOf(name);
  if (i < 0) throw new Error('not found: ' + name);
  const start = src.indexOf('`', i);
  if (start < 0) throw new Error('no backtick for ' + name);
  let j = start + 1;
  while (j < src.length) {
    const c = src[j];
    if (c === '\\') { j += 2; continue; } // 跳过转义
    if (c === '`') break;                  // 未转义反引号 = 模板结束
    j++;
  }
  let body = src.slice(start + 1, j);
  // 中和占位符，让 JS 语法可解析
  body = body.replace(/\$\{[^}]*\}/g, 'null');
  body = body.replace(/__[A-Z_]+__/g, '""');
  // 去掉 import/export 语句（运行时由打包器/浏览器处理，vm.Script 不支持）
  body = body.replace(/^\s*import\s.+?;?\s*$/gm, '');
  body = body.replace(/^\s*export\s+/gm, '');
  return body;
}

let failed = false;
['EXPORTER_VIEWER_SOURCE', 'GALLERY_VIEWER_SOURCE'].forEach(name => {
  try {
    const body = extract(name);
    new vm.Script(body, { filename: name });
    console.log('PASS syntax:', name);
  } catch (e) {
    console.error('FAIL syntax:', name, e.message);
    failed = true;
  }
});
console.log(failed ? 'VALIDATION FAILED' : 'VALIDATION OK');
process.exitCode = failed ? 1 : 0;
