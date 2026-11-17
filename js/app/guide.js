/* Подсказки и обучение интерфейсу (глобальный объект Guide).
   Тексты — в content/guide.js (window.GUIDE), здесь только механика:
     — экскурсия: подсветка элемента страницы и пояснение рядом, шаги «Назад / Далее»;
     — метки-подсказки: номера на всех элементах страницы сразу, по нажатию — пояснение;
     — меню «Помощь» (кнопка «?») и предложение знакомства при первом входе;
     — страница «О курсе» (#/help) и окно «О курсе» на странице входа;
     — единые всплывающие подписи вместо системных (атрибут title).
   Шаг экскурсии привязан к элементу меткой data-guide="…" (или селектором CSS). Элемента нет на странице — шаг пропускается.
   Что уже показано, хранится в прогрессе ученика: settings.guide = { seen: {id: 1}, peek: {id: 1}, offered, off }. */
(function (G) {
  'use strict';
  var U = G.U, h = U.h, I = G.Icon, A = G.App, C = G.COURSE;
  var D = G.GUIDE || { tours: [], help: {} };
  var Guide = G.Guide = {};
  var byId = {};
  (D.tours || []).forEach(function (t) { byId[t.id] = t; if (t.page) t.re = new RegExp(t.page); });
  Guide.tours = D.tours || [];

  function mobile() { return window.innerWidth < 1024; }
  function calm() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function state() {
    var u = A.user; if (!u) return null;
    var g = u.settings.guide;
    if (!g || typeof g !== 'object') g = u.settings.guide = {};
    if (!g.seen) g.seen = {};
    if (!g.peek) g.peek = {};
    return g;
  }

  /* ---------------- поиск элементов ---------------- */
  function selector(at) { return /^[.#\[]/.test(at) ? at : '[data-guide="' + at + '"]'; }
  function shown(el) {
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return false;
    if (r.right <= 0 || r.left >= window.innerWidth) return false;   // например, выдвижное меню за краем экрана
    var cs = getComputedStyle(el);
    return cs.visibility !== 'hidden' && cs.display !== 'none';
  }
  // Видимая часть элемента: то, что не обрезано прокручиваемыми областями (широкая таблица внутри своей рамки и т. п.)
  function box(el) {
    var r = el.getBoundingClientRect(), L = r.left, T = r.top, R = r.right, B = r.bottom;
    for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      var cs = getComputedStyle(p);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      var q = p.getBoundingClientRect();
      if (cs.overflowX !== 'visible') { L = Math.max(L, q.left); R = Math.min(R, q.right); }
      if (cs.overflowY !== 'visible') { T = Math.max(T, q.top); B = Math.min(B, q.bottom); }
    }
    return { left: L, top: T, right: Math.max(L, R), bottom: Math.max(T, B), width: Math.max(0, R - L), height: Math.max(0, B - T) };
  }
  function find(step) {
    if (!step.at) return null;
    var list = document.querySelectorAll(selector(step.at));
    for (var i = 0; i < list.length; i++) if (!list[i].closest('.guide, .guide-marks, .modal-ov') && shown(list[i])) return list[i];
    return null;
  }
  // Шаги, которые можно показать сейчас: подходят по виду экрана, а элемент (если шаг к нему привязан) есть на странице
  function usable(t) {
    var m = mobile();
    return t.steps.filter(function (s) {
      if (s.only === 'desktop' && m) return false;
      if (s.only === 'mobile' && !m) return false;
      return !s.at || !!find(s);
    });
  }
  Guide.usable = function (id) { return byId[id] ? usable(byId[id]) : []; };
  // Метки шагов, чьи элементы сейчас не найдены на странице (для проверки: tools/ui-smoke.py)
  Guide.missing = function (id) {
    var t = byId[id], m = mobile();
    if (!t) return ['нет экскурсии ' + id];
    return t.steps.filter(function (s) { return s.at && !(s.only === 'desktop' && m) && !(s.only === 'mobile' && !m) && !find(s); }).map(function (s) { return s.at; });
  };
  // Экскурсия страницы с данным адресом
  Guide.pageTour = function (hash) {
    hash = hash || location.hash || '#/home';
    for (var i = 0; i < Guide.tours.length; i++) if (Guide.tours[i].re && Guide.tours[i].re.test(hash)) return Guide.tours[i];
    return null;
  };
  // Точка на кнопке «?»: у страницы есть экскурсия, которую ученик ещё не открывал
  Guide.isNew = function () {
    var g = state(), t = Guide.pageTour();
    return !!(g && t && !g.off && !g.seen[t.id] && !g.peek[t.id]);
  };
  function refreshDot() { U.qsa('.tb-help').forEach(function (b) { b.classList.toggle('has-new', Guide.isNew()); }); }

  /* ================= Экскурсия ================= */
  var run = null;
  Guide.active = function () { return run ? run.tour.id : null; };

  Guide.start = function (id, opts) {
    opts = opts || {};
    var t = byId[id];
    if (!t) return false;
    Guide.stop();
    closeMarks();
    var list = usable(t);
    if (!list.some(function (s) { return s.at; })) {
      U.toast(t.empty || 'На этой странице сейчас нечего показать', 'warn', 4500);
      return false;
    }
    var g = state();
    if (g) { g.seen[id] = 1; A.save(); refreshDot(); }
    var hole = h('div.guide-hole'), pop = h('div.guide-pop', { role: 'dialog', 'aria-modal': 'true', 'aria-live': 'polite' });
    var root = h('div.guide', h('div.guide-shade'), hole, pop);
    document.body.appendChild(root);
    document.body.classList.add('guide-on');
    run = { tour: t, list: list, i: -1, root: root, hole: hole, pop: pop, el: null, back: document.activeElement, raf: 0, y: window.pageYOffset || 0 };
    var from = 0;
    if (opts.step) { var k = list.indexOf(opts.step); if (k >= 0) from = k; }
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('hashchange', onLeave);
    show(from, 1);
    return true;
  };

  // leaving — экскурсия закрыта переходом на другую страницу (прокрутку тогда не трогаем)
  Guide.stop = function (leaving) {
    if (!run) return;
    var r = run; run = null;
    cancelAnimationFrame(r.raf);
    document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('resize', onMove);
    window.removeEventListener('scroll', onMove, true);
    window.removeEventListener('hashchange', onLeave);
    r.root.remove();
    document.body.classList.remove('guide-on');
    if (leaving !== true) window.scrollTo(0, r.y);   // страница возвращается туда, где была до экскурсии
    try { if (r.back && r.back.focus && document.body.contains(r.back)) r.back.focus({ preventScroll: true }); } catch (e) { }
  };
  function onLeave() { Guide.stop(true); }
  function onMove() {
    if (!run || run.raf) return;
    run.raf = requestAnimationFrame(function () { if (run) { run.raf = 0; place(); } });
  }
  function onKey(e) {
    if (!run) return;
    var k = e.key;
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); Guide.stop(); return; }
    if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); e.stopPropagation(); step(1); return; }
    if (k === 'ArrowLeft' || k === 'PageUp') { e.preventDefault(); e.stopPropagation(); step(-1); return; }
    if (k === 'Tab') {   // фокус не уходит под затемнение
      var f = U.qsa('button', run.pop);
      if (!f.length) return;
      var i = f.indexOf(document.activeElement), n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i < 0 || i === f.length - 1 ? 0 : i + 1);
      e.preventDefault(); f[n].focus();
      return;
    }
  }
  function step(d) {
    if (!run) return;
    var n = run.i + d;
    if (n < 0) return;
    if (n >= run.list.length) { Guide.stop(); return; }
    show(n, d);
  }

  function show(i, dir) {
    var s = run.list[i], el = s.at ? find(s) : null;
    if (s.at && !el) {   // элемент исчез, пока шла экскурсия, — идём дальше в ту же сторону
      var n = i + (dir || 1);
      if (n < 0 || n >= run.list.length) { Guide.stop(); return; }
      show(n, dir); return;
    }
    run.i = i; run.el = el;
    if (el) bring(el);
    var last = i === run.list.length - 1, pop = run.pop;
    U.clear(pop);
    var next = h('button.btn.primary.small', { type: 'button', onclick: function () { step(1); } }, last ? 'Готово' : ['Далее', I('arrow-right', 16)]);
    pop.appendChild(h('button.guide-x', { type: 'button', 'aria-label': 'Закрыть экскурсию', 'data-tip': 'Закрыть (Esc)', onclick: function () { Guide.stop(); } }, I('x', 16)));
    pop.appendChild(h('div.guide-cap', run.tour.title, h('span', ' · ' + (i + 1) + ' из ' + run.list.length)));
    pop.appendChild(h('h3', s.title));
    pop.appendChild(h('div.guide-text', { html: s.text }));
    pop.appendChild(h('div.guide-dots', run.list.map(function (_, k) { return h('i' + (k === i ? '.on' : (k < i ? '.past' : ''))); })));
    pop.appendChild(h('div.guide-btns',
      last ? h('span') : h('button.btn.ghost.small', { type: 'button', onclick: function () { Guide.stop(); } }, 'Пропустить'),
      h('span.guide-sp'),
      i > 0 ? h('button.btn.small', { type: 'button', onclick: function () { step(-1); } }, 'Назад') : null,
      next));
    pop.setAttribute('aria-label', run.tour.title + ': ' + s.title);
    place();
    // вторая расстановка — когда страница докрутится и пояснение получит свой размер
    setTimeout(function () { if (run && run.i === i) place(); }, 60);
    try { next.focus({ preventScroll: true }); } catch (e) { next.focus(); }
  }

  // Прокрутить страницу так, чтобы элемент был виден (панели и меню закреплены — их крутить не нужно)
  function fixed(el) {
    for (var p = el; p && p !== document.body; p = p.parentElement) { var pos = getComputedStyle(p).position; if (pos === 'fixed' || pos === 'sticky') return true; }
    return false;
  }
  function bring(el) {
    if (fixed(el)) return;
    var r = box(el), vh = window.innerHeight, top = 96, bottom = vh - (mobile() ? 230 : 120);
    if (r.top >= top && r.bottom <= bottom) return;
    var room = bottom - top;
    var y = window.pageYOffset + r.top - (r.height < room ? top + (room - r.height) / 2 : top);
    window.scrollTo(0, Math.max(0, y));
  }

  // Подсветка и место пояснения
  function place() {
    if (!run) return;
    var el = run.el, hole = run.hole, pop = run.pop, vw = window.innerWidth, vh = window.innerHeight;
    var pw = pop.offsetWidth, ph = pop.offsetHeight, gap = 14, m = 10;
    pop.className = 'guide-pop';
    if (!el || !document.body.contains(el)) {
      run.root.classList.add('no-target');
      hole.style.display = 'none';
      pop.style.left = Math.round((vw - pw) / 2) + 'px';
      pop.style.top = Math.round(Math.max(m, (vh - ph) / 2)) + 'px';
      return;
    }
    run.root.classList.remove('no-target');
    var r = box(el), pad = 6;
    var L = Math.max(4, r.left - pad), T = Math.max(4, r.top - pad), R = Math.min(vw - 4, r.right + pad), B = Math.min(vh - 4, r.bottom + pad);
    if (R - L < 8) R = L + 8;
    if (B - T < 8) B = T + 8;
    hole.style.display = '';
    hole.style.left = L + 'px'; hole.style.top = T + 'px'; hole.style.width = (R - L) + 'px'; hole.style.height = (B - T) + 'px';
    var x, y, side;
    if (vw < 640) {
      // телефон: пояснение во всю ширину — снизу или сверху, где свободнее
      x = Math.round((vw - pw) / 2);
      var below = vh - B, above = T;
      if (below >= ph + gap + m) { y = B + gap; side = 'bottom'; }
      else if (above >= ph + gap + m) { y = T - gap - ph; side = 'top'; }
      else { y = below >= above ? vh - ph - m : m; side = 'over'; }   // не помещается ни сверху, ни снизу — у свободного края, поверх элемента
    } else {
      var order = ['bottom', 'top', 'right', 'left'], pref = run.list[run.i].place;
      if (pref) order = [pref].concat(order.filter(function (o) { return o !== pref; }));
      var fits = { bottom: vh - B >= ph + gap + m, top: T >= ph + gap + m, right: vw - R >= pw + gap + m, left: L >= pw + gap + m };
      side = order.filter(function (o) { return fits[o]; })[0];
      var cx = (L + R) / 2, cy = (T + B) / 2;
      if (side === 'bottom' || side === 'top') {
        x = cx < vw / 2 ? L : R - pw;
        if (R - L > pw) x = cx - pw / 2;
        y = side === 'bottom' ? B + gap : T - gap - ph;
      } else if (side === 'right' || side === 'left') {
        x = side === 'right' ? R + gap : L - gap - pw;
        y = cy - ph / 2;
        if (B - T > ph) y = Math.max(T, m + 60);
      } else {   // элемент занимает почти весь экран — пояснение поверх него, в нижнем углу
        x = vw - pw - m - 8; y = vh - ph - m - 8; side = 'over';
      }
    }
    x = Math.max(m, Math.min(vw - pw - m, x));
    y = Math.max(m, Math.min(vh - ph - m, y));
    pop.style.left = Math.round(x) + 'px';
    pop.style.top = Math.round(y) + 'px';
    pop.classList.add('at-' + side);
    // стрелка указывает на середину элемента
    if (side === 'bottom' || side === 'top') pop.style.setProperty('--ax', Math.round(Math.max(18, Math.min(pw - 18, (L + R) / 2 - x))) + 'px');
    if (side === 'right' || side === 'left') pop.style.setProperty('--ay', Math.round(Math.max(18, Math.min(ph - 18, (T + B) / 2 - y))) + 'px');
  }

  /* ================= Метки-подсказки ================= */
  var marks = null;
  function closeMarks() {
    if (!marks) return;
    var m = marks; marks = null;
    cancelAnimationFrame(m.raf);
    window.removeEventListener('resize', m.move);
    window.removeEventListener('scroll', m.move, true);
    window.removeEventListener('hashchange', closeMarks);
    document.removeEventListener('keydown', m.key, true);
    m.root.remove();
  }
  Guide.closeMarks = closeMarks;
  Guide.marks = function (id) {
    var t = byId[id];
    if (!t) return false;
    Guide.stop(); closeMarks();
    var list = usable(t).filter(function (s) { return s.at; });
    if (!list.length) { U.toast(t.empty || 'На этой странице сейчас нечего показать', 'warn', 4500); return false; }
    var g = state();
    if (g) { g.seen[id] = 1; A.save(); refreshDot(); }
    var root = h('div.guide-marks');
    var items = list.map(function (s, i) {
      var b = h('button.guide-mark', { type: 'button', 'aria-label': 'Подсказка ' + (i + 1) + ': ' + s.title, 'data-tip': s.title,
        onclick: function () { closeMarks(); Guide.start(id, { step: s }); } }, String(i + 1));
      root.appendChild(b);
      return { s: s, b: b };
    });
    root.appendChild(h('div.guide-bar', I('bulb', 18), h('span', 'Нажмите на номер — покажу, что это'), h('button.btn.small', { type: 'button', onclick: closeMarks }, 'Закрыть')));
    document.body.appendChild(root);
    var m = marks = { root: root, raf: 0 };
    function lay() {
      var vw = window.innerWidth, used = [];
      items.forEach(function (it) {
        var el = find(it.s);
        if (!el) { it.b.style.display = 'none'; return; }
        var r = box(el), x = Math.max(4, Math.min(vw - 30, r.left - 10)), y = r.top - 10;
        // метки соседних элементов не должны ложиться друг на друга
        for (var k = 0; k < used.length; k++) if (Math.abs(used[k][0] - x) < 26 && Math.abs(used[k][1] - y) < 26) { x = Math.min(vw - 30, x + 28); k = -1; }
        used.push([x, y]);
        it.b.style.display = '';
        it.b.style.left = Math.round(x) + 'px'; it.b.style.top = Math.round(y) + 'px';
      });
    }
    m.move = function () { if (m.raf) return; m.raf = requestAnimationFrame(function () { m.raf = 0; if (marks === m) lay(); }); };
    m.key = function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeMarks(); } };
    window.addEventListener('resize', m.move);
    window.addEventListener('scroll', m.move, true);
    window.addEventListener('hashchange', closeMarks);
    document.addEventListener('keydown', m.key, true);
    lay();
    return true;
  };

  /* ================= Переход к экскурсии с другой страницы ================= */
  // Куда перейти, чтобы показать экскурсию: адрес из текстов, а для урока, задачи и таблицы — подбирается по курсу
  function hrefOf(t) {
    if (t.href) return t.href;
    var mods = A.modules(), ls = A.allLessons(), tr = A.trainerTasks();
    if (t.id === 'module') return mods.length ? A.modHref(mods[0]) : null;
    if (t.id === 'lesson') return ls.length ? A.lessonHref(ls[0].m, ls[0].i) : null;
    if (t.id === 'task') return tr.length ? '#/t/' + encodeURIComponent(tr[0].id) : null;
    if (t.id === 'grid') return '#/sandbox';
    return null;
  }
  Guide.hrefOf = function (id) { return byId[id] ? hrefOf(byId[id]) : null; };
  Guide.go = function (id) {
    var t = byId[id];
    if (!t || !A.user) return;
    var href = hrefOf(t);
    if (!href) { U.toast('Для этой экскурсии нужна выбранная учебная база с уроками и задачами', 'warn', 4500); return; }
    Guide.stop(); closeMarks();
    var launch = function () {
      // таблица результата появляется только после запуска запроса — выполняем пример
      if (id === 'grid' && !document.querySelector('.task-res .dg') && A.sandboxDemo) A.sandboxDemo();
      setTimeout(function () { Guide.start(id); }, 120);
    };
    var here = t.re ? t.re.test(location.hash || '#/home') : location.hash === href;
    if (here && id !== 'grid') { launch(); return; }
    if (id === 'grid' && document.querySelector('.task-res .dg')) { launch(); return; }
    if (location.hash === href) { launch(); return; }
    var once = function () { window.removeEventListener('hashchange', once); setTimeout(launch, 320); };
    window.addEventListener('hashchange', once);
    A.go(href);
  };

  /* ================= Меню «Помощь» (кнопка «?») ================= */
  Guide.menu = function () {
    if (!A.user) { Guide.about(); return; }
    if (U.qs('.modal .guide-menu')) return;
    Guide.stop(); closeMarks();
    var t = Guide.pageTour(), g = state(), md;
    if (t && g && !g.peek[t.id]) { g.peek[t.id] = 1; A.save(); refreshDot(); }
    var item = function (icon, title, sub, fn) {
      return h('button.menu-item', { type: 'button', onclick: function () { md.close(); setTimeout(fn, 60); } }, I(icon), h('span', h('b', title), h('small', sub)));
    };
    var list = h('div.menu-list.guide-menu');
    var n = t ? usable(t).length : 0;
    if (t && n) {
      list.appendChild(item('play', 'Экскурсия по этой странице', '«' + t.title + '» — ' + n + ' ' + U.plural(n, 'шаг', 'шага', 'шагов') + ', около ' + Math.max(1, Math.round(n / 12)) + ' мин', function () { Guide.start(t.id); }));
      list.appendChild(item('bulb', 'Подсказки на странице', 'номера на всех элементах сразу: нажмите на любой', function () { Guide.marks(t.id); }));
    }
    if (document.querySelector('.task-res .dg') && byId.grid) list.appendChild(item('table', 'Как работать с таблицей', 'фильтр, сортировка, выделение, копирование в Excel', function () { Guide.start('grid'); }));
    if (byId.intro && (!t || t.id !== 'intro')) list.appendChild(item('course', 'Знакомство с курсом', 'что где находится — с главной страницы', function () { Guide.go('intro'); }));
    list.appendChild(item('help', 'О курсе', 'описание, все экскурсии, горячие клавиши, частые вопросы', function () { A.go('#/help'); }));
    md = U.modal('Помощь', list, [{ text: 'Закрыть' }]);
  };

  /* ================= Предложение знакомства на главной ================= */
  Guide.offer = function (page) {
    var g = state();
    if (!g || g.off || g.offered || g.seen.intro || !byId.intro) return;
    var box = h('div.guide-offer', { 'data-guide': 'offer' },
      h('div.go-ic', I('help', 22)),
      h('div.go-t', h('b', 'Показать, что где?'), h('div.muted.small', 'Короткая экскурсия по курсу — около минуты. Позже её можно открыть кнопкой «?».')),
      h('div.row-btns',
        h('button.btn.primary.small', { type: 'button', onclick: function () { done(); Guide.start('intro'); } }, I('play', 14), 'Показать'),
        h('button.btn.ghost.small', { type: 'button', onclick: function () { done(); U.toast('Экскурсии и подсказки — по кнопке «?»', 'ok', 3500); } }, 'Позже')));
    function done() { g.offered = new Date().toISOString(); A.save(); box.remove(); }
    page.insertBefore(box, page.firstChild);
  };

  /* ================= Профиль: карточка «Подсказки и обучение» ================= */
  Guide.profileCard = function () {
    var g = state() || {};
    var cb = h('input', { type: 'checkbox' }); cb.checked = !g.off;
    cb.addEventListener('change', function () { var s = state(); if (!s) return; s.off = !cb.checked; A.save(); refreshDot(); });
    return h('div.card.pad', { 'data-guide': 'prof-guide' }, h('h3', 'Подсказки и обучение'),
      h('p.muted', 'Экскурсию по любой странице запускает кнопка «?» вверху (на телефоне — внизу меню).'),
      h('div.row-btns',
        h('button.btn', { type: 'button', onclick: function () { Guide.go('intro'); } }, I('play', 16), 'Показать знакомство заново'),
        h('a.btn', { href: '#/help' }, I('help', 18), 'О курсе и все экскурсии')),
      h('label.check', cb, h('span', 'Предлагать экскурсии', h('small', 'предложение знакомства при первом входе и точка на кнопке «?» на новых страницах'))));
  };

  /* ================= Страница «О курсе» ================= */
  function facts() {
    return h('div.help-facts', (D.help.facts || []).map(function (f) { return h('div.help-fact', h('span.hf-ic', I(f[0], 20)), h('b', f[1]), h('div.muted.small', f[2])); }));
  }
  function path() {
    return h('ol.help-path', (D.help.path || []).map(function (p, i) { return h('li', h('span.hp-n', String(i + 1)), h('div', h('b', p[0]), h('div.muted.small', p[1]))); }));
  }
  function faq(list) {
    return h('div.help-faq', list.map(function (q) { return h('details', h('summary', q[0]), h('p', q[1])); }));
  }
  // Окно «О курсе» — на странице входа, где разделов ещё нет
  Guide.about = function () {
    if (U.qs('.modal .help-about')) return;
    U.modal('О курсе', h('div.help-about',
      h('p.help-lead', D.help.lead || ''), facts(),
      h('h4', 'Как устроена учёба'), path(),
      h('p.muted.small', 'После входа нажмите «?» — покажу, что где находится.')),
      [{ text: 'Понятно', primary: true }]);
  };
  if (A.route) A.route(/^#\/help$/, function (view) {
    var page = h('div.page.help'); view.appendChild(page);
    var H = D.help || {}, xp = C.config.xp;
    page.appendChild(h('div.card-head', h('h1', 'О курсе'),
      byId.intro ? h('button.btn.primary', { type: 'button', 'data-guide': 'help-intro', onclick: function () { Guide.go('intro'); } }, I('play', 16), 'Знакомство с курсом') : null));
    page.appendChild(h('p.help-lead', H.lead || ''));
    page.appendChild(facts());
    page.appendChild(h('div.card.pad', h('h2', 'Как устроена учёба'), path()));

    // разделы и экскурсии
    var secCard = h('div.card.pad', { 'data-guide': 'help-sections' }, h('h2', 'Разделы и экскурсии'),
      h('p.muted', 'Экскурсия открывает раздел и по шагам показывает, что за что отвечает. Ту же экскурсию на любой странице запускает кнопка «?».'));
    var rows = h('div.help-rows');
    var used = {};
    var row = function (icon, title, text, href, tourId) {
      var t = tourId && byId[tourId];
      if (t) used[tourId] = 1;
      return h('div.help-row', h('span.hr-ic', I(icon, 20)), h('div.hr-t', h('b', title), h('div.muted.small', text)),
        h('div.row-btns',
          href ? h('a.btn.small.ghost', { href: href }, 'Открыть') : null,
          t ? h('button.btn.small', { type: 'button', 'data-tour': tourId, onclick: function () { Guide.go(tourId); } }, I('play', 14), 'Экскурсия') : null));
    };
    (H.sections || []).forEach(function (s) { rows.appendChild(row(s[1], s[2], s[3], s[0], s[4])); });
    Guide.tours.forEach(function (t) { if (!used[t.id]) rows.appendChild(row(t.icon || 'help', t.title, t.short || '', null, t.id)); });
    secCard.appendChild(rows);
    page.appendChild(secCard);

    // очки и ранги — из настроек курса, чтобы числа не расходились с настоящими
    var lv = xp.trainer || [];
    var xpList = h('ul.help-list',
      h('li', 'Верный ответ на вопрос — ', h('b', xp.quiz + ' XP'), ', задача в уроке — ', h('b', xp.task + ' XP'), ', задача домашнего задания — ', h('b', xp.hw + ' XP'), '.'),
      h('li', 'Пройденный урок — ещё ', h('b', xp.lesson + ' XP'), ', завершённый модуль — ', h('b', xp.module + ' XP'), '.'),
      lv.length ? h('li', 'Задача тренажёра — от ', h('b', lv[0] + ' XP'), ' на первом уровне до ', h('b', lv[lv.length - 1] + ' XP'), ' на последнем.') : null,
      h('li', 'XP начисляется один раз — за первое верное решение. Подсказка на XP не влияет; решение, открытое раньше ' + C.config.solutionAfterTries + ' своих попыток, уменьшает XP за задание втрое.'),
      h('li', 'Достижения даются за особые успехи: серию дней, решения с первой попытки, пройденные модули.'));
    var ranks = h('div.help-ranks', (A.RANKS || []).map(function (r, i) { return h('span.tag', (i + 1) + '. ' + r[1] + ' — от ' + r[0] + ' XP'); }));
    page.appendChild(h('div.card.pad', h('h2', 'Очки, ранги и достижения'), xpList, h('h4', 'Ранги'), ranks));

    // горячие клавиши
    var keys = h('div.help-keys');
    (H.keys || []).forEach(function (grp) {
      keys.appendChild(h('div.hk-group', h('h4', grp[0]), h('table.kv.hk-t', grp[1].map(function (k) {
        // клавиши — в рамке, действия мышью («щелчок», «протяжка») — обычным текстом
        var isKey = /^(Ctrl|Shift|Alt|Tab|Enter|Esc|F\d+|[→←↑↓])/;
        return h('tr', h('td', k[0].split(/( или | \/ |, затем |, )/).map(function (part) { return isKey.test(part) ? h('kbd', part) : part; })), h('td', k[1]));
      }))));
    });
    page.appendChild(h('div.card.pad', h('h2', 'Горячие клавиши'), keys));
    page.appendChild(h('div.card.pad', h('h2', 'Частые вопросы'), faq(H.faq || [])));
    page.appendChild(h('p.muted.small.center', 'Подробная инструкция по установке и хранению прогресса — в файле ИНСТРУКЦИЯ.txt в папке курса.'));
  });

  /* ================= Всплывающие подписи =================
     Вместо системных подсказок (title): появляются быстрее, выглядят как остальной интерфейс и работают
     с клавиатуры; на сенсорном экране — по долгому нажатию. Текст берётся из title: при первом наведении
     он переезжает в data-tip (чтобы браузер не показал свою подсказку поверх нашей). */
  var tip = null, tipFor = null, tipTimer = 0, lastTouch = 0;
  function tipTarget(node) {
    for (var el = node; el && el.nodeType === 1 && el !== document.body; el = el.parentElement) {
      if (el.hasAttribute('title') && el.getAttribute('title')) {
        var t = el.getAttribute('title');
        el.setAttribute('data-tip', t); el.removeAttribute('title');
        // для программ чтения с экрана смысл title сохраняется: имя у кнопки-значка, описание у кнопки с надписью
        var txt = (el.textContent || '').trim();
        if (!txt) { if (!el.getAttribute('aria-label')) el.setAttribute('aria-label', t); }
        else if (txt !== t && !el.getAttribute('aria-description')) el.setAttribute('aria-description', t);
      }
      if (el.getAttribute('data-tip')) return el;
    }
    return null;
  }
  function hideTip() {
    clearTimeout(tipTimer); tipTimer = 0; tipFor = null;
    if (tip) tip.classList.remove('on');
  }
  function showTip(el) {
    var text = el.getAttribute('data-tip');
    if (!text || !document.body.contains(el)) return;
    // подпись, повторяющая видимую надпись кнопки, не нужна (она полезна, только когда надпись скрыта — у свёрнутой панели)
    if (text === (el.textContent || '').trim() && el.offsetWidth > 64) return;
    if (!tip) { tip = h('div.tip', { role: 'tooltip' }); document.body.appendChild(tip); }
    tip.textContent = text;
    tip.classList.remove('on');
    tip.style.left = '0px'; tip.style.top = '0px';
    var r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    var x = r.left + r.width / 2 - tw / 2, y = r.bottom + 8;
    if (y + th > vh - 6) y = r.top - th - 8;
    if (y < 6) y = Math.min(vh - th - 6, r.bottom + 8);
    tip.style.left = Math.round(Math.max(6, Math.min(vw - tw - 6, x))) + 'px';
    tip.style.top = Math.round(Math.max(6, y)) + 'px';
    tip.classList.add('on');
  }
  function planTip(el, delay) {
    if (tipFor === el) return;
    hideTip(); tipFor = el;
    tipTimer = setTimeout(function () { tipTimer = 0; if (tipFor === el) showTip(el); }, delay);
  }
  document.addEventListener('mouseover', function (e) {
    if (Date.now() - lastTouch < 900) return;   // касание тоже порождает mouseover — подпись после него не нужна
    var el = tipTarget(e.target);
    if (el) planTip(el, 380); else if (tipFor) hideTip();
  });
  document.addEventListener('mouseout', function (e) { if (tipFor && (!e.relatedTarget || !tipFor.contains(e.relatedTarget))) hideTip(); });
  document.addEventListener('mousedown', hideTip, true);
  document.addEventListener('keydown', hideTip, true);
  window.addEventListener('scroll', hideTip, true);
  window.addEventListener('blur', hideTip);
  document.addEventListener('focusin', function (e) {
    var t = e.target, kb = false;
    try { kb = t.matches(':focus-visible'); } catch (err) { }
    if (!kb || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    var el = tipTarget(t);
    if (el === t) planTip(el, 150);
  });
  document.addEventListener('focusout', hideTip);
  // сенсорный экран: долгое нажатие на кнопку показывает подпись и не срабатывает как нажатие
  var press = 0, pressed = false;
  document.addEventListener('touchstart', function (e) {
    lastTouch = Date.now(); pressed = false; clearTimeout(press); hideTip();
    var el = tipTarget(e.target);
    if (!el || el.tagName === 'A' || el.closest('a')) return;
    press = setTimeout(function () { pressed = true; tipFor = el; showTip(el); }, 520);
  }, { passive: true });
  document.addEventListener('touchmove', function () { clearTimeout(press); }, { passive: true });
  document.addEventListener('touchend', function () {
    lastTouch = Date.now(); clearTimeout(press);
    if (pressed) setTimeout(hideTip, 1800);
  }, { passive: true });
  document.addEventListener('click', function (e) {
    if (!pressed) return;
    pressed = false;
    if (Date.now() - lastTouch < 700) { e.preventDefault(); e.stopPropagation(); }
  }, true);
})(window);
