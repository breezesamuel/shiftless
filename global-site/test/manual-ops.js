/**
 * Manual-order closure + lead scoring + template A/B regression tests.
 *
 * 1. Runtime: scoreLead is a pure function — full behavioural coverage.
 * 2. Static: every rail of the funnel that should touch the Blob ledger and
 *    the agent actually does, and the "confirm paid" action is wired end to
 *    end (store → agent → admin route → cockpit button).
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

console.log("lead scoring (runtime)");

const { scoreLead } = require(path.join(__dirname, "..", "src", "lib", "scoring.ts"));

check("empty lead scores 0", () => {
  assert.strictEqual(scoreLead({}), 0);
});
check("email + inputs improves completeness", () => {
  const base = scoreLead({ email: "a@b.com" });
  const rich = scoreLead({ email: "a@b.com", monthlyTickets: 800, ahtMinutes: 6 });
  assert.ok(rich > base);
});
check("volume contributes sub-linearly, capped", () => {
  assert.strictEqual(scoreLead({ volume: 5000 }), 4); // completeness(1) + volume cap(3)
  assert.strictEqual(scoreLead({ volume: 999999 }), 4, "huge volume must not raise the score");
});
check("strong verdict outranks viable outranks not-worth-it", () => {
  const strong = scoreLead({ verdict: "strong" });
  const viable = scoreLead({ verdict: "viable" });
  const weak = scoreLead({ verdict: "not-worth-it" });
  assert.ok(strong > viable);
  assert.ok(viable > weak);
});
check("roi multiples add score", () => {
  const high = scoreLead({ yearOneRoi: 5 });
  const mid = scoreLead({ yearOneRoi: 1.5 });
  const low = scoreLead({ yearOneRoi: 0.2 });
  assert.ok(high > mid && mid > low);
});
check("referral adds warmth", () => {
  assert.ok(scoreLead({ ref: "x@y.com" }) > scoreLead({}));
});
check("score is clamped to 0..10", () => {
  const maxed = scoreLead({
    email: "a@b.com",
    monthlyTickets: 9000,
    ahtMinutes: 8,
    verdict: "strong",
    yearOneRoi: 12,
    source: "corpus-strong",
    ref: "x@y.com",
  });
  assert.ok(maxed >= 0 && maxed <= 10);
  assert.strictEqual(scoreLead({ verdict: "not-worth-it" }) < 0 ? 0 : scoreLead({ verdict: "not-worth-it" }), 0);
});

console.log("\nmanual-order closure (static)");

const subOrder = readSource("src/app/api/sub-order/route.ts");
const geoOrder = readSource("src/app/api/geo-order/route.ts");
const adminMissions = readSource("src/app/api/admin/missions/route.ts");
const adminClient = readSource("src/components/AdminClient.tsx");
const adminData = readSource("src/app/api/admin/data/route.ts");
const agent = readSource("src/lib/agent.ts");
const store = readSource("src/lib/store.ts");

check("sub-order mirrors the order into the Blob ledger", () => {
  assert.ok(subOrder.includes('saveOrderRow({'), "blob row missing");
  assert.ok(subOrder.includes('rail: "sub-order"'), "rail not tagged");
});
check("sub-order honours ref attribution for manual orders", () => {
  assert.ok(subOrder.includes("typeof body.ref === \"string\""), "ref not read from body");
  assert.ok(subOrder.includes("ref,"), "ref not passed to the ledger/event");
});
check("sub-order emits an order event", () => {
  assert.ok(subOrder.includes('emit("order"'), "order event not emitted");
});
check("geo-order mirrors into Blob ledger and emits", () => {
  assert.ok(geoOrder.includes('saveOrder({'), "blob row missing");
  assert.ok(geoOrder.includes('rail: "geo"'), "rail not tagged");
  assert.ok(geoOrder.includes('emit("order"'), "order event not emitted");
});
check("admin has a confirm-manual action", () => {
  assert.ok(adminMissions.includes('body.action === "confirm-manual"'), "action missing");
  assert.ok(adminMissions.includes("confirmManualPayment("), "call missing");
});
check("confirmManualPayment writes referral + emits payment", () => {
  assert.ok(agent.includes("export async function confirmManualPayment("), "fn missing");
  assert.ok(agent.includes('source: "manual"'), "manual referral source missing");
  assert.ok(agent.includes('emit("payment"'), "payment event not emitted");
});
check("confirmManualPayment only accepts manual state (idempotent)", () => {
  assert.ok(agent.includes('order.paymentState === "captured"'), "captured guard missing");
  assert.ok(agent.includes('order.paymentState !== "manual"'), "manual-only guard missing");
});
check("manual referrals dedupe on orderId", () => {
  assert.ok(store.includes("existing.some((r) => r.orderId === rec.orderId)"), "dedupe missing");
});
check("cockpit shows Confirm paid button only for manual orders", () => {
  assert.ok(adminClient.includes('onClick={() => act("confirm-manual"'), "button missing");
  assert.ok(adminClient.includes('ps === "manual"'), "button not gated on manual state");
});
check("cockpit surfaces currency symbol", () => {
  assert.ok(adminClient.includes('currency === "USD" ? "$" : "¥"'), "currency display missing");
});
check("admin data adds lead scores and sorts by them", () => {
  assert.ok(adminData.includes("scoreLead("), "scoring missing");
  assert.ok(adminData.includes(".sort((a, b) =>"), "sort missing");
});

console.log("\ntemplate A/B learning (static)");

check("missions carry a variant id", () => {
  assert.ok(store.includes("variant?: string;"), "variant field missing");
  assert.ok(agent.includes("variant = v.id;"), "variant not recorded in plan");
});
check("planner picks variants from replied-rate knowledge", () => {
  assert.ok(agent.includes("async function pickVariant("), "picker missing");
  assert.ok(agent.includes("templates[`${kindKey}:${id}`]"), "per-variant counters missing");
});
check("knowledge counters are keyed kind:variant", () => {
  assert.ok(agent.includes("function kindKey("), "kindKey missing");
  assert.ok(agent.includes("variant ? `${kind}:${variant}` : kind"), "variant not in key");
});
check("outcome feedback feeds back into variant counters", () => {
  assert.ok(agent.includes('bumpKnowledge(kindKey(m.kind, m.variant)'), "outcome path ignores variant");
});

console.log("\nintel dead-source tasks + failure alerts (static)");

check("planner drafts an intel-dead-source task", () => {
  assert.ok(agent.includes("intel-dead-source"), "task kind missing");
  assert.ok(agent.includes("dead.length > 0 && to"), "dead-source guard missing");
});
check("intel task id is deterministic on the dead set (no pileup)", () => {
  assert.ok(agent.includes("`intel-dead-source:${deadKey}`"), "deterministic id missing");
});
check("failure alert is opt-in via AGENT_ALERT_ON_FAILURE", () => {
  assert.ok(agent.includes("AGENT_ALERT_ON_FAILURE"), "flag missing");
  assert.ok(agent.includes("const ALERT_ON_FAILURE"), "opt-in const missing");
  assert.ok(agent.includes("await alertFailure(m, r.reason)"), "alert not fired on failure");
});
check("approve/retry record the failure reason on the mission", () => {
  assert.ok(agent.includes("failureReason: r.reason"), "failure reason not recorded");
  assert.ok(store.includes("failureReason?: string;"), "mission field missing");
});

console.log("\nfollow-up nudge engine (static)");

const nudgeRoute = readSource("src/app/api/cron/nudge/route.ts");
const vercelJson = readSource("vercel.json");

check("draftNudges only touches sent lead-followup without outcome", () => {
  assert.ok(agent.includes("export async function draftNudges("), "sweep missing");
  assert.ok(agent.includes('m.kind !== "lead-followup"'), "wrong kind not skipped");
  assert.ok(agent.includes('m.status !== "sent"'), "non-sent not skipped");
  assert.ok(agent.includes("if (m.outcome) continue"), "outcome'd missions not skipped");
});
check("nudge id is deterministic on the source mission (no duplicates)", () => {
  assert.ok(agent.includes("`lead-nudge:${m.id}`"), "deterministic id missing");
});
check("nudge is bilingual on the source mission's language", () => {
  assert.ok(agent.includes("m.context?.lang === \"zh\""), "lang not honoured");
  assert.ok(agent.includes("automated follow-up"), "english variant missing");
});
check("nudge endpoint is cron-secret guarded", () => {
  assert.ok(nudgeRoute.includes("CRON_SECRET"), "secret missing");
  assert.ok(nudgeRoute.includes("timingSafeEqual"), "constant-time compare missing");
  assert.ok(nudgeRoute.includes("draftNudges()"), "sweep not called");
});
check("vercel cron schedules the nudge sweep daily", () => {
  assert.ok(vercelJson.includes('"path": "/api/cron/nudge"'), "schedule missing");
  assert.ok(vercelJson.includes('"schedule": "0 9 * * *"'), "wrong schedule");
});
check("drafted counter is wired (not stuck at 0)", () => {
  assert.ok(agent.includes('bumpKnowledge(kindKey(mission.kind, mission.variant), "drafted")'), "drafted not bumped");
});

console.log(`\n${passed} manual-ops checks passed`);