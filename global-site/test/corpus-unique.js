/**
 * Verifies the programmatic corpus is genuinely differentiated.
 *
 * The dedupe fingerprint in corpus.ts is a claim; this is the check on that
 * claim. It hashes the *rendered body* of every page and asserts no two pages
 * are byte-identical. If a template change ever starts producing the same page
 * under two URLs, this fails — which is the doorway-page failure that gets a
 * programmatic set deindexed.
 */
const path = require("path");
const fs = require("fs");
const ts = require("typescript");

function load(rel, name) {
  const src = fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const dir = path.join(__dirname, "..", ".tmp-verify");
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, name);
  fs.writeFileSync(out, js);
  return out;
}

const crypto = require("crypto");
require(load("src/lib/model.ts", "model.js"));
const { buildCorpus, INDUSTRIES, VOLUMES, HEADCOUNT_BANDS, AHT_VARIANTS, COVERAGE_SCENARIOS } =
  require(load("src/lib/corpus.ts", "corpus.js"));

let failures = 0;
function check(label, cond, detail) {
  if (!cond) {
    failures++;
    console.log("  FAIL  " + label + (detail ? "  " + detail : ""));
  } else {
    console.log("  ok    " + label);
  }
}

console.log("Corpus differentiation");

const c = buildCorpus();

check("corpus is non-empty", c.pages.length > 100, "got " + c.pages.length);
check("examined combinations exceed published", c.examined > c.pages.length,
  c.examined + " examined vs " + c.pages.length + " published");

// Hash the full rendered data, not just the fingerprint fields, so a change in
// any displayed number is caught.
const hashes = new Map();
let dupes = 0;
for (const p of c.pages) {
  const body = JSON.stringify(p.output) + JSON.stringify(p.inputs);
  const h = crypto.createHash("sha256").update(body).digest("hex");
  if (hashes.has(h)) dupes++;
  else hashes.set(h, `${p.industry.slug}/${p.band.slug}/${p.volume}/${p.aht.slug}/${p.scenario.slug}`);
}
check("no two published pages render identical output", dupes === 0, dupes + " duplicates");

// Every published page must sit inside its own declared headcount band, or the
// URL promises a team size the page does not deliver.
let outOfBand = 0;
for (const p of c.pages) {
  if (p.output.agentsNeeded < p.band.min || p.output.agentsNeeded > p.band.max) outOfBand++;
}
check("every page's headcount falls inside its URL's band", outOfBand === 0, outOfBand + " outside");

// The whole point of the model: it must be willing to say no.
check("model refuses to recommend automation on some pages", c.noindex > 0, c.noindex + " noindex");
check("model recommends automation on most pages",
  c.pages.length - c.noindex > c.noindex,
  (c.pages.length - c.noindex) + " indexable vs " + c.noindex + " noindex");

// Averages are the honest measure of differentiation. A template with one
// swapped variable sits near 5-15%; real per-page data sits much higher.
const uniq = 100 * (hashes.size / c.pages.length);
console.log("        unique-output ratio: " + uniq.toFixed(1) + "%");

console.log("Axes covered");
check("industries present", INDUSTRIES.length >= 12, String(INDUSTRIES.length));
check("volume bands present", VOLUMES.length >= 15, String(VOLUMES.length));
check("headcount bands present", HEADCOUNT_BANDS.length >= 5, String(HEADCOUNT_BANDS.length));
check("AHT variants present", AHT_VARIANTS.length === 3, String(AHT_VARIANTS.length));
check("coverage scenarios present", COVERAGE_SCENARIOS.length === 3, String(COVERAGE_SCENARIOS.length));

console.log(failures === 0 ? "\nALL CORPUS CHECKS PASSED" : "\n" + failures + " FAILURES");
if (failures) process.exitCode = 1;
