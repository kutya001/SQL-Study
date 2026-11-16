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
    if (attrs && (typeof attrs !== 'object' || attrs.nodeType || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
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

  U.toast = function (msg, kind, ms) {
    var box = U.qs('#toasts') || document.body.appendChild(U.h('div#toasts'));
    var t = U.h('div.toast' + (kind ? '.' + kind : ''), { html: msg });
    box.appendChild(t);
    setTimeout(function () { t.classList.add('show'); }, 10);
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 400); }, ms || 3200);
  };

  U.modal = function (title, body, buttons) {
    var ov = U.h('div.modal-ov');
    var close = function () { ov.remove(); document.removeEventListener('keydown', onKey); };
    var onKey = function (e) { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    var foot = U.h('div.modal-foot');
    (buttons || [{ text: 'Закрыть' }]).forEach(function (b) {
      foot.appendChild(U.h('button.btn' + (b.primary ? '.primary' : '') + (b.danger ? '.danger' : ''), { onclick: function () { var r = b.onclick ? b.onclick(close) : null; if (r !== false) close(); } }, b.text));
    });
    var box = U.h('div.modal', U.h('div.modal-head', U.h('h3', title), U.h('button.icon-btn', { onclick: close, title: 'Закрыть', html: '&times;' })), U.h('div.modal-body', body), foot);
    ov.appendChild(box);
    ov.addEventListener('mousedown', function (e) { if (e.target === ov) close(); });
    document.body.appendChild(ov);
    return { close: close, el: box };
  };
  U.confirm = function (title, text, okText) {
    return new Promise(function (res) {
      U.modal(title, U.h('p', { html: text }), [{ text: 'Отмена', onclick: function () { res(false); } }, { text: okText || 'Да', primary: true, onclick: function () { res(true); } }]);
    });
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
  U.hash = async function (s) {
    try {
      var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('sqlkurs:' + s));
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    } catch (e) {
      var h = 2166136261; s = 'sqlkurs:' + s;
      for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
      return 'f' + (h >>> 0).toString(16);
    }
  };
  U.download = function (name, text, type) {
    var a = U.h('a', { href: URL.createObjectURL(new Blob([text], { type: type || (/\.js$/i.test(name) ? 'text/javascript;charset=utf-8' : 'application/json') })), download: name });
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  U.debounce = function (fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; };
})(window);
