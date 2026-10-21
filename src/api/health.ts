export interface Health {
  status: 'ok';
  service: string;
  providers: Record<'generation' | 'embedding', {
    configured: boolean;
    missing: string[];
    verified: boolean;
  }>;
  index: { status: string; counts: Record<string, number> };
  rag_status: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 네트워크 응답은 타입 단언만으로 신뢰할 수 없다. 렌더링에 쓰는 중첩 필드까지 검사한다. */
export function isHealth(value: unknown): value is Health {
  if (!isRecord(value) || value.status !== 'ok' || value.service !== 'InfraCoach'
    || !isRecord(value.providers) || !isRecord(value.index) || typeof value.rag_status !== 'string') return false;
  for (const kind of ['generation', 'embedding']) {
    const provider = value.providers[kind];
    if (!isRecord(provider) || typeof provider.configured !== 'boolean' || typeof provider.verified !== 'boolean'
      || !Array.isArray(provider.missing) || !provider.missing.every(name => typeof name === 'string')) return false;
  }
  return typeof value.index.status === 'string' && isRecord(value.index.counts)
    && Object.values(value.index.counts).every(count => typeof count === 'number' && Number.isInteger(count) && count >= 0);
}

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const response = await fetch('/api/health', { signal });
  if (!response.ok) throw new Error('backend_unavailable');
  const data: unknown = await response.json();
  if (!isHealth(data)) throw new Error('invalid_health_response');
  return data;
}
