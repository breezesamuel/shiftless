/**
 * Unit tests for the pricing table and referral reward engine.
 * No server, no network. Run: node test/referral-logic.js
 *
 * These guard real money decisions: a wrong reward tier means we either
 * under-deliver product or hand out months we were never paid for.
 */
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ts = require(path.join(ROOT, "node_modules", "typescript"));

// The libs under test are TypeScript. Transpile them into a temp dir with the
// typescript package we already depend on, so this test needs no extra
// dependency and no build step. Both files land in the same dir, so
// referral.ts's `import ... from "./pricing"` resolves normally.
function loadTs(file) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "shiftless-test-"));
  for (const name of ["pricing", "referral"]) {
    const src = fs.readFileSync(path.join(ROOT, "src", "lib", name + ".ts"), "utf8");
    const out = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
    });
    fs.writeFileSync(path.join(outDir, name + ".js"), out.outputText);
  }
  return require(path.join(outDir, file));
}

const pricing = loadTs("pricing.js");
const referral = loadTs("referral.js");

const {
  PLANS,
  PLAN_ORDER,
  FREE_USES,
  getPlan,
  isPlanId,
  isCurrency,
  priceOf,
  formatPrice,
} = pricing;
const {
  REWARD_TIERS,
  paidMonthsOf,
  qualifiesFor,
  rewardProgress,
  bestTier,
  grantedMonths,
  dedupeReferrals,
  settleReward,
} = referral;

let failures = 0;
function check(label, cond, detail) {
  if (!cond) {
    failures++;
    console.log("  FAIL  " + label + (detail ? "  " + detail : ""));
  } else {
    console.log("  ok    " + label + (detail ? "  " + detail : ""));
  }
}

const NOW = "2026-01-01T00:00:00.000Z";
function paid(id, plan) {
  return { id, paidPlan: plan, paidAt: NOW };
}
function unpaid(id) {
  return { id, paidPlan: null, paidAt: null };
}

console.log("\nPricing table");
check("free tier is 10 uses", FREE_USES === 10, String(FREE_USES));
check("monthly CNY = 60", PLANS.monthly.price.cny === 60, String(PLANS.monthly.price.cny));
check("monthly USD = 9.9", PLANS.monthly.price.usd === 9.9, String(PLANS.monthly.price.usd));
check("quarterly CNY = 150", PLANS.quarterly.price.cny === 150, String(PLANS.quarterly.price.cny));
check("quarterly USD = 25", PLANS.quarterly.price.usd === 25, String(PLANS.quarterly.price.usd));
check("yearly CNY = 500", PLANS.yearly.price.cny === 500, String(PLANS.yearly.price.cny));
check("yearly USD = 99", PLANS.yearly.price.usd === 99, String(PLANS.yearly.price.usd));

check("plan grant days align with months",
  PLANS.monthly.days === 30 && PLANS.quarterly.days === 90 && PLANS.yearly.days === 365);
check("plan months are 1/3/12",
  PLANS.monthly.months === 1 && PLANS.quarterly.months === 3 && PLANS.yearly.months === 12);

check("longer plans are cheaper per month (CNY)",
  PLANS.yearly.monthlyEquivalent.cny < PLANS.quarterly.monthlyEquivalent.cny &&
  PLANS.quarterly.monthlyEquivalent.cny < PLANS.monthly.monthlyEquivalent.cny);
check("longer plans are cheaper per month (USD)",
  PLANS.yearly.monthlyEquivalent.usd < PLANS.quarterly.monthlyEquivalent.usd &&
  PLANS.quarterly.monthlyEquivalent.usd < PLANS.monthly.monthlyEquivalent.usd);

console.log("\nGuards");
check("getPlan rejects unknown id", getPlan("enterprise") === null);
check("getPlan accepts monthly", getPlan("monthly")?.id === "monthly");
check("isPlanId rejects 'report'", !isPlanId("report"));
check("isCurrency accepts cny/usd", isCurrency("cny") && isCurrency("usd"));
check("isCurrency rejects eur", !isCurrency("eur"));
check("formatPrice CNY integral", formatPrice(500, "cny") === "¥500", formatPrice(500, "cny"));
check("formatPrice USD fractional", formatPrice(9.9, "usd") === "$9.90", formatPrice(9.9, "usd"));
check("priceOf ignores client input shape", priceOf("yearly", "usd") === 99);

console.log("\nPaid-depth accounting");
check("paid monthly referral = 1 month", paidMonthsOf(paid("a", "monthly")) === 1);
check("paid quarterly referral = 3 months", paidMonthsOf(paid("a", "quarterly")) === 3);
check("paid yearly referral = 12 months", paidMonthsOf(paid("a", "yearly")) === 12);
check("unpaid referral = 0 months", paidMonthsOf(unpaid("a")) === 0);
check("plan without paidAt = 0 months",
  paidMonthsOf({ id: "a", paidPlan: "yearly", paidAt: null }) === 0);

console.log("\nReferral: 1 paid month -> 1 month");
{
  const refs = [paid("a", "monthly")];
  const b = bestTier(refs);
  check("tier is first_paid", b.id === "first_paid", b.id);
  check("grants 1 month", grantedMonths(refs) === 1, String(grantedMonths(refs)));
}
check("one UNPAID referral grants nothing", grantedMonths([unpaid("a")]) === 0);

console.log("\nReferral: 3 quarterly -> 3 months (not cumulative)");
{
  const refs = [paid("a", "quarterly"), paid("b", "quarterly"), paid("c", "quarterly")];
  const b = bestTier(refs);
  check("tier is three_quarters", b.id === "three_quarters", b.id);
  check("grants exactly 3 months (not 1+3)", grantedMonths(refs) === 3, String(grantedMonths(refs)));
}

console.log("\nReferral: depth actually matters");
{
  const threeMonthly = [paid("a", "monthly"), paid("b", "monthly"), paid("c", "monthly")];
  check("3x monthly does NOT reach quarterly tier", bestTier(threeMonthly).id === "first_paid",
    bestTier(threeMonthly).id);
  const twoMonthly = [paid("a", "monthly"), paid("b", "monthly")];
  check("2 paid referrals still first_paid", bestTier(twoMonthly).id === "first_paid");
  check("1 quarterly alone is NOT 3 referrals deep", bestTier([paid("a", "quarterly")]).id === "first_paid");
}

console.log("\nReferral: 10 yearly -> 12 months (not cumulative)");
{
  const refs = Array.from({ length: 10 }, (_, i) => paid("r" + i, "yearly"));
  const b = bestTier(refs);
  check("tier is ten_years", b.id === "ten_years", b.id);
  check("grants exactly 12 months (not 16)", grantedMonths(refs) === 12, String(grantedMonths(refs)));
}
{
  const nine = Array.from({ length: 9 }, (_, i) => paid("r" + i, "yearly"));
  check("9 yearly referrals do NOT reach top tier", bestTier(nine).id !== "ten_years",
    bestTier(nine).id);
}

console.log("\nReferral: unpaid & duplicates do not inflate");
{
  const refs = [
    paid("a", "yearly"), paid("b", "yearly"), unpaid("c"), unpaid("d"),
    ...Array.from({ length: 6 }, (_, i) => unpaid("u" + i)),
  ];
  const t = bestTier(refs);
  check("2 yearly + 8 unpaid stays first_paid", t.id === "first_paid", t.id);
  check("grants 1 month not more", grantedMonths(refs) === 1);
}
{
  // Same referral id replayed 3 times must not become 3 referrals.
  const dupes = [paid("a", "quarterly"), paid("a", "quarterly"), paid("a", "quarterly")];
  const uniq = dedupeReferrals(dupes);
  check("dedupe collapses repeats", uniq.length === 1, String(uniq.length));
  check("3 replays of 1 referral stay first_paid", bestTier(dupes).id === "first_paid",
    bestTier(dupes).id);
}
{
  const dupes = Array.from({ length: 10 }, () => paid("same", "yearly"));
  check("10x replayed same id does NOT reach top tier", bestTier(dupes).id !== "ten_years",
    bestTier(dupes).id);
}

console.log("\nProgress reporting");
{
  const refs = [paid("a", "monthly"), paid("b", "monthly")];
  const prog = rewardProgress(refs);
  const top = prog[prog.length - 1];
  check("top tier reached=false with 2 paid", top.reached === false);
  // 2 monthly referrals have no annual depth, so they do NOT count toward the
  // top tier at all: all 10 qualifying referrals are still outstanding.
  check("top tier remaining = 10 (monthly lack depth)", top.remaining === 10, String(top.remaining));
  check("top tier qualified = 0", top.qualified === 0, String(top.qualified));
  check("paidReferrals counted = 2", top.paidReferrals === 2, String(top.paidReferrals));
  check("ratio is 0..1", top.ratio >= 0 && top.ratio <= 1, String(top.ratio));
  const first = prog[1];
  check("first_paid reached with 2 paid", first.reached === true);
}
{
  const prog = rewardProgress([]);
  check("zero referrals -> ratio 0 everywhere", prog.slice(1).every((p) => p.ratio === 0));
  check("zero referrals -> remaining unchanged", prog[3].remaining === 10, String(prog[3].remaining));
}
{
  const prog = rewardProgress([unpaid("a"), unpaid("b")]);
  check("unpaid referrals give 0 progress", prog[3].ratio === 0, String(prog[3].ratio));
}

console.log("\nSettlement");
{
  const refs = [paid("a", "quarterly"), paid("a", "quarterly"), paid("b", "quarterly"), paid("c", "quarterly")];
  const s = settleReward(refs);
  check("settleReward dedupes", s.paidReferrals === 3, String(s.paidReferrals));
  check("settleReward grants 3 months", s.months === 3, String(s.months));
  check("settleReward tier is three_quarters", s.tier.id === "three_quarters", s.tier.id);
}
check("settleReward on empty = 0 months", settleReward([]).months === 0);

console.log("\nTier ladder integrity");
check("4 tiers defined", REWARD_TIERS.length === 4, String(REWARD_TIERS.length));
check("tiers ascend in referral count",
  REWARD_TIERS[1].minReferrals < REWARD_TIERS[2].minReferrals &&
  REWARD_TIERS[2].minReferrals < REWARD_TIERS[3].minReferrals);
check("every tier has bilingual label",
  REWARD_TIERS.every((t) => t.label.cny && t.label.usd));

console.log("\nEvery plan has a reward ceiling");
for (const p of PLAN_ORDER) {
  const months = PLANS[p].months;
  const fits = REWARD_TIERS.some((t) => t.minMonthsPerReferral === months);
  check(`plan ${p} (${months}mo) matches a reward tier depth`, fits);
}

console.log(failures === 0 ? "\nALL REFERRAL/PRICING CHECKS PASSED\n" : "\n" + failures + " FAILURES\n");
process.exit(failures === 0 ? 0 : 1);
