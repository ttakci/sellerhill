import gzip
import os

from amazon import fetch
from sellerhill import fetcher

FX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")


def page(name):
    with gzip.open(os.path.join(FX, f"{name}.html.gz"), "rt", encoding="utf-8") as f:
        return f.read()


def test_found_commerce_has_signals_and_no_content(monkeypatch):
    monkeypatch.setattr(fetch, "page", lambda *a, **k: page("plain_in_stock"))
    r = fetcher.fetch_one("B000000001", "US", "commerce")
    assert r["outcome"] == "found" and r["signals"]["isInStock"] is True and r["content"] is None


def test_found_full_has_content_with_our_gallery(monkeypatch):
    monkeypatch.setattr(fetch, "page", lambda *a, **k: page("empty_color_images"))
    r = fetcher.fetch_one("B01KIFISX2", "US", "full")
    assert r["outcome"] == "found"
    assert len(r["content"]["images"]) > 0
    assert r["content"]["title"]
    assert isinstance(r["content"]["specs"], dict)


def test_found_reports_its_network_time_separately_from_parsing(monkeypatch):
    def slow_page(*a, **k):
        import time
        time.sleep(0.05)
        return page("plain_in_stock")
    monkeypatch.setattr(fetch, "page", slow_page)
    r = fetcher.fetch_one("B000000001", "US", "commerce")
    assert r["outcome"] == "found" and 40 <= r["netMs"] < 5000


def test_404_is_not_found(monkeypatch):
    def boom(*a, **k):
        raise fetch.AmazonNotFound("x")
    monkeypatch.setattr(fetch, "page", boom)
    assert fetcher.fetch_one("B000000001", "US", "commerce")["outcome"] == "not_found"


def test_block_is_blocked(monkeypatch):
    def boom(*a, **k):
        raise fetch.AmazonBlocked("captcha")
    monkeypatch.setattr(fetch, "page", boom)
    assert fetcher.fetch_one("B000000001", "US", "commerce")["outcome"] == "blocked"


def test_transport_failure_is_proxy_error_not_blocked(monkeypatch):
    def boom(*a, **k):
        raise fetch.AmazonUpstreamError("ProxyError 407")
    monkeypatch.setattr(fetch, "page", boom)
    assert fetcher.fetch_one("B000000001", "US", "commerce")["outcome"] == "proxy_error"


def test_soft_404_page_is_not_found(monkeypatch):
    # HTTP 200 with Amazon's "couldn't find that page" body: the product is
    # gone, exactly as a real 404 — not our parser failing.
    html = ('<html><head><title>Page Not Found</title></head><body>'
            '<img alt="Sorry! We couldn\'t find that page. Try searching or go to Amazon\'s home page.">'
            '</body></html>')
    monkeypatch.setattr(fetch, "page", lambda *a, **k: html)
    assert fetcher.fetch_one("B003T6LHWM", "US", "commerce")["outcome"] == "not_found"


def test_page_without_title_is_parse_failed(monkeypatch):
    monkeypatch.setattr(fetch, "page", lambda *a, **k: "<html><body>odd</body></html>")
    assert fetcher.fetch_one("B000000001", "US", "commerce")["outcome"] == "parse_failed"
