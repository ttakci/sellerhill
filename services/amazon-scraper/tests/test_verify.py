from curl_cffi.requests import exceptions as curl_exceptions

from sellerhill import verify


class _Resp:
    def __init__(self, status_code):
        self.status_code = status_code


def test_204_is_ok(monkeypatch):
    monkeypatch.setattr("curl_cffi.requests.get", lambda *a, **k: _Resp(204))
    result = verify.probe_proxy("http://u:p@1.2.3.4:8080")
    assert result == {"id": "1.2.3.4:8080", "ok": True, "errorKind": None, "latencyMs": result["latencyMs"]}
    assert isinstance(result["latencyMs"], int) and result["latencyMs"] >= 0


def test_407_is_a_proxy_auth_failure(monkeypatch):
    monkeypatch.setattr("curl_cffi.requests.get", lambda *a, **k: _Resp(407))
    result = verify.probe_proxy("http://baduser:badpass@1.2.3.4:8080")
    assert result["ok"] is False and result["errorKind"] == "proxy"


def test_unexpected_status_is_other(monkeypatch):
    monkeypatch.setattr("curl_cffi.requests.get", lambda *a, **k: _Resp(500))
    result = verify.probe_proxy("http://u:p@1.2.3.4:8080")
    assert result["ok"] is False and result["errorKind"] == "other"


def test_proxy_error_is_classified_as_proxy(monkeypatch):
    def raise_it(*a, **k):
        raise curl_exceptions.ProxyError("tunnel refused")

    monkeypatch.setattr("curl_cffi.requests.get", raise_it)
    result = verify.probe_proxy("http://u:p@1.2.3.4:8080")
    assert result["ok"] is False and result["errorKind"] == "proxy"


def test_timeout_is_classified_as_timeout(monkeypatch):
    def raise_it(*a, **k):
        raise curl_exceptions.ConnectTimeout("timed out")

    monkeypatch.setattr("curl_cffi.requests.get", raise_it)
    result = verify.probe_proxy("http://u:p@1.2.3.4:8080")
    assert result["ok"] is False and result["errorKind"] == "timeout"


def test_dns_error_is_classified_as_dns(monkeypatch):
    def raise_it(*a, **k):
        raise curl_exceptions.DNSError("could not resolve")

    monkeypatch.setattr("curl_cffi.requests.get", raise_it)
    result = verify.probe_proxy("http://u:p@no-such-host.invalid:8080")
    assert result["ok"] is False and result["errorKind"] == "dns"


def test_connection_error_is_classified_as_unreachable(monkeypatch):
    def raise_it(*a, **k):
        raise curl_exceptions.ConnectionError("refused")

    monkeypatch.setattr("curl_cffi.requests.get", raise_it)
    result = verify.probe_proxy("http://u:p@1.2.3.4:8080")
    assert result["ok"] is False and result["errorKind"] == "unreachable"


def test_unclassified_exception_is_other(monkeypatch):
    def raise_it(*a, **k):
        raise RuntimeError("something else")

    monkeypatch.setattr("curl_cffi.requests.get", raise_it)
    result = verify.probe_proxy("http://u:p@1.2.3.4:8080")
    assert result["ok"] is False and result["errorKind"] == "other"


def test_id_never_carries_credentials(monkeypatch):
    monkeypatch.setattr("curl_cffi.requests.get", lambda *a, **k: _Resp(204))
    result = verify.probe_proxy("socks5://sensitive_user:sensitive_pass@10.0.0.9:1080")
    assert "sensitive_user" not in str(result) and "sensitive_pass" not in str(result)
    assert result["id"] == "10.0.0.9:1080"


def test_socks5_is_resolved_at_the_proxy_before_probing(monkeypatch):
    seen = {}

    def capture(url, proxies=None, **k):
        seen["proxies"] = proxies
        return _Resp(204)

    monkeypatch.setattr("curl_cffi.requests.get", capture)
    verify.probe_proxy("socks5://u:p@1.2.3.4:1080")
    assert seen["proxies"]["https"].startswith("socks5h://")
