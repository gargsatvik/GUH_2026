"use client";
// Loaded only in the browser (react-force-graph uses window).
import { forceX, forceY } from "d3-force-3d";
import ForceGraph2D, { type ForceGraphMethods, type ForceGraphProps } from "react-force-graph-2d";
import { useEffect, type MutableRefObject } from "react";

export type GraphNode = {
  id: string;
  type: "call" | "account" | "phone" | "url" | "wallet" | "alias";
  label: string;
  sub?: string | null;
  campaignId?: string | null;
  live?: boolean;
  flagged?: boolean;
  focus?: boolean;
  x?: number;
  y?: number;
};
export type GraphLink = { source: string | GraphNode; target: string | GraphNode; focus?: boolean };

const ANCHORS: Record<string, { x: number; y: number }> = {
  "safe-account-nw": { x: -110, y: -70 },
  "courier-card": { x: 110, y: -70 },
  "hmrc-refund": { x: -110, y: 80 },
  "crypto-invest": { x: 110, y: 80 },
};
function anchorFor(id: string | null | undefined) {
  if (!id) return null;
  if (ANCHORS[id]) return ANCHORS[id];
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  const a = (Math.abs(h) % 360) * (Math.PI / 180);
  return { x: Math.cos(a) * 140, y: Math.sin(a) * 110 };
}

export default function GraphCanvas(
  props: ForceGraphProps<GraphNode, GraphLink> & { graphRef: MutableRefObject<ForceGraphMethods<GraphNode, GraphLink> | undefined> },
) {
  const { graphRef, ...rest } = props;
  // Stronger repulsion and short links so each campaign forms its own cluster.
  useEffect(() => {
    // The instance is attached a moment after mount, so wait for it.
    const configure = () => {
      const g = graphRef.current;
      if (!g) return false;
      (g.d3Force("charge") as unknown as { strength: (n: number) => unknown } | undefined)?.strength(-50);
      (g.d3Force("link") as unknown as { distance: (n: number) => unknown } | undefined)?.distance(20);
      // Pull each campaign towards its own spot so clusters do not overlap.
      const anchor = (n: GraphNode) => anchorFor(n.campaignId);
      g.d3Force("x", forceX<GraphNode>((n) => anchor(n)?.x ?? 0).strength((n) => (anchor(n) ? 0.15 : 0.03)) as never);
      g.d3Force("y", forceY<GraphNode>((n) => anchor(n)?.y ?? 0).strength((n) => (anchor(n) ? 0.15 : 0.03)) as never);
      g.d3ReheatSimulation();
      return true;
    };
    if (configure()) return;
    const t = setInterval(() => configure() && clearInterval(t), 50);
    return () => clearInterval(t);
  }, [graphRef]);
  return <ForceGraph2D ref={graphRef} {...rest} />;
}
