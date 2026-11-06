import { z } from "zod";
import { body, json } from "@/lib/http";
import { decoyConnected, getSession, requestDecoy, setNatwestCalling, startCall, TransitionError } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json(await getSession());
}

const Body = z.object({
  action: z.enum(["start_call", "request_decoy", "decoy_connected", "set_natwest_calling"]),
  conversationId: z.string().optional(),
  value: z.boolean().optional(),
});

export async function POST(req: Request) {
  const b = await body(req, Body);
  if (b instanceof Response) return b;
  try {
    switch (b.action) {
      case "start_call":
        return json(await startCall());
      case "request_decoy":
        return json(await requestDecoy());
      case "decoy_connected":
        return json(await decoyConnected(b.conversationId ?? null));
      case "set_natwest_calling":
        return json(await setNatwestCalling(Boolean(b.value)));
    }
  } catch (e) {
    if (e instanceof TransitionError) return json({ error: "invalid_transition", state: e.state }, 409);
    throw e;
  }
}
