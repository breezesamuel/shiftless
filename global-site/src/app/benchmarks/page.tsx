import { compute, capacityPerShift, loadedCostPerAgent, ticketsPerAgentMonth, CHANNELS, DEFAULTS } from "@/lib/model";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support Cost & Productivity Benchmarks 2026 — Tables You Can Cite",
  description:
    "Tickets per agent per day, cost per support ticket, and automation payback thresholds by industry. Every figure computed from a published model, not estimated.",
  alternates: {
    canonical: "/benchmarks",
    languages: { en: "/benchmarks", "zh-CN": "/zh/benchmarks", "x-default": "/benchmarks" },
  },
};

/**
 * These tables are computed from src/lib/model.ts at build time, so they can
 * never drift from the calculator. A benchmark table that quietly disagrees with
 * the tool beside it is how a site loses a technical audience permanently.
 */

const AHTS = [4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 20, 25];
const RATE = 26;

const productivity = AHTS.map((aht) => ({
  aht,
  perShift: capacityPerShift(aht),
  perMonth: Math.round(ticketsPerAgentMonth(aht)),
}));

const COST_PER_TICKET = (Object.keys(CHANNELS) as (keyof typeof CHANNELS)[]).map((k) => {
  const ch = CHANNELS[k];
  const midAht = (ch.ahtP25 + ch.ahtP75) / 2;
  const perMonth = Math.round(ticketsPerAgentMonth(midAht));
  const agentCost = loadedCostPerAgent(RATE);
  return {
    key: k,
    label: ch.label,
    aht: midAht,
    perAgentMonth: perMonth,
    costPerTicket: agentCost / perMonth,
  };
});

const PAYBACK = [250, 500, 1000, 2000, 5000, 10000, 25000, 50000].map((tickets) => {
  const o = compute({ ...DEFAULTS, monthlyTickets: tickets });
  return {
    tickets,
    agents: `${o.agentsRange[0]}-${o.agentsRange[1]}`,
    labor: o.monthlyLaborCostRange[0],
    platform: o.monthlyPlatformCost,
    net: o.monthlyNetEffect,
    roi: o.yearOneRoi,
    verdict: o.verdict,
  };
});

const VERDICT_LABEL: Record<string, string> = {
  strong: "Strong",
  workable: "Workable",
  marginal: "Marginal",
  "not-worth-it": "Not worth it",
};

export default function Benchmarks() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-14">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">
        Support cost &amp; productivity benchmarks
      </h1>
      <p className="mt-3 max-w-2xl text-slate-600">
        Three tables: how many tickets one agent actually clears, what a ticket
        costs to handle, and where automation stops paying for itself. Every figure
        is computed from the same model that drives the{" "}
        <a href="/" className="underline">calculator</a> — not estimated, not quoted
        from a vendor deck.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-900">
        1. Tickets per agent per day, by handle time
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        At 5.5 productive hours per shift. Most teams overestimate this by using
        8 productive hours, which inflates capacity roughly 45%.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-300 text-left">
              <th className="py-2 pr-4 font-semibold">Avg handle time</th>
              <th className="py-2 pr-4 font-semibold">Tickets / shift</th>
              <th className="py-2 font-semibold">Tickets / agent / month</th>
            </tr>
          </thead>
          <tbody>
            {productivity.map((p) => (
              <tr key={p.aht} className="border-b border-slate-200">
                <td className="py-2 pr-4 font-mono">{p.aht} min</td>
                <td className="py-2 pr-4 font-mono">{p.perShift}</td>
                <td className="py-2 font-mono">{p.perMonth.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-12 text-xl font-semibold text-slate-900">
        2. Cost per support ticket, by industry
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        At a loaded agent cost of ${RATE}/hour and each industry&apos;s mid-range
        handle time. Multiply by your real rate — cost per ticket scales linearly
        with it.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-300 text-left">
              <th className="py-2 pr-4 font-semibold">Industry</th>
              <th className="py-2 pr-4 font-semibold">Avg AHT</th>
              <th className="py-2 pr-4 font-semibold">Tickets / agent / mo</th>
              <th className="py-2 font-semibold">Cost / ticket</th>
            </tr>
          </thead>
          <tbody>
            {COST_PER_TICKET.map((r) => (
              <tr key={r.key} className="border-b border-slate-200">
                <td className="py-2 pr-4">{r.label}</td>
                <td className="py-2 pr-4 font-mono">{r.aht.toFixed(1)} min</td>
                <td className="py-2 pr-4 font-mono">{r.perAgentMonth.toLocaleString()}</td>
                <td className="py-2 font-mono font-semibold text-slate-900">
                  ${r.costPerTicket.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-slate-500">
        A $2.50 ticket that takes 7 minutes of a $26/hour agent costs about{" "}
        {fmt(COST_PER_TICKET[0].costPerTicket)}. A $1 ticket in marketplace support
        is genuinely cheap. The number that matters is not &quot;cost per ticket&quot;,
        it is{" "}
        <b>cost per ticket × tickets per resolved problem</b> — and the second term is
        where automation quietly pays off, by cutting repeat contacts rather than
        making first contacts cheaper.
      </p>

      <h2 className="mt-12 text-xl font-semibold text-slate-900">
        3. Where automation stops paying for itself
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        E-commerce, 8 min AHT, 8h coverage, 50% coverage, $0.65/resolution,
        $1,500 setup, savings phased over 12 months.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-300 text-left">
              <th className="py-2 pr-4 font-semibold">Tickets / mo</th>
              <th className="py-2 pr-4 font-semibold">Agents</th>
              <th className="py-2 pr-4 font-semibold">Labor / mo</th>
              <th className="py-2 pr-4 font-semibold">Platform / mo</th>
              <th className="py-2 pr-4 font-semibold">Net / mo</th>
              <th className="py-2 pr-4 font-semibold">Year-1</th>
              <th className="py-2 font-semibold">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {PAYBACK.map((p) => (
              <tr key={p.tickets} className="border-b border-slate-200">
                <td className="py-2 pr-4 font-mono">{p.tickets.toLocaleString()}</td>
                <td className="py-2 pr-4 font-mono">{p.agents}</td>
                <td className="py-2 pr-4 font-mono">{fmt(p.labor)}</td>
                <td className="py-2 pr-4 font-mono">{fmt(p.platform)}</td>
                <td
                  className={`py-2 pr-4 font-mono font-semibold ${
                    p.net > 0 ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {p.net > 0 ? "+" : ""}
                  {fmt(p.net)}
                </td>
                <td className="py-2 pr-4 font-mono">{p.roi.toFixed(1)}x</td>
                <td className="py-2">{VERDICT_LABEL[p.verdict]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-slate-500">
        Note the discontinuity: below roughly 400 tickets a month there is no
        headcount to remove, so the platform fee is pure cost. That cliff, not a
        smooth curve, is the single most useful fact on this page.
      </p>

      <h2 className="mt-12 text-xl font-semibold text-slate-900">Caveats</h2>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
        <li>• Seasonality and launch spikes are not modelled.</li>
        <li>• Out-of-hours ticket distribution is averaged, not weighted.</li>
        <li>• CSAT and lifetime-value effects of automation are excluded from all money figures.</li>
        <li>• Cost per ticket excludes the cost of the system the agent works in.</li>
        <li>• These are planning figures. Measure your own handle time for two weeks.</li>
      </ul>

      <div className="mt-10 rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-700">
          Working in support or CX consulting?{" "}
          <a href="/#embed" className="font-medium underline">
            Embed this calculator
          </a>{" "}
          in a client proposal — same numbers, no cookies, no email capture.
        </p>
      </div>
    </div>
  );
}

function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}
