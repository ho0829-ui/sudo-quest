import logging
import math

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


def embed(settings: Settings, texts: list[str]) -> list[list[float]]:
    try:
        with client_for(settings, "embedding") as client:
            response = client.embeddings.create(
                model=settings.embedding_model, input=texts, encoding_format="float",
            )
        ordered = sorted(response.data, key=lambda row: row.index)
        vectors = [row.embedding for row in ordered]
        if ([row.index for row in ordered] != list(range(len(texts))) or not vectors
                or not vectors[0] or any(len(v) != len(vectors[0]) for v in vectors)
                or any(not math.isfinite(x) for v in vectors for x in v)):
            raise ProviderError("invalid_embedding_response")
        return vectors
    except OpenAIError as exc:
        log_failure("embedding", exc)
        raise ProviderError("embedding_request_failed") from None
