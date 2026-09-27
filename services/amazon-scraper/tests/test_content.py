from sellerhill import content


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
    })
    monkeypatch.setattr(content, "extract_gallery", lambda html: [])
    out = content.build_content("<html/>", "US")
    assert out["variationAttributes"] == {"Color": "Black"}
    assert out["specs"] == {} and out["identifiers"] == {}
