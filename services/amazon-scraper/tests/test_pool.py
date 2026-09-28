import threading
import time

from sellerhill import egress
from sellerhill.pool import ProxyPool


def ok_fetch(asin, marketplace, mode):
    return {"asin": asin, "outcome": "found", "proxy": egress.require_proxy()}


def test_each_worker_runs_bound_to_its_proxy(monkeypatch):
    monkeypatch.delenv("SCRAPER_ALLOW_DIRECT", raising=False)
    pool = ProxyPool(ok_fetch, threads_per_proxy=1, max_threads_per_proxy=1)
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

    pool = ProxyPool(slow, threads_per_proxy=1, max_threads_per_proxy=1)
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

    pool = ProxyPool(blocked, threads_per_proxy=1, max_threads_per_proxy=1, block_streak_for_cooldown=3, cooldown_seconds=60)
    pool.ensure(["http://user:secret@10.9.9.9:3128"], rate=100)
    for f in [pool.submit(f"A{i:09d}", "US", "commerce", "background") for i in range(3)]:
        f.result(5)
    stats = pool.stats()
    assert stats["proxies"][0]["id"] == "10.9.9.9:3128"
    assert stats["proxies"][0]["coolingDown"] is True
    assert "secret" not in str(stats)
    pool.shutdown()


def test_task_nobody_picks_up_resolves_blocked_at_its_deadline_and_counts_as_expired():
    pool = ProxyPool(ok_fetch, threads_per_proxy=1, max_threads_per_proxy=1, task_timeout_seconds=0.1)
    f = pool.submit("A000000001", "US", "commerce", "background")  # no proxies: nobody takes it
    start = time.monotonic()
    assert pool.wait(f)["outcome"] == "blocked"  # wire outcome: transient
    assert time.monotonic() - start < 1.0
    w = pool.stats()["window1h"]
    assert w["expired"] == 1 and w["blocked"] == 0  # never counted as Amazon blocking us
    pool.shutdown()


def test_removed_proxy_stops_taking_work():
    pool = ProxyPool(ok_fetch, threads_per_proxy=1, max_threads_per_proxy=1)
    pool.ensure(["http://a:1", "http://b:1"], rate=100)
    pool.ensure(["http://b:1"], rate=100)
    results = [f.result(5) for f in [pool.submit(f"A{i:09d}", "US", "commerce", "background") for i in range(6)]]
    assert all(r["proxy"] == "http://b:1" for r in results)
    pool.shutdown()


def test_retired_proxy_inside_wait_turn_never_executes_fetch():
    """A retired proxy can already be asleep inside wait_turn (a low rate, or
    a backlog, can make that sleep last seconds) when ensure() removes it.
    That sleep must not be allowed to finish into a fetch call."""
    calls = []

    def counting_fetch(asin, marketplace, mode):
        calls.append(asin)
        return {"asin": asin, "outcome": "found"}

    pool = ProxyPool(counting_fetch, threads_per_proxy=1, max_threads_per_proxy=1)
    pool.ensure(["http://h:1"], rate=1)  # the second request on this proxy must wait ~1s
    first = pool.submit("A000000001", "US", "commerce", "background")
    first.result(5)  # clears the rate-limit slot; the proxy's next request now sleeps ~1s
    pool.submit("A000000002", "US", "commerce", "background")
    time.sleep(0.2)  # the lone worker has taken the second task and is asleep inside wait_turn
    pool.ensure([], rate=1)  # retire the proxy while that sleep is still in progress
    time.sleep(1.0)  # longer than the remaining sleep — if unfixed, the fetch would have run by now
    assert calls == ["A000000001"]
    pool.shutdown()


def test_exception_from_fetch_one_is_parse_failed_and_does_not_cool_the_proxy():
    """A crash inside our own code (e.g. a bad marketplace, a parser bug) is
    not evidence Amazon is blocking this proxy — it must never accrue
    block_streak or trigger a cooldown."""
    def boom(asin, marketplace, mode):
        raise ValueError("bad marketplace")

    pool = ProxyPool(boom, threads_per_proxy=1, max_threads_per_proxy=1, block_streak_for_cooldown=3, cooldown_seconds=60)
    pool.ensure(["http://h:1"], rate=100)
    results = [f.result(5) for f in [pool.submit(f"A{i:09d}", "US", "commerce", "background") for i in range(3)]]
    assert all(r["outcome"] == "parse_failed" for r in results)
    assert pool.stats()["proxies"][0]["coolingDown"] is False
    pool.shutdown()


def test_no_proxy_error_from_fetch_one_maps_to_no_proxy_outcome():
    def boom(asin, marketplace, mode):
        raise egress.NoProxyError("no proxy bound")

    pool = ProxyPool(boom, threads_per_proxy=1, max_threads_per_proxy=1)
    pool.ensure(["http://h:1"], rate=100)
    f = pool.submit("A000000001", "US", "commerce", "background")
    assert f.result(5)["outcome"] == "no_proxy"
    pool.shutdown()


def test_in_flight_task_expired_by_the_waiter_is_counted_once():
    release = threading.Event()

    def slow(asin, marketplace, mode):
        release.wait(2)
        return {"asin": asin, "outcome": "found"}

    pool = ProxyPool(slow, threads_per_proxy=1, max_threads_per_proxy=1, task_timeout_seconds=0.1)
    pool.ensure(["http://h:1"], rate=100)
    f = pool.submit("A000000001", "US", "commerce", "background")
    assert pool.wait(f)["outcome"] == "blocked"
    release.set()
    time.sleep(0.3)  # the worker finishes the page after the waiter gave up
    w = pool.stats()["window1h"]
    assert (w["expired"], w["found"], w["blocked"]) == (1, 0, 0)
    pool.shutdown()


def test_proxy_error_is_its_own_stat_and_blocked_on_the_wire():
    def dead(asin, marketplace, mode):
        return {"asin": asin, "outcome": "proxy_error"}

    pool = ProxyPool(dead, threads_per_proxy=1, max_threads_per_proxy=1, block_streak_for_cooldown=3, cooldown_seconds=60)
    pool.ensure(["http://h:1"], rate=100)
    results = [f.result(5) for f in [pool.submit(f"A{i:09d}", "US", "commerce", "background") for i in range(3)]]
    assert all(r["outcome"] == "blocked" for r in results)
    stats = pool.stats()
    assert stats["window1h"]["proxyError"] == 3 and stats["window1h"]["blocked"] == 0
    assert stats["proxies"][0]["coolingDown"] is True  # a dead proxy stops taking work
    pool.shutdown()


def test_threads_follow_the_rate():
    from sellerhill.pool import threads_for_rate
    assert threads_for_rate(0.5, 2) == 2
    assert threads_for_rate(1, 2) == 4
    assert threads_for_rate(3, 2) == 12
    assert threads_for_rate(100, 2) == 40


def test_threads_follow_measured_latency_once_known():
    # A 20 s round trip at 1 req/s needs 20 busy workers just to reach the
    # budget; the fixed ~2 s assumption gave 4 and capped the proxy at 0.2/s.
    from sellerhill.pool import threads_for_rate
    assert threads_for_rate(1, 2, latency_s=20) == 30      # 1 * 20 * 1.5
    assert threads_for_rate(1, 2, latency_s=10) == 15
    assert threads_for_rate(1, 2, latency_s=1.5) == 4      # never below the fixed headroom
    assert threads_for_rate(2, 2, latency_s=20) == 40      # still capped
    assert threads_for_rate(1, 2, latency_s=None) == 4
    assert threads_for_rate(1, 2, latency_s=0) == 4


def test_pool_grows_threads_from_its_own_latency():
    import time
    from sellerhill.pool import ProxyPool
    pool = ProxyPool(lambda *a: {"outcome": "found"}, threads_per_proxy=1)
    now = time.monotonic()
    for _ in range(5):
        pool._events.append((now, "found", "p", 20_000))   # 20 s pages measured
    pool.ensure(["http://p:1"], 1)
    assert pool.stats()["proxies"][0]["threads"] == 30
    pool.shutdown()
    pool = ProxyPool(ok_fetch, threads_per_proxy=2)
    pool.ensure(["http://h:1"], rate=1)
    proxy = pool._proxies["http://h:1"]
    assert proxy.threads == 4
    pool.ensure(["http://h:1"], rate=3)  # a raised rate grows the worker set
    assert proxy.threads == 12
    pool.shutdown()
