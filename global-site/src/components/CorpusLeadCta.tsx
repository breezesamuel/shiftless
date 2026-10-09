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
 *
 * Referral attribution: when a visitor arrives through a shared ?ref=<email>
 * link, that email is forwarded to /api/lead so the operator's alert says who
 * referred the lead. After submitting, the visitor gets their own referral
 * link (this page + their email) to share, and the reward copy only promises
 * what the programme actually is: credit granted after the referral's payment
 * is confirmed.
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
  const [copied, setCopied] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState("busy");
    // The referrer (if any) is whoever's shared link the visitor arrived
    // through; the page is static, so it can only be read client-side.
    let ref: string | undefined;
    try {
      const r = new URLSearchParams(window.location.search).get("ref") || "";
      if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(r)) ref = r.toLowerCase();
    } catch {
      // location unavailable (shouldn't happen); attribution just not set
    }
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, email, ref, source: "corpus-cta" }),
      });
      setState(res.ok ? "done" : "err");
    } catch {
      setState("err");
    }
  };

  const share = () => {
    if (!email) return "";
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}?ref=${encodeURIComponent(email)}`;
  };

  const copyShare = async () => {
    const u = share();
    if (!u) return;
    try {
      await navigator.clipboard.writeText(u);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked; link is still visible in the box below
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

        {/* Referral share box. The promise here is only what the programme
            actually pays: credit after the referral's payment is confirmed. */}
        <div className="mt-4 rounded-lg border border-emerald-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-900">
            {en
              ? "Know an operations lead running a bigger queue? Send them this page."
              : "认识带更大客服团队的人？把这页发给他们。"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {en
              ? "When someone orders through your link, the email you just entered is recorded as the referrer. Credit is granted once their payment is confirmed — 1 paid referral → +1 month, 3 each paid a quarter → +3, 10 each paid a year → +12 (tiers stack)."
              : "通过你的链接成交时，你刚填的邮箱会被记为推荐人。奖励在他们付款确认后发放——1 位付费 → +1 个月，3 位各付满一季度 → +3，10 位各付满一年 → +12（三档叠加）。"}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
              {share()}
            </code>
            <button
              type="button"
              onClick={copyShare}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              {copied ? (en ? "Copied" : "已复制") : en ? "Copy link" : "复制链接"}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            {en ? (
              <>
                Rules:{" "}
                <a href="/zh/geo/subscribe#referral" className="underline">
                  referral reward programme
                </a>
              </>
            ) : (
              <>
                <a href="/zh/geo/subscribe#referral" className="underline">
                  推荐奖励规则
                </a>{" "}
                （只按实际付款计算）
              </>
            )}
          </p>
        </div>
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