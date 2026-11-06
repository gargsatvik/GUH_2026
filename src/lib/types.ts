import { z } from "zod";

export type SessionState =
  | "idle"
  | "call_active"
  | "verified_genuine"
  | "verified_scam"
  | "decoy_requested"
  | "decoy_live"
  | "ended";

export type EntityKind = "account" | "phone" | "url" | "wallet" | "alias";
export type FoundBy = "pattern" | "claude" | "seed";
export type TimelineKind =
  | "call"
  | "check"
  | "decoy"
  | "capture"
  | "match"
  | "flag"
  | "payment"
  | "report"
  | "canary"
  | "ally"
  | "coaching"
  | "system";

export interface DemoSession {
  id: string;
  state: SessionState;
  customer_name: string;
  customer_first: string;
  natwest_calling: boolean;
  genuine_code: string | null;
  call_id: string | null;
  conversation_id: string | null;
  call_started_at: string | null;
  decoy_requested_at: string | null;
  decoy_started_at: string | null;
  ended_at: string | null;
  replay: boolean;
  updated_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  scam_type: string;
  region: string;
  first_seen_at: string;
}

export interface Call {
  id: string;
  source: "seed" | "live" | "replay" | "phone";
  status: "live" | "ended";
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  scam_type: string | null;
  impersonated_org: string | null;
  summary: string | null;
  confidence: number | null;
  campaign_id: string | null;
  extraction: Extraction | null;
}

export interface TranscriptLine {
  id: number;
  call_id: string;
  speaker: "caller" | "decoy";
  text: string;
  created_at: string;
}

export interface Entity {
  id: string;
  kind: EntityKind;
  value: string;
  display: string;
  label: string | null;
  flagged: boolean;
  flagged_at: string | null;
  flag_reason: string | null;
  first_seen_at: string;
}

export interface CallEntity {
  call_id: string;
  entity_id: string;
  quote: string | null;
  found_by: FoundBy;
  confirmed: boolean;
  created_at: string;
}

export interface Payment {
  id: string;
  payee_name: string;
  sort_code: string;
  account_number: string;
  amount_pence: number;
  reference: string | null;
  status: "sent" | "paused" | "cancelled" | "approved";
  reason: string | null;
  entity_id: string | null;
  created_at: string;
}

export interface TimelineEvent {
  id: number;
  call_id: string | null;
  kind: TimelineKind;
  title: string;
  detail: string | null;
  created_at: string;
}

export interface Report {
  id: string;
  call_id: string;
  title: string;
  body_md: string;
  sent_to: string | null;
  created_at: string;
}

export interface CanaryHit {
  id: string;
  kind: "card" | "login";
  call_id: string | null;
  detail: CanaryDetail;
  created_at: string;
}

export interface CanaryDetail {
  device: string;
  location: string;
  ip: string;
  attempt: string;
}

export interface CoachingCheck {
  id: string;
  payment_id: string | null;
  likelihood: "low" | "medium" | "high";
  signals: string[];
  suggested_action: string;
  answers: { question: string; answer: string }[];
  created_at: string;
}

export interface Counters {
  id: string;
  calls_taken: number;
  seconds_wasted: number;
  accounts_flagged: number;
  payments_paused: number;
  value_protected_pence: number;
  updated_at: string;
}

export interface CounterDelta {
  calls_taken?: number;
  seconds_wasted?: number;
  accounts_flagged?: number;
  payments_paused?: number;
  value_protected_pence?: number;
}

export interface TableRows {
  demo_sessions: DemoSession;
  campaigns: Campaign;
  calls: Call;
  transcript_lines: TranscriptLine;
  entities: Entity;
  call_entities: CallEntity;
  payments: Payment;
  timeline_events: TimelineEvent;
  reports: Report;
  canary_hits: CanaryHit;
  coaching_checks: CoachingCheck;
  counters: Counters;
}

export type Table = keyof TableRows;

export const TABLES: Table[] = [
  "demo_sessions",
  "campaigns",
  "calls",
  "transcript_lines",
  "entities",
  "call_entities",
  "payments",
  "timeline_events",
  "reports",
  "canary_hits",
  "coaching_checks",
  "counters",
];

/** Primary key of a row, as a string, for merging realtime changes. */
export function rowKey(table: Table, row: Record<string, unknown>): string {
  if (table === "call_entities") return `${row.call_id}:${row.entity_id}`;
  return String(row.id);
}

/** A detail found in a transcript, before it is stored. */
export interface Candidate {
  kind: EntityKind;
  value: string;
  display: string;
  label?: string | null;
  quote?: string | null;
}

// ---------- Claude extraction ----------

export const ExtractionSchema = z.object({
  scam_type: z.string().default("other"),
  impersonated_org: z.string().nullish(),
  caller_names: z.array(z.string()).default([]),
  callback_numbers: z.array(z.string()).default([]),
  payee_accounts: z
    .array(
      z.object({
        sort_code: z.string(),
        account_number: z.string(),
        account_name: z.string().nullish(),
        quote: z.string().nullish(),
      }),
    )
    .default([]),
  crypto_wallets: z.array(z.string()).default([]),
  urls: z.array(z.string()).default([]),
  amount_requested_pounds: z.number().nullish(),
  requested_actions: z.array(z.string()).default([]),
  pressure_tactics: z.array(z.string()).default([]),
  script_phrases: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
  summary: z.string().default(""),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

export const CoachingSchema = z.object({
  likelihood: z.enum(["low", "medium", "high"]),
  signals: z.array(z.string()).default([]),
  suggested_action: z.string().default(""),
});
export type Coaching = z.infer<typeof CoachingSchema>;

// ---------- Intel payload (section 16.1) ----------

export interface IntelPayload {
  callId: string;
  newEntities: {
    id: string;
    kind: EntityKind;
    display: string;
    label: string | null;
    foundBy: FoundBy;
  }[];
  matches: {
    entityId: string;
    display: string;
    kind: EntityKind;
    earlierCalls: number;
    campaignId: string | null;
    campaignName: string | null;
  }[];
  suggestedCampaign: { id: string; name: string } | null;
}
