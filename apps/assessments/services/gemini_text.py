"""Свободный текст (не вопросы): отчёты по классу, подбор слов.

Прямой REST-вызов без тяжёлого SDK — работает и локально, и в проде.
Возвращает (text, model_name) или (None, None) при любой ошибке.
"""
import json
import re

import requests

MODEL_FALLBACKS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-3-flash-preview']
_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent?key={k}'


def _strip_fences(s):
    s = (s or '').strip()
    m = re.match(r'^```(?:json)?\s*([\s\S]*?)\s*```$', s)
    return m.group(1) if m else s


def _extract_text(data):
    cands = data.get('candidates') or [{}]
    parts = (cands[0].get('content') or {}).get('parts') or []
    return ''.join(p.get('text', '') for p in parts if isinstance(p, dict))


def generate_text(prompt, api_key='', preferred_model='', expect_json=False):
    """prompt -> свободный текст модели. expect_json=True -> распарсенный JSON"""
    if not api_key:
        return None, None
    models = [m for m in [preferred_model] + MODEL_FALLBACKS if m]
    last_err = None
    for model_name in models:
        try:
            r = requests.post(
                _API_URL.format(m=model_name, k=api_key),
                json={
                    'contents': [{'parts': [{'text': prompt}]}],
                    'generationConfig': {'temperature': 0.6, 'maxOutputTokens': 8192},
                },
                timeout=45,
            )
            if r.ok:
                raw = _extract_text(r.json())
                if raw:
                    if expect_json:
                        return json.loads(_strip_fences(raw)), model_name
                    return raw.strip(), model_name
                last_err = 'empty response'
            else:
                last_err = f'HTTP {r.status_code}: {str(r.text)[:180]}'
        except Exception as e:
            last_err = f'{type(e).__name__}: {e}'
        continue
    print(f'[gemini-text] all models failed: {str(last_err)[:200]}')
    return None, None
