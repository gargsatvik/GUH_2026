import { db } from "@/lib/db";
import { supabaseConfigured } from "@/lib/env";
import { bad, json } from "@/lib/http";
import { TABLES, type Table } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Local preview only: read access for browsers when Supabase is not configured.
export async function GET(req: Request) {
  if (supabaseConfigured()) return bad("Not available", 404);
  const p = new URL(req.url).searchParams;
  const table = p.get("table") as Table;
  if (!TABLES.includes(table)) return bad("Unknown table");
  const col = p.get("col");
  const val = p.get("val");
  const order = p.get("order");
  const limit = Number(p.get("limit")) || undefined;
  const rows = await db().select(table, {
    eq: col && val !== null ? { [col]: val } : undefined,
    order: order ? { col: order, asc: p.get("asc") !== "false" } : undefined,
    limit,
  });
  return json(rows);
}
