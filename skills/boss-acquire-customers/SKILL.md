---
name: boss-acquire-customers
description: Help a business get customers. Combines competitor/market research (three-wave methodology), real webpage scraping into a searchable corpus, and retrieval-augmented generation (RAG) to produce a grounded acquisition plan: competitive landscape, market intelligence, differentiated positioning, channel strategy, outreach/pitch messages, and first content. Use when the user is a business owner or operator asking how to get customers, who to sell to, what competitors are doing, how to position or differentiate, which channels to use, what to say in outreach or ads, or how to turn scraped competitor/market data into a plan. Triggers: "怎么获客", "帮我做市场调研", "分析竞品", "如何定位", "获取客户", "获客方案", "市场分析", "竞品分析", "定位", "渠道", "cold email", "outreach", "competing", "customer acquisition", "market research", "positioning". Works standalone.
---

# Boss Acquire Customers — 帮老板获客

给老板一份**有真实数据支撑**的获客方案。三步走：

```
调研哪些渠道/竞品 → 抓真实网页做成语料 → 检索相关片段 → 写方案
```

核心原则：方案里每一句"市场/竞品判断"都要能追溯到语料里的**原文片段**（来源 URL）。禁止凭空编造竞品数据、价格、份额。数据不全的地方明确标注 DATA GAP。

## 工作流

### 阶段 1：理解用户处境

先回答用户的问题，再按需补问。至少确认三件事（已知就用上，别反复问）：
- **卖什么**：产品/服务一句话描述 + 面向谁（to B / to C）
- **当前渠道**：现在靠什么获客，效果如何
- **目标**：用户要的是调研、定位、文案、渠道选择，还是整套方案

产出 `PROGRESS.md`（记录阶段、来源、已完成项，便于续跑）。

### 阶段 2：确定抓取清单（调研目标）

根据用户目标决定抓什么。参考 `references/research-planning.md`。

典型目标：
- **竞品调研**：竞品官网、定价页、定价 FAQ、竞品博客/新闻页（3-8 个竞品）
- **渠道调研**：目标平台的落地页、行业榜单、Reddit/HN/知乎相关帖子（用户比价时去哪）
- **客户情报**：竞品评论区/评价页、行业问答（用户骂什么、求什么）

每个 URL 一行写进 `corpus/urls.txt`。

### 阶段 3：抓取成语料

```bash
python F:/24/skills/boss-acquire-customers/scripts/gather_corpus.py --urls_file corpus/urls.txt --out corpus/ --sleep 0.5
```

scrpling 引擎优先；被反爬或空页面时报告并标注，不硬闯。抓完检查 `corpus/*.md` 数量与质量。

### 阶段 4：建索引（BM25 RAG 检索层）

```bash
python F:/24/skills/boss-acquire-customers/scripts/build_index.py --corpus corpus/ --index corpus/bm25.json
```

### 阶段 5：检索增强生成

按用户目标提 3-8 个检索问题（参考 `references/rag-queries.md`），每条：

```bash
python F:/24/skills/boss-acquire-customers/scripts/retrieve.py --index corpus/bm25.json --corpus corpus/ --query "关键问题" --top 5 --context 400
```

把检索到的真实片段作为生成事实来源。

### 阶段 6：生成交付物

按目标选择并写入 `outputs/` 目录（参考 `references/deliverables.md`），每条关键判断用 `[来源: URL]` 标注：

- **市场/竞品报告** `market-report.md` — 竞品是谁、各自主打什么、定价、用户评价主题（褒/贬）、机会点
- **定位文档** `positioning.md` — April Dunford 定位框架（竞争备选项、独有属性、价值、目标客户、市场类别）
- **获客渠道方案** `channels.md` — 按"渠道×内容×优先级"给清单，标注速赢与长线
- **触达文案** `outreach.md` — cold email / 私信 / 广告文案模板（附差异化话术）
- **首选内容** `content-first.md` — 3 篇可直接发布的首波内容（基于检索到的用户语言）

最后跑遍：检查每条市场判断是否有来源标注、是否自相矛盾、有无编造。写 `outputs/DATA-GAPS.md` 列证据缺口。

## 护栏

- **不编造**：竞品价格/功能/用户评价必须来自抓到的语料。抓不到 = DATA GAP，列出来，不猜。
- **不制造恐慌**：只说事实和推断，区分 `[语料原文]` 与 `[推断]`。
- **尊重限度**：不用 scrapling 突破登录墙/付费墙，遵守 robots.txt，控制抓取频率。
- **先回答**：用户问具体问题直接答，别只给流程。
- **续跑**：下一轮先读 `PROGRESS.md` 和 `outputs/`，从上次停点继续，别重跑。

## 参考文件

| 文件 | 何时读 |
|------|--------|
| `references/research-planning.md` | 阶段 2，决定抓什么 |
| `references/rag-queries.md` | 阶段 5，检索问题模板 |
| `references/deliverables.md` | 阶段 6，交付物模板 |
| `references/scrapling-cheatsheet.md` | scrapling 用法速查 |

## 脚本

| 脚本 | 作用 |
|------|------|
| `scripts/gather_corpus.py` | URL 列表 → 整页 Markdown 语料 |
| `scripts/build_index.py` | 语料 → BM25 倒排索引 |
| `scripts/retrieve.py` | 索引 + 查询 → 相关片段 |