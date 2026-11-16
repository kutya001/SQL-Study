/* Модуль 3. Фильтрация WHERE */
COURSE.addModule({
  id: 'm03', num: 3,
  title: 'Фильтрация строк: WHERE',
  short: 'Условия сравнения, AND/OR/NOT и скобки, IN, BETWEEN, поиск по шаблону LIKE.',
  goal: '<p>WHERE — это «фильтр» Excel, только мощнее. Научимся отбирать нужные строки по любым условиям и не попадаться в классические ловушки с AND/OR.</p>',
  read: [
    ['Фильтрация. WHERE', 'https://metanit.com/sql/sqlserver/4.5.php'],
    ['Операторы фильтрации (IN, BETWEEN, LIKE)', 'https://metanit.com/sql/sqlserver/4.6.php']
  ],
  lessons: [
    {
      id: 'm03l1', title: 'Условия сравнения', minutes: 12,
      steps: [
        {
          t: 'text', title: 'WHERE — фильтр строк',
          html: '<p><code>WHERE</code> пишется после FROM и оставляет только те строки, для которых условие <b>истинно</b>:</p>' +
            '<pre class="sql">SELECT LastName, FirstName, City\nFROM Clients\nWHERE City = N\'Ош\';</pre>' +
            '<p>Операторы сравнения:</p>' +
            '<table><tr><th>Оператор</th><th>Значение</th><th>Пример</th></tr>' +
            '<tr><td><code>=</code></td><td>равно</td><td><code>Currency = \'USD\'</code></td></tr>' +
            '<tr><td><code>&lt;&gt;</code> или <code>!=</code></td><td>не равно</td><td><code>Status &lt;&gt; N\'Проведена\'</code></td></tr>' +
            '<tr><td><code>&gt;</code>, <code>&lt;</code></td><td>больше, меньше</td><td><code>Balance &gt; 100000</code></td></tr>' +
            '<tr><td><code>&gt;=</code>, <code>&lt;=</code></td><td>больше или равно, меньше или равно</td><td><code>HireDate &gt;= \'20220101\'</code></td></tr></table>'
        },
        {
          t: 'text', title: 'Как писать значения',
          html: '<ul><li><b>Числа</b> — без кавычек, дробная часть через точку: <code>Amount &gt; 1500.50</code>.</li>' +
            '<li><b>Текст</b> — в одинарных кавычках: <code>\'USD\'</code>. Перед русским текстом ставьте букву <b>N</b>: <code>N\'Бишкек\'</code>. N означает Юникод; без неё на некоторых серверах кириллица превращается в «????» и ничего не находится.</li>' +
            '<li><b>Даты</b> — тоже в кавычках. Самый надёжный формат — <code>\'ГГГГММДД\'</code> без разделителей: <code>\'20260131\'</code>. Почему — подробно в модуле про даты.</li></ul>' +
            '<div class="tip"><b>Регистр в тексте</b>В большинстве баз SQL Server сравнение текста <b>не учитывает регистр</b>: <code>City = N\'бишкек\'</code> найдёт и «Бишкек», и «БИШКЕК». Это зависит от настройки базы (collation). В нашей учебной базе — как в типичной банковской: регистр не важен.</div>'
        },
        {
          t: 'example', title: 'Клиенты из Оша',
          sql: "SELECT LastName, FirstName, City\nFROM Clients\nWHERE City = N'Ош';",
          after: '<p>Посмотрите вкладку «Пошагово»: на шаге FROM 220 строк, а после WHERE осталась только часть.</p>'
        },
        {
          t: 'example', title: 'Числа и даты',
          sql: "SELECT AccountNumber, Currency, Balance\nFROM Accounts\nWHERE Balance >= 300000\nORDER BY Balance DESC;",
          after: "<p>Попробуйте условие по дате: <code>SELECT FullName, HireDate FROM Employees WHERE HireDate >= '20240101';</code></p>"
        },
        {
          t: 'quiz', id: 'm03l1q1',
          q: '<p>Какое условие найдёт операции в долларах?</p>',
          options: ['<code>WHERE Currency = USD</code>', "<code>WHERE Currency = 'USD'</code>", '<code>WHERE Currency == "USD"</code>', "<code>WHERE 'Currency' = 'USD'</code>"],
          answer: 1,
          explain: 'Текст — в одинарных кавычках, сравнение — одним знаком =. Без кавычек USD считается именем столбца, а в варианте 4 сравниваются две строки-константы.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm03l1t1', title: 'Клиенты из Каракола',
          text: '<p>Выведите фамилию, имя и телефон клиентов из Каракола (<code>LastName</code>, <code>FirstName</code>, <code>Phone</code>).</p>',
          solution: "SELECT LastName, FirstName, Phone\nFROM Clients\nWHERE City = N'Каракол';",
          hint: "<code>WHERE City = N'Каракол'</code>"
        },
        {
          t: 'task', id: 'm03l1t2', title: 'Крупные остатки',
          text: '<p>Выведите номер счёта, валюту и остаток всех счетов с остатком <b>больше 250 000</b>.</p>',
          solution: 'SELECT AccountNumber, Currency, Balance\nFROM Accounts\nWHERE Balance > 250000;',
          wrong: ['SELECT AccountNumber, Currency, Balance FROM Accounts WHERE Balance >= 25000;']
        },
        {
          t: 'task', id: 'm03l1t3', title: 'Новые сотрудники',
          text: '<p>Выведите ФИО, должность и дату приёма сотрудников, принятых на работу <b>начиная с 1 января 2022 года</b>.</p>',
          solution: "SELECT FullName, Position, HireDate\nFROM Employees\nWHERE HireDate >= '20220101';",
          hint: "Дата в кавычках: <code>HireDate >= '20220101'</code>"
        },
        {
          t: 'task', id: 'm03l1t4', title: 'Не проведённые операции',
          text: '<p>Выведите <code>TransactionID</code>, <code>TransDate</code>, <code>Status</code> всех операций, статус которых <b>не</b> «Проведена».</p>',
          solution: "SELECT TransactionID, TransDate, Status\nFROM Transactions\nWHERE Status <> N'Проведена';",
          hint: 'Оператор «не равно» — <code>&lt;&gt;</code>.'
        }
      ]
    },
    {
      id: 'm03l2', title: 'Несколько условий: AND, OR, NOT', minutes: 14,
      steps: [
        {
          t: 'text', title: 'AND и OR',
          html: '<ul><li><code>AND</code> — «и»: строка проходит, только если <b>все</b> условия истинны. Каждое AND <i>сужает</i> выборку.</li>' +
            '<li><code>OR</code> — «или»: достаточно, чтобы истинным было <b>хотя бы одно</b> условие. Каждое OR <i>расширяет</i> выборку.</li>' +
            '<li><code>NOT</code> — «не»: переворачивает условие.</li></ul>' +
            '<pre class="sql">-- женщины из Бишкека\nSELECT LastName, FirstName, City, Gender\nFROM Clients\nWHERE City = N\'Бишкек\' AND Gender = N\'Ж\';</pre>'
        },
        {
          t: 'example', title: 'Пробуем AND и OR',
          sql: "SELECT LastName, FirstName, City, Gender\nFROM Clients\nWHERE City = N'Бишкек' AND Gender = N'Ж';",
          after: '<p>Замените <code>AND</code> на <code>OR</code>: строк станет гораздо больше — все бишкекчане плюс все женщины из других городов.</p>'
        },
        {
          t: 'text', title: 'Главная ловушка: приоритет AND над OR',
          html: '<p>Задача: <i>«ИП из Оша или Джалал-Абада»</i>. Первая мысль:</p>' +
            '<pre class="sql">WHERE ClientType = N\'ИП\' AND City = N\'Ош\' OR City = N\'Джалал-Абад\'   -- ОШИБКА</pre>' +
            '<p>AND выполняется <b>раньше</b> OR (как умножение раньше сложения). Сервер читает это так:</p>' +
            '<pre class="sql">WHERE (ClientType = N\'ИП\' AND City = N\'Ош\') OR City = N\'Джалал-Абад\'</pre>' +
            '<p>— то есть «ИП из Оша, а также <b>все</b> клиенты из Джалал-Абада». Правильно — поставить скобки:</p>' +
            '<pre class="sql">WHERE ClientType = N\'ИП\' AND (City = N\'Ош\' OR City = N\'Джалал-Абад\')</pre>' +
            '<div class="key"><b>Правило</b>Смешиваете AND и OR — всегда ставьте скобки, даже если уверены. Это бесплатно и спасает от тихих ошибок в отчётах.</div>'
        },
        {
          t: 'example', title: 'Сравните результаты',
          sql: "-- без скобок: ИП из Оша + ВСЕ из Джалал-Абада\nSELECT LastName, City, ClientType\nFROM Clients\nWHERE ClientType = N'ИП' AND City = N'Ош' OR City = N'Джалал-Абад';\n\n-- со скобками: только ИП\nSELECT LastName, City, ClientType\nFROM Clients\nWHERE ClientType = N'ИП' AND (City = N'Ош' OR City = N'Джалал-Абад');",
          noTrace: true,
          after: '<p>В редакторе два запроса — тренажёр, как и SSMS, покажет два результата. Сравните, сколько строк в каждом.</p>'
        },
        {
          t: 'quiz', id: 'm03l2q1',
          q: '<p>Как сервер прочитает условие <code>A OR B AND C</code>?</p>',
          options: ['<code>(A OR B) AND C</code>', '<code>A OR (B AND C)</code>', 'Выдаст ошибку', 'Слева направо, как написано'],
          answer: 1,
          explain: 'AND «сильнее» OR. Поэтому B AND C вычисляется первым.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm03l2t1', title: 'Женщины-ИП',
          text: '<p>Выведите фамилию, имя и город клиентов, которые одновременно женщины (<code>Gender = N\'Ж\'</code>) и индивидуальные предприниматели (<code>ClientType = N\'ИП\'</code>).</p>',
          solution: "SELECT LastName, FirstName, City\nFROM Clients\nWHERE Gender = N'Ж' AND ClientType = N'ИП';"
        },
        {
          t: 'task', id: 'm03l2t2', title: 'ИП с юга',
          text: '<p>Выведите фамилию, город и тип клиента для ИП (<code>ClientType = N\'ИП\'</code>) из Оша <b>или</b> Джалал-Абада.</p>',
          solution: "SELECT LastName, City, ClientType\nFROM Clients\nWHERE ClientType = N'ИП' AND (City = N'Ош' OR City = N'Джалал-Абад');",
          hint: 'Не забудьте скобки вокруг условия с OR.',
          wrong: ["SELECT LastName, City, ClientType FROM Clients WHERE ClientType = N'ИП' AND City = N'Ош' OR City = N'Джалал-Абад';"]
        },
        {
          t: 'task', id: 'm03l2t3', title: 'Крупные снятия',
          text: '<p>Найдите снятия наличных (<code>TransType = N\'Снятие наличных\'</code>) на сумму от 20 000 и выше, прошедшие через кассу (<code>Channel = N\'Касса\'</code>). Выведите <code>TransactionID</code>, <code>Amount</code>, <code>Channel</code>.</p>',
          solution: "SELECT TransactionID, Amount, Channel\nFROM Transactions\nWHERE TransType = N'Снятие наличных' AND Amount >= 20000 AND Channel = N'Касса';"
        },
        {
          t: 'quiz', id: 'm03l2t4',
          q: '<p>Нужны счета в USD с остатком больше 1000. Какое условие верное?</p>',
          options: ["<code>Currency = 'USD' OR Balance > 1000</code>", "<code>Currency = 'USD' AND Balance > 1000</code>", "<code>NOT Currency = 'USD' AND Balance > 1000</code>", "<code>Currency = 'USD', Balance > 1000</code>"],
          answer: 1,
          explain: 'Оба условия должны выполняться одновременно — это AND. Запятая между условиями — ошибка синтаксиса.'
        }
      ]
    },
    {
      id: 'm03l3', title: 'Списки и диапазоны: IN и BETWEEN', minutes: 10,
      steps: [
        {
          t: 'text', title: 'IN — «одно из списка»',
          html: '<p>Вместо длинной цепочки OR удобно написать список:</p>' +
            '<pre class="sql">-- то же, что City = N\'Ош\' OR City = N\'Нарын\' OR City = N\'Талас\'\nWHERE City IN (N\'Ош\', N\'Нарын\', N\'Талас\')</pre>' +
            '<p><code>NOT IN</code> — «ни одно из списка». Отлично работает для чисел, текста и дат.</p>'
        },
        {
          t: 'example', title: 'Счета в иностранной валюте',
          sql: "SELECT AccountNumber, Currency, Balance\nFROM Accounts\nWHERE Currency IN ('USD', 'EUR')\nORDER BY Currency, Balance DESC;"
        },
        {
          t: 'text', title: 'BETWEEN — «от … до» включительно',
          html: '<pre class="sql">WHERE InterestRate BETWEEN 15 AND 20</pre>' +
            '<p>Это то же самое, что <code>InterestRate &gt;= 15 AND InterestRate &lt;= 20</code> — <b>обе границы включаются</b>. Сначала пишут меньшее значение, потом большее; <code>BETWEEN 20 AND 15</code> ничего не найдёт.</p>' +
            '<div class="warn"><b>Осторожно с датами и временем</b>Для чисел BETWEEN удобен. Но со столбцами, где есть <b>время</b> (DATETIME), он коварен: <code>BETWEEN \'20260101\' AND \'20260131\'</code> потеряет все операции 31 января после полуночи. Разберём это в модуле о датах.</div>'
        },
        {
          t: 'example', title: 'Кредиты со ставкой 15–20%',
          sql: 'SELECT LoanID, ProductID, InterestRate\nFROM Loans\nWHERE InterestRate BETWEEN 15 AND 20\nORDER BY InterestRate;'
        }
      ],
      training: [
        {
          t: 'task', id: 'm03l3t1', title: 'Банкомат и касса',
          text: '<p>Найдите операции через банкомат или кассу (<code>Channel</code> — «Банкомат» или «Касса») на сумму от 10 000 до 20 000 включительно. Выведите <code>TransactionID</code>, <code>Channel</code>, <code>Amount</code>.</p>',
          solution: "SELECT TransactionID, Channel, Amount\nFROM Transactions\nWHERE Channel IN (N'Банкомат', N'Касса')\n  AND Amount BETWEEN 10000 AND 20000;",
          hint: 'IN для списка каналов + BETWEEN для суммы.',
          alsoOk: ["SELECT TransactionID, Channel, Amount FROM Transactions WHERE (Channel = N'Банкомат' OR Channel = N'Касса') AND Amount >= 10000 AND Amount <= 20000;"]
        },
        {
          t: 'task', id: 'm03l3t2', title: 'Не из столицы и не из Оша',
          text: '<p>Выведите фамилию, имя и город клиентов, которые живут <b>не</b> в Бишкеке и <b>не</b> в Оше.</p>',
          solution: "SELECT LastName, FirstName, City\nFROM Clients\nWHERE City NOT IN (N'Бишкек', N'Ош');"
        },
        {
          t: 'task', id: 'm03l3t3', title: 'Средние кредиты',
          text: '<p>Выведите <code>LoanID</code>, <code>Amount</code>, <code>TermMonths</code> кредитов на сумму от 100 000 до 500 000 включительно со сроком 12, 24 или 36 месяцев.</p>',
          solution: 'SELECT LoanID, Amount, TermMonths\nFROM Loans\nWHERE Amount BETWEEN 100000 AND 500000\n  AND TermMonths IN (12, 24, 36);'
        },
        {
          t: 'quiz', id: 'm03l3t4',
          q: '<p>Попадёт ли ставка 20.00 в условие <code>InterestRate BETWEEN 15 AND 20</code>?</p>',
          options: ['Да, границы включаются', 'Нет, правая граница не включается', 'Нет, обе границы не включаются', 'Зависит от настроек сервера'],
          answer: 0,
          explain: 'BETWEEN всегда включает обе границы: это >= 15 AND <= 20.'
        }
      ]
    },
    {
      id: 'm03l4', title: 'Поиск по шаблону: LIKE', minutes: 12,
      steps: [
        {
          t: 'text', title: 'Шаблоны',
          html: '<p><code>LIKE</code> ищет текст по шаблону. Специальные символы:</p>' +
            '<table><tr><th>Символ</th><th>Значение</th><th>Пример</th><th>Найдёт</th></tr>' +
            '<tr><td><code>%</code></td><td>любое количество любых символов (и ноль)</td><td><code>N\'Ка%\'</code></td><td>Касымов, Кадырова, Ка</td></tr>' +
            '<tr><td><code>_</code></td><td>ровно один любой символ</td><td><code>N\'Л_\'</code></td><td>Ли (но не Лиза)</td></tr>' +
            '<tr><td><code>[абв]</code></td><td>один символ из набора</td><td><code>N\'[АИ]%\'</code></td><td>начинается на А или И</td></tr>' +
            '<tr><td><code>[^абв]</code></td><td>один символ НЕ из набора</td><td><code>\'[^0-9]%\'</code></td><td>начинается не с цифры</td></tr></table>' +
            '<p>Чтобы найти сам символ % или _, возьмите его в скобки: <code>LIKE \'%[%]%\'</code>.</p>'
        },
        {
          t: 'widget', title: 'Поэкспериментируйте с шаблонами', w: 'likeViz'
        },
        {
          t: 'example', title: 'Почта на gmail',
          sql: "SELECT LastName, FirstName, Email\nFROM Clients\nWHERE Email LIKE '%@gmail.com';",
          after: '<p><code>NOT LIKE</code> работает наоборот. Попробуйте найти клиентов, у которых почта <b>не</b> на gmail.</p>'
        },
        {
          t: 'text', title: 'Когда LIKE медленный',
          html: '<p>Шаблон, который <b>начинается</b> с конкретных символов (<code>\'Ка%\'</code>), сервер может искать быстро — как по алфавитному указателю. А шаблон с <code>%</code> в начале (<code>\'%ов\'</code>) заставляет просмотреть каждую строку таблицы. На миллионах строк это заметно. Используйте ведущий % только когда он действительно нужен.</p>'
        }
      ],
      training: [
        {
          t: 'task', id: 'm03l4t1', title: 'Фамилии на «Ка»',
          text: '<p>Выведите фамилию и имя клиентов, чья фамилия начинается на «Ка».</p>',
          solution: "SELECT LastName, FirstName\nFROM Clients\nWHERE LastName LIKE N'Ка%';"
        },
        {
          t: 'task', id: 'm03l4t2', title: 'Оператор 555',
          text: '<p>Найдите клиентов с номером оператора 555: телефон начинается с <code>+996555</code>. Выведите фамилию и телефон.</p>',
          solution: "SELECT LastName, Phone\nFROM Clients\nWHERE Phone LIKE '+996555%';"
        },
        {
          t: 'task', id: 'm03l4t3', title: 'Имена на «а» или «я»',
          text: '<p>Выведите имена (<code>FirstName</code>) и фамилии клиентов, у которых имя заканчивается на «а» или на «я». Используйте один LIKE с набором символов.</p>',
          solution: "SELECT FirstName, LastName\nFROM Clients\nWHERE FirstName LIKE N'%[ая]';",
          check: { require: [['LIKE', 'Используйте LIKE.']] },
          alsoOk: ["SELECT FirstName, LastName FROM Clients WHERE FirstName LIKE N'%а' OR FirstName LIKE N'%я';"]
        },
        {
          t: 'quiz', id: 'm03l4t4',
          q: "<p>Какие значения найдёт <code>LIKE N'_ли%'</code>? Отметьте все подходящие.</p>",
          options: ['Алина', 'Ли', 'Алиев', 'Элина', 'Лиана'],
          answer: [0, 2, 3],
          explain: 'Шаблон: ровно один любой символ, затем «ли», затем что угодно. Алина (А+ли+на), Алиев (А+ли+ев), Элина (Э+ли+на) подходят. «Ли» и «Лиана» начинаются сразу с «Ли» — перед ним нет обязательного одного символа.'
        }
      ]
    }
  ],
  homework: [
    {
      id: 'm03hw1', title: 'Траты в аптеках',
      text: '<p>Найдите оплаты картой (<code>TransType = N\'Оплата картой\'</code>) в категории «Аптеки» на сумму больше 5 000. Выведите <code>TransactionID</code>, <code>TransDate</code>, <code>Amount</code>, отсортировав по сумме по убыванию.</p>',
      solution: "SELECT TransactionID, TransDate, Amount\nFROM Transactions\nWHERE TransType = N'Оплата картой' AND Category = N'Аптеки' AND Amount > 5000\nORDER BY Amount DESC;",
      check: { order: [[2, 'desc']] }
    },
    {
      id: 'm03hw2', title: 'Отклонённые в приложении',
      text: '<p>Служба поддержки разбирает отказы. Выведите отклонённые операции (<code>Status = N\'Отклонена\'</code>) через мобильное приложение, совершённые <b>в 2026 году</b>: <code>TransactionID</code>, <code>TransDate</code>, <code>Amount</code>.</p>',
      solution: "SELECT TransactionID, TransDate, Amount\nFROM Transactions\nWHERE Status = N'Отклонена'\n  AND Channel = N'Мобильное приложение'\n  AND TransDate >= '20260101' AND TransDate < '20270101';",
      hint: "Год 2026: <code>TransDate >= '20260101' AND TransDate < '20270101'</code>."
    },
    {
      id: 'm03hw3', title: 'Кредитные специалисты',
      text: '<p>Выведите ФИО и <code>BranchID</code> кредитных специалистов (<code>Position = N\'Кредитный специалист\'</code>) из филиалов 2 и 3, в алфавитном порядке ФИО.</p>',
      solution: "SELECT FullName, BranchID\nFROM Employees\nWHERE Position = N'Кредитный специалист' AND BranchID IN (2, 3)\nORDER BY FullName;",
      check: { order: [[0, 'asc']] }
    },
    {
      id: 'm03hw4', title: 'Клиенты 90-х',
      text: '<p>Выведите фамилию, имя и дату рождения клиентов из Бишкека, родившихся с 1990 по 1999 год включительно. Отсортируйте по дате рождения.</p>',
      solution: "SELECT LastName, FirstName, BirthDate\nFROM Clients\nWHERE City = N'Бишкек'\n  AND BirthDate >= '19900101' AND BirthDate < '20000101'\nORDER BY BirthDate;",
      check: { order: [[2, 'asc']] },
      alsoOk: ["SELECT LastName, FirstName, BirthDate FROM Clients WHERE City = N'Бишкек' AND BirthDate BETWEEN '19900101' AND '19991231' ORDER BY BirthDate;"]
    },
    {
      id: 'm03hw5', title: 'Валютные счета среднего размера',
      text: '<p>Выведите номер, валюту и остаток счетов в USD или EUR с остатком от 1 000 до 5 000 включительно.</p>',
      solution: "SELECT AccountNumber, Currency, Balance\nFROM Accounts\nWHERE Currency IN ('USD', 'EUR') AND Balance BETWEEN 1000 AND 5000;"
    },
    {
      id: 'm03hw6', title: 'Почта не на популярных доменах',
      text: '<p>Выведите фамилию и email клиентов, у которых почта <b>не</b> на gmail.com и <b>не</b> на mail.ru (клиентов без почты не выводите — для них условие LIKE не выполнится само).</p>',
      solution: "SELECT LastName, Email\nFROM Clients\nWHERE Email NOT LIKE '%@gmail.com' AND Email NOT LIKE '%@mail.ru';",
      hint: 'Два условия NOT LIKE через AND.'
    }
  ]
});
