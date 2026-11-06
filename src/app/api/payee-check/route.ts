import { after } from "next/server";
import { z } from "zod";
import { bad, body, json } from "@/lib/http";
import { PayeeInputError, payeeCheck } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  payeeName: z.string().trim().min(1).max(80),
  sortCode: z.string(),
  accountNumber: z.string(),
  amountPence: z.number().int().positive().max(100_000_000),
  reference: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const b = await body(req, Body);
  if (b instanceof Response) return b;
  try {
    return json(await payeeCheck(b, (task) => after(task)));
  } catch (e) {
    if (e instanceof PayeeInputError) return bad(e.message);
    throw e;
  }
}
