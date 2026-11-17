/* Утилиты интерфейса */
(function (G) {
  'use strict';
  var U = G.U = {};

  U.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  };
  // создание элементов: U.h('div.card#id', {onclick:..., html:'...'}, children...)
  U.h = function (sel, attrs) {
    var m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(sel || 'div');
    var el = document.createElement(m[1] || 'div');
    (m[2] || '').replace(/([.#])([\w-]+)/g, function (_, t, v) { if (t === '.') el.classList.add(v); else el.id = v; });
    var kids = Array.prototype.slice.call(arguments, 2);
    if (attrs !== undefined && attrs !== null && attrs !== false && (typeof attrs !== 'object' || attrs.nodeType || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v === undefined || v === null || v === false) continue;
      if (k === 'html') el.innerHTML = v;
      else if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') for (var s in v) el.style[s] = v[s];
      else if (k === 'cls') String(v).split(' ').forEach(function (c) { if (c) el.classList.add(c); });
      else el.setAttribute(k, v === true ? '' : v);
    }
    (function add(list) {
      list.forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        if (Array.isArray(c)) add(c);
        else if (c.nodeType) el.appendChild(c);
        else el.appendChild(document.createTextNode(String(c)));
      });
    })(kids);
    return el;
  };
  U.clear = function (el) { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  U.qs = function (s, r) { return (r || document).querySelector(s); };
  U.qsa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  U.toast = function (msg, kind, ms, icon) {
    var box = U.qs('#toasts') || document.body.appendChild(U.h('div#toasts'));
    var t = U.h('div.toast' + (kind ? '.' + kind : ''), icon && G.Icon ? U.h('span.ach-ic', G.Icon(icon, 20)) : null, U.h('div.t-msg', { html: msg }));
    box.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 400); }, ms || 3200);
  };

  var openModals = [];
  // Закрыть открытые окна (кроме только что открытых — моложе minAgeMs)
  U.closeModals = function (minAgeMs) {
    var now = Date.now();
    openModals.slice().forEach(function (m) { if (!minAgeMs || now - m.at >= minAgeMs) m.close(); });
  };
  U.modal = function (title, body, buttons, onClose) {
    var ov = U.h('div.modal-ov'), closed = false, rec = { at: Date.now() };
    var close = rec.close = function () {
      if (closed) return; closed = true;
      var i = openModals.indexOf(rec); if (i >= 0) openModals.splice(i, 1);
      ov.remove(); document.removeEventListener('keydown', onKey);
      if (onClose) onClose();
    };
    openModals.push(rec);
    var onKey = function (e) { if (e.key === 'Escape' && openModals[openModals.length - 1] === rec) close(); };
    document.addEventListener('keydown', onKey);
    var foot = U.h('div.modal-foot');
    (buttons || [{ text: 'Закрыть' }]).forEach(function (b) {
      foot.appendChild(U.h('button.btn' + (b.primary ? '.primary' : '') + (b.danger ? '.danger' : ''), {
        onclick: function () {
          var r = b.onclick ? b.onclick(close) : null;
          // обработчик может быть асинхронным: окно остаётся открытым, если он вернул (или пообещал) false
          if (r && typeof r.then === 'function') r.then(function (v) { if (v !== false) close(); }, function (e) { console.error(e); close(); });
          else if (r !== false) close();
        }
      }, b.text));
    });
    var box = U.h('div.modal', U.h('div.modal-head', U.h('h3', title), U.h('button.icon-btn', { onclick: close, title: 'Закрыть', 'aria-label': 'Закрыть' }, G.Icon ? G.Icon('x') : '×')), U.h('div.modal-body', body), foot);
    ov.appendChild(box);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    document.body.appendChild(ov);
    return { close: close, el: box };
  };
  U.confirm = function (title, text, okText) {
    return new Promise(function (res) {
      var yes = false;   // закрытие окна любым способом, кроме кнопки подтверждения, — это «нет»
      U.modal(title, U.h('p', { html: text }), [{ text: 'Отмена' }, { text: okText || 'Да', primary: true, onclick: function () { yes = true; } }], function () { res(yes); });
    });
  };

  // «Подробнее»: кнопка и плавно раскрывающийся блок (контент создаётся при первом открытии, если передана функция)
  U.more = function (label, content, open) {
    var body = U.h('div.more-in'), filled = false;
    function fill() { if (filled) return; filled = true; var c = typeof content === 'function' ? content() : content; if (c) body.appendChild(c.nodeType ? c : U.h('div', c)); }
    var labels = Array.isArray(label) ? label : [label || 'Подробнее', 'Скрыть'];
    var txt = U.h('span', labels[0]);
    var btn = U.h('button.more-btn', { type: 'button', 'aria-expanded': 'false' }, txt, G.Icon ? G.Icon('chevron-down', 16) : '');
    var box = U.h('div.more', btn, U.h('div.more-body', body));
    btn.addEventListener('click', function () {
      var on = !box.classList.contains('open');
      if (on) fill();
      box.classList.toggle('open', on);
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      txt.textContent = on ? labels[1] : labels[0];
    });
    if (open) { fill(); box.classList.add('open'); txt.textContent = labels[1]; }
    return box;
  };
  // Кнопка «i»: подробности в окне (на телефоне — шторка снизу)
  U.info = function (title, content) {
    return U.h('button.icon-btn.info-btn', { type: 'button', title: title, 'aria-label': title, onclick: function () { U.modal(title, typeof content === 'function' ? content() : content); } }, G.Icon ? G.Icon('info', 19) : 'i');
  };
  // Заметка с значком: U.note('ok'|'warn'|'', 'shield', ...дети)
  U.note = function (kind, icon) {
    var kids = Array.prototype.slice.call(arguments, 2);
    return U.h('div.store-note' + (kind ? '.' + kind : ''), G.Icon ? G.Icon(icon || 'info', 18) : null, U.h('div.sn-body', kids));
  };

  U.plural = function (n, one, few, many) {
    var a = Math.abs(n) % 100, b = a % 10;
    if (a > 10 && a < 20) return many; if (b > 1 && b < 5) return few; if (b === 1) return one; return many;
  };
  U.fmtDate = function (iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return ('0' + d.getDate()).slice(-2) + '.' + ('0' + (d.getMonth() + 1)).slice(-2) + '.' + d.getFullYear() + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  };
  U.today = function () { var d = new Date(); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); };

  var TR = { 'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ү': 'u', 'ө': 'o', 'ң': 'n' };
  U.slug = function (s) {
    return String(s || '').toLowerCase().split('').map(function (c) { return TR[c] !== undefined ? TR[c] : c; }).join('')
      .replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'user';
  };
  // SHA-256 на чистом JS: crypto.subtle есть только в защищённом окружении (https, file://, localhost)
  function sha256hex(bytes) {
    var K = [], H = [], i, j, n = 2, c = 0;
    function frac(x) { return ((x - Math.floor(x)) * 4294967296) | 0; }
    while (c < 64) {
      var prime = true;
      for (i = 2; i * i <= n; i++) if (n % i === 0) { prime = false; break; }
      if (prime) { if (c < 8) H[c] = frac(Math.pow(n, 1 / 2)); K[c++] = frac(Math.pow(n, 1 / 3)); }
      n++;
    }
    var len = bytes.length, total = ((len + 9 + 63) >> 6) << 6, m = new Uint8Array(total), w = new Int32Array(64);
    m.set(bytes); m[len] = 0x80;
    var bits = len * 8;
    m[total - 4] = bits >>> 24; m[total - 3] = bits >>> 16; m[total - 2] = bits >>> 8; m[total - 1] = bits;
    function rr(x, k) { return (x >>> k) | (x << (32 - k)); }
    for (var off = 0; off < total; off += 64) {
      for (i = 0; i < 16; i++) w[i] = (m[off + i * 4] << 24) | (m[off + i * 4 + 1] << 16) | (m[off + i * 4 + 2] << 8) | m[off + i * 4 + 3];
      for (i = 16; i < 64; i++) {
        var s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], cc = H[2], d = H[3], e = H[4], f = H[5], g = H[6], hh = H[7];
      for (i = 0; i < 64; i++) {
        var t1 = (hh + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
        var t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & cc) ^ (b & cc))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = cc; cc = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + cc) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + hh) | 0;
    }
    var out = '';
    for (j = 0; j < 8; j++) out += ('0000000' + (H[j] >>> 0).toString(16)).slice(-8);
    return out;
  }
  function utf8(str) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    var e = unescape(encodeURIComponent(str)), b = new Uint8Array(e.length);
    for (var i = 0; i < e.length; i++) b[i] = e.charCodeAt(i);
    return b;
  }
  function legacyHash(s) {   // так считался хеш в старых версиях там, где нет crypto.subtle
    var h = 2166136261; s = 'sqlkurs:' + s;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return 'f' + (h >>> 0).toString(16);
  }
  U.sha256 = function (str) { return sha256hex(utf8(str)); };
  U.hash = async function (s) {
    try {
      var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('sqlkurs:' + s));
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    } catch (e) {
      return U.sha256('sqlkurs:' + s);
    }
  };
  // Проверка PIN: понимает и хеши старого образца
  U.checkPin = async function (pin, stored) {
    if (!stored) return true;
    if (String(stored).charAt(0) === 'f' && String(stored).length < 20) return legacyHash(pin) === stored;
    return (await U.hash(pin)) === stored;
  };
  U.download = function (name, text, type) {
    var a = U.h('a', { href: URL.createObjectURL(new Blob([text], { type: type || (/\.js$/i.test(name) ? 'text/javascript;charset=utf-8' : 'application/json') })), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    // ссылку освобождаем не сразу: на телефонах и медленных ПК сохранение начинается с задержкой
    var url = a.href; setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  };
  // Скопировать текст в буфер обмена. navigator.clipboard есть только в защищённом окружении, поэтому есть запасной способ.
  U.copy = function (text) {
    function legacy() {
      var ta = U.h('textarea', { readonly: true, style: { position: 'fixed', top: '0', left: '0', width: '1px', height: '1px', opacity: '0' } });
      ta.value = text;
      document.body.appendChild(ta); ta.focus(); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      return ok;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacy(); });
    return Promise.resolve(legacy());
  };
  U.debounce = function (fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; };
})(window);
