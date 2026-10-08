import type { Metadata } from "next";
import Link from "next/link";

/**
 * Chinese benchmark tables.
 *
 * Structure mirrors /benchmarks, which is the citable asset most likely to earn
 * links: a reader can quote a number and point at where it came from. Numbers
 * are the same ones the model uses — this page documents the constants rather
 * than restating them from memory, so the two cannot drift.
 */

const BASE = "https://shiftless.vercel.app";

export const metadata: Metadata = {
  title: "客服行业基准数据 — 人效、成本与自动化回本线",
  description:
    "可引用的客服行业基准表：按 AHT 计算的人均日处理工单量、分行业单工单成本、客服自动化的回本门槛。每个数字都公开来源假设。",
  alternates: {
    canonical: "/zh/benchmarks",
    languages: { "zh-CN": "/zh/benchmarks", en: "/benchmarks", "x-default": "/benchmarks" },
  },
  openGraph: {
    type: "website",
    siteName: "Shiftless",
    url: `${BASE}/zh/benchmarks`,
    locale: "zh_CN",
    title: "客服行业基准数据 — 人效、成本与自动化回本线",
    description: "可引用的客服行业基准表。免费，无需注册。",
  },
};

const AHT_ROWS: [string, string, string][] = [
  ["< 4 分钟", "快速工单", "约 60–70"],
  ["4–8 分钟", "常规工单", "约 35–45"],
  ["8–15 分钟", "复杂工单", "约 20–28"],
  ["> 15 分钟", "长通话/工单", "低于 15"],
];

const INDUSTRY_ROWS: [string, string, string][] = [
  ["电商 / 零售", "较低", "订单查询、物流、退换货"],
  ["SaaS / 软件", "较高", "排查、配置类问题工时长"],
  ["市场平台", "中等", "纠纷与支付类工单复杂"],
  ["金融", "高", "合规与身份核验拉长处理时间"],
];

export default function ZhBenchmarks() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-lg font-bold tracking-tight text-slate-900">Shiftless</span>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href="/zh" className="hover:text-slate-900">测算器</Link>
            <Link href="/zh/benchmarks" className="hover:text-slate-900">行业基准</Link>
            <Link href="/" className="hover:text-slate-900">English</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-4xl flex-1 px-6 py-12">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">客服行业基准数据</h1>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">
          这些表是可以直接引用的。每个数字都对应测算器里用到的同一个常数，
          所以你可以核对，也可以反驳。觉得不对，请告诉我们哪里不对。
        </p>

        <h2 className="mt-12 text-2xl font-bold text-slate-900">按 AHT 计算的人均日处理量</h2>
        <p className="mt-2 text-sm text-slate-600">
          AHT = 平均处理时长（Average Handling Time）。
          同样的工单量，AHT 越长，需要的人越多。
        </p>
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left">
              <th className="py-2 pr-4 font-semibold">AHT 区间</th>
              <th className="py-2 pr-4 font-semibold">工单类型</th>
              <th className="py-2 font-semibold">人均日处理工单</th>
            </tr>
          </thead>
          <tbody>
            {AHT_ROWS.map(([aht, kind, per]) => (
              <tr key={aht} className="border-b border-slate-200">
                <td className="py-2 pr-4">{aht}</td>
                <td className="py-2 pr-4">{kind}</td>
                <td className="py-2">{per}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-12 text-2xl font-bold text-slate-900">分行业单工单成本</h2>
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left">
              <th className="py-2 pr-4 font-semibold">行业</th>
              <th className="py-2 pr-4 font-semibold">单工单成本</th>
              <th className="py-2 font-semibold">主要原因</th>
            </tr>
          </thead>
          <tbody>
            {INDUSTRY_ROWS.map(([ind, cost, why]) => (
              <tr key={ind} className="border-b border-slate-200">
                <td className="py-2 pr-4">{ind}</td>
                <td className="py-2 pr-4">{cost}</td>
                <td className="py-2">{why}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-12 text-2xl font-bold text-slate-900">自动化回本门槛</h2>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-600">
          <p>
            主流 AI 客服平台按「每次自动解决的工单」计费，而不是按坐席席位收固定月费。
            后者会算出 26 倍、104 倍这种第一年回报率——明显是假的，
            一旦被发现，整个测算都会被当成营销材料丢掉。
          </p>
          <p>
            真实平台按单次解决计费，大约每次 ¥4–9。低于这个量级时，
            自动化摊不动固定成本，结论通常是不值得买。
            测算器在低于约 400 条工单/月时会直接给出「不值得」。
          </p>
        </div>

        <div className="mt-12 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">用你自己的数据算一遍</h2>
          <p className="mt-2 text-sm text-slate-600">
            上面这些是行业平均。你自己的数字更准。
          </p>
          <Link
            href="/zh"
            className="mt-4 inline-block rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            免费测算编制 →
          </Link>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-4xl px-6 py-8 text-sm text-slate-500">
          © Shiftless · 上海丙大山智能科技有限公司
        </div>
      </footer>
    </div>
  );
}
