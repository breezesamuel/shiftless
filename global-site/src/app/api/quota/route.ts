import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { getQuota, __store } from "@/lib/store";

/**
 * Current free-tier usage for the signed-in user.
 *
 * Returns the same shape whether or not the user is signed in, so the client
 * never has to branch on a missing cookie before rendering.
 */
export async function GET(req: Request) {
  const jar = cookies();
  const session = verifySession(jar.get("shiftless_session")?.value || "");
  const reset = new URL(req.url).origin;

  if (!session) {
    return NextResponse.json({
      ok: true,
      signedIn: false,
      freeUsesTotal: __store.FREE_USES_LIMIT,
      used: 0,
      remaining: __store.FREE_USES_LIMIT,
      resetAt: null,
      origin: reset,
    });
  }

  const quota = await getQuota(session.userId);
  const remaining = Math.max(0, __store.FREE_USES_LIMIT - quota.uses);

  return NextResponse.json({
    ok: true,
    signedIn: true,
    email: session.email,
    freeUsesTotal: __store.FREE_USES_LIMIT,
    used: quota.uses,
    remaining,
    resetAt: quota.resetAt,
    origin: reset,
  });
}
