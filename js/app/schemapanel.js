/* ============================================================
   Панель схемы рядом с редактором: таблицы, столбцы, связи,
   поиск, вставка имён в запрос, просмотр данных, схема связей.
   ============================================================ */
(function (G) {
  'use strict';
  var U = G.U, h = U.h, A = G.App, Grid = G.Grid;
  var SP = G.SchemaPanel = {};
  var openState = {};   // какие таблицы раскрыты (на время сеанса, по базе)

  function fkMap(pack) {
    var m = {};
    (pack.relations || []).forEach(function (r) { m[r[0].toLowerCase()] = r[1]; });
    return m;
  }
  function isPk(pack, t, c) { return (pack.pks && (pack.pks[t.name] || '').toLowerCase()) === c.toLowerCase(); }

  /* --- Просмотр первых строк таблицы --- */
  A.tablePreview = function (pack, name) {
    var r = A.runSQL('SELECT TOP (20) * FROM ' + name + ';', { trace: false, pack: pack.id });
    var cnt = A.runSQL('SELECT COUNT(*) FROM ' + name + ';', { trace: false, pack: pack.id });
    var rs = r.results[0];
    var total = cnt.results[0] ? cnt.results[0].rows[0][0] : '?';
    return { title: pack.dbName + '.dbo.' + name + ' — первые ' + Math.min(20, rs ? rs.rows.length : 0) + ' из ' + total + ' строк', table: rs ? Grid.table(rs.columns, rs.rows, rs.kinds) : h('p.muted', 'Нет данных') };
  };

  /* --- Схема связей (ERD): общая для страницы «Схема» и окна из задания --- */
  A.erd = function (pack) {
    var tables = pack.tables;
    var ncol = tables.length > 9 ? 4 : (tables.length <= 4 ? Math.max(2, Math.min(3, tables.length)) : 3);
    var wrap = h('div.erd', { style: { gridTemplateColumns: 'repeat(' + ncol + ', minmax(230px, 1fr))' } });
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'erd-lines');
    wrap.appendChild(svg);
    var fks = fkMap(pack), lay = pack.layout || {};
    tables.forEach(function (t, i) {
      var p = lay[t.name] || [i % ncol, Math.floor(i / ncol)];
      var b = h('div.erd-t', { style: { gridColumn: (p[0] + 1), gridRow: (p[1] + 1) } },
        h('div.erd-h', h('b', t.name), h('button.icon-btn.small', { title: 'Показать данные', onclick: function () { var pv = A.tablePreview(pack, t.name); U.modal(pv.title, pv.table); } }, G.Icon('table', 16))),
        h('div.erd-sub', (t.title || '') + (t.rowCount !== undefined ? ' · ' + t.rowCount + ' стр.' : '')));
      t.cols.forEach(function (c) {
        var key = (t.name + '.' + c[0]).toLowerCase();
        var pk = isPk(pack, t, c[0]), fk = !!fks[key];
        b.appendChild(h('div.erd-c' + (pk ? '.pk' : '') + (fk ? '.fk' : ''), { 'data-k': key, title: c[2] + (fk ? ' → ' + fks[key] : '') }, h('span.erd-cn', pk ? G.Icon('key', 13) : fk ? G.Icon('link', 13) : null, c[0]), h('span.muted', c[1])));
      });
      wrap.appendChild(b);
    });
    function draw() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var wr = wrap.getBoundingClientRect();
      if (!wr.width) return;
      svg.setAttribute('width', wr.width); svg.setAttribute('height', wr.height);
      (pack.relations || []).forEach(function (r, i) {
        var a = U.qs('[data-k="' + r[0].toLowerCase() + '"]', wrap), b = U.qs('[data-k="' + r[1].toLowerCase() + '"]', wrap);
        if (!a || !b) return;
        var ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        var sameCol = ra.left < rb.right && rb.left < ra.right;
        var ax, bx, c1, c2;
        if (sameCol) { ax = ra.right - wr.left; bx = rb.right - wr.left; c1 = Math.max(ax, bx) + 34 + (i % 3) * 10; c2 = c1; }
        else if (ra.left < rb.left) { ax = ra.right - wr.left; bx = rb.left - wr.left; var d1 = Math.max(30, (bx - ax) / 2); c1 = ax + d1; c2 = bx - d1; }
        else { ax = ra.left - wr.left; bx = rb.right - wr.left; var d2 = Math.max(30, (ax - bx) / 2); c1 = ax - d2; c2 = bx + d2; }
        var ay = ra.top + ra.height / 2 - wr.top, by = rb.top + rb.height / 2 - wr.top;
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', 'M' + ax + ',' + ay + ' C' + c1 + ',' + ay + ' ' + c2 + ',' + by + ' ' + bx + ',' + by);
        path.setAttribute('class', 'erd-path');
        svg.appendChild(path);
        var dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('cx', bx); dot.setAttribute('cy', by); dot.setAttribute('r', 3.5); dot.setAttribute('class', 'erd-dot'); svg.appendChild(dot);
      });
    }
    return { el: wrap, draw: draw };
  };
  // Схема связей в большом окне — не уходя со страницы задания
  // Схема базы в шторке снизу (телефон): нажатие на имя вставляет его в запрос
  A.schemaSheet = function (pack, onPick) {
    var m;
    var panel = G.SchemaPanel.create(pack, {
      onPick: function (text) { onPick(text); U.toast('Вставлено: <b>' + U.esc(text) + '</b>', 'ok', 1200); },
      onPreview: function (name) { var pv = A.tablePreview(pack, name); m.close(); U.modal(pv.title, pv.table); }
    });
    panel.el.classList.add('sp-sheet');
    m = U.modal('Схема базы ' + pack.dbName, panel.el, [{ text: 'Готово', primary: true }]);
    return m;
  };
  A.showErd = function (pack) {
    var e = A.erd(pack);
    var md = U.modal('Схема базы ' + pack.dbName + ': ' + pack.title, h('div.erd-modal', e.el));
    md.el.classList.add('wide');
    setTimeout(e.draw, 40);
    var onR = U.debounce(e.draw, 100);
    window.addEventListener('resize', onR);
    var mo = new MutationObserver(function () { if (!document.body.contains(md.el)) { window.removeEventListener('resize', onR); mo.disconnect(); } });
    mo.observe(document.body, { childList: true });
  };

  /* --- Панель схемы ---
     opts: { onPick(text), onPreview(name) — если не задан, данные открываются в окне, title } */
  SP.create = function (pack, opts) {
    opts = opts || {};
    var fks = fkMap(pack);
    var st = openState[pack.id] || (openState[pack.id] = {});
    var box = h('div.sp');
    var search = h('input.inp.sp-search', { type: 'search', placeholder: 'Найти таблицу или столбец…' });
    box.appendChild(h('div.sp-head',
      h('div.sp-title', G.Icon.pack(pack, 'sm'), h('span', opts.title || pack.dbName)),
      h('button.btn.small.ghost', { title: 'Схема связей между таблицами', onclick: function () { A.showErd(pack); } }, G.Icon('expand', 15), 'Связи')));
    box.appendChild(search);
    box.appendChild(h('div.sp-hint', 'Нажмите на имя — оно вставится в запрос'));
    var list = h('div.sp-list');
    box.appendChild(list);
    var blocks = {};
    function pick(text) { if (opts.onPick) opts.onPick(text); }
    function preview(name) {
      if (opts.onPreview) opts.onPreview(name);
      else { var pv = A.tablePreview(pack, name); U.modal(pv.title, pv.table); }
    }
    function focusTable(name) {
      var b = blocks[name.toLowerCase()];
      if (!b) return;
      b.open = true; st[name.toLowerCase()] = true;
      b.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      b.classList.add('flash'); setTimeout(function () { b.classList.remove('flash'); }, 900);
    }
    pack.tables.forEach(function (t) {
      var d = h('details.sp-t');
      if (st[t.name.toLowerCase()]) d.open = true;
      d.addEventListener('toggle', function () { st[t.name.toLowerCase()] = d.open; });
      d.appendChild(h('summary',
        h('span.sp-tn', { title: 'Вставить имя таблицы', onclick: function (e) { e.preventDefault(); e.stopPropagation(); pick(t.name); } }, t.name),
        h('span.sp-cnt', t.rowCount !== undefined ? String(t.rowCount) : ''),
        h('button.icon-btn.small.sp-pv', { title: 'Первые 20 строк', onclick: function (e) { e.preventDefault(); e.stopPropagation(); preview(t.name); } }, G.Icon('table', 16))));
      if (t.title) d.appendChild(h('div.sp-tt', t.title));
      t.cols.forEach(function (c) {
        var key = (t.name + '.' + c[0]).toLowerCase(), fk = fks[key], pk = isPk(pack, t, c[0]);
        var row = h('div.sp-c', { title: c[2] + (fk ? '\nСсылается на ' + fk : '') },
          h('div.sp-c1',
            h('span.sp-cn' + (pk ? '.pk' : '') + (fk ? '.fk' : ''), { onclick: function () { pick(c[0]); } }, pk ? G.Icon('key', 12) : null, c[0]),
            h('span.sp-ct', c[1])),
          c[2] || fk ? h('div.sp-cd', fk ? h('a', { href: '#', onclick: function (e) { e.preventDefault(); focusTable(fk.split('.')[0]); } }, '→ ' + fk) : null, fk && c[2] ? ' · ' : null, c[2] || '') : null);
        row.setAttribute('data-s', (c[0] + ' ' + (c[2] || '')).toLowerCase());
        d.appendChild(row);
      });
      d.setAttribute('data-s', (t.name + ' ' + (t.title || '')).toLowerCase());
      blocks[t.name.toLowerCase()] = d;
      list.appendChild(d);
    });
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      pack.tables.forEach(function (t) {
        var d = blocks[t.name.toLowerCase()];
        if (!q) { d.style.display = ''; U.qsa('.sp-c', d).forEach(function (r) { r.style.display = ''; r.classList.remove('hit'); }); d.open = !!st[t.name.toLowerCase()]; return; }
        var tHit = d.getAttribute('data-s').indexOf(q) >= 0, any = false;
        U.qsa('.sp-c', d).forEach(function (r) { var hit = r.getAttribute('data-s').indexOf(q) >= 0; r.classList.toggle('hit', hit); r.style.display = hit || tHit ? '' : 'none'; if (hit) any = true; });
        d.style.display = tHit || any ? '' : 'none';
        d.open = tHit || any;
      });
    });
    return { el: box, focusTable: focusTable };
  };
})(window);
