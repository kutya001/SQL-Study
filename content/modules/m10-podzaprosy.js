/* Модуль 10. Подзапросы */
COURSE.addModule({
  id: 'm10', num: 10,
  title: 'Подзапросы',
  short: 'Запрос внутри запроса: сравнение со средним, IN, подзапрос во FROM, EXISTS, коррелированные подзапросы, ловушка NOT IN, APPLY.',
  goal: '<p>Подзапрос позволяет использовать результат одного запроса внутри другого: «операции больше среднего», «клиенты, у которых есть просрочка», «последний известный курс на дату».</p>',
  read: [
    ['Выполнение подзапросов', 'https://metanit.com/sql/sqlserver/6.1.php'],
    ['Подзапросы в основных командах SQL', 'https://metanit.com/sql/sqlserver/6.2.php'],
    ['Оператор EXISTS', 'https://metanit.com/sql/sqlserver/6.3.php']
  ],
  lessons: [
    {
      id: 'm10l1', title: 'Подзапрос как значение, список и таблица', minutes: 18,
      steps: [
        {
          t: 'text', title: 'Запрос в скобках',
          html: '<p><b>Подзапрос</b> — это SELECT в круглых скобках внутри другого запроса. Сначала вычисляется он, а его результат подставляется во внешний запрос.</p>' +
            '<p>Например, «счета с остатком выше среднего». Сначала нужно узнать среднее, затем сравнить с ним каждый счёт:</p>' +
            '<pre class="sql">SELECT AccountNumber, Balance\nFROM Accounts\nWHERE Balance > (SELECT AVG(Balance) FROM Accounts);</pre>' +
            '<p>Подзапрос, который возвращает ровно одно значение (одна строка, один столбец), называется <b>скалярным</b>. Его можно ставить везде, где ожидается значение.</p>'
        },
        {
          t: 'example', title: 'Выше среднего',
          sql: "SELECT AccountNumber, Currency, Balance\nFROM Accounts\nWHERE Currency = 'KGS'\n  AND Balance > (SELECT AVG(Balance) FROM Accounts WHERE Currency = 'KGS')\nORDER BY Balance DESC;"
        },
        {
          t: 'text', title: 'Подзапрос в SELECT: доля от итога',
          html: '<p>Скалярный подзапрос в SELECT удобен для расчёта доли от общего итога:</p>' +
            '<pre class="sql">SELECT ProductID,\n       SUM(Amount) AS Total,\n       CAST(100.0 * SUM(Amount) / (SELECT SUM(Amount) FROM Loans) AS DECIMAL(5,2)) AS SharePct\nFROM Loans\nGROUP BY ProductID;</pre>' +
            '<p>Если подзапрос вернёт больше одной строки там, где ждут одно значение, будет ошибка 512.</p>'
        },
        {
          t: 'example', title: 'Доля продуктов в портфеле',
          sql: 'SELECT ProductID,\n       SUM(Amount) AS Total,\n       CAST(100.0 * SUM(Amount) / (SELECT SUM(Amount) FROM Loans) AS DECIMAL(5,2)) AS SharePct\nFROM Loans\nGROUP BY ProductID\nORDER BY SharePct DESC;'
        },
        {
          t: 'text', title: 'IN (подзапрос): список значений',
          html: '<p>Подзапрос, возвращающий один столбец и много строк, можно использовать в <code>IN</code>:</p>' +
            '<pre class="sql">-- клиенты, у которых есть хотя бы один счёт в долларах\nSELECT ClientID, LastName\nFROM Clients\nWHERE ClientID IN (SELECT ClientID FROM Accounts WHERE Currency = \'USD\');</pre>' +
            '<p>В отличие от JOIN, клиент с тремя долларовыми счетами появится в результате только один раз.</p>'
        },
        {
          t: 'text', title: 'Подзапрос во FROM: сначала посчитать, потом использовать',
          html: '<p>Подзапрос можно поставить во FROM как временную таблицу (её называют <b>производной таблицей</b>). Обязательно дайте ей псевдоним, а вычисляемым столбцам — имена.</p>' +
            '<p>Так решается проблема задвоения из прошлого модуля: сначала агрегируем операции по счёту, а потом соединяем со счетами — строки уже не размножаются.</p>' +
            '<pre class="sql">SELECT a.AccountID, a.Balance, t.Trans, t.Turnover\nFROM Accounts a\nJOIN (SELECT AccountID, COUNT(*) AS Trans, SUM(Amount) AS Turnover\n      FROM Transactions\n      GROUP BY AccountID) AS t ON t.AccountID = a.AccountID;</pre>'
        },
        {
          t: 'example', title: 'Остаток и оборот без задвоения',
          sql: 'SELECT a.AccountID, a.Balance, t.Trans, t.Turnover\nFROM Accounts a\nJOIN (SELECT AccountID, COUNT(*) AS Trans, SUM(Amount) AS Turnover\n      FROM Transactions\n      GROUP BY AccountID) AS t ON t.AccountID = a.AccountID\nORDER BY a.AccountID;',
          after: '<p>Нажмите «Пошагово»: на шаге FROM уже готовые итоги по счетам, по одной строке на счёт.</p>'
        },
        {
          t: 'quiz', id: 'm10l1q1',
          q: '<p>Когда нужен псевдоним у подзапроса?</p>',
          options: ['Всегда, у любого подзапроса', 'Когда подзапрос стоит во FROM (производная таблица)', 'Только в WHERE', 'Никогда'],
          answer: 1,
          explain: 'Подзапрос во FROM — это «таблица», и у неё должно быть имя: (SELECT …) AS t. В WHERE и SELECT псевдоним не нужен.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm10l1t1', title: 'Кредиты крупнее среднего',
          text: '<p>Выведите <code>LoanID</code> и <code>Amount</code> кредитов, сумма которых больше средней суммы всех кредитов.</p>',
          solution: 'SELECT LoanID, Amount\nFROM Loans\nWHERE Amount > (SELECT AVG(Amount) FROM Loans);',
          check: { require: [['SELECT[\\s\\S]*\\(\\s*SELECT', 'Используйте подзапрос, чтобы вычислить среднее.']] }
        },
        {
          t: 'task', id: 'm10l1t2', title: 'Клиенты с просрочкой',
          text: "<p>Выведите <code>ClientID</code>, <code>LastName</code>, <code>FirstName</code> клиентов, у которых есть хотя бы один просроченный кредит. Используйте IN с подзапросом.</p>",
          solution: "SELECT ClientID, LastName, FirstName\nFROM Clients\nWHERE ClientID IN (SELECT ClientID FROM Loans WHERE Status = N'Просрочен');",
          check: { require: [['IN\\s*\\(\\s*SELECT', 'Используйте конструкцию IN (SELECT …).']] }
        },
        {
          t: 'task', id: 'm10l1t3', title: 'Доля городов',
          text: '<p>Для каждого города выведите число клиентов (<code>Cnt</code>) и их долю от всех клиентов банка в процентах (<code>SharePct</code>, DECIMAL(5,2)). Сортировка по доле по убыванию.</p>',
          solution: 'SELECT City, COUNT(*) AS Cnt,\n       CAST(100.0 * COUNT(*) / (SELECT COUNT(*) FROM Clients) AS DECIMAL(5,2)) AS SharePct\nFROM Clients\nGROUP BY City\nORDER BY SharePct DESC;',
          check: { names: true, order: [[2, 'desc']] }
        },
        {
          t: 'task', id: 'm10l1t4', title: 'Среднее число счетов',
          text: '<p>Сколько в среднем счетов у клиента, у которого есть хотя бы один счёт? Выведите одно число <code>AvgAccounts</code> с 2 знаками после запятой (DECIMAL(10,2)).</p>',
          solution: 'SELECT CAST(AVG(Cnt * 1.0) AS DECIMAL(10,2)) AS AvgAccounts\nFROM (SELECT ClientID, COUNT(*) AS Cnt FROM Accounts GROUP BY ClientID) AS t;',
          check: { names: true },
          hint: 'Сначала подзапросом во FROM посчитайте число счетов у каждого клиента, затем возьмите среднее. Не забудьте про целочисленное деление.'
        }
      ]
    },
    {
      id: 'm10l2', title: 'EXISTS, коррелированные подзапросы и ловушка NOT IN', minutes: 18,
      steps: [
        {
          t: 'text', title: 'Коррелированный подзапрос',
          html: '<p>Подзапрос может ссылаться на строку внешнего запроса. Тогда он вычисляется заново <b>для каждой строки</b> — как формула, которая «смотрит» на свою строку:</p>' +
            '<pre class="sql">-- операции, которые больше среднего по СВОЕМУ счёту\nSELECT t.TransactionID, t.AccountID, t.Amount\nFROM Transactions t\nWHERE t.Amount > (SELECT AVG(t2.Amount)\n                  FROM Transactions t2\n                  WHERE t2.AccountID = t.AccountID);</pre>' +
            '<p>Обратите внимание на разные псевдонимы <code>t</code> и <code>t2</code> одной таблицы: <code>t</code> — текущая строка снаружи, <code>t2</code> — строки внутри подзапроса.</p>'
        },
        {
          t: 'example', title: 'Крупнее среднего по своему счёту',
          sql: 'SELECT t.TransactionID, t.AccountID, t.Amount,\n       (SELECT AVG(t2.Amount) FROM Transactions t2 WHERE t2.AccountID = t.AccountID) AS AccAvg\nFROM Transactions t\nWHERE t.AccountID IN (1001, 1002)\n  AND t.Amount > (SELECT AVG(t2.Amount) FROM Transactions t2 WHERE t2.AccountID = t.AccountID)\nORDER BY t.AccountID, t.Amount DESC;'
        },
        {
          t: 'text', title: 'EXISTS — «есть хотя бы одна строка»',
          html: '<p><code>EXISTS (подзапрос)</code> истинно, если подзапрос вернул хотя бы одну строку. Что именно он выбирает — неважно, поэтому пишут <code>SELECT 1</code>:</p>' +
            '<pre class="sql">-- клиенты, у которых есть кредит\nSELECT c.ClientID, c.LastName\nFROM Clients c\nWHERE EXISTS (SELECT 1 FROM Loans l WHERE l.ClientID = c.ClientID);</pre>' +
            '<p><code>NOT EXISTS</code> — «нет ни одной строки». Это надёжный способ найти «тех, у кого нет», наравне с LEFT JOIN … IS NULL.</p>'
        },
        {
          t: 'text', title: 'Ловушка: NOT IN и NULL',
          html: '<p>Задача: сотрудники, которые никем не руководят (их EmployeeID нет среди ManagerID). Кажется, всё просто:</p>' +
            '<pre class="sql">SELECT FullName FROM Employees\nWHERE EmployeeID NOT IN (SELECT ManagerID FROM Employees);</pre>' +
            '<p>Результат — <b>пусто</b>! В подзапросе есть NULL (у председателя нет руководителя). <code>x NOT IN (1, 2, NULL)</code> означает «x ≠ 1 И x ≠ 2 И x ≠ NULL», а сравнение с NULL — «неизвестно». В итоге условие никогда не бывает истинным.</p>' +
            '<div class="key"><b>Правило</b>Для «нет среди…» используйте <code>NOT EXISTS</code> — он NULL не боится. Если всё же пишете NOT IN с подзапросом, добавьте в подзапрос <code>WHERE столбец IS NOT NULL</code>.</div>'
        },
        {
          t: 'example', title: 'Проверьте сами',
          sql: '-- 1) NOT IN: 0 строк из-за NULL\nSELECT FullName FROM Employees\nWHERE EmployeeID NOT IN (SELECT ManagerID FROM Employees);\n\n-- 2) NOT EXISTS: правильный ответ\nSELECT e.FullName FROM Employees e\nWHERE NOT EXISTS (SELECT 1 FROM Employees s WHERE s.ManagerID = e.EmployeeID);',
          noTrace: true
        },
        {
          t: 'quiz', id: 'm10l2q1',
          q: '<p>Подзапрос вернул значения (5, 7, NULL). Что даст условие <code>3 NOT IN (подзапрос)</code>?</p>',
          options: ['TRUE — 3 ведь нет в списке', 'FALSE', 'UNKNOWN — строка не попадёт в результат', 'Ошибку'],
          answer: 2,
          explain: '3 ≠ 5 (TRUE) И 3 ≠ 7 (TRUE) И 3 ≠ NULL (UNKNOWN) = UNKNOWN. WHERE пропускает только TRUE.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm10l2t1', title: 'Рядовые сотрудники',
          text: '<p>Выведите ФИО и должность сотрудников, у которых нет ни одного подчинённого.</p>',
          solution: 'SELECT e.FullName, e.Position\nFROM Employees e\nWHERE NOT EXISTS (SELECT 1 FROM Employees s WHERE s.ManagerID = e.EmployeeID);',
          wrong: ['SELECT FullName, Position FROM Employees WHERE EmployeeID NOT IN (SELECT ManagerID FROM Employees);'],
          alsoOk: ['SELECT FullName, Position FROM Employees WHERE EmployeeID NOT IN (SELECT ManagerID FROM Employees WHERE ManagerID IS NOT NULL);']
        },
        {
          t: 'task', id: 'm10l2t2', title: 'Клиенты с крупными операциями',
          text: '<p>Выведите <code>ClientID</code> и <code>LastName</code> клиентов, у которых есть хотя бы одна операция на сумму больше 100 000 (по любому их счёту). Используйте EXISTS.</p>',
          solution: 'SELECT c.ClientID, c.LastName\nFROM Clients c\nWHERE EXISTS (SELECT 1\n              FROM Accounts a\n              JOIN Transactions t ON t.AccountID = a.AccountID\n              WHERE a.ClientID = c.ClientID AND t.Amount > 100000);',
          check: { require: [['EXISTS', 'Используйте EXISTS.']] }
        },
        {
          t: 'task', id: 'm10l2t3', title: 'Последняя операция клиента',
          text: '<p>Для каждого клиента выведите <code>ClientID</code>, <code>LastName</code> и дату его последней операции <code>LastTrans</code> (по всем счетам; если операций нет — NULL). Используйте подзапрос в SELECT.</p>',
          solution: 'SELECT c.ClientID, c.LastName,\n       (SELECT MAX(t.TransDate)\n        FROM Accounts a\n        JOIN Transactions t ON t.AccountID = a.AccountID\n        WHERE a.ClientID = c.ClientID) AS LastTrans\nFROM Clients c;',
          check: { names: true }
        },
        {
          t: 'task', id: 'm10l2t4', title: 'Крупнее среднего по продукту',
          text: '<p>Выведите <code>LoanID</code>, <code>ProductID</code>, <code>Amount</code> кредитов, сумма которых больше средней суммы кредитов <b>того же продукта</b>.</p>',
          solution: 'SELECT l.LoanID, l.ProductID, l.Amount\nFROM Loans l\nWHERE l.Amount > (SELECT AVG(l2.Amount) FROM Loans l2 WHERE l2.ProductID = l.ProductID);'
        }
      ]
    },
    {
      id: 'm10l3', title: 'APPLY: подзапрос для каждой строки (для продвинутых)', minutes: 14,
      steps: [
        {
          t: 'text', title: 'CROSS APPLY и OUTER APPLY',
          html: '<p><code>APPLY</code> — особенность SQL Server: для <b>каждой строки</b> левой таблицы выполнить подзапрос, который может ссылаться на эту строку, и присоединить его результат. Так легко решаются задачи «топ-N в каждой группе» и «последнее значение на дату».</p>' +
            '<pre class="sql">-- две самые крупные операции каждого счёта\nSELECT a.AccountID, x.TransDate, x.Amount\nFROM Accounts a\nCROSS APPLY (SELECT TOP (2) t.TransDate, t.Amount\n             FROM Transactions t\n             WHERE t.AccountID = a.AccountID\n             ORDER BY t.Amount DESC) AS x;</pre>' +
            '<ul><li><code>CROSS APPLY</code> — как INNER: если подзапрос пустой, строка слева пропадает.</li>' +
            '<li><code>OUTER APPLY</code> — как LEFT: строка остаётся, справа NULL.</li></ul>'
        },
        {
          t: 'example', title: 'Топ-2 операции каждого счёта',
          sql: 'SELECT a.AccountID, a.AccountType, x.TransDate, x.Amount\nFROM Accounts a\nCROSS APPLY (SELECT TOP (2) t.TransDate, t.Amount\n             FROM Transactions t\n             WHERE t.AccountID = a.AccountID\n             ORDER BY t.Amount DESC) AS x\nORDER BY a.AccountID, x.Amount DESC;'
        },
        {
          t: 'text', title: 'Последний известный курс на дату',
          html: '<p>Курсов в выходные нет. Чтобы пересчитать субботнюю операцию, берут <b>последний известный</b> курс — самый поздний из курсов не позже даты операции:</p>' +
            '<pre class="sql">OUTER APPLY (SELECT TOP (1) r.Rate\n             FROM CurrencyRates r\n             WHERE r.Currency = a.Currency\n               AND r.RateDate &lt;= CAST(t.TransDate AS DATE)\n             ORDER BY r.RateDate DESC) AS rate</pre>' +
            '<p>Те же задачи часто решают оконными функциями (модуль 13) — полезно знать оба способа.</p>'
        },
        {
          t: 'example', title: 'Пересчёт выходных операций',
          sql: "SELECT t.TransactionID, t.TransDate, DATENAME(weekday, t.TransDate) AS DayName, t.Amount, rate.Rate,\n       CAST(t.Amount * rate.Rate AS DECIMAL(18,2)) AS AmountKGS\nFROM Transactions t\nJOIN Accounts a ON a.AccountID = t.AccountID\nOUTER APPLY (SELECT TOP (1) r.Rate\n             FROM CurrencyRates r\n             WHERE r.Currency = a.Currency AND r.RateDate <= CAST(t.TransDate AS DATE)\n             ORDER BY r.RateDate DESC) AS rate\nWHERE a.Currency = 'USD' AND t.TransDate >= '20261001'\nORDER BY t.TransDate;"
        }
      ],
      training: [
        {
          t: 'task', id: 'm10l3t1', title: 'Лучший оклад в филиале',
          text: '<p>Для каждого филиала выведите <code>BranchName</code>, а также ФИО (<code>FullName</code>) и оклад (<code>Salary</code>) сотрудника с самым высоким окладом в этом филиале. При равных окладах берите сотрудника с меньшим EmployeeID. Используйте CROSS APPLY.</p>',
          solution: 'SELECT b.BranchName, x.FullName, x.Salary\nFROM Branches b\nCROSS APPLY (SELECT TOP (1) e.FullName, e.Salary\n             FROM Employees e\n             WHERE e.BranchID = b.BranchID\n             ORDER BY e.Salary DESC, e.EmployeeID) AS x;',
          check: { require: [['APPLY', 'Используйте CROSS APPLY.']] }
        },
        {
          t: 'task', id: 'm10l3t2', title: 'Курс с учётом выходных',
          text: "<p>Для операций по счетам в <b>EUR</b> за октябрь 2026 выведите <code>TransactionID</code>, <code>Amount</code> и последний известный на дату операции курс евро <code>Rate</code> (для выходных — курс пятницы).</p>",
          solution: "SELECT t.TransactionID, t.Amount, rate.Rate\nFROM Transactions t\nJOIN Accounts a ON a.AccountID = t.AccountID\nOUTER APPLY (SELECT TOP (1) r.Rate FROM CurrencyRates r\n             WHERE r.Currency = a.Currency AND r.RateDate <= CAST(t.TransDate AS DATE)\n             ORDER BY r.RateDate DESC) AS rate\nWHERE a.Currency = 'EUR' AND t.TransDate >= '20261001' AND t.TransDate < '20261101';",
          check: { names: true },
          alsoOk: ["SELECT t.TransactionID, t.Amount, (SELECT TOP (1) r.Rate FROM CurrencyRates r WHERE r.Currency = 'EUR' AND r.RateDate <= CAST(t.TransDate AS DATE) ORDER BY r.RateDate DESC) AS Rate FROM Transactions t JOIN Accounts a ON a.AccountID = t.AccountID WHERE a.Currency = 'EUR' AND t.TransDate >= '20261001' AND t.TransDate < '20261101';"]
        },
        {
          t: 'quiz', id: 'm10l3t3',
          q: '<p>Чем OUTER APPLY отличается от CROSS APPLY?</p>',
          options: ['Ничем', 'OUTER APPLY сохраняет строку слева, даже если подзапрос ничего не вернул', 'OUTER APPLY работает быстрее', 'CROSS APPLY нельзя использовать с TOP'],
          answer: 1,
          explain: 'Как LEFT JOIN и INNER JOIN: OUTER сохраняет левую строку с NULL справа.'
        }
      ]
    }
  ],
  homework: [
    {
      id: 'm10hw1', title: 'Богаче среднего клиента',
      text: "<p>Найдите клиентов, у которых сумма остатков по сомовым счетам больше, чем средняя такая сумма по всем клиентам с сомовыми счетами. Выведите <code>ClientID</code> и <code>TotalKGS</code>.</p>",
      solution: "SELECT ClientID, SUM(Balance) AS TotalKGS\nFROM Accounts\nWHERE Currency = 'KGS'\nGROUP BY ClientID\nHAVING SUM(Balance) > (SELECT AVG(Total)\n                       FROM (SELECT SUM(Balance) AS Total FROM Accounts WHERE Currency = 'KGS' GROUP BY ClientID) AS t);",
      check: { names: true },
      hint: 'Среднее по клиентам — это среднее от сумм по клиентам: подзапрос во FROM внутри подзапроса в HAVING.'
    },
    {
      id: 'm10hw2', title: 'Продукты без просрочки',
      text: "<p>Выведите названия кредитных продуктов, по которым нет ни одного просроченного кредита.</p>",
      solution: "SELECT p.ProductName\nFROM LoanProducts p\nWHERE NOT EXISTS (SELECT 1 FROM Loans l WHERE l.ProductID = p.ProductID AND l.Status = N'Просрочен');",
      allowEmpty: true
    },
    {
      id: 'm10hw3', title: 'Последняя операция по счёту',
      text: '<p>Для каждого счёта, по которому были операции, выведите <code>AccountID</code>, дату (<code>LastDate</code>) и сумму (<code>LastAmount</code>) последней операции. Если у счёта две операции в одно и то же время, берите с большим TransactionID.</p>',
      solution: 'SELECT a.AccountID, x.TransDate AS LastDate, x.Amount AS LastAmount\nFROM Accounts a\nCROSS APPLY (SELECT TOP (1) t.TransDate, t.Amount\n             FROM Transactions t\n             WHERE t.AccountID = a.AccountID\n             ORDER BY t.TransDate DESC, t.TransactionID DESC) AS x;',
      check: { names: true }
    },
    {
      id: 'm10hw4', title: 'Аномально крупные покупки',
      text: "<p>Найдите оплаты картой 2026 года, которые больше <b>трёх средних</b> чеков своей категории за 2026 год. Выведите <code>TransactionID</code>, <code>Category</code>, <code>Amount</code>.</p>",
      solution: "SELECT t.TransactionID, t.Category, t.Amount\nFROM Transactions t\nWHERE t.TransType = N'Оплата картой' AND t.TransDate >= '20260101' AND t.TransDate < '20270101'\n  AND t.Amount > 3 * (SELECT AVG(t2.Amount) FROM Transactions t2\n                      WHERE t2.TransType = N'Оплата картой' AND t2.Category = t.Category\n                        AND t2.TransDate >= '20260101' AND t2.TransDate < '20270101');"
    },
    {
      id: 'm10hw5', title: 'Оклад выше среднего по филиалу',
      text: '<p>Выведите ФИО, <code>BranchID</code> и оклад сотрудников, чей оклад выше среднего оклада в их филиале.</p>',
      solution: 'SELECT e.FullName, e.BranchID, e.Salary\nFROM Employees e\nWHERE e.Salary > (SELECT AVG(e2.Salary) FROM Employees e2 WHERE e2.BranchID = e.BranchID);'
    }
  ]
});
