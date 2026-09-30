"use client";

import { useState } from "react";

/**
 * Shown only when the result is worth acting on. We do not show a sales form to
 * someone whose answer is "don't buy automation" — that is both dishonest and
 * the fastest way to get an email list nobody reads.
 */
export function LeadGate({
  enabled,
  payload,
}: {
  enabled: boolean;
  payload: Record<string, unknown>;
}) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">("idle");

  if (!enabled) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy");
    try {
      const r = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, email, source: "calculator-cta" }),
      });
      setState(r.ok ? "done" : "err");
    } catch {
      setState("err");
    }
  };

  if (state === "done") {
    return (
      <div className="no-print rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="font-semibold text-emerald-900">Noted.</p>
        <p className="mt-1.5 text-sm text-emerald-800">
          Your numbers are recorded so we can point you at the right comparison.
          No automated mail, no drip sequence, no sharing, no newsletter.
        </p>
      </div>
    );
  }

  return (
    <div className="no-print rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="text-sm font-semibold text-slate-900">
        Not sure whether the paid report is worth $49 to you?
      </h3>
      <p className="mt-1.5 text-sm text-slate-600">
        Leave the number instead of the invoice. A person will look up
        {payload.monthlyTickets ? ` teams like yours — ${Number(payload.monthlyTickets).toLocaleString("en-US")} tickets` : " comparable teams"}
        {payload.channel ? ` in ${String(payload.channel)}` : ""} — and tell you
        straight whether it is. The public{" "}
        <a href="/benchmarks" className="underline">
          benchmark tables
        </a>{" "}
        are already free, so this is not a way of buying something you can read.
      </p>

      <form onSubmit={submit} className="mt-4 flex flex-wrap gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          aria-label="Work email"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600"
        />
        <button
          type="submit"
          disabled={state === "busy"}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {state === "busy" ? "Sending…" : "Send it"}
        </button>
      </form>

      {state === "err" && (
        <p className="mt-2 text-xs text-rose-700">
          Could not send. Please try again.
        </p>
      )}
    </div>
  );
}
