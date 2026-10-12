# Видео-демо 90 секунд — что показать

Логин для записи: `demo / demo1234`
- Бэкенд: http://127.0.0.1:8001/api/code-tasks/capabilities/
- Фронт: http://localhost:5173/

## Раскадровка (Win+G — запись экрана, 1920x1080)

| Время | Экран | Действие |
|---|---|---|
| 0–15с | Landing | Показать бейдж «Live Demo • Python • JS • HTML • CSS», тёмную тему, RU/EN/KG |
| 15–40с | CodeLab → Hello Python | Run → вывод `Hello EduPlatform AI`. Переключить на Hello JS → Run |
| 40–55с | VSCodeEditor | 4 файла (main.py, app.js, index.html, style.css), HTML → Preview справа |
| 55–75с | Tests/Lessons | Открыть урок, пройти тест с автопроверкой |
| 75–90с | pgAdmin/psql | `SELECT count(*)...` → 25 таблиц, PostgreSQL 17. Финал: capabilities JSON |

## Запись
1. `Win+G` → запись → сохранить `demo-90sec.mp4`
2. Ужать для GitHub (<25MB): `ffmpeg -i demo-90sec.mp4 -crf 28 -preset fast demo-90sec-small.mp4`
3. Положить рядом с README, приложить к заявке StudEXPO.
