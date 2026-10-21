import json

from app.config import load_settings
from app.corpus import prepare
from app.providers import ProviderError
import requests


if __name__ == "__main__":
    try:
        print(json.dumps(prepare(load_settings()), ensure_ascii=False, indent=2))
    except (ValueError, ProviderError, requests.RequestException) as exc:
        code = str(exc) if isinstance(exc, (ValueError, ProviderError)) else "source_network_error"
        print(json.dumps({"error": code}))
        raise SystemExit(1)
