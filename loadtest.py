"""Нагрузочный тест EduPlatform (stdlib only): логин + чтение уроков/тестов.
Запуск: python loadtest.py [--base http://127.0.0.1:8001/api]
Уровни: 10 / 50 / 100 / 200 одновременных, по 15 сек каждый. Отчёт: RPS, avg, p95, ошибки.
"""
import json
import sys
import time
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor

BASE = sys.argv[sys.argv.index('--base') + 1] if '--base' in sys.argv else 'http://127.0.0.1:8001/api'


def req(method, path, data=None, token=None):
    headers = {}
    body = None
    if data is not None:
        headers['Content-Type'] = 'application/json'
        body = json.dumps(data).encode()
    if token:
        headers['Authorization'] = 'Bearer ' + token
    r = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(r, timeout=20) as resp:
            resp.read()
            return time.perf_counter() - t0, resp.status
    except urllib.error.HTTPError as e:
        return time.perf_counter() - t0, e.code
    except Exception:
        return time.perf_counter() - t0, 0


def login():
    body = json.dumps({'username': 'demo', 'password': 'demo1234'}).encode()
    req = urllib.request.Request(BASE + '/auth/login/', data=body,
                                 headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read() or b'{}')
            tok = data.get('access') or data.get('token')
            if not tok:
                raise SystemExit('login: no token')
            return tok
    except Exception as e:
        raise SystemExit(f'login failed: {e}'[:200])


def worker(token, scenario, stop_at):
    lat, codes = [], {}
    i = 0
    while time.perf_counter() < stop_at:
        path = scenario[i % len(scenario)]
        dt, code = req('GET', path, token=token)
        lat.append(dt)
        codes[code] = codes.get(code, 0) + 1
        i += 1
    return lat, codes


def pct(data, p):
    if not data:
        return 0
    s = sorted(data)
    return s[min(len(s) - 1, int(len(s) * p / 100))]


def main():
    token = login()
    print('login OK')
    scenario = ['/health/', '/lessons/', '/tests/?is_public=true', '/subjects/']
    for conc in (10, 50, 100, 200):
        stop_at = time.perf_counter() + 15
        t0 = time.perf_counter()
        with ThreadPoolExecutor(max_workers=conc) as ex:
            futs = [ex.submit(worker, token, scenario, stop_at) for _ in range(conc)]
            all_lat, all_codes, n = [], {}, 0
            for f in futs:
                lat, codes = f.result()
                all_lat += lat
                n += len(lat)
                for k, v in codes.items():
                    all_codes[k] = all_codes.get(k, 0) + v
        dur = time.perf_counter() - t0
        ok = all_codes.get(200, 0)
        print(f'conc={conc:3d} req={n:5d} rps={n / dur:6.1f} avg={sum(all_lat) / max(len(all_lat), 1) * 1000:7.1f}ms '
              f'p95={pct(all_lat, 95) * 1000:7.1f}ms ok={ok / max(n, 1) * 100:.1f}% codes={all_codes}')


if __name__ == '__main__':
    main()
