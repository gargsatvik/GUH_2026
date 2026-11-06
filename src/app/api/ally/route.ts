import { z } from "zod";
import { bad, body, json } from "@/lib/http";
import { allyDecision } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ paymentId: z.string().uuid(), decision: z.enum(["approve", "decline"]) });

export async function POST(req: Request) {
  const b = await body(req, Body);
  if (b instanceof Response) return b;
  const p = await allyDecision(b.paymentId, b.decision);
  if (!p) return bad("Unknown payment", 404);
  return json({ ok: true, status: p.status });
}
