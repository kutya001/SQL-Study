/* Модуль 4. NULL — «неизвестно» */
COURSE.addModule({
  id: 'm04', num: 4,
  title: 'NULL: пустые значения',
  short: 'Что такое NULL, IS NULL, трёхзначная логика, ISNULL, COALESCE, NULLIF.',
  goal: '<p>NULL — источник самых коварных ошибок в отчётах: строки «пропадают», суммы не сходятся. Разберёмся, как NULL ведёт себя в условиях и вычислениях и как его безопасно обрабатывать.</p>',
  read: [
    ['Функции ISNULL и COALESCE', 'https://metanit.com/sql/sqlserver/8.6.php'],
    ['Операторы фильтрации (IS NULL)', 'https://metanit.com/sql/sqlserver/4.6.php']
  ],
  lessons: [
    {
      id: 'm04l1', title: 'Что такое NULL и как его искать', minutes: 14,
      steps: [
        {
          t: 'text', title: 'NULL — это «неизвестно»',
          html: '<p>Если у клиента не указан телефон, в ячейке хранится не пустая строка и не ноль, а специальная отметка <code>NULL</code> — «значение неизвестно / отсутствует».</p>' +
            '<div class="tip"><b>Аналогия</b>Анкета, где графа «Телефон» не заполнена. Мы не знаем, есть ли телефон у человека, — мы просто его не знаем. Это не «телефон = 0» и не «телефон = пустой».</div>' +
            '<p>Из этого следует главное правило: <b>любое сравнение с NULL даёт «неизвестно»</b>. Равен ли неизвестный телефон номеру +996555111? Неизвестно. Не равен? Тоже неизвестно.</p>'
        },
        {
          t: 'text', title: 'IS NULL и IS NOT NULL',
          html: '<p>Поэтому <code>WHERE Phone = NULL</code> <b>никогда ничего не найдёт</b> — даже строки без телефона. Для проверки на NULL есть специальные операторы:</p>' +
            '<pre class="sql">SELECT LastName, FirstName\nFROM Clients\nWHERE Phone IS NULL;      -- телефона нет\n\nSELECT LastName, Phone\nFROM Clients\nWHERE Phone IS NOT NULL;  -- телефон есть</pre>'
        },
        {
          t: 'example', title: 'Убедитесь сами',
          sql: "-- 1) так НЕ работает: 0 строк\nSELECT LastName, Phone FROM Clients WHERE Phone = NULL;\n\n-- 2) а так работает\nSELECT LastName, Phone FROM Clients WHERE Phone IS NULL;",
          noTrace: true
        },
        {
          t: 'widget', title: 'Трёхзначная логика', w: 'nullTruth',
          html: '<p>В SQL условие может быть не только ИСТИНОЙ или ЛОЖЬЮ, но и <b>НЕИЗВЕСТНО</b> (UNKNOWN). WHERE пропускает строку только при ИСТИНЕ. Посмотрите, как это работает с AND, OR и NOT, и выберите условие ниже — увидите, что происходит с клиенткой Марией, у которой телефон NULL.</p>'
        },
        {
          t: 'text', title: 'NULL в вычислениях',
          html: '<p>Любая арифметика или склейка с NULL даёт NULL: <code>100 + NULL = NULL</code>. Неизвестное плюс 100 — тоже неизвестное.</p>' +
            '<pre class="sql">SELECT 100 + NULL AS A,           -- NULL\n       \'Иван \' + NULL AS B;     -- NULL</pre>' +
            '<div class="warn"><b>Ловушка «не равно»</b>Условие <code>Category &lt;&gt; N\'Продукты\'</code> не вернёт строки, где Category = NULL: для них результат «неизвестно». Если нужны «все, кроме продуктов, в том числе без категории», пишите явно: <code>Category &lt;&gt; N\'Продукты\' OR Category IS NULL</code>.</div>'
        },
        {
          t: 'quiz', id: 'm04l1q1',
          q: '<p>У клиента <code>Email = NULL</code>. Что даст условие <code>Email &lt;&gt; \'a@b.kg\'</code>?</p>',
          options: ['TRUE — почта ведь не a@b.kg', 'FALSE', 'UNKNOWN — строка не попадёт в результат', 'Ошибку'],
          answer: 2,
          explain: 'Сравнение с NULL всегда UNKNOWN, а WHERE пропускает только TRUE.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm04l1t1', title: 'Без телефона',
          text: '<p>Выведите фамилию, имя и город клиентов, у которых <b>не указан телефон</b>.</p>',
          solution: 'SELECT LastName, FirstName, City\nFROM Clients\nWHERE Phone IS NULL;',
          wrong: ['SELECT LastName, FirstName, City FROM Clients WHERE Phone = NULL;']
        },
        {
          t: 'task', id: 'm04l1t2', title: 'Почта есть, отчества нет',
          text: '<p>Выведите фамилию, имя и email клиентов, у которых указан email, но не указано отчество (<code>MiddleName</code>).</p>',
          solution: 'SELECT LastName, FirstName, Email\nFROM Clients\nWHERE Email IS NOT NULL AND MiddleName IS NULL;'
        },
        {
          t: 'task', id: 'm04l1t3', title: 'Все, кроме продуктов',
          text: '<p>Нужны все операции, <b>кроме</b> покупок в категории «Продукты» — включая операции без категории. Выведите <code>TransactionID</code>, <code>TransType</code>, <code>Category</code>.</p>',
          solution: "SELECT TransactionID, TransType, Category\nFROM Transactions\nWHERE Category <> N'Продукты' OR Category IS NULL;",
          hint: 'Условие «не равно» не пропускает NULL. Добавьте его явно через OR.',
          wrong: ["SELECT TransactionID, TransType, Category FROM Transactions WHERE Category <> N'Продукты';"]
        },
        {
          t: 'quiz', id: 'm04l1t4',
          q: '<p>Чему равно <code>NULL + 5</code>?</p>',
          options: ['5', '0', 'NULL', 'Ошибка'],
          answer: 2,
          explain: 'Неизвестное значение плюс 5 — всё ещё неизвестно.'
        }
      ]
    },
    {
      id: 'm04l2', title: 'Замена NULL: ISNULL, COALESCE, NULLIF', minutes: 14,
      steps: [
        {
          t: 'text', title: 'ISNULL — подставить значение',
          html: '<p><code>ISNULL(значение, замена)</code> возвращает значение, а если оно NULL — замену. Удобно для отчётов:</p>' +
            '<pre class="sql">SELECT LastName,\n       ISNULL(Phone, N\'нет телефона\') AS Phone\nFROM Clients;</pre>' +
            '<p>Это как формула <i>ЕСЛИ(ЕПУСТО(ячейка); "нет телефона"; ячейка)</i> в Excel.</p>'
        },
        {
          t: 'example', title: 'Пустые описания операций',
          sql: "SELECT TOP (15) TransactionID, TransType,\n       ISNULL(Description, N'(без комментария)') AS Description\nFROM Transactions\nORDER BY TransactionID;"
        },
        {
          t: 'text', title: 'COALESCE — первое непустое',
          html: '<p><code>COALESCE(a, b, c, …)</code> возвращает <b>первое не-NULL</b> значение из списка. Это стандарт SQL (работает во всех базах), и аргументов может быть сколько угодно:</p>' +
            '<pre class="sql">-- как связаться с клиентом: телефон, иначе email, иначе пометка\nSELECT LastName,\n       COALESCE(Phone, Email, N\'нет контактов\') AS Contact\nFROM Clients;</pre>' +
            '<div class="note"><b>ISNULL или COALESCE?</b> Для двух аргументов оба подходят. Тонкость: ISNULL берёт тип <i>первого</i> аргумента, и замена может обрезаться — например, если столбец <code>varchar(3)</code>, текст замены урежется до 3 символов. COALESCE такой проблемы не имеет.</div>'
        },
        {
          t: 'example', title: 'Контакт клиента',
          sql: "SELECT LastName, FirstName, Phone, Email,\n       COALESCE(Phone, Email, N'нет контактов') AS Contact\nFROM Clients\nWHERE Phone IS NULL;"
        },
        {
          t: 'text', title: 'NULLIF и деление на ноль',
          html: '<p><code>NULLIF(a, b)</code> делает обратное: возвращает NULL, если <code>a = b</code>, иначе <code>a</code>. Главное применение — защита от деления на ноль:</p>' +
            '<pre class="sql">SELECT 100 / 0;              -- ошибка 8134: деление на ноль\nSELECT 100 / NULLIF(0, 0);   -- NULL, без ошибки</pre>' +
            '<p>А ещё NULLIF превращает «мусорные» пустые строки в честный NULL: <code>NULLIF(RawPhone, \'\')</code>.</p>'
        },
        {
          t: 'example', title: 'Пустые строки → NULL',
          sql: "SELECT RowID, RawPhone,\n       NULLIF(RawPhone, '') AS PhoneOrNull,\n       COALESCE(NULLIF(RawPhone, ''), N'не указан') AS PhoneText\nFROM ImportRaw;",
          after: '<p>В строке 5 телефон — пустая строка <code>\'\'</code>, а в строке 6 — NULL. После NULLIF обе стали NULL, а COALESCE подставил текст.</p>'
        }
      ],
      training: [
        {
          t: 'task', id: 'm04l2t1', title: 'Отчество для отчёта',
          text: '<p>Выведите фамилию, имя и отчество клиентов; если отчества нет — выводите прочерк <b>—</b>. Третий столбец назовите <code>MiddleName</code>.</p>',
          solution: "SELECT LastName, FirstName, ISNULL(MiddleName, N'—') AS MiddleName\nFROM Clients;",
          check: { names: true },
          alsoOk: ["SELECT LastName, FirstName, COALESCE(MiddleName, N'—') AS MiddleName FROM Clients;"]
        },
        {
          t: 'task', id: 'm04l2t2', title: 'Канал связи',
          text: '<p>Для рассылки нужен один контакт на клиента: телефон, а если его нет — email, а если нет и его — текст <b>нет контактов</b>. Выведите <code>ClientID</code> и столбец <code>Contact</code>.</p>',
          solution: "SELECT ClientID, COALESCE(Phone, Email, N'нет контактов') AS Contact\nFROM Clients;",
          check: { names: true },
          hint: 'COALESCE с тремя аргументами.'
        },
        {
          t: 'task', id: 'm04l2t3', title: 'Дата закрытия счёта',
          text: '<p>Выведите номер счёта и дату закрытия (<code>CloseDate</code>); для открытых счетов (дата закрытия NULL) выведите дату <b>9999-12-31</b> — так часто делают в хранилищах данных. Столбец назовите <code>CloseDate</code>.</p>',
          solution: "SELECT AccountNumber, ISNULL(CloseDate, '99991231') AS CloseDate\nFROM Accounts;",
          check: { names: true },
          alsoOk: ["SELECT AccountNumber, COALESCE(CloseDate, '9999-12-31') AS CloseDate FROM Accounts;"]
        },
        {
          t: 'quiz', id: 'm04l2t4',
          q: '<p>Что вернёт <code>NULLIF(5, 5)</code>?</p>',
          options: ['5', '0', 'NULL', '1'],
          answer: 2,
          explain: 'Аргументы равны — NULLIF возвращает NULL. Если бы были разными, вернулся бы первый.'
        },
        {
          t: 'quiz', id: 'm04l2t5',
          q: '<p>Что вернёт <code>COALESCE(NULL, NULL, \'B\', \'C\')</code>?</p>',
          options: ['NULL', "'B'", "'C'", 'Ошибку'],
          answer: 1,
          explain: 'COALESCE берёт первое значение, которое не NULL.'
        }
      ]
    }
  ],
  homework: [
    {
      id: 'm04hw1', title: 'Открытые пустые счета',
      text: '<p>Найдите <b>открытые</b> счета (дата закрытия не указана) с нулевым остатком. Выведите <code>AccountNumber</code>, <code>AccountType</code>, <code>OpenDate</code>.</p>',
      solution: 'SELECT AccountNumber, AccountType, OpenDate\nFROM Accounts\nWHERE CloseDate IS NULL AND Balance = 0;'
    },
    {
      id: 'm04hw2', title: 'Клиенты без контактов',
      text: '<p>Выведите <code>ClientID</code>, фамилию и имя клиентов, у которых нет ни телефона, ни email.</p>',
      solution: 'SELECT ClientID, LastName, FirstName\nFROM Clients\nWHERE Phone IS NULL AND Email IS NULL;',
      allowEmpty: true
    },
    {
      id: 'm04hw3', title: 'Описание с подстановкой',
      text: '<p>Выведите <code>TransactionID</code> и столбец <code>Info</code>: описание операции, а если его нет — категорию, а если нет и её — тип операции. Только для операций за октябрь 2026 года.</p>',
      solution: "SELECT TransactionID, COALESCE(Description, Category, TransType) AS Info\nFROM Transactions\nWHERE TransDate >= '20261001' AND TransDate < '20261101';",
      check: { names: true }
    },
    {
      id: 'm04hw4', title: 'Не только кафе',
      text: '<p>Выведите <code>TransactionID</code>, <code>Category</code>, <code>Amount</code> всех операций дороже 30 000, у которых категория <b>не</b> «Кафе и рестораны» — включая операции без категории.</p>',
      solution: "SELECT TransactionID, Category, Amount\nFROM Transactions\nWHERE Amount > 30000 AND (Category <> N'Кафе и рестораны' OR Category IS NULL);",
      hint: 'Скобки вокруг условия с OR обязательны.',
      wrong: ["SELECT TransactionID, Category, Amount FROM Transactions WHERE Amount > 30000 AND Category <> N'Кафе и рестораны';"]
    },
    {
      id: 'm04hw5', title: 'Очистка импорта',
      text: '<p>Из <code>ImportRaw</code> выведите <code>RowID</code>, а также сумму и дату в «очищенном» виде: пустые строки замените на NULL. Столбцы назовите <code>Amount</code> и <code>RawDate</code> (типы пока оставьте текстовыми).</p>',
      solution: "SELECT RowID, NULLIF(RawAmount, '') AS Amount, NULLIF(RawDate, '') AS RawDate\nFROM ImportRaw;",
      check: { names: true }
    }
  ]
});
