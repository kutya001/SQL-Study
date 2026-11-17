/* ============================================================
   Ядро приложения: состояние, маршрутизация, прогресс, XP,
   достижения, вход и учётные записи.
   ============================================================ */
(function (G) {
  'use strict';
  var U = G.U, h = U.h, S = G.Store, T = G.TSQL, P = G.Packs, PF = G.PackFormat;
  var A = G.App = {};
  var C = G.COURSE;

  A.user = null;
  A.db = null;
  A.version = '1.0';

  /* ---------------- База и курс ---------------- */
  /* Учебные базы: у каждого задания/примера есть поле pack (id базы) */
  A.pack = function (id) { return P.get(id || 'bank'); };
  A.dbFor = function (id) { var p = P.get(id || 'bank') || P.get('bank'); return PF.getDb(p); };
  A.getDb = function () { return A.dbFor('bank'); };
  A.execOpts = function (id) { var p = P.get(id || 'bank'); return { dbs: P.dbs(), now: p && p.today != null ? p.today : undefined }; };
  A.activePacks = function () { return P.active(A.user); };
  function byNum(a, b) { return a.num - b.num; }
  A.packModules = function (p) { return p.modules.slice().sort(byNum); };
  A.modules = function () { var out = []; A.activePacks().forEach(function (p) { out = out.concat(A.packModules(p)); }); return out; };
  A.allModules = function () { var out = []; P.all().forEach(function (p) { out = out.concat(A.packModules(p)); }); return out; };
  A.module = function (id) { return A.allModules().filter(function (m) { return m.id === id; })[0]; };
  A.allLessons = function (mods) { var out = []; (mods || A.modules()).forEach(function (m) { m.lessons.forEach(function (l, i) { out.push({ m: m, l: l, i: i }); }); }); return out; };
  A.trainerTasks = function () { var out = []; A.activePacks().forEach(function (p) { out = out.concat(p.trainer); }); return out; };
  A.allSets = function () { var out = []; P.all().forEach(function (p) { out = out.concat(p.sets); }); return out; };
  A.modHref = function (m) { return '#/m/' + encodeURIComponent(m.id); };
  A.lessonHref = function (m, i, step) { return '#/l/' + encodeURIComponent(m.id) + '/' + (i + 1) + (step !== undefined ? '/' + step : ''); };

  /* ---------------- Ранги ---------------- */
  var RANKS = [[0, 'Новичок'], [200, 'Стажёр'], [600, 'Младший аналитик'], [1200, 'Аналитик'], [2200, 'Старший аналитик'], [3500, 'Эксперт SQL'], [5000, 'Гуру SQL']];
  A.RANKS = RANKS;
  A.rank = function (xp) {
    var r = RANKS[0], next = null;
    for (var i = 0; i < RANKS.length; i++) { if (xp >= RANKS[i][0]) { r = RANKS[i]; next = RANKS[i + 1] || null; } }
    return { name: r[1], from: r[0], next: next ? next[0] : null, nextName: next ? next[1] : null, level: RANKS.indexOf(r) + 1 };
  };

  /* ---------------- Пользователь ---------------- */
  function newUser(name, id, dept, pinHash) {
    var now = new Date().toISOString();
    return {
      v: 1, id: id, name: name, dept: dept || '', pinHash: pinHash || null,
      created: now, updated: now, lastSeen: now,
      xp: 0, streak: { days: 0, last: null, best: 0 },
      lessons: {}, items: {}, ach: {}, modulesDone: {},
      stats: { runs: 0, errors: 0, checks: 0, solved: 0, firstTry: 0, firstTryStreak: 0, sandboxRuns: 0, hints: 0, solutionsShown: 0 },
      sandbox: '-- Песочница: пишите любые SELECT-запросы к учебной базе\nSELECT TOP (10) *\nFROM Clients;',
      // новая учётная запись наследует оформление, выбранное на странице входа
      settings: { theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light', palette: A.palette() }, last: null, log: []
    };
  }
  A.save = function () { if (A.user) { S.save(A.user); autoBackup(); } };

  /* ---------------- Копия прогресса в файл ---------------- */
  A.backupFile = function (u, auto) {
    u = u || A.user;
    u.backup = { at: new Date().toISOString(), xp: u.xp, solved: u.stats.solved, auto: !!auto };
    S.save(u);
    U.download(u.id + '.json', JSON.stringify(u, null, 1));
    if (auto) U.toast('Копия прогресса сохранена в папку «Загрузки» (' + U.esc(u.id) + '.json)', 'ok', 4000);
  };
  // Нужно ли напомнить о копии (только когда прогресс хранится в браузере)
  A.backupDue = function (u) {
    u = u || A.user;
    if (!u || S.mode === 'fs' || (u.stats.solved || 0) + Object.keys(u.lessons || {}).length < 3) return false;
    var b = u.backup;
    if (!b) return true;
    if (b.xp === u.xp) return false;
    return Date.now() - new Date(b.at).getTime() > 2 * 86400000;
  };
  var autoDone = {};
  function autoBackup() {
    var u = A.user;
    if (!u || autoDone[u.id] || S.mode === 'fs' || S.paused || !u.settings || !u.settings.autoBackup) return;
    var b = u.backup;
    if (b && (b.xp === u.xp || Date.now() - new Date(b.at).getTime() < 20 * 3600000)) return;
    if (!b && !(u.xp > 0)) return;
    autoDone[u.id] = true;   // не чаще одного раза за запуск (для каждого ученика)
    setTimeout(function () { if (A.user === u && !S.paused) A.backupFile(u, true); }, 300);
  }
  A.touchStreak = function () {
    var u = A.user, t = U.today();
    if (u.streak.last === t) return;
    var y = new Date(); y.setDate(y.getDate() - 1);
    var ys = y.getFullYear() + '-' + ('0' + (y.getMonth() + 1)).slice(-2) + '-' + ('0' + y.getDate()).slice(-2);
    u.streak.days = u.streak.last === ys ? u.streak.days + 1 : 1;
    u.streak.last = t;
    u.streak.best = Math.max(u.streak.best || 0, u.streak.days);
  };
  A.log = function (text) {
    var u = A.user; if (!u) return;
    u.log = u.log || [];
    u.log.unshift({ at: new Date().toISOString(), t: text });
    if (u.log.length > 60) u.log.length = 60;
  };

  A.addXP = function (n, why) {
    if (!n) return;
    var before = A.rank(A.user.xp);
    A.user.xp += n;
    var after = A.rank(A.user.xp);
    U.toast('<b>+' + n + ' XP</b> ' + U.esc(why || ''), 'xp');
    if (after.level > before.level) {
      setTimeout(function () { U.toast('Новый ранг: <b>' + U.esc(after.name) + '</b>!', 'rank', 5000); }, 600);
      A.log('Новый ранг: ' + after.name);
    }
    A.renderTop();
  };

  // отметить элемент (вопрос, задание, ДЗ, тренажёр)
  A.item = function (id) { return A.user.items[id]; };
  A.isDone = function (id) { var it = A.user.items[id]; return !!(it && it.ok); };
  A.recordAttempt = function (id, ok, data) {
    var u = A.user, it = u.items[id] || (u.items[id] = { ok: false, tries: 0 });
    it.tries = (it.tries || 0) + 1;
    if (data && data.sql !== undefined) it.sql = data.sql;
    var first = false;
    if (ok && !it.ok) {
      it.ok = true; it.at = new Date().toISOString(); first = true;
      it.firstTry = it.tries === 1;
      if (data && data.kind !== 'quiz') {
        u.stats.solved++;
        if (it.firstTry) { u.stats.firstTry++; u.stats.firstTryStreak++; } else u.stats.firstTryStreak = 0;
        if (it.tries >= 4) it.persist = true;
      }
      var xp = (data && data.xp) || 0;
      if (it.usedSolution) xp = Math.round(xp / 3);
      A.addXP(xp, data && data.why);
      if (data && data.title) A.log('Решено: ' + data.title);
    } else if (!ok && data && data.kind !== 'quiz') {
      u.stats.firstTryStreak = 0;
    }
    A.afterProgress();
    return { first: first, item: it };
  };
  A.afterProgress = function () {
    A.checkCompletion();
    A.checkAchievements();
    A.save();
    A.renderTop();
  };

  // уроки и модули
  A.lessonId = function (m, i) { return m.lessons[i].id; };
  A.lessonItems = function (l) {
    var ids = [];
    (l.steps || []).forEach(function (s) { if (s.required && s.id) ids.push(s.id); });
    (l.training || []).forEach(function (s) { if (s.id) ids.push(s.id); });
    return ids;
  };
  A.lessonState = function (l) {
    var ids = A.lessonItems(l);
    var done = ids.filter(A.isDone).length;
    var st = A.user.lessons[l.id] || {};
    return { total: ids.length, done: done, complete: !!st.done, visited: !!st.visited, step: st.step || 0 };
  };
  A.moduleState = function (m) {
    var ls = m.lessons.map(function (l) { return A.lessonState(l); });
    var lessonsDone = ls.filter(function (s) { return s.complete; }).length;
    var hw = (m.homework || []).map(function (t) { return t.id; });
    var hwDone = hw.filter(A.isDone).length;
    var total = m.lessons.length + hw.length, done = lessonsDone + hwDone;
    return { lessonsDone: lessonsDone, lessons: m.lessons.length, hwDone: hwDone, hw: hw.length, pct: total ? Math.round(done * 100 / total) : 0, complete: !!A.user.modulesDone[m.id] };
  };
  A.checkCompletion = function () {
    var u = A.user;
    A.allModules().forEach(function (m) {
      m.lessons.forEach(function (l) {
        var st = A.lessonState(l);
        var rec = u.lessons[l.id] || (u.lessons[l.id] = {});
        if (!rec.done && rec.visited && rec.finished && st.done === st.total) {
          rec.done = true; rec.at = new Date().toISOString();
          A.addXP(C.config.xp.lesson, 'урок «' + l.title + '» пройден');
          A.log('Урок пройден: ' + l.title);
        }
      });
      var ms = A.moduleState(m);
      if (!u.modulesDone[m.id] && ms.lessonsDone === ms.lessons && ms.hwDone === ms.hw) {
        u.modulesDone[m.id] = new Date().toISOString();
        A.addXP(C.config.xp.module, 'модуль «' + m.title + '» завершён');
        A.log('Модуль завершён: ' + m.num + '. ' + m.title);
        setTimeout(function () { U.toast('Модуль <b>' + m.num + '. ' + U.esc(m.title) + '</b> завершён!', 'rank', 5000); }, 900);
      }
    });
  };
  A.isUnlocked = function (m) {
    if (!C.config.lockModules) return true;
    var mods = A.packModules(A.pack(m.pack)), idx = mods.indexOf(m);
    if (idx <= 0) return true;
    var prev = mods[idx - 1];
    return A.moduleState(prev).lessonsDone === prev.lessons.length;
  };

  /* ---------------- Достижения ---------------- */
  A.achStats = function () {
    var u = A.user, mods = A.packModules(A.pack('bank'));
    var trTasks = A.trainerTasks();
    var trainerSolved = trTasks.filter(function (t) { return A.isDone(t.id); });
    var hwAll = 0, hwDone = 0;
    mods.forEach(function (m) { (m.homework || []).forEach(function (t) { hwAll++; if (A.isDone(t.id)) hwDone++; }); });
    var persist = Object.keys(u.items).some(function (k) { return u.items[k].persist; });
    return {
      runs: u.stats.runs, solved: u.stats.solved, firstTryStreak: u.stats.firstTryStreak, streak: u.streak.days,
      modulesDone: mods.filter(function (m) { return u.modulesDone[m.id]; }).length, modulesAll: mods.length,
      modDone: function (n) { var m = mods.filter(function (x) { return x.num === n; })[0]; return m && !!u.modulesDone[m.id]; },
      trainer: trainerSolved.length, trainerAll: trTasks.length,
      trainerLevel: function (lv) { return trainerSolved.filter(function (t) { return t.level === lv; }).length; },
      hwAll: hwAll, hwDone: hwDone, xp: u.xp, sandboxRuns: u.stats.sandboxRuns, persist: persist
    };
  };
  A.checkAchievements = function () {
    var u = A.user, st = A.achStats();
    C.achievements.forEach(function (a) {
      if (u.ach[a.id]) return;
      var ok = false;
      try { ok = a.test(st); } catch (e) { ok = false; }
      if (ok) {
        u.ach[a.id] = new Date().toISOString();
        A.log('Достижение: ' + a.title);
        setTimeout(function () { U.toast('Достижение: <b>' + U.esc(a.title) + '</b><br><small>' + U.esc(a.desc) + '</small>', 'ach', 5200, G.Icon.achName(a.id)); }, 400);
      }
    });
  };

  /* ---------------- Запуск SQL (общая точка) ---------------- */
  A.runSQL = function (sql, opts) {
    opts = opts || {};
    var xo = A.execOpts(opts.pack);
    xo.trace = opts.trace !== false;
    var res = T.execute(sql, opts.db || A.dbFor(opts.pack), xo);
    if (A.user) {
      A.user.stats.runs++;
      if (res.error) A.user.stats.errors++;
      if (opts.sandbox) A.user.stats.sandboxRuns++;
      A.checkAchievements();
      A.save();
    }
    return res;
  };

  /* ---------------- Верхняя панель ---------------- */
  /* ================= Оболочка: боковая панель, верхняя и нижняя панели ================= */
  var I = G.Icon;
  var NAV = [
    { href: '#/home', title: 'Курс', icon: 'course', re: /^#\/(home|m|l|hw|set)\b/ },
    { href: '#/trainer', title: 'Тренажёр', icon: 'target', re: /^#\/(trainer|t)\b/ },
    { href: '#/sandbox', title: 'Песочница', icon: 'terminal', re: /^#\/sandbox\b/ },
    { href: '#/schema', title: 'Схема', icon: 'schema', re: /^#\/schema\b/ },
    { href: '#/packs', title: 'Базы', icon: 'database', re: /^#\/packs\b/ },
    { href: '#/cheat', title: 'Справочник', icon: 'book', re: /^#\/cheat\b/ }
  ];
  var NAV2 = [
    { href: '#/ach', title: 'Достижения', icon: 'trophy', re: /^#\/ach\b/ },
    { href: '#/team', title: 'Сводка по группе', icon: 'users', re: /^#\/team\b/ },
    { href: '#/profile', title: 'Профиль', icon: 'user', re: /^#\/profile\b/ },
    { href: '#/help', title: 'Помощь', icon: 'help', re: /^#\/help\b/ }
  ];
  var TABS = [
    { href: '#/home', title: 'Курс', icon: 'course', re: NAV[0].re },
    { href: '#/trainer', title: 'Тренажёр', icon: 'target', re: NAV[1].re },
    { href: '#/sandbox', title: 'Песочница', icon: 'terminal', re: NAV[2].re },
    { href: '#/packs', title: 'Базы', icon: 'database', re: NAV[4].re },
    { href: '#/profile', title: 'Профиль', icon: 'user', re: NAV2[2].re }
  ];
  function isMobile() { return window.innerWidth < 1024; }
  function initials(name) { var p = String(name || '?').trim().split(/\s+/); return ((p[0] || '?').charAt(0) + (p[1] ? p[1].charAt(0) : '')).toUpperCase(); }
  A.initials = initials;
  A.section = function (route) {
    route = route || location.hash || '#/home';
    var all = NAV.concat(NAV2);
    for (var i = 0; i < all.length; i++) if (all[i].re.test(route)) return all[i];
    return null;
  };
  A.openDrawer = function () { document.body.classList.add('drawer-open'); };
  A.closeDrawer = function () { document.body.classList.remove('drawer-open'); };
  A.toggleSide = function () {
    if (isMobile()) { document.body.classList.toggle('drawer-open'); return; }
    var mini = !document.body.classList.contains('side-mini');
    document.body.classList.toggle('side-mini', mini);
    try { localStorage.setItem('sqlkurs.side', mini ? 'mini' : 'full'); } catch (e) { }
  };
  A.toggleTheme = function () { A.setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); };
  function navItem(x, route, cls) {
    var active = x.re.test(route);
    return h('a.' + (cls || 'nav-item') + (active ? '.active' : ''), { href: x.href, title: x.title, 'aria-current': active ? 'page' : null },
      h('span.ni-ic', I(x.icon, 20)), h('span.ni-t', x.title));
  }

  A.renderTop = function () {
    var top = U.qs('#topbar'), side = U.qs('#side'), tabs = U.qs('#tabbar');
    if (!top) return;
    U.clear(top); if (side) U.clear(side); if (tabs) U.clear(tabs);
    document.body.classList.toggle('has-user', !!A.user);
    if (!A.user) { top.style.display = 'none'; return; }
    top.style.display = '';
    var u = A.user, r = A.rank(u.xp);
    var pct = r.next ? Math.round((u.xp - r.from) * 100 / (r.next - r.from)) : 100;
    var route = location.hash || '#/home';
    var sec = A.section(route);
    var dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var wide = document.body.classList.contains('wide-ui');

    // --- левая панель (на телефоне — выдвижное меню)
    if (side) {
      side.appendChild(h('div.side-head',
        h('a.brand', { href: '#/home', title: 'SELECT с нуля' }, h('span.logo', I('database', 20)), h('span.brand-txt', h('b', 'SELECT с нуля'), h('small', 'курс SQL для аналитиков'))),
        h('button.icon-btn.side-close', { title: 'Закрыть меню', 'aria-label': 'Закрыть меню', onclick: A.closeDrawer }, I('x'))));
      side.appendChild(h('div.side-scroll',
        h('div.side-cap', 'Учёба'),
        h('nav.side-nav', { 'data-guide': 'nav-study' }, NAV.slice(0, 3).map(function (x) { return navItem(x, route); })),
        h('div.side-cap', 'Данные'),
        h('nav.side-nav', { 'data-guide': 'nav-data' }, NAV.slice(3).map(function (x) { return navItem(x, route); })),
        h('div.side-cap', 'Вы'),
        h('nav.side-nav', { 'data-guide': 'nav-me' }, NAV2.map(function (x) { return navItem(x, route); }))));
      side.appendChild(h('div.side-foot',
        h('a.side-user', { href: '#/profile', title: 'Профиль: ранг и XP', 'data-guide': 'side-user' },
          h('span.avatar', initials(u.name)),
          h('span.su-main', h('span.su-name', u.name), h('span.su-rank', r.name + ' · ' + u.xp + ' XP'), h('span.su-bar', h('i', { style: { width: pct + '%' } })))),
        h('div.side-actions', { 'data-guide': 'side-actions' },
          h('button.icon-btn', { title: dark ? 'Светлая тема' : 'Тёмная тема', 'aria-label': 'Сменить тему', onclick: A.toggleTheme }, I(dark ? 'sun' : 'moon')),
          h('button.icon-btn.side-pal', { title: 'Оформление: тема и палитра', 'aria-label': 'Оформление', onclick: A.showAppearance }, I('palette')),
          h('button.icon-btn.side-help', { title: 'Помощь: экскурсия и подсказки по этой странице', 'aria-label': 'Помощь', onclick: function () { A.closeDrawer(); if (G.Guide) G.Guide.menu(); } }, I('help')),
          h('button.icon-btn.side-collapse', { title: 'Свернуть панель', 'aria-label': 'Свернуть панель', onclick: A.toggleSide }, I('sidebar')),
          h('button.icon-btn', { title: 'Сменить пользователя', 'aria-label': 'Выйти', onclick: function () { A.closeDrawer(); A.logout(); } }, I('logout')))));
    }

    // --- верхняя панель
    top.appendChild(h('button.icon-btn.tb-menu', { title: 'Меню', 'aria-label': 'Меню', 'data-guide': 'menu-btn', onclick: A.toggleSide }, I('menu', 22)));
    top.appendChild(h('div.tb-title', sec ? h('span.tb-ic', I(sec.icon, 18)) : null, h('span.tb-sec', sec ? sec.title : 'SELECT с нуля')));
    top.appendChild(h('div.tb-right',
      h('span.pill.streak', { title: 'Дней подряд с занятиями', 'data-guide': 'streak' }, I('flame', 16), String(u.streak.days)),
      h('span.pill.xp', { 'data-guide': 'xp', title: r.name + ': ' + u.xp + ' XP' + (r.next ? ' (до следующего ранга — ' + (r.next - u.xp) + ')' : '') }, I('star', 16), String(u.xp)),
      h('button.icon-btn.tb-wide', { 'data-guide': 'wide', title: wide ? 'Вернуть обычную ширину (по центру)' : 'Растянуть на всю ширину экрана', 'aria-label': 'Ширина интерфейса', 'aria-pressed': wide ? 'true' : 'false', onclick: A.toggleWide }, I(wide ? 'narrow' : 'widen')),
      h('button.icon-btn.tb-pal', { title: 'Оформление: тема и палитра', 'aria-label': 'Оформление', 'data-guide': 'appearance', onclick: A.showAppearance }, I('palette')),
      h('button.icon-btn.tb-help' + (G.Guide && G.Guide.isNew() ? '.has-new' : ''), { title: 'Помощь: экскурсия и подсказки по этой странице', 'aria-label': 'Помощь', 'data-guide': 'help', onclick: function () { if (G.Guide) G.Guide.menu(); } }, I('help')),
      h('button.icon-btn.tb-theme', { 'data-guide': 'theme', title: dark ? 'Светлая тема' : 'Тёмная тема', 'aria-label': 'Сменить тему', onclick: A.toggleTheme }, I(dark ? 'sun' : 'moon')),
      h('a.tb-avatar', { href: '#/profile', title: u.name + ' — профиль', 'data-guide': 'avatar' }, h('span.avatar.sm', initials(u.name)))));

    // --- нижняя панель (телефон)
    if (tabs) TABS.forEach(function (x) { tabs.appendChild(navItem(x, route, 'tab')); });
  };

  // Поведение панелей: скрытие при прокрутке, клавиатура, жесты
  (function () {
    var lastY = 0, ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        var y = window.scrollY || 0, b = document.body.classList;
        b.toggle('scrolled', y > 6);
        if (isMobile() && !b.contains('drawer-open')) {
          if (y > lastY + 6 && y > 90) b.add('bars-hidden');
          else if (y < lastY - 6 || y < 40) b.remove('bars-hidden');
        } else b.remove('bars-hidden');
        lastY = y;
      });
    }, { passive: true });
    document.addEventListener('focusin', function (e) {
      if (isMobile() && e.target && /^(TEXTAREA|INPUT|SELECT)$/.test(e.target.tagName) && e.target.type !== 'checkbox' && e.target.type !== 'file') document.body.classList.add('kb-open');
    });
    document.addEventListener('focusout', function () { setTimeout(function () { var a = document.activeElement; if (!a || !/^(TEXTAREA|INPUT|SELECT)$/.test(a.tagName)) document.body.classList.remove('kb-open'); }, 120); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') A.closeDrawer(); });
    document.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'scrim') A.closeDrawer();
      var a = e.target && e.target.closest && e.target.closest('#side a');
      if (a) A.closeDrawer();
    });
    var sx = null, sy = null;
    document.addEventListener('touchstart', function (e) { var t = e.touches[0]; sx = t.clientX; sy = t.clientY; }, { passive: true });
    document.addEventListener('touchend', function (e) {
      if (sx === null || !isMobile()) return;
      var t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (Math.abs(dx) > 70 && Math.abs(dy) < 50) {
        if (dx < 0 && document.body.classList.contains('drawer-open')) A.closeDrawer();
        else if (dx > 0 && sx < 24 && A.user) A.openDrawer();
      }
      sx = sy = null;
    }, { passive: true });
    try { if (localStorage.getItem('sqlkurs.side') === 'mini') document.body.classList.add('side-mini'); } catch (e) { }
    window.addEventListener('resize', U.debounce(function () { if (!isMobile()) { A.closeDrawer(); document.body.classList.remove('bars-hidden', 'kb-open'); } }, 150));
  })();

  /* ---------------- Тема и палитра ---------------- */
  // Палитры: цвета каждой — в css/app.css (раздел «Палитры», блоки [data-palette="id"]). Первая — по умолчанию.
  A.PALETTES = [
    { id: 'ocean', name: 'Океан', hint: 'синий и бирюзовый' },
    { id: 'sky', name: 'Небо и солнце', hint: 'голубой и тёплый жёлтый' },
    { id: 'aqua', name: 'Аквамарин', hint: 'бирюзовый и мятный' },
    { id: 'emerald', name: 'Изумруд', hint: 'зелёный и бирюзовый' },
    { id: 'forest', name: 'Лес и песок', hint: 'оливковый и песочный' },
    { id: 'amber', name: 'Янтарь', hint: 'оранжевый и золотой' },
    { id: 'navy', name: 'Полночь и золото', hint: 'тёмно-синий и золото' },
    { id: 'graphite', name: 'Графит', hint: 'спокойный серо-синий' }
  ];
  A.palette = function () {
    var id = A.pref('palette');
    return A.PALETTES.some(function (p) { return p.id === id; }) ? id : A.PALETTES[0].id;
  };
  A.setPalette = function (id) {
    if (!A.PALETTES.some(function (p) { return p.id === id; }) || id === A.palette()) return;
    smoothColors();
    A.setPref('palette', id);
  };
  A.setTheme = function (t) {
    t = t === 'dark' ? 'dark' : 'light';
    if (document.documentElement.getAttribute('data-theme') === t) return;
    smoothColors();
    if (A.user) { A.user.settings.theme = t; A.save(); }
    try { localStorage.setItem('sqlkurs.theme', t); } catch (e) { }
    A.applyTheme(); A.renderTop();
  };
  // На полсекунды включает плавный переход цветов (css: html.pal-anim), чтобы смена палитры не «мигала»
  var smoothTimer = 0;
  function smoothColors() {
    var reduce = false;
    try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { }
    if (reduce) return;
    document.documentElement.classList.add('pal-anim');
    clearTimeout(smoothTimer);
    smoothTimer = setTimeout(function () { document.documentElement.classList.remove('pal-anim'); }, 650);
  }
  // Значок вкладки: C1 и C2 — два цвета градиента палитры
  var FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='C1'/%3E%3Cstop offset='1' stop-color='C2'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='32' height='32' rx='9' fill='url%28%23g%29'/%3E%3Cg fill='none' stroke='white' stroke-width='2' stroke-linecap='round'%3E%3Cellipse cx='16' cy='10' rx='7' ry='2.8'/%3E%3Cpath d='M9 10v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V10M9 16c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8'/%3E%3C/g%3E%3C/svg%3E";
  // Плитки выбора палитры. Каждая плитка красится своей палитрой (атрибут data-palette), поэтому образец всегда показывает
  // настоящие цвета — и для светлой, и для тёмной темы.
  A.palettePicker = function () {
    var cur = A.palette();
    return h('div.pal-grid', { role: 'group', 'aria-label': 'Палитра' }, A.PALETTES.map(function (p) {
      return h('button.pal-card' + (p.id === cur ? '.on' : ''), {
        type: 'button', 'data-palette': p.id, 'aria-pressed': p.id === cur ? 'true' : 'false', title: p.name + ' — ' + p.hint,
        onclick: function () { A.setPalette(p.id); }
      },
        h('span.pal-sw', { 'aria-hidden': 'true' }, h('i.pal-b1'), h('i.pal-b2'),
          h('span.pal-mini', h('i.pal-l1'), h('i.pal-l2'), h('i.pal-btn'))),
        h('span.pal-txt', h('b', p.name), h('small', p.hint)),
        h('span.pal-ok', { 'aria-hidden': 'true' }, I('check', 14)));
    }));
  };
  // Переключатель «Светлая / Тёмная»
  A.themeSwitch = function () {
    var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    return h('div.seg.theme-seg', { role: 'group', 'aria-label': 'Тема' }, [['light', 'Светлая', 'sun'], ['dark', 'Тёмная', 'moon']].map(function (x) {
      return h('button.seg-btn' + (x[0] === cur ? '.active' : ''), { type: 'button', 'data-theme-val': x[0], 'aria-pressed': x[0] === cur ? 'true' : 'false', onclick: function () { A.setTheme(x[0]); } }, I(x[2], 16), x[1]);
    }));
  };
  // Окно «Оформление»: тема и палитра. Открывается кнопкой с палитрой в верхней панели, в меню и на странице входа.
  A.showAppearance = function () {
    if (U.qs('.modal .pal-grid')) return;
    A.closeDrawer();
    U.modal('Оформление', h('div.appearance',
      h('div.ap-row', h('span.ap-cap', 'Тема'), A.themeSwitch()),
      h('div.ap-cap', 'Палитра'),
      A.palettePicker(),
      h('p.muted.small', 'Цвета меняются сразу. Выбор запоминается' + (A.user ? ' в вашем прогрессе и на этом устройстве.' : ' на этом устройстве.'))),
      [{ text: 'Готово', primary: true }]);
  };
  A.applyTheme = function () {
    var saved = null;
    try { saved = localStorage.getItem('sqlkurs.theme'); } catch (e) { }
    var t = (A.user && A.user.settings && A.user.settings.theme) || saved || 'light';
    if (t !== 'dark') t = 'light';
    var root = document.documentElement, pal = A.palette();
    root.setAttribute('data-theme', t);
    if (root.getAttribute('data-palette') !== pal) root.setAttribute('data-palette', pal);
    // цвет панели браузера и значок вкладки — в цветах палитры
    var cs = getComputedStyle(root), cv = function (name, def) { return cs.getPropertyValue(name).trim() || def; };
    var mc = document.querySelector('meta[name="theme-color"]'); if (mc) mc.setAttribute('content', cv('--bg', t === 'dark' ? '#0a0f1b' : '#eff1f7'));
    var fav = document.querySelector('link[rel="icon"]'), c1 = cv('--accent', '#2468e8'), c2 = cv('--accent-2', '#098bb3');
    if (fav && /^#[0-9a-f]{6}$/i.test(c1) && /^#[0-9a-f]{6}$/i.test(c2)) {
      var href = FAVICON.replace('C1', '%23' + c1.slice(1)).replace('C2', '%23' + c2.slice(1));
      if (fav.getAttribute('href') !== href) fav.setAttribute('href', href);
    }
    // отметка выбранной палитры и темы в открытых окнах выбора
    U.qsa('.pal-card').forEach(function (el) { var on = el.getAttribute('data-palette') === pal; el.classList.toggle('on', on); el.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    U.qsa('.theme-seg .seg-btn').forEach(function (el) { var on = el.getAttribute('data-theme-val') === t; el.classList.toggle('active', on); el.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    // вместе с темой — остальной вид: ширина интерфейса и анимация фона
    document.body.classList.toggle('wide-ui', A.pref('wide') === '1');
    var bp = A.pref('bg');   // 'on' / 'off'; не задано — как решит сам фон (выключен, если система просит «меньше движения»)
    if (G.Backdrop) G.Backdrop.set(bp === 'on' ? true : bp === 'off' ? false : null);
  };
  // Настройки вида: у вошедшего ученика — из его файла, до входа — из памяти браузера
  A.pref = function (key) {
    var s = A.user && A.user.settings, v = s ? s[key === 'bg' ? 'bgAnim' : key] : undefined;
    if (v === undefined || v === null) { try { v = localStorage.getItem('sqlkurs.' + key); } catch (e) { v = null; } }
    return v;
  };
  A.setPref = function (key, value) {
    if (A.user) { A.user.settings[key === 'bg' ? 'bgAnim' : key] = value; A.save(); }
    try { localStorage.setItem('sqlkurs.' + key, value); } catch (e) { }
    A.applyTheme(); A.renderTop();
  };
  // Во всю ширину экрана / по центру
  A.toggleWide = function () { A.setPref('wide', A.pref('wide') === '1' ? '0' : '1'); window.dispatchEvent(new Event('resize')); };

  /* ---------------- Маршрутизация ---------------- */
  var routes = [];
  A.route = function (re, fn) { routes.push([re, fn]); };
  A.go = function (hash) { if (location.hash === hash) A.dispatch(); else location.hash = hash; };
  var shownHash = null;
  A.dispatch = function () {
    var hash = location.hash || '#/home';
    var view = U.qs('#view');
    if (!A.user && hash !== '#/start') { location.hash = '#/start'; return; }
    for (var i = 0; i < routes.length; i++) {
      var m = routes[i][0].exec(hash);
      if (m) {
        // та же страница перерисовывается (например, после действия на ней) — остаёмся на том же месте
        var same = hash === shownHash, y = same ? (window.pageYOffset || 0) : 0;
        shownHash = hash;
        U.clear(view);
        view.className = '';
        A.closeDrawer(); document.body.classList.remove('bars-hidden');
        try { routes[i][1].apply(null, [view].concat(m.slice(1))); }
        catch (e) { console.error(e); view.appendChild(h('div.page', h('div.err-box', 'Ошибка страницы: ' + e.message))); }
        window.scrollTo(0, y);
        if (A.user && hash !== '#/start') { A.user.last = hash; }
        A.renderTop();
        return;
      }
    }
    location.hash = '#/home';
  };
  window.addEventListener('hashchange', function () {
    U.closeModals(400);   // ушли на другую страницу (например, кнопкой «Назад») — открытые окна и шторки закрываем
    A.dispatch();
  });

  /* ================= Страница входа ================= */
  A.route(/^#\/start$/, function (view) {
    if (A.user) {
      if (!S.paused) { S.save(A.user); S.flush(); }
      S.release(); A.user = null;
    }
    view.className = 'start';
    var box = h('div.start-box');
    view.appendChild(box);
    view.appendChild(h('button.icon-btn.start-pal', { title: 'Оформление: тема и палитра', 'aria-label': 'Оформление', onclick: A.showAppearance }, I('palette')));
    view.appendChild(h('button.icon-btn.start-help', { title: 'О курсе: что это и как устроена учёба', 'aria-label': 'О курсе', onclick: function () { if (G.Guide) G.Guide.about(); } }, I('help')));
    box.appendChild(h('div.start-logo', h('span.logo', I('database', 30)), h('div', h('h1', C.title), h('p', 'Курс T-SQL для аналитиков: только SELECT, от первого запроса до оконных функций'))));
    var area = h('div.start-area'); box.appendChild(area);
    S.init().then(function (state) { drawStart(area, state); }).catch(function (e) { area.appendChild(h('div.err-box', 'Ошибка хранилища: ' + e.message)); });
  });

  function storageNote() {
    var link = function (text, fn) { return h('a', { href: '#', onclick: function (e) { e.preventDefault(); fn(); } }, text); };
    if (S.mode === 'fs') return U.note('ok', 'folder', 'Прогресс — в файлах ', h('code', (S.folderName() || '') + '/progress'), ' · ', link('сменить папку', changeFolder));
    if (S.readonly && S.dir) return U.note('warn', 'alert', 'Папка «' + S.folderName() + '» только для чтения — прогресс хранится в браузере. ', link('Подключить с записью', function () { S.resetMode(); A.dispatch(); }));
    return U.note('ok', 'shield', 'Прогресс сохраняется в этом браузере автоматически.',
      U.more('Подробнее', function () { return h('div.small', 'Каждое действие сразу записывается в две копии в браузере и остаётся после его закрытия. Для переноса на другой компьютер или на случай очистки браузера скачивайте копию в файл в профиле. ', S.fsSupported ? link('Хранить в папке', function () { S.resetMode(); A.dispatch(); }) : null); }));
  }
  async function changeFolder() {
    try { await S.pickFolder(); A.packsReady = P.load(); await A.packsReady; A.dispatch(); }
    catch (e) { pickFailed(e, function () { A.dispatch(); }); }
  }

  /* --- Что делать, если папка не подключилась --- */
  function pickFailed(e, redraw) {
    if (e && e.name === 'AbortError') {
      var box = h('div',
        h('p', 'Курс не получил доступ к папке. Возможны две причины:'),
        h('ol.steps-list',
          h('li', h('b', 'Окно выбора закрыли кнопкой «Отмена». '), 'Тогда просто попробуйте ещё раз и нажмите «Выбрать папку», а затем «Изменить файлы» / «Разрешить».'),
          h('li', h('b', 'Браузер запрещает сайтам изменять файлы. '), 'Вы выбираете папку, а браузер ничего не спрашивает — значит, запрет стоит в настройках: его поставила политика организации или браузер сам перестал спрашивать после нескольких отказов. Как это проверить — в «Проверке браузера».')),
        h('p', 'Если запись запрещена, можно подключить папку ', h('b', 'только для чтения'), ': учебные базы из папки schemas будут работать, а прогресс сохранится в браузере (его можно выгрузить файлом в профиле). Или храните прогресс в браузере без папки — учебные базы всё равно подключатся из файла ', h('code', 'schemas/index.js'), '.'));
      U.modal('Папка не подключилась', box, [
        { text: 'Проверка браузера', onclick: function () { setTimeout(A.diagnose, 50); } },
        { text: 'Только для чтения', onclick: function () { setTimeout(function () { pickRO(redraw); }, 50); } },
        { text: 'Хранить в браузере', onclick: function () { S.useLocal(); redraw('local'); } },
        { text: 'Попробовать ещё раз', primary: true }]);
      return;
    }
    U.modal('Не удалось открыть папку', h('div', h('p', 'Браузер сообщил: ', h('code', (e && e.name || 'Error') + ': ' + (e && e.message || e))), h('p.muted', 'Частые причины: выбрана системная папка (корень диска, «Рабочий стол», «Загрузки» целиком), нет прав на запись в папку на сетевом диске, курс открыт не из распакованной папки.')),
      [{ text: 'Проверка браузера', onclick: function () { setTimeout(A.diagnose, 50); } }, { text: 'Закрыть', primary: true }]);
  }
  async function pickRO(redraw) {
    try {
      var r = await S.pickFolderRO();
      if (!r.hasIndex) U.toast('В выбранной папке нет index.html — учебные базы будут искаться в «' + U.esc(r.name) + '/schemas».', 'warn', 7000);
      redraw('ro');
    } catch (e) {
      if (e && e.name === 'AbortError') U.modal('Папка не подключилась и для чтения', h('div', h('p', 'Похоже, браузер запрещает сайтам любой доступ к папкам (или окно выбора закрыли «Отменой»).'), h('p', 'Храните прогресс в браузере: он сохраняется автоматически и остаётся после закрытия браузера, а учебные базы подключатся сами из файла schemas/index.js.')),
        [{ text: 'Проверка браузера', onclick: function () { setTimeout(A.diagnose, 50); } }, { text: 'Хранить в браузере', primary: true, onclick: function () { S.useLocal(); redraw('local'); } }]);
      else pickFailed(e, redraw);
    }
  }

  /* --- Проверка браузера --- */
  function browserInfo() {
    var ua = navigator.userAgent, m;
    if ((m = /YaBrowser\/([\d.]+)/.exec(ua))) return { name: 'Яндекс Браузер', ver: m[1], kind: 'yandex' };
    if ((m = /Edg\/([\d.]+)/.exec(ua))) return { name: 'Microsoft Edge', ver: m[1], kind: 'edge' };
    if ((m = /OPR\/([\d.]+)/.exec(ua))) return { name: 'Opera', ver: m[1], kind: 'opera' };
    if ((m = /Firefox\/([\d.]+)/.exec(ua))) return { name: 'Firefox', ver: m[1], kind: 'firefox' };
    if ((m = /Chrome\/([\d.]+)/.exec(ua))) return { name: 'Google Chrome', ver: m[1], kind: 'chrome' };
    if ((m = /Version\/([\d.]+).*Safari/.exec(ua))) return { name: 'Safari', ver: m[1], kind: 'safari' };
    return { name: 'неизвестный браузер', ver: '', kind: 'other' };
  }
  A.diagnose = async function () {
    var body = h('div.diag', h('p.muted', 'Проверяю…'));
    U.modal('Проверка браузера', body, [{ text: 'Закрыть', primary: true }]);
    var b = browserInfo(), st = await S.testStorage();
    var est = null; try { if (navigator.storage && navigator.storage.estimate) est = await navigator.storage.estimate(); } catch (e) { }
    if (S.persisted === null) await S.persist();
    var top = true; try { top = window.self === window.top; } catch (e) { top = false; }
    var perm = null;
    if (S.dir) { try { perm = { read: await S.dir.queryPermission({ mode: 'read' }), write: await S.dir.queryPermission({ mode: 'readwrite' }) }; } catch (e) { } }
    var lp = S.lastPick;
    var rows = [
      ['Браузер', b.name + (b.ver ? ' ' + b.ver.split('.')[0] : ''), b.kind === 'chrome' || b.kind === 'edge'],
      ['Выбор папки (File System Access API)', S.fsSupported ? 'есть' : 'нет', S.fsSupported],
      ['Курс открыт в отдельной вкладке', top ? 'да' : 'нет — во фрейме/предпросмотре', top],
      ['Адрес курса', location.protocol === 'file:' ? 'локальный файл (file://)' : location.protocol + '//' + location.host, true],
      ['Хранилище localStorage', st.localStorage ? 'работает' : 'недоступно', st.localStorage],
      ['Хранилище IndexedDB (запоминание папки)', st.indexedDB ? 'работает' : 'недоступно' + (st.idbError ? ' (' + st.idbError + ')' : ''), st.indexedDB],
      ['Текущий режим', S.mode === 'fs' ? 'папка подключена, запись разрешена' : (S.readonly && S.dir ? 'папка только для чтения' : 'прогресс в браузере'), true]
    ];
    if (perm) rows.push(['Доступ к папке «' + S.folderName() + '»', 'чтение: ' + perm.read + ', запись: ' + perm.write, perm.write === 'granted']);
    var pk = S.picks || {};
    ['readwrite', 'read'].forEach(function (m) {
      var x = pk[m]; if (!x) return;
      rows.push(['Попытка выбрать папку (' + (m === 'read' ? 'только чтение' : 'чтение и запись') + ')', U.fmtDate(x.at) + ': ' + (x.ok ? 'успешно' : x.name + ' — ' + x.message), x.ok]);
    });
    if (!pk.readwrite && !pk.read && lp) rows.push(['Последняя попытка выбрать папку', U.fmtDate(lp.at) + ': ' + (lp.ok ? 'успешно' : lp.name + ' — ' + lp.message), lp.ok]);
    var L = S.launch;
    rows.push(['Данные курса между запусками', L.prev ? 'сохраняются: найдены данные прошлого открытия (' + U.fmtDate(L.prev) + '), всего открытий: ' + (L.opens + 1) : 'первое открытие в этом браузере — или браузер удалил данные при закрытии (см. ниже)', L.prev ? true : null]);
    rows.push(['Защита от автоочистки (persistent storage)', S.persisted === true ? 'включена' : S.persisted === false ? 'браузер не дал (это нормально для локального файла)' : 'не поддерживается', true]);
    if (S.mode !== 'fs') rows.push(['Вторая копия прогресса (IndexedDB)', S.vaultOk === false ? 'ошибка: ' + S.vaultError : S.vaultOk ? 'пишется' : 'ещё не было записей', S.vaultOk !== false]);
    if (est && est.quota) rows.push(['Место для данных сайта', 'занято ' + (est.usage / 1048576).toFixed(1) + ' из ' + Math.round(est.quota / 1048576) + ' МБ', est.usage < est.quota * 0.9]);
    if (A.user && S.mode !== 'fs') rows.push(['Последняя копия прогресса в файл', A.user.backup ? U.fmtDate(A.user.backup.at) + (A.user.settings.autoBackup ? ' (автокопия включена)' : '') : 'не было', !!A.user.backup]);
    var bi = P.bundleInfo || (G.SQLKURS_BUNDLE && G.SQLKURS_BUNDLE.packs ? { count: G.SQLKURS_BUNDLE.packs.length, built: G.SQLKURS_BUNDLE.built } : null);
    if (!P.from && bi) rows.push(['Учебные базы', 'файл schemas/index.js на месте (баз: ' + bi.count + ', собран ' + U.fmtDate(bi.built) + ') — подключатся после входа', true]);
    else rows.push(['Учебные базы', P.from === 'folder' ? 'читаются из папки schemas' : P.from === 'bundle' ? 'из файла schemas/index.js (баз: ' + bi.count + ', собран ' + U.fmtDate(bi.built) + ')' : (bi ? 'файл schemas/index.js найден' : 'только встроенная — файла schemas/index.js нет'), P.from === 'folder' || P.from === 'bundle' || !!bi]);
    U.clear(body);
    var t = h('table.kv.diag-t');
    rows.forEach(function (r) { t.appendChild(h('tr', h('td', r[0]), h('td', h('span.dg-mark.' + (r[2] === null ? 'muted' : r[2] ? 'ok-t' : 'bad-t'), I(r[2] === null ? 'info' : r[2] ? 'check-circle' : 'x-circle', 16), ' '), r[1]))); });
    body.appendChild(t);
    var tips = [];
    var rwBad = pk.readwrite && !pk.readwrite.ok && pk.readwrite.name === 'AbortError';
    if (rwBad && pk.read && pk.read.ok) tips.push(['Вывод: чтение папки разрешено, а запись — нет.', 'Так бывает, когда изменение файлов запретила политика организации. Работайте в режиме «Только для чтения»: учебные базы берутся из папки, прогресс — в браузере (выгружайте его файлом в профиле и передавайте преподавателю). Снять запрет может только ИТ-отдел — см. ниже.']);
    else if (rwBad && pk.read && !pk.read.ok) tips.push(['Вывод: браузер не даёт доступ к папке ни на запись, ни на чтение.', 'Храните прогресс в браузере (кнопка «Хранить в браузере» на стартовой странице): учебные базы подключатся сами из файла schemas/index.js, прогресс сохраняется в браузере с резервной копией.']);
    else if (rwBad) tips.push(['Проверьте, разрешено ли хотя бы чтение.', ['Закройте это окно и нажмите «Только для чтения» на стартовом экране (или в окне ошибки). Потом снова откройте «Проверку браузера» — здесь появится вывод.']]);
    if (!S.fsSupported || (b.kind !== 'chrome' && b.kind !== 'edge')) tips.push(['Откройте курс в Google Chrome или Microsoft Edge.', 'В других браузерах выбор папки может не работать или работать иначе. Правой кнопкой по index.html → «Открыть с помощью» → Chrome/Edge.']);
    if (!top) tips.push(['Откройте index.html напрямую.', 'Курс открыт внутри другой страницы (предпросмотр почты, мессенджера, портала) — там выбор папки запрещён.']);
    if (!st.indexedDB) tips.push(['Браузер не даёт сохранять данные сайтов.', 'Папку придётся выбирать при каждом запуске, а прогресс в браузере может не сохраниться. Проверьте настройки cookies и данных сайтов (не должно быть «Блокировать всё»), не используйте режим инкогнито.']);
    var folderTried = !!(S.dir || pk.readwrite || pk.read || location.hash === '#/start' && !A.user);
    if (S.fsSupported && folderTried && (S.mode !== 'fs' || (perm && perm.write === 'denied'))) {
      tips.push(['Если папку выбрали, а браузер ничего не спросил — запись в файлы запрещена.', [
        'Откройте ', h('code', b.kind === 'edge' ? 'edge://settings/content/fileEditing' : 'chrome://settings/content/fileEditing'), ' (Настройки → Конфиденциальность и безопасность → Настройки сайтов → Дополнительные разрешения → «Изменение файлов»). Если в списке «Не разрешено» есть адрес курса (для локального файла — file:///), удалите его и попробуйте снова. Ещё способ: значок слева от адресной строки → «Сбросить разрешения».',
        h('br'), 'Если рядом написано «Управляется вашей организацией», запрет поставили администраторы. Посмотреть политики можно на странице ', h('code', b.kind === 'edge' ? 'edge://policy' : 'chrome://policy'), ': ищите ', h('code', 'DefaultFileSystemWriteGuardSetting'), ' (2 — запрет записи), ', h('code', 'DefaultFileSystemReadGuardSetting'), ' (2 — запрет чтения), ', h('code', 'FileSystemWriteBlockedForUrls'), '.']]);
      tips.push(['Что попросить у ИТ-отдела.', ['Разрешить курсу запрашивать доступ к папке: добавить адрес курса в политики ', h('code', 'FileSystemWriteAskForUrls'), ' и ', h('code', 'FileSystemReadAskForUrls'), '. Удобнее всего разместить папку курса на внутреннем веб-сервере (http://…) — тогда разрешение выдаётся одному адресу. Пока разрешения нет — режим «Только для чтения» (если запрещена только запись) или «Хранить в браузере».']]);
    }
    if (S.mode !== 'fs') tips.push(['Прогресс в браузере пропадает после закрытия?', [
      'Сделайте проверку: закройте ВСЕ окна браузера, откройте курс снова и запустите эту проверку. Если в строке «Данные курса между запусками» написано «первое открытие», браузер удаляет данные сайтов при закрытии. ',
      'Проверьте ', h('code', b.kind === 'edge' ? 'edge://settings/content/siteData' : 'chrome://settings/content/siteData'), ' — не должно быть включено «Удалять данные сайтов при закрытии всех окон». Если настройка «управляется организацией», посмотрите ', h('code', b.kind === 'edge' ? 'edge://policy' : 'chrome://policy'), ': ',
      h('code', 'DefaultCookiesSetting'), ' = 4 (данные только на время сеанса), ', h('code', 'CookiesSessionOnlyForUrls'), ', ', h('code', 'ClearBrowsingDataOnExitList'), ', ', h('code', 'ForceEphemeralProfiles'), ' (профиль удаляется при выходе), ', h('code', 'IncognitoModeAvailability'), ' = 2 (только инкогнито). ',
      h('br'), 'Что попросить у ИТ: разрешить хранить данные для адреса курса (политика ', h('code', 'CookiesAllowedForUrls'), '). Проще всего это сделать, если курс лежит на внутреннем веб-сервере (http://…). Пока запрет не снят — включите в профиле «Автокопию» и в начале занятия нажимайте «Восстановить из файла».']]);
    if (S.mode !== 'fs') tips.push(['Прогресс хранится отдельно для каждого браузера и учётной записи Windows.', 'Chrome и Edge — разные хранилища; на другом компьютере прогресса тоже не будет. Чтобы перенести его, скачайте копию в профиле и загрузите на стартовой странице («Восстановить из файла»).']);
    if (location.protocol === 'file:' && /^\/\/[^/]/.test(location.href.slice(5))) tips.push(['Курс открыт с сетевого диска.', 'Убедитесь, что у вашей учётной записи Windows есть право на изменение папки progress на этом диске.']);
    if (folderTried) tips.push(['Выбирайте именно папку курса.', 'Ту, где лежит index.html, — не корень диска, не «Рабочий стол», «Документы» или «Загрузки» целиком: такие папки браузер считает системными и не открывает.']);
    body.appendChild(h('h4', 'Что сделать'));
    body.appendChild(h('ol.steps-list', tips.map(function (x) { return h('li', h('b', x[0] + ' '), x[1]); })));
    body.appendChild(h('p.muted.small', 'Сделайте снимок экрана этого окна, если нужно показать проблему администратору.'));
  };

  function drawStart(area, state) {
    U.clear(area);
    var redraw = function (st) { drawStart(area, st); };
    var helpLink = h('p.center.small', h('a', { href: '#', onclick: function (e) { e.preventDefault(); A.diagnose(); } }, 'Не получается подключить папку? Проверка браузера'));
    if (state === 'need-folder') {
      var pickFolderBtn = async function () {
        try {
          var r = await S.pickFolder();
          if (!r.hasIndex && !S.hosted) U.toast('В выбранной папке нет index.html. Прогресс будет храниться в «' + U.esc(r.name) + '/progress». Если ошиблись папкой — смените её позже.', 'warn', 7000);
          if (S.idbProblem) U.toast('Браузер не запомнил папку — при следующем запуске её нужно будет выбрать снова.', 'warn', 6000);
          redraw('ready');
        } catch (e) { pickFailed(e, redraw); }
      };
      var opt = function (rec, icon, title, line, details, buttons) {
        return h('div.sc-opt' + (rec ? '.rec' : ''), h('div.sc-ic', I(icon, 24)), h('h3', title), h('p', line), U.more('Подробнее', details), buttons);
      };
      area.appendChild(h('div.card.pad',
        h('h2', 'Где хранить прогресс?'),
        h('p.muted', 'Выбор запоминается. Поменять можно в любой момент.'),
        h('div.store-choice',
          opt(true, 'globe', 'В этом браузере', 'Работает везде, даже при запретах организации.',
            h('ul.sc-list', h('li', 'сохраняется сам после каждого действия'), h('li', 'две копии: localStorage и IndexedDB'), h('li', 'история снимков — можно откатиться'), h('li', 'копия в файл одной кнопкой')),
            h('button.btn.primary.lg', { onclick: function () { S.useLocal(); redraw('local'); } }, 'Хранить в браузере')),
          S.hosted
            ? opt(false, 'folder', 'В папке на компьютере', 'Файлы прогресса в любой папке, например общей папке группы.',
              h('ul.sc-list', h('li', h('code', 'progress/<логин>.json'), ' в выбранной папке'), h('li', 'преподаватель видит сводку по группе'), h('li', 'браузер спросит разрешение — «Изменить файлы»')),
              h('div.row-btns', h('button.btn.lg', { onclick: pickFolderBtn }, 'Выбрать папку')))
            : opt(false, 'folder', 'В папке курса', 'Файлы рядом с курсом — удобно на общем диске.',
              h('ul.sc-list', h('li', h('code', 'progress/<логин>.json'), ' рядом с index.html'), h('li', 'преподаватель видит сводку по группе'), h('li', 'браузер спросит разрешение — «Изменить файлы»'), h('li', 'если запись запрещена — «Только для чтения»: базы из папки, прогресс в браузере')),
              h('div.row-btns',
                h('button.btn.lg', { onclick: pickFolderBtn }, 'Выбрать папку'),
                h('button.btn.ghost', { onclick: function () { pickRO(redraw); }, title: 'Учебные базы из папки, прогресс — в браузере' }, 'Только чтение')))),
        helpLink));
      return;
    }
    if (state === 'need-permission' || state === 'need-permission-ro') {
      var ro = state === 'need-permission-ro';
      area.appendChild(h('div.card.pad',
        h('h2', ro ? 'Разрешите чтение папки курса' : 'Разрешите доступ к папке курса'),
        h('p', 'Браузер просит подтвердить доступ к папке ', h('b', '«' + S.folderName() + '»'), ro ? ' для загрузки учебных баз.' : ' для сохранения прогресса.', ' Это нужно делать один раз за сеанс (в новых версиях Chrome можно выбрать «Разрешать при каждом посещении»).'),
        h('div.row-btns',
          h('button.btn.primary.lg', { onclick: async function () { var ok = false; try { ok = ro ? await S.regrantRO() : await S.regrant(); } catch (e) { } if (ok) redraw(ro ? 'ro' : 'ready'); else U.modal('Доступ не выдан', h('p', 'Браузер не разрешил доступ к папке. Если он даже не спросил разрешения — запрет стоит в настройках браузера. Откройте «Проверку браузера».'), [{ text: 'Проверка браузера', onclick: function () { setTimeout(A.diagnose, 50); } }, { text: 'Закрыть', primary: true }]); } }, 'Разрешить доступ'),
          h('button.btn.ghost', { onclick: function () { S.resetMode(); redraw('need-folder'); } }, 'Выбрать другую папку'),
          h('button.btn.ghost', { onclick: function () { S.useLocal(); redraw('local'); } }, 'Хранить в браузере')),
        helpLink));
      return;
    }
    // ready / local
    A.packsReady = P.load().catch(function (e) { console.error(e); U.toast('Не удалось загрузить учебные базы: ' + U.esc(e.message), 'err', 7000); });
    area.appendChild(storageNote());
    var usersBox = h('div.card.pad', h('h2', 'Кто занимается?'));
    var list = h('div.user-list'); usersBox.appendChild(list);
    area.appendChild(usersBox);
    var restoreInp = h('input', { type: 'file', multiple: true, accept: '.json,application/json', style: { display: 'none' } });
    restoreInp.addEventListener('change', async function () { var fl = Array.prototype.slice.call(restoreInp.files); restoreInp.value = ''; if (fl.length) await restoreFromFiles(fl, function () { redraw(state); }); });
    usersBox.appendChild(restoreInp);
    S.listUsers().then(function (users) {
      var lastId = null; try { lastId = localStorage.getItem('sqlkurs.lastUser'); } catch (e) { }
      var last = users.filter(function (x) { return x.id === lastId; })[0];
      if (last) usersBox.insertBefore(h('button.btn.primary.lg.continue-btn', { onclick: function () { login(last); } }, 'Продолжить как ' + last.name + ' →'), list);
      if (users.length) usersBox.appendChild(h('div.row-btns.small-gap', h('button.btn.small.ghost', { onclick: function () { restoreInp.click(); }, title: 'Загрузить файлы прогресса (.json), скачанные раньше. Можно выбрать несколько.' }, I('upload', 16), 'Восстановить из файла')));
      if (S.recovered) U.toast('Прогресс восстановлен из резервной копии браузера (' + S.recovered + ')', 'ok', 5000);
      if (!users.length) {
        list.appendChild(h('p.muted', 'Пока нет ни одной учётной записи. Создайте свою ниже.'));
        if (S.mode !== 'fs') usersBox.insertBefore(U.note('', 'history', h('b', 'Уже занимались? '), h('a', { href: '#', onclick: function (e) { e.preventDefault(); restoreInp.click(); } }, 'Восстановите прогресс из файла'),
          U.more('Почему список пуст', h('div.small', 'Курс открыт в другом браузере (Chrome и Edge хранят данные отдельно), под другой учётной записью Windows — или браузер удалил данные сайтов при закрытии. Загрузите скачанную копию прогресса. ', h('a', { href: '#', onclick: function (e) { e.preventDefault(); A.diagnose(); } }, 'Проверка браузера')))), list.nextSibling);
      }
      users.forEach(function (u) {
        var r = A.rank(u.xp || 0);
        list.appendChild(h('button.user-card', { onclick: function () { login(u); } },
          h('div.avatar', initials(u.name)),
          h('div.uc-info', h('div.uc-n', u.name), h('div.muted', r.name + ' · ' + (u.xp || 0) + ' XP' + (u.dept ? ' · ' + u.dept : ''))),
          u.pinHash ? h('span.lock', { title: 'Защищено PIN-кодом' }, I('lock', 16)) : null));
      });
    }).catch(function (e) {
      console.error(e);
      list.appendChild(h('div.err-box', 'Не удалось прочитать список учеников: ' + (e && e.message || e) + '. Обновите страницу; если папка курса недоступна — подключите её заново.'));
    });
    var name = h('input.inp', { placeholder: 'Фамилия и имя, например: Асанова Айгуль', maxlength: 60 });
    var login1 = h('input.inp', { placeholder: 'логин (латиница) — имя файла прогресса', maxlength: 40 });
    var dept = h('input.inp', { placeholder: 'Отдел (необязательно)', maxlength: 60 });
    var pin = h('input.inp', { placeholder: 'PIN 4–6 цифр (необязательно)', maxlength: 6, inputmode: 'numeric', type: 'password' });
    var auto = true;
    name.addEventListener('input', function () { if (auto) login1.value = U.slug(name.value); });
    login1.addEventListener('input', function () { auto = false; });
    area.appendChild(h('div.card.pad',
      h('h2', 'Новая учётная запись'),
      h('div.form-grid', h('label', 'Как вас зовут', name), h('label', 'Логин', login1), h('label', 'Отдел', dept), h('label', 'PIN-код', pin)),
      h('p.muted.small', 'PIN только защищает от случайного входа под чужим именем на общем компьютере. Это не настоящая защита данных.'),
      h('button.btn.primary.lg', {
        onclick: async function () {
          var nm = name.value.trim();
          var id = U.slug(login1.value || nm);
          if (nm.length < 2) { U.toast('Введите имя', 'warn'); return; }
          if (pin.value && !/^\d{4,6}$/.test(pin.value)) { U.toast('PIN — это 4–6 цифр', 'warn'); return; }
          if (await S.exists(id)) { U.toast('Логин «' + id + '» уже занят. Придумайте другой.', 'warn'); return; }
          var u = newUser(nm, id, dept.value.trim(), pin.value ? await U.hash(pin.value) : null);
          try { await S.saveNow(u); } catch (e) { U.toast('Не удалось сохранить файл: ' + U.esc(e.message), 'err', 7000); return; }
          enter(u, true);
        }
      }, 'Создать и начать')));
    if (S.mode === 'fs') area.appendChild(h('p.muted.small.center', 'Файл будет создан: ', h('code', S.folderName() + '/progress/<логин>.json')));
  }

  // Загрузить файлы прогресса в хранилище (новее — заменяет, старее — пропускается)
  async function restoreFromFiles(files, redraw) {
    var ok = [], skip = [], bad = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i], data;
      try { data = JSON.parse(await f.text()); } catch (e) { bad.push(f.name + ': не JSON'); continue; }
      if (!data || !data.id || !data.items || !data.name) { bad.push(f.name + ': это не файл прогресса курса'); continue; }
      data.id = U.slug(data.id) || data.id;
      var cur = await S.load(data.id);
      if (cur && String(cur.updated || '') > String(data.updated || '') && (cur.xp || 0) >= (data.xp || 0)) { skip.push(data.name + ' — в курсе данные новее (' + U.fmtDate(cur.updated) + ')'); continue; }
      if (cur) data.rev = Math.max(cur.rev || 0, data.rev || 0);
      try { await S.saveNow(data); await S.snapshotNow(data); ok.push(data.name + ' · ' + (data.xp || 0) + ' XP · копия от ' + U.fmtDate(data.updated)); } catch (e) { bad.push(f.name + ': ' + e.message); }
    }
    var body = h('div',
      ok.length ? h('div', h('p', h('b', 'Восстановлено: ')), h('ul', ok.map(function (x) { return h('li', x); }))) : null,
      skip.length ? h('div', h('p.muted', 'Пропущено:'), h('ul.muted', skip.map(function (x) { return h('li', x); }))) : null,
      bad.length ? h('div.fb.bad', bad.map(function (x) { return h('div', x); })) : null,
      ok.length && S.launch.fresh && S.mode !== 'fs' ? h('p.store-note.warn', 'Если вы занимались на этом же компьютере в этом же браузере, а курс вас «забыл» — браузер удаляет данные сайтов при закрытии (так бывает из-за политики организации). Пока это не исправят, скачивайте копию в конце каждого занятия или включите автокопию в профиле. Подробнее — «Проверка браузера».') : null);
    U.modal('Восстановление прогресса', body, ok.length && S.launch.fresh ? [{ text: 'Проверка браузера', onclick: function () { setTimeout(A.diagnose, 50); } }, { text: 'Готово', primary: true }] : null);
    if (redraw) redraw();
  }

  async function login(u) {
    var fresh = await S.load(u.id) || u;
    if (fresh.pinHash) {
      var inp = h('input.inp', { type: 'password', inputmode: 'numeric', maxlength: 6, placeholder: 'PIN' });
      var md = U.modal('Вход: ' + fresh.name, h('div', h('p', 'Введите PIN-код'), inp), [{ text: 'Отмена' }, {
        text: 'Войти', primary: true, onclick: async function (close) {
          if (await U.checkPin(inp.value, fresh.pinHash)) {
            // хеш старого образца (без crypto.subtle) заменяем на обычный — он одинаков в любом окружении
            if (String(fresh.pinHash).length < 20) fresh.pinHash = await U.hash(inp.value);
            close(); enter(fresh);
          }
          else { U.toast('Неверный PIN', 'err'); inp.value = ''; inp.focus(); }
          return false;
        }
      }]);
      setTimeout(function () { inp.focus(); }, 50);
      inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') U.qs('.modal .btn.primary', md.el).click(); });
      return;
    }
    enter(fresh);
  }
  // Привести данные ученика к текущему формату; терпимо к неполным и повреждённым файлам
  function migrate(u) {
    var d = newUser(u.name, u.id);
    for (var k in d) {
      var dv = d[k], uv = u[k];
      var isObj = dv !== null && typeof dv === 'object';
      if (uv === undefined || (isObj && (uv === null || typeof uv !== 'object' || Array.isArray(uv) !== Array.isArray(dv)))) { u[k] = dv; continue; }
      if (isObj && !Array.isArray(dv)) for (var s in dv) if (uv[s] === undefined || (typeof dv[s] === 'number' && typeof uv[s] !== 'number')) uv[s] = dv[s];
    }
    if (typeof u.xp !== 'number' || !isFinite(u.xp)) u.xp = 0;
    if (typeof u.name !== 'string' || !u.name) u.name = String(u.name || u.id || 'Ученик');
    return u;
  }
  async function enter(u, isNew) {
    if (A.packsReady) await A.packsReady;
    if (!P.loaded) await P.load();
    S.claim(u.id);
    A.user = migrate(u);
    A.user.lastSeen = new Date().toISOString();
    A.touchStreak();
    A.applyTheme();
    A.checkAchievements();
    A.save();
    try { localStorage.setItem('sqlkurs.lastUser', u.id); } catch (e) { }
    if (isNew) { A.log('Учётная запись создана'); A.go('#/home'); U.toast('Добро пожаловать, ' + U.esc(u.name) + '! Начните с модуля 1.', 'ok', 5000); }
    else A.go(u.last && u.last !== '#/start' ? u.last : '#/home');
    if (P.failed.length) setTimeout(function () { U.toast('Не все учебные базы загрузились (' + P.failed.length + '). Подробности — в разделе «Базы».', 'warn', 6000); }, 800);
  }
  A.logout = function () { if (A.user && !S.paused) { S.save(A.user); S.flush(); } S.release(); A.user = null; A.renderTop(); location.hash = '#/start'; };

  // Курс открыли под этим же пользователем в другой вкладке — эта вкладка встаёт на паузу
  S.onTakenOver = function () {
    if (U.qs('.lock-ov')) return;
    var ov = h('div.modal-ov.lock-ov', h('div.modal', h('div.modal-head', h('h3', 'Курс открыт в другой вкладке')),
      h('div.modal-body', h('p', 'Вы продолжили заниматься под именем «' + (A.user ? A.user.name : '') + '» в другой вкладке или окне. Чтобы два окна не затёрли прогресс друг друга, эта вкладка остановлена и ничего не сохраняет.'), h('p.muted', 'Закройте её или нажмите «Продолжить здесь» — тогда остановится другая.')),
      h('div.modal-foot', h('button.btn.primary', {
        onclick: async function () {
          var u = null;
          try { u = A.user ? await S.load(A.user.id) : null; } catch (e) { console.error(e); }
          ov.remove();
          if (u) { S.claim(u.id); A.user = migrate(u); A.applyTheme(); A.renderTop(); A.dispatch(); U.toast('Продолжаем здесь. Прогресс из другой вкладки загружен.', 'ok'); }
          else { U.toast('Не удалось загрузить прогресс — войдите заново', 'warn', 5000); A.logout(); }
        }
      }, 'Продолжить здесь'))));
    document.body.appendChild(ov);
  };

  S.onError = function (e) { U.toast('Не удалось сохранить прогресс: ' + U.esc(e.message) + '. Проверьте доступ к папке.', 'err', 7000); };

  /* ================= Главная (курс) ================= */
  A.setState = function (set) {
    var done = set.tasks.filter(function (t) { return A.isDone(t.id); }).length;
    return { done: done, total: set.tasks.length, pct: set.tasks.length ? Math.round(done * 100 / set.tasks.length) : 0 };
  };
  A.route(/^#\/home$/, function (view) {
    var u = A.user, page = h('div.page'); view.appendChild(page);
    var r = A.rank(u.xp), st = A.achStats();
    var active = A.activePacks();
    var lessons = A.allLessons();
    var doneL = lessons.filter(function (x) { return A.lessonState(x.l).complete; }).length;
    var hwAll = 0, hwDone = 0;
    A.modules().forEach(function (m) { (m.homework || []).forEach(function (t) { hwAll++; if (A.isDone(t.id)) hwDone++; }); });
    // продолжить: первый незавершённый урок
    var cont = lessons.filter(function (x) { return !A.lessonState(x.l).complete; })[0];
    var hero = h('div.hero',
      h('div.hero-l',
        h('h1', 'Привет, ' + u.name.split(' ').slice(-1)[0] + '!'),
        h('p', doneL ? 'Продолжайте с того места, где остановились.' : 'Начните с первого урока — это займёт 10–15 минут.'),
        cont ? h('a.btn.primary.lg', { href: A.lessonHref(cont.m, cont.i), 'data-guide': 'continue' }, (doneL ? 'Продолжить: ' : 'Начать: ') + (active.length > 1 ? A.pack(cont.m.pack).title + ', ' : '') + 'модуль ' + cont.m.num + ', урок ' + (cont.i + 1)) : h('a.btn.primary.lg', { href: '#/trainer' }, lessons.length ? 'Уроки пройдены! Перейти в тренажёр' : 'Перейти в тренажёр')),
      h('div.hero-stats', { 'data-guide': 'stats' },
        stat(r.name, 'ранг', r.next ? 'до «' + r.nextName + '»: ' + (r.next - u.xp) + ' XP' : 'максимальный'),
        stat(String(u.xp), 'XP', ''),
        stat(doneL + '/' + lessons.length, 'уроков', ''),
        stat(hwDone + '/' + hwAll, 'домашних заданий', ''),
        stat(st.trainer + '/' + st.trainerAll, 'задач тренажёра', ''),
        stat(String(u.streak.days), U.plural(u.streak.days, 'день', 'дня', 'дней') + ' подряд', 'рекорд: ' + (u.streak.best || u.streak.days))));
    if (A.backupDue(u)) {
      var bn = U.note('warn.backup-note', 'download', h('b', 'Сохраните копию прогресса'), h('div.small.muted', u.backup ? 'Последняя копия: ' + U.fmtDate(u.backup.at) : 'Копий ещё не было'),
        h('div.row-btns.small-gap', h('button.btn.small.primary', { onclick: function () { A.backupFile(u); bn.remove(); } }, I('download', 16), 'Скачать'), h('a.btn.small.ghost', { href: '#/profile' }, 'Автокопия')));
      page.appendChild(bn);
    }
    page.appendChild(hero);
    if (G.Guide) G.Guide.offer(page);   // при первом входе — предложение короткой экскурсии
    active.forEach(function (p) {
      var cnt = PF.counts(p);
      page.appendChild(h('div.pack-h', { 'data-guide': 'pack-head' },
        I.pack(p, 'lg'),
        h('div.pack-ht', h('h2', p.title), h('div.muted.small', 'база ' + p.dbName + ' · ' + cnt.tables + ' ' + U.plural(cnt.tables, 'таблица', 'таблицы', 'таблиц') + (cnt.trainer ? ' · тренажёр: ' + cnt.trainer : ''))),
        h('div.pack-links', h('a.btn.small', { href: '#/schema/' + p.id, title: 'Схема базы' }, I('schema', 16), 'Схема'), h('a.btn.small', { href: '#/sandbox/' + p.id, title: 'Песочница' }, I('terminal', 16), 'Песочница'), cnt.trainer ? h('a.btn.small', { href: '#/trainer/0/' + p.id, title: 'Тренажёр' }, I('target', 16), 'Тренажёр') : null)));
      var mods = A.packModules(p);
      if (mods.length) {
        var grid = h('div.mod-grid', { 'data-guide': 'modules' });
        mods.forEach(function (m) {
          var ms = A.moduleState(m), unlocked = A.isUnlocked(m);
          grid.appendChild(h(unlocked ? 'a.mod-card' : 'div.mod-card.locked', unlocked ? { href: A.modHref(m) } : { title: 'Откроется после уроков предыдущего модуля' },
            h('div.mod-top', h('span.mod-num', String(m.num)), ms.complete ? h('span.badge.ok', 'пройден') : (ms.pct ? h('span.badge', ms.pct + '%') : null)),
            h('div.mod-title', m.title),
            h('div.mod-desc', m.short || ''),
            h('div.mod-meta', ms.lessonsDone + '/' + ms.lessons + ' уроков' + (ms.hw ? ' · ДЗ ' + ms.hwDone + '/' + ms.hw : '')),
            h('div.pbar', h('div', { style: { width: ms.pct + '%' } }))));
        });
        page.appendChild(grid);
      }
      if (p.sets.length) {
        if (mods.length) page.appendChild(h('h3.sub', 'Практикум'));
        var sg = h('div.mod-grid');
        p.sets.forEach(function (set) {
          var ss = A.setState(set);
          sg.appendChild(h('a.mod-card.set', { href: '#/set/' + encodeURIComponent(set.id) },
            h('div.mod-top', h('span.mod-num.set', I('edit', 17)), ss.done === ss.total && ss.total ? h('span.badge.ok', 'решено') : (ss.done ? h('span.badge', ss.pct + '%') : null)),
            h('div.mod-title', set.title),
            h('div.mod-desc', set.short || ''),
            h('div.mod-meta', 'задач: ' + ss.done + '/' + ss.total),
            h('div.pbar', h('div', { style: { width: ss.pct + '%' } }))));
        });
        page.appendChild(sg);
      }
      if (!mods.length && !p.sets.length) page.appendChild(h('p.muted', cnt.trainer ? 'Задачи этой базы — в тренажёре. Свободные запросы — в песочнице.' : 'В этой базе пока нет заданий — изучайте её в песочнице.'));
    });
    var others = P.all().filter(function (p) { return active.indexOf(p) < 0; });
    if (others.length) page.appendChild(h('div.card.pad.more-packs', h('b', 'Доступны и другие учебные базы: '), others.map(function (p) { return p.title; }).join(', '), ' ', h('a.btn.small', { href: '#/packs' }, 'Выбрать базы →')));
    // достижения и журнал
    var achBox = h('div.card.pad', { 'data-guide': 'home-ach' }, h('div.card-head', h('h3', 'Достижения'), h('a', { href: '#/ach' }, 'все →')));
    var achRow = h('div.ach-row');
    C.achievements.forEach(function (a) { achRow.appendChild(h('div.ach-mini' + (u.ach[a.id] ? '.got' : ''), { title: a.title + ' — ' + a.desc }, G.Icon.ach(a.id, 20))); });
    achBox.appendChild(achRow);
    var logBox = h('div.card.pad', h('h3', 'Последние события'));
    (u.log || []).slice(0, 8).forEach(function (l) { logBox.appendChild(h('div.log-row', h('span.muted', U.fmtDate(l.at)), ' ', l.t)); });
    if (!(u.log || []).length) logBox.appendChild(h('p.muted', 'Здесь появится история ваших успехов.'));
    page.appendChild(h('div.two-col', achBox, logBox));
    function stat(v, l, sub) { return h('div.hs', h('div.hs-v', v), h('div.hs-l', l), sub ? h('div.hs-s', sub) : null); }
  });

  /* ================= Достижения ================= */
  A.route(/^#\/ach$/, function (view) {
    var page = h('div.page', h('h1', 'Достижения'));
    var grid = h('div.ach-grid');
    C.achievements.forEach(function (a) {
      var got = A.user.ach[a.id];
      grid.appendChild(h('div.ach-card' + (got ? '.got' : ''), h('div.ach-ic', G.Icon.ach(a.id, 24)), h('div', h('div.ach-t', a.title), h('div.muted', a.desc), got ? h('div.small.ok-t', 'получено ' + U.fmtDate(got)) : h('div.small.muted', 'ещё не получено'))));
    });
    page.appendChild(grid);
    view.appendChild(page);
  });

  /* ================= Профиль ================= */
  A.route(/^#\/profile$/, function (view) {
    var u = A.user, page = h('div.page'); view.appendChild(page);
    var r = A.rank(u.xp);
    page.appendChild(h('h1', 'Профиль'));
    page.appendChild(h('div.card.pad',
      h('div.prof-head', h('div.avatar.big', initials(u.name)), h('div', h('h2', u.name), h('div.muted', 'Логин: ' + u.id + (u.dept ? ' · ' + u.dept : '')), h('div', r.name + ' · ' + u.xp + ' XP'))),
      h('table.kv', { 'data-guide': 'prof-storage' },
        h('tr', h('td', 'Где хранится прогресс'), h('td', h('code', S.where(u)))),
        h('tr', h('td', 'Последнее сохранение'), h('td', S.lastSaved ? U.fmtDate(S.lastSaved) : '—')),
        h('tr', h('td', 'Создан'), h('td', U.fmtDate(u.created))),
        h('tr', h('td', 'Запусков запросов'), h('td', String(u.stats.runs) + ' (с ошибкой: ' + u.stats.errors + ')')),
        h('tr', h('td', 'Решено заданий'), h('td', String(u.stats.solved) + ' (с первой попытки: ' + u.stats.firstTry + ')')),
        h('tr', h('td', 'Лучшая серия дней'), h('td', String(u.streak.best || 0))))));
    var wideCb = h('input', { type: 'checkbox' }); wideCb.checked = A.pref('wide') === '1';
    wideCb.addEventListener('change', function () { A.setPref('wide', wideCb.checked ? '1' : '0'); window.dispatchEvent(new Event('resize')); });
    var bgCb = h('input', { type: 'checkbox' }); bgCb.checked = !!(G.Backdrop && G.Backdrop.active);
    bgCb.addEventListener('change', function () { A.setPref('bg', bgCb.checked ? 'on' : 'off'); });
    page.appendChild(h('div.card.pad.appearance', { 'data-guide': 'prof-look' }, h('h3', 'Оформление'),
      h('div.ap-row', h('span.ap-cap', 'Тема'), A.themeSwitch()),
      h('div.ap-cap', 'Палитра'),
      A.palettePicker(),
      h('p.muted.small', 'Палитру и тему можно сменить в любой момент — кнопкой с палитрой вверху страницы.'),
      h('label.check', wideCb, h('span', 'Интерфейс во всю ширину экрана', h('small', 'иначе содержимое стоит по центру; на компьютере переключается и кнопкой ↔ вверху'))),
      h('label.check', bgCb, h('span', 'Анимация фона', h('small', 'фон за карточками плавно движется и отзывается на прокрутку и курсор; на слабом компьютере можно выключить')))));
    if (G.Guide) page.appendChild(G.Guide.profileCard());
    var fileInp = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    fileInp.addEventListener('change', async function () {
      var f = fileInp.files[0]; fileInp.value = ''; if (!f) return;
      try {
        var data = JSON.parse(await f.text());
        if (!data || typeof data !== 'object' || !data.id || !data.items || typeof data.items !== 'object') throw new Error('это не файл прогресса курса');
        if (data.id !== u.id && !(await U.confirm('Импорт', 'Файл принадлежит пользователю «' + U.esc(data.name) + '». Заменить ваш прогресс его данными?', 'Заменить'))) return;
        if (A.user !== u) return;   // пока выбирали файл, вышли из учётной записи
        await S.snapshotNow(u);     // текущее состояние остаётся в «Копиях в браузере»
        data.id = u.id; data.name = u.name; data.pinHash = u.pinHash;
        data.rev = Math.max(u.rev || 0, data.rev || 0);
        A.user = migrate(data); A.applyTheme(); A.save(); U.toast('Прогресс загружен. Прежнее состояние — в «Копиях в браузере»', 'ok', 5000); A.dispatch();
      } catch (e) { U.toast('Не удалось загрузить: ' + U.esc(e.message), 'err'); }
    });
    var autoCb = h('input', { type: 'checkbox' }); autoCb.checked = !!u.settings.autoBackup;
    autoCb.addEventListener('change', function () { u.settings.autoBackup = autoCb.checked; A.save(); U.toast(autoCb.checked ? 'Автокопия включена: раз в день курс сам сохранит файл в «Загрузки»' : 'Автокопия выключена', 'ok'); });
    page.appendChild(h('div.card.pad', { 'data-guide': 'backup' }, h('h3', 'Резервная копия в файл'),
      h('p.muted', 'Файл прогресса нужен, чтобы перенести его на другой компьютер, передать преподавателю или восстановить, если браузер очистил данные. ' + (u.backup ? 'Последняя копия: ' + U.fmtDate(u.backup.at) + '.' : 'Копий ещё не было.')),
      h('div.row-btns',
        h('button.btn.primary', { onclick: function () { A.backupFile(u); A.dispatch(); } }, I('download', 18), 'Скачать копию'),
        h('button.btn', { onclick: function () { fileInp.click(); } }, 'Загрузить из файла'), fileInp),
      S.mode === 'fs' ? null : h('label.inline.mt', autoCb, ' Автокопия: раз в день сохранять файл в папку «Загрузки» (если браузер очищает данные при закрытии — включите обязательно)')));
    var snapBox = h('div.card.pad', { 'data-guide': 'snapshots' }, h('h3', 'Копии в браузере'), h('p.muted', 'Курс сам делает снимок прогресса не реже раза в 15 минут занятий и хранит 30 последних. Можно вернуться к любому — например, после случайного сброса.'));
    var snapList = h('div', h('p.muted', 'Загружаю…')); snapBox.appendChild(snapList);
    page.appendChild(snapBox);
    S.snapshots(u.id).then(function (snaps) {
      U.clear(snapList);
      if (!snaps.length) { snapList.appendChild(h('p.muted', 'Снимков пока нет.')); return; }
      var t = h('table.grid-t.snap-t', h('tr', h('th', 'Когда'), h('th', 'XP'), h('th', 'Решено'), h('th', '')));
      snaps.slice(0, 30).forEach(function (sn) {
        t.appendChild(h('tr', h('td', U.fmtDate(sn.at)), h('td', String(sn.xp)), h('td', String(sn.solved)), h('td', h('button.btn.small', {
          onclick: async function () {
            if (!(await U.confirm('Вернуть прогресс?', 'Прогресс станет таким, каким был ' + U.esc(U.fmtDate(sn.at)) + ' (' + sn.xp + ' XP). Текущее состояние тоже сохранится в истории — к нему можно будет вернуться.', 'Вернуть'))) return;
            await S.snapshotNow(A.user);
            var d = JSON.parse(JSON.stringify(sn.data)); d.id = u.id; d.name = u.name; d.pinHash = u.pinHash; d.rev = u.rev;
            A.user = migrate(d); A.save(); A.renderTop(); U.toast('Прогресс возвращён к ' + U.esc(U.fmtDate(sn.at)), 'ok'); A.dispatch();
          }
        }, 'Вернуть'))));
      });
      snapList.appendChild(t);
    });
    var pin = h('input.inp', { type: 'password', inputmode: 'numeric', maxlength: 6, placeholder: 'новый PIN (пусто — убрать)' });
    page.appendChild(h('div.card.pad', { 'data-guide': 'pin' }, h('h3', 'PIN-код'), h('div.row-btns', pin, h('button.btn', {
      onclick: async function () {
        if (pin.value && !/^\d{4,6}$/.test(pin.value)) { U.toast('PIN — 4–6 цифр', 'warn'); return; }
        u.pinHash = pin.value ? await U.hash(pin.value) : null; A.save(); pin.value = ''; U.toast(u.pinHash ? 'PIN установлен' : 'PIN убран', 'ok');
      }
    }, 'Сохранить'))));
    page.appendChild(h('div.row-btns', { 'data-guide': 'prof-actions' },
      h('button.btn', { onclick: A.logout }, 'Выйти (сменить пользователя)'),
      h('a.btn', { href: '#/team' }, 'Сводка по группе'),
      h('a.btn', { href: '#/packs' }, 'Учебные базы'),
      h('button.btn.danger', {
        onclick: async function () {
          if (!(await U.confirm('Сбросить прогресс', 'Весь прогресс, XP и достижения будут удалены. Вернуть их можно будет в профиле, в разделе «Копии в браузере». Продолжить?', 'Сбросить'))) return;
          await S.snapshotNow(u);
          var fresh = newUser(u.name, u.id, u.dept, u.pinHash); fresh.created = u.created; fresh.rev = u.rev; fresh.settings = u.settings;
          A.user = fresh; A.touchStreak(); A.save(); U.toast('Прогресс сброшен', 'ok'); A.go('#/home');
        }
      }, 'Сбросить прогресс')));
  });

  /* ================= Сводка по группе (для преподавателя) ================= */
  A.route(/^#\/team$/, function (view) {
    var page = h('div.page', h('h1', 'Сводка по группе'), h('div.intro-row', h('p.muted', 'Прогресс учеников: из папки прогресса или из загруженных файлов.'), U.info('Как собрать сводку', function () { return h('p', 'Учётные записи из папки прогресса курса. Если папка курса лежит на общем сетевом диске, здесь видно продвижение всей группы. Если запись в папку запрещена, ученики выгружают прогресс в профиле («Скачать прогресс»), а вы загружаете эти файлы кнопкой ниже. «Уроки» и «ДЗ» — по основному курсу (Учебный банк), «Задачи по базам» — решено задач практикума и тренажёра в каждой базе.'); })));
    view.appendChild(page);
    var holder = h('div'); page.appendChild(holder);
    var extra = {};
    var filesInp = h('input', { type: 'file', multiple: true, accept: '.json,application/json', style: { display: 'none' } });
    var dirInp = h('input', { type: 'file', webkitdirectory: true, multiple: true, style: { display: 'none' } });
    async function addFiles(list) {
      var n = 0;
      for (var i = 0; i < list.length; i++) {
        if (!/\.json$/i.test(list[i].name)) continue;
        try { var d = JSON.parse(await list[i].text()); if (d && d.id && d.items) { extra[d.id] = d; n++; } } catch (e) { }
      }
      U.toast('Загружено файлов прогресса: ' + n, n ? 'ok' : 'warn');
      draw();
    }
    filesInp.addEventListener('change', function () { addFiles(filesInp.files); filesInp.value = ''; });
    dirInp.addEventListener('change', function () { addFiles(dirInp.files); dirInp.value = ''; });
    page.appendChild(h('div.row-btns', h('button.btn', { onclick: function () { filesInp.click(); } }, 'Загрузить файлы прогресса (.json)'), h('button.btn', { onclick: function () { dirInp.click(); } }, 'Выбрать папку с файлами'), filesInp, dirInp));
    async function gather() {
      var all = {}, add = function (u) { if (!u || !u.id) return; var cur = all[u.id]; if (!cur || String(u.updated || '') > String(cur.updated || '')) all[u.id] = u; };
      (await S.listUsers()).forEach(add);
      if (S.mode !== 'fs' && S.dir) (await S.folderUsers()).forEach(add);
      Object.keys(extra).forEach(function (k) { add(extra[k]); });
      return Object.keys(all).map(function (k) { return all[k]; }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    }
    async function draw() {
      var users = await gather();
      U.clear(holder);
      var bank = A.pack('bank'), bankMods = A.packModules(bank);
      var lessonsAll = A.allLessons(bankMods);
      var packs = P.all();
      var packTasks = packs.map(function (p) {
        var ids = p.trainer.map(function (t) { return t.id; });
        p.sets.forEach(function (s) { s.tasks.forEach(function (t) { ids.push(t.id); }); });
        return ids;
      });
      var rows = users.map(function (u) {
        var items = u.items || {};
        var done = function (id) { return items[id] && items[id].ok; };
        var lessonsDone = lessonsAll.filter(function (x) { return u.lessons && u.lessons[x.l.id] && u.lessons[x.l.id].done; }).length;
        var hw = 0, hwAll = 0; bankMods.forEach(function (m) { (m.homework || []).forEach(function (t) { hwAll++; if (done(t.id)) hw++; }); });
        var perPack = packs.map(function (p, i) { return p.dbName + ' ' + packTasks[i].filter(done).length + '/' + packTasks[i].length; }).join(', ');
        var actIds = P.activeIds(u);
        return [u.name, u.dept || '', String(u.xp || 0), A.rank(u.xp || 0).name, String((u.stats && u.stats.solved) || 0), lessonsDone + '/' + lessonsAll.length, hw + '/' + hwAll, perPack, packs.filter(function (p) { return actIds.indexOf(p.id) >= 0; }).map(function (p) { return p.title; }).join(', '), U.fmtDate(u.updated || u.lastSeen)];
      });
      var cols = ['Сотрудник', 'Отдел', 'XP', 'Ранг', 'Решено задач', 'Уроки', 'ДЗ', 'Задачи по базам', 'Изучает базы', 'Обновлено'];
      if (!rows.length) { holder.appendChild(h('p.muted', 'Пока нет данных. Загрузите файлы прогресса учеников.')); return; }
      holder.appendChild(G.Grid.table(cols, rows, null, { max: 1000 }));
      holder.appendChild(h('div.row-btns', h('button.btn', {
        onclick: function () {
          var csv = '\uFEFF' + [cols].concat(rows).map(function (r) { return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(';'); }).join('\r\n');
          U.download('svodka_po_gruppe.csv', csv, 'text/csv;charset=utf-8');
        }
      }, 'Скачать CSV для Excel')));
    }
    draw();
  });

  /* ================= Старт приложения ================= */
  A.start = function () {
    A.applyTheme();
    if (!C.modules.length) { U.qs('#view').appendChild(h('div.page', h('div.err-box', 'Не найдены файлы модулей курса (папка content/modules).'))); return; }
    // если адрес уже #/start, событие hashchange не придёт — рисуем сами; иначе страницу нарисует оно
    if (location.hash === '#/start') A.dispatch(); else location.hash = '#/start';
  };
  window.addEventListener('beforeunload', function (e) {
    if (!A.user) return;
    if (S.mode === 'fs') {
      // Запись в файл асинхронная: если она ещё идёт — попросим браузер подождать
      if (S.hasPending()) { S.flush(); e.preventDefault(); e.returnValue = ''; }
    } else if (!S.paused) { S.saveSync(A.user); }
  });
  window.addEventListener('pagehide', function () { if (A.user && S.mode !== 'fs' && !S.paused) S.saveSync(A.user); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && A.user) S.flush(); });
})(window);
