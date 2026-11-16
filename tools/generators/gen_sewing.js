// Генератор учебной базы «Швейная фабрика» (детерминированный)
globalThis.window = globalThis;
const fs = require('fs');
const root = require('path').resolve(__dirname, '../..') + '/';
['js/engine/tsql-core.js','js/engine/tsql-parser.js','js/engine/tsql-funcs.js','js/engine/tsql-exec.js','js/engine/bankdb.js'].forEach(f => require(root + f));
const T = globalThis.TSQL;
const OUT = root + 'schemas/sewing/data/';
fs.mkdirSync(OUT, { recursive: true });

let seed = 50520261;
function R() { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const rnd = (a, b) => a + Math.floor(R() * (b - a + 1));
const pick = a => a[Math.floor(R() * a.length)];
const wpick = pairs => { let s = 0; pairs.forEach(p => s += p[1]); let x = R() * s; for (const p of pairs) { x -= p[1]; if (x <= 0) return p[0]; } return pairs[pairs.length - 1][0]; };
const pad = n => String(n).padStart(2, '0');
const DAY = 86400000, HOUR = 3600000;
const D = (y, m, d) => Date.UTC(y, m - 1, d);
const fd = t => { const d = new Date(t); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
const fdt = t => { const d = new Date(t); return fd(t) + ' ' + pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes()) + ':' + pad(d.getUTCSeconds()); };
const r2 = x => Math.round(x * 100) / 100;
const START = D(2025, 1, 1), END = D(2026, 10, 31);
function csv(name, header, rows) {
  const q = v => { if (v === null || v === undefined) return ''; const s = String(v); return /[",\n]/.test(s) || s === '' ? '"' + s.replace(/"/g, '""') + '"' : s; };
  fs.writeFileSync(OUT + name + '.csv', [header.join(',')].concat(rows.map(r => r.map(q).join(','))).join('\n') + '\n');
  console.log(name, rows.length);
}

/* Цеха */
const workshops = [
  [1, 'Раскройный цех', 'Раскрой', 'Бишкек', 4, D(2016, 3, 1)],
  [2, 'Швейный цех № 1', 'Пошив', 'Бишкек', 3, D(2016, 3, 1)],
  [3, 'Швейный цех № 2', 'Пошив', 'Бишкек', 3, D(2019, 8, 15)],
  [4, 'Швейный цех «Токмок»', 'Пошив', 'Токмок', 2, D(2025, 9, 1)],
  [5, 'Цех ВТО и упаковки', 'ВТО и упаковка', 'Бишкек', 2, D(2016, 3, 1)],
  [6, 'Швейный цех «Кара-Балта»', 'Пошив', 'Кара-Балта', 1, D(2026, 10, 19)]
];
csv('Workshops', ['WorkshopID', 'WorkshopName', 'Kind', 'City', 'LinesCount', 'OpenDate'], workshops.map(w => [w[0], w[1], w[2], w[3], w[4], fd(w[5])]));

/* Ассортиментные группы: [id, название, сезон, допустимый брак %, префикс артикула, норма мин (от-до), себестоимость (от-до), ткани, размеры, сезонность по месяцам 1..12] */
const flat = [1,1,1,1,1,1,1,1,1,1,1,1];
const groups = [
  [1, 'Футболки и поло', 'Весна-лето', 1.5, 'FT', [16, 26], [240, 420], ['Кулирка', 'Пике'], '42-56', [0.6,0.8,1.2,1.5,1.7,1.6,1.3,1,0.8,0.6,0.5,0.6]],
  [2, 'Рубашки и блузки', 'Всесезон', 2.0, 'RB', [42, 62], [560, 920], ['Поплин', 'Штапель'], '40-54', flat],
  [3, 'Платья', 'Весна-лето', 2.5, 'PL', [58, 95], [880, 1550], ['Штапель', 'Шифон', 'Трикотаж'], '42-54', [0.6,0.8,1.3,1.6,1.7,1.5,1.2,0.9,0.8,0.7,0.6,0.9]],
  [4, 'Брюки и джинсы', 'Всесезон', 2.0, 'BR', [48, 72], [680, 1120], ['Деним', 'Габардин'], '44-58', flat],
  [5, 'Юбки', 'Весна-лето', 1.8, 'UB', [32, 52], [480, 820], ['Габардин', 'Штапель'], '42-54', [0.7,0.9,1.2,1.4,1.4,1.2,1,1,0.9,0.8,0.7,0.8]],
  [6, 'Худи и свитшоты', 'Осень-зима', 2.0, 'HD', [38, 56], [690, 1020], ['Футер'], '44-58', [1.2,1,0.8,0.6,0.5,0.5,0.7,1,1.4,1.5,1.4,1.3]],
  [7, 'Куртки и ветровки', 'Осень-зима', 3.0, 'KR', [115, 185], [1750, 2850], ['Плащёвка', 'Мембрана'], '44-60', [1,0.9,0.9,0.9,0.5,0.4,0.6,1,1.5,1.6,1.4,1.2]],
  [8, 'Пальто и плащи', 'Осень-зима', 3.5, 'PT', [170, 245], [2750, 4250], ['Драп', 'Плащёвка'], '44-58', [0.9,0.7,0.8,0.7,0.3,0.2,0.4,0.9,1.6,1.8,1.5,1.1]],
  [9, 'Школьная форма', 'Всесезон', 1.5, 'SF', [60, 150], [880, 1820], ['Костюмная'], '122-176', [0.3,0.3,0.4,0.6,1.2,2.2,2.8,2.4,0.6,0.3,0.3,0.3]],
  [10, 'Спецодежда', 'Всесезон', 1.0, 'SP', [48, 120], [780, 1520], ['Смесовая', 'Саржа'], '44-62', flat]
];
csv('ProductGroups', ['GroupID', 'GroupName', 'Season', 'PlanDefectPct'], groups.map(g => [g[0], g[1], g[2], g[3].toFixed(2)]));

/* Модели */
const modelNames = {
  1: ['Футболка базовая', 'Футболка оверсайз', 'Футболка детская', 'Поло мужское', 'Поло женское', 'Лонгслив'],
  2: ['Рубашка мужская классическая', 'Рубашка мужская casual', 'Блузка офисная', 'Блузка с бантом', 'Рубашка детская'],
  3: ['Платье-футляр', 'Платье летнее', 'Платье в пол', 'Платье трикотажное', 'Сарафан', 'Платье детское'],
  4: ['Джинсы прямые', 'Джинсы скинни', 'Брюки классические', 'Брюки карго', 'Брюки женские палаццо', 'Брюки детские'],
  5: ['Юбка-карандаш', 'Юбка плиссе', 'Юбка А-силуэт', 'Юбка миди'],
  6: ['Худи базовое', 'Худи на молнии', 'Свитшот', 'Свитшот детский', 'Худи оверсайз'],
  7: ['Куртка демисезонная', 'Ветровка', 'Куртка утеплённая', 'Парка', 'Куртка детская'],
  8: ['Пальто классическое', 'Пальто оверсайз', 'Плащ-тренч', 'Пальто детское'],
  9: ['Пиджак школьный', 'Брюки школьные', 'Сарафан школьный', 'Жилет школьный', 'Юбка школьная', 'Рубашка школьная'],
  10: ['Халат медицинский', 'Костюм рабочий', 'Комбинезон рабочий', 'Фартук поварской', 'Куртка рабочая утеплённая']
};
const products = [];
let pid = 1001;
const gById = {}; groups.forEach(g => gById[g[0]] = g);
groups.forEach(g => {
  modelNames[g[0]].forEach((nm, i) => {
    const norm = Math.round((g[5][0] + R() * (g[5][1] - g[5][0])) * 2) / 2;
    const cost = Math.round((g[6][0] + R() * (g[6][1] - g[6][0])) / 10) * 10;
    const markup = 1.35 + R() * 0.3;
    const sizes = /детск/i.test(nm) ? '98-140' : (g[0] === 9 ? '122-176' : g[8]);
    products.push({ id: pid++, art: g[4] + '-' + (101 + i), name: nm, grp: g[0], fabric: pick(g[7]), sizes, norm, cost, price: Math.round(cost * markup / 10) * 10, active: 1, launch: D(rnd(2023, 2024), rnd(1, 12), rnd(1, 28)), pop: 0.6 + R() });
  });
});
// выведены из ассортимента и новинки октября 2026 (ещё не шились и не заказывались)
products.find(p => p.art === 'FT-103').active = 0;
products.find(p => p.art === 'RB-102').active = 0;
[['HD-106', 'Худи с принтом', 6], ['KR-106', 'Пуховик облегчённый', 7], ['PL-107', 'Платье-рубашка', 3]].forEach(([art, nm, gi]) => {
  const g = gById[gi];
  const cost = Math.round((g[6][0] + R() * (g[6][1] - g[6][0])) / 10) * 10;
  products.push({ id: pid++, art, name: nm, grp: gi, fabric: pick(g[7]), sizes: g[8], norm: Math.round((g[5][0] + R() * (g[5][1] - g[5][0])) * 2) / 2, cost, price: Math.round(cost * 1.5 / 10) * 10, active: 1, launch: D(2026, 10, rnd(20, 30)), pop: 0, isNew: true });
});
csv('Products', ['ProductID', 'Article', 'ProductName', 'GroupID', 'Fabric', 'SizeRange', 'NormMinutes', 'CostPrice', 'WholesalePrice', 'IsActive', 'LaunchDate'],
  products.map(p => [p.id, p.art, p.name, p.grp, p.fabric, p.sizes, p.norm.toFixed(1), p.cost.toFixed(2), p.price.toFixed(2), p.active, fd(p.launch)]));

/* Сотрудники: часть — клиенты Учебного банка (зарплатный проект: совпадают ФИО и телефон) */
const bank = T.buildBankDb();
const bankPeople = bank.tables.clients.rows.filter(r => r[7] && r[9] !== 'ИП');
let bpi = 3;
const nextBank = () => { const c = bankPeople[bpi]; bpi += 5; return { name: c[1] + ' ' + c[2], phone: c[7], g: c[4] }; };
const femF = ['Айгуль', 'Асель', 'Динара', 'Жылдыз', 'Гульмира', 'Нургуль', 'Анара', 'Бермет', 'Мээрим', 'Чолпон', 'Айжан', 'Назгуль', 'Елена', 'Ольга', 'Наталья', 'Гульнара', 'Салтанат', 'Венера', 'Айпери', 'Каныкей'];
const femL = ['Абдыкалыкова', 'Асанова', 'Бакирова', 'Жумабекова', 'Касымова', 'Мамытова', 'Осмонова', 'Токтогулова', 'Сыдыкова', 'Турдубаева', 'Эсенова', 'Байтикова', 'Иманалиева', 'Кадырова', 'Нурматова', 'Ибраимова', 'Ким', 'Иванова', 'Петрова', 'Шаршеева'];
const malF = ['Бакыт', 'Нурлан', 'Эрлан', 'Азамат', 'Улан', 'Тимур', 'Марат', 'Данияр', 'Руслан', 'Айбек', 'Сергей', 'Алексей'];
const malL = ['Абдраимов', 'Беков', 'Джумалиев', 'Исаков', 'Мусаев', 'Орозбеков', 'Рахманов', 'Сатыбалдиев', 'Тологонов', 'Усенов', 'Шаршенов', 'Юсупов'];
const used = {};
function person(gender, fromBank) {
  if (fromBank) { const b = nextBank(); used[b.name] = 1; return b; }
  for (;;) {
    const nm = gender === 'Ж' ? pick(femL) + ' ' + pick(femF) : pick(malL) + ' ' + pick(malF);
    if (used[nm]) continue; used[nm] = 1;
    return { name: nm, phone: R() < 0.8 ? '+996' + pick(['555', '700', '770', '505', '220', '999', '777']) + String(rnd(100000, 999999)) : null, g: gender };
  }
}
const emps = [];
let eid = 1;
function addEmp(o) { o.id = eid++; emps.push(o); return o; }
const dir = addEmp({ ...person('Ж', true), ws: null, pos: 'Директор производства', grade: null, hire: D(2016, 2, 15), fire: null, salary: 160000, mgr: null });
addEmp({ ...person('Ж'), ws: null, pos: 'Технолог', grade: null, hire: D(2018, 5, 10), fire: null, salary: 85000, mgr: dir.id });
addEmp({ ...person('М'), ws: null, pos: 'Технолог', grade: null, hire: D(2024, 2, 1), fire: null, salary: 72000, mgr: dir.id });
const sewers = {};
workshops.forEach(w => {
  const wid = w[0], open = Math.max(w[5], D(2016, 3, 1));
  const head = addEmp({ ...person(R() < 0.6 ? 'Ж' : 'М', R() < 0.5), ws: wid, pos: 'Начальник цеха', grade: null, hire: wid === 6 ? D(2026, 9, 1) : open + rnd(0, 60) * DAY, fire: null, salary: 105000 + rnd(0, 4) * 5000, mgr: dir.id });
  if (w[2] === 'Раскрой') { for (let i = 0; i < 4; i++) addEmp({ ...person(R() < 0.5 ? 'Ж' : 'М'), ws: wid, pos: 'Закройщик', grade: rnd(4, 6), hire: open + rnd(30, 2500) * DAY, fire: null, salary: 62000 + rnd(0, 6) * 2000, mgr: head.id }); return; }
  if (w[2] === 'ВТО и упаковка') {
    for (let i = 0; i < 3; i++) addEmp({ ...person('Ж'), ws: wid, pos: 'Утюжильщица', grade: rnd(2, 4), hire: open + rnd(30, 3000) * DAY, fire: null, salary: 42000 + rnd(0, 5) * 1000, mgr: head.id });
    for (let i = 0; i < 2; i++) addEmp({ ...person('Ж'), ws: wid, pos: 'Контролёр ОТК', grade: null, hire: open + rnd(30, 3000) * DAY, fire: null, salary: 50000 + rnd(0, 5) * 1000, mgr: head.id });
    return;
  }
  // швейные цеха: мастера и швеи
  const nMasters = wid === 6 ? 1 : (wid === 4 ? 1 : 2);
  const masters = [];
  for (let i = 0; i < nMasters; i++) masters.push(addEmp({ ...person('Ж', R() < 0.5), ws: wid, pos: 'Мастер', grade: null, hire: wid === 6 ? D(2026, 9, 15) : Math.max(open, D(2025, 1, 1) - rnd(100, 2500) * DAY) , fire: null, salary: 78000 + rnd(0, 4) * 3000, mgr: head.id }));
  const n = wid === 6 ? 3 : (wid === 4 ? 8 : 12);
  sewers[wid] = [];
  for (let i = 0; i < n; i++) {
    let hire, fire = null;
    if (wid === 6) hire = D(2026, 10, rnd(10, 25));
    else if (wid === 4) hire = D(2025, 8, rnd(1, 28)) + (i >= 6 ? rnd(60, 300) * DAY : 0);
    else hire = R() < 0.75 ? Math.max(open, D(2024, 12, 31) - rnd(30, 2600) * DAY) : D(2025, 1, 1) + rnd(20, 560) * DAY;
    if (wid !== 6 && R() < 0.25) fire = Math.min(END - 10 * DAY, Math.max(hire + 120 * DAY, D(2025, 3, 1) + rnd(0, 560) * DAY));
    const e = addEmp({ ...person('Ж', R() < 0.3), ws: wid, pos: 'Швея-мотористка', grade: wpick([[2, 15], [3, 35], [4, 30], [5, 15], [6, 5]]), hire, fire, salary: 38000 + rnd(0, 12) * 1000, mgr: masters[i % masters.length].id });
    e.skill = 0.8 + R() * 0.45 + (e.grade - 3) * 0.06;
    sewers[wid].push(e);
  }
});
csv('Employees', ['EmployeeID', 'FullName', 'WorkshopID', 'Position', 'Grade', 'HireDate', 'FireDate', 'Salary', 'Phone', 'ManagerID'],
  emps.map(e => [e.id, e.name, e.ws, e.pos, e.grade, fd(e.hire), e.fire ? fd(e.fire) : null, e.salary.toFixed(2), e.phone, e.mgr]));

/* Заказчики */
const custDefs = [
  ['ОсОО «Модный квартал»', 'Розничная сеть', 'Кыргызстан', 'Бишкек', 8], ['Сеть магазинов «Кийим Үй»', 'Розничная сеть', 'Кыргызстан', 'Бишкек', 9], ['ОсОО «Стиль-Ош»', 'Розничная сеть', 'Кыргызстан', 'Ош', 6],
  ['ИП Абдыкадырова Н.', 'Оптовик', 'Кыргызстан', 'Бишкек', 5], ['ИП Мамытов К.', 'Оптовик', 'Кыргызстан', 'Ош', 4], ['ОсОО «Дордой Текстиль Опт»', 'Оптовик', 'Кыргызстан', 'Бишкек', 10],
  ['ИП Сыдыкова Г.', 'Оптовик', 'Кыргызстан', 'Каракол', 3], ['ИП Ким В.', 'Оптовик', 'Кыргызстан', 'Джалал-Абад', 3], ['Маркетплейс «Пазар Онлайн»', 'Маркетплейс', 'Кыргызстан', 'Бишкек', 9],
  ['Маркетплейс «Себет»', 'Маркетплейс', 'Кыргызстан', 'Бишкек', 6], ['ТОО «Алатау Текстиль»', 'Экспорт', 'Казахстан', 'Алматы', 7], ['ТОО «Степь-Опт»', 'Экспорт', 'Казахстан', 'Астана', 4],
  ['ООО «Сибирь Стиль»', 'Экспорт', 'Россия', 'Новосибирск', 7], ['ООО «Урал Мода»', 'Экспорт', 'Россия', 'Екатеринбург', 5], ['ООО «Столица-Трикотаж»', 'Экспорт', 'Россия', 'Москва', 6],
  ['ООО «Казань Опт»', 'Экспорт', 'Россия', 'Казань', 3], ['Школа-гимназия № 5', 'Госзаказ', 'Кыргызстан', 'Бишкек', 3], ['Средняя школа № 61', 'Госзаказ', 'Кыргызстан', 'Бишкек', 3],
  ['Лицей «Билим»', 'Госзаказ', 'Кыргызстан', 'Ош', 2], ['Городская клиническая больница № 2', 'Госзаказ', 'Кыргызстан', 'Бишкек', 3], ['ОсОО «Строймонтаж»', 'Корпоративный', 'Кыргызстан', 'Бишкек', 3],
  ['ОсОО «Энерго-Сервис»', 'Корпоративный', 'Кыргызстан', 'Токмок', 2], ['ОсОО «Кафе-Групп»', 'Корпоративный', 'Кыргызстан', 'Бишкек', 2], ['ИП Осмонова А.', 'Оптовик', 'Кыргызстан', 'Нарын', 2],
  ['ИП Турдубаев Э.', 'Оптовик', 'Кыргызстан', 'Талас', 2], ['ООО «Байкал Текс»', 'Экспорт', 'Россия', 'Иркутск', 0], ['ОсОО «Новый Стиль»', 'Розничная сеть', 'Кыргызстан', 'Бишкек', 0]
];
const customers = custDefs.map((c, i) => ({ id: 101 + i, name: c[0], type: c[1], country: c[2], city: c[3], w: c[4], phone: R() < 0.8 ? (c[2] === 'Кыргызстан' ? '+996' + pick(['312', '555', '700', '770']) + String(rnd(100000, 999999)) : (c[2] === 'Казахстан' ? '+7701' + rnd(1000000, 9999999) : '+7913' + rnd(1000000, 9999999))) : null, contract: c[4] === 0 ? D(2026, 10, rnd(5, 25)) : D(rnd(2019, 2024), rnd(1, 12), rnd(1, 28)) }));
csv('Customers', ['CustomerID', 'CustomerName', 'CustomerType', 'Country', 'City', 'Phone', 'ContractDate'], customers.map(c => [c.id, c.name, c.type, c.country, c.city, c.phone, fd(c.contract)]));

/* Заказы, строки заказов, журнал выпуска */
const orders = [], lines = [], log = [];
let oid = 25001, lid = 1, logid = 1;
const active = products.filter(p => !p.isNew);
function groupPairsFor(cust, month) {
  const t = cust.type;
  return groups.map(g => {
    let w = g[9][month - 1];
    if (t === 'Госзаказ') w = cust.name.indexOf('больница') >= 0 ? (g[0] === 10 ? 10 : 0) : (g[0] === 9 ? 10 : (g[0] === 2 ? 1 : 0));
    else if (t === 'Корпоративный') w = g[0] === 10 ? 8 : (g[0] === 7 ? 1 : (g[0] === 1 ? 1 : 0));
    else if (g[0] === 10) w = 0.15;
    else if (g[0] === 9) w *= 0.4;
    return [g[0], w];
  }).filter(p => p[1] > 0);
}
// выпуск: партии по строке заказа
function produce(line, prod, from, to) {
  let left = line ? line.qty : rnd(40, 160);
  const defectBase = gById[prod.grp][3] / 100;
  let guard = 0;
  while (left > 0 && guard++ < 40) {
    const t = from + Math.floor(R() * Math.max(DAY, to - from));
    const day = new Date(t).getUTCDay();
    if (day === 0) continue; // воскресенье — выходной
    const dayStart = Math.floor(t / DAY) * DAY;
    const pool = [2, 3, 4].filter(w => workshops[w - 1][5] <= dayStart).flatMap(w => sewers[w].filter(e => e.hire <= dayStart && (!e.fire || e.fire > dayStart)));
    if (!pool.length) continue;
    const e = pick(pool);
    const shift = R() < 0.7 ? 'Дневная' : 'Вечерняя';
    const at = dayStart + (shift === 'Дневная' ? rnd(9, 16) : rnd(17, 22)) * HOUR + rnd(0, 59) * 60000 + rnd(0, 59) * 1000;
    const batch = Math.min(left, Math.max(5, Math.round((480 / prod.norm) * e.skill * (0.6 + R() * 0.7) * 2.4)));
    let defectRate = defectBase * (0.4 + R() * 1.4) * (e.grade <= 2 ? 1.8 : (e.grade >= 5 ? 0.6 : 1)) * (e.ws === 4 && dayStart < D(2025, 12, 1) ? 1.7 : 1);
    let defect = 0; for (let k = 0; k < batch; k++) if (R() < defectRate) defect++;
    log.push([logid++, fdt(at), e.ws, e.id, prod.id, line ? line.id : null, shift, batch, defect]);
    left -= batch - defect; // брак перешивают — шьём, пока не наберём годные
  }
}
for (let d = START; d <= END; d += DAY) {
  const dt = new Date(d), wd = dt.getUTCDay(), m = dt.getUTCMonth() + 1;
  if (wd === 0) continue;
  const n = R() < (wd === 6 ? 0.45 : 1.35) / 1 ? rnd(0, 2) : 0;
  for (let k = 0; k < n; k++) {
    const cust = wpick(customers.filter(c => c.w > 0 && c.contract <= d).map(c => [c, c.w]));
    const gp = groupPairsFor(cust, m);
    const nl = cust.type === 'Госзаказ' ? rnd(2, 4) : rnd(1, 5);
    const orderLines = [], usedP = {};
    for (let j = 0; j < nl; j++) {
      const gid = wpick(gp);
      const cand = active.filter(p => p.grp === gid && p.launch <= d && (p.active || d < D(2026, 3, 1)));
      if (!cand.length) continue;
      const p = wpick(cand.map(x => [x, x.pop]));
      if (usedP[p.id]) continue; usedP[p.id] = 1;
      const big = cust.type === 'Экспорт' || cust.type === 'Госзаказ' || cust.name.indexOf('Дордой') >= 0;
      const qty = Math.round((big ? rnd(40, 220) : rnd(10, 80)) / 5) * 5 * (p.norm > 150 ? 0.5 : 1);
      const price = dt.getUTCFullYear() === 2025 ? Math.round(p.price * 0.92 / 10) * 10 : p.price;
      orderLines.push({ id: lid++, prod: p, qty: Math.max(10, Math.round(qty)), price });
    }
    if (!orderLines.length) continue;
    const totalMin = orderLines.reduce((s, l) => s + l.qty * l.prod.norm, 0);
    const lead = Math.max(7, Math.round(totalMin / 60 / 50)) + rnd(5, 20);
    const due = d + lead * DAY;
    let status, ship = null;
    const cancel = R() < 0.04;
    const age = (END - d) / DAY;
    if (cancel) status = 'Отменён';
    else {
      const late = R() < 0.18 ? rnd(1, 15) : -rnd(0, Math.min(5, lead - 3));
      const planShip = due + late * DAY;
      if (planShip <= END && !(age < 75 && R() < 0.16)) { status = 'Отгружен'; ship = planShip; }
      else status = age < 6 ? 'Новый' : 'В работе';
    }
    const disc = cust.type === 'Экспорт' || cust.name.indexOf('Дордой') >= 0 ? pick([0, 3, 5, 5, 7]) : (cust.type === 'Маркетплейс' ? pick([0, 0, 3]) : 0);
    orders.push([oid, fd(d), cust.id, fd(due), ship ? fd(ship) : null, status, disc.toFixed(2)]);
    orderLines.forEach(l => {
      lines.push([l.id, oid, l.prod.id, l.qty, l.price.toFixed(2)]);
      if (status === 'Отменён') { if (R() < 0.3) produce({ id: l.id, qty: Math.round(l.qty * 0.3) }, l.prod, d + DAY, Math.min(END, d + 6 * DAY)); return; }
      if (status === 'Новый') return;
      if (status === 'Отгружен') produce(l, l.prod, d + DAY, ship - DAY);
      else { const part = Math.round(l.qty * (0.2 + R() * 0.6)); if (part > 0) produce({ id: l.id, qty: part }, l.prod, d + DAY, END); }
    });
    oid++;
  }
}
// пошив на склад (без заказа)
for (let i = 0; i < 90; i++) { const p = pick(active.filter(x => x.active)); const t = START + rnd(0, 660) * DAY; produce(null, p, t, t + 4 * DAY); }
log.sort((a, b) => a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[0] - b[0]);
log.forEach((r, i) => r[0] = i + 1);
csv('Orders', ['OrderID', 'OrderDate', 'CustomerID', 'DueDate', 'ShipDate', 'Status', 'DiscountPct'], orders);
csv('OrderLines', ['OrderLineID', 'OrderID', 'ProductID', 'Qty', 'Price'], lines);
csv('ProductionLog', ['LogID', 'ProducedAt', 'WorkshopID', 'EmployeeID', 'ProductID', 'OrderLineID', 'Shift', 'QtyMade', 'QtyDefect'], log);
