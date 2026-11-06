import "server-only";
// Fraud report (section 15.3). Written by Claude when available, otherwise
// built from a template using the captured details.
import { claudeCreate, messageText } from "./capture/claude";
import { dateTime, durationWords, scamTypeLabel } from "./format";
import type { Call, Entity, Extraction, TimelineEvent, TranscriptLine } from "./types";

export interface SessionEndedPayload {
  callId: string;
  call: Call;
  extraction: Extraction | null;
  entities: (Pick<Entity, "kind" | "display" | "label" | "flagged"> & { earlierCalls: number })[];
  matches: { callId: string; date: string; campaign: string | null; sharedDetail: string }[];
  campaignName: string | null;
  timeline: Pick<TimelineEvent, "created_at" | "kind" | "title">[];
  transcriptTail: Pick<TranscriptLine, "speaker" | "text">[];
}

const REPORT_SYSTEM = `You write fraud intelligence reports for a UK bank's fraud operations team. Write in plain, factual British English. No speculation beyond the evidence. Use short sections with these headings exactly: Summary, What the caller asked for, Details captured, Links to earlier reports, Actions already taken, Suggested next steps. Use a table for Details captured. Keep the whole report under 350 words. Do not include decoy details read out by the decoy.

Format the report in Markdown, using "## " for each heading. Do not add a title line; the title is shown separately. Write only the report.`;

export function reportTitle(p: SessionEndedPayload): string {
  return `Fraud report: ${scamTypeLabel(p.call.scam_type ?? p.extraction?.scam_type)}, ${dateTime(p.call.started_at)}`;
}

const KIND_LABEL: Record<string, string> = {
  account: "Payee account",
  phone: "Callback number",
  url: "Link",
  wallet: "Crypto wallet",
  alias: "Caller name",
};

export function templateReport(p: SessionEndedPayload): string {
  const x = p.extraction;
  const asked = x?.requested_actions?.length
    ? x.requested_actions.map((a) => `- ${a}`).join("\n")
    : "- Move money to an account the caller controls";
  const amount = x?.amount_requested_pounds ? `\n- Amount asked for: £${x.amount_requested_pounds.toLocaleString("en-GB")}` : "";
  const rows = p.entities
    .map(
      (e) =>
        `| ${KIND_LABEL[e.kind]} | ${e.display}${e.label ? ` (${e.label})` : ""} | ${
          e.earlierCalls ? `Seen in ${e.earlierCalls} earlier reports` : "New"
        }${e.flagged ? ", blocked" : ""} |`,
    )
    .join("\n");
  const links = p.matches.length
    ? p.matches.map((m) => `- ${m.date}: ${m.campaign ?? "No campaign"}, shared ${m.sharedDetail}`).join("\n")
    : "- No earlier reports share these details.";
  const actions = p.timeline
    .filter((t) => ["flag", "match", "capture"].includes(t.kind))
    .map((t) => `- ${t.title}`)
    .join("\n");
  return `## Summary
${x?.summary || p.call.summary || "A caller impersonated the bank and was passed to the Decoy line by the customer."} The call lasted ${durationWords(
    p.call.duration_seconds ?? 0,
  )}${p.campaignName ? ` and is linked to the campaign ${p.campaignName}` : ""}.

## What the caller asked for
${asked}${amount}

## Details captured
| Type | Detail | Status |
|---|---|---|
${rows || "| None | | |"}

## Links to earlier reports
${links}

## Actions already taken
${actions || "- None recorded"}

## Suggested next steps
- Ask the receiving bank to freeze the payee account.
- Add the callback number to the bank's scam number list.
- Share any links with the national suspicious website reporting service.
- Review payments already sent to the account.
`;
}

export async function writeReport(p: SessionEndedPayload): Promise<{ title: string; bodyMd: string }> {
  const title = reportTitle(p);
  const msg = await claudeCreate(
    {
      max_tokens: 4000,
      system: REPORT_SYSTEM,
      messages: [{ role: "user", content: JSON.stringify(p, null, 2) }],
    },
    20000,
  );
  const text = messageText(msg);
  return { title, bodyMd: text ?? templateReport(p) };
}
