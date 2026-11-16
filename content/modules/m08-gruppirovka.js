/* Модуль 8. Агрегация и группировка */
COURSE.addModule({
  id: 'm08', num: 8,
  title: 'Итоги и группировка: GROUP BY',
  short: 'COUNT, SUM, AVG, MIN, MAX; GROUP BY и HAVING; порядок выполнения запроса; сводные таблицы через SUM(CASE).',
  goal: '<p>Это сердце отчётности: «сколько», «на какую сумму», «в среднем», «по городам», «по месяцам». После модуля вы сможете собрать любую сводную таблицу прямо в SQL.</p>',
  read: [
    ['Агрегатные функции', 'https://metanit.com/sql/sqlserver/5.1.php'],
    ['Операторы GROUP BY и HAVING', 'https://metanit.com/sql/sqlserver/5.2.php']
  ],
  lessons: [
    {
      id: 'm08l1', title: 'Агрегатные функции', minutes: 15,
      steps: [
        {
          t: 'text', title: 'Много строк → одно число',
          html: '<p><b>Агрегатная функция</b> берёт значения из множества строк и сворачивает их в одно число — как итоговая строка в Excel.</p>' +
            '<table><tr><th>Функция</th><th>Что считает</th></tr>' +
            '<tr><td><code>COUNT(*)</code></td><td>количество строк</td></tr>' +
            '<tr><td><code>SUM(x)</code></td><td>сумму</td></tr>' +
            '<tr><td><code>AVG(x)</code></td><td>среднее</td></tr>' +
            '<tr><td><code>MIN(x)</code> / <code>MAX(x)</code></td><td>минимум / максимум (работают и с датами, и с текстом)</td></tr></table>'
        },
        {
          t: 'example', title: 'Итоги по счетам в сомах',
          sql: "SELECT COUNT(*)     AS Cnt,\n       SUM(Balance) AS Total,\n       AVG(Balance) AS AvgBalance,\n       MIN(Balance) AS MinBalance,\n       MAX(Balance) AS MaxBalance\nFROM Accounts\nWHERE Currency = 'KGS';",
          after: '<p>Результат — одна строка. Сначала WHERE отобрал счета в сомах, потом агрегаты посчитали итоги по ним.</p>'
        },
        {
          t: 'text', title: 'COUNT бывает трёх видов',
          html: '<ul><li><code>COUNT(*)</code> — сколько <b>строк</b>, включая строки с NULL.</li>' +
            '<li><code>COUNT(Phone)</code> — сколько строк, где Phone <b>не NULL</b>.</li>' +
            '<li><code>COUNT(DISTINCT City)</code> — сколько <b>разных</b> непустых значений.</li></ul>' +
            '<div class="key"><b>Все агрегаты, кроме COUNT(*), пропускают NULL</b><code>AVG(x)</code> — это сумма непустых значений, делённая на <i>их количество</i>, а не на количество всех строк.</div>'
        },
        {
          t: 'example', title: 'Три COUNT на одной таблице',
          sql: 'SELECT COUNT(*)             AS AllClients,\n       COUNT(Phone)         AS WithPhone,\n       COUNT(Email)         AS WithEmail,\n       COUNT(DISTINCT City) AS Cities\nFROM Clients;'
        },
        {
          t: 'example', title: 'Ловушка: среднее по целым числам',
          html: '<p>Помните целочисленное деление? С AVG то же самое: среднее по столбцу INT тоже получается целым.</p>',
          sql: 'SELECT AVG(TermMonths)                             AS AvgInt,\n       AVG(TermMonths * 1.0)                       AS AvgExact,\n       CAST(AVG(TermMonths * 1.0) AS DECIMAL(10,2)) AS AvgRounded\nFROM Loans;',
          after: '<p>Первый столбец — без дробной части. Чтобы получить точное среднее, сделайте значение дробным <b>до</b> AVG: <code>AVG(TermMonths * 1.0)</code>.</p>'
        },
        {
          t: 'quiz', id: 'm08l1q1',
          q: '<p>В таблице 220 клиентов, у 18 из них телефон NULL. Что вернёт <code>COUNT(Phone)</code>?</p>',
          options: ['220', '202', '18', 'NULL'],
          answer: 1,
          explain: 'COUNT(столбец) считает только непустые значения: 220 − 18 = 202.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm08l1t1', title: 'Сколько клиентов с почтой',
          text: '<p>Одной строкой выведите общее число клиентов (<code>Total</code>) и число клиентов с указанным email (<code>WithEmail</code>).</p>',
          solution: 'SELECT COUNT(*) AS Total, COUNT(Email) AS WithEmail\nFROM Clients;',
          check: { names: true }
        },
        {
          t: 'task', id: 'm08l1t2', title: 'Активный кредитный портфель',
          text: "<p>По активным кредитам (<code>Status = N'Активен'</code>) выведите количество (<code>Cnt</code>), общую сумму (<code>TotalAmount</code>) и максимальную сумму кредита (<code>MaxAmount</code>).</p>",
          solution: "SELECT COUNT(*) AS Cnt, SUM(Amount) AS TotalAmount, MAX(Amount) AS MaxAmount\nFROM Loans\nWHERE Status = N'Активен';",
          check: { names: true }
        },
        {
          t: 'task', id: 'm08l1t3', title: 'Точный средний срок',
          text: '<p>Посчитайте средний срок всех кредитов в месяцах <b>с двумя знаками после запятой</b> (столбец <code>AvgTerm</code>).</p>',
          solution: 'SELECT CAST(AVG(TermMonths * 1.0) AS DECIMAL(10,2)) AS AvgTerm\nFROM Loans;',
          check: { names: true },
          wrong: ['SELECT AVG(TermMonths) AS AvgTerm FROM Loans;'],
          alsoOk: ['SELECT ROUND(AVG(CAST(TermMonths AS DECIMAL(10,2))), 2) AS AvgTerm FROM Loans;']
        },
        {
          t: 'task', id: 'm08l1t4', title: 'Первая и последняя',
          text: '<p>Выведите дату самой первой (<code>FirstDate</code>) и самой последней (<code>LastDate</code>) операции в базе.</p>',
          solution: 'SELECT MIN(TransDate) AS FirstDate, MAX(TransDate) AS LastDate\nFROM Transactions;',
          check: { names: true }
        },
        {
          t: 'quiz', id: 'm08l1t5',
          q: '<p>Значения в столбце: 10, NULL, 20. Чему равно <code>AVG(x)</code>?</p>',
          options: ['10', '15', 'NULL', '30'],
          answer: 1,
          explain: 'NULL пропускается: (10 + 20) / 2 = 15. Если нужно считать NULL нулём, пишите AVG(ISNULL(x, 0)) — получится 10.'
        }
      ]
    },
    {
      id: 'm08l2', title: 'Группировка: GROUP BY', minutes: 18,
      steps: [
        {
          t: 'text', title: 'Итоги по группам',
          html: '<p>Одна итоговая строка на всю таблицу — это мало. Обычно нужны итоги <b>по группам</b>: сколько клиентов в каждом городе, сумма операций по каждому типу. Для этого есть <code>GROUP BY</code> — аналог сводной таблицы Excel:</p>' +
            '<pre class="sql">SELECT City, COUNT(*) AS Clients\nFROM Clients\nGROUP BY City;</pre>' +
            '<p>Сервер раскладывает строки по «корзинам» с одинаковым городом и для каждой корзины считает COUNT.</p>'
        },
        {
          t: 'widget', title: 'Как работает GROUP BY', w: 'groupViz'
        },
        {
          t: 'example', title: 'Клиенты по городам',
          sql: 'SELECT City, COUNT(*) AS Clients\nFROM Clients\nGROUP BY City\nORDER BY Clients DESC;',
          after: '<p>Нажмите «Пошагово» и откройте шаг GROUP BY: раскройте любую группу и посмотрите, какие строки в неё попали.</p>'
        },
        {
          t: 'text', title: 'Главное правило GROUP BY',
          html: '<div class="key"><b>Правило</b>Каждый столбец в SELECT должен быть либо <b>указан в GROUP BY</b>, либо стоять <b>внутри агрегатной функции</b>.</div>' +
            '<p>Почему: после группировки одна группа — одна строка результата. В группе «Бишкек» 100 клиентов с разными фамилиями — какую из них показать? Серверу не из чего выбрать, поэтому он выдаёт ошибку 8120.</p>'
        },
        {
          t: 'example', title: 'Ошибка 8120',
          sql: 'SELECT City, LastName, COUNT(*) AS Clients\nFROM Clients\nGROUP BY City;',
          expectError: true,
          after: '<p>Варианты исправления: убрать LastName; добавить его в GROUP BY (тогда группы станут «город + фамилия»); или взять агрегат, например <code>MIN(LastName)</code>.</p>'
        },
        {
          t: 'text', title: 'Несколько столбцов и выражения',
          html: '<ul><li>Группировать можно по нескольким столбцам: <code>GROUP BY Currency, AccountType</code> — группа на каждую комбинацию.</li>' +
            '<li>Можно группировать по выражению — например, по году и месяцу операции: <code>GROUP BY YEAR(TransDate), MONTH(TransDate)</code>.</li>' +
            '<li>Псевдоним из SELECT в GROUP BY использовать <b>нельзя</b> (GROUP BY выполняется раньше SELECT) — повторите выражение целиком.</li></ul>'
        },
        {
          t: 'example', title: 'Операции по месяцам',
          sql: "SELECT YEAR(TransDate)  AS Y,\n       MONTH(TransDate) AS M,\n       COUNT(*)         AS Cnt,\n       SUM(Amount)      AS Total\nFROM Transactions\nWHERE Status = N'Проведена'\nGROUP BY YEAR(TransDate), MONTH(TransDate)\nORDER BY Y, M;"
        },
        {
          t: 'quiz', id: 'm08l2q1',
          q: '<p>Какой запрос правильный?</p>',
          options: ['<code>SELECT City, Gender, COUNT(*) FROM Clients GROUP BY City</code>', '<code>SELECT City, COUNT(*) FROM Clients GROUP BY City, Gender</code>', '<code>SELECT City, Gender, COUNT(*) FROM Clients GROUP BY City, Gender</code>', '<code>SELECT COUNT(*), City FROM Clients</code>'],
          answer: 2,
          explain: 'Вариант 3 — оба неагрегированных столбца в GROUP BY. Вариант 2 тоже выполнится, но выведет несколько строк с одинаковым городом (по одной на каждый пол) — так обычно не задумано. Варианты 1 и 4 дадут ошибку.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm08l2t1', title: 'Счета по валютам',
          text: '<p>Выведите количество счетов (<code>Cnt</code>) по каждой валюте (<code>Currency</code>). Сначала валюта с наибольшим числом счетов.</p>',
          solution: 'SELECT Currency, COUNT(*) AS Cnt\nFROM Accounts\nGROUP BY Currency\nORDER BY Cnt DESC;',
          check: { names: true, order: [[1, 'desc']] }
        },
        {
          t: 'task', id: 'm08l2t2', title: 'Остатки по валюте и типу',
          text: '<p>Выведите сумму остатков (<code>Total</code>) для каждой комбинации валюты и типа счёта (<code>Currency</code>, <code>AccountType</code>).</p>',
          solution: 'SELECT Currency, AccountType, SUM(Balance) AS Total\nFROM Accounts\nGROUP BY Currency, AccountType;',
          check: { names: true }
        },
        {
          t: 'task', id: 'm08l2t3', title: 'Помесячно в 2026',
          text: "<p>Для проведённых операций 2026 года (<code>Status = N'Проведена'</code>) выведите номер месяца (<code>M</code>), количество (<code>Cnt</code>) и сумму (<code>Total</code>) операций, по порядку месяцев.</p>",
          solution: "SELECT MONTH(TransDate) AS M, COUNT(*) AS Cnt, SUM(Amount) AS Total\nFROM Transactions\nWHERE Status = N'Проведена' AND TransDate >= '20260101' AND TransDate < '20270101'\nGROUP BY MONTH(TransDate)\nORDER BY M;",
          check: { names: true, order: [[0, 'asc']] }
        },
        {
          t: 'task', id: 'm08l2t4', title: 'Кредиты по продуктам',
          text: '<p>Для каждого продукта (<code>ProductID</code>) выведите число кредитов (<code>Cnt</code>), общую сумму (<code>TotalAmount</code>) и среднюю ставку (<code>AvgRate</code>).</p>',
          solution: 'SELECT ProductID, COUNT(*) AS Cnt, SUM(Amount) AS TotalAmount, AVG(InterestRate) AS AvgRate\nFROM Loans\nGROUP BY ProductID;',
          check: { names: true }
        }
      ]
    },
    {
      id: 'm08l3', title: 'HAVING и порядок выполнения запроса', minutes: 14,
      steps: [
        {
          t: 'text', title: 'Фильтр групп: HAVING',
          html: '<p>Как оставить только города, где больше 10 клиентов? В WHERE нельзя: WHERE фильтрует отдельные строки <i>до</i> группировки, когда никакого COUNT ещё нет. Для фильтра по итогам групп есть <code>HAVING</code>:</p>' +
            '<pre class="sql">SELECT City, COUNT(*) AS Clients\nFROM Clients\nGROUP BY City\nHAVING COUNT(*) > 10;</pre>' +
            '<table><tr><th></th><th>WHERE</th><th>HAVING</th></tr><tr><td>Что фильтрует</td><td>отдельные строки</td><td>группы целиком</td></tr><tr><td>Когда</td><td>до группировки</td><td>после группировки</td></tr><tr><td>Агрегаты</td><td>нельзя</td><td>можно</td></tr></table>'
        },
        {
          t: 'example', title: 'WHERE и HAVING вместе',
          sql: "SELECT City, COUNT(*) AS Women\nFROM Clients\nWHERE Gender = N'Ж'        -- сначала отбираем строки\nGROUP BY City\nHAVING COUNT(*) >= 5       -- потом отбираем группы\nORDER BY Women DESC;",
          after: '<p>Посмотрите шаги в «Пошагово»: WHERE → GROUP BY → HAVING → SELECT → ORDER BY.</p>'
        },
        {
          t: 'widget', title: 'Порядок выполнения запроса', w: 'execOrder',
          html: '<p>Теперь, когда мы знаем все основные части запроса, — главная схема курса. Запрос <b>пишется</b> в одном порядке, а сервер его <b>выполняет</b> в другом:</p>'
        },
        {
          t: 'text', title: 'Что из этого следует',
          html: '<ul><li>Псевдоним из SELECT нельзя использовать в WHERE, GROUP BY, HAVING — на этих шагах его ещё нет. В ORDER BY — можно.</li>' +
            '<li>Агрегаты нельзя писать в WHERE — группы появляются позже.</li>' +
            '<li>Если условие можно проверить в WHERE (фильтр по дате, статусу), пишите его в WHERE, а не в HAVING: сервер раньше отбросит лишние строки и меньше будет считать.</li></ul>'
        }
      ],
      training: [
        {
          t: 'task', id: 'm08l3t1', title: 'Крупные города',
          text: '<p>Выведите города, в которых не меньше 10 клиентов: <code>City</code> и количество <code>Clients</code>.</p>',
          solution: 'SELECT City, COUNT(*) AS Clients\nFROM Clients\nGROUP BY City\nHAVING COUNT(*) >= 10;',
          check: { names: true }
        },
        {
          t: 'task', id: 'm08l3t2', title: 'Много счетов',
          text: '<p>Найдите клиентов, у которых больше 2 счетов: <code>ClientID</code> и число счетов <code>AccCnt</code>.</p>',
          solution: 'SELECT ClientID, COUNT(*) AS AccCnt\nFROM Accounts\nGROUP BY ClientID\nHAVING COUNT(*) > 2;',
          check: { names: true }
        },
        {
          t: 'order', id: 'm08l3t3',
          q: '<p>Расставьте части запроса в том порядке, в котором их <b>выполняет</b> SQL Server.</p>',
          items: ['FROM', 'WHERE', 'GROUP BY', 'HAVING', 'SELECT', 'ORDER BY', 'TOP'],
          explain: 'FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → TOP. Запомните эту цепочку — она объясняет большинство ошибок.'
        },
        {
          t: 'task', id: 'm08l3t4', title: 'Категории-миллионники',
          text: "<p>Для оплат картой (<code>TransType = N'Оплата картой'</code>) за 2026 год выведите категории (<code>Category</code>), сумма покупок в которых больше 1 000 000 (столбец <code>Total</code>), по убыванию суммы.</p>",
          solution: "SELECT Category, SUM(Amount) AS Total\nFROM Transactions\nWHERE TransType = N'Оплата картой' AND TransDate >= '20260101' AND TransDate < '20270101'\nGROUP BY Category\nHAVING SUM(Amount) > 1000000\nORDER BY Total DESC;",
          check: { names: true, order: [[1, 'desc']] }
        },
        {
          t: 'quiz', id: 'm08l3t5',
          q: '<p>Почему запрос <code>SELECT Balance * 2 AS Dbl FROM Accounts WHERE Dbl &gt; 1000</code> выдаёт ошибку?</p>',
          options: ['Нельзя умножать в SELECT', 'WHERE выполняется раньше SELECT — псевдонима Dbl ещё нет', 'Нужно писать HAVING', 'Псевдоним нужно брать в кавычки'],
          answer: 1,
          explain: 'Порядок выполнения: FROM → WHERE → … → SELECT. В WHERE повторите выражение: WHERE Balance * 2 > 1000.'
        }
      ]
    },
    {
      id: 'm08l4', title: 'Сводные таблицы: условная агрегация', minutes: 16,
      steps: [
        {
          t: 'text', title: 'Счёт по условию: SUM(CASE…)',
          html: '<p>Помните флаги 1/0 из модуля про CASE? Если сложить флаги внутри группы, получится <b>количество строк, удовлетворяющих условию</b>. Так в одном запросе считают сразу несколько показателей:</p>' +
            '<pre class="sql">SELECT City,\n       COUNT(*)                                     AS Total,\n       SUM(CASE WHEN Gender = N\'М\' THEN 1 ELSE 0 END) AS Men,\n       SUM(CASE WHEN Gender = N\'Ж\' THEN 1 ELSE 0 END) AS Women\nFROM Clients\nGROUP BY City;</pre>' +
            '<p>Вместо SUM можно писать <code>COUNT(CASE WHEN … THEN 1 END)</code> — без ELSE получается NULL, а COUNT считает только непустые.</p>'
        },
        {
          t: 'example', title: 'Мужчины и женщины по городам',
          sql: "SELECT City,\n       COUNT(*) AS Total,\n       SUM(CASE WHEN Gender = N'М' THEN 1 ELSE 0 END) AS Men,\n       SUM(CASE WHEN Gender = N'Ж' THEN 1 ELSE 0 END) AS Women\nFROM Clients\nGROUP BY City\nORDER BY Total DESC;"
        },
        {
          t: 'text', title: 'Доли и проценты',
          html: '<p>Доля = часть / целое. Не забывайте про целочисленное деление — умножайте на <code>100.0</code>:</p>' +
            '<pre class="sql">CAST(100.0 * SUM(CASE WHEN Status = N\'Просрочен\' THEN 1 ELSE 0 END) / COUNT(*)\n     AS DECIMAL(5,2)) AS OverduePct</pre>'
        },
        {
          t: 'example', title: 'Просрочка по продуктам',
          sql: "SELECT ProductID,\n       COUNT(*) AS Loans,\n       SUM(CASE WHEN Status = N'Просрочен' THEN 1 ELSE 0 END) AS Overdue,\n       CAST(100.0 * SUM(CASE WHEN Status = N'Просрочен' THEN 1 ELSE 0 END) / COUNT(*) AS DECIMAL(5,2)) AS OverduePct\nFROM Loans\nGROUP BY ProductID\nORDER BY ProductID;"
        },
        {
          t: 'text', title: 'Месяцы в столбцах — как в Excel',
          html: '<p>Сводная таблица Excel с месяцами в столбцах — это тоже условная агрегация: на каждый столбец свой SUM(CASE…). В T-SQL есть и специальный оператор <code>PIVOT</code>, но подход через CASE понятнее, гибче и работает в любой базе.</p>'
        },
        {
          t: 'example', title: 'Траты по категориям по кварталам 2026',
          sql: "SELECT Category,\n       SUM(CASE WHEN DATEPART(quarter, TransDate) = 1 THEN Amount ELSE 0 END) AS Q1,\n       SUM(CASE WHEN DATEPART(quarter, TransDate) = 2 THEN Amount ELSE 0 END) AS Q2,\n       SUM(CASE WHEN DATEPART(quarter, TransDate) = 3 THEN Amount ELSE 0 END) AS Q3,\n       SUM(Amount) AS Total2026\nFROM Transactions\nWHERE TransType = N'Оплата картой'\n  AND TransDate >= '20260101' AND TransDate < '20261001'\nGROUP BY Category\nORDER BY Total2026 DESC;"
        }
      ],
      training: [
        {
          t: 'task', id: 'm08l4t1', title: 'Открытые и закрытые',
          text: '<p>Для каждой валюты выведите: всего счетов (<code>Total</code>), открытых (<code>OpenCnt</code>, дата закрытия не указана) и закрытых (<code>ClosedCnt</code>).</p>',
          solution: 'SELECT Currency, COUNT(*) AS Total,\n       SUM(CASE WHEN CloseDate IS NULL THEN 1 ELSE 0 END) AS OpenCnt,\n       SUM(CASE WHEN CloseDate IS NOT NULL THEN 1 ELSE 0 END) AS ClosedCnt\nFROM Accounts\nGROUP BY Currency;',
          check: { names: true },
          alsoOk: ['SELECT Currency, COUNT(*) AS Total, COUNT(CASE WHEN CloseDate IS NULL THEN 1 END) AS OpenCnt, COUNT(CloseDate) AS ClosedCnt FROM Accounts GROUP BY Currency;']
        },
        {
          t: 'task', id: 'm08l4t2', title: 'ИП и физлица по филиалам',
          text: "<p>Для каждого филиала обслуживания (<code>BranchID</code> в таблице Clients) выведите число физлиц (<code>Individuals</code>) и число ИП (<code>Entrepreneurs</code>). Сортировка по BranchID.</p>",
          solution: "SELECT BranchID,\n       SUM(CASE WHEN ClientType = N'Физлицо' THEN 1 ELSE 0 END) AS Individuals,\n       SUM(CASE WHEN ClientType = N'ИП' THEN 1 ELSE 0 END) AS Entrepreneurs\nFROM Clients\nGROUP BY BranchID\nORDER BY BranchID;",
          check: { names: true, order: [[0, 'asc']] }
        },
        {
          t: 'task', id: 'm08l4t3', title: 'Доля отказов по каналам',
          text: "<p>Для каждого канала (<code>Channel</code>) выведите число операций (<code>Cnt</code>) и долю отклонённых операций в процентах с 2 знаками (<code>DeclinedPct</code>, тип DECIMAL(5,2)).</p>",
          solution: "SELECT Channel, COUNT(*) AS Cnt,\n       CAST(100.0 * SUM(CASE WHEN Status = N'Отклонена' THEN 1 ELSE 0 END) / COUNT(*) AS DECIMAL(5,2)) AS DeclinedPct\nFROM Transactions\nGROUP BY Channel;",
          check: { names: true },
          wrong: ["SELECT Channel, COUNT(*) AS Cnt, CAST(100 * SUM(CASE WHEN Status = N'Отклонена' THEN 1 ELSE 0 END) / COUNT(*) AS DECIMAL(5,2)) AS DeclinedPct FROM Transactions GROUP BY Channel;"]
        },
        {
          t: 'quiz', id: 'm08l4t4',
          q: "<p>Что посчитает <code>COUNT(CASE WHEN Status = N'Просрочен' THEN 1 END)</code>?</p>",
          options: ['Все строки', 'Только просроченные кредиты', 'Ничего: без ELSE будет ошибка', 'Сумму просроченных кредитов'],
          answer: 1,
          explain: 'Для непросроченных CASE даёт NULL (ELSE нет), а COUNT пропускает NULL. Остаются только просроченные.'
        }
      ]
    }
  ],
  homework: [
    {
      id: 'm08hw1', title: 'Обороты по месяцам',
      text: "<p>По проведённым операциям 2026 года для каждого месяца (<code>M</code>) посчитайте приход <code>Income</code> (типы «Пополнение» и «Перевод входящий») и расход <code>Outcome</code> (все остальные типы). Сортировка по месяцу.</p>",
      solution: "SELECT MONTH(TransDate) AS M,\n       SUM(CASE WHEN TransType IN (N'Пополнение', N'Перевод входящий') THEN Amount ELSE 0 END) AS Income,\n       SUM(CASE WHEN TransType NOT IN (N'Пополнение', N'Перевод входящий') THEN Amount ELSE 0 END) AS Outcome\nFROM Transactions\nWHERE Status = N'Проведена' AND TransDate >= '20260101' AND TransDate < '20270101'\nGROUP BY MONTH(TransDate)\nORDER BY M;",
      check: { names: true, order: [[0, 'asc']] }
    },
    {
      id: 'm08hw2', title: 'Топ-5 категорий',
      text: "<p>Выведите 5 категорий с наибольшей суммой оплат картой за 2026 год: <code>Category</code>, <code>Total</code>, <code>Cnt</code> (число покупок), <code>AvgCheck</code> (средний чек, округлённый до 2 знаков, DECIMAL(18,2)).</p>",
      solution: "SELECT TOP (5) Category, SUM(Amount) AS Total, COUNT(*) AS Cnt, CAST(AVG(Amount) AS DECIMAL(18,2)) AS AvgCheck\nFROM Transactions\nWHERE TransType = N'Оплата картой' AND TransDate >= '20260101' AND TransDate < '20270101'\nGROUP BY Category\nORDER BY Total DESC;",
      check: { names: true, order: [[1, 'desc']] }
    },
    {
      id: 'm08hw3', title: 'Состоятельные клиенты',
      text: "<p>Найдите клиентов, у которых сумма остатков по <b>сомовым</b> счетам больше 500 000: <code>ClientID</code>, <code>TotalKGS</code>, <code>Accounts</code> (число таких счетов). Сортировка по сумме по убыванию.</p>",
      solution: "SELECT ClientID, SUM(Balance) AS TotalKGS, COUNT(*) AS Accounts\nFROM Accounts\nWHERE Currency = 'KGS'\nGROUP BY ClientID\nHAVING SUM(Balance) > 500000\nORDER BY TotalKGS DESC;",
      check: { names: true, order: [[1, 'desc']] }
    },
    {
      id: 'm08hw4', title: 'Регистрации по годам',
      text: '<p>Сколько клиентов регистрировалось в каждом году? Выведите год регистрации <code>RegYear</code> и количество <code>Cnt</code>, по порядку лет.</p>',
      solution: 'SELECT YEAR(RegistrationDate) AS RegYear, COUNT(*) AS Cnt\nFROM Clients\nGROUP BY YEAR(RegistrationDate)\nORDER BY RegYear;',
      check: { names: true, order: [[0, 'asc']] }
    },
    {
      id: 'm08hw5', title: 'Фонд оплаты труда',
      text: '<p>По каждому филиалу (<code>BranchID</code> сотрудника) выведите число сотрудников (<code>Staff</code>), фонд оплаты труда в месяц (<code>Payroll</code>) и максимальный оклад (<code>MaxSalary</code>). Только филиалы, где больше 2 сотрудников.</p>',
      solution: 'SELECT BranchID, COUNT(*) AS Staff, SUM(Salary) AS Payroll, MAX(Salary) AS MaxSalary\nFROM Employees\nGROUP BY BranchID\nHAVING COUNT(*) > 2;',
      check: { names: true }
    },
    {
      id: 'm08hw6', title: 'Портфель по статусам',
      text: "<p>Для каждого продукта (<code>ProductID</code>) выведите сумму кредитов по статусам в отдельных столбцах: <code>ActiveAmount</code>, <code>OverdueAmount</code>, <code>ClosedAmount</code> (статус «Погашен»). Сортировка по ProductID.</p>",
      solution: "SELECT ProductID,\n       SUM(CASE WHEN Status = N'Активен' THEN Amount ELSE 0 END) AS ActiveAmount,\n       SUM(CASE WHEN Status = N'Просрочен' THEN Amount ELSE 0 END) AS OverdueAmount,\n       SUM(CASE WHEN Status = N'Погашен' THEN Amount ELSE 0 END) AS ClosedAmount\nFROM Loans\nGROUP BY ProductID\nORDER BY ProductID;",
      check: { names: true, order: [[0, 'asc']] }
    }
  ]
});
