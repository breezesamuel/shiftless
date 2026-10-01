import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { smtpConfigured } from "@/lib/mail";
import {
  getQuota,
  storageState,
  isKvConfigured,
  StorageNotConfiguredError,
  FREE_USES_LIMIT,
} from "@/lib/store";

/**
 * Login needs both a database to record the session and an SMTP transport to
 * deliver the link. Either one missing means the "email me a login link" button
 * cannot succeed, so the client uses this to decide whether to offer it at all
 * rather than letting visitors click something that will only fail.
 */
function loginReady(): boolean {
  return isKvConfigured() && smtpConfigured();
}

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
      loginReady: loginReady(),
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
      loginReady: loginReady(),
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
        loginReady: loginReady(),
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
