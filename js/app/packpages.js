/* ============================================================
   Страница «Учебные базы»: выбор баз, проверка, добавление.
   ============================================================ */
(function (G) {
  'use strict';
  var U = G.U, h = U.h, A = G.App, P = G.Packs, PF = G.PackFormat, S = G.Store;

  async function reload(msg, rereadBundle) {
    if (rereadBundle && !S.dir) await P.reloadBundle();
    A.packsReady = P.load();
    await A.packsReady;
    A.dispatch();
    if (msg) U.toast(msg, 'ok', 4000);
  }

  function sourceText(p) {
    if (p.source === 'builtin') return 'встроена в курс';
    if (p.source === 'import') return 'добавлена в этом браузере' + (P.from === 'bundle' ? ' (заменяет копию из index.js, если она там есть)' : '');
    if (p.source === 'file') return 'файл ' + p.path + '.json';
    if (p.source === 'bundle') return 'из файла schemas/index.js (папка ' + p.path + ')';
    return 'папка ' + p.path;
  }

  /* --- отчёт проверки --- */
  A.showPackReport = function (p) {
    var body = h('div.report', h('p.muted', 'Проверяю: выполняю все примеры и эталонные решения…'));
    U.modal('Проверка базы «' + p.title + '»', body, [{ text: 'Закрыть' }]);
    setTimeout(function () {
      var t0 = Date.now();
      var r = PF.validate(p, { dbs: P.dbs() });
      U.clear(body);
      var c = r.counts || {};
      body.appendChild(h('p', 'Проверено: примеров ' + (c.examples || 0) + ', заданий ' + (c.tasks || 0) + ', вопросов ' + (c.quizzes || 0) + ' за ' + ((Date.now() - t0) / 1000).toFixed(1) + ' с.'));
      if (!r.errors.length && !r.warnings.length) body.appendChild(h('div.fb.ok', h('b', 'Всё в порядке. '), 'Ошибок и замечаний нет.'));
      if (r.errors.length) {
        body.appendChild(h('h4.bad-t', 'Ошибки (' + r.errors.length + ') — их нужно исправить'));
        body.appendChild(h('ul.rep-list', r.errors.map(function (e) { return h('li', h('b', e.where + ': '), e.msg); })));
      }
      if (r.warnings.length) {
        body.appendChild(h('h4', 'Замечания (' + r.warnings.length + ')'));
        body.appendChild(h('ul.rep-list.warn', r.warnings.map(function (e) { return h('li', h('b', e.where + ': '), e.msg); })));
      }
    }, 60);
  };

  /* --- добавление базы из папки или файла --- */
  var KEEP = /\.(json|csv|txt|md)$/i;
  // Выбранная папка: одна база (есть schema.json) или папка schemas с несколькими базами
  async function readPicked(fileList) {
    var all = {}, top = '';
    var arr = Array.prototype.slice.call(fileList);
    for (var i = 0; i < arr.length; i++) {
      var f = arr[i], rel = f.webkitRelativePath || f.name;
      if (!KEEP.test(f.name) || f.size > 30 * 1024 * 1024) continue;
      var parts = rel.split('/');
      if (parts.some(function (x) { return x.charAt(0) === '.'; })) continue;
      if (parts.length > 1) { top = parts[0]; parts.shift(); }
      all[parts.join('/')] = await f.text();
    }
    var keys = Object.keys(all);
    if (keys.some(function (k) { return k.toLowerCase() === 'schema.json'; })) return [{ name: top, files: all }];
    var groups = {};
    keys.forEach(function (k) {
      var p = k.split('/');
      if (p.length === 1) { if (/\.json$/i.test(p[0]) && p[0].charAt(0) !== '_') groups['file:' + p[0]] = { name: p[0].replace(/\.json$/i, ''), files: { 'schema.json': all[k] } }; return; }
      if (p[0].charAt(0) === '_') return;
      (groups[p[0]] = groups[p[0]] || { name: p[0], files: {} }).files[p.slice(1).join('/')] = all[k];
    });
    return Object.keys(groups).map(function (g) { return groups[g]; }).filter(function (g) { return Object.keys(g.files).some(function (f) { return f.toLowerCase() === 'schema.json'; }); });
  }
  // Несколько баз сразу (выбрали всю папку schemas)
  async function addMany(groups) {
    var added = [], skipped = [], bad = [];
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i], pack;
      try { pack = P.fromFiles(g.name, g.files, 'import'); } catch (e) { bad.push(g.name + ': ' + e.message); continue; }
      var ex = P.get(pack.id);
      if (ex && ex.source !== 'import' && ex.source !== 'bundle' && !(S.mode === 'fs' && ex.source === 'folder')) { skipped.push(pack.title); continue; }
      var folder = String(g.name || pack.id).replace(/^[_.]+/, '');
      if (!/^[\w.-]+$/.test(folder)) folder = pack.id;
      if (ex && ex.source === 'folder') folder = ex.path.replace(/^schemas\//, '');
      try { if (S.mode === 'fs') await S.writePack(folder, g.files); else await S.putLocalPack(folder, g.files); added.push(pack); }
      catch (e) { bad.push(g.name + ': ' + e.message); }
    }
    await reload();
    added.forEach(function (p) { P.setActive(A.user, p.id, true); });
    A.save(); A.dispatch();
    var msg = h('div',
      h('p', 'Добавлено баз: ' + added.length + (added.length ? ' — ' + added.map(function (p) { return p.title; }).join(', ') : '') + '.'),
      skipped.length ? h('p.muted', 'Уже есть в курсе, пропущены: ' + skipped.join(', ') + '.') : null,
      bad.length ? h('div.fb.bad', h('b', 'Не удалось: '), bad.map(function (x) { return h('div', x); })) : null);
    U.modal('Загрузка баз', msg);
  }
  async function addPicked(name, files) {
    var pack;
    try { pack = P.fromFiles(name || 'pack', files, 'import'); }
    catch (e) { U.modal('Не удалось добавить базу', h('div', h('p', e.message), h('p.muted', 'В папке базы должен быть файл schema.json. Формат описан в schemas/ФОРМАТ.md внутри папки курса.'))); return; }
    var folder = name || pack.id;
    folder = String(folder).replace(/^[_.]+/, '');
    if (!/^[\w.-]+$/.test(folder)) folder = pack.id;
    if (P.get(pack.id) && P.get(pack.id).source !== 'import' && P.get(pack.id).source !== 'bundle') {
      var ow = await U.confirm('Заменить базу?', 'База с id «' + pack.id + '» уже есть (' + sourceText(P.get(pack.id)) + '). ' + (S.mode === 'fs' && P.get(pack.id).source === 'folder' ? 'Файлы в папке ' + P.get(pack.id).path + ' будут перезаписаны.' : 'Добавленная копия будет пропущена — поменяйте "id" в schema.json.'), S.mode === 'fs' && P.get(pack.id).source === 'folder' ? 'Перезаписать' : 'Понятно');
      if (!ow || !(S.mode === 'fs' && P.get(pack.id).source === 'folder')) return;
      folder = P.get(pack.id).path.replace(/^schemas\//, '');
    }
    try {
      if (S.mode === 'fs') {
        await S.writePack(folder, files);
      } else {
        await S.putLocalPack(folder, files);
      }
    } catch (e) { U.toast('Не удалось сохранить базу: ' + U.esc(e.message), 'err', 7000); return; }
    P.setActive(A.user, pack.id, true); A.save();
    await reload('База «' + U.esc(pack.title) + '» добавлена и отмечена для изучения' + (S.mode === 'fs' ? ' (папка schemas/' + U.esc(folder) + ')' : ''));
  }

  function downloadBundle() {
    var b = P.bundleFromLoaded();
    if (!b.count) { U.toast('Нет учебных баз, кроме встроенной', 'warn'); return; }
    U.download('index.js', b.text);
    U.modal('Файл index.js скачан', h('div',
      h('p', 'В файле все загруженные сейчас учебные базы (' + b.count + '). Положите его в папку ', h('code', 'schemas'), ' внутри папки курса (заменив старый) — тогда базы будут подключаться автоматически на любом ПК, даже там, где браузер не даёт доступ к папке.'),
      h('p.muted', 'Если папка курса подключена с записью, курс обновляет этот файл сам при каждом входе и нажатии «Обновить».')));
  }
  function sourceNote() {
    var bi = P.bundleInfo;
    if (S.hosted) return h('div.store-note.ok', 'Курс открыт с сайта: учебные базы загружаются с него (файл ', h('code', 'schemas/index.js'), (bi ? ', собран ' + U.fmtDate(bi.built) : ''), '). Свою базу можно подключить кнопкой «Добавить базу» — она сохранится ' + (S.mode === 'fs' ? 'в выбранной папке' : 'в этом браузере') + '. Чтобы база появилась у всех, её добавляют в репозиторий курса (см. README).');
    var biText = bi ? 'файл schemas/index.js собран ' + U.fmtDate(bi.built) + ', баз в нём: ' + bi.count : 'файла schemas/index.js нет';
    if (P.from === 'folder' && S.mode === 'fs') return h('div.store-note.ok', 'Базы читаются прямо из папки ', h('code', (S.folderName() || '') + '/schemas'), '. Для компьютеров без доступа к папке курс сам обновляет файл ', h('code', 'schemas/index.js'), P.bundleWritten ? ' — только что обновлён (' + P.bundleWritten + ' ' + U.plural(P.bundleWritten, 'база', 'базы', 'баз') + ').' : ' — он актуален.');
    if (P.from === 'folder') return h('div.store-note.warn', 'Базы читаются из папки (только чтение). Файл ', h('code', 'schemas/index.js'), ' отсюда обновить нельзя: если добавили базу, нажмите «Скачать index.js» и положите файл в schemas. Сейчас: ' + biText + '.');
    if (P.from === 'bundle') return h('div.store-note.warn', 'Папка курса не подключена, поэтому базы загружены из файла ', h('code', 'schemas/index.js'), ' (' + biText.replace('файл schemas/index.js ', '') + '). Если новой базы нет в списке — пересоберите файл: он обновляется сам на ПК, где папка курса подключена с записью; или нажмите «Добавить базу (папка)», выберите папку schemas целиком и затем «Скачать index.js».');
    return h('div.store-note.warn', 'Папка курса не подключена и ' + biText + '. Добавьте базы кнопкой «Добавить базу (папка)» — можно выбрать сразу всю папку schemas.');
  }

  A.route(/^#\/packs$/, function (view) {
    var u = A.user, page = h('div.page'); view.appendChild(page);
    var dirInp = h('input', { type: 'file', webkitdirectory: true, multiple: true, style: { display: 'none' } });
    var fileInp = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    dirInp.addEventListener('change', async function () {
      var groups = await readPicked(dirInp.files); dirInp.value = '';
      if (!groups.length) { U.toast('В выбранной папке нет баз: нужен schema.json (в папке базы или в её подпапках)', 'warn', 6000); return; }
      if (groups.length === 1) await addPicked(groups[0].name, groups[0].files); else await addMany(groups);
    });
    fileInp.addEventListener('change', async function () { var f = fileInp.files[0]; fileInp.value = ''; if (!f) return; await addPicked(f.name.replace(/\.json$/i, ''), { 'schema.json': await f.text() }); });
    page.appendChild(h('div.card-head', h('h1', 'Учебные базы'),
      h('div.row-btns',
        h('button.btn', { onclick: function () { reload('Список баз обновлён', true); }, title: S.dir ? 'Перечитать папку schemas' : 'Перечитать файл schemas/index.js' }, '⟳ Обновить'),
        h('button.btn.primary', { onclick: function () { dirInp.click(); }, title: 'Папка одной базы или вся папка schemas' }, '+ Добавить базу (папка)'),
        h('button.btn', { onclick: function () { fileInp.click(); } }, '+ Из файла .json'),
        h('button.btn', { onclick: downloadBundle, title: 'Собрать все базы в один файл schemas/index.js' }, '⬇ Скачать index.js'), dirInp, fileInp)));
    page.appendChild(sourceNote());
    page.appendChild(h('p.muted', 'Отметьте базы, которые хотите изучать — одну или несколько. Их модули и практикумы появятся на главной, задачи — в тренажёре, а таблицы — в песочнице и на схеме. В песочнице к любой подключённой базе можно обратиться по полному имени: ', h('code', 'ИмяБазы.dbo.Таблица'), ', или переключиться командой ', h('code', 'USE ИмяБазы;'), '.'));
    var active = P.activeIds(u);
    P.all().forEach(function (p) {
      var cnt = PF.counts(p), on = active.indexOf(p.id) >= 0;
      var card = h('div.card.pad.pack-card' + (on ? '.on' : ''));
      var cb = h('input', { type: 'checkbox' }); cb.checked = on;
      cb.addEventListener('change', function () {
        if (!cb.checked && P.activeIds(u).length <= 1) { cb.checked = true; U.toast('Должна быть выбрана хотя бы одна база', 'warn'); return; }
        P.setActive(u, p.id, cb.checked); A.save();
        card.classList.toggle('on', cb.checked);
        A.renderTop();
      });
      var stats = [cnt.tables + ' ' + U.plural(cnt.tables, 'таблица', 'таблицы', 'таблиц'), (p.rowCount || 0).toLocaleString('ru-RU') + ' строк'];
      if (cnt.modules) stats.push(cnt.modules + ' ' + U.plural(cnt.modules, 'модуль', 'модуля', 'модулей') + ' (' + cnt.lessons + ' ' + U.plural(cnt.lessons, 'урок', 'урока', 'уроков') + ')');
      if (cnt.sets) stats.push('практикум: ' + cnt.setTasks + ' ' + U.plural(cnt.setTasks, 'задача', 'задачи', 'задач'));
      if (cnt.trainer) stats.push('тренажёр: ' + cnt.trainer);
      if (cnt.examples) stats.push('примеров: ' + cnt.examples);
      card.appendChild(h('div.pc-top',
        h('span.pack-ic.big', p.icon),
        h('div.pc-main', h('h3', p.title, h('span.badge', p.dbName)), h('div.muted.small', sourceText(p) + (p.author ? ' · автор: ' + p.author : '') + (p.version ? ' · версия ' + p.version : ''))),
        h('label.switch', cb, h('span', 'Изучаю'))));
      if (p.description) card.appendChild(A.richHtml(p.description));
      card.appendChild(h('div.pc-stats', stats.map(function (x) { return h('span.tag', x); })));
      if (p.errors.length) card.appendChild(h('div.fb.bad.small', h('b', 'Ошибок при загрузке: ' + p.errors.length + '. '), p.errors.slice(0, 3).map(function (e) { return h('div', e.where + ': ' + e.msg); }), p.errors.length > 3 ? h('div', '…') : null));
      else if (p.warnings.length) card.appendChild(h('div.muted.small', 'Замечаний: ' + p.warnings.length + ' — нажмите «Проверить», чтобы посмотреть.'));
      card.appendChild(h('div.row-btns',
        h('a.btn.small', { href: '#/schema/' + p.id }, 'Схема'),
        h('a.btn.small', { href: '#/sandbox/' + p.id }, 'Песочница'),
        cnt.trainer ? h('a.btn.small', { href: '#/trainer/0/' + p.id }, 'Тренажёр') : null,
        h('button.btn.small.ghost', { onclick: function () { A.showPackReport(p); } }, 'Проверить задания'),
        p.source === 'import' && S.mode === 'fs' ? h('button.btn.small.ghost', {
          onclick: async function () { try { await S.writePack(p.localName, p.rawFiles); await S.removeLocalPack(p.localName); await reload('База скопирована в папку schemas/' + U.esc(p.localName)); } catch (e) { U.toast('Не удалось: ' + U.esc(e.message), 'err'); } }
        }, 'Перенести в папку курса') : null,
        p.source === 'import' ? h('button.btn.small.danger', {
          onclick: async function () { if (!(await U.confirm('Удалить базу?', 'База «' + U.esc(p.title) + '» будет удалена из этого браузера. Прогресс по её заданиям сохранится в файле ученика.', 'Удалить'))) return; await S.removeLocalPack(p.localName); P.setActive(u, p.id, false); A.save(); await reload('База удалена'); }
        }, 'Удалить') : null));
      page.appendChild(card);
    });
    if (P.failed.length) {
      page.appendChild(h('div.card.pad.err-card', h('h3', 'Не удалось загрузить'),
        h('ul.rep-list', P.failed.map(function (f) { return h('li', h('b', f.name + ': '), f.msg); }))));
    }
    page.appendChild(h('div.card.pad', h('h3', 'Как добавить свою базу'),
      h('ol.steps-list',
        h('li', 'Подготовьте папку базы: ', h('code', 'schema.json'), ' (таблицы и столбцы), ', h('code', 'data/ИмяТаблицы.csv'), ' (данные) и, по желанию, ', h('code', 'tasks.json'), ' (практикум), ', h('code', 'trainer.json'), ' (тренажёр), ', h('code', 'examples.json'), ' (примеры для песочницы), ', h('code', 'course.json'), ' (уроки). Образец — папка ', h('code', 'schemas/_шаблон'), ', полное описание — ', h('code', 'schemas/ФОРМАТ.md'), '.'),
        h('li', S.readonly && S.dir ? ['Папка курса подключена только для чтения: базы из ', h('code', S.folderName() + '/schemas/'), ' загружаются, но записать туда новую базу курс не может. Скопируйте папку базы в schemas вручную (в Проводнике) и нажмите «Обновить» — или нажмите «Добавить базу», тогда она сохранится только в этом браузере.'] : S.mode === 'fs' ? ['Скопируйте папку в ', h('code', (S.folderName() || 'папка курса') + '/schemas/'), ' и нажмите «Обновить» — или нажмите «Добавить базу» и выберите папку: курс сам скопирует её в schemas. База станет доступна всем, кто работает с этой папкой курса.'] : ['Нажмите «Добавить базу» и выберите папку базы. Она сохранится в этом браузере. Чтобы база была у всей группы, подключите папку курса (Chrome/Edge) и положите базу в ', h('code', 'schemas/'), '.']),
        h('li', 'Нажмите «Проверить задания» у новой базы: курс выполнит все эталоны и покажет ошибки.'),
        h('li', 'Чтобы база подключалась сама на компьютерах, где браузер не даёт доступ к папке, она должна попасть в файл ', h('code', 'schemas/index.js'), '. Его курс обновляет автоматически на любом ПК, где папка подключена с записью. Если такого ПК нет — нажмите «⬇ Скачать index.js» и положите файл в ', h('code', 'schemas'), ' вместо старого.'))));
  });
})(window);
