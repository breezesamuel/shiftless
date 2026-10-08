"use client";

import { useEffect, useState } from "react";

import { PaymentDetails } from "@/components/PaymentDetails";
import { PLANS, PLAN_ORDER, FREE_TIER_COPY, formatPrice } from "@/lib/pricing";
import type { Currency, PlanId } from "@/lib/pricing";
import { REWARD_ROWS, REWARD_PROGRAM_NOTE } from "@/lib/referral-copy";

/**
 * 订阅下单。
 *
 * 诚实边界（与 GeoOrder 一致，不夸大）：
 * - 价格表来自 lib/pricing，服务器端二次定价；改前端显示不会改变应付金额。
 * - 免费额度：新用户 10 次单页审计，用完后才需要订阅。
 * - 支付：在线通道是否可用由服务器判定；未开通时明确显示"开通中"，不假装能付。
 * - 奖励：按下单人付款深度判定，三档不叠加，规则明写在页面上。
 */

function CurrencyToggle({
  currency,
  onChange,
}: {
  currency: Currency;
  onChange: (c: Currency) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-300 p-0.5" role="group" aria-label="货币">
      {(["cny", "usd"] as Currency[]).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-pressed={currency === c}
          className={
            currency === c
              ? "rounded-md bg-slate-900 px-3 py-1 text-xs font-medium text-white"
              : "rounded-md px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900"
          }
        >
          {c === "cny" ? "中文 · ¥" : "English · $"}
        </button>
      ))}
    </div>
  );
}

/**
 * Payment method chooser.
 *
 * Only channels the server reports as live are offered, and only when they can
 * settle the selected currency. When nothing is live the form falls back to the
 * manual path and says so, rather than rendering a control that cannot work.
 */
function PaymentMethodPicker({
  channels,
  method,
  onChange,
  currency,
}: {
  channels: { id: string; label: Record<string, string>; live: boolean }[];
  method: string;
  onChange: (m: "alipay" | "wechat" | "") => void;
  currency: Currency;
}) {
  const usable = channels.filter(
    (c) => c.live && (currency === "cny" || c.id !== "alipay")
  );

  if (usable.length === 0) {
    return (
      <div className="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
        <p>
          在线支付尚未开通。你可以先提交订单，线下转账并备注订单号，我们人工核对到账后开通。
          {currency === "usd" && "（美元订单需人工开票，支付宝只结算人民币。）"}
        </p>
        <PaymentDetails lang={currency === "usd" ? "en" : "zh"} />
      </div>
    );
  }

  return (
    <div className="mt-4">
      <span className="text-sm font-medium text-slate-700">支付方式</span>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {usable.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={method === c.id}
            onClick={() => onChange(c.id as "alipay" | "wechat")}
            className={
              method === c.id
                ? "rounded-lg border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
                : "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:border-slate-900"
            }
          >
            {c.label[currency] || c.label.en || c.id}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SubOrder({ initialCurrency = "cny" }: { initialCurrency?: Currency }) {
  const [currency, setCurrency] = useState<Currency>(initialCurrency);
  const [plan, setPlan] = useState<PlanId>("yearly");
  const [email, setEmail] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [channels, setChannels] = useState<
    { id: string; label: Record<string, string>; live: boolean }[]
  >([]);
  const [method, setMethod] = useState<"alipay" | "wechat" | "">("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "err">("idle");
  const [result, setResult] = useState<{
    orderId: string;
    price: number;
    months: number;
    manual: boolean;
    onlineCheckoutAvailable: boolean;
    nextStep: string;
    paymentUrl?: string;
  } | null>(null);
  const [err, setErr] = useState("");

  // Channel availability is server truth, not a hardcoded assumption. Until
  // this resolves we show no payment choices rather than guessing.
  useEffect(() => {
    let alive = true;
    fetch("/api/payments")
      .then((r) => r.json())
      .then((j) => {
        if (alive && Array.isArray(j.channels)) setChannels(j.channels);
      })
      .catch(() => {
        if (alive) setChannels([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  // A channel that cannot settle the selected currency is not offered. Alipay
  // settles CNY only, so switching to USD must not leave a ¥-only option
  // selected.
  useEffect(() => {
    const usable = channels.filter(
      (c) => c.live && (currency === "cny" || c.id !== "alipay")
    );
    if (!usable.some((c) => c.id === method)) {
      setMethod(usable.length === 1 ? (usable[0].id as "alipay" | "wechat") : "");
    }
  }, [channels, currency, method]);

  const submit = async () => {
    setState("busy");
    setErr("");
    try {
      const r = await fetch("/api/sub-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, siteUrl, plan, currency, paymentMethod: method || undefined }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) {
        setErr(j.error || "提交失败，请重试。");
        setState("err");
        return;
      }
      setResult(j);
      setState("done");

      // Only follow a checkout url the server actually returned for a live
      // channel. Anything else stays on the confirmation step.
      if (j.paymentUrl && typeof j.paymentUrl === "string" && j.manual === false) {
        window.location.assign(j.paymentUrl);
      }
    } catch {
      setErr("网络错误，请重试。");
      setState("err");
    }
  };

  const active = PLANS[plan];
  const freeCopy = FREE_TIER_COPY[currency];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">订阅</h3>
        <CurrencyToggle currency={currency} onChange={setCurrency} />
      </div>

      {/* Free tier */}
      <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3">
        <p className="font-semibold text-emerald-900">{freeCopy.headline}</p>
        <p className="mt-1 text-sm leading-relaxed text-emerald-800">{freeCopy.detail}</p>
        <p className="mt-1 text-xs text-emerald-700">{freeCopy.limit}</p>
      </div>

      {/* Plans */}
      <div className="mt-5 space-y-2" role="radiogroup" aria-label="订阅档位">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const selected = plan === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPlan(id)}
              className={
                selected
                  ? "flex w-full items-baseline justify-between rounded-xl border-2 border-slate-900 bg-slate-50 px-4 py-3 text-left"
                  : "flex w-full items-baseline justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-slate-400"
              }
            >
              <span>
                <span className="font-medium text-slate-900">{p.label[currency]}</span>
                <span className="ml-2 text-xs text-slate-500">
                  {currency === "cny" ? `每季 ¥${p.monthlyEquivalent.cny}/月` : `$${p.monthlyEquivalent.usd}/mo`}
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">{p.blurb[currency]}</span>
              </span>
              <span className="ml-3 shrink-0 text-lg font-bold text-slate-900">
                {formatPrice(p.price[currency], currency)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Referral programme */}
      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="font-semibold text-slate-900">{REWARD_PROGRAM_NOTE[currency].title}</h4>
        <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
          {REWARD_ROWS.map((r) => (
            <li key={r.id}>
              • {r.label[currency]}
              <span className="text-slate-500">（{r.grantMonths} 个月额度）</span>
            </li>
          ))}
        </ul>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-medium text-slate-600">
            规则细节
          </summary>
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-500">
            {REWARD_PROGRAM_NOTE[currency].items.map((i) => (
              <li key={i}>• {i}</li>
            ))}
          </ul>
        </details>
      </div>

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

        <PaymentMethodPicker
          channels={channels}
          method={method}
          onChange={setMethod}
          currency={currency}
        />

        <button
          type="button"
          disabled={state === "busy"}
          onClick={submit}
          className="mt-5 w-full rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {state === "busy"
            ? "提交中…"
            : method
              ? currency === "cny"
                ? `用${method === "alipay" ? "支付宝" : "微信"}支付 ${formatPrice(active.price.cny, "cny")}`
                : `Subscribe ${active.label.usd} — ${formatPrice(active.price.usd, "usd")}`
              : currency === "cny"
                ? `订阅 ${active.label.cny} — ${formatPrice(active.price.cny, "cny")}`
                : `Subscribe ${active.label.usd} — ${formatPrice(active.price.usd, "usd")}`}
        </button>

        {state === "done" && result && (
          <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <p className="font-semibold">订单已记录：{result.orderId}</p>
            <p className="mt-1">
              {formatPrice(result.price, currency)} / {result.months} 个月
            </p>
            <p className="mt-1">{result.nextStep}</p>
            {!result.onlineCheckoutAvailable && (
              <div className="mt-2 text-xs text-emerald-700">
                <p>在线支付通道尚未全部开通。付款由我们人工核对到账后开通，不会自动到账。</p>
                <PaymentDetails orderId={result.orderId} />
              </div>
            )}
          </div>
        )}
        {state === "err" && (
          <p className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</p>
        )}

        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          订阅只报告可读性分数的变化，不预测也不承诺任何模型输出排名。
          随时可停；已生效周期不退。
        </p>
      </div>
    </div>
  );
}
