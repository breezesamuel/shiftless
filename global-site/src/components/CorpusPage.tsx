import Link from "next/link";
import type { PageSpec } from "@/lib/corpus";
import { fmtMoney, shareUrl, STATE_VERSION } from "@/lib/model";
import { INDUSTRY_EDITORIAL, industryLabel, bandLabel, relatedPages } from "@/lib/corpus";
import { CorpusLeadCta } from "@/components/CorpusLeadCta";
import { RefLink } from "@/components/RefLink";

/**
 * One programmatic page, rendered from real model output.
 *
 * The substance of every page is the numbers, and those come from `compute()`
 * for that page's exact inputs. There is no filler paragraph that is the same
 * on every URL: the industry line is the only editorial block, it is hand
 * written per industry, and everything else on the page is a distinct result.
 *
 * Shared by the English and Chinese routes so the two cannot drift apart. If a
 * number is wrong it is wrong identically in both languages, which is the only
 * way this stays trustworthy.
 */

const BASE = "https://shiftless.vercel.app";

const VERDICT_TEXT: Record<string, { en: string; zh: string; tone: string }> = {
  strong: {
    en: "Worth buying",
    zh: "值得买",
    tone: "border-emerald-300 bg-emerald-50 text-emerald-800",
  },
  workable: {
    en: "Workable, with caveats",
    zh: "可以做，但有前提",
    tone: "border-sky-300 bg-sky-50 text-sky-800",
  },
  marginal: {
    en: "Marginal — probably not",
    zh: "勉强 — 大概率不值得",
    tone: "border-amber-300 bg-amber-50 text-amber-800",
  },
  "not-worth-it": {
    en: "Not worth buying at your volume",
    zh: "以你目前的量级，不值得买",
    tone: "border-rose-300 bg-rose-50 text-rose-800",
  },
};

function money(n: number, en: boolean): string {
  if (en) return fmtMoney(n);
  return `¥${Math.round(n * 7.2).toLocaleString("zh-CN")}`;
}

/**
 * Payback needs three cases, not two.
 *
 * The model returns Infinity — not null — when the investment never pays back,
 * and printing that raw produces "Payback Infinity months". That is the same
 * class of bug as the old `?m=0` publishing Infinity into a public permalink,
 * so it gets the same explicit handling here rather than being stringified.
 */
function paybackText(v: number, en: boolean): string {
  if (!Number.isFinite(v)) return en ? "never pays back" : "永不回本";
  return en ? `${v} months` : `${v} 个月`;
}

function agentsText(n: number, en: boolean): string {
  if (en) return `${n} agent${n === 1 ? "" : "s"}`;
  return `${n} 人`;
}

export function CorpusPage({ spec, lang }: { spec: PageSpec; lang: "en" | "zh" }) {
  const en = lang === "en";
  const { industry, volume, band, aht, scenario, inputs, output } = spec;
  const editorial = INDUSTRY_EDITORIAL[industry.slug];
  const verdict = VERDICT_TEXT[output.verdict];

  const title = en
    ? `${industryLabel(industry.slug, true)} support team: ${agentsText(output.agentsNeeded, true)} for ${volume.toLocaleString("en-US")} tickets/month`
    : `${industryLabel(industry.slug, false)}客服团队：每月 ${volume.toLocaleString("zh-CN")} 条工单需要 ${output.agentsNeeded} 人`;

  // Carry this page's exact inputs into the calculator so the reader can move
  // their own numbers rather than only reading ours.
  const permalink = shareUrl(inputs, BASE);

  // The internal-link mesh: nearest sibling pages, so a crawler that lands
  // anywhere can walk the whole corpus instead of hitting one dead end.
  const related = relatedPages(spec, 5);
  const relatedHref = (p: PageSpec) =>
    en
      ? `/roi/${p.industry.slug}/${p.band.slug}/${p.volume}/${p.aht.slug}/${p.scenario.slug}`
      : `/zh/roi/${p.industry.slug}/${p.band.slug}/${p.volume}/${p.aht.slug}/${p.scenario.slug}`;
  const relatedLabel = (p: PageSpec) =>
    `${p.volume.toLocaleString(en ? "en-US" : "zh-CN")} ${en ? "tickets/mo" : "条工单/月"} · ${en ? p.aht.en : p.aht.zh} AHT · ${en ? p.scenario.en : p.scenario.zh}`;
  const hubHref = en
    ? `/roi/industry/${industry.slug}`
    : `/zh/roi/industry/${industry.slug}`;

  return (
    <div className="flex min-h-screen flex-col">
      {/* hreflang is declared in generateMetadata (alternates.languages). A manual
          <head> here used to shadow it into the body, where it is ignored. */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <span className="text-lg font-bold tracking-tight text-slate-900">Shiftless</span>
          <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
            <Link href={en ? "/benchmarks" : "/zh/benchmarks"} className="hover:text-slate-900">
              {en ? "Benchmarks" : "行业基准"}
            </Link>
            <Link href={en ? "/" : "/zh"} className="hover:text-slate-900">
              {en ? "Calculator" : "测算器"}
            </Link>
            <Link href={en ? "/zh" : "/"} className="hover:text-slate-900">
              {en ? "中文" : "English"}
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <p className="text-sm font-medium text-slate-500">
          <Link href={hubHref} className="hover:text-slate-900">
            {industryLabel(industry.slug, en)}
          </Link>{" "}
          · {bandLabel(band.slug, en)} ·{" "}
          {volume.toLocaleString(en ? "en-US" : "zh-CN")}{" "}
          {en ? "tickets/mo" : "条工单/月"} · {en ? aht.en : aht.zh} AHT ·{" "}
          {en ? scenario.en : scenario.zh}
        </p>

        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
          {title}
        </h1>

        <p className="mt-4 text-lg leading-relaxed text-slate-600">{editorial[lang]}</p>

        {/* The verdict leads, because refusing to sell is the point of this tool. */}
        <div className={`mt-6 rounded-lg border px-5 py-4 ${verdict.tone}`}>
          <p className="text-sm font-semibold uppercase tracking-wide">
            {en ? "Verdict" : "结论"}: {verdict[lang]}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {(en ? output.reasons : output.reasonsZh).map((r, i) => (
              <li key={i}>
                {r}
              </li>
            ))}
          </ul>
        </div>

        {/* The numbers. Every figure is specific to this combination. */}
        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          <Stat
            label={en ? "Agents needed" : "需要客服人数"}
            value={String(output.agentsNeeded)}
            sub={
              en
                ? `range ${output.agentsRange[0]}–${output.agentsRange[1]}`
                : `区间 ${output.agentsRange[0]}–${output.agentsRange[1]}`
            }
          />
          <Stat
            label={en ? "Monthly labour cost" : "每月人力成本"}
            value={money(output.monthlyLaborCost, en)}
            sub={money(output.monthlyLaborCostRange[0], en) + " – " + money(output.monthlyLaborCostRange[1], en)}
          />
          <Stat
            label={en ? "Heads removable via automation" : "自动化后可减少人数"}
            value={String(output.headsRemoved)}
            sub={
              en
                ? `${agentsText(output.agentsAfterAutomation, true)} remain`
                : `保留 ${output.agentsAfterAutomation} 人`
            }
          />
          <Stat
            label={en ? "Net monthly effect" : "每月净效果"}
            value={money(output.monthlyNetEffect, en)}
            sub={
              en
                ? `platform cost ${money(output.monthlyPlatformCost, en)}/mo`
                : `平台成本 ${money(output.monthlyPlatformCost, en)}/月`
            }
          />
          <Stat
            label={en ? "Payback" : "回本周期"}
            value={paybackText(output.paybackMonths, en)}
            sub={en ? "at this volume" : "以当前量级"}
          />
          <Stat
            label={en ? "Year-one cash effect" : "首年现金影响"}
            value={money(output.yearOneNetCash, en)}
            sub={en ? "including setup and severance" : "含部署与补偿成本"}
          />
        </dl>

        {/* The pages search engines land on. Same gating as the calculator:
            never offer a contact form on a page whose honest answer is
            don't-buy. */}
        {output.verdict === "strong" || output.verdict === "workable" ? (
          <CorpusLeadCta
            lang={lang}
            payload={{
              monthlyTickets: inputs.monthlyTickets,
              ahtMinutes: inputs.ahtMinutes,
              loadedCostPerHour: inputs.loadedCostPerHour,
              channel: industry.slug,
              industry: industry.slug,
              band: band.slug,
              volume,
              scenario: scenario.slug,
              agentsRange: `${output.agentsRange[0]}-${output.agentsRange[1]}`,
              monthlyNetEffect: Math.round(output.monthlyNetEffect),
              paybackMonths: Number.isFinite(output.paybackMonths)
                ? Number(output.paybackMonths.toFixed(1))
                : null,
              yearOneRoi: Number(output.yearOneRoi.toFixed(2)),
              verdict: output.verdict,
            }}
          />
        ) : null}

        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
          <h2 className="font-semibold text-slate-900">
            {en ? "Put your own numbers in" : "换成你自己的数据算"}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {en
              ? "These figures come from one assumed volume. Change the ticket count, AHT or cost per hour and the answer moves."
              : "上面的数字基于一组假设。换掉工单量、AHT 或人力成本，结论就会变。"}
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <RefLink
              href={permalink}
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              {en ? "Open with these numbers" : "按这组数据打开测算器"}
            </RefLink>
            <Link
              href={en ? "/methodology" : "/zh"}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {en ? "Every constant published" : "查看全部常数"}
            </Link>
          </div>
        </div>

        {/* The internal-link mesh. Every page links to its closest neighbours,
            so a crawler that enters anywhere can walk the whole corpus. */}
        {related.length > 0 && (
          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6">
            <h2 className="font-semibold text-slate-900">
              {en ? "Related scenarios" : "相邻场景"}
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {en
                ? "The answer changes as volume, handle time and coverage move. These are the closest combinations worth comparing against."
                : "改变量级、处理时长或覆盖率，结论会跟着变。以下是最值得对比的相邻组合。"}
            </p>
            <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              {related.map((p) => (
                <li key={`${p.industry.slug}-${p.band.slug}-${p.volume}-${p.aht.slug}-${p.scenario.slug}`}>
                  <Link
                    href={relatedHref(p)}
                    className="block rounded-lg border border-slate-200 px-3 py-2 text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                  >
                    {relatedLabel(p)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-8 text-xs text-slate-400">
          {en
            ? `Model ${STATE_VERSION}. Figures are estimates from published benchmarks, not a quote.`
            : `模型 ${STATE_VERSION}。数字来自公开基准的估算，不是报价。`}
        </p>
      </main>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-bold text-slate-900">{value}</dd>
      <dd className="mt-1 text-xs text-slate-500">{sub}</dd>
    </div>
  );
}
