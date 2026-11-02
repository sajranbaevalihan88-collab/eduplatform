# -*- coding: utf-8 -*-
"""Генератор продуктового набора UI-звуков EduPlatform (восстановлен; python scripts/gen_ui_sounds.py).

Синтез через numpy -> WAV -> ffmpeg -> mp3 (libmp3lame). Без внешних ассетов, всё воспроизводимо.

Набор (frontend/public/sounds/):
  ui-success.mp3  — «готово»: мягкий двухнотный маримба-динь (сохранение, сдача, создание)
  ui-error.mp3    — «ошибка»: низкий двойной глухой стук, не пугающий
  ui-notify.mp3   — «уведомление»: стеклянный колокольчик
  ui-win.mp3      — «победа»: короткое восходящее арпеджио с блеском (тест пройден)
  ui-save.mp3     — «заметка/сохранение»: двойной тихий тик
  ui-pop.mp3      — «поп»: открытие панели/переключение
"""
import numpy as np, subprocess, os, wave

SR = 44100
OUT = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'sounds'))

def p2f(p): return 440.0 * 2 ** ((p - 69) / 12.0)

def note(buf, freq, start, dur, tau, amp=1.0, partials=((1, 1.0),)):
    """Аддитивный синтез ноты с экспоненциальным затуханием (tau — постоянная времени)."""
    n0 = int(start * SR)
    n1 = min(len(buf), n0 + int(dur * SR))
    if n0 >= len(buf): return
    x = np.arange(n1 - n0) / SR
    s = np.zeros(n1 - n0)
    for ratio, pa in partials:
        s += pa * np.sin(2 * np.pi * freq * ratio * x)
    env = np.exp(-x / tau)
    a = min(120, n1 - n0)
    env[:a] *= np.linspace(0, 1, a)          # атака ~3ms
    buf[n0:n1] += amp * s * env

def pitchdrop(buf, f0, f1, start, dur, amp=1.0, tau=0.1):
    """Тон со скольжением частоты (глухие «удары», пузыри)."""
    n0 = int(start * SR); n1 = min(len(buf), n0 + int(dur * SR))
    if n0 >= len(buf): return
    x = np.arange(n1 - n0) / SR
    f = f0 + (f1 - f0) * (x / dur)
    ph = 2 * np.pi * np.cumsum(f) / SR
    env = np.exp(-x / tau)
    a = min(60, n1 - n0); env[:a] *= np.linspace(0, 1, a)
    buf[n0:n1] += amp * np.sin(ph) * env

def noiseburst(buf, start, dur, amp, tau=0.02):
    """Шумовой всплеск (биение клавиши, «блеск», тик)."""
    n0 = int(start * SR); n1 = min(len(buf), n0 + int(dur * SR))
    if n0 >= len(buf): return
    x = np.arange(n1 - n0) / SR
    w = np.random.default_rng(7).standard_normal(n1 - n0)
    lp = np.convolve(w, np.ones(3) / 3, 'same')
    band = w - (w - lp) * 0.2
    env = np.exp(-x / tau); a = min(40, n1 - n0); env[:a] *= np.linspace(0, 1, a)
    buf[n0:n1] += amp * band * env

def finish(name, buf, fade=0.06):
    buf = buf.copy()
    n = int(fade * SR)
    buf[-n:] *= np.linspace(1, 0, n)
    peak = np.max(np.abs(buf)) or 1.0
    buf = buf / peak * 0.82
    d = int(0.007 * SR)                       # лёгкая стерео-ширина
    right = np.zeros_like(buf); right[d:] = buf[:-d]
    st = np.stack([buf, 0.92 * right + 0.08 * buf], axis=1)
    pcm = (st * 32767).astype(np.int16)
    wav = os.path.join(OUT, name + '.wav'); mp3 = os.path.join(OUT, name + '.mp3')
    with wave.open(wav, 'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes(pcm.tobytes())
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav,
                    '-codec:a', 'libmp3lame', '-qscale:a', '4', mp3], check=True)
    os.remove(wav)
    print('ok', name + '.mp3')

os.makedirs(OUT, exist_ok=True)

# — ui-success: тёплое «динь-динь» маримба, F5 → A5
b = np.zeros(int(0.75 * SR))
note(b, p2f(77), 0.00, 0.5, 0.16, 0.9, ((1, 1.0), (3.02, 0.22), (5.4, 0.06)))
note(b, p2f(81), 0.13, 0.5, 0.16, 1.0, ((1, 1.0), (3.02, 0.22), (5.4, 0.06)))
finish('ui-success', b)

# — ui-error: мягкий двойной глухой удар
b = np.zeros(int(0.6 * SR))
pitchdrop(b, 170, 118, 0.00, 0.16, 1.0, 0.06)
pitchdrop(b, 150, 105, 0.17, 0.20, 0.8, 0.07)
note(b, p2f(43), 0.00, 0.20, 0.08, 0.25)
finish('ui-error', b)

# — ui-notify: стеклянный колокольчик E6
b = np.zeros(int(1.0 * SR))
note(b, p2f(88), 0.0, 0.85, 0.55, 1.0, ((1, 1.0), (2.76, 0.35), (5.40, 0.10), (8.9, 0.03)))
finish('ui-notify', b)

# — ui-win: фанфара-арпеджио C5 E5 G5 C6 + блеск
b = np.zeros(int(1.8 * SR))
for i, p in enumerate((72, 76, 79)):
    note(b, p2f(p), i * 0.12, 0.35, 0.14, 0.9 if i < 2 else 1.0, ((1, 1.0), (2.0, 0.28), (4.0, 0.08)))
note(b, p2f(84), 0.36, 1.1, 0.5, 1.0, ((1, 1.0), (2.01, 0.3), (3.02, 0.12)))
noiseburst(b, 0.36, 0.5, 0.10, tau=0.15)
finish('ui-win', b)

# — ui-save: двойной тихий тик (заметка сохранена)
b = np.zeros(int(0.4 * SR))
noiseburst(b, 0.00, 0.05, 0.5, tau=0.012)
note(b, p2f(93), 0.00, 0.05, 0.10, 0.22)
noiseburst(b, 0.11, 0.05, 0.4, tau=0.012)
note(b, p2f(95), 0.11, 0.05, 0.10, 0.20)
finish('ui-save', b)

# — ui-pop: аккуратный пузырь (открытие панели/переключение)
b = np.zeros(int(0.25 * SR))
pitchdrop(b, 380, 860, 0.0, 0.07, 0.9, 0.04)
noiseburst(b, 0.0, 0.03, 0.25, tau=0.008)
finish('ui-pop', b)

print('all done ->', OUT)
