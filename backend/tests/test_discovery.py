import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from app import discovery
from app.catalog import ITEM_BY_ID
from app.collectors import digest
from app.config import Settings
from app.contracts import Answer, ChatRequest, SearchTerms, Selection
from app.corpus import prepare
from app.indexing import open_store
from app.rag import respond


def fixture_document(self, key, documents=None):
    source = (documents or {}).get(key) or discovery.SECTIONS.get(key) or discovery.DOCUMENTS[key]
    return {**source, "doc_id": key, "text": f"Fixture text for {key}. " * 40, "content_hash": digest(key),
            "source_url": source["canonical_url"] + "#" + source["section"],
            "product_version": "fixture", "fetched_at": "2026-10-21"}


def fake_vectors(settings, texts):
    return [[1., int(digest(t)[:4], 16) / 65535, len(t) % 97 / 97] for t in texts]


SECTIONS = {
    "a": {"doc_id": "a", "title": "ENOSPC no room", "section": "ERRORS/ENOSPC", "summary": "device has no room", "product": "Linux"},
    "b": {"doc_id": "b", "title": "EDQUOT quota", "section": "ERRORS/EDQUOT", "summary": "disk quota exhausted", "product": "Linux"},
    "c": {"doc_id": "c", "title": "curl --output", "section": "--output", "summary": "write to file", "product": "curl"},
}


class DiscoveryTests(unittest.TestCase):
    def test_search_ranks_title_matches_and_respects_exclusions(self):
        found = discovery.search_sections(["ENOSPC write no room"], set(), 5, SECTIONS)
        self.assertEqual(found[0]["doc_id"], "a")
        self.assertNotIn("a", [f["doc_id"] for f in discovery.search_sections(["ENOSPC"], {"a"}, 5, SECTIONS)])
        self.assertEqual(discovery.search_sections(["unrelated words"], set(), 5, SECTIONS), [])

    def test_selection_only_from_candidates_primary_forced_and_capped(self):
        item = ITEM_BY_ID["linux-errno-ENOSPC"]
        candidates = [{"doc_id": d} for d in [item.primary_doc_id, "x1", "x2", "x3"]]
        with self.assertRaisesRegex(ValueError, "invalid_document_selection"):
            discovery.finalize_selection(item, Selection(selected_ids=["made-up"], reasons={}), candidates, 4)
        ids, reasons = discovery.finalize_selection(
            item, Selection(selected_ids=["x1", "x2", "x3"], reasons={"x1": "ok"}), candidates, 2)
        self.assertEqual(ids, [item.primary_doc_id, "x1", "x2"])
        self.assertIn(item.primary_doc_id, reasons)

    @patch("app.collectors.Collector.document", fixture_document)
    def test_collect_once_per_item_and_shared_document_not_overwritten(self):
        with tempfile.TemporaryDirectory() as folder:
            settings = Settings(chroma_path=Path(folder) / "chroma", embedding_model="test")
            store, collections = open_store(settings.chroma_path)
            calls = []
            def embedder(s, texts):
                calls.append(len(texts))
                return fake_vectors(s, texts)
            try:
                first, second = ITEM_BY_ID["linux-errno-ENOSPC"], ITEM_BY_ID["linux-errno-EDQUOT"]
                result = discovery.ensure_indexed(settings, collections, first, ["linux-write-EDQUOT"], None, embedder)
                self.assertEqual(result["collected"], ["linux-write-EDQUOT"])
                again = discovery.ensure_indexed(settings, collections, first, ["linux-write-EDQUOT"], None, embedder)
                self.assertEqual(again["collected"], [])
                discovery.ensure_indexed(settings, collections, second, ["linux-write-EDQUOT"], None, embedder)
                rows = collections["reference_chunks"].get(where={"doc_id": "linux-write-EDQUOT"})
                self.assertEqual({m["item_id"] for m in rows["metadatas"]}, {first.item_id, second.item_id})
                self.assertTrue(all(m["origin"] == "query_selected" for m in rows["metadatas"]))
                # 같은 본문은 벡터 캐시를 재사용하므로 임베딩 API는 처음 한 번만 호출된다.
                self.assertEqual(len(calls), 1)
            finally:
                store.close()

    @patch("app.corpus.Collector.fetch", return_value={})
    @patch("app.collectors.Collector.document", fixture_document)
    def test_query_cache_skips_selection_for_same_search_terms(self, fetch):
        with tempfile.TemporaryDirectory() as folder:
            settings = Settings(chroma_path=Path(folder) / "chroma", llm_api_key="test", embedding_api_key="test",
                                embedding_base_url="https://example.com/v1/", embedding_model="test")
            prepare(settings, fake_vectors)
            store, collections = open_store(settings.chroma_path)
            schemas = []
            def model(settings, system, payload, schema):
                schemas.append(schema)
                if schema is SearchTerms:
                    return SearchTerms(queries=["ENOSPC write"])
                if schema is Selection:
                    candidate_ids = [c["doc_id"] for c in payload["candidates"]]
                    self.assertTrue(all(set(c) == {"doc_id", "title", "summary", "product"} for c in payload["candidates"]))
                    extra = [d for d in candidate_ids if d not in ITEM_BY_ID["linux-errno-ENOSPC"].document_ids][:1]
                    return Selection(selected_ids=extra, reasons={})
                return Answer(answer="문서에서 확인되지 않습니다.", cited_evidence_ids=[])
            try:
                with patch("app.rag.json_call", side_effect=model), \
                        patch("app.rag.embed", side_effect=lambda s, t: fake_vectors(s, t)), \
                        patch("app.discovery.embed", side_effect=fake_vectors):
                    first = respond(settings, collections, ChatRequest(item_id="linux-errno-ENOSPC", question="q1"))
                    self.assertEqual(len(first["trace"]["collected_ids"]), 1)
                    second = respond(settings, collections, ChatRequest(item_id="linux-errno-ENOSPC", question="q2"))
                    self.assertEqual(schemas.count(Selection), 1)
                    self.assertEqual(second["trace"]["collected_ids"], [])
                    self.assertEqual(second["trace"]["selected_ids"], first["trace"]["selected_ids"])
            finally:
                store.close()
