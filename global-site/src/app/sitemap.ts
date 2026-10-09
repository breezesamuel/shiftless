import type { MetadataRoute } from "next";
import { buildCorpus } from "@/lib/corpus";
import { SITE_URL as BASE } from "@/lib/site";

/**
 * One sitemap entry per published programmatic page, in both languages.
 *
 * Sizing note: the metadata route has a 50,000-URL ceiling, and splitting into
 * an index is also the honest signal — a sitemap that silently truncates looks
 * identical to a sitemap that has nothing more to say. With ~1,000 pages per
 * language the single file is nowhere near the limit, but the code emits the
 * index only if the corpus ever outgrows it, so growth cannot quietly start
 * dropping URLs.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const { pages } = buildCorpus();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/ai-vs-human-cost`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/benchmarks`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/methodology`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/roi`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/tools`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/zh`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/zh/tools`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/zh/benchmarks`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/zh/roi`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Only pages the model actually recommends belong in the sitemap. The rest
  // are deliberately noindex: advertising them here would tell crawlers to
  // index something the page itself tells crawlers not to index — a direct,
  // machine-checkable contradiction that hurts the pages that DO want in.
  const slugs = pages
    .filter((p) => !p.notWorthIt)
    .map((p) => `${p.industry.slug}/${p.band.slug}/${p.volume}/${p.aht.slug}/${p.scenario.slug}`);

  const programmatic: MetadataRoute.Sitemap = [
    ...slugs.map((s) => ({
      url: `${BASE}/roi/${s}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      // Pages whose verdict is "don't buy" are served noindex, so advertising
      // them for indexing would be inconsistent with the page's own directives.
      priority: 0.5,
    })),
    ...slugs.map((s) => ({
      url: `${BASE}/zh/roi/${s}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];

  return [...staticEntries, ...programmatic];
}
