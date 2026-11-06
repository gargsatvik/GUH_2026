"use client";
import Link from "next/link";
import clsx from "clsx";
import {
  AlertTriangle,
  Ban,
  Check,
  CreditCard,
  FileText,
  Landmark,
  Link2,
  Network,
  Phone,
  PhoneCall,
  PoundSterling,
  Search,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  UsersRound,
  Wallet,
  Waypoints,
} from "lucide-react";
import { Card, CountUp, IconCircle, Pill } from "@/components/ui";
import { CANARY_ISSUED } from "@/lib/canary";
import { COPY } from "@/lib/copy";
import { clockTime, daysAgo, hoursMinutes, moneyWhole } from "@/lib/format";
import type { CallEntity, CanaryHit, CoachingCheck, Counters as CountersRow, Entity, Report, TimelineEvent, TimelineKind } from "@/lib/types";

export function PanelHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-serif text-[20px] leading-7 font-semibold">{title}</h2>
      {children}
    </div>
  );
}

// ---------- Counters ----------

export function Counters({ c }: { c: CountersRow | undefined }) {
  const stats = [
    { label: "Calls taken", value: c?.calls_taken ?? 0, fmt: (n: number) => String(n) },
    { label: "Caller time wasted", value: c?.seconds_wasted ?? 0, fmt: hoursMinutes },
    { label: "Accounts blocked", value: c?.accounts_flagged ?? 0, fmt: (n: number) => String(n) },
    { label: "Payments paused", value: c?.payments_paused ?? 0, fmt: (n: number) => String(n) },
    { label: "Value protected", value: c?.value_protected_pence ?? 0, fmt: moneyWhole },
  ];
  return (
    <Card className="grid grid-cols-5 divide-x divide-line">
      {stats.map((s) => (
        <div key={s.label} className="px-5 py-3">
          <div className="text-[13px] font-medium tracking-[0.01em] text-muted">{s.label}</div>
          <div className="tnum mt-1 font-mono text-[36px] leading-[44px] font-medium">
            <CountUp value={s.value} format={s.fmt} />
          </div>
        </div>
      ))}
    </Card>
  );
}

// ---------- Timeline ----------

const KIND_ICON: Record<TimelineKind, typeof Phone> = {
  call: PhoneCall,
  check: ShieldCheck,
  decoy: UserRound,
  capture: Search,
  match: Network,
  flag: Ban,
  payment: PoundSterling,
  report: FileText,
  canary: AlertTriangle,
  ally: UsersRound,
  coaching: ShieldAlert,
  system: Settings,
};

const KIND_TONE: Partial<Record<TimelineKind, string>> = {
  flag: "text-danger",
  payment: "text-warning",
  canary: "text-warning",
  coaching: "text-warning",
  report: "text-success",
  match: "text-brand",
};

export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (!events.length) return <p className="text-[15px] text-muted">{COPY.ops.noTimeline}</p>;
  return (
    <ol className="flex flex-col" aria-live="polite">
      {events.map((e) => {
        const Icon = KIND_ICON[e.kind] ?? Settings;
        return (
          <li key={e.id} className="rise-in flex items-start gap-3 border-b border-line py-2 last:border-0">
            <span className="tnum w-[68px] shrink-0 pt-0.5 font-mono text-[13px] text-muted">{clockTime(e.created_at, true)}</span>
            <Icon size={16} className={clsx("mt-0.5 shrink-0", KIND_TONE[e.kind] ?? "text-muted")} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] leading-[22px]">{e.title}</div>
              {e.detail && <div className="truncate text-[13px] text-muted">{e.detail}</div>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ---------- Captured details ----------

const ENTITY_ICON = { account: Landmark, phone: Phone, url: Link2, wallet: Wallet, alias: UserRound } as const;
const ENTITY_LABEL = { account: "Payee account", phone: "Callback number", url: "Link", wallet: "Crypto wallet", alias: "Caller name" } as const;

export function DetailRow({
  e,
  link,
  earlier,
}: {
  e: Entity;
  link?: CallEntity;
  earlier: number;
}) {
  const Icon = ENTITY_ICON[e.kind];
  const body = (
    <div className="rise-in flex items-start gap-3 py-2.5">
      <IconCircle tone="brand" size={32}>
        <Icon size={16} />
      </IconCircle>
      <div className="min-w-0 flex-1">
        <div className="tnum truncate font-mono text-[15px] font-medium">{e.display}</div>
        <div className="text-[13px] text-muted">
          {e.label && e.kind === "account" ? `${e.label} · ` : ""}
          {ENTITY_LABEL[e.kind]}
          {link?.confirmed && link.found_by !== "seed" && (
            <span className="ml-1.5 inline-flex items-center gap-0.5 text-success">
              <Check size={12} /> Confirmed
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        {e.flagged && <Pill tone="danger">Blocked</Pill>}
        {earlier > 0 ? <Pill tone="brand">Seen {earlier} time{earlier === 1 ? "" : "s"} before</Pill> : <Pill tone="muted">New</Pill>}
      </div>
    </div>
  );
  if (e.kind === "wallet")
    return (
      <Link href={`/ops/trace?wallet=${encodeURIComponent(e.display)}`} className="block hover:bg-paper">
        {body}
      </Link>
    );
  return body;
}

// ---------- Campaign ----------

export function CampaignCard({
  name,
  calls,
  firstSeen,
  blocked,
}: {
  name: string;
  calls: number;
  firstSeen: string | null;
  blocked: number;
}) {
  return (
    <Card className="p-4">
      <div className="text-[13px] font-medium text-muted">Campaign</div>
      <div className="mt-1 flex items-center gap-2">
        <Waypoints size={18} className="text-brand" />
        <span className="font-serif text-[20px] leading-7 font-semibold">{name}</span>
      </div>
      <div className="mt-1 text-[15px] text-muted">
        {calls} calls · first seen {firstSeen ? `${daysAgo(firstSeen)} days ago` : "today"} · {blocked} accounts blocked
      </div>
    </Card>
  );
}

// ---------- Decoy details issued (17) ----------

export function DecoyDetailsCard({ hits }: { hits: CanaryHit[] }) {
  return (
    <Card className={clsx("p-4", hits.length && "border-warning/40 bg-warning-tint")}>
      <div className="text-[13px] font-medium text-muted">Decoy details issued on this call</div>
      <ul className="mt-2 flex flex-col gap-1.5">
        {CANARY_ISSUED.map((d) => {
          const hit = hits.find((h) => h.kind === d.kind);
          return (
            <li key={d.kind} className="flex items-center justify-between gap-2 text-[15px]">
              <span className="flex items-center gap-2">
                {d.kind === "card" ? <CreditCard size={14} className="text-muted" /> : <ShieldCheck size={14} className="text-muted" />}
                {d.label} <span className="tnum font-mono text-muted">{d.masked}</span>
              </span>
              {hit ? <Pill tone="warning">Used</Pill> : <Pill tone="success">Watching</Pill>}
            </li>
          );
        })}
      </ul>
      {hits.map((h) => (
        <p key={h.id} className="rise-in mt-3 text-[15px] leading-[22px] font-medium text-warning">
          Used {clockTime(h.created_at)}. {h.kind === "card" ? "£249.99 at an electronics retailer. Declined." : "Sign-in attempt blocked."} Device:{" "}
          {h.detail.device.replace(", new device", ", new")}. Location: {h.detail.location.replace("Approx.", "approx.").replace(", UK", "")}.
        </p>
      ))}
    </Card>
  );
}

// ---------- Reports ----------

export function ReportsCard({ reports }: { reports: Report[] }) {
  if (!reports.length) return null;
  return (
    <Card className="p-4">
      <div className="text-[13px] font-medium text-muted">Reports</div>
      <ul className="mt-2 flex flex-col gap-1">
        {reports.map((r) => (
          <li key={r.id}>
            <Link href={`/ops/reports/${r.id}`} className="flex items-center gap-2 text-[15px] text-brand underline-offset-4 hover:underline">
              <FileText size={14} /> {r.title}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------- Coaching check (stretch 6) ----------

export function CoachingCard({ check }: { check: CoachingCheck | undefined }) {
  if (!check) return null;
  const tone = check.likelihood === "high" ? "danger" : check.likelihood === "medium" ? "warning" : "success";
  return (
    <Card className="rise-in p-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-medium text-muted">Coaching check</div>
        <Pill tone={tone}>Signs of coaching: {check.likelihood[0].toUpperCase() + check.likelihood.slice(1)}</Pill>
      </div>
      {check.signals.length > 0 && (
        <ul className="mt-2 list-disc pl-5 text-[15px] leading-[22px]">
          {check.signals.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-[13px] text-muted">{check.suggested_action}</p>
    </Card>
  );
}
