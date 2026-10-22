/**
 * 힌트 용어 풀이. 힌트를 열면 그 힌트 글에 나온 용어만 골라 "용어 풀이"로 펼쳐 볼 수 있게 한다(HintGlossary).
 * 시나리오의 힌트(3단계)는 그대로 두고, 처음 보는 말 때문에 막히지 않게 뜻만 덧붙인다.
 * 풀이는 일반적인 뜻만 쓴다. 특정 실습의 원인·설정값·고치는 방법은 쓰지 않는다(정답을 바로 주지 않는 원칙).
 * 새 용어는 여기에 한 줄씩 더한다. 어느 힌트에도 안 나오는 용어는 테스트가 잡는다.
 */
export interface GlossaryEntry {
  term: string;
  /** 힌트 글에서 이 용어를 찾는 패턴 */
  pattern: RegExp;
  plain: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  { term: "포트", pattern: /포트/,
    plain: "한 서버 안의 여러 프로그램이 같은 IP를 나눠 쓰도록 붙인 번호예요. 웹은 보통 80(HTTP)·443(HTTPS), SSH는 22를 써요." },
  { term: "바인딩", pattern: /바인딩|바인드/,
    plain: "프로그램이 '이 주소·포트로 오는 연결을 내가 받겠다'고 자리를 잡는 것이에요. 어느 주소에 자리를 잡았는지에 따라 누가 접속할 수 있는지가 달라져요." },
  { term: "127.0.0.1 · localhost", pattern: /127\.0\.0\.1|localhost/,
    plain: "자기 자신을 가리키는 주소(루프백)예요. 여기로 보낸 요청은 서버 밖으로 나가지 않아요. 서버 안에서 '나 자신에게' 시험할 때 써요." },
  { term: "0.0.0.0", pattern: /(?<![\d.])0\.0\.0\.0(?![\d.])/,
    plain: "연결을 기다리는 쪽에서 쓰면 '이 서버가 가진 모든 네트워크 주소'라는 뜻이에요. 밖에서 들어오는 연결도 받을 수 있어요." },
  { term: "방화벽 · ufw", pattern: /방화벽|ufw/i,
    plain: "들어오고 나가는 연결을 규칙에 따라 허용하거나 막는 장치예요. ufw는 우분투에서 방화벽 규칙을 쉽게 다루는 도구예요." },
  { term: "기본 정책(deny)", pattern: /기본 정책|\bdeny\b/,
    plain: "어떤 규칙에도 걸리지 않은 연결을 어떻게 할지 정한 값이에요. deny면 허용 규칙이 없는 연결은 전부 막혀요." },
  { term: "DNS · 이름 해석", pattern: /DNS|이름 해석|도메인 이름/,
    plain: "shop.example.com 같은 도메인 이름을 컴퓨터가 쓰는 IP 주소로 바꿔 주는 체계예요. 이 단계가 실패하면 연결을 시작하기도 전에 멈춰요." },
  { term: "리졸버 · nameserver", pattern: /리졸버|nameserver/,
    plain: "이름 해석을 대신 물어봐 주는 DNS 서버예요. 서버가 어느 리졸버에게 물을지는 설정 파일의 nameserver 줄이 정해요." },
  { term: "/etc/resolv.conf", pattern: /resolv\.conf/,
    plain: "리눅스가 이름 해석에 쓸 DNS 서버(nameserver) 주소를 적어 두는 파일이에요." },
  { term: "EAI_AGAIN", pattern: /EAI_AGAIN/,
    plain: "이름 해석이 '지금은' 실패했다는 오류 코드예요. 상대 서버와의 연결이 아니라, 그 전에 주소를 알아내는 단계에서 났다는 뜻이에요." },
  { term: "dig", pattern: /\bdig\b/,
    plain: "DNS에 직접 물어보는 명령이에요. 어느 DNS 서버가 어떤 IP를 돌려줬는지, 아니면 서버에 닿지 못했는지 보여 줘요." },
  { term: "curl", pattern: /\bcurl\b/,
    plain: "주소로 HTTP 요청을 보내 보는 명령이에요. -I는 본문 없이 응답 머리(상태 코드)만, -v는 연결 과정을 단계별로 자세히 보여 줘요." },
  { term: "ss -tlnp", pattern: /\bss -tlnp\b/,
    plain: "지금 연결을 기다리는(LISTEN) TCP 포트 목록이에요. -t는 TCP, -l은 듣는 중인 것만, -n은 숫자 그대로, -p는 어느 프로세스인지 보여 줘요." },
  { term: "timeout과 거부(refused)", pattern: /timed out|timeout|refused/i,
    plain: "refused는 상대에게 닿았지만 그 포트에서 기다리는 프로그램이 없다는 뜻이에요. timeout은 응답이 아예 오지 않았다는 뜻이라, 중간 어딘가에서 막혔거나 닿지 못한 경우가 많아요." },
  { term: "보안 그룹", pattern: /보안\s?그룹/,
    plain: "AWS 인스턴스 앞에 붙는 방화벽이에요. 허용 규칙만 적고, 규칙에 없는 들어오는 연결은 모두 막혀요." },
  { term: "인바운드", pattern: /인바운드|ingress/i,
    plain: "밖에서 이 서버로 들어오는 방향의 연결이에요. 반대로 서버에서 밖으로 나가는 연결은 아웃바운드라고 해요." },
  { term: "VPC", pattern: /\bVPC\b/,
    plain: "AWS 안에 만든 나만의 사설 네트워크예요. 그 안의 서버들은 같은 주소 대역을 쓰고, VPC가 제공하는 DNS 리졸버를 쓸 수 있어요." },
  { term: "CIDR(10.0.1.0/24)", pattern: /--cidr|\b\d+\.\d+\.\d+\.\d+\/\d{1,2}\b/,
    plain: "주소 범위를 적는 방법이에요. /24는 앞 24비트가 같은 주소 256개, 0.0.0.0/0은 모든 주소를 뜻해요." },
  { term: "upstream · 502", pattern: /upstream|\b502\b/,
    plain: "upstream은 nginx 같은 앞단 서버가 요청을 넘겨주는 뒤쪽 서버(앱)예요. 502 Bad Gateway는 앞단이 그 뒤쪽 서버와 통신하다 실패했다는 뜻이에요." },
  { term: "proxy_pass", pattern: /proxy_pass/,
    plain: "nginx가 받은 요청을 어느 뒤쪽 주소로 넘길지 정하는 설정이에요." },
  { term: "인증서 · 체인", pattern: /인증서/,
    plain: "HTTPS에서 '이 서버가 정말 그 도메인'임을 증명하는 파일이에요. 브라우저는 유효기간과, 믿을 수 있는 발급 기관까지 이어지는 중간 인증서(체인)를 검사해요." },
  { term: "로드밸런서 · 타깃", pattern: /로드밸런서|타깃|\bALB\b/,
    plain: "들어온 요청을 여러 서버(타깃)에 나눠 보내는 장치예요. AWS의 ALB가 그 예예요." },
  { term: "헬스체크", pattern: /헬스체크/,
    plain: "로드밸런서가 정해진 경로로 각 서버에 주기적으로 요청해 살아 있는지 판단하는 것이에요. 기대한 응답이 안 오면 그 서버를 unhealthy로 봐요." },
];

/** 힌트 글에 나온 용어만, 처음 나온 순서대로. */
export function termsIn(text: string): GlossaryEntry[] {
  return GLOSSARY
    .map(entry => ({ entry, at: text.search(entry.pattern) }))
    .filter(found => found.at >= 0)
    .sort((a, b) => a.at - b.at)
    .map(found => found.entry);
}
