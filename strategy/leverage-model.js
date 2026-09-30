#!/usr/bin/env node
"use strict";
/**
 * Leverage model — turn Section 5 of the 6-month plan into a runnable machine.
 */
const defaults = {
  startOrders: 1,
  growth: 1.12,
  growthNoise: 0.05,
  reportPrice: 1999,
  fixPrice: 4999,
  fixShare: 0.3,
  aiSub: 600,
  reportTokensIn: 8000,
  reportTokensOut: 4000,
  fixTokensIn: 12000,
  fixTokensOut: 8000,
  tokenPriceIn: 0.00002,   // ¥20/1M input tokens (realistic for GPT-4 class)
  tokenPriceOut: 0.00006,  // ¥60/1M output tokens
  targetGrossMargin: 0.70,
  reinvest: 0.7,
  capOrders: 150,
  gateYuan: 20000,
  leverageCap: 20000,
  leverageShare: 0.1,
  months: 18,
  runs: 500,
};

function parseArgs(argv) {
  const o = { ...defaults };
  for (let i = 0; i < argv.length; i++) {
    const m = argv[i].match(/^--(\w+)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (k in o) o[k] = Number(v);
  }
  return o;
}

function normal(mean, sd, rng) {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runScenario(o, seed) {
  let rng = mulberry32(seed);
  let orders = o.startOrders;
  let cash = 0;
  let gateAWon = null;
  let gateBMonth = null;
  let twoAbove = 0;
  let reinvestBoost = 0;
  let marginBelowFloorMonths = 0;
  let totalInferenceCost = 0;

  for (let m = 1; m <= o.months; m++) {
    const badMonth = normal(1, o.growthNoise, mulberry32(seed + m));
    const capGap = Math.max(0, (o.capOrders - orders) / o.capOrders);
    const rate = Math.max(0, (o.growth - 1 + reinvestBoost) * badMonth);
    orders += orders * rate * Math.max(0, capGap);
    orders = Math.max(1, orders);

    const reportOrders = orders * (1 - o.fixShare);
    const fixOrders = orders * o.fixShare;
    const reportInferCost = (o.reportTokensIn * o.tokenPriceIn + o.reportTokensOut * o.tokenPriceOut);
    const fixInferCost = (o.fixTokensIn * o.tokenPriceIn + o.fixTokensOut * o.tokenPriceOut);
    const inferenceCost = reportOrders * reportInferCost + fixOrders * fixInferCost;
    const revenue = reportOrders * o.reportPrice + fixOrders * o.fixPrice;
    const grossMargin = revenue > 0 ? (revenue - inferenceCost - o.aiSub) / revenue : 0;
    if (grossMargin < o.targetGrossMargin) marginBelowFloorMonths++;
    const net = Math.max(0, revenue - inferenceCost - o.aiSub);
    cash += net;
    totalInferenceCost += inferenceCost;
    reinvestBoost = Math.min((net * o.reinvest) / 5000, 0.06);

    if (net >= o.gateYuan && gateAWon === null) gateAWon = m;
    twoAbove = net >= o.gateYuan ? twoAbove + 1 : 0;
    if (twoAbove >= 2 && gateBMonth === null) gateBMonth = m;
  }

  const finalReportOrders = orders * (1 - o.fixShare);
  const finalFixOrders = orders * o.fixShare;
  const finalReportInferCost = (o.reportTokensIn * o.tokenPriceIn + o.reportTokensOut * o.tokenPriceOut);
  const finalFixInferCost = (o.fixTokensIn * o.tokenPriceIn + o.fixTokensOut * o.tokenPriceOut);
  const finalInferenceCost = finalReportOrders * finalReportInferCost + finalFixOrders * finalFixInferCost;
  const finalRevenue = finalReportOrders * o.reportPrice + finalFixOrders * o.fixPrice;
  const finalGrossMargin = finalRevenue > 0 ? (finalRevenue - finalInferenceCost - o.aiSub) / finalRevenue : 0;
  const finalNet = Math.max(0, finalRevenue - finalInferenceCost - o.aiSub);
  const levBudget = Math.min(cash * 0.1, 20000);

  return {
    finalOrders: orders,
    finalReportOrders: orders * (1 - o.fixShare),
    finalFixOrders: orders * o.fixShare,
    finalMonthlyRevenue: finalReportOrders * o.reportPrice + finalFixOrders * o.fixPrice,
    finalInferenceCost,
    finalGrossMargin,
    finalMonthlyProfit: Math.max(0, finalRevenue - finalInferenceCost - o.aiSub),
    cumulativeNet: cash,
    totalInferenceCost,
    marginBelowFloorMonths,
    avgGrossMargin: finalGrossMargin,
    gateAMonth: gateAWon,
    gateBMonth: gateBMonth,
    gateBWon: gateBMonth !== null,
    levBudget: Math.min(cash * 0.1, 20000),
    levBudgetCapped: Math.min(cash * 0.1, 20000) >= 20000,
  };
}

function stats(arr) {
  const sorted = [...arr].sort((x, y) => x - y);
  const q = (p) => sorted[Math.floor((sorted.length - 1) * p)];
  return { p10: q(0.1), median: q(0.5), p90: q(0.9), mean: sorted.reduce((a, b) => a + b, 0) / sorted.length };
}

function pctile(arr, p) {
  const sorted = [...arr].sort((x, y) => x - y);
  return sorted[Math.floor((sorted.length - 1) * p)];
}

function fmt(n) {
  return n >= 10000 ? (n / 10000).toFixed(1) + "万" : n.toFixed(0);
}

const o = parseArgs(process.argv.slice(2));

const results = Array.from({ length: o.runs }, (_, i) => runScenario(o, 9001 + i));

const ga = results.map((r) => r.gateAMonth).filter((m) => m !== null);
const gb = results.map((r) => r.gateBMonth).filter((m) => m !== null);
const p5 = results.filter((r) => r.cumulativeNet >= 200000).length / o.runs * 100;


console.log("Leverage model — " + o.runs + " runs, " + o.months + " months");
console.log("Assumptions: start " + o.startOrders + " order/mo, growth " + o.growth + "/mo (σ " + o.growthNoise + "), " +
  "¥" + o.reportPrice + "/" + o.fixPrice + " (fix " + o.fixShare + "), AI sub ¥" + o.aiSub + "/mo, reinvest " + o.reinvest);
console.log("Inference: report " + o.reportTokensIn + "/" + o.reportTokensOut + " tok, fix " + o.fixTokensIn + "/" + o.fixTokensOut + " tok, " +
  "¥" + (o.tokenPriceIn * 1e6).toFixed(0) + "/¥" + (o.tokenPriceOut * 1e6).toFixed(0) + " per 1M in/out");
console.log("");
console.log("Gates:");
console.log("  Gate A (profit ≥ ¥" + o.gateYuan + "/mo): reached in " + (ga.length ? stats(ga).median + " months (median)" : "— (never, median run)") + ", " + (ga.length / o.runs * 100).toFixed(1) + "% of runs");
console.log("  Gate B (2 consecutive months): " + (gb.length / o.runs * 100).toFixed(1) + "% of runs, median month " + (gb.length ? stats(gb).median : "—"));
console.log("  Leverage budget = min(cumNet × " + o.leverageShare + ", ¥" + o.leverageCap + ")");
console.log("");
console.log("Distribution (P10 / median / P90):");
console.log("  Final monthly profit ¥" + fmt(pctile(results.map(r => r.finalMonthlyProfit), 0.1)) + " / ¥" + fmt(pctile(results.map(r => r.finalMonthlyProfit), 0.5)) + " / ¥" + fmt(pctile(results.map(r => r.finalMonthlyProfit), 0.9)));
console.log("  Final monthly revenue ¥" + fmt(pctile(results.map(r => r.finalMonthlyRevenue), 0.1)) + " / ¥" + fmt(pctile(results.map(r => r.finalMonthlyRevenue), 0.5)) + " / ¥" + fmt(pctile(results.map(r => r.finalMonthlyRevenue), 0.9)));
console.log("  Final monthly inference cost ¥" + fmt(pctile(results.map(r => r.finalInferenceCost), 0.1)) + " / ¥" + fmt(pctile(results.map(r => r.finalInferenceCost), 0.5)) + " / ¥" + fmt(pctile(results.map(r => r.finalInferenceCost), 0.9)));
console.log("  Final gross margin " + (pctile(results.map(r => r.finalGrossMargin), 0.1)*100).toFixed(1) + "% / " + (pctile(results.map(r => r.finalGrossMargin), 0.5)*100).toFixed(1) + "% / " + (pctile(results.map(r => r.finalGrossMargin), 0.9)*100).toFixed(1) + "%");
console.log("  " + o.months + "-mo cumulative net ¥" + fmt(pctile(results.map(r => r.cumulativeNet), 0.1)) + " / ¥" + fmt(pctile(results.map(r => r.cumulativeNet), 0.5)) + " / ¥" + fmt(pctile(results.map(r => r.cumulativeNet), 0.9)));
console.log("  " + o.months + "-mo total inference cost ¥" + fmt(pctile(results.map(r => r.totalInferenceCost), 0.1)) + " / ¥" + fmt(pctile(results.map(r => r.totalInferenceCost), 0.5)) + " / ¥" + fmt(pctile(results.map(r => r.totalInferenceCost), 0.9)));
console.log("  Avg gross margin " + (pctile(results.map(r => r.avgGrossMargin), 0.1)*100).toFixed(1) + "% / " + (pctile(results.map(r => r.avgGrossMargin), 0.5)*100).toFixed(1) + "% / " + (pctile(results.map(r => r.avgGrossMargin), 0.9)*100).toFixed(1) + "%");
console.log("  Leverage budget ¥" + fmt(pctile(results.map(r => r.levBudget), 0.1)) + " / ¥" + fmt(pctile(results.map(r => r.levBudget), 0.5)) + " / ¥" + fmt(pctile(results.map(r => r.levBudget), 0.9)));
console.log("");
console.log("Months with margin < " + (o.targetGrossMargin*100).toFixed(0) + "%: " + (results.filter(r => r.marginBelowFloorMonths > 0).length / o.runs * 100).toFixed(1) + "% of runs had ≥1 month below floor");
console.log("Reach ¥200k cumulative net in " + o.months + " months: " + p5.toFixed(1) + "% of runs");
console.log("Leverage budget hits the ¥" + o.leverageCap + " cap: " + (results.filter(r => r.levBudgetCapped).length / o.runs * 100).toFixed(1) + "% of runs");
console.log("");
console.log("Honesty note: 'growth' is the unmeasured unknown. Industry base rate (plan §0) is");
console.log("median $500 MRR — most micro-SaaS never reach the ¥20k/month gate. The optimistic");
console.log("12%/mo scenario models Gate A at ~month 13; if the real channel grows slower,");
console.log("re-run with --growth=1.03 and watch the gate vanish. The model is a sensitivity");
console.log("map, not a forecast.");

function stats(arr) {
  const sorted = [...arr].sort((x, y) => x - y);
  const q = (p) => sorted[Math.floor((sorted.length - 1) * p)];
  return { p10: q(0.1), median: q(0.5), p90: q(0.9), mean: sorted.reduce((a, b) => a + b, 0) / sorted.length };
}

function fmt(n) {
  return n >= 10000 ? (n / 10000).toFixed(1) + "万" : n.toFixed(0);
}
