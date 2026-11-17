/* ============================================================
   Панель схемы рядом с редактором: таблицы, столбцы, связи,
   поиск, вставка имён в запрос, просмотр данных, схема связей.
   ============================================================ */
(function (G) {
  'use strict';
  var U = G.U, h = U.h, A = G.App, Grid = G.Grid, T = G.TSQL;
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
    // имя — в квадратных скобках: таблица может называться зарезервированным словом (Order, User, Group…).
    // Это служебные запросы, поэтому в статистику запусков ученика они не попадают.
    var xo = A.execOpts(pack.id), db = A.dbFor(pack.id), q = '[' + String(name).replace(/[\[\]]/g, '') + ']';
    var r = T.execute('SELECT TOP (20) * FROM ' + q + ';', db, xo);
    var cnt = T.execute('SELECT COUNT(*) FROM ' + q + ';', db, xo);
    var rs = r.results[0];
    var total = cnt.results[0] ? cnt.results[0].rows[0][0] : '?';
    if (r.error) return { title: pack.dbName + '.dbo.' + name, table: Grid.errorBox(r.error) };
    return { title: pack.dbName + '.dbo.' + name + ' — первые ' + Math.min(20, rs ? rs.rows.length : 0) + ' из ' + total + ' строк', table: rs ? Grid.table(rs.columns, rs.rows, rs.kinds) : h('p.muted', 'Нет данных') };
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
  // Схема связей в большом окне (сама схема — js/app/erd.js, на canvas)
  A.showErd = function (pack) {
    var e = A.erd(pack);
    var md = U.modal('Схема базы ' + pack.dbName + ': ' + pack.title, h('div.erd-modal', e.el));
    md.el.classList.add('wide');
    setTimeout(e.draw, 40);
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
            h('span.sp-ct', { 'data-cat': A.typeCat ? A.typeCat(c[1]) : 'other' }, c[1])),
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
