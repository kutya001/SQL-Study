/* Модуль 6. Даты и время */
COURSE.addModule({
  id: 'm06', num: 6,
  title: 'Даты и время',
  short: 'DATE и DATETIME, части даты, DATEADD и DATEDIFF, возраст, фильтр по периодам, форматы дат и параметры отчёта.',
  goal: '<p>Почти каждый банковский отчёт — «за период». Научимся правильно отбирать данные за месяц и квартал, считать сроки и возраст и не попадаться в ловушки с временем и форматами дат.</p>',
  read: [
    ['Функции по работе с датами и временем', 'https://metanit.com/sql/sqlserver/8.3.php'],
    ['Преобразование данных (CONVERT, стили дат)', 'https://metanit.com/sql/sqlserver/8.4.php'],
    ['Переменные в T-SQL', 'https://metanit.com/sql/sqlserver/9.1.php']
  ],
  lessons: [
    {
      id: 'm06l1', title: 'Даты: типы и части даты', minutes: 14,
      steps: [
        {
          t: 'text', title: 'DATE и DATETIME',
          html: '<ul><li><code>DATE</code> — только дата: <b>2026-10-08</b>. Так хранятся даты рождения, открытия счёта.</li>' +
            '<li><code>DATETIME</code> — дата и время до миллисекунд: <b>2026-10-08 14:30:00.000</b>. Так хранится время операции (<code>Transactions.TransDate</code>).</li></ul>' +
            '<p>Функция <code>GETDATE()</code> возвращает текущие дату и время сервера. Чтобы отрезать время, приведите значение к DATE: <code>CAST(GETDATE() AS DATE)</code>.</p>' +
            '<p>В учебной базе операции есть с января 2025 по 30 октября 2026 года.</p>'
        },
        {
          t: 'example', title: 'Текущая дата',
          sql: 'SELECT GETDATE()               AS Now,\n       CAST(GETDATE() AS DATE)  AS Today,\n       YEAR(GETDATE())          AS Y,\n       MONTH(GETDATE())         AS M,\n       DAY(GETDATE())           AS D;'
        },
        {
          t: 'text', title: 'Части даты',
          html: '<ul><li><code>YEAR(d)</code>, <code>MONTH(d)</code>, <code>DAY(d)</code> — год, месяц, день числом.</li>' +
            '<li><code>DATEPART(часть, d)</code> — любая часть числом: <code>year</code>, <code>quarter</code>, <code>month</code>, <code>week</code>, <code>weekday</code>, <code>hour</code>, <code>minute</code>…</li>' +
            '<li><code>DATENAME(часть, d)</code> — часть словом: месяц и день недели.</li></ul>' +
            '<div class="warn"><b>Зависит от языка сервера</b>DATENAME вернёт «October» или «октябрь» в зависимости от языка сессии. А <code>DATEPART(weekday, …)</code> зависит от того, какой день считается первым в неделе (<code>@@DATEFIRST</code>): в английских настройках понедельник = 2, в русских = 1. Проверяйте на своём сервере: <code>SELECT @@LANGUAGE, @@DATEFIRST</code>.</div>'
        },
        {
          t: 'example', title: 'Разбираем дату операции',
          sql: "SELECT TOP (10) TransDate,\n       YEAR(TransDate)              AS Y,\n       DATEPART(quarter, TransDate) AS Q,\n       MONTH(TransDate)             AS M,\n       DATENAME(month, TransDate)   AS MonthName,\n       DATENAME(weekday, TransDate) AS DayName,\n       DATEPART(hour, TransDate)    AS Hr\nFROM Transactions\nORDER BY TransDate DESC;"
        },
        {
          t: 'text', title: 'Начало и конец месяца',
          html: '<ul><li><code>EOMONTH(d)</code> — последний день месяца (End Of Month).</li>' +
            '<li><code>DATEFROMPARTS(год, месяц, день)</code> — собрать дату из чисел. Первый день месяца: <code>DATEFROMPARTS(YEAR(d), MONTH(d), 1)</code>.</li>' +
            '<li><code>DATETRUNC(month, d)</code> — «обрезать» дату до начала месяца (года, квартала…). Удобно, но есть только в <b>SQL Server 2022</b> и новее — на старых серверах используйте DATEFROMPARTS.</li></ul>'
        },
        {
          t: 'example', title: 'Границы месяца',
          sql: 'SELECT TOP (10) TransDate,\n       CAST(TransDate AS DATE)                            AS DayOnly,\n       DATEFROMPARTS(YEAR(TransDate), MONTH(TransDate), 1) AS MonthStart,\n       EOMONTH(TransDate)                                 AS MonthEnd\nFROM Transactions\nORDER BY TransDate DESC;'
        },
        {
          t: 'quiz', id: 'm06l1q1',
          q: "<p>Что вернёт <code>CAST('2026-10-08 23:59:59' AS DATE)</code>?</p>",
          options: ['2026-10-09', '2026-10-08', '2026-10-08 00:00:00.000', 'Ошибку'],
          answer: 1,
          explain: 'Приведение к DATE отбрасывает время (без округления до следующего дня).'
        }
      ],
      training: [
        {
          t: 'task', id: 'm06l1t1', title: 'Ночные операции',
          text: '<p>Выведите <code>TransactionID</code>, <code>TransDate</code> и час операции <code>Hr</code> для операций, совершённых с 22:00 и позже.</p>',
          solution: 'SELECT TransactionID, TransDate, DATEPART(hour, TransDate) AS Hr\nFROM Transactions\nWHERE DATEPART(hour, TransDate) >= 22;',
          check: { names: true }
        },
        {
          t: 'task', id: 'm06l1t2', title: 'Майские именинники',
          text: '<p>Выведите фамилию, имя и день рождения (число месяца, столбец <code>BDay</code>) клиентов, родившихся в мае. Отсортируйте по дню.</p>',
          solution: 'SELECT LastName, FirstName, DAY(BirthDate) AS BDay\nFROM Clients\nWHERE MONTH(BirthDate) = 5\nORDER BY BDay;',
          check: { names: true, order: [[2, 'asc']] }
        },
        {
          t: 'task', id: 'm06l1t3', title: 'Месяц выдачи',
          text: '<p>Для кредитов, выданных в 2026 году, выведите <code>LoanID</code>, <code>IssueDate</code>, первый день месяца выдачи (<code>MonthStart</code>) и последний день месяца выдачи (<code>MonthEnd</code>).</p>',
          solution: "SELECT LoanID, IssueDate,\n       DATEFROMPARTS(YEAR(IssueDate), MONTH(IssueDate), 1) AS MonthStart,\n       EOMONTH(IssueDate) AS MonthEnd\nFROM Loans\nWHERE IssueDate >= '20260101' AND IssueDate < '20270101';",
          check: { names: true },
          alsoOk: ["SELECT LoanID, IssueDate, DATETRUNC(month, IssueDate) AS MonthStart, EOMONTH(IssueDate) AS MonthEnd FROM Loans WHERE YEAR(IssueDate) = 2026;"]
        },
        {
          t: 'quiz', id: 'm06l1t4',
          q: "<p>Какой функцией получить <b>последний день</b> месяца для даты?</p>",
          options: ['<code>LASTDAY(d)</code>', '<code>EOMONTH(d)</code>', '<code>DATEPART(lastday, d)</code>', '<code>MONTH(d) + 31</code>'],
          answer: 1,
          explain: 'EOMONTH — End Of Month. Вторым аргументом можно сдвинуть месяц: EOMONTH(d, -1) — конец прошлого месяца.'
        }
      ]
    },
    {
      id: 'm06l2', title: 'Сдвиг дат и интервалы: DATEADD, DATEDIFF', minutes: 16,
      steps: [
        {
          t: 'text', title: 'DATEADD — сдвинуть дату',
          html: '<pre class="sql">DATEADD(часть, сколько, дата)</pre>' +
            '<ul><li><code>DATEADD(day, 30, d)</code> — через 30 дней; <code>DATEADD(day, -7, d)</code> — неделю назад.</li>' +
            '<li><code>DATEADD(month, 1, d)</code> — через месяц. Если дня нет в следующем месяце, берётся последний: 31 января + 1 месяц = 28 (29) февраля.</li>' +
            '<li><code>DATEADD(year, -18, d)</code> — 18 лет назад.</li></ul>' +
            '<div class="note">К <code>DATE</code> нельзя просто прибавить число (<code>BirthDate + 1</code> — ошибка). Используйте DATEADD.</div>'
        },
        {
          t: 'example', title: 'Пробуем DATEADD',
          sql: "SELECT DATEADD(day, 30, CAST('20261001' AS DATE))   AS Plus30Days,\n       DATEADD(month, 1, CAST('20260131' AS DATE))  AS JanPlusMonth,\n       DATEADD(year, -18, CAST('20261101' AS DATE)) AS Adult;"
        },
        {
          t: 'example', title: 'Дата окончания кредита',
          sql: 'SELECT LoanID, IssueDate, TermMonths,\n       DATEADD(month, TermMonths, IssueDate) AS MaturityDate\nFROM Loans\nORDER BY MaturityDate;'
        },
        {
          t: 'widget', title: 'DATEDIFF считает границы', w: 'dateDiffViz',
          html: '<p><code>DATEDIFF(часть, начало, конец)</code> возвращает разницу между датами. Но считает он не «полные периоды», а <b>сколько раз была пересечена граница</b> периода. Нажмите на примеры:</p>'
        },
        {
          t: 'text', title: 'Правильный возраст',
          html: '<p>Из-за этой особенности <code>DATEDIFF(year, BirthDate, GETDATE())</code> завышает возраст на 1 для тех, у кого день рождения в этом году ещё не наступил. Надёжная формула:</p>' +
            '<pre class="sql">DATEDIFF(year, BirthDate, @OnDate)\n  - CASE WHEN DATEADD(year, DATEDIFF(year, BirthDate, @OnDate), BirthDate) > @OnDate\n         THEN 1 ELSE 0 END</pre>' +
            '<p>Смысл: считаем разницу годов, прибавляем её к дате рождения — получаем день рождения в этом году. Если он ещё впереди, вычитаем 1. (CASE подробно разберём в следующем модуле — пока используйте формулу как готовый рецепт.)</p>'
        },
        {
          t: 'example', title: 'Возраст на 1 ноября 2026',
          sql: "SELECT LastName, BirthDate,\n       DATEDIFF(year, BirthDate, '20261101') AS NaiveAge,\n       DATEDIFF(year, BirthDate, '20261101')\n         - CASE WHEN DATEADD(year, DATEDIFF(year, BirthDate, '20261101'), BirthDate) > '20261101'\n                THEN 1 ELSE 0 END AS Age\nFROM Clients\nWHERE MONTH(BirthDate) >= 11;",
          after: '<p>У всех этих клиентов день рождения в ноябре–декабре: «наивный» возраст больше правильного на 1.</p>'
        },
        {
          t: 'quiz', id: 'm06l2q1',
          q: "<p>Чему равно <code>DATEDIFF(month, '20260131', '20260201')</code>?</p>",
          options: ['0 — прошёл всего один день', '1 — пересечена граница месяца', '31', 'Ошибка'],
          answer: 1,
          explain: 'Между 31 января и 1 февраля граница месяца пересекается один раз, поэтому 1 — хотя прошёл всего день.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm06l2t1', title: 'Плановое погашение',
          text: '<p>Для <b>активных</b> кредитов (<code>Status = N\'Активен\'</code>) выведите <code>LoanID</code>, <code>IssueDate</code>, <code>TermMonths</code> и плановую дату погашения <code>MaturityDate</code>.</p>',
          solution: "SELECT LoanID, IssueDate, TermMonths, DATEADD(month, TermMonths, IssueDate) AS MaturityDate\nFROM Loans\nWHERE Status = N'Активен';",
          check: { names: true }
        },
        {
          t: 'task', id: 'm06l2t2', title: 'Сколько дней жил счёт',
          text: '<p>Для закрытых счетов выведите номер счёта, даты открытия и закрытия и число дней между ними (<code>DaysOpen</code>).</p>',
          solution: 'SELECT AccountNumber, OpenDate, CloseDate, DATEDIFF(day, OpenDate, CloseDate) AS DaysOpen\nFROM Accounts\nWHERE CloseDate IS NOT NULL;',
          check: { names: true }
        },
        {
          t: 'task', id: 'm06l2t3', title: 'Точный возраст',
          text: '<p>Выведите <code>ClientID</code>, <code>BirthDate</code> и точный возраст клиента (полных лет) на <b>1 ноября 2026 года</b> под именем <code>Age</code>.</p>',
          solution: "SELECT ClientID, BirthDate,\n       DATEDIFF(year, BirthDate, '20261101')\n         - CASE WHEN DATEADD(year, DATEDIFF(year, BirthDate, '20261101'), BirthDate) > '20261101' THEN 1 ELSE 0 END AS Age\nFROM Clients;",
          check: { names: true },
          hint: 'Используйте формулу из урока, подставив дату \'20261101\'.',
          wrong: ["SELECT ClientID, BirthDate, DATEDIFF(year, BirthDate, '20261101') AS Age FROM Clients;"]
        },
        {
          t: 'task', id: 'm06l2t4', title: 'Неделя назад',
          text: "<p>Выведите операции за последние 7 дней до 31 октября 2026 года <b>не включая</b> 31 октября: от 24 октября 00:00 до 30 октября включительно. Столбцы: <code>TransactionID</code>, <code>TransDate</code>, <code>Amount</code>. Начало периода вычислите через DATEADD от даты '20261031'.</p>",
          solution: "SELECT TransactionID, TransDate, Amount\nFROM Transactions\nWHERE TransDate >= DATEADD(day, -7, '20261031') AND TransDate < '20261031';",
          check: { require: [['DATEADD', 'Начало периода вычислите через DATEADD.']] }
        }
      ]
    },
    {
      id: 'm06l3', title: 'Фильтр по периоду, форматы и параметры', minutes: 18,
      steps: [
        {
          t: 'widget', title: 'Как правильно выбрать месяц', w: 'betweenViz',
          html: '<p>Самая частая ошибка в банковских отчётах — потерянные операции последнего дня периода. Сравните три способа:</p>'
        },
        {
          t: 'text', title: 'Золотое правило периодов',
          html: '<div class="key"><b>Правило</b><code>Дата &gt;= НачалоПериода AND Дата &lt; НачалоСледующегоПериода</code></div>' +
            '<ul><li>Октябрь 2026: <code>TransDate &gt;= \'20261001\' AND TransDate &lt; \'20261101\'</code></li>' +
            '<li>Год 2025: <code>&gt;= \'20250101\' AND &lt; \'20260101\'</code></li>' +
            '<li>III квартал 2026: <code>&gt;= \'20260701\' AND &lt; \'20261001\'</code></li></ul>' +
            '<p>Правило одинаково работает для DATE и DATETIME, не зависит от числа дней в месяце и позволяет серверу быстро искать по индексу.</p>'
        },
        {
          t: 'example', title: 'Операции за октябрь 2026',
          sql: "SELECT TransactionID, TransDate, TransType, Amount\nFROM Transactions\nWHERE TransDate >= '20261001' AND TransDate < '20261101'\nORDER BY TransDate;"
        },
        {
          t: 'text', title: 'Как писать дату в запросе',
          html: '<table><tr><th>Формат строки</th><th>Надёжность</th></tr>' +
            '<tr><td><code>\'20261008\'</code> (ГГГГММДД)</td><td>✔ всегда одинаково, на любом сервере и языке</td></tr>' +
            '<tr><td><code>\'2026-10-08T14:30:00\'</code> (ISO с буквой T)</td><td>✔ всегда одинаково</td></tr>' +
            '<tr><td><code>\'2026-10-08\'</code></td><td>⚠ для DATE надёжно, но для DATETIME зависит от языка: с русским языком сессии прочитается как <b>10 августа</b>!</td></tr>' +
            '<tr><td><code>\'08.10.2026\'</code>, <code>\'10/08/2026\'</code></td><td>✘ зависит от настроек: 8 октября или 10 августа</td></tr></table>' +
            '<p>Почему так: при русском языке включён порядок «день-месяц-год», и строку 2026-10-08 сервер читает как «год-день-месяц». Поэтому в рабочих запросах пишите даты как <code>\'ГГГГММДД\'</code>.</p>'
        },
        {
          t: 'example', title: 'Ловушка формата — проверьте сами',
          sql: "SET LANGUAGE Russian;\nSELECT CAST('2026-10-08' AS DATETIME) AS Dangerous,\n       CAST('20261008'   AS DATETIME) AS Safe,\n       CAST('2026-10-08' AS DATE)     AS DateType;",
          noTrace: true,
          after: '<p>Первый столбец — 10 августа! В учебном тренажёре по умолчанию английские настройки (как у SQL Server «из коробки»), поэтому команда <code>SET LANGUAGE</code> нужна для демонстрации. Она действует только на этот запуск.</p>'
        },
        {
          t: 'text', title: 'Дата в виде текста',
          html: '<p>Для отчётов дату часто нужно показать в привычном виде:</p>' +
            '<table><tr><th>Выражение</th><th>Результат</th></tr>' +
            '<tr><td><code>CONVERT(VARCHAR(10), d, 104)</code></td><td>08.10.2026</td></tr>' +
            '<tr><td><code>CONVERT(VARCHAR(10), d, 103)</code></td><td>08/10/2026</td></tr>' +
            '<tr><td><code>CONVERT(VARCHAR(19), d, 120)</code></td><td>2026-10-08 14:30:00</td></tr>' +
            '<tr><td><code>CONVERT(VARCHAR(8), d, 112)</code></td><td>20261008</td></tr>' +
            '<tr><td><code>FORMAT(d, \'dd.MM.yyyy\')</code></td><td>08.10.2026</td></tr>' +
            '<tr><td><code>FORMAT(d, \'MMMM yyyy\', \'ru-RU\')</code></td><td>октябрь 2026</td></tr>' +
            '<tr><td><code>FORMAT(d, \'yyyy-MM\')</code></td><td>2026-10 (удобно для группировки по месяцам)</td></tr></table>' +
            '<p>Помните: результат — <b>текст</b>. Фильтруйте и сортируйте по настоящей дате, а форматируйте только для показа.</p>'
        },
        {
          t: 'example', title: 'Форматы дат',
          sql: "SELECT TOP (5) TransDate,\n       CONVERT(VARCHAR(10), TransDate, 104)  AS Ru,\n       CONVERT(VARCHAR(19), TransDate, 120)  AS Iso,\n       FORMAT(TransDate, 'dd MMMM yyyy', 'ru-RU') AS Pretty,\n       FORMAT(TransDate, 'yyyy-MM')          AS YearMonth\nFROM Transactions\nORDER BY TransDate DESC;"
        },
        {
          t: 'text', title: 'Параметры отчёта: переменные',
          html: '<p>Чтобы не править даты в нескольких местах запроса, их объявляют один раз в начале — в <b>переменных</b>:</p>' +
            '<pre class="sql">DECLARE @DateFrom DATE = \'20261001\',\n        @DateTo   DATE = \'20261101\';   -- начало следующего периода\n\nSELECT TransactionID, TransDate, Amount\nFROM Transactions\nWHERE TransDate >= @DateFrom AND TransDate < @DateTo;</pre>' +
            '<p>Имя переменной начинается с <code>@</code>. Переменная живёт только во время одного выполнения, поэтому DECLARE и запрос нужно запускать вместе.</p>'
        },
        {
          t: 'example', title: 'Отчёт с параметрами',
          sql: "DECLARE @DateFrom DATE = '20260901',\n        @DateTo   DATE = '20261001';\n\nSELECT TransactionID, TransDate, TransType, Amount\nFROM Transactions\nWHERE TransDate >= @DateFrom AND TransDate < @DateTo\n  AND Amount >= 50000\nORDER BY Amount DESC;",
          noTrace: true,
          after: '<p>Поменяйте даты в DECLARE — и весь отчёт пересчитается за другой месяц.</p>'
        }
      ],
      training: [
        {
          t: 'task', id: 'm06l3t1', title: 'Крупные операции июня',
          text: '<p>Выведите <code>TransactionID</code>, <code>TransDate</code>, <code>Amount</code> операций за <b>июнь 2026</b> на сумму от 50 000.</p>',
          solution: "SELECT TransactionID, TransDate, Amount\nFROM Transactions\nWHERE TransDate >= '20260601' AND TransDate < '20260701' AND Amount >= 50000;",
          hint: 'Помните правило: от начала месяца включительно до начала следующего не включительно.',
          wrong: ["SELECT TransactionID, TransDate, Amount FROM Transactions WHERE TransDate BETWEEN '20260601' AND '20260630' AND Amount >= 50000;"]
        },
        {
          t: 'task', id: 'm06l3t2', title: 'Счета 2025 года',
          text: '<p>Выведите номер счёта, тип и дату открытия всех счетов, открытых в 2025 году.</p>',
          solution: "SELECT AccountNumber, AccountType, OpenDate\nFROM Accounts\nWHERE OpenDate >= '20250101' AND OpenDate < '20260101';",
          alsoOk: ["SELECT AccountNumber, AccountType, OpenDate FROM Accounts WHERE YEAR(OpenDate) = 2025;"]
        },
        {
          t: 'task', id: 'm06l3t3', title: 'Дата для печати',
          text: '<p>Для кредитов, выданных в октябре 2026, выведите <code>LoanID</code> и дату выдачи в формате <b>ДД.ММ.ГГГГ</b> под именем <code>IssueDateText</code>.</p>',
          solution: "SELECT LoanID, CONVERT(VARCHAR(10), IssueDate, 104) AS IssueDateText\nFROM Loans\nWHERE IssueDate >= '20261001' AND IssueDate < '20261101';",
          check: { names: true },
          alsoOk: ["SELECT LoanID, FORMAT(IssueDate, 'dd.MM.yyyy') AS IssueDateText FROM Loans WHERE IssueDate >= '20261001' AND IssueDate < '20261101';"]
        },
        {
          t: 'task', id: 'm06l3t4', title: 'Параметры',
          text: '<p>Используя переменные <code>@DateFrom</code> и <code>@DateTo</code>, выведите <code>LoanID</code>, <code>IssueDate</code>, <code>Amount</code> кредитов, выданных в <b>III квартале 2026</b> (июль–сентябрь).</p>',
          solution: "DECLARE @DateFrom DATE = '20260701', @DateTo DATE = '20261001';\nSELECT LoanID, IssueDate, Amount\nFROM Loans\nWHERE IssueDate >= @DateFrom AND IssueDate < @DateTo;",
          check: { require: [['DECLARE\\s+@', 'Объявите переменные через DECLARE.']] }
        },
        {
          t: 'quiz', id: 'm06l3t5',
          q: '<p>Какой формат даты в запросе самый надёжный?</p>',
          options: ["<code>'08.10.2026'</code>", "<code>'2026-10-08'</code>", "<code>'20261008'</code>", "<code>'10/08/2026'</code>"],
          answer: 2,
          explain: "Формат ГГГГММДД без разделителей SQL Server всегда понимает одинаково, независимо от языка и настроек."
        }
      ]
    }
  ],
  homework: [
    {
      id: 'm06hw1', title: 'Операции в выходные',
      text: '<p>Выведите <code>TransactionID</code>, <code>TransDate</code>, <code>Amount</code> операций за октябрь 2026 года, совершённых в субботу или воскресенье.</p>',
      solution: "SELECT TransactionID, TransDate, Amount\nFROM Transactions\nWHERE TransDate >= '20261001' AND TransDate < '20261101'\n  AND DATENAME(weekday, TransDate) IN ('Saturday', 'Sunday');",
      hint: "Можно через <code>DATENAME(weekday, …)</code> (в нашем тренажёре английские названия дней). Способ, не зависящий от настроек: <code>(DATEPART(weekday, d) + @@DATEFIRST) % 7 IN (0, 1)</code>.",
      alsoOk: ["SELECT TransactionID, TransDate, Amount FROM Transactions WHERE TransDate >= '20261001' AND TransDate < '20261101' AND (DATEPART(weekday, TransDate) + @@DATEFIRST) % 7 IN (0, 1);"]
    },
    {
      id: 'm06hw2', title: 'Погашения в 2027',
      text: '<p>Для активных кредитов, плановая дата погашения которых приходится на <b>2027 год</b>, выведите <code>LoanID</code>, <code>ClientID</code> и <code>MaturityDate</code>, отсортировав по дате погашения.</p>',
      solution: "SELECT LoanID, ClientID, DATEADD(month, TermMonths, IssueDate) AS MaturityDate\nFROM Loans\nWHERE Status = N'Активен'\n  AND DATEADD(month, TermMonths, IssueDate) >= '20270101'\n  AND DATEADD(month, TermMonths, IssueDate) < '20280101'\nORDER BY MaturityDate;",
      check: { names: true, order: [[2, 'asc']] }
    },
    {
      id: 'm06hw3', title: 'Новые клиенты за 90 дней',
      text: '<p>Выведите <code>ClientID</code>, фамилию и дату регистрации клиентов, зарегистрировавшихся за 90 дней до 1 ноября 2026 года (с <code>DATEADD(day, -90, \'20261101\')</code> включительно и до 1 ноября не включительно).</p>',
      solution: "SELECT ClientID, LastName, RegistrationDate\nFROM Clients\nWHERE RegistrationDate >= DATEADD(day, -90, '20261101') AND RegistrationDate < '20261101';"
    },
    {
      id: 'm06hw4', title: 'Короткоживущие счета',
      text: '<p>Найдите закрытые счета, которые прожили меньше года (меньше 365 дней). Выведите номер счёта, тип, <code>OpenDate</code>, <code>CloseDate</code> и <code>DaysOpen</code>.</p>',
      solution: 'SELECT AccountNumber, AccountType, OpenDate, CloseDate, DATEDIFF(day, OpenDate, CloseDate) AS DaysOpen\nFROM Accounts\nWHERE CloseDate IS NOT NULL AND DATEDIFF(day, OpenDate, CloseDate) < 365;',
      check: { names: true }
    },
    {
      id: 'm06hw5', title: 'Заголовок договора',
      text: '<p>Для кредитов, выданных в сентябре 2026, сформируйте заголовок <code>Title</code> вида <b>Кредит № 7123 от 15.09.2026</b>.</p>',
      solution: "SELECT CONCAT(N'Кредит № ', LoanID, N' от ', CONVERT(VARCHAR(10), IssueDate, 104)) AS Title\nFROM Loans\nWHERE IssueDate >= '20260901' AND IssueDate < '20261001';",
      check: { names: true },
      alsoOk: ["SELECT N'Кредит № ' + CAST(LoanID AS VARCHAR(10)) + N' от ' + FORMAT(IssueDate, 'dd.MM.yyyy') AS Title FROM Loans WHERE IssueDate >= '20260901' AND IssueDate < '20261001';"]
    }
  ]
});
