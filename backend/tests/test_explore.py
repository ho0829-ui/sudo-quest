import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from app import explore
from app.catalog import ITEM_BY_ID
from app.config import Settings
from app.main import create_app


def judgement(matches, unverifiable=()):
    return json.dumps({"matches": [{"item_id": i, "reason": "메타데이터 확인"} for i in matches],
                       "unverifiable_conditions": list(unverifiable)}, ensure_ascii=False)


class FakeCollection:
    def __init__(self, ids):
        self.ids, self.where = ids, None

    def query(self, query_embeddings, n_results, where, include):
        self.where = where
        return {"ids": [self.ids[:n_results]]}


SETTINGS = Settings(llm_api_key="t", embedding_api_key="t", embedding_base_url="https://example.com/v1/",
                    embedding_model="t")


class ExploreTests(unittest.TestCase):
    def test_explicit_conditions_products_and_known_codes_only(self):
        found = explore.explicit_conditions("리눅스에서 ENOSPC나 EFOOBAR 같은 오류")
        self.assertEqual(found, {"products": ["Linux"], "codes": ["ENOSPC"]})
        self.assertEqual(explore.explicit_conditions("ALB HTTP 503")["codes"], ["503"])
        self.assertEqual(explore.explicit_conditions("curl 오류 28")["products"], ["curl"])
        self.assertEqual(explore.explicit_conditions("curl에서 ALB로")["products"], ["curl", "AWS ALB"])
        self.assertEqual(explore.explicit_conditions("calbration curly")["products"], [])
        self.assertEqual(explore.explicit_conditions("인증서 관련 오류"), {"products": [], "codes": []})

    def test_code_condition_uses_exact_items_without_embedding(self):
        def no_embed(*_):
            raise AssertionError("embedding must not be called")
        conditions = {"products": [], "codes": ["503"]}
        items = explore.find_candidates(SETTINGS, {}, "503", conditions, no_embed)
        self.assertEqual([i.item_id for i in items], ["aws-alb-http-503-issues"])

    def test_product_filter_passed_to_vector_search(self):
        collection = FakeCollection(["curl-60", "curl-35"])
        items = explore.find_candidates(SETTINGS, {"knowledge_items": collection}, "인증서 curl",
                                        {"products": ["curl"], "codes": []}, lambda s, t: [[1.0]])
        self.assertEqual(collection.where, {"product": {"$in": ["curl"]}})
        self.assertEqual([i.item_id for i in items], ["curl-60", "curl-35"])

    @patch("app.explore.check_manifest", return_value={"corpus_hash": "h"})
    def test_filter_violations_removed_unknown_ids_rejected_and_cached(self, manifest):
        with tempfile.TemporaryDirectory() as folder:
            settings = SETTINGS.model_copy(update={"chroma_path": Path(folder) / "chroma"})
            collection = FakeCollection(["curl-60", "curl-35", "linux-errno-EACCES"])
            collections = {"knowledge_items": collection}
            with patch("app.explore.embed", return_value=[[1.0]]), \
                    patch("app.explore.generate", return_value=judgement(["curl-60", "linux-errno-EACCES"], ["난이도"])) as gen:
                result = explore.search(settings, collections, "curl 인증서 오류 중 초급")
                self.assertEqual([c["item_id"] for c in result["cards"]], ["curl-60"])
                self.assertEqual(result["rejected_by_filter"], ["linux-errno-EACCES"])
                self.assertEqual(result["unverifiable_conditions"], ["난이도"])
                self.assertTrue(explore.search(settings, collections, "curl  인증서 오류 중 초급")["cache_hit"])
                self.assertEqual(gen.call_count, 1)
            with patch("app.explore.embed", return_value=[[1.0]]), \
                    patch("app.explore.generate", return_value=judgement(["made-up-item"])):
                with self.assertRaisesRegex(ValueError, "explore_judgement_invalid"):
                    explore.search(settings, collections, "다른 조건")

    @patch("app.explore.check_manifest", return_value={"corpus_hash": "h"})
    def test_no_match_returns_empty_cards_with_notice(self, manifest):
        with tempfile.TemporaryDirectory() as folder:
            settings = SETTINGS.model_copy(update={"chroma_path": Path(folder) / "chroma"})
            with patch("app.explore.embed", return_value=[[1.0]]), \
                    patch("app.explore.generate", return_value=judgement([])):
                result = explore.search(settings, {"knowledge_items": FakeCollection(["curl-7"])}, "데이터베이스 교착")
        self.assertEqual(result["cards"], [])
        self.assertTrue(any("찾지 못했습니다" in n for n in result["notes"]))

    def test_api_rejects_extra_fields(self):
        with tempfile.TemporaryDirectory() as folder:
            with TestClient(create_app(Settings(chroma_path=Path(folder)))) as client:
                r = client.post("/api/items/search", json={"query": "curl", "item_id": "secret-marker"})
                self.assertEqual(r.status_code, 422)
                self.assertNotIn("secret-marker", r.text)
                self.assertEqual(client.post("/api/items/search", json={"query": ""}).status_code, 422)
        self.assertIn("curl-60", ITEM_BY_ID)
