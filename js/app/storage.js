/* ============================================================
   Хранилище: учётные записи и прогресс.
   • В папке курса: progress/<логин>.json (Chrome/Edge, File System Access API).
   • В браузере: каждая запись сразу идёт в localStorage и копией —
     в IndexedDB (там же история снимков). При чтении берётся самая
     свежая копия; повреждённая или пропавшая восстанавливается из другой.
   • Одна вкладка на пользователя: если открыть курс во второй вкладке,
     первая останавливается и не затирает прогресс.
   ============================================================ */
(function (G) {
  'use strict';
  var S = G.Store = {};
  S.mode = null;        // 'fs' | 'local'
  S.dir = null;         // папка курса
  S.progDir = null;     // папка progress
  S.fsSupported = typeof G.showDirectoryPicker === 'function';
  S.lastSaved = null;
  S.lastError = null;
  S.tabId = Math.random().toString(36).slice(2) + Date.now().toString(36);
  // Курс открыт с сайта (GitHub Pages, внутренний сервер), а не из своей папки:
  // выбранная папка — просто место для файлов прогресса, а не папка курса
  S.hosted = /^https?:$/.test(location.protocol) && !/^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(location.hostname);

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  // Метки запусков: видно, сохраняет ли браузер данные между запусками
  S.launch = (function () {
    var o = { prev: lsGet('sqlkurs.lastOpen'), first: lsGet('sqlkurs.firstSeen'), opens: +(lsGet('sqlkurs.opens') || 0) };
    var now = new Date().toISOString();
    o.fresh = !o.first && !o.prev;
    if (!o.first) { o.first = now; lsSet('sqlkurs.firstSeen', now); }
    lsSet('sqlkurs.lastOpen', now); lsSet('sqlkurs.opens', String(o.opens + 1));
    return o;
  })();
  // Попросить браузер не удалять данные курса при нехватке места
  S.persisted = null;
  S.persist = async function () {
    try {
      if (!navigator.storage || !navigator.storage.persist) { S.persisted = 'нет'; return S.persisted; }
      S.persisted = await navigator.storage.persisted();
      if (!S.persisted) S.persisted = await navigator.storage.persist();
    } catch (e) { S.persisted = 'нет'; }
    return S.persisted;
  };

  /* --- IndexedDB для запоминания выбранной папки --- */
  var KV = null;
  function idb() {
    if (KV) return KV;
    KV = new Promise(function (res, rej) {
      var r = indexedDB.open('sqlkurs-store', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { var d = r.result; d.onversionchange = function () { d.close(); KV = null; }; d.onclose = function () { KV = null; }; res(d); };
      r.onerror = function () { KV = null; rej(r.error); };
      r.onblocked = function () { KV = null; rej(new Error('база IndexedDB занята другой вкладкой')); };
    });
    return KV;
  }
  function idbGet(k) { return idb().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction('kv').objectStore('kv').get(k); t.onsuccess = function () { res(t.result); }; t.onerror = function () { rej(t.error); }; }); }); }
  function idbSet(k, v) { return idb().then(function (db) { return new Promise(function (res, rej) { var t = db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); t.onsuccess = function () { res(); }; t.onerror = function () { rej(t.error); }; }); }); }

  function withTimeout(p, ms, fallback) {
    return Promise.race([p, new Promise(function (res) { setTimeout(function () { res(fallback); }, ms); })]);
  }
  function setPref(v) { try { if (v) localStorage.setItem('sqlkurs.mode', v); else localStorage.removeItem('sqlkurs.mode'); } catch (e) { } }
  // запомнить папку (не ждём дольше 3 с: если хранилище браузера недоступно, работаем без запоминания)
  async function remember(key, h) {
    try { var ok = await withTimeout(idbSet(key, h).then(function () { return true; }), 3000, false); if (!ok) S.idbProblem = 'тайм-аут'; }
    catch (e) { S.idbProblem = e && e.message || String(e); }
  }

  /* Состояние при старте:
     ready — папка подключена на чтение и запись (прогресс в файлах);
     ro — папка только для чтения (базы из schemas, прогресс в браузере);
     need-permission / need-permission-ro — нужно подтвердить доступ;
     need-folder — папка не выбрана; local / local-chosen — без папки. */
  S.init = async function () {
    S.persist();
    var pref = null;
    try { pref = localStorage.getItem('sqlkurs.mode'); } catch (e) { }
    S.readonly = false; S.dir = null; S.progDir = null;
    if (!S.fsSupported) { S.mode = 'local'; return 'local'; }
    if (pref === 'local') { S.mode = 'local'; return 'local-chosen'; }
    if (pref === 'ro') {
      S.mode = 'local'; S.readonly = true;
      try {
        var hr = await withTimeout(idbGet('dirRO'), 4000, null);
        if (hr) {
          S.dir = hr;
          var pr = await hr.queryPermission({ mode: 'read' });
          return pr === 'granted' ? 'ro' : 'need-permission-ro';
        }
      } catch (e) { S.lastError = e; }
      S.readonly = false; setPref(null);
      return 'need-folder';
    }
    try {
      // Тайм-аут на случай, если браузер «завис» на чтении сохранённой папки
      var h = await withTimeout(idbGet('dir'), 4000, null);
      if (h) {
        S.dir = h;
        var p = await h.queryPermission({ mode: 'readwrite' });
        if (p === 'granted') { await openDirs(); return 'ready'; }
        return 'need-permission';
      }
    } catch (e) { S.lastError = e; }
    S.dir = null;
    return 'need-folder';
  };

  async function openDirs() {
    S.progDir = await S.dir.getDirectoryHandle('progress', { create: true });
    S.mode = 'fs'; S.readonly = false;
    setPref('fs');
  }

  // Последняя попытка выбрать папку — для страницы «Проверка браузера»
  S.lastPick = null;
  function notePick(mode, t0, err) {
    S.lastPick = { mode: mode, at: new Date(), ms: Date.now() - t0, ok: !err, name: err ? err.name : '', message: err ? err.message : '' };
    S.picks = S.picks || {}; S.picks[mode] = S.lastPick;
  }

  // Подключить папку курса на чтение и запись
  S.pickFolder = async function () {
    var t0 = Date.now(), h;
    try { h = await G.showDirectoryPicker({ id: 'sqlkurs', mode: 'readwrite' }); }
    catch (e) { notePick('readwrite', t0, e); throw e; }
    try {
      var hasIndex = false;
      try { await h.getFileHandle('index.html'); hasIndex = true; } catch (e) { }
      S.dir = h;
      await openDirs();
      await remember('dir', h);
      notePick('readwrite', t0, null);
      return { name: h.name, hasIndex: hasIndex };
    } catch (e) { notePick('readwrite', t0, e); throw e; }
  };
  // Подключить папку только для чтения: учебные базы из schemas, прогресс — в браузере
  S.pickFolderRO = async function () {
    var t0 = Date.now(), h;
    try { h = await G.showDirectoryPicker({ id: 'sqlkurs', mode: 'read' }); }
    catch (e) { notePick('read', t0, e); throw e; }
    var hasIndex = false;
    try { await h.getFileHandle('index.html'); hasIndex = true; } catch (e) { }
    S.dir = h; S.readonly = true; S.mode = 'local'; S.progDir = null;
    setPref('ro');
    await remember('dirRO', h);
    notePick('read', t0, null);
    return { name: h.name, hasIndex: hasIndex };
  };
  S.regrant = async function () {
    if (!S.dir) return false;
    var p = await S.dir.requestPermission({ mode: 'readwrite' });
    if (p === 'granted') { await openDirs(); return true; }
    return false;
  };
  S.regrantRO = async function () {
    if (!S.dir) return false;
    var p = await S.dir.requestPermission({ mode: 'read' });
    if (p === 'granted') { S.readonly = true; S.mode = 'local'; return true; }
    return false;
  };
  S.useLocal = function () { S.mode = 'local'; S.readonly = false; S.dir = null; S.progDir = null; setPref('local'); S.persist(); };
  S.resetMode = function () { S.readonly = false; setPref(null); };
  S.folderName = function () { return S.dir ? S.dir.name : null; };

  // Проверка хранилища браузера (для диагностики)
  S.testStorage = async function () {
    var out = { localStorage: false, indexedDB: false, idbError: '' };
    try { localStorage.setItem('sqlkurs.test', '1'); out.localStorage = localStorage.getItem('sqlkurs.test') === '1'; localStorage.removeItem('sqlkurs.test'); } catch (e) { }
    try {
      var v = await withTimeout(idbSet('test', 1).then(function () { return idbGet('test'); }), 3000, 'timeout');
      if (v === 'timeout') out.idbError = 'нет ответа за 3 с'; else out.indexedDB = v === 1;
    } catch (e) { out.idbError = e && e.message || String(e); }
    return out;
  };

  /* --- Учебные базы (наборы) в папке schemas --- */
  var PACK_EXT = /\.(json|csv|txt|md)$/i;
  async function readTree(dir, prefix, out, depth) {
    for await (var entry of dir.values()) {
      if (entry.name.charAt(0) === '.') continue;
      if (entry.kind === 'directory') { if (depth < 3) await readTree(entry, prefix + entry.name + '/', out, depth + 1); }
      else if (PACK_EXT.test(entry.name)) {
        var f = await entry.getFile();
        if (f.size > 30 * 1024 * 1024) continue;
        out[prefix + entry.name] = await f.text();
      }
    }
    return out;
  }
  // [{ name, kind: 'dir' | 'file', files: { 'schema.json': '...', 'data/Orders.csv': '...' } }]
  S.readSchemas = async function () {
    if (!S.dir) return [];
    var sdir;
    try { sdir = await S.dir.getDirectoryHandle('schemas'); } catch (e) { return []; }
    var out = [];
    for await (var entry of sdir.values()) {
      var nm = entry.name;
      if (nm.charAt(0) === '_' || nm.charAt(0) === '.') continue;
      try {
        if (entry.kind === 'directory') out.push({ name: nm, kind: 'dir', files: await readTree(entry, '', {}, 0) });
        else if (/\.json$/i.test(nm)) out.push({ name: nm.replace(/\.json$/i, ''), kind: 'file', files: { 'schema.json': await (await entry.getFile()).text() } });
      } catch (e) { out.push({ name: nm, kind: 'error', error: e.message }); }
    }
    return out;
  };
  // Записать набор в schemas/<name>/ (доступен всем, кто работает с этой папкой курса)
  S.writePack = async function (name, files) {
    var sdir = await S.dir.getDirectoryHandle('schemas', { create: true });
    var pdir = await sdir.getDirectoryHandle(name, { create: true });
    for (var path in files) {
      var parts = path.split('/'), d = pdir;
      for (var i = 0; i < parts.length - 1; i++) d = await d.getDirectoryHandle(parts[i], { create: true });
      var fh = await d.getFileHandle(parts[parts.length - 1], { create: true });
      var w = await fh.createWritable(); await w.write(files[path]); await w.close();
    }
  };
  // Записать schemas/index.js (сборка всех баз для ПК без доступа к папке)
  S.writeBundle = async function (text) {
    var sdir = await S.dir.getDirectoryHandle('schemas', { create: true });
    var fh = await sdir.getFileHandle('index.js', { create: true });
    var w = await fh.createWritable(); await w.write(text); await w.close();
  };
  // Наборы, добавленные в этом браузере (режим без папки)
  S.localPacks = async function () { try { return (await idbGet('packs')) || {}; } catch (e) { return {}; } };
  S.putLocalPack = async function (name, files) { var all = await S.localPacks(); all[name] = files; await idbSet('packs', all); };
  S.removeLocalPack = async function (name) { var all = await S.localPacks(); delete all[name]; await idbSet('packs', all); };

  /* --- Копия прогресса в IndexedDB и история снимков --- */
  var VDB = null;
  function vault() {
    if (VDB) return VDB;
    VDB = new Promise(function (res, rej) {
      var r = indexedDB.open('sqlkurs-vault', 1);
      r.onupgradeneeded = function () {
        var d = r.result;
        if (!d.objectStoreNames.contains('users')) d.createObjectStore('users', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('snaps')) d.createObjectStore('snaps', { keyPath: 'key' });
      };
      r.onsuccess = function () { var d = r.result; d.onversionchange = function () { d.close(); VDB = null; }; res(d); };
      r.onerror = function () { VDB = null; rej(r.error); };
      r.onblocked = function () { VDB = null; rej(new Error('база IndexedDB занята другой вкладкой')); };
    });
    return VDB;
  }
  // Одна транзакция; fn(store) может вернуть запрос — его результат станет результатом
  function vtx(store, mode, fn) {
    var p = vault().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction(store, mode), out, r = fn(tx.objectStore(store));
        if (r) r.onsuccess = function () { out = r.result; };
        tx.oncomplete = function () { res(out); };
        tx.onerror = function () { rej(tx.error); };
        tx.onabort = function () { rej(tx.error || new Error('транзакция прервана')); };
      });
    });
    return Promise.race([p, new Promise(function (res, rej) { setTimeout(function () { rej(new Error('IndexedDB не ответила за 4 с')); }, 4000); })]);
  }
  var SNAP_EVERY = 15 * 60 * 1000, SNAP_KEEP = 30, lastSnap = {};
  S.vaultOk = null; S.vaultError = '';
  async function vaultPut(rec, forceSnap) {
    try {
      await vtx('users', 'readwrite', function (st) { return st.put(rec); });
      var now = Date.now();
      if (!forceSnap && !lastSnap[rec.id]) {
        // первая запись после открытия: не дублируем снимок, если прогресс не изменился
        var prev = await vtx('snaps', 'readonly', function (st) { return st.openCursor(IDBKeyRange.bound(rec.id + '|', rec.id + '|\uffff'), 'prev'); });
        var pv = prev && prev.value;
        if (pv && pv.xp === (rec.xp || 0) && pv.solved === ((rec.stats && rec.stats.solved) || 0)) lastSnap[rec.id] = now;
      }
      if (forceSnap || !lastSnap[rec.id] || now - lastSnap[rec.id] > SNAP_EVERY) {
        lastSnap[rec.id] = now;
        var at = new Date(now).toISOString();
        await vtx('snaps', 'readwrite', function (st) { return st.put({ key: rec.id + '|' + at, id: rec.id, at: at, xp: rec.xp || 0, solved: (rec.stats && rec.stats.solved) || 0, data: rec }); });
        var keys = await vtx('snaps', 'readonly', function (st) { return st.getAllKeys(IDBKeyRange.bound(rec.id + '|', rec.id + '|\uffff')); }) || [];
        if (keys.length > SNAP_KEEP) {
          var old = keys.slice(0, keys.length - SNAP_KEEP);
          await vtx('snaps', 'readwrite', function (st) { old.forEach(function (k) { st.delete(k); }); });
        }
      }
      S.vaultOk = true; S.vaultError = '';
    } catch (e) { S.vaultOk = false; S.vaultError = e && e.message || String(e); }
  }
  async function vaultGet(id) { try { return await vtx('users', 'readonly', function (st) { return st.get(id); }); } catch (e) { return null; } }
  async function vaultAll() { try { return (await vtx('users', 'readonly', function (st) { return st.getAll(); })) || []; } catch (e) { return []; } }
  // Снимки прогресса пользователя (новые сверху)
  S.snapshots = async function (id) {
    try {
      var all = await vtx('snaps', 'readonly', function (st) { return st.getAll(IDBKeyRange.bound(id + '|', id + '|\uffff')); }) || [];
      return all.reverse();
    } catch (e) { return []; }
  };
  S.snapshotNow = function (u) { return vaultPut(JSON.parse(JSON.stringify(u)), true); };
  // Какая из двух копий свежее
  function newer(a, b) {
    if (!a) return b || null; if (!b) return a;
    if ((a.rev || 0) !== (b.rev || 0)) return (a.rev || 0) > (b.rev || 0) ? a : b;
    return String(a.updated || '') >= String(b.updated || '') ? a : b;
  }
  S.recovered = 0;

  /* --- Одна вкладка на пользователя --- */
  S.current = null; S.paused = false;
  function activeKey(id) { return 'sqlkurs.active.' + id; }
  S.claim = function (id) { S.current = id; S.paused = false; lsSet(activeKey(id), JSON.stringify({ tab: S.tabId, at: Date.now() })); };
  S.release = function () {
    if (!S.current) return;
    try { var v = JSON.parse(lsGet(activeKey(S.current)) || 'null'); if (v && v.tab === S.tabId) localStorage.removeItem(activeKey(S.current)); } catch (e) { }
    S.current = null; S.paused = false;
  };
  G.addEventListener('storage', function (e) {
    if (!S.current || S.paused || e.key !== activeKey(S.current)) return;
    var v = null; try { v = JSON.parse(e.newValue || 'null'); } catch (er) { }
    if (v && v.tab !== S.tabId) {
      // пользователь продолжил в другой вкладке — эта больше ничего не записывает
      S.paused = true; pending = null; clearTimeout(timer);
      if (S.onTakenOver) S.onTakenOver();
    }
  });

  /* --- Пользователи --- */
  var LS_PREFIX = 'sqlkurs.user.';
  function lsUser(id) { try { return JSON.parse(localStorage.getItem(LS_PREFIX + id)); } catch (e) { return null; } }
  S.listUsers = async function () {
    var out = [];
    if (S.mode === 'fs') {
      for await (var entry of S.progDir.values()) {
        if (entry.kind !== 'file' || !/\.json$/i.test(entry.name)) continue;
        try {
          var f = await entry.getFile();
          var data = JSON.parse(await f.text());
          if (data && data.id) out.push(data);
        } catch (e) { /* повреждённый файл пропускаем */ }
      }
    } else {
      var map = {};
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf(LS_PREFIX) === 0) { try { var x = JSON.parse(localStorage.getItem(k)); if (x && x.id) map[x.id] = x; } catch (e) { } }
      }
      (await vaultAll()).forEach(function (v) {
        if (!v || !v.id) return;
        var best = newer(map[v.id], v);
        if (best !== map[v.id]) { lsSet(LS_PREFIX + v.id, JSON.stringify(best)); S.recovered++; }
        map[v.id] = best;
      });
      for (var id in map) out.push(map[id]);
    }
    out.sort(function (a, b) { return String(b.lastSeen || '').localeCompare(String(a.lastSeen || '')); });
    return out;
  };
  // Прочитать progress/*.json из подключённой папки (в т. ч. только для чтения)
  S.folderUsers = async function () {
    var out = [];
    if (!S.dir) return out;
    var pd;
    try { pd = S.progDir || await S.dir.getDirectoryHandle('progress'); } catch (e) { return out; }
    for await (var entry of pd.values()) {
      if (entry.kind !== 'file' || !/\.json$/i.test(entry.name)) continue;
      try { var data = JSON.parse(await (await entry.getFile()).text()); if (data && data.id) out.push(data); } catch (e) { }
    }
    return out;
  };
  S.load = async function (id) {
    if (S.mode === 'fs') {
      try { var fh = await S.progDir.getFileHandle(id + '.json'); var f = await fh.getFile(); return JSON.parse(await f.text()); }
      catch (e) { return null; }
    }
    var a = lsUser(id), b = await vaultGet(id), best = newer(a, b);
    if (best && best !== a) { lsSet(LS_PREFIX + id, JSON.stringify(best)); S.recovered++; }
    return best;
  };
  S.exists = async function (id) { return !!(await S.load(id)); };

  var pending = null, timer = null, writes = 0, chain = Promise.resolve();
  function stamp(user) { user.updated = new Date().toISOString(); user.rev = (user.rev || 0) + 1; }
  function done() { S.lastSaved = new Date(); S.lastError = null; if (S.onSaved) S.onSaved(); }
  // Записи идут строго по очереди: иначе две одновременные записи одного файла могут завершиться
  // в обратном порядке, и на диске останется более старая копия.
  S.saveNow = function (user) {
    writes++;
    // куда писать, запоминаем сразу: пока запись ждёт очереди, страница входа может переподключать хранилище
    var to = { mode: S.mode, dir: S.progDir };
    var p = chain.then(function () { return writeUser(user, to); });
    chain = p.catch(function () { });
    return p.then(function (v) { writes--; return v; }, function (e) { writes--; throw e; });
  };
  async function writeUser(user, to) {
    if (S.paused && user.id === S.current) return;
    stamp(user);
    if (to.mode === 'fs') {
      if (!to.dir) throw new Error('папка курса не подключена');
      var fh = await to.dir.getFileHandle(user.id + '.json', { create: true });
      var w = await fh.createWritable();
      await w.write(JSON.stringify(user, null, 1));
      await w.close();
      vaultPut(JSON.parse(JSON.stringify(user)));   // запасная копия в браузере
    } else {
      var text = JSON.stringify(user);
      try { localStorage.setItem(LS_PREFIX + user.id, text); }
      catch (e) { throw new Error(/quota/i.test(e.name + e.message) ? 'в браузере закончилось место для данных сайта' : e.message); }
      await vaultPut(JSON.parse(text));
    }
    done();
  };
  // Синхронная запись (при закрытии вкладки): localStorage сразу, IndexedDB — по возможности
  S.saveSync = function (user) {
    if (S.mode === 'fs' || (S.paused && user.id === S.current)) return;
    pending = null; clearTimeout(timer);
    stamp(user);
    var text = JSON.stringify(user);
    try { localStorage.setItem(LS_PREFIX + user.id, text); done(); } catch (e) { S.lastError = e; }
    vaultPut(JSON.parse(text));
  };
  S.save = function (user) {
    if (S.paused && user.id === S.current) return;
    pending = user;
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (!pending) return;
      var u = pending; pending = null;
      S.saveNow(u).catch(function (e) { S.lastError = e; if (S.onError) S.onError(e); });
    }, S.mode === 'fs' ? 600 : 200);
  };
  // Есть ли несохранённые изменения (запись ещё не завершилась)
  S.hasPending = function () { return !!pending || writes > 0; };
  S.flush = function () {
    if (!pending) return;
    clearTimeout(timer);
    var u = pending; pending = null;
    if (S.mode !== 'fs') { S.saveSync(u); return; }
    S.saveNow(u).catch(function (e) { S.lastError = e; if (S.onError) S.onError(e); });
  };
  // Удалить ученика: файл в папке и все его копии в этом браузере (иначе он «восстановится» из запасной копии)
  S.remove = async function (id) {
    if (pending && pending.id === id) { pending = null; clearTimeout(timer); }
    await chain;
    if (S.mode === 'fs') { try { await S.progDir.removeEntry(id + '.json'); } catch (e) { if (e && e.name !== 'NotFoundError') throw e; } }
    try { localStorage.removeItem(LS_PREFIX + id); } catch (e) { }
    try {
      await vtx('users', 'readwrite', function (st) { return st.delete(id); });
      await vtx('snaps', 'readwrite', function (st) { return st.delete(IDBKeyRange.bound(id + '|', id + '|\uffff')); });
    } catch (e) { }
    delete lastSnap[id];
  };
  S.where = function (user) {
    if (S.mode === 'fs') return (S.folderName() || 'папка курса') + '/progress/' + (user ? user.id : '<логин>') + '.json';
    if (S.readonly && S.dir) return 'память браузера (папка «' + S.folderName() + '» подключена только для чтения)';
    return 'этот браузер (localStorage + копия в IndexedDB)';
  };
})(window);
