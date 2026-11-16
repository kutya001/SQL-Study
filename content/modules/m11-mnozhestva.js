/* Модуль 11. Объединение результатов */
COURSE.addModule({
  id: 'm11', num: 11,
  title: 'Объединение результатов: UNION, INTERSECT, EXCEPT',
  short: 'Склеиваем результаты запросов «вертикально», находим общих и ушедших клиентов.',
  goal: '<p>JOIN добавляет столбцы, а операции над множествами добавляют <b>строки</b>: объединяют, пересекают и вычитают результаты двух запросов. Классика аналитики — удержание и отток клиентов.</p>',
  read: [
    ['UNION', 'https://metanit.com/sql/sqlserver/7.5.php'],
    ['EXCEPT', 'https://metanit.com/sql/sqlserver/7.6.php'],
    ['INTERSECT', 'https://metanit.com/sql/sqlserver/7.7.php']
  ],
  lessons: [
    {
      id: 'm11l1', title: 'UNION и UNION ALL', minutes: 12,
      steps: [
        {
          t: 'widget', title: 'Четыре операции над множествами', w: 'setsViz',
          html: '<p>Представьте два списка: клиенты, совершавшие покупки в январе и в феврале. Переключайте операции и смотрите на результат:</p>'
        },
        {
          t: 'text', title: 'Правила',
          html: '<pre class="sql">SELECT ... FROM A\nUNION ALL\nSELECT ... FROM B;</pre>' +
            '<ul><li>Количество столбцов в обоих запросах должно совпадать, а типы — быть совместимыми (по порядку).</li>' +
            '<li>Имена столбцов результата берутся из <b>первого</b> запроса.</li>' +
            '<li><code>ORDER BY</code> пишется <b>один раз, в самом конце</b> и сортирует весь результат.</li>' +
            '<li><code>UNION</code> удаляет дубли (для этого серверу приходится сортировать или хешировать все строки), <code>UNION ALL</code> просто склеивает — быстрее.</li></ul>' +
            '<div class="key"><b>Правило</b>По умолчанию пишите <code>UNION ALL</code>. <code>UNION</code> — только если дубли действительно нужно убрать.</div>'
        },
        {
          t: 'example', title: 'Единый список контактов',
          html: '<p>Соберём в один список клиентов и сотрудников — например, для рассылки поздравлений. Столбец-константа помогает отличить источник:</p>',
          sql: "SELECT N'Клиент' AS Source, LastName + ' ' + FirstName AS Person, City\nFROM Clients\nWHERE City = N'Нарын'\nUNION ALL\nSELECT N'Сотрудник', e.FullName, b.City\nFROM Employees e\nJOIN Branches b ON b.BranchID = e.BranchID\nWHERE b.City = N'Нарын'\nORDER BY Source, Person;"
        },
        {
          t: 'example', title: 'Ошибка: разное число столбцов',
          sql: 'SELECT ClientID, LastName FROM Clients\nUNION ALL\nSELECT EmployeeID FROM Employees;',
          expectError: true
        },
        {
          t: 'quiz', id: 'm11l1q1',
          q: '<p>В первом запросе 100 строк, во втором 50, общих строк 10. Сколько строк вернут UNION ALL и UNION (если внутри каждого запроса дублей нет)?</p>',
          options: ['150 и 150', '150 и 140', '140 и 150', '150 и 160'],
          answer: 1,
          explain: 'UNION ALL склеивает всё: 150. UNION убирает 10 повторяющихся строк: 140.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm11l1t1', title: 'Все даты событий',
          text: '<p>Составьте единый список событий клиента № 5: даты открытия его счетов и даты выдачи его кредитов. Столбцы: <code>EventType</code> («Счёт» или «Кредит») и <code>EventDate</code>. Дубли не убирать.</p>',
          solution: "SELECT N'Счёт' AS EventType, OpenDate AS EventDate FROM Accounts WHERE ClientID = 5\nUNION ALL\nSELECT N'Кредит', IssueDate FROM Loans WHERE ClientID = 5;",
          check: { names: true },
          allowEmpty: true
        },
        {
          t: 'task', id: 'm11l1t2', title: 'Все города',
          text: '<p>Выведите без повторов список всех городов, где есть клиенты <b>или</b> филиалы банка (столбец <code>City</code>), по алфавиту.</p>',
          solution: 'SELECT City FROM Clients\nUNION\nSELECT City FROM Branches\nORDER BY City;',
          check: { order: [[0, 'asc']] },
          wrong: ['SELECT City FROM Clients UNION ALL SELECT City FROM Branches ORDER BY City;']
        },
        {
          t: 'quiz', id: 'm11l1t3',
          q: '<p>Где ставится ORDER BY в запросе с UNION ALL?</p>',
          options: ['В каждом запросе отдельно', 'Только в первом запросе', 'Один раз в самом конце', 'ORDER BY с UNION не работает'],
          answer: 2,
          explain: 'ORDER BY в конце сортирует весь объединённый результат. ORDER BY внутри частей вызовет ошибку.'
        }
      ]
    },
    {
      id: 'm11l2', title: 'INTERSECT и EXCEPT: удержание и отток', minutes: 14,
      steps: [
        {
          t: 'text', title: 'Пересечение и разность',
          html: '<ul><li><code>A INTERSECT B</code> — строки, которые есть <b>и в A, и в B</b>.</li>' +
            '<li><code>A EXCEPT B</code> — строки из A, которых <b>нет в B</b>. Порядок важен: A EXCEPT B ≠ B EXCEPT A.</li></ul>' +
            '<p>Обе операции убирают дубли и, в отличие от обычного сравнения, считают NULL равным NULL.</p>' +
            '<div class="tip"><b>Аналитика удержания</b>Активные клиенты — те, у кого была проведённая операция в периоде. «Удержанные» = активные в сентябре INTERSECT активные в октябре. «Ушедшие» = сентябрь EXCEPT октябрь. «Новые активные» = октябрь EXCEPT сентябрь.</div>'
        },
        {
          t: 'example', title: 'Удержанные клиенты',
          sql: "-- были активны и в сентябре, и в октябре 2026\nSELECT a.ClientID\nFROM Transactions t JOIN Accounts a ON a.AccountID = t.AccountID\nWHERE t.TransDate >= '20260901' AND t.TransDate < '20261001'\nINTERSECT\nSELECT a.ClientID\nFROM Transactions t JOIN Accounts a ON a.AccountID = t.AccountID\nWHERE t.TransDate >= '20261001' AND t.TransDate < '20261101';"
        },
        {
          t: 'example', title: 'Ушедшие клиенты',
          sql: "-- были активны в сентябре, но не в октябре\nSELECT a.ClientID\nFROM Transactions t JOIN Accounts a ON a.AccountID = t.AccountID\nWHERE t.TransDate >= '20260901' AND t.TransDate < '20261001'\nEXCEPT\nSELECT a.ClientID\nFROM Transactions t JOIN Accounts a ON a.AccountID = t.AccountID\nWHERE t.TransDate >= '20261001' AND t.TransDate < '20261101';",
          after: '<p>Тот же результат можно получить через NOT EXISTS. EXCEPT короче и нагляднее, когда сравниваются целые строки.</p>'
        },
        {
          t: 'quiz', id: 'm11l2q1',
          q: '<p>Как найти клиентов, которые <b>впервые</b> стали активными в октябре (не были активны в сентябре)?</p>',
          options: ['Сентябрь EXCEPT Октябрь', 'Октябрь EXCEPT Сентябрь', 'Сентябрь INTERSECT Октябрь', 'Сентябрь UNION Октябрь'],
          answer: 1,
          explain: 'Из октябрьских вычитаем сентябрьских — останутся те, кого в сентябре не было.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm11l2t1', title: 'Вклад и кредит',
          text: "<p>Выведите <code>ClientID</code> клиентов, у которых есть и счёт типа «Депозит», и хотя бы один кредит. Используйте INTERSECT.</p>",
          solution: "SELECT ClientID FROM Accounts WHERE AccountType = N'Депозит'\nINTERSECT\nSELECT ClientID FROM Loans;",
          check: { require: [['INTERSECT', 'Используйте INTERSECT.']] }
        },
        {
          t: 'task', id: 'm11l2t2', title: 'Новые активные',
          text: "<p>Выведите <code>ClientID</code> клиентов, у которых были операции в октябре 2026, но не было операций в сентябре 2026.</p>",
          solution: "SELECT a.ClientID\nFROM Transactions t JOIN Accounts a ON a.AccountID = t.AccountID\nWHERE t.TransDate >= '20261001' AND t.TransDate < '20261101'\nEXCEPT\nSELECT a.ClientID\nFROM Transactions t JOIN Accounts a ON a.AccountID = t.AccountID\nWHERE t.TransDate >= '20260901' AND t.TransDate < '20261001';",
          alsoOk: ["SELECT DISTINCT a.ClientID FROM Transactions t JOIN Accounts a ON a.AccountID = t.AccountID WHERE t.TransDate >= '20261001' AND t.TransDate < '20261101' AND NOT EXISTS (SELECT 1 FROM Transactions t2 JOIN Accounts a2 ON a2.AccountID = t2.AccountID WHERE a2.ClientID = a.ClientID AND t2.TransDate >= '20260901' AND t2.TransDate < '20261001');"]
        },
        {
          t: 'task', id: 'm11l2t3', title: 'Города без филиалов',
          text: '<p>В каких городах живут клиенты, но нет ни одного филиала банка? Выведите <code>City</code>.</p>',
          solution: 'SELECT City FROM Clients\nEXCEPT\nSELECT City FROM Branches;'
        }
      ]
    }
  ],
  homework: [
    {
      id: 'm11hw1', title: 'Ушедшие за квартал',
      text: "<p>Найдите клиентов, которые были активны (имели хоть одну операцию) во II квартале 2026 года, но не имели ни одной операции в III квартале. Выведите <code>ClientID</code>.</p>",
      solution: "SELECT a.ClientID FROM Transactions t JOIN Accounts a ON a.AccountID = t.AccountID\nWHERE t.TransDate >= '20260401' AND t.TransDate < '20260701'\nEXCEPT\nSELECT a.ClientID FROM Transactions t JOIN Accounts a ON a.AccountID = t.AccountID\nWHERE t.TransDate >= '20260701' AND t.TransDate < '20261001';",
      allowEmpty: true
    },
    {
      id: 'm11hw2', title: 'Сводный реестр сумм',
      text: "<p>Сделайте реестр крупных сумм за октябрь 2026: операции дороже 100 000 и кредиты дороже 1 000 000, выданные в октябре 2026. Столбцы: <code>Kind</code> («Операция»/«Кредит»), <code>ID</code> (TransactionID или LoanID), <code>EventDate</code> (дата, для операций — дата и время), <code>Amount</code>. Сортировка по сумме по убыванию.</p>",
      solution: "SELECT N'Операция' AS Kind, TransactionID AS ID, TransDate AS EventDate, Amount\nFROM Transactions\nWHERE Amount > 100000 AND TransDate >= '20261001' AND TransDate < '20261101'\nUNION ALL\nSELECT N'Кредит', LoanID, IssueDate, Amount\nFROM Loans\nWHERE Amount > 1000000 AND IssueDate >= '20261001' AND IssueDate < '20261101'\nORDER BY Amount DESC;",
      check: { names: true, order: [[3, 'desc']] },
      allowEmpty: true
    },
    {
      id: 'm11hw3', title: 'Валюты двух филиалов',
      text: "<p>В каких валютах есть счета у клиентов <b>и</b> филиала 1, <b>и</b> филиала 4 (по <code>Clients.BranchID</code>)? Выведите <code>Currency</code>.</p>",
      solution: 'SELECT a.Currency FROM Accounts a JOIN Clients c ON c.ClientID = a.ClientID WHERE c.BranchID = 1\nINTERSECT\nSELECT a.Currency FROM Accounts a JOIN Clients c ON c.ClientID = a.ClientID WHERE c.BranchID = 4;'
    },
    {
      id: 'm11hw4', title: 'Клиенты без валюты',
      text: "<p>Выведите <code>ClientID</code> клиентов, у которых есть счета, но нет ни одного счёта в иностранной валюте (только KGS). Используйте EXCEPT.</p>",
      solution: "SELECT ClientID FROM Accounts\nEXCEPT\nSELECT ClientID FROM Accounts WHERE Currency <> 'KGS';",
      check: { require: [['EXCEPT', 'Используйте EXCEPT.']] }
    }
  ]
});
