import type { SchemaResponse } from "@/lib/schema/types";
import type { SessionsListResponse } from "./types";

const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://gamemaster-backend:8000";

export interface FetchOptions {
  status?: string;
  limit?: number;
  signal?: AbortSignal;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    cache: "no-store",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Backend ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export async function fetchSessions(opts: FetchOptions = {}): Promise<SessionsListResponse> {
  const params = new URLSearchParams();
  if (opts.status) params.set("status", opts.status);
  if (opts.limit) params.set("limit", String(opts.limit));
  const query = params.toString() ? `?${params.toString()}` : "";
  return request<SessionsListResponse>(`/api/observability/sessions${query}`, {
    signal: opts.signal,
  });
}

export async function closeSession(sessionId: string): Promise<{ id: string; status: string; noop: boolean }> {
  return request(`/api/observability/sessions/${sessionId}/close`, {
    method: "POST",
  });
}

export async function fetchSchema(signal?: AbortSignal): Promise<SchemaResponse> {
  return request<SchemaResponse>("/api/observability/schema", { signal });
}
