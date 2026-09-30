#!/usr/bin/env node
/**
 * batch-audit.js — 批量跑 full-report.js --fixes，产出行业分布 + 样板库
 *
 * 用法:
 *   node batch-audit.js --list=targets.json --out=sample/batch-20260930 --concurrency=2
 *   node batch-audit.js --url=https://a.com --url=https://b.com --out=sample/test
 *
 * targets.json 格式:
 * [
 *   { "id": "A2", "name": "吉客云", "url": "https://www.jackyun.com", "tier": "A", "city": "杭州" },
 *   { "id": "B5", "name": "星商", "url": "https://starmerx.com", "tier": "B", "city": "深圳" }
 * ]
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const os = require("os");

const args = process.argv.slice(2);
function arg(name) {
  const i = args.findIndex((a) => a === name || a.startsWith(name + "="));
  if (i < 0) return null;
  if (args[i].includes("=")) return args[i].split("=")[1];
  return args[i + 1];
}
function argBool(name) { return args.includes(name); }

const listPath = arg("--list");
const urls = args.filter((a) => a.startsWith("--url=")).map((a) => a.split("=")[1]);
const outDir = arg("--out") || path.join(__dirname, "sample", `batch-${Date.now()}`);
const concurrency = Number(arg("--concurrency") || "2");
const timeoutMs = Number(arg("--timeout") || "180000"); // per site

if (!listPath && urls.length === 0) {
  console.error("usage: node batch-audit.js --list=targets.json [--url=...] [--out=dir] [--concurrency=2]");
  process.exit(2);
}

let targets = [];
if (listPath) {
  targets = JSON.parse(fs.readFileSync(listPath, "utf8"));
}
for (const u of urls) {
  targets.push({ id: "manual", name: new URL(u).hostname, url: u, tier: "manual", city: "" });
}

console.error(`Loaded ${targets.length} targets. Output: ${outDir}, concurrency=${concurrency}`);
fs.mkdirSync(outDir, { recursive: true });

const results = [];
const summary = [];

async function runOne(t) {
  const start = Date.now();
  const host = new URL(t.url).hostname.replace(/^www\./, "").replace(/\./g, "-");
  const outFile = path.join(outDir, `${t.id}-${host}.audit-report.md`);
  try {
    const out = execFileSync(
      process.execPath,
      [path.join(__dirname, "full-report.js"), t.url, `--${outDir}`, "--fixes"],
      { encoding: "utf8", timeout: timeoutMs, stdio: "pipe" }
    );
    // Parse aggregate score from output
    const m = out.match(/聚合得分: (\d+)\/100/);
    const score = m ? Number(m[1]) : null;
    results.push({ ...t, host, score, outFile, ok: true, durationMs: Date.now() - start });
    console.error(`✓ ${t.id} ${t.name} (${t.url}) -> ${score}/100 (${Math.round((Date.now() - start) / 1000)}s)`);
  } catch (e) {
    results.push({ ...t, host, score: null, outFile: null, ok: false, error: e.message, durationMs: Date.now() - start });
    console.error(`✗ ${t.id} ${t.name} (${t.url}) -> FAILED: ${e.message}`);
  }
}

async function main() {
  // Simple queue with concurrency limit
  const queue = [...targets];
  const running = [];
  while (queue.length || running.length) {
    while (running.length < concurrency && queue.length) {
      const t = queue.shift();
      const p = runOne(t);
      running.push(p);
      p.finally(() => {
        const i = running.indexOf(p);
        if (i >= 0) running.splice(i, 1);
      });
    }
    if (running.length) await Promise.race(running);
  }

  // Write summary CSV
  const csv = ["id,name,url,tier,city,score,ok,durationMs"];
  for (const r of results) {
    csv.push(`${r.id},"${r.name}","${r.url}",${r.tier || ""},${r.city || ""},${r.score ?? ""},${r.ok},${r.durationMs}`);
  }
  const csvPath = path.join(outDir, "summary.csv");
  fs.writeFileSync(csvPath, csv.join("\n"), "utf8");

  // Aggregate by tier
  const byTier = {};
  for (const r of results.filter((x) => x.ok)) {
    const t = r.tier || "unknown";
    if (!byTier[t]) byTier[t] = [];
    byTier[t].push(r.score);
  }
  console.error("\n=== TIER AGGREGATES ===");
  for (const [tier, scores] of Object.entries(byTier)) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    console.error(`${tier}: n=${scores.length}, avg=${avg.toFixed(1)}, min=${min}, max=${max}`);
  }

  // Pick top 10+ for samples (highest score = best legibility = best showcase)
  const samples = results.filter((r) => r.ok && r.score !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  console.error("\n=== SAMPLE CANDIDATES (top 12 by score) ===");
  for (const s of samples) {
    console.error(`  ${s.score}/100  ${s.id} ${s.name} (${s.url}) -> ${s.outFile}`);
  }

  // Write manifest
  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), total: targets.length, ok: results.filter((r) => r.ok).length, results }, null, 2),
    "utf8"
  );
  console.error(`\nDone. Manifest: ${path.join(outDir, "manifest.json")}`);
  console.error(`CSV: ${csvPath}`);
}

main().catch((e) => { console.error(e); process.exit(1); });