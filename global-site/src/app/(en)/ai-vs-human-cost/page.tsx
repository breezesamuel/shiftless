import { compute, CHANNELS, DEFAULTS, loadedCostPerAgent, ticketsPerAgentMonth, type Channel } from "@/lib/model";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI vs Human Customer Service Cost — The Real Comparison",
  description:
    "What AI customer service actually costs versus an agent, including the part vendors omit: supervision, escalation handling and the repeat contacts that remain. With a calculator.",
  alternates: { canonical: "/ai-vs-human-cost" },
};

/**
 * This is the highest commercial-intent query in the space: people searching it
 * are usually mid-evaluation with budget. It is also the page most likely to
 * lose trust, because the honest answer is uncomfortable — AI is cheaper per
 * ticket than a human for a minority of volumes, and more expensive for the rest.
 *
 * All figures below are computed from the same model as the calculator.
 */

const VOLUMES = [500, 1000, 2000, 5000, 10000, 25000, 50000, 100000];

type Row = {
  tickets: number;
  agents: string;
  humanCostPerTicket: number;
  aiCostPerTicket: number;
  ratio: number | null;
  absoluteSaving: number;
  verdict: string;
};

const rows: Row[] = VOLUMES.map((tickets) => {
  const o = compute({ ...DEFAULTS, monthlyTickets: tickets });
  // Human cost per remaining ticket after deflection: total labor / total tickets.
  const humanCostPerTicket = o.monthlyLaborCost / tickets;
  const aiCostPerTicket =
    o.automatedTickets > 0 ? o.monthlyPlatformCost / o.automatedTickets : 0;
  return {
    tickets,
    agents: `${o.agentsRange[0]}-${o.agentsRange[1]}`,
    humanCostPerTicket,
    aiCostPerTicket,
    ratio: aiCostPerTicket > 0 ? aiCostPerTicket / humanCostPerTicket : null,
    absoluteSaving: o.monthlyNetEffect,
    verdict: o.verdict,
  };
});

const VERDICT_LABEL: Record<string, string> = {
  strong: "Automation pays for itself",
  workable: "Workable",
  marginal: "Marginal",
  "not-worth-it": "Do not buy",
};

export default function AiVsHumanCost() {
  const midEcom = (CHANNELS.ecommerce.ahtP25 + CHANNELS.ecommerce.ahtP75) / 2;

  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
        AI vs human customer service cost
      </h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        The vendor comparison usually shows you the price of a platform against the
        price of a seat and stops there. That is the least interesting part of the
        arithmetic. Below is the full cost, including the two line items that
        decide most of these deals and almost never appear in the pitch.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-900">
        The comparison nobody shows you
      </h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5">
          <h3 className="font-semibold text-rose-900">What AI does not remove</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-rose-800">
            <li>• <b>Supervision.</b> Someone still reviews escalations, tunes intent coverage and handles the tickets the model gets wrong.</li>
            <li>• <b>The residual queue.</b> At 50% deflection you still need humans for the other half — the half that is hardest.</li>
            <li>• <b>Repeat contacts.</b> A confident wrong answer generates a second ticket. One badly automated answer can cost two human touches.</li>
            <li>• <b>Knowledge debt.</b> Automation only knows what is written down. If your FAQs live in three heads, it automates nothing.</li>
          </ul>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <h3 className="font-semibold text-emerald-900">What it genuinely does</h3>
          <ul className="mt-2 space-y-1.5 text-sm text-emerald-800">
            <li>• <b>Kills the queue, not the work.</b> Median first-response time collapses even when headcount is unchanged.</li>
            <li>• <b>Absorbs the 2am ticket.</b> Out-of-hours coverage you were paying premium for is nearly free.</li>
            <li>• <b>Handles the boring 60%.</b> Order status, password resets, refund status — the tickets that consume senior agents.</li>
            <li>• <b>Scaling is linear in cost.</b> 10x volume does not mean 10x headcount if coverage caps out.</li>
          </ul>
        </div>
      </div>

      <h2 className="mt-12 text-xl font-semibold text-slate-900">
        Cost per ticket, by volume
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        E-commerce, {midEcom.toFixed(1)} min average handle time, ${DEFAULTS.loadedCostPerHour}/hour
        fully loaded, 50% automation coverage at ${DEFAULTS.costPerResolution} per resolution.
        &ldquo;AI cost per ticket&rdquo; is the platform fee spread over the tickets it
        actually resolved — the number that matters, not the list price.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-300 text-left">
              <th className="py-2 pr-4 font-semibold">Tickets / mo</th>
              <th className="py-2 pr-4 font-semibold">Agents</th>
              <th className="py-2 pr-4 font-semibold">Human / ticket</th>
              <th className="py-2 pr-4 font-semibold">AI / ticket</th>
              <th className="py-2 pr-4 font-semibold">AI ÷ Human</th>
              <th className="py-2 pr-4 font-semibold">Absolute $ / mo</th>
              <th className="py-2 font-semibold">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.tickets} className="border-b border-slate-200">
                <td className="py-2 pr-4 font-mono">{r.tickets.toLocaleString()}</td>
                <td className="py-2 pr-4 font-mono">{r.agents}</td>
                <td className="py-2 pr-4 font-mono">${r.humanCostPerTicket.toFixed(2)}</td>
                <td className="py-2 pr-4 font-mono">
                  {r.aiCostPerTicket > 0 ? `$${r.aiCostPerTicket.toFixed(2)}` : "—"}
                </td>
                <td
                  className={`py-2 pr-4 font-mono font-semibold ${
                    r.ratio === null
                      ? ""
                      : r.ratio < 1
                      ? "text-emerald-700"
                      : "text-rose-700"
                  }`}
                >
                  {r.ratio === null ? "—" : r.ratio.toFixed(2) + "x"}
                </td>
                <td
                  className={`py-2 pr-4 font-mono font-semibold ${
                    r.absoluteSaving > 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {r.absoluteSaving > 0 ? "+" : ""}
                  {fmt(r.absoluteSaving)}
                </td>
                <td className="py-2">{VERDICT_LABEL[r.verdict]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-5 rounded-xl border border-slate-300 bg-slate-100 p-5">
        <p className="text-sm leading-relaxed text-slate-700">
          <b>The result that surprises people.</b> Read the two middle columns
          together and the ratio gets <i>worse</i> as you scale — from{" "}
          {rows[0].ratio?.toFixed(2)}x to {rows[rows.length - 1].ratio?.toFixed(2)}x. AI
          does not become relatively cheaper with volume. It becomes relatively{" "}
          <i>less</i> advantageous.
        </p>
        <p className="mt-2.5 text-sm leading-relaxed text-slate-700">
          The reason is the human column. Cost per human-handled ticket falls as
          volume rises — ${rows[0].humanCostPerTicket.toFixed(2)} at{" "}
          {rows[0].tickets.toLocaleString()} tickets/month, because at that size your
          one agent is idle a lot of the time, down to{" "}
          ${rows[rows.length - 1].humanCostPerTicket.toFixed(2)} at{" "}
          {rows[rows.length - 1].tickets.toLocaleString()}, where agents are fully
          utilised. AI priced per resolution stays flat at{" "}
          ${rows[0].aiCostPerTicket.toFixed(2)}. Scale improves your{" "}
          <i>human</i> efficiency faster than it improves your <i>automated</i> one.
        </p>
        <p className="mt-2.5 text-sm leading-relaxed text-slate-700">
          <b>So decide on absolute dollars, never on the ratio.</b> The ratio narrows
          while the absolute number swings from {fmt(rows[0].absoluteSaving)}/month to{" "}
          {fmt(rows[rows.length - 1].absoluteSaving)}/month. A buyer who negotiates on
          &ldquo;cost per ticket is 4x cheaper!&rdquo; is optimising the one column that
          gets worse for them, and will be disappointed by month three.
        </p>
        <p className="mt-2.5 text-sm leading-relaxed text-slate-700">
          The cliff at the low end is real though, and it is a cliff rather than a
          curve: below roughly{" "}
          <b>1,500–2,000 tickets a month</b> there is no headcount to remove, so a
          per-resolution fee buys you nothing at all.
        </p>
      </div>

      <h2 className="mt-12 text-xl font-semibold text-slate-900">
        The four numbers to get right before you sign anything
      </h2>
      <ol className="mt-4 space-y-3 text-slate-700">
        <li>
          <b>1. Your real average handle time, measured over two weeks.</b> Not
          estimated, not from a survey. At {CHANNELS.ecommerce.ahtP25} vs{" "}
          {CHANNELS.ecommerce.ahtP75} minutes, your agent clears{" "}
          {ticketsPerAgentMonth(CHANNELS.ecommerce.ahtP25).toLocaleString()} vs{" "}
          {ticketsPerAgentMonth(CHANNELS.ecommerce.ahtP75).toLocaleString()} tickets a
          month. That is a {Math.round(loadedCostPerAgent(26) / ticketsPerAgentMonth(CHANNELS.ecommerce.ahtP75))}
          {" "}vs ${" "}
          {Math.round(loadedCostPerAgent(26) / ticketsPerAgentMonth(CHANNELS.ecommerce.ahtP25))}{" "}
          difference in cost per ticket before you buy anything.
        </li>
        <li>
          <b>2. Your deflection ceiling, not your ambition.</b>{" "}
          {Object.values(CHANNELS).map((c) => c.deflectable).reduce((a, b) => Math.min(a, b)) * 100}%–62%
          depending on mix. If a pilot reports 80%, ask what was excluded.
        </li>
        <li>
          <b>3. Whether the saving is actually cashed.</b> Headcount is inelastic.
          Savings accrue as people leave, over 12–18 months, not the week you switch
          it on. Model the ramp.
        </li>
        <li>
          <b>4. What happens at 30% lower volume.</b> Every table on this page assumes
          volume is flat. If it is not, your payback months are the number that
          matters and it is the one every vendor skips.
        </li>
      </ol>

      <div className="mt-10 rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-700">
          Run your own numbers on the{" "}
          <a href="/" className="font-medium underline">calculator</a> — it will show you
          the same cliff, or tell you not to buy at all.
        </p>
      </div>
    </div>
  );
}

function fmt(n: number): string {
  return (n < 0 ? "-$" : "$") + Math.abs(Math.round(n)).toLocaleString("en-US");
}
