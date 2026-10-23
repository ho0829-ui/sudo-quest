/**
 * 리포트의 소요 시간·명령어 칸 아래 짧은 평. 점수에는 영향이 없고(학습 점수는 힌트·오답만 본다),
 * 다른 칸(감점 줄)과 높이를 맞추면서 "어떻게 풀었나"를 가볍게 돌아보게 한다. 모두 긍정적인 말로만 쓴다.
 */
export function timeNote(seconds: number): string {
  if (seconds < 180) return "⚡ 빠른 복구";
  if (seconds < 600) return "🧭 차근차근";
  return "🔥 끈기 있게 끝까지";
}

/** 모범 풀이 길이와 비교한다. 많이 쳤다고 나쁜 게 아니라 넓게 살펴본 것이다. */
export function commandNote(count: number, solutionLength: number): string {
  if (count <= solutionLength) return "🎯 군더더기 없이";
  if (count <= solutionLength * 2) return "🔍 꼼꼼한 확인";
  return "🗺️ 넓게 탐색";
}
