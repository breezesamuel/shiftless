import Link from "next/link";
import { SITE_URL } from "@/lib/site";
import {
  SUITE_CATEGORIES,
  SUITE_TOOLS,
  type SuiteTool,
} from "@/lib/suite";

/**
 * The consolidation hub: one page that fronts every surviving product.
 *
 * It exists because the products used to be scattered across independent Vercel
 * projects with no shared entry point. The hub links out to each product's own
 * domain — it never inlines their content — so each tool keeps its own pricing,
 * checkout and analytics, and this page stays genuinely differentiated rather
 * than a paste of other pages.
 *
 * Rendered for both languages from one component so the list can never drift
 * between /tools and /zh/tools.
 */
export function SuiteDirectory({ lang }: { lang: "en" | "zh" }) {
  const zh = lang === "zh";
  const home = zh ? "/zh" : "/";
  const benchmarks = zh ? "/zh/benchmarks" : "/benchmarks";
  const toolsPath = zh ? "/zh/tools" : "/tools";

  const groups = SUITE_CATEGORIES.map((c) => ({
    ...c,
    tools: SUITE_TOOLS.filter((t) => t.category === c.id),
  })).filter((g) => g.tools.length > 0);

  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: zh ? "丙大山工具矩阵" : "Bingdashan Tools",
    numberOfItems: SUITE_TOOLS.length,
    itemListElement: SUITE_TOOLS.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: zh ? t.nameZh : t.name,
      url: t.url,
    })),
  };

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(itemList).replace(/</g, "\\u003c"),
        }}
      />

      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href={home} className="text-lg font-bold tracking-tight text-slate-900">
            Shiftless
          </Link>
          <nav className="flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link href={home} className="hover:text-slate-900">
              {zh ? "测算器" : "Calculator"}
            </Link>
            <Link href={benchmarks} className="hover:text-slate-900">
              {zh ? "行业基准" : "Benchmarks"}
            </Link>
            <Link href="/geo" className="hover:text-slate-900">
              {zh ? "AI 可见度体检" : "AI Visibility Audit"}
            </Link>
            <Link href={zh ? "/tools" : "/zh/tools"} className="hover:text-slate-900">
              {zh ? "EN" : "中文"}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 py-12">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {zh ? "丙大山智能科技" : "Bingdashan Intelligent Technology"}
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
              {zh ? "一个入口，一组工具" : "One front door, a suite of tools"}
            </h1>
            <p className="mt-4 text-lg leading-relaxed text-slate-600">
              {zh
                ? "这些是上海丙大山智能科技有限公司自研并独立运营的工具。每一款都保留自己的定价、结算与客服，这里只做入口和索引 —— 不搬运任何工具内的内容。"
                : "These are tools built and run in-house by Shanghai Bingdashan Intelligent Technology Co., Ltd. Each keeps its own pricing, checkout and support; this page is only the entry point and index — it does not copy any product's content."}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              {zh
                ? "部分工具是早期实验，页面会如实标注；标注「实验性」的请自行判断，不要当作承诺。"
                : "Some are early experiments and are labelled as such. Treat anything marked \"experimental\" as a work in progress, not a promise."}
            </p>
          </div>
        </section>

        {groups.map((g) => (
          <section key={g.id} className="border-t border-slate-200 bg-white py-12">
            <div className="mx-auto max-w-6xl px-6">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                {zh ? g.labelZh : g.label}
              </h2>
              <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {g.tools.map((t) => (
                  <ToolCard key={t.id} tool={t} zh={zh} />
                ))}
              </div>
            </div>
          </section>
        ))}

        <section className="border-t border-slate-200 bg-slate-50 py-12">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              {zh ? "为什么把这些放在一起？" : "Why are these listed together?"}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {zh
                ? "它们过去分散在几十个独立部署里，既有重复也有入口割裂。现在同品牌只保留一个正式项目，其余已下线；这个页面把保留下来的工具收拢到一个地方，方便你按需进入。"
                : "They used to live in dozens of separate deployments — duplicated, with no shared entry point. Each brand now keeps a single live project and the rest were retired; this page gathers the survivors in one place so you can reach the one you need."}
            </p>
            <p className="mt-3 text-sm text-slate-600">
              {zh ? (
                <>
                  想先试试主站？{" "}
                  <Link href={home} className="underline">
                    用免费测算器算出你的客服编制
                  </Link>
                  。
                </>
              ) : (
                <>
                  New here? Start with{" "}
                  <Link href={home} className="underline">
                    the free support headcount calculator
                  </Link>
                  .
                </>
              )}
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-8 text-sm text-slate-500">
        <div className="mx-auto max-w-6xl px-6">
          <p>
            {zh
              ? "上海丙大山智能科技有限公司"
              : "Shanghai Bingdashan Intelligent Technology Co., Ltd."}{" "}
            ·{" "}
            <Link href={home} className="underline">
              {zh ? "主站" : "Home"}
            </Link>{" "}
            ·{" "}
            <Link href="/privacy" className="underline">
              {zh ? "隐私" : "Privacy"}
            </Link>
          </p>
          <p className="mt-2">
            {SITE_URL}
            {toolsPath}
          </p>
        </div>
      </footer>
    </div>
  );
}

function ToolCard({ tool, zh }: { tool: SuiteTool; zh: boolean }) {
  const isSelf = tool.id === "shiftless";
  const internalHref = zh ? "/zh" : "/";
  const name = zh ? tool.nameZh : tool.name;
  const tagline = zh ? tool.taglineZh : tool.tagline;
  const price = zh ? tool.priceZh : tool.price;
  const cta = zh ? "打开 →" : "Open →";

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-slate-900 group-hover:underline">{name}</h3>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
          {price}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">{tagline}</p>
      <span className="mt-4 inline-block text-sm font-medium text-slate-900">
        {isSelf ? (zh ? "使用主站工具 →" : "Use the home tool →") : cta}
      </span>
    </>
  );

  if (isSelf) {
    return (
      <Link
        href={internalHref}
        id={tool.id}
        className="group block rounded-xl border border-slate-200 bg-slate-50 p-5 transition hover:border-slate-300 hover:shadow-sm"
      >
        {inner}
      </Link>
    );
  }

  return (
    <a
      id={tool.id}
      href={tool.url}
      target="_blank"
      rel="noopener"
      className="group block rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 hover:shadow-sm"
    >
      {inner}
    </a>
  );
}
