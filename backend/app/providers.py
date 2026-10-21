import logging
import math

import requests

from openai import OpenAI, OpenAIError

from app.config import Settings


LOG = logging.getLogger("infracoach.providers")


def log_failure(kind: str, exc: Exception) -> None:
    # 서버 진단용. 예외 메시지에는 키·요청 내용이 섞일 수 있어 종류와 HTTP 상태만 남긴다(NF2004).
    LOG.warning("%s request failed: %s status=%s", kind, type(exc).__name__, getattr(exc, "status_code", None))


class ProviderError(RuntimeError):
    """Only safe error codes cross the CLI/API boundary."""


def client_for(settings: Settings, kind: str) -> OpenAI:
    if settings.missing(kind):
        raise ProviderError("missing_configuration")
    prefix = "llm" if kind == "generation" else "embedding"
    return OpenAI(
        api_key=getattr(settings, f"{prefix}_api_key").get_secret_value(),
        base_url=getattr(settings, f"{prefix}_base_url"),
        timeout=settings.api_timeout_seconds,
        max_retries=0,
    )


def generate(settings: Settings, prompt: str, instructions: str | None = None, max_tokens: int | None = None) -> str:
    try:
        with client_for(settings, "generation") as client:
            extra = {"instructions": instructions} if instructions else {}
            response = client.responses.create(
                model=settings.llm_model, input=prompt, store=False,
                max_output_tokens=max_tokens or settings.llm_max_output_tokens, **extra,
            )
        if response.status != "completed" or not response.output_text.strip():
            raise ProviderError("incomplete_or_empty_generation")
        return response.output_text
    except OpenAIError as exc:
        log_failure("generation", exc)
        raise ProviderError("generation_request_failed") from None


def _check_vectors(vectors: list[list[float]], count: int) -> list[list[float]]:
    if (len(vectors) != count or not vectors or not vectors[0]
            or any(len(v) != len(vectors[0]) for v in vectors)
            or any(not isinstance(x, (int, float)) or not math.isfinite(x) for v in vectors for x in v)):
        raise ProviderError("invalid_embedding_response")
    return vectors


def _gemini_embed(settings: Settings, texts: list[str]) -> list[list[float]]:
    """Gemini API batchEmbedContents. 문서·질문 모두 같은 방식(taskType 없음)으로 만들어 벡터 캐시를 한 갈래로 둔다."""
    if settings.missing("embedding"):
        raise ProviderError("missing_configuration")
    model = settings.embedding_model
    url = f"{settings.embedding_base_url.rstrip('/')}/models/{model}:batchEmbedContents"
    body = {"requests": [{"model": f"models/{model}", "content": {"parts": [{"text": text}]}} for text in texts]}
    try:
        response = requests.post(url, json=body, timeout=settings.api_timeout_seconds, headers={
            "Content-Type": "application/json", "x-goog-api-key": settings.embedding_api_key.get_secret_value()})
    except requests.RequestException as exc:
        log_failure("embedding", exc)
        raise ProviderError("embedding_request_failed") from None
    if response.status_code != 200:
        # 응답 본문에는 요청 일부가 섞일 수 있어 상태 코드만 남긴다.
        LOG.warning("embedding request failed: HTTPError status=%s", response.status_code)
        raise ProviderError("embedding_request_failed")
    try:
        rows = response.json()["embeddings"]
        vectors = [row["values"] for row in rows]
    except (ValueError, KeyError, TypeError):
        raise ProviderError("invalid_embedding_response") from None
    return _check_vectors(vectors, len(texts))


def embed(settings: Settings, texts: list[str]) -> list[list[float]]:
    if settings.embedding_api == "gemini":
        return _gemini_embed(settings, texts)
    try:
        with client_for(settings, "embedding") as client:
            response = client.embeddings.create(
                model=settings.embedding_model, input=texts, encoding_format="float",
            )
        ordered = sorted(response.data, key=lambda row: row.index)
        if [row.index for row in ordered] != list(range(len(texts))):
            raise ProviderError("invalid_embedding_response")
        return _check_vectors([row.embedding for row in ordered], len(texts))
    except OpenAIError as exc:
        log_failure("embedding", exc)
        raise ProviderError("embedding_request_failed") from None
