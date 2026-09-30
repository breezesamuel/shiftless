/**
 * AI-readability audit engine — single source of truth.
 *
 * Lives here (inside the Next.js app) rather than in ../../geo/audit.js because
 * the Vercel Cron function has to import it; a serverless bundle cannot reach
 * outside its own project. geo/audit.js is now a thin CLI that requires THIS
 * file, so there is exactly one copy of the scoring logic.
 *
 * Design constraint that shapes everything here: NO API KEYS.
 *
 * The obvious version of this product queries DeepSeek / Doubao / Kimi /
 * ChatGPT and reports "you are not mentioned". That requires a key for each
 * engine, costs money per query, and is non-deterministic besides — you would
 * be selling a number that changes when you re-run it.
 *
 * This audits instead the part that is deterministic, free, and actually
 * causal: whether the site is legible to a crawler at all. That is the input
 * side of AI visibility, and it is the part a business can actually act on.
 *
 * The honest framing for sales: this measures whether you are *readable*, not
 * whether you are *cited*. Anyone promising a guaranteed ChatGPT ranking is
 * selling a number they cannot control, because model output is sampled. Being
 * the person who says "here is what is actually true" is the differentiator.
 *
 * Concurrency note: the check list is per-call state carried in `ctx`, not a
 * module-level array. A serverless instance handles overlapping requests, and a
 * shared array would cross-contaminate two audits into one report.
 */

const UA =
  "Mozilla/5.0 (compatible; ShiftlessAudit/1.0; +readiness audit; contact privacy@shiftless.app)";

/** Crawlers that actually feed LLM answers. Grouped by who runs them. */
const AI_CRAWLERS = [
  { ua: "GPTBot", owner: "OpenAI (training + retrieval)" },
  { ua: "OAI-SearchBot", owner: "OpenAI (ChatGPT search)" },
  { ua: "ChatGPT-User", owner: "OpenAI (user-triggered fetch)" },
  { ua: "ClaudeBot", owner: "Anthropic" },
  { ua: "Claude-User", owner: "Anthropic (user-triggered fetch)" },
  { ua: "Claude-SearchBot", owner: "Anthropic (search)" },
  { ua: "PerplexityBot", owner: "Perplexity" },
  { ua: "Google-Extended", owner: "Google (Gemini grounding)" },
  { ua: "Applebot-Extended", owner: "Apple Intelligence" },
  { ua: "Bytespider", owner: "ByteDance (Doubao)" },
  { ua: "CCBot", owner: "Common Crawl — upstream of most of the above" },
  { ua: "Baiduspider", owner: "Baidu (文心一言)" },
  { ua: "Bytespider-Google", owner: "ByteDance on Google infra" },
];

async function get(url, timeoutMs = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA }, signal: ctl.signal, redirect: "follow" });
    return { status: r.status, headers: r.headers, body: await r.text() };
  } catch (e) {
    return { status: 0, headers: new Headers(), body: "", error: e.name };
  } finally {
    clearTimeout(t);
  }
}

function makeCtx() {
  const checks = [];
  return { checks, add: (id, label, weight, score, detail) => checks.push({ id, label, weight, score, detail }) };
}

// ---------------------------------------------------------------- robots.txt
function auditRobots(ctx, txt) {
  const { add } = ctx;
  if (!txt) {
    add("robots", "robots.txt reachable", 15, 0, "Could not fetch robots.txt. If it 404s, some crawlers treat every path as disallowed.");
    return [];
  }
  const lines = txt.split(/\r?\n/).map((l) => l.replace(/#.*$/, "").trim());
  const uaOf = (i) => {
    const out = [];
    for (let j = i - 1; j >= 0; j--) {
      if (lines[j].startsWith("user-agent:")) out.push(lines[j].slice(11).trim().toLowerCase());
      else if (lines[j].startsWith("allow:") || lines[j].startsWith("disallow:")) break;
    }
    return out;
  };
  const rules = lines
    .map((l, i) => ({ l: l.toLowerCase(), agents: uaOf(i) }))
    .filter((r) => r.l.startsWith("allow:") || r.l.startsWith("disallow:"));

  const verdict = AI_CRAWLERS.map((c) => {
    const key = c.ua.toLowerCase();
    const mine = rules.filter((r) => r.agents.includes(key) || r.agents.includes("*"));
    if (!mine.length) return { ...c, state: "default" };
    // Disallow of everything is an explicit block; a specific disallow is a path block.
    const blocked = mine.some((r) => r.l === "disallow: /");
    if (blocked) return { ...c, state: "blocked" };
    if (mine.some((r) => r.l.startsWith("allow: /"))) return { ...c, state: "allowed" };
    return { ...c, state: "partial" };
  });

  const blocked = verdict.filter((v) => v.state === "blocked");
  const allowed = verdict.filter((v) => v.state === "allowed");
  const score = blocked.length === 0 ? 15 : Math.max(0, 15 - blocked.length * 2);
  add(
    "robots",
    "AI crawler access",
    15,
    score,
    blocked.length
      ? `Explicitly blocked for: ${blocked.map((b) => b.ua).join(", ")}`
      : allowed.length
      ? `Explicitly allowed for ${allowed.length}/${AI_CRAWLERS.length} AI crawlers (${allowed
          .slice(0, 4)
          .map((a) => a.ua)
          .join(", ")}${allowed.length > 4 ? "…" : ""}). Rest fall through to default.`
      : `No AI-crawler rules found. All ${AI_CRAWLERS.length} fall through to the wildcard/default rule — check what '*' resolves to.`
  );
  return verdict;
}

// ------------------------------------------------------------- structured data
function auditJsonLd(ctx, html) {
  const { add } = ctx;
  const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  let types = [];
  let broken = 0;
  for (const b of blocks) {
    try {
      const parsed = JSON.parse(b[1].trim());
      const nodes = Array.isArray(parsed) ? parsed : parsed["@graph"] || [parsed];
      for (const n of nodes) {
        const t = n["@type"];
        if (Array.isArray(t)) types.push(...t);
        else if (t) types.push(t);
      }
    } catch {
      broken++;
    }
  }
  const set = [...new Set(types.map(String))];
  const hasFaq = set.some((t) => /FAQPage|QAPage/i.test(t));
  const hasOrg = set.some((t) => /Organization|Corporation|LocalBusiness/i.test(t));
  const hasProduct = set.some((t) => /Product|Service|SoftwareApplication/i.test(t));
  const hasArticle = set.some((t) => /Article|BlogPosting|NewsArticle/i.test(t));

  const score = Math.min(15, set.length * 3) - (broken ? 5 : 0);
  add(
    "jsonld",
    "Structured data (JSON-LD)",
    15,
    Math.max(0, score),
    !blocks.length
      ? "No JSON-LD found. Entity extraction for AI answers is manual and error-prone without it."
      : broken
      ? `${blocks.length} block(s) present but ${broken} failed to parse as JSON — malformed schema is worse than none.`
      : `${set.length} type(s): ${set.slice(0, 8).join(", ")}${set.length > 8 ? "…" : ""}`
  );
  add(
    "schema-identity",
    "Identity + FAQ schema",
    10,
    (hasOrg ? 5 : 0) + (hasFaq ? 5 : 0),
    `${hasOrg ? "✓" : "✗"} Organization/Corporation (who you are) · ${hasFaq ? "✓" : "✗"} FAQPage (question/answer pairs — the format models quote most)`
  );
  add(
    "schema-content",
    "Product/service + article schema",
    5,
    (hasProduct ? 3 : 0) + (hasArticle ? 2 : 0),
    `${hasProduct ? "✓" : "✗"} Product/Service · ${hasArticle ? "✓" : "✗"} Article/BlogPosting`
  );
  return set;
}

// ------------------------------------------------------------------ llms.txt
function auditLlms(ctx, status, body, headers) {
  const { add } = ctx;
  // Guard against the SPA-catch-all false positive: plenty of sites return
  // HTTP 200 + their homepage for any unknown path, and a 2KB window of that
  // HTML is very likely to contain the word "model". Require an actual
  // markdown doc served as plain text.
  const ctype = (headers.get("content-type") || "").toLowerCase();
  const head = body.slice(0, 800);
  const isMarkdown = /^\s*#\s+\S/m.test(head) && !/^\s*<(!doctype|html)/i.test(head);
  const isText = ctype.includes("text/plain") || isMarkdown;
  const ok = status === 200 && isText && /llms|model|guideline|documentation/i.test(head);
  add(
    "llms",
    "llms.txt",
    5,
    ok ? 5 : 0,
    ok
      ? "Present and served as text."
      : status === 200 && !isText
      ? `Path returns 200 but as ${ctype.split(";")[0] || "an unlabelled response"} — almost certainly a catch-all, not a real llms.txt.`
      : "Not present. Emerging convention; low cost, no downside, currently enforced by nobody."
  );
}

// ------------------------------------------------------------- answerability
function auditAnswerability(ctx, html) {
  const { add } = ctx;
  const text = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
  const words = text.split(" ").length;

  const h1 = (html.match(/<h1\b/gi) || []).length;
  const h2 = (html.match(/<h2\b/gi) || []).length;
  const h3 = (html.match(/<h3\b/gi) || []).length;
  add(
    "headings",
    "Heading structure",
    10,
    h1 === 1 ? 6 : h1 === 0 ? 0 : 3,
    `${h1} × h1${h1 !== 1 ? " (exactly one is the convention; 0 leaves the page untitled, >1 splits the subject)" : ""}, ${h2} × h2, ${h3} × h3`
  );

  // Question-form headings are the highest-signal thing you can do for AI
  // answers, because they are literally the shape of the queries being asked.
  const questions = [...html.matchAll(/<h[234][^>]*>([\s\S]{0,200}?)<\//gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
    .filter((t) => /^(how|what|why|when|which|who|where|can|does|is|are|should|how much)/i.test(t));
  add(
    "questions",
    "Question-form headings",
    10,
    Math.min(10, questions.length * 2),
    questions.length
      ? `${questions.length} found — e.g. "${questions[0].slice(0, 70)}"${
          questions.length > 1 ? `, "${questions[1].slice(0, 70)}"` : ""
        }`
      : "None. These match the shape of the questions people ask an assistant, and they are the cheapest thing on this list to fix."
  );

  // E-E-A-T: named humans, dates, and citations are what make a claim quotable.
  const authorish = /(author|byline|written by|reviewed by|about the author)/i.test(html);
  const dated = /(<time|datePublished|dateModified|发布|更新日期|\b20\d{2}-\d{2}-\d{2}\b)/i.test(html);
  add(
    "eeat",
    "Authorship and dates",
    8,
    (authorish ? 4 : 0) + (dated ? 4 : 0),
    `${authorish ? "✓" : "✗"} named author/reviewer · ${dated ? "✓" : "✗"} publish or update date. Unattributed, undated claims get skipped in favour of a source that signs its work.`
  );

  add(
    "depth",
    "Content depth on this page",
    5,
    words < 250 ? 1 : words < 800 ? 3 : 5,
    `~${words} words${words < 250 ? " — too thin to be cited for anything specific" : ""}`
  );
  return { words, questions };
}

// -------------------------------------------------------------- citation cues
function auditCitations(ctx, html, origin) {
  const { add } = ctx;
  const ext = [...html.matchAll(/href=["'](https?:\/\/(?!www\.)?[^"'/]+)/gi)].map((m) => {
    try { return new URL(m[1]).hostname; } catch { return null; }
  }).filter(Boolean);
  const uniq = [...new Set(ext)].filter((h) => !h.includes(origin.replace(/^www\./, "")));
  add(
    "citations",
    "Outbound citations",
    7,
    Math.min(7, uniq.length),
    uniq.length
      ? `${uniq.length} external domain(s) referenced: ${uniq.slice(0, 5).join(", ")}${uniq.length > 5 ? "…" : ""}. Pages that cite primary sources are more likely to be trusted as references.`
      : "No outbound citations. A page that cites nothing gives a model no reason to prefer it over a competitor that does."
  );
}

// ------------------------------------------------------------------- social
function auditSocial(ctx, html, headers) {
  const { add } = ctx;
  const og = ["og:title", "og:description", "og:image", "og:url", "og:type"].filter((p) =>
    new RegExp(`property=["']${p}["']`, "i").test(html)
  );
  add(
    "social",
    "Open Graph",
    5,
    Math.round((og.length / 5) * 5),
    og.length === 5 ? "Complete." : `${og.length}/5 present (missing: ${["og:title", "og:description", "og:image", "og:url", "og:type"].filter((p) => !og.includes(p)).join(", ")})`
  );
}

/**
 * Audit one page. Returns the same result object the CLI has always emitted, so
 * existing baselines and quarterly snapshots stay comparable.
 */
async function auditPage(url, opts = {}) {
  const pageTimeout = opts.timeoutMs || 15000;
  const auxTimeout = opts.auxTimeoutMs || 10000;
  const u = new URL(url);
  const page = await get(u.href, pageTimeout);
  if (page.status === 0) {
    const err = new Error(`could not fetch ${u.href} (${page.error})`);
    err.code = "FETCH_FAILED";
    throw err;
  }
  const origin = u.hostname;
  const robots = await get(new URL("/robots.txt", u).href, auxTimeout);
  const llms = await get(new URL("/llms.txt", u).href, auxTimeout);

  const ctx = makeCtx();
  const verdict = auditRobots(ctx, robots.body) || [];
  auditJsonLd(ctx, page.body);
  auditLlms(ctx, llms.status, llms.body, llms.headers);
  auditAnswerability(ctx, page.body);
  auditCitations(ctx, page.body, origin);
  auditSocial(ctx, page.body, page.headers);

  const checks = ctx.checks;
  // c.score is POINTS (0..c.weight), not a 0..1 ratio. Summing weight*score here
  // was the reason the first run reported 362/100.
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + Math.min(c.weight, c.score), 0);
  const score = total === 0 ? 0 : earned / total;
  const pct = Math.round(score * 100);

  const band =
    pct >= 80 ? { label: "AI-legible", note: "A model can read this site and describe it accurately." } :
    pct >= 55 ? { label: "Partially legible", note: "Readable, but the entity and the answers are hard to extract." } :
    pct >= 30 ? { label: "Mostly opaque", note: "Crawlers can reach it, but almost nothing is structured enough to reuse." } :
    { label: "Invisible to AI answers", note: "Either blocked, or there is nothing on the page a model can extract as fact." };

  return {
    url: u.href,
    fetchedAt: new Date().toISOString(),
    httpStatus: page.status,
    score: pct,
    band: band.label,
    bandNote: band.note,
    checks,
    aiCrawlerAccess: verdict.map((v) => ({ ua: v.ua, owner: v.owner, state: v.state })),
  };
}

function renderMarkdown(result) {
  const origin = new URL(result.url).hostname;
  const L = [];
  L.push(`# AI-readiness audit — ${origin}`);
  L.push(`\n_audited ${result.fetchedAt.slice(0, 10)} · HTTP ${result.httpStatus} · no API keys used_\n`);
  L.push(`## ${result.score}/100 — ${result.band}\n`);
  L.push(`${result.bandNote}\n`);
  L.push(`| | |`);
  L.push(`|---|---|`);
  L.push(`| Score | **${result.score}/100** |`);
  L.push(`| Band | ${result.band} |`);
  L.push(`| HTTP | ${result.httpStatus} |`);
  L.push(`| Findings | ${result.checks.filter((c) => c.score < c.weight).length} of ${result.checks.length} actions open |`);
  L.push("");
  L.push("## Findings\n");
  for (const c of result.checks) {
    const gap = c.weight - c.score;
    const mark = gap === 0 ? "OK  " : gap <= c.weight / 2 ? "PART" : "GAP ";
    L.push(`**[${mark}] ${c.label}** — ${c.score}/${c.weight}\n`);
    L.push(`${c.detail}\n`);
  }
  L.push("## AI crawler access\n");
  L.push("| Crawler | Operator | State |");
  L.push("|---|---|---|");
  for (const v of result.aiCrawlerAccess) L.push(`| ${v.ua} | ${v.owner} | ${v.state} |`);
  L.push("");
  L.push("## What this does and does not measure\n");
  L.push("**Does:** whether your site is *legible* — reachable, structured, and specific enough for a model to extract facts from.");
  L.push("");
  L.push("**Does not:** whether you are *cited* in an answer. That depends on the model, the prompt, and competitors, and it is not something any audit can promise. Anyone selling you a guaranteed ChatGPT ranking is selling something they do not control.");
  L.push("");
  return L.join("\n");
}

/**
 * Quarter-over-quarter comparison.
 *
 * Lives here so the local multi-page runner and the serverless cron cannot
 * drift apart: both call these, so a regression reads the same in either report.
 */

const PASS = (c) => c.score >= c.weight;

/** Normalised 0-100 score straight from raw check points. */
function scoreOf(checks) {
  const raw = checks.reduce((s, c) => s + (c.score || 0), 0);
  const w = checks.reduce((s, c) => s + c.weight, 0);
  return w ? Math.round((raw / w) * 100) : 0;
}

/**
 * Diff one page's checks against its baseline.
 *
 * `untested` and `new` are deliberately distinct: a check that used to exist but
 * was not evaluated this run is a coverage gap, whereas a check with no
 * baseline counterpart is a newly added check. Collapsing them would let a
 * growing checklist masquerade as an improving site.
 */
function diffChecks(beforeChecks, afterChecks) {
  const byId = new Map(afterChecks.map((c) => [c.id, c]));
  const items = beforeChecks.map((c) => {
    const n = byId.get(c.id);
    if (!n) return { id: c.id, label: c.label, weight: c.weight, before: c.score, after: null, delta: null, state: "untested" };
    const delta = (n.score || 0) - (c.score || 0);
    let state = "unchanged";
    if (PASS(c) && !PASS(n)) state = "regressed";
    else if (!PASS(c) && PASS(n)) state = "resolved";
    else if (delta > 0) state = "improved";
    else if (delta < 0) state = "declined";
    return { id: c.id, label: c.label, weight: c.weight, before: c.score, after: n.score, delta, state, detail: n.detail };
  });
  for (const c of afterChecks) {
    if (!beforeChecks.some((x) => x.id === c.id)) {
      items.push({ id: c.id, label: c.label, weight: c.weight, before: null, after: c.score, delta: null, state: "new" });
    }
  }
  return items;
}

function tallyItems(items) {
  const t = { resolved: 0, improved: 0, regressed: 0, declined: 0, unchanged: 0, untested: 0, new: 0 };
  for (const i of items) t[i.state] = (t[i.state] || 0) + 1;
  return t;
}

/** Graded conclusion. The wording deliberately discourages paying for "monitoring". */
function verdictFor(totalDelta, t) {
  const touched = t.resolved + t.improved;
  if (totalDelta >= 8) {
    return {
      grade: "有效",
      line: `站点可读性 ${totalDelta >= 0 ? "+" : ""}${totalDelta} 分，确认修复 ${t.resolved} 项、另有 ${t.improved} 项改善。整改动作与分数之间存在可观测对应关系，续费有据。`,
    };
  }
  if (totalDelta > 0) {
    return {
      grade: "部分见效",
      line: `站点可读性 +${totalDelta} 分，修复 ${t.resolved} 项但仍有 ${t.unchanged} 项原地不动。方向对、覆盖面不够，下一季的价值在把未动项做完。`,
    };
  }
  if (touched > 0) {
    return {
      grade: "局部见效，总分未动",
      line: `单项有 ${touched} 处改善，但站点总分变化 ${totalDelta >= 0 ? "+" : ""}${totalDelta} 分——通常是「修的项权重低、掉的项权重高」。建议下一季只盯高分权重项。`,
    };
  }
  return {
    grade: "本季无变化",
    line: `站点总分 ${totalDelta >= 0 ? "+" : ""}${totalDelta} 分，无一项发生可观测变化。诚实结论是：上一季的整改没有落到线上（或线上已回滚）。此时最诚实的建议是先整改、后复审，不必为「持续监控」付费。`,
  };
}

module.exports = {
  auditPage,
  renderMarkdown,
  scoreOf,
  diffChecks,
  tallyItems,
  verdictFor,
  AI_CRAWLERS,
  UA,
};
