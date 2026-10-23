/** 백엔드 주소: 개발·테스트에서는 비어 있어 같은 주소의 /api를 쓴다(공개 배포만 VITE_API_BASE로 바꾼다). */
import { describe, expect, it } from "vitest";
import { API_BASE, REMOTE_API, apiUrl } from "../src/api/base";

describe("API 주소", () => {
  it("설정이 없으면 상대 주소 /api 그대로", () => {
    expect(API_BASE).toBe("");
    expect(REMOTE_API).toBe(false);
    expect(apiUrl("/api/health")).toBe("/api/health");
  });
});
