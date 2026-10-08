import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildCorpus, industryLabel } from "@/lib/corpus";
import { CorpusPage } from "@/components/CorpusPage";

/**
 * The same corpus, Chinese. Shares the component and the model, so a number can
 * never be right in one language and wrong in the other. hreflang is reciprocal
 * with /roi/... on both sides.
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

  const { industry, volume, output } = spec;
  const slugs = `${params.industry}/${params.band}/${params.volume}/${params.aht}/${params.scenario}`;
  // See the English route: Infinity here would publish "Infinity 个月".
  const payback = Number.isFinite(output.paybackMonths)
    ? `${output.paybackMonths} 个月`
    : "永不回本";

  return {
    title: `${industryLabel(industry.slug, false)}客服团队：每月 ${volume.toLocaleString("zh-CN")} 条工单需要 ${output.agentsNeeded} 人`,
    description: `${industryLabel(industry.slug, false)}团队每月处理 ${volume.toLocaleString("zh-CN")} 条工单，按当前 AHT 约需 ${output.agentsNeeded} 名客服。人力成本约每月 ${Math.round(output.monthlyLaborCost * 7.2).toLocaleString("zh-CN")} 元；自动化可减少约 ${output.headsRemoved} 人。回本 ${payback}。`,
    alternates: {
      canonical: `/zh/roi/${slugs}`,
      languages: { en: `/roi/${slugs}`, "zh-CN": `/zh/roi/${slugs}`, "x-default": `/roi/${slugs}` },
    },
    robots: output.verdict === "not-worth-it" ? { index: false, follow: true } : undefined,
  };
}

export default function ZhRoiPage({ params }: Props) {
  const spec = findSpec(params.industry, params.band, params.volume, params.aht, params.scenario);
  if (!spec) notFound();
  return <CorpusPage spec={spec} lang="zh" />;
}
