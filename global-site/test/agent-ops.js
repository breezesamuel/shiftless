/**
 * Autonomous-ops regression tests.
 *
 * Two halves:
 * 1. Runtime: the shared admin token guard (constant-time, denies when unset).
 * 2. Static: the wiring that makes the hidden backend real — every business
 *    event reaches the agent, orders/referrals persist to Blob, the cockpit
 *    is token-guarded, and the intel cron never copies content.
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

console.log("admin token guard (runtime)");

const { adminTokenOk } = require(path.join(__dirname, "..", "src", "lib", "admin.ts"));

check("correct token accepted", () => {
  process.env.AGENT_ADMIN_TOKEN = "s3cret-cockpit-token";
  assert.ok(adminTokenOk("s3cret-cockpit-token"));
});
check("wrong token rejected", () => {
  assert.ok(!adminTokenOk("nope"));
});
check("empty token rejected", () => {
  assert.ok(!adminTokenOk(""));
  assert.ok(!adminTokenOk(null));
});
check("unset configured token denies everything", () => {
  delete process.env.AGENT_ADMIN_TOKEN;
  delete process.env.LEAD_EXPORT_TOKEN;
  assert.ok(!adminTokenOk("s3cret-cockpit-token"));
});
check("LEAD_EXPORT_TOKEN is a valid fallback", () => {
  process.env.LEAD_EXPORT_TOKEN = "export-secret";
  assert.ok(adminTokenOk("export-secret"));
  delete process.env.LEAD_EXPORT_TOKEN;
});

console.log("\nautonomous-ops wiring (static)");

const leadRoute = readSource("src/app/api/lead/route.ts");
const orderRoute = readSource("src/app/api/order/route.ts");
const paypalReturn = readSource("src/app/api/paypal/return/route.ts");
const adminData = readSource("src/app/api/admin/data/route.ts");
const adminMissions = readSource("src/app/api/admin/missions/route.ts");
const cronRefresh = readSource("src/app/api/cron/refresh/route.ts");
const agent = readSource("src/lib/agent.ts");
const store = readSource("src/lib/store.ts");
const corpusCta = readSource("src/components/CorpusLeadCta.tsx");

check("lead route emits an agent event (fire-and-forget)", () => {
  assert.ok(leadRoute.includes('emit("lead"'), "lead event not emitted");
  assert.ok(leadRoute.includes("void emit("), "emit must be fire-and-forget");
});
check("lead route stores lang for bilingual drafts", () => {
  assert.ok(leadRoute.includes('lang: body.lang === "zh" ? "zh" : "en"'), "lang not stored");
});
check("order route persists the order to Blob", () => {
  assert.ok(orderRoute.includes("saveOrder("), "order not persisted");
  assert.ok(orderRoute.includes('paymentState: paymentUrl ? "checkout-created" : "manual"'), "payment state wrong");
});
check("order route emits an order event", () => {
  assert.ok(orderRoute.includes('emit("order"'), "order event not emitted");
});
check("paypal capture marks the order captured", () => {
  assert.ok(paypalReturn.includes('paymentState: "captured"'), "capture not recorded");
});
check("paypal capture writes the referral ledger automatically on ref", () => {
  assert.ok(paypalReturn.includes("saveReferral("), "referral not recorded");
  assert.ok(paypalReturn.includes('source: "paypal-capture"'), "source not set");
});
check("paypal capture emits a payment event", () => {
  assert.ok(paypalReturn.includes('emit("payment"'), "payment event not emitted");
});
check("referral ledger dedupes on orderId", () => {
  assert.ok(store.includes("existing.some((r) => r.orderId === rec.orderId)"), "dedupe missing");
});
check("admin data route is token-guarded and returns the four ledgers", () => {
  assert.ok(adminData.includes("adminTokenOk("), "guard missing");
  for (const name of ["listLeads", "listOrders", "listReferrals", "listMissions"]) {
    assert.ok(adminData.includes(name), `${name} not in admin feed`);
  }
});
check("admin missions route guards approve/reject/outcome", () => {
  assert.ok(adminMissions.includes("adminTokenOk("), "guard missing");
  assert.ok(adminMissions.includes('body.action === "approve"'), "approve missing");
  assert.ok(adminMissions.includes('body.action === "reject"'), "reject missing");
  assert.ok(adminMissions.includes('body.action === "outcome"'), "outcome missing");
});
check("cron refresh is secret-guarded and records intel (no content copy)", () => {
  assert.ok(cronRefresh.includes("CRON_SECRET"), "cron secret missing");
  assert.ok(cronRefresh.includes('emit("intel"'), "intel not emitted");
  assert.ok(cronRefresh.includes("stargazers_count"), "github meta missing");
  assert.ok(!/copy|scrape|paste/i.test(cronRefresh), "cron must not copy content");
});
check("agent drafts are honest (no fake sent claims)", () => {
  assert.ok(agent.includes('status: "pending"'), "missions must start pending");
  assert.ok(agent.includes("AGENT_AUTO_SEND"), "auto-send flag missing");
  assert.ok(agent.includes("replied"), "outcome learning missing");
});
check("corpus CTA sends lang with the lead", () => {
  assert.ok(corpusCta.includes("lang, source:"), "lang not sent");
});

console.log(`\n${passed} agent-ops checks passed`);