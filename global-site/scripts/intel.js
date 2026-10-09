/**
 * Manual intel run — same pipeline as /api/cron/refresh, for the operator to
 * run on demand instead of waiting for the schedule.
 *
 * Usage: node scripts/intel.js [baseUrl] [secret]
 *   baseUrl default: https://app.highkingflower.com
 *   secret default: $CRON_SECRET
 */
"use strict";

const BASE = process.argv[2] || "https://app.highkingflower.com";
const secret = process.argv[3] || process.env.CRON_SECRET || "";

(async () => {
  if (!secret) {
    console.error("No secret. Pass it as arg 2 or set CRON_SECRET.");
    process.exit(1);
  }
  const r = await fetch(`${BASE}/api/cron/refresh?secret=${encodeURIComponent(secret)}`, {
    signal: AbortSignal.timeout(60000),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j || !j.ok) {
    console.error("intel failed:", r.status, JSON.stringify(j));
    process.exit(1);
  }
  console.log(
    `intel ok: ${j.sourcesAlive}/${j.sourcesTotal} sources alive, ${j.githubSignals} github signals`
  );
})().catch((e) => {
  console.error("ERR " + e.message);
  process.exit(1);
});