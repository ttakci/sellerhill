import gzip
import json
import os

import pytest

from amazon import parsers as P, sites
from sellerhill import signals

FX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
US = sites.site("US")
EXPECTED = json.load(open(os.path.join(FX, "expected.json"), encoding="utf-8"))


def page(name):
    with gzip.open(os.path.join(FX, f"{name}.html.gz"), "rt", encoding="utf-8") as f:
        return f.read()


@pytest.mark.parametrize("name", sorted(EXPECTED))
def test_quantity_max_matches_buy_box(name):
    assert signals.extract_quantity_max(page(name)) == EXPECTED[name]["quantityMax"]


@pytest.mark.parametrize("name", sorted(EXPECTED))
def test_commerce_signals_match_page(name):
    s = signals.extract_commerce_signals(page(name), US)
    assert s["isInStock"] == EXPECTED[name]["isInStock"]
    assert s["onlyLeft"] == EXPECTED[name]["onlyLeft"]


@pytest.mark.parametrize("name", sorted(EXPECTED))
def test_commerce_price_equals_full_parse(name):
    html = page(name)
    full = P.product_page(html, US)
    lean = signals.extract_commerce_signals(html, US)
    assert lean["price"] == (full.get("price") or {}).get("amount")
    assert lean["availabilityText"] == (full.get("availability") or {}).get("text")


@pytest.mark.parametrize("name", sorted(EXPECTED))
def test_gallery_is_current_variant_only(name):
    urls = signals.extract_gallery(page(name))
    assert len(urls) == EXPECTED[name]["imageCount"]
    assert len(urls) == len(set(urls))
    assert all(u.startswith("https://m.media-amazon.com/images/I/") for u in urls)


def test_gallery_found_when_color_images_empty():
    assert len(signals.extract_gallery(page("empty_color_images"))) > 0


def test_unavailable_page_has_no_price_and_not_in_stock():
    s = signals.extract_commerce_signals(page("unavailable"), US)
    assert s["isInStock"] is False and s["price"] is None


def test_no_signals_on_garbage():
    s = signals.extract_commerce_signals("<html><body>nothing</body></html>", US)
    assert s["price"] is None and s["isInStock"] is None and s["quantityMax"] is None
    assert signals.extract_gallery("<html></html>") == []


def test_fragment_anchor_ignores_decoy_id_substrings():
    from sellerhill.signals import _id_tag_start
    html = ('<div data-csa-c-slot-id="availability">decoy</div>'
            '<script>var x = \'id="availability"\';</script>'
            '<div class="a" id="availability"><span>In Stock</span></div>')
    start = _id_tag_start(html, "availability")
    assert html[start:].startswith('<div class="a" id="availability">')
    assert _id_tag_start('<div data-id="price"></div>', "price") == -1
