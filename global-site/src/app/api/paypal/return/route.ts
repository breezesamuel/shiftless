import { NextResponse } from "next/server";
import { captureOrder } from "@/lib/paypal";
import { sendOwnerAlert } from "@/lib/mail";

/**
 * PayPal return hop.
 *
 * PayPal redirects the buyer here with ?token=<paypal order id> appended to
 * the return_url we set at creation. We capture immediately and log the result
 * the same way every other order path does: stdout plus the optional webhook,
 * because KV is still unavailable and a captured payment that is not logged
 * is indistinguishable from a payment that never happened.
 *
 * This route trusts nothing from the query except the PayPal order id — the
 * amount and currency come back from PayPal's capture response, never from
 * the URL.
 */

const SITE = "https://shiftless.vercel.app";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(title: string, body: string): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>${escapeHtml(title)} · Shiftless</title></head>` +
      `<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem;line-height:1.6;color:#0f172a">` +
      body +
      `</body></html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";
  const orderId = (url.searchParams.get("orderId") || "").slice(0, 40);
  const rawPermalink = url.searchParams.get("permalink") || "";
  // Only our own report URLs survive the round trip; anything else in the
  // query is discarded rather than reflected back into the page.
  const permalink = rawPermalink.startsWith(`${SITE}/report?`)
    ? rawPermalink
    : "";

  const result = await captureOrder(token);

  if (result && result.ok) {
    const record = {
      orderId,
      rail: "paypal",
      paypalOrderId: result.paypalOrderId,
      amount: result.amount,
      currency: result.currency,
      payer: result.payerEmail,
      status: result.status,
      ts: new Date().toISOString(),
    };
    console.log(`[ORDER] ${JSON.stringify(record)}`);

    const hook = process.env.ORDER_WEBHOOK_URL;
    if (hook) {
      fetch(hook, { method: "POST", body: JSON.stringify(record) }).catch(() => {});
    }

    // This is the money moment: money is confirmed captured. The operator needs
    // to deliver, so a capture with no notification is the most expensive
    // silent failure there is. Best-effort — the record is already logged.
    let alerted = false;
    try {
      const r = await sendOwnerAlert(
        `[Shiftless] 已收款 ${orderId} — ${result.amount} ${result.currency}`,
        [
          "PayPal 已确认收款，需要交付。",
          "",
          `orderId: ${orderId}`,
          `paypalOrderId: ${result.paypalOrderId}`,
          `amount: ${result.amount}`,
          `currency: ${result.currency}`,
          `payer: ${result.payerEmail}`,
          `status: ${result.status}`,
        ].join("\n")
      );
      alerted = r.sent;
      if (!r.sent) console.log(`[PAYMENT-ALERT-FAIL] ${r.reason}`);
    } catch (e) {
      console.log(`[PAYMENT-ALERT-FAIL] ${String(e)}`);
    }
    console.log(`[PAYMENT] captured ${orderId} alert=${alerted ? "ok" : "no"}`);

    return page(
      "Payment confirmed",
      `<h1 style="font-size:1.5rem;margin:0 0 1rem">Payment confirmed</h1>` +
        `<p>Order <strong>${escapeHtml(orderId)}</strong> — ${escapeHtml(result.amount)} ${escapeHtml(result.currency)} received.</p>` +
        `<p>Keep this order reference; delivery follows within one business day.</p>` +
        (permalink
          ? `<p><a href="${escapeHtml(permalink)}" style="color:#0f172a">Open your report &rarr;</a></p>`
          : "") +
        `<p style="color:#64748b;font-size:.875rem">No confirmation email is sent automatically — quote the order reference in any reply.</p>`
    );
  }

  const status = result && !result.ok ? result.status : "unreachable";
  console.log(`[ORDER] paypal capture failed ${orderId} token=${token} (${status})`);

  return page(
    "Payment not completed",
    `<h1 style="font-size:1.5rem;margin:0 0 1rem">Payment not completed</h1>` +
      `<p>PayPal did not confirm a capture (${escapeHtml(status)}).</p>` +
      `<p>If you were charged, email <strong>supi24@163.com</strong> with order reference <strong>${escapeHtml(orderId)}</strong> and we will reconcile it manually.</p>` +
      `<p><a href="${SITE}/" style="color:#0f172a">Back to Shiftless</a></p>`,
  );
}
