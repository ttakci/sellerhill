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

from amazon import fetch, parsers, rankings, refs
from amazon.shared import context

from sellerhill import egress

_log = logging.getLogger(__name__)

# The sidebar tree is NESTED lists — one <ul> per level — but upstream
# flattens it into document order and drops the nesting. On a leaf
# category Amazon shows the leaf among its SIBLINGS (parent's children,
# the leaf in bold), so "everything before the selected row is an
# ancestor" stops being true there: a flat list cannot tell a sibling from
# a grandparent. `level` (0 = "Any Department") keeps that structure.
_TREE_ITEM_SELECTOR = "[class*=zg-browse-item], [class*=zg-root-browse-item]"
_TREE_ANCHOR = "zg-browse-root"
# The nav tree is a few KB; the slice only has to reach its end.
_TREE_FRAGMENT_CHARS = 200_000


def tree_levels(html_text):
    """Nesting level of every tree row upstream keeps (same selector, same
    "skip a row with no text" rule, same order), or None when the tree
    cannot be found. Only the nav fragment is parsed, not the whole page."""
    start = (html_text or "").find(_TREE_ANCHOR)
    if start < 0:
        return None
    start = html_text.rfind("<ul", 0, start)
    if start < 0:
        return None
    doc = parsers.soup(html_text[start:start + _TREE_FRAGMENT_CHARS])
    rows = [li for li in doc.select(_TREE_ITEM_SELECTOR) if parsers.text(li)]
    if not rows:
        return None
    depths = [sum(1 for parent in li.parents if parent.name == "ul") for li in rows]
    top = min(depths)
    return [depth - top for depth in depths]


def _with_tree_levels(parse):
    def bestsellers_page(html_text, site):
        data = parse(html_text, site)
        tree = data.get("tree") or []
        levels = tree_levels(html_text)
        # A count mismatch means the two selections disagree; no level is
        # better than a wrong one (the API falls back to the flat reading).
        if levels is not None and len(levels) == len(tree):
            for row, level in zip(tree, levels):
                row["level"] = level
        return data
    bestsellers_page.__wrapped__ = parse
    return bestsellers_page


# `rankings.bestsellers` looks the parser up on the module at call time.
if not hasattr(parsers.bestsellers_page, "__wrapped__"):
    parsers.bestsellers_page = _with_tree_levels(parsers.bestsellers_page)


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
    level = raw.get("level")
    return {"name": raw.get("name"), "path": raw.get("path"), "link": raw.get("link"),
            "isSelected": bool(raw.get("is_selected")), "isRoot": bool(raw.get("is_root")),
            "level": level if isinstance(level, int) else None}


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


def _tree_page(category, list_type, country):
    """The list page alone — no ACP hydration POSTs — read for its sidebar.
    One request instead of up to four: the tree crawl wants the categories,
    and the 30 server-rendered items are not a whole list, so none is sent."""
    site, locale = context(country, None)
    segment = rankings.LIST_TYPES[list_type]
    path = f"/gp/{segment}/{category}/".replace("//", "/") if category else f"/gp/{segment}/"
    html = fetch.page(site["country"], path, None, language=locale, label=f"{list_type} tree {category or 'root'}")
    data = parsers.bestsellers_page(html, site)
    return {"title": data.get("title"), "category": category or None, "list_type": list_type,
            "link": site["base"] + path, "items": [], "categories": data.get("tree"),
            "related_lists": data.get("tabs"),
            "pagination": {"page": 1, "items_per_page": 0, "total_pages": 0, "total_count": 0}}


def fetch_bestsellers(country, list_type, category, page, tree_only=False):
    """`{outcome, fetchedAt, list, netMs?}` for one list page. `category` is
    already validated by the route (`refs.resolve_bestseller_category`); it is
    re-resolved here so a direct caller gets the same grammar. `tree_only`
    reads the sidebar from one GET and returns no items."""
    base = {"outcome": None, "fetchedAt": _now(), "list": None}
    started = time.monotonic()
    try:
        resolved = refs.resolve_bestseller_category(category)
        if tree_only:
            raw = _tree_page(resolved, list_type, country)
        else:
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
