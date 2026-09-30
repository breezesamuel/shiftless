# Launch Playbook — Shiftless

The site is live and the funnel is measured. The remaining bottleneck is
distribution, and distribution needs distribution *assets*. Everything below is
ready to paste; nothing here requires a decision from anyone.

**Status of each channel, honestly:**

| Channel | Blocked by | Who unblocks |
|---|---|---|
| Google indexing | No Search Console property (needs DNS TXT) | **User** — 5 min, one-time |
| Embed outreach | Nothing — sendable today | Me, with a sending domain |
| Product Hunt | Account | **User** — one-time signup |
| Reddit | Account + subreddit karma | **User**, then me |
| Directories | Most need accounts | Mixed |

That is the honest picture: **the site's remaining growth is gated on 3 human
account actions, not on engineering.** I would rather say that plainly than
keep building features that don't move the number.

---

## 1. Search Console (5 min, user — highest value)

Without this we cannot submit a sitemap, and we cannot see whether anything
ranks. Everything downstream of "is anyone finding us" depends on it.

1. `search.google.com/search-console` → add property → **URL prefix** →
   `https://shiftless.vercel.app/`
2. Verify by **DNS TXT** (not the file method — the file method breaks on every
   redeploy).
3. Add the TXT record. I can add the record if DNS for a Vercel-managed domain is
   ever given access; currently it is not.
4. Sitemaps → submit `https://shiftless.vercel.app/sitemap.xml`

**What to expect afterwards:** 3–14 days to crawl, 2–8 weeks to rank for
long-tail terms, 3–6 months to rank for "support headcount calculator". Anyone
promising faster is selling something.

## 2. Embed outreach (me, sendable today)

Target list and pitch are in `embed-program.md`. Realistic yield: **5–15 embeds
from 30–60 hand-written messages.** Each embed is a permanent link from a live
client document.

Priority order — do not spray:
1. Fractional CX leaders (~200 exist) — they bill on headcount savings
2. Support-automation consultants (~300) — sizing is step 1 of every engagement
3. Fractional COO firms (~400) — support is a line item in ops decks

**Never ask for a link. Ask for an embed.**

## 3. Product Hunt (user signs up once, then it's repeatable)

Ready-to-paste copy:

> **Shiftless — Support Headcount & Automation ROI Calculator**
>
> We built the sizing tool we wanted to exist: how many support agents do you
> actually need, what does that cost, and is AI automation worth buying at your
> volume?
>
> It will tell you not to buy. Below ~400 tickets/month the answer is "not worth
> it" and that's what it says. Every constant behind it is published, so if
> anyone challenges the number in a budget meeting you can point at the formulas.
>
> Free, no signup, inputs never leave your browser.
>
> https://shiftless.vercel.app

Tagline options:
- "Sizing that tells you when not to buy"
- "The support calculator that says no"

Launch as a **maker comment reply** to the first person who questions the
deflection ceiling. Someone always does, and the honest answer is the whole
differentiator.

## 4. Reddit / communities (user account, then me drafts)

The rule that makes this work: **never link-drop.** Post the finding, put the
link in the reply to the first person who asks for the tool.

- `r/ecommerce`, `r/shopify`, `r/Entrepreneur` — sizing threads
- `r/customer_success`, `r/support` — industry professionals
- CX Discord servers — smaller, higher-intent, better than Reddit
- `r/webdev` / indie communities — "built a calculator that argues with me" is
  a story, not an ad

**Do not** post to 15 subs on day one. One good thread in `r/ecommerce` is worth
more than fifteen drive-by posts, and drive-bys are how accounts get banned.

## 5. Directories (me, low priority)

Only worth it if the tool is genuinely useful to that audience. Most
"submit your SaaS" directories are link farms and a manual audit will discard
them. The only two worth doing:

- **AlternativeTo** — real users search here by category
- **Peerlist Launchpad** — free, indexed, and lets you collect upvotes

## 6. The measurement loop (built, use it)

`/api/event` logs first-party cookleless events. After ~2 weeks the question
"is this compounding" gets a real answer from `[EV]` lines:

- `embed_load` — how many embeds are live
- `result_view` with `monthly_tickets` — which volume band actually shows up
- `verdict_strong` / `verdict_not_worth_it` split — whether the buying
  population is even present
- `lead_submit` — where the funnel leaks

**The decision this drives:** if 80% of traffic is <2,000 tickets/month, the
model says "do not buy" to almost all of them, and the product direction should
change to the volume band that is actually visiting. That is why events carry
numbers rather than labels.

## What is NOT in this playbook, and why

- **Paid ads.** Zero budget, and unproven unit economics. Would convert
  "no revenue" into "no revenue plus a bill."
- **Cold email to support teams.** Prior rounds sent 11 such emails: 0 replies.
  Same motion, same result. The embed motion is different — it offers them
  something, which is why it is worth trying.
- **A second tool.** One excellent tool that ranks beats eight that don't.
  Adding surface area now would repeat the 508-pages mistake.
