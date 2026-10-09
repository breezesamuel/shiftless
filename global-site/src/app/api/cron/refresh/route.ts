import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { emit } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Honest intel pipeline — the anti-content-scraping alternative.
 *
 * What it does NOT do: it never ingests prose, code, or data off the web into
 * the site. That would violate licenses, destroy the corpus's originality
 * (the thing Google's scaled-content policy actually turns on), and flood the
 * model with unverifiable numbers.
 *
 * What it DOES do, on a schedule (Vercel Cron → CRON_SECRET):
 * 1. Source-health monitor: pings a curated manifest of citeable public
 *    benchmark sources and records only HTTP status + last-modified. The
 *    operator sees which references are alive; content is never ingested.
 * 2. GitHub trend monitor: queries the public GitHub search API for repos in
 *    the support-automation space and records metadata only (name, URL,
 *    stars, updated_at) as market signals for the operator.
 *
 * Both write one append-only agent event per run. Nothing is emailed, nothing
 * is published, nothing is auto-applied to the model.
 */

const SOURCES = [
  { slug: "zendesk-cx-trends", url: "https://www.zendesk.com/cx-trends/" },
  { slug: "intercom-blog", url: "https://www.intercom.com/blog/" },
  { slug: "bls-customer-service", url: "https://www.bls.gov/oes/current/oes434050.htm" },
  { slug: "gartner-cx", url: "https://www.gartner.com/en/customer-service-support" },
  { slug: "hbr-customer-service", url: "https://hbr.org/topic/customer-service" },
];

const GITHUB_QUERIES = [
  "customer+support+automation+AI",
  "support+ops+agent",
];

function cronOk(req: NextRequest): boolean {
  const want = process.env.CRON_SECRET || "";
  if (!want) return false;
  const got =
    req.nextUrl.searchParams.get("secret") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function probe(url: string): Promise<{ url: string; ok: boolean; status: number; lastModified: string | null }> {
  try {
    const r = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
      headers: { "user-agent": "shiftless-intel/1.0 (+source-health monitor)" },
    });
    return {
      url,
      ok: r.ok,
      status: r.status,
      lastModified: r.headers.get("last-modified"),
    };
  } catch {
    return { url, ok: false, status: 0, lastModified: null };
  }
}

async function githubTrend(): Promise<unknown[]> {
  const out: unknown[] = [];
  for (const q of GITHUB_QUERIES) {
    try {
      const r = await fetch(
        `https://api.github.com/search/repositories?q=${q}&sort=stars&order=desc&per_page=5`,
        {
          headers: { accept: "application/vnd.github+json", "user-agent": "shiftless-intel/1.0" },
          signal: AbortSignal.timeout(15000),
        }
      );
      if (!r.ok) continue;
      const j = (await r.json()) as {
        items?: { full_name: string; html_url: string; stargazers_count: number; updated_at: string }[];
      };
      for (const it of j.items || []) {
        out.push({
          full_name: it.full_name,
          html_url: it.html_url,
          stars: it.stargazers_count,
          updated_at: it.updated_at,
        });
      }
    } catch {
      // rate-limited or offline; skip this query
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  if (!cronOk(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const [sources, github] = await Promise.all([
    Promise.all(SOURCES.map((s) => probe(s.url))),
    githubTrend(),
  ]);
  const dead = sources.filter((s) => !s.ok).length;
  // emit() records the intel event AND lets the planner draft an operator task
  // when reference sources go dead. Fire-and-forget by design: a Blob or mail
  // hiccup must never break the cron response.
  void emit("intel", {
    run: "cron-refresh",
    sources,
    github,
    summary: `${sources.length - dead}/${sources.length} sources alive, ${github.length} github signals`,
  });
  return NextResponse.json({
    ok: true,
    sourcesAlive: sources.length - dead,
    sourcesTotal: sources.length,
    githubSignals: github.length,
  });
}