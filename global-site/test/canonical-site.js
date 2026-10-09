/**
 * Canonical site URL regression tests.
 *
 * The bug these guard: the canonical URL used to be hardcoded to the Vercel
 * deployment host in a dozen files. Once a real branded domain existed, any
 * file still pointing at the deployment host would make Google see duplicate
 * content (two hosts serving the same pages, neither canonical) — and nothing
 * in the suite would notice. These tests fail loudly if the canonical host is
 * hand-written anywhere outside src/lib/site.ts.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");

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
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

console.log("canonical site URL (single source of truth)");

check("src/lib/site.ts declares the branded canonical URL and host", () => {
  const src = readSource("src/lib/site.ts");
  assert.ok(/SITE_URL\s*=\s*"https:\/\/app\.highkingflower\.com"/.test(src), "SITE_URL not the branded domain");
  assert.ok(/SITE_HOST\s*=\s*"app\.highkingflower\.com"/.test(src), "SITE_HOST not the branded domain");
});

check("no src file hardcodes the old deployment host", () => {
  const modern = walk(path.join(ROOT, "src"), []).filter((f) =>
    fs.readFileSync(f, "utf8").includes("shiftless.vercel.app")
  );
  assert.deepStrictEqual(
    modern.map((f) => path.relative(ROOT, f)),
    [],
    `these files still hardcode the deployment host: ${modern.map((f) => path.relative(ROOT, f)).join(", ")}`
  );
});

check("sitemap, robots, structured data and ping read the canonical constant", () => {
  for (const rel of [
    "src/app/sitemap.ts",
    "src/app/robots.ts",
    "src/components/StructuredData.tsx",
    "src/app/api/ping/route.ts",
  ]) {
    assert.ok(/@\/lib\/site/.test(readSource(rel)), `${rel} does not import @/lib/site`);
  }
});

check("IndexNow script pushes to the branded host", () => {
  const push = readSource("scripts/indexnow-push.js");
  assert.ok(/app\.highkingflower\.com/.test(push), "indexnow-push.js not on the branded host");
  assert.ok(!/shiftless\.vercel\.app/.test(push), "indexnow-push.js still on the deployment host");
});

console.log(`\n${passed} canonical-site checks passed`);