# GEO readiness audit

## Two tools

### `audit.js` — 单页快审（样板/线索筛选用）

```bash
node audit.js https://example.com
node audit.js https://example.com --json
```

### `full-report.js` — 正式报告生成（P1、¥1999/¥4999 交付物）

```bash
node full-report.js https://example.com        # 自动发现主站 4-8 个关键页面
node full-report.js https://example.com /o=sample  # 输出到指定目录
```

同一站、不同工具的数字是**同一套检查、同一套权重**，可互为佐证：
- `audit.js` 只测首页（35/100 = 首页）
- `full-report.js` 测首页+发现的关键子页面，报告里每页单独给分（55/100 = jsonld 页），
  聚合分是各页平均。
- 若客户质疑「上次 35，这次 55」，解释是：**一次只给首页，一次给了全站**，权重和检查
  列表完全一致，任何一页都能复跑验证。

这是与「排名保证」从业者的关键差异：**我们的数字是可复现的，他们的不是。**

## Why it is built this way

The obvious version of this product queries DeepSeek / 豆包 / Kimi / ChatGPT and reports
"you are not mentioned in the answer." That needs a paid key per engine, costs money per
query, and is **non-deterministic** — re-running it can produce a different answer, which
means you would be selling a number you cannot reproduce.

This audits the deterministic, free, and actually causal half: whether the site is
*legible* to a crawler in the first place. That is the input side of AI visibility, and
it is the part a business can act on this week.

## The honest framing — use this in sales

**Does:** whether your site is readable. Reachable by AI crawlers, structured enough to
extract an entity from, with question-form headings, authorship, dates and citations.

**Does not:** whether you are *cited* in an answer. That depends on the model, the prompt,
and your competitors. **Nobody can guarantee it.**

This matters commercially. On 2026-09-30, 思亿欧/外贸快车 was verified selling a
product called 「AI提示词排名保证」 with published guarantees like
`ChatGPT 排名 ≥100/200/200/200 · Google AI Overview 排名 · Gemini 排名`
(`https://www.trade-express.cn/products.html`).

They are selling a guarantee over model sampling behaviour. Being the vendor that says
"here is what is actually true, and here is what you can fix" is a real differentiator in a
market that is otherwise selling rankings nobody controls.

## Checks

| id | Weight | What it measures |
|---|---|---|
| `robots` | 15 | 13 AI crawlers: GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended, Bytespider, CCBot, Baiduspider… |
| `jsonld` | 15 | JSON-LD blocks parse; count of distinct `@type` |
| `schema-identity` | 10 | Organization/Corporation + FAQPage |
| `schema-content` | 5 | Product/Service + Article/BlogPosting |
| `llms` | 5 | `llms.txt` present *and actually text* |
| `headings` | 10 | Exactly one h1, sane h2/h3 depth |
| `questions` | 10 | Question-form h2/h3 — the shape of what users ask an assistant |
| `eeat` | 8 | Named author/reviewer + publish or update date |
| `depth` | 5 | Word count |
| `citations` | 7 | Outbound citations to primary sources |
| `social` | 5 | Open Graph completeness |

## Measured baselines, 2026-09-30

| Site | Score | Band |
|---|---|---|
| trade-express.cn | 31/100 | Mostly opaque |
| jackyun.com | 35/100 | Mostly opaque |
| sellersprite.com/cn | 52/100 | Mostly opaque |

All three are the actual prospect list. No JSON-LD, no FAQPage schema, no question-form
headings, no authorship. The audit finds are real, not theoretical.

## Two bugs worth remembering

1. **The first run reported `362/100`.** `c.score` is points (0..weight), not a 0..1
   ratio, and the aggregate multiplied by weight anyway. Now `sum(points)/sum(weight)`.
2. **`llms.txt` false-positived on jackyun.** Their SPA returns HTTP 200 + the homepage
   for *any* path, and a 2KB window of that HTML contains the word "model". Now requires a
   markdown document served as text.

The second one generalises: **any audit of a site built as an SPA needs a catch-all guard**,
or every unknown path reports as a pass.
