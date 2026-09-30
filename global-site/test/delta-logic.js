#!/usr/bin/env node
/**
 * Guards the quarter-over-quarter verdict logic.
 *
 * The integration run can only ever exercise one path (nothing changed). These
 * cases pin every other branch, because the whole subscription pitch rests on
 * the "we told you it regressed" claim being true.
 */
const assert = require("assert");
const { scoreOf, diffChecks, tallyItems, verdictFor } = require("../src/lib/geo-audit.js");

const c = (id, weight, score) => ({ id, label: id, weight, score });

let passed = 0;
function t(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ok   " + name);
  } catch (e) {
    console.log("  FAIL " + name + "\n       " + e.message);
    process.exitCode = 1;
  }
}

console.log("scoreOf");
t("normalises raw points to 0-100", () => {
  assert.strictEqual(scoreOf([c("a", 5, 5), c("b", 5, 0)]), 50);
});
t("empty checks score 0 rather than NaN", () => {
  assert.strictEqual(scoreOf([]), 0);
});

console.log("diffChecks states");
t("resolved: failed -> passed", () => {
  const d = diffChecks([c("x", 10, 0)], [c("x", 10, 10)]);
  assert.strictEqual(d[0].state, "resolved");
  assert.strictEqual(d[0].delta, 10);
});
t("regressed: passed -> failed", () => {
  const d = diffChecks([c("x", 10, 10)], [c("x", 10, 0)]);
  assert.strictEqual(d[0].state, "regressed");
  assert.strictEqual(d[0].delta, -10);
});
t("improved: partial gain", () => {
  const d = diffChecks([c("x", 10, 2)], [c("x", 10, 6)]);
  assert.strictEqual(d[0].state, "improved");
});
t("declined: partial loss", () => {
  const d = diffChecks([c("x", 10, 6)], [c("x", 10, 2)]);
  assert.strictEqual(d[0].state, "declined");
});
t("unchanged: identical", () => {
  const d = diffChecks([c("x", 10, 4)], [c("x", 10, 4)]);
  assert.strictEqual(d[0].state, "unchanged");
});
t("untested: in baseline but absent this run", () => {
  const d = diffChecks([c("x", 10, 4)], []);
  assert.strictEqual(d[0].state, "untested");
  assert.strictEqual(d[0].after, null);
});
t("new: absent from baseline", () => {
  const d = diffChecks([], [c("y", 10, 8)]);
  assert.strictEqual(d[0].state, "new");
  assert.strictEqual(d[0].before, null);
});
t("untested and new stay distinct", () => {
  const d = diffChecks([c("x", 10, 4)], [c("y", 10, 8)]);
  const states = d.map((i) => i.state).sort();
  assert.deepStrictEqual(states, ["new", "untested"]);
});

console.log("tallyItems");
t("counts every state", () => {
  const d = [
    ...diffChecks([c("a", 10, 0)], [c("a", 10, 10)]),
    ...diffChecks([c("b", 10, 10)], [c("b", 10, 0)]),
    ...diffChecks([c("c", 10, 5)], [c("c", 10, 5)]),
  ];
  const s = tallyItems(d);
  assert.strictEqual(s.resolved, 1);
  assert.strictEqual(s.regressed, 1);
  assert.strictEqual(s.unchanged, 1);
});

console.log("verdictFor grading");
t(">=8 points reads as effective", () => {
  assert.strictEqual(verdictFor(9, tallyItems(diffChecks([c("a", 10, 0)], [c("a", 10, 10)]))).grade, "有效");
});
t("small positive reads as partial", () => {
  assert.strictEqual(verdictFor(3, tallyItems(diffChecks([c("a", 10, 0)], [c("a", 10, 3)]))).grade, "部分见效");
});
t("item-level gain but flat total is called out", () => {
  const v = verdictFor(0, tallyItems(diffChecks([c("a", 20, 0), c("b", 20, 20)], [c("a", 20, 5), c("b", 20, 10)])));
  assert.strictEqual(v.grade, "局部见效，总分未动");
});
t("no movement at all says so and advises against paying", () => {
  const v = verdictFor(0, tallyItems(diffChecks([c("a", 10, 5)], [c("a", 10, 5)])));
  assert.strictEqual(v.grade, "本季无变化");
  assert.ok(v.line.includes("不必为「持续监控」付费"));
});
t("a regression is never graded as positive", () => {
  const v = verdictFor(-4, tallyItems(diffChecks([c("a", 10, 10)], [c("a", 10, 6)])));
  assert.strictEqual(v.grade, "本季无变化");
  assert.ok(v.line.includes("-4"));
});

console.log("\n" + passed + " checks passed" + (process.exitCode ? " WITH FAILURES" : ""));
