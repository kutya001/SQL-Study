// Генератор учебной базы «Учебный маркет» (детерминированный)
globalThis.window = globalThis;
const fs = require('fs'), path = require('path');
const root = require('path').resolve(__dirname, '../..') + '/';
['js/engine/tsql-core.js','js/engine/tsql-parser.js','js/engine/tsql-funcs.js','js/engine/tsql-exec.js','js/engine/bankdb.js'].forEach(f => require(root + f));
const T = globalThis.TSQL;
const OUT = root + 'schemas/shop/data/';
fs.mkdirSync(OUT, { recursive: true });

let seed = 77117;
function R() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const rnd = (a, b) => a + Math.floor(R() * (b - a + 1));
const pick = a => a[Math.floor(R() * a.length)];
const wpick = pairs => { let s = 0; pairs.forEach(p => s += p[1]); let x = R() * s; for (const p of pairs) { x -= p[1]; if (x <= 0) return p[0]; } return pairs[pairs.length - 1][0]; };
const pad = n => String(n).padStart(2, '0');
const DAY = 86400000;
const D = (y, m, d) => Date.UTC(y, m - 1, d);
const fd = t => { const d = new Date(t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
const fdt = t => { const d = new Date(t); return fd(t) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()); };
const r2 = x => Math.round(x * 100) / 100;
function csv(name, header, rows) {
  const q = v => { if (v === null || v === undefined) return ''; const s = String(v); return /[",\n]/.test(s) || s === '' ? '"' + s.replace(/"/g, '""') + '"' : s; };
  fs.writeFileSync(OUT + name + '.csv', [header.join(',')].concat(rows.map(r => r.map(q).join(','))).join('\n') + '\n');
  console.log(name, rows.length);
}

/* Магазины */
const stores = [
  [1, 'Учебный маркет — Центр', 'Бишкек', 'пр. Чуй, 150', D(2018, 3, 1), 1200, 'Супермаркет'],
  [2, 'Учебный маркет — Восток', 'Бишкек', 'ул. Ахунбаева, 98', D(2019, 9, 15), 650, 'У дома'],
  [3, 'Учебный маркет — Юг', 'Бишкек', 'ул. Ахунбаева, 210', D(2021, 5, 20), 2400, 'Гипермаркет'],
  [4, 'Учебный маркет — Ош', 'Ош', 'ул. Курманжан Датки, 14', D(2020, 4, 10), 900, 'Супермаркет'],
  [5, 'Учебный маркет — Каракол', 'Каракол', 'ул. Торутаева, 77', D(2022, 6, 1), 480, 'У дома'],
  [6, 'Учебный маркет — Токмок', 'Токмок', 'ул. Шамсинская, 5', D(2026, 3, 2), 520, 'У дома'],
  [7, 'Учебный маркет — Джал', 'Бишкек', 'мкр. Джал, 23/1', D(2026, 11, 2), 700, 'Супермаркет']
];
csv('Stores', ['StoreID', 'StoreName', 'City', 'Address', 'OpenDate', 'AreaSqm', 'Format'], stores.map(s => [s[0], s[1], s[2], s[3], fd(s[4]), s[5], s[6]]));

/* Категории (двухуровневые) */
const cats = [
  [1, 'Продукты питания', null], [2, 'Напитки', null], [3, 'Бытовая химия', null], [4, 'Товары для дома', null],
  [10, 'Молочные продукты', 1], [11, 'Хлеб и выпечка', 1], [12, 'Мясо и птица', 1], [13, 'Овощи и фрукты', 1], [14, 'Бакалея', 1], [15, 'Кондитерские изделия', 1],
  [20, 'Соки и воды', 2], [21, 'Чай и кофе', 2],
  [30, 'Моющие средства', 3], [31, 'Средства гигиены', 3],
  [40, 'Посуда', 4], [41, 'Текстиль', 4]
];
csv('Categories', ['CategoryID', 'CategoryName', 'ParentID'], cats);

/* Товары: [название, категория, бренд, ед., цена, себестоимость %, популярность] */
const P = [
  ['Молоко 3,2% 1 л', 10, 'Ак-Сүт', 'шт', 78, .78, 30], ['Кефир 2,5% 1 л', 10, 'Ак-Сүт', 'шт', 82, .78, 14], ['Сметана 20% 400 г', 10, 'Ак-Сүт', 'шт', 115, .77, 10],
  ['Творог 9% 500 г', 10, 'Бишкек Сүт', 'шт', 210, .75, 8], ['Сыр «Российский»', 10, 'Бишкек Сүт', 'кг', 890, .72, 6], ['Масло сливочное 82% 200 г', 10, 'Ак-Сүт', 'шт', 245, .8, 9],
  ['Айран 1 л', 10, 'Бишкек Сүт', 'шт', 70, .76, 12], ['Йогурт клубничный 300 г', 10, null, 'шт', 95, .7, 7],
  ['Лепёшка тандырная', 11, null, 'шт', 35, .6, 34], ['Хлеб формовой', 11, 'Нан', 'шт', 32, .62, 28], ['Батон нарезной', 11, 'Нан', 'шт', 40, .62, 12], ['Самса с мясом', 11, null, 'шт', 75, .55, 10],
  ['Говядина (мякоть)', 12, null, 'кг', 720, .82, 9], ['Баранина (корейка)', 12, null, 'кг', 820, .83, 5], ['Курица (тушка)', 12, 'Курица.kg', 'кг', 310, .8, 11], ['Фарш говяжий', 12, null, 'кг', 650, .8, 6],
  ['Картофель', 13, null, 'кг', 38, .65, 25], ['Лук репчатый', 13, null, 'кг', 30, .6, 20], ['Морковь', 13, null, 'кг', 35, .6, 16], ['Помидоры', 13, null, 'кг', 120, .62, 14],
  ['Огурцы', 13, null, 'кг', 95, .62, 12], ['Яблоки «Иссык-Куль»', 13, null, 'кг', 110, .6, 13], ['Бананы', 13, null, 'кг', 145, .7, 10], ['Лимоны', 13, null, 'кг', 240, .65, 4],
  ['Рис девзира 1 кг', 14, 'Ош-Гүрүч', 'шт', 210, .74, 8], ['Мука в/с 2 кг', 14, 'Бишкек Ун', 'шт', 125, .78, 9], ['Сахар 1 кг', 14, null, 'шт', 95, .85, 12], ['Масло подсолнечное 1 л', 14, 'Алтын', 'шт', 165, .8, 11],
  ['Макароны 400 г', 14, 'Макфа', 'шт', 68, .72, 9], ['Гречка 900 г', 14, null, 'шт', 145, .76, 5], ['Соль 1 кг', 14, null, 'шт', 25, .6, 4], ['Яйца С1, 10 шт', 14, 'Ак-Куш', 'шт', 150, .8, 18],
  ['Шоколад молочный 90 г', 15, 'Шоро', 'шт', 85, .65, 9], ['Печенье овсяное 300 г', 15, null, 'шт', 110, .66, 7], ['Конфеты «Ассорти» 1 кг', 15, 'Шоро', 'шт', 640, .68, 3], ['Торт «Медовик»', 15, null, 'шт', 780, .6, 2],
  ['Вода минеральная 1,5 л', 20, 'Арашан', 'шт', 55, .55, 16], ['Вода питьевая 5 л', 20, 'Арашан', 'шт', 120, .55, 7], ['Сок яблочный 1 л', 20, 'Шоро', 'шт', 135, .66, 8], ['Максым 1 л', 20, 'Шоро', 'шт', 60, .6, 13],
  ['Лимонад 1 л', 20, null, 'шт', 75, .55, 7], ['Чай чёрный 100 пак.', 21, 'Ахмад', 'шт', 260, .7, 8], ['Чай зелёный 250 г', 21, null, 'шт', 180, .68, 5], ['Кофе растворимый 100 г', 21, 'Якобс', 'шт', 520, .73, 4],
  ['Порошок стиральный 3 кг', 30, 'Ариэль', 'шт', 890, .74, 3], ['Средство для посуды 500 мл', 30, 'Фейри', 'шт', 165, .7, 6], ['Чистящее средство 750 мл', 30, null, 'шт', 145, .68, 3],
  ['Мыло туалетное', 31, null, 'шт', 45, .6, 7], ['Шампунь 400 мл', 31, 'Хэд энд Шолдерс', 'шт', 390, .72, 4], ['Зубная паста 100 мл', 31, 'Колгейт', 'шт', 160, .7, 5], ['Бумага туалетная 4 рул.', 31, null, 'шт', 120, .7, 9],
  ['Пиала керамическая', 40, null, 'шт', 95, .5, 3], ['Чайник заварочный', 40, null, 'шт', 450, .5, 1], ['Казан чугунный 8 л', 40, null, 'шт', 3200, .55, 0.3], ['Полотенце кухонное', 41, null, 'шт', 180, .5, 2],
  ['Скатерть хлопковая', 41, null, 'шт', 950, .5, 0.4], ['Плед шерстяной', 41, null, 'шт', 2600, .55, 0.2],
  // не продавались: новые или выведенные товары
  ['Курт солёный 200 г', 10, 'Ак-Сүт', 'шт', 160, .7, 0], ['Боорсок 500 г', 11, null, 'шт', 140, .6, 0], ['Кофе в зёрнах 1 кг', 21, 'Якобс', 'шт', 1900, .7, 0]
];
const products = P.map((p, i) => {
  const id = 101 + i;
  const added = p[6] === 0 ? D(2026, 10, rnd(5, 28)) : D(2024, rnd(1, 12), rnd(1, 28));
  return { id, name: p[0], cat: p[1], brand: p[2], unit: p[3], price: p[4], cost: r2(p[4] * p[5]), pop: p[6], active: p[0] === 'Боорсок 500 г' ? 0 : 1, added };
});
csv('Products', ['ProductID', 'ProductName', 'CategoryID', 'Brand', 'Unit', 'Price', 'CostPrice', 'IsActive', 'AddedDate'], products.map(p => [p.id, p.name, p.cat, p.brand, p.unit, p.price.toFixed(2), p.cost.toFixed(2), p.active, fd(p.added)]));

/* Покупатели: часть — клиенты Учебного банка (совпадают ФИО и телефон) */
const bank = T.buildBankDb();
const bankClients = bank.tables.clients.rows.filter(r => r[7]).slice(0, 220);
const customers = [];
const cities = [['Бишкек', 60], ['Ош', 14], ['Каракол', 8], ['Токмок', 6]];
const lastM = ['Асанов', 'Бакиров', 'Жумабеков', 'Касымов', 'Мамытов', 'Осмонов', 'Токтогулов', 'Иванов', 'Ким', 'Садыков', 'Абдыкалыков', 'Турдубаев', 'Эсенов', 'Байтиков', 'Петров', 'Назаров'];
const firstM = ['Бакыт', 'Нурлан', 'Эрлан', 'Азамат', 'Улан', 'Тимур', 'Алексей', 'Марат', 'Данияр', 'Руслан', 'Айбек', 'Сергей'];
const firstF = ['Айгуль', 'Асель', 'Динара', 'Жылдыз', 'Гульмира', 'Нургуль', 'Анна', 'Елена', 'Айпери', 'Бермет', 'Мээрим', 'Ольга'];
let cid = 1;
for (let i = 0; i < 46; i++) {
  const c = bankClients[i * 4 + 1];
  customers.push([cid++, c[1] + ' ' + c[2], c[4], fd(c[5]), c[7], c[6], '7700' + String(rnd(10000000, 99999999)) + String(rnd(1000, 9999)), fd(D(2025, rnd(1, 12), rnd(1, 28)))]);
}
while (customers.length < 160) {
  const g = R() < 0.55 ? 'Ж' : 'М';
  const ln = pick(lastM), fn = g === 'Ж' ? pick(firstF) : pick(firstM);
  const lname = g === 'Ж' ? (/(ов|ев|ин)$/.test(ln) ? ln + 'а' : ln) : ln;
  const hasPhone = R() < 0.85, hasCard = R() < 0.7, hasBirth = R() < 0.8;
  const reg = D(2025, 1, 1) + rnd(0, 660) * DAY;
  customers.push([cid++, lname + ' ' + fn, g, hasBirth ? fd(D(rnd(1958, 2006), rnd(1, 12), rnd(1, 28))) : null, hasPhone ? '+996' + pick(['555', '700', '770', '505', '220', '999']) + String(rnd(100000, 999999)) : null, wpick(cities), hasCard ? '7700' + String(rnd(10000000, 99999999)) + String(rnd(1000, 9999)) : null, fd(reg)]);
}
csv('Customers', ['CustomerID', 'FullName', 'Gender', 'BirthDate', 'Phone', 'City', 'CardNumber', 'RegDate'], customers);

/* Сотрудники */
const emps = [[1, 'Сулайманова Айнура', null, 'Управляющий сетью', D(2018, 1, 15), 180000, null]];
let eid = 2;
const dirs = {};
const cashiersByStore = {};
const fnames = ['Абдраимова Гульнара', 'Беков Талант', 'Ворошилова Ирина', 'Давлетов Мирлан', 'Ешенова Аида', 'Жапаров Нурсултан', 'Зайцева Наталья', 'Исаков Бектур', 'Кадырова Салтанат', 'Логинов Павел', 'Маматова Чолпон', 'Нуралиев Эмиль', 'Омурбекова Каныкей', 'Пак Виктория', 'Рахманов Аскар', 'Сатыбалдиева Элиза', 'Тологонов Медер', 'Усенова Перизат', 'Федорова Алина', 'Хасанов Ислам', 'Чыныбаева Айжан', 'Шаршенов Канат', 'Ысаков Самат', 'Эркинбаева Нурай', 'Юсупов Арслан', 'Яковлева Дарья', 'Абдылдаев Бек', 'Борубаева Сезим', 'Галиев Ренат', 'Джумалиева Айсулуу', 'Исмаилов Тимур', 'Конокбаева Венера', 'Мусаев Айдар', 'Нурланова Алия'];
let fi = 0;
stores.forEach(s => {
  const sid = s[0];
  const hire0 = Math.max(s[4], D(2018, 1, 1));
  dirs[sid] = eid;
  emps.push([eid++, fnames[fi++], sid, 'Директор магазина', hire0, 120000 + rnd(0, 6) * 5000, 1]);
  const n = sid === 7 ? 2 : (s[6] === 'Гипермаркет' ? 6 : (s[6] === 'Супермаркет' ? 4 : 3));
  cashiersByStore[sid] = [];
  for (let k = 0; k < n; k++) {
    const pos = k < Math.ceil(n / 2) ? 'Кассир' : (k === n - 1 ? 'Товаровед' : 'Продавец-консультант');
    const hire = Math.min(D(2026, 10, 1), hire0 + rnd(0, 900) * DAY);
    emps.push([eid, fnames[fi++ % fnames.length] + (fi > fnames.length ? ' мл.' : ''), sid, pos, hire, (pos === 'Кассир' ? 52000 : pos === 'Товаровед' ? 68000 : 48000) + rnd(0, 8) * 1000, dirs[sid]]);
    if (pos === 'Кассир') cashiersByStore[sid].push([eid, hire]);
    eid++;
  }
});
csv('Employees', ['EmployeeID', 'FullName', 'StoreID', 'Position', 'HireDate', 'Salary', 'ManagerID'], emps.map(e => [e[0], e[1], e[2], e[3], fd(e[4]), e[5].toFixed(2), e[6]]));

/* Чеки и позиции */
const orders = [], items = [];
let oid = 100001, iid = 1;
const start = D(2025, 1, 1), end = D(2026, 10, 31);
const storeW = { 1: 9, 2: 5, 3: 12, 4: 7, 5: 3, 6: 3, 7: 0 };
const popTotal = products.reduce((s, p) => s + p.pop, 0);
const prodPairs = products.filter(p => p.pop > 0).map(p => [p, p.pop]);
for (let d = start; d <= end; d += DAY) {
  const dt = new Date(d), wd = dt.getUTCDay(), m = dt.getUTCMonth() + 1;
  let n = 3 + (wd === 6 || wd === 0 ? 2 : 0) + (m === 12 ? 2 : 0) + (dt.getUTCFullYear() === 2026 ? 1 : 0);
  n = Math.max(1, n + rnd(-1, 1));
  for (let k = 0; k < n; k++) {
    const sid = wpick(Object.keys(storeW).map(x => [+x, d >= stores[x - 1][4] ? storeW[x] : 0]).filter(p => p[1] > 0));
    const cashiers = cashiersByStore[sid].filter(c => c[1] <= d);
    if (!cashiers.length) continue;
    const t = d + rnd(8, 21) * 3600000 + rnd(0, 59) * 60000 + rnd(0, 59) * 1000;
    const cust = R() < 0.62 ? customers[rnd(0, customers.length - 1)] : null;
    const custId = cust && Date.parse(cust[7]) <= d ? cust[0] : null;
    const pay = wpick([['Карта', 45], ['Наличные', 35], ['QR-оплата', d > D(2025, 6, 1) ? 25 : 5]]);
    const status = wpick([['Оплачен', 94], ['Возврат', 3.5], ['Отменён', 2.5]]);
    orders.push([oid, fdt(t), sid, custId, pick(cashiers)[0], pay, status]);
    const cnt = wpick([[1, 22], [2, 26], [3, 22], [4, 14], [5, 9], [6, 7]]);
    const used = {};
    for (let j = 0; j < cnt; j++) {
      const p = wpick(prodPairs);
      if (used[p.id] || p.added > d) continue;
      used[p.id] = 1;
      const qty = p.unit === 'кг' ? r2(rnd(3, 25) / 10 * (p.price > 500 ? 1 : 1.5)) : wpick([[1, 70], [2, 20], [3, 7], [5, 3]]);
      const price = dt.getUTCFullYear() === 2025 ? r2(Math.round(p.price * 0.93)) : p.price;
      const disc = custId && R() < 0.25 ? pick([5, 10, 15]) : 0;
      items.push([iid++, oid, p.id, p.unit === 'кг' ? qty.toFixed(3) : qty.toFixed(3), price.toFixed(2), disc.toFixed(2)]);
    }
    oid++;
  }
}
csv('Orders', ['OrderID', 'OrderDate', 'StoreID', 'CustomerID', 'EmployeeID', 'PaymentType', 'Status'], orders);
csv('OrderItems', ['OrderItemID', 'OrderID', 'ProductID', 'Quantity', 'Price', 'DiscountPct'], items);

/* Остатки на 31.10.2026 */
const stock = [];
stores.forEach(s => {
  if (s[0] === 7) return;
  products.forEach(p => {
    if (R() < (s[6] === 'У дома' ? 0.25 : 0.1)) return;
    const q = p.unit === 'кг' ? r2(rnd(0, 800) / 10) : rnd(0, 120);
    stock.push([s[0], p.id, q.toFixed(3), fdt(D(2026, 10, 31) + rnd(7, 22) * 3600000)]);
  });
});
csv('Stock', ['StoreID', 'ProductID', 'Quantity', 'UpdatedAt'], stock);
