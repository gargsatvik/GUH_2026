import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Which voice lines are set up, so screens can choose a fallback without
// requesting a token that is bound to fail.
export async function GET() {
  const key = Boolean(process.env.ELEVENLABS_API_KEY);
  return json({
    decoy: key && Boolean(process.env.ELEVENLABS_DECOY_AGENT_ID),
    protect: key && Boolean(process.env.ELEVENLABS_PROTECT_AGENT_ID),
  });
}
