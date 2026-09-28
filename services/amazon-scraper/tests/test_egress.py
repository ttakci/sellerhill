import threading

import pytest

from sellerhill import egress


def test_require_proxy_raises_when_nothing_bound(monkeypatch):
    monkeypatch.delenv("SCRAPER_ALLOW_DIRECT", raising=False)
    with pytest.raises(egress.NoProxyError):
        egress.require_proxy()


def test_bound_proxy_is_returned_only_on_that_thread(monkeypatch):
    monkeypatch.delenv("SCRAPER_ALLOW_DIRECT", raising=False)
    seen = {}
    with egress.bind("http://u:p@1.2.3.4:8000"):
        assert egress.require_proxy() == "http://u:p@1.2.3.4:8000"

        def other():
            try:
                egress.require_proxy()
                seen["other"] = "leaked"
            except egress.NoProxyError:
                seen["other"] = "refused"

        t = threading.Thread(target=other)
        t.start(); t.join()
    assert seen["other"] == "refused"
    with pytest.raises(egress.NoProxyError):
        egress.require_proxy()


def test_allow_direct_only_with_exact_flag(monkeypatch):
    monkeypatch.setenv("SCRAPER_ALLOW_DIRECT", "1")
    assert egress.require_proxy() is None
    monkeypatch.setenv("SCRAPER_ALLOW_DIRECT", "true")
    with pytest.raises(egress.NoProxyError):
        egress.require_proxy()


def test_fetch_session_refuses_without_proxy(monkeypatch):
    monkeypatch.delenv("SCRAPER_ALLOW_DIRECT", raising=False)
    from amazon import fetch
    with pytest.raises(egress.NoProxyError):
        fetch.session("US")


def test_redact_hides_credentials():
    assert egress.redact("http://user:secret@10.0.0.1:3128") == "10.0.0.1:3128"
    assert egress.redact("socks5://h.example.com:1080") == "h.example.com:1080"


def test_socks5_is_bound_as_socks5h(monkeypatch):
    monkeypatch.delenv("SCRAPER_ALLOW_DIRECT", raising=False)
    with egress.bind("socks5://u:p@1.2.3.4:1080"):
        assert egress.require_proxy() == "socks5h://u:p@1.2.3.4:1080"
    with egress.bind("http://u:p@1.2.3.4:8000"):
        assert egress.require_proxy() == "http://u:p@1.2.3.4:8000"
