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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...options, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(response.status === 429
    ? "다른 요청을 처리 중입니다. 잠시 후 다시 시도해주세요." : "서버 요청에 실패했습니다. 연결 상태를 확인해주세요.");
  return response.json() as Promise<T>;
}

export const getItems = () => request<{ items: Item[]; index_ready: boolean }>("/api/items");
export const getJob = <T = Answer>(id: string) => request<Job<T>>(`/api/jobs/${encodeURIComponent(id)}`);
export const startChat = (item: string, question: string, history: Message[]) =>
  request<{ job_id: string }>("/api/chat", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: item, question, history }),
  });
export const startSearch = (query: string) =>
  request<{ job_id: string }>("/api/items/search", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query }),
  });
export const startCoach = (body: unknown) =>
  request<{ job_id: string }>("/api/coach", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
