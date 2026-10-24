# EduPlatform AI — интерактивная образовательная платформа

Веб-платформа, где учитель собирает урок как конструктор, а ученик проходит его
онлайн: читает, смотрит презентации, решает тесты, пишет и
запускает код прямо в браузере с живым терминалом. Классы работают как Google
Classroom: код-приглашение, задания с дедлайнами, журнал оценок и автоотчёт по
классу.

Django REST + Channels + PostgreSQL + React + TypeScript. Три языка интерфейса
(RU / EN / KG), тёмная тема, режим для слабовидящих.

> Подробное промо-описание проекта — в [STUDEXPO.md](STUDEXPO.md).

**Онлайн-демо:** [edu-frontend-l5kq.onrender.com](https://edu-frontend-l5kq.onrender.com)
(бэкенд: [edu-backend-8f07.onrender.com](https://edu-backend-8f07.onrender.com)).
Вход: логин `demo`, пароль `demo1234`.

## Возможности

- **Уроки-конструктор** — блоки: текст, файлы, презентации, тесты, код, доска,
  видео. Порядок меняется перетаскиванием. Автосохранение черновика каждые 5 с
  с ненавязчивой плашкой «Черновик восстановлен».
- **Презентации как PowerPoint** — 14 фигур, таблицы, диаграммы, переходы,
  анимации, слайд-шоу. Импорт `.pptx`/`.pdf` 1-в-1 (свой парсер на 600+ строк)
  + режим «Оригинал»: PDF-двойник через LibreOffice — попиксельно как в
  PowerPoint, рядом тоггл «Конструктор» для правок.
- **Код 4 языков** — Python и JavaScript: живой интерактивный терминал по
  WebSocket (`input()` — отвечаешь прямо в терминале) + надёжный HTTP-режим и
  изолированная песочница Piston; HTML и CSS — сразу в preview. Редактор
  Monaco, до 99 файлов, общий доступ по ссылке; HTML-превью на телефоне
  открывается на весь экран одной кнопкой.
- **Тесты с автопроверкой и античитом** — 4 типа вопросов, таймер на каждый
  вопрос, проходка по одному вопросу без кнопок «Назад», озвучка.
- **Быстрые тесты** — вопросы собираются автоматически по свободному описанию
  учителя (до 40 вопросов, 4 типа); если генерация недоступна, работает
  встроенный резервный генератор из текста урока.
- **Классы как Google Classroom** — вступление по 6-значному коду, задания с
  дедлайном и обратным отсчётом, сдача в один клик, журнал-матрица
  «ученик × задание», лента объявлений с ветками комментариев.
- **Доска 2D/3D** — движок tldraw: перо, фигуры, undo ×100, листы как в Figma,
  координатная сетка; 3D-режим «Стереометрия» (OrbitControls, фигуры в сцену
  кликом, «Снимок → 2D»); сохранённые доски, автосохранение, тач-first.
- **Мини-Word** — свой редактор документов: форматы, таблицы, картинки,
  постраничный вид, разрыв страниц, импорт/экспорт `.docx`, печать, озвучка.
- **Игры и практика** — хаб из 8 игр: Аркан тартыш (2 команды + канат),
  Спринт печати (WPM/точность), Быстрые пары, Тренировка памяти, Найди лишний
  цвет, Виселица, Найди слово, Храбрый фермер (7 глав мини-интерпретатора кода
  с настоящим 3D-полем на three.js, конфетти и рекордами). Свои наборы слов —
  руками или по теме в один клик, шарятся ссылкой без логина. Звуковой движок: MP3-набор
  + WebAudio-синтезатор с палитрой на каждую игру.
- **Доступность** — совместимость со скринридерами (NVDA/JAWS/VoiceOver),
  своя озвучка по предложениям со скоростью и голосами RU/KG/EN, poor-vision
  режим (контраст, шрифт 100–200%).

## Технологии

| Слой | Стек |
|---|---|
| Бэкенд | Django 5.1, DRF 3.15, SimpleJWT, django-filter, Channels 4 + Daphne (ASGI/WebSocket), WhiteNoise |
| БД / кэш | PostgreSQL 16 + pgvector, Redis 7, PgBouncer |
| Генерация | Встроенный генератор тестов и слов, резервный офлайн-режим |
| Код-песочница | Piston (изолированный запуск кода) + собственная песочница |
| Фронтенд | React 18, TypeScript 5.5, Vite 5, Tailwind CSS, Monaco, tldraw, three.js, pdf.js, python-pptx→парсер на сервере, mammoth |
| Прочее | python-docx, python-pptx, PyMuPDF, Pillow, LibreOffice (PDF-двойник презентаций) |

## Структура проекта

```
edu-platform/
├── apps/                  # 10 приложений Django
│   ├── accounts/          # пользователи, JWT-аутентификация
│   ├── assessments/       # тесты, автогенерация вопросов
│   ├── board/             # интерактивная доска 2D/3D
│   ├── catalog/           # каталог / публичные страницы
│   ├── classroom/         # классы, задания, журнал, объявления, автоотчёт
│   ├── code/              # запуск кода (HTTP + WebSocket ws/run)
│   ├── content/           # медиа, презентации, импорт pptx/pdf
│   ├── lessons/           # уроки-конструктор
│   ├── notes/             # заметки с таймером и напоминанием
│   └── word/              # мини-Word: документы, импорт/экспорт docx
├── frontend/              # React + Vite + Tailwind
│   └── src/pages/         # страницы: LessonBuilder, ClassroomDetail,
│                          # VSCodeEditor, WordEditor, PresentationEditor,
│                          # Board, игры (FarmerBala, FarmerField3D, ...)
├── docker-compose.yml     # PostgreSQL + Redis + PgBouncer + Piston + backend
├── Dockerfile             # образ бэкенда (migrate + daphne на старте)
├── render.yaml            # деплой на Render
└── start-backend.ps1 / start-frontend.ps1   # локальный старт (Windows)
```

## Быстрый старт (Windows PowerShell)

Требования: Python 3.11+, Node.js 18+, PostgreSQL (или Docker).

1. Скопируй `.env.example` в `.env`, при необходимости поправь значения.

2. Запусти PostgreSQL (проще всего через Docker):

```powershell
docker compose up -d db redis
```

3. Бэкенд — скрипт применит миграции и поднимет Daphne (HTTP + WebSocket):

```powershell
powershell -ExecutionPolicy Bypass -File start-backend.ps1
```

Готово: `http://127.0.0.1:8001/api/health/`

4. Фронтенд — в новом окне:

```powershell
powershell -ExecutionPolicy Bypass -File start-frontend.ps1
# или вручную:
cd frontend
npm install
npm run dev
```

Готово: `http://localhost:5173/`

5. Продакшн-сборка фронтенда:

```powershell
cd frontend
npm run build
npm run preview   # http://127.0.0.1:4173
```

## Запуск в Docker (весь стек)

```powershell
docker compose up -d
```

Поднимает PostgreSQL (+pgvector), Redis, PgBouncer, Piston (песочницу кода),
pgAdmin и бэкенд на `http://localhost:8000`. Миграции применяются при старте
контейнера. Фронтенд собирается отдельно (`cd frontend && npm run build`).

## Переменные окружения

См. `.env.example`. Основные ключи:

| Переменная | Назначение |
|---|---|
| `DJANGO_SECRET_KEY` | Секретный ключ Django |
| `DEBUG` | `True` только для разработки |
| `DATABASE_URL` | `postgres://...`; пусто — SQLite (быстрый старт) |
| `ALLOWED_HOSTS` | Разрешённые хосты через запятую |
| `CORS_ALLOWED_ORIGINS` | Источники фронтенда через запятую |
| `VITE_API_URL` | Адрес API для сборки фронтенда (`http://localhost:8001`) |
| `GEMINI_API_KEY` | Опциональный ключ генерации; без него работает встроенный генератор |
| `GEMINI_MODEL` | Модель генерации вопросов |
| `REDIS_URL` | Redis для Channels/кэша (Docker) |
| `PISTON_URL` | Адрес Piston-песочницы кода (Docker) |

## API (18 групп)

- `POST /api/auth/jwt/create/`, `/api/auth/me/` — вход и профиль
- `/api/lessons/` — уроки-конструктор
- `/api/tests/generate/` — автогенерация тестов; `/api/tests/{id}/answer/` —
  серверная проверка ответов (античит)
- `/api/ai/words/` — автоподбор списков слов для игр
- `/api/classrooms/` (+ `join`, `members`, `gradebook`, `ai_report`) — классы
- `/api/assignments/` (+ `submit`), `/api/submissions/` — задания и сдачи
- `/api/announcements/`, `/api/announcement-comments/` — лента класса
- `/api/presentations/`, `/api/word-docs/` (+ `/import/`, `/export/`) — контент
- `/api/boards/`, `/api/notes/`, `/api/code/run/` (+ WS `ws/run`) — доска,
  заметки, запуск кода

## Деплой на Render

- **Бэкенд** — Docker-сервис из `Dockerfile`: на старте сам выполняет
  `manage.py migrate` и запускает Daphne (HTTP + WebSocket в одном порту).
- **Фронтенд** — static site: build `cd frontend && npm ci && npm run build`,
  publish `frontend/dist`.
- Медиа хранятся в БД (таблица `MediaBlob`) — картинки и PDF не пропадают при
  редеплоях на бесплатном хостинге.

## Качество

- Чистый TypeScript (`tsc --noEmit` в сборке).
- Матрица из 10 презентаций, скриншот-тесты слайдов и классов в headless-
  браузере, сквозной API-тест «класс → задание → сдача → журнал».
- Доска и игры проверены автопробами через Chrome DevTools Protocol (клики,
  таймеры, жизни, рекорды — скриптами, не руками).
