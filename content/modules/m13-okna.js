/* Модуль 13. Оконные функции */
COURSE.addModule({
  id: 'm13', num: 13,
  title: 'Оконные функции',
  short: 'OVER и PARTITION BY, доля от итога, ROW_NUMBER/RANK, топ-N в группе, LAG/LEAD, нарастающий итог и скользящее среднее.',
  goal: '<p>Оконные функции — главный инструмент аналитика: считают итоги, ранги и изменения «по соседним строкам», <b>не схлопывая</b> строки, как GROUP BY. Многие задачи, для которых раньше нужны были подзапросы, решаются одной строкой.</p>',
  read: [['Документация Microsoft: предложение OVER', 'https://learn.microsoft.com/ru-ru/sql/t-sql/queries/select-over-clause-transact-sql']],
  lessons: [
    {
      id: 'm13l1', title: 'OVER(): итог рядом с каждой строкой', minutes: 15,
      steps: [
        {
          t: 'text', title: 'Зачем нужны окна',
          html: '<p>Задача: вывести каждого сотрудника с окладом <b>и</b> средним окладом по его филиалу — чтобы сравнить. GROUP BY не подходит: он схлопнет сотрудников в одну строку на филиал.</p>' +
            '<p>Оконная функция считает агрегат по группе строк («окну»), но <b>оставляет каждую строку на месте</b>, добавляя результат отдельным столбцом:</p>' +
            '<pre class="sql">SELECT FullName, BranchID, Salary,\n       AVG(Salary) OVER (PARTITION BY BranchID) AS BranchAvg\nFROM Employees;</pre>' +
            '<ul><li><code>OVER ()</code> — окно = все строки результата.</li><li><code>OVER (PARTITION BY BranchID)</code> — отдельное окно для каждого филиала (как группа в GROUP BY, но без схлопывания).</li></ul>'
        },
        {
          t: 'example', title: 'Оклад и средний по филиалу',
          sql: 'SELECT FullName, BranchID, Salary,\n       AVG(Salary)  OVER (PARTITION BY BranchID) AS BranchAvg,\n       COUNT(*)     OVER (PARTITION BY BranchID) AS BranchStaff,\n       SUM(Salary)  OVER ()                      AS TotalPayroll\nFROM Employees\nORDER BY BranchID, Salary DESC;'
        },
        {
          t: 'text', title: 'Доля от итога',
          html: '<p>Самое частое применение — доля строки в итоге группы:</p>' +
            '<pre class="sql">CAST(100.0 * Salary / SUM(Salary) OVER (PARTITION BY BranchID) AS DECIMAL(5,2)) AS SharePct</pre>' +
            '<p>Оконные функции вычисляются на шаге SELECT — после WHERE, GROUP BY и HAVING. Значит, их можно применять <b>к результатам группировки</b>: <code>SUM(SUM(Amount)) OVER ()</code> — «итог по всем группам». Внутренний SUM — обычный агрегат по группе, внешний — оконный по всем строкам результата.</p>'
        },
        {
          t: 'example', title: 'Доля категорий в тратах',
          sql: "SELECT Category,\n       SUM(Amount) AS Total,\n       CAST(100.0 * SUM(Amount) / SUM(SUM(Amount)) OVER () AS DECIMAL(5,2)) AS SharePct\nFROM Transactions\nWHERE TransType = N'Оплата картой'\nGROUP BY Category\nORDER BY Total DESC;"
        },
        {
          t: 'quiz', id: 'm13l1q1',
          q: '<p>Чем <code>SUM(Amount) OVER (PARTITION BY AccountID)</code> отличается от <code>SUM(Amount) … GROUP BY AccountID</code>?</p>',
          options: ['Ничем', 'OVER оставляет все строки и приписывает каждой сумму её счёта; GROUP BY даёт одну строку на счёт', 'OVER работает только с датами', 'GROUP BY быстрее и всегда предпочтительнее'],
          answer: 1,
          explain: 'Суммы одинаковые, но форма результата разная: окно не схлопывает строки.'
        }
      ],
      training: [
        {
          t: 'task', id: 'm13l1t1', title: 'Средний оклад рядом',
          text: '<p>Выведите <code>FullName</code>, <code>BranchID</code>, <code>Salary</code> и средний оклад по филиалу сотрудника <code>BranchAvg</code>.</p>',
          solution: 'SELECT FullName, BranchID, Salary, AVG(Salary) OVER (PARTITION BY BranchID) AS BranchAvg\nFROM Employees;',
          check: { names: true, require: [['OVER', 'Используйте оконную функцию (OVER).']] }
        },
        {
          t: 'task', id: 'm13l1t2', title: 'Доля кредита в продукте',
          text: '<p>Для каждого кредита выведите <code>LoanID</code>, <code>ProductID</code>, <code>Amount</code> и долю суммы кредита в общей сумме кредитов того же продукта, в процентах с 2 знаками (<code>SharePct</code>, DECIMAL(5,2)).</p>',
          solution: 'SELECT LoanID, ProductID, Amount,\n       CAST(100.0 * Amount / SUM(Amount) OVER (PARTITION BY ProductID) AS DECIMAL(5,2)) AS SharePct\nFROM Loans;',
          check: { names: true }
        },
        {
          t: 'task', id: 'm13l1t3', title: 'Доля городов (окном)',
          text: '<p>Выведите для каждого города число клиентов (<code>Cnt</code>) и долю от всех клиентов (<code>SharePct</code>, DECIMAL(5,2)) — используйте оконную функцию поверх GROUP BY, без подзапроса.</p>',
          solution: 'SELECT City, COUNT(*) AS Cnt,\n       CAST(100.0 * COUNT(*) / SUM(COUNT(*)) OVER () AS DECIMAL(5,2)) AS SharePct\nFROM Clients\nGROUP BY City;',
          check: { names: true, require: [['OVER', 'Используйте оконную функцию: SUM(COUNT(*)) OVER ().']] }
        },
        {
          t: 'quiz', id: 'm13l1t4',
          q: '<p>На каком шаге выполнения запроса вычисляются оконные функции?</p>',
          options: ['FROM', 'WHERE', 'GROUP BY', 'SELECT (после HAVING, до ORDER BY)'],
          answer: 3,
          explain: 'Поэтому окна видят уже отфильтрованные и сгруппированные строки, а в WHERE их использовать нельзя.'
        }
      ]
    },
    {
      id: 'm13l2', title: 'Ранжирование и топ-N в группе', minutes: 18,
      steps: [
        {
          t: 'text', title: 'Нумерация и ранги',
          html: '<p>Функции ранжирования требуют <code>ORDER BY</code> внутри OVER — по нему определяется порядок:</p>' +
            '<table><tr><th>Оклад</th><th>ROW_NUMBER()</th><th>RANK()</th><th>DENSE_RANK()</th></tr>' +
            '<tr><td>450</td><td>1</td><td>1</td><td>1</td></tr><tr><td>320</td><td>2</td><td>2</td><td>2</td></tr><tr><td>320</td><td>3</td><td>2</td><td>2</td></tr><tr><td>300</td><td>4</td><td>4</td><td>3</td></tr></table>' +
            '<ul><li><code>ROW_NUMBER()</code> — просто номер строки, при равенстве номера всё равно разные (кто первый — не гарантировано, добавляйте второй столбец сортировки).</li>' +
            '<li><code>RANK()</code> — места как в спорте: равные делят место, следующее пропускается.</li>' +
            '<li><code>DENSE_RANK()</code> — без пропусков.</li>' +
            '<li><code>NTILE(4)</code> — делит строки на 4 примерно равные группы (квартили).</li></ul>'
        },
        {
          t: 'example', title: 'Рейтинг окладов',
          sql: 'SELECT FullName, Salary,\n       ROW_NUMBER() OVER (ORDER BY Salary DESC, EmployeeID) AS RowNum,\n       RANK()       OVER (ORDER BY Salary DESC) AS Rnk,\n       DENSE_RANK() OVER (ORDER BY Salary DESC) AS DenseRnk,\n       NTILE(4)     OVER (ORDER BY Salary DESC) AS Quartile\nFROM Employees\nORDER BY Salary DESC, EmployeeID;'
        },
        {
          t: 'text', title: 'Топ-N в каждой группе',
          html: '<p>«Три самые крупные покупки в каждой категории». Нумеруем внутри каждой категории и оставляем номера 1–3. Но фильтровать по оконной функции в WHERE <b>нельзя</b> — WHERE выполняется раньше SELECT. Поэтому оборачиваем запрос в CTE:</p>' +
            '<pre class="sql">WITH R AS (\n    SELECT Category, TransactionID, Amount,\n           ROW_NUMBER() OVER (PARTITION BY Category\n                              ORDER BY Amount DESC, TransactionID) AS rn\n    FROM Transactions\n    WHERE TransType = N\'Оплата картой\'\n)\nSELECT * FROM R WHERE rn <= 3;</pre>'
        },
        {
          t: 'example', title: 'Так нельзя — ошибка 4108',
          sql: "SELECT Category, Amount,\n       ROW_NUMBER() OVER (PARTITION BY Category ORDER BY Amount DESC) AS rn\nFROM Transactions\nWHERE ROW_NUMBER() OVER (PARTITION BY Category ORDER BY Amount DESC) <= 3;",
          expectError: true
        },
        {
          t: 'example', title: 'А так — правильно',
          sql: "WITH R AS (\n    SELECT Category, TransactionID, Amount,\n           ROW_NUMBER() OVER (PARTITION BY Category ORDER BY Amount DESC, TransactionID) AS rn\n    FROM Transactions\n    WHERE TransType = N'Оплата картой'\n)\nSELECT Category, rn, TransactionID, Amount\nFROM R\nWHERE rn <= 3\nORDER BY Category, rn;"
        },
        {
          t: 'text', title: 'Последняя запись по ключу (удаление дублей)',
          html: '<p>Тот же приём находит «последнюю запись по каждому объекту»: последнюю операцию счёта, последний курс валюты. Нумеруем внутри объекта от новых к старым и берём <code>rn = 1</code>:</p>' +
            '<pre class="sql">ROW_NUMBER() OVER (PARTITION BY AccountID ORDER BY TransDate DESC, TransactionID DESC) AS rn\n…\nWHERE rn = 1</pre>' +
            '<p>Это стандартный способ «дедупликации» — убрать повторы, оставив одну, самую актуальную строку.</p>'
        }
      ],
      training: [
        {
          t: 'task', id: 'm13l2t1', title: 'Ранг внутри продукта',
          text: '<p>Выведите <code>LoanID</code>, <code>ProductID</code>, <code>Amount</code> и плотный ранг кредита по сумме внутри его продукта (<code>Rnk</code>; самый крупный — 1, равные суммы — один ранг, без пропусков).</p>',
          solution: 'SELECT LoanID, ProductID, Amount,\n       DENSE_RANK() OVER (PARTITION BY ProductID ORDER BY Amount DESC) AS Rnk\nFROM Loans;',
          check: { names: true },
          wrong: ['SELECT LoanID, ProductID, Amount, RANK() OVER (PARTITION BY ProductID ORDER BY Amount DESC) AS Rnk FROM Loans;']
        },
        {
          t: 'task', id: 'm13l2t2', title: 'Топ-3 покупки в категории',
          text: "<p>Для оплат картой 2026 года выведите по 3 самые крупные покупки в каждой категории: <code>Category</code>, <code>TransactionID</code>, <code>Amount</code>. При равных суммах выше та, у которой меньше TransactionID.</p>",
          solution: "WITH R AS (\n    SELECT Category, TransactionID, Amount,\n           ROW_NUMBER() OVER (PARTITION BY Category ORDER BY Amount DESC, TransactionID) AS rn\n    FROM Transactions\n    WHERE TransType = N'Оплата картой' AND TransDate >= '20260101' AND TransDate < '20270101'\n)\nSELECT Category, TransactionID, Amount\nFROM R\nWHERE rn <= 3;"
        },
        {
          t: 'task', id: 'm13l2t3', title: 'Квартили по остаткам',
          text: "<p>Разделите сомовые счета на 4 группы по остатку (1 — самые большие остатки): <code>AccountID</code>, <code>Balance</code>, <code>Quartile</code>. При равных остатках порядок — по AccountID.</p>",
          solution: "SELECT AccountID, Balance, NTILE(4) OVER (ORDER BY Balance DESC, AccountID) AS Quartile\nFROM Accounts\nWHERE Currency = 'KGS';",
          check: { names: true }
        },
        {
          t: 'task', id: 'm13l2t4', title: 'Последняя операция счёта',
          text: '<p>Для каждого счёта, по которому были операции, выведите его последнюю операцию: <code>AccountID</code>, <code>TransactionID</code>, <code>TransDate</code>, <code>Amount</code>. Используйте ROW_NUMBER (при одинаковом времени последней считается операция с большим TransactionID).</p>',
          solution: 'WITH R AS (\n    SELECT AccountID, TransactionID, TransDate, Amount,\n           ROW_NUMBER() OVER (PARTITION BY AccountID ORDER BY TransDate DESC, TransactionID DESC) AS rn\n    FROM Transactions\n)\nSELECT AccountID, TransactionID, TransDate, Amount\nFROM R\nWHERE rn = 1;',
          check: { require: [['ROW_NUMBER', 'Используйте ROW_NUMBER.']] }
        },
        {
          t: 'quiz', id: 'm13l2t5',
          q: '<p>Суммы: 100, 90, 90, 80. Какой RANK() получит 80 при сортировке по убыванию?</p>',
          options: ['3', '4', '2', '1'],
          answer: 1,
          explain: 'Ранги: 1, 2, 2, 4 — место 3 пропущено, потому что двое разделили второе. У DENSE_RANK было бы 3.'
        }
      ]
    },
    {
      id: 'm13l3', title: 'Соседние строки: LAG, LEAD, FIRST_VALUE', minutes: 16,
      steps: [
        {
          t: 'text', title: 'Взгляд на предыдущую и следующую строку',
          html: '<ul><li><code>LAG(x)</code> — значение x из <b>предыдущей</b> строки окна (по ORDER BY).</li><li><code>LEAD(x)</code> — из <b>следующей</b>.</li>' +
            '<li><code>LAG(x, 2)</code> — на 2 строки назад; <code>LAG(x, 1, 0)</code> — с подстановкой 0, если предыдущей строки нет (иначе NULL).</li></ul>' +
            '<p>Так считают изменения «месяц к месяцу» без соединения таблицы с самой собой.</p>'
        },
        {
          t: 'example', title: 'Динамика по месяцам',
          sql: "WITH M AS (\n    SELECT MONTH(TransDate) AS Mon, SUM(Amount) AS Total\n    FROM Transactions\n    WHERE Status = N'Проведена' AND TransDate >= '20260101' AND TransDate < '20270101'\n    GROUP BY MONTH(TransDate)\n)\nSELECT Mon, Total,\n       LAG(Total) OVER (ORDER BY Mon) AS PrevTotal,\n       Total - LAG(Total) OVER (ORDER BY Mon) AS Diff,\n       CAST(100.0 * (Total - LAG(Total) OVER (ORDER BY Mon)) / LAG(Total) OVER (ORDER BY Mon) AS DECIMAL(10,2)) AS ChangePct\nFROM M\nORDER BY Mon;"
        },
        {
          t: 'example', title: 'Дней между операциями',
          sql: 'SELECT AccountID, TransDate,\n       LAG(TransDate) OVER (PARTITION BY AccountID ORDER BY TransDate) AS PrevDate,\n       DATEDIFF(day, LAG(TransDate) OVER (PARTITION BY AccountID ORDER BY TransDate), TransDate) AS DaysSincePrev\nFROM Transactions\nWHERE AccountID IN (1001, 1002)\nORDER BY AccountID, TransDate;',
          after: '<p>PARTITION BY AccountID: для первой операции каждого счёта предыдущей нет — NULL. LAG не «перепрыгивает» на чужой счёт.</p>'
        },
        {
          t: 'text', title: 'FIRST_VALUE и ловушка LAST_VALUE',
          html: '<p><code>FIRST_VALUE(x)</code> — первое значение в окне, <code>LAST_VALUE(x)</code> — последнее. С FIRST_VALUE всё интуитивно, а с LAST_VALUE — ловушка: если в OVER есть ORDER BY, а рамка не указана, окном считается «от начала до <b>текущей</b> строки». Последняя строка такого окна — сама текущая строка!</p>' +
            '<pre class="sql">LAST_VALUE(Amount) OVER (PARTITION BY AccountID ORDER BY TransDate\n                         ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING)</pre>' +
            '<p>Рамки разберём в следующем уроке. Простое правило: для LAST_VALUE всегда указывайте рамку до конца окна — или используйте FIRST_VALUE с обратной сортировкой.</p>'
        },
        {
          t: 'example', title: 'Посмотрите на ловушку',
          sql: 'SELECT AccountID, TransDate, Amount,\n       FIRST_VALUE(Amount) OVER (PARTITION BY AccountID ORDER BY TransDate) AS FirstAmt,\n       LAST_VALUE(Amount)  OVER (PARTITION BY AccountID ORDER BY TransDate) AS LastAmt_Wrong,\n       LAST_VALUE(Amount)  OVER (PARTITION BY AccountID ORDER BY TransDate\n                                 ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) AS LastAmt_Right\nFROM Transactions\nWHERE AccountID = 1001\nORDER BY TransDate;'
        }
      ],
      training: [
        {
          t: 'task', id: 'm13l3t1', title: 'Изменение курса доллара',
          text: "<p>Для курса USD за октябрь 2026 выведите <code>RateDate</code>, <code>Rate</code>, курс предыдущего рабочего дня <code>PrevRate</code> и изменение <code>Diff</code> (Rate − PrevRate). Для первого дня октября предыдущий курс берите из октябрьских же данных (то есть NULL). Сортировка по дате.</p>",
          solution: "SELECT RateDate, Rate,\n       LAG(Rate) OVER (ORDER BY RateDate) AS PrevRate,\n       Rate - LAG(Rate) OVER (ORDER BY RateDate) AS Diff\nFROM CurrencyRates\nWHERE Currency = 'USD' AND RateDate >= '20261001' AND RateDate < '20261101'\nORDER BY RateDate;",
          check: { names: true, ordered: true }
        },
        {
          t: 'task', id: 'm13l3t2', title: 'Рост к прошлому месяцу',
          text: "<p>По проведённым операциям 2026 года выведите <code>Mon</code> (номер месяца), <code>Total</code> и изменение к прошлому месяцу в процентах <code>ChangePct</code> (DECIMAL(10,2); для января — NULL). Сортировка по месяцу.</p>",
          solution: "WITH M AS (\n    SELECT MONTH(TransDate) AS Mon, SUM(Amount) AS Total\n    FROM Transactions\n    WHERE Status = N'Проведена' AND TransDate >= '20260101' AND TransDate < '20270101'\n    GROUP BY MONTH(TransDate)\n)\nSELECT Mon, Total,\n       CAST(100.0 * (Total - LAG(Total) OVER (ORDER BY Mon)) / LAG(Total) OVER (ORDER BY Mon) AS DECIMAL(10,2)) AS ChangePct\nFROM M\nORDER BY Mon;",
          check: { names: true, ordered: true }
        },
        {
          t: 'task', id: 'm13l3t3', title: 'Первая операция счёта',
          text: '<p>Для операций счетов 1001 и 1002 выведите <code>AccountID</code>, <code>TransactionID</code>, <code>Amount</code> и сумму первой (самой ранней) операции этого счёта <code>FirstAmount</code>.</p>',
          solution: 'SELECT AccountID, TransactionID, Amount,\n       FIRST_VALUE(Amount) OVER (PARTITION BY AccountID ORDER BY TransDate, TransactionID) AS FirstAmount\nFROM Transactions\nWHERE AccountID IN (1001, 1002);',
          check: { names: true }
        },
        {
          t: 'quiz', id: 'm13l3t4',
          q: '<p>Почему <code>LAST_VALUE(x) OVER (ORDER BY d)</code> возвращает значение текущей строки?</p>',
          options: ['Это ошибка SQL Server', 'Рамка по умолчанию — от начала до текущей строки, и последняя строка рамки — текущая', 'LAST_VALUE всегда так работает', 'Нужен PARTITION BY'],
          answer: 1,
          explain: 'Укажите рамку ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING.'
        }
      ]
    },
    {
      id: 'm13l4', title: 'Нарастающий итог, скользящее среднее и рамки', minutes: 18,
      steps: [
        {
          t: 'widget', title: 'Рамка окна', w: 'windowViz',
          html: '<p>У агрегатных оконных функций есть <b>рамка</b> — какие именно строки окна участвуют в расчёте для текущей строки. Выберите функцию и щёлкните по строке:</p>'
        },
        {
          t: 'text', title: 'Синтаксис рамки',
          html: '<pre class="sql">SUM(x) OVER (PARTITION BY … ORDER BY … ROWS BETWEEN &lt;начало&gt; AND &lt;конец&gt;)</pre>' +
            '<table><tr><th>Граница</th><th>Значение</th></tr>' +
            '<tr><td><code>UNBOUNDED PRECEDING</code></td><td>с первой строки окна</td></tr>' +
            '<tr><td><code>N PRECEDING</code></td><td>N строк назад</td></tr>' +
            '<tr><td><code>CURRENT ROW</code></td><td>текущая строка</td></tr>' +
            '<tr><td><code>N FOLLOWING</code></td><td>N строк вперёд</td></tr>' +
            '<tr><td><code>UNBOUNDED FOLLOWING</code></td><td>до последней строки окна</td></tr></table>' +
            '<ul><li>Нарастающий итог: <code>ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW</code> (коротко: <code>ROWS UNBOUNDED PRECEDING</code>).</li>' +
            '<li>Скользящее среднее за 3 периода: <code>ROWS BETWEEN 2 PRECEDING AND CURRENT ROW</code>.</li></ul>'
        },
        {
          t: 'text', title: 'Ловушка рамки по умолчанию: RANGE',
          html: '<p>Если указать ORDER BY, но не указать рамку, SQL Server использует <code>RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW</code>. Отличие RANGE от ROWS: в рамку попадают все строки с <b>таким же значением</b> сортировки («ничьи»). При одинаковых датах нарастающий итог «прыгает» сразу на несколько строк. Кроме того, RANGE работает заметно медленнее.</p>' +
            '<div class="key"><b>Правило</b>Для нарастающих итогов всегда пишите рамку явно: <code>ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW</code>.</div>' +
            '<div class="note">В SQL Server RANGE поддерживает только UNBOUNDED и CURRENT ROW: окна вида «±10 000 по значению» (RANGE BETWEEN 10000 PRECEDING…) и режим GROUPS есть в PostgreSQL, но не в T-SQL.</div>'
        },
        {
          t: 'example', title: 'ROWS против RANGE при одинаковых значениях',
          sql: 'SELECT FullName, Salary,\n       SUM(Salary) OVER (ORDER BY Salary) AS Range_Default,\n       SUM(Salary) OVER (ORDER BY Salary ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS Rows_Explicit\nFROM Employees\nORDER BY Salary;',
          after: '<p>Посмотрите на сотрудников с одинаковыми окладами (65 000, 70 000…): в столбце Range_Default у них одинаковый «нарастающий» итог.</p>'
        },
        {
          t: 'example', title: 'Нарастающий итог и скользящее среднее',
          sql: "WITH D AS (\n    SELECT CAST(TransDate AS DATE) AS Day, SUM(Amount) AS Total\n    FROM Transactions\n    WHERE TransDate >= '20261001' AND TransDate < '20261101'\n    GROUP BY CAST(TransDate AS DATE)\n)\nSELECT Day, Total,\n       SUM(Total) OVER (ORDER BY Day ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS RunningTotal,\n       CAST(AVG(Total) OVER (ORDER BY Day ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) AS DECIMAL(18,2)) AS MovingAvg7\nFROM D\nORDER BY Day;"
        }
      ],
      training: [
        {
          t: 'task', id: 'm13l4t1', title: 'Выдачи с начала года',
          text: "<p>Для кредитов, выданных в 2026 году, выведите <code>LoanID</code>, <code>IssueDate</code>, <code>Amount</code> и нарастающую сумму выдач с начала года <code>Cumulative</code> в порядке даты выдачи (при одной дате — по LoanID).</p>",
          solution: "SELECT LoanID, IssueDate, Amount,\n       SUM(Amount) OVER (ORDER BY IssueDate, LoanID ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS Cumulative\nFROM Loans\nWHERE IssueDate >= '20260101' AND IssueDate < '20270101';",
          check: { names: true }
        },
        {
          t: 'task', id: 'm13l4t2', title: 'Скользящее среднее за 3 месяца',
          text: "<p>По проведённым операциям 2026 года выведите <code>Mon</code>, <code>Total</code> и скользящее среднее за текущий и два предыдущих месяца <code>Avg3</code> (DECIMAL(18,2)). Сортировка по месяцу.</p>",
          solution: "WITH M AS (\n    SELECT MONTH(TransDate) AS Mon, SUM(Amount) AS Total\n    FROM Transactions\n    WHERE Status = N'Проведена' AND TransDate >= '20260101' AND TransDate < '20270101'\n    GROUP BY MONTH(TransDate)\n)\nSELECT Mon, Total,\n       CAST(AVG(Total) OVER (ORDER BY Mon ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS DECIMAL(18,2)) AS Avg3\nFROM M\nORDER BY Mon;",
          check: { names: true, ordered: true }
        },
        {
          t: 'quiz', id: 'm13l4t3',
          q: '<p>Какая рамка используется по умолчанию, если в OVER есть ORDER BY, а рамка не указана?</p>',
          options: ['ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING', 'RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW', 'ROWS BETWEEN 1 PRECEDING AND CURRENT ROW', 'Рамки нет — ошибка'],
          answer: 1,
          explain: 'Именно поэтому SUM(…) OVER (ORDER BY …) даёт нарастающий итог, а строки с одинаковым ключом сортировки получают одинаковое значение.'
        }
      ]
    }
  ],
  homework: [
    {
      id: 'm13hw1', title: 'Отклонение от среднего по филиалу',
      text: '<p>Для каждого сотрудника выведите <code>FullName</code>, <code>BranchID</code>, <code>Salary</code> и отклонение его оклада от среднего по филиалу <code>DiffFromAvg</code> (Salary − среднее).</p>',
      solution: 'SELECT FullName, BranchID, Salary, Salary - AVG(Salary) OVER (PARTITION BY BranchID) AS DiffFromAvg\nFROM Employees;',
      check: { names: true }
    },
    {
      id: 'm13hw2', title: 'Крупнейший кредит каждого клиента',
      text: '<p>Для каждого клиента с кредитами выведите его самый крупный кредит: <code>ClientID</code>, <code>LoanID</code>, <code>Amount</code>. При равных суммах — кредит с меньшим LoanID.</p>',
      solution: 'WITH R AS (\n    SELECT ClientID, LoanID, Amount,\n           ROW_NUMBER() OVER (PARTITION BY ClientID ORDER BY Amount DESC, LoanID) AS rn\n    FROM Loans\n)\nSELECT ClientID, LoanID, Amount FROM R WHERE rn = 1;'
    },
    {
      id: 'm13hw3', title: 'Остаток по счёту после каждой операции',
      text: "<p>Для счёта <code>AccountID = 1001</code> выведите все проведённые операции в хронологическом порядке: <code>TransDate</code>, <code>TransType</code>, <code>SignedAmount</code> (приход «+»: «Пополнение» и «Перевод входящий», остальное «−») и нарастающий итог движения <code>RunningFlow</code>.</p>",
      solution: "WITH S AS (\n    SELECT TransDate, TransactionID, TransType,\n           CASE WHEN TransType IN (N'Пополнение', N'Перевод входящий') THEN Amount ELSE -Amount END AS SignedAmount\n    FROM Transactions\n    WHERE AccountID = 1001 AND Status = N'Проведена'\n)\nSELECT TransDate, TransType, SignedAmount,\n       SUM(SignedAmount) OVER (ORDER BY TransDate, TransactionID ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS RunningFlow\nFROM S\nORDER BY TransDate, TransactionID;",
      check: { names: true, ordered: true }
    },
    {
      id: 'm13hw4', title: 'Перерывы в активности',
      text: '<p>Найдите операции, перед которыми по тому же счёту не было операций больше 60 дней: <code>AccountID</code>, <code>TransDate</code>, <code>PrevDate</code>, <code>GapDays</code>.</p>',
      solution: 'WITH G AS (\n    SELECT AccountID, TransDate,\n           LAG(TransDate) OVER (PARTITION BY AccountID ORDER BY TransDate, TransactionID) AS PrevDate\n    FROM Transactions\n)\nSELECT AccountID, TransDate, PrevDate, DATEDIFF(day, PrevDate, TransDate) AS GapDays\nFROM G\nWHERE DATEDIFF(day, PrevDate, TransDate) > 60;',
      check: { names: true }
    },
    {
      id: 'm13hw5', title: 'Топ-2 клиента в каждом городе',
      text: "<p>По сумме остатков на сомовых счетах выведите двух самых состоятельных клиентов в каждом городе: <code>City</code>, <code>ClientID</code>, <code>TotalKGS</code>, <code>Rnk</code> (1 или 2). При равенстве — меньший ClientID выше.</p>",
      solution: "WITH T AS (\n    SELECT c.City, c.ClientID, SUM(a.Balance) AS TotalKGS\n    FROM Clients c JOIN Accounts a ON a.ClientID = c.ClientID\n    WHERE a.Currency = 'KGS'\n    GROUP BY c.City, c.ClientID\n),\nR AS (\n    SELECT City, ClientID, TotalKGS,\n           ROW_NUMBER() OVER (PARTITION BY City ORDER BY TotalKGS DESC, ClientID) AS Rnk\n    FROM T\n)\nSELECT City, ClientID, TotalKGS, Rnk FROM R WHERE Rnk <= 2;",
      check: { names: true }
    },
    {
      id: 'm13hw6', title: 'Медиана суммы покупки',
      text: "<p>Для каждой категории оплат картой выведите <code>Category</code> и медиану суммы покупки <code>Median</code> (DECIMAL(18,2)). Подсказка: <code>PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY Amount) OVER (PARTITION BY Category)</code> возвращает медиану для каждой строки — уберите повторы через DISTINCT.</p>",
      solution: "SELECT DISTINCT Category,\n       CAST(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY Amount) OVER (PARTITION BY Category) AS DECIMAL(18,2)) AS Median\nFROM Transactions\nWHERE TransType = N'Оплата картой';",
      check: { names: true },
      hint: 'Медиана — значение «посередине» отсортированного ряда. В отличие от среднего, её не искажают единичные огромные покупки.'
    }
  ]
});
