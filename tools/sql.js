// Выполнить запрос к учебной базе из командной строки — удобно при составлении заданий.
//   node tools/sql.js bank  "SELECT TOP 5 * FROM Clients"
//   node tools/sql.js sewing "SELECT COUNT(*) FROM Orders"
//   node tools/sql.js shop  -f запрос.sql
const fs = require('fs');
const { loadAll, T } = require('./lib');
const [id, a, b] = process.argv.slice(2);
if (!id || !a) { console.log('node tools/sql.js <id базы> "SELECT ..."  (или -f файл.sql)'); process.exit(2); }
const sql = a === '-f' ? fs.readFileSync(b, 'utf8') : a;
const { packs, dbs } = loadAll();
const p = packs.find(x => x.id === id || x.dbName.toLowerCase() === id.toLowerCase());
if (!p) { console.log('Нет базы', id, '— есть:', packs.map(x => x.id).join(', ')); process.exit(2); }
const opts = { dbs };
if (p.today) opts.now = p.today;   // «сегодня» базы (GETDATE) — как в курсе
const r = T.execute(sql, p.db, opts);
if (r.error) { console.log('Ошибка', r.error.number + ':', r.error.message); const h = T.explain && T.explain(r.error); if (h) console.log('Подсказка:', h); process.exit(1); }
r.results.forEach(rs => {
  console.log(rs.columns.join(' | '));
  rs.rows.slice(0, 50).forEach(x => console.log('  ' + x.map(v => v === null ? 'NULL' : v instanceof Date ? v.toISOString().replace('T', ' ').replace(/\.000Z$/, '') : v).join(' | ')));
  if (rs.rows.length > 50) console.log('  … ещё строк:', rs.rows.length - 50);
  console.log('строк: ' + rs.rows.length);
});
r.messages.forEach(m => console.log(m));
