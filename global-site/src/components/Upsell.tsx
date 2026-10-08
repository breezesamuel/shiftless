"use client";

import { useState, useMemo, useEffect } from "react";
import { DEFAULTS, decodeState, type Inputs } from "@/lib/model";
import { buildReport } from "@/lib/report";
import { track } from "@/lib/track";
import { PaymentDetails } from "@/components/PaymentDetails";

/**
 * Upsell from the free tool.
 *
 * The free calculator answers "what is my number". This answers "what do I do
 * about it" — the sensitivity, the break-even, the 90-day sequence, the risks.
 * That is the part a support lead spends two days building and a manager still
 * gets wrong, which is the only thing worth charging money for.
 *
 * Pricing logic, not pricing vanity:
 * - Single tier, $49. A support lead's time is worth more than that, and a
 *   decision this consequential should not have a config wizard in front of it.
 * - The premium tier is 30 minutes of human review, not more PDF. Selling
 *   "more analysis" to someone who could not justify the first one is how you
 *   end up refunding.
 * - No annual plan, no seats, no usage meter. Every one of those is support
 *   surface area we cannot afford at this volume.
 */

const PRICE_USD = 49;
const PRICE_REVIEW_USD = 149;

export function Upsell() {
  const [inputs, setInputs] = useState<Inputs>(DEFAULTS);
  const [email, setEmail] = useState("");
  const [rail, setRail] = useState<"card" | "alipay">("card");
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">("idle");
  const [orderId, setOrderId] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const fromLink = decodeState(window.location.search);
    if (Object.keys(fromLink).length) setInputs((p) => ({ ...p, ...fromLink }));
  }, []);

  const report = useMemo(() => buildReport(inputs), [inputs]);
  const isNo = report.verdictTone === "bad";

  // The preview is generated from the real report object, so the sample a buyer
  // reads is byte-identical to what they receive. Quoting a different example
  // in the sales copy is how a refund happens.
  const preview = report.sections[2];

  const submit = async (tier: "standard" | "review") => {
    setState("busy");
    setErr("");
    try {
      const r = await fetch("/api/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, tier, rail, inputs }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErr(j.error || "Could not start checkout.");
        setState("err");
        return;
      }
      track("order_start", { tier_review: tier === "review" ? 1 : 0 });
      if (j.paymentUrl) {
        window.location.href = j.paymentUrl;
        return;
      }
      if (j.orderId) setOrderId(j.orderId);
      setState("done");
    } catch {
      setErr("Network error. Try again.");
      setState("err");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-slate-900">
        The 90-day plan this belongs in
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        The free tool gives you a number. This gives you the plan around it:
        volume sensitivity, your break-even point, what to do in the next 90 days,
        and the four things that would change the answer. Every figure comes from
        the same model — it is not a different calculator with nicer prose.
      </p>

      {/* Live preview from the real report object */}
      <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Section 3 of your report — {preview.title}
        </p>
        <p className="mt-1.5 text-sm text-slate-700">{preview.body[0]}</p>
        {preview.table && (
          <table className="mt-3 w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-300 text-left text-slate-500">
                {preview.table.head.map((h) => (
                  <th key={h} className="py-1.5 pr-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.table.rows.map((r) => (
                <tr key={r[0]} className="border-b border-slate-200">
                  {r.map((c, idx) => (
                    <td key={idx} className={`py-1.5 pr-3 ${idx === 0 ? "" : "font-mono"}`}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Generated live from your inputs above. If you change the numbers, this
          changes with them.
        </p>
      </div>

      {isNo && (
        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-semibold text-rose-900">
            We are going to tell you this is not a purchase you should make.
          </p>
          <p className="mt-1 text-sm text-rose-800">
            At your volume the honest recommendation is to fix the knowledge base
            and keep your agent. The $49 report still contains the 90-day
            knowledge-base plan, because that is the part that is useful. Buy it
            for that, not for an automation business case that does not exist at
            this size. If you are being pushed to buy automation, send this link
            to whoever is pushing.
          </p>
        </div>
      )}

      {/* Tiers */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border-2 border-slate-900 p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold text-slate-900">Full report</span>
            <span className="text-2xl font-bold text-slate-900">${PRICE_USD}</span>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
            <li>• Current state, with the full derivation</li>
            <li>• What automation changes, line by line</li>
            <li>• Sensitivity at -30% / flat / +50% volume</li>
            <li>• Your break-even ticket volume</li>
            <li>• 90-day sequenced plan</li>
            <li>• Risks and reversal triggers</li>
            <li>• PDF + shareable permalink</li>
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold text-slate-900">+ 30-min review</span>
            <span className="text-2xl font-bold text-slate-900">${PRICE_REVIEW_USD}</span>
          </div>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
            <li>• Everything in the full report</li>
            <li>• 30 minutes with someone who has sized support orgs</li>
            <li>• We pressure-test your assumptions</li>
            <li>• Written follow-up you can forward to your CFO</li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            The review is the product. More PDF would just be padding.
          </p>
        </div>
      </div>

      {/* Checkout */}
      <div className="mt-6 border-t border-slate-200 pt-5">
        <label className="text-sm font-medium text-slate-700">Work email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          aria-label="Work email"
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />

        <div className="mt-4 flex gap-2">
          {(
            [
              ["card", "Card"],
              ["alipay", "Alipay / China"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setRail(k)}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                rail === k
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={state === "busy"}
            onClick={() => submit("standard")}
            className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {state === "busy" ? "Starting…" : `Get the report — $${PRICE_USD}`}
          </button>
          <button
            type="button"
            disabled={state === "busy"}
            onClick={() => submit("review")}
            className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Include the review — ${PRICE_REVIEW_USD}
          </button>
        </div>

        {state === "done" && (
          <div className="mt-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <p className="font-semibold">
              Order recorded{orderId ? `: ${orderId}` : ""}.
            </p>
            <p className="mt-1">
              Transfer using the details below, put the order reference in the
              remark, then send the receipt screenshot to the payment address —
              we confirm within one business day. No email is sent automatically.
            </p>
            <PaymentDetails lang="en" orderId={orderId} />
          </div>
        )}
        {state === "err" && (
          <p className="mt-3 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {err}
          </p>
        )}

        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Current volumes sell out of relevance fast, so the report is generated
          for the numbers you enter rather than being a generic template. If it
          is wrong, it is wrong because your inputs are wrong — every constant is
          published on the methodology page so you can check it.
        </p>
      </div>
    </div>
  );
}
