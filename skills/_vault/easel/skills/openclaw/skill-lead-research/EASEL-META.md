# EASEL-META — skill-lead-research

本文件记录 SKILL 的移植血缘与致谢，不参与运行。

## 能力来源

| 来源 | 用途 |
|------|------|
| [startup-skill](https://github.com/ferdinandobons/startup-skill) (MIT) | 竞品情报 3 波研究法、April Dunford 定位框架、pitch/outreach 模板（西方 B2B/SaaS 方法论） |
| [Scrapling](https://github.com/D4Vinci/Scrapling) | 网页抓取引擎：自适应解析、反爬（Turnstile）、整站 Markdown 化供 RAG 入料（官方 agent-skill 的 `references/building-rag-systems.md`） |
| [Easel](https://github.com/ZJU-REAL/Easel) | 本仓库的 SKILL 接口规范 v0.3、manifest 产物契约、Profile 感知范式；`skill-competitor-analysis` 的中文拆解模板作为对标参考 |
| 本机 BM25 实现 | `scripts/build_index.py` / `retrieve.py` 为纯标准库检索增强生成（RAG）检索端，中文单字分词 + 停用词过滤 |

## 与相邻 SKILL 的边界

- `skill-competitor-analysis`：拆解中文社媒账号内容策略与爆款规律（discover）。
- 本 SKILL：抓任意目标页面建语料，面向"拿到客户"全链路决策（调研→定位→渠道→文案→首波内容），产出可追溯来源获客方案。

## 合规

- 抓取仅限授权/公开内容，尊重 robots.txt，控制频率，不突破登录墙与付费墙。
- 方案中市场/竞品判断必须标注来源，编造与数据缺口以 DATA GAP 明示。