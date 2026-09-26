"""Proxy pool: `threads_per_proxy` worker threads per proxy, each bound to
its proxy for life (so upstream's thread-local curl sessions never change IP
mid-session), a shared two-lane priority queue (interactive before
background), a per-proxy token-bucket rate limit, cooldown after repeated
blocks, and a deadline after which a queued task resolves as blocked."""
import itertools
import queue
import threading
import time
from collections import deque
from concurrent.futures import Future, InvalidStateError
from concurrent.futures import TimeoutError as FutureTimeout

from sellerhill import egress

_LANE_PRIORITY = {"interactive": 0, "background": 1}
_OUTCOMES = ("found", "not_found", "blocked", "parse_failed", "no_proxy")
_STAT_KEYS = {"found": "found", "not_found": "notFound", "blocked": "blocked",
              "parse_failed": "parseFailed", "no_proxy": "noProxy"}


class _Proxy:
    def __init__(self, url, rate):
        self.url = url
        self.id = egress.redact(url) if url else "direct"
        self.rate = rate
        self.lock = threading.Lock()
        self.next_slot = 0.0
        self.block_streak = 0
        self.cool_until = 0.0
        self.retired = threading.Event()

    def wait_turn(self):
        with self.lock:
            now = time.monotonic()
            slot = max(now, self.next_slot)
            self.next_slot = slot + 1.0 / self.rate
        time.sleep(max(0.0, slot - time.monotonic()))


class ProxyPool:
    def __init__(self, fetch_one, threads_per_proxy=2, cooldown_seconds=300,
                 block_streak_for_cooldown=3, task_timeout_seconds=150):
        self._fetch_one = fetch_one
        self._threads_per_proxy = threads_per_proxy
        self._cooldown = cooldown_seconds
        self._streak_limit = block_streak_for_cooldown
        self._timeout = task_timeout_seconds
        self._queue = queue.PriorityQueue()
        self._seq = itertools.count()
        self._proxies = {}
        self._lock = threading.Lock()
        self._events = deque()  # (monotonic_ts, outcome, proxy_id, latency_ms)
        self._stop = threading.Event()

    # -- configuration ------------------------------------------------------------
    def ensure(self, proxies, rate):
        with self._lock:
            wanted = set(proxies)
            for url in list(self._proxies):
                if url not in wanted:
                    self._proxies.pop(url).retired.set()
            for url in proxies:
                if url in self._proxies:
                    self._proxies[url].rate = rate
                    continue
                p = _Proxy(url, rate)
                self._proxies[url] = p
                for _ in range(self._threads_per_proxy):
                    threading.Thread(target=self._worker, args=(p,), daemon=True).start()

    def shutdown(self):
        self._stop.set()
        with self._lock:
            for p in self._proxies.values():
                p.retired.set()

    # -- work ---------------------------------------------------------------------------
    def submit(self, asin, marketplace, mode, lane):
        fut = Future()
        fut.asin = asin
        fut.deadline = time.monotonic() + self._timeout
        self._queue.put((_LANE_PRIORITY[lane], next(self._seq), (asin, marketplace, mode, fut.deadline, fut)))
        return fut

    def wait(self, fut):
        """Block until the task resolves or its deadline passes; a task nobody
        picked up in time (every proxy cooling down) resolves as blocked. No
        timer thread per task — the waiter enforces the deadline."""
        remaining = max(0.0, fut.deadline - time.monotonic())
        try:
            return fut.result(timeout=remaining + 0.05)
        except FutureTimeout:
            self._expire(fut.asin, fut)
            return fut.result()

    def _resolve(self, fut, result):
        try:
            fut.set_result(result)
            return True
        except InvalidStateError:  # the waiter expired it first
            return False

    def _expire(self, asin, fut):
        if self._resolve(fut, {"asin": asin, "outcome": "blocked", "fetchedAt": None, "signals": None, "content": None}):
            self._record("blocked", None, None)

    def _worker(self, proxy):
        while not (self._stop.is_set() or proxy.retired.is_set()):
            if time.monotonic() < proxy.cool_until:
                time.sleep(min(1.0, proxy.cool_until - time.monotonic()))
                continue
            try:
                item = self._queue.get(timeout=0.5)
            except queue.Empty:
                continue
            if proxy.retired.is_set() or self._stop.is_set():
                # A retired proxy must never carry a task it already pulled off
                # the shared queue — put the SAME (priority, seq, task) tuple
                # straight back, unchanged, so ordering among still-queued
                # tasks is unaffected, and stop.
                self._queue.put(item)
                break
            _, _, (asin, marketplace, mode, deadline, fut) = item
            if fut.done():
                continue
            if time.monotonic() > deadline:
                self._expire(asin, fut)
                continue
            proxy.wait_turn()
            started = time.monotonic()
            with egress.bind(proxy.url):
                try:
                    result = self._fetch_one(asin, marketplace, mode)
                except Exception:  # never let one page kill a worker
                    result = {"asin": asin, "outcome": "blocked", "fetchedAt": None, "signals": None, "content": None}
            latency = (time.monotonic() - started) * 1000
            outcome = result.get("outcome")
            if outcome == "blocked":
                proxy.block_streak += 1
                if proxy.block_streak >= self._streak_limit:
                    proxy.cool_until = time.monotonic() + self._cooldown
                    proxy.block_streak = 0
            else:
                proxy.block_streak = 0
            self._record(outcome, proxy.id, latency)
            self._resolve(fut, result)

    # -- stats ----------------------------------------------------------------------------
    def record_no_proxy(self, count):
        for _ in range(count):
            self._record("no_proxy", None, None)

    def _record(self, outcome, proxy_id, latency):
        now = time.monotonic()
        with self._lock:
            self._events.append((now, outcome, proxy_id, latency))
            while self._events and now - self._events[0][0] > 86400:
                self._events.popleft()

    def stats(self):
        now = time.monotonic()
        with self._lock:
            events = list(self._events)
            proxies = list(self._proxies.values())

        def window(seconds):
            counts = {_STAT_KEYS[o]: 0 for o in _OUTCOMES}
            for ts, outcome, _, _ in events:
                if now - ts <= seconds and outcome in _STAT_KEYS:
                    counts[_STAT_KEYS[outcome]] += 1
            return counts

        latencies = [lat for ts, _, _, lat in events if lat is not None and now - ts <= 3600]
        return {
            "window1h": window(3600),
            "window24h": window(86400),
            "meanLatencyMs": round(sum(latencies) / len(latencies)) if latencies else None,
            "proxies": [{
                "id": p.id,
                "requests1h": sum(1 for ts, _, pid, _ in events if pid == p.id and now - ts <= 3600),
                "blocked1h": sum(1 for ts, o, pid, _ in events if pid == p.id and o == "blocked" and now - ts <= 3600),
                "coolingDown": now < p.cool_until,
            } for p in proxies],
        }
