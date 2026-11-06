import { after } from "next/server";
import { z } from "zod";
import { bad, body, json } from "@/lib/http";
import { endCall } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Body = z.object({
  callId: z.string().uuid(),
  reason: z.enum(["caller_hung_up", "operator_ended", "timeout"]),
});

export async function POST(req: Request) {
  const b = await body(req, Body);
  if (b instanceof Response) return b;
  // The final capture pass and the fraud report run after the response, so
  // every screen shows the summary straight away.
  const r = await endCall(b.callId, (task) => after(task));
  if (!r) return bad("Unknown call", 404);
  return json({ ok: true, durationSeconds: r.durationSeconds });
}
