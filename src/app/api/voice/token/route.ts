import { json } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Short-lived credential for the ElevenLabs agent (section 12.4).
// ?agent=decoy (default) or ?agent=protect (coaching check, stretch 6).
export async function GET(req: Request) {
  const which = new URL(req.url).searchParams.get("agent") === "protect" ? "protect" : "decoy";
  const key = process.env.ELEVENLABS_API_KEY;
  const agentId = which === "protect" ? process.env.ELEVENLABS_PROTECT_AGENT_ID : process.env.ELEVENLABS_DECOY_AGENT_ID;
  if (!key || !agentId) return json({ error: "not_configured" }, 503);

  const base = "https://api.elevenlabs.io/v1/convai/conversation";
  const headers = { "xi-api-key": key };
  try {
    const r = await fetch(`${base}/token?agent_id=${encodeURIComponent(agentId)}`, { headers, cache: "no-store" });
    if (r.ok) {
      const d = (await r.json()) as { token?: string };
      if (d.token) return json({ conversationToken: d.token });
    }
    const s = await fetch(`${base}/get-signed-url?agent_id=${encodeURIComponent(agentId)}`, { headers, cache: "no-store" });
    if (s.ok) {
      const d = (await s.json()) as { signed_url?: string };
      if (d.signed_url) return json({ signedUrl: d.signed_url });
    }
    return json({ error: "voice_unavailable", status: s.status }, 502);
  } catch {
    return json({ error: "voice_unavailable" }, 502);
  }
}
