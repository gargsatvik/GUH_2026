// Seed data (section 11). All values are fictional.
// Times are stored as "seconds ago" so both the in-memory store and the
// generated seed.sql can make the data look recent.
// This file has no imports so scripts/gen-seed-sql.ts can run it directly with Node.

export const DAY = 86400;

export interface SeedCampaign {
  id: string;
  name: string;
  scam_type: string;
  region: string;
}

export const SEED_CAMPAIGNS: SeedCampaign[] = [
  { id: "safe-account-nw", name: "Safe account, North West", scam_type: "safe_account", region: "North West" },
  { id: "courier-card", name: "Courier card collection", scam_type: "courier", region: "Greater London" },
  { id: "hmrc-refund", name: "Tax refund messages", scam_type: "government_impersonation", region: "National" },
  { id: "crypto-invest", name: "Crypto investment returns", scam_type: "investment", region: "National" },
];

export interface SeedEntity {
  key: string;
  id: string;
  kind: "account" | "phone" | "url" | "wallet" | "alias";
  display: string;
  value: string;
  label: string | null;
  flaggedDaysAgo: number | null;
}

const eid = (n: number) => `00000000-0000-0000-0001-${String(n).padStart(12, "0")}`;
export const seedCallId = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;

export const FLAG_REASON_SEED = "Named as the payee in a reported scam call.";

export const SEED_ENTITIES: SeedEntity[] = [
  { key: "P1", id: eid(1), kind: "phone", display: "0161 496 0732", value: "+441614960732", label: null, flaggedDaysAgo: null },
  { key: "P2", id: eid(2), kind: "phone", display: "0161 496 0215", value: "+441614960215", label: null, flaggedDaysAgo: null },
  { key: "P3", id: eid(3), kind: "phone", display: "07700 900417", value: "+447700900417", label: null, flaggedDaysAgo: null },
  { key: "P4", id: eid(4), kind: "phone", display: "020 7946 0381", value: "+442079460381", label: null, flaggedDaysAgo: null },
  { key: "P5", id: eid(5), kind: "phone", display: "07700 900862", value: "+447700900862", label: null, flaggedDaysAgo: null },
  { key: "P6", id: eid(6), kind: "phone", display: "07700 900123", value: "+447700900123", label: null, flaggedDaysAgo: null },
  { key: "P7", id: eid(7), kind: "phone", display: "0113 496 0554", value: "+441134960554", label: null, flaggedDaysAgo: null },
  { key: "P8", id: eid(8), kind: "phone", display: "07700 900990", value: "+447700900990", label: null, flaggedDaysAgo: null },
  { key: "A1", id: eid(11), kind: "account", display: "30-91-55 21876043", value: "309155:21876043", label: "K Bennett", flaggedDaysAgo: 17 },
  { key: "A2", id: eid(12), kind: "account", display: "30-91-55 55190328", value: "309155:55190328", label: "R Shah", flaggedDaysAgo: 8 },
  { key: "A3", id: eid(13), kind: "account", display: "52-21-08 70345519", value: "522108:70345519", label: "L Moran Trading", flaggedDaysAgo: 1 },
  { key: "A4", id: eid(14), kind: "account", display: "09-01-29 33812706", value: "090129:33812706", label: "T Adeyemi", flaggedDaysAgo: 12 },
  { key: "A5", id: eid(15), kind: "account", display: "77-46-12 48201937", value: "774612:48201937", label: "Refunds Processing Ltd", flaggedDaysAgo: 6 },
  { key: "A6", id: eid(16), kind: "account", display: "60-02-15 11938274", value: "600215:11938274", label: "Coinvault Partners", flaggedDaysAgo: 4 },
  { key: "U1", id: eid(21), kind: "url", display: "natwest-secure-verify.example", value: "natwest-secure-verify.example", label: null, flaggedDaysAgo: null },
  { key: "U2", id: eid(22), kind: "url", display: "hmrc-refund-claim.example", value: "hmrc-refund-claim.example", label: null, flaggedDaysAgo: null },
  { key: "U3", id: eid(23), kind: "url", display: "gov-tax-rebate.example", value: "gov-tax-rebate.example", label: null, flaggedDaysAgo: null },
  { key: "U4", id: eid(24), kind: "url", display: "coinvault-returns.example", value: "coinvault-returns.example", label: null, flaggedDaysAgo: null },
  { key: "W1", id: eid(31), kind: "wallet", display: "TDEMOx9Qf2Rk7LmN3pV8sYc4hJwA1bZ", value: "TDEMOx9Qf2Rk7LmN3pV8sYc4hJwA1bZ", label: "USDT (Tron)", flaggedDaysAgo: null },
  { key: "W2", id: eid(32), kind: "wallet", display: "0xDEMO4f2a9c81b7e3d05a6f", value: "0xdemo4f2a9c81b7e3d05a6f", label: "USDT (Ethereum)", flaggedDaysAgo: null },
  { key: "N1", id: eid(41), kind: "alias", display: "Daniel Hughes", value: "daniel hughes", label: "Says he is NatWest fraud team", flaggedDaysAgo: null },
  { key: "N2", id: eid(42), kind: "alias", display: "Officer Mark Reid", value: "mark reid", label: "Says he is a police officer", flaggedDaysAgo: null },
];

export interface SeedCall {
  n: number;
  id: string;
  daysAgo: number;
  campaign: string;
  minutes: number;
  entities: string[];
}

const CALL_ROWS: [number, number, string, number, string][] = [
  [1, 18, "safe-account-nw", 6, "P1 A1 N1"],
  [2, 17, "safe-account-nw", 4, "P2 A1"],
  [3, 9, "safe-account-nw", 11, "P1 A2 U1"],
  [4, 8, "safe-account-nw", 7, "P3 A2 N1"],
  [5, 5, "safe-account-nw", 5, "P2 A3"],
  [6, 2, "safe-account-nw", 13, "P1 A3 N1"],
  [7, 2, "safe-account-nw", 3, "P3 A1"],
  [8, 1, "safe-account-nw", 8, "P2 U1"],
  [9, 1, "safe-account-nw", 6, "P3 A3"],
  [10, 20, "courier-card", 9, "P4 A4 N2"],
  [11, 15, "courier-card", 4, "P5 A4"],
  [12, 12, "courier-card", 6, "P4 N2"],
  [13, 10, "courier-card", 3, "P5"],
  [14, 7, "courier-card", 12, "P4 A4"],
  [15, 4, "courier-card", 5, "P5 N2"],
  [16, 3, "courier-card", 7, "P4"],
  [17, 21, "hmrc-refund", 4, "P6 U2"],
  [18, 19, "hmrc-refund", 6, "P7 U2 A5"],
  [19, 14, "hmrc-refund", 3, "P6 U3"],
  [20, 11, "hmrc-refund", 5, "P7 U3"],
  [21, 6, "hmrc-refund", 8, "P6 U2 A5"],
  [22, 5, "hmrc-refund", 2, "P7"],
  [23, 3, "hmrc-refund", 4, "P6 U3"],
  [24, 1, "hmrc-refund", 6, "P7 A5"],
  [25, 16, "crypto-invest", 14, "P8 U4 W1"],
  [26, 13, "crypto-invest", 9, "P8 A6"],
  [27, 9, "crypto-invest", 7, "U4 W1"],
  [28, 6, "crypto-invest", 10, "P8 W2"],
  [29, 4, "crypto-invest", 12, "U4 A6 W2"],
  [30, 2, "crypto-invest", 6, "P8 W1"],
];

export const SEED_CALLS: SeedCall[] = CALL_ROWS.map(([n, daysAgo, campaign, minutes, ents]) => ({
  n,
  id: seedCallId(n),
  daysAgo,
  campaign,
  minutes,
  entities: ents.split(" "),
}));

const SUMMARIES: Record<string, string[]> = {
  "safe-account-nw": [
    "Caller claimed to be from the NatWest fraud team and asked the customer to move savings to a safe account.",
    "Caller said he was from NatWest fraud and told the customer her savings had to be moved to a safe account today.",
    "Caller posing as the NatWest fraud team pressed the customer to transfer savings to a so-called safe account.",
  ],
  "courier-card": [
    "Caller claimed to be a police officer and arranged a courier to collect the customer's card.",
    "Caller posing as a police officer asked the customer to hand their card to a courier for evidence.",
  ],
  "hmrc-refund": [
    "Message claimed the customer was owed a tax refund and linked to a fake claim page.",
    "Message said a tax rebate was waiting and sent the customer to a fake claim site.",
  ],
  "crypto-invest": [
    "Caller promised guaranteed returns and asked for a deposit to a crypto wallet.",
    "Caller offered guaranteed crypto returns and asked the customer to send a first deposit to a wallet.",
  ],
};

const ORG: Record<string, string> = {
  "safe-account-nw": "NatWest fraud team",
  "courier-card": "Police",
  "hmrc-refund": "HMRC",
  "crypto-invest": "Coinvault Partners",
};

const CAMPAIGN_SCAM_TYPE: Record<string, string> = {
  "safe-account-nw": "safe_account",
  "courier-card": "courier",
  "hmrc-refund": "impersonation_government",
  "crypto-invest": "investment",
};

export interface SeedCallRow {
  id: string;
  startedAgo: number;
  endedAgo: number;
  duration_seconds: number;
  scam_type: string;
  impersonated_org: string;
  summary: string;
  confidence: number;
  campaign_id: string;
}

export function seedCallRows(): SeedCallRow[] {
  return SEED_CALLS.map((c) => {
    // Spread the time of day so calls do not all line up exactly.
    const hourOffset = ((c.n * 37) % 9) * 3600 + ((c.n * 13) % 60) * 60;
    const startedAgo = c.daysAgo * DAY + hourOffset;
    const duration = c.minutes * 60;
    const variants = SUMMARIES[c.campaign];
    return {
      id: c.id,
      startedAgo,
      endedAgo: startedAgo - duration,
      duration_seconds: duration,
      scam_type: CAMPAIGN_SCAM_TYPE[c.campaign],
      impersonated_org: ORG[c.campaign],
      summary: variants[c.n % variants.length],
      confidence: 0.9,
      campaign_id: c.campaign,
    };
  });
}

export function seedCampaignFirstSeenAgo(campaignId: string): number {
  const rows = seedCallRows().filter((r) => r.campaign_id === campaignId);
  return Math.max(...rows.map((r) => r.startedAgo));
}

export function seedCallEntityRows(): { call_id: string; entity_id: string; createdAgo: number }[] {
  const calls = seedCallRows();
  const out: { call_id: string; entity_id: string; createdAgo: number }[] = [];
  for (const c of SEED_CALLS) {
    const row = calls.find((r) => r.id === c.id)!;
    for (const key of c.entities) {
      const e = SEED_ENTITIES.find((x) => x.key === key)!;
      out.push({ call_id: c.id, entity_id: e.id, createdAgo: row.startedAgo - 60 });
    }
  }
  return out;
}

export interface SeedPayment {
  id: string;
  entityKey: string;
  amount_pence: number;
  daysAgo: number;
  payee_name: string;
}

export const SEED_PAYMENTS: SeedPayment[] = [
  { id: "00000000-0000-0000-0002-000000000001", entityKey: "A1", amount_pence: 450000, daysAgo: 16, payee_name: "K Bennett" },
  { id: "00000000-0000-0000-0002-000000000002", entityKey: "A2", amount_pence: 295000, daysAgo: 7, payee_name: "R Shah" },
  { id: "00000000-0000-0000-0002-000000000003", entityKey: "A4", amount_pence: 800000, daysAgo: 11, payee_name: "T Adeyemi" },
  { id: "00000000-0000-0000-0002-000000000004", entityKey: "A6", amount_pence: 300000, daysAgo: 3, payee_name: "Coinvault Partners" },
];

export const SEED_PAYMENT_REASON = "Account reported in a scam call";
