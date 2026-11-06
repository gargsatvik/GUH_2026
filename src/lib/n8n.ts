import "server-only";
// Send to n8n, or run the same steps inline (section 9 and 16).
// The demo never waits more than 4 seconds for automation.
import { db } from "./db";
import { addTimeline, flagAccount, insertReport, linkCampaign } from "./actions";
import { T } from "./copy";
import { n8nEnabled } from "./env";
import type { CanaryDetail, IntelPayload } from "./types";
import { writeReport, type SessionEndedPayload } from "./report";
import { money } from "./format";

type Workflow = "intel" | "session-ended" | "canary" | "ally";

const URLS: Record<Workflow, string | undefined> = {
  intel: process.env.N8N_WEBHOOK_INTEL_URL,
  "session-ended": process.env.N8N_WEBHOOK_SESSION_ENDED_URL,
  canary: process.env.N8N_WEBHOOK_CANARY_URL,
  ally: process.env.N8N_WEBHOOK_ALLY_URL,
};

export const BLOCK_REASON = "Named as the payee by a caller on the Decoy line";

/** Add "Automation offline" at most once per call so the timeline stays readable. */
async function noteOffline(callId: string | null) {
  const existing = await db().select("timeline_events", {
    eq: { kind: "system", title: T.automationOffline, call_id: callId },
    limit: 1,
  });
  if (!existing.length) await addTimeline("system", T.automationOffline, null, callId);
}

async function send(workflow: Workflow, payload: unknown, callId: string | null, fallback: () => Promise<void>) {
  const url = URLS[workflow];
  if (n8nEnabled() && url) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-decoy-secret": process.env.N8N_SHARED_SECRET ?? "" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) return;
      console.warn(`[n8n] ${workflow} returned ${res.status}`);
    } catch (e) {
      console.warn(`[n8n] ${workflow} failed`, e);
    }
  }
  await noteOffline(callId);
  await fallback();
}

// ---------- intel-received (16.1) ----------

export async function runIntelFallback(p: IntelPayload) {
  for (const e of p.newEntities) {
    if (e.kind === "account") await flagAccount(e.id, p.callId, BLOCK_REASON);
    else {
      const title =
        e.kind === "phone"
          ? T.noteScamNumber(e.display)
          : e.kind === "url"
            ? T.noteLink
            : e.kind === "wallet"
              ? T.noteWallet
              : T.noteAlias;
      await addTimeline("capture", title, e.kind === "phone" ? null : e.display, p.callId);
    }
  }
  if (p.matches.length && p.suggestedCampaign) await linkCampaign(p.callId, p.suggestedCampaign.id);
}

export const sendIntel = (p: IntelPayload) => send("intel", p, p.callId, () => runIntelFallback(p));

// ---------- session-ended (16.2) ----------

export async function runSessionEndedFallback(p: SessionEndedPayload) {
  const { title, bodyMd } = await writeReport(p);
  await insertReport(p.callId, title, bodyMd, "Fraud Operations");
}

export const sendSessionEnded = (p: SessionEndedPayload) =>
  send("session-ended", p, p.callId, () => runSessionEndedFallback(p));

// ---------- canary-tripped (16.3) ----------

export interface CanaryPayload {
  kind: "card" | "login";
  callId: string | null;
  detail: CanaryDetail;
}

export async function runCanaryFallback(p: CanaryPayload) {
  const title = p.kind === "card" ? T.canaryCard(money(24999)) : T.canaryLogin;
  await addTimeline("canary", title, `${p.detail.device}. ${p.detail.location}. IP ${p.detail.ip}.`, p.callId);
  await addTimeline("canary", T.canaryWatch, null, p.callId);
}

export const sendCanary = (p: CanaryPayload) => send("canary", p, p.callId, () => runCanaryFallback(p));

// ---------- trusted-contact (16.4) ----------

export interface AllyPayload {
  paymentId: string;
  amount: string;
  payee: string;
  contactName: string;
  link: string;
}

export async function runAllyFallback(p: AllyPayload) {
  await addTimeline("ally", T.allyAsked, `${p.amount} to ${p.payee}`, null);
}

export const sendAlly = (p: AllyPayload) => send("ally", p, null, () => runAllyFallback(p));
