/**
 * Corpus lead-capture regression tests.
 *
 * The corpus (thousands of programmatic ROI pages) is where search traffic
 * lands, but those pages had no conversion path — a visitor could read the
 * numbers and then only click onward to the calculator. These tests pin down
 * that the corpus pages now carry an honest, gated lead form carrying the
 * page's own inputs, and that the lead sink accepts the page context fields so
 * the operator's alert says which page converted.
 */

const assert = require("assert");
const fs = require("fs");
const path = require("path");
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
  return fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
}

console.log("corpus pages (was: valuable traffic, no way to leave an email)");

const page = readSource("src/components/CorpusPage.tsx");
const cta = readSource("src/components/CorpusLeadCta.tsx");
const leadRoute = readSource("src/app/api/lead/route.ts");
const exportRoute = readSource("src/app/api/lead/export/route.ts");
const store = readSource("src/lib/store.ts");
const enPage = readSource("src/app/(en)/roi/[industry]/[band]/[volume]/[aht]/[scenario]/page.tsx");
const zhPage = readSource("src/app/(zh)/zh/roi/[industry]/[band]/[volume]/[aht]/[scenario]/page.tsx");

check("CorpusPage renders the lead CTA", () => {
  assert.ok(page.includes("CorpusLeadCta"), "CTA not imported/rendered");
});

check("CTA is gated to strong/workable verdicts like the calculator", () => {
  assert.ok(
    page.includes('output.verdict === "strong" || output.verdict === "workable"'),
    "gating condition missing"
  );
});

check("CTA posts to /api/lead with source corpus-cta", () => {
  assert.ok(cta.includes('"/api/lead"'), "no lead endpoint call");
  assert.ok(cta.includes('source: "corpus-cta"'), "source missing");
});

check("CTA copy is honest: a person replies, no automated mail claim", () => {
  assert.ok(/one business day/.test(cta), "en reply promise missing");
  assert.ok(/1 个工作日/.test(cta), "zh reply promise missing");
  assert.ok(!/check your (inbox|email)/i.test(cta), "fake email check claim present");
  assert.ok(!/newsletter|drip/.test(cta) || /no drip/.test(cta), "drip copy must deny drip");
});

check("CTA has both languages", () => {
  assert.ok(/Got it\./.test(cta), "en success missing");
  assert.ok(/已收到。/.test(cta), "zh success missing");
  assert.ok(/Get my number/.test(cta), "en button missing");
  assert.ok(/算我的数字/.test(cta), "zh button missing");
});

check("CTA carries the page's inputs as payload", () => {
  assert.ok(cta.includes("payload.monthlyTickets"), "volume not echoed");
  assert.ok(page.includes("industry: industry.slug"), "industry context missing");
  assert.ok(page.includes("scenario: scenario.slug"), "scenario context missing");
});

check("lead route accepts corpus context fields", () => {
  assert.ok(/body\.industry/.test(leadRoute), "industry not parsed");
  assert.ok(/body\.band/.test(leadRoute), "band not parsed");
  assert.ok(/body\.volume/.test(leadRoute), "volume not parsed");
  assert.ok(/body\.scenario/.test(leadRoute), "scenario not parsed");
});

check("StoredLead carries the corpus context", () => {
  assert.ok(/industry\?: string/.test(store), "industry field missing");
  assert.ok(/scenario\?: string/.test(store), "scenario field missing");
});

check("export CSV includes the corpus context columns", () => {
  for (const col of ['"industry"', '"band"', '"volume"', '"scenario"']) {
    assert.ok(exportRoute.includes(col), `${col} column missing`);
  }
});

check("both locales render the shared CorpusPage component", () => {
  assert.ok(enPage.includes('lang="en"'), "en page does not use CorpusPage");
  assert.ok(zhPage.includes('lang="zh"'), "zh page does not use CorpusPage");
});

console.log(`\n${passed} corpus-cta checks passed`);