/* ============================================================
   Наборы (учебные базы): формат, загрузка, сборка, проверка.
   Набор = описание таблиц (schema.json) + данные (CSV или rows)
         + необязательные: course.json, tasks.json, trainer.json,
           examples.json.
   Файл не зависит от интерфейса — работает и в браузере, и в node.
   ============================================================ */
(function (G) {
  'use strict';
  var T = G.TSQL, TY = T.TY;
  var PF = G.PackFormat = {};

  /* ---------------- Утилиты ---------------- */
  function isArr(x) { return Object.prototype.toString.call(x) === '[object Array]'; }
  // Текст можно писать строкой или массивом строк (удобно для многострочного SQL)
  PF.text = function (v) { if (v === null || v === undefined) return v; return isArr(v) ? v.join('\n') : String(v); };
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  PF.slug = function (s) {
    var map = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ү: 'u', ө: 'o', ң: 'n' };
    return String(s || '').toLowerCase().split('').map(function (c) { return map[c] !== undefined ? map[c] : c; }).join('').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'pack';
  };

  /* ---------------- Простая разметка (markdown-lite) ----------------
     **жирный**, *курсив*, `код`, [ссылка](https://...),
     ```sql ... ``` — блок SQL с подсветкой,
     - пункт / 1. пункт — списки, > совет, ! важно, ### заголовок.
     Если текст начинается с «<», он считается готовым HTML. */
  function inline(s) {
    var parts = String(s).split('`'), out = '';
    for (var i = 0; i < parts.length; i++) {
      if (i % 2 === 1 && i < parts.length - 1) { out += '<code>' + esc(parts[i]) + '</code>'; continue; }
      var t = esc(i % 2 === 1 ? '`' + parts[i] : parts[i]);
      t = t.replace(/\*\*([^*]+?)\*\*/g, '<b>$1</b>');
      t = t.replace(/(^|[^\w*])\*(\S(?:[^*]*?\S)?)\*(?![\w*])/g, '$1<i>$2</i>');
      t = t.replace(/\[([^\]]+)\]\(((?:https?:\/\/|#)[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
      out += t;
    }
    return out;
  }
  PF.mdInline = function (src) {
    if (src === null || src === undefined) return src;
    src = PF.text(src);
    if (/^\s*</.test(src)) return src;
    return inline(src);
  };
  PF.md = function (src) {
    if (src === null || src === undefined) return src;
    src = PF.text(src);
    if (/^\s*</.test(src)) return src;
    var lines = src.replace(/\r/g, '').split('\n'), out = [], para = [], list = null, quote = null;
    function flushPara() { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } }
    function flushList() { if (list) { out.push('<' + list.tag + '>' + list.items.map(function (x) { return '<li>' + inline(x) + '</li>'; }).join('') + '</' + list.tag + '>'); list = null; } }
    function flushQuote() { if (quote) { out.push('<div class="' + quote.cls + '">' + inline(quote.lines.join(' ')) + '</div>'); quote = null; } }
    function flushAll() { flushPara(); flushList(); flushQuote(); }
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i], m;
      if (/^\s*```/.test(ln)) {
        flushAll();
        var code = [];
        for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) code.push(lines[i]);
        out.push('<pre class="sql">' + esc(code.join('\n')) + '</pre>');
        continue;
      }
      if (!ln.trim()) { flushAll(); continue; }
      if ((m = /^\s*(#{1,4})\s+(.*)$/.exec(ln))) { flushAll(); out.push('<h' + (m[1].length < 3 ? 3 : 4) + '>' + inline(m[2]) + '</h' + (m[1].length < 3 ? 3 : 4) + '>'); continue; }
      if ((m = /^\s*[-*•]\s+(.*)$/.exec(ln))) { flushPara(); flushQuote(); if (!list || list.tag !== 'ul') { flushList(); list = { tag: 'ul', items: [] }; } list.items.push(m[1]); continue; }
      if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(ln))) { flushPara(); flushQuote(); if (!list || list.tag !== 'ol') { flushList(); list = { tag: 'ol', items: [] }; } list.items.push(m[1]); continue; }
      if ((m = /^\s*([>!])\s?(.*)$/.exec(ln))) {
        flushPara(); flushList();
        var cls = m[1] === '>' ? 'tip' : 'key';
        if (!quote || quote.cls !== cls) { flushQuote(); quote = { cls: cls, lines: [] }; }
        quote.lines.push(m[2]); continue;
      }
      if (list && /^\s{2,}\S/.test(ln)) { list.items[list.items.length - 1] += ' ' + ln.trim(); continue; }
      flushList(); flushQuote();
      para.push(ln.trim());
    }
    flushAll();
    return out.join('\n');
  };

  /* ---------------- CSV ---------------- */
  PF.parseCSV = function (text) {
    text = String(text || '').replace(/^\uFEFF/, '');
    // разделитель — по первой строке: ; , или табуляция
    var first = text.split(/\r?\n/)[0] || '';
    var cnt = { ';': 0, ',': 0, '\t': 0 }, inQ = false;
    for (var k = 0; k < first.length; k++) { var ch0 = first[k]; if (ch0 === '"') inQ = !inQ; else if (!inQ && cnt[ch0] !== undefined) cnt[ch0]++; }
    var sep = cnt[';'] > cnt[','] ? ';' : (cnt['\t'] > cnt[','] ? '\t' : ',');
    var rows = [], row = [], field = '', quoted = false, i = 0, n = text.length, line = 1, rowLine = 1;
    function endField() { row.push(quoted ? field : (field === '' || /^null$/i.test(field) ? null : field)); field = ''; quoted = false; }
    function endRow() { endField(); if (!(row.length === 1 && row[0] === null)) { row.line = rowLine; rows.push(row); } row = []; rowLine = line; }
    while (i < n) {
      var c = text[i];
      if (c === '"' && field === '' && !quoted) {
        quoted = true; i++;
        while (i < n) {
          if (text[i] === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } i++; break; }
          if (text[i] === '\n') line++;
          field += text[i++];
        }
        continue;
      }
      if (c === sep) { endField(); i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === '\n') { line++; endRow(); i++; continue; }
      field += c; i++;
    }
    if (field !== '' || quoted || row.length) endRow();
    var header = rows.shift() || [];
    return { sep: sep, header: header.map(function (x) { return x === null ? '' : String(x).trim(); }), rows: rows };
  };

  /* ---------------- Значения из текста ---------------- */
  function parseDate(s, withTime) {
    s = String(s).trim();
    var m, y, mo, d, hh = 0, mi = 0, ss = 0, ms = 0;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,7}))?)?)?$/.exec(s))) { y = +m[1]; mo = +m[2]; d = +m[3]; hh = +(m[4] || 0); mi = +(m[5] || 0); ss = +(m[6] || 0); ms = m[7] ? Math.round(+('0.' + m[7]) * 1000) : 0; }
    else if ((m = /^(\d{4})(\d{2})(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s))) { y = +m[1]; mo = +m[2]; d = +m[3]; hh = +(m[4] || 0); mi = +(m[5] || 0); ss = +(m[6] || 0); }
    else if ((m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(s))) { d = +m[1]; mo = +m[2]; y = +m[3]; hh = +(m[4] || 0); mi = +(m[5] || 0); ss = +(m[6] || 0); }
    else throw new Error('не удаётся распознать дату «' + s + '» (нужно ГГГГ-ММ-ДД или ГГГГ-ММ-ДД ЧЧ:ММ:СС)');
    var v = T.mkDate(y, mo, d, hh, mi, ss, ms);
    var p = new Date(v);
    if (p.getUTCFullYear() !== y || p.getUTCMonth() + 1 !== mo || p.getUTCDate() !== d || hh > 23 || mi > 59 || ss > 59) throw new Error('несуществующая дата «' + s + '»');
    if (!withTime) v = T.mkDate(y, mo, d);
    return v;
  }
  PF.value = function (raw, type) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'number' || typeof raw === 'boolean') {
      if (type.kind === 'str') return String(raw);
      if (type.kind === 'bit') return raw ? 1 : 0;
      if (type.kind === 'date' || type.kind === 'datetime') throw new Error('дата должна быть строкой «ГГГГ-ММ-ДД»');
      raw = String(raw);
    }
    var s = String(raw);
    switch (type.kind) {
      case 'str': return s;
      case 'guid': return s.toUpperCase();
      case 'int':
        if (!/^\s*[-+]?\d+\s*$/.test(s)) throw new Error('«' + s + '» не целое число');
        return parseInt(s, 10);
      case 'bit':
        if (/^(1|true|да|yes)$/i.test(s.trim())) return 1;
        if (/^(0|false|нет|no)$/i.test(s.trim())) return 0;
        throw new Error('«' + s + '» не 0/1');
      case 'decimal': case 'float': {
        var t = s.trim().replace(/\s/g, '');
        if (/^[-+]?\d+,\d+$/.test(t)) t = t.replace(',', '.');
        if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) throw new Error('«' + s + '» не число');
        if (type.kind === 'float') return parseFloat(t);
        return T.convert(t, TY.str(-1), type, {});
      }
      case 'date': return parseDate(s, false);
      case 'datetime': return parseDate(s, true);
    }
    return s;
  };

  /* ---------------- Нормализация набора ---------------- */
  var KNOWN_TOP = { id: 1, title: 1, icon: 1, dbName: 1, description: 1, about: 1, author: 1, version: 1, tables: 1, relations: 1, layout: 1, 'default': 1, examples: 1, tasks: 1, sets: 1, trainer: 1, course: 1, modules: 1, today: 1, $schema: 1, order: 1 };

  // raw: { schema: {...}, files: { 'data/Orders.csv': '...', ... }, course, tasks, trainer, examples }
  // info: { folder, source: 'folder' | 'file' | 'import', path }
  PF.normalize = function (raw, info) {
    info = info || {};
    var sc = raw.schema || {};
    var pack = { errors: [], warnings: [], source: info.source || 'folder', path: info.path || '', files: raw.files || {} };
    function E(where, msg) { pack.errors.push({ where: where, msg: msg }); }
    function W(where, msg) { pack.warnings.push({ where: where, msg: msg }); }
    pack.E = E; pack.W = W;
    Object.keys(sc).forEach(function (k) { if (!KNOWN_TOP[k]) W('schema.json', 'неизвестное поле «' + k + '» — оно будет пропущено'); });
    var id = sc.id ? String(sc.id) : PF.slug(info.folder || sc.title || 'pack');
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(id)) { W('schema.json', 'id «' + id + '» должен состоять из латиницы, цифр, _ и -; использую «' + PF.slug(id) + '»'); id = PF.slug(id); }
    pack.id = id.toLowerCase();
    pack.title = sc.title || info.folder || pack.id;
    pack.icon = sc.icon || '🗄️';
    pack.description = PF.md(sc.description || sc.about || '');
    pack.author = sc.author || ''; pack.version = sc.version || '';
    pack.isDefault = !!sc['default'];
    pack.order = typeof sc.order === 'number' ? sc.order : 100;
    var dbn = sc.dbName || (pack.id.charAt(0).toUpperCase() + pack.id.slice(1)).replace(/[^A-Za-z0-9_]/g, '');
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(dbn)) { W('schema.json', 'dbName «' + dbn + '» должен быть латиницей без пробелов'); dbn = 'Db_' + PF.slug(pack.id).replace(/-/g, '_'); }
    pack.dbName = dbn;
    pack.prefix = pack.id + ':';

    /* --- таблицы --- */
    pack.tables = []; pack.pks = {}; pack.relations = [];
    var seenT = {};
    if (!isArr(sc.tables) || !sc.tables.length) E('schema.json', 'нет списка таблиц (tables)');
    (sc.tables || []).forEach(function (t, ti) {
      var where = 'таблица ' + (t && t.name || '#' + (ti + 1));
      if (!t || !t.name) return E(where, 'у таблицы нет имени (name)');
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(t.name)) E(where, 'имя таблицы должно быть латиницей без пробелов');
      if (seenT[t.name.toLowerCase()]) return E(where, 'таблица описана дважды');
      seenT[t.name.toLowerCase()] = 1;
      var tbl = { name: t.name, title: t.title || t.desc || '', cols: [], types: [], file: t.file || null, inlineRows: t.rows || null, pk: null };
      var seenC = {};
      (t.columns || t.cols || []).forEach(function (c, ci) {
        var col = isArr(c) ? { name: c[0], type: c[1], desc: c[2] } : c;
        if (!col || !col.name) return E(where, 'у столбца №' + (ci + 1) + ' нет имени');
        if (seenC[col.name.toLowerCase()]) return E(where, 'столбец ' + col.name + ' указан дважды');
        seenC[col.name.toLowerCase()] = 1;
        var ty, tstr = String(col.type || 'nvarchar(100)').trim();
        if (/^n?text$/i.test(tstr) || /^n?varchar$/i.test(tstr)) tstr = tstr.replace(/text$/i, 'varchar') + '(max)';
        else if (/^n?char$/i.test(tstr)) tstr += '(1)';
        col = { name: col.name, type: tstr, desc: col.desc, title: col.title, pk: col.pk, fk: col.fk };
        try { ty = T.typeFromString(tstr); }
        catch (e) { E(where + '.' + col.name, 'тип «' + col.type + '» не поддерживается (' + e.message + ')'); ty = TY.str(-1, true); }
        tbl.cols.push([col.name, String(col.type || 'nvarchar(100)').toLowerCase(), col.desc || col.title || '']);
        tbl.types.push(ty);
        if (col.pk && !tbl.pk) tbl.pk = col.name;
        if (col.fk) pack.relations.push([t.name + '.' + col.name, String(col.fk)]);
      });
      if (!tbl.cols.length) E(where, 'нет столбцов (columns)');
      if (t.pk) tbl.pk = isArr(t.pk) ? t.pk[0] : t.pk;
      if (tbl.pk) pack.pks[t.name] = tbl.pk;
      pack.tables.push(tbl);
    });
    (sc.relations || []).forEach(function (r) {
      if (isArr(r) && r.length === 2) pack.relations.push([String(r[0]), String(r[1])]);
      else if (r && r.from && r.to) pack.relations.push([String(r.from), String(r.to)]);
      else W('schema.json', 'связь записана неверно: ' + JSON.stringify(r) + ' (нужно ["Таблица.Столбец", "Таблица.Столбец"])');
    });
    pack.relations.forEach(function (r) {
      r.forEach(function (ref) {
        var p = ref.split('.'), tb = pack.tables.filter(function (x) { return x.name.toLowerCase() === (p[0] || '').toLowerCase(); })[0];
        if (!tb) return E('связи', 'в связи ' + r.join(' → ') + ' нет таблицы ' + p[0]);
        if (!tb.cols.some(function (c) { return c[0].toLowerCase() === (p[1] || '').toLowerCase(); })) E('связи', 'в связи ' + r.join(' → ') + ' у таблицы ' + tb.name + ' нет столбца ' + p[1]);
      });
    });
    pack.layout = sc.layout || null;
    if (sc.today) { try { pack.today = PF.value(sc.today, TY.date()); } catch (e) { W('schema.json', 'today: ' + e.message); } }

    /* --- содержимое --- */
    var pre = pack.prefix;
    var ids = {};
    function nsId(rawId, where, fallback) {
      var v = rawId ? String(rawId) : fallback;
      if (!rawId) W(where, 'нет id — задан автоматически «' + v + '». Лучше указать свой: тогда прогресс не потеряется, если задания поменять местами');
      var full = pre + v;
      if (ids[full]) E(where, 'повтор id «' + v + '» (уже в: ' + ids[full] + ')');
      ids[full] = where;
      return full;
    }
    function task(t, where, fb) {
      var o = {};
      for (var k in t) o[k] = t[k];
      o.id = nsId(t.id, where, fb);
      o.localId = t.id || fb;
      o.pack = pack.id;
      o.title = t.title || '';
      o.text = PF.md(t.text || t.html || t.q || '');
      o.solution = PF.text(t.solution || '');
      o.starter = PF.text(t.starter || '');
      if (t.hint) o.hint = PF.md(t.hint);
      if (t.explain) o.explain = PF.md(t.explain);
      if (t.wrong) o.wrong = t.wrong.map(PF.text);
      if (t.alsoOk) o.alsoOk = t.alsoOk.map(PF.text);
      if (!o.solution) E(where, 'нет эталонного решения (solution)');
      if (!o.text) W(where, 'нет текста задания (text)');
      return o;
    }
    function quiz(q, where, fb) {
      var o = {};
      for (var k in q) o[k] = q[k];
      o.id = nsId(q.id, where, fb);
      o.pack = pack.id;
      o.q = PF.md(q.q || q.text || '');
      if (q.options) o.options = q.options.map(PF.mdInline);
      if (q.items) o.items = q.items.map(PF.text);
      if (q.explain) o.explain = PF.md(q.explain);
      return o;
    }
    function item(s, where, fb) {
      var t = s.t || s.type || (s.solution ? 'task' : (s.options ? 'quiz' : (s.items ? 'order' : 'task')));
      var o = t === 'task' ? task(s, where, fb) : quiz(s, where, fb);
      o.t = t;
      return o;
    }
    function step(s, where, fb) {
      var t = s.t || s.type || (s.sql ? 'example' : (s.solution ? 'task' : (s.options ? 'quiz' : (s.items ? 'order' : (s.w ? 'widget' : 'text')))));
      var o;
      if (t === 'task' || t === 'quiz' || t === 'order') { o = item(s, where, fb); o.t = t; }
      else { o = {}; for (var k in s) o[k] = s[k]; o.t = t; o.pack = pack.id; }
      if (s.title) o.title = s.title;
      if (t === 'text' || t === 'example' || t === 'widget') o.html = PF.md(s.html || s.text || '');
      else if (s.html) o.html = PF.md(s.html);
      if (s.after) o.after = PF.md(s.after);
      if (t === 'example') { o.sql = PF.text(s.sql || ''); if (!o.sql) E(where, 'у примера нет sql'); }
      if (t === 'widget' && !s.w) E(where, 'у виджета нет имени (w)');
      return o;
    }

    pack.examples = [];
    var ex = raw.examples || sc.examples;
    if (ex && !isArr(ex)) ex = ex.examples;
    (ex || []).forEach(function (e, i) {
      if (!e || !e.sql) return W('examples', 'пример №' + (i + 1) + ' без sql');
      pack.examples.push({ title: e.title || ('Пример ' + (i + 1)), sql: PF.text(e.sql), note: e.note ? PF.md(e.note) : '', pack: pack.id, expectError: !!e.expectError });
    });

    pack.trainer = [];
    var tr = raw.trainer || sc.trainer;
    if (tr && !isArr(tr)) tr = tr.tasks;
    (tr || []).forEach(function (t, i) {
      var where = 'тренажёр ' + (t.id || '#' + (i + 1));
      var o = task(t, where, 'tr' + (i + 1));
      o.level = +t.level || 0;
      if (!(o.level >= 1 && o.level <= 5)) { E(where, 'уровень (level) должен быть от 1 до 5'); o.level = Math.min(5, Math.max(1, o.level || 1)); }
      o.tags = t.tags || [];
      pack.trainer.push(o);
    });

    pack.sets = [];
    var st = raw.tasks || sc.tasks || sc.sets;
    if (st && !isArr(st)) st = st.sets;
    (st || []).forEach(function (s, si) {
      var sid = s.id || 'set' + (si + 1);
      var set = { id: pre + sid, localId: sid, pack: pack.id, num: si + 1, title: s.title || ('Практикум ' + (si + 1)), short: s.short || '', desc: PF.md(s.desc || s.intro || ''), tasks: [] };
      if (ids[set.id]) E('практикум ' + sid, 'повтор id'); ids[set.id] = 'практикум ' + sid;
      (s.tasks || []).forEach(function (t, ti) {
        var o = task(t, 'практикум «' + set.title + '» задача ' + (t.id || ti + 1), sid + '-' + (ti + 1));
        if (t.level) o.level = +t.level;
        set.tasks.push(o);
      });
      if (!set.tasks.length) W('практикум ' + sid, 'нет задач');
      pack.sets.push(set);
    });

    pack.modules = [];
    var cr = raw.course || sc.course || sc.modules;
    if (cr && !isArr(cr)) cr = cr.modules;
    (cr || []).forEach(function (m, mi) {
      var mid = m.id || 'm' + (mi + 1);
      var where = 'модуль ' + mid;
      var mod = { id: pre + mid, localId: mid, pack: pack.id, num: m.num || mi + 1, title: m.title || ('Модуль ' + (mi + 1)), short: PF.text(m.short || ''), goal: PF.md(m.goal || ''), read: m.read || [], hwIntro: m.hwIntro ? PF.md(m.hwIntro) : null, lessons: [], homework: [] };
      if (ids[mod.id]) E(where, 'повтор id модуля'); ids[mod.id] = where;
      (m.lessons || []).forEach(function (l, li) {
        var lid = l.id || mid + 'l' + (li + 1);
        var lw = where + ', урок ' + (li + 1);
        var les = { id: pre + lid, pack: pack.id, title: l.title || ('Урок ' + (li + 1)), minutes: l.minutes || 0, read: l.read || [], steps: [], training: [] };
        if (ids[les.id]) E(lw, 'повтор id урока'); ids[les.id] = lw;
        (l.steps || []).forEach(function (s, si) { les.steps.push(step(s, lw + ', шаг ' + (si + 1), lid + 's' + (si + 1))); });
        (l.training || []).forEach(function (s, si) { les.training.push(item(s, lw + ', тренировка ' + (si + 1), lid + 't' + (si + 1))); });
        if (!les.steps.length) W(lw, 'в уроке нет шагов');
        mod.lessons.push(les);
      });
      (m.homework || []).forEach(function (t, ti) { mod.homework.push(task(t, where + ', ДЗ ' + (ti + 1), mid + 'hw' + (ti + 1))); });
      pack.modules.push(mod);
    });
    return pack;
  };

  /* ---------------- Сборка базы для движка ---------------- */
  PF.buildDb = function (pack) {
    var db = { name: pack.dbName, tables: {} };
    var files = pack.files || {};
    var fileKeys = {}; Object.keys(files).forEach(function (k) { fileKeys[k.toLowerCase().replace(/\\/g, '/')] = k; });
    pack.rowCount = 0;
    pack.tables.forEach(function (t) {
      var where = 'данные ' + t.name;
      var rows = [];
      var colIdx = {}; t.cols.forEach(function (c, i) { colIdx[c[0].toLowerCase()] = i; });
      var maxErr = 5, errCnt = 0;
      function put(vals, lineNo) {
        var row = new Array(t.cols.length);
        for (var i = 0; i < t.cols.length; i++) {
          var v = vals[i];
          try { row[i] = PF.value(v === undefined ? null : v, t.types[i]); }
          catch (e) { row[i] = null; if (errCnt++ < maxErr) pack.E(where, (lineNo ? 'строка ' + lineNo + ', ' : '') + 'столбец ' + t.cols[i][0] + ': ' + e.message); }
          if (row[i] !== null && t.types[i].kind === 'str' && t.types[i].len > 0 && String(row[i]).length > t.types[i].len) {
            if (errCnt++ < maxErr) pack.W(where, (lineNo ? 'строка ' + lineNo + ', ' : '') + 'столбец ' + t.cols[i][0] + ': текст длиннее ' + t.types[i].len + ' символов');
          }
        }
        rows.push(row);
      }
      if (t.inlineRows) {
        t.inlineRows.forEach(function (r, ri) {
          if (isArr(r)) put(r, ri + 1);
          else put(t.cols.map(function (c) { var k = Object.keys(r).filter(function (x) { return x.toLowerCase() === c[0].toLowerCase(); })[0]; return k === undefined ? null : r[k]; }), ri + 1);
        });
      } else {
        var fname = (t.file || ('data/' + t.name + '.csv')).replace(/\\/g, '/');
        var key = fileKeys[fname.toLowerCase()];
        if (key === undefined) { pack.W(where, 'нет файла ' + fname + ' — таблица будет пустой'); }
        else {
          var csv;
          try { csv = PF.parseCSV(files[key]); } catch (e) { pack.E(where, 'не удалось прочитать CSV: ' + e.message); csv = { header: [], rows: [] }; }
          var map = csv.header.map(function (h) { var j = colIdx[h.toLowerCase()]; return j === undefined ? -1 : j; });
          csv.header.forEach(function (h, i) { if (map[i] < 0 && h) pack.W(where, 'в CSV лишний столбец «' + h + '» — пропущен'); });
          if (csv.header.length && map.every(function (x) { return x < 0; })) pack.E(where, 'первая строка CSV должна содержать имена столбцов: ' + t.cols.map(function (c) { return c[0]; }).join(', '));
          t.cols.forEach(function (c, i) { if (map.indexOf(i) < 0) pack.W(where, 'в CSV нет столбца ' + c[0] + ' — будет NULL'); });
          csv.rows.forEach(function (r) {
            var vals = new Array(t.cols.length);
            for (var i = 0; i < map.length; i++) if (map[i] >= 0) vals[map[i]] = r[i];
            if (r.length !== csv.header.length && errCnt++ < maxErr) pack.W(where, 'строка ' + r.line + ': значений ' + r.length + ', а столбцов в заголовке ' + csv.header.length + ' (проверьте разделитель и кавычки)');
            put(vals, r.line);
          });
        }
      }
      if (errCnt > maxErr) pack.E(where, '…и ещё ошибок: ' + (errCnt - maxErr));
      // уникальность первичного ключа
      if (t.pk && colIdx[t.pk.toLowerCase()] !== undefined) {
        var pi = colIdx[t.pk.toLowerCase()], seen = {}, dup = 0;
        rows.forEach(function (r) { var k = r[pi]; if (k === null) dup++; else if (seen[k]) dup++; else seen[k] = 1; });
        if (dup) pack.E(where, 'первичный ключ ' + t.pk + ': повторяющиеся или пустые значения (' + dup + ')');
      } else if (t.pk) pack.E(where, 'первичный ключ ' + t.pk + ' — нет такого столбца');
      db.tables[t.name.toLowerCase()] = { name: t.name, columns: t.cols.map(function (c, i) { return { name: c[0], type: t.types[i] }; }), rows: rows };
      t.rowCount = rows.length;
      pack.rowCount += rows.length;
    });
    // ссылочная целостность: значения внешних ключей должны быть в родительской таблице
    pack.relations.forEach(function (r) {
      var a = r[0].split('.'), b = r[1].split('.');
      var ta = db.tables[(a[0] || '').toLowerCase()], tb = db.tables[(b[0] || '').toLowerCase()];
      if (!ta || !tb) return;
      var ia = ta.columns.map(function (c) { return c.name.toLowerCase(); }).indexOf((a[1] || '').toLowerCase());
      var ib = tb.columns.map(function (c) { return c.name.toLowerCase(); }).indexOf((b[1] || '').toLowerCase());
      if (ia < 0 || ib < 0) return;
      var have = {}; tb.rows.forEach(function (x) { have[T.keyOf ? T.keyOf(x[ib]) : x[ib]] = 1; });
      var bad = ta.rows.filter(function (x) { return x[ia] !== null && !have[T.keyOf ? T.keyOf(x[ia]) : x[ia]]; });
      if (bad.length) pack.W('связи', r[0] + ' → ' + r[1] + ': ' + bad.length + ' знач. без пары в ' + b[0] + ' (например ' + bad[0][ia] + ')');
    });
    return db;
  };

  /* ---------------- Встроенный «Учебный банк» как набор ---------------- */
  PF.builtinBank = function (C) {
    var pack = {
      id: 'bank', title: 'Учебный банк', icon: '🏦', dbName: 'Bank', builtin: true, source: 'builtin', path: '', isDefault: true, order: 0,
      description: '<p>Основной курс. Вымышленный банк: филиалы, клиенты, счета, операции, кредиты, сотрудники и курсы валют. Данные с января 2025 по октябрь 2026.</p>',
      tables: T.SCHEMA.map(function (t) { return { name: t.name, title: t.title, cols: t.cols, types: [] }; }),
      relations: T.RELATIONS,
      pks: { Branches: 'BranchID', Clients: 'ClientID', Accounts: 'AccountID', Transactions: 'TransactionID', LoanProducts: 'ProductID', Loans: 'LoanID', Employees: 'EmployeeID', ImportRaw: 'RowID' },
      layout: { Employees: [0, 0], Branches: [1, 0], LoanProducts: [2, 0], Loans: [2, 1], Clients: [1, 1], CurrencyRates: [0, 1], Transactions: [1, 2], Accounts: [0, 2], ImportRaw: [2, 2] },
      errors: [], warnings: [], prefix: '',
      modules: C ? C.modules : [], sets: [], trainer: C ? C.trainer.tasks : [],
      examples: [
        { title: 'Клиенты', sql: 'SELECT TOP (20) * FROM Clients;' },
        { title: 'Операции за октябрь 2026', sql: "SELECT TOP (50) *\nFROM Transactions\nWHERE TransDate >= '20261001' AND TransDate < '20261101'\nORDER BY TransDate DESC;" },
        { title: 'Сумма операций по типам', sql: "SELECT TransType, COUNT(*) AS Cnt, SUM(Amount) AS Total\nFROM Transactions\nWHERE Status = N'Проведена'\nGROUP BY TransType\nORDER BY Total DESC;" },
        { title: 'Клиенты и их счета', sql: 'SELECT c.ClientID, c.LastName, c.FirstName, a.AccountNumber, a.Currency, a.Balance\nFROM Clients c\nJOIN Accounts a ON a.ClientID = c.ClientID\nORDER BY c.ClientID;' },
        { title: 'Курс USD по месяцам', sql: "SELECT FORMAT(RateDate, 'yyyy-MM') AS Mon, MIN(Rate) AS MinRate, MAX(Rate) AS MaxRate, AVG(Rate) AS AvgRate\nFROM CurrencyRates\nWHERE Currency = 'USD'\nGROUP BY FORMAT(RateDate, 'yyyy-MM')\nORDER BY Mon;" }
      ]
    };
    pack.examples.forEach(function (e) { e.pack = 'bank'; });
    function tag(x) { if (x && typeof x === 'object') x.pack = 'bank'; }
    pack.modules.forEach(function (m) {
      tag(m);
      m.lessons.forEach(function (l) { tag(l); l.steps.forEach(tag); (l.training || []).forEach(tag); });
      (m.homework || []).forEach(tag);
    });
    pack.trainer.forEach(tag);
    pack.buildDb = function () { var db = T.buildBankDb(); db.name = 'Bank'; pack.rowCount = Object.keys(db.tables).reduce(function (s, k) { return s + db.tables[k].rows.length; }, 0); pack.tables.forEach(function (t) { t.rowCount = db.tables[t.name.toLowerCase()].rows.length; }); return db; };
    return pack;
  };

  PF.getDb = function (pack) {
    if (!pack.db) {
      pack.db = pack.buildDb ? pack.buildDb() : PF.buildDb(pack);
      pack.db.name = pack.dbName;
    }
    return pack.db;
  };

  /* ---------------- Файл schemas/index.js (все базы одним скриптом) ----------------
     Читается через <script> даже с file:// и без доступа к папке. */
  function fnv(str) { var h = 0x811c9dc5; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('0000000' + h.toString(16)).slice(-8) + '-' + str.length; }
  // list: [{ name, kind, files: { 'schema.json': '...', 'data/X.csv': '...' } }]
  PF.makeBundle = function (list, builtAt) {
    var packs = list.filter(function (x) { return x && x.files; }).map(function (x) {
      var files = {}; Object.keys(x.files).sort().forEach(function (k) { files[k] = x.files[k]; });
      return { name: x.name, kind: x.kind || 'dir', files: files };
    }).sort(function (a, b) { return a.name < b.name ? -1 : a.name > b.name ? 1 : 0; });
    var body = JSON.stringify(packs);
    var sig = fnv(body);
    var text = '/* Учебные базы курса «SELECT с нуля», собранные в один файл.\n' +
      '   Не редактируйте вручную: курс пересобирает файл сам, когда папка курса подключена с записью,\n' +
      '   или нажмите «Скачать index.js» на странице «Базы». Исходники баз — папки рядом с этим файлом. */\n' +
      'window.SQLKURS_BUNDLE = {"sig":' + JSON.stringify(sig) + ',"built":' + JSON.stringify(builtAt || new Date().toISOString()) + ',"packs":' + body + '};\n';
    return { sig: sig, text: text, count: packs.length, packs: packs };
  };

  /* ---------------- Счётчики ---------------- */
  PF.counts = function (pack) {
    var c = { tables: pack.tables.length, rows: pack.rowCount || 0, modules: pack.modules.length, lessons: 0, hw: 0, sets: pack.sets.length, setTasks: 0, trainer: pack.trainer.length, examples: pack.examples.length };
    pack.modules.forEach(function (m) { c.lessons += m.lessons.length; c.hw += (m.homework || []).length; });
    pack.sets.forEach(function (s) { c.setTasks += s.tasks.length; });
    return c;
  };

  /* ---------------- Проверка набора ----------------
     Выполняет все примеры и эталоны. opts.dbs — все базы (для запросов к нескольким базам). */
  PF.validate = function (pack, opts) {
    opts = opts || {};
    var Ch = G.Checker;
    var errors = pack.errors.slice(), warnings = pack.warnings.slice();
    function E(where, msg) { errors.push({ where: where, msg: msg }); }
    function W(where, msg) { warnings.push({ where: where, msg: msg }); }
    var db;
    try { db = PF.getDb(pack); } catch (e) { E('данные', 'не удалось собрать базу: ' + e.message); return { errors: errors, warnings: warnings }; }
    errors = pack.errors.slice(); warnings = pack.warnings.slice();
    var dbs = opts.dbs || {}; dbs[pack.dbName.toLowerCase()] = db;
    var xopts = { dbs: dbs, now: pack.today };
    var n = { examples: 0, tasks: 0, quizzes: 0 };
    function run(sql, where, expectError) {
      var r = T.execute(sql, db, xopts);
      if (expectError) { if (!r.error) W(where, 'ожидалась ошибка, но запрос выполнился'); return r; }
      if (r.error) E(where, 'ошибка SQL ' + r.error.number + ': ' + r.error.message);
      return r;
    }
    function checkTask(t, where) {
      n.tasks++;
      if (!t.solution) return;
      var r = run(t.solution, where + ' (эталон)');
      if (r.error) return;
      var rs = Ch ? Ch.lastSet(r) : r.results[r.results.length - 1];
      if (!rs) return E(where, 'эталон не возвращает таблицу результатов');
      if (!rs.rows.length && !t.allowEmpty) W(where, 'эталон возвращает 0 строк — задача может быть непонятной (если так задумано, поставьте "allowEmpty": true)');
      var spec = t.check || {};
      if (spec.order) spec.order.forEach(function (o) { if (!isArr(o) || o[0] >= rs.columns.length) E(where, 'check.order: нет столбца №' + (isArr(o) ? o[0] : o) + ' (нумерация с 0)'); });
      ['require', 'forbid'].forEach(function (k) { (spec[k] || []).forEach(function (x) { try { new RegExp(x[0], 'i'); } catch (e) { E(where, 'check.' + k + ': ошибка в регулярном выражении ' + x[0]); } }); });
      if (spec.names) rs.columns.forEach(function (cn, i) { if (cn === '(Отсутствует имя столбца)') E(where, 'check.names: у столбца ' + (i + 1) + ' эталона нет имени (добавьте AS)'); });
      if (/\bTOP\b/i.test(t.solution) && !/\bORDER\s+BY\b/i.test(t.solution)) W(where, 'TOP без ORDER BY — результат не определён');
      if (!Ch) return;
      try {
        var self = Ch.check(t, t.solution, db, xopts);
        if (!self.ok) E(where, 'эталон не проходит собственную проверку: ' + self.msg);
        (t.wrong || []).forEach(function (w, i) { if (Ch.check(t, w, db, xopts).ok) E(where, 'неверный вариант №' + (i + 1) + ' принимается проверкой'); });
        (t.alsoOk || []).forEach(function (w, i) { var x = Ch.check(t, w, db, xopts); if (!x.ok) E(where, 'верный вариант №' + (i + 1) + ' не принимается: ' + x.msg); });
      } catch (e) { E(where, 'сбой проверки: ' + e.message); }
    }
    function checkQuiz(q, where) {
      n.quizzes++;
      if (!q.q) E(where, 'нет текста вопроса (q)');
      if (q.t === 'order') { if (!q.items || q.items.length < 2) E(where, 'нужно минимум 2 элемента (items)'); return; }
      if (!q.options || q.options.length < 2) return E(where, 'нужно минимум 2 варианта ответа (options)');
      var ans = isArr(q.answer) ? q.answer : [q.answer];
      ans.forEach(function (a) { if (typeof a !== 'number' || a < 0 || a >= q.options.length) E(where, 'answer — номер верного варианта с 0 (от 0 до ' + (q.options.length - 1) + ')'); });
    }
    pack.examples.forEach(function (e, i) { n.examples++; run(e.sql, 'пример «' + e.title + '»', e.expectError); });
    pack.modules.forEach(function (m) {
      m.lessons.forEach(function (l, li) {
        var lw = 'модуль «' + m.title + '», урок ' + (li + 1);
        l.steps.forEach(function (s, si) {
          var w = lw + ', шаг ' + (si + 1);
          if (s.t === 'example') { n.examples++; run(s.sql, w, s.expectError); }
          else if (s.t === 'task') checkTask(s, w);
          else if (s.t === 'quiz' || s.t === 'order') checkQuiz(s, w);
          else if (s.t === 'widget') { if (G.Widgets && G.Widgets.names && G.Widgets.names.indexOf(s.w) < 0) E(w, 'неизвестный виджет ' + s.w); }
          else if (s.t !== 'text') E(w, 'неизвестный тип шага «' + s.t + '» (text, example, task, quiz, order, widget)');
        });
        (l.training || []).forEach(function (s, si) { var w = lw + ', тренировка ' + (si + 1); if (s.t === 'task') checkTask(s, w); else checkQuiz(s, w); });
      });
      (m.homework || []).forEach(function (t, i) { checkTask(t, 'модуль «' + m.title + '», ДЗ ' + (i + 1)); });
    });
    pack.sets.forEach(function (s) { s.tasks.forEach(function (t, i) { checkTask(t, 'практикум «' + s.title + '», задача ' + (i + 1)); }); });
    pack.trainer.forEach(function (t) { checkTask(t, 'тренажёр ' + (t.localId || t.id)); });
    return { errors: errors, warnings: warnings, counts: n };
  };
})(typeof window !== 'undefined' ? window : globalThis);
