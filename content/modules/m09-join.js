/* Модуль 9. Соединение таблиц JOIN */
COURSE.addModule({
  id: 'm09', num: 9,
  title: 'Соединение таблиц: JOIN',
  short: 'INNER и LEFT JOIN, поиск «чего нет», ловушки с WHERE и задвоением сумм, соединение таблицы с собой, CROSS JOIN.',
  goal: '<p>Данные банка разложены по многим таблицам. JOIN «склеивает» их по ключам — это как ВПР в Excel, только для любого числа таблиц и строк. После модуля вы соберёте отчёт из нескольких таблиц и не попадёте в две самые дорогие ловушки отчётности.</p>',
  read: [
    ['Inner Join', 'https://metanit.com/sql/sqlserver/7.2.php'],
    ['Outer Join', 'https://metanit.com/sql/sqlserver/7.3.php'],
    ['Группировка в соединениях', 'https://metanit.com/sql/sqlserver/7.4.php'],
    ['Неявное соединение таблиц', 'https://metanit.com/sql/sqlserver/7.1.php']
  ],
  lessons: [
    {
      id: 'm09l1', title: 'INNER JOIN: склеиваем таблицы по ключу', minutes: 16,
      steps: [
        {
          t: 'text', title: 'Зачем данные хранят в разных таблицах',
          html: '<p>Почему бы не хранить всё в одной таблице «Счета с ФИО клиента»? Потому что у клиента может быть 4 счёта — его ФИО, телефон и адрес пришлось бы повторять 4 раза, а при смене телефона — исправлять везде. Поэтому клиенты лежат в <code>Clients</code>, а счета — в <code>Accounts</code> со ссылкой <code>ClientID</code>.</p>' +
            '<div class="tip"><b>Аналогия с Excel</b>ВПР: по коду клиента из листа «Счета» подтягиваем его ФИО из листа «Клиенты». JOIN делает то же самое, но сразу для всех столбцов и строк.</div>'
        },
        {
          t: 'text', title: 'Синтаксис',
          html: '<pre class="sql">SELECT c.LastName, c.FirstName, a.AccountNumber, a.Currency\nFROM Clients c\nJOIN Accounts a ON a.ClientID = c.ClientID;</pre>' +
            '<ul><li><code>Clients c</code> — <b>псевдоним таблицы</b>: короткое имя, чтобы не писать каждый раз Clients.</li>' +
            '<li><code>JOIN … ON</code> — с какой таблицей соединяем и <b>по какому условию</b> строки считаются парой. Обычно это «внешний ключ = первичный ключ».</li>' +
            '<li><code>JOIN</code> — это сокращение от <code>INNER JOIN</code>: в результат попадают только строки, у которых нашлась пара.</li>' +
            '<li>Столбцы указываем с псевдонимом таблицы: <code>c.LastName</code>. Если столбец с таким именем есть в обеих таблицах (ClientID), без псевдонима будет ошибка «неоднозначное имя столбца».</li></ul>'
        },
        {
          t: 'example', title: 'Клиенты и их счета',
          sql: 'SELECT c.ClientID, c.LastName, c.FirstName, a.AccountNumber, a.Currency, a.Balance\nFROM Clients c\nJOIN Accounts a ON a.ClientID = c.ClientID\nORDER BY c.ClientID;',
          after: '<p>Клиент с тремя счетами встречается в результате три раза — по строке на каждую пару «клиент + счёт». А клиенты без счетов в INNER JOIN не попали.</p>'
        },
        {
          t: 'text', title: 'Цепочка из нескольких таблиц',
          html: '<p>JOIN можно продолжать: операция → её счёт → владелец счёта.</p>' +
            '<pre class="sql">SELECT t.TransactionID, t.Amount, a.Currency, c.LastName\nFROM Transactions t\nJOIN Accounts a ON a.AccountID = t.AccountID\nJOIN Clients  c ON c.ClientID  = a.ClientID;</pre>' +
            '<p>Каждый следующий JOIN присоединяет таблицу к уже собранному результату. Связи между таблицами смотрите на <a href="#/schema">схеме базы</a>.</p>'
        },
        {
          t: 'example', title: 'Три таблицы',
          sql: "SELECT TOP (20) t.TransactionID, t.TransDate, t.Amount, a.Currency, c.LastName, c.City\nFROM Transactions t\nJOIN Accounts a ON a.AccountID = t.AccountID\nJOIN Clients  c ON c.ClientID  = a.ClientID\nWHERE t.Amount > 100000\nORDER BY t.Amount DESC;"
        },
        {
          t: 'quiz', id: 'm09l1q1',
          q: '<p>Запрос <code>SELECT ClientID FROM Clients c JOIN Accounts a ON a.ClientID = c.ClientID</code> выдаёт ошибку «Неоднозначное имя столбца». Как исправить?</p>',
          options: ['Убрать ON', 'Написать c.ClientID (или a.ClientID)', 'Заменить JOIN на LEFT JOIN', 'Поставить ClientID в кавычки'],
          answer: 1,
          explain: 'Столбец ClientID есть в обеих таблицах — укажите, из какой брать.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm09l1t1', title: 'Счёт и владелец',
          text: '<p>Выведите номер счёта, валюту, фамилию и имя владельца: <code>AccountNumber</code>, <code>Currency</code>, <code>LastName</code>, <code>FirstName</code>.</p>',
          solution: 'SELECT a.AccountNumber, a.Currency, c.LastName, c.FirstName\nFROM Accounts a\nJOIN Clients c ON c.ClientID = a.ClientID;',
          check: { require: [['JOIN', 'Используйте JOIN.']] }
        },
        {
          t: 'task', id: 'm09l1t2', title: 'Кредит и продукт',
          text: '<p>Выведите <code>LoanID</code>, название продукта <code>ProductName</code> и сумму <code>Amount</code> всех кредитов.</p>',
          solution: 'SELECT l.LoanID, p.ProductName, l.Amount\nFROM Loans l\nJOIN LoanProducts p ON p.ProductID = l.ProductID;'
        },
        {
          t: 'task', id: 'm09l1t3', title: 'Сотрудник и филиал',
          text: '<p>Выведите ФИО сотрудника, должность и название филиала, в котором он работает (<code>FullName</code>, <code>Position</code>, <code>BranchName</code>).</p>',
          solution: 'SELECT e.FullName, e.Position, b.BranchName\nFROM Employees e\nJOIN Branches b ON b.BranchID = e.BranchID;'
        },
        {
          t: 'task', id: 'm09l1t4', title: 'Крупные операции с владельцами',
          text: "<p>Для операций на сумму больше 100 000 выведите <code>TransactionID</code>, <code>Amount</code>, валюту счёта (<code>Currency</code>) и фамилию владельца счёта (<code>LastName</code>).</p>",
          solution: 'SELECT t.TransactionID, t.Amount, a.Currency, c.LastName\nFROM Transactions t\nJOIN Accounts a ON a.AccountID = t.AccountID\nJOIN Clients c ON c.ClientID = a.ClientID\nWHERE t.Amount > 100000;',
          hint: 'Цепочка: Transactions → Accounts (по AccountID) → Clients (по ClientID).'
        }
      ]
    },
    {
      id: 'm09l2', title: 'LEFT JOIN и поиск «чего нет»', minutes: 18,
      steps: [
        {
          t: 'widget', title: 'Виды соединений', w: 'joinViz',
          html: '<p>Переключайте тип JOIN и смотрите, какие строки исходных таблиц попадают в результат (зелёные) и где появляется NULL. У Ивана и Асель нет счетов, а счёт 104 ссылается на несуществующего клиента 5.</p>'
        },
        {
          t: 'text', title: 'LEFT JOIN — главный инструмент аналитика',
          html: '<ul><li><code>LEFT JOIN</code> сохраняет <b>все строки левой таблицы</b> (той, что во FROM), даже если пары справа нет. Вместо отсутствующих данных справа — NULL.</li>' +
            '<li><code>RIGHT JOIN</code> — то же для правой таблицы. На практике его почти не используют: проще поменять таблицы местами и написать LEFT.</li>' +
            '<li><code>FULL JOIN</code> — все строки обеих таблиц. Нужен для сверок «что есть здесь, но нет там, и наоборот».</li></ul>' +
            '<div class="key"><b>Когда LEFT, а когда INNER</b>Спросите себя: «Нужны ли мне строки основной таблицы, у которых нет пары?» В отчёте «все клиенты и их кредиты» клиенты без кредитов должны остаться → LEFT JOIN. В отчёте «выданные кредиты с названием продукта» кредит без продукта невозможен → INNER JOIN.</div>'
        },
        {
          t: 'example', title: 'Все клиенты, даже без счетов',
          sql: 'SELECT c.ClientID, c.LastName, a.AccountNumber, a.Currency\nFROM Clients c\nLEFT JOIN Accounts a ON a.ClientID = c.ClientID\nORDER BY a.AccountNumber, c.ClientID;',
          after: '<p>Сверху — клиенты, у которых нет ни одного счёта: в столбцах счёта NULL (при сортировке NULL идут первыми).</p>'
        },
        {
          t: 'text', title: 'Анти-соединение: найти тех, у кого нет',
          html: '<p>Классическая задача: «клиенты без счетов», «счета без операций», «сотрудники без выданных кредитов». Приём: LEFT JOIN + проверка, что справа пусто:</p>' +
            '<pre class="sql">SELECT c.ClientID, c.LastName\nFROM Clients c\nLEFT JOIN Accounts a ON a.ClientID = c.ClientID\nWHERE a.AccountID IS NULL;</pre>' +
            '<p>Проверяйте на NULL столбец правой таблицы, который в настоящих данных никогда не бывает пустым, — лучше всего её первичный ключ.</p>'
        },
        {
          t: 'example', title: 'Клиенты без счетов',
          sql: 'SELECT c.ClientID, c.LastName, c.FirstName, c.RegistrationDate\nFROM Clients c\nLEFT JOIN Accounts a ON a.ClientID = c.ClientID\nWHERE a.AccountID IS NULL;'
        },
        {
          t: 'text', title: 'Считаем с LEFT JOIN правильно',
          html: '<p>«Сколько счетов у каждого клиента, включая тех, у кого 0?» Ловушка — <code>COUNT(*)</code>: у клиента без счетов после LEFT JOIN всё равно есть <b>одна</b> строка (с NULL справа), и COUNT(*) покажет 1. Правильно считать непустые значения правой таблицы: <code>COUNT(a.AccountID)</code>.</p>'
        },
        {
          t: 'example', title: 'COUNT(*) против COUNT(столбца)',
          sql: 'SELECT c.ClientID, c.LastName,\n       COUNT(*)           AS WrongCnt,\n       COUNT(a.AccountID) AS RightCnt\nFROM Clients c\nLEFT JOIN Accounts a ON a.ClientID = c.ClientID\nGROUP BY c.ClientID, c.LastName\nORDER BY RightCnt, c.ClientID;'
        }
      ],
      training: [
        {
          t: 'task', id: 'm09l2t1', title: 'Клиенты без кредитов',
          text: '<p>Выведите <code>ClientID</code>, фамилию и имя клиентов, у которых нет ни одного кредита.</p>',
          solution: 'SELECT c.ClientID, c.LastName, c.FirstName\nFROM Clients c\nLEFT JOIN Loans l ON l.ClientID = c.ClientID\nWHERE l.LoanID IS NULL;',
          hint: 'LEFT JOIN Loans и проверка l.LoanID IS NULL.'
        },
        {
          t: 'task', id: 'm09l2t2', title: 'Счетов у клиента, включая ноль',
          text: '<p>Для <b>каждого</b> клиента выведите <code>ClientID</code>, <code>LastName</code> и число его счетов <code>AccCnt</code> (у клиентов без счетов — 0).</p>',
          solution: 'SELECT c.ClientID, c.LastName, COUNT(a.AccountID) AS AccCnt\nFROM Clients c\nLEFT JOIN Accounts a ON a.ClientID = c.ClientID\nGROUP BY c.ClientID, c.LastName;',
          check: { names: true },
          wrong: ['SELECT c.ClientID, c.LastName, COUNT(*) AS AccCnt FROM Clients c LEFT JOIN Accounts a ON a.ClientID = c.ClientID GROUP BY c.ClientID, c.LastName;', 'SELECT c.ClientID, c.LastName, COUNT(a.AccountID) AS AccCnt FROM Clients c JOIN Accounts a ON a.ClientID = c.ClientID GROUP BY c.ClientID, c.LastName;']
        },
        {
          t: 'task', id: 'm09l2t3', title: 'Счета без операций',
          text: '<p>Найдите счета, по которым не было ни одной операции: <code>AccountID</code>, <code>AccountNumber</code>, <code>OpenDate</code>, <code>CloseDate</code>.</p>',
          solution: 'SELECT a.AccountID, a.AccountNumber, a.OpenDate, a.CloseDate\nFROM Accounts a\nLEFT JOIN Transactions t ON t.AccountID = a.AccountID\nWHERE t.TransactionID IS NULL;'
        },
        {
          t: 'quiz', id: 'm09l2t4',
          q: '<p>В левой таблице 10 клиентов, у 3 из них нет счетов, у остальных — ровно по 2 счёта. Сколько строк вернёт <code>Clients LEFT JOIN Accounts</code>?</p>',
          options: ['10', '14', '17', '20'],
          answer: 2,
          explain: '7 клиентов × 2 счёта = 14 строк + 3 клиента без счетов по одной строке с NULL = 17.'
        }
      ]
    },
    {
      id: 'm09l3', title: 'Две дорогие ловушки JOIN', minutes: 16,
      steps: [
        {
          t: 'text', title: 'Ловушка 1: условие на правую таблицу в WHERE',
          html: '<p>Задача: все клиенты и число их <b>активных</b> кредитов (у кого нет — 0). Первая мысль:</p>' +
            '<pre class="sql">SELECT c.ClientID, COUNT(l.LoanID) AS ActiveLoans\nFROM Clients c\nLEFT JOIN Loans l ON l.ClientID = c.ClientID\nWHERE l.Status = N\'Активен\'          -- ← проблема\nGROUP BY c.ClientID;</pre>' +
            '<p>У клиента без кредитов после LEFT JOIN <code>l.Status</code> = NULL, условие WHERE даёт «неизвестно» — и строка выбрасывается. LEFT JOIN молча превратился в INNER, клиенты с нулём пропали.</p>' +
            '<div class="key"><b>Правило</b>Условия на <b>правую</b> таблицу LEFT JOIN пишите в <code>ON</code>, а не в WHERE: <code>LEFT JOIN Loans l ON l.ClientID = c.ClientID AND l.Status = N\'Активен\'</code>.</div>'
        },
        {
          t: 'example', title: 'Сравните число строк',
          sql: "-- WHERE: клиенты без активных кредитов пропали\nSELECT c.ClientID, COUNT(l.LoanID) AS ActiveLoans\nFROM Clients c\nLEFT JOIN Loans l ON l.ClientID = c.ClientID\nWHERE l.Status = N'Активен'\nGROUP BY c.ClientID;\n\n-- ON: все 220 клиентов на месте\nSELECT c.ClientID, COUNT(l.LoanID) AS ActiveLoans\nFROM Clients c\nLEFT JOIN Loans l ON l.ClientID = c.ClientID AND l.Status = N'Активен'\nGROUP BY c.ClientID;",
          noTrace: true
        },
        {
          t: 'text', title: 'Ловушка 2: задвоение сумм',
          html: '<p>Когда вы соединяете «один ко многим», строка «одного» <b>повторяется</b> для каждой строки «многих». Пока вы просто смотрите на данные, это нормально. Но если потом сложить столбец «одного» — сумма умножится.</p>' +
            '<p>Пример: остаток счёта (в Accounts одна строка на счёт) соединили с операциями (много строк на счёт) и посчитали <code>SUM(a.Balance)</code> — остаток сложился столько раз, сколько было операций.</p>'
        },
        {
          t: 'example', title: 'Остаток «вырос» в десятки раз',
          sql: "SELECT a.AccountID,\n       a.Balance                AS RealBalance,\n       COUNT(t.TransactionID)   AS Trans,\n       SUM(a.Balance)           AS WrongBalance\nFROM Accounts a\nJOIN Transactions t ON t.AccountID = a.AccountID\nWHERE a.AccountID IN (1001, 1002, 1003)\nGROUP BY a.AccountID, a.Balance;",
          after: '<p>WrongBalance = остаток × число операций. В большом отчёте такую ошибку очень трудно заметить.</p>'
        },
        {
          t: 'text', title: 'Как защититься',
          html: '<ul><li>Перед суммированием спросите себя: «На сколько строк размножилась моя основная таблица после JOIN?» Полезно сравнить <code>COUNT(*)</code> до и после соединения.</li>' +
            '<li>Считайте количество объектов через <code>COUNT(DISTINCT ключ)</code>, а не COUNT(*).</li>' +
            '<li>Суммы по «многим» сначала агрегируйте <b>отдельно</b> (подзапросом или CTE — модули 10 и 12), а уже потом соединяйте готовые итоги.</li></ul>'
        },
        {
          t: 'quiz', id: 'm09l3q1',
          q: '<p>Клиент, 2 счёта, по 5 операций на каждом. После <code>Clients JOIN Accounts JOIN Transactions</code> сколько строк будет у клиента?</p>',
          options: ['1', '2', '7', '10'],
          answer: 3,
          explain: 'Каждая операция даёт свою строку: 2 × 5 = 10. Данные клиента повторены 10 раз, а данные каждого счёта — по 5 раз.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm09l3t1', title: 'Активные кредиты, включая ноль',
          text: "<p>Для <b>каждого</b> клиента выведите <code>ClientID</code> и число его активных кредитов <code>ActiveLoans</code> (у кого нет — 0).</p>",
          solution: "SELECT c.ClientID, COUNT(l.LoanID) AS ActiveLoans\nFROM Clients c\nLEFT JOIN Loans l ON l.ClientID = c.ClientID AND l.Status = N'Активен'\nGROUP BY c.ClientID;",
          check: { names: true },
          wrong: ["SELECT c.ClientID, COUNT(l.LoanID) AS ActiveLoans FROM Clients c LEFT JOIN Loans l ON l.ClientID = c.ClientID WHERE l.Status = N'Активен' GROUP BY c.ClientID;"],
          alsoOk: ["SELECT c.ClientID, SUM(CASE WHEN l.Status = N'Активен' THEN 1 ELSE 0 END) AS ActiveLoans FROM Clients c LEFT JOIN Loans l ON l.ClientID = c.ClientID GROUP BY c.ClientID;"]
        },
        {
          t: 'task', id: 'm09l3t2', title: 'Счета и операции без задвоения',
          text: '<p>Для каждого клиента, у которого есть операции, выведите <code>ClientID</code>, число его <b>счетов с операциями</b> <code>AccCnt</code> и общее число операций <code>TransCnt</code>.</p>',
          solution: 'SELECT a.ClientID, COUNT(DISTINCT a.AccountID) AS AccCnt, COUNT(*) AS TransCnt\nFROM Accounts a\nJOIN Transactions t ON t.AccountID = a.AccountID\nGROUP BY a.ClientID;',
          check: { names: true },
          hint: 'Счета повторяются для каждой операции — считайте их через COUNT(DISTINCT …).',
          wrong: ['SELECT a.ClientID, COUNT(a.AccountID) AS AccCnt, COUNT(*) AS TransCnt FROM Accounts a JOIN Transactions t ON t.AccountID = a.AccountID GROUP BY a.ClientID;']
        },
        {
          t: 'quiz', id: 'm09l3t3',
          q: '<p>Где писать условие на правую таблицу, чтобы LEFT JOIN сохранил все строки левой?</p>',
          options: ['В WHERE', 'В ON', 'В HAVING', 'Неважно'],
          answer: 1,
          explain: 'В ON условие лишь решает, какие строки справа считать парой. В WHERE оно отбрасывает строки с NULL справа — и LEFT JOIN перестаёт быть «левым».'
        }
      ]
    },
    {
      id: 'm09l4', title: 'Таблица сама с собой, CROSS JOIN и курсы валют', minutes: 16,
      steps: [
        {
          t: 'text', title: 'Соединение таблицы с самой собой',
          html: '<p>В <code>Employees</code> у каждого сотрудника есть <code>ManagerID</code> — ссылка на другого сотрудника той же таблицы. Чтобы вывести ФИО руководителя, соединяем таблицу саму с собой под <b>разными псевдонимами</b>:</p>' +
            '<pre class="sql">SELECT e.FullName AS Employee, m.FullName AS Manager\nFROM Employees e\nLEFT JOIN Employees m ON m.EmployeeID = e.ManagerID;</pre>' +
            '<p>LEFT — чтобы не потерять председателя правления: руководителя у него нет.</p>'
        },
        {
          t: 'example', title: 'Сотрудник и руководитель',
          sql: 'SELECT e.FullName AS Employee, e.Position, m.FullName AS Manager\nFROM Employees e\nLEFT JOIN Employees m ON m.EmployeeID = e.ManagerID\nORDER BY e.EmployeeID;'
        },
        {
          t: 'text', title: 'CROSS JOIN: все комбинации',
          html: '<p><code>CROSS JOIN</code> соединяет каждую строку слева с каждой строкой справа — без условия. 8 филиалов × 6 продуктов = 48 строк. Используют, чтобы построить «сетку» (все филиалы × все продукты, все дни × все валюты) и затем подтянуть к ней факты LEFT JOIN — тогда в отчёте не пропадут нулевые ячейки.</p>' +
            '<div class="warn"><b>Осторожно</b>Если случайно забыть условие соединения (например, перечислить таблицы через запятую во FROM без WHERE), получится тот же CROSS JOIN: 10 000 операций × 354 счёта = 3,5 млн строк.</div>'
        },
        {
          t: 'example', title: 'Сетка «филиал × продукт»',
          sql: 'SELECT b.BranchName, p.ProductName\nFROM Branches b\nCROSS JOIN LoanProducts p\nORDER BY b.BranchID, p.ProductID;'
        },
        {
          t: 'text', title: 'Соединение по нескольким условиям: курс на дату',
          html: '<p>Условие ON может состоять из нескольких частей. Пересчитаем операции по долларовым счетам в сомы по курсу на дату операции:</p>' +
            '<pre class="sql">SELECT t.TransactionID, t.Amount, r.Rate,\n       CAST(t.Amount * r.Rate AS DECIMAL(18,2)) AS AmountKGS\nFROM Transactions t\nJOIN Accounts a      ON a.AccountID = t.AccountID\nJOIN CurrencyRates r ON r.Currency  = a.Currency\n                    AND r.RateDate  = CAST(t.TransDate AS DATE)\nWHERE a.Currency = \'USD\';</pre>' +
            '<p>Курсы есть только по рабочим дням. Операции выходных при INNER JOIN пропадут, при LEFT JOIN получат NULL. Как взять «последний известный курс» — научимся в модуле о подзапросах.</p>'
        },
        {
          t: 'example', title: 'Доллары в сомы',
          sql: "SELECT TOP (20) t.TransactionID, t.TransDate, t.Amount, r.Rate,\n       CAST(t.Amount * r.Rate AS DECIMAL(18,2)) AS AmountKGS\nFROM Transactions t\nJOIN Accounts a      ON a.AccountID = t.AccountID\nJOIN CurrencyRates r ON r.Currency = a.Currency AND r.RateDate = CAST(t.TransDate AS DATE)\nWHERE a.Currency = 'USD'\nORDER BY t.TransDate DESC;"
        }
      ],
      training: [
        {
          t: 'task', id: 'm09l4t1', title: 'Кто чей руководитель',
          text: '<p>Выведите для всех сотрудников <code>Employee</code> (ФИО сотрудника) и <code>Manager</code> (ФИО руководителя; у председателя — NULL).</p>',
          solution: 'SELECT e.FullName AS Employee, m.FullName AS Manager\nFROM Employees e\nLEFT JOIN Employees m ON m.EmployeeID = e.ManagerID;',
          check: { names: true },
          wrong: ['SELECT e.FullName AS Employee, m.FullName AS Manager FROM Employees e JOIN Employees m ON m.EmployeeID = e.ManagerID;']
        },
        {
          t: 'task', id: 'm09l4t2', title: 'Подчинённых у руководителя',
          text: '<p>Для каждого руководителя, у которого есть подчинённые, выведите его ФИО (<code>Manager</code>) и число прямых подчинённых (<code>Subordinates</code>), по убыванию числа подчинённых.</p>',
          solution: 'SELECT m.FullName AS Manager, COUNT(*) AS Subordinates\nFROM Employees e\nJOIN Employees m ON m.EmployeeID = e.ManagerID\nGROUP BY m.FullName\nORDER BY Subordinates DESC;',
          check: { names: true, order: [[1, 'desc']] }
        },
        {
          t: 'task', id: 'm09l4t3', title: 'Евро в сомах',
          text: "<p>Для операций по счетам в евро за <b>октябрь 2026</b> выведите <code>TransactionID</code>, <code>Amount</code>, курс <code>Rate</code> на дату операции и сумму в сомах <code>AmountKGS</code> (DECIMAL(18,2)). Операции без курса на дату не выводите.</p>",
          solution: "SELECT t.TransactionID, t.Amount, r.Rate, CAST(t.Amount * r.Rate AS DECIMAL(18,2)) AS AmountKGS\nFROM Transactions t\nJOIN Accounts a ON a.AccountID = t.AccountID\nJOIN CurrencyRates r ON r.Currency = a.Currency AND r.RateDate = CAST(t.TransDate AS DATE)\nWHERE a.Currency = 'EUR' AND t.TransDate >= '20261001' AND t.TransDate < '20261101';",
          check: { names: true }
        },
        {
          t: 'quiz', id: 'm09l4t4',
          q: '<p>Сколько строк вернёт <code>Branches CROSS JOIN LoanProducts</code>, если филиалов 8, а продуктов 6?</p>',
          options: ['8', '14', '48', '6'],
          answer: 2,
          explain: 'Каждый с каждым: 8 × 6 = 48.'
        }
      ]
    }
  ],
  homework: [
    {
      id: 'm09hw1', title: 'Клиенты по филиалам',
      text: '<p>Выведите <b>все</b> филиалы: <code>BranchName</code> и число клиентов, закреплённых за филиалом (<code>Clients</code>), по убыванию числа клиентов.</p>',
      solution: 'SELECT b.BranchName, COUNT(c.ClientID) AS Clients\nFROM Branches b\nLEFT JOIN Clients c ON c.BranchID = b.BranchID\nGROUP BY b.BranchName\nORDER BY Clients DESC;',
      check: { names: true, order: [[1, 'desc']] }
    },
    {
      id: 'm09hw2', title: 'Ошане с долларами',
      text: "<p>Выведите уникальный список клиентов из Оша, у которых есть хотя бы один счёт в USD: <code>ClientID</code>, <code>LastName</code>, <code>FirstName</code>.</p>",
      solution: "SELECT DISTINCT c.ClientID, c.LastName, c.FirstName\nFROM Clients c\nJOIN Accounts a ON a.ClientID = c.ClientID\nWHERE c.City = N'Ош' AND a.Currency = 'USD';",
      hint: 'Если у клиента два долларовых счёта, без DISTINCT он появится дважды.'
    },
    {
      id: 'm09hw3', title: 'Результаты кредитных специалистов',
      text: '<p>Для каждого сотрудника, выдававшего кредиты, выведите ФИО (<code>FullName</code>), число выданных кредитов (<code>Loans</code>) и их общую сумму (<code>TotalAmount</code>). Сортировка по сумме по убыванию.</p>',
      solution: 'SELECT e.FullName, COUNT(*) AS Loans, SUM(l.Amount) AS TotalAmount\nFROM Loans l\nJOIN Employees e ON e.EmployeeID = l.EmployeeID\nGROUP BY e.FullName\nORDER BY TotalAmount DESC;',
      check: { names: true, order: [[2, 'desc']] }
    },
    {
      id: 'm09hw4', title: 'Просрочка по продуктам',
      text: "<p>Выведите <b>все</b> кредитные продукты: <code>ProductName</code> и число просроченных кредитов по нему (<code>OverdueCnt</code>), включая продукты, где просрочек нет (0).</p>",
      solution: "SELECT p.ProductName, COUNT(l.LoanID) AS OverdueCnt\nFROM LoanProducts p\nLEFT JOIN Loans l ON l.ProductID = p.ProductID AND l.Status = N'Просрочен'\nGROUP BY p.ProductName;",
      check: { names: true },
      wrong: ["SELECT p.ProductName, COUNT(l.LoanID) AS OverdueCnt FROM LoanProducts p LEFT JOIN Loans l ON l.ProductID = p.ProductID WHERE l.Status = N'Просрочен' GROUP BY p.ProductName;"],
      alsoOk: ["SELECT p.ProductName, SUM(CASE WHEN l.Status = N'Просрочен' THEN 1 ELSE 0 END) AS OverdueCnt FROM LoanProducts p LEFT JOIN Loans l ON l.ProductID = p.ProductID GROUP BY p.ProductName;"]
    },
    {
      id: 'm09hw5', title: 'Топ-10 покупателей',
      text: "<p>Выведите 10 клиентов с наибольшей суммой оплат картой за 2026 год: <code>ClientID</code>, <code>LastName</code>, <code>FirstName</code>, <code>Total</code> — по убыванию суммы.</p>",
      solution: "SELECT TOP (10) c.ClientID, c.LastName, c.FirstName, SUM(t.Amount) AS Total\nFROM Transactions t\nJOIN Accounts a ON a.AccountID = t.AccountID\nJOIN Clients c ON c.ClientID = a.ClientID\nWHERE t.TransType = N'Оплата картой' AND t.TransDate >= '20260101' AND t.TransDate < '20270101'\nGROUP BY c.ClientID, c.LastName, c.FirstName\nORDER BY Total DESC;",
      check: { names: true, order: [[3, 'desc']] }
    },
    {
      id: 'm09hw6', title: 'Новые клиенты без движения',
      text: '<p>Найдите счета клиентов, зарегистрированных в 2026 году, по которым не было ни одной операции: <code>ClientID</code>, <code>LastName</code>, <code>AccountNumber</code>.</p>',
      solution: "SELECT c.ClientID, c.LastName, a.AccountNumber\nFROM Clients c\nJOIN Accounts a ON a.ClientID = c.ClientID\nLEFT JOIN Transactions t ON t.AccountID = a.AccountID\nWHERE c.RegistrationDate >= '20260101' AND c.RegistrationDate < '20270101'\n  AND t.TransactionID IS NULL;"
    }
  ]
});
