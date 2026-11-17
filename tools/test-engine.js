// Самопроверка движка T-SQL: короткие запросы с известным результатом SQL Server.
// Запуск: node tools/test-engine.js   (0 — всё совпало, 1 — есть расхождения)
// Сюда добавляют случай при каждом исправлении движка, чтобы ошибка не вернулась.
const { loadAll, T } = require('./lib.js');
const { packs, dbs } = loadAll();
const bank = packs.find(p => p.id === 'bank');

// Результат последнего набора: строки через « ;; », значения через « | »; ошибка — «ERR номер»
function run(sql) {
  const r = T.execute(sql, bank.db, { dbs });
  if (r.error) return 'ERR ' + r.error.number;
  const rs = r.results[r.results.length - 1];
  if (!rs) return '(нет набора)';
  return rs.rows.map(row => row.map(v => v === null ? 'NULL' : String(v)).join(' | ')).join(' ;; ');
}
function types(sql) {
  const r = T.execute(sql, bank.db, { dbs });
  return r.error ? 'ERR ' + r.error.number : r.results[r.results.length - 1].types.join(' | ');
}

const V = '(SELECT 1 AS x UNION ALL SELECT 2 UNION ALL SELECT 2 UNION ALL SELECT 3) v';
const CASES = [
  // --- целые и десятичные числа
  ['SELECT 7/2, -7/2, 7%2, -7%2', '3 | -3 | 1 | -1'],
  ['SELECT 7.0/2, 7/2.0, 7*1.0/2, 1.0/3, 10*1.0/4', '3.500000 | 3.500000 | 3.500000 | 0.333333 | 2.500000'],   // целая константа — минимальная точность
  ['SELECT 1.00000/3, 1.000000/3', '0.3333333 | 0.33333333'],
  ['DECLARE @n int = 7; SELECT 1.0 / @n', '0.142857142857'],                                                  // переменная int — как numeric(10,0)
  ['SELECT COUNT(*) * 1.0 / COUNT(*) FROM Clients', '1.000000000000'],
  ['SELECT TOP 1 Amount / 3 FROM Transactions ORDER BY TransactionID', '2377.636667'],
  ['SELECT ROUND(2.5,0), ROUND(-2.5,0), ROUND(123.456,-1), ROUND(14.9999,2,1)', '3.0 | -3.0 | 120.000 | 14.9900'],
  ['SELECT CAST(7.9 AS INT), CAST(-7.9 AS INT), CAST(12.355 AS DECIMAL(5,2)), CAST(5 AS BIT)', '7 | -7 | 12.36 | 1'],
  ['SELECT 1/0', 'ERR 8134'],
  ['SELECT 2147483647 + 1', 'ERR 8115'],
  ['SELECT AVG(x), AVG(x*1.0), SUM(x), COUNT(DISTINCT x) FROM ' + V, '2 | 2.000000 | 8 | 3'],
  // --- строки и неявные преобразования
  ["SELECT '10'+5, '10'+'5', 'a'+NULL, CONCAT('a',NULL,'b')", '15 | 105 | NULL | ab'],
  ["SELECT 'abc'+1", 'ERR 245'],
  ["SELECT CAST('abc' AS INT)", 'ERR 245'],
  ["SELECT TRY_CAST('abc' AS INT), TRY_CAST('12.5' AS DECIMAL(5,1))", 'NULL | 12.5'],
  ["SELECT LEN('abc  '), LEN('  abc'), DATALENGTH('abc  ')", '3 | 5 | 5'],
  ["SELECT CASE WHEN 'a'='a  ' THEN 1 ELSE 0 END, CASE WHEN 'A'='a' THEN 1 ELSE 0 END", '1 | 1'],
  ["SELECT SUBSTRING('abcdef',0,3), LEFT('abc',10), CHARINDEX('c','abcabc',4), STUFF('abcdef',2,3,'ZZ')", 'ab | abc | 6 | aZZef'],
  ["SELECT ISNULL(CAST(NULL AS varchar(3)),'abcdef'), COALESCE(CAST(NULL AS varchar(3)),'abcdef'), NULLIF(5,5)", 'abc | abcdef | NULL'],
  ["SELECT CASE WHEN '10' < '9' THEN 's' ELSE 'n' END, CASE WHEN '10' < 9 THEN 's' ELSE 'n' END", 's | n'],
  // --- порядок строк: знаки, цифры, латиница, кириллица (как в SQL Server); NULL — первым
  ["SELECT x FROM (SELECT N'яма' x UNION ALL SELECT 'apple' UNION ALL SELECT N'Бишкек' UNION ALL SELECT '9' UNION ALL SELECT N'Zebra') t ORDER BY x", '9 ;; apple ;; Zebra ;; Бишкек ;; яма'],
  ['SELECT x FROM (SELECT 3 AS x UNION ALL SELECT NULL UNION ALL SELECT 1) t ORDER BY x', 'NULL ;; 1 ;; 3'],
  // --- NULL и логика
  ['SELECT 1 WHERE 1 NOT IN (2,NULL)', ''],
  ['SELECT 1 WHERE 3 > ALL (SELECT 1 WHERE 1=0)', '1'],
  ['SELECT CASE WHEN NULL=NULL THEN 1 WHEN NULL IS NULL THEN 2 END', '2'],
  ['SELECT SUM(Balance), COUNT(*) FROM Accounts WHERE 1=0', 'NULL | 0'],
  // --- UNION / INTERSECT / EXCEPT
  ["SELECT 'a' AS x UNION ALL SELECT NULL", 'a ;; NULL'],                                                   // константа NULL не навязывает тип int
  ["SELECT NULL AS x UNION ALL SELECT NULL UNION ALL SELECT 'a'", 'NULL ;; NULL ;; a'],
  ["SELECT NULL AS x UNION ALL SELECT CAST('2026-01-01' AS date)", 'NULL ;; 2026-01-01'],
  ["SELECT City FROM Clients WHERE ClientID = 1 UNION SELECT NULL ORDER BY City", 'NULL ;; Кант'],
  ["SELECT x FROM (SELECT NULL AS x) t UNION ALL SELECT 'a'", 'ERR 245'],                                   // столбец подзапроса уже имеет тип int
  ["SELECT 'a' AS v UNION ALL SELECT 1", 'ERR 245'],
  ['SELECT 1 AS a UNION ALL SELECT 2 INTERSECT SELECT 2', '1 ;; 2'],
  ["SELECT 1 AS a, 'x' AS b UNION SELECT 2", 'ERR 205'],
  // --- TOP, OFFSET, группировка
  ['SELECT TOP 2 WITH TIES x FROM ' + V + ' ORDER BY x', '1 ;; 2 ;; 2'],
  ['SELECT TOP 30 PERCENT x FROM ' + V + ' ORDER BY x', '1 ;; 2'],
  ['SELECT x FROM ' + V + ' ORDER BY x OFFSET 1 ROWS FETCH NEXT 2 ROWS ONLY', '2 ;; 2'],
  ['SELECT COUNT(*) FROM ' + V + ' WHERE 1=0', '0'],
  ['SELECT COUNT(*) FROM ' + V + ' WHERE 1=0 GROUP BY x', ''],
  ['SELECT City, COUNT(*) FROM Clients', 'ERR 8120'],
  ['SELECT LastName AS L FROM Clients WHERE L = 1', 'ERR 207'],
  ['SELECT ClientID FROM Clients c JOIN Accounts a ON a.ClientID = c.ClientID', 'ERR 209'],
  ['SELECT DISTINCT City FROM Clients ORDER BY LastName', 'ERR 145'],
  ['SELECT City FROM Clients WHERE COUNT(*) > 1', 'ERR 147'],
  ['SELECT (SELECT ClientID FROM Clients)', 'ERR 512'],
  // --- оконные функции
  ['SELECT x, ROW_NUMBER() OVER (ORDER BY x), RANK() OVER (ORDER BY x), DENSE_RANK() OVER (ORDER BY x), NTILE(3) OVER (ORDER BY x) FROM ' + V + ' ORDER BY 2', '1 | 1 | 1 | 1 | 1 ;; 2 | 2 | 2 | 2 | 1 ;; 2 | 3 | 2 | 2 | 2 ;; 3 | 4 | 4 | 3 | 3'],
  ['SELECT x, SUM(x) OVER (ORDER BY x), SUM(x) OVER (ORDER BY x ROWS UNBOUNDED PRECEDING) FROM ' + V + ' ORDER BY 1, 3', '1 | 1 | 1 ;; 2 | 5 | 3 ;; 2 | 5 | 5 ;; 3 | 8 | 8'],
  ['SELECT x, LAG(x) OVER (ORDER BY x), LEAD(x,2,-1) OVER (ORDER BY x) FROM ' + V + ' ORDER BY 1, 2', '1 | NULL | 2 ;; 2 | 1 | 3 ;; 2 | 2 | -1 ;; 3 | 2 | -1'],
  ['SELECT x, ROW_NUMBER() OVER () FROM ' + V, 'ERR 4112'],
  // --- даты
  ["SELECT DATEDIFF(day,'2026-01-31','2026-03-01'), DATEDIFF(month,'2026-01-31','2026-02-01'), DATEDIFF(year,'2025-12-31','2026-01-01')", '29 | 1 | 1'],
  ["SELECT CAST(DATEADD(month,1,'2026-01-31') AS date), EOMONTH('2024-02-10'), DATEPART(weekday,'2026-11-16'), DATENAME(month,'2026-11-16')", '2026-02-28 | 2024-02-29 | 2 | November'],
  ["SELECT CONVERT(varchar(10), CAST('2026-03-05' AS date), 104), FORMAT(CAST('2026-03-05' AS date), 'dd.MM.yyyy')", '05.03.2026 | 05.03.2026'],
  ["SELECT CAST('2026-03-05' AS date) + 1", 'ERR 206'],
  ["SELECT CAST('2026-02-30' AS datetime)", 'ERR 242'],
  // --- CTE, несколько баз, служебное
  ['WITH c AS (SELECT 1 AS n UNION ALL SELECT n+1 FROM c WHERE n < 5) SELECT SUM(n) FROM c', '15'],
  ['WITH c AS (SELECT 1 AS n UNION ALL SELECT n+1 FROM c WHERE n < 200) SELECT COUNT(*) FROM c', 'ERR 530'],
  ['USE Shop; SELECT DB_NAME()', 'Shop'],
  ['SELECT 1 FROM Nope', 'ERR 208'],
  ["UPDATE Clients SET City = 'x'", 'ERR 50000'],
];
const TYPES = [
  ['SELECT 7.0/2, 7/2.0', 'decimal(7,6) | decimal(8,6)'],
  ["SELECT 'a' AS x UNION ALL SELECT NULL", 'varchar(1)'],
  ['SELECT NULL AS x UNION SELECT NULL', 'int'],
];

let bad = 0;
for (const [sql, want] of CASES) {
  const got = run(sql);
  if (got !== want) { bad++; console.log('РАСХОЖДЕНИЕ\n  запрос:    ' + sql + '\n  ожидалось: ' + want + '\n  получено:  ' + got); }
}
for (const [sql, want] of TYPES) {
  const got = types(sql);
  if (got !== want) { bad++; console.log('РАСХОЖДЕНИЕ ТИПОВ\n  запрос:    ' + sql + '\n  ожидалось: ' + want + '\n  получено:  ' + got); }
}
console.log('Самопроверка движка: случаев ' + (CASES.length + TYPES.length) + ', расхождений ' + bad);
process.exit(bad ? 1 : 0);
