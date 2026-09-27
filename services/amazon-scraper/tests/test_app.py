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
