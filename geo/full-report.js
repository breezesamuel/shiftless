#!/usr/bin/env node
/**
 * full-report.js — P1 履约引擎：一站生成「AI 可见度审计」正式报告
 *
 * 用法:
 *   node full-report.js https://www.jackyun.com
 *   node full-report.js https://www.sellersprite.com/cn --<outputdir>
 *
 * 做什么:
 *   1. 发现站点关键页面（首页 + 探测到的价格/产品/博客入口）
 *   2. 对每个页面运行与 audit.js 相同的检查（复用其模块）
 *   3. 汇总成正式报告 markdown：逐页得分、逐项原因、可执行的整改清单
 *   4. 输出到 geo/sample/<host>.audit-report.md
 *
 * 不做什么（保持诚实边界）:
 *   - 不声称任何"排名"或"收录"结果——只测可读性（legibility）
 *   - 不抓取登录墙/支付墙后的页面
 */
const { URL } = require("url");
const fs = require("fs");
const path = require("path");

const UA =
  "Mozilla/5.0 (compatible; ShiftlessAudit/1.0; +readiness audit; contact privacy@shiftless.app)";

const AI_CRAWLERS = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User",
  "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Applebot-Extended",
  "Bytespider", "CCBot", "Baiduspider", "Bytespider-Google",
];

const args = process.argv.slice(2);
const target = args.find((a) => /^https?:\/\//.test(a));
if (!target) {
  console.error("usage: node full-report.js <url> [--fixes]");
  process.exit(2);
}

const outputDirArg = args.find((a) => a.startsWith("--") && !a.startsWith("--json") && !a.startsWith("--fixes"));
const outputBase = outputDirArg ? outputDirArg.replace(/^--/, "") : path.join(__dirname, "sample");
const includeFixes = args.includes("--fixes");

async function get(url, timeoutMs = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA }, signal: ctl.signal, redirect: "follow" });
    return { status: r.status, headers: r.headers, body: await r.text() };
  } catch (e) {
    return { status: 0, headers: null, body: "", err: e.message };
  } finally {
    clearTimeout(t);
  }
}

/** 从首页发现关键子页面入口（价格 / 产品 / 博客 / 关于 / 登录） */
function discoverPages(homeBody, origin) {
  const hrefs = new Set();
  const re = /href=["'](\/[A-Za-z0-9_\-.\/]*(?:price|pricing|product|products|service|services|blog|article|about|contact)??)/gi;
  let m;
  while ((m = re.exec(homeBody)) !== null) hrefs.add(m[1]);
  const candidates = ["/", "/price", "/pricing", "/products", "/product", "/services", "/service", "/blog", "/about", "/contact"];
  for (const c of candidates) hrefs.add(c);
  return [...hrefs].slice(0, 8);
}

async function auditPage(url) {
  const { status, body } = await get(url);
  if (status >= 400 || !body) {
    return { url, status, error: status >= 400 ? `HTTP ${status}` : "no body", checks: [] };
  }
  // 与样板完全同源：直接跑 audit.js 的 11 项检查，保证数字可比
  try {
    const { execFileSync } = require("child_process");
    const out = execFileSync(process.execPath, [path.join(__dirname, "audit.js"), url, "--json"], {
      encoding: "utf8", timeout: 45000,
    });
    const parsed = JSON.parse(out);
    return { url, status, body, checks: parsed.checks || [] };
  } catch (e) {
    return { url, status, error: `audit failed: ${e.message}`, checks: [] };
  }
}

async function main() {
  const u = new URL(target);
  const origin = u.origin;
  console.error(`Scanning ${origin} ...`);
  const home = await auditPage(origin + "/");
  const pages = discoverPages(home_body_text_from(home), origin)
    .filter((p) => !/\.(png|jpe?g|gif|svg|ico|css|js|woff2?|ttf|map|json|xml|txt|php)$/i.test(p));
  const seen = new Set(["/"]);
  const results = [home];
  for (const p of pages) {
    if (p === "/" || seen.has(p)) continue;
    seen.add(p);
    console.error(`  page: ${origin}${p}`);
    results.push(await auditPage(origin + p));
    if (results.length >= 8) break;
  }

  const totalsByPage = results.map((r) => {
    const raw = r.checks.reduce((s, c) => s + (c.score || 0), 0);
    const w = r.checks.reduce((s, c) => s + c.weight, 0);
    return { url: r.url, status: r.status, score: w ? Math.round((raw / w) * 100) : 0, raw, max: w };
  });
  const pct = totalsByPage.map((p) => p.score);
  const overall = pct.length ? Math.round(pct.reduce((a, b) => a + b, 0) / pct.length) : 0;

  const host = u.hostname.replace(/^www\./, "").replace(/\./g, "-");
  const outfile = path.join(outputBase, `${host}.audit-report.md`);
  fs.mkdirSync(outputBase, { recursive: true });

  const now = new Date().toISOString().slice(0, 10);
  const lines = [];
  lines.push(`# AI 可见度审计 · 正式报告`);
  lines.push(`**被测站点:** ${origin}`);
  lines.push(`**扫描时间:** ${now}`);
  lines.push(`**扫描页面:** ${results.length} 页（首页 + 发现的关键子页面）`);
  lines.push(``);
  lines.push(`## 总览`);
  lines.push(`| 页面 | 状态 | 得分 / 满分 |`);
  lines.push(`|---|---|---|`);
  for (const p of totalsByPage) lines.push(`| ${p.url.replace(origin, "") || "/"} | ${p.status} | ${p.score} / 100 |`);
  lines.push(`| **聚合** | | **${overall} / 100** |`);
  lines.push(``);
  lines.push("## 逐项明细（聚合所有页面最强/最弱表现）");
  lines.push(`| 检查项 | 权重 | 结果 |`);
  lines.push(`|---|---|---|`);
  const allChecks = {};
  for (const r of results) for (const c of r.checks) (allChecks[c.id] = allChecks[c.id] || []).push(c);
  const MAX_WEIGHTS = { robots: 15, jsonld: 15, "schema-identity": 10, "schema-content": 5, llms: 5, headings: 10, questions: 10, eeat: 8, depth: 5, citations: 7, social: 5 };
  for (const id of Object.keys(MAX_WEIGHTS).sort((a, b) => MAX_WEIGHTS[b] - MAX_WEIGHTS[a])) {
    const group = allChecks[id];
    if (!group || !group.length) { lines.push(`| ${id} | ${MAX_WEIGHTS[id]} | 未测到 |`); continue; }
    const w = MAX_WEIGHTS[id];
    const avg = Math.round(group.reduce((s, c) => s + (c.score || 0), 0) / group.length);
    const best = group.reduce((a, b) => (b.score > a.score ? b : a), { score: -1 });
    lines.push(`| ${best.label} | ${w} | ${best.detail}（页面平均 ${avg}/${w}） |`);
  }
  lines.push(``);
  lines.push("## 诚实边界");
  lines.push("本报告测量的是站点对 AI 引擎的**可读性（legibility）**，不是其在任何 AI 答案中的");
  lines.push("\"排名\"或\"收录\"。模型输出是采样的，无人能保证排名；提供\"排名保证\"的服务商");
  lines.push("卖的是它无法控制的结果。可读性是可复现、可执行的输入侧。");
  lines.push(``);
  lines.push(`> 由 Shiftless 审计工具生成 · 数值可复现（重新扫描应得相同结果）`);

  fs.writeFileSync(outfile, lines.join("\n"), "utf8");
  console.log(`\n报告: ${outfile}`);
  console.log(`聚合得分: ${overall}/100（${results.length} 页）`);

  if (includeFixes && home.checks?.length) {
    const { execFileSync } = require("child_process");
    const os = require("os");
    const tmpAudit = path.join(os.tmpdir(), `audit-${host}-${Date.now()}.json`);
    const tmpFix = path.join(os.tmpdir(), `fix-${host}-${Date.now()}.md`);
    fs.writeFileSync(tmpAudit, JSON.stringify({ url: target, checks: home.checks, score: totalsByPage[0].score }), "utf8");
    try {
      execFileSync(process.execPath, [path.join(__dirname, "fix-generator.js"), `--audit=${tmpAudit}`, `--output=${tmpFix}`], {
        encoding: "utf8", timeout: 30000, stdio: "ignore",
      });
      if (fs.existsSync(tmpFix)) {
        const fixMd = fs.readFileSync(tmpFix, "utf8");
        fs.appendFileSync(outfile, "\n\n---\n\n# 整改代码包（可直接复制粘贴）\n\n" + fixMd, "utf8");
        console.log(`整改包已追加到报告: ${outfile}`);
      }
    } catch (e) {
      console.error(`整改包生成失败: ${e.message}`);
    } finally {
      try { fs.unlinkSync(tmpAudit); } catch {}
      try { fs.unlinkSync(tmpFix); } catch {}
    }
  }
}

function home_body_text_from(home) {
  return (home && home.body) || "";
}

main();