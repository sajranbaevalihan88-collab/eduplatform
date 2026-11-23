import type { DbEngineKind } from './sqlEngine'

export type CellKind = 'sql' | 'markdown'

export interface NotebookCell {
  id: string
  kind: CellKind
  title?: string
  content: string
}

export interface SqlPreset {
  id: string
  name: string
  badge: string
  desc: string
  engine: DbEngineKind | 'both'
  schema: string
  query: string
  cells: Omit<NotebookCell, 'id'>[]
}

export const SQL_PRESETS: SqlPreset[] = [
  {
    id: 'school',
    name: 'Школа и оценки',
    badge: 'JOIN + WINDOW',
    desc: 'Ученики, предметы, оценки, средний балл и рейтинг по классам',
    engine: 'both',
    schema: `-- Учебная база (PostgreSQL): ученики, предметы, оценки
CREATE TABLE students (
  id    SERIAL PRIMARY KEY,
  name  TEXT   NOT NULL,
  klass TEXT   NOT NULL
);

CREATE TABLE subjects (
  id      SERIAL PRIMARY KEY,
  title   TEXT   NOT NULL,
  teacher TEXT   NOT NULL
);

CREATE TABLE grades (
  id         SERIAL  PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade      INTEGER NOT NULL CHECK (grade BETWEEN 2 AND 5),
  graded_at  DATE    NOT NULL DEFAULT CURRENT_DATE
);

INSERT INTO students (name, klass) VALUES
  ('Айдана', '7А'), ('Иван',   '7Б'),
  ('Айбек',  '8А'), ('Мария',  '8А'),
  ('Данияр', '7А'), ('Ольга',  '7Б');

INSERT INTO subjects (title, teacher) VALUES
  ('Математика',  'Токтогулова Г.'),
  ('Информатика', 'Смирнова О.'),
  ('Физика',      'Петров А.');

INSERT INTO grades (student_id, subject_id, grade, graded_at) VALUES
  (1,1,5,'2026-10-01'), (1,2,5,'2026-10-03'), (1,3,4,'2026-10-05'),
  (2,1,4,'2026-10-02'), (2,2,5,'2026-10-04'),
  (3,1,3,'2026-10-01'), (3,3,4,'2026-10-06'),
  (4,2,5,'2026-10-02'), (4,3,5,'2026-10-05'),
  (5,1,5,'2026-10-03'), (5,3,3,'2026-10-07'),
  (6,1,4,'2026-10-04'), (6,2,4,'2026-10-06');`,
    query: `-- Средний балл и рейтинг внутри класса (PostgreSQL Window Function)
SELECT
  s.name                                               AS ученик,
  s.klass                                              AS класс,
  ROUND(AVG(g.grade)::numeric, 2)                      AS средний_балл,
  COUNT(*)                                             AS оценок,
  RANK() OVER (PARTITION BY s.klass ORDER BY AVG(g.grade) DESC) AS место_в_классе
FROM grades g
JOIN students s ON s.id = g.student_id
GROUP BY s.id, s.name, s.klass
ORDER BY s.klass, средний_балл DESC;`,
    cells: [
      {
        kind: 'markdown',
        title: 'Описание базы',
        content: '### Учебная база «Школа» (PostgreSQL 17)\nТри связанные таблицы (`students`, `subjects`, `grades`) с первичными и внешними ключами. Нажми **▶ Запустить всё** или **Ctrl+Enter** в любой ячейке.',
      },
      {
        kind: 'sql',
        title: '1. Создание таблиц и заполнение данных (DDL + INSERT)',
        content: `CREATE TABLE students (
  id    SERIAL PRIMARY KEY,
  name  TEXT   NOT NULL,
  klass TEXT   NOT NULL
);

CREATE TABLE subjects (
  id      SERIAL PRIMARY KEY,
  title   TEXT   NOT NULL,
  teacher TEXT   NOT NULL
);

CREATE TABLE grades (
  id         SERIAL  PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  grade      INTEGER NOT NULL CHECK (grade BETWEEN 2 AND 5),
  graded_at  DATE    NOT NULL DEFAULT CURRENT_DATE
);

INSERT INTO students (name, klass) VALUES
  ('Айдана', '7А'), ('Иван',   '7Б'),
  ('Айбек',  '8А'), ('Мария',  '8А'),
  ('Данияр', '7А'), ('Ольга',  '7Б');

INSERT INTO subjects (title, teacher) VALUES
  ('Математика',  'Токтогулова Г.'),
  ('Информатика', 'Смирнова О.'),
  ('Физика',      'Петров А.');

INSERT INTO grades (student_id, subject_id, grade, graded_at) VALUES
  (1,1,5,'2026-10-01'), (1,2,5,'2026-10-03'), (1,3,4,'2026-10-05'),
  (2,1,4,'2026-10-02'), (2,2,5,'2026-10-04'),
  (3,1,3,'2026-10-01'), (3,3,4,'2026-10-06'),
  (4,2,5,'2026-10-02'), (4,3,5,'2026-10-05'),
  (5,1,5,'2026-10-03'), (5,3,3,'2026-10-07'),
  (6,1,4,'2026-10-04'), (6,2,4,'2026-10-06');`,
      },
      {
        kind: 'sql',
        title: '2. Средний балл и рейтинг учеников (JOIN + GROUP BY + RANK)',
        content: `-- Настоящая оконная функция PostgreSQL RANK() OVER (...)
SELECT
  s.name                                                        AS ученик,
  s.klass                                                       AS класс,
  ROUND(AVG(g.grade)::numeric, 2)                               AS средний_балл,
  COUNT(*)                                                      AS оценок,
  RANK() OVER (PARTITION BY s.klass ORDER BY AVG(g.grade) DESC) AS место_в_классе
FROM grades g
JOIN students s ON s.id = g.student_id
GROUP BY s.id, s.name, s.klass
ORDER BY s.klass, средний_балл DESC;`,
      },
      {
        kind: 'sql',
        title: '3. Статистика по предметам (FILTER WHERE)',
        content: `-- Фильтрация агрегатов COUNT(*) FILTER (WHERE ...) — фишка PostgreSQL!
SELECT
  sub.title                                       AS предмет,
  sub.teacher                                     AS учитель,
  COUNT(*)                                        AS всего_оценок,
  COUNT(*) FILTER (WHERE g.grade = 5)             AS пятёрок,
  ROUND(AVG(g.grade)::numeric, 2)                 AS средний_балл
FROM grades g
JOIN subjects sub ON sub.id = g.subject_id
GROUP BY sub.id, sub.title, sub.teacher
ORDER BY средний_балл DESC;`,
      },
    ],
  },
  {
    id: 'shop',
    name: 'Магазин + JSONB',
    badge: 'JSONB + CTE',
    desc: 'Товары с характеристиками в JSONB, продажи, CTE и выручка',
    engine: 'postgres',
    schema: `-- Интернет-магазин с JSONB (PostgreSQL)
CREATE TABLE products (
  id       SERIAL PRIMARY KEY,
  name     TEXT    NOT NULL,
  category TEXT    NOT NULL,
  price    NUMERIC(10, 2) NOT NULL,
  stock    INTEGER NOT NULL DEFAULT 0,
  specs    JSONB   NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE sales (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty        INTEGER NOT NULL CHECK (qty > 0),
  sold_at    DATE    NOT NULL
);

INSERT INTO products (name, category, price, stock, specs) VALUES
  ('Ноутбук Pro 15', 'Компьютеры', 64000, 8,  '{"brand":"Asus","ram_gb":16,"ssd_gb":512}'),
  ('Мышь Wireless',  'Периферия',   1450, 55, '{"brand":"Logitech","dpi":4000,"wireless":true}'),
  ('Клавиатура RGB', 'Периферия',   3800, 22, '{"brand":"Keychron","switches":"brown","wireless":true}'),
  ('Монитор 27" 4K', 'Мониторы',   28500, 11, '{"brand":"LG","hz":144,"ips":true}');

INSERT INTO sales (product_id, qty, sold_at) VALUES
  (1, 2, '2026-10-01'), (1, 1, '2026-10-04'),
  (2, 6, '2026-10-02'), (2, 4, '2026-10-05'),
  (3, 3, '2026-10-03'),
  (4, 2, '2026-10-05'), (4, 1, '2026-10-07');`,
    query: `-- CTE + извлечение полей из JSONB + доля в общей выручке
WITH rev AS (
  SELECT
    p.name,
    p.specs->>'brand'            AS бренд,
    SUM(s.qty)                   AS продано_шт,
    SUM(s.qty * p.price)         AS выручка,
    p.specs
  FROM sales s
  JOIN products p ON p.id = s.product_id
  GROUP BY p.id, p.name, p.specs
)
SELECT
  name                                                     AS товар,
  бренд,
  продано_шт,
  выручка,
  ROUND(100.0 * выручка / SUM(выручка) OVER (), 1) || '%'  AS доля,
  specs                                                    AS jsonb_specs
FROM rev
ORDER BY выручка DESC;`,
    cells: [
      {
        kind: 'markdown',
        title: 'Интернет-магазин на PostgreSQL',
        content: '### Интернет-магазин: `JSONB`, `CTE (WITH)` и доля выручки\nВ PostgreSQL можно хранить полуструктурированные характеристики прямо в колонке `JSONB` и делать по ним быстрые запросы операторами `->>` и `@>`.',
      },
      {
        kind: 'sql',
        title: '1. Схема товаров (JSONB) и продаж',
        content: `CREATE TABLE products (
  id       SERIAL PRIMARY KEY,
  name     TEXT    NOT NULL,
  category TEXT    NOT NULL,
  price    NUMERIC(10, 2) NOT NULL,
  stock    INTEGER NOT NULL DEFAULT 0,
  specs    JSONB   NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE sales (
  id         SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty        INTEGER NOT NULL CHECK (qty > 0),
  sold_at    DATE    NOT NULL
);

INSERT INTO products (name, category, price, stock, specs) VALUES
  ('Ноутбук Pro 15', 'Компьютеры', 64000, 8,  '{"brand":"Asus","ram_gb":16,"ssd_gb":512}'),
  ('Мышь Wireless',  'Периферия',   1450, 55, '{"brand":"Logitech","dpi":4000,"wireless":true}'),
  ('Клавиатура RGB', 'Периферия',   3800, 22, '{"brand":"Keychron","switches":"brown","wireless":true}'),
  ('Монитор 27" 4K', 'Мониторы',   28500, 11, '{"brand":"LG","hz":144,"ips":true}');

INSERT INTO sales (product_id, qty, sold_at) VALUES
  (1, 2, '2026-10-01'), (1, 1, '2026-10-04'),
  (2, 6, '2026-10-02'), (2, 4, '2026-10-05'),
  (3, 3, '2026-10-03'),
  (4, 2, '2026-10-05'), (4, 1, '2026-10-07');`,
      },
      {
        kind: 'sql',
        title: '2. Аналитика выручки и доля товара (CTE + JSONB)',
        content: `WITH rev AS (
  SELECT
    p.name,
    p.specs->>'brand'    AS бренд,
    SUM(s.qty)           AS продано_шт,
    SUM(s.qty * p.price) AS выручка,
    p.specs
  FROM sales s
  JOIN products p ON p.id = s.product_id
  GROUP BY p.id, p.name, p.specs
)
SELECT
  name                                                     AS товар,
  бренд,
  продано_шт,
  выручка,
  ROUND(100.0 * выручка / SUM(выручка) OVER (), 1) || '%'  AS доля,
  specs
FROM rev
ORDER BY выручка DESC;`,
      },
      {
        kind: 'sql',
        title: '3. Поиск беспроводных устройств через JSONB @>',
        content: `-- Оператор @> проверяет вхождение JSONB-объекта
SELECT name, price, specs->>'brand' AS brand, specs
FROM products
WHERE specs @> '{"wireless": true}'::jsonb;`,
      },
    ],
  },
  {
    id: 'library',
    name: 'Библиотека + VIEW',
    badge: 'VIEW + STRING_AGG',
    desc: 'Авторы, книги, представление VIEW и группировка строк',
    engine: 'both',
    schema: `-- Библиотека: авторы, книги и представление VIEW
CREATE TABLE authors (
  id      SERIAL PRIMARY KEY,
  name    TEXT NOT NULL,
  country TEXT NOT NULL
);

CREATE TABLE books (
  id        SERIAL  PRIMARY KEY,
  title     TEXT    NOT NULL,
  author_id INTEGER NOT NULL REFERENCES authors(id),
  year      INTEGER NOT NULL,
  price     NUMERIC(8, 2) NOT NULL
);

INSERT INTO authors (name, country) VALUES
  ('Ч. Айтматов', 'Кыргызстан'),
  ('А. Пушкин',   'Россия'),
  ('Дж. Роулинг', 'Великобритания'),
  ('Л. Толстой',  'Россия');

INSERT INTO books (title, author_id, year, price) VALUES
  ('Белый пароход',   1, 1970, 380),
  ('Джамиля',         1, 1958, 290),
  ('И дольше века…',  1, 1980, 450),
  ('Евгений Онегин',  2, 1833, 420),
  ('Гарри Поттер',    3, 1997, 950),
  ('Война и мир',     4, 1869, 780);

CREATE VIEW v_catalog AS
SELECT b.id, b.title, a.name AS author, a.country, b.year, b.price
FROM books b
JOIN authors a ON a.id = b.author_id;`,
    query: `-- Список книг по каждому автору через STRING_AGG
SELECT
  a.name                                          AS автор,
  a.country                                       AS страна,
  COUNT(b.id)                                     AS книг,
  STRING_AGG(b.title, ', ' ORDER BY b.year)       AS произведения,
  ROUND(AVG(b.price), 0)                          AS средняя_цена
FROM authors a
LEFT JOIN books b ON b.author_id = a.id
GROUP BY a.id, a.name, a.country
ORDER BY книг DESC, автор;`,
    cells: [
      {
        kind: 'sql',
        title: '1. Таблицы authors, books и представление v_catalog',
        content: `CREATE TABLE authors (
  id      SERIAL PRIMARY KEY,
  name    TEXT NOT NULL,
  country TEXT NOT NULL
);

CREATE TABLE books (
  id        SERIAL  PRIMARY KEY,
  title     TEXT    NOT NULL,
  author_id INTEGER NOT NULL REFERENCES authors(id),
  year      INTEGER NOT NULL,
  price     NUMERIC(8, 2) NOT NULL
);

INSERT INTO authors (name, country) VALUES
  ('Ч. Айтматов', 'Кыргызстан'),
  ('А. Пушкин',   'Россия'),
  ('Дж. Роулинг', 'Великобритания'),
  ('Л. Толстой',  'Россия');

INSERT INTO books (title, author_id, year, price) VALUES
  ('Белый пароход',   1, 1970, 380),
  ('Джамиля',         1, 1958, 290),
  ('И дольше века…',  1, 1980, 450),
  ('Евгений Онегин',  2, 1833, 420),
  ('Гарри Поттер',    3, 1997, 950),
  ('Война и мир',     4, 1869, 780);

CREATE VIEW v_catalog AS
SELECT b.id, b.title, a.name AS author, a.country, b.year, b.price
FROM books b
JOIN authors a ON a.id = b.author_id;`,
      },
      {
        kind: 'sql',
        title: '2. Запрос к представлению VIEW + STRING_AGG',
        content: `SELECT
  author                                    AS автор,
  country                                   AS страна,
  COUNT(*)                                  AS книг,
  STRING_AGG(title, ', ' ORDER BY year)     AS произведения,
  ROUND(AVG(price), 0)                      AS средняя_цена
FROM v_catalog
GROUP BY author, country
ORDER BY книг DESC;`,
      },
    ],
  },
  {
    id: 'pg_power',
    name: 'PostgreSQL Фишки',
    badge: 'PG 17 POWER',
    desc: 'generate_series, массивы TEXT[], UNNEST и EXPLAIN ANALYZE',
    engine: 'postgres',
    schema: `-- Генерация тестовых данных средствами PostgreSQL
CREATE TABLE events (
  id         SERIAL PRIMARY KEY,
  event_date DATE    NOT NULL,
  tags       TEXT[]  NOT NULL,
  visitors   INTEGER NOT NULL
);

INSERT INTO events (event_date, tags, visitors)
SELECT
  DATE '2026-10-01' + (n - 1),
  CASE
    WHEN n % 3 = 0 THEN ARRAY['sql', 'postgres', 'backend']
    WHEN n % 2 = 0 THEN ARRAY['python', 'data']
    ELSE ARRAY['sql', 'frontend']
  END,
  40 + (n * 17) % 120
FROM generate_series(1, 10) AS n;`,
    query: `-- Разворачиваем массивы тегов через UNNEST и считаем статистику
SELECT
  tag,
  COUNT(*)        AS дней,
  SUM(visitors)   AS всего_посетителей,
  ROUND(AVG(visitors)::numeric, 1) AS в_среднем
FROM events, UNNEST(tags) AS tag
GROUP BY tag
ORDER BY всего_посетителей DESC;`,
    cells: [
      {
        kind: 'markdown',
        title: 'Возможности PostgreSQL 17',
        content: '### Фишки настоящего PostgreSQL\nПопробуй `generate_series`, массивы `TEXT[]`, `UNNEST` и реальный план выполнения `EXPLAIN ANALYZE` — всё работает прямо в твоём браузере на WASM.',
      },
      {
        kind: 'sql',
        title: '1. Генерация таблицы с массивами через generate_series',
        content: `CREATE TABLE events (
  id         SERIAL PRIMARY KEY,
  event_date DATE    NOT NULL,
  tags       TEXT[]  NOT NULL,
  visitors   INTEGER NOT NULL
);

INSERT INTO events (event_date, tags, visitors)
SELECT
  DATE '2026-10-01' + (n - 1),
  CASE
    WHEN n % 3 = 0 THEN ARRAY['sql', 'postgres', 'backend']
    WHEN n % 2 = 0 THEN ARRAY['python', 'data']
    ELSE ARRAY['sql', 'frontend']
  END,
  40 + (n * 17) % 120
FROM generate_series(1, 10) AS n
RETURNING id, event_date, tags, visitors;`,
      },
      {
        kind: 'sql',
        title: '2. Разворачивание массивов UNNEST + агрегация',
        content: `SELECT
  tag,
  COUNT(*)                         AS дней,
  SUM(visitors)                    AS всего_посетителей,
  ROUND(AVG(visitors)::numeric, 1) AS в_среднем
FROM events, UNNEST(tags) AS tag
GROUP BY tag
ORDER BY всего_посетителей DESC;`,
      },
      {
        kind: 'sql',
        title: '3. Реальный план выполнения (EXPLAIN ANALYZE)',
        content: `EXPLAIN ANALYZE
SELECT * FROM events
WHERE 'sql' = ANY(tags) AND visitors > 80
ORDER BY visitors DESC;`,
      },
    ],
  },
]

// SQLite-совместимый базовый пресет (при переключении на движок SQLite)
export const SQLITE_DEFAULT_PRESET = {
  schema: `-- Учебная база (SQLite): ученики, предметы, оценки
CREATE TABLE students (
  id    INTEGER PRIMARY KEY,
  name  TEXT    NOT NULL,
  klass TEXT    NOT NULL
);

CREATE TABLE subjects (
  id      INTEGER PRIMARY KEY,
  title   TEXT    NOT NULL,
  teacher TEXT    NOT NULL
);

CREATE TABLE grades (
  student_id INTEGER NOT NULL REFERENCES students(id),
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  grade      INTEGER NOT NULL CHECK (grade BETWEEN 2 AND 5)
);

INSERT INTO students (name, klass) VALUES
  ('Айдана', '7А'), ('Иван', '7Б'), ('Айбек', '8А'), ('Мария', '8А');

INSERT INTO subjects (title, teacher) VALUES
  ('Математика', 'Токтогулова Г.'), ('Информатика', 'Смирнова О.'), ('Физика', 'Петров А.');

INSERT INTO grades (student_id, subject_id, grade) VALUES
  (1,1,5),(1,2,5),(1,3,4),
  (2,1,4),(2,2,5),
  (3,1,3),(3,3,4),
  (4,2,5),(4,3,5);`,
  query: `SELECT s.name, s.klass,
       ROUND(AVG(g.grade), 2) AS avg_grade,
       COUNT(*)               AS n_subjects
FROM grades g
JOIN students s ON s.id = g.student_id
GROUP BY s.id
ORDER BY avg_grade DESC;`,
}

export interface SqlSnippet {
  label: string
  category: string
  code: string
}

export const SQL_SNIPPETS: SqlSnippet[] = [
  {
    label: 'CREATE TABLE (PG)',
    category: 'DDL',
    code: `CREATE TABLE users (
  id         SERIAL PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  full_name  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`,
  },
  {
    label: 'INSERT ... RETURNING',
    category: 'DML',
    code: `INSERT INTO students (name, klass)
VALUES ('Тимур', '8Б')
RETURNING *;`,
  },
  {
    label: 'INNER / LEFT JOIN',
    category: 'SELECT',
    code: `SELECT a.*, b.*
FROM table_a a
LEFT JOIN table_b b ON b.a_id = a.id
ORDER BY a.id;`,
  },
  {
    label: 'GROUP BY + HAVING',
    category: 'Агрегация',
    code: `SELECT klass, COUNT(*) AS cnt
FROM students
GROUP BY klass
HAVING COUNT(*) >= 2
ORDER BY cnt DESC;`,
  },
  {
    label: 'Оконная функция OVER()',
    category: 'Аналитика',
    code: `SELECT
  name,
  klass,
  ROW_NUMBER() OVER (PARTITION BY klass ORDER BY name) AS num
FROM students;`,
  },
  {
    label: 'CTE (WITH)',
    category: 'Аналитика',
    code: `WITH top_students AS (
  SELECT student_id, AVG(grade) AS avg_g
  FROM grades
  GROUP BY student_id
)
SELECT s.name, ROUND(t.avg_g::numeric, 2) AS avg_grade
FROM top_students t
JOIN students s ON s.id = t.student_id
ORDER BY avg_grade DESC;`,
  },
  {
    label: 'generate_series()',
    category: 'PostgreSQL',
    code: `SELECT d::date AS day, EXTRACT(DOW FROM d) AS weekday
FROM generate_series('2026-10-01'::date, '2026-10-07'::date, '1 day') AS d;`,
  },
  {
    label: 'JSONB запрос',
    category: 'PostgreSQL',
    code: `SELECT
  '{"user":"Alihan","scores":[5,5,4]}'::jsonb->>'user' AS name,
  jsonb_array_length('{"scores":[5,5,4]}'::jsonb->'scores') AS count;`,
  },
  {
    label: 'EXPLAIN ANALYZE',
    category: 'Отладка',
    code: `EXPLAIN ANALYZE
SELECT * FROM students WHERE klass = '7А';`,
  },
]

export function makeCellId(): string {
  return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6)
}

export function presetToCells(preset: SqlPreset): NotebookCell[] {
  return preset.cells.map(c => ({ ...c, id: makeCellId() }))
}

// Кодирование/декодирование состояния блокнота в URL hash (#sql=...) для кнопки «Поделиться»
export interface SharePayload {
  engine: DbEngineKind
  mode: 'notebook' | 'classic'
  cells?: NotebookCell[]
  schema?: string
  query?: string
}

export function encodeSharePayload(payload: SharePayload): string {
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  bytes.forEach(b => { bin += String.fromCharCode(b) })
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function decodeSharePayload(encoded: string): SharePayload | null {
  try {
    const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64 + '==='.slice((b64.length + 3) % 4)
    const bin = atob(pad)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const json = new TextDecoder().decode(bytes)
    const p = JSON.parse(json)
    if (p && (p.engine === 'postgres' || p.engine === 'sqlite')) return p
    return null
  } catch {
    return null
  }
}
