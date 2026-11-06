// Formatting (section 22.4). UK locale everywhere.

export function money(pence: number): string {
  return (pence / 100).toLocaleString("en-GB", { style: "currency", currency: "GBP" });
}

export function moneyWhole(pence: number): string {
  return (pence / 100).toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });
}

/** "6 min 41 s" */
export function durationWords(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m === 0) return `${r} s`;
  return `${m} min ${r} s`;
}

/** "06:41" */
export function timer(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** "3 h 25 min" */
export function hoursMinutes(seconds: number): string {
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h === 0) return `${m} min`;
  return `${h} h ${m} min`;
}

export function clockTime(iso: string | Date, withSeconds = false): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "3 minutes ago", "2 days ago" */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"} ago`;
  if (s < 60) return "less than a minute ago";
  const m = Math.floor(s / 60);
  if (m < 60) return plural(m, "minute");
  const h = Math.floor(m / 60);
  if (h < 24) return plural(h, "hour");
  return plural(Math.floor(h / 24), "day");
}

export function daysAgo(iso: string, now = Date.now()): number {
  return Math.floor((now - new Date(iso).getTime()) / 86400000);
}

export function maskAccount(display: string): string {
  return `ending ${display.replace(/\D/g, "").slice(-4)}`;
}

export const SCAM_TYPE_LABELS: Record<string, string> = {
  safe_account: "Safe account",
  impersonation_bank: "Bank impersonation",
  impersonation_police: "Police impersonation",
  impersonation_government: "Government impersonation",
  government_impersonation: "Government impersonation",
  courier: "Courier",
  investment: "Investment",
  romance: "Romance",
  purchase: "Purchase",
  invoice_redirect: "Invoice redirect",
  remote_access: "Remote access",
  other: "Other",
};

export const scamTypeLabel = (t: string | null | undefined) => (t ? SCAM_TYPE_LABELS[t] ?? t : "Unknown");
