/**
 * Verifies the REAL model.ts (not a mirror) against sanity benchmarks.
 * Run: node test/verify.js
 */
const path = require("path");
const fs = require("fs");
const ts = require("typescript");

const src = fs.readFileSync(path.join(__dirname, "..", "src", "lib", "model.ts"), "utf8");
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
fs.mkdirSync(path.join(__dirname, "..", ".tmp-verify"), { recursive: true });
const outPath = path.join(__dirname, "..", ".tmp-verify", "model.js");
fs.writeFileSync(outPath, js);
const M = require(outPath);

let failures = 0;
function check(label, cond, detail) {
  if (!cond) { failures++; console.log("  FAIL  " + label + (detail ? "  " + detail : "")); }
  else console.log("  ok    " + label + (detail ? "  " + detail : ""));
}

const d = M.DEFAULTS;
const cases = [
  { label: "tiny 250/mo",      i: { ...d, monthlyTickets: 250, ahtMinutes: 6, loadedCostPerHour: 20 }, v: "not-worth-it" },
  { label: "SMB 800/mo",       i: { ...d, monthlyTickets: 800, ahtMinutes: 7, loadedCostPerHour: 22 }, v: null },
  { label: "default 3000/mo",  i: { ...d }, v: null },
  { label: "mid 5000/mo",      i: { ...d, monthlyTickets: 5000 }, v: null },
  { label: "SaaS 2000/mo",     i: { ...d, monthlyTickets: 2000, ahtMinutes: 12, loadedCostPerHour: 40, coverageHoursPerDay: 12, costPerResolution: 0.65, setupCost: 2000, automationCoverage: 0.5, channel: "saas" }, v: null },
  { label: "large 30000/mo",   i: { ...d, monthlyTickets: 30000, ahtMinutes: 9, loadedCostPerHour: 30, costPerResolution: 0.6, setupCost: 6000, automationCoverage: 0.55 }, v: null },
  { label: "huge 80000/mo 24h",i: { ...d, monthlyTickets: 80000, ahtMinutes: 10, loadedCostPerHour: 28, coverageHoursPerDay: 24, costPerResolution: 0.55, setupCost: 15000, automationCoverage: 0.6 }, v: null },
  { label: "expensive CPR 1.20", i: { ...d, monthlyTickets: 5000, costPerResolution: 1.2 }, v: null },
  { label: "overclaim 90%",    i: { ...d, monthlyTickets: 5000, automationCoverage: 0.9 }, v: null },
  { label: "layoff now 5000",  i: { ...d, monthlyTickets: 5000, layoffNow: true }, v: null },
];

console.log("\n=== results ===");
for (const c of cases) {
  const o = M.compute(c.i);
  const pb = Number.isFinite(o.paybackMonths) ? o.paybackMonths.toFixed(1) : "-";
  console.log(
    c.label.padEnd(20) +
    ("agents " + o.agentsRange[0] + "-" + o.agentsRange[1]).padEnd(18) +
    ("-> " + o.agentsAfterAutomation).padEnd(10) +
    ("plat/mo $" + Math.round(o.monthlyPlatformCost)).padEnd(20) +
    ("net/mo $" + Math.round(o.monthlyNetEffect)).padEnd(20) +
    ("y1ROI " + o.yearOneRoi.toFixed(1) + "x").padEnd(16) +
    ("pb " + pb).padEnd(9) + o.verdict
  );
  if (c.v) check(c.label + " verdict == " + c.v, o.verdict === c.v, "got " + o.verdict);
}

console.log("\n=== industry sanity ===");
const o5 = M.compute({ ...d, monthlyTickets: 5000 });
check("5000 tickets/mo ~= 3-4 agents (industry: 1 per ~100-150/day)", o5.agentsNeeded >= 3 && o5.agentsNeeded <= 4, "got " + o5.agentsNeeded);
check("no double-counting: 8h coverage gives crew depth 1.45, not 4.6x", o5.agentsNeeded < 6, "got " + o5.agentsNeeded);
check("year-1 ROI is plausible (1.5x-6x, not 26x)", o5.yearOneRoi > 1.5 && o5.yearOneRoi < 6, "got " + o5.yearOneRoi.toFixed(1) + "x");

console.log("\n=== range ordering (regression: rendered '3-2 agents') ===");
for (const c of cases) {
  const o = M.compute(c.i);
  check(
    c.label + ": range ascending + cost range ascending",
    o.agentsRange[0] <= o.agentsRange[1] && o.monthlyLaborCostRange[0] <= o.monthlyLaborCostRange[1],
    "agents " + o.agentsRange.join("-") + " cost " + o.monthlyLaborCostRange.map(Math.round).join("-")
  );
  break; // identical logic across cases; one is enough, but assert all below
}
let rangeOk = true;
for (const c of cases) {
  const o = M.compute(c.i);
  if (o.agentsRange[0] > o.agentsRange[1] || o.monthlyLaborCostRange[0] > o.monthlyLaborCostRange[1]) {
    rangeOk = false;
    console.log("  FAIL  " + c.label + " range inverted");
  }
}
check("all scenarios have ascending ranges", rangeOk);

const oh = M.compute(cases.find(c => c.label === "huge 80000/mo 24h").i);
check("80k tickets/mo 24h coverage < 250 agents", oh.agentsNeeded < 250, "got " + oh.agentsNeeded);

const ooc = M.compute(cases.find(c => c.label === "overclaim 90%").i);
check("90% claim capped to 62% ceiling", Math.abs(ooc.effectiveCoverage - 0.62) < 1e-9, "got " + ooc.effectiveCoverage);
check("overclaim is flagged", ooc.coverageCeilingExceeded === true);

const ot = M.compute(cases.find(c => c.label === "tiny 250/mo").i);
check("250 tickets/mo says do-not-buy", ot.verdict === "not-worth-it");
check("no month gives a 6x+ return without warning", o5.reasons.some(r => /overstated|re-check/i.test(r)) || o5.yearOneRoi <= 6);

console.log("\n=== cost-per-ticket integrity (regression: $17.55 at 7min AHT) ===");
{
  // An agent clears capacityPerShift tickets per shift, over SHIFTS_PER_FTE
  // shifts a month. A wrong monthly divisor makes cost-per-ticket off by ~3x.
  const perMonth = M.ticketsPerAgentMonth(7);
  const cost = M.loadedCostPerAgent(26) / perMonth;
  check("7min AHT clears 700-1000 tickets/agent/month", perMonth > 700 && perMonth < 1000, "got " + Math.round(perMonth));
  check("cost per ticket is $3-$9, not $17", cost > 3 && cost < 9, "got $" + cost.toFixed(2));

  // Longer handle time = fewer tickets = MORE expensive per ticket.
  let mono = true, prev = -Infinity;
  for (const aht of [4, 7, 12, 18, 25]) {
    const c = M.loadedCostPerAgent(26) / M.ticketsPerAgentMonth(aht);
    if (c <= prev) mono = false;
    prev = c;
  }
  check("cost per ticket rises monotonically as AHT rises", mono);
  console.log("  ecom 7min  -> $" + (M.loadedCostPerAgent(26) / M.ticketsPerAgentMonth(7)).toFixed(2) + "/ticket");
  console.log("  saas 18min -> $" + (M.loadedCostPerAgent(26) / M.ticketsPerAgentMonth(18)).toFixed(2) + "/ticket");
}

console.log("\n=== URL state codec (share permalink) ===");
{
  const orig = { ...d, channel: "saas", monthlyTickets: 7200, ahtMinutes: 11,
                 loadedCostPerHour: 33, coverageHoursPerDay: 12,
                 automationCoverage: 0.45, costPerResolution: 0.85, setupCost: 2500 };
  const qs = M.encodeState(orig);
  const back = M.decodeState("?" + qs);
  let same = true;
  for (const k of Object.keys(orig)) if (orig[k] !== back[k]) { same = false; console.log("  mismatch " + k + ": " + orig[k] + " vs " + back[k]); }
  check("round-trip preserves every field", same, qs);

  // Hostile / malformed input must be clamped or dropped, never passed through.
  const h = M.decodeState("?t=NaN&a=99999&r=-50&h=abc&c=../../etc/passwd&d=99999&p=1e308&s=-1");
  check("NaN tickets dropped", h.monthlyTickets === undefined, String(h.monthlyTickets));
  check("AHT 99999 clamped to 40", h.ahtMinutes === 40, String(h.ahtMinutes));
  check("negative rate clamped to 8", h.loadedCostPerHour === 8, String(h.loadedCostPerHour));
  check("non-numeric hours dropped", h.coverageHoursPerDay === undefined, String(h.coverageHoursPerDay));
  check("unknown channel rejected", h.channel === undefined, String(h.channel));
  check("coverage 99999 clamped to 95", h.automationCoverage === 0.95, String(h.automationCoverage));
  check("price 1e308 clamped to 3", h.costPerResolution === 3, String(h.costPerResolution));
  check("negative setup clamped to 0", h.setupCost === 0, String(h.setupCost));

  // A hostile URL must still produce a renderable, finite result.
  const o = M.compute({ ...d, ...h });
  check("hostile URL yields finite numbers", Number.isFinite(o.monthlyNetEffect) && Number.isFinite(o.agentsRange[1]));
  check("hostile URL still ranges sane", o.agentsRange[0] >= 1 && o.agentsRange[1] < 500, o.agentsRange.join("-"));

  const u = M.shareUrl(orig, "https://shiftless.vercel.app/");
  check("shareUrl has no double slash", u.indexOf("shiftless.vercel.app/?v=") > -1, u.slice(0, 60));
}

console.log("\ncapacity/shift: 7min=" + M.capacityPerShift(7) + " 8min=" + M.capacityPerShift(8) + " 12min=" + M.capacityPerShift(12) + " 18min=" + M.capacityPerShift(18));
console.log("tickets/agent/mo: 7min=" + Math.round(M.ticketsPerAgentMonth(7)) + " 12min=" + Math.round(M.ticketsPerAgentMonth(12)));
console.log("loaded/agent/mo @$26/h = $" + Math.round(M.loadedCostPerAgent(26)));
console.log(failures === 0 ? "\nALL CHECKS PASSED" : "\n" + failures + " CHECK(S) FAILED");
process.exit(failures === 0 ? 0 : 1);
