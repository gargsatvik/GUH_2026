// Normalisation (section 18.1). Pure functions, safe in browser and server.
import type { Candidate, EntityKind } from "./types";

const digits = (s: string) => s.replace(/\D/g, "");

export function normaliseSortCode(raw: string): string | null {
  const d = digits(raw);
  return d.length === 6 ? d : null;
}

export function normaliseAccountNumber(raw: string): string | null {
  const d = digits(raw);
  if (d.length === 8) return d;
  if (d.length === 7) return "0" + d;
  return null;
}

export function formatSortCode(sort6: string): string {
  return `${sort6.slice(0, 2)}-${sort6.slice(2, 4)}-${sort6.slice(4, 6)}`;
}

export function normaliseAccount(sortRaw: string, accountRaw: string) {
  const sort = normaliseSortCode(sortRaw);
  const acct = normaliseAccountNumber(accountRaw);
  if (!sort || !acct) return null;
  return { value: `${sort}:${acct}`, display: `${formatSortCode(sort)} ${acct}`, sort, acct };
}

const SHORT_CITY = ["0113", "0114", "0115", "0116", "0117", "0118", "0121", "0131", "0141", "0151", "0161", "0191"];

/** Returns national 11-digit form (0xxxxxxxxxx) or null. */
export function nationalPhone(raw: string): string | null {
  let d = digits(raw);
  if (raw.trim().startsWith("+")) {
    if (!d.startsWith("44")) return null;
  }
  if (d.startsWith("44") && d.length === 12) d = "0" + d.slice(2);
  if (d.length === 10 && !d.startsWith("0")) d = "0" + d;
  if (d.length === 11 && d.startsWith("0")) return d;
  return null;
}

export function formatPhone(national: string): string {
  const n = national;
  if (n.startsWith("07")) return `${n.slice(0, 5)} ${n.slice(5)}`;
  if (n.startsWith("02")) return `${n.slice(0, 3)} ${n.slice(3, 7)} ${n.slice(7)}`;
  if (SHORT_CITY.includes(n.slice(0, 4))) return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
  if (n.startsWith("08")) return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
  return `${n.slice(0, 5)} ${n.slice(5)}`;
}

export function normalisePhone(raw: string) {
  const n = nationalPhone(raw);
  if (!n) return null;
  return { value: "+44" + n.slice(1), display: formatPhone(n) };
}

export function normaliseUrl(raw: string): string | null {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^[a-z]+:\/\//, "");
  s = s.replace(/^www\./, "");
  s = s.split(/[/?#]/)[0];
  s = s.replace(/\.+$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s)) return null;
  return s;
}

export function normaliseWallet(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  return s.startsWith("0x") || s.startsWith("0X") ? s.toLowerCase() : s;
}

const TITLES = /\b(mr|mrs|ms|miss|officer|detective|dc|pc|sergeant|sgt|inspector)\.?\s+/gi;

export function normaliseAlias(raw: string): string | null {
  const s = raw.replace(TITLES, "").replace(/\s+/g, " ").trim().toLowerCase();
  return s.length >= 3 ? s : null;
}

/** Build a stored candidate from loosely formatted input. */
export function toCandidate(
  kind: EntityKind,
  input: { raw?: string; sort?: string; account?: string; label?: string | null; quote?: string | null },
): Candidate | null {
  const label = input.label?.trim() || null;
  const quote = input.quote ?? null;
  switch (kind) {
    case "account": {
      const a = normaliseAccount(input.sort ?? "", input.account ?? "");
      return a ? { kind, value: a.value, display: a.display, label, quote } : null;
    }
    case "phone": {
      const p = normalisePhone(input.raw ?? "");
      return p ? { kind, value: p.value, display: p.display, label, quote } : null;
    }
    case "url": {
      const u = normaliseUrl(input.raw ?? "");
      return u ? { kind, value: u, display: u, label, quote } : null;
    }
    case "wallet": {
      const w = normaliseWallet(input.raw ?? "");
      return w ? { kind, value: w, display: input.raw!.trim(), label, quote } : null;
    }
    case "alias": {
      const n = normaliseAlias(input.raw ?? "");
      return n ? { kind, value: n, display: input.raw!.trim(), label, quote } : null;
    }
  }
}
