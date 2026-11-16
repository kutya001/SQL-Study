/* ============================================================
   Векторные значки интерфейса (24×24, линия currentColor).
   Icon('home') — SVG-элемент, Icon.html('home') — строка разметки.
   Значки баз и достижений — Icon.pack(pack), Icon.ach(id).
   ============================================================ */
(function (G) {
  'use strict';
  var P = {
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    'chevron-left': '<path d="M15 5l-7 7 7 7"/>',
    'chevron-right': '<path d="M9 5l7 7-7 7"/>',
    'chevron-down': '<path d="M5 9l7 7 7-7"/>',
    'chevron-up': '<path d="M5 15l7-7 7 7"/>',
    'arrow-left': '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v9.5h4.5v-5h3v5H18V10"/>',
    course: '<path d="M12 6.5C10 5 7 4.5 4 5v14c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.5-6 0-8 1.5z"/><path d="M12 6.5v14"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    terminal: '<rect x="3" y="4.5" width="18" height="15" rx="3.5"/><path d="M7.5 10l3 2.5-3 2.5M12.5 15.5h4"/>',
    schema: '<rect x="3" y="3.5" width="7.5" height="6" rx="1.8"/><rect x="13.5" y="3.5" width="7.5" height="6" rx="1.8"/><rect x="8.25" y="14.5" width="7.5" height="6" rx="1.8"/><path d="M6.75 9.5v2.5h10.5V9.5M12 12v2.5"/>',
    database: '<ellipse cx="12" cy="6" rx="7" ry="2.8"/><path d="M5 6v12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6"/><path d="M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8"/>',
    book: '<path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v14.5H7.5A2.5 2.5 0 0 0 5 20z"/><path d="M5 20a1.5 1.5 0 0 0 1.5 1.5H19v-4"/><path d="M9 7.5h6"/>',
    user: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c.8-3.6 3.8-5.6 7.5-5.6s6.7 2 7.5 5.6"/>',
    users: '<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.6-3.1 3-4.8 6-4.8s5.4 1.7 6 4.8"/><path d="M15.5 5.4a3.2 3.2 0 0 1 0 6.2M17.5 14.9c1.9.5 3.1 2 3.5 4.6"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5v1a3.5 3.5 0 0 0 3.2 3.5M16 6h3v1a3.5 3.5 0 0 1-3.2 3.5"/><path d="M12 13v3.5M8.5 20.5h7M10 20.5l.4-4h3.2l.4 4"/>',
    award: '<circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.3L7 21l5-2.6 5 2.6-1.6-7.7"/>',
    sliders: '<path d="M4 7h9.5M18.5 7H20M4 17h3.5M12.5 17H20"/><circle cx="16" cy="7" r="2.3"/><circle cx="10" cy="17" r="2.3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    logout: '<path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
    play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="M8 12.3l2.8 2.8 5.4-5.6"/>',
    'x-circle': '<circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/>',
    circle: '<circle cx="12" cy="12" r="8.5"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16 7l2.5 2.5M13.8 9.2l2 2"/>',
    bulb: '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.1h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z"/>',
    download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 20h14"/>',
    upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 20h14"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.3L4 9"/><path d="M4 4v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.3L20 15"/><path d="M20 20v-5h-5"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4.5 7h15M10 11v6M14 11v6"/><path d="M6.5 7l1 12.5A1.5 1.5 0 0 0 9 21h6a1.5 1.5 0 0 0 1.5-1.5L17.5 7"/><path d="M9.5 7V4.5h5V7"/>',
    folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8.5 10.5v-3a3.5 3.5 0 0 1 7 0v3"/>',
    shield: '<path d="M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6z"/><path d="M8.8 12.2l2.2 2.2 4.2-4.4"/>',
    edit: '<path d="M15.5 4.5l4 4L9 19H5v-4z"/><path d="M13.5 6.5l4 4"/>',
    flame: '<path d="M12 21c3.9 0 6.5-2.6 6.5-6.3 0-3.2-2-5.2-3.4-7.2-.4 1.6-1.2 2.6-2.3 3.1C13.5 7.5 12 4.8 9.6 3c.2 3-1.2 4.8-2.6 6.6C5.9 11 5.5 12.6 5.5 14.7 5.5 18.4 8.1 21 12 21z"/>',
    star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.6v.4"/>',
    alert: '<path d="M10.3 4.4L2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.4a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.5M12 17v.3"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 4M12 17v.3"/>',
    more: '<circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    table: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/>',
    layers: '<path d="M12 3.5l9 4.8-9 4.8-9-4.8z"/><path d="M3 12.6l9 4.8 9-4.8"/>',
    list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.8" cy="6.5" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.8" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="4.8" cy="17.5" r="1.1" fill="currentColor" stroke="none"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    history: '<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3.5 4.5V9h4.5"/><path d="M12 8v4.5l3 1.8"/>',
    expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5"/>',
    panel: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M14.5 4.5v15"/>',
    sidebar: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    code: '<path d="M9 7l-5 5 5 5M15 7l5 5-5 5"/>',
    rocket: '<path d="M14.5 4.5c2.5-1 4.5-1 5-1 0 .5 0 2.5-1 5L13 14l-3-3z"/><path d="M10 11l-4-1 2.5-3h4M13 14l1 4 3-2.5v-4"/><path d="M7 17c-1 1-1.5 3-1.5 3s2-.5 3-1.5"/>',
    puzzle: '<path d="M5 8.5h3.4a1.8 1.8 0 1 1 3.6 0H15.5v3.4a1.8 1.8 0 1 1 0 3.6V19H12a1.8 1.8 0 1 0-3.6 0H5z"/>',
    dumbbell: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>',
    sprout: '<path d="M12 21v-8"/><path d="M12 13c0-3.5-2.5-6-7-6 0 3.8 2.6 6 7 6z"/><path d="M12 11c0-3.2 2.3-5.5 6.5-5.5 0 3.5-2.4 5.5-6.5 5.5z"/>',
    chart: '<path d="M4 20h16"/><rect x="5.5" y="11" width="3" height="6.5" rx="1"/><rect x="10.5" y="6" width="3" height="11.5" rx="1"/><rect x="15.5" y="13.5" width="3" height="4" rx="1"/>',
    window: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 9h17M8 13h8M8 16h5"/>',
    mountain: '<path d="M3 19.5l6.5-11 4 6.5 2-3 5.5 7.5z"/>',
    cap: '<path d="M2.5 9.5L12 5l9.5 4.5L12 14z"/><path d="M6.5 11.5v4.3c1.5 1.4 3.4 2.2 5.5 2.2s4-.8 5.5-2.2v-4.3M21.5 9.5v5"/>',
    books: '<rect x="4" y="4" width="4" height="16" rx="1"/><rect x="9.5" y="4" width="4" height="16" rx="1"/><path d="M15.2 5.3l3.6-1 3 14.8-3.6 1z"/>',
    zap: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
    sparkles: '<path d="M11 4l1.7 4.6L17.3 10l-4.6 1.7L11 16.3l-1.7-4.6L4.7 10l4.6-1.4z"/><path d="M18 14.5l.8 1.9 1.9.8-1.9.8-.8 1.9-.8-1.9-1.9-.8 1.9-.8z"/>',
    flask: '<path d="M9.5 3.5h5M10.5 3.5V9L5.2 18.4A1.8 1.8 0 0 0 6.8 21h10.4a1.8 1.8 0 0 0 1.6-2.6L13.5 9V3.5"/><path d="M7.5 15h9"/>',
    cart: '<path d="M3.5 4.5h2.2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h7.9a1.5 1.5 0 0 0 1.5-1.1l1.6-6.3H6.5"/><circle cx="10" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
    shirt: '<path d="M8.5 4L4 6.5l1.8 4 2.2-1V20h8V9.5l2.2 1 1.8-4L15.5 4c-.4 1.4-1.8 2.5-3.5 2.5S8.9 5.4 8.5 4z"/>',
    package: '<path d="M12 3l8 4.3v9.4L12 21l-8-4.3V7.3z"/><path d="M4 7.3l8 4.3 8-4.3M12 11.6V21M8 5.2l8 4.3"/>',
    bank: '<path d="M3.5 9L12 4l8.5 5z"/><path d="M5.5 10v7M9.8 10v7M14.2 10v7M18.5 10v7M3.5 20.5h17"/>',
    filter: '<path d="M4 5h16l-6.2 7.4V19l-3.6-1.8v-4.8z"/>',
    send: '<path d="M4 12L20 4l-6 16-2.5-6.5z"/><path d="M11.5 13.5L20 4"/>',
    grip: '<path d="M8 9h8M8 15h8"/>',
    dot: '<circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>'
  };

  var NS = 'http://www.w3.org/2000/svg';
  function svgText(name, size) {
    var body = P[name] || P.dot;
    return '<svg class="ic ic-' + name + '" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + body + '</svg>';
  }
  function Icon(name, size) {
    var t = document.createElement('template');
    t.innerHTML = svgText(name, size || 20);
    return t.content.firstChild;
  }
  Icon.html = function (name, size) { return svgText(name, size || 20); };
  Icon.has = function (name) { return !!P[name]; };
  Icon.names = Object.keys(P);

  // Значок учебной базы: из поля icon (имя значка или эмодзи) или по id
  var PACK_EMOJI = { '🏦': 'bank', '🛒': 'cart', '🧵': 'shirt', '👕': 'shirt', '📦': 'package', '📚': 'books', '🗄️': 'database', '🗄': 'database', '🏥': 'shield', '🚗': 'package', '🏭': 'layers' };
  var PACK_ID = { bank: 'bank', shop: 'cart', sewing: 'shirt', cargo: 'package', library: 'books' };
  var PACK_HUE = { bank: '#5b5bf0', shop: '#0fa38a', sewing: '#e0457b', cargo: '#e8890c', library: '#7c5cff' };
  var PALETTE = ['#5b5bf0', '#0fa38a', '#e0457b', '#e8890c', '#7c5cff', '#0b8bd6', '#c2410c', '#16a34a'];
  Icon.packName = function (p) {
    var ic = p && p.icon ? String(p.icon).trim() : '';
    if (P[ic]) return ic;
    if (PACK_EMOJI[ic]) return PACK_EMOJI[ic];
    if (p && PACK_ID[p.id]) return PACK_ID[p.id];
    return 'database';
  };
  Icon.packColor = function (p) {
    if (!p) return PALETTE[0];
    if (p.color) return p.color;
    if (PACK_HUE[p.id]) return PACK_HUE[p.id];
    var h = 0; String(p.id || '').split('').forEach(function (c) { h = (h * 31 + c.charCodeAt(0)) >>> 0; });
    return PALETTE[h % PALETTE.length];
  };
  // Плитка со значком базы: <span class="pk-ic" style="--pk:#hex"><svg/></span>
  Icon.pack = function (p, size) {
    var el = document.createElement('span');
    el.className = 'pk-ic' + (size === 'lg' ? ' lg' : size === 'sm' ? ' sm' : '');
    el.style.setProperty('--pk', Icon.packColor(p));
    el.appendChild(Icon(Icon.packName(p), size === 'lg' ? 26 : size === 'sm' ? 14 : 18));
    return el;
  };

  // Значки достижений
  var ACH = { first_run: 'rocket', first_task: 'check-circle', solved25: 'puzzle', solved100: 'dumbbell', clean5: 'target', persist: 'refresh', streak3: 'flame', streak7: 'calendar', mod1: 'sprout', mod8: 'chart', mod9: 'link', mod13: 'window', half: 'mountain', grad: 'cap', hw_all: 'books', tr10: 'zap', tr_l5: 'sparkles', tr_all: 'trophy', sandbox20: 'flask', xp1000: 'star' };
  Icon.achName = function (id) { return ACH[id] || 'award'; };
  Icon.ach = function (id, size) { return Icon(Icon.achName(id), size || 20); };

  G.Icon = Icon;
})(window);
