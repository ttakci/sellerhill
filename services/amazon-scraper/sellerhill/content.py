"""Full-mode content: upstream's product_page, with OUR gallery (upstream's
mixes every variant's images) and the fields NestJS maps into products."""
import re

from amazon import parsers as P

from sellerhill.signals import extract_gallery

# Spec tables upstream's `_details_rows`/overview selectors do not reach
# (found 2026-09-27 on B0BNW6FFS5, whose "overview" came back None while the
# page showed Item Form / Package Information, and whose Number of Items /
# Unit Count / Sheet Count sat in "Measurements" side-sheet tables):
#   - id="product-overview-classic"  -- the overview grid under a different id
#     than #productOverview_feature_div (rows `tr.po-*`, td.a-span3 / td.a-span9)
#   - table.prodDetTable            -- the voyager side-sheet "Item details" /
#     "Measurements" tables (th.prodDetSectionEntry / td.prodDetAttrValue)
# The classic overview widget carries NO id= of its own; `id="product-overview-
# classic"` as a substring only ever hits its `data-csa-c-content-id` attribute
# (the decoy the Task 2 ledger warned about), so it is located by the slot
# attribute and its rows by their `po-*` classes.
_OVERVIEW_MARKER = 'data-csa-c-slot-id="product-overview-classic"'
_PRODDET_TABLE = re.compile(r"<table\b[^>]*\bprodDetTable\b[^>]*>.*?</table>", re.S | re.I)
_FRAGMENT_CHARS = 60000
_IDENTIFIER_KEYS = ("upc", "ean", "isbn_10", "isbn_13", "gtin", "global_trade_identification_number",
                    "model_number", "item_model_number", "part_number", "manufacturer_part_number")


def _classic_overview_rows(html):
    start = html.find(_OVERVIEW_MARKER)
    if start == -1:
        return []
    tag_start = html.rfind("<", 0, start)
    doc = P.soup(html[tag_start: tag_start + _FRAGMENT_CHARS])
    return [tr.select("td") for tr in doc.select('tr[class*="po-"]')]


def extract_extra_specs(html):
    """Label/value rows from the spec blocks upstream misses, snake-cased like
    upstream's own keys. First occurrence wins. Regex-scoped so a full-mode
    page is not soup'd a second time end to end (≈40 ms on a 2.8 MB page)."""
    html = html or ""
    rows = []
    for cells in _classic_overview_rows(html):
        if len(cells) >= 2:
            rows.append((P.text(cells[0]), P.text(cells[1])))
    for m in _PRODDET_TABLE.finditer(html):
        for tr in P.soup(m.group(0)).select("tr"):
            th, td = P.first(tr, "th"), P.first(tr, "td")
            if th is not None and td is not None:
                rows.append((P.text(th), P.text(td)))
    out = {}
    for label, value in rows:
        key = P.snake(P.clean((label or "").rstrip(":")))
        value = P.clean(value)
        if key and value and key not in out:
            out[key] = value
    return out


def identifiers_from_specs(specs):
    """Same derivation upstream's product_page applies to its `details` rows,
    so a UPC/GTIN/model that only the side-sheet tables show still reaches
    `identifiers` (B0BNW6FFS5's barcode lived there and nowhere else)."""
    out = {}
    for key in _IDENTIFIER_KEYS:
        if specs.get(key):
            out[key.replace("global_trade_identification_number", "gtin").replace("item_model_number", "model_number")
                .replace("manufacturer_part_number", "part_number")] = specs[key]
    return out


def current_variation_attributes(variations):
    """The attributes Amazon selected for THIS asin on a variation page
    (``{"Color": "Black", "Size": "90 Count (Pack of 1)"}``). Keepa carries the
    same facts as structured ``color``/``size``/``scent`` fields; the page shows
    them only in the twister, so without this a variant listing lost them."""
    for p in (variations or {}).get("products") or []:
        if p.get("is_current") and isinstance(p.get("attributes"), dict):
            return {str(k): str(v) for k, v in p["attributes"].items() if k and v}
    return {}


def build_content(html, site):
    d = P.product_page(html, site)
    details = d.get("details") or {}
    extra = extract_extra_specs(html)
    return {
        "title": d.get("title"),
        "brand": (d.get("brand") or {}).get("name"),
        "manufacturer": details.get("manufacturer"),
        "bullets": d.get("bullets") or [],
        "description": d.get("description"),
        "aplusRaw": d.get("aplus_description"),
        "images": extract_gallery(html),
        "categories": [c.get("name") for c in (d.get("categories") or []) if c.get("name")],
        # Upstream's own rows win; the extra blocks only add what they missed.
        "specs": {**extra, **(d.get("overview") or {}), **details},
        "identifiers": {**identifiers_from_specs(extra), **(d.get("identifiers") or {})},
        "variationAttributes": current_variation_attributes(d.get("variations")),
    }
