import pytest


@pytest.fixture(autouse=True)
def _parse_inline_by_default(monkeypatch):
    """Unit tests parse in-process. Spawning a worker pool per test is slow and
    leaves processes behind; the one test that needs the real pool sets the
    variable itself."""
    monkeypatch.setenv("SCRAPER_PARSE_PROCESSES", "0")
