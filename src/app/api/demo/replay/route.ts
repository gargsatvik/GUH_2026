import { json, requireSecret } from "@/lib/http";
import { startReplay } from "@/lib/replay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Starts a replay call (section 24.1). The line-by-line loop runs in the ops
// browser so it is never cut off by a serverless time limit.
export async function POST(req: Request) {
  const denied = requireSecret(req);
  if (denied) return denied;
  const r = await startReplay();
  return "error" in r ? json(r, 409) : json(r);
}
