"""Proxy pool: worker threads per proxy, each bound to its proxy for life (so
upstream's thread-local curl sessions never change IP mid-session), a shared
three-lane priority queue (interactive, then browse, then background), a
per-proxy
token-bucket rate limit, cooldown after repeated blocks, and a deadline after
which a task that has not resolved (queued OR in flight) resolves as blocked
on the wire.

Threads follow the rate. A worker is busy for the whole page fetch (~2 s with
warm-up and relocation), so one proxy can only complete `threads / latency`
requests per second whatever its rate says. `ensure` therefore runs
`ceil(rate * 4)` workers per proxy (never fewer than `threads_per_proxy`,
capped at `_MAX_THREADS_PER_PROXY`), which keeps throughput ≈ rate × proxies
while Amazon answers within ~2 s — the figure the API's batch size assumes.

Stats keep causes apart even where the wire outcome is the same: a deadline
expiry is `expired` and a transport/proxy failure is `proxy_error`. Both reach
the API as `blocked` (transient, retry later), but neither is Amazon blocking
us, so neither may feed the block rate that drives a critical warning."""
import itertools
import math
import logging
import queue
import threading
import time
from collections import deque
from concurrent.futures import Future, InvalidStateError
from concurrent.futures import TimeoutError as FutureTimeout

from sellerhill import egress

_log = logging.getLogger(__name__)

# interactive: a seller waiting on a create. browse: a seller waiting on a
# Best Sellers page — behind creates, ahead of the background refresh, which
# nobody is watching. background: the scheduled price/stock refresh.
_LANE_PRIORITY = {"interactive": 0, "browse": 1, "background": 2}
_OUTCOMES = ("found", "not_found", "blocked", "parse_failed", "no_proxy", "expired", "proxy_error")
_STAT_KEYS = {"found": "found", "not_found": "notFound", "blocked": "blocked",
              "parse_failed": "parseFailed", "no_proxy": "noProxy",
              "expired": "expired", "proxy_error": "proxyError"}
# Stat-only outcomes → the outcome the API sees. The API's contract has one
# transient bucket ("blocked": skip, retry after the lease); the split exists
# for the operator's stats, not for the caller.
_WIRE_OUTCOME = {"expired": "blocked", "proxy_error": "blocked"}
_MAX_THREADS_PER_PROXY = 40
_THREADS_PER_RPS = 4


_LATENCY_HEADROOM = 1.5


def threads_for_rate(rate, floor, cap=_MAX_THREADS_PER_PROXY, latency_s=None):
    """Workers one proxy needs to sustain `rate` requests/sec.

    A worker is busy for one whole page round trip, so a proxy can complete at
    most `threads / latency` pages per second whatever its rate budget says.
    With no measurement the ~2 s assumption applies (ceil(rate * 4), headroom
    included). Once the pool has measured its own latency the count follows
    it — `rate * latency * 1.5` — because the fixed assumption was what held a
    pool with 20 s round trips at 0.2 pages/s per proxy against a 1/s budget,
    and no setting could reach the budget without knowing the latency.
    Never below `floor`, never above `cap`, and never below the fixed
    assumption (a fast proxy keeps its headroom)."""
    per_rps = _THREADS_PER_RPS
    if latency_s is not None and latency_s > 0:
        per_rps = max(per_rps, latency_s * _LATENCY_HEADROOM)
    return min(cap, max(floor, math.ceil(rate * per_rps)))


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
        self.threads = 0

    def wait_turn(self):
        with self.lock:
            now = time.monotonic()
            slot = max(now, self.next_slot)
            self.next_slot = slot + 1.0 / self.rate
        time.sleep(max(0.0, slot - time.monotonic()))


class ProxyPool:
    def __init__(self, fetch_one, threads_per_proxy=2, cooldown_seconds=300,
                 block_streak_for_cooldown=3, task_timeout_seconds=150,
                 max_threads_per_proxy=_MAX_THREADS_PER_PROXY):
        self._fetch_one = fetch_one
        self._threads_per_proxy = threads_per_proxy
        self._max_threads = max_threads_per_proxy
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
            wanted_threads = threads_for_rate(rate, self._threads_per_proxy, self._max_threads,
                                              latency_s=self._recent_latency_s(time.monotonic()))
            for url in proxies:
                p = self._proxies.get(url)
                if p is None:
                    p = self._proxies[url] = _Proxy(url, rate)
                p.rate = rate
                # Grow only: a lowered rate leaves extra workers idle behind the
                # token bucket, which is harmless; growing is what a raise needs.
                while p.threads < wanted_threads:
                    threading.Thread(target=self._worker, args=(p,), daemon=True).start()
                    p.threads += 1

    def _recent_latency_s(self, now, window=3600):
        """Mean page round trip over the last `window` seconds, in seconds, or
        None before anything has been measured. Called with `_lock` held."""
        latencies = [lat for ts, _, _, lat in self._events if lat is not None and now - ts <= window]
        if not latencies:
            return None
        return (sum(latencies) / len(latencies)) / 1000.0

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

    def submit_call(self, fn, lane, expired_result):
        """Run an arbitrary `fn()` on a pool worker — same proxy binding, rate
        limit, cooldown, deadline and stats as a product fetch. `fn` returns a
        dict with an `outcome` key from the product vocabulary (`found`,
        `not_found`, `blocked`, `parse_failed`, `no_proxy`, `proxy_error`) and
        may carry `netMs`. `expired_result` is the caller's own wire shape for
        a task that never resolved — the product path's ASIN-shaped dict would
        be wrong for a Best Sellers page. It is returned with `outcome` forced
        to the wire value for `expired`.

        One call takes ONE `wait_turn` token however many HTTP requests `fn`
        makes (a Best Sellers page is the page GET plus up to three ACP POSTs
        plus a possible session warm-up). Acceptable: the token bucket exists
        to space out page loads per proxy, and one list page is one page load
        from Amazon's side of the fence."""
        fut = Future()
        fut.asin = None
        fut.expired_result = expired_result
        fut.deadline = time.monotonic() + self._timeout
        self._queue.put((_LANE_PRIORITY[lane], next(self._seq), ("call", fn, fut.deadline, fut, expired_result)))
        return fut

    def wait(self, fut):
        """Block until the task resolves or its deadline passes. A task still
        unresolved at its deadline — queued behind cooling proxies, or still in
        flight on a slow page — resolves as blocked on the wire and is counted
        as `expired`. No timer thread per task — the waiter enforces the
        deadline."""
        remaining = max(0.0, fut.deadline - time.monotonic())
        try:
            return fut.result(timeout=remaining + 0.05)
        except FutureTimeout:
            self._expire_future(fut)
            return fut.result()

    def _resolve(self, fut, result):
        try:
            fut.set_result(result)
            return True
        except InvalidStateError:  # the waiter expired it first
            return False

    def _expire(self, asin, fut):
        if self._resolve(fut, {"asin": asin, "outcome": _WIRE_OUTCOME["expired"], "fetchedAt": None,
                               "signals": None, "content": None}):
            self._record("expired", None, None)

    def _expire_call(self, fut, expired_result):
        if self._resolve(fut, {**expired_result, "outcome": _WIRE_OUTCOME["expired"]}):
            self._record("expired", None, None)

    def _expire_future(self, fut):
        """Expire either kind of task from the waiter side, in its own shape."""
        expired_result = getattr(fut, "expired_result", None)
        if expired_result is not None:
            self._expire_call(fut, expired_result)
        else:
            self._expire(fut.asin, fut)

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
            _, _, task = item
            # Two task shapes share the queue: a product fetch
            # (asin, marketplace, mode, deadline, fut) and a generic call
            # ("call", fn, deadline, fut, expired_result) from submit_call.
            is_call = task[0] == "call"
            if is_call:
                _, fn, deadline, fut, expired_result = task
                asin, marketplace, mode = None, None, None
            else:
                asin, marketplace, mode, deadline, fut = task
                fn, expired_result = None, None
            if fut.done():
                continue
            if time.monotonic() > deadline:
                if is_call:
                    self._expire_call(fut, expired_result)
                else:
                    self._expire(asin, fut)
                continue
            proxy.wait_turn()
            if proxy.retired.is_set() or self._stop.is_set():
                # wait_turn() can sleep for seconds (a low per-proxy rate, or a
                # backlog behind it) — a proxy removed by ensure() during that
                # sleep must still never carry the request. Requeue the SAME
                # item, unchanged, and stop, exactly as the pre-wait_turn check
                # above does.
                self._queue.put(item)
                break
            started = time.monotonic()
            no_streak_change = False
            with egress.bind(proxy.url):
                try:
                    result = fn() if is_call else self._fetch_one(asin, marketplace, mode)
                except egress.NoProxyError:
                    no_streak_change = True
                    if is_call:
                        result = {**expired_result, "outcome": "no_proxy"}
                    else:
                        result = {"asin": asin, "outcome": "no_proxy", "fetchedAt": None, "signals": None, "content": None}
                except Exception as exc:  # never let one page kill a worker
                    # A parser/logic bug (bad marketplace, a crash inside
                    # signals/content extraction) is OUR failure, not evidence
                    # Amazon is blocking this proxy — it must never accrue
                    # block_streak or cool the proxy down. Only the exception
                    # TYPE is logged: a curl/network error's str() can embed
                    # the proxy URL (credentials included).
                    no_streak_change = True
                    if is_call:
                        _log.warning("pool call raised %s", type(exc).__name__)
                        result = {**expired_result, "outcome": "parse_failed"}
                    else:
                        _log.warning("fetch_one raised %s for asin=%s", type(exc).__name__, asin)
                        result = {"asin": asin, "outcome": "parse_failed", "fetchedAt": None, "signals": None, "content": None}
            latency = (time.monotonic() - started) * 1000
            # `netMs` is the fetcher's own network time. Stats and the
            # latency-adaptive worker sizing use it instead of wall time —
            # wall time also counts the wait for a parse worker, and sizing
            # fetch threads from CPU queueing grew them into more contention.
            # Internal: it must not reach the wire.
            net_ms = result.pop("netMs", None) if isinstance(result, dict) else None
            if isinstance(net_ms, (int, float)) and net_ms >= 0:
                latency = float(net_ms)
            outcome = result.get("outcome")
            if not no_streak_change:
                # A dead or refusing proxy (proxy_error) cools down like a
                # blocked one: sending it more work only burns deadlines.
                if outcome in ("blocked", "proxy_error"):
                    proxy.block_streak += 1
                    if proxy.block_streak >= self._streak_limit:
                        proxy.cool_until = time.monotonic() + self._cooldown
                        proxy.block_streak = 0
                else:
                    proxy.block_streak = 0
            wire = _WIRE_OUTCOME.get(outcome)
            if wire:
                result = {**result, "outcome": wire}
            # Recorded only when this worker's result is the one the caller
            # got: if the waiter already expired the task, it recorded
            # `expired` and this result is discarded — counting it too would
            # double-count one ASIN.
            if self._resolve(fut, result):
                self._record(outcome, proxy.id, latency)

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
                "threads": p.threads,
            } for p in proxies],
        }
