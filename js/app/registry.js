/* ============================================================
   Реестр учебных баз: встроенный «Учебный банк» + наборы
   из папки schemas/ и добавленные в этом браузере.
   ============================================================ */
(function (G) {
  'use strict';
  var PF = G.PackFormat, S = G.Store, C = G.COURSE;
  var R = G.Packs = { list: [], failed: [], loaded: false, from: '', bundleInfo: null, bundleWritten: null };
  var byId = {};

  R.get = function (id) { return byId[id] || null; };
  R.all = function () { return R.list.slice(); };
  R.dbs = function () { var m = {}; R.list.forEach(function (p) { if (p.db) m[p.dbName.toLowerCase()] = p.db; }); return m; };

  function jsonParse(text, file) {
    try { return JSON.parse(String(text).replace(/^﻿/, '')); }
    catch (e) {
      var m = /position (\d+)/.exec(e.message), where = '';
      if (m) { var pos = +m[1], before = String(text).slice(0, pos); where = ' (строка ' + (before.split('\n').length) + ', символ ' + (pos - before.lastIndexOf('\n')) + ')'; }
      throw new Error('ошибка в ' + file + where + ': ' + e.message.replace(/^JSON\.parse: /, '') + '. Проверьте запятые, кавычки и скобки.');
    }
  }
  // Собрать «сырой» набор из словаря файлов
  R.fromFiles = function (name, files, source) {
    var keys = Object.keys(files), lower = {};
    // если выбрали папку уровнем выше — найти schema.json во вложенной папке
    var base = '';
    if (!keys.some(function (k) { return k.toLowerCase() === 'schema.json'; })) {
      var deep = keys.filter(function (k) { return /(^|\/)schema\.json$/i.test(k); }).sort(function (a, b) { return a.length - b.length; })[0];
      if (deep) base = deep.slice(0, deep.length - 'schema.json'.length);
    }
    var rel = {};
    keys.forEach(function (k) { if (k.indexOf(base) === 0) { var r = k.slice(base.length); rel[r] = files[k]; lower[r.toLowerCase()] = r; } });
    function get(n) { var k = lower[n]; return k === undefined ? null : rel[k]; }
    var sj = get('schema.json');
    if (sj === null) throw new Error('нет файла schema.json');
    var raw = { schema: jsonParse(sj, 'schema.json'), files: rel };
    ['course', 'tasks', 'trainer', 'examples'].forEach(function (k) { var t = get(k + '.json'); if (t !== null) raw[k] = jsonParse(t, k + '.json'); });
    var pack = PF.normalize(raw, { folder: name, source: source, path: source === 'folder' ? 'schemas/' + name : name });
    pack.rawFiles = files;
    return pack;
  };

  function add(pack, quietDup) {
    if (byId[pack.id]) {
      if (!quietDup) R.failed.push({ name: pack.path || pack.id, msg: 'база с id «' + pack.id + '» уже есть (' + (byId[pack.id].path || 'встроенная') + ') — эта копия пропущена. Поменяйте "id" в schema.json.' });
      return false;
    }
    var dup = R.list.filter(function (p) { return p.dbName.toLowerCase() === pack.dbName.toLowerCase(); })[0];
    if (dup) { pack.warnings.push({ where: 'schema.json', msg: 'имя базы ' + pack.dbName + ' уже занято базой «' + dup.title + '» — переименовано в ' + pack.dbName + '_' + pack.id }); pack.dbName = pack.dbName + '_' + pack.id.replace(/-/g, '_'); }
    try { PF.getDb(pack); } catch (e) { pack.errors.push({ where: 'данные', msg: 'не удалось собрать базу: ' + e.message }); pack.db = { name: pack.dbName, tables: {} }; }
    byId[pack.id] = pack;
    R.list.push(pack);
    return true;
  }

  // Загрузить все базы. Повторный вызов перечитывает папку.
  R.load = async function () {
    R.list = []; R.failed = []; byId = {};
    add(PF.builtinBank(C));
    var B = G.SQLKURS_BUNDLE || null;
    R.bundleInfo = B ? { built: B.built, count: (B.packs || []).length, sig: B.sig } : null;
    var found = null;
    if (S.dir) {
      // папка подключена (чтение и запись или только чтение) — читаем её напрямую
      try { found = await S.readSchemas(); R.from = 'folder'; }
      catch (e) { R.failed.push({ name: 'schemas', msg: 'не удалось прочитать папку: ' + e.message }); found = null; }
    }
    // в подключённой папке нет ни одной базы (например, выбрали не ту папку) — берём index.js
    if (found && !found.length && B && (B.packs || []).length) found = null;
    if (!found && B) { found = (B.packs || []).map(function (x) { return { name: x.name, kind: x.kind, files: x.files, bundle: true }; }); R.from = 'bundle'; }
    if (!found) { found = []; R.from = ''; }
    var local = await S.localPacks();
    function addLocal() {
      Object.keys(local).forEach(function (nm) {
        try { var p = R.fromFiles(nm, local[nm], 'import'); p.localName = nm; add(p, true); }
        catch (e) { R.failed.push({ name: nm + ' (добавлена в браузере)', msg: e.message }); }
      });
    }
    // без папки базы, добавленные в этом браузере, новее копий из index.js — подключаем их первыми
    if (R.from !== 'folder') addLocal();
    found.forEach(function (f) {
      if (f.kind === 'error') return R.failed.push({ name: 'schemas/' + f.name, msg: f.error });
      try { add(R.fromFiles(f.name, f.files, f.bundle ? 'bundle' : (f.kind === 'file' ? 'file' : 'folder')), f.bundle); }
      catch (e) { R.failed.push({ name: 'schemas/' + f.name + (f.kind === 'file' ? '.json' : '') + (f.bundle ? ' (из index.js)' : ''), msg: e.message }); }
    });
    // курс открыт с сайта: выбранная папка — не папка курса, поэтому базы сайта тоже подключаем
    // (одноимённые базы из папки важнее)
    if (S.hosted && R.from === 'folder' && B) (B.packs || []).forEach(function (x) {
      try { add(R.fromFiles(x.name, x.files, 'bundle'), true); }
      catch (e) { R.failed.push({ name: 'schemas/' + x.name + ' (с сайта)', msg: e.message }); }
    });
    // папка курса подключена с записью — держим schemas/index.js в актуальном состоянии для других ПК
    R.bundleWritten = null;
    if (R.from === 'folder' && S.mode === 'fs' && S.writeBundle && !S.hosted) {
      try {
        var nb = PF.makeBundle(found.filter(function (f) { return f.kind !== 'error'; }));
        if (!B || B.sig !== nb.sig) {
          await S.writeBundle(nb.text);
          G.SQLKURS_BUNDLE = { sig: nb.sig, built: new Date().toISOString(), packs: [] };
          R.bundleInfo = { built: G.SQLKURS_BUNDLE.built, count: nb.count, sig: nb.sig };
          R.bundleWritten = nb.count;
        }
      } catch (e) { R.failed.push({ name: 'schemas/index.js', msg: 'не удалось обновить файл: ' + e.message }); }
    }
    if (R.from === 'folder') addLocal();
    R.list.sort(function (a, b) { return (a.order - b.order) || a.title.localeCompare(b.title); });
    R.loaded = true;
    return R.list;
  };

  // Перечитать schemas/index.js с диска (если его заменили, пока курс открыт)
  R.reloadBundle = function () {
    return new Promise(function (resolve) {
      var el = document.createElement('script'), prev = G.SQLKURS_BUNDLE, done = false;
      function fin(ok) { if (done) return; done = true; el.remove(); if (!ok) G.SQLKURS_BUNDLE = prev; resolve(ok); }
      G.SQLKURS_BUNDLE = null;
      el.src = 'schemas/index.js?t=' + Date.now();
      el.onload = function () { fin(!!G.SQLKURS_BUNDLE); };
      el.onerror = function () { fin(false); };
      setTimeout(function () { fin(false); }, 15000);
      document.head.appendChild(el);
    });
  };

  R.bundleFromLoaded = function () {
    var list = R.list.filter(function (p) { return !p.builtin && p.rawFiles; }).map(function (p) {
      return { name: p.source === 'import' ? (p.localName || p.id) : (p.path || p.id).replace(/^schemas\//, ''), kind: p.source === 'file' ? 'file' : 'dir', files: p.rawFiles };
    });
    return PF.makeBundle(list);
  };

  /* --- Выбор баз пользователем --- */
  R.activeIds = function (u) {
    var s = u && u.settings && u.settings.packs;
    var ids = s ? s.filter(function (id) { return byId[id]; }) : R.list.filter(function (p) { return p.isDefault; }).map(function (p) { return p.id; });
    if (!ids.length) ids = ['bank'];
    return ids;
  };
  R.active = function (u) { var ids = R.activeIds(u); return R.list.filter(function (p) { return ids.indexOf(p.id) >= 0; }); };
  R.setActive = function (u, id, on) {
    var ids = R.activeIds(u).slice(), i = ids.indexOf(id);
    if (on && i < 0) ids.push(id);
    if (!on && i >= 0) ids.splice(i, 1);
    u.settings.packs = ids;
    return ids;
  };
})(window);
