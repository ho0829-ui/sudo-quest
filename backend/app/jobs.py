import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor

from app.providers import ProviderError

SAFE_ERRORS = {
    "index_not_ready": "먼저 대표 데이터 수집·색인을 실행해주세요.",
    "index_configuration_changed": "임베딩 또는 청킹 설정이 바뀌었습니다. 새 경로에 재색인해주세요.",
    "provider_not_configured": "생성·임베딩 설정을 확인해주세요.",
    "generation_request_failed": "생성 요청에 실패했습니다. 키·모델·네트워크를 확인해주세요.",
    "embedding_request_failed": "임베딩 요청에 실패했습니다. 키·모델·네트워크를 확인해주세요.",
    "incomplete_or_empty_generation": "모델 응답이 완성되지 않았습니다. 잠시 후 다시 시도해주세요.",
    "citation_validation_failed": "답변의 인용을 검증하지 못했습니다. 답변을 표시하지 않습니다.",
    "invalid_document_selection": "문서 선별 결과를 검증하지 못했습니다.",
    "explore_judgement_invalid": "조건 판정 결과를 검증하지 못했습니다. 다시 시도해주세요.",
    "source_section_missing": "선택한 공식 문서에서 해당 절을 찾지 못했습니다. 문서가 바뀌었을 수 있습니다.",
    "source_http_error": "공식 문서를 가져오지 못했습니다. 잠시 후 다시 시도해주세요.",
    "source_rate_limited_retry_later": "공식 문서 사이트의 호출 제한에 걸렸습니다. 잠시 후 다시 시도해주세요.",
    "robots_disallow": "출처의 수집 정책상 이 문서를 가져올 수 없습니다.",
}


class Jobs:
    def __init__(self):
        self.pool = ThreadPoolExecutor(max_workers=2)
        self.lock = threading.Lock()
        self.jobs = {}

    def submit(self, work):
        with self.lock:
            self.jobs = {k: v for k, v in self.jobs.items()
                         if v["status"] == "running" or time.monotonic() - v["updated"] < 600}
            if sum(v["status"] == "running" for v in self.jobs.values()) >= 2 or len(self.jobs) >= 32:
                raise ValueError("busy")
            key = uuid.uuid4().hex
            self.jobs[key] = {"status": "running", "stage": "queued", "updated": time.monotonic()}

        def update(**values):
            with self.lock:
                self.jobs[key].update(values, updated=time.monotonic())

        def run():
            try:
                result = work(lambda stage: update(stage=stage))
                update(status="complete", stage="complete", result=result)
            except (ValueError, ProviderError) as exc:
                code = str(exc) if str(exc) in SAFE_ERRORS else "request_failed"
                update(status="failed", error=code, message=SAFE_ERRORS.get(code, "요청 처리에 실패했습니다. 설정과 색인을 확인해주세요."))
            except Exception:
                update(status="failed", error="internal_error", message="요청 처리 중 오류가 발생했습니다.")

        self.pool.submit(run)
        return key

    def get(self, key):
        with self.lock:
            job = self.jobs.get(key)
            return {k: v for k, v in job.items() if k != "updated"} if job else None

    def close(self):
        self.pool.shutdown(wait=True, cancel_futures=True)
