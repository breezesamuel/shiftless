import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import {
  getQuota,
  storageState,
  StorageNotConfiguredError,
  FREE_USES_LIMIT,
} from "@/lib/store";

/**
 * Current free-tier usage for the signed-in user.
 *
 * When KV is not provisioned the endpoint still answers, but it reports
 * `storage: "unconfigured"` and refuses to invent usage numbers. Showing
 * "剩余 10" without a database would be a lie we could not detect later.
 */
export async function GET() {
  const jar = cookies();
  const session = verifySession(jar.get("shiftless_session")?.value || "");
  const storage = storageState();

  if (!session) {
    return NextResponse.json({
      ok: true,
      signedIn: false,
      storage,
      freeUsesTotal: FREE_USES_LIMIT,
      used: 0,
      remaining: FREE_USES_LIMIT,
      resetAt: null,
    });
  }

  try {
    const quota = await getQuota(session.userId);
    const remaining = Math.max(0, FREE_USES_LIMIT - quota.uses);
    return NextResponse.json({
      ok: true,
      signedIn: true,
      storage,
      email: session.email,
      freeUsesTotal: FREE_USES_LIMIT,
      used: quota.uses,
      remaining,
      resetAt: quota.resetAt,
    });
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) {
      return NextResponse.json({
        ok: true,
        signedIn: true,
        storage: "unconfigured",
        email: session.email,
        freeUsesTotal: FREE_USES_LIMIT,
        used: null,
        remaining: null,
        resetAt: null,
      });
    }
    throw e;
  }
}
