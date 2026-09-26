import threading
import time

from sellerhill import egress
from sellerhill.pool import ProxyPool


def ok_fetch(asin, marketplace, mode):
    return {"asin": asin, "outcome": "found", "proxy": egress.require_proxy()}


def test_each_worker_runs_bound_to_its_proxy(monkeypatch):
    monkeypatch.delenv("SCRAPER_ALLOW_DIRECT", raising=False)
    pool = ProxyPool(ok_fetch, threads_per_proxy=1)
    pool.ensure(["http://u:p@10.0.0.1:1", "http://u:p@10.0.0.2:1"], rate=50)
    results = [f.result(5) for f in [pool.submit(f"A{i:09d}", "US", "commerce", "background") for i in range(10)]]
    assert {r["proxy"] for r in results} <= {"http://u:p@10.0.0.1:1", "http://u:p@10.0.0.2:1"}
    pool.shutdown()


def test_interactive_lane_runs_before_background():
    order = []
    gate = threading.Event()

    def slow(asin, marketplace, mode):
        gate.wait(2)
        order.append(asin)
        return {"asin": asin, "outcome": "found"}

    pool = ProxyPool(slow, threads_per_proxy=1)
    pool.ensure(["http://h:1"], rate=100)
    first = pool.submit("BLOCKER000", "US", "commerce", "background")
    time.sleep(0.1)
    bg = pool.submit("BACKGROUND", "US", "commerce", "background")
    it = pool.submit("INTERACTIV", "US", "full", "interactive")
    gate.set()
    for f in (first, bg, it):
        f.result(5)
    assert order.index("INTERACTIV") < order.index("BACKGROUND")
    pool.shutdown()


def test_rate_limit_per_proxy():
    pool = ProxyPool(ok_fetch, threads_per_proxy=2)
    pool.ensure(["http://h:1"], rate=5)
    start = time.monotonic()
    for f in [pool.submit(f"A{i:09d}", "US", "commerce", "background") for i in range(10)]:
        f.result(10)
    assert time.monotonic() - start >= 1.6  # 10 requests at 5/s on one proxy
    pool.shutdown()


def test_repeated_blocks_cool_a_proxy_down_and_stats_redact():
    def blocked(asin, marketplace, mode):
        return {"asin": asin, "outcome": "blocked"}

    pool = ProxyPool(blocked, threads_per_proxy=1, block_streak_for_cooldown=3, cooldown_seconds=60)
    pool.ensure(["http://user:secret@10.9.9.9:3128"], rate=100)
    for f in [pool.submit(f"A{i:09d}", "US", "commerce", "background") for i in range(3)]:
        f.result(5)
    stats = pool.stats()
    assert stats["proxies"][0]["id"] == "10.9.9.9:3128"
    assert stats["proxies"][0]["coolingDown"] is True
    assert "secret" not in str(stats)
    pool.shutdown()


def test_task_nobody_picks_up_resolves_blocked_at_its_deadline():
    pool = ProxyPool(ok_fetch, threads_per_proxy=1, task_timeout_seconds=0.1)
    f = pool.submit("A000000001", "US", "commerce", "background")  # no proxies: nobody takes it
    start = time.monotonic()
    assert pool.wait(f)["outcome"] == "blocked"
    assert time.monotonic() - start < 1.0
    assert pool.stats()["window1h"]["blocked"] == 1
    pool.shutdown()


def test_removed_proxy_stops_taking_work():
    pool = ProxyPool(ok_fetch, threads_per_proxy=1)
    pool.ensure(["http://a:1", "http://b:1"], rate=100)
    pool.ensure(["http://b:1"], rate=100)
    results = [f.result(5) for f in [pool.submit(f"A{i:09d}", "US", "commerce", "background") for i in range(6)]]
    assert all(r["proxy"] == "http://b:1" for r in results)
    pool.shutdown()
