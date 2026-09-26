import hmac
import os
import re

import bottle

from amazon import sites
from sellerhill import egress
from sellerhill.fetcher import fetch_one as default_fetch_one
from sellerhill.pool import ProxyPool

_ASIN = re.compile(r"^[A-Z0-9]{10}$")
_PROXY = re.compile(r"^(http|https|socks5)://[^\s]+:\d+$")
_MODES = {"full", "commerce"}
_LANES = {"interactive", "background"}


def _json(status, data):
    bottle.response.status = status
    bottle.response.content_type = "application/json"
    return bottle.json_dumps(data)


def _authorized():
    secret = os.environ.get("SCRAPER_SERVICE_SECRET", "")
    given = bottle.request.headers.get("X-Scraper-Secret", "")
    return bool(secret) and hmac.compare_digest(secret, given)


def _validate(body):
    if not isinstance(body, dict):
        return "body must be an object"
    asins = body.get("asins")
    if not isinstance(asins, list) or not 1 <= len(asins) <= 100 or not all(isinstance(a, str) and _ASIN.match(a) for a in asins):
        return "asins: 1..100 ASINs"
    if body.get("mode") not in _MODES or body.get("lane") not in _LANES:
        return "mode/lane invalid"
    proxies = body.get("proxies")
    if not isinstance(proxies, list) or not all(isinstance(p, str) and _PROXY.match(p) for p in proxies):
        return "proxies: list of http(s)/socks5 URLs with port"
    rate = body.get("perIpRequestsPerSecond")
    if not isinstance(rate, (int, float)) or not 0.1 <= rate <= 100:
        return "perIpRequestsPerSecond: 0.1..100"
    marketplace = body.get("marketplace")
    if not isinstance(marketplace, str):
        return "marketplace required"
    try:
        sites.site(marketplace)
    except ValueError:
        return "marketplace: unknown"
    return None


def create_app(fetch_one=default_fetch_one, threads_per_proxy=None):
    threads = threads_per_proxy or int(os.environ.get("SCRAPER_THREADS_PER_PROXY", "2"))
    pool = ProxyPool(fetch_one, threads_per_proxy=threads)
    app = bottle.Bottle()
    app.config["pool"] = pool

    @app.get("/health")
    def health():
        return _json(200, {"ok": True})

    @app.get("/v1/stats")
    def stats():
        if not os.environ.get("SCRAPER_SERVICE_SECRET"):
            return _json(503, {"error": "SCRAPER_SERVICE_SECRET not set"})
        if not _authorized():
            return _json(401, {"error": "unauthorized"})
        return _json(200, pool.stats())

    @app.post("/v1/products")
    def products():
        if not os.environ.get("SCRAPER_SERVICE_SECRET"):
            return _json(503, {"error": "SCRAPER_SERVICE_SECRET not set"})
        if not _authorized():
            return _json(401, {"error": "unauthorized"})
        try:
            body = bottle.request.json
        except Exception:
            body = None
        error = _validate(body)
        if error:
            return _json(400, {"error": error})
        asins = list(dict.fromkeys(body["asins"]))
        proxies = body["proxies"]
        if not proxies:
            if not egress.allow_direct():
                pool.record_no_proxy(len(asins))
                return _json(200, {"results": [{"asin": a, "outcome": "no_proxy", "fetchedAt": None,
                                                 "signals": None, "content": None} for a in asins]})
            proxies = [None]  # developer machine only
        pool.ensure(proxies, float(body["perIpRequestsPerSecond"]))
        futures = [pool.submit(a, body["marketplace"], body["mode"], body["lane"]) for a in asins]
        results = [pool.wait(f) for f in futures]  # each resolves by its own deadline
        return _json(200, {"results": results})

    return app
