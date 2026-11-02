# -*- coding: utf-8 -*-
"""Генератор продуктовых UI-звуков EduPlatform v3 (python scripts/gen_ui_sounds.py).

Студийный пайплайн: numpy-синтез -> pedalboard (Компрессор → Реверб → Лимитер) -> mp3.
Синтез теперь органический: настоящие негармонические колокольчики, Karplus-Strong
щипковые, слоистые ударные. Референс — Kahoot/Linear/Stripe: коротко, дорого, ярко.

Dep: pip install numpy pedalboard + ffmpeg в PATH.
"""
import numpy as np, subprocess, os, wave
from pedalboard import Pedalboard, Compressor, Reverb, Limiter, HighpassFilter, Gain

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
    """Настоящий ударный колокол: негармонические модовые частоты, каждая со своим затуханием.
    Моды как у диска-конуса (glockenspiel/vibraphone-семейство): 1, 2.756, 5.404, 8.933, 13.34."""
    f = p2f(pitch)
    partials = (
        (1.000, 1.00, 1.00),
        (2.756, 0.75, 0.60),   # выше модa — быстрее умирает
        (5.404, 0.45, 0.35),
        (8.933, 0.22, 0.18),
        (13.34, 0.10, 0.10),
    )
    add_osc(buf, f, start, min(1.6, tau * 8), tau, amp * 0.85,
            partials=partials, atk=0.0015)
    if shimmer:  # «стекло» на атаке
        add_osc(buf, f * 2.756, start, 0.12, 0.03, amp * shimmer, atk=0.0005)

def pluck(buf, pitch, start, amp=1.0, damp=0.35):
    """Karplus-Strong: физическая модель щипка — живой, тёплый, как каtool-укулеле-страта."""
    f = p2f(pitch)
    N = max(2, int(SR / f))
    n = int(0.9 * SR)
    burst = rng.uniform(-1, 1, N)
    out = np.zeros(n)
    buf_ring = burst.copy()
    for i in range(n):
        out[i] = buf_ring[i % N]
        buf_ring[i % N] = damp * 0.5 * (buf_ring[i % N] + buf_ring[(i + 1) % N])
    n0 = int(start * SR)
    a = min(int(0.001 * SR), n)
    out[:a] *= np.linspace(0, 1, a)
    tail = len(buf) - n0
    buf[n0:n0 + min(n, tail)] += amp * out[:min(n, tail)]

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
    noise(buf, start, 0.02, amp * 0.5, tau=0.005, hp=0.0)   # транзиент-клик
    add_osc(buf, 55, start, 0.18, 0.06, amp * 0.35, atk=0.001)

def snare(buf, start, amp=1.0):
    noise(buf, start, 0.14, amp * 0.8, tau=0.04, hp=0.35)
    add_osc(buf, 190, start, 0.08, 0.025, amp * 0.45, atk=0.0005)
    add_osc(buf, 255, start, 0.06, 0.02, amp * 0.3, atk=0.0005)

def hat(buf, start, amp=1.0, open_=False):
    noise(buf, start, 0.16 if open_ else 0.045, amp * 0.45, tau=0.012 if not open_ else 0.05, hp=0.9)

def clap(buf, start, amp=1.0):
    for k, a in enumerate((0.55, 0.75, 1.0)):
        noise(buf, start + k * 0.011, 0.045, amp * a * 0.65, tau=0.009, hp=0.55)

def finish(name, buf, extra_tail=0.45, room=0.14, level=0.88):
    # хвост под реверб
    total = int(extra_tail * SR)
    buf = np.concatenate([buf, np.zeros(total)])
    n = int(0.04 * SR)
    buf[-n:] *= np.linspace(1, 0, n)
    mono = buf.copy()
    # студийная цепочка: компрессор → lёгкий реверб → лимитер
    board = Pedalboard([HighpassFilter(cutoff_frequency_hz=70.0),
                        Compressor(threshold_db=-16, ratio=2.8, attack_ms=4, release_ms=90),
                        Reverb(room_size=room, damping=0.5, wet_level=room, dry_level=1.0, width=0.8),
                        Limiter(threshold_db=-2.0, release_ms=60)])
    lim = board(mono.astype(np.float32), SR)
    peak = np.max(np.abs(lim)) or 1.0
    lim = lim / peak * level
    # стерео: правый чуть отложен + Haas — ширина как у продакшна
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

# ── ui-success «верно!» — стальной Glockenspiel D5→F#5→A5 + щипковая база + искры
b = np.zeros(int(0.85 * SR))
for i, p in enumerate((74, 78, 81)):
    pluck(b, p - 12, i * 0.09, 0.16, damp=0.30)                       # тёплая база под цокком
    bell(b, p, i * 0.09, 0.8 if i < 2 else 1.0, tau=0.26 if i < 2 else 0.42, shimmer=0.5)
noise(b, 0.20, 0.30, 0.12, tau=0.10, hp=0.85)                          # серебристые искры
finish('ui-success', b, room=0.12)

# ── ui-error «мимо!» — тёплое двунотное падение, доброе, короткое
b = np.zeros(int(0.8 * SR))
add_osc(b, p2f(45), 0.0, 0.30, 0.14, 0.6, ((1, 1), (2, 0.2, 0.6), (3, 0.06, 0.3)), atk=0.004)
add_osc(b, p2f(41), 0.20, 0.38, 0.18, 0.55, ((1, 1), (2, 0.18, 0.6)), atk=0.004)
sweep(b, 150, 100, 0.20, 0.3, 0.4, 0.10)
noise(b, 0.0, 0.05, 0.15, tau=0.012, hp=0.2)                          # мягкий «стук» начала
finish('ui-error', b, room=0.08)

# ── ui-notify — кристальный пинг E6, длинный хвост
b = np.zeros(int(0.5 * SR))
bell(b, 88, 0.0, 0.95, tau=0.5, shimmer=0.3)
finish('ui-notify', b, room=0.18)

# ── ui-win «финал!» — фанфара с грувом: кик/клэп/снейр + рун вверх + вершина + тарелка
b = np.zeros(int(1.7 * SR))
kick(b, 0.0, 1.0); hat(b, 0.05, 0.7); hat(b, 0.22, 0.5)
for i, p in enumerate((72, 76, 79)):                                  # мажорная тройка
    bell(b, p, 0.03 + i * 0.05, 0.55, tau=0.22)
clap(b, 0.24, 0.85)
kick(b, 0.28, 0.8)
for i, p in enumerate((84, 88, 91, 96)):                              # рун вверх C6→C7
    bell(b, p, 0.44 + i * 0.085, 0.45, tau=0.3, shimmer=0.3)
    hat(b, 0.44 + i * 0.085, 0.25)
snare(b, 0.80, 0.85)
kick(b, 0.80, 0.9)
bell(b, 96, 0.82, 0.85, tau=0.6, shimmer=0.4)                         # C7 вершина
add_osc(b, p2f(48), 0.80, 0.5, 0.22, 0.4, atk=0.002)                   # бас-корень C3
noise(b, 0.82, 0.7, 0.16, tau=0.22, hp=0.85)                           # тарелка/блеск
hat(b, 1.04, 0.4, open_=True)
finish('ui-win', b, room=0.16)

# ── ui-save — дабл-вудблок с хрустом
b = np.zeros(int(0.42 * SR))
for i, a in enumerate((0.85, 1.0)):
    add_osc(b, p2f(93 + i * 2), i * 0.11, 0.10, 0.045, a * 0.5, ((1, 1), (4.2, 0.4, 0.3), (7.9, 0.15, 0.15)), atk=0.0008)
    noise(b, i * 0.11, 0.045, 0.3 * a, tau=0.006, hp=0.5)
finish('ui-save', b, room=0.06, extra_tail=0.25)

# ── ui-pop — упругий пузырь с жидким телом
b = np.zeros(int(0.28 * SR))
sweep(b, 380, 880, 0.0, 0.055, 0.9, 0.035, curve=0.6)
add_osc(b, 500, 0.0, 0.10, 0.05, 0.25, atk=0.0008)
noise(b, 0.0, 0.02, 0.22, tau=0.005, hp=0.6)
finish('ui-pop', b, room=0.05, extra_tail=0.2)

# ── ui-start «поехали!» — кик, подъём, «GO»-колокол, клэп
b = np.zeros(int(1.1 * SR))
kick(b, 0.0, 1.0)
sweep(b, 200, 900, 0.06, 0.40, 0.35, 0.22, curve=1.5)
hat(b, 0.20, 0.6); hat(b, 0.33, 0.75)
bell(b, 72, 0.50, 0.95, tau=0.45, shimmer=0.35)
bell(b, 84, 0.50, 0.6, tau=0.45, shimmer=0.35)
clap(b, 0.50, 1.0)
kick(b, 0.50, 0.8)
finish('ui-start', b, room=0.12)

print('all done ->', OUT)
