/* Модуль 5. Типы данных, числа и строки */
COURSE.addModule({
  id: 'm05', num: 5,
  title: 'Типы данных, числа и строки',
  short: 'Типы данных, целочисленное деление, CAST/CONVERT/TRY_CAST, округление, строковые функции, склейка и очистка данных.',
  goal: '<p>Разберёмся, почему 7 / 2 в SQL равно 3, как превращать текст в число и обратно, и научимся «хирургии» строк: вырезать, заменять, склеивать и чистить грязные данные.</p>',
  read: [
    ['Типы данных T-SQL', 'https://metanit.com/sql/sqlserver/3.3.php'],
    ['Функции для работы с числами', 'https://metanit.com/sql/sqlserver/8.2.php'],
    ['Функции для работы со строками', 'https://metanit.com/sql/sqlserver/8.1.php'],
    ['Преобразование данных (CAST, CONVERT)', 'https://metanit.com/sql/sqlserver/8.4.php']
  ],
  lessons: [
    {
      id: 'm05l1', title: 'Типы данных и преобразования', minutes: 16,
      steps: [
        {
          t: 'text', title: 'У каждого столбца есть тип',
          html: '<p>В Excel в ячейку можно написать что угодно. В базе у каждого столбца строго определённый <b>тип данных</b>:</p>' +
            '<table><tr><th>Тип</th><th>Что хранит</th><th>Пример в нашей базе</th></tr>' +
            '<tr><td><code>INT</code>, <code>BIGINT</code></td><td>целые числа</td><td>ClientID, TermMonths</td></tr>' +
            '<tr><td><code>DECIMAL(p, s)</code></td><td>точные дробные: p цифр всего, s после запятой. Для денег.</td><td>Balance <code>decimal(18,2)</code></td></tr>' +
            '<tr><td><code>FLOAT</code></td><td>приближённые дробные. Для денег не используют — бывают ошибки округления.</td><td>—</td></tr>' +
            '<tr><td><code>VARCHAR(n)</code> / <code>NVARCHAR(n)</code></td><td>текст до n символов; N — Юникод (кириллица, любые языки)</td><td>LastName <code>nvarchar(50)</code></td></tr>' +
            '<tr><td><code>DATE</code> / <code>DATETIME</code></td><td>дата / дата со временем</td><td>BirthDate, TransDate</td></tr>' +
            '<tr><td><code>BIT</code></td><td>0 или 1 (да/нет)</td><td>—</td></tr></table>' +
            '<p>Тип каждого столбца виден в разделе <a href="#/schema">«Схема базы»</a> и во всплывающей подсказке над заголовком столбца в результатах.</p>'
        },
        {
          t: 'example', title: 'Ловушка: целочисленное деление',
          html: '<p>Если <b>оба</b> числа целые, SQL Server делит нацело и отбрасывает дробную часть (не округляет!):</p>',
          sql: 'SELECT 7 / 2       AS IntDiv,      -- 3\n       7 / 2.0     AS DecDiv,      -- 3.500000\n       7 * 1.0 / 2 AS Trick,       -- 3.500000\n       1 / 3       AS OneThird;    -- 0 !',
          after: '<p>Решение: сделать хотя бы одно число дробным — написать <code>2.0</code>, умножить на <code>1.0</code> или привести тип через <code>CAST</code>. Это частая причина «нулевых процентов» в отчётах: <code>Количество / Всего</code> даёт 0, если оба столбца INT.</p>'
        },
        {
          t: 'text', title: 'CAST и CONVERT',
          html: '<p>Чтобы явно поменять тип, используют:</p>' +
            '<pre class="sql">CAST(значение AS тип)\nCONVERT(тип, значение [, стиль])</pre>' +
            '<ul><li><code>CAST(\'123.45\' AS DECIMAL(10,2))</code> — текст в число.</li>' +
            '<li><code>CAST(123.456 AS DECIMAL(10,1))</code> → 123.5 — при уменьшении знаков после запятой значение <b>округляется</b>.</li>' +
            '<li><code>CAST(Balance AS INT)</code> — дробная часть <b>отбрасывается</b>.</li>' +
            '<li><code>CONVERT(VARCHAR(10), OpenDate, 104)</code> — дату в текст в формате ДД.ММ.ГГГГ (стиль 104). Стили дат разберём в модуле о датах.</li></ul>' +
            '<p>CAST — стандартный SQL, CONVERT — особенность SQL Server с дополнительным параметром «стиль».</p>'
        },
        {
          t: 'example', title: 'Пробуем преобразования',
          sql: "SELECT CAST('123.45' AS DECIMAL(10,2))   AS TextToNum,\n       CAST(123.456 AS DECIMAL(10,1))    AS Rounded,\n       CAST(123.9 AS INT)                AS Truncated,\n       CAST(2026 AS VARCHAR(10))         AS NumToText,\n       CONVERT(VARCHAR(10), CAST('20261008' AS DATE), 104) AS DateText;"
        },
        {
          t: 'text', title: 'TRY_CAST — безопасное преобразование',
          html: '<p>Если в текстовом столбце есть «мусор» (<code>\'N/A\'</code>, <code>\'1 500\'</code>), обычный CAST упадёт с ошибкой — и весь запрос не выполнится из-за одной плохой строки. <code>TRY_CAST</code> вместо ошибки возвращает <b>NULL</b>:</p>' +
            '<pre class="sql">SELECT RawAmount, TRY_CAST(RawAmount AS DECIMAL(18,2)) AS Amount\nFROM ImportRaw;</pre>' +
            '<p>Есть и <code>TRY_CONVERT(тип, значение, стиль)</code>. Эти функции — «бронежилет» аналитика при работе с выгрузками из чужих систем.</p>'
        },
        {
          t: 'example', title: 'CAST падает, TRY_CAST — нет',
          sql: "-- 1) Ошибка из-за одной строки с 'N/A'\nSELECT RowID, CAST(RawAmount AS DECIMAL(18,2)) AS Amount FROM ImportRaw;",
          expectError: true,
          after: '<p>Замените <code>CAST</code> на <code>TRY_CAST</code> и запустите снова: «плохие» значения станут NULL, остальные превратятся в числа.</p>'
        },
        {
          t: 'text', title: 'Округление',
          html: '<table><tr><th>Функция</th><th>Что делает</th><th>Пример → результат</th></tr>' +
            '<tr><td><code>ROUND(x, n)</code></td><td>округляет до n знаков (n может быть отрицательным)</td><td><code>ROUND(1234.567, 1)</code> → 1234.600<br><code>ROUND(1234.567, -2)</code> → 1200.000</td></tr>' +
            '<tr><td><code>CEILING(x)</code></td><td>вверх до целого</td><td><code>CEILING(2.1)</code> → 3</td></tr>' +
            '<tr><td><code>FLOOR(x)</code></td><td>вниз до целого</td><td><code>FLOOR(2.9)</code> → 2</td></tr>' +
            '<tr><td><code>ABS(x)</code></td><td>модуль числа</td><td><code>ABS(-5)</code> → 5</td></tr></table>' +
            '<div class="note">ROUND сохраняет тип: <code>ROUND(1234.567, 1)</code> выглядит как <b>1234.600</b> — нули остались. Чтобы получить ровно 1234.6, используйте <code>CAST(x AS DECIMAL(10,1))</code>.</div>'
        },
        {
          t: 'example', title: 'Месячная доля кредита',
          sql: 'SELECT LoanID, Amount, TermMonths,\n       Amount / TermMonths                         AS RawPart,\n       ROUND(Amount / TermMonths, 2)               AS Rounded,\n       CAST(Amount / TermMonths AS DECIMAL(18,2))  AS Money\nFROM Loans;'
        },
        {
          t: 'quiz', id: 'm05l1q1',
          q: '<p>В отчёте считают процент просроченных кредитов: <code>Overdue / Total * 100</code>, где оба столбца INT (например, 9 и 167). Что получится?</p>',
          options: ['5.39', '5', '0', 'Ошибка'],
          answer: 2,
          explain: '9 / 167 при целочисленном делении = 0, и 0 * 100 = 0. Правильно: <code>Overdue * 100.0 / Total</code>.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm05l1t1', title: 'Месячный платёж (без процентов)',
          text: '<p>Выведите <code>LoanID</code>, <code>Amount</code>, <code>TermMonths</code> и столбец <code>MonthlyPart</code> — сумму кредита, делённую на срок в месяцах, округлённую до 2 знаков.</p>',
          solution: 'SELECT LoanID, Amount, TermMonths, CAST(Amount / TermMonths AS DECIMAL(18,2)) AS MonthlyPart\nFROM Loans;',
          check: { names: true },
          alsoOk: ['SELECT LoanID, Amount, TermMonths, ROUND(Amount / TermMonths, 2) AS MonthlyPart FROM Loans;']
        },
        {
          t: 'task', id: 'm05l1t2', title: 'Срок в годах точно',
          text: '<p>Выведите <code>LoanID</code>, <code>TermMonths</code> и срок в годах <b>с дробной частью</b> под именем <code>TermYears</code>, округлённый до 2 знаков (18 месяцев → 1.50).</p>',
          solution: 'SELECT LoanID, TermMonths, CAST(TermMonths / 12.0 AS DECIMAL(10,2)) AS TermYears\nFROM Loans;',
          check: { names: true },
          hint: 'Чтобы деление было дробным, делите на <code>12.0</code>.',
          wrong: ['SELECT LoanID, TermMonths, TermMonths / 12 AS TermYears FROM Loans;'],
          alsoOk: ['SELECT LoanID, TermMonths, ROUND(TermMonths * 1.0 / 12, 2) AS TermYears FROM Loans;']
        },
        {
          t: 'task', id: 'm05l1t3', title: 'Годовые проценты',
          text: '<p>Для каждого кредита посчитайте сумму процентов за год без учёта погашения: <code>Amount × InterestRate / 100</code>, с точностью до 2 знаков. Выведите <code>LoanID</code>, <code>Amount</code>, <code>InterestRate</code>, <code>YearInterest</code>.</p>',
          solution: 'SELECT LoanID, Amount, InterestRate, CAST(Amount * InterestRate / 100 AS DECIMAL(18,2)) AS YearInterest\nFROM Loans;',
          check: { names: true },
          alsoOk: ['SELECT LoanID, Amount, InterestRate, ROUND(Amount * InterestRate / 100, 2) AS YearInterest FROM Loans;']
        },
        {
          t: 'task', id: 'm05l1t4', title: 'Только корректные суммы',
          text: '<p>Из <code>ImportRaw</code> выведите <code>RowID</code> и сумму, преобразованную в <code>DECIMAL(18,2)</code> (столбец <code>Amount</code>), — только для строк, где преобразование удалось.</p>',
          solution: 'SELECT RowID, TRY_CAST(RawAmount AS DECIMAL(18,2)) AS Amount\nFROM ImportRaw\nWHERE TRY_CAST(RawAmount AS DECIMAL(18,2)) IS NOT NULL;',
          check: { names: true },
          hint: 'Повторите TRY_CAST в WHERE и проверьте на IS NOT NULL. Псевдоним из SELECT в WHERE использовать нельзя.'
        },
        {
          t: 'quiz', id: 'm05l1t5',
          q: '<p>Что вернёт <code>CAST(19.99 AS INT)</code>?</p>',
          options: ['20', '19', '19.99', 'Ошибку'],
          answer: 1,
          explain: 'При приведении к целому дробная часть отбрасывается, а не округляется.'
        }
      ]
    },
    {
      id: 'm05l2', title: 'Функции для строк', minutes: 15,
      steps: [
        {
          t: 'text', title: 'Длина, регистр, пробелы',
          html: '<table><tr><th>Функция</th><th>Что делает</th><th>Пример → результат</th></tr>' +
            '<tr><td><code>LEN(s)</code></td><td>длина строки (без пробелов в конце)</td><td><code>LEN(N\'Бишкек\')</code> → 6</td></tr>' +
            '<tr><td><code>UPPER(s)</code> / <code>LOWER(s)</code></td><td>в верхний / нижний регистр</td><td><code>UPPER(N\'ош\')</code> → ОШ</td></tr>' +
            '<tr><td><code>TRIM(s)</code></td><td>убрать пробелы с обеих сторон (SQL Server 2017+)</td><td><code>TRIM(\'  x  \')</code> → x</td></tr>' +
            '<tr><td><code>LTRIM(s)</code> / <code>RTRIM(s)</code></td><td>убрать пробелы слева / справа</td><td><code>LTRIM(\'  x\')</code> → x</td></tr></table>'
        },
        {
          t: 'example', title: 'Пробуем',
          sql: 'SELECT LastName, LEN(LastName) AS Len, UPPER(LastName) AS Up, LOWER(Email) AS Mail\nFROM Clients\nWHERE Email IS NOT NULL;'
        },
        {
          t: 'text', title: 'Вырезаем части: LEFT, RIGHT, SUBSTRING',
          html: '<ul><li><code>LEFT(s, n)</code> — первые n символов.</li><li><code>RIGHT(s, n)</code> — последние n символов.</li>' +
            '<li><code>SUBSTRING(s, начало, длина)</code> — кусок из середины. <b>Позиции считаются с 1</b>, не с 0.</li></ul>' +
            '<pre class="sql">SELECT LEFT(N\'Бишкек\', 3)        -- Биш\n     , RIGHT(N\'Бишкек\', 3)       -- кек\n     , SUBSTRING(N\'Бишкек\', 2, 3) -- ишк</pre>'
        },
        {
          t: 'example', title: 'Маскируем номер счёта',
          sql: "SELECT AccountNumber,\n       LEFT(AccountNumber, 4)            AS First4,\n       '**** ' + RIGHT(AccountNumber, 4) AS Masked,\n       SUBSTRING(AccountNumber, 5, 4)    AS Middle\nFROM Accounts;"
        },
        {
          t: 'text', title: 'Поиск и замена: CHARINDEX, REPLACE',
          html: '<ul><li><code>CHARINDEX(что, где)</code> — позиция первого вхождения (0, если не найдено).</li>' +
            '<li><code>REPLACE(s, что, на_что)</code> — заменить все вхождения. Чтобы удалить символ, заменяйте на пустую строку <code>\'\'</code>.</li></ul>' +
            '<p>Вместе они решают задачи вида «вырезать то, что после символа». Например, домен почты — всё после «@»:</p>' +
            '<pre class="sql">SUBSTRING(Email, CHARINDEX(\'@\', Email) + 1, 100)</pre>' +
            '<p>Третий аргумент (100) — «с запасом»: если строка короче, SUBSTRING просто вернёт всё до конца.</p>'
        },
        {
          t: 'example', title: 'Разбираем email на части',
          sql: "SELECT Email,\n       CHARINDEX('@', Email)                       AS AtPos,\n       LEFT(Email, CHARINDEX('@', Email) - 1)      AS Login,\n       SUBSTRING(Email, CHARINDEX('@', Email) + 1, 100) AS Domain\nFROM Clients\nWHERE Email IS NOT NULL;",
          after: '<p>Посмотрите на результат построчно: позиция @ у каждого адреса своя, а формула работает для всех.</p>'
        },
        {
          t: 'quiz', id: 'm05l2q1',
          q: "<p>Что вернёт <code>SUBSTRING('ABCDEF', 2, 3)</code>?</p>",
          options: ['ABC', 'BCD', 'CDE', 'BC'],
          answer: 1,
          explain: 'Начиная со 2-го символа (B), 3 символа: BCD.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm05l2t1', title: 'Маска счёта',
          text: "<p>Выведите <code>AccountID</code> и маскированный номер счёта <code>Masked</code> в виде <b>**** **** **** 1234</b> (последние 4 цифры номера).</p>",
          solution: "SELECT AccountID, '**** **** **** ' + RIGHT(AccountNumber, 4) AS Masked\nFROM Accounts;",
          check: { names: true },
          alsoOk: ["SELECT AccountID, CONCAT('**** **** **** ', RIGHT(AccountNumber, 4)) AS Masked FROM Accounts;"]
        },
        {
          t: 'task', id: 'm05l2t2', title: 'Почтовые домены',
          text: '<p>Выведите список уникальных почтовых доменов клиентов (часть email после «@») под именем <code>Domain</code>, в алфавитном порядке.</p>',
          solution: "SELECT DISTINCT SUBSTRING(Email, CHARINDEX('@', Email) + 1, 100) AS Domain\nFROM Clients\nWHERE Email IS NOT NULL\nORDER BY Domain;",
          check: { order: [[0, 'asc']] },
          hint: 'SUBSTRING от позиции «@» + 1. Не забудьте убрать NULL.'
        },
        {
          t: 'task', id: 'm05l2t3', title: 'Длинные фамилии',
          text: '<p>Выведите фамилию и её длину (<code>Len</code>) для клиентов, чья фамилия длиннее 9 символов.</p>',
          solution: 'SELECT LastName, LEN(LastName) AS Len\nFROM Clients\nWHERE LEN(LastName) > 9;',
          check: { names: true }
        },
        {
          t: 'task', id: 'm05l2t4', title: 'Полные адреса',
          text: "<p>В адресах филиалов сокращения «ул.» нужно заменить на «улица», а «пр.» — на «проспект». Выведите <code>BranchName</code> и исправленный адрес <code>Address</code>.</p>",
          solution: "SELECT BranchName, REPLACE(REPLACE(Address, N'ул.', N'улица'), N'пр.', N'проспект') AS Address\nFROM Branches;",
          check: { names: true },
          hint: 'REPLACE можно вложить в REPLACE.'
        }
      ]
    },
    {
      id: 'm05l3', title: 'Склейка строк и очистка данных', minutes: 15,
      steps: [
        {
          t: 'text', title: 'Склейка через +',
          html: '<p>Строки склеивают оператором <code>+</code>: <code>LastName + \' \' + FirstName</code>. Но у него две ловушки:</p>' +
            '<ol><li><b>NULL «съедает» всю строку:</b> <code>\'Иванов \' + NULL</code> = NULL. Если отчества нет, пропадёт всё ФИО.</li>' +
            '<li><b>Число с текстом не склеивается:</b> <code>\'Остаток: \' + Balance</code> — SQL Server попытается превратить текст в число и выдаст ошибку.</li></ol>'
        },
        {
          t: 'example', title: 'Ловушка NULL при склейке',
          sql: "SELECT LastName, FirstName, MiddleName,\n       LastName + ' ' + FirstName + ' ' + MiddleName AS ByPlus,\n       CONCAT(LastName, ' ', FirstName, ' ', MiddleName) AS ByConcat\nFROM Clients;",
          after: '<p>Найдите клиентов без отчества: через <code>+</code> у них NULL, а CONCAT сработал.</p>'
        },
        {
          t: 'text', title: 'CONCAT и CONCAT_WS',
          html: '<ul><li><code>CONCAT(a, b, c, …)</code> склеивает любые значения: NULL считается пустой строкой, числа и даты превращаются в текст автоматически.</li>' +
            '<li><code>CONCAT_WS(разделитель, a, b, c, …)</code> («with separator») ставит разделитель между частями и <b>пропускает NULL</b> вместе с лишним разделителем. Идеально для ФИО и адресов.</li></ul>' +
            '<pre class="sql">CONCAT_WS(\' \', LastName, FirstName, MiddleName)   -- без двойных пробелов</pre>'
        },
        {
          t: 'example', title: 'CONCAT с числами',
          sql: "SELECT CONCAT(N'Счёт ', AccountNumber, N': ', Balance, ' ', Currency) AS Line,\n       CONCAT_WS(' ', AccountType, Currency) AS Kind\nFROM Accounts;",
          after: "<p>А теперь попробуйте <code>SELECT N'Остаток: ' + Balance FROM Accounts;</code> — увидите ошибку преобразования.</p>"
        },
        {
          t: 'text', title: 'FORMAT — красивые числа',
          html: '<p><code>FORMAT(число, \'N2\', \'ru-RU\')</code> выводит число с разделителями разрядов и двумя знаками: <b>1 234 567,89</b>. Формат <code>\'N0\'</code> — без копеек.</p>' +
            '<div class="warn"><b>Только для показа</b>FORMAT возвращает <b>текст</b>: по нему уже нельзя правильно сортировать и считать суммы. И он медленный на больших объёмах. Используйте его в самом конце, только для вывода.</div>'
        },
        {
          t: 'example', title: 'Форматируем остатки',
          sql: "SELECT TOP (10) AccountNumber, Balance,\n       FORMAT(Balance, 'N2', 'ru-RU') AS BalanceRu,\n       FORMAT(Balance, 'N0', 'en-US') AS BalanceEn\nFROM Accounts\nORDER BY Balance DESC;"
        },
        {
          t: 'text', title: 'Очистка грязных данных',
          html: '<p>Таблица <code>ImportRaw</code> — типичная выгрузка «из Excel оператора»: лишние пробелы, разный регистр, телефоны в разных форматах, суммы с пробелами и запятыми. Комбинируя функции, приводим всё к единому виду:</p>' +
            '<pre class="sql">SELECT RowID,\n       UPPER(TRIM(RawCity))                                   AS City,\n       TRY_CAST(REPLACE(REPLACE(RawAmount, \' \', \'\'), \',\', \'.\') AS DECIMAL(18,2)) AS Amount\nFROM ImportRaw;</pre>' +
            '<p>Читаем изнутри наружу: убрали пробелы → заменили запятую на точку → попробовали превратить в число.</p>'
        },
        {
          t: 'example', title: 'Чистим импорт',
          sql: "SELECT RowID, RawCity, RawAmount,\n       UPPER(TRIM(RawCity)) AS City,\n       TRY_CAST(REPLACE(REPLACE(RawAmount, ' ', ''), ',', '.') AS DECIMAL(18,2)) AS Amount\nFROM ImportRaw;",
          after: "<p>Обратите внимание на строку с «100О» (буква О вместо нуля) и «N/A» — они стали NULL. Это честнее, чем молча выдать неверную сумму.</p>"
        }
      ],
      training: [
        {
          t: 'task', id: 'm05l3t1', title: 'ФИО одной строкой',
          text: '<p>Выведите <code>ClientID</code> и полное ФИО клиента <code>FullName</code> через пробел (фамилия, имя, отчество). У клиентов без отчества не должно быть лишнего пробела в конце.</p>',
          solution: "SELECT ClientID, CONCAT_WS(' ', LastName, FirstName, MiddleName) AS FullName\nFROM Clients;",
          check: { names: true },
          hint: 'CONCAT_WS пропускает NULL вместе с разделителем.',
          wrong: ["SELECT ClientID, CONCAT(LastName, ' ', FirstName, ' ', MiddleName) AS FullName FROM Clients;"]
        },
        {
          t: 'task', id: 'm05l3t2', title: 'Фамилия и инициал',
          text: '<p>Выведите <code>ClientID</code> и <code>ShortName</code> в виде «Асанов Б.» — фамилия, пробел, первая буква имени и точка.</p>',
          solution: "SELECT ClientID, LastName + ' ' + LEFT(FirstName, 1) + '.' AS ShortName\nFROM Clients;",
          check: { names: true },
          alsoOk: ["SELECT ClientID, CONCAT(LastName, ' ', LEFT(FirstName, 1), '.') AS ShortName FROM Clients;"]
        },
        {
          t: 'task', id: 'm05l3t3', title: 'Город без мусора',
          text: '<p>Из <code>ImportRaw</code> выведите <code>RowID</code> и город <code>City</code>: без пробелов по краям и ЗАГЛАВНЫМИ буквами.</p>',
          solution: 'SELECT RowID, UPPER(TRIM(RawCity)) AS City\nFROM ImportRaw;',
          check: { names: true },
          alsoOk: ['SELECT RowID, UPPER(LTRIM(RTRIM(RawCity))) AS City FROM ImportRaw;']
        },
        {
          t: 'task', id: 'm05l3t4', title: 'Сумма из текста',
          text: '<p>Из <code>ImportRaw</code> выведите <code>RowID</code>, <code>RawAmount</code> и сумму <code>Amount</code> типа <code>DECIMAL(18,2)</code>: перед преобразованием уберите пробелы и замените запятую на точку. Некорректные значения должны стать NULL.</p>',
          solution: "SELECT RowID, RawAmount,\n       TRY_CAST(REPLACE(REPLACE(RawAmount, ' ', ''), ',', '.') AS DECIMAL(18,2)) AS Amount\nFROM ImportRaw;",
          check: { names: true }
        }
      ]
    }
  ],
  homework: [
    {
      id: 'm05hw1', title: 'Маска телефона',
      text: '<p>Для клиентов с телефоном выведите <code>ClientID</code> и <code>PhoneMasked</code>: первые 7 символов телефона, затем три звёздочки, затем последние 3 символа (<b>+996555***514</b>).</p>',
      solution: "SELECT ClientID, LEFT(Phone, 7) + '***' + RIGHT(Phone, 3) AS PhoneMasked\nFROM Clients\nWHERE Phone IS NOT NULL;",
      check: { names: true }
    },
    {
      id: 'm05hw2', title: 'Логины gmail',
      text: '<p>Для клиентов с почтой на gmail.com выведите фамилию и логин почты (часть до «@») ЗАГЛАВНЫМИ буквами под именем <code>Login</code>.</p>',
      solution: "SELECT LastName, UPPER(LEFT(Email, CHARINDEX('@', Email) - 1)) AS Login\nFROM Clients\nWHERE Email LIKE '%@gmail.com';",
      check: { names: true }
    },
    {
      id: 'm05hw3', title: 'Телефоны только цифрами',
      text: '<p>В <code>ImportRaw</code> телефоны записаны по-разному. Выведите <code>RowID</code> и <code>Phone</code> — телефон, из которого удалены пробелы, дефисы, скобки и знак «+».</p>',
      solution: "SELECT RowID,\n       REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(RawPhone, ' ', ''), '-', ''), '(', ''), ')', ''), '+', '') AS Phone\nFROM ImportRaw;",
      check: { names: true },
      hint: 'Пять вложенных REPLACE. Порядок замен не важен.'
    },
    {
      id: 'm05hw4', title: 'Подпись счёта',
      text: '<p>Выведите <code>AccountID</code> и подпись <code>Title</code> вида <b>Карточный • 5167 • 445968.94 KGS</b>: тип счёта, последние 4 цифры номера, остаток и валюта, разделённые « • » (пробел, точка-маркер, пробел; между остатком и валютой — обычный пробел).</p>',
      solution: "SELECT AccountID, CONCAT(AccountType, N' • ', RIGHT(AccountNumber, 4), N' • ', Balance, ' ', Currency) AS Title\nFROM Accounts;",
      check: { names: true },
      hint: 'CONCAT сам превратит число в текст.'
    },
    {
      id: 'm05hw5', title: 'Курсы с двумя знаками',
      text: "<p>Выведите курсы валют на 30 октября 2026 года: <code>Currency</code> и курс, округлённый до 2 знаков после запятой, под именем <code>Rate</code> (тип <code>DECIMAL(10,2)</code>).</p>",
      solution: "SELECT Currency, CAST(Rate AS DECIMAL(10,2)) AS Rate\nFROM CurrencyRates\nWHERE RateDate = '20261030';",
      check: { names: true }
    }
  ]
});
