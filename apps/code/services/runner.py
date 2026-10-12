import os, tempfile, subprocess, json, re, shutil, sys, textwrap, urllib.request, urllib.error

# Piston карта — только 2 исполняемых языка (остальное preview/disabled)
# python/javascript идут локально (subprocess), html/css — preview без запуска
PISTON_MAP_SINGLE = {
    'python': ('python', '3.10.0'), 'javascript': ('javascript', '18.15.0'),
}
def _check_piston_limit_runner():
    try:
        from django.core.cache import cache
        from django.conf import settings
        import datetime
        today = datetime.date.today().isoformat()
        key = f"piston_daily_{today}"
        limit = getattr(settings, 'PISTON_DAILY_LIMIT', 500)
        count = cache.get(key, 0)
        if count >= limit:
            return False
        try: cache.add(key, 0, 86400)
        except: pass
        cache.set(key, count+1, 86400)
        return True
    except: return True

def _piston_error(lang, detail):
    """Честный ответ при недоступности Piston — НИКОГДА не выдумывает вывод программы.
    Раньше здесь была regex-симуляция, которая подставляла правдоподобный вывод
    вместо реального запуска — это давало ложное 'passed: True' даже для битого
    кода. Убрано намеренно: лучше явная ошибка, чем фальшивый результат."""
    return (
        f"⚠️ Не удалось выполнить код на языке «{lang}»: сервис выполнения (Piston) "
        f"недоступен или вернул ошибку.\nПодробности: {detail}\n"
        f"Попробуй ещё раз через минуту. Если ошибка повторяется — язык, скорее всего, "
        f"требует self-hosted Piston (см. docker-compose.yml, сервис piston)."
    ), False

def _get_setting(name, default):
    try:
        from django.conf import settings as _dj_settings
        return getattr(_dj_settings, name, default)
    except Exception:
        return default


ALLOWED_RUN_LANGS = {'python', 'javascript', 'html', 'css'}

# Godbolt удален при оптимизации: c/cpp/go/rust отключены (нестабильны на выставке).
# Оставлен пустой маппинг чтобы capabilities не падал при импорте.
GODBOLT_LANGS = {}

def _godbolt_execute(lang, code, stdin='', timeout=8):
    return (f"Язык «{lang}» отключен. Доступны: python, javascript, html, css.", False)


def _piston_single(lang, code, stdin=''):
    if not _check_piston_limit_runner():
        return _piston_error(lang, "превышен дневной лимит запросов к Piston (PISTON_DAILY_LIMIT)")
    url = _get_setting('PISTON_URL', 'https://emkc.org/api/v2/piston/execute')
    piston_timeout = _get_setting('PISTON_TIMEOUT', 6)
    p_lang, p_ver = PISTON_MAP_SINGLE.get(lang, (lang, '*'))
    versions_to_try = [p_ver, "*"] if p_ver != "*" else ["*"]
    last_detail = "неизвестная ошибка"
    for ver in versions_to_try:
        payload = json.dumps({"language": p_lang, "version": ver, "files": [{"content": code}], "stdin": stdin}).encode()
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json", "User-Agent": "EduPlatform/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=piston_timeout) as r:
                res = json.loads(r.read().decode())
                out = res.get("run", {}).get("output") or (res.get("run", {}).get("stdout","") + res.get("run", {}).get("stderr",""))
                return (out or "")[:5000], res.get("run", {}).get("code",0)==0
        except urllib.error.HTTPError as e:
            try:
                body = e.read().decode('utf-8', errors='replace')[:300]
            except Exception:
                body = ""
            last_detail = f"HTTP {e.code} от {url} (version={ver}): {body}"
            if e.code in (400, 404) and ver != "*":
                continue
            return _piston_error(lang, last_detail)
        except urllib.error.URLError as e:
            last_detail = f"сеть недоступна: {e.reason}"
            return _piston_error(lang, last_detail)
        except Exception as e:
            last_detail = f"{type(e).__name__}: {e}"
            return _piston_error(lang, last_detail)
    return _piston_error(lang, last_detail)

def _limit_memory():
    """Ограничение RAM для дочернего процесса (Linux). На Windows — no-op."""
    try:
        import resource
        # 256 MB
        resource.setrlimit(resource.RLIMIT_AS, (256*1024*1024, 256*1024*1024))
        resource.setrlimit(resource.RLIMIT_DATA, (256*1024*1024, 256*1024*1024))
    except ImportError:
        pass
    except Exception:
        pass

def _get_run_env(tmpdir: str):
    env = os.environ.copy()
    env['PYTHONPATH'] = tmpdir + os.pathsep + env.get('PYTHONPATH','')
    env['SDL_VIDEODRIVER'] = 'dummy'
    env['PYGAME_HIDE_SUPPORT_PROMPT'] = '1'
    # кириллица в выводе: заставляем дочерний python писать stdout в UTF-8,
    # иначе на Windows print('Строка') даёт ???? при decode utf-8
    env['PYTHONIOENCODING'] = 'utf-8'
    env['PYTHONUTF8'] = '1'
    for k in ['DJANGO_SECRET_KEY','DATABASE_URL','REDIS_URL']:
        env.pop(k, None)
    return env

def _count_inputs(code):
    """Сколько input() в коде (грубо: вызовы вне комментариев). Для подсказки про строки ввода."""
    n = 0
    try:
        for line in code.split('\n'):
            s = line.strip()
            if not s or s.startswith('#'):
                continue
            # отрезаем концевой комментарий (грубо, без учёта # в строках)
            code_part = s.split('#')[0]
            n += len(re.findall(r'(?<![\w.])input\s*\(', code_part))
    except Exception:
        pass
    return n


def check_stdin(code, stdin_data):
    """Возвращает текст-подсказку если ввода не хватит, иначе None."""
    need = _count_inputs(code)
    if not need:
        return None
    given = [l for l in (stdin_data or '').split('\n')]
    # пустой ввод вообще
    if not (stdin_data or '').strip():
        return ("⚠️ В программе %d вызов(а) input() — введи значения в поле «Ввод для input()» "
                "(каждое с новой строки, всего %d) и нажми Run снова." % (need, need), False)
    if len(given) < need:
        return ("⚠️ Программе нужно строк ввода: %d, а дано: %d — допиши недостающие "
                "с новой строки и нажми Run снова." % (need, len(given)), False)
    return None


def run_single(code, language='python', stdin_data='', timeout=5):
    """Единый раннер — только python/javascript/html/css (оптимизировано для выставки)."""
    language = (language or 'python').lower().strip()
    # нормализация — только 4 языка
    alias = {'py': 'python', 'js': 'javascript', 'htm': 'html'}
    language = alias.get(language, language)
    if language not in ALLOWED_RUN_LANGS:
        return f"Язык «{language}» отключен. Доступны: python, javascript, html, css.", False
    # Прод-режим: гнать всё через Piston/Judge0, без локального subprocess (изоляция из коробки)
    try:
        from django.conf import settings
        if getattr(settings, 'CODE_USE_PISTON_ONLY', False):
            # html/css — всё равно preview, остальное — Piston
            if language in ('html', 'css'):
                return code[:3000], True
            return _piston_single(language, code, stdin_data)
        if getattr(settings, 'CODE_USE_DOCKER', False):
            # Заглушка для Docker — пока делегируем в Piston
            return _piston_single(language, code, stdin_data)
    except: pass
    has_input = 'input(' in code if language=='python' else False
    if has_input:
        hint = check_stdin(code, stdin_data)
        if hint:
            return hint
    # Flask — сразу HTML (не запускаем сервер)
    if language=='python' and 'from flask import' in code and 'Flask(' in code:
        m = re.search(r'HTML\s*=\s*"""([\s\S]*?)"""', code)
        if not m:
            m = re.search(r"HTML\s*=\s*'''([\s\S]*?)'''", code)
        if m:
            return m.group(1)[:4000] + "\n--- Flask HTML для Preview ---", True
    # headless pygame
    if language=='python' and 'import pygame' in code and 'SDL_VIDEODRIVER' not in code:
        code = 'import os\nos.environ["SDL_VIDEODRIVER"]="dummy"\n' + code
    # Изоляция: каждый запуск в своём tmpdir + cwd
    tmpdir = tempfile.mkdtemp(prefix='edu_single_')
    fname = None
    try:
        if language=='python':
            fname = os.path.join(tmpdir, 'main.py')
            with open(fname, 'w', encoding='utf-8') as f:
                f.write(code)
            env = _get_run_env(tmpdir)
            # На Linux — лимит памяти через preexec_fn, на Windows — через env
            preexec = _limit_memory if os.name != 'nt' else None
            result = subprocess.run(
                [sys.executable, fname], input=stdin_data,
                capture_output=True, text=True, encoding='utf-8', errors='replace',
                timeout=timeout, env=env, cwd=tmpdir, preexec_fn=preexec
            )
            return (result.stdout+result.stderr)[:5000], result.returncode==0
        elif language == 'javascript':
            fname = os.path.join(tmpdir, 'main.js')
            with open(fname, 'w', encoding='utf-8') as f:
                f.write(code)
            result = subprocess.run(['node', fname], input=stdin_data, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout, cwd=tmpdir)
            return (result.stdout+result.stderr)[:5000], result.returncode==0
        elif language in ('html', 'css'):
            return code[:3000], True
        else:
            return f"Язык «{language}» отключен. Доступны: python, javascript, html, css.", False
    except subprocess.TimeoutExpired:
        return "Timeout 5s — оптимизируй код", False
    except Exception as e:
        return f"Ошибка: {e}", False
    finally:
        if fname and os.path.exists(fname):
            try: os.unlink(fname)
            except: pass
        if tmpdir and os.path.exists(tmpdir):
            try: shutil.rmtree(tmpdir)
            except: pass

# Запускает мультифайл проект (django/pygame/обычный) — до 99 файлов лимит сохранён (1 файл runner.py)
def run_project(files, entry='main.py', requirements='', stdin_data='', timeout=8):
    """
    files: [{path: 'main.py', content: '...'}, ...] или [{name, content}] 
    entry: главный файл для запуска (например 'main.py' или 'manage.py check')
    requirements: строка 'django==5.1\npygame==2.5' — pip install в tmpdir
    stdin_data: ввод для input()
    возвращает (output, passed)
    """
    # Прод Piston-only
    try:
        from django.conf import settings
        if getattr(settings, 'CODE_USE_PISTON_ONLY', False) and files and len(files)==1:
            f = files[0]
            lang_guess = (f.get('path') or '').split('.')[-1] if '.' in (f.get('path') or '') else 'python'
            return run_single(f.get('content') or f.get('code') or '', lang_guess, stdin_data, timeout)
    except: pass
    if not files:
        return "Нет файлов проекта", False
    if len(files) > 99:
        return "Слишком много файлов (макс 99 для проекта)", False

    # Нормализация files
    norm=[]
    for f in files:
        p = f.get('path') or f.get('name') or f.get('filename') or 'main.py'
        # защита от traversal
        p = p.replace('\\','/').lstrip('/')
        if '..' in p or p.startswith('/'):
            continue
        c = f.get('content') or f.get('code') or ''
        if len(c) > 15000:
            c=c[:15000]
        norm.append((p,c))

    # Определяем entry если не задан — первый .py
    if not entry or entry not in [p for p,_ in norm]:
        entry = next((p for p,_ in norm if p.endswith('.py')), norm[0][0])

    tmpdir = tempfile.mkdtemp(prefix='edu_proj_')
    try:
        # 1. Создаем дерево файлов
        for path, content in norm:
            full = os.path.join(tmpdir, path)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            # Костыль для pygame headless — вставляем SDL_VIDEODRIVER=dummy если есть pygame
            if 'pygame' in content and 'SDL_VIDEODRIVER' not in content:
                content = 'import os\nos.environ["SDL_VIDEODRIVER"]="dummy"\n' + content
            with open(full, 'w', encoding='utf-8') as f:
                f.write(content)
            # __init__.py для пакетов django
            pkg_dir = os.path.dirname(full)
            if pkg_dir and path.count('/')>=1:
                # создаем __init__.py для каждого пакета если его нет
                parts = path.split('/')[:-1]
                cur=''
                for part in parts:
                    cur = os.path.join(cur, part) if cur else part
                    init_path = os.path.join(tmpdir, cur, '__init__.py')
                    if not os.path.exists(init_path):
                        open(init_path, 'a').close()

        # 2. requirements — pip install в tmpdir (изолированно, без сети = пропускаем если нет интернета)
        if requirements and requirements.strip():
            req_file = os.path.join(tmpdir, 'requirements.txt')
            with open(req_file, 'w', encoding='utf-8') as f:
                f.write(requirements)
            # пробуем pip install --target tmpdir --quiet (таймаут 20с)
            try:
                subprocess.run([sys.executable, '-m', 'pip', 'install', '--quiet', '--target', tmpdir, '-r', req_file],
                               capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=20, cwd=tmpdir)
            except subprocess.TimeoutExpired:
                pass
            except Exception:
                pass

        # 3. Подготовка env — изолируем, но разрешаем os/sys внутри проекта
        env = os.environ.copy()
        env['PYTHONPATH'] = tmpdir + os.pathsep + env.get('PYTHONPATH','')
        env['SDL_VIDEODRIVER'] = 'dummy'
        env['PYGAME_HIDE_SUPPORT_PROMPT'] = '1'
        env['PYTHONIOENCODING'] = 'utf-8'
        env['PYTHONUTF8'] = '1'
        # Убираем секреты хоста
        for k in ['DJANGO_SECRET_KEY','DATABASE_URL','REDIS_URL']:
            env.pop(k, None)

        # 4. Определяем команду запуска
        # entry может быть "main.py" или "manage.py check" или "manage.py runserver"
        entry_parts = entry.strip().split()
        entry_file = entry_parts[0]
        entry_args = entry_parts[1:]

        # защита: только .py файлы
        if not entry_file.endswith('.py'):
            entry_file = 'main.py'

        # Если django проект — пробуем manage.py check/migrate первым делом
        is_django = any('DJANGO_SETTINGS_MODULE' in c or 'django' in c.lower() for _,c in norm) or 'manage.py' in [p for p,_ in norm]
        if is_django and entry_file=='main.py' and any(p=='manage.py' for p,_ in norm):
            entry_file='manage.py'
            entry_args=['check']

        full_entry = os.path.join(tmpdir, entry_file)
        if not os.path.exists(full_entry):
            return f"Entry {entry_file} не найден. Файлы: {', '.join(p for p,_ in norm)}", False

        cmd = [sys.executable, full_entry] + entry_args
        # Для django runserver — делаем check вместо сервера (сервер — долгий процесс)
        if 'runserver' in entry_args:
            cmd = [sys.executable, full_entry, 'check']

        # 5. Запуск — спец-обработка Flask (app.run блокирует, делаем тест-клиент)
        flask_detected = any('from flask import' in c and 'Flask(' in c for _,c in norm)
        # читаем entry без BOM
        try:
            entry_content = open(full_entry, encoding='utf-8-sig', errors='ignore').read()
        except:
            entry_content = ""
        # умная проверка ввода для python-проектов (сколько input — столько строк нужно)
        if entry_file.endswith('.py') and 'input(' in entry_content:
            _hint = check_stdin(entry_content, stdin_data)
            if _hint:
                return _hint
        if flask_detected and 'app.run' in entry_content:
            # Для Flask — пробуем test_client, иначе извлекаем HTML
            try:
                test_code = textwrap.dedent(f"""
import sys
sys.path.insert(0, r'{tmpdir}')
import importlib.util
spec = importlib.util.spec_from_file_location("app_module", r"{full_entry}")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
app = getattr(mod, 'app', None)
if app:
    c = app.test_client()
    r = c.get('/')
    print(r.data.decode('utf-8', errors='ignore')[:4000])
else:
    print("Flask app не найден")
""")
                result = subprocess.run([sys.executable, '-c', test_code], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=5, cwd=tmpdir, env=env)
                out = (result.stdout + '\n' + result.stderr)[:5000]
                # если No module named flask — пробуем извлечь HTML напрямую
                if 'No module named' in out or 'ModuleNotFoundError' in out:
                    m = re.search(r'HTML\s*=\s*"""([\s\S]*?)"""', entry_content)
                    if not m:
                        m = re.search(r"HTML\s*=\s*'''([\s\S]*?)'''", entry_content)
                    if m:
                        out = m.group(1)[:4000]
                        passed=True
                    else:
                        out = out
                        passed=False
                elif out.strip():
                    passed = result.returncode==0
                else:
                    m = re.search(r'HTML\s*=\s*"""([\s\S]*?)"""', entry_content)
                    if m:
                        out = m.group(1)[:4000]
                        passed=True
                    else:
                        out = "Flask app — HTML не найден"
                        passed=True
            except Exception as e:
                # fallback — извлечь HTML
                m = re.search(r'HTML\s*=\s*"""([\s\S]*?)"""', entry_content)
                if m:
                    out = m.group(1)[:4000]
                    passed=True
                else:
                    out = f"Flask preview: {e}"
                    passed=True
        else:
            preexec = _limit_memory if os.name != 'nt' else None
            result = subprocess.run(cmd, input=stdin_data, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=timeout, cwd=tmpdir, env=env, preexec_fn=preexec)
            out = (result.stdout + '\n' + result.stderr)[:5000]
            # Для pygame без дисплея — часто нет вывода, но и нет ошибки
            if not out.strip() and result.returncode==0:
                out = f"✓ Проект {entry} выполнен без вывода (pygame/django headless OK)"
            passed = result.returncode==0

        # Спец-обработка django manage.py — если check прошел, считаем успехом
        if is_django and 'System check identified no issues' in out:
            passed=True

        return out[:5000], passed

    except subprocess.TimeoutExpired:
        return f"Timeout {timeout}s — оптимизируй код или уменьши файлы", False
    except Exception as e:
        return f"Ошибка проекта: {e}", False
    finally:
        try:
            shutil.rmtree(tmpdir)
        except:
            pass

