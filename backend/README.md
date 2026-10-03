# DesignForge API

FastAPI backend for the DesignForge frontend. It implements exactly the HTTP contract the
frontend's `remote*Service` objects already define, so turning it on is one env var on the
frontend side.

```
React app  ──cookie session──▶  this API  ──API key (server-side only)──▶  Gemini / Anthropic
```

## Run it

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # then edit it
uvicorn app.main:app --reload   # http://localhost:8000  (interactive docs at /docs)
pytest                          # 97 tests, no API key or network needed
```

Frontend: `cp .env.example .env` (sets `VITE_API_BASE_URL=http://localhost:8000`), then `npm run dev`.
Unset that variable and the app goes back to fully-offline local mode.

## Turn the AI on

Put a provider key in `backend/.env` and restart. That's it.

```
AI_PROVIDER=gemini                 # "gemini" (default) or "anthropic"
GEMINI_API_KEY=...                 # https://aistudio.google.com/apikey
```

`/ai/status` then reports `{"available": true, "provider": "gemini", ...}`. Without a key every
model-backed endpoint returns a clean `503 "AI is not configured"`.

Both providers sit behind the same `AIProvider` protocol, so prompts, tool schemas and output
validation are shared. Anthropic's `tool_choice={"type":"tool"}` maps to Gemini's
`FunctionCallingConfig(mode="ANY")`; both force a JSON-schema tool call so there is no free text to
parse.

### Choosing models

| Variable | Default | Used for |
|---|---|---|
| `GEMINI_MODEL` | `gemini-3.5-flash` | Design generation, edits, artwork |
| `GEMINI_FAST_MODEL` | `gemini-3.1-flash-lite` | Copywriting, design review notes |
| `AI_MODEL` | `claude-sonnet-5-5` | Same, when `AI_PROVIDER=anthropic` |
| `AI_FAST_MODEL` | `claude-haiku-4-5-20251001` | Same, when `AI_PROVIDER=anthropic` |

Model ids are not portable between providers, so read them with
`settings.model_for("main" | "fast")` rather than `settings.ai_model` directly.

Both Gemini defaults are **stable** models. Google's preview ids get withdrawn — `gemini-3-pro-preview`
was shut down in March 2026 — so prefer stable ids unless you are deliberately testing one.

### What each AI feature calls

| Endpoint | What it does | Model call |
|---|---|---|
| `POST /ai/generate-design` | prompt → full design (optionally using a brand kit) | main |
| `POST /ai/modify-design` | "make the headline bigger" → minimal edit operations applied to your design | main |
| `POST /ai/copy` | headline / CTA / caption variants | fast |
| `POST /ai/suggest` | design review notes | fast |
| `POST /ai/image` | artwork as sanitised SVG | main |
| `POST /ai/resize-design` | reflow to another format | **no** (deterministic) |
| `GET  /ai/status` | is a provider configured, and which? | no |

**How the AI is kept safe.** The model is forced to answer through a JSON-schema tool call
(no free text to parse). Its output is never trusted: `ai/build.py` and `ai/ops.py` clamp every
number, validate every colour, restrict fonts to your registry, whitelist which properties can
change on which element type, drop invented element ids, and grow text boxes to fit. For edits,
the model proposes *operations*, not a rewritten document, so images and unknown fields survive
untouched. User text is wrapped in tags and the system prompt says to treat it as data. Provider
errors are mapped to generic messages (raw provider text and keys never reach the browser).
Each user is limited per minute and per day (`AI_PER_MINUTE_LIMIT`, `AI_DAILY_LIMIT`), and every
call is recorded in `ai_usage` with token counts.

Gemini can also decline a prompt on safety grounds. That arrives with no tool call, so it is
detected and reported as a `422 "The AI declined that request"` rather than the generic
"unexpected response".

## Other endpoints

`/auth/*` (sign-up, sign-in, sign-out, me) · `/projects` (CRUD + duplicate) · `/assets` (multipart
upload, register, rename, delete) · `/brand-kits` · `/templates` (+ categories, instantiate) ·
`/files/{key}` (serves uploads) · `/health`.

- **Auth:** Argon2 password hashes, HttpOnly session cookie (a `Bearer` token also works), generic
  sign-in errors, rate-limited. Everything is scoped to the signed-in user; other users' ids return
  404/null, never 403.
- **Uploads:** type is detected from the bytes (not the client's header), size-capped, decoded with
  Pillow to reject corrupt files and decompression bombs, SVGs are parsed with `defusedxml` and
  stripped of scripts/handlers/external references, per-user storage quota. An asset still used by a
  design isn't deleted from disk.
- **Templates:** the 12 templates were exported from your `data/templates.ts` into `app/data/`.
  If you edit templates in the frontend, re-export them (see `app/data/*.json`).

## Before you deploy

Set `APP_ENV=production` (the server refuses to start with the default secret, an insecure cookie, or
wildcard CORS), a real `SECRET_KEY`, `COOKIE_SECURE=true`, `CORS_ORIGINS`, `PUBLIC_BASE_URL`, and
if the frontend and API are on different *sites*, `COOKIE_SAMESITE=none`.

## Known limits (be aware, not blockers)

- **Live model calls are untested in this build.** There was no API key here. Both provider wrappers
  are tested against mocked SDK responses — including a wire-level check that the tool schema and
  token counts survive serialisation — and every endpoint against a fake provider. Do one real
  `generate-design` call yourself and eyeball the result; prompt tuning is the likely next job.
- **Gemini reports output tokens as `candidates_token_count`**, not `response_token_count` (which
  exists on the SDK model but is never populated). `provider.py` reads the former; if you touch the
  usage mapping, `tests/test_gemini_wire.py` will catch a regression.
- `/ai/image` returns model-written **SVG** (neither Gemini nor Claude can emit raster images here).
  For photos, plug an image-generation model into that one function; the response shape
  (`src,width,height`) stays.
- SQLite + local-disk uploads + in-memory rate limiter = single instance. For more, move to Postgres
  (`DATABASE_URL`), object storage (`app/storage.py` has three methods to reimplement) and Redis.
- No schema migrations yet (tables are created on startup). Add Alembic before changing models in prod.
- No email verification / password reset. PDF export is still unimplemented (it was in the frontend too).
- Existing designs in a browser's localStorage are not auto-uploaded when someone first signs in.
