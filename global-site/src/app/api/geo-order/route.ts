import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

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

/** Path (relative to repo root) where pending subscriptions are staged. */
const PENDING_DIR = path.join(process.cwd(), "..", "..", "..", "geo", "subscriptions", "pending");

async function ensurePendingDir() {
  await fs.mkdir(PENDING_DIR, { recursive: true });
}

async function writePendingSubscription(order: Record<string, unknown>) {
  await ensurePendingDir();
  const file = path.join(PENDING_DIR, `${order.orderId}.json`);
  await fs.writeFile(file, JSON.stringify(order, null, 2), "utf8");
}

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

  const hook = process.env.ORDER_WEBHOOK_URL;
  if (hook) {
    fetch(hook, { method: "POST", body: JSON.stringify(order) }).catch(() => {});
  }

  // If it's a subscription, stage a pending file so the GitHub Action can
  // pick it up, generate the baseline, and commit it to subscribers.json.
  if (tier === "subscription") {
    await writePendingSubscription(order);
  }

  return NextResponse.json({
    ok: true,
    orderId,
    priceCny,
    siteUrl,
    manual: true,
    nextStep:
      tier === "subscription"
        ? `订单已记录（${orderId}）。请按下方支付方式转账 ¥${priceCny}，并备注订单号。到账后系统将自动建立基线、加入季度复审，并在下次部署时生效。`
        : `订单已记录（${orderId}）。请按下方支付方式转账 ¥${priceCny}，并备注订单号。到账后 48 小时内发送完整报告。`,
  });
}