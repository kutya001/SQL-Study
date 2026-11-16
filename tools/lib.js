// Общий загрузчик для инструментов: движок T-SQL, курс и учебные базы — так же, как в браузере.
// Запуск из любой папки: пути считаются от корня репозитория.
globalThis.window = globalThis;
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const r = f => require(path.join(ROOT, f));
['js/engine/tsql-core.js', 'js/engine/tsql-parser.js', 'js/engine/tsql-funcs.js', 'js/engine/tsql-exec.js',
 'js/engine/bankdb.js', 'js/engine/packs.js', 'content/course.js'].forEach(r);
const C = globalThis.COURSE;
C.moduleFiles.forEach(f => r('content/modules/' + f));
r('content/trainer.js');
globalThis.Store = { readSchemas: async () => [], localPacks: async () => ({}) };
r('js/app/checker.js');
r('js/app/registry.js');
const PF = globalThis.PackFormat, R = globalThis.Packs, T = globalThis.TSQL;

// Все файлы папки базы: { 'schema.json': '...', 'data/Orders.csv': '...' }
function readTree(dir, prefix = '', out = {}) {
  for (const n of fs.readdirSync(dir).sort()) {
    if (n[0] === '.') continue;
    const p = path.join(dir, n);
    if (fs.statSync(p).isDirectory()) readTree(p, prefix + n + '/', out);
    else if (/\.(json|csv|txt|md)$/i.test(n)) out[prefix + n] = fs.readFileSync(p, 'utf8');
  }
  return out;
}
// Список баз в schemas/ в том виде, в каком их читает курс
function listSchemaDirs(opts = {}) {
  const sdir = path.join(ROOT, 'schemas'), list = [];
  for (const n of fs.readdirSync(sdir).sort()) {
    if ((n[0] === '_' && !opts.includeHidden) || n[0] === '.') continue;
    const p = path.join(sdir, n);
    if (fs.statSync(p).isDirectory()) list.push({ name: n, kind: 'dir', files: readTree(p) });
    else if (/\.json$/i.test(n)) list.push({ name: n.replace(/\.json$/i, ''), kind: 'file', files: { 'schema.json': fs.readFileSync(p, 'utf8') } });
  }
  return list;
}
// Загрузить одну базу из папки
function loadPack(dir) {
  dir = path.resolve(dir);
  return R.fromFiles(path.basename(dir), readTree(dir), 'folder');
}
// Встроенный банк + все базы из schemas/ (с собранными таблицами)
function loadAll(opts = {}) {
  const packs = [PF.builtinBank(C)], failed = [];
  const ids = { bank: 'встроенная', 'db:bank': 'встроенная' };
  for (const x of listSchemaDirs(opts)) {
    let p;
    try { p = R.fromFiles(x.name, x.files, x.kind === 'file' ? 'file' : 'folder'); }
    catch (e) { failed.push(x.name + ': ' + e.message); continue; }
    // как в курсе: базы с одинаковым id или именем базы (dbName) не подключаются дважды
    if (ids[p.id]) { failed.push(x.name + ': id «' + p.id + '» уже занят (' + ids[p.id] + ')'); continue; }
    if (ids['db:' + p.dbName.toLowerCase()]) { failed.push(x.name + ': имя базы «' + p.dbName + '» уже занято (' + ids['db:' + p.dbName.toLowerCase()] + ')'); continue; }
    ids[p.id] = ids['db:' + p.dbName.toLowerCase()] = 'schemas/' + x.name;
    packs.push(p);
  }
  const dbs = {};
  packs.forEach(p => { PF.getDb(p); dbs[p.dbName.toLowerCase()] = p.db; });
  return { packs, dbs, failed };
}
module.exports = { ROOT, C, PF, R, T, readTree, listSchemaDirs, loadPack, loadAll };
