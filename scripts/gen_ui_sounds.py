# -*- coding: utf-8 -*-
"""Генератор продуктового набора UI-звуков EduPlatform v2 (python scripts/gen_ui_sounds.py).

Референс по духу — Kahoot: яркий, упругий, музыкальный, с перкуссией.
Синтез numpy -> WAV -> ffmpeg mp3. Всего один источник правды по звуку.

Набор (frontend/public/sounds/):
  ui-success.mp3 — «правильно»: упругий трёхнотный мажорный колокольчик + блеск (правильный ответ)
  ui-error.mp3   — «неправильно»: мягкое «воп-воп» вниз (как в Kahoot, но добрее)
  ui-notify.mp3  — «уведомление»: яркий одиночный пинг
  ui-win.mp3     — «финал»: фанфара = мажорный стаб + восходящий рун + кик/снейр + искры
  ui-save.mp3    — «сохранено»: дабл-вудблок
  ui-pop.mp3     — «поп»: упругий пузырь
  ui-start.mp3   — «старт»: кик + подъём + «GO»-колокол (запуск теста/игры)
"""
import numpy as np, subprocess, os, wave

SR = 44100
OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'sounds'))
rng = np.random.default_rng(20260215)

def p2f(p): return 440.0 * 2 ** ((p - 69) / 12.0)

def _env(n, tau, atk=0.002):
    x = np.arange(n) / SR
    e = np.exp(-x / tau)
    a = max(1, min(int(atk * SR), n))
    e[:a] *= np.linspace(0, 1, a) ** 1.5
    return e

def add_osc(buf, f, start, dur, tau, amp, partials=((1, 1.0),), TAU_TILT=1.0):
    n0 = int(start * SR); n = min(len(buf) - n0, int(dur * SR))
    if n <= 0: return
    x = np.arange(n) / SR
    s = np.zeros(n)
    for pr in partials:
        ratio, pa = pr[0], pr[1]
        ptau = pr[2] if len(pr) > 2 else TAU_TILT
        s += pa * np.sin(2 * np.pi * f * ratio * x) * np.exp(-x / (tau * ptau))
    buf[n0:n0 + n] += amp * s * _env(n, tau)

def add_fm(buf, f, start, dur, tau, amp, index=3.0, ratio=2.0, fm_decay=None):
    """FM-тембр (колокол/электропиано): carrier + модулятор*ratio."""
    n0 = int(start * SR); n = min(len(buf) - n0, int(dur * SR))
    if n <= 0: return
    x = np.arange(n) / SR
    mod_env = np.exp(-x / (fm_decay or tau * 0.35))
    phase_c = 2 * np.pi * f * x
    phase_m = 2 * np.pi * f * ratio * x
    s = np.sin(phase_c + index * mod_env * np.sin(phase_m))
    n64 = max(1, min(int(0.003 * SR), n))
    s[:n64] *= np.linspace(0, 1, n64)
    buf[n0:n0 + n] += amp * s * _env(n, tau)

def add_sweep(buf, f0, f1, start, dur, amp, tau, curve=1.0):
    n0 = int(start * SR); n = min(len(buf) - n0, int(dur * SR))
    if n <= 0: return
    x = np.arange(n) / SR
    f = f0 + (f1 - f0) * (x / dur) ** curve
    ph = 2 * np.pi * np.cumsum(f) / SR
    buf[n0:n0 + n] += amp * np.sin(ph) * _env(n, tau)

def add_noise(buf, start, dur, amp, tau, hp=0.15, bp_lo=None, bp_hi=None):
    n0 = int(start * SR); n = min(len(buf) - n0, int(dur * SR))
    if n <= 0: return
    w = rng.standard_normal(n)
    lp = np.convolve(w, np.ones(4) / 4, 'same')
    band = w - lp * (1 - hp)
    if bp_lo:
        # мягкий band-pass:Prop разность двух скользящих средних
        k = max(2, int(SR / bp_lo) // 2)
        lp1 = np.convolve(w, np.ones(k) / k, 'same')
        k2 = max(2, int(SR / (bp_hi or bp_lo * 3)))
        lp2 = np.convolve(w, np.ones(k2) / k2, 'same')
        band = lp1 - lp2
    buf[n0:n0 + n] += amp * band * _env(n, tau, atk=0.001)

def kick(buf, start, amp=1.0, f0=150.0, f1=42.0, tau=0.09):
    add_sweep(buf, f0, f1, start, 0.22, amp, tau)
    add_noise(buf, start, 0.03, amp * 0.4, tau=0.008, hp=0.1)

def snare(buf, start, amp=1.0):
    add_noise(buf, start, 0.16, amp * 0.9, tau=0.045, hp=0.3)
    add_osc(buf, 185, start, 0.09, 0.03, amp * 0.5)

def hat(buf, start, amp=1.0):
    add_noise(buf, start, 0.05, amp * 0.5, tau=0.012, hp=0.9)

def clap(buf, start, amp=1.0):
    for k, a in enumerate((0.6, 0.8, 1.0)):
        add_noise(buf, start + k * 0.012, 0.05, amp * a * 0.7, tau=0.01, hp=0.5)

def bell_note(buf, pitch, start, amp=1.0, tau=0.22, bright=1.0):
    f = p2f(pitch)
    add_fm(buf, f, start, min(1.2, tau * 7 + 0.4), tau, amp * 0.9, index=2.2 * bright, ratio=2.01, fm_decay=0.07)
    add_osc(buf, f, start, min(1.0, tau * 6 + 0.3), tau, amp * 0.4,
            partials=((1, 1.0, 1.0), (3.02, 0.2 * bright, 0.5), (5.4, 0.06 * bright, 0.3)))

def soft_note(buf, pitch, start, amp=1.0, tau=0.2, detune=0.004):
    f = p2f(pitch)
    add_osc(buf, f * (1 - detune), start, tau * 6, tau, amp * 0.55, ((1, 1, 1), (2, 0.06, 0.7)))
    add_osc(buf, f * (1 + detune), start, tau * 6, tau, amp * 0.55, ((1, 1, 1), (2, 0.06, 0.7)))

def finish(name, buf, level=0.86, punch=True):
    fade = int(0.05 * SR)
    buf[-fade:] *= np.linspace(1, 0, fade)
    if punch:
        buf = np.tanh(buf * 1.25)          # мягкий софт-клип: плотность без клиппинга
    peak = np.max(np.abs(buf)) or 1.0
    buf = buf / peak * level
    d = int(0.009 * SR)                    # стерео-ширина
    right = np.zeros_like(buf); right[d:] = buf[:-d]
    st = np.stack([buf, 0.88 * right + 0.12 * buf], axis=1)
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

# — ui-success: «это верно!» — упругий D5→F#5→A5 колокольчик + искры (Kahoot-vibe)
b = np.zeros(int(0.95 * SR))
for i, p in enumerate((74, 78, 81)):
    bell_note(b, p, i * 0.085, 0.95 if i < 2 else 1.0, tau=0.24 if i < 2 else 0.4)
add_noise(b, 0.17, 0.35, 0.16, tau=0.12, hp=0.85)          # искры
add_osc(b, p2f(98), 0.255, 0.3, 0.18, 0.10, ((1, 1, 1),))   # верхняя подсказка D6
finish('ui-success', b)

# — ui-error: мягкое «воп-воп» вниз, но доброе
b = np.zeros(int(0.85 * SR))
soft_note(b, 45, 0.0, 0.85, tau=0.16, detune=0.006)         # A2
soft_note(b, 41, 0.19, 0.9, tau=0.22, detune=0.006)         # F2
add_sweep(b, 140, 95, 0.19, 0.3, 0.45, 0.12)
soft_note(b, 33, 0.19, 0.5, tau=0.25)
finish('ui-error', b, punch=False)

# — ui-notify: яркий пинг (колокольчик E6)
b = np.zeros(int(1.05 * SR))
bell_note(b, 88, 0.0, 1.0, tau=0.5, bright=1.3)
add_noise(b, 0.0, 0.1, 0.08, tau=0.03, hp=0.9)
finish('ui-notify', b)

# — ui-win: финал как в Kahoot: мажор-стаб C-мажор + восходящий рун + кик/снейр + искры
b = np.zeros(int(2.1 * SR))
kick(b, 0.0, 1.0); hat(b, 0.03, 0.8)
for i, p in enumerate((72, 76, 79, 84)):                    # C5 E5 G5 C6
    add_osc(b, p2f(p), i * 0.055, 0.5, 0.16, 0.5, ((1, 1, 1), (2, 0.22, 0.6)))
clap(b, 0.28, 0.9)
for i, p in enumerate((84, 88, 91, 96)):                   # верхний рун
    bell_note(b, p, 0.42 + i * 0.09, 0.5, tau=0.3)
add_osc(b, p2f(60), 0.42, 0.8, 0.3, 0.35, ((1, 1, 1),))   # bass root
snare(b, 0.86, 0.8)
bell_note(b, 96, 0.86, 0.9, tau=0.55, bright=1.2)          # финальная вершина C7
add_noise(b, 0.86, 0.6, 0.18, tau=0.25, hp=0.8)            # блеск
kick(b, 0.0 + 0.86, 0.9)
finish('ui-win', b)

# — ui-save: дабл-вудблок (сохранено)
b = np.zeros(int(0.5 * SR))
for i, a in enumerate((0.9, 1.0)):
    add_osc(b, p2f(93 + i * 2), i * 0.12, 0.09, 0.05, a * 0.5, ((1, 1, 1), (4.2, 0.5, 0.35), (7.9, 0.2, 0.2)))
    add_noise(b, i * 0.12, 0.05, 0.25 * a, tau=0.008, hp=0.4)
finish('ui-save', b)

# — ui-pop: упругий пузырь
b = np.zeros(int(0.3 * SR))
add_sweep(b, 420, 900, 0.0, 0.06, 0.9, 0.04, curve=0.7)
add_noise(b, 0.0, 0.03, 0.3, tau=0.007, hp=0.6)
finish('ui-pop', b)

# — ui-start: кик + подъём + «GO» (запуск теста/игры)
b = np.zeros(int(1.3 * SR))
kick(b, 0.0, 1.0)
add_sweep(b, 220, 880, 0.05, 0.42, 0.4, 0.25, curve=1.4)   # подъём
hat(b, 0.24, 0.7); hat(b, 0.36, 0.8)
bell_note(b, 72, 0.5, 1.0, tau=0.45, bright=1.15)          # «GO» C5
bell_note(b, 84, 0.5, 0.7, tau=0.45, bright=1.15)
clap(b, 0.5, 1.0)
finish('ui-start', b)

print('all done ->', OUT)
