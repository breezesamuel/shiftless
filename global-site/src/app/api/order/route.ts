import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { DEFAULTS, decodeState, encodeState, type Inputs } from "@/lib/model";

/**
 * Order intake.
 *
 * What this endpoint deliberately does NOT do, and why:
 *
 * 1. It never trusts a client-supplied amount. The client posts {tier}; the
 *    price comes from PRICES below. A handler that reads amount from the body
 *    is a handler that sells your product for $0.01.
 *
 * 2. It does not pretend to take payment autonomously. There is no Stripe,
 *    Creem or PayPal credential in this deployment, so a "paymentUrl" here
 *    would be a fabricated redirect to nowhere. The honest flow at this volume
 *    is: record the order, give the buyer instructions, fulfil manually once
 *    funds land. Five sales a month does not need a checkout integration.
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
    ts: new Date().toISOString(),
  };
  console.log(`[ORDER] ${JSON.stringify(order)}`);

  const hook = process.env.ORDER_WEBHOOK_URL;
  if (hook) {
    // Fire and forget: a webhook outage must not lose the order that the
    // console log already recorded.
    fetch(hook, { method: "POST", body: JSON.stringify(order) }).catch(() => {});
  }

  return NextResponse.json({
    ok: true,
    orderId,
    priceUsd: price,
    permalink,
    // No paymentUrl: no payment credential is configured. Saying so plainly is
    // better than redirecting into a checkout that 500s at the worst moment.
    manual: true,
    nextStep: `Send $${price} quoting ${orderId} to the payment address on our contact page, then reply to the confirmation email with the order reference.`,
  });
}
