# Карта звуков

Каждый файл — реальный записанный сэмпл с **Mixkit** (бесплатная лицензия без атрибуции),
прогнанный через ffmpeg loudnorm (единая громкость, mp3 q2). Никакого синтеза.

Регенерация/замена любого звука берётся из каталогов Mixkit: game / notification / interface.

| Файл | Источник (Mixkit) | Где звучит | Момент |
|---|---|---|---|
| `ui-success.mp3` | Correct answer tone | тосты «успешно» (урок/тест/задание) | `UIContext` |
| `ui-error.mp3` | Wrong answer fail notification | тосты «ошибка» | `UIContext` |
| `ui-notify.mp3` | Bell notification | тест не пройден (нейтральный сигнал) | `TestTake` |
| `ui-win.mp3` | Game level completed | **тест пройден** — фанфара | `TestTake` |
| `ui-start.mp3` | Software interface start | первый ответ в попытке — «поехали!» | `TestTake` |
| `ui-save.mp3` | Confirmation tone | заметка сохранена | `Notes` |
| `ui-pop.mp3` | Message pop alert | резерв (пузырь) | — |
| `correct.mp3` | Correct answer reward | игры: верно | `sound.ts` |
| `wrong.mp3` | Sci-Fi reject notification | игры: мимо | `sound.ts` |
| `win.mp3` | Winning an extra bonus | игры: победа | `sound.ts` |
| `go.mp3` | Positive notification | игры: старт | `sound.ts` |
| `tick.mp3` | Light button | игры: тик таймера (тихий −20 LUFS) | `sound.ts` |
| `standard.mp3` | Happy bells notification | рингтон заметок «Обычный» | `Notes` |
| `wave.mp3` | Magic notification ring | рингтон заметок «Волна» | `Notes` |
| `alarm.mp3` | Urgent simple tone loop | рингтон заметок «Сигнал» (луп) | `Notes` |
| `notify.mp3` | Doorbell tone | рингтон напоминания (по умолчанию) | `Notes` |
| `type.mp3` | ATM cash machine key press | спринт печати — клавиша (тихий −20 LUFS) | `Sprint` |

**Исключение: `arkan-*.mp3`** — этно-набор Аркан тартыш (комуз + барабан), используется только игрой Arkan.

Игры (ВислоСлов, Память, Цвета, Пары, Фермер и т.д.) играют через WebAudio-движок `sfx()` —
у них звуки синтезируются в момент нажатия и mp3 не читают; mp3 выше нужны движку `sound.ts`.

Мьют: кнопка 🔊/🔇 в шапке глушит **всё** (ключ `edu-sfx-mute`).

Скрипт `scripts/gen_ui_sounds.py` больше не источник звуков (исторический файл, можно не трогать).
