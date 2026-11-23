from rest_framework import viewsets, permissions, status, throttling
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import CodeTask, CodeSubmission
from .serializers import CodeTaskSerializer, CodeTaskDetailSerializer, CodeSubmissionSerializer
from apps.accounts.permissions import TeacherWriteMixin
import subprocess, tempfile, os, sys, json, re, ast, textwrap, urllib.request, urllib.error

# Блокируемые паттерны для Python (дополнительный слой поверх строгого AST-allowlist)
# TODO: В продакшене рекомендуется дополнительно выносить запуски в self-hosted Piston/nsjail (CODE_USE_PISTON_ONLY=True)
BLOCKED_PY = [
    'import subprocess', 'import socket', '__import__', 'subprocess.', 'socket.',
    'pickle', 'ctypes', 'os.system', 'os.popen', 'os.environ',
]

# Строгие regex-правила для JavaScript (ловит обходы с пробелами, скобками и индексацией process['env'])
_BLOCKED_JS_RE = [
    (re.compile(r'\brequire\b', re.IGNORECASE), 'require'),
    (re.compile(r'\bprocess\b', re.IGNORECASE), 'process'),
    (re.compile(r'\bglobalThis\b', re.IGNORECASE), 'globalThis'),
    (re.compile(r'\bglobal\b', re.IGNORECASE), 'global'),
    (re.compile(r'\bchild_process\b', re.IGNORECASE), 'child_process'),
    (re.compile(r'\bworker_threads\b', re.IGNORECASE), 'worker_threads'),
    (re.compile(r'\bmodule\b', re.IGNORECASE), 'module'),
    (re.compile(r'\bimport\b', re.IGNORECASE), 'import'),
    (re.compile(r'\beval\b', re.IGNORECASE), 'eval'),
    (re.compile(r'\b(?:Async|Generator)?Function\b'), 'Function'),
    (re.compile(r'\bReflect\b'), 'Reflect'),
    (re.compile(r'\bProxy\b'), 'Proxy'),
    (re.compile(r'\bWebAssembly\b'), 'WebAssembly'),
    (re.compile(r'\bSharedArrayBuffer\b'), 'SharedArrayBuffer'),
    (re.compile(r'\bfetch\b', re.IGNORECASE), 'fetch'),
    (re.compile(r'\bXMLHttpRequest\b', re.IGNORECASE), 'XMLHttpRequest'),
    (re.compile(r'\bWebSocket\b', re.IGNORECASE), 'WebSocket'),
    (re.compile(r'\b(?:Deno|Bun)\b'), 'Deno/Bun'),
    (re.compile(r'(?:\.\s*constructor\b|\[\s*[\'"`]constructor[\'"`]\s*\])', re.IGNORECASE), 'constructor'),
    (re.compile(r'__proto__', re.IGNORECASE), '__proto__'),
    (re.compile(r'\b(?:get|set)PrototypeOf\b'), 'PrototypeOf'),
    (re.compile(r'\bdefineProperty\b'), 'defineProperty'),
    (re.compile(r'\bmainModule\b', re.IGNORECASE), 'mainModule'),
    (re.compile(r'\bBuffer\b'), 'Buffer'),
    (re.compile(r'\bfs\s*[\.\[]', re.IGNORECASE), 'fs'),
]

# Строгий белый список безопасных модулей Python для школьных задач (вместо неполного denylist)
_SAFE_PY_MODULES = {
    'math', 'cmath', 'random', 'statistics', 'decimal', 'fractions', 'numbers',
    'datetime', 'time', 'collections', 'itertools', 'functools', 'operator',
    'string', 're', 'json', 'hashlib', 'hmac', 'base64', 'copy', 'textwrap',
    'difflib', 'unicodedata', 'enum', 'dataclasses', 'typing', 'heapq',
    'bisect', 'array', 'queue', 'abc',
}

# Опасные встроенные имена — запрещены везде (не только в прямом вызове, чтобы заблокировать f = open)
_BLOCKED_PY_NAMES = {
    'open', 'eval', 'exec', 'compile', '__import__', 'breakpoint',
    'globals', 'locals', 'vars', 'getattr', 'setattr', 'delattr',
    'memoryview', '__builtins__', '__loader__', '__spec__', '__file__',
    '__cached__', '__package__', '__doc__', 'help', 'license', 'credits',
    'copyright', 'exit', 'quit', 'dir',
}

# Опасные имена атрибутов (защита от утечки модулей через атрибуты вроде mod.os / frame.f_globals)
_BLOCKED_PY_ATTRS = {
    'os', 'sys', 'io', 'builtins', 'subprocess', 'socket', 'posix', 'nt',
    'importlib', 'system', 'popen', 'exec', 'eval', 'open', 'open_code',
    'FileIO', 'modules', 'meta_path', 'path_hooks', 'f_globals', 'f_builtins',
    'f_locals', 'f_back', 'gi_frame', 'cr_frame', 'ag_frame', 'tb_frame',
    'tb_next', 'func_globals', 'im_func', 'im_self',
}

# «Безопасные» dunder-атрибуты, без которых не работают обычные ученические программы (классы, ООП)
_ALLOWED_DUNDER = {
    '__init__', '__name__', '__str__', '__repr__', '__len__', '__eq__', '__lt__', '__gt__',
    '__le__', '__ge__', '__add__', '__sub__', '__mul__', '__iter__', '__next__', '__getitem__',
    '__setitem__', '__contains__', '__enter__', '__exit__', '__hash__', '__bool__',
    '__call__', '__truediv__', '__floordiv__', '__mod__', '__neg__', '__ne__',
}

_CODING_COOKIE_RE = re.compile(r'coding[:=]\s*[-\w.]+', re.IGNORECASE)
_ALLOWED_PROJECT_EXTS = {'.py', '.js', '.html', '.htm', '.css', '.txt', '.json', '.csv', '.md'}

# Карта языков для Piston API — только 4 рабочих (python/javascript локально стабильно, html/css preview)
# Остальные отключены: публичный Piston whitelist-only, Godbolt нестабилен на выставке
PISTON_MAP = {
    'python': ('python', '3.10.0'),
    'py': ('python', '3.10.0'),
    'javascript': ('javascript', '18.15.0'),
    'js': ('javascript', '18.15.0'),
}

ALLOWED_LANGS = {'python', 'py', 'javascript', 'js', 'html', 'htm', 'css'}

# Метки языков для отображения — только 4 рабочих
LABELS = {
    'python': 'Python',
    'javascript': 'JavaScript',
    'html': 'HTML',
    'css': 'CSS',
}

def get_label(lang: str) -> str:
    """Возвращает человекочитаемую метку для языка."""
    if not lang:
        return "Text"
    return LABELS.get(lang.lower().strip(), lang.capitalize())

def _simulate_run(code: str, lang: str) -> tuple[str, bool]:
    """Preview для html/css — работает офлайн, без бэкенда."""
    lang = (lang or "").lower().strip()
    if lang in ("html", "htm"):
        return code[:4000], True
    if lang == "css":
        if not code.strip():
            return "Пустой CSS", True
        return code[:4000], True
    if lang in ("text", "plain", "txt"):
        return code[:4000], True
    return f"Язык «{lang}» отключен. Доступны: python, javascript, html, css.", False

def _check_piston_limit() -> tuple[bool, str]:
    """Дневной лимит Piston — защита от исчерпания внешнего API."""
    try:
        from django.core.cache import cache
        from django.conf import settings
        import datetime
        today = datetime.date.today().isoformat()
        key = f"piston_daily_{today}"
        limit = getattr(settings, 'PISTON_DAILY_LIMIT', 500)
        count = cache.get(key, 0)
        if count >= limit:
            return False, f"Дневной лимит Piston ({limit}) исчерпан — поднимите свой Piston: {getattr(settings, 'PISTON_URL', 'https://emkc.org')}"
        try:
            cache.add(key, 0, 86400)
        except: pass
        cache.set(key, count+1, 86400)
        return True, ""
    except Exception:
        return True, ""

def _piston_error_views(lang: str, detail: str) -> tuple[str, bool]:
    """Честная ошибка Piston для views.py — без раскрытия внутренних URL и стектрейсов."""
    import logging as _plog
    _plog.getLogger(__name__).warning("Piston error (%s): %s", lang, detail)
    return (
        f"⚠️ Не удалось выполнить код на языке «{lang}»: сервис выполнения временно недоступен.\n"
        f"Попробуй ещё раз через минуту."
    ), False

def _piston_run(code: str, lang: str, stdin: str = "") -> tuple[str, bool]:
    """Выполнение кода через Piston API — честный путь, без симуляции для кодовых языков."""
    ok, msg = _check_piston_limit()
    if not ok:
        return _piston_error_views(lang, msg)
    lang_key = (lang or "").lower().strip()
    if lang_key not in ALLOWED_LANGS:
        return f"Язык «{lang}» отключен. Доступны: python, javascript, html, css.", False
    if lang_key in ("html", "htm", "css"):
        return _simulate_run(code, lang_key)
    piston_lang, version = PISTON_MAP.get(lang_key, (lang_key, ""))
    from django.conf import settings as _s
    piston_url = getattr(_s, 'PISTON_URL', 'https://emkc.org/api/v2/piston/execute')
    payload = {
        "language": piston_lang,
        "version": version if version else "*",
        "files": [{"content": code}],
        "stdin": stdin or "",
    }
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            piston_url,
            data=data,
            headers={"Content-Type": "application/json", "User-Agent": "EduPlatform/1.0"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=6) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            result = json.loads(body)
            run = result.get("run", {})
            output = run.get("output") or (run.get("stdout", "") + run.get("stderr", ""))
            if not output:
                output = (run.get("stdout") or "") + ("\n" + run.get("stderr") if run.get("stderr") else "")
            code_ret = run.get("code", 0)
            passed = code_ret == 0
            return (output or "")[:5000], passed
    except urllib.error.HTTPError as e:
        try:
            body_err = e.read().decode('utf-8', errors='replace')[:400]
        except Exception:
            body_err = ""
        # Попытка с version="*" только для 400/404 — как честный ретрай, не симуляция
        if version and e.code in (400, 404):
            try:
                payload2 = {
                    "language": piston_lang,
                    "version": "*",
                    "files": [{"content": code}],
                    "stdin": stdin or "",
                }
                data2 = json.dumps(payload2).encode("utf-8")
                req2 = urllib.request.Request(
                    piston_url,
                    data=data2,
                    headers={"Content-Type": "application/json", "User-Agent": "EduPlatform/1.0"},
                    method="POST",
                )
                with urllib.request.urlopen(req2, timeout=6) as resp2:
                    body2 = resp2.read().decode("utf-8", errors="replace")
                    result2 = json.loads(body2)
                    run2 = result2.get("run", {})
                    output2 = run2.get("output") or (run2.get("stdout", "") + run2.get("stderr", ""))
                    return (output2 or "")[:5000], run2.get("code", 0) == 0
            except urllib.error.HTTPError as e2:
                try:
                    b2 = e2.read().decode('utf-8', errors='replace')[:300]
                except Exception:
                    b2 = ""
                return _piston_error_views(lang, f"HTTP {e2.code} от {piston_url} (retry version=*): {b2 or body_err}")
            except Exception as e2:
                return _piston_error_views(lang, f"{type(e2).__name__}: {e2} (retry version=*), оригинал HTTP {e.code}: {body_err}")
        return _piston_error_views(lang, f"HTTP {e.code} от {piston_url} (version={version}): {body_err}")
    except urllib.error.URLError as e:
        return _piston_error_views(lang, f"сеть недоступна: {e.reason}")
    except Exception as e:
        return _piston_error_views(lang, f"{type(e).__name__}: {e}")

def _is_safe_code(code: str, lang: str, local_modules: set | None = None):
    if not isinstance(code, str):
        return False, "Код должен быть строкой"
    if len(code) > 50000:
        return False, "Код слишком длинный (макс 50000 символов)"
    lower = code.lower()
    if lang == 'python':
        # Защита от PEP 263 кодировок (# coding: raw_unicode_escape), обходящих текстовые/AST проверки
        first_lines = '\n'.join(code.splitlines()[:2])
        if _CODING_COOKIE_RE.search(first_lines):
            return False, "Директива coding: запрещена в песочнице"
        for pat in BLOCKED_PY:
            if pat.lower() in lower:
                return False, f"Запрещенный паттерн: {pat}"
        allowed_mods = _SAFE_PY_MODULES | (local_modules or set())
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            # Fail-closed: синтаксически некорректный код никогда не передаётся интерпретатору
            return False, f"Синтаксическая ошибка: {e.msg or 'неверный синтаксис'} (строка {e.lineno or 1})"
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                for alias in node.names:
                    top = (alias.name or '').split('.')[0]
                    if top not in allowed_mods:
                        return False, f"Импорт {alias.name} запрещен в песочнице"
            elif isinstance(node, ast.ImportFrom):
                if node.level:
                    return False, "Относительные импорты запрещены в песочнице"
                top = (node.module or '').split('.')[0]
                if top not in allowed_mods:
                    return False, f"Импорт из {node.module or '.'} запрещен в песочнице"
            elif isinstance(node, ast.Name):
                if node.id in _BLOCKED_PY_NAMES:
                    return False, f"Использование {node.id} запрещено"
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                if node.func.id == 'type' and (len(node.args) != 1 or node.keywords):
                    return False, "Динамическое создание классов через type() запрещено"
            elif isinstance(node, ast.Attribute):
                attr = node.attr or ''
                # Блокируем все приватные/магические атрибуты (_os, __subclasses__, __globals__, и т.п.)
                if attr.startswith('_') and attr not in _ALLOWED_DUNDER:
                    return False, f"Доступ к атрибуту {attr} запрещен"
                if attr in _BLOCKED_PY_ATTRS:
                    return False, f"Доступ к атрибуту {attr} запрещен"
    elif lang == 'javascript':
        for rx, label in _BLOCKED_JS_RE:
            if rx.search(code):
                return False, f"Запрещенная конструкция JavaScript: {label}"
    return True, ""

class CodeRunThrottle(throttling.UserRateThrottle):
    scope = 'code_run'
    rate = '30/minute'

class AnonCodeThrottle(throttling.AnonRateThrottle):
    rate = '30/minute'

def _norm_out(s: str) -> str:
    lines = [ln.rstrip() for ln in (s or '').replace('\r\n', '\n').replace('\r', '\n').split('\n')]
    while lines and lines[-1] == '':
        lines.pop()
    while lines and lines[0] == '':
        lines.pop(0)
    return '\n'.join(lines)


def _match_stdout(actual: str, expected: str) -> bool:
    a = _norm_out(actual)
    e = _norm_out(expected)
    if not e:
        return True
    if a == e:
        return True
    # Allow matching single-line trimmed output or exact line inside stdout
    if a.strip() == e.strip():
        return True
    a_lines = [ln.strip() for ln in a.splitlines()]
    e_lines = [ln.strip() for ln in e.splitlines()]
    if a_lines == e_lines:
        return True
    if len(e_lines) == 1 and e_lines[0] in a_lines:
        return True
    return False


def _eval_web_test(test: dict, html_code: str, css_code: str = '', js_code: str = '') -> tuple[bool, str]:
    ttype = str(test.get('type') or 'contains').lower().strip()
    val = str(test.get('value') or test.get('expected') or '').strip()
    combined = '\n'.join([html_code or '', css_code or '', js_code or ''])
    if not val:
        return True, 'OK'
    if ttype == 'tag':
        pat = rf'<\s*{re.escape(val)}\b'
        ok = bool(re.search(pat, html_code or combined, re.IGNORECASE))
        return ok, (f'Найден тег <{val}>' if ok else f'Не найден тег <{val}>')
    if ttype == 'attr':
        ok = val.lower() in (html_code or combined).lower()
        return ok, (f'Найден атрибут {val}' if ok else f'Не найден атрибут {val}')
    if ttype == 'css_prop':
        src = css_code or combined
        parts = [p.strip() for p in val.split(':', 1)]
        if len(parts) == 2 and parts[1]:
            pat = rf'{re.escape(parts[0])}\s*:\s*[^;}}]*{re.escape(parts[1])}'
        else:
            pat = rf'{re.escape(parts[0])}\s*:'
        ok = bool(re.search(pat, src, re.IGNORECASE))
        return ok, (f'Свойство «{val}» применено' if ok else f'Не найдено CSS-свойство «{val}»')
    if ttype == 'regex':
        if len(val) > 200 or re.search(r'\([^)]*[+*][^)]*\)[+*?{]', val):
            ok = val.lower() in combined.lower()
            return ok, ('Совпадение найдено' if ok else 'Не соответствует шаблону')
        try:
            ok = bool(re.search(val, combined[:16000], re.IGNORECASE | re.DOTALL))
        except re.error:
            ok = val.lower() in combined.lower()
        return ok, ('Совпадение найдено' if ok else 'Не соответствует шаблону')
    ok = val.lower() in combined.lower()
    return ok, ('Найдено в коде' if ok else f'В коде отсутствует «{val}»')


def _norm_sql_cell(v):
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return round(float(v), 4)
    s = str(v).strip()
    try:
        if re.match(r'^-?\d+(?:\.\d+)?$', s):
            return round(float(s), 4)
    except Exception:
        pass
    return s.lower()


def _norm_sql_rows(rows: list) -> list[tuple]:
    out = []
    for r in (rows or []):
        if isinstance(r, dict):
            out.append(tuple(_norm_sql_cell(v) for v in r.values()))
        elif isinstance(r, (list, tuple)):
            out.append(tuple(_norm_sql_cell(v) for v in r))
        else:
            out.append((_norm_sql_cell(r),))
    return out


def _eval_sql_tests(tests: list, sql_code: str, columns: list, rows: list, error_msg: str = '') -> list[dict]:
    results = []
    norm_actual = _norm_sql_rows(rows)
    actual_cols = [str(c).strip().lower() for c in (columns or [])]
    sql_clean = re.sub(r'--[^\n]*', ' ', sql_code or '')
    sql_clean = re.sub(r'/\*[\s\S]*?\*/', ' ', sql_clean)

    for idx, t in enumerate(tests):
        if not isinstance(t, dict):
            continue
        label = str(t.get('label') or f'Проверка {idx + 1}')
        hidden = bool(t.get('hidden'))

        if error_msg:
            results.append({'label': label, 'hidden': hidden, 'passed': False, 'detail': f'Ошибка SQL: {error_msg[:180]}'})
            continue

        req_kw = str(t.get('required_sql') or '').strip()
        if req_kw:
            ok = bool(re.search(rf'\b{re.escape(req_kw)}\b', sql_clean, re.IGNORECASE))
            results.append({
                'label': label,
                'hidden': hidden,
                'passed': ok,
                'detail': f'Используется {req_kw.upper()}' if ok else f'Ожидается конструкция {req_kw.upper()}',
            })
            continue

        exp_cols = t.get('expected_columns')
        if isinstance(exp_cols, list) and exp_cols:
            want_cols = [str(c).strip().lower() for c in exp_cols]
            ok = actual_cols == want_cols or set(want_cols).issubset(set(actual_cols))
            results.append({
                'label': label,
                'hidden': hidden,
                'passed': ok,
                'detail': 'Колонки совпадают' if ok else (
                    'Колонки не совпали' if hidden else f'Ожидались колонки: {", ".join(exp_cols)}'
                ),
            })
            continue

        exp_rows = t.get('expected_rows')
        if isinstance(exp_rows, list):
            norm_exp = _norm_sql_rows(exp_rows)
            ordered = bool(t.get('ordered', False))
            if ordered:
                ok = norm_actual == norm_exp
            else:
                ok = sorted(norm_actual, key=lambda x: str(x)) == sorted(norm_exp, key=lambda x: str(x))
            detail = f'Совпало строк: {len(norm_actual)}' if ok else (
                'Результат запроса не совпал с эталоном' if hidden
                else f'Получено строк: {len(norm_actual)}, ожидалось: {len(norm_exp)}'
            )
            results.append({'label': label, 'hidden': hidden, 'passed': ok, 'detail': detail})
            continue

        min_rows = t.get('min_rows')
        if min_rows is not None:
            ok = len(norm_actual) >= int(min_rows)
            results.append({
                'label': label,
                'hidden': hidden,
                'passed': ok,
                'detail': f'Строк: {len(norm_actual)}' if ok else f'Нужно минимум {min_rows} строк, получено {len(norm_actual)}',
            })
    return results


def _sync_gradebook(task: CodeTask, user, score: float, code_text: str = '') -> bool:
    """Если задача привязана к классу — сохраняет лучший авто-балл ученика прямо в журнал класса."""
    if not task.classroom_id or not user or not user.is_authenticated:
        return False
    try:
        from apps.classroom.models import Assignment, Submission
        asgn = task.assignment
        if asgn is None:
            asgn = Assignment.objects.create(
                classroom=task.classroom,
                kind='manual',
                manual_title=f'[Практика] {task.title}'[:290],
                instructions=task.description[:1000] if task.description else '',
                max_score=task.max_score or 100,
            )
            task.assignment = asgn
            task.save(update_fields=['assignment'])
        sub, created = Submission.objects.get_or_create(
            assignment=asgn,
            student=user,
            defaults={'status': 'submitted', 'score': score, 'answer': (code_text or '')[:4000]},
        )
        if not created:
            if sub.score is None or score >= sub.score:
                sub.score = score
                sub.answer = (code_text or '')[:4000]
                sub.status = 'submitted'
                sub.save(update_fields=['score', 'answer', 'status', 'updated_at'])
        return True
    except Exception:
        return False


class CodeTaskViewSet(TeacherWriteMixin, viewsets.ModelViewSet):
    queryset = CodeTask.objects.select_related('classroom', 'owner').all().order_by('-created_at')
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    throttle_classes = [throttling.UserRateThrottle, throttling.AnonRateThrottle]

    def get_serializer_class(self):
        # владелец/учитель/админ видит solution и все тесты
        if self.action in ['retrieve','create','update','partial_update']:
            user = self.request.user
            if user.is_authenticated and (user.is_staff or getattr(user, 'role', None) in ('admin', 'teacher')):
                return CodeTaskDetailSerializer
            if self.action in ['create','update','partial_update']:
                return CodeTaskDetailSerializer
        return CodeTaskSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        lang = self.request.query_params.get('language')
        if lang:
            langs = [x.strip().lower() for x in lang.split(',') if x.strip()]
            if langs:
                qs = qs.filter(language__in=langs)
        cid = self.request.query_params.get('classroom')
        if cid and cid.isdigit():
            qs = qs.filter(classroom_id=int(cid))
        return qs

    def perform_create(self, serializer):
        task = serializer.save(owner=self.request.user if self.request.user.is_authenticated else None)
        # Если учитель привязал задачу к классу — сразу создаём колонку в журнале класса
        if task.classroom_id and task.assignment_id is None:
            try:
                from apps.classroom.models import Assignment
                asgn = Assignment.objects.create(
                    classroom=task.classroom,
                    kind='manual',
                    manual_title=f'[Практика] {task.title}'[:290],
                    instructions=task.description[:1000] if task.description else '',
                    max_score=task.max_score or 100,
                )
                task.assignment = asgn
                task.save(update_fields=['assignment'])
            except Exception:
                pass

    def perform_update(self, serializer):
        obj = self.get_object()
        is_admin = self.request.user.is_staff or getattr(self.request.user, 'role', None) == 'admin'
        if obj.owner_id is None:
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Только владелец")
        elif obj.owner_id != self.request.user.id and not is_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Только владелец")
        serializer.save()

    def perform_destroy(self, instance):
        is_admin = self.request.user.is_staff or getattr(self.request.user, 'role', None) == 'admin'
        if instance.owner_id is None:
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Только владелец")
        elif instance.owner_id != self.request.user.id and not is_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Только владелец")
        instance.delete()

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated], throttle_classes=[CodeRunThrottle])
    def run(self, request, pk=None):
        task = self.get_object()
        code = request.data.get('code','')
        css_code = str(request.data.get('css', '') or '')[:8000]
        js_code = str(request.data.get('js', '') or '')[:8000]
        stdin_data = request.data.get('input', request.data.get('stdin', ''))
        if stdin_data is None:
            stdin_data = ''
        if not isinstance(stdin_data, str):
            stdin_data = str(stdin_data)
        stdin_data = stdin_data[:8000]
        if not isinstance(code, str):
            return Response({'error':'code должен быть строкой'}, status=400)
        if len(code.strip()) == 0:
            return Response({'error':'Пустой код'}, status=400)
        task_lang = (task.language or '').lower().strip()
        if task_lang == 'sql':
            return Response({'error': 'Для SQL-задач используйте /submit_sql/'}, status=400)
        if task_lang not in ALLOWED_LANGS:
            return Response({'output': f"Язык «{task.language}» отключен. Доступны: python, javascript, html, css.", 'passed': False}, status=400)
        safe, msg = _is_safe_code(code, task.language)
        if not safe:
            return Response({'output': f"Блокировка: {msg}", 'passed': False}, status=400)

        is_teacher_view = (
            request.user.is_authenticated and (
                request.user.is_staff
                or getattr(request.user, 'role', None) in ('admin', 'teacher')
                or task.owner_id == request.user.id
            )
        )
        tests_list = task.tests if isinstance(task.tests, list) else []
        test_results = []
        output = ''
        passed = False
        passed_tests = 0
        total_tests = len(tests_list)
        max_score = task.max_score or 100

        if task_lang in ('html', 'css'):
            output = 'HTML/CSS проверка выполнена'
            if tests_list:
                for idx, t in enumerate(tests_list):
                    if not isinstance(t, dict):
                        continue
                    label = str(t.get('label') or f'Проверка {idx + 1}')
                    hidden = bool(t.get('hidden'))
                    ok, detail = _eval_web_test(t, code if task_lang == 'html' else '', css_code or (code if task_lang == 'css' else ''), js_code)
                    if ok:
                        passed_tests += 1
                    test_results.append({
                        'label': label,
                        'hidden': hidden,
                        'passed': ok,
                        'detail': detail if (not hidden or is_teacher_view) else ('Пройден' if ok else 'Не пройден'),
                    })
                total_tests = len(test_results)
                passed = total_tests > 0 and passed_tests == total_tests
            else:
                passed = True
        else:
            from .services.runner import run_single
            if tests_list:
                outputs_log = []
                for idx, t in enumerate(tests_list[:15]):
                    if not isinstance(t, dict):
                        continue
                    label = str(t.get('label') or f'Тест {idx + 1}')
                    hidden = bool(t.get('hidden'))
                    t_in = str(t.get('input', '') or '')
                    t_exp = str(t.get('expected', '') or '')
                    out_i, ran_ok = run_single(code, task_lang, t_in)
                    matched = ran_ok and _match_stdout(out_i, t_exp)
                    if matched:
                        passed_tests += 1
                    entry = {
                        'label': label,
                        'hidden': hidden,
                        'passed': matched,
                    }
                    if not hidden or is_teacher_view:
                        entry['input'] = t_in
                        entry['expected'] = t_exp
                        entry['actual'] = (out_i or '')[:600]
                    else:
                        entry['detail'] = 'Пройден' if matched else 'Ответ не совпал со скрытым тестом'
                    test_results.append(entry)
                    if not hidden or is_teacher_view:
                        outputs_log.append(f"[{label}] {'✓' if matched else '✗'}\n{(out_i or '').strip()}")
                    else:
                        outputs_log.append(f"[{label} (скрытый)] {'✓ Пройден' if matched else '✗ Не пройден'}")
                total_tests = len(test_results)
                passed = total_tests > 0 and passed_tests == total_tests
                output = '\n\n'.join(outputs_log)[:5000]
            else:
                output, passed = run_single(code, task_lang, stdin_data)

        if total_tests > 0:
            score = round((passed_tests / total_tests) * max_score, 1)
        else:
            score = float(max_score) if passed else 0.0

        gradebook_synced = False
        if request.user.is_authenticated:
            try:
                CodeSubmission.objects.create(
                    task=task,
                    user=request.user,
                    code=code[:8000],
                    output=output[:5000],
                    passed=passed,
                    score=score,
                    passed_tests=passed_tests,
                    total_tests=total_tests,
                    test_results=test_results,
                )
            except Exception:
                pass
            gradebook_synced = _sync_gradebook(task, request.user, score, code)

        return Response({
            'output': output[:5000],
            'passed': passed,
            'score': score,
            'max_score': max_score,
            'passed_tests': passed_tests,
            'total_tests': total_tests,
            'test_results': test_results,
            'gradebook_synced': gradebook_synced,
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated], throttle_classes=[CodeRunThrottle], url_path='submit_sql')
    def submit_sql(self, request, pk=None):
        """POST /api/code-tasks/<id>/submit_sql/ — автопроверка результата PostgreSQL-запроса и запись в журнал."""
        task = self.get_object()
        sql_code = str(request.data.get('sql') or request.data.get('code') or '')
        columns = request.data.get('columns') or []
        rows = request.data.get('rows') or []
        error_msg = str(request.data.get('error') or '')

        tests_list = task.tests if isinstance(task.tests, list) else []
        test_results = _eval_sql_tests(tests_list, sql_code, columns, rows, error_msg)
        total_tests = len(test_results)
        passed_tests = sum(1 for r in test_results if r.get('passed'))
        passed = (total_tests > 0 and passed_tests == total_tests) if total_tests > 0 else (not error_msg)
        max_score = task.max_score or 100
        score = round((passed_tests / total_tests) * max_score, 1) if total_tests > 0 else (float(max_score) if passed else 0.0)

        out_summary = f"Пройдено проверок: {passed_tests}/{total_tests}" if total_tests else ('Выполнено' if passed else error_msg)
        gradebook_synced = False
        if request.user.is_authenticated:
            try:
                CodeSubmission.objects.create(
                    task=task,
                    user=request.user,
                    code=sql_code[:8000],
                    output=out_summary[:5000],
                    passed=passed,
                    score=score,
                    passed_tests=passed_tests,
                    total_tests=total_tests,
                    test_results=test_results,
                )
            except Exception:
                pass
            gradebook_synced = _sync_gradebook(task, request.user, score, sql_code)

        return Response({
            'passed': passed,
            'score': score,
            'max_score': max_score,
            'passed_tests': passed_tests,
            'total_tests': total_tests,
            'test_results': test_results,
            'gradebook_synced': gradebook_synced,
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated], throttle_classes=[CodeRunThrottle])
    def run_project(self, request):
        """Запуск мультифайлового проекта (POST /api/code-tasks/run_project/). Гости тоже могут (троттлинг + песочница)."""
        files = request.data.get('files') or request.data.get('files[]') or []
        entry = request.data.get('entry') or request.data.get('entrypoint') or 'main.py'
        requirements = request.data.get('requirements') or ''
        stdin_data = request.data.get('input') or request.data.get('stdin') or ''
        if stdin_data is None:
            stdin_data = ''
        if not isinstance(stdin_data, str):
            stdin_data = str(stdin_data)
        stdin_data = stdin_data[:8000]
        if not isinstance(files, list):
            return Response({'error': 'files должен быть списком'}, status=400)
        if len(files) > 99:
            return Response({'error': 'Слишком много файлов (макс 99)'}, status=400)
        # Собираем имена локальных Python-модулей проекта и жёстко валидируем пути (защита от traversal / пропуска AST)
        local_py_modules = set()
        sanitized_files = []
        for fitem in files:
            if not isinstance(fitem, dict):
                continue
            raw_path = str(fitem.get('path') or fitem.get('name') or fitem.get('filename') or 'main.py').strip()
            norm_path = raw_path.replace('\\', '/').lstrip('/')
            if not norm_path or ':' in norm_path or '\x00' in norm_path or '..' in norm_path.split('/') or os.path.isabs(norm_path):
                return Response({'output': f'Недопустимый путь файла: {raw_path[:80]}', 'passed': False}, status=400)
            ext = os.path.splitext(norm_path)[1].lower()
            if ext not in _ALLOWED_PROJECT_EXTS:
                return Response({'output': f'Запрещённое расширение файла: {ext or "(без расширения)"}', 'passed': False}, status=400)
            fcontent = fitem.get('content') if fitem.get('content') is not None else (fitem.get('code') or '')
            if not isinstance(fcontent, str):
                return Response({'output': f'Содержимое файла {norm_path} должно быть строкой', 'passed': False}, status=400)
            if ext == '.py':
                stem = os.path.splitext(norm_path)[0].split('/')[0]
                if stem and stem.isidentifier():
                    local_py_modules.add(stem)
            sanitized_files.append({'path': norm_path, 'content': fcontent})

        if not sanitized_files:
            return Response({'output': 'Нет файлов проекта', 'passed': False}, status=400)

        # Проверка безопасности (строгий AST-allowlist) для каждого файла проекта перед запуском
        for fitem in sanitized_files:
            fpath = fitem['path']
            fcontent = fitem['content']
            if fpath.lower().endswith('.py'):
                safe, msg = _is_safe_code(fcontent, 'python', local_modules=local_py_modules)
                if not safe:
                    return Response({'output': f'Блокировка ({fpath}): {msg}', 'passed': False}, status=400)
            elif fpath.lower().endswith('.js'):
                safe, msg = _is_safe_code(fcontent, 'javascript')
                if not safe:
                    return Response({'output': f'Блокировка ({fpath}): {msg}', 'passed': False}, status=400)
            elif len(fcontent) > 15000:
                return Response({'output': f'Файл {fpath} слишком большой (макс 15000 символов)', 'passed': False}, status=400)
        try:
            from .services.runner import run_project as runner_run_project
            output, passed = runner_run_project(sanitized_files, entry=entry, requirements=requirements, stdin_data=stdin_data)
            return Response({'output': output[:5000], 'passed': passed})
        except Exception:
            import logging as _lg
            _lg.getLogger(__name__).exception("run_project failed")
            return Response({'output': 'Не удалось запустить проект, проверь файлы и entry', 'passed': False}, status=400)

    @action(detail=False, methods=['get'], permission_classes=[permissions.AllowAny], throttle_classes=[], url_path='capabilities')
    def capabilities(self, request):
        """Какие языки реально запускаются: local / preview. Только 4 рабочих."""
        import shutil
        local_bins = {
            'python': ['python', 'python3'], 'javascript': ['node'],
        }
        runners = {}
        for lang, bins in local_bins.items():
            try:
                found = any(shutil.which(b) for b in bins)
            except Exception:
                found = False
            runners[lang] = 'local' if found else 'online'
        for lang in ('html', 'css'):
            runners[lang] = 'preview'
        return Response({'runners': runners})

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated], throttle_classes=[CodeRunThrottle], url_path='run_code')
    def run_code(self, request):
        """Универсальный раннер для всех языков (POST /api/code-tasks/run_code/). Требует авторизации."""
        code = request.data.get('code', '')
        lang = request.data.get('language') or request.data.get('lang') or request.data.get('type') or 'python'
        stdin_data = request.data.get('input') or request.data.get('stdin') or ''
        if stdin_data is None:
            stdin_data = ''
        if not isinstance(stdin_data, str):
            stdin_data = str(stdin_data)
        stdin_data = stdin_data[:8000]
        if not isinstance(code, str):
            return Response({'error': 'code должен быть строкой'}, status=400)
        if len(code.strip()) == 0:
            return Response({'error': 'Пустой код'}, status=400)
        lang = str(lang).lower().strip()
        alias_map = {
            'py': 'python', 'js': 'javascript',
        }
        lang = alias_map.get(lang, lang)
        if lang not in ALLOWED_LANGS:
            return Response({'output': f"Язык «{lang}» отключен. Доступны: python, javascript, html, css.", 'passed': False}, status=400)
        safe, msg = _is_safe_code(code, lang)
        if not safe:
            return Response({'output': f"Блокировка: {msg}", 'passed': False}, status=400)
        try:
            from .services.runner import run_single
            output, passed = run_single(code, lang, stdin_data)
            return Response({'output': output[:5000], 'passed': passed, 'language': lang, 'label': get_label(lang)})
        except Exception:
            import logging as _lg2
            _lg2.getLogger(__name__).exception("run_code failed")
            return Response({'output': 'Не удалось выполнить код, попробуй позже', 'passed': False}, status=400)

    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny], throttle_classes=[throttling.AnonRateThrottle, throttling.UserRateThrottle], url_path='explain')
    def explain(self, request):
        """Объяснение ошибки простыми словами (офлайн, без внешних API).
        POST /api/code-tasks/explain/ {code, language, output} -> {title, what, fix, line}."""
        code = request.data.get('code', '')
        output = request.data.get('output', '')
        lang = request.data.get('language') or request.data.get('lang') or 'python'
        if not isinstance(code, str) or not isinstance(output, str):
            return Response({'error': 'code и output должны быть строками'}, status=400)
        lang = str(lang).lower().strip()
        lang = {'py': 'python', 'js': 'javascript'}.get(lang, lang)
        if lang not in ('python', 'javascript'):
            return Response({'error': 'Объяснения доступны для python и javascript'}, status=400)
        if len(output.strip()) == 0:
            return Response({'error': 'Нет вывода для разбора — сначала запусти код'}, status=400)
        try:
            from .services.explainer import explain as explain_error
            result = explain_error(code[:8000], lang, output[:5000])
            if not result:
                return Response({'title': 'Не узнал ошибку',
                                 'what': 'Такой текст ошибки мне пока незнаком — покажи её учителю.',
                                 'fix': 'Скопируй вывод целиком и разбери вместе с учителем.',
                                 'line': None})
            return Response(result)
        except Exception:
            import logging as _lg3
            _lg3.getLogger(__name__).exception("explain failed")
            return Response({'error': 'Не удалось разобрать ошибку'}, status=400)

class CodeSubmissionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = CodeSubmission.objects.all().order_by('-created_at')
    serializer_class = CodeSubmissionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # только свои сабмиты, админ видит все
        user = self.request.user
        if user.is_staff or getattr(user, 'role', None) == 'admin':
            return super().get_queryset()
        return super().get_queryset().filter(user=user)


class SharedCodeView(APIView):
    """Поделиться кодом ссылкой (как Share у online-python).
    POST /api/shared/ {title, files:[{name,content}], days: 1|30|180|0=навсегда} -> {token, url}
    GET /api/shared/<token>/ -> {title, files, created_at} или 404/410."""
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]

    def post(self, request):
        from .models import SharedCode
        import secrets
        from datetime import timedelta
        from django.utils import timezone
        if not request.user.is_authenticated:
            return Response({'error': 'Войди чтобы делиться кодом'}, status=401)
        title = str(request.data.get('title') or 'Без названия')[:200]
        files = request.data.get('files') or []
        if not isinstance(files, list) or not files:
            return Response({'error': 'files должен быть непустым списком'}, status=400)
        if len(files) > 20:
            return Response({'error': 'Максимум 20 файлов в ссылке'}, status=400)
        clean = []
        for f in files[:20]:
            if not isinstance(f, dict):
                continue
            name = str(f.get('name') or f.get('path') or 'main.py')[:100]
            content = str(f.get('content') or f.get('code') or '')[:8000]
            clean.append({'name': name, 'content': content})
        if not clean:
            return Response({'error': 'Нет файлов'}, status=400)
        try:
            days = int(request.data.get('days') or 30)
        except Exception:
            days = 30
        if days not in (1, 30, 180, 0):
            days = 30
        expires = None if days == 0 else timezone.now() + timedelta(days=days)
        token = secrets.token_urlsafe(16)[:24]
        obj = SharedCode.objects.create(token=token, title=title, files=clean,
                                        owner=request.user, expires_at=expires)
        return Response({'token': token, 'url': f'/s/{token}', 'title': obj.title,
                         'expires_at': obj.expires_at}, status=201)

    def get(self, request, token=None):
        from .models import SharedCode
        if not token:
            return Response({'error': 'Нужен токен'}, status=400)
        try:
            obj = SharedCode.objects.get(token=token)
        except SharedCode.DoesNotExist:
            return Response({'error': 'Ссылка не найдена'}, status=404)
        if obj.is_expired:
            return Response({'error': 'Срок ссылки истёк'}, status=410)
        return Response({'title': obj.title, 'files': obj.files,
                         'created_at': obj.created_at})
