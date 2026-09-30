#!/usr/bin/env node
/**
 * quarterly-selftest.js — 复审引擎的回归自检
 *
 * 验证四条断言（每条只扫 1 个页面，保持快速）：
 *   1. 无变化路径：基线 == 本轮 → delta 0、判定「本季无变化」
 *   2. 已修复路径：把基线某几项打 0 分 → 本轮应判定「已修复」且总分上升
 *   3. 一致性：逐页分数差 == 该页明细各项分差之和（缓存分数不得与明细自相矛盾）
 *   4. 隔离性：自检产物只写进 --out 指定的临时目录，不污染真实客户目录
 *
 * 用法: node quarterly-selftest.js [url]   默认 https://www.jackyun.com
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const url = process.argv[2] || "https://www.jackyun.com";
const QUARTERLY = path.join(__dirname, "quarterly.js");
const tmp = path.join(__dirname, "subscriptions", "_selftest");

let failures = 0;
const ok = (name, cond, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
  if (!cond) failures++;
};

function run(args) {
  return execFileSync(process.execPath, [QUARTERLY, ...args], { encoding: "utf8", timeout: 180000 });
}

function onePageSnapshot() {
  const out = execFileSync(process.execPath, [path.join(__dirname, "audit.js"), url, "--json"], { encoding: "utf8", timeout: 60000 });
  const parsed = JSON.parse(out);
  const raw = (parsed.checks || []).reduce((s, c) => s + (c.score || 0), 0);
  const w = (parsed.checks || []).reduce((s, c) => s + c.weight, 0);
  const score = w ? Math.round((raw / w) * 100) : 0;
  return {
    url, quarter: "2026-Q1", createdAt: new Date().toISOString(), overall: score,
    pages: [{ url, ok: true, score, checks: parsed.checks || [] }],
  };
}

function writeSnap(name, snap) {
  fs.mkdirSync(tmp, { recursive: true });
  const p = path.join(tmp, name);
  fs.writeFileSync(p, JSON.stringify(snap, null, 2), "utf8");
  return p;
}

function findReport(baseDir) {
  const dir = path.join(baseDir, "reports");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith("-review.md")).sort();
  return path.join(dir, files[files.length - 1]);
}

const slug = new URL(url).hostname.replace(/^www\./, "").replace(/\./g, "-");
const realDir = path.join(__dirname, "subscriptions", slug);
const realBefore = fs.existsSync(realDir) ? fs.readdirSync(realDir) : null;

console.log(`自检目标: ${url}\n`);

const base = onePageSnapshot();
console.log(`基线得分: ${base.overall}/100`);

const same = writeSnap("same-baseline.json", base);
run(["--verify", `--baseline=${same}`, `--out=${tmp}`]);
let md = fs.readFileSync(findReport(path.join(tmp, slug)), "utf8");
ok("无变化路径：判定为本季无变化", /本季无变化/.test(md));
ok("无变化路径：总分变化为 +0", /\|\s*站点聚合可读性\s*\|\s*\d+\s*\|\s*\d+\s*\|\s*\*\*\+0\*\*/.test(md));

const degraded = JSON.parse(JSON.stringify(base));
degraded.quarter = "2025-Q4";
let touched = 0;
for (const c of degraded.pages[0].checks) {
  if (c.score > 0 && ["jsonld", "headings", "citations", "social"].includes(c.id)) { c.score = 0; touched++; }
}
const degPath = writeSnap("degraded-baseline.json", degraded);

if (!touched) {
  console.log("SKIP  已修复路径：该站这些检查项本来就是 0 分，无法构造降级基线");
} else {
  run(["--verify", `--baseline=${degPath}`, `--out=${tmp}`]);
  md = fs.readFileSync(findReport(path.join(tmp, slug)), "utf8");
  const m = md.match(/\|\s*✅\s*已修复\s*\|[^|]*\|\s*(\d+)\s*\|/);
  ok("已修复路径：至少 1 项判定为已修复", !!m && Number(m[1]) >= 1, m ? `已修复 ${m[1]} 项` : "未找到统计行");
  const agg = (md.match(/\|\s*站点聚合可读性[^\n]*/) || [""])[0].trim();
  ok("已修复路径：总分变化为正", /\|\s*站点聚合可读性\s*\|\s*\d+\s*\|\s*\d+\s*\|\s*\*\*\+\d+\*\*/.test(md), agg);

  const pageBlocks = md.split(/^### /m).slice(1);
  let consistent = true;
  let detail = "";
  for (const blk of pageBlocks) {
    const sm = blk.match(/得分 (\d+) → (\d+)（([+-]\d+)）/);
    if (!sm) continue;
    const stated = Number(sm[3]);
    let sum = 0;
    const rows = [...blk.matchAll(/^\| .+? \| \d+ \| [^|]* \| [^|]* \| ([+-]\d+) \|/gm)];
    for (const r of rows) sum += Number(r[1]);
    if (rows.length && Math.abs(stated - sum) > 1) { consistent = false; detail = `页内标注 ${stated} vs 明细合计 ${sum}`; break; }
  }
  ok("一致性：逐页分数差等于明细各项分差之和", consistent, detail);
}

const realAfter = fs.existsSync(realDir) ? fs.readdirSync(realDir) : null;
ok("隔离性：未污染真实客户目录", JSON.stringify(realBefore) === JSON.stringify(realAfter));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${failures === 0 ? "全部通过" : failures + " 项失败"}`);
process.exit(failures === 0 ? 0 : 1);
