#!/usr/bin/env bash
# 공개용 API 서버 실행(운영자 Mac). Tailscale Funnel이 이 포트(127.0.0.1:8000)만 밖으로 연결한다.
# 키는 backend/.env에 그대로 두고, 공개용 설정(허용 출처·생성 모델)만 여기서 환경변수로 넘긴다(.env를 고치지 않는다).
# 실행: scripts/serve-public.sh   (끄기: Ctrl+C)
set -euo pipefail
cd "$(dirname "$0")/../backend"

PAGES_ORIGIN="${PAGES_ORIGIN:-https://ho0829-ui.github.io}"
export CORS_ORIGINS="$PAGES_ORIGIN,http://127.0.0.1:5173,http://localhost:5173"
export LLM_MODEL="${PUBLIC_LLM_MODEL:-gpt-6.1-sol}"

if lsof -nP -iTCP:8000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "8000 포트를 이미 다른 서버가 쓰고 있습니다. 그 서버를 끄고 다시 실행하세요." >&2
  exit 1
fi
echo "공개용 API: 127.0.0.1:8000 · 허용 출처 $PAGES_ORIGIN · 생성 모델 $LLM_MODEL"
exec .venv/bin/python -X utf8 -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000
