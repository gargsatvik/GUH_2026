import "server-only";
import type { CounterDelta } from "@/lib/types";
import { serverClient } from "@/lib/supabase/server";
import type { Db, Eq, SelectOpts } from "./types";

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export const supabaseDb: Db = {
  mode: "supabase",

  async select(table, opts?: SelectOpts) {
    let q = serverClient().from(table).select("*");
    if (opts?.eq) for (const [k, v] of Object.entries(opts.eq)) q = v === null ? q.is(k, null) : q.eq(k, v);
    if (opts?.in) q = q.in(opts.in.col, opts.in.values);
    if (opts?.order) q = q.order(opts.order.col, { ascending: opts.order.asc ?? true });
    if (opts?.limit) q = q.limit(opts.limit);
    return check(await q) as never;
  },

  async one(table, eq: Eq) {
    let q = serverClient().from(table).select("*");
    for (const [k, v] of Object.entries(eq)) q = v === null ? q.is(k, null) : q.eq(k, v);
    return check(await q.maybeSingle()) as never;
  },

  async insert(table, row) {
    return check(await serverClient().from(table).insert(row as never).select("*").single()) as never;
  },

  async insertIfAbsent(table, row, keyCols) {
    const res = await serverClient()
      .from(table)
      .upsert(row as never, { onConflict: keyCols.join(","), ignoreDuplicates: true })
      .select("*");
    const rows = check(res) as unknown[];
    return (rows[0] ?? null) as never;
  },

  async update(table, eq, patch) {
    let q = serverClient().from(table).update(patch as never);
    for (const [k, v] of Object.entries(eq)) q = v === null ? q.is(k, null) : q.eq(k, v);
    return check(await q.select("*")) as never;
  },

  async bumpCounters(delta: CounterDelta) {
    check(
      await serverClient().rpc("bump_counters", {
        p_calls: delta.calls_taken ?? 0,
        p_seconds: delta.seconds_wasted ?? 0,
        p_accounts: delta.accounts_flagged ?? 0,
        p_payments: delta.payments_paused ?? 0,
        p_value: delta.value_protected_pence ?? 0,
      }),
    );
  },

  async resetDemo() {
    check(await serverClient().rpc("reset_demo"));
  },
};
