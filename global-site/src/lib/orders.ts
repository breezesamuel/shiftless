/**
 * Durable order records for paid subscriptions.
 *
 * The filesystem is read-only on serverless, so orders have to live in KV.
 * Before KV existed the only record was a log line, which meant a payment
 * notification had nothing to reconcile against and no way to grant an
 * entitlement. That is why this module refuses to "succeed" without storage:
 * recording an order is a precondition for taking money, so if it cannot be
 * persisted the checkout must not proceed.
 *
 * Idempotency
 * -----------
 * Alipay retries `trade.notify` until it sees the literal body "success", and a
 * customer can also hit the return page more than once. Granting access twice
 * would double-count referral months and could extend a subscription
 * indefinitely, so every state transition is guarded by an NX write that only
 * the first caller wins.
 */

import { isKvConfigured, StorageNotConfiguredError } from "@/lib/store";

export type OrderStatus = "pending" | "paid" | "refunded" | "closed";

export type Order = {
  orderId: string;
  outTradeNo: string;
  email: string;
  siteUrl: string;
  plan: string;
  months: number;
  currency: "cny" | "usd";
  /** Always the server-side price. Never trust a client-supplied amount. */
  amount: number;
  paymentMethod: "alipay" | "wechat" | "manual";
  status: OrderStatus;
  createdAt: string;
  paidAt?: string;
  tradeNo?: string;
  refundedAmount?: number;
};

const ORDER_TTL = 60 * 60 * 24 * 365;

export function ordersAvailable(): boolean {
  return isKvConfigured();
}

async function kvClient() {
  if (!isKvConfigured()) throw new StorageNotConfiguredError();
  const { kv } = await import("@vercel/kv");
  return kv;
}

export async function saveOrder(order: Order): Promise<void> {
  const kv = await kvClient();
  await kv.set(`order:${order.orderId}`, order, { ex: ORDER_TTL });
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const kv = await kvClient();
  return (await kv.get<Order>(`order:${orderId}`)) || null;
}

/** Alipay calls the merchant order id `out_trade_no`; ours is the same value. */
export async function getOrderByTradeNo(outTradeNo: string): Promise<Order | null> {
  const kv = await kvClient();
  return (await kv.get<Order>(`order:${outTradeNo}`)) || null;
}

export type MarkPaidResult =
  | { ok: true; order: Order; alreadyPaid: boolean }
  | { ok: false; reason: "not_found" | "already_final" };

/**
 * Mark an order paid and grant access, exactly once.
 *
 * Idempotency is keyed on the order's own `status` field, deliberately not on a
 * separate NX lock. An earlier version took an NX write as the mutex and then
 * performed the grant; if the process died between the two, every Alipay retry
 * would see the lock already claimed, skip the grant, and the customer would
 * have paid without ever getting access — with no error anywhere to explain it.
 *
 * Instead both writes are idempotent overwrites, and `status` is the record of
 * truth. Two concurrent duplicate notifications produce byte-identical writes,
 * which is harmless. `granted` tells the caller whether this call is the one
 * that actually transitioned the order, for logging.
 */
export async function markOrderPaid(
  orderId: string,
  tradeNo: string
): Promise<MarkPaidResult> {
  const kv = await kvClient();
  const order = await kv.get<Order>(`order:${orderId}`);
  if (!order) return { ok: false, reason: "not_found" };

  if (order.status === "refunded" || order.status === "closed") {
    return { ok: false, reason: "already_final" };
  }

  if (order.status === "paid") {
    // Duplicate notification. Re-assert the entitlement in case a previous run
    // died after the status write but before the grant, then report no change.
    await grantEntitlement(order);
    return { ok: true, order, alreadyPaid: true };
  }

  const paidAt = new Date().toISOString();
  const updated: Order = { ...order, status: "paid", paidAt, tradeNo };

  // Status first, then entitlement. If we die in between, the retry path above
  // re-asserts the entitlement, so no payment is ever left un-granted.
  await kv.set(`order:${order.orderId}`, updated, { ex: ORDER_TTL });
  await grantEntitlement(updated);

  return { ok: true, order: updated, alreadyPaid: false };
}

/**
 * Write the access grant for an order.
 *
 * Months come from the stored order, never from the pricing table: if prices
 * change, an order paid for last year still has to grant what was actually
 * paid for.
 */
export async function grantEntitlement(order: Order): Promise<void> {
  const kv = await kvClient();
  const months = monthsGranted(order);
  await kv.set(
    `entitlement:${order.email.toLowerCase()}`,
    {
      plan: order.plan,
      months,
      orderId: order.orderId,
      paidAt: order.paidAt,
    },
    { ex: ORDER_TTL }
  );
}

/** Record a refund. Idempotent per request id so retries cannot double-refund. */
export async function markOrderRefunded(
  orderId: string,
  amount: number,
  requestNo: string
): Promise<{ ok: boolean; alreadyRefunded: boolean }> {
  const kv = await kvClient();
  const order = await kv.get<Order>(`order:${orderId}`);
  if (!order) return { ok: false, alreadyRefunded: false };

  const already = await kv.get<string>(`refunded:${orderId}`);
  if (already) return { ok: true, alreadyRefunded: true };

  await kv.set(`refunded:${orderId}`, requestNo, { ex: ORDER_TTL });
  const updated: Order = {
    ...order,
    status: "refunded",
    refundedAmount: amount,
  };
  await kv.set(`order:${orderId}`, updated, { ex: ORDER_TTL });
  return { ok: true, alreadyRefunded: false };
}

/**
 * Months of access an order grants.
 *
 * Kept as data on the order so entitlement logic never has to re-read the
 * pricing table for a historical order — if prices change later, past orders
 * must still grant exactly what was paid for.
 */
export function monthsGranted(order: Order): number {
  return Math.max(0, Math.floor(order.months));
}
