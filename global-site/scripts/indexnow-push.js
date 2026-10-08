/**
 * Bulk IndexNow push of every URL in the built sitemap.
 *
 * Why a script and not only /api/ping: both exist on purpose. /api/ping is the
 * post-deploy lever (runs inside Vercel, no local network needed). This script
 * is for the case right now where the local machine cannot resolve
 * shiftless.vercel.app but can reach api.indexnow.org — e.g. immediately after
 * a deploy that added or changed thousands of pages.
 *
 * Reads .next/server/app/sitemap.xml.body (the exact bytes /sitemap.xml
 * serves), so what we push is what the sitemap claims — no second URL list
 * that can drift from the real one. Requires a build first.
 *
 * IndexNow verifies that https://shiftless.vercel.app/{INDEXNOW_KEY}.txt hosts
 * the key; if that route is not deployed the endpoint answers 403 and this
 * script says so plainly instead of reporting a success.
 *
 * Usage:  node scripts/indexnow-push.js
 */

const fs = require("fs");
const path = require("path");

const BASE = "https://shiftless.vercel.app";
const BATCH = 1000;
const SITEMAP = path.join(__dirname, "..", ".next", "server", "app", "sitemap.xml.body");

function readKey() {
  if (process.env.INDEXNOW_KEY) return process.env.INDEXNOW_KEY.trim();
  const local = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(local)) {
    const line = fs
      .readFileSync(local, "utf8")
      .split(/\r?\n/)
      .find((l) => l.startsWith("INDEXNOW_KEY="));
    if (line) return line.slice("INDEXNOW_KEY=".length).trim();
  }
  const secret = "F:/24/.secrets/indexnow-key.txt";
  if (fs.existsSync(secret)) return fs.readFileSync(secret, "utf8").trim();
  return null;
}

async function main() {
  const key = readKey();
  if (!key) {
    console.error("FAIL: INDEXNOW_KEY not found in env, .env.local or F:/24/.secrets");
    process.exit(1);
  }
  if (!fs.existsSync(SITEMAP)) {
    console.error("FAIL: no built sitemap — run `npm run build` first");
    process.exit(1);
  }

  const xml = fs.readFileSync(SITEMAP, "utf8");
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1])
    .filter((u) => u.startsWith(BASE));

  if (urls.length === 0) {
    console.error("FAIL: sitemap has no URLs under " + BASE);
    process.exit(1);
  }

  const batches = [];
  for (let i = 0; i < urls.length; i += BATCH) batches.push(urls.slice(i, i + BATCH));

  // Per-receiver results, because they are NOT interchangeable: Yandex
  // verifies the key file itself and accepts, while Bing's endpoint answers
    // 403 UserForbiddedToAccessSite for this domain even though the same key on
    // the same site returns 200 to Yandex — that 403 is Bing Webmaster Tools
  // domain verification, not a broken key. Treating them as one verdict hides
  // which half actually works.
  const ENDPOINTS = [
    ["yandex", "https://yandex.com/indexnow"],
    ["bing", "https://www.bing.com/indexnow"],
    ["indexnow.org", "https://api.indexnow.org/indexnow"],
  ];

  console.log(
    `pushing ${urls.length} urls in ${batches.length} batches x ${ENDPOINTS.length} receivers (key ${key}…)`
  );

  const tally = Object.fromEntries(ENDPOINTS.map(([n]) => [n, 0]));
  const reasons = Object.fromEntries(ENDPOINTS.map(([n]) => [n, new Set()]));

  for (let i = 0; i < batches.length; i++) {
    const body = JSON.stringify({
      host: "shiftless.vercel.app",
      key,
      keyLocation: `${BASE}/${key}.txt`,
      urlList: batches[i],
    });
    for (const [name, host] of ENDPOINTS) {
      try {
        const res = await fetch(host, {
          method: "POST",
          headers: {
            "content-type": "application/json; charset=utf-8",
            authorization: `Bearer ${key}`,
          },
          body,
        });
        const text = (await res.text()).slice(0, 200);
        const good = res.status === 200 || res.status === 202;
        if (good) tally[name]++;
        else reasons[name].add(`HTTP ${res.status} ${text}`);
        console.log(
          `  batch ${i + 1}/${batches.length} -> ${name}: HTTP ${res.status}` +
            (good ? ` (${batches[i].length} urls)` : ` ${text.slice(0, 90)}`)
        );
      } catch (e) {
        reasons[name].add(`error: ${e.message}`);
        console.log(`  batch ${i + 1} -> ${name} failed: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (i < batches.length - 1) await new Promise((r) => setTimeout(r, 1000));
  }

  console.log("\nper receiver:");
  for (const [name] of ENDPOINTS) {
    const all = tally[name] === batches.length;
    const line = all
      ? `  ${name}: ACCEPTED all ${batches.length} batches`
      : `  ${name}: ${tally[name]}/${batches.length} batches` +
        ([...reasons[name]].length ? ` — ${[...reasons[name]].join(" | ").slice(0, 300)}` : "");
    console.log(line);
  }

  const anyFull = ENDPOINTS.some(([n]) => tally[n] === batches.length);
  if (tally["bing"] !== batches.length && tally["yandex"] === batches.length) {
    console.log(
      "\nnote: Bing's 403 with a key Yandex accepts means the domain is not\n" +
        "verified in Bing Webmaster Tools — verify the site there (XML file/tag,\n" +
        "not the Google-import path) and re-run this script."
    );
  }
  process.exit(anyFull ? 0 : 1);
}

main();
