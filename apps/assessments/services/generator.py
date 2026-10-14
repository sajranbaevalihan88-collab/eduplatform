"""AI-генератор тестов из текста урока (офлайн, без внешних API).

Берёт текстовые блоки урока, находит термины (частотный анализ без стоп-слов)
и строит вопросы 3 типов: single (что такое X + дистракторы из соседних
определений), true_false (факты + отрицания), text (дать определение).
Учитель правит результат в TestBuilder и сохраняет как обычно.
"""
import re
from collections import Counter

RU_STOP = set('''это как что или для при про над под без через между
также всего всех этом этой этим этих было будет есть нет да же ли бы же
который которая которые которых котором каждом каждая каждое каждый
можно нельзя надо нужно очень даже только лишь уже еще её его их они она оно
мы вы ты он все всё меня тебя себя нас вас них того того-то из-за из-под
год года лет раз два три человек время слово дело жизнь рука нога глаз
урок тема класс школа пример задача ответ вопрос текст слово'''.split())

SENT_SPLIT = re.compile(r'(?<=[.!?…])\s+')
WORD = re.compile(r'[A-Za-zА-Яа-яЁё]{4,}')


def _sentences(text):
    parts = [s.strip() for s in SENT_SPLIT.split(text or '') if s.strip()]
    return [s for s in parts if len(s) >= 25]


def _keywords(sentences, top=30):
    cnt = Counter()
    for s in sentences:
        for w in WORD.findall(s.lower()):
            if w not in RU_STOP:
                cnt[w] += 1
    return [w for w, _ in cnt.most_common(top)]


def _definitions(sentences):
    """Паттерны 'ТЕРМИН — определение' / 'ТЕРМИН: ...' / 'ТЕРМИН это ...'."""
    out = []
    pat = re.compile(r'^([A-ZА-ЯЁ][\w\s\-]{2,40}?)\s*[—:\-–]\s*(.{15,200})$')
    pat2 = re.compile(r'^([A-ZА-ЯЁ][\w\s\-]{2,40}?)\s+это\s+(.{15,200})$')
    for s in sentences:
        s1 = s.rstrip('.!?…')
        m = pat.match(s1) or pat2.match(s1)
        if m:
            term, defi = m.group(1).strip(), m.group(2).strip()
            if len(term.split()) <= 4:
                out.append((term, defi))
    return out


def generate_questions(text, count=5):
    sentences = _sentences(text)
    if len(sentences) < 2:
        return []
    defs = _definitions(sentences)
    questions = []
    # 1. single: что такое X?
    for i, (term, defi) in enumerate(defs):
        if len(questions) >= count:
            break
        others = [d for j, (t2, d) in enumerate(defs) if j != i][:3]
        while len(others) < 3:
            others.append('Ничего из перечисленного')
        options = [{'text': defi[:200], 'is_correct': True}]
        options += [{'text': o[:200], 'is_correct': False} for o in others[:3]]
        questions.append({
            'text': f'Что такое «{term}»?',
            'type': 'single', 'points': 1, 'options': options,
            'explanation': f'Ответ — из текста урока: {defi[:150]}',
        })
    # 2. true_false: факты + отрицания
    facts = [s for s in sentences if len(s) > 40 and not any(t in s for t, _ in defs)]
    for i, s in enumerate(facts):
        if len(questions) >= count:
            break
        is_true = (i % 2 == 0)
        if is_true:
            questions.append({
                'text': f'Верно ли: {s[:220]}',
                'type': 'true_false', 'points': 1,
                'options': [{'text': 'Верно', 'is_correct': True}, {'text': 'Неверно', 'is_correct': False}],
                'explanation': 'Утверждение из текста урока.',
            })
        else:
            neg = re.sub(r'\s(есть|был|была|были|будет|может|должен)\b', r' не \1', s[:220], count=1)
            if neg == s[:220]:
                neg = 'Неверно, что: ' + s[:200]
            questions.append({
                'text': f'Верно ли: {neg}',
                'type': 'true_false', 'points': 1,
                'options': [{'text': 'Верно', 'is_correct': False}, {'text': 'Неверно', 'is_correct': True}],
                'explanation': 'Проверь текст урока — здесь подвох.',
            })
    # Текстовый тип вопросов отключён — только single и true_false.
    # Возвращаем сколько получилось (может быть меньше count).
    return questions[:count]
