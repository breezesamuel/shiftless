import { NextResponse } from "next/server";
import { isKvConfigured, isLeadStorageConfigured } from "@/lib/store";
import { paypalConfigured } from "@/lib/paypal";

/**
 * System health, reportable from outside Vercel.
 *
 * This exists because the most expensive failure mode in this repo was silent:
 * leads were written to stdout for 14 rounds and nobody could tell, because
 * there was no page anywhere that said "your leads are going nowhere." The same
 * class of blindness applies right now — if KV is unset, the quota, auth,
 * orders and lead persistence are all inert, and the site still returns 200 and
 * looks fine.
 *
 * So the one metric that matters is `leadsDurable`: is there anywhere other
 * than stdout for a lead to land? Everything else is supporting detail.
 *
 * Only presence is reported, never values. A diagnostics endpoint that echoes
 * secrets is a new leak, and this one is deliberately unauthenticated so it can
 * be polled by anything.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function present(v: string | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

export async function GET() {
  const kv = isKvConfigured();
  const blob = isLeadStorageConfigured() && !kv;
  const webhook = present(process.env.LEAD_WEBHOOK_URL);

  // The question that decides whether the funnel is worth anything at all.
  const leadsDurable = kv || blob || webhook;

  const checks = {
    // Revenue path
    kvConfigured: kv,
    blobConfigured: blob,
    leadWebhookConfigured: webhook,
    leadsDurable,
    leadExportToken: present(process.env.LEAD_EXPORT_TOKEN),
    indexNowKey: present(process.env.INDEXNOW_KEY),

    // Payment path
    paypalConfigured: paypalConfigured(),
    alipayAppId: present(process.env.ALIPAY_APP_ID),
    alipayPrivateKey: present(process.env.ALIPAY_PRIVATE_KEY),
    alipayPublicKey: present(process.env.ALIPAY_PUBLIC_KEY),

    // Scheduled work
    cronSecret: present(process.env.CRON_SECRET),
    subscribersJson: present(process.env.SUBSCRIBERS_JSON),

    // Notification
    smtpConfigured: present(process.env.SMTP_HOST) && present(process.env.SMTP_USER),

    googleSiteVerification: present(process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION),
  };

  // What is actually broken, in plain language. Order is severity order.
  const problems: string[] = [];
  if (!leadsDurable) {
    problems.push(
      "CRITICAL: leads are not stored anywhere. They go to the platform log and are lost. " +
        "Provision KV, link a Blob store, or set LEAD_WEBHOOK_URL."
    );
  } else if (blob) {
    problems.push(
      "DEGRADED: leads are durable via Blob, but quota tracking, magic-link auth and " +
        "order persistence still need KV and remain inert."
    );
  } else if (!kv) {
    problems.push(
      "DEGRADED: leads reach the webhook but not a queryable store, so quota tracking, " +
        "magic-link auth and order persistence are all inert."
    );
  }
  if (!checks.alipayAppId || !checks.alipayPrivateKey) {
    problems.push("No payment credential: orders fall back to manual transfer instruction.");
  }
  if (!checks.smtpConfigured) {
    problems.push("No mail provider: magic-link login cannot deliver a message.");
  }
  if (!checks.indexNowKey) {
    problems.push(
      "IndexNow not configured: crawlers will only re-visit on their own schedule, " +
        "which for a low-authority domain can be weeks."
    );
  }
  if (!checks.googleSiteVerification) {
    problems.push(
      "Google Search Console is not verified: sitemap submission and index-coverage " +
        "data are unavailable."
    );
  }

  const status = !leadsDurable ? "critical" : kv ? "ok" : "degraded";

  return NextResponse.json(
    {
      status,
      leadsDurable,
      checks,
      problems,
      note:
        "Presence only, no values. Unauthenticated so it can be polled; it exposes " +
        "nothing an attacker could use beyond what is already inferable from behaviour.",
    },
    { status: 200, headers: { "cache-control": "no-store" } }
  );
}