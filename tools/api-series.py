#!/usr/bin/env python3
"""Keep-alive HTTP series runner for latency forensics.

Runs sequential GET requests over a single HTTPS connection (keep-alive) with
controlled intervals and pauses, printing one JSON row per request:
  {"op": ..., "start": ms, "end": ms, "ttfb": ms, "total": ms, "status": ...}

Usage:
  api-series.py [--env FILE] [--host URL] [--rounds N] [--interval S] \
      --op NAME:PATH:COUNT:INTERVAL [--pause SECONDS] ...

Examples:
  # 30 × /auth/me, 1s interval
  api-series.py --op authme:/api/auth/me:30:1.0

  # interleaved round-robin (one request per op per round)
  api-series.py --rounds 30 --interval 1.0 \
      --op ping:/api/ping:1:0 --op authme:/api/auth/me:1:0

  # phases with a pause between them
  api-series.py --op a:/api/auth/me:10:1.0 --pause 6 --op b:/api/auth/me:10:1.0
"""
import argparse
import http.client
import json
import ssl
import sys
import time


def parse_ops(items):
    ops = []
    for item in items:
        name, rest = item.split(':', 1)
        path, count, interval = rest.rsplit(':', 2)
        ops.append((name, path, int(count), float(interval)))
    return ops


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--env', default='/tmp/jitter.env', help='env file with TOKEN/TID/PID')
    p.add_argument('--host', default='https://task-board-api.app-server.workers.dev')
    p.add_argument('--rounds', type=int, default=0, help='round-robin mode: N rounds over all ops')
    p.add_argument('--interval', type=float, default=1.0, help='default interval between rounds')
    p.add_argument('--token', default=None, help='bearer token (overrides env file)')
    p.add_argument('--tenant', default=None, help='X-Tenant-Id (overrides env file)')
    p.add_argument('--timeout', type=float, default=60, help='socket timeout per request')
    p.add_argument('--op', action='append', default=[], help='NAME:PATH:COUNT:INTERVAL')
    args = p.parse_args()

    env = {}
    try:
        for line in open(args.env):
            line = line.strip()
            if '=' in line:
                k, _, v = line.partition('=')
                env[k] = v
    except FileNotFoundError:
        pass
    token = args.token or env.get('TOKEN', '')
    tenant = args.tenant or env.get('TID', '')

    host = args.host.replace('https://', '')
    ctx = ssl.create_default_context()
    conn = http.client.HTTPSConnection(host, context=ctx, timeout=args.timeout)

    def request(op, path, headers):
        global conn
        t0 = time.time()
        try:
            conn.request('GET', path, headers=headers)
            r = conn.getresponse()
            t2 = time.time()
            r.read()
            t3 = time.time()
            row = {'op': op, 'start': round(t0 * 1000), 'end': round(t3 * 1000),
                   'ttfb': round((t2 - t0) * 1000), 'total': round((t3 - t0) * 1000),
                   'status': r.status}
        except Exception as e:  # noqa: BLE001 — diagnostic tool: log and continue
            row = {'op': op, 'start': round(t0 * 1000), 'end': round(time.time() * 1000),
                   'total': round((time.time() - t0) * 1000), 'status': 'ERR',
                   'err': str(e)[:60]}
            try:
                conn.close()
            except Exception:
                pass
            conn = http.client.HTTPSConnection(host, context=ctx, timeout=args.timeout)
        print(json.dumps(row), flush=True)
        return row

    headers = {'Authorization': f'Bearer {token}'}
    if tenant:
        headers['X-Tenant-Id'] = tenant

    ops = parse_ops(args.op)
    if args.rounds > 0:
        for rnd in range(args.rounds):
            for name, path, count, interval in ops:
                request(name, path, headers)
            if rnd < args.rounds - 1:
                time.sleep(args.interval)
    else:
        for name, path, count, interval in ops:
            for i in range(count):
                request(name, path, headers)
                if i < count - 1:
                    time.sleep(interval)
    conn.close()


if __name__ == '__main__':
    main()
