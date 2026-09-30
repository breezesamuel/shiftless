/**
 * Single source of truth for FAQ copy.
 *
 * Deliberately NOT in a "use client" module: page.tsx is a server component and
 * cannot map() over a client reference. Both the visible FAQ block and the
 * FAQPage JSON-LD import from here so the schema can never drift from the copy
 * a human reads — a schema describing different questions than the page shows is
 * a manual-action risk, not just a wasted opportunity.
 */
export const FAQ = [
  {
    q: "How do you calculate support headcount?",
    a: "Divide daily tickets by the number one agent can handle per shift, then multiply by the shifts needed to cover your service hours. We use 5.5 productive hours per 8-hour shift after breaks, meetings, training and idle time, and 4.6 shifts per full-time agent to cover 7 days.",
  },
  {
    q: "What is a realistic automation coverage number?",
    a: "For e-commerce support, 50-62% of tickets are typically repetitive enough to resolve without a human. Higher claims usually come from a pilot period that excluded escalations. We cap the model at the realistic ceiling for your industry rather than letting you enter 90% and get a fantasy number.",
  },
  {
    q: "What is a good tickets-per-agent benchmark?",
    a: "It depends almost entirely on handle time. At 7 minutes average handle time an agent clears about 47 tickets a shift. At 18 minutes, about 18. This is why the calculator reports a range across your industry's handle-time distribution instead of a single number.",
  },
  {
    q: "Is AI customer support worth it for a small team?",
    a: "Below roughly 400 tickets a month, usually not. A good help centre plus a founder answering tickets is cheaper. The calculator says this directly, and we would rather show you the honest answer than sell you a platform that does not pay back.",
  },
  {
    q: "What counts as a fully loaded agent cost?",
    a: "Wages, benefits, employer taxes, supervision overhead, seat licences, and recruiting and training amortised per agent. Using the bare hourly wage is the most common way teams understate support cost and then cancel their automation project in month three.",
  },
  {
    q: "How much does one support ticket actually cost?",
    a: "At a loaded cost of $26 per agent hour, a 7-minute e-commerce ticket costs about $4.43 and an 18-minute SaaS ticket about $11.56. The number that matters is cost per ticket multiplied by tickets per resolved problem, which is where automation pays off by cutting repeat contacts.",
  },
  {
    q: "Does this calculator need me to sign up?",
    a: "No. There is no account, no login, and your inputs are computed in your own browser and never sent to us. Only numbers are logged, so that we can tell which volume band and industry is most useful to build for.",
  },
];
