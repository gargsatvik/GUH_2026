import { createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { db } from "@/lib/db";
import { bad, json } from "@/lib/http";
import { endCall, intakeLine } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Stretch 7: a real phone number for the Decoy line.
// Connect a Twilio number to the "Decoy - David" agent in the ElevenLabs
// dashboard, and point the agent's post-call webhook here. ElevenLabs sends the
// whole transcript when the phone call ends, and it runs through the same
// pipeline as a live browser call. Phone calls appear on the dashboard when
// they end, not word by word.
// Check the payload shape and signature format against current ElevenLabs docs.

interface PostCall {
  type?: string;
  data?: {
    agent_id?: string;
    conversation_id?: string;
    transcript?: { role: "user" | "agent"; message: string | null; time_in_call_secs?: number }[];
    metadata?: { call_duration_secs?: number; start_time_unix_secs?: number };
  };
}

function verify(raw: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  if (!parts.t || !parts.v0) return false;
  if (Math.abs(Date.now() / 1000 - Number(parts.t)) > 30 * 60) return false;
  const mac = createHmac("sha256", secret).update(`${parts.t}.${raw}`).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(parts.v0);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
  if (secret && !verify(raw, req.headers.get("elevenlabs-signature"), secret)) return bad("Bad signature", 401);

  let p: PostCall;
  try {
    p = JSON.parse(raw);
  } catch {
    return bad("Body must be JSON");
  }
  if (p.type !== "post_call_transcription" || !p.data?.transcript) return json({ ok: true, ignored: true });
  if (process.env.ELEVENLABS_DECOY_AGENT_ID && p.data.agent_id !== process.env.ELEVENLABS_DECOY_AGENT_ID)
    return json({ ok: true, ignored: true });

  const duration = p.data.metadata?.call_duration_secs ?? 0;
  const startedAt = p.data.metadata?.start_time_unix_secs
    ? new Date(p.data.metadata.start_time_unix_secs * 1000)
    : new Date(Date.now() - duration * 1000);

  const call = await db().insert("calls", { source: "phone", status: "live", started_at: startedAt.toISOString() });
  for (const t of p.data.transcript) {
    if (!t.message?.trim()) continue;
    await intakeLine(call.id, t.role === "user" ? "caller" : "decoy", t.message.trim());
  }
  await endCall(call.id, (task) => after(task));
  return json({ ok: true, callId: call.id });
}
