/* Модуль 2. Сортировка, TOP и DISTINCT */
COURSE.addModule({
  id: 'm02', num: 2,
  title: 'Сортировка, TOP и уникальные значения',
  short: 'ORDER BY по одному и нескольким столбцам, TOP и постраничный вывод, DISTINCT.',
  goal: '<p>Научимся упорядочивать результат, брать «первые N» строк (топ клиентов, последние операции) и убирать повторы.</p>',
  read: [
    ['Сортировка. ORDER BY', 'https://metanit.com/sql/sqlserver/4.3.php'],
    ['Извлечение диапазона строк (TOP, OFFSET)', 'https://metanit.com/sql/sqlserver/4.4.php'],
    ['Выборка данных, DISTINCT', 'https://metanit.com/sql/sqlserver/4.2.php']
  ],
  lessons: [
    {
      id: 'm02l1', title: 'Сортировка: ORDER BY', minutes: 12,
      steps: [
        {
          t: 'text', title: 'Порядок строк не гарантирован',
          html: '<p>Важная мысль, о которой новички не знают: <b>без ORDER BY сервер не обещает никакого порядка строк</b>. Сегодня строки пришли «по номеру», завтра после обновления сервера — в другом порядке. Если порядок важен для отчёта, его нужно указать явно.</p>' +
            '<pre class="sql">SELECT LastName, FirstName, BirthDate\nFROM Clients\nORDER BY LastName;</pre>' +
            '<p><code>ORDER BY</code> пишется <b>в самом конце запроса</b>, после FROM (и после WHERE, о котором — в следующем модуле).</p>'
        },
        {
          t: 'example', title: 'По возрастанию и убыванию',
          html: '<ul><li><code>ASC</code> — по возрастанию (А→Я, 0→9, старые даты → новые). Это значение по умолчанию, его можно не писать.</li><li><code>DESC</code> — по убыванию (Я→А, 9→0, новые даты → старые).</li></ul>',
          sql: 'SELECT FullName, Position, Salary\nFROM Employees\nORDER BY Salary DESC;',
          after: '<p>Замените <code>DESC</code> на <code>ASC</code> и сравните.</p>'
        },
        {
          t: 'example', title: 'Сортировка по нескольким столбцам',
          html: '<p>Через запятую можно задать несколько уровней сортировки: сначала по первому столбцу, а <b>при равенстве</b> — по второму, и так далее. У каждого столбца своё направление.</p>',
          sql: 'SELECT City, LastName, FirstName\nFROM Clients\nORDER BY City ASC, LastName ASC, FirstName ASC;',
          after: '<p>Внутри каждого города клиенты отсортированы по фамилии, а однофамильцы — по имени. Как многоуровневая сортировка в Excel.</p>'
        },
        {
          t: 'text', title: 'Псевдонимы, выражения и NULL',
          html: '<ul><li>В ORDER BY можно использовать <b>псевдоним</b> из SELECT — сортировка выполняется в самом конце, когда псевдонимы уже известны:<pre class="sql">SELECT FullName, Salary * 12 AS YearSalary\nFROM Employees\nORDER BY YearSalary DESC;</pre></li>' +
            '<li>Можно сортировать по выражению или по столбцу, которого нет в SELECT: <code>ORDER BY HireDate</code>.</li>' +
            '<li>Пустые значения (<code>NULL</code>) при сортировке по возрастанию идут <b>первыми</b>, по убыванию — последними.</li>' +
            '<li>Можно написать номер столбца: <code>ORDER BY 2</code> — «по второму столбцу из SELECT». Работает, но в рабочих запросах так не делают: поменяете порядок столбцов — сломается сортировка.</li></ul>'
        },
        {
          t: 'example', title: 'Где окажутся NULL?',
          sql: 'SELECT LastName, FirstName, MiddleName\nFROM Clients\nORDER BY MiddleName;',
          after: '<p>У клиентов без отчества в столбце <code>NULL</code> — они оказались в самом начале.</p>'
        },
        {
          t: 'quiz', id: 'm02l1q1',
          q: '<p>Что вернёт запрос без ORDER BY, если выполнить его дважды?</p>',
          options: ['Всегда строки в порядке первичного ключа', 'Строки в алфавитном порядке', 'Строки в любом порядке — он не гарантирован', 'Ошибку: ORDER BY обязателен'],
          answer: 2,
          explain: 'Часто кажется, что строки идут «по порядку», но это случайность. Нужен порядок — пишите ORDER BY.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm02l1t1', title: 'Сначала старшие',
          text: '<p>Выведите фамилию, имя и дату рождения клиентов (<code>LastName</code>, <code>FirstName</code>, <code>BirthDate</code>) — от самого старшего клиента к самому младшему.</p>',
          solution: 'SELECT LastName, FirstName, BirthDate\nFROM Clients\nORDER BY BirthDate;',
          check: { order: [[2, 'asc']] },
          hint: 'Старший — тот, у кого дата рождения раньше. Значит, по возрастанию даты.',
          wrong: ['SELECT LastName, FirstName, BirthDate FROM Clients ORDER BY BirthDate DESC;']
        },
        {
          t: 'task', id: 'm02l1t2', title: 'Оклады',
          text: '<p>Выведите ФИО и оклад сотрудников (<code>FullName</code>, <code>Salary</code>): сначала самые высокие оклады, а при одинаковом окладе — по ФИО в алфавитном порядке.</p>',
          solution: 'SELECT FullName, Salary\nFROM Employees\nORDER BY Salary DESC, FullName;',
          check: { order: [[1, 'desc'], [0, 'asc']] },
          hint: 'Два уровня сортировки: <code>ORDER BY Salary DESC, FullName</code>.',
          wrong: ['SELECT FullName, Salary FROM Employees ORDER BY Salary DESC, FullName DESC;']
        },
        {
          t: 'task', id: 'm02l1t3', title: 'Счета по валютам',
          text: '<p>Выведите номер счёта, валюту и остаток (<code>AccountNumber</code>, <code>Currency</code>, <code>Balance</code>). Отсортируйте по валюте (А→Я), а внутри валюты — от большего остатка к меньшему.</p>',
          solution: 'SELECT AccountNumber, Currency, Balance\nFROM Accounts\nORDER BY Currency, Balance DESC;',
          check: { order: [[1, 'asc'], [2, 'desc']] },
          hint: '<code>ORDER BY Currency, Balance DESC</code>'
        },
        {
          t: 'quiz', id: 'm02l1t4',
          q: '<p>Клиенты отсортированы так: <code>ORDER BY MiddleName ASC</code>. Где окажутся клиенты без отчества (NULL)?</p>',
          options: ['В начале', 'В конце', 'Они не попадут в результат', 'Запрос вернёт ошибку'],
          answer: 0,
          explain: 'В SQL Server NULL считается «меньше» любого значения: при ASC такие строки идут первыми, при DESC — последними.'
        }
      ]
    },
    {
      id: 'm02l2', title: 'TOP и постраничный вывод', minutes: 12,
      steps: [
        {
          t: 'text', title: 'Первые N строк: TOP',
          html: '<p>Часто нужны не все строки, а «первые N»: топ-10 клиентов, последние 5 операций. Для этого после SELECT пишут <code>TOP (N)</code>:</p>' +
            '<pre class="sql">SELECT TOP (5) AccountNumber, Balance\nFROM Accounts\nORDER BY Balance DESC;</pre>' +
            '<div class="warn"><b>TOP почти всегда используется с ORDER BY</b>Без сортировки TOP вернёт «какие-то» 5 строк. А вот <i>«5 самых больших остатков»</i> = сначала отсортировать по убыванию, потом отрезать 5.</div>' +
            '<p>Скобки вокруг числа можно не писать (<code>TOP 5</code>), но со скобками — современный стиль, и туда можно подставить переменную.</p>'
        },
        {
          t: 'example', title: 'Пять самых крупных остатков',
          sql: 'SELECT TOP (5) AccountNumber, Currency, Balance\nFROM Accounts\nORDER BY Balance DESC;',
          after: '<p>Откройте вкладку «Пошагово»: сначала сервер сортирует все 354 счёта, и только на последнем шаге отрезает первые 5.</p>'
        },
        {
          t: 'text', title: 'WITH TIES и PERCENT',
          html: '<ul><li><code>TOP (N) WITH TIES</code> — «и ещё строки с таким же значением, как у последней». Если двое делят третье место, вы получите обоих. Требует ORDER BY.</li>' +
            '<li><code>TOP (10) PERCENT</code> — первые 10% строк.</li></ul>' +
            '<pre class="sql">-- два самых высоких оклада + все, у кого такой же оклад, как у второго\nSELECT TOP (2) WITH TIES FullName, Salary\nFROM Employees\nORDER BY Salary DESC;</pre>'
        },
        {
          t: 'example', title: 'Сравните с WITH TIES и без',
          sql: 'SELECT TOP (2) WITH TIES FullName, Salary\nFROM Employees\nORDER BY Salary DESC;',
          after: '<p>Вернулось 3 строки: у двух заместителей одинаковый оклад. Уберите <code>WITH TIES</code> — останется 2 строки, и кто из двух заместителей попадёт в результат, решит случай.</p>'
        },
        {
          t: 'text', title: 'Страницы: OFFSET … FETCH',
          html: '<p>Чтобы показать «страницу» результата — например, строки с 21-й по 30-ю — используют конструкцию после ORDER BY:</p>' +
            '<pre class="sql">SELECT FullName, Position\nFROM Employees\nORDER BY FullName\nOFFSET 20 ROWS            -- пропустить 20 строк\nFETCH NEXT 10 ROWS ONLY;  -- и взять следующие 10</pre>' +
            '<p>Формула для страницы номер <i>P</i> по <i>K</i> строк: <code>OFFSET (P − 1) × K ROWS FETCH NEXT K ROWS ONLY</code>. OFFSET работает только вместе с ORDER BY, а TOP и OFFSET в одном запросе использовать нельзя.</p>'
        },
        {
          t: 'example', title: 'Вторая страница сотрудников',
          sql: 'SELECT FullName, Position\nFROM Employees\nORDER BY FullName\nOFFSET 10 ROWS\nFETCH NEXT 10 ROWS ONLY;'
        },
        {
          t: 'quiz', id: 'm02l2q1',
          q: '<p>Какой запрос вернёт 3 самые <b>новые</b> операции?</p>',
          options: ['<code>SELECT TOP (3) * FROM Transactions</code>', '<code>SELECT TOP (3) * FROM Transactions ORDER BY TransDate</code>', '<code>SELECT TOP (3) * FROM Transactions ORDER BY TransDate DESC</code>', '<code>SELECT * FROM Transactions ORDER BY TransDate DESC TOP (3)</code>'],
          answer: 2,
          explain: 'Новые — с самой поздней датой: сортируем по убыванию даты и берём первые 3. TOP пишется сразу после SELECT.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm02l2t1', title: 'Топ-5 остатков',
          text: '<p>Выведите 5 счетов с наибольшим остатком: номер счёта и остаток (<code>AccountNumber</code>, <code>Balance</code>), от большего к меньшему.</p>',
          solution: 'SELECT TOP (5) AccountNumber, Balance\nFROM Accounts\nORDER BY Balance DESC;',
          check: { order: [[1, 'desc']] },
          hint: '<code>TOP (5)</code> + <code>ORDER BY Balance DESC</code>.',
          wrong: ['SELECT TOP (5) AccountNumber, Balance FROM Accounts;', 'SELECT TOP (5) AccountNumber, Balance FROM Accounts ORDER BY Balance;']
        },
        {
          t: 'task', id: 'm02l2t2', title: 'Самые молодые',
          text: '<p>Выведите трёх самых молодых клиентов: фамилия, имя, дата рождения. Сначала самый молодой.</p>',
          solution: 'SELECT TOP (3) LastName, FirstName, BirthDate\nFROM Clients\nORDER BY BirthDate DESC;',
          check: { order: [[2, 'desc']] },
          hint: 'Самый молодой родился позже всех — сортировка по дате рождения по убыванию.'
        },
        {
          t: 'quiz', id: 'm02l2t3',
          q: '<p>Оклады: 450, 320, 320, 300 (тыс.). Сколько строк вернёт <code>SELECT TOP (2) WITH TIES ... ORDER BY Salary DESC</code>?</p>',
          options: ['1', '2', '3', '4'],
          answer: 2,
          explain: 'Вторая строка — 320, и следующая тоже 320 («ничья»), поэтому она добавляется. 300 уже отличается.'
        },
        {
          t: 'task', id: 'm02l2t4', title: 'Вторая страница',
          text: '<p>Список кредитов отсортирован по <code>LoanID</code>. Выведите <b>вторую страницу</b> по 15 строк (строки с 16-й по 30-ю): <code>LoanID</code>, <code>Amount</code>, <code>Status</code>.</p>',
          solution: 'SELECT LoanID, Amount, Status\nFROM Loans\nORDER BY LoanID\nOFFSET 15 ROWS\nFETCH NEXT 15 ROWS ONLY;',
          check: { order: [[0, 'asc']] },
          hint: 'Пропустить 15 строк (первая страница) и взять следующие 15.'
        }
      ]
    },
    {
      id: 'm02l3', title: 'Уникальные значения: DISTINCT', minutes: 8,
      steps: [
        {
          t: 'text', title: 'Убираем повторы',
          html: '<p>В каких городах живут наши клиенты? Если написать <code>SELECT City FROM Clients</code>, получим 220 строк с повторами. Слово <code>DISTINCT</code> после SELECT оставляет только <b>уникальные</b> значения — как «Удалить дубликаты» в Excel.</p>' +
            '<pre class="sql">SELECT DISTINCT City\nFROM Clients\nORDER BY City;</pre>'
        },
        {
          t: 'example', title: 'Города клиентов',
          sql: 'SELECT DISTINCT City\nFROM Clients\nORDER BY City;'
        },
        {
          t: 'text', title: 'DISTINCT работает по всей строке',
          html: '<p>Если после DISTINCT несколько столбцов, уникальной должна быть <b>вся комбинация</b>, а не каждый столбец по отдельности:</p>' +
            '<pre class="sql">SELECT DISTINCT City, ClientType\nFROM Clients;</pre>' +
            '<p>Здесь «Бишкек + Физлицо» и «Бишкек + ИП» — две разные строки. DISTINCT пишется <b>один раз</b> сразу после SELECT и относится ко всем столбцам.</p>' +
            '<div class="note">С DISTINCT в ORDER BY можно использовать только столбцы из списка SELECT — иначе ошибка 145.</div>'
        },
        {
          t: 'example', title: 'Сочетания валюты и типа счёта',
          sql: 'SELECT DISTINCT Currency, AccountType\nFROM Accounts\nORDER BY Currency, AccountType;'
        }
      ],
      training: [
        {
          t: 'task', id: 'm02l3t1', title: 'Каналы операций',
          text: '<p>Через какие каналы проходят операции? Выведите список уникальных значений столбца <code>Channel</code> из <code>Transactions</code>, отсортированный по алфавиту.</p>',
          solution: 'SELECT DISTINCT Channel\nFROM Transactions\nORDER BY Channel;',
          check: { order: [[0, 'asc']] },
          hint: '<code>SELECT DISTINCT Channel ...</code>',
          wrong: ['SELECT Channel FROM Transactions ORDER BY Channel;']
        },
        {
          t: 'task', id: 'm02l3t2', title: 'Валюта и тип',
          text: '<p>Выведите все уникальные сочетания валюты и типа счёта (<code>Currency</code>, <code>AccountType</code>) из <code>Accounts</code>.</p>',
          solution: 'SELECT DISTINCT Currency, AccountType\nFROM Accounts;',
          hint: 'Один DISTINCT, два столбца.'
        },
        {
          t: 'quiz', id: 'm02l3t3',
          q: '<p>Что делает <code>SELECT DISTINCT City, Gender FROM Clients</code>?</p>',
          options: ['Убирает повторы только в City', 'Убирает повторы отдельно в каждом столбце', 'Оставляет уникальные пары «город + пол»', 'Возвращает ошибку: DISTINCT допустим только для одного столбца'],
          answer: 2,
          explain: 'DISTINCT сравнивает строки целиком. Пара (Бишкек, М) и (Бишкек, Ж) — разные строки.'
        }
      ]
    }
  ],
  homework: [
    {
      id: 'm02hw1', title: 'Последние операции',
      text: '<p>Выведите 10 самых последних операций: <code>TransactionID</code>, <code>TransDate</code>, <code>TransType</code>, <code>Amount</code> — сначала самые свежие.</p>',
      solution: 'SELECT TOP (10) TransactionID, TransDate, TransType, Amount\nFROM Transactions\nORDER BY TransDate DESC;',
      check: { order: [[1, 'desc']] },
      hint: 'TOP + сортировка по дате по убыванию.'
    },
    {
      id: 'm02hw2', title: 'Справочник типов операций',
      text: '<p>Составьте справочник: все уникальные типы операций (<code>TransType</code>) в алфавитном порядке.</p>',
      solution: 'SELECT DISTINCT TransType\nFROM Transactions\nORDER BY TransType;',
      check: { order: [[0, 'asc']] }
    },
    {
      id: 'm02hw3', title: 'Самые высокие оклады с «ничьими»',
      text: '<p>Выведите ФИО и оклад двух самых высокооплачиваемых сотрудников. Если у кого-то оклад такой же, как у второго в списке, — его тоже нужно показать.</p>',
      solution: 'SELECT TOP (2) WITH TIES FullName, Salary\nFROM Employees\nORDER BY Salary DESC;',
      check: { order: [[1, 'desc']] },
      hint: 'Это ровно то, что делает <code>WITH TIES</code>.',
      wrong: ['SELECT TOP (2) FullName, Salary FROM Employees ORDER BY Salary DESC;']
    },
    {
      id: 'm02hw4', title: 'Третья страница кредитов',
      text: '<p>Кредиты показываются в интерфейсе страницами по 20 строк: сначала самые новые по дате выдачи (<code>IssueDate</code>), при одинаковой дате — по возрастанию <code>LoanID</code>. Выведите <b>третью страницу</b>: <code>LoanID</code>, <code>IssueDate</code>, <code>Amount</code>.</p>',
      solution: 'SELECT LoanID, IssueDate, Amount\nFROM Loans\nORDER BY IssueDate DESC, LoanID\nOFFSET 40 ROWS\nFETCH NEXT 20 ROWS ONLY;',
      check: { order: [[1, 'desc'], [0, 'asc']] },
      hint: 'Третья страница: пропустить 2 × 20 = 40 строк.'
    },
    {
      id: 'm02hw5', title: 'Города и типы клиентов',
      text: '<p>Выведите уникальные сочетания города и типа клиента (<code>City</code>, <code>ClientType</code>), отсортированные по городу, а внутри города — по типу.</p>',
      solution: 'SELECT DISTINCT City, ClientType\nFROM Clients\nORDER BY City, ClientType;',
      check: { order: [[0, 'asc'], [1, 'asc']] }
    }
  ]
});
