/* ============================================================
   НАСТРОЙКИ КУРСА
   Здесь можно:
   - включить последовательное открытие модулей (lockModules);
   - поменять начисление XP;
   - добавить/убрать модуль: впишите имя файла в moduleFiles
     и положите файл в папку content/modules.
   ============================================================ */
window.COURSE = {
  title: 'SELECT с нуля',
  subtitle: 'Курс T-SQL (Microsoft SQL Server) для аналитиков и составителей отчётов: только чтение данных — от первого запроса до оконных функций.',

  config: {
    lockModules: false,          // true — модуль открывается после уроков предыдущего
    solutionAfterTries: 3,       // после скольких неудачных проверок подсвечивать кнопку «Решение»
    xp: {
      quiz: 5,                   // верный ответ на вопрос
      task: 10,                  // задача в уроке
      hw: 25,                    // задача домашнего задания
      lesson: 20,                // бонус за пройденный урок
      module: 100,               // бонус за завершённый модуль
      trainer: [10, 15, 20, 30, 40] // задача тренажёра по уровням 1–5
    }
  },

  // Порядок подключения файлов модулей (папка content/modules)
  moduleFiles: [
    'm01-vvedenie.js',
    'm02-sortirovka.js',
    'm03-where.js',
    'm04-null.js',
    'm05-tipy-stroki.js',
    'm06-daty.js',
    'm07-case.js',
    'm08-gruppirovka.js',
    'm09-join.js',
    'm10-podzaprosy.js',
    'm11-mnozhestva.js',
    'm12-cte-temp.js',
    'm13-okna.js',
    'm14-otchety.js'
  ],

  modules: [],
  addModule: function (m) { this.modules.push(m); },

  trainer: {
    levels: [
      { name: 'Разминка', desc: 'SELECT, WHERE, ORDER BY, TOP' },
      { name: 'Базовый', desc: 'Функции, NULL, даты, CASE' },
      { name: 'Средний', desc: 'Группировка и соединения' },
      { name: 'Продвинутый', desc: 'Подзапросы, CTE, множества' },
      { name: 'Эксперт', desc: 'Оконные функции и сложные отчёты' }
    ],
    tasks: [],
    add: function (list) { this.tasks = this.tasks.concat(list); }
  },

  achievements: [
    { id: 'first_run', icon: '🚀', title: 'Первый запрос', desc: 'Выполнить свой первый запрос', test: function (s) { return s.runs >= 1; } },
    { id: 'first_task', icon: '✅', title: 'Первое решение', desc: 'Решить первую задачу', test: function (s) { return s.solved >= 1; } },
    { id: 'solved25', icon: '🧩', title: 'Набираю обороты', desc: 'Решить 25 задач', test: function (s) { return s.solved >= 25; } },
    { id: 'solved100', icon: '🏋️', title: 'Сотня', desc: 'Решить 100 задач', test: function (s) { return s.solved >= 100; } },
    { id: 'clean5', icon: '🎯', title: 'Снайпер', desc: '5 задач подряд с первой попытки', test: function (s) { return s.firstTryStreak >= 5; } },
    { id: 'persist', icon: '💪', title: 'Работа над ошибками', desc: 'Решить задачу после трёх и более неудачных попыток', test: function (s) { return s.persist; } },
    { id: 'streak3', icon: '🔥', title: 'Три дня подряд', desc: 'Заниматься 3 дня подряд', test: function (s) { return s.streak >= 3; } },
    { id: 'streak7', icon: '📅', title: 'Неделя без пропусков', desc: 'Заниматься 7 дней подряд', test: function (s) { return s.streak >= 7; } },
    { id: 'mod1', icon: '🌱', title: 'Первые шаги', desc: 'Завершить модуль 1', test: function (s) { return s.modDone(1); } },
    { id: 'mod8', icon: '📊', title: 'Сводные таблицы', desc: 'Завершить модуль о группировке', test: function (s) { return s.modDone(8); } },
    { id: 'mod9', icon: '🔗', title: 'Мастер соединений', desc: 'Завершить модуль о JOIN', test: function (s) { return s.modDone(9); } },
    { id: 'mod13', icon: '🪟', title: 'Оконный мастер', desc: 'Завершить модуль об оконных функциях', test: function (s) { return s.modDone(13); } },
    { id: 'half', icon: '⛰️', title: 'Половина пути', desc: 'Завершить половину модулей', test: function (s) { return s.modulesDone >= Math.ceil(s.modulesAll / 2); } },
    { id: 'grad', icon: '🎓', title: 'Выпускник', desc: 'Завершить все модули курса', test: function (s) { return s.modulesDone >= s.modulesAll; } },
    { id: 'hw_all', icon: '📚', title: 'Отличник', desc: 'Решить все домашние задания', test: function (s) { return s.hwAll > 0 && s.hwDone >= s.hwAll; } },
    { id: 'tr10', icon: '🏃', title: 'Тренируюсь', desc: 'Решить 10 задач тренажёра', test: function (s) { return s.trainer >= 10; } },
    { id: 'tr_l5', icon: '🧠', title: 'Эксперт', desc: 'Решить 5 задач тренажёра уровня «Эксперт»', test: function (s) { return s.trainerLevel(5) >= 5; } },
    { id: 'tr_all', icon: '🏆', title: 'Чемпион тренажёра', desc: 'Решить все задачи тренажёра', test: function (s) { return s.trainerAll > 0 && s.trainer >= s.trainerAll; } },
    { id: 'sandbox20', icon: '🔬', title: 'Исследователь', desc: 'Выполнить 20 запросов в песочнице', test: function (s) { return s.sandboxRuns >= 20; } },
    { id: 'xp1000', icon: '⭐', title: 'Тысяча очков', desc: 'Набрать 1000 XP', test: function (s) { return s.xp >= 1000; } }
  ]
};
