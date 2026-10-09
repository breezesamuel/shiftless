import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { DEFAULTS, decodeState, encodeState, type Inputs } from "@/lib/model";
import { paypalConfigured, createOrder } from "@/lib/paypal";
import { sendOwnerAlert } from "@/lib/mail";
import { saveOrder } from "@/lib/store";
import { emit } from "@/lib/agent";

const SITE = "https://shiftless.vercel.app";

/**
 * Order intake.
 *
 * What this endpoint deliberately does NOT do, and why:
 *
 * 1. It never trusts a client-supplied amount. The client posts {tier}; the
 *    price comes from PRICES below. A handler that reads amount from the body
 *    is a handler that sells your product for $0.01.
 *
 * 2. It does not pretend to take payment autonomously on every path. The card
 *    rail goes through PayPal only when PAYPAL_CLIENT_ID/SECRET are present;
 *    if creation fails, or the credential is absent, it falls back to the
 *    manual flow — record the order, give transfer instructions, fulfil when
 *    funds land. A missing credential must never produce a redirect that 500s.
 *
 * 3. It does not store the inputs. The buyer's scenario round-trips through a
 *    signed-looking permalink, not through our database, so the report is
 *    regenerated from the URL and there is no PII retained server-side.
 */

const PRICES: Record<string, number> = {
  standard: 49,
  review: 149,
};

// Crude in-memory throttle. Serverless instances do not share it, so this is a
// speed bump against a bored script, not a security control. Real rate limiting
// needs a shared store; do not mistake this for one.
//
// 10/hour is deliberately generous for a human (nobody starts eleven checkouts
// in an hour) and cheap for an attacker to keep hitting. The point is to make
// unattended card-testing unprofitable, not to lock out a real buyer.
const hits = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 10;

function throttled(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_HOUR;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validInputs(raw: unknown): Inputs {
  const base: Inputs = { ...DEFAULTS };
  if (!raw || typeof raw !== "object") return base;
  // Round-trip through the URL codec: only known keys survive, every value is
  // clamped to the same bounds as the sliders, and anything unparseable is
  // dropped. That is the only sanitiser between the request body and the
  // numbers that get billed and rendered into the deliverable.
  //
  // encodeState reads every field unconditionally, so absent fields serialise as
  // "NaN" and are then dropped by decodeState. That means the decode result is
  // a *partial*, and must be merged over DEFAULTS — returning it directly would
  // hand the report generator an Inputs with holes in it.
  const cleaned = decodeState(encodeState(raw as Inputs));
  return { ...base, ...cleaned };
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (throttled(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many checkout attempts. Try again in an hour." },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const email = String(body.email || "").trim();
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, error: "Enter a valid email." }, { status: 400 });
  }

  const tier = String(body.tier || "");
  const price = PRICES[tier];
  if (price === undefined) {
    return NextResponse.json({ ok: false, error: "Unknown product." }, { status: 400 });
  }

  const rail = body.rail === "alipay" ? "alipay" : "card";
  const inputs = validInputs(body.inputs);
  // Referrer attribution from a shared ?ref= link, forwarded by the checkout
  // form. An email-shaped value is kept and shown to the operator so the
  // referral programme can be settled; anything else is dropped.
  const ref =
    typeof body.ref === "string" && EMAIL.test(body.ref.trim())
      ? body.ref.trim().toLowerCase().slice(0, 254)
      : undefined;
  const orderId = "SHF-" + randomUUID().slice(0, 8).toUpperCase();
  const permalink = `https://shiftless.vercel.app/report?${encodeState(inputs)}`;

  const order = {
    orderId,
    email,
    tier,
    priceUsd: price,
    rail,
    channel: inputs.channel,
    monthlyTickets: inputs.monthlyTickets,
    ahtMinutes: inputs.ahtMinutes,
    automationCoverage: inputs.automationCoverage,
    permalink,
    ref,
    ts: new Date().toISOString(),
  };
  console.log(`[ORDER] ${JSON.stringify(order)}`);

  const hook = process.env.ORDER_WEBHOOK_URL;
  if (hook) {
    // Fire and forget: a webhook outage must not lose the order that the
    // console log already recorded.
    fetch(hook, { method: "POST", body: JSON.stringify(order) }).catch(() => {});
  }

  // Card rail: create the PayPal checkout only when the credential exists and
  // PayPal actually accepts the order. Every failure path lands on the manual
  // response below — the order is already logged, so nothing is lost by asking
  // the buyer to transfer instead.
  let paymentUrl: string | undefined;
  if (rail !== "alipay" && paypalConfigured()) {
    const pay = await createOrder({
      amount: price.toFixed(2),
      orderId,
      description: `Shiftless ${tier} report`,
      returnUrl: `${SITE}/api/paypal/return?orderId=${orderId}&permalink=${encodeURIComponent(permalink)}${
        ref ? `&ref=${encodeURIComponent(ref)}` : ""
      }`,
      cancelUrl: `${SITE}/`,
    });
    if (pay) {
      console.log(`[ORDER] paypal created ${orderId} ${pay.id}`);
      paymentUrl = pay.approveUrl;
    } else {
      console.log(`[ORDER] paypal create failed ${orderId} — manual fallback`);
    }
  }

  // Persist the order so the operator can query it (admin table, exports).
  // Fire-and-forget: the order is already logged and alerted above.
  void saveOrder({
    orderId,
    email,
    tier,
    priceUsd: price,
    rail,
    channel: inputs.channel,
    monthlyTickets: inputs.monthlyTickets,
    ahtMinutes: inputs.ahtMinutes,
    ref,
    permalink,
    ts: order.ts,
    paymentState: paymentUrl ? "checkout-created" : "manual",
  });
  void emit("order", { ...order, lang: "en" });

  // Operator alert. An order nobody is told about is an order that never
  // converts — the buyer transferred or was about to, and the only person who
  // can fulfil it hears nothing. Fired after the PayPal attempt so the alert
  // states which rail the buyer actually got. Best-effort: the order is already
  // logged and webhooked above, so a mail failure never fails the checkout.
  let alerted = false;
  try {
    const r = await sendOwnerAlert(
      `[Shiftless] 新订单 ${orderId} — $${price} ${tier}`,
      [
        "计算器提交了一个新订单。",
        "",
        `orderId: ${orderId}`,
        `email: ${email}`,
        `tier: ${tier}`,
        `priceUsd: ${price}`,
        `rail: ${rail}`,
        `channel: ${inputs.channel}`,
        `monthlyTickets: ${inputs.monthlyTickets}`,
        `ahtMinutes: ${inputs.ahtMinutes}`,
        ref ? `ref: ${ref}` : null,
        `checkout: ${paymentUrl ? "PayPal checkout created" : "manual transfer"}`,
        "",
        `报告链接: ${permalink}`,
      ].join("\n")
    );
    alerted = r.sent;
    if (!r.sent) console.log(`[ORDER-ALERT-FAIL] ${r.reason}`);
  } catch (e) {
    console.log(`[ORDER-ALERT-FAIL] ${String(e)}`);
  }

  return NextResponse.json({
    ok: true,
    orderId,
    priceUsd: price,
    permalink,
    // Absent exactly when no checkout could be created. Saying so plainly is
    // better than redirecting into a checkout that 500s at the worst moment.
    manual: !paymentUrl,
    paymentUrl,
    alerted,
    nextStep: paymentUrl
      ? `Complete the payment in the PayPal window; your order reference is ${orderId}.`
      : `Transfer $${price} with ${orderId} in the remark using the transfer details shown on this page, then send the receipt screenshot to supi24@163.com. No confirmation email is sent automatically.`,
  });
}
