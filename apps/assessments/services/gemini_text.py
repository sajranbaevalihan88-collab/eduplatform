"""Свободный текст через Gemini (не вопросы): отчёты по классу, подбор слов.

Возвращает (text, model_name) или (None, None) при любой ошибке.
"""
import json
import re

MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-3-flash-preview']


def _strip_fences(s):
    s = (s or '').strip()
    m = re.match(r'^```(?:json)?\s*([\s\S]*?)\s*```$', s)
    return m.group(1) if m else s


def generate_text(prompt, api_key='', preferred_model='', expect_json=False):
    """prompt -> свободный текст модели. expect_json=True -> распарсенный JSON"""
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
                prompt,
                generation_config={'temperature': 0.6, 'max_output_tokens': 8192},
            )
            raw = getattr(resp, 'text', '') or ''
            if expect_json:
                items = json.loads(_strip_fences(raw))
                return items, model_name
            return raw.strip(), model_name
        except Exception as e:
            last_err = f'{type(e).__name__}: {e}'
            continue
    print(f'[gemini-text] all models failed: {str(last_err)[:200]}')
    return None, None
