/**
 * IndexNow wiring regression tests.
 *
 * The bug these guard: the key lived in env and in .secrets/ but was hosted
 * nowhere, and /api/ping pushed a hardcoded list of four URLs. Both failures
 * are silent — the endpoint can answer 200 from the operator's side while the
 * crawler rejects the submission (no key file) and never learns about the
 * ~6,100 other pages (not in urlList). A push protocol you are not actually
 * part of looks exactly like one you are.
 */

const assert = require("assert");
let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`  FAIL ${name}: ${e.message}`);
    process.exitCode = 1;
  }
}

function readSource(rel) {
  return require("fs").readFileSync(require("path").join(__dirname, "..", rel), "utf8");
}

console.log("indexnow (was: key hosted nowhere, 4 of ~6,100 urls pushed)");

const ping = readSource("src/app/api/ping/route.ts");
const keyfile = readSource("src/app/[keyfile]/route.ts");
const push = readSource("scripts/indexnow-push.js");

check("ping derives the URL list from the real sitemap, not a hardcoded list", () => {
  assert.ok(/from "@\/app\/sitemap"/.test(ping), "sitemap import missing");
  assert.ok(!/urlList = \[/.test(ping), "hardcoded urlList found");
  assert.ok(/locs\(sitemap\(\)\)/.test(ping), "sitemap() not consulted");
});

check("ping declares keyLocation so the crawler can verify ownership", () => {
  assert.ok(/keyLocation: `\$\{BASE\}\/\$\{key\}\.txt`/.test(ping), "keyLocation missing");
});

check("ping splits into batches under the 10,000-URL protocol limit", () => {
  assert.ok(/const BATCH = 1000/.test(ping), "batch size missing");
});

check("ping reports 503 without a key rather than a fake success", () => {
  assert.ok(/status: 503/.test(ping), "unset-key 503 missing");
});

check("keyfile route serves the configured key and 404s everything else", () => {
  assert.ok(/keyfile !== `\$\{key\}\.txt`/.test(keyfile), "exact-match guard missing");
  assert.ok(/status: 404/.test(keyfile), "404 for non-key segments missing");
  assert.ok(/process\.env\.INDEXNOW_KEY/.test(keyfile), "env key not consulted");
});

check("local push script reads the built sitemap and batches under the limit", () => {
  assert.ok(/sitemap\.xml\.body/.test(push), "built sitemap not used as source");
  assert.ok(/BATCH = 1000/.test(push), "batch size missing");
  assert.ok(/keyLocation/.test(push), "keyLocation missing");
});

check("push hits each receiver separately and reports them separately", () => {
  // Measured on this domain: Yandex accepts the key, Bing answers 403
  // UserForbiddedToAccessSite because the domain is unverified in Bing
  // Webmaster Tools. One combined verdict would hide both facts.
  for (const [name, src] of [
    ["ping", ping],
    ["script", push],
  ]) {
    assert.ok(/yandex\.com\/indexnow/.test(src), `${name}: yandex receiver missing`);
    assert.ok(/www\.bing\.com\/indexnow/.test(src), `${name}: bing receiver missing`);
    assert.ok(
      /api\.indexnow\.org\/indexnow/.test(src),
      `${name}: shared endpoint missing`
    );
  }
  assert.ok(/receivers: tally/.test(ping), "ping must report per-receiver tallies");
});

console.log(`\n${passed} indexnow checks passed`);
