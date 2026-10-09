import { NextRequest, NextResponse } from "next/server";
import { listOrders } from "@/lib/store";
import { adminTokenOk } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Orders CSV export — token-guarded (AGENT_ADMIN_TOKEN / LEAD_EXPORT_TOKEN).
 * Reads from Blob (orders/ prefix).
 */
export async function GET(req: NextRequest) {
  if (!adminTokenOk(req.nextUrl.searchParams.get("token"))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const limitRaw = Number(req.nextUrl.searchParams.get("limit") ?? "500");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.trunc(limitRaw)), 2000) : 500;

  const orders = await listOrders(limit);

  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    let s = String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };

  const cols = [
    "orderId",
    "email",
    "tier",
    "priceUsd",
    "rail",
    "channel",
    "monthlyTickets",
    "ahtMinutes",
    "ref",
    "permalink",
    "ts",
    "paymentState",
    "paypalOrderId",
    "amount",
    "currency",
    "payer",
  ] as const;

  const rows = [
    cols.join(","),
    ...orders.map((o) => cols.map((c) => cell(o[c])).join(",")),
  ].join("\n");

  return new NextResponse(rows, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}