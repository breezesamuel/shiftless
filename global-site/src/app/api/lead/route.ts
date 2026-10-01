import { NextRequest, NextResponse } from "next/server";
import { saveLead } from "@/lib/store";

// Node runtime, not edge: saveLead() lives in store.ts alongside the quota and
// order helpers, and that module derives ids with node:crypto — which the edge
// bundle cannot resolve. Keeping the whole KV layer on one runtime is simpler
// than forking the id generation, and a human-scale lead POST gains nothing from
// the edge runtime's fetch concurrency.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Lead capture for the calculator.
 *
 * Deliberate choices:
 * - No third-party form service. formsubmit.co and similar are blocked from
 *   Vercel's egress, which is why the previous 13 rounds of "we have a contact
 *   form" never actually received anything. This route is same-origin, so it
 *   cannot be silently blocked.
 * - No database dependency. Leads are written to stdout as [LEAD] lines (the
 *   same pattern already proven to work in monetization-web-deploy) AND
 *   forwarded to LEAD_WEBHOOK_URL if one is configured.
 * - We store the computed ROI inputs, not just the email, because the inputs
 *   are what tell us which vertical and which price point to build next.
 *
 * We do NOT put any payment or bank details behind this. Nothing collected
 * here is rendered back to the public.
 */

type Lead = {
  email: string;
  monthlyTickets?: number;
  ahtMinutes?: number;
  loadedCostPerHour?: number;
  channel?: string;
  agentsRange?: string;
  monthlyNetEffect?: number;
  paybackMonths?: number | null;
  verdict?: string;
  yearOneRoi?: number;
  source?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function num(v: unknown, max = 1e9): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0 || n > max) return undefined;
  return Math.round(n * 100) / 100;
}

export async function POST(req: NextRequest) {
  let body: Lead;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) {
    return NextResponse.json({ ok: false, error: "valid email required" }, { status: 400 });
  }

  const lead: Lead = {
    email,
    monthlyTickets: num(body.monthlyTickets),
    ahtMinutes: num(body.ahtMinutes, 600),
    loadedCostPerHour: num(body.loadedCostPerHour, 10_000),
    channel: typeof body.channel === "string" ? body.channel.slice(0, 40) : undefined,
    agentsRange: typeof body.agentsRange === "string" ? body.agentsRange.slice(0, 20) : undefined,
    monthlyNetEffect: num(body.monthlyNetEffect, 1e8),
    paybackMonths: num(body.paybackMonths, 1200),
    verdict: typeof body.verdict === "string" ? body.verdict.slice(0, 30) : undefined,
    yearOneRoi: num(body.yearOneRoi, 10_000),
    source: typeof body.source === "string" ? body.source.slice(0, 60) : "calculator",
  };

  const line =
    `[LEAD] ${new Date().toISOString()} ` +
    Object.entries(lead)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");

  // Durable sink #1: KV, so the lead is queryable and survives a redeploy.
  // Best-effort by design — see saveLead(). A visitor who handed us an email
  // must never see a 500 because the database blinked.
  const saved = await saveLead(lead);

  // Sink #2: platform log, greppable, never blocked.
  console.log(line + (saved ? ` id=${saved.id}` : " kv=unavailable"));

  // Sink #3: optional webhook (Zapier/Make/Feishu/n8n) when configured.
  const hook = process.env.LEAD_WEBHOOK_URL;
  if (hook) {
    try {
      await fetch(hook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(lead),
      });
    } catch (e) {
      console.log(`[LEAD-WEBHOOK-FAIL] ${String(e)}`);
    }
  }

  return NextResponse.json({ ok: true, stored: saved !== null });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "POST only" },
    { status: 405 },
  );
}
