import { NextResponse } from "next/server";

/**
 * The engine is plain CommonJS so the CLI in ../../geo/audit.js can require the
 * exact same file. Typed here rather than via a .d.ts so the two call sites can
 * never disagree about the shape without a compile error.
 */
type AuditCheck = { id: string; label: string; weight: number; score: number; detail: string };
type AuditResult = {
  url: string;
  fetchedAt: string;
  httpStatus: number;
  score: number;
  band: string;
  bandNote: string;
  checks: AuditCheck[];
};
// The comparison logic is destructured straight out of the shared engine so
// this endpoint cannot drift from geo/quarterly.js.
const { auditPage, renderMarkdown } = require("@/lib/geo-audit.js") as {
  auditPage(url: string, opts?: { timeoutMs?: number; auxTimeoutMs?: number }): Promise<AuditResult>;
  renderMarkdown(result: AuditResult): string;
};
const { diffChecks, tallyItems, verdictFor } = require("@/lib/geo-audit.js") as {
  diffChecks(before: AuditCheck[], after: AuditCheck[]): DiffItem[];
  tallyItems(items: DiffItem[]): Tally;
  verdictFor(totalDelta: number, t: Tally): { grade: string; line: string };
};

type DiffItem = {
  id: string;
  label: string;
  weight: number;
  before: number | null;
  after: number | null;
  delta: number | null;
  state: "resolved" | "regressed" | "improved" | "declined" | "unchanged" | "untested" | "new";
  detail?: string;
};
type Tally = {
  resolved: number;
  improved: number;
  regressed: number;
  declined: number;
  unchanged: number;
  untested: number;
  new: number;
};

/**
 * Vercel Cron entry point for the quarterly recheck.
 *
 * Why this exists: the task must keep running when the operator's machine is
 * off. Vercel Cron fires on Vercel's infrastructure, so it does.
 *
 * WHAT IT ACTUALLY DOES (no overclaiming):
 *  - Fires daily. Acts only on Jan/Apr/Jul/Oct (or ?force=1 for a manual run).
 *  - For each configured subscriber it RUNS THE REAL AUDIT via the same engine
 *    the CLI uses (src/lib/geo-audit.js, zero deps, no API keys) and reports the
 *    current score.
 *  - Full markdown reports go to ORDER_WEBHOOK_URL when that is configured, and
 *    are always emitted to stdout so they are retrievable with `vercel logs`.
 *
 * KNOWN LIMITATION, stated rather than hidden:
 *  - There is no database here. A serverless function has no filesystem, so this
 *    cannot compute the quarter-over-quarter DELTA on its own. Making that work
 *    needs a store (Vercel KV/Blob or Postgres) — one env var away, but it is
 *    not faked here. Until then it reports the current score, not a trend.
 *  - It audits the site ROOT page per subscriber, not the full 6-8 page set. The
 *    full set is the local pipeline's job (geo/quarterly.js).
 *
 * GET is authenticated (Vercel Cron sends GET). If CRON_SECRET is unset the
 * endpoint disables itself rather than becoming an open relay.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;
const WEBHOOK = process.env.ORDER_WEBHOOK_URL;

/** Stay inside the 60s function budget: 3 sites x (12s page + 2x8s aux) in parallel. */
const MAX_SITES = 3;
const PAGE_TIMEOUT = 12000;
const AUX_TIMEOUT = 8000;

type Subscriber = { url: string; email?: string };

function listSubscribers(): Subscriber[] {
  const raw = process.env.SUBSCRIBERS_JSON;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((s) => s && typeof s.url === "string" && /^https?:\/\//i.test(s.url))
      .map((s) => ({ url: s.url, email: typeof s.email === "string" ? s.email : undefined }));
  } catch {
    return [];
  }
}

function isQuarterStart(now: Date): boolean {
  const month = now.getUTCMonth(); // 0-11
  return month === 0 || month === 3 || month === 6 || month === 9;
}

function quarterOf(now: Date): string {
  return `${now.getUTCFullYear()}-Q${Math.floor(now.getUTCMonth() / 3) + 1}`;
}

/**
 * Discriminated on `ok` so callers can narrow to the success shape and reach
 * `checks`/`score` without a cast.
 */
type AuditOk = {
  url: string;
  ok: true;
  score: number;
  band: string;
  openFindings: number;
  totalFindings: number;
  checks: AuditCheck[];
  httpStatus: number;
  ms: number;
  markdown: string;
  delta?: unknown;
};
type AuditFail = { url: string; ok: false; error: string; ms: number; delta?: unknown };
type AuditOutcome = AuditOk | AuditFail;

async function auditOne(sub: Subscriber): Promise<AuditOutcome> {
  const started = Date.now();
  try {
    const result = await auditPage(sub.url, { timeoutMs: PAGE_TIMEOUT, auxTimeoutMs: AUX_TIMEOUT });
    return {
      url: sub.url,
      ok: true,
      score: result.score,
      band: result.band,
      openFindings: result.checks.filter((c) => c.score < c.weight).length,
      totalFindings: result.checks.length,
      checks: result.checks,
      httpStatus: result.httpStatus,
      ms: Date.now() - started,
      markdown: renderMarkdown(result),
    };
  } catch (e) {
    return {
      url: sub.url,
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      ms: Date.now() - started,
    };
  }
}

function hostOf(u: string): string | null {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * The published baseline for a host, read back from our own domain.
 * Returns null when there is none — a missing baseline is a real state that
 * gets reported, never a silently zero delta.
 */
async function loadBaseline(origin: string, host: string) {
  try {
    const res = await fetch(`${origin}/baselines/${host}.json`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as {
      host: string;
      quarter: string;
      overall: number;
      pages: { url: string; score: number; checks: AuditCheck[] }[];
    };
  } catch {
    return null;
  }
}

// The comparison itself lives in the shared engine (diffChecks / tallyItems /
// verdictFor) so this endpoint and geo/quarterly.js cannot drift. Only the
// transport shape is defined here.
type DeltaSummary = ReturnType<typeof tallyItems> & {
  netPoints: number;
  grade: string;
  line: string;
};
type DeltaReport = {
  baselineQuarter: string;
  baselineScore: number;
  scoreDelta: number;
  summary: DeltaSummary;
  items: ReturnType<typeof diffChecks>;
};

function summarizeDelta(items: ReturnType<typeof diffChecks>, scoreDelta: number): DeltaSummary {
  const t = tallyItems(items);
  const netPoints = items.reduce((s, i) => s + (i.delta ?? 0), 0);
  return { ...t, netPoints, ...verdictFor(scoreDelta, t) };
}

async function runAudits(all: Subscriber[], now: Date, forced: boolean, origin: string) {
  const batch = all.slice(0, MAX_SITES);
  const skipped = Math.max(0, all.length - batch.length);
  const results = await Promise.all(batch.map(auditOne));

  for (const r of results) {
    // stdout is the durable-ish channel: `vercel logs` can read it any time.
    // Every run is recorded — manual (force=1) and quarter-start alike —
    // otherwise a triggered run leaves no evidence it happened.
    const common = {
      trigger: forced ? "manual" : "quarter-start",
      quarter: quarterOf(now),
      url: r.url,
      ms: r.ms,
    };

    if (!r.ok) {
      console.log(`[QUARTERLY-RECHECK] ${JSON.stringify({ ...common, ok: false, error: r.error })}`);
      continue;
    }

    // Attach the quarter-over-quarter comparison. Only the root page is audited
    // here, so the delta is root-vs-root — never a whole-site number dressed up
    // as one.
    let delta: DeltaReport | null = null;
    const host = hostOf(r.url);
    const base = host ? await loadBaseline(origin, host) : null;
    if (base) {
      const basePage = base.pages.find((p) => new URL(p.url).pathname === "/") || base.pages[0];
      const items = diffChecks(basePage.checks || [], r.checks);
      const scoreDelta = r.score - basePage.score;
      delta = { baselineQuarter: base.quarter, baselineScore: basePage.score, scoreDelta, summary: summarizeDelta(items, scoreDelta), items };
    }
    r.delta = delta;

    console.log(
      `[QUARTERLY-RECHECK] ${JSON.stringify({
        ...common,
        ok: true,
        score: r.score,
        band: r.band,
        open: r.openFindings,
        baselineQuarter: delta ? delta.baselineQuarter : null,
        delta: delta ? delta.summary : null,
      })}`
    );

    if (WEBHOOK) {
      // Fire and forget; a webhook outage must not fail the whole recheck.
      fetch(WEBHOOK, {
        method: "POST",
        headers: { "content-type": "text/markdown" },
        body:
          r.markdown +
          (delta
            ? `\n\n---\n\n## 与基线对比（基线 ${delta.baselineQuarter}）\n\n` +
              `分数 ${delta.baselineScore} → ${r.score}（${delta.scoreDelta >= 0 ? "+" : ""}${delta.scoreDelta}）\n\n` +
              `判定：**${delta.summary.grade}** · 修复 ${delta.summary.resolved} · 回归 ${delta.summary.regressed} · 净变化 ${delta.summary.netPoints >= 0 ? "+" : ""}${delta.summary.netPoints}\n\n` +
              `${delta.summary.line}\n\n` +
              "| 检查项 | 上季 | 本季 | 变化 | 状态 |\n|---|---|---|---|---|\n" +
              delta.items
                .filter((i) => i.state !== "unchanged")
                .map(
                  (i) =>
                    `| ${i.label} | ${i.before} | ${i.after} | ${(i.delta ?? 0) >= 0 ? "+" : ""}${i.delta ?? 0} | ${i.state} |`
                )
                .join("\n")
            : `\n\n---\n\n_未找到已发布基线，本次仅报告当前分数。_`),
      }).catch(() => {});
    }
  }
  if (skipped) console.log(`[QUARTERLY-CRON] skipped ${skipped} subscriber(s) beyond the ${MAX_SITES}-site budget`);

  return {
    ok: true,
    ran: true,
    ...(forced ? { forced: true } : {}),
    quarter: quarterOf(now),
    scanned: results.length,
    skipped,
    webhook: Boolean(WEBHOOK),
    // Never echo the full markdown back in the response; only its size.
    results: results.map((r) =>
      r.ok
        ? {
            url: r.url,
            ok: true,
            score: r.score,
            band: r.band,
            openFindings: r.openFindings,
            totalFindings: r.totalFindings,
            httpStatus: r.httpStatus,
            ms: r.ms,
            markdownBytes: r.markdown.length,
            delta: r.delta,
          }
        : { url: r.url, ok: false, error: r.error, ms: r.ms }
    ),
    note:
      all.length === 0
        ? "No subscribers configured, so nothing was audited. Set SUBSCRIBERS_JSON to activate."
        : skipped
        ? `Only the first ${MAX_SITES} subscribers were audited within the function time budget; ${skipped} remain. Raise MAX_SITES or split the batch.`
        : "Root-page score compared against the published baseline. The baseline advances when scripts/publish-baselines.js runs and the site is redeployed.",
  };
}

async function handle(req: Request) {
  const url = new URL(req.url);
  const forced = url.searchParams.get("force") === "1";
  const origin = url.origin;

  if (req.method === "GET") {
    if (!CRON_SECRET) {
      return NextResponse.json(
        { ok: false, error: "CRON_SECRET not configured; cron endpoint disabled." },
        { status: 503 }
      );
    }
    if (req.headers.get("authorization") !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }
  }

  // NOTE: this endpoint deliberately does NOT implement If-None-Match / 304.
  //
  // An earlier version returned 304 when the client presented a matching ETag,
  // computed from the published baseline. That was wrong twice over:
  //
  //   1. The 304 check ran BEFORE isQuarterStart(), so on Jan/Apr/Jul/Oct a
  //      conditional request would short-circuit the audit. The one day the
  //      cron must actually do work was the one day it could silently skip.
  //   2. It was keyed on the PUBLISHED baseline, which only changes after a
  //      successful run. So within a quarter every client got a stable 304,
  //      and a re-audit could never be forced through the cache.
  //
  // The endpoint is a job trigger, not a cacheable document. Quarterly
  // re-audits are expensive and infrequent; caching them buys nothing and
  // risks skipping the audit that customers are paying for. Static baselines
  // under /public/baselines are the thing that is actually cacheable.

  const now = new Date();
  const all = listSubscribers();

  // A manual run always executes, quarter or not.
  if (forced) return NextResponse.json(await runAudits(all, now, true, origin));

  if (!isQuarterStart(now)) {
    return NextResponse.json({
      ok: true,
      ran: false,
      reason: "daily trigger, but not a quarter start (acts on Jan/Apr/Jul/Oct)",
      date: now.toISOString().slice(0, 10),
      subscribersConfigured: all.length,
    });
  }

  if (all.length === 0) {
    console.log(`[QUARTERLY-CRON] ran=true scanned=0 (no subscribers configured)`);
    return NextResponse.json({
      ok: true,
      ran: true,
      scanned: 0,
      note:
        "Quarter start, but no subscribers configured yet — nothing audited. This is the expected state until the first subscription is sold.",
    });
  }

  return NextResponse.json(await runAudits(all, now, false, origin));
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
