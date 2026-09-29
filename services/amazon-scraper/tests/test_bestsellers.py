import gzip
import os

from amazon import fetch
from sellerhill import bestsellers, egress

FX = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "amazon", "fixtures")


def raw(name):
    with gzip.open(os.path.join(FX, f"{name}.html.gz"), "rt", encoding="utf-8") as f:
        return f.read()


def _patch_pages(monkeypatch):
    # `rankings.bestsellers` reaches the network only through `fetch.page`
    # (the list) and `fetch.ajax` (the ACP hydration POSTs); patching both at
    # module level bypasses `session()` and its proxy requirement entirely.
    monkeypatch.setattr(fetch, "page", lambda *a, **k: raw("bestsellers_electronics"))
    monkeypatch.setattr(fetch, "ajax", lambda *a, **k: raw("bestsellers_electronics_acp"))


def test_found_list_is_camel_cased_and_complete(monkeypatch):
    _patch_pages(monkeypatch)
    with egress.bind("http://u:p@127.0.0.1:1"):
        r = bestsellers.fetch_bestsellers("US", "best_sellers", "electronics", 1)
    assert r["outcome"] == "found"
    assert r["fetchedAt"] and r["fetchedAt"].endswith("Z")
    assert isinstance(r["netMs"], int) and r["netMs"] >= 0
    lst = r["list"]
    assert lst["listType"] == "best_sellers" and lst["category"] == "electronics"
    assert lst["title"] == "Amazon Best Sellers"
    assert lst["link"] == "https://www.amazon.com/gp/bestsellers/electronics/"
    assert len(lst["items"]) == 50
    assert [i["rank"] for i in lst["items"]] == list(range(1, 51))
    first = lst["items"][0]
    assert first["asin"] == "B08JHCVHTY" and first["link"] == "https://www.amazon.com/dp/B08JHCVHTY"
    assert set(first) == {"rank", "asin", "title", "link", "image", "rating", "price", "priceText",
                          "rankChangePercent", "previousRank", "salesRank"}
    second = lst["items"][1]
    assert second["rating"] == {"average": 4.5, "count": 18166}
    assert second["price"] == {"amount": 19.0, "currency": "USD"}
    # no snake_case leaks anywhere in the wire shape
    assert not any("_" in key for key in first)
    assert set(lst["pagination"]) == {"page", "itemsPerPage", "totalPages", "totalCount"}
    assert lst["pagination"] == {"page": 1, "itemsPerPage": 50, "totalPages": 2, "totalCount": 100}
    cats = lst["categories"]
    assert cats and set(cats[0]) == {"name", "path", "link", "isSelected", "isRoot"}
    assert cats[0]["name"] == "Any Department" and cats[0]["isRoot"] is True
    assert next(c for c in cats if c["isSelected"])["name"] == "Electronics"
    assert all(set(r) == {"name", "link"} for r in lst["relatedLists"])
    assert "note" not in lst


def test_root_aliases_resolve_to_the_marketplace_root(monkeypatch):
    seen = []

    def page(country, path, *a, **k):
        seen.append(path)
        return raw("bestsellers_electronics")

    monkeypatch.setattr(fetch, "page", page)
    monkeypatch.setattr(fetch, "ajax", lambda *a, **k: raw("bestsellers_electronics_acp"))
    with egress.bind("http://u:p@127.0.0.1:1"):
        for alias in ("", "all", "any"):
            r = bestsellers.fetch_bestsellers("US", "new_releases", alias, 1)
            assert r["outcome"] == "found" and r["list"]["category"] is None
    assert seen == ["/gp/new-releases/"] * 3


def test_empty_list_with_upstream_note_is_found_with_no_items(monkeypatch):
    monkeypatch.setattr(fetch, "page", lambda *a, **k: "<html><body><h1>Movers</h1></body></html>")
    with egress.bind("http://u:p@127.0.0.1:1"):
        r = bestsellers.fetch_bestsellers("US", "movers_and_shakers", "electronics", 1)
    assert r["outcome"] == "found" and r["list"]["items"] == []
    assert r["list"]["pagination"]["totalCount"] == 0
    assert "note" not in r["list"]


def _raising(exc):
    def boom(*a, **k):
        raise exc
    return boom


def test_block_is_blocked(monkeypatch):
    monkeypatch.setattr(fetch, "page", _raising(fetch.AmazonBlocked("captcha")))
    assert bestsellers.fetch_bestsellers("US", "best_sellers", "electronics", 1)["outcome"] == "blocked"


def test_transport_failure_is_proxy_error_not_blocked(monkeypatch):
    monkeypatch.setattr(fetch, "page", _raising(fetch.AmazonUpstreamError("ProxyError 407")))
    assert bestsellers.fetch_bestsellers("US", "best_sellers", "electronics", 1)["outcome"] == "proxy_error"


def test_404_is_not_found(monkeypatch):
    monkeypatch.setattr(fetch, "page", _raising(fetch.AmazonNotFound("x")))
    assert bestsellers.fetch_bestsellers("US", "best_sellers", "nope-nope", 1)["outcome"] == "not_found"


def test_bad_request_is_not_found(monkeypatch):
    monkeypatch.setattr(fetch, "page", _raising(fetch.AmazonBadRequest("HTTP 400")))
    assert bestsellers.fetch_bestsellers("US", "best_sellers", "electronics", 1)["outcome"] == "not_found"


def test_unknown_category_alias_is_not_found_without_fetching(monkeypatch):
    calls = []
    monkeypatch.setattr(fetch, "page", lambda *a, **k: calls.append(a) or "")
    r = bestsellers.fetch_bestsellers("US", "best_sellers", "Electronics Deals!", 1)
    assert r["outcome"] == "not_found" and calls == []


def test_other_exception_is_parse_failed_and_logs_type_only(monkeypatch, caplog):
    monkeypatch.setattr(fetch, "page", _raising(RuntimeError("http://leak_user:leak_pass@1.2.3.4:1 exploded")))
    with caplog.at_level("WARNING"):
        r = bestsellers.fetch_bestsellers("US", "best_sellers", "electronics", 2)
    assert r["outcome"] == "parse_failed" and r["list"] is None
    assert "RuntimeError" in caplog.text
    assert "leak_user" not in caplog.text and "leak_pass" not in caplog.text


def test_no_proxy_error_propagates_for_the_pool(monkeypatch):
    import pytest
    monkeypatch.setattr(fetch, "page", _raising(egress.NoProxyError("no proxy bound")))
    with pytest.raises(egress.NoProxyError):
        bestsellers.fetch_bestsellers("US", "best_sellers", "electronics", 1)


def test_fetch_result_never_carries_the_proxy(monkeypatch):
    import json
    _patch_pages(monkeypatch)
    with egress.bind("http://sensitive_user:sensitive_pass@127.0.0.1:1"):
        r = bestsellers.fetch_bestsellers("US", "best_sellers", "electronics", 1)
    dumped = json.dumps(r)
    assert "sensitive_user" not in dumped and "sensitive_pass" not in dumped
