import os
import tempfile
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="df-tests-"))
os.environ.update(
    APP_ENV="test",
    SECRET_KEY="test-secret-key-that-is-long-enough-for-hs256-use",
    DATABASE_URL=f"sqlite:///{_TMP}/test.db",
    UPLOAD_DIR=str(_TMP / "uploads"),
    PUBLIC_BASE_URL="http://testserver",
    ANTHROPIC_API_KEY="",
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app import db as dbmod  # noqa: E402
from app.ai.provider import ToolResult, get_provider  # noqa: E402
from app.config import get_settings  # noqa: E402
from app.main import app  # noqa: E402
from app.ratelimit import auth_limiter  # noqa: E402
from app.storage import reset_storage  # noqa: E402


class FakeProvider:
    """Returns canned tool output keyed by tool name; records every call."""

    def __init__(self):
        self.responses: dict[str, dict] = {}
        self.calls: list[dict] = []
        self.error = None

    def run_tool(self, *, model, system, user, tool, max_tokens):
        self.calls.append({"model": model, "system": system, "user": user, "tool": tool.name})
        if self.error:
            raise self.error
        return ToolResult(data=self.responses[tool.name], model=model, input_tokens=100, output_tokens=50)


@pytest.fixture(autouse=True)
def fresh_state(tmp_path):
    get_settings.cache_clear()
    dbmod.init_engine(f"sqlite:///{tmp_path}/t.db")
    dbmod.create_tables()
    os.environ["UPLOAD_DIR"] = str(tmp_path / "uploads")
    get_settings.cache_clear()
    reset_storage()
    auth_limiter.reset()
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


def _signup(c: TestClient, email="a@example.com", name="Ada"):
    r = c.post("/auth/sign-up", json={"email": email, "name": name, "password": "correct horse"})
    assert r.status_code == 200, r.text
    return r.json()


@pytest.fixture
def user(client):
    return _signup(client)


@pytest.fixture
def other_client():
    c = TestClient(app)
    _signup(c, "b@example.com", "Bob")
    return c


@pytest.fixture
def fake_ai():
    fake = FakeProvider()
    app.dependency_overrides[get_provider] = lambda: fake
    return fake


def make_design(doc_id="doc_1", name="Poster", elements=None, **meta):
    return {
        "version": 1,
        "id": doc_id,
        "name": name,
        "canvas": {"width": 1080, "height": 1080},
        "background": "#ffffff",
        "elements": elements if elements is not None else [
            {"id": "txt_1", "type": "text", "x": 10, "y": 10, "width": 400, "height": 60, "rotation": 0,
             "opacity": 1, "z": 0, "text": "Hello", "fontFamily": "Inter", "fontSize": 48, "fontWeight": 700,
             "lineHeight": 1.15, "letterSpacing": 0, "align": "left", "verticalAlign": "top", "color": "#111111"},
        ],
        "metadata": {"createdAt": "2026-01-01T00:00:00Z", "updatedAt": "2026-01-01T00:00:00Z",
                     "tags": ["t"], "visibility": "private", **meta},
    }
