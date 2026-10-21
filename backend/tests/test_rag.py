import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.catalog import DOCUMENTS, ITEMS

CURL = "https://curl.se/docs/manpage.html"
from app.collectors import extract_section, digest, save_json
from app.config import Settings
from app.contracts import Answer, ChatRequest, Selection, SearchTerms
from app.corpus import prepare, check_manifest
from app.indexing import open_store
from app.main import create_app
from app.rag import respond, validate_answer


def fixture_document(key):
    return {**DOCUMENTS[key], "text": f"Fixture official text for {key}. " * 40,
            "content_hash": digest(key), "source_url": DOCUMENTS[key]["canonical_url"] + "#" + DOCUMENTS[key]["section"],
            "product_version": "fixture", "fetched_at": "2026-10-21"}


def fake_vectors(settings, texts):
    # 모든 벡터가 같으면 Chroma의 필터 검색(HNSW)이 결과를 빠뜨리는 경우가 있어 텍스트마다 다르게 만든다.
    return [[1., int(digest(text)[:4], 16) / 65535, len(text) % 97 / 97] for text in texts]


class RagTests(unittest.TestCase):
    def test_extract_unquoted_heading_id(self):
        # kubernetes.io 같은 압축 HTML은 id 따옴표가 없다. 비슷한 접두어의 다른 제목과 헷갈리지 않아야 한다.
        html = '<h2 id=pod-phase-x>X</h2><p>wrong section body text here</p><h2 id=pod-phase>Pod phase</h2><p>The phase of a Pod is a summary.</p><h2 id=next>N</h2>'
        text = extract_section(html, "https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/", "pod-phase")
        self.assertTrue(text.startswith("Pod phase"))
        self.assertNotIn("wrong", text)
        self.assertNotIn("N", text.splitlines()[-1][:1])

    def test_extract_curl_only_requested_section(self):
        html = '<p class="level0"><a name="7"></a>7</p><p>Failed to connect to host.</p><p class="level0"><a name="8"></a>8</p><p>SECRET_OTHER_SECTION</p>'
        text = extract_section(html, CURL, "7")
        self.assertIn("Failed to connect", text)
        self.assertNotIn("SECRET_OTHER_SECTION", text)

    def test_missing_section_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "source_section_missing"):
            extract_section("<html>unrelated</html>", CURL, "7")

    def test_aws_heading_boundary(self):
        text = extract_section('<h3 id="a">Title</h3><p>Some long official body here</p><h3 id="b">Other</h3>', "https://docs.aws.amazon.com", "a")
        self.assertNotIn("Other", text)

    def test_invalid_and_unused_citations(self):
        evidence = [{"evidence_id": 1}, {"evidence_id": 2}]
        answer = Answer(answer="설명 [근거 2]", cited_evidence_ids=[2])
        self.assertEqual(validate_answer(answer, evidence), [2])
        with self.assertRaises(ValueError):
            validate_answer(Answer(answer="설명 [근거 9]", cited_evidence_ids=[9]), evidence)
        with self.assertRaises(ValueError):
            validate_answer(Answer(answer="근거 없는 단정", cited_evidence_ids=[]), evidence)
        self.assertEqual(validate_answer(Answer(answer="문서에서 확인되지 않습니다.", cited_evidence_ids=[]), evidence), [])

    @patch("app.corpus.Collector.fetch", return_value={})
    @patch("app.corpus.Collector.document", side_effect=fixture_document)
    def test_index_idempotence_configuration_and_shared_documents(self, document, fetch):
        with tempfile.TemporaryDirectory() as folder:
            settings = Settings(chroma_path=Path(folder) / "chroma")
            calls = []
            def embeddings(settings, texts):
                calls.append(len(texts))
                return [[1., 0., 0.] for _ in texts]
            first = prepare(settings, embeddings)
            call_count = len(calls)
            second = prepare(settings, embeddings)
            self.assertEqual(first["counts"], second["counts"])
            self.assertEqual(first["counts"]["knowledge_items"], len(ITEMS))
            self.assertEqual(len(calls), call_count)
            self.assertEqual(second["embedding_batches"], 0)
            store, collections = open_store(settings.chroma_path)
            try:
                rows = collections["reference_chunks"].get(where={"doc_id": "alb-health-overview"})
                self.assertEqual(len({m["item_id"] for m in rows["metadatas"]}), 4)
            finally:
                store.close()
            settings.embedding_model = "changed"
            with self.assertRaisesRegex(ValueError, "index_configuration_changed"):
                check_manifest(settings)

    def test_request_rejects_private_state_and_redacts_input(self):
        with tempfile.TemporaryDirectory() as folder:
            with TestClient(create_app(Settings(chroma_path=Path(folder)))) as client:
                r = client.post("/api/chat", json={"item_id": "curl-7", "question": "test", "faults": "secret-marker"})
                self.assertEqual(r.status_code, 422)
                self.assertNotIn("secret-marker", r.text)
                r = client.post("/api/chat", json={"item_id": "curl-7", "question": " "})
                self.assertEqual(r.status_code, 422)

    def test_empty_index_job_reports_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            with TestClient(create_app(Settings(chroma_path=Path(folder)))) as client:
                key = client.post("/api/chat", json={"item_id": "curl-7", "question": "why"}).json()["job_id"]
                for _ in range(100):
                    result = client.get("/api/jobs/" + key).json()
                    if result["status"] != "running":
                        break
                    time.sleep(.01)
                self.assertEqual(result["error"], "index_not_ready")

    @patch("app.corpus.Collector.fetch", return_value={})
    @patch("app.corpus.Collector.document", side_effect=fixture_document)
    def test_rag_metadata_required_primary_forced_cache_and_item_scope(self, document, fetch):
        with tempfile.TemporaryDirectory() as folder:
            settings = Settings(chroma_path=Path(folder) / "chroma", llm_api_key="test", embedding_api_key="test",
                                embedding_base_url="https://example.com/v1/", embedding_model="test")
            prepare(settings, fake_vectors)
            store, collections = open_store(settings.chroma_path)
            def model(settings, system, payload, schema):
                if schema is SearchTerms:
                    return SearchTerms(queries=["connect"])
                if schema is Selection:
                    return Selection(selected_ids=[], reasons={})
                self.assertEqual(payload["evidence"][0]["source_type"], "item_metadata")
                self.assertTrue(all(e["item_id"] == "curl-7" for e in payload["evidence"]))
                return Answer(answer="문서 설명 [근거 2]", cited_evidence_ids=[2])
            try:
                with patch("app.rag.json_call", side_effect=model) as mock, patch("app.rag.embed", return_value=[[1., 0., 0.]]):
                    request = ChatRequest(item_id="curl-7", question="why")
                    result = respond(settings, collections, request)
                    self.assertEqual(result["trace"]["selected_ids"], ["curl-exit-7"])
                    self.assertEqual([x["evidence_id"] for x in result["citations"]], [2])
                    calls = mock.call_count
                    self.assertTrue(respond(settings, collections, request)["cache_hit"])
                    self.assertEqual(mock.call_count, calls)
            finally:
                store.close()


class VectorCacheTests(unittest.TestCase):
    def test_vectors_reused_across_chunk_settings_but_not_models(self):
        from app.corpus import cached_vectors
        with tempfile.TemporaryDirectory() as folder:
            calls = []
            def embedder(settings, texts):
                calls.append(len(texts))
                return [[1., 0., 0.] for _ in texts]
            base = Settings(chroma_path=Path(folder) / "chroma", embedding_model="m1")
            cached_vectors(base, ["same text"], embedder, None)
            # 청크 설정만 다르면 같은 본문의 벡터를 다시 만들지 않는다.
            cached_vectors(base.model_copy(update={"chunk_size": 700}), ["same text"], embedder, None)
            self.assertEqual(len(calls), 1)
            # 임베딩 모델이 바뀌면 다시 만든다.
            cached_vectors(base.model_copy(update={"embedding_model": "m2"}), ["same text"], embedder, None)
            self.assertEqual(len(calls), 2)
