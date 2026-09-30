/**
 * Payment channel configuration — what is actually live right now.
 *
 * The important thing this module does is refuse to imply a payment channel
 * works when it does not. `paymentChannels()` reads the environment and reports
 * only the channels that are genuinely configured, and `isChannelLive` is used
 * by the UI to label an unconfigured channel as unavailable instead of showing
 * a button that cannot complete.
 *
 * Hard constraint from the platform side, not a preference: WeChat Pay and
 * Alipay are separate closed-loop clearing systems. Money paid through WeChat
 * can only settle to a WeChat merchant account (商户号); it cannot be routed
 * into an Alipay balance, and vice versa. So "collect via both, settle
 * everything into Alipay" is not implementable. Each channel settles into its
 * own merchant account. This is why the config is per-channel rather than a
 * single settlement target.
 *
 * Secrets are read from the environment and are NEVER returned to the client.
 * Only booleans and public labels cross the boundary.
 */

import type { PaymentMethod } from "./referral";

export type ChannelStatus = {
  method: PaymentMethod;
  /** Stable id used in the DOM and in order records. */
  id: PaymentMethod;
  label: Record<"cny" | "usd", string>;
  /** True only when every required credential for this channel is present. */
  live: boolean;
  /** What the operator has to do before it goes live. Empty when live. */
  blockedOn: string;
  /** Human-readable next step shown to a customer. Never leaks a secret. */
  customerMessage: Record<"cny" | "usd", string>;
};

/**
 * Whether a channel is usable. Deliberately checks for the *pair* of secrets a
 * transaction needs, not just one: an Alipay app with a client id but no
 * signing key cannot take a payment, and half-configured is the exact state
 * that produces a broken checkout at the worst moment.
 */
function alipayLive(): boolean {
  return Boolean(
    process.env.ALIPAY_APP_ID && process.env.ALIPAY_PRIVATE_KEY
  );
}

function wechatLive(): boolean {
  return Boolean(
    process.env.WECHAT_MCH_ID && process.env.WECHAT_API_V3_KEY
  );
}

export function isChannelLive(method: PaymentMethod): boolean {
  return method === "alipay" ? alipayLive() : wechatLive();
}

/**
 * Status of every channel, in display order.
 *
 * When nothing is configured this returns both channels as not live, and the
 * UI must then say the manual path is the only one available rather than
 * offering a checkout that 500s.
 */
export function paymentChannels(): ChannelStatus[] {
  const alipayReady = alipayLive();
  const wechatReady = wechatLive();

  const channels: ChannelStatus[] = [
    {
      method: "alipay",
      id: "alipay",
      label: { cny: "支付宝", usd: "Alipay" },
      live: alipayReady,
      blockedOn: alipayReady
        ? ""
        : "缺少支付宝开放平台应用凭据（APP_ID + 应用私钥）。个人支付宝账号无法用于程序化收款，需要企业商户签约。",
      customerMessage: {
        cny: alipayReady
          ? "支付宝扫码支付，到账后自动开通。"
          : "支付宝通道开通中，暂时无法在线支付。",
        usd: alipayReady
          ? "Pay by Alipay; access is granted automatically on settlement."
          : "Alipay checkout is being set up. Online payment is not yet available.",
      },
    },
    {
      method: "wechat",
      id: "wechat",
      label: { cny: "微信支付", usd: "WeChat Pay" },
      live: wechatReady,
      blockedOn: wechatReady
        ? ""
        : "缺少微信支付商户号（MCH_ID）与 APIv3 密钥。微信收款必须结算到微信商户账户，无法转入支付宝。",
      customerMessage: {
        cny: wechatReady
          ? "微信扫码支付，到账后自动开通。"
          : "微信支付通道开通中，暂时无法在线支付。",
        usd: wechatReady
          ? "Pay by WeChat; access is granted automatically on settlement."
          : "WeChat checkout is being set up. Online payment is not yet available.",
      },
    },
  ];

  return channels;
}

/** True when at least one online channel can actually take money. */
export function anyChannelLive(): boolean {
  return paymentChannels().some((c) => c.live);
}

/**
 * The fallback when no channel is live. Manual bank transfer stays the real
 * path, and the copy has to admit a human confirms it.
 */
export const MANUAL_FALLBACK_COPY = {
  cny: "在线支付通道尚未开通。你仍然可以提交订单并线下转账，我们人工核对到账后开通。",
  usd: "Online checkout is not live yet. You can still place an order and pay by transfer; we confirm receipt manually.",
} as const;
