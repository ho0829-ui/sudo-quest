/**
 * 엔딩 크레딧 데이터. 유쾌하게 쓰되 사실과 다른 숫자·주장은 넣지 않는다.
 *
 * ⚠️ 기능을 추가하면 CHAPTERS에 한 줄, 기능을 없애면 GRAVEYARD에 비석 하나를 더한다(CLAUDE.md 규칙).
 * 실습 목록·실습 수·명령 수는 시나리오 데이터에서 자동으로 계산하므로 손으로 고치지 않는다(rollCall).
 */
import type { Scenario } from "../../engine/scenario/types";
import { DEFAULT_COMMANDS } from "../../engine/commands/names";
import { CATEGORIES, OPEN_CATEGORIES } from "../categories";

export interface CastMember { name: string; role: string; lines: string[] }
export interface Chapter { title: string; credit: string; lines: string[] }
export interface Tomb { name: string; died: string; epitaph: string }

export const CAST: CastMember[] = [
  { name: "Choi", role: "총감독 · 기획 · 최종 승인 버튼",
    lines: ["\"계획 먼저 보여줘\"의 장인", "사이버펑크 세기말을 사내 파티로 바꾼 사람", "모든 Phase는 이 사람의 \"진행해줘\"로 시작되었다"] },
  { name: "Claude", role: "가상 엔진 · 실습 · 캠퍼스 · 파티 · 카페 · 엔딩",
    lines: ["\"다시 시도해 주세요\"에서 부활한 경력 보유", "펭귄에게 고깔모자를 씌운 장본인", "출력을 하드코딩하고 싶을 때마다 상태 모델을 늘렸다"] },
  { name: "GPT (Codex)", role: "쿠버네티스 첫 실습 · 정답 밖 탐색 점검 · 퀘스트 연출",
    lines: ["정답 말고 엉뚱한 명령을 잔뜩 쳐 보며 결함을 잡아낸 테스터", "도트 CLI 로더와 선임 운영자 도윤을 데려왔다"] },
];

export const CHAPTERS: Chapter[] = [
  { title: "가상 서버 엔진", credit: "Claude · GPT (Codex)",
    lines: ["2026년 9월 11일, CLAUDE.md와 첫 실습(디스크 가득 참)과 함께 태어남", "파일·프로세스·서비스·systemd·journalctl·도커·쿠버네티스·nginx·인증서 체인을 전부 메모리 안에서",
      "명령 출력은 하드코딩 금지 — 언제나 지금 상태에서 계산한다", "모르는 명령엔 실제 셸처럼 \"bash: X: command not found\" — 대신 쓸 명령은 터미널 아래 안내에서 친절하게"] },
  { title: "SUDO QUEST 캠퍼스", credit: "Claude · 감독 Choi",
    lines: ["아이소메트릭 운영실, 경보등, 출동 대기 전광판, 운영자 등급", "걷고 타이핑하는 근무자들 — 월급은 받지 않는다", "\"다음 실습\" 버튼은 이미 푼 실습으로 데려가지 않는다 — 다 풀면 기록 갱신을 권한다",
      "리포트의 시간·명령어 칸에도 한마디 — ⚡ 빠른 복구, 🗺️ 넓게 탐색. 점수는 그대로"] },
  { title: "피날레 리허설", credit: "GPT (Codex) · 아이디어 Choi",
    lines: ["홈의 숨은 스위치로 ALL CLEAR를 미리 본다 — 진짜 학습 기록은 그대로"] },
  { title: "AI 코치 · 지식 탐색", credit: "Choi · Claude",
    lines: ["FastAPI · Chroma · LangGraph · 공식 문서 근거 인용", "정답 정보는 절대 보내지 않는 코치 — 사실·가설·다음 점검만 말한다",
      "공급자가 502를 내면 1초 쉬고 딱 한 번 더 — 단계마다 스톱워치도 켜 두었다",
      "질문 24개로 시험을 봤다: 오답 0, 한 문제는 인용 번호를 끝까지 못 맞췄다"] },
  { title: "정답 밖 탐색 점검", credit: "GPT (Codex)",
    lines: ["조회 반복 · 역순 · 오조치 · 대체 풀이로 실습을 두들겨 본 사람", "덕분에 엉뚱한 명령에도 게임이 무너지지 않는다"] },
  { title: "퀘스트 브리핑 · 도트 CLI 로더", credit: "GPT (Codex)",
    lines: ["첫 선임 운영자 도윤이 시작한 브리핑을 분야별 선임들이 이어받았다", "로딩 중에도 작은 터미널 커서가 깜박인다"] },
  { title: "어디서 뵌 것 같은 선임들", credit: "GPT (Codex) · 아이디어 Choi",
    lines: ["펭귄·돌고래·고래·세 항해사… 명찰을 누르면 작은 단서가 열린다", "다섯 가지 등장 연출 — 오늘 당직자는 출근도 영화처럼 한다", "앤디가 클라우드 전망대를 이어받았다. 도윤의 호출기는 드디어 무음이다"] },
  { title: "커뮤니티 카페", credit: "Claude · 감독 Choi",
    lines: ["SQLite 게시판, 삭제 비밀번호, 풀이 포함 가리기", "글쓴이가 손님이 되어 돌아다니는 큰 사내 카페와 바리스타 둘", "예시 글 18개와 배경 직원 25명 덕분에 첫날부터 북적임"] },
  { title: "튜토리얼 · 첫 근무", credit: "Claude · 아이디어 Choi",
    lines: ["아침 점검 뒤 아무도 nginx를 다시 켜지 않았다 — 신입의 첫 장애는 언제나 이렇게 시작한다", "명령을 직접 쳐야 넘어가는 말풍선 여덟 개. 건너뛰기는 Esc", "연습 실습이라 점수도 기록도 남지 않는다. 마음껏 틀려 보세요",
      "힌트 아래 용어 풀이 — EAI_AGAIN이 뭔지 몰라도 이제 괜찮다"] },
  { title: "배포 · 운영자의 Mac", credit: "Claude · 결정 Choi",
    lines: ["게임은 GitHub Pages에, 코치와 카페는 잘 끄지 않는 Mac 한 대에 — 터널 하나로 이어 붙였다", "Mac이 쉬는 날엔 배지가 \"서버 쉬는 중\"이라고 솔직하게 말한다"] },
  { title: "README · 시연 GIF", credit: "Claude · 감독 Choi",
    lines: ["헤드리스 Chrome이 대신 df -h를 쳐 주었다 — 한 번 틀린 원인 제출까지 연기했다", "README 첫 화면에 30초짜리 실습 한 판, 스포일러는 접어 두었다"] },
  { title: "1280×720 맞춤", credit: "Claude · 측정 요청 Choi",
    lines: ["노트북 한 화면 안에 시작 버튼과 터미널 입력줄이 들어오게 됨 — 줄자로 픽셀을 재 가며", "AI 코치 상태는 상단바의 작은 배지로 이사했다. 누르면 아직 다 말해 준다", "카페 장면은 접을 수 있게 됐다 — 접어 둔 걸 브라우저가 기억한다",
      "휴대폰에선 라벨이 11px로 커지고 실습 카드가 홀쭉해졌다. 접힌 로그 줄은 들여쓰기로 구분된다"] },
  { title: "안정성 점검", credit: "Claude",
    lines: ["Error Boundary 3단, 이상한 입력 퍼징, 손상된 저장소에도 흰 화면 없음"] },
  { title: "운영실 파티 · 전사 시상식", credit: "Claude · 아이디어 Choi",
    lines: ["업타임 생일 파티 · 핑퐁 대회 · 쿼리 칵테일 바 · 루프톱 풍선 파티 · 고래 풀 파티 · 선상 보물 연회", "그리고 지금 이 피날레와 엔딩 크레딧", "빨리 감기 최대 8배와 위치 막대 — 지금 이 줄을 빨리 감고 있다면 들켰습니다"] },
];

export const SPECIAL_GUESTS = [
  "컨테이너 운하의 고래 — 파티 날엔 물 대신 꽃가루를 뿜음",
  "고깔모자 펭귄 인형 — 업타임 케이크 옆 지정석",
  "소파 위 고양이 — 낮잠 담당, 단 한 번도 깨지 않음",
  "클라우드 전망대의 앤디 — 구름 위 첫 설계도를 들고 등장",
  "바리스타 둘 — HOTFIX AMERICANO 전문",
  "쿠버네티스 바다의 갈매기 두 마리",
];

export const MUSIC_CREDIT = {
  title: "음악",
  lines: ["자크 오펜바흐 「지옥의 오르페우스」 중 지옥의 갤럽(캉캉), 1858 · 퍼블릭 도메인", "8비트 편곡·연주: 브라우저 Web Audio 코드 (음원 파일 없음)", "작게 시작해 2.5초에 걸쳐 커지는 볼륨과 볼륨 막대 — 깜짝 놀란 분께는 사과드립니다"],
};

/** 우리가 만들다 없앤 것들. 날짜는 사라진 날. */
export const GRAVEYARD: Tomb[] = [
  { name: "선임 운영자 도윤", died: "2026-10-22", epitaph: "모든 장애를 받던 첫 당직자. 이제 알람 없이 푹 쉬길." },
  { name: "어디를 가도 같은 퀘스트 서버 랙", died: "2026-10-22", epitaph: "컨테이너 부두까지 따라왔다가 일곱 공간에 자리를 내주다" },
  { name: "홈 화면 장식 서버 랙", died: "2026-10-21", epitaph: "캠퍼스에게 자리를 물려주고 편히 잠들다" },
  { name: "화면 이름 InfraCoach", died: "2026-10-21", epitaph: "SUDO QUEST로 개명. 백엔드 서비스 이름으로 반쯤 살아 있음" },
  { name: "원인이 드러나던 티켓 번호", died: "2026-10-21", epitaph: "#linux-disk-full — 스포일러는 무덤으로" },
  { name: "초록색 디자인 토큰", died: "2026-10-21", epitaph: "사이버 블루와의 승부에서 졌다" },
  { name: "임베딩 text-embedding-3-large", died: "2026-10-22", epitaph: "3,072차원의 삶을 마치고 gemini-embedding-2에게 바통을" },
  { name: "Vite 500kB 경고", died: "2026-10-22", epitaph: "번들 분할로 영면. 다시는 노랗게 뜨지 마라" },
  { name: "kubectl/mutations.ts", died: "2026-10-22", epitaph: "더 작은 파일들로 환생" },
  { name: "사이버펑크 퇴근 이벤트", died: "2026-10-22", epitaph: "태어나지도 못했다. 세기말은 우리 취향이 아니었다" },
  { name: "큰 카페의 펜던트 조명", died: "2026-10-22", epitaph: "손님 얼굴을 가린 죄로 철거" },
  { name: "회색 9px \"해결 완료\" 글씨", died: "2026-10-22", epitaph: "너무 겸손해서 아무도 못 봤다. 초록 배지로 환생" },
  { name: "소리 없이 시작하던 피날레", died: "2026-10-22", epitaph: "조용한 축하는 축하가 아니었다" },
  { name: "시간 감점(1분당 10점)", died: "2026-10-22", epitaph: "천천히 배우는 사람을 재촉하던 시계. 챌린지 모드에서 다시 만나자" },
  { name: "명령 수 감점(12개 초과)", died: "2026-10-22", epitaph: "한 번 더 확인하려는 손을 붙잡았다. 이제 마음껏 쳐 보세요" },
  { name: "옛 리포트 파일 이름", died: "2026-10-22", epitaph: "infracoach-…-1792659960000.md, 아무도 그 숫자를 읽지 못했다" },
  { name: "ALL CLEAR 링크의 → 화살표", died: "2026-10-22", epitaph: "한 시간 남짓 반짝 나왔다 들어갔다. 간격이 안 맞았다" },
  { name: "모든 화면 위의 AI 코치 상태줄", died: "2026-10-23", epitaph: "43픽셀을 차지하던 성실한 줄. 상단바 배지로 작아져 돌아왔다" },
  { name: "377줄짜리 README", died: "2026-10-23", epitaph: "InfraCoach라는 옛 이름으로 모든 걸 말하려 했다. 실행·출처·엔진 문서 셋으로 나뉘어 편히 쉰다" },
  { name: "README의 *(스크린샷 자리)*", died: "2026-10-23", epitaph: "끝내 사진을 받지 못하고 진짜 GIF에게 자리를 내주었다" },
  { name: "\"기록만 (점수 영향 없음)\" 표기", died: "2026-10-23", epitaph: "하루 만에 퇴장. 굳이 말 안 해도 다들 알았다" },
  { name: "7~9px 라벨들", died: "2026-10-23", epitaph: "돋보기 없이는 아무도 읽지 못했다. 11px로 환생" },
  { name: "초록 막대가 된 S등급", died: "2026-10-23", epitaph: "HUD 배지와 이름(.grade)이 같아 리포트에서 납작해졌다. 이제 46px로 우뚝" },
  { name: "다섯 줄로 접히던 홈 제목", died: "2026-10-23", epitaph: "240픽셀 칸에 갇혀 시작 버튼을 화면 밖으로 밀어냈다" },
];

export interface RollCall {
  /** 분류별 실습 제목 */
  groups: { label: string; titles: string[] }[];
  total: number;
  /** 실습들이 쓰는 서로 다른 명령 수 */
  commands: number;
}

/** 실습 목록·수·명령 수. 시나리오 데이터에서 계산하므로 실습이 늘어도 크레딧이 낡지 않는다. */
export function rollCall(scenarios: Scenario[]): RollCall {
  const groups = OPEN_CATEGORIES.map(c => ({ label: CATEGORIES[c.id].room, titles: scenarios.filter(s => s.category === c.id).map(s => s.title) }))
    .filter(g => g.titles.length);
  const commands = new Set(scenarios.flatMap(s => s.commands ?? DEFAULT_COMMANDS));
  return { groups, total: scenarios.length, commands: commands.size };
}
