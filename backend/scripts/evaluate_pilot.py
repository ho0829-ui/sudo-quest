"""Three real RAG checks; not the full RAG-vs-no-RAG assignment evaluation."""
import json
import time

from app.collectors import save_json
from app.config import load_settings
from app.contracts import ChatRequest
from app.indexing import open_store
from app.rag import respond

QUESTIONS = [
    ("aws-alb-http-503-issues", "타깃이 전부 unhealthy이면 ALB는 항상 503을 반환하나요? unused와 차이도 알려주세요."),
    ("curl-28", "curl 오류 28에서 connect-timeout과 max-time은 어떤 차이가 있나요?"),
    ("curl-7", "내일 서울의 날씨와 점심 메뉴를 알려주세요."),
]

if __name__ == "__main__":
    settings = load_settings()
    store, collections = open_store(settings.chroma_path)
    results = []
    try:
        for item_id, question in QUESTIONS:
            start = time.monotonic()
            result = respond(settings, collections, ChatRequest(item_id=item_id, question=question),
                             lambda stage: print(stage, flush=True))
            results.append({"item_id": item_id, "question": question, "seconds": round(time.monotonic() - start, 2), **result})
            print(json.dumps({"item_id": item_id, "seconds": results[-1]["seconds"], "citations": len(result["citations"]), "answer": result["answer"]}, ensure_ascii=False), flush=True)
        save_json(settings.chroma_path.parent / "evaluation/pilot.json", results)
    finally:
        store.close()
