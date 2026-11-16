/* Модуль 14. Отчёты с итогами и быстрые запросы */
COURSE.addModule({
  id: 'm14', num: 14,
  title: 'Отчёты с итогами и быстрые запросы',
  short: 'ROLLUP, CUBE, GROUPING SETS и подписи итогов; как писать запросы, которые не «вешают» сервер; итоговый проект.',
  goal: '<p>Финальный модуль: делаем отчёты с промежуточными и общими итогами, как в Excel, и учимся писать запросы, которые быстро работают на больших боевых таблицах. В домашнем задании — итоговый проект.</p>',
  read: [
    ['Расширения SQL Server для группировки (ROLLUP, CUBE, GROUPING SETS)', 'https://metanit.com/sql/sqlserver/5.3.php'],
    ['Документация Microsoft: просмотр плана выполнения', 'https://learn.microsoft.com/ru-ru/sql/relational-databases/performance/display-an-actual-execution-plan']
  ],
  lessons: [
    {
      id: 'm14l1', title: 'Промежуточные итоги: ROLLUP, CUBE, GROUPING SETS', minutes: 16,
      steps: [
        {
          t: 'text', title: 'Итоги как в Excel',
          html: '<p>Отчёту часто нужны строки «Итого по валюте» и «Всего». Можно склеить несколько запросов через UNION ALL, но в T-SQL есть встроенные расширения GROUP BY:</p>' +
            '<ul><li><code>GROUP BY ROLLUP (Currency, AccountType)</code> — детальные строки + итог по каждой валюте + общий итог. Итоги идут «по иерархии» справа налево.</li>' +
            '<li><code>GROUP BY CUBE (Currency, AccountType)</code> — итоги по <b>всем</b> комбинациям: по валютам, по типам счетов и общий.</li>' +
            '<li><code>GROUP BY GROUPING SETS ((Currency), (AccountType), ())</code> — ровно те разрезы, которые вы перечислили.</li></ul>' +
            '<p>В строках итогов «свёрнутый» столбец содержит NULL.</p>'
        },
        {
          t: 'example', title: 'ROLLUP',
          sql: 'SELECT Currency, AccountType, COUNT(*) AS Cnt, SUM(Balance) AS Total\nFROM Accounts\nGROUP BY ROLLUP (Currency, AccountType);',
          after: '<p>Строки с NULL в AccountType — итоги по валюте, последняя строка с двумя NULL — общий итог. (Суммировать разные валюты в общий итог по смыслу нельзя — здесь это только демонстрация механизма.)</p>'
        },
        {
          t: 'text', title: 'Подписи итогов: GROUPING()',
          html: '<p>Как отличить NULL «итоговой строки» от настоящего NULL в данных? Функция <code>GROUPING(столбец)</code> возвращает 1, если в этой строке столбец свёрнут в итог:</p>' +
            '<pre class="sql">CASE WHEN GROUPING(City) = 1 THEN N\'ИТОГО\' ELSE City END AS City</pre>'
        },
        {
          t: 'example', title: 'Красивые итоги',
          sql: "SELECT CASE WHEN GROUPING(p.ProductName) = 1 THEN N'ВСЕГО' ELSE p.ProductName END AS Product,\n       CASE WHEN GROUPING(l.Status) = 1 THEN N'итого по продукту' ELSE l.Status END AS Status,\n       COUNT(*) AS Loans,\n       SUM(l.Amount) AS Amount\nFROM Loans l\nJOIN LoanProducts p ON p.ProductID = l.ProductID\nGROUP BY ROLLUP (p.ProductName, l.Status);"
        },
        {
          t: 'example', title: 'Только нужные разрезы: GROUPING SETS',
          sql: "SELECT City, ClientType, COUNT(*) AS Cnt\nFROM Clients\nGROUP BY GROUPING SETS ((City), (ClientType), ())\nORDER BY GROUPING(City), City, ClientType;"
        },
        {
          t: 'quiz', id: 'm14l1q1',
          q: '<p>Какие группировки создаёт <code>ROLLUP (A, B)</code>?</p>',
          options: ['(A, B) и ()', '(A, B), (A) и ()', '(A, B), (A), (B) и ()', 'только (A, B)'],
          answer: 1,
          explain: 'ROLLUP «сворачивает» столбцы справа налево: детали, итог по A, общий итог. Все комбинации, включая (B), даёт CUBE.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm14l1t1', title: 'Клиенты с итогами',
          text: '<p>Выведите количество клиентов (<code>Cnt</code>) по городам и типам клиентов с итогами по каждому городу и общим итогом (ROLLUP по <code>City</code>, <code>ClientType</code>). Столбцы: <code>City</code>, <code>ClientType</code>, <code>Cnt</code>.</p>',
          solution: 'SELECT City, ClientType, COUNT(*) AS Cnt\nFROM Clients\nGROUP BY ROLLUP (City, ClientType);',
          check: { names: true }
        },
        {
          t: 'task', id: 'm14l1t2', title: 'Подпись ИТОГО',
          text: "<p>Выведите число счетов (<code>Cnt</code>) по валютам и общий итог. В строке общего итога в столбце <code>Currency</code> должно быть написано <b>ИТОГО</b>.</p>",
          solution: "SELECT CASE WHEN GROUPING(Currency) = 1 THEN N'ИТОГО' ELSE Currency END AS Currency,\n       COUNT(*) AS Cnt\nFROM Accounts\nGROUP BY ROLLUP (Currency);",
          check: { names: true },
          alsoOk: ["SELECT CASE WHEN GROUPING(Currency) = 1 THEN N'ИТОГО' ELSE Currency END AS Currency, COUNT(*) AS Cnt FROM Accounts GROUP BY GROUPING SETS ((Currency), ());"]
        },
        {
          t: 'task', id: 'm14l1t3', title: 'Два разреза одним запросом',
          text: "<p>Одним запросом выведите сумму кредитов (<code>Total</code>) отдельно по статусам и отдельно по срокам (<code>Status</code>, <code>TermMonths</code>, <code>Total</code>) — без пересечений и без общего итога.</p>",
          solution: 'SELECT Status, TermMonths, SUM(Amount) AS Total\nFROM Loans\nGROUP BY GROUPING SETS ((Status), (TermMonths));',
          check: { names: true }
        },
        {
          t: 'quiz', id: 'm14l1t4',
          q: '<p>Что вернёт <code>GROUPING(City)</code> в обычной (неитоговой) строке?</p>',
          options: ['NULL', '0', '1', 'Название города'],
          answer: 1,
          explain: 'GROUPING = 1 только в строках, где столбец свёрнут в итог, иначе 0.'
        }
      ]
    },
    {
      id: 'm14l2', title: 'Быстрые запросы: как не «положить» сервер', minutes: 20,
      steps: [
        {
          t: 'text', title: 'Как сервер ищет данные',
          html: '<p>В учебной базе 10 тысяч операций, а в настоящей — сотни миллионов. Там один неудачный запрос может работать часами и мешать всему банку.</p>' +
            '<p>Чтобы быстро найти строки, у таблиц есть <b>индексы</b> — как алфавитный указатель в конце книги. Ищете «DATEADD» — открываете указатель на букву D и сразу переходите на нужную страницу (<b>Index Seek</b>). Без указателя пришлось бы листать книгу целиком (<b>Scan</b>).</p>' +
            '<p>Индексы создают администраторы баз данных. Задача аналитика — писать условия так, чтобы сервер <b>мог</b> ими воспользоваться.</p>'
        },
        {
          t: 'text', title: 'Не трогайте столбец в условии',
          html: '<p>Если в WHERE над столбцом стоит функция или вычисление, сервер не может использовать индекс: ему приходится вычислить функцию для <b>каждой</b> строки таблицы. Условия, которые индекс использовать могут, называют <b>саргируемыми</b> (SARGable).</p>' +
            '<table><tr><th>Медленно (функция над столбцом)</th><th>Быстро (столбец «чистый»)</th></tr>' +
            '<tr><td><code>WHERE YEAR(TransDate) = 2026</code></td><td><code>WHERE TransDate &gt;= \'20260101\' AND TransDate &lt; \'20270101\'</code></td></tr>' +
            '<tr><td><code>WHERE CAST(TransDate AS DATE) = \'20261030\'</code></td><td><code>WHERE TransDate &gt;= \'20261030\' AND TransDate &lt; \'20261031\'</code></td></tr>' +
            '<tr><td><code>WHERE LEFT(LastName, 2) = N\'Ка\'</code></td><td><code>WHERE LastName LIKE N\'Ка%\'</code></td></tr>' +
            '<tr><td><code>WHERE ISNULL(Status, N\'\') = N\'Активен\'</code></td><td><code>WHERE Status = N\'Активен\'</code></td></tr>' +
            '<tr><td><code>WHERE Amount * 1.12 &gt; 10000</code></td><td><code>WHERE Amount &gt; 10000 / 1.12</code></td></tr></table>' +
            '<p>Ещё одна скрытая причина медленной работы — <b>неявное преобразование типов</b>: сравнение текстового столбца с числом (<code>WHERE Phone = 996555111</code>) заставляет сервер преобразовать каждую строку столбца. Сравнивайте значения того же типа, что и столбец.</p>'
        },
        {
          t: 'quiz', id: 'm14l2q1',
          q: '<p>Какие условия позволят серверу использовать индекс по столбцу <code>TransDate</code>? Отметьте все.</p>',
          options: ["<code>TransDate &gt;= '20261001' AND TransDate &lt; '20261101'</code>", "<code>MONTH(TransDate) = 10</code>", "<code>TransDate &gt;= DATEADD(day, -7, '20261031')</code>", "<code>DATEDIFF(day, TransDate, '20261031') &lt;= 7</code>", "<code>FORMAT(TransDate, 'yyyy-MM') = '2026-10'</code>"],
          answer: [0, 2],
          explain: 'Функция над константой (DATEADD от фиксированной даты) — нормально: она вычисляется один раз. Функция над самим столбцом (MONTH, DATEDIFF, FORMAT) мешает индексу.'
        },
        {
          t: 'text', title: 'Гигиена запросов аналитика',
          html: '<ol><li><b>Только нужные столбцы</b> — вместо <code>SELECT *</code>.</li>' +
            '<li><b>Сначала TOP</b> — исследуя незнакомую большую таблицу, начинайте с <code>SELECT TOP (100)</code>.</li>' +
            '<li><b>Фильтруйте рано</b> — условия на строки в WHERE, а не в HAVING.</li>' +
            '<li><b>UNION ALL вместо UNION</b>, если дубли не нужно убирать.</li>' +
            '<li><b>DISTINCT — не лекарство.</b> Если после JOIN появились дубли, найдите причину (размножение строк), а не прячьте её.</li>' +
            '<li><b>Явная рамка ROWS</b> в нарастающих итогах — RANGE медленнее.</li>' +
            '<li><b>Тяжёлый промежуточный результат</b>, нужный несколько раз, — во временную таблицу #temp.</li>' +
            '<li><b>Агрегируйте до соединения</b>, а не после: меньше строк в JOIN — быстрее и без задвоения.</li></ol>'
        },
        {
          t: 'text', title: 'План выполнения и статистика в SSMS',
          html: '<ul><li><kbd>Ctrl</kbd>+<kbd>L</kbd> — <b>предполагаемый план</b>: как сервер собирается выполнять запрос, без запуска. Безопасно для тяжёлых запросов.</li>' +
            '<li><kbd>Ctrl</kbd>+<kbd>M</kbd>, затем <kbd>F5</kbd> — <b>фактический план</b> после выполнения.</li>' +
            '<li>План читают <b>справа налево</b>: источники данных справа, результат — слева. Толщина стрелок — количество строк: толстая стрелка там, где миллионы строк, — место для поиска проблемы.</li>' +
            '<li><code>Index Seek</code> — хорошо. <code>Table Scan</code> / <code>Clustered Index Scan</code> по огромной таблице при узком фильтре — повод проверить условие на саргируемость. Жёлтый треугольник с «!» — предупреждение (например, нехватка памяти).</li>' +
            '<li><code>SET STATISTICS IO, TIME ON;</code> перед запросом — на вкладке «Сообщения» покажет, сколько страниц прочитано и сколько времени ушло. Сравнивайте два варианта запроса по этим числам.</li></ul>' +
            '<p>В учебном тренажёре плана выполнения нет — эти навыки пригодятся в SSMS на работе.</p>'
        },
        {
          t: 'text', title: 'WITH (NOLOCK): удобно, но опасно',
          html: '<p>В банках часто встречается подсказка <code>FROM Transactions WITH (NOLOCK)</code>: запрос не ждёт, пока другие транзакции закончат запись. Это быстрее и не мешает рабочим процессам, но читаются <b>«грязные» данные</b>: незафиксированные (и потом отменённые) изменения, а иногда одна строка может прочитаться дважды или пропасть.</p>' +
            '<ul><li>Для оперативного мониторинга «примерно сколько» — допустимо.</li><li>Для финансовой отчётности, сверок и сумм «до копейки» — нельзя.</li></ul>' +
            '<p>Узнайте у администраторов, есть ли у вас <b>копия базы для отчётов</b> (реплика). Тяжёлые аналитические запросы правильно запускать там, а не на рабочей базе, через которую идут платежи клиентов.</p>'
        },
        {
          t: 'quiz', id: 'm14l2q2',
          q: '<p>Отчёт после JOIN выдаёт дубли строк. Как правильно поступить?</p>',
          options: ['Добавить DISTINCT — дубли исчезнут', 'Разобраться, какая таблица размножает строки, и исправить соединение или агрегировать заранее', 'Заменить JOIN на CROSS JOIN', 'Добавить WITH (NOLOCK)'],
          answer: 1,
          explain: 'DISTINCT прячет симптом, но суммы при этом могут остаться задвоенными. Ищите причину размножения строк.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm14l2t1', title: 'Перепишите: год и месяц',
          text: "<p>Запрос работает, но медленно на большой таблице:</p><pre class=\"sql\">SELECT TransactionID, Amount\nFROM Transactions\nWHERE YEAR(TransDate) = 2026 AND MONTH(TransDate) = 3;</pre><p>Перепишите условие так, чтобы над столбцом <code>TransDate</code> не было функций. Результат должен остаться тем же.</p>",
          solution: "SELECT TransactionID, Amount\nFROM Transactions\nWHERE TransDate >= '20260301' AND TransDate < '20260401';",
          check: { forbid: [['YEAR\\s*\\(|MONTH\\s*\\(|DATEPART\\s*\\(|FORMAT\\s*\\(|CAST\\s*\\(\\s*TransDate|CONVERT\\s*\\(', 'Над столбцом TransDate не должно быть функций — используйте диапазон дат.']] }
        },
        {
          t: 'task', id: 'm14l2t2', title: 'Перепишите: начало фамилии',
          text: "<p>Перепишите без функции над столбцом:</p><pre class=\"sql\">SELECT ClientID, LastName\nFROM Clients\nWHERE LEFT(LastName, 3) = N'Иса';</pre>",
          solution: "SELECT ClientID, LastName\nFROM Clients\nWHERE LastName LIKE N'Иса%';",
          check: { forbid: [['LEFT\\s*\\(|SUBSTRING\\s*\\(', 'Не используйте LEFT/SUBSTRING над столбцом — подойдёт LIKE с шаблоном.']] }
        },
        {
          t: 'task', id: 'm14l2t3', title: 'Перепишите: ISNULL в условии',
          text: "<p>Перепишите без ISNULL/COALESCE над столбцом, сохранив смысл (нужны операции без категории или с категорией, отличной от «Продукты»):</p><pre class=\"sql\">SELECT TransactionID, Category\nFROM Transactions\nWHERE ISNULL(Category, N'') <> N'Продукты';</pre>",
          solution: "SELECT TransactionID, Category\nFROM Transactions\nWHERE Category <> N'Продукты' OR Category IS NULL;",
          check: { forbid: [['ISNULL\\s*\\(|COALESCE\\s*\\(', 'Обойдитесь без функций над столбцом: Category <> … OR Category IS NULL.']] }
        },
        {
          t: 'task', id: 'm14l2t4', title: 'Перепишите: один день',
          text: "<p>Перепишите без функции над столбцом:</p><pre class=\"sql\">SELECT TransactionID, TransDate\nFROM Transactions\nWHERE CAST(TransDate AS DATE) = '20261030';</pre>",
          solution: "SELECT TransactionID, TransDate\nFROM Transactions\nWHERE TransDate >= '20261030' AND TransDate < '20261031';",
          check: { forbid: [['CAST\\s*\\(|CONVERT\\s*\\(|DAY\\s*\\(|DATEDIFF\\s*\\(', 'Используйте диапазон: от начала дня до начала следующего дня.']] }
        },
        {
          t: 'quiz', id: 'm14l2t5',
          q: '<p>Почему запрос с <code>WITH (NOLOCK)</code> не подходит для сверки остатков «до копейки»?</p>',
          options: ['Он работает медленнее', 'Он может прочитать незафиксированные данные, пропустить или задвоить строки', 'Он запрещён в SQL Server', 'Он не поддерживает SUM'],
          answer: 1,
          explain: 'NOLOCK = уровень изоляции READ UNCOMMITTED: «грязное» чтение. Для точной отчётности нужны согласованные данные.'
        }
      ]
    }
  ],
  hwIntro: '<p><b>Итоговый проект.</b> Вы — аналитик Учебного банка, руководство просит пакет отчётов. Каждая задача — реальный отчёт, собранный из всего, что вы изучили: соединений, группировок, CTE, оконных функций и итогов. Не торопитесь, стройте запрос по шагам через CTE и проверяйте промежуточные результаты.</p>',
  homework: [
    {
      id: 'm14hw1', title: 'Отчёт по филиалам',
      text: "<p>Для <b>каждого</b> филиала выведите: <code>BranchName</code>, число закреплённых клиентов <code>Clients</code>, число их счетов <code>Accounts</code> и сумму остатков по их сомовым счетам <code>BalanceKGS</code> (0, если нет). Следите за задвоением: агрегируйте до соединения. Сортировка по BranchID.</p>",
      solution: "WITH C AS (\n    SELECT BranchID, COUNT(*) AS Clients FROM Clients GROUP BY BranchID\n),\nA AS (\n    SELECT c.BranchID, COUNT(*) AS Accounts,\n           SUM(CASE WHEN a.Currency = 'KGS' THEN a.Balance ELSE 0 END) AS BalanceKGS\n    FROM Accounts a JOIN Clients c ON c.ClientID = a.ClientID\n    GROUP BY c.BranchID\n)\nSELECT b.BranchName, ISNULL(C.Clients, 0) AS Clients, ISNULL(A.Accounts, 0) AS Accounts, ISNULL(A.BalanceKGS, 0) AS BalanceKGS\nFROM Branches b\nLEFT JOIN C ON C.BranchID = b.BranchID\nLEFT JOIN A ON A.BranchID = b.BranchID\nORDER BY b.BranchID;",
      check: { names: true, ordered: true },
      wrong: ["SELECT b.BranchName, COUNT(c.ClientID) AS Clients, COUNT(a.AccountID) AS Accounts, SUM(CASE WHEN a.Currency = 'KGS' THEN a.Balance ELSE 0 END) AS BalanceKGS FROM Branches b LEFT JOIN Clients c ON c.BranchID = b.BranchID LEFT JOIN Accounts a ON a.ClientID = c.ClientID GROUP BY b.BranchID, b.BranchName ORDER BY b.BranchID;"]
    },
    {
      id: 'm14hw2', title: 'Кредитный портфель с итогом',
      text: "<p>Для каждого продукта выведите <code>Product</code> (название, а в итоговой строке — <b>ВСЕГО</b>), число кредитов <code>Loans</code>, сумму <code>Amount</code> и долю просроченных по количеству в процентах <code>OverduePct</code> (DECIMAL(5,2)). Итоговая строка — последней.</p>",
      solution: "SELECT CASE WHEN GROUPING(p.ProductName) = 1 THEN N'ВСЕГО' ELSE p.ProductName END AS Product,\n       COUNT(*) AS Loans,\n       SUM(l.Amount) AS Amount,\n       CAST(100.0 * SUM(CASE WHEN l.Status = N'Просрочен' THEN 1 ELSE 0 END) / COUNT(*) AS DECIMAL(5,2)) AS OverduePct\nFROM Loans l\nJOIN LoanProducts p ON p.ProductID = l.ProductID\nGROUP BY ROLLUP (p.ProductName)\nORDER BY GROUPING(p.ProductName), Product;",
      check: { names: true }
    },
    {
      id: 'm14hw3', title: 'Ежемесячные KPI',
      text: "<p>По проведённым операциям 2026 года для каждого месяца выведите: <code>Mon</code>, число активных клиентов <code>ActiveClients</code> (у кого была хотя бы одна операция), число операций <code>Ops</code>, оборот <code>Turnover</code> и изменение оборота к прошлому месяцу в процентах <code>TurnoverChangePct</code> (DECIMAL(10,2), для января NULL). Сортировка по месяцу.</p>",
      solution: "WITH M AS (\n    SELECT MONTH(t.TransDate) AS Mon,\n           COUNT(DISTINCT a.ClientID) AS ActiveClients,\n           COUNT(*) AS Ops,\n           SUM(t.Amount) AS Turnover\n    FROM Transactions t\n    JOIN Accounts a ON a.AccountID = t.AccountID\n    WHERE t.Status = N'Проведена' AND t.TransDate >= '20260101' AND t.TransDate < '20270101'\n    GROUP BY MONTH(t.TransDate)\n)\nSELECT Mon, ActiveClients, Ops, Turnover,\n       CAST(100.0 * (Turnover - LAG(Turnover) OVER (ORDER BY Mon)) / LAG(Turnover) OVER (ORDER BY Mon) AS DECIMAL(10,2)) AS TurnoverChangePct\nFROM M\nORDER BY Mon;",
      check: { names: true, ordered: true }
    },
    {
      id: 'm14hw4', title: 'Лучшие кредитные специалисты',
      text: "<p>Для каждого филиала выведите двух лучших кредитных специалистов по общей сумме выданных кредитов: <code>BranchName</code>, <code>FullName</code>, <code>TotalAmount</code>, <code>Place</code> (1 или 2; при равенстве сумм — меньший EmployeeID выше). Филиал берите по месту работы сотрудника.</p>",
      solution: "WITH S AS (\n    SELECT e.EmployeeID, e.FullName, e.BranchID, SUM(l.Amount) AS TotalAmount\n    FROM Loans l JOIN Employees e ON e.EmployeeID = l.EmployeeID\n    GROUP BY e.EmployeeID, e.FullName, e.BranchID\n),\nR AS (\n    SELECT S.*, ROW_NUMBER() OVER (PARTITION BY BranchID ORDER BY TotalAmount DESC, EmployeeID) AS Place\n    FROM S\n)\nSELECT b.BranchName, R.FullName, R.TotalAmount, R.Place\nFROM R JOIN Branches b ON b.BranchID = R.BranchID\nWHERE R.Place <= 2;",
      check: { names: true }
    },
    {
      id: 'm14hw5', title: 'Уснувшие клиенты',
      text: "<p>Найдите клиентов, у которых есть хотя бы один открытый счёт, но не было ни одной операции за 90 дней до 1 ноября 2026 (с <code>DATEADD(day, -90, '20261101')</code> до 1 ноября). Выведите <code>ClientID</code>, <code>LastName</code>, <code>Phone</code> и дату последней операции <code>LastOp</code> за всё время (NULL, если операций не было). Сортировка: сначала с самой давней последней операцией (NULL — первыми), затем по ClientID.</p>",
      solution: "WITH LastOps AS (\n    SELECT a.ClientID, MAX(t.TransDate) AS LastOp\n    FROM Accounts a JOIN Transactions t ON t.AccountID = a.AccountID\n    GROUP BY a.ClientID\n)\nSELECT c.ClientID, c.LastName, c.Phone, lo.LastOp\nFROM Clients c\nLEFT JOIN LastOps lo ON lo.ClientID = c.ClientID\nWHERE EXISTS (SELECT 1 FROM Accounts a WHERE a.ClientID = c.ClientID AND a.CloseDate IS NULL)\n  AND NOT EXISTS (SELECT 1 FROM Accounts a JOIN Transactions t ON t.AccountID = a.AccountID\n                  WHERE a.ClientID = c.ClientID\n                    AND t.TransDate >= DATEADD(day, -90, '20261101') AND t.TransDate < '20261101')\nORDER BY lo.LastOp, c.ClientID;",
      check: { names: true, ordered: true }
    }
  ]
});
