import { json, requireSecret } from "@/lib/http";
import { resetDemo } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = requireSecret(req);
  if (denied) return denied;
  await resetDemo();
  return json({ ok: true });
}
