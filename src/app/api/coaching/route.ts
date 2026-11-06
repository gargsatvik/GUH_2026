import { z } from "zod";
import { body, json } from "@/lib/http";
import { submitCoaching } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Body = z.object({
  paymentId: z.string().uuid().nullable(),
  answers: z.array(z.object({ question: z.string().max(300), answer: z.string().max(2000) })).min(1).max(12),
});

export async function POST(req: Request) {
  const b = await body(req, Body);
  if (b instanceof Response) return b;
  return json(await submitCoaching(b.paymentId, b.answers));
}
