import hmac
import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor

import bottle

from amazon import sites
from sellerhill import egress
from sellerhill.fetcher import fetch_one as default_fetch_one
from sellerhill.pool import ProxyPool
from sellerhill.verify import probe_proxy

_log = logging.getLogger(__name__)

_ASIN = re.compile(r"^[A-Z0-9]{10}$")
# Same rule as `isValidProxyUrl` in packages/shared (utils/proxy-url.ts).
_PROXY = re.compile(r"^(http|https|socks5|socks5h)://[^\s]+:(\d{1,5})$")
_MODES = {"full", "commerce"}
_LANES = {"interactive", "background"}
_MAX_VERIFY_PROXIES = 50


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
    if not isinstance(body.get("proxies"), list):
        return "proxies: list of http(s)/socks5(h) URLs with port"
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


def valid_proxy(value):
    if not isinstance(value, str):
        return False
    m = _PROXY.match(value)
    return bool(m) and int(m.group(2)) <= 65535


def usable_proxies(values):
    """Valid entries in order, plus how many were dropped. One malformed line
    must not stop every fetch; the dropped COUNT is logged, never a value (a
    proxy URL carries credentials)."""
    kept = [p for p in values if valid_proxy(p)]
    dropped = len(values) - len(kept)
    if dropped:
        _log.warning("ignoring %d malformed proxy entr%s", dropped, "y" if dropped == 1 else "ies")
    return kept


def create_app(fetch_one=default_fetch_one, threads_per_proxy=None):
    threads = threads_per_proxy or int(os.environ.get("SCRAPER_THREADS_PER_PROXY", "2"))
    pool = ProxyPool(fetch_one, threads_per_proxy=threads)
    app = bottle.Bottle()
    app.config["pool"] = pool
    if egress.allow_direct():
        _log.warning("!!! SCRAPER_ALLOW_DIRECT=1 — this scraper may fetch Amazon WITHOUT a proxy, "
                     "from this host's own IP. Developer machines only; never on a server. !!!")

    @app.get("/health")
    def health():
        return _json(200, {"ok": True, "directAllowed": egress.allow_direct()})

    @app.get("/v1/stats")
    def stats():
        if not os.environ.get("SCRAPER_SERVICE_SECRET"):
            return _json(503, {"error": "SCRAPER_SERVICE_SECRET not set"})
        if not _authorized():
            return _json(401, {"error": "unauthorized"})
        return _json(200, {**pool.stats(), "directAllowed": egress.allow_direct()})

    @app.post("/v1/proxies/verify")
    def verify_proxies():
        if not os.environ.get("SCRAPER_SERVICE_SECRET"):
            return _json(503, {"error": "SCRAPER_SERVICE_SECRET not set"})
        if not _authorized():
            return _json(401, {"error": "unauthorized"})
        try:
            body = bottle.request.json
        except Exception:
            body = None
        if not isinstance(body, dict) or not isinstance(body.get("proxies"), list):
            return _json(400, {"error": "proxies: list of http(s)/socks5(h) URLs with port"})
        requested = body["proxies"]
        if not 1 <= len(requested) <= _MAX_VERIFY_PROXIES:
            return _json(400, {"error": f"proxies: 1..{_MAX_VERIFY_PROXIES}"})
        # An invalid entry never reaches probe_proxy (no session, no request);
        # it is reported the same shape as a probed one so the caller can
        # render one uniform list.
        results = [None] * len(requested)
        to_probe = [(i, p) for i, p in enumerate(requested) if valid_proxy(p)]
        for i, p in enumerate(requested):
            if not valid_proxy(p):
                # No credentials in the id here either: a malformed entry may
                # still parse as scheme://user:pass@host:port with a bad port.
                results[i] = {"id": egress.redact(p) if isinstance(p, str) else "?",
                              "ok": False, "errorKind": "invalid", "latencyMs": None}
        if to_probe:
            with ThreadPoolExecutor(max_workers=len(to_probe)) as pool_exec:
                probed = dict(zip((i for i, _ in to_probe), pool_exec.map(lambda ip: probe_proxy(ip[1]), to_probe)))
            for i, result in probed.items():
                results[i] = result
        return _json(200, {"results": results})

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
        rate = float(body["perIpRequestsPerSecond"])
        requested = body["proxies"]
        proxies = usable_proxies(requested)
        if not proxies:
            # Direct egress only for a list that was EMPTY on a developer
            # machine — never as the fallback for a list of malformed entries.
            if requested or not egress.allow_direct():
                pool.ensure([], rate)  # retire workers of proxies no longer configured
                pool.record_no_proxy(len(asins))
                return _json(200, {"results": [{"asin": a, "outcome": "no_proxy", "fetchedAt": None,
                                                 "signals": None, "content": None} for a in asins]})
            proxies = [None]  # developer machine only
        pool.ensure(proxies, rate)
        futures = [pool.submit(a, body["marketplace"], body["mode"], body["lane"]) for a in asins]
        results = [pool.wait(f) for f in futures]  # each resolves by its own deadline
        return _json(200, {"results": results})

    return app
