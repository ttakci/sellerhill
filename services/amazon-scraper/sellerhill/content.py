"""Full-mode content: upstream's product_page, with OUR gallery (upstream's
mixes every variant's images) and the fields NestJS maps into products."""
from amazon import parsers as P

from sellerhill.signals import extract_gallery


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
    }
