import { NextResponse } from "next/server";
import crypto from "crypto";

import { buildRefund, callAlipay, AlipayNotConfiguredError } from "@/lib/alipay";
import { getOrder, markOrderRefunded } from "@/lib/orders";
import { getPlan } from "@/lib/pricing";
import type { PlanId } from "@/lib/pricing";

/**
 * Refund an order.
 *
 * Guarded by ALIPAY_ADMIN_TOKEN rather than the cron secret: refunding moves
 * money out, so it should not share a credential with "run the audit". The token
 * is compared in constant time to avoid leaking the value by response timing.
 */
function authorised(req: Request): boolean {
  const token = process.env.ALIPAY_ADMIN_TOKEN;
  if (!token) return false;

  const header = req.headers.get("authorization") || "";
  const presented = header.startsWith("Bearer ") ? header.slice(7) : "";

  const a = Buffer.from(presented);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorised(req)) {
    return NextResponse.json({ ok: false, error: "未授权。" }, { status: 401 });
  }

  let body: { orderId?: string; amount?: number; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "请求无效。" }, { status: 400 });
  }

  const orderId = String(body.orderId || "").trim();
  if (!orderId) {
    return NextResponse.json({ ok: false, error: "缺少 orderId。" }, { status: 400 });
  }

  let order;
  try {
    order = await getOrder(orderId);
  } catch {
    return NextResponse.json(
      { ok: false, error: "订单存储不可用，无法退款。" },
      { status: 503 }
    );
  }

  if (!order) {
    return NextResponse.json({ ok: false, error: "订单不存在。" }, { status: 404 });
  }

  if (order.status !== "paid") {
    return NextResponse.json(
      { ok: false, error: `订单状态为 ${order.status}，只有已支付订单可以退款。` },
      { status: 409 }
    );
  }

  // Default to a full refund. A partial amount must be positive and must not
  // exceed what was actually collected, or the gateway rejects it after we have
  // already recorded the intent.
  const amount = Number(body.amount ?? order.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "退款金额无效。" }, { status: 400 });
  }
  if (amount > order.amount + 0.001) {
    return NextResponse.json(
      { ok: false, error: "退款金额不能超过实收金额。" },
      { status: 400 }
    );
  }

  const plan = getPlan(order.plan as PlanId);
  const outRequestNo = `refund-${orderId}-${Date.now()}`;

  try {
    const req2 = buildRefund({
      outTradeNo: order.outTradeNo,
      refundAmount: amount,
      outRequestNo,
      reason: body.reason || `refund for ${orderId}`,
    });

    const reply = (await callAlipay(req2)) as {
      code?: string;
      msg?: string;
      sub_code?: string;
    };

    // Alipay returns HTTP 200 with a non-"10000" code on business failure, so
    // checking res.ok alone would record refunds that never happened.
    if (reply.code !== "10000") {
      return NextResponse.json(
        {
          ok: false,
          error: "支付宝拒绝了退款请求。",
          alipayCode: reply.code,
          alipayMsg: reply.sub_code || reply.msg,
        },
        { status: 502 }
      );
    }

    await markOrderRefunded(orderId, amount, outRequestNo);

    return NextResponse.json({
      ok: true,
      orderId,
      refundAmount: amount,
      plan: plan ? plan.id : order.plan,
    });
  } catch (e) {
    if (e instanceof AlipayNotConfiguredError) {
      return NextResponse.json(
        { ok: false, error: `支付宝未完整配置：${e.missing.join("、")}` },
        { status: 503 }
      );
    }
    console.error("[alipay-refund] failed", e);
    return NextResponse.json(
      { ok: false, error: "退款请求失败，请查看服务端日志。" },
      { status: 502 }
    );
  }
}
