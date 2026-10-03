import re

from app.ai.provider import AIProviderError
from tests.conftest import make_design


def flat(doc_id="doc_1", **kw):
    d = make_design(doc_id, **kw)
    return {"id": d["id"], "name": d["name"], "width": 1080, "height": 1080, "background": "#ffffff",
            "elements": d["elements"], "metadata": d["metadata"]}


GOOD_TEXT = {"type": "text", "text": "SUMMER SOUND", "x": 80, "y": 100, "width": 900, "height": 40,
             "fontFamily": "Bebas Neue", "fontSize": 160, "fontWeight": 700, "color": "#ffffff", "align": "center"}


# ------------------------------------------------------------- generate

def test_generate_design_returns_a_valid_flat_document(client, user, fake_ai):
    fake_ai.responses["create_design"] = {
        "name": "Summer Sound",
        "background": {"type": "linear", "angle": 90, "stops": [{"offset": 0, "color": "#0b1220"}, {"offset": 1, "color": "#123456"}]},
        "elements": [
            {"type": "shape", "shape": "ellipse", "x": 600, "y": 500, "width": 700, "height": 700, "fill": "#f4b942"},
            GOOD_TEXT,
            {"type": "text", "text": "   ", "x": 0, "y": 0, "width": 10, "height": 10},          # empty -> dropped
            {"type": "video", "x": 0, "y": 0, "width": 10, "height": 10},                          # unknown type -> dropped
            "garbage",
        ],
    }
    r = client.post("/ai/generate-design", json={"prompt": "music festival poster", "formatId": "instagram-post"})
    assert r.status_code == 200, r.text
    doc = r.json()
    assert (doc["width"], doc["height"]) == (1080, 1080) and doc["name"] == "Summer Sound"
    assert doc["background"]["type"] == "linear" and doc["metadata"]["format"] == "instagram-post"
    assert [e["type"] for e in doc["elements"]] == ["shape", "text"]
    assert [e["z"] for e in doc["elements"]] == [0, 1]
    assert len({e["id"] for e in doc["elements"]}) == 2 and re.match(r"^doc_", doc["id"])
    text = doc["elements"][1]
    assert text["fontFamily"] == "Bebas Neue" and text["fontWeight"] == 400  # snapped to a weight the font has
    assert text["height"] >= 160 * 1.15  # box grown to fit the copy
    # the model call was made with the right canvas + a stronger model than the cheap tier
    call = fake_ai.calls[0]
    assert "1080x1080" in call["system"] and "music festival poster" in call["user"]


def test_generate_sanitises_hostile_model_output(client, user, fake_ai):
    fake_ai.responses["create_design"] = {
        "name": "<script>x</script>" + "n" * 500,
        "background": "url(javascript:alert(1))",
        "elements": [{**GOOD_TEXT, "fontFamily": "Comic Sans", "color": "red; x", "fontSize": 99999, "x": 1e12,
                      "width": float("inf"), "text": "hi\x00\x07 there"}],
    }
    doc = client.post("/ai/generate-design", json={"prompt": "x"}).json()
    el = doc["elements"][0]
    assert doc["background"] == "#ffffff" and len(doc["name"]) <= 80
    assert el["fontFamily"] == "Inter" and el["color"] == "#111111" and el["fontSize"] == 1200
    assert el["x"] <= 1080 * 1.5 and el["width"] == 100 and el["text"] == "hi there"


def test_generate_uses_brand_kit_only_if_owned(client, user, other_client, fake_ai):
    fake_ai.responses["create_design"] = {"name": "n", "background": "#fff", "elements": [GOOD_TEXT]}
    kit = client.get("/brand-kits").json()[0]
    kit["business"]["companyName"] = "Acme Corp"
    client.put(f"/brand-kits/{kit['id']}", json=kit)
    client.post("/ai/generate-design", json={"prompt": "flyer", "brandKitId": kit["id"]})
    assert "Acme Corp" in fake_ai.calls[-1]["user"] and "#4f46e5" in fake_ai.calls[-1]["user"]
    other_client.post("/ai/generate-design", json={"prompt": "flyer", "brandKitId": kit["id"]})
    assert "Acme Corp" not in fake_ai.calls[-1]["user"]  # someone else's kit never reaches the prompt


def test_generate_validation(client, user, fake_ai):
    assert client.post("/ai/generate-design", json={"prompt": ""}).status_code == 422
    assert client.post("/ai/generate-design", json={"prompt": "x" * 1001}).status_code == 422
    assert client.post("/ai/generate-design", json={"prompt": "x", "formatId": "nope"}).status_code == 400
    fake_ai.responses["create_design"] = {"name": "n", "background": "#fff", "elements": [{"type": "video"}]}
    assert client.post("/ai/generate-design", json={"prompt": "x"}).status_code == 502


# ------------------------------------------------------------- modify

def _group_doc():
    child = lambda i, x: {"id": f"shp_{i}", "type": "shape", "shape": "rect", "x": x, "y": 100, "width": 50, "height": 50,
                          "rotation": 0, "opacity": 1, "z": i, "fill": "#000000"}
    return flat(elements=[
        flat()["elements"][0],
        {"id": "grp_1", "type": "group", "x": 100, "y": 100, "width": 150, "height": 50, "rotation": 0, "opacity": 1,
         "z": 1, "children": [child(1, 100), child(2, 200)]},
        {"id": "ima_1", "type": "image", "x": 0, "y": 0, "width": 100, "height": 100, "rotation": 0, "opacity": 1, "z": 2,
         "src": "data:image/png;base64," + "A" * 5000, "fit": "cover"},
    ])


def test_modify_applies_validated_operations_and_keeps_everything_else(client, user, fake_ai):
    fake_ai.responses["edit_design"] = {"operations": [
        {"op": "update", "id": "txt_1", "set": {"text": "Bigger!", "fontSize": 96, "color": "#ff0000", "fontWeight": 800,
                                                  "id": "txt_hacked", "type": "shape", "src": "x"}},
        {"op": "update", "id": "grp_1", "set": {"x": 300, "y": 400}},
        {"op": "update", "id": "shp_2", "set": {"fill": {"type": "radial", "stops": [{"offset": 0, "color": "#fff"}, {"offset": 1, "color": "#000"}]}}},
        {"op": "update", "id": "missing", "set": {"x": 1}},
        {"op": "remove", "id": "shp_1"},
        {"op": "add", "element": {"type": "shape", "shape": "star", "x": 5, "y": 5, "width": 50, "height": 50, "starPoints": 7, "fill": "#abcdef"}},
    ], "background": "#101010"}
    r = client.post("/ai/modify-design", json={"design": _group_doc(), "instruction": "make it pop"})
    assert r.status_code == 200, r.text
    doc = r.json()
    by_id = {e["id"]: e for e in doc["elements"]}
    t = by_id["txt_1"]
    assert (t["text"], t["fontSize"], t["color"], t["type"], t["id"]) == ("Bigger!", 96, "#ff0000", "text", "txt_1")
    assert t["fontWeight"] == 800 and "src" not in t
    assert doc["background"] == "#101010"
    # images are untouched, including the (huge) data URL the model never saw
    assert by_id["ima_1"]["src"].endswith("A" * 5000)
    # group moved as a unit: remaining child + group box follow the new origin
    grp = by_id["grp_1"]
    assert len(grp["children"]) == 1 and grp["children"][0]["id"] == "shp_2"
    assert (grp["x"], grp["y"]) == (grp["children"][0]["x"], grp["children"][0]["y"]) == (400, 400)
    assert grp["children"][0]["fill"]["type"] == "radial"
    star = [e for e in doc["elements"] if e["type"] == "shape"][0]
    assert star["points"] == 7 and star["z"] == 3
    # the prompt never contained the image bytes
    assert "AAAAAAAAAA" not in fake_ai.calls[0]["user"] and "make it pop" in fake_ai.calls[0]["user"]


def test_modify_with_nothing_applicable_is_a_clear_error(client, user, fake_ai):
    fake_ai.responses["edit_design"] = {"operations": [{"op": "update", "id": "nope", "set": {"x": 1}}]}
    r = client.post("/ai/modify-design", json={"design": flat(), "instruction": "x"})
    assert r.status_code == 422 and "couldn't" in r.json()["message"]


def test_modify_rejects_oversized_designs(client, user, fake_ai):
    els = [{**flat()["elements"][0], "id": f"txt_{i}"} for i in range(201)]
    assert client.post("/ai/modify-design", json={"design": flat(elements=els), "instruction": "x"}).status_code == 400


# ------------------------------------------------------------- resize / copy / suggest / image

def test_resize_is_deterministic_and_costs_no_model_call(client, user, fake_ai):
    r = client.post("/ai/resize-design", json={"design": flat(), "formatId": "youtube-thumbnail"})
    doc = r.json()
    assert (doc["width"], doc["height"], doc["metadata"]["format"]) == (1280, 720, "youtube-thumbnail")
    t = doc["elements"][0]
    pad = 720 * 0.06
    assert t["x"] >= pad and t["y"] >= pad and t["x"] + t["width"] <= 1280 - pad and t["y"] + t["height"] <= 720 - pad
    assert fake_ai.calls == []
    assert client.post("/ai/resize-design", json={"design": flat(), "formatId": "nope"}).status_code == 400


def test_copy_dedupes_trims_and_uses_the_fast_model(client, user, fake_ai):
    fake_ai.responses["submit_copy"] = {"variants": ["Join us", "join us", "  Come along  ", "x" * 999, ""]}
    r = client.post("/ai/copy", json={"prompt": "church youth night", "kind": "cta", "tone": "warm", "count": 3})
    v = r.json()
    assert v["kind"] == "cta" and v["variants"][:2] == ["Join us", "Come along"] and len(v["variants"]) == 3
    assert max(map(len, v["variants"])) <= 60  # cta length cap x2
    assert fake_ai.calls[0]["model"] == "claude-haiku-4-5-20251001"
    assert client.post("/ai/copy", json={"prompt": "x", "kind": "tweet"}).status_code == 422


def test_suggest_drops_invented_element_ids(client, user, fake_ai):
    fake_ai.responses["submit_suggestions"] = {"suggestions": [
        {"severity": "warning", "title": "Low contrast", "detail": "Darken the text.", "elementIds": ["txt_1", "ghost"]},
        {"severity": "catastrophic", "title": "Odd", "detail": "d"},
        {"severity": "good", "detail": "no title -> dropped"},
    ]}
    out = client.post("/ai/suggest", json={"design": flat()}).json()
    assert [s["severity"] for s in out] == ["warning", "info"]
    assert out[0]["elementIds"] == ["txt_1"] and "elementIds" not in out[1] and out[0]["id"] == "ai-0"


def test_image_is_sanitised_svg_data_url(client, user, fake_ai):
    fake_ai.responses["submit_svg"] = {"svg": '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script>'
                                              '<circle cx="5" cy="5" r="4" fill="#f00" onclick="x()"/></svg>'}
    r = client.post("/ai/image", json={"prompt": "sunrise", "width": 512, "height": 256})
    body = r.json()
    assert (body["width"], body["height"]) == (512, 256) and body["src"].startswith("data:image/svg+xml;base64,")
    import base64
    svg = base64.b64decode(body["src"].split(",")[1]).decode()
    assert "script" not in svg and "onclick" not in svg and 'viewBox="0 0 512 256"' in svg and "<circle" in svg
    fake_ai.responses["submit_svg"] = {"svg": "not xml"}
    assert client.post("/ai/image", json={"prompt": "x"}).status_code == 502


# ------------------------------------------------------------- access, limits, failure modes

def test_ai_requires_auth_and_configuration(client):
    assert client.post("/ai/generate-design", json={"prompt": "x"}).status_code == 401
    from tests.conftest import _signup
    _signup(client)
    r = client.post("/ai/generate-design", json={"prompt": "x"})  # no fake provider, no API key
    assert r.status_code == 503 and r.json()["message"] == "AI is not configured on this server."
    assert client.get("/ai/status").json()["available"] is False


def test_per_minute_and_daily_limits(client, user, fake_ai, monkeypatch):
    from app.config import get_settings
    fake_ai.responses["submit_copy"] = {"variants": ["a"]}
    monkeypatch.setattr(get_settings(), "ai_per_minute_limit", 2)
    ok = [client.post("/ai/copy", json={"prompt": "x", "kind": "cta"}).status_code for _ in range(3)]
    assert ok == [200, 200, 429]
    monkeypatch.setattr(get_settings(), "ai_per_minute_limit", 100)
    monkeypatch.setattr(get_settings(), "ai_daily_limit", 2)
    assert client.post("/ai/copy", json={"prompt": "x", "kind": "cta"}).status_code == 429


def test_failed_provider_calls_still_count_and_never_leak_details(client, user, fake_ai, monkeypatch):
    from app.config import get_settings
    fake_ai.error = AIProviderError(503, "The AI service is busy. Please try again in a moment.")
    r = client.post("/ai/copy", json={"prompt": "x", "kind": "cta"})
    assert r.status_code == 503 and r.json() == {"message": "The AI service is busy. Please try again in a moment."}
    monkeypatch.setattr(get_settings(), "ai_daily_limit", 1)
    assert client.post("/ai/copy", json={"prompt": "x", "kind": "cta"}).status_code == 429


def test_usage_is_recorded_per_user(client, user, fake_ai):
    from sqlalchemy import select
    from app import db as dbmod
    from app.models import AIUsage
    fake_ai.responses["submit_copy"] = {"variants": ["a"]}
    client.post("/ai/copy", json={"prompt": "x", "kind": "cta"})
    with next(dbmod.get_db()) as db:
        rows = db.scalars(select(AIUsage)).all()
    assert len(rows) == 1 and rows[0].user_id == user["id"] and (rows[0].input_tokens, rows[0].output_tokens) == (100, 50)


def test_modify_only_allows_properties_valid_for_the_element_type(client, user, fake_ai):
    doc = _group_doc()
    doc["elements"].append({"id": "shp_9", "type": "shape", "shape": "rect", "x": 0, "y": 0, "width": 10, "height": 10,
                            "rotation": 0, "opacity": 1, "z": 9, "fill": "#000000"})
    fake_ai.responses["edit_design"] = {"operations": [
        {"op": "update", "id": "shp_9", "set": {"text": "smuggled", "fontSize": 90, "fontFamily": "Inter", "fill": "#ffffff"}},
        {"op": "update", "id": "txt_1", "set": {"fill": "#ffffff", "shape": "star", "cornerRadius": 5, "color": "#222222"}},
        {"op": "update", "id": "grp_1", "set": {"width": 1, "height": 1, "fill": "#fff", "text": "nope", "opacity": 0.5}},
        {"op": "update", "id": "ima_1", "set": {"text": "nope", "color": "#fff", "alt": "A photo", "fit": "contain"}},
    ]}
    out = {e["id"]: e for e in client.post("/ai/modify-design", json={"design": doc, "instruction": "x"}).json()["elements"]}
    assert out["shp_9"]["fill"] == "#ffffff" and not {"text", "fontSize", "fontFamily"} & set(out["shp_9"])
    assert out["txt_1"]["color"] == "#222222" and not {"fill", "shape", "cornerRadius"} & set(out["txt_1"])
    assert out["grp_1"]["opacity"] == 0.5 and (out["grp_1"]["width"], out["grp_1"]["height"]) == (150, 50)
    assert "fill" not in out["grp_1"] and "text" not in out["grp_1"]
    assert out["ima_1"]["alt"] == "A photo" and out["ima_1"]["fit"] == "contain" and "text" not in out["ima_1"] and "color" not in out["ima_1"]
