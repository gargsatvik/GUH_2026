# Decoy

**Every scam call becomes protection for the next customer.**

Concept demo built at GreatUniHack 2026. Not a NatWest product. All data is fictional.

---

## Contents

- [The problem](#the-problem)
- [What Decoy does](#what-decoy-does)
- [The demo story](#the-demo-story)
- [Screens](#screens)
- [How it works](#how-it-works)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Run it locally](#run-it-locally-no-accounts-needed)
- [Connect the real services](#connect-the-real-services)
- [Demo guide](#demo-guide)
- [Project structure](#project-structure)
- [Environment variables](#environment-variables)
- [Tests](#tests)
- [Limits and honest notes](#limits-and-honest-notes)
- [Safety and ethics](#safety-and-ethics)

---

## The problem

A criminal calls a customer pretending to be NatWest's fraud team and talks them into moving money to a "safe account". Today the best outcome is that the customer hangs up. The criminal simply calls the next person, the account they wanted paid stays open, and the bank learns nothing until someone has lost money.

Since October 2024, UK banks have had to reimburse most victims of authorised push payment scams, with the cost shared between the sending and receiving bank. Scam intelligence usually arrives days later, from victims. Decoy gets it in minutes, from the criminal, before anyone pays.

## What Decoy does

1. **Check.** While on a phone call, the customer opens the banking app and taps "Is this call really from NatWest?" The bank knows whether any of its staff are calling that customer, so the answer is certain. Caller ID is never used, so a spoofed number makes no difference.
2. **Pass.** If the call is not from NatWest, the customer can pass the caller to the **Decoy line**. They say "hold on, let me get my son", call Decoy, merge the calls and mute themselves.
3. **Capture.** Decoy plays David, the customer's son. It keeps the caller talking and gets them to say, clearly and more than once, where they want the money sent: sort code and account number, callback number, website links, crypto wallets, and the name they use. If pushed for card or login details, it reads out decoy details that the bank controls and watches.
4. **Connect.** Every detail is matched against earlier scam reports. Shared details link the call to a known scam campaign.
5. **Protect.** The account the caller named is blocked for incoming payments within seconds. When any other customer tries to pay it, the payment is paused and they are told why. A fraud report is written and sent to Fraud Operations automatically. If the criminal tries the decoy card or login, the bank is alerted with the device and location.

**How it differs from what exists:** O2's Daisy wastes scammers' time but only answers numbers O2 seeded, and stops no payments. Monzo Call Status and CommBank CallerCheck confirm whether the bank is calling but stop at "hang up". Decoy combines both and closes the loop: the customer sends the criminal to Decoy, and what Decoy captures stops the next payment.

## The demo story

| Step | Who | What happens |
|---|---|---|
| 1 | Caller (a teammate) | Rings "Margaret", 72, claiming to be Daniel Hughes from the NatWest fraud team |
| 2 | Margaret (phone) | Sees "You're on a phone call" in her app, taps **Check this call**. The screen turns red: "This call is not from NatWest" |
| 3 | Margaret | Taps **Pass this call to Decoy**, then **Call Decoy** |
| 4 | Decoy line | "Hello? Sorry, this is David, I'm Margaret's son..." |
| 5 | Caller | Gives a callback number (0161 496 0732) and a "safe account" (20-45-77 63849120, J Carter) |
| 6 | Fraud Operations | The number has appeared in 3 earlier reports, so the call joins the campaign "Safe account, North West". The account, never reported before, is blocked seconds after it was spoken |
| 7 | Caller | "Forget it." Hangs up. Margaret sees "Decoy kept the caller busy for..." |
| 8 | Next customer (a judge) | Tries to pay £2,000 to that account. "We've paused this payment. This account was reported in a scam call 3 minutes ago." |

## Screens

| Path | Device | What it is |
|---|---|---|
| `/` | Any | Landing page with links to each screen |
| `/app` | Phone | Mock banking app: home, call banner, call check, pass to Decoy, Decoy live, summary, payments, coaching check |
| `/caller` | Laptop with headset | Caller console. A teammate plays the criminal; their voice goes to the Decoy line. Includes the role card and the stolen card and login buttons |
| `/ops` | Projector (1920 x 1080) | Fraud Operations dashboard: counters, live transcript, captured details, connections graph, action timeline, campaign, decoy details, reports. Press `D` for demo controls |
| `/ops/reports/[id]` | Any | The fraud report for a call, printable |
| `/ops/trace?wallet=...` | Any | Wallet trace for a captured crypto wallet (simulated, labelled as demonstration data) |
| `/ally` | Phone | Trusted contact (Claire, the daughter) stops or allows a paused payment |

All screens follow one shared session, so tapping on the phone updates the laptop and the projector within a second.

## How it works

### Architecture

```
 Phone: /app                              Laptop: /caller
  check call, pass to Decoy, pay           microphone + speakers, ElevenLabs voice session
        |                                        |
        v                                        v
 +---------------------------------------------------------------+
 |  Next.js app (pages + API routes in src/app/api)              |
 |   session state       transcript intake     detail capture    |
 |   call check          matching + campaigns  payee check       |
 |   actions: block, timeline, counters, reports                 |
 +---------------------------------------------------------------+
        |                    |                        ^
        v                    v                        | calls back to /api/actions/*
 Supabase Postgres      Claude (Anthropic)       n8n workflows
 + Realtime             detail capture,          intel-received, session-ended,
 (or in-memory store    reports, coaching        canary-tripped, trusted-contact
  for local preview)
        |
        v
 Projector: /ops, updated live
```

Key principles:

- **One shared demo session.** A single `demo_sessions` row (`demo`) holds the call's state. Every screen subscribes to it. There are no logins or pairing codes.
- **The database is the message bus.** Screens never talk to each other. A screen calls an API route, the route writes to the database, and every subscribed screen updates.
- **All writes go through the server.** Browsers only read. Protected routes need a shared secret.
- **One set of business actions** (`src/lib/actions.ts`): API routes, n8n callbacks and the built-in fallback all call the same functions, so behaviour is identical whether n8n is on or off.

### The call, step by step

The session moves through these states:

```
idle -> call_active -> verified_scam -> decoy_requested -> decoy_live -> ended
                    -> verified_genuine (when NatWest really is calling)
```

1. **Call check** (`POST /api/check-call`). Waits about a second so "Checking with NatWest" is visible, then returns *not NatWest*, or *genuine* with a four-digit code the colleague can read out. In the demo, the "NatWest is calling this customer" switch stands in for the bank's phone system.
2. **Pass to Decoy** (`request_decoy`). Creates a `calls` row and moves to `decoy_requested`. The caller console sees this, plays a ring and starts the ElevenLabs session. If nothing connects within 8 seconds, the dashboard offers to switch to replay.
3. **Live call.** The ElevenLabs browser SDK reports each finished turn. The caller console posts every line to `/api/transcript`.
4. **Detail capture**, in two layers:
   - **Instant pattern match** on every caller line, with no network call. It turns spoken numbers into digits ("oh one six one", "twenty, forty-five, seventy-seven", "double seven"), then finds sort codes, account numbers, UK phone numbers, links and caller names. A sort code on one line pairs with an account number on the next. Details appear on the dashboard in under a second.
   - **Structured pass with Claude** on the whole transcript so far. It returns confirmed details, the scam type, who the caller claims to be, pressure tactics and a one-line summary, through tool use with a strict schema. It ignores anything Decoy said, so decoy card numbers are never recorded as criminal details. When it agrees with the instant match, the detail is marked **Confirmed**. If Claude is slow or unavailable, the instant match still drives everything.
5. **End of call** (`/api/call/end`). Records the duration, updates the counters, shows the summary on the phone, then runs a final capture pass and produces the fraud report in the background.

### Matching and campaigns

Matching is exact, on standardised values:

| Detail | Stored as | Shown as |
|---|---|---|
| Account | `204577:63849120` | `20-45-77 63849120` |
| Phone | `+441614960732` | `0161 496 0732` |
| Link | `natwest-secure-verify.example` | the same |
| Wallet | trimmed, lower case for `0x` addresses | as given |
| Caller name | lower case, titles removed (`daniel hughes`) | as given |

When a detail is captured, it is looked up by type and value. If it already exists, the call is attached to the same record, and every earlier call that used it becomes a match ("0161 496 0732 was used in 3 earlier reported calls"). The call is linked to whichever campaign appears most often among all the earlier calls it shares details with.

Campaigns let Fraud Operations see one criminal operation instead of scattered reports. They give the evidence for blocking an account no one has reported yet, and show the operation growing on the connections graph.

### Blocking and pausing payments

- When a new account is captured, it is **blocked**: flagged in the database with the time and reason, and the "Accounts blocked" counter goes up. Every action is idempotent, so blocking twice changes nothing.
- Every payment goes through the **payee check** (`/api/payee-check`). If the account is blocked, the payment is saved as paused, "Payments paused" and "Value protected" go up, and the customer sees when the account was reported and which campaign it belongs to.
- Payment-time interrupt: if the customer starts a payment to a new payee while on a phone call, the app first asks whether someone on the phone told them to make it.

### Automation with n8n

After each capture, the app sends an event to n8n, which carries out the response by calling back into the app:

| Workflow | Triggered when | What it does |
|---|---|---|
| `intel-received` | New details are captured | Blocks accounts, adds numbers and links to watch lists, links the campaign, alerts `#fraud-ops` |
| `session-ended` | The Decoy call ends | Has the app write the fraud report with Claude, saves it, posts the link |
| `canary-tripped` | The decoy card or login is used | Records the alert, adds the device and location to the watch list, alerts `#fraud-ops` |
| `trusted-contact` | A payment is paused | Messages the trusted contact with the `/ally` link, records it |

The app waits at most 4 seconds for n8n. If n8n is off or unreachable, the app runs the same steps itself and notes "Automation offline, handled directly", so the demo never stalls. Requests in both directions carry the `x-decoy-secret` header.

### The Decoy voice line

An ElevenLabs agent, "Decoy - David", plays a 46-year-old son who looks after his mum's banking. Its prompt (`agents/decoy-david.md`) gives it these goals, in order: get the caller's name and a callback number, get the full account details read slowly (reading one digit back wrong so they repeat it), get any links, find out how much and why. Then it stalls: lost glasses, a slow app, a pen that does not work, the doorbell. It never agrees to send money, never accuses the caller, and never says it is not a person. It only ever reads out the decoy details the bank controls, passed in as dynamic variables.

The browser asks the server for a short-lived conversation token, so the API key never reaches the browser, and the agent only accepts authenticated sessions.

## Features

**Core**
- Call check with certain answers (not NatWest, or genuine with a code)
- Pass-to-Decoy flow in three steps, then a live screen with a timer and captured-details count
- Live voice decoy (ElevenLabs) with the caller console, ring, level meter and hold-to-talk
- Live transcript on the dashboard, with captured details highlighted in the text
- Two-layer detail capture (instant pattern match plus Claude)
- Matching to earlier reports, campaign linking and a live connections graph
- Automatic account blocking and payment pausing
- Fraud Operations dashboard with counters that count up as they change
- n8n workflows with a built-in fallback

**Extended**
- Fraud report per call, written by Claude (or from a template), viewable and printable
- Decoy details tripwire: a stolen card or login attempt raises an alert with simulated device and location
- Genuine-call path with a four-digit call code
- Payment-time interrupt while on a call
- Trusted contact who can stop or allow a paused payment
- Coaching check ("NatWest Protect"): four questions, by voice or as a form, assessed for signs that the customer is being coached
- Real phone number for the Decoy line through a Twilio number on the ElevenLabs agent (calls appear when they end)
- Crypto wallet trace view (simulated and labelled as demonstration data)

**Demo tools**
- Hidden demo panel on `/ops` (press `D`): reset, start a customer call, "NatWest is calling" switch, replay at 1x or 2x
- Replay mode: a scripted call fed through exactly the same pipeline as a live call
- Practice mode on `/caller` when no voice line is set up: type the caller's lines
- Long-press the time on the phone to start a customer call

## Tech stack

| Area | Choice |
|---|---|
| Web app | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, Source Serif 4, Inter and JetBrains Mono, lucide-react icons |
| Database and realtime | Supabase Postgres + Realtime, or an in-memory store with Server-Sent Events for local preview |
| Voice | ElevenLabs Agents (`@elevenlabs/react`, WebRTC) |
| Language understanding | Claude through the Anthropic SDK (tool use with strict schemas) |
| Automation | n8n |
| Graph | react-force-graph-2d |
| Validation | zod |
| Tests | Vitest |
| Hosting | Vercel |

## Run it locally (no accounts needed)

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no environment variables, the app uses an in-memory store loaded with the seed data (30 earlier calls in 4 campaigns), and Server-Sent Events stand in for Supabase Realtime. Restarting the server resets the data.

Without a voice line, either:
- open `/ops`, press `D`, then **Run replay**, or
- use practice mode: start a customer call, pass it from `/app`, then on `/caller` press **Connect typed line** and type the caller's lines.

## Connect the real services

Copy `.env.example` to `.env.local` (and to Vercel for a deployment). Every service is optional and falls back on its own.

1. **Supabase.** Run `supabase/schema.sql`, then `supabase/seed.sql` in the SQL editor. `seed.sql` is generated from `src/lib/seed.ts` with `npm run gen:seed`. Setting the three Supabase variables switches the app from the in-memory store to Supabase. Required for a Vercel deployment, because the in-memory store only works on a single server.
2. **Claude.** Set `ANTHROPIC_API_KEY`. `ANTHROPIC_MODEL` defaults to `claude-sonnet-5-5`.
3. **ElevenLabs.** Set `ELEVENLABS_API_KEY` (the key needs "ElevenLabs Agents: Write" and "Voices: Read"), then run `npm run setup:voice`. This creates the "Decoy - David" agent from `agents/decoy-david.md` and saves its id as `ELEVENLABS_DECOY_AGENT_ID`. Running it again updates the same agent. Calls are capped at 5 minutes while testing; use `DECOY_MAX_SECONDS=900 npm run setup:voice` for the demo. For the coaching check by voice, create the agent in `agents/protect-check.md` and set `ELEVENLABS_PROTECT_AGENT_ID`.
4. **n8n on a laptop.** Install n8n in its own folder (`npm install n8n`), import the four workflows in `n8n/` with `n8n import:workflow`, publish them with `n8n publish:workflow`, and start it on port 5678. Fill in each workflow's **Config** node and set the webhook URLs, `N8N_SHARED_SECRET` and `N8N_ENABLED=true` in `.env.local`.
5. **n8n Cloud.** Import the four files in `n8n/`. In each, fill in the **Config** node (app URL, shared secret, and optionally a Discord or Slack webhook; chat steps are skipped when it is empty), set the Header Auth credential on the webhook (`x-decoy-secret`), activate it, and put the production webhook URLs in the environment. Use the Vercel production URL as the app URL; preview URLs sit behind a login.
6. **Phone number (optional).** Connect a Twilio number to the agent in ElevenLabs and set its post-call webhook to `https://<your app>/api/voice/phone-webhook`, with the webhook secret in `ELEVENLABS_WEBHOOK_SECRET`.

## Demo guide

**Devices**

| Device | Page | Notes |
|---|---|---|
| Laptop on the projector | `/ops` | Full screen |
| Laptop with headset | `/caller` | Use Chrome. Press **Arm line** before starting. Tick **Hold space to talk** in a noisy room |
| Phone | `/app` | Add to the home screen so it opens full screen |

**Checklist**

1. On `/ops`, press `D`, then **Reset demo**. Counters: 30 calls, 3 h 25 min, 6 blocked, 4 paused, £18,450.
2. On `/caller`, press **Arm line**.
3. Press **Start customer call** (or long-press the time on the phone). The phone shows the call banner.
4. On the phone: **Check this call**, then **Pass this call to Decoy**, then **Call Decoy**. The caller console rings and connects.
5. The caller follows the role card. The number links to 3 earlier reports and the account is blocked within seconds.
6. The caller says "Forget it" and presses **End call**. The phone shows the summary.
7. On the phone, pay £2,000 to 20-45-77 63849120. The payment is paused. Counters: 5 paused, £20,450.

If the voice line does not connect within 8 seconds, the demo panel opens with **Switch to replay** and the story carries on.

## Project structure

```
agents/            ElevenLabs agent prompts and settings
n8n/               The four n8n workflows, ready to import
public/replay/     Replay script
scripts/           Seed SQL generator, ElevenLabs agent setup
supabase/          schema.sql, seed.sql
src/app/
  app/             Mock banking app (phone)
  caller/          Caller console
  ops/             Fraud Operations dashboard, reports, wallet trace, demo actions
  ally/            Trusted contact
  api/             All API routes
src/components/    UI, app, ops components
src/lib/
  actions.ts       Business actions (block, link campaign, timeline, counters, reports)
  pipeline.ts      Session states, transcript intake, capture, call end, payee check
  capture/         Pattern matcher, Claude capture, matching (merge.ts)
  db/              Data layer: Supabase or in-memory
  n8n.ts           Send to n8n, or run the same steps inline
  report.ts        Fraud report
  coaching.ts      Coaching check
  normalise.ts     Standard forms for accounts, phones, links, wallets, names
  seed.ts          Seed data (also used to generate seed.sql)
  copy.ts          All user-facing text
tests/             Unit tests
```

## Environment variables

| Name | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase. All three switch the app from the in-memory store |
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | Claude for capture, reports and the coaching check |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_DECOY_AGENT_ID` | The Decoy voice line |
| `ELEVENLABS_PROTECT_AGENT_ID` | Coaching check by voice (optional) |
| `ELEVENLABS_WEBHOOK_SECRET` | Verifies the phone-call webhook (optional) |
| `N8N_ENABLED`, `N8N_WEBHOOK_*_URL`, `N8N_SHARED_SECRET` | n8n automation |
| `APP_BASE_URL` | The app's address, used in links sent by n8n |
| `DEMO_SESSION_ID` | The shared session id (`demo`) |

Never commit `.env.local`. When `N8N_SHARED_SECRET` is set, the n8n callbacks and the demo reset route require it.

## Tests

```bash
npm test
```

Unit tests cover the pattern matcher (digits, spoken numbers, numbers split across lines, phone formats, links said with "dot", caller names, amounts that must be ignored) and normalisation.

## Limits and honest notes

- **It is a simulation.** "Blocked" is a flag in Decoy's own database, enforced by the app's payee check. A real bank would enforce it inside its payment systems.
- **Blocking is automatic.** In a real deployment, a fraud officer would confirm before any longer action, and account holders could appeal.
- **Matching is exact.** One misheard digit means no match. Campaigns come from the seed data; new operations are not grouped into new campaigns yet.
- **Phone-number calls** reach the dashboard when they end, not word by word.
- **Free ElevenLabs credits** cover only a few minutes of live voice. Use replay for most rehearsals.
- **Choices that differ from the original plan:** a local in-memory mode; Claude requests use automatic tool choice with strict schemas because current models reject forced tool choice and temperature; the pattern matcher also handles spoken tens and caller names; hold-to-talk on the caller console; extra schema fields (`decoy_requested_at`, `calls.extraction`, `call_entities.confirmed`, `coaching_checks`, `bump_counters()`).

## Safety and ethics

- Opt-in only. The customer chooses to pass the call, and hanging up is always an equal option.
- No real criminals are contacted. In the demo, the criminal is a teammate.
- Decoy only gives out decoy details the bank controls, and never invents other personal details.
- No voice cloning: a stock voice and a fictional name.
- No real personal data. Phone numbers come from Ofcom's ranges reserved for drama, links use the reserved `.example` domain, wallets contain `DEMO`, and accounts are invented.
- Not affiliated with NatWest. No NatWest logos or assets; every page says so.
