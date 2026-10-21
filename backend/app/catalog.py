"""지식 항목·문서 카탈로그 로더. 도메인 데이터는 backend/catalog/*.json에 있다.

items.json·documents.json은 scripts.build_catalog가 원문 절 추출을 확인한 뒤 생성한다.
URL은 모델이 생성하지 않고 이 허용 목록에서만 나온다.
"""
import json
from pathlib import Path

from pydantic import BaseModel, ConfigDict, Field

CATALOG_DIR = Path(__file__).resolve().parents[1] / "catalog"


class SourceDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")
    doc_id: str
    canonical_url: str
    section: str
    title: str
    product: str
    publisher: str
    license: str
    usage_terms_url: str


class KnowledgeItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    item_id: str
    title_ko: str = Field(min_length=1)
    title_original: str
    category: str
    product: str
    error_codes: list[str]
    symptoms: list[str] = Field(min_length=1)
    summary: str = Field(min_length=10)
    source_excerpt: str = ""
    primary_doc_id: str
    document_ids: list[str]
    source_url: str
    source_section: str
    applies_to_version: str
    scenario_ids: list[str] = []
    annotation_origin: str


def load_catalog(folder: Path = CATALOG_DIR):
    """카탈로그를 읽고 참조 무결성을 검사한다. 생성 전이면 빈 목록을 돌려준다."""
    items_path, docs_path = folder / "items.json", folder / "documents.json"
    if not items_path.exists() or not docs_path.exists():
        return [], {}
    documents = {key: SourceDocument(**value).model_dump()
                 for key, value in json.loads(docs_path.read_text(encoding="utf-8")).items()}
    items = [KnowledgeItem(**value) for value in json.loads(items_path.read_text(encoding="utf-8"))]
    ids = [item.item_id for item in items]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate_item_id")
    for item in items:
        # 주 문서는 항상 첫 번째 문서다. 선별 단계에서 빠지지 않도록 프로그램이 강제한다.
        if not item.document_ids or item.document_ids[0] != item.primary_doc_id:
            raise ValueError("primary_document_not_first:" + item.item_id)
        missing = [doc_id for doc_id in item.document_ids if doc_id not in documents]
        if missing:
            raise ValueError("unknown_document:" + item.item_id)
    return items, documents


ITEMS, DOCUMENTS = load_catalog()
ITEM_BY_ID = {item.item_id: item for item in ITEMS}


def item_text(item: KnowledgeItem) -> str:
    return "\n".join([item.title_ko, item.title_original, item.product, item.category,
                      " ".join(item.error_codes), " ".join(item.symptoms), item.summary, item.source_excerpt])
