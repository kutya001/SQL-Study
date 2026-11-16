// Генератор учебной базы «Карго по СНГ» (детерминированный)
globalThis.window = globalThis;
const fs = require('fs');
const root = require('path').resolve(__dirname, '../..') + '/';
['js/engine/tsql-core.js','js/engine/tsql-parser.js','js/engine/tsql-funcs.js','js/engine/tsql-exec.js','js/engine/bankdb.js'].forEach(f => require(root + f));
const T = globalThis.TSQL;
const OUT = root + 'schemas/cargo/data/';
fs.mkdirSync(OUT, { recursive: true });

let seed = 7701265;
function R() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const rnd = (a, b) => a + Math.floor(R() * (b - a + 1));
const pick = a => a[Math.floor(R() * a.length)];
const wpick = pairs => { let s = 0; pairs.forEach(p => s += p[1]); let x = R() * s; for (const p of pairs) { x -= p[1]; if (x <= 0) return p[0]; } return pairs[pairs.length - 1][0]; };
const pad = n => String(n).padStart(2, '0');
const DAY = 86400000, HOUR = 3600000, MIN = 60000;
const D = (y, m, d) => Date.UTC(y, m - 1, d);
const fd = t => { const d = new Date(t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
const fdt = t => { const d = new Date(t); return fd(t) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()); };
const r2 = x => Math.round(x * 100) / 100;
const START = D(2025, 1, 1), END = D(2026, 10, 31) + DAY - 1000; // «сейчас» — конец 31.10.2026
function csv(name, header, rows) {
  const q = v => { if (v === null || v === undefined) return ''; const s = String(v); return /[",\n]/.test(s) || s === '' ? '"' + s.replace(/"/g, '""') + '"' : s; };
  fs.writeFileSync(OUT + name + '.csv', [header.join(',')].concat(rows.map(r => r.map(q).join(','))).join('\n') + '\n');
  console.log(name, rows.length);
}

/* Склады: [id, название, город, страна, вид, родитель, открыт, бесплатное хранение, код] */
const W = [
  [1, 'Хаб Бишкек', 'Бишкек', 'Кыргызстан', 'Хаб', null, D(2018, 4, 1), 7, 'BIS'],
  [2, 'Хаб Москва', 'Москва', 'Россия', 'Хаб', null, D(2019, 2, 1), 5, 'MOW'],
  [3, 'Хаб Алматы', 'Алматы', 'Казахстан', 'Хаб', null, D(2020, 6, 1), 7, 'ALA'],
  [4, 'Хаб Ташкент', 'Ташкент', 'Узбекистан', 'Хаб', null, D(2022, 3, 1), 7, 'TAS'],
  [5, 'Склад Ош', 'Ош', 'Кыргызстан', 'Склад', 1, D(2019, 5, 1), 7, 'OSS'],
  [6, 'Склад Новосибирск', 'Новосибирск', 'Россия', 'Склад', 2, D(2021, 9, 1), 5, 'OVB'],
  [7, 'Склад Екатеринбург', 'Екатеринбург', 'Россия', 'Склад', 2, D(2021, 4, 1), 5, 'SVX'],
  [8, 'Склад Санкт-Петербург', 'Санкт-Петербург', 'Россия', 'Склад', 2, D(2022, 7, 1), 5, 'LED'],
  [9, 'Склад Казань', 'Казань', 'Россия', 'Склад', 2, D(2023, 2, 1), 5, 'KZN'],
  [10, 'Склад Минск', 'Минск', 'Беларусь', 'Склад', 2, D(2024, 3, 1), 5, 'MSQ'],
  [11, 'Склад Астана', 'Астана', 'Казахстан', 'Склад', 3, D(2021, 10, 1), 7, 'NQZ'],
  [12, 'Склад Душанбе', 'Душанбе', 'Таджикистан', 'Склад', 4, D(2023, 9, 1), 7, 'DYU'],
  [13, 'Пункт выдачи Бишкек-Восток', 'Бишкек', 'Кыргызстан', 'Пункт выдачи', 1, D(2020, 3, 1), 10, ''],
  [14, 'Пункт выдачи Бишкек-Юг', 'Бишкек', 'Кыргызстан', 'Пункт выдачи', 1, D(2021, 8, 1), 10, ''],
  [15, 'Пункт выдачи Каракол', 'Каракол', 'Кыргызстан', 'Пункт выдачи', 1, D(2022, 5, 1), 10, ''],
  [16, 'Пункт выдачи Джалал-Абад', 'Джалал-Абад', 'Кыргызстан', 'Пункт выдачи', 5, D(2023, 4, 1), 10, ''],
  [17, 'Пункт выдачи Москва-Люблино', 'Москва', 'Россия', 'Пункт выдачи', 2, D(2022, 11, 1), 5, ''],
  [18, 'Пункт выдачи Москва-Химки', 'Москва', 'Россия', 'Пункт выдачи', 2, D(2025, 6, 2), 5, ''],
  [19, 'Пункт выдачи Самарканд', 'Самарканд', 'Узбекистан', 'Пункт выдачи', 4, D(2024, 9, 1), 7, ''],
  [20, 'Пункт выдачи Бишкек-Джал', 'Бишкек', 'Кыргызстан', 'Пункт выдачи', 1, D(2026, 10, 26), 10, '']
];
const wh = {}; W.forEach(w => wh[w[0]] = { id: w[0], name: w[1], city: w[2], country: w[3], kind: w[4], parent: w[5], open: w[6], free: w[7], code: w[8] });
csv('Warehouses', ['WarehouseID', 'WarehouseName', 'City', 'Country', 'Kind', 'ParentID', 'OpenDate', 'FreeStorageDays'], W.map(w => [w[0], w[1], w[2], w[3], w[4], w[5], fd(w[6]), w[7]]));
// узел маршрута: пункт выдачи обслуживается через своего «родителя»
const node = id => wh[id].kind === 'Пункт выдачи' ? wh[id].parent : id;

/* Тарифы */
const tariffs = [
  [1, 'Эконом (авто)', 'Авто', 120, 400, 21, 1],
  [2, 'Стандарт (авто)', 'Авто', 180, 600, 14, 1],
  [3, 'Экспресс (авиа)', 'Авиа', 520, 1500, 5, 1],
  [4, 'Сборный груз (авто, от 30 кг)', 'Авто', 85, 3000, 25, 1],
  [5, 'Стандарт-2024 (авто)', 'Авто', 160, 550, 14, 0],
  [6, 'Ж/д эконом', 'Ж/д', 70, 2500, 30, 1]
];
csv('Tariffs', ['TariffID', 'TariffName', 'Transport', 'PricePerKg', 'MinPrice', 'DaysNorm', 'IsActive'], tariffs.map(t => [t[0], t[1], t[2], t[3].toFixed(2), t[4].toFixed(2), t[5], t[6]]));
const tf = {}; tariffs.forEach(t => tf[t[0]] = { id: t[0], tr: t[2], kg: t[3], min: t[4], days: t[5] });

/* Сотрудники */
const bank = T.buildBankDb();
const bankPeople = bank.tables.clients.rows.filter(r => r[7]);
let bpi = 2;
const used = {};
const femF = ['Айгуль', 'Асель', 'Динара', 'Жылдыз', 'Гульмира', 'Нургуль', 'Анара', 'Бермет', 'Мээрим', 'Чолпон', 'Елена', 'Ольга', 'Наталья', 'Айпери'];
const femL = ['Абдыкалыкова', 'Асанова', 'Бакирова', 'Жумабекова', 'Касымова', 'Мамытова', 'Осмонова', 'Сыдыкова', 'Эсенова', 'Иманалиева', 'Кадырова', 'Ким', 'Иванова', 'Петрова', 'Каримова', 'Рахимова'];
const malF = ['Бакыт', 'Нурлан', 'Эрлан', 'Азамат', 'Улан', 'Тимур', 'Марат', 'Данияр', 'Руслан', 'Айбек', 'Сергей', 'Алексей', 'Рустам', 'Фаррух', 'Дилшод'];
const malL = ['Абдраимов', 'Беков', 'Джумалиев', 'Исаков', 'Мусаев', 'Орозбеков', 'Рахманов', 'Сатыбалдиев', 'Тологонов', 'Усенов', 'Шаршенов', 'Юсупов', 'Каримов', 'Назаров', 'Петров', 'Смирнов'];
function person(g, fromBank) {
  if (fromBank) { const c = bankPeople[bpi]; bpi += 7; used[c[1] + ' ' + c[2]] = 1; return { name: c[1] + ' ' + c[2], phone: c[7] }; }
  for (;;) { const nm = g === 'Ж' ? pick(femL) + ' ' + pick(femF) : pick(malL) + ' ' + pick(malF); if (used[nm]) continue; used[nm] = 1;
    return { name: nm, phone: R() < 0.85 ? '+996' + pick(['555', '700', '770', '505', '220', '999']) + String(rnd(100000, 999999)) : null }; }
}
const emps = []; let eid = 1;
const add = o => { o.id = eid++; emps.push(o); return o; };
const boss = add({ ...person('М', true), wh: null, pos: 'Директор по логистике', hire: D(2018, 3, 1), fire: null, mgr: null });
const ops = {}, drivers = {};
W.forEach(w => {
  const id = w[0], open = w[6];
  const head = add({ ...person(R() < 0.5 ? 'Ж' : 'М', R() < 0.4), wh: id, pos: w[4] === 'Пункт выдачи' ? 'Старший менеджер пункта' : 'Начальник склада', hire: Math.max(open, D(2018, 4, 1)) + rnd(0, 40) * DAY, fire: null, mgr: w[5] ? null : boss.id, ws: w });
  head.mgrWh = w[5];
  ops[id] = [head];
  const nOps = w[4] === 'Хаб' ? (id === 1 ? 4 : 2) : (w[4] === 'Склад' ? 1 : 1);
  for (let i = 0; i < nOps; i++) {
    let hire = id === 20 ? D(2026, 10, 20) : Math.max(open, D(2025, 1, 1) - rnd(-400, 1500) * DAY), fire = null;
    if (id !== 20 && R() < 0.2) fire = Math.min(D(2026, 10, 20), hire + rnd(150, 600) * DAY);
    ops[id].push(add({ ...person(R() < 0.65 ? 'Ж' : 'М', R() < 0.25), wh: id, pos: 'Оператор', hire, fire, mgr: head.id }));
  }
  if (w[4] === 'Хаб' && id !== 4) {
    const nd = id === 1 ? 7 : 2;
    drivers[id] = [];
    for (let i = 0; i < nd; i++) {
      const hire = Math.max(open, D(2025, 1, 1) - rnd(-300, 1800) * DAY);
      const fire = R() < 0.15 ? Math.min(D(2026, 9, 1), hire + rnd(200, 600) * DAY) : null;
      drivers[id].push(add({ ...person('М', R() < 0.2), wh: id, pos: 'Водитель', hire, fire, mgr: head.id }));
    }
  }
});
// начальники складов и пунктов подчиняются начальнику вышестоящего склада
emps.forEach(e => { if (e.mgr === null && e.mgrWh) e.mgr = ops[e.mgrWh][0].id; });
csv('Employees', ['EmployeeID', 'FullName', 'WarehouseID', 'Position', 'HireDate', 'FireDate', 'Phone', 'ManagerID'],
  emps.map(e => [e.id, e.name, e.wh, e.pos, fd(e.hire), e.fire ? fd(e.fire) : null, e.phone, e.mgr]));
const activeAt = (list, t) => list.filter(e => e.hire <= t && (!e.fire || e.fire > t));

/* Клиенты (отправители) */
const customers = [];
let cid = 1001;
for (let i = 1, n = 0; n < 28 && i < bankPeople.length; i += 3) { const c = bankPeople[i]; if (used[c[1] + ' ' + c[2]]) continue; used[c[1] + ' ' + c[2]] = 1; n++; customers.push({ id: cid++, name: c[1] + ' ' + c[2], type: c[9] === 'ИП' ? 'ИП' : 'Физлицо', country: 'Кыргызстан', city: c[6], phone: c[7], email: c[8], reg: D(2025, 1, 1) + rnd(0, 500) * DAY, w: 1 + R() * 2 }); }
const sellers = ['ИП Абдыкадырова Н. (одежда)', 'ИП Мамытов К. (обувь)', 'ОсОО «Ала-Тоо Трейд»', 'ОсОО «Кийим Экспорт»', 'ИП Сыдыкова Г. (текстиль)', 'ОсОО «Мед Плюс» (мёд)', 'ИП Ким В. (запчасти)', 'ОсОО «Курут-Маркет»', 'ИП Осмонова А. (сувениры)', 'ОсОО «Дордой Опт»', 'ИП Турдубаев Э. (электроника)', 'ОсОО «Жибек Жолу»', 'ООО «Москва-Бишкек Логистик»', 'ТОО «Алматы Маркет»', 'ИП Каримов Ф. (сухофрукты)', 'ОсОО «Нарын Жүн» (шерсть)'];
sellers.forEach((nm, i) => customers.push({ id: cid++, name: nm, type: nm.indexOf('ИП') === 0 ? 'ИП' : 'Компания', country: nm.indexOf('ООО') === 0 ? 'Россия' : (nm.indexOf('ТОО') === 0 ? 'Казахстан' : 'Кыргызстан'), city: nm.indexOf('ООО') === 0 ? 'Москва' : (nm.indexOf('ТОО') === 0 ? 'Алматы' : pick(['Бишкек', 'Бишкек', 'Ош'])), phone: R() < 0.9 ? '+996' + pick(['312', '555', '700', '770']) + String(rnd(100000, 999999)) : null, email: R() < 0.7 ? 'info' + (i + 1) + '@example.kg' : null, reg: D(rnd(2019, 2024), rnd(1, 12), rnd(1, 28)), w: 18 + R() * 25 }));
while (customers.length < 260) {
  const g = R() < 0.55 ? 'Ж' : 'М';
  const p = person(g);
  const ru = R() < 0.12, kz = !ru && R() < 0.08;
  customers.push({ id: cid++, name: p.name, type: 'Физлицо', country: ru ? 'Россия' : (kz ? 'Казахстан' : 'Кыргызстан'), city: ru ? pick(['Москва', 'Москва', 'Новосибирск', 'Екатеринбург', 'Санкт-Петербург']) : (kz ? 'Алматы' : wpick([['Бишкек', 8], ['Ош', 3], ['Каракол', 1], ['Джалал-Абад', 1]])), phone: ru ? (R() < 0.8 ? '+79' + rnd(100000000, 999999999) : null) : p.phone, email: R() < 0.35 ? 'user' + cid + '@mail.kg' : null, reg: D(2024, 6, 1) + rnd(0, 860) * DAY, w: 0.4 + R() });
}
// клиенты без отправлений: зарегистрировались, но ничего не отправили
customers.slice(-6).forEach(c => { c.w = 0; c.reg = D(2026, 10, rnd(1, 29)); });
csv('Customers', ['CustomerID', 'CustomerName', 'ClientType', 'Country', 'City', 'Phone', 'Email', 'RegDate'], customers.map(c => [c.id, c.name, c.type, c.country, c.city, c.phone, c.email, fd(c.reg)]));

/* Рейсы */
// [откуда, куда, транспорт, дней в пути, рейсов в неделю, дни недели]
// [откуда, куда, транспорт, дней в пути, дни недели, раз в N недель]
const routes = [
  [1, 3, 'Авто', 1, [2, 5], 1], [1, 2, 'Авто', 6, [2], 1], [1, 2, 'Авиа', 1, [1, 4], 1], [1, 6, 'Авто', 4, [4], 2], [1, 7, 'Авто', 5, [3], 2],
  [1, 8, 'Авиа', 1, [2], 1], [1, 9, 'Авто', 6, [1], 2], [1, 4, 'Авто', 2, [2], 2], [1, 11, 'Авто', 2, [4], 2], [1, 12, 'Авто', 3, [6], 2],
  [1, 10, 'Авто', 8, [1], 3], [5, 4, 'Авто', 1, [3], 2], [2, 1, 'Авто', 6, [3], 1], [2, 1, 'Авиа', 1, [6], 2], [3, 1, 'Авто', 1, [3], 1]
];
const trips = []; let tid = 1;
const tripsByRoute = {};
const tripNo = {};
routes.forEach(rt => {
  const key = rt[0] + '-' + rt[1] + '-' + rt[2];
  tripsByRoute[key] = [];
  const open = Math.max(wh[rt[0]].open, wh[rt[1]].open, START);
  for (let d = open; d <= D(2026, 11, 7); d += DAY) {
    const wd = new Date(d).getUTCDay();
    if (rt[4].indexOf(wd) < 0) continue;
    if (Math.floor((d - START) / (7 * DAY)) % rt[5] !== 0) continue;
    const depart = d + (rt[2] === 'Авиа' ? rnd(5, 9) : rnd(18, 22)) * HOUR + pick([0, 15, 30, 45]) * MIN;
    const code = wh[rt[0]].code + '-' + wh[rt[1]].code;
    tripNo[code] = (tripNo[code] || 0) + 1;
    const t = { id: tid++, no: code + (rt[2] === 'Авиа' ? 'A' : '') + '-' + String(tripNo[code]).padStart(4, '0'), from: rt[0], to: rt[1], tr: rt[2], depart, driver: null, arrive: null, status: null };
    if (rt[2] === 'Авто') { const ds = activeAt(drivers[rt[0]] || [], depart); t.driver = ds.length ? pick(ds).id : null; }
    const delay = rt[2] === 'Авиа' ? (R() < 0.1 ? rnd(2, 20) : 0) * HOUR : (R() < 0.2 ? rnd(6, 72) : rnd(-4, 4)) * HOUR;
    const plannedArr = depart + rt[3] * DAY + (rt[2] === 'Авиа' ? rnd(4, 6) * HOUR : 0) + delay;
    if (R() < 0.02 && depart < END) { t.status = 'Отменён'; }
    else if (depart > END) t.status = 'Запланирован';
    else if (plannedArr > END) t.status = 'В пути';
    else { t.status = 'Прибыл'; t.arrive = plannedArr; }
    trips.push(t); tripsByRoute[key].push(t);
  }
});
function nextTrip(from, to, tr, after) {
  const list = tripsByRoute[from + '-' + to + '-' + tr];
  if (!list) return null;
  for (const t of list) if (t.depart >= after && t.status !== 'Отменён') return t;
  return null;
}

/* Отправления */
const ships = []; let sid = 1;
const destKG = [[13, 4], [14, 3], [15, 1], [16, 1], [1, 3], [5, 2]];
const destOut = [[2, 9], [17, 5], [18, 3], [6, 3], [7, 3], [8, 3], [9, 2], [10, 1], [3, 5], [11, 2], [4, 2], [19, 1], [12, 2]];
const kgOrigins = [[1, 6], [13, 3], [14, 2], [5, 2], [15, 0.6], [16, 0.6]];
const receivers = () => { const g = R() < 0.5 ? 'Ж' : 'М'; return (g === 'Ж' ? pick(femL) + ' ' + pick(femF) : pick(malL) + ' ' + pick(malF)); };
for (let d = START; d <= D(2026, 10, 31); d += DAY) {
  const dt = new Date(d), wd = dt.getUTCDay(), m = dt.getUTCMonth() + 1;
  if (wd === 0 && R() < 0.7) continue;
  let n = 9 + (m === 11 || m === 12 ? 3 : 0) + (dt.getUTCFullYear() === 2026 ? 2 : 0) + rnd(-2, 2);
  for (let k = 0; k < n; k++) {
    const cust = wpick(customers.filter(c => c.w > 0 && c.reg <= d).map(c => [c, c.w]));
    const reverse = cust.country !== 'Кыргызстан' || R() < 0.06;
    let from, to;
    if (reverse) { from = cust.country === 'Казахстан' ? 3 : 2; to = wpick(destKG); }
    else { from = wpick(kgOrigins.filter(o => wh[o[0]].open <= d)); to = wpick(destOut.filter(o => wh[o[0]].open <= d)); }
    const nf = node(from), nt = node(to);
    // главный узел отправки в Кыргызстане — хаб Бишкек (из Оша в Ташкент — напрямую)
    let hubFrom = (nf === 5 && nt === 4) ? 5 : (wh[nf].country === 'Кыргызстан' ? 1 : nf);
    let hubTo = wh[nt].country === 'Кыргызстан' ? 1 : nt;
    const airOk = !!tripsByRoute[hubFrom + '-' + hubTo + '-Авиа'];
    const big = cust.type !== 'Физлицо' && R() < 0.25;
    const tariffId = big ? 4 : (airOk && R() < 0.3 ? 3 : (R() < 0.45 ? 1 : 2));
    const t = tf[tariffId === 2 && d < D(2025, 3, 1) && R() < 0.5 ? 5 : tariffId];
    const weight = tariffId === 4 ? r2(30 + R() * 250) : r2(Math.max(0.2, Math.pow(R(), 2) * 25));
    const created = d + rnd(9, 19) * HOUR + rnd(0, 59) * MIN + rnd(0, 59) * 1000;
    const opsHere = activeAt(ops[from], created).filter(e => e.pos === 'Оператор');
    const acceptor = opsHere.length ? pick(opsHere) : pick(activeAt(ops[from], created));
    const cost = r2(Math.max(weight * t.kg, t.min));
    const declared = R() < 0.55 ? Math.round(rnd(10, 300) * 100) : null;
    let trip = nextTrip(hubFrom, hubTo, t.tr === 'Ж/д' ? 'Авто' : t.tr, created + rnd(4, 40) * HOUR);
    let status, delivered = null;
    if (R() < 0.02) { status = 'Отменён'; trip = null; }
    else if (!trip || trip.status === 'Запланирован') status = 'Принят';
    else if (trip.status === 'В пути') status = 'В пути';
    else {
      const lastMile = to !== nt || (hubTo !== nt) ? rnd(1, 3) * DAY : rnd(2, 10) * HOUR;
      const atDest = trip.arrive + lastMile;
      const wait = wpick([[rnd(1, 48) * HOUR, 60], [rnd(2, 6) * DAY, 30], [rnd(7, 20) * DAY, 8], [rnd(21, 45) * DAY, 2]]);
      const r = R();
      if (r < 0.004) status = 'Утерян';
      else if (r < 0.02 && atDest + 30 * DAY < END) status = 'Возврат';
      else if (atDest + wait <= END) { status = 'Выдан'; delivered = atDest + wait; }
      else status = 'Прибыл';
    }
    ships.push({ id: sid++, track: 'CRG' + String(100000000 + sid * 37 + rnd(0, 36)).slice(0, 9), cust, recv: receivers(), rphone: R() < 0.88 ? (wh[to].country === 'Россия' ? '+79' + rnd(100000000, 999999999) : '+996' + pick(['555', '700', '770', '777']) + String(rnd(100000, 999999))) : null, from, to, t, trip, acceptor, created, weight, declared, cost, status, delivered });
  }
}
csv('Trips', ['TripID', 'TripNo', 'FromWarehouseID', 'ToWarehouseID', 'Transport', 'DriverID', 'DepartAt', 'ArriveAt', 'Status'], trips.map(t => [t.id, t.no, t.from, t.to, t.tr, t.driver, fdt(t.depart), t.arrive ? fdt(t.arrive) : null, t.status]));
csv('Shipments', ['ShipmentID', 'TrackNo', 'CustomerID', 'ReceiverName', 'ReceiverPhone', 'FromWarehouseID', 'ToWarehouseID', 'TariffID', 'TripID', 'AcceptedBy', 'CreatedAt', 'WeightKg', 'DeclaredValue', 'Cost', 'Status', 'DeliveredAt'],
  ships.map(s => [s.id, s.track, s.cust.id, s.recv, s.rphone, s.from, s.to, s.t.id, s.trip ? s.trip.id : null, s.acceptor.id, fdt(s.created), s.weight.toFixed(2), s.declared !== null ? s.declared.toFixed(2) : null, s.cost.toFixed(2), s.status, s.delivered ? fdt(s.delivered) : null]));

/* Претензии */
const claims = []; let clid = 1;
ships.forEach(s => {
  let reason = null, base;
  if (s.status === 'Утерян') { reason = 'Утеря'; base = s.trip.arrive + 10 * DAY; }
  else if (s.status === 'Выдан') {
    const days = (s.trip.arrive - s.created) / DAY;
    if (R() < 0.01) { reason = 'Повреждение'; base = s.delivered + rnd(0, 3) * DAY; }
    else if (days > s.t.days + 2 && R() < 0.3) { reason = 'Задержка'; base = s.delivered + rnd(0, 5) * DAY; }
  }
  if (!reason) return;
  const cdate = Math.floor(base / DAY) * DAY;
  if (cdate > D(2026, 10, 31)) return;
  const age = (D(2026, 10, 31) - cdate) / DAY;
  let status = age < 14 ? 'На рассмотрении' : wpick([['Удовлетворена', 65], ['Отклонена', 35]]);
  if (reason === 'Утеря' && age >= 14) status = 'Удовлетворена';
  let amount = null;
  if (status === 'Удовлетворена') amount = reason === 'Утеря' ? (s.declared !== null ? s.declared : s.cost * 3) : (reason === 'Повреждение' ? Math.round((s.declared !== null ? s.declared : s.cost * 2) * (0.3 + R() * 0.7)) : Math.round(s.cost * 0.5));
  claims.push([clid++, s.id, fd(cdate), reason, status, amount !== null ? Number(amount).toFixed(2) : null]);
});
csv('Claims', ['ClaimID', 'ShipmentID', 'ClaimDate', 'Reason', 'Status', 'Amount'], claims);
