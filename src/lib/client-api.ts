import { AUTH_TOKEN_STORAGE_KEY } from "@/lib/auth/constants";

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    message: string;
    details?: unknown;
  };
}

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<ApiResponse<T>> {
  const headers = new Headers(init?.headers ?? {});
  const method = (init?.method ?? "GET").toUpperCase();

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (typeof window !== "undefined" && !headers.has("authorization")) {
    const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    if (token) {
      headers.set("authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(input, {
    ...init,
    headers,
    cache: method === "GET" || method === "HEAD" ? "no-store" : init?.cache
  });

  const payload = (await response.json().catch(() => ({}))) as ApiResponse<T>;

  if (!response.ok) {
    return {
      ok: false,
      error: payload.error ?? { message: `Request failed with status ${response.status}` }
    };
  }

  return payload;
}
