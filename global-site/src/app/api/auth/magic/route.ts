import { NextResponse } from "next/server";
import { createMagicToken } from "@/lib/auth";
import { sendMagicLink } from "@/lib/mail";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const hits = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 5;

function throttled(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_HOUR;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (throttled(ip)) {
    return NextResponse.json(
      { ok: false, error: "请求过于频繁，请稍后再试。" },
      { status: 429 }
    );
  }

  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "请求无效。" }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ ok: false, error: "请输入有效邮箱。" }, { status: 400 });
  }

  const token = createMagicToken(email);
  const origin = new URL(req.url).origin;
  const link = `${origin}/api/auth/session?token=${encodeURIComponent(token)}`;

  await sendMagicLink(email, link);

  // Always the same response, whether or not the address exists. Reporting
  // which emails are registered would turn this endpoint into an address book.
  return NextResponse.json({
    ok: true,
    message: "如果该邮箱可用，登录链接已发送。请查收邮件，10 分钟内有效。",
  });
}
