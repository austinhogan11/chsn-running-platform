import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# The static mount in app.main is: app.mount("/static", ...)
# Your file lives at app/web/pages/pace-calc/index.html
# So it should be reachable at /static/pages/pace-calc/index.html
PAGE_URL = "/static/pages/pace-calc/index.html"


def test_pace_calc_page_serves_ok():
    r = client.get(PAGE_URL)
    assert r.status_code == 200
    # quick sanity on content-type or basic HTML presence
    assert "<!doctype html>" in r.text.lower()


def test_pace_calc_page_has_core_elements():
    r = client.get(PAGE_URL)
    html = r.text

    # core layout bits
    assert 'id="pace-form"' in html
    assert 'id="distance"' in html
    assert 'id="time"' in html
    assert 'id="pace"' in html
    assert 'id="result"' in html

    # unit toggle radios (mi/km)
    assert 'name="unit"' in html
    assert 'value="mi"' in html
    assert 'value="km"' in html

    # theme toggle present
    assert 'id="theme-toggle"' in html


def test_pace_calc_page_links_expected_assets():
    r = client.get(PAGE_URL)
    html = r.text

    # CSS entry for this page
    assert '/static/css/pace-calc.css' in html

    # shared JS and page JS (keep minimal; adjust if you rename paths)
    assert '/static/js/common/formatters.js' in html
    assert '/static/js/common/deeplink.js' in html
    assert '/static/js/common/theme.js' in html
    assert '/static/js/pace-calc.js' in html