import { z } from "zod";
import { addTimeline, flagAccount, insertReport, linkCampaign } from "@/lib/actions";
import { bad, body, json, requireSecret } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// n8n callbacks (section 12.10). Secret required.
const Flag = z.object({ entityId: z.string().uuid(), callId: z.string().uuid().nullable().optional(), reason: z.string().min(1) });
const Timeline = z.object({
  callId: z.string().uuid().nullable().optional(),
  kind: z.enum(["call", "check", "decoy", "capture", "match", "flag", "payment", "report", "canary", "ally", "coaching", "system"]),
  title: z.string().min(1).max(300),
  detail: z.string().max(2000).nullable().optional(),
});
const Report = z.object({
  callId: z.string().uuid(),
  title: z.string().min(1).max(300),
  bodyMd: z.string().min(1).max(20000),
  sentTo: z.string().nullable().optional(),
});
const Link = z.object({ callId: z.string().uuid(), campaignId: z.string().min(1) });

export async function POST(req: Request, ctx: RouteContext<"/api/actions/[action]">) {
  const denied = requireSecret(req);
  if (denied) return denied;
  const { action } = await ctx.params;
  switch (action) {
    case "flag-account": {
      const b = await body(req, Flag);
      if (b instanceof Response) return b;
      return json({ ok: true, ...(await flagAccount(b.entityId, b.callId ?? null, b.reason)) });
    }
    case "timeline": {
      const b = await body(req, Timeline);
      if (b instanceof Response) return b;
      const row = await addTimeline(b.kind, b.title, b.detail ?? null, b.callId ?? null);
      return json({ ok: true, id: row.id });
    }
    case "report": {
      const b = await body(req, Report);
      if (b instanceof Response) return b;
      const r = await insertReport(b.callId, b.title, b.bodyMd, b.sentTo ?? null);
      return json({ ok: true, id: r.id });
    }
    case "link-campaign": {
      const b = await body(req, Link);
      if (b instanceof Response) return b;
      return json({ ok: true, ...(await linkCampaign(b.callId, b.campaignId)) });
    }
    default:
      return bad("Unknown action", 404);
  }
}
