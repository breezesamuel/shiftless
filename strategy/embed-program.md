# Embed Program — the backlink engine

## The problem this solves

This site has no brand, no customers, no PR budget, and zero Domain Rating.
Content marketing cannot fix that from zero: you need links *first*.

The previous 13 rounds produced 508 pages and zero traffic. The failure was not
volume, it was that **directory pages are not embeddable**. Nothing can be
dropped into someone else's document, so nothing earns a link.

## The mechanism

Support consultants, CX agencies and fractional heads of support put **sizing
calculators into client proposals and QBR decks** — routinely, because the
number "you need 4 agents, that's $198k loaded" is the single most persuasive
slide in a support business case.

Every such document is a link from a live, topically relevant domain. That is
the only durable link channel available to a new site.

## What we give them

```html
<iframe
  src="https://shiftless.vercel.app/embed"
  width="100%"
  height="620"
  frameborder="0"
  title="Support headcount and automation ROI calculator"
  loading="lazy">
</iframe>
```

- Same numbers as the main tool — it is the same `model.ts`, so an embed can
  never embarrass the person who placed it.
- No cookies, no email, no lead capture, nothing identifying. Safe inside a
  client-facing document.
- **Attribution is permanent and non-removable.** If it can be stripped there
  is no reason to keep it.

## Who to contact

Ranked by expected link value, not by volume:

| Segment | Why they embed | How many | Effort |
|---|---|---|---|
| Fractional CX leaders | Bill on headcount savings; need the sizing number | ~200 | Low, highest value |
| Support-automation consultants | Sizing is step 1 of every engagement | ~300 | Low |
| Fractional COO / ops firms | Support is line item in ops decks | ~400 | Low |
| Shopify apps with CX features | "How many agents do I need" is a natural doc section | ~50 | Medium |
| Ecom ops communities (Reddit, Discord) | Self-serve embeddable tool posts well | — | Very low |

## The pitch (short — the tool is the pitch)

> Hi — we built a support headcount + automation ROI calculator at
> https://shiftless.vercel.app. It's free, no signup, and it will tell you not to
> buy automation if your volume doesn't justify it, which is probably why you
> haven't seen it before.
>
> If you put sizing in client proposals, you can embed it directly:
>
> ```html
> <iframe src="https://shiftless.vercel.app/embed" width="100%" height="620"
>         frameborder="0" title="Support headcount and automation ROI calculator"></iframe>
> ```
>
> The methodology page is public, so if anyone challenges the numbers in a
> client room you can point at the formulas. Happy to white-label the colours.

**Never** ask for a link. Ask for an embed. An embed is a feature request; a
link request is spam, and the one time people tolerate a link request is when
they are already a customer.

## Honest expectation

- Realistic yield in month 1: **5–15 embeds**, from ~30–60 hand-written
  outreach messages.
- This is not a volume play. Twenty embeds from real consultants is worth more
  than 5,000 links from a link farm, and it is the only version that survives a
  manual audit.
- Compounding: each embed is a permanent, self-refreshing link from a live
  document. A blog post decays; a slide in a recurring QBR deck does not.

## Tracking

Embeds emit an `embed_load` event to `/api/event` with a rotating visitor
bucket. There is no referrer capture beyond what the browser sends by default.
Once embeds exist, `/api/event` counts are the only honest answer to "is the
funnel working" — self-reported traffic from a launch spike is not.
