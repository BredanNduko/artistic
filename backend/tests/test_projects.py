from tests.conftest import make_design


def test_save_list_get_roundtrip(client, user):
    design = make_design(thumbnail="data:image/png;base64,AAAA", format="instagram-post", category="church")
    r = client.put("/projects/doc_1", json=design)
    assert r.status_code == 200
    s = r.json()
    assert s["id"] == "doc_1" and s["elementCount"] == 1 and s["format"] == "instagram-post"
    assert s["thumbnail"].startswith("data:image/png") and s["tags"] == ["t"]

    listing = client.get("/projects").json()
    assert [p["id"] for p in listing] == ["doc_1"]

    doc = client.get("/projects/doc_1").json()
    # GET returns the flat DesignDocument shape the editor expects (not the {canvas} wire shape)
    assert doc["width"] == 1080 and doc["height"] == 1080 and "canvas" not in doc
    assert doc["elements"][0]["text"] == "Hello" and doc["metadata"]["thumbnail"].startswith("data:image/png")


def test_save_updates_in_place_and_stamps_updated_at(client, user):
    client.put("/projects/doc_1", json=make_design())
    d2 = make_design(name="Renamed")
    client.put("/projects/doc_1", json=d2)
    assert len(client.get("/projects").json()) == 1
    doc = client.get("/projects/doc_1").json()
    assert doc["name"] == "Renamed" and doc["metadata"]["updatedAt"] != "2026-01-01T00:00:00Z"


def test_unknown_project_is_null(client, user):
    r = client.get("/projects/nope")
    assert r.status_code == 200 and r.json() is None


def test_id_mismatch_and_invalid_payload(client, user):
    assert client.put("/projects/other", json=make_design("doc_1")).status_code == 400
    bad = make_design()
    bad["canvas"] = {"width": 0, "height": 10}
    assert client.put("/projects/doc_1", json=bad).status_code == 422
    assert client.put("/projects/bad id!", json=make_design("bad id!")).status_code == 422


def test_users_cannot_touch_each_others_projects(client, user, other_client):
    client.put("/projects/doc_1", json=make_design(name="Mine"))
    assert other_client.get("/projects/doc_1").json() is None
    assert other_client.get("/projects").json() == []
    assert other_client.put("/projects/doc_1", json=make_design(name="Hijack")).status_code == 404
    assert other_client.patch("/projects/doc_1", json={"name": "x"}).status_code == 404
    assert other_client.post("/projects/doc_1/duplicate").json() is None
    other_client.delete("/projects/doc_1")  # no-op for a non-owner
    assert client.get("/projects/doc_1").json()["name"] == "Mine"


def test_rename_duplicate_delete(client, user):
    client.put("/projects/doc_1", json=make_design(thumbnail="data:image/png;base64,AAAA"))
    assert client.patch("/projects/doc_1", json={"name": "New name"}).status_code == 204
    assert client.get("/projects/doc_1").json()["name"] == "New name"

    copy = client.post("/projects/doc_1/duplicate").json()
    assert copy["id"] != "doc_1" and copy["name"] == "New name copy"
    assert copy["metadata"]["forkedFrom"] == "doc_1" and "thumbnail" not in copy["metadata"]
    assert len(client.get("/projects").json()) == 2

    assert client.delete("/projects/doc_1").status_code == 204
    assert client.delete("/projects/doc_1").status_code == 204  # idempotent
    assert [p["id"] for p in client.get("/projects").json()] == [copy["id"]]


def test_project_limit(client, user, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "max_projects_per_user", 1)
    assert client.put("/projects/doc_1", json=make_design()).status_code == 200
    assert client.put("/projects/doc_2", json=make_design("doc_2")).status_code == 409
    assert client.put("/projects/doc_1", json=make_design()).status_code == 200  # updating is still fine
