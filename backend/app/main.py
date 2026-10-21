from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import Settings, load_settings
from app.indexing import open_store


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.store, app.state.collections = open_store(settings.chroma_path)
        try:
            yield
        finally:
            app.state.store.close()

    app = FastAPI(title="InfraCoach API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"], allow_headers=["Content-Type"],
    )

    @app.get("/api/health")
    def health():
        counts = {name: collection.count() for name, collection in app.state.collections.items()}
        return {
            "status": "ok", "service": "InfraCoach",
            "providers": {kind: {"configured": not settings.missing(kind),
                                 "missing": settings.missing(kind), "verified": False}
                          for kind in ("generation", "embedding")},
            "index": {"counts": counts, "status": "empty" if not any(counts.values()) else "present"},
            "rag_status": "not_implemented",
        }

    @app.exception_handler(Exception)
    async def internal_error(request, exc):
        return JSONResponse(status_code=500, content={"error": "internal_error"})

    return app
