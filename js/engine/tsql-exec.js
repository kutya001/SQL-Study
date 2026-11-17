/* ============================================================
   Учебный движок T-SQL. Часть 4: компиляция и выполнение
   ============================================================ */
(function (G) {
  'use strict';
  var T = G.TSQL;
  var err = T.err, TY = T.TY, convert = T.convert;
  var BOOL = { kind: 'bool' };
  var MAX_ROWS = 2000000;
  var NONAME = '(Отсутствует имя столбца)';
  var qid = 0;

  function sub(C, o) { var r = {}; for (var k in C) r[k] = C[k]; for (var j in o) r[j] = o[j]; return r; }
  function tick(session) {
    if (++session.ticks % 20000 === 0 && Date.now() > session.deadline) {
      throw err(50001, 'Запрос выполнялся слишком долго и был остановлен учебным движком. Проверьте условия соединения (ON) и фильтры — возможно, получается огромное количество строк.');
    }
  }

  /* ================= Области видимости ================= */
  function Scope(cols, parent, boundary) { this.cols = cols; this.parent = parent || null; this.boundary = boundary || null; }
  function mkCol(name, type, alias) { return { name: name, lname: (name || '').toLowerCase(), type: type, alias: alias ? alias.toLowerCase() : '', adisp: alias || '' }; }

  function allNames(scope) {
    var out = [];
    for (var s = scope; s; s = s.parent) s.cols.forEach(function (c) { if (c.name) out.push(c.name); });
    return out;
  }
  function suggest(name, list) {
    var best = [], seen = {};
    list.forEach(function (n) {
      var d = T.levenshtein(name, n);
      if ((d <= 2 || (n.toLowerCase().indexOf(name.toLowerCase()) >= 0 && name.length >= 3)) && !seen[n.toLowerCase()]) { seen[n.toLowerCase()] = 1; best.push({ n: n, d: d }); }
    });
    best.sort(function (a, b) { return a.d - b.d; });
    return best.slice(0, 3).map(function (x) { return x.n; });
  }

  function tryResolve(scope, parts) {
    var lname = parts[parts.length - 1].toLowerCase();
    var qual = parts.length > 1 ? parts[parts.length - 2].toLowerCase() : null;
    var depth = 0;
    for (var s = scope; s; s = s.parent, depth++) {
      var found = -1, cnt = 0, aliasSeen = false;
      for (var i = 0; i < s.cols.length; i++) {
        var c = s.cols[i];
        if (qual) { if (c.alias === qual) { aliasSeen = true; if (c.lname === lname) { found = i; cnt++; } } }
        else if (c.lname === lname) { if (found < 0) found = i; cnt++; }
      }
      if (found >= 0) return { depth: depth, idx: found, type: s.cols[found].type, scope: s, count: cnt };
      if (qual && aliasSeen) return null;
    }
    return null;
  }

  function resolveCol(scope, parts, line) {
    var name = parts[parts.length - 1], lname = name.toLowerCase();
    var qual = parts.length > 1 ? parts[parts.length - 2].toLowerCase() : null;
    var depth = 0, crossed = [];
    for (var s = scope; s; s = s.parent, depth++) {
      var found = -1, cnt = 0, aliasSeen = false, foundAliases = {};
      for (var i = 0; i < s.cols.length; i++) {
        var c = s.cols[i];
        if (qual) { if (c.alias === qual) { aliasSeen = true; if (c.lname === lname) { found = i; cnt++; } } }
        else if (c.lname === lname) { if (found < 0) found = i; cnt++; foundAliases[c.alias] = 1; }
      }
      if (qual && aliasSeen && found < 0) {
        var e = err(207, 'Недопустимое имя столбца "' + name + '".', line);
        e.suggest = suggest(name, s.cols.filter(function (c) { return c.alias === qual; }).map(function (c) { return c.name; }));
        throw e;
      }
      if (found >= 0) {
        if (cnt > 1) throw err(209, 'Неоднозначное имя столбца "' + name + '".', line);
        // запоминаем внешние ссылки для кэширования подзапросов
        for (var k = 0; k < crossed.length; k++) {
          var b = crossed[k];
          var rel = depth - (b.depth + 1);
          var key = rel + ':' + found;
          if (!b.scope.boundary.keys[key]) { b.scope.boundary.keys[key] = 1; b.scope.boundary.refs.push({ rel: rel, idx: found }); }
        }
        return { depth: depth, idx: found, type: s.cols[found].type, col: s.cols[found] };
      }
      if (s.boundary) crossed.push({ scope: s, depth: depth });
    }
    if (qual) {
      var e2 = err(4104, 'Не удалось привязать составной идентификатор "' + parts.join('.') + '".', line);
      throw e2;
    }
    var e3 = err(207, 'Недопустимое имя столбца "' + name + '".', line);
    e3.suggest = suggest(name, allNames(scope));
    throw e3;
  }

  function accessor(depth, idx) {
    if (depth === 0) return function (ctx) { return ctx.row[idx]; };
    return function (ctx) {
      var c = ctx;
      for (var k = 0; k < depth; k++) c = c.parent;
      var r = c.row;
      if (r && r.__group) r = r.first;
      return r ? (r[idx] === undefined ? null : r[idx]) : null;
    };
  }
  function relAccess(ctx, rel, idx) {
    var c = ctx;
    for (var k = 0; k < rel; k++) c = c.parent;
    var r = c.row;
    if (r && r.__group) r = r.first;
    return r ? r[idx] : null;
  }

  /* ================= Ключ выражения с учётом привязки ================= */
  function rkey(n, scope) {
    if (n === null || n === undefined) return '~';
    if (Array.isArray(n)) return '[' + n.map(function (x) { return rkey(x, scope); }).join(',') + ']';
    if (typeof n !== 'object') return JSON.stringify(n);
    if (n.type === 'col') {
      var r = tryResolve(scope, n.parts);
      return r ? '@' + r.depth + ':' + r.idx : '?' + n.parts.join('.').toLowerCase();
    }
    if (n.type === 'paren') return rkey(n.expr, scope);
    if (n.type === 'query' || n.type === 'subq' || n.type === 'exists') return '#q' + (n._id || (n._id = ++qid));
    if (n.type === 'lit') return 'L' + (n.value === null ? 'null' : typeof n.value === 'string' ? JSON.stringify(n.value.toLowerCase()) : n.value);
    var keys = Object.keys(n).filter(function (k) { return k !== 'line' && k !== '_id' && k !== 'ltype' && k !== 'neg'; }).sort();
    return '{' + keys.map(function (k) {
      var v = n[k];
      if (k === 'sub' && v && v.type === 'query') return k + ':#q' + (v._id || (v._id = ++qid));
      return k + ':' + (typeof v === 'string' ? v.toLowerCase() : rkey(v, scope));
    }).join(';') + '}';
  }

  /* ================= Поиск агрегатов в выражениях ================= */
  var AGG = { COUNT: 1, COUNT_BIG: 1, SUM: 1, AVG: 1, MIN: 1, MAX: 1, STRING_AGG: 1, STDEV: 1, STDEVP: 1, VAR: 1, VARP: 1 };
  var WINONLY = { ROW_NUMBER: 1, RANK: 1, DENSE_RANK: 1, NTILE: 1, LAG: 1, LEAD: 1, FIRST_VALUE: 1, LAST_VALUE: 1, PERCENT_RANK: 1, CUME_DIST: 1, PERCENTILE_CONT: 1, PERCENTILE_DISC: 1 };
  T.AGG = AGG; T.WINONLY = WINONLY;
  function hasAgg(n) {
    if (!n || typeof n !== 'object') return false;
    if (Array.isArray(n)) return n.some(hasAgg);
    if (n.type === 'query' || n.type === 'subq' || n.type === 'exists') return false;
    if (n.type === 'in' && n.sub) return hasAgg(n.expr);
    if (n.type === 'quant') return hasAgg(n.left);
    if (n.type === 'func' && AGG[n.name] && !n.over) return true;
    for (var k in n) { if (k === 'line') continue; var v = n[k]; if (v && typeof v === 'object' && hasAgg(v)) return true; }
    return false;
  }
  function refersTo(n, lname) {
    if (!n || typeof n !== 'object') return false;
    if (Array.isArray(n)) return n.some(function (x) { return refersTo(x, lname); });
    if (n.type === 'table' && n.parts && n.parts.length === 1 && n.name.toLowerCase() === lname) return true;
    for (var k in n) { var v = n[k]; if (v && typeof v === 'object' && refersTo(v, lname)) return true; }
    return false;
  }

  /* ================= Компиляция выражений ================= */
  function val(n, C) {
    var r = cx(n, C);
    if (r.type === BOOL) {
      var op = n.type === 'cmp' ? n.op : n.type === 'and' ? 'AND' : n.type === 'or' ? 'OR' : n.type === 'like' ? 'LIKE' : n.type === 'in' ? 'IN' : n.type === 'between' ? 'BETWEEN' : n.type === 'isnull' ? 'IS' : n.type === 'exists' ? 'EXISTS' : n.type === 'not' ? 'NOT' : '=';
      var e = err(102, 'Неправильный синтаксис около конструкции "' + op + '".', n.line);
      e.hintText = 'Условие (сравнение, AND/OR, LIKE, IN...) нельзя использовать как значение столбца. Чтобы вывести результат проверки, оберните его в CASE WHEN ... THEN 1 ELSE 0 END или IIF(условие, 1, 0).';
      throw e;
    }
    return r;
  }
  function cond(n, C) {
    var r = cx(n, C);
    if (r.type !== BOOL) {
      var e = err(4145, 'Выражение небулевого типа указано в контексте, где ожидается условие.', n.line);
      e.hintText = 'После WHERE / HAVING / ON / WHEN должно стоять условие со сравнением, например: Amount > 1000. Одного столбца или числа недостаточно.';
      throw e;
    }
    return r;
  }
  T._val = val;

  function convFn(a, target, C) {
    var from = a.type;
    if (from.kind === 'null') return function () { return null; };
    if (from.kind === target.kind && from.kind !== 'str' && from.kind !== 'decimal') return a.fn;
    if (from.kind === 'str' && target.kind === 'str') {
      if (target.len >= 0 && (from.len < 0 || from.len > target.len)) return function (ctx) { var v = a.fn(ctx); return v === null ? null : v.substr(0, target.len); };
      return a.fn;
    }
    if ((from.kind === 'int' || from.kind === 'decimal' || from.kind === 'bit') && target.kind === 'decimal' && from.kind !== 'decimal') return a.fn;
    if (from.kind === 'decimal' && target.kind === 'decimal') {
      if (target.s >= from.s) return a.fn;
      return function (ctx) { var v = a.fn(ctx); return v === null ? null : T.roundHalfAway(v, target.s); };
    }
    if (from.kind === 'date' && target.kind === 'datetime') return a.fn;
    var sess = C.session;
    return function (ctx) { var v = a.fn(ctx); return v === null ? null : convert(v, from, target, { settings: sess.settings }); };
  }

  // Приведение двух операндов к общему типу для сравнения
  function coerce(list, C, line) {
    var t = TY.nul();
    list.forEach(function (x) { t = T.strongerType(t, x.type); });
    if (t.kind === 'null') return { kind: 'null', fns: list.map(function () { return function () { return null; }; }) };
    list.forEach(function (x) {
      if (!T.implicitOk(x.type, t)) {
        var other = list.filter(function (y) { return y !== x; })[0] || x;
        throw err(206, 'Конфликт типов операндов: ' + T.typeName(x.type) + ' несовместим с ' + T.typeName(t.kind === x.type.kind ? other.type : t), line);
      }
    });
    var target = t;
    if (t.kind === 'decimal') target = TY.dec(38, 10);
    var fns = list.map(function (x) {
      if (x.type.kind === 'str' && target.kind === 'str') return x.fn;
      if ((x.type.kind === 'int' || x.type.kind === 'decimal' || x.type.kind === 'float' || x.type.kind === 'bit') && (target.kind === 'decimal' || target.kind === 'float' || target.kind === 'int')) return x.fn;
      if (x.type.kind === 'date' && target.kind === 'datetime') return x.fn;
      return convFn(x, target, C);
    });
    var kind = target.kind;
    if (kind === 'int' || kind === 'decimal' || kind === 'float' || kind === 'bit') kind = 'num';
    return { kind: kind, fns: fns };
  }

  function cmpOp(op, c) {
    switch (op) {
      case '=': return c === 0; case '<>': return c !== 0; case '<': return c < 0;
      case '>': return c > 0; case '<=': return c <= 0; case '>=': return c >= 0;
    }
    return false;
  }

  function cx(n, C) {
    // в режиме группировки выражение может совпадать с выражением GROUP BY
    if (C.mode === 'group' && C.keys && C.keys.length && n.type !== 'lit' && n.type !== 'var' && n.type !== 'sysvar' && !(n.type === 'func' && (AGG[n.name] || n.over))) {
      var k = rkey(n, C.scope);
      for (var i = 0; i < C.keys.length; i++) {
        if (C.keys[i].rk === k) {
          var ki = i;
          return { type: C.keys[i].type, fn: function (ctx) { return ctx.row.keys[ki]; } };
        }
      }
    }
    switch (n.type) {
      case 'lit': {
        var v = n.value;
        return { type: n.ltype, fn: function () { return v; }, isConst: true };
      }
      case 'paren': return cx(n.expr, C);
      case 'col': {
        var r = resolveCol(C.scope, n.parts, n.line);
        if (r.depth === 0) {
          if (C.mode === 'group') {
            var nm = (r.col.adisp ? r.col.adisp + '.' : '') + r.col.name;
            if (C.clause === 'HAVING') throw err(8121, 'Столбец "' + nm + '" недопустим в предложении HAVING, поскольку он не содержится ни в агрегатной функции, ни в предложении GROUP BY.', n.line);
            if (C.clause === 'ORDER BY') throw err(8127, 'Столбец "' + nm + '" недопустим в предложении ORDER BY, поскольку он не содержится ни в агрегатной функции, ни в предложении GROUP BY.', n.line);
            throw err(8120, 'Столбец "' + nm + '" недопустим в списке выбора, поскольку он не содержится ни в агрегатной функции, ни в предложении GROUP BY.', n.line);
          }
          var idx = r.idx;
          return { type: r.type, fn: function (ctx) { return ctx.row[idx]; } };
        }
        return { type: r.type, fn: accessor(r.depth, r.idx) };
      }
      case 'var': {
        var lname = n.name.toLowerCase(), vars = C.session.vars;
        if (!vars[lname]) throw err(137, 'Необходимо объявить скалярную переменную "' + n.name + '".', n.line);
        return { type: vars[lname].type, fn: function () { return vars[lname].value; } };
      }
      case 'sysvar': return sysvar(n, C);
      case 'unary': {
        var a = val(n.expr, C);
        if (n.op === '-') {
          if (a.type.kind === 'str' || T.isDateT(a.type)) throw err(8117, 'Тип данных операнда ' + T.typeName(a.type) + ' недопустим для оператора минус.', n.line);
          return { type: a.type.kind === 'null' ? TY.int() : a.type, fn: function (ctx) { var x = a.fn(ctx); return x === null ? null : -x; } };
        }
        if (n.op === '~') return { type: a.type, fn: function (ctx) { var x = a.fn(ctx); return x === null ? null : ~x; } };
        return a;
      }
      case 'bin': return arith(n, C);
      case 'cmp': {
        var L = val(n.left, C), R = val(n.right, C);
        var co = coerce([L, R], C, n.line), lf = co.fns[0], rf = co.fns[1], kind = co.kind, op = n.op;
        if (kind === 'null') return { type: BOOL, fn: function () { return null; } };
        return { type: BOOL, fn: function (ctx) { var x = lf(ctx); if (x === null) return null; var y = rf(ctx); if (y === null) return null; return cmpOp(op, kind === 'str' || kind === 'guid' ? T.cmpStr(x, y) : (x < y ? -1 : x > y ? 1 : 0)); } };
      }
      case 'and': {
        var A = cond(n.left, C), B = cond(n.right, C);
        return { type: BOOL, fn: function (ctx) { var x = A.fn(ctx); if (x === false) return false; var y = B.fn(ctx); if (y === false) return false; return (x === null || y === null) ? null : true; } };
      }
      case 'or': {
        var A2 = cond(n.left, C), B2 = cond(n.right, C);
        return { type: BOOL, fn: function (ctx) { var x = A2.fn(ctx); if (x === true) return true; var y = B2.fn(ctx); if (y === true) return true; return (x === null || y === null) ? null : false; } };
      }
      case 'not': {
        var N = cond(n.expr, C);
        return { type: BOOL, fn: function (ctx) { var x = N.fn(ctx); return x === null ? null : !x; } };
      }
      case 'isnull': {
        var X = val(n.expr, C), neg = n.not;
        return { type: BOOL, fn: function (ctx) { var x = X.fn(ctx); return neg ? x !== null : x === null; } };
      }
      case 'between': {
        var E = val(n.expr, C), LO = val(n.lo, C), HI = val(n.hi, C);
        var cb = coerce([E, LO, HI], C, n.line), ef = cb.fns[0], lof = cb.fns[1], hif = cb.fns[2], bk = cb.kind, bneg = n.not;
        var cmpb = bk === 'str' ? T.cmpStr : function (x, y) { return x < y ? -1 : x > y ? 1 : 0; };
        return {
          type: BOOL, fn: function (ctx) {
            var x = ef(ctx), lo = lof(ctx), hi = hif(ctx);
            var r1 = (x === null || lo === null) ? null : cmpb(x, lo) >= 0;
            var r2 = (x === null || hi === null) ? null : cmpb(x, hi) <= 0;
            var r = (r1 === false || r2 === false) ? false : (r1 === null || r2 === null) ? null : true;
            return bneg ? (r === null ? null : !r) : r;
          }
        };
      }
      case 'in': return inPred(n, C);
      case 'like': {
        var LE = val(n.expr, C), LP = val(n.pattern, C);
        var sf = T.strFn(LE), pf = T.strFn(LP), esc = n.escape ? T.strFn(val(n.escape, C)) : null, lneg = n.not;
        var cache = {};
        return {
          type: BOOL, fn: function (ctx) {
            var s = sf(ctx), p = pf(ctx);
            if (s === null || p === null) return null;
            var e = esc ? esc(ctx) : null;
            var key = p + '\u0001' + (e || '');
            var re = cache[key] || (cache[key] = T.likeToRegex(p, e));
            var m = re.test(s);
            return lneg ? !m : m;
          }
        };
      }
      case 'exists': {
        var plan = compileSubquery(n.sub, C);
        return { type: BOOL, fn: function (ctx) { return plan.exec(ctx).length > 0; } };
      }
      case 'quant': {
        var QL = val(n.left, C), qp = compileSubquery(n.sub, C);
        if (qp.cols.length !== 1) throw err(116, 'Если вложенный запрос не начинается с EXISTS, в списке выбора можно указать только одно выражение.', n.line);
        var qt = { type: qp.cols[0].type, fn: null };
        var qco = coerce([QL, qt], C, n.line), qk = qco.kind;
        var qcmp = qk === 'str' ? T.cmpStr : function (x, y) { return x < y ? -1 : x > y ? 1 : 0; };
        var qsrc = qp.cols[0].type, qtarget = T.strongerType(QL.type, qsrc), qop = n.op, isAll = n.quant === 'ALL';
        return {
          type: BOOL, fn: function (ctx) {
            var x = qco.fns[0](ctx);
            var rows = qp.exec(ctx);
            var anyNull = false;
            if (x === null) return rows.length ? null : (isAll ? true : false);
            for (var i = 0; i < rows.length; i++) {
              var y = rows[i][0];
              if (y === null) { anyNull = true; continue; }
              if (qsrc.kind !== qtarget.kind && !(T.isNum(qsrc) && T.isNum(qtarget))) y = convert(y, qsrc, qtarget, { settings: C.session.settings });
              var r = cmpOp(qop, qcmp(x, y));
              if (isAll && !r) return false;
              if (!isAll && r) return true;
            }
            if (anyNull) return null;
            return isAll;
          }
        };
      }
      case 'case': return caseExpr(n, C);
      case 'cast': {
        var CE = val(n.expr, C), to = n.dtype, styleFn = n.style ? val(n.style, C).fn : null, tryM = n.tryMode, sess = C.session, from = CE.type;
        if (from.kind === 'null') return { type: to, fn: function () { return null; } };
        return {
          type: to, fn: function (ctx) {
            var v = CE.fn(ctx); if (v === null) return null;
            return convert(v, from, to, { style: styleFn ? styleFn(ctx) : null, settings: sess.settings, tryMode: tryM });
          }
        };
      }
      case 'subq': {
        var sp = compileSubquery(n.query, C);
        if (sp.cols.length !== 1) throw err(116, 'Если вложенный запрос не начинается с EXISTS, в списке выбора можно указать только одно выражение.', n.line);
        return {
          type: sp.cols[0].type, fn: function (ctx) {
            var rows = sp.exec(ctx);
            if (rows.length > 1) throw err(512, 'Вложенный запрос вернул больше одного значения. Это запрещено, когда вложенный запрос следует после =, !=, <, <=, >, >= или используется в качестве выражения.', n.line);
            return rows.length ? rows[0][0] : null;
          }
        };
      }
      case 'func': return funcCall(n, C);
      default:
        throw err(102, 'Неправильный синтаксис.', n.line);
    }
  }

  function sysvar(n, C) {
    var s = C.session;
    switch (n.name) {
      case '@@VERSION': return { type: TY.str(200, true), fn: function () { return 'Учебный движок T-SQL (подмножество Microsoft SQL Server 2022, только чтение) — работает в браузере'; } };
      case '@@DATEFIRST': return { type: TY.int('tinyint'), fn: function () { return s.settings.datefirst; } };
      case '@@LANGUAGE': return { type: TY.str(128, true), fn: function () { return s.settings.language === 'russian' ? 'Русский' : 'us_english'; } };
      case '@@ROWCOUNT': return { type: TY.int(), fn: function () { return s.rowcount || 0; } };
      case '@@SERVERNAME': return { type: TY.str(128, true), fn: function () { return 'SQL-KURS'; } };
      case '@@SPID': return { type: TY.int('smallint'), fn: function () { return 57; } };
    }
    throw err(137, 'Необходимо объявить скалярную переменную "' + n.name + '".', n.line);
  }

  // Целая константа рядом с decimal: SQL Server берёт её с минимальной точностью (3 → numeric(1,0)),
  // а столбцы и переменные int — как numeric(10,0). Поэтому 7.0 / 2 = 3.500000, а Amount / 3 даёт 6 знаков.
  function litDec(node, t) {
    while (node && node.type === 'paren') node = node.expr;
    if (t.kind === 'int' && node && node.type === 'lit' && typeof node.value === 'number') return TY.dec(Math.max(1, String(Math.abs(node.value)).length), 0);
    return T.asDec(t);
  }
  function arith(n, C) {
    var L = val(n.left, C), R = val(n.right, C), op = n.op;
    var lt = L.type, rt = R.type;
    if (lt.kind === 'null' && rt.kind === 'null') return { type: TY.int(), fn: function () { return null; } };
    if (lt.kind === 'null') lt = rt.kind === 'str' ? TY.str(1) : rt;
    if (rt.kind === 'null') rt = lt.kind === 'str' ? TY.str(1) : lt;
    var lk = lt.kind, rk = rt.kind;
    var lf = L.fn, rf = R.fn;
    var opName = { '+': 'add', '-': 'subtract', '*': 'multiply', '/': 'divide', '%': 'modulo', '&': '&', '|': '|', '^': '^' }[op];
    // склейка строк
    if (op === '+' && lk === 'str' && rk === 'str') {
      var nv = lt.n || rt.n, len = (lt.len < 0 || rt.len < 0) ? -1 : lt.len + rt.len;
      if (len > (nv ? 4000 : 8000)) len = nv ? 4000 : 8000;
      return { type: TY.str(len, nv), fn: function (ctx) { var a = lf(ctx); if (a === null) return null; var b = rf(ctx); if (b === null) return null; return a + b; } };
    }
    if (lk === 'str' && rk === 'str') throw err(8117, 'Тип данных операнда ' + (lt.n ? 'nvarchar' : 'varchar') + ' недопустим для оператора ' + opName + '.', n.line);
    if (lk === 'guid' || rk === 'guid') throw err(8117, 'Тип данных операнда uniqueidentifier недопустим для оператора ' + opName + '.', n.line);
    // даты
    if (lk === 'date' || rk === 'date') {
      var other = lk === 'date' ? rt : lt;
      if (other.kind === 'date' || other.kind === 'datetime') throw err(8117, 'Тип данных операнда date недопустим для оператора ' + opName + '.', n.line);
      throw err(206, 'Конфликт типов операндов: date несовместим с ' + T.typeName(other), n.line);
    }
    var sess = C.session;
    if (lk === 'datetime' || rk === 'datetime') {
      if (op !== '+' && op !== '-') throw err(8117, 'Тип данных операнда datetime недопустим для оператора ' + opName + '.', n.line);
      var base = T.mkDate(1900, 1, 1);
      var toOffset = function (t, f) {
        if (t.kind === 'datetime') return function (ctx) { var v = f(ctx); return v === null ? null : v - base; };
        if (t.kind === 'str') return function (ctx) { var v = f(ctx); return v === null ? null : convert(v, t, TY.datetime(), { settings: sess.settings }) - base; };
        return function (ctx) { var v = f(ctx); return v === null ? null : Number(v) * 86400000; };
      };
      var a1 = toOffset(lt, lf), b1 = toOffset(rt, rf);
      return { type: TY.datetime(), fn: function (ctx) { var a = a1(ctx); if (a === null) return null; var b = b1(ctx); if (b === null) return null; return base + (op === '+' ? a + b : a - b); } };
    }
    // числа (строку приводим к числу)
    if (lk === 'str') { var t1 = (rk === 'int' || rk === 'bit') ? TY.int() : TY.dec(38, 10); lf = convFn({ type: lt, fn: lf }, t1, C); lt = rk === 'float' ? TY.float() : (rk === 'decimal' ? rt : TY.int()); lk = lt.kind; if (rk === 'float') { var lf0 = lf; lf = lf0; } }
    if (rk === 'str') { var t2 = (lk === 'int' || lk === 'bit') ? TY.int() : TY.dec(38, 10); rf = convFn({ type: rt, fn: rf }, t2, C); rt = lk === 'float' ? TY.float() : (lk === 'decimal' ? lt : TY.int()); rk = rt.kind; }
    if (lk === 'bit') { lt = TY.int(); lk = 'int'; }
    if (rk === 'bit') { rt = TY.int(); rk = 'int'; }
    var type;
    if (lk === 'float' || rk === 'float') type = TY.float();
    else if (lk === 'decimal' || rk === 'decimal') {
      var d1 = litDec(n.left, lt), d2 = litDec(n.right, rt), p, s;
      switch (op) {
        case '+': case '-': s = Math.max(d1.s, d2.s); p = s + Math.max(d1.p - d1.s, d2.p - d2.s) + 1; break;
        case '*': p = d1.p + d2.p + 1; s = d1.s + d2.s; break;
        case '/': s = Math.max(6, d1.s + d2.p + 1); p = d1.p - d1.s + d2.s + s; break;
        case '%': s = Math.max(d1.s, d2.s); p = Math.min(d1.p - d1.s, d2.p - d2.s) + s; break;
        default: throw err(402, 'Типы данных ' + T.typeName(lt) + ' и ' + T.typeName(rt) + ' несовместимы в операторе ' + op + '.', n.line);
      }
      type = T.capDec(p, s);
    } else {
      type = (lt.sub === 'bigint' || rt.sub === 'bigint') ? TY.int('bigint') : TY.int();
    }
    var kind = type.kind, sc = type.s, big = type.sub === 'bigint';
    return {
      type: type, fn: function (ctx) {
        var a = lf(ctx); if (a === null) return null;
        var b = rf(ctx); if (b === null) return null;
        var r;
        switch (op) {
          case '+': r = a + b; break;
          case '-': r = a - b; break;
          case '*': r = a * b; break;
          case '/':
            if (b === 0) throw err(8134, 'Обнаружена ошибка: деление на ноль.', n.line);
            r = kind === 'int' ? Math.trunc(a / b) : a / b; break;
          case '%':
            if (b === 0) throw err(8134, 'Обнаружена ошибка: деление на ноль.', n.line);
            r = a % b; break;
          case '&': r = a & b; break;
          case '|': r = a | b; break;
          case '^': r = a ^ b; break;
        }
        if (kind === 'decimal') return T.roundHalfAway(r, sc);
        if (kind === 'int' && !big && (r > 2147483647 || r < -2147483648)) throw err(8115, 'Ошибка арифметического переполнения при преобразовании выражения к типу данных int.', n.line);
        return r;
      }
    };
  }

  function inPred(n, C) {
    var X = val(n.expr, C), neg = n.not;
    if (n.sub) {
      var sp = compileSubquery(n.sub, C);
      if (sp.cols.length !== 1) throw err(116, 'Если вложенный запрос не начинается с EXISTS, в списке выбора можно указать только одно выражение.', n.line);
      var st = sp.cols[0].type;
      var co = coerce([X, { type: st, fn: function () { return null; } }], C, n.line), kind = co.kind;
      var target = T.strongerType(X.type, st);
      var xf = co.fns[0];
      var conv = (st.kind === target.kind || (T.isNum(st) && T.isNum(target)) || (st.kind === 'date' && target.kind === 'datetime')) ? null : function (v) { return convert(v, st, target, { settings: C.session.settings }); };
      var setCache = new Map();
      return {
        type: BOOL, fn: function (ctx) {
          var rows = sp.exec(ctx);
          var entry = setCache.get(rows);
          if (!entry) {
            var keys = new Set(), hasNull = false;
            for (var i = 0; i < rows.length; i++) { var v = rows[i][0]; if (v === null) { hasNull = true; continue; } if (conv) v = conv(v); keys.add(T.keyOf(v, kind === 'num' ? 'int' : kind)); }
            entry = { keys: keys, hasNull: hasNull, empty: rows.length === 0 };
            setCache.set(rows, entry);
          }
          if (entry.empty) return neg ? true : false;
          var x = xf(ctx);
          if (x === null) return null;
          var hit = entry.keys.has(T.keyOf(x, kind === 'num' ? 'int' : kind));
          var r = hit ? true : (entry.hasNull ? null : false);
          return neg ? (r === null ? null : !r) : r;
        }
      };
    }
    var items = n.list.map(function (e) { return val(e, C); });
    var co2 = coerce([X].concat(items), C, n.line), k2 = co2.kind;
    var xf2 = co2.fns[0], ifs = co2.fns.slice(1);
    var cmp = k2 === 'str' ? T.cmpStr : function (a, b) { return a < b ? -1 : a > b ? 1 : 0; };
    return {
      type: BOOL, fn: function (ctx) {
        var x = xf2(ctx);
        var anyNull = false;
        if (x === null) return null;
        for (var i = 0; i < ifs.length; i++) {
          var y = ifs[i](ctx);
          if (y === null) { anyNull = true; continue; }
          if (cmp(x, y) === 0) return neg ? false : true;
        }
        if (anyNull) return null;
        return neg ? true : false;
      }
    };
  }

  function caseExpr(n, C) {
    var results = n.whens.map(function (w) { return val(w.then, C); });
    var els = n.els ? val(n.els, C) : null;
    var all = els ? results.concat([els]) : results;
    var t = T.unifyTypes(all, C);
    if (all.every(function (x) { return x.type.kind === 'null'; })) t = TY.int();
    var rfs = results.map(function (x) { return convFn(x, t, C); });
    var ef = els ? convFn(els, t, C) : function () { return null; };
    var conds;
    if (n.operand) {
      var O = val(n.operand, C);
      conds = n.whens.map(function (w) {
        var W = val(w.when, C);
        var co = coerce([O, W], C, n.line), k = co.kind;
        var of = co.fns[0], wf = co.fns[1];
        return function (ctx) { var a = of(ctx); if (a === null) return null; var b = wf(ctx); if (b === null) return null; return (k === 'str' ? T.cmpStr(a, b) : (a < b ? -1 : a > b ? 1 : 0)) === 0; };
      });
    } else {
      conds = n.whens.map(function (w) { return cond(w.when, C).fn; });
    }
    return {
      type: t, fn: function (ctx) {
        for (var i = 0; i < conds.length; i++) if (conds[i](ctx) === true) return rfs[i](ctx);
        return ef(ctx);
      }
    };
  }

  function funcCall(n, C) {
    var name = n.name;
    if (n.over) return windowFn(n, C);
    if (AGG[name]) return aggregate(n, C);
    if (name === 'GROUPING' || name === 'GROUPING_ID') return groupingFn(n, C);
    if (WINONLY[name]) throw err(10753, 'Функция "' + name.toLowerCase() + '" должна иметь предложение OVER.', n.line);
    if (name === 'IIF') {
      if (n.args.length !== 3) throw err(174, 'Функции iif требуется 3 аргументов.', n.line);
      var cnd = cond(n.args[0], C), a = val(n.args[1], C), b = val(n.args[2], C);
      var t = T.unifyTypes([a, b], C);
      var af = convFn(a, t, C), bf = convFn(b, t, C);
      return { type: t, fn: function (ctx) { return cnd.fn(ctx) === true ? af(ctx) : bf(ctx); } };
    }
    var def = T.FN[name];
    if (!def) {
      var e = err(195, '"' + n.name.toLowerCase() + '" не является распознаваемым именем встроенной функции.', n.line);
      e.suggest = suggest(n.name, Object.keys(T.FN).concat(Object.keys(AGG)).concat(Object.keys(WINONLY)));
      throw e;
    }
    if (n.star) throw err(102, 'Неправильный синтаксис около конструкции "*".', n.line);
    if (n.distinct) throw err(102, 'Неправильный синтаксис около ключевого слова "DISTINCT".', n.line);
    if (n.args.length < def.min || n.args.length > def.max) {
      var need = def.min === def.max ? String(def.min + (n.datepart ? 1 : 0)) : ('от ' + (def.min + (n.datepart ? 1 : 0)) + ' до ' + (def.max + (n.datepart ? 1 : 0)));
      throw err(174, 'Функции ' + name.toLowerCase() + ' требуется ' + need + ' аргументов.', n.line);
    }
    var args = n.args.map(function (x) { return val(x, C); });
    return def.compile(args, n, C);
  }

  /* ---------- агрегаты ---------- */
  function aggType(name, t, line) {
    var k = t.kind;
    switch (name) {
      case 'COUNT': return TY.int();
      case 'COUNT_BIG': return TY.int('bigint');
      case 'SUM': case 'AVG':
        if (k === 'str' || k === 'date' || k === 'datetime' || k === 'bit' || k === 'guid') throw err(8117, 'Тип данных операнда ' + T.typeName(t) + ' недопустим для оператора ' + name.toLowerCase() + '.', line);
        if (k === 'int' || k === 'null') return t.sub === 'bigint' ? TY.int('bigint') : TY.int();
        if (k === 'decimal') return name === 'SUM' ? TY.dec(38, t.s) : TY.dec(38, Math.max(t.s, 6));
        return TY.float();
      case 'MIN': case 'MAX':
        if (k === 'bit') throw err(8117, 'Тип данных операнда bit недопустим для оператора ' + name.toLowerCase() + '.', line);
        return k === 'null' ? TY.int() : t;
      case 'STDEV': case 'STDEVP': case 'VAR': case 'VARP':
        if (k === 'str' || k === 'date' || k === 'datetime') throw err(8117, 'Тип данных операнда ' + T.typeName(t) + ' недопустим для оператора ' + name.toLowerCase() + '.', line);
        return TY.float();
      case 'STRING_AGG': return TY.str(t.kind === 'str' && t.len < 0 ? -1 : (t.n ? 4000 : 8000), t.kind === 'str' && t.n);
    }
    return t;
  }
  function aggregate(n, C) {
    if (C.inAgg) throw err(130, 'Невозможно выполнить статистическую функцию для выражения, содержащего статистическую функцию или вложенный запрос.', n.line);
    if (C.mode !== 'group') {
      if (C.clause === 'GROUP BY') throw err(144, 'Нельзя использовать статистическую функцию или вложенный запрос в выражении, используемом в списке GROUP BY предложения GROUP BY.', n.line);
      var e = err(147, 'Агрегат не может находиться в предложении ' + (C.clause === 'ON' ? 'ON' : 'WHERE') + ', если он не входит во вложенный запрос в предложении HAVING или в список выбора, и столбец, подвергаемый статистической обработке, не является внешней ссылкой.', n.line);
      e.hintText = 'Агрегатные функции (SUM, COUNT, AVG...) считаются после фильтрации WHERE. Чтобы фильтровать по агрегату, используйте HAVING после GROUP BY.';
      throw e;
    }
    var name = n.name;
    var argC = sub(C, { mode: 'row', keys: null, inAgg: true, allowWin: false });
    var desc = { name: name, distinct: !!n.distinct, star: !!n.star, args: [], within: null };
    if (n.star) {
      if (name !== 'COUNT' && name !== 'COUNT_BIG') throw err(102, 'Неправильный синтаксис около конструкции "*".', n.line);
      desc.type = name === 'COUNT' ? TY.int() : TY.int('bigint');
    } else {
      if (!n.args.length) throw err(174, 'Функции ' + name.toLowerCase() + ' требуется 1 аргументов.', n.line);
      if (name === 'STRING_AGG') {
        if (n.args.length !== 2) throw err(174, 'Функции string_agg требуется 2 аргументов.', n.line);
        desc.args = [val(n.args[0], argC), val(n.args[1], argC)];
        if (n.withinGroup) desc.within = n.withinGroup.map(function (o) { var c = val(o.expr, argC); return { fn: c.fn, desc: o.desc, kind: c.type.kind }; });
      } else {
        if (n.args.length !== 1) throw err(174, 'Функции ' + name.toLowerCase() + ' требуется 1 аргументов.', n.line);
        desc.args = [val(n.args[0], argC)];
      }
      desc.type = aggType(name, desc.args[0].type, n.line);
      desc.argKind = desc.args[0].type.kind;
    }
    var k = C.aggs.length;
    C.aggs.push(desc);
    return { type: desc.type, fn: function (ctx) { return ctx.row.aggs[k]; } };
  }
  function computeAgg(d, rows, rctx) {
    if (d.star) return rows.length;
    var f = d.args[0].fn, vals = [], i, v, keyRows = [];
    for (i = 0; i < rows.length; i++) {
      rctx.row = rows[i];
      v = f(rctx);
      if (v !== null) { vals.push(v); if (d.within) keyRows.push(rows[i]); }
    }
    if (d.distinct) {
      var seen = new Set(), u = [];
      for (i = 0; i < vals.length; i++) { var kk = T.keyOf(vals[i], d.argKind); if (!seen.has(kk)) { seen.add(kk); u.push(vals[i]); } }
      vals = u;
    }
    return aggregateValues(d.name, d.type, d.argKind, vals, d, keyRows, rctx);
  }
  function aggregateValues(name, type, argKind, vals, d, keyRows, rctx) {
    var i, s;
    switch (name) {
      case 'COUNT': case 'COUNT_BIG': return vals.length;
      case 'SUM':
        if (!vals.length) return null;
        s = 0; for (i = 0; i < vals.length; i++) s += vals[i];
        if (type.kind === 'decimal') return T.roundHalfAway(s, type.s);
        if (type.kind === 'int' && type.sub !== 'bigint' && (s > 2147483647 || s < -2147483648)) throw err(8115, 'Ошибка арифметического переполнения при преобразовании выражения к типу данных int.');
        return s;
      case 'AVG':
        if (!vals.length) return null;
        s = 0; for (i = 0; i < vals.length; i++) s += vals[i];
        if (type.kind === 'int') return Math.trunc(s / vals.length);
        if (type.kind === 'decimal') return T.roundHalfAway(s / vals.length, type.s);
        return s / vals.length;
      case 'MIN': case 'MAX': {
        if (!vals.length) return null;
        var best = vals[0];
        for (i = 1; i < vals.length; i++) { var c = T.cmpVal(vals[i], best, argKind); if (name === 'MIN' ? c < 0 : c > 0) best = vals[i]; }
        return best;
      }
      case 'STDEV': case 'STDEVP': case 'VAR': case 'VARP': {
        var nn = vals.length; if (nn === 0 || ((name === 'STDEV' || name === 'VAR') && nn < 2)) return null;
        var mean = 0; for (i = 0; i < nn; i++) mean += vals[i]; mean /= nn;
        var ss = 0; for (i = 0; i < nn; i++) ss += (vals[i] - mean) * (vals[i] - mean);
        var vr = ss / ((name === 'STDEV' || name === 'VAR') ? nn - 1 : nn);
        return name.indexOf('STDEV') === 0 ? Math.sqrt(vr) : vr;
      }
      case 'STRING_AGG': {
        if (!vals.length) return null;
        var at = d.args[0].type;
        var strs = vals.map(function (x) { return at.kind === 'str' ? x : convert(x, at, TY.str(-1)); });
        if (d.within) {
          var idx = strs.map(function (_, j) { return j; });
          var keys = keyRows.map(function (r) { rctx.row = r; return d.within.map(function (w) { return w.fn(rctx); }); });
          idx.sort(function (a, b) {
            for (var q = 0; q < d.within.length; q++) {
              var x = keys[a][q], y = keys[b][q], w = d.within[q], c;
              if (x === null && y === null) c = 0; else if (x === null) c = -1; else if (y === null) c = 1; else c = T.cmpVal(x, y, w.kind);
              if (c) return w.desc ? -c : c;
            }
            return a - b;
          });
          strs = idx.map(function (j) { return strs[j]; });
        }
        rctx.row = keyRows[0] || null;
        var sep = d.args[1].fn(rctx);
        return strs.join(sep === null ? '' : sep);
      }
    }
    return null;
  }

  function groupingFn(n, C) {
    if (C.mode !== 'group' || !C.keys) throw err(8161, 'Функцию GROUPING можно использовать только вместе с GROUP BY.', n.line);
    var idxs = n.args.map(function (a) {
      var rk = rkey(a, C.scope);
      for (var i = 0; i < C.keys.length; i++) if (C.keys[i].rk === rk) return i;
      throw err(8161, 'Аргумент функции ' + n.name + ' не совпадает ни с одним выражением из предложения GROUP BY.', n.line);
    });
    if (n.name === 'GROUPING') {
      if (idxs.length !== 1) throw err(174, 'Функции grouping требуется 1 аргументов.', n.line);
      var i0 = idxs[0];
      return { type: TY.int('tinyint'), fn: function (ctx) { return ctx.row.grouping ? ctx.row.grouping[i0] : 0; } };
    }
    return { type: TY.int(), fn: function (ctx) { var r = 0; for (var i = 0; i < idxs.length; i++) r = r * 2 + (ctx.row.grouping ? ctx.row.grouping[idxs[i]] : 0); return r; } };
  }

  /* ---------- оконные функции ---------- */
  function windowFn(n, C) {
    var name = n.name;
    if (!C.allowWin) throw err(4108, 'Оконные функции могут использоваться только в предложениях SELECT или ORDER BY.', n.line);
    if (C.inAgg || C.inWin) throw err(4109, 'Оконные функции не могут использоваться в контексте другой оконной функции или статистической функции.', n.line);
    var isAgg = AGG[name] && name !== 'STRING_AGG';
    if (!WINONLY[name] && !isAgg) throw err(4113, 'Функция "' + name.toLowerCase() + '" не является допустимой оконной функцией и не может использоваться с предложением OVER.', n.line);
    if (n.distinct) throw err(10759, 'Использование DISTINCT не допускается с предложением OVER.', n.line);
    var wC = sub(C, { allowWin: false, inWin: true });
    var w = n.over;
    var desc = { name: name, line: n.line };
    desc.partition = (w.partition || []).map(function (e) { var c = val(e, wC); return { fn: c.fn, kind: c.type.kind }; });
    desc.order = (w.order || []).map(function (o) { var c = val(o.expr, wC); return { fn: c.fn, desc: o.desc, kind: c.type.kind }; });
    var needOrder = { ROW_NUMBER: 1, RANK: 1, DENSE_RANK: 1, NTILE: 1, LAG: 1, LEAD: 1, FIRST_VALUE: 1, LAST_VALUE: 1, PERCENT_RANK: 1, CUME_DIST: 1 };
    var noFrame = { ROW_NUMBER: 1, RANK: 1, DENSE_RANK: 1, NTILE: 1, LAG: 1, LEAD: 1, PERCENT_RANK: 1, CUME_DIST: 1, PERCENTILE_CONT: 1, PERCENTILE_DISC: 1 };
    if (needOrder[name] && !desc.order.length) throw err(4112, 'Функция "' + name.toLowerCase() + '" должна иметь предложение OVER с ORDER BY.', n.line);
    if (noFrame[name] && w.frame) throw err(10752, 'Функция "' + name.toLowerCase() + '" не может иметь рамку окна.', n.line);
    if (w.frame && !desc.order.length) throw err(10756, 'Для рамки окна с ROWS или RANGE требуется предложение ORDER BY.', n.line);
    if (w.frame) {
      var f = w.frame;
      if (f.unit === 'RANGE' && (f.start.type === 'prec' || f.start.type === 'foll' || f.end.type === 'prec' || f.end.type === 'foll')) {
        var e = err(4194, 'RANGE поддерживается только с ограничителями рамки окна UNBOUNDED и CURRENT ROW.', f.line || n.line);
        e.hintText = 'В SQL Server RANGE не умеет «±N по значению» (это есть в PostgreSQL). Для скользящих окон по строкам используйте ROWS BETWEEN N PRECEDING AND CURRENT ROW.';
        throw e;
      }
      if (f.start.type === 'unb_foll' || f.end.type === 'unb_prec') throw err(102, 'Неправильный синтаксис около конструкции "' + (f.start.type === 'unb_foll' ? 'FOLLOWING' : 'PRECEDING') + '".', n.line);
      var rank = { unb_prec: 0, prec: 1, current: 2, foll: 3, unb_foll: 4 };
      if (rank[f.start.type] > rank[f.end.type] || (f.start.type === 'prec' && f.end.type === 'prec' && f.start.n < f.end.n) || (f.start.type === 'foll' && f.end.type === 'foll' && f.start.n > f.end.n)) {
        if (rank[f.start.type] > rank[f.end.type]) throw err(4193, 'Конечная граница рамки окна не может предшествовать начальной.', n.line);
      }
    }
    desc.frame = w.frame || null;
    desc.args = n.args.map(function (a) { return val(a, wC); });
    switch (name) {
      case 'ROW_NUMBER': case 'RANK': case 'DENSE_RANK': desc.type = TY.int('bigint'); break;
      case 'NTILE':
        if (desc.args.length !== 1) throw err(174, 'Функции ntile требуется 1 аргументов.', n.line);
        desc.type = TY.int('bigint'); break;
      case 'PERCENT_RANK': case 'CUME_DIST': desc.type = TY.float(); break;
      case 'LAG': case 'LEAD': case 'FIRST_VALUE': case 'LAST_VALUE':
        if (!desc.args.length) throw err(174, 'Функции ' + name.toLowerCase() + ' требуется от 1 до 3 аргументов.', n.line);
        desc.type = desc.args[0].type.kind === 'null' ? TY.int() : desc.args[0].type;
        if (desc.args[2]) desc.defFn = convFn(desc.args[2], desc.type, C);
        break;
      case 'PERCENTILE_CONT': case 'PERCENTILE_DISC':
        if (!n.withinGroup || n.withinGroup.length !== 1) throw err(10754, 'Функция "' + name.toLowerCase() + '" должна иметь предложение WITHIN GROUP (ORDER BY ...).', n.line);
        if (desc.order.length) throw err(10755, 'Предложение ORDER BY в OVER недопустимо для функции "' + name.toLowerCase() + '". Сортировка задаётся в WITHIN GROUP.', n.line);
        var wg = val(n.withinGroup[0].expr, wC);
        desc.wg = { fn: wg.fn, desc: n.withinGroup[0].desc, kind: wg.type.kind, type: wg.type };
        desc.type = name === 'PERCENTILE_CONT' ? TY.float() : wg.type;
        break;
      default:
        if (n.star) { desc.star = true; desc.type = name === 'COUNT_BIG' ? TY.int('bigint') : TY.int(); }
        else {
          if (desc.args.length !== 1) throw err(174, 'Функции ' + name.toLowerCase() + ' требуется 1 аргументов.', n.line);
          desc.type = aggType(name, desc.args[0].type, n.line);
          desc.argKind = desc.args[0].type.kind;
        }
    }
    var k = C.wins.length;
    C.wins.push(desc);
    return { type: desc.type, fn: function (ctx) { return ctx.wv ? ctx.wv[k] : null; } };
  }

  function computeWindows(wins, recs, baseCtx, session) {
    var n = recs.length;
    var out = new Array(n);
    for (var i = 0; i < n; i++) out[i] = new Array(wins.length);
    var c = { row: null, parent: baseCtx, wv: null };
    wins.forEach(function (w, k) {
      // ключи
      var pk = new Array(n), ok = new Array(n), av = new Array(n), i;
      for (i = 0; i < n; i++) {
        c.row = recs[i];
        pk[i] = w.partition.map(function (p) { return T.keyOf(p.fn(c), p.kind); }).join('\u0001');
        ok[i] = w.order.map(function (o) { return o.fn(c); });
        av[i] = w.args.length ? w.args.map(function (a) { return a.fn(c); }) : [];
        if (w.wg) av[i].wgv = w.wg.fn(c);
        tick(session);
      }
      var parts = new Map();
      for (i = 0; i < n; i++) { var g = parts.get(pk[i]); if (!g) { g = []; parts.set(pk[i], g); } g.push(i); }
      var ocmp = function (a, b) {
        for (var q = 0; q < w.order.length; q++) {
          var x = ok[a][q], y = ok[b][q], o = w.order[q], r;
          if (x === null && y === null) r = 0; else if (x === null) r = -1; else if (y === null) r = 1; else r = T.cmpVal(x, y, o.kind);
          if (r) return o.desc ? -r : r;
        }
        return 0;
      };
      parts.forEach(function (idx) {
        if (w.order.length) idx.sort(function (a, b) { return ocmp(a, b) || (a - b); });
        var m = idx.length, j;
        // группы равных значений (peers)
        var peerStart = new Array(m), peerEnd = new Array(m);
        for (j = 0; j < m; j++) peerStart[j] = (j > 0 && w.order.length && ocmp(idx[j - 1], idx[j]) === 0) ? peerStart[j - 1] : j;
        for (j = m - 1; j >= 0; j--) peerEnd[j] = (j < m - 1 && w.order.length && ocmp(idx[j + 1], idx[j]) === 0) ? peerEnd[j + 1] : j;
        if (!w.order.length) for (j = 0; j < m; j++) { peerStart[j] = 0; peerEnd[j] = m - 1; }
        var setv = function (j, v) { out[idx[j]][k] = v; };
        switch (w.name) {
          case 'ROW_NUMBER': for (j = 0; j < m; j++) setv(j, j + 1); return;
          case 'RANK': for (j = 0; j < m; j++) setv(j, peerStart[j] + 1); return;
          case 'DENSE_RANK': { var dr = 0; for (j = 0; j < m; j++) { if (peerStart[j] === j) dr++; setv(j, dr); } return; }
          case 'PERCENT_RANK': for (j = 0; j < m; j++) setv(j, m > 1 ? peerStart[j] / (m - 1) : 0); return;
          case 'CUME_DIST': for (j = 0; j < m; j++) setv(j, (peerEnd[j] + 1) / m); return;
          case 'NTILE': {
            var nb = av[idx[0]][0];
            if (nb === null || nb <= 0) throw err(4110, 'Аргумент функции NTILE должен быть положительным целым числом.', w.line);
            var base = Math.floor(m / nb), extra = m % nb, pos = 0;
            for (var b = 1; b <= nb && pos < m; b++) { var size = base + (b <= extra ? 1 : 0); for (var q = 0; q < size && pos < m; q++) setv(pos++, b); }
            return;
          }
          case 'LAG': case 'LEAD': {
            for (j = 0; j < m; j++) {
              var a = av[idx[j]];
              var off = a.length > 1 ? a[1] : 1;
              if (off === null || off < 0) throw err(8730, 'Значение смещения не может быть отрицательным.', w.line);
              var t = w.name === 'LAG' ? j - off : j + off;
              if (t >= 0 && t < m) setv(j, av[idx[t]][0]);
              else { c.row = recs[idx[j]]; setv(j, w.defFn ? w.defFn(c) : null); }
            }
            return;
          }
          case 'PERCENTILE_CONT': case 'PERCENTILE_DISC': {
            var p = av[idx[0]][0];
            if (p === null || p < 0 || p > 1) throw err(10761, 'Значение процентиля должно быть в диапазоне от 0 до 1.', w.line);
            var vals = idx.map(function (x) { return av[x].wgv; }).filter(function (v) { return v !== null; });
            vals.sort(function (x, y) { var r = T.cmpVal(x, y, w.wg.kind); return w.wg.desc ? -r : r; });
            var res = null;
            if (vals.length) {
              if (w.name === 'PERCENTILE_CONT') {
                var rn = 1 + p * (vals.length - 1), lo = Math.floor(rn), hi = Math.ceil(rn);
                res = lo === hi ? Number(vals[lo - 1]) : (hi - rn) * vals[lo - 1] + (rn - lo) * vals[hi - 1];
              } else {
                for (var z = 0; z < vals.length; z++) { if ((z + 1) / vals.length >= p - 1e-12) { res = vals[z]; break; } }
              }
            }
            for (j = 0; j < m; j++) setv(j, res);
            return;
          }
        }
        // агрегаты и FIRST_VALUE / LAST_VALUE по рамке
        var fr = w.frame;
        var unit = fr ? fr.unit : 'RANGE';
        var sb = fr ? fr.start : (w.order.length ? { type: 'unb_prec' } : { type: 'unb_prec' });
        var eb = fr ? fr.end : (w.order.length ? { type: 'current' } : { type: 'unb_foll' });
        for (j = 0; j < m; j++) {
          var s, e;
          switch (sb.type) {
            case 'unb_prec': s = 0; break;
            case 'prec': s = j - sb.n; break;
            case 'current': s = unit === 'RANGE' ? peerStart[j] : j; break;
            case 'foll': s = j + sb.n; break;
          }
          switch (eb.type) {
            case 'unb_foll': e = m - 1; break;
            case 'foll': e = j + eb.n; break;
            case 'current': e = unit === 'RANGE' ? peerEnd[j] : j; break;
            case 'prec': e = j - eb.n; break;
          }
          if (s < 0) s = 0; if (e > m - 1) e = m - 1;
          if (w.name === 'FIRST_VALUE') { setv(j, s <= e ? av[idx[s]][0] : null); continue; }
          if (w.name === 'LAST_VALUE') { setv(j, s <= e ? av[idx[e]][0] : null); continue; }
          if (w.star) { setv(j, Math.max(0, e - s + 1)); continue; }
          var vs = [];
          for (var x = s; x <= e; x++) { var v = av[idx[x]][0]; if (v !== null) vs.push(v); }
          setv(j, aggregateValues(w.name, w.type, w.argKind, vs, w, [], c));
          tick(session);
        }
      });
    });
    return out;
  }

  /* ================= Подзапросы ================= */
  function compileSubquery(q, C) {
    var boundary = new Scope([], C.scope, { refs: [], keys: {} });
    var plan = compileQuery(q, C.env, boundary, { inner: true, subq: true });
    var refs = boundary.boundary.refs;
    var cache = new Map();
    plan.exec = function (ctx) {
      var key = '';
      for (var i = 0; i < refs.length; i++) key += T.keyOf(relAccess(ctx, refs[i].rel, refs[i].idx), 'x') + '|';
      var r = cache.get(key);
      if (r === undefined) {
        r = plan.run({ row: [], parent: ctx });
        cache.set(key, r);
      }
      return r;
    };
    return plan;
  }

  /* ================= Источники данных (FROM) ================= */
  function Env(parent, session) { this.ctes = {}; this.parent = parent; this.session = session || (parent && parent.session); }
  function lookupCte(env, lname) { for (var e = env; e; e = e.parent) if (e.ctes[lname]) return e.ctes[lname]; return null; }

  function compileFromList(list, env, parentScope) {
    var plan = compileSource(list[0], env, parentScope);
    for (var i = 1; i < list.length; i++) {
      var right = compileSource(list[i], env, parentScope);
      checkDup(plan.cols, right.cols, list[i].line);
      plan = crossPlan(plan, right, env.session);
    }
    return plan;
  }
  function checkDup(lc, rc, line) {
    var la = {}; lc.forEach(function (c) { if (c.alias) la[c.alias] = 1; });
    for (var i = 0; i < rc.length; i++) {
      if (rc[i].alias && la[rc[i].alias]) {
        var e = err(1013, 'Объекты "' + rc[i].alias + '" и "' + rc[i].alias + '" в предложении FROM имеют одинаковые представленные имена. Используйте имена корреляции, чтобы различить их.', line);
        e.hintText = 'Если таблица участвует в запросе дважды (например, соединение таблицы самой с собой), дайте ей разные псевдонимы: FROM Employees e JOIN Employees m ON ...';
        throw e;
      }
    }
  }
  function crossPlan(L, R, session) {
    var P = {
      kind: 'CROSS', L: L, R: R, cols: L.cols.concat(R.cols), run: function (ctx) {
        var lr = P.L.run(ctx), rr = P.R.run(ctx), out = [];
        if (lr.length * rr.length > MAX_ROWS) throw err(50002, 'Слишком большой промежуточный результат: ' + lr.length + ' × ' + rr.length + ' строк. Похоже на декартово произведение — проверьте условия соединения.');
        for (var i = 0; i < lr.length; i++) for (var j = 0; j < rr.length; j++) { out.push(lr[i].concat(rr[j])); tick(session); }
        return out;
      }
    };
    return P;
  }
  function filterPlan(child, fn, constant, session) {
    var cache = null;
    return {
      cols: child.cols, constant: constant, run: function (ctx) {
        if (cache) return cache;
        var rows = child.run(ctx), out = [], c = { row: null, parent: ctx };
        for (var i = 0; i < rows.length; i++) { c.row = rows[i]; if (fn(c) === true) out.push(rows[i]); tick(session); }
        if (constant) cache = out;
        return out;
      }
    };
  }
  T._filterPlan = filterPlan;

  function compileSource(node, env, parentScope) {
    var session = env.session;
    switch (node.type) {
      case 'table': {
        var lname = node.name.toLowerCase();
        var srcDb = session.db;
        if (node.parts.length >= 2) {
          var schema = (node.parts[node.parts.length - 2] || 'dbo').toLowerCase();
          if (schema !== 'dbo' || node.parts.length > 3) throw err(208, 'Недопустимое имя объекта "' + node.parts.join('.') + '".', node.line);
          if (node.parts.length === 3 && node.parts[0]) {
            srcDb = session.dbs[node.parts[0].toLowerCase()];
            if (!srcDb) {
              var de = err(208, 'Недопустимое имя объекта "' + node.parts.join('.') + '".', node.line);
              de.hintText = 'Базы данных «' + node.parts[0] + '» нет. Доступные базы: ' + dbNames(session).join(', ') + '. Подключить другие учебные базы можно в разделе «Базы».';
              throw de;
            }
          }
        }
        var alias = (node.alias || node.name);
        var cte = node.parts.length === 1 ? lookupCte(env, lname) : null;
        if (cte) {
          if (cte.compiling) throw err(252, 'Обобщенное табличное выражение "' + node.name + '" ссылается само на себя некорректно.', node.line);
          return { cols: cte.cols.map(function (c) { return mkCol(c.name, c.type, alias); }), run: function (ctx) { return cte.getRows(ctx); } };
        }
        var tbl = lname[0] === '#' ? session.temps[lname] : srcDb.tables[lname];
        if (!tbl) {
          var e = err(208, 'Недопустимое имя объекта "' + node.parts.join('.') + '".', node.line);
          var names = Object.keys(srcDb.tables).map(function (k) { return srcDb.tables[k].name; }).concat(Object.keys(session.temps).map(function (k) { return session.temps[k].name; }));
          e.suggest = suggest(node.name, names);
          if (lname[0] !== '#') {
            var other = Object.keys(session.dbs).filter(function (k) { return session.dbs[k] !== srcDb && session.dbs[k].tables[lname]; }).map(function (k) { return session.dbs[k].name; });
            if (other.length) e.hintText = 'Таблица ' + node.name + ' есть в базе ' + other.join(', ') + ', а сейчас выбрана база ' + (srcDb.name || '') + '. Переключите базу (USE ' + other[0] + ';) или укажите полное имя: ' + other[0] + '.dbo.' + node.name + '.';
          }
          if (lname[0] === '#') e.hintText = 'Временная таблица существует только в пределах одного запуска. Запустите целиком скрипт, где есть и SELECT ... INTO ' + node.name + ', и чтение из неё.';
          throw e;
        }
        var rows = tbl.rows;
        return { cols: tbl.columns.map(function (c) { return mkCol(c.name, c.type, alias); }), constant: true, run: function () { return rows; } };
      }
      case 'derived': {
        var plan = compileQuery(node.query, env, parentScope, { inner: true, derived: node.alias });
        var names2 = namesFor(plan.cols, node.cols, node.alias, node.line);
        var al = node.alias;
        return { cols: plan.cols.map(function (c, i) { return mkCol(names2[i], c.type, al); }), run: function (ctx) { return plan.run(ctx); } };
      }
      case 'tvf': {
        var sc = parentScope || new Scope([], null);
        var C = { scope: sc, mode: 'row', session: session, env: env, clause: 'FROM', allowWin: false };
        var args = node.args.map(function (a) { return val(a, C); });
        var al2 = (node.alias || node.name);
        if (node.name === 'GENERATE_SERIES') {
          if (args.length < 2 || args.length > 3) throw err(174, 'Функции generate_series требуется от 2 до 3 аргументов.', node.line);
          var isInt = args.every(function (a) { return a.type.kind === 'int' || a.type.kind === 'bit'; });
          var vt = isInt ? TY.int() : T.unifyTypes(args, C);
          return {
            cols: [mkCol('value', vt, al2)], run: function (ctx) {
              var a = args[0].fn(ctx), b = args[1].fn(ctx), st = args[2] ? args[2].fn(ctx) : (a <= b ? 1 : -1);
              if (a === null || b === null || st === null) return [];
              if (st === 0) throw err(4199, 'Аргумент step функции GENERATE_SERIES не может быть равен нулю.', node.line);
              var out = [];
              if (st > 0) for (var v = a; v <= b + 1e-9; v += st) { out.push([v]); if (out.length > MAX_ROWS) break; }
              else for (var v2 = a; v2 >= b - 1e-9; v2 += st) { out.push([v2]); if (out.length > MAX_ROWS) break; }
              return out;
            }
          };
        }
        if (node.name === 'STRING_SPLIT') {
          var sf = T.strFn(args[0]), sepf = T.strFn(args[1]);
          return {
            cols: [mkCol('value', TY.str(4000, true), al2)], run: function (ctx) {
              var s = sf(ctx), sep = sepf(ctx);
              if (s === null) return [];
              return s.split(sep || '').map(function (x) { return [x]; });
            }
          };
        }
        throw err(208, 'Недопустимое имя объекта "' + node.name + '".', node.line);
      }
      case 'join': return joinPlan(node, env, parentScope);
    }
    throw err(102, 'Неправильный синтаксис в предложении FROM.', node.line);
  }

  function namesFor(cols, explicit, alias, line) {
    if (explicit) {
      if (explicit.length !== cols.length) throw err(explicit.length < cols.length ? 8158 : 8159, 'В "' + alias + '" ' + (explicit.length < cols.length ? 'больше' : 'меньше') + ' столбцов, чем указано в списке столбцов.', line);
      return explicit;
    }
    var seen = {};
    return cols.map(function (c, i) {
      if (!c.name) {
        var e = err(8155, 'Не указано имя столбца для столбца ' + (i + 1) + ' в "' + alias + '".', line);
        e.hintText = 'Каждому вычисляемому столбцу в подзапросе или CTE нужно дать имя через AS, например: SUM(Amount) AS Total.';
        throw e;
      }
      var l = c.name.toLowerCase();
      if (seen[l]) throw err(8156, 'Столбец "' + c.name + '" указан несколько раз для "' + alias + '".', line);
      seen[l] = 1;
      return c.name;
    });
  }

  function flattenAnd(n, out) {
    if (n.type === 'and') { flattenAnd(n.left, out); flattenAnd(n.right, out); }
    else if (n.type === 'paren') flattenAnd(n.expr, out);
    else out.push(n);
    return out;
  }
  function stripParen(n) { while (n && n.type === 'paren') n = n.expr; return n; }

  function joinPlan(node, env, parentScope) {
    var session = env.session;
    var L = compileSource(node.left, env, parentScope);
    var kind = node.kind;
    if (kind === 'CROSSAPPLY' || kind === 'OUTERAPPLY') {
      var lscope = new Scope(L.cols, parentScope);
      var Rp = compileSource(node.right, env, lscope);
      checkDup(L.cols, Rp.cols, node.line);
      var rw = Rp.cols.length;
      var PA = {
        kind: kind, L: L, R: Rp, cols: L.cols.concat(Rp.cols), run: function (ctx) {
          var lr = PA.L.run(ctx), out = [], c2 = { row: null, parent: ctx };
          for (var i = 0; i < lr.length; i++) {
            c2 = { row: lr[i], parent: ctx };
            var rr = Rp.run(c2);
            if (rr.length) for (var j = 0; j < rr.length; j++) out.push(lr[i].concat(rr[j]));
            else if (kind === 'OUTERAPPLY') out.push(lr[i].concat(new Array(rw).fill(null)));
            if (out.length > MAX_ROWS) throw err(50002, 'Слишком большой промежуточный результат.');
            tick(session);
          }
          return out;
        }
      };
      return PA;
    }
    var R = compileSource(node.right, env, parentScope);
    checkDup(L.cols, R.cols, node.line);
    if (kind === 'CROSS') return crossPlan(L, R, session);
    var cols = L.cols.concat(R.cols), nl = L.cols.length, nr = R.cols.length;
    var oscope = new Scope(cols, parentScope);
    var onC = { scope: oscope, mode: 'row', clause: 'ON', env: env, session: session, allowWin: false };
    var onFn = cond(node.on, onC).fn;
    // поиск равенств для хеш-соединения
    var eqs = [];
    flattenAnd(node.on, []).forEach(function (cj) {
      cj = stripParen(cj);
      if (cj.type !== 'cmp' || cj.op !== '=') return;
      var a = stripParen(cj.left), b = stripParen(cj.right);
      if (a.type !== 'col' || b.type !== 'col') return;
      var ra = tryResolve(oscope, a.parts), rb = tryResolve(oscope, b.parts);
      if (!ra || !rb || ra.depth !== 0 || rb.depth !== 0) return;
      var li, ri, lt, rt;
      if (ra.idx < nl && rb.idx >= nl) { li = ra.idx; ri = rb.idx - nl; lt = ra.type; rt = rb.type; }
      else if (rb.idx < nl && ra.idx >= nl) { li = rb.idx; ri = ra.idx - nl; lt = rb.type; rt = ra.type; }
      else return;
      var kl = T.isNum(lt) ? 'num' : lt.kind, kr = T.isNum(rt) ? 'num' : rt.kind;
      if (kl === 'date') kl = 'datetime'; if (kr === 'date') kr = 'datetime';
      if (kl !== kr) return;
      eqs.push({ li: li, ri: ri, kind: kl === 'num' ? 'int' : kl });
    });
    var PJ = {
      kind: kind, L: L, R: R, cols: cols, run: function (ctx) {
        var lr = PJ.L.run(ctx), rr = PJ.R.run(ctx), out = [];
        var c = { row: null, parent: ctx };
        var rmatched = (kind === 'RIGHT' || kind === 'FULL') ? new Uint8Array(rr.length) : null;
        var map = null;
        if (eqs.length && PJ._mapFor === rr) map = PJ._map;
        else if (eqs.length) {
          map = new Map();
          for (var j = 0; j < rr.length; j++) {
            var key = '', bad = false;
            for (var q = 0; q < eqs.length; q++) { var v = rr[j][eqs[q].ri]; if (v === null) { bad = true; break; } key += T.keyOf(v, eqs[q].kind) + '\u0001'; }
            if (bad) continue;
            var arr = map.get(key); if (!arr) { arr = []; map.set(key, arr); } arr.push(j);
          }
          PJ._map = map; PJ._mapFor = rr;
        }
        var allIdx = null;
        for (var i = 0; i < lr.length; i++) {
          var l = lr[i], matched = false, cands;
          if (map) {
            var k2 = '', bad2 = false;
            for (var q2 = 0; q2 < eqs.length; q2++) { var v2 = l[eqs[q2].li]; if (v2 === null) { bad2 = true; break; } k2 += T.keyOf(v2, eqs[q2].kind) + '\u0001'; }
            cands = bad2 ? [] : (map.get(k2) || []);
          } else {
            if (!allIdx) { allIdx = []; for (var z = 0; z < rr.length; z++) allIdx.push(z); }
            cands = allIdx;
          }
          for (var m = 0; m < cands.length; m++) {
            var jj = cands[m];
            var row = l.concat(rr[jj]);
            c.row = row;
            if (onFn(c) === true) { out.push(row); matched = true; if (rmatched) rmatched[jj] = 1; }
            tick(session);
          }
          if (!matched && (kind === 'LEFT' || kind === 'FULL')) out.push(l.concat(new Array(nr).fill(null)));
          if (out.length > MAX_ROWS) throw err(50002, 'Слишком большой промежуточный результат — больше ' + MAX_ROWS + ' строк. Проверьте условия соединения.');
        }
        if (rmatched) for (var r2 = 0; r2 < rr.length; r2++) if (!rmatched[r2]) out.push(new Array(nl).fill(null).concat(rr[r2]));
        return out;
      }
    };
    return PJ;
  }

  /* ---------- проталкивание условий WHERE к таблицам (ускорение) ---------- */
  var PUSH_LEFT = { INNER: 1, CROSS: 1, LEFT: 1, CROSSAPPLY: 1, OUTERAPPLY: 1 };
  var PUSH_RIGHT = { INNER: 1, CROSS: 1 };
  function exprInfo(n, scope, info) {
    info = info || { idx: [], outer: false, bad: false };
    if (!n || typeof n !== 'object') return info;
    if (Array.isArray(n)) { n.forEach(function (x) { exprInfo(x, scope, info); }); return info; }
    switch (n.type) {
      case 'query': case 'subq': case 'exists': info.bad = true; return info;
      case 'in': if (n.sub) { info.bad = true; return info; } break;
      case 'quant': info.bad = true; return info;
      case 'func': if (AGG[n.name] || n.over || n.name === 'NEWID' || n.name === 'RAND') { info.bad = true; return info; } break;
      case 'col': {
        var r = tryResolve(scope, n.parts);
        if (!r || r.count > 1) { info.bad = true; return info; }
        if (r.depth === 0) info.idx.push(r.idx); else info.outer = true;
        return info;
      }
      case 'var': case 'sysvar': return info;
    }
    for (var k in n) { if (k === 'line') continue; var v = n[k]; if (v && typeof v === 'object') exprInfo(v, scope, info); }
    return info;
  }
  function pushDown(holder, slot, lo, hi, condNode, constant, parentScope, env) {
    var P = holder[slot];
    if (P.L && P.kind) {
      var nl = P.L.cols.length;
      if (hi < nl && PUSH_LEFT[P.kind]) return pushDown(P, 'L', lo, hi, condNode, constant, parentScope, env);
      if (lo >= nl && PUSH_RIGHT[P.kind]) return pushDown(P, 'R', lo - nl, hi - nl, condNode, constant, parentScope, env);
    }
    var C = { scope: new Scope(P.cols, parentScope), mode: 'row', clause: 'WHERE', env: env, session: env.session, allowWin: false };
    var fn = cond(condNode, C).fn;
    holder[slot] = filterPlan(P, fn, constant && !!P.constant, env.session);
  }
  function applyPushdown(src, where, scope, parentScope, env) {
    if (!src.L || !src.kind) return where;
    var rest = [];
    flattenAnd(where, []).forEach(function (cj) {
      var info = exprInfo(cj, scope);
      if (info.bad || !info.idx.length) { rest.push(cj); return; }
      var lo = Math.min.apply(null, info.idx), hi = Math.max.apply(null, info.idx);
      var nl = src.L.cols.length;
      if (hi < nl && PUSH_LEFT[src.kind]) pushDown(src, 'L', lo, hi, cj, !info.outer, parentScope, env);
      else if (lo >= nl && PUSH_RIGHT[src.kind]) pushDown(src, 'R', lo - nl, hi - nl, cj, !info.outer, parentScope, env);
      else rest.push(cj);
    });
    if (!rest.length) return null;
    var w = rest[0];
    for (var i = 1; i < rest.length; i++) w = { type: 'and', left: w, right: rest[i], line: rest[i].line };
    return w;
  }

  /* ================= SELECT ================= */
  function expandGroupBy(items) {
    // каждая позиция -> список наборов
    var lists = items.map(function (it) {
      if (it.expr) return [[it.expr]];
      if (it.rollup) { var r = []; for (var i = it.rollup.length; i >= 0; i--) r.push(it.rollup.slice(0, i)); return r; }
      if (it.cube) {
        var c = [], n = it.cube.length;
        for (var mask = (1 << n) - 1; mask >= 0; mask--) { var s = []; for (var b = 0; b < n; b++) if (mask & (1 << (n - 1 - b))) s.push(it.cube[b]); c.push(s); }
        return c;
      }
      if (it.sets) return it.sets;
      return [[]];
    });
    var sets = [[]];
    lists.forEach(function (l) {
      var next = [];
      sets.forEach(function (s) { l.forEach(function (x) { next.push(s.concat(x)); }); });
      sets = next;
    });
    return sets;
  }

  function defaultName(e) {
    var n = stripParen(e);
    if (n.type === 'col') return n.parts[n.parts.length - 1];
    return null;
  }

  function sortRows(arr, keyGetter, specs) {
    // arr: [{..., ok: [keys]}] — стабильная сортировка
    var idx = arr.map(function (_, i) { return i; });
    idx.sort(function (a, b) {
      var ka = arr[a].ok, kb = arr[b].ok;
      for (var q = 0; q < specs.length; q++) {
        var x = ka[q], y = kb[q], s = specs[q], c;
        if (x === null && y === null) c = 0; else if (x === null) c = -1; else if (y === null) c = 1; else c = T.cmpVal(x, y, s.kind);
        if (c) return s.desc ? -c : c;
      }
      return a - b;
    });
    return idx.map(function (i) { return arr[i]; });
  }

  function compileCore(core, env, parentScope, qo, opts) {
    var session = env.session;
    opts = opts || {};
    var src = core.from ? compileFromList(core.from, env, parentScope) : { cols: [], run: function () { return [[]]; } };
    var scope = new Scope(src.cols, parentScope);
    var base = { scope: scope, env: env, session: session, mode: 'row', keys: null, aggs: null, wins: null, clause: 'WHERE', allowWin: false, inAgg: false };
    var whereNode = core.where;
    if (whereNode) cond(whereNode, base);   // полная проверка условия (ошибки как в SQL Server)
    if (whereNode && core.from && !opts.traceTop) whereNode = applyPushdown(src, whereNode, scope, parentScope, env);
    var whereFn = whereNode ? cond(whereNode, base).fn : null;
    var orderBy = qo ? qo.orderBy : null;
    var grouped = !!core.groupBy || !!core.having || core.items.some(function (it) { return it.expr && hasAgg(it.expr); }) || (orderBy ? orderBy.some(function (o) { return hasAgg(o.expr); }) : false);

    var keyExprs = [], sets = [[]], setIdx = [[]];
    if (core.groupBy) {
      var rawSets = expandGroupBy(core.groupBy);
      var keyMap = {};
      rawSets.forEach(function (s) { s.forEach(function (e) { var rk = rkey(e, scope); if (!(rk in keyMap)) { keyMap[rk] = keyExprs.length; keyExprs.push(e); } }); });
      setIdx = rawSets.map(function (s) { var u = []; s.forEach(function (e) { var i = keyMap[rkey(e, scope)]; if (u.indexOf(i) < 0) u.push(i); }); return u; });
      sets = rawSets;
    }
    var gC = sub(base, { clause: 'GROUP BY' });
    var keyComp = keyExprs.map(function (e) { return val(e, gC); });
    var keys = keyExprs.map(function (e, i) { return { rk: rkey(e, scope), type: keyComp[i].type }; });
    var multiSet = setIdx.length > 1;
    // для наборов группировки ключ может стать NULL — тип не меняется
    var aggs = [], wins = [];
    var M = sub(base, { mode: grouped ? 'group' : 'row', keys: grouped ? keys : null, aggs: aggs, wins: wins, allowWin: true, clause: 'SELECT' });

    var items = [], assigns = [];
    core.items.forEach(function (it) {
      if (it.type === 'star') {
        var q = it.qualifier ? it.qualifier.toLowerCase() : null;
        if (!core.from) throw err(263, 'При использовании "SELECT *" необходимо указать таблицы.', it.line);
        var any = false;
        src.cols.forEach(function (c, i) {
          if (q && c.alias !== q) return;
          any = true;
          if (grouped) {
            var rk = '@0:' + i, ki = -1;
            for (var z = 0; z < keys.length; z++) if (keys[z].rk === rk) ki = z;
            if (ki < 0) throw err(8120, 'Столбец "' + c.adisp + '.' + c.name + '" недопустим в списке выбора, поскольку он не содержится ни в агрегатной функции, ни в предложении GROUP BY.', it.line);
            items.push({ name: c.name, type: c.type, fn: function (ctx) { return ctx.row.keys[ki]; }, rk: rk });
          } else {
            items.push({ name: c.name, type: c.type, fn: function (ctx) { return ctx.row[i]; }, rk: '@0:' + i });
          }
        });
        if (q && !any) throw err(4104, 'Не удалось привязать составной идентификатор "' + it.qualifier + '".', it.line);
        return;
      }
      if (it.type === 'assign') {
        var vn = it.name.toLowerCase();
        if (!session.vars[vn]) throw err(137, 'Необходимо объявить скалярную переменную "' + it.name + '".', it.line);
        var ac = val(it.expr, M);
        assigns.push({ v: vn, c: ac });
        return;
      }
      var cc = val(it.expr, M);
      items.push({ name: it.alias || defaultName(it.expr), type: cc.type.kind === 'null' ? TY.int() : cc.type, nul: cc.type.kind === 'null', fn: cc.fn, rk: rkey(it.expr, scope), alias: it.alias });
    });
    if (assigns.length && items.length) throw err(141, 'Инструкция SELECT, присваивающая значение переменной, не должна объединяться с операциями извлечения данных.', core.line);

    var havingFn = core.having ? cond(core.having, sub(M, { clause: 'HAVING', allowWin: false })).fn : null;

    // ORDER BY
    var orderSpecs = null;
    if (orderBy) {
      var oC = sub(M, { clause: 'ORDER BY' });
      orderSpecs = orderBy.map(function (o, oi) {
        var e = stripParen(o.expr);
        if (e.type === 'lit') {
          if (e.ltype.kind === 'int') {
            var ord = e.value;
            if (ord < 1 || ord > items.length) throw err(108, 'Порядковый номер ' + ord + ' в предложении ORDER BY выходит за пределы числа элементов в списке выбора.', o.expr.line);
            return { proj: ord - 1, desc: o.desc, kind: items[ord - 1].type.kind };
          }
          throw err(408, 'Обнаружено константное выражение в списке ORDER BY, позиция ' + (oi + 1) + '.', o.expr.line);
        }
        if (e.type === 'col' && e.parts.length === 1) {
          var ln = e.parts[0].toLowerCase(), hits = [];
          items.forEach(function (it, i) { if (it.name && it.name.toLowerCase() === ln && (it.alias || true)) hits.push(i); });
          if (hits.length) {
            var rks = {}; hits.forEach(function (h) { rks[items[h].rk] = 1; });
            if (Object.keys(rks).length > 1) throw err(209, 'Неоднозначное имя столбца "' + e.parts[0] + '".', o.expr.line);
            return { proj: hits[0], desc: o.desc, kind: items[hits[0]].type.kind };
          }
        }
        var rk = rkey(o.expr, scope);
        for (var i = 0; i < items.length; i++) if (items[i].rk === rk) return { proj: i, desc: o.desc, kind: items[i].type.kind };
        if (core.distinct) throw err(145, 'Элементы ORDER BY должны находиться в списке выбора, если указан оператор SELECT DISTINCT.', o.expr.line);
        var c = val(o.expr, oC);
        return { proj: -1, fn: c.fn, desc: o.desc, kind: c.type.kind };
      });
    }
    // TOP / OFFSET
    var top = null;
    if (core.top) {
      var tC = { scope: new Scope([], null), mode: 'row', session: session, env: env, clause: 'TOP', allowWin: false };
      var tc = val(core.top.expr, tC);
      top = { fn: tc.fn, percent: core.top.percent, ties: core.top.ties };
      if (top.ties && !orderBy) throw err(1062, 'Предложение TOP N WITH TIES не разрешено без соответствующего предложения ORDER BY.', core.top.line);
      if (qo && qo.offset) throw err(10741, 'Предложение TOP нельзя использовать в одном запросе или вложенном запросе с OFFSET.', core.line);
    }
    var offFn = null, fetchFn = null;
    if (qo && qo.offset) {
      var oc2 = { scope: new Scope([], null), mode: 'row', session: session, env: env, clause: 'OFFSET', allowWin: false };
      offFn = val(qo.offset, oc2).fn;
      fetchFn = qo.fetch ? val(qo.fetch, oc2).fn : null;
    }
    var outCols = items.map(function (it) { return it.nul ? { name: it.name, type: it.type, nul: true } : { name: it.name, type: it.type }; });
    var traceable = !!opts.traceTop;

    function colTitles() { return src.cols.map(function (c) { return (c.adisp ? c.adisp + '.' : '') + c.name; }); }
    function snapFlat(rows) {
      var lim = Math.min(rows.length, 200), out = [];
      for (var i = 0; i < lim; i++) out.push(rows[i].map(function (v, j) { return T.display(v, src.cols[j].type); }));
      return out;
    }

    return {
      cols: outCols, assigns: assigns, into: core.into, isCore: true,
      run: function (ctx, trace) {
        var doTrace = traceable && trace;
        var srcRows = src.run(ctx);
        if (doTrace && core.from) trace.push({ stage: 'FROM', cols: colTitles(), rows: snapFlat(srcRows), total: srcRows.length });
        var rc = { row: null, parent: ctx, wv: null };
        var rows = srcRows;
        if (whereFn) {
          rows = [];
          for (var i = 0; i < srcRows.length; i++) { rc.row = srcRows[i]; if (whereFn(rc) === true) rows.push(srcRows[i]); tick(session); }
          if (doTrace) trace.push({ stage: 'WHERE', cols: colTitles(), rows: snapFlat(rows), total: rows.length, removed: srcRows.length - rows.length });
        }
        var recs;
        if (grouped) {
          var nk = keyComp.length;
          var kvals = new Array(rows.length);
          for (var r = 0; r < rows.length; r++) {
            rc.row = rows[r];
            var kv = new Array(nk);
            for (var q = 0; q < nk; q++) kv[q] = keyComp[q].fn(rc);
            kvals[r] = kv;
          }
          recs = [];
          setIdx.forEach(function (set) {
            var map = new Map(), list = [];
            for (var r2 = 0; r2 < rows.length; r2++) {
              var key = '';
              for (var s = 0; s < set.length; s++) key += T.keyOf(kvals[r2][set[s]], keys[set[s]].type.kind) + '\u0001';
              var g = map.get(key);
              if (!g) {
                g = { __group: true, keys: new Array(nk).fill(null), grouping: new Array(nk).fill(1), rows: [], first: rows[r2] };
                for (var s2 = 0; s2 < set.length; s2++) { g.keys[set[s2]] = kvals[r2][set[s2]]; g.grouping[set[s2]] = 0; }
                map.set(key, g); list.push(g);
              }
              g.rows.push(rows[r2]);
            }
            if (set.length === 0 && rows.length === 0) list.push({ __group: true, keys: new Array(nk).fill(null), grouping: new Array(nk).fill(1), rows: [], first: null });
            list.forEach(function (g) { recs.push(g); });
          });
          // естественный порядок: как у сортирующей агрегации (итоги после деталей)
          if (nk) {
            var idxs = recs.map(function (_, i) { return i; });
            idxs.sort(function (a, b) {
              var A = recs[a], B = recs[b];
              for (var q = 0; q < nk; q++) {
                if (A.grouping[q] !== B.grouping[q]) return A.grouping[q] - B.grouping[q];
                if (A.grouping[q]) continue;
                var x = A.keys[q], y = B.keys[q], c;
                if (x === null && y === null) c = 0; else if (x === null) c = -1; else if (y === null) c = 1; else c = T.cmpVal(x, y, keys[q].type.kind);
                if (c) return c;
              }
              return a - b;
            });
            recs = idxs.map(function (i) { return recs[i]; });
          }
          var actx = { row: null, parent: ctx };
          recs.forEach(function (g) { g.aggs = aggs.map(function (d) { return computeAgg(d, g.rows, actx); }); tick(session); });
          if (doTrace) {
            var gcols = keyExprs.map(function (e) { return T.exprText(e); }).concat(['строк в группе']);
            trace.push({
              stage: 'GROUP BY', cols: gcols, total: recs.length,
              rows: recs.slice(0, 200).map(function (g) { return g.keys.map(function (v, i) { return g.grouping[i] ? '(итог)' : T.display(v, keys[i].type); }).concat([String(g.rows.length)]); }),
              groups: recs.slice(0, 50).map(function (g) { return { key: g.keys.map(function (v, i) { return g.grouping[i] ? '(итог)' : T.display(v, keys[i].type); }), rows: snapFlat(g.rows.slice(0, 30)), n: g.rows.length }; }),
              srcCols: colTitles()
            });
          }
          if (havingFn) {
            var before = recs.length;
            recs = recs.filter(function (g) { rc.row = g; return havingFn(rc) === true; });
            if (doTrace) trace.push({ stage: 'HAVING', cols: keyExprs.map(function (e) { return T.exprText(e); }).concat(['строк в группе']), rows: recs.slice(0, 200).map(function (g) { return g.keys.map(function (v, i) { return T.display(v, keys[i].type); }).concat([String(g.rows.length)]); }), total: recs.length, removed: before - recs.length });
          }
        } else recs = rows;

        var wv = wins.length ? computeWindows(wins, recs, ctx, session) : null;
        // присваивание переменным
        if (assigns.length) {
          for (var a = 0; a < recs.length; a++) {
            rc.row = recs[a]; rc.wv = wv ? wv[a] : null;
            assigns.forEach(function (as) { var v = as.c.fn(rc); var vr = session.vars[as.v]; vr.value = v === null ? null : convert(v, as.c.type.kind === 'null' ? vr.type : as.c.type, vr.type, { settings: session.settings }); });
          }
          return [];
        }
        var out = [];
        for (var p = 0; p < recs.length; p++) {
          rc.row = recs[p]; rc.wv = wv ? wv[p] : null;
          var vals = new Array(items.length);
          for (var it = 0; it < items.length; it++) vals[it] = items[it].fn(rc);
          var ok = null;
          if (orderSpecs) { ok = orderSpecs.map(function (s) { return s.proj >= 0 ? vals[s.proj] : s.fn(rc); }); }
          out.push({ v: vals, ok: ok });
          tick(session);
        }
        if (doTrace) trace.push({ stage: 'SELECT', cols: outCols.map(function (c) { return c.name || NONAME; }), rows: out.slice(0, 200).map(function (o) { return o.v.map(function (v, i) { return T.display(v, outCols[i].type); }); }), total: out.length });
        if (core.distinct) {
          var seen = new Set(), d = [];
          out.forEach(function (o) { var k = o.v.map(function (v, i) { return T.keyOf(v, outCols[i].type.kind); }).join('\u0001'); if (!seen.has(k)) { seen.add(k); d.push(o); } });
          if (doTrace) trace.push({ stage: 'DISTINCT', cols: outCols.map(function (c) { return c.name || NONAME; }), rows: d.slice(0, 200).map(function (o) { return o.v.map(function (v, i) { return T.display(v, outCols[i].type); }); }), total: d.length, removed: out.length - d.length });
          out = d;
        }
        if (orderSpecs) {
          out = sortRows(out, null, orderSpecs);
          if (doTrace) trace.push({ stage: 'ORDER BY', cols: outCols.map(function (c) { return c.name || NONAME; }), rows: out.slice(0, 200).map(function (o) { return o.v.map(function (v, i) { return T.display(v, outCols[i].type); }); }), total: out.length });
        }
        if (top) {
          var tv = top.fn({ row: [], parent: null });
          if (tv === null || tv < 0) throw err(1060, 'Количество строк в предложении TOP должно быть положительным целым числом.', core.line);
          var n = top.percent ? Math.ceil(out.length * Math.min(100, tv) / 100) : Math.floor(tv);
          var cut = out.slice(0, n);
          if (top.ties && n > 0 && n < out.length) {
            var last = out[n - 1].ok;
            for (var t = n; t < out.length; t++) {
              var same = orderSpecs.every(function (s, q) { var x = last[q], y = out[t].ok[q]; if (x === null && y === null) return true; if (x === null || y === null) return false; return T.cmpVal(x, y, s.kind) === 0; });
              if (same) cut.push(out[t]); else break;
            }
          }
          if (doTrace) trace.push({ stage: 'TOP', cols: outCols.map(function (c) { return c.name || NONAME; }), rows: cut.slice(0, 200).map(function (o) { return o.v.map(function (v, i) { return T.display(v, outCols[i].type); }); }), total: cut.length, removed: out.length - cut.length });
          out = cut;
        }
        if (offFn) {
          var off = offFn({ row: [], parent: null }), fe = fetchFn ? fetchFn({ row: [], parent: null }) : null;
          if (off === null || off < 0) throw err(10742, 'Смещение, указанное в предложении OFFSET, не может быть отрицательным.', core.line);
          if (fe !== null && fe < 1) throw err(10744, 'Количество строк в предложении FETCH должно быть больше нуля.', core.line);
          var before2 = out.length;
          out = out.slice(off, fe === null ? undefined : off + fe);
          if (doTrace) trace.push({ stage: 'OFFSET / FETCH', cols: outCols.map(function (c) { return c.name || NONAME; }), rows: out.slice(0, 200).map(function (o) { return o.v.map(function (v, i) { return T.display(v, outCols[i].type); }); }), total: out.length, removed: before2 - out.length });
        }
        return out.map(function (o) { return o.v; });
      }
    };
  }

  /* ================= Запрос целиком (CTE, UNION, ORDER BY) ================= */
  function sameType(a, b) {
    var ka = a.kind === 'null' ? 'int' : a.kind, kb = b.kind === 'null' ? 'int' : b.kind;
    if (ka !== kb) return false;
    if (ka === 'str') return a.len === b.len && a.n === b.n;
    if (ka === 'decimal') return a.p === b.p && a.s === b.s;
    if (ka === 'int') return (a.sub || 'int') === (b.sub || 'int');
    return true;
  }

  function flattenSet(node, out, op) {
    if (node.type === 'setop' && (node.op === 'UNION ALL' || node.op === 'UNION')) {
      flattenSet(node.left, out, op);
      flattenSet(node.right, out, node.op);
    } else out.push({ node: node, op: op || null });
    return out;
  }

  function defineCte(c, env, parentScope, stmt) {
    var lname = c.name.toLowerCase();
    if (env.ctes[lname]) throw err(252, 'Имя обобщенного табличного выражения "' + c.name + '" указано несколько раз.', c.line);
    var cte = { name: c.name, lname: lname, cols: null };
    var recursive = refersTo(c.query, lname);
    if (!recursive) {
      cte.compiling = true; env.ctes[lname] = cte;
      var plan = compileQuery(c.query, env, parentScope, { inner: true, cte: c.name });
      cte.compiling = false;
      var names = namesFor(plan.cols, c.cols, c.name, c.line);
      cte.cols = plan.cols.map(function (col, i) { return { name: names[i], type: col.type }; });
      var cache = null;
      cte.getRows = function (ctx) { return cache || (cache = plan.run(ctx)); };
      return;
    }
    // рекурсивное CTE
    if (c.query.orderBy) throw err(1033, 'Предложение ORDER BY недопустимо в представлениях, встроенных функциях, производных таблицах, вложенных запросах и обобщенных табличных выражениях, если не указаны также TOP, OFFSET или FOR XML.', c.line);
    var members = flattenSet(c.query.body, []);
    var anchors = [], recs = [], seenRec = false;
    members.forEach(function (m, i) {
      var isRec = refersTo(m.node, lname);
      if (isRec) {
        if (m.op !== 'UNION ALL') throw err(252, 'Рекурсивное обобщенное табличное выражение "' + c.name + '" не содержит инструкции UNION ALL верхнего уровня.', c.line);
        seenRec = true; recs.push(m.node);
      } else {
        if (seenRec) throw err(246, 'В рекурсивном обобщенном табличном выражении "' + c.name + '" не найдены якорные элементы перед рекурсивными.', c.line);
        anchors.push(m);
      }
    });
    if (!anchors.length) throw err(246, 'Для рекурсивного обобщенного табличного выражения "' + c.name + '" не найдены якорные элементы.', c.line);
    var anchorNode = anchors[0].node;
    for (var i = 1; i < anchors.length; i++) anchorNode = { type: 'setop', op: anchors[i].op, left: anchorNode, right: anchors[i].node };
    var anchorPlan = compileSetBody(anchorNode, env, parentScope, { inner: true });
    var names2 = namesFor(anchorPlan.cols, c.cols, c.name, c.line);
    cte.cols = anchorPlan.cols.map(function (col, i) { return { name: names2[i], type: col.type }; });
    var work = { rows: [] };
    var iterating = false, cache2 = null;
    env.ctes[lname] = cte;
    cte.getRows = function (ctx) {
      if (iterating) return work.rows;
      if (cache2) return cache2;
      var all = anchorPlan.run(ctx).slice();
      work.rows = all.slice();
      var maxr = stmt && stmt.maxrecursion != null ? stmt.maxrecursion : 100;
      var level = 0;
      while (work.rows.length) {
        iterating = true;
        var next = [];
        try {
          recPlans.forEach(function (p) { var rr = p.run(ctx); for (var q = 0; q < rr.length; q++) next.push(rr[q]); });
        } finally { iterating = false; }
        if (!next.length) break;
        level++;
        if (maxr > 0 && level > maxr) {
          var e = err(530, 'Выполнение инструкции прервано. Максимальная рекурсия ' + maxr + ' была исчерпана до завершения инструкции.', c.line);
          e.hintText = 'Рекурсия по умолчанию ограничена 100 шагами. Проверьте условие остановки в рекурсивной части или добавьте в конец запроса OPTION (MAXRECURSION 1000).';
          throw e;
        }
        if (level > 100000 || all.length > MAX_ROWS) throw err(50003, 'Рекурсия не останавливается — проверьте условие выхода в рекурсивной части CTE.');
        for (var q2 = 0; q2 < next.length; q2++) all.push(next[q2]);
        work.rows = next;
        tick(env.session);
      }
      cache2 = all;
      return all;
    };
    var recPlans = recs.map(function (r) { return compileSetBody(r, env, parentScope, { inner: true }); });
    recPlans.forEach(function (p) {
      if (p.cols.length !== cte.cols.length) throw err(205, 'Все запросы, объединенные с помощью операторов UNION, INTERSECT или EXCEPT, должны иметь одинаковое число выражений в целевых списках.', c.line);
      p.cols.forEach(function (col, i) {
        if (!sameType(col.type, cte.cols[i].type)) {
          var e = err(240, 'Типы якорной и рекурсивной частей не совпадают в столбце "' + cte.cols[i].name + '" рекурсивного запроса "' + c.name + '".', c.line);
          e.hintText = 'Тип столбца в якоре: ' + T.typeFull(cte.cols[i].type) + ', в рекурсивной части: ' + T.typeFull(col.type) + '. Приведите обе части к одному типу, например CAST(... AS NVARCHAR(500)) и в якоре, и в рекурсии.';
          throw e;
        }
      });
    });
  }

  function compileSetBody(node, env, parentScope, opts) {
    if (node.type === 'core') return compileCore(node, env, parentScope, null, opts);
    if (node.type === 'parenq') return compileQuery(node.query, env, parentScope, { inner: true });
    var L = compileSetBody(node.left, env, parentScope, {}), R = compileSetBody(node.right, env, parentScope, {});
    if (L.cols.length !== R.cols.length) {
      var e = err(205, 'Все запросы, объединенные с помощью операторов UNION, INTERSECT или EXCEPT, должны иметь одинаковое число выражений в целевых списках.', node.right.line || node.left.line);
      e.hintText = 'В первом запросе столбцов: ' + L.cols.length + ', во втором: ' + R.cols.length + '. Количество и порядок столбцов должны совпадать.';
      throw e;
    }
    var session = env.session;
    // Константа NULL в списке выбора типа не имеет: SELECT 'a' UNION ALL SELECT NULL — допустимо (тип берётся у второй части)
    var bothNull = [];
    var types = L.cols.map(function (c, i) {
      var r = R.cols[i], lt = c.nul ? TY.nul() : c.type, rt = r.nul ? TY.nul() : r.type;
      var t = T.strongerType(lt, rt);
      if (!T.implicitOk(lt, t) || !T.implicitOk(rt, t)) throw err(206, 'Конфликт типов операндов: ' + T.typeName(c.type) + ' несовместим с ' + T.typeName(r.type));
      bothNull[i] = t.kind === 'null';
      return t.kind === 'null' ? TY.int() : t;
    });
    var cols = L.cols.map(function (c, i) { return bothNull[i] ? { name: c.name, type: types[i], nul: true } : { name: c.name, type: types[i] }; });
    function convRows(rows, srcCols) {
      var need = srcCols.some(function (c, i) { return !c.nul && c.type.kind !== types[i].kind && !(T.isNum(c.type) && T.isNum(types[i])) && c.type.kind !== 'null'; });
      if (!need) return rows;
      return rows.map(function (r) { return r.map(function (v, i) { if (v === null) return null; var from = srcCols[i].type; if (from.kind === types[i].kind || (T.isNum(from) && T.isNum(types[i]))) return v; return convert(v, from, types[i], { settings: session.settings }); }); });
    }
    var op = node.op;
    return {
      cols: cols, run: function (ctx) {
        var lr = convRows(L.run(ctx), L.cols), rr = convRows(R.run(ctx), R.cols);
        var keyOfRow = function (r) { return r.map(function (v, i) { return T.keyOf(v, types[i].kind); }).join('\u0001'); };
        if (op === 'UNION ALL') return lr.concat(rr);
        var seen = new Set(), out = [];
        if (op === 'UNION') {
          lr.concat(rr).forEach(function (r) { var k = keyOfRow(r); if (!seen.has(k)) { seen.add(k); out.push(r); } });
          return out;
        }
        var rset = new Set(rr.map(keyOfRow));
        lr.forEach(function (r) { var k = keyOfRow(r); if (seen.has(k)) return; var inR = rset.has(k); if ((op === 'INTERSECT') === inR) { seen.add(k); out.push(r); } });
        return out;
      }
    };
  }

  function compileQuery(q, env, parentScope, opts) {
    opts = opts || {};
    var env2 = env;
    if (q.with) {
      env2 = new Env(env);
      q.with.forEach(function (c) { defineCte(c, env2, parentScope, opts.stmt); });
    }
    var hasTop = q.body.type === 'core' && q.body.top;
    if (opts.inner && q.orderBy && !q.offset && !hasTop) {
      var e = err(1033, 'Предложение ORDER BY недопустимо в представлениях, встроенных функциях, производных таблицах, вложенных запросах и обобщенных табличных выражениях, если не указаны также TOP, OFFSET или FOR XML.', q.line);
      e.hintText = 'Сортировка внутри подзапроса или CTE ничего не гарантирует. Уберите ORDER BY отсюда и поставьте его в самый внешний (последний) SELECT.';
      throw e;
    }
    if (q.body.type === 'core') return compileCore(q.body, env2, parentScope, { orderBy: q.orderBy, offset: q.offset, fetch: q.fetch }, { traceTop: opts.traceTop });
    var plan = compileSetBody(q.body, env2, parentScope, {});
    if (!q.orderBy) return plan;
    // ORDER BY для UNION / INTERSECT / EXCEPT
    var specs = q.orderBy.map(function (o) {
      var e2 = stripParen(o.expr);
      if (e2.type === 'lit' && e2.ltype.kind === 'int') {
        if (e2.value < 1 || e2.value > plan.cols.length) throw err(108, 'Порядковый номер ' + e2.value + ' в предложении ORDER BY выходит за пределы числа элементов в списке выбора.', o.expr.line);
        return { i: e2.value - 1, desc: o.desc, kind: plan.cols[e2.value - 1].type.kind };
      }
      if (e2.type === 'col') {
        var ln = e2.parts[e2.parts.length - 1].toLowerCase();
        for (var i = 0; i < plan.cols.length; i++) if (plan.cols[i].name && plan.cols[i].name.toLowerCase() === ln) return { i: i, desc: o.desc, kind: plan.cols[i].type.kind };
      }
      throw err(104, 'Элементы ORDER BY должны находиться в списке выбора, если инструкция содержит оператор UNION, INTERSECT или EXCEPT.', o.expr.line);
    });
    var offC = { scope: new Scope([], null), mode: 'row', session: env.session, env: env, clause: 'OFFSET', allowWin: false };
    var offFn = q.offset ? val(q.offset, offC).fn : null, fetchFn = q.fetch ? val(q.fetch, offC).fn : null;
    return {
      cols: plan.cols, run: function (ctx) {
        var rows = plan.run(ctx).map(function (r) { return { v: r, ok: specs.map(function (s) { return r[s.i]; }) }; });
        rows = sortRows(rows, null, specs).map(function (o) { return o.v; });
        if (offFn) { var off = offFn({ row: [], parent: null }), fe = fetchFn ? fetchFn({ row: [], parent: null }) : null; rows = rows.slice(off, fe === null ? undefined : off + fe); }
        return rows;
      }
    };
  }
  T._compileQuery = compileQuery;

  /* ================= Выполнение пакета ================= */
  function localNow() {
    var d = new Date();
    return T.mkDate(d.getFullYear(), d.getMonth() + 1, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
  }
  T.localNow = localNow;
  function dbNames(session) { return Object.keys(session.dbs).map(function (k) { return session.dbs[k].name; }); }
  T.newSession = function (db, opts) {
    opts = opts || {};
    var now = opts.now != null ? opts.now : localNow();
    var dbs = {};
    if (opts.dbs) Object.keys(opts.dbs).forEach(function (k) { dbs[k.toLowerCase()] = opts.dbs[k]; });
    if (db && db.name && !dbs[db.name.toLowerCase()]) dbs[db.name.toLowerCase()] = db;
    return {
      db: db, dbs: dbs, vars: {}, temps: {}, rowcount: 0, ticks: 0,
      settings: { language: 'us_english', datefirst: 7, dateformat: 'mdy' },
      now: now, nowUtc: now - 6 * 3600000, deadline: 0
    };
  };

  function evalStandalone(expr, session) {
    var env = new Env(null, session);
    var C = { scope: new Scope([], null), mode: 'row', session: session, env: env, clause: 'SET', allowWin: false };
    var c = val(expr, C);
    return { type: c.type, value: c.fn({ row: [], parent: null }) };
  }

  T.execute = function (sql, db, opts) {
    opts = opts || {};
    var t0 = Date.now();
    var res = { results: [], messages: [], error: null, trace: null, timeMs: 0 };
    var session = opts.session || T.newSession(db, opts);
    session.deadline = Date.now() + (opts.timeoutMs || 8000);
    session.ticks = 0;
    var stmts;
    try { stmts = T.parse(sql); }
    catch (e) { res.error = wrapErr(e); res.timeMs = Date.now() - t0; return res; }
    if (!stmts.length) { res.messages.push('Нет инструкций для выполнения.'); return res; }
    for (var i = 0; i < stmts.length; i++) {
      var st = stmts[i];
      try {
        if (st.type === 'select') {
          var env = new Env(null, session);
          var isTrace = opts.trace && stmts.filter(function (s) { return s.type === 'select'; })[0] === st;
          var plan = compileQuery(st.query, env, null, { stmt: st, traceTop: isTrace });
          var trace = isTrace ? [] : null;
          var rows = plan.run({ row: [], parent: null }, trace);
          if (trace) res.trace = trace;
          session.rowcount = rows.length;
          if (plan.assigns && plan.assigns.length) continue;
          if (plan.into) {
            var tl = plan.into.toLowerCase();
            if (session.temps[tl]) throw err(2714, 'В базе данных уже существует объект с именем "' + plan.into + '".', st.line);
            var seen = {};
            plan.cols.forEach(function (c, ci) {
              if (!c.name) throw err(1038, 'Имя объекта или столбца пропущено или пусто. Для инструкций SELECT INTO убедитесь, что у каждого столбца есть имя (столбец ' + (ci + 1) + ').', st.line);
              if (seen[c.name.toLowerCase()]) throw err(2705, 'Имена столбцов в каждой таблице должны быть уникальными. Имя столбца "' + c.name + '" в таблице "' + plan.into + '" указано более одного раза.', st.line);
              seen[c.name.toLowerCase()] = 1;
            });
            session.temps[tl] = { name: plan.into, columns: plan.cols.map(function (c) { return { name: c.name, type: c.type }; }), rows: rows };
            res.messages.push('(затронуто строк: ' + rows.length + ')');
            continue;
          }
          var types = plan.cols.map(function (c) { return c.type; });
          res.results.push({
            columns: plan.cols.map(function (c) { return c.name || NONAME; }),
            types: types.map(T.typeFull),
            kinds: types.map(function (t) { return t.kind; }),
            rows: rows.map(function (r) { return r.map(function (v, j) { return T.display(v, types[j]); }); }),
            raw: rows,
            ordered: !!(st.query.orderBy)
          });
          res.messages.push('(затронуто строк: ' + rows.length + ')');
        } else if (st.type === 'declare') {
          st.vars.forEach(function (v) {
            var ln = v.name.toLowerCase();
            if (session.vars[ln]) throw err(134, 'Имя переменной "' + v.name + '" уже объявлено. Имена переменных должны быть уникальными в пределах пакета запросов.', v.line);
            var value = null;
            if (v.init) { var r = evalStandalone(v.init, session); value = r.value === null ? null : convert(r.value, r.type.kind === 'null' ? v.dtype : r.type, v.dtype, { settings: session.settings }); }
            session.vars[ln] = { type: v.dtype, value: value, name: v.name };
          });
        } else if (st.type === 'set') {
          var ln2 = st.name.toLowerCase();
          if (!session.vars[ln2]) throw err(137, 'Необходимо объявить скалярную переменную "' + st.name + '".', st.line);
          var r2 = evalStandalone(st.expr, session), vt = session.vars[ln2].type;
          session.vars[ln2].value = r2.value === null ? null : convert(r2.value, r2.type.kind === 'null' ? vt : r2.type, vt, { settings: session.settings });
        } else if (st.type === 'setopt') {
          if (st.opt === 'LANGUAGE') {
            var lv = st.value.toLowerCase();
            if (lv === 'russian' || lv === 'русский') { session.settings.language = 'russian'; session.settings.datefirst = 1; session.settings.dateformat = 'dmy'; res.messages.push('Параметр языка изменен на Русский.'); }
            else if (lv === 'us_english' || lv === 'english') { session.settings.language = 'us_english'; session.settings.datefirst = 7; session.settings.dateformat = 'mdy'; res.messages.push('Changed language setting to us_english.'); }
            else throw err(2737, '"' + st.value + '" не является официальным названием языка. В учебном движке доступны: Russian, us_english.', st.line);
          } else if (st.opt === 'DATEFIRST') {
            if (st.value < 1 || st.value > 7) throw err(1005, 'Значение DATEFIRST должно быть от 1 до 7.', st.line);
            session.settings.datefirst = st.value;
          } else if (st.opt === 'DATEFORMAT') {
            if (['mdy', 'dmy', 'ymd', 'ydm', 'myd', 'dym'].indexOf(st.value) < 0) throw err(1005, 'Недопустимый параметр DATEFORMAT.', st.line);
            session.settings.dateformat = st.value;
          }
        } else if (st.type === 'use') {
          var udb = session.dbs[st.name.toLowerCase()];
          if (!udb) {
            var ue = err(911, 'База данных "' + st.name + '" не существует. Проверьте правильность имени.', st.line);
            ue.hintText = 'Доступные базы: ' + dbNames(session).join(', ') + '. Другие учебные базы подключаются в разделе «Базы».';
            throw ue;
          }
          session.db = udb;
          res.useDb = udb.name;
        } else if (st.type === 'drop') {
          st.names.forEach(function (n) {
            var l = n.toLowerCase();
            if (!session.temps[l]) { if (st.ifExists) return; throw err(3701, 'Не удалось удалить таблицу "' + n + '", так как она не существует или отсутствует разрешение.', st.line); }
            delete session.temps[l];
          });
        }
      } catch (e) {
        res.error = wrapErr(e);
        break;
      }
    }
    if (!res.error && !res.results.length && !res.messages.length) res.messages.push('Команды выполнены успешно.');
    res.timeMs = Date.now() - t0;
    res.session = session;
    return res;
  };

  function wrapErr(e) {
    if (e instanceof T.SqlError) return e;
    var w = err(50099, 'Внутренняя ошибка учебного движка: ' + (e && e.message) + '. Попробуйте переписать запрос иначе.');
    w.internal = e;
    if (typeof console !== 'undefined') console.error(e);
    return w;
  }

  /* ================= Подсказки к ошибкам для новичков ================= */
  T.explain = function (e) {
    if (!e) return '';
    if (e.hintText) return e.hintText;
    var s = e.suggest && e.suggest.length ? ' Может быть, вы имели в виду: ' + e.suggest.join(', ') + '?' : '';
    switch (e.number) {
      case 207: return 'Такого столбца нет в таблицах, указанных во FROM.' + s + ' Проверьте опечатки и откройте «Схему базы». Псевдоним из SELECT нельзя использовать в WHERE — он появляется позже.';
      case 208: return 'Таблица с таким именем не найдена.' + s + ' Список таблиц — в разделе «Схема базы».';
      case 209: return 'Столбец с таким именем есть в нескольких таблицах запроса. Укажите, из какой таблицы его брать: c.ClientID вместо ClientID.';
      case 4104: return 'Префикс перед точкой не совпадает ни с одним псевдонимом/таблицей во FROM. Если таблице дан псевдоним (FROM Clients c), обращайтесь к столбцам через него: c.City.';
      case 8120: case 8121: case 8127: return 'В запросе с GROUP BY (или с агрегатом) каждый столбец должен быть либо перечислен в GROUP BY, либо стоять внутри агрегатной функции (SUM, COUNT, AVG, MIN, MAX).';
      case 102: case 156: return 'Ошибка в записи запроса рядом с указанным словом. Частые причины: пропущена запятая между столбцами, лишняя запятая перед FROM, не закрыта скобка или кавычка, опечатка в ключевом слове.';
      case 105: return 'Строка не закрыта апострофом. Текст в SQL пишется в одинарных кавычках: \'Бишкек\'. Если внутри текста есть апостроф, удвойте его: \'O\'\'Brien\'.';
      case 245: case 8114: return 'SQL Server пытается превратить текст в число и не может. Если сравниваете текстовый столбец, берите значение в кавычки. Для «грязных» данных используйте TRY_CAST — вернёт NULL вместо ошибки. Для склейки текста с числом используйте CONCAT.';
      case 241: case 242: return 'Не удалось распознать дату. Самый надёжный формат — \'YYYYMMDD\' (например \'20260131\') или \'YYYY-MM-DD\' для типа DATE.';
      case 8134: return 'Деление на ноль. Защититесь через NULLIF: Amount / NULLIF(Cnt, 0) — при нуле получится NULL вместо ошибки.';
      case 512: return 'Подзапрос вернул несколько строк, а ожидалось одно значение. Добавьте фильтр, агрегат (MAX, SUM) или TOP (1) ... ORDER BY, либо используйте IN вместо =.';
      case 116: return 'Подзапрос в IN / сравнении должен возвращать ровно один столбец.';
      case 147: return 'Агрегатные функции нельзя использовать в WHERE. Фильтр по SUM/COUNT/AVG пишется в HAVING после GROUP BY.';
      case 4108: return 'Оконные функции (… OVER (...)) вычисляются после WHERE, поэтому фильтровать по ним можно только во внешнем запросе: оберните запрос в CTE или подзапрос и отфильтруйте там.';
      case 1033: return 'Уберите ORDER BY из подзапроса/CTE и сортируйте во внешнем запросе.';
      case 205: return 'У запросов, объединяемых UNION/INTERSECT/EXCEPT, должно быть одинаковое количество столбцов.';
      case 145: return 'При SELECT DISTINCT сортировать можно только по столбцам, которые есть в списке SELECT.';
      case 137: return 'Переменную нужно сначала объявить: DECLARE @Имя ТИП = значение; — и запускать объявление вместе с запросом, где она используется.';
      case 206: return 'Сравниваются значения несовместимых типов. Приведите их к одному типу через CAST.';
      case 8117: return 'Эта операция не применима к значениям такого типа. Например, SUM нельзя считать по тексту, а к дате (DATE) нельзя прибавить число — используйте DATEADD.';
      case 1013: return 'Одна и та же таблица дважды во FROM — дайте им разные псевдонимы.';
      case 195: return 'Такой функции нет в SQL Server.' + s;
      case 174: case 189: return 'Неверное количество аргументов у функции. Проверьте запятые внутри скобок.';
      case 530: return 'Рекурсия выполнила больше шагов, чем разрешено. Проверьте условие остановки или добавьте OPTION (MAXRECURSION N).';
      case 240: return 'Типы столбцов в якорной и рекурсивной части CTE должны совпадать полностью, включая длину строк. Используйте CAST в обеих частях.';
      case 4145: return 'Ожидается условие (например, Amount > 0), а указано просто значение.';
      case 1062: return 'Для TOP ... WITH TIES обязательно нужен ORDER BY — по нему определяются «ничьи».';
      case 4112: return 'Ранжирующим функциям и LAG/LEAD нужно знать порядок строк: укажите ORDER BY внутри OVER (...).';
      case 10753: return 'Это оконная функция — ей нужно OVER (...), например ROW_NUMBER() OVER (ORDER BY Amount DESC).';
      case 50000: return 'В курсе изучаем только чтение данных (SELECT). Аналитику для отчётов не требуется изменять данные.';
      default: return s ? s.trim() : '';
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
