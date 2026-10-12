"""Интерактивный запуск кода по WebSocket (как online-python: живой ввод).

Протокол (JSON):
  C->S {"type":"start","language":"python","code":"..."} -> S {"type":"started"}
  S->C {"type":"output","text":"..."}                # куски stdout/stderr
  S->C {"type":"need_input"}                        # похоже, программа ждёт ввод
  C->S {"type":"input","text":"..."}                # значение для stdin + Enter
  C->S {"type":"stop"}                              # убить процесс
  S->C {"type":"done","passed":bool,"code":int}     # процесс завершился
  S->C {"type":"error","message":"..."}             # ошибка сессии

Сессия живёт внутри своего соединения (Redis не нужен). Безопасность:
те же _is_safe_code, свой tmpdir, лимиты времени, чистка после завершения.
"""
import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
import threading
import time

from channels.generic.websocket import AsyncWebsocketConsumer

SESSION_TTL = 60          # максимум секунд на один запуск
WAIT_IDLE = 1.2           # тишина без вывода = похоже ждёт ввод
MAX_OUTPUT = 20000        # лимит вывода на сессию
MAX_GLOBAL_SESSIONS = 20  # максимум одновременных запусков на процесс

_global_running = 0


def _limit_memory():
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
    except Exception:
        pass


class RunSession:
    def __init__(self, language, code, loop):
        self.language = language
        self.code = code
        self.loop = loop
        self.tmpdir = tempfile.mkdtemp(prefix='edu_live_')
        self.proc = None
        self.queue = asyncio.Queue()
        self.total_out = 0
        self.last_out_ts = time.time()
        self._buf = []
        self._buflock = threading.Lock()
        self.waiting_sent = False
        self.deadline = time.time() + SESSION_TTL
        self._stop_reader = False

    def start(self):
        env = os.environ.copy()
        env['PYTHONIOENCODING'] = 'utf-8'
        env['PYTHONUTF8'] = '1'
        env['SDL_VIDEODRIVER'] = 'dummy'
        env['PYGAME_HIDE_SUPPORT_PROMPT'] = '1'
        for k in ('DJANGO_SECRET_KEY', 'DATABASE_URL', 'REDIS_URL'):
            env.pop(k, None)
        if self.language == 'python':
            fname = os.path.join(self.tmpdir, 'main.py')
            with open(fname, 'w', encoding='utf-8') as f:
                f.write(self.code)
            # -u: без буферизации, иначе подсказки input() не видны до ввода
            cmd = [sys.executable, '-u', fname]
            preexec = _limit_memory if os.name != 'nt' else None
        else:
            fname = os.path.join(self.tmpdir, 'main.js')
            with open(fname, 'w', encoding='utf-8') as f:
                f.write(self.code)
            cmd = ['node', fname]
            preexec = None
        self.proc = subprocess.Popen(
            cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            cwd=self.tmpdir, env=env, preexec_fn=preexec,
            text=True, encoding='utf-8', errors='replace', bufsize=1,
        )
        th = threading.Thread(target=self._reader, daemon=True)
        th.start()
        fl = threading.Thread(target=self._flusher, daemon=True)
        fl.start()
        self.last_out_ts = time.time()

    def _emit_buf(self):
        # вытолкнуть накопленное (вызывается из reader и flusher под локом снаружи)
        if not self._buf:
            return
        text = ''.join(self._buf)
        del self._buf[:]
        self.loop.call_soon_threadsafe(self.queue.put_nowait, ('out', text[:4000]))

    def _flusher(self):
        # Windows: peek по пайпам нет, поэтому недописанная строка (приглашение input)
        # выталкивается таймером, а не только по \n
        try:
            while not self._stop_reader:
                time.sleep(0.1)
                try:
                    with self._buflock:
                        self._emit_buf()
                except Exception:
                    pass
        except Exception:
            pass

    def _reader(self):
        # читаем по 1 символу: read(N) ждёт все N байт и прячет приглашения input() без \n
        try:
            while not self._stop_reader:
                try:
                    ch = self.proc.stdout.read(1)
                except Exception:
                    break
                if not ch:
                    break
                with self._buflock:
                    self._buf.append(ch)
                    if ch == '\n' or len(self._buf) >= 256:
                        self._emit_buf()
        except Exception:
            pass
        finally:
            try:
                rc = self.proc.wait(timeout=5)
            except Exception:
                rc = self.proc.returncode if self.proc.returncode is not None else -1
            self.loop.call_soon_threadsafe(self.queue.put_nowait, ('exit', rc))

    def send_input(self, text):
        try:
            if self.proc and self.proc.poll() is None and self.proc.stdin:
                self.proc.stdin.write((text or '') + '\n')
                self.proc.stdin.flush()
                self.waiting_sent = False
                self.last_out_ts = time.time()
                return True
        except Exception:
            pass
        return False

    def alive(self):
        return self.proc is not None and self.proc.poll() is None

    def kill(self):
        self._stop_reader = True
        try:
            if self.proc and self.proc.poll() is None:
                self.proc.kill()
        except Exception:
            pass

    def cleanup(self):
        self.kill()
        try:
            shutil.rmtree(self.tmpdir, ignore_errors=True)
        except Exception:
            pass


class RunConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        global _global_running
        if _global_running >= MAX_GLOBAL_SESSIONS:
            await self.close(code=1013)
            return
        await self.accept()
        self.session = None
        self._pump_task = None

    async def disconnect(self, code):
        if self.session:
            self.session.cleanup()
            self.session = None
        if self._pump_task:
            self._pump_task.cancel()

    async def receive(self, text_data=None, bytes_data=None):
        global _global_running
        try:
            msg = json.loads(text_data or '{}')
        except Exception:
            await self._send({'type': 'error', 'message': 'Битый JSON'})
            return
        kind = msg.get('type')
        if kind == 'start':
            if self.session:
                await self._send({'type': 'error', 'message': 'Сессия уже запущена'})
                return
            lang = str(msg.get('language') or 'python').lower().strip()
            lang = {'py': 'python', 'js': 'javascript'}.get(lang, lang)
            if lang not in ('python', 'javascript'):
                await self._send({'type': 'error', 'message': 'Интерактив доступен для python и javascript'})
                return
            code = str(msg.get('code') or '')
            if not code.strip():
                await self._send({'type': 'error', 'message': 'Пустой код'})
                return
            if len(code) > 8000:
                await self._send({'type': 'error', 'message': 'Код >8000 символов'})
                return
            try:
                from .views import _is_safe_code
                safe, why = _is_safe_code(code, lang)
                if not safe:
                    await self._send({'type': 'error', 'message': f'Блокировка: {why}'})
                    return
            except Exception:
                pass
            _global_running += 1
            try:
                self.session = RunSession(lang, code, asyncio.get_running_loop())
                await asyncio.to_thread(self.session.start)
                await self._send({'type': 'started'})
                self._pump_task = asyncio.create_task(self._pump())
            except Exception as e:
                _global_running -= 1
                self.session = None
                await self._send({'type': 'error', 'message': f'Не запустилось: {e}'})
        elif kind == 'input':
            if not self.session:
                await self._send({'type': 'error', 'message': 'Нет активной сессии'})
                return
            ok = await asyncio.to_thread(self.session.send_input, str(msg.get('text') or ''))
            if not ok:
                await self._send({'type': 'error', 'message': 'Программа уже завершилась'})
        elif kind == 'stop':
            if self.session:
                await asyncio.to_thread(self.session.kill)
                await self._send({'type': 'done', 'passed': False, 'code': -9, 'stopped': True})
                self.session.cleanup()
                self.session = None
                _global_running = max(0, _global_running - 1)
        else:
            await self._send({'type': 'error', 'message': 'Неизвестная команда'})

    async def _send(self, obj):
        try:
            await self.send(text_data=json.dumps(obj, ensure_ascii=False))
        except Exception:
            pass

    async def _pump(self):
        global _global_running
        sess = self.session
        try:
            while True:
                # таймаут сессии
                if time.time() > sess.deadline:
                    await asyncio.to_thread(sess.kill)
                    await self._send({'type': 'error', 'message': f'Таймаут {SESSION_TTL}с — программа убита'})
                    await self._send({'type': 'done', 'passed': False, 'code': -1})
                    break
                try:
                    kind, payload = await asyncio.wait_for(sess.queue.get(), timeout=0.3)
                except asyncio.TimeoutError:
                    # эвристика ожидания ввода: тишина + процесс жив
                    if (sess.alive() and not sess.waiting_sent
                            and time.time() - sess.last_out_ts > WAIT_IDLE):
                        sess.waiting_sent = True
                        await self._send({'type': 'need_input'})
                    continue
                if kind == 'out':
                    sess.last_out_ts = time.time()
                    sess.waiting_sent = False
                    sess.total_out += len(payload)
                    if sess.total_out <= MAX_OUTPUT:
                        await self._send({'type': 'output', 'text': payload})
                    elif not getattr(sess, '_truncated', False):
                        sess._truncated = True
                        await self._send({'type': 'output', 'text': '\n…вывод обрезан (лимит)…\n'})
                elif kind == 'exit':
                    await self._send({'type': 'done', 'passed': (payload == 0), 'code': payload})
                    break
        except asyncio.CancelledError:
            pass
        finally:
            if self.session is sess:
                sess.cleanup()
                self.session = None
            _global_running = max(0, _global_running - 1)
