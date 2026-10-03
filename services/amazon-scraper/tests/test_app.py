import json

import pytest
from webtest import TestApp

from sellerhill import app as app_module


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("SCRAPER_SERVICE_SECRET", "s3cret")
    monkeypatch.delenv("SCRAPER_ALLOW_DIRECT", raising=False)
    calls = []

    def fake_fetch(asin, marketplace, mode):
        calls.append(asin)
        return {"asin": asin, "outcome": "found", "fetchedAt": "t", "signals": {"price": 1.0}, "content": None}

    application = app_module.create_app(fetch_one=fake_fetch)
    yield TestApp(application), calls
    application.config["pool"].shutdown()


def body(**over):
    b = {"marketplace": "US", "asins": ["B000000001"], "mode": "commerce", "lane": "background",
         "proxies": ["http://u:p@1.2.3.4:8000"], "perIpRequestsPerSecond": 50}
    b.update(over)
    return b


def test_secret_required(client):
    app, _ = client
    assert app.post_json("/v1/products", body(), expect_errors=True).status_int == 401


def test_found_results_in_request_order_and_deduped(client):
    app, calls = client
    res = app.post_json("/v1/products", body(asins=["B000000002", "B000000001", "B000000002"]),
                        headers={"X-Scraper-Secret": "s3cret"})
    assert [r["asin"] for r in res.json["results"]] == ["B000000002", "B000000001"]
    assert sorted(calls) == ["B000000001", "B000000002"]


def test_empty_proxies_is_no_proxy_without_fetching(client):
    app, calls = client
    res = app.post_json("/v1/products", body(proxies=[]), headers={"X-Scraper-Secret": "s3cret"})
    assert res.json["results"][0]["outcome"] == "no_proxy" and calls == []


@pytest.mark.parametrize("bad", [
    {"asins": ["short"]}, {"asins": [f"B{i:09d}" for i in range(101)]}, {"mode": "x"},
    {"lane": "x"}, {"proxies": "http://h:1"}, {"perIpRequestsPerSecond": 0}, {"marketplace": "XX"},
])
def test_invalid_body_is_400(client, bad):
    app, _ = client
    assert app.post_json("/v1/products", body(**bad), headers={"X-Scraper-Secret": "s3cret"},
                         expect_errors=True).status_int == 400


def test_stats_never_contain_credentials(client):
    app, _ = client
    app.post_json("/v1/products", body(), headers={"X-Scraper-Secret": "s3cret"})
    stats = app.get("/v1/stats", headers={"X-Scraper-Secret": "s3cret"}).json
    assert "p@" not in json.dumps(stats) and stats["window1h"]["found"] == 1


def test_health_is_open_and_reports_direct_egress(client):
    app, _ = client
    assert app.get("/health").json == {"ok": True, "directAllowed": False}
    stats = app.get("/v1/stats", headers={"X-Scraper-Secret": "s3cret"}).json
    assert stats["directAllowed"] is False


def test_malformed_proxy_entries_are_dropped_not_fatal(client):
    app, calls = client
    res = app.post_json("/v1/products", body(proxies=["h:1:u:p", "ftp://h:1", "http://h:70000", "http://u:p@1.2.3.4:8000"]),
                        headers={"X-Scraper-Secret": "s3cret"})
    assert res.status_int == 200 and res.json["results"][0]["outcome"] == "found" and calls == ["B000000001"]


def test_all_malformed_proxies_is_no_proxy_never_direct(client, monkeypatch):
    monkeypatch.setenv("SCRAPER_ALLOW_DIRECT", "1")  # even on a developer machine
    app, calls = client
    res = app.post_json("/v1/products", body(proxies=["h:1:u:p"]), headers={"X-Scraper-Secret": "s3cret"})
    assert res.json["results"][0]["outcome"] == "no_proxy" and calls == []


def test_empty_proxy_list_retires_previous_workers(client):
    app, _ = client
    app.post_json("/v1/products", body(), headers={"X-Scraper-Secret": "s3cret"})
    pool = app.app.config["pool"]
    assert len(pool._proxies) == 1
    app.post_json("/v1/products", body(proxies=[]), headers={"X-Scraper-Secret": "s3cret"})
    assert pool._proxies == {}


def _fake_probe(counts=None):
    """Deterministic stand-in for `probe_proxy`: ok unless the host contains
    "bad", so tests never make a real network call."""
    def probe(proxy):
        if counts is not None:
            counts.append(proxy)
        ok = "bad" not in proxy
        return {"id": proxy.split("@")[-1], "ok": ok, "errorKind": None if ok else "unreachable", "latencyMs": 5}
    return probe


def test_verify_secret_required(client):
    app, _ = client
    res = app.post_json("/v1/proxies/verify", {"proxies": ["http://u:p@1.2.3.4:8000"]}, expect_errors=True)
    assert res.status_int == 401


def test_verify_returns_one_result_per_entry_in_order(client, monkeypatch):
    app, _ = client
    monkeypatch.setattr(app_module, "probe_proxy", _fake_probe())
    proxies = ["http://u:p@1.2.3.4:8000", "http://u:p@5.6.7.8:9000"]
    res = app.post_json("/v1/proxies/verify", {"proxies": proxies}, headers={"X-Scraper-Secret": "s3cret"})
    assert [r["id"] for r in res.json["results"]] == ["1.2.3.4:8000", "5.6.7.8:9000"]
    assert [r["ok"] for r in res.json["results"]] == [True, True]


def test_verify_reports_a_bad_proxy_without_failing_the_others(client, monkeypatch):
    app, _ = client
    monkeypatch.setattr(app_module, "probe_proxy", _fake_probe())
    proxies = ["http://u:p@1.2.3.4:8000", "http://u:p@bad.example:9000"]
    res = app.post_json("/v1/proxies/verify", {"proxies": proxies}, headers={"X-Scraper-Secret": "s3cret"})
    results = {r["id"]: r for r in res.json["results"]}
    assert results["1.2.3.4:8000"]["ok"] is True
    assert results["bad.example:9000"]["ok"] is False and results["bad.example:9000"]["errorKind"] == "unreachable"


def test_verify_malformed_entry_is_invalid_without_probing(client, monkeypatch):
    app, _ = client
    calls = []
    monkeypatch.setattr(app_module, "probe_proxy", _fake_probe(calls))
    res = app.post_json("/v1/proxies/verify", {"proxies": ["not-a-proxy", "http://u:p@1.2.3.4:8000"]},
                        headers={"X-Scraper-Secret": "s3cret"})
    assert res.json["results"][0] == {"id": "?", "ok": False, "errorKind": "invalid", "latencyMs": None}
    assert res.json["results"][1]["ok"] is True
    assert calls == ["http://u:p@1.2.3.4:8000"]  # the malformed entry was never probed


@pytest.mark.parametrize("bad", [{"proxies": "not-a-list"}, {"proxies": []}, {"proxies": ["x"] * 51}, {}])
def test_verify_invalid_body_is_400(client, bad):
    app, _ = client
    assert app.post_json("/v1/proxies/verify", bad, headers={"X-Scraper-Secret": "s3cret"},
                         expect_errors=True).status_int == 400


def test_verify_never_logs_or_returns_credentials(client, monkeypatch, caplog):
    app, _ = client
    monkeypatch.setattr(app_module, "probe_proxy", _fake_probe())
    res = app.post_json("/v1/proxies/verify", {"proxies": ["http://sensitive_user:sensitive_pass@1.2.3.4:8000"]},
                        headers={"X-Scraper-Secret": "s3cret"})
    assert "sensitive_user" not in json.dumps(res.json) and "sensitive_pass" not in json.dumps(res.json)
    assert "sensitive_user" not in caplog.text and "sensitive_pass" not in caplog.text


# ---- /v1/best-sellers ---------------------------------------------------------------------------------------------

def bs_body(**over):
    b = {"marketplace": "US", "listType": "best_sellers", "category": "electronics", "page": 1, "lane": "browse",
         "proxies": ["http://u:p@1.2.3.4:8000"], "perIpRequestsPerSecond": 50}
    b.update(over)
    return b


def _fake_bestsellers(calls=None, outcome="found"):
    def fetch_bestsellers(country, list_type, category, page, tree_only=False):
        if calls is not None:
            calls.append((country, list_type, category, page, tree_only))
        lst = None
        if outcome == "found":
            lst = {"title": "Amazon Best Sellers", "category": category or None, "listType": list_type,
                   "link": "https://www.amazon.com/gp/bestsellers/", "items": [], "categories": [], "relatedLists": [],
                   "pagination": {"page": page, "itemsPerPage": 50, "totalPages": 1, "totalCount": 0}}
        return {"outcome": outcome, "fetchedAt": "t", "list": lst, "netMs": 12.0, "internal": "never on the wire"}
    return fetch_bestsellers


def test_best_sellers_secret_required(client):
    app, _ = client
    assert app.post_json("/v1/best-sellers", bs_body(), expect_errors=True).status_int == 401


def test_best_sellers_503_until_secret_is_set(client, monkeypatch):
    app, _ = client
    monkeypatch.delenv("SCRAPER_SERVICE_SECRET")
    res = app.post_json("/v1/best-sellers", bs_body(), headers={"X-Scraper-Secret": "s3cret"}, expect_errors=True)
    assert res.status_int == 503


@pytest.mark.parametrize("bad", [
    {"listType": "bestsellers"}, {"listType": None}, {"page": 0}, {"page": 3}, {"page": "1"}, {"page": True},
    {"category": "Electronics Deals!"}, {"category": "e" * 121}, {"category": None}, {"proxies": "http://h:1"},
    {"lane": "x"}, {"perIpRequestsPerSecond": 0}, {"perIpRequestsPerSecond": 101}, {"marketplace": "XX"},
    {"marketplace": None}, {"treeOnly": "yes"},
])
def test_best_sellers_invalid_body_is_400_with_field_named(client, monkeypatch, bad):
    app, _ = client
    calls = []
    monkeypatch.setattr(app_module, "fetch_bestsellers", _fake_bestsellers(calls))
    res = app.post_json("/v1/best-sellers", bs_body(**bad), headers={"X-Scraper-Secret": "s3cret"}, expect_errors=True)
    assert res.status_int == 400
    field = next(iter(bad))
    assert res.json["error"].startswith(field + ":") or (field == "marketplace" and "marketplace" in res.json["error"])
    assert calls == []


def test_best_sellers_non_object_body_is_400(client):
    app, _ = client
    res = app.post_json("/v1/best-sellers", ["not", "an", "object"], headers={"X-Scraper-Secret": "s3cret"},
                        expect_errors=True)
    assert res.status_int == 400 and "body" in res.json["error"]


def test_best_sellers_all_malformed_proxies_is_no_proxy_never_direct(client, monkeypatch):
    monkeypatch.setenv("SCRAPER_ALLOW_DIRECT", "1")  # even on a developer machine
    app, _ = client
    calls = []
    monkeypatch.setattr(app_module, "fetch_bestsellers", _fake_bestsellers(calls))
    res = app.post_json("/v1/best-sellers", bs_body(proxies=["h:1:u:p", "ftp://h:1"]), headers={"X-Scraper-Secret": "s3cret"})
    assert res.status_int == 200
    assert res.json == {"outcome": "no_proxy", "fetchedAt": None, "list": None} and calls == []
    assert app.get("/v1/stats", headers={"X-Scraper-Secret": "s3cret"}).json["window1h"]["noProxy"] == 1


def test_best_sellers_empty_proxies_is_no_proxy_without_fetching(client, monkeypatch):
    app, _ = client
    calls = []
    monkeypatch.setattr(app_module, "fetch_bestsellers", _fake_bestsellers(calls))
    res = app.post_json("/v1/best-sellers", bs_body(proxies=[]), headers={"X-Scraper-Secret": "s3cret"})
    assert res.json["outcome"] == "no_proxy" and calls == []


def test_best_sellers_happy_path_returns_only_the_wire_keys(client, monkeypatch):
    app, _ = client
    calls = []
    monkeypatch.setattr(app_module, "fetch_bestsellers", _fake_bestsellers(calls))
    res = app.post_json("/v1/best-sellers", bs_body(listType="new_releases", category="electronics/172541", page=2),
                        headers={"X-Scraper-Secret": "s3cret"})
    assert res.status_int == 200
    assert set(res.json) == {"outcome", "fetchedAt", "list"}
    assert res.json["outcome"] == "found" and res.json["fetchedAt"] == "t"
    assert res.json["list"]["listType"] == "new_releases" and res.json["list"]["category"] == "electronics/172541"
    assert calls == [("US", "new_releases", "electronics/172541", 2, False)]
    stats = app.get("/v1/stats", headers={"X-Scraper-Secret": "s3cret"}).json
    assert stats["window1h"]["found"] == 1 and stats["meanLatencyMs"] == 12


def test_best_sellers_root_aliases_reach_the_fetcher_as_the_root(client, monkeypatch):
    app, _ = client
    calls = []
    monkeypatch.setattr(app_module, "fetch_bestsellers", _fake_bestsellers(calls))
    for alias in ("", "all", "any", "/"):
        app.post_json("/v1/best-sellers", bs_body(category=alias), headers={"X-Scraper-Secret": "s3cret"})
    assert [c[2] for c in calls] == ["", "", "", ""]


def test_best_sellers_proxy_error_is_blocked_on_the_wire(client, monkeypatch):
    app, _ = client
    monkeypatch.setattr(app_module, "fetch_bestsellers", _fake_bestsellers(outcome="proxy_error"))
    res = app.post_json("/v1/best-sellers", bs_body(), headers={"X-Scraper-Secret": "s3cret"})
    assert res.json["outcome"] == "blocked" and res.json["list"] is None
    stats = app.get("/v1/stats", headers={"X-Scraper-Secret": "s3cret"}).json
    assert stats["window1h"]["proxyError"] == 1 and stats["window1h"]["blocked"] == 0


def test_best_sellers_uses_the_same_pool_as_products(client, monkeypatch):
    app, _ = client
    monkeypatch.setattr(app_module, "fetch_bestsellers", _fake_bestsellers())
    app.post_json("/v1/best-sellers", bs_body(), headers={"X-Scraper-Secret": "s3cret"})
    pool = app.app.config["pool"]
    assert list(pool._proxies) == ["http://u:p@1.2.3.4:8000"]
    # A later request with a different saved list retires the old worker, as for products.
    app.post_json("/v1/best-sellers", bs_body(proxies=["http://u:p@5.6.7.8:8000"]), headers={"X-Scraper-Secret": "s3cret"})
    assert list(pool._proxies) == ["http://u:p@5.6.7.8:8000"]


def test_best_sellers_never_logs_or_returns_credentials(client, monkeypatch, caplog):
    app, _ = client
    monkeypatch.setattr(app_module, "fetch_bestsellers", _fake_bestsellers())
    with caplog.at_level("DEBUG"):
        res = app.post_json("/v1/best-sellers", bs_body(proxies=["http://sensitive_user:sensitive_pass@1.2.3.4:8000", "h:1:u:p"]),
                            headers={"X-Scraper-Secret": "s3cret"})
        stats = app.get("/v1/stats", headers={"X-Scraper-Secret": "s3cret"}).json
    for text in (json.dumps(res.json), json.dumps(stats), caplog.text):
        assert "sensitive_user" not in text and "sensitive_pass" not in text


def test_best_sellers_tree_only_on_the_crawl_lane_reaches_the_fetcher(client, monkeypatch):
    app, _ = client
    calls = []
    monkeypatch.setattr(app_module, "fetch_bestsellers", _fake_bestsellers(calls))
    res = app.post_json("/v1/best-sellers", bs_body(lane="crawl", treeOnly=True), headers={"X-Scraper-Secret": "s3cret"})
    assert res.status_int == 200 and res.json["outcome"] == "found"
    assert calls == [("US", "best_sellers", "electronics", 1, True)]
