# AI 可见度审计 · 正式报告
**被测站点:** https://www.sellersprite.com
**扫描时间:** 2026-09-30
**扫描页面:** 4 页（首页 + 发现的关键子页面）

## 总览
| 页面 | 状态 | 得分 / 满分 |
|---|---|---|
| / | 200 | 52 / 100 |
| /cn/ | 200 | 52 / 100 |
| /en/ | 200 | 67 / 100 |
| /jp/ | 200 | 76 / 100 |
| **聚合** | | **62 / 100** |

## 逐项明细（聚合所有页面最强/最弱表现）
| 检查项 | 权重 | 结果 |
|---|---|---|
| AI crawler access | 15 | No AI-crawler rules found. All 13 fall through to the wildcard/default rule — check what '*' resolves to.（页面平均 15/15） |
| Structured data (JSON-LD) | 15 | 6 type(s): BreadcrumbList, Organization, WebSite, SoftwareApplication, WebApplication, Product（页面平均 11/15） |
| Identity + FAQ schema | 10 | ✓ Organization/Corporation (who you are) · ✓ FAQPage (question/answer pairs — the format models quote most)（页面平均 6/10） |
| Heading structure | 10 | 1 × h1, 11 × h2, 10 × h3（页面平均 5/10） |
| Question-form headings | 10 | 1 found — e.g. "How to Master Amazon Listing Optimization in 2025"（页面平均 1/10） |
| Authorship and dates | 8 | ✓ named author/reviewer · ✓ publish or update date. Unattributed, undated claims get skipped in favour of a source that signs its work.（页面平均 3/8） |
| Outbound citations | 7 | 23 external domain(s) referenced: sellersprite.ai, sellersprite.jp, www.sellerspace.com, www.kolsprite.com, www.voc.ai…. Pages that cite primary sources are more likely to be trusted as references.（页面平均 7/7） |
| Product/service + article schema | 5 | ✓ Product/Service · ✗ Article/BlogPosting（页面平均 2/5） |
| llms.txt | 5 | Not present. Emerging convention; low cost, no downside, currently enforced by nobody.（页面平均 0/5） |
| Content depth on this page | 5 | ~1054 words（页面平均 5/5） |
| Open Graph | 5 | Complete.（页面平均 5/5） |

## 诚实边界
本报告测量的是站点对 AI 引擎的**可读性（legibility）**，不是其在任何 AI 答案中的
"排名"或"收录"。模型输出是采样的，无人能保证排名；提供"排名保证"的服务商
卖的是它无法控制的结果。可读性是可复现、可执行的输入侧。

> 由 Shiftless 审计工具生成 · 数值可复现（重新扫描应得相同结果）