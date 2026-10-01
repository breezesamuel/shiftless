import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import {
  bumpQuotaIfFree,
  isKvConfigured,
  StorageNotConfiguredError,
} from "@/lib/store";

const hits = new Map<string, number[]>();
const WINDOW_MS = 60 * 1000;
const MAX_PER_MIN = 10;

function throttled(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_MIN;
}

/**
 * Consume one free-tier use.
 *
 * Only authenticated users can be counted. Counting anonymous visitors would
 * mean keying quota on a shared IP, which both over-punishes offices behind
 * NAT and under-counts anyone using a VPN. Returning `not_signed_in` lets the
 * client decide how to prompt without pretending a decrement happened.
 */
export async function POST(req: Request) {
  if (!isKvConfigured()) {
    return NextResponse.json(
      { ok: false, error: "免费额度服务未就绪，请稍后再试。" },
      { status: 503 }
    );
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  if (throttled(ip)) {
    return NextResponse.json({ ok: false, error: "频率过高。" }, { status: 429 });
  }

  const jar = cookies();
  const session = verifySession(jar.get("shiftless_session")?.value || "");

  if (!session) {
    return NextResponse.json({
      ok: true,
      decremented: false,
      reason: "not_signed_in",
    });
  }

  try {
    const res = await bumpQuotaIfFree(session.userId);
    return NextResponse.json({
      ok: true,
      decremented: res.allowed,
      reason: res.allowed ? "counted" : "exhausted",
      quota: res.quota,
    });
  } catch (e) {
    if (e instanceof StorageNotConfiguredError) {
      return NextResponse.json(
        { ok: false, error: "免费额度服务未就绪，请稍后再试。" },
        { status: 503 }
      );
    }
    throw e;
  }
}
