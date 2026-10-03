"""End-to-end smoke test against a running DesignForge API.

Run: python smoke_test.py [base_url]
Uses only stdlib so it needs no extra dependencies.
"""

from __future__ import annotations

import io
import json
import sys
import urllib.error
import urllib.request
import uuid
from http.cookiejar import CookieJar

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"
JAR = CookieJar()
OPENER = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(JAR))
PASSWORD = "Sup3rSecret!23"

passed = 0
failed: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    global passed
    if condition:
        passed += 1
        print(f"  PASS  {label}")
    else:
        failed.append(label)
        print(f"  FAIL  {label} {detail}")


def call(method: str, path: str, body=None, expect_json=True):
    url = f"{BASE}{path}"
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode()
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with OPENER.open(req, timeout=30) as resp:
            raw = resp.read()
            if not expect_json:
                return resp.status, raw, resp.headers
            return resp.status, (json.loads(raw) if raw else None), resp.headers
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        try:
            return exc.code, json.loads(raw), exc.headers
        except Exception:
            return exc.code, raw, exc.headers


def upload_multipart(path: str, filename: str, content: bytes, ctype: str):
    boundary = "----smoke" + uuid.uuid4().hex
    parts: list[bytes] = []
    parts.append(f"--{boundary}\r\n".encode())
    parts.append(
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode()
    )
    parts.append(f"Content-Type: {ctype}\r\n\r\n".encode())
    parts.append(content)
    parts.append(f"\r\n--{boundary}--\r\n".encode())
    body = b"".join(parts)
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with OPENER.open(req, timeout=60) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read()


def png_bytes(w: int, h: int, color: tuple[int, int, int]) -> bytes:
    """Minimal valid PNG without needing Pillow here."""
    import struct
    import zlib

    raw = b""
    for _ in range(h):
        raw += b"\x00" + bytes(color) * w

    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw))
        + chunk(b"IEND", b"")
    )


print(f"DesignForge smoke test -> {BASE}\n")

# ---------------------------------------------------------------- health
print("health")
status, body, _ = call("GET", "/health")
check("GET /health", status == 200 and body.get("status") == "ok", f"got {status} {body}")

# ---------------------------------------------------------------- auth
print("\nauth")
email = f"smoke-{uuid.uuid4().hex[:10]}@example.com"
status, user, _ = call(
    "POST", "/auth/sign-up", {"email": email, "password": PASSWORD, "name": "Smoke"}
)
check("POST /auth/sign-up", status == 200 and user.get("email") == email, f"got {status} {user}")
user_id = (user or {}).get("id")

status, me, _ = call("GET", "/auth/me")
check("GET /auth/me (cookie session)", status == 200 and me.get("email") == email, f"got {status} {me}")

status, patched, _ = call("PATCH", "/auth/me", {"name": "Renamed Smoke"})
check("PATCH /auth/me", status == 200 and patched.get("name") == "Renamed Smoke", f"got {status}")

status, _, _ = call("POST", "/auth/sign-out")
check("POST /auth/sign-out", status == 200, f"got {status}")
status, _, _ = call("GET", "/auth/me")
check("session invalidated after sign-out", status in (401, 404), f"got {status}")

status, _, _ = call("POST", "/auth/sign-in", {"email": email, "password": PASSWORD})
check("POST /auth/sign-in", status == 200, f"got {status}")

status, _, _ = call("POST", "/auth/sign-in", {"email": email, "password": "wrong-password"})
check("wrong password rejected", status in (400, 401, 403), f"got {status}")

# ---------------------------------------------------------------- templates
print("\ntemplates")
status, page, _ = call("GET", "/templates")
check("GET /templates", status == 200 and page.get("total") == 12, f"got {status} total={page.get('total') if isinstance(page, dict) else page}")
templates = page.get("items") if isinstance(page, dict) else []
check("12 templates listed", len(templates) == 12, f"got {len(templates)}")

status, cats, _ = call("GET", "/templates/categories")
check("GET /templates/categories", status == 200 and len(cats) == 12, f"got {status} n={len(cats) if isinstance(cats, list) else cats}")

status, filtered, _ = call("GET", "/templates?category=church")
check("filter by category", status == 200 and filtered.get("total", 0) >= 1, f"got {filtered}")

status, searched, _ = call("GET", "/templates?search=church")
check("search filter", status == 200 and searched.get("total", 0) >= 1, f"got {searched}")

tpl_id = templates[0]["id"]
status, one, _ = call("GET", f"/templates/{tpl_id}")
check(f"GET /templates/{tpl_id}", status == 200 and one.get("id") == tpl_id, f"got {status}")

status, inst, _ = call("POST", f"/templates/{tpl_id}/instantiate", {"name": "Smoke Design"})
elements = (inst or {}).get("elements") or []
check("POST instantiate returns flat document", status == 200 and len(elements) > 0, f"got {status} n={len(elements)}")
check("instantiate reassigns ids", all(e.get("id") for e in elements if isinstance(e, dict)))

doc = {
    "version": 1,
    "id": inst["id"],
    "name": "Smoke Design",
    "canvas": {"width": inst.get("width", 1080), "height": inst.get("height", 1080)},
    "background": inst.get("background", "#ffffff"),
    "elements": elements,
    "metadata": {"format": "Instagram Post", "category": "Social Media", "tags": ["smoke"]},
}

# ---------------------------------------------------------------- projects
print("\nprojects")
status, saved, _ = call("PUT", f"/projects/{doc['id']}", doc)
check("PUT /projects/{id} (upsert)", status == 200 and saved.get("id") == doc["id"], f"got {status} {saved}")
project_id = doc["id"]

status, listing, _ = call("GET", "/projects")
check("GET /projects", status == 200 and isinstance(listing, list) and len(listing) >= 1, f"got {status}")
summary = next((p for p in listing if p.get("id") == project_id), None)
check("summary has elementCount + thumbnail-safe metadata", summary is not None and summary.get("elementCount", 0) > 0, f"{summary}")
check("summary format/category parsed from metadata", summary is not None and summary.get("format") == "Instagram Post", f"{summary.get('format') if summary else None}")

status, got, _ = call("GET", f"/projects/{project_id}")
check("GET /projects/{id} returns flat doc", status == 200 and got.get("width") and got.get("elements"), f"got {status}")

status, _, _ = call("PATCH", f"/projects/{project_id}", {"name": "Renamed Design"})
check("PATCH rename", status == 200, f"got {status}")
status, got, _ = call("GET", f"/projects/{project_id}")
check("rename persisted", got.get("name") == "Renamed Design", f"got {got.get('name')}")

status, dup, _ = call("POST", f"/projects/{project_id}/duplicate", {})
check("POST duplicate", status == 200 and dup.get("id") != project_id, f"got {status} id={dup.get('id')}")
dup_id = dup.get("id")
check("duplicate keeps elements", len(dup.get("elements") or []) == len(elements), "element count mismatch")

# round-trip: save again with an extra element, confirm it persists
doc2 = dict(doc)
doc2["name"] = "Second Save"
doc2["elements"] = elements + [
    {"id": "smoke_rect_1", "type": "shape", "x": 10, "y": 10, "width": 100, "height": 60, "fill": "#ff0000"}
]
status, _, _ = call("PUT", f"/projects/{project_id}", doc2)
status, got, _ = call("GET", f"/projects/{project_id}")
check("update persists new element", len(got.get("elements") or []) == len(elements) + 1, f"got {len(got.get('elements') or [])}")

# ---------------------------------------------------------------- isolation
print("\nuser isolation")
other = f"other-{uuid.uuid4().hex[:10]}@example.com"
call("POST", "/auth/sign-up", {"email": other, "password": PASSWORD, "name": "Other"})
call("POST", "/auth/sign-in", {"email": other, "password": PASSWORD})
status, _, _ = call("GET", f"/projects/{project_id}")
check("other user cannot read the project (404, not 403)", status == 404, f"got {status}")
status, other_list, _ = call("GET", "/projects")
check("other user sees empty project list", isinstance(other_list, list) and len(other_list) == 0, f"got {other_list}")
call("POST", "/auth/sign-out")
call("POST", "/auth/sign-in", {"email": email, "password": PASSWORD})
status, _, _ = call("GET", f"/projects/{project_id}")
check("original user still has access", status == 200, f"got {status}")

# ---------------------------------------------------------------- assets
print("\nassets")
status, uploaded = upload_multipart(
    "/assets", "smoke.png", png_bytes(8, 8, (0, 128, 255)), "image/png"
)
check("POST /assets upload PNG", status == 200 and uploaded.get("id"), f"got {status} {uploaded}")
asset_id = (uploaded or {}).get("id")
key = (uploaded or {}).get("key")

if key:
    status, raw, headers = call("GET", f"/files/{key}", expect_json=False)
    check("GET /files/{key} serves the upload", status == 200 and raw[:4] == b"\x89PNG", f"got {status}")

status, renamed, _ = call("PATCH", f"/assets/{asset_id}", {"name": "renamed.png"})
check("PATCH /assets/{id} rename", status == 200, f"got {status}")

status, reg, _ = call(
    "POST", "/assets/register",
    {"src": f"{BASE}/files/{key}", "name": "registered.png"} if key else {},
)
check("POST /assets/register", status == 200, f"got {status} {reg}")

# reject a fake image
status, _ = upload_multipart("/assets", "evil.png", b"not an image at all", "image/png")
check("corrupt upload rejected", status >= 400, f"got {status}")

# reject an oversized/zip-bomb-ish file is covered by unit tests

# ---------------------------------------------------------------- brand kits
print("\nbrand kits")
status, kit, _ = call(
    "POST", "/brand-kits",
    {"name": "Smoke Kit", "colors": ["#ff0000", "#00ff00"], "fonts": ["Inter"]},
)
check("POST /brand-kits", status == 200 and kit.get("id"), f"got {status} {kit}")
kit_id = kit.get("id")
check("brand kit stores colors", len(kit.get("colors") or []) == 2)

status, kits, _ = call("GET", "/brand-kits")
check("GET /brand-kits", status == 200 and isinstance(kits, list), f"got {status}")

status, kit2, _ = call("PATCH", f"/brand-kits/{kit_id}", {"name": "Smoke Kit v2", "colors": ["#0000ff"]})
check("PATCH /brand-kits/{id}", status == 200 and kit2.get("name") == "Smoke Kit v2", f"got {status}")

status, _, _ = call("POST", f"/brand-kits/{kit_id}/activate", {})
check("POST activate", status == 200, f"got {status}")
status, active, _ = call("GET", "/brand-kits/active")
check("GET /brand-kits/active", status == 200 and (active or {}).get("id") == kit_id, f"got {status} {active}")

# ---------------------------------------------------------------- ai
print("\nai")
status, ai_status, _ = call("GET", "/ai/status")
check("GET /ai/status", status == 200, f"got {status}")
configured = bool((ai_status or {}).get("configured") or (ai_status or {}).get("ai_configured"))
print(f"        -> AI configured: {configured}  ({json.dumps(ai_status)})")

status, resized, _ = call(
    "POST", "/ai/resize-design", {"document": inst, "width": 1080, "height": 1080}
)
rdoc = (resized or {}).get("document") or {}
check("POST /ai/resize-design (deterministic)", status == 200 and rdoc.get("width") == 1080, f"got {status} {resized}")

if configured:
    status, gen, _ = call(
        "POST", "/ai/generate-design", {"prompt": "a minimal blue poster"}
    )
    check("POST /ai/generate-design (live model)", status == 200 and (gen or {}).get("document"), f"got {status} {json.dumps(gen)[:300]}")
    status, copy, _ = call("POST", "/ai/copy", {"text": "Grand Opening", "kind": "headline"})
    check("POST /ai/copy (fast model)", status == 200, f"got {status} {json.dumps(copy)[:300]}")
else:
    status, gen, _ = call("POST", "/ai/generate-design", {"prompt": "a blue poster"})
    check("unconfigured AI returns a clean 503", status == 503, f"got {status} {json.dumps(gen)[:200]}")

# ---------------------------------------------------------------- limits
print("\nvalidation & limits")
status, _, _ = call("POST", "/auth/sign-up", {"email": "not-an-email", "password": PASSWORD})
check("invalid email rejected", status >= 400, f"got {status}")
status, _, _ = call("POST", "/auth/sign-up", {"email": f"x{uuid.uuid4().hex[:8]}@example.com", "password": "short"})
check("weak password rejected", status >= 400, f"got {status}")
status, _, _ = call("PUT", "/projects/bad id with spaces", {**doc, "id": "bad id with spaces"})
check("project id pattern enforced", status >= 400, f"got {status}")

# ---------------------------------------------------------------- cleanup
print("\ncleanup")
for pid in filter(None, [dup_id, project_id]):
    call("DELETE", f"/projects/{pid}")
call("DELETE", f"/brand-kits/{kit_id}")
if asset_id:
    call("DELETE", f"/assets/{asset_id}")
status, final_list, _ = call("GET", "/projects")
check("projects cleaned up", isinstance(final_list, list) and len(final_list) == 0, f"got {final_list}")

# ---------------------------------------------------------------- result
print(f"\n{'=' * 46}")
print(f"passed: {passed}   failed: {len(failed)}")
if failed:
    for f in failed:
        print(f"  FAILED: {f}")
    sys.exit(1)
print("ALL CHECKS PASSED")