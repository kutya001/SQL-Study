/* ============================================================
   Живой фон за «островками».
   Два слоя на canvas внутри #bg:
     — мягкие цветные облака: медленно плывут, меняют оттенок по мере прокрутки,
       сдвигаются с разной глубиной (параллакс) и тянутся к курсору;
     — «созвездие» из точек: тоже с параллаксом, расступается перед курсором,
       соединяется с ним линиями, а при быстрой прокрутке вытягивается в штрихи.
   Бережёт компьютер: ~40 кадров в секунду (20 — когда ничего не происходит),
   пауза в скрытой вкладке, само упрощается на слабых машинах,
   выключается настройкой и при системной просьбе «меньше движения».

   Backdrop.set(true | false | null)   — включить / выключить / «как решит курс»
   ============================================================ */
(function (G) {
  'use strict';
  var B = G.Backdrop = { active: false, level: 0 };
  var root = document.getElementById('bg');
  if (!root || !window.requestAnimationFrame) { B.set = function () { }; return; }

  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { }
  var weak = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2) || (navigator.deviceMemory && navigator.deviceMemory <= 2);

  var cOrbs = null, cDots = null, xo = null, xd = null;
  var W = 0, H = 0, dpr = 1, OS = 0.25;             // OS — во сколько раз слой облаков меньше экрана (он всё равно размытый)
  var raf = 0, last = 0, t = 0, lastActive = 0;
  var scroll = 0, sScroll = 0, vel = 0;             // прокрутка: цель, сглаженное значение, скорость
  var ptr = { x: 0, y: 0, sx: 0, sy: 0, on: 0, seen: false };   // курсор: цель, сглаженное положение, «присутствие» 0..1
  var dark = false, dots = [], cost = 0, frames = 0;

  // Облака: положение в долях экрана, радиус в долях большей стороны, оттенок, глубина (сила параллакса), скорость, фаза
  var ORBS = [
    { x: .10, y: .08, r: .46, hue: 214, d: .30, sp: .10, ph: 0.0 },
    { x: .90, y: .20, r: .40, hue: 190, d: .55, sp: .08, ph: 1.7 },
    { x: .52, y: .95, r: .46, hue: 204, d: .40, sp: .07, ph: 3.1 },
    { x: .28, y: .52, r: .28, hue: 180, d: .80, sp: .13, ph: 4.4 },
    { x: .76, y: .66, r: .32, hue: 216, d: .65, sp: .09, ph: 5.3 },
    { x: .04, y: .88, r: .28, hue: 42, d: .90, sp: .11, ph: 2.4 }
  ];

  function wrap(v, lo, hi) { var n = hi - lo; return ((((v - lo) % n) + n) % n) + lo; }

  function build() {
    if (cOrbs) return;
    cOrbs = document.createElement('canvas'); cOrbs.className = 'bg-orbs';
    cDots = document.createElement('canvas'); cDots.className = 'bg-dots';
    cOrbs.setAttribute('aria-hidden', 'true'); cDots.setAttribute('aria-hidden', 'true');
    root.appendChild(cOrbs); root.appendChild(cDots);
    xo = cOrbs.getContext('2d'); xd = cDots.getContext('2d');
    window.addEventListener('resize', resize);
    window.addEventListener('scroll', function () { scroll = window.pageYOffset || 0; lastActive = last; }, { passive: true });
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      ptr.x = e.clientX; ptr.y = e.clientY; lastActive = last;
      if (!ptr.seen) { ptr.seen = true; ptr.sx = ptr.x; ptr.sy = ptr.y; }
      ptr.live = true;
    }, { passive: true });
    document.documentElement.addEventListener('mouseleave', function () { ptr.live = false; });
    // на телефоне курсора нет — фон отзывается на палец
    window.addEventListener('touchstart', touch, { passive: true });
    window.addEventListener('touchmove', touch, { passive: true });
    window.addEventListener('touchend', function () { ptr.live = false; }, { passive: true });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (B.active) start(); });
    new MutationObserver(readTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-palette'] });
    readTheme(); resize();
  }
  function touch(e) {
    var p = e.touches && e.touches[0]; if (!p) return;
    ptr.x = p.clientX; ptr.y = p.clientY; lastActive = last; ptr.live = true;
    if (!ptr.seen) { ptr.seen = true; ptr.sx = ptr.x; ptr.sy = ptr.y; }
  }
  // Тема и палитра. Цвета фона задаются в css/app.css: --bg-hues (оттенки шести облаков),
  // --bg-sat (насыщенность, 0..1), --bg-glow (оттенок света под курсором), --bg-dot (цвет точек, «r, g, b»)
  // При смене палитры цвета не прыгают: текущие значения (hue, sat, glow) плавно догоняют целевые (to, satTo, glowTo).
  var pal = { sat: 1, satTo: 1, glow: 205, glowTo: 205, dot: '26, 99, 208', ready: false };
  function readTheme() {
    dark = document.documentElement.getAttribute('data-theme') === 'dark';
    var cs = getComputedStyle(document.documentElement);
    var hues = cs.getPropertyValue('--bg-hues').split(',').map(function (x) { return parseFloat(x); }).filter(function (x) { return isFinite(x); });
    if (hues.length) ORBS.forEach(function (o, i) { o.to = hues[i % hues.length]; });
    var sat = parseFloat(cs.getPropertyValue('--bg-sat')); pal.satTo = isFinite(sat) ? Math.max(0, Math.min(1, sat)) : 1;
    var glow = parseFloat(cs.getPropertyValue('--bg-glow')); pal.glowTo = isFinite(glow) ? glow : ORBS[0].to;
    var dot = cs.getPropertyValue('--bg-dot').trim(); if (/^\d+\s*,\s*\d+\s*,\s*\d+$/.test(dot)) pal.dot = dot;
    if (!pal.ready) { pal.ready = true; easePalette(1); }   // первый раз — сразу, без перехода
    lastActive = last;                                      // смена палитры «будит» фон, даже если он шёл в медленном режиме
  }
  // Кратчайший поворот оттенка: из 350° в 10° — через 0°, а не через весь круг
  function turn(from, to, k) { return (from + ((((to - from) % 360) + 540) % 360 - 180) * k + 360) % 360; }
  // Пока оттенок далёк от целевого, облако бледнеет: по пути от янтаря к океану цвет не проходит через чужие яркие тона
  function far(from, to) { var d = Math.abs((((to - from) % 360) + 540) % 360 - 180); return d <= 24 ? 1 : Math.max(0, 1 - (d - 24) / 60); }
  function easePalette(k) {
    for (var i = 0; i < ORBS.length; i++) { var o = ORBS[i]; if (o.to !== undefined) o.hue = turn(o.hue, o.to, k); }
    pal.sat += (pal.satTo - pal.sat) * k;
    pal.glow = turn(pal.glow, pal.glowTo, k);
  }
  B.refresh = function () { if (cOrbs) readTheme(); };

  function resize() {
    W = window.innerWidth; H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    cOrbs.width = Math.max(2, Math.round(W * OS)); cOrbs.height = Math.max(2, Math.round(H * OS));
    cDots.width = Math.round(W * dpr); cDots.height = Math.round(H * dpr);
    seed();
  }
  // Точки: положение в долях экрана, глубина z (ближние крупнее и быстрее), фаза мерцания
  function seed() {
    var n = Math.round(Math.max(26, Math.min(86, W * H / 21000)));
    if (B.level >= 2) n = Math.round(n / 2);
    if (dots.length === n) return;
    var seedv = 20240917, rnd = function () { seedv = (seedv * 1664525 + 1013904223) >>> 0; return seedv / 4294967296; };
    dots = [];
    for (var i = 0; i < n; i++) {
      var z = 0.25 + rnd() * 0.75;
      dots.push({ x: rnd(), y: rnd(), z: z, r: 0.7 + z * 1.5, ph: rnd() * 6.28, vx: (rnd() - 0.5) * 0.004, vy: -(0.002 + rnd() * 0.004) * z, ox: 0, oy: 0, px: 0, py: 0 });
    }
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    var idle = now - lastActive > 4000;
    var gap = B.level >= 3 ? 66 : (idle ? 48 : 24);          // кадр не чаще, чем раз в gap миллисекунд
    var dtMs = now - last;
    if (dtMs < gap) return;
    last = now;
    var dt = Math.min(0.1, dtMs / 1000);
    t += dt;
    var t0 = performance.now();

    // сглаживание прокрутки и курсора
    var ps = sScroll;
    sScroll += (scroll - sScroll) * Math.min(1, dt * 7);
    vel += (((sScroll - ps) / dt) - vel) * Math.min(1, dt * 10);
    var k = Math.min(1, dt * 5);
    ptr.sx += (ptr.x - ptr.sx) * k; ptr.sy += (ptr.y - ptr.sy) * k;
    var want = ptr.seen ? (ptr.live && now - lastActive < 3500 ? 1 : 0.32) : 0;
    ptr.on += (want - ptr.on) * Math.min(1, dt * 2.2);

    drawOrbs();
    if (B.level < 3) drawDots(dt); else if (frames === 0) xd.clearRect(0, 0, cDots.width, cDots.height);

    // слабый компьютер: упрощаем сами — сначала без линий между точками, потом меньше точек, потом одни облака
    cost += performance.now() - t0; frames++;
    if (frames >= 90) {
      var avg = cost / frames; cost = 0; frames = 0;
      if (avg > 10 && B.level < 3) { B.level++; if (B.level === 2) seed(); if (B.level === 3) xd.clearRect(0, 0, cDots.width, cDots.height); }
    }
  }

  function drawOrbs() {
    var w = cOrbs.width, h = cOrbs.height, big = Math.max(w, h);
    xo.globalCompositeOperation = 'source-over';
    xo.clearRect(0, 0, w, h);
    xo.globalCompositeOperation = dark ? 'lighter' : 'source-over';
    var stretch = 1 + Math.min(0.45, Math.abs(vel) * 0.00045);          // быстрая прокрутка вытягивает облака
    // оттенок плавно колеблется со временем и с прокруткой — в пределах своей палитры, не уходя в чужие цвета
    var hueShift = Math.sin(t * 0.07) * 8 + Math.sin(sScroll * 0.0014) * 12;
    easePalette(0.09);
    var S1 = Math.round(88 * pal.sat), S2 = Math.round(92 * pal.sat);
    var mxn = ptr.seen ? (ptr.sx / W - 0.5) : 0, myn = ptr.seen ? (ptr.sy / H - 0.5) : 0;
    for (var i = 0; i < ORBS.length; i++) {
      var o = ORBS[i], r = o.r * big * (1 + 0.06 * Math.sin(t * 0.31 + o.ph));
      var x = o.x * w + Math.sin(t * o.sp + o.ph) * 0.07 * w;
      var y = o.y * h + Math.cos(t * o.sp * 0.8 + o.ph * 1.7) * 0.08 * h - sScroll * OS * o.d * 0.42;
      y = wrap(y, -r * 0.9, h + r * 0.9);
      // к курсору: ближние слои смещаются сильнее
      x += mxn * w * 0.10 * o.d * ptr.on; y += myn * h * 0.10 * o.d * ptr.on;
      var hue = Math.round((o.hue + hueShift * (i % 2 ? -1 : 1) + 360) % 360 * 10) / 10;
      var sf = o.to === undefined ? 1 : far(o.hue, o.to), s1 = Math.round(S1 * sf), s2 = Math.round(S2 * sf);
      var g = xo.createRadialGradient(x, y, 0, x, y, r);
      if (dark) {
        g.addColorStop(0, 'hsla(' + hue + ', ' + s1 + '%, 58%, 0.30)');
        g.addColorStop(0.5, 'hsla(' + hue + ', ' + s1 + '%, 52%, 0.12)');
      } else {
        g.addColorStop(0, 'hsla(' + hue + ', ' + s2 + '%, 74%, 0.52)');
        g.addColorStop(0.5, 'hsla(' + hue + ', ' + s2 + '%, 78%, 0.22)');
      }
      g.addColorStop(1, 'hsla(' + hue + ', ' + s2 + '%, 70%, 0)');
      xo.fillStyle = g;
      xo.save();
      xo.translate(x, y); xo.scale(1, stretch); xo.translate(-x, -y);
      xo.fillRect(x - r, y - r, 2 * r, 2 * r);
      xo.restore();
    }
    // свет под курсором
    if (ptr.on > 0.02) {
      var cx = ptr.sx * OS, cy = ptr.sy * OS, cr = big * 0.24, ch = Math.round((pal.glow + hueShift * 0.5 + 360) % 360), cs2 = Math.round(95 * pal.sat * far(pal.glow, pal.glowTo));
      var cg = xo.createRadialGradient(cx, cy, 0, cx, cy, cr);
      cg.addColorStop(0, 'hsla(' + ch + ', ' + cs2 + '%, ' + (dark ? 66 : 80) + '%, ' + (dark ? 0.30 : 0.50) * ptr.on + ')');
      cg.addColorStop(1, 'hsla(' + ch + ', ' + cs2 + '%, 70%, 0)');
      xo.fillStyle = cg; xo.fillRect(cx - cr, cy - cr, 2 * cr, 2 * cr);
    }
  }

  function drawDots(dt) {
    var ctx = xd, n = dots.length, i, j, d;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    var col = pal.dot;
    var px = ptr.sx, py = ptr.sy, near = 170, push = 150;
    var streak = Math.max(-34, Math.min(34, vel * 0.03));
    for (i = 0; i < n; i++) {
      d = dots[i];
      var x = wrap(d.x * W + t * d.vx * W, -20, W + 20);
      var y = wrap(d.y * H + t * d.vy * H - sScroll * d.z * 0.28, -20, H + 20);
      // курсор расталкивает точки (ближние — сильнее)
      var tx = 0, ty = 0;
      if (ptr.on > 0.05) {
        var dx = x - px, dy = y - py, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < push && dist > 0.01) { var f = (1 - dist / push) * 30 * d.z * ptr.on; tx = dx / dist * f; ty = dy / dist * f; }
      }
      var e = Math.min(1, dt * 9);
      d.ox += (tx - d.ox) * e; d.oy += (ty - d.oy) * e;
      d.px = x + d.ox; d.py = y + d.oy;
      d.a = (0.22 + 0.5 * d.z) * (0.72 + 0.28 * Math.sin(t * 1.3 + d.ph)) * (dark ? 0.9 : 0.75);
    }
    // линии между соседними точками
    ctx.lineWidth = 1;
    if (B.level < 1) {
      var lim = 118, lim2 = lim * lim;
      for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
        var a = dots[i], b = dots[j], ddx = a.px - b.px, ddy = a.py - b.py, q = ddx * ddx + ddy * ddy;
        if (q > lim2) continue;
        ctx.strokeStyle = 'rgba(' + col + ', ' + ((1 - Math.sqrt(q) / lim) * 0.20 * Math.min(a.z, b.z) * 1.4).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
      }
    }
    // линии к курсору
    if (ptr.on > 0.05) for (i = 0; i < n; i++) {
      d = dots[i];
      var cdx = d.px - px, cdy = d.py - py, cd = Math.sqrt(cdx * cdx + cdy * cdy);
      if (cd > near) continue;
      ctx.strokeStyle = 'rgba(' + col + ', ' + ((1 - cd / near) * 0.55 * ptr.on).toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(d.px, d.py); ctx.lineTo(px, py); ctx.stroke();
    }
    // сами точки; при быстрой прокрутке — штрихи
    ctx.lineCap = 'round';
    for (i = 0; i < n; i++) {
      d = dots[i];
      var len = streak * d.z;
      if (Math.abs(len) > 2.5) {
        ctx.strokeStyle = 'rgba(' + col + ', ' + (d.a * 0.8).toFixed(3) + ')'; ctx.lineWidth = d.r * 1.5;
        ctx.beginPath(); ctx.moveTo(d.px, d.py); ctx.lineTo(d.px, d.py + len); ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(' + col + ', ' + d.a.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(d.px, d.py, d.r, 0, 6.2832); ctx.fill();
      }
    }
  }

  function start() { if (raf || document.hidden) return; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }

  // on: true — включить, false — выключить, null — по умолчанию (включён, если система не просит «меньше движения»)
  B.set = function (on) {
    if (on === null || on === undefined) on = !reduce;
    if (on === B.active) return;
    B.active = on;
    if (on) {
      build();
      if (weak && B.level < 1) B.level = 1;
      scroll = sScroll = window.pageYOffset || 0;
      document.documentElement.classList.add('bg-live');
      start();
    } else {
      stop();
      document.documentElement.classList.remove('bg-live');
    }
  };
})(window);
