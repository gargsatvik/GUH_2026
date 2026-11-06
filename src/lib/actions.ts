import "server-only";
// Business actions (section 6, principle 4). API routes, n8n callbacks and the
// fallback path all call these, so behaviour is identical with n8n on or off.
// Every action is idempotent.
import { db } from "./db";
import type { CounterDelta, TimelineKind } from "./types";
import { durationWords } from "./format";
import { T } from "./copy";

export async function addTimeline(kind: TimelineKind, title: string, detail?: string | null, callId?: string | null) {
  return db().insert("timeline_events", { kind, title, detail: detail ?? null, call_id: callId ?? null });
}

export async function bumpCounters(delta: CounterDelta) {
  await db().bumpCounters(delta);
}

export async function flagAccount(entityId: string, callId: string | null, reason: string) {
  const e = await db().one("entities", { id: entityId });
  if (!e || e.kind !== "account" || e.flagged) return { changed: false };
  await db().update("entities", { id: entityId }, {
    flagged: true,
    flagged_at: new Date().toISOString(),
    flag_reason: reason,
  });
  await bumpCounters({ accounts_flagged: 1 });
  await addTimeline("flag", T.flag(e.display), reason, callId);
  return { changed: true };
}

export async function linkCampaign(callId: string, campaignId: string) {
  const call = await db().one("calls", { id: callId });
  const campaign = await db().one("campaigns", { id: campaignId });
  if (!call || !campaign || call.campaign_id === campaignId) return { changed: false };
  // Until the structured pass runs, borrow the campaign's scam type and who the
  // caller usually claims to be, so the dashboard and report still read well.
  const patch: Partial<typeof call> = { campaign_id: campaignId };
  if (!call.scam_type) patch.scam_type = campaign.scam_type;
  if (!call.impersonated_org) {
    const earlier = await db().select("calls", { eq: { campaign_id: campaignId }, order: { col: "started_at", asc: false }, limit: 1 });
    if (earlier[0]?.impersonated_org) patch.impersonated_org = earlier[0].impersonated_org;
  }
  await db().update("calls", { id: callId }, patch);
  await addTimeline("match", T.linkedCampaign(campaign.name), null, callId);
  return { changed: true };
}

export async function insertReport(callId: string, title: string, bodyMd: string, sentTo: string | null) {
  const report = await db().insert("reports", { call_id: callId, title, body_md: bodyMd, sent_to: sentTo });
  await addTimeline("report", T.reportSent, title, callId);
  return report;
}

export async function endCallRecord(callId: string) {
  const call = await db().one("calls", { id: callId });
  if (!call) return null;
  if (call.status === "ended") return { call, durationSeconds: call.duration_seconds ?? 0, alreadyEnded: true };
  const session = await db().one("demo_sessions", { id: process.env.DEMO_SESSION_ID || "demo" });
  const startedAt = session?.call_id === callId && session.decoy_started_at ? session.decoy_started_at : call.started_at;
  const endedAt = new Date();
  const durationSeconds = Math.max(0, Math.round((endedAt.getTime() - new Date(startedAt).getTime()) / 1000));
  const [updated] = await db().update("calls", { id: callId }, {
    status: "ended",
    ended_at: endedAt.toISOString(),
    duration_seconds: durationSeconds,
  });
  await bumpCounters({ calls_taken: 1, seconds_wasted: durationSeconds });
  await addTimeline("decoy", T.decoyEnded(durationWords(durationSeconds)), null, callId);
  return { call: updated, durationSeconds, alreadyEnded: false };
}
