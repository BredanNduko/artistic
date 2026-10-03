import base64
import io

from PIL import Image

from tests.conftest import make_design


def png_bytes(w=40, h=20, color=(200, 30, 30)):
    buf = io.BytesIO()
    Image.new("RGB", (w, h), color).save(buf, "PNG")
    return buf.getvalue()


def upload(c, data, name="pic.png", mime="image/png", **form):
    return c.post("/assets", files={"file": (name, data, mime)}, data=form)


# ---------------------------------------------------------------- assets

def test_upload_serves_file_and_reports_real_dimensions(client, user):
    r = upload(client, png_bytes(40, 20), kind="image")
    assert r.status_code == 200
    a = r.json()
    assert (a["width"], a["height"], a["mimeType"], a["generatedBy"]) == (40, 20, "image/png", "upload")
    assert a["name"] == "pic" and a["src"].startswith("http://testserver/files/")

    f = client.get(a["src"].replace("http://testserver", ""))
    assert f.status_code == 200 and f.headers["content-type"] == "image/png"
    assert f.headers["cross-origin-resource-policy"] == "cross-origin" and f.headers["x-content-type-options"] == "nosniff"
    assert f.content == png_bytes(40, 20)
    assert [x["id"] for x in client.get("/assets").json()] == [a["id"]]
    assert client.get("/assets?kind=logo").json() == []


def test_content_sniffing_beats_declared_mime_type(client, user):
    r = upload(client, b"<html><script>alert(1)</script></html>", name="x.png", mime="image/png")
    assert r.status_code == 400 and "Unsupported" in r.json()["message"]
    assert upload(client, b"", name="e.png").status_code == 400
    assert upload(client, b"\x89PNG\r\n\x1a\n" + b"garbage", name="c.png").status_code == 400  # corrupt


def test_svg_upload_is_sanitised(client, user):
    evil = (b'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" onload="alert(1)">'
            b'<script>alert(2)</script><rect width="10" height="10" fill="red" onclick="x()"/>'
            b'<image href="https://tracker.example/p.png"/></svg>')
    a = upload(client, evil, name="v.svg", mime="image/svg+xml").json()
    body = client.get(a["src"].replace("http://testserver", "")).text
    assert "script" not in body and "onload" not in body and "onclick" not in body and "tracker.example" not in body
    assert "<rect" in body and (a["width"], a["height"]) == (10, 10)
    f = client.get(a["src"].replace("http://testserver", ""))
    assert "sandbox" in f.headers["content-security-policy"]


def test_svg_with_dtd_is_rejected(client, user):
    bomb = b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><svg xmlns="http://www.w3.org/2000/svg">&a;</svg>'
    assert upload(client, bomb, name="b.svg", mime="image/svg+xml").status_code == 400


def test_size_and_kind_limits(client, user, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "max_upload_bytes", 100)
    assert upload(client, png_bytes(200, 200)).status_code == 413
    monkeypatch.setattr(get_settings(), "max_upload_bytes", 8 * 1024 * 1024)
    assert upload(client, png_bytes(), kind="video").status_code == 400
    monkeypatch.setattr(get_settings(), "user_storage_quota_bytes", 10)
    assert upload(client, png_bytes()).status_code == 413


def test_register_data_url_only(client, user):
    src = "data:image/png;base64," + base64.b64encode(png_bytes(8, 8)).decode()
    r = client.post("/assets/register", json={"src": src, "name": "AI art", "width": 8, "height": 8})
    assert r.status_code == 200 and r.json()["generatedBy"] == "ai" and r.json()["tags"] == ["ai"]
    assert client.post("/assets/register", json={"src": "http://169.254.169.254/latest", "width": 1, "height": 1}).status_code == 400
    assert client.post("/assets/register", json={"src": "data:image/png;base64,!!!", "width": 1, "height": 1}).status_code == 400


def test_assets_are_private_and_rename_works(client, user, other_client):
    a = upload(client, png_bytes()).json()
    assert other_client.get("/assets").json() == []
    assert other_client.patch(f"/assets/{a['id']}", json={"name": "x"}).status_code == 404
    other_client.delete(f"/assets/{a['id']}")
    assert len(client.get("/assets").json()) == 1
    assert client.patch(f"/assets/{a['id']}", json={"name": "Renamed"}).status_code == 204
    assert client.get("/assets").json()[0]["name"] == "Renamed"


def test_delete_keeps_file_while_a_design_uses_it(client, user):
    used, unused = upload(client, png_bytes(color=(1, 2, 3))).json(), upload(client, png_bytes(color=(9, 9, 9))).json()
    img = {"id": "ima_1", "type": "image", "x": 0, "y": 0, "width": 10, "height": 10, "rotation": 0, "opacity": 1,
           "z": 0, "src": used["src"], "fit": "cover"}
    client.put("/projects/doc_1", json=make_design(elements=[img]))
    for a in (used, unused):
        assert client.delete(f"/assets/{a['id']}").status_code == 204
    path = lambda a: a["src"].replace("http://testserver", "")
    assert client.get(path(used)).status_code == 200      # still referenced -> design keeps working
    assert client.get(path(unused)).status_code == 404    # unreferenced -> removed
    assert client.get("/assets").json() == []


def test_file_route_blocks_traversal(client):
    assert client.get("/files/..%2F..%2Fetc%2Fpasswd").status_code == 404
    assert client.get("/files/short.png").status_code == 404


# ---------------------------------------------------------------- brand kits

def test_brand_kit_is_seeded_and_crud_works(client, user):
    kits = client.get("/brand-kits").json()
    assert len(kits) == 1 and kits[0]["isDefault"] and len(kits[0]["colors"]) == 4
    active = client.get("/brand-kits/active").json()
    assert active["id"] == kits[0]["id"]

    new = client.post("/brand-kits", json={"name": "Client A"}).json()
    assert client.post(f"/brand-kits/{new['id']}/activate").status_code == 204
    assert client.get("/brand-kits/active").json()["id"] == new["id"]

    new["colors"][0]["value"] = "#112233"
    new["business"]["companyName"] = "Acme"
    saved = client.put(f"/brand-kits/{new['id']}", json=new).json()
    assert saved["colors"][0]["value"] == "#112233" and saved["business"]["companyName"] == "Acme"
    assert client.get(f"/brand-kits/{new['id']}").json()["business"]["companyName"] == "Acme"

    assert client.delete(f"/brand-kits/{new['id']}").status_code == 204
    assert client.get("/brand-kits/active").json()["id"] == kits[0]["id"]  # active cleared -> falls back


def test_deleting_the_last_kit_reseeds_one(client, user):
    only = client.get("/brand-kits").json()[0]
    client.delete(f"/brand-kits/{only['id']}")
    after = client.get("/brand-kits").json()
    assert len(after) == 1 and after[0]["id"] != only["id"]


def test_brand_kit_validation_and_isolation(client, user, other_client):
    kit = client.get("/brand-kits").json()[0]
    bad = {**kit, "colors": [{"id": "c1", "name": "x", "value": "red; background:url(x)"}]}
    assert client.put(f"/brand-kits/{kit['id']}", json=bad).status_code == 422
    assert other_client.get(f"/brand-kits/{kit['id']}").json() is None
    assert other_client.put(f"/brand-kits/{kit['id']}", json=kit).status_code == 404
    assert other_client.post(f"/brand-kits/{kit['id']}/activate").status_code == 404
    assert client.put(f"/brand-kits/other_id", json=kit).status_code == 400


# ---------------------------------------------------------------- templates

def test_templates_are_public_and_filterable(client):
    page = client.get("/templates").json()
    assert page["total"] == 12 and len(page["items"]) == 12
    t = page["items"][0]
    assert set(t) <= {"id", "name", "description", "category", "format", "tags", "featured", "document"}
    assert t["document"]["width"] > 0 and t["document"]["elements"]

    assert client.get("/templates?category=wedding").json()["total"] == 1
    assert client.get("/templates?limit=3&offset=2").json()["items"][0]["id"] == page["items"][2]["id"]
    assert client.get("/templates?search=zzzzqqqq").json()["total"] == 0
    assert client.get("/templates?search=Summer").json()["total"] >= 1
    assert len(client.get("/templates/categories").json()) == 12
    assert client.get(f"/templates/{t['id']}").json()["id"] == t["id"]
    assert client.get("/templates/nope").json() is None


def test_instantiate_gives_fresh_ids_and_never_mutates_the_source(client):
    tid = client.get("/templates").json()["items"][0]["id"]
    a = client.post(f"/templates/{tid}/instantiate", json={}).json()
    b = client.post(f"/templates/{tid}/instantiate", json={"name": "Mine", "id": "doc_evil"}).json()
    src = client.get(f"/templates/{tid}").json()["document"]
    assert a["id"] != b["id"] != src["id"] and b["id"] != "doc_evil" and b["name"] == "Mine"
    assert {e["id"] for e in a["elements"]}.isdisjoint({e["id"] for e in b["elements"]})
    assert {e["id"] for e in a["elements"]}.isdisjoint({e["id"] for e in src["elements"]})
    assert a["metadata"]["visibility"] == "private"
    assert client.post("/templates/nope/instantiate", json={}).json() is None
