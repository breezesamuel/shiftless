import { NextRequest, NextResponse } from "next/server";
import { listLeads, isLeadStorageConfigured, type StoredLead } from "@/lib/store";
import { scoreLead } from "@/lib/scoring";

// Node runtime, not edge: store.ts derives ids with node:crypto (the same
// primitive auth.ts already uses), and the edge bundle cannot resolve it.
// This route is called by a human with a token, not on the hot visitor path,
// so there is no latency cost to making it node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Export captured leads as CSV.
 *
 * Persisting leads to KV without a way to read them back is the same failure in
 * a new costume: a database nobody opens. This is the missing half — one URL,
 * one secret, and every lead is in a spreadsheet.
 *
 * Guarded by LEAD_EXPORT_TOKEN. This returns other people's email addresses, so
 * an open endpoint would be a data breach, not a convenience. Returns 401 when
 * the token is unset as well as when it is wrong: an unconfigured export is not
 * a working export, and silently allowing it would be the worst outcome.
 */
export async function GET(req: NextRequest) {
  const token = process.env.LEAD_EXPORT_TOKEN;
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "lead export is not configured (LEAD_EXPORT_TOKEN unset)" },
      { status: 401 }
    );
  }

  const supplied =
    req.headers.get("x-lead-token") ?? req.nextUrl.searchParams.get("token") ?? "";
  if (supplied !== token) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  // Gate on any durable sink, not KV specifically. Blob was added as a fallback
  // so leads survive without KV, but this route still refused to read them — so
  // a lead could be durably stored and simultaneously impossible to export.
  // The point of a fallback store is that it is usable, not merely writable.
  if (!isLeadStorageConfigured()) {
    return NextResponse.json(
      { ok: false, error: "no lead storage configured (need KV, Blob, or a webhook)" },
      { status: 503 }
    );
  }

  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "500");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.trunc(limitRaw)), 2000) : 500;

  const leads = await listLeads(limit);

  // Neutralise spreadsheet formula injection: a lead field starting with =, +, -
  // or @ is executed by Excel/Sheets on open. Leads are attacker-controlled.
  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };

  const cols = [
    "id",
    "receivedAt",
    "email",
    "score",
    "ref",
    "monthlyTickets",
    "ahtMinutes",
    "loadedCostPerHour",
    "channel",
    "industry",
    "band",
    "volume",
    "scenario",
    "agentsRange",
    "monthlyNetEffect",
    "paybackMonths",
    "verdict",
    "yearOneRoi",
    "source",
  ] as const;

  const rows = [
    cols.join(","),
    ...(leads as StoredLead[]).map((l) => cols.map((c) => cell(c === "score" ? scoreLead(l) : l[c])).join(",")),
  ].join("\n");

  return new NextResponse(rows, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
