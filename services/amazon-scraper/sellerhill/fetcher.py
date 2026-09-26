"""One ASIN → one result dict. Classifies every failure into an outcome the
NestJS normalizer understands; never raises except NoProxyError."""
from datetime import datetime, timezone

from amazon import fetch, sites

from sellerhill.content import build_content
from sellerhill.signals import extract_commerce_signals


def _now():
    return datetime.now(timezone.utc).isoformat()


def fetch_one(asin, marketplace, mode):
    site = sites.site(marketplace)
    base = {"asin": asin, "fetchedAt": _now(), "signals": None, "content": None}
    try:
        html = fetch.page(site["country"], f"/dp/{asin}", {"th": "1", "psc": "1"},
                          referer=f"{site['base']}/s?k={asin}", label=f"product {asin}")
    except fetch.AmazonNotFound:
        return {**base, "outcome": "not_found"}
    except fetch.AmazonUpstreamError:  # includes AmazonBlocked
        return {**base, "outcome": "blocked"}
    if 'id="productTitle"' not in html:
        return {**base, "outcome": "parse_failed"}
    result = {**base, "outcome": "found", "signals": extract_commerce_signals(html, site)}
    if mode == "full":
        result["content"] = build_content(html, site)
    return result
