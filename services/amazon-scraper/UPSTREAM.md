# Upstream

Vendored from https://github.com/omkarcloud/amazon-scraper (MIT) at commit `ea5aefd`.

Our code lives in `sellerhill/`. Upstream files are unchanged EXCEPT:

- `amazon/fetch.py` — `_proxy_for()` returns `sellerhill.egress.require_proxy()`. Upstream fell back to a
  direct connection when no proxy was configured; we must never scrape from the server's own IP
  (auto-fulfill checkouts share it). See docs/superpowers/specs/2026-09-26-amazon-scraper-provider-design.md D5.
- `config.py` — `AMAZON_PROXY` is no longer read; `amazon_country_proxy` / `amazon_fallback_proxy`
  return `None`, so the upstream "fallback exit" path can never activate.

To merge upstream: diff upstream against this commit, apply their changes, then re-apply the two patches above.
