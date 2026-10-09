import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { draftNudges } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Follow-up sweep — called by Vercel Cron.
 *
 * Scans sent lead-followup missions that got no outcome after AGENT_NUDGE_DAYS
 * (default 2) and drafts one gentle nudge each, into the pending queue. The
 * nudge is approval-gated unless AGENT_AUTO_SEND=1 — the same honesty rule as
 * every other outbound mission.
 */
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

export async function GET(req: NextRequest) {
  if (!cronOk(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { drafted, skipped } = await draftNudges();
  return NextResponse.json({ ok: true, drafted, skipped });
}