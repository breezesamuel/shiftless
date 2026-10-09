import type { Metadata } from "next";
import { SuiteDirectory } from "@/components/SuiteDirectory";
import { SITE_URL as BASE } from "@/lib/site";

/**
 * English entry point of the consolidation hub. The other language lives at
 * /zh/tools and renders the same component, so the two can never disagree.
 */

export const metadata: Metadata = {
  title: "Tools & Suite — every Bingdashan product in one place",
  description:
    "One directory for the tools built by Shanghai Bingdashan Intelligent Technology: a free support-cost calculator, a 508-tool utility box, AI visibility audits, an auction-priced valuation report, per-call x402 APIs and more.",
  alternates: {
    canonical: "/tools",
    languages: { en: "/tools", "zh-CN": "/zh/tools", "x-default": "/tools" },
  },
  openGraph: {
    type: "website",
    siteName: "Shiftless",
    url: `${BASE}/tools`,
    locale: "en_US",
    title: "Tools & Suite — every Bingdashan product in one place",
    description:
      "One front door to every in-house tool. Each keeps its own pricing and checkout.",
  },
};

export default function ToolsPage() {
  return <SuiteDirectory lang="en" />;
}
