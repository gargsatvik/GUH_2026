import "server-only";
// Structured capture with Claude (section 15.2), plus the shared request helper
// used by the fraud report (15.3) and the coaching check (15.4).
//
// Notes against the plan, from the current Claude API:
// - Forced tool_choice ({type: "tool"}) is rejected by current Sonnet and Opus
//   models, so we use tool_choice "auto", strict tool schemas and an explicit
//   instruction to call the tool, then validate with zod.
// - temperature is no longer accepted; effort "low" keeps latency down.
// - Server-side refusal fallback is on ("fallbacks": "default"). If the API
//   rejects that parameter, the request is retried once without it.
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage, MessageCreateParamsNonStreaming as BetaMessageCreateParamsNonStreaming, BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { anthropicConfigured, anthropicModel } from "../env";
import { ExtractionSchema, type Extraction, type TranscriptLine } from "../types";

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic({ maxRetries: 0 }));

export async function claudeCreate(
  params: Omit<BetaMessageCreateParamsNonStreaming, "model">,
  timeoutMs = 12000,
): Promise<BetaMessage | null> {
  if (!anthropicConfigured()) return null;
  const base = { model: anthropicModel(), output_config: { effort: "low" as const }, ...params };
  try {
    return await anthropic().beta.messages.create(
      { ...base, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" },
      { timeout: timeoutMs },
    );
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError) {
      console.warn("[claude] retrying without fallbacks:", e.message);
      try {
        return await anthropic().beta.messages.create(base, { timeout: timeoutMs });
      } catch (e2) {
        console.warn("[claude] request failed:", e2 instanceof Error ? e2.message : e2);
        return null;
      }
    }
    console.warn("[claude] request failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Returns the input of the first call to `toolName`, or null. */
export function toolInput(msg: BetaMessage | null, toolName: string): unknown {
  if (!msg || msg.stop_reason === "refusal") return null;
  const block = msg.content.find((b) => b.type === "tool_use" && b.name === toolName);
  return block && block.type === "tool_use" ? block.input : null;
}

export function messageText(msg: BetaMessage | null): string | null {
  if (!msg || msg.stop_reason === "refusal") return null;
  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
  return text || null;
}

const EXTRACTION_SYSTEM = `You are a fraud analyst at a UK bank. You will read the transcript of a phone call. "Caller" is a suspected criminal. "Decoy" is a bank-controlled decoy pretending to be the customer's son.

Record only details that the Caller stated or asked for. Never record anything the Decoy said, including any card numbers, customer numbers, passcodes or PIN digits the Decoy read out; those are decoy details owned by the bank.

Normalise UK sort codes as NN-NN-NN and account numbers as 8 digits. Normalise UK phone numbers in national format with spaces, for example 0161 496 0732. If a detail was repeated with corrections, record the final version the Caller confirmed. If you are unsure of a digit, still record your best reading and lower the confidence.

Choose scam_type from: safe_account, impersonation_bank, impersonation_police, impersonation_government, courier, investment, romance, purchase, invoice_redirect, remote_access, other.

Write the summary as one or two plain sentences that a bank fraud officer could read in five seconds.

Always answer by calling the record_scam_details tool exactly once. Use empty lists for anything not mentioned.`;

const str = { type: "string" } as const;
const strArr = { type: "array", items: { type: "string" } } as const;

const EXTRACTION_TOOL: BetaTool = {
  name: "record_scam_details",
  description: "Record the details a suspected criminal disclosed during a call.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      scam_type: str,
      impersonated_org: { type: "string", description: "Who the caller claims to be from, e.g. NatWest fraud team" },
      caller_names: strArr,
      callback_numbers: strArr,
      payee_accounts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            sort_code: str,
            account_number: str,
            account_name: str,
            quote: { type: "string", description: "The caller's words that gave this account" },
          },
          required: ["sort_code", "account_number", "account_name", "quote"],
        },
      },
      crypto_wallets: strArr,
      urls: strArr,
      amount_requested_pounds: { type: "number" },
      requested_actions: { ...strArr, description: "What the caller asked the customer to do" },
      pressure_tactics: strArr,
      script_phrases: { ...strArr, description: "Distinctive phrases useful to match other calls" },
      confidence: { type: "number" },
      summary: str,
    },
    required: [
      "scam_type",
      "impersonated_org",
      "caller_names",
      "callback_numbers",
      "payee_accounts",
      "crypto_wallets",
      "urls",
      "amount_requested_pounds",
      "requested_actions",
      "pressure_tactics",
      "script_phrases",
      "confidence",
      "summary",
    ],
  },
};

export function transcriptText(lines: Pick<TranscriptLine, "speaker" | "text">[]): string {
  return lines.map((l) => `${l.speaker === "caller" ? "Caller" : "Decoy"}: ${l.text}`).join("\n");
}

export async function extractDetails(lines: TranscriptLine[]): Promise<Extraction | null> {
  if (!lines.some((l) => l.speaker === "caller")) return null;
  const msg = await claudeCreate({
    max_tokens: 4000,
    system: EXTRACTION_SYSTEM,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: transcriptText(lines) }],
  });
  const input = toolInput(msg, "record_scam_details");
  if (!input) return null;
  const parsed = ExtractionSchema.safeParse(input);
  if (!parsed.success) {
    console.warn("[claude] extraction did not validate", parsed.error.message);
    return null;
  }
  return parsed.data;
}
