"""Билим-Квиз Live — собственный real-time аналог Blooket и Kahoot на Django Channels.

Поддерживает 4 режима на одном движке:
- gold:    Золотая лихорадка (Blooket Gold Quest — за верный ответ открой 1 из 3 сундуков: ×2, кража 25%, обмен золотом!)
- classic: классический Kahoot (PIN/QR + 4 кнопки + гистограмма + лидерборд + пьедестал)
- race:    Гонка на вершину Ала-Тоо (живая трасса на проекторе)
- boss:    Босс-рейд (весь класс вместе побеждает Босса Пробелов)
"""
import asyncio
import base64
import io
import json
import random
import secrets
import time
from dataclasses import dataclass, field
from typing import Any

from channels.generic.websocket import AsyncWebsocketConsumer
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

ROOM_TTL_SECONDS = 3 * 3600  # 3 часа

BOT_PRESETS = [
    ('Айдана', 'av:fox:none:blook'),
    ('Адилет', 'av:dragon:none:blook'),
    ('Бермет', 'av:leopard:none:blook'),
    ('Тимур', 'av:shark:none:blook'),
    ('Нурай', 'av:panda:none:blook'),
    ('Данияр', 'av:king:none:blook'),
]

# Пул сундуков для режима «Золотая лихорадка» (Blooket Gold Quest)
GOLD_CHEST_POSITIVE = [
    {'kind': 'gold', 'amount': 250, 'label': '+250 🪙', 'emoji': '🪙', 'tone': 'good'},
    {'kind': 'gold', 'amount': 500, 'label': '+500 🪙', 'emoji': '💰', 'tone': 'great'},
    {'kind': 'gold', 'amount': 1000, 'label': 'Джекпот +1000 🪙!', 'emoji': '💎', 'tone': 'epic'},
    {'kind': 'double', 'label': '×2 Золота!', 'emoji': '✨', 'tone': 'epic'},
    {'kind': 'triple', 'label': '×3 Золота!', 'emoji': '🌟', 'tone': 'legend'},
    {'kind': 'steal', 'pct': 25, 'label': 'Украсть 25% у лидера!', 'emoji': '🏴‍☠️', 'tone': 'steal'},
    {'kind': 'swap', 'label': 'Обмен золотом с лидером!', 'emoji': '🔄', 'tone': 'swap'},
]

GOLD_CHEST_RISKY = [
    {'kind': 'trap', 'pct': 15, 'label': 'Ловушка −15% 💣', 'emoji': '💣', 'tone': 'bad'},
    {'kind': 'nothing', 'label': 'Пустой сундук 💨', 'emoji': '💨', 'tone': 'neutral'},
]


def _roll_gold_chests() -> list[dict[str, Any]]:
    """Генерирует 3 уникальных сундука (как в Blooket Gold Quest: всегда минимум 2 приятных и шанс на ловушку/кражу)."""
    positives = random.sample(GOLD_CHEST_POSITIVE, 2)
    if random.random() < 0.55:
        third = random.choice(GOLD_CHEST_RISKY)
    else:
        remaining = [c for c in GOLD_CHEST_POSITIVE if c not in positives]
        third = random.choice(remaining)
    chests = [dict(positives[0]), dict(positives[1]), dict(third)]
    random.shuffle(chests)
    return chests


@dataclass
class LivePlayer:
    id: str
    name: str
    avatar: str
    score: int = 0
    streak: int = 0
    max_streak: int = 0
    correct_count: int = 0
    total_time_ms: int = 0
    is_bot: bool = False
    connected: bool = True
    last_points: int = 0
    last_correct: bool | None = None
    prev_rank: int = 0
    # Бустеры (по 1 разу за игру)
    pu_5050: bool = True
    pu_double: bool = True
    pu_shield: bool = True
    active_double: bool = False
    active_shield: bool = False
    shield_saved: bool = False
    # Blooket Gold Quest — ожидание выбора 1 из 3 сундуков
    pending_chest: bool = False
    pending_chest_q: int = -1
    last_chest_text: str = ''


@dataclass
class LiveRoom:
    pin: str
    host_secret: str
    title: str
    mode: str  # gold | classic | race | boss
    time_per_question: int
    double_last: bool
    questions: list[dict[str, Any]]
    created_at: float = field(default_factory=time.time)
    state: str = 'lobby'  # lobby | question | reveal | finished
    q_index: int = -1
    q_started_at: float = 0.0
    players: dict[str, LivePlayer] = field(default_factory=dict)
    # ответы текущего вопроса: player_id -> {option: int, elapsed_ms: int, correct: bool, pts: int}
    answers: dict[str, dict[str, Any]] = field(default_factory=dict)
    # статистика по каждому вопросу для отчёта учителя
    q_stats: list[dict[str, Any]] = field(default_factory=list)
    # Босс-рейд состояние
    boss_name: str = 'Дракон Пробелов'
    boss_max_hp: int = 1000
    boss_hp: int = 1000
    class_shield: int = 100
    last_boss_event: dict[str, Any] = field(default_factory=dict)
    timer_task: Any = None
    bot_task: Any = None
    chest_reveal_task: Any = None

    def leaderboard(self, limit: int = 50):
        rows = sorted(
            self.players.values(),
            key=lambda p: (-p.score, -p.correct_count, p.total_time_ms, p.name),
        )
        out = []
        for idx, p in enumerate(rows[:limit], start=1):
            out.append({
                'rank': idx,
                'id': p.id,
                'name': p.name,
                'avatar': p.avatar,
                'score': p.score,
                'streak': p.streak,
                'max_streak': p.max_streak,
                'correct': p.correct_count,
                'is_bot': p.is_bot,
                'last_points': p.last_points,
                'last_correct': p.last_correct,
            })
        return out

    def player_list(self):
        return [
            {'id': p.id, 'name': p.name, 'avatar': p.avatar, 'is_bot': p.is_bot, 'score': p.score}
            for p in self.players.values() if p.connected or p.is_bot
        ]

    def cancel_tasks(self):
        for attr in ('timer_task', 'bot_task', 'chest_reveal_task'):
            t = getattr(self, attr, None)
            if t and not t.done():
                t.cancel()
            setattr(self, attr, None)


# Хранилище комнат в процессе Daphne (для одного воркера + локальной разработки)
LIVE_ROOMS: dict[str, LiveRoom] = {}


def _prune_rooms():
    now = time.time()
    stale = [k for k, rm in LIVE_ROOMS.items() if now - rm.created_at > ROOM_TTL_SECONDS]
    for k in stale:
        rm = LIVE_ROOMS.pop(k, None)
        if rm:
            rm.cancel_tasks()


def _make_pin() -> str:
    for _ in range(50):
        pin = f'{random.randint(100000, 999999)}'
        if pin not in LIVE_ROOMS:
            return pin
    return str(random.randint(100000, 999999))


def _make_qr_data_uri(url: str) -> str:
    try:
        import qrcode
        img = qrcode.make(url, box_size=8, border=2)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return ''


def _normalize_questions(raw_qs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for q in (raw_qs or [])[:40]:
        text = str(q.get('text') or '').strip()
        opts_in = q.get('options') or []
        opts = []
        correct_indices = []
        for idx, o in enumerate(opts_in[:4]):
            ot = str(o.get('text') or '').strip()
            if not ot:
                continue
            if o.get('is_correct'):
                correct_indices.append(len(opts))
            opts.append({'text': ot[:160]})
        if not text or len(opts) < 2:
            continue
        if not correct_indices:
            correct_indices = [0]
        out.append({
            'text': text[:400],
            'options': opts,
            'correct': correct_indices,
            'explanation': str(q.get('explanation') or '')[:300],
        })
    return out


class LiveQuizCreateView(APIView):
    """POST /api/live-quiz/create/ — создать комнату Live-квиза из теста БД или набора вопросов."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        _prune_rooms()
        u = request.user
        if not (u.is_staff or getattr(u, 'role', '') in ('teacher', 'admin')):
            return Response({'detail': 'Запускать Live-квиз может только учитель или администратор'}, status=status.HTTP_403_FORBIDDEN)

        test_id = request.data.get('test_id')
        title = str(request.data.get('title') or '').strip()
        mode = str(request.data.get('mode') or 'gold').lower()
        if mode not in ('gold', 'classic', 'race', 'boss'):
            mode = 'gold'
        try:
            tpq = max(8, min(60, int(request.data.get('time_per_question') or 20)))
        except (TypeError, ValueError):
            tpq = 20
        double_last = bool(request.data.get('double_last', True))

        questions = []
        if test_id:
            from .models import Test
            test = Test.objects.prefetch_related('questions__options').filter(pk=test_id).first()
            if not test:
                return Response({'detail': 'Тест не найден'}, status=status.HTTP_404_NOT_FOUND)
            if not title:
                title = test.title
            raw_qs = []
            for q in test.questions.all():
                raw_qs.append({
                    'text': q.text,
                    'explanation': q.explanation,
                    'options': [{'text': o.text, 'is_correct': o.is_correct} for o in q.options.all()],
                })
            questions = _normalize_questions(raw_qs)
        else:
            questions = _normalize_questions(request.data.get('questions') or [])

        if not questions:
            return Response({'detail': 'Нужен хотя бы 1 вопрос с 2–4 вариантами ответа'}, status=status.HTTP_400_BAD_REQUEST)

        pin = _make_pin()
        secret = secrets.token_hex(16)
        boss_max_hp = max(600, len(questions) * 350)
        room = LiveRoom(
            pin=pin,
            host_secret=secret,
            title=title or 'Билим-Квиз Live',
            mode=mode,
            time_per_question=tpq,
            double_last=double_last,
            questions=questions,
            boss_max_hp=boss_max_hp,
            boss_hp=boss_max_hp,
        )
        LIVE_ROOMS[pin] = room

        origin = str(request.data.get('origin') or '').rstrip('/')
        join_url = f'{origin}/live?pin={pin}' if origin else f'/live?pin={pin}'
        qr_data_url = _make_qr_data_uri(join_url)

        return Response({
            'pin': pin,
            'pin_fmt': f'{pin[:3]}-{pin[3:]}',
            'host_secret': secret,
            'title': room.title,
            'mode': room.mode,
            'time_per_question': room.time_per_question,
            'questions_count': len(room.questions),
            'join_url': join_url,
            'qr_data_url': qr_data_url,
        }, status=status.HTTP_201_CREATED)


class LiveQuizCheckView(APIView):
    """GET /api/live-quiz/check/<pin>/ — проверить существование комнаты по PIN (без входа)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, pin):
        _prune_rooms()
        clean = ''.join(ch for ch in str(pin or '') if ch.isdigit())
        room = LIVE_ROOMS.get(clean)
        if not room:
            return Response({'exists': False, 'detail': 'Комната с таким PIN не найдена'}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            'exists': True,
            'pin': room.pin,
            'title': room.title,
            'mode': room.mode,
            'state': room.state,
            'players_count': len(room.player_list()),
            'questions_count': len(room.questions),
        })


class LiveQuizConsumer(AsyncWebsocketConsumer):
    """WebSocket ws/quiz/<pin>/ — синхронная игра в реальном времени (ведущий + телефоны учеников)."""

    async def connect(self):
        raw_pin = self.scope['url_route']['kwargs'].get('pin', '')
        self.pin = ''.join(ch for ch in str(raw_pin) if ch.isdigit())
        self.group_name = f'live_quiz_{self.pin}'
        self.role = None  # 'host' | 'player'
        self.player_id = None

        room = LIVE_ROOMS.get(self.pin)
        if not room:
            await self.accept()
            await self.send_json({'type': 'error', 'message': 'Комната с таким PIN не найдена или завершена'})
            await self.close(code=4404)
            return

        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        room = LIVE_ROOMS.get(self.pin)
        if room and self.role == 'player' and self.player_id and self.player_id in room.players:
            room.players[self.player_id].connected = False
            await self._broadcast({
                'type': 'players_update',
                'players': room.player_list(),
            })
        try:
            await self.channel_layer.group_discard(self.group_name, self.channel_name)
        except Exception:
            pass

    async def send_json(self, payload: dict[str, Any]):
        await self.send(text_data=json.dumps(payload, ensure_ascii=False))

    async def _broadcast(self, payload: dict[str, Any]):
        await self.channel_layer.group_send(
            self.group_name,
            {'type': 'quiz.event', 'payload': payload},
        )

    async def quiz_event(self, event):
        payload = dict(event['payload'])
        # Индивидуальная обратная связь игроку при reveal
        if payload.get('type') == 'reveal' and self.role == 'player' and self.player_id:
            room = LIVE_ROOMS.get(self.pin)
            if room and self.player_id in room.players:
                p = room.players[self.player_id]
                lb = room.leaderboard()
                rank = next((r['rank'] for r in lb if r['id'] == self.player_id), len(lb))
                rank_delta = (p.prev_rank - rank) if p.prev_rank > 0 else 0
                payload['me'] = {
                    'correct': p.last_correct,
                    'points_gained': p.last_points,
                    'total_score': p.score,
                    'streak': p.streak,
                    'rank': rank,
                    'rank_delta': rank_delta,
                    'shield_saved': p.shield_saved,
                    'answered': self.player_id in room.answers,
                    'chest_text': p.last_chest_text,
                    'pending_chest': p.pending_chest,
                    'powerups': {'5050': p.pu_5050, 'double': p.pu_double, 'shield': p.pu_shield},
                }
        await self.send_json(payload)

    async def receive(self, text_data=None, bytes_data=None):
        room = LIVE_ROOMS.get(self.pin)
        if not room:
            await self.send_json({'type': 'error', 'message': 'Комната закрыта'})
            return
        try:
            msg = json.loads(text_data or '{}')
        except Exception:
            return
        mtype = msg.get('type')

        # --- ВХОД ВЕДУЩЕГО ---
        if mtype == 'host_join':
            secret = str(msg.get('secret') or '')
            if secret != room.host_secret:
                await self.send_json({'type': 'error', 'message': 'Неверный ключ ведущего'})
                await self.close(code=4403)
                return
            self.role = 'host'
            await self.send_json({
                'type': 'host_ready',
                'pin': room.pin,
                'title': room.title,
                'mode': room.mode,
                'state': room.state,
                'q_index': room.q_index,
                'questions_count': len(room.questions),
                'players': room.player_list(),
                'leaderboard': room.leaderboard(),
                'boss': {'name': room.boss_name, 'hp': room.boss_hp, 'max_hp': room.boss_max_hp, 'shield': room.class_shield},
            })
            return

        # --- ВХОД ИГРОКА (телефон ученика, без логина) ---
        if mtype == 'player_join':
            name = str(msg.get('name') or '').strip()[:24]
            if not name:
                await self.send_json({'type': 'error', 'message': 'Введи имя'})
                return
            avatar = str(msg.get('avatar') or 'av:fox:none:blook')[:48]
            if room.state == 'finished':
                await self.send_json({'type': 'error', 'message': 'Игра уже завершена'})
                return
            pid = secrets.token_hex(6)
            self.role = 'player'
            self.player_id = pid
            room.players[pid] = LivePlayer(id=pid, name=name, avatar=avatar)
            await self.send_json({
                'type': 'joined',
                'player_id': pid,
                'name': name,
                'avatar': avatar,
                'title': room.title,
                'mode': room.mode,
                'state': room.state,
                'questions_count': len(room.questions),
                'powerups': {'5050': True, 'double': True, 'shield': True},
            })
            # Если подключился во время вопроса — сразу шлём текущий вопрос
            if room.state == 'question' and 0 <= room.q_index < len(room.questions):
                q = room.questions[room.q_index]
                rem = max(1, int(room.time_per_question - (time.time() - room.q_started_at)))
                await self.send_json({
                    'type': 'question',
                    'q_index': room.q_index,
                    'total': len(room.questions),
                    'text': q['text'],
                    'options': q['options'],
                    'time_limit': rem,
                    'is_double': room.double_last and room.q_index == len(room.questions) - 1,
                    'boss': {'name': room.boss_name, 'hp': room.boss_hp, 'max_hp': room.boss_max_hp, 'shield': room.class_shield},
                })
            await self._broadcast({'type': 'players_update', 'players': room.player_list()})
            return

        # --- ЖИВЫЕ РЕАКЦИИ (летят на проектор учителя) ---
        if mtype == 'reaction' and self.role == 'player' and self.player_id:
            p = room.players.get(self.player_id)
            em = str(msg.get('emoji') or '🔥')[:4]
            if p and em in ('🔥', '👏', '😂', '🚀', '❤️', '⚡', '🤯', '🎉'):
                await self._broadcast({'type': 'reaction', 'emoji': em, 'name': p.name, 'avatar': p.avatar})
            return

        # --- БУСТЕРЫ ИГРОКА (50/50, ×2 Ставка, Щит серии) ---
        if mtype == 'use_powerup' and self.role == 'player' and self.player_id:
            if room.state != 'question' or self.player_id in room.answers:
                return
            p = room.players.get(self.player_id)
            if not p:
                return
            kind = str(msg.get('kind') or '')
            if kind == '5050' and p.pu_5050:
                q = room.questions[room.q_index]
                wrongs = [i for i in range(len(q['options'])) if i not in q['correct']]
                if len(wrongs) >= 2:
                    p.pu_5050 = False
                    hide = random.sample(wrongs, min(2, len(wrongs)))
                    await self.send_json({
                        'type': 'powerup_ok',
                        'kind': '5050',
                        'hide': hide,
                        'powerups': {'5050': p.pu_5050, 'double': p.pu_double, 'shield': p.pu_shield},
                    })
            elif kind == 'double' and p.pu_double and not p.active_double:
                p.pu_double = False
                p.active_double = True
                await self.send_json({
                    'type': 'powerup_ok',
                    'kind': 'double',
                    'powerups': {'5050': p.pu_5050, 'double': p.pu_double, 'shield': p.pu_shield},
                })
            elif kind == 'shield' and p.pu_shield and not p.active_shield:
                p.pu_shield = False
                p.active_shield = True
                await self.send_json({
                    'type': 'powerup_ok',
                    'kind': 'shield',
                    'powerups': {'5050': p.pu_5050, 'double': p.pu_double, 'shield': p.pu_shield},
                })
            return

        # --- ОТВЕТ ИГРОКА ---
        if mtype == 'answer' and self.role == 'player' and self.player_id:
            if room.state != 'question' or self.player_id in room.answers:
                return
            try:
                opt = int(msg.get('option'))
            except (TypeError, ValueError):
                return
            await self._record_answer(room, self.player_id, opt)
            p = room.players.get(self.player_id)
            if room.state == 'question' or (room.mode == 'gold' and p and p.pending_chest):
                ack_payload: dict[str, Any] = {
                    'type': 'answer_ack',
                    'option': opt,
                    'chest_ready': bool(p and p.pending_chest),
                }
                if room.mode == 'gold' and p:
                    ack_payload['correct'] = p.last_correct
                    ack_payload['total_score'] = p.score
                await self.send_json(ack_payload)
            return

        # --- ВЫБОР СУНДУКА В РЕЖИМЕ «ЗОЛОТАЯ ЛИХОРАДКА» (Blooket Gold Quest) ---
        if mtype == 'open_chest' and self.role == 'player' and self.player_id:
            if room.mode != 'gold' or room.state not in ('question', 'reveal'):
                return
            p = room.players.get(self.player_id)
            if not p or not p.pending_chest or p.pending_chest_q != room.q_index:
                return
            try:
                choice = int(msg.get('choice'))
            except (TypeError, ValueError):
                choice = 0
            choice = max(0, min(2, choice))
            p.pending_chest = False

            chests = _roll_gold_chests()
            picked = chests[choice]
            delta, event_text = self._apply_gold_chest(room, p, picked)
            p.last_points += delta
            p.last_chest_text = event_text

            await self.send_json({
                'type': 'chest_result',
                'choice': choice,
                'chests': chests,
                'picked': picked,
                'delta': delta,
                'total_score': p.score,
                'event_text': event_text,
            })
            await self._broadcast({
                'type': 'gold_event',
                'text': event_text,
                'emoji': picked.get('emoji', '🪙'),
                'tone': picked.get('tone', 'good'),
                'player_name': p.name,
                'player_avatar': p.avatar,
                'leaderboard': room.leaderboard(20),
            })

            # Если все уже ответили и никто больше не выбирает сундук — ждём 2.3 сек (чтобы увидеть 3 сундука) и раскрываем итоги!
            if room.state == 'question':
                active_count = sum(1 for pl in room.players.values() if pl.connected or pl.is_bot)
                pending_chests = sum(1 for pl in room.players.values() if pl.connected and not pl.is_bot and pl.pending_chest)
                if active_count > 0 and len(room.answers) >= active_count and pending_chests == 0:
                    expected_idx = room.q_index
                    if room.chest_reveal_task and not room.chest_reveal_task.done():
                        room.chest_reveal_task.cancel()

                    async def _delayed_reveal(q_idx: int):
                        try:
                            await asyncio.sleep(2.3)
                            if room.state == 'question' and room.q_index == q_idx:
                                await self._reveal_question(room)
                        except asyncio.CancelledError:
                            pass

                    room.chest_reveal_task = asyncio.create_task(_delayed_reveal(expected_idx))
            return

        # --- КОМАНДЫ ВЕДУЩЕГО ---
        if self.role != 'host':
            return

        if mtype == 'add_bots':
            count = max(1, min(6, int(msg.get('count') or 3)))
            existing_names = {p.name for p in room.players.values()}
            added = 0
            for bname, bav in BOT_PRESETS:
                if added >= count:
                    break
                if bname in existing_names:
                    continue
                bid = 'bot_' + secrets.token_hex(4)
                room.players[bid] = LivePlayer(id=bid, name=bname, avatar=bav, is_bot=True)
                added += 1
            await self._broadcast({'type': 'players_update', 'players': room.player_list()})
            return

        if mtype == 'kick':
            pid = str(msg.get('player_id') or '')
            if pid in room.players:
                room.players.pop(pid, None)
                await self._broadcast({'type': 'players_update', 'players': room.player_list()})
            return

        if mtype == 'start_question':
            await self._start_next_question(room)
            return

        if mtype == 'reveal':
            if room.state == 'question':
                await self._reveal_question(room)
            return

        if mtype == 'finish':
            await self._finish_game(room)
            return

    def _apply_gold_chest(self, room: LiveRoom, p: LivePlayer, picked: dict[str, Any]) -> tuple[int, str]:
        """Применяет эффект открытого сундука (Blooket Gold Quest) и возвращает (delta, event_text)."""
        kind = picked.get('kind', 'gold')
        others = [pl for pl in room.players.values() if pl.id != p.id and (pl.connected or pl.is_bot)]
        top_other = max(others, key=lambda pl: pl.score) if others else None

        if kind == 'gold':
            amt = int(picked.get('amount') or 250)
            p.score += amt
            return amt, f'{p.name} нашёл сундук: +{amt} 🪙!'

        if kind == 'double':
            gain = max(200, p.score)
            p.score += gain
            return gain, f'{p.name} открыл ×2 Золота (+{gain} 🪙)!'

        if kind == 'triple':
            gain = max(400, p.score * 2)
            p.score += gain
            return gain, f'{p.name} выбил ЛЕГЕНДАРНЫЙ ×3 (+{gain} 🪙)!'

        if kind == 'steal':
            if top_other and top_other.score >= 100:
                pct = int(picked.get('pct') or 25)
                stolen = max(50, int(round(top_other.score * (pct / 100.0))))
                stolen = min(stolen, top_other.score)
                top_other.score -= stolen
                p.score += stolen
                return stolen, f'🏴‍☠️ {p.name} украл {stolen} 🪙 у {top_other.name}!'
            p.score += 400
            return 400, f'🎁 {p.name} нашёл тайный клад: +400 🪙!'

        if kind == 'swap':
            if top_other and top_other.score > p.score:
                old_my = p.score
                old_top = top_other.score
                p.score = old_top
                top_other.score = old_my
                return (old_top - old_my), f'🔄 {p.name} обменялся золотом с {top_other.name} ({old_top} 🪙)!'
            p.score += 500
            return 500, f'👑 {p.name} и так лидер — бонус +500 🪙!'

        if kind == 'trap':
            pct = int(picked.get('pct') or 15)
            loss = int(round(p.score * (pct / 100.0)))
            p.score = max(0, p.score - loss)
            return -loss, f'💣 {p.name} попал в ловушку (−{loss} 🪙)!'

        return 0, f'💨 {p.name} открыл пустой сундук (+0 🪙)'

    async def _record_answer(self, room: LiveRoom, pid: str, opt: int):
        if room.state != 'question' or pid in room.answers:
            return
        q = room.questions[room.q_index]
        if opt < 0 or opt >= len(q['options']):
            return
        elapsed_ms = int((time.time() - room.q_started_at) * 1000)
        limit_ms = max(1000, room.time_per_question * 1000)
        correct = opt in q['correct']
        p = room.players.get(pid)
        if not p:
            return
        pts = 0
        bot_gold_event = None
        if correct:
            if room.mode == 'gold':
                mult = 2 if (room.double_last and room.q_index == len(room.questions) - 1) else 1
                if p.active_double:
                    mult *= 2
                base_gold = (100 + min(150, p.streak * 30)) * mult
                pts = base_gold
                p.score += pts
                p.streak += 1
                p.max_streak = max(p.max_streak, p.streak)
                p.correct_count += 1
                p.total_time_ms += elapsed_ms
                if not p.is_bot:
                    p.pending_chest = True
                    p.pending_chest_q = room.q_index
                else:
                    # Боты в Gold Quest тоже открывают сундук, чтобы таблица жила и менялась!
                    bot_pool = [
                        {'kind': 'gold', 'amount': 250, 'emoji': '🪙', 'tone': 'good'},
                        {'kind': 'gold', 'amount': 500, 'emoji': '💰', 'tone': 'great'},
                        {'kind': 'double', 'emoji': '✨', 'tone': 'epic'},
                        {'kind': 'trap', 'pct': 15, 'emoji': '💣', 'tone': 'bad'},
                        {'kind': 'nothing', 'emoji': '💨', 'tone': 'neutral'},
                    ]
                    bot_pick = random.choice(bot_pool)
                    b_delta, b_text = self._apply_gold_chest(room, p, bot_pick)
                    pts += b_delta
                    p.last_chest_text = b_text
                    bot_gold_event = {
                        'type': 'gold_event',
                        'text': b_text,
                        'emoji': bot_pick['emoji'],
                        'tone': bot_pick['tone'],
                        'player_name': p.name,
                        'player_avatar': p.avatar,
                        'leaderboard': room.leaderboard(20),
                    }
            else:
                speed_ratio = max(0.0, min(1.0, 1.0 - (elapsed_ms / limit_ms) * 0.55))
                base_pts = int(round(500 + 500 * speed_ratio))
                streak_bonus = min(300, p.streak * 60)
                mult = 2 if (room.double_last and room.q_index == len(room.questions) - 1) else 1
                if p.active_double:
                    mult *= 2
                pts = (base_pts + streak_bonus) * mult
                p.score += pts
                p.streak += 1
                p.max_streak = max(p.max_streak, p.streak)
                p.correct_count += 1
                p.total_time_ms += elapsed_ms
        else:
            if p.active_shield and p.streak > 0:
                p.shield_saved = True
            else:
                p.streak = 0
        p.active_double = False
        p.active_shield = False
        p.last_points = pts
        p.last_correct = correct
        room.answers[pid] = {'option': opt, 'elapsed_ms': elapsed_ms, 'correct': correct, 'pts': pts}

        if bot_gold_event:
            await self._broadcast(bot_gold_event)

        active_count = sum(1 for pl in room.players.values() if pl.connected or pl.is_bot)
        await self._broadcast({
            'type': 'answer_count',
            'answered': len(room.answers),
            'total_players': active_count,
        })
        # Если все активные участники уже ответили И никто не открывает сундук — раскрываем ответ!
        pending_chests = sum(1 for pl in room.players.values() if pl.connected and not pl.is_bot and pl.pending_chest)
        if active_count > 0 and len(room.answers) >= active_count and pending_chests == 0:
            await self._reveal_question(room)

    async def _start_next_question(self, room: LiveRoom):
        room.cancel_tasks()
        next_idx = room.q_index + 1
        if next_idx >= len(room.questions):
            await self._finish_game(room)
            return

        room.q_index = next_idx
        room.state = 'question'
        room.q_started_at = time.time()
        room.answers = {}
        # Запоминаем предыдущий рейтинг игроков для показа дельты («▲ +2 места!»)
        prev_lb = room.leaderboard()
        prev_rank_map = {r['id']: r['rank'] for r in prev_lb}
        for p in room.players.values():
            p.prev_rank = prev_rank_map.get(p.id, 0)
            p.last_points = 0
            p.last_correct = None
            p.active_double = False
            p.active_shield = False
            p.shield_saved = False
            p.pending_chest = False
            p.pending_chest_q = -1
            p.last_chest_text = ''

        q = room.questions[next_idx]
        is_double = room.double_last and next_idx == len(room.questions) - 1
        await self._broadcast({
            'type': 'question',
            'q_index': next_idx,
            'total': len(room.questions),
            'text': q['text'],
            'options': q['options'],
            'time_limit': room.time_per_question,
            'is_double': is_double,
            'total_players': sum(1 for pl in room.players.values() if pl.connected or pl.is_bot),
            'boss': {'name': room.boss_name, 'hp': room.boss_hp, 'max_hp': room.boss_max_hp, 'shield': room.class_shield},
        })

        # Серверный таймер вопроса
        async def _auto_reveal(expected_idx: int, delay: int):
            try:
                await asyncio.sleep(delay + 0.35)
                if room.state == 'question' and room.q_index == expected_idx:
                    await self._reveal_question(room)
            except asyncio.CancelledError:
                pass

        room.timer_task = asyncio.create_task(_auto_reveal(next_idx, room.time_per_question))

        # Авто-ответы ботов (если добавлены в лобби)
        bots = [p for p in room.players.values() if p.is_bot]
        if bots:
            async def _run_bots(expected_idx: int):
                try:
                    for b in bots:
                        await asyncio.sleep(random.uniform(1.4, min(6.5, room.time_per_question * 0.45)))
                        if room.state != 'question' or room.q_index != expected_idx:
                            return
                        correct_list = q['correct']
                        if random.random() < 0.72:
                            choice = random.choice(correct_list)
                        else:
                            wrongs = [i for i in range(len(q['options'])) if i not in correct_list]
                            choice = random.choice(wrongs) if wrongs else 0
                        await self._record_answer(room, b.id, choice)
                except asyncio.CancelledError:
                    pass

            room.bot_task = asyncio.create_task(_run_bots(next_idx))

    async def _reveal_question(self, room: LiveRoom):
        if room.state != 'question':
            return
        room.cancel_tasks()
        room.state = 'reveal'

        q = room.questions[room.q_index]
        counts = [0] * len(q['options'])
        correct_total = 0
        for ans in room.answers.values():
            opt = ans['option']
            if 0 <= opt < len(counts):
                counts[opt] += 1
            if ans['correct']:
                correct_total += 1
        # Сброс серии тем, кто не успел ответить
        for pid, p in room.players.items():
            if pid not in room.answers:
                p.streak = 0
                p.last_points = 0
                p.last_correct = False

        answered_n = len(room.answers)
        acc_pct = round((correct_total / answered_n) * 100) if answered_n else 0
        room.q_stats.append({
            'q_index': room.q_index + 1,
            'text': q['text'],
            'correct_count': correct_total,
            'answered': answered_n,
            'accuracy_pct': acc_pct,
        })

        # Логика Босс-рейда
        boss_event = {}
        if room.mode == 'boss':
            damage = correct_total * 140
            if room.double_last and room.q_index == len(room.questions) - 1:
                damage = int(damage * 1.5)
            room.boss_hp = max(0, room.boss_hp - damage)
            boss_atk = 0
            if answered_n > 0 and acc_pct < 50:
                boss_atk = 20
                room.class_shield = max(0, room.class_shield - boss_atk)
            boss_event = {
                'damage': damage,
                'boss_attack': boss_atk,
                'hp': room.boss_hp,
                'max_hp': room.boss_max_hp,
                'shield': room.class_shield,
                'name': room.boss_name,
            }
            room.last_boss_event = boss_event

        await self._broadcast({
            'type': 'reveal',
            'q_index': room.q_index,
            'total': len(room.questions),
            'correct': q['correct'],
            'explanation': q['explanation'],
            'counts': counts,
            'accuracy_pct': acc_pct,
            'leaderboard': room.leaderboard(20),
            'boss': boss_event or {'name': room.boss_name, 'hp': room.boss_hp, 'max_hp': room.boss_max_hp, 'shield': room.class_shield},
            'is_last': room.q_index >= len(room.questions) - 1,
        })

    async def _finish_game(self, room: LiveRoom):
        room.cancel_tasks()
        room.state = 'finished'
        lb = room.leaderboard(50)
        # MVP номинации
        mvps = []
        if lb:
            if room.mode == 'gold':
                mvps.append({'badge': '👑 Король Золота', 'name': lb[0]['name'], 'avatar': lb[0]['avatar'], 'val': f"{lb[0]['score']} 🪙 золота"})
            else:
                mvps.append({'badge': '🏆 Чемпион', 'name': lb[0]['name'], 'avatar': lb[0]['avatar'], 'val': f"{lb[0]['score']} очков"})
            best_streak = max(lb, key=lambda x: x['max_streak'])
            if best_streak['max_streak'] >= 2:
                mvps.append({'badge': '🔥 Огненная серия', 'name': best_streak['name'], 'avatar': best_streak['avatar'], 'val': f"×{best_streak['max_streak']} подряд"})
            sniper = max(lb, key=lambda x: x['correct'])
            mvps.append({'badge': '🎯 Снайпер', 'name': sniper['name'], 'avatar': sniper['avatar'], 'val': f"{sniper['correct']}/{len(room.questions)} верно"})

        weak_questions = sorted(room.q_stats, key=lambda x: x['accuracy_pct'])[:5]
        await self._broadcast({
            'type': 'podium',
            'title': room.title,
            'mode': room.mode,
            'leaderboard': lb,
            'mvps': mvps,
            'weak_questions': weak_questions,
            'boss': {
                'name': room.boss_name,
                'hp': room.boss_hp,
                'max_hp': room.boss_max_hp,
                'shield': room.class_shield,
                'defeated': room.boss_hp <= 0,
            },
        })
