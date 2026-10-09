/**
 * Operator KPI summary unit tests.
 *
 * Runtime tests against the real pricing table + operator.ts, transpiled the
 * same way as referral-logic (no build step, no server). These guard the
 * numbers the operator reads in the cockpit: revenue must only count captured
 * orders, conversions must require a real captured order, referral credit must
 * come from the actual PLANS table.
 */

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ts = require(path.join(ROOT, "node_modules", "typescript"));

function loadTs(files, entry) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "shiftless-ops-"));
  for (const name of files) {
    const src = fs.readFileSync(path.join(ROOT, "src", "lib", name + ".ts"), "utf8");
    const out = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    });
    fs.writeFileSync(path.join(outDir, name + ".js"), out.outputText);
  }
  return require(path.join(outDir, entry));
}

const { operatorSummary } = loadTs(["pricing", "operator"], "operator.js");

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

const base = { leads: [], orders: [], referrals: [], missions: [], knowledge: { templates: {}, updatedAt: "" } };

console.log("operator summary (runtime)");

check("empty pipeline produces zeroed KPIs", () => {
  const s = operatorSummary(base);
  assert.strictEqual(s.kpis.leads, 0);
  assert.strictEqual(s.kpis.capturedOrders, 0);
  assert.strictEqual(s.kpis.revenueUsd, 0);
  assert.strictEqual(s.kpis.revenueCny, 0);
  assert.strictEqual(s.kpis.leadReplyRate, null);
  assert.deepStrictEqual(s.referrers, []);
});

check("revenue counts only captured orders, split by currency", () => {
  const s = operatorSummary({
    ...base,
    orders: [
      { orderId: "A", email: "a@b.com", paymentState: "captured", priceUsd: 25, currency: "USD", tier: "quarterly" },
      { orderId: "B", email: "c@d.com", paymentState: "captured", priceUsd: 150, currency: "CNY", tier: "quarterly" },
      { orderId: "C", email: "e@f.com", paymentState: "manual", priceUsd: 60, currency: "CNY", tier: "monthly" },
    ],
  });
  assert.strictEqual(s.kpis.revenueUsd, 25);
  assert.strictEqual(s.kpis.revenueCny, 150);
  assert.strictEqual(s.kpis.capturedOrders, 2);
  assert.strictEqual(s.kpis.pendingManualOrders, 1);
});

check("lead conversion requires a captured order for the same email", () => {
  const s = operatorSummary({
    ...base,
    leads: [
      { id: "l1", email: "a@b.com", receivedAt: "" },
      { id: "l2", email: "nope@x.com", receivedAt: "" },
    ],
    orders: [{ orderId: "A", email: "A@B.COM", paymentState: "captured", priceUsd: 1, tier: "monthly" }],
  });
  assert.strictEqual(s.kpis.convertedLeads, 1, "case-insensitive match expected");
});

check("reply rate aggregates only lead-followup template counters", () => {
  const s = operatorSummary({
    ...base,
    knowledge: {
      templates: {
        "lead-followup:v1": { drafted: 4, sent: 4, replied: 2, failed: 0 },
        "lead-followup:v2": { drafted: 1, sent: 1, replied: 1, failed: 0 },
        "delivery": { drafted: 2, sent: 2, replied: 0, failed: 0 },
      },
      updatedAt: "",
    },
  });
  assert.strictEqual(s.kpis.leadReplyRate, 3 / 5);
});

check("referrer credit uses the real PLANS months table", () => {
  const s = operatorSummary({
    ...base,
    referrals: [
      { id: "r1", referrer: "Ref@X.com", invitee: "i1", orderId: "O1", tier: "monthly", amount: "9.9", currency: "USD" },
      { id: "r2", referrer: "ref@x.com", invitee: "i2", orderId: "O2", tier: "yearly", amount: "99", currency: "USD", paidOutAt: "2026-01-01" },
      { id: "r3", referrer: "ref@x.com", invitee: "i3", orderId: "O3", tier: "standard", amount: "49", currency: "USD" },
    ],
  });
  assert.strictEqual(s.referrers.length, 1);
  const row = s.referrers[0];
  assert.strictEqual(row.referrer, "ref@x.com");
  assert.strictEqual(row.referrals, 3);
  assert.strictEqual(row.monthsOwed, 13, "yearly(12) + monthly(1); standard is not a plan id → 0");
  assert.ok(!row.allPaidOut, "one row unpaid");
});

check("referrer rows sort by months owed then by count", () => {
  const s = operatorSummary({
    ...base,
    referrals: [
      { id: "r1", referrer: "a@x.com", invitee: "i1", orderId: "O1", tier: "monthly" },
      { id: "r2", referrer: "b@x.com", invitee: "i2", orderId: "O2", tier: "yearly" },
    ],
  });
  assert.strictEqual(s.referrers[0].referrer, "b@x.com");
});

console.log(`\n${passed} operator-summary checks passed`);