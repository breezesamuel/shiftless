import crypto from "crypto";

/**
 * Shared admin-cockpit token guard.
 *
 * AGENT_ADMIN_TOKEN wins; LEAD_EXPORT_TOKEN is the fallback so the operator's
 * existing export secret also unlocks /admin without a new provisioning step.
 * Constant-time compare; a missing configured token denies everything (an
 * unconfigured cockpit is not a working cockpit).
 */
export function adminTokenOk(token: string | null | undefined): boolean {
  const want = process.env.AGENT_ADMIN_TOKEN || process.env.LEAD_EXPORT_TOKEN || "";
  if (!want) return false;
  const got = (token || "").trim();
  if (!got || got.length > 256) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}