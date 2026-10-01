import { NextResponse } from "next/server";
import { consumeMagicToken, createSessionToken } from "@/lib/auth";
import { getOrCreateUser, StorageNotConfiguredError } from "@/lib/store";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ ok: false, error: "缺少 token。" }, { status: 400 });
  }

  let email: string;
  try {
    const consumed = await consumeMagicToken(token);
    if (!consumed) {
      return NextResponse.json(
        { ok: false, error: "登录链接无效或已过期，请重新获取。" },
        { status: 401 }
      );
    }
    email = consumed.email;
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) {
      return NextResponse.json(
        { ok: false, error: "登录服务未就绪，请联系管理员。" },
        { status: 503 }
      );
    }
    throw e;
  }

  let user;
  try {
    user = await getOrCreateUser(email);
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) {
      return NextResponse.json(
        { ok: false, error: "登录服务未就绪，请联系管理员。" },
        { status: 503 }
      );
    }
    throw e;
  }

  const session = createSessionToken(user.id, user.email);

  // httpOnly so the session cannot be read from JS or exfiltrated by XSS.
  // secure in production only, so the flow still works over http on localhost.
  const res = NextResponse.json({
    ok: true,
    email: user.email,
    userId: user.id,
  });
  res.cookies.set("shiftless_session", session, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return res;
}
