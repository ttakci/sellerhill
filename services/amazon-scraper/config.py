"""Configuration for the Amazon Scraper. Everything can be set with an
environment variable; the defaults work out of the box.

    PORT          port the API listens on (default 8000)

There is NO environment proxy (SellerHill patch, see UPSTREAM.md): upstream's
AMAZON_PROXY / AMAZON_PROXY_COUNTRY variables are ignored. Every Amazon request
leaves through a proxy the API sends per request, bound to the worker thread by
sellerhill.pool / sellerhill.egress; with no proxy there is no request at all
(SCRAPER_ALLOW_DIRECT=1 is a developer-machine exception only).

Everything else below is a plain constant with a working default — edit it
here if you need to.
"""
import os

PORT = int(os.environ.get("PORT", "8000"))

# Retry policy for transport errors and blocks (every request).
MAX_RETRIES = 3
RETRY_BACKOFF = 2          # seconds, multiplied by the attempt number

# SellerHill patch (see UPSTREAM.md): proxies are bound per thread by
# sellerhill.pool; the upstream env proxy and its fallback exit are disabled.
AMAZON_PROXY = None
AMAZON_PROXY_COUNTRY = None
AMAZON_DIRECT_COOLDOWN = 300


def amazon_country_proxy(country):
    return None


def amazon_fallback_proxy(country):
    return None
