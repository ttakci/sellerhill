"""Page signals, extracted without parsing the whole 1-2.5 MB page.

A full BeautifulSoup parse costs ~1 s of CPU; refresh runs hundreds of
thousands of pages a day, so commerce mode parses only small fragments
around the elements upstream's own `_price` / `_availability` / `_buybox`
read, then calls those same upstream functions — the result is identical to
the full parse (tests assert it) at a fraction of the cost."""
import json
import re

from amazon import parsers as P

_GALLERY = re.compile(r"""['"]initial['"]\s*:\s*A\.\$\.parseJSON\('(\[.*?\])'\)""", re.S)
_SELECT = re.compile(r"<select\b[^>]*>(.*?)</select>", re.S | re.I)
_OPTION = re.compile(r'<option[^>]*value="(\d+)"', re.I)
_FRAGMENT_IDS = ("apex_desktop", "corePriceDisplay_desktop_feature_div", "corePrice_feature_div",
                 "corePrice_desktop", "price", "buybox", "availability", "merchantInfoFeature_feature_div",
                 "tabular-buybox", "merchant-info")
_FRAGMENT_CHARS = 60000


def extract_gallery(html):
    """Hi-res images of the CURRENT ASIN from ImageBlock's 'initial' payload.
    `colorImages` elsewhere on the page holds every variant's images."""
    m = _GALLERY.search(html or "")
    if not m:
        return []
    raw = m.group(1).replace("\\'", "'")
    for candidate in (raw, raw.replace('\\"', '"')):
        try:
            items = json.loads(candidate)
        except ValueError:
            continue
        out = []
        for e in items:
            if isinstance(e, dict):
                url = e.get("hiRes") or e.get("large")
                if url and url not in out:
                    out.append(url)
        return out
    return []


def _select_tags(html):
    for m in re.finditer(r"<select\b[^>]*>", html or "", re.I):
        tag = m.group(0)
        if 'name="quantity"' in tag:
            end = html.find("</select>", m.end())
            yield tag, html[m.end(): end if end != -1 else m.end()]


def extract_quantity_max(html):
    """Max option of the Buy Box quantity select. Prefer the select with
    id="quantity" (the Buy Box one); other name="quantity" selects belong to
    subscribe & save or other offers."""
    selects = list(_select_tags(html))
    if not selects:
        return None
    chosen = next((body for tag, body in selects if 'id="quantity"' in tag), selects[0][1])
    values = [int(v) for v in _OPTION.findall(chosen)]
    return max(values) if values else None


def _id_tag_start(html, element_id):
    """Start of the first tag carrying a real `id="element_id"` ATTRIBUTE.

    A raw substring find also matched decoys — `data-csa-c-slot-id="price"`,
    `aria-describedby`-style attributes ending in `id=`, or the text inside a
    script — and the slice then started at the wrong element, which surfaces
    as a parse failure. The attribute must be preceded by whitespace inside an
    opening tag."""
    m = re.search(r'<[A-Za-z][^<>]*\sid="' + re.escape(element_id) + '"', html)
    return m.start() if m else -1


def _fragments(html):
    """One clean, independently-closed fragment per id in _FRAGMENT_IDS.

    A raw `html[tag_start:tag_start + N]` slice has no guarantee its own
    outermost tag is ever closed within N chars. Joining several such
    unbalanced slices into ONE string and parsing it ONCE lets lxml's
    error-recovery nest a LATER fragment's content underneath an EARLIER
    fragment's dangling tag -- confirmed on real captured pages two ways:
    a #corePrice_feature_div scope resolving to an unrelated $39.99 List
    Price that actually belonged to the earlier #corePriceDisplay fragment
    it got nested under, and a #availability scope disappearing entirely
    once a preceding fragment's stray unclosed tag swallowed it. Parsing
    each slice on its own (so any dangling tag is closed at THAT fragment's
    end, not the whole document's) and re-serializing just the matched node
    isolates fragments from each other before they are ever joined."""
    parts = []
    for element_id in _FRAGMENT_IDS:
        tag_start = _id_tag_start(html, element_id)
        if tag_start == -1:
            continue
        raw = html[tag_start: tag_start + _FRAGMENT_CHARS]
        node = P.first(P.soup(raw), f'[id="{element_id}"]')
        if node is not None:
            parts.append(str(node))
    return "\n".join(parts)


def extract_commerce_signals(html, site):
    doc = P.soup(_fragments(html or ""))
    price = P._price(doc, site["currency"]) or {}
    availability = P._availability(doc) or {}
    buybox = P._buybox(doc, site) or {}
    seller = buybox.get("seller") or {}
    return {
        "price": price.get("amount"),
        "currency": price.get("currency") or site["currency"],
        "availabilityText": availability.get("text"),
        "isInStock": availability.get("is_in_stock"),
        "onlyLeft": availability.get("quantity_left"),
        "quantityMax": extract_quantity_max(html),
        "buyboxSellerId": seller.get("id"),
        "buyboxSellerName": seller.get("name"),
        "soldByAmazon": buybox.get("is_sold_by_amazon"),
    }
