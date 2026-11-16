// Собрать schemas/index.js — все учебные базы одним скриптом.
// Курс читает этот файл, когда папка курса не подключена (и всегда — на сайте).
//   node tools/build-index.js          — пересобрать (файл меняется, только если базы изменились)
//   node tools/build-index.js --check  — только проверить, актуален ли файл (код 1, если нет)
const fs = require('fs'), path = require('path');
const { ROOT, PF, listSchemaDirs } = require('./lib');
const out = path.join(ROOT, 'schemas', 'index.js');
const list = listSchemaDirs();
const prev = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : '';
const prevSig = (prev.match(/"sig":"([^"]+)"/) || [])[1];
const prevBuilt = (prev.match(/"built":"([^"]+)"/) || [])[1];
const b = PF.makeBundle(list, prevBuilt);   // сначала с прежней датой, чтобы сравнить подпись
if (prevSig === b.sig) { console.log('schemas/index.js актуален:', b.count, 'баз, подпись', b.sig); process.exit(0); }
if (process.argv.includes('--check')) { console.log('schemas/index.js устарел — запустите: node tools/build-index.js'); process.exit(1); }
const nb = PF.makeBundle(list);
fs.writeFileSync(out, nb.text);
console.log('schemas/index.js собран:', nb.count, 'баз (' + list.map(x => x.name).join(', ') + '),', (Buffer.byteLength(nb.text) / 1048576).toFixed(2), 'МБ, подпись', nb.sig);
