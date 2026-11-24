"""Автогенерация вопросов (REST без SDK).

Используется, только если задан GEMINI_API_KEY. Иначе views.py падает
на встроенный генератор (generator.py) — честный фолбэк без выдумок.
"""
import json
import random
import re

import requests

API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent'

ALLOWED_TYPES = {'single', 'multiple', 'true_false'}
MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-flash-latest']


def _prompt(text, count, instruction=''):
    base = (
        "Ты — опытный школьный методист и генератор тестовых вопросов. "
        f"Составь РОВНО {count} РАЗНЫХ, уникальных вопросов. "
        "Разрешены ТОЛЬКО три типа: single (один правильный из 4), "
        "multiple (несколько правильных из 4-6) и "
        "true_false (Верно/Неверно). Тип text (свободный ответ) СТРОГО ЗАПРЕЩЁН. "
        "ВАЖНЫЕ ПРАВИЛА КАЧЕСТВА:\n"
        "1) ВСЕ вопросы должны быть УНИКАЛЬНЫМИ и проверять разные понятия, факты, действия, формулы или примеры — НИКОГДА не повторяй вопросы ни дословно, ни по смыслу.\n"
        "2) НЕ вставляй полное название темы в каждый вопрос (не пиши в каждом вопросе «По теме ...»). Задавай прямые, естественные предметные вопросы.\n"
        "3) Правильный ответ ставь на РАЗНЫЕ позиции (1-й, 2-й, 3-й или 4-й).\n"
        "Отвечай ТОЛЬКО валидным JSON-массивом, без пояснений и markdown, в формате:\n"
        '[{"text":"...","type":"single","points":1,"explanation":"...",'
        '"options":[{"text":"...","is_correct":true},{"text":"...","is_correct":false}]}]\n'
    )
    extra = str(instruction or '').strip()[:2000]
    if extra:
        base += ("\n\nУКАЗАНИЕ УЧИТЕЛЯ — ГЛАВНЫЙ ПРИОРИТЕТ. "
                 "Если оно требует только определённые типы вопросов — используй ТОЛЬКО их. "
                 "Если оно задаёт другую тему, язык или сложность — следуй ему, "
                 "а текст ниже используй лишь как образец уровня. "
                 "Факты бери из текста; если текста нет или тема другая — "
                 "опирайся на школьную программу, без выдумок:\n" + extra)
    else:
        base += ("\nЯзык вопросов — как в тексте (русский/кыргызский/английский); "
                 "не выдумывай факты вне текста.")
    if (text or '').strip():
        return base + "\n\nТЕКСТ:\n" + text
    return base + "\n\nТЕКСТ не предоставлен — составь вопросы по указанию учителя."


def _strip_fences(s):
    s = (s or '').strip()
    m = re.match(r'^```(?:json)?\s*([\s\S]*?)\s*```$', s)
    return m.group(1) if m else s


def _normalize(items, count):
    out = []
    seen_texts = set()
    for q in items:
        if not isinstance(q, dict):
            continue
        text = str(q.get('text') or '').strip()
        norm_key = re.sub(r'\s+', ' ', text.lower()).strip(' ?.!.,;:')
        if not norm_key or norm_key in seen_texts:
            continue
        qtype = str(q.get('type') or 'single').strip()
        # текстовые вопросы отключены — пропускаем
        if qtype not in ('single', 'multiple', 'true_false'):
            continue
        opts = []
        for o in (q.get('options') or []):
            if not isinstance(o, dict):
                continue
            t = str(o.get('text') or '').strip()
            if t:
                opts.append({'text': t[:500], 'is_correct': bool(o.get('is_correct'))})
        if qtype == 'single':
            if sum(1 for o in opts if o['is_correct']) != 1 or len(opts) < 2:
                continue
            opts = opts[:4]
            random.shuffle(opts)
        elif qtype == 'multiple':
            if sum(1 for o in opts if o['is_correct']) < 1 or len(opts) < 2:
                continue
            opts = opts[:6]
            random.shuffle(opts)
        elif qtype == 'true_false':
            if len(opts) < 2:
                continue
            opts = opts[:2]
        else:
            opts = []
        if not text:
            continue
        seen_texts.add(norm_key)
        try:
            points = max(1, min(10, int(q.get('points') or 1)))
        except Exception:
            points = 1
        item = {'text': text[:1000], 'type': qtype, 'points': points, 'options': opts}
        exp = str(q.get('explanation') or '').strip()
        if exp:
            item['explanation'] = exp[:500]
        out.append(item)
        if len(out) >= count:
            break
    return out


def _extract_text(data):
    cands = data.get('candidates') or [{}]
    parts = (cands[0].get('content') or {}).get('parts') or []
    return ''.join(p.get('text', '') for p in parts if isinstance(p, dict))


def generate_with_gemini(text, count=5, api_key='', preferred_model='', instruction=''):
    """Возвращает (questions, model_name) или (None, None) при любой ошибке."""
    if not api_key:
        return None, None
    seen_m = set()
    models = []
    for m in [preferred_model] + MODEL_FALLBACKS:
        if m and m not in seen_m:
            seen_m.add(m)
            models.append(m)
    last_err = None
    for model_name in models:
        try:
            r = requests.post(
                API_URL.format(m=model_name),
                headers={'x-goog-api-key': api_key},
                json={
                    'contents': [{'parts': [{'text': _prompt(text, count, instruction)}]}],
                    'generationConfig': {'temperature': 0.7, 'maxOutputTokens': 16384},
                },
                timeout=(4, 35),
            )
            if not r.ok:
                last_err = f'HTTP {r.status_code}: {str(r.text)[:180]}'
                continue
            raw = _extract_text(r.json())
            if not raw:
                last_err = 'empty response'
                continue
            items = json.loads(_strip_fences(raw))
            if not isinstance(items, list):
                raise ValueError('not a list')
            questions = _normalize(items, count)
            if questions:
                return questions, model_name
            last_err = 'empty result'
        except requests.exceptions.RequestException as e:
            last_err = f'{type(e).__name__}: {e}'
            continue
        except Exception as e:
            last_err = f'{type(e).__name__}: {e}'
            continue
    # тихо наружу не тащим детали ключа — только факт
    print(f'[gemini] all models failed: {str(last_err)[:200]}')
    return None, None
