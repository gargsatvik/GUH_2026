"use client";
// Subscribe to a table and keep its rows in state (section 23).
// Uses Supabase Realtime when configured, otherwise the local preview stream.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { browserClient, browserSupabaseConfigured } from "./supabase/browser";
import { rowKey, type Table, type TableRows } from "./types";
import type { ChangeEvent } from "./db/types";

export interface RealtimeOpts {
  filter?: { col: string; value: string | null | undefined };
  order?: { col: string; asc?: boolean };
  limit?: number;
  enabled?: boolean;
}

// ---------- connection status ----------

type Status = "connected" | "reconnecting";
let status: Status = "connected";
const statusListeners = new Set<() => void>();
function setStatus(s: Status) {
  if (s === status) return;
  status = s;
  statusListeners.forEach((l) => l());
}
export function useConnectionStatus(): Status {
  return useSyncExternalStore(
    (l) => {
      statusListeners.add(l);
      return () => statusListeners.delete(l);
    },
    () => status,
    () => "connected",
  );
}

// ---------- local preview stream (one EventSource per page) ----------

type Listener = (e: ChangeEvent) => void;
const localListeners = new Set<Listener>();
const reconnectListeners = new Set<() => void>();
let source: EventSource | null = null;

function ensureSource() {
  if (source || typeof window === "undefined") return;
  source = new EventSource("/api/local/stream");
  let hadError = false;
  source.onmessage = (m) => {
    try {
      const e = JSON.parse(m.data) as ChangeEvent;
      localListeners.forEach((l) => l(e));
    } catch {}
  };
  source.onerror = () => {
    hadError = true;
    setStatus("reconnecting");
  };
  source.onopen = () => {
    setStatus("connected");
    if (hadError) {
      hadError = false;
      reconnectListeners.forEach((l) => l());
    }
  };
}

async function localSelect<T extends Table>(table: T, opts: RealtimeOpts): Promise<TableRows[T][]> {
  const p = new URLSearchParams({ table });
  if (opts.filter && opts.filter.value != null) {
    p.set("col", opts.filter.col);
    p.set("val", opts.filter.value);
  }
  if (opts.order) {
    p.set("order", opts.order.col);
    p.set("asc", String(opts.order.asc ?? true));
  }
  if (opts.limit) p.set("limit", String(opts.limit));
  const r = await fetch(`/api/local/select?${p}`, { cache: "no-store" });
  if (!r.ok) throw new Error("select failed");
  return r.json();
}

async function supabaseSelect<T extends Table>(table: T, opts: RealtimeOpts): Promise<TableRows[T][]> {
  let q = browserClient().from(table).select("*");
  if (opts.filter && opts.filter.value != null) q = q.eq(opts.filter.col, opts.filter.value);
  if (opts.order) q = q.order(opts.order.col, { ascending: opts.order.asc ?? true });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as TableRows[T][];
}

function sortRows<T>(rows: T[], opts: RealtimeOpts): T[] {
  let out = rows;
  if (opts.order) {
    const { col, asc = true } = opts.order;
    out = [...rows].sort((a, b) => {
      const av = (a as Record<string, unknown>)[col] as string | number;
      const bv = (b as Record<string, unknown>)[col] as string | number;
      if (av === bv) return 0;
      return (av > bv ? 1 : -1) * (asc ? 1 : -1);
    });
  }
  if (opts.limit) out = out.slice(0, opts.limit);
  return out;
}

export function useRealtime<T extends Table>(table: T, opts: RealtimeOpts = {}) {
  const [rows, setRows] = useState<TableRows[T][]>([]);
  const [loaded, setLoaded] = useState(false);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const enabled = opts.enabled !== false && !(opts.filter && opts.filter.value == null);
  const filterKey = `${opts.filter?.col}=${opts.filter?.value}`;
  const orderKey = `${opts.order?.col}:${opts.order?.asc}:${opts.limit}`;

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      setLoaded(true);
      return;
    }
    let cancelled = false;
    const useSb = browserSupabaseConfigured();
    const load = async () => {
      try {
        const data = await (useSb ? supabaseSelect(table, optsRef.current) : localSelect(table, optsRef.current));
        if (!cancelled) {
          setRows(data);
          setLoaded(true);
        }
      } catch {
        if (!cancelled) setStatus("reconnecting");
      }
    };

    const apply = (e: ChangeEvent) => {
      if (e.eventType === "RESET") {
        load();
        return;
      }
      if (e.table !== table) return;
      const f = optsRef.current.filter;
      const row = (e.new ?? e.old) as Record<string, unknown> | undefined;
      if (!row) return;
      if (f && e.eventType !== "DELETE" && row[f.col] !== f.value) {
        // Row may have moved out of the filter.
        setRows((prev) => prev.filter((r) => rowKey(table, r as never) !== rowKey(table, row)));
        return;
      }
      setRows((prev) => {
        const key = rowKey(table, row);
        const without = prev.filter((r) => rowKey(table, r as never) !== key);
        if (e.eventType === "DELETE") return without;
        return sortRows([...without, e.new as unknown as TableRows[T]], optsRef.current);
      });
    };

    load();

    if (useSb) {
      const f = optsRef.current.filter;
      const channel = browserClient()
        .channel(`rt:${table}:${filterKey}:${Math.random().toString(36).slice(2)}`)
        .on(
          "postgres_changes" as never,
          { event: "*", schema: "public", table, ...(f ? { filter: `${f.col}=eq.${f.value}` } : {}) },
          (payload: { eventType: ChangeEvent["eventType"]; new: Record<string, unknown>; old: Record<string, unknown> }) =>
            apply({ table, eventType: payload.eventType, new: payload.new, old: payload.old }),
        )
        .subscribe((s: string) => {
          if (s === "SUBSCRIBED") {
            setStatus("connected");
            load();
          } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT" || s === "CLOSED") setStatus("reconnecting");
        });
      return () => {
        cancelled = true;
        browserClient().removeChannel(channel);
      };
    }

    ensureSource();
    localListeners.add(apply);
    reconnectListeners.add(load);
    return () => {
      cancelled = true;
      localListeners.delete(apply);
      reconnectListeners.delete(load);
    };
  }, [table, enabled, filterKey, orderKey]);

  return { rows, loaded };
}

/** The single shared demo session row. */
export function useSession() {
  const { rows, loaded } = useRealtime("demo_sessions", { filter: { col: "id", value: "demo" } });
  return { session: rows[0] ?? null, loaded };
}

/**
 * Current time, ticking. Returns 0 until the page has hydrated, so the server
 * and the first browser render produce the same HTML (no hydration mismatch).
 */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
