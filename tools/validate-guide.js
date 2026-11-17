// Проверка подсказок и экскурсий (content/guide.js): структура, метки элементов, значки, ссылки.
//   node tools/validate-guide.js
// Проверяет то, что видно без браузера. Что каждый шаг действительно находит свой элемент на странице,
// проверяет tools/ui-smoke.py.
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
globalThis.window = globalThis;
require(path.join(root, 'content/guide.js'));
const D = globalThis.GUIDE;
const errors = [], warns = [];
const err = (where, msg) => errors.push(where + ' — ' + msg);

// метки data-guide, расставленные в коде, и значки
const appDir = path.join(root, 'js/app');
const src = fs.readdirSync(appDir).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(appDir, f), 'utf8')).join('\n');
const marks = new Set();
for (const m of src.matchAll(/'data-guide':\s*'([\w-]+)'/g)) marks.add(m[1]);
for (const m of src.matchAll(/setAttribute\('data-guide',\s*'([\w-]+)'\)/g)) marks.add(m[1]);
const iconSrc = fs.readFileSync(path.join(appDir, 'icons.js'), 'utf8');
const hasIcon = name => new RegExp("(^|[\\s{,])'?" + name.replace(/[-]/g, '\\-') + "'?:\\s*'<").test(iconSrc);
const routes = [...src.matchAll(/A\.route\(\/(.+?)\/, function/g)].map(m => new RegExp(m[1]));
const routeOk = href => routes.some(re => re.test(href));

if (!D || !Array.isArray(D.tours) || !D.tours.length) err('GUIDE.tours', 'нет экскурсий');
const ids = new Set(), usedMarks = new Set();
(D.tours || []).forEach((t, ti) => {
  const w = 'экскурсия ' + (t.id || '#' + ti);
  if (!t.id || !/^[a-z][\w-]*$/.test(t.id)) err(w, 'id должен быть латиницей');
  if (ids.has(t.id)) err(w, 'id повторяется'); ids.add(t.id);
  if (!t.title) err(w, 'нет title');
  if (!t.short) warns.push(w + ' — нет short (строки для списка экскурсий)');
  if (t.icon && !hasIcon(t.icon)) err(w, 'нет значка «' + t.icon + '» в js/app/icons.js');
  if (t.page) { try { new RegExp(t.page); } catch (e) { err(w, 'page — неверное регулярное выражение: ' + e.message); } }
  if (t.href && !routeOk(t.href)) err(w, 'href «' + t.href + '» не открывает ни одну страницу');
  if (t.page && t.href && !new RegExp(t.page).test(t.href)) err(w, 'href не подходит под page: экскурсия откроет страницу, которую не считает своей');
  if (!Array.isArray(t.steps) || !t.steps.length) { err(w, 'нет шагов'); return; }
  if (!t.steps.some(s => s.at)) err(w, 'ни один шаг не привязан к элементу');
  t.steps.forEach((s, si) => {
    const ws = w + ', шаг ' + (si + 1);
    if (!s.title || !String(s.title).trim()) err(ws, 'нет title');
    if (!s.text || !String(s.text).trim()) err(ws, 'нет text');
    if (s.text && s.text.length > 330) warns.push(ws + ' — длинный текст (' + s.text.length + ' знаков): шаг читают за несколько секунд');
    if (s.only && s.only !== 'desktop' && s.only !== 'mobile') err(ws, "only — 'desktop' или 'mobile'");
    if (s.text && /<(?!\/?(b|kbd|code|i|br)\b)[a-z]/i.test(s.text)) err(ws, 'в text разрешены только <b>, <i>, <kbd>, <code>, <br>');
    if (s.at) {
      if (/^[.#\[]/.test(s.at)) { /* селектор CSS — проверяется в браузере */ }
      else if (!marks.has(s.at)) err(ws, 'метки data-guide="' + s.at + '" нет в js/app/*.js');
      else usedMarks.add(s.at);
    }
  });
  // у шага с only должна быть пара для другого вида экрана либо шаг должен быть необязательным по смыслу — это не ошибка, только подсказка
});
// страницы не должны «делить» экскурсии: один адрес — одна экскурсия
const withPage = (D.tours || []).filter(t => t.page);
['#/home', '#/m/x', '#/l/x/1', '#/t/x', '#/hw/x', '#/set/x', '#/trainer', '#/trainer/2/all', '#/sandbox', '#/sandbox/bank', '#/schema', '#/schema/bank', '#/packs', '#/profile', '#/cheat', '#/ach'].forEach(href => {
  const hit = withPage.filter(t => new RegExp(t.page).test(href));
  if (hit.length > 1) err('страница ' + href, 'подходит сразу нескольким экскурсиям: ' + hit.map(t => t.id).join(', '));
  if (!hit.length) warns.push('страница ' + href + ' — нет своей экскурсии');
});
// страница «О курсе»
const H = D.help || {};
if (!H.lead) err('GUIDE.help', 'нет lead');
(H.facts || []).forEach((f, i) => { if (!hasIcon(f[0])) err('help.facts[' + i + ']', 'нет значка «' + f[0] + '»'); if (!f[1] || !f[2]) err('help.facts[' + i + ']', 'нужны заголовок и текст'); });
(H.sections || []).forEach((s, i) => {
  if (!routeOk(s[0])) err('help.sections[' + i + ']', 'адрес «' + s[0] + '» не открывает ни одну страницу');
  if (!hasIcon(s[1])) err('help.sections[' + i + ']', 'нет значка «' + s[1] + '»');
  if (s[4] && !ids.has(s[4])) err('help.sections[' + i + ']', 'нет экскурсии «' + s[4] + '»');
});
(H.faq || []).forEach((q, i) => { if (!q[0] || !q[1]) err('help.faq[' + i + ']', 'нужны вопрос и ответ'); });
(H.keys || []).forEach((g, i) => { if (!g[0] || !Array.isArray(g[1]) || !g[1].length) err('help.keys[' + i + ']', 'нужны название группы и клавиши'); });
const unused = [...marks].filter(m => !usedMarks.has(m));

const steps = (D.tours || []).reduce((n, t) => n + (t.steps || []).length, 0);
console.log('Подсказки: экскурсий ' + (D.tours || []).length + ', шагов ' + steps + ', меток в коде ' + marks.size + ' (в экскурсиях используется ' + usedMarks.size + ')');
if (unused.length) console.log('  метки без шага (не ошибка): ' + unused.join(', '));
warns.forEach(w => console.log('  замечание:', w));
errors.forEach(e => console.log('  ОШИБКА:', e));
console.log('Ошибок: ' + errors.length + ' Предупреждений: ' + warns.length);
process.exit(errors.length ? 1 : 0);
