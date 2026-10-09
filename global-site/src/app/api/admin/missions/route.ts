import { NextRequest, NextResponse } from "next/server";
import { approveMission, rejectMission, recordOutcome, retryMission, confirmManualPayment, markDelivered } from "@/lib/agent";
import { payoutReferral } from "@/lib/store";
import { adminTokenOk } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin actions: mission approve/reject/outcome/retry, referral payout, and
 * manual-payment confirmation. Token-guarded by AGENT_ADMIN_TOKEN /
 * LEAD_EXPORT_TOKEN.
 */
export async function POST(req: NextRequest) {
  if (!adminTokenOk(req.nextUrl.searchParams.get("token"))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  let body: { action?: string; id?: string; outcome?: string; operatorEmail?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const id = String(body.id || "").slice(0, 64);
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });

  if (body.action === "approve") {
    const r = await approveMission(id);
    return NextResponse.json(r);
  }
  if (body.action === "reject") {
    return NextResponse.json({ ok: await rejectMission(id) });
  }
  if (body.action === "outcome") {
    const o = body.outcome;
    if (o !== "replied" && o !== "no-reply" && o !== "bounce") {
      return NextResponse.json({ ok: false, error: "bad outcome" }, { status: 400 });
    }
    return NextResponse.json({ ok: await recordOutcome(id, o) });
  }
  if (body.action === "payout-referral") {
    const operatorEmail = String(body.operatorEmail || "").trim();
    if (!operatorEmail.includes("@")) {
      return NextResponse.json({ ok: false, error: "operatorEmail required" }, { status: 400 });
    }
    return NextResponse.json({ ok: await payoutReferral(id, operatorEmail) });
  }
  if (body.action === "retry") {
    const r = await retryMission(id);
    return NextResponse.json(r);
  }
  if (body.action === "confirm-manual") {
    const operatorEmail = String(body.operatorEmail || "admin").trim();
    const r = await confirmManualPayment(id, operatorEmail);
    return NextResponse.json(r);
  }
  if (body.action === "deliver") {
    return NextResponse.json({ ok: await markDelivered(id) });
  }
  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}