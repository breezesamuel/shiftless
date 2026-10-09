import { NextResponse } from "next/server";

import sitemap from "@/app/sitemap";
import { SITE_URL as BASE, SITE_HOST } from "@/lib/site";

// A full-sitemap push is 7 batches x 3 receivers with politeness sleeps —
// roughly 25s. Without this the function is killed mid-push and the status
// report would describe work that never finished.
export const maxDuration = 60;

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

async function push(key: string, endpoint: string, urlList: string[]): Promise<string> {
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        host: SITE_HOST,
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

  // The receivers are not interchangeable. Measured on this domain: Yandex
  // verifies the key file and accepts (200/202) while Bing and the shared
  // api.indexnow.org endpoint answer 403 UserForbiddedToAccessSite — a Bing
  // Webmaster Tools verification, not a key problem. Reporting one combined
  // verdict would either hide the working receiver or hide the broken one.
  const targets: [string, string][] = [
    ["yandex", "https://yandex.com/indexnow"],
    ["bing", "https://www.bing.com/indexnow"],
    ["indexnow.org", "https://api.indexnow.org/indexnow"],
  ];

  const tally: Record<string, number> = {};
  for (const [name] of targets) tally[name] = 0;

  for (let i = 0; i < batches.length; i++) {
    for (const [name, endpoint] of targets) {
      const status = await push(key, endpoint, batches[i]);
      const good = status === "200" || status === "202";
      if (good) tally[name]++;
      results[`${name}-batch-${i + 1}`] = `${batches[i].length} urls -> ${status}`;
      if (good) anyOk = true;
      // Polite pause so the burst is not rate-limited (429).
      await new Promise((r) => setTimeout(r, 300));
    }
    if (i < batches.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // ok = at least one receiver took every batch. A partial receiver (Bing
  // pending Webmaster verification) is reported, not silently dropped.
  const fullyAccepted = Object.keys(tally).filter((n) => tally[n] === batches.length);

  return NextResponse.json(
    {
      ok: fullyAccepted.length > 0,
      total: all.length,
      batches: batches.length,
      receivers: tally,
      accepted: fullyAccepted,
      results,
    },
    { status: anyOk ? 200 : 502 }
  );
}
