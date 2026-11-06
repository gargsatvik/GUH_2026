import { z } from "zod";
import { checkSecret } from "./env";

export const json = (data: unknown, status = 200) => Response.json(data, { status });
export const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T> | Response> {
  let raw: unknown = {};
  try {
    const text = await req.text();
    raw = text ? JSON.parse(text) : {};
  } catch {
    return bad("Body must be JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return bad(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
  return parsed.data;
}

export function requireSecret(req: Request): Response | null {
  return checkSecret(req) ? null : bad("Forbidden", 403);
}
