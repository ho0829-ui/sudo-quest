/** 티켓에 공개된 증상만 전달한다. 원인·학습 목표·풀이를 대사로 만들지 않는다. */
export function questDialogue(title: string, ticket: string): { heading: string; text: string }[] {
  return [
    { heading: title, text: `와 줘서 다행이에요. 방금 이런 연락이 들어왔어요.\n\n${ticket}` },
    { heading: '같이 원인을 찾아줄 수 있나요?', text: '아직 원인은 단정할 수 없어요. 서버에서 보이는 증상부터 확인해 주세요.\n\n로그와 설정을 살피고, 가설을 세우고, 조치한 뒤 다시 확인하는 거예요.\n막히면 제가 옆에서 도울게요. 준비됐나요?' },
  ];
}
