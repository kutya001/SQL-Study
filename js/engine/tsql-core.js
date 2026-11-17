/* ============================================================
   Учебный движок T-SQL (только чтение). Часть 1: ядро
   Типы данных, преобразования, ошибки, сравнение строк,
   работа с датами, токенизатор.
   ============================================================ */
(function (G) {
  'use strict';
  var T = G.TSQL = G.TSQL || {};

  /* ---------------- Ошибки в стиле SSMS ---------------- */
  function SqlError(num, msg, line, level) {
    this.name = 'SqlError';
    this.number = num;
    this.message = msg;
    this.line = line || null;
    this.level = level || 16;
    this.stack = (new Error(msg)).stack;
  }
  SqlError.prototype = Object.create(Error.prototype);
  SqlError.prototype.constructor = SqlError;
  T.SqlError = SqlError;
  function err(num, msg, line) { return new SqlError(num, msg, line); }
  T.err = err;

  /* ---------------- Типы ----------------
     kind: int | decimal | float | str | date | datetime | bit | null | guid
     decimal: p, s ; str: len (-1 = max), n (nvarchar) ; int: sub (tinyint/smallint/int/bigint)
  */
  var TY = {
    int: function (sub) { return { kind: 'int', sub: sub || 'int' }; },
    dec: function (p, s) { return { kind: 'decimal', p: p, s: s }; },
    float: function () { return { kind: 'float' }; },
    str: function (len, n) { return { kind: 'str', len: len == null ? 30 : len, n: !!n }; },
    date: function () { return { kind: 'date' }; },
    datetime: function () { return { kind: 'datetime' }; },
    bit: function () { return { kind: 'bit' }; },
    nul: function () { return { kind: 'null' }; },
    guid: function () { return { kind: 'guid' }; }
  };
  T.TY = TY;

  function typeName(t) {
    switch (t.kind) {
      case 'int': return t.sub || 'int';
      case 'decimal': return 'numeric';
      case 'float': return 'float';
      case 'str': return t.n ? 'nvarchar' : 'varchar';
      case 'date': return 'date';
      case 'datetime': return 'datetime';
      case 'bit': return 'bit';
      case 'guid': return 'uniqueidentifier';
      default: return 'int';
    }
  }
  T.typeName = typeName;
  function typeFull(t) {
    switch (t.kind) {
      case 'decimal': return 'decimal(' + t.p + ',' + t.s + ')';
      case 'str': return (t.n ? 'nvarchar' : 'varchar') + '(' + (t.len < 0 ? 'max' : t.len) + ')';
      default: return typeName(t);
    }
  }
  T.typeFull = typeFull;

  function intPrec(t) { var s = t.sub; return s === 'bigint' ? 19 : s === 'smallint' ? 5 : s === 'tinyint' ? 3 : 10; }
  function asDec(t) {
    if (t.kind === 'decimal') return t;
    if (t.kind === 'int') return TY.dec(intPrec(t), 0);
    if (t.kind === 'bit') return TY.dec(1, 0);
    return TY.dec(18, 0);
  }
  T.asDec = asDec;
  function capDec(p, s, mul) {
    if (p <= 38) return TY.dec(p, s);
    var ip = p - s;
    if (ip < 32) s = Math.min(s, 38 - ip);
    else s = s > 6 ? 6 : s;
    if (s < 0) s = 0;
    return TY.dec(38, s);
  }
  T.capDec = capDec;

  // Приоритет типов (выше = сильнее)
  var PREC = { 'null': 0, guid: 1, str: 2, bit: 3, int: 4, decimal: 5, float: 6, date: 7, datetime: 8 };
  function strongerType(a, b) {
    if (a.kind === 'null') return b;
    if (b.kind === 'null') return a;
    if (a.kind === 'str' && b.kind === 'str') {
      var n = a.n || b.n;
      var len = (a.len < 0 || b.len < 0) ? -1 : Math.max(a.len, b.len);
      return TY.str(len, n);
    }
    if (a.kind === 'int' && b.kind === 'int') {
      var order = ['tinyint', 'smallint', 'int', 'bigint'];
      return order.indexOf(a.sub) >= order.indexOf(b.sub) ? a : b;
    }
    if ((a.kind === 'decimal' || a.kind === 'int' || a.kind === 'bit') && (b.kind === 'decimal' || b.kind === 'int' || b.kind === 'bit') && (a.kind === 'decimal' || b.kind === 'decimal')) {
      var da = asDec(a), db = asDec(b);
      var s = Math.max(da.s, db.s);
      var ip = Math.max(da.p - da.s, db.p - db.s);
      return capDec(ip + s, s);
    }
    return PREC[a.kind] >= PREC[b.kind] ? a : b;
  }
  T.strongerType = strongerType;
  T.isNum = function (t) { return t.kind === 'int' || t.kind === 'decimal' || t.kind === 'float' || t.kind === 'bit'; };
  T.isDateT = function (t) { return t.kind === 'date' || t.kind === 'datetime'; };

  /* ---------------- Числа ---------------- */
  function roundHalfAway(x, s) {
    if (x === null) return null;
    if (s > 15) s = 15;
    var f = Math.pow(10, s);
    var v = Math.abs(x) * f;
    if (v > 9e15) return x;               // за пределами точности double — не трогаем
    v = parseFloat(v.toPrecision(15));    // убираем «хвосты» вида 267.49999999999997
    var r = Math.round(v);
    return (x < 0 ? -r : r) / f;
  }
  T.roundHalfAway = roundHalfAway;
  function truncTo(x, s) { var f = Math.pow(10, s); return (x < 0 ? -Math.floor(-x * f + 1e-9) : Math.floor(x * f + 1e-9)) / f; }
  T.truncTo = truncTo;

  function fmtDec(v, s) {
    var r = roundHalfAway(v, s);
    var ip = Math.floor(Math.abs(r)), idig = ip === 0 ? 1 : String(ip).length;
    var d = Math.max(0, Math.min(s, 15 - idig));
    var str = Math.abs(r).toFixed(d);
    if (d < s) str += (d === 0 ? '.' : '') + new Array(s - d + 1).join('0');
    if (r < 0 && /[1-9]/.test(str)) str = '-' + str;
    return str;
  }
  function fmtFloat(v) {
    if (!isFinite(v)) return String(v);
    if (Number.isInteger(v) && Math.abs(v) < 1e15) return String(v);
    var s = String(parseFloat(v.toPrecision(15)));
    if (s.indexOf('e') >= 0) {
      s = s.replace('e+', 'E+').replace('e-', 'E-');
    }
    return s;
  }

  /* ---------------- Даты ----------------
     Значения date/datetime храним как миллисекунды от 1970-01-01 UTC.
  */
  var DAY = 86400000;
  function mkDate(y, m, d, hh, mi, ss, ms) { return Date.UTC(y, m - 1, d, hh || 0, mi || 0, ss || 0, ms || 0); }
  T.mkDate = mkDate;
  function dparts(v) {
    var d = new Date(v);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), hh: d.getUTCHours(), mi: d.getUTCMinutes(), ss: d.getUTCSeconds(), ms: d.getUTCMilliseconds(), dow: d.getUTCDay() };
  }
  T.dparts = dparts;
  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  T.daysInMonth = daysInMonth;
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function p3(n) { return (n < 10 ? '00' : n < 100 ? '0' : '') + n; }
  function p4(n) { var s = String(n); while (s.length < 4) s = '0' + s; return s; }
  T.p2 = p2;

  var MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTH_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAY_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTH_RU = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
  var MONTH_RU_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var DAY_RU = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  var MON_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  T.names = { MON_EN: MON_EN, MONTH_EN: MONTH_EN, DAY_EN: DAY_EN, MONTH_RU: MONTH_RU, MONTH_RU_GEN: MONTH_RU_GEN, DAY_RU: DAY_RU, MON_RU: MON_RU };

  function fmtDate(v) { var p = dparts(v); return p4(p.y) + '-' + p2(p.m) + '-' + p2(p.d); }
  function fmtDateTime(v) { var p = dparts(v); return p4(p.y) + '-' + p2(p.m) + '-' + p2(p.d) + ' ' + p2(p.hh) + ':' + p2(p.mi) + ':' + p2(p.ss) + '.' + p3(p.ms); }
  T.fmtDate = fmtDate; T.fmtDateTime = fmtDateTime;
  function style0(v) {
    var p = dparts(v);
    var h = p.hh % 12; if (h === 0) h = 12;
    var dd = String(p.d); if (dd.length < 2) dd = ' ' + dd;
    var hs = String(h); if (hs.length < 2) hs = ' ' + hs;
    return MON_EN[p.m - 1] + ' ' + dd + ' ' + p.y + ' ' + hs + ':' + p2(p.mi) + (p.hh < 12 ? 'AM' : 'PM');
  }

  // Преобразование даты в строку по стилю CONVERT
  function dateToStyle(v, kind, style) {
    var p = dparts(v), y = p4(p.y), yy = p2(p.y % 100), m = p2(p.m), d = p2(p.d);
    var time = p2(p.hh) + ':' + p2(p.mi) + ':' + p2(p.ss);
    if (style == null) style = kind === 'date' ? 23 : 0;
    switch (style) {
      case 0: case 100: return kind === 'date' ? MON_EN[p.m - 1] + ' ' + (p.d < 10 ? ' ' : '') + p.d + ' ' + p.y : style0(v);
      case 1: return m + '/' + d + '/' + yy;
      case 101: return m + '/' + d + '/' + y;
      case 2: return yy + '.' + m + '.' + d;
      case 102: return y + '.' + m + '.' + d;
      case 3: return d + '/' + m + '/' + yy;
      case 103: return d + '/' + m + '/' + y;
      case 4: return d + '.' + m + '.' + yy;
      case 104: return d + '.' + m + '.' + y;
      case 5: return d + '-' + m + '-' + yy;
      case 105: return d + '-' + m + '-' + y;
      case 6: return d + ' ' + MON_EN[p.m - 1] + ' ' + yy;
      case 106: return d + ' ' + MON_EN[p.m - 1] + ' ' + y;
      case 108: case 8: return time;
      case 10: return m + '-' + d + '-' + yy;
      case 110: return m + '-' + d + '-' + y;
      case 11: return yy + '/' + m + '/' + d;
      case 111: return y + '/' + m + '/' + d;
      case 12: return yy + m + d;
      case 112: return y + m + d;
      case 20: case 120: return kind === 'date' ? y + '-' + m + '-' + d : y + '-' + m + '-' + d + ' ' + time;
      case 21: case 121: case 25: return kind === 'date' ? y + '-' + m + '-' + d : y + '-' + m + '-' + d + ' ' + time + '.' + p3(p.ms);
      case 23: return y + '-' + m + '-' + d;
      case 126: return kind === 'date' ? y + '-' + m + '-' + d : y + '-' + m + '-' + d + 'T' + time + (p.ms ? '.' + p3(p.ms) : '');
      default: throw err(281, '' + style + ' не является допустимым номером стиля при преобразовании из ' + kind + ' в строку символов.');
    }
  }
  T.dateToStyle = dateToStyle;

  // Разбор строки в дату. settings.dateformat: mdy | dmy | ymd ...
  function validYMD(y, m, d) { return m >= 1 && m <= 12 && d >= 1 && y >= 1753 && y <= 9999 && d <= daysInMonth(y, m); }
  function parseDateStr(s, kind, settings, style) {
    var str = String(s).trim();
    var fmt = (settings && settings.dateformat) || 'mdy';
    var tm = 0, mt, y, m, d;
    var timePart = function (t) {
      if (!t) return 0;
      var mm = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,7}))?)?\s*(AM|PM)?$/i.exec(t.trim());
      if (!mm) return null;
      var hh = +mm[1], mi = +mm[2], ss = +(mm[3] || 0), ms = mm[4] ? Math.round(+('0.' + mm[4]) * 1000) : 0;
      if (mm[5]) { var pm = mm[5].toUpperCase() === 'PM'; if (hh === 12) hh = pm ? 12 : 0; else if (pm) hh += 12; }
      if (hh > 23 || mi > 59 || ss > 59) return null;
      return ((hh * 60 + mi) * 60 + ss) * 1000 + ms;
    };
    var bad = function () { return err(241, 'Ошибка преобразования даты или времени из символьной строки.'); };
    var range = function () { return err(242, 'Преобразование типа данных varchar в тип данных ' + kind + ' привело к выходу значения за пределы диапазона.'); };
    if (str === '') return mkDate(1900, 1, 1);
    // yyyymmdd [time]
    if ((mt = /^(\d{4})(\d{2})(\d{2})(?:\s+(.+))?$/.exec(str))) {
      y = +mt[1]; m = +mt[2]; d = +mt[3]; tm = timePart(mt[4]);
      if (tm === null) throw bad();
      if (!validYMD(y, m, d)) throw range();
      return mkDate(y, m, d) + (kind === 'date' ? 0 : tm);
    }
    // ISO 8601 yyyy-mm-ddThh:mm:ss
    if ((mt = /^(\d{4})-(\d{2})-(\d{2})T(.+)$/.exec(str))) {
      y = +mt[1]; m = +mt[2]; d = +mt[3]; tm = timePart(mt[4]);
      if (tm === null) throw bad();
      if (!validYMD(y, m, d)) throw range();
      return mkDate(y, m, d) + (kind === 'date' ? 0 : tm);
    }
    // стиль явно задан через CONVERT
    if (style != null) {
      var sm;
      if ((style === 104 || style === 103 || style === 105) && (sm = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:\s+(.+))?$/.exec(str))) {
        d = +sm[1]; m = +sm[2]; y = +sm[3]; tm = timePart(sm[4]);
        if (tm === null) throw bad(); if (!validYMD(y, m, d)) throw range();
        return mkDate(y, m, d) + (kind === 'date' ? 0 : tm);
      }
      if ((style === 101 || style === 110) && (sm = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.exec(str))) {
        m = +sm[1]; d = +sm[2]; y = +sm[3];
        if (!validYMD(y, m, d)) throw range();
        return mkDate(y, m, d);
      }
      if ((style === 120 || style === 121 || style === 23 || style === 102 || style === 111) && (sm = /^(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})(?:\s+(.+))?$/.exec(str))) {
        y = +sm[1]; m = +sm[2]; d = +sm[3]; tm = timePart(sm[4]);
        if (tm === null) throw bad(); if (!validYMD(y, m, d)) throw range();
        return mkDate(y, m, d) + (kind === 'date' ? 0 : tm);
      }
    }
    // yyyy-mm-dd [time]  — для DATE всегда ymd, для DATETIME зависит от DATEFORMAT
    if ((mt = /^(\d{4})[-.\/](\d{1,2})[-.\/](\d{1,2})(?:\s+(.+))?$/.exec(str))) {
      y = +mt[1]; var a = +mt[2], b = +mt[3];
      if (kind === 'datetime' && (fmt === 'dmy' || fmt === 'ydm')) { d = a; m = b; } else { m = a; d = b; }
      tm = timePart(mt[4]); if (tm === null) throw bad();
      if (!validYMD(y, m, d)) throw range();
      return mkDate(y, m, d) + (kind === 'date' ? 0 : tm);
    }
    // nn.nn.yyyy / nn/nn/yyyy / nn-nn-yyyy — по DATEFORMAT
    if ((mt = /^(\d{1,2})[-.\/](\d{1,2})[-.\/](\d{2}|\d{4})(?:\s+(.+))?$/.exec(str))) {
      var x1 = +mt[1], x2 = +mt[2]; y = +mt[3]; if (mt[3].length === 2) y += y < 50 ? 2000 : 1900;
      if (fmt === 'dmy' || fmt === 'dym') { d = x1; m = x2; } else { m = x1; d = x2; }
      tm = timePart(mt[4]); if (tm === null) throw bad();
      if (!validYMD(y, m, d)) throw range();
      return mkDate(y, m, d) + (kind === 'date' ? 0 : tm);
    }
    // Mon dd yyyy [time]
    if ((mt = /^([A-Za-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})(?:\s+(.+))?$/.exec(str))) {
      m = MON_EN.map(function (x) { return x.toLowerCase(); }).indexOf(mt[1].toLowerCase()) + 1;
      if (!m) throw bad();
      d = +mt[2]; y = +mt[3]; tm = timePart(mt[4]); if (tm === null) throw bad();
      if (!validYMD(y, m, d)) throw range();
      return mkDate(y, m, d) + (kind === 'date' ? 0 : tm);
    }
    // только время
    if ((tm = timePart(str)) !== null && /:/.test(str)) return mkDate(1900, 1, 1) + (kind === 'date' ? 0 : tm);
    throw bad();
  }
  T.parseDateStr = parseDateStr;

  /* ---------------- Сравнение строк (Cyrillic_General_CI_AS) ---------------- */
  // Порядок как в SQL Server: знаки, цифры, латиница, затем кириллица. Локаль 'ru' ставит кириллицу
  // впереди латиницы, поэтому берём порядок без перестановки алфавитов (в нём русские буквы идут так же).
  var collator = null;
  if (typeof Intl !== 'undefined') {
    ['en', 'ru'].some(function (loc) {
      try { var c = new Intl.Collator(loc, { sensitivity: 'accent' }); if (!collator || c.compare('z', 'а') < 0) collator = c; return c.compare('z', 'а') < 0; }
      catch (e) { return false; }
    });
  }
  function rtrim(s) { return s.replace(/ +$/, ''); }
  function lowerKey(s) { return rtrim(s).toLowerCase(); }
  T.lowerKey = lowerKey;
  function cmpStr(a, b) {
    a = rtrim(a); b = rtrim(b);
    if (a.toLowerCase() === b.toLowerCase()) return 0;
    if (collator) { var c = collator.compare(a, b); if (c !== 0) return c < 0 ? -1 : 1; }
    var la = a.toLowerCase(), lb = b.toLowerCase();
    return la < lb ? -1 : la > lb ? 1 : 0;
  }
  T.cmpStr = cmpStr;
  // сравнение двух значений одного типа (null не допускается)
  function cmpVal(a, b, kind) {
    if (kind === 'str' || kind === 'guid') return cmpStr(String(a), String(b));
    return a < b ? -1 : a > b ? 1 : 0;
  }
  T.cmpVal = cmpVal;
  // ключ для группировки / DISTINCT / хеш-соединения
  function keyOf(v, kind) {
    if (v === null || v === undefined) return '\u0000N';
    if (kind === 'str' || kind === 'guid') return 's' + lowerKey(String(v));
    if (typeof v === 'number') return 'n' + (Object.is(v, -0) ? 0 : v);
    return 'x' + String(v);
  }
  T.keyOf = keyOf;

  /* ---------------- Отображение значений ---------------- */
  function display(v, t) {
    if (v === null || v === undefined) return null;
    switch (t.kind) {
      case 'int': return String(v);
      case 'bit': return v ? '1' : '0';
      case 'decimal': return fmtDec(v, t.s);
      case 'float': return fmtFloat(v);
      case 'date': return fmtDate(v);
      case 'datetime': return fmtDateTime(v);
      default: return String(v);
    }
  }
  T.display = display;

  /* ---------------- Преобразования ---------------- */
  function srcName(t) { return t.kind === 'str' ? (t.n ? 'nvarchar' : 'varchar') : typeName(t); }
  function convert(v, from, to, opts) {
    // opts: {style, settings, tryMode}
    if (v === null || v === undefined) return null;
    opts = opts || {};
    var fk = from.kind, tk = to.kind;
    try {
      switch (tk) {
        case 'str': {
          var s;
          if (fk === 'str' || fk === 'guid') s = String(v);
          else if (fk === 'int') s = String(v);
          else if (fk === 'bit') s = v ? '1' : '0';
          else if (fk === 'decimal') s = fmtDec(v, from.s);
          else if (fk === 'float') {
            if (opts.style == null) { s = String(parseFloat(v.toPrecision(6))); if (/e/.test(s)) s = v.toExponential(5).replace(/\.?0+e/, 'e').replace(/e([+-])(\d)$/, 'e$100$2').replace(/e([+-])(\d\d)$/, 'e$10$2'); }
            else s = fmtFloat(v);
          }
          else if (fk === 'date' || fk === 'datetime') s = dateToStyle(v, fk, opts.style == null ? null : opts.style);
          else s = String(v);
          if (to.len >= 0 && s.length > to.len) {
            if (fk === 'int' || fk === 'decimal' || fk === 'float') {
              if (fk === 'int') throw err(8115, 'Ошибка арифметического переполнения при преобразовании выражения к типу данных ' + typeName(to) + '.');
              return '*';
            }
            s = s.substr(0, to.len);
          }
          return s;
        }
        case 'int': {
          var n;
          if (fk === 'str') {
            var st = String(v).trim();
            if (st === '') n = 0;
            else if (!/^[+-]?\d+$/.test(st)) throw err(245, 'Ошибка при преобразовании значения ' + srcName(from) + ' "' + v + '" в тип данных ' + (to.sub || 'int') + '.');
            else n = parseInt(st, 10);
          } else if (fk === 'decimal' || fk === 'float') n = Math.trunc(v);
          else if (fk === 'date' || fk === 'datetime') {
            if (fk === 'date') throw err(529, 'Явное преобразование из типа данных date в ' + (to.sub || 'int') + ' не разрешено.');
            n = Math.round((v - mkDate(1900, 1, 1)) / DAY);
          }
          else n = Number(v);
          var lim = to.sub === 'bigint' ? 9.2e18 : to.sub === 'smallint' ? 32767 : to.sub === 'tinyint' ? 255 : 2147483647;
          if (n > lim || n < (to.sub === 'tinyint' ? 0 : -lim - 1)) throw err(8115, 'Ошибка арифметического переполнения при преобразовании выражения к типу данных ' + (to.sub || 'int') + '.');
          return n;
        }
        case 'decimal': {
          var x;
          if (fk === 'str') {
            var t2 = String(v).trim();
            if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(t2)) throw err(8114, 'Ошибка при преобразовании типа данных ' + srcName(from) + ' к numeric.');
            x = parseFloat(t2);
          } else if (fk === 'date' || fk === 'datetime') throw err(529, 'Явное преобразование из типа данных ' + fk + ' в numeric не разрешено.');
          else x = Number(v);
          var r = roundHalfAway(x, to.s);
          var intDigits = Math.floor(Math.abs(r)) === 0 ? 0 : String(Math.floor(Math.abs(r))).length;
          if (intDigits > to.p - to.s) throw err(8115, 'Ошибка арифметического переполнения при преобразовании ' + srcName(from) + ' к типу данных numeric.');
          return r;
        }
        case 'float': {
          if (fk === 'str') {
            var t3 = String(v).trim();
            if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t3)) throw err(8114, 'Ошибка при преобразовании типа данных ' + srcName(from) + ' к float.');
            return parseFloat(t3);
          }
          if (fk === 'date') throw err(529, 'Явное преобразование из типа данных date в float не разрешено.');
          if (fk === 'datetime') return (v - mkDate(1900, 1, 1)) / DAY;
          return Number(v);
        }
        case 'bit': {
          if (fk === 'str') {
            var t4 = String(v).trim().toLowerCase();
            if (t4 === 'true') return 1; if (t4 === 'false') return 0;
            if (!/^[+-]?\d+(\.\d+)?$/.test(t4)) throw err(245, 'Ошибка при преобразовании значения ' + srcName(from) + ' "' + v + '" в тип данных bit.');
            return parseFloat(t4) !== 0 ? 1 : 0;
          }
          return Number(v) !== 0 ? 1 : 0;
        }
        case 'date': case 'datetime': {
          if (fk === 'str') return parseDateStr(v, tk, opts.settings, opts.style);
          if (fk === 'date' || fk === 'datetime') {
            if (tk === 'date') return Math.floor(v / DAY) * DAY;
            return v;
          }
          if (fk === 'int' || fk === 'decimal' || fk === 'float') {
            if (tk === 'date') throw err(529, 'Явное преобразование из типа данных ' + typeName(from) + ' в date не разрешено.');
            return mkDate(1900, 1, 1) + Math.round(Number(v) * DAY);
          }
          throw err(529, 'Явное преобразование не разрешено.');
        }
        case 'guid': return String(v);
        default: return v;
      }
    } catch (e) {
      if (opts.tryMode && e instanceof SqlError && e.number !== 529) return null;
      throw e;
    }
  }
  T.convert = convert;

  // Допустимо ли неявное преобразование
  function implicitOk(from, to) {
    var f = from.kind, t = to.kind;
    if (f === 'null' || f === t) return true;
    if (f === 'date' && (t === 'int' || t === 'decimal' || t === 'float' || t === 'bit')) return false;
    if (t === 'date' && (f === 'int' || f === 'decimal' || f === 'float' || f === 'bit')) return false;
    if (f === 'datetime' && (t === 'int' || t === 'decimal' || t === 'bit')) return false;
    return true;
  }
  T.implicitOk = implicitOk;

  /* ---------------- Токенизатор ---------------- */
  var KEYWORDS = ('ADD ALL ALTER AND ANY AS ASC BACKUP BEGIN BETWEEN BREAK BROWSE BULK BY CASCADE CASE CHECK CHECKPOINT CLOSE CLUSTERED COALESCE COLLATE COLUMN COMMIT COMPUTE CONSTRAINT CONTAINS CONTINUE CONVERT CREATE CROSS CURRENT CURRENT_DATE CURRENT_TIME CURRENT_TIMESTAMP CURRENT_USER CURSOR DATABASE DEALLOCATE DECLARE DEFAULT DELETE DENY DESC DISTINCT DISTRIBUTED DOUBLE DROP ELSE END ERRLVL ESCAPE EXCEPT EXEC EXECUTE EXISTS EXIT EXTERNAL FETCH FILE FILLFACTOR FOR FOREIGN FREETEXT FROM FULL FUNCTION GOTO GRANT GROUP HAVING HOLDLOCK IDENTITY IF IN INDEX INNER INSERT INTERSECT INTO IS JOIN KEY KILL LEFT LIKE LINENO MERGE NATIONAL NOCHECK NONCLUSTERED NOT NULL NULLIF OF OFF OFFSETS ON OPEN OPTION OR ORDER OUTER OVER PERCENT PIVOT PLAN PRIMARY PRINT PROC PROCEDURE PUBLIC RAISERROR READ RECONFIGURE REFERENCES REPLICATION RESTORE RESTRICT RETURN REVERT REVOKE RIGHT ROLLBACK ROWCOUNT RULE SAVE SCHEMA SELECT SESSION_USER SET SETUSER SHUTDOWN SOME STATISTICS SYSTEM_USER TABLE TABLESAMPLE THEN TO TOP TRAN TRANSACTION TRIGGER TRUNCATE UNION UNIQUE UNPIVOT UPDATE USE USER VALUES VARYING VIEW WAITFOR WHEN WHERE WHILE WITH WITHIN').split(' ');
  var KW = {}; KEYWORDS.forEach(function (k) { KW[k] = 1; });
  T.KW = KW;

  function tokenize(src) {
    var toks = [], i = 0, n = src.length, line = 1, c;
    function push(type, value, extra) { var t = { type: type, value: value, line: line, pos: i }; if (extra) for (var k in extra) t[k] = extra[k]; toks.push(t); return t; }
    while (i < n) {
      c = src[i];
      if (c === '\n') { line++; i++; continue; }
      if (c === ' ' || c === '\t' || c === '\r' || c === ' ') { i++; continue; }
      if (c === '-' && src[i + 1] === '-') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') {
        var depth = 1; i += 2;
        while (i < n && depth > 0) {
          if (src[i] === '/' && src[i + 1] === '*') { depth++; i += 2; continue; }
          if (src[i] === '*' && src[i + 1] === '/') { depth--; i += 2; continue; }
          if (src[i] === '\n') line++;
          i++;
        }
        if (depth > 0) throw err(113, 'Отсутствует закрывающий знак комментария "*/".', line);
        continue;
      }
      var startLine = line, start = i;
      // строки N'...' и '...'
      if (c === "'" || ((c === 'N' || c === 'n') && src[i + 1] === "'")) {
        var nstr = c !== "'"; i += nstr ? 2 : 1;
        var s = '';
        while (true) {
          if (i >= n) throw err(105, 'Незакрытые кавычки после символьной строки "' + s.slice(0, 40) + '".', startLine);
          if (src[i] === "'") { if (src[i + 1] === "'") { s += "'"; i += 2; continue; } i++; break; }
          if (src[i] === '\n') line++;
          s += src[i++];
        }
        toks.push({ type: 'str', value: s, n: nstr, line: startLine, pos: start });
        continue;
      }
      // идентификатор в [квадратных скобках]
      if (c === '[') {
        var e = src.indexOf(']', i + 1);
        if (e < 0) throw err(105, 'Незакрытые кавычки перед строкой символов "' + src.slice(i, i + 30) + '".', line);
        toks.push({ type: 'id', value: src.slice(i + 1, e), quoted: true, line: line, pos: start });
        i = e + 1; continue;
      }
      if (c === '"') {
        var e2 = src.indexOf('"', i + 1);
        if (e2 < 0) throw err(105, 'Незакрытые кавычки после символьной строки "' + src.slice(i, i + 30) + '".', line);
        toks.push({ type: 'id', value: src.slice(i + 1, e2), quoted: true, line: line, pos: start });
        i = e2 + 1; continue;
      }
      // числа
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        var m = /^(\d*\.?\d*)([eE][+-]?\d+)?/.exec(src.slice(i));
        var txt = m[0]; i += txt.length;
        if (m[2]) toks.push({ type: 'num', value: parseFloat(txt), kind: 'float', text: txt, line: line, pos: start });
        else if (txt.indexOf('.') >= 0) {
          var parts = txt.split('.');
          var ip = parts[0].replace(/^0+/, ''), fp = parts[1] || '';
          toks.push({ type: 'num', value: parseFloat(txt), kind: 'decimal', p: Math.max(1, ip.length + fp.length), s: fp.length, text: txt, line: line, pos: start });
        } else {
          var v = parseInt(txt, 10);
          if (v > 2147483647) toks.push({ type: 'num', value: v, kind: v > 9.22e18 ? 'decimal' : 'decimal', p: txt.replace(/^0+/, '').length, s: 0, text: txt, line: line, pos: start });
          else toks.push({ type: 'num', value: v, kind: 'int', text: txt, line: line, pos: start });
        }
        continue;
      }
      // слова, @переменные, #временные таблицы
      if (/[A-Za-z_@#Ѐ-ӿ]/.test(c)) {
        var j = i + 1;
        while (j < n && /[A-Za-z0-9_@#$Ѐ-ӿ]/.test(src[j])) j++;
        var w = src.slice(i, j); i = j;
        if (w[0] === '@') {
          if (w[1] === '@') toks.push({ type: 'sysvar', value: w.toUpperCase(), line: line, pos: start });
          else toks.push({ type: 'var', value: w, line: line, pos: start });
        } else if (KW[w.toUpperCase()] && w[0] !== '#') toks.push({ type: 'kw', value: w.toUpperCase(), raw: w, line: line, pos: start });
        else toks.push({ type: 'id', value: w, line: line, pos: start });
        continue;
      }
      // операторы
      var two = src.substr(i, 2);
      if (['<>', '!=', '<=', '>=', '!<', '!>', '||', '+=', '-=', '*=', '/='].indexOf(two) >= 0) {
        if (two === '||') throw err(102, 'Неправильный синтаксис около конструкции "|".', line);
        toks.push({ type: 'op', value: two, line: line, pos: start }); i += 2; continue;
      }
      if ('+-*/%=<>(),.;~&|^:'.indexOf(c) >= 0) { toks.push({ type: 'op', value: c, line: line, pos: start }); i++; continue; }
      throw err(102, 'Неправильный синтаксис около конструкции "' + c + '".', line);
    }
    toks.push({ type: 'eof', value: '', line: line, pos: n });
    return toks;
  }
  T.tokenize = tokenize;

  /* ---------------- Утилиты ---------------- */
  T.levenshtein = function (a, b) {
    a = a.toLowerCase(); b = b.toLowerCase();
    var m = a.length, n = b.length, d = [], i, j;
    for (i = 0; i <= m; i++) { d[i] = [i]; }
    for (j = 0; j <= n; j++) d[0][j] = j;
    for (i = 1; i <= m; i++) for (j = 1; j <= n; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[m][n];
  };
  T.likeToRegex = function (pattern, escape) {
    var re = '^', i = 0, p = pattern;
    while (i < p.length) {
      var ch = p[i];
      if (escape && ch === escape && i + 1 < p.length) { re += p[i + 1].replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&'); i += 2; continue; }
      if (ch === '%') re += '[\\s\\S]*';
      else if (ch === '_') re += '[\\s\\S]';
      else if (ch === '[') {
        var e = p.indexOf(']', i + 1);
        if (e < 0) { re += '\\['; }
        else {
          var body = p.slice(i + 1, e), neg = false;
          if (body[0] === '^') { neg = true; body = body.slice(1); }
          body = body.replace(/[\\\]]/g, '\\$&');
          re += '[' + (neg ? '^' : '') + body + ']';
          i = e;
        }
      }
      else re += ch.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
      i++;
    }
    return new RegExp(re + '$', 'i');
  };
})(typeof window !== 'undefined' ? window : globalThis);
