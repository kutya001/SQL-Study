/* ============================================================
   Вывод результатов: таблицы, сообщения, ошибки, пошаговый режим
   ============================================================ */
(function (G) {
  'use strict';
  var U = G.U, h = U.h, T = G.TSQL;
  var NUMK = { int: 1, decimal: 1, float: 1, bit: 1 };
  var STAGE_INFO = {
    'FROM': 'Берём строки из таблиц, перечисленных во FROM (и соединяем их, если есть JOIN).',
    'WHERE': 'Оставляем только строки, для которых условие WHERE даёт ИСТИНУ. Ложь и «неизвестно» (NULL) отбрасываются.',
    'GROUP BY': 'Раскладываем оставшиеся строки по группам с одинаковыми значениями. Дальше каждая группа — это одна строка результата.',
    'HAVING': 'Оставляем только группы, для которых условие HAVING истинно.',
    'SELECT': 'Вычисляем столбцы результата: выражения, функции, псевдонимы (AS), оконные функции.',
    'DISTINCT': 'Убираем полностью одинаковые строки.',
    'ORDER BY': 'Сортируем готовый результат. Здесь уже можно использовать псевдонимы из SELECT.',
    'TOP': 'Отрезаем первые N строк.',
    'OFFSET / FETCH': 'Пропускаем OFFSET строк и берём следующие FETCH строк.'
  };
  var G_COLORS = ['#4c6ef5', '#12b886', '#f59f00', '#e64980', '#7950f2', '#15aabf', '#fa5252', '#82c91e', '#fd7e14', '#be4bdb'];

  function table(cols, rows, kinds, opts) {
    opts = opts || {};
    var max = opts.max || 500;
    var wrap = h('div.grid-wrap');
    var tbl = h('table.grid');
    var thr = h('tr', h('th.rn', '#'));
    cols.forEach(function (c, i) {
      var noname = c === '(Отсутствует имя столбца)';
      thr.appendChild(h('th' + (noname ? '.noname' : ''), { title: (opts.types && opts.types[i]) ? opts.types[i] : '' }, c));
    });
    tbl.appendChild(h('thead', thr));
    var tb = h('tbody');
    var lim = Math.min(rows.length, max);
    for (var r = 0; r < lim; r++) {
      var tr = h('tr', h('td.rn', String(r + 1)));
      rows[r].forEach(function (v, i) {
        var td = h('td');
        if (v === null) { td.className = 'null'; td.textContent = 'NULL'; }
        else { td.textContent = v; if (kinds && NUMK[kinds[i]]) td.className = 'num'; }
        if (opts.rowClass) { var rc = opts.rowClass(r); if (rc) tr.classList.add(rc); }
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    }
    tbl.appendChild(tb);
    wrap.appendChild(tbl);
    if (!rows.length) wrap.appendChild(h('div.grid-empty', 'Строк нет'));
    if (rows.length > lim) wrap.appendChild(h('div.grid-more', 'Показаны первые ' + lim + ' из ' + rows.length + ' строк.'));
    return wrap;
  }

  function errorBox(e) {
    var head = 'Сообщение ' + e.number + ', уровень ' + (e.level || 16) + ', состояние 1' + (e.line ? ', строка ' + e.line : '');
    var box = h('div.err-box', h('div.err-head', head), h('div.err-msg', e.message));
    var hint = T.explain(e);
    if (hint) box.appendChild(h('div.err-hint', h('b', 'Что это значит: '), hint));
    return box;
  }

  function traceView(trace) {
    var box = h('div.trace');
    if (!trace || !trace.length) { box.appendChild(h('p.muted', 'Пошаговый режим доступен для одиночного SELECT.')); return box; }
    var chips = h('div.trace-chips'), body = h('div.trace-body');
    box.appendChild(h('p.trace-intro', 'Так SQL Server на самом деле обрабатывает ваш запрос — по шагам, не в том порядке, в каком он написан. Нажимайте на шаги:'));
    box.appendChild(chips); box.appendChild(body);
    function show(i) {
      U.qsa('.trace-chip', chips).forEach(function (c, j) { c.classList.toggle('active', i === j); });
      U.clear(body);
      var st = trace[i];
      body.appendChild(h('div.trace-desc', h('b', (i + 1) + '. ' + st.stage + ' — '), STAGE_INFO[st.stage] || ''));
      var info = 'Строк после шага: ' + st.total + (st.removed ? ' (отброшено: ' + st.removed + ')' : '');
      if (st.stage === 'GROUP BY') info = 'Групп получилось: ' + st.total;
      body.appendChild(h('div.trace-count', info));
      if (st.stage === 'GROUP BY' && st.groups) {
        var gl = h('div.trace-groups');
        st.groups.forEach(function (g, gi) {
          var col = G_COLORS[gi % G_COLORS.length];
          var card = h('details.tg', { style: { borderLeftColor: col } },
            h('summary', h('span.tg-key', { style: { background: col } }, g.key.join(' · ') || '(вся таблица)'), ' — строк: ' + g.n),
            table(st.srcCols, g.rows, null, { max: 30 }));
          gl.appendChild(card);
        });
        body.appendChild(gl);
        body.appendChild(h('p.muted', 'Раскройте группу, чтобы увидеть, какие строки в неё попали.'));
        body.appendChild(table(st.cols, st.rows, null, { max: 200 }));
      } else {
        body.appendChild(table(st.cols, st.rows, null, { max: 200 }));
        if (st.total > st.rows.length) body.appendChild(h('div.grid-more', 'Показаны первые ' + st.rows.length + ' строк.'));
      }
    }
    trace.forEach(function (st, i) {
      chips.appendChild(h('button.trace-chip', { onclick: function () { show(i); } }, h('span.tc-n', String(i + 1)), st.stage, h('span.tc-c', String(st.total))));
      if (i < trace.length - 1) chips.appendChild(h('span.trace-arrow', '→'));
    });
    show(0);
    return box;
  }

  // Полный вывод запуска: вкладки Результаты / Сообщения / Пошагово
  function renderRun(container, res, opts) {
    opts = opts || {};
    U.clear(container);
    var tabs = h('div.res-tabs'), panes = h('div.res-panes');
    container.appendChild(tabs); container.appendChild(panes);
    var list = [];
    function addTab(name, el, badge) {
      var idx = list.length;
      var b = h('button.res-tab', { onclick: function () { select(idx); } }, name, badge ? h('span.badge', badge) : null);
      tabs.appendChild(b); list.push({ b: b, el: el }); panes.appendChild(el);
    }
    function select(i) { list.forEach(function (t, j) { t.b.classList.toggle('active', i === j); t.el.style.display = i === j ? '' : 'none'; }); }
    var resPane = h('div.res-pane');
    if (res.results.length) {
      res.results.forEach(function (rs, i) {
        if (res.results.length > 1) resPane.appendChild(h('div.rs-title', 'Результат ' + (i + 1)));
        resPane.appendChild(table(rs.columns, rs.rows, rs.kinds, { types: rs.types }));
      });
    } else if (!res.error) resPane.appendChild(h('div.grid-empty', 'Запрос не вернул таблицу. Смотрите вкладку «Сообщения».'));
    if (res.error) resPane.appendChild(errorBox(res.error));
    addTab('Результаты', resPane, res.results.length ? String(res.results[res.results.length - 1].rows.length) : null);
    var msg = h('div.res-pane.msgs');
    res.messages.forEach(function (m) { msg.appendChild(h('div', m)); });
    if (res.error) msg.appendChild(errorBox(res.error));
    msg.appendChild(h('div.muted', 'Время выполнения: ' + res.timeMs + ' мс'));
    addTab('Сообщения', msg);
    if (opts.trace) addTab('Пошагово', traceView(res.trace));
    select(opts.showTrace && opts.trace ? 2 : 0);
    return { select: select };
  }

  G.Grid = { table: table, errorBox: errorBox, traceView: traceView, renderRun: renderRun };
})(window);
