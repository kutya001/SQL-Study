/* ============================================================
   Интерактивные виджеты для уроков.
   Каждый виджет считает результат настоящим движком на мини-данных.
   ============================================================ */
(function (G) {
  'use strict';
  var U = G.U, h = U.h, T = G.TSQL, TY = T.TY;
  var W = G.Widgets = {};

  function typeOf(s) {
    var m = /^(\w+)(?:\((\d+)(?:,(\d+))?\))?$/.exec(s.trim());
    switch (m[1].toLowerCase()) {
      case 'int': return TY.int();
      case 'decimal': return TY.dec(+m[2] || 18, +m[3] || 0);
      case 'nvarchar': return TY.str(+m[2] || 50, true);
      case 'varchar': return TY.str(+m[2] || 50, false);
      case 'date': return TY.date();
      case 'datetime': return TY.datetime();
    }
    return TY.str(50, true);
  }
  function mini(tables) {
    var db = { tables: {} };
    Object.keys(tables).forEach(function (name) {
      var spec = tables[name];
      var cols = spec.cols.split(',').map(function (c) { var p = c.trim().split(/\s+/); return { name: p[0], type: typeOf(p[1]) }; });
      var rows = spec.rows.map(function (r) { return r.map(function (v, i) { if (v === null) return null; var k = cols[i].type.kind; if ((k === 'date' || k === 'datetime') && typeof v === 'string') return T.parseDateStr(v, k); return v; }); });
      db.tables[name.toLowerCase()] = { name: name, columns: cols, rows: rows };
    });
    return db;
  }
  function run(sql, db) { var r = T.execute(sql, db, {}); return r; }
  function sqlBox(sql) { var p = h('pre.code'); p.innerHTML = G.highlightSQL(sql); return p; }
  function seg(options, onPick, initial) {
    var box = h('div.seg');
    options.forEach(function (o, i) {
      var b = h('button.seg-btn' + (i === (initial || 0) ? '.active' : ''), { onclick: function () { U.qsa('.seg-btn', box).forEach(function (x) { x.classList.remove('active'); }); b.classList.add('active'); onPick(o, i); } }, o.label || o);
      box.appendChild(b);
    });
    return box;
  }
  function resTable(res, opts) {
    if (res.error) return G.Grid.errorBox(res.error);
    var rs = res.results[res.results.length - 1];
    return G.Grid.table(rs.columns, rs.rows, rs.kinds, opts || {});
  }

  /* ---------------- JOIN ---------------- */
  W.joinViz = function () {
    var db = mini({
      Clients: { cols: 'ClientID int, Name nvarchar(20)', rows: [[1, 'Айбек'], [2, 'Мария'], [3, 'Иван'], [4, 'Асель']] },
      Accounts: { cols: 'AccountID int, ClientID int, Currency varchar(3)', rows: [[101, 1, 'KGS'], [102, 1, 'USD'], [103, 2, 'KGS'], [104, 5, 'EUR']] }
    });
    var info = {
      INNER: 'INNER JOIN — только пары, где ключи совпали. Иван и Асель без счетов пропали, «ничейный» счёт 104 тоже.',
      LEFT: 'LEFT JOIN — все строки ЛЕВОЙ таблицы (Clients) + совпадения справа. Где пары нет — справа NULL.',
      RIGHT: 'RIGHT JOIN — все строки ПРАВОЙ таблицы (Accounts). Счёт 104 ссылается на несуществующего клиента — слева NULL.',
      FULL: 'FULL JOIN — все строки обеих таблиц. Совпавшие склеены, остальные дополнены NULL с той стороны, где пары нет.',
      CROSS: 'CROSS JOIN — каждая строка слева с каждой строкой справа: 4 × 4 = 16 строк. Условия ON нет.',
      ANTI: 'Анти-соединение: LEFT JOIN + WHERE справа IS NULL — находим клиентов, у которых НЕТ счетов.'
    };
    var root = h('div.widget.w-join');
    var area = h('div');
    var kinds = [{ label: 'INNER', k: 'INNER' }, { label: 'LEFT', k: 'LEFT' }, { label: 'RIGHT', k: 'RIGHT' }, { label: 'FULL', k: 'FULL' }, { label: 'CROSS', k: 'CROSS' }, { label: 'LEFT + IS NULL', k: 'ANTI' }];
    root.appendChild(h('div.w-title', 'Выберите тип соединения'));
    root.appendChild(seg(kinds, function (o) { draw(o.k); }));
    root.appendChild(area);
    function draw(k) {
      U.clear(area);
      var sql = k === 'CROSS' ? 'SELECT c.ClientID, c.Name, a.AccountID, a.ClientID AS AccClientID, a.Currency\nFROM Clients c\nCROSS JOIN Accounts a;'
        : k === 'ANTI' ? 'SELECT c.ClientID, c.Name\nFROM Clients c\nLEFT JOIN Accounts a ON a.ClientID = c.ClientID\nWHERE a.AccountID IS NULL;'
          : 'SELECT c.ClientID, c.Name, a.AccountID, a.ClientID AS AccClientID, a.Currency\nFROM Clients c\n' + k + ' JOIN Accounts a ON a.ClientID = c.ClientID;';
      var res = run(sql, db);
      var rs = res.results[0];
      // какие строки исходных таблиц попали в результат
      var usedC = {}, usedA = {};
      rs.raw.forEach(function (r) { if (r[0] !== null) usedC[r[0]] = 1; if (k !== 'ANTI' && r[2] !== null) usedA[r[2]] = 1; });
      var left = G.Grid.table(['ClientID', 'Name'], db.tables.clients.rows.map(function (r) { return [String(r[0]), r[1]]; }), ['int'], { rowClass: function (i) { return usedC[db.tables.clients.rows[i][0]] ? 'hit' : 'miss'; } });
      var right = G.Grid.table(['AccountID', 'ClientID', 'Currency'], db.tables.accounts.rows.map(function (r) { return [String(r[0]), String(r[1]), r[2]]; }), ['int', 'int'], { rowClass: function (i) { return k === 'ANTI' ? 'miss' : (usedA[db.tables.accounts.rows[i][0]] ? 'hit' : 'miss'); } });
      area.appendChild(h('div.w-join-src', h('div', h('div.w-cap', 'Clients (левая)'), left), h('div.w-join-mid', k === 'CROSS' ? '×' : '⇄'), h('div', h('div.w-cap', 'Accounts (правая)'), right)));
      area.appendChild(sqlBox(sql));
      area.appendChild(h('div.w-note', info[k]));
      area.appendChild(h('div.w-cap', 'Результат: ' + rs.rows.length + ' ' + U.plural(rs.rows.length, 'строка', 'строки', 'строк')));
      area.appendChild(resTable(res));
    }
    draw('INNER');
    return root;
  };

  /* ---------------- Трёхзначная логика ---------------- */
  W.nullTruth = function () {
    var V = ['TRUE', 'FALSE', 'UNKNOWN'];
    function and(a, b) { if (a === 'FALSE' || b === 'FALSE') return 'FALSE'; if (a === 'UNKNOWN' || b === 'UNKNOWN') return 'UNKNOWN'; return 'TRUE'; }
    function or(a, b) { if (a === 'TRUE' || b === 'TRUE') return 'TRUE'; if (a === 'UNKNOWN' || b === 'UNKNOWN') return 'UNKNOWN'; return 'FALSE'; }
    function not(a) { return a === 'TRUE' ? 'FALSE' : a === 'FALSE' ? 'TRUE' : 'UNKNOWN'; }
    var root = h('div.widget.w-null');
    function tableFor(name, fn) {
      var t = h('table.truth');
      var hr = h('tr', h('th', name));
      V.forEach(function (b) { hr.appendChild(h('th', b)); });
      t.appendChild(hr);
      V.forEach(function (a) {
        var tr = h('tr', h('th', a));
        V.forEach(function (b) { var r = fn(a, b); tr.appendChild(h('td.tv-' + r.toLowerCase(), r)); });
        t.appendChild(tr);
      });
      return t;
    }
    var nt = h('table.truth', h('tr', h('th', 'A'), h('th', 'NOT A')));
    V.forEach(function (a) { var r = not(a); nt.appendChild(h('tr', h('th', a), h('td.tv-' + r.toLowerCase(), r))); });
    root.appendChild(h('div.truth-row', h('div', h('div.w-cap', 'A AND B'), tableFor('A \\ B', and)), h('div', h('div.w-cap', 'A OR B'), tableFor('A \\ B', or)), h('div', h('div.w-cap', 'NOT'), nt)));
    // интерактив: значение столбца
    var db = mini({ Clients: { cols: 'Name nvarchar(20), Phone varchar(20)', rows: [['Айбек', '+996555111'], ['Мария', null], ['Иван', '+996700222']] } });
    var conds = [
      "Phone = '+996555111'", "Phone <> '+996555111'", 'Phone = NULL', 'Phone IS NULL', 'Phone IS NOT NULL', "NOT (Phone = '+996555111')", "Phone = '+996555111' OR Phone IS NULL"
    ];
    var out = h('div');
    root.appendChild(h('div.w-title', 'Что вернёт WHERE для каждой строки?'));
    root.appendChild(seg(conds, function (c) { draw(c); }));
    root.appendChild(out);
    function draw(c) {
      U.clear(out);
      var rows = db.tables.clients.rows;
      var res = run('SELECT Name, Phone, CASE WHEN ' + c + ' THEN \'TRUE\' WHEN NOT (' + c + ') THEN \'FALSE\' ELSE \'UNKNOWN\' END AS Result FROM Clients', db);
      var rs = res.results[0];
      var t = G.Grid.table(['Name', 'Phone', 'Условие даёт', 'Строка в результате?'], rs.rows.map(function (r) { return [r[0], r[1], r[2], r[2] === 'TRUE' ? 'да' : 'нет'] ; }), null, { rowClass: function (i) { return rs.rows[i][2] === 'TRUE' ? 'hit' : 'miss'; } });
      out.appendChild(sqlBox('SELECT Name, Phone FROM Clients\nWHERE ' + c + ';'));
      out.appendChild(t);
      out.appendChild(h('div.w-note', c === 'Phone = NULL' ? 'Сравнение с NULL через = всегда даёт UNKNOWN — даже для строки, где телефона нет. Поэтому результат пуст. Правильно: IS NULL.' : (/<>|NOT/.test(c) ? 'Обратите внимание на Марию: у неё телефон NULL, условие даёт UNKNOWN, и строка не попадает в результат — ни в «равно», ни в «не равно».' : 'WHERE пропускает только строки, где условие = TRUE.')));
    }
    draw(conds[0]);
    return root;
  };

  /* ---------------- LIKE ---------------- */
  W.likeViz = function () {
    var words = ['Айбек', 'Асель', 'Иван', 'Иванов', 'Абдыкадыров', 'Мария', 'Марат', 'Нурлан', 'Азамат', 'Динара', 'Ольга', 'Ким', 'Ли', 'Б-12', 'aibek@mail.kg', '100%'];
    var db = mini({ W: { cols: 'Value nvarchar(50)', rows: words.map(function (w) { return [w]; }) } });
    var root = h('div.widget.w-like');
    var inp = h('input.inp', { value: 'А%', placeholder: 'Шаблон LIKE' });
    var list = h('div.like-list'), note = h('div.w-note');
    var presets = ['А%', '%ов', '%ар%', '_а%', 'Ив_н%', '[АИ]%', '[^А-Я]%', '___', '%[0-9]%', '%[%]%'];
    root.appendChild(h('div.w-title', 'Введите шаблон или выберите готовый'));
    root.appendChild(h('div.like-row', h('code', "WHERE Value LIKE '"), inp, h('code', "'")));
    var pr = h('div.chips');
    presets.forEach(function (p) { pr.appendChild(h('button.chip', { onclick: function () { inp.value = p; draw(); } }, p)); });
    root.appendChild(pr); root.appendChild(list); root.appendChild(note);
    function draw() {
      U.clear(list);
      var p = inp.value.replace(/'/g, "''");
      var res = run("SELECT Value FROM W WHERE Value LIKE N'" + p + "'", db);
      var hit = {};
      if (!res.error) res.results[0].rows.forEach(function (r) { hit[r[0]] = 1; });
      words.forEach(function (w) { list.appendChild(h('span.like-item' + (hit[w] ? '.hit' : ''), w)); });
      note.textContent = res.error ? res.error.message : ('Совпадений: ' + Object.keys(hit).length + ' из ' + words.length + '. %% — любое количество символов (в т.ч. ноль), _ — ровно один символ, [АИ] — один из перечисленных, [^А-Я] — любой, кроме диапазона. Регистр не важен (как в большинстве баз SQL Server).').replace('%%', '%');
    }
    inp.addEventListener('input', draw);
    draw();
    return root;
  };

  /* ---------------- Множества ---------------- */
  W.setsViz = function () {
    var db = mini({
      Jan: { cols: 'Client nvarchar(20)', rows: [['Айбек'], ['Мария'], ['Иван'], ['Асель'], ['Мария']] },
      Feb: { cols: 'Client nvarchar(20)', rows: [['Мария'], ['Асель'], ['Нурлан'], ['Динара']] }
    });
    var ops = [
      { label: 'UNION', sql: 'SELECT Client FROM Jan\nUNION\nSELECT Client FROM Feb;', zones: 'abc', note: 'Все клиенты обоих месяцев без повторов. UNION удаляет дубли (Мария была дважды в январе).' },
      { label: 'UNION ALL', sql: 'SELECT Client FROM Jan\nUNION ALL\nSELECT Client FROM Feb;', zones: 'abc', note: 'Просто склеивает строки, дубли остаются: 5 + 4 = 9 строк. Быстрее, чем UNION.' },
      { label: 'INTERSECT', sql: 'SELECT Client FROM Jan\nINTERSECT\nSELECT Client FROM Feb;', zones: 'b', note: 'Только те, кто есть в обоих месяцах — «вернувшиеся» клиенты (удержание).' },
      { label: 'Jan EXCEPT Feb', sql: 'SELECT Client FROM Jan\nEXCEPT\nSELECT Client FROM Feb;', zones: 'a', note: 'Были в январе, но не пришли в феврале — «ушедшие» (отток).' },
      { label: 'Feb EXCEPT Jan', sql: 'SELECT Client FROM Feb\nEXCEPT\nSELECT Client FROM Jan;', zones: 'c', note: 'Пришли в феврале впервые — новые клиенты. Порядок запросов в EXCEPT важен!' }
    ];
    var root = h('div.widget.w-sets'), out = h('div');
    root.appendChild(h('div.w-title', 'Январь: Айбек, Мария, Иван, Асель, Мария · Февраль: Мария, Асель, Нурлан, Динара'));
    root.appendChild(seg(ops, function (o) { draw(o); }));
    root.appendChild(out);
    function venn(z) {
      var ns = 'http://www.w3.org/2000/svg';
      var svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 300 150'); svg.setAttribute('class', 'venn');
      var mk = function (tag, at) { var e = document.createElementNS(ns, tag); for (var k in at) e.setAttribute(k, at[k]); svg.appendChild(e); return e; };
      var defs = mk('defs', {});
      var cp = document.createElementNS(ns, 'clipPath'); cp.setAttribute('id', 'vc' + (++vennId)); var cc = document.createElementNS(ns, 'circle'); cc.setAttribute('cx', 175); cc.setAttribute('cy', 75); cc.setAttribute('r', 62); cp.appendChild(cc); defs.appendChild(cp);
      var on = 'var(--primary)', off = 'var(--surface-2)';
      mk('circle', { cx: 125, cy: 75, r: 62, fill: z.indexOf('a') >= 0 ? on : off, 'fill-opacity': 0.55, stroke: 'var(--border-strong)' });
      mk('circle', { cx: 175, cy: 75, r: 62, fill: z.indexOf('c') >= 0 ? on : off, 'fill-opacity': 0.55, stroke: 'var(--border-strong)' });
      mk('circle', { cx: 125, cy: 75, r: 62, fill: z.indexOf('b') >= 0 ? on : off, 'fill-opacity': z.indexOf('b') >= 0 ? 0.9 : (z.indexOf('a') >= 0 || z.indexOf('c') >= 0 ? 0.55 : 0.55), 'clip-path': 'url(#vc' + vennId + ')', stroke: 'none' });
      var t1 = mk('text', { x: 95, y: 80, 'text-anchor': 'middle', class: 'venn-t' }); t1.textContent = 'Январь';
      var t2 = mk('text', { x: 205, y: 80, 'text-anchor': 'middle', class: 'venn-t' }); t2.textContent = 'Февраль';
      return svg;
    }
    var vennId = 0;
    function draw(o) {
      U.clear(out);
      var res = run(o.sql, db);
      out.appendChild(h('div.sets-grid', venn(o.zones), h('div', sqlBox(o.sql), resTable(res))));
      out.appendChild(h('div.w-note', o.note));
    }
    draw(ops[0]);
    return root;
  };

  /* ---------------- Окна и рамки ---------------- */
  W.windowViz = function () {
    var data = [
      [1, 'A', '2026-01', 100], [2, 'A', '2026-02', 300], [3, 'A', '2026-03', 200], [4, 'A', '2026-04', 400],
      [5, 'B', '2026-01', 500], [6, 'B', '2026-02', 100], [7, 'B', '2026-03', 100], [8, 'B', '2026-04', 300]
    ];
    var db = mini({ Sales: { cols: 'ID int, Acc varchar(5), Mon varchar(7), Amount int', rows: data } });
    var fns = [
      { label: 'SUM нарастающий', expr: 'SUM(Amount) OVER ({P}ORDER BY Mon ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)', frame: 'run', note: 'Сумма от первой строки окна до текущей — «снежный ком».' },
      { label: 'SUM всего окна', expr: 'SUM(Amount) OVER ({PX})', frame: 'all', note: 'Без ORDER BY окно — вся секция: каждая строка видит общий итог своей секции.' },
      { label: 'AVG за 3 мес.', expr: 'AVG(Amount) OVER ({P}ORDER BY Mon ROWS BETWEEN 2 PRECEDING AND CURRENT ROW)', frame: 'r3', note: 'Скользящее среднее: текущая строка и две предыдущие. Окно «едет» вниз.' },
      { label: 'ROW_NUMBER', expr: 'ROW_NUMBER() OVER ({P}ORDER BY Amount DESC)', frame: 'none', note: 'Номер строки по убыванию суммы. При равных суммах номера всё равно разные.' },
      { label: 'RANK', expr: 'RANK() OVER ({P}ORDER BY Amount DESC)', frame: 'none', note: 'Ранг: равные суммы получают одинаковое место, следующее место пропускается.' },
      { label: 'LAG', expr: 'LAG(Amount) OVER ({P}ORDER BY Mon)', frame: 'lag', note: 'Значение из предыдущей строки окна. У первой строки предыдущей нет — NULL.' }
    ];
    var root = h('div.widget.w-win');
    var part = h('input', { type: 'checkbox', checked: true });
    var cur = fns[0], sel = 2;
    var out = h('div');
    root.appendChild(h('div.w-title', 'Выберите функцию, затем щёлкните по строке — подсветятся строки, которые она «видит»'));
    root.appendChild(seg(fns, function (o) { cur = o; draw(); }));
    root.appendChild(h('label.w-check', part, ' PARTITION BY Acc (отдельное окно для каждого счёта)'));
    part.addEventListener('change', function () { draw(); });
    root.appendChild(out);
    function frameRows(rows, i) {
      // rows: [{id, acc, mon, amount}] в порядке вывода (по Acc, Mon)
      var p = part.checked;
      var same = rows.filter(function (r) { return !p || r.acc === rows[i].acc; });
      var ordered = same.slice().sort(function (a, b) { return a.mon < b.mon ? -1 : a.mon > b.mon ? 1 : a.id - b.id; });
      var pos = ordered.indexOf(rows[i]);
      var ids = [];
      if (cur.frame === 'all') ids = ordered;
      else if (cur.frame === 'run') ids = ordered.slice(0, pos + 1);
      else if (cur.frame === 'r3') ids = ordered.slice(Math.max(0, pos - 2), pos + 1);
      else if (cur.frame === 'lag') ids = pos > 0 ? [ordered[pos - 1]] : [];
      else ids = same;
      return ids.map(function (r) { return r.id; });
    }
    function draw() {
      U.clear(out);
      var expr = cur.expr.replace('{P}', part.checked ? 'PARTITION BY Acc ' : '').replace('{PX}', part.checked ? 'PARTITION BY Acc' : '');
      var sql = 'SELECT ID, Acc, Mon, Amount,\n       ' + expr + ' AS Result\nFROM Sales\nORDER BY Acc, Mon;';
      var res = run(sql, db);
      if (res.error) { out.appendChild(G.Grid.errorBox(res.error)); return; }
      var rs = res.results[0];
      var rows = rs.raw.map(function (r) { return { id: r[0], acc: r[1], mon: r[2], amount: r[3] }; });
      if (sel >= rows.length) sel = 0;
      var fr = frameRows(rows, sel);
      var t = G.Grid.table(rs.columns, rs.rows, rs.kinds, {
        rowClass: function (i) {
          var r = rows[i];
          if (i === sel) return 'cur';
          if (fr.indexOf(r.id) >= 0) return 'hit';
          if (part.checked && r.acc !== rows[sel].acc) return 'dim';
          return '';
        }
      });
      U.qsa('tbody tr', t).forEach(function (tr, i) { tr.style.cursor = 'pointer'; tr.addEventListener('click', function () { sel = i; draw(); }); });
      out.appendChild(sqlBox(sql));
      out.appendChild(t);
      out.appendChild(h('div.w-note', cur.note + (cur.frame === 'none' ? ' Подсвечена секция, внутри которой считается номер.' : '')));
    }
    draw();
    return root;
  };

  /* ---------------- DATEDIFF ---------------- */
  W.dateDiffViz = function () {
    var root = h('div.widget.w-date');
    var a = h('input.inp', { value: '2026-01-31 23:59:59' }), b = h('input.inp', { value: '2026-02-01 00:00:01' });
    var part = h('select.inp', ['year', 'quarter', 'month', 'week', 'day', 'hour', 'minute'].map(function (p) { return h('option', { value: p }, p); }));
    part.value = 'day';
    var out = h('div');
    var presets = [
      ['Через полночь', '2026-01-31 23:59:59', '2026-02-01 00:00:01', 'day'],
      ['Новый год за 2 сек', '2025-12-31 23:59:59', '2026-01-01 00:00:01', 'year'],
      ['Почти год', '2026-01-01', '2026-12-31', 'year'],
      ['31 янв → 1 фев', '2026-01-31', '2026-02-01', 'month'],
      ['Возраст: ДР ещё не был', '1990-12-25', '2026-11-16', 'year']
    ];
    root.appendChild(h('div.w-title', 'DATEDIFF считает пересечённые границы, а не полные периоды'));
    var pr = h('div.chips');
    presets.forEach(function (p) { pr.appendChild(h('button.chip', { onclick: function () { a.value = p[1]; b.value = p[2]; part.value = p[3]; draw(); } }, p[0])); });
    root.appendChild(pr);
    root.appendChild(h('div.date-row', h('code', 'DATEDIFF('), part, h('code', ", '"), a, h('code', "', '"), b, h('code', "')")));
    root.appendChild(out);
    [a, b, part].forEach(function (x) { x.addEventListener('input', draw); x.addEventListener('change', draw); });
    function draw() {
      U.clear(out);
      var sql = "SELECT DATEDIFF(" + part.value + ", '" + a.value.replace(/'/g, '') + "', '" + b.value.replace(/'/g, '') + "') AS Result";
      var res = run(sql, mini({}));
      if (res.error) { out.appendChild(G.Grid.errorBox(res.error)); return; }
      var v = res.results[0].rows[0][0];
      var big = h('div.big-num', v);
      var expl = '';
      var ms = T.parseDateStr(b.value, 'datetime') - T.parseDateStr(a.value, 'datetime');
      var days = (ms / 86400000).toFixed(2);
      expl = 'Реально прошло ' + days + ' сут. А DATEDIFF(' + part.value + ') = ' + v + ': столько раз между датами «перелистнулся» ' + ({ year: 'год', quarter: 'квартал', month: 'месяц', week: 'воскресенье→понедельник (неделя)', day: 'день (полночь)', hour: 'час', minute: 'минута' })[part.value] + '.';
      out.appendChild(h('div.date-res', big, h('div.w-note', expl)));
      if (part.value === 'year') out.appendChild(h('div.w-note.warn', 'Поэтому возраст через DATEDIFF(year, BirthDate, GETDATE()) может быть на 1 больше, если день рождения в этом году ещё не наступил. Правильный способ — в уроке ниже.'));
    }
    draw();
    return root;
  };

  /* ---------------- BETWEEN и время ---------------- */
  W.betweenViz = function () {
    var db = mini({ Tr: { cols: 'ID int, TransDate datetime, Amount int', rows: [[1, '2026-01-01 00:00:00', 100], [2, '2026-01-15 12:30:00', 200], [3, '2026-01-31 00:00:00', 300], [4, '2026-01-31 09:15:00', 400], [5, '2026-01-31 23:59:59', 500], [6, '2026-02-01 00:00:00', 600]] } });
    var variants = [
      { label: "BETWEEN '2026-01-01' AND '2026-01-31'", w: "TransDate BETWEEN '2026-01-01' AND '2026-01-31'", note: "Ловушка! '2026-01-31' — это 31 января 00:00:00. Операции 31-го днём и вечером (ID 4 и 5) потерялись." },
      { label: "YEAR() и MONTH()", w: 'YEAR(TransDate) = 2026 AND MONTH(TransDate) = 1', note: 'Результат верный, но функция над столбцом мешает серверу использовать индекс — на больших таблицах это медленно (подробнее в модуле об оптимизации).' },
      { label: ">= и < (правильно)", w: "TransDate >= '2026-01-01' AND TransDate < '2026-02-01'", note: 'Правильный приём: «от начала периода включительно до начала следующего периода не включительно». Работает и для DATE, и для DATETIME, и быстро.' }
    ];
    var root = h('div.widget'), out = h('div');
    root.appendChild(h('div.w-title', 'Нужны все операции за январь 2026. Какой фильтр правильный?'));
    root.appendChild(seg(variants, function (v) { draw(v); }));
    root.appendChild(out);
    function draw(v) {
      U.clear(out);
      var all = run('SELECT ID, TransDate, Amount FROM Tr', db).results[0];
      var res = run('SELECT ID FROM Tr WHERE ' + v.w, db);
      var ids = {}; res.results[0].raw.forEach(function (r) { ids[r[0]] = 1; });
      var shouldBe = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 };
      out.appendChild(sqlBox('SELECT ID, TransDate, Amount\nFROM Tr\nWHERE ' + v.w + ';'));
      out.appendChild(G.Grid.table(all.columns.concat(['Попала?']), all.rows.map(function (r, i) { return r.concat([ids[all.raw[i][0]] ? 'да' : 'нет']); }), all.kinds, { rowClass: function (i) { var id = all.raw[i][0]; return ids[id] ? (shouldBe[id] ? 'hit' : 'bad') : (shouldBe[id] ? 'bad' : 'miss'); } }));
      out.appendChild(h('div.w-note', v.note));
    }
    draw(variants[0]);
    return root;
  };

  /* ---------------- GROUP BY по шагам ---------------- */
  W.groupViz = function () {
    var rows = [['Бишкек', 'Айбек', 500], ['Ош', 'Мария', 300], ['Бишкек', 'Иван', 200], ['Каракол', 'Асель', 400], ['Ош', 'Нурлан', 100], ['Бишкек', 'Динара', 300]];
    var colors = { 'Бишкек': '#4c6ef5', 'Ош': '#12b886', 'Каракол': '#f59f00' };
    var steps = [
      { t: '1. Исходные строки (после FROM и WHERE)', mode: 'raw' },
      { t: '2. GROUP BY City: у каждой строки определяем «корзину» по городу', mode: 'color' },
      { t: '3. Раскладываем строки по корзинам', mode: 'groups' },
      { t: '4. Каждая корзина сворачивается в одну строку: COUNT(*) и SUM(Amount) считаются внутри неё', mode: 'agg' }
    ];
    var i = 0;
    var root = h('div.widget.w-group'), out = h('div'), title = h('div.w-title');
    var prev = h('button.btn', { onclick: function () { if (i > 0) { i--; draw(); } } }, '← Назад');
    var next = h('button.btn.primary', { onclick: function () { if (i < steps.length - 1) { i++; draw(); } } }, 'Далее →');
    root.appendChild(sqlBox('SELECT City, COUNT(*) AS Cnt, SUM(Amount) AS Total\nFROM Sales\nGROUP BY City;'));
    root.appendChild(title); root.appendChild(out); root.appendChild(h('div.w-nav', prev, next));
    function rowEl(r, color) { return h('div.gv-row', { style: color ? { borderLeftColor: color, background: color + '18' } : {} }, h('span', r[0]), h('span', r[1]), h('span.num', String(r[2]))); }
    function draw() {
      var st = steps[i]; title.textContent = st.t; U.clear(out);
      prev.disabled = i === 0; next.disabled = i === steps.length - 1;
      if (st.mode === 'raw' || st.mode === 'color') {
        var list = h('div.gv-list', h('div.gv-row.head', h('span', 'City'), h('span', 'Name'), h('span', 'Amount')));
        rows.forEach(function (r) { list.appendChild(rowEl(r, st.mode === 'color' ? colors[r[0]] : null)); });
        out.appendChild(list);
      } else {
        var wrap = h('div.gv-groups');
        Object.keys(colors).forEach(function (c) {
          var g = rows.filter(function (r) { return r[0] === c; });
          var box = h('div.gv-box', { style: { borderColor: colors[c] } }, h('div.gv-box-h', { style: { background: colors[c] } }, c));
          if (st.mode === 'groups') g.forEach(function (r) { box.appendChild(rowEl(r, colors[c])); });
          else box.appendChild(h('div.gv-agg', h('div', 'Cnt = ', h('b', String(g.length))), h('div', 'Total = ', h('b', String(g.reduce(function (s, r) { return s + r[2]; }, 0))))));
          wrap.appendChild(box);
        });
        out.appendChild(wrap);
        if (st.mode === 'agg') out.appendChild(h('div.w-note', 'Имя (Name) вывести уже нельзя: в группе «Бишкек» три разных имени — какое из них показать? Поэтому столбец в SELECT должен быть либо в GROUP BY, либо внутри агрегатной функции.'));
      }
    }
    draw();
    return root;
  };

  /* ---------------- CASE ---------------- */
  W.caseViz = function () {
    var root = h('div.widget.w-case');
    var inp = h('input', { type: 'range', min: 0, max: 200000, step: 500, value: 25000 });
    var val = h('b'), out = h('div.case-list');
    var br = [['Amount >= 100000', 'Крупная', 100000], ['Amount >= 10000', 'Средняя', 10000], ['Amount >= 1000', 'Обычная', 1000]];
    root.appendChild(h('div.w-title', 'Двигайте ползунок: CASE проверяет условия сверху вниз и берёт ПЕРВОЕ истинное'));
    root.appendChild(h('div.case-in', 'Amount = ', val, inp));
    root.appendChild(out);
    function draw() {
      var a = +inp.value; val.textContent = a.toLocaleString('ru-RU') + ' ';
      U.clear(out);
      var fired = false;
      out.appendChild(h('div.case-line', h('code', 'CASE')));
      br.forEach(function (b) {
        var t = a >= b[2];
        var cls = fired ? 'skip' : (t ? 'fire' : 'no');
        out.appendChild(h('div.case-line.' + cls, h('code', '  WHEN ' + b[0] + " THEN '" + b[1] + "'"), h('span.case-tag', fired ? 'не проверяется' : (t ? 'TRUE → результат' : 'FALSE'))));
        if (t && !fired) fired = true;
      });
      out.appendChild(h('div.case-line.' + (fired ? 'skip' : 'fire'), h('code', "  ELSE 'Мелкая'"), h('span.case-tag', fired ? 'не нужен' : 'результат')));
      out.appendChild(h('div.case-line', h('code', 'END')));
    }
    inp.addEventListener('input', draw);
    draw();
    return root;
  };

  /* ---------------- Порядок выполнения ---------------- */
  W.execOrder = function () {
    var written = ['SELECT', 'FROM', 'JOIN … ON', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'TOP / OFFSET'];
    var exec = [['FROM', 'JOIN … ON'], ['WHERE'], ['GROUP BY'], ['HAVING'], ['SELECT'], ['ORDER BY'], ['TOP / OFFSET']];
    var notes = ['Берём таблицы и соединяем их', 'Фильтруем строки', 'Собираем группы', 'Фильтруем группы', 'Считаем столбцы и псевдонимы, оконные функции', 'Сортируем (псевдонимы уже есть!)', 'Отрезаем нужное число строк'];
    var root = h('div.widget.w-order');
    var left = h('div.eo-col', h('div.w-cap', 'Как мы ПИШЕМ'));
    written.forEach(function (w) { left.appendChild(h('div.eo-item', w)); });
    var right = h('div.eo-col', h('div.w-cap', 'Как сервер ВЫПОЛНЯЕТ'));
    exec.forEach(function (e, i) { right.appendChild(h('div.eo-item.exec', { style: { animationDelay: (i * 0.15) + 's' } }, h('span.eo-n', String(i + 1)), e.join(' + '), h('div.eo-note', notes[i]))); });
    root.appendChild(h('div.eo-grid', left, right));
    root.appendChild(h('div.w-note', 'Отсюда два главных правила: псевдоним из SELECT нельзя использовать в WHERE/GROUP BY/HAVING (их ещё нет), но можно в ORDER BY. А агрегаты (SUM, COUNT) нельзя писать в WHERE — группы появляются позже.'));
    return root;
  };

  /* ---------------- Excel ↔ SQL ---------------- */
  W.excelMap = function () {
    var rows = [
      ['Файл с листами', 'База данных с таблицами'],
      ['Лист «Клиенты»', 'Таблица Clients'],
      ['Заголовок столбца', 'Столбец (имеет имя и тип данных)'],
      ['Строка листа', 'Строка (запись)'],
      ['Скрыть столбцы', 'SELECT — перечислить нужные столбцы'],
      ['Фильтр', 'WHERE'],
      ['Сортировка', 'ORDER BY'],
      ['Удалить дубликаты', 'DISTINCT'],
      ['Сводная таблица', 'GROUP BY + SUM / COUNT'],
      ['ВПР / XLOOKUP', 'JOIN'],
      ['Формула в ячейке', 'Выражение в SELECT'],
      ['ЕСЛИ()', 'CASE WHEN'],
      ['Пустая ячейка', 'NULL (но это не ноль и не пустая строка!)']
    ];
    var t = G.Grid.table(['В Excel', 'В SQL'], rows, null, { max: 50 });
    t.classList.add('nonum');
    return h('div.widget', t);
  };

  W.names = ['joinViz', 'nullTruth', 'likeViz', 'setsViz', 'windowViz', 'dateDiffViz', 'betweenViz', 'groupViz', 'caseViz', 'execOrder', 'excelMap'];
  W.render = function (name, opts) {
    if (!W[name]) return h('div.err-box', 'Виджет не найден: ' + name);
    try { return W[name](opts || {}); }
    catch (e) { console.error(e); return h('div.err-box', 'Ошибка виджета: ' + e.message); }
  };
})(window);
