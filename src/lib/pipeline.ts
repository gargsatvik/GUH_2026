import "server-only";
// The call pipeline: session transitions (section 12.2, 13), transcript intake
// (12.5), structured capture (12.6), call end (12.7), payee check (18.3),
// decoy details (12.9), trusted contact (12.12) and the coaching check.
import { randomInt } from "node:crypto";
import { db } from "./db";
import { addTimeline, bumpCounters, endCallRecord } from "./actions";
import { findDetails } from "./capture/patterns";
import { extractDetails } from "./capture/claude";
import { mergeAndSend, type Defer } from "./capture/merge";
import { T } from "./copy";
import { SESSION_ID } from "./env";
import { ago, dateTime, money } from "./format";
import { normaliseAccount, toCandidate } from "./normalise";
import { sendAlly, sendCanary, sendSessionEnded } from "./n8n";
import type { SessionEndedPayload } from "./report";
import type { Candidate, CanaryDetail, DemoSession, Extraction, SessionState } from "./types";
import { assessCoaching } from "./coaching";

export class TransitionError extends Error {
  constructor(public state: SessionState) {
    super("invalid_transition");
  }
}

export async function getSession(): Promise<DemoSession> {
  let s = await db().one("demo_sessions", { id: SESSION_ID() });
  if (!s) s = await db().insert("demo_sessions", { id: SESSION_ID() });
  return s;
}

async function patchSession(patch: Partial<DemoSession>): Promise<DemoSession> {
  const [s] = await db().update("demo_sessions", { id: SESSION_ID() }, { ...patch, updated_at: new Date().toISOString() });
  return s;
}

const CLEAR_CALL: Partial<DemoSession> = {
  genuine_code: null,
  call_id: null,
  conversation_id: null,
  decoy_requested_at: null,
  decoy_started_at: null,
  ended_at: null,
  replay: false,
};

export async function startCall(): Promise<DemoSession> {
  const s = await getSession();
  if (s.state !== "idle" && s.state !== "ended") throw new TransitionError(s.state);
  const next = await patchSession({ ...CLEAR_CALL, state: "call_active", call_started_at: new Date().toISOString() });
  await addTimeline("call", T.callStarted);
  return next;
}

export async function requestDecoy(opts: { replay?: boolean } = {}): Promise<DemoSession> {
  const s = await getSession();
  if (s.state !== "verified_scam") throw new TransitionError(s.state);
  const call = await db().insert("calls", { source: opts.replay ? "replay" : "live", status: "live" });
  const next = await patchSession({
    state: "decoy_requested",
    call_id: call.id,
    decoy_requested_at: new Date().toISOString(),
    replay: Boolean(opts.replay),
  });
  await addTimeline("decoy", T.decoyRequested, null, call.id);
  return next;
}

export async function decoyConnected(conversationId: string | null): Promise<DemoSession> {
  const s = await getSession();
  if (s.state !== "decoy_requested") throw new TransitionError(s.state);
  const now = new Date().toISOString();
  if (s.call_id) await db().update("calls", { id: s.call_id }, { started_at: now });
  const next = await patchSession({ state: "decoy_live", decoy_started_at: now, conversation_id: conversationId });
  await addTimeline("decoy", T.decoyConnected, null, s.call_id);
  return next;
}

export async function setNatwestCalling(value: boolean): Promise<DemoSession> {
  await getSession();
  return patchSession({ natwest_calling: value });
}

export async function checkCall() {
  const s = await getSession();
  const allowed: SessionState[] = ["call_active", "verified_genuine", "verified_scam"];
  await new Promise((r) => setTimeout(r, 1200));
  if (!allowed.includes(s.state)) return { result: "no_call" as const };
  if (s.natwest_calling) {
    const code = s.state === "verified_genuine" && s.genuine_code ? s.genuine_code : String(randomInt(1000, 10000));
    await patchSession({ state: "verified_genuine", genuine_code: code });
    if (s.state !== "verified_genuine") await addTimeline("check", T.checkGenuine);
    return { result: "genuine" as const, code, agentName: "Sarah, Fraud Team" };
  }
  await patchSession({ state: "verified_scam" });
  if (s.state !== "verified_scam") await addTimeline("check", T.checkScam);
  return { result: "not_natwest" as const };
}

// ---------- transcript and capture ----------

export async function intakeLine(callId: string, speaker: "caller" | "decoy", text: string, defer?: Defer) {
  const call = await db().one("calls", { id: callId });
  if (!call) return null;
  await db().insert("transcript_lines", { call_id: callId, speaker, text });
  if (speaker !== "caller") return [];
  const callerLines = (await db().select("transcript_lines", { eq: { call_id: callId, speaker: "caller" }, order: { col: "id" } })).map(
    (l) => l.text,
  );
  const results = await mergeAndSend(callId, findDetails(callerLines), "pattern", defer);
  return results.filter((r) => r.isNewToCall).map((r) => r.entity);
}

export function extractionCandidates(x: Extraction): Candidate[] {
  const out: (Candidate | null)[] = [];
  for (const a of x.payee_accounts)
    out.push(toCandidate("account", { sort: a.sort_code, account: a.account_number, label: a.account_name, quote: a.quote }));
  for (const p of x.callback_numbers) out.push(toCandidate("phone", { raw: p }));
  for (const u of x.urls) out.push(toCandidate("url", { raw: u }));
  for (const w of x.crypto_wallets) out.push(toCandidate("wallet", { raw: w }));
  for (const n of x.caller_names) out.push(toCandidate("alias", { raw: n }));
  return out.filter((c): c is Candidate => c !== null);
}

export async function runCapture(callId: string) {
  const lines = await db().select("transcript_lines", { eq: { call_id: callId }, order: { col: "id" } });
  const x = await extractDetails(lines);
  if (!x) return null;
  await mergeAndSend(callId, extractionCandidates(x), "claude");
  await db().update("calls", { id: callId }, {
    scam_type: x.scam_type,
    impersonated_org: x.impersonated_org ?? null,
    summary: x.summary || null,
    confidence: x.confidence,
    extraction: x,
  });
  return x;
}

// ---------- call end ----------

export async function endCall(callId: string, defer: Defer = (t) => t()) {
  const rec = await endCallRecord(callId);
  if (!rec) return null;
  const s = await getSession();
  if (s.call_id === callId && s.state !== "ended") {
    await patchSession({ state: "ended", ended_at: new Date().toISOString() });
  }
  if (!rec.alreadyEnded) {
    await defer(async () => {
      const x = (await runCapture(callId)) ?? rec.call.extraction;
      await sendSessionEnded(await buildSessionEnded(callId, x));
    });
  }
  return { durationSeconds: rec.durationSeconds };
}

export async function buildSessionEnded(callId: string, extraction: Extraction | null): Promise<SessionEndedPayload> {
  const call = (await db().one("calls", { id: callId }))!;
  const links = await db().select("call_entities", { eq: { call_id: callId } });
  const ids = links.map((l) => l.entity_id);
  const entities = ids.length ? await db().select("entities", { in: { col: "id", values: ids } }) : [];
  const allLinks = ids.length ? await db().select("call_entities", { in: { col: "entity_id", values: ids } }) : [];
  const otherCallIds = [...new Set(allLinks.filter((l) => l.call_id !== callId).map((l) => l.call_id))];
  const otherCalls = otherCallIds.length ? await db().select("calls", { in: { col: "id", values: otherCallIds } }) : [];
  const campaigns = await db().select("campaigns");
  const cname = (id: string | null) => campaigns.find((c) => c.id === id)?.name ?? null;
  const timeline = await db().select("timeline_events", { eq: { call_id: callId }, order: { col: "id" } });
  const lines = await db().select("transcript_lines", { eq: { call_id: callId }, order: { col: "id" } });
  return {
    callId,
    call,
    extraction,
    campaignName: cname(call.campaign_id),
    entities: entities.map((e) => ({
      kind: e.kind,
      display: e.display,
      label: e.label,
      flagged: e.flagged,
      earlierCalls: allLinks.filter((l) => l.entity_id === e.id && l.call_id !== callId).length,
    })),
    matches: otherCalls
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .map((c) => ({
        callId: c.id,
        date: dateTime(c.started_at),
        campaign: cname(c.campaign_id),
        sharedDetail: entities
          .filter((e) => allLinks.some((l) => l.call_id === c.id && l.entity_id === e.id))
          .map((e) => e.display)
          .join(", "),
      })),
    timeline: timeline.map((t) => ({ created_at: t.created_at, kind: t.kind, title: t.title })),
    transcriptTail: lines.slice(-20).map((l) => ({ speaker: l.speaker, text: l.text })),
  };
}

// ---------- payee check (18.3) ----------

export class PayeeInputError extends Error {}

export async function payeeCheck(
  input: { payeeName: string; sortCode: string; accountNumber: string; amountPence: number; reference?: string },
  defer: Defer = (t) => t(),
) {
  const acct = normaliseAccount(input.sortCode, input.accountNumber);
  if (!acct) throw new PayeeInputError("Check the sort code and account number.");
  const entity = await db().one("entities", { kind: "account", value: acct.value });
  const amount = money(input.amountPence);

  if (entity?.flagged) {
    const payment = await db().insert("payments", {
      payee_name: input.payeeName,
      sort_code: acct.sort,
      account_number: acct.acct,
      amount_pence: input.amountPence,
      reference: input.reference ?? null,
      status: "paused",
      reason: "Account reported in a scam call",
      entity_id: entity.id,
    });
    await bumpCounters({ payments_paused: 1, value_protected_pence: input.amountPence });
    const links = await db().select("call_entities", { eq: { entity_id: entity.id } });
    const calls = links.length ? await db().select("calls", { in: { col: "id", values: links.map((l) => l.call_id) } }) : [];
    const latest = calls.sort((a, b) => b.started_at.localeCompare(a.started_at))[0];
    const campaign = latest?.campaign_id ? await db().one("campaigns", { id: latest.campaign_id }) : null;
    const reportedAgo = ago(entity.flagged_at ?? entity.first_seen_at);
    await addTimeline("payment", T.paymentPaused(amount, acct.display, reportedAgo));
    const base = process.env.APP_BASE_URL ?? "";
    await defer(() =>
      sendAlly({
        paymentId: payment.id,
        amount,
        payee: input.payeeName,
        contactName: "Claire (daughter)",
        link: `${base}/ally?payment=${payment.id}`,
      }),
    );
    return {
      status: "paused" as const,
      paymentId: payment.id,
      reason: "Account reported in a scam call",
      reportedAgo,
      reportCount: calls.length,
      campaignName: campaign?.name ?? null,
    };
  }

  const payment = await db().insert("payments", {
    payee_name: input.payeeName,
    sort_code: acct.sort,
    account_number: acct.acct,
    amount_pence: input.amountPence,
    reference: input.reference ?? null,
    status: "sent",
    entity_id: entity?.id ?? null,
  });
  await addTimeline("payment", T.paymentSent(amount, acct.display));
  return { status: "sent" as const, paymentId: payment.id };
}

export async function cancelPayment(paymentId: string) {
  const p = await db().one("payments", { id: paymentId });
  if (!p || p.status !== "paused") return p;
  const [u] = await db().update("payments", { id: paymentId }, { status: "cancelled" });
  await addTimeline("payment", T.paymentCancelled, `${money(p.amount_pence)} to ${p.payee_name}`);
  return u;
}

// ---------- decoy details tripwire (12.9) ----------

export const CANARY_DETAIL: Record<"card" | "login", CanaryDetail> = {
  card: {
    device: "Android 13, new device",
    location: "Approx. Leicester, UK",
    ip: "203.0.113.42",
    attempt: "Card not present purchase, £249.99, electronics retailer",
  },
  login: {
    device: "Android 13, new device",
    location: "Approx. Leicester, UK",
    ip: "203.0.113.42",
    attempt: "Online banking sign-in with the decoy customer number",
  },
};

export async function tripCanary(kind: "card" | "login", defer: Defer = (t) => t()) {
  const s = await getSession();
  const detail = CANARY_DETAIL[kind];
  const hit = await db().insert("canary_hits", { kind, call_id: s.call_id, detail });
  await defer(() => sendCanary({ kind, callId: s.call_id, detail }));
  return hit;
}

// ---------- trusted contact (12.12) ----------

export async function allyDecision(paymentId: string, decision: "approve" | "decline") {
  const p = await db().one("payments", { id: paymentId });
  if (!p) return null;
  if (p.status !== "paused") return p;
  const [u] = await db().update("payments", { id: paymentId }, { status: decision === "approve" ? "approved" : "cancelled" });
  await addTimeline("ally", decision === "approve" ? T.allyApproved : T.allyStopped, `${money(p.amount_pence)} to ${p.payee_name}`);
  return u;
}

// ---------- coaching check (stretch 6) ----------

export async function submitCoaching(paymentId: string | null, answers: { question: string; answer: string }[]) {
  const result = await assessCoaching(answers);
  const row = await db().insert("coaching_checks", {
    payment_id: paymentId,
    likelihood: result.likelihood,
    signals: result.signals,
    suggested_action: result.suggested_action,
    answers,
  });
  const label = result.likelihood[0].toUpperCase() + result.likelihood.slice(1);
  await addTimeline("coaching", T.coaching(label), result.signals.join(". ") || null);
  return row;
}

// ---------- reset ----------

export async function resetDemo() {
  await db().resetDemo();
}
