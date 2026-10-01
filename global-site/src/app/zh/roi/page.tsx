import type { Metadata } from "next";
import Link from "next/link";
import { buildCorpus, INDUSTRIES, industryLabel, bandLabel } from "@/lib/corpus";

export const metadata: Metadata = {
  title: "各行业客服编制与 AI 自动化回本测算",
  description:
    "按行业、团队规模、工单量、AHT 与自动化覆盖率组合出的客服编制、人力成本与回本周期。每个数字都由模型算出，不是手工估的。",
  alternates: {
    canonical: "/zh/roi",
    languages: { en: "/roi", "zh-CN": "/zh/roi", "x-default": "/roi" },
  },
};

export default function ZhRoiIndex() {
  const { pages, examined, dedupedAway, noindex } = buildCorpus();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <span className="text-lg font-bold tracking-tight text-slate-900">Shiftless</span>
          <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
            <Link href="/zh/roi" className="hover:text-slate-900">编制测算</Link>
            <Link href="/roi" className="hover:text-slate-900">English</Link>
            <Link href="/zh" className="hover:text-slate-900">测算器</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          各行业客服编制与自动化回本测算
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-600">
          下面每个页面对应一组组合：行业、团队规模、每月工单量、平均处理时长，以及你实际能自动化的比例。
          所有数字都由测算器背后的同一个模型算出，不是手工估的。
        </p>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p>
            共发布 <strong className="text-slate-900">{pages.length}</strong> 个页面。其中{" "}
            {noindex} 个设为 <code className="text-xs">noindex</code>，因为模型的结论是
            「这个量级不值得上自动化」——诚实的结论仍然值得一个网址，只是不去抢排名。
          </p>
          <p className="mt-2 text-xs text-slate-500">
            共检验 {examined.toLocaleString("zh-CN")} 种组合，其中 {dedupedAway} 种因为输出与前面的页面完全相同而被丢弃。
            数字一模一样的两个网址，是一个页面，不是两个。
          </p>
        </div>

        <div className="mt-10 space-y-10">
          {INDUSTRIES.map((industry) => {
            const rows = pages.filter((p) => p.industry.slug === industry.slug);
            if (rows.length === 0) return null;
            return (
              <section key={industry.slug}>
                <h2 className="text-xl font-bold text-slate-900">
                  {industryLabel(industry.slug, false)}
                  <span className="ml-2 text-sm font-normal text-slate-500">
                    {rows.length} 个页面
                  </span>
                </h2>
                <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((p) => (
                    <li key={`${p.band.slug}-${p.volume}-${p.aht.slug}-${p.scenario.slug}`}>
                      <Link
                        href={`/zh/roi/${p.industry.slug}/${p.band.slug}/${p.volume}/${p.aht.slug}/${p.scenario.slug}`}
                        className="block rounded border border-slate-200 bg-white px-3 py-2 text-sm hover:border-slate-400"
                      >
                        <span className="font-medium text-slate-900">
                          {p.output.agentsNeeded} 人
                        </span>{" "}
                        <span className="text-slate-500">
                          · {p.volume.toLocaleString("zh-CN")}/月 · {bandLabel(p.band.slug, false)}
                        </span>
                        {p.output.verdict === "not-worth-it" && (
                          <span className="ml-1 text-xs text-rose-600">（不值得）</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
