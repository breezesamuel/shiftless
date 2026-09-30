#!/usr/bin/env node
/**
 * quarterly.js — 季度复审引擎：订阅制（¥2999/季）的履约核心
 *
 * 用法:
 *   node quarterly.js --init https://www.example.com          建立基线快照（首次审计）
 *   node quarterly.js --verify                                复审最近一次基线并出对比报告
 *   node quarterly.js --verify --baseline=<snapshot.json>     复审指定基线
 *   node quarterly.js --history                               查看该站历史趋势
 *
 * 做什么:
 *   1. 首次 --init：按首页发现关键页面，产出可复现的基线快照（逐页 11 项得分）
 *   2. --verify：用**基线里同样的 URL 列表**重扫（保证 apples-to-apples），
 *      计算每项「已修复 / 已回归 / 未变化 / 新增失败」，并把本次结果写成新快照
 *   3. 出季度复审报告：分数变化 + 修复确认率 + 仍未修的清单 + 续费判断
 *
 * 不做什么（诚实边界）:
 *   - 分数没动就如实说没动，不用话术把停滞包装成「持续优化中」
 *   - 不声称排名/收录结果，只比较同一工具同一口径下的可读性变化
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { scoreOf, diffChecks, tallyItems, verdictFor } = require("../global-site/src/lib/geo-audit.js");

const args = process.argv.slice(2);
const flag = (name) => args.some((a) => a === `--${name}` || a.startsWith(`--${name}=`));
const value = (name, dflt = null) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.split("=").slice(1).join("=");
  const idx = args.indexOf(`--${name}`);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith("--")) return args[idx + 1];
  return dflt;
};

const target = args.find((a) => /^https?:\/\//.test(a));
const SUB_ROOT = path.join(__dirname, "subscriptions");
const OUT_BASE = value("out");
const MAX_PAGES = 8;

const UA =
  "Mozilla/5.0 (compatible; ShiftlessAudit/1.0; +readiness recheck; contact privacy@shiftless.app)";

function quarterOf(d = new Date()) {
  return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`;
}

function slugOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "").replace(/\./g, "-");
  } catch (e) {
    return "unknown-host";
  }
}

async function get(url, timeoutMs = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA }, signal: ctl.signal, redirect: "follow" });
    return { status: r.status, body: await r.text() };
  } catch (e) {
    return { status: 0, body: "", err: e.message };
  } finally {
    clearTimeout(t);
  }
}

function discoverPages(homeBody) {
  const hrefs = new Set();
  const re = /href=["'](\/[A-Za-z0-9_\-.\/]*(?:price|pricing|product|products|service|services|blog|article|about|contact)??)/gi;
  let m;
  while ((m = re.exec(homeBody)) !== null) hrefs.add(m[1]);
  for (const c of ["/", "/price", "/pricing", "/products", "/product", "/services", "/service", "/blog", "/about", "/contact"]) hrefs.add(c);
  return [...hrefs].filter((p) => !/\.(png|jpe?g|gif|svg|ico|css|js|woff2?|ttf|map|xml|php)$/i.test(p)).slice(0, MAX_PAGES);
}

function auditOne(url) {
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, "audit.js"), url, "--json"], {
      encoding: "utf8", timeout: 45000,
    });
    const parsed = JSON.parse(out);
    const checks = parsed.checks || [];
    return { url, ok: true, score: scoreOf(checks), checks };
  } catch (e) {
    return { url, ok: false, score: 0, checks: [], error: e.message };
  }
}

async function scanPages(urls, label) {
  const out = [];
  for (const u of urls) {
    process.stderr.write(`  [${label}] ${u}\n`);
    out.push(auditOne(u));
  }
  return out;
}

function overall(pages) {
  const s = pages
    .filter((p) => p.ok !== false)
    .map((p) => (p.checks && p.checks.length ? scoreOf(p.checks) : p.score || 0));
  return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : 0;
}

function dirFor(url) {
  return OUT_BASE ? path.join(OUT_BASE, slugOf(url)) : path.join(SUB_ROOT, slugOf(url));
}

function snapshotPath(url, q) {
  return path.join(dirFor(url), "snapshots", `${q}.json`);
}

function latestSnapshot(url) {
  const dir = path.join(dirFor(url), "snapshots");
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  if (!files.length) return null;
  return path.join(dir, files[files.length - 1]);
}

function writeSnapshot(url, quarter, pages) {
  const p = snapshotPath(url, quarter);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const snap = { url, quarter, createdAt: new Date().toISOString(), overall: overall(pages), pages };
  fs.writeFileSync(p, JSON.stringify(snap, null, 2), "utf8");
  return snap;
}

const PASS = (c) => c.score >= c.weight;

/** Per-page diff using the shared engine's diffChecks. */
function diffPages(before, after) {
  return before.map((b) => {
    const a = after.find((x) => x.url === b.url);
    if (!a) return { url: b.url, missing: true, before: b.score, after: null, delta: null, items: [] };
    const items = diffChecks(b.checks || [], a.checks || []);
    const bScore = b.checks && b.checks.length ? scoreOf(b.checks) : b.score;
    const aScore = a.checks && a.checks.length ? scoreOf(a.checks) : a.score;
    return { url: b.url, before: bScore, after: aScore, delta: aScore - bScore, items };
  });
}

/** Tally wraps engine.tallyItems and adds the missing-page counter. */
function tally(diff) {
  const t = tallyItems([]);
  t.missing = 0;
  for (const p of diff) {
    if (p.missing) { t.missing++; continue; }
    const pageTally = tallyItems(p.items);
    for (const k of Object.keys(pageTally)) t[k] = (t[k] || 0) + pageTally[k];
  }
  return t;
}

function verdict(totalDelta, t) {
  return verdictFor(totalDelta, t);
}

function renderReview({ url, quarter, prevQuarter, diff, t, before, after, breakCount, stillOpen, verdictObj, verbose }) {
  const host = new URL(url).origin;
  const L = [];
  L.push(`# AI 可见度 · 季度复审报告`);
  L.push(`**站点:** ${host}`);
  L.push(`**复审周期:** ${prevQuarter} → ${quarter}`);
  L.push(`**复审时间:** ${new Date().toISOString().slice(0, 10)}`);
  L.push(`**对比页面:** ${diff.length} 页（与上季**完全相同的 URL 列表**，同工具同口径）`);
  L.push(``);
  L.push(`## 1. 总分变化`);
  L.push(`| 项目 | 上季 | 本季 | 变化 |`);
  L.push(`|---|---|---|---|`);
  L.push(`| 站点聚合可读性 | ${before} | ${after} | **${after - before >= 0 ? "+" : ""}${after - before}** |`);
  L.push(``);
  L.push(`## 2. 逐项状态统计`);
  L.push(`| 状态 | 含义 | 数量 |`);
  L.push(`|---|---|---|`);
  L.push(`| ✅ 已修复 | 上季未通过，本季通过 | ${t.resolved} |`);
  L.push(`| ⬆️ 部分改善 | 得分上升但仍未通过 | ${t.improved} |`);
  L.push(`| ❌ 回归 | 上季通过，本季掉回不通过 | ${t.regressed} |`);
  L.push(`| ⬇️ 退步 | 得分下降 | ${t.declined} |`);
  L.push(`| ➖ 未变化 | 分数一模一样 | ${t.unchanged} |`);
  L.push(`| 🆕 新增失败项 | 上季没有这项检查 | ${t.new} |`);
  L.push(`| ❓ 页面消失 | URL 本轮取不到 | ${t.missing} |`);
  L.push(``);
  L.push(`## 3. 逐页逐项明细`);
  if (!verbose) L.push(`> 默认只列出**有变化的项**（未变化项已折叠，加 \`--verbose\` 可展开全部）。`);
  L.push(``);
  for (const p of diff) {
    L.push(`### ${p.url.replace(host, "") || "/"}`);
    if (p.missing) { L.push(`⚠️ 本轮未能抓取该页（HTTP/网络问题），无法比较。`); L.push(``); continue; }
    const changed = verbose ? p.items : p.items.filter((i) => i.state !== "unchanged");
    L.push(`得分 ${p.before} → ${p.after}（${p.delta >= 0 ? "+" : ""}${p.delta}） · 变化 ${changed.length} 项，未变 ${p.items.length - changed.length} 项`);
    L.push(``);
    if (!changed.length) { L.push(`本季该页无任何变化。`); L.push(``); continue; }
    L.push(`| 检查项 | 权重 | 上季 | 本季 | 变化 | 状态 |`);
    L.push(`|---|---|---|---|---|---|`);
    const order = { regressed: 0, declined: 1, new: 2, untested: 3, unchanged: 4, improved: 5, resolved: 6 };
    const icon = { resolved: "✅ 已修复", improved: "⬆️ 部分改善", regressed: "❌ 回归", declined: "⬇️ 退步", unchanged: "➖ 未变化", new: "🆕 新增", untested: "❓ 未测" };
    for (const i of [...changed].sort((a, b) => order[a.state] - order[b.state])) {
      const d = i.delta === null ? "—" : `${i.delta >= 0 ? "+" : ""}${i.delta}`;
      L.push(`| ${i.label} | ${i.weight} | ${i.before ?? "—"} | ${i.after ?? "—"} | ${d} | ${icon[i.state]} |`);
    }
    L.push(``);
  }
  if (stillOpen.length) {
    L.push(`## 4. 仍未修复的高权重项（下一季的活）`);
    for (const s of stillOpen) {
      L.push(`- **${s.label}**（权重 ${s.weight}，当前 ${s.after}/${s.weight}） · ${s.url.replace(host, "") || "/"}`);
    }
    L.push(``);
  }
  L.push(`## ${stillOpen.length ? 5 : 4}. 续费判断`);
  L.push(`**结论：${verdictObj.grade}**`);
  L.push(``);
  L.push(verdictObj.line);
  L.push(``);
  L.push(`## 诚实边界`);
  L.push(`本报告只比较**同一工具、同一口径、同一 URL 列表**下可读性分数的变化。它不预测、也不`);
  L.push(`声称任何 AI 答案里的排名或收录。分数是输入侧的输入条件，不是结果承诺。`);
  L.push(``);
  L.push(`> 由 Shiftless 审计工具生成 · 基线快照与本轮快照均已存档，可随时复算`);
  return L.join("\n");
}

async function doInit() {
  if (!target) {
    console.error("usage: node quarterly.js --init https://www.example.com");
    process.exit(2);
  }
  const origin = new URL(target).origin;
  console.error(`Baseline init for ${origin} ...`);
  const home = await get(origin + "/");
  const pages = discoverPages(home.body);
  const seen = new Set();
  const urls = [];
  for (const p of pages) {
    if (seen.has(p)) continue;
    seen.add(p);
    urls.push(origin + p);
    if (urls.length >= MAX_PAGES) break;
  }
  const results = await scanPages(urls, "init");
  const q = quarterOf();
  const snap = writeSnapshot(origin, q, results);
  console.log(`基线快照: ${snapshotPath(origin, q)}`);
  console.log(`聚合得分: ${snap.overall}/100（${results.filter((r) => r.ok).length}/${results.length} 页可测）`);
}

async function doVerify() {
  const explicit = value("baseline");
  const basePath = explicit || (target ? latestSnapshot(target) : null);
  if (!basePath || !fs.existsSync(basePath)) {
    console.error("找不到基线快照。先跑: node quarterly.js --init <url>");
    process.exit(2);
  }
  const base = JSON.parse(fs.readFileSync(basePath, "utf8"));
  const urls = base.pages.map((p) => p.url);
  console.error(`Recheck ${base.url} (baseline ${base.quarter}) ...`);
  const results = await scanPages(urls, "verify");
  const diff = diffPages(base.pages, results);
  const t = tally(diff);
  const before = overall(base.pages);
  const after = overall(results);
  const totalDelta = after - before;
  const v = verdict(totalDelta, t);

  const stillOpen = [];
  for (const p of diff) {
    if (p.missing) continue;
    for (const i of p.items) {
      if (i.after !== null && i.after < i.weight && i.weight >= 10) stillOpen.push({ label: i.label, weight: i.weight, after: i.after, url: p.url });
    }
  }
  stillOpen.sort((a, b) => b.weight - a.weight);

  const q = quarterOf();
  const quarter = q === base.quarter ? `${base.quarter}-r${(base.revision || 1) + 1}` : q;
  const md = renderReview({ url: base.url, quarter, prevQuarter: base.quarter, diff, t, before, after, breakCount: stillOpen.length, stillOpen, verdictObj: v, verbose: flag("verbose") });

  const reportDir = path.join(dirFor(base.url), "reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportFile = path.join(reportDir, `${quarter}-review.md`);
  fs.writeFileSync(reportFile, md, "utf8");

  const snap = writeSnapshot(base.url, quarter, results);
  fs.writeFileSync(path.join(dirFor(base.url), "reports", `${quarter}-review.json`), JSON.stringify({ quarter, prevQuarter: base.quarter, before, after, totalDelta, tally: t, verdict: v.grade, stillOpen }, null, 2), "utf8");

  console.log(`\n复审报告: ${reportFile}`);
  console.log(`新快照: ${snapshotPath(base.url, quarter)}`);
  console.log(`聚合得分: ${before} → ${after}（${totalDelta >= 0 ? "+" : ""}${totalDelta}）`);
  console.log(`状态统计: 已修复 ${t.resolved} · 改善 ${t.improved} · 回归 ${t.regressed} · 退步 ${t.declined} · 未变 ${t.unchanged}`);
  console.log(`续费判断: ${v.grade}`);
  if (flag("json")) console.log(JSON.stringify({ before, after, totalDelta, tally: t, verdict: v.grade }, null, 2));
}

function doHistory() {
  if (!target) { console.error("usage: node quarterly.js --history https://www.example.com"); process.exit(2); }
  const dir = path.join(dirFor(target), "snapshots");
  if (!fs.existsSync(dir)) { console.log("无历史快照。"); return; }
  const rows = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
  console.log(`| 周期 | 聚合可读性 | 页数 | 快照 |`);
  console.log(`|---|---|---|---|`);
  for (const r of rows) console.log(`| ${r.quarter} | ${r.overall}/100 | ${r.pages.filter((p) => p.ok).length}/${r.pages.length} | ${path.join(dir, r.quarter + ".json")} |`);
}

(async () => {
  if (flag("history")) return doHistory();
  if (flag("init")) return doInit();
  if (flag("verify") || args.length === 0) return doVerify();
  console.error("usage: node quarterly.js --init <url> | --verify [--baseline=<file>] | --history <url>");
  process.exit(2);
})();
