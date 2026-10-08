import { NextResponse } from "next/server";

import sitemap from "@/app/sitemap";

/**
 * IndexNow ping — full sitemap push, not a token of four URLs.
 *
 * A sitemap in a robots.txt is a request, not a subscription: Google and Bing
 * will re-crawl on their own schedule, which for a low-authority site can be
 * weeks. IndexNow is a push protocol — you tell them "these URLs changed" and
 * they come within minutes. It is the only lever in this repo that changes how
 * fast the site gets seen.
 *
 * The URL list comes from the same sitemap() function that renders
 * /sitemap.xml, so what we push is exactly what we claim to publish — the
 * previous hardcoded four-URL list silently left ~6,100 indexable pages
 * unpushed, which is most of the site.
 *
 * Requires INDEXNOW_KEY in env, and the key must be hosted at
 * /{INDEXNOW_KEY}.txt (see src/app/[keyfile]/route.ts) or the endpoint rejects
 * the submission. Without the key this returns a clear 503 rather than a fake
 * success, so nobody believes pings are going out when they are not.
 *
 * Note this only matters for crawlers that support IndexNow (Bing, and via
 * IndexNow's partner program others). Google does not accept it directly; for
 * Google the equivalent is re-submitting the sitemap in Search Console, which no
 * amount of code can do for us.
 */

const BASE = "https://shiftless.vercel.app";
/** IndexNow accepts at most 10,000 URLs per submission; stay well under it. */
const BATCH = 1000;

type Entry = { url: string } | string;

// sitemap() returns a plain array (MetadataRoute.Sitemap), or the index shape
// { urlList, pages } once the corpus outgrows 50,000 URLs. Both are handled so
// a future index-format sitemap does not silently push zero URLs.
function locs(result: ReturnType<typeof sitemap>): string[] {
  const entries: Entry[] | undefined = Array.isArray(result)
    ? result
    : (result as { urlList?: Entry[] }).urlList;
  if (!Array.isArray(entries)) return [];
  return entries
    .map((e) => (typeof e === "string" ? e : e.url))
    .filter((u) => typeof u === "string" && u.startsWith(BASE));
}

async function push(key: string, urlList: string[]): Promise<string> {
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        host: "shiftless.vercel.app",
        key,
        keyLocation: `${BASE}/${key}.txt`,
        urlList,
      }),
    });
    // 200/202 are both accepted; 429 means we pushed too fast.
    return String(res.status);
  } catch (e) {
    return `error: ${String(e)}`;
  }
}

export async function GET() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: "INDEXNOW_KEY is not configured" },
      { status: 503 }
    );
  }

  const all = locs(sitemap());
  if (all.length === 0) {
    return NextResponse.json(
      { ok: false, error: "sitemap produced no URLs" },
      { status: 502 }
    );
  }

  const batches: string[][] = [];
  for (let i = 0; i < all.length; i += BATCH) batches.push(all.slice(i, i + BATCH));

  const results: Record<string, string> = {};
  let anyOk = false;

  for (let i = 0; i < batches.length; i++) {
    const status = await push(key, batches[i]);
    results[`batch-${i + 1}`] = `${batches[i].length} urls -> ${status}`;
    if (status === "200" || status === "202") anyOk = true;
    // Last row of a batch — polite pause so we are not read as a burst.
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  return NextResponse.json(
    { ok: anyOk, total: all.length, batches: batches.length, results },
    { status: anyOk ? 200 : 502 }
  );
}
