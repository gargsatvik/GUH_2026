import { z } from "zod";
import { body, json } from "@/lib/http";
import { runCapture } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Body = z.object({ callId: z.string().uuid() });

export async function POST(req: Request) {
  const b = await body(req, Body);
  if (b instanceof Response) return b;
  const details = await runCapture(b.callId);
  return json({ ok: true, details });
}
