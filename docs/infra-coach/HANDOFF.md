# InfraCoach 현재 인수인계

갱신: 2026-10-22 · 단계: Phase 4 큰 사내 카페·예시 글 완료. 다음은 Phase 5(올클리어 피날레·엔딩 크레딧·음악) — 승인된 계획대로

## 최신 상태 — Phase 4 큰 사내 카페·예시 글 (2026-10-22, Mac, Claude)

- 사용자 요청: "더 규모가 큰 사내 카페… 사람도 복작복작하게 미리 예시 게시글… 모든 스테이지 클리어하면 추가 이벤트(폭죽·축하 메시지)… 엔딩 크레딧(나(Choi)·클로드·gpt, 유쾌하게, 추가 기능도 넣고 삭제한 기능은 무덤)… 음악(끌 수 있게, 한국 저작권 문제 없는 축하·파티 음악)". 계획을 Phase 4(카페)·Phase 5(피날레·크레딧·음악)로 나누고 질문 4개에 답을 받음: **예시 글은 백엔드 DB**, **음악은 코드로 연주하는 8비트 캉캉(오펜바흐 1858, 퍼블릭 도메인)**, **피날레는 홈에서 자동 1회 + 다시 보기**, **답변대로 Phase 4 바로 시작**.
- 카페(`ui/community/cafe/`):
  - `floor.ts`: 22×14, 길목 5×4 격자(장테이블이 막는 x=10 세로 구간은 끊음), 원탁 9개·장테이블 의자 12(직원 2자리 제외), 입구·주문 자리, 가구 사각형(카운터·선반·소파·낮은 탁자·장테이블·부스·무대·냉장고·창가 바), 스탠딩 테이블, 좁은 화면 구역 `NARROW_SPOTS`.
  - `staff.ts`: 배경 직원 25명(주문 줄·TIL 발표자와 청중·회의 부스·스탠딩 수다·소파·게시판 읽기·창가 바·장테이블 노트북·걸어 다니는 둘). 말풍선 없음·누를 수 없음. 손님 자리와 0.5 이상 떨어짐(테스트).
  - `furniture.tsx`: 의자·원탁·장테이블 조각(양 끝 앞뒤가 맞게 6조각)·부스(뒤 유리/탁자/앞 유리 세 깊이)·스탠딩·화분·직원을 깊이와 함께 돌려줌. 파티면 장테이블에 케이크.
  - `CafeRoom.tsx`: 벽 두 개 창문·코르크 게시판+실제 글 수·메뉴판 둘·입구·OPEN·긴 커피 바와 바리스타 둘·음료 냉장고·TIL 무대와 화이트보드·소파·창가 바.
  - 손님 최대 14명(좁은 화면 6명). 말풍선은 번갈아 한 줄 높이 띄우고(가는 줄로 머리와 연결) 깊이 순서로 그려 앞사람 것이 위. 좁은 화면은 가운데만 잘라(viewBox) 그 구역 자리로만 걷게 함(`step`의 allowed).
  - 화면 "예시" 표시: 게시판 목록·상세·댓글·카페 안내 칸(`ExampleTag`), 화면 읽기 이름에 ", 예시 글".
- 백엔드: 스키마 v3(`posts.example`, `comments.example`, v2 파일 자동 올림), 응답에 `example` 포함. `app/community/examples.py`(글 18·닉네임 11·댓글, 원인·풀이 없음, 실습 회고는 spoiler), `app/community/seed.py`(없을 때만 넣기·날짜 순서·미래 시각 방지·예시만 지우기), `scripts/seed_community.py`(--status/--remove). 프론트 검증기는 `example`이 없거나(예전 서버) boolean일 때만 통과.
- **로컬 DB에 예시 글 18개를 실제로 넣었다**(사용자 선택). 글 번호는 #9~#26(Phase 3 시험 글 1~8 삭제 뒤라). 지우려면 `--remove`. API는 새 스키마를 읽도록 한 번 재시작함.
- 실행한 검사: typecheck, vitest **890개/36파일**(cafe 20: 스탠딩 테이블 비켜 가기·직원 위치·좁은 구역 연결과 그 안에서만 걷기·14명 시작 자리·example 검증기 추가), 백엔드 unittest **70개**(새 `test_community_examples` 4: 데이터 형식·한 번만 넣기·최신순·미래 없음·상세 example·풀이 포함 미리보기 숨김·예시 댓글·사람 글 보존 삭제·v2→v3), build 통과, diff --check 통과.
- 브라우저(별도 출처 127.0.0.1:5173): 손님 11명+직원 25명, 확대해 겹침 확인 → 무대 청중을 가리던 화분 제거, 말풍선 겹침 → 높이 번갈아·깊이 순서. 부스 앞뒤 겹침 정상. 375px: 6명·가운데 구역·가로 넘침 0. 콘솔 오류 0, 검사 탭 저장소 비어 있음.
- 미검증: 손님 14명 꽉 찬 상태(예시 글 닉네임 11명), 실제 휴대폰. 말풍선은 여전히 가끔 일부 겹친다(완전 배치 계산은 안 함).
- 실행 중: Vite 5173, API 8000(preview "api-mac", 재시작함). 유료 호출 없음.
- 커밋: feat(community) 큰 사내 카페·예시 글. push 없음.
- 다음: Phase 5 — 승인된 계획(피날레 홈 자동 1회+다시 보기, 엔딩 크레딧 Choi·Claude·GPT(Codex)·무덤, 8비트 캉캉 Web Audio·음소거, credits.ts 테스트, CLAUDE.md "기능 추가·삭제 시 크레딧 갱신" 규칙).

## 이전 상태 — Phase 3 커뮤니티 카페 (2026-10-22, Mac, Claude)

- 사용자 요청: "다음은 Phase 3 커뮤니티 카페야. 계획 먼저 보여줘." → "Phase 3 계획대로 진행해줘. 기본값 제안도 그대로 좋아."(움직임 B 길목 따라 걷기, 최대 10명·좁은 화면 6명, 말풍선 12자, 데스크톱 클릭 바로 열기·터치 두 번 탭, 테스트 글은 삭제 비밀번호로 만들고 검증 뒤 삭제)
- 게시판 목록 화면 위에 큰 카페(`ui/community/cafe/`). 글 상세·글쓰기 화면에는 없음. 백엔드 변경 없음(목록 API `page_size=30` 한 번 더 요청).
  - `crowd.ts`: 최신 글 → 손님(닉네임별 묶기, 가장 최근 글을 말풍선, 닉네임 해시로 옷 색, 글자 단위 제목 줄이기, 하루 안 글은 fresh).
  - `floor.ts`: 14×10 평면, 테이블 6개·의자 12개, 길목 4×3 격자 + 의자·입구·카운터를 가까운 길목에 연결(입구는 두 길목). 가구 사각형 목록.
  - `wander.ts`: `step`(순수 함수) — 쉬다가(의자 6~12초, 그 밖 2~5초) 이웃한 빈 자리로 걸어감, 같은 자리 금지, 입구로 되돌아가지 않음. 훅은 400ms 시계만 돌리고, 앱 모션 끔·OS 동작 줄이기면 멈춤. 손님 목록이 바뀌면 새 사람만 문으로.
  - `CafeRoom.tsx`(벽돌 벽·창문·코르크 게시판+실제 글 수·메뉴판·입구·선반·카운터와 바리스타·소파), `CafeScene.tsx`(의자·테이블·화분·손님을 x+y 깊이로 정렬, 말풍선은 맨 위 층, 아래 안내 칸), `Visitor.tsx`(몸 + 말풍선 링크 `#/community/id`, 화면 읽기 이름 "닉네임: 제목 (분류, 댓글 n개)").
  - 새 글 손님은 최근 2명만 문으로 걸어 들어오고 NEW 표시(여럿이면 문 앞에 줄 섬 → 2명으로 제한, 문밖 대기는 투명·누를 수 없음). 빈 카페는 "첫 이야기를 남겨 주세요"(글쓰기 링크), 서버 꺼짐은 "카페 서버 준비 중". 전체 클리어면 파티(고깔모자·케이크).
  - 재사용을 위해 `campus/art/CommunityArt.tsx`의 `BrickWall`·`Window`를 내보냄(Window는 위치를 받음).
- 브라우저에서 발견·수정: ① 테스트 글이 모두 새 글이라 전원이 문 앞에 겹침 → 입장 2명 제한·문밖 투명 ② 펜던트 조명 갓이 뒤에 선 손님 얼굴을 가림 → 큰 카페에서는 조명 뺌 ③ NEW가 제목에 붙음 → 말풍선 폭 늘림 ④ 375px에서 말풍선 글자가 약 5px → 좁은 화면은 글자 10(8자) ⑤ 터치 첫 탭이 바로 글을 엶(탭의 focus가 click보다 먼저 "고름" 상태를 만듦) → pointerdown 순간의 상태로 판단.
- 실행한 검사: typecheck 통과, vitest **886개/36파일**(새 `cafe.test.tsx` 16: 묶기·인원·fresh·제목 줄이기·옷 고정, 평면 자리/길목이 가구를 안 뚫음·연결성·시작 자리 중복 없음, 걷기·도착·같은 자리 금지 10명×10분·입구 복귀 없음·방향, 링크와 접근성 이름·HTML 이스케이프, 첫 렌더), build 통과(CommunityScreen 조각 30.8kB, index 372kB).
- 브라우저(개발 서버 5173·API 8000, 별도 출처 `127.0.0.1:5173`): 로컬 게시판이 0건이라 테스트 글 8건(닉네임 7명, 한 명 2건, 풀이 포함 1건, 긴 제목·이모지)을 삭제 비밀번호로 만들어 확인 → 확인 뒤 8건 모두 삭제(204), 게시판 0건 복귀. 비밀번호는 탭 저장소에만 두었고 정리함. **SQLite AUTOINCREMENT라 다음 글 번호는 9부터 시작한다.** 데스크톱 호버 안내·클릭 열기(풀이 포함 글 #3), 모션 끔(제자리), 375px(6명·가로 넘침 0·두 번 탭), API를 잠깐 멈춰 서버 꺼짐 표시(그때 프록시 500 콘솔 기록 8건) 후 API 다시 띄움, 전체 클리어 파티, 빈 카페. 검사 탭 저장소 정리·닫음.
- 미검증: 실제 휴대폰 터치(에뮬레이션만), 하루 지난 글(이번 테스트 글은 모두 새 글 — 단위 테스트로만), 손님 10명 꽉 찬 데스크톱(7명까지 봄), 말풍선끼리 겹침은 그대로 둠(후속 후보).
- 실행 중: Vite 5173(preview "dev"), API 8000(preview "api-mac", 검증 중 한 번 멈췄다 다시 띄움). 유료 호출 없음.
- 커밋: feat(community) 카페 장면. push·master 병합 없음.

## 이전 상태 — Phase 2 운영실 파티·오픈 예정 실습 (2026-10-22, Mac, Claude)

- 사용자 요청: Phase 2를 "사이버펑크 퇴근"에서 바꿔 "사내 파티 분위기… 각각의 지역마다 특색이 있는 파티" → 수정 계획 승인 "수정한 Phase 2 계획대로 진행해줘."
- 규칙: 한 분류의 열린 실습을 모두 풀면 그 운영실이 파티 모드. 파티 여부는 학습 기록에서 매번 계산하고(`ui/party.ts` `partyState`), 저장하는 것은 "시작 연출을 봤다"는 기록뿐(`incident-game/celebrations`, 키 `분류:실습수`·`all:전체수`). 실습이 늘면 근무 모드로 돌아가고, 다시 다 풀면 새 파티. 진행 기록 초기화 때 함께 지움.
- 방마다 파티(`ui/campus/party/*.tsx`, 방 그림의 그리는 순서 자리에 꽂아 두고 파티 때만 나타남 — 아이소메트릭은 뒤→앞 순서라 위에 한꺼번에 얹지 않음):
  - 리눅스 "업타임 생일 파티": 통로 지붕 초록 전구 줄, 터미널 커서 초를 꽂은 케이크, 고깔모자 펭귄 인형, `$ echo "HAPPY UPTIME"` 현수막.
  - 네트워크 "핑퐁 대회": 패치 케이블 깃발 줄, 탁구대(공이 오감)·선수 둘, 매단 점수판 `PING 1ms / 0% loss · 11 : 9`.
  - 웹·DB "쿼리 칵테일 바": 랙 앞 바 카운터·바텐더·손님, 네온 `ACID BAR`, 메뉴판 COMMIT·ROLLBACK·INNER JOIN, 미러볼.
  - 클라우드 "루프톱 풍선 파티": 로드 밸런서에 묶은 AZ-a/b/c·ap-2·us-1 풍선, 유리벽 전구 줄, 바비큐 그릴·음료 테이블, 창밖 열기구.
  - 컨테이너 "고래 풀 파티": 고래가 꽃가루를 뿜음(`Whale`이 PartyContext를 읽음), 비치볼·튜브, 선베드·파라솔, 스낵 카운터 `docker run --rm snacks`, 만국기.
  - 쿠버네티스 "선상 보물 연회": 돛대 사이 만국기·뱃머리 등불, 열린 etcd 보물상자와 금화, 갑판 축포, 하늘 불꽃.
  - 전체 클리어: 관제실 "전사 시상식"(시상대 1·2·3위·트로피·스포트라이트·`ALL SECTORS CLEAR`), 커뮤니티 카페에 케이크 배달.
  - 사람: `PartyContext` 안의 `Person`이 스스로 고깔모자, 태블릿·노트북→잔, 서 있으면 춤·앉아 일하면 두 팔 환호. 걷는 사람은 그대로 걷는다.
- 시작 연출(처음 한 번): 방 가운데 꽃가루 축포·번쩍임 + 지도 위 안내 띠("… 시작!"), 6.5초 뒤 사라짐. 모션 끔에서는 축포 숨김·안내 띠는 정지 상태로 보였다가 타이머로 제거, 동작 줄이기에서도 축포가 보이지 않음. HUD: 파티 이름·"다음 실습 n개 준비 중", 범례 "파티 중 n곳".
- 리포트: 이 클리어로 새 파티가 열렸고 아직 못 봤으면 "파티 보러 가기"(전체면 "시상식 보러 가기") → 홈. 이미 본 파티·다시 푼 실습에는 안 뜸(`partyNotice`).
- 오픈 예정: `src/scenarios/upcoming.ts` 11건(제목·한 줄 소개만, 원인 없음). 실습 목록에 잠긴 `OPENING SOON` 카드(난이도 필터·기록 화면에서는 숨김), HUD 예고 개수. 실제 시나리오가 생기면 여기서 지움(가이드에 적음).
- 발견·주의: 방 앞쪽 바닥(x·y 큰 쪽)은 앞 방의 뒷벽에 가려 거의 안 보인다. 그래서 탁구대·바·시상대는 방 가운데~뒤쪽에 둠. 다른 방 장식을 더할 때도 같은 제약.
- 실행한 검사: typecheck 통과, vitest **870개/35파일**(새 `party.test.tsx` 25: 파티 계산·실습 증가 시 해제·본 기록·손상/막힌 저장소·초기화·리포트 안내·오픈 예정 스키마·목록 카드·방마다 파티 표시 유무·축포·사람 자세·캠퍼스 시작 연출 1회), build 통과(index 371kB, 500kB 경고 없음).
- 브라우저(개발 서버 5173, 별도 출처 `127.0.0.1:5173` 탭 — 사용자 localhost 기록은 건드리지 않음): 리눅스만 → 8개 방 전부 클리어로 기록을 넣고 방마다 확대해 겹침 확인·조정(네트워크 탁구대·웹DB 바를 보이는 곳으로 이동, 관제 현수막을 시상대에서 비킴, 열기구를 방 밖으로). 시작 연출 1회(재방문 시 안내 띠·축포 없음, `party-burst` 애니메이션 실행 확인), 모션 끔, 375px(안내 띠가 3줄로 좁아지던 것 수정 → 2줄, 가로 넘침 0). 검사 뒤 그 출처의 저장소 정리·탭 닫음. 콘솔 오류는 편집 도중 HMR 순간의 `useParty` 미정의 1건뿐(재로드 후 없음).
- 미검증: 리포트 "파티 보러 가기"는 단위 테스트로만(브라우저에서 실습을 끝까지 풀어 보지는 않음). 실제 휴대폰·Safari·Firefox, 축포를 눈으로 본 프레임 캡처(타이밍상 애니메이션 상태로만 확인).
- 실행 중: Vite 5173(preview "dev"), API 8000(preview "api-mac"). 유료 호출 없음.
- 커밋: feat(campus) 운영실 파티·오픈 예정. push·master 병합 없음.
- 다음: Phase 3 — 커뮤니티 카페(큰 아이소메트릭, 최근 글쓴이가 말풍선과 함께 돌아다님, 목록은 아래). 계획 먼저.

## 이전 상태 — Phase 1 웹페이지 안정성 점검 (2026-10-22, Mac, Claude)

- 사용자 요청: "시나리오는 늘리는건 일단 잠정 중단하고 웹페이지 안정성 검사랑 각 영역별로 장애를 모두 해결하면 … 퇴근 … 사이버펑크 … 오픈 예정 … 커뮤니티 카페 …" → 3단계 계획 승인, "계획대로 Phase 1(안정성 점검)부터 진행해줘. 기본값 제안도 그대로 좋아."
- 결과 보고서: `17_안정성_점검.md`(문제 6건·조치·검증, 문제없음 확인 항목, 한계).
- 고친 것: ① Error Boundary 3단(앱·화면 구역·코치 패널), 조각 파일 받기 실패는 새로고침 안내 ② `crypto.randomUUID` 없는 HTTP(IP 접속)에서 코치 패널 멈춤 → `randomId` ③ 지식·코치·조건 탐색 응답 모양 검사(`api/validate.ts`) ④ 저장된 대화 턴 하나씩 검사(`sanitizeTurns`) ⑤ 명령 예외 안전망(그 줄만 `[시뮬레이터 오류]`, 상태는 실행 전) ⑥ 없는 주소를 보이는 화면 주소로 정규화.
- 문제없음 확인: 엔진 퍼징(24실습×모든 명령×이상한 인자, 예외 0), 24실습 화면 렌더링, 이상한 주소 19종, 저장소 막힘·용량 초과·손상, 명령 300개 실행·복원 0.8초.
- 실행한 검사: typecheck 통과, vitest **845개/34파일**(새 fuzz 25·stability 52), build 경고 없음(index 344kB), diff --check 통과.
- 브라우저(5173, 별도 탭): 주소 35개 콘솔 오류 0, 375/768/1280px 가로 넘침 0, 백엔드 끈 상태 안내·실습 정상·복원 정상(검사 뒤 API 재시작), 접근성 이름 누락 0, 주소 정규화 확인. 검사 탭 닫음(저장소 정리, localStorage 비어 있음).
- 한계: 실제 휴대폰·Safari·Firefox·화면 읽기 프로그램·느린 네트워크는 미검증. 조각 받기 실패는 단위 테스트로만.
- 실행 중: Vite 5173(preview "dev"), API 8000(preview "api-mac", 이번에 한 번 멈췄다 다시 띄움).
- 커밋: fix(stability)·docs. push·master 병합 없음.
- 다음(당시): Phase 2 — 분류 실습을 모두 풀면 방에 사이버펑크 "퇴근" 이벤트(→ 사용자가 "사내 파티"로 바꿈, 위 최신 상태), `src/scenarios/upcoming.ts` 오픈 예정 카드·HUD. 그다음 Phase 3 — 커뮤니티 카페(큰 아이소메트릭, 최근 글쓴이가 말풍선과 함께 돌아다님, 목록은 아래). 사용자 결정 완료(기본값 승인).

## 이전 상태 — Web 실습 2개: nginx upstream 502·TLS 체인 (2026-10-22, Mac, Claude)

- 사용자 요청: "다음은 Web 실습(nginx upstream·TLS 체인 등)이야. 계획 먼저 보여줘." → "계획대로 진행해줘." 도중 세션이 끊겨 "다시 시도해 주세요"로 이어서 마무리. 그사이 Codex가 UI 커밋 2개(`bbed91f` 퀘스트 연출, `e7cfcf7` 문서)를 남겼고, 이 Web 작업 파일과 겹치지 않음을 확인했다(아래 Codex 항목의 "기존 미커밋 Web 확장"이 이 작업).
- 엔진(왜: nginx 뒤 연결 실패와 인증서 체인 누락을 설정·파일 내용에서 계산하려고):
  - `Service.configSnapshot`: nginx가 시작·reload에 성공할 때 읽은 설정. 요청은 이것을 따른다(ubuntuWeb 프리셋에 초기값). `bindConfig.portKey`로 앱 포트도 config.yml에서 읽는다.
  - `state/config/nginxSites.ts`(새): server·location(=·접두사)·upstream·proxy_pass·root·ssl_certificate(_key) 해석, server 선택(이름→default_server→첫 번째), URI 치환 규칙, nginx 오류 페이지, 인증서·키 문제(`nginxTlsProblem`: 파일 없음 BIO_new_file, key values mismatch) — 시작·reload·`nginx -t`가 같은 함수를 씀.
  - `state/certs.ts`(새): 파일 내용의 PEM으로 인증서 목록·순서, 루트(`network.trustedRoots`)까지 체인 검증(만료 10, 중간 누락 20/21), 키 짝 검사. PEM 없는 예전 인증서는 도메인으로 찾고 만료만(기존 web-ssl-expired 그대로).
  - `state/webServer.ts`(새, network.ts에서 분리): proxy(502 연결 거부 / 504 시간 초과, Server 헤더는 nginx), servedChain, serveLocal. `state/dns.ts`(새): 이름 해석 분리. network.ts 265→171줄, 예전 이름은 다시 내보냄.
  - 명령: openssl s_client(체인 목록·depth·return code·-servername·-showcerts), x509(파일의 첫 장, -dates), certbot은 /etc/letsencrypt만 관리, sed 구분자 자유(s#…#), `> /dev/null` 허용(브라우저 확인 중 발견: `… | sudo tee f > /dev/null`이 권한 오류였음).
- 시나리오: `web-upstream-502`(23, 중급 — 2.4.0이 기본 포트를 8080으로 바꿨는데 proxy_pass는 127.0.0.1:3000; 정답 sed+nginx -t+reload, 대체 config.yml 3000+restart; 파일만 고치기·nginx restart·잘못된 포트·앱 재시작은 미복구), `web-tls-chain`(24, 고급 — 유료 인증서 교체 때 서버 인증서 한 장만 지정, PC 크롬만 정상·안드로이드/PG 웹훅/curl 실패; 정답 cat leaf CA | sudo tee fullchain → ssl_certificate 변경 → -t → reload; 거꾸로 합치기는 key mismatch로 reload 거부·restart 시 nginx 실패, certbot renew 무관). 근거 문서는 시나리오 evidence(nginx proxy_pass·upstream·HTTPS 체인·ssl_certificate, OpenSSL s_client, curl SSL, MDN 502). 카탈로그 추가·임베딩은 하지 않음.
- 실행한 검사(이 Mac): typecheck 통과, vitest **768개/32파일**(새 web 12, 기존 테스트 회귀 없음), build 경고 없음(index 약 339kB), diff --check 통과. 엔진 커밋만으로 723개 통과를 따로 확인.
- **발견·수정:** Codex가 넣은 `tests/quest-presentation.test.tsx`(5개)는 vitest include가 `tests/**/*.test.ts`라 **한 번도 실행되지 않고 있었다**(Codex 기록의 762개에도 빠져 있음). 따로 돌리면 5개 모두 통과해, `vite.config.ts` include에 `*.test.tsx`를 더함(별도 커밋). 이제 전체 실행에 포함.
- 브라우저: 세션 재개 시 Vite·API·탭이 모두 꺼져 있었음(원인 미확인, 종료하지 않음) → launch "dev"·"api-mac"으로 다시 띄움(API /api/health 200). 미션 23 — 502 → sed·-t·reload → 200·HUD 복구. 미션 24 — Codex의 퀘스트 대화(도윤)로 입장 → curl 60·s_client 21 → `> /dev/null` 합치기·sed·reload → 체인 2장·Verify 0·HUD 복구. 검사 탭 저장소 정리(localStorage 비어 있음). 이전 탭에 있던 미션 1 진행 세션은 브라우저 창이 닫히며 사라진 상태였음(복원 불가).
- 한계: 실제 TLS 핸드셰이크·SNI 여러 개·OCSP·브라우저 AIA는 재현하지 않음. nginx는 위 지시어만 해석. 고객 요청 로그는 fault에서 미리 넣음(플레이어 curl은 로그를 늘리지 않음).
- 유료 호출: 없음. 실행 중: Vite 5173·API 8000(preview "dev"·"api-mac", 이번에 다시 띄움).
- 커밋: feat(web) 엔진·feat(web) 실습 23·24·docs. push·master 병합 없음.
- 다음 후보: (1) 퀘스트 연출 사용자 피드백(Codex 항목) (2) 31건 메타데이터 검수 (3) Web 근거 문서를 카탈로그에 넣고 재색인(라이선스 확인 필요 — nginx 문서는 이전에 제외). 사용자 미결정: 제출 문서 수치 재측정, LLM_MODEL 원복, master 병합.

## 이전 상태 — 도트 CLI 로딩·퀘스트 담당자 연출 (2026-10-22, Mac, Codex)

- 최신 사용자 요청: 작은 CLI 모양 로딩 + 첨부 픽셀 초상의 안경·수염 캐릭터를 아이소메트릭 그림체로 + 전신→상반신 줌인/문제 설명/도움 요청/수락→CLI. 제공 영상은 브라우저에서 직접 확인(도트 실루엣). 재첨부 `/Users/jaeho/Downloads/0.png`의 아래 줄 인물을 참고해 자체 SVG로 그림.
- Claude의 게시판 2단계·번들 분할 완료를 최신 코드에서 확인했다. 과거 대화의 게시판 미구현 상태로 되돌리지 않음.
- 추가: `components/TerminalLoader.tsx`·CSS(도트 CLI 창/커서, 58px·compact 36px), `quest/{QuestOfficer,QuestBriefing}.tsx`, `quest/{dialogue.ts,quest.css}`, `tests/quest-presentation.test.tsx` 5개.
- 연결: App lazy/복원, BackendStatus, CoachTurn, ConditionSearch, KnowledgeScreen, 게시판 목록/상세/댓글의 로딩. index.html 최초 JS 대기 화면. TicketScreen은 새 조사에서 대화 청크를 불러오고 수락 때만 onStart 호출, 이어하기는 바로 연결. 원인/풀이 대신 공개 title/ticket만 전달. 의도적인 요청 지연/LLM 호출 없음.
- 연출: 선임 운영자 도윤, 1.6초 줌인/서버 랙/레터박스, 대화 2단계, 건너뛰기/취소/Esc/포커스 순환/복원, 모션 끄기·reduced-motion 대응. 긴 신고는 안쪽 스크롤, 수락 버튼은 화면 안 유지.
- **실제 검사:** `npm run typecheck`, `npm test` **762개/31파일**, `npm run build` 통과. 현재 미커밋 Web 확장 포함 수치. index 340.39kB/vendor 221.70kB/QuestBriefing 8.64kB, 500kB 경고 없음. 전체 diff --check는 기존 Web 변경 `state/network.ts:171` EOF 빈 줄 1건을 지적(이번 UI 범위 밖, 보존). UI 스테이징 범위는 별도 검사.
- 브라우저: 신규 수락→CLI→pwd, 뒤로→이어하기 기록 유지, Esc/포커스 복원, Tab/Shift+Tab 순환, 모션 끄기 즉시 대화, 건너뛰기 확인. 375×812/812×375 가로 넘침 없음. 최종 콘솔 error 0. `evidence/quest/`에 desktop/mobile/intro-loader. 테스트 탭 종료·viewport 원복, 사용자 학습 기록/기존 탭 보존. 정답 제출·유료 요청 없음.
- 서버 그대로: 5173 Vite PID 87647, 8000 API PID 74575. 이번 UI 단계에서 백엔드 재검증/실제 RAG/색인/npm audit은 안 함. .env 값 읽기/수정 없음.
- **기존 미커밋 작업 보존:** Web 엔진(nginx/text/tls, state types/network/services/ubuntuWeb + certs/dns/webServer/config/nginxSites), Web 시나리오 2개와 registry, 탐색 사례/web.test. 기존 커밋 기준 22개, 작업 트리는 24개. 이번 UI 커밋에 포함하지 않는다. 다음 도우미가 구현/근거/문서/커밋 완료 여부를 확인할 것.
- 이번 UI/테스트 커밋 `bbed91f`(스테이징 diff --check 통과), 이 문서·증빙·Claude 시작 프롬프트는 별도 docs 커밋. 해시는 git log 확인. push/master 병합 없음. 전체 작업 트리는 위 Web 변경 때문에 clean이 아니다.
- 사용자 피드백 미수령: 캐릭터 얼굴/이름·카메라 속도·대사. 다음: 피드백 우선 반영 → 기존 Web 확장 검토·정리. 자세한 결과 `15_CLI_로딩_퀘스트_연출.md`, 그대로 붙여 넣을 프롬프트 `16_Claude_이어가기_프롬프트.md`.

## 이전 상태 — 번들 분할: vendor 분리 + 엔진 실행부 지연 로딩 (2026-10-22, Mac, Claude)

- 사용자 요청: "다음은 번들 분할(665kB 경고)이야. 계획 먼저 보여줘." → "A(vendor 분리)와 B(엔진 지연 로딩) 둘 다 계획대로 진행해줘."
- 측정(소스맵으로 모듈별 바이트 계산, scratchpad 스크립트): react-dom 206kB, engine/commands 92kB, ui/campus 67kB, engine/state 45kB, 시나리오 약 100kB. 원인: 시나리오가 `withCommands`를 등록부(`engine/commands/index.ts`)에서 가져와 명령 구현 전체가 딸려 왔고, App이 새로고침 복원·execute를 바로 가져옴.
- A(`vite.config.ts` manualChunks): react·react-dom·scheduler → `react-vendor`. 본체 442kB + vendor 222kB, 경고 해소. 따로 커밋.
- B:
  - `engine/commands/names.ts`(새): DEFAULT_COMMANDS·withCommands(등록부 import 없음). `index.ts`는 다시 내보냄. 시나리오 22개 import 경로 변경.
  - `engine/session/execute.ts`(새): `execute`를 session.ts에서 분리(`stampFinish` export). 테스트 6개 파일은 import 경로만 바꿈.
  - `ui/sessionReplay.ts`(새): `restoreSession`(입력 다시 실행). `sessionStore.ts`는 저장·`readSavedSession`·`isSaved`만.
  - `App.tsx`: `PlayScreen`을 React.lazy(+Suspense), 세션은 null로 시작해 저장본이 있으면 `import('./sessionReplay')`로 복원. **복원 중(`restoring`)에는 저장(빈 세션으로 저장본을 지우지 않게)과 주소 보정(play→briefing)을 멈춤**. 조각 로드 실패 시 새 실습으로 시작.
  - `PlayScreen`: `onCommand` 대신 `onUpdate(change)`를 받고 화면 안에서 `execute`를 부름(App이 명령 구현을 import하지 않음).
- 결과(빌드): index 316.9kB(gzip 103) / react-vendor 221.7kB(69) / execute 106.4kB(38) / PlayScreen 20.3kB(8) / CommunityScreen 18.2kB / sessionReplay 0.5kB. 명령 오류 문장(예: docker 'is not a docker command')이 index에 없고 execute에만 있음을 확인. probe 문장은 시나리오 fault가 쓰는 state 쪽이라 index에 남음(의도).
- 실행한 검사: typecheck 통과, vitest **723개/30파일** 통과(동작 변화 없음), build 경고 없음, diff --check 통과.
- 브라우저(프로덕션 빌드, `.claude/launch.json` "preview" 4173 — 5173과 다른 출처라 사용자 탭 저장소와 분리): 홈은 index+vendor만, 실습 진입 시 PlayScreen+execute 로드, 명령 2개 뒤 새로고침 → sessionReplay 로드·기록 그대로 이어짐·저장본 유지, 원인 제출 → 리포트, 리포트에서 새로고침 유지, 손상된 저장본(#/mission/3/play)·저장본 없는 play 주소(#/mission/5/play) → 브리핑, 지식·게시판(조각 로드)·뒤로 가기, 콘솔 오류 0. 검사 뒤 4173 출처의 localStorage(진행 기록 1건)·sessionStorage를 지우고 preview 서버를 멈춤. 5173 개발 서버에서도 새 App 모듈 정상 컴파일, 사용자 탭의 진행 중 실습(linux-disk-full) 그대로.
- 유료 호출: 없음. 실행 중: Vite 5173(PID 87647), API 8000(PID 74575). preview 4173은 멈춤.
- 커밋: build(vendor)·refactor/perf(B)·docs. push·master 병합 없음.
- 다음 후보: (1) Web 실습(nginx upstream·TLS 체인) (2) 31건 메타데이터 사람 검수 (3) 캠퍼스 그림(67kB)도 필요하면 방별 지연 로딩. 사용자 미결정: 제출 문서 수치 재측정, LLM_MODEL 원복, master 병합.

## 이전 상태 — Linux too many open files 실습 (2026-10-22, Mac, Claude)

- 사용자 요청: "다음은 Linux too many open files 실습이야. 계획 먼저 보여줘." → 승인 "계획대로 진행해줘." (lsof 포함)
- 엔진(왜: "셸의 ulimit와 서비스 한도가 다르다"는 실무 함정을 상태에서 계산해 재현):
  - `state/limits.ts`(새): 서비스 `connections`·`baseFds`와 프로세스 `nofile`(없으면 systemd 기본 1024:524288)로 열린 fd 계산, 포화 판정. `network.ts`: 포화 프로세스의 포트는 curl 시간 초과(stage timeout → 28), 서비스 `http` 응답(정의한 서비스만).
  - `state/procfs.ts`(새): /proc/PID/limits·fd(링크 노드, dr-x------)·status, /proc/sys/fs/file-nr·file-max·nr_open. 읽기 명령(`input.readSources`·`ls`)만 `resolveForRead`로 연결(쓰기 경로는 손대지 않음). `NodeBase.link`, `formatMode`의 l.
  - `state/systemdUnits.ts`(새): unit·drop-in 파싱(LimitNOFILE n | soft:hard | infinity, [Service]만, 마지막 값), `daemonReload`, `needsReload`, 실제 경고 문장. `services.startService`가 `loaded.nofile`을 새 프로세스에 주고, 포화면 `fdExhaustedLog`를 남김.
  - `commands/systemctl.ts`: system.ts에서 분리(267→146줄) + cat·show(-p/--property)·daemon-reload(root), start/restart/status에 changed-on-disk 경고.
  - 새 명령: `lsof`(-p, -i :PORT, -n/-P; 일반 사용자는 Permission denied 줄), `ulimit`(셸 내장, limits.conf 로그인 한도, sudo ulimit → command not found), `echo`(-e/-n), `tee`(-a, 권한·디렉터리 검사), `mkdir`(-p, GNU 문구).
  - 동작 변경 2가지: ① `ls`는 파이프·리다이렉션일 때 한 줄에 하나(`ls | wc -l`). ② **리다이렉션(>)을 sudo가 아닌 셸 사용자 권한으로 연다**(실제 bash와 같음). 이에 따라 `tests/commands.test.ts`의 `sudo > /var/log/syslog` 기대를 Permission denied + `echo -n | sudo tee`로, linux-disk-full 탐색 대체 풀이를 `sudo rm -rf /var/log/app`로 바꿈.
- 시나리오 `linux-too-many-files`(22, 고급): 세일로 SSE 연결 1,480개, shop-api 한도 1024 → `Error: accept EMFILE`, curl 28. 함정: limits.conf·`ulimit -n`은 65535. 정답: drop-in LimitNOFILE=65535 → daemon-reload → restart. 재시작만·reload 생략·limits.conf 수정은 미복구(탐색 검사). 대체: LimitNOFILE=8192:524288 + stop/start.
- 카탈로그: linux-rlimit-nofile → 22. **예정(planned) 근거 문서 0건**(모두 실습에 연결). add HTTP 0, validate 실패 0.
- 실행한 검사(이 Mac): typecheck 통과, vitest **723개/30파일**(새 limits 15), build 통과(본체 JS 665kB), diff --check 통과. 엔진 커밋만으로 694개 통과를 따로 확인. 백엔드 코드 변경 없음.
- 브라우저(5173, PID 87647): 미션 22 — ulimit 65535 vs limits 1024, drop-in 후 reload 없이 restart → 빨간 경고·미복구, daemon-reload + restart → {"status":"ok"}·HUD 복구 켜짐. **주의: 확인 직전 탭 저장소에 사용자가 연 것으로 보이는 진행 중 실습(linux-disk-full, 입력 없음)과 코치 키가 있었음 → 값을 백업하고 확인 뒤 그대로 복원, 새로고침 뒤에도 유지 확인.** localStorage는 비어 있음(학습 기록 없음).
- 한계: 연결 수의 시간 변화, prlimit·sysctl·systemctl edit 없음. lsof 일부 옵션만. ss의 fd 번호는 고정값(6).
- 유료 호출: 없음. 실행 중: Vite 5173(PID 87647), API 8000(PID 74575).
- 커밋: feat(linux) 엔진·feat(linux) 실습 22·docs 3개. push·master 병합 없음.
- 다음 후보: (1) 번들 분할(665kB, 캠퍼스 그림·게시판 외 지연 로딩) (2) Web 실습(nginx upstream·TLS 체인 등) (3) 31건 메타데이터 사람 검수. 사용자 미결정: 제출 문서 수치 재측정, LLM_MODEL 원복, master 병합.

## 이전 상태 — Docker 디스크 가득 참 실습 (2026-10-22, Mac, Claude)

- 사용자 요청: "다음은 Docker 디스크 가득 참 실습이야. 계획 먼저 보여줘." → 승인 "계획대로 진행해줘." (/var/lib/docker 별도 디스크 포함)
- 엔진(왜: Docker 데이터도 df·du·rm과 같은 기준으로 계산해, rm으로 지웠을 때의 결과까지 실제처럼 보이게):
  - `state/docker/storage.ts`(새): 이미지 레이어(`overlay2/<id>/diff/.layer`, 이름이 같은 레이어는 공유)·컨테이너 쓰기 레이어·json 로그·빌드 캐시(`buildkit/cache`)를 가상 파일로 둠. `addImage`·`addBuildCache`·`releaseLayers`(마지막 사용 이미지가 지워질 때만 레이어 삭제). `/var/lib/docker` 권한 710.
  - `state/docker/prune.ts`(새): system df 요약(공유 레이어 한 번만, RECLAIMABLE), 컨테이너·이미지(dangling / -a / until)·빌드 캐시(dangling / -a) 정리, 이미지 삭제 줄.
  - `lifecycle.ts`: `createContainer(state, …)`로 바뀜(파일 생성). 디스크 여유 1MB 미만이면 `mkdir …-init: no space left on device`, 레이어 파일이 없으면 시작 시 `error creating overlay mount … no such file or directory`. 삭제 시 파일 정리.
  - `DockerImage.sizeMB` → `layers`. 기존 docker-host·미션 17·18 이미지를 레이어 방식으로 바꿈(ID·크기 표기 동일, 182MB 등).
- 명령: `docker system df`, `system prune`·`image prune`·`builder prune`(=`buildx prune`)·`container prune`(-a, -f, --filter until=Nh), `rmi`·`image rm`(실행 중 이미지는 -f로도 거절, 멈춘 컨테이너 이미지는 -f로 untag), `images -f dangling=true`. -f 없으면 실제 경고와 [y/N]만 출력하고 지우지 않음(대화형 입력 없음). `df`가 경로 인자를 받아 그 파일시스템만 보여 줌.
- 시나리오 `docker-disk-full`(21, 중급): app-01에서 30분마다 직접 빌드(dev 태그 덮어쓰기)해 <none> 이미지 25개·빌드 캐시 140건(26GB)·옛 릴리스 14개가 /dev/nvme1n1(/var/lib/docker)을 100%로 채움(루트는 26%). 빌드 로그 ENOSPC, journal dockerd 오류. 판정: /var/lib/docker ≤80% + shop-api·status-page 실행 중 + 이미지·쓰기 레이어 온전. dangling만 정리하면 84%로 부족, builder prune(38%)·image prune -a(54%, 멈춘 컨테이너가 2.0.8·2.0.9를 붙잡음)·system prune -a로 복구. `rm -rf /var/lib/docker/overlay2`는 51%가 되지만 재시작 불가로 미복구.
- 카탈로그: docker-system-df·docker-prune-images·docker-prune-build-cache → 21. HTTP 0, validate 실패 0. 남은 planned: linux-too-many-files(1).
- 실행한 검사(이 Mac): typecheck 통과, vitest **694개/29파일**(새 docker-storage 14), build 통과(본체 JS 642kB), diff --check 통과. 엔진 커밋은 시나리오 없이도 666개 통과를 따로 확인. 백엔드 코드 변경 없음.
- 브라우저: 확인 직전 Vite(PID 61243, 이전 세션부터)가 꺼져 있었음(원인 미확인, 이 단계에서 종료하지 않음) → `.claude/launch.json` "dev"로 다시 띄움(현재 PID 87647, localhost:5173). 미션 21 — df에서 nvme1n1 100%, system df, image prune -f 뒤에도 미복구, builder prune 뒤 38%·HUD 복구 켜짐. 새 콘솔 오류 없음(남은 것은 이전 HMR 기록과 서버가 꺼진 동안의 진단 import). 원인 제출·리포트는 학습 기록 보존을 위해 하지 않음. 저장소 정리(비어 있음).
- 한계: docker build·볼륨·`system df -v`·로그 회전·BuildKit gc 설정은 재현하지 않음. `src/engine/commands/system.ts`는 267줄(이번 df 변경 전부터 200줄 초과) — 분리 후보.
- 유료 호출: 없음. 실행 중: Vite 5173(PID 87647, preview "dev"), API 8000(PID 74575, api-mac).
- 커밋: feat(docker) 엔진·feat(docker) 실습 21·docs 3개. push·master 병합 없음.
- 다음 후보: (1) Linux too many open files(ulimit·/proc/PID/limits·lsof 모델 필요) (2) 번들 분할(642kB) (3) system.ts 분리. 사용자 미결정: 제출 문서 수치 재측정, LLM_MODEL 원복, master 병합.

## 이전 상태 — K8s readiness probe·service selector 실습 2개 (2026-10-22, Mac, Claude)

- 사용자 요청: "다음은 K8s readiness probe·service selector 실습이야. 계획 먼저 보여줘." → 승인 "계획대로 진행해줘." (readiness 실습의 rollout undo 대체 풀이 포함)
- 엔진(왜: "엔드포인트가 비었다"를 Ready 문제와 셀렉터 문제로 가를 수 있게, 출력은 상태에서 계산):
  - `state/kubernetes/probe.ts`(새): readiness 판정 — 포트가 이미지 `ports`에 없으면 `connect: connection refused`, 경로가 `paths`에 없으면 `HTTP probe failed with statuscode: 404`(실제 kubelet 문장, 이벤트 Unhealthy). 이미지 `accessLog: true`면 kubectl logs에 kube-probe 요청 줄 3개(10초 간격)를 판정 결과로 계산. `reconcile.ts`가 이 판정을 씀.
  - `history.ts` `selectorOf`: Deployment 셀렉터(변경 불가). 템플릿 라벨을 처음 바꿀 때 셀렉터를 `selector` 필드로 굳힘.
- kubectl(`commands/kubectl.ts` + `kubectl/{describe,selector,service,patch,patchDeployment}.ts` 새, `queries.ts` 재작성):
  - get: `-l`(=,==,!=,존재,!존재), `--show-labels`, `endpointslices`(서비스 이름 라벨, 비면 `<unset>`). get 옵션을 공용 파서로 읽어 `-o wide -o wide`도 실제처럼 허용(기존 실패 기대 테스트 2개를 실제 잘못된 입력으로 교체).
  - describe: `svc`(Selector·TargetPort·Endpoints), pod에 Readiness 줄·Conditions. AGE는 이틀부터 일 단위(5d, 3d4h).
  - `set selector`(Service만, Deployment는 immutable 오류), `patch`(strategic·merge; replicas·템플릿 라벨·컨테이너 image·readinessProbe / Service selector·ports; null로 키 삭제; 셀렉터 벗어나는 라벨·스키마에 없는 필드·잘못된 JSON 거절, 실패 시 상태 불변). `--type=json`은 미지원이라고 그대로 알림.
- 시나리오: `kubernetes-readiness`(19 — search-api 3.0.0이 /health→/healthz로 바꿨는데 probe는 /health; 정답 patch, 대체 rollout undo), `kubernetes-service-selector`(20 — 라벨 표준화로 payment-api 새 Deployment·옛 payment 삭제, Service payment 셀렉터 app=payment 그대로; 정답 set selector, 대체 patch svc의 `"app": null`, 셀렉터를 유지한 채 파드에 app=payment 라벨을 더하는 patch도 실제처럼 허용). 무관한 조치(포트 8081 patch, replicas 변경, null 없는 selector patch, 셀렉터 벗어나는 relabel, undo)로는 복구 안 됨을 탐색 검사로 확인.
- 카탈로그: k8s-readiness-probe·k8s-define-readiness → 19, k8s-service-endpointslices·k8s-service-definition → 20. add_scenario_catalog HTTP 0, validate 실패 0. 남은 planned: docker-disk-full(3), linux-too-many-files(1).
- 실행한 검사(이 Mac): typecheck 통과, vitest **666개/28파일** 통과(새 kubectl-service 23), build 통과(본체 JS 625kB, Vite 경고 유지), `git diff --check` 통과. 백엔드 코드 변경 없음(unittest 재실행 안 함).
- 브라우저(5173, 새로고침 후): 미션 19 — 0/1 Running, Conditions Ready False, kube-probe 404 로그 → patch → 엔드포인트 2개, HUD 복구 켜짐. 미션 20 — 엔드포인트 <none>, Selector app=payment, --show-labels → null 없는 patch는 여전히 <none> → set selector로 엔드포인트 2개, HUD 복구 켜짐. 캠퍼스 쿠버네티스 운영실 "미해결 5개". 콘솔에는 편집 도중 HMR이 옛 queries.ts를 읽은 오류(같은 시각 묶음)만 남았고, 새로고침 뒤 모듈 정상 로드 확인. 원인 제출·리포트는 학습 기록 보존을 위해 하지 않음. 검사 뒤 탭 저장소 정리(비어 있음).
- 한계: probe 주기·실패 누적·liveness/startup probe·RollingUpdate·ClusterIP 직접 요청·NetworkPolicy·EndpointSlice 여러 개는 재현하지 않음. patch는 위 필드만.
- 유료 호출: 없음. 실행 중: Vite `127.0.0.1:5173`(PID 61243), API 8000(api-mac).
- 커밋: feat(k8s)·docs 2개. push·master 병합 없음.
- 다음 후보: (1) Docker 디스크 가득(이미지·컨테이너 크기를 df·`docker system df`에 반영하는 엔진 작업, prune) (2) Linux too many open files(ulimit·lsof 모델 필요) (3) 번들 분할. 사용자 미결정: 제출 문서 수치 재측정, LLM_MODEL 원복, master 병합.

## 이전 상태 — Docker 실습 2개: 포트 충돌·환경 변수 누락 (2026-10-22, Mac, Claude)

- 사용자 요청: "다음은 Docker 실습 2개(포트 충돌·환경 변수 누락)야. 계획 먼저 보여줘." → 계획 승인 "계획대로 진행해줘." (권한은 계획대로 docker 그룹, sudo 불필요)
- 리팩터(왜: K8s와 Docker가 같은 실행 규칙을 쓰게 해 다음 컨테이너 실습을 시나리오 파일만으로 추가하려고):
  - `state/containers/{types,runtime}.ts`(새): ImageProfile(+`responses`·`headers`), `runOutcome`·`runLog`. K8s `runtime.ts`는 이미지 받기 실패만 더하는 얇은 층. 기존 564개 테스트 그대로 통과 확인 후 커밋.
  - `commands/flags.ts`: kubectl 전용 파서를 공용으로 옮김(git mv). 반복 옵션 `lists`, `stopAtFirstArg`(docker run IMAGE 뒤는 컨테이너 명령).
- Docker 엔진(`state/docker/`): `types`(이미지·컨테이너·재시작 정책·포트), `runtime`(화면 상태를 시각으로 계산 — 재시작 100ms부터 두 배·상한 1분, on-failure:N 소진 시 Exited / 실행마다 이어 붙는 로그 / 컨테이너 HTTP 응답), `lifecycle`(create/start/stop/remove, 데몬 정지·시작 시 재시작 정책), `format`(go-units 시간 표기, 고정 ID).
  - 공개 포트는 `docker-proxy` 프로세스(`Process.container`)가 호스트 포트를 잡음 → `ss -tlnp`·`ps aux`·`curl`·포트 충돌 판정이 그대로 동작. `state/network.ts`는 소켓 주인이 docker-proxy면 컨테이너 응답을 돌려줌(새 실패 단계 `reset` → curl 56). curl 헤더는 응답이 주면 그것을 씀.
  - `services.ts`: `systemctl stop/start docker` 때 컨테이너 정지·재시작 정책 적용.
- docker 명령(`commands/docker.ts` + `docker/{common,query,inspect,lifecycle,run,template}.ts`): ps(-a,-q,--format), images, logs(--tail/-n, -f는 지금까지만), inspect(-f, `{{.A.B}}`·`{{json .X}}`만), port, start/stop/restart/rm(-f), run(-d --name -p -e --env-file --restart), `container …`·`image ls` 묶음. 오류 문장은 실제 CLI 형태(port is already allocated / userland proxy address already in use / 이름 충돌 / pull access denied / unknown flag 125 / 데몬 연결 실패).
- 호스트 `docker-host`(app-01): ubuntu-web에서 systemd shop-api 제거, dockerd·containerd, 정상 컨테이너 status-page(8081, unless-stopped).
- 시나리오: `docker-port-allocated`(17, 중급 — 배포 스크립트가 옛 2.0.3을 멈추지 않고 2.1.0을 같은 8080으로 띄워 Created로 남음, 알림은 "완료"; 배포 로그의 오류 문장은 엔진 계산 결과를 그대로 기록), `docker-missing-env`(18, 중급 — run.sh의 `-e SMTP_PASSWORD`(값 없음)로 비밀번호가 빠져 Exited(1)·RestartCount 5; notify.env로 다시 만들기). 대체 풀이: 17은 rm -f 후 새 이름으로 run, 18은 -e 값 직접 지정. 무관한 조치(docker restart·데몬 재시작)로는 복구 안 됨을 탐색 검사로 확인. 컨테이너 운영실 comingSoon 해제.
- 카탈로그: docker-run-publish·docker-port-publishing → 17, docker-run-env·docker-restart-policy·docker-logs → 18(planned → scenario_ids), `add_scenario_catalog` HTTP 0, `validate_catalog` 실패 0. 색인은 다시 만들지 않음(메타데이터만 바뀜).
- 실행한 검사(이 Mac): typecheck 통과, vitest **615개/27파일** 통과(새: docker 8·docker-runtime 15, 탐색·커버리지·캠퍼스 갱신), build 통과, `git diff --check` 통과. 백엔드 코드 변경 없음(이번에 unittest 재실행 안 함).
- 브라우저(5173): 캠퍼스 컨테이너 운영실 "미해결 2개", 목록에 Docker 실습 2개·준비 중 표시 없음. 미션 17 — curl 2.0.3, ps -a Created, docker start 거절(port is already allocated) → stop 2.0.3·start 2.1.0 → 쿠폰 API 응답, HUD 복구 켜짐. 미션 18 — logs FATAL, docker restart는 Restarting(미복구) → rm -f·run --env-file → waiting for jobs, HUD 복구 켜짐. 콘솔 오류 0. 원인 제출·리포트는 학습 기록 보존을 위해 하지 않음(자동 테스트로 검증). 검사 뒤 탭 저장소의 실습 세션·코치 키 삭제(검사 전과 같이 저장소 비어 있음).
- 알려진 한계: 좁은 터미널에서 docker ps 표가 줄바꿈됨(실제 터미널과 같음, kubectl -o wide도 동일). 컨테이너 안 프로세스는 ps에 안 보임. 이미지 받기·빌드·네트워크·볼륨·compose·exec·--rm 미지원. 앱 셸에 export가 없어 `-e KEY`는 항상 빈 값.
- 유료 호출: 없음. 실행 중: Vite `127.0.0.1:5173`(PID 61243), API 8000(api-mac).
- 커밋: refactor·feat(docker)·docs 3개. push·master 병합 없음.
- 다음 후보: (1) K8s readiness probe·service selector(엔진 대부분 있음) (2) Docker 디스크 가득(docker-system-df·prune 근거 문서 있음, 이미지 크기를 df에 반영하는 엔진 작업 필요) (3) Linux·Web 보강. 사용자 미결정: 제출 문서 수치 재측정, LLM_MODEL 원복, master 병합.

## 이전 상태 — K8s CrashLoopBackOff·OOMKilled 실습 2개 (2026-10-22, Mac, Claude)

- 사용자 요청: "예정 시나리오 구현을 시작하자. K8s CrashLoopBackOff·OOMKilled부터, 계획 먼저 보여줘." → 계획 승인 "계획대로 진행해줘. 롤백도 정답 경로로 인정하는 것에 동의해."
- 엔진(왜: 출력을 시나리오에 적지 않고 상태에서 계산하려고):
  - `state/kubernetes/types.ts`: 이미지 `requiredEnv`·`memoryMi`·`log{boot,ready}`, 컨테이너 `env`·`resources{requests,limits}`, Deployment `history`, 컨테이너 `lastState`·`crashingSince`, 이유 `CrashLoopBackOff`.
  - `runtime.ts`(새): 결과 순서 — 이미지 없음 → pull 실패 / 필수 env 없음 → Error·1 / 메모리 > limit → OOMKilled·137 / 그 밖 실행. 재시작 횟수는 `crashingSince`와 시각으로 계산(10초부터 두 배, 300초 상한). 메모리 단위 파싱·표시.
  - `history.ts`(새): `changeTemplate`(실제로 바뀔 때만 revision+1, 같은 템플릿은 합침), `undoTo`(옛 템플릿을 새 revision으로), `addDeployment`. 이미지 풀 실습 fault도 `changeTemplate`로 바꿈.
  - `reconcile.ts`: CrashLoopBackOff 컨테이너(Waiting, Ready 아님), BackOff 이벤트.
- kubectl(`commands/kubectl.ts` + `kubectl/{flags,logs,set,rollout}.ts` 새, `mutations.ts` 삭제): `logs`(-c, -p/--previous, --tail, deploy/NAME은 "Found N pods…"를 stderr로), `set image|env|resources`(모든 인자 검사 후 변경, request>limit 거부), `rollout status|history|undo [--to-revision]`. describe에 Last State·Limits/Requests·Environment. 코치용 `operations`에 새 하위 명령 추가.
- grep(`commands/grep.ts`): `-A/-B/-C N`, `-A2`, `--after-context=N` 등 문맥 옵션. 이유: 브라우저 점검에서 `describe … | grep -A2 Last`가 찾은 줄만 내고 옵션을 조용히 무시했음. 잘못된 값은 `invalid context length argument`·종료 2.
- 시나리오: `kubernetes-crashloop`(15, 중급 — order-api 2.3.0이 요구하는 PAYMENT_API_URL 누락), `kubernetes-oom`(16, 고급 — 비용 검토로 limit 512→128Mi, 캐시 약 280Mi). 둘 다 정답 경로는 설정 보충, 대체 풀이 `rollout undo`(사용자 승인). OOM은 request만 올리면 계속 죽음. 레지스트리 끝에 추가해 기존 미션 번호 유지.
- 카탈로그: `scenario_sources.json`의 planned를 scenario_ids로(k8s-container-terminated·crashloopbackoff·oomkilled·pod-logs-previous, describe-pod·debugging-pods·rollout-undo에 두 id 추가), `add_scenario_catalog`로 items.json 재생성(HTTP 0). 색인(`data/chroma-gemini`)은 다시 만들지 않음 — scenario_ids는 메타데이터라 검색 결과에는 영향 없음, 필요하면 `scripts.prepare_corpus` 재실행(캐시 명중 예상).
- 실행한 검사(이 Mac): `npm run typecheck` 통과, `npx vitest run` **564개/25파일** 통과(새: kubernetes-runtime·kubectl-crash·grep-context, 탐색 검사 두 실습 추가), `npm run build` 통과(본체 JS 563kB, Vite 500kB 경고 유지), backend `unittest discover -s tests` **66개** OK, `scripts.validate_catalog` 실패 0, `git diff --check` 통과.
- 브라우저(5173): 미션 15 — get pods CrashLoopBackOff·RESTARTS 증가, describe Last State Error/1, logs FATAL 줄, rollout undo로 복구·HUD 복구 단계 켜짐. 미션 16 — Last State OOMKilled/137, `--requests`만 올리면 계속 반복 종료, `--limits=memory=512Mi`로 복구. 원인 제출·리포트 화면은 학습 기록 보존을 위해 하지 않음(자동 테스트로 검증). 검사 뒤 탭 저장소의 실습 세션·코치 대화 키를 지워 검사 전 상태(지식 대화 2키, localStorage 비어 있음)로 되돌림.
- 유료 호출: 없음.
- 실행 중: Vite `127.0.0.1:5173`(PID 61243), API `127.0.0.1:8000`(api-mac, Gemini 임베딩 설정).
- 남은 것·한계: 실제 back-off 대기·RollingUpdate·ConfigMap/Secret 참조·`kubectl top`·delete는 재현하지 않음(default 네임스페이스·Recreate·즉시 계산 모델). 앱 메모리 사용량은 고정값. 알려진 오류 없음.
- 커밋: `feat(k8s)`·`feat(grep)`·docs 커밋(해시는 `git log`). push·master 병합 없음.
- 다음 후보: (1) Docker 실습 2개(docker-port-allocated·docker-missing-env, `docker` 명령 엔진 필요 → 계획 먼저) (2) K8s readiness probe·service selector 실습(엔진 대부분 있음). 사용자 미결정: 제출 문서 수치 재측정, LLM_MODEL 원복, master 병합.

## 이전 상태 — 시나리오 근거 공식 문서 31건 추가, 임베딩 gemini-embedding-2 전환, UI 두 곳 정리 (2026-10-22, Mac, Claude)

- 사용자 요청: ① 추가하기로 한 시나리오·추가된 시나리오를 뒷받침할 공식 문서 업데이트와 그 임베딩 ② 임베딩 모델을 GMS `gemini-embedding-2`로 변경 ③ 왼쪽 레일 "커뮤니티 카페"가 다른 메뉴와 다름 ④ 홈 히어로 "첫 장애 해결하기" 아래 "지식 탐색"의 어긋난 구조.
- UI: 레일 커뮤니티 배지가 빈 상자였음 → 실제 게시글 수(`ui/community/useBoardCount.ts`, 서버 꺼지면 "–"). 히어로 보조 버튼이 글자 링크로 다음 줄에 떨어져 있었음 → 같은 폭·높이의 테두리 버튼으로 세로 정렬(좁은 화면은 가로 두 칸, `campus/campus.css`).
- 카탈로그(`backend/catalog/scenario_sources.json` + `scripts/add_scenario_catalog.py`): 31건 추가(Kubernetes 16, Docker 8, AWS 5, Linux 2) → **131건, 문서 절 220개**. 각 항목은 원문 절 추출 + 원문을 읽고 쓴 한국어 메타데이터(사람 검수 대기). `scenario_ids`는 현재 시나리오만(kubernetes-image-pull, aws-security-group, aws-iam-s3, linux-oom), 예정 시나리오는 데이터 파일의 `planned`에만 기록. 라이선스 원본 확인: K8s CC-BY-4.0, Docker Apache-2.0, AWS CC-BY-SA-4.0, man-pages SPDX(getrlimit copyleft, proc_pid_oom_score_adj GPL-3.0-or-later → 허용 목록에 GPL-3.0-or-later 추가). bind.2(BSD-4-Clause-UC 혼합)·resolv.conf.5(SPDX 없음)·nginx·MySQL·Ubuntu·Let's Encrypt는 제외.
- 코드: `collectors.extract_section`이 따옴표 없는 `id=`(kubernetes.io 압축 HTML)도 받음. `explore.py` 제품 인식에 Kubernetes·Docker·AWS 추가(AWS라고만 하면 AWS ALB 함께), 분류 "container". 프런트 지식 화면 머리 문구를 실제 제품 목록으로, 제품 태그 색(K8s 금빛·Docker 청록·AWS 하늘색), 자료실 방 설명 갱신.
- 임베딩: `providers.py`에 Gemini `batchEmbedContents`(요청 `requests` 라이브러리, 기존 의존성) — 키는 `x-goog-api-key` 헤더만, 오류는 상태 코드만 기록. `config.embedding_api`(openai|gemini). 문서·질문 모두 taskType 없이(벡터 캐시 한 갈래). GMS 실제 확인: 단건·배치 200, 3072차원, taskType도 허용.
- `backend/.env`: 키 줄은 건드리지 않고 비밀 아닌 4줄만 바꿈 — `EMBEDDING_API=gemini`(추가), `EMBEDDING_BASE_URL=https://gms.ssafy.io/gmsapi/generativelanguage.googleapis.com/v1beta/`, `EMBEDDING_MODEL=gemini-embedding-2`, `CHROMA_PATH=data/chroma-gemini`. `EMBEDDING_API_KEY`는 비어 있어 기존처럼 `GMS_KEY` 사용. 예전 색인 `data/chroma`(OpenAI, 100/221)는 그대로 남겨 둠 — 되돌리려면 위 4줄을 예전 값(.env.example 주석)으로.
- 색인: `scripts.prepare_corpus`로 `data/chroma-gemini` 생성 — knowledge_items **131**, reference_chunks **298**, 3072차원, 임베딩 요청 15회. 재실행 cache_hit·임베딩 0회 확인. 검색 확인(질문 8개 모두 해당 문서 1위): ImagePullBackOff→k8s-imagepullbackoff, 종료 코드 137→k8s-oomkilled, 도커 이미지 디스크→docker-system-df·prune-images, SSH 시간 초과→aws-ec2-connection-timeout, Too many open files→EMFILE·RLIMIT_NOFILE, S3 403→aws-s3-403-permission-tips, READY 0/1→k8s-readiness-probe.
- 실행한 검사: frontend typecheck·vitest **498/22**·build 통과, backend unittest **66** OK(Gemini 임베딩 4·추출 1·제품 인식 추가), `scripts.validate_catalog` 실패 0(131/220, HTTP 0). 브라우저: 레일 배지·히어로 버튼, 지식 화면 131개·제품 태그 6종, 조건 탐색 "쿠버네티스에서 파드가 계속 재시작되는 문제" → 필터 Kubernetes·후보 16건 중 2건(CrashLoopBackOff, 파드 디버깅). 유료 호출: 임베딩(확인 3회+색인 15회+검색 확인 1회+조건 탐색 질문), 생성(조건 탐색 판정 1회, gpt-6-luna).
- 실행 중: Vite 5173(PID 61243), API 8000(api-mac, 새 설정으로 재시작).
- 남은 것·주의: `docs/submission/`의 100건·text-embedding-3-large 기록, `08_RAG_전후비교`·`09_청크_TopK` 수치는 예전 모델 기준(다시 재지 않음). 31건 한국어 메타데이터 사람 검수. 예정 시나리오를 실제로 만들면 그 id를 `scenario_ids`에 옮길 것.
- 다음 후보: 예정 시나리오 구현(K8s CrashLoop/OOM부터, kubectl logs --previous·set resources 필요), 제출 문서의 모델·건수 갱신 여부 결정(사용자).

## 이전 상태 — 커뮤니티 게시판 구현·2단계 보강 (2026-10-22, Mac, Claude)

- 시작 상태: 브랜치 `feature/sudo-quest`, HEAD `63545c9`. HANDOFF에는 "게시판 미착수"였지만 작업 트리에 이전 도우미의 **커밋 안 된 게시판 1단계**(backend `app/community/{models,routes,store}.py`·`tests/test_community.py`, 프런트 `api/community.ts`·`ui/community/*`·`tests/community.test.ts`, App·라우트·레일·캠퍼스 연결)가 있었다. 지우지 않고 그대로 이어 받아 테스트(백엔드 52·프런트 488) 통과를 먼저 확인한 뒤 보강했다.
- 사용자 요청: "게시판은 약간 미완성이야 발전시킬 수 있으면 발전시켜줘"(저장 방식 FastAPI+SQLite는 이미 승인, 재질문 안 함).
- 이번에 바꾼 것과 이유:
  - `backend/app/community/schema.py`(새): `PRAGMA user_version` 스키마 버전 2. 기존 파일(버전 1)은 서버가 처음 열 때 `spoiler`·`delete_hash` 열을 더해 올림(데이터 유지). 응답 열을 명시해 `SELECT *`로 해시가 새어 나가지 않게 함.
  - `passwords.py`(새): 작성자 삭제 비밀번호 scrypt 해시/검증. 이유: 로그인 없는 익명 게시판에서 실수로 올린 비밀 키·개인정보를 작성자가 바로 지울 수 있게.
  - `store.py`: 작성자 삭제(`delete_by_author`) — 틀린 시도도 속도 제한 횟수에 남기려고 예외를 트랜잭션 커밋 **뒤에** 던짐. 풀이 포함 글은 목록 미리보기를 빈 문자열로.
  - `routes.py`·`models.py`: `POST /posts/{id}/delete`·`POST /comments/{id}/delete`(작성자), `GET /admin`(운영자 키 확인), 입력에 `password`(선택 4~64자)·`spoiler`.
  - 프런트: `api/community.ts`(오류 코드별 안내, 삭제·운영자 요청), `ui/community/postFormat.ts`(``` 코드 블록·인라인 코드·미리보기 정리·회고 양식), `moderation.tsx`(본문 표시·삭제 버튼·운영자 모드), `Compose.tsx`(초안 탭 보관·닉네임 기억·삭제 비밀번호·풀이 포함·회고 양식), `PostDetail.tsx`(풀이 포함 접기·삭제), `CommunityScreen.tsx`(글쓰기를 주소로, NEW·풀이 포함 표시), `route.ts`(`#/community/write[/미션]`), `ReportScreen.tsx`·`App.tsx`("커뮤니티에 회고 남기기"), `useStoredState.ts`(`removeStored`: 등록 직후 화면 이동 때 초안이 지워지지 않던 문제 수정), `community.css`.
  - 문서: `backend/README.md` "커뮤니티 게시판", 루트 README 기능 목록.
- 운영자 삭제 동작: 서버 `backend/.env`의 `COMMUNITY_ADMIN_KEY`(32자 이상, 사용자가 직접 입력)가 있어야 켜짐. 화면 "운영자 모드"에 입력 → `GET /admin` 확인 → 탭 메모리에만 보관(브라우저 저장소·코드·VITE_ 변수에 없음, 새로고침하면 꺼짐). 지금 `.env`에 값이 있는지는 읽지 않았다.
- 실행한 명령과 결과(이 Mac): `npm run typecheck` 통과, `npx vitest run` **498개/22파일** 통과, `npm run build` 통과(본체 JS 531.6kB 경고 유지, 게시판 별도 조각 21kB), backend `unittest discover -s tests` **61개** OK(게시판 21개: 기존 12 + 2단계 9), `git diff --check` 통과.
- 브라우저 검증(5173, 임시 시험 DB·임시 운영자 키로 별도 서버를 띄워 실제 DB에는 시험 글 없음): 캠퍼스 커뮤니티실 → `#/community` 빈 목록 / 글쓰기 주소 / 초안이 다른 화면·새로고침 뒤에도 남음(비밀번호는 저장 안 함) / 코드 블록·인라인 코드 표시 / 회고 양식(`#/community/write/1`, 쓰던 초안이 있으면 바꾸기 제안) / 풀이 포함 목록 미리보기 숨김·상세 펼치기 / 등록 뒤 뒤로 가기가 작성 화면으로 안 돌아감 / 댓글 작성·틀린 비밀번호 안내·맞는 비밀번호 삭제 / 운영자 키 틀림 안내·맞으면 운영자 삭제(키가 DOM·저장소에 남지 않음) / 새로고침 뒤 운영자 모드 꺼짐 / 작성자 글 삭제 / 서버 중지 시 게시판만 연결 실패 안내·홈과 14개 실습 정상 / 실습 1 클리어 → 리포트 "커뮤니티에 회고 남기기" → 양식 자동 채움 / 375px 목록·글쓰기 가로 넘침 0. 검사 뒤 진행 기록·실습 세션·초안·시험 닉네임을 지워 검사 전 저장소 상태(지식 대화 2키만)로 되돌림.
- 서버: 시작 시 8000에 떠 있던 이 프로젝트 uvicorn(PID 70722, 게시판 2단계 이전 코드)을 SIGTERM으로 멈추고, 검증 뒤 `.claude/launch.json` "api-mac"으로 새 코드 서버를 다시 띄움. 실행 중: Vite `127.0.0.1:5173`(PID 61243, 이전부터), API `127.0.0.1:8000`(api-mac, 실제 `backend/data/community.sqlite3` — 글 0개, 버전 2로 올라감). 임시 launch 설정은 원래대로 되돌림.
- 남은 것·미검증: 실제 `COMMUNITY_ADMIN_KEY` 값으로의 운영자 삭제(사용자가 키를 넣어야 함), 여러 사람이 다른 기기에서 쓰는 환경(현재 로컬 프록시 뒤에서는 속도 제한이 한 주소로 묶임), 백엔드 배포. 알려진 오류 없음.
- 커밋: 이 Phase 코드(이전 도우미의 미커밋 1단계 포함)와 문서를 커밋함(해시는 `git log`). push·master 병합 없음.
- 다음 시작 작업 후보: (1) 문제 보강 — K8s CrashLoopBackOff/OOMKilled(현재 K8s 모델에 logs·resources가 없으므로 `kubectl logs [--previous]`·`set resources`부터) → Docker 2 → Linux·Web 3, 새 시나리오마다 탐색 검사 추가. (2) 게시판 후속(TASKS 후보 목록). 사용자 미결정: LLM_MODEL 원복·최종 제출·master 병합.

## 이전 상태 — Kubernetes 실습과 정답 경로 밖 탐색 검증 (2026-10-22, Mac)

- 사용자 "진행해줘"로 첫 Phase·게시판 FastAPI+SQLite 선택 승인. 진행 중 "정답 명령만 아닌 비슷한 명령을 입력하며 시나리오 점검" 요청을 우선 반영. 시나리오 **14개**, Docker·게시판은 아직 준비 중.
- K8s: `state/kubernetes/{types,reconcile}.ts`·`hosts/kubernetesAdmin.ts`로 가상 클러스터/이미지/파드/이벤트/엔드포인트 계산. `commands/kubectl.ts`·`kubectl/{queries,mutations,resources}.ts`로 get/describe/set image/rollout status. `scenarios/kubernetes-image-pull.ts` 추가, 레지스트리 등록·UI comingSoon 해제. default/Recreate/즉시 계산만 지원. logs/undo/resources/delete/실시간 watch는 미구현.
- 탐색 검사: `tests/scenario-exploration.cases.ts`·`scenario-exploration.test.ts`에서 14개 전부 조회 반복·역순·오조치·대체 풀이 실행. 첫 점검 60개 중 18개 실패를 재현하고 수정, 변형 보강 후 이 검사와 `exploration-regressions.test.ts` 합계 74개 통과.
- 고친 결함: kill -0·잘못된 시그널 처리, certbot/AWS dry-run의 실제 변경, UDP 규칙의 TCP 오복구, AWS 출발지 CIDR 판정, 잘못된 포트/CIDR/ARN/정책/숫자/옵션 허용, mysql 긴 옵션 값의 '=' 잘림, journalctl -n 0/잘못된 숫자, 불완전한 따옴표·미지원 셸 연산자의 부분 실행. 주요 변경은 commands/{aws,awsOptions,booleanOptions,diag,files,mysql,network,perms,system,text,tls}, parser/{parse,syntax}, run, judge, state/{aws,network,types,hosts/awsAdmin}.
- 추가 안정화: `ui/report.ts`의 다운로드 Markdown에 참고 자료가 빠지던 문제 수정. `tests/report.test.ts`와 K8s 완료·세션 재생·리포트 생성 검사 보강. 숨은 정답/근거 유출 테스트는 새 실습에도 자동 적용.
- **이번 Mac 실제 검증:** typecheck 통과, Vitest **480개/20파일** 통과, build 통과(JS 527.52KB/gzip 171.48KB, 기존 500KB 경고), backend unittest **40개** OK, diff --check 통과. npm audit·실제 RAG/유료 제공자 호출·재색인은 하지 않음. `.env` 값 읽기/변경 없음.
- 브라우저: K8s 캠퍼스 입장→조사→복구→원인 모달, 375×812 가로 넘침 없음. 메모리 실습 kill -0 전후 동일 프로세스, 잘못된 신호 오류; 방화벽 UDP 허용 후 미복구/TCP 허용 후 복구를 직접 입력해 확인. 증빙 `evidence/kubernetes/`·`evidence/exploration/`.
- **미검증 구분:** 기존 학습 기록(해결 1건/1000점) 보존을 위해 정답 제출/리포트 화면 완주는 하지 않음. 완료·복원·리포트 생성은 자동 테스트로 검증. 테스트 탭 닫아 임시 탭 세션 정리. 별도 localhost 주소 접근은 브라우저 자동 승인 검토가 거절하여 우회하지 않음.
- 실행 중: 이 프로젝트 Vite `127.0.0.1:5173`(PID 61243, `npm run dev -- --host 127.0.0.1`). API 8000·다른 프로젝트 8080/3307은 재시작하지 않음. 백엔드 오프라인에서도 게임 정상.
- 자세한 범위·재현 명령·남은 제한: `14_시나리오_탐색_점검.md`. 기존 bash/조회 명령 전체 옵션·sed 정규식·복합 리다이렉션·실제 클러스터 동작까지 완전 호환한 것은 아니다. 이번 수정 범위의 테스트 실패는 없음.
- 다음 시작 작업: 승인된 SQLite 게시판을 별도 router/storage로 구현. `backend/data/community.sqlite3`, 표준 sqlite3, 글 목록/상세/작성·댓글·분류·페이지네이션·작성 속도 제한·관리자 삭제 검증. `#/community` 및 캠퍼스 카페 연결, 서버 오프라인 안내. 외부 런타임 라이브러리/키 추가 없이 구현하는 계획. 저장 방식 재질문 불필요. 단계별 완료 후 멈추는 규칙 때문에 이번 Phase에는 미착수.
- 사용자 미결정 사항: 기존 LLM_MODEL 원복/최종 제출/마스터 병합은 여전히 사용자 결정. 게시판 저장 방식은 더 이상 미결정이 아님. push/마스터 병합 없음.
- 커밋: `feature/sudo-quest`의 `f2a3c0d`에 제품 코드·테스트 저장. 이 인수인계·점검 보고서·브라우저 증빙은 별도 docs 커밋으로 저장. 커밋 해시는 `git log`로 확인할 것.

## 이전 상태 — GPT 재개 점검·로컬 서버 정리 (2026-10-22, Mac)

- 첨부 `12_GPT_인수인계_프롬프트.md`와 현재 코드 기준으로 재개. 브랜치 `feature/sudo-quest`, 시작 HEAD `06d716b`, master보다 18커밋 앞섬, 시작 작업 트리 깨끗함.
- 사용자 최신 지시로 기존 로컬 개발 서버 종료: 이 프로젝트 uvicorn PID 53603(8000), M-Check 프로젝트의 `server-api-1`(8080)·`server-db-1`(3307). SIGTERM / docker stop으로 정상 종료, 컨테이너·볼륨 삭제 없음. 5173은 원래 꺼져 있었음. 관련 4개 포트 리스너가 없음을 확인.
- Raycast·macOS 시스템 서비스·OrbStack 자체는 유지. 다음 구현 때 SUDO QUEST 서버만 다시 시작.
- 이번 환경에서 재검증: typecheck 통과, Vitest 358개(16파일) 통과, build 통과(JS 507.29KB 경고 유지), backend에서 unittest 40개 OK. 브라우저·제공자 실제 호출·재색인·카탈로그 외부 링크 검증은 이번 단계 미실행. `.env` 값은 읽거나 변경하지 않음.
- 첫 Phase 계획: `13_재개_및_첫_Phase_계획.md` — K8s 상태/명령 기반 + 이미지 풀 실패 실습 1개(13→14). 다음 CrashLoop/OOM → Docker → Linux/Web. 파일 목록·타입 초안·검사 기준 포함.
- 첨부문 지시대로 구현 승인 대기. 게시판 저장 방식도 미정(FastAPI+SQLite 추천). 이전 대화의 Q&A 제안은 사용자 선택으로 간주하지 않음.
- 변경: 이 문서·TASKS·13 계획 문서만. 제품 코드 변경 없음, 이 단계 커밋/푸시 없음.
- 다음 작업: 첫 Phase 범위와 게시판 저장 방식 답변을 받고 구현. 승인 전 제품 코드를 수정하지 말 것.

## 이전 상태 — 호버 외곽선·글자 넘침 수정 (2026-10-22, Mac)

- 사용자 지적 3가지와 조치:
  1. 방에 마우스를 올리면 바닥 외곽선이 방 안까지 두껍게 그려져 그림 앞으로 튀어나옴 → 원인: 강조선이 바닥 네 변 polygon이고 방 그림보다 나중에 그려져 뒷벽 밑변 선이 서가·랙·컨테이너를 가로지름. 바깥 앞 두 변 polyline으로 바꿈(`RoomShell`).
  2. 쿠버네티스 운영실 영어 철자 → ORCHESTRATION·OPENING SOON·CLUSTER MAP 모두 정확. 갈매기가 "R" 위를 날아 글자가 깨져 보였던 것이라 갈매기를 배 앞 바다 위로 옮김.
  3. 상자를 넘치는 글자 → 브라우저에서 방 안 글자 52개를 감싸는 상자와 좌표로 비교해 넘침 10곳 찾음: 관제실 시계(SHIFT 00:00, 기존부터)·분류 화면 NETWORK(기존), 웹·DB BUILD/TEST/DEPLOY(기존), 컨테이너 IMAGE LAYERS·8080→80·REGISTRY, 클러스터 지도 제목, 게시판 제목. 상자 폭을 늘리거나(벽·문 위치 안에서) 글자 크기를 맞춰 0곳 확인. 레일 등급 카드의 "XP 0"이 숫자만 다음 줄로 떨어지던 것도 두 줄로 나눔. 다른 화면(지식·기록·브리핑·실습)의 HTML 넘침 검사는 0건.
- 검사: typecheck, vitest 358, build 통과. 브라우저로 관제실·웹·DB 보드·쿠버네티스 간판·커뮤니티실 호버 확인. 검사 중 만든 실습 세션 저장본은 지움.
- 다음 결정은 아래 항목 그대로(게시판 저장 방식 등).
- GPT로 넘길 시작 프롬프트: `12_GPT_인수인계_프롬프트.md`(작업 A 시나리오 추가 / 작업 B 게시판 백엔드 연동, 규칙·검사 명령·첫 응답 지시 포함).

## 이전 상태 — 컨테이너·쿠버네티스 운영실, 커뮤니티실(카페) 방 추가 (2026-10-22, Mac)

- 사용자 요청: 도커 방은 가운데 큰 컨테이너 + 헤엄치는 고래, 쿠버네티스 방은 해적선을 모는 직장인 차림 선원 + 조타륜(로고)을 잡은 직원, 커뮤니티실(게시판)은 따뜻한 카페, 디테일하게, 색은 기존과 어울리게.
- 결정(내가 고름, 사용자 확인 전): 칸 — 컨테이너 운영실 [2,0], 쿠버네티스 운영실 [0,2], 커뮤니티실 [2,2](3×3 꽉 참). 색 — 청록 #26e5c6(옆 보라·하늘과 구분), 놋쇠 금빛 #ffd447(옆 초록·분홍과 구분), 살구 #ff9a6b(경보 주황보다 밝고 붉음). 로고는 공식 파일을 옮기지 않고 고래·일곱 살 조타륜을 자체로 그림.
- 구조: `CATEGORY_IDS`에 docker·kubernetes 추가(시나리오 0개), UI 레지스트리 `comingSoon: true` → 목록 탭·레일·관제실 화면에서 빠지고(`OPEN_CATEGORIES`) 방은 경보등 대신 "OPENING SOON", 누르면 이동 없이 HUD에 "실습 준비 중"/"게시판 준비 중". 커뮤니티실은 고정 방(`RoomKind` "community", 예약 칸). 게시판 기능은 미구현.
- 그림: `art/DockerArt.tsx`+`dockerParts.tsx`(큰 컨테이너·문·포트 케이블, 운하와 고래(컨테이너 싣고 왕복·물보라), 갠트리 크레인이 컨테이너를 들었다 놓음, docker ps 화면·이미지 레이어 포스터, 안전모 작업자), `art/KubernetesArt.tsx`+`ship.tsx`(바다·항적, 해적선 선체·돛·조타륜 문장 돛·망대·깃발·밧줄, 셔츠·넥타이 선원 5명+삼각모 키잡이, 부두·등대·클러스터 보물 지도·현창), `art/CommunityArt.tsx`+`cafe.tsx`(벽돌 벽·원목 마루·창밖 야경·전구 줄, 바 카운터·에스프레소 머신 김·진열장·바리스타, 둥근 테이블·말풍선, 코르크 게시판, 칠판 메뉴, 소파와 고양이, 펜던트 조명). `people.tsx`에 넥타이·앞치마·모자·망원경.
- 기존 방 조정: 클라우드 운영실 구름을 방 오른쪽 바깥 낮은 곳으로(뒤쪽 컨테이너 운하를 가리던 것), 웹·DB·클라우드 운영실에 새 문이 생김(그림과 겹침 없음 확인), 관제실 미니맵 9칸·"CAMPUS MAP" 글자와 겹침 해소. 히어로는 문구 칸을 줄이고 지도 폭을 늘림(지도 764→878px, 버튼 글자 줄바꿈 방지).
- 실행한 검사: typecheck 통과, vitest **358**(16파일), build 통과(JS 507kB·gzip 165kB로 Vite 500kB 경고 처음 넘음 — 경고만, 분할은 미적용). 브라우저(5173): 세 방 확대 확인, 준비 중 방 클릭 시 이동 없음·HUD 문구, 탭·레일·경보등은 열린 4분류만, 375px 가로 넘침 없음, 새로고침 후 콘솔 오류 없음(편집 중 HMR 오류만 있었음).
- 미검증·남은 것: 게시판 기능(저장소 결정 필요), Docker·K8s 시나리오와 엔진 명령, 모바일에서 지도가 작음(313px), 번들 분할.
- 실행 중: 5173(dev), 8000(api-mac).
- 사용자 결정 대기: ① 새 방 칸·색 확인 ② 게시판 저장 방식(예: GitHub Discussions 연동 vs 자체 백엔드) ③ 이전 항목의 문제 보강 진행·LLM_MODEL·README 명칭·master 병합.

## 이전 상태 — 확장 대비 완료, 방 이름 "운영실"로 변경 (2026-10-22, Mac)

- 사용자 요청: "문제들이 계속 추가될 수 있으니 대비 먼저", 방 이름을 리눅스 운영실·네트워크 운영실·웹·DB 운영실·클라우드 운영실로(더 좋은 안이 있으면 그걸로). → 사용자 안을 그대로 채택(관제실·자료실 유지, 새 분류도 "○○ 운영실").
- 커밋(브랜치 `feature/sudo-quest`, push 안 함):
  - `1623324` feat(scenarios): `engine/scenario/categories.ts`(CATEGORY_IDS → Category 타입, isCategory). `Scenario.evidence` 필수(kind official-doc/postmortem/survey, title, url) — 13개 모두 링크 직접 확인 후 채움. 리포트에만 "참고 자료"(브리핑·코치 요청 제외, 코치 유출 테스트에 근거 제목·주소 추가). `.external-link`에 강조색(기본 파란색이 어두운 배경에서 안 읽힘).
  - `44c2afd` refactor(ui): `ui/categories.ts` 레지스트리(label·tag·room·wallTag·blurb·icon·slot). `campus/layout.ts`가 칸에서 문·복도·층·viewBox·미니맵을 계산(지금 배치와 값이 같음을 회귀 테스트로 고정: viewBox `-440 -128 880 760`, 복도 6개·장식 그대로). RoomArt `Record<Category, ComponentType>`. 전광판 태그 색은 THEMES 색 인라인. 관제실 분류 화면·미니맵은 칸이 늘면 줄여 맞춤. 빠짐 검사 테스트 5개.
  - `68b91ef` feat(backend): `app.catalog.ALLOWED_LICENSES`(curl, GPL-2.0-or-later, Linux-man-pages-copyleft, CC-BY-SA-4.0 + 미리 확인한 CC-BY-4.0, Apache-2.0). validate_catalog와 단위 테스트에서 검사.
  - 이 문서 커밋: SCENARIO_GUIDE("근거 자료", 기본 명령 묶음 갱신, 커버리지 테스트 안내, "새 분류(운영실) 추가"), README, TASKS, 11_ 계획 문서.
- 실행한 검사(이 Mac에서 실제 실행): `npm run typecheck` 통과, vitest **357**(16파일), `npm run build` 통과, 백엔드 `unittest discover` 40개 OK, `scripts.validate_catalog` 실패 0. 중간 커밋 `1623324`를 임시 worktree에서 typecheck·vitest 351 통과 확인(worktree 삭제함).
- 브라우저 확인(5173): 캠퍼스 배치·viewBox 변경 없음, 벽 간판의 긴 이름(네트워크·클라우드·웹·DB 운영실)이 문·보드와 겹치지 않음, 전광판 태그 색 기존과 동일(#00ff66/#a259ff/#ff2d95/#5cc8ff), 호버 HUD·브리핑 "DEPLOY TO 리눅스 운영실", 실습 1을 실제로 클리어해 리포트 "참고 자료" 2건(새 탭·noopener) 확인. 확인 뒤 진행 기록·실습 세션 저장본을 지워 원래 상태(진행 기록 없음, 지식 대화만)로 되돌림. HMR 중간의 콘솔 오류는 새로고침 후 재발 없음.
- 미검증·남은 것: 분류가 5개 이상일 때의 관제실 벽 화면·미니맵 축소는 단위 테스트(좌표)만 있고 화면 확인은 없음(실제 분류를 더할 때 확인). 시나리오 카드 아이콘 색은 분류별 CSS 그대로(새 분류는 기본색).
- 실행 중: 5173(dev), 8000(api-mac).
- 사용자 결정 대기: ① 문제 보강 진행 신호(K8s 3 → Docker 2 → Linux·Web 3, 칸 제안 쿠버네티스 운영실 [2,0]·컨테이너 운영실 [0,2]) ② 제출 전 LLM_MODEL을 gpt-6.1-sol로 되돌릴지 ③ README·제출 문서의 InfraCoach 명칭 ④ master 병합.
- 다음 작업(진행 신호 시): 쿠버네티스 상태 모델(파드·디플로이먼트·서비스·이벤트, 출력은 상태에서 계산) + `kubectl get/describe/logs [--previous]/rollout undo/set image/set resources` + 첫 시나리오 CrashLoopBackOff, 분류 id `kubernetes` 추가 → 컴파일 오류 3곳 채우기(방 그림 새로).

## 이전 상태 — 명령 커버리지 완료, 뒤로가기·세션 보존·스크롤 수정, 확장 계획 (2026-10-22, Mac)

- 브랜치 `feature/sudo-quest`(push 안 함). 이번 커밋: `460010a` 엔진 커버리지, `34876a2` UI 수정. vitest **325**, typecheck·build 통과.
- 엔진(`460010a`): 파이프(|), grep/head/sort/wc 신규(기본 묶음), tail·cat·sed 파이프 입력, systemctl reload·nginx -s reload/-T/-v, openssl s_client, mysql SHOW PROCESSLIST/DATABASES·1064, 게임식 안내 → 실제 도구 오류 형식(aws CLI v2 Invalid choice 등), /etc/hosts. 상설 테스트 `tests/command-coverage.test.ts`(시나리오 문구·풀이 명령이 "미지원"으로 거절되면 실패).
- UI(`34876a2`): 해시 라우트(`ui/route.ts`, #/mission/N[/play|/report], 시나리오 ID 미노출)로 뒤로/앞으로 가기. 진행 중 실습을 sessionStorage에 두고 입력 명령을 엔진에 재실행해 복원(`ui/sessionStore.ts`), 브리핑 "조사 이어서 하기". 코치·지식 대화도 탭 저장소(`ui/useStoredState.ts`), 대기 중 이탈 질문은 재질문 안내. 근거 링크는 `ExternalLink`(새 탭·noopener). 지식 목록 호버 transform 제거·scrollbar-gutter·가로 넘침 차단(레일 메뉴도).
- 브라우저 검증(실제): 홈→브리핑→실습→뒤로(브리핑, "이어서")→앞으로(명령 유지)→뒤로×2(홈). 외부 페이지로 이동 후 뒤로: 실습·명령·코치 답변 복원, 대기 질문 안내. 지식 목록 가로 넘침 0, 선택 항목·#/knowledge 새로고침 유지, 건너뛰기 링크가 주소 불변. 테스트용 sessionStorage는 지움.
- 공식 문서 재점검: validate_catalog 실패 0, 189개 절의 원본 8페이지 모두 200·리디렉션 없음. 내용 변경(해시 비교)은 미확인.
- 확장 조사·계획: `11_확장_계획_도커_K8s_시나리오.md`. K8s 문서 CC BY 4.0·Docker 문서 Apache 2.0(원본 LICENSE 확인). 제안: 대비(분류 레지스트리·빠짐 검사·시나리오 근거 필드·라이선스 허용 목록·작성 가이드) → K8s → Docker → Linux·Web, 13→24개. **사용자 결정 대기**(도커/K8s 여부, 범위·순서, 근거 필드 필수).
- 실행 중: 5173(dev), 8000(api-mac). 커밋 안 된 것: 이 문서들(HANDOFF/TASKS/11_).

## 이전 상태 — 의미 단위 커밋 7개, 로드맵 1단계(명령 커버리지) 진행 중 (2026-10-21 23시대, Mac, 사용량 한도로 중단)

- 커밋: 브랜치 `feature/sudo-quest`(master에서 분기, push 안 함) 7개 — chore(setup) / feat(engine,coach) / fix(ui 안정화) / feat(ui 코치) / feat(report) / feat(ui SUDO QUEST) / docs. 임시 worktree에서 커밋마다 typecheck·vitest 통과 확인(197→278). 중간 커밋이 PlayScreen 때문에 typecheck 실패해 그 3개만 단계별 PlayScreen으로 다시 만들었고 최종 트리는 동일. `tsconfig.tsbuildinfo`는 추적 해제·.gitignore. 키 값 검사 0건. master 반영: `git switch master && git merge --ff-only feature/sudo-quest`(사용자 결정).
- 커버리지 조사(임시 probe, 삭제함): 시나리오 문구·풀이·실무 점검 명령을 엔진에 실행. 실제 결함: ① grep 없음·파이프 미지원(linux-oom 문구가 `dmesg | grep -i oom`을 권함) ② systemctl reload 미지원(web-nginx-config 포스트모템이 reload를 권함) ③ nginx -s reload/-T 미지원 ④ /etc/hosts 없음(13개 전부) ⑤ "이 시뮬레이터는 …만 지원합니다" 같은 게임식 오류 문구(nginx·openssl·mysql·cat·tail, CLAUDE.md 5절 위반) ⑥ aws s3/logs 미지원.
- 이번에 고침(미커밋): `services.reloadService`(실행 중일 때만, 설정 오류면 거부하고 기존 프로세스 유지, 포트 재적용, 설정 없는 서비스는 not applicable), `systemctl reload`(권한·비활성·거부 메시지 실제 형식), 테스트 1개. vitest 279, typecheck 통과.
- 다음 할 일(순서): 파이프라인(`|`, 따옴표 인식 분리, CommandContext.stdin) + grep/head/sort/wc 새 명령(1파일=1명령, DEFAULT_COMMANDS 추가) + tail/cat stdin → coachPrompts의 SHELL_OPERATORS에서 `|` 허용·supportsInvocation이 각 단계 검사 → nginx -s reload/-T → /etc/hosts → 게임식 오류 문구를 실제 형식으로 → 시나리오 문구 속 명령이 "미지원"이면 실패하는 커버리지 테스트 상설화 → 커밋.

## 이전 상태 — SUDO QUEST 이름 확정, 경보등 수정, 원인 노출·du 깊이 수정, 본질 다듬기 로드맵 (2026-10-21 23시대, Mac)

- 사용자 결정: 앱 이름 **SUDO QUEST(수도퀘스트)**. 디자인·레벨 시스템 만족. 경보등 박스가 무너진 것 수정 요청. 이후 디자인은 보류하고 실질적인 내용 다듬기 계획을 세우고, 이미 알던 결함은 바로 고쳐도 됨.
- 경보등: 벽 뒤 모서리 위에 바로 얹혀 네온 이음새를 가리던 것을 가는 기둥 위로 올림(`RoomShell`). 같은 모서리에 있던 보안 카메라를 왼쪽 벽 [0.05, 1.4, 3.3]으로 옮김.
- 이름: `components/BrandLogo.tsx`(보라 터미널 창 + 초록 프롬프트·깜박이는 커서 + 금빛 검, crispEdges 픽셀), 레일 "SUDO QUEST / INCIDENT RPG", index.html 제목·설명, 리포트 마크다운 머리. 백엔드 health의 service "InfraCoach"와 프론트 검사는 유지. README·docs/submission은 미변경(결정 필요).
- 원인 노출 수정: 브리핑의 시나리오별 학습 목표(예: "df와 du로…")를 빼고 공통 조사 흐름 4단계를 보여 줌. 학습 목표는 리포트 포스트모템 끝 "이번 실습에서 익힌 것"으로 이동(코치 요청에는 원래 미포함).
- 엔진: `du`가 `-d N`, `-dN`, `-xhd1`, `--max-depth=N`을 지원. 숫자가 아니면 `invalid maximum depth`, `-s`와 1 이상이 겹치면 GNU처럼 경고 후 실패, 0이면 합계만. 테스트 2개 추가. (glob `*` 확장은 이미 run.ts에 있었음 — 이전 메모의 "글롭 미확인"은 해소)
- 정리: 레일 개편으로 안 쓰게 된 CSS 선택자 26개(rail-guide·journey-card·operator·nav-pill·session-banner 등) 삭제, `rooms.drawOrder`와 테스트 삭제(층 그리기로 대체).
- 검증(실제 실행): vitest **278**, typecheck, build. 브라우저: 경보등 확대 확인, 제목 "SUDO QUEST — 인프라 장애 대응 퀘스트", 브리핑에 학습 목표 미노출, 디스크 실습을 실제로 클리어해 리포트에 학습 목표 3개 표시·레일 Lv.2 온콜 루키·XP 1,000 확인 후 진행 기록 삭제(원래 비어 있었음).
- 로드맵: TASKS.md "본질 다듬기 로드맵" — 0 커밋(결정) → 1 학습 경험(명령 옵션 커버리지, 리포트 회고) → 2 코치 품질 평가 자동화·5xx 재시도(결정) → 3 성능·접근성·회귀 테스트 → 4 제출 문서·모델 원복(결정).
- 커밋하지 않음. 실행 중 5173, 8000.

## 이전 상태 — 네온 테두리 마감·네트워크실 보강·걷는 사람, 레일·실습·브리핑·자료실 게임 UI (2026-10-21 23시대, Mac)

- 사용자 피드백: 색은 만족. 네트워크실이 비어 보임, 움직이는 사람이 적음, 벽 네온이 윗선만 있고 세로선이 없어 상자가 그리다 만 느낌. 메인에 비해 네비게이션·실습 환경·지식 탐색이 단순하고 게임 느낌이 없음. 앱 이름은 NOCNOC 같은 말장난 + 장애 해결·게임 혼합, 로고는 업타임 아케이드 같은 게임풍을 원함.
- 캠퍼스:
  - `parts.Walls`: 벽 앞쪽 세로 모서리 두 개를 윗선과 같은 굵기 네온으로 닫고, 뒤 모서리도 굵게.
  - 네트워크실: 방화벽 장비 2단(주황 네온·FW), 분배 스위치 랙 3대(패치 코드), 세로 광 트레이(청록), 바닥 배선, 장비 상자·케이블 릴, 방화벽 점검자, 걷는 엔지니어.
  - 걷는 사람: 모든 방에 1명 이상(리눅스 2), 복도 3명 + 순찰 로봇. `Person`에 `duration`을 줘 걸음이 맞물리지 않게 함. 걷는 사람은 앞 가구보다 먼저 그려 가림이 맞게 정리.
- 구조 정리: 방 색은 `campus/themes.ts`(THEMES·CATEGORY_TAG·CATEGORY_ROOM), 방 그림 선택은 `campus/art/RoomArt.tsx`, 타공 타일 무늬는 페이지에 한 번만 두는 `CampusDefs`(App), 방 하나짜리 장면 `campus/RoomVignette.tsx`.
- 레일(`components/Rail.tsx`, App에서 분리): 운영자 등급 카드(`ui/rank.ts`: 해결 수 비율로 Lv1 수습 → Lv6 전설의 온콜, XP=최고 점수 합, 다음 등급까지 남은 수), 네온 메뉴(활성 시 왼쪽 빛 막대, 숫자 배지 + aria-label), SECTOR STATUS(분류별 해결 칸), SANDBOX ONLINE. 1050px 이하 아이콘만, 760px 이하 등급 카드 숨김.
- 실습 화면: `components/MissionHud.tsx` — 방 미니 장면, MISSION 번호·분류·방 이름, 퀘스트 단계(접속/원인 규명/복구, 현재 단계 맥동), 실제 경과 시간·예상 점수(등급 글자)·명령 수·힌트 칸. 터미널은 방 색 테두리·글로우·CRT 주사선·LIVE 표시. 사이드바 탭도 방 색.
- 브리핑(`TicketScreen.tsx`): INCOMING INCIDENT 경보 띠(움직이는 사선), 티켓 서류·난이도 칸·학습 목표, 오른쪽 DEPLOY TO 방 장면. **기존 버그 수정**: "장애 티켓 #linux-disk-full"처럼 시나리오 ID(원인 노출)를 보여 주던 것을 실습 번호로 바꿈(CLAUDE.md 티켓에 원인 노출 금지).
- 자료실(지식 탐색): ARCHIVE 머리(자료실 장면, 제품별 실제 주제 수 배지 curl 40·Linux 40·AWS ALB 20), 항목 목록 제품 색 태그·선택 시 금빛 강조, 답변 카드 금빛 왼쪽 선.
- 새 스타일 `ui/game.css`(App에서 마지막에 불러옴).
- 검증(실제 실행): vitest **277**(등급 3개 추가), typecheck, build. 브라우저 1200(레일 펼침)·800·375에서 홈/브리핑/실습/자료실 가로 넘침 없음, 브리핑에 ID 미노출 확인, 실습에서 명령 실행 후 HUD 갱신 확인. 증빙 `evidence/campus/game-*.jpg`, `network-room-detail.jpg`.
- 발견(미수정, 사용자 판단 필요): 브리핑의 "이번 임무에서 연습할 것"(learningObjectives)이 예: "df와 du로 디스크를 넘긴 곳에서…"처럼 원인을 사실상 알려 준다. 기존부터 보여 주던 항목이라 그대로 두었다. 클리어 후 리포트로 옮기거나 일반적인 표현으로 바꾸는 방안을 제안할 것.
- 앱 이름: 2차 후보 6개 제시(PANIC ROOM 추천 / FAILOVER 2순위 / PING PONG / HEAL CHECK / RESPAWN / SUDO QUEST, 픽셀 로고). **사용자 결정 대기**.
- 커밋하지 않음. 실행 중 5173, 8000.

## 이전 상태 — 사이버 네온 서버룸 개편·근무자·티켓 전광판, 앱 이름 후보 제시 (2026-10-21 22~23시대, Mac)

- 사용자 피드백: 서버룸다운 공간 색감 부족(사이버 블루·네온 마젠타/퍼플·일렉트릭 그린·딥블랙/건메탈·경고 레드/오렌지, 면이 아니라 "선"으로 빛나게). 관제실과 리눅스 서버실 색이 겹침. 더 디테일하고 정렬된 서버실, 물리 요소, 출근해 일하는 사람들, 어울리는 컴포넌트로 꽉 찬 화면. 로고·앱 이름 변경 아이디어 요청.
- 전체 색: `command-center.css` `:root` = bg #07090e, panel #0d1118, border(건메탈) #1f2833, accent 사이버 블루 #00d4ff(+deep #0055ff), ok #2cff8f, alert #ff7a1a, danger #ff3355, neon magenta/purple. 남색 하드코딩은 건메탈로, 밝은 파랑은 청록으로 옮기는 변환(scratchpad `cyber-shift.mjs`, 원본 사본 `css-before-cyber/`). primary 버튼에 네온 글로우.
- 방 색 분리: 리눅스=일렉트릭 그린 #00ff66, 관제실=전기 파랑 #2f7bff + 플래티넘 화이트, 네트워크 #a259ff, 웹·DB #ff2d95, AWS #5cc8ff, 자료실 금빛 #ffcf8a. 벽·바닥은 딥블랙 계열, 색은 네온 선(벽 윗선·걸레받이·바닥 앞 가장자리·랙 틈·복도 가장자리)으로만. 회귀 테스트로 6개 방 색이 모두 다른지 검사.
- 새 부품: `parts.Neon`(굵고 옅은 선 + 선명한 선으로 번짐 흉내, blur 필터 미사용), `art/people.tsx`(서기·앉기·타이핑·걷기, 4방향, 손 소품), `art/fixtures.tsx`(랙 앞/뒷면, 모니터, 항온항습기+회전 팬+냉기, 가스 소화 실린더, 소화기, 카메라, 화분), `CampusGround.tsx`(트론 바닥 격자, 네온 복도, 걷는 사람·순찰 로봇), `IncidentTicker.tsx`.
- 방 디테일: 리눅스(랙 6×2 정렬, 냉기 통로 타공 타일·컨테인먼트 지붕·유리문, 뒷줄 열기 배출, CRAC, 케이블 사다리, 분전반, 소화 가스, 근무자 3), 네트워크(정리된 색별 케이블 벽, 네트워크 랙+패치 코드, 코어 라우터, 광 트레이, 콘솔·작업대, 근무자 2), 웹·DB(스토리지·앱 랙 3, 복제선 있는 DB 3, CI/CD 보드, </> 네온, 인증서, 개발자 2), AWS(AZ 두 곳·인스턴스 4·LB·보안 그룹·버킷·IAM 게이트·홀로그램 콘솔, 근무자 2, 구름), 관제실(실제 해결 수 화면 4칸+총계, 실제 시계, 실제 경보 상태 미니맵, 운영자 5·감독자), 자료실(이동식 사다리, 지구본, 책 읽는 사람 3).
- 컴포넌트: 출동 대기 티켓 전광판(실제 미해결 실습만, 클릭 시 해당 티켓 열기, 호버·포커스 시 멈춤, 복사본은 보조기기·Tab 제외), HUD에 근무 시각.
- 그리기 순서: 복도 사람이 뒤 방 앞·앞 방 뒤에 보이도록 방을 층(0 자료실→1 리눅스·네트워크→2 관제실→3 웹·DB·AWS)으로 그리고 층 사이에 복도를 그린다.
- 검증(실제 실행): vitest **274**, typecheck, build. 브라우저 1440/900/375 가로 넘침 없음, 방별 확대 확인(SVG viewBox를 잠시 바꿔 관찰 후 새로고침), 티켓 클릭→해당 티켓 화면→홈. SVG 노드 약 2,400개. 증빙 `evidence/campus/cyber-*.jpg`.
- 앱 이름·로고: 채팅 위젯으로 4안 제시(A RootCamp 추천 / B NOCNOC / C Uptime Arcade / D Tracer). **사용자 결정 대기**. 바꿀 때 주의: 백엔드 health의 `service: "InfraCoach"`를 프론트 `isHealth`가 검사하므로 내부 서비스 ID는 유지하고 화면 표시·로고·문서만 바꾸는 것을 권장. 제출 문서(docs/submission)의 이름 변경 여부도 확인 필요.
- 남은 일: Phase 3(방 확대 전환·패럴랙스·모바일 확대), 이름 확정 후 로고 컴포넌트·index.html 제목·README 반영. 커밋하지 않음. 실행 중 5173, 8000.

## 이전 상태 — 디자인 Phase 1(B안 색) + Phase 2(아이소메트릭 캠퍼스) (2026-10-21 22시대, Mac)

- 사용자 결정: 대표색 **B안 인프라 블루**. 방마다 무슨 공간인지 개성이 드러나고 디테일하게 꾸밀 것, 2.5D 모듈형 구성 유지. 라이트/다크는 따로 답하지 않아 추천안인 어두운 배경으로 진행.
- Phase 1 색 토큰:
  - `command-center.css` `:root`: --bg #0b1630, --panel #101d3b, --panel-2 #16264a, --border #233559, --accent #3b9eff, --accent-strong, --on-accent, --ok #5ee0a8, --alert #ffb547, --danger.
  - 하드코딩 hex 약 200개는 녹·청록 색만 파랑 쪽으로 돌리는 변환으로 바꿨다(scratchpad `hue-shift.mjs`, 원본 사본 scratchpad `css-before/`). 주황·빨강은 그대로.
  - 의미 색 지정: primary 버튼=accent, 온라인 점·단계 완료·코치 온라인=ok, 통계 아이콘 green/amber=ok/alert.
- Phase 2 캠퍼스(`src/ui/campus/`, 런타임 라이브러리 추가 없음, SVG 직접 그림):
  - `iso.ts`(투영·면·벽 transform), `rooms.ts`(배치·`roomStatus`·`drawOrder`), `parts.tsx`(Box/Floor/Walls/OnWall/Cylinder/Led/Wire), `RoomShell.tsx`(바닥·벽·이름 간판·문·경보등·호버/키보드), `art/*.tsx` 방 6개, `IsoCampus.tsx`(복도·HUD·입장), `campus.css`.
  - 방 개성: 리눅스(파랑, 이중 바닥·랙 2줄·찬 공기 통로·케이블 트레이·터미널), 네트워크(보라, 패치 패널·스위치 스택·라우터·흐르는 광케이블·토폴로지 보드), 웹·DB(마젠타, 빛나는 DB 디스크·웹 서버·브라우저 창·인증서 액자·책상), AWS(하늘, 유리벽·리전 플랫폼·LB→인스턴스 3대·보안 그룹 점선·IAM 리더·구름), 관제실(실제 분류별 해결 수 비디오 월·운영자 책상 2줄), 자료실(원목·서가 2면·독서 테이블·스탠드·화분).
  - 경보등: 분류에 미해결 실습이 있으면 주황 깜박임, 모두 해결하면 초록. 학습 진행 표시이며 실제 모니터링 아님(관제실 화면 숫자도 학습 기록).
  - 인터랙션: 등장 시 방이 차례로 떨어져 조립됨, 호버·포커스 시 방이 떠오르고 나머지는 어두워짐, LED·광케이블·DB 링·구름·스탠드 애니메이션, 지도 아래 HUD(방 설명·해결 현황). 클릭/Enter: 분류 방→아래 목록을 그 분류로 거르고 스크롤, 관제실→학습 기록, 자료실→지식 탐색. 터치 화면은 첫 탭 미리 보기·두 번째 탭 입장. 모션 끄기·reduced-motion 따름.
  - 홈 히어로 오른쪽 장식 서버 랙(`ServerRoom.tsx`)과 그 CSS를 삭제하고 캠퍼스로 교체. 한글 제목 어절 단위 줄바꿈.
- 테스트·검증(실제 실행): vitest **271**(새 `tests/campus.test.ts` 6개), typecheck, build. 브라우저 1440/900/375 가로 넘침 없음, 클릭·Enter·터치 2단계·모션 정지 확인, 임시 진행 기록(리눅스 4개+DNS)으로 초록/주황 경보등과 관제실 숫자 확인 후 기록 삭제(원래 비어 있었음). 증빙 `evidence/campus/`.
- 발견·수정: SVG `fill="var(--x)"` 속성은 CSS 변수가 적용되지 않아 경보등이 검게 보였다 → style로 칠함.
- 남은 일(Phase 3): 방 클릭 시 확대(카메라 줌) 전환, 마우스·스크롤 패럴랙스, 모바일에서 지도가 작아 방 이름이 작음(확대 보기 필요), 플레이 화면 배경에 해당 방 미니 장면.
- 커밋하지 않음. 실행 중: 5173, 8000(api-mac).

## 이전 상태 — 예시 질문·홈 바로가기, 디자인 방향 논의 시작 (2026-10-21 21시대, Mac)

- 사용자 요청: 지식 탐색 "공식 문서에 질문하기"에 예시 질문 3개, 홈으로 바로 가는 길, 대표색 결정, 아이소메트릭 사무실형 구성 + 호버·패럴랙스 등 게임 같은 인터랙션. 참고 이미지 3장(Freepik 아이소메트릭 데이터센터 스톡 — 구도 참고만, 저장소에 복사하지 않음).
- 구현:
  - `KnowledgeScreen.tsx`: 예시 질문 칩 3개(조건 / 무엇부터 확인 / 비슷한 오류와 구분). 누르면 입력창에 채우기만 하고 전송은 사용자가 한다(유료 호출). placeholder 변경. 스타일은 `styles.css` 끝 `.example-questions`.
  - `App.tsx`: `goHome()` — 로고와 상단바 새 "홈" 버튼(`.home-crumb`, `Icon` home 추가)에서 실습 목록(히어로 화면)으로 간다. 실습 중 명령을 1개 이상 실행했다면 `window.confirm`으로 확인.
- 검증: vitest 265, typecheck, build 통과. 브라우저: 예시 칩 → 입력창 채움, 홈 버튼 → 히어로 표시, 명령 0개면 묻지 않음, 명령 후 취소하면 실습 유지·확인하면 홈(confirm은 페이지 안에서 임시 대체해 확인 후 새로고침).
- 디자인 제안(채팅 위젯으로 제시, 사용자 결정 대기):
  - 대표색 A 관제실 민트(현재 유지) / **B 인프라 블루 추천**(#3B9EFF 기본, #FFB547 장애 경보, #5EE0A8 복구, 배경 #0B1630) / C 인시던트 앰버.
  - 아이소메트릭 홈: 가운데 관제실(학습 기록), 위 자료실(지식 탐색), 네 모서리에 분류별 서버실(리눅스 4·네트워크 3·웹·DB 3·AWS 3). 방 호버 시 떠오름, 미해결 실습이 있는 방에 경보등(학습 진행 표시이며 실제 모니터링 아님), 클릭 시 방으로 확대 → 시나리오 카드. 마우스·스크롤 패럴랙스, 모션 끄기·reduced-motion 존중. CSS/SVG로 직접 그림, 런타임 라이브러리 추가 없음.
- 커밋하지 않음. 다음: 사용자가 대표색·라이트/다크 방향을 정하면 디자인 토큰 → 아이소메트릭 홈 → 방 확대·패럴랙스 순으로 Phase를 나눠 진행.

## 이전 상태 — 지식 탐색 답변 서식 적용 (2026-10-21 21시대, Mac)

- 사용자 요청: 커밋 전에 지식 탐색 답변에도 RichAnswer 적용.
- 변경:
  - `src/ui/screens/KnowledgeScreen.tsx`: 답변 본문 `RichAnswer`, 점검 제안 `RichLine`. 질문 원문과 "검색한 근거 본문"(문서 발췌)은 원문 그대로 둔다.
  - `src/ui/rich-answer.css`(새, RichAnswer.tsx에서 import): 서식 스타일을 coach.css에서 옮기고 글자 크기를 em으로 바꿔 코치(12px 기준)와 지식(14px 기준) 화면 모두에 맞췄다. 코치 화면 계산값은 이전과 같음(code 10.8px, 칩 9px).
- 검증(실제 실행): vitest 265개, typecheck, build 통과. 실제 지식 질문 2건(gpt-6-luna):
  - ENOSPC "어떤 명령으로 확인하고 대응하나요?": 문서에 명령이 없어 "문서에서 확인되지 않습니다"로 보류. 출처 칩 2개, 근거 2건. 제목·목록은 없는 한 문단 답변.
  - ALB "타깃이 서비스에 참여하지 못함" 단계별 질문: 목록 7개, 코드 2개(`Target.ResponseCodeMismatch` 등), 출처 칩 8개, 근거 4건. 화면에 `###`·`-` 원문 기호 없음. 375px에서 가로 넘침 없음. 서버 오류 없음. 증빙 `evidence/coach-in-play/real-knowledge-alb-answer.jpg`.
- 커밋하지 않음(사용자가 이 작업 뒤 커밋 예정).

## 이전 상태 — 코치의 미지원 aws 하위 서비스 제안 수정 (2026-10-21 21시대, Mac)

- 문제: ALB 실습에서 코치가 `aws cloudwatch describe-alarms`를 제안 → "터미널에 입력" 버튼이 생기지만 가상 엔진은 `Unknown service: cloudwatch`. 버튼 판별·서버 검사 모두 명령 이름(`aws`)만 봤다.
- 선택: 요청에 **새 필드 `command_operations`** 를 추가했다(예: `{"aws": ["elbv2 describe-target-groups", …]}`). `available_commands`에 문자열을 섞는 방법보다 계약이 분명하고 서버 검사가 단순하다. 이 목록은 엔진 공통이고 플레이어도 `aws elbv2 x`의 오류 안내("지원: …")로 이미 볼 수 있어 정답 유출이 아니다.
- 변경 파일:
  - `src/engine/commands/types.ts`: `Command.operations?`(하위 명령 경로) 추가.
  - `src/engine/commands/aws.ts`: `AWS_OPERATIONS` 표 하나로 지원 목록과 오류 안내를 만든다(`unknownSubcommand`). `aws sts <없는 하위명령>`이 "Unknown service: sts"로 나오던 것을 "Unknown subcommand"로 고쳤다.
  - `src/engine/commands/index.ts`: `commandOperations(available)`, `supportsInvocation(line, available)`(옵션 건너뛰고 앞 단어 비교, 옵션이 하위 명령보다 앞이면 보수적으로 false).
  - `src/ui/coachPrompts.ts`: `runnableCommands`가 `supportsInvocation` 사용 → 미지원 aws 서비스는 버튼 없음.
  - `src/api/coach.ts`: 요청에 `command_operations` 추가.
  - `backend/app/contracts.py`: `CoachRequest.command_operations`(키 a-z 패턴·30자, 하위 명령 패턴·80자, 명령 10개·명령당 60개 상한).
  - `backend/app/coach.py`: `unsupported_commands`가 하위 명령까지 검사(같은 규칙), 공개 입력·캐시 키에 포함, PROMPT_VERSION **coach-3**.
  - `backend/app/prompts.py` COACH: command_operations 목록의 하위 명령만 제안, 없는 서비스는 suggested_checks에 넣지 말라고 지시.
  - 테스트: `tests/command-operations.test.ts`(새, 표의 11개 하위 명령이 실제 구현되어 있는지 + 판별 규칙), `tests/coach.test.ts` 허용 키 갱신, `backend/tests/test_coach.py` 2개 추가(하위 명령 검사, 계약 상한).
- 검증(실제 실행): vitest **265개**, typecheck 통과, 백엔드 unittest **39개** OK. 8000 재시작 후 ALB 실습에서 `aws elbv2 describe-target-groups` → "다음 점검"(실제 gpt-6-luna, 15초): 전송 본문 키 10개(command_operations 포함, 정답 정보 없음), 제안은 `aws elbv2 describe-target-health …` 1개뿐(cloudwatch 없음), 경고 없음, 문서 근거 2건. 버튼 → Enter → `Target.ResponseCodeMismatch [404]` 출력. 서버 오류 로그 없음.
- 한계: 하위 명령 목록은 현재 aws만 정의했다(systemctl 등은 이름만 검사). LLM이 지시를 어겨도 프론트 버튼과 서버 경고가 걸러 준다.
- 실행 중: 5173, 8000(api-mac). 커밋하지 않음.

## 이전 상태 — Mac 백엔드 설치·실제 코치 검증 (2026-10-21 20~21시대, Mac)

- 사용자 요청: Python 3.11 백엔드 설치, 사용자가 GMS_KEY 입력 후 색인, 실제 코치로 실습 화면 검증. 비용 때문에 **생성 모델은 테스트 동안 `gpt-6-luna`** 를 쓰기로 함(사용자 결정).
- 설치·설정(실제 실행):
  - `brew install python@3.11` → 3.11.17. 시스템 기본 3.14는 그대로.
  - `python3.11 -m venv backend/.venv`, `pip install -r backend/requirements.lock.txt`, `pip check` 이상 없음.
  - `backend/.env`: 사용자가 GMS_KEY 입력(값 미기록·미출력). `LLM_MODEL` 한 줄만 `gpt-6.1-sol` → `gpt-6-luna`로 바꿈. 제출 전 원래 모델로 되돌릴지는 사용자 결정 사항. `LLM_MAX_OUTPUT_TOKENS=256`은 연결 점검용 기본값이며 답변/코치는 호출부에서 2000/3000을 넘기므로 그대로 둠.
  - `.claude/launch.json`에 `api-mac`(backend/.venv/bin/python, 8000) 추가. Windows 설정은 유지.
- 검증(실제 실행):
  - 백엔드 unittest 37개 OK(프롬프트 수정 전후 모두).
  - `scripts.check_providers`: 생성 ok(gpt-6-luna), 임베딩 ok(3072차원).
  - `scripts.prepare_corpus`: knowledge_items 100 / reference_chunks 221, 문서 189, HTTP 16회, 임베딩 11배치, 46초. `backend/data/chroma`(Git 제외).
  - `/api/health`: 생성·임베딩 configured, rag_status pilot_ready. 5173 프록시 경유도 동일.
- 실제 코치 실측(브라우저, 유료 호출 4회 + 연결 점검 1회):
  1. 디스크 실습, `systemctl status nginx`·`df -h` 후 "마지막 출력 해석": 19초. 실습 기록 2건·문서 근거 1건(ENOSPC). 사실/가설/다음 점검 구분, 원인 단정 없음. 제안 2개 모두 버튼 → `du -h /var/log/nginx` 실행 성공(12M).
  2. "내 가설 점검"(다른 로그 디렉터리 가설): 16초. 이전 대화와 실습 기록 3(du 12M)을 인용. **suggested_checks가 비어 버튼 0개** → 아래 프롬프트 수정의 계기.
  3. 프롬프트 수정 후 "다음 점검": 13초. 제안 `du -h /var/log`, `du -h /var` 모두 버튼. 버튼 → Enter → `/var/log/app 5.9G` 단서 확인(정답을 말하지 않고 플레이어가 찾게 됨).
  4. ALB 실습, `aws elbv2 describe-target-groups` 후 "다음 점검": 20초. 문서 근거 2건으로 fail-open을 설명하며 "사이트가 열린다고 오탐이 아니다, 알람 끄기 보류" — 시나리오 설명과 일치. 제안 2개 버튼.
  - 서버 오류 로그 없음.
- 이번 변경 파일:
  - `backend/app/prompts.py` COACH: suggested_checks를 1~3개, 각 항목 맨 앞에 백틱 명령 하나, 파이프·리다이렉션 없이, 결과를 미리 말하지 않도록 지시. `backend/app/coach.py` PROMPT_VERSION coach-1 → **coach-2**(코치 캐시 무효화).
  - `src/ui/answerFormat.ts`(새), `src/ui/components/RichAnswer.tsx`(새): 실제 답변이 `###`·`-`·백틱 Markdown이라 그대로 보이던 문제. 제목·목록·코드·[실습 기록 N]/[근거 N] 칩으로 그린다. HTML을 해석하지 않고 React 요소만 사용(`dangerouslySetInnerHTML` 없음). `CoachTurn.tsx`·`coach.css` 적용.
  - `tests/answer-format.test.ts`(새, 3개). vitest 총 **249개 통과**, typecheck·build 통과.
  - `backend/README.md` Mac 검증 문구 갱신. 증빙 `evidence/coach-in-play/real-disk-answer1.jpg`, `real-disk-next-checks.jpg`.
- 남은 문제(재현 방법 포함):
  - ALB 실습에서 코치가 `aws cloudwatch describe-alarms …`를 제안 → 버튼이 나오지만 가상 엔진은 `Unknown service: cloudwatch`(exit≠0). 원인: 버튼 판별과 서버 `unsupported_commands` 모두 명령 이름(`aws`)만 보고 하위 서비스는 보지 않음. 해결 후보: 엔진이 aws 지원 서비스/하위 명령 목록을 내보내고 요청의 available_commands에 담기(요청 계약 변경) 또는 프롬프트에 지원 서비스 명시.
  - 지식 탐색 화면(KnowledgeScreen)의 답변은 여전히 Markdown 원문 표시. RichAnswer 재사용 가능.
  - 코치 대화는 실습 화면을 떠나면 사라진다(리포트 미포함).
- 실행 중: 5173 Vite(미리보기 `dev`), 8000 백엔드(미리보기 `api-mac`).
- 커밋: 하지 않음.
- 사용자 결정 대기: 다음 작업 방향, 제출 전 LLM_MODEL 복원 여부.

## 이전 상태 — 실습 중 코치 적극 사용 UI (2026-10-21 20시대, Mac)

- 사용자 요청: "실습 중에도 RAG 코치를 적극적으로 사용할 수 있었으면 좋겠다", 켜져 있던 로컬 서버를 모두 끄고 다시 실행.
- 변경 파일과 이유:
  - `src/ui/components/Sidebar.tsx`: 티켓 아래에 탭 [AI 코치 | 조사 현황(힌트 n/3)]을 두고 코치를 기본 탭으로 했다. 탭을 바꿔도 대화는 유지되고(hidden만 사용), 다른 탭을 보는 동안 답변이 오면 ● 배지를 띄운다. 980px 이하에서는 떠 있는 "AI 코치" 바로가기 버튼이 나온다.
  - `src/ui/components/CoachPanel.tsx`: 연결 상태 표시(health로 온라인/설정 필요/오프라인, 다시 연결), 빠른 질문 4개(지금까지 정리·다음 점검·마지막 출력 해석·내 가설 점검), 오답 또는 마지막 질문 뒤 명령 6회 이상이면 "코치와 정리하기" 권유, ⌘/Ctrl+Enter 전송, 학습 주제 선택은 접어 둠. 서버 요청은 기존 `buildCoachRequest` 그대로라 보내는 필드는 바뀌지 않았다.
  - `src/ui/components/CoachTurn.tsx`(새 파일): 답변 한 턴. 제안 점검의 백틱 명령 중 이 실습에서 쓸 수 있는 것만 "터미널에 입력" 버튼으로 보여 준다. 입력줄에 넣고 포커스만 하며, 실행은 플레이어가 Enter로 한다.
  - `src/ui/coachPrompts.ts`(새 파일): 빠른 질문·명령 추출(`runnableCommands`: 사용 가능 명령만, sudo 허용, 파이프·리다이렉션·`;`·`&` 제외)·권유(`coachNudge`) 순수 함수.
  - `src/ui/components/Terminal.tsx`, `src/ui/screens/PlayScreen.tsx`: `draft {text, nonce}` prop으로 바깥에서 입력줄을 채운다.
  - `src/ui/coach.css`(새 파일, App에서 import): 코치 채널 스타일, 사이드바 폭 `clamp(320px, 29vw, 410px)`. 애니메이션은 기존 모션 정지/`prefers-reduced-motion` 규칙을 따른다.
  - `tests/coach-prompts.test.ts`(새 파일, 21개): 빠른 질문에 13개 시나리오 정답 보기·answerId·풀이 명령이 들어가지 않는지, 명령 추출 규칙, 권유 조건.
- 실행한 명령과 결과(이번 Mac에서 실제 실행):
  - `npm test`: 11개 파일, **246개 통과**. `npm run typecheck` 통과. `npm run build` 성공.
  - 기존 Vite(5173, PID 29653/29669, 이전 작업에서 띄운 것)를 종료하고 미리보기 도구 `dev`로 5173을 다시 띄웠다. 8000 백엔드는 원래 없었다.
  - 브라우저(1440×900): 백엔드 없음 → 코치 "오프라인"과 다시 연결 표시, 게임은 정상.
  - 브라우저에서 **fetch를 페이지 안에서 임시 가짜 응답으로 바꿔** UI 흐름만 확인했다(코드 변경 아님, 확인 후 새로고침으로 제거): 다시 연결 → 온라인, "마지막 출력 해석" 질문 문장에 `df -h` 포함, 진행 단계 표시, 제안 4개 중 실행 가능한 3개만 버튼(`lsof +L1 (실제 환경 참고)` 제외), 버튼 → 터미널 입력줄 채움·포커스·미실행, Enter로 실행, 명령 6회 뒤 권유 표시, 질문 직후 조사 현황 탭으로 옮기면 ● 배지 → 코치 탭으로 돌아오면 해제, 두 번째 질문에 이전 대화 2개 포함. 실제 전송 본문의 키는 기존 허용 9개뿐이고 faults/answerId/solutionPath/postmortem/state 없음.
  - 모바일(375×812): 가로 넘침 없음, 떠 있는 "AI 코치" 버튼으로 코치 패널 이동 확인.
  - 증빙: `evidence/coach-in-play/` (offline.jpg, desktop-answer-mock.jpg, mobile-coach-mock.jpg — 뒤 두 장은 가짜 응답 화면임).
- 미검증: **실제 RAG 코치 답변**. 이 Mac에는 `backend/.venv`가 없고 Python 3.11도 없으며(기본 3.14.7), `backend/.env`의 `GMS_KEY`가 비어 있고 `backend/data` 색인도 없다. 실제 답변의 길이·명령 표기(백틱 여부)에 따라 "터미널에 입력" 버튼 수가 달라질 수 있다.
- 알려진 한계: 코치가 `du -sh /var/log/*`처럼 글롭을 제안하면 버튼은 나오지만 가상 셸의 글롭 지원 여부는 확인하지 않았다. 코치 대화는 실습 화면을 떠나면 사라진다(리포트에 남지 않음).
- 실행 중: 5173 Vite(미리보기 도구 관리). 백엔드 없음.
- 커밋: 하지 않음. 이번 변경과 이전 서버실 UI 작업 변경이 모두 작업 트리에 남아 있다.
- 사용자에게 아직 답을 받지 못한 것: 다음 작업 방향(사용자가 완료 후 토론을 요청함).
- 다음 도우미가 바로 할 일: 사용자와 다음 방향을 정한다. 후보는 ① Python 3.11 백엔드 설치 + 사용자가 키 입력 → 색인 → 실제 코치로 이 UI 검증 ② 코치 대화를 리포트·학습 기록에 남기기 ③ 커밋 정리.

## 이전 상태 — 서버실 UI 초안 및 프론트 안정화 (2026-10-21, Mac)

- 사용자 요청: MD 문서로 구조를 파악하고 키를 넣을 `.env` 준비, 서버실 느낌의 동적 UI를 우선 제작해 피드백 받기. 로컬 작업만 수행.
- `.env`, `backend/.env` 생성(키 공란, Git 제외). `npm run setup:env`는 기존 파일을 보존한다. 키는 사용자가 `backend/.env`의 `GMS_KEY`에 입력한다.
- 화면: 관제실 사이드바, CSS 서버 랙/LED/패킷 모션, 카테고리·검색·난이도 필터, 학습 기록, 터미널 창, 모션 정지·모션 줄이기 대응, 모바일 메뉴 접근성.
- 안정화: 손상된 localStorage 레코드 제외, health 응답 중첩 필드 검증, 원인 보기 판별 셔플/재개 시 순서 유지, native dialog의 Escape/포커스 복귀, 한글 IME Enter 중복 실행 방지, Shift+Tab 탈출, 화면 전환 시 스크롤 복귀.
- 의존성: Vite 7.3.7 / Vitest 4.1.12 / source-map-js 1.2.2. 런타임 라이브러리 추가 없음. npm audit 5건 → 0건.
- 검증: Vitest 214개, typecheck/build 성공. 브라우저 검색·필터·결과 없음·지식 오프라인 안내 확인. 디스크 장애 실제 UI 풀이 → S/1000점 → 학습 기록 반영. 1440px/390px 반응형에서 가로 넘침 없음.
- 이 Mac의 기본 Python은 3.14.7이며 backend/.venv는 없음. Python 3.11 기준 실행 절차만 문서화했다. 백엔드 테스트/유료 API/색인 생성은 이번에 수행하지 않았다. 아래 Windows 결과를 이번 환경의 성공 증거로 사용하지 말 것.
- 변경 상세·스크린샷: `10_서버실_UI_및_안정화.md`, `evidence/server-room/`.
- 다음 작업: 사용자 디자인 피드백 반영. 이후 Python 3.11 백엔드 설치 및 사용자가 키를 입력한 뒤 RAG 연결·100건 색인 검증. 공급자 5xx 재시도와 추가 코치 품질 검증은 미완료.

## 이전 상태 — ALB 실습 fail-open 정합성 수정 (2026-10-21 18시대, 아래 기록보다 우선)

- 문제: 실습 `aws-alb-healthcheck`가 "모든 타깃 unhealthy → 503"을 전제로 했다. AWS 문서(target-group-health-checks)에 따르면 모든 활성 AZ의 모든 타깃이 헬스체크에 실패하면 ALB는 fail-open한다. 그래서 코치(공식 문서 근거)와 실습 설명이 반대되는 말을 할 수 있었다.
- 선택: 원인(헬스체크 경로 /healthz), 장애 주입, 모범 풀이, 복구 판정, ID는 유지하고 증상을 공식 동작으로 바꿨다(B안). 엔진에 타깃 등록 기능을 추가해야 하는 "등록 타깃 없음" 시나리오(A안)는 택하지 않았다.
- 시나리오 변경(`src/scenarios/aws-alb-healthcheck.ts`):
  - 제목 "헬스 알람이 울리는데 사이트는 열려요".
  - 티켓: HealthyHostCount=0 알람이 울리는데 사이트는 정상이다, 꺼도 되나?
  - 로그: HealthyHostCount=0, UnHealthyHostCount=1, Target 2XX 정상. ELB_503 로그는 제거했다.
  - 학습 목표, 오답 보기("오탐", "타깃 없음이면 503"), 힌트 3단계, 포스트모템(fail-open과 그 위험, 503의 공식 원인, 출처)을 새로 썼다.
- 엔진 변경:
  - 중지·종료 타깃의 unused 사유를 Target.NotInUse에서 Target.InvalidState로 바꿨다(공식 상태 표).
  - `requestInstance`: bastion→EC2 HTTP(80) 응답을 상태에서 계산한다. 인스턴스 중지나 보안그룹(소스 IP CIDR) 차단이면 timeout, 서빙 경로면 200, 아니면 404. 헬스체크와 같은 servedPaths를 쓴다.
  - curl: 값을 받는 옵션(--max-time 등)의 값을 URL로 읽던 버그를 고쳤고, `-i` 헤더+본문 출력과 응답 이유 문구(404 Not Found 등)를 추가했다.
- 검증:
  - vitest 197(새 테스트 4개: InvalidState, 실습 증상, curl 값 옵션, EC2 직접 요청), typecheck·build 통과.
  - 브라우저에서 처음부터 풀었다: /healthz 404, /health 200 → 경로 수정 → healthy → 오답 "오탐"의 해설에 fail-open → 정답 → 복구 완료(S, 910점). 포스트모템을 캡처했다(`docs/submission/evidence/T23_alb_failopen_postmortem.jpg`).
  - 같은 실습에서 코치 질문 1건(유료): 실습 기록 2건과 fail-open 근거를 인용하고 "사이트가 열린다는 것만으로 오탐이 아니니 알람을 끄지 말 것"이라고 답했다. 실습 설명과 일치한다.
  - 코치가 제안한 `curl -i --max-time 5 …`가 처음에 엔진 버그로 실패한 것을 계기로 위 curl 수정을 했다.
- 문서: 제출 문서(요구사항 5절, 설계 9·10절, 검증 T23·테스트 수), README 시나리오 표·한계·테스트 수를 갱신했다.
- 새로 발견(미수정): 13개 실습 모두 정답 보기가 첫 번째이고 CauseDialog가 순서를 섞지 않는다. TASKS에 추가했다.

## 최신 상태 — 제출 문서 정리 (2026-10-21 18시대, 아래 기록보다 우선)

- 위치 결정: 제출물은 `docs/submission/`(Git 커밋 대상)에 둔다. `docs/infra-coach/`는 작업 기록용이라 미추적으로 유지한다. 증빙 캡처 6장, 평가 JSON 4개, 비교 보고서 3개(07·08·09)를 `docs/submission/`으로 복사했다(링크 경로 수정).
- 새 문서:
  - `docs/submission/요구사항정의서.md`: 도메인 조건 근거, F2001~F2016, NF, 게임 연결 G-01/02, 한계.
  - `docs/submission/RAG_파이프라인_설계문서.md`: 컬렉션·ID·수집 흐름·병합·프롬프트 4개·설정값과 비교·근거 표시·코치 설계 이유·겪은 문제 10건·한계.
  - `docs/submission/검증결과.md`: 자동 테스트 재실행 결과, T01~T23(부분: T10·T15·T20·T21·T23), 제출 전 점검, 상호·셀프 미실시 명시.
  - 루트 `THIRD_PARTY_NOTICES.md`.
- README:
  - 루트 상단을 실제 기능·필수/심화 구분·실행 절차·출처·한계로 교체하고, 테스트 수를 193으로 고쳤다.
  - `backend/README.md` 상단의 "파일럿" 설명을 갱신했다.
  - 루트에서 `unittest -s backend/tests`는 import 오류가 나서 backend 폴더에서 실행하는 명령으로 고쳤다(실행 확인).
- 재측정(문서 작성 직전): vitest 193, typecheck·build 통과, 백엔드 37 OK, pip check OK, validate_catalog failures 0, prepare_corpus 캐시 적중(HTTP·임베딩 0).
- 키 검사: 실제 키 값 문자열로 추적 파일·dist·docs·README를 검사해 0건이었다(키 값은 출력하지 않음).
- 사용자가 해야 할 것: 공식 셀프 체크리스트(3일차 오후) 작성, 동료 상호 점검, 제출 zip 구성(`AI코어프로젝트2_[주제명]_지역_반_성명.zip`), lab.ssafy.com 업로드(외부 업로드는 사용자 승인 사항).
- 남은 기술 과제(선택): ALB 실습 fail-open 불일치 수정, 5xx 1회 재시도 결정, 개선 프롬프트를 새 질문으로 확인, 한국어 주석 사람 검수, 새 폴더에서 README대로 처음부터 재현.

## 이전 상태 — 답변 프롬프트 조치 누락 수정 (2026-10-21 17시대, 아래 기록보다 우선)

- `prompts.ANSWER`: "필요한 한계만 간결하게 설명한다"를 지우고 규칙을 넣었다. 대응을 묻는 질문이면 인용한 근거의 조치·확인 방법·설정 변경을 모두 [근거 N]과 함께 쓰고, 근거에 없는 조치는 덧붙이지 않는다. `rag.PROMPT_VERSION` discovery-2(답변 캐시 무효화).
- `scripts/compare_rag.py`에 `--rag-only --output` 옵션을 넣었다. RAG 없음 기준 답변은 재사용한다.
- 실측(8000 서버 재시작 후, `data/evaluation/f2015_results_v2.json`, 사본 `docs/infra-coach/evaluation/`):
  - RAG 8문항 모두 정확(v1 정확 6·부분 2). Q2·Q3는 문서의 조치를 모두 인용했다.
  - Q9는 보류를 유지했다. 문서에 없는 조치를 추가한 경우는 0건이다.
  - 평균 25.7초(문항별 8.8~42.5초). 새 수집은 없었다(이미 색인됨).
  - 보고서 08의 5절에 추가했다. 채점은 개발 도우미가 했으므로 사람 검토가 필요하다.
- 테스트: 백엔드 37개 OK(프롬프트 문자열만 바뀌어 기존 테스트 영향 없음).
- 비용: RAG 9문항 재실행(생성 약 27회, 임베딩 9회). 토큰은 측정하지 않았다.
- 다음 한 가지 작업: 제출 문서 정리(요구사항 정의서, RAG 설계문서, 루트 README, 검증 결과표). 남은 결정 항목: 5xx 1회 재시도 여부, 개선 프롬프트를 새 질문으로 확인하는 일.

## 이전 상태 — 청크 크기·Top-k 비교 (2026-10-21 17시대, 아래 기록보다 우선)

- `scripts/compare_settings.py`: 실험 색인 `data/chroma-exp-700/-1000/-1400`(서비스 `chroma-v2`와 분리). 질문 8개로 검색만 비교하고(핵심 원문 문구 15개 포함 여부), Top-k 2/4/6을 비교했다. `--generate`면 Q2·Q3·Q4 답변까지 만든다.
- 결과(실측, 보고서 `09_청크_TopK_비교.md`, 원본 `docs/infra-coach/evaluation/settings_comparison.json`):
  - 청크 수: 700→247, 1000→221, 1400→214(중복 200 고정). 핵심 문구: 13/12/13. 차이는 Q1 헬스체크 문서의 청크 경계 하나 때문이다.
  - Top-k(청크 1000): 2/4/6 → 핵심 문구 12/12/13, 근거 글자 5,711/9,886/11,666.
  - Q7·Q8의 두 번째 문구는 모든 설정에서 빠졌다(다른 항목 문서이며, F2004로 해결).
  - 생성: Q2·Q3·Q4는 k와 무관하게 근거 2건이었다. Q2·Q3의 조치 누락은 근거 청크 안에 조치 문장이 있는데도 생긴 것이라 **답변 프롬프트 문제**다.
  - 결정: 1000/200/k=4를 유지한다.
- 함께 고친 것: 벡터 캐시 폴더 키를 `embedding_identity`(공급자·모델·정규화)로 바꿨다. 이전에는 청크 설정까지 들어 있어 설정만 바꿔도 다시 임베딩했다. 기존 벡터 338개를 새 폴더로 복사했고 이전 폴더는 보존했다. 테스트 `VectorCacheTests`를 추가했고, 서비스 색인 재실행은 임베딩 0회였다.
- 비용: 새 청크 임베딩 76개(호출 11회), 질문 임베딩 1회, 생성 비교 6건.
- 검증: 백엔드 37개 OK.
- 다음 한 가지 작업: 제출 문서 정리(요구사항 정의서, RAG 파이프라인 설계문서, 루트 README 실행 방법, 검증 결과표 T-xxx). 그 전에 TASKS의 결정 항목(답변 프롬프트 조치 누락, 5xx 재시도) 처리 여부를 사용자에게 확인한다.

## 이전 상태 — F2015 RAG 전후 비교 (2026-10-21 17시대, 아래 기록보다 우선)

- 질문 9개(문서 안 8, 문서 밖 1)의 정답 기준을 실행 전에 원문으로 작성했다: `backend/evaluation/f2015_questions.json`(커밋 대상).
- 실행: `scripts/compare_rag.py`. RAG 없음은 같은 모델에 질문과 중립 지시만 보내고, RAG 있음은 8000 서버 `/api/chat`을 쓴다.
  - 결과 원본: `backend/data/evaluation/f2015_results.json`, 사본은 `docs/infra-coach/evaluation/`.
  - RAG 없음 Q2가 GMS 502로 실패해 1회 다시 실행했다(기록함).
- 결과(채점자: 개발 도우미, 사람 검토 필요):
  - 문서 안 8문항 정확성: RAG 없음 정확 7·부분 1(Q7 nr_open 누락), RAG 정확 6·부분 2(Q2·Q3 조치 생략). 오답은 양쪽 모두 0.
  - 근거 제시: RAG 없음 0/8, RAG 8/8.
  - Q9(문서 밖): RAG 없음은 수치를 단정했고, RAG는 보류했다.
  - 우리 문서로 확인할 수 없는 추가 주장: RAG 없음 5/8, RAG 0/8.
  - 응답 시간 평균: 11.9초 vs 23.2초.
  - Q5·Q7에서 F2004가 질문 중 문서(curl --fail·--fail-with-body, errno ENFILE)를 수집해 정확도에 기여했다.
- 결론(보고서 08): 이 모델·표본에서는 정확도 향상을 주장할 수 없다. 차이는 검증 가능성, 보류, 범위 준수이고, 대가는 지연 약 2배와 일부 조치 생략이다.
- 다음 한 가지 작업: 청크 크기(700/1000/1400)·Top-k(2/4/6) 설정 변경 비교(F2005/F2006 검증 항목, 과제 산출물 "값을 바꿨을 때의 차이"). 청크 변경은 새 CHROMA_PATH에 재색인이 필요하다(유료 임베딩 소량). 이어서 제출 문서(요구사항 정의서·RAG 설계문서·README) 정리.

## 이전 상태 — F2012 안내·F2009 격리 증빙 (2026-10-21 16:35~17:00, 아래 기록보다 우선)

- 변경:
  - BackendStatus: 누락된 환경변수 이름과 `backend/.env`·`GMS_KEY` 안내, 색인이 없거나 설정이 맞지 않을 때 `scripts.prepare_corpus` 명령을 안내한다. 문구 "파일럿"을 제거했다.
  - jobs 안내 문구: index_not_ready, provider_not_configured를 구체적으로 바꿨다.
  - 지식 답변에 "이번 질문에서 새로 수집·색인한 공식 문서" 제목을 표시한다(rag 결과 `collected_documents`).
  - 면책 문구를 보강했다(실제 운영 환경의 진단·복구 판단을 대신하지 않음).
  - `src/ui/chatHistory.ts`(`historyFor`)로 분리하고 vitest 3개를 추가했다.
  - providers: 실패 시 서버 로그 `infracoach.providers`에 예외 종류와 HTTP 상태만 남긴다(키·메시지 제외, test_foundation에서 확인).
  - `.claude/launch.json`에 오류 상태 재현용 `api-empty-nokey`, `api-index-nokey`, `dev-5174-to-8001`을 추가했다.
- 증빙: `docs/infra-coach/07_화면증빙_F2009_F2012.md`, `docs/infra-coach/evidence/` 캡처 6장. 표의 모든 항목이 통과이며, 진행 단계는 일부만 화면에 포착됐다.
- F2009 실측: 실제 `/api/chat` 요청 본문을 확인했다.
  - 다른 항목으로 바꾸면 history가 0개다.
  - 같은 항목으로 돌아오면 그 항목의 완료된 대화만 들어간다(실패한 턴은 제외).
  - 화면에서도 항목별 대화가 유지·분리됐다.
- 관찰된 외부 오류: GMS 생성 1회 실패(원인 미기록), 임베딩 `InternalServerError status=502` 1회. 다시 시도하자 둘 다 성공했다. 자동 재시도 0회 정책은 유지했고, 5xx 1회 재시도 여부는 TASKS에 결정 항목으로 남겼다.
- 검증: 백엔드 36개 OK, vitest 193, typecheck, build 통과.
- 비용: 이번 작업에서 새 질문 4건(그중 실패 2건)과 연결 점검 1회를 호출했다. 토큰 사용량은 측정하지 않았다.
- 실행 중 프로세스: 8000(api, 미리보기 관리), 5173(기존 Vite). 임시 8001·5174는 종료했다.
- 다음 한 가지 작업: F2015 RAG 전후 비교(질문 5개 이상, 같은 모델로 문서 제공 여부만 바꿈). 이어서 청크 크기·Top-k 설정 비교(F2005/F2006 검증 항목)와 제출 문서 정리.

## 이전 상태 — F2010 공개 실습 기록 기반 게임 코치 (2026-10-21 16:05~16:35, 아래 기록보다 우선)

- 구현:
  - 프론트 `src/api/coach.ts`의 `buildCoachRequest`: Session에서 허용 필드만 골라 새 객체를 만든다.
    - 보내는 것: 티켓, 연 힌트만, 직접 입력한 명령의 stdout·stderr·exit_code(최근 30개, 생략 개수 표시), 사용 가능 명령 목록, 무작위 session_id(crypto.randomUUID), 선택한 주제 항목(선택 사항), 최근 대화 3회.
    - 긴 출력은 앞 55%와 뒤를 남기고 "[중간 N자 생략]"으로 표시한다.
    - 시나리오 ID·제목·학습 목표·정답·보기·풀이·state·포스트모템은 넣지 않는다.
  - React `CoachPanel`(실습 사이드바, 힌트 아래): 주제 선택(기본은 자동), 진행 단계, 답변, 인용한 실습 기록, 문서 근거를 보여 준다. 실습 판마다 대화를 새로 시작한다.
  - 서버 `CoachRequest`: extra=forbid라 faults·answerId·solutionPath·state·postmortem·scenario_id는 422로 거부하고 입력값을 응답에 되돌려 보내지 않는다. 길이·개수 상한이 있고, 없는 item_id는 404.
  - `app/coach.py`: 검색어(프롬프트 1) → retrieve(선택 항목, 또는 질문+검색어 임베딩으로 knowledge_items 상위 3개와 그 청크 Top-k) → generate(`prompts.COACH`, 프롬프트 3의 훈련 모드).
    - 숨겨진 시나리오-항목 연결은 쓰지 않는다.
    - [근거 N]과 [실습 기록 N] 번호를 모두 검증하고, 실패하면 1회 다시 요청한 뒤 citation_validation_failed로 처리한다.
    - 제안에 지원하지 않는 명령이 있는데 "실제 환경 참고" 표시가 없으면 경고한다.
    - 결과 캐시는 `data/coach`, PROMPT_VERSION=coach-1.
  - API `POST /api/coach` → job_id.
- 테스트:
  - vitest `tests/coach.test.ts` 15개: 13개 시나리오 각각에서 힌트 1개를 열고 명령 1개를 실행한 뒤 요청을 만들어, 허용 키만 있는지, 열지 않은 힌트·입력하지 않은 풀이 명령·정답 ID·보기·whyWrong·학습 목표·포스트모템·시나리오 ID/제목이 없는지 검사한다. 시나리오마다 검사할 비공개 문자열이 6개 이상인지도 확인한다. 긴 출력 앞뒤 보존과 30개 제한도 검사한다.
  - 백엔드 test_coach 5개: 비공개 필드 거부, 관찰 번호, 두 종류 인용 검증, 지원하지 않는 명령 감지, 파이프라인(retrieve→generate·자동 항목 3개·캐시).
  - 전체: 백엔드 36개 OK, vitest 190, typecheck, build 통과.
- 실측(브라우저, 디스크 가득 참 실습, 힌트 0개): `systemctl status nginx`, `journalctl -u nginx -n 20`, `df -h`를 실행한 뒤 "지금까지 본 것으로 다음에 무엇을 확인하면 좋을까요?"라고 물었다.
  - 검색어: nginx open() No space left on device 등. 자동 항목: ENOSPC, EMFILE, ENFILE.
  - 답변이 "확인된 사실 / 가설 / 다음 확인"으로 나뉘었다. 인용은 실습 기록 3건, 근거 1건(errno(3) ENOSPC).
  - 원인을 단정하지 않았다(access.log가 원인이라고 단정할 수 없다고 명시). 다음 점검으로 `du -xhd1 /`, `/var`, `/var/log` 순서를 제시했다.
  - 제안한 `du -xhd1 /`는 가상 터미널에서 실행됐다(/var/log/app 5.9G 확인). 엔진의 du는 깊이 옵션을 무시하고 전체를 출력한다.
  - 소요 시간은 따로 재지 않았다(UI 대기 60초 안에 완료).
- 한계:
  - 실측은 디스크 실습 1개, 힌트 0단계뿐이다. 힌트 단계별 차이와 네트워크·ALB 실습은 아직 보지 않았다.
  - 명령 지원 검사는 명령 이름만 본다(옵션 지원 여부는 검사하지 않음). 답변 본문 속 명령은 검사하지 않는다.
  - 브라우저 게임 코드에 정답 데이터가 들어 있는 구조는 그대로다. 목표는 코치(서버·LLM)로 정답이 전달되지 않게 하는 것이다(02 명세 §3.3).
- 다음 한 가지 작업: F2012 상태·오류 안내 화면 증빙(키 누락·색인 0건·검색 결과 없음)과 F2009 항목별 대화 격리 확인. 이어서 F2015 RAG 전후 비교(질문 5개 이상).

## 이전 상태 — F2011 조건 기반 항목 탐색 (2026-10-21 15:40~16:05, 아래 기록보다 우선)

- 구현:
  - `app/explore.py`가 하는 일:
    - 명시 조건 추출: 제품(curl/Linux/AWS ALB)과 카탈로그에 실제로 있는 오류 코드만 뽑는다. 한글 조사가 붙어도 인식하도록 영문·숫자 경계를 쓴다.
    - 후보: 코드 조건이 있으면 그 코드를 가진 항목을 그대로 쓴다(임베딩 없음). 없으면 knowledge_items 의미 검색 20건에 제품 where 필터를 건다.
    - 판정: 프롬프트 4(`prompts.EXPLORE`)가 공개 메타데이터만 보고 판정한다. 후보 밖 ID는 거부하고, 판정 뒤에도 명시 조건을 어긴 항목은 제외해 `rejected_by_filter`에 기록한다.
    - 결과 캐시(`data/explore`, 키는 질의+corpus_hash+모델+PROMPT_VERSION=explore-2).
  - API `POST /api/items/search` {query}는 202 job_id를 돌려준다. 결과는 기존 `/api/jobs/{id}`로 받는다. 추가 필드는 422로 거부하며 입력값을 응답에 되돌려 보내지 않는다.
  - React `ConditionSearch.tsx`: 진행 단계, 결과 카드(제품·작성자 분류·이유), 적용한 필터, 판정 불가 조건, 결과 없음 안내를 표시한다. 카드를 누르면 그 항목 대화가 열린다.
  - 프롬프트는 이제 4개다(검색어·선별·답변·조건 판정). 과제의 세 프롬프트에 탐색 판정용 1개를 더했다.
- 데이터 수정: ALB 항목 `error_codes`가 절 이름(`http-503-issues`)으로 들어가 있던 오류를 고쳤다. 지금은 HTTP 상태 코드(503 등)만 넣고, 상태 코드가 없는 절은 빈 배열이다. corpus_hash가 바뀌어 새 경로 `data/chroma-v2`에 다시 색인했다(임베딩 호출 2회, 새 텍스트 20개, HTTP 0. 재실행 0회·건수 100/221 불변). `.env` CHROMA_PATH=data/chroma-v2. 이전 경로 chroma-100·chroma는 보존했다. chroma-100에서 질문 중 수집했던 EDQUOT 청크는 v2에는 없고, 다음 질문 때 다시 수집된다(벡터 캐시가 있어 임베딩 비용 없음).
- 실측(8000 서버 API, 각 조건 생성 1회 + 코드 조건이 없으면 임베딩 1회):

  | 조건 | 적용 필터 | 결과 | 조건 위반 |
  |---|---|---|---|
  | curl에서 TLS 인증서 검증과 관련된 오류 | curl | curl-60, 91, 77, 90, 82 (10.8초) | 0 |
  | 리눅스에서 디스크 공간이나 할당량이 부족할 때 나는 오류 | Linux | ENOSPC, EDQUOT (5.5초) | 0 |
  | ALB에서 타깃과의 연결 문제로 생기는 5xx 오류 중 초급자용 | AWS ALB | 502, 504 (9.1초). "초급자용"은 판정 불가로 표시 | 0 |
  | HTTP 503 오류 | 코드 503 | aws-alb-http-503-issues (3.0초) | 0 |
  | 데이터베이스 교착 상태 오류 | 없음 | 0건 + 결과 없음 안내 (4.0초) | - |

  같은 조건 반복은 0.0초, 캐시. 첫 실행에서 "curl에서", "ALB에서"가 제품 필터에 걸리지 않는 버그를 발견해 고쳤고, 위 표는 수정 후 결과다. 수정 전에도 LLM 판정 결과에는 위반이 없었다.
- 화면 확인: 조건 탐색에서 카드 2건, 필터 "AWS ALB", 판정 불가 조건이 표시됐고, 카드를 누르면 "ALB HTTP 504 오류" 대화로 이동했다. 처음에는 StrictMode 재마운트 때문에 결과를 조회하지 않는 버그가 있어 수정했다.
- 검증: 백엔드 31개 OK(test_explore 6개 추가), vitest 175, typecheck, build 통과.
- 한계: 판정 품질은 질의 5개로만 봤다. 정답 조건표 기반 재현율(빠진 항목, 예: curl-35·58·98을 "인증서 검증"에 넣을지)은 판단 기준을 정하지 않았다. 과제의 검증 기준인 "조건과 맞지 않는 항목이 섞이지 않는지"만 확인했다.
- 다음 한 가지 작업: F2010 공개 실습 기록 기반 게임 코치(필수). 정답 정보(faults·answerId·solutionPath·state)를 보내지 않는 요청 계약부터 시작한다.

## 이전 상태 — F2004 외부 후보 검색 (2026-10-21 15:20~15:40, 아래 기록보다 우선)

- 설계: 02 명세 §4의 "공식 문서 카탈로그" 방식이다. 새 출처(위키백과 등)는 추가하지 않았다. 후보는 `sources.json`에 등록한 공식 페이지 8개의 절에서만 나오며, 모델은 URL을 만들 수 없다.
- 구현:
  - `scripts/build_section_catalog.py` → `catalog/section_catalog.json`: 669개 절(curl 매뉴얼 365, libcurl CURLE 87, errno 127, connect 16, open 26, write 12, ALB 문제 해결 32, 헬스체크 4)과 version 해시를 만든다. 원문 캐시만 써서 HTTP 0회. 이미 카탈로그에 있는 (URL, 절)은 같은 doc_id를 재사용한다.
  - `app/discovery.py`의 역할:
    - 검색어 토큰과 제목·요약을 맞춰 보는 키워드 후보 검색(`CANDIDATE_LIMIT`=8).
    - 프롬프트 2 입력은 제목·요약·제품만 보낸다.
    - 후보 밖의 ID는 거부하고, 자체 문서를 맨 앞에 강제로 넣는다. 추가 문서는 최대 `MAX_SELECTED_DOCUMENTS`=4개.
    - 이 항목으로 색인되지 않은 문서만 수집·청킹·임베딩한다(metadata `origin=query_selected`).
    - 검색어 캐시: 항목+정규화 검색어+카탈로그 버전이 키다(`data/corpus/query_cache`).
  - `corpus.py`: `chunk_rows`·`cached_vectors`로 분리했다(corpus_hash 불변 확인). `prepare` 캐시 판정을 건수 대신 기본 청크 ID 존재로 바꿔, 질문 중 추가된 청크가 있어도 다시 색인하지 않는다.
  - `rag.py`: PROMPT_VERSION=discovery-1. 이전 답변 캐시는 쓰지 않는다. trace에 candidate/selected/excluded/collected_ids, 이유, 수집 임베딩 호출 수를 남긴다. 진행 단계 `select_cache`·`collect`를 추가했고 React 진행 문구에도 반영했다.
  - jobs: 출처 오류(절 없음·HTTP 오류·429·robots 거부)를 안전한 사용자 문구로 바꾼다.
- 실행 검증(실측, 8000 서버 API, data/chroma-100):
  - Q1 "write에서 ENOSPC와 EDQUOT는 각각 어떤 조건에서 발생하나요?" (항목 ENOSPC): 18.2초. 단계는 search_terms→select_documents→collect→retrieve→generate. 후보 11개 중 선정 3개(errno ENOSPC, write ENOSPC, write EDQUOT), 제외 8개는 이유를 기록했다(curl-exit-70은 다른 제품이라 제외 등). 새 수집은 linux-write-EDQUOT이다. 본문 HTTP 0회(캐시), 임베딩 0회(같은 본문 벡터가 이미 캐시에 있음). 인용 2건이며, 그중 1건이 질문 중 수집한 문서다. 이전(F2004 전)에는 EDQUOT 조건을 "확인되지 않음"으로 보류했던 질문이다.
  - Q1 반복: 0.0초, 답변 캐시.
  - Q2(표현을 바꾼 질문): 검색어가 달라 검색어 캐시는 미적중. 선별 결과는 같은 3개, 재수집 0, 임베딩 0, 벡터 캐시 파일 수 316 그대로.
  - 화면(5173): Q1 답변과 근거 카드 "write(2) ERRORS: EDQUOT"가 표시됐다.
  - 한계: 실측에서는 새 본문 임베딩이 실제로 발생하는 경우(벡터 캐시에 없는 문서)를 겪지 않았다. 이 경로는 단위 테스트로만 확인했다.
- 테스트: 백엔드 25개(test_discovery 4개 추가) 3회 연속 OK. 게임 vitest 175 통과, typecheck 통과.
  - 간헐 실패: Chroma `InternalError: Error creating hnsw segment reader: Nothing found on disk`. 색인 직후 다른 클라이언트로 다시 여는 테스트에서 1/18회 관찰했다. 같은 벡터만 쓰던 테스트 고정값(다른 원인)은 문서별로 다른 벡터로 고쳤다. 고친 뒤 test_rag 30회 연속 통과. 근본 원인(Chroma 디스크 반영 시점)은 미해결이다.
- 시험 데이터 정리: 첫 시험에서 제목이 원문 첫 줄로 나와 man 페이지 절 제목 형식을 고쳤다. 그 시험에서 만든 query_selected 청크 1개, 답변 캐시 1개, 검색어 캐시 1개를 지우고 다시 실행했다.
- 8000 서버: 코드 반영을 위해 미리보기 `api`로 두 번 재시작했다. 실행 중이다.
- 다음 한 가지 작업: TASKS 순서상 F2005/F2006 설정 변경 비교(청크 크기·Top-k)다. 기능 공백으로는 F2011 조건 탐색과 F2010 실습 코치가 남았다. 일정상 F2011을 먼저 하자고 제안한다.

## 이전 상태 — 100건 색인 (2026-10-21 15:13~15:20, 아래 기록보다 우선)

- 사용자 승인 후 `CHROMA_PATH=data/chroma-100`으로 `scripts.prepare_corpus` 실행(실측):
  - 1회차: knowledge_items 100, reference_chunks 221, 원문 문서 189, corpus_hash 542fda4d…, 3,072차원, 소요 약 17초.
  - 임베딩 API 호출 11회(`embedding_batches`, 32건 단위 배치). 벡터 캐시 파일 42 → 316(새 임베딩 텍스트 274개). 나머지 47행은 같은 텍스트라 캐시를 재사용했다. 토큰 사용량은 수집하지 않아 크레딧 소모는 미측정.
  - HTTP 2회(kernel.org robots.txt와 이용 조건 페이지; robots.txt 404).
  - 2회차: 건수 동일, HTTP 0, 임베딩 0, cache_hit true.
  - 청크 길이: 최소 20 / 최대 996 / 평균 278자, 청크 ID 중복 없음, 100개 항목 모두 청크 보유. 제품별 청크 curl 96 / Linux 82 / ALB 43.
- 실제 질문 1건(신규 항목 linux-errno-ENOSPC, 생성 3회+임베딩 1회 유료): 15.2초. errno(3)·write(2) ENOSPC 근거 인용 3건. EDQUOT 상세 조건은 "원문에서 확인되지 않음"으로 보류했다(검색 범위가 선택 항목으로 제한되는 설계 때문). 선별 단계는 open(2) ENOSPC를 제외 사유와 함께 기록했다.
- `backend/.env`의 CHROMA_PATH를 `data/chroma-100`으로 바꿨다(이 줄만 변경). 임시 서버(8001, `.claude/launch.json`의 `api-8001`)로 확인: health 100/221, /api/items 100건, index_ready true, ENOSPC 질문은 캐시에서 응답. 확인 후 8001은 종료했다.
- 8000번 서버 재시작(사용자 요청): 기존 uvicorn 프로세스(PID 29860·31440)를 종료하고 `.claude/launch.json`의 `api` 설정으로 다시 띄웠다(Claude 앱 미리보기가 관리하며, 세션이 끝나면 다시 실행해야 할 수 있다). Vite 5173은 기존 프로세스 그대로다. 화면 실측: 상태 줄 "지식 100건", 지식 탭 항목 100개, ENOSPC 질문 → 근거 3건(항목 메타데이터/공식 상세 문서 구분, 라이선스 표시), 캐시 응답. 지식 화면 안내 문구 "10개 주제 파일럿"을 항목 수 기반 문구로 수정(typecheck 통과, 화면에서 "100개 주제" 확인).
- 기존 `data/chroma`(10건 파일럿)는 지우지 않고 보존했다.
- 알려진 작은 문제: man7 문서의 근거 URL에 붙는 `#ERRORS/ENOSPC` 같은 조각은 실제 HTML 앵커가 아니다(페이지는 열리지만 해당 위치로 이동하지 않음).
- 다음 한 가지 작업: TASKS 순서상 "수집/색인 스크립트·캐시·안정 ID(F2001~F2005)" 점검이다. 남은 핵심 공백은 F2004의 외부 후보 검색이다. 지금은 항목별로 미리 검토한 문서 안에서만 선별한다.

## 이전 상태 — 100건 카탈로그 (2026-10-21 15시대, 아래 기록보다 우선)

- 구현 완료:
  - `backend/catalog/`: 입력 `shortlist_100.json`(docs의 후보 목록 복사), `sources.json`(출처 8개·라이선스), `shared_documents.json`(curl 옵션·ALB 헬스체크 절), `annotations_ko.json`(한국어 제목·증상·요약·분류, LLM 보조 작성). 생성물 `items.json` 100건, `documents.json` 189개.
  - `app/catalog.py`: 하드코딩 10건 → JSON 로더(pydantic, 중복 ID·미등록 문서·주 문서 첫 순서 검사). 색인 텍스트에 원문 발췌(`source_excerpt`, 최대 600자) 포함.
  - `app/collectors.py`: man7.org 추출기(`h2절/오류이름` 단락, 같은 이름의 여러 조건 모두 수집), man-pages 버전 감지(6.19), charset 없는 응답을 UTF-8로 해석(AWS 문서의 깨진 대시 수정). Collector에 문서 목록 주입 가능.
  - `scripts/build_catalog.py`(생성), `scripts/validate_catalog.py`(검증), `tests/test_catalog.py` 5개.
- 실행 검증(실측):
  - `scripts.build_catalog`: items 100, documents 189, 주 문서 실패 0. 보조 문서 1건 제외(connect(2)에 EPERM 절 없음).
  - `scripts.validate_catalog`: 고유 100, curl 40/Linux 40/ALB 20, 보조 문서 있는 항목 74, 주 문서 80자 미만 70, 라이선스 curl 85·GPL-2.0-or-later 40·Linux-man-pages-copyleft 42·CC-BY-SA-4.0 22, failures 0, exit 0, HTTP 0(캐시).
  - 백엔드 unittest 21개 OK (연속 4회). 수정 직후 1회는 실패로 끝났으나 원인을 재현하지 못했다. 이후 연속 5회 통과.
- 결정:
  - `scenario_ids`는 모두 빈 배열이다. `/api/items`가 브라우저에 항목 전체를 주므로, 연결해 두면 실습 정답 힌트가 될 수 있다. 실습 코치(F2010) 작업에서 서버 전용 필드로 다룬다.
  - 한국어 요약에는 원문에 없는 원인·조치를 쓰지 않았다. "원문은 원인을 특정하지 않는다"를 명시했다. 사람 검수는 아직 하지 않았다.
- 출처 접근 기록(NF2006): man7.org robots.txt는 해당 경로를 허용한다. **주의:** 라이선스 확인용으로 git.kernel.org에서 man 소스 4개 머리말을 curl로 직접 받았는데, 이후 확인한 git.kernel.org robots.txt는 `User-agent: * Disallow: /`이다. 제품 수집기에는 git.kernel.org를 넣지 않았다. 앞으로 이 호스트는 자동 요청하지 않는다. 라이선스 근거는 그때 확인한 SPDX 표기다(errno.3 GPL-2.0-or-later, connect/open/write.2 Linux-man-pages-copyleft). 다만 `h=man-pages-6.19` 태그와 일치하는지는 확인하지 않았다(응답 .TH는 unreleased로 표시됨).
- 원문 캐시: AWS 2개·open.2 1개가 문자가 깨진 채로 저장되어 있어 다시 받았다. 이전 파일은 임시 폴더에 백업했다. 기존 10건 색인(data/chroma)은 깨진 대시가 포함된 이전 본문으로 만든 것이다.
- **현재 불일치:** 실행 중인 서버와 data/chroma는 10건 색인 그대로다. 카탈로그는 100건이므로 새로 추가된 90건을 선택하면 `selected_item_not_indexed`로 실패한다. `prepare_corpus`를 같은 경로로 실행하면 `corpus_changed_use_new_chroma_path`로 거부된다. 100건 색인은 새 `CHROMA_PATH`(예: data/chroma-100)에서 실행해야 하며 유료 임베딩이 필요하다(청크 수백 개 규모로 추정, 실측 전).
- 다음 한 가지 작업: 사용자 승인을 받은 뒤 새 경로에 100건을 색인한다. 재실행했을 때 건수가 변하지 않는지 확인하고, `.env`의 CHROMA_PATH를 바꾼 다음 서버를 재시작해 화면에서 확인한다.

## 이전 상태 — 10건 RAG 파일럿 (2026-10-21 15시, 아래 기록보다 우선)

이전 기록 이후 HANDOFF에 적히지 않은 파일럿 구현이 작업 트리에 있었다(미커밋). 이번에 실제 파일과 실행으로 확인하고 기록했다.

- 구현 완료(미커밋→이번 커밋 대상): `backend/app/` catalog(10항목·문서 허용 목록), collectors(robots·1초 간격·429 무재시도·원문 캐시·절 추출), corpus(두 컬렉션 색인·manifest·벡터 캐시), prompts(3종), rag(검색어→선별→retrieve/generate·인용 검증·답변 캐시), jobs(비동기 작업·안전 오류 문구), contracts(extra 필드 거부). main.py에 `/api/items`, `POST /api/chat`(202+job_id), `/api/jobs/{id}`. 스크립트 `prepare_corpus`, `evaluate_pilot`. React `KnowledgeScreen`·`src/api/knowledge.ts`·작업 탭.
- 실행 검증 완료(이번 세션 실측):
  - 백엔드 unittest 16개 OK, pip check OK. 게임 vitest 175 통과, typecheck·build 성공.
  - `scripts.prepare_corpus` 재실행: knowledge_items 10 / reference_chunks 48 불변, http_requests 0, embedding_batches 0, cache_hit true.
  - 파일럿 질문 3건 재호출: 모두 답변 캐시 명중(유료 호출 없음). 최초 실행 기록(pilot.json): 19.5s/16.7s/16.7s, 인용 3/3/0건, 문서 밖 질문은 "확인되지 않습니다" 보류.
  - 브라우저(127.0.0.1:5173): 지식 탭 10항목 표시, curl-28 질문→본문 [근거 N]과 근거 카드 3건·원문 URL 일치, 캐시 안내 표시.
  - 키 패턴 검색: 작업 트리(.env 제외)에서 발견 없음, backend/.env는 .gitignore 적용.
- 미검증/미구현: 100건 항목(F2001), 외부 후보 검색(현재 항목별 사전 목록만 선별, F2004), 청크 크기·Top-k 변경 비교, 키 누락·색인 0건 화면 확인, 조건 탐색(F2011), 공개 실습 기록 코치(F2010), RAG 전후 비교(F2015). AWS 문서 라이선스 표기(CC-BY-SA-4.0)는 출처 원문으로 재확인 필요(NF2007).
- 실행 프로세스: FastAPI 127.0.0.1:8000, Vite 5173 이미 실행 중이었음(이번 세션에서 띄운 것 아님).
- 다음 한 가지 작업: 고유 항목 100건 이상·연결 원문·출처/이용 조건 확보 — `data_feasibility/shortlist_100.json`을 KnowledgeItem 스키마로 변환하고 각 항목의 primary 문서 절이 실제 추출되는지 검사하는 스크립트부터.

## 이전 상태 (환경 구축 단계)

- 저장소: C:/Users/SSAFY/Documents/Codex/InfraCoach. 브랜치 master. 시작 커밋 0445608. 환경 구축 커밋 4322625 (로컬, 푸시 안 함).
- 기존 미추적 docs/infra-coach 문서·데이터 보존. HANDOFF/TASKS를 갱신했고 기존 기획 자료는 미추적 상태로 남김. 기존 엔진 변경 없음.
- Python 3.11.9 backend/.venv, 과제 PDF 지정 버전 설치. requirements.lock.txt에 전체 설치 버전 기록.
- 기존 게임 175개 테스트·타입 검사·빌드 통과. 백엔드 unittest 8개·pip check 통과.
- FastAPI /api/health, Chroma knowledge_items/reference_chunks, 두 노드 그래프 팩터리, 모델 어댑터/연결 CLI, React 상태 패널 추가.
- GMS gpt-6.1-sol Responses 실제 호출 성공 (2자 반환). 키는 backend/.env에만 존재하며 Git 제외.
- GMS text-embedding-3-large /v1/embeddings 실제 1건 호출 성공, 3,072차원 확인. backend/.env 및 예제에 반영. 추가 정규화 없음.
- 사용자 보고 잔액 약 70,000크레딧(2026-10-21). 실제 잔액 API 조회나 전체 사용 승인 한도는 아님. 제공 임베딩 단가는 토큰당 0.0013크레딧이며 이번 시험 토큰 사용량은 별도 수집하지 않음.
- 제품 색인은 0건. 실제 RAG 수집/검색/생성·채팅 API는 아직 미구현. 그래프 테스트를 RAG 완료로 표시하지 말 것.
- 실행 프로세스: FastAPI 127.0.0.1:8000, Vite 127.0.0.1:5173 (이 작업에서 실행). 실행 세션 종료 시 재실행 필요.
- 실행 방법 backend/README.md, 실제 증빙 06_개발환경_검증결과.md.
- 교육생배포용.zip 검토: Streamlit UI 참고 골격, 가짜 수집 데이터, RAG 구현 없음. React 유지 결정에 맞춰 흐름만 활용.
- 후속: manifest/10건 수집·색인/세 프롬프트 → 두 노드 RAG/인용/공개 기록 코치.
- 남은 기존 이슈: 100건 최종 정제·이용 조건, ALB fail-open 불일치, npm audit 5건 영향 분석.

## 이전 조사·설계 기록 (당시 상태)

# InfraCoach 현재 인수인계

갱신: 2026-10-21 · 단계: 구현·검증·제출 문서 완료. 셀프 체크리스트·상호 점검·제출은 사용자 몫

## 최신 작업 — 데이터 사전 조사

사용자가 데이터 확보 가능성 확인을 요청하여 공식 원문 3개를 실제 다운로드하고 후보 237건을 추출했다. curl 86 / Linux errno 123 / AWS ALB 28. 우선 검토 100건은 curl 40 / Linux 40 / ALB 20으로 선택했다. 파일은 data_feasibility/ 및 05_데이터_확보가능성_검토결과.md에 있다.

237건 중 187건의 설명이 80자 미만이다. 따라서 메타 후보 확보와 코칭 품질 확보를 구분해야 한다. 보강 원문 5개 접근 성공, 선택 Linux 40건 중 31건의 오류 이름이 connect/open/write 문서에 등장함을 확인했다. 의미 검수·한국어 메타·모든 항목의 진단 근거 보강·버전 고정·이용 조건 반영은 아직 필요하다. 최종 데이터 확보를 통과 처리하지 말 것.

이번 조사 스크립트와 원문 캐시는 현재 작업 폴더 work/data_audit/에 있다. 이는 제품용 수집기·색인기가 아니며 다음 구현에서 별도 정리해야 한다. 후보 목록은 최종 KnowledgeItem 스키마로 아직 변환하지 않았다. 서비스 코드·임베딩·생성 API·게임 테스트는 실행하지 않았다.

바로 다음 우선 작업은 100건 정제와 출처 버전·조건 확정이며, 환경 구축과 연결해 대표 10건 RAG를 검증한다. 아래 문단은 이전 설계 단계의 기록이며 데이터 상태는 이 최신 절과 05 보고서를 우선한다.

## 현재까지 실제 수행

원본 과제 PDF를 읽고 기존 게임 ZIP의 README·시나리오·세션·결과 화면·AWS 상태 코드를 일부 확인했다. 코드 실행·의존성 설치·RAG 구현은 수행하지 않았다. 생성한 문서는 이 폴더의 01/02/03 및 PROJECT/TASKS/본 문서/04 전환 가이드다.

## 현재 사용자의 요청과 처리 범위

요청: 제출물 6종과 기존 명세 비교, 도메인의 근거 필요성 확인, Claude로 이어갈 준비.
처리: 누락을 점검하고 검증·상호·사전 셀프 양식 보완, 도메인 선정 근거와 초기 검색 설정 선정 이유 추가, 인수인계 문서 준비.
아직 프로젝트 구현을 이번 요청으로 시작하지 않았다. 다음 사용자의 구현 요청이 있으면 TASKS의 순서로 진행한다.

## 알고 있는 중요한 문제

1. 기존 ALB 시나리오는 ‘모두 unhealthy → 항상 503’을 전제하지만 공식 문서는 모든 타깃 unhealthy 시 fail-open을 설명한다. 시나리오 인과관계를 수정해야 한다.
   근거: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/target-group-health-checks.html
2. 100건 데이터·연결 문서·출처 이용 조건은 아직 확보·검증되지 않았다.
3. GMS의 모델/임베딩과 개인 API 공급자는 미확정이다.
4. 공식 셀프 양식은 아직 받지 않았다. 상호 점검도 실시하지 않았다.
5. 신규 RAG용 실행 README와 구현 소스가 없다. 기존 게임은 ZIP에 있으며 이 작업 폴더에 추출하지 않았다.
6. ‘실습 3개 세밀화·새 환경 1개’는 3일 범위에 맞춘 제안이다. 사용자는 더 다양한 환경과 세밀함을 원한다.

## 재개할 때

먼저 실제 코드·문서·Git 상태를 확인한다. 이 문서의 과거 상태보다 실제 파일을 우선하고 차이가 있으면 갱신한다. 원본 게임 ZIP이나 저장소를 읽을 수 없으면 사용자에게 소스를 요청한다. 기록 없이 프로젝트를 새로 만들거나 기존 구현을 덮어쓰지 않는다.

## 다음 교체 직전에 채울 항목

- 실제 작업 저장소: 아직 미확정
- 브랜치/커밋: 아직 확인하지 않음
- 커밋되지 않은 변경: 프로젝트 저장소 확인 전
- 마지막 구현 파일: 없음
- 실제 실행한 프로젝트 테스트와 결과: 없음
- 현재 실행 프로세스/포트: 프로젝트 실행 없음
- 데이터/색인 manifest 위치·건수: 아직 없음
- 다음 한 가지 작업: 구현 요청 시 저장소 확인 및 기존 게임 실행 검증
- 진행 중 오류/재현 절차: 프로젝트 미실행; 알려진 ALB 설계 문제는 위 참고

위 항목을 새 작업 상태로 바꾸고 TASKS도 갱신한다. 과거 ‘미구현’ 기록이 실제 구현 후에도 남지 않도록 한다. 비밀 키·토큰·개인정보는 포함하지 않는다.
