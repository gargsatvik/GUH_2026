"use client";
// "Connections" (section 21.4): calls and the details they share.
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ForceGraphMethods } from "react-force-graph-2d";
import type { Call, CallEntity, Campaign, Entity } from "@/lib/types";
import type { GraphLink, GraphNode } from "./GraphCanvas";

const GraphCanvas = dynamic(() => import("./GraphCanvas"), { ssr: false });

const COLORS: Record<GraphNode["type"], string> = {
  account: "#3C1053",
  phone: "#2F5D8A",
  url: "#6B6577",
  wallet: "#8A5A00",
  alias: "#9B4D73",
  call: "#C9C4D3",
};

export const LEGEND: { type: GraphNode["type"]; label: string }[] = [
  { type: "account", label: "Account" },
  { type: "phone", label: "Phone" },
  { type: "url", label: "Link" },
  { type: "wallet", label: "Wallet" },
  { type: "alias", label: "Caller name" },
  { type: "call", label: "Call" },
];

export function ScamGraph({
  calls,
  entities,
  links,
  campaigns,
  liveCallId,
}: {
  calls: Call[];
  entities: Entity[];
  links: CallEntity[];
  campaigns: Campaign[];
  liveCallId: string | null;
}) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink> | undefined>(undefined);
  const [size, setSize] = useState({ w: 600, h: 400 });
  const nodeCache = useRef(new Map<string, GraphNode>());
  const reduce = useRef(false);
  const fitted = useRef<string | null>(null);

  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const data = useMemo(() => {
    // Focus mode when a call is live: the live call, its details, every call
    // linked to those details, and their details.
    let callIds = new Set(calls.map((c) => c.id));
    let entityIds = new Set(entities.map((e) => e.id));
    const focus = new Set<string>();
    if (liveCallId) {
      const liveEnts = new Set(links.filter((l) => l.call_id === liveCallId).map((l) => l.entity_id));
      const linkedCalls = new Set(links.filter((l) => liveEnts.has(l.entity_id)).map((l) => l.call_id));
      linkedCalls.add(liveCallId);
      const allEnts = new Set(links.filter((l) => linkedCalls.has(l.call_id)).map((l) => l.entity_id));
      callIds = linkedCalls;
      entityIds = allEnts;
      focus.add(`c:${liveCallId}`);
      liveEnts.forEach((id) => focus.add(`e:${id}`));
    }

    const get = (id: string, init: () => GraphNode) => {
      const existing = nodeCache.current.get(id);
      const fresh = init();
      if (existing) return Object.assign(existing, fresh, { x: existing.x, y: existing.y });
      nodeCache.current.set(id, fresh);
      return fresh;
    };

    const nodes: GraphNode[] = [];
    for (const c of calls) {
      if (!callIds.has(c.id)) continue;
      nodes.push(
        get(`c:${c.id}`, () => ({
          id: `c:${c.id}`,
          type: "call",
          label: c.source === "seed" ? "Earlier report" : "Live call",
          sub: c.summary,
          campaignId: c.campaign_id,
          live: c.id === liveCallId,
          focus: focus.has(`c:${c.id}`),
        })),
      );
    }
    // Each detail sits with the campaign it was used in most.
    const callCampaign = new Map(calls.map((c) => [c.id, c.campaign_id]));
    const entityCampaign = new Map<string, string | null>();
    for (const e of entities) {
      const counts = new Map<string, number>();
      for (const l of links) {
        if (l.entity_id !== e.id) continue;
        const cid = callCampaign.get(l.call_id);
        if (cid) counts.set(cid, (counts.get(cid) ?? 0) + 1);
      }
      entityCampaign.set(e.id, [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null);
    }
    for (const e of entities) {
      if (!entityIds.has(e.id)) continue;
      nodes.push(
        get(`e:${e.id}`, () => ({
          id: `e:${e.id}`,
          type: e.kind,
          label: e.display,
          sub: e.label,
          campaignId: entityCampaign.get(e.id) ?? null,
          flagged: e.flagged,
          focus: focus.has(`e:${e.id}`),
        })),
      );
    }
    const present = new Set(nodes.map((n) => n.id));
    const glinks: GraphLink[] = links
      .filter((l) => present.has(`c:${l.call_id}`) && present.has(`e:${l.entity_id}`))
      .map((l) => ({ source: `c:${l.call_id}`, target: `e:${l.entity_id}`, focus: l.call_id === liveCallId }));
    return { nodes, links: glinks };
  }, [calls, entities, links, liveCallId]);

  // Zoom to the live neighbourhood when it changes.
  const sig = `${liveCallId}:${data.nodes.length}:${data.links.length}`;
  useEffect(() => {
    const t = setTimeout(() => graphRef.current?.zoomToFit(reduce.current ? 0 : 600, 40), 700);
    return () => clearTimeout(t);
  }, [sig]);

  const campaignName = useMemo(() => new Map(campaigns.map((c) => [c.id, c.name])), [campaigns]);

  return (
    <div ref={box} className="relative h-full w-full">
      <GraphCanvas
        graphRef={graphRef}
        width={size.w}
        height={size.h}
        graphData={data}
        backgroundColor="rgba(0,0,0,0)"
        cooldownTicks={220}
        nodeRelSize={4}
        linkColor={(l: GraphLink) => (l.focus ? "rgba(60,16,83,0.55)" : "rgba(107,101,119,0.25)")}
        linkWidth={(l: GraphLink) => (l.focus ? 1.6 : 0.8)}
        nodeLabel={(n: GraphNode) => `${n.label}${n.sub ? ` · ${n.sub}` : ""}`}
        onNodeClick={(n: GraphNode) => {
          if (n.type === "wallet") router.push(`/ops/trace?wallet=${encodeURIComponent(n.label)}`);
        }}
        nodeCanvasObject={(n: GraphNode, ctx: CanvasRenderingContext2D, scale: number) => {
          const r = n.type === "call" ? (n.live ? 7 : 3.5) : 6;
          const x = n.x ?? 0;
          const y = n.y ?? 0;
          if (n.live) {
            const t = (performance.now() % 1600) / 1600;
            ctx.beginPath();
            ctx.arc(x, y, r + 2 + t * 8, 0, 2 * Math.PI);
            ctx.fillStyle = `rgba(60,16,83,${0.25 * (1 - t)})`;
            ctx.fill();
          }
          ctx.beginPath();
          ctx.arc(x, y, r, 0, 2 * Math.PI);
          ctx.fillStyle = n.live ? "#3C1053" : COLORS[n.type];
          ctx.fill();
          if (n.flagged) {
            ctx.lineWidth = 2 / Math.max(scale, 0.6);
            ctx.strokeStyle = "#B42318";
            ctx.beginPath();
            ctx.arc(x, y, r + 1.5, 0, 2 * Math.PI);
            ctx.stroke();
          }
          if (n.focus && n.type !== "call") {
            const fs = Math.max(9 / scale, 2.5);
            ctx.font = `500 ${fs}px var(--font-jetbrains), monospace`;
            ctx.fillStyle = "#14121A";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(n.label, x, y + r + 2);
          } else if (n.live) {
            const fs = Math.max(11 / scale, 3);
            ctx.font = `600 ${fs}px var(--font-inter), sans-serif`;
            ctx.fillStyle = "#3C1053";
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText("Live call", x, y + r + 2);
          }
        }}
        onRenderFramePost={(ctx: CanvasRenderingContext2D, scale: number) => {
          // Campaign names near their cluster
          const groups = new Map<string, { x: number; y: number; n: number; minY: number }>();
          for (const n of data.nodes) {
            if (n.type !== "call" || !n.campaignId || n.x == null || n.y == null) continue;
            const g = groups.get(n.campaignId) ?? { x: 0, y: 0, n: 0, minY: Infinity };
            g.x += n.x;
            g.y += n.y;
            g.n += 1;
            g.minY = Math.min(g.minY, n.y);
            groups.set(n.campaignId, g);
          }
          const fs = Math.max(12 / scale, 3);
          ctx.font = `600 ${fs}px var(--font-source-serif), serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          for (const [id, g] of groups) {
            if (g.n < 2) continue;
            ctx.fillStyle = "rgba(60,16,83,0.75)";
            ctx.fillText(campaignName.get(id) ?? id, g.x / g.n, g.minY - 14 / scale);
          }
        }}
        autoPauseRedraw={!liveCallId}
        onEngineStop={() => {
          fitted.current = sig;
          graphRef.current?.zoomToFit(reduce.current ? 0 : 600, 30);
        }}
      />
    </div>
  );
}
