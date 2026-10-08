"use client";

import { useState } from "react";
import { PaymentDetails } from "./PaymentDetails";

/**
 * GEO audit order form.
 *
 * Honesty rules that came out of reviewing the existing Upsell component:
 * - Upsell's "Check your email for payment instructions" is a lie: there is no
 *   mail provider deployed. This component never implies an email is sent.
 * - The endpoint returns manual:true with a nextStep string. We show exactly
 *   that string — not a nicer browser that claims something that isn't true.
 * - Payment happens by 转账, quoted against the orderId, fulfilment by hand.
 */

const TIERS: { id: "report" | "fix"; name: string; cny: number; points: string[] }[] = [
  {
    id: "report",
    name: "可见度审计报告",
    cny: 1999,
    points: [
      "全站 6-8 个关键页面逐页扫描",
      "11 项 AI 可读性检查，权重透明",
      "每项：现状 → 影响 → 改法 → 工作量",
      "+ 竞品对照（同行谁已做这套）",
      "48 小时内发送 Markdown 报告",
    ],
  },
  {
    id: "fix",
    name: "审计 + 整改",
    cny: 4999,
    points: [
      "包含全部审计内容",
      "+ 一次性整改提议稿（改哪里、贴哪段代码）",
      "+ 整改后复查一次，验证分数变化",
      "你和你的团队照做即可，无需再请人",
    ],
  },
];

export function GeoOrder() {
  const [tier, setTier] = useState<"report" | "fix">("report");
  const [email, setEmail] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">("idle");
  const [result, setResult] = useState<{ orderId: string; priceCny: number; nextStep: string } | null>(null);
  const [err, setErr] = useState("");

  const submit = async () => {
    setState("busy");
    setErr("");
    try {
      const r = await fetch("/api/geo-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, siteUrl, tier }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErr(j.error || "提交失败，请重试。");
        setState("err");
        return;
      }
      setResult(j);
      setState("done");
    } catch {
      setErr("网络错误，请重试。");
      setState("err");
    }
  };

  const selected = TIERS.find((t) => t.id === tier)!;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-slate-900">购买正式报告</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        先测你的官网，拿到 0–100 的可复现分数，再决定改不改、改哪里。
        分数可复现（重新扫描得同样结果）——这是与「排名保证」服务的根本区别。
      </p>

      {/* Tiers */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {TIERS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTier(t.id)}
            className={`rounded-xl border p-4 text-left ${
              tier === t.id ? "border-slate-900" : "border-slate-200"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <span className="font-semibold text-slate-900">{t.name}</span>
              <span className="text-xl font-bold text-slate-900">¥{t.cny}</span>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
              {t.points.map((p) => (
                <li key={p}>• {p}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        我们不承诺任何「排名」。审计测量的是可读性——纯输入侧、可执行、可复现。
        任何保证你在 ChatGPT 答案里排第几的服务商，卖的是它控制不了的结果。
      </p>

      {/* Order form */}
      <div className="mt-5 border-t border-slate-200 pt-5">
        <label className="text-sm font-medium text-slate-700">工作邮箱</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          aria-label="工作邮箱"
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />

        <label className="mt-4 block text-sm font-medium text-slate-700">
          要审计的网站根地址
        </label>
        <input
          type="url"
          required
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          placeholder="https://example.com"
          aria-label="网站根地址"
          className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />

        <PaymentDetails orderId={state === "done" && result ? result.orderId : undefined} />

        <button
          type="button"
          disabled={state === "busy"}
          onClick={submit}
          className="mt-5 w-full rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {state === "busy" ? "提交中…" : `下单 — ¥${selected.cny}`}
        </button>

        {state === "done" && result && (
          <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <p className="font-semibold">订单已记录：{result.orderId}</p>
            <p className="mt-1">{result.nextStep}</p>
            <p className="mt-1 text-xs">
              请注意：本页面不会自动发送邮件。请主动将转账截图发到售后微信/邮箱并附订单号，
              我们确认到账后 48 小时内交付。
            </p>
          </div>
        )}
        {state === "err" && (
          <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</p>
        )}

        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          先扫码看样板再决定是否购买——我们把吉客云 35/100、卖家精灵 52/100 的
          一页样板公开挂在演示区。如果测评结果与你的判断不符，付钱前随时可退约。
        </p>
      </div>
    </div>
  );
}