import { isItems, isJobStart, isRecord } from "./validate";
import { apiUrl } from "./base";

export interface Item {
  item_id: string;
  title_ko: string;
  product: string;
  summary: string;
  source_url: string;
}

export interface Message { role: "user" | "assistant"; content: string }
export interface Citation {
  evidence_id: number;
  title: string;
  text: string;
  source_url: string;
  source_type: string;
  publisher: string;
  license: string;
}
export interface Answer {
  answer: string;
  suggested_checks: string[];
  citations: Citation[];
  warnings: string[];
  collected_documents?: { doc_id: string; title: string }[];
  cache_hit: boolean;
}
export interface ExploreCard { item_id: string; title_ko: string; product: string; category: string; reason: string }
export interface ExploreResult {
  cards: ExploreCard[];
  applied_filters: { products: string[]; codes: string[] };
  candidate_count: number;
  unverifiable_conditions: string[];
  notes: string[];
  cache_hit: boolean;
}
export interface Job<T = Answer> {
  status: "running" | "complete" | "failed";
  stage: string;
  result?: T;
  message?: string;
}

const INVALID = "서버 응답 형식이 올바르지 않습니다. 백엔드 버전을 확인해 주세요.";

/** 요청하고, 응답 모양이 맞을 때만 돌려준다. JSON이 아니거나 모양이 다르면 화면에 보일 오류 문장으로 바꾼다. */
async function request<T>(path: string, valid: (v: unknown) => v is T, options?: RequestInit): Promise<T> {
  const response = await fetch(apiUrl(path), { ...options, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(response.status === 429
    ? "다른 요청을 처리 중입니다. 잠시 후 다시 시도해주세요." : "서버 요청에 실패했습니다. 연결 상태를 확인해주세요.");
  let data: unknown;
  try { data = await response.json(); } catch { throw new Error(INVALID); }
  if (!valid(data)) throw new Error(INVALID);
  return data;
}

/** 작업 상태. 완료됐다면 결과도 그 종류의 모양인지 확인한다. */
function isJob<T>(result: (v: unknown) => v is T) {
  return (v: unknown): v is Job<T> => isRecord(v) && (v.status === "running" || v.status === "complete" || v.status === "failed")
    && typeof v.stage === "string" && (v.message === undefined || typeof v.message === "string")
    && (v.status !== "complete" || result(v.result));
}

const post = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export const getItems = () => request("/api/items", isItems);
export const getJob = <T = Answer>(id: string, result: (v: unknown) => v is T) => request(`/api/jobs/${encodeURIComponent(id)}`, isJob(result));
export const startChat = (item: string, question: string, history: Message[]) =>
  request("/api/chat", isJobStart, post({ item_id: item, question, history }));
export const startSearch = (query: string) => request("/api/items/search", isJobStart, post({ query }));
export const startCoach = (body: unknown) => request("/api/coach", isJobStart, post(body));
