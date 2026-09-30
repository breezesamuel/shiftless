---
name: skill-lead-research
description: >-
  帮老板/B2B 业务获客：抓真实网页成语料，用 BM25 检索增强生成(RAG)产出一份有据可查的获客方案——
  市场与竞品情报、差异化定位、渠道清单、触达文案、首波内容。当用户说"怎么获客""帮我做市场调研""分析竞品""如何定位""怎么找客户""渠道怎么选""写 cold email""b2b outreach""对标分析"时使用。
  与 skill-competitor-analysis 的区别：它拆解中文社媒账号内容策略；本 SKILL 抓任意目标网页（官网/定价/评价/论坛）建立可检索语料，
  面向"拿到客户"的全链路决策（调研→定位→渠道→文案），产出可追溯来源的获客方案。
layer: discover
---

# 帮老板获客（Lead Research + RAG）

> 抓真实网页 → 建语料 → BM25 检索增强生成 → 一份有据可查的获客方案。

原则：方案里每个"市场/竞品判断"都要能追溯到语料原文片段；禁止编造数据；缺口标 DATA GAP。

## 输入

- 用户提供的产品/服务描述、目标客户、（可选）竞品名单/URL
- 用户要的产出类型：调研 / 定位 / 渠道 / 文案 / 整套

## 输出

写入 `outputs/<主题>/`（主题=kebab-case，如 `mindmap-saas`）：
- `PROGRESS.md` — 阶段、来源、进度（断点续跑用）
- `market-report.md` — 竞品卡、定价全景、用户评价主题、机会点（主交付物）
- `positioning.md` — Dunford 定位（竞争备选项/独有属性/价值/目标客户/市场类别）+ One-Liner
- `channels.md` — 渠道×内容×优先级，标注速赢与长线
- `outreach.md` — cold email/私信/广告文案模板
- `content-first.md` — 3 篇首波内容（用检索到的用户语言）
- `DATA-GAPS.md` — 没抓到/靠推断的地方
- `corpus/` — 中间语料与索引（进 assets）

登记 meta：`python skills/shared/scripts/manifest.py meta --topic <主题> --title "..." --kind other --status draft`

## 执行步骤

### 1. 理解处境（先回答，再补问）
确认：卖什么 / 面向谁 / 当前渠道 / 目标。产出 `PROGRESS.md`。

### 2. 定抓取清单
参照 `references/research-planning.md`。竞品=官网+定价+博客+职位页；渠道=平台规则+用户比价地；客户=评价+问答。每 URL 一行写 `corpus/urls.txt`。

### 3. 抓语料
```bash
python skills/openclaw/skill-lead-research/scripts/gather_corpus.py --urls_file outputs/<主题>/corpus/urls.txt --out outputs/<主题>/corpus/ --sleep 0.5
```
scrapling 优先；反爬/空页标 DATA GAP，不硬闯。检查 `*.md` 数量质量，不足则补抓。

### 4. 建索引
```bash
python skills/openclaw/skill-lead-research/scripts/build_index.py --corpus outputs/<主题>/corpus/ --index outputs/<主题>/corpus/bm25.json
```

### 5. 检索增强生成
按 `references/rag-queries.md` 提 3-8 个聚焦 query，每条：
```bash
python skills/openclaw/skill-lead-research/scripts/retrieve.py --index outputs/<主题>/corpus/bm25.json --corpus outputs/<主题>/corpus/ --query "关键问题" --top 5 --context 400
```
以检索片段为事实来源。

### 6. 生成交付物
参照 `references/deliverables.md` 写文件，关键判断标 `[来源: URL]`、推断标 `[推断]`。跑通：查来源标注、一致性、有无编造。

## Profile 感知

- **有 Profile**：读 identity.md/platforms.md/style.md 对齐目标客户与内容调性，渠道与文案贴合用户账号矩阵。
- **无 Profile**：通用模式，问清赛道与目标客户即可，附注"提供账号 Profile 可获得更精准对标"。

## 护栏

- 不编造价格/功能/评价，抓不到=DATA GAP
- 不突破登录墙/付费墙；尊重 robots.txt 与频率
- 语义标记: `[语料原文]` vs `[推断]`
- 续跑先读 PROGRESS.md 与 outputs/，从停点继续

## 参考文件

| 文件 | 用途 |
|------|------|
| `references/research-planning.md` | 抓什么（步骤 2） |
| `references/rag-queries.md` | 检索 query 模板（步骤 5） |
| `references/deliverables.md` | 交付物模板（步骤 6） |
| `references/scrapling-cheatsheet.md` | 抓取引擎速查 |