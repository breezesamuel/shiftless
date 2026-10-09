import Link from "next/link";
import { Calculator } from "@/components/Calculator";
import { StructuredData } from "@/components/StructuredData";
import { CopyEmbed } from "@/components/CopyEmbed";
import { Upsell } from "@/components/Upsell";
import { FAQ } from "@/lib/faq";
import { SITE_URL } from "@/lib/site";

export const metadata = {
  title: "Support Headcount Calculator — How Many Support Agents Do You Need?",
  description:
    "Free calculator: how many customer support agents do you need, what does it cost, and is AI automation actually worth it at your volume? No signup, instant answer.",
  alternates: {
    canonical: "/",
    languages: { en: "/", "zh-CN": "/zh", "x-default": "/" },
  },
};

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <StructuredData />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            Shiftless
          </span>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#calculator" className="hover:text-slate-900">Calculator</a>
            <Link href="/benchmarks" className="hover:text-slate-900">Benchmarks</Link>
            <a href="#method" className="hover:text-slate-900">Method</a>
            <a href="#faq" className="hover:text-slate-900">FAQ</a>
            <Link href="/geo" className="hover:text-slate-900">AI Visibility Audit</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero + tool */}
        <section id="calculator" className="mx-auto max-w-6xl px-6 py-12">
          <div className="max-w-3xl">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              How many support agents do you actually need?
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              Most teams guess. Guessing high wastes payroll; guessing low means your
              agents drown and customers churn. Enter your real ticket volume and get a
              range you can defend in a budget meeting — plus an honest read on whether
              AI automation is worth it at your size.
            </p>
            <p className="mt-3 text-sm text-slate-500">
              No signup. No email required. Every assumption is editable, and the tool
              will tell you when automation is not worth buying.
            </p>
          </div>

          <div className="mt-8">
            <Calculator />
          </div>
        </section>

        {/* Upsell — placed after the calculator so the buyer has already seen
            a real number and has a real question. Putting a price before the
            tool has demonstrated anything is how you get a bounce rate and no
            revenue. */}
        <section id="report" className="border-t border-slate-200 bg-slate-50 py-14">
          <div className="mx-auto max-w-4xl px-6">
            <Upsell />
          </div>
        </section>

        {/* Method — the trust block */}
        <section id="method" className="border-y border-slate-200 bg-white py-14">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              How the numbers are calculated
            </h2>
            <p className="mt-2 max-w-3xl text-slate-600">
              A calculator that hides its assumptions is a sales brochure. These are
              every constant we use.
            </p>

            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900">Productive time</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  5.5 productive hours per 8-hour shift, after breaks, meetings,
                  training and idle time. 4.6 shifts per agent to cover 7 days a week.
                  Using 8 productive hours is the most common way these estimates
                  come out 40% too low.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900">Handle-time range</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  We report headcount across your industry's 25th-to-75th percentile
                  handle time — 7 to 12 minutes for e-commerce, 9 to 18 for SaaS. Real
                  teams span this range, which is why a single-number estimate is
                  never honest.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 p-5">
                <h3 className="font-semibold text-slate-900">Automation ceiling</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Capped at 62% for e-commerce, 55% for SaaS, 50% for marketplaces.
                  If you enter a higher number we use the ceiling instead and tell you
                  why. Pilot-period coverage that excludes escalations is the single
                  most common way automation projects disappoint.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Honest positioning */}
        <section className="py-14">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              When not to buy support automation
            </h2>
            <ul className="mt-5 space-y-3 text-slate-700">
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                <span>
                  <b>Under ~400 tickets a month.</b> A decent help centre and one
                  accountable human will beat a platform on both cost and quality.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                <span>
                  <b>Before you have written anything down.</b> If your FAQs live in
                  three people's heads, automation has nothing to automate.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                <span>
                  <b>While support is a strategic differentiator.</b> Automated
                  deflection saves money and quietly costs you the relationship.
                </span>
              </li>
            </ul>
          </div>
        </section>

        {/* Embed program */}
        <section id="embed" className="border-t border-slate-200 bg-slate-100 py-14">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Work in support or CX consulting?
            </h2>
            <p className="mt-2 text-slate-600">
              If you put headcount sizing into client proposals, embed it directly.
              Same numbers as this page, no cookies, no email capture, safe inside a
              client-facing document. The attribution link stays — it&apos;s what keeps
              this free.
            </p>
            <pre className="mt-5 overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
{`<iframe
  src="${SITE_URL}/embed"
  width="100%" height="620" frameborder="0"
  title="Support headcount and automation ROI calculator"
  loading="lazy"></iframe>`}
            </pre>
            <div className="no-print mt-3">
              <CopyEmbed />
            </div>
            <p className="mt-4 text-sm text-slate-600">
              Every constant behind it is public on the{" "}
              <Link href="/methodology" className="underline">methodology page</Link>,
              so you can defend the number if a client challenges it. Happy to
              white-label the colours.
            </p>
          </div>
        </section>

        {/* FAQ — schema + long-tail SEO */}
        <section id="faq" className="border-t border-slate-200 bg-white py-14">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Frequently asked questions
            </h2>
            <dl className="mt-6 space-y-6">
              {FAQ.map((f) => (
                <div key={f.q}>
                  <dt className="font-semibold text-slate-900">{f.q}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.a}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8 text-sm text-slate-500">
        <div className="mx-auto max-w-6xl px-6">
          <p>
            Shiftless is an independent calculator published by Shanghai Bingdashan
            Intelligent Technology Co., Ltd. Estimates are models, not guarantees —
            validate against two weeks of your own data before committing budget.
          </p>
          <p className="mt-2">
            <Link href="/privacy" className="underline">Privacy</Link> ·{" "}
            <Link href="/methodology" className="underline">Full methodology</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
