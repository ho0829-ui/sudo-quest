"""고장 주입 테스트(D3): 공급자 일시 장애 재시도, 잘못된 모델 응답, 인용 실패, 근거 부족 보류, 단계별 소요 시간(D2).

네트워크를 쓰지 않는다. 공급자 호출은 가짜로 바꾸고, 색인은 공식 문서 대신 고정 본문으로 만든다.
"""
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import httpx
import requests
from openai import APITimeoutError, AuthenticationError, InternalServerError
from pydantic import SecretStr

from app.config import Settings
from app.contracts import Answer, ChatRequest, SearchTerms, Selection
from app.corpus import prepare
from app.indexing import open_store
from app.jobs import SAFE_ERRORS
from app.providers import ProviderError, embed, generate
from app.rag import respond
from app.timing import StageClock
from test_rag import fake_vectors, fixture_document

REQUEST = httpx.Request("POST", "https://example.com")


def status_error(cls, code):
    return cls("fail", response=httpx.Response(code, request=REQUEST), body=None)


def completed(text="OK"):
    return SimpleNamespace(status="completed", output_text=text)


class RetryTests(unittest.TestCase):
    """5xx·시간 초과·연결 끊김만 1회 다시 시도하고, 4xx는 바로 실패한다."""

    def setUp(self):
        self.sleep = patch("app.providers.time.sleep").start()
        self.addCleanup(patch.stopall)
        self.settings = Settings(llm_api_key=SecretStr("test-secret"))

    def create(self, *effects):
        constructor = patch("app.providers.OpenAI").start()
        mock = constructor.return_value.__enter__.return_value.responses.create
        mock.side_effect = list(effects)
        return mock

    def test_server_error_then_success(self):
        mock = self.create(status_error(InternalServerError, 502), completed("두 번째에 성공"))
        self.assertEqual(generate(self.settings, "q"), "두 번째에 성공")
        self.assertEqual(mock.call_count, 2)
        self.sleep.assert_called_once()

    def test_timeout_then_success(self):
        mock = self.create(APITimeoutError(request=REQUEST), completed())
        self.assertEqual(generate(self.settings, "q"), "OK")
        self.assertEqual(mock.call_count, 2)

    def test_two_server_errors_fail_with_safe_code(self):
        mock = self.create(status_error(InternalServerError, 503), status_error(InternalServerError, 503))
        with self.assertLogs("infracoach.providers", "WARNING"), self.assertRaisesRegex(ProviderError, "^generation_request_failed$"):
            generate(self.settings, "q")
        self.assertEqual(mock.call_count, 2)

    def test_client_error_is_not_retried(self):
        mock = self.create(status_error(AuthenticationError, 401))
        with self.assertLogs("infracoach.providers", "WARNING"), self.assertRaises(ProviderError):
            generate(self.settings, "q")
        self.assertEqual(mock.call_count, 1)
        self.sleep.assert_not_called()

    def test_gemini_embedding_retry_rules(self):
        settings = Settings(embedding_api="gemini", embedding_base_url="https://example.com/v1beta",
                            embedding_model="gemini-embedding-2", embedding_api_key=SecretStr("test-secret"))
        ok = SimpleNamespace(status_code=200, json=lambda: {"embeddings": [{"values": [0.1, 0.2]}]})
        fail = lambda code: SimpleNamespace(status_code=code, json=lambda: {})
        with patch("app.providers.requests.post", side_effect=[fail(503), ok]) as post:
            self.assertEqual(embed(settings, ["가"]), [[0.1, 0.2]])
            self.assertEqual(post.call_count, 2)
        with patch("app.providers.requests.post", side_effect=[requests.Timeout(), requests.Timeout()]) as post:
            with self.assertLogs("infracoach.providers", "WARNING"), self.assertRaisesRegex(ProviderError, "embedding_request_failed"):
                embed(settings, ["가"])
            self.assertEqual(post.call_count, 2)
        with patch("app.providers.requests.post", side_effect=[fail(400)]) as post:
            with self.assertLogs("infracoach.providers", "WARNING"), self.assertRaises(ProviderError):
                embed(settings, ["가"])
            self.assertEqual(post.call_count, 1)


class NoChunks:
    """원문 청크 검색만 빈 결과를 내는 컬렉션(나머지 동작은 진짜 컬렉션에 맡긴다)."""
    def __init__(self, real):
        self.real = real

    def query(self, **kwargs):
        return {"documents": [[]], "metadatas": [[]]}

    def __getattr__(self, name):
        return getattr(self.real, name)


@patch("app.corpus.Collector.fetch", return_value={})
@patch("app.corpus.Collector.document", side_effect=fixture_document)
class PipelineFaultTests(unittest.TestCase):
    """색인은 고정 본문, 모델 응답만 바꿔 가며 지식 질문(/api/chat) 경로를 흔든다."""

    def run_chat(self, model, collections_override=None, question="why"):
        with tempfile.TemporaryDirectory() as folder:
            settings = Settings(chroma_path=Path(folder) / "chroma", llm_api_key="test", embedding_api_key="test",
                                embedding_base_url="https://example.com/v1/", embedding_model="test")
            prepare(settings, fake_vectors)
            store, collections = open_store(settings.chroma_path)
            try:
                with patch("app.rag.json_call", side_effect=model) as mock, patch("app.rag.embed", return_value=[[1., 0., 0.]]):
                    target = {**collections, **(collections_override(collections) if collections_override else {})}
                    request = ChatRequest(item_id="curl-7", question=question)
                    return respond(settings, target, request), mock, (lambda: respond(settings, target, request))
            finally:
                store.close()

    def test_bad_search_terms_fall_back_with_warning(self, *_):
        def model(settings, system, payload, schema):
            if schema is SearchTerms:
                raise ValueError("invalid_json")
            if schema is Selection:
                return Selection(selected_ids=[], reasons={})
            return Answer(answer="문서 설명 [근거 2]", cited_evidence_ids=[2])
        result, _, _ = self.run_chat(model)
        self.assertIn("검색어 형식 오류", result["warnings"][0])
        self.assertEqual(result["trace"]["queries"][1], "why")

    def test_wrong_citations_twice_drop_the_answer(self, *_):
        answers = []
        def model(settings, system, payload, schema):
            if schema is SearchTerms:
                return SearchTerms(queries=["connect"])
            if schema is Selection:
                return Selection(selected_ids=[], reasons={})
            answers.append(payload["format_reminder"])
            return Answer(answer="없는 근거 [근거 9]", cited_evidence_ids=[9])
        with self.assertRaisesRegex(ValueError, "^citation_validation_failed$"):
            self.run_chat(model)
        # 두 번째 시도에는 형식 안내를 붙여 다시 묻고, 그래도 틀리면 답을 버린다.
        self.assertEqual(len(answers), 2)
        self.assertEqual(answers[0], "")
        self.assertTrue(answers[1])
        self.assertIn("citation_validation_failed", SAFE_ERRORS)

    def test_too_little_evidence_abstains_without_answer_call(self, *_):
        calls = []
        def model(settings, system, payload, schema):
            calls.append(schema)
            if schema is SearchTerms:
                return SearchTerms(queries=["connect"])
            return Selection(selected_ids=[], reasons={})
        result, _, _ = self.run_chat(model, lambda c: {"reference_chunks": NoChunks(c["reference_chunks"])})
        self.assertIn("문서에서 확인되지 않습니다", result["answer"])
        self.assertEqual(result["citations"], [])
        self.assertNotIn(Answer, calls)

    def test_timings_record_each_stage_and_cache_hit(self, *_):
        def model(settings, system, payload, schema):
            if schema is SearchTerms:
                return SearchTerms(queries=["connect"])
            if schema is Selection:
                return Selection(selected_ids=[], reasons={})
            return Answer(answer="문서 설명 [근거 2]", cited_evidence_ids=[2])
        result, _, again = self.run_chat(model)
        stages = result["timings"]["stages"]
        for stage in ("prepare", "search_terms", "select_documents", "collect", "retrieve", "generate"):
            self.assertIn(stage, stages)
        self.assertGreaterEqual(result["timings"]["total"], max(stages.values()))
        self.assertNotIn("timings", result["trace"])


class StageClockTests(unittest.TestCase):
    def test_stage_durations_and_progress_passthrough(self):
        ticks = iter([0.0, 0.5, 3.5, 3.75, 3.75])
        seen = []
        clock = StageClock(seen.append, clock=lambda: next(ticks))
        clock("search_terms")
        clock("generate")
        self.assertEqual(seen, ["search_terms", "generate"])
        self.assertEqual(clock.finish(), {"stages": {"prepare": 0.5, "search_terms": 3.0, "generate": 0.25}, "total": 3.75})


if __name__ == "__main__":
    unittest.main()
