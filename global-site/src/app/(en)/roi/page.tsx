import type { Metadata } from "next";
import Link from "next/link";
import { buildCorpus, INDUSTRIES, industryLabel } from "@/lib/corpus";

/**
 * Hub for the programmatic set.
 *
 * These pages are not orphans: without an internal link path a crawler has no
 * way to reach the deep routes from the homepage. This page indexes every
 * industry, and each industry index page lists that industry's scenarios, so
 * the page weight stays bounded instead of shipping thousands of links in one
 * document.
 */

export const metadata: Metadata = {
  title: "Support Team ROI by Industry and Team Size",
  description:
    "Modelled support headcount, labour cost and AI automation payback for every combination of industry, team size, ticket volume, AHT and automation coverage. Every figure is computed, not estimated by hand.",
  alternates: {
    canonical: "/roi",
    languages: { en: "/roi", "zh-CN": "/zh/roi", "x-default": "/roi" },
  },
};

export default function RoiIndex() {
  const { pages, examined, dedupedAway, noindex } = buildCorpus();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
          <span className="text-lg font-bold tracking-tight text-slate-900">Shiftless</span>
          <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
            <Link href="/roi" className="hover:text-slate-900">ROI pages</Link>
            <Link href="/zh/roi" className="hover:text-slate-900">中文</Link>
            <Link href="/" className="hover:text-slate-900">Calculator</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Support headcount and automation ROI, by industry
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-slate-600">
          Every page below is one combination of industry, team size, monthly ticket
          volume, average handling time and how much of the theoretical ceiling you
          actually automate. The figures are computed from the same model that powers
          the calculator, not written by hand.
        </p>

        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
          <p>
            <strong className="text-slate-900">{pages.length}</strong> published pages.{" "}
            {noindex} of them are served <code className="text-xs">noindex</code> because
            the model's answer is &ldquo;automation is not worth buying at this volume&rdquo; —
            the honest answer still gets a URL, it just does not compete for one.
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {examined.toLocaleString("en-US")} combinations were examined;{" "}
            {dedupedAway} were discarded because their output was identical to an earlier
            page. Two URLs with the same numbers are one page, not two.
          </p>
        </div>

        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {INDUSTRIES.map((industry) => {
            const rows = pages.filter((p) => p.industry.slug === industry.slug);
            if (rows.length === 0) return null;
            return (
              <Link
                key={industry.slug}
                href={`/roi/industry/${industry.slug}`}
                className="rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-400"
              >
                <h2 className="text-base font-semibold text-slate-900">
                  {industryLabel(industry.slug, true)}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{rows.length} pages</p>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
