import json
import tempfile
import unittest
from pathlib import Path

from app.catalog import DOCUMENTS, ITEMS, item_text, load_catalog
from app.collectors import extract_section, product_version

MAN = "https://man7.org/linux/man-pages/man2/open.2.html"
OPEN_ERRORS = """<h2><a id="ERRORS" href="#ERRORS"></a>ERRORS</h2><pre>
       <b>EACCES </b>The requested access to the file is not allowed.

       <b>EACCESS_FAKE </b>Must not match a longer name.

       <b>EACCES </b>Where O_CREAT is specified, a second condition.

       <b>EBADF  </b>Unrelated entry.
</pre><h2><a id="COLOPHON" href="#COLOPHON"></a>COLOPHON</h2><pre>
<span class="footline">Linux man-pages 6.19            2026-05-28</span></pre>"""


class CatalogTests(unittest.TestCase):
    def test_catalog_has_at_least_100_unique_items_with_sources(self):
        # 과제 F2001: 약 100건 이상. 문서 청크 수가 아니라 고유 항목 수로 센다.
        self.assertGreaterEqual(len(ITEMS), 100)
        self.assertEqual(len({item.item_id for item in ITEMS}), len(ITEMS))
        for item in ITEMS:
            self.assertEqual(item.document_ids[0], item.primary_doc_id)
            for doc_id in item.document_ids:
                doc = DOCUMENTS[doc_id]
                self.assertTrue(doc["license"] and doc["usage_terms_url"].startswith("https://"))

    def test_item_text_contains_search_attributes(self):
        item = next(i for i in ITEMS if i.item_id == "linux-errno-ENOSPC")
        text = item_text(item)
        for part in (item.title_ko, "ENOSPC", "Linux", "No space left on device"):
            self.assertIn(part, text)

    def test_catalog_rejects_unknown_document_and_duplicates(self):
        item = ITEMS[0].model_dump()
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "documents.json").write_text("{}", encoding="utf-8")
            (root / "items.json").write_text(json.dumps([item]), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "unknown_document"):
                load_catalog(root)
            docs = {d: DOCUMENTS[d] for d in item["document_ids"]}
            (root / "documents.json").write_text(json.dumps(docs), encoding="utf-8")
            (root / "items.json").write_text(json.dumps([item, item]), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "duplicate_item_id"):
                load_catalog(root)

    def test_man7_entry_collects_all_conditions_only(self):
        text = extract_section(OPEN_ERRORS, MAN, "ERRORS/EACCES")
        self.assertIn("requested access", text)
        self.assertIn("second condition", text)
        self.assertNotIn("FAKE", text)
        self.assertNotIn("Unrelated", text)
        self.assertEqual(product_version(OPEN_ERRORS), "6.19")

    def test_man7_missing_entry_fails_closed(self):
        with self.assertRaisesRegex(ValueError, "source_section_missing"):
            extract_section(OPEN_ERRORS, MAN, "ERRORS/ENOSPC")
