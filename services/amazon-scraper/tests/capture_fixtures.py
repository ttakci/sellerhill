"""Capture real product pages as gzipped fixtures (developer machine only).

    SCRAPER_ALLOW_DIRECT=1 python tests/capture_fixtures.py <path-to-limitscan.json>

Writes tests/fixtures/<name>.html.gz and prints a skeleton for expected.json.
Fill expected.json by opening each ASIN in a browser and reading the page:
the dropdown max of the BUY BOX quantity selector, the availability text,
and the image count of the selected variant's gallery.
"""
import gzip
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from amazon import fetch, sites  # noqa: E402

FX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
os.makedirs(FX, exist_ok=True)
site = sites.site("US")


def get(asin):
    return fetch.page("US", f"/dp/{asin}", {"th": "1", "psc": "1"}, referer=site["base"] + f"/s?k={asin}")


def save(name, html):
    with gzip.open(os.path.join(FX, f"{name}.html.gz"), "wt", encoding="utf-8") as f:
        f.write(html)


rows = json.load(open(sys.argv[1], encoding="utf-8"))
wanted = {
    "only_left": lambda r: r.get("only") is not None,
    "limited_in_stock": lambda r: r.get("only") is None and r.get("drops") and r["drops"][0] < 20,
    "plain_in_stock": lambda r: r.get("only") is None and r.get("drops") and r["drops"][0] >= 30,
    "unavailable": lambda r: "unavailable" in (r.get("text") or "").lower(),
    "multi_select": lambda r: len(r.get("drops") or []) > 1,
}
picked = {}
for name, pred in wanted.items():
    for r in rows:
        if "err" in r or not pred(r):
            continue
        html = get(r["asin"])
        if 'id="productTitle"' in html:
            save(name, html); picked[name] = r["asin"]; break

# Fixed ASINs: two are always captured this way (a gallery edge case and a
# variation family), and a third is a fallback for "unavailable" -- this
# specific limitscan.json slice (asins2000[1196:1596], an automotive-
# bestsellers pool) happened to contain zero "Currently unavailable" pages,
# so the predicate loop above never fills that name. B09FK9NJF4 is a real,
# verified "Currently unavailable" product page (an out-of-stock swim-trunk
# size variant), found by searching apparel/shoe categories -- their
# per-size/color SKUs churn out of stock far more often than the automotive
# parts limitscan.json was built from (see task-2-report.md).
FIXED = [("empty_color_images", "B01KIFISX2"), ("variations", "B0CS3B7MD8")]
if "unavailable" not in picked:
    FIXED.append(("unavailable", "B09FK9NJF4"))
for name, asin in FIXED:
    if name in picked:
        continue
    save(name, get(asin)); picked[name] = asin
print(json.dumps({k: {"asin": v, "quantityMax": None, "isInStock": None, "onlyLeft": None, "imageCount": None}
                  for k, v in picked.items()}, indent=2))
