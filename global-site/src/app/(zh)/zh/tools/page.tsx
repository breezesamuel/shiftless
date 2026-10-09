import type { Metadata } from "next";
import { SuiteDirectory } from "@/components/SuiteDirectory";
import { SITE_URL as BASE } from "@/lib/site";

/**
 * Chinese entry point of the consolidation hub. Renders the same component as
 * the English page so the tool list and descriptions stay in lockstep.
 */

export const metadata: Metadata = {
  title: "工具与套件 — 丙大山全部产品入口",
  description:
    "上海丙大山智能科技自研工具的汇总入口：客服成本测算器、508 个免费小工具、AI 可见度实测、古玩估值报告、按次计费 x402 API 等。每一款保留独立定价与结算。",
  alternates: {
    canonical: "/zh/tools",
    languages: { "zh-CN": "/zh/tools", en: "/tools", "x-default": "/tools" },
  },
  openGraph: {
    type: "website",
    siteName: "Shiftless",
    url: `${BASE}/zh/tools`,
    locale: "zh_CN",
    title: "工具与套件 — 丙大山全部产品入口",
    description: "一个入口，一组自研工具，各自独立变现。",
  },
};

export default function ZhToolsPage() {
  return <SuiteDirectory lang="zh" />;
}
