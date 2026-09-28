import gzip
import os
from concurrent.futures import Future
from concurrent.futures.process import BrokenProcessPool

from amazon import sites
from sellerhill import parsing

FX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")


def page(name):
    with gzip.open(os.path.join(FX, f"{name}.html.gz"), "rt", encoding="utf-8") as f:
        return f.read()


def test_inline_when_no_worker_processes():
    site = sites.site("US")
    signals, content = parsing.run_parse(page("plain_in_stock"), site, "full")
    assert signals["isInStock"] is True
    assert content["title"]


def test_commerce_mode_parses_no_content():
    signals, content = parsing.run_parse(page("plain_in_stock"), sites.site("US"), "commerce")
    assert signals is not None and content is None


def test_worker_process_result_equals_inline(monkeypatch):
    # The whole point of the pool is that parsing leaves the fetch threads'
    # GIL. That only helps if what comes back is EXACTLY what the inline parse
    # returns — same signals, same content — so this runs a real spawned worker.
    site = sites.site("US")
    html = page("plain_in_stock")
    inline = parsing.run_parse(html, site, "full")
    monkeypatch.setenv("SCRAPER_PARSE_PROCESSES", "1")
    try:
        pooled = parsing.run_parse(html, site, "full")
    finally:
        parsing.shutdown()
    assert pooled == inline


def test_dead_worker_pool_is_rebuilt_and_the_page_retried(monkeypatch):
    # A worker killed by the OOM-killer breaks the whole executor: every later
    # submit raises BrokenProcessPool for ever. One page must not take the
    # service's parsing down with it, so the pool is rebuilt and the page
    # retried once.
    site = sites.site("US")
    html = page("plain_in_stock")
    monkeypatch.setenv("SCRAPER_PARSE_PROCESSES", "1")
    calls = {"n": 0}

    class FlakyExecutor:
        def submit(self, fn, *args):
            calls["n"] += 1
            fut = Future()
            if calls["n"] == 1:
                fut.set_exception(BrokenProcessPool("worker died"))
            else:
                fut.set_result(fn(*args))
            return fut

    resets = {"n": 0}
    monkeypatch.setattr(parsing, "_get_executor", lambda n: FlakyExecutor())
    monkeypatch.setattr(parsing, "_reset_executor", lambda: resets.__setitem__("n", resets["n"] + 1))
    signals, _ = parsing.run_parse(html, site, "commerce")
    assert signals["isInStock"] is True
    assert calls["n"] == 2 and resets["n"] == 1


def test_a_pool_that_keeps_breaking_raises(monkeypatch):
    monkeypatch.setenv("SCRAPER_PARSE_PROCESSES", "1")

    class DeadExecutor:
        def submit(self, fn, *args):
            fut = Future()
            fut.set_exception(BrokenProcessPool("worker died"))
            return fut

    monkeypatch.setattr(parsing, "_get_executor", lambda n: DeadExecutor())
    monkeypatch.setattr(parsing, "_reset_executor", lambda: None)
    try:
        parsing.run_parse(page("plain_in_stock"), sites.site("US"), "commerce")
    except BrokenProcessPool:
        return
    raise AssertionError("a permanently broken pool must surface, not hang or return None")


def test_worker_count_setting(monkeypatch):
    monkeypatch.setenv("SCRAPER_PARSE_PROCESSES", "0")
    assert parsing.parse_processes() == 0
    monkeypatch.setenv("SCRAPER_PARSE_PROCESSES", "3")
    assert parsing.parse_processes() == 3
    monkeypatch.setenv("SCRAPER_PARSE_PROCESSES", "junk")
    assert parsing.parse_processes() >= 1          # a misread value must not switch parsing off
    monkeypatch.setenv("SCRAPER_PARSE_PROCESSES", "-2")
    assert parsing.parse_processes() == 0
    monkeypatch.setenv("SCRAPER_PARSE_PROCESSES", "999")
    assert parsing.parse_processes() <= 8
