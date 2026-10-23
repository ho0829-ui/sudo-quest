/**
 * 백엔드 응답 형식 검사. 서버가 바뀌었거나 프록시가 엉뚱한 응답을 주어도 화면이 깨지지 않게,
 * 화면에 쓰기 전에 모양을 확인한다(게시판 api/community.ts와 같은 방식).
 */
import type { CoachAnswer } from "./coach";
import type { Answer, Citation, ExploreResult, Item } from "./knowledge";

type Rec = Record<string, unknown>;
export const isRecord = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): v is string => typeof v === "string";
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(str);
const listOf = <T>(v: unknown, item: (x: unknown) => x is T): v is T[] => Array.isArray(v) && v.every(item);

const isCitation = (v: unknown): v is Citation => isRecord(v) && typeof v.evidence_id === "number"
  && str(v.title) && str(v.text) && str(v.source_url) && str(v.source_type) && str(v.publisher) && str(v.license);

export const isAnswer = (v: unknown): v is Answer => isRecord(v) && str(v.answer) && strings(v.suggested_checks)
  && listOf(v.citations, isCitation) && strings(v.warnings) && typeof v.cache_hit === "boolean"
  && (v.collected_documents === undefined || listOf(v.collected_documents, (d): d is { doc_id: string; title: string } => isRecord(d) && str(d.doc_id) && str(d.title)));

export const isCoachAnswer = (v: unknown): v is CoachAnswer => isAnswer(v) && isRecord(v)
  && listOf((v as Rec).observations, (o): o is CoachAnswer["observations"][number] => isRecord(o) && typeof o.observation_id === "number" && str(o.command));

export const isExploreResult = (v: unknown): v is ExploreResult => isRecord(v) && strings(v.unverifiable_conditions) && strings(v.notes)
  && typeof v.candidate_count === "number" && typeof v.cache_hit === "boolean"
  && isRecord(v.applied_filters) && strings(v.applied_filters.products) && strings(v.applied_filters.codes)
  && listOf(v.cards, (c): c is ExploreResult["cards"][number] => isRecord(c) && str(c.item_id) && str(c.title_ko) && str(c.product) && str(c.category) && str(c.reason));

export const isItems = (v: unknown): v is { items: Item[]; index_ready: boolean } => isRecord(v) && typeof v.index_ready === "boolean"
  && listOf(v.items, (i): i is Item => isRecord(i) && str(i.item_id) && str(i.title_ko) && str(i.product) && str(i.summary) && str(i.source_url));

export const isJobStart = (v: unknown): v is { job_id: string } => isRecord(v) && str(v.job_id);
