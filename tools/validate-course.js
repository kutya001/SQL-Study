// Проверка контента курса: все примеры и эталоны выполняются, id уникальны, ответы корректны
const fs = require('fs');
const root = require('path').resolve(__dirname, '..') + '/';
globalThis.window = globalThis;
['js/engine/tsql-core.js', 'js/engine/tsql-parser.js', 'js/engine/tsql-funcs.js', 'js/engine/tsql-exec.js', 'js/engine/bankdb.js', 'content/course.js'].forEach(f => require(root + f));
const COURSE = globalThis.COURSE;
const only = process.argv[2];
COURSE.moduleFiles.forEach(f => { const p = root + 'content/modules/' + f; if (fs.existsSync(p)) require(p); else console.log('нет файла', f); });
if (fs.existsSync(root + 'content/trainer.js')) require(root + 'content/trainer.js');
if (fs.existsSync(root + 'content/cheatsheet.js')) require(root + 'content/cheatsheet.js');
require(root + 'js/app/checker.js');
const T = globalThis.TSQL, Ch = globalThis.Checker;
const db = T.buildBankDb();
let errors = 0, warns = 0, count = { ex: 0, task: 0, quiz: 0 };
const ids = {};
function E(where, msg) { errors++; console.log('ОШИБКА', where, '—', msg); }
function W(where, msg) { warns++; console.log('внимание', where, '—', msg); }
function uid(id, where) { if (!id) return E(where, 'нет id'); if (ids[id]) E(where, 'повтор id ' + id + ' (уже в ' + ids[id] + ')'); ids[id] = where; }
function runOk(sql, where, expectError) {
  const r = T.execute(sql, db, {});
  if (expectError) { if (!r.error) W(where, 'ожидалась ошибка, но запрос выполнился'); return r; }
  if (r.error) E(where, 'SQL ошибка ' + r.error.number + ': ' + r.error.message + '\n' + sql);
  return r;
}
function checkTask(t, where) {
  count.task++;
  uid(t.id, where);
  if (!t.text) E(where, 'нет текста');
  if (!t.solution) return E(where, 'нет решения');
  const r = runOk(t.solution, where + ' [эталон]');
  if (r.error) return;
  const rs = Ch.lastSet(r);
  if (!rs) return E(where, 'эталон не возвращает таблицу');
  if (!rs.rows.length && !t.allowEmpty) W(where, 'эталон возвращает 0 строк');
  const c = Ch.compare(rs, rs, t.check || {});
  if (!c.ok) E(where, 'эталон не проходит сам себя: ' + c.msg);
  if (t.check && t.check.order) {
    const ord = Ch.compare(rs, rs, { order: t.check.order });
    if (!ord.ok) E(where, 'эталон не отсортирован по check.order');
  }
  // имена столбцов эталона должны быть заданы
  rs.columns.forEach((cname, i) => { if (cname === '(Отсутствует имя столбца)' && t.check && t.check.names) E(where, 'нет имени столбца ' + (i + 1)); });
  // проверка «неправильных» вариантов, если заданы
  (t.wrong || []).forEach((w, i) => {
    const res = Ch.check(t, w, db);
    if (res.ok) E(where, 'неверный вариант №' + (i + 1) + ' принимается проверкой: ' + w);
  });
  (t.alsoOk || []).forEach((w, i) => {
    const res = Ch.check(t, w, db);
    if (!res.ok) E(where, 'верный вариант №' + (i + 1) + ' НЕ принимается: ' + res.msg + '\n' + w);
  });
}
function checkQuiz(q, where) {
  count.quiz++;
  uid(q.id, where);
  if (!q.q) E(where, 'нет вопроса');
  if (q.t === 'order') { if (!q.items || q.items.length < 2) E(where, 'мало элементов'); return; }
  if (!q.options || q.options.length < 2) return E(where, 'мало вариантов');
  const ans = Array.isArray(q.answer) ? q.answer : [q.answer];
  ans.forEach(a => { if (typeof a !== 'number' || a < 0 || a >= q.options.length) E(where, 'ответ вне диапазона'); });
  if (!q.explain) W(where, 'нет пояснения');
}
const mods = COURSE.modules.slice().sort((a, b) => a.num - b.num);
mods.forEach(m => {
  if (only && m.id !== only) return;
  uid(m.id, 'module ' + m.num);
  m.lessons.forEach((l, li) => {
    const lw = m.id + ' урок ' + (li + 1);
    uid(l.id, lw);
    l.steps.forEach((s, si) => {
      const w = lw + ' шаг ' + (si + 1) + ' (' + s.t + ')';
      if (s.t === 'example') { count.ex++; runOk(s.sql, w, s.expectError); }
      else if (s.t === 'task') checkTask(s, w);
      else if (s.t === 'quiz' || s.t === 'order') checkQuiz(s, w);
      else if (s.t === 'widget') { if (!s.w) E(w, 'нет виджета'); }
      else if (s.t !== 'text') E(w, 'неизвестный тип шага');
    });
    if (!l.training || !l.training.length) W(lw, 'нет мини-тренировки');
    (l.training || []).forEach((s, si) => {
      const w = lw + ' тренировка ' + (si + 1);
      if (s.t === 'task') checkTask(s, w); else checkQuiz(s, w);
    });
  });
  (m.homework || []).forEach((t, i) => checkTask(t, m.id + ' ДЗ ' + (i + 1)));
  if (!m.homework || m.homework.length < 3) W(m.id, 'мало ДЗ');
});
if (!only) {
  (COURSE.trainer.tasks || []).forEach((t, i) => { checkTask(t, 'тренажёр ' + t.id); if (!(t.level >= 1 && t.level <= 5)) E('тренажёр ' + t.id, 'нет уровня'); });
  (globalThis.CHEAT || []).forEach((sec, i) => sec.items.forEach((it, j) => { if (!it.noRun) runOk(it.sql, 'шпаргалка ' + sec.title + ' #' + (j + 1)); }));
}
console.log('\nМодулей:', mods.length, '| примеров:', count.ex, '| задач:', count.task, '| вопросов:', count.quiz, '| тренажёр:', COURSE.trainer.tasks.length);
console.log('Ошибок:', errors, 'Предупреждений:', warns);
process.exit(errors ? 1 : 0);
