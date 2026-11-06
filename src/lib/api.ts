"use client";
// Small browser helpers for calling our API routes.

export async function post<T = unknown>(url: string, body: unknown = {}): Promise<T> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error((data as { error?: string }).error ?? `HTTP ${r.status}`), { status: r.status, data });
  return data as T;
}

export type SessionAction = "start_call" | "request_decoy" | "decoy_connected" | "set_natwest_calling";

export const postSession = (action: SessionAction, extra: Record<string, unknown> = {}) =>
  post("/api/session", { action, ...extra });
