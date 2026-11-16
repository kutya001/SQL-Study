// Проверка всех учебных баз из schemas/: загрузка, типы и связи в CSV, все эталоны, примеры и вопросы.
//   node tools/validate-packs.js          — все базы
//   node tools/validate-packs.js sewing   — одна база по id
//   HIDDEN=1 node tools/validate-packs.js — вместе с папками на «_» (шаблон)
const { loadAll, PF } = require('./lib');
const only = process.argv[2];
const t0 = Date.now();
const { packs, dbs, failed } = loadAll({ includeHidden: !!process.env.HIDDEN });
let bad = 0;
failed.forEach(f => { bad++; console.log('НЕ ЗАГРУЖЕНА', f); });
packs.forEach(p => {
  if (only && p.id !== only) return;
  if (p.id === 'bank' && !only) return; // встроенный курс проверяет validate-course.js
  const r = PF.validate(p, { dbs });
  const c = PF.counts(p);
  console.log('\n=== ' + p.id + ' (' + p.title + ', база ' + p.dbName + '): таблиц ' + c.tables + ', строк ' + p.rowCount +
    ', модулей ' + c.modules + ', уроков ' + c.lessons + ', практикум ' + c.setTasks + ', тренажёр ' + c.trainer + ', примеров ' + c.examples);
  r.errors.forEach(e => console.log('  ОШИБКА', e.where, '—', e.msg));
  r.warnings.forEach(e => console.log('  замечание', e.where, '—', e.msg));
  console.log('  проверено:', JSON.stringify(r.counts), '| ошибок', r.errors.length, '| замечаний', r.warnings.length);
  bad += r.errors.length;
});
console.log('\nвремя', Date.now() - t0, 'мс');
process.exit(bad ? 1 : 0);
