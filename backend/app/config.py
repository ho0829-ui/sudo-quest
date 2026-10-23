import os
from typing import Literal
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv
from pydantic import BaseModel, Field, SecretStr, model_validator

BACKEND_ROOT = Path(__file__).resolve().parents[1]


class Settings(BaseModel):
    llm_base_url: str = "https://gms.ssafy.io/gmsapi/api.openai.com/v1/"
    llm_model: str = "gpt-6.1-sol"
    llm_api_key: SecretStr = SecretStr("")
    embedding_base_url: str = ""
    embedding_model: str = ""
    embedding_api_key: SecretStr = SecretStr("")
    # 임베딩 API 형식. openai = /embeddings, gemini = Gemini API batchEmbedContents(x-goog-api-key 헤더).
    embedding_api: Literal["openai", "gemini"] = "openai"
    api_timeout_seconds: float = Field(default=30, gt=0, le=120)
    llm_max_output_tokens: int = Field(default=256, ge=16, le=8192)
    chroma_path: Path = BACKEND_ROOT / "data/chroma"
    community_db_path: Path = BACKEND_ROOT / "data/community.sqlite3"
    community_admin_key: SecretStr = SecretStr("")
    chunk_size: int = Field(default=1000, gt=0)
    chunk_overlap: int = Field(default=200, ge=0)
    external_top_k: int = Field(default=4, ge=1, le=20)
    candidate_limit: int = Field(default=8, ge=0, le=30)
    max_selected_documents: int = Field(default=4, ge=1, le=10)
    cors_origins: list[str] = ["http://127.0.0.1:5173", "http://localhost:5173"]
    # 공개 사이트(github.io)가 사설 주소(이 Mac의 tailnet IP 100.x)로 요청할 때 Chrome이 묻는 사설 네트워크 허용.
    # 허용 출처(cors_origins)만 통과하므로, 공개 실행 스크립트에서만 켠다(scripts/serve-public.sh).
    cors_allow_private_network: bool = False

    @model_validator(mode="after")
    def validate_config(self):
        key = self.community_admin_key.get_secret_value()
        if key and len(key) < 32:
            raise ValueError("COMMUNITY_ADMIN_KEY must contain at least 32 characters")
        if self.chunk_overlap >= self.chunk_size:
            raise ValueError("CHUNK_OVERLAP must be smaller than CHUNK_SIZE")
        for url in (self.llm_base_url, self.embedding_base_url):
            if url:
                parsed = urlsplit(url)
                if (parsed.scheme != "https" or not parsed.hostname
                        or parsed.username or parsed.password or parsed.query or parsed.fragment):
                    raise ValueError("Provider URL must be HTTPS without credentials/query/fragment")
        return self

    def missing(self, kind: str) -> list[str]:
        prefix = "llm" if kind == "generation" else "embedding"
        return [f"{prefix}_{field}".upper() for field in ("base_url", "model", "api_key")
                if not (getattr(self, f"{prefix}_{field}").get_secret_value()
                        if field == "api_key" else getattr(self, f"{prefix}_{field}"))]


def load_settings() -> Settings:
    load_dotenv(BACKEND_ROOT / ".env", override=False)
    values = {name: os.environ[name.upper()] for name in Settings.model_fields
              if name.upper() in os.environ and name != "cors_origins"}
    # A GMS key must never silently be sent to a different provider.
    for prefix in ("llm", "embedding"):
        url = values.get(f"{prefix}_base_url", Settings.model_fields[f"{prefix}_base_url"].default)
        if not values.get(f"{prefix}_api_key") and urlsplit(url).hostname == "gms.ssafy.io":
            values[f"{prefix}_api_key"] = os.getenv("GMS_KEY", "")
    if "CORS_ORIGINS" in os.environ:
        values["cors_origins"] = [s.strip() for s in os.environ["CORS_ORIGINS"].split(",") if s.strip()]
    settings = Settings(**values)
    if not settings.chroma_path.is_absolute():
        settings.chroma_path = BACKEND_ROOT / settings.chroma_path
    if not settings.community_db_path.is_absolute():
        settings.community_db_path = BACKEND_ROOT / settings.community_db_path
    return settings
