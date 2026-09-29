"""One Amazon Best Sellers list page → one result dict, through the proxy the
pool bound to this thread. The sibling of `fetcher.fetch_one`, for the
`POST /v1/best-sellers` route.

Upstream's `amazon/rankings.bestsellers` already does the work (page GET,
ACP hydration to 50 items, dedupe, sort); this module only classifies its
failures into the pool's outcome vocabulary and renames the result to the
camelCase wire contract in `packages/shared` (`best-sellers.types.ts`),
so the Python service, the API and the web app share one set of field
names. Never raises except NoProxyError (which the pool maps to
`no_proxy`)."""
import logging
import time
from datetime import datetime, timezone

from amazon import fetch, rankings, refs

from sellerhill import egress

_log = logging.getLogger(__name__)


def _now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _elapsed_ms(started):
    return round((time.monotonic() - started) * 1000)


def _item(raw):
    rating = raw.get("rating")
    return {
        "rank": raw.get("rank"),
        "asin": raw.get("asin"),
        "title": raw.get("title"),
        "link": raw.get("link"),
        "image": raw.get("image"),
        "rating": ({"average": rating.get("average"), "count": rating.get("count")}
                   if isinstance(rating, dict) else None),
        "price": raw.get("price"),
        "priceText": raw.get("price_text"),
        "rankChangePercent": raw.get("rank_change_percent"),
        "previousRank": raw.get("previous_rank"),
        "salesRank": raw.get("sales_rank"),
    }


def _category(raw):
    return {"name": raw.get("name"), "path": raw.get("path"), "link": raw.get("link"),
            "isSelected": bool(raw.get("is_selected")), "isRoot": bool(raw.get("is_root"))}


def _related(raw):
    return {"name": raw.get("name"), "link": raw.get("link")}


def to_wire(raw):
    """Upstream's snake_case `bestsellers()` result → the camelCase
    `BestSellersListDto`. An upstream `note` (empty list) is dropped: an
    empty `items` is the client's empty state, not a failure."""
    pagination = raw.get("pagination") or {}
    return {
        "title": raw.get("title"),
        "category": raw.get("category"),
        "listType": raw.get("list_type"),
        "link": raw.get("link"),
        "items": [_item(i) for i in raw.get("items") or [] if i.get("asin")],
        "categories": [_category(c) for c in raw.get("categories") or [] if c.get("name")],
        "relatedLists": [_related(r) for r in raw.get("related_lists") or [] if r.get("name")],
        "pagination": {
            "page": pagination.get("page"),
            "itemsPerPage": pagination.get("items_per_page"),
            "totalPages": pagination.get("total_pages"),
            "totalCount": pagination.get("total_count"),
        },
    }


def fetch_bestsellers(country, list_type, category, page):
    """`{outcome, fetchedAt, list, netMs?}` for one list page. `category` is
    already validated by the route (`refs.resolve_bestseller_category`); it is
    re-resolved here so a direct caller gets the same grammar."""
    base = {"outcome": None, "fetchedAt": _now(), "list": None}
    started = time.monotonic()
    try:
        resolved = refs.resolve_bestseller_category(category)
        raw = rankings.bestsellers(resolved, list_type, country=country, page=page)
    except fetch.AmazonBlocked:  # subclass of AmazonUpstreamError: must come first
        return {**base, "outcome": "blocked"}
    except fetch.AmazonUpstreamError:
        # Transport failure through the proxy (auth 407, dead exit, timeouts)
        # or repeated 5xx — not Amazon blocking this IP. The pool reports it
        # as `proxy_error` in stats and as `blocked` (transient) on the wire.
        return {**base, "outcome": "proxy_error"}
    except fetch.AmazonNotFound:
        return {**base, "outcome": "not_found", "netMs": _elapsed_ms(started)}
    except (fetch.AmazonBadRequest, ValueError):
        # An alias this marketplace does not know (amazon.de says `ce-de`, not
        # `electronics`): the list does not exist, same answer as a 404.
        return {**base, "outcome": "not_found", "netMs": _elapsed_ms(started)}
    except egress.NoProxyError:
        raise
    except Exception as exc:
        # A parser crash is OUR failure. Only the exception TYPE is logged: a
        # curl/network error's str() can embed the proxy URL, credentials
        # included.
        _log.warning("bestsellers raised %s for %s/%s p%s", type(exc).__name__, list_type, category or "root", page)
        return {**base, "outcome": "parse_failed", "netMs": _elapsed_ms(started)}
    net_ms = _elapsed_ms(started)
    return {**base, "outcome": "found", "list": to_wire(raw), "netMs": net_ms}
