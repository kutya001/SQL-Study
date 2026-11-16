/* Модуль 12. CTE и временные таблицы */
COURSE.addModule({
  id: 'm12', num: 12,
  title: 'CTE и временные таблицы',
  short: 'WITH: сложный запрос по шагам, рекурсия (календарь, иерархия), временные таблицы #temp.',
  goal: '<p>Сложные отчёты удобно строить по шагам: «сначала посчитай это, потом на основе этого — то». Для этого есть обобщённые табличные выражения (CTE) и временные таблицы.</p>',
  read: [
    ['Временные таблицы', 'https://metanit.com/sql/sqlserver/10.4.php'],
    ['Табличные переменные', 'https://metanit.com/sql/sqlserver/10.3.php'],
    ['Пакеты. Команда GO', 'https://metanit.com/sql/sqlserver/3.7.php']
  ],
  lessons: [
    {
      id: 'm12l1', title: 'CTE: запрос по шагам', minutes: 15,
      steps: [
        {
          t: 'text', title: 'Именованный подзапрос',
          html: '<p><b>CTE</b> (Common Table Expression, обобщённое табличное выражение) — это подзапрос, которому дали имя и вынесли в начало:</p>' +
            '<pre class="sql">WITH ClientTotals AS (\n    SELECT ClientID, SUM(Balance) AS TotalKGS\n    FROM Accounts\n    WHERE Currency = \'KGS\'\n    GROUP BY ClientID\n)\nSELECT ClientID, TotalKGS\nFROM ClientTotals\nWHERE TotalKGS > 500000;</pre>' +
            '<p>По смыслу это то же самое, что подзапрос во FROM, но читается сверху вниз, как рецепт: «шаг 1 — посчитали итоги, шаг 2 — отфильтровали».</p>' +
            '<div class="tip"><b>Аналогия</b>Как промежуточный лист в Excel, на котором вы посчитали вспомогательную таблицу, а на итоговом листе на неё ссылаетесь.</div>'
        },
        {
          t: 'example', title: 'Первый CTE',
          sql: "WITH ClientTotals AS (\n    SELECT ClientID, SUM(Balance) AS TotalKGS, COUNT(*) AS Accounts\n    FROM Accounts\n    WHERE Currency = 'KGS'\n    GROUP BY ClientID\n)\nSELECT c.LastName, c.FirstName, t.TotalKGS, t.Accounts\nFROM ClientTotals t\nJOIN Clients c ON c.ClientID = t.ClientID\nWHERE t.TotalKGS > 500000\nORDER BY t.TotalKGS DESC;"
        },
        {
          t: 'text', title: 'Несколько шагов и правила',
          html: '<p>CTE перечисляются через запятую; каждый следующий может использовать предыдущие:</p>' +
            '<pre class="sql">WITH Step1 AS (...),\n     Step2 AS (SELECT ... FROM Step1 ...)\nSELECT ... FROM Step2;</pre>' +
            '<ul><li>CTE живёт только в пределах <b>одной</b> инструкции: следующий SELECT его уже не видит.</li>' +
            '<li>Внутри CTE нельзя писать ORDER BY (без TOP) — сортируйте в итоговом запросе.</li>' +
            '<li>Всем вычисляемым столбцам внутри CTE нужны имена.</li>' +
            '<li>Если перед WITH есть другая инструкция, она должна заканчиваться <b>точкой с запятой</b> — иначе ошибка. Поэтому часто пишут <code>;WITH</code>.</li>' +
            '<li>CTE не ускоряет запрос и не «сохраняет» результат: если на CTE сослаться дважды, сервер, как правило, вычислит его дважды. CTE — инструмент читаемости.</li></ul>'
        },
        {
          t: 'example', title: 'Два шага',
          sql: "WITH AccTurnover AS (\n    SELECT AccountID, SUM(Amount) AS Turnover\n    FROM Transactions\n    WHERE Status = N'Проведена'\n    GROUP BY AccountID\n),\nClientTurnover AS (\n    SELECT a.ClientID, SUM(t.Turnover) AS Turnover, COUNT(*) AS ActiveAccounts\n    FROM AccTurnover t\n    JOIN Accounts a ON a.AccountID = t.AccountID\n    GROUP BY a.ClientID\n)\nSELECT TOP (10) c.LastName, c.FirstName, ct.Turnover, ct.ActiveAccounts\nFROM ClientTurnover ct\nJOIN Clients c ON c.ClientID = ct.ClientID\nORDER BY ct.Turnover DESC;"
        },
        {
          t: 'example', title: 'Ошибка: нет точки с запятой',
          sql: "DECLARE @Cur CHAR(3) = 'USD'\nWITH x AS (SELECT * FROM Accounts WHERE Currency = @Cur)\nSELECT COUNT(*) FROM x;",
          expectError: true,
          after: "<p>Поставьте <code>;</code> в конце первой строки — и всё заработает.</p>"
        },
        {
          t: 'quiz', id: 'm12l1q1',
          q: '<p>Можно ли обратиться к CTE во второй инструкции после той, где он объявлен?</p>',
          options: ['Да, CTE живёт до конца сеанса', 'Нет, CTE существует только в пределах своей инструкции', 'Да, если поставить точку с запятой', 'Только если CTE рекурсивный'],
          answer: 1,
          explain: 'CTE — часть одной инструкции. Если промежуточный результат нужен нескольким запросам, используйте временную таблицу (урок 3).'
        }
      ],
      training: [
        {
          t: 'task', id: 'm12l1t1', title: 'Миллионные обороты',
          text: "<p>С помощью CTE посчитайте оборот (сумму всех операций) по каждому счёту и выведите счета с оборотом больше 1 000 000: <code>AccountID</code>, <code>Turnover</code>.</p>",
          solution: 'WITH T AS (\n    SELECT AccountID, SUM(Amount) AS Turnover\n    FROM Transactions\n    GROUP BY AccountID\n)\nSELECT AccountID, Turnover\nFROM T\nWHERE Turnover > 1000000;',
          check: { names: true, require: [['\\bWITH\\b', 'Решите задачу через WITH (CTE).']] }
        },
        {
          t: 'task', id: 'm12l1t2', title: 'Вкладчики-заёмщики',
          text: "<p>Сделайте два CTE: сумма кредитов по клиенту (<code>LoansTotal</code>) и сумма остатков по сомовым счетам клиента (<code>DepositsKGS</code>). Выведите клиентов, у которых есть и то и другое: <code>ClientID</code>, <code>LoansTotal</code>, <code>DepositsKGS</code>.</p>",
          solution: "WITH L AS (\n    SELECT ClientID, SUM(Amount) AS LoansTotal FROM Loans GROUP BY ClientID\n),\nD AS (\n    SELECT ClientID, SUM(Balance) AS DepositsKGS FROM Accounts WHERE Currency = 'KGS' GROUP BY ClientID\n)\nSELECT L.ClientID, L.LoansTotal, D.DepositsKGS\nFROM L\nJOIN D ON D.ClientID = L.ClientID;",
          check: { names: true },
          hint: 'Два CTE через запятую, затем INNER JOIN между ними по ClientID.'
        },
        {
          t: 'quiz', id: 'm12l1t3',
          q: '<p>Что из этого правда про CTE?</p>',
          options: ['CTE сохраняет результат на диск и ускоряет запрос', 'CTE в первую очередь делает запрос понятнее', 'В CTE обязательно нужен ORDER BY', 'CTE можно использовать в любом следующем запросе'],
          answer: 1,
          explain: 'CTE — способ записать запрос по шагам. Производительность — как у такого же подзапроса.'
        }
      ]
    },
    {
      id: 'm12l2', title: 'Рекурсивные CTE: календарь и иерархия', minutes: 18,
      steps: [
        {
          t: 'text', title: 'CTE, который ссылается сам на себя',
          html: '<p>Рекурсивный CTE состоит из двух частей, соединённых <code>UNION ALL</code>:</p>' +
            '<ol><li><b>Якорь</b> — стартовые строки.</li><li><b>Рекурсивная часть</b> — берёт строки предыдущего шага (ссылаясь на сам CTE) и строит из них следующие. Повторяется, пока возвращает хоть одну строку — поэтому нужно <b>условие остановки</b>.</li></ol>' +
            '<pre class="sql">WITH Nums AS (\n    SELECT 1 AS N                -- якорь\n    UNION ALL\n    SELECT N + 1 FROM Nums       -- рекурсия\n    WHERE N < 10                 -- остановка\n)\nSELECT N FROM Nums;</pre>'
        },
        {
          t: 'example', title: 'Числа от 1 до 10',
          sql: 'WITH Nums AS (\n    SELECT 1 AS N\n    UNION ALL\n    SELECT N + 1 FROM Nums WHERE N < 10\n)\nSELECT N FROM Nums;'
        },
        {
          t: 'text', title: 'Календарь без пропусков',
          html: '<p>Если в какой-то день не было операций, GROUP BY просто не покажет этот день — и на графике будет «дыра». Решение: сгенерировать календарь всех дней и присоединить к нему факты LEFT JOIN.</p>' +
            '<p>По умолчанию рекурсия ограничена <b>100 шагами</b> (защита от бесконечного цикла). Для календаря на год добавьте в конец запроса <code>OPTION (MAXRECURSION 400)</code> (0 — без ограничений, но осторожно).</p>' +
            '<div class="note">В SQL Server 2022 есть функция <code>GENERATE_SERIES(1, 31)</code>, которая выдаёт ряд чисел без рекурсии: <code>SELECT DATEADD(day, value - 1, \'20261001\') FROM GENERATE_SERIES(1, 31)</code>. На более старых серверах используйте рекурсию.</div>'
        },
        {
          t: 'example', title: 'Операции по дням октября, включая пустые дни',
          sql: "WITH Calendar AS (\n    SELECT CAST('20261001' AS DATE) AS D\n    UNION ALL\n    SELECT DATEADD(day, 1, D) FROM Calendar WHERE D < '20261031'\n),\nDaily AS (\n    SELECT CAST(TransDate AS DATE) AS D, COUNT(*) AS Cnt, SUM(Amount) AS Total\n    FROM Transactions\n    WHERE TransDate >= '20261001' AND TransDate < '20261101'\n    GROUP BY CAST(TransDate AS DATE)\n)\nSELECT c.D, DATENAME(weekday, c.D) AS DayName,\n       ISNULL(d.Cnt, 0) AS Cnt, ISNULL(d.Total, 0) AS Total\nFROM Calendar c\nLEFT JOIN Daily d ON d.D = c.D\nORDER BY c.D;",
          after: '<p>31 октября операций нет (данные заканчиваются 30-м), но строка есть, с нулями.</p>'
        },
        {
          t: 'text', title: 'Иерархия: дерево подчинения',
          html: '<p>Вторая классика — развернуть дерево «руководитель → подчинённые» на все уровни. Якорь — вершина (у кого нет руководителя), рекурсия — «сотрудники, чей руководитель уже найден на предыдущем шаге»:</p>' +
            '<pre class="sql">WITH Tree AS (\n    SELECT EmployeeID, FullName, 0 AS Lvl,\n           CAST(FullName AS NVARCHAR(500)) AS Path\n    FROM Employees WHERE ManagerID IS NULL\n    UNION ALL\n    SELECT e.EmployeeID, e.FullName, t.Lvl + 1,\n           CAST(t.Path + N\' → \' + e.FullName AS NVARCHAR(500))\n    FROM Employees e\n    JOIN Tree t ON e.ManagerID = t.EmployeeID\n)\nSELECT * FROM Tree;</pre>' +
            '<div class="warn"><b>Типы должны совпадать</b>Типы столбцов в якоре и рекурсивной части должны совпадать точно, включая длину строки. Без CAST в обеих частях получите ошибку 240. Попробуйте убрать CAST из рекурсивной части в примере ниже.</div>'
        },
        {
          t: 'example', title: 'Дерево сотрудников',
          sql: "WITH Tree AS (\n    SELECT EmployeeID, FullName, Position, 0 AS Lvl,\n           CAST(FullName AS NVARCHAR(500)) AS Path\n    FROM Employees\n    WHERE ManagerID IS NULL\n    UNION ALL\n    SELECT e.EmployeeID, e.FullName, e.Position, t.Lvl + 1,\n           CAST(t.Path + N' → ' + e.FullName AS NVARCHAR(500))\n    FROM Employees e\n    JOIN Tree t ON e.ManagerID = t.EmployeeID\n)\nSELECT REPLICATE(N'    ', Lvl) + FullName AS Employee, Position, Lvl\nFROM Tree\nORDER BY Path;"
        }
      ],
      training: [
        {
          t: 'task', id: 'm12l2t1', title: 'Все месяцы года',
          text: "<p>Сгенерируйте месяцы 1–12 рекурсивным CTE и выведите для каждого месяца 2026 года число операций (<code>M</code>, <code>Cnt</code>), включая месяцы без операций (0). Сортировка по месяцу.</p>",
          solution: "WITH Months AS (\n    SELECT 1 AS M\n    UNION ALL\n    SELECT M + 1 FROM Months WHERE M < 12\n),\nStat AS (\n    SELECT MONTH(TransDate) AS M, COUNT(*) AS Cnt\n    FROM Transactions\n    WHERE TransDate >= '20260101' AND TransDate < '20270101'\n    GROUP BY MONTH(TransDate)\n)\nSELECT m.M, ISNULL(s.Cnt, 0) AS Cnt\nFROM Months m\nLEFT JOIN Stat s ON s.M = m.M\nORDER BY m.M;",
          check: { names: true, ordered: true },
          hint: 'Месяцы 11 и 12 должны показаться с нулём.',
          alsoOk: ["WITH Months AS (SELECT 1 AS M UNION ALL SELECT M + 1 FROM Months WHERE M < 12) SELECT m.M, COUNT(t.TransactionID) AS Cnt FROM Months m LEFT JOIN Transactions t ON MONTH(t.TransDate) = m.M AND t.TransDate >= '20260101' AND t.TransDate < '20270101' GROUP BY m.M ORDER BY m.M;"]
        },
        {
          t: 'task', id: 'm12l2t2', title: 'Вся вертикаль подчинения',
          text: "<p>Выведите всех подчинённых (на всех уровнях) заместителя председателя по рознице (<code>EmployeeID = 2</code>), не включая её саму: <code>EmployeeID</code>, <code>FullName</code>, <code>Lvl</code> (1 — прямые подчинённые, 2 — их подчинённые и т. д.).</p>",
          solution: 'WITH Sub AS (\n    SELECT EmployeeID, FullName, 1 AS Lvl\n    FROM Employees WHERE ManagerID = 2\n    UNION ALL\n    SELECT e.EmployeeID, e.FullName, s.Lvl + 1\n    FROM Employees e\n    JOIN Sub s ON e.ManagerID = s.EmployeeID\n)\nSELECT EmployeeID, FullName, Lvl FROM Sub;',
          check: { names: true }
        },
        {
          t: 'quiz', id: 'm12l2t3',
          q: '<p>Нужен календарь на весь 2026 год (365 дней) через рекурсивный CTE. Что произойдёт без дополнительных настроек?</p>',
          options: ['Всё сработает', 'Ошибка 530: превышен лимит рекурсии 100', 'Вернутся только первые 100 дней без ошибки', 'Запрос зависнет'],
          answer: 1,
          explain: 'По умолчанию MAXRECURSION = 100. Добавьте в конец запроса OPTION (MAXRECURSION 400).'
        }
      ]
    },
    {
      id: 'm12l3', title: 'Временные таблицы #temp', minutes: 12,
      steps: [
        {
          t: 'text', title: 'Сохранить промежуточный результат',
          html: '<p>Временная таблица хранит промежуточный результат, к которому можно обращаться <b>много раз</b> разными запросами. Имя начинается с <code>#</code>. Проще всего создать её так:</p>' +
            '<pre class="sql">SELECT ClientID, SUM(Amount) AS Spent\nINTO #CardSpend                -- создаём временную таблицу\nFROM ...\nGROUP BY ClientID;\n\nSELECT COUNT(*) FROM #CardSpend;          -- используем\nSELECT TOP (5) * FROM #CardSpend ORDER BY Spent DESC;   -- и ещё раз\n\nDROP TABLE IF EXISTS #CardSpend;          -- удаляем, когда не нужна</pre>' +
            '<ul><li>Временную таблицу видите только вы, она удаляется автоматически, когда вы закрываете окно запроса (сеанс) в SSMS.</li>' +
            '<li>В нашем тренажёре сеанс — один запуск: создайте таблицу и используйте её в одном и том же скрипте.</li>' +
            '<li>Повторное <code>SELECT … INTO #t</code> при существующей #t даст ошибку — поэтому в начале скрипта часто пишут <code>DROP TABLE IF EXISTS #t;</code>.</li></ul>'
        },
        {
          t: 'example', title: 'Посчитали один раз — используем трижды',
          sql: "DROP TABLE IF EXISTS #CardSpend;\n\nSELECT a.ClientID, SUM(t.Amount) AS Spent, COUNT(*) AS Purchases\nINTO #CardSpend\nFROM Transactions t\nJOIN Accounts a ON a.AccountID = t.AccountID\nWHERE t.TransType = N'Оплата картой'\n  AND t.TransDate >= '20260101' AND t.TransDate < '20270101'\nGROUP BY a.ClientID;\n\nSELECT COUNT(*) AS Buyers, SUM(Spent) AS Total FROM #CardSpend;\n\nSELECT TOP (5) c.LastName, s.Spent\nFROM #CardSpend s JOIN Clients c ON c.ClientID = s.ClientID\nORDER BY s.Spent DESC;\n\nSELECT AVG(Purchases * 1.0) AS AvgPurchases FROM #CardSpend;",
          noTrace: true,
          after: '<p>На вкладке «Сообщения» видно, сколько строк записано во временную таблицу.</p>'
        },
        {
          t: 'text', title: 'CTE или временная таблица?',
          html: '<table><tr><th></th><th>CTE</th><th>#temp</th></tr>' +
            '<tr><td>Живёт</td><td>одну инструкцию</td><td>весь сеанс (до DROP или закрытия окна)</td></tr>' +
            '<tr><td>Хранит данные</td><td>нет, это «именованный подзапрос»</td><td>да, физически (в системной базе tempdb)</td></tr>' +
            '<tr><td>Повторное использование</td><td>каждый раз вычисляется заново</td><td>вычислено один раз</td></tr>' +
            '<tr><td>Когда брать</td><td>для читаемости, рекурсии</td><td>тяжёлый промежуточный результат нужен несколько раз; отладка сложного отчёта по шагам</td></tr></table>' +
            '<p>Бывают ещё табличные переменные (<code>DECLARE @t TABLE (...)</code>). Для небольших списков они удобны, но для больших объёмов аналитики обычно выбирают #temp. В нашем тренажёре табличные переменные не поддерживаются.</p>'
        }
      ],
      training: [
        {
          t: 'task', id: 'm12l3t1', title: 'Крупные операции во временной таблице',
          text: "<p>Сохраните во временную таблицу <code>#Big</code> операции дороже 100 000 (<code>TransactionID</code>, <code>AccountID</code>, <code>Amount</code>), а затем одним запросом из <code>#Big</code> выведите их количество (<code>Cnt</code>) и сумму (<code>Total</code>).</p>",
          solution: 'SELECT TransactionID, AccountID, Amount\nINTO #Big\nFROM Transactions\nWHERE Amount > 100000;\n\nSELECT COUNT(*) AS Cnt, SUM(Amount) AS Total\nFROM #Big;',
          check: { names: true, require: [['INTO\\s+#Big', 'Создайте временную таблицу #Big через SELECT … INTO.'], ['FROM\\s+#Big', 'Итоговый запрос должен читать из #Big.']] }
        },
        {
          t: 'task', id: 'm12l3t2', title: 'Топ по оборотам',
          text: "<p>Сохраните в <code>#Turn</code> оборот по клиентам (<code>ClientID</code>, <code>Turnover</code> — сумма всех операций по всем его счетам), затем выведите из неё 5 клиентов с наибольшим оборотом.</p>",
          solution: 'SELECT a.ClientID, SUM(t.Amount) AS Turnover\nINTO #Turn\nFROM Transactions t\nJOIN Accounts a ON a.AccountID = t.AccountID\nGROUP BY a.ClientID;\n\nSELECT TOP (5) ClientID, Turnover\nFROM #Turn\nORDER BY Turnover DESC;',
          check: { names: true, order: [[1, 'desc']], require: [['INTO\\s+#Turn', 'Создайте временную таблицу #Turn.']] }
        },
        {
          t: 'quiz', id: 'm12l3t3',
          q: '<p>Скрипт выполняется второй раз в том же окне SSMS и падает на <code>SELECT … INTO #Big</code>. Почему?</p>',
          options: ['Временные таблицы запрещены', '#Big уже существует после первого запуска', 'Нужна точка с запятой', 'INTO нельзя использовать с WHERE'],
          answer: 1,
          explain: 'Временная таблица живёт до конца сеанса. В начале скрипта пишут DROP TABLE IF EXISTS #Big;'
        }
      ]
    }
  ],
  homework: [
    {
      id: 'm12hw1', title: 'Клиенты выше среднего по городу',
      text: "<p>С помощью CTE посчитайте сумму остатков по сомовым счетам для каждого клиента, затем среднюю такую сумму по каждому городу. Выведите клиентов, чья сумма выше средней по их городу: <code>ClientID</code>, <code>City</code>, <code>TotalKGS</code>, <code>CityAvg</code>.</p>",
      solution: "WITH CT AS (\n    SELECT c.ClientID, c.City, SUM(a.Balance) AS TotalKGS\n    FROM Clients c JOIN Accounts a ON a.ClientID = c.ClientID\n    WHERE a.Currency = 'KGS'\n    GROUP BY c.ClientID, c.City\n),\nCityAvg AS (\n    SELECT City, AVG(TotalKGS) AS CityAvg FROM CT GROUP BY City\n)\nSELECT CT.ClientID, CT.City, CT.TotalKGS, ca.CityAvg\nFROM CT\nJOIN CityAvg ca ON ca.City = CT.City\nWHERE CT.TotalKGS > ca.CityAvg;",
      check: { names: true }
    },
    {
      id: 'm12hw2', title: 'Календарь сентября с выдачами',
      text: "<p>Постройте календарь всех дней сентября 2026 и выведите для каждого дня (<code>D</code>) число выданных кредитов (<code>Loans</code>), включая дни без выдач. Сортировка по дате.</p>",
      solution: "WITH Cal AS (\n    SELECT CAST('20260901' AS DATE) AS D\n    UNION ALL\n    SELECT DATEADD(day, 1, D) FROM Cal WHERE D < '20260930'\n)\nSELECT c.D, COUNT(l.LoanID) AS Loans\nFROM Cal c\nLEFT JOIN Loans l ON l.IssueDate = c.D\nGROUP BY c.D\nORDER BY c.D;",
      check: { names: true, ordered: true }
    },
    {
      id: 'm12hw3', title: 'Уровень в иерархии',
      text: "<p>Для каждого сотрудника выведите <code>EmployeeID</code>, <code>FullName</code> и уровень в иерархии <code>Lvl</code> (председатель — 0, его прямые подчинённые — 1 и т. д.).</p>",
      solution: 'WITH Tree AS (\n    SELECT EmployeeID, FullName, 0 AS Lvl FROM Employees WHERE ManagerID IS NULL\n    UNION ALL\n    SELECT e.EmployeeID, e.FullName, t.Lvl + 1\n    FROM Employees e JOIN Tree t ON e.ManagerID = t.EmployeeID\n)\nSELECT EmployeeID, FullName, Lvl FROM Tree;',
      check: { names: true }
    },
    {
      id: 'm12hw4', title: 'Отчёт через временную таблицу',
      text: "<p>Сохраните в <code>#Active</code> клиентов, у которых были проведённые операции в октябре 2026 (<code>ClientID</code>, без повторов). Затем выведите разбивку этих клиентов по городам: <code>City</code>, <code>Cnt</code>, по убыванию Cnt.</p>",
      solution: "SELECT DISTINCT a.ClientID\nINTO #Active\nFROM Transactions t JOIN Accounts a ON a.AccountID = t.AccountID\nWHERE t.Status = N'Проведена' AND t.TransDate >= '20261001' AND t.TransDate < '20261101';\n\nSELECT c.City, COUNT(*) AS Cnt\nFROM #Active x JOIN Clients c ON c.ClientID = x.ClientID\nGROUP BY c.City\nORDER BY Cnt DESC;",
      check: { names: true, order: [[1, 'desc']], require: [['INTO\\s+#Active', 'Создайте временную таблицу #Active.']] }
    },
    {
      id: 'm12hw5', title: 'Нарастающий год по месяцам (без окон)',
      text: "<p>Через CTE с помесячными суммами проведённых операций 2026 года (<code>M</code>, <code>Total</code>) выведите для каждого месяца сумму с начала года <code>YTD</code> — с помощью коррелированного подзапроса к этому же CTE. Сортировка по месяцу. (В модуле 13 сделаем то же оконной функцией.)</p>",
      solution: "WITH MonthTotals AS (\n    SELECT MONTH(TransDate) AS M, SUM(Amount) AS Total\n    FROM Transactions\n    WHERE Status = N'Проведена' AND TransDate >= '20260101' AND TransDate < '20270101'\n    GROUP BY MONTH(TransDate)\n)\nSELECT m.M, m.Total,\n       (SELECT SUM(m2.Total) FROM MonthTotals m2 WHERE m2.M <= m.M) AS YTD\nFROM MonthTotals m\nORDER BY m.M;",
      check: { names: true, ordered: true },
      alsoOk: ["WITH MonthTotals AS (SELECT MONTH(TransDate) AS M, SUM(Amount) AS Total FROM Transactions WHERE Status = N'Проведена' AND TransDate >= '20260101' AND TransDate < '20270101' GROUP BY MONTH(TransDate)) SELECT M, Total, SUM(Total) OVER (ORDER BY M ROWS UNBOUNDED PRECEDING) AS YTD FROM MonthTotals ORDER BY M;"]
    }
  ]
});
