// Local preview store. Used when Supabase is not configured, so the whole demo
// runs with `npm run dev` and no accounts. State lives in this Node process.
import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { CounterDelta, Table, TableRows } from "@/lib/types";
import { TABLES } from "@/lib/types";
import type { ChangeEvent, Db, Eq, SelectOpts } from "./types";
import {
  DAY,
  FLAG_REASON_SEED,
  SEED_CAMPAIGNS,
  SEED_ENTITIES,
  SEED_PAYMENTS,
  SEED_PAYMENT_REASON,
  seedCallEntityRows,
  seedCallRows,
  seedCampaignFirstSeenAgo,
} from "@/lib/seed";

type Rows = { [T in Table]: TableRows[T][] };

interface MemoryGlobal {
  rows: Rows;
  seq: { transcript_lines: number; timeline_events: number };
  emitter: EventEmitter;
}

const g = globalThis as unknown as { __decoyMemory?: MemoryGlobal };

function emptyRows(): Rows {
  const r = {} as Rows;
  for (const t of TABLES) (r as Record<string, unknown[]>)[t] = [];
  return r;
}

function state(): MemoryGlobal {
  if (!g.__decoyMemory) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(200);
    g.__decoyMemory = { rows: emptyRows(), seq: { transcript_lines: 0, timeline_events: 0 }, emitter };
    seed(g.__decoyMemory);
  }
  return g.__decoyMemory;
}

export function memoryEmitter(): EventEmitter {
  return state().emitter;
}

function emit(e: ChangeEvent) {
  state().emitter.emit("change", e);
}

const iso = (secondsAgo: number) => new Date(Date.now() - secondsAgo * 1000).toISOString();
const now = () => new Date().toISOString();

function defaults(table: Table, s: MemoryGlobal): Record<string, unknown> {
  const t = now();
  switch (table) {
    case "demo_sessions":
      return {
        state: "idle",
        customer_name: "Margaret Wilson",
        customer_first: "Margaret",
        natwest_calling: false,
        genuine_code: null,
        call_id: null,
        conversation_id: null,
        call_started_at: null,
        decoy_requested_at: null,
        decoy_started_at: null,
        ended_at: null,
        replay: false,
        updated_at: t,
      };
    case "campaigns":
      return { first_seen_at: t };
    case "calls":
      return {
        id: randomUUID(),
        status: "live",
        started_at: t,
        ended_at: null,
        duration_seconds: null,
        scam_type: null,
        impersonated_org: null,
        summary: null,
        confidence: null,
        campaign_id: null,
        extraction: null,
      };
    case "transcript_lines":
      return { id: ++s.seq.transcript_lines, created_at: t };
    case "entities":
      return { id: randomUUID(), label: null, flagged: false, flagged_at: null, flag_reason: null, first_seen_at: t };
    case "call_entities":
      return { quote: null, confirmed: false, created_at: t };
    case "payments":
      return { id: randomUUID(), reference: null, reason: null, entity_id: null, created_at: t };
    case "timeline_events":
      return { id: ++s.seq.timeline_events, call_id: null, detail: null, created_at: t };
    case "reports":
      return { id: randomUUID(), sent_to: null, created_at: t };
    case "canary_hits":
      return { id: randomUUID(), call_id: null, created_at: t };
    case "coaching_checks":
      return { id: randomUUID(), payment_id: null, signals: [], answers: [], created_at: t };
    case "counters":
      return {
        calls_taken: 0,
        seconds_wasted: 0,
        accounts_flagged: 0,
        payments_paused: 0,
        value_protected_pence: 0,
        updated_at: t,
      };
  }
}

function matches(row: Record<string, unknown>, opts?: SelectOpts): boolean {
  if (opts?.eq) {
    for (const [k, v] of Object.entries(opts.eq)) if (row[k] !== v) return false;
  }
  if (opts?.in && !opts.in.values.includes(row[opts.in.col] as string | number)) return false;
  return true;
}

function matchEq(row: Record<string, unknown>, eq: Eq) {
  return matches(row, { eq });
}

const clone = <T>(v: T): T => structuredClone(v);

function rawInsert<T extends Table>(s: MemoryGlobal, table: T, row: Partial<TableRows[T]>): TableRows[T] {
  const full = { ...defaults(table, s), ...row } as unknown as TableRows[T];
  (s.rows[table] as TableRows[T][]).push(full);
  return full;
}

function seed(s: MemoryGlobal) {
  s.rows = emptyRows();
  s.seq = { transcript_lines: 0, timeline_events: 0 };
  for (const c of SEED_CAMPAIGNS) {
    rawInsert(s, "campaigns", { ...c, first_seen_at: iso(seedCampaignFirstSeenAgo(c.id)) });
  }
  for (const c of seedCallRows()) {
    rawInsert(s, "calls", {
      id: c.id,
      source: "seed",
      status: "ended",
      started_at: iso(c.startedAgo),
      ended_at: iso(c.endedAgo),
      duration_seconds: c.duration_seconds,
      scam_type: c.scam_type,
      impersonated_org: c.impersonated_org,
      summary: c.summary,
      confidence: c.confidence,
      campaign_id: c.campaign_id,
    });
  }
  const ceRows = seedCallEntityRows();
  for (const e of SEED_ENTITIES) {
    const firstUse = Math.max(...ceRows.filter((r) => r.entity_id === e.id).map((r) => r.createdAgo));
    rawInsert(s, "entities", {
      id: e.id,
      kind: e.kind,
      value: e.value,
      display: e.display,
      label: e.label,
      flagged: e.flaggedDaysAgo !== null,
      flagged_at: e.flaggedDaysAgo !== null ? iso(e.flaggedDaysAgo * DAY) : null,
      flag_reason: e.flaggedDaysAgo !== null ? FLAG_REASON_SEED : null,
      first_seen_at: iso(firstUse),
    });
  }
  for (const r of ceRows) {
    rawInsert(s, "call_entities", {
      call_id: r.call_id,
      entity_id: r.entity_id,
      found_by: "seed",
      confirmed: true,
      created_at: iso(r.createdAgo),
    });
  }
  for (const p of SEED_PAYMENTS) {
    const e = SEED_ENTITIES.find((x) => x.key === p.entityKey)!;
    const [sort, acct] = e.value.split(":");
    rawInsert(s, "payments", {
      id: p.id,
      payee_name: p.payee_name,
      sort_code: sort,
      account_number: acct,
      amount_pence: p.amount_pence,
      status: "paused",
      reason: SEED_PAYMENT_REASON,
      entity_id: e.id,
      created_at: iso(p.daysAgo * DAY),
    });
  }
  rawInsert(s, "counters", {
    id: "demo",
    calls_taken: s.rows.calls.length,
    seconds_wasted: s.rows.calls.reduce((a, c) => a + (c.duration_seconds ?? 0), 0),
    accounts_flagged: s.rows.entities.filter((e) => e.flagged).length,
    payments_paused: s.rows.payments.filter((p) => p.status === "paused").length,
    value_protected_pence: s.rows.payments
      .filter((p) => p.status === "paused")
      .reduce((a, p) => a + p.amount_pence, 0),
  });
  rawInsert(s, "demo_sessions", { id: "demo" });
  rawInsert(s, "timeline_events", { kind: "system", title: "Demo reset" });
}

export const memoryDb: Db = {
  mode: "memory",

  async select(table, opts) {
    const s = state();
    let rows = (s.rows[table] as unknown as Record<string, unknown>[]).filter((r) => matches(r, opts));
    if (opts?.order) {
      const { col, asc = true } = opts.order;
      rows = [...rows].sort((a, b) => {
        const av = a[col] as string | number;
        const bv = b[col] as string | number;
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * (asc ? 1 : -1);
      });
    }
    if (opts?.limit) rows = rows.slice(0, opts.limit);
    return clone(rows) as never;
  },

  async one(table, eq) {
    const s = state();
    const row = (s.rows[table] as unknown as Record<string, unknown>[]).find((r) => matchEq(r, eq));
    return row ? (clone(row) as never) : null;
  },

  async insert(table, row) {
    const s = state();
    const full = rawInsert(s, table, row);
    emit({ table, eventType: "INSERT", new: clone(full) as never });
    return clone(full);
  },

  async insertIfAbsent(table, row, keyCols) {
    const s = state();
    const exists = (s.rows[table] as unknown as Record<string, unknown>[]).some((r) =>
      keyCols.every((k) => r[k] === (row as Record<string, unknown>)[k]),
    );
    if (exists) return null;
    return this.insert(table, row);
  },

  async update(table, eq, patch) {
    const s = state();
    const out: TableRows[typeof table][] = [];
    for (const r of s.rows[table] as unknown as Record<string, unknown>[]) {
      if (!matchEq(r, eq)) continue;
      const old = clone(r);
      Object.assign(r, patch);
      if ("updated_at" in r && !("updated_at" in (patch as object))) r.updated_at = now();
      emit({ table, eventType: "UPDATE", new: clone(r), old });
      out.push(clone(r) as never);
    }
    return out;
  },

  async bumpCounters(delta: CounterDelta) {
    const s = state();
    const c = s.rows.counters.find((r) => r.id === "demo");
    if (!c) return;
    const patch: Partial<TableRows["counters"]> = {};
    for (const [k, v] of Object.entries(delta)) {
      const key = k as keyof CounterDelta;
      patch[key] = (c[key] as number) + (v ?? 0);
    }
    await this.update("counters", { id: "demo" }, patch);
  },

  async resetDemo() {
    const s = state();
    seed(s);
    emit({ table: "*", eventType: "RESET" });
  },
};
