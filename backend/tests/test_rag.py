import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.catalog import DOCUMENTS, ITEMS, CURL
from app.collectors import extract_section, digest, save_json
from app.config import Settings
from app.contracts import Answer, ChatRequest, Selection, SearchTerms
from app.corpus import prepare, check_manifest
from app.indexing import open_store
from app.main import create_app
from app.rag import respond, validate_answer


def fixture_document(key):
    return {**DOCUMENTS[key], "text": "Fixture official text. " * 60,
            "content_hash": digest(key), "source_url": DOCUMENTS[key]["canonical_url"] + "#" + DOCUMENTS[key]["section"],
            "product_version": "fixture", "fetched_at": "2026-10-21"}


class RagTests(unittest.TestCase):
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
            self.assertEqual(first["counts"]["knowledge_items"], 10)
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
            prepare(settings, lambda s, texts: [[1., 0., 0.] for _ in texts])
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
