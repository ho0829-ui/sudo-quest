# 분야별 NPC 오마주와 랜덤 퀘스트 연출

2026-10-22 · Mac · Codex

## 사용자 요청과 구현

기존 퀘스트 대화창 배치와 마지막 상반신 구도를 유지했다. 제안한 인물들을 이름·외형·소품으로 알아보는 이스터 에그로 추가했다. 사진 파일은 포함하지 않고 기존 코드 기반 SVG 캐릭터의 헤어라인·안경·수염·옷을 변형했다. 새 라이브러리·이미지 다운로드·유료 생성 호출은 없다.

| 분야 | NPC | 공간과 단서 |
| --- | --- | --- |
| Linux | 리누스 | 커널 작업실, 오래된 터미널과 펭귄 |
| 네트워크 | 빈트 | 패킷 교환실, 지구본과 패치 패널 |
| 웹 | 팀 | 하이퍼텍스트 연구실, 연결된 문서와 모니터 |
| DB | 몬티 | 데이터 보관소, 서랍·저장 장치와 돌고래 |
| Docker | 솔로몬 | 컨테이너 부두, 크레인·화물선과 고래 |
| Kubernetes | 브렌던·조·크레이그 교대 | 클러스터 항해실, 조타륜과 세 노드 지도 |
| AWS | 기존 도윤 | 클라우드 전망대, 구름과 도시 |

일반 화면에는 짧은 호칭만 나온다. 대화창 이름 옆 ✧를 누르면 전체 이름·관련 업적과 게임 속 창작 대사임을 보여 준다. 실제 인물의 발언·참여·추천을 주장하지 않는다. 배경은 모두 가상 공간 장식이며 실시간 모니터링 값이 아니다.

## 다섯 연출

1. 시네마틱 줌인: 기존 전신 → 상반신 카메라 이동.
2. 사이드 트래킹: 옆에서 인물이 들어오고 배경은 반대 방향으로 이동.
3. 크레인 업: 아래에서 위로 올라오며 가까워짐.
4. 포커스 풀: 흐릿한 인물에 초점을 맞춤.
5. 홀로그램 연결: 위에서 아래로 인물이 연결되고 스캔 선이 지나감. 화면 전체 번쩍임 없음.

각 1.6초, 건너뛰기 가능. 셔플 주머니에서 한 바퀴에 다섯 종류를 모두 뽑고 바퀴 경계에서도 같은 종류가 연속되지 않는다. Kubernetes의 세 NPC도 별도 주머니에서 교대한다. 페이지를 새로고침하면 순서는 초기화된다.

`다른 장면 보기 ↻`는 대화를 첫 페이지부터 다시 연다. 게임을 시작하거나 진행 기록을 만들지 않는다. 실제 세션 생성·타이머 시작은 마지막 퀘스트 수락 버튼에서만 한다. 이어서 하기는 기존처럼 브리핑을 건너뛴다.

앱 모션 끄기·OS 동작 줄이기 설정이면 최종 구도로 즉시 대화한다. 배경 패킷·물결도 정지한다.

## 파일과 경계

- `src/ui/quest/cast.ts`: 9명(오마주 8명 + 도윤)의 표현 데이터, 분야 배정. `web-db`는 공개 명령 목록에 `mysql`이 있는지로 나눈다. 새로운 DB 실습에 SQL 명령이 없으면 이 분류 규칙을 검토할 것.
- `presentation.ts`: 5가지 등장 연출과 셔플. React 렌더가 아닌 클릭 이벤트에서 선택해 재렌더 때 순서를 소모하지 않는다.
- `OfficerFace.tsx`, `QuestOfficer.tsx`: 공유 인체와 인물별 외형.
- `QuestBackdrop.tsx`, `backdrops/Workshops.tsx`, `backdrops/Harbors.tsx`: 7개 공간의 SVG.
- `QuestBriefing.tsx`, `cinematics.css`, `quest.css`: 단서 열기, 재연출, 카메라·배경 모션, 모바일, 티켓 스크롤바.
- `src/ui/screens/TicketScreen.tsx`: 공개 분야와 선택한 장면만 전달. 정답·faults·전체 state·학습 목표는 전달하지 않는다.
- `src/ui/ending/creditRoll.ts`: 새 기능 장과 대체한 공통 서버 랙 배경의 비석, 도윤의 역할 설명 갱신.
- `tests/quest-cast.test.tsx`: 분야 배정·K8s 교대·9개 외형·7개 공간·셔플 경계·수락 전 시작 금지·티켓 이스케이프 등 8개 테스트.

## 실제 검증

- `npm run typecheck`: 통과.
- 최초 `npm test`: 905 통과 / 7 실패. 6개는 5초 제한 초과, 1개는 기존 300명령 성능 기준 초과(평균 85ms, 한도 50ms). 기능 결과 불일치는 없었음.
- `npm test -- --maxWorkers=2`: 911 통과 / 1 실패. 기존 docker-disk-full 퍼징 5.264초로 5초 제한 초과.
- `npm test -- --maxWorkers=1`: **912개 / 38파일 모두 통과**, 46.60초. 시간 제한과 성능 기준은 완화하지 않았다. 동시 실행 수에 민감한 상태이며 기본 병렬 실행을 통과했다고 보고하지 않는다.
- 최종 SVG·CSS 조정 후 `npm run build`: 통과(265 모듈, 큰 번들 경고 없음). 퀘스트 JS 18.69kB, gzip 7.01kB.
- 최종 관련 회귀 검사: `npm test -- --maxWorkers=1 tests/quest-cast.test.tsx tests/quest-presentation.test.tsx tests/ending.test.tsx` → **27개 / 3파일 통과**.
- `git diff --check`: 통과.
- 브라우저 1280×720: 7개 공간, K8s 브렌던→조→크레이그 교대, 실제 다섯 `animation-name`, 1.6초 후 대화 전환, 재연출, 단서 토글, 건너뛰기, Esc 취소·조사 시작으로 포커스 복귀, Tab/Shift+Tab 순환 확인.
- 375×812 및 320×568: 가로 넘침 0. 단서를 펼친 두 번째 대화에서도 수락 버튼이 화면 안에 남음. 좁은 화면은 배경 좌우 일부가 잘린다.
- 별도 빌드 미리보기 `127.0.0.1:4173`: 초기 0XP 확인 후 모션 끄기 → 즉시 대화, 인물·물결 애니메이션 `none` → 수락 → `/mission/17/play` → 가상 `help` 정상 실행. 기존 5173 학습 기록과 분리한 검증이다. 미리보기 프로세스와 탭은 종료했다(4173에 테스트 세션이 저장될 수 있음).
- 복구 후 개발 화면 및 빌드 검증 탭 콘솔 오류·경고 0. 유료 RAG 호출 없음.

미검증: 실제 휴대폰, Safari·Firefox, OS 동작 줄이기 설정을 직접 바꾸는 검증(앱 모션 끄기는 실측), 백엔드 회귀 테스트, 모든 실습의 브라우저 완주. NPC 외형과 연출 분위기에 대한 사용자 피드백은 아직 받지 않았다.

## 실행 환경

시작 시 Vite 9618/5173, Python 11836/8000이 있었고 임의 종료하지 않았다. 검사 도중 두 프로세스가 모두 없어진 것을 확인했다(종료 원인은 확인하지 못함). 다음 명령으로 기존 포트를 복구했다.

```sh
npm run dev
backend/.venv/bin/python -m uvicorn app.main:create_app --factory --app-dir backend --host 127.0.0.1 --port 8000
```

종료 시 Vite **16997 / 5173**, API **16999 / 8000**. 환경변수·키·게시판 DB는 수정하지 않았다.

## 시각 증빙

- [데스크톱: 솔로몬과 부두](evidence/quest-cast/docker-desktop.png)
- [320px: 단서와 수락 버튼](evidence/quest-cast/mobile-320.png)

## 인물 참고 자료

아래는 외형·인물 연결의 참고 출처다. 원본 사진을 제품 자산으로 복제하거나 트레이싱하지 않았다. 별도의 실제 사진을 향후 넣는다면 해당 파일의 이용 조건을 다시 확인할 것.

- [리누스 사진 — Wikimedia Commons](https://commons.wikimedia.org/wiki/File:LinuxCon_Europe_Linus_Torvalds_01.jpg)
- [빈트 사진 — Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Vint_Cerf_close-up_%28cropped%29.jpg)
- [팀 사진 — Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Tim_Berners-Lee.jpg)
- [몬티 사진, 오른쪽 인물 — Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Monty-Widenius-David-Axmark-MySQL-2003-05-09.jpg)
- [솔로몬 사진 — Wikimedia Commons](https://commons.wikimedia.org/wiki/File:518392245AG185_TechCrunch_D_-_Solomon_Hykes.jpg)
- [브렌던 사진 — HashiConf](https://www.hashicorp.com/en/conferences/hashiconf/speakers/brendan-burns)
- [조·크레이그 사진 — Heptio 제공, GeekWire](https://www.geekwire.com/2019/creators-kubernetes-discuss-past-future-geekwires-3rd-annual-cloud-summit/)
- [Kubernetes의 시작 — 공동 개발자 회고, 공식 블로그](https://kubernetes.io/blog/2018/07/20/the-history-of-kubernetes-the-community-behind-it/)
