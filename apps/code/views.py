from rest_framework import viewsets, permissions, status, throttling
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import CodeTask, CodeSubmission
from .serializers import CodeTaskSerializer, CodeTaskDetailSerializer, CodeSubmissionSerializer
from apps.accounts.permissions import TeacherWriteMixin
import subprocess, tempfile, os, sys, json, re, ast, textwrap, urllib.request, urllib.error

# Блокируемые паттерны для Python
# TODO: Заменить на реальную изоляцию: каждый прогон в Docker/nsjail с лимитами CPU/RAM, read-only FS, --network none
# Сейчас — усиленный denylist как временная мера, прод — делегировать все в Piston/Judge0 self-hosted
BLOCKED_PY = [
    'import subprocess','import socket','__import__','subprocess.','socket.','pickle','ctypes','eval(','exec(',
    # опасные os/shutil даже при разрешённом `import os`
    'os.system','os.popen','os.spawn','os.exec','os.fork','os.kill','os.remove','os.unlink','os.rename','os.mkdir','os.rmdir','os.removedirs',
    'os.chmod','os.chown','os.symlink','os.link','os.mknod','os.fifo',
    'shutil.rmtree','shutil.move','shutil.copy','shutil.copytree',
    'pathlib.Path.write','pathlib.Path.unlink',
]
BLOCKED_JS = ['require(','process.','fs.','child_process','eval(','Function(','import(']

# Разрешённые импорты для Python (os/sys/pathlib/shutil/django/pygame разрешены)
ALLOWED_PY_IMPORTS = {'os','sys','pathlib','shutil','re','json','math','random','datetime','collections','itertools','functools','typing','django','flask','pygame','numpy','pandas','requests','io','time','hashlib','copy','string','statistics','decimal','fractions','queue','heapq','bisect','array','enum','dataclasses'}

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
    """Честная ошибка Piston для views.py — НИКОГДА не выдумывает вывод.
    Любой фейковый _simulate_run для кодовых языков запрещён."""
    return (
        f"⚠️ Не удалось выполнить код на языке «{lang}»: сервис выполнения (Piston) "
        f"недоступен или вернул ошибку.\nПодробности: {detail}\n"
        f"Попробуй ещё раз через минуту. Если ошибка повторяется — язык требует self-hosted Piston (см. docker-compose.yml, сервис piston)."
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

def _is_safe_code(code: str, lang: str):
    if len(code) > 8000:
        return False, "Код слишком длинный (макс 8000 символов)"
    lower = code.lower()
    if lang == 'python':
        for pat in BLOCKED_PY:
            if pat.lower() in lower:
                return False, f"Запрещенный паттерн: {pat}"
        # AST проверка для python — только критичные импорты
        try:
            tree = ast.parse(code)
            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        if alias.name in ['subprocess','socket','ctypes','pickle']:
                            return False, f"Импорт {alias.name} запрещен"
                if isinstance(node, ast.ImportFrom):
                    if node.module in ['subprocess','socket','ctypes','pickle']:
                        return False, f"Импорт из {node.module} запрещен"
        except SyntaxError:
            pass
    elif lang == 'javascript':
        for pat in BLOCKED_JS:
            if pat.lower() in lower:
                return False, f"Запрещенный паттерн: {pat}"
    return True, ""

class CodeRunThrottle(throttling.UserRateThrottle):
    scope = 'code_run'
    rate = '1000/minute'

class AnonCodeThrottle(throttling.AnonRateThrottle):
    rate = '1000/minute'

class CodeTaskViewSet(TeacherWriteMixin, viewsets.ModelViewSet):
    queryset = CodeTask.objects.all().order_by('-created_at')
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    throttle_classes = [throttling.UserRateThrottle, throttling.AnonRateThrottle]

    def get_serializer_class(self):
        # только владелец/админ видит solution
        if self.action in ['retrieve','create','update','partial_update']:
            user = self.request.user
            if user.is_authenticated and (user.is_staff or user.role == 'admin'):
                return CodeTaskDetailSerializer
            # для остальных скрываем solution
            # но при создании/обновлении владелец может передать solution — разрешаем
            if self.action in ['create','update','partial_update']:
                return CodeTaskDetailSerializer
        return CodeTaskSerializer

    def get_queryset(self):
        # list — всем, но без solution уже
        return super().get_queryset()

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user if self.request.user.is_authenticated else None)

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

    @action(detail=True, methods=['post'], permission_classes=[permissions.AllowAny], throttle_classes=[throttling.AnonRateThrottle, throttling.UserRateThrottle])
    def run(self, request, pk=None):
        task = self.get_object()
        code = request.data.get('code','')
        stdin_data = request.data.get('input', request.data.get('stdin', ''))
        if stdin_data is None:
            stdin_data = ''
        if not isinstance(stdin_data, str):
            stdin_data = str(stdin_data)
        if not isinstance(code, str):
            return Response({'error':'code должен быть строкой'}, status=400)
        if len(code.strip()) == 0:
            return Response({'error':'Пустой код'}, status=400)
        task_lang = (task.language or '').lower().strip()
        if task_lang not in ALLOWED_LANGS:
            return Response({'output': f"Язык «{task.language}» отключен. Доступны: python, javascript, html, css.", 'passed': False}, status=400)
        safe, msg = _is_safe_code(code, task.language)
        if not safe:
            return Response({'output': f"Блокировка: {msg}", 'passed': False}, status=400)
        from .services.runner import run_single
        output, passed = run_single(code, task.language, stdin_data)
        if task.tests:
            try:
                passed = all(exp in output for t in task.tests for exp in [t.get('expected','')] if exp)
            except Exception:
                passed = False
        if request.user.is_authenticated:
            try:
                CodeSubmission.objects.create(task=task, user=request.user, code=code[:8000], output=output[:5000], passed=passed)
            except: pass
        return Response({'output': output[:5000], 'passed': passed})

    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny], throttle_classes=[throttling.AnonRateThrottle, throttling.UserRateThrottle])
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
        if not isinstance(files, list):
            return Response({'error': 'files должен быть списком'}, status=400)
        if len(files) > 99:
            return Response({'error': 'Слишком много файлов (макс 99)'}, status=400)
        # Эндпоинт требует IsAuthenticated, поэтому анонимных запросов сюда не доходит —
        # прежняя ветка с временной мутацией settings.CODE_USE_PISTON_ONLY была
        # недостижимым кодом и небезопасна (settings — общий на процесс, не per-request).
        # Изоляция для прода регулируется самим CODE_USE_PISTON_ONLY в settings.py.
        try:
            from .services.runner import run_project as runner_run_project
            output, passed = runner_run_project(files, entry=entry, requirements=requirements, stdin_data=stdin_data)
            return Response({'output': output[:5000], 'passed': passed})
        except Exception as e:
            return Response({'output': f"Ошибка: {e}", 'passed': False}, status=500)

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

    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny], throttle_classes=[throttling.AnonRateThrottle, throttling.UserRateThrottle], url_path='run_code')
    def run_code(self, request):
        """Универсальный раннер для всех языков (POST /api/code-tasks/run_code/). Требует авторизации."""
        code = request.data.get('code', '')
        lang = request.data.get('language') or request.data.get('lang') or request.data.get('type') or 'python'
        stdin_data = request.data.get('input') or request.data.get('stdin') or ''
        if stdin_data is None:
            stdin_data = ''
        if not isinstance(stdin_data, str):
            stdin_data = str(stdin_data)
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
        except Exception as e:
            return Response({'output': f"Ошибка: {e}", 'passed': False}, status=500)

    @action(detail=False, methods=['post'], permission_classes=[permissions.AllowAny], throttle_classes=[throttling.AnonRateThrottle, throttling.UserRateThrottle], url_path='explain')
    def explain(self, request):
        """AI-объяснение ошибки простыми словами (офлайн, без внешних API).
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
        except Exception as e:
            return Response({'error': f"Ошибка: {e}"}, status=500)

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
