import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildCorpus, INDUSTRIES, HEADCOUNT_BANDS, AHT_VARIANTS, COVERAGE_SCENARIOS } from "@/lib/corpus";
import { CorpusPage } from "@/components/CorpusPage";
import { industryLabel } from "@/lib/corpus";

/**
 * Programmatic ROI pages, English.
 *
 * Every URL is one combination of (industry, team size, volume, AHT, coverage)
 * and carries that combination's own model output. Combinations that would
 * render identical numbers to an earlier page are not published at all, and
 * pages where the model says automation is not worth buying are served noindex
 * rather than deleted — the honest answer still deserves a URL, it just must
 * not compete for one.
 */

export const dynamicParams = false;

function findSpec(
  industry: string,
  band: string,
  volume: string,
  aht: string,
  scenario: string
) {
  return (
    buildCorpus().pages.find(
      (p) =>
        p.industry.slug === industry &&
        p.band.slug === band &&
        String(p.volume) === volume &&
        p.aht.slug === aht &&
        p.scenario.slug === scenario
    ) ?? null
  );
}

export function generateStaticParams() {
  return buildCorpus().pages.map((p) => ({
    industry: p.industry.slug,
    band: p.band.slug,
    volume: String(p.volume),
    aht: p.aht.slug,
    scenario: p.scenario.slug,
  }));
}

type Props = { params: { industry: string; band: string; volume: string; aht: string; scenario: string } };

export function generateMetadata({ params }: Props): Metadata {
  const spec = findSpec(params.industry, params.band, params.volume, params.aht, params.scenario);
  if (!spec) return {};

  const { industry, volume, output, inputs } = spec;
  const slugs = `${params.industry}/${params.band}/${params.volume}/${params.aht}/${params.scenario}`;
  const title = `${industryLabel(industry.slug, true)} support team: ${output.agentsNeeded} agents for ${volume.toLocaleString("en-US")} tickets/month`;

  return {
    title,
    description: `A ${industryLabel(industry.slug, true)} team handling ${volume.toLocaleString("en-US")} tickets/month at ${inputs.ahtMinutes} min AHT needs about ${output.agentsNeeded} agents. Labour cost ${Math.round(output.monthlyLaborCost).toLocaleString("en-US")}/mo; automation removes ~${output.headsRemoved}. Payback ${output.paybackMonths ?? "never"} months.`,
    alternates: {
      canonical: `/roi/${slugs}`,
      languages: { en: `/roi/${slugs}`, "zh-CN": `/zh/roi/${slugs}`, "x-default": `/roi/${slugs}` },
    },
    // A page whose verdict is "don't buy this" must not compete for the query.
    // It stays reachable, because the honest answer is the useful one.
    robots: output.verdict === "not-worth-it" ? { index: false, follow: true } : undefined,
  };
}

export default function RoiPage({ params }: Props) {
  const spec = findSpec(params.industry, params.band, params.volume, params.aht, params.scenario);
  if (!spec) notFound();
  return <CorpusPage spec={spec} lang="en" />;
}
