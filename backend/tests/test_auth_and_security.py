from fastapi.testclient import TestClient

from app.main import app
from tests.conftest import _signup


def test_me_is_null_when_signed_out(client):
    r = client.get("/auth/me")
    assert r.status_code == 200 and r.json() is None


def test_signup_signin_signout_flow(client):
    u = _signup(client)
    assert u["email"] == "a@example.com" and u["plan"] == "free" and "password" not in str(u)
    assert client.get("/auth/me").json()["id"] == u["id"]

    assert client.post("/auth/sign-out").status_code == 204
    assert client.get("/auth/me").json() is None

    assert client.post("/auth/sign-in", json={"email": "A@Example.com", "password": "correct horse"}).status_code == 200
    assert client.get("/auth/me").json()["id"] == u["id"]  # email is case-insensitive


def test_bad_credentials_are_generic(client, user):
    c2 = TestClient(app)
    wrong_pw = c2.post("/auth/sign-in", json={"email": "a@example.com", "password": "nope-nope"})
    no_user = c2.post("/auth/sign-in", json={"email": "ghost@example.com", "password": "nope-nope"})
    assert wrong_pw.status_code == no_user.status_code == 401
    assert wrong_pw.json() == no_user.json()


def test_duplicate_email_and_weak_password(client, user):
    assert client.post("/auth/sign-up", json={"email": "a@example.com", "password": "another-pass"}).status_code == 409
    r = client.post("/auth/sign-up", json={"email": "c@example.com", "password": "short"})
    assert r.status_code == 422 and r.json()["message"].startswith("Invalid request: password")


def test_profile_patch_ignores_privileged_fields(client, user):
    r = client.patch("/auth/me", json={"name": "Ada L", "plan": "team", "email": "x@y.z", "id": "usr_hack"})
    body = r.json()
    assert body["name"] == "Ada L" and body["plan"] == "free" and body["email"] == "a@example.com" and body["id"] == user["id"]


def test_login_rate_limit(client):
    for _ in range(10):
        client.post("/auth/sign-in", json={"email": "z@example.com", "password": "x"})
    r = client.post("/auth/sign-in", json={"email": "z@example.com", "password": "x"})
    assert r.status_code == 429 and "Retry-After" in r.headers


def test_bearer_token_also_works(client, user):
    token = client.cookies.get("df_session")
    fresh = TestClient(app)
    assert fresh.get("/projects").status_code == 401
    assert fresh.get("/projects", headers={"Authorization": f"Bearer {token}"}).status_code == 200


def test_unauthenticated_error_shape_matches_frontend_client(client):
    r = client.get("/projects")
    assert r.status_code == 401 and set(r.json()) == {"message"}


def test_cors_allows_the_frontend_origin_with_credentials(client):
    r = client.options("/projects", headers={"Origin": "http://localhost:5173", "Access-Control-Request-Method": "PUT",
                                              "Access-Control-Request-Headers": "content-type"})
    assert r.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert r.headers["access-control-allow-credentials"] == "true"
    bad = client.options("/projects", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert "access-control-allow-origin" not in bad.headers


def test_oversized_body_rejected(client, user, monkeypatch):
    from app.config import get_settings
    monkeypatch.setattr(get_settings(), "max_body_bytes", 1000)
    r = client.put("/projects/doc_big", json={"x": "y" * 5000})
    assert r.status_code == 413 and r.json() == {"message": "Request body is too large."}
