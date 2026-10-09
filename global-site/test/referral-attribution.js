/**
 * Referral attribution + corpus link-mesh regression tests.
 *
 * Two halves:
 *
 * 1. Referral attribution: a corpus page shared with ?ref=<email> must carry
 *    that attribution from the lead submit, through the calculator link, into
 *    the order, the operator alert, and the PayPal return hop. A referral
 *    programme nobody records is a promise nobody can keep, so these tests pin
 *    the plumbing, not just the copy.
 *
 * 2. Corpus link mesh: every programmatic page links to its nearest indexable
 *    siblings so crawlers can walk the corpus. Tests are runtime (the corpus
 *    module is transpiled on the fly) because the interesting rules are
 *    behavioural: no self-links, no links to noindexed pages, neighbours stay
 *    inside the industry.
 */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
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

const ROOT = path.join(__dirname, "..");
const readSource = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");

console.log("referral attribution plumbing");

const cta = readSource("src/components/CorpusLeadCta.tsx");
const refLink = readSource("src/components/RefLink.tsx");
const page = readSource("src/components/CorpusPage.tsx");
const upsell = readSource("src/components/Upsell.tsx");
const orderRoute = readSource("src/app/api/order/route.ts");
const leadRoute = readSource("src/app/api/lead/route.ts");
const paypalReturn = readSource("src/app/api/paypal/return/route.ts");
const leadExport = readSource("src/app/api/lead/export/route.ts");
const store = readSource("src/lib/store.ts");
const corpusSrc = readSource("src/lib/corpus.ts");

check("corpus CTA reads the incoming ?ref= and forwards it to /api/lead", () => {
  assert.ok(cta.includes('get("ref")'), "referrer not read from URL");
  assert.ok(cta.includes("ref, lang, source"), "ref and lang not sent with the lead");
});

check("corpus CTA success state offers a referral share link with the submitter's email", () => {
  assert.ok(cta.includes("?ref="), "share link has no ref param");
  assert.ok(cta.includes("Copy link") && cta.includes("复制链接"), "copy button missing a language");
  assert.ok(/referrer/.test(cta) || /推荐人/.test(cta), "no referrer wording");
});

check("reward copy promises only what is payable (credit after payment confirmed)", () => {
  assert.ok(/payment is confirmed|付款确认/.test(cta), "credit timing not stated");
  assert.ok(!/free months now|即时到账/.test(cta), "over-promising copy present");
});

check("RefLink forwards ref across the corpus -> calculator hop", () => {
  assert.ok(refLink.includes("window.location.search"), "does not read the current URL");
  assert.ok(refLink.includes("ref="), "does not append the ref param");
});

check("calculator CTA uses RefLink", () => {
  assert.ok(page.includes('<RefLink'), "RefLink not used on the page");
  assert.ok(page.includes('href={permalink}'), "permalink link missing");
});

check("Upsell reads ref and sends it with the order", () => {
  assert.ok(upsell.includes('get("ref")'), "ref not read on the checkout");
  assert.ok(upsell.includes("ref,") || upsell.includes("ref }"), "ref not in the order POST body");
});

check("order route records ref, shows it in the alert, and keeps it through PayPal", () => {
  assert.ok(orderRoute.includes("EMAIL.test(body.ref"), "ref not validated server-side");
  assert.ok(orderRoute.includes("ref,\n    ts:"), "ref not on the order object");
  assert.ok(orderRoute.includes("&ref="), "ref not appended to the PayPal return URL");
  assert.ok(orderRoute.includes("ref ? `ref: ${ref}`"), "ref not in the operator alert");
});

check("lead route accepts a valid ref only", () => {
  assert.ok(leadRoute.includes("body.ref"), "ref not parsed");
  assert.ok(leadRoute.includes("EMAIL_RE.test(body.ref.trim())"), "ref not validated as email");
});

check("paypal return carries ref into the capture record and alert", () => {
  assert.ok(paypalReturn.includes('get("ref")'), "ref not read on return hop");
  assert.ok(paypalReturn.includes("ref: ref || undefined"), "ref not on the capture record");
});

check("export CSV carries the ref column", () => {
  assert.ok(leadExport.includes('"ref"'), "ref column missing");
});
check("StoredLead carries ref", () => {
  assert.ok(store.includes("ref?: string"), "StoredLead.ref missing");
});

console.log("\ncorpus internal-link mesh");

// Runtime half: transpile corpus.ts + model.ts (the same pattern
// referral-logic.js uses) and exercise relatedPages() for real.
const ts = require(path.join(ROOT, "node_modules", "typescript"));
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "shiftless-mesh-"));
for (const name of ["model", "corpus"]) {
  const src = fs.readFileSync(path.join(ROOT, "src", "lib", name + ".ts"), "utf8");
  const out = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  fs.writeFileSync(path.join(outDir, name + ".js"), out.outputText);
}
const corpus = require(path.join(outDir, "corpus.js"));
const { buildCorpus, relatedPages } = corpus;

// corpus-cta.js already pins the count; here we only need a well-populated
// spec whose industry has plenty of indexable pages.
const pages = buildCorpus().pages;
const spec =
  pages.find((p) => p.output.verdict === "strong" && p.industry.slug === "saas") ||
  pages.find((p) => p.output.verdict === "workable" && p.industry.slug === "saas") ||
  pages[0];

const rel = relatedPages(spec, 5);

check("every page produces a related set (no crash on limit 0)", () => {
  assert.deepStrictEqual(relatedPages(spec, 0), []);
});

check("related pages never include the page itself", () => {
  assert.ok(!rel.some((p) => p === spec), "self-link present");
});

check("related pages are capped at the limit", () => {
  assert.ok(rel.length <= 5, `got ${rel.length}`);
});

check("related pages never link to noindexed (don't-buy) pages", () => {
  assert.ok(rel.every((p) => p.notWorthIt === false), "noindex page linked");
});

check("related pages stay inside the same industry", () => {
  assert.ok(rel.every((p) => p.industry.slug === spec.industry.slug),
    rel.map((p) => p.industry.slug).join(","));
});

check("related pages stay inside the same headcount band", () => {
  assert.ok(rel.every((p) => p.band.slug === spec.band.slug),
    rel.map((p) => p.band.slug).join(","));
});

check("results are deterministic (stable across builds)", () => {
  const again = relatedPages(spec, 5);
  const key = (p) => `${p.industry.slug}-${p.band.slug}-${p.volume}-${p.aht.slug}-${p.scenario.slug}`;
  assert.deepStrictEqual(rel.map(key), again.map(key));
});

check("mesh source renders the section and the hub link", () => {
  assert.ok(page.includes("Related scenarios") || page.includes("相邻场景"), "section heading missing");
  assert.ok(page.includes("relatedPages(spec, 5)"), "mesh not computed on the page");
  assert.ok(page.includes("hubHref"), "industry hub link missing");
});

console.log(`\n${passed} referral/mesh checks passed`);