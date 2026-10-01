import { NextResponse } from "next/server";

import { verifyNotify, ALIPAY_NOTIFY_BODY } from "@/lib/alipay";
import { markOrderPaid, getOrderByTradeNo, monthsGranted } from "@/lib/orders";

/**
 * Alipay asynchronous payment notification.
 *
 * This is the only endpoint that grants access. The browser return page never
 * does — a customer can close the tab after paying, and a return page is fully
 * under their control, so treating it as proof of payment would let anyone
 * self-grant a subscription by visiting a URL.
 *
 * Response contract: Alipay stops retrying only when it reads the literal body
 * `success`. Anything else triggers retries, which is what we want for a
 * transient failure but not for a signature that will never validate — so
 * malformed messages are logged and still acknowledged as `failure` while a
 * genuinely retryable error (storage down) is left to be retried.
 *
 * Content type is form-urlencoded, not JSON.
 */
export async function POST(req: Request) {
  let params: Record<string, string>;
  try {
    const form = await req.formData();
    params = {};
    form.forEach((v, k) => {
      if (typeof v === "string") params[k] = v;
    });
  } catch {
    return new NextResponse(ALIPAY_NOTIFY_BODY.failure, { status: 400 });
  }

  if (!params.out_trade_no) {
    console.warn("[alipay-notify] missing out_trade_no");
    return new NextResponse(ALIPAY_NOTIFY_BODY.failure, { status: 400 });
  }

  const order = await getOrderByTradeNo(params.out_trade_no).catch((e) => {
    console.error("[alipay-notify] order lookup failed", e);
    return null;
  });

  if (!order) {
    // Never acknowledge an order we cannot reconcile: acknowledging stops
    // retries, and silently dropping a payment is worse than a retry storm.
    console.error(
      `[alipay-notify] no local order for out_trade_no=${params.out_trade_no}`
    );
    return new NextResponse(ALIPAY_NOTIFY_BODY.failure, { status: 200 });
  }

  // The expected amount comes from our own stored order, never from the message.
  const verdict = verifyNotify(params, order.currency === "cny" ? order.amount : null);

  if (!verdict.ok) {
    console.error(
      `[alipay-notify] rejected out_trade_no=${params.out_trade_no} reason=${verdict.reason}`
    );
    return new NextResponse(ALIPAY_NOTIFY_BODY.failure, { status: 200 });
  }

  if (verdict.event !== "paid") {
    console.log(
      `[alipay-notify] non-final status ${params.trade_status} for ${verdict.outTradeNo}`
    );
    return new NextResponse(ALIPAY_NOTIFY_BODY.success, { status: 200 });
  }

  try {
    const result = await markOrderPaid(order.orderId, verdict.tradeNo);
    if (!result.ok) {
      console.error(
        `[alipay-notify] could not settle order ${order.orderId}: ${result.reason}`
      );
      return new NextResponse(ALIPAY_NOTIFY_BODY.failure, { status: 200 });
    }

    if (result.alreadyPaid) {
      // markOrderPaid re-asserted the entitlement, so a retry after a partial
      // failure is still repaired here. Nothing to announce.
      console.log(`[alipay-notify] duplicate notify re-asserted ${order.orderId}`);
    } else {
      console.log(
        `[ALIPAY-PAID] order=${result.order.orderId} plan=${result.order.plan} months=${monthsGranted(
          result.order
        )}`
      );
    }

    return new NextResponse(ALIPAY_NOTIFY_BODY.success, { status: 200 });
  } catch (e) {
    // Retryable: let Alipay call again rather than losing the grant.
    console.error("[alipay-notify] settlement failed, will retry", e);
    return new NextResponse(ALIPAY_NOTIFY_BODY.failure, { status: 200 });
  }
}
