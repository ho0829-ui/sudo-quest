from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import Settings, load_settings
from app.indexing import open_store
from app.catalog import ITEMS, ITEM_BY_ID
from app.coach import coach
from app.contracts import ChatRequest, CoachRequest, ExploreRequest
from app.corpus import check_manifest
from app.jobs import Jobs
from app.explore import search
from app.rag import respond


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or load_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.store, app.state.collections = open_store(settings.chroma_path)
        app.state.jobs = Jobs()
        try:
            yield
        finally:
            app.state.jobs.close()
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
            "rag_status": "pilot_ready" if ready() else "index_required",
        }

    def ready():
        try:
            check_manifest(settings)
            return True
        except ValueError:
            return False

    @app.get("/api/items")
    def items():
        return {"items": [item.model_dump() for item in ITEMS], "index_ready": ready(), "pilot": True}

    @app.post("/api/chat", status_code=202)
    def chat(request: ChatRequest):
        if request.item_id not in ITEM_BY_ID:
            raise HTTPException(404, "unknown_item")
        try:
            key = app.state.jobs.submit(lambda progress: respond(settings, app.state.collections, request, progress))
        except ValueError:
            raise HTTPException(429, "busy") from None
        return {"job_id": key}

    @app.post("/api/items/search", status_code=202)
    def search_items(request: ExploreRequest):
        try:
            key = app.state.jobs.submit(lambda progress: search(settings, app.state.collections, request.query, progress))
        except ValueError:
            raise HTTPException(429, "busy") from None
        return {"job_id": key}

    @app.post("/api/coach", status_code=202)
    def coach_session(request: CoachRequest):
        if request.item_id and request.item_id not in ITEM_BY_ID:
            raise HTTPException(404, "unknown_item")
        try:
            key = app.state.jobs.submit(lambda progress: coach(settings, app.state.collections, request, progress))
        except ValueError:
            raise HTTPException(429, "busy") from None
        return {"job_id": key}

    @app.get("/api/jobs/{job_id}")
    def job(job_id: str):
        result = app.state.jobs.get(job_id)
        if not result:
            raise HTTPException(404, "unknown_job")
        return result

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        # FastAPI 기본 오류 응답의 input 필드는 비공개 요청 값을 반사할 수 있다.
        return JSONResponse(status_code=422, content={"error": "invalid_request", "message": "입력 길이와 허용 필드를 확인해주세요."})

    @app.exception_handler(Exception)
    async def internal_error(request, exc):
        return JSONResponse(status_code=500, content={"error": "internal_error"})

    return app
