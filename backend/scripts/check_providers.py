"""Run from backend: .venv/Scripts/python.exe -m scripts.check_providers."""
import argparse
import json

from app.config import load_settings
from app.providers import ProviderError, embed, generate


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=["generation", "embedding", "all"], default="all")
    args = parser.parse_args()
    settings = load_settings()
    results = {}
    for kind in ("generation", "embedding"):
        if args.only not in (kind, "all"):
            continue
        missing = settings.missing(kind)
        if missing:
            results[kind] = {"status": "not_configured", "missing": missing}
            continue
        try:
            if kind == "generation":
                answer = generate(settings, "Reply with the single word OK.")
                results[kind] = {"status": "ok", "characters": len(answer), "model": settings.llm_model}
            else:
                vectors = embed(settings, ["InfraCoach connection test"])
                results[kind] = {"status": "ok", "dimensions": len(vectors[0]),
                                 "model": settings.embedding_model}
        except ProviderError as exc:
            results[kind] = {"status": "error", "code": str(exc)}
    print(json.dumps(results, ensure_ascii=True, indent=2))
    return 0 if all(r["status"] == "ok" for r in results.values()) else 1


if __name__ == "__main__":
    raise SystemExit(main())
