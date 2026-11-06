import "server-only";
// Coaching check (section 15.4, stretch 6).
import type { BetaTool } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { claudeCreate, toolInput } from "./capture/claude";
import { CoachingSchema, type Coaching } from "./types";

const SYSTEM = `You assess whether a bank customer is being coached by a third party during a payment. Signals include: rehearsed or evasive answers to purpose, mention of being told what to say, urgency attributed to someone else, mention of another person on the phone, reluctance to answer. Be cautious: older customers may be hesitant without being coached.

Always answer by calling the assess_coaching tool exactly once. Write signals and the suggested action in plain British English for a bank fraud officer.`;

const TOOL: BetaTool = {
  name: "assess_coaching",
  description: "Record how likely it is that the customer is being coached.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      likelihood: { type: "string", enum: ["low", "medium", "high"] },
      signals: { type: "array", items: { type: "string" } },
      suggested_action: { type: "string" },
    },
    required: ["likelihood", "signals", "suggested_action"],
  },
};

/** Keyword check used when Claude is unavailable. */
export function heuristicCoaching(answers: { question: string; answer: string }[]): Coaching {
  const text = answers.map((a) => a.answer.toLowerCase()).join(" \n ");
  const signals: string[] = [];
  if (/(told me|said to|asked me to|instructed|they said)/.test(text)) signals.push("Says someone told them what to do or say");
  if (/(on the (other )?phone|still on the line|on hold|in the room|with me now|listening)/.test(text))
    signals.push("Mentions another person on the phone or in the room");
  if (/(safe account|bank (said|told)|fraud team|police|protect my money|move my (money|savings))/.test(text))
    signals.push("Describes moving money to keep it safe");
  if (/(urgent|right now|quickly|hurry|today|before)/.test(text)) signals.push("Urgency attributed to someone else");
  if (answers.filter((a) => a.answer.trim().length < 3).length >= 2) signals.push("Reluctant or very short answers");
  const likelihood: Coaching["likelihood"] = signals.length >= 2 ? "high" : signals.length === 1 ? "medium" : "low";
  return {
    likelihood,
    signals,
    suggested_action:
      likelihood === "low"
        ? "Release the payment after a standard review."
        : "Keep the payment paused and call the customer back on their registered number.",
  };
}

export async function assessCoaching(answers: { question: string; answer: string }[]): Promise<Coaching> {
  const transcript = answers.map((a) => `NatWest: ${a.question}\nCustomer: ${a.answer}`).join("\n");
  const msg = await claudeCreate({
    max_tokens: 2000,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: transcript }],
  });
  const parsed = CoachingSchema.safeParse(toolInput(msg, "assess_coaching"));
  return parsed.success ? parsed.data : heuristicCoaching(answers);
}
