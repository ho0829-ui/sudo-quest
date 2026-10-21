export interface Health {
  status: "ok";
  service: string;
  providers: Record<"generation" | "embedding", {
    configured: boolean;
    missing: string[];
    verified: boolean;
  }>;
  index: { status: string; counts: Record<string, number> };
  rag_status: string;
}

export async function getHealth(signal?: AbortSignal): Promise<Health> {
  const response = await fetch("/api/health", { signal });
  if (!response.ok) throw new Error("backend_unavailable");
  const data: Health = await response.json();
  if (data.service !== "InfraCoach" || data.status !== "ok" || !data.providers || !data.index) {
    throw new Error("invalid_health_response");
  }
  return data;
}
