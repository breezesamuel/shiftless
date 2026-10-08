import type { Metadata } from "next";

import { SubOrder } from "@/components/SubOrder";
import { paymentChannels, anyChannelLive } from "@/lib/payments";
import { PLANS, PLAN_ORDER, FREE_TIER_COPY, formatPrice } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "订阅 AI 可见度审计 — 10 次免费起步",
  description:
    "10 次免费审计起步。按月 ¥60 / $9.9，按季 ¥150 / $25，按年 ¥500 / $99。推荐付费用户可获赠额度。不卖排名，只报告可复现的变化。",
  robots: { index: false, follow: false },
};

/**
 * Pricing is rendered server-side from the same table the order endpoint
 * charges from, so what this page shows and what the customer is billed
 * cannot drift apart.
 */

export default function GeoSubscribePage() {
  const channels = paymentChannels();
  const onlineLive = anyChannelLive();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-lg font-bold tracking-tight text-slate-900">
            AI 可见度审计
          </span>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="/geo" className="hover:text-slate-900">单次报告</a>
            <a href="#pricing" className="hover:text-slate-900">价格</a>
            <a href="#referral" className="hover:text-slate-900">推荐奖励</a>
            <a href="#order" className="hover:text-slate-900">订阅</a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Pricing */}
        <section id="pricing" className="mx-auto max-w-6xl px-6 py-12">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            10 次免费起步，之后按月或按年订阅。
          </h1>
          <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-600">
            免费额度覆盖单页审计和 11 项可读性检查。订阅多出来的是季度对比与变化曲线——
            一次审计是一张快照，订阅给你的是一条曲线。
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {PLAN_ORDER.map((id) => {
              const p = PLANS[id];
              return (
                <div
                  key={id}
                  className={
                    id === "yearly"
                      ? "rounded-2xl border-2 border-slate-900 bg-white p-6"
                      : "rounded-2xl border border-slate-200 bg-white p-6"
                  }
                >
                  {id === "yearly" && (
                    <div className="text-xs font-semibold tracking-wide text-slate-900">
                      推荐
                    </div>
                  )}
                  <div className="mt-1 flex items-baseline gap-2">
                    <h2 className="font-semibold text-slate-900">
                      {p.label.cny} / {p.label.usd}
                    </h2>
                  </div>
                  <div className="mt-3 space-y-1">
                    <p className="text-2xl font-bold text-slate-900">
                      {formatPrice(p.price.cny, "cny")}
                      <span className="ml-2 text-base font-medium text-slate-500">
                        / {p.months} 个月
                      </span>
                    </p>
                    <p className="text-2xl font-bold text-slate-900">
                      {formatPrice(p.price.usd, "usd")}
                      <span className="ml-2 text-base font-medium text-slate-500">
                        / {p.months} months
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">
                      折合每月 {formatPrice(p.monthlyEquivalent.cny, "cny")} /{" "}
                      {formatPrice(p.monthlyEquivalent.usd, "usd")}
                    </p>
                  </div>
                  <ul className="mt-4 space-y-1.5 text-sm text-slate-600">
                    <li>• 官网根页 + 关键页面审计</li>
                    <li>• 与上一周期逐项对比</li>
                    <li>• 分数曲线与回归提醒</li>
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <p className="font-semibold text-emerald-900">
              {FREE_TIER_COPY.cny.headline}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-emerald-800">
              {FREE_TIER_COPY.cny.detail}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-emerald-800">
              <span className="font-medium">English:</span> {FREE_TIER_COPY.usd.detail}
            </p>
          </div>
        </section>

        {/* Referral */}
        <section id="referral" className="border-t border-slate-200 bg-white py-12">
          <div className="mx-auto max-w-4xl px-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">推荐奖励</h2>
            <p className="mt-2 text-slate-600">
              推荐朋友订阅，按他实际付款的深度计奖。以下规则写明在页面上，不含糊。
            </p>
            <div className="mt-6 space-y-3">
              {[
                { c: "1 位付费满 1 个月 → 赠 1 个月", e: "1 referral paid 1+ month → +1 month" },
                {
                  c: "3 位各付满 1 个季度 → 赠 3 个月",
                  e: "3 referrals each paid a quarter → +3 months",
                },
                { c: "10 位各付满 1 年 → 赠 1 年", e: "10 referrals each paid a year → +1 year" },
              ].map((r) => (
                <div
                  key={r.c}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 px-5 py-4"
                >
                  <span className="font-medium text-slate-900">{r.c}</span>
                  <span className="text-sm text-slate-500">{r.e}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Order */}
        <section id="order" className="border-t border-slate-200 bg-slate-50 py-12">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-6 lg:grid-cols-2">
              <SubOrder />

              <div className="space-y-4">
                {/* Payment channels, rendered from live server config */}
                <div className="rounded-2xl border border-slate-200 bg-white p-6">
                  <h3 className="font-semibold text-slate-900">支付方式</h3>
                  <ul className="mt-3 space-y-3">
                    {channels.map((c) => (
                      <li key={c.id} className="text-sm">
                        <div className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className={
                              c.live
                                ? "inline-block h-2 w-2 rounded-full bg-emerald-500"
                                : "inline-block h-2 w-2 rounded-full bg-slate-300"
                            }
                          />
                          <span className="font-medium text-slate-900">
                            {c.label.cny} / {c.label.usd}
                          </span>
                          <span
                            className={
                              c.live
                                ? "text-xs text-emerald-700"
                                : "text-xs text-slate-500"
                            }
                          >
                            {c.live ? "已开通" : "开通中"}
                          </span>
                        </div>
                        <p className="mt-1 pl-4 text-xs leading-relaxed text-slate-500">
                          {c.blockedOn || c.customerMessage.cny}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                    微信支付与支付宝是两套独立的清算体系：走微信付的钱结算到微信商户账户，
                    走支付宝付的钱结算到支付宝账户，无法互相转入。
                    {onlineLive
                      ? "已开通的通道会在付款确认后自动开通订阅。"
                      : "当前在线通道尚未全部开通，付款由我们人工核对到账后开通。"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-relaxed text-slate-600">
                  <h3 className="text-lg font-semibold text-slate-900">先看样板再决定</h3>
                  <p className="mt-3">
                    我们公开吉客云 35/100、卖家精灵 52/100 的一页样板，测评项、权重、扣分理由
                    都写在里面，不藏。
                  </p>
                  <p className="mt-3">
                    取消：随时书面通知下期不续即可，无违约条款。已生效周期不退。
                  </p>
                  <a
                    href="/geo"
                    className="mt-4 inline-block rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
                  >
                    改看单次报告（¥1999 / $299）
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-8 text-center text-xs text-slate-500">
        我们测量的是输入侧可读性，并如实报告分数变化；不预测、不承诺任何模型输出排名。
      </footer>
    </div>
  );
}
