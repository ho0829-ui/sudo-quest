"""고장 주입 테스트(D3) 2: 공식 문서 수집 실패, 작업 큐 포화, 불완전한 생성, 키 없음.

자동 재시도하지 않는 실패들이다. 모두 정해진 안전한 오류 코드로 끝나야 한다(jobs.SAFE_ERRORS).
"""
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from pydantic import SecretStr

from app.catalog import DOCUMENTS
from app.collectors import Collector
from app.config import Settings
from app.contracts import ChatRequest
from app.corpus import prepare
from app.indexing import open_store
from app.jobs import SAFE_ERRORS, Jobs
from app.providers import ProviderError, generate
from app.rag import respond
from test_rag import fake_vectors, fixture_document


class SourceAndJobFaultTests(unittest.TestCase):
    """공식 문서 수집과 작업 큐의 실패: 자동 재시도하지 않고 안전한 코드로 끝난다."""

    def setUp(self):
        patch("app.collectors.time.sleep").start()
        self.addCleanup(patch.stopall)
        self.url = next(iter(DOCUMENTS.values()))["canonical_url"]

    def fetch_with(self, *responses):
        reply = lambda code, text="": SimpleNamespace(status_code=code, text=text, headers={})
        with tempfile.TemporaryDirectory() as folder, \
                patch("app.collectors.requests.get", side_effect=[reply(*r) for r in responses]) as get:
            try:
                Collector(Path(folder)).fetch(self.url)
            finally:
                self.calls = get.call_count

    def test_robots_disallow(self):
        with self.assertRaisesRegex(ValueError, "^robots_disallow$"):
            self.fetch_with((200, "User-agent: *\nDisallow: /"))

    def test_rate_limit_is_not_retried(self):
        with self.assertRaisesRegex(ValueError, "^source_rate_limited_retry_later$"):
            self.fetch_with((404,), (429,))
        self.assertEqual(self.calls, 2)  # robots.txt 1번 + 문서 1번, 다시 시도하지 않는다

    def test_source_http_error(self):
        with self.assertRaisesRegex(ValueError, "^source_http_error$"):
            self.fetch_with((404,), (500,))

    def test_incomplete_generation_is_not_retried(self):
        with patch("app.providers.OpenAI") as constructor:
            create = constructor.return_value.__enter__.return_value.responses.create
            create.return_value = SimpleNamespace(status="incomplete", output_text="")
            with self.assertRaisesRegex(ProviderError, "^incomplete_or_empty_generation$"):
                generate(Settings(llm_api_key=SecretStr("test-secret")), "q")
            self.assertEqual(create.call_count, 1)

    def test_every_fault_code_has_a_safe_message(self):
        for code in ("index_not_ready", "provider_not_configured", "generation_request_failed", "embedding_request_failed",
                     "invalid_embedding_response", "incomplete_or_empty_generation", "citation_validation_failed",
                     "source_http_error", "source_rate_limited_retry_later", "robots_disallow"):
            self.assertIn(code, SAFE_ERRORS)

    def test_job_queue_refuses_third_running_job(self):
        jobs = Jobs()
        gate = threading.Event()
        try:
            jobs.submit(lambda progress: gate.wait(5))
            jobs.submit(lambda progress: gate.wait(5))
            with self.assertRaisesRegex(ValueError, "^busy$"):
                jobs.submit(lambda progress: None)
        finally:
            gate.set()
            jobs.close()


@patch("app.corpus.Collector.fetch", return_value={})
@patch("app.corpus.Collector.document", side_effect=fixture_document)
class MissingKeyTests(unittest.TestCase):
    def test_missing_keys_fail_before_any_model_call(self, *_):
        with tempfile.TemporaryDirectory() as folder:
            settings = Settings(chroma_path=Path(folder) / "chroma")
            prepare(settings, fake_vectors)
            store, collections = open_store(settings.chroma_path)
            try:
                with patch("app.rag.json_call") as model, self.assertRaisesRegex(ValueError, "^provider_not_configured$"):
                    respond(settings, collections, ChatRequest(item_id="curl-7", question="why"))
                model.assert_not_called()
            finally:
                store.close()


if __name__ == "__main__":
    unittest.main()
