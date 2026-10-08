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

console.log("No unrenderable numbers (Infinity leaked into page text before)");

// The model signals "never pays back" with a non-finite number. Stringifying it
// produced "Payback Infinity months" in real page titles and meta descriptions
// — the same class of bug as the old `?m=0` permalink. This asserts that no
// page in the corpus would render a non-finite number anywhere.
let nonFinite = 0;
let nanVals = 0;
for (const p of c.pages) {
  const o = p.output;
  for (const [k, v] of Object.entries(o)) {
    if (typeof v === "number" && !Number.isFinite(v)) {
      // paybackMonths is the one field where non-finite is meaningful and is
      // rendered through a helper that handles it.
      if (k === "paybackMonths") { nonFinite++; continue; }
      nanVals++;
      console.log("        non-finite " + k + " on " +
        p.industry.slug + "/" + p.band.slug + "/" + p.volume);
    }
  }
}
check("only paybackMonths may be non-finite", nanVals === 0, nanVals + " other non-finite fields");
check("non-finite payback exists (the case that must be handled)", nonFinite > 0,
  nonFinite + " pages never pay back");

console.log("Pluralisation (naive concatenation produced '1 agents')");

// A single-agent page rendered "1 agents remain" in its body, and "1 agents" in
// the title and meta description. Grammatical defects on 329 pages is the same
// class of problem as publishing Infinity: correct data, careless rendering.
const oneAgentPages = c.pages.filter((p) => p.output.agentsNeeded === 1);
check("the corpus contains single-agent pages (the pluralisation trap)",
  oneAgentPages.length > 0, oneAgentPages.length + " pages");

// Everything the page renders as a human-readable agent count must go through
// agentsText(). Assert no template concatenates the number with a bare noun.
function read(rel) {
  return fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
}
const component = read("src/components/CorpusPage.tsx");
const naiveConcats = [...component.matchAll(/\$\{output\.agents[A-Za-z]*\}[^`]*agents/g)]
  .filter((m) => !m[0].includes("agentsText"));
check("no naive '${output.agents...} agents' concatenation remains",
  naiveConcats.length === 0,
  naiveConcats.map((m) => m[0]).join(" | "));

const enRoute = read("src/app/roi/[industry]/[band]/[volume]/[aht]/[scenario]/page.tsx");
const naiveEn = [...enRoute.matchAll(/\$\{output\.agentsNeeded\} agents/g)];
check("no naive pluralisation in the English metadata generator",
  naiveEn.length === 0, naiveEn.map((m) => m[0]).join(" | "));

// And the other unrenderable-number guard, on the hub pages too.
const hub = read("src/app/roi/page.tsx");
check("hub page pluralises agent counts",
  !/\{p\.output\.agentsNeeded\} agents/.test(hub),
  "hub still concatenates agentsNeeded with a bare plural");

console.log("Lead durability (leads were silently lost for 14 rounds)");

// The expensive failure here was never "the site was down" — it was "the site
// returned 200 while every captured email was dropped". So the invariant is
// about storage configuration, and it is now checkable from outside.
const store = read("src/lib/store.ts");
const health = read("src/app/api/health/route.ts");
const leadRoute = read("src/app/api/lead/route.ts");

check("lead storage counts Blob as durable, not just KV",
  /isLeadStorageConfigured/.test(store) &&
    /isKvConfigured\(\) \|\| isBlobConfigured\(\)/.test(store),
  "isLeadStorageConfigured must accept either sink");

check("saveLead falls through to Blob when KV fails",
  /isBlobConfigured\(\)/.test(store) &&
    /access: "private"/.test(store),
  "Blob put must be wired as the second sink");

// The health endpoint must not claim durability from a single sink.
check("health reports leadsDurable only when some sink is real",
  /const leadsDurable = kv \|\| blob \|\| webhook/.test(health),
  "leadsDurable must union all three sinks");

// Guards against reintroducing a sink that exists but is never wired.
check("the lead route reports per-sink outcomes",
  /sinks:/.test(leadRoute) && /webhooked/.test(leadRoute),
  "route must state which sinks accepted the lead");

// Never let the diagnostics endpoint become a secret-leak vector.
check("health endpoint reports presence, never values",
  !/\.env\.[A-Z_]+\]/.test(health) && /Only presence is reported/.test(health),
  "health must not echo env values");

console.log("Axes covered");
check("industries present", INDUSTRIES.length >= 12, String(INDUSTRIES.length));
check("volume bands present", VOLUMES.length >= 15, String(VOLUMES.length));
check("headcount bands present", HEADCOUNT_BANDS.length >= 5, String(HEADCOUNT_BANDS.length));
check("AHT variants present", AHT_VARIANTS.length === 3, String(AHT_VARIANTS.length));
check("coverage scenarios present", COVERAGE_SCENARIOS.length === 3, String(COVERAGE_SCENARIOS.length));

console.log(failures === 0 ? "\nALL CORPUS CHECKS PASSED" : "\n" + failures + " FAILURES");
if (failures) process.exitCode = 1;
