// Проверить одну учебную базу (например, новую — до того, как положить её в schemas/).
//   node tools/check-pack.js путь/к/папке_базы
const path = require('path');
const { PF, loadPack, loadAll } = require('./lib');
const dir = process.argv[2];
if (!dir) { console.log('Укажите папку базы: node tools/check-pack.js schemas/sewing'); process.exit(2); }
const pack = loadPack(dir);
const { dbs } = loadAll();               // другие базы — для запросов к нескольким базам
PF.getDb(pack); dbs[pack.dbName.toLowerCase()] = pack.db;
const r = PF.validate(pack, { dbs });
console.log(pack.id, pack.dbName, JSON.stringify(PF.counts(pack)), 'строк:', pack.rowCount);
r.errors.forEach(e => console.log('ОШИБКА', e.where, '—', e.msg));
r.warnings.forEach(e => console.log('замечание', e.where, '—', e.msg));
console.log('проверено', JSON.stringify(r.counts), '| ошибок', r.errors.length, '| замечаний', r.warnings.length);
process.exit(r.errors.length ? 1 : 0);
