"use client";

import { useEffect, useState } from "react";
import { decodeState, DEFAULTS, type Inputs } from "@/lib/model";
import { buildReport } from "@/lib/report";
import { track } from "@/lib/track";

/**
 * The deliverable, rendered on the client.
 *
 * The report is generated from the permalink, so the buyer sees the exact
 * scenario they paid for. That makes hydration a correctness requirement, not a
 * nicety: a server-rendered default here would ship someone a $49 document
 * describing numbers that are not theirs, and they would be right to complain.
 *
 * Loading gate covers the gap between server render (defaults, so the page is
 * indexable-shaped and never blank) and the permalink decode on mount.
 */
export function ReportClient() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fromLink = decodeState(window.location.search);
    if (Object.keys(fromLink).length) {
      setInputs((p) => ({ ...p, ...fromLink }));
    }
    setReady(true);
    track("report_view", { tier_review: 0 });
  }, []);

  const r = buildReport(inputs);

  const tone =
    r.verdictTone === "good"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : r.verdictTone === "warn"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-rose-200 bg-rose-50 text-rose-900";

  return (
    <article className="mx-auto max-w-3xl">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          {r.generatedFor}
          {!ready && " · loading your scenario…"}
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
        >
          Print / save as PDF
        </button>
      </div>

      <h1 className="text-2xl font-bold leading-snug text-slate-900 sm:text-3xl">
        {r.headline}
      </h1>

      <div className={"mt-5 rounded-xl border p-5 " + tone}>
        <p className="text-sm font-semibold uppercase tracking-wide opacity-80">
          Recommendation
        </p>
        <p className="mt-2 text-sm leading-relaxed">{r.verdict}</p>
      </div>

      {r.sections.map((s) => (
        <section key={s.title} className="mt-9">
          <h2 className="text-lg font-semibold text-slate-900">{s.title}</h2>
          {s.body.map((p, idx) => (
            <p key={idx} className="mt-2.5 text-sm leading-relaxed text-slate-700">
              {p}
            </p>
          ))}
          {s.table && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-slate-900 text-left">
                    {s.table.head.map((h) => (
                      <th
                        key={h}
                        className="py-2 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-600"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.table.rows.map((row) => (
                    <tr key={row[0]} className="border-b border-slate-200">
                      {row.map((c, idx) => (
                        <td
                          key={idx}
                          className={
                            idx === 0
                              ? "py-2 pr-4 text-slate-700"
                              : "py-2 pr-4 font-mono text-slate-900"
                          }
                        >
                          {c}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ))}

      <section className="mt-9 rounded-xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          Assumptions this report rests on
        </h2>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {r.appendix.map((a) => (
            <div key={a.label} className="flex justify-between gap-3 text-sm">
              <dt className="text-slate-600">{a.label}</dt>
              <dd className="font-mono text-slate-900">{a.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Every number above comes from the same public model as the free
          calculator. If a figure looks wrong, the input that produced it is in
          this page&apos;s URL, and the formula is on the{" "}
          <a href="/methodology" className="underline">
            methodology page
          </a>
          . The free tool links here with the buyer&apos;s full scenario encoded,
          so this document is reproducible by anyone holding the link.
        </p>
      </section>
    </article>
  );
}
