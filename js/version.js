// js/version.js — 应用版本号
// 规则：26.0.0 起始，末位 +1，满 100 向中间位进位；中间位满 100 向首位进位。
window.APP_VERSION = '26.0.9';

window.incrementVersion = function () {
  var parts = window.APP_VERSION.split('.');
  while (parts.length < 3) parts.push('0');
  var major = parseInt(parts[0], 10) || 0;
  var minor = parseInt(parts[1], 10) || 0;
  var patch = parseInt(parts[2], 10) || 0;

  patch++;
  if (patch >= 100) {
    patch = 0;
    minor++;
  }
  if (minor >= 100) {
    minor = 0;
    major++;
  }

  window.APP_VERSION = major + '.' + minor + '.' + patch;
  return window.APP_VERSION;
};
