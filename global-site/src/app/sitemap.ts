import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://shiftless.vercel.app";
  const now = new Date();
  return [
    { url: base, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/ai-vs-human-cost`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/benchmarks`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/methodology`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/zh`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/zh/benchmarks`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
