"""Lightweight proxy connectivity check: one small request through the proxy
to a neutral, highly-reliable target — never Amazon, so clicking "test" never
spends real scraping capacity or adds to the block-rate signal Amazon itself
sees. This answers "does this proxy carry traffic and accept these
credentials", not "will Amazon serve pages through it" — that second
question is answered by real traffic, surfaced separately by pool.stats()."""
import time

from sellerhill import egress

# Chrome's own captive-portal-detection endpoint: always answers 204 with an
# empty body, on a domain that is effectively never itself unreachable.
TARGET_URL = "https://www.google.com/generate_204"
DEFAULT_TIMEOUT_SECONDS = 6.0


def probe_proxy(proxy, timeout=DEFAULT_TIMEOUT_SECONDS):
    """One connectivity check through `proxy`.

    Returns {id, ok, errorKind, latencyMs}. `id` is host:port only (via
    `egress.redact`) — the proxy value itself never appears in the result,
    and this function raises nothing that could put it in a log line."""
    from curl_cffi import requests as curl_requests
    from curl_cffi.requests import exceptions as curl_exceptions

    resolved = egress.remote_dns(proxy)
    proxy_id = egress.redact(proxy)
    started = time.monotonic()
    try:
        response = curl_requests.get(
            TARGET_URL,
            proxies={"http": resolved, "https": resolved},
            timeout=timeout,
            impersonate="chrome",
            allow_redirects=False,
        )
    except curl_exceptions.ProxyError:
        return _result(proxy_id, False, "proxy", started)
    except (curl_exceptions.ConnectTimeout, curl_exceptions.Timeout):
        return _result(proxy_id, False, "timeout", started)
    except curl_exceptions.DNSError:
        return _result(proxy_id, False, "dns", started)
    except curl_exceptions.ConnectionError:
        return _result(proxy_id, False, "unreachable", started)
    except Exception:
        return _result(proxy_id, False, "other", started)
    if response.status_code == 407:
        return _result(proxy_id, False, "proxy", started)
    if response.status_code == 204:
        return _result(proxy_id, True, None, started)
    return _result(proxy_id, False, "other", started)


def _result(proxy_id, ok, error_kind, started):
    return {
        "id": proxy_id,
        "ok": ok,
        "errorKind": error_kind,
        "latencyMs": round((time.monotonic() - started) * 1000),
    }
