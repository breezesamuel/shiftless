export const metadata = {
  title: "Methodology",
  description:
    "Every constant, formula and data source behind the Shiftless support headcount and automation ROI calculator.",
  alternates: { canonical: "/methodology" },
};

const CONSTANTS = [
  ["Productive hours per shift", "5.5 h", "8 h shift minus breaks, meetings, training and idle time."],
  ["Shifts per FTE", "4.6", "Covers 7 days x 8 h of response window, with 1-2 weeks annual leave absorbed."],
  ["E-commerce AHT", "7–12 min", "Order status, returns, shipping, payment."],
  ["SaaS AHT", "9–18 min", "Billing, onboarding, how-to, bug triage."],
  ["Marketplace AHT", "5–9 min", "Listing and seller support."],
  ["Services AHT", "8–15 min", "Scheduling, quotes, client questions."],
  ["Automation ceiling — e-commerce", "62%", "Share of tickets that are repetitive enough to resolve without a human."],
  ["Automation ceiling — SaaS", "55%", "Lower because of account-specific and technical questions."],
  ["Automation ceiling — marketplace", "50%", "Disputes are more bespoke."],
  ["Automation ceiling — services", "48%", "Scheduling and quotes benefit most, but scope varies widely."],
];

const FORMULAS = [
  ["Tickets per agent per day", "floor(5.5 x 60 / handle time)"],
  ["Baseline FTE", "ceil( (monthly tickets / 30) / capacity x coverage factor )"],
  ["Coverage factor", "max(1, coverage hours / 5.5)"],
  ["Automation coverage used", "min(entered, industry ceiling)"],
  ["Agents after automation", "ceil( human tickets / 30 / capacity x coverage factor )"],
  ["Net monthly effect", "headcount saved - automation platform cost"],
  ["Payback", "annual platform cost / net monthly effect"],
  ["Year-1 return", "gross annual savings / annual platform cost"],
];

export default function Methodology() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-14">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Methodology</h1>
      <p className="mt-3 text-slate-600">
        This page exists so you can check our work. If a number here is wrong or
        stale, we want to hear about it.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-900">Constants</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left">
              <th className="py-2 pr-4 font-semibold text-slate-900">Constant</th>
              <th className="py-2 pr-4 font-semibold text-slate-900">Value</th>
              <th className="py-2 font-semibold text-slate-900">Basis</th>
            </tr>
          </thead>
          <tbody>
            {CONSTANTS.map(([k, v, b]) => (
              <tr key={k} className="border-b border-slate-200 align-top">
                <td className="py-2.5 pr-4 text-slate-800">{k}</td>
                <td className="py-2.5 pr-4 font-mono text-slate-900">{v}</td>
                <td className="py-2.5 text-slate-600">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-10 text-xl font-semibold text-slate-900">Formulas</h2>
      <ul className="mt-4 space-y-2 font-mono text-sm text-slate-700">
        {FORMULAS.map(([k, f]) => (
          <li key={k} className="rounded-lg bg-white px-4 py-2.5">
            <span className="font-sans text-slate-500">{k}:</span> {f}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-slate-900">Where the ranges come from</h2>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        Handle-time distributions and automation ceilings are compiled from
        published support-industry benchmarks and practitioner surveys. They are
        deliberately conservative and stated as ranges rather than averages,
        because a 12-minute AHT shop and a 4-minute AHT shop both exist and the
        difference is roughly a factor of three in headcount.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">
        We do not claim these are precise. They are defensible planning figures.
        The single most valuable thing you can do is measure your own handle time
        for two weeks and re-run the model with the real number — that is why
        every input on the calculator is editable.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-slate-900">Limitations</h2>
      <ul className="mt-3 space-y-2 text-sm text-slate-600">
        <li>• Seasonality, launch spikes and product launches are not modelled.</li>
        <li>• Out-of-hours and weekend ticket distribution is averaged, not weighted.</li>
        <li>• Quality, CSAT and lifetime-value effects of automation are excluded from the money figures.</li>
        <li>• We do not model the cost of migrating and maintaining your help centre.</li>
      </ul>
    </div>
  );
}
