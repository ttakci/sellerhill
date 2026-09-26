"""Configuration for the Amazon Scraper. Everything can be set with an
environment variable; the defaults work out of the box.

    PORT          port the API listens on (default 8000)
    AMAZON_PROXY  proxy URL for every request, e.g. http://user:pass@host:port
                  (default: none — direct). The US, UK, German, French,
                  Indian, Canadian … storefronts answer direct requests, so you
                  very likely don't need this. Two exceptions: amazon.co.jp and
                  amazon.com.au only serve visitors from their own country —
                  for country=JP / country=AU set a proxy that exits in Japan /
                  Australia. A residential proxy also helps if you run very
                  high volumes from one IP.

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
