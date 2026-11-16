/* Справочник T-SQL (только SELECT). Каждый пример выполняется на учебной базе. */
window.CHEAT = [
  {
    title: 'Основы SELECT', items: [
      { h: 'Порядок частей запроса', sql: "SELECT TOP (10) City, COUNT(*) AS Cnt   -- 5. что вывести (+ TOP)\nFROM Clients                            -- 1. откуда\nWHERE Gender = N'Ж'                     -- 2. фильтр строк\nGROUP BY City                           -- 3. группы\nHAVING COUNT(*) > 2                     -- 4. фильтр групп\nORDER BY Cnt DESC;                      -- 6. сортировка", note: 'Выполняется: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → TOP.' },
      { h: 'Псевдонимы и вычисления', sql: 'SELECT FullName AS [ФИО], Salary * 12 AS YearSalary\nFROM Employees;' },
      { h: 'Уникальные значения', sql: 'SELECT DISTINCT City FROM Clients ORDER BY City;' },
      { h: 'Постраничный вывод', sql: 'SELECT LoanID, Amount FROM Loans\nORDER BY LoanID\nOFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY;' },
      { h: 'Топ с «ничьими»', sql: 'SELECT TOP (2) WITH TIES FullName, Salary\nFROM Employees ORDER BY Salary DESC;' }
    ]
  },
  {
    title: 'Фильтры WHERE', items: [
      { h: 'Сравнения, AND/OR и скобки', sql: "SELECT LastName, City FROM Clients\nWHERE ClientType = N'ИП' AND (City = N'Ош' OR City = N'Джалал-Абад');", note: 'AND выполняется раньше OR — ставьте скобки.' },
      { h: 'IN и BETWEEN', sql: "SELECT TransactionID, Amount FROM Transactions\nWHERE Channel IN (N'Банкомат', N'Касса') AND Amount BETWEEN 10000 AND 20000;" },
      { h: 'LIKE', sql: "SELECT LastName FROM Clients WHERE LastName LIKE N'Ка%';   -- % любые символы, _ один символ, [АБ] один из" },
      { h: 'NULL', sql: 'SELECT LastName FROM Clients WHERE Phone IS NULL;   -- не «= NULL»!' },
      { h: 'Период: правильный диапазон дат', sql: "SELECT TransactionID FROM Transactions\nWHERE TransDate >= '20261001' AND TransDate < '20261101';   -- весь октябрь", note: 'От начала периода включительно до начала следующего — не включительно. Дата строкой — в формате ГГГГММДД.' }
    ]
  },
  {
    title: 'NULL и условия', items: [
      { h: 'Замена NULL', sql: "SELECT ISNULL(Phone, N'нет') AS Phone,\n       COALESCE(Phone, Email, N'нет контактов') AS Contact\nFROM Clients;" },
      { h: 'Защита от деления на ноль', sql: 'SELECT 100.0 / NULLIF(0, 0) AS SafeDiv;   -- NULL вместо ошибки' },
      { h: 'CASE', sql: "SELECT Amount,\n       CASE WHEN Amount >= 100000 THEN N'Крупная'\n            WHEN Amount >= 10000  THEN N'Средняя'\n            ELSE N'Мелкая' END AS SizeGroup\nFROM Transactions;" },
      { h: 'IIF', sql: "SELECT AccountNumber, IIF(CloseDate IS NULL, N'Открыт', N'Закрыт') AS State FROM Accounts;" }
    ]
  },
  {
    title: 'Числа и типы', items: [
      { h: 'Целочисленное деление', sql: 'SELECT 7 / 2 AS IntDiv, 7 / 2.0 AS DecDiv, 7 * 1.0 / 2 AS Trick;' },
      { h: 'Преобразование типов', sql: "SELECT CAST('123.45' AS DECIMAL(10,2)) AS Num,\n       TRY_CAST('N/A' AS INT) AS Safe,\n       CONVERT(VARCHAR(10), CAST('20261008' AS DATE), 104) AS DateText;" },
      { h: 'Округление', sql: 'SELECT ROUND(1234.567, 2) AS R, CAST(1234.567 AS DECIMAL(10,2)) AS C,\n       CEILING(2.1) AS Up, FLOOR(2.9) AS Down, ABS(-5) AS A;' },
      { h: 'Проценты', sql: "SELECT CAST(100.0 * SUM(CASE WHEN Status = N'Просрочен' THEN 1 ELSE 0 END) / COUNT(*) AS DECIMAL(5,2)) AS OverduePct\nFROM Loans;" }
    ]
  },
  {
    title: 'Строки', items: [
      { h: 'Основные функции', sql: "SELECT LEN(N'Бишкек') AS L, UPPER(N'ош') AS U, TRIM('  x  ') AS T,\n       LEFT(N'Бишкек', 3) AS Lf, RIGHT(N'Бишкек', 3) AS Rt, SUBSTRING(N'Бишкек', 2, 3) AS Sub,\n       CHARINDEX('@', 'ivan@mail.kg') AS Pos, REPLACE('1 500', ' ', '') AS Rep;" },
      { h: 'Склейка', sql: "SELECT CONCAT(LastName, ' ', FirstName) AS Name,\n       CONCAT_WS(' ', LastName, FirstName, MiddleName) AS FullName\nFROM Clients;", note: 'CONCAT считает NULL пустой строкой и сам превращает числа в текст; оператор + с NULL даёт NULL.' },
      { h: 'Часть после символа', sql: "SELECT SUBSTRING(Email, CHARINDEX('@', Email) + 1, 100) AS Domain\nFROM Clients WHERE Email IS NOT NULL;" },
      { h: 'Число с разделителями', sql: "SELECT FORMAT(1234567.891, 'N2', 'ru-RU') AS Ru, FORMAT(1234567.891, 'N0', 'en-US') AS En;" }
    ]
  },
  {
    title: 'Даты', items: [
      { h: 'Части даты', sql: 'SELECT GETDATE() AS Now, CAST(GETDATE() AS DATE) AS Today,\n       YEAR(GETDATE()) AS Y, MONTH(GETDATE()) AS M, DAY(GETDATE()) AS D,\n       DATEPART(quarter, GETDATE()) AS Q, DATENAME(month, GETDATE()) AS MonthName;' },
      { h: 'Начало и конец месяца', sql: 'SELECT DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1) AS MonthStart,\n       EOMONTH(GETDATE()) AS MonthEnd,\n       EOMONTH(GETDATE(), -1) AS PrevMonthEnd;' },
      { h: 'Сдвиг и разница', sql: "SELECT DATEADD(day, -7, CAST('20261031' AS DATE)) AS WeekAgo,\n       DATEADD(month, 1, CAST('20260131' AS DATE)) AS PlusMonth,\n       DATEDIFF(day, '20260101', '20261031') AS Days;", note: 'DATEDIFF считает пересечённые границы: DATEDIFF(year, \'20251231\', \'20260101\') = 1.' },
      { h: 'Точный возраст', sql: "SELECT BirthDate,\n       DATEDIFF(year, BirthDate, '20261101')\n         - CASE WHEN DATEADD(year, DATEDIFF(year, BirthDate, '20261101'), BirthDate) > '20261101' THEN 1 ELSE 0 END AS Age\nFROM Clients;" },
      { h: 'Дата текстом', sql: "SELECT CONVERT(VARCHAR(10), TransDate, 104) AS Ru,      -- 30.10.2026\n       CONVERT(VARCHAR(19), TransDate, 120) AS Iso,     -- 2026-10-30 20:30:40\n       FORMAT(TransDate, 'yyyy-MM') AS YearMonth\nFROM Transactions;" },
      { h: 'Параметры отчёта', sql: "DECLARE @From DATE = '20261001', @To DATE = '20261101';\nSELECT COUNT(*) AS Cnt FROM Transactions\nWHERE TransDate >= @From AND TransDate < @To;" }
    ]
  },
  {
    title: 'Группировка', items: [
      { h: 'Агрегаты', sql: 'SELECT COUNT(*) AS Rows, COUNT(Phone) AS WithPhone, COUNT(DISTINCT City) AS Cities FROM Clients;', note: 'Все агрегаты, кроме COUNT(*), пропускают NULL. AVG по INT даёт INT — пишите AVG(x * 1.0).' },
      { h: 'GROUP BY + HAVING', sql: 'SELECT ClientID, COUNT(*) AS Cnt FROM Accounts\nGROUP BY ClientID\nHAVING COUNT(*) > 2;' },
      { h: 'Условная агрегация (сводная)', sql: "SELECT City,\n       SUM(CASE WHEN Gender = N'М' THEN 1 ELSE 0 END) AS Men,\n       SUM(CASE WHEN Gender = N'Ж' THEN 1 ELSE 0 END) AS Women\nFROM Clients GROUP BY City;" },
      { h: 'Итоги ROLLUP + GROUPING', sql: "SELECT CASE WHEN GROUPING(Currency) = 1 THEN N'ИТОГО' ELSE Currency END AS Currency,\n       COUNT(*) AS Cnt\nFROM Accounts GROUP BY ROLLUP (Currency);" }
    ]
  },
  {
    title: 'Соединения', items: [
      { h: 'INNER JOIN', sql: 'SELECT c.LastName, a.AccountNumber\nFROM Clients c\nJOIN Accounts a ON a.ClientID = c.ClientID;' },
      { h: 'LEFT JOIN и подсчёт с нулями', sql: 'SELECT c.ClientID, COUNT(a.AccountID) AS AccCnt   -- не COUNT(*)!\nFROM Clients c\nLEFT JOIN Accounts a ON a.ClientID = c.ClientID\nGROUP BY c.ClientID;' },
      { h: 'Анти-соединение: «у кого нет»', sql: 'SELECT c.ClientID FROM Clients c\nLEFT JOIN Loans l ON l.ClientID = c.ClientID\nWHERE l.LoanID IS NULL;' },
      { h: 'Условие на правую таблицу — в ON', sql: "SELECT c.ClientID, COUNT(l.LoanID) AS ActiveLoans\nFROM Clients c\nLEFT JOIN Loans l ON l.ClientID = c.ClientID AND l.Status = N'Активен'\nGROUP BY c.ClientID;" },
      { h: 'Таблица сама с собой', sql: 'SELECT e.FullName AS Employee, m.FullName AS Manager\nFROM Employees e\nLEFT JOIN Employees m ON m.EmployeeID = e.ManagerID;' }
    ]
  },
  {
    title: 'Подзапросы и множества', items: [
      { h: 'Сравнение со средним', sql: 'SELECT LoanID, Amount FROM Loans\nWHERE Amount > (SELECT AVG(Amount) FROM Loans);' },
      { h: 'EXISTS / NOT EXISTS', sql: 'SELECT e.FullName FROM Employees e\nWHERE NOT EXISTS (SELECT 1 FROM Employees s WHERE s.ManagerID = e.EmployeeID);', note: 'NOT IN с подзапросом, где есть NULL, вернёт пустой результат — используйте NOT EXISTS.' },
      { h: 'Последнее значение на дату (APPLY)', sql: "SELECT t.TransactionID, r.Rate\nFROM Transactions t\nJOIN Accounts a ON a.AccountID = t.AccountID\nOUTER APPLY (SELECT TOP (1) Rate FROM CurrencyRates\n             WHERE Currency = a.Currency AND RateDate <= CAST(t.TransDate AS DATE)\n             ORDER BY RateDate DESC) AS r\nWHERE a.Currency = 'USD';" },
      { h: 'UNION ALL / INTERSECT / EXCEPT', sql: "SELECT City FROM Clients\nEXCEPT\nSELECT City FROM Branches;   -- города клиентов без филиалов" }
    ]
  },
  {
    title: 'CTE и временные таблицы', items: [
      { h: 'CTE по шагам', sql: "WITH T AS (\n    SELECT AccountID, SUM(Amount) AS Turnover FROM Transactions GROUP BY AccountID\n)\nSELECT * FROM T WHERE Turnover > 1000000;" },
      { h: 'Календарь (рекурсия)', sql: "WITH Cal AS (\n    SELECT CAST('20261001' AS DATE) AS D\n    UNION ALL\n    SELECT DATEADD(day, 1, D) FROM Cal WHERE D < '20261031'\n)\nSELECT D FROM Cal\nOPTION (MAXRECURSION 400);" },
      { h: 'Временная таблица', sql: "DROP TABLE IF EXISTS #Big;\nSELECT TransactionID, Amount INTO #Big FROM Transactions WHERE Amount > 100000;\nSELECT COUNT(*) AS Cnt FROM #Big;" }
    ]
  },
  {
    title: 'Оконные функции', items: [
      { h: 'Итог рядом со строкой и доля', sql: 'SELECT FullName, BranchID, Salary,\n       AVG(Salary) OVER (PARTITION BY BranchID) AS BranchAvg,\n       CAST(100.0 * Salary / SUM(Salary) OVER () AS DECIMAL(5,2)) AS SharePct\nFROM Employees;' },
      { h: 'Ранги', sql: 'SELECT FullName, Salary,\n       ROW_NUMBER() OVER (ORDER BY Salary DESC, EmployeeID) AS RowNum,\n       RANK()       OVER (ORDER BY Salary DESC) AS Rnk,\n       DENSE_RANK() OVER (ORDER BY Salary DESC) AS DenseRnk\nFROM Employees;' },
      { h: 'Топ-N в группе / последняя запись', sql: 'WITH R AS (\n    SELECT AccountID, TransDate, Amount,\n           ROW_NUMBER() OVER (PARTITION BY AccountID ORDER BY TransDate DESC, TransactionID DESC) AS rn\n    FROM Transactions\n)\nSELECT * FROM R WHERE rn = 1;', note: 'Фильтровать по оконной функции можно только во внешнем запросе (CTE/подзапрос).' },
      { h: 'LAG / LEAD', sql: "SELECT RateDate, Rate, Rate - LAG(Rate) OVER (ORDER BY RateDate) AS Diff\nFROM CurrencyRates WHERE Currency = 'USD';" },
      { h: 'Нарастающий итог и скользящее среднее', sql: 'SELECT AccountID, TransDate, Amount,\n       SUM(Amount) OVER (PARTITION BY AccountID ORDER BY TransDate\n                         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS Running,\n       AVG(Amount) OVER (PARTITION BY AccountID ORDER BY TransDate\n                         ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS Avg3\nFROM Transactions;', note: 'Всегда указывайте рамку ROWS явно: рамка по умолчанию (RANGE) ведёт себя иначе при одинаковых значениях.' }
    ]
  },
  {
    title: 'Быстрые запросы', items: [
      { h: 'Не применяйте функции к столбцу в WHERE', sql: "-- медленно: WHERE YEAR(TransDate) = 2026\n-- быстро:\nSELECT COUNT(*) FROM Transactions\nWHERE TransDate >= '20260101' AND TransDate < '20270101';" },
      { h: 'Сначала посмотрите на данные', sql: 'SELECT TOP (100) * FROM Transactions;   -- а не SELECT * по огромной таблице' },
      { h: 'Статистика в SSMS', sql: 'SET STATISTICS IO, TIME ON;\nSELECT COUNT(*) FROM Transactions;', note: 'В SSMS на вкладке «Сообщения» появится число прочитанных страниц и время. Ctrl+L — предполагаемый план, Ctrl+M — фактический. В тренажёре эта команда принимается, но статистики не выводит.' }
    ]
  }
];
