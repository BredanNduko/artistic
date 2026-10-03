# DesignForge (full stack)

- `frontend/` — your React app, lightly patched to work with the backend (password sign-in, session cookie on uploads, AI routed to the backend).
- `backend/`  — Python FastAPI API. See `backend/README.md`.

Quick start (two terminals):

    cd backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
    cp .env.example .env && uvicorn app.main:app --reload

    cd frontend && cp .env.example .env && npm install && npm run dev

Add ANTHROPIC_API_KEY to backend/.env to switch the AI on.
