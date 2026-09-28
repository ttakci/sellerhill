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


def test_price_beyond_the_fragment_window_is_still_read():
    # This page's #buybox is ~128k chars and its price sits ~103k chars in —
    # past the 60k fragment window, so the lean path returned price None for
    # an in-stock, buyable product. On create that read as "product data
    # unavailable"; on refresh the price would never have updated. The lean
    # result must equal the full parse, whatever the page's size.
    s = signals.extract_commerce_signals(page("buybox_beyond_window"), US)
    assert s["price"] == 11.69
    assert s["isInStock"] is True


def test_no_featured_offer_is_signalled():
    # Amazon shows no Buy Box at all — only "See All Buying Options". Nothing
    # can be bought from this page, so it must be reported as exactly that,
    # not as an unreadable page.
    s = signals.extract_commerce_signals(page("no_featured_offer"), US)
    assert s["price"] is None
    assert s["noFeaturedOffer"] is True


@pytest.mark.parametrize("name", ["plain_in_stock", "buybox_beyond_window", "media_literal_initial", "unavailable"])
def test_a_page_with_a_buy_box_is_never_flagged_as_having_none(name):
    # "No featured offers available" TEXT appears in hidden variation
    # templates of perfectly buyable pages, so the flag must never follow it.
    assert signals.extract_commerce_signals(page(name), US)["noFeaturedOffer"] is False


def test_gallery_reads_a_plain_array_initial_payload():
    # Media pages (Blu-ray/DVD/books) write ImageBlockATF's gallery as a plain
    # JS array — `'colorImages': { 'initial': [...] }` — instead of the
    # `'initial': A.$.parseJSON('[...]')` form every other fixture uses. Only
    # the parseJSON form was recognised, so these pages yielded ZERO images:
    # a live listing with no pictures (eBay's placeholder) and no description
    # image. Values read from the page HTML.
    assert signals.extract_gallery(page("media_literal_initial")) == [
        "https://m.media-amazon.com/images/I/91gGYsX1a2L._SL1500_.jpg",
        "https://m.media-amazon.com/images/I/91KTtNeuVhL._SL1500_.jpg",
    ]


def test_gallery_falls_back_to_the_main_image_when_no_payload_is_readable():
    # Last resort: a page whose gallery payload is in a shape we do not know
    # still renders its main image. One real photo beats a listing with none.
    html = ('<div id="imgTagWrapperId"><img alt="x" src="https://m.media-amazon.com/images/I/AAA._SX300_.jpg" '
            'data-old-hires="https://m.media-amazon.com/images/I/AAA._SL1500_.jpg" id="landingImage"></div>')
    assert signals.extract_gallery(html) == ["https://m.media-amazon.com/images/I/AAA._SL1500_.jpg"]


def test_gallery_fallback_uses_the_largest_dynamic_image_without_old_hires():
    html = ('<img id="landingImage" data-old-hires="" data-a-dynamic-image="{&quot;https://m.media-amazon.com/images/I/BBB._SX342_.jpg&quot;:[342,342],'
            '&quot;https://m.media-amazon.com/images/I/BBB._SX522_.jpg&quot;:[522,522]}">')
    assert signals.extract_gallery(html) == ["https://m.media-amazon.com/images/I/BBB._SX522_.jpg"]


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
