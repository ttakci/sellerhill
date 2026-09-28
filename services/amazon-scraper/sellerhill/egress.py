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


def remote_dns(proxy):
    """`socks5://` makes libcurl resolve the Amazon hostname LOCALLY, so the
    lookup leaves from this host's resolver; `socks5h://` resolves at the
    proxy. Every SOCKS proxy is used as socks5h."""
    if isinstance(proxy, str) and proxy.lower().startswith("socks5://"):
        return "socks5h://" + proxy[len("socks5://"):]
    return proxy


@contextmanager
def bind(proxy):
    previous = getattr(_local, "proxy", None)
    _local.proxy = remote_dns(proxy)
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
