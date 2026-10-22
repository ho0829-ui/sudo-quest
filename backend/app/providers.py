import logging
import math
import time

import requests

from openai import APIConnectionError, APIStatusError, OpenAI, OpenAIError

from app.config import Settings


LOG = logging.getLogger("infracoach.providers")


def log_failure(kind: str, exc: Exception) -> None:
    # 서버 진단용. 예외 메시지에는 키·요청 내용이 섞일 수 있어 종류와 HTTP 상태만 남긴다(NF2004).
    LOG.warning("%s request failed: %s status=%s", kind, type(exc).__name__, getattr(exc, "status_code", None))


class ProviderError(RuntimeError):
    """Only safe error codes cross the CLI/API boundary."""


# 공급자 일시 장애(5xx·시간 초과·연결 끊김)만 한 번 다시 시도한다. 4xx(키·요청 오류)는 다시 해도 같으므로 바로 실패한다.
# 생성·임베딩 요청은 같은 입력을 다시 보내도 부작용이 없어(store=False) 재시도가 안전하다.
RETRY_ATTEMPTS = 1
RETRY_DELAY_SECONDS = 1.0


class _HttpStatus(Exception):
    """requests 응답의 실패 상태 코드. 본문은 담지 않는다."""
    def __init__(self, status_code: int):
        super().__init__(status_code)
        self.status_code = status_code


def is_transient(exc: Exception) -> bool:
    if isinstance(exc, (APIConnectionError, requests.Timeout, requests.ConnectionError)):
        return True
    status = getattr(exc, "status_code", None)
    return isinstance(exc, (APIStatusError, _HttpStatus)) and isinstance(status, int) and status >= 500


def with_retry(kind: str, call):
    for attempt in range(RETRY_ATTEMPTS + 1):
        try:
            return call()
        except Exception as exc:
            if attempt >= RETRY_ATTEMPTS or not is_transient(exc):
                raise
            log_failure(kind + " (retrying once)", exc)
            time.sleep(RETRY_DELAY_SECONDS)


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
    extra = {"instructions": instructions} if instructions else {}

    def call():
        with client_for(settings, "generation") as client:
            return client.responses.create(
                model=settings.llm_model, input=prompt, store=False,
                max_output_tokens=max_tokens or settings.llm_max_output_tokens, **extra,
            )
    try:
        response = with_retry("generation", call)
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

    def call():
        response = requests.post(url, json=body, timeout=settings.api_timeout_seconds, headers={
            "Content-Type": "application/json", "x-goog-api-key": settings.embedding_api_key.get_secret_value()})
        if response.status_code != 200:
            raise _HttpStatus(response.status_code)
        return response
    try:
        response = with_retry("embedding", call)
    except (requests.RequestException, _HttpStatus) as exc:
        # 응답 본문에는 요청 일부가 섞일 수 있어 예외 종류와 상태 코드만 남긴다.
        log_failure("embedding", exc)
        raise ProviderError("embedding_request_failed") from None
    try:
        rows = response.json()["embeddings"]
        vectors = [row["values"] for row in rows]
    except (ValueError, KeyError, TypeError):
        raise ProviderError("invalid_embedding_response") from None
    return _check_vectors(vectors, len(texts))


def embed(settings: Settings, texts: list[str]) -> list[list[float]]:
    if settings.embedding_api == "gemini":
        return _gemini_embed(settings, texts)
    def call():
        with client_for(settings, "embedding") as client:
            return client.embeddings.create(
                model=settings.embedding_model, input=texts, encoding_format="float",
            )
    try:
        response = with_retry("embedding", call)
        ordered = sorted(response.data, key=lambda row: row.index)
        if [row.index for row in ordered] != list(range(len(texts))):
            raise ProviderError("invalid_embedding_response")
        return _check_vectors([row.embedding for row in ordered], len(texts))
    except OpenAIError as exc:
        log_failure("embedding", exc)
        raise ProviderError("embedding_request_failed") from None
