/**
 * nginx 라우팅(location·proxy_pass·upstream)과 인증서 체인 검증. 출력은 nginx가 읽어 둔 설정과 인증서 파일 내용에서 계산된다.
 */
import { describe, expect, it } from "vitest";
import { runCommand } from "../src/engine/run";
import { buildInitialState } from "../src/engine/scenario/build";
import { parseNginx, pickServer, route } from "../src/engine/state/config/nginxSites";
import type { SystemState } from "../src/engine/state/types";
import { linuxTooManyFiles } from "../src/scenarios/linux-too-many-files";
import { webTlsChain } from "../src/scenarios/web-tls-chain";
import { webUpstream502 } from "../src/scenarios/web-upstream-502";

function session(state: SystemState, available: string[]) {
  let current = state;
  return (line: string) => {
    const result = runCommand(current, line, { available });
    current = result.state;
    return result;
  };
}

const CONF = `http {
  upstream api_pool { server 127.0.0.1:8080; server 127.0.0.1:8081; }
  server { listen 80 default_server; server_name a.example.com;
    location / { root /var/www/html; }
    location /api/ { proxy_pass http://127.0.0.1:3000/; }
    location /raw/ { proxy_pass http://127.0.0.1:3000; }
    location = /exact { proxy_pass http://api_pool/only; }
  }
  server { listen 80; server_name b.example.com; location / { proxy_pass http://api_pool; } }
}`;

describe("nginx 설정 해석", () => {
  const config = parseNginx(CONF);
  const a = pickServer(config, 80, "unknown.example.com")!;

  it("이름이 없으면 default_server, 이름이 맞으면 그 server를 고른다", () => {
    expect(a.names).toEqual(["a.example.com"]);
    expect(pickServer(config, 80, "b.example.com")!.names).toEqual(["b.example.com"]);
  });

  it("proxy_pass에 URI가 있으면 접두사를 바꾸고, 없으면 경로를 그대로 넘긴다", () => {
    expect(route(config, a, "/api/products?page=2")).toEqual({ kind: "proxy", targets: [{ host: "127.0.0.1", port: 3000 }], path: "/products?page=2" });
    expect(route(config, a, "/raw/x")).toMatchObject({ path: "/raw/x" });
    expect(route(config, a, "/index.html")).toEqual({ kind: "static" });
  });

  it("= 위치는 정확히 같을 때만, upstream 이름은 server 목록으로 푼다", () => {
    expect(route(config, a, "/exact")).toEqual({ kind: "proxy", targets: [{ host: "127.0.0.1", port: 8080 }, { host: "127.0.0.1", port: 8081 }], path: "/only" });
    expect(route(config, a, "/exact/more")).toEqual({ kind: "static" });
  });
});

describe("nginx 프록시 동작", () => {
  it("upstream이 연결을 거부하면 502, 설정 파일만 고치면 그대로, reload하면 적용된다", () => {
    const run = session(buildInitialState(webUpstream502), webUpstream502.commands!);
    expect(run("curl -i http://localhost/api/health").stdout).toMatch(/^HTTP\/1\.1 502 Bad Gateway\nServer: nginx\/1\.24\.0/);
    run("sudo sed -i 's/127.0.0.1:3000/127.0.0.1:8080/' /etc/nginx/nginx.conf");
    expect(run("curl -i http://localhost/api/health").stdout).toContain("502 Bad Gateway");
    run("sudo systemctl reload nginx");
    expect(run("curl -i http://localhost/api/health").stdout).toMatch(/^HTTP\/1\.1 200 OK\nServer: nginx\/1\.24\.0\nX-Powered-By: Express/);
  });

  it("문법이 틀린 설정으로 reload하면 거부되고 예전 설정으로 계속 응답한다", () => {
    const run = session(buildInitialState(webUpstream502), webUpstream502.commands!);
    run("sudo sed -i 's/127.0.0.1:3000/127.0.0.1:8080/' /etc/nginx/nginx.conf");
    run("sudo sed -i 's/keepalive_timeout 65;/keepalive_timeout 65/' /etc/nginx/nginx.conf");
    expect(run("sudo systemctl reload nginx").exitCode).not.toBe(0);
    expect(run("curl -i http://localhost/api/health").stdout).toContain("502 Bad Gateway");
  });

  it("upstream이 fd 한도에 막혀 응답하지 않으면 504", () => {
    const run = session(buildInitialState(linuxTooManyFiles), [...linuxTooManyFiles.commands!]);
    expect(run("curl -i http://localhost/api/health").stdout).toMatch(/^HTTP\/1\.1 504 Gateway Timeout\n[\s\S]*<title>504 Gateway Time-out<\/title>/);
  });

  it("앱 설정의 포트를 바꾸고 재시작하면 그 포트에서 듣는다", () => {
    const run = session(buildInitialState(webUpstream502), webUpstream502.commands!);
    run("sudo sed -i 's/port: 8080/port: 3000/' /opt/app/config.yml");
    run("sudo systemctl restart shop-api");
    expect(run("ss -tlnp").stdout).toMatch(/0\.0\.0\.0:3000 .*"node"/);
    expect(run("curl -s http://localhost/api/health").stdout).toContain('"status":"ok"');
  });
});

describe("인증서 체인", () => {
  const available = webTlsChain.commands!;
  const merge = (first: string, second: string, out: string) =>
    `cat /etc/nginx/ssl/${first} /etc/nginx/ssl/${second} | sudo tee /etc/nginx/ssl/${out}`;

  it("중간 인증서가 빠지면 curl 60·s_client 21, 이어 붙이면 루트까지 0", () => {
    const run = session(buildInitialState(webTlsChain), available);
    expect(run("curl -I https://shop.example.com").stderr).toBe("curl: (60) SSL certificate problem: unable to get local issuer certificate");
    expect(run("openssl s_client -connect shop.example.com:443").stdout).toContain("Verify return code: 21 (unable to verify the first certificate)");
    run(merge("shop.example.com.crt", "ExampleTrustCA.crt", "full.crt"));
    expect(run("grep -c BEGIN /etc/nginx/ssl/full.crt").stdout).toBe("2");
    run("sudo sed -i 's#ssl/shop.example.com.crt#ssl/full.crt#' /etc/nginx/nginx.conf");
    run("sudo systemctl reload nginx");
    const client = run("openssl s_client -connect shop.example.com:443 -servername shop.example.com").stdout;
    expect(client).toMatch(/depth=2 C = US, O = Example Trust, CN = Example Trust Root R1\nverify return:1\ndepth=1 .*RSA CA 2026\nverify return:1\ndepth=0 CN = shop.example.com/);
    expect(client).toMatch(/ 1 s:C = US, O = Example Trust, CN = Example Trust RSA CA 2026\n {3}i:C = US, O = Example Trust, CN = Example Trust Root R1/);
    expect(client).toContain("Verify return code: 0 (ok)");
    expect(run("curl -I https://shop.example.com").exitCode).toBe(0);
  });

  it("순서를 거꾸로 합치면 키와 짝이 맞지 않아 nginx -t·시작이 실패하고, 없는 파일도 실제 문장으로 거절한다", () => {
    const run = session(buildInitialState(webTlsChain), available);
    run(merge("ExampleTrustCA.crt", "shop.example.com.crt", "rev.crt"));
    run("sudo sed -i 's#ssl/shop.example.com.crt#ssl/rev.crt#' /etc/nginx/nginx.conf");
    expect(run("sudo nginx -t").stderr).toMatch(/^nginx: \[emerg\] SSL_CTX_use_PrivateKey\("\/etc\/nginx\/ssl\/shop\.example\.com\.key"\) failed \(SSL: error:05800074:x509 certificate routines::key values mismatch\)\nnginx: configuration file \/etc\/nginx\/nginx\.conf test failed$/);
    expect(run("sudo systemctl restart nginx").exitCode).toBe(1);
    run("sudo sed -i 's#ssl/rev.crt#ssl/none.crt#' /etc/nginx/nginx.conf");
    expect(run("sudo nginx -t").stderr).toContain('cannot load certificate "/etc/nginx/ssl/none.crt": BIO_new_file() failed');
  });

  it("x509는 묶음의 첫 장만 읽고, certbot은 Let's Encrypt 인증서만 관리한다", () => {
    const run = session(buildInitialState(webTlsChain), available);
    run(merge("ExampleTrustCA.crt", "shop.example.com.crt", "rev.crt"));
    expect(run("openssl x509 -in /etc/nginx/ssl/rev.crt -noout -subject").stdout).toBe("subject=C = US, O = Example Trust, CN = Example Trust RSA CA 2026");
    expect(run("openssl x509 -in /etc/nginx/ssl/shop.example.com.crt -noout -dates").stdout).toMatch(/^notBefore=.*\nnotAfter=Sep 10 09:15:00 2027 GMT$/);
    expect(run("sudo certbot certificates").stdout).not.toContain("/etc/nginx/ssl");
  });
});

describe("sed 구분자", () => {
  it("s#…#…# 와 s|…|…| 도 받고, 글자 구분자는 거절한다", () => {
    const run = session(buildInitialState(webTlsChain), webTlsChain.commands!);
    expect(run("sed 's#/etc/nginx#/X#' /etc/nginx/ssl/README.txt").exitCode).toBe(0);
    expect(run("sed 's|Example Trust|ET|' /etc/nginx/ssl/README.txt").stdout.split("\n")[0]).toBe("ET 인증서 발급 안내 (주문 #ET-20260910-4471)");
    expect(run("sed 'sxaxbx' /etc/nginx/ssl/README.txt").stderr).toBe("sed: -e expression #1, char 1: unknown command: 's'");
  });
});

describe("/dev/null 리다이렉션", () => {
  it("일반 사용자도 /dev/null로 출력을 버릴 수 있다", () => {
    const run = session(buildInitialState(webTlsChain), webTlsChain.commands!);
    const result = run("cat /etc/nginx/ssl/shop.example.com.crt /etc/nginx/ssl/ExampleTrustCA.crt | sudo tee /etc/nginx/ssl/full.crt > /dev/null");
    expect(result).toMatchObject({ stdout: "", stderr: "", exitCode: 0 });
    expect(run("grep -c BEGIN /etc/nginx/ssl/full.crt").stdout).toBe("2");
  });
});
