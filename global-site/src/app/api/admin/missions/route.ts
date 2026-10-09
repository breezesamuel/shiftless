import { NextRequest, NextResponse } from "next/server";
import { approveMission, rejectMission, recordOutcome } from "@/lib/agent";
import { adminTokenOk } from "@/lib/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mission actions for the operator cockpit: approve (send the drafted mail),
 * reject, or record an outcome (replied / no-reply / bounce) which feeds the
 * template-learning counters.
 */
export async function POST(req: NextRequest) {
  if (!adminTokenOk(req.nextUrl.searchParams.get("token"))) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  let body: { action?: string; id?: string; outcome?: string };
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
  return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
}