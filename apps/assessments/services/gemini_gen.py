"""Генерация вопросов через Google Gemini (настоящая нейросеть).

Используется, только если задан GEMINI_API_KEY. Иначе views.py падает
на офлайн-генератор (generator.py) — честный фолбэк без выдумок.
"""
import json
import re

ALLOWED_TYPES = {'single', 'multiple', 'true_false'}
MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-3-flash-preview']


def _prompt(text, count, instruction=''):
    base = (
        "Ты — генератор тестовых вопросов для школьной платформы. "
        f"Составь РОВНО {count} вопросов по тексту ниже. "
        "Разрешены ТОЛЬКО три типа: single (один правильный из 4), "
        "multiple (несколько правильных из 4-6) и "
        "true_false (Верно/Неверно). Тип text (свободный ответ) СТРОГО ЗАПРЕЩЁН — не используй его никогда. "
        "Отвечай ТОЛЬКО валидным JSON-массивом, без пояснений и markdown, в формате:\n"
        '[{"text":"...","type":"single","points":1,"explanation":"...?",'
        '"options":[{"text":"...","is_correct":true},{"text":"...","is_correct":false}]}]\n'
        "Правила: single — ровно 4 варианта, правильный ровно 1; "
        "multiple — 4-6 вариантов, правильных минимум 1; "
        "true_false — варианты Верно/Неверно."
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
    for q in items:
        if not isinstance(q, dict):
            continue
        text = str(q.get('text') or '').strip()
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
        elif qtype == 'multiple':
            if sum(1 for o in opts if o['is_correct']) < 1 or len(opts) < 2:
                continue
            opts = opts[:6]
        elif qtype == 'true_false':
            if len(opts) < 2:
                continue
            opts = opts[:2]
        else:
            opts = []
        if not text:
            continue
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


def generate_with_gemini(text, count=5, api_key='', preferred_model='', instruction=''):
    """Возвращает (questions, model_name) или (None, None) при любой ошибке."""
    if not api_key:
        return None, None
    try:
        import google.generativeai as genai
    except Exception:
        return None, None
    models = [m for m in [preferred_model] + MODEL_FALLBACKS if m]
    last_err = None
    for model_name in models:
        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(model_name)
            resp = model.generate_content(
                _prompt(text, count, instruction),
                generation_config={'temperature': 0.7, 'max_output_tokens': 16384},
            )
            raw = getattr(resp, 'text', '') or ''
            items = json.loads(_strip_fences(raw))
            if not isinstance(items, list):
                raise ValueError('not a list')
            questions = _normalize(items, count)
            if questions:
                return questions, model_name
            last_err = 'empty result'
        except Exception as e:
            last_err = f'{type(e).__name__}: {e}'
            continue
    # тихо наружу не тащим детали ключа — только факт
    print(f'[gemini] all models failed: {str(last_err)[:200]}')
    return None, None
