/* ============================================================
   Схема базы на canvas.
   Таблицы можно двигать, схему — масштабировать и перетаскивать;
   наведение на таблицу подсвечивает её прямые связи, на линию — саму связь
   и её вид (один ко многим, один к одному, иерархия, необязательная);
   типы столбцов выделены цветом. Расположение таблиц запоминается.

   var v = App.erd(pack);  view.appendChild(v.el);  v.draw();
   ============================================================ */
(function (G) {
  'use strict';
  var U = G.U, h = U.h, I = G.Icon, A = G.App;

  /* ---------------- типы столбцов и виды связей ---------------- */
  // [код, название, цвет в светлой теме, цвет в тёмной теме]
  var CATS = [
    ['int', 'Целые числа', '#2563eb', '#8ab4ff'],
    ['dec', 'Дробные и деньги', '#0d9488', '#5fd6c8'],
    ['str', 'Текст', '#15803d', '#74dd9c'],
    ['date', 'Дата и время', '#c2610a', '#ffb866'],
    ['bit', 'Да / нет', '#9333ea', '#d3a6ff'],
    ['other', 'Другое', '#64748b', '#9aa7bd']
  ];
  function typeCat(type) {
    var t = String(type || '').toLowerCase().trim();
    if (/^(tinyint|smallint|int|bigint)\b/.test(t)) return 'int';
    if (/^(decimal|numeric|money|smallmoney|float|real)\b/.test(t)) return 'dec';
    if (/^(n?varchar|n?char|n?text)\b/.test(t)) return 'str';
    if (/^(date|datetime2?|smalldatetime|time|datetimeoffset)\b/.test(t)) return 'date';
    if (/^bit\b/.test(t)) return 'bit';
    return 'other';
  }
  A.typeCat = typeCat;
  var RELS = [
    ['many', 'Один ко многим', 'одной строке главной таблицы соответствует много строк подчинённой', '#4f46e5', '#9d9bff'],
    ['one', 'Один к одному', 'значения ссылки не повторяются: одной строке соответствует не больше одной', '#0d9488', '#5fd6c8'],
    ['self', 'Иерархия', 'таблица ссылается сама на себя: руководитель, родительская запись', '#c2610a', '#ffb866'],
    ['opt', 'Необязательная', 'в столбце-ссылке встречается NULL — связи может не быть (пунктир)', null, null]
  ];
  var REL_TEXT = { many: 'один ко многим', one: 'один к одному', self: 'иерархия — ссылка на свою же таблицу' };

  // Вид связи узнаём по данным: повторяются ли значения ссылки и бывает ли в ней NULL
  function relFacts(pack, fromT, fromC) {
    var out = { unique: false, nullable: false };
    try {
      var db = pack.db || G.PackFormat.getDb(pack), t = db.tables[fromT.toLowerCase()];
      if (!t) return out;
      var ci = -1;
      t.columns.forEach(function (c, i) { if (c.name.toLowerCase() === fromC.toLowerCase()) ci = i; });
      if (ci < 0) return out;
      var seen = {}, dup = false, n = 0;
      for (var r = 0; r < t.rows.length; r++) {
        var v = t.rows[r][ci];
        if (v === null || v === undefined) { out.nullable = true; continue; }
        n++;
        if (!dup) { if (seen[v]) dup = true; else seen[v] = 1; }
      }
      out.unique = n > 1 && !dup;
    } catch (e) { /* без данных считаем связь обычной */ }
    return out;
  }

  var FONT_MONO = '"Cascadia Mono", "Cascadia Code", "JetBrains Mono", "SF Mono", Consolas, "DejaVu Sans Mono", monospace';
  var FONT_SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, "Helvetica Neue", Arial, sans-serif';
  var HEAD = 32, SUB = 19, ROW = 23, PAD = 12, RADIUS = 13;
  var GAP_X = 92, GAP_Y = 38, MARGIN = 40;   // расстояния между таблицами и поля вокруг схемы

  function Erd(pack, opts) {
    this.pack = pack; this.o = opts || {};
    this.k = 1; this.tx = 0; this.ty = 0;          // масштаб и сдвиг
    this.hover = null; this.pin = null;            // что под курсором и что закреплено щелчком
    this.legend = null;                            // подсветка из легенды: { rel: 'many' } или { cat: 'int' }
    this.pointers = {}; this.drag = null;
    this.build();
    this.model();
  }
  var P = Erd.prototype;

  /* ---------------- модель: таблицы и связи ---------------- */
  P.model = function () {
    var self = this, pack = this.pack, ctx = this.ctx, byName = {};
    var fk = {};
    (pack.relations || []).forEach(function (r) { fk[r[0].toLowerCase()] = r[1]; });
    this.nodes = pack.tables.map(function (t) {
      var pk = String((pack.pks && pack.pks[t.name]) || '').toLowerCase();
      var rows = t.cols.map(function (c) {
        return { name: c[0], type: c[1], desc: c[2] || '', cat: typeCat(c[1]), pk: c[0].toLowerCase() === pk, fk: fk[(t.name + '.' + c[0]).toLowerCase()] || null };
      });
      ctx.font = '700 13px ' + FONT_MONO;
      var w = ctx.measureText(t.name).width + 2 * PAD + 30;
      ctx.font = '12px ' + FONT_MONO;
      rows.forEach(function (r) {
        r.nw = ctx.measureText(r.name).width; r.tw = ctx.measureText(r.type).width;
        w = Math.max(w, 2 * PAD + (r.pk || r.fk ? 25 : 0) + r.nw + 18 + r.tw);
      });
      var sub = t.title ? SUB : 0;
      var n = { t: t, name: t.name, rows: rows, sub: sub, x: 0, y: 0, w: Math.round(Math.min(360, Math.max(196, w))), h: HEAD + sub + rows.length * ROW + 6 };
      byName[t.name.toLowerCase()] = n;
      return n;
    });
    this.byName = byName;
    this.edges = [];
    (pack.relations || []).forEach(function (r) {
      var a = r[0].split('.'), b = r[1].split('.');
      var from = byName[a[0].toLowerCase()], to = byName[b[0].toLowerCase()];
      if (!from || !to) return;
      var fi = -1, ti = -1;
      from.rows.forEach(function (x, i) { if (x.name.toLowerCase() === a[1].toLowerCase()) fi = i; });
      to.rows.forEach(function (x, i) { if (x.name.toLowerCase() === b[1].toLowerCase()) ti = i; });
      if (fi < 0 || ti < 0) return;
      var f = relFacts(pack, a[0], a[1]);
      self.edges.push({ from: from, to: to, fi: fi, ti: ti, kind: from === to ? 'self' : (f.unique ? 'one' : 'many'), opt: f.nullable, label: r[0] + ' → ' + r[1] });
    });
  };
  /* ---------------- расположение таблиц ---------------- */
  // Порядок таблиц: как задумал автор базы (сетка layout из schema.json — по столбцам), остальные — следом
  P.ordered = function () {
    var lay = this.pack.layout || {};
    return this.nodes.map(function (n, i) { var p = lay[n.name]; return { n: n, c: p ? p[0] : 1e6, r: p ? p[1] : i }; })
      .sort(function (a, b) { return (a.c - b.c) || (a.r - b.r); }).map(function (x) { return x.n; });
  };
  // Разложить колонки по координатам; возвращает размер
  function place(cols) {
    var x = 0, H = 0;
    cols.forEach(function (list) {
      if (!list.length) return;
      var y = 0, w = 0;
      list.forEach(function (n) { n.x = x; n.y = y; y += n.h + GAP_Y; w = Math.max(w, n.w); });
      H = Math.max(H, y - GAP_Y); x += w + GAP_X;
    });
    return { w: Math.max(1, x - GAP_X), h: Math.max(1, H) };
  }
  // Разбить таблицы (в заданном порядке) на k колонок так, чтобы самая высокая была как можно ниже
  function partition(order, k) {
    var n = order.length, pre = [0], i, j, c;
    for (i = 0; i < n; i++) pre.push(pre[i] + order[i].h + GAP_Y);
    var cost = function (a, b) { return pre[b] - pre[a] - GAP_Y; };
    var dp = [], cut = [];
    for (c = 0; c <= k; c++) { dp.push([]); cut.push([]); for (j = 0; j <= n; j++) { dp[c][j] = c === 0 && j === 0 ? 0 : Infinity; cut[c][j] = 0; } }
    for (c = 1; c <= k; c++) for (j = 1; j <= n; j++) for (i = c - 1; i < j; i++) {
      var v = Math.max(dp[c - 1][i], cost(i, j));
      if (v < dp[c][j]) { dp[c][j] = v; cut[c][j] = i; }
    }
    var cols = [];
    for (c = k, j = n; c >= 1; c--) { i = cut[c][j]; cols.unshift(order.slice(i, j)); j = i; }
    return cols;
  }
  // Подобрать расположение под размер области: чтобы схема была видна целиком и при этом читалась.
  // Сетка автора базы остаётся, если она почти не хуже лучшего варианта.
  P.arrange = function (useSaved) {
    var self = this, nodes = this.nodes, W = this.W || 900, pd = this.pad(), m = pd.m, H = (this.H || 560) - (pd.b - m);
    this.custom = false;
    if (useSaved) {
      var saved = null;
      try { saved = JSON.parse(localStorage.getItem('sqlkurs.erd.' + this.pack.id) || 'null'); } catch (e) { }
      if (saved && saved.pos && nodes.every(function (n) { var p = saved.pos[n.name]; return p && isFinite(p[0]) && isFinite(p[1]); })) {
        nodes.forEach(function (n) { n.x = saved.pos[n.name][0]; n.y = saved.pos[n.name][1]; });
        this.custom = true; return;
      }
    }
    var order = this.ordered(), cands = [], lay = this.pack.layout || {};
    if (nodes.some(function (n) { return lay[n.name]; })) {
      var grid = [];
      order.forEach(function (n) { var p = lay[n.name], c = p ? p[0] : 0; (grid[c] = grid[c] || []).push(n); });
      cands.push({ cols: grid.filter(Boolean), own: true });
    }
    for (var k = 1; k <= Math.min(6, nodes.length); k++) cands.push({ cols: partition(order, k) });
    var min = this.minScale(), best = null, wide = null;
    cands.forEach(function (c) {
      place(c.cols);
      var b = self.bbox();
      c.sw = (W - 2 * m) / b.w; c.s = Math.min(c.sw, (H - 2 * m) / b.h, 1.15);
      if (!best || c.s > best.s + 1e-6) best = c;
      if (c.sw >= min && (!wide || c.cols.length > wide.cols.length)) wide = c;   // самый широкий вариант, читаемый по ширине
    });
    var pick = best;
    if (best.s < min && wide) pick = wide;                       // целиком не помещается — заполняем ширину, вниз можно прокрутить
    else if (cands[0].own && cands[0].s >= Math.max(min, best.s * 0.9)) pick = cands[0];
    place(pick.cols);
  };
  P.minScale = function () { return (this.W || 900) < 600 ? 0.62 : 0.7; };
  P.savePos = function () {
    var pos = {};
    this.nodes.forEach(function (n) { pos[n.name] = [Math.round(n.x), Math.round(n.y)]; });
    try { localStorage.setItem('sqlkurs.erd.' + this.pack.id, JSON.stringify({ v: 1, pos: pos })); } catch (e) { }
    this.custom = true; this.syncBar();
  };
  P.resetPos = function () {
    try { localStorage.removeItem('sqlkurs.erd.' + this.pack.id); } catch (e) { }
    this.arrange(false); this.pin = null; this.home(); this.syncBar();
  };

  /* ---------------- разметка ---------------- */
  P.build = function () {
    var self = this;
    this.canvas = h('canvas.erdc-canvas', { 'aria-label': 'Схема связей базы ' + this.pack.dbName, role: 'img' });
    this.ctx = this.canvas.getContext('2d');
    this.tip = h('div.erdc-tip');
    this.zoomLbl = h('span.erdc-zoom', '100%');
    this.resetBtn = h('button.btn.small.ghost', { type: 'button', title: 'Вернуть таблицы на исходные места', onclick: function () { self.resetPos(); } }, I('undo', 15), h('span.bl', 'Расставить заново'));
    this.bar = h('div.erdc-bar',
      h('div.erdc-tools',
        h('button.icon-btn.small', { type: 'button', title: 'Мельче', 'aria-label': 'Мельче', onclick: function () { self.zoomBy(1 / 1.25); } }, I('zoom-out', 17)),
        this.zoomLbl,
        h('button.icon-btn.small', { type: 'button', title: 'Крупнее', 'aria-label': 'Крупнее', onclick: function () { self.zoomBy(1.25); } }, I('zoom-in', 17)),
        h('button.btn.small.ghost', { type: 'button', title: 'Показать всю схему', onclick: function () { self.fit(); } }, I('fit', 15), h('span.bl', 'Вся схема')),
        this.resetBtn));
    this.stage = h('div.erdc-stage', this.canvas, this.tip);
    this.hintEl = h('div.erdc-hint', I('hand', 15), h('span', 'Таблицы и фон можно тянуть. Щелчок по таблице закрепляет её связи, двойной — показывает данные. Масштаб — кнопками, Ctrl + колесо или двумя пальцами.'));
    // легенда: наведение (или щелчок) подсвечивает столбцы этого типа или связи этого вида
    var mk = function (cls, key, val, title, text, sw) {
      var b = h('button.erdc-chip.' + cls, { type: 'button', title: title }, sw, h('span', text));
      var on = function () { self.legend = {}; self.legend[key] = val; self.syncLegend(); self.invalidate(); };
      var off = function () { if (self.legendPin) return; self.legend = null; self.syncLegend(); self.invalidate(); };
      b.addEventListener('pointerenter', function (e) { if (e.pointerType !== 'touch' && !self.legendPin) on(); });
      b.addEventListener('pointerleave', function (e) { if (e.pointerType !== 'touch') off(); });
      b.addEventListener('click', function () {
        var same = self.legendPin && self.legend && self.legend[key] === val;
        self.legendPin = !same;
        if (same) { self.legend = null; self.syncLegend(); self.invalidate(); } else on();
      });
      b._key = key; b._val = val;
      return b;
    };
    this.catChips = CATS.map(function (c) { return mk('cat', 'cat', c[0], 'Подсветить столбцы: ' + c[1].toLowerCase(), c[1], h('i.erdc-dot', { 'data-cat': c[0] })); });
    this.relChips = RELS.map(function (r) { return mk('rel', 'rel', r[0], r[1] + ': ' + r[2], r[1], h('i.erdc-line', { 'data-rel': r[0] })); });
    // легенда — островок поверх схемы (внизу); её можно свернуть
    var small = window.innerWidth < 768, open = true;
    try { var st = localStorage.getItem('sqlkurs.erdLegend'); open = st ? st === '1' : !small; } catch (e) { open = !small; }
    this.legendBody = h('div.erdc-lg-body',
      h('div.erdc-lg', h('span.erdc-lg-t', 'Типы'), this.catChips),
      h('div.erdc-lg', h('span.erdc-lg-t', 'Связи'), this.relChips,
        h('span.erdc-marks', h('b', 'PK'), ' ключ · ', h('b.fk', 'FK'), ' ссылка')));
    this.legendBtn = h('button.erdc-lg-toggle', { type: 'button', onclick: function () { self.setLegend(!self.legendOpen); } });
    this.legendEl = h('div.erdc-legend', this.legendBtn, this.legendBody);
    this.stage.appendChild(this.legendEl);
    this.setLegend(open, true);
    this.el = h('div.erdc', this.bar, this.stage, this.hintEl);
    this.bind();
  };
  P.setLegend = function (open, silent) {
    this.legendOpen = open;
    this.legendEl.classList.toggle('closed', !open);
    U.clear(this.legendBtn);
    this.legendBtn.appendChild(I(open ? 'chevron-down' : 'layers', 15));
    this.legendBtn.appendChild(h('span', open ? 'Свернуть' : 'Легенда'));
    this.legendBtn.title = open ? 'Свернуть легенду' : 'Показать легенду: типы столбцов и виды связей';
    if (!open && this.legendPin) { this.legendPin = false; this.legend = null; this.syncLegend(); this.invalidate(); }
    if (!silent) { try { localStorage.setItem('sqlkurs.erdLegend', open ? '1' : '0'); } catch (e) { } }
  };
  // поля вокруг схемы: снизу оставляем место под легенду
  P.pad = function () {
    var lh = this.legendEl ? this.legendEl.offsetHeight : 0;
    return { m: MARGIN, b: Math.max(MARGIN, lh + 22) };
  };
  P.syncLegend = function () {
    var lg = this.legend, pin = this.legendPin;
    this.catChips.concat(this.relChips).forEach(function (b) { b.classList.toggle('on', !!(lg && lg[b._key] === b._val)); b.classList.toggle('pinned', !!(pin && lg && lg[b._key] === b._val)); });
  };
  P.syncBar = function () {
    this.zoomLbl.textContent = Math.round(this.k * 100) + '%';
    this.resetBtn.disabled = !this.custom;   // кнопка всегда на месте: панель не «прыгает», когда таблицу сдвинули
    // в легенде остаются только те типы и виды связей, что есть в этой базе
    var cats = {}, rels = {};
    this.nodes.forEach(function (n) { n.rows.forEach(function (r) { cats[r.cat] = 1; }); });
    this.edges.forEach(function (e) { rels[e.kind] = 1; if (e.opt) rels.opt = 1; });
    this.catChips.forEach(function (b) { b.style.display = cats[b._val] ? '' : 'none'; });
    this.relChips.forEach(function (b) { b.style.display = rels[b._val] ? '' : 'none'; });
  };

  /* ---------------- геометрия ---------------- */
  P.rowY = function (n, i) { return n.y + HEAD + n.sub + i * ROW + ROW / 2 + 1; };
  P.toWorld = function (px, py) { return { x: (px - this.tx) / this.k, y: (py - this.ty) / this.k }; };
  // Границы схемы: таблицы и петли связей, которые выходят сбоку от таблиц
  P.bbox = function () {
    var x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9, self = this;
    this.nodes.forEach(function (n) { x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y); x2 = Math.max(x2, n.x + n.w); y2 = Math.max(y2, n.y + n.h); });
    if (!this.nodes.length) return { x: 0, y: 0, w: 1, h: 1 };
    this.edges.forEach(function (e) {
      var p = self.edgePath(e);
      if (p.sa !== p.sb) return;
      var reach = Math.abs(p.c1x - p.x1) * 0.78;   // кривая не доходит до контрольных точек
      if (p.sa > 0) x2 = Math.max(x2, Math.max(p.x1, p.x2) + reach); else x1 = Math.min(x1, Math.min(p.x1, p.x2) - reach);
    });
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
  };
  // Показать всю схему целиком
  P.fit = function () {
    var b = this.bbox(), W = this.W || 800, pd = this.pad(), m = pd.m, H = (this.H || 500) - (pd.b - m);
    var k = Math.min((W - 2 * m) / b.w, (H - 2 * m) / b.h);
    this.k = Math.max(0.25, Math.min(1.15, k));
    this.tx = (W - b.w * this.k) / 2 - b.x * this.k;
    this.ty = (H - b.h * this.k) / 2 - b.y * this.k;
    this.syncBar(); this.invalidate();
  };
  // Исходный вид: вся схема, если она при этом читается; иначе — читаемый масштаб от верхнего края
  P.home = function () {
    var b = this.bbox(), W = this.W || 800, pd = this.pad(), m = pd.m, H = (this.H || 500) - (pd.b - m), min = this.minScale();
    var sw = (W - 2 * m) / b.w, s = Math.min(sw, (H - 2 * m) / b.h);
    if (s >= min) { this.fit(); return; }
    var k = this.k = Math.max(min, Math.min(1, sw));
    this.tx = b.w * k <= W - 2 * m ? (W - b.w * k) / 2 - b.x * k : m - b.x * k;
    this.ty = m - b.y * k;
    this.syncBar(); this.invalidate();
  };
  P.zoomBy = function (f, cx, cy) {
    if (cx === undefined) { cx = this.W / 2; cy = this.H / 2; }
    var k = Math.max(0.25, Math.min(2.2, this.k * f)), w = this.toWorld(cx, cy);
    this.k = k; this.tx = cx - w.x * k; this.ty = cy - w.y * k;
    this.syncBar(); this.invalidate();
  };
  // Концы линии связи: от столбца-ссылки к ключу; стороны выбираются по взаимному положению таблиц
  P.edgePath = function (e) {
    var a = e.from, b = e.to, y1 = this.rowY(a, e.fi), y2 = this.rowY(b, e.ti), sa, sb;
    if (a === b) { sa = 1; sb = 1; }
    else if (b.x >= a.x + a.w - 10) { sa = 1; sb = -1; }
    else if (b.x + b.w <= a.x + 10) { sa = -1; sb = 1; }
    else { sa = sb = (b.x + b.w / 2 >= a.x + a.w / 2) ? 1 : -1; }
    var x1 = sa > 0 ? a.x + a.w : a.x, x2 = sb > 0 ? b.x + b.w : b.x;
    var d = a === b ? 54 : (sa === sb ? 60 + Math.min(60, Math.abs(y2 - y1) / 6) : Math.max(46, Math.abs(x2 - x1) / 2));
    return { x1: x1, y1: y1, x2: x2, y2: y2, sa: sa, sb: sb, c1x: x1 + sa * d, c2x: x2 + sb * d };
  };
  function bez(p, t) {
    var u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return { x: a * p.x1 + b * p.c1x + c * p.c2x + d * p.x2, y: a * p.y1 + b * p.y1 + c * p.y2 + d * p.y2 };
  }
  // Что находится в точке (в координатах схемы)
  P.hit = function (wx, wy) {
    var i, n;
    for (i = this.nodes.length - 1; i >= 0; i--) {
      n = this.nodes[i];
      if (wx < n.x || wx > n.x + n.w || wy < n.y || wy > n.y + n.h) continue;
      if (wy < n.y + HEAD) return { node: n, part: wx > n.x + n.w - 32 ? 'preview' : 'head' };
      var ri = Math.floor((wy - n.y - HEAD - n.sub) / ROW);
      if (wy >= n.y + HEAD + n.sub && ri >= 0 && ri < n.rows.length) return { node: n, part: 'row', row: ri };
      return { node: n, part: 'head' };
    }
    var tol = 7 / this.k, best = null, bd = tol * tol;
    for (i = 0; i < this.edges.length; i++) {
      var p = this.edgePath(this.edges[i]);
      for (var s = 0; s <= 26; s++) {
        var q = bez(p, s / 26), dx = q.x - wx, dy = q.y - wy, dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; best = this.edges[i]; }
      }
    }
    return best ? { edge: best } : null;
  };

  /* ---------------- рисование ---------------- */
  P.colors = function () {
    var cs = getComputedStyle(document.documentElement), dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var v = function (name, def) { var x = cs.getPropertyValue(name).trim(); return x || def; };
    var c = {
      dark: dark, text: v('--text', '#121a2e'), muted: v('--muted', '#5d6680'), faint: v('--faint', '#98a0b5'),
      primary: v('--primary', '#4f46e5'), xp: v('--xp', '#e8890c'),
      card: dark ? 'rgba(28, 35, 60, .96)' : 'rgba(255, 255, 255, .97)',
      head: dark ? 'rgba(143, 140, 255, .20)' : 'rgba(79, 70, 229, .10)',
      headOn: dark ? 'rgba(143, 140, 255, .38)' : 'rgba(79, 70, 229, .20)',
      line: dark ? 'rgba(255, 255, 255, .10)' : 'rgba(20, 30, 60, .09)',
      border: dark ? 'rgba(255, 255, 255, .16)' : 'rgba(20, 30, 60, .16)',
      rowOn: dark ? 'rgba(143, 140, 255, .20)' : 'rgba(79, 70, 229, .10)',
      shadow: dark ? 'rgba(0, 0, 0, .55)' : 'rgba(30, 40, 90, .20)',
      dot: dark ? 'rgba(255, 255, 255, .06)' : 'rgba(20, 30, 60, .07)',
      cat: {}, rel: {}
    };
    // цвета типов и связей — из css/app.css (--cat-*, --rel-*); запасные значения — на случай старых стилей
    CATS.forEach(function (x) { c.cat[x[0]] = v('--cat-' + x[0], dark ? x[3] : x[2]); });
    RELS.forEach(function (x) { if (x[3]) c.rel[x[0]] = v('--rel-' + x[0], dark ? x[4] : x[3]); });
    return c;
  };
  P.invalidate = function () {
    var self = this;
    if (this.raf) return;
    this.raf = requestAnimationFrame(function () { self.raf = 0; self.paint(); });
  };
  // Что подсвечивать: возвращает { nodes: {имя:1}, edges: [..], rows: {'таблица.столбец':1} } или null
  P.focus = function () {
    var self = this, lg = this.legend, f = { nodes: {}, edges: [], rows: {} }, any = false;
    function addEdge(e) { if (f.edges.indexOf(e) < 0) f.edges.push(e); f.nodes[e.from.name] = 1; f.nodes[e.to.name] = 1; f.rows[e.from.name + '.' + e.fi] = 1; f.rows[e.to.name + '.' + e.ti] = 1; any = true; }
    function addNode(n) { f.nodes[n.name] = 1; any = true; self.edges.forEach(function (e) { if (e.from === n || e.to === n) addEdge(e); }); }
    if (lg && lg.rel) { this.edges.forEach(function (e) { if (lg.rel === 'opt' ? e.opt : e.kind === lg.rel) addEdge(e); }); return { nodes: f.nodes, edges: f.edges, rows: f.rows, strict: true }; }
    if (lg && lg.cat) return { cat: lg.cat };
    var hv = this.hover;
    if (hv && hv.edge) addEdge(hv.edge);
    else if (hv && hv.node) {
      var row = hv.part === 'row' ? hv.node.rows[hv.row] : null;
      // столбец-ссылка или ключ под курсором — показываем именно его связи
      if (row) this.edges.forEach(function (e) { if ((e.from === hv.node && e.fi === hv.row) || (e.to === hv.node && e.ti === hv.row)) addEdge(e); });
      if (!any) addNode(hv.node);
    } else if (this.pin) addNode(this.pin);
    return any ? f : null;
  };
  P.paint = function () {
    var ctx = this.ctx, dpr = this.dpr || 1, W = this.W, H = this.H, k = this.k, self = this;
    if (!W || !H) return;
    var C = this.C || (this.C = this.colors()), f = this.focus();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // фон-сетка из точек: движется и масштабируется вместе со схемой
    var step = 26 * k; while (step < 14) step *= 2;
    ctx.fillStyle = C.dot;
    var ox = ((this.tx % step) + step) % step, oy = ((this.ty % step) + step) % step;
    for (var gx = ox; gx < W; gx += step) for (var gy = oy; gy < H; gy += step) ctx.fillRect(gx - 1, gy - 1, 2, 2);
    ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * this.tx, dpr * this.ty);

    // --- связи
    var front = [];
    this.edges.forEach(function (e) {
      var on = f && f.edges && f.edges.indexOf(e) >= 0;
      if (on && !f.strict) front.push(e);
      else self.paintEdge(e, C, on ? 1 : (f && !f.cat ? 0.16 : (f && f.cat ? 0.3 : 0.62)), on);
    });
    // --- таблицы
    this.nodes.forEach(function (n) { self.paintNode(n, C, f); });
    // связи таблицы под курсором — поверх таблиц, чтобы линия была видна целиком
    // (при подсветке из легенды линий много, они остаются под таблицами)
    front.forEach(function (e) { self.paintEdge(e, C, 1, true); });
  };
  P.paintEdge = function (e, C, alpha, on) {
    var ctx = this.ctx, p = this.edgePath(e), col = C.rel[e.kind] || C.primary;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = col; ctx.fillStyle = col;
    ctx.lineWidth = on ? 2.4 : 1.5;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (on) { ctx.shadowColor = col; ctx.shadowBlur = 10; }
    if (e.opt) ctx.setLineDash([6, 5]);
    var m = 15;   // место под значки на концах
    ctx.beginPath();
    ctx.moveTo(p.x1 + p.sa * m, p.y1);
    ctx.bezierCurveTo(p.c1x, p.y1, p.c2x, p.y2, p.x2 + p.sb * m, p.y2);
    ctx.stroke();
    ctx.setLineDash([]); ctx.shadowBlur = 0;
    // конец у подчинённой таблицы: «воронья лапка» (много) или черта (один)
    ctx.beginPath();
    if (e.kind === 'one') { ctx.moveTo(p.x1, p.y1); ctx.lineTo(p.x1 + p.sa * m, p.y1); ctx.moveTo(p.x1 + p.sa * 8, p.y1 - 6); ctx.lineTo(p.x1 + p.sa * 8, p.y1 + 6); }
    else { ctx.moveTo(p.x1 + p.sa * m, p.y1); ctx.lineTo(p.x1, p.y1 - 6.5); ctx.moveTo(p.x1 + p.sa * m, p.y1); ctx.lineTo(p.x1, p.y1); ctx.moveTo(p.x1 + p.sa * m, p.y1); ctx.lineTo(p.x1, p.y1 + 6.5); }
    // конец у главной таблицы: черта (ровно один), для необязательной связи — кружок (ноль или один)
    ctx.moveTo(p.x2, p.y2); ctx.lineTo(p.x2 + p.sb * m, p.y2);
    ctx.moveTo(p.x2 + p.sb * 6, p.y2 - 6); ctx.lineTo(p.x2 + p.sb * 6, p.y2 + 6);
    ctx.stroke();
    if (e.opt) {
      ctx.beginPath(); ctx.arc(p.x2 + p.sb * 12, p.y2, 3.6, 0, Math.PI * 2);
      ctx.fillStyle = C.dark ? '#161c31' : '#ffffff'; ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  };
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
  function clipText(ctx, text, max) {
    if (ctx.measureText(text).width <= max) return text;
    while (text.length > 1 && ctx.measureText(text + '…').width > max) text = text.slice(0, -1);
    return text + '…';
  }
  P.paintNode = function (n, C, f) {
    var ctx = this.ctx, hv = this.hover, isHover = hv && hv.node === n, isPin = this.pin === n;
    var dim = f && !f.cat && !f.nodes[n.name];
    ctx.save();
    ctx.globalAlpha = dim ? 0.3 : 1;
    // карточка с тенью
    ctx.shadowColor = C.shadow; ctx.shadowBlur = isHover || isPin ? 26 : 16; ctx.shadowOffsetY = isHover || isPin ? 10 : 6;
    rr(ctx, n.x, n.y, n.w, n.h, RADIUS); ctx.fillStyle = C.card; ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    // шапка
    ctx.save();
    rr(ctx, n.x, n.y, n.w, n.h, RADIUS); ctx.clip();
    ctx.fillStyle = isPin || (f && f.nodes && f.nodes[n.name]) ? C.headOn : C.head;
    ctx.fillRect(n.x, n.y, n.w, HEAD);
    ctx.restore();
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = '700 13px ' + FONT_MONO; ctx.fillStyle = C.text;
    ctx.fillText(clipText(ctx, n.name, n.w - 2 * PAD - 26), n.x + PAD, n.y + HEAD / 2 + 1);
    // значок «показать данные» справа в шапке
    var ix = n.x + n.w - 26, iy = n.y + 9, pv = isHover && hv.part === 'preview';
    ctx.strokeStyle = pv ? C.primary : C.muted; ctx.lineWidth = 1.4; ctx.globalAlpha = (dim ? 0.3 : 1) * (pv ? 1 : 0.75);
    rr(ctx, ix, iy, 15, 13, 3); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ix, iy + 4.5); ctx.lineTo(ix + 15, iy + 4.5); ctx.moveTo(ix, iy + 8.8); ctx.lineTo(ix + 15, iy + 8.8); ctx.moveTo(ix + 5.5, iy + 4.5); ctx.lineTo(ix + 5.5, iy + 13); ctx.stroke();
    ctx.globalAlpha = dim ? 0.3 : 1;
    // подпись таблицы
    var y0 = n.y + HEAD;
    if (n.sub) {
      ctx.font = '11.5px ' + FONT_SANS; ctx.fillStyle = C.muted;
      var cnt = n.t.rowCount !== undefined ? ' · ' + n.t.rowCount + ' стр.' : '';
      ctx.fillText(clipText(ctx, (n.t.title || '') + cnt, n.w - 2 * PAD), n.x + PAD, y0 + SUB / 2 + 1);
      y0 += SUB;
      ctx.fillStyle = C.line; ctx.fillRect(n.x, y0 - 0.5, n.w, 1);
    }
    // столбцы
    for (var i = 0; i < n.rows.length; i++) {
      var r = n.rows[i], ry = y0 + i * ROW, mid = ry + ROW / 2 + 1;
      var rowOn = (f && f.rows && f.rows[n.name + '.' + i]) || (isHover && hv.part === 'row' && hv.row === i);
      var catOn = f && f.cat ? r.cat === f.cat : null;
      if (rowOn || catOn) { ctx.fillStyle = catOn ? hexA(C.cat[r.cat], C.dark ? 0.24 : 0.14) : C.rowOn; ctx.fillRect(n.x + 1, ry + 1, n.w - 2, ROW - 1); }
      if (i) { ctx.fillStyle = C.line; ctx.fillRect(n.x + PAD, ry, n.w - 2 * PAD, 1); }
      ctx.globalAlpha = (dim ? 0.3 : 1) * (catOn === false ? 0.32 : 1);
      var tx = n.x + PAD;
      if (r.pk || r.fk) {   // значок PK / FK
        var bc = r.pk ? C.xp : C.primary;
        rr(ctx, tx, mid - 7, 20, 14, 4); ctx.fillStyle = hexA(bc, C.dark ? 0.24 : 0.14); ctx.fill();
        ctx.font = '700 8.5px ' + FONT_SANS; ctx.fillStyle = bc; ctx.textAlign = 'center';
        ctx.fillText(r.pk ? 'PK' : 'FK', tx + 10, mid + 0.5);
        ctx.textAlign = 'left'; tx += 25;
      }
      ctx.font = (r.pk ? '700 ' : '') + '12px ' + FONT_MONO;
      ctx.fillStyle = r.fk && !r.pk ? C.primary : C.text;
      ctx.fillText(clipText(ctx, r.name, n.w - (tx - n.x) - PAD - r.tw - 12), tx, mid);
      ctx.font = '12px ' + FONT_MONO; ctx.fillStyle = C.cat[r.cat]; ctx.textAlign = 'right';
      ctx.fillText(r.type, n.x + n.w - PAD, mid);
      ctx.textAlign = 'left';
      ctx.globalAlpha = dim ? 0.3 : 1;
    }
    // рамка
    rr(ctx, n.x, n.y, n.w, n.h, RADIUS);
    ctx.lineWidth = isPin ? 2 : 1; ctx.strokeStyle = isPin || isHover ? C.primary : C.border;
    ctx.globalAlpha = (dim ? 0.3 : 1) * (isPin || isHover ? 0.95 : 1);
    ctx.stroke();
    ctx.restore();
  };
  // цвет вида #rrggbb или rgb(...) с прозрачностью
  function hexA(c, a) {
    c = String(c || '#888').trim();
    var m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) { var x = parseInt(m[1], 16); return 'rgba(' + (x >> 16) + ',' + ((x >> 8) & 255) + ',' + (x & 255) + ',' + a + ')'; }
    m = /^#([0-9a-f]{3})$/i.exec(c);
    if (m) { var s = m[1]; return 'rgba(' + parseInt(s[0] + s[0], 16) + ',' + parseInt(s[1] + s[1], 16) + ',' + parseInt(s[2] + s[2], 16) + ',' + a + ')'; }
    m = /^rgba?\(([^)]+)\)$/i.exec(c);
    if (m) { var p = m[1].split(','); return 'rgba(' + p[0].trim() + ',' + p[1].trim() + ',' + p[2].trim() + ',' + a + ')'; }
    return c;
  }

  /* ---------------- размер ---------------- */
  // Высота области схемы: до нижнего края окна (на странице «Схема»); в окне — как задано стилями
  P.fitHeight = function () {
    if (this.o.fixedHeight || (this.el.closest && this.el.closest('.modal'))) return;
    var top = this.stage.getBoundingClientRect().top + (window.pageYOffset || 0);
    var bottom = window.innerWidth < 1024 ? 100 : 44;   // нижняя панель на телефоне, подсказка под схемой на компьютере
    // на компьютере — не ниже 600 px: на невысоком экране схему лучше немного прокрутить, чем мельчить
    var hgt = Math.round(Math.max(window.innerWidth >= 1024 ? 600 : 420, Math.min(960, window.innerHeight - top - bottom)));
    if (window.innerWidth < 768) hgt = Math.max(360, Math.min(hgt, 640));
    this.stage.style.height = hgt + 'px';
  };
  P.resize = function () {
    if (!this.W) this.fitHeight();
    var r = this.stage.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5), first = !this.W;
    var W = Math.round(r.width), H = Math.round(r.height);
    if (W !== this.W || H !== this.H || dpr !== this.dpr) {
      // при изменении размера окна схема остаётся на месте относительно центра
      if (!first) { this.tx += (W - this.W) / 2; this.ty += (H - this.H) / 2; }
      this.W = W; this.H = H; this.dpr = dpr;
      this.canvas.width = Math.round(W * dpr); this.canvas.height = Math.round(H * dpr);
    }
    if (first) { this.arrange(true); this.home(); } else this.invalidate();
    return true;
  };
  // совместимость с прежним вызовом: draw() — пересчитать размер и нарисовать
  P.draw = function () { this.C = null; if (!this.resize()) this.invalidate(); this.syncBar(); };

  /* ---------------- подсказка ---------------- */
  P.showTip = function (hv, px, py) {
    var tip = this.tip, n = hv && hv.node;
    U.clear(tip);
    if (hv && hv.edge) {
      var e = hv.edge;
      tip.appendChild(h('b', e.label));
      tip.appendChild(h('div', REL_TEXT[e.kind] + (e.opt ? ', необязательная' : '')));
      tip.appendChild(h('div.erdc-tip-m', e.kind === 'self' ? 'Строка «' + e.from.name + '» ссылается на другую строку этой же таблицы.' : (e.kind === 'one' ? 'Одной строке «' + e.to.name + '» соответствует не больше одной строки «' + e.from.name + '».' : 'Одной строке «' + e.to.name + '» соответствует много строк «' + e.from.name + '».') + (e.opt ? ' В столбце ' + e.from.rows[e.fi].name + ' бывает NULL.' : '')));
    } else if (n && hv.part === 'row') {
      var r = n.rows[hv.row];
      tip.appendChild(h('div', h('b', r.name), ' ', h('span.erdc-tip-t', { 'data-cat': r.cat }, r.type), r.pk ? h('span.erdc-tip-k', 'первичный ключ') : null));
      if (r.desc) tip.appendChild(h('div', r.desc));
      if (r.fk) tip.appendChild(h('div.erdc-tip-m', 'Ссылается на ' + r.fk));
    } else if (n && hv.part === 'preview') tip.appendChild(h('div', 'Показать данные таблицы'));
    if (!tip.firstChild) { tip.style.display = 'none'; return; }
    tip.style.display = 'block';
    var tw = tip.offsetWidth, th = tip.offsetHeight, x, y;
    if (n) {
      // подсказка к столбцу — сбоку от таблицы, чтобы не закрывать её
      var left = n.x * this.k + this.tx, right = (n.x + n.w) * this.k + this.tx;
      x = right + 10; if (x + tw > this.W - 6) x = left - tw - 10;
      if (x < 6) x = Math.min(this.W - tw - 6, px + 16);
      y = py - th / 2;
    } else { x = px + 16; y = py + 16; if (x + tw > this.W - 6) x = px - tw - 12; }
    x = Math.max(6, Math.min(this.W - tw - 6, x)); y = Math.max(6, Math.min(this.H - th - 6, y));
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  };
  P.hideTip = function () { this.tip.style.display = 'none'; };
  P.preview = function (n) {
    var pv = A.tablePreview(this.pack, n.name);
    U.modal(pv.title, pv.table);
  };

  /* ---------------- события ---------------- */
  P.bind = function () {
    var self = this, cv = this.canvas;
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    function sameHover(a, b) { return (!a && !b) || (a && b && a.node === b.node && a.edge === b.edge && a.part === b.part && a.row === b.row); }

    cv.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var p = pos(e), w = self.toWorld(p.x, p.y);
      self.pointers[e.pointerId] = p;
      try { cv.setPointerCapture(e.pointerId); } catch (er) { }
      var ids = Object.keys(self.pointers);
      if (ids.length === 2) {   // два пальца — масштаб
        var a = self.pointers[ids[0]], b = self.pointers[ids[1]];
        self.drag = { pinch: true, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, k0: self.k, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, w0: self.toWorld((a.x + b.x) / 2, (a.y + b.y) / 2) };
        self.hideTip(); return;
      }
      var hit = self.hit(w.x, w.y);
      self.drag = { hit: hit, x0: p.x, y0: p.y, moved: false, tx0: self.tx, ty0: self.ty };
      if (hit && hit.node) {
        self.drag.nx0 = hit.node.x; self.drag.ny0 = hit.node.y;
        // взятая таблица — поверх остальных
        var i = self.nodes.indexOf(hit.node); self.nodes.splice(i, 1); self.nodes.push(hit.node);
      }
      self.hideTip();
      e.preventDefault();
    });
    cv.addEventListener('pointermove', function (e) {
      var p = pos(e), d = self.drag;
      if (self.pointers[e.pointerId]) self.pointers[e.pointerId] = p;
      if (d && d.pinch) {
        var ids = Object.keys(self.pointers); if (ids.length < 2) return;
        var a = self.pointers[ids[0]], b = self.pointers[ids[1]], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        var k = Math.max(0.25, Math.min(2.2, d.k0 * Math.hypot(a.x - b.x, a.y - b.y) / d.d0));
        self.k = k; self.tx = mid.x - d.w0.x * k; self.ty = mid.y - d.w0.y * k;
        self.syncBar(); self.invalidate(); return;
      }
      if (d) {
        var dx = p.x - d.x0, dy = p.y - d.y0;
        if (!d.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
        d.moved = true;
        if (d.hit && d.hit.node) { d.hit.node.x = d.nx0 + dx / self.k; d.hit.node.y = d.ny0 + dy / self.k; cv.style.cursor = 'grabbing'; }
        else { self.tx = d.tx0 + dx; self.ty = d.ty0 + dy; cv.style.cursor = 'grabbing'; }
        self.invalidate(); return;
      }
      if (e.pointerType === 'touch') return;
      var w = self.toWorld(p.x, p.y), hv = self.hit(w.x, w.y);
      if (!sameHover(hv, self.hover)) { self.hover = hv; self.invalidate(); }
      cv.style.cursor = !hv ? 'grab' : (hv.edge || hv.part === 'preview' ? 'pointer' : 'move');
      self.showTip(hv, p.x, p.y);
    });
    function end(e) {
      var d = self.drag, had = self.pointers[e.pointerId];
      delete self.pointers[e.pointerId];
      try { cv.releasePointerCapture(e.pointerId); } catch (er) { }
      if (!d || !had) return;
      if (d.pinch) { if (Object.keys(self.pointers).length < 2) self.drag = null; return; }
      self.drag = null;
      cv.style.cursor = '';
      if (d.moved) { if (d.hit && d.hit.node) self.savePos(); self.invalidate(); return; }
      if (e.type === 'pointercancel') return;
      // щелчок без перетаскивания
      var hit = d.hit;
      if (hit && hit.node && hit.part === 'preview') { self.preview(hit.node); return; }
      if (hit && hit.node) {
        var now = Date.now();
        if (self.lastTap && self.lastTap.n === hit.node && now - self.lastTap.at < 380) { self.lastTap = null; self.preview(hit.node); return; }
        self.lastTap = { n: hit.node, at: now };
        self.pin = self.pin === hit.node ? null : hit.node;
      } else if (hit && hit.edge) {
        self.pin = null; self.hover = hit;
        if (e.pointerType === 'touch') { var p = pos(e); self.showTip(hit, p.x, p.y); }
      } else { self.pin = null; if (e.pointerType === 'touch') { self.hover = null; self.hideTip(); } }
      // на телефоне наведения нет — касание таблицы показывает её связи
      if (e.pointerType === 'touch' && hit && hit.node) { self.hover = null; var p2 = pos(e); if (hit.part === 'row') self.showTip(hit, p2.x, p2.y); else self.hideTip(); }
      self.invalidate();
    }
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', function (e) { if (e.pointerType === 'touch' || self.drag) return; if (self.hover) { self.hover = null; self.invalidate(); } self.hideTip(); });
    cv.addEventListener('wheel', function (e) {
      if (!(e.ctrlKey || e.metaKey)) return;   // без Ctrl колесо прокручивает страницу
      e.preventDefault();
      var p = pos(e);
      self.zoomBy(Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.0022)), p.x, p.y);
    }, { passive: false });
    cv.addEventListener('dblclick', function (e) { var p = pos(e), w = self.toWorld(p.x, p.y); if (!self.hit(w.x, w.y)) self.fit(); });

    // размер области и смена темы
    if (window.ResizeObserver) { this.ro = new ResizeObserver(function () { self.resize(); }); this.ro.observe(this.stage); }
    this.onWin = U.debounce(function () { if (!document.body.contains(self.el)) { self.destroy(); return; } self.fitHeight(); self.resize(); }, 120);
    window.addEventListener('resize', this.onWin);
    this.mo = new MutationObserver(function () { if (!document.body.contains(self.el)) { self.destroy(); return; } self.C = null; self.invalidate(); });
    this.mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  };
  P.destroy = function () {
    if (this.ro) this.ro.disconnect();
    if (this.mo) this.mo.disconnect();
    window.removeEventListener('resize', this.onWin);
    if (this.raf) cancelAnimationFrame(this.raf);
  };

  // Схема связей базы: { el, draw(), view }
  A.erd = function (pack, opts) {
    var v = new Erd(pack, opts);
    G.__erdLast = v;   // последняя созданная схема — для отладки и проверок
    return { el: v.el, draw: function () { v.draw(); }, view: v };
  };
  G.Erd = Erd;
})(window);
