// Environment helpers (section 9). Everything degrades gracefully when unset,
// so the project runs locally with no keys at all.

export const SESSION_ID = () => process.env.DEMO_SESSION_ID || "demo";

export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export const anthropicConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY);
export const anthropicModel = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

export const elevenlabsConfigured = () =>
  Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_DECOY_AGENT_ID);

export const n8nEnabled = () => process.env.N8N_ENABLED === "true";

export function checkSecret(req: Request): boolean {
  const secret = process.env.N8N_SHARED_SECRET;
  if (!secret) return true; // local preview: no secret configured
  return req.headers.get("x-decoy-secret") === secret;
}
