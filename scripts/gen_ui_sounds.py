# -*- coding: utf-8 -*-
"""Генератор ВСЕХ mp3-звуков EduPlatform (кроме этно-набора Аркан тартыш arkan-*.mp3).

python scripts/gen_ui_sounds.py   # нужны: numpy, pedalboard, ffmpeg в PATH

Один движок = одна звуковая семья: негармонические модовые колокольчики (как у
настоящего вибрафона), Karplus-Strong щипки, слоистые ударные, студийная цепочка
компрессор → реверб → лимитер (pedalboard, Spotify).

Файлы (frontend/public/sounds/):
  ── UI-набор (тосты, тесты, заметки, классрум) ─────────────────────
  ui-success.mp3  «верно»     — глокеншпиль D5→F#5→A5 + щипковая база + искры
  ui-error.mp3    «мимо»      — тёплое двунотное падение вниз
  ui-notify.mp3   уведомление — кристальный пинг E6 с длинным хвостом
  ui-win.mp3      «финал!»    — чистая фанфара: кик → мажор → рун вверх → двойной колокол
  ui-start.mp3    «поехали»   — кик + подъём + GO-колокол + клэп
  ui-save.mp3     сохранено   — дабл-вудблок
  ui-pop.mp3      поп         — упругий пузырь
  ── Игровой фолбэк (если arkan-* или синт недоступен) ──────────────
  correct.mp3, wrong.mp3, win.mp3, go.mp3, tick.mp3  — та же семья
  ── Рингтоны таймера заметок ─────────────────────────────────────
  standard.mp3, wave.mp3, alarm.mp3, notify.mp3      — 2–3 c, зациклимы
  ── Спринт печати ────────────────────────────────────────────────
  type.mp3       — тихий клавишный ктик
"""
import numpy as np, subprocess, os, wave
from pedalboard import Pedalboard, Compressor, Reverb, Limiter, HighpassFilter

SR = 44100
OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'sounds'))
rng = np.random.default_rng(20260215)

def p2f(p): return 440.0 * 2 ** ((p - 69) / 12.0)

def _env(n, tau, atk=0.002, curve=1.0):
    x = np.arange(n) / SR
    e = np.exp(-x / tau)
    a = max(1, min(int(atk * SR), n))
    e[:a] *= np.linspace(0, 1, a) ** curve
    return e

def add_osc(buf, f, start, dur, tau, amp, partials=((1, 1),), atk=0.002):
    n0 = int(start * SR); n = min(len(buf) - n0, int(dur * SR))
    if n <= 0: return
    x = np.arange(n) / SR
    s = np.zeros(n)
    for pr in partials:
        ratio, pa = pr[0], pr[1]
        ptau = pr[2] if len(pr) > 2 else 1.0
        s += pa * np.sin(2 * np.pi * f * ratio * x) * np.exp(-x / (tau * ptau))
    buf[n0:n0 + n] += amp * s * _env(n, tau, atk)

def bell(buf, pitch, start, amp=1.0, tau=0.28, shimmer=0.0):
    """Ударный колокол: негармонические моды диска (1, 2.756, 5.404, 8.933), свои затухания."""
    f = p2f(pitch)
    partials = (
        (1.000, 1.00, 1.00),
        (2.756, 0.75, 0.60),
        (5.404, 0.45, 0.35),
        (8.933, 0.22, 0.18),
        (13.34, 0.10, 0.10),
    )
    add_osc(buf, f, start, min(1.6, tau * 8), tau, amp * 0.85, partials=partials, atk=0.0015)
    if shimmer:
        add_osc(buf, f * 2.756, start, 0.12, 0.03, amp * shimmer, atk=0.0005)

def pluck(buf, pitch, start, amp=1.0, damp=0.35):
    """Karplus-Strong: физическая модель щипнутой струны."""
    f = p2f(pitch)
    N = max(2, int(SR / f))
    n = int(0.9 * SR)
    ring = rng.uniform(-1, 1, N)
    out = np.zeros(n)
    for i in range(n):
        out[i] = ring[i % N]
        ring[i % N] = damp * 0.5 * (ring[i % N] + ring[(i + 1) % N])
    n0 = int(start * SR)
    a = min(int(0.001 * SR), n, len(buf) - n0)
    out[:a] *= np.linspace(0, 1, a)
    buf[n0:n0 + min(n, len(buf) - n0)] += amp * out[:min(n, len(buf) - n0)]

def sweep(buf, f0, f1, start, dur, amp, tau, curve=1.0):
    n0 = int(start * SR); n = min(len(buf) - n0, int(dur * SR))
    if n <= 0: return
    x = np.arange(n) / SR
    f = f0 + (f1 - f0) * (x / dur) ** curve
    buf[n0:n0 + n] += amp * np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n, tau)

def noise(buf, start, dur, amp, tau, hp=0.15):
    n0 = int(start * SR); n = min(len(buf) - n0, int(dur * SR))
    if n <= 0: return
    w = rng.standard_normal(n)
    lp = np.convolve(w, np.ones(4) / 4, 'same')
    band = w - lp * (1 - hp)
    buf[n0:n0 + n] += amp * band * _env(n, tau, atk=0.001)

def kick(buf, start, amp=1.0):
    sweep(buf, 160, 40, start, 0.25, amp, 0.085)
    noise(buf, start, 0.02, amp * 0.5, tau=0.005, hp=0.0)
    add_osc(buf, 55, start, 0.18, 0.06, amp * 0.35, atk=0.001)

def hat(buf, start, amp=1.0):
    noise(buf, start, 0.045, amp * 0.45, tau=0.012, hp=0.9)

def clap(buf, start, amp=1.0):
    for k, a in enumerate((0.55, 0.75, 1.0)):
        noise(buf, start + k * 0.011, 0.045, amp * a * 0.65, tau=0.009, hp=0.55)

def woodblock(buf, start, pitch, amp=1.0):
    add_osc(buf, p2f(pitch), start, 0.10, 0.045, amp * 0.5, ((1, 1), (4.2, 0.4, 0.3), (7.9, 0.15, 0.15)), atk=0.0008)
    noise(buf, start, 0.045, amp * 0.3, tau=0.006, hp=0.5)

FINISH = None

def finish(name, buf, extra_tail=0.45, room=0.14, level=0.88):
    total = int(extra_tail * SR)
    buf = np.concatenate([buf, np.zeros(total)])
    n = int(0.04 * SR)
    buf[-n:] *= np.linspace(1, 0, n)
    board = Pedalboard([HighpassFilter(cutoff_frequency_hz=70.0),
                        Compressor(threshold_db=-16, ratio=2.8, attack_ms=4, release_ms=90),
                        Reverb(room_size=room, damping=0.5, wet_level=room, dry_level=1.0, width=0.8),
                        Limiter(threshold_db=-2.0, release_ms=60)])
    lim = board(buf.astype(np.float32), SR)
    peak = np.max(np.abs(lim)) or 1.0
    lim = lim / peak * level
    d = int(0.008 * SR)
    right = np.concatenate([np.zeros(d), lim[:-d]]) * 0.6 + lim * 0.4
    st = np.stack([lim, right], axis=1)
    pcm = (st * 32767).astype(np.int16)
    wav = os.path.join(OUT, name + '.wav'); mp3 = os.path.join(OUT, name + '.mp3')
    with wave.open(wav, 'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav,
                    '-codec:a', 'libmp3lame', '-qscale:a', '2', mp3], check=True)
    os.remove(wav)
    print('ok', name + '.mp3')

os.makedirs(OUT, exist_ok=True)

# ══════════ UI-набор ══════════

# ui-success «верно» — глокеншпиль D5→F#5→A5
b = np.zeros(int(0.85 * SR))
for i, p in enumerate((74, 78, 81)):
    pluck(b, p - 12, i * 0.09, 0.16, damp=0.30)
    bell(b, p, i * 0.09, 0.8 if i < 2 else 1.0, tau=0.26 if i < 2 else 0.42, shimmer=0.5)
noise(b, 0.20, 0.30, 0.12, tau=0.10, hp=0.85)
finish('ui-success', b, room=0.12)

# ui-error «мимо» — тёплое двунотное падение
b = np.zeros(int(0.8 * SR))
add_osc(b, p2f(45), 0.0, 0.30, 0.14, 0.6, ((1, 1), (2, 0.2, 0.6), (3, 0.06, 0.3)), atk=0.004)
add_osc(b, p2f(41), 0.20, 0.38, 0.18, 0.55, ((1, 1), (2, 0.18, 0.6)), atk=0.004)
sweep(b, 150, 100, 0.20, 0.3, 0.4, 0.10)
noise(b, 0.0, 0.05, 0.15, tau=0.012, hp=0.2)
finish('ui-error', b, room=0.08)

# ui-notify — кристальный пинг E6
b = np.zeros(int(0.5 * SR))
bell(b, 88, 0.0, 0.95, tau=0.5, shimmer=0.3)
finish('ui-notify', b, room=0.18)

# ui-win «финал» — v4: ЧИСТО, БЕЗ КАШИ. Кик → мажорное трезвучие → короткий рун → двойной колокол.
b = np.zeros(int(1.45 * SR))
kick(b, 0.0, 0.95)
hat(b, 0.05, 0.6)
for i, p in enumerate((72, 76, 79)):          # C5 E5 G5, за 0.1с
    bell(b, p, 0.02 + i * 0.05, 0.6, tau=0.24)
clap(b, 0.16, 0.75)
for i, p in enumerate((84, 88, 91)):          # рун C6 E6 G6 по щелчку
    bell(b, p, 0.36 + i * 0.085, 0.5, tau=0.26, shimmer=0.3)
bell(b, 96, 0.62, 0.95, tau=0.6, shimmer=0.4) # вершина C6 (96 = C7? нет: C6=84, C7=96)
pluck(b, 36, 0.62, 0.15, damp=0.3)            # мягкий бас под вершину
noise(b, 0.62, 0.5, 0.10, tau=0.18, hp=0.85)  # тихий блеск
finish('ui-win', b, room=0.12)

# ui-start «поехали»
b = np.zeros(int(1.1 * SR))
kick(b, 0.0, 1.0)
sweep(b, 200, 900, 0.06, 0.40, 0.35, 0.22, curve=1.5)
hat(b, 0.20, 0.6); hat(b, 0.33, 0.75)
bell(b, 72, 0.50, 0.95, tau=0.45, shimmer=0.35)
bell(b, 84, 0.50, 0.6, tau=0.45, shimmer=0.35)
clap(b, 0.50, 1.0)
finish('ui-start', b, room=0.12)

# ui-save — дабл-вудблок
b = np.zeros(int(0.42 * SR))
woodblock(b, 0.00, 93, 0.85); woodblock(b, 0.11, 95, 1.0)
finish('ui-save', b, room=0.06, extra_tail=0.25)

# ui-pop — упругий пузырь
b = np.zeros(int(0.28 * SR))
sweep(b, 380, 880, 0.0, 0.055, 0.9, 0.035, curve=0.6)
add_osc(b, 500, 0.0, 0.10, 0.05, 0.25, atk=0.0008)
noise(b, 0.0, 0.02, 0.22, tau=0.005, hp=0.6)
finish('ui-pop', b, room=0.05, extra_tail=0.2)

# ══════════ Игровой фолбэк (та же семья, чуть ярче) ══════════

# correct — «верно» для игр: глокеншпиль + щипок (короче ui-success)
b = np.zeros(int(0.7 * SR))
for i, p in enumerate((74, 78, 81)):
    bell(b, p, i * 0.08, 0.85, tau=0.22 if i < 2 else 0.34, shimmer=0.3)
noise(b, 0.16, 0.22, 0.10, tau=0.09, hp=0.85)
finish('correct', b, room=0.10, extra_tail=0.3)

# wrong — «мимо» для игр: мягкое падение, доброе, без «сломанности»
b = np.zeros(int(0.7 * SR))
add_osc(b, p2f(45), 0.0, 0.26, 0.13, 0.65, ((1, 1), (2, 0.2, 0.6)), atk=0.004)
add_osc(b, p2f(41), 0.18, 0.32, 0.17, 0.6, ((1, 1), (2, 0.18, 0.6)), atk=0.004)
sweep(b, 150, 105, 0.18, 0.26, 0.35, 0.09)
finish('wrong', b, room=0.07, extra_tail=0.25)

# win — победа в играх: фанфара ui-win чуть компактнее
b = np.zeros(int(1.25 * SR))
kick(b, 0.0, 0.9)
for i, p in enumerate((72, 76, 79)):
    bell(b, p, 0.02 + i * 0.05, 0.55, tau=0.22)
clap(b, 0.15, 0.7)
for i, p in enumerate((84, 88, 91)):
    bell(b, p, 0.32 + i * 0.08, 0.45, tau=0.24, shimmer=0.25)
bell(b, 96, 0.56, 0.9, tau=0.55, shimmer=0.35)
noise(b, 0.56, 0.4, 0.09, tau=0.16, hp=0.85)
finish('win', b, room=0.11, extra_tail=0.3)

# go — старт: короткий «марш»
b = np.zeros(int(0.65 * SR))
kick(b, 0.0, 0.95)
bell(b, 72, 0.04, 0.7, tau=0.3)
bell(b, 79, 0.22, 1.0, tau=0.35, shimmer=0.3)
clap(b, 0.22, 0.9)
finish('go', b, room=0.10, extra_tail=0.28)

# tick — тихий клик-таймер
b = np.zeros(int(0.3 * SR))
woodblock(b, 0.0, 93, 0.9)
finish('tick', b, room=0.04, extra_tail=0.15)

# ══════════ Рингтоны таймера заметок (2–3 c) ══════════

# standard — мягкий колокольчик ×2
b = np.zeros(int(2.2 * SR))
bell(b, 88, 0.0, 0.9, tau=0.5, shimmer=0.25)
bell(b, 88, 0.9, 0.9, tau=0.5, shimmer=0.25)
bell(b, 92, 1.05, 0.35, tau=0.6, shimmer=0.2)
finish('standard', b, room=0.22, extra_tail=0.8)

# wave — восходящая волна из трёх нот
b = np.zeros(int(2.4 * SR))
bell(b, 85, 0.00, 0.8, tau=0.4, shimmer=0.25)
bell(b, 88, 0.55, 0.85, tau=0.4, shimmer=0.25)
bell(b, 93, 1.10, 1.0, tau=0.6, shimmer=0.3)
finish('wave', b, room=0.2, extra_tail=0.9)

# alarm — срочный тройной сигнал
b = np.zeros(int(2.6 * SR))
for k in range(3):
    add_osc(b, p2f(81), k * 0.8, 0.35, 0.16, 0.85, ((1, 1), (2.02, 0.4, 0.5)), atk=0.004)
    add_osc(b, p2f(85), k * 0.8 + 0.12, 0.3, 0.14, 0.6, ((1, 1),), atk=0.004)
    hat(b, k * 0.8, 0.3)
finish('alarm', b, room=0.10, extra_tail=0.5)

# notify — одиночное «дзынь» для напоминания
b = np.zeros(int(2.0 * SR))
bell(b, 90, 0.0, 1.0, tau=0.7, shimmer=0.3)
bell(b, 97, 0.25, 0.5, tau=0.8, shimmer=0.25)
finish('notify', b, room=0.22, extra_tail=0.9)

# ══════════ Спринт печати ══════════
b = np.zeros(int(0.25 * SR))
noise(b, 0.0, 0.03, 0.5, tau=0.006, hp=0.35)
add_osc(b, p2f(103), 0.0, 0.04, 0.02, 0.2, atk=0.0005)
finish('type', b, room=0.03, extra_tail=0.1)

print('all done ->', OUT)
