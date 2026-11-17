/* ============================================================
   Таблица данных — общий компонент (DataGrid).
   Все таблицы курса создаются им или его наследниками:
     DataGrid          — базовый: фильтр по столбцу как в Excel, сортировка, выделение
                         диапазона ячеек, копирование, итоги по выделенному, перенос
                         столбцов мышью и изменение их ширины;
     DataGrid.Result   — результат запроса (строка состояния видна всегда);
     DataGrid.Mini     — небольшие таблицы в заданиях, виджетах и пошаговом режиме;
     DataGrid.Prose    — таблицы из текста уроков (ячейки с разметкой, перенос строк).

   Свой вид таблицы:
     var My = DataGrid.extend({
       defaults: { rowNumbers: false },                      // свои значения по умолчанию
       formatCell: function (td, value, rowIndex, colIndex) { … }   // свой вывод ячейки
     });
     view.appendChild(new My({ columns: [...], rows: [[...]] }).el);

   Параметры: columns (имена или { name, kind, title }), rows (массив строк, значения —
   текст или null), kinds / types (по столбцам), raw (исходные значения для сортировки),
   rowClass(i) — класс строки по её исходному номеру.
   ============================================================ */
(function (G) {
  'use strict';
  var U = G.U, h = U.h, I = G.Icon;
  var NUMK = { int: 1, decimal: 1, float: 1, bit: 1, num: 1 };
  var NULLKEY = '\u0000null';
  var seq = 0, openMenu = null;

  function DataGrid(opts) { this.init(opts || {}); }
  var P = DataGrid.prototype;

  P.defaults = {
    columns: [], rows: [], kinds: null, types: null, raw: null,
    html: false,            // значения ячеек — разметка HTML (таблицы из текста урока)
    rowNumbers: true,       // столбец с номерами строк
    pageSize: 200,          // сколько строк рисовать за раз (остальные — по мере прокрутки)
    filter: true, sort: true, select: true, reorder: true, resize: true,
    status: 'auto',         // строка состояния: true — всегда, false — никогда, 'auto' — когда есть что показать
    wrap: false,            // переносить текст в ячейках
    rowClass: null, cls: '',
    emptyText: 'Строк нет'
  };

  // Наследование: DataGrid.extend({ defaults: {...}, метод: function () {...} })
  DataGrid.extend = function (proto) {
    var Base = this;
    function Sub(opts) { Base.call(this, opts); }
    Sub.prototype = Object.create(Base.prototype);
    Sub.prototype.constructor = Sub;
    proto = proto || {};
    for (var k in proto) {
      if (k === 'defaults') {
        var d = {}, b = Base.prototype.defaults, x;
        for (x in b) d[x] = b[x];
        for (x in proto.defaults) d[x] = proto.defaults[x];
        Sub.prototype.defaults = d;
      } else Sub.prototype[k] = proto[k];
    }
    Sub.extend = Base.extend;
    Sub.fromTable = Base.fromTable;
    return Sub;
  };

  /* ---------------- данные ---------------- */
  P.init = function (opts) {
    var o = this.o = {}, d = this.defaults, k, self = this;
    for (k in d) o[k] = d[k];
    for (k in opts) if (opts[k] !== undefined) o[k] = opts[k];
    this.id = ++seq;
    this.rows = o.rows || [];
    this.raw = o.raw || null;
    this.cols = (o.columns || []).map(function (c, i) {
      var col = (c && typeof c === 'object') ? { name: String(c.name), kind: c.kind, title: c.title } : { name: String(c) };
      if (!col.kind && o.kinds) col.kind = o.kinds[i];
      if (!col.title && o.types) col.title = o.types[i];
      col.kind = NUMK[col.kind] ? 'num' : (col.kind === 'date' || col.kind === 'datetime' ? 'date' : (col.kind ? 'str' : ''));
      return col;
    });
    if (o.html) this.plain = this.rows.map(function (r) { return r.map(function (v) { return v === null || v === undefined ? null : stripTags(v); }); });
    this.cols.forEach(function (col, c) { if (!col.kind) col.kind = self.guessKind(c); });
    this.order = this.cols.map(function (_, i) { return i; });
    this.widths = {}; this.filters = {}; this.sortBy = null;
    this.sel = null; this.anchor = null; this.view = []; this.shown = 0;
    this.build();
    this.refresh();
  };
  function stripTags(html) { var d = document.createElement('div'); d.innerHTML = html; return d.textContent.replace(/\s+/g, ' ').trim(); }

  // Тип столбца, если он не задан: числа — когда все непустые значения похожи на числа
  P.guessKind = function (c) {
    var n = 0, lim = Math.min(this.rows.length, 300);
    for (var r = 0; r < lim; r++) {
      var t = this.text(r, c);
      if (t === null || t === '') continue;
      if (!/^-?\d+(?:[.,]\d+)?$/.test(t)) return 'str';
      n++;
    }
    return n ? 'num' : 'str';
  };
  // Текст ячейки (null — пустое значение)
  P.text = function (r, c) {
    var v = (this.plain || this.rows)[r][c];
    return v === null || v === undefined ? null : String(v);
  };
  // Значение для сравнения и итогов
  P.value = function (r, c) {
    var kind = this.cols[c].kind, t;
    if (kind === 'num') {
      if (this.raw && this.raw[r] && this.raw[r][c] !== undefined) { var x = this.raw[r][c]; return x === null ? null : (x === true ? 1 : x === false ? 0 : Number(x)); }
      t = this.text(r, c);
      if (t === null || t === '') return null;
      var f = parseFloat(t.replace(/\s/g, '').replace(',', '.'));
      return isNaN(f) ? null : f;
    }
    return this.text(r, c);
  };
  P.key = function (r, c) { var t = this.text(r, c); return t === null ? NULLKEY : t; };
  function cmpText(a, b) {
    if (G.TSQL && G.TSQL.cmpStr) return G.TSQL.cmpStr(a, b);
    return a < b ? -1 : a > b ? 1 : 0;
  }
  P.compare = function (c, ra, rb) {
    var a = this.value(ra, c), b = this.value(rb, c);
    if (a === null || b === null) return a === b ? 0 : (a === null ? -1 : 1);   // NULL — первым, как в SQL Server
    if (this.cols[c].kind === 'num') return a - b;
    return cmpText(a, b);
  };

  /* ---------------- фильтр ---------------- */
  function toNum(s) { var f = parseFloat(String(s).replace(/\s/g, '').replace(',', '.')); return isNaN(f) ? null : f; }
  // дату можно ввести как 15.01.2026 — приводим к виду, в котором даты показывает курс
  function toDateText(s) { var m = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})(.*)$/.exec(String(s).trim()); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) + m[4] : String(s).trim(); }
  P.testCond = function (r, c, cond) {
    var kind = this.cols[c].kind, t = this.text(r, c), op = cond.op;
    if (op === 'null') return t === null;
    if (op === 'notnull') return t !== null;
    if (t === null) return op === 'ne' || op === 'nhas';
    var low = t.toLowerCase(), q = String(cond.v).toLowerCase();
    if (op === 'has') return low.indexOf(q) >= 0;
    if (op === 'nhas') return low.indexOf(q) < 0;
    if (op === 'starts') return low.indexOf(q) === 0;
    if (op === 'ends') return q.length <= low.length && low.lastIndexOf(q) === low.length - q.length;
    var a, b, b2;
    if (kind === 'num') { a = this.value(r, c); b = toNum(cond.v); b2 = toNum(cond.v2); if (b === null) return true; }
    else if (kind === 'date') { a = t; b = toDateText(cond.v); b2 = toDateText(cond.v2 || ''); }   // «по 15 января» включает весь этот день — см. сравнения ниже
    else { a = low; b = q; b2 = String(cond.v2 || '').toLowerCase(); }
    if (op === 'eq') return kind === 'date' ? a.indexOf(b) === 0 : a === b;
    if (op === 'ne') return kind === 'date' ? a.indexOf(b) !== 0 : a !== b;
    if (op === 'gt') return a > b && !(kind === 'date' && a.indexOf(b) === 0);
    if (op === 'ge') return a >= b;
    if (op === 'lt') return a < b;
    if (op === 'le') return a <= b || (kind === 'date' && a.indexOf(b) === 0);
    if (op === 'between') return a >= b && (b2 === null || b2 === '' || a <= b2 || (kind === 'date' && a.indexOf(b2) === 0));
    return true;
  };
  P.test = function (r, c, f) {
    if (f.allow && f.allow[this.key(r, c)] !== 1) return false;
    if (f.cond && !this.testCond(r, c, f.cond)) return false;
    return true;
  };
  P.passes = function (r, skip) {
    for (var c in this.filters) { if (+c === skip) continue; if (!this.test(r, +c, this.filters[c])) return false; }
    return true;
  };
  // Разные значения столбца (среди строк, прошедших фильтры остальных столбцов)
  P.distinct = function (c) {
    var map = {}, list = [], self = this;
    for (var r = 0; r < this.rows.length; r++) {
      if (!this.passes(r, c)) continue;
      var k = this.key(r, c);
      if (map[k]) map[k].n++; else list.push(map[k] = { key: k, text: k === NULLKEY ? null : k, n: 1, r: r });
    }
    list.sort(function (a, b) { return self.compare(c, a.r, b.r); });
    return list;
  };
  P.filterCount = function () { return Object.keys(this.filters).length; };
  P.clearFilters = function () { this.filters = {}; this.refresh(); };

  // Пересчитать видимые строки и перерисовать
  P.refresh = function () {
    var self = this, view = [];
    for (var r = 0; r < this.rows.length; r++) if (this.passes(r, -1)) view.push(r);
    if (this.sortBy) {
      var c = this.sortBy.col, dir = this.sortBy.dir;
      view.sort(function (a, b) { return dir * self.compare(c, a, b) || a - b; });
    }
    this.view = view;
    this.sel = null; this.anchor = null;
    this.renderHead();
    this.renderBody();
    this.renderFoot();
  };

  /* ---------------- разметка ---------------- */
  P.build = function () {
    var o = this.o, self = this;
    this.thead = h('thead'); this.tbody = h('tbody');
    this.table = h('table.grid', this.thead, this.tbody);
    this.note = h('div.grid-empty');
    this.wrap = h('div.grid-wrap', this.table, this.note);
    if (o.select) this.wrap.setAttribute('tabindex', '0');
    this.foot = h('div.dg-foot');
    this.styleEl = document.createElement('style');
    this.el = h('div.dg' + (o.wrap ? '.dg-wrapped' : ''), { 'data-dg': this.id }, this.styleEl, this.wrap, this.foot);
    if (o.cls) String(o.cls).split(' ').forEach(function (c) { if (c) self.el.classList.add(c); });
    this.el.dataGrid = this;
    this.bind();
  };
  P.off = function () { return this.o.rowNumbers ? 1 : 0; };

  P.renderHead = function () {
    var self = this, o = this.o, tr = h('tr');
    if (o.rowNumbers) tr.appendChild(h('th.rn.dg-corner', { title: o.select ? 'Выделить всю таблицу' : '' }, '#'));
    this.order.forEach(function (c) {
      var col = self.cols[c], f = self.filters[c], s = self.sortBy && self.sortBy.col === c ? self.sortBy.dir : 0;
      var th = h('th' + (col.name === '(Отсутствует имя столбца)' ? '.noname' : '') + (f ? '.filtered' : '') + (s ? '.sorted' : ''), { 'data-c': c, title: col.title || '' },
        h('span.th-t', col.name),
        s ? h('span.th-s', { title: s > 0 ? 'Отсортировано по возрастанию' : 'Отсортировано по убыванию' }, s > 0 ? '▲' : '▼') : null,
        (o.filter || o.sort) ? h('button.th-f', { type: 'button', title: 'Фильтр и сортировка', 'aria-label': 'Фильтр и сортировка: ' + col.name }, I(f ? 'filter' : 'chevron-down', 13)) : null,
        o.resize ? h('span.th-rs', { title: 'Потяните — изменить ширину; двойной щелчок — по содержимому' }) : null);
      tr.appendChild(th);
    });
    U.clear(this.thead).appendChild(tr);
  };

  // Вывод одной ячейки — наследник может переопределить
  P.formatCell = function (td, value) {
    if (value === null || value === undefined) { td.className = 'null'; td.textContent = 'NULL'; }
    else if (this.o.html) td.innerHTML = value;
    else td.textContent = value;
  };
  P.rowEl = function (vi) {
    var self = this, o = this.o, r = this.view[vi];
    var tr = document.createElement('tr');
    tr.setAttribute('data-r', vi); tr.setAttribute('data-i', r);
    if (o.rowNumbers) { var rn = document.createElement('td'); rn.className = 'rn'; rn.textContent = vi + 1; tr.appendChild(rn); }
    var row = this.rows[r];
    this.order.forEach(function (c) {
      var td = document.createElement('td');
      td.setAttribute('data-c', c);
      self.formatCell(td, row[c], r, c);
      if (self.cols[c].kind === 'num' && row[c] !== null && row[c] !== undefined) td.classList.add('num');
      tr.appendChild(td);
    });
    if (o.rowClass) { var rc = o.rowClass(r); if (rc) tr.classList.add(rc); }
    return tr;
  };
  P.renderBody = function () {
    U.clear(this.tbody);
    this.shown = 0;
    this.renderMore();
    this.wrap.scrollTop = 0;
    var txt = '';
    if (!this.rows.length) txt = this.o.emptyText;
    else if (!this.view.length) txt = 'Нет строк, подходящих под фильтр';
    this.note.textContent = txt;
    this.note.style.display = txt ? '' : 'none';
  };
  P.renderMore = function (upTo) {
    var end = Math.min(this.view.length, Math.max(this.shown + this.o.pageSize, upTo || 0));
    if (end <= this.shown) return false;
    var frag = document.createDocumentFragment();
    for (var i = this.shown; i < end; i++) frag.appendChild(this.rowEl(i));
    this.tbody.appendChild(frag);
    this.shown = end;
    if (this.sel) this.paintSel();
    return true;
  };

  function fmtNum(x) {
    var r = Math.round(x * 1e6) / 1e6;
    try { return r.toLocaleString('ru-RU', { maximumFractionDigits: 6 }); } catch (e) { return String(r); }
  }
  // Строка состояния: число строк, фильтры, итоги по выделенному
  P.renderFoot = function () {
    var self = this, o = this.o, foot = U.clear(this.foot);
    var total = this.rows.length, n = this.view.length, fc = this.filterCount();
    var left = h('div.dg-info'), right = h('div.dg-sel');
    if (fc) {
      left.appendChild(h('span', 'Строк: ', h('b', String(n)), ' из ' + total + ' · фильтр по ' + fc + ' ' + U.plural(fc, 'столбцу', 'столбцам', 'столбцам')));
      left.appendChild(h('button.dg-link', { type: 'button', onclick: function () { self.clearFilters(); } }, 'Сбросить'));
    } else if (o.status === true || this.shown < n) left.appendChild(h('span', 'Строк: ', h('b', String(total))));
    if (this.shown < n) left.appendChild(h('button.dg-link', { type: 'button', title: 'Строки дорисовываются и сами — при прокрутке таблицы', onclick: function () { self.renderMore(); self.renderFoot(); } }, 'показаны первые ' + this.shown + ' — ещё'));
    var s = this.sel;
    if (s) {
      var cells = (s.r2 - s.r1 + 1) * (s.c2 - s.c1 + 1);
      if (cells === 1) {
        var t = this.text(this.view[s.r1], this.order[s.c1]);
        right.appendChild(h('span.dg-val', { title: t === null ? 'NULL' : t }, t === null ? 'NULL' : t));
      } else {
        var sum = 0, cnt = 0, min = null, max = null;
        if (cells <= 200000) for (var r = s.r1; r <= s.r2; r++) for (var c = s.c1; c <= s.c2; c++) {
          var col = this.order[c];
          if (this.cols[col].kind !== 'num') continue;
          var v = this.value(this.view[r], col);
          if (v === null) continue;
          sum += v; cnt++; if (min === null || v < min) min = v; if (max === null || v > max) max = v;
        }
        right.appendChild(h('span', 'Ячеек: ', h('b', String(cells))));
        if (cnt) right.appendChild(h('span', { title: 'Минимум ' + fmtNum(min) + ' · максимум ' + fmtNum(max) }, 'Сумма: ', h('b', fmtNum(sum)), ' · Среднее: ', h('b', fmtNum(sum / cnt))));
      }
      right.appendChild(h('button.dg-btn', { type: 'button', title: 'Копировать выделенное (Ctrl+C)', onclick: function () { self.copy(false); } }, I('copy', 14), 'Копировать'));
      if (cells > 1) right.appendChild(h('button.dg-btn', { type: 'button', title: 'Копировать вместе с названиями столбцов (Ctrl+Shift+C)', onclick: function () { self.copy(true); } }, 'с заголовками'));
    }
    if (left.firstChild) foot.appendChild(left);
    if (right.firstChild) foot.appendChild(right);
    foot.style.display = (o.status !== false && foot.firstChild) ? '' : 'none';
  };

  /* ---------------- ширина столбцов ---------------- */
  P.applyWidths = function () {
    var css = '', pre = '[data-dg="' + this.id + '"] table.grid ';
    for (var c in this.widths) {
      var w = this.widths[c];
      css += pre + 'th[data-c="' + c + '"],' + pre + 'td[data-c="' + c + '"]{width:' + w + 'px;min-width:' + w + 'px;max-width:' + w + 'px}';
    }
    this.styleEl.textContent = css;
  };
  P.setWidth = function (c, w) {
    if (w === null) delete this.widths[c]; else this.widths[c] = Math.max(36, Math.round(w));
    this.applyWidths();
  };
  // Переставить столбец c на позицию pos (в порядке показа)
  P.moveColumn = function (c, pos) {
    var from = this.order.indexOf(c);
    if (from < 0) return;
    pos = Math.max(0, Math.min(this.order.length - 1, pos));
    if (pos === from) return;
    this.order.splice(from, 1);
    this.order.splice(pos, 0, c);
    this.sel = null; this.anchor = null;
    this.renderHead(); this.renderBody(); this.renderFoot();
  };
  P.setSort = function (c, dir) {
    this.sortBy = dir ? { col: c, dir: dir } : null;
    this.refresh();
  };

  /* ---------------- выделение ---------------- */
  P.setSel = function (r1, c1, r2, c2) {
    var nr = this.view.length - 1, nc = this.order.length - 1;
    if (nr < 0 || nc < 0) { this.sel = null; }
    else {
      r1 = Math.max(0, Math.min(nr, r1)); r2 = Math.max(0, Math.min(nr, r2));
      c1 = Math.max(0, Math.min(nc, c1)); c2 = Math.max(0, Math.min(nc, c2));
      this.sel = { r1: Math.min(r1, r2), r2: Math.max(r1, r2), c1: Math.min(c1, c2), c2: Math.max(c1, c2) };
    }
    this.paintSel();
    this.renderFoot();
  };
  P.clearSel = function () { this.sel = null; this.anchor = null; this.paintSel(); this.renderFoot(); };
  P.paintSel = function () {
    var old = this.tbody.querySelectorAll('td.sel'), i;
    for (i = 0; i < old.length; i++) old[i].classList.remove('sel', 'sel-t', 'sel-b', 'sel-l', 'sel-r');
    var oh = this.thead.querySelectorAll('th.sel');
    for (i = 0; i < oh.length; i++) oh[i].classList.remove('sel');
    var s = this.sel; if (!s) return;
    var off = this.off(), rows = this.tbody.children, last = Math.min(s.r2, this.shown - 1);
    for (var r = s.r1; r <= last; r++) {
      var cells = rows[r].children;
      for (var c = s.c1; c <= s.c2; c++) {
        var td = cells[c + off], cl = td.classList;
        cl.add('sel');
        if (r === s.r1) cl.add('sel-t');
        if (r === s.r2) cl.add('sel-b');
        if (c === s.c1) cl.add('sel-l');
        if (c === s.c2) cl.add('sel-r');
      }
    }
    var hc = this.thead.firstChild ? this.thead.firstChild.children : [];
    for (var k = s.c1; k <= s.c2; k++) if (hc[k + off]) hc[k + off].classList.add('sel');
  };
  // Выделенное — текстом с табуляцией (вставляется в Excel по ячейкам)
  P.selText = function (withHead) {
    var s = this.sel; if (!s) return '';
    var out = [], self = this, line;
    if (withHead) { line = []; for (var c0 = s.c1; c0 <= s.c2; c0++) line.push(this.cols[this.order[c0]].name); out.push(line.join('\t')); }
    for (var r = s.r1; r <= s.r2; r++) {
      line = [];
      for (var c = s.c1; c <= s.c2; c++) {
        var t = self.text(self.view[r], self.order[c]);
        t = t === null ? 'NULL' : t;
        line.push(/[\t\n"]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t);
      }
      out.push(line.join('\t'));
    }
    return out.join('\n');
  };
  P.copy = function (withHead) {
    var s = this.sel; if (!s) return;
    var cells = (s.r2 - s.r1 + 1) * (s.c2 - s.c1 + 1);
    U.copy(this.selText(withHead)).then(function (ok) {
      if (ok) U.toast('Скопировано: ' + cells + ' ' + U.plural(cells, 'ячейка', 'ячейки', 'ячеек'), 'ok', 1400);
      else U.toast('Не удалось скопировать — браузер не дал доступ к буферу обмена', 'warn', 4000);
    });
  };

  /* ---------------- события ---------------- */
  function closest(el, sel, stop) {
    while (el && el !== stop && el.nodeType === 1) { if (el.matches(sel)) return el; el = el.parentNode; }
    return null;
  }
  P.cellAt = function (el) {
    var td = closest(el, 'td', this.table);
    if (!td || td.parentNode.parentNode !== this.tbody) return null;
    var vi = +td.parentNode.getAttribute('data-r');
    if (td.classList.contains('rn')) return { r: vi, c: -1 };
    return { r: vi, c: Array.prototype.indexOf.call(td.parentNode.children, td) - this.off() };
  };
  P.bind = function () {
    var self = this, o = this.o, T = this.table;

    // --- заголовок: ширина, перенос столбца, выделение столбца
    this.thead.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      var th = closest(e.target, 'th', T); if (!th) return;
      if (closest(e.target, '.th-f', th)) return;
      if (th.classList.contains('dg-corner')) return;
      var c = +th.getAttribute('data-c');
      if (e.target.classList.contains('th-rs')) { e.preventDefault(); self.startResize(e, th, c); return; }
      if (o.reorder && e.pointerType !== 'touch') self.startMove(e, th, c);
    });
    this.thead.addEventListener('dblclick', function (e) {
      if (!e.target.classList.contains('th-rs')) return;
      var th = closest(e.target, 'th', T);
      self.setWidth(+th.getAttribute('data-c'), null);
    });
    this.thead.addEventListener('click', function (e) {
      var th = closest(e.target, 'th', T); if (!th) return;
      if (e.target.classList.contains('th-rs')) return;
      if (th.classList.contains('dg-corner')) { if (o.select) { self.anchor = { r: 0, c: 0 }; self.setSel(0, 0, self.view.length - 1, self.order.length - 1); self.focus(); } return; }
      var c = +th.getAttribute('data-c');
      if (closest(e.target, '.th-f', th)) { self.openMenu(c, th); return; }
      if (self.justMoved) { self.justMoved = false; return; }
      if (!o.select) return;
      var pos = self.order.indexOf(c);
      if (e.shiftKey && self.anchor) self.setSel(0, self.anchor.c, self.view.length - 1, pos);
      else { self.anchor = { r: 0, c: pos }; self.setSel(0, pos, self.view.length - 1, pos); }
      self.focus();
    });

    // --- ячейки: выделение диапазона мышью
    this.tbody.addEventListener('pointerdown', function (e) {
      if (!o.select || e.button || e.pointerType === 'touch') return;
      if (closest(e.target, 'a, button, input, select, textarea', T)) return;
      var at = self.cellAt(e.target); if (!at) return;
      e.preventDefault();
      self.focus();
      self.startSelect(e, at);
    });
    // на телефоне палец прокручивает таблицу, поэтому выделение — касанием
    this.tbody.addEventListener('click', function (e) {
      if (!o.select || self.mouseSel) { self.mouseSel = false; return; }
      if (closest(e.target, 'a, button, input, select, textarea', T)) return;
      var at = self.cellAt(e.target); if (!at) return;
      self.pick(at, e.shiftKey);
    });

    // --- клавиатура
    this.wrap.addEventListener('keydown', function (e) {
      if (!o.select) return;
      var mod = e.ctrlKey || e.metaKey, k = e.key, s = self.sel;
      if (mod && (k === 'c' || k === 'C' || k === 'с' || k === 'С')) { if (s) { e.preventDefault(); self.copy(e.shiftKey); } return; }
      if (mod && (k === 'a' || k === 'A' || k === 'ф' || k === 'Ф')) { e.preventDefault(); self.anchor = { r: 0, c: 0 }; self.setSel(0, 0, self.view.length - 1, self.order.length - 1); return; }
      if (k === 'Escape' && s) { e.stopPropagation(); self.clearSel(); return; }
      var d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k];
      if (!d || !s || !self.anchor) return;
      e.preventDefault();
      var cur = self.cursor || { r: self.anchor.r, c: self.anchor.c };
      var nr = Math.max(0, Math.min(self.view.length - 1, cur.r + d[0])), nc = Math.max(0, Math.min(self.order.length - 1, cur.c + d[1]));
      self.cursor = { r: nr, c: nc };
      if (e.shiftKey) self.setSel(self.anchor.r, self.anchor.c, nr, nc);
      else { self.anchor = { r: nr, c: nc }; self.setSel(nr, nc, nr, nc); }
      self.reveal(nr, nc);
    });

    // --- подгрузка строк при прокрутке
    this.wrap.addEventListener('scroll', function () {
      if (self.shown >= self.view.length) return;
      if (self.wrap.scrollTop + self.wrap.clientHeight > self.wrap.scrollHeight - 300) { self.renderMore(); self.renderFoot(); }
    }, { passive: true });
  };
  P.focus = function () { try { this.wrap.focus({ preventScroll: true }); } catch (e) { } };
  P.reveal = function (r, c) {
    if (r >= this.shown) { this.renderMore(r + 1); this.renderFoot(); }
    var tr = this.tbody.children[r], td = tr && tr.children[c + this.off()];
    if (td && td.scrollIntoView) td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  // Щелчок (или касание) по ячейке или номеру строки
  P.pick = function (at, extend) {
    var lastC = this.order.length - 1;
    if (extend && this.anchor) {
      if (at.c < 0) this.setSel(this.anchor.r, 0, at.r, lastC); else this.setSel(this.anchor.r, this.anchor.c, at.r, at.c);
    } else if (at.c < 0) { this.anchor = { r: at.r, c: 0 }; this.setSel(at.r, 0, at.r, lastC); }
    else {
      var s = this.sel;
      // повторное касание той же ячейки снимает выделение
      if (s && s.r1 === at.r && s.r2 === at.r && s.c1 === at.c && s.c2 === at.c) { this.clearSel(); return; }
      this.anchor = { r: at.r, c: at.c }; this.setSel(at.r, at.c, at.r, at.c);
    }
    this.cursor = { r: at.r, c: Math.max(0, at.c) };
  };
  P.startSelect = function (e, at) {
    var self = this, lastC = this.order.length - 1, rowMode = at.c < 0, moved = false;
    this.mouseSel = true;
    if (e.shiftKey && this.anchor) { if (rowMode) this.setSel(this.anchor.r, 0, at.r, lastC); else this.setSel(this.anchor.r, this.anchor.c, at.r, at.c); }
    else {
      var s = this.sel, same = s && !rowMode && s.r1 === at.r && s.r2 === at.r && s.c1 === at.c && s.c2 === at.c;
      this.anchor = { r: at.r, c: rowMode ? 0 : at.c };
      if (same) { this.clearSel(); this.anchor = { r: at.r, c: at.c }; }
      else this.setSel(at.r, rowMode ? 0 : at.c, at.r, rowMode ? lastC : at.c);
    }
    this.cursor = { r: at.r, c: Math.max(0, at.c) };
    this.el.classList.add('dg-selecting');
    var lastKey = '';
    function move(ev) {
      // у края таблицы — прокручиваем её
      var wr = self.wrap.getBoundingClientRect();
      if (ev.clientY > wr.bottom - 18) self.wrap.scrollTop += 22; else if (ev.clientY < wr.top + 34) self.wrap.scrollTop -= 22;
      if (ev.clientX > wr.right - 18) self.wrap.scrollLeft += 26; else if (ev.clientX < wr.left + 18) self.wrap.scrollLeft -= 26;
      var x = Math.max(wr.left + 2, Math.min(wr.right - 2, ev.clientX)), y = Math.max(wr.top + 2, Math.min(wr.bottom - 2, ev.clientY));
      var to = self.cellAt(document.elementFromPoint(x, y));
      if (!to) return;
      var key = to.r + ':' + to.c; if (key === lastKey) return; lastKey = key;
      moved = true;
      self.cursor = { r: to.r, c: Math.max(0, to.c) };
      if (rowMode) self.setSel(self.anchor.r, 0, to.r, lastC);
      else self.setSel(self.anchor.r, self.anchor.c, to.r, Math.max(0, to.c));
    }
    function up() {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
      self.el.classList.remove('dg-selecting');
      setTimeout(function () { self.mouseSel = false; }, 0);
    }
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  };
  P.startResize = function (e, th, c) {
    var self = this, x0 = e.clientX, w0 = th.getBoundingClientRect().width;
    this.el.classList.add('dg-resizing');
    function move(ev) { self.setWidth(c, w0 + ev.clientX - x0); }
    function up() {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
      self.el.classList.remove('dg-resizing');
      self.justMoved = true; setTimeout(function () { self.justMoved = false; }, 0);
    }
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  };
  // Перенос столбца: тянем заголовок, линия показывает новое место
  P.startMove = function (e, th, c) {
    var self = this, x0 = e.clientX, active = false, mark = null, target = -1;
    function move(ev) {
      if (!active) {
        if (Math.abs(ev.clientX - x0) < 6) return;
        active = true;
        th.classList.add('dg-moving'); self.el.classList.add('dg-dragging');
        mark = h('div.dg-drop'); self.wrap.appendChild(mark);
      }
      var ths = self.thead.firstChild.children, off = self.off(), wr = self.wrap.getBoundingClientRect();
      if (ev.clientX > wr.right - 24) self.wrap.scrollLeft += 20; else if (ev.clientX < wr.left + 24) self.wrap.scrollLeft -= 20;
      target = self.order.length; var x = null;
      for (var i = 0; i < self.order.length; i++) {
        var r = ths[i + off].getBoundingClientRect();
        if (ev.clientX < r.left + r.width / 2) { target = i; x = r.left; break; }
        x = r.right;
      }
      mark.style.left = (x - wr.left + self.wrap.scrollLeft - 1) + 'px';
      mark.style.top = self.wrap.scrollTop + 'px';
      mark.style.height = self.wrap.clientHeight + 'px';
    }
    function up() {
      document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
      if (!active) return;
      th.classList.remove('dg-moving'); self.el.classList.remove('dg-dragging');
      if (mark) mark.remove();
      self.justMoved = true; setTimeout(function () { self.justMoved = false; }, 0);
      var from = self.order.indexOf(c);
      if (target >= 0) self.moveColumn(c, target > from ? target - 1 : target);
    }
    document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  };

  /* ---------------- меню столбца: сортировка и фильтр ---------------- */
  var OPS = {
    str: [['', 'нет условия'], ['has', 'содержит'], ['nhas', 'не содержит'], ['eq', 'равно'], ['ne', 'не равно'], ['starts', 'начинается с'], ['ends', 'заканчивается на'], ['null', 'пусто (NULL)'], ['notnull', 'не пусто']],
    num: [['', 'нет условия'], ['eq', 'равно'], ['ne', 'не равно'], ['gt', 'больше'], ['ge', 'больше или равно'], ['lt', 'меньше'], ['le', 'меньше или равно'], ['between', 'между'], ['null', 'пусто (NULL)'], ['notnull', 'не пусто']],
    date: [['', 'нет условия'], ['eq', 'равно (дата)'], ['gt', 'после'], ['ge', 'начиная с'], ['lt', 'до'], ['le', 'по (включительно)'], ['between', 'между'], ['null', 'пусто (NULL)'], ['notnull', 'не пусто']]
  };
  P.closeMenu = function () { if (openMenu) { openMenu(); openMenu = null; } };
  P.openMenu = function (c, anchor) {
    var self = this, o = this.o, col = this.cols[c], cur = this.filters[c] || {}, kind = col.kind || 'str';
    this.closeMenu();
    var vals = o.filter ? this.distinct(c) : [];
    var checked = {};
    vals.forEach(function (v) { checked[v.key] = !cur.allow || cur.allow[v.key] === 1; });
    var menu = h('div.dg-menu', { role: 'dialog', 'aria-label': 'Фильтр и сортировка: ' + col.name });
    var sortDir = this.sortBy && this.sortBy.col === c ? this.sortBy.dir : 0;
    function item(icon, text, on, fn) { return h('button.dg-mi' + (on ? '.on' : ''), { type: 'button', onclick: function () { close(); fn(); } }, icon ? h('span.dg-mi-ic', icon) : null, text); }
    menu.appendChild(h('div.dg-menu-h', h('b', col.name), h('button.icon-btn.small', { type: 'button', title: 'Закрыть', 'aria-label': 'Закрыть', onclick: function () { close(); } }, I('x', 16))));
    if (o.sort) {
      var az = kind === 'num' ? ['По возрастанию', 'По убыванию'] : kind === 'date' ? ['От старых к новым', 'От новых к старым'] : ['От А до Я', 'От Я до А'];
      menu.appendChild(h('div.dg-menu-sec',
        item('▲', az[0], sortDir > 0, function () { self.setSort(c, 1); }),
        item('▼', az[1], sortDir < 0, function () { self.setSort(c, -1); }),
        sortDir ? item('×', 'Убрать сортировку', false, function () { self.setSort(c, 0); }) : null));
    }
    var pos = this.order.indexOf(c);
    if (o.reorder || o.resize) {
      menu.appendChild(h('div.dg-menu-sec.dg-menu-row',
        o.reorder && pos > 0 ? item('←', 'Левее', false, function () { self.moveColumn(c, pos - 1); }) : null,
        o.reorder && pos < this.order.length - 1 ? item('→', 'Правее', false, function () { self.moveColumn(c, pos + 1); }) : null,
        o.resize && this.widths[c] ? item('↔', 'Авто-ширина', false, function () { self.setWidth(c, null); }) : null));
    }
    var list, search, op, v1, v2, all, hint;
    if (o.filter) {
      op = h('select.inp.dg-op', (OPS[kind] || OPS.str).map(function (x) { return h('option', { value: x[0] }, x[1]); }));
      v1 = h('input.inp', { type: 'text', placeholder: kind === 'date' ? '2026-01-31' : 'значение', 'aria-label': 'Значение условия' });
      v2 = h('input.inp', { type: 'text', placeholder: 'и', 'aria-label': 'Второе значение' });
      if (cur.cond) { op.value = cur.cond.op; v1.value = cur.cond.v || ''; v2.value = cur.cond.v2 || ''; }
      var syncOp = function () { var x = op.value; v1.style.display = x && x !== 'null' && x !== 'notnull' ? '' : 'none'; v2.style.display = x === 'between' ? '' : 'none'; };
      op.addEventListener('change', function () { syncOp(); if (v1.style.display !== 'none') v1.focus(); });
      syncOp();
      menu.appendChild(h('div.dg-menu-sec', h('div.dg-cap', 'Условие'), h('div.dg-cond', op, v1, v2)));
      search = h('input.inp.dg-search', { type: 'search', placeholder: 'Поиск по значениям (' + vals.length + ')', 'aria-label': 'Поиск по значениям' });
      all = h('input', { type: 'checkbox' });
      list = h('div.dg-list');
      hint = h('div.dg-hint');
      var visible = [];
      var drawList = function () {
        var q = search.value.trim().toLowerCase();
        visible = vals.filter(function (v) { return !q || (v.text === null ? 'null' : v.text.toLowerCase()).indexOf(q) >= 0; });
        U.clear(list);
        visible.slice(0, 300).forEach(function (v) {
          var cb = h('input', { type: 'checkbox' }); cb.checked = !!checked[v.key];
          cb.addEventListener('change', function () { checked[v.key] = cb.checked; syncAll(); });
          list.appendChild(h('label.dg-opt' + (v.text === null ? '.null' : ''), cb, h('span.dg-opt-t', v.text === null ? '(пусто — NULL)' : (v.text === '' ? '(пустая строка)' : v.text)), h('span.dg-opt-n', String(v.n))));
        });
        hint.textContent = visible.length > 300 ? 'Показаны первые 300 значений из ' + visible.length + ' — уточните поиск' : (!visible.length ? 'Ничего не найдено' : '');
        hint.style.display = hint.textContent ? '' : 'none';
        syncAll();
      };
      var syncAll = function () {
        var n = visible.filter(function (v) { return checked[v.key]; }).length;
        all.checked = n === visible.length && n > 0; all.indeterminate = n > 0 && n < visible.length;
      };
      all.addEventListener('change', function () { visible.forEach(function (v) { checked[v.key] = all.checked; }); drawList(); });
      search.addEventListener('input', function () {
        // как в Excel: поиск сразу отмечает найденное и снимает отметки с остального
        var q = search.value.trim().toLowerCase();
        if (q) vals.forEach(function (v) { checked[v.key] = (v.text === null ? 'null' : v.text.toLowerCase()).indexOf(q) >= 0; });
        else vals.forEach(function (v) { checked[v.key] = true; });
        drawList();
      });
      menu.appendChild(h('div.dg-menu-sec.dg-vals', h('div.dg-cap', 'Значения'), search, h('label.dg-opt.dg-all', all, h('span.dg-opt-t', '(Выделить все)')), list, hint));
      drawList();
      var apply = function () {
        var f = {}, x = op.value;
        var total = vals.length, on = vals.filter(function (v) { return checked[v.key]; });
        if (total && !on.length) { U.toast('Отметьте хотя бы одно значение', 'warn', 2500); return; }
        if (on.length < total) { f.allow = {}; on.forEach(function (v) { f.allow[v.key] = 1; }); }
        if (x && (x === 'null' || x === 'notnull' || v1.value.trim() !== '')) f.cond = { op: x, v: v1.value.trim(), v2: v2.value.trim() };
        if (f.allow || f.cond) self.filters[c] = f; else delete self.filters[c];
        close(); self.refresh();
      };
      menu.appendChild(h('div.dg-menu-f',
        cur.allow || cur.cond ? h('button.btn.small.ghost', { type: 'button', onclick: function () { delete self.filters[c]; close(); self.refresh(); } }, 'Снять фильтр') : h('span'),
        h('button.btn.small.primary', { type: 'button', onclick: apply }, 'Применить')));
      menu.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox') { e.preventDefault(); apply(); } });
    }
    document.body.appendChild(menu);
    // место: под заголовком столбца, в пределах окна; на узком экране — шторкой снизу
    var r = anchor.getBoundingClientRect(), mw = menu.offsetWidth, mh = menu.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    if (vw < 600) menu.classList.add('sheet');
    else {
      menu.style.left = Math.max(8, Math.min(vw - mw - 8, r.left)) + 'px';
      var top = r.bottom + 4;
      if (top + mh > vh - 8) top = Math.max(8, vh - mh - 8);
      menu.style.top = top + 'px';
    }
    function outside(e) { if (!menu.contains(e.target)) close(); }
    function key(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    function gone() { close(); }
    function close() {
      if (!menu.parentNode) return;
      menu.remove();
      document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', key, true);
      window.removeEventListener('resize', gone); window.removeEventListener('scroll', gone); window.removeEventListener('hashchange', gone);
      if (openMenu === close) openMenu = null;
    }
    setTimeout(function () { document.addEventListener('pointerdown', outside, true); }, 0);
    document.addEventListener('keydown', key, true);
    window.addEventListener('hashchange', gone);
    // шторку на телефоне не закрываем при изменении размера окна: его меняет экранная клавиатура
    if (vw >= 600) { window.addEventListener('resize', gone); window.addEventListener('scroll', gone, { passive: true }); }
    openMenu = close;
    if (search && vw >= 600) setTimeout(function () { search.focus(); }, 30);
  };

  /* ---------------- готовые виды ---------------- */
  DataGrid.Result = DataGrid.extend({ defaults: { status: true } });
  DataGrid.Mini = DataGrid.extend({ defaults: { status: 'auto' } });
  DataGrid.Prose = DataGrid.extend({ defaults: { html: true, wrap: true, rowNumbers: false, status: 'auto', cls: 'dg-prose' } });

  // Превратить обычную таблицу из текста урока (<table> с заголовком в первой строке) в таблицу с фильтрами
  DataGrid.fromTable = function (tableEl, opts) {
    var rows = Array.prototype.slice.call(tableEl.rows);
    if (rows.length < 2) return null;
    var head = Array.prototype.slice.call(rows[0].cells);
    if (!head.length || head.some(function (c) { return c.tagName !== 'TH' || c.colSpan > 1 || c.rowSpan > 1; })) return null;
    var body = [];
    for (var i = 1; i < rows.length; i++) {
      var cells = Array.prototype.slice.call(rows[i].cells);
      if (cells.length !== head.length || cells.some(function (c) { return c.colSpan > 1 || c.rowSpan > 1; })) return null;
      body.push(cells.map(function (c) { return c.innerHTML; }));
    }
    var o = { columns: head.map(function (c) { return c.textContent.trim(); }), rows: body }, k;
    for (k in (opts || {})) o[k] = opts[k];
    var Cls = this === DataGrid ? DataGrid.Prose : this;
    var grid = new Cls(o);
    if (tableEl.parentNode) tableEl.parentNode.replaceChild(grid.el, tableEl);
    return grid;
  };

  G.DataGrid = DataGrid;
})(window);
