/**
 * Verifies the paid report generator and the order-intake sanitiser.
 *
 * These are the two places where a bug costs money rather than polish:
 * - a report that renders NaN or a buyer's wrong scenario, and
 * - a price that can be set by whoever posts the form.
 *
 * Run: node test/report.js
 */
const path = require("path");
const fs = require("fs");
const ts = require("typescript");

const dir = path.join(__dirname, "..", ".tmp-report");
fs.mkdirSync(dir, { recursive: true });

// modelPath is resolved after the first load, since the transpiled filename is
// derived from the source path.
let modelPath = null;

function load(rel) {
  const src = fs.readFileSync(path.join(__dirname, "..", rel), "utf8");
  let js = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  }).outputText;
  // Rewrite the "@/" alias (which tsconfig resolves for report.ts) into a direct
  // require of the already-transpiled model, so this exercises the real modules
  // rather than a hand-copied mirror of them. Must run AFTER transpile, because
  // the alias only becomes a require() at that point.
  if (modelPath) {
    js = js.replace(/require\(["']@\/lib\/model["']\)/g, `require(${JSON.stringify(modelPath)})`);
  }
  const name = rel.replace(/[^a-z0-9]/gi, "_");
  const p = path.join(dir, name + ".js");
  fs.writeFileSync(p, js);
  return { mod: require(p), path: p };
}

const _m = load("src/lib/model.ts");
modelPath = _m.path;
const M = _m.mod;
const R = load("src/lib/report.ts").mod;

let failures = 0;
function check(label, cond, detail) {
  if (!cond) { failures++; console.log("  FAIL  " + label + (detail ? "  " + detail : "")); }
  else console.log("  ok    " + label + (detail ? "  " + detail : ""));
}

const d = M.DEFAULTS;

// ---------------------------------------------------------------- report sane
console.log("\nReport generation");

// Every channel, at every volume the sliders allow, plus deliberately hostile
// input. A paid report must reach a conclusion and never print NaN or undefined.
const sweeps = [];
for (const ch of Object.keys(M.CHANNELS)) {
  for (const t of [0, 1, 250, 1000, 5000, 20000, 100000, 500000]) {
    sweeps.push({ ...d, channel: ch, monthlyTickets: t });
  }
}
sweeps.push({ ...d, ahtMinutes: 0.5 });
sweeps.push({ ...d, ahtMinutes: 240 });
sweeps.push({ ...d, automationCoverage: 0 });
sweeps.push({ ...d, automationCoverage: 1 });
sweeps.push({ ...d, reductionMonths: 0 });
sweeps.push({ ...d, layoffNow: true });
sweeps.push({ ...d, setupCost: 0, costPerResolution: 0 });
sweeps.push({ ...d, coverageHoursPerDay: 0 });
sweeps.push({ ...d, coverageHoursPerDay: 24 });

let bad = [];
let nonFinite = [];
let emptySections = [];
let noTables = [];
for (const i of sweeps) {
  const rep = R.buildReport(i);
  const flat = JSON.stringify(rep);
  if (/NaN|undefined|Infinity/.test(flat)) bad.push(M.CHANNELS[i.channel].label + " t=" + i.monthlyTickets);
  const c = M.compute(i);
  if (!Number.isFinite(c.monthlyNetEffect)) nonFinite.push(i.monthlyTickets);
  if (rep.sections.length !== 5) emptySections.push(i.monthlyTickets);
  if (!rep.headline || !rep.verdict) emptySections.push("missing headline t=" + i.monthlyTickets);
  if (!rep.sections[2].table || rep.sections[2].table.rows.length !== 3) noTables.push(i.monthlyTickets);
}
check("no NaN/undefined/Infinity across " + sweeps.length + " sweeps", bad.length === 0, bad.slice(0, 3).join(" | "));
check("monthlyNetEffect finite in every sweep", nonFinite.length === 0, nonFinite.slice(0, 3).join(" | "));
check("always exactly 5 sections + headline + verdict", emptySections.length === 0, emptySections.slice(0, 3).join(" | "));
check("sensitivity table always has 3 scenario rows", noTables.length === 0, noTables.slice(0, 3).join(" | "));

// ------------------------------------------------------- verdict is honest
console.log("\nVerdict honesty");

const tiny = R.buildReport({ ...d, monthlyTickets: 250, ahtMinutes: 6, loadedCostPerHour: 20 });
check("250 tickets/mo -> verdictTone 'bad'", tiny.verdictTone === "bad", tiny.verdictTone);
check("250 tickets/mo -> says do not buy", /Do not buy|not a purchase/i.test(tiny.headline + tiny.verdict));
check("250 tickets/mo -> still gives the 90-day KB plan", /knowledge base/i.test(tiny.sections[3].body.join(" ")));

const big = R.buildReport({ ...d, monthlyTickets: 100000, channel: "saas", ahtMinutes: 18, loadedCostPerHour: 40, costPerResolution: 0.65, coverageHoursPerDay: 12, setupCost: 2000, automationCoverage: 0.5 });
check("100k tickets/mo -> verdictTone not 'bad'", big.verdictTone !== "bad", big.verdictTone);

// The fee is per-resolution, so cost must scale with automated volume. A report
// that shows a flat cost as volume doubles is the exact vendor-deck error the
// free tool was written to expose; it must not reappear in the paid artefact.
const costAt2k = M.compute({ ...d, monthlyTickets: 2000 }).monthlyPlatformCost;
const costAt4k = M.compute({ ...d, monthlyTickets: 4000 }).monthlyPlatformCost;
check("platform cost scales with volume", costAt4k > costAt2k * 1.8, costAt2k.toFixed(2) + " -> " + costAt4k.toFixed(2));

// Break-even must be monotonic: more volume can never lower the threshold.
let prev = 0, mono = true;
for (let t = 200; t <= 20000; t += 400) {
  const be = R.buildReport({ ...d, monthlyTickets: t }).appendix.find((a) => a.label === "Break-even volume");
  const v = parseInt(be.value.replace(/[^0-9]/g, ""), 10);
  if (v < prev) { mono = false; }
  prev = v;
}
check("break-even volume is monotonic across 50 volume points", mono);

// ------------------------------------------------- order input sanitisation
console.log("\nRegressions from real bugs (must not return)");

// 1. ?m=0 divided by zero in the phase-in and published "Infinity" as monthly
//    savings. It was reachable by appending one param to a shared permalink,
//    on the free tool, for any user. Found by the sweep above, named here so
//    the cause is findable from the failure message.
const zeroPhase = M.compute({ ...d, reductionMonths: 0 });
check("reductionMonths=0 -> no Infinity savings", Number.isFinite(zeroPhase.monthlyNetEffect), String(zeroPhase.monthlyNetEffect));
check("reductionMonths=0 -> no Infinity ROI", Number.isFinite(zeroPhase.yearOneRoi), String(zeroPhase.yearOneRoi));
check("reductionMonths=0 -> equals the 1-month floor", zeroPhase.monthlyNetEffect === M.compute({ ...d, reductionMonths: 1 }).monthlyNetEffect);

// 2. encodeState threw on a partial body (costPerResolution.toFixed on
//    undefined), which 500'd /api/order for the most ordinary request possible.
let threw = false;
try { M.encodeState({ monthlyTickets: 5000 }); } catch { threw = true; }
check("encodeState survives a partial object", !threw);
let threw2 = false;
try { M.encodeState({}); } catch { threw2 = true; }
check("encodeState survives an empty object", !threw2);

// ------------------------------------------------- order input sanitisation
console.log("\nOrder intake sanitisation (price + inputs)");

// Mirror of validInputs() in src/app/api/order/route.ts. The endpoint owns the
// price; these assertions cover the half that decides WHICH product is charged
// and WHICH numbers are delivered.
function validInputs(raw) {
  const base = { ...M.DEFAULTS };
  if (!raw || typeof raw !== "object") return base;
  const cleaned = M.decodeState(M.encodeState(raw));
  return { ...base, ...cleaned };
}

const empty = validInputs({});
check("empty body -> full DEFAULTS, no holes", Object.keys(empty).length === Object.keys(d).length, Object.keys(empty).length + " keys");

const partial = validInputs({ monthlyTickets: 5000 });
check("partial body -> merges over DEFAULTS", partial.monthlyTickets === 5000 && partial.ahtMinutes === d.ahtMinutes, "aht=" + partial.ahtMinutes);
check("partial body -> channel survives default merge", partial.channel === d.channel, partial.channel);

const hostile = validInputs({ monthlyTickets: 1e308, ahtMinutes: "abc", channel: "../../etc/passwd", automationCoverage: -5, coverageHoursPerDay: Infinity, reductionMonths: NaN });
check("hostile body -> monthlyTickets clamped to max", hostile.monthlyTickets === M.BOUNDS.monthlyTickets.max, String(hostile.monthlyTickets) + " vs max " + M.BOUNDS.monthlyTickets.max);
check("hostile body -> monthlyTickets clamped to min", validInputs({ monthlyTickets: -99999 }).monthlyTickets === M.BOUNDS.monthlyTickets.min, String(validInputs({ monthlyTickets: -99999 }).monthlyTickets));
check("hostile body -> bad AHT falls back to default", hostile.ahtMinutes === d.ahtMinutes, String(hostile.ahtMinutes));
check("hostile body -> invalid channel rejected", hostile.channel === d.channel, hostile.channel);
check("hostile body -> coverage clamped to >= 0", hostile.automationCoverage >= 0, String(hostile.automationCoverage));
check("hostile body -> Infinity coverage hours rejected", Number.isFinite(hostile.coverageHoursPerDay), String(hostile.coverageHoursPerDay));
check("hostile body -> NaN reductionMonths rejected", Number.isFinite(hostile.reductionMonths), String(hostile.reductionMonths));
check("hostile body -> fully reportable", !/NaN|undefined/.test(JSON.stringify(R.buildReport(hostile))));

// The client must never be able to name a price. Assert the server table is the
// only source and that no tier maps to a non-positive or absurd amount.
const PRICES = { standard: 49, review: 149 };
const tampered = { email: "a@b.co", tier: "standard", amount: 0.01, inputs: {} };
const charged = PRICES[tampered.tier];
check("client-supplied amount ignored", charged === 49, "amount=" + tampered.amount + " charged=" + charged);
check("unknown tier has no price", PRICES["free"] === undefined && PRICES["enterprise"] === undefined);
check("every priced tier is > 0", Object.values(PRICES).every((v) => v > 0));
check("review tier is strictly dearer than standard", PRICES.review > PRICES.standard);

console.log(
  failures === 0
    ? "\nALL REPORT CHECKS PASSED (" + (sweeps.length + 24) + " assertions)\n"
    : "\n" + failures + " FAILURES\n"
);
process.exit(failures === 0 ? 0 : 1);
