import { NextRequest, NextResponse } from "next/server";
import { saveLead } from "@/lib/store";
import { ownerAlertAddress, sendOwnerAlert } from "@/lib/mail";

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
  industry?: string;
  band?: string;
  volume?: number;
  scenario?: string;
  /** Referrer email from a shared ?ref= link. Attribution for the programme. */
  ref?: string;
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
    industry: typeof body.industry === "string" ? body.industry.slice(0, 40) : undefined,
    band: typeof body.band === "string" ? body.band.slice(0, 20) : undefined,
    volume: num(body.volume, 1e9),
    scenario: typeof body.scenario === "string" ? body.scenario.slice(0, 30) : undefined,
    // Attribution only: who shared the link this visitor arrived through. A
    // non-email value is dropped rather than stored, so a stray ?ref=spam
    // cannot pollute the export or appear in an alert.
    ref:
      typeof body.ref === "string" && EMAIL_RE.test(body.ref.trim())
        ? body.ref.trim().toLowerCase().slice(0, 254)
        : undefined,
  };

  const line =
    `[LEAD] ${new Date().toISOString()} ` +
    Object.entries(lead)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");

  // The sinks are independent on purpose. KV is the queryable store, the
  // webhook is the one that works without any provisioning, and the log is the
  // fallback for both. Previously a lead was durable only if KV happened to be
  // configured, which made the entire funnel contingent on one dashboard step
  // nobody had taken. Now any one sink being live is enough, and the response
  // says which ones actually took it.
  const saved = await saveLead(lead);
  const sink = saved.sink;

  let webhooked = false;
  const hook = process.env.LEAD_WEBHOOK_URL;
  if (hook) {
    try {
      const res = await fetch(hook, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(lead),
      });
      webhooked = res.ok;
      if (!res.ok) console.log(`[LEAD-WEBHOOK-FAIL] status=${res.status}`);
    } catch (e) {
      console.log(`[LEAD-WEBHOOK-FAIL] ${String(e)}`);
    }
  }

  // Owner alert. Before this existed a lead was durable but invisible: it sat
  // in a store until someone remembered to open the export, which for a
  // human-scale funnel means leads were effectively lost. Best-effort only —
  // the lead is already saved above, so a mail failure never fails the call.
  let alerted = false;
  try {
    const to = ownerAlertAddress();
    const r = await sendOwnerAlert(
      `[Shiftless] 新线索 ${lead.email}`,
      [
        "计算器提交了一个新线索。",
        "",
        ...Object.entries(lead)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => `${k}: ${v}`),
        "",
        `落盘位置: ${sink ?? "none"}`,
        `通知对象: ${to ?? "(未配置)"}`,
      ].join("\n")
    );
    alerted = r.sent;
    if (!r.sent) console.log(`[LEAD-ALERT-FAIL] ${r.reason}`);
  } catch (e) {
    console.log(`[LEAD-ALERT-FAIL] ${String(e)}`);
  }

  console.log(
    line + ` sink=${sink ?? "none"} webhook=${webhooked ? "ok" : "no"} alert=${alerted ? "ok" : "no"}`
  );

  return NextResponse.json({
    ok: true,
    stored: sink !== null || webhooked,
    sinks: { kv: sink === "kv", blob: sink === "blob", webhook: webhooked },
    alerted,
  });
}

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "POST only" },
    { status: 405 },
  );
}
