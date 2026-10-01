import { NextResponse } from "next/server";
import { getOrder } from "@/lib/orders";

/**
 * Where the customer's browser lands after Alipay's cashier page.
 *
 * This page grants nothing. It reports what the order's stored status is, which
 * may still be `pending` for several seconds after the user pays, because
 * Alipay's server-to-server notification is the authoritative signal and can
 * arrive after the browser redirect.
 *
 * Hence the wording: we cannot claim the payment succeeded, only that it was
 * submitted and whether we have confirmed it yet. Claiming success here would
 * mean telling a customer their subscription is active while the webhook has
 * not yet confirmed anything.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const orderId = (url.searchParams.get("out_trade_no") || "").trim();
  const tradeStatus = url.searchParams.get("trade_status") || "";

  if (!orderId) {
    return NextResponse.json(
      { ok: false, error: "缺少订单号。" },
      { status: 400 }
    );
  }

  let order = null;
  try {
    order = await getOrder(orderId);
  } catch {
    order = null;
  }

  const confirmed = order?.status === "paid";

  // Alipay sends the customer here on a real HTTP redirect, so the response is
  // a small HTML page rather than JSON. A JSON body here would look like a
  // broken site.
  const title = confirmed
    ? "支付成功，订阅已开通"
    : tradeStatus === "TRADE_CLOSED"
      ? "支付未完成"
      : "正在确认支付结果";

  const body = confirmed
    ? `订单 ${orderId} 已确认到账，${order?.months} 个月有效期已开通。确认邮件会发到 ${order?.email}。`
    : tradeStatus === "TRADE_CLOSED"
      ? `订单 ${orderId} 未完成支付，没有扣款。如需重新支付请回到下单页面。`
      : `订单 ${orderId} 已提交支付。我们正在向支付宝确认到账，通常几秒内完成；确认后会自动开通，无需重复付款。`;

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${title}</title>
</head>
<body style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:48px 20px">
  <main style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:32px">
    <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
    <p style="line-height:1.7;color:#334155;margin:0 0 24px">${escapeHtml(body)}</p>
    <a href="/geo/subscribe" style="display:inline-block;background:#047857;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px">返回订阅页</a>
  </main>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
