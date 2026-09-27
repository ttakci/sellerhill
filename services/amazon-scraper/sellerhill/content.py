"""Full-mode content: upstream's product_page, with OUR gallery (upstream's
mixes every variant's images) and the fields NestJS maps into products."""
from amazon import parsers as P

from sellerhill.signals import extract_gallery


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
    return {
        "title": d.get("title"),
        "brand": (d.get("brand") or {}).get("name"),
        "manufacturer": details.get("manufacturer"),
        "bullets": d.get("bullets") or [],
        "description": d.get("description"),
        "aplusRaw": d.get("aplus_description"),
        "images": extract_gallery(html),
        "categories": [c.get("name") for c in (d.get("categories") or []) if c.get("name")],
        "specs": {**(d.get("overview") or {}), **details},
        "identifiers": d.get("identifiers") or {},
        "variationAttributes": current_variation_attributes(d.get("variations")),
    }
