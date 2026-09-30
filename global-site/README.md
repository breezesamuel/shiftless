# Shiftless — Support Headcount & Automation ROI Calculator

Live: **https://shiftless.vercel.app**

A free, no-signup calculator that tells an e-commerce / SaaS / marketplace support
team how many agents it actually needs, what that costs, and — honestly — whether
AI support automation is worth buying at their volume.

## Pages

| Path | Purpose |
|---|---|
| `/` | The tool. The whole funnel. |
| `/ai-vs-human-cost` | Highest commercial-intent query: AI vs agent unit cost, with the absolute-dollar column that actually decides the deal |
| `/benchmarks` | Citable tables: tickets/agent/day by AHT, cost per ticket by industry, automation payback thresholds |
| `/methodology` | Every constant and formula, public |
| `/embed` | Embeddable variant for client proposals. Not indexed. |
| `/privacy` | What is and is not collected |
| `/api/lead` | Lead capture, edge runtime |
| `/api/event` | First-party cookleless analytics, edge runtime |

## GEO audit product (CN-market, `/geo`)

Second revenue line: paid AI-readiness audits for Chinese B2B sites, the way
`F:\24\geo` measures them but packaged for money.

- `/geo` — landing + order form (¥1999 report / ¥4999 report+fix), not indexed
- `/geo/samples/jackyun`, `/geo/samples/sellersprite` — public one-page proofs
- `/api/geo-order` — server-side pricing, URL origin validation, in-memory IP
  throttle (6/h), order logged to console + optional `ORDER_WEBHOOK_URL`,
  returns `manual:true` (no payment credential deployed)
- Fulfilment: `node full-report.js <url>` in `F:\24\geo` → markdown, emailed by
  hand within 48h. Scanning is NOT done inside the API handler: intake stays
  cheap; fake orders cannot burn the scanner.

Honesty rules carried from the main funnel: the landing page never promises a
"ranking" (sampling output is uncontrollable), and the order form does NOT claim
an email is sent — there is no mail provider. The buyer is told the order ID and
payment instruction up front, plus that they must send the transfer receipt.

## Why it exists

Thirteen prior rounds in this repo produced ¥0. The diagnosis was consistent:
every round reinforced the supply side (tooling, payment rails, deploys) while the
demand side stayed at zero. Nothing built in those rounds kept working after the
build stopped.

This is the one asset that does. A useful tool ranks, gets shared, and returns
visitors while nobody is watching.

## The three anti-sales design rules

The credibility of this project rests entirely on the tool being willing to
disagree with the visitor:

1. **It tells you not to buy.** Below ~400 tickets/month the verdict is
   `not-worth-it`.
2. **It caps your optimism.** Entering 90% automation coverage is clamped to the
   62% industry ceiling, with an explanation. Pilot-period numbers that exclude
   escalations are the most common way these projects disappoint.
3. **Every constant is published.** `/methodology` lists each number and formula so
   a sceptical reader can refute it. A calculator that hides its assumptions is a
   sales brochure.

## Commands

```bash
npm install
npm run dev            # dev server
npm run build          # static production build (13 routes)
npm start              # serve the build

npm test               # model + report + order-sanitiser suites
npm run typecheck      # tsc --noEmit

npx vercel --prod --yes --scope solmount
```

`--scope solmount` is not optional. Without it the CLI reports
`{"status":"error","message":"Not authorized"}` even though the token is valid
and `api.vercel.com/v2/user` returns 200 — the CLI just cannot resolve its own
default scope in this environment.

The test suites transpile and exercise the real `src/lib/model.ts` and
`src/lib/report.ts` directly, so they cannot drift from the shipped code.

- `test/verify.js` — model against industry benchmarks, cost/ticket, ranges, URL codec
- `test/report.js` — paid report sweeps, verdict honesty, price + input sanitiser
- `test/order-e2e.js` — boots a real server, probes `/api/order`, kills it

## The paid product

A free calculator cannot make money, so there is one thing worth paying for: the
analysis the calculator cannot do. `src/lib/report.ts` turns the same `Inputs`
into a five-section deliverable — current state, what automation changes,
sensitivity at -30%/flat/+50% volume, the break-even ticket count, a sequenced
90-day plan, and the risks that would reverse the decision.

Two pricing rules, both deliberate:

- **The server owns the price.** `/api/order` takes `{tier}` and looks the amount
  up in its own `PRICES` table. The client posting `amount: 0.01` changes
  nothing, and there is a test that asserts exactly that.
- **The upsell refuses to sell.** At 250 tickets/month the report renders
  `verdictTone: "bad"`, says the honest recommendation is to fix the knowledge
  base and keep the agent, and still gives the 90-day knowledge-base plan. The
  page tells the buyer to send the link to whoever is pressuring them. A tool
  that only ever agrees is a brochure.

There is no payment credential in this deployment, so `/api/order` returns
`manual: true` and an order reference rather than a fabricated `paymentUrl`.
Fulfilment at this volume is a person reading a log and replying. Claiming
automatic checkout without a processor is how you 500 a paying customer at the
worst possible moment.

Access control on `/report` is honest about what it is: the report is generated
client-side from the query string, so the permalink is the *content*, not a DRM
boundary. Enforcing payment needs an order database, which does not pay for
itself at five sales a month. The gate is operational, not technical.

## Model notes

`src/lib/model.ts` is the single source of truth. Three lessons are encoded in it
after v1 was tested and rejected:

- **Do not double-count coverage.** Crew depth comes from
  `coverageHours / 5.5 productive hours`; the 4.6 shifts-per-FTE constant is only
  used to turn an hourly rate into a monthly cost. Applying both inflated headcount
  ~2x.
- **Headcount is not elastic.** Nobody cuts 20 agents the week automation ships.
  Savings phase in over `reductionMonths` via attrition, with severance modelled
  as a separate one-off cost.
- **Price automation per resolution, not per seat.** Intercom Fin, Gorgias and
  Zendesk bill per automated resolution ($0.55–$1.20). A flat monthly fee produced
  a 26x year-1 return — an obviously fake number that gets the whole tool
  discounted to zero.

## Shareable permalinks

Every scenario encodes to a URL: `?v=1&c=saas&t=7200&a=11&r=33&h=12&d=45&p=0.85&s=2500&m=18&l=0`.
"Copy link to this scenario" writes it to the address bar *and* the clipboard, and
a visitor arriving on one gets their exact inputs restored with a "loaded from a
shared link" banner and a reset control.

This is the growth loop, and it is why `reductionMonths` and `layoffNow` are
serialized too — they change the result, and a permalink that renders a
*different* answer than the sharer saw is worse than no permalink.

`decodeState()` clamps every parameter to the same bounds the sliders enforce and
drops anything unparseable. URL params are attacker-controlled input that drives
arithmetic which reaches DOM text, so they are treated as hostile by default.
Regression-tested against `?t=NaN&a=99999&r=-50&h=abc&c=../../etc/passwd&d=99999&p=1e308&s=-1`.

## Data collection

The calculator sends nothing. All computation happens in the visitor's browser.

`POST /api/lead` is same-origin by design. Prior rounds used `formsubmit.co`, which
is blocked from Vercel's egress — the forms existed but silently never delivered.
Leads are written to stdout as `[LEAD]` lines and optionally forwarded to
`LEAD_WEBHOOK_URL`. The payload includes the computed result, not just the email,
because knowing *which* volume band and industry converts tells us what to build next.

`POST /api/event` is first-party and cookleless — no cookies, no session id, no
third-party analytics, and string event properties are rejected so an email
address cannot be attached to an event. The visitor field is a hash bucket salted
daily, so unique-visitor counts are possible without storing an identifier. This
was built in-house specifically so `/privacy` could keep promising no third-party
tracking scripts; adding Vercel Analytics would have quietly made that page a lie.

No payment or bank details are stored or rendered by this project.

## Structure

```
src/app/page.tsx                 landing + tool (the funnel)
src/app/ai-vs-human-cost/        commercial-intent comparison page
src/app/benchmarks/              citable benchmark tables
src/app/methodology/             every constant and formula, public
src/app/embed/                   embeddable variant, noindex
src/app/opengraph-image.tsx      1200x630 share image
src/app/privacy/                 what is and is not collected
src/app/api/lead/                lead capture, edge runtime
src/app/api/event/               cookleless analytics, edge runtime
src/lib/model.ts                 the ONLY source of ROI/headcount math
src/lib/faq.ts                   FAQ copy, shared by page and JSON-LD
src/lib/track.ts                 fire-and-forget event sender
src/components/Calculator.tsx
src/components/EmbedCalculator.tsx
src/components/LeadGate.tsx
src/components/StructuredData.tsx
src/components/Upsell.tsx            paid offer + checkout UI
src/components/ReportClient.tsx      client-rendered deliverable
src/lib/report.ts                    paid report generator
src/app/api/order/route.ts           order intake (server owns the price)
src/app/report/page.tsx              the deliverable, noindex
test/verify.js                   regression checks against industry benchmarks
test/report.js                   report sweeps, verdict honesty, price sanitiser
test/order-e2e.js                live server probe of /api/order
```

## Three bugs the tests caught

Worth recording, because each would have shipped:

1. **Coverage double-counted** — shifts-per-FTE and coverage-hours both applied.
   5,000 tickets/month showed 6 agents; correct answer is 3. A 2x overstatement.
2. **Flat monthly platform fee** — produced 26x and 104x year-1 returns. Real
   platforms bill per resolution. An obviously fake number gets the whole tool
   discounted to zero.
3. **Cost-per-ticket off ~3x** — capacity used `× 30 / 4.33` while labor used
   `× SHIFTS_PER_FTE × 4.33`, publishing $17.55 per e-commerce ticket against a
   real ~$4.43. `ticketsPerAgentMonth()` now pairs the two divisors so they
   cannot diverge.

Plus one caught in the served HTML: the JSON-LD was originally a client component
using `next/script`, which rendered **nothing** into the document. Crawlers do not
execute JS, so the schema was worth zero. It is now a server component emitting a
raw `<script>`.

## Four more, found while building the paid product

4. **`?m=0` published `Infinity` as your monthly saving.** The phase-in divides by
   `reductionMonths`, so zero divided by zero, and the live free tool rendered
   "Infinity" for anyone who appended one parameter to a permalink. Semantically
   the input is meaningless — even an immediate cut only avoids payroll from the
   first *full* month — so `compute()` now floors the phase-in at 1.
5. **`encodeState()` threw on a partial object** (`costPerResolution.toFixed` on
   `undefined`), which meant `/api/order` returned 500 for the most ordinary
   request a client can send: a body with one field in it. Found because the
   sanitiser test passed a partial object and the whole suite died.
6. **`validInputs()` returned a `Partial<Inputs>`.** `decodeState` drops
   unparseable fields, so the result could have holes in it, and the report
   generator would have billed and rendered `undefined` for a paying customer.
   Now merged over `DEFAULTS`.
7. **The privacy page and the lead gate both promised an email we do not send.**
   There is no mail provider in this deployment. `/privacy` said "so we can send
   the benchmark report" and the lead gate said "Send it" — both now describe what
   actually happens, and the lead magnet was reframed to point at the genuinely
   free `/benchmarks` pages rather than implying a gated report.

The pattern worth keeping: the two worst bugs in this list were only reachable
through *untrusted or partial input*, and neither was visible by clicking around
the UI. Both arrived the moment a public POST endpoint was added.

---

Published by Shanghai Bingdashan Intelligent Technology Co., Ltd.
(上海丙大山智能科技有限公司), Shanghai.
