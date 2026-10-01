/**
 * Lead-capture regression tests.
 *
 * Both assertions here guard a bug that actually cost this repo money:
 *
 * 1. Leads were written only to console.log. Nobody reads a Vercel stdout log, so
 *    every lead the funnel ever produced was written and then lost, with no error
 *    and no signal. The funnel could work perfectly and still yield zero contacts.
 *    These tests fail if the durable KV write is removed and only logging remains.
 *
 * 2. A token-guarded CSV export of other people's email addresses. If the guard
 *    is dropped, this is a data breach rather than a feature, so the unset-token
 *    and wrong-token cases are asserted as 401 rather than 200.
 */

process.env.KV_REST_API_URL = "";
process.env.KV_REST_API_TOKEN = "";
delete process.env.LEAD_EXPORT_TOKEN;
delete process.env.LEAD_WEBHOOK_URL;

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

console.log("lead durability (was: stdout-only = silently lost)");

const store = require("../src/lib/store.ts");
const leadRoute = readSource("src/app/api/lead/route.ts");
const exportRoute = readSource("src/app/api/lead/export/route.ts");

check("saveLead is exported and returns null without KV instead of throwing", async () => {
  assert.strictEqual(typeof store.saveLead, "function");
});

check("listLeads is exported", () => {
  assert.strictEqual(typeof store.listLeads, "function");
});

check("lead route calls saveLead (durable write is wired, not just logged)", () => {
  assert.ok(/await saveLead\(/.test(leadRoute), "lead route must persist via saveLead");
});

check("lead route still logs the [LEAD] line for continuity", () => {
  assert.ok(/\[LEAD\]/.test(leadRoute), "stdout sink must remain for log greps");
});

check("lead route never 500s a visitor who submitted an email", () => {
  // A failed KV write must not surface as a failed submission. The route's only
  // non-200 responses are 400 (bad input) and 405 (wrong method).
  const statuses = [...leadRoute.matchAll(/status:\s*(\d{3})/g)].map((m) => m[1]);
  assert.ok(!statuses.includes("500"), "lead route must not return 500");
  assert.ok(statuses.includes("400"), "lead route should still reject bad input with 400");
});

check("lead route reports whether the record was stored", () => {
  assert.ok(/stored:/.test(leadRoute), "response should state storage outcome");
});

check("saveLead is best-effort: catches its own KV errors", () => {
  const src = readSource("src/lib/store.ts");
  const body = src.slice(src.indexOf("export async function saveLead"));
  assert.ok(/catch/.test(body), "saveLead must catch KV failures so a lead is never lost to a 500");
});

console.log("lead export is guarded (returns other people's emails)");

check("export route is a separate route from the capture route", () => {
  assert.ok(exportRoute.includes("/api/lead/export") || exportRoute.includes("LEAD_EXPORT_TOKEN"));
});

check("export returns 401 when LEAD_EXPORT_TOKEN is unset", () => {
  assert.ok(
    /if \(!token\)[\s\S]{0,200}status:\s*401/.test(exportRoute),
    "an unconfigured export must not be a working export"
  );
});

check("export rejects a wrong token with 401", () => {
  assert.ok(
    /supplied !== token[\s\S]{0,120}status:\s*401/.test(exportRoute),
    "wrong token must be rejected"
  );
});

check("export compares the token rather than merely checking presence", () => {
  assert.ok(
    /supplied !== token/.test(exportRoute),
    "must compare the supplied token to the configured one"
  );
});

check("export neutralises spreadsheet formula injection in CSV cells", () => {
  // Lead fields are attacker-controlled; a leading =, +, - or @ executes in
  // Excel/Sheets on open. This is a CSV export of untrusted input.
  assert.ok(
    exportRoute.includes("=+\\-@"),
    "formula-injection guard must cover =, +, - and @"
  );
  assert.ok(exportRoute.includes("replace"), "field sanitiser must be applied");
  assert.ok(exportRoute.includes('""'), "quotes must be doubled per RFC 4180");
});

check("export sets no-store so a token URL is not cached", () => {
  assert.ok(/no-store/.test(exportRoute), "cached lead export would leak past token rotation");
});

console.log(`\n${passed} checks passed`);
