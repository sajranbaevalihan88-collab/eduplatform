import os, signal, tempfile, subprocess, json, re, shutil, sys, textwrap, threading, time, logging, urllib.request, urllib.error

_log = logging.getLogger(__name__)
MAX_PROCESS_OUTPUT_BYTES = 32768

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
    """Честный ответ при недоступности Piston — без раскрытия внутренних URL/исключений."""
    _log.warning("Piston error (%s): %s", lang, detail)
    return (
        f"⚠️ Не удалось выполнить код на языке «{lang}»: сервис выполнения временно недоступен.\n"
        f"Попробуй ещё раз через минуту."
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

def _limit_memory(cpu_sec=6):
    """Ограничение RAM/CPU/FSIZE/NOFILE/NPROC для дочернего процесса (Linux). На Windows — no-op."""
    try:
        import resource
        # 256 MB RAM
        resource.setrlimit(resource.RLIMIT_AS, (256*1024*1024, 256*1024*1024))
        resource.setrlimit(resource.RLIMIT_DATA, (256*1024*1024, 256*1024*1024))
        # CPU time limit
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_sec, cpu_sec))
        # Макс размер создаваемого файла 2 MB
        resource.setrlimit(resource.RLIMIT_FSIZE, (2*1024*1024, 2*1024*1024))
        # Макс открытых дескрипторов
        resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
        # Защита от fork-bomb
        try:
            resource.setrlimit(resource.RLIMIT_NPROC, (32, 32))
        except Exception:
            pass
    except ImportError:
        pass
    except Exception:
        pass


def _kill_proc_tree(proc):
    try:
        if proc.poll() is not None:
            return
        if os.name != 'nt':
            try:
                os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
                return
            except Exception:
                pass
        proc.kill()
    except Exception:
        pass


def _run_bounded(cmd, stdin_data='', timeout=5, cwd=None, env=None, preexec_fn=None):
    """Запуск процесса с жёстким лимитом вывода (защита от OOM при print('A'*10**8)) и убийством всей группы процессов."""
    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        cwd=cwd,
        env=env,
        preexec_fn=preexec_fn,
        start_new_session=(os.name != 'nt'),
    )
    chunks = []
    total = 0
    truncated = False

    def _feed_stdin():
        try:
            if proc.stdin:
                if stdin_data:
                    proc.stdin.write(stdin_data[:8192].encode('utf-8', errors='replace'))
                proc.stdin.close()
        except Exception:
            pass

    def _read_stdout():
        nonlocal total, truncated
        try:
            while True:
                data = proc.stdout.read(4096)
                if not data:
                    break
                if total < MAX_PROCESS_OUTPUT_BYTES:
                    keep = data[:MAX_PROCESS_OUTPUT_BYTES - total]
                    chunks.append(keep)
                    total += len(keep)
                if total >= MAX_PROCESS_OUTPUT_BYTES:
                    truncated = True
                    _kill_proc_tree(proc)
                    break
        except Exception:
            pass

    t_in = threading.Thread(target=_feed_stdin, daemon=True)
    t_out = threading.Thread(target=_read_stdout, daemon=True)
    t_in.start()
    t_out.start()

    try:
        rc = proc.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        _kill_proc_tree(proc)
        t_out.join(timeout=1)
        raise
    t_out.join(timeout=1)
    text = b''.join(chunks).decode('utf-8', errors='replace')
    if truncated:
        text = text[:5000] + '\n…вывод обрезан (превышен лимит вывода)…'
    return text, rc

def _get_run_env(tmpdir: str):
    # Whitelist окружения: ребёнок получает только то, что нужно для запуска.
    # os.environ.copy() сливал бы GEMINI_API_KEY, POSTGRES_PASSWORD и прочие секреты
    # через print(os.environ) — раньше вырезали лишь 3 ключа, остальное утекало.
    _keep = {'PATH','SYSTEMROOT','WINDIR','SYSTEMDRIVE','TEMP','TMP','COMSPEC','PATHEXT',
             'HOME','USERPROFILE','LANG','LC_ALL','LD_LIBRARY_PATH','NUMBER_OF_PROCESSORS'}
    env = {k: v for k, v in os.environ.items() if k in _keep or k.upper() in _keep}
    env['PYTHONPATH'] = tmpdir + os.pathsep + env.get('PYTHONPATH','')
    env['SDL_VIDEODRIVER'] = 'dummy'
    env['PYGAME_HIDE_SUPPORT_PROMPT'] = '1'
    # кириллица в выводе: заставляем дочерний python писать stdout в UTF-8,
    # иначе на Windows print('Строка') даёт ???? при decode utf-8
    env['PYTHONIOENCODING'] = 'utf-8'
    env['PYTHONUTF8'] = '1'
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
    # Внешний Piston только при настроенном self-hosted инстансе (публичный emkc.org отключён: HTTP 401)
    try:
        from django.conf import settings
        piston_url = (getattr(settings, 'PISTON_URL', '') or '').strip()
        use_piston = getattr(settings, 'CODE_USE_PISTON_ONLY', False) and piston_url and ('emkc.org' not in piston_url.lower())
        if use_piston:
            if language in ('html', 'css'):
                return code[:3000], True
            out_p, ok_p = _piston_single(language, code, stdin_data)
            if ok_p or ('HTTP 401' not in out_p and 'сеть недоступна' not in out_p):
                return out_p, ok_p
    except Exception:
        pass
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
    # SDL_VIDEODRIVER='dummy' уже выставляется в _get_run_env(), поэтому инъекция `import os` не нужна
    # Изоляция: каждый запуск в своём tmpdir + cwd
    tmpdir = tempfile.mkdtemp(prefix='edu_single_')
    fname = None
    try:
        preexec = _limit_memory if os.name != 'nt' else None
        if language=='python':
            fname = os.path.join(tmpdir, 'main.py')
            with open(fname, 'w', encoding='utf-8') as f:
                f.write(code)
            env = _get_run_env(tmpdir)
            out_text, rc = _run_bounded(
                [sys.executable, '-I', '-X', 'utf8', fname],
                stdin_data=stdin_data, timeout=timeout, env=env, cwd=tmpdir, preexec_fn=preexec,
            )
            return out_text[:5000], rc == 0
        elif language == 'javascript':
            fname = os.path.join(tmpdir, 'main.js')
            with open(fname, 'w', encoding='utf-8') as f:
                f.write(code)
            # env + preexec обязательны: ограничивают RAM/CPU/процессы на уровне ОС и V8
            out_text, rc = _run_bounded(
                ['node', '--disallow-code-generation-from-strings', '--max-old-space-size=128', fname],
                stdin_data=stdin_data, timeout=timeout, cwd=tmpdir, env=_get_run_env(tmpdir), preexec_fn=preexec,
            )
            return out_text[:5000], rc == 0
        elif language in ('html', 'css'):
            return code[:3000], True
        else:
            return f"Язык «{language}» отключен. Доступны: python, javascript, html, css.", False
    except subprocess.TimeoutExpired:
        return "Timeout 5s — оптимизируй код", False
    except Exception:
        _log.exception("run_single failed")
        return "Ошибка выполнения программы", False
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
        if getattr(settings, 'CODE_USE_PISTON_ONLY', False) and len(files) > 1:
            # мультифайловый проект в проде не должен уходить в локальный subprocess — нет изоляции
            return ("Мультифайловые проекты выполняются только в локальном режиме. "
                    "Для прода настрой self-hosted Piston или собери один файл.", False)
    except: pass
    if not files:
        return "Нет файлов проекта", False
    if len(files) > 99:
        return "Слишком много файлов (макс 99 для проекта)", False

    # Нормализация files — жёсткая защита от path traversal (включая Windows drive letters C:/...)
    norm=[]
    for f in files:
        if not isinstance(f, dict):
            continue
        p = str(f.get('path') or f.get('name') or f.get('filename') or 'main.py').strip()
        p = p.replace('\\','/').lstrip('/')
        if not p or ':' in p or '\x00' in p or '..' in p.split('/') or os.path.isabs(p):
            continue
        c = str(f.get('content') or f.get('code') or '')
        if len(c) > 15000:
            c=c[:15000]
        norm.append((p,c))
    if not norm:
        return "Нет корректных файлов проекта", False

    # Определяем entry если не задан — первый .py
    if not entry or entry not in [p for p,_ in norm]:
        entry = next((p for p,_ in norm if p.endswith('.py')), norm[0][0])

    # HTML/CSS проект не запускается как python — он рендерится в превью фронтенда
    if entry.endswith(('.html', '.htm', '.css')):
        if not any(p.endswith('.py') for p,_ in norm):
            return ("HTML/CSS-проект показывается в браузерном превью: открой вкладку Preview и нажми Запустить. "
                    "style.css подхватывается автоматически (inline), index.html — точка входа.", True)
        entry = next((p for p,_ in norm if p.endswith('.py')))

    tmpdir = tempfile.mkdtemp(prefix='edu_proj_')
    real_tmp = os.path.realpath(tmpdir)
    try:
        # 1. Создаем дерево файлов (проверяем commonpath для каждого файла)
        for path, content in norm:
            full = os.path.realpath(os.path.join(real_tmp, path))
            try:
                if os.path.commonpath([real_tmp, full]) != real_tmp:
                    continue
            except ValueError:
                continue
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, 'w', encoding='utf-8') as f:
                f.write(content)
            # __init__.py для пакетов
            pkg_dir = os.path.dirname(full)
            if pkg_dir and path.count('/')>=1:
                parts = path.split('/')[:-1]
                cur=''
                for part in parts:
                    cur = os.path.join(cur, part) if cur else part
                    init_path = os.path.realpath(os.path.join(real_tmp, cur, '__init__.py'))
                    if os.path.commonpath([real_tmp, init_path]) == real_tmp and not os.path.exists(init_path):
                        open(init_path, 'a').close()

        # 2. requirements — pip install выключен по умолчанию (защита от DoS сети/диска).
        if requirements and requirements.strip():
            from django.conf import settings as _rs
            if not getattr(_rs, 'CODE_ALLOW_PIP_INSTALL', False):
                return ("Установка внешних pip-пакетов отключена в целях безопасности. Используйте стандартную библиотеку Python.", False)
            _safe_pkgs = {'pygame', 'numpy', 'pandas', 'matplotlib', 'pillow', 'flask', 'django', 'requests'}
            _bad = []
            _good = []
            for line in requirements.splitlines():
                ln = line.strip()
                if not ln or ln.startswith('#'):
                    continue
                name = ln.split('==')[0].split('>=')[0].split('<=')[0].split('[')[0].strip().lower()
                # запрещаем всё, что не «имя==версия» (URL, git+, опции pip)
                if not re.fullmatch(r'[A-Za-z0-9_.\-]+(==[A-Za-z0-9_.\-.]+)?', ln) or name not in _safe_pkgs:
                    _bad.append(ln)
                else:
                    _good.append(ln)
            if _bad:
                return ("Установка разрешена только из белого списка: " + ", ".join(sorted(_safe_pkgs)) +
                        ". Запрещено: " + ", ".join(_bad[:3]), False)
            if _good:
                req_file = os.path.join(tmpdir, 'requirements.txt')
                with open(req_file, 'w', encoding='utf-8') as f:
                    f.write('\n'.join(_good))
                # пробуем pip install --target tmpdir --quiet (таймаут 20с)
                try:
                    subprocess.run([sys.executable, '-m', 'pip', 'install', '--quiet', '--target', tmpdir, '-r', req_file],
                                   capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=20, cwd=tmpdir)
                except subprocess.TimeoutExpired:
                    pass
                except Exception:
                    pass

        # 3. Подготовка env — whitelist (секреты хоста не утекают)
        env = _get_run_env(tmpdir)

        # 4. Определяем команду запуска (только безопасный файл и белый список аргументов)
        entry_parts = entry.strip().split()
        entry_file = entry_parts[0] if entry_parts else 'main.py'
        _allowed_args = {'check'}
        entry_args = [a for a in entry_parts[1:2] if a in _allowed_args]

        # защита: только .py файлы без path traversal и Windows-дисков
        entry_file = entry_file.replace('\\', '/').lstrip('/')
        if ':' in entry_file or '..' in entry_file.split('/') or os.path.isabs(entry_file) or not entry_file.endswith('.py'):
            entry_file = 'main.py'

        # Если django проект — пробуем manage.py check/migrate первым делом
        is_django = any('DJANGO_SETTINGS_MODULE' in c or 'django' in c.lower() for _,c in norm) or 'manage.py' in [p for p,_ in norm]
        if is_django and entry_file=='main.py' and any(p=='manage.py' for p,_ in norm):
            entry_file='manage.py'
            entry_args=['check']

        full_entry = os.path.realpath(os.path.join(real_tmp, entry_file))
        try:
            in_base = os.path.commonpath([real_tmp, full_entry]) == real_tmp
        except ValueError:
            in_base = False
        if not in_base or not os.path.exists(full_entry):
            return f"Entry {entry_file} не найден. Файлы: {', '.join(p for p,_ in norm)}", False

        cmd = [sys.executable, '-I', '-X', 'utf8', full_entry] + entry_args

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
            # Для Flask — пробуем test_client без интерполяции путей в исходный код
            try:
                test_code = textwrap.dedent("""
import sys, importlib.util
sys.path.insert(0, sys.argv[1])
spec = importlib.util.spec_from_file_location("app_module", sys.argv[2])
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
                preexec_f = _limit_memory if os.name != 'nt' else None
                result = subprocess.run([sys.executable, '-I', '-c', test_code, tmpdir, full_entry], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=5, cwd=tmpdir, env=env, preexec_fn=preexec_f)
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
            out, rc = _run_bounded(cmd, stdin_data=stdin_data, timeout=timeout, cwd=tmpdir, env=env, preexec_fn=preexec)
            # Для pygame без дисплея — часто нет вывода, но и нет ошибки
            if not out.strip() and rc == 0:
                out = f"✓ Проект {entry} выполнен без вывода"
            passed = rc == 0

        # Спец-обработка django manage.py — если check прошел, считаем успехом
        if is_django and 'System check identified no issues' in out:
            passed=True

        return out[:5000], passed

    except subprocess.TimeoutExpired:
        return f"Timeout {timeout}s — оптимизируй код или уменьши файлы", False
    except Exception:
        _log.exception("run_project failed")
        return "Ошибка выполнения проекта", False
    finally:
        try:
            shutil.rmtree(tmpdir)
        except:
            pass

