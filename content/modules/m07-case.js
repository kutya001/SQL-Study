/* Модуль 7. Условная логика CASE */
COURSE.addModule({
  id: 'm07', num: 7,
  title: 'Условия в запросе: CASE и IIF',
  short: 'CASE WHEN как «ЕСЛИ» в Excel: категории, флаги, знак суммы, своя сортировка.',
  goal: '<p>CASE — это функция «ЕСЛИ» внутри запроса. С ней мы будем раскладывать клиентов по сегментам, ставить флаги, менять знак суммы и задавать собственный порядок сортировки.</p>',
  read: [['Функции CASE и IIF', 'https://metanit.com/sql/sqlserver/8.5.php']],
  lessons: [
    {
      id: 'm07l1', title: 'CASE: если — то — иначе', minutes: 14,
      steps: [
        {
          t: 'text', title: 'Синтаксис',
          html: '<pre class="sql">CASE\n    WHEN условие1 THEN результат1\n    WHEN условие2 THEN результат2\n    ELSE результат_иначе\nEND</pre>' +
            '<p>Это одно выражение, которое возвращает одно значение — его ставят в SELECT, как любой столбец, и дают псевдоним. Аналог в Excel — вложенные <i>ЕСЛИ()</i>, только читается гораздо проще.</p>' +
            '<ul><li>Условия проверяются <b>сверху вниз</b>, срабатывает <b>первое истинное</b>, остальные даже не проверяются.</li>' +
            '<li><code>ELSE</code> необязателен: если ни одно условие не сработало и ELSE нет, результат — NULL.</li>' +
            '<li>Каждый CASE заканчивается словом <code>END</code>.</li></ul>'
        },
        {
          t: 'widget', title: 'Первое истинное условие побеждает', w: 'caseViz'
        },
        {
          t: 'example', title: 'Размер операции',
          sql: "SELECT TOP (20) TransactionID, Amount,\n       CASE\n           WHEN Amount >= 100000 THEN N'Крупная'\n           WHEN Amount >= 10000  THEN N'Средняя'\n           WHEN Amount >= 1000   THEN N'Обычная'\n           ELSE N'Мелкая'\n       END AS SizeGroup\nFROM Transactions\nORDER BY TransactionID;",
          after: '<p>Почему во втором условии не нужно писать <code>Amount &lt; 100000</code>? Потому что до него доходят только строки, где первое условие оказалось ложным.</p>'
        },
        {
          t: 'text', title: 'Простой CASE и IIF',
          html: '<p>Если сравниваем один столбец с разными значениями, есть короткая форма:</p>' +
            '<pre class="sql">CASE Gender\n    WHEN N\'М\' THEN N\'Мужчина\'\n    WHEN N\'Ж\' THEN N\'Женщина\'\n    ELSE N\'Не указан\'\nEND</pre>' +
            '<p>А для двух вариантов есть функция <code>IIF(условие, если_да, если_нет)</code> — прямой аналог ЕСЛИ:</p>' +
            '<pre class="sql">IIF(CloseDate IS NULL, N\'Открыт\', N\'Закрыт\')</pre>'
        },
        {
          t: 'example', title: 'Пробуем обе формы',
          sql: "SELECT AccountNumber, Currency,\n       CASE Currency\n           WHEN 'KGS' THEN N'сом'\n           WHEN 'USD' THEN N'доллар'\n           WHEN 'EUR' THEN N'евро'\n           ELSE N'другая'\n       END AS CurrencyName,\n       IIF(CloseDate IS NULL, N'Открыт', N'Закрыт') AS State\nFROM Accounts;"
        },
        {
          t: 'quiz', id: 'm07l1q1',
          q: "<p>Amount = 50 000. Что вернёт выражение?</p><pre class=\"sql\">CASE\n  WHEN Amount > 1000  THEN 'A'\n  WHEN Amount > 10000 THEN 'B'\n  ELSE 'C'\nEND</pre>",
          options: ["'A'", "'B'", "'C'", "'A' и 'B'"],
          answer: 0,
          explain: 'Первое же условие (50 000 > 1000) истинно — результат A. До проверки B дело не доходит. Поэтому условия пишут от самого строгого к самому мягкому.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm07l1t1', title: 'Группы остатков',
          text: "<p>Для счетов в сомах (<code>Currency = 'KGS'</code>) выведите номер счёта, остаток и группу <code>BalanceGroup</code>: <b>Крупный</b> — от 100 000, <b>Обычный</b> — больше 0, иначе <b>Пустой</b>.</p>",
          solution: "SELECT AccountNumber, Balance,\n       CASE WHEN Balance >= 100000 THEN N'Крупный'\n            WHEN Balance > 0 THEN N'Обычный'\n            ELSE N'Пустой' END AS BalanceGroup\nFROM Accounts\nWHERE Currency = 'KGS';",
          check: { names: true },
          wrong: ["SELECT AccountNumber, Balance, CASE WHEN Balance > 0 THEN N'Обычный' WHEN Balance >= 100000 THEN N'Крупный' ELSE N'Пустой' END AS BalanceGroup FROM Accounts WHERE Currency = 'KGS';"]
        },
        {
          t: 'task', id: 'm07l1t2', title: 'Пол словами',
          text: "<p>Выведите <code>ClientID</code>, фамилию и столбец <code>GenderText</code>: «Мужчина» для М и «Женщина» для Ж. Используйте простую форму CASE.</p>",
          solution: "SELECT ClientID, LastName,\n       CASE Gender WHEN N'М' THEN N'Мужчина' WHEN N'Ж' THEN N'Женщина' END AS GenderText\nFROM Clients;",
          check: { names: true }
        },
        {
          t: 'task', id: 'm07l1t3', title: 'Открыт или закрыт',
          text: "<p>Выведите номер счёта и состояние <code>State</code>: «Открыт», если дата закрытия не указана, иначе «Закрыт». Используйте IIF.</p>",
          solution: "SELECT AccountNumber, IIF(CloseDate IS NULL, N'Открыт', N'Закрыт') AS State\nFROM Accounts;",
          check: { names: true },
          alsoOk: ["SELECT AccountNumber, CASE WHEN CloseDate IS NULL THEN N'Открыт' ELSE N'Закрыт' END AS State FROM Accounts;"]
        },
        {
          t: 'quiz', id: 'm07l1t4',
          q: '<p>Что вернёт CASE, если ни одно условие не выполнилось, а ELSE не написан?</p>',
          options: ['0', 'Пустую строку', 'NULL', 'Ошибку'],
          answer: 2,
          explain: 'Без ELSE CASE молча возвращает NULL. Если нужно значение по умолчанию — пишите ELSE.'
        }
      ]
    },
    {
      id: 'm07l2', title: 'CASE в работе аналитика', minutes: 16,
      steps: [
        {
          t: 'text', title: 'Знак суммы по типу операции',
          html: '<p>В таблице <code>Transactions</code> сумма всегда положительная, а направление денег определяет <code>TransType</code>. Для расчёта оборотов удобно сделать приход «+», а расход «−»:</p>' +
            '<pre class="sql">CASE WHEN TransType IN (N\'Пополнение\', N\'Перевод входящий\')\n     THEN Amount\n     ELSE -Amount\nEND AS SignedAmount</pre>'
        },
        {
          t: 'example', title: 'Приход и расход',
          sql: "SELECT TransactionID, AccountID, TransType, Amount,\n       CASE WHEN TransType IN (N'Пополнение', N'Перевод входящий') THEN Amount\n            ELSE -Amount END AS SignedAmount\nFROM Transactions\nWHERE AccountID = 1001\nORDER BY TransDate;"
        },
        {
          t: 'text', title: 'Своя сортировка',
          html: '<p>CASE можно использовать и в <code>ORDER BY</code>. Например, в отчёте по кредитам сначала нужны просроченные, затем активные, затем погашенные — а по алфавиту получается иначе:</p>' +
            '<pre class="sql">ORDER BY CASE Status\n             WHEN N\'Просрочен\' THEN 1\n             WHEN N\'Активен\'   THEN 2\n             ELSE 3\n         END,\n         LoanID</pre>' +
            '<p>Так же CASE можно писать в WHERE, но обычно там понятнее обычные AND/OR.</p>'
        },
        {
          t: 'example', title: 'Сначала проблемные кредиты',
          sql: "SELECT LoanID, Status, DaysOverdue, Amount\nFROM Loans\nORDER BY CASE Status WHEN N'Просрочен' THEN 1 WHEN N'Активен' THEN 2 ELSE 3 END,\n         DaysOverdue DESC, LoanID;"
        },
        {
          t: 'text', title: 'Тип результата и ловушки',
          html: '<p>Все ветки CASE должны давать значения <b>совместимого типа</b>. Если в одной ветке текст, а в другой число, SQL Server попробует превратить текст в число — и упадёт с ошибкой:</p>' +
            '<pre class="sql">CASE WHEN Balance > 100000 THEN \'VIP\' ELSE 0 END   -- ошибка!</pre>' +
            '<p>Решение — привести все ветки к одному типу: <code>ELSE \'0\'</code> или <code>ELSE N\'обычный\'</code>.</p>' +
            '<p>И помните про NULL: <code>CASE WHEN Phone = NULL</code> никогда не сработает — пишите <code>WHEN Phone IS NULL</code>.</p>'
        },
        {
          t: 'example', title: 'Посмотрите на ошибку',
          sql: "SELECT AccountNumber,\n       CASE WHEN Balance > 100000 THEN 'VIP' ELSE 0 END AS Segment\nFROM Accounts;",
          expectError: true,
          after: "<p>Исправьте <code>ELSE 0</code> на <code>ELSE N'Обычный'</code> и запустите снова.</p>"
        },
        {
          t: 'text', title: 'Флаги 1/0',
          html: '<p>Частый приём — флаг-столбец со значениями 1 и 0: <code>CASE WHEN Status = N\'Просрочен\' THEN 1 ELSE 0 END AS IsOverdue</code>. В модуле о группировке мы будем <b>складывать</b> такие флаги и получать количества по условию — это основа сводных отчётов.</p>'
        }
      ],
      training: [
        {
          t: 'task', id: 'm07l2t1', title: 'Корзины просрочки',
          text: "<p>Для каждого кредита выведите <code>LoanID</code>, <code>DaysOverdue</code> и корзину <code>OverdueBucket</code>: «Нет просрочки» (0 дней), «1–30 дней», «31–90 дней», «Более 90 дней».</p>",
          solution: "SELECT LoanID, DaysOverdue,\n       CASE WHEN DaysOverdue = 0 THEN N'Нет просрочки'\n            WHEN DaysOverdue <= 30 THEN N'1–30 дней'\n            WHEN DaysOverdue <= 90 THEN N'31–90 дней'\n            ELSE N'Более 90 дней' END AS OverdueBucket\nFROM Loans;",
          check: { names: true },
          hint: 'Скопируйте названия корзин из условия (там длинное тире «–»).'
        },
        {
          t: 'task', id: 'm07l2t2', title: 'Сумма со знаком',
          text: "<p>Для счёта <code>AccountID = 1002</code> выведите <code>TransactionID</code>, <code>TransType</code> и <code>SignedAmount</code>: сумма со знаком «+» для пополнений и входящих переводов и со знаком «−» для всех остальных типов.</p>",
          solution: "SELECT TransactionID, TransType,\n       CASE WHEN TransType IN (N'Пополнение', N'Перевод входящий') THEN Amount ELSE -Amount END AS SignedAmount\nFROM Transactions\nWHERE AccountID = 1002;",
          check: { names: true }
        },
        {
          t: 'task', id: 'm07l2t3', title: 'Порядок статусов',
          text: "<p>Выведите <code>LoanID</code> и <code>Status</code> всех кредитов в порядке: сначала «Просрочен», затем «Активен», затем «Погашен»; внутри статуса — по возрастанию <code>LoanID</code>.</p>",
          solution: "SELECT LoanID, Status\nFROM Loans\nORDER BY CASE Status WHEN N'Просрочен' THEN 1 WHEN N'Активен' THEN 2 ELSE 3 END, LoanID;",
          check: { ordered: true },
          wrong: ['SELECT LoanID, Status FROM Loans ORDER BY Status, LoanID;']
        },
        {
          t: 'task', id: 'm07l2t4', title: 'Возрастные группы',
          text: "<p>Выведите <code>ClientID</code>, <code>BirthDate</code> и <code>AgeGroup</code>: «Молодёжь» — родившиеся 1 января 2001 года и позже, «Старшие» — родившиеся до 1 января 1971 года, остальные — «Средний возраст».</p>",
          solution: "SELECT ClientID, BirthDate,\n       CASE WHEN BirthDate >= '20010101' THEN N'Молодёжь'\n            WHEN BirthDate < '19710101' THEN N'Старшие'\n            ELSE N'Средний возраст' END AS AgeGroup\nFROM Clients;",
          check: { names: true }
        },
        {
          t: 'quiz', id: 'm07l2t5',
          q: "<p>Почему запрос с <code>CASE WHEN … THEN 'VIP' ELSE 0 END</code> падает с ошибкой?</p>",
          options: ['CASE нельзя использовать в SELECT', 'Ветки возвращают несовместимые типы: SQL Server пытается превратить VIP в число', 'Не хватает слова END', 'В ELSE нельзя писать числа'],
          answer: 1,
          explain: 'Тип результата CASE определяется по «старшему» типу веток. Число старше текста, поэтому текст VIP пытаются превратить в число — ошибка.'
        }
      ]
    }
  ],
  homework: [
    {
      id: 'm07hw1', title: 'Сегменты клиентов-ИП',
      text: "<p>Для каждого клиента выведите <code>ClientID</code>, <code>ClientType</code>, <code>City</code> и <code>Segment</code>: «Бизнес-столица» — ИП из Бишкека, «Бизнес-регионы» — ИП из других городов, «Розница» — все физлица.</p>",
      solution: "SELECT ClientID, ClientType, City,\n       CASE WHEN ClientType = N'ИП' AND City = N'Бишкек' THEN N'Бизнес-столица'\n            WHEN ClientType = N'ИП' THEN N'Бизнес-регионы'\n            ELSE N'Розница' END AS Segment\nFROM Clients;",
      check: { names: true }
    },
    {
      id: 'm07hw2', title: 'Время суток',
      text: "<p>Для операций за 30 октября 2026 года выведите <code>TransactionID</code>, <code>TransDate</code> и <code>DayPart</code>: «Утро» (с 6:00 до 11:59), «День» (12:00–17:59), «Вечер» (18:00–22:59), иначе «Ночь».</p>",
      solution: "SELECT TransactionID, TransDate,\n       CASE WHEN DATEPART(hour, TransDate) BETWEEN 6 AND 11 THEN N'Утро'\n            WHEN DATEPART(hour, TransDate) BETWEEN 12 AND 17 THEN N'День'\n            WHEN DATEPART(hour, TransDate) BETWEEN 18 AND 22 THEN N'Вечер'\n            ELSE N'Ночь' END AS DayPart\nFROM Transactions\nWHERE TransDate >= '20261030' AND TransDate < '20261031';",
      check: { names: true }
    },
    {
      id: 'm07hw3', title: 'Флаги для отчёта',
      text: "<p>Для каждого кредита выведите <code>LoanID</code> и три флага (1/0): <code>IsActive</code> — статус «Активен», <code>IsOverdue</code> — статус «Просрочен», <code>IsBig</code> — сумма от 1 000 000.</p>",
      solution: "SELECT LoanID,\n       CASE WHEN Status = N'Активен' THEN 1 ELSE 0 END AS IsActive,\n       CASE WHEN Status = N'Просрочен' THEN 1 ELSE 0 END AS IsOverdue,\n       CASE WHEN Amount >= 1000000 THEN 1 ELSE 0 END AS IsBig\nFROM Loans;",
      check: { names: true },
      alsoOk: ["SELECT LoanID, IIF(Status = N'Активен', 1, 0) AS IsActive, IIF(Status = N'Просрочен', 1, 0) AS IsOverdue, IIF(Amount >= 1000000, 1, 0) AS IsBig FROM Loans;"]
    },
    {
      id: 'm07hw4', title: 'Ставка относительно продукта',
      text: "<p>Ставки кредитных продуктов: потребительский (<code>ProductID = 1</code>) — от 18 до 26%. Для кредитов этого продукта выведите <code>LoanID</code>, <code>InterestRate</code> и <code>RateLevel</code>: «Низкая» — меньше 20, «Средняя» — от 20 до 23 включительно, «Высокая» — больше 23.</p>",
      solution: "SELECT LoanID, InterestRate,\n       CASE WHEN InterestRate < 20 THEN N'Низкая'\n            WHEN InterestRate <= 23 THEN N'Средняя'\n            ELSE N'Высокая' END AS RateLevel\nFROM Loans\nWHERE ProductID = 1;",
      check: { names: true }
    },
    {
      id: 'm07hw5', title: 'Список обзвона',
      text: "<p>Отдел взыскания обзванивает просроченные кредиты: сначала самые большие просрочки. Выведите <code>LoanID</code>, <code>ClientID</code>, <code>DaysOverdue</code> и <code>Priority</code>: «Срочно», если просрочка больше 60 дней, иначе «Планово». Только просроченные кредиты, сортировка по <code>DaysOverdue</code> по убыванию.</p>",
      solution: "SELECT LoanID, ClientID, DaysOverdue,\n       IIF(DaysOverdue > 60, N'Срочно', N'Планово') AS Priority\nFROM Loans\nWHERE Status = N'Просрочен'\nORDER BY DaysOverdue DESC;",
      check: { names: true, order: [[2, 'desc']] }
    }
  ]
});
