import { after } from "next/server";
import { z } from "zod";
import { body, json } from "@/lib/http";
import { tripCanary } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ kind: z.enum(["card", "login"]) });

export async function POST(req: Request) {
  const b = await body(req, Body);
  if (b instanceof Response) return b;
  await tripCanary(b.kind, (task) => after(task));
  return json({ ok: true });
}
