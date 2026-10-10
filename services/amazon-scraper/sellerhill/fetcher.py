"""One ASIN → one result dict. Classifies every failure into an outcome; the
pool maps the stat-only `proxy_error` to the wire's `blocked` before the
NestJS normalizer sees it. Never raises except NoProxyError."""
import re
import time
from datetime import datetime, timezone

from amazon import fetch, sites

from sellerhill import parsing


def _now():
    return datetime.now(timezone.utc).isoformat()


_SOFT_NOT_FOUND_MARKERS = (
    "couldn't find that page",
    "couldn&#39;t find that page",
    "couldn’t find that page",
    "<title>page not found</title>",
)


# The product page's own ASIN: the add-to-cart form's hidden `ASIN` input, then
# the twister's `currentAsin`. Never the canonical link, which on live pages
# names a different (parent / sibling) ASIN for an ordinary buyable product.
_PAGE_ASIN_PATTERNS = (
    re.compile(r'name="ASIN"\s+value="([A-Z0-9]{10})"'),
    re.compile(r'value="([A-Z0-9]{10})"\s+name="ASIN"'),
    re.compile(r'"currentAsin"\s*:\s*"([A-Z0-9]{10})"'),
)


def page_asin(html):
    """The ASIN the page is actually about, or None when it does not say."""
    for pattern in _PAGE_ASIN_PATTERNS:
        match = pattern.search(html)
        if match:
            return match.group(1)
    return None


def _elapsed_ms(started):
    return round((time.monotonic() - started) * 1000)


def _is_soft_not_found(html):
    """Amazon's HTTP-200 'we couldn't find that page' page for a removed ASIN."""
    lowered = html.lower()
    return any(marker in lowered for marker in _SOFT_NOT_FOUND_MARKERS)


def fetch_one(asin, marketplace, mode):
    site = sites.site(marketplace)
    base = {"asin": asin, "fetchedAt": _now(), "signals": None, "content": None}
    started = time.monotonic()
    try:
        html = fetch.page(site["country"], f"/dp/{asin}", {"th": "1", "psc": "1"},
                          referer=f"{site['base']}/s?k={asin}", label=f"product {asin}")
    except fetch.AmazonNotFound:
        return {**base, "outcome": "not_found", "netMs": _elapsed_ms(started)}
    except fetch.AmazonBlocked:  # captcha / dogs page: Amazon refusing us
        return {**base, "outcome": "blocked"}
    except fetch.AmazonUpstreamError:
        # Transport failure through the proxy (auth 407, dead exit, timeouts)
        # or repeated 5xx — not Amazon blocking this IP. The pool reports it
        # as `proxy_error` in stats and as `blocked` (transient) on the wire.
        return {**base, "outcome": "proxy_error"}
    # Network time only, measured before parsing: the parse below runs on a
    # worker process and can queue behind other pages, and folding that wait
    # into "page round trip" made a CPU-bound service look like a slow proxy —
    # which grew fetch workers into more contention.
    base["netMs"] = _elapsed_ms(started)
    if 'id="productTitle"' not in html:
        # Amazon answers a removed ASIN with HTTP 200 and its "Sorry, we
        # couldn't find that page" page, not a 404. Reported as parse_failed
        # it read as OUR parser failing (retried, counted in the parse-failure
        # rate); it is the product being gone, the same answer as a real 404.
        if _is_soft_not_found(html):
            return {**base, "outcome": "not_found"}
        return {**base, "outcome": "parse_failed"}
    signals, content = parsing.run_parse(html, site, mode)
    # Amazon answers a merged/retired ASIN with a redirect to another product,
    # and a variation parent with one of its children. The outcome stays
    # `found` (the page was read); the caller compares `pageAsin` with the
    # requested ASIN and decides — a create refuses a different product.
    if isinstance(signals, dict):
        signals = {**signals, "pageAsin": page_asin(html)}
    return {**base, "outcome": "found", "signals": signals, "content": content}
