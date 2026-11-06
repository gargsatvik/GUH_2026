import { after } from "next/server";
import { z } from "zod";
import { bad, body, json } from "@/lib/http";
import { intakeLine } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  callId: z.string().uuid(),
  speaker: z.enum(["caller", "decoy"]),
  text: z.string().trim().min(1).max(4000),
});

// Fast path: store the line and run the pattern matcher. No Claude here.
export async function POST(req: Request) {
  const b = await body(req, Body);
  if (b instanceof Response) return b;
  const newEntities = await intakeLine(b.callId, b.speaker, b.text, (task) => after(task));
  if (newEntities === null) return bad("Unknown call", 404);
  return json({ ok: true, newEntities });
}
