# Amazon Scraper Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve Amazon product data from our own scraper service by default, with Keepa kept as a whole-provider rollback behind one panel setting.

**Architecture:**
- **Python service** (`services/amazon-scraper/`). A vendored fork of omkarcloud/amazon-scraper that fetches Amazon product pages through a mandatory proxy pool. It returns raw page **signals** (price, availability, "Only N left", quantity-dropdown max) and, in full mode, the product **content**.
- **NestJS** turns the signals into a provider-independent commerce state through a pure, Jest-tested normalizer, then feeds the create path, import path and refresh worker.
- **Keepa code stays in place.** Its create and refresh paths are only branched around, never rewritten.

**Tech Stack:**
- Python 3.12: bottle, cheroot, `curl_cffi`, BeautifulSoup/lxml, pytest
- NestJS 10: raw `pg`, BullMQ, Jest
- React 18: Emotion, i18n
- Docker Compose (Coolify)

**Spec:** `docs/superpowers/specs/2026-09-26-amazon-scraper-provider-design.md`. Read it first: it records the measurements that justify every rule below.

**Prototype code** (throwaway, already proven against live pages) lives in the session scratchpad:
- `C:/Users/2B/AppData/Local/Temp/claude/d--dev-projects-sellerhill-sellerhill/880c04aa-a792-4955-b7a2-c62ba0606668/scratchpad/amazon-scraper/`
- `imgfix.py`: the gallery extractor that matched Keepa on 90/90 products
- `lean.py`: commerce extraction
- `qty.py` / `limitscan.py`: the quantity dropdown
- `limitscan.json`: 400 classified pages, used as candidate ASINs for fixture capture
- The upstream checkout there is at commit `ea5aefd`

## Global Constraints

- **Default provider is `scraper`.** `product.dataProvider` ∈ {`keepa`, `scraper`}.
  - There is **no** Keepa fallback of any kind, including for a missing barcode.
  - Keepa is only a whole-provider rollback.
- **Never make an Amazon request without a proxy.**
  - The only exception is `SCRAPER_ALLOW_DIRECT=1`, which is for a developer's own machine.
  - `docker-compose.test.yml` and `docker-compose.production.yml` must **not** mention `SCRAPER_ALLOW_DIRECT` at all.
  - The NestJS side must not call the service when the proxy list is empty.
- **Stock rules** (spec §"Stock status"):

  | Page signal | Status | Stock |
  |---|---|---|
  | `Only N left` | EXACT | N |
  | `In Stock`, dropdown max ≥ floor or absent | AT_LEAST | floor (default **20**) |
  | `In Stock`, dropdown max D < floor | AT_LEAST | D |
  | `Currently unavailable` | OUT_OF_STOCK | 0 |
  | HTTP 404 | OUT_OF_STOCK, removed flag set | 0 |
  | unreadable | UNKNOWN | keep previous |

- **Quantity formula:** `min(max(stock − stockBuffer, 0), defaultQuantity, maxOrderQuantity ?? ∞)`.
- **Prices:** the Prime price the page shows is the correct price. Do not "fix" it to the non-Prime price.
- **Content rules:**
  - Do not use A+ text in the listing. Store it raw only.
  - Barcode may be absent; that is accepted.
  - The listing-create cache rule is unchanged: a cached row with a valid title and ≥1 image is not re-fetched.
- **Refresh interval default is 360 minutes.** Setting keys `keepa.refresh.*` and the queue name `keepa-refresh` are **not renamed**.
- **Seller-facing copy** is "**Amazon'da erişilemiyor**" (TR) / "**Unavailable on Amazon**" (EN) for removed products. AT_LEAST stock renders as `N+` (e.g. `20+`, `4+`).
- **Project rules still apply:** CLAUDE.md, `.claude/skills/frontend-rules/SKILL.md`.
  - Enums in `packages/shared`, never string literals.
  - All UI text through i18n, EN + TR.
  - 4-file split for web components.
  - `pnpm lint` must pass; the pre-commit hook enforces it.
- **Packages build to `dist/`.** After changing `packages/shared`, run `pnpm --filter @repo/shared build` before API/web tests.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Work on branch `development` (current).

## Review Focus

1. **In-stock page with no readable price** (e.g. "See price in cart", or the Buy Box suppressed). Price must be `null`, which preserves the previous price. It must never become `0`. *Test in Task 6.*
2. **A page with several `name="quantity"` selects** (subscribe & save, other offers). `quantityMax` must come from the Buy Box select, not the first one on the page. *Fixture test in Task 2.*
3. **Proxy credentials leaking.** Proxy URLs carry `user:pass`. They must never appear in stats, logs, API responses or the admin panel; only `host:port` may. *Tests in Tasks 3 and 12.*
4. **Scraper service down or timing out during a create batch.** Items must fail as **retryable** `PRODUCT_DATA_UNAVAILABLE`, never as terminal `ASIN_NOT_FOUND`. *Test in Task 8.*
5. **Rollback to Keepa after scraper rows exist.** The Keepa refresh must overwrite `stock_status` with `exact`, and clear nothing else unexpectedly. `max_order_quantity` and `source_removed_at` stay as the scraper left them and do not break the Keepa quantity formula. *Test in Task 10.*

---

## File Structure

**Python service: `services/amazon-scraper/` (new)**

| Path | Responsibility |
|---|---|
| upstream files (`amazon/`, `config.py`, `routes.py`, `run.py`, `schema_fields.py`, `scraper_errors.py`, `main.py`, `LICENSE`, `requirements.txt`) | Vendored at upstream `ea5aefd`, unchanged except `amazon/fetch.py` `_proxy_for` and `config.py`, both in Task 1. |
| `UPSTREAM.md` | Upstream URL and commit, plus the list of patched upstream lines. |
| `sellerhill/egress.py` | Thread-bound proxy, `NoProxyError`, `SCRAPER_ALLOW_DIRECT`. |
| `sellerhill/signals.py` | `extract_gallery`, `extract_quantity_max`, `extract_commerce_signals`. |
| `sellerhill/content.py` | Full-mode content dict from upstream `product_page` plus our gallery. |
| `sellerhill/fetcher.py` | `fetch_one(asin, marketplace, mode) → result dict`: outcome classification. |
| `sellerhill/pool.py` | `ProxyPool`: workers per proxy, lanes, per-proxy rate limit, cooldown, deadlines, stats. |
| `sellerhill/app.py` | bottle app: `POST /v1/products`, `GET /v1/stats`, `GET /health`, secret check, validation. |
| `sellerhill/serve.py` | Entrypoint (cheroot). |
| `tests/` | pytest suite and gzipped HTML fixtures. |
| `Dockerfile`, `requirements-dev.txt` | Container and test deps. |

**Shared: `packages/shared/src/`**

| Path | Responsibility |
|---|---|
| `domain/products/source-product.types.ts` (new) | Enums, scraper wire types, `SourceCommerce`. |
| `domain/products/product-data.types.ts` | Add `stockStatus`, `maxOrderQuantity`, `sourceRemoved` to `ProductData`. |
| `domain/listings/listings.types.ts` | Add `sourceStockStatus`, `sourceRemoved` to the listing DTO. |
| `domain/listings/listing-failure.types.ts` | Add stock fields to `ListingFailureDetails`. |
| `domain/admin/platform-settings.types.ts` | New keys and category. |
| `domain/admin/admin.types.ts` | New warning kinds and operations fields. |
| `utils/source-stock.ts` (new) | `formatSourceStock(stock, status)`: the one place `N+` is produced. |

**API: `apps/api/`**

| Path | Responsibility |
|---|---|
| `migrations/122_products_source_stock.sql` (new) | Schema. |
| `src/modules/listings/source-product-normalizer.ts` (new) | Pure: signals → `SourceCommerce`; refresh planning. |
| `src/modules/listings/source-content-mapper.ts` (new) | Pure: scraper content → `ProductData`; spec-key translation. |
| `src/modules/listings/scraper.client.ts` (new) | HTTP client for the service. |
| `src/modules/listings/product-source.service.ts` (new) | Provider switch, proxy list, `fetchForCreate`, `fetchCommerce`. |
| `src/modules/listings/scraper-refresh.ts` (new) | Pure: `resolveScraperRefreshBatchSize`, `planScraperRefresh`. |
| `src/modules/listings/fair-priority.ts` (new) | Pure: `fairBatchPriority`. |
| `src/modules/listings/listing-processor.service.ts` | Create path branch, prefetch, `ZeroStockError`, `ProductDataUnavailableError`. |
| `src/modules/listings/listings.service.ts` | Persist and read the new columns; DTO; CSV; filters. |
| `src/modules/listings/listing-strategy.service.ts` | `calculateQuantity` with `maxOrderQuantity`. |
| `src/modules/listings/refresh-processor.service.ts` | Scraper branch; Keepa branch writes `stock_status`. |
| `src/modules/listings/listing-queue.service.ts`, `listing-import.service.ts` | Fair priority. |
| `src/modules/listings/listing-failure.ts` | New typed errors. |
| `src/modules/admin/admin.service.ts` and the admin DTO | Warnings, scraper stats, lag, capacity. |
| `src/modules/action-center/action-center.service.ts` | Removed products counted in `LISTING_SOURCE_UNAVAILABLE`. |
| `src/common/settings/platform-settings.registry.ts`, `src/common/config/env.validation.ts` | New settings and env. |
| `src/scripts/provider-compare.ts` (new) | Read-only Keepa vs scraper diff. |

**Web: `apps/web/src/`** listing detail, listings columns, filters, job failure label, admin page, demo fixtures.

**Deployment:** `docker-compose.yml`, `docker-compose.test.yml`, `docker-compose.production.yml`.

---

### Task 1: Vendor the scraper and make proxies mandatory

**Files:**
- Create: `services/amazon-scraper/` (copy of upstream `ea5aefd`)
- Create: `services/amazon-scraper/UPSTREAM.md`
- Create: `services/amazon-scraper/sellerhill/__init__.py`, `sellerhill/egress.py`
- Create: `services/amazon-scraper/requirements-dev.txt`, `services/amazon-scraper/pytest.ini`
- Create: `services/amazon-scraper/tests/__init__.py`, `tests/test_egress.py`
- Modify: `services/amazon-scraper/amazon/fetch.py` (`_proxy_for`), `services/amazon-scraper/config.py`

**Interfaces:**
- Produces:
  - `sellerhill.egress.NoProxyError(Exception)`
  - `sellerhill.egress.bind(proxy: str | None)`, a context manager that binds a proxy to the current thread
  - `sellerhill.egress.require_proxy() -> str | None`, which raises `NoProxyError` unless a proxy is bound or direct egress is allowed
  - `sellerhill.egress.allow_direct() -> bool`
  - `sellerhill.egress.redact(proxy: str) -> str`, which returns `host:port`

- [ ] **Step 1: Copy upstream into the repo**

```bash
cd d:/dev/projects/sellerhill/sellerhill
git clone --depth 50 https://github.com/omkarcloud/amazon-scraper.git /tmp/omk && git -C /tmp/omk checkout ea5aefd
mkdir -p services/amazon-scraper
cp -r /tmp/omk/amazon /tmp/omk/config.py /tmp/omk/routes.py /tmp/omk/run.py /tmp/omk/schema_fields.py \
      /tmp/omk/scraper_errors.py /tmp/omk/main.py /tmp/omk/LICENSE /tmp/omk/requirements.txt services/amazon-scraper/
```

(On Windows Git Bash, use the scratchpad checkout, which is already at `ea5aefd`, as the source instead of `/tmp/omk`.)

- [ ] **Step 2: Write `UPSTREAM.md`**

```markdown
# Upstream

Vendored from https://github.com/omkarcloud/amazon-scraper (MIT) at commit `ea5aefd`.

Our code lives in `sellerhill/`. Upstream files are unchanged EXCEPT:

- `amazon/fetch.py` — `_proxy_for()` returns `sellerhill.egress.require_proxy()`. Upstream fell back to a
  direct connection when no proxy was configured; we must never scrape from the server's own IP
  (auto-fulfill checkouts share it). See docs/superpowers/specs/2026-09-26-amazon-scraper-provider-design.md D5.
- `config.py` — `AMAZON_PROXY` is no longer read; `amazon_country_proxy` / `amazon_fallback_proxy`
  return `None`, so the upstream "fallback exit" path can never activate.

To merge upstream: diff upstream against this commit, apply their changes, then re-apply the two patches above.
```

- [ ] **Step 3: Write the failing egress tests**

`services/amazon-scraper/tests/test_egress.py`:

```python
import threading

import pytest

from sellerhill import egress


def test_require_proxy_raises_when_nothing_bound(monkeypatch):
    monkeypatch.delenv("SCRAPER_ALLOW_DIRECT", raising=False)
    with pytest.raises(egress.NoProxyError):
        egress.require_proxy()


def test_bound_proxy_is_returned_only_on_that_thread(monkeypatch):
    monkeypatch.delenv("SCRAPER_ALLOW_DIRECT", raising=False)
    seen = {}
    with egress.bind("http://u:p@1.2.3.4:8000"):
        assert egress.require_proxy() == "http://u:p@1.2.3.4:8000"

        def other():
            try:
                egress.require_proxy()
                seen["other"] = "leaked"
            except egress.NoProxyError:
                seen["other"] = "refused"

        t = threading.Thread(target=other)
        t.start(); t.join()
    assert seen["other"] == "refused"
    with pytest.raises(egress.NoProxyError):
        egress.require_proxy()


def test_allow_direct_only_with_exact_flag(monkeypatch):
    monkeypatch.setenv("SCRAPER_ALLOW_DIRECT", "1")
    assert egress.require_proxy() is None
    monkeypatch.setenv("SCRAPER_ALLOW_DIRECT", "true")
    with pytest.raises(egress.NoProxyError):
        egress.require_proxy()


def test_fetch_session_refuses_without_proxy(monkeypatch):
    monkeypatch.delenv("SCRAPER_ALLOW_DIRECT", raising=False)
    from amazon import fetch
    with pytest.raises(egress.NoProxyError):
        fetch.session("US")


def test_redact_hides_credentials():
    assert egress.redact("http://user:secret@10.0.0.1:3128") == "10.0.0.1:3128"
    assert egress.redact("socks5://h.example.com:1080") == "h.example.com:1080"
```

`services/amazon-scraper/pytest.ini`:

```ini
[pytest]
testpaths = tests amazon
python_files = test_*.py
```

`services/amazon-scraper/requirements-dev.txt`:

```
-r requirements.txt
pytest==8.3.3
```

- [ ] **Step 4: Run the tests to verify they fail**

```bash
cd services/amazon-scraper && python -m venv .venv && .venv/Scripts/python -m pip install -q -r requirements-dev.txt
.venv/Scripts/python -m pytest tests/test_egress.py -q
```

Expected: FAIL with `ModuleNotFoundError: No module named 'sellerhill'`.

- [ ] **Step 5: Implement `sellerhill/egress.py` and patch upstream**

`services/amazon-scraper/sellerhill/__init__.py`: empty file.

`services/amazon-scraper/sellerhill/egress.py`:

```python
"""Egress policy: every Amazon request leaves through a proxy bound to the
calling thread. Direct egress (the host's own IP) is refused unless
SCRAPER_ALLOW_DIRECT is exactly "1" — a developer-machine switch that no
deployment compose file sets. The server IP is shared with real Amazon
checkouts; a flagged IP there costs real orders."""
import os
import threading
from contextlib import contextmanager
from urllib.parse import urlsplit

_local = threading.local()


class NoProxyError(Exception):
    """No proxy is bound to this thread and direct egress is not allowed."""


def allow_direct() -> bool:
    return os.environ.get("SCRAPER_ALLOW_DIRECT") == "1"


@contextmanager
def bind(proxy):
    previous = getattr(_local, "proxy", None)
    _local.proxy = proxy
    try:
        yield
    finally:
        _local.proxy = previous


def require_proxy():
    proxy = getattr(_local, "proxy", None)
    if proxy:
        return proxy
    if allow_direct():
        return None
    raise NoProxyError("no proxy bound to this thread and SCRAPER_ALLOW_DIRECT is not set")


def redact(proxy: str) -> str:
    parts = urlsplit(proxy)
    host = parts.hostname or "?"
    return f"{host}:{parts.port}" if parts.port else host
```

Patch `services/amazon-scraper/amazon/fetch.py`: replace the whole `_proxy_for` function body with:

```python
def _proxy_for(site):
    """SellerHill patch (see UPSTREAM.md): the proxy bound to this thread by the
    pool, never a direct connection."""
    from sellerhill import egress
    return egress.require_proxy()
```

Patch `services/amazon-scraper/config.py`: replace everything from `AMAZON_PROXY = ...` to the end of the file with:

```python
# SellerHill patch (see UPSTREAM.md): proxies are bound per thread by
# sellerhill.pool; the upstream env proxy and its fallback exit are disabled.
AMAZON_PROXY = None
AMAZON_PROXY_COUNTRY = None
AMAZON_DIRECT_COOLDOWN = 300


def amazon_country_proxy(country):
    return None


def amazon_fallback_proxy(country):
    return None
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
.venv/Scripts/python -m pytest tests/test_egress.py -q
```

Expected: 5 passed. Also run the upstream offline suite; it must still pass, since it never touches the network:

```bash
.venv/Scripts/python -m pytest amazon/test_parsers.py -q
```

- [ ] **Step 7: Ignore the venv and commit**

Append to the repo root `.gitignore`:

```
services/amazon-scraper/.venv/
services/amazon-scraper/**/__pycache__/
```

```bash
git add .gitignore services/amazon-scraper
git commit -m "feat(scraper): vendor omkarcloud amazon-scraper, refuse direct egress

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Page signal extractors (gallery, quantity dropdown, commerce)

**Files:**
- Create: `services/amazon-scraper/sellerhill/signals.py`
- Create: `services/amazon-scraper/tests/capture_fixtures.py` (dev tool, not a test)
- Create: `services/amazon-scraper/tests/fixtures/*.html.gz`, `services/amazon-scraper/tests/fixtures/expected.json`
- Create: `services/amazon-scraper/tests/test_signals.py`

**Interfaces:**
- Consumes: upstream `amazon.parsers` (`soup`, `_price`, `_availability`, `_buybox`, `product_page`) and `amazon.sites.site("US")`
- Produces:
  - `extract_gallery(html: str) -> list[str]`: hi-res image URLs of the **current ASIN only**, in order
  - `extract_quantity_max(html: str) -> int | None`: the Buy Box quantity select's largest option
  - `extract_commerce_signals(html: str, site: dict) -> dict` with keys `price` (float|None), `currency`, `availabilityText`, `isInStock` (bool|None), `onlyLeft` (int|None), `quantityMax` (int|None), `buyboxSellerId`, `buyboxSellerName`, `soldByAmazon`

- [ ] **Step 1: Write the fixture capture tool**

`services/amazon-scraper/tests/capture_fixtures.py`: run by hand on a developer machine with `SCRAPER_ALLOW_DIRECT=1`. It picks candidates from the scratchpad's `limitscan.json` (400 classified pages) plus two fixed ASINs, and saves one page per condition.

```python
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
for name, asin in (("empty_color_images", "B01KIFISX2"), ("variations", "B0CS3B7MD8")):
    save(name, get(asin)); picked[name] = asin
print(json.dumps({k: {"asin": v, "quantityMax": None, "isInStock": None, "onlyLeft": None, "imageCount": None}
                  for k, v in picked.items()}, indent=2))
```

- [ ] **Step 2: Capture the fixtures and record the expected values**

```bash
cd services/amazon-scraper
SCRAPER_ALLOW_DIRECT=1 .venv/Scripts/python tests/capture_fixtures.py "C:/Users/2B/AppData/Local/Temp/claude/d--dev-projects-sellerhill-sellerhill/880c04aa-a792-4955-b7a2-c62ba0606668/scratchpad/amazon-scraper/limitscan.json" > tests/fixtures/expected.json
```

Open every ASIN printed in `expected.json` in a browser and fill `quantityMax`, `isInStock`, `onlyLeft` and `imageCount` with what the page shows. For `multi_select`, `quantityMax` is the max of the selector **next to the Add to Cart button**.

`expected.json` is the ground truth the tests check. It must come from looking at the page, not from running the extractor.

- [ ] **Step 3: Write the failing tests**

`services/amazon-scraper/tests/test_signals.py`:

```python
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
```

- [ ] **Step 4: Run the tests to verify they fail**

```bash
.venv/Scripts/python -m pytest tests/test_signals.py -q
```

Expected: FAIL with `ImportError: cannot import name 'signals'`.

- [ ] **Step 5: Implement `sellerhill/signals.py`**

```python
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


def _fragments(html):
    parts = []
    for element_id in _FRAGMENT_IDS:
        start = html.find(f'id="{element_id}"')
        if start == -1:
            continue
        tag_start = html.rfind("<", 0, start)
        parts.append(html[tag_start: tag_start + _FRAGMENT_CHARS])
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
```

If `test_quantity_max_matches_buy_box[multi_select]` fails because the Buy Box select has no `id="quantity"`, inspect the fixture. Pick the select inside the element with `id="addToCart"` or `id="buybox"`, and encode that rule in `extract_quantity_max`. Re-run until the test passes. Do **not** change `expected.json` to match the code.

If `test_commerce_price_equals_full_parse` fails on a fixture, add the id of the element that holds the full-parse price to `_FRAGMENT_IDS`. `P._price` reads its scopes from `#apex_desktop`, `#corePriceDisplay_desktop_feature_div`, `#corePrice_feature_div`, `#corePrice_desktop`, `#price` and `#buybox`.

- [ ] **Step 6: Run the tests to verify they pass**

```bash
.venv/Scripts/python -m pytest tests/test_signals.py -q
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add services/amazon-scraper/sellerhill/signals.py services/amazon-scraper/tests
git commit -m "feat(scraper): gallery, buy-box quantity and lean commerce signal extractors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Fetcher, proxy pool and HTTP service

**Files:**
- Create: `services/amazon-scraper/sellerhill/content.py`, `sellerhill/fetcher.py`, `sellerhill/pool.py`, `sellerhill/app.py`, `sellerhill/serve.py`
- Create: `services/amazon-scraper/tests/test_fetcher.py`, `tests/test_pool.py`, `tests/test_app.py`
- Modify: `services/amazon-scraper/Dockerfile` (replace upstream's)

**Interfaces:**
- Consumes: `egress.bind`, `egress.redact`, `egress.allow_direct`, `egress.NoProxyError` (Task 1); `signals.*` (Task 2).
- Produces the HTTP contract that the NestJS client (Task 7) relies on:
  - `POST /v1/products`
    - Header `X-Scraper-Secret: <SCRAPER_SERVICE_SECRET>`
    - Body:
      ```
      {"marketplace":"US","asins":[...≤100],"mode":"full"|"commerce","lane":"interactive"|"background","proxies":[str],"perIpRequestsPerSecond":number}
      ```
    - 200 response: `{"results":[{"asin","outcome","fetchedAt","signals"|null,"content"|null}]}`
    - `outcome` ∈ `found|not_found|blocked|parse_failed|no_proxy`
    - `content` (full mode, found only): `{title, brand, manufacturer, bullets[], description, aplusRaw, images[], categories[], specs{}, identifiers{}}`
    - Errors: 401 bad secret, 400 invalid body, 503 `SCRAPER_SERVICE_SECRET` unset
  - `GET /v1/stats`, with the secret:
    ```
    {"window1h":{found,notFound,blocked,parseFailed,noProxy},"window24h":{...},"meanLatencyMs":number|null,"proxies":[{"id":"host:port","requests1h":n,"blocked1h":n,"coolingDown":bool}]}
    ```
  - `GET /health`: `{"ok":true}`, no secret required
  - Result objects preserve the request's ASIN order. Duplicate ASINs in a request are fetched once.

- [ ] **Step 1: Write the failing fetcher tests**

`services/amazon-scraper/tests/test_fetcher.py`:

```python
import gzip
import os

from amazon import fetch
from sellerhill import fetcher

FX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")


def page(name):
    with gzip.open(os.path.join(FX, f"{name}.html.gz"), "rt", encoding="utf-8") as f:
        return f.read()


def test_found_commerce_has_signals_and_no_content(monkeypatch):
    monkeypatch.setattr(fetch, "page", lambda *a, **k: page("plain_in_stock"))
    r = fetcher.fetch_one("B000000001", "US", "commerce")
    assert r["outcome"] == "found" and r["signals"]["isInStock"] is True and r["content"] is None


def test_found_full_has_content_with_our_gallery(monkeypatch):
    monkeypatch.setattr(fetch, "page", lambda *a, **k: page("empty_color_images"))
    r = fetcher.fetch_one("B01KIFISX2", "US", "full")
    assert r["outcome"] == "found"
    assert len(r["content"]["images"]) > 0
    assert r["content"]["title"]
    assert isinstance(r["content"]["specs"], dict)


def test_404_is_not_found(monkeypatch):
    def boom(*a, **k):
        raise fetch.AmazonNotFound("x")
    monkeypatch.setattr(fetch, "page", boom)
    assert fetcher.fetch_one("B000000001", "US", "commerce")["outcome"] == "not_found"


def test_block_is_blocked(monkeypatch):
    def boom(*a, **k):
        raise fetch.AmazonBlocked("captcha")
    monkeypatch.setattr(fetch, "page", boom)
    assert fetcher.fetch_one("B000000001", "US", "commerce")["outcome"] == "blocked"


def test_page_without_title_is_parse_failed(monkeypatch):
    monkeypatch.setattr(fetch, "page", lambda *a, **k: "<html><body>odd</body></html>")
    assert fetcher.fetch_one("B000000001", "US", "commerce")["outcome"] == "parse_failed"
```

- [ ] **Step 2: Write the failing pool tests**

`services/amazon-scraper/tests/test_pool.py`:

```python
import threading
import time

from sellerhill import egress
from sellerhill.pool import ProxyPool


def ok_fetch(asin, marketplace, mode):
    return {"asin": asin, "outcome": "found", "proxy": egress.require_proxy()}


def test_each_worker_runs_bound_to_its_proxy(monkeypatch):
    monkeypatch.delenv("SCRAPER_ALLOW_DIRECT", raising=False)
    pool = ProxyPool(ok_fetch, threads_per_proxy=1)
    pool.ensure(["http://u:p@10.0.0.1:1", "http://u:p@10.0.0.2:1"], rate=50)
    results = [f.result(5) for f in [pool.submit(f"A{i:09d}", "US", "commerce", "background") for i in range(10)]]
    assert {r["proxy"] for r in results} <= {"http://u:p@10.0.0.1:1", "http://u:p@10.0.0.2:1"}
    pool.shutdown()


def test_interactive_lane_runs_before_background():
    order = []
    gate = threading.Event()

    def slow(asin, marketplace, mode):
        gate.wait(2)
        order.append(asin)
        return {"asin": asin, "outcome": "found"}

    pool = ProxyPool(slow, threads_per_proxy=1)
    pool.ensure(["http://h:1"], rate=100)
    first = pool.submit("BLOCKER000", "US", "commerce", "background")
    time.sleep(0.1)
    bg = pool.submit("BACKGROUND", "US", "commerce", "background")
    it = pool.submit("INTERACTIV", "US", "full", "interactive")
    gate.set()
    for f in (first, bg, it):
        f.result(5)
    assert order.index("INTERACTIV") < order.index("BACKGROUND")
    pool.shutdown()


def test_rate_limit_per_proxy():
    pool = ProxyPool(ok_fetch, threads_per_proxy=2)
    pool.ensure(["http://h:1"], rate=5)
    start = time.monotonic()
    for f in [pool.submit(f"A{i:09d}", "US", "commerce", "background") for i in range(10)]:
        f.result(10)
    assert time.monotonic() - start >= 1.6  # 10 requests at 5/s on one proxy
    pool.shutdown()


def test_repeated_blocks_cool_a_proxy_down_and_stats_redact():
    def blocked(asin, marketplace, mode):
        return {"asin": asin, "outcome": "blocked"}

    pool = ProxyPool(blocked, threads_per_proxy=1, block_streak_for_cooldown=3, cooldown_seconds=60)
    pool.ensure(["http://user:secret@10.9.9.9:3128"], rate=100)
    for f in [pool.submit(f"A{i:09d}", "US", "commerce", "background") for i in range(3)]:
        f.result(5)
    stats = pool.stats()
    assert stats["proxies"][0]["id"] == "10.9.9.9:3128"
    assert stats["proxies"][0]["coolingDown"] is True
    assert "secret" not in str(stats)
    pool.shutdown()


def test_task_nobody_picks_up_resolves_blocked_at_its_deadline():
    pool = ProxyPool(ok_fetch, threads_per_proxy=1, task_timeout_seconds=0.1)
    f = pool.submit("A000000001", "US", "commerce", "background")  # no proxies: nobody takes it
    start = time.monotonic()
    assert pool.wait(f)["outcome"] == "blocked"
    assert time.monotonic() - start < 1.0
    assert pool.stats()["window1h"]["blocked"] == 1
    pool.shutdown()


def test_removed_proxy_stops_taking_work():
    pool = ProxyPool(ok_fetch, threads_per_proxy=1)
    pool.ensure(["http://a:1", "http://b:1"], rate=100)
    pool.ensure(["http://b:1"], rate=100)
    results = [f.result(5) for f in [pool.submit(f"A{i:09d}", "US", "commerce", "background") for i in range(6)]]
    assert all(r["proxy"] == "http://b:1" for r in results)
    pool.shutdown()
```

- [ ] **Step 3: Write the failing app tests**

`services/amazon-scraper/tests/test_app.py`:

```python
import json

import pytest
from webtest import TestApp

from sellerhill import app as app_module


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("SCRAPER_SERVICE_SECRET", "s3cret")
    monkeypatch.delenv("SCRAPER_ALLOW_DIRECT", raising=False)
    calls = []

    def fake_fetch(asin, marketplace, mode):
        calls.append(asin)
        return {"asin": asin, "outcome": "found", "fetchedAt": "t", "signals": {"price": 1.0}, "content": None}

    application = app_module.create_app(fetch_one=fake_fetch)
    yield TestApp(application), calls
    application.config["pool"].shutdown()


def body(**over):
    b = {"marketplace": "US", "asins": ["B000000001"], "mode": "commerce", "lane": "background",
         "proxies": ["http://u:p@1.2.3.4:8000"], "perIpRequestsPerSecond": 50}
    b.update(over)
    return b


def test_secret_required(client):
    app, _ = client
    assert app.post_json("/v1/products", body(), expect_errors=True).status_int == 401


def test_found_results_in_request_order_and_deduped(client):
    app, calls = client
    res = app.post_json("/v1/products", body(asins=["B000000002", "B000000001", "B000000002"]),
                        headers={"X-Scraper-Secret": "s3cret"})
    assert [r["asin"] for r in res.json["results"]] == ["B000000002", "B000000001"]
    assert sorted(calls) == ["B000000001", "B000000002"]


def test_empty_proxies_is_no_proxy_without_fetching(client):
    app, calls = client
    res = app.post_json("/v1/products", body(proxies=[]), headers={"X-Scraper-Secret": "s3cret"})
    assert res.json["results"][0]["outcome"] == "no_proxy" and calls == []


@pytest.mark.parametrize("bad", [
    {"asins": ["short"]}, {"asins": [f"B{i:09d}" for i in range(101)]}, {"mode": "x"},
    {"lane": "x"}, {"proxies": ["ftp://h:1"]}, {"perIpRequestsPerSecond": 0},
])
def test_invalid_body_is_400(client, bad):
    app, _ = client
    assert app.post_json("/v1/products", body(**bad), headers={"X-Scraper-Secret": "s3cret"},
                         expect_errors=True).status_int == 400


def test_stats_never_contain_credentials(client):
    app, _ = client
    app.post_json("/v1/products", body(), headers={"X-Scraper-Secret": "s3cret"})
    stats = app.get("/v1/stats", headers={"X-Scraper-Secret": "s3cret"}).json
    assert "p@" not in json.dumps(stats) and stats["window1h"]["found"] == 1


def test_health_is_open(client):
    app, _ = client
    assert app.get("/health").json == {"ok": True}
```

Add `WebTest==3.0.1` to `requirements-dev.txt`.

- [ ] **Step 4: Run all three to verify they fail**

```bash
.venv/Scripts/python -m pip install -q -r requirements-dev.txt
.venv/Scripts/python -m pytest tests/test_fetcher.py tests/test_pool.py tests/test_app.py -q
```

Expected: FAIL (modules missing).

- [ ] **Step 5: Implement `sellerhill/content.py`**

```python
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
```

- [ ] **Step 6: Implement `sellerhill/fetcher.py`**

```python
"""One ASIN → one result dict. Classifies every failure into an outcome the
NestJS normalizer understands; never raises except NoProxyError."""
from datetime import datetime, timezone

from amazon import fetch, sites

from sellerhill.content import build_content
from sellerhill.signals import extract_commerce_signals


def _now():
    return datetime.now(timezone.utc).isoformat()


def fetch_one(asin, marketplace, mode):
    site = sites.site(marketplace)
    base = {"asin": asin, "fetchedAt": _now(), "signals": None, "content": None}
    try:
        html = fetch.page(site["country"], f"/dp/{asin}", {"th": "1", "psc": "1"},
                          referer=f"{site['base']}/s?k={asin}", label=f"product {asin}")
    except fetch.AmazonNotFound:
        return {**base, "outcome": "not_found"}
    except fetch.AmazonUpstreamError:  # includes AmazonBlocked
        return {**base, "outcome": "blocked"}
    if 'id="productTitle"' not in html:
        return {**base, "outcome": "parse_failed"}
    result = {**base, "outcome": "found", "signals": extract_commerce_signals(html, site)}
    if mode == "full":
        result["content"] = build_content(html, site)
    return result
```

(The full parse runs on the worker thread. With the lanes below, full mode is interactive and low-volume, so a process pool is not needed. If CPU is ever the bottleneck, `SCRAPER_THREADS_PER_PROXY` is the lever.)

- [ ] **Step 7: Implement `sellerhill/pool.py`**

```python
"""Proxy pool: `threads_per_proxy` worker threads per proxy, each bound to
its proxy for life (so upstream's thread-local curl sessions never change IP
mid-session), a shared two-lane priority queue (interactive before
background), a per-proxy token-bucket rate limit, cooldown after repeated
blocks, and a deadline after which a queued task resolves as blocked."""
import itertools
import queue
import threading
import time
from collections import deque
from concurrent.futures import Future, InvalidStateError
from concurrent.futures import TimeoutError as FutureTimeout

from sellerhill import egress

_LANE_PRIORITY = {"interactive": 0, "background": 1}
_OUTCOMES = ("found", "not_found", "blocked", "parse_failed", "no_proxy")
_STAT_KEYS = {"found": "found", "not_found": "notFound", "blocked": "blocked",
              "parse_failed": "parseFailed", "no_proxy": "noProxy"}


class _Proxy:
    def __init__(self, url, rate):
        self.url = url
        self.id = egress.redact(url)
        self.rate = rate
        self.lock = threading.Lock()
        self.next_slot = 0.0
        self.block_streak = 0
        self.cool_until = 0.0
        self.retired = threading.Event()

    def wait_turn(self):
        with self.lock:
            now = time.monotonic()
            slot = max(now, self.next_slot)
            self.next_slot = slot + 1.0 / self.rate
        time.sleep(max(0.0, slot - time.monotonic()))


class ProxyPool:
    def __init__(self, fetch_one, threads_per_proxy=2, cooldown_seconds=300,
                 block_streak_for_cooldown=3, task_timeout_seconds=150):
        self._fetch_one = fetch_one
        self._threads_per_proxy = threads_per_proxy
        self._cooldown = cooldown_seconds
        self._streak_limit = block_streak_for_cooldown
        self._timeout = task_timeout_seconds
        self._queue = queue.PriorityQueue()
        self._seq = itertools.count()
        self._proxies = {}
        self._lock = threading.Lock()
        self._events = deque()  # (monotonic_ts, outcome, proxy_id, latency_ms)
        self._stop = threading.Event()

    # -- configuration ------------------------------------------------------------
    def ensure(self, proxies, rate):
        with self._lock:
            wanted = set(proxies)
            for url in list(self._proxies):
                if url not in wanted:
                    self._proxies.pop(url).retired.set()
            for url in proxies:
                if url in self._proxies:
                    self._proxies[url].rate = rate
                    continue
                p = _Proxy(url, rate)
                self._proxies[url] = p
                for _ in range(self._threads_per_proxy):
                    threading.Thread(target=self._worker, args=(p,), daemon=True).start()

    def shutdown(self):
        self._stop.set()
        with self._lock:
            for p in self._proxies.values():
                p.retired.set()

    # -- work ---------------------------------------------------------------------------
    def submit(self, asin, marketplace, mode, lane):
        fut = Future()
        fut.asin = asin
        fut.deadline = time.monotonic() + self._timeout
        self._queue.put((_LANE_PRIORITY[lane], next(self._seq), (asin, marketplace, mode, fut.deadline, fut)))
        return fut

    def wait(self, fut):
        """Block until the task resolves or its deadline passes; a task nobody
        picked up in time (every proxy cooling down) resolves as blocked. No
        timer thread per task — the waiter enforces the deadline."""
        remaining = max(0.0, fut.deadline - time.monotonic())
        try:
            return fut.result(timeout=remaining + 0.05)
        except FutureTimeout:
            self._expire(fut.asin, fut)
            return fut.result()

    def _resolve(self, fut, result):
        try:
            fut.set_result(result)
            return True
        except InvalidStateError:  # the waiter expired it first
            return False

    def _expire(self, asin, fut):
        if self._resolve(fut, {"asin": asin, "outcome": "blocked", "fetchedAt": None, "signals": None, "content": None}):
            self._record("blocked", None, None)

    def _worker(self, proxy):
        while not (self._stop.is_set() or proxy.retired.is_set()):
            if time.monotonic() < proxy.cool_until:
                time.sleep(min(1.0, proxy.cool_until - time.monotonic()))
                continue
            try:
                _, _, (asin, marketplace, mode, deadline, fut) = self._queue.get(timeout=0.5)
            except queue.Empty:
                continue
            if fut.done():
                continue
            if time.monotonic() > deadline:
                self._expire(asin, fut)
                continue
            proxy.wait_turn()
            started = time.monotonic()
            with egress.bind(proxy.url):
                try:
                    result = self._fetch_one(asin, marketplace, mode)
                except Exception:  # never let one page kill a worker
                    result = {"asin": asin, "outcome": "blocked", "fetchedAt": None, "signals": None, "content": None}
            latency = (time.monotonic() - started) * 1000
            outcome = result.get("outcome")
            if outcome == "blocked":
                proxy.block_streak += 1
                if proxy.block_streak >= self._streak_limit:
                    proxy.cool_until = time.monotonic() + self._cooldown
                    proxy.block_streak = 0
            else:
                proxy.block_streak = 0
            self._record(outcome, proxy.id, latency)
            self._resolve(fut, result)

    # -- stats ----------------------------------------------------------------------------
    def record_no_proxy(self, count):
        for _ in range(count):
            self._record("no_proxy", None, None)

    def _record(self, outcome, proxy_id, latency):
        now = time.monotonic()
        with self._lock:
            self._events.append((now, outcome, proxy_id, latency))
            while self._events and now - self._events[0][0] > 86400:
                self._events.popleft()

    def stats(self):
        now = time.monotonic()
        with self._lock:
            events = list(self._events)
            proxies = list(self._proxies.values())

        def window(seconds):
            counts = {_STAT_KEYS[o]: 0 for o in _OUTCOMES}
            for ts, outcome, _, _ in events:
                if now - ts <= seconds and outcome in _STAT_KEYS:
                    counts[_STAT_KEYS[outcome]] += 1
            return counts

        latencies = [lat for ts, _, _, lat in events if lat is not None and now - ts <= 3600]
        return {
            "window1h": window(3600),
            "window24h": window(86400),
            "meanLatencyMs": round(sum(latencies) / len(latencies)) if latencies else None,
            "proxies": [{
                "id": p.id,
                "requests1h": sum(1 for ts, _, pid, _ in events if pid == p.id and now - ts <= 3600),
                "blocked1h": sum(1 for ts, o, pid, _ in events if pid == p.id and o == "blocked" and now - ts <= 3600),
                "coolingDown": now < p.cool_until,
            } for p in proxies],
        }
```

- [ ] **Step 8: Implement `sellerhill/app.py` and `sellerhill/serve.py`**

`sellerhill/app.py`:

```python
import hmac
import os
import re

import bottle

from sellerhill import egress
from sellerhill.fetcher import fetch_one as default_fetch_one
from sellerhill.pool import ProxyPool

_ASIN = re.compile(r"^[A-Z0-9]{10}$")
_PROXY = re.compile(r"^(http|https|socks5)://[^\s]+:\d+$")
_MODES = {"full", "commerce"}
_LANES = {"interactive", "background"}


def _json(status, data):
    bottle.response.status = status
    bottle.response.content_type = "application/json"
    return bottle.json_dumps(data)


def _authorized():
    secret = os.environ.get("SCRAPER_SERVICE_SECRET", "")
    given = bottle.request.headers.get("X-Scraper-Secret", "")
    return bool(secret) and hmac.compare_digest(secret, given)


def _validate(body):
    if not isinstance(body, dict):
        return "body must be an object"
    asins = body.get("asins")
    if not isinstance(asins, list) or not 1 <= len(asins) <= 100 or not all(isinstance(a, str) and _ASIN.match(a) for a in asins):
        return "asins: 1..100 ASINs"
    if body.get("mode") not in _MODES or body.get("lane") not in _LANES:
        return "mode/lane invalid"
    proxies = body.get("proxies")
    if not isinstance(proxies, list) or not all(isinstance(p, str) and _PROXY.match(p) for p in proxies):
        return "proxies: list of http(s)/socks5 URLs with port"
    rate = body.get("perIpRequestsPerSecond")
    if not isinstance(rate, (int, float)) or not 0.1 <= rate <= 10:
        return "perIpRequestsPerSecond: 0.1..10"
    if not isinstance(body.get("marketplace"), str):
        return "marketplace required"
    return None


def create_app(fetch_one=default_fetch_one, threads_per_proxy=None):
    threads = threads_per_proxy or int(os.environ.get("SCRAPER_THREADS_PER_PROXY", "2"))
    pool = ProxyPool(fetch_one, threads_per_proxy=threads)
    app = bottle.Bottle()
    app.config["pool"] = pool

    @app.get("/health")
    def health():
        return _json(200, {"ok": True})

    @app.get("/v1/stats")
    def stats():
        if not os.environ.get("SCRAPER_SERVICE_SECRET"):
            return _json(503, {"error": "SCRAPER_SERVICE_SECRET not set"})
        if not _authorized():
            return _json(401, {"error": "unauthorized"})
        return _json(200, pool.stats())

    @app.post("/v1/products")
    def products():
        if not os.environ.get("SCRAPER_SERVICE_SECRET"):
            return _json(503, {"error": "SCRAPER_SERVICE_SECRET not set"})
        if not _authorized():
            return _json(401, {"error": "unauthorized"})
        try:
            body = bottle.request.json
        except Exception:
            body = None
        error = _validate(body)
        if error:
            return _json(400, {"error": error})
        asins = list(dict.fromkeys(body["asins"]))
        proxies = body["proxies"]
        if not proxies:
            if not egress.allow_direct():
                pool.record_no_proxy(len(asins))
                return _json(200, {"results": [{"asin": a, "outcome": "no_proxy", "fetchedAt": None,
                                                 "signals": None, "content": None} for a in asins]})
            proxies = [None]  # developer machine only
        pool.ensure(proxies, float(body["perIpRequestsPerSecond"]))
        futures = [pool.submit(a, body["marketplace"], body["mode"], body["lane"]) for a in asins]
        results = [pool.wait(f) for f in futures]  # each resolves by its own deadline
        return _json(200, {"results": results})

    return app
```

Note on `proxies = [None]`: `ProxyPool.ensure` must accept `None` as a proxy key, and `egress.bind(None)` leaves `require_proxy()` to fall back to `allow_direct()`. Add this guard in `_Proxy.__init__`: `self.id = egress.redact(url) if url else "direct"`.

`sellerhill/serve.py`:

```python
import os

from cheroot import wsgi

from sellerhill.app import create_app


def main():
    port = int(os.environ.get("SCRAPER_PORT", "8080"))
    server = wsgi.Server(("0.0.0.0", port), create_app(), server_name="sellerhill-scraper", numthreads=32)
    print(f"sellerhill scraper listening on :{port}")
    try:
        server.start()
    except KeyboardInterrupt:
        server.stop()


if __name__ == "__main__":
    main()
```

- [ ] **Step 9: Replace the Dockerfile**

`services/amazon-scraper/Dockerfile`:

```dockerfile
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1
WORKDIR /app
COPY requirements.txt .
RUN python -m pip install --no-cache-dir -r requirements.txt
COPY . /app
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8080/health', timeout=2).status == 200 else 1)"
CMD ["python", "-m", "sellerhill.serve"]
```

- [ ] **Step 10: Run all Python tests to verify they pass**

```bash
.venv/Scripts/python -m pytest -q
```

Expected: all pass (egress, signals, fetcher, pool, app, upstream parsers).

- [ ] **Step 11: Smoke-test against Amazon from the developer machine**

```bash
SCRAPER_SERVICE_SECRET=dev SCRAPER_ALLOW_DIRECT=1 .venv/Scripts/python -m sellerhill.serve &
curl -s -X POST localhost:8080/v1/products -H "X-Scraper-Secret: dev" -H "Content-Type: application/json" \
  -d '{"marketplace":"US","asins":["B01KIFISX2"],"mode":"full","lane":"interactive","proxies":[],"perIpRequestsPerSecond":1}' | head -c 600
```

Expected: `"outcome": "found"`, a non-empty `images` array and a `signals.price`. Then stop the server.

- [ ] **Step 12: Commit**

```bash
git add services/amazon-scraper
git commit -m "feat(scraper): proxy pool with lanes, rate limit, cooldown; /v1/products service

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Shared types, migration, settings keys

**Files:**
- Create: `packages/shared/src/domain/products/source-product.types.ts`
- Create: `packages/shared/src/utils/source-stock.ts`
- Create: `apps/api/migrations/122_products_source_stock.sql`
- Create: `apps/api/src/modules/listings/source-stock.spec.ts`
- Modify:
  - `packages/shared/src/domain/products/product-data.types.ts`
  - `packages/shared/src/domain/listings/listings.types.ts` (listing DTO near `sourceStock?: number;` at line 106)
  - `packages/shared/src/domain/listings/listing-failure.types.ts` (`ListingFailureDetails`)
  - `packages/shared/src/domain/admin/platform-settings.types.ts`
  - the shared barrel `packages/shared/src/index.ts` (and the `utils` barrel if one exists: check how `listing-template.ts` is exported and mirror it)
  - `apps/api/src/common/settings/platform-settings.registry.ts`
  - `apps/api/src/common/config/env.validation.ts`
  - `packages/shared/src/i18n/resources/{en,tr}/admin.json`

**Interfaces:**
- Produces, in `@repo/shared`:
  ```ts
  export enum ProductDataProviderKind { KEEPA = 'keepa', SCRAPER = 'scraper' }
  export enum SourceStockStatus { EXACT = 'exact', AT_LEAST = 'at_least', OUT_OF_STOCK = 'out_of_stock', UNKNOWN = 'unknown' }
  export enum SourceFetchOutcome { FOUND = 'found', NOT_FOUND = 'not_found', BLOCKED = 'blocked', PARSE_FAILED = 'parse_failed', NO_PROXY = 'no_proxy' }
  export enum ScraperFetchMode { FULL = 'full', COMMERCE = 'commerce' }
  export enum ScraperLane { INTERACTIVE = 'interactive', BACKGROUND = 'background' }
  export interface ScraperSignals { price: number | null; currency: string | null; availabilityText: string | null; isInStock: boolean | null; onlyLeft: number | null; quantityMax: number | null; buyboxSellerId: string | null; buyboxSellerName: string | null; soldByAmazon: boolean | null }
  export interface ScraperContent { title: string | null; brand: string | null; manufacturer: string | null; bullets: string[]; description: string | null; aplusRaw: string | null; images: string[]; categories: string[]; specs: Record<string, string>; identifiers: Record<string, string> }
  export interface ScraperProductResult { asin: string; outcome: SourceFetchOutcome; fetchedAt: string | null; signals: ScraperSignals | null; content: ScraperContent | null }
  export interface ScraperProductsRequest { marketplace: string; asins: string[]; mode: ScraperFetchMode; lane: ScraperLane; proxies: string[]; perIpRequestsPerSecond: number }
  export interface ScraperOutcomeCounts { found: number; notFound: number; blocked: number; parseFailed: number; noProxy: number }
  export interface ScraperStats { window1h: ScraperOutcomeCounts; window24h: ScraperOutcomeCounts; meanLatencyMs: number | null; proxies: Array<{ id: string; requests1h: number; blocked1h: number; coolingDown: boolean }> }
  export interface SourceCommerce { price: number | null; stockStatus: SourceStockStatus; stock: number | null; maxOrderQuantity: number | null; removed: boolean }
  export function formatSourceStock(stock: number | null | undefined, status: SourceStockStatus | null | undefined): string
  ```
- `ProductData` gains `stockStatus?: SourceStockStatus; maxOrderQuantity?: number | null; sourceRemoved?: boolean;`
- The listing DTO gains `sourceStockStatus?: SourceStockStatus; sourceRemoved?: boolean;`
- `ListingFailureDetails` gains `amazonStock?: number; amazonStockAtLeast?: boolean; stockBuffer?: number;`
- `PlatformSettingCategory.SCRAPER = 'scraper'`
- `PlatformSettingKey` gains:
  - `PRODUCT_DATA_PROVIDER = 'product.dataProvider'`
  - `SCRAPER_PROXIES = 'scraper.proxies'`
  - `SCRAPER_PER_IP_RPS = 'scraper.perIpRequestsPerSecond'`
  - `SCRAPER_IN_STOCK_FLOOR = 'scraper.inStockFloor'`
  - `SCRAPER_BLOCK_RATE_WARN_PERCENT = 'scraper.blockRateWarnPercent'`

- [ ] **Step 1: Write the failing `formatSourceStock` test**

`apps/api/src/modules/listings/source-stock.spec.ts` (the Jest harness runs from `apps/api`, same arrangement as `ebay-eps.spec.ts`):

```ts
import { formatSourceStock, SourceStockStatus } from '@repo/shared';

describe('formatSourceStock', () => {
  it('renders AT_LEAST as N+', () => {
    expect(formatSourceStock(20, SourceStockStatus.AT_LEAST)).toBe('20+');
    expect(formatSourceStock(4, SourceStockStatus.AT_LEAST)).toBe('4+');
  });
  it('renders exact and out-of-stock as the number', () => {
    expect(formatSourceStock(20, SourceStockStatus.EXACT)).toBe('20');
    expect(formatSourceStock(0, SourceStockStatus.OUT_OF_STOCK)).toBe('0');
  });
  it('renders a missing value as an em dash and a missing status as the plain number', () => {
    expect(formatSourceStock(null, SourceStockStatus.EXACT)).toBe('—');
    expect(formatSourceStock(7, undefined)).toBe('7');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter api test -- source-stock`
Expected: FAIL (`formatSourceStock` is not exported).

- [ ] **Step 3: Create the shared types and util**

`packages/shared/src/domain/products/source-product.types.ts`: paste the `Produces` block above verbatim (without `formatSourceStock`), with a file comment that points at the spec.

`packages/shared/src/utils/source-stock.ts`:

```ts
import { SourceStockStatus } from '../domain/products/source-product.types';

/**
 * The single place Amazon stock becomes display text. AT_LEAST means "at
 * least this many" (Amazon shows no count above 20, or the seller's order
 * limit hides it), so it renders as `N+`; every other status is a real count.
 */
export function formatSourceStock(
  stock: number | null | undefined,
  status: SourceStockStatus | null | undefined,
): string {
  if (stock === null || stock === undefined) {
    return '—';
  }
  return status === SourceStockStatus.AT_LEAST ? `${stock}+` : String(stock);
}
```

Export both from the shared barrel, following how `listing-template.ts` and the `domain/products` types are exported.

Add the fields to `ProductData`, the listing DTO and `ListingFailureDetails`. Each new field gets a one-line JSDoc that explains its meaning (see "Interfaces").

- [ ] **Step 4: Add the settings keys and registry entries**

In `platform-settings.types.ts`, add `SCRAPER = 'scraper'` to `PlatformSettingCategory` and add the five keys to `PlatformSettingKey`.

In `platform-settings.registry.ts`:
- Change `KEEPA_REFRESH_INTERVAL_MINUTES`'s `defaultValue` from `'720'` to `'360'`.
- Add after the Keepa block:

```ts
  // --- Product data source (spec 2026-09-26-amazon-scraper-provider) ---
  def({
    // Whole-provider switch. There is no per-field fallback between the two.
    key: PlatformSettingKey.PRODUCT_DATA_PROVIDER,
    category: PlatformSettingCategory.KEEPA,
    type: PlatformSettingType.ENUM,
    envVar: 'PRODUCT_DATA_PROVIDER',
    defaultValue: 'scraper',
    options: ['keepa', 'scraper'],
  }),
  def({
    // Newline- or comma-separated proxy URLs (http/https/socks5, with port).
    // Write-only secret. Empty means the scraper makes no request at all —
    // it never falls back to the server's own IP.
    key: PlatformSettingKey.SCRAPER_PROXIES,
    category: PlatformSettingCategory.SCRAPER,
    type: PlatformSettingType.STRING,
    envVar: 'SCRAPER_PROXIES',
    defaultValue: null,
    isSecret: true,
  }),
  def({
    key: PlatformSettingKey.SCRAPER_PER_IP_RPS,
    category: PlatformSettingCategory.SCRAPER,
    type: PlatformSettingType.NUMBER,
    envVar: 'SCRAPER_PER_IP_RPS',
    defaultValue: '1',
    min: 0.1,
    max: 10,
  }),
  def({
    // Stock recorded for "In Stock" with no count: Amazon prints "Only N left"
    // only up to 20, so "In Stock" means at least this many.
    key: PlatformSettingKey.SCRAPER_IN_STOCK_FLOOR,
    category: PlatformSettingCategory.SCRAPER,
    type: PlatformSettingType.NUMBER,
    envVar: 'SCRAPER_IN_STOCK_FLOOR',
    defaultValue: '20',
    min: 1,
    max: 1000,
  }),
  def({
    key: PlatformSettingKey.SCRAPER_BLOCK_RATE_WARN_PERCENT,
    category: PlatformSettingCategory.SCRAPER,
    type: PlatformSettingType.NUMBER,
    envVar: 'SCRAPER_BLOCK_RATE_WARN_PERCENT',
    defaultValue: '10',
    min: 1,
    max: 100,
  }),
```

In `env.validation.ts`, next to `KEEPA_API_KEY`, add optional string fields `SCRAPER_SERVICE_URL`, `SCRAPER_SERVICE_SECRET` and `SCRAPER_PROXIES`, plus optional `PRODUCT_DATA_PROVIDER`. Use the same decorators the neighbouring optional strings use.

- [ ] **Step 5: Add the settings i18n (EN + TR)**

`platform-settings-i18n.guard.spec.ts` requires a title and a description for every key in both locales. In `packages/shared/src/i18n/resources/en/admin.json` under `admin.settings.keys` / `admin.settings.descriptions` (follow the existing entries' exact nesting), add:

| key | EN title | EN description |
|---|---|---|
| `product.dataProvider` | Product data source | Where Amazon product data comes from. "scraper" is our own service; "keepa" is the rollback. The two never mix. |
| `scraper.proxies` | Scraper proxies | Proxy URLs, one per line (http://user:pass@host:port). Without any, no Amazon data is fetched. The server's own IP is never used. |
| `scraper.perIpRequestsPerSecond` | Requests per second per proxy | How fast each proxy may fetch pages. Total capacity = this × proxy count. |
| `scraper.inStockFloor` | "In Stock" stock floor | Stock recorded when Amazon shows "In Stock" without a count. Displayed as N+. |
| `scraper.blockRateWarnPercent` | Block-rate warning (%) | Admin warning when this share of scraper requests was blocked in the last hour. |

TR (`tr/admin.json`):

| key | TR title | TR description |
|---|---|---|
| `product.dataProvider` | Ürün veri kaynağı | Amazon ürün verisinin nereden alındığı. "scraper" kendi servisimiz, "keepa" geri dönüş seçeneği. İkisi karışmaz. |
| `scraper.proxies` | Scraper proxy'leri | Her satıra bir proxy (http://kullanıcı:şifre@host:port). Hiç yoksa Amazon'dan veri çekilmez; sunucunun kendi IP'si asla kullanılmaz. |
| `scraper.perIpRequestsPerSecond` | Proxy başına saniyelik istek | Her proxy'nin saniyede kaç sayfa çekebileceği. Toplam kapasite = bu değer × proxy sayısı. |
| `scraper.inStockFloor` | "In Stock" stok tabanı | Amazon sayı vermeden "In Stock" gösterdiğinde kaydedilen stok. N+ olarak gösterilir. |
| `scraper.blockRateWarnPercent` | Blok oranı uyarısı (%) | Son bir saatte scraper isteklerinin bu oranı bloklanırsa admin uyarısı çıkar. |

Also add the category label `admin.settings.categories.scraper`: EN "Scraper", TR "Scraper". Relabel the existing `keepa` category: EN "Product data & refresh", TR "Ürün verisi ve yenileme". Match the existing key path by reading how the categories are labelled in `admin.json`.

- [ ] **Step 6: Write the migration**

`apps/api/migrations/122_products_source_stock.sql`:

```sql
-- Amazon stock as the scraper provider observes it (spec 2026-09-26-amazon-scraper-provider).
--
-- stock_status: 'exact' | 'at_least' | 'out_of_stock'. 'unknown' is never
--   stored — it means "keep the previous row". Existing rows hold Keepa's
--   exact numbers, hence the default.
-- max_order_quantity: the Buy Box quantity-dropdown maximum (the seller's
--   per-order limit, or Amazon's default 30). NULL = unknown; always NULL
--   for Keepa-sourced rows.
-- source_removed_at: set when the product page returns 404; cleared when it
--   returns. Feeds the Action Center "unavailable on Amazon" item.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_status VARCHAR(16) NOT NULL DEFAULT 'exact',
  ADD COLUMN IF NOT EXISTS max_order_quantity INT NULL,
  ADD COLUMN IF NOT EXISTS source_removed_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_products_source_removed
  ON products (source_removed_at)
  WHERE source_removed_at IS NOT NULL;
```

- [ ] **Step 7: Build shared and run the tests**

```bash
pnpm --filter @repo/shared build
pnpm --filter api test -- source-stock platform-settings
```

Expected: PASS, including `platform-settings-i18n.guard.spec.ts` and `platform-settings.helpers.spec.ts`.

- [ ] **Step 8: Verify the migration on a stock Postgres**

Follow the CLAUDE.md recipe:

```bash
docker run -d --name t -e POSTGRES_PASSWORD=x -e POSTGRES_DB=testdb postgres:18-alpine
docker exec t psql -U postgres -d testdb -c "CREATE ROLE sellerhill_user LOGIN;"
for f in apps/api/migrations/*.sql; do docker exec -i t psql -U postgres -d testdb -v ON_ERROR_STOP=1 < "$f" > /dev/null || echo "FAIL $f"; done
docker exec t psql -U postgres -d testdb -c "\d products" | grep -E "stock_status|max_order_quantity|source_removed_at"
docker rm -f t
```

Expected: no `FAIL` lines, and all three columns listed.

- [ ] **Step 9: Commit**

```bash
git add packages/shared apps/api/migrations/122_products_source_stock.sql apps/api/src/common apps/api/src/modules/listings/source-stock.spec.ts
git commit -m "feat(products): source stock status, order limit and removed flag; scraper settings

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Commerce normalizer (signals → stock status)

**Files:**
- Create: `apps/api/src/modules/listings/source-product-normalizer.ts`
- Create: `apps/api/src/modules/listings/source-product-normalizer.spec.ts`

**Interfaces:**
- Consumes: the Task 4 types.
- Produces:
  ```ts
  export type NormalizedObservation =
    | { kind: 'observed'; commerce: SourceCommerce }
    | { kind: 'data_failure' }
    | { kind: 'transport' };
  export function normalizeScraperCommerce(result: ScraperProductResult, inStockFloor: number): NormalizedObservation;
  ```

- [ ] **Step 1: Write the failing tests**

`source-product-normalizer.spec.ts`:

```ts
import { SourceFetchOutcome, SourceStockStatus, type ScraperProductResult, type ScraperSignals } from '@repo/shared';

import { normalizeScraperCommerce } from './source-product-normalizer';

const signals = (over: Partial<ScraperSignals> = {}): ScraperSignals => ({
  price: 12.5, currency: 'USD', availabilityText: 'In Stock', isInStock: true, onlyLeft: null,
  quantityMax: 30, buyboxSellerId: 'S', buyboxSellerName: 'Seller', soldByAmazon: false, ...over,
});
const found = (s: ScraperSignals): ScraperProductResult => ({
  asin: 'B000000001', outcome: SourceFetchOutcome.FOUND, fetchedAt: 't', signals: s, content: null,
});

describe('normalizeScraperCommerce', () => {
  it('Only N left → EXACT N', () => {
    const r = normalizeScraperCommerce(found(signals({ onlyLeft: 7, quantityMax: 30 })), 20);
    expect(r).toEqual({ kind: 'observed', commerce: { price: 12.5, stockStatus: SourceStockStatus.EXACT, stock: 7, maxOrderQuantity: 30, removed: false } });
  });

  it('In Stock with default dropdown → AT_LEAST floor', () => {
    const r = normalizeScraperCommerce(found(signals({ quantityMax: 30 })), 20);
    expect(r).toMatchObject({ commerce: { stockStatus: SourceStockStatus.AT_LEAST, stock: 20, maxOrderQuantity: 30 } });
  });

  it('In Stock with no dropdown → AT_LEAST floor, no order limit', () => {
    const r = normalizeScraperCommerce(found(signals({ quantityMax: null })), 20);
    expect(r).toMatchObject({ commerce: { stockStatus: SourceStockStatus.AT_LEAST, stock: 20, maxOrderQuantity: null } });
  });

  it('In Stock with seller limit below floor → AT_LEAST limit', () => {
    const r = normalizeScraperCommerce(found(signals({ quantityMax: 4 })), 20);
    expect(r).toMatchObject({ commerce: { stockStatus: SourceStockStatus.AT_LEAST, stock: 4, maxOrderQuantity: 4 } });
  });

  it('floor is configurable', () => {
    const r = normalizeScraperCommerce(found(signals({ quantityMax: 30 })), 25);
    expect(r).toMatchObject({ commerce: { stock: 25 } });
  });

  it('Currently unavailable → OUT_OF_STOCK 0 even with a stale price', () => {
    const r = normalizeScraperCommerce(found(signals({ isInStock: false, availabilityText: 'Currently unavailable.', price: null })), 20);
    expect(r).toMatchObject({ commerce: { stockStatus: SourceStockStatus.OUT_OF_STOCK, stock: 0, price: null } });
  });

  it('404 → OUT_OF_STOCK 0 and removed', () => {
    const r = normalizeScraperCommerce({ asin: 'B000000001', outcome: SourceFetchOutcome.NOT_FOUND, fetchedAt: 't', signals: null, content: null }, 20);
    expect(r).toEqual({ kind: 'observed', commerce: { price: null, stockStatus: SourceStockStatus.OUT_OF_STOCK, stock: 0, maxOrderQuantity: null, removed: true } });
  });

  it('in stock with no readable price → price null (never 0)', () => {
    const r = normalizeScraperCommerce(found(signals({ price: null })), 20);
    expect(r).toMatchObject({ kind: 'observed', commerce: { price: null, stockStatus: SourceStockStatus.AT_LEAST } });
  });

  it('availability unknown but price present → UNKNOWN stock, price kept', () => {
    const r = normalizeScraperCommerce(found(signals({ isInStock: null, availabilityText: null })), 20);
    expect(r).toMatchObject({ commerce: { stockStatus: SourceStockStatus.UNKNOWN, stock: null, price: 12.5 } });
  });

  it('neither price nor availability → data failure', () => {
    expect(normalizeScraperCommerce(found(signals({ isInStock: null, availabilityText: null, price: null })), 20)).toEqual({ kind: 'data_failure' });
  });

  it('parse_failed → data failure; blocked / no_proxy → transport', () => {
    const base = { asin: 'B000000001', fetchedAt: null, signals: null, content: null };
    expect(normalizeScraperCommerce({ ...base, outcome: SourceFetchOutcome.PARSE_FAILED }, 20)).toEqual({ kind: 'data_failure' });
    expect(normalizeScraperCommerce({ ...base, outcome: SourceFetchOutcome.BLOCKED }, 20)).toEqual({ kind: 'transport' });
    expect(normalizeScraperCommerce({ ...base, outcome: SourceFetchOutcome.NO_PROXY }, 20)).toEqual({ kind: 'transport' });
  });

  it('found with null signals → data failure', () => {
    expect(normalizeScraperCommerce({ asin: 'B000000001', outcome: SourceFetchOutcome.FOUND, fetchedAt: 't', signals: null, content: null }, 20)).toEqual({ kind: 'data_failure' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api test -- source-product-normalizer`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`source-product-normalizer.ts`:

```ts
import {
  SourceFetchOutcome,
  SourceStockStatus,
  type ScraperProductResult,
  type SourceCommerce,
} from '@repo/shared';

/**
 * Scraper page signals → provider-independent commerce state.
 *
 * Rules (spec "Stock status", evidence from ~1,300 product pages):
 * - "Only N left" is shown for N ≤ 20 → EXACT N.
 * - "In Stock" with no count → AT_LEAST. A seller order limit suppresses the
 *   "Only N left" message while stock is above the limit, so when the Buy Box
 *   dropdown max D is below the floor, D is the only safe lower bound.
 * - "Currently unavailable" / isInStock=false → OUT_OF_STOCK 0.
 * - 404 → OUT_OF_STOCK 0, removed.
 * - Unreadable availability → UNKNOWN (caller keeps the previous stock).
 * A missing price is always null, never 0: failing to read a price is not
 * evidence the product is free.
 */
export type NormalizedObservation =
  | { kind: 'observed'; commerce: SourceCommerce }
  | { kind: 'data_failure' }
  | { kind: 'transport' };

export function normalizeScraperCommerce(result: ScraperProductResult, inStockFloor: number): NormalizedObservation {
  switch (result.outcome) {
    case SourceFetchOutcome.BLOCKED:
    case SourceFetchOutcome.NO_PROXY:
      return { kind: 'transport' };
    case SourceFetchOutcome.PARSE_FAILED:
      return { kind: 'data_failure' };
    case SourceFetchOutcome.NOT_FOUND:
      return {
        kind: 'observed',
        commerce: { price: null, stockStatus: SourceStockStatus.OUT_OF_STOCK, stock: 0, maxOrderQuantity: null, removed: true },
      };
    case SourceFetchOutcome.FOUND:
      break;
    default:
      return { kind: 'data_failure' };
  }

  const s = result.signals;
  if (!s) {
    return { kind: 'data_failure' };
  }
  const price = typeof s.price === 'number' && s.price > 0 ? s.price : null;
  const quantityMax = typeof s.quantityMax === 'number' && s.quantityMax > 0 ? s.quantityMax : null;

  if (s.isInStock === false) {
    return {
      kind: 'observed',
      commerce: { price, stockStatus: SourceStockStatus.OUT_OF_STOCK, stock: 0, maxOrderQuantity: quantityMax, removed: false },
    };
  }
  if (typeof s.onlyLeft === 'number' && s.onlyLeft >= 0) {
    return {
      kind: 'observed',
      commerce: { price, stockStatus: SourceStockStatus.EXACT, stock: s.onlyLeft, maxOrderQuantity: quantityMax, removed: false },
    };
  }
  if (s.isInStock === true) {
    const stock = quantityMax !== null && quantityMax < inStockFloor ? quantityMax : inStockFloor;
    return {
      kind: 'observed',
      commerce: { price, stockStatus: SourceStockStatus.AT_LEAST, stock, maxOrderQuantity: quantityMax, removed: false },
    };
  }
  if (price === null) {
    return { kind: 'data_failure' };
  }
  return {
    kind: 'observed',
    commerce: { price, stockStatus: SourceStockStatus.UNKNOWN, stock: null, maxOrderQuantity: quantityMax, removed: false },
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api test -- source-product-normalizer`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/listings/source-product-normalizer*.ts
git commit -m "feat(listings): scraper commerce normalizer (Only N left / N+ / limit / removed)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Content mapper (scraper content → ProductData)

**Files:**
- Create: `apps/api/src/modules/listings/source-content-mapper.ts`
- Create: `apps/api/src/modules/listings/source-content-mapper.spec.ts`

**Interfaces:**
- Consumes: the Task 4 types, `SourceCommerce` (Task 5), `asPartNumber` (`keepa-normalizer.ts`), `normalizeGtin` / `isValidGtin` (`common/utils/gtin.ts`), `AMAZON_MARKETPLACE_CONFIG`.
- Produces:
  ```ts
  export function translateScraperSpecs(raw: Record<string, string>): Record<string, string>;
  export function mapScraperIdentifiers(raw: Record<string, string>, brand: string | null): ProductIdentifiers;
  export function mapScraperProduct(asin: string, content: ScraperContent, commerce: SourceCommerce, marketplace: AmazonMarketplace): ProductData;
  ```

- [ ] **Step 1: Write the failing tests**

`source-content-mapper.spec.ts`:

```ts
import { AmazonMarketplace, SourceStockStatus, type ScraperContent, type SourceCommerce } from '@repo/shared';

import { mapScraperIdentifiers, mapScraperProduct, translateScraperSpecs } from './source-content-mapper';

const content = (over: Partial<ScraperContent> = {}): ScraperContent => ({
  title: 'Mobil 1 Extended Performance Oil Filter, M1-113A | 2 Pack', brand: 'Mobil', manufacturer: 'Mobil 1',
  bullets: ['a', 'b'], description: 'desc', aplusRaw: 'Add to Cart $14.99',
  images: ['https://m.media-amazon.com/images/I/313tiIJ6ZyL._AC_SL1500_.jpg'],
  categories: ['Automotive', 'Replacement Parts', 'Filters', 'Oil Filters & Accessories', 'Oil Filters'],
  specs: {
    brand_name: 'Mobil', material_type: 'Stainless Steel, Synthetic', color: 'Blue', item_weight: '0.07 kg',
    number_of_items: '2', thread_size: 'M22 x 1.50', upc: '071924414402', asin: 'B077PVLBZ4',
    customer_reviews: '4.8', best_sellers_rank: '#8,656', date_first_available: 'Jan 1',
    manufacturer_part_number: 'M1-113A-2PK', model_number: 'M1-113A-2PK',
  },
  identifiers: { upc: '071924414402', gtin: '00071924414402', model_number: 'M1-113A-2PK', part_number: 'M1-113A-2PK' },
  ...over,
});
const commerce: SourceCommerce = { price: 26, stockStatus: SourceStockStatus.AT_LEAST, stock: 20, maxOrderQuantity: 30, removed: false };

describe('translateScraperSpecs', () => {
  it('maps known keys to the canonical names the aspect matcher uses', () => {
    const s = translateScraperSpecs(content().specs);
    expect(s).toMatchObject({ Brand: 'Mobil', Material: 'Stainless Steel, Synthetic', Color: 'Blue', 'Item Weight': '0.07 kg', 'Number of Items': '2' });
  });
  it('Title-Cases unknown keys so they still reach eBay as custom specifics', () => {
    expect(translateScraperSpecs(content().specs)['Thread Size']).toBe('M22 x 1.50');
  });
  it('drops noise and identifier keys', () => {
    const s = translateScraperSpecs(content().specs);
    for (const k of ['Asin', 'ASIN', 'Customer Reviews', 'Best Sellers Rank', 'Date First Available', 'Upc', 'UPC', 'Manufacturer Part Number', 'Model Number']) {
      expect(s[k]).toBeUndefined();
    }
  });
  it('drops empty values', () => {
    expect(translateScraperSpecs({ color: '  ' })).toEqual({});
  });
});

describe('mapScraperIdentifiers', () => {
  it('keeps a valid UPC and moves part number to MPN', () => {
    expect(mapScraperIdentifiers(content().identifiers, 'Mobil')).toMatchObject({ upc: '071924414402', mpn: 'M1-113A-2PK', model: 'M1-113A-2PK' });
  });
  it('turns a 13-digit GTIN into an EAN', () => {
    expect(mapScraperIdentifiers({ gtin: '4006381333931' }, null)).toMatchObject({ ean: '4006381333931' });
  });
  it('drops a barcode-shaped part number and an invalid UPC', () => {
    expect(mapScraperIdentifiers({ part_number: '071924414402', upc: '123' }, null)).toEqual({});
  });
  it('accepts no barcode at all', () => {
    expect(mapScraperIdentifiers({}, 'Mobil')).toEqual({});
  });
});

describe('mapScraperProduct', () => {
  it('builds ProductData with the path Keepa would build', () => {
    const p = mapScraperProduct('B077PVLBZ4', content(), commerce, AmazonMarketplace.AMAZON_US);
    expect(p.categoryPath).toBe('Automotive > Replacement Parts > Filters > Oil Filters & Accessories > Oil Filters');
    expect(p.category).toBe('Oil Filters');
    expect(p.price).toEqual({ current: 26, currency: 'USD' });
    expect(p.stock).toBe(20);
    expect(p.stockStatus).toBe(SourceStockStatus.AT_LEAST);
    expect(p.maxOrderQuantity).toBe(30);
    expect(p.features).toEqual(['a', 'b']);
    expect(p.imageUrls).toHaveLength(1);
  });
  it('never uses A+ text as the description', () => {
    expect(mapScraperProduct('B077PVLBZ4', content({ description: null }), commerce, AmazonMarketplace.AMAZON_US).description).toBe('');
  });
  it('stores raw content including A+ for later', () => {
    const p = mapScraperProduct('B077PVLBZ4', content(), commerce, AmazonMarketplace.AMAZON_US);
    expect((p.raw as { content: ScraperContent }).content.aplusRaw).toBe('Add to Cart $14.99');
  });
  it('UNKNOWN stock on create persists as out of stock 0', () => {
    const p = mapScraperProduct('B077PVLBZ4', content(), { ...commerce, stockStatus: SourceStockStatus.UNKNOWN, stock: null }, AmazonMarketplace.AMAZON_US);
    expect(p.stock).toBe(0);
    expect(p.stockStatus).toBe(SourceStockStatus.OUT_OF_STOCK);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api test -- source-content-mapper`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`source-content-mapper.ts`:

```ts
import {
  AMAZON_MARKETPLACE_CONFIG,
  SourceStockStatus,
  type AmazonMarketplace,
  type ProductData,
  type ProductIdentifiers,
  type ScraperContent,
  type SourceCommerce,
} from '@repo/shared';

import { isValidGtin, normalizeGtin } from '../../common/utils/gtin';

import { asPartNumber } from './keepa-normalizer';

/**
 * Scraper spec keys (snake_case from the page's overview/details tables) →
 * the canonical names `extractProductAttributes` produces for Keepa, so the
 * ONE aspect matcher (synonyms, learned defaults, priors) sees the same names
 * whichever provider filled the row. Unknown keys are Title-Cased and still
 * reach eBay as custom item specifics.
 */
const CANONICAL: Record<string, string> = {
  brand: 'Brand', brand_name: 'Brand', manufacturer: 'Manufacturer', color: 'Color', colour: 'Color',
  size: 'Size', material: 'Material', material_type: 'Material', style: 'Style', pattern: 'Pattern',
  scent: 'Scent', item_form: 'Item Form', item_weight: 'Item Weight', item_length: 'Item Length',
  item_width: 'Item Width', item_height: 'Item Height', number_of_items: 'Number of Items',
  number_of_pieces: 'Number of Items', unit_count: 'Unit Quantity', package_quantity: 'Package Quantity',
  included_components: 'Included Components', age_range: 'Age Range', age_range_description: 'Age Range',
  department: 'Department', item_type_name: 'Type', special_feature: 'Features', special_features: 'Features',
  recommended_uses_for_product: 'Recommended Uses', specific_uses_for_product: 'Specific Uses',
  ingredients: 'Ingredients', active_ingredients: 'Active Ingredients', safety_warning: 'Safety Warning',
  product_benefits: 'Product Benefit', item_highlight: 'Highlights', batteries_included: 'Batteries Included',
  batteries_required: 'Batteries Required', language: 'Language', format: 'Format', edition: 'Edition',
  author: 'Author', number_of_pages: 'Number of Pages',
};

/** Page noise, and fields that belong in `identifiers` rather than specs. */
const DROP = new Set([
  'asin', 'customer_reviews', 'best_sellers_rank', 'date_first_available', 'is_discontinued_by_manufacturer',
  'upc', 'ean', 'gtin', 'isbn', 'global_trade_identification_number', 'manufacturer_part_number',
  'model_number', 'part_number', 'item_model_number',
]);

function titleCase(key: string): string {
  return key.split('_').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

export function translateScraperSpecs(raw: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw ?? {})) {
    const k = key.trim().toLowerCase();
    const v = typeof value === 'string' ? value.trim() : '';
    if (!v || DROP.has(k)) {
      continue;
    }
    const name = CANONICAL[k] ?? titleCase(k);
    if (!out[name]) {
      out[name] = v;
    }
  }
  return out;
}

export function mapScraperIdentifiers(raw: Record<string, string>, brand: string | null): ProductIdentifiers {
  const ids: ProductIdentifiers = {};
  const upc = normalizeGtin(raw.upc);
  if (upc && isValidGtin(upc) && upc.length === 12) {
    ids.upc = upc;
  }
  const gtin = normalizeGtin(raw.gtin ?? raw.ean);
  if (gtin && isValidGtin(gtin)) {
    if (gtin.length === 13) {
      ids.ean = gtin;
    } else if (gtin.length === 14 && !ids.upc) {
      ids.gtin = gtin;
    }
  }
  const mpn = asPartNumber(raw.part_number ?? raw.manufacturer_part_number ?? null, brand);
  if (mpn) {
    ids.mpn = mpn;
  }
  const model = asPartNumber(raw.model_number ?? null, brand);
  if (model) {
    ids.model = model;
  }
  return ids;
}

export function mapScraperProduct(
  asin: string,
  content: ScraperContent,
  commerce: SourceCommerce,
  marketplace: AmazonMarketplace,
): ProductData {
  const categories = (content.categories ?? []).map((c) => c.trim()).filter(Boolean);
  // Create path only: a brand-new product has no previous value to preserve,
  // so UNKNOWN is stored as out-of-stock 0 (the worker refuses to publish at
  // quantity 0). Same rule Keepa's create path applies.
  const unknown = commerce.stockStatus === SourceStockStatus.UNKNOWN;
  return {
    asin,
    title: content.title?.trim() || 'Unknown Product',
    description: content.description?.trim() || '',
    imageUrls: content.images ?? [],
    brand: content.brand?.trim() || 'Unknown',
    manufacturer: content.manufacturer?.trim() || content.brand?.trim() || 'Unknown',
    category: categories[categories.length - 1],
    categoryPath: categories.length > 0 ? categories.join(' > ') : undefined,
    features: content.bullets ?? [],
    specs: translateScraperSpecs(content.specs ?? {}),
    identifiers: mapScraperIdentifiers(content.identifiers ?? {}, content.brand),
    price: { current: commerce.price ?? 0, currency: AMAZON_MARKETPLACE_CONFIG[marketplace].currency },
    stock: unknown ? 0 : (commerce.stock ?? 0),
    stockStatus: unknown ? SourceStockStatus.OUT_OF_STOCK : commerce.stockStatus,
    maxOrderQuantity: commerce.maxOrderQuantity,
    sourceRemoved: commerce.removed,
    raw: { provider: 'scraper', content, commerce } as unknown as Record<string, unknown>,
  };
}
```

`normalizeGtin`'s exact contract is in `common/utils/gtin.ts:39`. If it zero-pads or strips differently than the tests assume, adapt the length checks here, not the tests.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api test -- source-content-mapper`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/listings/source-content-mapper*.ts
git commit -m "feat(listings): map scraper content to ProductData with canonical spec names

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Scraper client and product-source service

**Files:**
- Create: `apps/api/src/modules/listings/scraper.client.ts`
- Create: `apps/api/src/modules/listings/product-source.service.ts`
- Create: `apps/api/src/modules/listings/product-source.service.spec.ts`
- Modify: `apps/api/src/modules/listings/listings.module.ts` (providers and exports)

**Interfaces:**
- Consumes: the Task 4 types and settings, `normalizeScraperCommerce` (Task 5), `mapScraperProduct` (Task 6).
- Produces:
  ```ts
  export class ScraperUnavailableError extends Error { name = 'ScraperUnavailableError' }
  @Injectable() export class ScraperClient {
    fetchProducts(req: ScraperProductsRequest): Promise<ScraperProductResult[]>; // throws ScraperUnavailableError
    getStats(): Promise<ScraperStats>;                                              // throws ScraperUnavailableError
  }
  export function parseProxyList(value: string | null): string[];
  export type CreateFetchResult =
    | { kind: 'product'; product: ProductData }
    | { kind: 'not_found' }
    | { kind: 'unavailable'; outcome: SourceFetchOutcome };
  @Injectable() export class ProductSourceService {
    activeProvider(): Promise<ProductDataProviderKind>;
    proxies(): Promise<string[]>;
    fetchForCreate(asins: string[], marketplace: AmazonMarketplace): Promise<Map<string, CreateFetchResult>>;
    fetchCommerce(asins: string[], marketplace: AmazonMarketplace): Promise<ScraperProductResult[]>;
  }
  ```

- [ ] **Step 1: Write the failing tests**

`product-source.service.spec.ts`:

```ts
import {
  AmazonMarketplace,
  PlatformSettingKey,
  ProductDataProviderKind,
  SourceFetchOutcome,
  type ScraperProductResult,
} from '@repo/shared';

import { ProductSourceService } from './product-source.service';
import { parseProxyList, type ScraperClient } from './scraper.client';

function service(settings: Partial<Record<PlatformSettingKey, string | number | null>>, results: ScraperProductResult[] = []) {
  const calls: unknown[] = [];
  const client = { fetchProducts: jest.fn(async (req) => { calls.push(req); return results; }) } as unknown as ScraperClient;
  const platformSettings = {
    getString: jest.fn(async (k: PlatformSettingKey) => (settings[k] ?? null) as string | null),
    getNumber: jest.fn(async (k: PlatformSettingKey) => Number(settings[k] ?? 0)),
  };
  return { svc: new ProductSourceService(platformSettings as never, client), calls };
}

const content = { title: 'T', brand: 'B', manufacturer: null, bullets: [], description: 'd', aplusRaw: null,
  images: ['https://m.media-amazon.com/images/I/x.jpg'], categories: ['A', 'B'], specs: {}, identifiers: {} };
const signals = { price: 10, currency: 'USD', availabilityText: 'In Stock', isInStock: true, onlyLeft: null,
  quantityMax: 30, buyboxSellerId: null, buyboxSellerName: null, soldByAmazon: null };

describe('parseProxyList', () => {
  it('splits on newlines and commas, trims, drops blanks and duplicates', () => {
    expect(parseProxyList('http://a:1\n http://b:2 ,http://a:1\n\n')).toEqual(['http://a:1', 'http://b:2']);
    expect(parseProxyList(null)).toEqual([]);
  });
});

describe('ProductSourceService', () => {
  it('defaults to scraper when the setting is empty', async () => {
    const { svc } = service({});
    expect(await svc.activeProvider()).toBe(ProductDataProviderKind.SCRAPER);
  });

  it('never calls the service without proxies', async () => {
    const { svc, calls } = service({ [PlatformSettingKey.SCRAPER_PROXIES]: '' });
    const out = await svc.fetchForCreate(['B000000001'], AmazonMarketplace.AMAZON_US);
    expect(calls).toHaveLength(0);
    expect(out.get('B000000001')).toEqual({ kind: 'unavailable', outcome: SourceFetchOutcome.NO_PROXY });
    const commerce = await svc.fetchCommerce(['B000000001'], AmazonMarketplace.AMAZON_US);
    expect(commerce[0].outcome).toBe(SourceFetchOutcome.NO_PROXY);
    expect(calls).toHaveLength(0);
  });

  it('maps a found full result to a product and a 404 to not_found', async () => {
    const { svc, calls } = service(
      { [PlatformSettingKey.SCRAPER_PROXIES]: 'http://u:p@h:1', [PlatformSettingKey.SCRAPER_PER_IP_RPS]: 1, [PlatformSettingKey.SCRAPER_IN_STOCK_FLOOR]: 20 },
      [
        { asin: 'B000000001', outcome: SourceFetchOutcome.FOUND, fetchedAt: 't', signals, content },
        { asin: 'B000000002', outcome: SourceFetchOutcome.NOT_FOUND, fetchedAt: 't', signals: null, content: null },
      ],
    );
    const out = await svc.fetchForCreate(['B000000001', 'B000000002'], AmazonMarketplace.AMAZON_US);
    expect(out.get('B000000001')).toMatchObject({ kind: 'product', product: { title: 'T', stock: 20 } });
    expect(out.get('B000000002')).toEqual({ kind: 'not_found' });
    expect(calls[0]).toMatchObject({ mode: 'full', lane: 'interactive', proxies: ['http://u:p@h:1'] });
  });

  it('blocked, parse_failed and missing results are unavailable, never not_found', async () => {
    const { svc } = service({ [PlatformSettingKey.SCRAPER_PROXIES]: 'http://h:1' }, [
      { asin: 'B000000001', outcome: SourceFetchOutcome.BLOCKED, fetchedAt: null, signals: null, content: null },
      { asin: 'B000000002', outcome: SourceFetchOutcome.PARSE_FAILED, fetchedAt: null, signals: null, content: null },
    ]);
    const out = await svc.fetchForCreate(['B000000001', 'B000000002', 'B000000003'], AmazonMarketplace.AMAZON_US);
    expect(out.get('B000000001')).toEqual({ kind: 'unavailable', outcome: SourceFetchOutcome.BLOCKED });
    expect(out.get('B000000002')).toEqual({ kind: 'unavailable', outcome: SourceFetchOutcome.PARSE_FAILED });
    expect(out.get('B000000003')).toEqual({ kind: 'unavailable', outcome: SourceFetchOutcome.BLOCKED });
  });

  it('chunks commerce requests at 100 ASINs and uses the background lane', async () => {
    const { svc, calls } = service({ [PlatformSettingKey.SCRAPER_PROXIES]: 'http://h:1' });
    const asins = Array.from({ length: 150 }, (_, i) => `B${String(i).padStart(9, '0')}`);
    await svc.fetchCommerce(asins, AmazonMarketplace.AMAZON_US);
    expect(calls).toHaveLength(2);
    expect(calls[0]).toMatchObject({ mode: 'commerce', lane: 'background' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api test -- product-source`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `scraper.client.ts`**

```ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ScraperProductResult, ScraperProductsRequest, ScraperStats } from '@repo/shared';
import axios from 'axios';

/** The scraper service could not be reached or answered with an error. Retryable. */
export class ScraperUnavailableError extends Error {
  override name = 'ScraperUnavailableError';
}

/** Newline/comma-separated proxy URLs from the `scraper.proxies` setting. */
export function parseProxyList(value: string | null): string[] {
  return [...new Set((value ?? '').split(/[\n,]/).map((p) => p.trim()).filter(Boolean))];
}

const REQUEST_TIMEOUT_MS = 200_000; // service resolves each ASIN by its own 150 s deadline

@Injectable()
export class ScraperClient {
  private readonly logger = new Logger(ScraperClient.name);

  constructor(private readonly config: ConfigService) {}

  private base(): { url: string; secret: string } {
    const url = this.config.get<string>('SCRAPER_SERVICE_URL') ?? '';
    const secret = this.config.get<string>('SCRAPER_SERVICE_SECRET') ?? '';
    if (!url || !secret) {
      throw new ScraperUnavailableError('SCRAPER_SERVICE_URL / SCRAPER_SERVICE_SECRET not configured');
    }
    return { url: url.replace(/\/$/, ''), secret };
  }

  async fetchProducts(req: ScraperProductsRequest): Promise<ScraperProductResult[]> {
    const { url, secret } = this.base();
    try {
      const res = await axios.post<{ results: ScraperProductResult[] }>(`${url}/v1/products`, req, {
        headers: { 'X-Scraper-Secret': secret },
        timeout: REQUEST_TIMEOUT_MS,
      });
      return res.data?.results ?? [];
    } catch (error: unknown) {
      // Never log the request body: it carries proxy credentials.
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      this.logger.error(`Scraper request failed (${req.asins.length} ASINs, status ${status ?? 'network'})`);
      throw new ScraperUnavailableError(`scraper request failed: ${status ?? 'network'}`);
    }
  }

  async getStats(): Promise<ScraperStats> {
    const { url, secret } = this.base();
    try {
      const res = await axios.get<ScraperStats>(`${url}/v1/stats`, { headers: { 'X-Scraper-Secret': secret }, timeout: 5000 });
      return res.data;
    } catch {
      throw new ScraperUnavailableError('scraper stats unavailable');
    }
  }
}
```

- [ ] **Step 4: Implement `product-source.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import {
  PlatformSettingKey,
  ProductDataProviderKind,
  ScraperFetchMode,
  ScraperLane,
  SourceFetchOutcome,
  type AmazonMarketplace,
  type ProductData,
  type ScraperProductResult,
} from '@repo/shared';

import { PlatformSettingsService } from '../../common/settings/platform-settings.service';

import { chunkAsins, dedupeAsins } from './keepa-normalizer';
import { ScraperClient, parseProxyList } from './scraper.client';
import { mapScraperProduct } from './source-content-mapper';
import { normalizeScraperCommerce } from './source-product-normalizer';

export type CreateFetchResult =
  | { kind: 'product'; product: ProductData }
  | { kind: 'not_found' }
  | { kind: 'unavailable'; outcome: SourceFetchOutcome };

const MAX_ASINS_PER_REQUEST = 100;

/** Provider switch and the scraper-side fetches. Keepa code is untouched and
 * called by its existing call sites when the active provider is `keepa`. */
@Injectable()
export class ProductSourceService {
  constructor(
    private readonly platformSettings: PlatformSettingsService,
    private readonly client: ScraperClient,
  ) {}

  async activeProvider(): Promise<ProductDataProviderKind> {
    const value = await this.platformSettings.getString(PlatformSettingKey.PRODUCT_DATA_PROVIDER);
    return value === ProductDataProviderKind.KEEPA ? ProductDataProviderKind.KEEPA : ProductDataProviderKind.SCRAPER;
  }

  async proxies(): Promise<string[]> {
    return parseProxyList(await this.platformSettings.getString(PlatformSettingKey.SCRAPER_PROXIES));
  }

  async fetchForCreate(asins: string[], marketplace: AmazonMarketplace): Promise<Map<string, CreateFetchResult>> {
    const results = await this.fetch(asins, marketplace, ScraperFetchMode.FULL, ScraperLane.INTERACTIVE);
    const floor = await this.platformSettings.getNumber(PlatformSettingKey.SCRAPER_IN_STOCK_FLOOR);
    const byAsin = new Map(results.map((r) => [r.asin, r]));
    const out = new Map<string, CreateFetchResult>();
    for (const asin of dedupeAsins(asins)) {
      const r = byAsin.get(asin);
      if (!r) {
        out.set(asin, { kind: 'unavailable', outcome: SourceFetchOutcome.BLOCKED });
        continue;
      }
      if (r.outcome === SourceFetchOutcome.NOT_FOUND) {
        out.set(asin, { kind: 'not_found' });
        continue;
      }
      const observation = normalizeScraperCommerce(r, floor);
      if (r.outcome !== SourceFetchOutcome.FOUND || !r.content || observation.kind !== 'observed') {
        out.set(asin, { kind: 'unavailable', outcome: r.outcome === SourceFetchOutcome.FOUND ? SourceFetchOutcome.PARSE_FAILED : r.outcome });
        continue;
      }
      out.set(asin, { kind: 'product', product: mapScraperProduct(asin, r.content, observation.commerce, marketplace) });
    }
    return out;
  }

  fetchCommerce(asins: string[], marketplace: AmazonMarketplace): Promise<ScraperProductResult[]> {
    return this.fetch(asins, marketplace, ScraperFetchMode.COMMERCE, ScraperLane.BACKGROUND);
  }

  private async fetch(asins: string[], marketplace: AmazonMarketplace, mode: ScraperFetchMode, lane: ScraperLane): Promise<ScraperProductResult[]> {
    const unique = dedupeAsins(asins);
    const proxies = await this.proxies();
    if (proxies.length === 0) {
      // No proxy → no request. The server's own IP is never used.
      return unique.map((asin) => ({ asin, outcome: SourceFetchOutcome.NO_PROXY, fetchedAt: null, signals: null, content: null }));
    }
    const rate = await this.platformSettings.getNumber(PlatformSettingKey.SCRAPER_PER_IP_RPS);
    const out: ScraperProductResult[] = [];
    for (const chunk of chunkAsins(unique, MAX_ASINS_PER_REQUEST)) {
      out.push(...(await this.client.fetchProducts({
        marketplace: marketplaceCountry(marketplace), asins: chunk, mode, lane, proxies, perIpRequestsPerSecond: rate,
      })));
    }
    return out;
  }
}

function marketplaceCountry(marketplace: AmazonMarketplace): string {
  // AmazonMarketplace has one member today (AMAZON_US); the service keys marketplaces by country code.
  return marketplace.replace(/^AMAZON_/, '');
}
```

(`ScraperUnavailableError` from `fetchProducts` propagates on purpose: callers treat it as transport.)

Register `ScraperClient` and `ProductSourceService` in `listings.module.ts` `providers`, and add `ProductSourceService` and `ScraperClient` to `exports`, since `AdminModule` needs them in Task 12. Check `module-cycle.guard.spec.ts` stays green. If `AdminModule` cannot import `ListingsModule` without a cycle, move both providers into a new `ProductSourceModule` (`apps/api/src/modules/listings/product-source.module.ts`) that imports nothing but the global settings, and import that from both.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter api test -- product-source module-cycle`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/listings
git commit -m "feat(listings): scraper client and product-source switch; no proxy means no request

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Create and import paths use the active provider

**Files:**
- Modify: `apps/api/src/modules/listings/listing-processor.service.ts` (`resolveProductData` :553-619, `processListingBatch` :170-215)
- Modify: `apps/api/src/modules/listings/listings.service.ts` (`findOrCreateProduct` :1331-1400, `getProductByAsin` :1038-1096, `ProductQueryRow` type)
- Modify: `apps/api/src/modules/listings/listing-failure.ts` (:150-200)
- Modify: `apps/api/src/modules/listings/listing-failure.spec.ts`
- Modify: `packages/shared/src/i18n/resources/{en,tr}/listings.json` (`listings.jobs.failure`)
- Modify: `apps/web/src/features/listings/listing-jobs/details/ListingJobDetailsPage.container.tsx` (`failureLabel` :108-121)

**Interfaces:**
- Consumes: `ProductSourceService.activeProvider`, `fetchForCreate`, `CreateFetchResult` (Task 7).
- Produces:
  - `export class ProductDataUnavailableError extends Error { name = 'ProductDataUnavailableError' }`
  - `export class ZeroStockError extends Error { name = 'ZeroStockError'; amazonStock: number; amazonStockAtLeast: boolean; stockBuffer: number }`, both in `listing-processor.service.ts`
  - `resolveProductData(asin, userId, marketplace?, prefetched?: Map<string, CreateFetchResult>)`
  - `ProductData` from `getProductByAsin` now carries `stockStatus`, `maxOrderQuantity` and `sourceRemoved`

- [ ] **Step 1: Write the failing classifier tests**

Append to `listing-failure.spec.ts` (match the file's existing import of `classifyListingFailure`):

```ts
describe('scraper provider failures', () => {
  it('ProductDataUnavailableError is retryable PRODUCT_DATA_UNAVAILABLE, never ASIN_NOT_FOUND', () => {
    const e = Object.assign(new Error('scraper: blocked for B000000001'), { name: 'ProductDataUnavailableError' });
    expect(classifyListingFailure(e)).toMatchObject({ code: ListingFailureCode.PRODUCT_DATA_UNAVAILABLE, details: { retryable: true } });
  });
  it('ScraperUnavailableError is retryable PRODUCT_DATA_UNAVAILABLE', () => {
    const e = Object.assign(new Error('scraper request failed: network'), { name: 'ScraperUnavailableError' });
    expect(classifyListingFailure(e)).toMatchObject({ code: ListingFailureCode.PRODUCT_DATA_UNAVAILABLE, details: { retryable: true } });
  });
  it('ZeroStockError carries the stock numbers for the seller message', () => {
    const e = Object.assign(new Error('Cannot list ASIN B000000001: Stock is 0.'), {
      name: 'ZeroStockError', amazonStock: 4, amazonStockAtLeast: true, stockBuffer: 5,
    });
    expect(classifyListingFailure(e)).toMatchObject({
      code: ListingFailureCode.ZERO_STOCK,
      details: { retryable: true, amazonStock: 4, amazonStockAtLeast: true, stockBuffer: 5 },
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api test -- listing-failure`
Expected: the three new tests FAIL.

- [ ] **Step 3: Implement the classifier cases**

In `listing-failure.ts`, before the `AsinNotFoundError` check, add:

```ts
  if (name === 'ProductDataUnavailableError' || name === 'ScraperUnavailableError') {
    return { code: ListingFailureCode.PRODUCT_DATA_UNAVAILABLE, message: raw, details: { retryable: true } };
  }
  if (name === 'ZeroStockError') {
    const e = error as Error & { amazonStock?: number; amazonStockAtLeast?: boolean; stockBuffer?: number };
    return {
      code: ListingFailureCode.ZERO_STOCK,
      message: raw,
      details: { retryable: true, amazonStock: e.amazonStock, amazonStockAtLeast: e.amazonStockAtLeast, stockBuffer: e.stockBuffer },
    };
  }
```

If the classifier's input variable is not named `error`, use whatever the function receives. Read how `name` is derived at the top of the function. Keep the `/Stock is 0/` regex branch for rows written by older builds.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api test -- listing-failure`
Expected: PASS.

- [ ] **Step 5: Branch `resolveProductData` on the provider**

In `listing-processor.service.ts`:

1. Import `ProductDataProviderKind`, `SourceFetchOutcome`, `SourceStockStatus` from `@repo/shared` and `ProductSourceService`, `type CreateFetchResult` from `./product-source.service`; inject `ProductSourceService` in the constructor.
2. Add the two error classes near `AsinNotFoundError`:

```ts
/** Scraper could not produce data for this ASIN (blocked, no proxy, unreadable page). Retryable. */
export class ProductDataUnavailableError extends Error {
  override name = 'ProductDataUnavailableError';
  constructor(asin: string, outcome: string) {
    super(`scraper: ${outcome} for ${asin}`);
  }
}

/** Buffer or stock drove a live create to quantity 0. Carries the numbers the seller message shows. */
export class ZeroStockError extends Error {
  override name = 'ZeroStockError';
  constructor(
    asin: string,
    readonly amazonStock: number,
    readonly amazonStockAtLeast: boolean,
    readonly stockBuffer: number,
  ) {
    super(`Cannot list ASIN ${asin}: Stock is 0. Amazon stock (${amazonStockAtLeast ? 'at least ' : ''}${amazonStock}) minus buffer ${stockBuffer}.`);
  }
}
```

3. Change the signature to `resolveProductData(asin, userId, marketplace = AmazonMarketplace.AMAZON_US, prefetched?: Map<string, CreateFetchResult>)`.
4. Inside the transaction, after `cachedAfterLock` returns null, insert **before** the Keepa block:

```ts
      if ((await this.productSource.activeProvider()) === ProductDataProviderKind.SCRAPER) {
        const result =
          prefetched?.get(asin) ?? (await this.productSource.fetchForCreate([asin], marketplace)).get(asin);
        if (!result || result.kind === 'unavailable') {
          throw new ProductDataUnavailableError(asin, result?.outcome ?? SourceFetchOutcome.BLOCKED);
        }
        if (result.kind === 'not_found' || !result.product.title || result.product.title === 'Unknown Product') {
          throw new AsinNotFoundError(asin);
        }
        const productId = await this.listingsService.findOrCreateProduct(asin, result.product, marketplace);
        return { productData: result.product, productId };
      }
```

The existing Keepa code below stays byte-identical.

- [ ] **Step 6: Prefetch the batch and throw `ZeroStockError`**

In `processListingBatch`, before the `for (const item of items)` loop:

```ts
    // Scraper: fetch every uncached ASIN of this batch in ONE service call
    // (parallel across proxies) instead of one page per loop iteration.
    let prefetched: Map<string, CreateFetchResult> | undefined;
    if ((await this.productSource.activeProvider()) === ProductDataProviderKind.SCRAPER) {
      const uncached: string[] = [];
      for (const item of items) {
        if (!this.asUsableCache(await this.listingsService.getProductByAsin(item.asin))) {
          uncached.push(item.asin);
        }
      }
      if (uncached.length > 0) {
        prefetched = await this.productSource.fetchForCreate(uncached, AmazonMarketplace.AMAZON_US).catch(() => undefined);
      }
    }
```

A `ScraperUnavailableError` there leaves `prefetched` undefined. Each item then retries individually and fails through the classifier.

Pass it on: `await this.resolveProductData(item.asin, userId, AmazonMarketplace.AMAZON_US, prefetched)`.

Replace the zero-stock `throw new Error(...)` at :208-213 with:

```ts
        if (!asDraft && listingData.quantity === 0) {
          const group = await this.listingStrategyService.getSettingsGroup(userId, listingSettingsGroupId);
          throw new ZeroStockError(
            item.asin,
            productData.stock ?? 0,
            productData.stockStatus === SourceStockStatus.AT_LEAST,
            group.stock?.stockBuffer ?? 0,
          );
        }
```

- [ ] **Step 7: Persist and read the new columns**

In `listings.service.ts` `findOrCreateProduct`:
- Add `stock_status, max_order_quantity, source_removed_at` to the INSERT column list.
- Add `$19, $20, CASE WHEN $21::boolean THEN NOW() ELSE NULL END` to `VALUES`.
- Add to `ON CONFLICT ... DO UPDATE SET`:

```sql
        stock_status = EXCLUDED.stock_status,
        max_order_quantity = EXCLUDED.max_order_quantity,
        source_removed_at = CASE WHEN $21::boolean THEN COALESCE(products.source_removed_at, NOW()) ELSE NULL END,
```

- Add these parameters:

```ts
        productData.stockStatus ?? SourceStockStatus.EXACT,
        productData.maxOrderQuantity ?? null,
        productData.sourceRemoved === true,
```

In `getProductByAsin`:
- Add `stock_status, max_order_quantity, source_removed_at` to the SELECT and to `ProductQueryRow`.
- Map them:

```ts
      stockStatus: (row.stock_status as SourceStockStatus) ?? SourceStockStatus.EXACT,
      maxOrderQuantity: row.max_order_quantity ?? null,
      sourceRemoved: row.source_removed_at !== null && row.source_removed_at !== undefined,
```

- [ ] **Step 8: Update the failure message (EN + TR) and the label**

In `listings.json` under `listings.jobs.failure`, keep `zero_stock` and add:

EN:

```json
"zero_stock_detail": "Amazon stock ({{stock}}) is below your stock buffer ({{buffer}}), so the quantity would be 0.",
"zero_stock_detail_at_least": "Amazon stock (at least {{stock}}) is below your stock buffer ({{buffer}}), so the quantity would be 0."
```

TR:

```json
"zero_stock_detail": "Amazon stoğu ({{stock}}) güvenlik payınızdan ({{buffer}}) az, miktar 0 olurdu.",
"zero_stock_detail_at_least": "Amazon stoğu (en az {{stock}}) güvenlik payınızdan ({{buffer}}) az, miktar 0 olurdu."
```

In `ListingJobDetailsPage.container.tsx` `failureLabel`, choose the key before calling `t`:

```ts
      const d = item.failureDetails;
      const code =
        item.failureCode === ListingFailureCode.ZERO_STOCK && d?.amazonStock !== undefined
          ? d.amazonStockAtLeast ? 'zero_stock_detail_at_least' : 'zero_stock_detail'
          : item.failureCode;
      const path = `listings.jobs.failure.${code}`;
      const translated = t(path, {
        aspects: (d?.aspectNames ?? []).join(', '),
        keyword: d?.blacklistedKeyword ?? '',
        stock: d?.amazonStock ?? '',
        buffer: d?.stockBuffer ?? '',
      });
```

Import `ListingFailureCode` from `@repo/shared` if the file does not already.

- [ ] **Step 9: Build, test, typecheck**

```bash
pnpm --filter @repo/shared build
pnpm --filter api test
pnpm --filter api exec tsc --noEmit -p tsconfig.json
```

Expected: all API tests pass (including `create-only-ai.guard.spec.ts`, `listing-invariants.guard.spec.ts`, `eps-image-invariants.guard.spec.ts`), and no new type errors.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/modules/listings packages/shared/src/i18n apps/web/src/features/listings/listing-jobs
git commit -m "feat(listings): create/import read from the active provider; batch prefetch; stock-aware zero-stock reason

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Quantity formula respects the order limit

**Files:**
- Modify: `apps/api/src/modules/listings/listing-strategy.service.ts` (`calculateQuantity` :382, callers :124-125 and :202)
- Create: `apps/api/src/modules/listings/calculate-quantity.spec.ts`

**Interfaces:**
- Produces: `calculateQuantity(amazonStock: number, group: Pick<ListingSettingsGroup, 'stock'>, maxOrderQuantity?: number | null): number`

- [ ] **Step 1: Write the failing tests**

`calculate-quantity.spec.ts`:

```ts
import { ListingStrategyService } from './listing-strategy.service';

const svc = Object.create(ListingStrategyService.prototype) as ListingStrategyService;
const group = (defaultQuantity: number, stockBuffer: number) => ({ stock: { defaultQuantity, stockBuffer } }) as never;

describe('calculateQuantity', () => {
  it('unchanged without an order limit', () => {
    expect(svc.calculateQuantity(20, group(3, 5))).toBe(3);
    expect(svc.calculateQuantity(6, group(3, 5))).toBe(1);
    expect(svc.calculateQuantity(5, group(3, 5))).toBe(0);
  });
  it('the order limit caps the listed quantity', () => {
    expect(svc.calculateQuantity(20, group(10, 0), 4)).toBe(4);
  });
  it('a limit above defaultQuantity changes nothing', () => {
    expect(svc.calculateQuantity(20, group(3, 0), 30)).toBe(3);
  });
  it('spec example: limited In Stock (4), buffer 5 → 0', () => {
    expect(svc.calculateQuantity(4, group(1, 5), 4)).toBe(0);
  });
  it('null / non-positive limit is ignored', () => {
    expect(svc.calculateQuantity(20, group(3, 0), null)).toBe(3);
    expect(svc.calculateQuantity(20, group(3, 0), 0)).toBe(3);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api test -- calculate-quantity`
Expected: the "order limit caps" test FAILS (returns 10).

- [ ] **Step 3: Implement**

```ts
  calculateQuantity(
    amazonStock: number,
    group: Pick<ListingSettingsGroup, 'stock'>,
    maxOrderQuantity?: number | null,
  ): number {
    const defaultQuantity = group.stock?.defaultQuantity || 1;
    const stockBuffer = group.stock?.stockBuffer ?? 0;
    const cap = typeof maxOrderQuantity === 'number' && maxOrderQuantity > 0 ? maxOrderQuantity : Infinity;
    return Math.min(Math.max(amazonStock - stockBuffer, 0), defaultQuantity, cap);
  }
```

Update the JSDoc formula line to `quantity = min(max(amazonStock − buffer, 0), defaultQuantity, maxOrderQuantity)`. Explain in one sentence that one eBay order must fit one Amazon order.

Update both callers:
- `this.calculateQuantity(amazonStock, group, product.maxOrderQuantity)` at :125
- `this.calculateQuantity(product.stock ?? 0, resolved, product.maxOrderQuantity)` at :202

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api test -- calculate-quantity listing-strategy`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/listings/listing-strategy.service.ts apps/api/src/modules/listings/calculate-quantity.spec.ts
git commit -m "feat(listings): cap listed quantity at the Amazon per-order limit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Refresh worker scraper branch

**Files:**
- Create: `apps/api/src/modules/listings/scraper-refresh.ts`, `apps/api/src/modules/listings/scraper-refresh.spec.ts`
- Modify: `apps/api/src/modules/listings/refresh-processor.service.ts`

**Interfaces:**
- Consumes: `normalizeScraperCommerce` (Task 5), `ProductSourceService` (Task 7).
- Produces:
  ```ts
  export function resolveScraperRefreshBatchSize(input: { proxyCount: number; perIpRequestsPerSecond: number; reservePercent: number; min: number; max: number }): number;
  export interface RefreshRowState { price: number | null; stock: number | null; stockStatus: SourceStockStatus; maxOrderQuantity: number | null; removed: boolean }
  export type ScraperRefreshPlan =
    | { kind: 'skip' }
    | { kind: 'data_failure' }
    | { kind: 'observed'; price: number | null; stock: number | null; stockStatus: SourceStockStatus | null; maxOrderQuantity: number | null; keepMaxOrderQuantity: boolean; removed: boolean; commerceChanged: boolean };
  export function planScraperRefresh(row: RefreshRowState, result: ScraperProductResult | undefined, inStockFloor: number): ScraperRefreshPlan;
  export function keepaStockStatusToSource(status: KeepaStockStatus): SourceStockStatus | null;
  ```

- [ ] **Step 1: Write the failing tests**

`scraper-refresh.spec.ts`:

```ts
import { KeepaStockStatus, SourceFetchOutcome, SourceStockStatus, type ScraperProductResult } from '@repo/shared';

import { keepaStockStatusToSource, planScraperRefresh, resolveScraperRefreshBatchSize } from './scraper-refresh';

const row = { price: 10, stock: 20, stockStatus: SourceStockStatus.AT_LEAST, maxOrderQuantity: 30, removed: false };
const found = (over = {}): ScraperProductResult => ({
  asin: 'B000000001', outcome: SourceFetchOutcome.FOUND, fetchedAt: 't', content: null,
  signals: { price: 10, currency: 'USD', availabilityText: 'In Stock', isInStock: true, onlyLeft: null, quantityMax: 30,
    buyboxSellerId: null, buyboxSellerName: null, soldByAmazon: null, ...over },
});

describe('resolveScraperRefreshBatchSize', () => {
  it('rate × proxies × 60 × (1 − reserve), floored and clamped', () => {
    expect(resolveScraperRefreshBatchSize({ proxyCount: 5, perIpRequestsPerSecond: 1, reservePercent: 20, min: 1, max: 1000 })).toBe(240);
    expect(resolveScraperRefreshBatchSize({ proxyCount: 0, perIpRequestsPerSecond: 1, reservePercent: 20, min: 1, max: 1000 })).toBe(1);
    expect(resolveScraperRefreshBatchSize({ proxyCount: 50, perIpRequestsPerSecond: 10, reservePercent: 0, min: 1, max: 1000 })).toBe(1000);
  });
});

describe('planScraperRefresh', () => {
  it('missing, blocked or no-proxy result → skip (lease expiry retries)', () => {
    expect(planScraperRefresh(row, undefined, 20)).toEqual({ kind: 'skip' });
    expect(planScraperRefresh(row, { ...found(), outcome: SourceFetchOutcome.BLOCKED, signals: null }, 20)).toEqual({ kind: 'skip' });
  });
  it('parse failure → data_failure', () => {
    expect(planScraperRefresh(row, { ...found(), outcome: SourceFetchOutcome.PARSE_FAILED, signals: null }, 20)).toEqual({ kind: 'data_failure' });
  });
  it('same state → observed, no commerce change', () => {
    expect(planScraperRefresh(row, found(), 20)).toMatchObject({ kind: 'observed', commerceChanged: false });
  });
  it('stock drop to Only 3 left → change', () => {
    expect(planScraperRefresh(row, found({ onlyLeft: 3 }), 20)).toMatchObject({ stock: 3, stockStatus: SourceStockStatus.EXACT, commerceChanged: true });
  });
  it('order limit change alone → change (it moves the listed quantity)', () => {
    expect(planScraperRefresh(row, found({ quantityMax: 4 }), 20)).toMatchObject({ maxOrderQuantity: 4, commerceChanged: true });
  });
  it('status-only change (EXACT 20 → AT_LEAST 20) → no fan-out', () => {
    expect(planScraperRefresh({ ...row, stockStatus: SourceStockStatus.EXACT }, found(), 20)).toMatchObject({ stockStatus: SourceStockStatus.AT_LEAST, commerceChanged: false });
  });
  it('missing price keeps the previous price', () => {
    expect(planScraperRefresh(row, found({ price: null }), 20)).toMatchObject({ price: 10, commerceChanged: false });
  });
  it('404 → stock 0, removed, change', () => {
    expect(planScraperRefresh(row, { ...found(), outcome: SourceFetchOutcome.NOT_FOUND, signals: null }, 20)).toMatchObject({ stock: 0, removed: true, commerceChanged: true });
  });
  it('coming back after 404 clears removed', () => {
    expect(planScraperRefresh({ ...row, stock: 0, removed: true, stockStatus: SourceStockStatus.OUT_OF_STOCK }, found(), 20)).toMatchObject({ removed: false, stock: 20, commerceChanged: true });
  });
  it('UNKNOWN keeps previous stock, status and limit', () => {
    expect(planScraperRefresh(row, found({ isInStock: null, availabilityText: null }), 20)).toMatchObject({ stock: 20, stockStatus: null, keepMaxOrderQuantity: true, commerceChanged: false });
  });
});

describe('keepaStockStatusToSource (rollback path)', () => {
  it('KNOWN → exact, OUT_OF_STOCK → out_of_stock, UNKNOWN → null (keep)', () => {
    expect(keepaStockStatusToSource(KeepaStockStatus.KNOWN)).toBe(SourceStockStatus.EXACT);
    expect(keepaStockStatusToSource(KeepaStockStatus.OUT_OF_STOCK)).toBe(SourceStockStatus.OUT_OF_STOCK);
    expect(keepaStockStatusToSource(KeepaStockStatus.UNKNOWN)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api test -- scraper-refresh`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `scraper-refresh.ts`**

```ts
import { KeepaStockStatus, SourceStockStatus, type ScraperProductResult } from '@repo/shared';

import { normalizeScraperCommerce } from './source-product-normalizer';

/**
 * Products claimed per 1-minute tick under the scraper provider. The tick
 * rate is fixed, so this IS the refresh throughput; the reserve keeps
 * headroom for seller-triggered creates (interactive lane).
 */
export function resolveScraperRefreshBatchSize(input: {
  proxyCount: number; perIpRequestsPerSecond: number; reservePercent: number; min: number; max: number;
}): number {
  const raw = Math.floor(input.perIpRequestsPerSecond * input.proxyCount * 60 * (1 - input.reservePercent / 100));
  return Math.min(Math.max(raw, input.min), input.max);
}

export interface RefreshRowState {
  price: number | null;
  stock: number | null;
  stockStatus: SourceStockStatus;
  maxOrderQuantity: number | null;
  removed: boolean;
}

export type ScraperRefreshPlan =
  | { kind: 'skip' }
  | { kind: 'data_failure' }
  | {
      kind: 'observed';
      price: number | null;
      stock: number | null;
      /** null = keep the stored status (observation was UNKNOWN). */
      stockStatus: SourceStockStatus | null;
      maxOrderQuantity: number | null;
      keepMaxOrderQuantity: boolean;
      removed: boolean;
      /** Price, stock or order limit moved → recompute and push listings. */
      commerceChanged: boolean;
    };

export function planScraperRefresh(
  row: RefreshRowState,
  result: ScraperProductResult | undefined,
  inStockFloor: number,
): ScraperRefreshPlan {
  if (!result) {
    return { kind: 'skip' };
  }
  const observation = normalizeScraperCommerce(result, inStockFloor);
  if (observation.kind === 'transport') {
    return { kind: 'skip' };
  }
  if (observation.kind === 'data_failure') {
    return { kind: 'data_failure' };
  }
  const c = observation.commerce;
  const unknown = c.stockStatus === SourceStockStatus.UNKNOWN;
  const price = c.price ?? row.price;
  const stock = unknown ? row.stock : c.stock;
  const maxOrderQuantity = unknown ? row.maxOrderQuantity : c.maxOrderQuantity;
  const commerceChanged =
    (price !== null && price !== row.price) ||
    (stock !== null && Number(stock) !== Number(row.stock ?? 0)) ||
    maxOrderQuantity !== row.maxOrderQuantity ||
    c.removed !== row.removed;
  return {
    kind: 'observed',
    price,
    stock,
    stockStatus: unknown ? null : c.stockStatus,
    maxOrderQuantity,
    keepMaxOrderQuantity: unknown,
    removed: c.removed,
    commerceChanged,
  };
}

export function keepaStockStatusToSource(status: KeepaStockStatus): SourceStockStatus | null {
  if (status === KeepaStockStatus.KNOWN) {
    return SourceStockStatus.EXACT;
  }
  if (status === KeepaStockStatus.OUT_OF_STOCK) {
    return SourceStockStatus.OUT_OF_STOCK;
  }
  return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api test -- scraper-refresh`
Expected: PASS.

- [ ] **Step 5: Wire it into `refresh-processor.service.ts`**

1. Inject `ProductSourceService`. Import `ProductDataProviderKind`, `SourceStockStatus`, `type ScraperProductResult` from `@repo/shared` and `planScraperRefresh`, `resolveScraperRefreshBatchSize`, `keepaStockStatusToSource`, `type ScraperRefreshPlan` from `./scraper-refresh`.
2. Extend `ProductRow` with `stock_status: string; max_order_quantity: number | null; source_removed_at: Date | null;` and the SELECT in `refreshBatch` with `stock_status, max_order_quantity, source_removed_at`.
3. **`selectRefreshBatch`**: after the kill switch, add:

```ts
    const provider = await this.productSource.activeProvider();
    if (provider === ProductDataProviderKind.SCRAPER && (await this.productSource.proxies()).length === 0) {
      this.logger.warn('Scraper provider active but no proxies configured — refresh paused (prices/stock kept).');
      return;
    }
```

4. **`resolveBatchSize`**: at the top, add:

```ts
    if ((await this.productSource.activeProvider()) === ProductDataProviderKind.SCRAPER) {
      const [proxies, rate, reservePercent] = await Promise.all([
        this.productSource.proxies(),
        this.platformSettings.getNumber(PlatformSettingKey.SCRAPER_PER_IP_RPS),
        this.platformSettings.getNumber(PlatformSettingKey.KEEPA_REFRESH_RESERVE_PERCENT),
      ]);
      return resolveScraperRefreshBatchSize({ proxyCount: proxies.length, perIpRequestsPerSecond: rate, reservePercent, min: 1, max: 1000 });
    }
```

5. **`refreshBatch`**: right after `products` is loaded and non-empty:

```ts
    if ((await this.productSource.activeProvider()) === ProductDataProviderKind.SCRAPER) {
      await this.refreshBatchViaScraper(products);
      return;
    }
```

6. **Add the method:**

```ts
  /**
   * Scraper refresh: commerce-mode fetch (lean parse), then per-product plan.
   * The claim/lease/backoff/fan-out machinery is the same as Keepa's.
   * A service outage throws ScraperUnavailableError → BullMQ retries the batch.
   * A per-ASIN block is skipped: the claim lease expires and the product
   * becomes due again, and consecutive_failures does not grow for something
   * that is not the product's fault.
   */
  private async refreshBatchViaScraper(products: ProductRow[]): Promise<void> {
    const floor = await this.platformSettings.getNumber(PlatformSettingKey.SCRAPER_IN_STOCK_FLOOR);
    const byMarketplace = new Map<AmazonMarketplace, ProductRow[]>();
    for (const row of products) {
      const m = row.marketplace as AmazonMarketplace;
      byMarketplace.set(m, [...(byMarketplace.get(m) ?? []), row]);
    }
    const results = new Map<string, ScraperProductResult>();
    for (const [marketplace, group] of byMarketplace) {
      for (const r of await this.productSource.fetchCommerce(group.map((p) => p.asin), marketplace)) {
        results.set(r.asin, r);
      }
    }
    const pending: PendingListingUpdate[] = [];
    for (const row of products) {
      const plan = planScraperRefresh(
        {
          price: row.price?.current !== undefined ? Number(row.price.current) : null,
          stock: row.stock,
          stockStatus: (row.stock_status as SourceStockStatus) ?? SourceStockStatus.EXACT,
          maxOrderQuantity: row.max_order_quantity,
          removed: row.source_removed_at !== null,
        },
        results.get(row.asin),
        floor,
      );
      if (plan.kind === 'skip') {
        continue;
      }
      if (plan.kind === 'data_failure') {
        await this.handleDataFailure(row);
        continue;
      }
      try {
        pending.push(...(await this.applyScraperPlan(row, plan)));
      } catch (error: unknown) {
        this.logger.error(`Scraper refresh failed for ASIN ${row.asin}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    await this.productSyncService.flushUpdates(pending);
  }

  private async applyScraperPlan(
    row: ProductRow,
    plan: Extract<ScraperRefreshPlan, { kind: 'observed' }>,
  ): Promise<PendingListingUpdate[]> {
    const intervalMinutes = await this.platformSettings.getNumber(PlatformSettingKey.KEEPA_REFRESH_INTERVAL_MINUTES);
    await this.databaseService.query(
      `UPDATE products
       SET price = CASE WHEN $1::numeric IS NOT NULL
                        THEN jsonb_set(COALESCE(price, '{}'::jsonb), '{current}', to_jsonb($1::numeric))
                        ELSE price END,
           stock = COALESCE($2, stock),
           stock_status = COALESCE($3, stock_status),
           max_order_quantity = CASE WHEN $4::boolean THEN max_order_quantity ELSE $5 END,
           source_removed_at = CASE WHEN $6::boolean THEN COALESCE(source_removed_at, NOW()) ELSE NULL END,
           last_refresh_attempt_at = NOW(),
           last_successful_refresh_at = NOW(),
           next_refresh_at = NOW() + make_interval(mins => $7::int),
           consecutive_failures = 0,
           updated_at = NOW()
       WHERE id = $8`,
      [plan.price, plan.stock, plan.stockStatus, plan.keepMaxOrderQuantity, plan.maxOrderQuantity, plan.removed, intervalMinutes, row.id],
    );
    return plan.commerceChanged
      ? this.productSyncService.computePendingUpdates(row.id, row.asin, row.marketplace as AmazonMarketplace)
      : [];
  }
```

7. **Keepa branch:** in `applyKeepaProduct`'s UPDATE, add `stock_status = COALESCE($13, stock_status),` and pass `keepaStockStatusToSource(kp.stockStatus)` as `$13`. This is the rollback-safety line: after switching back to Keepa, the rows it refreshes read `exact` again.

- [ ] **Step 6: Run the tests and typecheck**

```bash
pnpm --filter api test
pnpm --filter api exec tsc --noEmit -p tsconfig.json
```

Expected: all pass, and no new type errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/listings
git commit -m "feat(refresh): scraper commerce refresh with capacity-derived batch size; Keepa writes stock_status

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Fair priority between sellers

**Files:**
- Create: `apps/api/src/modules/listings/fair-priority.ts`, `apps/api/src/modules/listings/fair-priority.spec.ts`
- Modify: `apps/api/src/modules/listings/listing-queue.service.ts` (`addBulk` :113), `apps/api/src/modules/listings/listing-import.service.ts` (`addBulk` :130)

**Interfaces:**
- Produces:
  - `export const BULLMQ_MAX_PRIORITY = 2_097_152;`
  - `export function fairBatchPriority(queuedItemsForUser: number, chunkIndex: number, chunkSize = 25): number`

- [ ] **Step 1: Write the failing tests**

`fair-priority.spec.ts`:

```ts
import { BULLMQ_MAX_PRIORITY, fairBatchPriority } from './fair-priority';

describe('fairBatchPriority', () => {
  it("a seller's first chunk with nothing queued runs at the top", () => {
    expect(fairBatchPriority(0, 0)).toBe(1);
  });
  it("later chunks of one job sink behind another seller's first chunk", () => {
    expect(fairBatchPriority(0, 19)).toBe(20);
    expect(fairBatchPriority(0, 0)).toBeLessThan(fairBatchPriority(0, 19));
  });
  it('already-queued work pushes a new job back', () => {
    expect(fairBatchPriority(500, 0)).toBe(21);
  });
  it('is clamped to the BullMQ maximum', () => {
    expect(fairBatchPriority(10 ** 9, 10 ** 9)).toBe(BULLMQ_MAX_PRIORITY);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api test -- fair-priority`
Expected: FAIL.

- [ ] **Step 3: Implement**

`fair-priority.ts`:

```ts
/** BullMQ priorities run 1 (highest) .. 2^21. */
export const BULLMQ_MAX_PRIORITY = 2_097_152;

/**
 * Per-seller fairness on the shared listings queue: a chunk's priority is the
 * number of chunks the same seller already has waiting, plus its own position.
 * One seller's 20th chunk therefore runs after another seller's first, so a
 * 500-ASIN upload cannot hold a 5-ASIN upload behind it.
 */
export function fairBatchPriority(queuedItemsForUser: number, chunkIndex: number, chunkSize = 25): number {
  const queuedChunks = Math.ceil(Math.max(0, queuedItemsForUser) / chunkSize);
  return Math.min(1 + queuedChunks + Math.max(0, chunkIndex), BULLMQ_MAX_PRIORITY);
}
```

- [ ] **Step 4: Apply it at both enqueue sites**

In `listing-queue.service.ts`, before building `jobs`:

```ts
    const [{ count }] = await this.databaseService.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM listing_job_items i
         JOIN listing_jobs j ON j.id = i.job_id
        WHERE j.user_id = $1 AND j.id <> $2 AND LOWER(i.status) = $3`,
      [userId, job.id, ListingStatus.DRAFT],
    );
    const queuedForUser = Number(count);
```

Use the database handle this service already has. If it only has `ListingsService`, add a `countQueuedItems(userId, excludeJobId)` method there with this query.

Then change the map to `chunkForBulk(job.items).map((chunk, index) => ({ ..., opts: { ...opts, priority: fairBatchPriority(queuedForUser, index) } }))`.

In `listing-import.service.ts`, run the same count query with `data.userId`/`job.id` and set `opts: { ..., priority: fairBatchPriority(queuedForUser, Math.floor(i / 25)) }` using the item index `i` from `job.items.map((item, i) => ...)`.

(`listing_job_items.status` defaults to `'DRAFT'`, uppercase, per migration `009`, while `ListingStatus.DRAFT` is lowercase. `LOWER(...)` covers both.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter api test -- fair-priority`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/listings
git commit -m "feat(listings): fair per-seller priority on the listings queue

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Admin visibility (warnings, scraper stats, lag, capacity)

**Files:**
- Modify: `packages/shared/src/domain/admin/admin.types.ts` (`AdminWarningKind` :254, operations DTO with `keepaTokensLeft` :298)
- Modify: `apps/api/src/modules/admin/admin.service.ts` (:455-490), and the admin module imports
- Create: `apps/api/src/modules/admin/scraper-ops.helpers.ts`, `apps/api/src/modules/admin/scraper-ops.helpers.spec.ts`
- Modify: `apps/web/src/features/admin/AdminPage/AdminPage.component.tsx` (:107-114 balance card) and its container
- Modify: `apps/web/src/features/admin/.../AdminSettingsPanel.container.tsx` (:23 categories)
- Modify: `packages/shared/src/i18n/resources/{en,tr}/admin.json`

**Interfaces:**
- Consumes: `ScraperClient.getStats`, `ProductSourceService.activeProvider`/`proxies` (Task 7).
- Produces:
  - `AdminWarningKind` += `SCRAPER_NO_PROXIES = 'scraper_no_proxies'`, `SCRAPER_UNREACHABLE = 'scraper_unreachable'`, `SCRAPER_BLOCK_RATE_HIGH = 'scraper_block_rate_high'`, `REFRESH_LAG = 'refresh_lag'`
  - The operations DTO gains:
    - `productDataProvider: ProductDataProviderKind`
    - `scraperStats: ScraperStats | null`
    - `refreshLagMinutes: number | null`
    - `uniqueRefreshedAsins: number`
    - `achievableSyncsPerDay: number | null`
  - Pure helpers:
    ```ts
    export function blockRatePercent(stats: ScraperStats): number | null;
    export function achievableSyncsPerDay(proxyCount: number, perIpRequestsPerSecond: number, uniqueAsins: number): number | null;
    ```

- [ ] **Step 1: Write the failing helper tests**

`scraper-ops.helpers.spec.ts`:

```ts
import { achievableSyncsPerDay, blockRatePercent } from './scraper-ops.helpers';

const stats = (found: number, blocked: number) => ({
  window1h: { found, notFound: 0, blocked, parseFailed: 0, noProxy: 0 },
  window24h: { found, notFound: 0, blocked, parseFailed: 0, noProxy: 0 },
  meanLatencyMs: null, proxies: [],
});

describe('scraper ops helpers', () => {
  it('block rate over the last hour, null with no traffic', () => {
    expect(blockRatePercent(stats(90, 10))).toBe(10);
    expect(blockRatePercent(stats(0, 0))).toBeNull();
  });
  it('syncs/day = proxies × rps × 86400 / unique ASINs', () => {
    expect(achievableSyncsPerDay(5, 1, 200_000)).toBeCloseTo(2.16, 2);
    expect(achievableSyncsPerDay(5, 1, 0)).toBeNull();
    expect(achievableSyncsPerDay(0, 1, 1000)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail, then implement**

Run: `pnpm --filter api test -- scraper-ops`. Expected: FAIL.

`scraper-ops.helpers.ts`:

```ts
import type { ScraperStats } from '@repo/shared';

export function blockRatePercent(stats: ScraperStats): number | null {
  const w = stats.window1h;
  const total = w.found + w.notFound + w.blocked + w.parseFailed;
  return total === 0 ? null : Math.round((w.blocked / total) * 1000) / 10;
}

export function achievableSyncsPerDay(proxyCount: number, perIpRequestsPerSecond: number, uniqueAsins: number): number | null {
  if (uniqueAsins <= 0) {
    return null;
  }
  return (proxyCount * perIpRequestsPerSecond * 86_400) / uniqueAsins;
}
```

Run again: PASS.

- [ ] **Step 3: Build the warnings and fields in `admin.service.ts`**

Inject `ProductSourceService` and `ScraperClient` (use the export or module decision from Task 7). In the operations method, **replace** the `keepaTokensLeft` warning block with:

```ts
    const productDataProvider = await this.productSource.activeProvider();
    let scraperStats: ScraperStats | null = null;
    if (productDataProvider === ProductDataProviderKind.KEEPA) {
      if (keepaTokensLeft !== null) {
        const threshold = await this.platformSettings.getNumber(PlatformSettingKey.ADMIN_KEEPA_LOW_TOKENS_THRESHOLD);
        if (keepaTokensLeft <= threshold) {
          warnings.push({ kind: AdminWarningKind.KEEPA_LOW_TOKENS, level: keepaTokensLeft <= threshold / 2 ? AdminWarningLevel.CRITICAL : AdminWarningLevel.WARNING, value: keepaTokensLeft, threshold });
        }
      }
    } else {
      const proxies = await this.productSource.proxies();
      if (proxies.length === 0) {
        warnings.push({ kind: AdminWarningKind.SCRAPER_NO_PROXIES, level: AdminWarningLevel.CRITICAL, value: 0, threshold: 1 });
      }
      try {
        scraperStats = await this.scraperClient.getStats();
        const rate = blockRatePercent(scraperStats);
        const warnAt = await this.platformSettings.getNumber(PlatformSettingKey.SCRAPER_BLOCK_RATE_WARN_PERCENT);
        if (rate !== null && rate >= warnAt) {
          warnings.push({ kind: AdminWarningKind.SCRAPER_BLOCK_RATE_HIGH, level: rate >= warnAt * 2 ? AdminWarningLevel.CRITICAL : AdminWarningLevel.WARNING, value: rate, threshold: warnAt });
        }
      } catch {
        warnings.push({ kind: AdminWarningKind.SCRAPER_UNREACHABLE, level: AdminWarningLevel.CRITICAL, value: 0, threshold: 0 });
      }
    }

    const [lagRow] = await this.databaseService.query<{ lag_minutes: string | null; unique_asins: string }>(
      `SELECT EXTRACT(EPOCH FROM (NOW() - MIN(p.next_refresh_at)) FILTER (WHERE p.next_refresh_at < NOW())) / 60 AS lag_minutes,
              COUNT(*)::text AS unique_asins
         FROM products p
        WHERE EXISTS (SELECT 1 FROM listings l WHERE l.product_id = p.id AND l.status = $1)`,
      [ListingStatus.ACTIVE],
    );
    const refreshLagMinutes = lagRow?.lag_minutes !== null && lagRow?.lag_minutes !== undefined ? Math.round(Number(lagRow.lag_minutes)) : null;
    const intervalMinutes = await this.platformSettings.getNumber(PlatformSettingKey.KEEPA_REFRESH_INTERVAL_MINUTES);
    if (refreshLagMinutes !== null && refreshLagMinutes > intervalMinutes) {
      warnings.push({ kind: AdminWarningKind.REFRESH_LAG, level: refreshLagMinutes > intervalMinutes * 2 ? AdminWarningLevel.CRITICAL : AdminWarningLevel.WARNING, value: refreshLagMinutes, threshold: intervalMinutes });
    }
    const uniqueRefreshedAsins = Number(lagRow?.unique_asins ?? 0);
    const achievable = productDataProvider === ProductDataProviderKind.SCRAPER
      ? achievableSyncsPerDay((await this.productSource.proxies()).length, await this.platformSettings.getNumber(PlatformSettingKey.SCRAPER_PER_IP_RPS), uniqueRefreshedAsins)
      : null;
```

Return the new fields alongside the existing ones:

```ts
productDataProvider, scraperStats, refreshLagMinutes, uniqueRefreshedAsins,
achievableSyncsPerDay: achievable === null ? null : Math.round(achievable * 10) / 10
```

`ScraperStats` only ever carries `host:port` proxy ids, per the Task 3 test. Never add the raw proxy list to this DTO.

- [ ] **Step 4: Update the web admin overview**

In `AdminPage.component.tsx`:
- Render the Keepa balance card only when `operations?.productDataProvider === ProductDataProviderKind.KEEPA`.
- When it is `SCRAPER`, render three `S.SummaryCard`s in its place, each using the existing caption + metric pattern:
  1. `admin.overview.scraperLastHour`: `found / blocked / parseFailed` from `scraperStats.window1h`, as `{found} · {blocked} · {parseFailed}`
  2. `admin.overview.refreshLag`: `refreshLagMinutes` with a `{{minutes}} dk` suffix via i18n, or `—`
  3. `admin.overview.syncsPerDay`: `achievableSyncsPerDay`, or `—`

These values are passed down from the container, which formats nothing beyond what the component needs. Add `SCRAPER` to the categories list in `AdminSettingsPanel.container.tsx`.

i18n (`admin.json`):

EN, under `admin.warnings`:
- `scraper_no_proxies`: "No scraper proxies configured — no Amazon data is being fetched"
- `scraper_unreachable`: "Scraper service is unreachable"
- `scraper_block_rate_high`: "Scraper block rate is elevated (%)"
- `refresh_lag`: "Product refresh is behind schedule (minutes)"

EN, under `admin.overview`:
- `scraperLastHour`: "Scraper, last hour (ok · blocked · unreadable)"
- `refreshLag`: "Refresh lag"
- `refreshLagValue`: "{{minutes}} min"
- `syncsPerDay`: "Achievable syncs per day"

TR, under `admin.warnings`:
- `scraper_no_proxies`: "Scraper proxy'si tanımlı değil — Amazon'dan veri çekilmiyor"
- `scraper_unreachable`: "Scraper servisine ulaşılamıyor"
- `scraper_block_rate_high`: "Scraper blok oranı yüksek (%)"
- `refresh_lag`: "Ürün yenileme takvimin gerisinde (dakika)"

TR, under `admin.overview`:
- `scraperLastHour`: "Scraper, son 1 saat (başarılı · bloklu · okunamayan)"
- `refreshLag`: "Yenileme gecikmesi"
- `refreshLagValue`: "{{minutes}} dk"
- `syncsPerDay`: "Ulaşılabilir günlük sync"

- [ ] **Step 5: Build, test, lint**

```bash
pnpm --filter @repo/shared build && pnpm --filter @repo/ui build
pnpm --filter api test
pnpm lint
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/shared apps/api/src/modules/admin apps/web/src/features/admin
git commit -m "feat(admin): scraper health, block-rate and refresh-lag warnings, capacity indicator

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Removed products in the Action Center and the listings filter

**Files:**
- Modify: `apps/api/src/modules/action-center/action-center.service.ts` (:487-495)
- Modify: `apps/api/src/modules/listings/listings.service.ts` (:510-514)
- Modify: `apps/api/src/modules/action-center/action-center.helpers.spec.ts` if it pins copy or keys; otherwise add `apps/api/src/modules/action-center/source-unavailable.guard.spec.ts`
- Modify: `packages/shared/src/i18n/resources/{en,tr}/actionCenter.json` (`listing_source_unavailable`)

**Interfaces:**
- Consumes: `products.source_removed_at` (Task 4).
- Produces: the existing `LISTING_SOURCE_UNAVAILABLE` item and `sourceUnavailable` filter both count `source_removed_at IS NOT NULL`. (This refines the spec's "new item": a second item for the same condition would duplicate the seller's to-do list.)

- [ ] **Step 1: Write the failing guard test**

`apps/api/src/modules/action-center/source-unavailable.guard.spec.ts`:

```ts
import { readFileSync } from 'fs';
import { join } from 'path';

// The Action Center count and the listings deep-link filter must agree on
// which listings are "unavailable on Amazon" — both must include the
// scraper's 404 flag, not only the failure-count threshold.
describe('source-unavailable predicate', () => {
  const read = (p: string) => readFileSync(join(__dirname, p), 'utf8');
  it('action center counts removed products', () => {
    expect(read('action-center.service.ts')).toMatch(/consecutive_failures >= \$3 OR p\.source_removed_at IS NOT NULL/);
  });
  it('listings filter includes removed products', () => {
    expect(read('../listings/listings.service.ts')).toMatch(/p\.consecutive_failures >= \$\$\{paramIndex\} OR p\.source_removed_at IS NOT NULL/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter api test -- source-unavailable`
Expected: FAIL.

- [ ] **Step 3: Update both predicates and the copy**

In `action-center.service.ts`, change `AND p.consecutive_failures >= $3` to `AND (p.consecutive_failures >= $3 OR p.source_removed_at IS NOT NULL)`. Update the comment above it: Amazon returning 404 to the scraper is now definitive evidence.

In `listings.service.ts`, change the pushed condition to:

```ts
      conditions.push(`(p.consecutive_failures >= $${paramIndex} OR p.source_removed_at IS NOT NULL)`);
```

`actionCenter.json` `listing_source_unavailable`:

EN:
- `title`: "Live listings unavailable on Amazon"
- `description_one`: "{{count}} active listing points at a product that is unavailable on Amazon. It is still buyable on eBay and you would not be able to fulfil that sale."
- `description_other`: "{{count}} active listings point at products that are unavailable on Amazon. They are still buyable on eBay and you would not be able to fulfil those sales."
- `action`: keep "Review listings"

TR:
- `title`: "Amazon'da erişilemeyen ürünler hâlâ eBay'de listeli"
- `description_one`: "{{count}} aktif listeleme Amazon'da erişilemeyen bir ürüne bağlı. eBay'de hâlâ satın alınabiliyor ve bu satışı karşılayamazsınız."
- `description_other`: "{{count}} aktif listeleme Amazon'da erişilemeyen ürünlere bağlı. eBay'de hâlâ satın alınabiliyorlar ve bu satışları karşılayamazsınız."
- `action`: keep the current TR text

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api test -- source-unavailable action-center`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/action-center apps/api/src/modules/listings/listings.service.ts packages/shared/src/i18n
git commit -m "feat(action-center): count products unavailable on Amazon (scraper 404)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: "N+" stock display (web, CSV, filter note, demo)

**Files:**
- Modify: `apps/api/src/modules/listings/listings.service.ts` (listing row type :64, mapper :308, SELECTs :555 and :824, CSV :715)
- Modify: `apps/web/src/features/listings/detail/ListingDetailPage.component.tsx` (:394-397) and its container
- Modify: `apps/web/src/features/listings/all/hooks/useListingsColumns.tsx` (:193-199)
- Modify: the advanced-filter field that renders `listings.filters.fields.sourceStock` (`useListingsFilters.ts` :373 defines it; find where the field list renders and add a helper line)
- Modify: `apps/web/src/features/demo/demoData.ts` (:254), `apps/web/src/features/demo/demoBaseQuery.ts` (:311)
- Modify: `packages/shared/src/i18n/resources/{en,tr}/listings.json`
- Create: `apps/api/src/modules/listings/listing-source-stock.guard.spec.ts`

**Interfaces:**
- Consumes: `formatSourceStock` (Task 4); `sourceStockStatus` and `sourceRemoved` on the listing DTO.

- [ ] **Step 1: Write the failing guard test**

`listing-source-stock.guard.spec.ts`:

```ts
import { readFileSync } from 'fs';
import { join } from 'path';

// Every surface that shows Amazon stock must go through formatSourceStock,
// or an AT_LEAST value renders as a bare "20" and reads as an exact count.
describe('Amazon stock display', () => {
  const web = (p: string) => readFileSync(join(__dirname, '../../../../web/src/features/listings', p), 'utf8');
  it('listing detail, table column and CSV use formatSourceStock', () => {
    expect(web('detail/ListingDetailPage.container.tsx')).toMatch(/formatSourceStock/);
    expect(web('all/hooks/useListingsColumns.tsx')).toMatch(/formatSourceStock/);
    expect(readFileSync(join(__dirname, 'listings.service.ts'), 'utf8')).toMatch(/formatSourceStock\(item\.sourceStock/);
  });
  it('the API exposes the status next to the number', () => {
    expect(readFileSync(join(__dirname, 'listings.service.ts'), 'utf8')).toMatch(/sourceStockStatus:/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter api test -- listing-source-stock`
Expected: FAIL.

- [ ] **Step 3: API: expose status and removed, format the CSV**

- Add `p.stock_status AS source_stock_status, (p.source_removed_at IS NOT NULL) AS source_removed` to both SELECTs (:555, :824) and to the row type.
- In the mapper (:308), add `sourceStockStatus: row.source_stock_status ?? undefined, sourceRemoved: row.source_removed ?? false,`.
- In the CSV, replace `item.sourceStock ?? ''` with `item.sourceStock === undefined ? '' : formatSourceStock(item.sourceStock, item.sourceStockStatus)`.

- [ ] **Step 4: Web: detail, column, filter note**

Listing detail container: compute and pass `amazonStockText = formatSourceStock(listing.sourceStock, listing.sourceStockStatus)` and `sourceRemoved = listing.sourceRemoved === true` as props. Formatting stays out of the component, per the frontend rules. Add both to the component's `.types.ts` props.

Component (:394-397): render `{amazonStockText}`. When `sourceRemoved`, add a second `Text` with `variant="caption" color="semantic.error"` showing `t('listings.detail.unavailableOnAmazon')`.

Column (:198): `{formatSourceStock(listing.sourceStock, listing.sourceStockStatus)}` inside `S.StockValue`. Keep `$outOfStock={listing.sourceStock === 0}`. This is a hook file that already builds render functions, so calling the formatter here is allowed.

Filter note: where the advanced filter renders the `sourceStock` range field, add a `Text variant="caption" color="text.secondary"` with `t('listings.filters.sourceStockNote')` under it. Follow how any existing helper text renders in that filter; if none exists, put it in the field's container and pass it as a prop.

i18n (`listings.json`):

EN:
- `listings.detail.unavailableOnAmazon`: "Unavailable on Amazon"
- `listings.filters.sourceStockNote`: "Stock above 20 is not known; \"20+\" counts as 20."

TR:
- `listings.detail.unavailableOnAmazon`: "Amazon'da erişilemiyor"
- `listings.filters.sourceStockNote`: "20 üstü stok bilinmez; 20+ ürünler 20 sayılır."

- [ ] **Step 5: Demo fixtures**

In `demoData.ts` near :254, give every third sample listing `sourceStockStatus: SourceStockStatus.AT_LEAST` with `sourceStock: 20`, and one listing `sourceStock: 4` AT_LEAST. Keep the rest EXACT. In `demoBaseQuery.ts` :311, pass `sourceStockStatus` through wherever `sourceStock` is mapped.

- [ ] **Step 6: Test, lint, and check in a browser**

```bash
pnpm --filter @repo/shared build && pnpm --filter @repo/ui build
pnpm --filter api test -- listing-source-stock
pnpm lint
```

Then `pnpm dev:web`. Open the demo (`sessionStorage.sellerhill_demo=1`) → Listings, and one listing detail at 375px and at desktop width. Confirm that `20+` and `4+` render, and that the filter note shows under the Amazon stock range.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/listings apps/web/src/features packages/shared/src/i18n
git commit -m "feat(listings): show Amazon stock as N+ when only a lower bound is known

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 15: Deployment wiring, compare script, guard, docs

**Files:**
- Modify: `docker-compose.yml`, `docker-compose.test.yml`, `docker-compose.production.yml`, `apps/api/.env.example`
- Create: `apps/api/src/scripts/provider-compare.ts`
- Modify: `apps/api/package.json` (script `provider:compare`)
- Create: `apps/api/src/modules/listings/scraper-egress.guard.spec.ts`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: `KeepaService.getProducts`, `ScraperClient.fetchProducts`, `mapScraperProduct`, `normalizeScraperCommerce`.

- [ ] **Step 1: Write the failing guard test**

`scraper-egress.guard.spec.ts`:

```ts
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '../../../../..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

// Spec D5: never scrape from the server's own IP. The dev-only switch must not
// exist in any deployment file, and the NestJS side must not call the service
// without proxies.
describe('scraper egress guard', () => {
  it('deployment compose files never mention SCRAPER_ALLOW_DIRECT', () => {
    expect(read('docker-compose.test.yml')).not.toMatch(/SCRAPER_ALLOW_DIRECT/);
    expect(read('docker-compose.production.yml')).not.toMatch(/SCRAPER_ALLOW_DIRECT/);
  });
  it('both deployment files define the scraper and give the api its URL', () => {
    for (const f of ['docker-compose.test.yml', 'docker-compose.production.yml']) {
      const c = read(f);
      expect(c).toMatch(/\n  scraper:\n/);
      expect(c).toMatch(/SCRAPER_SERVICE_URL=http:\/\/scraper:8080/);
    }
  });
  it('ProductSourceService short-circuits on an empty proxy list', () => {
    expect(read('apps/api/src/modules/listings/product-source.service.ts')).toMatch(/proxies\.length === 0[\s\S]{0,300}NO_PROXY/);
  });
  it('the Python service refuses direct egress', () => {
    expect(read('services/amazon-scraper/amazon/fetch.py')).toMatch(/egress\.require_proxy\(\)/);
    expect(read('services/amazon-scraper/sellerhill/egress.py')).toMatch(/SCRAPER_ALLOW_DIRECT"\) == "1"/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter api test -- scraper-egress`
Expected: FAIL on the compose assertions.

- [ ] **Step 3: Compose wiring**

`docker-compose.production.yml` and `docker-compose.test.yml`. Add the service; keep the formatting of the existing services:

```yaml
  # ---- Amazon scraper (spec 2026-09-26) ----
  # Internal only: no published port, not on the shared `coolify` network (so a
  # test and a production stack on the same host can never reach each other's
  # scraper by name). Proxies arrive per request from the api's panel setting.
  scraper:
    build:
      context: ./services/amazon-scraper
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      - SCRAPER_SERVICE_SECRET=${SCRAPER_SERVICE_SECRET}
      - SCRAPER_PORT=8080
      - SCRAPER_THREADS_PER_PROXY=${SCRAPER_THREADS_PER_PROXY:-2}
    deploy:
      resources:
        limits:
          memory: ${SCRAPER_MEMORY_LIMIT:-1G}
    networks:
      - scraper_net
```

In the `api` service:
- add `- SCRAPER_SERVICE_URL=http://scraper:8080` and `- SCRAPER_SERVICE_SECRET=${SCRAPER_SERVICE_SECRET}` to `environment`;
- add `scraper_net` to its `networks` list;
- add `depends_on: { scraper: { condition: service_healthy } }`.

In the top-level `networks:`, add `scraper_net: {}` next to `coolify`.

`docker-compose.yml` (local): add the same service with `ports: ["8080:8080"]`, `environment` including `- SCRAPER_ALLOW_DIRECT=${SCRAPER_ALLOW_DIRECT:-0}`, and no custom network, because local services use the default network. The local API runs on the host, so `apps/api/.env.example` gets:

```
# Amazon scraper service (docker-compose.yml runs it on :8080)
SCRAPER_SERVICE_URL=http://localhost:8080
SCRAPER_SERVICE_SECRET=change-me
# Proxies are normally set at /admin → Settings → Scraper. Local-only alternative:
SCRAPER_PROXIES=
```

- [ ] **Step 4: The compare script**

`apps/api/src/scripts/provider-compare.ts` follows the `user-set-role.ts` convention: dotenv, no Nest bootstrap. It is read-only and spends Keepa tokens.

```ts
/**
 * Read-only Keepa vs scraper comparison for the same ASINs.
 *
 *   pnpm --filter api provider:compare -- --asins B0...,B0... [--proxies http://u:p@h:1,...]
 *
 * Proxies default to SCRAPER_PROXIES from apps/api/.env. Spends Keepa tokens
 * (~7 per ASIN). Prints one row per ASIN and field that differs, then totals.
 * Use it before relying on the scraper, and after an Amazon layout change.
 */
import 'reflect-metadata';

import { ConfigService } from '@nestjs/config';
import { AmazonMarketplace, ScraperFetchMode, ScraperLane, SourceFetchOutcome } from '@repo/shared';
import * as dotenv from 'dotenv';

import { KeepaService } from '../modules/listings/keepa.service';
import { ScraperClient, parseProxyList } from '../modules/listings/scraper.client';
import { mapScraperProduct } from '../modules/listings/source-content-mapper';
import { normalizeScraperCommerce } from '../modules/listings/source-product-normalizer';

dotenv.config();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const asins = (arg('asins') ?? '').split(',').map((a) => a.trim()).filter(Boolean);
  if (asins.length === 0) {
    console.error('usage: provider:compare -- --asins B0...,B0... [--proxies url,url]');
    process.exit(2);
  }
  const config = new ConfigService(process.env);
  const keepa = new KeepaService(config);
  const scraper = new ScraperClient(config);
  const proxies = parseProxyList(arg('proxies') ?? process.env.SCRAPER_PROXIES ?? '');

  const { products } = await keepa.getProducts(asins, AmazonMarketplace.AMAZON_US);
  const keepaByAsin = new Map(products.map((p) => [p.asin, p]));
  const scraped = await scraper.fetchProducts({
    marketplace: 'US', asins, mode: ScraperFetchMode.FULL, lane: ScraperLane.INTERACTIVE, proxies, perIpRequestsPerSecond: 1,
  });

  const diffs: Record<string, number> = {};
  const note = (asin: string, field: string, k: unknown, s: unknown) => {
    diffs[field] = (diffs[field] ?? 0) + 1;
    console.log(`${asin}\t${field}\tkeepa=${JSON.stringify(k)}\tscraper=${JSON.stringify(s)}`);
  };

  for (const r of scraped) {
    const k = keepaByAsin.get(r.asin);
    if (r.outcome !== SourceFetchOutcome.FOUND || !r.content) {
      note(r.asin, 'outcome', k ? 'found' : 'missing', r.outcome);
      continue;
    }
    const obs = normalizeScraperCommerce(r, 20);
    if (obs.kind !== 'observed') {
      note(r.asin, 'commerce', 'n/a', obs.kind);
      continue;
    }
    const s = mapScraperProduct(r.asin, r.content, obs.commerce, AmazonMarketplace.AMAZON_US);
    if (!k) {
      note(r.asin, 'keepa', 'missing', 'found');
      continue;
    }
    if (k.price !== s.price.current) note(r.asin, 'price', k.price, s.price.current);
    if ((k.imageUrls?.length ?? 0) !== s.imageUrls.length) note(r.asin, 'imageCount', k.imageUrls?.length, s.imageUrls.length);
    if ((k.description ?? '').length > 0 !== s.description.length > 0) note(r.asin, 'hasDescription', Boolean(k.description), Boolean(s.description));
    if (Object.keys(k.specs ?? {}).length > Object.keys(s.specs ?? {}).length) note(r.asin, 'specsFewer', Object.keys(k.specs ?? {}).length, Object.keys(s.specs ?? {}).length);
    const kBarcode = Boolean(k.identifiers?.upc || k.identifiers?.ean || k.identifiers?.gtin);
    const sBarcode = Boolean(s.identifiers?.upc || s.identifiers?.ean || s.identifiers?.gtin);
    if (kBarcode !== sBarcode) note(r.asin, 'barcode', kBarcode, sBarcode);
    const kPath = (k.raw as { categoryTree?: Array<{ name?: string }> } | undefined)?.categoryTree?.map((c) => c.name).join(' > ');
    if (kPath !== s.categoryPath) note(r.asin, 'categoryPath', kPath, s.categoryPath);
  }
  console.log(`\n${scraped.length} ASINs compared. Differences by field: ${JSON.stringify(diffs)}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
```

Add `"provider:compare": "tsx src/scripts/provider-compare.ts"` to `apps/api/package.json` `scripts`, next to `ebay:aspect-probe`.

- [ ] **Step 5: Run the guard, and the compare script against 50 ASINs**

```bash
pnpm --filter api test -- scraper-egress
docker compose up -d scraper   # local, with SCRAPER_ALLOW_DIRECT=1 and SCRAPER_SERVICE_SECRET=change-me in the shell
pnpm --filter api exec tsx src/scripts/provider-compare.ts --asins "$(node -e "console.log(require('C:/Users/2B/AppData/Local/Temp/claude/d--dev-projects-sellerhill-sellerhill/880c04aa-a792-4955-b7a2-c62ba0606668/scratchpad/amazon-scraper/asins50.json').join(','))")"
```

Expected: the guard PASSes.

The compare output must satisfy all of the following. If `categoryPath` differs, fix `mapScraperProduct`'s join (whitespace, `&amp;`) until the paths are identical.
- `categoryPath` 0 differences
- `imageCount` 0 differences
- `specsFewer` ≤ 5 of 50
- `price` differences only on Prime-priced items

- [ ] **Step 6: Update CLAUDE.md**

- **Rewrite the opening of "Product Refresh Pipeline".** Amazon product data comes from the provider selected by `product.dataProvider` (default `scraper`), and Keepa is the rollback. Keep the Keepa subsections and title them "Keepa provider".
- **Add a section "### Scraper provider (2026-09-26)"** that summarizes:
  - the service location;
  - the no-VPS-egress rule and the dev flag;
  - the stock table and the order-limit rule;
  - commerce vs full mode;
  - capacity math and the 360-minute default;
  - admin warnings;
  - `provider:compare`;
  - the rollback;
  - and "Parser maintenance is ours — three defects surfaced in the first 50 pages".
  
  Link the spec.
- **Migrations table:** add `122`.
- **Correct the statements "sourced exclusively from the Keepa API"** and "Keepa sole provider" in "Key Files".

- [ ] **Step 7: Full check and commit**

```bash
pnpm --filter @repo/shared build && pnpm --filter @repo/ui build
pnpm --filter api test
pnpm lint
cd services/amazon-scraper && .venv/Scripts/python -m pytest -q && cd ../..
git add docker-compose*.yml apps/api/.env.example apps/api/src/scripts/provider-compare.ts apps/api/package.json apps/api/src/modules/listings/scraper-egress.guard.spec.ts CLAUDE.md
git commit -m "feat(scraper): compose wiring on a private network, provider:compare, egress guard, docs

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After all tasks

- The operator adds `SCRAPER_SERVICE_SECRET` in Coolify for both stacks. It can be any random 32+ character string.
- The operator enters the proxies at `/admin` → Settings → Scraper.
- Run `pnpm --filter api ebay:aspect-probe -- --asin <ASIN>` on a few scraper-created products. Required aspects filled from product data should be ≥ the Keepa-era numbers.
