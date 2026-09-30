"use client";

import { useState } from "react";

/**
 * 季度复审订阅下单表单。
 *
 * 诚实边界（与 GeoOrder 一致，不夸大）：
 * - 首季即建立基线快照，之后每季自动复审并对比上一季，产出变化曲线。
 * - 不承诺排名；复审测量的是可读性分数的变化，不是模型输出位置。
 * - 本页面不会自动发邮件；付款与交付均为人工，转账后按订单号确认。
 * - 每季结束前可书面通知下季不续，无违约条款。
 */

const PLANS: { id: "subscription"; name: string; cny: number; points: string[] }[] = [
  {
    id: "subscription",
    name: "季度复审订阅（每季）",
    cny: 2999,
    points: [
      "首季：建立全站基线快照（6-8 个关键页面逐页打分）",
      "每季自动复审：与上一季逐项对比，标出已修复 / 退步 / 新增问题",
      "每季一份变化报告 + 你自己三个季度的分数曲线",
      "任一季发现回归项，额外附一次针对性整改建议",
      "可随时书面通知下季不续",
    ],
  },
];

export function GeoSubOrder() {
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
        body: JSON.stringify({ email, siteUrl, tier: "subscription" }),
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

  const plan = PLANS[0];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-slate-900">订阅季度复审</h3>
      <ul className="mt-3 space-y-1.5 text-sm text-slate-600">
        {plan.points.map((p) => (
          <li key={p}>• {p}</li>
        ))}
      </ul>

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
          要复审的网站根地址
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

        <button
          type="button"
          disabled={state === "busy"}
          onClick={submit}
          className="mt-5 w-full rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {state === "busy" ? "提交中…" : `订阅首季 — ¥${plan.cny}`}
        </button>

        {state === "done" && result && (
          <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <p className="font-semibold">订单已记录：{result.orderId}</p>
            <p className="mt-1">{result.nextStep}</p>
            <p className="mt-1 text-xs">
              本页面不会自动发送邮件。请主动将转账截图发到售后微信/邮箱并附订单号，
              我们确认到账后开始建立基线快照。
            </p>
          </div>
        )}
        {state === "err" && (
          <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</p>
        )}

        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          首季开始即为你保留一份基线快照，之后每季对比。
          复审只报告可读性分数的变化，不预测也不承诺任何模型输出排名。
        </p>
      </div>
    </div>
  );
}
