import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://web-solmount.vercel.app";

const PAGES: { path: string; priority: number; freq: "weekly" | "monthly" | "yearly" }[] = [
  { path: "", priority: 1.0, freq: "weekly" },
  { path: "/roi", priority: 0.95, freq: "weekly" },
  { path: "/pricing", priority: 0.9, freq: "weekly" },
  { path: "/order", priority: 0.9, freq: "weekly" },
  { path: "/cs", priority: 0.85, freq: "monthly" },
  { path: "/faq", priority: 0.6, freq: "monthly" },
  { path: "/about", priority: 0.5, freq: "monthly" },
  { path: "/security", priority: 0.4, freq: "monthly" },
  { path: "/licenses", priority: 0.4, freq: "monthly" },
  { path: "/privacy", priority: 0.3, freq: "yearly" },
  { path: "/terms", priority: 0.3, freq: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PAGES.map((p) => ({
    url: `${BASE}${p.path}`,
    lastModified: now,
    changeFrequency: p.freq,
    priority: p.priority,
  }));
}
