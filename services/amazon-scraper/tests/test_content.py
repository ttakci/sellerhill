import gzip
import os

from sellerhill import content

FX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")


def page(name):
    with gzip.open(os.path.join(FX, f"{name}.html.gz"), "rt", encoding="utf-8") as f:
        return f.read()


_CLASSIC_OVERVIEW = """
<div data-csa-c-type="widget" data-csa-c-slot-id="product-overview-classic" data-csa-c-content-id="product-overview-classic"><table>
<tr class="a-spacing-small po-item_form"><td class="a-span3"><span>Item Form</span></td><td class="a-span9"><span>Wipes</span></td></tr>
<tr class="po-brand"><td class="a-span3"><span>Brand</span></td><td class="a-span9"><span>Acme</span></td></tr>
</table></div>
<div class="voyager-side-sheet-attribute-section"><table class="a-keyvalue prodDetTable" role="presentation">
<tr><th class="prodDetSectionEntry"> Number of Items </th><td class="prodDetAttrValue"> 1 </td></tr>
<tr><th class="prodDetSectionEntry"> Unit Count </th><td class="prodDetAttrValue"> 90 Count </td></tr>
<tr><th class="prodDetSectionEntry"> Item Form </th><td class="prodDetAttrValue"> Sheet </td></tr>
</table></div>
"""


def test_extract_extra_specs_reads_classic_overview_and_side_sheet_tables():
    assert content.extract_extra_specs(_CLASSIC_OVERVIEW) == {
        "item_form": "Wipes",  # first occurrence wins over the side-sheet duplicate
        "brand": "Acme",
        "number_of_items": "1",
        "unit_count": "90 Count",
    }


def test_extract_extra_specs_is_empty_on_pages_without_those_blocks():
    assert content.extract_extra_specs("<html><body><p>nothing</p></body></html>") == {}
    assert content.extract_extra_specs(None) == {}


def test_real_page_where_upstream_overview_is_none_still_yields_specs():
    # B0BNW6FFS5 (2026-09-27): upstream parsed overview=None and 4 detail rows;
    # the page's own tables carry these. Values read by hand from the HTML.
    specs = content.extract_extra_specs(page("overview_classic_sidesheet"))
    assert specs["item_form"] == "Wipes"
    assert specs["package_information"] == "Canister"
    assert specs["number_of_items"] == "1"
    assert specs["unit_count"] == "90 Count"
    assert specs["sheet_count"] == "90"
    assert specs["upc"] == "070612491633"
    assert content.identifiers_from_specs(specs) == {"upc": "070612491633", "gtin": "00070612491633",
                                                     "model_number": "AWMPC-90CT-1USLT", "part_number": "AWMPC-1USLT"}


def test_build_content_prefers_upstream_rows_and_identifiers(monkeypatch):
    monkeypatch.setattr(content.P, "product_page", lambda html, site: {
        "overview": {"item_form": "Upstream"}, "details": {"upc": "111"}, "identifiers": {"upc": "111"},
    })
    monkeypatch.setattr(content, "extract_gallery", lambda html: [])
    out = content.build_content(_CLASSIC_OVERVIEW, "US")
    assert out["specs"]["item_form"] == "Upstream"
    assert out["specs"]["number_of_items"] == "1"
    assert out["identifiers"] == {"upc": "111"}


def test_current_variation_attributes_picks_this_asin_only():
    variations = {
        "parent_asin": "B0PARENT00",
        "products": [
            {"asin": "B0OTHER000", "attributes": {"Scent": "Lemon"}, "is_current": False},
            {"asin": "B0THIS0000", "attributes": {"Scent": "Unscented", "Size": "90 Count (Pack of 1)"}, "is_current": True},
        ],
    }
    assert content.current_variation_attributes(variations) == {"Scent": "Unscented", "Size": "90 Count (Pack of 1)"}


def test_current_variation_attributes_is_empty_without_variations():
    assert content.current_variation_attributes(None) == {}
    assert content.current_variation_attributes({"products": [{"asin": "X", "is_current": False}]}) == {}


def test_build_content_carries_variation_attributes(monkeypatch):
    monkeypatch.setattr(content.P, "product_page", lambda html, site: {
        "title": "T",
        "variations": {"products": [{"asin": "A", "attributes": {"Color": "Black"}, "is_current": True}]},
        "rating": {"average": 4.4, "count": 18632}, "is_prime": True,
    })
    monkeypatch.setattr(content, "extract_gallery", lambda html: [])
    out = content.build_content("<html/>", "US")
    assert out["variationAttributes"] == {"Color": "Black"}
    # Reputation + Prime badge feed the seller's listing rules.
    assert out["rating"] == 4.4
    assert out["ratingCount"] == 18632
    assert out["isPrime"] is True
    assert out["specs"] == {} and out["identifiers"] == {}


# Read by hand from each fixture's Buy Box delivery block (#deliveryBlockMessage
# under #deliveryBlockContainer): "Or Prime members get FREE delivery …" = True,
# "Or fastest delivery …" = False, no Buy Box at all = None.
_PRIME_ELIGIBLE = {
    "buybox_beyond_window": True,
    "empty_color_images": True,
    "limited_in_stock": True,
    "media_literal_initial": True,
    "multi_select": True,
    "overview_classic_sidesheet": True,
    "plain_in_stock": True,
    "variations": True,
    "only_left": False,
    "no_featured_offer": None,
    "unavailable": None,
}


def test_prime_eligibility_is_read_from_the_buy_box_delivery_promise():
    for name, expected in _PRIME_ELIGIBLE.items():
        assert content.extract_prime_eligible(page(name)) is expected, name


def test_a_used_offer_row_never_decides_prime_eligibility():
    # Main offer not Prime, the used-offer row below it is.
    html = (
        '<div id="deliveryBlockContainer"><div id="deliveryBlockMessage">FREE delivery Monday. '
        'Or fastest delivery Thursday.</div></div>'
        '<div id="usedDeliveryBlockContainer"><div id="deliveryBlockMessage">'
        'Or Prime members get FREE delivery Tomorrow.</div></div>'
    )
    assert content.extract_prime_eligible(html) is False


def test_a_prime_badge_in_the_buy_box_counts():
    html = '<div id="deliveryBlockContainer"><div id="deliveryBlockMessage"><i class="a-icon a-icon-prime"></i> Tomorrow</div></div>'
    assert content.extract_prime_eligible(html) is True
