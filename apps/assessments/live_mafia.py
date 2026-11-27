"""Школьная Мафия Live — командная тактическая игра в реальном времени (PIN + QR, как в Kahoot).

Роли (строго классический школьный состав, настраивается учителем):
- mafia   : Мафия (1–5) — ночью согласованно выбирает цель
- don     : Дон мафии (0–1) — глава мафии, ночью дополнительно проверяет, кто Шериф
- doctor  : Доктор (0–2) — ночью спасает одного игрока (нельзя одного и того же 2 ночи подряд)
- sheriff : Шериф (0–2) — ночью проверяет игрока и узнаёт: Мирный или Мафия
- citizen : Мирный житель (все остальные автоматически) — ночью получает прикрытие (логическую загадку),
            чтобы никто не мог определить роли по касаниям экранов.

Безопасность:
- Тайные роли игроков НИКОГДА не отправляются в broadcast обычным участникам.
- Каждый клиент получает строго свой персонализированный срез состояния (ведущий — полный пульт,
  игрок — только свою роль и разрешённые приватные журналы проверок/союзников).
"""
import asyncio
import base64
import hmac
import io
import json
import random
import secrets
import time
from collections import Counter
from dataclasses import dataclass, field
from typing import Any

from channels.generic.websocket import AsyncWebsocketConsumer
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

MAFIA_TTL_SECONDS = 4 * 3600
MAX_MAFIA_ROOMS = 80
MAX_PLAYERS_MAFIA = 40

BOT_PRESETS = [
    ('Айдана', 'av:fox:none:blook'),
    ('Адилет', 'av:dragon:none:blook'),
    ('Бермет', 'av:leopard:none:blook'),
    ('Тимур', 'av:shark:none:blook'),
    ('Нурай', 'av:panda:none:blook'),
    ('Данияр', 'av:king:none:blook'),
    ('Алина', 'av:owl:none:blook'),
    ('Эрбол', 'av:wolf:none:blook'),
]

ROLE_META: dict[str, dict[str, str]] = {
    'mafia': {
        'title': 'Мафия',
        'team': 'mafia',
        'emoji': '🕶️',
        'desc': 'Ночью договорись с напарниками и выбери цель. Днём убеди город, что ты мирный житель.',
    },
    'don': {
        'title': 'Дон мафии',
        'team': 'mafia',
        'emoji': '🎩',
        'desc': 'Глава мафии. Ночью выбираешь цель вместе с мафией и дополнительно ищешь Шерифа.',
    },
    'doctor': {
        'title': 'Доктор',
        'team': 'town',
        'emoji': '🩺',
        'desc': 'Ночью выбери одного игрока, чтобы защитить его от выбывания. Нельзя лечить одного и того же две ночи подряд.',
    },
    'sheriff': {
        'title': 'Шериф',
        'team': 'town',
        'emoji': '⭐',
        'desc': 'Ночью проверь любого игрока — на экран придёт точный ответ: Мирный он или из Мафии.',
    },
    'citizen': {
        'title': 'Мирный житель',
        'team': 'town',
        'emoji': '🏘️',
        'desc': 'Слушай аргументы, ищи нестыковки в словах и голосуй днём, чтобы вычислить мафию.',
    },
}

# Ночные загадки-прикрытия для мирных жителей (чтобы ночью в экран нажимали ВСЕ игроки)
NIGHT_DECOY_RIDDLES = [
    {'q': 'Что становится больше, если его перевернуть вверх ногами?', 'opts': ['Число 6', 'Круг', 'Буква О'], 'ans': 0},
    {'q': 'У какого месяца в году есть 28 дней?', 'opts': ['Только у февраля', 'У всех 12 месяцев', 'Только у високосного'], 'ans': 1},
    {'q': 'Сколько граней у обычного куба?', 'opts': ['4', '6', '8'], 'ans': 1},
    {'q': 'Какая планета ближе всего к Солнцу?', 'opts': ['Венера', 'Меркурий', 'Марс'], 'ans': 1},
    {'q': 'Продолжи ряд: 2, 4, 8, 16, …', 'opts': ['24', '30', '32'], 'ans': 2},
    {'q': 'Сколько секунд в 3 минутах?', 'opts': ['120', '180', '210'], 'ans': 1},
    {'q': 'Что легче: 1 кг железа или 1 кг пуха?', 'opts': ['1 кг пуха', 'Одинаково', '1 кг железа'], 'ans': 1},
    {'q': 'Столица Кыргызской Республики?', 'opts': ['Ош', 'Бишкек', 'Каракол'], 'ans': 1},
    {'q': 'Чему равна сумма углов треугольника?', 'opts': ['90°', '180°', '360°'], 'ans': 1},
    {'q': 'Сколько бит в 1 байте?', 'opts': ['4', '8', '16'], 'ans': 1},
]


@dataclass
class MafiaPlayer:
    id: str
    token: str
    name: str
    avatar: str
    is_bot: bool = False
    connected: bool = True
    alive: bool = True
    role: str = 'citizen'  # mafia | don | doctor | sheriff | citizen
    eliminated_round: int = 0
    eliminated_reason: str = ''  # night | vote
    last_healed_id: str = ''  # для Доктора: нельзя лечить дважды подряд
    sheriff_log: list[dict[str, Any]] = field(default_factory=list)
    don_log: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class MafiaRoom:
    pin: str
    host_secret: str
    title: str
    mafia_count: int = 2
    don_count: int = 0
    doctor_count: int = 1
    sheriff_count: int = 1
    discuss_seconds: int = 90
    reveal_role_on_death: bool = True
    created_at: float = field(default_factory=time.time)
    # lobby | role_reveal | night | morning | day_discuss | day_vote | finished
    phase: str = 'lobby'
    round_num: int = 0
    players: dict[str, MafiaPlayer] = field(default_factory=dict)

    # Ночные действия текущего раунда
    mafia_picks: dict[str, str] = field(default_factory=dict)       # mafia_player_id -> target_id
    don_checks: dict[str, str] = field(default_factory=dict)        # don_id -> target_id (уже проверил в эту ночь)
    doctor_picks: dict[str, str] = field(default_factory=dict)      # doctor_id -> target_id
    sheriff_checks: dict[str, str] = field(default_factory=dict)    # sheriff_id -> target_id (уже проверил)
    decoy_done: set[str] = field(default_factory=set)               # мирные, нажавшие ночное прикрытие
    night_riddle_idx: int = 0

    # Дневное голосование: voter_id -> target_id ('skip' = воздержаться)
    day_votes: dict[str, str] = field(default_factory=dict)

    # Итоги утра / дня и история
    last_event: dict[str, Any] = field(default_factory=dict)
    history: list[dict[str, Any]] = field(default_factory=list)
    winner: str = ''  # '' | 'town' | 'mafia'
    winner_reason: str = ''

    # Таймер обсуждения
    discuss_ends_at: float = 0.0
    discuss_paused_rem: int = 0
    bot_task: Any = None

    def active_players(self) -> list[MafiaPlayer]:
        return [p for p in self.players.values() if p.connected or p.is_bot or self.phase != 'lobby']

    def alive_players(self) -> list[MafiaPlayer]:
        return [p for p in self.players.values() if p.alive]

    def total_special_roles(self) -> int:
        return self.mafia_count + self.don_count + self.doctor_count + self.sheriff_count

    def config_dict(self) -> dict[str, Any]:
        total = len(self.active_players())
        citizens = max(0, total - self.total_special_roles())
        return {
            'mafia_count': self.mafia_count,
            'don_count': self.don_count,
            'doctor_count': self.doctor_count,
            'sheriff_count': self.sheriff_count,
            'citizen_count': citizens,
            'discuss_seconds': self.discuss_seconds,
            'reveal_role_on_death': self.reveal_role_on_death,
        }

    def public_players(self, include_roles: bool = False) -> list[dict[str, Any]]:
        out = []
        for p in self.players.values():
            if self.phase == 'lobby' and not p.connected and not p.is_bot:
                continue
            show_role = include_roles or self.phase == 'finished' or (not p.alive and self.reveal_role_on_death)
            item: dict[str, Any] = {
                'id': p.id,
                'name': p.name,
                'avatar': p.avatar,
                'is_bot': p.is_bot,
                'connected': p.connected,
                'alive': p.alive,
                'eliminated_round': p.eliminated_round,
                'eliminated_reason': p.eliminated_reason,
            }
            if show_role and self.phase != 'lobby':
                meta = ROLE_META.get(p.role, ROLE_META['citizen'])
                item['role'] = p.role
                item['role_title'] = meta['title']
                item['role_emoji'] = meta['emoji']
                item['team'] = meta['team']
            out.append(item)
        return out

    def night_progress(self) -> dict[str, Any]:
        alive = self.alive_players()
        mafia_alive = [p for p in alive if p.role in ('mafia', 'don')]
        don_alive = [p for p in alive if p.role == 'don']
        doc_alive = [p for p in alive if p.role == 'doctor']
        sheriff_alive = [p for p in alive if p.role == 'sheriff']
        return {
            'mafia_total': len(mafia_alive),
            'mafia_done': sum(1 for p in mafia_alive if p.id in self.mafia_picks),
            'don_total': len(don_alive),
            'don_done': sum(1 for p in don_alive if p.id in self.don_checks),
            'doctor_total': len(doc_alive),
            'doctor_done': sum(1 for p in doc_alive if p.id in self.doctor_picks),
            'sheriff_total': len(sheriff_alive),
            'sheriff_done': sum(1 for p in sheriff_alive if p.id in self.sheriff_checks),
            'all_key_ready': (
                (not mafia_alive or any(p.id in self.mafia_picks for p in mafia_alive))
                and all(p.id in self.doctor_picks for p in doc_alive)
                and all(p.id in self.sheriff_checks for p in sheriff_alive)
            ),
        }

    def vote_tally(self) -> dict[str, Any]:
        counts: Counter[str] = Counter()
        voters_by_target: dict[str, list[str]] = {}
        for voter_id, target_id in self.day_votes.items():
            voter = self.players.get(voter_id)
            if not voter or not voter.alive:
                continue
            counts[target_id] += 1
            voters_by_target.setdefault(target_id, []).append(voter.name)
        return {
            'counts': dict(counts),
            'voters': voters_by_target,
            'voted_count': sum(counts.values()),
            'alive_count': len(self.alive_players()),
        }

    def check_winner(self) -> tuple[str, str]:
        alive = self.alive_players()
        mafia_alive = sum(1 for p in alive if p.role in ('mafia', 'don'))
        town_alive = len(alive) - mafia_alive
        if mafia_alive == 0:
            return ('town', 'Вся мафия вычислена и изгнана из города!')
        if mafia_alive >= town_alive:
            return ('mafia', 'Мафия сравнялась с мирными и взяла город под контроль!')
        return ('', '')

    def cancel_tasks(self):
        if self.bot_task and not self.bot_task.done():
            self.bot_task.cancel()
        self.bot_task = None


MAFIA_ROOMS: dict[str, MafiaRoom] = {}


def _prune_mafia_rooms():
    now = time.time()
    stale = [k for k, rm in MAFIA_ROOMS.items() if now - rm.created_at > MAFIA_TTL_SECONDS]
    for k in stale:
        rm = MAFIA_ROOMS.pop(k, None)
        if rm:
            rm.cancel_tasks()


def _make_pin() -> str:
    for _ in range(50):
        pin = f'{secrets.randbelow(900000) + 100000}'
        if pin not in MAFIA_ROOMS:
            return pin
    return str(secrets.randbelow(900000) + 100000)


def _make_qr_data_uri(url: str) -> str:
    try:
        import qrcode
        img = qrcode.make(url, box_size=8, border=2)
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        return 'data:image/png;base64,' + base64.b64encode(buf.getvalue()).decode()
    except Exception:
        return ''


def _clamp_int(val: Any, lo: int, hi: int, default: int) -> int:
    try:
        return max(lo, min(hi, int(val)))
    except (TypeError, ValueError):
        return default


class MafiaCreateView(APIView):
    """POST /api/live-mafia/create/ — создать комнату «Школьная Мафия Live»."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        _prune_mafia_rooms()
        u = request.user
        if not (u.is_staff or getattr(u, 'role', '') in ('teacher', 'admin')):
            return Response(
                {'detail': 'Запускать игру «Мафия» может только учитель или администратор'},
                status=status.HTTP_403_FORBIDDEN,
            )
        if len(MAFIA_ROOMS) >= MAX_MAFIA_ROOMS:
            return Response(
                {'detail': 'Слишком много активных комнат Мафии, попробуйте позже'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        title = str(request.data.get('title') or 'Школьная Мафия').strip()[:80] or 'Школьная Мафия'
        mafia_count = _clamp_int(request.data.get('mafia_count'), 1, 5, 2)
        don_count = _clamp_int(request.data.get('don_count'), 0, 1, 0)
        doctor_count = _clamp_int(request.data.get('doctor_count'), 0, 2, 1)
        sheriff_count = _clamp_int(request.data.get('sheriff_count'), 0, 2, 1)
        discuss_seconds = _clamp_int(request.data.get('discuss_seconds'), 30, 300, 90)
        reveal_role_on_death = bool(request.data.get('reveal_role_on_death', True))

        pin = _make_pin()
        secret = secrets.token_hex(16)
        room = MafiaRoom(
            pin=pin,
            host_secret=secret,
            title=title,
            mafia_count=mafia_count,
            don_count=don_count,
            doctor_count=doctor_count,
            sheriff_count=sheriff_count,
            discuss_seconds=discuss_seconds,
            reveal_role_on_death=reveal_role_on_death,
        )
        MAFIA_ROOMS[pin] = room

        from django.conf import settings as _dj_settings
        raw_origin = str(request.data.get('origin') or '').strip().rstrip('/')
        allowed_origins = set(getattr(_dj_settings, 'CORS_ALLOWED_ORIGINS', []) or [])
        safe_origin = ''
        if raw_origin and (
            raw_origin in allowed_origins
            or raw_origin.startswith(('http://localhost:', 'http://127.0.0.1:'))
        ):
            safe_origin = raw_origin
        join_url = f'{safe_origin}/mafia?pin={pin}' if safe_origin else f'/mafia?pin={pin}'
        qr_data_url = _make_qr_data_uri(join_url)

        return Response({
            'pin': pin,
            'pin_fmt': f'{pin[:3]}-{pin[3:]}',
            'host_secret': secret,
            'title': room.title,
            'config': room.config_dict(),
            'join_url': join_url,
            'qr_data_url': qr_data_url,
        }, status=status.HTTP_201_CREATED)


class MafiaCheckView(APIView):
    """GET /api/live-mafia/check/<pin>/ — проверить комнату Мафии по PIN (доступно ученикам без логина)."""
    permission_classes = [permissions.AllowAny]

    def get(self, request, pin):
        _prune_mafia_rooms()
        clean = ''.join(ch for ch in str(pin or '') if ch.isdigit())
        room = MAFIA_ROOMS.get(clean)
        if not room:
            return Response({'exists': False, 'detail': 'Комната с таким PIN не найдена'}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            'exists': True,
            'pin': room.pin,
            'title': room.title,
            'phase': room.phase,
            'players_count': len(room.active_players()),
        })


class MafiaConsumer(AsyncWebsocketConsumer):
    """WebSocket ws/mafia/<pin>/ — синхронная Школьная Мафия в реальном времени."""

    async def connect(self):
        raw_pin = self.scope['url_route']['kwargs'].get('pin', '')
        self.pin = ''.join(ch for ch in str(raw_pin) if ch.isdigit())
        self.group_name = f'live_mafia_{self.pin}'
        self.client_kind = None  # 'host' | 'player'
        self.player_id = None
        self._in_group = False

        room = MAFIA_ROOMS.get(self.pin)
        if not room:
            await self.accept()
            await self.send_json({'type': 'error', 'message': 'Комната Мафии не найдена или уже закрыта'})
            await self.close(code=4404)
            return
        await self.accept()

    async def disconnect(self, code):
        room = MAFIA_ROOMS.get(self.pin)
        if room and self.client_kind == 'player' and self.player_id and self.player_id in room.players:
            room.players[self.player_id].connected = False
            await self._broadcast_state(room)
        if self._in_group:
            try:
                await self.channel_layer.group_discard(self.group_name, self.channel_name)
            except Exception:
                pass
            self._in_group = False

    async def send_json(self, payload: dict[str, Any]):
        await self.send(text_data=json.dumps(payload, ensure_ascii=False))

    def _build_host_payload(self, room: MafiaRoom) -> dict[str, Any]:
        # Детали ночных ходов только для пульта учителя (в UI учителя есть кнопка «Режим проектора» для скрытия)
        night_actions = {
            'mafia': [
                {
                    'by': room.players[pid].name,
                    'target': room.players[tid].name if tid in room.players else '',
                    'target_id': tid,
                }
                for pid, tid in room.mafia_picks.items() if pid in room.players
            ],
            'don': [
                {
                    'by': room.players[pid].name,
                    'target': room.players[tid].name if tid in room.players else '',
                    'is_sheriff': (room.players[tid].role == 'sheriff') if tid in room.players else False,
                }
                for pid, tid in room.don_checks.items() if pid in room.players
            ],
            'doctor': [
                {
                    'by': room.players[pid].name,
                    'target': room.players[tid].name if tid in room.players else '',
                }
                for pid, tid in room.doctor_picks.items() if pid in room.players
            ],
            'sheriff': [
                {
                    'by': room.players[pid].name,
                    'target': room.players[tid].name if tid in room.players else '',
                    'is_mafia': (room.players[tid].role in ('mafia', 'don')) if tid in room.players else False,
                }
                for pid, tid in room.sheriff_checks.items() if pid in room.players
            ],
        }
        rem_sec = 0
        if room.phase == 'day_discuss':
            if room.discuss_paused_rem > 0:
                rem_sec = room.discuss_paused_rem
            else:
                rem_sec = max(0, int(round(room.discuss_ends_at - time.time())))

        return {
            'type': 'state',
            'audience': 'host',
            'pin': room.pin,
            'title': room.title,
            'phase': room.phase,
            'round': room.round_num,
            'config': room.config_dict(),
            'players': room.public_players(include_roles=True),
            'night_progress': room.night_progress(),
            'night_actions': night_actions,
            'votes': room.vote_tally(),
            'last_event': room.last_event,
            'history': room.history[-12:],
            'winner': room.winner,
            'winner_reason': room.winner_reason,
            'discuss_rem': rem_sec,
            'discuss_paused': room.discuss_paused_rem > 0,
        }

    def _build_player_payload(self, room: MafiaRoom, player_id: str) -> dict[str, Any]:
        p = room.players.get(player_id)
        if not p:
            return {'type': 'error', 'message': 'Игрок не найден'}
        meta = ROLE_META.get(p.role, ROLE_META['citizen'])

        teammates = []
        mafia_team_picks: list[dict[str, str]] = []
        if room.phase != 'lobby' and p.role in ('mafia', 'don'):
            for other in room.players.values():
                if other.id != p.id and other.role in ('mafia', 'don'):
                    teammates.append({
                        'id': other.id,
                        'name': other.name,
                        'role': other.role,
                        'role_title': ROLE_META[other.role]['title'],
                        'alive': other.alive,
                    })
            if room.phase == 'night':
                for mid, tid in room.mafia_picks.items():
                    mp = room.players.get(mid)
                    tp = room.players.get(tid)
                    if mp and tp:
                        mafia_team_picks.append({'by': mp.name, 'target_id': tid, 'target_name': tp.name})

        rem_sec = 0
        if room.phase == 'day_discuss':
            if room.discuss_paused_rem > 0:
                rem_sec = room.discuss_paused_rem
            else:
                rem_sec = max(0, int(round(room.discuss_ends_at - time.time())))

        riddle = None
        if room.phase == 'night' and p.alive and p.role == 'citizen':
            r = NIGHT_DECOY_RIDDLES[room.night_riddle_idx % len(NIGHT_DECOY_RIDDLES)]
            riddle = {'q': r['q'], 'opts': r['opts'], 'done': p.id in room.decoy_done}

        me_data: dict[str, Any] = {
            'id': p.id,
            'token': p.token,
            'name': p.name,
            'avatar': p.avatar,
            'alive': p.alive,
            'role': p.role if room.phase != 'lobby' else '',
            'role_title': meta['title'] if room.phase != 'lobby' else '',
            'role_emoji': meta['emoji'] if room.phase != 'lobby' else '',
            'role_desc': meta['desc'] if room.phase != 'lobby' else '',
            'team': meta['team'] if room.phase != 'lobby' else '',
            'teammates': teammates,
            'mafia_picks': mafia_team_picks,
            'my_night_target': (
                room.mafia_picks.get(p.id, '') if p.role in ('mafia', 'don')
                else room.doctor_picks.get(p.id, '') if p.role == 'doctor'
                else room.sheriff_checks.get(p.id, '') if p.role == 'sheriff'
                else ''
            ),
            'my_don_checked': room.don_checks.get(p.id, '') if p.role == 'don' else '',
            'last_healed_id': p.last_healed_id if p.role == 'doctor' else '',
            'sheriff_log': p.sheriff_log if p.role == 'sheriff' else [],
            'don_log': p.don_log if p.role == 'don' else [],
            'my_vote': room.day_votes.get(p.id, ''),
            'riddle': riddle,
        }

        return {
            'type': 'state',
            'audience': 'player',
            'pin': room.pin,
            'title': room.title,
            'phase': room.phase,
            'round': room.round_num,
            'config': room.config_dict(),
            'players': room.public_players(include_roles=False),
            'me': me_data,
            'votes': room.vote_tally() if room.phase == 'day_vote' else {'counts': {}, 'voted_count': 0, 'alive_count': len(room.alive_players())},
            'last_event': room.last_event,
            'winner': room.winner,
            'winner_reason': room.winner_reason,
            'discuss_rem': rem_sec,
            'discuss_paused': room.discuss_paused_rem > 0,
        }

    async def _broadcast_state(self, room: MafiaRoom):
        await self.channel_layer.group_send(
            self.group_name,
            {'type': 'mafia.sync'},
        )

    async def mafia_sync(self, event):
        room = MAFIA_ROOMS.get(self.pin)
        if not room:
            return
        if self.client_kind == 'host':
            await self.send_json(self._build_host_payload(room))
        elif self.client_kind == 'player' and self.player_id:
            await self.send_json(self._build_player_payload(room, self.player_id))

    async def mafia_kick(self, event):
        if self.client_kind == 'player' and self.player_id == event.get('player_id'):
            await self.send_json({'type': 'error', 'message': 'Ведущий удалил вас из комнаты'})
            await self.close(code=4403)

    async def mafia_closed(self, event):
        await self.send_json({'type': 'room_closed', 'message': 'Ведущий завершил игру'})
        await self.close(code=1000)

    def _assign_roles(self, room: MafiaRoom) -> str | None:
        # Оставляем только подключённых игроков и ботов
        active = [p for p in room.players.values() if p.connected or p.is_bot]
        if len(active) < 4:
            return 'Для начала игры нужно минимум 4 игрока (можно добавить ботов для пробы)'
        total_special = room.total_special_roles()
        if total_special > len(active):
            return f'Выбрано спецролей ({total_special}) больше, чем игроков ({len(active)}). Уменьшите количество ролей.'
        mafia_total = room.mafia_count + room.don_count
        if mafia_total < 1:
            return 'В игре должен быть хотя бы 1 игрок Мафии'
        if mafia_total >= len(active) - mafia_total:
            return 'Слишком много мафии: мирных жителей должно быть больше, чем мафии'

        # Удаляем отключившихся ещё в лобби
        room.players = {p.id: p for p in active}
        roles_pool = (
            ['mafia'] * room.mafia_count
            + ['don'] * room.don_count
            + ['doctor'] * room.doctor_count
            + ['sheriff'] * room.sheriff_count
            + ['citizen'] * (len(active) - total_special)
        )
        random.shuffle(roles_pool)
        for p, r in zip(active, roles_pool):
            p.role = r
            p.alive = True
            p.eliminated_round = 0
            p.eliminated_reason = ''
            p.last_healed_id = ''
            p.sheriff_log = []
            p.don_log = []

        room.round_num = 1
        room.phase = 'role_reveal'
        room.mafia_picks.clear()
        room.don_checks.clear()
        room.doctor_picks.clear()
        room.sheriff_checks.clear()
        room.decoy_done.clear()
        room.day_votes.clear()
        room.history.clear()
        room.winner = ''
        room.winner_reason = ''
        room.last_event = {'kind': 'roles_dealt', 'headline': 'Роли розданы! Посмотрите свою карточку на телефоне.'}
        return None

    async def _run_bot_night_actions(self, room: MafiaRoom, round_num: int):
        try:
            await asyncio.sleep(1.5)
            if room.phase != 'night' or room.round_num != round_num:
                return
            alive = room.alive_players()
            town_targets = [p for p in alive if p.role not in ('mafia', 'don')]
            # Если кто-то из живых людей-мафиози уже выбрал цель, бот-мафия поддержит её
            existing_mafia_target = next(iter(room.mafia_picks.values()), '')
            for p in alive:
                if not p.is_bot:
                    continue
                if p.role in ('mafia', 'don'):
                    if p.id not in room.mafia_picks and town_targets:
                        tgt = existing_mafia_target if (existing_mafia_target in room.players and room.players[existing_mafia_target].alive) else random.choice(town_targets).id
                        room.mafia_picks[p.id] = tgt
                        existing_mafia_target = tgt
                    if p.role == 'don' and p.id not in room.don_checks and town_targets:
                        checked_ids = {x['target_id'] for x in p.don_log}
                        cand = [t for t in town_targets if t.id not in checked_ids] or town_targets
                        pick = random.choice(cand)
                        room.don_checks[p.id] = pick.id
                        p.don_log.append({
                            'round': room.round_num,
                            'target_id': pick.id,
                            'target_name': pick.name,
                            'is_sheriff': pick.role == 'sheriff',
                        })
                elif p.role == 'doctor':
                    if p.id not in room.doctor_picks:
                        cand = [t for t in alive if t.id != p.last_healed_id] or alive
                        room.doctor_picks[p.id] = random.choice(cand).id
                elif p.role == 'sheriff':
                    if p.id not in room.sheriff_checks:
                        checked_ids = {x['target_id'] for x in p.sheriff_log}
                        cand = [t for t in alive if t.id != p.id and t.id not in checked_ids] or [t for t in alive if t.id != p.id]
                        if cand:
                            pick = random.choice(cand)
                            room.sheriff_checks[p.id] = pick.id
                            p.sheriff_log.append({
                                'round': room.round_num,
                                'target_id': pick.id,
                                'target_name': pick.name,
                                'is_mafia': pick.role in ('mafia', 'don'),
                            })
                else:
                    room.decoy_done.add(p.id)
            await self._broadcast_state(room)
        except asyncio.CancelledError:
            pass

    async def _run_bot_day_votes(self, room: MafiaRoom, round_num: int):
        try:
            await asyncio.sleep(2.0)
            if room.phase != 'day_vote' or room.round_num != round_num:
                return
            alive = room.alive_players()
            for p in alive:
                if not p.is_bot or p.id in room.day_votes:
                    continue
                if p.role in ('mafia', 'don'):
                    cand = [t for t in alive if t.role not in ('mafia', 'don')]
                elif p.role == 'sheriff':
                    known_mafia = [
                        room.players[x['target_id']]
                        for x in p.sheriff_log
                        if x.get('is_mafia') and x['target_id'] in room.players and room.players[x['target_id']].alive
                    ]
                    cand = known_mafia or [t for t in alive if t.id != p.id]
                else:
                    cand = [t for t in alive if t.id != p.id]
                room.day_votes[p.id] = random.choice(cand).id if cand else 'skip'
            await self._broadcast_state(room)
        except asyncio.CancelledError:
            pass

    def _resolve_night(self, room: MafiaRoom):
        # 1. Цель мафии (большинство голосов мафии; при ничьей — выбор Дона или случайный из лидеров)
        victim_id = ''
        if room.mafia_picks:
            valid_picks = [
                (pid, tid) for pid, tid in room.mafia_picks.items()
                if pid in room.players and room.players[pid].alive and tid in room.players and room.players[tid].alive
            ]
            if valid_picks:
                cnt = Counter(tid for _, tid in valid_picks)
                top_votes = cnt.most_common(1)[0][1]
                leaders = [tid for tid, c in cnt.items() if c == top_votes]
                if len(leaders) == 1:
                    victim_id = leaders[0]
                else:
                    # При ничьей приоритет у Дона
                    don_pick = next((tid for pid, tid in valid_picks if room.players[pid].role == 'don' and tid in leaders), '')
                    victim_id = don_pick or random.choice(leaders)

        # 2. Лечение докторов
        healed_ids: set[str] = set()
        for doc_id, tid in room.doctor_picks.items():
            doc = room.players.get(doc_id)
            if doc and doc.alive and tid in room.players and room.players[tid].alive:
                healed_ids.add(tid)
                doc.last_healed_id = tid

        # 3. Итог ночи
        if victim_id and victim_id not in healed_ids:
            victim = room.players[victim_id]
            victim.alive = False
            victim.eliminated_round = room.round_num
            victim.eliminated_reason = 'night'
            ev: dict[str, Any] = {
                'kind': 'night_eliminated',
                'round': room.round_num,
                'target_id': victim.id,
                'target_name': victim.name,
                'target_avatar': victim.avatar,
                'headline': f'Этой ночью город потерял игрока {victim.name}',
                'sub': f'Роль: {ROLE_META[victim.role]["emoji"]} {ROLE_META[victim.role]["title"]}' if room.reveal_role_on_death else 'Роль остаётся тайной до конца игры.',
            }
            if room.reveal_role_on_death:
                ev['target_role'] = victim.role
                ev['target_role_title'] = ROLE_META[victim.role]['title']
        elif victim_id and victim_id in healed_ids:
            ev = {
                'kind': 'night_saved',
                'round': room.round_num,
                'headline': 'Утро без потерь! Доктор вовремя спас жителя!',
                'sub': 'Все игроки проснулись живыми и готовы к обсуждению.',
            }
        else:
            ev = {
                'kind': 'night_quiet',
                'round': room.round_num,
                'headline': 'Тихая ночь — никто не пострадал.',
                'sub': 'Город просыпается и переходит к обсуждению.',
            }

        room.last_event = ev
        room.history.append({'phase': f'Ночь {room.round_num}', 'text': ev['headline']})

        winner, reason = room.check_winner()
        if winner:
            room.winner = winner
            room.winner_reason = reason
            room.phase = 'finished'
        else:
            room.phase = 'morning'

    def _resolve_day_vote(self, room: MafiaRoom):
        tally = room.vote_tally()
        counts: dict[str, int] = tally['counts']
        # Считаем голоса за конкретных игроков (skip не изгоняет никого, но если skip лидирует — никого не изгоняют)
        eliminated: MafiaPlayer | None = None
        if counts:
            sorted_items = sorted(counts.items(), key=lambda kv: -kv[1])
            top_id, top_n = sorted_items[0]
            tied = [tid for tid, c in sorted_items if c == top_n]
            if len(tied) == 1 and top_id != 'skip' and top_id in room.players and room.players[top_id].alive:
                eliminated = room.players[top_id]

        if eliminated:
            eliminated.alive = False
            eliminated.eliminated_round = room.round_num
            eliminated.eliminated_reason = 'vote'
            ev: dict[str, Any] = {
                'kind': 'vote_eliminated',
                'round': room.round_num,
                'target_id': eliminated.id,
                'target_name': eliminated.name,
                'target_avatar': eliminated.avatar,
                'votes_count': counts.get(eliminated.id, 0),
                'headline': f'По решению города выбыл(а) {eliminated.name}',
                'sub': f'Роль: {ROLE_META[eliminated.role]["emoji"]} {ROLE_META[eliminated.role]["title"]}' if room.reveal_role_on_death else 'Роль остаётся тайной до конца игры.',
            }
            if room.reveal_role_on_death:
                ev['target_role'] = eliminated.role
                ev['target_role_title'] = ROLE_META[eliminated.role]['title']
        else:
            ev = {
                'kind': 'vote_tie',
                'round': room.round_num,
                'headline': 'Голоса разделились — сегодня никто не выбыл!',
                'sub': 'Город не пришёл к единому решению и готовится к следующей ночи.',
            }

        room.last_event = ev
        room.history.append({'phase': f'День {room.round_num}', 'text': ev['headline']})

        winner, reason = room.check_winner()
        if winner:
            room.winner = winner
            room.winner_reason = reason
            room.phase = 'finished'
        else:
            room.phase = 'day_result'

    async def receive(self, text_data=None, bytes_data=None):
        room = MAFIA_ROOMS.get(self.pin)
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
            if self.client_kind is not None:
                return
            secret = str(msg.get('secret') or '')
            if not secret or not hmac.compare_digest(secret, room.host_secret):
                await self.send_json({'type': 'error', 'message': 'Неверный ключ ведущего'})
                await self.close(code=4403)
                return
            self.client_kind = 'host'
            if not self._in_group:
                await self.channel_layer.group_add(self.group_name, self.channel_name)
                self._in_group = True
            await self.send_json(self._build_host_payload(room))
            return

        # --- ВХОД / ПЕРЕПОДКЛЮЧЕНИЕ ИГРОКА ---
        if mtype == 'player_join':
            if self.client_kind is not None:
                return
            reconnect_token = str(msg.get('token') or '').strip()
            if reconnect_token:
                found = next((p for p in room.players.values() if hmac.compare_digest(p.token, reconnect_token)), None)
                if found:
                    found.connected = True
                    self.client_kind = 'player'
                    self.player_id = found.id
                    if not self._in_group:
                        await self.channel_layer.group_add(self.group_name, self.channel_name)
                        self._in_group = True
                    await self._broadcast_state(room)
                    return

            if room.phase != 'lobby':
                await self.send_json({'type': 'error', 'message': 'Игра уже началась! Подожди следующую партию.'})
                await self.close(code=4403)
                return
            if len(room.active_players()) >= MAX_PLAYERS_MAFIA:
                await self.send_json({'type': 'error', 'message': 'Комната заполнена (максимум 40 игроков)'})
                await self.close(code=4403)
                return
            name = str(msg.get('name') or '').strip()[:22]
            if not name:
                await self.send_json({'type': 'error', 'message': 'Введи своё имя'})
                return
            # Уникализируем одинаковые имена
            existing_names = {p.name.lower() for p in room.active_players()}
            final_name = name
            suffix = 2
            while final_name.lower() in existing_names:
                final_name = f'{name[:18]} {suffix}'
                suffix += 1
            avatar = str(msg.get('avatar') or 'av:fox:none:blook')[:48]
            pid = f'm_{secrets.token_hex(5)}'
            ptoken = secrets.token_hex(12)
            room.players[pid] = MafiaPlayer(id=pid, token=ptoken, name=final_name, avatar=avatar)
            self.client_kind = 'player'
            self.player_id = pid
            if not self._in_group:
                await self.channel_layer.group_add(self.group_name, self.channel_name)
                self._in_group = True
            await self._broadcast_state(room)
            return

        # --- КОМАНДЫ ВЕДУЩЕГО ---
        if self.client_kind == 'host':
            if mtype == 'update_config' and room.phase == 'lobby':
                room.mafia_count = _clamp_int(msg.get('mafia_count'), 1, 5, room.mafia_count)
                room.don_count = _clamp_int(msg.get('don_count'), 0, 1, room.don_count)
                room.doctor_count = _clamp_int(msg.get('doctor_count'), 0, 2, room.doctor_count)
                room.sheriff_count = _clamp_int(msg.get('sheriff_count'), 0, 2, room.sheriff_count)
                room.discuss_seconds = _clamp_int(msg.get('discuss_seconds'), 30, 300, room.discuss_seconds)
                if 'reveal_role_on_death' in msg:
                    room.reveal_role_on_death = bool(msg.get('reveal_role_on_death'))
                await self._broadcast_state(room)
                return

            if mtype == 'add_bots' and room.phase == 'lobby':
                want = _clamp_int(msg.get('count'), 1, 8, 5)
                used = {p.name for p in room.players.values()}
                added = 0
                for bname, bav in BOT_PRESETS:
                    if added >= want or len(room.active_players()) >= MAX_PLAYERS_MAFIA:
                        break
                    if bname in used:
                        continue
                    bid = f'bot_{secrets.token_hex(4)}'
                    room.players[bid] = MafiaPlayer(
                        id=bid, token=secrets.token_hex(8), name=bname, avatar=bav, is_bot=True
                    )
                    used.add(bname)
                    added += 1
                await self._broadcast_state(room)
                return

            if mtype == 'kick_player':
                tid = str(msg.get('player_id') or '')
                if tid in room.players:
                    room.players.pop(tid, None)
                    await self.channel_layer.group_send(self.group_name, {'type': 'mafia.kick', 'player_id': tid})
                    await self._broadcast_state(room)
                return

            if mtype == 'start_game' and room.phase == 'lobby':
                err = self._assign_roles(room)
                if err:
                    await self.send_json({'type': 'toast', 'level': 'error', 'message': err})
                    return
                await self._broadcast_state(room)
                return

            if mtype == 'start_night' and room.phase in ('role_reveal', 'morning', 'day_discuss', 'day_result'):
                if room.phase == 'day_result':
                    room.round_num += 1
                room.phase = 'night'
                room.mafia_picks.clear()
                room.don_checks.clear()
                room.doctor_picks.clear()
                room.sheriff_checks.clear()
                room.decoy_done.clear()
                room.day_votes.clear()
                room.night_riddle_idx = (room.night_riddle_idx + 1) % len(NIGHT_DECOY_RIDDLES)
                room.cancel_tasks()
                room.bot_task = asyncio.create_task(self._run_bot_night_actions(room, room.round_num))
                await self._broadcast_state(room)
                return

            if mtype == 'end_night' and room.phase == 'night':
                room.cancel_tasks()
                self._resolve_night(room)
                await self._broadcast_state(room)
                return

            if mtype == 'start_discuss' and room.phase in ('morning', 'role_reveal'):
                room.phase = 'day_discuss'
                room.discuss_paused_rem = 0
                room.discuss_ends_at = time.time() + room.discuss_seconds
                await self._broadcast_state(room)
                return

            if mtype == 'discuss_timer_ctl' and room.phase == 'day_discuss':
                action = str(msg.get('action') or '')
                if action == 'pause':
                    if room.discuss_paused_rem <= 0:
                        room.discuss_paused_rem = max(1, int(round(room.discuss_ends_at - time.time())))
                    else:
                        room.discuss_ends_at = time.time() + room.discuss_paused_rem
                        room.discuss_paused_rem = 0
                elif action == 'add30':
                    if room.discuss_paused_rem > 0:
                        room.discuss_paused_rem += 30
                    else:
                        room.discuss_ends_at = max(time.time(), room.discuss_ends_at) + 30
                await self._broadcast_state(room)
                return

            if mtype == 'start_vote' and room.phase in ('morning', 'day_discuss'):
                room.phase = 'day_vote'
                room.day_votes.clear()
                room.cancel_tasks()
                room.bot_task = asyncio.create_task(self._run_bot_day_votes(room, room.round_num))
                await self._broadcast_state(room)
                return

            if mtype == 'end_vote' and room.phase == 'day_vote':
                room.cancel_tasks()
                self._resolve_day_vote(room)
                await self._broadcast_state(room)
                return

            if mtype == 'restart_game':
                room.cancel_tasks()
                room.phase = 'lobby'
                room.round_num = 0
                room.winner = ''
                room.winner_reason = ''
                room.last_event = {}
                room.history.clear()
                room.mafia_picks.clear()
                room.don_checks.clear()
                room.doctor_picks.clear()
                room.sheriff_checks.clear()
                room.decoy_done.clear()
                room.day_votes.clear()
                for p in room.players.values():
                    p.alive = True
                    p.role = 'citizen'
                    p.last_healed_id = ''
                    p.sheriff_log = []
                    p.don_log = []
                    p.eliminated_round = 0
                    p.eliminated_reason = ''
                await self._broadcast_state(room)
                return

            if mtype == 'close_room':
                room.cancel_tasks()
                MAFIA_ROOMS.pop(self.pin, None)
                await self.channel_layer.group_send(self.group_name, {'type': 'mafia.closed'})
                return

        # --- ДЕЙСТВИЯ ИГРОКОВ ---
        if self.client_kind == 'player' and self.player_id:
            p = room.players.get(self.player_id)
            if not p or not p.alive:
                return

            # Ночные действия
            if mtype == 'night_action' and room.phase == 'night':
                action_kind = str(msg.get('kind') or '')
                target_id = str(msg.get('target_id') or '')

                if action_kind == 'decoy' and p.role == 'citizen':
                    room.decoy_done.add(p.id)
                    await self._broadcast_state(room)
                    return

                target = room.players.get(target_id)
                if not target or not target.alive:
                    return

                if action_kind == 'mafia_kill' and p.role in ('mafia', 'don'):
                    room.mafia_picks[p.id] = target.id
                    await self._broadcast_state(room)
                    return

                if action_kind == 'don_check' and p.role == 'don':
                    if p.id in room.don_checks or target.id == p.id:
                        return
                    room.don_checks[p.id] = target.id
                    p.don_log.append({
                        'round': room.round_num,
                        'target_id': target.id,
                        'target_name': target.name,
                        'is_sheriff': target.role == 'sheriff',
                    })
                    await self._broadcast_state(room)
                    return

                if action_kind == 'doctor_heal' and p.role == 'doctor':
                    if target.id == p.last_healed_id:
                        await self.send_json({
                            'type': 'toast',
                            'level': 'error',
                            'message': 'Нельзя лечить одного и того же игрока две ночи подряд!',
                        })
                        return
                    room.doctor_picks[p.id] = target.id
                    await self._broadcast_state(room)
                    return

                if action_kind == 'sheriff_check' and p.role == 'sheriff':
                    if p.id in room.sheriff_checks or target.id == p.id:
                        return
                    room.sheriff_checks[p.id] = target.id
                    p.sheriff_log.append({
                        'round': room.round_num,
                        'target_id': target.id,
                        'target_name': target.name,
                        'is_mafia': target.role in ('mafia', 'don'),
                    })
                    await self._broadcast_state(room)
                    return

            # Дневное голосование
            if mtype == 'day_vote' and room.phase == 'day_vote':
                target_id = str(msg.get('target_id') or '')
                if target_id == 'skip':
                    room.day_votes[p.id] = 'skip'
                    await self._broadcast_state(room)
                    return
                target = room.players.get(target_id)
                if target and target.alive and target.id != p.id:
                    room.day_votes[p.id] = target.id
                    await self._broadcast_state(room)
                    return
