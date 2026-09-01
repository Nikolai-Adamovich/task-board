#!/usr/bin/env python3
"""Parse `wrangler tail --format json` output containing `DBEV {json}` log lines
(emitted by the temporary mongo.ts diagnostic instrumentation) and correlate
them with client-side JSONL rows produced by api-series.py.

Usage:
  parse-dbev-tail.py --tail /tmp/tail.json [--series /tmp/series.jsonl] [--spike-threshold 200]

Prints:
  - event type counts
  - connection lifetimes (created -> closed) with close reasons
  - per-request segmentation for Mongo requests:
      arrival -> DO -> dbmw -> first checkOut -> checkedOut ->
      connCreated -> connReady -> cmdSucceeded(max dur) -> response
  - spikes (client total above threshold) with in-window driver events

Known artifact: DO event `wallTime` in wrangler tail approximates the interval
between events (polluted by request cadence) — do NOT use it as handler
duration. Reliable: `stateless` wallTime (Worker waiting for DO) and `cpuTime`.
"""
import argparse
import json
from collections import Counter


def parse_tail(path):
    data = open(path).read()
    events = []
    depth = 0
    start = None
    for i, ch in enumerate(data):
        if ch == '{':
            if depth == 0:
                start = i
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0 and start is not None:
                try:
                    events.append(json.loads(data[start:i + 1]))
                except Exception:
                    pass
                start = None
    evs = []
    for e in events:
        for log in e.get('logs') or []:
            m = log.get('message')
            s = m[0] if isinstance(m, list) and m else (m if isinstance(m, str) else None)
            if isinstance(s, str) and s.startswith('DBEV '):
                try:
                    evs.append(json.loads(s[5:]))
                except Exception:
                    pass
    return sorted(evs, key=lambda x: x.get('t', 0))


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--tail', required=True)
    p.add_argument('--series', default=None, help='client JSONL from api-series.py')
    p.add_argument('--spike-threshold', type=int, default=200)
    args = p.parse_args()

    evs = parse_tail(args.tail)
    cnt = Counter(e['ev'] for e in evs)
    print('Event counts:', dict(cnt))

    # connection lifetimes
    created = {}
    lifetimes = []
    for e in evs:
        if e['ev'] == 'connCreated':
            created[e.get('id')] = e['t']
        if e['ev'] == 'connClosed' and e.get('id') in created:
            t0 = created.pop(e['id'])
            lifetimes.append((e['t'] - t0, e.get('reason'), e.get('addr')))
    lts = sorted(l[0] for l in lifetimes)
    if lts:
        print(f'Connections: n={len(lts)} lifetime min={lts[0]} p50={lts[len(lts) // 2]} '
              f'max={lts[-1]} reasons={Counter(l[1] for l in lifetimes)}')

    if not args.series:
        return
    rows = [json.loads(l) for l in open(args.series) if l.strip()]
    rows = [r for r in rows if isinstance(r.get('total'), (int, float))]
    if not rows:
        print('Client: no rows with totals found')
        return
    ms = sorted(r['total'] for r in rows)
    spikes = [r for r in rows if r['total'] > args.spike_threshold]
    print(f'Client: n={len(rows)} p50={ms[len(ms) // 2]} max={ms[-1]} '
          f'spikes>{args.spike_threshold}ms={len(spikes)}')

    # connCreated -> connReady setup durations by connection id
    setup_by_id = {}
    pending_create = {}
    for e in evs:
        if e['ev'] == 'connCreated':
            pending_create[e.get('id')] = e['t']
        if e['ev'] == 'connReady' and e.get('id') in pending_create:
            setup_by_id[e['t']] = e['t'] - pending_create.pop(e.get('id'))

    print('\nPer-request segmentation (sorted by total desc, top 20):')
    print(f"{'total':>6} {'op':>12} | {'arr->DO':>7} {'DO->dbmw':>8} {'dbmw->1stCO':>11} "
          f"{'preDB':>6} {'newConn':>7} {'connSetup':>9} {'maxCmdDur':>9}")
    seg = []
    for r in rows:
        op = r.get('op', '-')
        win = [e for e in evs if r['start'] - 50 <= e.get('t', 0) <= r['end'] + 80]
        di = [e['t'] for e in win if e['ev'] == 'doIn']
        db = [e['t'] for e in win if e['ev'] == 'dbmw']
        cos = [e['t'] for e in win if e['ev'] == 'checkOutStarted']
        ready_ts = [e['t'] for e in win if e['ev'] == 'connReady']
        durs = [e['dur'] for e in win if e['ev'] == 'cmdSucceeded'
                and isinstance(e.get('dur'), (int, float))]
        f = lambda x: x if x is not None else '-'  # noqa: E731
        seg.append((
            r['total'], op,
            (di[0] - r['start']) if di else None,                 # arrival -> DO
            (db[0] - di[0]) if di and db else None,               # DO -> dbmw
            (min(cos) - db[0]) if db and cos else None,           # dbmw -> 1st checkout
            (min(cos) - r['start']) if cos else None,             # preDB
            len(ready_ts),                                        # new connections
            max((setup_by_id.get(t, 0) for t in ready_ts), default=0),
            max(durs) if durs else 0,
        ))
    seg.sort(reverse=True)
    for total, op, ew, dr, dc, pdb, nnew, setup, md in seg[:20]:
        f = lambda x: x if x is not None else '-'  # noqa: E731
        mark = ' <<<' if total > args.spike_threshold else ''
        print(f'{total:>6} {op:>12} | {f(ew):>7} {f(dr):>8} {f(dc):>11} '
              f'{f(pdb):>6} {nnew:>7} {setup:>9} {md:>9}{mark}')

    print('\nSpikes with in-window driver events:')
    for r in spikes:
        win = [e['ev'] for e in evs if r['start'] - 100 <= e.get('t', 0) <= r['end'] + 100]
        print(f"  {r['op']} client={r['total']} | connCreated={win.count('connCreated')} "
              f"connReady={win.count('connReady')} checkOutStarted={win.count('checkOutStarted')} "
              f"poolCleared={win.count('poolCleared')} hbFailed={win.count('hbFailed')} | {win[:12]}")


if __name__ == '__main__':
    main()
