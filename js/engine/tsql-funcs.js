/* ============================================================
   Учебный движок T-SQL. Часть 3: встроенные скалярные функции
   ============================================================ */
(function (G) {
  'use strict';
  var T = G.TSQL;
  var err = T.err, TY = T.TY, convert = T.convert;
  var DAY = 86400000;
  var FN = T.FN = {};

  function def(names, min, max, compile) {
    names.split(',').forEach(function (n) { FN[n.trim()] = { min: min, max: max, compile: compile }; });
  }
  T.defFn = def;

  /* ---------- помощники преобразования аргументов ---------- */
  function strFn(a) {
    if (a.type.kind === 'str') return a.fn;
    if (a.type.kind === 'null') return function () { return null; };
    var t = a.type;
    return function (ctx) { var v = a.fn(ctx); return v === null ? null : convert(v, t, TY.str(-1)); };
  }
  T.strFn = strFn;
  function strType(a, len) {
    if (a.type.kind === 'str') return len === undefined ? a.type : TY.str(len, a.type.n);
    return TY.str(len === undefined ? 30 : len, false);
  }
  function numFn(a) {
    var k = a.type.kind;
    if (k === 'int' || k === 'decimal' || k === 'float' || k === 'bit') return a.fn;
    if (k === 'null') return function () { return null; };
    var t = a.type;
    return function (ctx) { var v = a.fn(ctx); return v === null ? null : convert(v, t, TY.float()); };
  }
  function intFn(a) {
    var k = a.type.kind;
    if (k === 'int' || k === 'bit') return a.fn;
    if (k === 'null') return function () { return null; };
    var t = a.type;
    return function (ctx) { var v = a.fn(ctx); return v === null ? null : convert(v, t, TY.int()); };
  }
  function dateFn(a, C, kind) {
    var k = a.type.kind;
    if (k === 'date' || k === 'datetime') return a.fn;
    if (k === 'null') return function () { return null; };
    var t = a.type, sess = C.session;
    return function (ctx) { var v = a.fn(ctx); return v === null ? null : convert(v, t, kind === 'date' ? TY.date() : TY.datetime(), { settings: sess.settings }); };
  }
  function dateKind(a) { return a.type.kind === 'date' ? 'date' : 'datetime'; }
  T.argHelpers = { strFn: strFn, numFn: numFn, intFn: intFn, dateFn: dateFn };

  /* ---------- Строковые функции ---------- */
  def('LEN', 1, 1, function (a) {
    var f = strFn(a[0]);
    return { type: TY.int(), fn: function (ctx) { var s = f(ctx); return s === null ? null : s.replace(/ +$/, '').length; } };
  });
  def('DATALENGTH', 1, 1, function (a) {
    var f = strFn(a[0]), n = a[0].type.kind === 'str' && a[0].type.n, k = a[0].type.kind;
    return { type: TY.int(), fn: function (ctx) { var v = a[0].fn(ctx); if (v === null) return null; if (k === 'int') return 4; if (k === 'decimal') return 9; if (k === 'date') return 3; if (k === 'datetime') return 8; var s = f(ctx); return n ? s.length * 2 : s.length; } };
  });
  def('UPPER', 1, 1, function (a) { var f = strFn(a[0]); return { type: strType(a[0]), fn: function (ctx) { var s = f(ctx); return s === null ? null : s.toUpperCase(); } }; });
  def('LOWER', 1, 1, function (a) { var f = strFn(a[0]); return { type: strType(a[0]), fn: function (ctx) { var s = f(ctx); return s === null ? null : s.toLowerCase(); } }; });
  def('LTRIM', 1, 2, function (a) { var f = strFn(a[0]); return { type: strType(a[0]), fn: function (ctx) { var s = f(ctx); return s === null ? null : s.replace(/^ +/, ''); } }; });
  def('RTRIM', 1, 2, function (a) { var f = strFn(a[0]); return { type: strType(a[0]), fn: function (ctx) { var s = f(ctx); return s === null ? null : s.replace(/ +$/, ''); } }; });
  def('TRIM', 1, 1, function (a) { var f = strFn(a[0]); return { type: strType(a[0]), fn: function (ctx) { var s = f(ctx); return s === null ? null : s.replace(/^ +| +$/g, ''); } }; });
  def('LEFT', 2, 2, function (a) {
    var f = strFn(a[0]), n = intFn(a[1]);
    return { type: strType(a[0]), fn: function (ctx) { var s = f(ctx), k = n(ctx); if (s === null || k === null) return null; if (k < 0) throw err(536, 'Недопустимый параметр длины, переданный функции left.'); return s.substr(0, k); } };
  });
  def('RIGHT', 2, 2, function (a) {
    var f = strFn(a[0]), n = intFn(a[1]);
    return { type: strType(a[0]), fn: function (ctx) { var s = f(ctx), k = n(ctx); if (s === null || k === null) return null; if (k < 0) throw err(536, 'Недопустимый параметр длины, переданный функции right.'); return k === 0 ? '' : s.slice(-k); } };
  });
  def('SUBSTRING', 2, 3, function (a) {
    var f = strFn(a[0]), st = intFn(a[1]), ln = a[2] ? intFn(a[2]) : null;
    return {
      type: strType(a[0]), fn: function (ctx) {
        var s = f(ctx), b = st(ctx), l = ln ? ln(ctx) : 1e9;
        if (s === null || b === null || l === null) return null;
        if (l < 0) throw err(537, 'Недопустимый параметр длины, переданный функции LEFT или SUBSTRING.');
        var e = b + l;
        var from = Math.max(b, 1), to = Math.max(e, 1);
        return s.slice(from - 1, to - 1);
      }
    };
  });
  def('CHARINDEX', 2, 3, function (a) {
    var f = strFn(a[0]), s = strFn(a[1]), st = a[2] ? intFn(a[2]) : null;
    return {
      type: TY.int(), fn: function (ctx) {
        var x = f(ctx), y = s(ctx), b = st ? st(ctx) : 1;
        if (x === null || y === null) return null;
        if (b === null || b < 1) b = 1;
        if (x === '') return 0;
        return y.toLowerCase().indexOf(x.toLowerCase(), b - 1) + 1;
      }
    };
  });
  def('PATINDEX', 2, 2, function (a) {
    var p = strFn(a[0]), s = strFn(a[1]);
    return {
      type: TY.int(), fn: function (ctx) {
        var pat = p(ctx), str = s(ctx);
        if (pat === null || str === null) return null;
        var lead = /^%/.test(pat), trail = /%$/.test(pat);
        var core = pat.replace(/^%/, '').replace(/%$/, '');
        var re = T.likeToRegex(core).source.replace(/^\^/, '').replace(/\$$/, '');
        var rx = new RegExp((lead ? '' : '^') + re + (trail ? '' : '$'), 'i');
        var m = rx.exec(str);
        return m ? m.index + 1 : 0;
      }
    };
  });
  def('REPLACE', 3, 3, function (a) {
    var s = strFn(a[0]), x = strFn(a[1]), y = strFn(a[2]);
    var n = (a[0].type.n || a[1].type.n || a[2].type.n);
    var maxed = a[0].type.len < 0;
    return {
      type: TY.str(maxed ? -1 : (n ? 4000 : 8000), n), fn: function (ctx) {
        var str = s(ctx), f = x(ctx), r = y(ctx);
        if (str === null || f === null || r === null) return null;
        if (f === '') return str;
        var esc = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return str.replace(new RegExp(esc, 'gi'), function () { return r; });
      }
    };
  });
  def('REPLICATE', 2, 2, function (a) {
    var s = strFn(a[0]), n = intFn(a[1]);
    return { type: TY.str(a[0].type.len < 0 ? -1 : 8000, a[0].type.n), fn: function (ctx) { var x = s(ctx), k = n(ctx); if (x === null || k === null || k < 0) return null; return new Array(k + 1).join(x); } };
  });
  def('REVERSE', 1, 1, function (a) { var s = strFn(a[0]); return { type: strType(a[0]), fn: function (ctx) { var x = s(ctx); return x === null ? null : x.split('').reverse().join(''); } }; });
  def('SPACE', 1, 1, function (a) { var n = intFn(a[0]); return { type: TY.str(8000), fn: function (ctx) { var k = n(ctx); return k === null || k < 0 ? null : new Array(k + 1).join(' '); } }; });
  def('STUFF', 4, 4, function (a) {
    var s = strFn(a[0]), st = intFn(a[1]), ln = intFn(a[2]), ins = strFn(a[3]);
    return { type: strType(a[0], a[0].type.len < 0 ? -1 : 8000), fn: function (ctx) { var x = s(ctx), b = st(ctx), l = ln(ctx), y = ins(ctx); if (x === null || b === null || l === null) return null; if (b < 1 || b > x.length || l < 0) return null; return x.slice(0, b - 1) + (y === null ? '' : y) + x.slice(b - 1 + l); } };
  });
  function strLenOf(t) {
    if (t.kind === 'str') return t.len;
    if (t.kind === 'null') return 1;
    if (t.kind === 'date' || t.kind === 'datetime') return 30;
    return 40;
  }
  def('CONCAT', 2, 254, function (a) {
    var fs = a.map(strFn);
    var n = a.some(function (x) { return x.type.kind === 'str' && x.type.n; });
    var len = 0, max = false;
    a.forEach(function (x) { var l = strLenOf(x.type); if (l < 0) max = true; else len += l; });
    if (len > (n ? 4000 : 8000)) max = true;
    return { type: TY.str(max ? -1 : len, n), fn: function (ctx) { var r = ''; for (var i = 0; i < fs.length; i++) { var v = fs[i](ctx); if (v !== null) r += v; } return r; } };
  });
  def('CONCAT_WS', 3, 254, function (a) {
    var fs = a.map(strFn);
    var n = a.some(function (x) { return x.type.kind === 'str' && x.type.n; });
    return {
      type: TY.str(n ? 4000 : 8000, n), fn: function (ctx) {
        var sep = fs[0](ctx); if (sep === null) sep = '';
        var parts = [];
        for (var i = 1; i < fs.length; i++) { var v = fs[i](ctx); if (v !== null) parts.push(v); }
        return parts.join(sep);
      }
    };
  });
  def('ASCII', 1, 1, function (a) { var s = strFn(a[0]); return { type: TY.int(), fn: function (ctx) { var x = s(ctx); return x === null || x === '' ? null : x.charCodeAt(0); } }; });
  def('UNICODE', 1, 1, function (a) { var s = strFn(a[0]); return { type: TY.int(), fn: function (ctx) { var x = s(ctx); return x === null || x === '' ? null : x.charCodeAt(0); } }; });
  def('CHAR,NCHAR', 1, 1, function (a) { var n = intFn(a[0]); return { type: TY.str(1), fn: function (ctx) { var k = n(ctx); return k === null ? null : String.fromCharCode(k); } }; });
  def('QUOTENAME', 1, 2, function (a) { var s = strFn(a[0]); return { type: TY.str(258, true), fn: function (ctx) { var x = s(ctx); return x === null ? null : '[' + x.replace(/]/g, ']]') + ']'; } }; });

  /* ---------- Числовые функции ---------- */
  function sameNumType(t) {
    if (t.kind === 'str') return TY.float();
    if (t.kind === 'null') return TY.int();
    if (t.kind === 'bit') return TY.int();
    return t;
  }
  def('ABS', 1, 1, function (a) { var f = numFn(a[0]); return { type: sameNumType(a[0].type), fn: function (ctx) { var v = f(ctx); return v === null ? null : Math.abs(v); } }; });
  def('SIGN', 1, 1, function (a) { var f = numFn(a[0]); return { type: sameNumType(a[0].type), fn: function (ctx) { var v = f(ctx); return v === null ? null : (v > 0 ? 1 : v < 0 ? -1 : 0); } }; });
  def('ROUND', 2, 3, function (a) {
    var f = numFn(a[0]), n = intFn(a[1]), m = a[2] ? intFn(a[2]) : null;
    var t = sameNumType(a[0].type);
    return {
      type: t, fn: function (ctx) {
        var v = f(ctx), d = n(ctx), tr = m ? m(ctx) : 0;
        if (v === null || d === null) return null;
        var r;
        if (tr) r = d >= 0 ? T.truncTo(v, d) : Math.trunc(v / Math.pow(10, -d)) * Math.pow(10, -d);
        else if (d >= 0) r = T.roundHalfAway(v, d);
        else { var p = Math.pow(10, -d); r = (v < 0 ? -1 : 1) * Math.round(Math.abs(v) / p + 1e-9) * p; }
        if (t.kind === 'int') return Math.trunc(r);
        return r;
      }
    };
  });
  def('CEILING', 1, 1, function (a) { var f = numFn(a[0]); var t = a[0].type.kind === 'decimal' ? TY.dec(a[0].type.p, 0) : sameNumType(a[0].type); return { type: t, fn: function (ctx) { var v = f(ctx); return v === null ? null : Math.ceil(v - 1e-12); } }; });
  def('FLOOR', 1, 1, function (a) { var f = numFn(a[0]); var t = a[0].type.kind === 'decimal' ? TY.dec(a[0].type.p, 0) : sameNumType(a[0].type); return { type: t, fn: function (ctx) { var v = f(ctx); return v === null ? null : Math.floor(v + 1e-12); } }; });
  def('POWER', 2, 2, function (a) {
    var f = numFn(a[0]), g = numFn(a[1]);
    var t = a[0].type.kind === 'decimal' ? T.capDec(38, a[0].type.s) : sameNumType(a[0].type);
    return { type: t, fn: function (ctx) { var x = f(ctx), y = g(ctx); if (x === null || y === null) return null; var r = Math.pow(x, y); if (t.kind === 'int') return Math.trunc(r); if (t.kind === 'decimal') return T.roundHalfAway(r, t.s); return r; } };
  });
  def('SQRT', 1, 1, function (a) { var f = numFn(a[0]); return { type: TY.float(), fn: function (ctx) { var v = f(ctx); if (v === null) return null; if (v < 0) throw err(3623, 'Произошла недопустимая операция с плавающей запятой.'); return Math.sqrt(v); } }; });
  def('SQUARE', 1, 1, function (a) { var f = numFn(a[0]); return { type: TY.float(), fn: function (ctx) { var v = f(ctx); return v === null ? null : v * v; } }; });
  def('EXP', 1, 1, function (a) { var f = numFn(a[0]); return { type: TY.float(), fn: function (ctx) { var v = f(ctx); return v === null ? null : Math.exp(v); } }; });
  def('LOG', 1, 2, function (a) { var f = numFn(a[0]), b = a[1] ? numFn(a[1]) : null; return { type: TY.float(), fn: function (ctx) { var v = f(ctx); if (v === null) return null; if (v <= 0) throw err(3623, 'Произошла недопустимая операция с плавающей запятой.'); return b ? Math.log(v) / Math.log(b(ctx)) : Math.log(v); } }; });
  def('LOG10', 1, 1, function (a) { var f = numFn(a[0]); return { type: TY.float(), fn: function (ctx) { var v = f(ctx); return v === null ? null : Math.log10(v); } }; });
  def('PI', 0, 0, function () { return { type: TY.float(), fn: function () { return Math.PI; } }; });
  def('RAND', 0, 1, function () { return { type: TY.float(), fn: function () { return Math.random(); } }; });

  /* ---------- NULL и условные ---------- */
  function unify(args, C) {
    var t = TY.nul();
    args.forEach(function (x) { t = T.strongerType(t, x.type); });
    if (t.kind === 'null') t = TY.int();
    return t;
  }
  T.unifyTypes = unify;
  function castTo(a, t, C) {
    var from = a.type;
    if (from.kind === t.kind && (from.kind !== 'decimal' || (from.p === t.p && from.s === t.s)) && (from.kind !== 'str')) return a.fn;
    if (from.kind === 'str' && t.kind === 'str') return a.fn;
    if (!T.implicitOk(from, t)) throw err(206, 'Конфликт типов операндов: ' + T.typeName(from) + ' несовместим с ' + T.typeName(t));
    var sess = C.session;
    return function (ctx) { var v = a.fn(ctx); return v === null ? null : convert(v, from, t, { settings: sess.settings }); };
  }
  T.castTo = castTo;
  def('ISNULL', 2, 2, function (a, n, C) {
    var t = a[0].type.kind === 'null' ? (a[1].type.kind === 'null' ? TY.int() : a[1].type) : a[0].type;
    var f0 = a[0].fn;
    var from1 = a[1].type, sess = C.session;
    if (!T.implicitOk(from1, t)) throw err(206, 'Конфликт типов операндов: ' + T.typeName(from1) + ' несовместим с ' + T.typeName(t));
    var f1 = function (ctx) { var v = a[1].fn(ctx); return v === null ? null : convert(v, from1, t, { settings: sess.settings }); };
    return { type: t, fn: function (ctx) { var v = f0(ctx); return v !== null ? v : f1(ctx); } };
  });
  def('COALESCE', 1, 254, function (a, n, C) {
    if (a.length < 2) throw err(189, 'Функции coalesce требуется не менее 2 аргументов.', n.line);
    var t = unify(a, C);
    var fs = a.map(function (x) { return castTo(x, t, C); });
    return { type: t, fn: function (ctx) { for (var i = 0; i < fs.length; i++) { var v = fs[i](ctx); if (v !== null) return v; } return null; } };
  });
  def('NULLIF', 2, 2, function (a, n, C) {
    var ct = T.strongerType(a[0].type, a[1].type);
    var f0 = castTo(a[0], ct, C), f1 = castTo(a[1], ct, C);
    return { type: a[0].type.kind === 'null' ? TY.int() : a[0].type, fn: function (ctx) { var x = a[0].fn(ctx); if (x === null) return null; var cx = f0(ctx), cy = f1(ctx); if (cy !== null && T.cmpVal(cx, cy, ct.kind) === 0) return null; return x; } };
  });
  def('CHOOSE', 2, 254, function (a, n, C) {
    var idx = intFn(a[0]);
    var rest = a.slice(1), t = unify(rest, C);
    var fs = rest.map(function (x) { return castTo(x, t, C); });
    return { type: t, fn: function (ctx) { var i = idx(ctx); if (i === null || i < 1 || i > fs.length) return null; return fs[i - 1](ctx); } };
  });
  def('GREATEST,LEAST', 1, 254, function (a, n, C) {
    var t = unify(a, C), fs = a.map(function (x) { return castTo(x, t, C); });
    var g = n.name === 'GREATEST';
    return { type: t, fn: function (ctx) { var best = null; for (var i = 0; i < fs.length; i++) { var v = fs[i](ctx); if (v === null) continue; if (best === null || (g ? T.cmpVal(v, best, t.kind) > 0 : T.cmpVal(v, best, t.kind) < 0)) best = v; } return best; } };
  });
  def('DB_NAME', 0, 0, function (a, n, C) {
    var nm = (C.session.db && C.session.db.name) || 'master';
    return { type: TY.str(128, true), fn: function () { return nm; } };
  });
  def('NEWID', 0, 0, function () {
    return {
      type: TY.guid(), fn: function () {
        var h = '0123456789ABCDEF', s = '';
        for (var i = 0; i < 32; i++) { s += h[Math.floor(Math.random() * 16)]; if (i === 7 || i === 11 || i === 15 || i === 19) s += '-'; }
        return s;
      }
    };
  });

  /* ---------- Дата и время ---------- */
  def('GETDATE,SYSDATETIME,GETUTCDATE,SYSUTCDATETIME', 0, 0, function (a, n, C) {
    var sess = C.session;
    var utc = n.name === 'GETUTCDATE' || n.name === 'SYSUTCDATETIME';
    return { type: TY.datetime(), fn: function () { return utc ? sess.nowUtc : sess.now; } };
  });
  def('YEAR,MONTH,DAY', 1, 1, function (a, n, C) {
    var f = dateFn(a[0], C, 'datetime'), nm = n.name;
    return { type: TY.int(), fn: function (ctx) { var v = f(ctx); if (v === null) return null; var p = T.dparts(v); return nm === 'YEAR' ? p.y : nm === 'MONTH' ? p.m : p.d; } };
  });

  function weekdayNum(v, datefirst) { var d = new Date(v).getUTCDay(); return ((d - (datefirst % 7)) % 7 + 7) % 7 + 1; }
  function dayOfYear(v) { var p = T.dparts(v); return Math.round((T.mkDate(p.y, p.m, p.d) - T.mkDate(p.y, 1, 1)) / DAY) + 1; }
  function isoWeek(v) {
    var d = new Date(v); var day = (d.getUTCDay() + 6) % 7; // пн=0
    var th = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day + 3));
    var fy = new Date(Date.UTC(th.getUTCFullYear(), 0, 4));
    return 1 + Math.round(((th - fy) / DAY - 3 + ((fy.getUTCDay() + 6) % 7)) / 7);
  }
  function datePart(part, v, sett) {
    var p = T.dparts(v);
    switch (part) {
      case 'year': return p.y;
      case 'quarter': return Math.floor((p.m - 1) / 3) + 1;
      case 'month': return p.m;
      case 'dayofyear': return dayOfYear(v);
      case 'day': return p.d;
      case 'week': {
        var jan1 = T.mkDate(p.y, 1, 1);
        var wd1 = weekdayNum(jan1, sett.datefirst);
        return Math.floor((dayOfYear(v) - 1 + wd1 - 1) / 7) + 1;
      }
      case 'weekday': return weekdayNum(v, sett.datefirst);
      case 'hour': return p.hh;
      case 'minute': return p.mi;
      case 'second': return p.ss;
      case 'millisecond': return p.ms;
      case 'iso_week': return isoWeek(v);
    }
    return null;
  }
  T.datePart = datePart;
  function checkPartForDate(part, kind, fname) {
    if (kind === 'date' && (part === 'hour' || part === 'minute' || part === 'second' || part === 'millisecond')) {
      throw err(9810, 'Тип данных date не поддерживает часть даты ' + part + ' в функции ' + fname.toLowerCase() + '.');
    }
  }
  def('DATEPART', 1, 1, function (a, n, C) {
    var k = dateKind(a[0]); checkPartForDate(n.datepart, a[0].type.kind === 'date' ? 'date' : 'x', 'datepart');
    var f = dateFn(a[0], C, k), part = n.datepart, sess = C.session;
    return { type: TY.int(), fn: function (ctx) { var v = f(ctx); return v === null ? null : datePart(part, v, sess.settings); } };
  });
  def('DATENAME', 1, 1, function (a, n, C) {
    var k = dateKind(a[0]);
    var f = dateFn(a[0], C, k), part = n.datepart, sess = C.session;
    return {
      type: TY.str(30, true), fn: function (ctx) {
        var v = f(ctx); if (v === null) return null;
        var ru = sess.settings.language === 'russian';
        if (part === 'month') { var m = T.dparts(v).m - 1; return ru ? T.names.MONTH_RU[m] : T.names.MONTH_EN[m]; }
        if (part === 'weekday') { var d = new Date(v).getUTCDay(); return ru ? T.names.DAY_RU[d] : T.names.DAY_EN[d]; }
        return String(datePart(part, v, sess.settings));
      }
    };
  });
  function addMonths(v, n) {
    var p = T.dparts(v);
    var total = p.y * 12 + (p.m - 1) + n;
    var y = Math.floor(total / 12), m = total - y * 12 + 1;
    var d = Math.min(p.d, T.daysInMonth(y, m));
    return T.mkDate(y, m, d, p.hh, p.mi, p.ss, p.ms);
  }
  T.addMonths = addMonths;
  function dateAdd(part, n, v) {
    n = Math.trunc(n);
    switch (part) {
      case 'year': return addMonths(v, n * 12);
      case 'quarter': return addMonths(v, n * 3);
      case 'month': return addMonths(v, n);
      case 'week': return v + n * 7 * DAY;
      case 'day': case 'dayofyear': case 'weekday': return v + n * DAY;
      case 'hour': return v + n * 3600000;
      case 'minute': return v + n * 60000;
      case 'second': return v + n * 1000;
      case 'millisecond': return v + n;
    }
    throw err(9810, 'Часть даты ' + part + ' не поддерживается функцией dateadd.');
  }
  T.dateAdd = dateAdd;
  def('DATEADD', 2, 2, function (a, n, C) {
    var rk = a[1].type.kind === 'date' ? 'date' : 'datetime';
    checkPartForDate(n.datepart, rk, 'dateadd');
    var num = numFn(a[0]), f = dateFn(a[1], C, rk), part = n.datepart;
    return {
      type: rk === 'date' ? TY.date() : TY.datetime(), fn: function (ctx) {
        var k = num(ctx), v = f(ctx);
        if (k === null || v === null) return null;
        var r = dateAdd(part, k, v);
        var y = new Date(r).getUTCFullYear();
        if (y < 1753 || y > 9999) throw err(517, 'Добавление значения к столбцу "' + (rk) + '" вызвало переполнение.');
        return r;
      }
    };
  });
  function dateDiff(part, a, b) {
    var pa = T.dparts(a), pb = T.dparts(b);
    switch (part) {
      case 'year': return pb.y - pa.y;
      case 'quarter': return (pb.y * 4 + Math.floor((pb.m - 1) / 3)) - (pa.y * 4 + Math.floor((pa.m - 1) / 3));
      case 'month': return (pb.y * 12 + pb.m) - (pa.y * 12 + pa.m);
      case 'day': case 'dayofyear': case 'weekday': return Math.floor(b / DAY) - Math.floor(a / DAY);
      case 'week': return Math.floor((Math.floor(b / DAY) + 4) / 7) - Math.floor((Math.floor(a / DAY) + 4) / 7);
      case 'hour': return Math.floor(b / 3600000) - Math.floor(a / 3600000);
      case 'minute': return Math.floor(b / 60000) - Math.floor(a / 60000);
      case 'second': return Math.floor(b / 1000) - Math.floor(a / 1000);
      case 'millisecond': return b - a;
    }
    throw err(9810, 'Часть даты ' + part + ' не поддерживается функцией datediff.');
  }
  T.dateDiff = dateDiff;
  def('DATEDIFF,DATEDIFF_BIG', 2, 2, function (a, n, C) {
    var f = dateFn(a[0], C, dateKind(a[0])), g = dateFn(a[1], C, dateKind(a[1])), part = n.datepart;
    return { type: TY.int(), fn: function (ctx) { var x = f(ctx), y = g(ctx); if (x === null || y === null) return null; return dateDiff(part, x, y); } };
  });
  function dateTrunc(part, v, sett) {
    var p = T.dparts(v);
    switch (part) {
      case 'year': return T.mkDate(p.y, 1, 1);
      case 'quarter': return T.mkDate(p.y, Math.floor((p.m - 1) / 3) * 3 + 1, 1);
      case 'month': return T.mkDate(p.y, p.m, 1);
      case 'week': { var d0 = T.mkDate(p.y, p.m, p.d); return d0 - (weekdayNum(d0, sett.datefirst) - 1) * DAY; }
      case 'iso_week': { var d1 = T.mkDate(p.y, p.m, p.d); return d1 - ((new Date(d1).getUTCDay() + 6) % 7) * DAY; }
      case 'day': case 'dayofyear': return T.mkDate(p.y, p.m, p.d);
      case 'hour': return T.mkDate(p.y, p.m, p.d, p.hh);
      case 'minute': return T.mkDate(p.y, p.m, p.d, p.hh, p.mi);
      case 'second': return T.mkDate(p.y, p.m, p.d, p.hh, p.mi, p.ss);
      default: return v;
    }
  }
  def('DATETRUNC', 1, 1, function (a, n, C) {
    var rk = a[0].type.kind === 'date' ? 'date' : 'datetime';
    checkPartForDate(n.datepart, rk, 'datetrunc');
    var f = dateFn(a[0], C, rk), part = n.datepart, sess = C.session;
    return { type: rk === 'date' ? TY.date() : TY.datetime(), fn: function (ctx) { var v = f(ctx); return v === null ? null : dateTrunc(part, v, sess.settings); } };
  });
  def('EOMONTH', 1, 2, function (a, n, C) {
    var f = dateFn(a[0], C, 'date'), add = a[1] ? intFn(a[1]) : null;
    return {
      type: TY.date(), fn: function (ctx) {
        var v = f(ctx); if (v === null) return null;
        var k = add ? add(ctx) : 0; if (k === null) return null;
        var base = addMonths(T.mkDate(T.dparts(v).y, T.dparts(v).m, 1), k);
        var p = T.dparts(base);
        return T.mkDate(p.y, p.m, T.daysInMonth(p.y, p.m));
      }
    };
  });
  def('DATEFROMPARTS', 3, 3, function (a) {
    var y = intFn(a[0]), m = intFn(a[1]), d = intFn(a[2]);
    return {
      type: TY.date(), fn: function (ctx) {
        var yy = y(ctx), mm = m(ctx), dd = d(ctx);
        if (yy === null || mm === null || dd === null) return null;
        if (mm < 1 || mm > 12 || dd < 1 || dd > T.daysInMonth(yy, mm) || yy < 1 || yy > 9999) throw err(289, 'Не удается создать тип данных date: некоторые аргументы имеют недопустимые значения.');
        return T.mkDate(yy, mm, dd);
      }
    };
  });
  def('DATETIMEFROMPARTS', 7, 7, function (a) {
    var fs = a.map(intFn);
    return { type: TY.datetime(), fn: function (ctx) { var v = fs.map(function (f) { return f(ctx); }); if (v.some(function (x) { return x === null; })) return null; return T.mkDate(v[0], v[1], v[2], v[3], v[4], v[5], v[6]); } };
  });
  def('ISDATE', 1, 1, function (a, n, C) {
    var s = strFn(a[0]), sess = C.session;
    return { type: TY.int(), fn: function (ctx) { var v = s(ctx); if (v === null) return 0; try { T.parseDateStr(v, 'datetime', sess.settings); return 1; } catch (e) { return 0; } } };
  });
  def('ISNUMERIC', 1, 1, function (a) {
    var s = strFn(a[0]);
    return { type: TY.int(), fn: function (ctx) { var v = s(ctx); if (v === null) return 0; return /^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?\s*$/.test(v) || /^\s*[$€£¥]\s*\d/.test(v) ? 1 : 0; } };
  });

  /* ---------- FORMAT ---------- */
  var CULT = {
    'en-us': { grp: ',', dec: '.', cur: '$', curPos: 'pre', pctSp: '', months: T.names.MONTH_EN, monthsGen: T.names.MONTH_EN, mon: T.names.MON_EN, days: T.names.DAY_EN, dshort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], d: 'M/d/yyyy', D: 'dddd, MMMM d, yyyy', t: 'h:mm tt', am: 'AM', pm: 'PM' },
    'ru-ru': { grp: ' ', dec: ',', cur: '₽', curPos: 'post', pctSp: ' ', months: T.names.MONTH_RU, monthsGen: T.names.MONTH_RU_GEN, mon: T.names.MON_RU, days: T.names.DAY_RU, dshort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], d: 'dd.MM.yyyy', D: "d MMMM yyyy 'г.'", t: 'H:mm', am: '', pm: '' },
    'ky-kg': { grp: ' ', dec: ',', cur: 'сом', curPos: 'post', pctSp: ' ', months: T.names.MONTH_RU, monthsGen: T.names.MONTH_RU_GEN, mon: T.names.MON_RU, days: T.names.DAY_RU, dshort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], d: 'd.MM.yyyy', D: "d MMMM yyyy 'ж.'", t: 'H:mm', am: '', pm: '' }
  };
  CULT['de-de'] = { grp: '.', dec: ',', cur: '€', curPos: 'post', pctSp: ' ', months: T.names.MONTH_EN, monthsGen: T.names.MONTH_EN, mon: T.names.MON_EN, days: T.names.DAY_EN, dshort: CULT['en-us'].dshort, d: 'dd.MM.yyyy', D: 'dddd, d. MMMM yyyy', t: 'HH:mm', am: '', pm: '' };
  function groupDigits(intStr, sep) { return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, sep); }
  function fmtNumStd(v, letter, digits, c) {
    var L = letter.toUpperCase();
    var d = digits === '' ? null : parseInt(digits, 10);
    var neg = v < 0, a = Math.abs(v), s, ip, fp;
    switch (L) {
      case 'N': case 'F': case 'C': {
        var dd = d === null ? 2 : d;
        s = T.roundHalfAway(a, dd).toFixed(dd); ip = s.split('.')[0]; fp = s.split('.')[1];
        if (L !== 'F') ip = groupDigits(ip, c.grp);
        var body = ip + (fp ? c.dec + fp : '');
        if (L === 'C') body = c.curPos === 'pre' ? c.cur + body : body + ' ' + c.cur;
        return (neg && /[1-9]/.test(s) ? '-' : '') + body;
      }
      case 'P': {
        var dp = d === null ? 2 : d;
        s = T.roundHalfAway(a * 100, dp).toFixed(dp); ip = groupDigits(s.split('.')[0], c.grp); fp = s.split('.')[1];
        return (neg ? '-' : '') + ip + (fp ? c.dec + fp : '') + c.pctSp + '%';
      }
      case 'D': {
        if (!Number.isInteger(v)) return null;
        s = String(a); if (d !== null) while (s.length < d) s = '0' + s;
        return (neg ? '-' : '') + s;
      }
      case 'G': return String(v).replace('.', c.dec);
      case 'E': return v.toExponential(d === null ? 6 : d).toUpperCase().replace('.', c.dec);
    }
    return null;
  }
  function fmtNumCustom(v, pat, c) {
    // поддерживаем шаблоны вида: префикс #,##0.00 суффикс, 0.##, 00000, %
    var m = /^([^#0]*)([#0,]*)(?:\.([#0]*))?(.*)$/.exec(pat);
    if (!m || (!m[2] && !m[3])) return pat;
    var pre = m[1].replace(/['"]/g, ''), ipat = m[2], fpat = m[3] || '', suf = m[4].replace(/['"]/g, '');
    var pct = /%/.test(suf) || /%/.test(pre);
    var x = pct ? v * 100 : v;
    var minF = (fpat.match(/0/g) || []).length, maxF = fpat.length;
    var neg = x < 0; x = Math.abs(x);
    var s = T.roundHalfAway(x, maxF).toFixed(maxF);
    var ip = s.split('.')[0], fp = s.split('.')[1] || '';
    while (fp.length > minF && fp[fp.length - 1] === '0') fp = fp.slice(0, -1);
    var minI = (ipat.replace(/,/g, '').match(/0/g) || []).length;
    while (ip.length < minI) ip = '0' + ip;
    if (minI === 0 && ip === '0') ip = '';
    if (/,/.test(ipat)) ip = groupDigits(ip, c.grp);
    return (neg ? '-' : '') + pre + ip + (fp ? c.dec + fp : '') + suf;
  }
  function fmtDateCustom(v, pat, c) {
    var p = T.dparts(v);
    if (pat.length === 1) {
      if (pat === 'd') pat = c.d; else if (pat === 'D') pat = c.D; else if (pat === 't') pat = c.t;
      else if (pat === 'T') pat = 'HH:mm:ss'; else if (pat === 'g') pat = c.d + ' ' + c.t; else if (pat === 'G') pat = c.d + ' HH:mm:ss';
      else if (pat === 'M' || pat === 'm') pat = c === CULT['en-us'] ? 'MMMM d' : 'd MMMM';
      else if (pat === 'Y' || pat === 'y') pat = 'MMMM yyyy';
    }
    var hasDay = /(^|[^d])d{1,2}([^d]|$)/.test(pat.replace(/'[^']*'/g, ''));
    var out = '', i = 0;
    while (i < pat.length) {
      var ch = pat[i];
      if (ch === "'" || ch === '"') { var e = pat.indexOf(ch, i + 1); if (e < 0) e = pat.length; out += pat.slice(i + 1, e); i = e + 1; continue; }
      if (ch === '\\') { out += pat[i + 1] || ''; i += 2; continue; }
      var j = i; while (j < pat.length && pat[j] === ch) j++;
      var n = j - i;
      switch (ch) {
        case 'y': out += n <= 2 ? T.p2(p.y % 100) : String(p.y); break;
        case 'M': out += n >= 4 ? (hasDay ? c.monthsGen[p.m - 1] : c.months[p.m - 1]) : n === 3 ? c.mon[p.m - 1] : n === 2 ? T.p2(p.m) : String(p.m); break;
        case 'd': out += n >= 4 ? c.days[p.dow] : n === 3 ? c.dshort[p.dow] : n === 2 ? T.p2(p.d) : String(p.d); break;
        case 'H': out += n >= 2 ? T.p2(p.hh) : String(p.hh); break;
        case 'h': { var h = p.hh % 12 || 12; out += n >= 2 ? T.p2(h) : String(h); break; }
        case 'm': out += n >= 2 ? T.p2(p.mi) : String(p.mi); break;
        case 's': out += n >= 2 ? T.p2(p.ss) : String(p.ss); break;
        case 'f': out += String(p.ms + 1000).slice(1, 1 + Math.min(3, n)); break;
        case 't': out += p.hh < 12 ? c.am : c.pm; break;
        default: out += pat.slice(i, j);
      }
      i = j;
    }
    return out;
  }
  def('FORMAT', 2, 3, function (a, n, C) {
    var vf = a[0].fn, vt = a[0].type, pf = strFn(a[1]), cf = a[2] ? strFn(a[2]) : null, sess = C.session;
    if (vt.kind === 'str') throw err(8116, 'Тип данных аргумента ' + (vt.n ? 'nvarchar' : 'varchar') + ' недопустим для аргумента 1 функции format.');
    return {
      type: TY.str(4000, true), fn: function (ctx) {
        var v = vf(ctx), pat = pf(ctx);
        if (v === null || pat === null) return null;
        var cname = cf ? (cf(ctx) || '').toLowerCase() : (sess.settings.language === 'russian' ? 'ru-ru' : 'en-us');
        var c = CULT[cname];
        if (!c) return null;
        if (vt.kind === 'date' || vt.kind === 'datetime') return fmtDateCustom(v, pat, c);
        var std = /^([NnFfCcPpDdGgEe])(\d{0,2})$/.exec(pat);
        if (std) return fmtNumStd(v, std[1], std[2], c);
        return fmtNumCustom(v, pat, c);
      }
    };
  });
  T.formatDate = fmtDateCustom;

  /* ---------- Прочее ---------- */
  def('JSON_VALUE', 2, 2, function (a) {
    var j = strFn(a[0]), p = strFn(a[1]);
    return {
      type: TY.str(4000, true), fn: function (ctx) {
        var s = j(ctx), path = p(ctx); if (s === null || path === null) return null;
        try {
          var o = JSON.parse(s);
          var parts = path.replace(/^\$\.?/, '').split('.').filter(Boolean);
          for (var i = 0; i < parts.length; i++) { var m = /^(\w+)(?:\[(\d+)\])?$/.exec(parts[i]); if (!m || o == null) return null; o = o[m[1]]; if (m[2] != null) o = o == null ? null : o[+m[2]]; }
          if (o === null || o === undefined || typeof o === 'object') return null;
          return String(o);
        } catch (e) { return null; }
      }
    };
  });
})(typeof window !== 'undefined' ? window : globalThis);
