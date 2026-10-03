# DesignForge

A browser-based design tool: pick a template, edit it on an infinite canvas, and use AI to
generate designs, reflow them between formats, and write copy.

Two pieces:

| Folder | What it is | Runs on |
|---|---|---|
| `frontend/` | React 19 + TypeScript + Vite + Tailwind + Konva canvas | http://localhost:5173 |
| `backend/` | Python FastAPI API — auth, storage, database, AI proxy | http://localhost:8000 |

```
Browser ──▶ frontend (Vite, :5173) ──▶ backend (FastAPI, :8000) ──▶ Anthropic API
                    │                       │                            ▲
                    └── localStorage         ├── SQLite (users, designs)  │ API key stays
                       (offline mode)        └── disk (uploads)           │ server-side
```

**The API key never reaches the browser.** The frontend calls your backend, the backend calls
Anthropic. That is the whole reason the AI lives on the server.

---

## Prerequisites

| Tool | Version | Check |
|---|---|---|
| Python | 3.12 or newer | `python --version` |
| Node.js | `^20.19.0` or `>=22.12.0` | `node --version` |
| Docker | optional, only for the container route | `docker --version` |

No database or Redis to install. SQLite and local disk are created for you on first run.

---

## Quick start

Two terminals. Start the **backend first**.

### 1. Backend

```bash
cd backend

python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env              # Windows: copy .env.example .env
uvicorn app.main:app --reload
```

It prints `Uvicorn running on http://localhost:8000`. Confirm it is alive:

```bash
curl http://localhost:8000/health        # -> {"status":"ok"}
```

Interactive API docs are at **http://localhost:8000/docs** (development only — switched off
when `APP_ENV=production`).

### 2. Frontend

```bash
cd frontend

cp .env.example .env              # Windows: copy .env.example .env
npm install
npm run dev
```

Open **http://localhost:5173**.

That one line in `frontend/.env` is what connects the two halves:

```
VITE_API_BASE_URL=http://localhost:8000
```

Without it the app still runs, but fully offline against browser `localStorage` — useful for
UI work, useless for accounts or AI. The UI tells you which mode you are in: **Settings** shows a
backend indicator, and **AI Studio** shows a *Local engine* badge instead of *Provider connected*.

### 3. Make an account

AI, uploads, brand kits and cross-device designs all require sign-in. Click **Sign up** in the
top right. Accounts live in `backend/data/designforge.db`; delete that file to reset everything.

---

## Turning on the AI

The AI is **off until you add an API key**. It is one variable.

### Get a key

Create one at https://console.anthropic.com/settings/keys

### Add it to the backend

Edit `backend/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

Restart the backend (`Ctrl+C`, then `uvicorn app.main:app --reload`). That is the whole setup.

### Confirm it is on

```bash
curl http://localhost:8000/ai/status
```

```json
{ "available": true, "mode": "connected", "provider": "anthropic" }
```

`"available": false` means the key is missing or empty. In the browser, open **AI Studio** —
the badge in its header should read **Provider connected** instead of **Local engine**.

### Choosing models

Defaults in `backend/.env`, both current model IDs:

| Variable | Default | Used for |
|---|---|---|
| `AI_MODEL` | `claude-sonnet-5-5` | Design generation, edits, artwork |
| `AI_FAST_MODEL` | `claude-haiku-4-5-20251001` | Copywriting, design review notes |

The fast model handles the short, frequent calls; the large model handles anything that returns a
whole design. Override either if you want to trade cost against quality.

### What each AI feature calls

| Feature | Endpoint | Model |
|---|---|---|
| Generate a design from a prompt | `POST /ai/generate-design` | `AI_MODEL` |
| Edit a design by instruction | `POST /ai/modify-design` | `AI_MODEL` |
| Generate artwork | `POST /ai/image` | `AI_MODEL` |
| Write headlines, CTAs, captions | `POST /ai/copy` | `AI_FAST_MODEL` |
| Review a design | `POST /ai/suggest` | `AI_FAST_MODEL` |
| Reflow to another format | `POST /ai/resize-design` | **none** — pure geometry |

Reflow is deterministic on purpose: it costs nothing, needs no key, and cannot hallucinate a
layout.

### Cost control

Per user, enforced server-side:

```
AI_PER_MINUTE_LIMIT=10       # requests per minute
AI_DAILY_LIMIT=100           # requests per UTC day, resets midnight
```

The limit is charged **before** the call, so a slow or failing request still counts. Every call
is logged with token counts in the `ai_usage` table.

---

## Verifying the whole thing

**Backend tests** — 55 tests, no API key and no network needed:

```bash
cd backend
pytest
```

**End-to-end smoke test** — exercises a real running server, so start the backend first:

```bash
cd backend
python smoke_test.py                          # defaults to http://localhost:8000
python smoke_test.py http://localhost:8000    # or point it somewhere else
```

It signs up, browses templates, saves and duplicates a project, checks that a second user
*cannot* read the first user's project, uploads an image, round-trips a brand kit, and calls the
AI endpoints. It cleans up after itself.

**Frontend checks**:

```bash
cd frontend
npm run lint
npx tsc -b
npm run build
```

---

## Configuration

Everything is environment variables read from `backend/.env`. Copy `.env.example` and edit.

### Core

| Variable | Default | Notes |
|---|---|---|
| `APP_ENV` | `development` | `production` enables strict startup checks |
| `SECRET_KEY` | insecure dev value | **Required in production.** `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `DATABASE_URL` | `sqlite:///./data/designforge.db` | Point at Postgres for multi-instance |
| `CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated. Must list the real frontend origin |
| `PUBLIC_BASE_URL` | `http://localhost:8000` | Used to build asset URLs the browser loads |

### Session cookie

| Variable | Default | Notes |
|---|---|---|
| `COOKIE_SECURE` | `false` | **Must be `true` in production** |
| `COOKIE_SAMESITE` | `lax` | `none` when frontend and API are on different *sites* |

Local dev is same-site (`localhost:5173` → `localhost:8000`), so `lax` + insecure is correct.

### AI

| Variable | Default |
|---|---|
| `ANTHROPIC_API_KEY` | empty — **AI is off without this** |
| `AI_MODEL` | `claude-sonnet-5-5` |
| `AI_FAST_MODEL` | `claude-haiku-4-5-20251001` |
| `AI_DAILY_LIMIT` | `100` |
| `AI_PER_MINUTE_LIMIT` | `10` |
| `AI_TIMEOUT_SECONDS` | `90` |

### Limits (rarely changed)

| Variable | Default |
|---|---|
| `UPLOAD_DIR` | `./data/uploads` (mounted at `/srv/data` in Docker) |
| `MAX_UPLOAD_BYTES` | 8 MB |
| `MAX_BODY_BYTES` | 30 MB (designs embed images as data URLs) |
| `USER_STORAGE_QUOTA_BYTES` | 500 MB |
| `MAX_PROJECTS_PER_USER` | 500 |
| `MAX_BRAND_KITS_PER_USER` | 20 |

---

## Running with Docker

```bash
cd backend
docker build -t designforge-api .
docker run --rm -p 8000:8000 --env-file .env -v df-data:/srv/data designforge-api
```

The image runs as a non-root user on port 8000. Mount `/srv/data` to keep the database and
uploads across restarts. The `--env-file` flag works the same in PowerShell and bash; pass a
full path to `.env` if the shell has trouble resolving a relative one.

---

## Before deploying

Set these or the server **refuses to start** — that is deliberate:

```
APP_ENV=production
SECRET_KEY=<48+ random characters>
COOKIE_SECURE=true
CORS_ORIGINS=https://your-frontend.example.com
PUBLIC_BASE_URL=https://your-api.example.com
```

Add `COOKIE_SAMESITE=none` when the frontend and API are on different sites.

Scale-out needs three changes: Postgres (`DATABASE_URL`), object storage (three methods in
`app/storage.py`), and Redis for the rate limiter. As written it is single-instance by design —
SQLite wants one writer and the rate limiter is in memory.

---

## Troubleshooting

**`/ai/status` says `available: false`**
`ANTHROPIC_API_KEY` is empty or missing. Check `backend/.env` — not the frontend one — and
restart the backend. Uvicorn does not hot-reload `.env`.

**AI works in the terminal but not in the browser**
The frontend cannot reach the API. Check that `VITE_API_BASE_URL` is set in `frontend/.env`,
that the backend is running, and that its origin is listed in the backend's `CORS_ORIGINS`.

**Browser CORS error in the console**
Add the exact frontend origin to `CORS_ORIGINS`. Wildcards do not work — credentials are in use.

**`503 AI is not configured on this server`**
You reached the backend, but it has no key. See above.

**`429 You're going a little fast`**
You hit `AI_PER_MINUTE_LIMIT`. Wait, or raise the limit.

**AI returns `502 The AI service is not configured correctly`**
The key was rejected. Verify it at https://console.anthropic.com/settings/keys

**Designs disappeared**
They were saved to browser `localStorage` and are not in the database. They only leave the
browser once the backend is configured — and existing local designs are *not* migrated on first
sign-in.

**Port already in use**
Change `server.port` in `frontend/vite.config.ts`, or run the backend on another port with
`uvicorn app.main:app --port 8001` and update `VITE_API_BASE_URL` to match.

**Tests fail with `ValueError: unknown url type`**
You ran bare `pytest` from the wrong directory, or an old checkout without `backend/pytest.ini`.
Run it from inside `backend/`.

---

## Project layout

```
backend/
  app/
    main.py            FastAPI app factory, middleware, router wiring
    config.py          settings + production safety checks
    db.py  models.py   SQLAlchemy engine and ORM models
    security.py        Argon2 hashing, JWT sessions
    deps.py            request dependencies, auth guard
    routers/           auth, projects, assets, files, brand_kits, templates, ai
    ai/                provider, prompts, tool schemas, output validation
    data/*.json        template, format, font and category catalogues
  tests/               55 tests
  smoke_test.py        end-to-end check against a live server

frontend/
  src/
    engine/            document model: ops, history, geometry, validation
    components/        ui primitives, editor panels, feature components
    pages/             one file per route
    services/          the only place that talks to the network
    stores/            zustand state
    data/              client-side template and format catalogues

.github/workflows/     ci.yml (tests + build), release.yml (GHCR + artifact)
```

More detail: `backend/README.md` for the API, `frontend/docs/ARCHITECTURE.md` for the editor's
document model, `frontend/docs/VERIFICATION.md` for the manual UI checklist.