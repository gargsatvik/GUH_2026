import { z } from "zod";
import { body, json, requireSecret } from "@/lib/http";
import { writeReport, type SessionEndedPayload } from "@/lib/report";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Used by the n8n "session-ended" workflow: writes the fraud report from the
// call-ended payload. Claude writes it when ANTHROPIC_API_KEY is set, otherwise
// it is built from a template. Secret required.
const Body = z.object({ callId: z.string().uuid(), call: z.object({ started_at: z.string() }).passthrough() }).passthrough();

export async function POST(req: Request) {
  const denied = requireSecret(req);
  if (denied) return denied;
  const b = await body(req, Body);
  if (b instanceof Response) return b;
  return json(await writeReport(b as unknown as SessionEndedPayload));
}
