"use client";

import { useState } from "react";

/**
 * Lead capture on the programmatic ROI pages.
 *
 * These pages are the ones search engines actually visit, and until now they
 * had no way to convert: a visitor who read "SaaS: 3 agents for 4,000
 * tickets" could only click through to the calculator. This form captures the
 * email with the page's own numbers as context, so the operator gets an alert
 * that says which exact page and volume the person was reading.
 *
 * Same honesty rules as the calculator's LeadGate: shown only when the verdict
 * is worth acting on (the page itself says "don't buy" otherwise), and it
 * promises a person replies — no automated mail, no drip, no newsletter.
 */
export function CorpusLeadCta({
  lang,
  payload,
}: {
  lang: "en" | "zh";
  payload: Record<string, unknown>;
}) {
  const en = lang === "en";
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy");
    try {
      const r = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, email, source: "corpus-cta" }),
      });
      setState(r.ok ? "done" : "err");
    } catch {
      setState("err");
    }
  };

  if (state === "done") {
    return (
      <div className="no-print mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-5">
        <p className="font-semibold text-emerald-900">{en ? "Got it." : "已收到。"}</p>
        <p className="mt-1 text-sm text-emerald-800">
          {en
            ? "A person replies within one business day with the same evaluation for your own volume. No automated mail, no drip sequence, no sharing."
            : "1 个工作日内会有人工回复，用你实际的量级出一版同样的测算。不会自动群发，不推送，不分享。"}
        </p>
      </div>
    );
  }

  const tickets = Number(payload.monthlyTickets ?? 0);

  return (
    <div className="no-print mt-6 rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="font-semibold text-slate-900">
        {en
          ? "This is one example. Get yours calculated."
          : "这只是其中一个例子——算一下你自己的团队。"}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        {en
          ? `These figures assume ${tickets.toLocaleString("en-US")} tickets/mo. Leave your email and a person replies within one business day with the same evaluation for your actual ticket count and AHT — free, and fine to ignore if it is not useful.`
          : `上面的数字基于每月 ${tickets.toLocaleString("zh-CN")} 条工单这一组假设。留下邮箱，1 个工作日内人工回复，用你实际的工单量与 AHT 出一版同样的测算——免费，不合适可以直接忽略。`}
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-wrap gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          aria-label={en ? "Work email" : "工作邮箱"}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600"
        />
        <button
          type="submit"
          disabled={state === "busy"}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {state === "busy" ? (en ? "Sending…" : "发送中…") : en ? "Get my number" : "算我的数字"}
        </button>
      </form>

      {state === "err" && (
        <p className="mt-2 text-xs text-rose-700">
          {en ? "Could not send. Please try again." : "发送失败，请重试。"}
        </p>
      )}
    </div>
  );
}