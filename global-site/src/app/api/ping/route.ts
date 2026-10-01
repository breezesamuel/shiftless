import { NextResponse } from "next/server";

/**
 * IndexNow ping.
 *
 * A sitemap in a robots.txt is a request, not a subscription: Google and Bing
 * will re-crawl on their own schedule, which for a low-authority site can be
 * weeks. IndexNow is a push protocol — you tell them "these URLs changed" and
 * they come within minutes. It is the only lever in this repo that changes how
 * fast the site gets seen.
 *
 * Requires INDEXNOW_KEY in env. Without it this returns a clear 503 rather than
 * a fake success, so nobody believes pings are going out when they are not.
 *
 * Note this only matters for crawlers that support IndexNow (Bing, and via
 * IndexNow's partner program others). Google does not accept it directly; for
 * Google the equivalent is re-submitting the sitemap in Search Console, which no
 * amount of code can do for us.
 */
export async function GET() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "INDEXNOW_KEY is not configured" },
      { status: 503 }
    );
  }

  const base = "https://shiftless.vercel.app";
  const urls = [
    `${base}/`,
    `${base}/ai-vs-human-cost`,
    `${base}/benchmarks`,
    `${base}/methodology`,
  ].map((url) => `${url}\n`);

  const targets = [
    "https://api.indexnow.org/indexnow",
    "https://www.bing.com/indexnow",
  ];

  const results: Record<string, string> = {};
  let anyOk = false;

  for (const target of targets) {
    try {
      const res = await fetch(target, {
        method: "POST",
        headers: {
          "content-type": "application/json; charset=utf-8",
          "authorization": `Bearer ${key}`,
        },
        body: JSON.stringify({ host: "shiftless.vercel.app", key, urlList: urls }),
      });
      results[target] = String(res.status);
      if (res.ok) anyOk = true;
    } catch (e) {
      results[target] = `error: ${String(e)}`;
    }
  }

  return NextResponse.json(
    { ok: anyOk, results },
    { status: anyOk ? 200 : 502 }
  );
}
