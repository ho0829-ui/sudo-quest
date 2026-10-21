import math

from openai import OpenAI, OpenAIError

from app.config import Settings


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


def generate(settings: Settings, prompt: str) -> str:
    try:
        with client_for(settings, "generation") as client:
            response = client.responses.create(
                model=settings.llm_model, input=prompt, store=False,
                max_output_tokens=settings.llm_max_output_tokens,
            )
        if response.status != "completed" or not response.output_text.strip():
            raise ProviderError("incomplete_or_empty_generation")
        return response.output_text
    except OpenAIError:
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
    except OpenAIError:
        raise ProviderError("embedding_request_failed") from None
