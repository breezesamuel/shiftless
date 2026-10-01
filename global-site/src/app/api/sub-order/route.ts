import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

import { getPlan, isCurrency, priceOf, PLANS, FREE_USES } from "@/lib/pricing";
import type { PlanId } from "@/lib/pricing";
import {
  isChannelLive,
  anyChannelLive,
  paymentChannels,
  channelSupportsCurrency,
} from "@/lib/payments";
import type { PaymentMethod } from "@/lib/referral";
import { buildPagePay, AlipayNotConfiguredError } from "@/lib/alipay";
import { saveOrder, ordersAvailable } from "@/lib/orders";

/**
 * Subscription order intake.
 *
 * What this endpoint does: validates input, prices it from the server-side
 * table, records the intent, and tells the customer honestly what happens
 * next.
 *
 * What it deliberately does NOT do: it does not activate anything. No
 * entitlement is granted here. Activation happens after money is confirmed,
 * and that requires a payment webhook (online) or a human confirming a
 * transfer (offline). Pretending otherwise would let anyone grant themselves
 * a year of service by POSTing a form.
 *
 * Prices come from lib/pricing, never from the request body. A client that
 * sends `price: 0` is ignored.
 */

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

  const planRaw = body.plan;
  const plan = getPlan(planRaw);
  if (!plan) {
    return NextResponse.json(
      { ok: false, error: "未知订阅档位。", validPlans: Object.keys(PLANS) },
      { status: 400 }
    );
  }

  const currency = isCurrency(body.currency) ? body.currency : "cny";

  // Payment method is optional. An unconfigured channel is downgraded to
  // manual rather than rejected, so a customer is never shown a dead end.
  const methodRaw = String(body.paymentMethod || "");
  const requested =
    methodRaw === "alipay" || methodRaw === "wechat" ? (methodRaw as PaymentMethod) : null;

  // A channel that is live but cannot settle this currency is also downgraded.
  // Alipay settles CNY only, so a USD order must not be sent to its gateway.
  const method: PaymentMethod | null =
    requested && isChannelLive(requested) && channelSupportsCurrency(requested, currency)
      ? requested
      : null;

  const price = priceOf(planRaw as PlanId, currency);

  const orderId = "SUB-" + randomUUID().slice(0, 8).toUpperCase();
  const order = {
    orderId,
    email,
    siteUrl,
    plan: plan.id,
    months: plan.months,
    currency,
    price,
    paymentMethod: method,
    // Distinguishes "customer asked for online pay" from "manual fallback",
    // which matters for reconciliation.
    path: method ? "online" : "manual",
    ts: new Date().toISOString(),
  };

  // Online checkout additionally requires somewhere to record the order: the
  // payment notification has to reconcile against a stored amount, and without
  // storage there is nothing to grant access against. Rather than take money we
  // cannot later honour, fall back to the manual path.
  if (method === "alipay") {
    if (!ordersAvailable()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "在线支付正在配置中（订单存储尚未就绪），暂时无法直接付款。请提交订单后由我们人工确认开通。",
        },
        { status: 503 }
      );
    }

    try {
      // out_trade_no is what Alipay echoes on both the return redirect and the
      // async notify, so the order id is used directly as the trade number.
      const pay = buildPagePay({
        outTradeNo: orderId,
        amount: price,
        subject: `Shiftless ${plan.id} 订阅 ${plan.months} 个月`,
        passbackParams: orderId,
      });

      await saveOrder({
        orderId,
        outTradeNo: orderId,
        email,
        siteUrl,
        plan: plan.id,
        months: plan.months,
        currency,
        amount: price,
        paymentMethod: "alipay",
        status: "pending",
        createdAt: order.ts,
      });

      console.log(
        `[SUB-ORDER] ${orderId} alipay checkout created for CNY ${price} (${plan.months}mo)`
      );

      const hook = process.env.ORDER_WEBHOOK_URL;
      if (hook) {
        fetch(hook, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(order),
        }).catch(() => {});
      }

      return NextResponse.json({
        ok: true,
        orderId,
        plan: plan.id,
        months: plan.months,
        currency,
        price,
        priceCny: currency === "cny" ? price : undefined,
        siteUrl,
        manual: false,
        onlineCheckoutAvailable: true,
        // The customer is sent here by the client. It contains a signature, so it
        // is not logged and not exposed to any other origin.
        paymentUrl: pay.url,
        freeUsesIncluded: FREE_USES,
        channels: paymentChannels().map((c) => ({
          id: c.id,
          label: c.label,
          live: c.live,
        })),
        nextStep: `订单 ${orderId} 已创建。请在支付宝完成支付，到账后自动开通 ${plan.months} 个月，无需重复付款。`,
      });
    } catch (e) {
      if (e instanceof AlipayNotConfiguredError) {
        return NextResponse.json(
          { ok: false, error: "支付宝通道配置不完整，暂时无法支付。" },
          { status: 503 }
        );
      }
      console.error(`[SUB-ORDER] alipay checkout failed for ${orderId}`, e);
      return NextResponse.json(
        { ok: false, error: "创建支付失败，请稍后再试。" },
        { status: 502 }
      );
    }
  }

  // Durable-enough record for the manual path. The filesystem is read-only on
  // serverless, so this is a log line plus an optional external webhook.
  // Neither grants access.
  console.log(`[SUB-ORDER] ${JSON.stringify(order)}`);

  const hook = process.env.ORDER_WEBHOOK_URL;
  if (hook) {
    fetch(hook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(order),
    }).catch(() => {});
  }

  const online = anyChannelLive();

  return NextResponse.json({
    ok: true,
    orderId,
    plan: plan.id,
    months: plan.months,
    currency,
    price,
    // Echoed so the client can display exactly what the server priced. The
    // client never sets this itself.
    priceCny: currency === "cny" ? price : undefined,
    priceUsd: currency === "usd" ? price : undefined,
    siteUrl,
    manual: method === null,
    onlineCheckoutAvailable: online,
    freeUsesIncluded: FREE_USES,
    channels: paymentChannels().map((c) => ({
      id: c.id,
      label: c.label,
      live: c.live,
    })),
    // WeChat is the only channel that can reach here as a live online method
    // (Alipay returns earlier with a paymentUrl).
    nextStep: method
      ? `订单已记录（${orderId}）。请完成微信支付；到账后自动开通 ${plan.months} 个月。`
      : online
        ? `订单已记录（${orderId}）。你选择的在线通道当前不可用，请改选其他支付方式，或提交后由我们人工确认。`
        : `订单已记录（${orderId}）。在线支付尚未开通，请提交订单后线下转账并备注订单号；我们人工核对到账后开通 ${plan.months} 个月。`,
  });
}
