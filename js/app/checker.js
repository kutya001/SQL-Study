/* ============================================================
   Проверка заданий: сравнение результата ученика с эталоном
   ============================================================ */
(function (G) {
  'use strict';
  var C = G.Checker = {};
  var T = G.TSQL;
  var NUM = { int: 1, decimal: 1, float: 1, bit: 1 };

  C.lastSet = function (res) { return res && res.results && res.results.length ? res.results[res.results.length - 1] : null; };

  // убрать комментарии и строки, чтобы искать ключевые слова в коде
  C.stripCode = function (sql) {
    return String(sql || '').replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/N?'(?:[^']|'')*'/g, "''");
  };

  function norm(v, kind, disp) {
    if (v === null || v === undefined) return '∅';
    if (NUM[kind]) return 'n' + (Math.round(Number(v) * 1e6) / 1e6);
    if (kind === 'date' || kind === 'datetime') return 'd' + v;
    if (typeof disp === 'string' && /^-?\d+(\.\d+)?$/.test(disp.trim())) return 'n' + (Math.round(parseFloat(disp) * 1e6) / 1e6);
    return 's' + String(disp);
  }
  function rowKeys(rs) {
    return rs.raw.map(function (r, i) {
      return r.map(function (v, j) { return norm(v, rs.kinds[j], rs.rows[i][j]); });
    });
  }
  function showRow(rs, i) {
    return '(' + rs.rows[i].map(function (v) { return v === null ? 'NULL' : v; }).join(', ') + ')';
  }

  C.compare = function (user, exp, spec) {
    spec = spec || {};
    if (!user) return { ok: false, msg: 'Запрос не вернул таблицу результатов. Нужен SELECT, который выводит данные.' };
    if (user.columns.length !== exp.columns.length) {
      return { ok: false, msg: 'В вашем результате столбцов: ' + user.columns.length + ', а нужно: ' + exp.columns.length + '. Ожидаемые столбцы: ' + exp.columns.join(', ') + '.' };
    }
    if (user.rows.length !== exp.rows.length) {
      var more = user.rows.length > exp.rows.length;
      return {
        ok: false, msg: 'Получено строк: ' + user.rows.length + ', ожидается: ' + exp.rows.length + '. ' +
          (more ? 'Похоже, в результат попали лишние строки — проверьте условия фильтра, соединения или дубли.' : 'Похоже, часть строк потерялась — возможно, фильтр слишком строгий или соединение отбрасывает строки.')
      };
    }
    var uk = rowKeys(user), ek = rowKeys(exp);
    var us = uk.map(function (r) { return r.join('\u0001'); }), es = ek.map(function (r) { return r.join('\u0001'); });
    // сравнение как мультимножеств
    var cnt = {};
    es.forEach(function (k) { cnt[k] = (cnt[k] || 0) + 1; });
    var extra = -1;
    for (var i = 0; i < us.length; i++) { if (cnt[us[i]]) cnt[us[i]]--; else if (extra < 0) extra = i; }
    if (extra >= 0) {
      var missing = -1;
      var cnt2 = {}; us.forEach(function (k) { cnt2[k] = (cnt2[k] || 0) + 1; });
      for (var j = 0; j < es.length; j++) { if (cnt2[es[j]]) cnt2[es[j]]--; else { missing = j; break; } }
      var msg = 'Количество строк совпадает, но значения отличаются.';
      var trimKey = function (arr) { return arr.map(function (k) { return k.replace(/^s\s+|\s+$/g, function (m) { return m[0] === 's' ? 's' : ''; }); }).join('\u0001'); };
      var tset = {}; ek.forEach(function (r) { var k = trimKey(r); tset[k] = (tset[k] || 0) + 1; });
      var onlySpaces = uk.every(function (r) { var k = trimKey(r); if (tset[k]) { tset[k]--; return true; } return false; });
      if (onlySpaces) return { ok: false, msg: 'Почти верно: значения отличаются только лишними пробелами в начале или конце текста (в таблице их не видно). Например, при склейке с NULL-значением может остаться «висящий» пробел.' };
      if (missing >= 0) msg += ' Например, ожидалась строка ' + showRow(exp, missing) + ', а у вас есть ' + showRow(user, extra) + '.';
      msg += ' Проверьте формулы, порядок столбцов, округление и фильтры.';
      return { ok: false, msg: msg };
    }
    // порядок строк
    if (spec.ordered) {
      for (var k = 0; k < us.length; k++) if (us[k] !== es[k]) return { ok: false, msg: 'Строки верные, но порядок другой. Проверьте ORDER BY (направление ASC/DESC и порядок столбцов сортировки).' };
    } else if (spec.order) {
      for (var r = 1; r < user.raw.length; r++) {
        for (var q = 0; q < spec.order.length; q++) {
          var ci = spec.order[q][0], desc = spec.order[q][1] === 'desc';
          var a = user.raw[r - 1][ci], b = user.raw[r][ci], c;
          if (a === null && b === null) c = 0; else if (a === null) c = -1; else if (b === null) c = 1;
          else c = T.cmpVal(a, b, NUM[user.kinds[ci]] ? 'num' : user.kinds[ci]);
          if (desc) c = -c;
          if (c < 0) break;
          if (c > 0) return { ok: false, msg: 'Строки верные, но они отсортированы не так, как просили. Нужна сортировка: ' + spec.order.map(function (o) { return exp.columns[o[0]] + (o[1] === 'desc' ? ' по убыванию' : ' по возрастанию'); }).join(', затем ') + '.' };
        }
      }
    }
    if (spec.names) {
      for (var n = 0; n < exp.columns.length; n++) {
        if (String(user.columns[n]).toLowerCase() !== String(exp.columns[n]).toLowerCase()) {
          return { ok: false, msg: 'Данные верные, но названия столбцов должны быть: ' + exp.columns.join(', ') + '. Задайте их через AS.' };
        }
      }
    }
    return { ok: true, msg: 'Верно!' };
  };

  // Полная проверка задания
  C.check = function (task, sql, db, opts) {
    opts = opts || {};
    var spec = task.check || {};
    var code = C.stripCode(sql);
    if (!code.trim()) return { ok: false, msg: 'Сначала напишите запрос.' };
    var ures = T.execute(sql, db, opts);
    if (ures.error) return { ok: false, msg: 'Запрос завершился ошибкой — исправьте её и проверьте снова.', res: ures };
    var i;
    if (spec.require) for (i = 0; i < spec.require.length; i++) {
      if (!new RegExp(spec.require[i][0], 'i').test(code)) return { ok: false, msg: spec.require[i][1], res: ures };
    }
    if (spec.forbid) for (i = 0; i < spec.forbid.length; i++) {
      if (new RegExp(spec.forbid[i][0], 'i').test(code)) return { ok: false, msg: spec.forbid[i][1], res: ures };
    }
    var eres = T.execute(task.solution, db, opts);
    if (eres.error) return { ok: false, msg: 'Внутренняя ошибка эталона: ' + eres.error.message, res: ures };
    var r = C.compare(C.lastSet(ures), C.lastSet(eres), spec);
    r.res = ures; r.exp = eres;
    return r;
  };
})(typeof window !== 'undefined' ? window : globalThis);
