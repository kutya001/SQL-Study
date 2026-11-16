/* ============================================================
   Редактор SQL: подсветка, номера строк, горячие клавиши,
   автодополнение таблиц/столбцов/ключевых слов.
   ============================================================ */
(function (G) {
  'use strict';
  var U = G.U, h = U.h;
  var KW = 'SELECT FROM WHERE AND OR NOT IN IS NULL LIKE BETWEEN AS ORDER BY GROUP HAVING TOP DISTINCT JOIN INNER LEFT RIGHT FULL OUTER CROSS APPLY ON UNION ALL EXCEPT INTERSECT CASE WHEN THEN ELSE END WITH ASC DESC OFFSET ROWS ROW FETCH NEXT ONLY PERCENT TIES EXISTS INTO DECLARE SET OVER PARTITION RANGE UNBOUNDED PRECEDING FOLLOWING CURRENT ROLLUP CUBE GROUPING SETS WITHIN OPTION MAXRECURSION DROP TABLE IF ANY SOME ESCAPE NOLOCK GO LANGUAGE DATEFIRST DATEFORMAT USE'.split(' ');
  var FUNCS = 'COUNT SUM AVG MIN MAX STRING_AGG ROW_NUMBER RANK DENSE_RANK NTILE LAG LEAD FIRST_VALUE LAST_VALUE PERCENT_RANK CUME_DIST PERCENTILE_CONT PERCENTILE_DISC CAST CONVERT TRY_CAST TRY_CONVERT ISNULL COALESCE NULLIF IIF CHOOSE LEN UPPER LOWER LTRIM RTRIM TRIM LEFT RIGHT SUBSTRING CHARINDEX PATINDEX REPLACE REPLICATE REVERSE CONCAT CONCAT_WS FORMAT STUFF SPACE ROUND CEILING FLOOR ABS POWER SQRT SIGN GETDATE SYSDATETIME YEAR MONTH DAY DATEPART DATENAME DATEADD DATEDIFF EOMONTH DATEFROMPARTS DATETRUNC ISDATE ISNUMERIC GREATEST LEAST NEWID GENERATE_SERIES COUNT_BIG GROUPING DB_NAME'.split(' ');
  var KWSET = {}; KW.forEach(function (k) { KWSET[k] = 1; });
  var FNSET = {}; FUNCS.forEach(function (k) { FNSET[k] = 1; });
  var TYPES = { INT: 1, BIGINT: 1, SMALLINT: 1, TINYINT: 1, DECIMAL: 1, NUMERIC: 1, MONEY: 1, FLOAT: 1, REAL: 1, VARCHAR: 1, NVARCHAR: 1, CHAR: 1, NCHAR: 1, DATE: 1, DATETIME: 1, DATETIME2: 1, BIT: 1, MAX: 1 };

  function highlight(src) {
    var out = '', re = /(--[^\n]*)|(\/\*[\s\S]*?(?:\*\/|$))|(N?'(?:[^']|'')*(?:'|$))|(\[[^\]\n]*\]?)|(@@?\w+)|(#\w+)|(\b\d+(?:\.\d+)?\b)|([A-Za-zА-Яа-яЁё_][\wА-Яа-яЁё]*)|([\s\S])/g, m;
    while ((m = re.exec(src))) {
      var t = m[0], e = U.esc(t);
      if (m[1] || m[2]) out += '<span class="hl-c">' + e + '</span>';
      else if (m[3]) out += '<span class="hl-s">' + e + '</span>';
      else if (m[4]) out += '<span class="hl-id">' + e + '</span>';
      else if (m[5]) out += '<span class="hl-v">' + e + '</span>';
      else if (m[6]) out += '<span class="hl-t">' + e + '</span>';
      else if (m[7]) out += '<span class="hl-n">' + e + '</span>';
      else if (m[8]) {
        var up = t.toUpperCase();
        if (KWSET[up]) out += '<span class="hl-k">' + e + '</span>';
        else if (FNSET[up]) out += '<span class="hl-f">' + e + '</span>';
        else if (TYPES[up]) out += '<span class="hl-ty">' + e + '</span>';
        else out += e;
      }
      else out += e;
    }
    return out + '\n';
  }
  G.highlightSQL = highlight;

  // словарь для автодополнения
  // tables: [{ name, cols: [[имя, тип, описание]] }] — схема текущей базы
  function schemaWords(tablesList) {
    var tables = [], cols = {}, allCols = {};
    (tablesList || (G.Editor.defaultSchema && G.Editor.defaultSchema()) || (G.TSQL && G.TSQL.SCHEMA) || []).forEach(function (t) {
      tables.push(t.name);
      cols[t.name.toLowerCase()] = t.cols.map(function (c) { return { name: c[0], type: c[1], desc: c[2] }; });
      t.cols.forEach(function (c) { if (!allCols[c[0]]) allCols[c[0]] = t.name; });
    });
    return { tables: tables, cols: cols, allCols: allCols };
  }

  G.Editor = {
    create: function (container, opts) {
      opts = opts || {};
      var wrap = h('div.editor');
      var gutter = h('div.ed-gutter');
      var pre = h('pre.ed-hl', { 'aria-hidden': 'true' });
      var ta = h('textarea.ed-ta', { spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', wrap: 'off', placeholder: opts.placeholder || 'Напишите запрос и нажмите F5 или Ctrl+Enter' });
      var area = h('div.ed-area', pre, ta);
      var pop = h('div.ed-pop');
      wrap.appendChild(gutter); wrap.appendChild(area); wrap.appendChild(pop);
      container.appendChild(wrap);
      if (opts.minHeight) wrap.style.minHeight = opts.minHeight + 'px';
      ta.value = opts.value || '';
      var sw = schemaWords(opts.schema);

      function render() {
        pre.innerHTML = highlight(ta.value);
        var n = ta.value.split('\n').length, g = '';
        for (var i = 1; i <= n; i++) g += i + '\n';
        gutter.textContent = g;
        autosize();
      }
      function autosize() {
        var lines = ta.value.split('\n').length;
        var lh = 21;
        var hgt = Math.max(opts.minLines || 5, Math.min(opts.maxLines || 22, lines + 1)) * lh + 16;
        area.style.height = hgt + 'px';
        gutter.style.height = hgt + 'px';
      }
      function sync() { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; gutter.scrollTop = ta.scrollTop; }
      ta.addEventListener('scroll', sync);
      ta.addEventListener('input', function () { render(); sync(); if (opts.onChange) opts.onChange(ta.value); suggest(); });

      function setSel(s, e) { ta.selectionStart = s; ta.selectionEnd = e === undefined ? s : e; }
      function replaceRange(s, e, text, selStart, selEnd) {
        ta.focus();
        ta.setSelectionRange(s, e);
        var ok = false;
        try { ok = document.execCommand('insertText', false, text); } catch (er) { ok = false; }
        if (!ok) { ta.value = ta.value.slice(0, s) + text + ta.value.slice(e); }
        if (selStart !== undefined) setSel(selStart, selEnd);
        render(); sync();
        if (opts.onChange) opts.onChange(ta.value);
      }
      function lineBounds(pos) { var v = ta.value; var s = v.lastIndexOf('\n', pos - 1) + 1; var e = v.indexOf('\n', pos); if (e < 0) e = v.length; return [s, e]; }

      /* --- автодополнение --- */
      var items = [], active = 0, popOpen = false, wordStart = 0;
      function closePop() { popOpen = false; pop.style.display = 'none'; }
      function aliasTable(alias) {
        var re = new RegExp('(?:FROM|JOIN|APPLY)\\s+(?:\\w+\\.(?:dbo)?\\.|dbo\\.)?\\[?(\\w+)\\]?\\s+(?:AS\\s+)?' + alias + '\\b', 'i');
        var m = re.exec(ta.value);
        if (m) return m[1];
        if (sw.cols[alias.toLowerCase()]) return alias;
        return null;
      }
      function suggest() {
        var pos = ta.selectionStart;
        if (pos !== ta.selectionEnd) return closePop();
        var before = ta.value.slice(0, pos);
        // не подсказываем внутри строк и комментариев (упрощённо)
        var lineStart = before.lastIndexOf('\n') + 1, line = before.slice(lineStart);
        if (/--/.test(line) || ((line.match(/'/g) || []).length % 2 === 1)) return closePop();
        var m = /([A-Za-zА-Яа-я_][\wА-Яа-я]*)\.([\w]*)$/.exec(before);
        var cand = [];
        if (m) {
          var tbl = aliasTable(m[1]);
          if (!tbl) return closePop();
          var cols = sw.cols[tbl.toLowerCase()] || [];
          var pref = m[2].toLowerCase();
          cand = cols.filter(function (c) { return c.name.toLowerCase().indexOf(pref) === 0; }).map(function (c) { return { t: c.name, k: 'столбец', d: c.type + ' · ' + c.desc }; });
          wordStart = pos - m[2].length;
        } else {
          var w = /([A-Za-z_@#][\w]*)$/.exec(before);
          if (!w || w[1].length < 2) return closePop();
          var p = w[1].toLowerCase();
          wordStart = pos - w[1].length;
          sw.tables.forEach(function (t) { if (t.toLowerCase().indexOf(p) === 0) cand.push({ t: t, k: 'таблица' }); });
          Object.keys(sw.allCols).forEach(function (c) { if (c.toLowerCase().indexOf(p) === 0) cand.push({ t: c, k: 'столбец', d: sw.allCols[c] }); });
          KW.forEach(function (k) { if (k.toLowerCase().indexOf(p) === 0 && k.length > p.length) cand.push({ t: k, k: 'слово' }); });
          FUNCS.forEach(function (k) { if (k.toLowerCase().indexOf(p) === 0) cand.push({ t: k, k: 'функция' }); });
          if (cand.length === 1 && cand[0].t.toLowerCase() === p) return closePop();
        }
        if (!cand.length) return closePop();
        items = cand.slice(0, 12); active = 0;
        drawPop();
      }
      function drawPop() {
        U.clear(pop);
        items.forEach(function (it, i) {
          var row = h('div.ed-pop-item' + (i === active ? '.active' : ''), { onmousedown: function (e) { e.preventDefault(); active = i; accept(); } },
            h('span.ed-pop-t', it.t), h('span.ed-pop-k', it.k + (it.d ? ' · ' + it.d : '')));
          pop.appendChild(row);
        });
        // координаты курсора
        var before = ta.value.slice(0, ta.selectionStart).split('\n');
        var row2 = before.length - 1, col = before[before.length - 1].length;
        var cw = charWidth();
        var x = 12 + col * cw - ta.scrollLeft, y = 8 + (row2 + 1) * 21 - ta.scrollTop;
        pop.style.left = (gutter.offsetWidth + Math.min(x, area.clientWidth - 260)) + 'px';
        pop.style.top = (y + 2) + 'px';
        pop.style.display = 'block'; popOpen = true;
      }
      var cwCache = 0;
      function charWidth() {
        if (cwCache) return cwCache;
        var s = h('span', { style: { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre' } }, 'MMMMMMMMMM');
        pre.appendChild(s); cwCache = s.getBoundingClientRect().width / 10 || 8.4; s.remove();
        return cwCache;
      }
      function accept() {
        var it = items[active]; if (!it) return closePop();
        var pos = ta.selectionStart;
        var text = it.t;
        if (it.k === 'функция') text += '(';
        replaceRange(wordStart, pos, text, wordStart + text.length);
        closePop();
      }

      ta.addEventListener('keydown', function (e) {
        if (popOpen) {
          if (e.key === 'ArrowDown') { e.preventDefault(); active = (active + 1) % items.length; drawPop(); return; }
          if (e.key === 'ArrowUp') { e.preventDefault(); active = (active - 1 + items.length) % items.length; drawPop(); return; }
          if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); accept(); return; }
          if (e.key === 'Escape') { e.preventDefault(); closePop(); return; }
        }
        if ((e.key === 'Enter' && (e.ctrlKey || e.metaKey)) || e.key === 'F5') {
          e.preventDefault(); closePop();
          if (opts.onRun) opts.onRun(selectedOrAll());
          return;
        }
        if (e.key === 'Tab') {
          e.preventDefault();
          var s = ta.selectionStart, en = ta.selectionEnd;
          if (s === en && !e.shiftKey) { replaceRange(s, en, '    ', s + 4); return; }
          var lb = lineBounds(s), le = lineBounds(en);
          var block = ta.value.slice(lb[0], le[1]);
          var nb = e.shiftKey ? block.replace(/^ {1,4}/gm, '') : block.replace(/^/gm, '    ');
          replaceRange(lb[0], le[1], nb, lb[0], lb[0] + nb.length);
          return;
        }
        if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          var a = lineBounds(ta.selectionStart), b = lineBounds(ta.selectionEnd);
          var blk = ta.value.slice(a[0], b[1]);
          var allC = blk.split('\n').every(function (l) { return /^\s*--/.test(l) || !l.trim(); });
          var nb2 = allC ? blk.replace(/^(\s*)-- ?/gm, '$1') : blk.replace(/^/gm, '-- ');
          replaceRange(a[0], b[1], nb2, a[0], a[0] + nb2.length);
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          var lb2 = lineBounds(ta.selectionStart);
          var ind = /^\s*/.exec(ta.value.slice(lb2[0], ta.selectionStart))[0];
          if (ind) { e.preventDefault(); var st = ta.selectionStart; replaceRange(st, ta.selectionEnd, '\n' + ind, st + 1 + ind.length); }
        }
      });
      ta.addEventListener('blur', function () { setTimeout(closePop, 150); });
      ta.addEventListener('click', closePop);

      function selectedOrAll() {
        var s = ta.selectionStart, e = ta.selectionEnd;
        if (e > s && ta.value.slice(s, e).trim()) return { sql: ta.value.slice(s, e), partial: true };
        return { sql: ta.value, partial: false };
      }
      render();
      return {
        el: wrap,
        textarea: ta,
        getValue: function () { return ta.value; },
        setValue: function (v) { ta.value = v || ''; render(); sync(); },
        focus: function () { ta.focus(); },
        insert: function (text) { var s = ta.selectionStart; replaceRange(s, ta.selectionEnd, text, s + text.length); },
        run: function () { if (opts.onRun) opts.onRun(selectedOrAll()); },
        setSchema: function (tablesList) { sw = schemaWords(tablesList); }
      };
    }
  };
})(window);
