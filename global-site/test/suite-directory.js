/**
 * Consolidation-hub regression tests.
 *
 * The hub (/tools, /zh/tools) is the one page that fronts every surviving
 * product after the Vercel cleanup. Two failure modes would be silent and
 * costly, so they are pinned here:
 *
 *  1. Drift between the registry and the page, or between the two languages —
 *     the hub would start advertising a tool that no longer exists, or show a
 *     different list in Chinese than in English.
 *  2. A dishonest listing — the whole point of the cleanup was an honest front
 *     door, so a tagline promising effortless monthly income must fail CI.
 *
 * It also guards the deliberate design rule: the hub only links out, it never
 * inlines another product's copy.
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

console.log("consolidation hub (/tools)");

const registry = readSource("src/lib/suite.ts");
const component = readSource("src/components/SuiteDirectory.tsx");
const enPage = readSource("src/app/(en)/tools/page.tsx");
const zhPage = readSource("src/app/(zh)/zh/tools/page.tsx");
const sitemap = readSource("src/app/sitemap.ts");

// Load the registry by extracting the two plain-data arrays (no runtime
// dependencies, so a tiny evaluator is enough and keeps the test TypeScript-free).
function extractArray(name, src) {
  const nameIdx = src.indexOf(name);
  assert.ok(nameIdx !== -1, `${name} not found`);
  const eq = src.indexOf("= [", nameIdx);
  assert.ok(eq !== -1, `${name} assignment not found`);
  const open = eq + 2;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  throw new Error(`${name} array unterminated`);
}

// eslint-disable-next-line no-new-func
const SUITE_TOOLS = new Function(`return ${extractArray("SUITE_TOOLS", registry)};`)();
// eslint-disable-next-line no-new-func
const SUITE_CATEGORIES = new Function(`return ${extractArray("SUITE_CATEGORIES", registry)};`)();

check("registry has the surviving products and is not empty", () => {
  assert.ok(Array.isArray(SUITE_TOOLS) && SUITE_TOOLS.length >= 8, "too few tools");
  assert.ok(Array.isArray(SUITE_CATEGORIES) && SUITE_CATEGORIES.length >= 2, "too few categories");
});

check("every tool is complete in both languages", () => {
  for (const t of SUITE_TOOLS) {
    for (const field of ["id", "url", "name", "nameZh", "tagline", "taglineZh", "category", "price", "priceZh"]) {
      assert.ok(typeof t[field] === "string" && t[field].trim().length > 0, `${t.id || "?"} missing ${field}`);
    }
    assert.ok(/^https:\/\//.test(t.url), `${t.id} url must be https`);
    assert.ok(/[\u4e00-\u9fff]/.test(t.taglineZh), `${t.id} taglineZh must contain Chinese`);
    assert.ok(!/[\u4e00-\u9fff]/.test(t.tagline), `${t.id} tagline should be English-only`);
  }
});

check("ids and urls are unique", () => {
  const ids = SUITE_TOOLS.map((t) => t.id);
  assert.strictEqual(new Set(ids).size, ids.length, "duplicate id");
  const urls = SUITE_TOOLS.map((t) => t.url);
  assert.strictEqual(new Set(urls).size, urls.length, "duplicate url");
});

check("every category used by a tool is declared", () => {
  const declared = new Set(SUITE_CATEGORIES.map((c) => c.id));
  for (const t of SUITE_TOOLS) assert.ok(declared.has(t.category), `${t.id} uses undeclared category ${t.category}`);
});

check("taglines are unique, not pasted from each other", () => {
  const see = new Set();
  for (const t of SUITE_TOOLS) {
    assert.ok(!see.has(t.tagline), `duplicate tagline for ${t.id}`);
    see.add(t.tagline);
  }
});

check("no tagline promises effortless or guaranteed money", () => {
  const banned = /月入|日赚|躺赚|稳赚|guaranteed income|passive income guaranteed|get rich/i;
  for (const t of SUITE_TOOLS) {
    assert.ok(!banned.test(t.tagline), `${t.id} tagline makes a dishonest income promise`);
    assert.ok(!banned.test(t.taglineZh), `${t.id} taglineZh makes a dishonest income promise`);
  }
});

check("the directory renders from the registry, not a copied list", () => {
  assert.ok(/@\/lib\/suite/.test(component), "component does not import the registry");
  assert.ok(component.includes("SUITE_TOOLS"), "component does not read SUITE_TOOLS");
});

check("both languages render the same component", () => {
  assert.ok(enPage.includes("SuiteDirectory") && enPage.includes('lang="en"'), "en page not wired");
  assert.ok(zhPage.includes("SuiteDirectory") && zhPage.includes('lang="zh"'), "zh page not wired");
});

check("external links open safely", () => {
  assert.ok(/rel="noopener"/.test(component), "external links lack rel=noopener");
  assert.ok(/target="_blank"/.test(component), "external links do not open in a new tab");
});

check("the hub is discoverable: linked from both homepages and in the sitemap", () => {
  assert.ok(readSource("src/app/(en)/page.tsx").includes('href="/tools"'), "homepage lacks /tools link");
  assert.ok(readSource("src/app/(zh)/zh/page.tsx").includes('href="/zh/tools"'), "zh homepage lacks /zh/tools link");
  assert.ok(sitemap.includes("/tools") && sitemap.includes("/zh/tools"), "sitemap missing hub URLs");
});

check("hub pages pin a canonical URL", () => {
  assert.ok(/canonical:\s*"\/tools"/.test(enPage), "en hub lacks canonical");
  assert.ok(/canonical:\s*"\/zh\/tools"/.test(zhPage), "zh hub lacks canonical");
});

console.log(`\n${passed} consolidation-hub checks passed`);
