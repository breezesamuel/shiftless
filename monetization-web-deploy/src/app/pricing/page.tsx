import type { Metadata } from "next";
import Link from "next/link";
import {
  AGENTS, SETUP, DISCOUNTS, discountFor, CONTACT, quote, AgentKey, SetupKey, MIN_SEATS_FOR_SALE,
} from "@/lib/pricing";
import { ArrowRight, CheckCircle2, AlertTriangle } from "lucide-react";

export const metadata: Metadata = {
  title: "价格与方案 · AI 数字员工订阅与私有化部署",
  description:
    "AI 数字员工按席位订阅价目表：AI 销售员/客服员/运营员/财务员/招聘员，含概念验证 POC、系统集成、定制流程与私有化部署一次性费用。",
  keywords: ["AI数字员工价格", "AI客服价格", "私有化部署报价", "AI员工订阅", "POC费用"],
  openGraph: {
    title: "价格与方案 · AI 数字员工",
    description: "按席位订阅 + 一次性实施费，公开价目表与折扣阶梯",
    type: "website",
  },
};

const fmt = (n: number) => "¥" + Math.round(n).toLocaleString("zh-CN");

const SCALE_ROWS: [number, AgentKey, SetupKey][] = [
  [1, "customer_service", "integration"],
  [3, "customer_service", "integration"],
  [5, "customer_service", "integration"],
  [10, "customer_service", "integration"],
  [20, "customer_service", "integration"],
  [50, "customer_service", "integration"],
  [100, "customer_service", "integration"],
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl px-6 py-14">
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            价格与方案
          </h1>
          <p className="mt-3 max-w-2xl text-gray-600 dark:text-gray-300">
            按席位订阅 + 一次性实施费。以下为公开价目表，与线上 ROI 测算器口径完全一致，
            不含任何签章，正式合同以双方签署盖章件为准。
          </p>
        </header>

        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">一、席位订阅价（按岗位）</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">岗位</th>
                  <th className="px-4 py-3 text-right font-semibold">AI 月费/席</th>
                  <th className="px-4 py-3 text-right font-semibold">对标人工月薪</th>
                  <th className="px-4 py-3 text-right font-semibold">单席年省</th>
                  <th className="px-4 py-3 text-right font-semibold">3 席投入产出</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(AGENTS).map(([k, a]) => {
                  const q1 = quote(k as AgentKey, 1, "integration");
                  const q3 = quote(k as AgentKey, 3, "integration");
                  return (
                    <tr key={k} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{a.label}</td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(a.price)}</td>
                      <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                        {fmt(a.human)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(q1.saving)}</td>
                      <td className="px-4 py-3 text-right font-mono text-primary-600 dark:text-primary-400">
                        {q3.roi.toFixed(2)}x
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            上表「单席年省」为 1 席口径；「3 席投入产出」= 3 席年省 ÷（3 席年费 + ¥50,000 实施费），
            是可对外报的数字。单席数字不含实施费摊销，请勿直接对外承诺。
          </p>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">
            二、按规模报价（AI 客服员，含系统集成费 ¥50,000）
          </h2>
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <b>1 席不划算</b>：固定实施费摊销不足，投资回报仅 1.05 倍，远低于 3 席的 2.59 倍。
              我们建议 <b>{MIN_SEATS_FOR_SALE} 席起</b>评估；若只需小范围验证，请选下方「概念验证 POC」。
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">席位</th>
                  <th className="px-4 py-3 text-right font-semibold">折扣</th>
                  <th className="px-4 py-3 text-right font-semibold">年费合计</th>
                  <th className="px-4 py-3 text-right font-semibold">首年总投入</th>
                  <th className="px-4 py-3 text-right font-semibold">年省人力</th>
                  <th className="px-4 py-3 text-right font-semibold">ROI</th>
                  <th className="px-4 py-3 text-right font-semibold">回收期</th>
                </tr>
              </thead>
              <tbody>
                {SCALE_ROWS.map(([n, agent, setup]) => {
                  const q = quote(agent, n, setup);
                  return (
                    <tr
                      key={n}
                      className="border-b border-gray-100 last:border-0 dark:border-gray-800"
                    >
                      <td className="px-4 py-3 font-medium">{n} 席</td>
                      <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                        {Math.round(discountFor(n) * 100)} 折
                      </td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(q.annualFee)}</td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(q.firstYear)}</td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(q.saving)}</td>
                      <td
                        className={`px-4 py-3 text-right font-mono ${
                          q.roi >= 2
                            ? "text-primary-600 dark:text-primary-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {q.roi.toFixed(1)}x
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {Math.max(1, Math.round(q.paybackMonths))} 月
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">三、一次性实施费用</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(SETUP).map(([k, v]) => (
              <div
                key={k}
                className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="font-semibold text-gray-900 dark:text-white">{v.label}</div>
                <div className="mt-1 font-mono text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {fmt(v.fee)}
                </div>
                <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">{v.desc}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <h2 className="mb-4 text-xl font-semibold text-gray-900 dark:text-white">四、折扣阶梯</h2>
          <div className="flex flex-wrap gap-3">
            {DISCOUNTS.filter(([t]) => t >= 1)
              .sort((a, b) => a[0] - b[0])
              .map(([threshold, rate]) => (
                <div
                  key={threshold}
                  className="rounded-lg border border-gray-200 bg-white px-5 py-3 text-center dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="text-sm text-gray-500 dark:text-gray-400">{threshold} 席及以上</div>
                  <div className="font-mono text-lg font-bold text-gray-900 dark:text-white">
                    {Math.round(rate * 100)} 折
                  </div>
                </div>
              ))}
          </div>
        </section>

        <section className="mb-12 rounded-xl border border-primary-200 bg-primary-50 p-6 dark:border-primary-900 dark:bg-primary-500/10">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">五、概念验证 POC</h2>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            4 周验证周期，知识库构建 + 系统接入 + 陪跑调优，费用 <b className="font-mono">¥30,000</b>（含税）。
          </p>
          <ul className="mt-4 space-y-2 text-sm text-gray-700 dark:text-gray-300">
            {[
              "知识库 ≥200 条 FAQ，连续 14 天稳定运行",
              "目标场景自动应答率 ≥60%",
              "CSAT ≥4.6/5（抽检 ≥300 条会话）",
              "首响 <5 秒，7×24 覆盖",
              "G1–G3 未达成，POC 费用按 50% 结算",
              "POC 费用可抵扣转正式后的实施费",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" />
                {t}
              </li>
            ))}
          </ul>
        </section>

        <div className="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">准备好了就提交订单</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            提交订单不产生任何费用，顾问将在 1 个工作日内联系确认并发送正式合同与付款指引。
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/order"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-6 py-3 font-medium text-white hover:bg-primary-600"
            >
              提交采购订单 <ArrowRight size={16} />
            </Link>
            <Link
              href="/roi"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 hover:border-primary-400 dark:border-gray-700 dark:text-gray-300"
            >
              先免费测算 ROI
            </Link>
          </div>
          <p className="mt-5 text-sm text-gray-500 dark:text-gray-400">
            或直接联系：微信 <b>{CONTACT.wechat}</b> ｜ 电话 <b>{CONTACT.phone}</b> ｜ 邮箱{" "}
            <b>{CONTACT.email}</b>
          </p>
        </div>
      </div>
    </div>
  );
}
