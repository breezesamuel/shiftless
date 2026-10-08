import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildCorpus, industryLabel, bandLabel } from "@/lib/corpus";

export const dynamicParams = false;

function pagesFor(slug: string) {
  return buildCorpus().pages.filter((p) => p.industry.slug === slug);
}

export function generateStaticParams() {
  return Array.from(
    new Map(buildCorpus().pages.map((p) => [p.industry.slug, p])).keys()
  ).map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const rows = pagesFor(params.slug);
  if (rows.length === 0) return {};
  return {
    title: `${industryLabel(params.slug, true)} support headcount and automation ROI`,
    alternates: {
      canonical: `/roi/industry/${params.slug}`,
      languages: { en: `/roi/industry/${params.slug}`, "zh-CN": `/zh/roi/industry/${params.slug}`, "x-default": `/roi/industry/${params.slug}` },
    },
  };
}

export default function IndustryIndex({ params }: { params: { slug: string } }) {
  const rows = pagesFor(params.slug);
  if (rows.length === 0) notFound();
  return (
    <div className="flex min-h-screen flex-col">
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <p className="text-sm text-slate-500"><Link href="/roi" className="hover:text-slate-900">← All industries</Link></p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
          {industryLabel(params.slug, true)}
        </h1>
        <p className="mt-2 text-slate-600">{rows.length} modelled scenarios.</p>
        <ul className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p) => (
            <li key={`${p.band.slug}-${p.volume}-${p.aht.slug}-${p.scenario.slug}`}>
              <Link
                href={`/roi/${p.industry.slug}/${p.band.slug}/${p.volume}/${p.aht.slug}/${p.scenario.slug}`}
                className="block rounded border border-slate-200 bg-white px-3 py-2 text-sm hover:border-slate-400"
              >
                <span className="font-medium text-slate-900">
                  {p.output.agentsNeeded} agent{p.output.agentsNeeded === 1 ? "" : "s"}
                </span>{" "}
                <span className="text-slate-500">
                  · {p.volume.toLocaleString("en-US")}/mo · {bandLabel(p.band.slug, true)}
                </span>
                {p.output.verdict === "not-worth-it" && (
                  <span className="ml-1 text-xs text-rose-600">(not worth it)</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
