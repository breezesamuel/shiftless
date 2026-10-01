import { NextResponse } from "next/server";
import { createMagicToken } from "@/lib/auth";
import { sendMagicLink } from "@/lib/mail";
import { isKvConfigured, storageState } from "@/lib/store";

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
  if (!isKvConfigured()) {
    // KV 未配置时不要尝试发送邮件或生成 token。直接返回可操作的错误。
    return NextResponse.json(
      {
        ok: false,
        error: "登录服务未就绪：KV 存储未配置。请联系管理员配置 KV_REST_API_URL、KV_REST_API_TOKEN。",
      },
      { status: 503 }
    );
  }

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

  const result = await sendMagicLink(email, link);

  if (!result.sent) {
    // Do not claim a mail went out when no transport exists. Telling the user
    // "check your inbox" with nothing sent is exactly the kind of small lie
    // that erodes trust in every other number on the page.
    console.error(`[magic-link] not sent (${result.reason}) for ${email}`);
    return NextResponse.json(
      { ok: false, error: "邮件发送服务未配置，无法发送登录链接。" },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    storage: storageState(),
    message: "如果该邮箱可用，登录链接已发送。请查收邮件，10 分钟内有效。",
  });
}
