from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .db import create_tables
from .errors import install_error_handlers
from .routers import ai, assets, auth, brand_kits, files, projects, templates
from .storage import get_storage

logging.basicConfig(level=logging.INFO)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    settings.assert_production_ready()
    get_storage()  # creates the upload directory
    if settings.database_url.startswith("sqlite"):
        from pathlib import Path

        path = settings.database_url.split("///", 1)[-1]
        if path and path != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
    create_tables()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="DesignForge API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=None if settings.app_env == "production" else "/docs",
        redoc_url=None,
        openapi_url=None if settings.app_env == "production" else "/openapi.json",
    )

    @app.middleware("http")
    async def limit_body_and_add_headers(request: Request, call_next):
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > get_settings().max_body_bytes:
            return JSONResponse({"message": "Request body is too large."}, status_code=413)
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        return response

    # Added last => outermost, so CORS headers are present even on early 413/500 responses.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
        max_age=600,
    )
    install_error_handlers(app)

    @app.get("/health", tags=["meta"])
    def health():
        return {"status": "ok"}

    for module in (auth, projects, assets, files, brand_kits, templates, ai):
        app.include_router(module.router)
    return app


app = create_app()
