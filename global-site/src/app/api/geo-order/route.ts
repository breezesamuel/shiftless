import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { sendOwnerAlert } from "@/lib/mail";
import { saveOrder } from "@/lib/store";
import { emit } from "@/lib/agent";

const PRICES: Record<string, number> = {
  report: 1999,
  fix: 4999,
  subscription: 2999,
};

const hits = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 6;

function throttled(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > MAX_PER_HOUR;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const URL_ORIGIN = /^https?:\/\/[a-z0-9.-]+(\.[a-z]{2,}){1,}(:\d{1,5})?$/i;

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (throttled(ip)) {
    return NextResponse.json(
      { ok: false, error: "提交过于频繁，请一小时后再试。" },
      { status: 429 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "请求无效。" }, { status: 400 });
  }

  const email = String(body.email || "").trim();
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, error: "请输入有效邮箱。" }, { status: 400 });
  }

  const siteUrl = String(body.siteUrl || "").trim();
  if (!URL_ORIGIN.test(siteUrl) || siteUrl.length > 200) {
    return NextResponse.json(
      { ok: false, error: "请输入有效的网站根地址，例如 https://example.com。" },
      { status: 400 }
    );
  }

  const tier = String(body.tier || "");
  const priceCny = PRICES[tier];
  if (priceCny === undefined) {
    return NextResponse.json({ ok: false, error: "未知产品档位。" }, { status: 400 });
  }

  const orderId = "GEO-" + randomUUID().slice(0, 8).toUpperCase();
  const order = {
    orderId,
    email,
    tier,
    priceCny,
    siteUrl,
    ts: new Date().toISOString(),
  };
  console.log(`[GEO-ORDER] ${JSON.stringify(order)}`);

  // Mirror into the Blob ledger + emit the order event so the manual GEO
  // order appears in the /admin cockpit with its own "Confirm paid" action.
  void saveOrder({
    orderId,
    email,
    tier,
    priceUsd: priceCny,
    rail: "geo",
    ts: order.ts,
    paymentState: "manual",
    amount: String(priceCny),
    currency: "CNY",
  });
  void emit("order", { orderId, email, tier, priceUsd: priceCny, lang: "zh", currency: "CNY" });

  const hook = process.env.ORDER_WEBHOOK_URL;
  if (hook) {
    fetch(hook, { method: "POST", body: JSON.stringify(order) }).catch(() => {});
  }

  // Order capture above (log + webhook) is the durable record.
  // Nothing is written to the filesystem here on purpose: serverless
  // filesystems are read-only, and an order must never 500 after the
  // lead has already been captured. Subscription activation happens
  // after payment is confirmed, by adding the site to
  // geo/subscriptions/subscribers.json and deploying.
  // Same reasoning as the other order routes: the order is recorded, but the
  // only person who can fulfil it needs to be told. Best-effort — a mail
  // failure must not turn a captured GEO order into an error page.
  let alerted = false;
  try {
    const r = await sendOwnerAlert(
      `[Shiftless] 新 GEO 订单 ${orderId} — ¥${priceCny} ${tier}`,
      [
        "GEO 审计提交了一个新订单。",
        "",
        `orderId: ${orderId}`,
        `email: ${email}`,
        `tier: ${tier}`,
        `priceCny: ${priceCny}`,
        `siteUrl: ${siteUrl}`,
        "",
        "到账后需人工确认并交付。",
      ].join("\n")
    );
    alerted = r.sent;
    if (!r.sent) console.log(`[GEO-ORDER-ALERT-FAIL] ${r.reason}`);
  } catch (e) {
    console.log(`[GEO-ORDER-ALERT-FAIL] ${String(e)}`);
  }

  return NextResponse.json({
    ok: true,
    orderId,
    priceCny,
    siteUrl,
    manual: true,
    alerted,
    nextStep:
      tier === "subscription"
        ? `订单已记录（${orderId}）。请按下方支付方式转账 ¥${priceCny}，并备注订单号。到账后我们人工确认并把站点加入季度复审名单，基线在下次发布时生效。`
        : `订单已记录（${orderId}）。请按下方支付方式转账 ¥${priceCny}，并备注订单号。到账后 48 小时内发送完整报告。`,
  });
}