"""F2015 RAG 전후 비교: 같은 모델·같은 질문으로 문서 제공 여부만 바꿔 답을 받는다.

backend 폴더에서 실행(8000 서버가 떠 있어야 함):
  .venv/Scripts/python.exe -X utf8 -m scripts.compare_rag
- RAG 없음: 질문만 직접 모델에 보낸다(유료 생성 1회).
- RAG 있음: 실제 서비스 경로인 POST /api/chat을 쓴다. 색인에 쓰는 프로세스를 서버 하나로 유지하기 위해서다.
결과 원본: data/evaluation/f2015_results.json. 채점은 사람이 정답 기준과 대조해 따로 한다.
"""
import json
import sys
import time
import urllib.request
from pathlib import Path

from app.collectors import save_json
from app.config import load_settings
from app.providers import ProviderError, generate

QUESTIONS = Path(__file__).resolve().parents[1] / "evaluation" / "f2015_questions.json"
SERVER = "http://127.0.0.1:8000"
# RAG 없는 쪽도 '모르면 모른다'는 같은 기본 태도를 주되, 문서·인용 규칙은 주지 않는다.
NO_RAG_INSTRUCTIONS = "한국어 인프라 학습 도우미다. 질문에 간결하게 답한다. 확실하지 않으면 모른다고 말한다."


def ask_server(item_id, question):
    body = json.dumps({"item_id": item_id, "question": question, "history": []}).encode()
    request = urllib.request.Request(SERVER + "/api/chat", body, {"Content-Type": "application/json"})
    job = json.load(urllib.request.urlopen(request, timeout=10))["job_id"]
    while True:
        result = json.load(urllib.request.urlopen(f"{SERVER}/api/jobs/{job}", timeout=10))
        if result["status"] != "running":
            return result
        time.sleep(0.5)


def main() -> int:
    settings = load_settings()
    questions = json.loads(QUESTIONS.read_text(encoding="utf-8"))["questions"]
    results = []
    for q in questions:
        start = time.monotonic()
        try:
            plain = {"answer": generate(settings, q["question"], NO_RAG_INSTRUCTIONS, 2000), "error": None}
        except ProviderError as exc:
            plain = {"answer": "", "error": str(exc)}
        plain["seconds"] = round(time.monotonic() - start, 1)

        start = time.monotonic()
        job = ask_server(q["item_id"], q["question"])
        rag = {"seconds": round(time.monotonic() - start, 1), "status": job["status"],
               "error": job.get("error"), **(job.get("result") or {})}
        results.append({"id": q["id"], "question": q["question"], "no_rag": plain, "rag": rag})
        print(json.dumps({"id": q["id"], "no_rag_s": plain["seconds"], "no_rag_error": plain["error"],
                          "rag_s": rag["seconds"], "rag_status": rag["status"], "rag_error": rag["error"],
                          "citations": len(rag.get("citations", []))}, ensure_ascii=False), flush=True)
    save_json(settings.chroma_path.parent / "evaluation" / "f2015_results.json",
              {"model": settings.llm_model, "results": results})
    return 0


if __name__ == "__main__":
    sys.exit(main())
