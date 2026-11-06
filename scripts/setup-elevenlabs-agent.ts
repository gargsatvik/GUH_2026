// Creates (or updates) the "Decoy - David" ElevenLabs agent from agents/decoy-david.md,
// then saves its id to .env.local as ELEVENLABS_DECOY_AGENT_ID.
//
// Run from the decoy folder:  npm run setup:voice
// Needs ELEVENLABS_API_KEY in .env.local with "ElevenLabs Agents: Write" and "Voices: Read".
// The key is read from the file and never printed.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { CANARY_VARIABLES } from "../src/lib/canary.ts";

const ENV_FILE = ".env.local";
const API = "https://api.elevenlabs.io/v1";

// "George": a warm, middle-aged British male stock voice. Change here or in the dashboard.
const PREFERRED_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

function readEnv(): Record<string, string> {
  if (!existsSync(ENV_FILE)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function setEnv(key: string, value: string) {
  const text = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8") : "";
  const line = `${key}=${value}`;
  const next = new RegExp(`^${key}=.*$`, "m").test(text)
    ? text.replace(new RegExp(`^${key}=.*$`, "m"), line)
    : `${text.replace(/\n?$/, "\n")}${line}\n`;
  writeFileSync(ENV_FILE, next);
}

/** The first fenced block after a "## heading" in the agent file. */
function section(md: string, heading: string): string {
  const after = md.split(`## ${heading}`)[1];
  const block = after?.match(/```\n([\s\S]*?)```/);
  if (!block) throw new Error(`Could not find "${heading}" in agents/decoy-david.md`);
  return block[1].trim();
}

async function call(path: string, key: string, init: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "xi-api-key": key, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function explain(r: { status: number; body: unknown }): string {
  const d = (r.body as { detail?: { message?: string } | unknown })?.detail;
  const msg = typeof d === "object" && d && "message" in d ? (d as { message: string }).message : JSON.stringify(d ?? r.body);
  return `HTTP ${r.status}: ${msg}`;
}

async function main() {
  const env = readEnv();
  const key = env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("Add ELEVENLABS_API_KEY to .env.local first.");

  const md = readFileSync("agents/decoy-david.md", "utf8");
  const firstMessage = section(md, "First message");
  const prompt = section(md, "System prompt");

  // Use George if the account has him, otherwise the first British male voice we can find.
  let voiceId = PREFERRED_VOICE_ID;
  const voices = await call("/voices", key);
  if (voices.ok) {
    const list = (voices.body as { voices: { voice_id: string; name: string; labels?: Record<string, string> }[] }).voices;
    const preferred = list.find((v) => v.voice_id === PREFERRED_VOICE_ID);
    const british = list.find((v) => v.labels?.gender === "male" && /brit/i.test(v.labels?.accent ?? ""));
    const pick = preferred ?? british;
    if (pick) voiceId = pick.voice_id;
    console.log(`Voice: ${pick?.name ?? "George (default)"} (${voiceId})`);
  } else {
    console.log(`Could not list voices (${explain(voices)}). Using George (${voiceId}).`);
  }

  const config = {
    name: "Decoy - David",
    tags: ["decoy", "greatunihack-2026"],
    conversation_config: {
      agent: {
        first_message: firstMessage,
        language: "en",
        prompt: { prompt, llm: "gemini-2.5-flash" },
        // Values used when testing in the ElevenLabs dashboard. The app sends the same ones.
        dynamic_variables: { dynamic_variable_placeholders: { ...CANARY_VARIABLES } },
      },
      tts: { voice_id: voiceId, stability: 0.4, speed: 0.95 },
      turn: { turn_timeout: 8 },
      conversation: {
        // 15 minutes on the day (plan section 14.1); 5 minutes while testing saves credits.
        max_duration_seconds: Number(process.env.DECOY_MAX_SECONDS ?? 300),
        client_events: ["audio", "interruption", "user_transcript", "agent_response", "agent_response_correction"],
      },
    },
    // Private agent: only our server, holding the key, can start a conversation.
    platform_settings: { auth: { enable_auth: true } },
  };

  const existing = env.ELEVENLABS_DECOY_AGENT_ID;
  if (existing) {
    const r = await call(`/convai/agents/${existing}`, key, { method: "PATCH", body: JSON.stringify(config) });
    if (!r.ok) throw new Error(`Updating agent ${existing} failed. ${explain(r)}`);
    console.log(`Updated agent "Decoy - David" (${existing}).`);
    return;
  }
  const r = await call("/convai/agents/create", key, { method: "POST", body: JSON.stringify(config) });
  if (!r.ok) throw new Error(`Creating the agent failed. ${explain(r)}`);
  const agentId = (r.body as { agent_id: string }).agent_id;
  setEnv("ELEVENLABS_DECOY_AGENT_ID", agentId);
  console.log(`Created agent "Decoy - David" (${agentId}) and saved it to .env.local.`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
