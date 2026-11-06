import { json } from "@/lib/http";
import { checkCall } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  return json(await checkCall());
}
