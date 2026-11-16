/* ============================================================
   Учебный движок T-SQL. Часть 2: синтаксический анализатор
   ============================================================ */
(function (G) {
  'use strict';
  var T = G.TSQL;
  var err = T.err, TY = T.TY;

  var FORBIDDEN = { INSERT: 1, UPDATE: 1, DELETE: 1, MERGE: 1, CREATE: 1, ALTER: 1, TRUNCATE: 1, EXEC: 1, EXECUTE: 1, GRANT: 1, REVOKE: 1, DENY: 1, BACKUP: 1, RESTORE: 1, BEGIN: 1, COMMIT: 1, ROLLBACK: 1, TRAN: 1, TRANSACTION: 1, WHILE: 1, IF: 1, PRINT: 1, RAISERROR: 1 };
  var DATEPARTS = {
    year: 'year', yy: 'year', yyyy: 'year', quarter: 'quarter', qq: 'quarter', q: 'quarter',
    month: 'month', mm: 'month', m: 'month', dayofyear: 'dayofyear', dy: 'dayofyear', y: 'dayofyear',
    day: 'day', dd: 'day', d: 'day', week: 'week', wk: 'week', ww: 'week', weekday: 'weekday', dw: 'weekday', w: 'weekday',
    hour: 'hour', hh: 'hour', minute: 'minute', mi: 'minute', n: 'minute', second: 'second', ss: 'second', s: 'second',
    millisecond: 'millisecond', ms: 'millisecond', iso_week: 'iso_week', isowk: 'iso_week', isoww: 'iso_week'
  };
  T.DATEPARTS = DATEPARTS;
  var DATEPART_FUNCS = { DATEADD: 1, DATEDIFF: 1, DATEDIFF_BIG: 1, DATEPART: 1, DATENAME: 1, DATETRUNC: 1 };

  function Parser(src) {
    this.src = src;
    this.toks = T.tokenize(src);
    this.i = 0;
  }
  var P = Parser.prototype;
  P.peek = function (k) { return this.toks[this.i + (k || 0)]; };
  P.next = function () { return this.toks[this.i++]; };
  P.isKw = function (kw, k) { var t = this.peek(k); return t.type === 'kw' && t.value === kw; };
  P.isOp = function (op, k) { var t = this.peek(k); return t.type === 'op' && t.value === op; };
  P.isWord = function (w, k) { var t = this.peek(k); return (t.type === 'id' && !t.quoted && t.value.toUpperCase() === w) || (t.type === 'kw' && t.value === w); };
  P.acceptKw = function (kw) { if (this.isKw(kw)) { this.i++; return true; } return false; };
  P.acceptOp = function (op) { if (this.isOp(op)) { this.i++; return true; } return false; };
  P.acceptWord = function (w) { if (this.isWord(w)) { this.i++; return true; } return false; };
  P.fail = function (t) {
    t = t || this.peek();
    if (t.type === 'eof') return err(102, 'Неправильный синтаксис около конструкции "' + (this.toks[this.i - 1] ? (this.toks[this.i - 1].raw || this.toks[this.i - 1].value) : '') + '". Запрос оборвался — возможно, не хватает части выражения или закрывающей скобки.', t.line);
    var prevT = this.toks[this.toks.indexOf(t) - 1];
    if ((t.type === 'kw' || (t.type === 'id' && !t.quoted)) && /^(UN)?PIVOT$/i.test(t.value) && !(prevT && prevT.type === 'kw' && prevT.value === 'AS')) {
      var pe = err(50000, 'Оператор ' + t.value.toUpperCase() + ' в учебном движке не поддерживается. Сводную таблицу постройте условной агрегацией: SUM(CASE WHEN ... THEN ... END) — см. модуль 8.', t.line);
      pe.hintText = 'Пример: SELECT City, SUM(CASE WHEN Gender = N\'М\' THEN 1 ELSE 0 END) AS Men, ... FROM Clients GROUP BY City';
      return pe;
    }
    if (t.type === 'kw') return err(156, 'Неправильный синтаксис около ключевого слова "' + t.value + '".', t.line);
    var v = t.type === 'str' ? t.value : t.value;
    return err(102, 'Неправильный синтаксис около конструкции "' + v + '".', t.line);
  };
  P.expectKw = function (kw) { if (!this.acceptKw(kw)) throw this.fail(); };
  P.expectOp = function (op) { if (!this.acceptOp(op)) throw this.fail(); };
  P.expectWord = function (w) { if (!this.acceptWord(w)) throw this.fail(); };
  P.ident = function () {
    var t = this.peek();
    if (t.type === 'id') { this.i++; return t; }
    throw this.fail();
  };

  /* -------- Пакет инструкций -------- */
  P.parseBatch = function () {
    var stmts = [];
    var terminated = true;
    while (true) {
      while (this.acceptOp(';') || this.acceptWord('GO')) { terminated = true; }
      if (this.peek().type === 'eof') break;
      if (!terminated && this.isKw('WITH')) {
        var wt = this.peek();
        var we = err(319, 'Неправильный синтаксис около ключевого слова "with". Если эта инструкция является обобщенным табличным выражением, предыдущая инструкция должна заканчиваться точкой с запятой.', wt.line);
        we.hintText = 'Поставьте точку с запятой в конце предыдущей инструкции (перед WITH): ...; WITH cte AS (...)';
        throw we;
      }
      var st = this.parseStatement();
      terminated = false;
      stmts.push(st);
      if (!this.isOp(';') && !this.isWord('GO') && this.peek().type !== 'eof') {
        var t = this.peek();
        // следующая инструкция без точки с запятой допустима, если она начинается с ключевого слова
        if (!(t.type === 'kw' && (t.value === 'SELECT' || t.value === 'WITH' || t.value === 'DECLARE' || t.value === 'SET' || t.value === 'DROP' || t.value === 'USE' || FORBIDDEN[t.value]))) throw this.fail(t);
      }
    }
    return stmts;
  };

  P.parseStatement = function () {
    var t = this.peek();
    var line = t.line;
    if (t.type === 'kw' && FORBIDDEN[t.value]) {
      var e = err(50000, 'Команда ' + t.value + ' недоступна. Этот курс — только про чтение данных: используйте SELECT. Аналитику для отчётов не нужно изменять данные или объекты базы.', t.line);
      e.forbidden = true; throw e;
    }
    if (t.type === 'kw' && t.value === 'USE') {
      this.i++;
      var dbt = this.next();
      if (dbt.type !== 'id') throw this.fail(dbt);
      return { type: 'use', name: dbt.value, line: line };
    }
    if (t.type === 'kw' && t.value === 'DECLARE') return this.parseDeclare();
    if (t.type === 'kw' && t.value === 'SET') return this.parseSet();
    if (t.type === 'kw' && t.value === 'DROP') return this.parseDrop();
    if (t.type === 'kw' && (t.value === 'SELECT' || t.value === 'WITH') || (t.type === 'op' && t.value === '(')) {
      var q = this.parseQuery(true);
      var st = { type: 'select', query: q, line: line };
      if (this.acceptKw('OPTION')) {
        this.expectOp('(');
        do {
          if (this.acceptWord('MAXRECURSION')) { var n = this.next(); if (n.type !== 'num') throw this.fail(n); st.maxrecursion = n.value; }
          else { var o = this.next(); if (o.type === 'eof') throw this.fail(o); }
        } while (this.acceptOp(','));
        this.expectOp(')');
      }
      return st;
    }
    throw this.fail();
  };

  P.parseDeclare = function () {
    this.expectKw('DECLARE');
    var vars = [];
    do {
      var v = this.next();
      if (v.type !== 'var') throw this.fail(v);
      this.acceptKw('AS');
      if (this.isKw('TABLE')) {
        var e = err(50000, 'Табличные переменные (DECLARE @t TABLE) в учебном движке не поддерживаются. Используйте временную таблицу: SELECT ... INTO #t FROM ...', v.line);
        throw e;
      }
      var dt = this.parseDataType(true);
      var init = null;
      if (this.acceptOp('=')) init = this.parseExpr();
      vars.push({ name: v.value, dtype: dt, init: init, line: v.line });
    } while (this.acceptOp(','));
    return { type: 'declare', vars: vars };
  };

  P.parseSet = function () {
    var setTok = this.next();
    var t = this.peek();
    if (t.type === 'var') {
      this.i++;
      var op = this.next();
      if (op.type !== 'op' || ['=', '+=', '-=', '*=', '/='].indexOf(op.value) < 0) throw this.fail(op);
      var ex = this.parseExpr();
      if (op.value !== '=') ex = { type: 'bin', op: op.value[0], left: { type: 'var', name: t.value, line: t.line }, right: ex, line: t.line };
      return { type: 'set', name: t.value, expr: ex, line: t.line };
    }
    var w = this.next();
    var name = String(w.value).toUpperCase();
    if (name === 'LANGUAGE') {
      var lv = this.next();
      return { type: 'setopt', opt: 'LANGUAGE', value: String(lv.value), line: w.line };
    }
    if (name === 'DATEFIRST') { var n = this.next(); return { type: 'setopt', opt: 'DATEFIRST', value: n.value, line: w.line }; }
    if (name === 'DATEFORMAT') { var f = this.next(); return { type: 'setopt', opt: 'DATEFORMAT', value: String(f.value).toLowerCase(), line: w.line }; }
    if (name === 'NOCOUNT' || name === 'ANSI_NULLS' || name === 'QUOTED_IDENTIFIER' || name === 'TRANSACTION' || name === 'STATISTICS' || name === 'ANSI_WARNINGS' || name === 'ARITHABORT') {
      // настройки, которые принимаем без эффекта
      while (this.peek().type !== 'eof' && !this.isOp(';') && !(this.peek().type === 'kw' && (this.peek().value === 'SELECT' || this.peek().value === 'WITH' || this.peek().value === 'DECLARE' || this.peek().value === 'SET'))) this.i++;
      return { type: 'setopt', opt: name, value: null, line: w.line };
    }
    throw this.fail(w);
  };

  P.parseDrop = function () {
    var d = this.next();
    this.expectKw('TABLE');
    var ifExists = false;
    if (this.acceptKw('IF')) { this.expectKw('EXISTS'); ifExists = true; }
    var names = [];
    do {
      var nm = this.parseObjectName();
      if (nm.name[0] !== '#') {
        throw err(50000, 'Удалять можно только свои временные таблицы (#имя). Таблицы базы изменять нельзя.', d.line);
      }
      names.push(nm.name);
    } while (this.acceptOp(','));
    return { type: 'drop', names: names, ifExists: ifExists, line: d.line };
  };

  P.parseObjectName = function () {
    var parts = [];
    var t = this.ident(); parts.push(t.value);
    while (this.isOp('.')) {
      this.i++;
      if (this.isOp('.')) { parts.push(''); continue; }
      var t2 = this.ident(); parts.push(t2.value);
    }
    return { name: parts[parts.length - 1], parts: parts, line: t.line };
  };

  /* -------- Типы данных -------- */
  P.parseDataType = function (isDeclare) {
    var t = this.next();
    var name = String(t.value).toUpperCase();
    if (t.type !== 'id' && t.type !== 'kw') throw this.fail(t);
    var args = [];
    if (this.isOp('(')) {
      this.i++;
      do {
        var a = this.next();
        if (a.type === 'num') args.push(a.value);
        else if (String(a.value).toUpperCase() === 'MAX') args.push(-1);
        else throw this.fail(a);
      } while (this.acceptOp(','));
      this.expectOp(')');
    }
    switch (name) {
      case 'INT': case 'INTEGER': return TY.int('int');
      case 'BIGINT': return TY.int('bigint');
      case 'SMALLINT': return TY.int('smallint');
      case 'TINYINT': return TY.int('tinyint');
      case 'BIT': return TY.bit();
      case 'DECIMAL': case 'NUMERIC': case 'DEC':
        var p = args.length ? args[0] : 18, s = args.length > 1 ? args[1] : 0;
        if (p < 1 || p > 38) throw err(1002, 'Строка ' + t.line + ': указанная точность ' + p + ' вне допустимого диапазона (от 1 до 38).', t.line);
        if (s > p) throw err(183, 'Масштаб (' + s + ') для столбца должен находиться в диапазоне от 0 до ' + p + '.', t.line);
        return TY.dec(p, s);
      case 'MONEY': return TY.dec(19, 4);
      case 'SMALLMONEY': return TY.dec(10, 4);
      case 'FLOAT': case 'REAL': return TY.float();
      case 'VARCHAR': case 'CHAR': case 'TEXT':
        return TY.str(args.length ? args[0] : (isDeclare ? 1 : 30), false);
      case 'NVARCHAR': case 'NCHAR': case 'NTEXT':
        return TY.str(args.length ? args[0] : (isDeclare ? 1 : 30), true);
      case 'DATE': return TY.date();
      case 'DATETIME': case 'DATETIME2': case 'SMALLDATETIME': case 'DATETIMEOFFSET': return TY.datetime();
      case 'TIME': return TY.datetime();
      case 'UNIQUEIDENTIFIER': return TY.guid();
      default:
        throw err(243, 'Тип ' + t.value + ' не является определенным системным типом.', t.line);
    }
  };

  /* -------- Запросы -------- */
  // parseQuery: [WITH ...] body [ORDER BY] [OFFSET/FETCH]
  P.parseQuery = function (top) {
    var q = { type: 'query', with: null, body: null, orderBy: null, offset: null, fetch: null, line: this.peek().line };
    if (this.isKw('WITH')) {
      this.i++;
      q.with = [];
      do {
        var nm = this.ident();
        var cols = null;
        if (this.isOp('(')) {
          this.i++; cols = [];
          do { cols.push(this.ident().value); } while (this.acceptOp(','));
          this.expectOp(')');
        }
        this.expectKw('AS');
        this.expectOp('(');
        var sub = this.parseQuery(false);
        this.expectOp(')');
        q.with.push({ name: nm.value, cols: cols, query: sub, line: nm.line });
      } while (this.acceptOp(','));
    }
    q.body = this.parseSetExpr();
    if (this.isKw('ORDER')) {
      this.i++; this.expectKw('BY');
      q.orderBy = this.parseOrderList();
      if (this.isWord('OFFSET')) {
        this.i++;
        q.offset = this.parseExpr();
        if (!this.acceptWord('ROWS')) this.expectWord('ROW');
        if (this.acceptKw('FETCH')) {
          if (!this.acceptWord('NEXT')) this.expectWord('FIRST');
          q.fetch = this.parseExpr();
          if (!this.acceptWord('ROWS')) this.expectWord('ROW');
          this.expectWord('ONLY');
        }
      }
    } else if (this.isWord('OFFSET')) {
      throw err(102, 'Неправильный синтаксис около конструкции "OFFSET". OFFSET ... FETCH работает только после ORDER BY.', this.peek().line);
    }
    return q;
  };

  P.parseOrderList = function () {
    var list = [];
    do {
      var e = this.parseExpr();
      var desc = false;
      if (this.acceptKw('DESC')) desc = true; else this.acceptKw('ASC');
      list.push({ expr: e, desc: desc });
    } while (this.acceptOp(','));
    return list;
  };

  P.parseSetExpr = function () {
    var left = this.parseSetTerm();
    while (this.isKw('UNION') || this.isKw('EXCEPT')) {
      var op = this.next().value;
      if (op === 'UNION' && this.acceptKw('ALL')) op = 'UNION ALL';
      var right = this.parseSetTerm();
      left = { type: 'setop', op: op, left: left, right: right };
    }
    return left;
  };
  P.parseSetTerm = function () {
    var left = this.parseSetPrimary();
    while (this.isKw('INTERSECT')) {
      this.i++;
      var right = this.parseSetPrimary();
      left = { type: 'setop', op: 'INTERSECT', left: left, right: right };
    }
    return left;
  };
  P.parseSetPrimary = function () {
    if (this.isOp('(')) {
      this.i++;
      var q = this.parseQuery(false);
      this.expectOp(')');
      return { type: 'parenq', query: q };
    }
    return this.parseCore();
  };

  P.parseCore = function () {
    var startTok = this.peek();
    this.expectKw('SELECT');
    var c = { type: 'core', distinct: false, top: null, items: [], into: null, from: null, where: null, groupBy: null, having: null, line: startTok.line };
    if (this.acceptKw('DISTINCT')) c.distinct = true; else this.acceptKw('ALL');
    if (this.acceptKw('TOP')) {
      var te;
      if (this.isOp('(')) { this.i++; te = this.parseExpr(); this.expectOp(')'); }
      else { var nt = this.next(); if (nt.type !== 'num' && nt.type !== 'var') throw this.fail(nt); te = nt.type === 'num' ? { type: 'lit', value: nt.value, ltype: nt.kind === 'int' ? TY.int() : TY.float() } : { type: 'var', name: nt.value, line: nt.line }; }
      c.top = { expr: te, percent: false, ties: false, line: startTok.line };
      if (this.acceptKw('PERCENT')) c.top.percent = true;
      if (this.isKw('WITH') && this.isWord('TIES', 1)) { this.i += 2; c.top.ties = true; }
    }
    // список выбора
    do {
      c.items.push(this.parseSelectItem());
    } while (this.acceptOp(','));
    if (this.acceptKw('INTO')) {
      var nm = this.parseObjectName();
      if (nm.name[0] !== '#') throw err(50000, 'SELECT ... INTO можно использовать только с временной таблицей (#имя). Создавать постоянные таблицы в этом курсе нельзя.', nm.line);
      c.into = nm.name;
    }
    if (this.acceptKw('FROM')) {
      c.from = [];
      do { c.from.push(this.parseTableSource()); } while (this.acceptOp(','));
    }
    if (this.acceptKw('WHERE')) c.where = this.parseExpr();
    if (this.isKw('GROUP')) {
      this.i++; this.expectKw('BY');
      c.groupBy = this.parseGroupBy();
    }
    if (this.acceptKw('HAVING')) c.having = this.parseExpr();
    return c;
  };

  P.parseSelectItem = function () {
    var t = this.peek();
    if (t.type === 'op' && t.value === '*') { this.i++; return { type: 'star', qualifier: null, line: t.line }; }
    // t.*  /  schema.t.*
    if (t.type === 'id') {
      var k = 0, parts = [];
      while (this.peek(k).type === 'id' && this.isOp('.', k + 1)) { parts.push(this.peek(k).value); k += 2; }
      if (parts.length && this.isOp('*', k)) { this.i += k + 1; return { type: 'star', qualifier: parts[parts.length - 1], line: t.line }; }
    }
    // @var = expr
    if (t.type === 'var' && this.isOp('=', 1)) {
      this.i += 2;
      return { type: 'assign', name: t.value, expr: this.parseExpr(), line: t.line };
    }
    // alias = expr
    if ((t.type === 'id' || t.type === 'str') && this.isOp('=', 1)) {
      this.i += 2;
      var ex = this.parseExpr();
      return { type: 'item', expr: ex, alias: t.value, line: t.line };
    }
    var e = this.parseExpr();
    var alias = null;
    if (this.acceptKw('AS')) {
      var a = this.next();
      if (a.type !== 'id' && a.type !== 'str') throw this.fail(a);
      alias = a.value;
    } else if (this.peek().type === 'id' && !this.isWord('GO')) {
      alias = this.next().value;
    } else if (this.peek().type === 'str') {
      alias = this.next().value;
    }
    return { type: 'item', expr: e, alias: alias, line: t.line };
  };

  P.parseGroupBy = function () {
    var items = [];
    do {
      if (this.isWord('ROLLUP') && this.isOp('(', 1)) { this.i += 2; items.push({ rollup: this.parseGroupList() }); this.expectOp(')'); }
      else if (this.isWord('CUBE') && this.isOp('(', 1)) { this.i += 2; items.push({ cube: this.parseGroupList() }); this.expectOp(')'); }
      else if (this.isWord('GROUPING') && this.isWord('SETS', 1)) {
        this.i += 2; this.expectOp('(');
        var sets = [];
        do {
          if (this.isOp('(')) {
            this.i++;
            if (this.isOp(')')) { this.i++; sets.push([]); }
            else { sets.push(this.parseGroupList()); this.expectOp(')'); }
          } else sets.push([this.parseExpr()]);
        } while (this.acceptOp(','));
        this.expectOp(')');
        items.push({ sets: sets });
      }
      else items.push({ expr: this.parseExpr() });
    } while (this.acceptOp(','));
    return items;
  };
  P.parseGroupList = function () { var l = []; do { l.push(this.parseExpr()); } while (this.acceptOp(',')); return l; };

  P.parseTableSource = function () {
    var left = this.parseTablePrimary();
    while (true) {
      var kind = null, t = this.peek();
      if (this.isKw('JOIN')) { this.i++; kind = 'INNER'; }
      else if (this.isKw('INNER')) { this.i++; this.expectKw('JOIN'); kind = 'INNER'; }
      else if (this.isKw('LEFT')) { this.i++; this.acceptKw('OUTER'); this.expectKw('JOIN'); kind = 'LEFT'; }
      else if (this.isKw('RIGHT')) { this.i++; this.acceptKw('OUTER'); this.expectKw('JOIN'); kind = 'RIGHT'; }
      else if (this.isKw('FULL')) { this.i++; this.acceptKw('OUTER'); this.expectKw('JOIN'); kind = 'FULL'; }
      else if (this.isKw('CROSS')) {
        this.i++;
        if (this.acceptKw('JOIN')) kind = 'CROSS';
        else if (this.acceptWord('APPLY')) kind = 'CROSSAPPLY';
        else throw this.fail();
      }
      else if (this.isKw('OUTER') && this.isWord('APPLY', 1)) { this.i += 2; kind = 'OUTERAPPLY'; }
      else break;
      var right = this.parseTablePrimary();
      var on = null;
      if (kind === 'INNER' || kind === 'LEFT' || kind === 'RIGHT' || kind === 'FULL') {
        if (!this.acceptKw('ON')) {
          var nt = this.peek();
          throw err(nt.type === 'kw' ? 156 : 102, (nt.type === 'kw' ? 'Неправильный синтаксис около ключевого слова "' + nt.value + '".' : 'Неправильный синтаксис около конструкции "' + (nt.value || 'конец запроса') + '".') + ' После ' + kind + ' JOIN нужно условие соединения ON.', nt.line);
        }
        on = this.parseExpr();
      }
      left = { type: 'join', kind: kind, left: left, right: right, on: on, line: t.line };
    }
    return left;
  };

  P.parseAlias = function () {
    if (this.acceptKw('AS')) { var a = this.next(); if (a.type !== 'id' && a.type !== 'str') throw this.fail(a); return a.value; }
    if (this.peek().type === 'id' && !this.isWord('APPLY') && !this.isWord('GO') && !this.isWord('OFFSET')) return this.next().value;
    return null;
  };
  P.skipHints = function () {
    if (this.isKw('WITH') && this.isOp('(', 1)) {
      this.i += 2;
      var depth = 1;
      while (depth > 0) { var t = this.next(); if (t.type === 'eof') throw this.fail(t); if (t.type === 'op' && t.value === '(') depth++; if (t.type === 'op' && t.value === ')') depth--; }
      return true;
    }
    if (this.isOp('(') && this.isWord('NOLOCK', 1)) { this.i += 3; return true; }
    return false;
  };

  P.parseTablePrimary = function () {
    var t = this.peek();
    if (this.isOp('(')) {
      // производная таблица (подзапрос) или соединение в скобках
      var save = this.i;
      var isQuery = this.isKw('SELECT', 1) || this.isKw('WITH', 1);
      if (!isQuery && this.isOp('(', 1)) {
        // ((SELECT ...)) или ((a JOIN b) JOIN c): пробуем как запрос
        var k = 1; while (this.isOp('(', k)) k++;
        isQuery = this.isKw('SELECT', k);
      }
      if (isQuery) {
        this.i++;
        var q = this.parseQuery(false);
        this.expectOp(')');
        var alias = this.parseAlias();
        var cols = null;
        if (alias && this.isOp('(')) {
          this.i++; cols = [];
          do { cols.push(this.ident().value); } while (this.acceptOp(','));
          this.expectOp(')');
        }
        if (!alias) throw err(102, 'Неправильный синтаксис около конструкции ")". У подзапроса во FROM обязательно должен быть псевдоним, например: (SELECT ...) AS t', t.line);
        return { type: 'derived', query: q, alias: alias, cols: cols, line: t.line };
      }
      this.i = save + 1;
      var inner = this.parseTableSource();
      this.expectOp(')');
      return inner;
    }
    if (t.type === 'id' && t.value.toUpperCase() === 'GENERATE_SERIES' && this.isOp('(', 1)) {
      this.i += 2;
      var args = [];
      if (!this.isOp(')')) do { args.push(this.parseExpr()); } while (this.acceptOp(','));
      this.expectOp(')');
      var al = this.parseAlias();
      return { type: 'tvf', name: 'GENERATE_SERIES', args: args, alias: al || 'GENERATE_SERIES', line: t.line };
    }
    if (t.type === 'id' && t.value.toUpperCase() === 'STRING_SPLIT' && this.isOp('(', 1)) {
      this.i += 2;
      var a2 = [];
      do { a2.push(this.parseExpr()); } while (this.acceptOp(','));
      this.expectOp(')');
      var al2 = this.parseAlias();
      return { type: 'tvf', name: 'STRING_SPLIT', args: a2, alias: al2 || 'STRING_SPLIT', line: t.line };
    }
    var nm = this.parseObjectName();
    this.skipHints();
    var alias2 = this.parseAlias();
    this.skipHints();
    return { type: 'table', name: nm.name, parts: nm.parts, alias: alias2, line: nm.line };
  };

  /* -------- Выражения -------- */
  P.parseExpr = function () { return this.parseOr(); };
  P.parseOr = function () {
    var l = this.parseAnd();
    while (this.isKw('OR')) { var t = this.next(); l = { type: 'or', left: l, right: this.parseAnd(), line: t.line }; }
    return l;
  };
  P.parseAnd = function () {
    var l = this.parseNot();
    while (this.isKw('AND')) { var t = this.next(); l = { type: 'and', left: l, right: this.parseNot(), line: t.line }; }
    return l;
  };
  P.parseNot = function () {
    if (this.isKw('NOT')) { var t = this.next(); return { type: 'not', expr: this.parseNot(), line: t.line }; }
    return this.parsePredicate();
  };
  P.parseSubqueryParen = function () {
    this.expectOp('(');
    var q = this.parseQuery(false);
    this.expectOp(')');
    return q;
  };
  P.parsePredicate = function () {
    var t = this.peek();
    if (this.isKw('EXISTS')) {
      this.i++;
      return { type: 'exists', sub: this.parseSubqueryParen(), line: t.line };
    }
    var left = this.parseAdd();
    var not = false;
    if (this.isKw('NOT') && (this.isKw('BETWEEN', 1) || this.isKw('IN', 1) || this.isKw('LIKE', 1))) { this.i++; not = true; }
    var p = this.peek();
    if (this.isKw('BETWEEN')) {
      this.i++;
      var lo = this.parseAdd();
      this.expectKw('AND');
      var hi = this.parseAdd();
      return { type: 'between', expr: left, lo: lo, hi: hi, not: not, line: p.line };
    }
    if (this.isKw('IN')) {
      this.i++;
      this.expectOp('(');
      if (this.isKw('SELECT') || this.isKw('WITH')) {
        var q = this.parseQuery(false);
        this.expectOp(')');
        return { type: 'in', expr: left, sub: q, not: not, line: p.line };
      }
      var list = [];
      do { list.push(this.parseExpr()); } while (this.acceptOp(','));
      this.expectOp(')');
      return { type: 'in', expr: left, list: list, not: not, line: p.line };
    }
    if (this.isKw('LIKE')) {
      this.i++;
      var pat = this.parseAdd();
      var esc = null;
      if (this.acceptKw('ESCAPE')) esc = this.parseAdd();
      return { type: 'like', expr: left, pattern: pat, escape: esc, not: not, line: p.line };
    }
    if (not) throw this.fail();
    if (this.isKw('IS')) {
      this.i++;
      var isnot = this.acceptKw('NOT');
      if (!this.acceptKw('NULL')) throw this.fail();
      return { type: 'isnull', expr: left, not: isnot, line: p.line };
    }
    if (p.type === 'op' && ['=', '<>', '!=', '<', '>', '<=', '>=', '!<', '!>'].indexOf(p.value) >= 0) {
      this.i++;
      var op = p.value === '!=' ? '<>' : p.value === '!<' ? '>=' : p.value === '!>' ? '<=' : p.value;
      if (this.isKw('ALL') || this.isKw('ANY') || this.isKw('SOME')) {
        var quant = this.next().value; if (quant === 'SOME') quant = 'ANY';
        var sq = this.parseSubqueryParen();
        return { type: 'quant', op: op, quant: quant, left: left, sub: sq, line: p.line };
      }
      var right = this.parseAdd();
      // a = b = c — недопустимо
      return { type: 'cmp', op: op, left: left, right: right, line: p.line };
    }
    return left;
  };
  P.parseAdd = function () {
    var l = this.parseMul();
    while (this.isOp('+') || this.isOp('-') || this.isOp('&') || this.isOp('|') || this.isOp('^')) {
      var t = this.next();
      l = { type: 'bin', op: t.value, left: l, right: this.parseMul(), line: t.line };
    }
    return l;
  };
  P.parseMul = function () {
    var l = this.parseUnary();
    while (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
      var t = this.next();
      l = { type: 'bin', op: t.value, left: l, right: this.parseUnary(), line: t.line };
    }
    return l;
  };
  P.parseUnary = function () {
    var t = this.peek();
    if (this.isOp('-') || this.isOp('+') || this.isOp('~')) {
      this.i++;
      var e = this.parseUnary();
      if (t.value === '-' && e.type === 'lit' && typeof e.value === 'number') { return { type: 'lit', value: -e.value, ltype: e.ltype, line: t.line, neg: true }; }
      return { type: 'unary', op: t.value, expr: e, line: t.line };
    }
    return this.parsePostfix();
  };
  P.parsePostfix = function () {
    var e = this.parsePrimary();
    // COLLATE игнорируем
    if (this.isKw('COLLATE')) { this.i++; this.next(); }
    return e;
  };

  P.parseOver = function () {
    this.expectOp('(');
    var w = { partition: null, order: null, frame: null };
    if (this.isWord('PARTITION')) { this.i++; this.expectKw('BY'); w.partition = this.parseGroupList(); }
    if (this.isKw('ORDER')) { this.i++; this.expectKw('BY'); w.order = this.parseOrderList(); }
    if (this.isWord('ROWS') || this.isWord('RANGE')) {
      var unit = this.next().value.toUpperCase();
      var fr = { unit: unit, start: null, end: null, line: this.peek().line };
      if (this.acceptKw('BETWEEN')) {
        fr.start = this.parseBound();
        this.expectKw('AND');
        fr.end = this.parseBound();
      } else {
        fr.start = this.parseBound();
        fr.end = { type: 'current' };
      }
      w.frame = fr;
    }
    if (this.isWord('GROUPS')) {
      var g = this.peek();
      throw err(102, 'Неправильный синтаксис около конструкции "GROUPS". В SQL Server рамка окна задаётся только через ROWS или RANGE (GROUPS есть в PostgreSQL, но не в T-SQL).', g.line);
    }
    this.expectOp(')');
    return w;
  };
  P.parseBound = function () {
    if (this.acceptWord('UNBOUNDED')) {
      if (this.acceptWord('PRECEDING')) return { type: 'unb_prec' };
      this.expectWord('FOLLOWING'); return { type: 'unb_foll' };
    }
    if (this.acceptKw('CURRENT')) { this.expectWord('ROW'); return { type: 'current' }; }
    var n = this.next();
    if (n.type !== 'num') {
      if (n.type === 'str' || n.type === 'var') throw err(102, 'Неправильный синтаксис около конструкции "' + n.value + '".', n.line);
      throw this.fail(n);
    }
    if (this.acceptWord('PRECEDING')) return { type: 'prec', n: n.value };
    this.expectWord('FOLLOWING'); return { type: 'foll', n: n.value };
  };

  P.parsePrimary = function () {
    var t = this.peek();
    switch (t.type) {
      case 'num':
        this.i++;
        if (t.kind === 'int') return { type: 'lit', value: t.value, ltype: TY.int(), line: t.line };
        if (t.kind === 'decimal') return { type: 'lit', value: t.value, ltype: TY.dec(Math.min(38, Math.max(t.p, t.s)), t.s), line: t.line };
        return { type: 'lit', value: t.value, ltype: TY.float(), line: t.line };
      case 'str':
        this.i++;
        return { type: 'lit', value: t.value, ltype: TY.str(Math.max(1, t.value.length), t.n), line: t.line };
      case 'var':
        this.i++;
        return { type: 'var', name: t.value, line: t.line };
      case 'sysvar':
        this.i++;
        return { type: 'sysvar', name: t.value, line: t.line };
      case 'op':
        if (t.value === '(') {
          this.i++;
          if (this.isKw('SELECT') || this.isKw('WITH')) {
            var q = this.parseQuery(false);
            this.expectOp(')');
            return { type: 'subq', query: q, line: t.line };
          }
          var e = this.parseExpr();
          this.expectOp(')');
          return { type: 'paren', expr: e, line: t.line };
        }
        throw this.fail(t);
      case 'kw':
        if (t.value === 'NULL') { this.i++; return { type: 'lit', value: null, ltype: TY.nul(), line: t.line }; }
        if (t.value === 'CASE') return this.parseCase();
        if (t.value === 'CURRENT_TIMESTAMP') { this.i++; return { type: 'func', name: 'GETDATE', args: [], line: t.line }; }
        if (t.value === 'CONVERT' || t.value === 'COALESCE' || t.value === 'NULLIF' || t.value === 'LEFT' || t.value === 'RIGHT') {
          if (this.isOp('(', 1)) return this.parseFunc();
        }
        throw this.fail(t);
      case 'id':
        if (this.isOp('(', 1)) return this.parseFunc();
        // составной идентификатор
        var parts = [t.value]; this.i++;
        while (this.isOp('.') && (this.peek(1).type === 'id' || (this.peek(1).type === 'kw'))) {
          this.i++;
          var p = this.next();
          parts.push(p.value);
        }
        return { type: 'col', parts: parts, line: t.line };
      default:
        throw this.fail(t);
    }
  };

  P.parseCase = function () {
    var t = this.next();
    var c = { type: 'case', operand: null, whens: [], els: null, line: t.line };
    if (!this.isKw('WHEN')) c.operand = this.parseExpr();
    if (!this.isKw('WHEN')) throw this.fail();
    while (this.acceptKw('WHEN')) {
      var w = this.parseExpr();
      this.expectKw('THEN');
      var th = this.parseExpr();
      c.whens.push({ when: w, then: th });
    }
    if (this.acceptKw('ELSE')) c.els = this.parseExpr();
    if (!this.acceptKw('END')) {
      var nt = this.peek();
      throw err(nt.type === 'kw' ? 156 : 102, (nt.type === 'kw' ? 'Неправильный синтаксис около ключевого слова "' + nt.value + '".' : 'Неправильный синтаксис около конструкции "' + (nt.value || '') + '".') + ' Похоже, CASE не закрыт словом END.', nt.line);
    }
    return c;
  };

  P.parseFunc = function () {
    var t = this.next();
    var name = String(t.value).toUpperCase();
    this.expectOp('(');
    var f = { type: 'func', name: name, args: [], line: t.line };
    if (name === 'CAST' || name === 'TRY_CAST') {
      var e = this.parseExpr();
      this.expectKw('AS');
      var dt = this.parseDataType(false);
      this.expectOp(')');
      return { type: 'cast', expr: e, dtype: dt, tryMode: name === 'TRY_CAST', line: t.line, fname: name };
    }
    if (name === 'CONVERT' || name === 'TRY_CONVERT') {
      var dt2 = this.parseDataType(false);
      this.expectOp(',');
      var e2 = this.parseExpr();
      var style = null;
      if (this.acceptOp(',')) style = this.parseExpr();
      this.expectOp(')');
      return { type: 'cast', expr: e2, dtype: dt2, tryMode: name === 'TRY_CONVERT', style: style, line: t.line, fname: name };
    }
    if (DATEPART_FUNCS[name]) {
      var dpTok = this.next();
      var dp = DATEPARTS[String(dpTok.value).toLowerCase()];
      if (!dp || dpTok.type === 'str') {
        throw err(1023, 'Недопустимый параметр 1, указанный для ' + name.toLowerCase() + '. Первым аргументом должна быть часть даты без кавычек: year, quarter, month, day, week, hour, minute...', dpTok.line);
      }
      f.datepart = dp;
      while (this.acceptOp(',')) f.args.push(this.parseExpr());
      this.expectOp(')');
    } else if (this.isOp('*')) {
      this.i++; f.star = true; this.expectOp(')');
    } else if (this.isOp(')')) {
      this.i++;
    } else {
      if (this.acceptKw('DISTINCT')) f.distinct = true; else this.acceptKw('ALL');
      do { f.args.push(this.parseExpr()); } while (this.acceptOp(','));
      this.expectOp(')');
    }
    if (this.isKw('WITHIN')) {
      this.i++; this.expectKw('GROUP'); this.expectOp('(');
      this.expectKw('ORDER'); this.expectKw('BY');
      f.withinGroup = this.parseOrderList();
      this.expectOp(')');
    }
    if (this.isKw('OVER')) { this.i++; f.over = this.parseOver(); }
    return f;
  };

  // Тип из строки: 'decimal(18,2)', 'nvarchar(max)', 'int' …
  T.typeFromString = function (src) {
    var p = new Parser(String(src));
    var t = p.parseDataType(false);
    if (p.peek().type !== 'eof') throw p.fail();
    return t;
  };

  T.parse = function (src) {
    var p = new Parser(src);
    return p.parseBatch();
  };

  // Канонический текст выражения (для сравнения выражений GROUP BY / ORDER BY)
  function ek(n) {
    if (!n) return '';
    switch (n.type) {
      case 'lit': return n.value === null ? 'null' : (typeof n.value === 'string' ? "'" + n.value.toLowerCase() + "'" : String(n.value));
      case 'col': return n.parts.map(function (p) { return p.toLowerCase(); }).join('.');
      case 'var': return n.name.toLowerCase();
      case 'sysvar': return n.name.toLowerCase();
      case 'paren': return ek(n.expr);
      case 'unary': return n.op + ek(n.expr);
      case 'bin': return '(' + ek(n.left) + n.op + ek(n.right) + ')';
      case 'cmp': return '(' + ek(n.left) + n.op + ek(n.right) + ')';
      case 'and': return '(' + ek(n.left) + ' and ' + ek(n.right) + ')';
      case 'or': return '(' + ek(n.left) + ' or ' + ek(n.right) + ')';
      case 'not': return 'not ' + ek(n.expr);
      case 'isnull': return ek(n.expr) + (n.not ? ' is not null' : ' is null');
      case 'between': return ek(n.expr) + (n.not ? ' not' : '') + ' between ' + ek(n.lo) + ' and ' + ek(n.hi);
      case 'in': return ek(n.expr) + (n.not ? ' not' : '') + ' in(' + (n.list ? n.list.map(ek).join(',') : 'subq') + ')';
      case 'like': return ek(n.expr) + (n.not ? ' not' : '') + ' like ' + ek(n.pattern);
      case 'case': return 'case ' + ek(n.operand) + n.whens.map(function (w) { return ' when ' + ek(w.when) + ' then ' + ek(w.then); }).join('') + ' else ' + ek(n.els) + ' end';
      case 'func': return n.name.toLowerCase() + '(' + (n.datepart ? n.datepart + ',' : '') + (n.distinct ? 'distinct ' : '') + (n.star ? '*' : n.args.map(ek).join(',')) + ')' + (n.over ? ' over(...)' : '');
      case 'cast': return (n.fname || 'cast').toLowerCase() + '(' + ek(n.expr) + ' as ' + T.typeFull(n.dtype) + (n.style ? ',' + ek(n.style) : '') + ')';
      case 'subq': return 'subq#' + (n._id || (n._id = Math.random()));
      case 'exists': return 'exists#' + (n._id || (n._id = Math.random()));
      default: return n.type + '#';
    }
  }
  T.exprKey = ek;

  // Читаемый текст выражения (для пошагового режима)
  function et(n) {
    if (!n) return '';
    switch (n.type) {
      case 'lit': return n.value === null ? 'NULL' : (typeof n.value === 'string' ? "'" + n.value + "'" : String(n.value));
      case 'col': return n.parts.join('.');
      case 'var': case 'sysvar': return n.name;
      case 'paren': return '(' + et(n.expr) + ')';
      case 'unary': return n.op + et(n.expr);
      case 'bin': case 'cmp': return et(n.left) + ' ' + n.op + ' ' + et(n.right);
      case 'and': return et(n.left) + ' AND ' + et(n.right);
      case 'or': return et(n.left) + ' OR ' + et(n.right);
      case 'not': return 'NOT ' + et(n.expr);
      case 'isnull': return et(n.expr) + (n.not ? ' IS NOT NULL' : ' IS NULL');
      case 'case': return 'CASE…END';
      case 'func': return n.name + '(' + (n.datepart ? n.datepart + (n.args.length ? ', ' : '') : '') + (n.star ? '*' : n.args.map(et).join(', ')) + ')';
      case 'cast': return (n.fname || 'CAST') + '(' + et(n.expr) + ' AS ' + T.typeFull(n.dtype) + ')';
      case 'subq': return '(подзапрос)';
      default: return '…';
    }
  }
  T.exprText = et;
})(typeof window !== 'undefined' ? window : globalThis);
