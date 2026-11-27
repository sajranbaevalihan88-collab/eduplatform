// Встроенные практические задачи PostgreSQL с автопроверкой для SQL Lab
// + локальный проверяльщик результатов (для встроенных задач и превью учителя).

export interface SqlTestSpec {
  label: string
  hidden?: boolean
  required_sql?: string
  expected_columns?: string[]
  expected_rows?: any[][]
  ordered?: boolean
  min_rows?: number
}

export interface SqlPracticeTask {
  id: string | number
  builtin?: boolean
  title: string
  difficulty?: 'Лёгкая' | 'Средняя' | 'Продвинутая'
  description: string
  schema_sql: string
  starter_code: string
  solution?: string
  max_score: number
  classroom?: number | null
  classroom_title?: string
  tests: SqlTestSpec[]
  public_tests?: SqlTestSpec[]
  tests_count?: number
  my_best_score?: number | null
  my_passed?: boolean
}

export interface SqlCheckResult {
  label: string
  hidden?: boolean
  passed: boolean
  detail: string
}

const SCHOOL_SCHEMA = `CREATE TABLE students (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL,
  klass TEXT NOT NULL
);

CREATE TABLE subjects (
  id    SERIAL PRIMARY KEY,
  title TEXT NOT NULL
);

CREATE TABLE grades (
  id         SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id),
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  grade      INTEGER NOT NULL CHECK (grade BETWEEN 2 AND 5)
);

INSERT INTO students (name, klass) VALUES
  ('Айдана', '9А'),
  ('Алихан', '9А'),
  ('Бектур', '9Б'),
  ('Мария',  '9Б'),
  ('Тимур',  '9А');

INSERT INTO subjects (title) VALUES
  ('Математика'),
  ('Информатика'),
  ('Физика');

INSERT INTO grades (student_id, subject_id, grade) VALUES
  (1, 1, 5), (1, 2, 5), (1, 3, 5),
  (2, 1, 4), (2, 2, 5), (2, 3, 4),
  (3, 1, 3), (3, 2, 4), (3, 3, 3),
  (4, 1, 5), (4, 2, 4), (4, 3, 5),
  (5, 1, 3), (5, 2, 3), (5, 3, 4);`

const SHOP_SCHEMA = `CREATE TABLE products (
  id       SERIAL PRIMARY KEY,
  name     TEXT NOT NULL,
  category TEXT NOT NULL,
  price    INTEGER NOT NULL,
  qty      INTEGER NOT NULL
);

INSERT INTO products (name, category, price, qty) VALUES
  ('Ноутбук',   'Электроника', 55000, 3),
  ('Мышь',      'Электроника', 1200,  15),
  ('Клавиатура','Электроника', 3500,  8),
  ('Тетрадь',   'Канцелярия',  80,    100),
  ('Рюкзак',    'Канцелярия',  2400,  10),
  ('Монитор',   'Электроника', 19000, 4);`

export const BUILTIN_SQL_TASKS: SqlPracticeTask[] = [
  {
    id: 'sql-builtin-1',
    builtin: true,
    title: 'Ученики класса 9А по алфавиту',
    difficulty: 'Лёгкая',
    description: 'Выведите имена (name) всех учеников из класса 9А, отсортированные по алфавиту (ORDER BY name).',
    schema_sql: SCHOOL_SCHEMA,
    starter_code: `-- Выведите только колонку name для класса '9А'\nSELECT name\nFROM students\nWHERE klass = '9А'\nORDER BY name;`,
    solution: `SELECT name FROM students WHERE klass = '9А' ORDER BY name;`,
    max_score: 100,
    tests: [
      { label: 'Используется фильтрация WHERE', required_sql: 'WHERE' },
      { label: 'Колонка результата: name', expected_columns: ['name'] },
      {
        label: 'Точный список учеников 9А по алфавиту',
        ordered: true,
        expected_rows: [['Айдана'], ['Алихан'], ['Тимур']],
      },
    ],
  },
  {
    id: 'sql-builtin-2',
    builtin: true,
    title: 'Средняя оценка каждого ученика',
    difficulty: 'Средняя',
    description: 'Выведите name и округлённый до 2 знаков средний балл avg_grade каждого ученика. Отсортируйте по avg_grade DESC, затем name ASC.',
    schema_sql: SCHOOL_SCHEMA,
    starter_code: `SELECT s.name, ROUND(AVG(g.grade), 2) AS avg_grade\nFROM students s\nJOIN grades g ON g.student_id = s.id\nGROUP BY s.id, s.name\nORDER BY avg_grade DESC, s.name ASC;`,
    solution: `SELECT s.name, ROUND(AVG(g.grade), 2) AS avg_grade FROM students s JOIN grades g ON g.student_id = s.id GROUP BY s.id, s.name ORDER BY avg_grade DESC, s.name ASC;`,
    max_score: 100,
    tests: [
      { label: 'Используется JOIN', required_sql: 'JOIN' },
      { label: 'Используется GROUP BY', required_sql: 'GROUP BY' },
      {
        label: 'Совпадение имён и средних баллов',
        ordered: true,
        expected_rows: [
          ['Айдана', 5.0],
          ['Мария', 4.67],
          ['Алихан', 4.33],
          ['Бектур', 3.33],
          ['Тимур', 3.33],
        ],
      },
    ],
  },
  {
    id: 'sql-builtin-3',
    builtin: true,
    title: 'Топ-3 самых дорогих товара',
    difficulty: 'Лёгкая',
    description: 'Из таблицы products выведите name и price трёх самых дорогих товаров (от самого дорогого к более дешёвому).',
    schema_sql: SHOP_SCHEMA,
    starter_code: `-- Выведите name, price топ-3 дорогих товаров\nSELECT name, price\nFROM products\n`,
    solution: `SELECT name, price FROM products ORDER BY price DESC LIMIT 3;`,
    max_score: 100,
    tests: [
      { label: 'Используется ORDER BY', required_sql: 'ORDER BY' },
      { label: 'Используется LIMIT', required_sql: 'LIMIT' },
      {
        label: 'Топ-3 товара по цене',
        ordered: true,
        expected_rows: [
          ['Ноутбук', 55000],
          ['Монитор', 19000],
          ['Клавиатура', 3500],
        ],
      },
    ],
  },
  {
    id: 'sql-builtin-4',
    builtin: true,
    title: 'Общая стоимость склада по категориям',
    difficulty: 'Средняя',
    description: 'Посчитайте для каждой категории (category) суммарную стоимость товаров на складе SUM(price * qty) AS total_value. Отсортируйте по убыванию total_value.',
    schema_sql: SHOP_SCHEMA,
    starter_code: `SELECT category, SUM(price * qty) AS total_value\nFROM products\n`,
    solution: `SELECT category, SUM(price * qty) AS total_value FROM products GROUP BY category ORDER BY total_value DESC;`,
    max_score: 100,
    tests: [
      { label: 'Используется GROUP BY', required_sql: 'GROUP BY' },
      {
        label: 'Суммы по категориям совпадают',
        ordered: true,
        expected_rows: [
          ['Электроника', 287000],
          ['Канцелярия', 32000],
        ],
      },
    ],
  },
  {
    id: 'sql-builtin-5',
    builtin: true,
    title: 'Ученики со средним баллом выше 4.5 (HAVING)',
    difficulty: 'Средняя',
    description: 'Найдите имена (name) учеников, у которых средний балл строго больше 4.5. Используйте GROUP BY и HAVING.',
    schema_sql: SCHOOL_SCHEMA,
    starter_code: `SELECT s.name\nFROM students s\nJOIN grades g ON g.student_id = s.id\nGROUP BY s.id, s.name\n`,
    solution: `SELECT s.name FROM students s JOIN grades g ON g.student_id = s.id GROUP BY s.id, s.name HAVING AVG(g.grade) > 4.5 ORDER BY s.name;`,
    max_score: 100,
    tests: [
      { label: 'Используется HAVING', required_sql: 'HAVING' },
      {
        label: 'Найдены нужные ученики',
        ordered: false,
        expected_rows: [['Айдана'], ['Мария']],
      },
    ],
  },
  {
    id: 'sql-builtin-6',
    builtin: true,
    title: 'Рейтинг товаров через оконную функцию RANK()',
    difficulty: 'Продвинутая',
    description: 'Выведите name, price и место по убыванию цены (RANK() OVER (ORDER BY price DESC) AS rnk) для всех товаров из products.',
    schema_sql: SHOP_SCHEMA,
    starter_code: `SELECT name, price,\n       RANK() OVER (ORDER BY price DESC) AS rnk\nFROM products;`,
    solution: `SELECT name, price, RANK() OVER (ORDER BY price DESC) AS rnk FROM products;`,
    max_score: 100,
    tests: [
      { label: 'Используется оконная функция OVER', required_sql: 'OVER' },
      {
        label: 'Рейтинг всех 6 товаров корректен',
        ordered: true,
        expected_rows: [
          ['Ноутбук', 55000, 1],
          ['Монитор', 19000, 2],
          ['Клавиатура', 3500, 3],
          ['Рюкзак', 2400, 4],
          ['Мышь', 1200, 5],
          ['Тетрадь', 80, 6],
        ],
      },
    ],
  },
]

function normCell(v: any): string {
  if (v === null || v === undefined) return 'NULL'
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  if (typeof v === 'number') return String(Number(v.toFixed(4)))
  const s = String(v).trim()
  if (/^-?\d+(?:\.\d+)?$/.test(s)) {
    return String(Number(Number(s).toFixed(4)))
  }
  return s.toLowerCase()
}

function normRows(rows: readonly unknown[][]): string[] {
  return (rows || []).map((r) => (Array.isArray(r) ? r.map(normCell).join('\u0001') : normCell(r)))
}

export function evaluateSqlLocal(
  tests: readonly SqlTestSpec[],
  sqlCode: string,
  columns: readonly string[],
  rows: readonly unknown[][],
  errorMsg = '',
  maxScore = 100
): { passed: boolean; passedTests: number; totalTests: number; score: number; results: SqlCheckResult[] } {
  const cleanSql = (sqlCode || '').replace(/--[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
  const actualCols = (columns || []).map((c) => String(c).trim().toLowerCase())
  const actualRows = normRows(rows)
  const results: SqlCheckResult[] = []

  for (let i = 0; i < tests.length; i++) {
    const t = tests[i]
    const label = t.label || `Проверка ${i + 1}`
    if (errorMsg) {
      results.push({ label, hidden: t.hidden, passed: false, detail: `Ошибка SQL: ${errorMsg.slice(0, 140)}` })
      continue
    }
    if (t.required_sql) {
      const re = new RegExp(`\\b${t.required_sql.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
      const ok = re.test(cleanSql)
      results.push({
        label,
        hidden: t.hidden,
        passed: ok,
        detail: ok ? `Используется ${t.required_sql.toUpperCase()}` : `Нужна конструкция ${t.required_sql.toUpperCase()}`,
      })
      continue
    }
    if (t.expected_columns?.length) {
      const want = t.expected_columns.map((c) => c.trim().toLowerCase())
      const ok = want.every((w) => actualCols.includes(w)) && actualCols.length === want.length
      results.push({
        label,
        hidden: t.hidden,
        passed: ok,
        detail: ok ? 'Колонки совпадают' : `Ожидались колонки: ${t.expected_columns.join(', ')}`,
      })
      continue
    }
    if (t.expected_rows) {
      const exp = normRows(t.expected_rows)
      const ok = t.ordered
        ? actualRows.length === exp.length && actualRows.every((v, idx) => v === exp[idx])
        : actualRows.length === exp.length && [...actualRows].sort().every((v, idx) => v === [...exp].sort()[idx])
      results.push({
        label,
        hidden: t.hidden,
        passed: ok,
        detail: ok
          ? `Точное совпадение (${actualRows.length} стр.)`
          : t.hidden
          ? 'Результат не совпал со скрытым эталоном'
          : `Получено ${actualRows.length} стр., ожидалось ${exp.length} стр.`,
      })
      continue
    }
    if (t.min_rows !== undefined) {
      const ok = actualRows.length >= t.min_rows
      results.push({
        label,
        hidden: t.hidden,
        passed: ok,
        detail: ok ? `Получено строк: ${actualRows.length}` : `Нужно минимум ${t.min_rows} стр.`,
      })
    }
  }

  const totalTests = results.length
  const passedTests = results.filter((r) => r.passed).length
  const passed = totalTests > 0 ? passedTests === totalTests : !errorMsg
  const cap = maxScore > 0 ? maxScore : 100
  const score = totalTests > 0 ? Math.round((passedTests / totalTests) * cap) : passed ? cap : 0
  return { passed, passedTests, totalTests, score, results }
}
