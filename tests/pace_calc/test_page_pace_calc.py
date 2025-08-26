import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

PAGE_URL = "/static/pages/pace-calc/index.html"

def test_pace_calc_page_has_core_elements():
    r = client.get(PAGE_URL)
    html = r.text

    # core layout bits (present in static HTML)
    assert 'id="pace-form"' in html
    assert 'id="distance"' in html
    assert 'id="time"' in html
    assert 'id="pace"' in html
    assert 'id="result"' in html

    # unit toggle radios (mi/km)
    assert 'name="unit"' in html
    assert 'value="mi"' in html
    assert 'value="km"' in html

    # Instead of the injected #theme-toggle (JS-time), verify the injector is referenced
    assert '/static/js/site.js' in html  # nav + theme injected at runtime

    # (Optional) also assert shared styling is linked (helps catch missing includes)
    assert '/static/css/pace-calc.css' in html