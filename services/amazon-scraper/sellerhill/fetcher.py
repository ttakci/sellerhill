"""One ASIN → one result dict. Classifies every failure into an outcome; the
pool maps the stat-only `proxy_error` to the wire's `blocked` before the
NestJS normalizer sees it. Never raises except NoProxyError."""
from datetime import datetime, timezone

from amazon import fetch, sites

from sellerhill.content import build_content
from sellerhill.signals import extract_commerce_signals


def _now():
    return datetime.now(timezone.utc).isoformat()


_SOFT_NOT_FOUND_MARKERS = (
    "couldn't find that page",
    "couldn&#39;t find that page",
    "couldn’t find that page",
    "<title>page not found</title>",
)


def _is_soft_not_found(html):
    """Amazon's HTTP-200 'we couldn't find that page' page for a removed ASIN."""
    lowered = html.lower()
    return any(marker in lowered for marker in _SOFT_NOT_FOUND_MARKERS)


def fetch_one(asin, marketplace, mode):
    site = sites.site(marketplace)
    base = {"asin": asin, "fetchedAt": _now(), "signals": None, "content": None}
    try:
        html = fetch.page(site["country"], f"/dp/{asin}", {"th": "1", "psc": "1"},
                          referer=f"{site['base']}/s?k={asin}", label=f"product {asin}")
    except fetch.AmazonNotFound:
        return {**base, "outcome": "not_found"}
    except fetch.AmazonBlocked:  # captcha / dogs page: Amazon refusing us
        return {**base, "outcome": "blocked"}
    except fetch.AmazonUpstreamError:
        # Transport failure through the proxy (auth 407, dead exit, timeouts)
        # or repeated 5xx — not Amazon blocking this IP. The pool reports it
        # as `proxy_error` in stats and as `blocked` (transient) on the wire.
        return {**base, "outcome": "proxy_error"}
    if 'id="productTitle"' not in html:
        # Amazon answers a removed ASIN with HTTP 200 and its "Sorry, we
        # couldn't find that page" page, not a 404. Reported as parse_failed
        # it read as OUR parser failing (retried, counted in the parse-failure
        # rate); it is the product being gone, the same answer as a real 404.
        if _is_soft_not_found(html):
            return {**base, "outcome": "not_found"}
        return {**base, "outcome": "parse_failed"}
    result = {**base, "outcome": "found", "signals": extract_commerce_signals(html, site)}
    if mode == "full":
        result["content"] = build_content(html, site)
    return result
