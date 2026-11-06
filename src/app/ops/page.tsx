"use client";
// Fraud Operations dashboard (section 21.4), designed for a 1920 x 1080 projector.
import { useMemo } from "react";
import { Card, Footer, Pill, StatusDot } from "@/components/ui";
import { DemoPanel } from "@/components/ops/DemoPanel";
import { CampaignCard, CoachingCard, Counters, DecoyDetailsCard, DetailRow, PanelHeader, ReportsCard, Timeline } from "@/components/ops/Panels";
import { LEGEND, ScamGraph } from "@/components/ops/ScamGraph";
import { Transcript } from "@/components/ops/Transcript";
import { COPY } from "@/lib/copy";
import { clockTime, timer } from "@/lib/format";
import { useConnectionStatus, useNow, useRealtime, useSession } from "@/lib/useRealtime";

const LEGEND_COLOR: Record<string, string> = {
  account: "#3C1053",
  phone: "#2F5D8A",
  url: "#6B6577",
  wallet: "#8A5A00",
  alias: "#9B4D73",
  call: "#C9C4D3",
};

export default function OpsPage() {
  const { session } = useSession();
  const now = useNow(1000);
  const conn = useConnectionStatus();

  const { rows: counters } = useRealtime("counters");
  const { rows: calls } = useRealtime("calls");
  const { rows: entities } = useRealtime("entities");
  const { rows: links } = useRealtime("call_entities");
  const { rows: campaigns } = useRealtime("campaigns");
  const { rows: timeline } = useRealtime("timeline_events", { order: { col: "id", asc: false }, limit: 50 });
  const { rows: reports } = useRealtime("reports", { order: { col: "created_at", asc: false } });
  const { rows: canary } = useRealtime("canary_hits", { order: { col: "created_at", asc: true } });
  const { rows: coaching } = useRealtime("coaching_checks", { order: { col: "created_at", asc: false } });

  // The call on screen: the session's current call, else the most recent non-seed call.
  const currentCall = useMemo(() => {
    if (session?.call_id) return calls.find((c) => c.id === session.call_id) ?? null;
    return [...calls].filter((c) => c.source !== "seed").sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null;
  }, [calls, session?.call_id]);
  const isLive = currentCall?.status === "live" && (session?.state === "decoy_live" || session?.state === "decoy_requested");
  const liveCallId = isLive ? currentCall!.id : null;

  const { rows: lines } = useRealtime("transcript_lines", {
    filter: { col: "call_id", value: currentCall?.id },
    order: { col: "id", asc: true },
  });

  const callLinks = useMemo(() => links.filter((l) => l.call_id === currentCall?.id), [links, currentCall?.id]);
  const captured = useMemo(
    () =>
      callLinks
        .map((l) => ({ link: l, e: entities.find((e) => e.id === l.entity_id) }))
        .filter((x): x is { link: typeof x.link; e: NonNullable<typeof x.e> } => Boolean(x.e))
        .sort((a, b) => a.link.created_at.localeCompare(b.link.created_at)),
    [callLinks, entities],
  );
  const earlierCount = (entityId: string) => links.filter((l) => l.entity_id === entityId && l.call_id !== currentCall?.id).length;

  // Campaign card: the current call's campaign, else the busiest campaign.
  const campaign = useMemo(() => {
    let id = currentCall?.campaign_id ?? null;
    if (!id) {
      const counts = new Map<string, number>();
      calls.forEach((c) => c.campaign_id && counts.set(c.campaign_id, (counts.get(c.campaign_id) ?? 0) + 1));
      id = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    }
    const c = campaigns.find((x) => x.id === id);
    if (!c) return null;
    const cc = calls.filter((x) => x.campaign_id === c.id);
    const ccIds = new Set(cc.map((x) => x.id));
    const blocked = new Set(
      links
        .filter((l) => ccIds.has(l.call_id))
        .map((l) => entities.find((e) => e.id === l.entity_id))
        .filter((e) => e?.kind === "account" && e.flagged)
        .map((e) => e!.id),
    );
    const firstSeen = cc.map((x) => x.started_at).sort()[0] ?? c.first_seen_at;
    return { name: c.name, calls: cc.length, firstSeen, blocked: blocked.size };
  }, [currentCall?.campaign_id, campaigns, calls, links, entities]);

  const liveSecs = session?.decoy_started_at ? (now - new Date(session.decoy_started_at).getTime()) / 1000 : 0;
  const callCanary = canary.filter((h) => h.call_id && h.call_id === currentCall?.id);
  const lastCompleted = [...calls].filter((c) => c.status === "ended" && c.summary).sort((a, b) => (b.ended_at ?? "").localeCompare(a.ended_at ?? ""))[0];

  return (
    <div className="flex h-dvh min-h-[720px] flex-col overflow-hidden bg-paper">
      <header className="flex h-14 shrink-0 items-center justify-between bg-brand px-6 text-white">
        <div className="flex items-baseline gap-3">
          <span className="font-serif text-[22px] font-semibold">Decoy</span>
          <span className="text-[15px] text-white/70">Fraud Operations</span>
        </div>
        <div className="flex items-center gap-5">
          <span className="tnum font-mono text-[15px]">{now ? clockTime(new Date(now), true) : "--:--:--"}</span>
          <span className="flex items-center gap-2 text-[15px]">
            <StatusDot tone={conn === "connected" ? "success" : "warning"} live={conn === "connected"} />
            {conn === "connected" ? "Connected" : COPY.ops.reconnecting}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
        <Counters c={counters[0]} />

        <div className="grid min-h-0 flex-1 grid-cols-12 gap-4">
          {/* Live call */}
          <Card className="col-span-4 flex min-h-0 flex-col p-5">
            {currentCall ? (
              <>
                <PanelHeader title={isLive ? "Live on the Decoy line" : "Last call on the Decoy line"}>
                  {isLive ? (
                    session?.state === "decoy_requested" ? (
                      <Pill tone="brand">Incoming to Decoy</Pill>
                    ) : (
                      <span className="flex items-center gap-3">
                        <Pill tone="success" dot>
                          Live
                        </Pill>
                        <span className="tnum font-mono text-[20px] font-medium">{timer(liveSecs)}</span>
                      </span>
                    )
                  ) : (
                    <Pill tone="muted">Ended {currentCall.duration_seconds != null ? timer(currentCall.duration_seconds) : ""}</Pill>
                  )}
                </PanelHeader>
                <div className="mb-3 text-[15px] text-muted">
                  Caller claims to be: <span className="font-medium text-ink">{currentCall.impersonated_org ?? "Listening..."}</span>
                  {session?.replay && currentCall.source === "replay" && <span className="ml-2">(replay)</span>}
                </div>
                {!isLive && currentCall.summary && (
                  <div className="mb-3 rounded-[8px] bg-brand-tint p-3 text-[15px] leading-[22px]">{currentCall.summary}</div>
                )}
                <Transcript lines={lines} captured={captured.map((c) => c.e)} />
              </>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <StatusDot tone="success" live />
                <p className="font-serif text-[22px] font-semibold">{COPY.ops.idle}</p>
                {lastCompleted && <p className="max-w-sm text-[15px] text-muted">Last call: {lastCompleted.summary}</p>}
              </div>
            )}
          </Card>

          {/* Graph and timeline */}
          <div className="col-span-5 grid min-h-0 grid-rows-[3fr_2fr] gap-4">
            <Card className="flex min-h-0 flex-col p-5">
              <PanelHeader title="Connections">
                <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[13px] text-muted">
                  {LEGEND.map((l) => (
                    <span key={l.type} className="flex items-center gap-1">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: LEGEND_COLOR[l.type] }} />
                      {l.label}
                    </span>
                  ))}
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2.5 w-2.5 rounded-full border-2 border-danger" /> Blocked
                  </span>
                </div>
              </PanelHeader>
              <div className="min-h-0 flex-1 overflow-hidden rounded-[8px] bg-paper">
                <ScamGraph calls={calls} entities={entities} links={links} campaigns={campaigns} liveCallId={liveCallId} />
              </div>
            </Card>
            <Card className="flex min-h-0 flex-col p-5">
              <PanelHeader title="Actions" />
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <Timeline events={timeline} />
              </div>
            </Card>
          </div>

          {/* Right column */}
          <div className="col-span-3 flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
            <Card className="p-4">
              <div className="text-[13px] font-medium text-muted">Captured on this call</div>
              {captured.length ? (
                <div className="mt-1 divide-y divide-line">
                  {captured.map(({ e, link }) => (
                    <DetailRow key={e.id} e={e} link={link} earlier={earlierCount(e.id)} />
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[15px] text-muted">{COPY.ops.noDetails}</p>
              )}
            </Card>
            {campaign && <CampaignCard {...campaign} />}
            {currentCall && currentCall.source !== "phone" && <DecoyDetailsCard hits={callCanary} />}
            <CoachingCard check={coaching[0]} />
            <ReportsCard reports={reports} />
          </div>
        </div>
        <Footer className="-mt-1 shrink-0" />
      </div>
      <DemoPanel session={session} />
    </div>
  );
}
