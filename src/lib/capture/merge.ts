import "server-only";
// mergeEntity (section 18.2) and the intel payload builder (section 16.1).
import { db } from "../db";
import { addTimeline } from "../actions";
import { T } from "../copy";
import type { Candidate, Entity, FoundBy, IntelPayload } from "../types";
import { sendIntel } from "../n8n";

export interface MergeMatch {
  callId: string;
  campaignId: string | null;
}

export interface MergeResult {
  entity: Entity;
  isNewToCall: boolean;
  isNewEntity: boolean;
  matches: MergeMatch[];
  foundBy: FoundBy;
}

function captureTitle(e: Entity): string {
  switch (e.kind) {
    case "account":
      return T.captureAccount(e.display, e.label);
    case "phone":
      return T.capturePhone(e.display);
    case "url":
      return T.captureUrl(e.display);
    case "wallet":
      return T.captureWallet(e.display);
    case "alias":
      return T.captureAlias(e.display);
  }
}

async function upsertEntity(c: Candidate): Promise<{ entity: Entity; isNew: boolean }> {
  const existing = await db().one("entities", { kind: c.kind, value: c.value });
  if (existing) {
    if (!existing.label && c.label) {
      const [u] = await db().update("entities", { id: existing.id }, { label: c.label });
      return { entity: u ?? existing, isNew: false };
    }
    return { entity: existing, isNew: false };
  }
  const inserted = await db().insertIfAbsent(
    "entities",
    { kind: c.kind, value: c.value, display: c.display, label: c.label ?? null },
    ["kind", "value"],
  );
  if (inserted) return { entity: inserted, isNew: true };
  // Lost a race with a concurrent insert: read it back.
  const again = await db().one("entities", { kind: c.kind, value: c.value });
  return { entity: again!, isNew: false };
}

export async function mergeEntity(callId: string, candidate: Candidate, foundBy: FoundBy): Promise<MergeResult> {
  const { entity, isNew } = await upsertEntity(candidate);

  const link = await db().insertIfAbsent(
    "call_entities",
    { call_id: callId, entity_id: entity.id, quote: candidate.quote ?? null, found_by: foundBy, confirmed: foundBy === "claude" },
    ["call_id", "entity_id"],
  );

  if (!link) {
    // The call already had this detail. A structured pass agreeing with the instant match confirms it.
    if (foundBy === "claude") {
      await db().update("call_entities", { call_id: callId, entity_id: entity.id }, { confirmed: true });
    }
    return { entity, isNewToCall: false, isNewEntity: false, matches: [], foundBy };
  }

  await addTimeline("capture", captureTitle(entity), candidate.quote ?? null, callId);

  const others = (await db().select("call_entities", { eq: { entity_id: entity.id } })).filter(
    (r) => r.call_id !== callId,
  );
  let matches: MergeMatch[] = [];
  if (others.length) {
    const calls = await db().select("calls", { in: { col: "id", values: others.map((o) => o.call_id) } });
    matches = calls.map((c) => ({ callId: c.id, campaignId: c.campaign_id }));
    await addTimeline("match", T.matchEarlier(entity.display, matches.length), null, callId);
  }
  return { entity, isNewToCall: true, isNewEntity: isNew, matches, foundBy };
}

function mostCommon(ids: (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const id of ids) if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  let best: string | null = null;
  let n = 0;
  for (const [id, c] of counts) if (c > n) [best, n] = [id, c];
  return best;
}

export type Defer = (task: () => Promise<unknown>) => void | Promise<unknown>;
const runNow: Defer = (task) => task();

/**
 * Merge many candidates; if any are new to the call, send one intel payload.
 * `defer` lets a route send the payload after its response has gone out.
 */
export async function mergeAndSend(callId: string, candidates: Candidate[], foundBy: FoundBy, defer: Defer = runNow) {
  const results: MergeResult[] = [];
  for (const c of candidates) results.push(await mergeEntity(callId, c, foundBy));
  const fresh = results.filter((r) => r.isNewToCall);
  if (fresh.length) {
    const payload = await buildIntel(callId, fresh);
    await defer(() => sendIntel(payload));
  }
  return results;
}

export async function buildIntel(callId: string, fresh: MergeResult[]): Promise<IntelPayload> {
  const campaigns = await db().select("campaigns");
  const nameOf = (id: string | null) => campaigns.find((c) => c.id === id)?.name ?? null;

  const matches = fresh
    .filter((r) => r.matches.length)
    .map((r) => {
      const campaignId = mostCommon(r.matches.map((m) => m.campaignId));
      return {
        entityId: r.entity.id,
        display: r.entity.display,
        kind: r.entity.kind,
        earlierCalls: r.matches.length,
        campaignId,
        campaignName: nameOf(campaignId),
      };
    });

  // Suggested campaign: the most common campaign across every linked earlier call for this call.
  let suggestedCampaign: IntelPayload["suggestedCampaign"] = null;
  const call = await db().one("calls", { id: callId });
  if (call && !call.campaign_id) {
    const links = await db().select("call_entities", { eq: { call_id: callId } });
    const entityIds = links.map((l) => l.entity_id);
    if (entityIds.length) {
      const all = (await db().select("call_entities", { in: { col: "entity_id", values: entityIds } })).filter(
        (r) => r.call_id !== callId,
      );
      if (all.length) {
        const calls = await db().select("calls", { in: { col: "id", values: [...new Set(all.map((a) => a.call_id))] } });
        const byId = new Map(calls.map((c) => [c.id, c.campaign_id]));
        const best = mostCommon(all.map((a) => byId.get(a.call_id) ?? null));
        if (best) suggestedCampaign = { id: best, name: nameOf(best)! };
      }
    }
  }

  return {
    callId,
    newEntities: fresh.map((r) => ({
      id: r.entity.id,
      kind: r.entity.kind,
      display: r.entity.display,
      label: r.entity.label,
      foundBy: r.foundBy,
    })),
    matches,
    suggestedCampaign,
  };
}
