"""CPU-bound page parsing, moved off the fetch threads.

An Amazon product page is 2-3.5 MB of HTML. Turning it into signals + content
costs on the order of 1.5 s of CPU (fixture measurement; the production VPS
shares 4 vCPUs with the API and Postgres, so more there) — almost all of it
BeautifulSoup/soupsieve CSS matching. The fetch layer is threads in ONE
process, so that CPU ran under a single GIL: a 22-page batch queued ~30 s of
serial parsing while the network sat idle, the pool's wall-time "latency"
read ~20 s/page, and the latency-adaptive worker sizing grew threads into
MORE contention (production observed: 4 → 33 workers, prefetch 27 s → 36 s,
zero blocks).

`run_parse` runs the same pure functions in a small pool of worker PROCESSES.
The fetch thread submits the page and blocks on the result (releasing the
GIL), so N pages parse on N cores. Behaviour is identical to parsing inline —
`SCRAPER_PARSE_PROCESSES=0` does exactly that, and the tests assert the two
give identical output.

Workers are spawned, never forked: the parent is multi-threaded, and forking
a multi-threaded process is how a child inherits a lock held by a thread
that does not exist there.
"""
import multiprocessing
import os
import threading
from concurrent.futures import ProcessPoolExecutor
from concurrent.futures.process import BrokenProcessPool

_MAX_PROCESSES = 8
# Bounds the slow leak of long-lived bs4/lxml workers: each worker is
# replaced after this many pages (needs Python 3.11+, the image runs 3.12).
_PAGES_PER_WORKER = 300

_executor = None
_executor_processes = 0
_lock = threading.Lock()


def _available_cpus():
    try:
        return len(os.sched_getaffinity(0))     # honours container CPU pinning (Linux)
    except AttributeError:
        return os.cpu_count() or 1


def parse_processes():
    """Worker processes to parse with; 0 parses in the calling thread.

    Unset defaults to 3 (fewer on a smaller machine): one core sustains under
    one page per second of parsing, and each worker peaks near 80 MB. A value
    that cannot be read is NOT read as 0 — that would silently put every page
    back under one GIL.
    """
    raw = os.environ.get("SCRAPER_PARSE_PROCESSES")
    if raw is None or raw.strip() == "":
        return max(1, min(3, _available_cpus()))
    try:
        value = int(raw)
    except ValueError:
        return max(1, min(3, _available_cpus()))
    return max(0, min(_MAX_PROCESSES, value))


def parse_page(html, site, mode):
    """(signals, content) for one page. Module-level and pure so a spawned
    worker can import and run it; `content` is None in commerce mode."""
    from sellerhill.content import build_content
    from sellerhill.signals import extract_commerce_signals

    signals = extract_commerce_signals(html, site)
    content = build_content(html, site) if mode == "full" else None
    return signals, content


def _warm_imports():
    """Worker initializer: pay the bs4/lxml import once at spawn, not on the
    first page a listing job is waiting for."""
    import sellerhill.content  # noqa: F401
    import sellerhill.signals  # noqa: F401


def _get_executor(processes):
    global _executor, _executor_processes
    with _lock:
        if _executor is None or _executor_processes != processes:
            if _executor is not None:
                _executor.shutdown(wait=False, cancel_futures=True)
            _executor = ProcessPoolExecutor(
                max_workers=processes,
                mp_context=multiprocessing.get_context("spawn"),
                initializer=_warm_imports,
                max_tasks_per_child=_PAGES_PER_WORKER,
            )
            _executor_processes = processes
        return _executor


def _reset_executor():
    global _executor
    with _lock:
        if _executor is not None:
            _executor.shutdown(wait=False, cancel_futures=True)
        _executor = None


def shutdown():
    _reset_executor()


def run_parse(html, site, mode):
    processes = parse_processes()
    if processes <= 0:
        return parse_page(html, site, mode)
    # A worker killed from outside (the OOM-killer) breaks the whole executor:
    # every later submit raises BrokenProcessPool. Rebuild it and retry the
    # page once, so one lost worker costs one retry rather than all parsing.
    for attempt in (1, 2):
        try:
            return _get_executor(processes).submit(parse_page, html, site, mode).result()
        except BrokenProcessPool:
            _reset_executor()
            if attempt == 2:
                raise
