# Decoy

Every scam call becomes protection for the next customer.

Concept demo built at GreatUniHack 2026. Not a NatWest product. All data is fictional.

A customer on a suspicious "NatWest" call checks it in the app, learns it is not NatWest, and passes the caller to the Decoy line. Decoy plays her son, keeps the caller talking and gets the account they want paid. Within seconds that account is blocked, so the next customer's payment is paused before any money is lost.

## Screens

| Path | Device | What it is |
|---|---|---|
| `/app` | Phone | Mock banking app: call check, pass to Decoy, payments, coaching check |
| `/caller` | Laptop with headset | Caller console. A teammate plays the caller; their voice goes to the Decoy line |
| `/ops` | Projector | Fraud Operations dashboard. Press `D` for demo controls |
| `/ops/reports/[id]` | | Fraud report |
| `/ops/trace?wallet=...` | | Wallet trace (simulated, labelled as demonstration data) |
| `/ally` | Phone | Trusted contact approves or stops a paused payment |

## Run it locally (no accounts needed)

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no environment variables the app uses an in-memory store loaded with the seed data, and Server-Sent Events stand in for Supabase Realtime. Restarting the server resets the data.

Without voice keys, try the whole story with replay: open `/ops`, press `D`, then **Run replay**. Or on `/caller`, arm the line, pass the call from `/app`, choose **Connect typed line** and type caller lines.

## Run it for real

1. Copy `.env.example` to `.env.local` (and to Vercel) and fill in what you have. Each service is optional and falls back on its own.
2. Supabase: run `supabase/schema.sql`, then `supabase/seed.sql` in the SQL editor. `seed.sql` is generated from `src/lib/seed.ts` with `npm run gen:seed`.
3. ElevenLabs: create the agents in `agents/decoy-david.md` (and `agents/protect-check.md` for the coaching check).
4. n8n on your laptop (for testing): from the project folder, `npm --prefix n8n-local run start` starts n8n at http://localhost:5678 with the four workflows already loaded and published (the `n8n-local` folder sits next to this repo and is not part of it). Create the owner account the first time you open it. The app reads the webhook URLs and shared secret from `.env.local`.
5. n8n Cloud (for the demo): import the four files in `n8n/`, fill in the **Config** node in each (app URL, shared secret, and optionally a Discord or Slack webhook; chat steps are skipped when it is empty), set the Header Auth credential on each webhook (`x-decoy-secret`), activate, and put the production webhook URLs in the env vars. Set `N8N_ENABLED=true`.

## Demo checklist (plan section 25.1)

1. `/ops`, press `D`, **Reset demo**. Counters: 30 calls, 3 h 25 min, 6 blocked, 4 paused, £18,450.
2. `/caller`: **Arm line**.
3. **Start customer call** (or long-press the time on the phone). The phone shows the call banner.
4. Phone: **Check this call**, then **Pass this call to Decoy**, then **Call Decoy**. The caller console rings and connects.
5. Caller follows the role card. The number links to 3 earlier reports; the account is blocked within seconds.
6. Caller says "Forget it" and presses **End call**. The phone shows the summary.
7. On the phone, pay £2,000 to 20-45-77 63849120: paused. Counters: 5 paused, £20,450.

## Tests

```bash
npm test
```

## Notes on choices that differ from the plan

- **Local preview mode**: an in-memory store and SSE stream replace Supabase when it is not configured, so the project runs with no accounts.
- **Claude requests**: current Claude models reject forced `tool_choice` and `temperature`, so capture uses `tool_choice: auto` with a strict tool schema, an explicit instruction, zod validation and low effort. Server-side refusal fallback is on.
- **Pattern matcher** also understands spoken tens ("twenty, forty-five"), the letter O between digits, and caller names, so the demo links even without Claude.
- **Hold space to talk** on `/caller` stops room noise (the presenter, judges) reaching the Decoy line.
- **Phone line (stretch 7)** works through the ElevenLabs post-call webhook, so phone calls show up when they end, not live.
- Extra schema fields: `demo_sessions.decoy_requested_at`, `calls.extraction`, `call_entities.confirmed`, `coaching_checks`, `bump_counters()`.
