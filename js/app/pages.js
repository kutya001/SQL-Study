/* ============================================================
   Страницы: модуль, урок, задания, ДЗ, тренажёр, песочница,
   схема базы, справочник.
   ============================================================ */
(function (G) {
  'use strict';
  var I = G.Icon;
  var U = G.U, h = U.h, A = G.App, C = G.COURSE, T = G.TSQL, Grid = G.Grid, P = G.Packs;
  function dec(x) { try { return decodeURIComponent(x); } catch (e) { return x; } }
  G.Editor.defaultSchema = function () { var p = A.pack('bank'); return p ? p.tables : null; };

  /* ---------- HTML урока: подсветка блоков <pre class="sql"> ---------- */
  function richHtml(html) {
    var d = h('div.rich', { html: html || '' });
    U.qsa('pre.sql', d).forEach(function (p) { var src = p.textContent.replace(/^\n/, ''); p.innerHTML = G.highlightSQL(src); p.classList.add('code'); });
    return d;
  }
  A.richHtml = richHtml;

  /* ================= Блок задания ================= */
  A.taskBox = function (task, o) {
    o = o || {};
    var packId = task.pack || 'bank', pack = A.pack(packId);
    var db = A.dbFor(packId), xo = A.execOpts(packId);
    var it = A.item(task.id) || {};
    var box = h('div.task' + (it.ok ? '.solved' : ''));
    var status = h('span.task-status', it.ok ? [I('check-circle', 16), 'решено'] : '');
    box.appendChild(h('div.task-head', h('span.task-tag', o.tag || 'Задание'), o.title ? h('span.task-title', o.title) : null, task.level ? h('span.lvl.l' + task.level, C.trainer.levels[task.level - 1].name) : null, o.showPack && pack ? h('span.tag', pack.dbName) : null, status));
    box.appendChild(richHtml(task.text));
    var resArea = h('div.task-res'), fb = h('div.task-fb');
    var work = h('div.task-work'), main = h('div.tw-main'), side = h('div.tw-side'), pvArea = h('div.tw-preview');
    work.appendChild(main); work.appendChild(side);
    box.appendChild(work);
    var ed = G.Editor.create(main, { value: it.sql || task.starter || '', minLines: o.minLines || 4, schema: pack && pack.tables, onRun: function (s) { run(s.sql); } });
    var schemaBtn = h('button.btn.ghost.aux.schema-tgl', { title: 'Схема базы: таблицы и столбцы', onclick: function () {
      if (window.innerWidth < 768) { if (pack) A.schemaSheet(pack, function (text) { ed.insert(text); }); return; }
      A.user.settings.schemaPanel = !schemaOn(); A.save(); applySchema();
    } }, I('schema', 18), h('span.bl', 'Схема'));
    function schemaOn() { return A.user.settings.schemaPanel !== false; }
    var panel = null;
    function applySchema() {
      var on = schemaOn() && !!pack;
      work.classList.toggle('with-schema', on);
      schemaBtn.classList.toggle('on', on);
      if (on && !panel) {
        panel = G.SchemaPanel.create(pack, {
          onPick: function (text) { ed.insert(text); ed.focus(); },
          onPreview: function (name) { A.showPreviewIn(pvArea, pack, name); }
        });
        side.appendChild(panel.el);
      }
    }
    var tries = it.tries || 0;
    var solBtn = h('button.btn.ghost.aux', { onclick: showSolution, title: 'Решение' }, I('key', 18), h('span.bl', 'Решение'));
    var btns = h('div.task-btns',
      h('button.btn.run', { onclick: function () { run(ed.getValue()); }, title: 'Выполнить (F5 или Ctrl+Enter)' }, I('play', 16), 'Выполнить'),
      h('button.btn.primary', { onclick: check }, I('check', 18), 'Проверить'),
      task.hint ? h('button.btn.ghost.aux', { onclick: hint, title: 'Подсказка' }, I('bulb', 18), h('span.bl', 'Подсказка')) : null,
      h('button.btn.ghost.aux', { onclick: expected, title: 'Ожидаемый результат' }, I('eye', 18), h('span.bl', 'Ожидаемый результат')),
      solBtn, schemaBtn);
    main.appendChild(btns);
    main.appendChild(pvArea);
    box.appendChild(fb);
    box.appendChild(resArea);
    applySchema();
    function run(sql) {
      if (!sql.trim()) { U.toast('Редактор пуст', 'warn'); return; }
      var res = A.runSQL(sql, { pack: packId });
      Grid.renderRun(resArea, res, { trace: true });
      saveDraft();
    }
    var saveDraft = U.debounce(function () {
      if (!A.user) return;   // успели выйти из учётной записи
      var x = A.user.items[task.id] || (A.user.items[task.id] = { ok: false, tries: 0 }); x.sql = ed.getValue(); A.save();
    }, 800);
    function check() {
      var sql = ed.getValue();
      // пустой редактор (или одни комментарии) — это не попытка: не портим «с первой попытки» и счётчики
      if (!G.Checker.stripCode(sql).trim()) { U.toast('Сначала напишите запрос', 'warn'); ed.focus(); return; }
      A.user.stats.checks++;
      var r = G.Checker.check(task, sql, db, xo);
      if (r.res) Grid.renderRun(resArea, r.res, { trace: true });
      tries++;
      var rec = A.recordAttempt(task.id, r.ok, { sql: sql, kind: o.kind || 'task', xp: o.xp, why: o.why || 'за задание', title: o.title || task.title });
      U.clear(fb);
      if (r.ok) {
        box.classList.add('solved'); U.clear(status); status.appendChild(I('check-circle', 16)); status.appendChild(document.createTextNode('решено'));
        fb.appendChild(h('div.fb.ok', h('b', rec.first && rec.item.firstTry ? 'Отлично, с первой попытки! ' : 'Верно! '), 'Результат совпадает с эталоном.'));
        var det = h('details.sol', h('summary', 'Посмотреть эталонное решение'));
        var p = h('pre.code'); p.innerHTML = G.highlightSQL(task.solution); det.appendChild(p);
        if (task.explain) det.appendChild(richHtml(task.explain));
        fb.appendChild(det);
        if (o.onSolved) o.onSolved();
      } else {
        fb.appendChild(h('div.fb.bad', h('b', 'Пока не то. '), r.msg));
        if (tries >= C.config.solutionAfterTries && !it.ok) solBtn.classList.add('pulse');
      }
    }
    function hint() { A.user.stats.hints++; A.save(); U.clear(fb); fb.appendChild(h('div.fb.hint', h('b', 'Подсказка: '), richHtml(task.hint))); }
    function expected() {
      var res = T.execute(task.solution, db, xo);
      U.clear(fb);
      var rs = res.results[res.results.length - 1];
      fb.appendChild(h('div.fb.info', h('b', 'Так должен выглядеть результат'), rs ? ' (' + rs.rows.length + ' ' + U.plural(rs.rows.length, 'строка', 'строки', 'строк') + ')' : '', ':'));
      if (rs) fb.appendChild(Grid.table(rs.columns, rs.rows, rs.kinds, { max: 50 }));
    }
    async function showSolution() {
      var cur = A.item(task.id) || {};
      if (!cur.ok && tries < C.config.solutionAfterTries) {
        var ok = await U.confirm('Показать решение?', 'Попробуйте ещё — вы сделали ' + tries + ' ' + U.plural(tries, 'попытку', 'попытки', 'попыток') + '. Если открыть решение сейчас, за задание будет начислена только треть XP.', 'Показать');
        if (!ok) return;
      }
      var x = A.user.items[task.id] || (A.user.items[task.id] = { ok: false, tries: tries });
      if (!x.ok) x.usedSolution = true;
      A.user.stats.solutionsShown++; A.save();
      U.clear(fb);
      var p = h('pre.code'); p.innerHTML = G.highlightSQL(task.solution);
      fb.appendChild(h('div.fb.info', h('b', 'Решение: '), 'разберите его, затем напишите или вставьте в редактор и нажмите «Проверить».', p,
        task.explain ? richHtml(task.explain) : null,
        h('button.btn.small', { onclick: function () { ed.setValue(task.solution); } }, 'Вставить в редактор')));
    }
    return box;
  };

  /* Просмотр первых строк таблицы под редактором */
  A.showPreviewIn = function (area, pack, name) {
    var pv = A.tablePreview(pack, name);
    U.clear(area);
    area.appendChild(h('div.pv-box',
      h('div.pv-head', h('b', pv.title), h('button.icon-btn.small', { title: 'Закрыть', onclick: function () { U.clear(area); } }, '×')),
      h('div.pv-body', pv.table)));
  };

  /* ================= Вопрос с вариантами ================= */
  A.quizBox = function (q, o) {
    o = o || {};
    var it = A.item(q.id) || {};
    var multi = Array.isArray(q.answer);
    var box = h('div.quiz' + (it.ok ? '.solved' : ''));
    box.appendChild(h('div.task-head', h('span.task-tag.q', o.tag || 'Вопрос'), it.ok ? h('span.task-status', I('check-circle', 16)) : null));
    box.appendChild(richHtml(q.q));
    var opts = h('div.q-opts'), fb = h('div.task-fb');
    var wrong = 0, chosen = {};
    q.options.forEach(function (text, i) {
      var b = h('button.q-opt', { onclick: function () { pick(i, b); } }, h('span.q-mark' + (multi ? '.box' : ''), multi ? '' : String.fromCharCode(65 + i)), h('span', { html: text }));
      opts.appendChild(b);
    });
    box.appendChild(opts);
    var checkBtn = multi ? h('button.btn.primary.small', { onclick: checkMulti }, 'Проверить') : null;
    if (checkBtn) box.appendChild(checkBtn);
    box.appendChild(fb);
    if (it.ok) reveal();
    function pick(i, b) {
      if (multi) { chosen[i] = !chosen[i]; b.classList.toggle('sel', !!chosen[i]); b.querySelector('.q-mark').innerHTML = chosen[i] ? I.html('check', 15) : ''; return; }
      var ok = i === q.answer;
      U.qsa('.q-opt', opts).forEach(function (x) { x.classList.remove('bad'); });
      if (ok) { reveal(); A.recordAttempt(q.id, true, { kind: 'quiz', xp: o.xp || C.config.xp.quiz, why: 'за верный ответ' }); box.classList.add('solved'); }
      else {
        b.classList.add('bad'); wrong++;
        A.recordAttempt(q.id, false, { kind: 'quiz' });
        U.clear(fb); fb.appendChild(h('div.fb.bad', 'Неверно. ' + (wrong >= 2 && q.explain ? '' : 'Подумайте ещё.')));
        if (wrong >= 2 && q.explain) fb.appendChild(h('div.fb.hint', richHtml(q.explain)));
      }
    }
    function checkMulti() {
      var sel = Object.keys(chosen).filter(function (k) { return chosen[k]; }).map(Number).sort();
      var ans = q.answer.slice().sort();
      var ok = sel.length === ans.length && sel.every(function (v, i) { return v === ans[i]; });
      if (ok) { reveal(); A.recordAttempt(q.id, true, { kind: 'quiz', xp: o.xp || C.config.xp.quiz, why: 'за верный ответ' }); box.classList.add('solved'); }
      else { wrong++; A.recordAttempt(q.id, false, { kind: 'quiz' }); U.clear(fb); fb.appendChild(h('div.fb.bad', 'Не совсем. Отметьте все верные варианты и только их.')); if (wrong >= 2 && q.explain) fb.appendChild(h('div.fb.hint', richHtml(q.explain))); }
    }
    function reveal() {
      var ans = multi ? q.answer : [q.answer];
      U.qsa('.q-opt', opts).forEach(function (x, i) { x.disabled = true; if (ans.indexOf(i) >= 0) x.classList.add('good'); });
      if (checkBtn) checkBtn.remove();
      U.clear(fb);
      fb.appendChild(h('div.fb.ok', h('b', 'Верно! '), q.explain ? richHtml(q.explain) : null));
    }
    return box;
  };

  /* ================= Упорядочивание ================= */
  A.orderBox = function (q, o) {
    o = o || {};
    var it = A.item(q.id) || {};
    var box = h('div.quiz.order' + (it.ok ? '.solved' : ''));
    box.appendChild(h('div.task-head', h('span.task-tag.q', 'Расставьте по порядку'), it.ok ? h('span.task-status', I('check-circle', 16)) : null));
    box.appendChild(richHtml(q.q));
    var pool = h('div.ord-pool'), ans = h('div.ord-ans'), fb = h('div.task-fb');
    var picked = [];
    var shuffled = q.items.map(function (x, i) { return i; });
    for (var i = shuffled.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = t; }
    function draw() {
      U.clear(pool); U.clear(ans);
      shuffled.forEach(function (idx) { if (picked.indexOf(idx) < 0) pool.appendChild(h('button.chip.ord', { onclick: function () { picked.push(idx); draw(); } }, q.items[idx])); });
      picked.forEach(function (idx, k) { ans.appendChild(h('button.chip.ord.in', { onclick: function () { picked.splice(k, 1); draw(); } }, (k + 1) + '. ' + q.items[idx])); });
      if (!picked.length) ans.appendChild(h('span.muted', 'Нажимайте на элементы в правильном порядке'));
    }
    box.appendChild(h('div.w-cap', 'Элементы:')); box.appendChild(pool);
    box.appendChild(h('div.w-cap', 'Ваш порядок:')); box.appendChild(ans);
    box.appendChild(h('div.row-btns', h('button.btn.primary.small', { onclick: check }, 'Проверить'), h('button.btn.ghost.small', { onclick: function () { picked = []; draw(); } }, 'Сбросить')));
    box.appendChild(fb);
    function check() {
      if (picked.length !== q.items.length) { U.clear(fb); fb.appendChild(h('div.fb.bad', 'Расставьте все элементы.')); return; }
      var ok = picked.every(function (v, k) { return v === k; });
      A.recordAttempt(q.id, ok, { kind: 'quiz', xp: o.xp || C.config.xp.quiz, why: 'за верный порядок' });
      U.clear(fb);
      if (ok) { box.classList.add('solved'); fb.appendChild(h('div.fb.ok', h('b', 'Верно! '), q.explain ? richHtml(q.explain) : null)); }
      else {
        var firstBad = picked.findIndex(function (v, k) { return v !== k; });
        fb.appendChild(h('div.fb.bad', 'Не совсем: первая ошибка на позиции ' + (firstBad + 1) + '. Попробуйте ещё.'));
      }
    }
    if (it.ok) { picked = q.items.map(function (_, k) { return k; }); }
    draw();
    return box;
  };

  /* ================= Пример с запуском ================= */
  A.exampleBox = function (s) {
    var box = h('div.example');
    if (s.html) box.appendChild(richHtml(s.html));
    var res = h('div.task-res');
    var ex = A.pack(s.pack);
    var ed = G.Editor.create(box, { value: s.sql, minLines: 3, schema: ex && ex.tables, onRun: function (x) { run(x.sql); } });
    box.appendChild(h('div.task-btns',
      h('button.btn.primary', { onclick: function () { run(ed.getValue()); }, title: 'Выполнить (F5 или Ctrl+Enter)' }, I('play', 16), 'Выполнить'),
      s.noTrace ? null : h('button.btn', { onclick: function () { run(ed.getValue(), true); } }, 'Пошагово'),
      h('button.btn.ghost', { onclick: function () { ed.setValue(s.sql); U.clear(res); } }, 'Вернуть пример'),
      h('span.muted.small', 'Пример можно менять — экспериментируйте!')));
    box.appendChild(res);
    if (s.after) box.appendChild(richHtml(s.after));
    function run(sql, trace) {
      var r = A.runSQL(sql, { pack: s.pack });
      Grid.renderRun(res, r, { trace: !s.noTrace, showTrace: trace });
    }
    if (s.autorun) setTimeout(function () { run(ed.getValue()); }, 0);
    return box;
  };

  function renderItem(s, o) {
    switch (s.t) {
      case 'quiz': return A.quizBox(s, o);
      case 'order': return A.orderBox(s, o);
      case 'task': return A.taskBox(s, { kind: 'task', xp: C.config.xp.task, tag: o && o.tag, title: s.title });
      default: return h('div', '?');
    }
  }

  function packCrumb(packId) {
    var p = A.pack(packId);
    if (!p || (packId === 'bank' && A.activePacks().length < 2)) return null;
    return [I('chevron-right', 14), h('span', p.title)];
  }
  A.packCrumb = packCrumb;

  /* ================= Страница модуля ================= */
  A.route(/^#\/m\/([^/]+)$/, function (view, mid) {
    var m = A.module(dec(mid));
    if (!m) { A.go('#/home'); return; }
    var page = h('div.page'); view.appendChild(page);
    var ms = A.moduleState(m);
    page.appendChild(h('div.crumbs', h('a', { href: '#/home' }, 'Курс'), packCrumb(m.pack), ' › Модуль ' + m.num));
    page.appendChild(h('div.mod-hero', h('span.mod-num.big', String(m.num)), h('div', h('h1', m.title), richHtml(m.goal || m.short || ''))));
    page.appendChild(h('div.pbar.big', h('div', { style: { width: ms.pct + '%' } })));
    var list = h('div.lesson-list');
    m.lessons.forEach(function (l, i) {
      var st = A.lessonState(l);
      list.appendChild(h('a.lesson-row' + (st.complete ? '.done' : ''), { href: A.lessonHref(m, i) },
        h('span.lr-n', st.complete ? I('check', 18) : String(i + 1)),
        h('div.lr-main', h('div.lr-t', l.title), h('div.muted.small', (l.minutes ? '≈ ' + l.minutes + ' мин · ' : '') + l.steps.length + ' шагов · мини-тренировка: ' + st.done + '/' + st.total)),
        h('span.lr-go', st.complete ? 'повторить' : (st.visited ? 'продолжить' : 'начать'))));
    });
    if (m.homework && m.homework.length) {
      list.appendChild(h('a.lesson-row.hw' + (ms.hwDone === ms.hw ? '.done' : ''), { href: '#/hw/' + encodeURIComponent(m.id) },
        h('span.lr-n', ms.hwDone === ms.hw ? I('check', 18) : I('edit', 17)),
        h('div.lr-main', h('div.lr-t', 'Домашнее задание'), h('div.muted.small', ms.hw + ' ' + U.plural(ms.hw, 'задача', 'задачи', 'задач') + ' · решено ' + ms.hwDone)),
        h('span.lr-go', 'открыть')));
    }
    page.appendChild(list);
    if (m.read && m.read.length) {
      var rd = h('div.card.pad', h('h3', 'Почитать подробнее'));
      m.read.forEach(function (r) { rd.appendChild(h('div', h('a', { href: r[1], target: '_blank', rel: 'noopener' }, r[0]))); });
      page.appendChild(rd);
    }
  });

  /* ================= Урок ================= */
  A.route(/^#\/l\/([^/]+)\/(\d+)(?:\/(\d+))?$/, function (view, mid, num, stepParam) {
    var m = A.module(dec(mid));
    if (!m || !m.lessons[num - 1]) { A.go('#/home'); return; }
    var li = num - 1, l = m.lessons[li];
    var rec = A.user.lessons[l.id] || (A.user.lessons[l.id] = {});
    rec.visited = true;
    var total = l.steps.length + 1; // +1 тренировка
    var idx = stepParam !== undefined ? Math.min(+stepParam, total - 1) : Math.min(rec.step || 0, total - 1);
    var page = h('div.page.lesson'); view.appendChild(page);
    page.appendChild(h('div.crumbs', h('a', { href: '#/home' }, 'Курс'), packCrumb(m.pack), ' › ', h('a', { href: A.modHref(m) }, 'Модуль ' + m.num + '. ' + m.title), ' › Урок ' + num));
    page.appendChild(h('h1', l.title));
    var dots = h('div.steps-dots'); page.appendChild(dots);
    var body = h('div.lesson-body'); page.appendChild(body);
    var nav = h('div.lesson-nav'); page.appendChild(nav);
    var trainRefresh = null;
    // обновлять статус тренировки после ответов на вопросы (обработчик один на всю страницу)
    body.addEventListener('click', U.debounce(function () { if (trainRefresh) trainRefresh(); }, 300));
    function draw() {
      rec.step = idx; A.save();
      trainRefresh = null;
      U.clear(dots); U.clear(body); U.clear(nav);
      for (var i = 0; i < total; i++) {
        (function (i) {
          var s = l.steps[i];
          var lbl = i === total - 1 ? 'Тренировка' : (s.title || '');
          dots.appendChild(h('button.sdot' + (i === idx ? '.active' : '') + (i < idx ? '.past' : '') + (i === total - 1 ? '.train' : ''), { title: lbl, onclick: function () { idx = i; draw(); window.scrollTo(0, 0); } }, i === total - 1 ? I('target', 15) : String(i + 1)));
        })(i);
      }
      if (idx < l.steps.length) {
        var s = l.steps[idx];
        if (s.title) body.appendChild(h('h2.step-title', s.title));
        switch (s.t) {
          case 'text': body.appendChild(richHtml(s.html)); break;
          case 'example': body.appendChild(A.exampleBox(s)); break;
          case 'widget':
            if (s.html) body.appendChild(richHtml(s.html));
            body.appendChild(G.Widgets.render(s.w, s.opts));
            if (s.after) body.appendChild(richHtml(s.after));
            break;
          default:
            if (s.html) body.appendChild(richHtml(s.html));
            body.appendChild(renderItem(s, { tag: s.t === 'task' ? 'Попробуйте сами' : null }));
        }
        nav.appendChild(idx > 0 ? h('button.btn', { onclick: function () { idx--; draw(); window.scrollTo(0, 0); } }, [I('arrow-left', 18), 'Назад']) : h('span'));
        nav.appendChild(h('span.muted.step-of', 'Шаг ' + (idx + 1) + ' из ' + l.steps.length));
        nav.appendChild(h('button.btn.primary', { onclick: function () { idx++; draw(); window.scrollTo(0, 0); } }, idx === l.steps.length - 1 ? ['К тренировке', I('arrow-right', 18)] : ['Далее', I('arrow-right', 18)]));
      } else {
        rec.finished = true;
        A.afterProgress();
        body.appendChild(h('h2.step-title', 'Мини-тренировка'));
        body.appendChild(h('p.muted', 'Закрепите урок: решите все задания ниже. Урок засчитывается, когда всё решено.'));
        var items = l.training || [];
        var doneBox = h('div');
        items.forEach(function (s, k) {
          var el = s.t === 'task' ? A.taskBox(s, { kind: 'task', xp: C.config.xp.task, tag: 'Задача ' + (k + 1), title: s.title, onSolved: refresh }) : (s.t === 'order' ? A.orderBox(s) : A.quizBox(s, { tag: 'Вопрос ' + (k + 1) }));
          body.appendChild(el);
        });
        body.appendChild(doneBox);
        if (l.read && l.read.length) {
          var rd = h('div.card.pad.read', h('b', 'Почитать подробнее: '));
          l.read.forEach(function (r, i) { rd.appendChild(h('a', { href: r[1], target: '_blank', rel: 'noopener' }, r[0])); if (i < l.read.length - 1) rd.appendChild(document.createTextNode(' · ')); });
          body.appendChild(rd);
        }
        nav.appendChild(h('button.btn', { onclick: function () { idx--; draw(); window.scrollTo(0, 0); } }, [I('arrow-left', 18), 'К теории']));
        var nextHref = li < m.lessons.length - 1 ? A.lessonHref(m, li + 1) : (m.homework && m.homework.length ? '#/hw/' + encodeURIComponent(m.id) : A.modHref(m));
        nav.appendChild(h('a.btn.primary', { href: nextHref }, li < m.lessons.length - 1 ? ['Следующий урок', I('arrow-right', 18)] : (m.homework && m.homework.length ? ['К домашнему заданию', I('arrow-right', 18)] : ['К модулю', I('arrow-right', 18)])));
        refresh();
        function refresh() {
          A.afterProgress();
          var st = A.lessonState(l);
          U.clear(doneBox);
          if (st.done === st.total) doneBox.appendChild(h('div.lesson-done', h('div.ld-ic', I('award', 26)), h('div', h('b', 'Урок пройден!'), h('div', 'Все задания решены. Двигайтесь дальше.'))));
          else doneBox.appendChild(h('div.muted.center', 'Решено ' + st.done + ' из ' + st.total));
        }
        trainRefresh = refresh;
      }
    }
    draw();
  });

  /* ================= Домашнее задание ================= */
  A.route(/^#\/hw\/([^/]+)$/, function (view, mid) {
    var m = A.module(dec(mid));
    if (!m) { A.go('#/home'); return; }
    var page = h('div.page.task-page'); view.appendChild(page);
    page.appendChild(h('div.crumbs', h('a', { href: '#/home' }, 'Курс'), packCrumb(m.pack), ' › ', h('a', { href: A.modHref(m) }, 'Модуль ' + m.num), ' › Домашнее задание'));
    page.appendChild(h('h1', 'Домашнее задание: ' + m.title));
    page.appendChild(richHtml(m.hwIntro || '<p>Задачи посложнее, чем в уроках, и ближе к реальной работе аналитика. Подсказки есть, но сначала попробуйте сами. Решение можно открыть после нескольких попыток.</p>'));
    (m.homework || []).forEach(function (t, i) {
      page.appendChild(A.taskBox(t, { kind: 'hw', xp: C.config.xp.hw, tag: 'ДЗ ' + m.num + '.' + (i + 1), title: t.title, why: 'за домашнее задание', minLines: 6 }));
    });
    var pm = A.packModules(A.pack(m.pack)), nm = pm[pm.indexOf(m) + 1];
    page.appendChild(h('div.lesson-nav', h('a.btn', { href: A.modHref(m) }, [I('arrow-left', 18), 'К модулю']), nm ? h('a.btn.primary', { href: A.modHref(nm) }, ['Следующий модуль', I('arrow-right', 18)]) : h('a.btn.primary', { href: '#/trainer' }, ['В тренажёр', I('arrow-right', 18)])));
  });

  /* ================= Практикум (набор задач базы) ================= */
  A.route(/^#\/set\/([^/]+)$/, function (view, sid) {
    sid = dec(sid);
    var set = A.allSets().filter(function (x) { return x.id === sid; })[0];
    if (!set) { A.go('#/home'); return; }
    var pack = A.pack(set.pack);
    var page = h('div.page.task-page'); view.appendChild(page);
    page.appendChild(h('div.crumbs', h('a', { href: '#/home' }, 'Курс'), I('chevron-right', 14), h('span', pack.title), I('chevron-right', 14), 'Практикум'));
    page.appendChild(h('h1', set.title));
    if (set.desc) page.appendChild(richHtml(set.desc));
    page.appendChild(h('p.muted.small', 'Запросы выполняются в базе ', h('b', pack.dbName), '. Схема таблиц — ', h('a', { href: '#/schema/' + pack.id }, 'здесь'), '.'));
    set.tasks.forEach(function (t, i) {
      var xp = t.level ? C.config.xp.trainer[t.level - 1] : C.config.xp.hw;
      page.appendChild(A.taskBox(t, { kind: 'set', xp: xp, tag: 'Задача ' + (i + 1), title: t.title, why: 'за задачу практикума', minLines: 5 }));
    });
    var idx = pack.sets.indexOf(set), next = pack.sets[idx + 1];
    page.appendChild(h('div.lesson-nav', h('a.btn', { href: '#/home' }, [I('arrow-left', 18), 'К курсу']), h('span'), next ? h('a.btn.primary', { href: '#/set/' + encodeURIComponent(next.id) }, ['Следующий практикум', I('arrow-right', 18)]) : h('a.btn.primary', { href: '#/trainer/0/' + pack.id }, ['В тренажёр', I('arrow-right', 18)])));
  });

  /* ================= Тренажёр ================= */
  function trainerScope(pf) {
    var packs = A.activePacks().filter(function (p) { return p.trainer.length; });
    var cur = pf === 'all' ? null : (pf && A.pack(pf) ? pf : (A.user.settings.trainerPack && packs.some(function (p) { return p.id === A.user.settings.trainerPack; }) ? A.user.settings.trainerPack : null));
    if (cur && packs.every(function (p) { return p.id !== cur; }) && A.pack(cur)) packs.push(A.pack(cur));
    var tasks = cur ? A.pack(cur).trainer : A.trainerTasks();
    return { packs: packs, cur: cur, tasks: tasks };
  }
  A.route(/^#\/trainer(?:\/(\d))?(?:\/([\w-]+))?$/, function (view, lv, pf) {
    var page = h('div.page'); view.appendChild(page);
    if (pf) { A.user.settings.trainerPack = pf === 'all' ? null : pf; A.save(); }
    var sc = trainerScope(pf), tasks = sc.tasks, suffix = '/' + (sc.cur || 'all');
    page.appendChild(h('h1', 'Тренажёр'));
    page.appendChild(h('p.muted', 'Отдельные задачи по всей программе — для закрепления и подготовки к реальной работе. Уровни идут от простого к сложному. Решайте в любом порядке.'));
    if (sc.packs.length > 1) {
      var chips = h('div.chips.pack-chips');
      chips.appendChild(h('a.chip' + (!sc.cur ? '.on' : ''), { href: '#/trainer/0/all' }, 'Все базы (' + A.trainerTasks().length + ')'));
      sc.packs.forEach(function (p) { chips.appendChild(h('a.chip' + (sc.cur === p.id ? '.on' : ''), { href: '#/trainer/0/' + p.id }, I.pack(p, 'sm'), p.title + ' · ' + p.trainer.length)); });
      page.appendChild(chips);
    }
    if (!tasks.length) { page.appendChild(h('div.card.pad', 'В выбранных базах нет задач тренажёра. ', h('a', { href: '#/packs' }, 'Выбрать другие базы'))); return; }
    var levels = h('div.lvl-grid');
    var cur = lv ? +lv : 0;
    if (!cur) { cur = 1; for (var L = 1; L <= C.trainer.levels.length; L++) { var lt = tasks.filter(function (t) { return t.level === L; }); if (lt.some(function (t) { return !A.isDone(t.id); })) { cur = L; break; } } }
    C.trainer.levels.forEach(function (info, i) {
      var n = i + 1, lt = tasks.filter(function (t) { return t.level === n; }), d = lt.filter(function (t) { return A.isDone(t.id); }).length;
      levels.appendChild(h('a.lvl-card.l' + n + (n === cur ? '.active' : ''), { href: '#/trainer/' + n + suffix },
        h('div.lvl-n', 'Уровень ' + n), h('div.lvl-name', info.name), h('div.muted.small', info.desc),
        h('div.lvl-p', d + '/' + lt.length), h('div.pbar', h('div', { style: { width: (lt.length ? d * 100 / lt.length : 0) + '%' } }))));
    });
    page.appendChild(levels);
    var lt2 = tasks.filter(function (t) { return t.level === cur; });
    var unsolved = lt2.filter(function (t) { return !A.isDone(t.id); });
    page.appendChild(h('div.card-head', h('h2', 'Уровень ' + cur + ': ' + C.trainer.levels[cur - 1].name), unsolved.length ? h('a.btn', { href: '#/t/' + encodeURIComponent(unsolved[Math.floor(Math.random() * unsolved.length)].id) }, 'Случайная нерешённая') : (lt2.length ? h('span.badge.ok', 'уровень пройден') : null)));
    if (!lt2.length) page.appendChild(h('p.muted', 'На этом уровне задач нет.'));
    var list = h('div.tr-list');
    var many = !sc.cur && sc.packs.length > 1;
    lt2.forEach(function (t, i) {
      var done = A.isDone(t.id), p = A.pack(t.pack);
      list.appendChild(h('a.tr-row' + (done ? '.done' : ''), { href: '#/t/' + encodeURIComponent(t.id) },
        h('span.lr-n', done ? I('check', 18) : String(i + 1)), h('div.lr-main', h('div.lr-t', t.title), h('div.tags', many && p ? h('span.tag', p.dbName) : null, (t.tags || []).map(function (g) { return h('span.tag', g); }))),
        h('span.muted.small', '+' + C.config.xp.trainer[t.level - 1] + ' XP')));
    });
    page.appendChild(list);
  });
  A.route(/^#\/t\/([^/]+)$/, function (view, id) {
    id = dec(id);
    var t = null;
    P.all().forEach(function (p) { p.trainer.forEach(function (x) { if (x.id === id) t = x; }); });
    if (!t) { A.go('#/trainer'); return; }
    var sc = trainerScope();
    var scopeTasks = sc.tasks.indexOf(t) >= 0 ? sc.tasks : A.pack(t.pack).trainer;
    var lt = scopeTasks.filter(function (x) { return x.level === t.level; }), i = lt.indexOf(t);
    var suffix = '/' + (sc.tasks.indexOf(t) >= 0 ? (sc.cur || 'all') : t.pack);
    var page = h('div.page.task-page'); view.appendChild(page);
    page.appendChild(h('div.crumbs', h('a', { href: '#/trainer/' + t.level + suffix }, 'Тренажёр · уровень ' + t.level), ' › задача ' + (i + 1) + ' из ' + lt.length));
    page.appendChild(A.taskBox(t, { kind: 'trainer', xp: C.config.xp.trainer[t.level - 1], tag: 'Тренажёр', title: t.title, why: 'за задачу тренажёра', minLines: 6, showPack: P.all().length > 1 }));
    page.appendChild(h('div.lesson-nav',
      i > 0 ? h('a.btn', { href: '#/t/' + encodeURIComponent(lt[i - 1].id) }, [I('arrow-left', 18), 'Предыдущая']) : h('span'),
      h('a.btn.ghost.nav-mid', { href: '#/trainer/' + t.level + suffix, title: 'Все задачи уровня' }, I('list', 18), h('span.bl', 'Все задачи')),
      i < lt.length - 1 ? h('a.btn.primary', { href: '#/t/' + encodeURIComponent(lt[i + 1].id) }, ['Следующая', I('arrow-right', 18)]) : h('a.btn.primary', { href: '#/trainer/' + Math.min(t.level + 1, C.trainer.levels.length) + suffix }, ['Следующий уровень', I('arrow-right', 18)])));
  });

  /* ================= Песочница ================= */
  A.route(/^#\/sandbox(?:\/([\w-]+))?$/, function (view, pid) {
    var u = A.user;
    var packs = A.activePacks().slice();
    if (pid && A.pack(pid) && packs.indexOf(A.pack(pid)) < 0) packs.push(A.pack(pid));
    var cur = pid && A.pack(pid) ? A.pack(pid) : (A.pack(u.settings.sandboxDb) && packs.indexOf(A.pack(u.settings.sandboxDb)) >= 0 ? A.pack(u.settings.sandboxDb) : packs[0]);
    var page = h('div.page.wide'); view.appendChild(page);
    var dbSel = h('select.inp.db-sel', { title: 'Текущая база данных (как в SSMS). Можно переключать командой USE ИмяБазы;' }, P.all().filter(function (p) { return packs.indexOf(p) >= 0; }).map(function (p) { return h('option', { value: p.id }, p.dbName + ' — ' + p.title); }));
    dbSel.value = cur.id;
    page.appendChild(h('div.card-head', h('h1', 'Песочница'), h('div.sb-tools', h('label.inline.db-pick', I('database', 18), dbSel), U.info('Как пользоваться песочницей', function () { return h('p', 'Свободные запросы к учебной базе. F5 / Ctrl+Enter — выполнить; выделите часть текста, чтобы выполнить только её.' + (P.all().length > 1 ? ' К таблице другой базы обращайтесь по полному имени ' : ''), P.all().length > 1 ? [h('code', 'ИмяБазы.dbo.Таблица'), ' (базы: ' + P.all().map(function (p) { return p.dbName; }).join(', ') + ') или переключайтесь командой ', h('code', 'USE ИмяБазы;'), '.'] : null); }))));
    var lay = h('div.sandbox'); page.appendChild(lay);
    var main = h('div.sb-main'), res = h('div.task-res'), pvArea = h('div.tw-preview');
    var ed, side;
    lay.appendChild(main);
    function drawSide() {
      var ns = h('div.tw-side.sb-side', G.SchemaPanel.create(cur, { onPick: function (name) { ed.insert(name); ed.focus(); }, onPreview: function (name) { A.showPreviewIn(pvArea, cur, name); } }).el);
      if (side) lay.replaceChild(ns, side); else lay.appendChild(ns); side = ns;
      U.clear(pvArea);
    }
    var sel = h('select.inp');
    function drawExamples() {
      U.clear(sel);
      sel.appendChild(h('option', { value: '' }, cur.examples.length ? 'Вставить пример…' : 'Примеров нет'));
      cur.examples.forEach(function (p, i) { sel.appendChild(h('option', { value: i }, p.title)); });
    }
    sel.addEventListener('change', function () { if (sel.value !== '') { ed.setValue(cur.examples[+sel.value].sql); sel.value = ''; } });
    function setCur(p, keepUrl) {
      cur = p; u.settings.sandboxDb = p.id; A.save();
      dbSel.value = p.id; drawSide(); drawExamples(); ed.setSchema(p.tables);
      if (!keepUrl) history.replaceState(null, '', '#/sandbox/' + p.id);
    }
    dbSel.addEventListener('change', function () { setCur(A.pack(dbSel.value)); });
    var save = U.debounce(function () { u.sandbox = ed.getValue(); A.save(); }, 800);
    ed = G.Editor.create(main, { value: u.sandbox, minLines: 10, maxLines: 30, schema: cur.tables, onRun: function (s) { run(s.sql); }, onChange: save });
    main.appendChild(h('div.task-btns', h('button.btn.primary', { onclick: function () { ed.run(); }, title: 'Выполнить (F5 или Ctrl+Enter)' }, I('play', 16), 'Выполнить'), h('button.btn', { onclick: function () { run(ed.getValue(), true); }, title: 'Выполнить по шагам: FROM → WHERE → GROUP BY → …' }, I('list', 18), 'Пошагово'),
      h('button.btn.ghost.aux.m-only', { title: 'Схема базы', onclick: function () { A.schemaSheet(cur, function (text) { ed.insert(text); }); } }, I('schema', 18), h('span.bl', 'Схема')), sel));
    main.appendChild(pvArea);
    main.appendChild(res);
    drawSide(); drawExamples();
    u.settings.sandboxDb = cur.id;
    function run(sql, trace) {
      var r = A.runSQL(sql, { sandbox: true, pack: cur.id });
      Grid.renderRun(res, r, { trace: true, showTrace: trace });
      // USE переключает базу, как в SSMS
      var used = r.session && r.session.db && r.session.db.name;
      if (used && used !== cur.dbName) {
        var np = P.all().filter(function (p) { return p.dbName === used; })[0];
        if (np) { if (packs.indexOf(np) < 0) { packs.push(np); dbSel.appendChild(h('option', { value: np.id }, np.dbName + ' — ' + np.title)); } setCur(np); U.toast('Текущая база: <b>' + U.esc(np.dbName) + '</b>', 'ok', 1800); }
      }
    }
  });

  /* ================= Схема базы ================= */
  A.route(/^#\/schema(?:\/([\w-]+))?$/, function (view, pid) {
    var packs = A.activePacks().slice();
    if (pid && A.pack(pid) && packs.indexOf(A.pack(pid)) < 0) packs.push(A.pack(pid));
    var pack = pid && A.pack(pid) ? A.pack(pid) : packs[0];
    var page = h('div.page.wide'); view.appendChild(page);
    if (packs.length > 1) {
      var tabs = h('div.chips.pack-chips');
      packs.forEach(function (p) { tabs.appendChild(h('a.chip' + (p === pack ? '.on' : ''), { href: '#/schema/' + p.id }, I.pack(p, 'sm'), p.title)); });
      page.appendChild(tabs);
    }
    var cnt = G.PackFormat.counts(pack);
    page.appendChild(h('div.card-head', h('div', h('h1', pack.title), h('div.muted.small', 'база ' + pack.dbName + ' · ' + cnt.tables + ' ' + U.plural(cnt.tables, 'таблица', 'таблицы', 'таблиц') + ' · ' + (pack.rowCount || 0).toLocaleString('ru-RU') + ' строк')), I.pack(pack, 'lg')));
    if (pack.description) page.appendChild(U.more(['Описание и правила расчёта', 'Скрыть описание'], function () { return richHtml(pack.description); }));
    page.appendChild(h('p.muted.small.erd-hint', 'Линии — связи «внешний ключ → первичный ключ». Значок таблицы справа — посмотреть данные.'));
    var erd = A.erd(pack);
    page.appendChild(erd.el);
    setTimeout(erd.draw, 30);
    // перерисовка линий при изменении размера окна; обработчик снимает себя сам, когда страница закрыта
    var onR = U.debounce(function () { if (!document.body.contains(erd.el)) { window.removeEventListener('resize', onR); return; } erd.draw(); }, 100);
    window.addEventListener('resize', onR);
    if (pack.relations.length) {
      var rel = h('div.card.pad', h('h3', 'Связи между таблицами'));
      pack.relations.forEach(function (r) { rel.appendChild(h('div', h('code', r[0]), ' → ', h('code', r[1]))); });
      page.appendChild(rel);
    }
  });

  /* ================= Справочник ================= */
  A.route(/^#\/cheat$/, function (view) {
    var page = h('div.page'); view.appendChild(page);
    page.appendChild(h('h1', 'Справочник T-SQL (SELECT)'));
    page.appendChild(h('p.muted', 'Короткие шпаргалки по всем темам курса. Примеры написаны для базы Bank (Учебный банк). Нажмите «Копировать», чтобы вставить пример в песочницу или SSMS.'));
    var toc = h('div.chips'); page.appendChild(toc);
    (G.CHEAT || []).forEach(function (sec, i) {
      var id = 'cs' + i;
      toc.appendChild(h('a.chip', { href: '#/cheat', onclick: function (e) { e.preventDefault(); U.qs('#' + id).scrollIntoView({ behavior: 'smooth' }); } }, sec.title));
      var card = h('div.card.pad.cheat#' + id, h('h2', sec.title));
      sec.items.forEach(function (it) {
        var p = h('pre.code'); p.innerHTML = G.highlightSQL(it.sql);
        card.appendChild(h('div.cheat-item', h('div.ci-h', h('b', it.h), h('button.btn.small.ghost', { onclick: function () { U.copy(it.sql).then(function (ok) { if (ok) U.toast('Скопировано', 'ok', 1200); else U.toast('Не удалось скопировать — выделите текст примера и нажмите Ctrl+C', 'warn', 4500); }); } }, 'Копировать')), p, it.note ? richHtml(it.note) : null));
      });
      page.appendChild(card);
    });
  });
})(window);
