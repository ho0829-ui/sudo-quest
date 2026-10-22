# 데이터 출처·이용 조건과 알려진 한계

README에서 옮긴 내용입니다. 저장소에 들어 있는 원문 발췌와 변경 사항의 고지는 [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md)에 있습니다.

## 1. 지식 출처 (색인 문서 절 220개, 2026-10-23 기준)

| 출처 | 발행 | 라이선스 | 절 수 |
|---|---|---|---:|
| curl 매뉴얼·libcurl 오류 코드 (curl.se) | curl contributors | curl license | 85 |
| Linux man-pages errno(3), connect/open/write(2), getrlimit(2) 등 (man7.org) | Linux man-pages project | Linux-man-pages-copyleft 43 · GPL-2.0-or-later 40 · GPL-3.0-or-later 1 | 84 |
| AWS ALB 문제 해결·타깃 그룹 헬스체크, EC2·IAM·S3 문제 해결 (docs.aws.amazon.com) | Amazon Web Services | CC BY-SA 4.0 | 27 |
| Kubernetes 문서 (kubernetes.io) | The Kubernetes Authors | CC BY 4.0 | 16 |
| Docker 문서 (docs.docker.com) | Docker Inc. (docs contributors) | Apache-2.0 | 8 |

- 수집은 카탈로그에 등록한 공식 페이지의 **특정 절만** 대상으로 합니다. robots.txt를 확인하고, 호스트당 1초 간격을 두며, 429면 자동 재시도하지 않습니다(ADR 007).
- 원문 캐시(`backend/data/`)는 Git에서 제외합니다.
- 학습 항목 131개의 한국어 제목·증상·요약은 LLM 보조로 작성했고 원문 대조 검수가 남아 있습니다.

## 2. 알려진 한계

- **정답 데이터는 브라우저 코드에 있다.** 원인 보기는 판마다 섞고 코치(서버)에는 보내지 않지만(ADR 005), 코드를 읽으면 정답을 볼 수 있습니다. 순위를 매기는 챌린지 모드는 서버 검증이 생긴 뒤에 만듭니다.
- **가상 환경의 범위.** 명령 39개와 그 옵션 일부만 지원합니다. Kubernetes는 default 네임스페이스·Recreate 배포·즉시 상태 계산 모델이고 실제 클러스터 수준이 아닙니다. 파이프(`|`)·리다이렉션(`>`)·`*`는 되고 `&&`·`;`·`$( )`·`<`는 아직 안 됩니다.
- **응답 시간.** 첫 질문은 약 10~15초(평가 v2, `gpt-6-luna` 기준 p50 11.8초)이고 가장 오래 걸리는 단계는 문서 선별입니다. 같은 질문은 캐시로 즉시 답합니다. 긴 원문 절에서는 인용 검증에 실패해 답을 못 받는 경우가 있습니다(평가 v2에서 24문항 중 1개).
- **배포.** 정적 배포본(GitHub Pages)에서는 게임만 동작합니다. AI 코치·게시판은 백엔드가 필요합니다.
- **저장.** 진행 기록은 브라우저 localStorage, 게시판은 서버의 SQLite 파일 하나입니다(ADR 003). 로그인·기기 간 동기화는 아직 없습니다.
